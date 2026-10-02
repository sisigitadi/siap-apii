/**
 * Skrip verifikasi alur lengkap Sprint 1 (FR-LETTER-04/05/06/09 + FR-AUTH-08).
 * create → submit → approve-and-publish (persist PDF) → download → PATCH /auth/me.
 */
import { writeFileSync } from 'node:fs';

const BASE = 'http://localhost:3000/api/v1';

async function mintToken() {
  const { execSync } = await import('node:child_process');
  const raw = execSync('node scripts/mint-dev-token.mjs', {
    encoding: 'utf8',
    cwd: process.cwd(),
  });
  return raw.replace(/\s/g, '').trim();
}

async function main() {
  const token = await mintToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const report = [];

  const created = await fetch(`${BASE}/official-letters`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      letter_type: 'SK',
      title: 'SK Verifikasi Alur Lengkap Sprint 1',
      content_payload: {
        konsiderans: { Menimbang: ['Bahwa alur render PDF sudah lengkap.'], Memutuskan: ['Menetapkan keputusan ini.'] },
        body_text: 'Isi surat untuk verifikasi ujung-ke-ujung alur publikasi.',
        closing_text: 'Ditetapkan di Jakarta.',
      },
      signatories: [{ role_title: 'Ketua Umum DPW', name: 'H. Ahmad Fauzi, S.H.', has_stamp: true }],
    }),
  }).then((r) => r.json());
  const letterId = created.data.id;
  report.push(`CREATE: status=${created.data.status} id=${letterId}`);

  const submitted = await fetch(`${BASE}/official-letters/${letterId}/submit`, {
    method: 'POST',
    headers,
  }).then((r) => r.json());
  report.push(`SUBMIT : status=${submitted.data.status}`);

  const published = await fetch(`${BASE}/official-letters/${letterId}/approve-and-publish`, {
    method: 'POST',
    headers,
  }).then((r) => r.json());
  report.push(`PUBLISH: status=${published.data.status} pdf_storage_url=${published.data.pdf_storage_url}`);

  const download = await fetch(`${BASE}/official-letters/${letterId}/download`, { headers });
  const pdfBuffer = Buffer.from(await download.arrayBuffer());
  report.push(
    `DOWNLOAD: status=${download.status} bytes=${pdfBuffer.length} magic=${pdfBuffer.subarray(0, 5).toString('ascii')}`,
  );

  const profile = await fetch(`${BASE}/auth/me`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ full_name: 'Superadmin APII' }),
  }).then((r) => r.json());
  report.push(`PROFILE: fullName=${profile.data.fullName}`);

  const verify = await fetch(`${BASE}/official-letters/${letterId}`, { headers }).then((r) => r.json());
  report.push(`VERIFY : integrity stored sha256=${verify.data.sha256_hash.slice(0, 16)}...`);

  const output = report.join('\n');
  console.log(output);
  writeFileSync('sprint1-report.txt', output, 'utf8');
}

void main().catch((error) => {
  console.error('FAILED:', error);
  process.exit(1);
});
