/**
 * SIAP APII Enterprise v3.0.0 - Public Portal Configuration
 * Yayasan Apologet Islam Indonesia (SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023)
 * Pengembang: Sigit Adi Irianto (https://wa.me/6281358575678 | sigitadi.id)
 */

const CONFIG = {
  VERSION: '3.0.0 Enterprise',
  APP_TITLE: 'Yayasan Apologet Islam Indonesia',
  LEGAL_NAME: 'Yayasan Apologet Islam Indonesia',
  LEGAL_SK: 'AHU-0014970.AH.01.04.Tahun 2023',
  DEV_CREDIT: 'Sigit Adi Irianto (Freelance Software Engineer) | https://wa.me/6281358575678 | sigitadi.id',
  LOGO_URL: './logo_apii.png',

  // Shared Storage Key dengan Portal Pengurus (/portal)
  SHARED_STORAGE_KEY: 'siap_apii_shared_db_v3',

  // Google Apps Script Web App Endpoint (otomatis deteksi /api di localhost atau /exec)
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

  DEFAULT_TENANT: 'DPP_PUSAT',

  // Database 6 Wilayah dengan Data Spesifik, Pimpinan, Rekening, dan Agenda Lokal
  TENANTS: [
    {
      code: 'DPP_PUSAT',
      name: 'DPP Pusat (Nasional)',
      slug: 'pusat',
      level: 'DPP',
      badge: 'MARKAZ DAKWAH NASIONAL',
      headline: 'Membentengi Akidah Umat, Menegakkan Argumentasi Ilmiah',
      subheadline: 'Dewan Pengurus Pusat (Nasional) Yayasan Apologet Islam Indonesia',
      mission: 'Pusat komando advokasi hukum da\'i tingkat nasional, standardisasi kurikulum Kristologi teruji, rujukan manuskrip kuno teologi komparatif, dan pembinaan muallaf terpadu di 38 provinsi.',
      phone: '6281358575678',
      email: 'sekretariat@apologetislamindonesia.or.id',
      city: 'Jakarta Pusat',
      address: 'Gedung Pusat Dakwah APII, Jl. Kramat Raya No. 45, Senen, Jakarta Pusat 10450',
      lat: -6.1856,
      lng: 106.8456,
      zoom: 14,
      pimpinan: {
        ketua: 'Ust. H. Ahmad Fauzi, Lc., M.A. (Ketua Umum)',
        sekretaris: 'Ust. M. Ridwan, S.Pd.I. (Sekretaris Umum)',
        bendahara: 'H. Syamsuddin, S.E., Ak. (Bendahara Umum)',
        pembina: 'Prof. Dr. K.H. Ma\'ruf Syafi\'i (Ketua Dewan Pembina)',
        pengawas: 'Drs. H. Sudirman, Ak., CA (Ketua Dewan Pengawas)'
      },
      crowdfunding: {
        title: 'Pembangunan Studio Multimedia Dakwah & Pusat Riset Manuskrip Kuno APII',
        target: 250000000,
        current: 178450000,
        donorsCount: 1420
      },
      bank: {
        name: 'Bank Syariah Indonesia (BSI)',
        accountNo: '777-888-999-1',
        accountName: 'Yayasan Apologet Islam Indonesia (Kas Pusat)',
        qrisText: 'QRIS BSI PUSAT DAKWAH APII'
      },
      warta: [
        {
          tag: 'MAKLUMAT PUSAT',
          title: 'Maklumat Dewan Pengurus Pusat APII tentang Standar Verifikasi Syariah & Legalitas Dakwah',
          summary: 'Penegasan integritas kelembagaan Yayasan Apologet Islam Indonesia dengan landasan SK Kemenkumham RI AHU-0014970.AH.01.04.Tahun 2023.',
          date: '09 November 2026',
          author: 'Sekretariat DPP APII'
        },
        {
          tag: 'KRISTOLOGI KOMPARATIF',
          title: 'Kajian Komparatif: Membedah Otentisitas Manuskrip Kuno & Argumentasi Teologis Islam',
          summary: 'Telaah kritis terhadap naskah Sinaiticus, Vaticanus, dan papirus awal dibandingkan tradisi mutawatir Al-Qur’an.',
          date: '05 November 2026',
          author: 'Ust. Dani Ramadhan, M.Ag.'
        }
      ],
      agenda: [
        {
          day: '15',
          month: 'NOV',
          category: 'SAFARI NASIONAL',
          title: 'Dialog Teologi & Kristologi Komparatif Nasional 2026',
          speaker: 'Ust. Dani Ramadhan, M.Ag. & Tim Asatidz DPP',
          location: 'Auditorium Jakarta Islamic Centre (JIC), Koja'
        },
        {
          day: '28',
          month: 'NOV',
          category: 'RAKORNAS',
          title: 'Rapat Kerja Nasional (Rakornas) I APII se-Indonesia',
          speaker: 'Dewan Pembina, Pengawas & Seluruh Ketua DPW',
          location: 'Grand Asrilia Hotel, Jakarta Pusat'
        }
      ]
    },
    {
      code: 'DPW_JABO',
      name: 'DPW Jabodetabek',
      slug: 'jabodetabek',
      level: 'DPW',
      badge: 'KORWIL 1: KHUSUS IBUKOTA & MITRA',
      headline: 'Benteng Akidah Megapolitan, Advokasi Muallaf Urban & Safari Kajian',
      subheadline: 'Dewan Pengurus Wilayah APII DKI Jakarta, Bogor, Depok, Tangerang & Bekasi',
      mission: 'Fokus penanganan intensif pemurtadan di kawasan urban metropolitan, shelter perlindungan muallaf 24 jam di Jakarta Timur, serta safari kajian di masjid-masjid perkantoran SCBD dan Kuningan.',
      phone: '6281234567891',
      email: 'jabodetabek@apologetislamindonesia.or.id',
      city: 'Jakarta Selatan',
      address: 'Graha Dakwah DPW Jabodetabek, Jl. TB Simatupang No. 18, Cilandak, Jakarta Selatan 12560',
      lat: -6.2905,
      lng: 106.7949,
      zoom: 13,
      pimpinan: {
        ketua: 'Ust. Bambang Hidayat, M.Si. (Ketua DPW)',
        sekretaris: 'Ust. Irwan Setiawan, S.Pd.I. (Sekretaris DPW)',
        bendahara: 'H. Achmad Syafi’i, S.T. (Bendahara DPW)',
        pembina: 'Drs. K.H. Syukron Ma’mun (Pembina Wilayah)',
        pengawas: 'H. Faisal Rizal, S.E., M.M. (Pengawas Wilayah)'
      },
      crowdfunding: {
        title: 'Operasional Shelter Darurat & Pembinaan 50 Muallaf Urban Jabodetabek',
        target: 120000000,
        current: 84500000,
        donorsCount: 890
      },
      bank: {
        name: 'Bank Syariah Indonesia (BSI)',
        accountNo: '777-111-222-2',
        accountName: 'DPW APII Jabodetabek (Kas Infaq)',
        qrisText: 'QRIS BSI DPW JABODETABEK'
      },
      warta: [
        {
          tag: 'PROGRAM WILAYAH',
          title: 'Silaturahmi Akbar & Penyaluran Santunan 40 Muallaf Binaan se-Jabodetabek',
          summary: 'DPW Jabodetabek menyalurkan paket kemandirian ekonomi dan pendampingan akidah bagi muallaf terdampak intimidasi keluarga.',
          date: '07 November 2026',
          author: 'Humas DPW Jabodetabek'
        }
      ],
      agenda: [
        {
          day: '20',
          month: 'NOV',
          category: 'KAJIAN PERKANTORAN',
          title: 'Kupas Tuntas Syubhat Akidah Modern & Teologi Rasional',
          speaker: 'Ust. Bambang Hidayat, M.Si.',
          location: 'Masjid Nurul Hidayah, SCBD Sudirman, Jakarta Selatan'
        }
      ]
    }
  ]
};

if (typeof Object.freeze === 'function') {
  Object.freeze(CONFIG.TENANTS);
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
