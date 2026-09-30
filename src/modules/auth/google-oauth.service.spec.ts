import { UnauthorizedException } from '@nestjs/common';
import type { AppConfig } from '@/config/app.config';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { GoogleOAuthService } from './google-oauth.service';

const GOOGLE_CONFIG = {
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-secret',
  GOOGLE_CALLBACK_URL: 'https://api.apii.sigitadi.id/api/v1/auth/google/callback',
} as unknown as AppConfig;

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response;
}

describe('GoogleOAuthService', () => {
  let service: GoogleOAuthService;
  let redis: Record<string, jest.Mock>;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    redis = {
      setEx: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue('stored-verifier'),
      del: jest.fn().mockResolvedValue(undefined),
    };
    service = new GoogleOAuthService(GOOGLE_CONFIG, redis as unknown as RedisService);
  });

  afterEach(() => {
    if (fetchMock) {
      fetchMock.mockRestore();
    }
  });

  describe('createAuthorizationUrl', () => {
    it('membuat URL dengan PKCE challenge & state, lalu menyimpan verifier', async () => {
      const url = new URL(await service.createAuthorizationUrl());

      expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('code_challenge')).toBeTruthy();
      const state = url.searchParams.get('state');
      expect(state).toBeTruthy();

      expect(redis.setEx).toHaveBeenCalledWith(
        `google:pkce:${state}`,
        expect.any(Number),
        expect.any(String),
      );
    });
  });

  describe('exchangeCodeForUser', () => {
    it('menukar code & mengembalikan profil pengguna terverifikasi', async () => {
      fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
        const target = String(input);
        if (target.includes('oauth2.googleapis.com/token')) {
          return jsonResponse({ access_token: 'google-access-token' });
        }
        return jsonResponse({
          sub: 'google-sub',
          email: 'ketum@apii-jabo.id',
          emailVerified: true,
          name: 'Ketum Umum',
          picture: 'https://cdn/apii.png',
        });
      });

      const info = await service.exchangeCodeForUser('auth-code', 'state-1');

      expect(info).toMatchObject({ email: 'ketum@apii-jabo.id', emailVerified: true });
      expect(redis.del).toHaveBeenCalledWith('google:pkce:state-1');
      // Verifier dipakai saat tukar token
      const tokenCall = fetchMock.mock.calls[0];
      expect(String(tokenCall[1]?.body ?? '')).toContain('code_verifier=stored-verifier');
    });

    it('menolak bila state/PKCE tidak ditemukan di Redis', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.exchangeCodeForUser('code', 'state-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('menolak bila endpoint token Google gagal', async () => {
      fetchMock = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(jsonResponse({}, false) as Response);

      await expect(service.exchangeCodeForUser('code', 'state-1')).rejects.toThrow(
        'Gagal menukar kode otorisasi dengan Google',
      );
    });

    it('menolak email yang belum terverifikasi Google', async () => {
      fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
        const target = String(input);
        if (target.includes('oauth2.googleapis.com/token')) {
          return jsonResponse({ access_token: 'tok' });
        }
        return jsonResponse({ email: 'a@b.com', emailVerified: false });
      });

      await expect(service.exchangeCodeForUser('code', 'state-1')).rejects.toThrow(
        'Email Google belum terverifikasi',
      );
    });
  });
});
