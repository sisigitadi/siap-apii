/**
 * SIAP APII Enterprise - Authentication & RBAC Session Manager
 * Yayasan Apologet Islam Indonesia (SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023)
 * Pengembang: Sigit Adi Irianto (https://wa.me/6281358575678 | sigitadi.id)
 * 8 Role IDs & 18 Official Roster Accounts for DPP & DPWs
 */

const Auth = (() => {
  const STORAGE_KEY = 'siap_apii_session_v3';

  function buildMonogramAvatar(name, role) {
    if (typeof window !== 'undefined' && window.State && typeof window.State.createMonogramAvatar === 'function') {
      return window.State.createMonogramAvatar(name, role);
    }
    const raw = String(name || 'APII').trim();
    const titles = /^(ust\.?|ustadz|prof\.?|dr\.?|drs\.?|k\.?h\.?|h\.?|hj\.?|adv\.?|ir\.?)$/i;
    const words = raw
      .replace(/[,]/g, ' ')
      .split(/\s+/)
      .filter(w => w && !titles.test(w) && !/^[A-Z]\.[A-Za-z.]+$/.test(w));
    const sourceWords = words.length > 0 ? words : raw.split(/\s+/).filter(Boolean);
    let initials = 'AP';
    if (sourceWords.length >= 2) {
      initials = (sourceWords[0][0] + sourceWords[1][0]).toUpperCase();
    } else if (sourceWords.length === 1) {
      initials = sourceWords[0].slice(0, 2).toUpperCase();
    }
    initials = initials.replace(/[^A-Z0-9]/g, '') || 'AP';
    const palette = {
      superadmin: '#0F172A',
      ketua: '#064E3B',
      sekretaris: '#0F766E',
      bendahara: '#B45309',
      pembina: '#1E3A8A',
      pengawas: '#4338CA',
      ketua_divisi: '#047857',
      anggota_divisi: '#334155',
      kader_biasa: '#475569'
    };
    const bg = palette[String(role || '').toLowerCase()] || '#064E3B';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="${initials}"><rect width="100" height="100" rx="18" fill="${bg}"/><circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/><text x="50" y="57" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="36" font-weight="700" fill="#FFFFFF" letter-spacing="1">${initials}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  const DEFAULT_PASSWORD = 'Demo123';

  const USERNAME_ALIASES = {
    superadmin: 'admin',
    administrator: 'admin',
    ketua_umum: 'ketua',
    ketum: 'ketua',
    sekretaris_umum: 'sekretaris',
    sekjen: 'sekretaris',
    bendahara_umum: 'bendahara',
    bendum: 'bendahara',
    dewan_pembina: 'pembina',
    dewan_pengawas: 'pengawas',
    ketua_divisi_humas: 'kadiv_humas',
    ketua_divisi_litbang: 'kadiv_litbang',
    ketua_divisi_sosmed: 'kadiv_sosmed',
    ketua_divisi_dakwah: 'kadiv_dakwah',
    ketua_divisi_bisnis: 'kadiv_bisnis',
    ketua_divisi_hukum: 'kadiv_hukum',
    ketua_divisi_umum: 'kadiv_umum',
    dai_muda: 'anggota',
    anggota_divisi: 'anggota',
    ketua_dpw_jabo: 'ketua_jabo',
    sekretaris_dpw_jabo: 'sekretaris_jabo',
    bendahara_dpw_jabo: 'bendahara_jabo',
    dai_jabo: 'anggota_jabo'
  };

  // Roster 21 Akun Pengurus Resmi Lengkap Sesuai PRD Bab 2.2 & ART Pasal 16 (Sandi Seragam: Demo123)
  const DEMO_ACCOUNTS = [
    // === 1. PIMPINAN HARIAN & DEWAN PIMPINAN TINGGI DPP PUSAT ===
    {
      id: 'USR-001',
      username: 'admin',
      password: DEFAULT_PASSWORD,
      fullName: 'Super Administrator Nasional',
      role: 'superadmin',
      category: 'Administrator Utama',
      tenantId: 'DPP_PUSAT',
      phone: '6281358575678',
      email: 'admin@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('Super Administrator Nasional', 'superadmin')
    },
    {
      id: 'USR-002',
      username: 'ketua',
      password: DEFAULT_PASSWORD,
      fullName: 'Ust. H. Ahmad Fauzi, Lc., M.A.',
      role: 'ketua',
      category: 'Ketua Umum DPP',
      tenantId: 'DPP_PUSAT',
      phone: '6281358575678',
      email: 'ketua@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('Ust. H. Ahmad Fauzi, Lc., M.A.', 'ketua')
    },
    {
      id: 'USR-003',
      username: 'sekretaris',
      password: DEFAULT_PASSWORD,
      fullName: 'Ust. M. Ridwan, S.Pd.I.',
      role: 'sekretaris',
      category: 'Sekretaris Umum DPP',
      tenantId: 'DPP_PUSAT',
      phone: '6281298765432',
      email: 'sekretaris@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('Ust. M. Ridwan, S.Pd.I.', 'sekretaris')
    },
    {
      id: 'USR-004',
      username: 'bendahara',
      password: DEFAULT_PASSWORD,
      fullName: 'H. Syamsuddin, S.E., Ak.',
      role: 'bendahara',
      category: 'Bendahara Umum DPP',
      tenantId: 'DPP_PUSAT',
      phone: '6281287654321',
      email: 'bendahara@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('H. Syamsuddin, S.E., Ak.', 'bendahara')
    },
    {
      id: 'USR-005',
      username: 'pembina',
      password: DEFAULT_PASSWORD,
      fullName: 'Prof. Dr. K.H. Ma\'ruf Syafi\'i',
      role: 'pembina',
      category: 'Dewan Pembina (Executive Read-Only)',
      tenantId: 'DPP_PUSAT',
      phone: '628111222333',
      email: 'pembina@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('Prof. Dr. K.H. Ma\'ruf Syafi\'i', 'pembina')
    },
    {
      id: 'USR-006',
      username: 'pengawas',
      password: DEFAULT_PASSWORD,
      fullName: 'Drs. H. Sudirman, Ak., CA',
      role: 'pengawas',
      category: 'Dewan Pengawas (Forensic Audit Read-Only)',
      tenantId: 'DPP_PUSAT',
      phone: '628111444555',
      email: 'pengawas@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('Drs. H. Sudirman, Ak., CA', 'pengawas')
    },

    // === 2. KETUA 7 DIVISI RESMI ART PASAL 16 & ANGGOTA (DPP PUSAT) ===
    {
      id: 'USR-007',
      username: 'kadiv_humas',
      password: DEFAULT_PASSWORD,
      fullName: 'Ilham Kurniawan, S.I.Kom.',
      role: 'ketua_divisi',
      divisi: 'humas',
      category: 'Ketua Divisi 1: Humas',
      tenantId: 'DPP_PUSAT',
      phone: '6281234567801',
      email: 'humas@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('Ilham Kurniawan, S.I.Kom.', 'ketua_divisi')
    },
    {
      id: 'USR-008',
      username: 'kadiv_litbang',
      password: DEFAULT_PASSWORD,
      fullName: 'Ust. Dani Ramadhan, M.Ag.',
      role: 'ketua_divisi',
      divisi: 'litbang',
      category: 'Ketua Divisi 2: Litbang Teologi',
      tenantId: 'DPP_PUSAT',
      phone: '6281234567802',
      email: 'litbang@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('Ust. Dani Ramadhan, M.Ag.', 'ketua_divisi')
    },
    {
      id: 'USR-009',
      username: 'kadiv_sosmed',
      password: DEFAULT_PASSWORD,
      fullName: 'Ahmad Farhan, S.Kom.',
      role: 'ketua_divisi',
      divisi: 'sosmed',
      category: 'Ketua Divisi 3: Sosmed & Digital',
      tenantId: 'DPP_PUSAT',
      phone: '6281234567803',
      email: 'sosmed@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('Ahmad Farhan, S.Kom.', 'ketua_divisi')
    },
    {
      id: 'USR-010',
      username: 'kadiv_dakwah',
      password: DEFAULT_PASSWORD,
      fullName: 'Ust. Yohanes Fachruddin',
      role: 'ketua_divisi',
      divisi: 'dakwah',
      category: 'Ketua Divisi 4: Dakwah & Pendidikan',
      tenantId: 'DPP_PUSAT',
      phone: '6281234567804',
      email: 'dakwah@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('Ust. Yohanes Fachruddin', 'ketua_divisi')
    },
    {
      id: 'USR-011',
      username: 'kadiv_bisnis',
      password: DEFAULT_PASSWORD,
      fullName: 'H. Bambang Hermawan',
      role: 'ketua_divisi',
      divisi: 'bisnis',
      category: 'Ketua Divisi 5: Bisnis & Kaderisasi',
      tenantId: 'DPP_PUSAT',
      phone: '6281234567805',
      email: 'bisnis@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('H. Bambang Hermawan', 'ketua_divisi')
    },
    {
      id: 'USR-012',
      username: 'kadiv_hukum',
      password: DEFAULT_PASSWORD,
      fullName: 'Adv. M. Rizqi, S.H., M.H.',
      role: 'ketua_divisi',
      divisi: 'hukum',
      category: 'Ketua Divisi 6: Hukum & Advokasi (LBH)',
      tenantId: 'DPP_PUSAT',
      phone: '6281234567806',
      email: 'hukum@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('Adv. M. Rizqi, S.H., M.H.', 'ketua_divisi')
    },
    {
      id: 'USR-013',
      username: 'kadiv_umum',
      password: DEFAULT_PASSWORD,
      fullName: 'Fathur Rahman, S.Pd.',
      role: 'ketua_divisi',
      divisi: 'umum',
      category: 'Ketua Divisi 7: Umum & Aset',
      tenantId: 'DPP_PUSAT',
      phone: '6281234567807',
      email: 'umum@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('Fathur Rahman, S.Pd.', 'ketua_divisi')
    },
    {
      id: 'USR-014',
      username: 'anggota',
      password: DEFAULT_PASSWORD,
      fullName: 'Ust. Zulkifli, S.Th.I.',
      role: 'anggota_divisi',
      divisi: 'dakwah',
      category: 'Kader Da\'i Muda (Lisensi Tingkat 1)',
      tenantId: 'DPP_PUSAT',
      phone: '6281234567899',
      email: 'zulkifli@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('Ust. Zulkifli, S.Th.I.', 'anggota_divisi')
    },

    // === 3. PIMPINAN & DIVISI WILAYAH (DPW JABODETABEK) - KUNCI YURISDIKSI WILAYAH ===
    {
      id: 'USR-015',
      username: 'ketua_jabo',
      password: DEFAULT_PASSWORD,
      fullName: 'Ust. Bambang Hidayat, M.Si.',
      role: 'ketua',
      isPengurus: true,
      category: 'Ketua DPW Jabodetabek',
      tenantId: 'DPW_JABO',
      phone: '6281234567891',
      email: 'ketua.jabo@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('Ust. Bambang Hidayat, M.Si.', 'ketua')
    },
    {
      id: 'USR-016',
      username: 'sekretaris_jabo',
      password: DEFAULT_PASSWORD,
      fullName: 'Ust. Irwan Setiawan, S.Pd.I.',
      role: 'sekretaris',
      isPengurus: true,
      category: 'Sekretaris DPW Jabodetabek',
      tenantId: 'DPW_JABO',
      phone: '6281234567898',
      email: 'sekretaris.jabo@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('Ust. Irwan Setiawan, S.Pd.I.', 'sekretaris')
    },
    {
      id: 'USR-017',
      username: 'bendahara_jabo',
      password: DEFAULT_PASSWORD,
      fullName: 'H. Achmad Syafi’i, S.T.',
      role: 'bendahara',
      isPengurus: true,
      category: 'Bendahara DPW Jabodetabek',
      tenantId: 'DPW_JABO',
      phone: '6281234567897',
      email: 'bendahara.jabo@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('H. Achmad Syafi’i, S.T.', 'bendahara')
    },
    {
      id: 'USR-018',
      username: 'kadiv_dakwah_jabo',
      password: DEFAULT_PASSWORD,
      fullName: 'Ust. Hendra Gunawan, S.Pd.I.',
      role: 'ketua_divisi',
      divisi: 'dakwah',
      isPengurus: true,
      category: 'Ketua Divisi Dakwah DPW Jabodetabek',
      tenantId: 'DPW_JABO',
      phone: '6281234567895',
      email: 'dakwah.jabo@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('Ust. Hendra Gunawan, S.Pd.I.', 'ketua_divisi')
    },
    {
      id: 'USR-019',
      username: 'kadiv_hukum_jabo',
      password: DEFAULT_PASSWORD,
      fullName: 'Adv. Syarif Hidayatullah, S.H.',
      role: 'ketua_divisi',
      divisi: 'hukum',
      isPengurus: true,
      category: 'Ketua Divisi Hukum DPW Jabodetabek',
      tenantId: 'DPW_JABO',
      phone: '6281234567894',
      email: 'hukum.jabo@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('Adv. Syarif Hidayatullah, S.H.', 'ketua_divisi')
    },
    {
      id: 'USR-020',
      username: 'anggota_jabo',
      password: DEFAULT_PASSWORD,
      fullName: 'Ust. Fajar Ramadhan, S.Sos.',
      role: 'anggota_divisi',
      divisi: 'dakwah',
      isPengurus: true,
      category: 'Anggota Divisi Dakwah DPW Jabodetabek',
      tenantId: 'DPW_JABO',
      phone: '6281234567896',
      email: 'anggota.jabo@apologetislamindonesia.or.id',
      avatar: buildMonogramAvatar('Ust. Fajar Ramadhan, S.Sos.', 'anggota_divisi')
    },

    // === 4. SIMULASI KADER BIASA / BUKAN PENGURUS (AKSES PORTAL DITOLAK) ===
    {
      id: 'KAD-001',
      username: 'kader_ahmad',
      password: DEFAULT_PASSWORD,
      fullName: 'Ahmad Fauzan (Kader Umum)',
      role: 'kader_biasa',
      isPengurus: false,
      category: 'Kader Biasa (Bukan Pengurus - Akses Ditolak)',
      tenantId: 'DPW_JABO',
      phone: '6281299998888',
      email: 'ahmad.fauzan@gmail.com',
      avatar: buildMonogramAvatar('Ahmad Fauzan (Kader Umum)', 'kader_biasa'),
      isActive: true
    }
  ];

  let currentSession = null;

  function resolveAccountByUsername(rawUsername) {
    const clean = String(rawUsername || '').trim().toLowerCase();
    if (!clean) return null;
    const mapped = USERNAME_ALIASES[clean] || clean;
    return DEMO_ACCOUNTS.find(
      u => u.username.toLowerCase() === mapped || u.username.toLowerCase() === clean
    ) || null;
  }

  function init() {
    loadSession();
    // Tidak ada auto-login diam-diam: jika sesi kosong/tidak sah, halaman Login ditampilkan
  }

  function loadSession() {
    try {
      const legacyDefaultPassRe = /^(APII@Admin2026|Ketua@2026|Sekretaris@2026|Bendahara@2026|Pembina@2026|Pengawas@2026|Kadiv@2026|Anggota@2026|Jabo@2026|Kader@2026)$/;
      const savedAccounts = localStorage.getItem('apii_custom_accounts');
      if (savedAccounts) {
        const parsed = JSON.parse(savedAccounts);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach(p => {
            if (!p.avatar || String(p.avatar).includes('images.unsplash.com')) {
              p.avatar = buildMonogramAvatar(p.fullName || p.username, p.role);
            }
            if (!p.password || legacyDefaultPassRe.test(String(p.password))) {
              p.password = DEFAULT_PASSWORD;
            }
            const idx = DEMO_ACCOUNTS.findIndex(d => d.id === p.id || d.username === p.username);
            if (idx !== -1) {
              DEMO_ACCOUNTS[idx] = Object.assign({}, DEMO_ACCOUNTS[idx], p);
            } else {
              DEMO_ACCOUNTS.push(p);
            }
          });
        }
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        currentSession = JSON.parse(raw);
        // Pastikan akun sesi saat ini masih aktif dan berstatus pengurus sah
        const acc = DEMO_ACCOUNTS.find(u => u.id === currentSession?.user?.id);
        if (!currentSession?.user || (acc && (acc.isActive === false || acc.isPengurus === false || acc.role === 'kader_biasa'))) {
          currentSession = null;
          localStorage.removeItem(STORAGE_KEY);
        } else if (acc) {
          // Segarkan atribut session user langsung dari roster terbaru agar tidak ada data basi
          currentSession.user = Object.assign({}, currentSession.user, {
            username: acc.username,
            fullName: acc.fullName,
            role: acc.role,
            divisi: acc.divisi || null,
            category: acc.category,
            tenantId: acc.tenantId,
            phone: acc.phone,
            email: acc.email,
            avatar: acc.avatar || buildMonogramAvatar(acc.fullName, acc.role)
          });
        }
      }
    } catch (e) {
      console.warn('Gagal memuat sesi pengurus:', e);
      currentSession = null;
    }
  }

  function syncSessionToDatabase(session) {
    try {
      if (typeof window !== 'undefined' && window.State && typeof window.State.getDb === 'function') {
        const db = window.State.getDb();
        if (db && Array.isArray(db.sessions) && session) {
          db.sessions = db.sessions.filter(s => !s.isCurrent && s.token !== session.token);
          db.sessions.forEach(s => { s.isCurrent = false; });
          db.sessions.unshift({
            token: session.token,
            userId: session.userId,
            username: session.username,
            fullName: session.fullName,
            role: session.role,
            tenantId: session.tenantId,
            wilayahId: session.tenantId,
            divisi: session.divisi || null,
            device: session.device,
            ipAddress: session.ipAddress,
            loginAt: session.loginAt,
            expiresAt: session.expiresAt,
            isCurrent: true
          });
          if (typeof window.State.saveDatabase === 'function') {
            window.State.saveDatabase();
          }
        }
      }
    } catch (e) { }
  }

  function saveSession(session) {
    currentSession = session;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      console.error('Gagal menyimpan sesi pengurus:', e);
    }
    syncSessionToDatabase(session);
    // Siarkan pembaruan sesi ke seluruh UI
    if (window.App && typeof window.App.onSessionChanged === 'function') {
      window.App.onSessionChanged(currentSession);
    }
  }

  function login(username, password) {
    const acc = resolveAccountByUsername(username);
    if (!acc || acc.password !== String(password || '')) {
      return { ok: false, error: 'Username jabatan atau kata sandi tidak valid.' };
    }

    if (acc.isPengurus === false || acc.role === 'kader_biasa') {
      return {
        ok: false,
        isKaderNonPengurus: true,
        user: acc,
        error: 'Akses Ditolak: Anda terdaftar sebagai Kader Biasa (Bukan Pengurus) dan tidak memiliki SK Mandat Kepengurusan. Portal Pengurus (SIAP APII) dikhususkan secara eksklusif bagi Pengurus Resmi DPP & DPW. Silakan akses layanan KTA Digital dan konsultasi melalui Portal Publik (/public).'
      };
    }

    if (acc.isActive === false) {
      return { ok: false, error: 'Akun Anda berstatus Demisioner / Dinonaktifkan oleh Administrator.' };
    }

    const session = createSessionObject(acc);
    saveSession(session);
    return { ok: true, session };
  }

  function loginAsUser(username) {
    const acc = resolveAccountByUsername(username);
    if (acc) {
      if (acc.isPengurus === false || acc.role === 'kader_biasa') {
        if (window.App && typeof window.App.showKaderAccessDeniedModal === 'function') {
          window.App.showKaderAccessDeniedModal(acc);
        } else if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast('Akses Ditolak: Kader biasa (bukan pengurus) dilarang masuk Portal Pengurus!', 'error');
        }
        return null;
      }
      if (acc.isActive === false) {
        console.warn('Akun demisioner:', username);
        return null;
      }
      const session = createSessionObject(acc);
      saveSession(session);
      return session;
    }
    return null;
  }

  function getRoleTitleByYurisdiksi(role, tenantId, divisi) {
    const isPusat = tenantId === 'DPP_PUSAT';
    let divName = '';
    if (divisi && window.CONFIG && CONFIG.DIVISIONS) {
      const dObj = CONFIG.DIVISIONS.find(d => d.code === divisi);
      divName = dObj ? dObj.name.replace('Divisi ', '') : divisi.toUpperCase();
    }

    switch (role) {
      case 'superadmin':
        return 'Super Administrator Nasional';
      case 'ketua':
        return isPusat ? 'Ketua Umum DPP' : 'Ketua DPW Jabodetabek';
      case 'sekretaris':
        return isPusat ? 'Sekretaris Umum DPP' : 'Sekretaris DPW Jabodetabek';
      case 'bendahara':
        return isPusat ? 'Bendahara Umum DPP' : 'Bendahara DPW Jabodetabek';
      case 'pembina':
        return 'Dewan Pembina (Executive Read-Only)';
      case 'pengawas':
        return 'Dewan Pengawas (Forensic Audit Read-Only)';
      case 'ketua_divisi':
        return isPusat ? `Ketua Divisi ${divName} DPP` : `Ketua Divisi ${divName} DPW Jabodetabek`;
      case 'anggota_divisi':
        return isPusat ? `Anggota Divisi ${divName} DPP` : `Anggota Divisi ${divName} DPW Jabodetabek`;
      default:
        return 'Kader Biasa (Non-Pengurus)';
    }
  }

  function createSessionObject(acc) {
    const isNationalExecutive = ['superadmin', 'ketua', 'sekretaris', 'bendahara', 'pembina', 'pengawas'].includes(acc.role) && acc.tenantId === 'DPP_PUSAT';
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fmt = (typeof window !== 'undefined' && window.State && typeof window.State.formatWaktu === 'function')
      ? window.State.formatWaktu
      : (d) => d.toISOString();
    const deviceLabel = (typeof navigator !== 'undefined' && navigator.userAgent)
      ? (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'Mobile Browser / Web' : 'Desktop Browser / Web')
      : 'Portal Web Session';

    return {
      token: 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36),
      userId: acc.id,
      username: acc.username,
      fullName: acc.fullName,
      role: acc.role,
      tenantId: acc.tenantId,
      divisi: acc.divisi || null,
      device: deviceLabel,
      ipAddress: '127.0.0.1',
      loginAt: fmt(now),
      expiresAt: fmt(expires),
      isCurrent: true,
      user: {
        id: acc.id,
        username: acc.username,
        fullName: acc.fullName,
        role: acc.role,
        divisi: acc.divisi || null,
        category: acc.category,
        tenantId: acc.tenantId,
        phone: acc.phone,
        email: acc.email,
        avatar: acc.avatar || buildMonogramAvatar(acc.fullName, acc.role),
        isNationalExecutive: isNationalExecutive,
        isPembinaReadOnly: acc.role === 'pembina',
        isPengawasReadOnly: acc.role === 'pengawas'
      }
    };
  }

  function logout() {
    const activeToken = currentSession?.token;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) { }
    try {
      if (typeof window !== 'undefined' && window.State && typeof window.State.getDb === 'function') {
        const db = window.State.getDb();
        if (db && Array.isArray(db.sessions)) {
          db.sessions = db.sessions.filter(s => !s.isCurrent && (!activeToken || s.token !== activeToken));
          if (typeof window.State.saveDatabase === 'function') {
            window.State.saveDatabase();
          }
        }
      }
    } catch (e) { }
    currentSession = null;
    if (window.App && typeof window.App.onSessionLoggedOut === 'function') {
      window.App.onSessionLoggedOut();
    }
  }

  function isAuthenticated() {
    return !!(currentSession && currentSession.user && currentSession.user.isPengurus !== false && currentSession.user.role !== 'kader_biasa');
  }

  function getCurrentUser() {
    return isAuthenticated() ? currentSession.user : null;
  }

  function hasPermission(permission) {
    const user = getCurrentUser();
    if (!user) return false;
    if (user.role === 'superadmin') return true;

    // Strict Gate: Kader biasa / non-pengurus dilarang memiliki izin sistem apapun
    if (user.isPengurus === false || user.role === 'kader_biasa') return false;

    // Guard Spesialisasi 7 Divisi Resmi ART Pasal 16:
    // Ketua Divisi hanya memiliki izin fungsional sesuai divisinya sendiri
    if (user.role === 'ketua_divisi') {
      if (permission === 'advokasi:manage' && user.divisi !== 'hukum') return false;
      if (permission === 'muallaf:manage' && user.divisi !== 'dakwah') return false;
      if (permission === 'aset:loan' && user.divisi !== 'umum' && user.divisi !== 'dakwah') return false;
    }

    // Anggota Divisi / Da'i Lapangan
    if (user.role === 'anggota_divisi') {
      if (permission === 'muallaf:manage' && user.divisi !== 'dakwah') return false;
    }

    const roleDef = CONFIG.ROLES[user.role];
    if (!roleDef) return false;
    if (roleDef.permissions.includes('*')) return true;
    return roleDef.permissions.includes(permission);
  }

  function canAccessWorkspace(workspaceName) {
    const user = getCurrentUser();
    if (!user) return false;
    if (user.role === 'superadmin') return true;

    // Strict Gate: Kader biasa / non-pengurus dilarang masuk ke ruang kerja manapun
    if (user.isPengurus === false || user.role === 'kader_biasa') return false;

    // Spesialisasi Dinamis Ketua Divisi (ART Pasal 16)
    if (user.role === 'ketua_divisi') {
      if (workspaceName === 'advokasi') {
        return user.divisi === 'hukum';
      }
      if (workspaceName === 'muallaf') {
        return user.divisi === 'dakwah' || user.divisi === 'umum';
      }
    }

    // Spesialisasi Dinamis Anggota Divisi / Da'i Lapangan
    if (user.role === 'anggota_divisi') {
      if (workspaceName === 'muallaf') {
        return user.divisi === 'dakwah';
      }
    }

    const roleDef = CONFIG.ROLES[user.role];
    if (!roleDef || !Array.isArray(roleDef.allowedWorkspaces)) return false;
    return roleDef.allowedWorkspaces.includes(workspaceName);
  }

  function isReadOnly() {
    const user = getCurrentUser();
    if (!user) return false;
    return !!(user.role === 'pembina' || user.role === 'pengawas' || user.isPembinaReadOnly || user.isPengawasReadOnly);
  }

  function getRoleDutySummary() {
    const user = getCurrentUser();
    if (!user) return '';
    const roleDef = CONFIG.ROLES[user.role];
    return roleDef ? roleDef.desc : '';
  }

  function getAllAccounts() {
    return DEMO_ACCOUNTS;
  }

  function revokeUserSessions(userId, username) {
    if (typeof window !== 'undefined' && window.State && typeof window.State.getDb === 'function') {
      const db = window.State.getDb();
      if (db && Array.isArray(db.sessions)) {
        db.sessions = db.sessions.filter(s => s.userId !== userId && (!username || s.username !== username));
        if (typeof window.State.saveDatabase === 'function') {
          window.State.saveDatabase();
        }
      }
    }
    if (currentSession && (currentSession.userId === userId || currentSession.user?.id === userId || (username && currentSession.username === username))) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) { }
      currentSession = null;
    }
  }

  function saveUser(userData) {
    let acc = DEMO_ACCOUNTS.find(u => u.id === userData.id || (userData.username && u.username.toLowerCase() === userData.username.toLowerCase()));
    if (acc) {
      Object.assign(acc, userData);
      if (!acc.avatar || String(acc.avatar).includes('images.unsplash.com')) {
        acc.avatar = buildMonogramAvatar(acc.fullName || acc.username, acc.role);
      }
    } else {
      const resolvedRole = userData.role || 'anggota_divisi';
      acc = Object.assign({
        id: userData.id || ('USR-' + String(DEMO_ACCOUNTS.length + 1).padStart(3, '0')),
        username: userData.username,
        password: userData.password || DEFAULT_PASSWORD,
        fullName: userData.fullName,
        role: resolvedRole,
        divisi: userData.divisi || null,
        category: userData.category || (resolvedRole.toUpperCase() + ' APII'),
        tenantId: userData.tenantId || 'DPP_PUSAT',
        phone: userData.phone || '6281234567899',
        email: userData.email || (userData.username + '@apologetislamindonesia.or.id'),
        avatar: userData.avatar || buildMonogramAvatar(userData.fullName || userData.username, resolvedRole),
        isActive: userData.isActive !== false,
        isPengurus: userData.isPengurus !== false && resolvedRole !== 'kader_biasa'
      }, userData);
      DEMO_ACCOUNTS.push(acc);
    }

    if (acc.isActive === false) {
      const current = getCurrentUser();
      const isSelf = current && (current.id === acc.id || current.username === acc.username);
      revokeUserSessions(acc.id, acc.username);
      if (isSelf) {
        logout();
      }
    }

    try {
      localStorage.setItem('apii_custom_accounts', JSON.stringify(DEMO_ACCOUNTS));
    } catch (e) {
      console.warn('Gagal persistensi akun:', e);
    }

    return acc;
  }

  function toggleUserStatus(userId, isActive) {
    const acc = DEMO_ACCOUNTS.find(u => u.id === userId);
    if (!acc) return false;
    acc.isActive = !!isActive;

    if (!acc.isActive) {
      const current = getCurrentUser();
      const isSelf = current && (current.id === userId || current.username === acc.username);
      revokeUserSessions(userId, acc.username);
      if (isSelf) {
        logout();
      }
    }

    try {
      localStorage.setItem('apii_custom_accounts', JSON.stringify(DEMO_ACCOUNTS));
    } catch (e) { }

    return true;
  }

  function resetPassword(userId, newTempPassword) {
    const acc = DEMO_ACCOUNTS.find(u => u.id === userId);
    if (!acc) return null;
    acc.password = newTempPassword || DEFAULT_PASSWORD;
    const current = getCurrentUser();
    const isSelf = current && (current.id === userId || current.username === acc.username);
    revokeUserSessions(acc.id, acc.username);
    if (isSelf) {
      logout();
    }
    try {
      localStorage.setItem('apii_custom_accounts', JSON.stringify(DEMO_ACCOUNTS));
    } catch (e) { }
    return { username: acc.username, password: acc.password, fullName: acc.fullName, phone: acc.phone };
  }

  function normalizePhoneNumber(rawPhone) {
    const digits = String(rawPhone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) return '62' + digits.slice(1);
    return digits;
  }

  function resolveOfficerContact(role, tenantId, divisi = null) {
    const targetRole = String(role || 'ketua').toLowerCase();
    const targetTenant = tenantId || 'DPP_PUSAT';
    const activePool = DEMO_ACCOUNTS.filter(u => u.isActive !== false && u.isPengurus !== false && u.role !== 'kader_biasa');

    let match = null;
    if (targetRole === 'ketua_divisi' && divisi) {
      match = activePool.find(u => u.role === 'ketua_divisi' && u.tenantId === targetTenant && u.divisi === divisi)
        || activePool.find(u => u.role === 'ketua_divisi' && u.tenantId === 'DPP_PUSAT' && u.divisi === divisi);
    } else {
      match = activePool.find(u => u.role === targetRole && u.tenantId === targetTenant && (!divisi || u.divisi === divisi));
    }

    const tenantSettings = (typeof window !== 'undefined' && window.State && typeof window.State.getTenantSettings === 'function')
      ? window.State.getTenantSettings(targetTenant)
      : null;

    if (match) {
      let resolvedName = match.fullName;
      if (tenantSettings) {
        if (targetRole === 'ketua' && tenantSettings.ketuaNama && match.tenantId === targetTenant) {
          resolvedName = tenantSettings.ketuaNama;
        } else if (targetRole === 'sekretaris' && tenantSettings.sekretarisNama && match.tenantId === targetTenant) {
          resolvedName = tenantSettings.sekretarisNama;
        }
      }
      return {
        name: resolvedName,
        role: getRoleTitleByYurisdiksi(targetRole, match.tenantId, match.divisi || divisi),
        phone: normalizePhoneNumber(match.phone),
        tenantId: match.tenantId,
        divisi: match.divisi || divisi || null,
        email: match.email || ''
      };
    }

    if (targetRole === 'ketua_divisi' && divisi && typeof window !== 'undefined' && window.CONFIG && Array.isArray(window.CONFIG.DIVISIONS)) {
      const divDef = window.CONFIG.DIVISIONS.find(d => d.code === divisi);
      if (divDef) {
        return {
          name: divDef.head,
          role: getRoleTitleByYurisdiksi('ketua_divisi', targetTenant, divisi),
          phone: normalizePhoneNumber(divDef.phone),
          tenantId: targetTenant,
          divisi: divisi,
          email: ''
        };
      }
    }

    if (tenantSettings) {
      const fallbackName = targetRole === 'sekretaris'
        ? (tenantSettings.sekretarisNama || 'Sekretaris APII')
        : (tenantSettings.ketuaNama || 'Ketua APII');
      const fallbackPhone = normalizePhoneNumber(tenantSettings.kopTelepon)
        || normalizePhoneNumber((typeof window !== 'undefined' && window.CONFIG && Array.isArray(window.CONFIG.TENANTS) && (window.CONFIG.TENANTS.find(t => t.code === targetTenant) || {}).phone) || '6281358575678');
      return {
        name: fallbackName,
        role: getRoleTitleByYurisdiksi(targetRole, targetTenant, divisi),
        phone: fallbackPhone,
        tenantId: targetTenant,
        divisi: divisi || null,
        email: tenantSettings.kopEmail || ''
      };
    }

    const pusatMatch = activePool.find(u => u.role === targetRole && u.tenantId === 'DPP_PUSAT') || activePool[0];
    return {
      name: pusatMatch ? pusatMatch.fullName : 'Sekretariat Pusat APII',
      role: getRoleTitleByYurisdiksi(targetRole, 'DPP_PUSAT', divisi),
      phone: normalizePhoneNumber(pusatMatch ? pusatMatch.phone : '6281358575678'),
      tenantId: 'DPP_PUSAT',
      divisi: divisi || null,
      email: pusatMatch ? pusatMatch.email : ''
    };
  }

  return {
    init,
    login,
    loginAsUser,
    logout,
    isAuthenticated,
    getCurrentUser,
    hasPermission,
    canAccessWorkspace,
    isReadOnly,
    getRoleDutySummary,
    getAllAccounts,
    getRoleTitleByYurisdiksi,
    resolveOfficerContact,
    saveUser,
    toggleUserStatus,
    resetPassword,
    DEFAULT_PASSWORD,
    DEMO_ACCOUNTS
  };
})();

if (typeof window !== 'undefined') {
  window.Auth = Auth;
}

// Auto-run pada inisialisasi script
Auth.init();
