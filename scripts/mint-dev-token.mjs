// Dev-only: mints an RS256 access token for a seeded user so protected REST
// routes and the WS gateway can be exercised WITHOUT going through Google
// OAuth (GOOGLE_CLIENT_ID is a placeholder in the dev .env). Signature
// algorithm & claims mirror src/infrastructure/jwt/jwt.service.ts exactly.
//
// Usage (from repo root):
//   $env:DATABASE_URL='postgresql://apii:apii@172.19.5.81:5432/apii_jabo'
//   node scripts/mint-dev-token.mjs [ROLE]   # default ROLE=SUPERADMIN
import { createSign, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const role = process.argv[2] ?? 'SUPERADMIN';

const prisma = new PrismaClient();
const user = await prisma.user.findFirst({ where: { role } });
if (!user) {
  console.error(`Tidak ada user dengan role ${role}. Jalankan \`npm run seed\` dulu.`);
  process.exit(1);
}

const key = readFileSync(resolve(here, '..', 'keys', 'private.pem'), 'utf-8');
const iat = Math.floor(Date.now() / 1000);
const payload = {
  sub: user.id,
  email: user.email,
  role: user.role,
  division: user.division,
  jti: randomUUID(),
  iat,
  exp: iat + 900, // 15 menit (JWT_ACCESS_TTL)
  typ: 'access',
};

const b64url = (value) => Buffer.from(value, 'utf-8').toString('base64url');
const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
const data = `${header}.${b64url(JSON.stringify(payload))}`;
const signer = createSign('RSA-SHA256');
signer.update(data);
const signature = signer.sign(key, 'base64url');

process.stdout.write(`${data}.${signature}`);
await prisma.$disconnect();
