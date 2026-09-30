import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed awal: 4 akun inti (lihat PRD.md Q6).
 * Superadmin sudah final; 3 akun pimpinan adalah placeholder —
 * kelola sendiri lewat menu kelola anggota setelah login pertama.
 */
async function main(): Promise<void> {
  const superadmin = await prisma.user.upsert({
    where: { email: 'si.sigitadi@gmail.com' },
    update: {},
    create: {
      email: 'si.sigitadi@gmail.com',
      full_name: 'Sigit Adi (Superadmin)',
      role: 'SUPERADMIN',
      is_active: true,
      can_manage_users: true,
    },
  });

  const ketua = await prisma.user.upsert({
    where: { email: 'ketua.umum@siap-apii.local' },
    update: {},
    create: {
      email: 'ketua.umum@siap-apii.local',
      full_name: 'Ketua Umum (placeholder)',
      role: 'KETUA_UMUM',
      is_active: true,
      can_manage_users: true,
    },
  });

  const sekretaris = await prisma.user.upsert({
    where: { email: 'sekretaris@siap-apii.local' },
    update: {},
    create: {
      email: 'sekretaris@siap-apii.local',
      full_name: 'Sekretaris (placeholder)',
      role: 'SEKRETARIS',
      is_active: true,
      can_manage_users: true,
    },
  });

  const bendahara = await prisma.user.upsert({
    where: { email: 'bendahara@siap-apii.local' },
    update: {},
    create: {
      email: 'bendahara@siap-apii.local',
      full_name: 'Bendahara (placeholder)',
      role: 'BENDAHARA',
      is_active: true,
      can_manage_users: true,
    },
  });

  console.log('Seed selesai — 4 akun inti:');
  for (const user of [superadmin, ketua, sekretaris, bendahara]) {
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
