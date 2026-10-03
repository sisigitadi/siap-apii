import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { type User } from '@prisma/client';
import { toPublicUser } from '@/common/dto/user.dto';
import { AuditService } from '@/infrastructure/audit/audit.service';
import { JwtService } from '@/infrastructure/jwt/jwt.service';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { AuthService } from './auth.service';
import { GoogleOAuthService } from './google-oauth.service';

const seededUser: User = {
  id: '22222222-2222-2222-2222-222222222222',
  email: 'ketum@apii-jabo.id',
  full_name: '',
  role: 'KETUA',
  division: null,
  is_active: true,
  can_manage_users: true,
  profile_picture_url: null,
  member_number: null,
  member_since: null,
  card_issued_at: null,
  card_expires_at: null,
  invited_by_id: null,
  invited_at: new Date('2026-09-01T00:00:00Z'),
  last_login_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let jwt: {
    signAccessToken: jest.Mock;
    verifyAccessToken: jest.Mock;
    createRefreshSession: jest.Mock;
    rotateRefreshSession: jest.Mock;
    revokeRefreshSession: jest.Mock;
    revokeAllRefreshSessions: jest.Mock;
  };
  let google: { exchangeCodeForUser: jest.Mock };
  let auditLog: jest.Mock;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    jwt = {
      signAccessToken: jest.fn().mockReturnValue('access-token'),
      verifyAccessToken: jest.fn().mockReturnValue({ sub: seededUser.id }),
      createRefreshSession: jest.fn().mockResolvedValue({ jti: 'jti-new', token: 'refresh-token' }),
      rotateRefreshSession: jest.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
      revokeRefreshSession: jest.fn().mockResolvedValue(undefined),
      revokeAllRefreshSessions: jest.fn().mockResolvedValue(undefined),
    };
    google = { exchangeCodeForUser: jest.fn() };
    auditLog = jest.fn().mockResolvedValue(undefined);

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      google as unknown as GoogleOAuthService,
      { log: auditLog } as unknown as AuditService,
    );
  });

  describe('handleGoogleCallback', () => {
    const meta = { ipAddress: '203.0.113.9', userAgent: 'jest' };

    it('menolak email yang belum terdaftar + mencatat LOGIN_DENIED (403)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      google.exchangeCodeForUser.mockResolvedValue({
        email: 'asing@gmail.com',
        emailVerified: true,
      });

      await expect(service.handleGoogleCallback('code', 'state', meta)).rejects.toThrow(
        ForbiddenException,
      );

      expect(auditLog).toHaveBeenCalledTimes(1);
      expect(auditLog).toHaveBeenCalledWith({
        action: 'LOGIN_DENIED',
        resource: 'GET /api/v1/auth/google/callback',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { email: 'asing@gmail.com', reason: 'email tidak terdaftar' },
      });
    });

    it('menolak akun yang dinonaktifkan', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...seededUser, is_active: false });
      google.exchangeCodeForUser.mockResolvedValue({
        email: seededUser.email,
        emailVerified: true,
      });

      await expect(service.handleGoogleCallback('code', 'state', meta)).rejects.toThrow(
        'Akun Anda dinonaktifkan. Hubungi superadmin.',
      );
      expect(auditLog).not.toHaveBeenCalled();
    });

    it('mengaktifkan akun undangan saat login pertama (USER_ACTIVATED)', async () => {
      prisma.user.findUnique.mockResolvedValue(seededUser);
      prisma.user.update.mockResolvedValue({
        ...seededUser,
        last_login_at: new Date(),
        full_name: 'Ketum Umum',
      });
      google.exchangeCodeForUser.mockResolvedValue({
        email: seededUser.email,
        emailVerified: true,
        name: 'Ketum Umum',
        picture: 'https://cdn/p.png',
      });

      const pair = await service.handleGoogleCallback('code', 'state', meta);

      expect(pair).toEqual({
        user: expect.objectContaining({ email: seededUser.email }),
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_ACTIVATED', actorId: seededUser.id }),
      );
    });

    it('mencatat LOGIN_SUCCESS pada login berikutnya', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...seededUser, last_login_at: new Date() });
      prisma.user.update.mockResolvedValue({ ...seededUser, last_login_at: new Date() });
      google.exchangeCodeForUser.mockResolvedValue({
        email: seededUser.email,
        emailVerified: true,
      });

      await service.handleGoogleCallback('code', 'state', meta);

      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN_SUCCESS', actorId: seededUser.id }),
      );
    });
  });

  describe('refresh', () => {
    it('merotasi sesi & mengembalikan profil pengguna', async () => {
      prisma.user.findUnique.mockResolvedValue(seededUser);

      const pair = await service.refresh('old-refresh', { ipAddress: '1.1.1.1' });

      expect(jwt.rotateRefreshSession).toHaveBeenCalledTimes(1);
      expect(pair.user).toEqual(toPublicUser(seededUser));
    });

    it('menolak refresh bila pengguna hilang', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.refresh('old-refresh', {})).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('mencabut satu sesi & mencatat LOGOUT', async () => {
      await service.logout('refresh-token', seededUser.id, {});

      expect(jwt.revokeRefreshSession).toHaveBeenCalledWith('refresh-token');
      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGOUT', actorId: seededUser.id }),
      );
    });

    it('tetap mencatat LOGOUT meski tanpa refresh token', async () => {
      await service.logout(undefined, seededUser.id, {});

      expect(jwt.revokeRefreshSession).not.toHaveBeenCalled();
      expect(auditLog).toHaveBeenCalledTimes(1);
    });

    it('logoutAll mencabut semua sesi', async () => {
      await service.logoutAll(seededUser.id, {});

      expect(jwt.revokeAllRefreshSessions).toHaveBeenCalledWith(seededUser.id);
      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGOUT', metadata: { allDevices: true } }),
      );
    });
  });
});
