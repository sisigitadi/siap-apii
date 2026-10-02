import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { toPublicUser, type PublicUser } from '@/common/dto/user.dto';
import { AuditService } from '@/infrastructure/audit/audit.service';
import { JwtService } from '@/infrastructure/jwt/jwt.service';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import type { TokenPair, UpdateProfileInput } from './auth.dto';
import { GoogleOAuthService } from './google-oauth.service';

interface ClientMeta {
  userAgent?: string | null;
  ipAddress?: string | null;
}

export { ClientMeta };

/**
 * Inti otentikasi: Google OAuth PKCE (login) + JWT RS256 (sesi).
 * Akses hanya untuk email yang sudah terdaftar/diundang (FR-AUTH-04/05/06).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly google: GoogleOAuthService,
    private readonly audit: AuditService,
  ) {}

  async getAuthorizationUrl(): Promise<string> {
    return this.google.createAuthorizationUrl();
  }

  async handleGoogleCallback(code: string, state: string, meta: ClientMeta): Promise<TokenPair> {
    const info = await this.google.exchangeCodeForUser(code, state);

    const existing = await this.prisma.user.findUnique({ where: { email: info.email } });
    if (!existing) {
      await this.audit.log({
        action: 'LOGIN_DENIED',
        resource: 'GET /api/v1/auth/google/callback',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { email: info.email, reason: 'email tidak terdaftar' },
      });
      throw new ForbiddenException(
        'Email Anda belum terdaftar sebagai pengurus. Minta undangan dari superadmin atau pimpinan yang didelegasikan.',
      );
    }
    if (!existing.is_active) {
      throw new ForbiddenException('Akun Anda dinonaktifkan. Hubungi superadmin.');
    }

    // Akun undangan aktif saat login Google pertama (FR-AUTH-05)
    const wasInvited = existing.invited_at !== null && existing.last_login_at === null;

    const user = await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        last_login_at: new Date(),
        full_name:
          existing.full_name.trim() === '' ? (info.name ?? existing.full_name) : existing.full_name,
        profile_picture_url: info.picture ?? existing.profile_picture_url,
      },
    });

    await this.audit.log({
      action: wasInvited ? 'USER_ACTIVATED' : 'LOGIN_SUCCESS',
      actorId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { via: 'google-oauth' },
    });

    return this.issueTokens(user, meta);
  }

  async refresh(refreshToken: string, meta: ClientMeta): Promise<TokenPair> {
    const rotated = await this.jwt.rotateRefreshSession(refreshToken, meta);
    const claims = this.jwt.verifyAccessToken(rotated.accessToken);
    const user = await this.prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user) {
      throw new UnauthorizedException('Pengguna tidak ditemukan');
    }
    return {
      user: toPublicUser(user),
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
    };
  }

  async logout(refreshToken: string | undefined, actorId: string, meta: ClientMeta): Promise<void> {
    if (refreshToken) {
      await this.jwt.revokeRefreshSession(refreshToken);
    }
    await this.audit.log({
      action: 'LOGOUT',
      actorId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async logoutAll(actorId: string, meta: ClientMeta): Promise<void> {
    await this.jwt.revokeAllRefreshSessions(actorId);
    await this.audit.log({
      action: 'LOGOUT',
      actorId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { allDevices: true },
    });
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Pengguna tidak ditemukan');
    }
    return toPublicUser(user);
  }

  /**
   * Pembaruan profil mandiri: nama tampilan & foto (FR-AUTH-08).
   * Email & peran tidak boleh diubah sendiri — melalui superadmin (FR-AUTH-07).
   */
  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
    meta: ClientMeta,
  ): Promise<PublicUser> {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new UnauthorizedException('Pengguna tidak ditemukan');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        full_name: input.full_name.trim(),
        ...(input.profile_picture_url ? { profile_picture_url: input.profile_picture_url } : {}),
      },
    });

    await this.audit.log({
      action: 'PROFILE_UPDATED',
      actorId: userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        previousFullName: existing.full_name,
        newFullName: updated.full_name,
        pictureChanged: input.profile_picture_url !== undefined,
      },
    });

    return toPublicUser(updated);
  }

  private async issueTokens(user: User, meta: ClientMeta): Promise<TokenPair> {
    const { token: refreshToken } = await this.jwt.createRefreshSession(user.id, meta);
    return {
      user: toPublicUser(user),
      accessToken: this.jwt.signAccessToken(user),
      refreshToken,
    };
  }
}
