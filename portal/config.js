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

// 4 divisi kerja resmi DPW APII Jabodetabek
window.DIVISIONS = {
  DIV_DAKWAH: 'Dakwah & Pendidikan',
  DIV_HUMAS: 'Humas',
  DIV_SOSMED: 'Sosial Media',
  DIV_INVESTASI: 'Pengembangan & Investasi Bisnis'
};

// Akun kas (harus sama dengan backend ACCOUNT_LABELS).
window.ACCOUNTS = { KAS_BSI: 'Kas BSI', BRANKAS: 'Brankas', MANDIRI_WAKAF: 'Bank Mandiri Wakaf' };

// Peran (harus sama dengan backend ROLES/ROLE_LABELS - 8 peran pengurus).
window.ROLES = {
  SUPERADMIN: 'Administrator Sistem', KETUA: 'Ketua Umum', SEKRETARIS: 'Sekretaris Umum',
  BENDAHARA: 'Bendahara Umum', PEMBINA: 'Pembina', PENGAWAS: 'Pengawas',
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

// 12 Akun Pengurus Resmi untuk Mode Demo Simulasi:
// (Pengurus Harian, Superadmin, & 4 Divisi Kerja sesuai SK Kepengurusan DPW APII)
window.DEMO_ACCOUNTS = [
  // 1. Administrator Sistem (Akses Penuh)
  { u: 'superadmin', r: 'Administrator Sistem', name: 'Administrator Sistem', desc: 'Administrator Sistem · Akses Penuh Sistem & Pengaturan' },

  // 2. Pengurus Harian
  { u: 'ketua', r: 'Ketua Umum', name: 'Ustadz Muhammad Hanafi', desc: 'Ustadz Muhammad Hanafi · Persetujuan Surat & Otorisasi Pengeluaran Kas' },
  { u: 'sekretaris', r: 'Sekretaris Umum', name: 'Sigit Adi Irianto', desc: 'Sigit Adi Irianto · Konseptor Naskah Surat & Verifikasi Berkas' },
  { u: 'bendahara', r: 'Bendahara Umum', name: 'Sri Wati', desc: 'Sri Wati · Pembukuan Kas, Verifikasi & Pencetakan Kuitansi' },

  // 3. Divisi Dakwah & Pendidikan
  { u: 'kdakwah', r: 'Ketua Divisi Dakwah & Pendidikan', name: 'Ahmad Daman Huri', desc: 'Ahmad Daman Huri · Program Kajian, Dakwah & Kurikulum' },
  { u: 'adakwah', r: 'Anggota Divisi Dakwah & Pendidikan', name: 'Jaelani', desc: 'Jaelani · Pelaksana Teknis Dakwah & Edukasi Lapangan' },

  // 4. Divisi Humas
  { u: 'khumas', r: 'Ketua Divisi Humas', name: 'Federico Fachrudin', desc: 'Federico Fachrudin · Kemitraan Ormas & Komunikasi Eksternal' },
  { u: 'ahumas', r: 'Anggota Divisi Humas', name: 'Kartinah', desc: 'Kartinah · Hubungan Antar Lembaga & Dokumentasi Kegiatan' },

  // 5. Divisi Sosial Media
  { u: 'ksosmed', r: 'Ketua Divisi Sosial Media', name: 'Sri Maryati', desc: 'Sri Maryati · Publikasi Digital, Konten Kreatif & Medsos' },
  { u: 'asosmed', r: 'Anggota Divisi Sosial Media', name: 'Robert Albertus', desc: 'Robert Albertus · Desain Grafis, Video Editor & Distribusi Konten' },

  // 6. Divisi Pengembangan dan Investasi Bisnis
  { u: 'kbisnis', r: 'Ketua Divisi Pengembangan & Bisnis', name: 'Novizal Andriyanto', desc: 'Novizal Andriyanto · Inkubasi Bisnis, Kemitraan & Wakaf Produktif' },
  { u: 'abisnis', r: 'Anggota Divisi Pengembangan & Bisnis', name: 'Juli Nasution Guci', desc: 'Juli Nasution Guci · Analisis Kelayakan Investasi & Operasional' }
];

// ============================================================================
// KONFIGURASI GOOGLE / GMAIL LOGIN (Dipersiapkan untuk Production)
// ============================================================================
window.GOOGLE_AUTH_CONFIG = {
  enabled: false,
  clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
  allowedDomains: ['gmail.com', 'apii-jabo.or.id', 'apii.sigitadi.id'],
  buttonText: 'Masuk dengan Akun Google (Gmail)'
};

// Profil lengkap pengguna demo untuk simulasi cepat tanpa ketergantungan email / server luar
window.DEMO_USER_PROFILES = {
  superadmin: {
    username: 'superadmin',
    full_name: 'Administrator Sistem',
    role: 'SUPERADMIN',
    role_label: 'Administrator Sistem',
    division: null,
    division_label: null,
    email: 'admin@apii-jabo.or.id',
    phone: '0812-9988-7711',
    can_manage_users: true,
    is_demo: true,
    is_demo_mode: true
  },
  ketua: {
    username: 'ketua',
    full_name: 'Ustadz Muhammad Hanafi',
    role: 'KETUA',
    role_label: 'Ketua Umum',
    division: null,
    division_label: null,
    email: 'ketua@apii-jabo.or.id',
    phone: '0812-9988-7722',
    is_demo: true,
    is_demo_mode: true
  },
  sekretaris: {
    username: 'sekretaris',
    full_name: 'Sigit Adi Irianto',
    role: 'SEKRETARIS',
    role_label: 'Sekretaris Umum',
    division: null,
    division_label: null,
    email: 'sekretaris@apii-jabo.or.id',
    phone: '0812-9988-7733',
    is_demo: true,
    is_demo_mode: true
  },
  bendahara: {
    username: 'bendahara',
    full_name: 'Sri Wati',
    role: 'BENDAHARA',
    role_label: 'Bendahara Umum',
    division: null,
    division_label: null,
    email: 'bendahara@apii-jabo.or.id',
    phone: '0812-9988-7744',
    is_demo: true,
    is_demo_mode: true
  },
  kdakwah: {
    username: 'kdakwah',
    full_name: 'Ahmad Daman Huri',
    role: 'KETUA_DIVISI',
    role_label: 'Ketua Divisi',
    division: 'DIV_DAKWAH',
    division_label: 'Dakwah & Pendidikan',
    email: 'dakwah@apii-jabo.or.id',
    phone: '0812-9988-7751',
    is_demo: true,
    is_demo_mode: true
  },
  adakwah: {
    username: 'adakwah',
    full_name: 'Jaelani',
    role: 'ANGGOTA_DIVISI',
    role_label: 'Anggota Divisi',
    division: 'DIV_DAKWAH',
    division_label: 'Dakwah & Pendidikan',
    email: 'jaelani.dakwah@apii-jabo.or.id',
    phone: '0812-9988-7752',
    is_demo: true,
    is_demo_mode: true
  },
  khumas: {
    username: 'khumas',
    full_name: 'Federico Fachrudin',
    role: 'KETUA_DIVISI',
    role_label: 'Ketua Divisi',
    division: 'DIV_HUMAS',
    division_label: 'Humas',
    email: 'humas@apii-jabo.or.id',
    phone: '0812-9988-7777',
    is_demo: true,
    is_demo_mode: true
  },
  ahumas: {
    username: 'ahumas',
    full_name: 'Kartinah',
    role: 'ANGGOTA_DIVISI',
    role_label: 'Anggota Divisi',
    division: 'DIV_HUMAS',
    division_label: 'Humas',
    email: 'kartinah.humas@apii-jabo.or.id',
    phone: '0812-9988-7788',
    is_demo: true,
    is_demo_mode: true
  },
  ksosmed: {
    username: 'ksosmed',
    full_name: 'Sri Maryati',
    role: 'KETUA_DIVISI',
    role_label: 'Ketua Divisi',
    division: 'DIV_SOSMED',
    division_label: 'Sosial Media',
    email: 'sosmed@apii-jabo.or.id',
    phone: '0812-9988-7761',
    is_demo: true,
    is_demo_mode: true
  },
  asosmed: {
    username: 'asosmed',
    full_name: 'Robert Albertus',
    role: 'ANGGOTA_DIVISI',
    role_label: 'Anggota Divisi',
    division: 'DIV_SOSMED',
    division_label: 'Sosial Media',
    email: 'robert.sosmed@apii-jabo.or.id',
    phone: '0812-9988-7762',
    is_demo: true,
    is_demo_mode: true
  },
  kbisnis: {
    username: 'kbisnis',
    full_name: 'Novizal Andriyanto',
    role: 'KETUA_DIVISI',
    role_label: 'Ketua Divisi',
    division: 'DIV_INVESTASI',
    division_label: 'Pengembangan & Investasi Bisnis',
    email: 'bisnis@apii-jabo.or.id',
    phone: '0812-9988-7791',
    is_demo: true,
    is_demo_mode: true
  },
  abisnis: {
    username: 'abisnis',
    full_name: 'Juli Nasution Guci',
    role: 'ANGGOTA_DIVISI',
    role_label: 'Anggota Divisi',
    division: 'DIV_INVESTASI',
    division_label: 'Pengembangan & Investasi Bisnis',
    email: 'juli.bisnis@apii-jabo.or.id',
    phone: '0812-9988-7792',
    is_demo: true,
    is_demo_mode: true
  }
};

