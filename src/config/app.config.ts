import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const TTL_PATTERN = /^\d+(s|m|h|d)$/;

/**
 * Skema validasi environment. Aplikasi menolak berjalan jika ada konfigurasi
 * kritis yang hilang — lebih baik gagal cepat di startup daripada error acak
 * di tengah request (PROJECT_RULES.md §3.6).
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    FRONTEND_URL: z.string().url(),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GOOGLE_CALLBACK_URL: z.string().url(),
    JWT_PRIVATE_KEY_PATH: z.string().optional(),
    JWT_PUBLIC_KEY_PATH: z.string().optional(),
    JWT_PRIVATE_KEY: z.string().optional(),
    JWT_PUBLIC_KEY: z.string().optional(),
    JWT_ACCESS_TTL: z.string().regex(TTL_PATTERN).default('15m'),
    JWT_REFRESH_TTL: z.string().regex(TTL_PATTERN).default('7d'),
    PUBLIC_VERIFY_BASE_URL: z.string().url(),
    CORS_ORIGINS: z.string().default(''),
  })
  .superRefine((env, ctx) => {
    if (!env.JWT_PRIVATE_KEY && !env.JWT_PRIVATE_KEY_PATH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_PRIVATE_KEY'],
        message: 'Wajib: JWT_PRIVATE_KEY (string satu baris) atau JWT_PRIVATE_KEY_PATH (file)',
      });
    }
    if (!env.JWT_PUBLIC_KEY && !env.JWT_PUBLIC_KEY_PATH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_PUBLIC_KEY'],
        message: 'Wajib: JWT_PUBLIC_KEY (string satu baris) atau JWT_PUBLIC_KEY_PATH (file)',
      });
    }
  });

type EnvConfig = z.infer<typeof envSchema>;

export interface AppConfig extends EnvConfig {
  isProduction: boolean;
  isDevelopment: boolean;
  jwtPrivateKey: string;
  jwtPublicKey: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  corsOrigins: string[];
}

/** Token injeksi NestJS (lihat config.module.ts) */
export const appConfigToken = 'APP_CONFIG';

function parseTtlToSeconds(ttl: string): number {
  const value = Number.parseInt(ttl.slice(0, -1), 10);
  const unit = ttl.slice(-1);
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * multipliers[unit];
}

/**
 * Baca kunci RSA: bisa inline (produksi, string satu baris dengan \n literal)
 * atau path file (development, lihat scripts/generate-keys.mjs).
 */
function resolveKey(
  inlineValue: string | undefined,
  filePath: string | undefined,
  label: string,
): string {
  if (inlineValue) {
    return inlineValue.replace(/\\n/g, '\n');
  }
  if (filePath) {
    return readFileSync(resolve(process.cwd(), filePath), 'utf-8');
  }
  throw new Error(`Konfigurasi tidak lengkap: ${label} tidak ditemukan di .env`);
}

export function loadAppConfig(): AppConfig {
  const parsed = envSchema.parse(process.env);

  return {
    ...parsed,
    isProduction: parsed.NODE_ENV === 'production',
    isDevelopment: parsed.NODE_ENV === 'development',
    jwtPrivateKey: resolveKey(
      parsed.JWT_PRIVATE_KEY,
      parsed.JWT_PRIVATE_KEY_PATH,
      'JWT_PRIVATE_KEY',
    ),
    jwtPublicKey: resolveKey(parsed.JWT_PUBLIC_KEY, parsed.JWT_PUBLIC_KEY_PATH, 'JWT_PUBLIC_KEY'),
    accessTokenTtlSeconds: parseTtlToSeconds(parsed.JWT_ACCESS_TTL),
    refreshTokenTtlSeconds: parseTtlToSeconds(parsed.JWT_REFRESH_TTL),
    corsOrigins: parsed.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
