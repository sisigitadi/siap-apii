import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed awal: akun demo untuk seluruh jabatan organisasi (lihat PRD.md Q6 &
 * DESIGN.md §5.1). Superadmin final; akun lain adalah placeholder — kelola
 * sendiri lewat menu kelola anggota setelah login pertama.
 */
const JABATAN_SEED: Array<{
  email: string;
  full_name: string;
  role: string;
  division?: string;
  member_number?: string;
}> = [
  { email: 'si.sigitadi@gmail.com', full_name: 'Sigit Adi (Superadmin)', role: 'SUPERADMIN' },
  { email: 'ketua@apii-jabodetabek.or.id', full_name: 'Ketua (placeholder)', role: 'KETUA' },
  { email: 'sekretaris@apii-jabodetabek.or.id', full_name: 'Sekretaris (placeholder)', role: 'SEKRETARIS' },
  { email: 'bendahara@apii-jabodetabek.or.id', full_name: 'Bendahara (placeholder)', role: 'BENDAHARA' },
  { email: 'pembina@apii-jabodetabek.or.id', full_name: 'Pembina (placeholder)', role: 'PEMBINA' },
  { email: 'pengawas@apii-jabodetabek.or.id', full_name: 'Pengawas (placeholder)', role: 'PENGAWAS' },
  {
    email: 'kadiv.humas@apii-jabodetabek.or.id',
    full_name: 'Ketua Divisi Humas (placeholder)',
    role: 'KETUA_DIVISI',
    division: 'DIV_HUMAS',
  },
  {
    email: 'anggota.humas@apii-jabodetabek.or.id',
    full_name: 'Anggota Divisi Humas (placeholder)',
    role: 'ANGGOTA_DIVISI',
    division: 'DIV_HUMAS',
  },
  {
    email: 'anggota@apii-jabodetabek.or.id',
    full_name: 'Anggota Biasa Contoh',
    role: 'ANGGOTA_BIASA',
    member_number: 'APII-JABO-0001',
  },
];

async function main(): Promise<void> {
  const created = [];
  for (const seed of JABATAN_SEED) {
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: {},
      create: {
        email: seed.email,
        full_name: seed.full_name,
        role: seed.role as never,
        division: (seed.division ?? null) as never,
        is_active: true,
        can_manage_users: ['SUPERADMIN', 'KETUA'].includes(seed.role),
        ...(seed.member_number
          ? {
              member_number: seed.member_number,
              member_since: new Date('2025-01-01T00:00:00Z'),
              card_issued_at: new Date('2025-01-01T00:00:00Z'),
            }
          : {}),
      },
    });
    created.push(user);
  }

  console.log(`Seed selesai — ${created.length} akun jabatan:`);
  for (const user of created) {
    console.log(`  [${user.role}] ${user.email} — ${user.full_name}`);
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

