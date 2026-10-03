import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { computeLetterHash } from '../src/modules/letters/letter-hash.util';
import {
  AUDIT_SEED,
  JABATAN_SEED,
  SURAT_MASUK_SEED,
  SURAT_SEED,
  SUBMISSION_SEED,
  VOUCHER_SEED,
} from './seed-data';

const prisma = new PrismaClient();

/**
 * Seed demo (Fase D): mengisi seluruh modul dengan contoh data lintas status agar
 * dashboard setiap jabatan, feed publik, dan jadwal tidak kosong saat aplikasi
 * pertama kali di-deploy. Lihat PRD.md Q6 & DESIGN.md §5.1.
 *
 * Seed ini IDEMPOTEN — aman dijalankan berulang. Setiap record di-upsert pada
 * kunci uniknya (email / letter_number / voucher_number / tracking_id / agenda),
 * sehingga data yang sudah diubah manual pengguna tidak ditimpa.
 */
const VERIFY_BASE_URL =
  process.env.PUBLIC_VERIFY_BASE_URL ?? 'https://app.apii.sigitadi.id/verify';

/** Helper: tanggal relatif terhadap "hari ini" agar demo selalu terlihat segar. */
function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date;
}

async function main(): Promise<void> {
  // ---------------------------------------------------------------- users ----
  const users = new Map<string, string>();
  for (const seed of JABATAN_SEED) {
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: {},
      create: {
        email: seed.email,
        full_name: seed.fullName,
        role: seed.role as never,
        division: (seed.division ?? null) as never,
        is_active: true,
        can_manage_users: ['SUPERADMIN', 'KETUA'].includes(seed.role),
        ...(seed.memberNumber
          ? {
              member_number: seed.memberNumber,
              member_since: new Date('2025-01-01T00:00:00Z'),
              card_issued_at: new Date('2025-01-01T00:00:00Z'),
            }
          : {}),
      },
    });
    users.set(seed.role, user.id);
  }

  const sekretarisId = users.get('SEKRETARIS') as string;
  const ketuaId = users.get('KETUA') as string;
  const bendaharaId = users.get('BENDAHARA') as string;
  const kadivHumasId = users.get('KETUA_DIVISI') as string;

  // -------------------------------------------------------------- letters ----
  for (const seed of SURAT_SEED) {
    // Hash dihitung dengan algoritma yang SAMA persis dengan LettersService
    // (lihat src/modules/letters/letter-hash.util.ts) sehingga halaman verifikasi
    // publik /public/verify/:sha256 memvalidasi dokumen demo sebagai dokumen ASLI.
    const hash = computeLetterHash(
      {
        letter_number: seed.letterNumber,
        title: seed.title,
        letter_type: seed.letterType,
        content_payload: seed.contentPayload,
        kop_config: seed.kopConfig,
        signatories: seed.signatories,
      },
      (data) => createHash('sha256').update(data).digest('hex'),
    );

    await prisma.officialLetter.upsert({
      where: { letter_number: seed.letterNumber },
      update: {},
      create: {
        letter_number: seed.letterNumber,
        title: seed.title,
        letter_type: seed.letterType as never,
        content_payload: seed.contentPayload as never,
        kop_config: seed.kopConfig as never,
        signatories: seed.signatories as never,
        sha256_hash: hash,
        qr_verify_url: `${VERIFY_BASE_URL}/${hash}`,
        status: seed.status as never,
        rejection_note: seed.rejectionNote ?? null,
        created_by_id: sekretarisId,
        approved_by_id: seed.status === 'PUBLISHED' ? ketuaId : null,
        published_at:
          seed.status === 'PUBLISHED' ? daysFromNow(-(seed.publishedAgo ?? 0)) : null,
        created_at: daysFromNow(-seed.createdAgo),
        updated_at: daysFromNow(-seed.createdAgo),
      },
    });
  }

  // ------------------------------------------------------------ vouchers ----
  for (const seed of VOUCHER_SEED) {
    const verifiedByBendahara =
      seed.status === 'VERIFIED_BENDAHARA' || seed.status === 'VERIFIED_KETUM';
    const transactionDate = daysFromNow(-seed.transactionAgo);

    await prisma.cashFlow.upsert({
      where: { voucher_number: seed.voucherNumber },
      update: {},
      create: {
        voucher_number: seed.voucherNumber,
        transaction_date: transactionDate,
        type: seed.type as never,
        account_category: seed.account as never,
        amount: seed.amount,
        description: seed.description,
        status: seed.status as never,
        rejection_note: seed.rejectionNote ?? null,
        verified_by_bendahara_id: verifiedByBendahara ? bendaharaId : null,
        verified_by_bendahara_at: verifiedByBendahara ? transactionDate : null,
        verified_by_ketum_id: seed.status === 'VERIFIED_KETUM' ? ketuaId : null,
        verified_by_ketum_at: seed.status === 'VERIFIED_KETUM' ? transactionDate : null,
        created_by_id: bendaharaId,
        created_at: transactionDate,
        updated_at: transactionDate,
      },
    });
  }

  // --- blok modul lain disisipkan di sini ---

  // --------------------------------------------------------- submissions ----
  for (const seed of SUBMISSION_SEED) {
    await prisma.divisionSubmission.upsert({
      where: { tracking_id: seed.trackingId },
      update: {},
      create: {
        tracking_id: seed.trackingId,
        division: seed.division as never,
        program_title: seed.programTitle,
        budget_estimate: seed.budget,
        target_audience: seed.targetAudience,
        execution_date:
          seed.executionInDays === null ? null : daysFromNow(seed.executionInDays),
        submission_data: (seed.submissionData ?? {}) as never,
        attachments: [] as never,
        status: seed.status as never,
        submitted_by_id: kadivHumasId,
        reviewed_by_id: seed.status === 'APPROVED' ? ketuaId : null,
        reviewed_at: seed.status === 'APPROVED' ? daysFromNow(-4) : null,
        created_at: daysFromNow(-14),
        updated_at: daysFromNow(-4),
      },
    });
  }

  // ---------------------------------------------------- incoming letters ----
  for (const seed of SURAT_MASUK_SEED) {
    const receivedDate = daysFromNow(-seed.receivedAgo);
    const isDisposed = seed.status === 'DISPOSED';

    await prisma.incomingLetter.upsert({
      where: { agenda_number: seed.agendaNumber },
      update: {},
      create: {
        agenda_number: seed.agendaNumber,
        source_institution: seed.source,
        letter_number: seed.letterNumber,
        subject: seed.subject,
        received_date: receivedDate,
        disposition_note: seed.dispositionNote ?? null,
        disposition_target_division: (seed.dispositionTarget ?? null) as never,
        status: seed.status as never,
        received_by_id: sekretarisId,
        disposed_by_id: isDisposed ? ketuaId : null,
        disposed_at: isDisposed ? receivedDate : null,
        created_at: receivedDate,
        updated_at: receivedDate,
      },
    });
  }

  // --- blok modul lain disisipkan di sini ---

  // ------------------------------------------------------------ audit log ----
  // Audit trail contoh agar halaman Pengawas & feed aktivitas tidak kosong.
  //
  // Idempotensi: setiap entri diberi penanda `metadata.demoSeed = true`, lalu
  // entri demo periode sebelumnya dihapus dulu sebelum dibuat ulang. Tanpa ini,
  // `createMany` akan menambah 4 baris baru di setiap pengulangan seed (id
  // audit log di-*generate* acak sehingga `skipDuplicates` tidak efektif).
  await prisma.auditLog.deleteMany({
    where: { metadata: { path: ['demoSeed'], equals: true } },
  });

  await prisma.auditLog.createMany({
    data: AUDIT_SEED.map((event) => ({
      action: event.action as never,
      actor_id: users.get(event.actorRole) as string,
      resource: event.resource,
      metadata: { demoSeed: true, ...event.metadata } as never,
      created_at: daysFromNow(-event.ago),
    })),
  });

  // -------------------------------------------------------- sequences -------
  // Counter disetel di atas jumlah record demo agar penomoran otomatis tidak
  // tabrak dengan record demo yang sudah ada (DESIGN.md §6.1-6.2).
  const year = new Date().getFullYear();
  await prisma.letterSequence.upsert({
    where: { year_letter_type: { year, letter_type: 'SK' as never } },
    update: {},
    create: { year, letter_type: 'SK' as never, current_number: 3 },
  });
  await prisma.voucherSequence.upsert({
    where: { year },
    update: {},
    create: { year, current_number: VOUCHER_SEED.length },
  });
  await prisma.submissionSequence.upsert({
    where: { year },
    update: {},
    create: { year, current_number: SUBMISSION_SEED.length },
  });

  console.log('✅ Seed demo selesai:');
  console.log(`  - ${JABATAN_SEED.length} akun jabatan`);
  console.log(`  - ${SURAT_SEED.length} surat resmi lintas status`);
  console.log(`  - ${VOUCHER_SEED.length} voucher kas lintas status`);
  console.log(`  - ${SUBMISSION_SEED.length} usulan program divisi`);
  console.log(`  - ${SURAT_MASUK_SEED.length} surat masuk`);
  console.log(`  - ${AUDIT_SEED.length} entri audit log`);
  console.log(`  - 3 sequence counter reset (tahun ${year})`);
  console.log('\n📋 Akun demo (login via mode demo / dev-login):');
  for (const seed of JABATAN_SEED) {
    console.log(`  [${seed.role}] ${seed.email} — ${seed.fullName}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error('Seed gagal:', error);
    await prisma.$disconnect();
    process.exit(1);
  });

