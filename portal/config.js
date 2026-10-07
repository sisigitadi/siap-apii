/**
 * config.js — Konfigurasi frontend portal pengurus (siapii.sigitadi.id)
 * ============================================================================
 * Ganti API_BASE dengan URL Web App Apps Script Anda setelah deploy.
 * Format: https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
 *
 * Catatan: backend yang sama dipakai oleh portal publik & portal pengurus.
 */
window.API_BASE = 'https://script.google.com/macros/s/AKfycbzxV1_uYfNJdgDeWLHgfoGs6MNj41In9jpOlYuDqRH2SiVfq4CbhYTk2DIOPEkrO6NJdg/exec';

// Domain portal publik (dipakai untuk link "Kembali ke situs publik").
window.PUBLIC_URL = 'https://apii.sigitadi.id';
window.PORTAL_URL = 'https://siapii.sigitadi.id';

// Nama aplikasi (dipakai di sidebar & judul halaman).
window.APP_NAME = 'SIAPII';
window.APP_FULL = 'Sistem Informasi & Administrasi APII DPW Jabodetabek';

// 7 divisi kerja: kode = value backend DIVISIONS, label = DIVISION_LABELS.
window.DIVISIONS = {
  DIV_HUMAS: 'Hubungan Masyarakat', DIV_LITBANG: 'Penelitian & Pengembangan',
  DIV_SOSMED: 'Media Sosial', DIV_DAKWAH: 'Dakwah', DIV_INVESTASI: 'Investasi',
  DIV_HUKUM: 'Hukum', DIV_UMUM: 'Umum'
};

// Akun kas (harus sama dengan backend ACCOUNT_LABELS).
window.ACCOUNTS = { KAS_BSI: 'Kas BSI', BRANKAS: 'Brankas', MANDIRI_WAKAF: 'Bank Mandiri Wakaf' };

// Peran (harus sama dengan backend ROLES/ROLE_LABELS - 8 peran pengurus).
window.ROLES = {
  SUPERADMIN: 'Administrator Sistem', KETUA: 'Ketua', SEKRETARIS: 'Sekretaris',
  BENDAHARA: 'Bendahara', PEMBINA: 'Pembina', PENGAWAS: 'Pengawas',
  KETUA_DIVISI: 'Ketua Divisi', ANGGOTA_DIVISI: 'Anggota Divisi'
};

// Peran read-only: frontend menyembunyikan tombol aksi (backend juga menolak).
window.READONLY_ROLES = ['PEMBINA', 'PENGAWAS'];

// Jenis surat bawaan (diperluas dinamis oleh backend Sheet_Settings).
window.LETTER_TYPES = {
  SK: 'Surat Keputusan', UNDANGAN: 'Surat Undangan',
  PENGANTAR: 'Surat Pengantar', KETERANGAN: 'Surat Keterangan',
  TUGAS: 'Surat Tugas', REKOMENDASI: 'Surat Rekomendasi', EDARAN: 'Surat Edaran',
  NOTULEN: 'Notulen Rapat', RAPAT: 'Hasil Rapat / Risalah Rapat', BA: 'Berita Acara'
};

// Status surat (harus sama dengan backend STATUS_LABELS).
window.STATUS_LABELS = {
  DRAFT: 'Draf', PENDING_APPROVAL: 'Menunggu Persetujuan',
  PUBLISHED: 'Diterbitkan', REJECTED: 'Ditolak',
  PENDING: 'Menunggu Verifikasi', VERIFIED_BY_BENDAHARA: 'Diverifikasi Bendahara',
  VERIFIED_BY_KETUM: 'Diverifikasi Ketua', APPROVED: 'Disetujui',
  AJUKAN: 'Diajukan', DISETUJUI: 'Disetujui', DITOLAK: 'Ditolak',
  PELAKSANAAN: 'Pelaksanaan', LPJ_SELESAI: 'LPJ Selesai',
  DIVERIFIKASI_SEKRETARIS: 'Diverifikasi Sekretaris'
};

// 8 Akun demo pengurus resmi (password: apii2026).
window.DEMO_ACCOUNTS = [
  { u: 'superadmin', r: 'Administrator Sistem' }, { u: 'ketua', r: 'Ketua' },
  { u: 'sekretaris', r: 'Sekretaris' }, { u: 'bendahara', r: 'Bendahara' },
  { u: 'pembina', r: 'Pembina' }, { u: 'pengawas', r: 'Pengawas' },
  { u: 'khumas', r: 'Ketua Divisi Humas' }, { u: 'ahumas', r: 'Anggota Divisi Humas' }
];
