import { createSign, createVerify, randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Division, type User, UserRole } from '@prisma/client';
import { appConfigToken, type AppConfig } from '@/config/app.config';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { RedisService } from '@/infrastructure/redis/redis.service';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: UserRole;
  division: Division | null;
  jti: string;
  iat: number;
  exp: number;
  typ: 'access';
}

export interface RefreshTokenClaims {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  typ: 'refresh';
}

export type VerifiedUser = Pick<User, 'id' | 'email' | 'role' | 'division'>;

interface ClientMeta {
  userAgent?: string | null;
  ipAddress?: string | null;
}

const BLACKLIST_PREFIX = 'jwt:blacklist:';
const ALGORITHM = 'RS256';

function nowEpoch(): number {
  return Math.floor(Date.now() / 1000);
}

function base64url(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64url');
}

/**
 * JWT RS256 dengan signature crypto Node.js murni (tanpa dependensi eksternal).
 * Access token stateless; refresh token dipersistensi ke `refresh_sessions`
 * dengan jti yang bisa di-blacklist via Redis (DESIGN.md §4.5).
 */
@Injectable()
export class JwtService {
  constructor(
    @Inject(appConfigToken) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // --- Signing & verification ---------------------------------------------

  private sign(payload: AccessTokenClaims | RefreshTokenClaims, key: string): string {
    const header = base64url(JSON.stringify({ alg: ALGORITHM, typ: 'JWT' }));
    const body = base64url(JSON.stringify(payload));
    const data = `${header}.${body}`;
    const signer = createSign('RSA-SHA256');
    signer.update(data);
    const signature = signer.sign(key, 'base64url');
    return `${data}.${signature}`;
  }

  private verify<T extends AccessTokenClaims | RefreshTokenClaims>(token: string, key: string): T {
    const segments = token.split('.');
    if (segments.length !== 3) {
      throw new UnauthorizedException('Format token tidak valid');
    }
    const [header, body, signature] = segments;
    const data = `${header}.${body}`;
    const verifier = createVerify('RSA-SHA256');
    verifier.update(data);
    const isValid = verifier.verify(key, Buffer.from(signature, 'base64url'));
    if (!isValid) {
      throw new UnauthorizedException('Signature token tidak valid');
    }
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as T;
    if (typeof payload.exp !== 'number' || payload.exp < nowEpoch()) {
      throw new UnauthorizedException('Token sudah kedaluwarsa');
    }
    return payload;
  }

  signAccessToken(user: VerifiedUser): string {
    const iat = nowEpoch();
    return this.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        division: user.division,
        jti: randomUUID(),
        iat,
        exp: iat + this.config.accessTokenTtlSeconds,
        typ: 'access',
      },
      this.config.jwtPrivateKey,
    );
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    return this.verify<AccessTokenClaims>(token, this.config.jwtPublicKey);
  }

  signRefreshToken(userId: string, jti: string): string {
    const iat = nowEpoch();
    return this.sign(
      {
        sub: userId,
        jti,
        iat,
        exp: iat + this.config.refreshTokenTtlSeconds,
        typ: 'refresh',
      },
      this.config.jwtPrivateKey,
    );
  }

  verifyRefreshToken(token: string): RefreshTokenClaims {
    return this.verify<RefreshTokenClaims>(token, this.config.jwtPublicKey);
  }

  // --- Refresh session lifecycle ------------------------------------------

  async createRefreshSession(
    userId: string,
    meta: ClientMeta,
  ): Promise<{ jti: string; token: string }> {
    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + this.config.refreshTokenTtlSeconds * 1000);
    await this.prisma.refreshSession.create({
      data: {
        jti,
        user_id: userId,
        user_agent: meta.userAgent,
        ip_address: meta.ipAddress,
        expires_at: expiresAt,
      },
    });
    return { jti, token: this.signRefreshToken(userId, jti) };
  }

  /**
   * Rotasi refresh token: verifikasi → cabut sesi lama → terbitkan sesi baru.
   * Setiap pemakaian menghasilkan jti baru (membantu mendeteksi token yang dicuri).
   */
  async rotateRefreshSession(
    refreshToken: string,
    meta: ClientMeta,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const claims = this.verifyRefreshToken(refreshToken);
    if (await this.redis.exists(`${BLACKLIST_PREFIX}${claims.jti}`)) {
      throw new UnauthorizedException('Sesi sudah dicabut');
    }
    const session = await this.prisma.refreshSession.findUnique({
      where: { jti: claims.jti },
    });
    if (!session || session.revoked || session.user_id !== claims.sub) {
      throw new UnauthorizedException('Sesi tidak valid');
    }
    const user = await this.prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Akun nonaktif');
    }
    await this.prisma.refreshSession.update({
      where: { jti: claims.jti },
      data: { revoked: true },
    });
    const fresh = await this.createRefreshSession(user.id, meta);
    return {
      accessToken: this.signAccessToken(user),
      refreshToken: fresh.token,
    };
  }

  /** Logout satu perangkat: blacklist jti sampai token kedaluwarsa alami */
  async revokeRefreshSession(refreshToken: string): Promise<void> {
    const claims = this.verifyRefreshToken(refreshToken);
    await this.prisma.refreshSession.updateMany({
      where: { jti: claims.jti, revoked: false },
      data: { revoked: true },
    });
    await this.redis.setEx(
      `${BLACKLIST_PREFIX}${claims.jti}`,
      Math.max(claims.exp - nowEpoch(), 1),
      '1',
    );
  }

  /** Logout semua perangkat (FR-AUTH-02) */
  async revokeAllRefreshSessions(userId: string): Promise<void> {
    const sessions = await this.prisma.refreshSession.findMany({
      where: { user_id: userId, revoked: false },
      select: { jti: true, expires_at: true },
    });
    if (sessions.length === 0) {
      return;
    }
    await this.prisma.refreshSession.updateMany({
      where: { user_id: userId, revoked: false },
      data: { revoked: true },
    });
    for (const session of sessions) {
      const ttl = Math.floor((session.expires_at.getTime() - Date.now()) / 1000);
      if (ttl > 0) {
        await this.redis.setEx(`${BLACKLIST_PREFIX}${session.jti}`, ttl, '1');
      }
    }
  }
}
