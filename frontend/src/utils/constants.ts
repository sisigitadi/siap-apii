import { Division, LetterStatus, LetterType, UserRole, VoucherStatus, SubmissionStatus, CashCategory, CashAccount } from '@/api/types';

export const APP_NAME = 'SIAP APII';
export const ORG_NAME = 'Asosiasi Pengembang Infrastruktur Indonesia';
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
  SUPERADMIN: 'Super Administrator',
  KETUA_UMUM: 'Ketua DPW',
  SEKRETARIS: 'Sekretaris Wilayah',
  BENDAHARA: 'Bendahara Wilayah',
  DEWAN_PENGAWAS: 'Dewan Pengawas',
  KADIV_HUMAS: 'Ketua Divisi Humas',
  ANGGOTA_HUMAS: 'Anggota Divisi Humas',
  KADIV_SOSMED: 'Ketua Divisi Medsos',
  ANGGOTA_SOSMED: 'Anggota Divisi Medsos',
  KADIV_DAKWAH: 'Ketua Divisi Dakwah',
  ANGGOTA_DAKWAH: 'Anggota Divisi Dakwah',
  KADIV_LITBANG: 'Ketua Divisi Litbang',
  ANGGOTA_LITBANG: 'Anggota Divisi Litbang',
  KADIV_INVESTASI: 'Ketua Divisi Investasi',
  ANGGOTA_INVESTASI: 'Anggota Divisi Investasi',
  KADIV_HUKUM: 'Ketua Divisi Hukum',
  ANGGOTA_HUKUM: 'Anggota Divisi Hukum',
  KADIV_UMUM: 'Ketua Divisi Umum',
  ANGGOTA_UMUM: 'Anggota Divisi Umum',
  PUBLIK_ANGGOTA: 'Anggota Terdaftar',
};

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

export const LEADERSHIP_ROLES: UserRole[] = ['SUPERADMIN', 'KETUA_UMUM', 'SEKRETARIS', 'BENDAHARA', 'DEWAN_PENGAWAS'];
