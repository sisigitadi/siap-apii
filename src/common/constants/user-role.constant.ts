import { UserRole } from '@prisma/client';

/**
 * Peran yang boleh mengakses data lintas divisi (DESIGN.md §5.3).
 * Mereka adalah pengurus tingkat wilayah, bukan admin divisi.
 */
export const CROSS_DIVISION_ROLES: UserRole[] = [
  'SUPERADMIN',
  'KETUA',
  'SEKRETARIS',
  'BENDAHARA',
  'PEMBINA',
  'PENGAWAS',
];

/** Peran yang bisa diberi flag delegasi can_manage_users (DESIGN.md §5.2) */
export const DELEGATABLE_ROLES: UserRole[] = ['KETUA', 'SEKRETARIS', 'BENDAHARA'];

/** Peran pengurus divisi — wajib punya field `division` */
export const DIVISION_ROLES: UserRole[] = ['KETUA_DIVISI', 'ANGGOTA_DIVISI'];

/** Peran yang hanya boleh melihat (read-only) — tidak ada tombol mutasi */
export const READONLY_ROLES: UserRole[] = ['PEMBINA', 'PENGAWAS', 'ANGGOTA_BIASA'];

/** Jabatan organisasi (8) — SUPERADMIN dikeluarkan karena ia peran infrastruktur, bukan jabatan. */
export const ORGANIZATION_ROLES: UserRole[] = [
  'KETUA',
  'SEKRETARIS',
  'BENDAHARA',
  'PEMBINA',
  'PENGAWAS',
  'KETUA_DIVISI',
  'ANGGOTA_DIVISI',
  'ANGGOTA_BIASA',
];

/** Label ramah untuk tampilan UI (PROJECT_RULES.md §6) */
export const ROLE_LABELS: Record<UserRole, string> = {
  SUPERADMIN: 'Superadmin',
  KETUA: 'Ketua',
  SEKRETARIS: 'Sekretaris',
  BENDAHARA: 'Bendahara',
  PEMBINA: 'Pembina',
  PENGAWAS: 'Pengawas',
  KETUA_DIVISI: 'Ketua Divisi',
  ANGGOTA_DIVISI: 'Anggota Divisi',
  ANGGOTA_BIASA: 'Anggota Biasa',
};

/**
 * Tugas & tanggung jawab tiap jabatan.
 *
 * Sumber: Anggaran Rumah Tangga APII (Dokumen Sumber/3.) adalah dokumen pindaan
 * yang teksnya tidak bisa diekstrak secara mesin, sehingga uraian di bawah
 * dirangkum dari DESIGN.md §5.1 + master prompt + konvensi tata kelola yayasan
 * (Dewan Pembina = pemberi arah strategis; Dewan Pengawas = pengawas read-only).
 */
export const ROLE_DUTIES: Record<UserRole, string[]> = {
  SUPERADMIN: [
    'Infrastruktur & konfigurasi sistem, rilis serta migrasi basis data',
    'Delegasi awal hak kelola anggota kepada pimpinan',
  ],
  KETUA: [
    'Memimpin penyelenggaraan organisasi dan memutuskan kebijakan strategis',
    'Persetujuan tunggal (veto) pada Approval Board: SK, voucher kas, & program kerja',
    'Merilis SK resmi setelah diverifikasi Sekretaris dan Bendahara',
  ],
  SEKRETARIS: [
    'Mengelola surat masuk/keluar, draf SK, dan penomoran surat resmi',
    'Editor kop surat & stempel, verifikasi berkas persyaratan',
    'Mengarsipkan dokumen yang telah dirilis',
  ],
  BENDAHARA: [
    'Mengelola arus kas, input voucher, dan rekonsiliasi rekening BSI',
    'Menandatangani voucher kas sebelum diajukan ke Ketua',
    'Menyusun laporan keuangan bersetempel',
  ],
  PEMBINA: [
    'Memberikan arah, bimbingan strategis, dan masukan kebijakan kepada pengurus',
    'Mengawal visi, misi, dan program kerja jangka panjang yayasan',
    'Akses read-only atas seluruh dokumen dan laporan organisasi',
  ],
  PENGAWAS: [
    'Mengawasi jalannya kepengurusan dan kepatuhan terhadap ART/ADRT',
    'Memeriksa audit trail, buku kas, dan surat resmi (read-only)',
    'Mengusulkan sanksi/SP bila ditemukan pelanggaran kebijakan',
  ],
  KETUA_DIVISI: [
    'Memimpin divisi kerja dan mengajukan usulan program kerja & anggaran',
    'Mengunggah berkas pendukung (proposal, surat undangan, laporan)',
    'Berkoordinasi dengan Ketua untuk persetujuan & publikasi program',
  ],
  ANGGOTA_DIVISI: [
    'Menjalankan tugas harian divisi sesuai pembagian Ketua Divisi',
    'Mengunggah dokumen pendukung kegiatan divisi',
    'Melihat progres usulan program divisi sendiri',
  ],
  ANGGOTA_BIASA: [
    'Mengakses e-KTA 5 tahun dan memperbarui data keanggotaan',
    'Melihat jadwal kajian, maklumat resmi, dan feed informasi publik',
  ],
};

