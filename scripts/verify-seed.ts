/**
 * Skrip validasi seed demo (Fase D).
 *
 * Memastikan:
 * 1. Jumlah record demo sesuai ekspektasi (seed tidak bocor/dobel).
 * 2. sha256_hash tiap surat resmi COCOK dengan algoritma kanonik yang dipakai
 *    LettersService — jika tidak, halaman publik /verify/:sha256 akan
 *    menampilkan "TIDAK DIVERIFIKASI" untuk dokumen demo.
 * 3. qr_verify_url mengarah ke PUBLIC_VERIFY_BASE_URL yang benar.
 *
 * Catatan: validasi integritas hanya memeriksa surat yang dibuat oleh seed
 * (lihat prisma/seed-data.ts). Dokumen lain di database (mis. hasil smoke test
 * fase sebelumnya) sengaja diabaikan karena seed demo tidak mengelolanya.
 *
 * Jalankan: npx ts-node -r tsconfig-paths/register scripts/verify-seed.ts
 */
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { computeLetterHash } from '../src/modules/letters/letter-hash.util';
import { SURAT_SEED } from '../prisma/seed-data';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const verifyBase = process.env.PUBLIC_VERIFY_BASE_URL ?? 'https://app.apii.sigitadi.id/verify';
  const seededNumbers = new Set(SURAT_SEED.map((letter) => letter.letterNumber));

  const allLetters = await prisma.officialLetter.findMany({
    where: { letter_number: { in: [...seededNumbers] } },
  });

  let integrityFailures = 0;
  let qrFailures = 0;
  for (const letter of allLetters) {
    const expected = computeLetterHash(
      {
        letter_number: letter.letter_number,
        title: letter.title,
        letter_type: letter.letter_type,
        content_payload: letter.content_payload,
        kop_config: letter.kop_config,
        signatories: letter.signatories,
      },
      (data) => createHash('sha256').update(data).digest('hex'),
    );

    if (expected !== letter.sha256_hash) {
      integrityFailures += 1;
      console.log(`  ❌ INTEGRITAS: ${letter.letter_number}`);
      console.log(`     expected: ${expected}`);
      console.log(`     stored:   ${letter.sha256_hash}`);
    }

    const expectedQr = `${verifyBase}/${letter.sha256_hash}`;
    if (letter.qr_verify_url !== expectedQr) {
      qrFailures += 1;
      console.log(`  ❌ QR URL: ${letter.letter_number} — ${letter.qr_verify_url}`);
    }
  }

  const demoAuditLogs = await prisma.auditLog.count({
    where: { metadata: { path: ['demoSeed'], equals: true } },
  });
  const publishedFeed = await prisma.officialLetter.count({ where: { status: 'PUBLISHED' } });
  const publishedSchedules = await prisma.divisionSubmission.count({
    where: { status: 'PUBLISHED', execution_date: { not: null } },
  });

  console.log('\n===== VALIDASI SEED DEMO =====');
  console.log(`Surat seed:                  ${allLetters.length} dari ${SURAT_SEED.length}`);
  console.log(`Surat PUBLISHED (feed):      ${publishedFeed}   (>= 2)`);
  console.log(`Jadwal publik PUBLISHED:     ${publishedSchedules}   (ekspetasi: 3)`);
  console.log(`Audit log demo:              ${demoAuditLogs}   (ekspetasi: ${SURAT_SEED.length > 0 ? 4 : 0})`);
  console.log(`Gagal integritas hash:       ${integrityFailures}`);
  console.log(`Gagal QR URL:                ${qrFailures}`);

  const ok =
    allLetters.length === SURAT_SEED.length &&
    publishedFeed >= 2 &&
    publishedSchedules === 3 &&
    demoAuditLogs === 4 &&
    integrityFailures === 0 &&
    qrFailures === 0;

  console.log(ok ? '\n✅ SEMUA VALIDASI LOLOS' : '\n❌ ADA VALIDASI GAGAL');

  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch(async (error: unknown) => {
  console.error('Validasi gagal:', error);
  await prisma.$disconnect();
  process.exit(1);
});
