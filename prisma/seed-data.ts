/**
 * Data seed demo (Fase D). Dipisahkan dari prisma/seed.ts agar mudah dibaca &
 * dirawat. Lihat prisma/seed.ts untuk logika penulisan ke database.
 *
 * Catatan: nama/nomor di sini adalah DATA CONTOH untuk keperluan demo — bukan
 * dokumen organisasi yang sesungguhnya.
 */

/** Kop surat default (harus identik dengan LettersService.createLetter). */
export const KOP_DEFAULT = {
  authority_text: 'DEWAN PIMPINAN WILAYAH JABODETABEK',
  sub_text: 'ASOSIASI PENGACARA PENGADAAN INDONESIA',
  address: 'DKI Jakarta, Jawa Barat, Banten',
  contact_info: 'sekretariat@apii.sigitadi.id',
};

export type DemoUser = {
  email: string;
  fullName: string;
  role: string;
  division?: string;
  memberNumber?: string;
};

export const JABATAN_SEED: DemoUser[] = [
  { email: 'si.sigitadi@gmail.com', fullName: 'Sigit Adi (Superadmin)', role: 'SUPERADMIN' },
  {
    email: 'ketua@apii-jabodetabek.or.id',
    fullName: 'Dr. H. Ahmad Fauzi, S.H., M.M.',
    role: 'KETUA',
  },
  {
    email: 'sekretaris@apii-jabodetabek.or.id',
    fullName: 'Muhammad Rizki, S.T., M.T.',
    role: 'SEKRETARIS',
  },
  {
    email: 'bendahara@apii-jabodetabek.or.id',
    fullName: 'Hj. Siti Aminah, S.E., M.Ak.',
    role: 'BENDAHARA',
  },
  {
    email: 'pembina@apii-jabodetabek.or.id',
    fullName: 'Prof. H. Ridwan Hakim, Lc., M.A.',
    role: 'PEMBINA',
  },
  {
    email: 'pengawas@apii-jabodetabek.or.id',
    fullName: 'H. Abdul Karim, S.H., M.Kn.',
    role: 'PENGAWAS',
  },
  {
    email: 'kadiv.humas@apii-jabodetabek.or.id',
    fullName: 'Ust. Ahmad Sahid, S.Sos.',
    role: 'KETUA_DIVISI',
    division: 'DIV_HUMAS',
  },
  {
    email: 'anggota.humas@apii-jabodetabek.or.id',
    fullName: 'Fatimah Az-Zahra, S.I.Kom.',
    role: 'ANGGOTA_DIVISI',
    division: 'DIV_HUMAS',
  },
  {
    email: 'anggota@apii-jabodetabek.or.id',
    fullName: 'Budi Santoso Pratama',
    role: 'ANGGOTA_BIASA',
    memberNumber: 'APII-JABO-0001',
  },
];

export type LetterSeed = {
  letterNumber: string;
  title: string;
  letterType: string;
  contentPayload: Record<string, unknown>;
  kopConfig: Record<string, unknown>;
  signatories: Array<Record<string, unknown>>;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';
  rejectionNote?: string;
  publishedAgo?: number;
  createdAgo: number;
};

export const SURAT_SEED: LetterSeed[] = [
  {
    letterNumber: '001/SK-DPW/APII-JABO/I/2026',
    title: 'SK Pengesahan Struktur Pengurus DPW APII Jabodetabek Periode 2026-2031',
    letterType: 'SK',
    contentPayload: {
      konsiderans: {
        Menimbang: [
          'Bahwa berdasarkan hasil Musyawarah Daerah ke-VIII, susunan kepengurusan DPW APII Jabodetabek perlu disahkan untuk periode 2026-2031.',
        ],
        Mengingat: [
          'Anggaran Dasar dan Rumah Tangga Asosiasi Pengacara Pengadaan Indonesia pasca-amandemen 2024.',
        ],
        Memutuskan: [
          'Menetapkan susunan kepengurusan DPW APII Wilayah Jabodetabek periode 2026-2031 sebagaimana tercantum dalam lampiran keputusan ini.',
        ],
      },
      bodyText:
        'Dengan ini ditetapkan susunan kepengurusan Dewan Pimpinan Wilayah Asosiasi Pengacara Pengadaan Indonesia (APII) Wilayah Jabodetabek untuk masa jabatan 2026-2031, hasil pemilihan langsung dalam Musyawarah Daerah ke-VIII yang diselenggarakan di Jakarta.',
      closingText:
        'Keputusan ini berlaku sejak tanggal ditetapkan, dengan ketentuan apabila di kemudian hari terdapat kekeliruan akan diadakan perbaikan sebagaimana mestinya.',
    },
    kopConfig: KOP_DEFAULT,
    signatories: [
      { roleTitle: 'Ketua DPW APII Jabodetabek', name: 'Dr. H. Ahmad Fauzi, S.H., M.M.', hasStamp: true },
      { roleTitle: 'Sekretaris DPW APII Jabodetabek', name: 'Muhammad Rizki, S.T., M.T.', hasStamp: false },
    ],
    status: 'PUBLISHED',
    publishedAgo: 20,
    createdAgo: 24,
  },
  {
    letterNumber: '002/MAK-DPW/APII-JABO/I/2026',
    title: 'Maklumat Kepatuhan Etika & Integritas Pengacara Pengadaan Wilayah Jabodetabek',
    letterType: 'MAKLUMAT',
    contentPayload: {
      konsiderans: {
        Menimbang: [
          'Bahwa integritas dan transparansi adalah nilai utama profesi pengacara pengadaan yang wajib dijunjung tinggi oleh setiap anggota.',
        ],
        Memutuskan: [
          'Setiap anggota APII DPW Jabodetabek dilarang menerima imbalan di luar ketentuan dalam urusan pengadaan barang/jasa yang ditanganinya.',
          'Pelanggaran terhadap maklumat ini akan diproses melalui mekanisme etik organisasi sesuai AD/ART.',
        ],
      },
      bodyText:
        'Dewan Pimpinan Wilayah APII Jabodetabek menyampaikan maklumat kepatuhan ini kepada seluruh anggota, mitra kerja, dan instansi pemerintah di wilayah Jabodetabek sebagai komitmen bersama mewujudkan tata kelola pengadaan yang bersih.',
      closingText:
        'Maklumat ini diumumkan secara terbuka dan berlaku untuk seluruh anggota DPW APII Jabodetabek.',
    },
    kopConfig: KOP_DEFAULT,
    signatories: [
      { roleTitle: 'Ketua DPW APII Jabodetabek', name: 'Dr. H. Ahmad Fauzi, S.H., M.M.', hasStamp: true },
    ],
    status: 'PUBLISHED',
    publishedAgo: 10,
    createdAgo: 13,
  },
  {
    letterNumber: '001/UND-DPW/APII-JABO/X/2026',
    title: 'Undangan Rapat Pleno Penyusunan Program Kerja & Anggaran Tahun 2027',
    letterType: 'UNDANGAN',
    contentPayload: {
      konsiderans: {
        Menimbang: [
          'Bahwa penyusunan program kerja dan anggaran tahun anggaran 2027 memerlukan persetujuan rapat pleno kepengurusan.',
        ],
      },
      bodyText:
        'Dengan hormat, kami mengundang seluruh pengurus DPW APII Jabodetabek untuk hadir dalam Rapat Pleno Penyusunan Program Kerja dan Anggaran Tahun 2027 yang akan diselenggarakan pada hari Sabtu, pukul 09.00 WIB, di Aula Graha APII Jabodetabek serta daring via Zoom.',
      closingText:
        'Kehadiran dan masukan dari Bapak/Ibu sangat kami harapkan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.',
    },
    kopConfig: KOP_DEFAULT,
    signatories: [
      { roleTitle: 'Sekretaris DPW APII Jabodetabek', name: 'Muhammad Rizki, S.T., M.T.', hasStamp: true },
    ],
    status: 'PENDING_APPROVAL',
    createdAgo: 2,
  },
  {
    letterNumber: '003/REK-DPW/APII-JABO/X/2026',
    title: 'Surat Rekomendasi Pendampingan Sertifikasi Kompetensi Pengadaan bagi Anggota',
    letterType: 'REKOMENDASI',
    contentPayload: {
      bodyText:
        'Berdasarkan kriteria seleksi internal, DPW APII Jabodetabek merekomendasikan anggota terpilih untuk mengikuti program pendampingan sertifikasi kompetensi bidang pengadaan barang/jasa yang diselenggarakan Lembaga Sertifikasi Profesi Pekerjaan Umum (LSPP) pada angkatan IV tahun 2026.',
      closingText:
        'Rekomendasi ini diberikan dengan mempertimbangkan rekam jejak keanggotaan dan komitmen pengembangan profesional.',
    },
    kopConfig: KOP_DEFAULT,
    signatories: [
      { roleTitle: 'Ketua Divisi Litbang', name: 'Ust. Ahmad Sahid, S.Sos.', hasStamp: false },
    ],
    status: 'DRAFT',
    createdAgo: 1,
  },
  {
    letterNumber: '002/ST-DPW/APII-JABO/IX/2026',
    title: 'Surat Tugas Delegasi Seminar Nasional Reformasi Pengadaan Publik',
    letterType: 'SURAT_TUGAS',
    contentPayload: {
      bodyText:
        'Menugaskan delegasi DPW APII Jabodetabek untuk menghadiri dan berpartisipasi dalam Seminar Nasional Reformasi Pengadaan Publik yang diselenggarakan oleh Kementerian PUPR di Jakarta Convention Center.',
      closingText:
        'Delegasi diharapkan menyusun laporan hasil kegiatan paling lambat 7 (tujuh) hari setelah acara berlangsung.',
    },
    kopConfig: KOP_DEFAULT,
    signatories: [
      { roleTitle: 'Ketua DPW APII Jabodetabek', name: 'Dr. H. Ahmad Fauzi, S.H., M.M.', hasStamp: true },
    ],
    status: 'REJECTED',
    rejectionNote:
      'Daftar delegasi belum dilengkapi surat pernyataan tugas dari instansi masing-masing. Mohon lengkapi lampiran lalu diajukan kembali.',
    createdAgo: 15,
  },
  {
    letterNumber: '001/SE-DPW/APII-JABO/XII/2025',
    title: 'Surat Edaran Pemberitahuan Jam Layanan Sekretariat DPW APII Jabodetabek',
    letterType: 'EDARAN',
    contentPayload: {
      bodyText:
        'Memberitahukan kepada seluruh anggota bahwa jam layanan sekretariat DPW APII Jabodetabek berlaku Senin-Jumat pukul 08.00-16.00 WIB. Di luar jam tersebut, layanan administrasi dilakukan melalui kanal daring resmi.',
      closingText: 'Demikian disampaikan untuk menjadi perhatian.',
    },
    kopConfig: KOP_DEFAULT,
    signatories: [
      { roleTitle: 'Sekretaris DPW APII Jabodetabek', name: 'Muhammad Rizki, S.T., M.T.', hasStamp: false },
    ],
    status: 'ARCHIVED',
    createdAgo: 290,
  },
];

export type VoucherSeed = {
  voucherNumber: string;
  type: 'INFLOW' | 'OUTFLOW';
  account: 'BSI_GIRO' | 'BRANKAS_KAS_KECIL' | 'MANDIRI_WAKAF';
  amount: number;
  description: string;
  status: 'PENDING' | 'VERIFIED_BENDAHARA' | 'VERIFIED_KETUM' | 'REJECTED';
  transactionAgo: number;
  rejectionNote?: string;
};

export const VOUCHER_SEED: VoucherSeed[] = [
  {
    voucherNumber: '001/KEU-APII/JABO/I/2026',
    type: 'INFLOW',
    account: 'BSI_GIRO',
    amount: 250_000_000,
    description: 'Transfer dana hibah program kerja tahunan dari DPW Pusat APII',
    status: 'VERIFIED_KETUM',
    transactionAgo: 120,
  },
  {
    voucherNumber: '002/KEU-APII/JABO/I/2026',
    type: 'INFLOW',
    account: 'MANDIRI_WAKAF',
    amount: 75_500_000,
    description: 'Wakaf produktif untuk modal usaha mikro anggota dari donatur tetap',
    status: 'VERIFIED_KETUM',
    transactionAgo: 60,
  },
  {
    voucherNumber: '003/KEU-APII/JABO/IX/2026',
    type: 'OUTFLOW',
    account: 'BRANKAS_KAS_KECIL',
    amount: 3_450_000,
    description: 'Pembelian alat tulis kantor & perlengkapan operasional sekretariat bulan ini',
    status: 'VERIFIED_KETUM',
    transactionAgo: 12,
  },
  {
    voucherNumber: '004/KEU-APII/JABO/X/2026',
    type: 'OUTFLOW',
    account: 'BSI_GIRO',
    amount: 18_900_000,
    description: 'Pembayaran sewa tempat & konsumsi Seminar Nasional Reformasi Pengadaan Publik',
    status: 'VERIFIED_BENDAHARA',
    transactionAgo: 5,
  },
  {
    voucherNumber: '005/KEU-APII/JABO/X/2026',
    type: 'OUTFLOW',
    account: 'BRANKAS_KAS_KECIL',
    amount: 1_250_000,
    description: 'Transportasi & parkir pengurus saat pendampingan audiensi instansi',
    status: 'PENDING',
    transactionAgo: 2,
  },
  {
    voucherNumber: '006/KEU-APII/JABO/X/2026',
    type: 'OUTFLOW',
    account: 'MANDIRI_WAKAF',
    amount: 9_800_000,
    description: 'Pembelian paket seminar kit untuk anggota peserta seminar nasional',
    status: 'REJECTED',
    rejectionNote:
      'Belum melampirkan bukti invoice resmi dari vendor. Mohon lengkapi kuitansi pajak.',
    transactionAgo: 8,
  },
];

export type SubmissionSeed = {
  trackingId: string;
  division: string;
  programTitle: string;
  budget: number;
  targetAudience: string;
  executionInDays: number | null;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED';
  submissionData?: Record<string, unknown>;
};

export const SUBMISSION_SEED: SubmissionSeed[] = [
  {
    trackingId: '#REQ-2026-001',
    division: 'DIV_DAKWAH',
    programTitle: 'Kajian Bulanan & Pembinaan Muallaf DPW APII Jabodetabek',
    budget: 12_000_000,
    targetAudience: 'Anggota & masyarakat umum wilayah Jabodetabek',
    executionInDays: 12,
    status: 'PUBLISHED',
    submissionData: {
      kategori: 'KAJIAN_RUTIN',
      deskripsi:
        'Kajian rutin membahas fikih muamalah & etika profesi pengadaan, diikuti pembinaan muallaf anggota baru.',
      lokasi: 'Aula Graha APII Jabodetabek / Hybrid Zoom',
      pemateri: 'Prof. H. Ridwan Hakim, Lc., M.A.',
    },
  },
  {
    trackingId: '#REQ-2026-002',
    division: 'DIV_LITBANG',
    programTitle: 'Workshop Sertifikasi Green Building & Smart Infrastructure',
    budget: 45_000_000,
    targetAudience: 'Anggota praktisi & konsultan pengadaan konstruksi',
    executionInDays: 19,
    status: 'PUBLISHED',
    submissionData: {
      kategori: 'PELATIHAN_VOKASI',
      deskripsi:
        'Pelatihan teknis rekayasa infrastruktur ramah lingkungan bersama narasumber praktisi dan akademisi.',
      lokasi: 'Hotel Bidakara Jakarta',
      pemateri: 'Tim Praktisi Green Building Council Indonesia',
    },
  },
  {
    trackingId: '#REQ-2026-003',
    division: 'DIV_HUMAS',
    programTitle: 'Bakti Sosial Donor Darah & Sembako untuk Keluarga Anggota',
    budget: 8_500_000,
    targetAudience: 'Keluarga anggota & warga sekitar sekretariat',
    executionInDays: 26,
    status: 'PUBLISHED',
    submissionData: {
      kategori: 'BAKTI_SOSIAL',
      deskripsi:
        'Kegiatan kepedulian sosial berupa donor darah bersama PMI dan pembagian sembako bagi keluarga anggota yang membutuhkan.',
      lokasi: 'Sekretariat DPW APII Jabodetabek',
      mitra: 'PMI Cabang Jakarta Selatan',
    },
  },
  {
    trackingId: '#REQ-2026-004',
    division: 'DIV_SOSMED',
    programTitle: 'Kampanye Literasi Pengadaan Digital via Media Sosial DPW',
    budget: 15_000_000,
    targetAudience: 'Pengikut akun media sosial resmi DPW APII Jabodetabek',
    executionInDays: null,
    status: 'PENDING_APPROVAL',
    submissionData: {
      kategori: 'KONTEN_DAKWAH',
      deskripsi:
        'Serial konten edukasi mingguan tentang prosedur pengadaan publik dan hak-hak peserta lelang.',
    },
  },
  {
    trackingId: '#REQ-2026-005',
    division: 'DIV_HUMAS',
    programTitle: 'Podcast Dialog Profesional: Dinamika Pengacara Pengadaan',
    budget: 22_000_000,
    targetAudience: 'Profesi hukum & pengadaan tingkat nasional',
    executionInDays: null,
    status: 'APPROVED',
    submissionData: {
      kategori: 'LAINNYA',
      deskripsi:
        'Produksi episode podcast per bulan mengangkat isu hukum pengadaan dengan tamu praktisi senior.',
    },
  },
  {
    trackingId: '#REQ-2026-006',
    division: 'DIV_HUKUM',
    programTitle: 'Klinik Konsultasi Hukum Pengadaan Gratis untuk Anggota',
    budget: 6_000_000,
    targetAudience: 'Anggota yang sedang menangani sengketa pengadaan',
    executionInDays: null,
    status: 'DRAFT',
    submissionData: {
      kategori: 'ADVOKASI_HUKUM',
      deskripsi:
        'Jadwal konsultasi mingguan bersama tim advokat DPW untuk mendampingi anggota dalam sengketa pengadaan.',
    },
  },
];


export type IncomingLetterSeed = {
  agendaNumber: string;
  source: string;
  letterNumber: string;
  subject: string;
  receivedAgo: number;
  status: 'RECEIVED' | 'DISPOSITION_PENDING' | 'DISPOSED' | 'ARCHIVED';
  dispositionNote?: string;
  dispositionTarget?: string;
};

export const SURAT_MASUK_SEED: IncomingLetterSeed[] = [
  {
    agendaNumber: 'AGD-2026-001',
    source: 'Kementerian Pekerjaan Umum dan Perumahan Rakyat',
    letterNumber: '045/PUPR/HK/2026',
    subject: 'Undangan Koordinasi Reformasi Sistem Pengadaan Publik Nasional',
    receivedAgo: 3,
    status: 'DISPOSED',
    dispositionNote: 'Follow up undangan; tugaskan delegasi & siapkan bahan paparan DPW.',
    dispositionTarget: 'DIV_HUMAS',
  },
  {
    agendaNumber: 'AGD-2026-002',
    source: 'Lembaga Sertifikasi Profesi Pekerjaan Umum (LSPP)',
    letterNumber: 'LSPP/88/IX/2026',
    subject: 'Pendaftaran Angkatan IV Sertifikasi Kompetensi Pengadaan Barang/Jasa',
    receivedAgo: 6,
    status: 'DISPOSITION_PENDING',
  },
  {
    agendaNumber: 'AGD-2026-003',
    source: 'Pengadilan Negeri Jakarta Selatan',
    letterNumber: 'PN-JS/2310/2026',
    subject: 'Panggilan Sidang Informasi Perkara Sengketa Pengadaan Anggota DPW',
    receivedAgo: 1,
    status: 'RECEIVED',
  },
  {
    agendaNumber: 'AGD-2025-098',
    source: 'Kamar Dagang dan Industri Jakarta',
    letterNumber: 'KADIN-JKT/540/2025',
    subject: 'Undangan Focus Group Discussion Tata Niaga Usaha Anggota',
    receivedAgo: 180,
    status: 'ARCHIVED',
  },
];

export type AuditEventSeed = {
  action: string;
  actorRole: 'PENGAWAS' | 'ANGGOTA_DIVISI';
  resource: string;
  metadata: Record<string, unknown>;
  ago: number;
};

export const AUDIT_SEED: AuditEventSeed[] = [
  {
    action: 'CROSS_DIVISION_DENIED',
    actorRole: 'ANGGOTA_DIVISI',
    resource: '/api/v1/divisions/submissions?division=DIV_LITBANG',
    metadata: {
      reason: 'Anggota Divisi Humas mencoba membuka usulan Litbang di luar divisinya',
    },
    ago: 1,
  },
  {
    action: 'LETTER_REJECTED',
    actorRole: 'PENGAWAS',
    resource: '/api/v1/official-letters',
    metadata: {
      letterNumber: '002/ST-DPW/APII-JABO/IX/2026',
      rejectionNote: 'Lampiran belum lengkap',
    },
    ago: 15,
  },
  {
    action: 'CASH_FLOW_VERIFIED_KETUM',
    actorRole: 'PENGAWAS',
    resource: '/api/v1/finance/vouchers',
    metadata: { voucherNumber: '003/KEU-APII/JABO/IX/2026', amount: 3450000 },
    ago: 12,
  },
  {
    action: 'LETTER_PUBLISHED',
    actorRole: 'PENGAWAS',
    resource: '/api/v1/official-letters',
    metadata: {
      letterNumber: '002/MAK-DPW/APII-JABO/I/2026',
      title: 'Maklumat Kepatuhan Etika & Integritas Pengacara Pengadaan',
    },
    ago: 10,
  },
];

