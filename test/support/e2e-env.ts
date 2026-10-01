/**
 * Environment minimal untuk e2e. WAJIB di-import paling pertama di setiap spec
 * (sebelum AppModule ter-instantiate) karena loadAppConfig() membaca process.env
 * saat ConfigModule dievaluasi (DESIGN.md §3.6).
 *
 * Kunci RSA dipakai inline (satu baris, `\n` literal) — persis seperti env var
 * produksi di Vercel (lihat docs/deploy.md).
 */
import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

// resolveKey() di app.config.ts mengganti `\n` literal menjadi baris baru.
const inlinePem = (pem: string): string => pem.replace(/\r?\n/g, '\\n');

process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '3001';
process.env.FRONTEND_URL ??= 'http://localhost:5173';
process.env.DATABASE_URL ??= 'postgresql://e2e:e2e@localhost:5432/e2e';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.GOOGLE_CLIENT_ID ??= 'e2e.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET ??= 'e2e-secret';
process.env.GOOGLE_CALLBACK_URL ??= 'http://localhost:3001/api/v1/auth/google/callback';
process.env.PUBLIC_VERIFY_BASE_URL ??= 'http://localhost:5173/verify';
process.env.CORS_ORIGINS ??= 'http://localhost:5173';
process.env.JWT_PRIVATE_KEY ??= inlinePem(privateKey);
process.env.JWT_PUBLIC_KEY ??= inlinePem(publicKey);
