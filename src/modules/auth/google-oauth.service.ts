import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { appConfigToken, type AppConfig } from '@/config/app.config';
import { RedisService } from '@/infrastructure/redis/redis.service';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const SCOPES = ['openid', 'email', 'profile'];
const PKCE_TTL_SECONDS = 600;
const PKCE_PREFIX = 'google:pkce:';

export interface GoogleUserInfo {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

interface GoogleTokenResponse {
  access_token?: string;
}

/**
 * Google OAuth 2.0 dengan PKCE (DESIGN.md §3 baris 6).
 * code_verifier disimpan di Redis sebentar, dipakai sekali saat callback.
 */
@Injectable()
export class GoogleOAuthService {
  constructor(
    @Inject(appConfigToken) private readonly config: AppConfig,
    private readonly redis: RedisService,
  ) {}

  async createAuthorizationUrl(): Promise<string> {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const state = randomUUID();

    await this.redis.setEx(`${PKCE_PREFIX}${state}`, PKCE_TTL_SECONDS, verifier);

    const params = new URLSearchParams({
      client_id: this.config.GOOGLE_CLIENT_ID,
      redirect_uri: this.config.GOOGLE_CALLBACK_URL,
      response_type: 'code',
      scope: SCOPES.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /** Tukar authorization code dengan token, lalu ambil profil pengguna */
  async exchangeCodeForUser(code: string, state: string): Promise<GoogleUserInfo> {
    const verifier = await this.redis.get(`${PKCE_PREFIX}${state}`);
    if (!verifier) {
      throw new UnauthorizedException('Sesi login kedaluwarsa atau tidak valid');
    }
    await this.redis.del(`${PKCE_PREFIX}${state}`);

    const tokenBody = new URLSearchParams({
      code,
      client_id: this.config.GOOGLE_CLIENT_ID,
      client_secret: this.config.GOOGLE_CLIENT_SECRET,
      redirect_uri: this.config.GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    });

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });
    if (!tokenResponse.ok) {
      throw new UnauthorizedException('Gagal menukar kode otorisasi dengan Google');
    }
    const tokens = (await tokenResponse.json()) as GoogleTokenResponse;
    if (!tokens.access_token) {
      throw new UnauthorizedException('Google tidak mengembalikan access token');
    }

    const userResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userResponse.ok) {
      throw new UnauthorizedException('Gagal mengambil profil Google');
    }
    const info = (await userResponse.json()) as GoogleUserInfo;
    if (!info.emailVerified) {
      throw new UnauthorizedException('Email Google belum terverifikasi');
    }
    return info;
  }
}
