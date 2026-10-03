import { Division, LetterStatus, LetterType, UserRole, VoucherStatus, SubmissionStatus, CashCategory, CashAccount } from '@/api/types';

export const APP_NAME = 'SIAP APII';
export const ORG_NAME = 'Yayasan Apologet Islam Indonesia';
export const ORG_SHORT_NAME = 'APII';
export const DPW_NAME = 'DPW Jabodetabek';

export const DIVISION_LABELS: Record<Division, string> = {
  DIV_HUMAS: 'Humas & Antar Lembaga',
  DIV_SOSMED: 'Media Sosial & Konten Kreatif',
  DIV_DAKWAH: 'Dakwah & Pembinaan Mualaf',
  DIV_LITBANG: 'Penelitian & Pengembangan (Litbang)',
  DIV_INVESTASI: 'Investasi & Pemberdayaan Ekonomi',
  DIV_HUKUM: 'Advokasi & Bantuan Hukum',
  DIV_UMUM: 'Sarana, Prasarana & Logistik',
};

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
 * Catatan: ART APII (Dokumen Sumber/3.) adalah dokumen pindaan yang teksnya
 * tidak bisa diekstrak secara mesin, sehingga uraian di bawah dirangkum dari
 * DESIGN.md §5.1 + master prompt + konvensi tata kelola yayasan.
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

/** Peran pengurus inti (lintas divisi) — dipakai sidebar & proteksi rute */
export const LEADERSHIP_ROLES: UserRole[] = [
  'SUPERADMIN',
  'KETUA',
  'SEKRETARIS',
  'BENDAHARA',
  'PEMBINA',
  'PENGAWAS',
];

/** Peran pengurus divisi — wajib punya divisi */
export const DIVISION_ROLES: UserRole[] = ['KETUA_DIVISI', 'ANGGOTA_DIVISI'];

/** Peran yang hanya boleh melihat (read-only) — tidak ada tombol mutasi */
export const READONLY_ROLES: UserRole[] = ['PEMBINA', 'PENGAWAS', 'ANGGOTA_BIASA'];

/** Jabatan organisasi (8) — SUPERADMIN dikeluarkan karena ia peran infrastruktur */
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

export const LETTER_TYPE_LABELS: Record<LetterType, string> = {
  SURAT_KEPUTUSAN: 'Surat Keputusan (SK)',
  SURAT_TUGAS: 'Surat Tugas (ST)',
  SURAT_KETERANGAN: 'Surat Keterangan (SKet)',
  SURAT_UNDANGAN: 'Surat Undangan (SU)',
  SURAT_PERMOHONAN: 'Surat Permohonan (SP)',
  SURAT_PEMBERITAHUAN: 'Surat Pemberitahuan',
  SURAT_REKOMENDASI: 'Surat Rekomendasi',
  BERITA_ACARA: 'Berita Acara (BA)',
  MEMORANDUM: 'Memorandum',
  LAINNYA: 'Surat Lainnya',
};

export const STATUS_BADGES: Record<LetterStatus | SubmissionStatus | VoucherStatus, { label: string; color: string; bg: string; border: string }> = {
  DRAFT: { label: 'Draf', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-300' },
  PENDING_APPROVAL: { label: 'Menunggu Persetujuan', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300' },
  PENDING_BENDAHARA: { label: 'Verifikasi Bendahara', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300' },
  PENDING_KETUA: { label: 'Verifikasi Ketua DPW', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300' },
  APPROVED: { label: 'Disetujui', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300' },
  PUBLISHED: { label: 'Rilis Resmi', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-300' },
  REJECTED: { label: 'Ditolak / Perlu Revisi', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-300' },
  ARCHIVED: { label: 'Diarsipkan', color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-300' },
};

export const CASH_CATEGORIES: Record<CashCategory, string> = {
  INFAQ_SEDEKAH: 'Infaq & Sedekah',
  WAKAF: 'Wakaf',
  SPONSORSHIP: 'Sponsorship & Donatur',
  IURAN_ANGGOTA: 'Iuran Anggota',
  OPERASIONAL: 'Operasional Sekretariat',
  PROGRAM_KERJA: 'Eksekusi Program Kerja',
  BANTUAN_SOSIAL: 'Bantuan Sosial & Santunan',
  HONORARIUM: 'Honorarium Narasumber/Ustadz',
  PENGADAAN_ASET: 'Pengadaan Sarana & Aset',
  LAIN_LAIN: 'Lain-lain',
};

export const CASH_ACCOUNTS: Record<CashAccount, string> = {
  BSI_OPERASIONAL: 'BSI (Bank Syariah Indonesia) - Operasional',
  BCA_PROGRAM: 'BCA - Program & Donasi',
  KAS_TUNAI_SEKRETARIAT: 'Kas Tunai / Brankas Sekretariat',
};
