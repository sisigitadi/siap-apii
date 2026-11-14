/**
 * SIAP APII Enterprise v3.0.0
 * Configuration & Environment Settings
 * Yayasan Apologet Islam Indonesia (SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023)
 * Pengembang: Sigit Adi Irianto (https://wa.me/6281358575678 | sigitadi.id)
 */

const CONFIG = {
  VERSION: '3.0.0 Enterprise',
  APP_TITLE: 'SIAP APII Enterprise',
  LEGAL_NAME: 'Yayasan Apologet Islam Indonesia',
  LEGAL_SK: 'AHU-0014970.AH.01.04.Tahun 2023',
  DEV_CREDIT: 'Sigit Adi Irianto (Freelance Software Engineer) | https://wa.me/6281358575678 | sigitadi.id',
  LOGO_URL: './logo_apii.png',

  // Shared LocalStorage Key antara Portal Pengurus (/portal) dan Portal Publik (/public)
  SHARED_STORAGE_KEY: 'siap_apii_shared_db_v3',

  // URL Deployment Google Apps Script Web App (otomatis deteksi /api di localhost atau /exec)
  API_URL: (function detectApiUrl() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const override = window.localStorage.getItem('siap_apii_api_url');
        if (override && override.trim()) return override.trim();
      }
      if (typeof window !== 'undefined' && window.location) {
        const host = String(window.location.hostname || '').toLowerCase();
        const href = String(window.location.href || '').split('?')[0].split('#')[0];
        if (/\/exec$/i.test(href)) return href;
        if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return '/api';
      }
    } catch (e) {}
    return '';
  })(),
  AUTO_DEMO_MODE: true,

  DEFAULT_TENANT: 'DPP_PUSAT',

  TENANTS: [
    { code: 'DPP_PUSAT', name: 'DPP Pusat (Nasional)', slug: 'pusat', level: 'DPP', phone: '6281358575678', city: 'Jakarta Pusat', address: 'Gedung Pusat Dakwah APII, Jl. Kramat Raya No. 45, Senen, Jakarta Pusat 10450' },
    { code: 'DPW_JABO', name: 'DPW Jabodetabek', slug: 'jabodetabek', level: 'DPW', phone: '6281234567891', city: 'Jakarta Selatan', address: 'Graha Dakwah DPW Jabodetabek, Jl. TB Simatupang No. 18, Jakarta Selatan 12560' }
  ],

  // 8 Peran RBAC Baku Sesuai PRD Bab 2.2 & Segregation of Duties (SoD)
  ROLES: {
    superadmin: {
      id: 'superadmin',
      label: 'Superadmin Nasional',
      category: 'Administrator Utama',
      permissions: ['*'],
      allowedWorkspaces: ['dashboard', 'surat', 'disposisi', 'kas', 'proker', 'keanggotaan', 'advokasi', 'muallaf', 'maktabah', 'sistem'],
      desc: 'Otoritas mutlak sistem, IAM, reset sandi, registrasi DPW baru, dan audit log forensik.'
    },
    ketua: {
      id: 'ketua',
      label: 'Ketua Umum (DPP) / Ketua DPW',
      category: 'Pimpinan Eksekutif',
      permissions: ['surat:approve', 'surat:reject', 'kas:approve_dual', 'kta:approve', 'disposisi:instruct', 'proker:approve', 'report:view_all', 'risalah:paraf'],
      allowedWorkspaces: ['dashboard', 'surat', 'disposisi', 'kas', 'proker', 'keanggotaan'],
      desc: 'Fokus Otorisasi Pimpinan Eksekutif: pengesahan surat dinas berstempel basah, 5 instruksi baku disposisi, dual-approval kas keluar (Tahap 2), persetujuan pagu RAB proker divisi, dan pengesahan KTA (Tahap 2). (Bebas dari form penyusunan sekretaris, pembukuan bendahara, dan operasional harian divisi).'
    },
    sekretaris: {
      id: 'sekretaris',
      label: 'Sekretaris Umum / Sekretaris DPW',
      category: 'Pimpinan Kesekretariatan',
      permissions: ['surat:compose', 'surat:revisi', 'sk:generate', 'surat_masuk:manage', 'disposisi:recommend', 'kta:verify', 'arsip:manage', 'cms:write', 'risalah:compose'],
      allowedWorkspaces: ['dashboard', 'surat', 'disposisi', 'keanggotaan', 'maktabah'],
      desc: 'Penyusun draft naskah A4, generator SK 1-klik, pencatatan surat masuk, telaah draf rekomendasi disposisi, dan verifikasi KTA Tahap 1. (STRICT: Diluar wewenang Kas Syar\'i & Pengaturan Sistem).'
    },
    bendahara: {
      id: 'bendahara',
      label: 'Bendahara Umum / Bendahara DPW',
      category: 'Pimpinan Keuangan',
      permissions: ['kas:record_bkm', 'kas:submit_bkk', 'kas:verify_dual', 'kwitansi:issue', 'keuangan:closing', 'lpj:audit', 'simulator:run', 'proker:view'],
      allowedWorkspaces: ['dashboard', 'kas', 'maktabah'],
      desc: 'Pencatatan kas masuk (BKM), pengajuan kas keluar (BKK), verifikasi kas Tahap 1, kwitansi dual-slip, cash buffer Rp 2M, dan auto-closing PSAK 409. (STRICT: Diluar wewenang Persuratan, Disposisi, Keanggotaan & Pengaturan Sistem).'
    },
    pembina: {
      id: 'pembina',
      label: 'Dewan Pembina (Executive Read-Only)',
      category: 'Dewan Pimpinan Tinggi',
      permissions: ['report:view_macro', 'policy:review', 'dashboard:inspect'],
      allowedWorkspaces: ['dashboard', 'kas', 'proker', 'keanggotaan', 'advokasi', 'maktabah'],
      desc: 'Mode Read-Only eksekutif makro, pemantauan tren dakwah nasional, dan tinjauan maklumat yayasan. (Tanpa mutasi data).'
    },
    pengawas: {
      id: 'pengawas',
      label: 'Dewan Pengawas (Forensic Audit Read-Only)',
      category: 'Dewan Pengawas Independen',
      permissions: ['audit:view_forensic', 'kas:inspect_receipts', 'surat:inspect', 'log:read_all', 'psak409:audit'],
      allowedWorkspaces: ['dashboard', 'surat', 'kas', 'proker', 'maktabah', 'sistem'],
      desc: 'Mode Forensic Audit Read-Only, inspektur audit log, bukti nota kwitansi, dan rekonsiliasi bulanan PSAK 409. (Tanpa mutasi data).'
    },
    ketua_divisi: {
      id: 'ketua_divisi',
      label: 'Ketua Divisi (7 Divisi ART Ps 16)',
      category: 'Pelaksana Program Divisi',
      permissions: ['proker:compose', 'dana:request', 'lpj:submit', 'disposisi:report', 'aset:loan', 'advokasi:manage', 'muallaf:manage'],
      allowedWorkspaces: ['dashboard', 'proker', 'disposisi', 'maktabah'],
      desc: 'Pengusulan proposal proker divisi, pengajuan pencairan dana bertahap, pelaporan LPJ & tindak lanjut disposisi. (Modul Advokasi / Muallaf aktif otomatis sesuai divisi).'
    },
    anggota_divisi: {
      id: 'anggota_divisi',
      label: 'Kader & Da\'i Lapangan',
      category: 'Kader & Anggota Aktif',
      permissions: ['profile:view', 'kta:download', 'maktabah:access', 'presensi:scan'],
      allowedWorkspaces: ['dashboard', 'keanggotaan', 'maktabah'],
      desc: 'Akses Maktabah Dalil Apologetika, unduh KTA digital CR80 2-sisi (Lisensi Da\'i 1/2/3), dan presensi acara kajian. (Modul Muallaf aktif otomatis bagi Divisi Dakwah).'
    }
  },

  // 7 Divisi Operasional Resmi Sesuai ART Yayasan APII Pasal 16
  DIVISIONS: [
    {
      code: 'humas',
      name: 'Divisi Humas',
      label: '1. Divisi Humas (Hubungan Masyarakat & Antar-Lembaga)',
      head: 'Ilham Kurniawan, S.I.Kom.',
      phone: '6281234567801',
      icon: 'campaign',
      color: '#0284c7',
      tupoksi: 'Komunikasi eksternal, hubungan antar-lembaga keislaman & ormas, siaran pers, dan kemitraan strategis.'
    },
    {
      code: 'litbang',
      name: 'Divisi Litbang',
      label: '2. Divisi Litbang (Penelitian & Pengembangan Teologi)',
      head: 'Ust. Dani Ramadhan, M.Ag.',
      phone: '6281234567802',
      icon: 'menu_book',
      color: '#0d9488',
      tupoksi: 'Riset manuskrip kuno, kajian teologi komparatif perbandingan agama, pengkajian syubhat, dan kurasi Maktabah Apologetika.'
    },
    {
      code: 'sosmed',
      name: 'Divisi Sosmed & Digital',
      label: '3. Divisi Sosmed & Digital',
      head: 'Ahmad Farhan, S.Kom.',
      phone: '6281234567803',
      icon: 'share',
      color: '#7c3aed',
      tupoksi: 'Pengelolaan media sosial resmi, publikasi warta digital, kurasi website, dan Radar Tabayyun counter-framing media.'
    },
    {
      code: 'dakwah',
      name: 'Divisi Dakwah dan Pendidikan',
      label: '4. Divisi Dakwah dan Pendidikan',
      head: 'Ust. Yohanes Fachruddin',
      phone: '6281234567804',
      icon: 'school',
      color: '#059669',
      tupoksi: 'Safari dakwah nasional, dauroh kader apologetika, pembinaan & advokasi muallaf (Muallaf Care), dan presensi kajian QR.'
    },
    {
      code: 'bisnis',
      name: 'Divisi Bisnis & Kaderisasi',
      label: '5. Divisi Bisnis & Kaderisasi',
      head: 'H. Bambang Hermawan',
      phone: '6281234567805',
      icon: 'storefront',
      color: '#d97706',
      tupoksi: 'Kemandirian ekonomi yayasan, merchandise dakwah, inkubasi wirausaha anggota, dan pelatihan kaderisasi berjenjang.'
    },
    {
      code: 'hukum',
      name: 'Divisi Hukum & Advokasi',
      label: '6. Divisi Hukum & Advokasi (LBH APII)',
      head: 'Adv. M. Rizqi, S.H., M.H.',
      phone: '6281234567806',
      icon: 'gavel',
      color: '#dc2626',
      tupoksi: 'Bantuan hukum da\'i & pengurus, advokasi sengketa dakwah, pendampingan diskriminasi agama, dan siaga krisis LBH APII 24 jam.'
    },
    {
      code: 'umum',
      name: 'Divisi Umum & Aset',
      label: '7. Divisi Umum & Aset',
      head: 'Fathur Rahman, S.Pd.',
      phone: '6281234567807',
      icon: 'inventory_2',
      color: '#475569',
      tupoksi: 'Logistik perlengkapan acara dakwah, pemeliharaan aset fisik ber-QR, operasional mobil dakwah, dan kesekretariatan fisik.'
    }
  ],

  // 4 Kantong Kas Syar'i Mandiri Sesuai Fiqih & PSAK 409
  WALLETS: [
    { code: 'AMIL_OPERASIONAL', name: 'Kas Operasional (Amil & Administrasi)', desc: 'Biaya operasional, listrik, sekretariat, ATK, server, pemeliharaan aset' },
    { code: 'ZAKAT', name: 'Kas Zakat (Ashnaf Guard)', desc: 'Khusus 8 Ashnaf Syar\'i (Fisabilillah, Fakir, Miskin, Muallaf, Gharimin, dll)' },
    { code: 'INFAQ_DAKWAH', name: 'Kas Infaq Dakwah & Sedekah', desc: 'Kegiatan safari dakwah umum, seminar kristologi komparatif, dan cetak modul' },
    { code: 'WAKAF', name: 'Kas Wakaf Produktif / Abadi', desc: 'Pengembangan aset abadi, studio multimedia dakwah, markaz riset manuskrip' }
  ],

  CASH_BUFFER_LIMIT: 2000000, // Batas aman kas tunai Rp 2.000.000

  // 5 Instruksi Baku Disposisi Ketua
  DISPOSISI_INSTRUCTIONS: [
    { code: 'TINDAK_LANJUTI', label: 'Tindak Lanjuti Segera', desc: 'Eksekusi sesuai SOP divisi pelaksana' },
    { code: 'UNTUK_DIKETAHUI', label: 'Untuk Diketahui & Arsipkan', desc: 'Informasi sebagai rujukan kepengurusan' },
    { code: 'WAKILKAN_HADIRI', label: 'Wakilkan & Hadiri Acara', desc: 'Kirimkan delegasi resmi dengan surat tugas' },
    { code: 'KAJI_ILMIAH_HUKUM', label: 'Kaji Secara Ilmiah / Hukum', desc: 'Kaji bersama Litbang / LBH APII' },
    { code: 'SIAPKAN_DRAF_BALASAN', label: 'Siapkan Draf Surat Balasan', desc: 'Koordinasikan draf jawaban naskah dinas' }
  ],

  // 3 Jenjang Lisensi Da'i pada KTA Digital CR80
  DAI_LICENSES: [
    { level: 1, name: 'Tingkat 1 - Kader Da\'i Muda', badgeColor: '#0284c7', desc: 'Kader dai pemula untuk dakwah dasar & pembinaan jamaah' },
    { level: 2, name: 'Tingkat 2 - Da\'i Madya / Lapangan', badgeColor: '#059669', desc: 'Dai lapangan tersertifikasi dialog apologetika & kajian umum' },
    { level: 3, name: 'Tingkat 3 - Dewan Pakar Senior', badgeColor: '#d97706', desc: 'Pakar senior narasumber dialog nasional, kristologi & syubhat' }
  ],

  // 5 Butir Kode Etik Anggota Yayasan APII (Sisi Belakang KTA)
  KODE_ETIK: [
    '1. Menjaga kemurnian akidah Islam Ahlussunnah wal Jama\'ah dan keluhuran akhlakul karimah.',
    '2. Mengedepankan argumentasi ilmiah, hikmah, dan kesantunan dalam setiap dialog apologetika.',
    '3. Taat dan patuh pada AD/ART Yayasan APII serta keputusan pimpinan organisasi yang sah.',
    '4. Menjaga persatuan ukhuwah Islamiyah serta keutuhan Negara Kesatuan Republik Indonesia.',
    '5. Dilarang menyalahgunakan identitas KTA APII untuk kepentingan pribadi, politik praktis, atau melanggar hukum.'
  ],

  // 10 Subfolder Baku Google Drive Vault 3-Tingkat (Kanonik PRD)
  DRIVE_SUBFOLDERS: [
    '01_SURAT_KELUAR',
    '02_SURAT_MASUK',
    '03_BUKTI_KAS',
    '04_LPJ_DIVISI',
    '05_BERKAS_KTA',
    '06_ASSET_CMS',
    '07_ADVOKASI_HUKUM',
    '08_MUALLAF_CARE',
    '09_ASET_LOGISTIK',
    '10_RISALAH_RAPAT'
  ],

  KOP_SETTINGS: {
    DPP: {
      title: 'DEWAN PENGURUS PUSAT',
      org: 'YAYASAN APOLOGET ISLAM INDONESIA',
      sk: 'SK KEMENKUMHAM RI NO. AHU-0014970.AH.01.04.TAHUN 2023',
      address: 'Gedung Pusat Dakwah APII, Jl. Kramat Raya No. 45, Senen, Jakarta Pusat 10450',
      contact: 'Telp/WA: +62 813-5857-5678 | Email: sekretariat@apologetislamindonesia.or.id | Web: apologetislamindonesia.or.id',
      logoLeft: './logo_apii.png',
      stempel: './logo_apii.png'
    },
    DPW: {
      title: 'DEWAN PENGURUS WILAYAH {WILAYAH}',
      org: 'YAYASAN APOLOGET ISLAM INDONESIA',
      sk: 'SK KEMENKUMHAM RI NO. AHU-0014970.AH.01.04.TAHUN 2023',
      address: 'Sekretariat DPW, {ALAMAT}',
      contact: 'Telp/WA: {PHONE} | Email: {SLUG}@apologetislamindonesia.or.id',
      logoLeft: './logo_apii.png',
      stempel: './logo_apii.png'
    }
  }
};

if (typeof Object.freeze === 'function') {
  Object.freeze(CONFIG.ROLES);
  Object.freeze(CONFIG.DIVISIONS);
  Object.freeze(CONFIG.WALLETS);
}

/**
 * Dual-Mode Transport Client: Cloud GAS (/exec), Local Dev Bridge (/api), & Offline Fallback Signal
 */
const ApiClient = (() => {
  const GET_ACTIONS = new Set([
    'ping',
    'verifyPublic',
    'getPublicContent',
    'getWilayahList',
    'checkConsultation'
  ]);

  function detectApiUrl(explicitUrl) {
    if (explicitUrl && typeof explicitUrl === 'string' && explicitUrl.trim()) {
      return explicitUrl.trim();
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const override = window.localStorage.getItem('siap_apii_api_url');
        if (override && override.trim()) return override.trim();
      }
      if (typeof window !== 'undefined' && window.location) {
        const host = String(window.location.hostname || '').toLowerCase();
        const href = String(window.location.href || '').split('?')[0].split('#')[0];
        if (/\/exec$/i.test(href)) return href;
        if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return '/api';
      }
    } catch (e) {}
    return '';
  }

  function getApiUrl() {
    return detectApiUrl(CONFIG.API_URL);
  }

  function isOnlineMode() {
    const url = getApiUrl();
    if (!url) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    return true;
  }

  function getStoredToken() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem('siap_apii_session_v3');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.token) return parsed.token;
        }
      }
    } catch (e) {}
    return '';
  }

  async function request(action, payload = {}, options = {}) {
    const apiUrl = options.apiUrl || getApiUrl();
    const offlineSignal = {
      ok: false,
      offline: true,
      fallback: true,
      mode: 'LOCAL_STORAGE_MOCK',
      error: 'Mode offline atau endpoint API belum tersedia. Menggunakan fallback penyimpanan lokal.'
    };

    if (!apiUrl || (typeof navigator !== 'undefined' && navigator.onLine === false && !options.forceFetch)) {
      return offlineSignal;
    }

    if (typeof fetch !== 'function') {
      return offlineSignal;
    }

    const method = String(options.method || (GET_ACTIONS.has(action) ? 'GET' : 'POST')).toUpperCase();
    const token = options.token !== undefined ? options.token : getStoredToken();
    const timeoutMs = options.timeoutMs || 10000;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      let response;
      if (method === 'GET') {
        const params = new URLSearchParams(Object.assign({ action }, payload || {}));
        const sep = apiUrl.includes('?') ? '&' : '?';
        response = await fetch(`${apiUrl}${sep}${params.toString()}`, {
          method: 'GET',
          signal: controller ? controller.signal : undefined
        });
      } else {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify({
            action,
            token,
            payload: payload || {}
          }),
          signal: controller ? controller.signal : undefined
        });
      }

      if (timer) clearTimeout(timer);

      if (!response.ok) {
        const isTransportFallback = response.status === 404 || response.status >= 500;
        return {
          ok: false,
          offline: isTransportFallback,
          fallback: isTransportFallback,
          status: response.status,
          error: `HTTP ${response.status} dari server API`
        };
      }

      const data = await response.json();
      if (data && typeof data === 'object') {
        return Object.assign({ offline: false, fallback: false }, data);
      }
      return { ok: false, offline: true, fallback: true, error: 'Respons API bukan JSON valid.' };
    } catch (err) {
      if (timer) clearTimeout(timer);
      return {
        ok: false,
        offline: true,
        fallback: true,
        mode: 'LOCAL_STORAGE_MOCK',
        error: err && err.message ? err.message : 'Koneksi ke server API gagal.'
      };
    }
  }

  return {
    detectApiUrl,
    getApiUrl,
    isOnlineMode,
    request
  };
})();

CONFIG.detectApiUrl = ApiClient.detectApiUrl;

if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
  window.ApiClient = ApiClient;
}
