import { UserRole } from '@prisma/client';

/**
 * Peran yang boleh mengakses data lintas divisi (DESIGN.md §5.3).
 * Mereka adalah pengurus tingkat wilayah, bukan admin divisi.
 */
export const CROSS_DIVISION_ROLES: UserRole[] = [
  'SUPERADMIN',
  'KETUA_UMUM',
  'SEKRETARIS',
  'BENDAHARA',
  'DEWAN_PENGAWAS',
];

/** Peran yang bisa diberi flag delegasi can_manage_users (DESIGN.md §5.2) */
export const DELEGATABLE_ROLES: UserRole[] = ['KETUA_UMUM', 'SEKRETARIS', 'BENDAHARA'];

/** Peran admin divisi — wajib punya field `division` */
export const DIVISION_ROLES: UserRole[] = [
  'DIV_HUMAS',
  'DIV_LITBANG',
  'DIV_SOSMED',
  'DIV_DAKWAH',
  'DIV_INVESTASI',
  'DIV_HUKUM',
  'DIV_UMUM',
];

/** Label ramah untuk tampilan UI (PROJECT_RULES.md §6) */
export const ROLE_LABELS: Record<UserRole, string> = {
  SUPERADMIN: 'Superadmin',
  KETUA_UMUM: 'Ketua Umum',
  SEKRETARIS: 'Sekretaris',
  BENDAHARA: 'Bendahara',
  DEWAN_PENGAWAS: 'Dewan Pengawas',
  DIV_HUMAS: 'Admin Humas',
  DIV_LITBANG: 'Admin Litbang',
  DIV_SOSMED: 'Admin Sosmed',
  DIV_DAKWAH: 'Admin Dakwah',
  DIV_INVESTASI: 'Admin Investasi',
  DIV_HUKUM: 'Admin Hukum',
  DIV_UMUM: 'Admin Umum',
  PUBLIK_ANGGOTA: 'Anggota',
};
