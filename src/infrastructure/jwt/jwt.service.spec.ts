import { generateKeyPairSync } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { appConfigToken, type AppConfig } from '@/config/app.config';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { JwtService } from './jwt.service';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

/** Konfigurasi minimal yang dibutuhkan JwtService (field lain tidak dipakai) */
function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    jwtPrivateKey: privateKey,
    jwtPublicKey: publicKey,
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 604800,
    ...overrides,
  } as unknown as AppConfig;
}

const user = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'ketum@apii-jabo.id',
  role: 'KETUA_UMUM',
  division: null,
} as const;

describe('JwtService', () => {
  let jwt: JwtService;
  let prisma: {
    refreshSession: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      findMany: jest.Mock;
    };
    user: { findUnique: jest.Mock };
  };
  let redis: { exists: jest.Mock; setEx: jest.Mock };

  beforeEach(async () => {
    prisma = {
      refreshSession: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: { findUnique: jest.fn() },
    };
    redis = {
      exists: jest.fn().mockResolvedValue(false),
      setEx: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: appConfigToken, useValue: makeConfig() },
      ],
    }).compile();

    jwt = moduleRef.get(JwtService);
  });

  describe('sign & verify', () => {
    it('access token terverifikasi dan membawa klaim pengguna', () => {
      const token = jwt.signAccessToken(user);
      expect(token.split('.')).toHaveLength(3);

      const claims = jwt.verifyAccessToken(token);
      expect(claims).toMatchObject({
        sub: user.id,
        email: user.email,
        role: user.role,
        typ: 'access',
      });
      expect(claims.jti).toBeTruthy();
    });

    it('refresh token terverifikasi dengan tipe "refresh"', () => {
      const token = jwt.signRefreshToken(user.id, 'jti-abc');
      expect(jwt.verifyRefreshToken(token)).toMatchObject({
        sub: user.id,
        jti: 'jti-abc',
        typ: 'refresh',
      });
    });

    it('menolak token yang signaturenya diubah', () => {
      const token = jwt.signAccessToken(user);
      const tampered = `${token.slice(0, -4)}AAAA`;
      expect(() => jwt.verifyAccessToken(tampered)).toThrow(UnauthorizedException);
    });

    it('menolak token kedaluwarsa', () => {
      const negativeJwt = new JwtService(
        makeConfig({ accessTokenTtlSeconds: -10 }),
        prisma as unknown as PrismaService,
        redis as unknown as RedisService,
      );
      const expired = negativeJwt.signAccessToken(user);

      expect(() => jwt.verifyAccessToken(expired)).toThrow('Token sudah kedaluwarsa');
    });
  });

  describe('refresh session lifecycle', () => {
    it('createRefreshSession menyimpan sesi & mengembalikan token valid', async () => {
      const result = await jwt.createRefreshSession(user.id, { ipAddress: '1.1.1.1' });

      expect(prisma.refreshSession.create).toHaveBeenCalledTimes(1);
      expect(result.jti).toBeTruthy();
      expect(jwt.verifyRefreshToken(result.token).jti).toBe(result.jti);
    });

    it('rotateRefreshSession mencabut sesi lama & menerbitkan pasangan baru', async () => {
      prisma.refreshSession.findUnique.mockResolvedValue({
        jti: 'jti-old',
        user_id: user.id,
        revoked: false,
      });
      prisma.user.findUnique.mockResolvedValue({ id: user.id, is_active: true });

      const created = await jwt.createRefreshSession(user.id, {});
      const rotated = await jwt.rotateRefreshSession(created.token, {});

      expect(prisma.refreshSession.update).toHaveBeenCalledWith({
        where: { jti: created.jti },
        data: { revoked: true },
      });
      expect(rotated.accessToken.split('.')).toHaveLength(3);
      expect(rotated.refreshToken).not.toBe(created.token);
    });

    it('rotateRefreshSession menolak jti yang sudah di-blacklist', async () => {
      redis.exists.mockResolvedValue(true);
      const created = await jwt.createRefreshSession(user.id, {});

      await expect(jwt.rotateRefreshSession(created.token, {})).rejects.toThrow(
        'Sesi sudah dicabut',
      );
    });

    it('revokeRefreshSession mendaftarkan jti di blacklist Redis', async () => {
      const created = await jwt.createRefreshSession(user.id, {});
      await jwt.revokeRefreshSession(created.token);

      expect(prisma.refreshSession.updateMany).toHaveBeenCalledTimes(1);
      expect(redis.setEx).toHaveBeenCalledWith(
        expect.stringContaining(`jwt:blacklist:${created.jti}`),
        expect.any(Number),
        '1',
      );
    });

    it('revokeAllRefreshSessions mendaftarkan semua sesi aktif', async () => {
      prisma.refreshSession.findMany.mockResolvedValue([
        { jti: 'jti-1', expires_at: new Date(Date.now() + 60_000) },
        { jti: 'jti-2', expires_at: new Date(Date.now() + 60_000) },
      ]);

      await jwt.revokeAllRefreshSessions(user.id);

      expect(prisma.refreshSession.updateMany).toHaveBeenCalledTimes(1);
      expect(redis.setEx).toHaveBeenCalledTimes(2);
    });
  });
});
