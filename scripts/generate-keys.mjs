// Generate keypair RS256 untuk JWT (DESIGN.md §3 baris 6 & §11.4 catatan 7).
// Jalankan: npm run keys
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';

const KEYS_DIR = resolve(process.cwd(), 'keys');

if (existsSync(resolve(KEYS_DIR, 'private.pem'))) {
  console.error('Keypair sudah ada di keys/. Hapus dulu jika ingin membuat ulang.');
  process.exit(1);
}

mkdirSync(KEYS_DIR, { recursive: true });

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const privateKeyPath = resolve(KEYS_DIR, 'private.pem');
const publicKeyPath = resolve(KEYS_DIR, 'public.pem');

writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
writeFileSync(publicKeyPath, publicKey, { mode: 0o644 });
chmodSync(privateKeyPath, 0o600);

console.log('Keypair RS256 dibuat:');
console.log(`  ${privateKeyPath}  (rahasia — lihat .gitignore)`);
console.log(`  ${publicKeyPath}`);
console.log('\nTambahkan ke .env (produksi): JWT_PRIVATE_KEY / JWT_PUBLIC_KEY sebagai string satu baris.');
