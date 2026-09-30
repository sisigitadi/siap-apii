import type { Response } from 'express';
import type { AppConfig } from '@/config/app.config';

export const ACCESS_COOKIE = 'apii_access_token';
export const REFRESH_COOKIE = 'apii_refresh_token';

const REFRESH_COOKIE_PATH = '/api/v1/auth';

function isSecure(config: AppConfig): boolean {
  return config.isProduction;
}

/** Simpan token di httpOnly cookie (sameSite=lax aman lintas subdomain sigitadi.id) */
export function setAuthCookies(
  response: Response,
  config: AppConfig,
  accessToken: string,
  refreshToken: string,
): void {
  response.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: isSecure(config),
    sameSite: 'lax',
    maxAge: config.accessTokenTtlSeconds * 1000,
  });
  response.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isSecure(config),
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: config.refreshTokenTtlSeconds * 1000,
  });
}

export function clearAuthCookies(response: Response, config: AppConfig): void {
  response.clearCookie(ACCESS_COOKIE, {
    httpOnly: true,
    secure: isSecure(config),
    sameSite: 'lax',
  });
  response.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: isSecure(config),
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
  });
}
