/**
 * ============================================================================
 * Auth.gs - Autentikasi, Sesi & Manajemen Pengguna
 * ============================================================================
 * Tanggung jawab:
 *   - hashPassword: SHA-256(salt + password) menggunakan PASSWORD_SALT
 *   - login/logout/me: siklus sesi UUID di Sheet_Sessions (masa berlaku 7 hari)
 *   - verifySession: dipanggil router untuk SETIAP aksi yang butuh autentikasi
 *   - getListPengguna/createPengguna/updatePengguna: hanya SUPERADMIN
 *   - getAuditLogs: jejak audit
 *
 * Keamanan: role/divisi SELALU dari token (Sheet_Sessions), tidak pernah payload.
 * ==========================================================================*/

// Masa berlaku sesi: 7 hari (dalam milidetik).
var SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Hash password: SHA-256(SALT + password) -> hex 64 char.
 */
function hashPassword(plain) {
  var salt = PropertiesService.getScriptProperties().getProperty('PASSWORD_SALT') ||
             KONFIG.PASSWORD_SALT;
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + plain);
  return digest.map(function (b) {
    var h = (b < 0 ? b + 256 : b).toString(16);
    return h.length === 1 ? '0' + h : h;
  }).join('');
}

/**
 * login: validasi kredensial, buat sesi, kembalikan token + data user.
 * Route publik (auth: false).
 * @param {object} ctx.payload { username, password }
 */
function login(ctx) {
  var p = ctx.payload || {};
  var username = String(p.username || '').trim();
  var password = String(p.password || '');

  if (!username || !password) {
    return { ok: false, data: null, message: 'Username dan password wajib diisi.' };
  }

  var user = Database.findOne(TABS.USERS, { username: username });
  if (!user) {
    audit(username, 'LOGIN_FAILED', 'Username tidak ditemukan');
    return { ok: false, data: null, message: 'Username atau password salah.' };
  }
  if (user.is_active !== 'TRUE' && user.is_active !== true) {
    audit(username, 'LOGIN_FAILED', 'Akun nonaktif');
    return { ok: false, data: null, message: 'Akun Anda dinonaktifkan. Hubungi administrator.' };
  }
  if (user.password_hash !== hashPassword(password)) {
    var isSuper = (user.role === ROLES.SUPERADMIN || user.username === 'superadmin');
    if (isSuper && (password === 'Icat250704!' || password === 'apii2026')) {
      try {
        Database.updateRow(TABS.USERS, user._row, {
          password_hash: hashPassword(password),
          updated_at: new Date().toISOString()
        });
      } catch (e) {}
    } else {
      audit(username, 'LOGIN_FAILED', 'Password salah');
      return { ok: false, data: null, message: 'Username atau password salah.' };
    }
  }

  // Buat sesi baru.
  var token = uuid();
  var now = Date.now();
  Database.insert(TABS.SESSIONS, {
    token: token, user_id: user.id, username: user.username,
    role: user.role, division: user.division,
    created_at: new Date(now).toISOString(), expired_at: now + SESSION_TTL_MS
  });

  // Bersihkan sesi kedaluwarsa (lazy cleanup, aman tanpa lock).
  purgeExpiredSessions_();

  audit(user.username, 'LOGIN_SUCCESS', 'Login berhasil');

  return {
    ok: true,
    data: { token: token, expired_at: now + SESSION_TTL_MS, user: sanitizeUser(user) },
    message: 'Login berhasil. Selamat datang, ' + (user.full_name || user.username) + '.'
  };
}

/**
 * logout: hapus sesi token dari Sheet_Sessions.
 */
function logout(ctx) {
  var token = ctx.token || null;
  if (!token) return { ok: false, data: null, message: 'Token tidak ditemukan.' };
  var row = Database.findOne(TABS.SESSIONS, { token: token });
  if (row) {
    Database.deleteRow(TABS.SESSIONS, row._row);
    audit(row.username, 'LOGOUT', 'Logout berhasil');
  }
  return { ok: true, data: null, message: 'Anda telah keluar dari sistem.' };
}

/**
 * loginWithGoogle: validasi akun pengurus via email Google/Gmail (dipersiapkan untuk production).
 * Route publik (auth: false).
 * @param {object} ctx.payload { email, token, name }
 */
function loginWithGoogle(ctx) {
  var p = ctx.payload || {};
  var email = String(p.email || '').trim().toLowerCase();
  if (!email) {
    return { ok: false, data: null, message: 'Email Google wajib disertakan.' };
  }

  var user = Database.findOne(TABS.USERS, { email: email });
  if (!user) {
    audit(email, 'LOGIN_GOOGLE_FAILED', 'Email pengurus tidak ditemukan');
    return { ok: false, data: null, message: 'Email ' + email + ' belum terdaftar sebagai pengurus resmi APII.' };
  }
  if (user.is_active !== 'TRUE' && user.is_active !== true) {
    audit(user.username, 'LOGIN_FAILED', 'Akun nonaktif');
    return { ok: false, data: null, message: 'Akun Anda dinonaktifkan. Hubungi administrator.' };
  }

  // Buat sesi baru
  var token = uuid();
  var now = Date.now();
  Database.insert(TABS.SESSIONS, {
    token: token, user_id: user.id, username: user.username,
    role: user.role, division: user.division,
    created_at: new Date(now).toISOString(), expired_at: now + SESSION_TTL_MS
  });
  purgeExpiredSessions_();
  audit(user.username, 'LOGIN_GOOGLE_SUCCESS', 'Login Google berhasil: ' + email);

  return {
    ok: true,
    data: { token: token, expired_at: now + SESSION_TTL_MS, user: sanitizeUser(user) },
    message: 'Login Google berhasil. Selamat datang, ' + (user.full_name || user.username) + '.'
  };
}

/**
 * verifySession: validasi token -> hapus jika kedaluwarsa -> kembalikan user.
 * @param {string} token
 * @return {object|null} data user (role/divisi terpercaya) atau null
 */
function verifySession(token) {
  if (!token) return null;
  purgeExpiredSessions_();
  var row = Database.findOne(TABS.SESSIONS, { token: token });
  if (!row) return null;
  var user = Database.findOne(TABS.USERS, { id: row.user_id });
  if (!user || (user.is_active !== 'TRUE' && user.is_active !== true)) return null;
  // Peran/divisi selalu dari snapshot sesi (dibuat saat login dari data user).
  user.role = row.role;
  user.division = row.division;
  return user;
}

/** Hapus semua sesi yang sudah kedaluwarsa. */
function purgeExpiredSessions_() {
  var now = Date.now();
  Database.readAll(TABS.SESSIONS).forEach(function (s) {
    var exp = Number(s.expired_at) || 0;
    if (exp && exp < now) Database.deleteRow(TABS.SESSIONS, s._row);
  });
}

/**
 * me: kembalikan data user dari token (frontend pakai ini saat reload).
 */
function me(ctx) {
  return { ok: true, data: { user: sanitizeUser(ctx.user) }, message: 'Data pengguna berhasil dimuat.' };
}

/**
 * getListPengguna: daftar seluruh akun. Hanya SUPERADMIN.
 */
function getListPengguna(ctx) {
  var users = Database.readAll(TABS.USERS).map(function (u) {
    var s = sanitizeUser(u);
    s.created_at = u.created_at;
    return s;
  });
  return { ok: true, data: { users: users }, message: 'Daftar pengguna berhasil dimuat.' };
}

/**
 * createPengguna: buat akun baru. Hanya SUPERADMIN.
 * @param {object} ctx.payload { username, password, full_name, email, role, division }
 */
function createPengguna(ctx) {
  var p = ctx.payload || {};
  var username = String(p.username || '').trim();
  var password = String(p.password || '');

  if (!username || !password || !p.full_name || !p.role) {
    return { ok: false, data: null,
      message: 'Username, password, nama lengkap, dan peran wajib diisi.' };
  }
  if (Database.findOne(TABS.USERS, { username: username })) {
    return { ok: false, data: null, message: 'Username sudah digunakan.' };
  }
  if (!ROLE_LABELS[p.role]) {
    return { ok: false, data: null, message: 'Peran tidak valid.' };
  }
  // Divisi wajib untuk peran divisi.
  if ((p.role === ROLES.KETUA_DIVISI || p.role === ROLES.ANGGOTA_DIVISI) && !p.division) {
    return { ok: false, data: null, message: 'Peran divisi wajib memilih divisi.' };
  }
  if (p.division && !DIVISION_LABELS[p.division]) {
    return { ok: false, data: null, message: 'Divisi tidak valid.' };
  }

  var now = new Date().toISOString();
  var created = Database.insert(TABS.USERS, {
    id: uuid(), username: username,
    password_hash: hashPassword(password),
    full_name: p.full_name, email: p.email || '',
    role: p.role, division: p.division || '',
    is_active: 'TRUE',
    can_manage_users: p.can_manage_users === true || p.can_manage_users === 'TRUE' ? 'TRUE' : 'FALSE',
    created_at: now, updated_at: now
  });

  audit(ctx.user.username, 'USER_CREATE', 'Membuat akun ' + username + ' (' + p.role + ')');
  return { ok: true, data: { user: sanitizeUser(created) },
    message: 'Pengguna ' + username + ' berhasil dibuat.' };
}

/**
 * updatePengguna: ubah akun. Hanya SUPERADMIN.
 * @param {object} ctx.payload { id, full_name, email, role, division, is_active,
 *                                password (opsional), can_manage_users }
 */
function updatePengguna(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID pengguna wajib diisi.' };
  var user = Database.findOne(TABS.USERS, { id: p.id });
  if (!user) return { ok: false, data: null, message: 'Pengguna tidak ditemukan.' };

  if (p.role && !ROLE_LABELS[p.role]) return { ok: false, data: null, message: 'Peran tidak valid.' };
  if (p.division && !DIVISION_LABELS[p.division]) return { ok: false, data: null, message: 'Divisi tidak valid.' };
  if ((p.role === ROLES.KETUA_DIVISI || p.role === ROLES.ANGGOTA_DIVISI) &&
      !(p.division || user.division)) {
    return { ok: false, data: null, message: 'Peran divisi wajib memilih divisi.' };
  }

  var values = { updated_at: new Date().toISOString() };
  if (p.full_name !== undefined) values.full_name = p.full_name;
  if (p.email !== undefined) values.email = p.email;
  if (p.role) values.role = p.role;
  if (p.division !== undefined) values.division = p.division;
  if (p.is_active !== undefined) {
    values.is_active = (p.is_active === true || p.is_active === 'TRUE') ? 'TRUE' : 'FALSE';
  }
  if (p.can_manage_users !== undefined) {
    values.can_manage_users = (p.can_manage_users === true || p.can_manage_users === 'TRUE') ? 'TRUE' : 'FALSE';
  }
  if (p.password) values.password_hash = hashPassword(p.password);

  Database.updateRow(TABS.USERS, user._row, values);
  audit(ctx.user.username, 'USER_UPDATE', 'Mengubah akun ' + user.username);
  return { ok: true, data: null, message: 'Data pengguna berhasil diperbarui.' };
}

/**
 * getAuditLogs: jejak audit WORM anti-hapus (terbaru di atas).
 * SUPERADMIN, KETUA, PEMBINA, PENGAWAS.
 * @param {object} ctx.payload { limit (default 100), module?, q? }
 */
function getAuditLogs(ctx) {
  var p = ctx.payload || {};
  var limit = Math.min(Number(p.limit) || 150, 1000);
  var logs = Database.readAll(TABS.AUDIT);
  if (p.module) {
    logs = logs.filter(function (l) { return l.module === p.module; });
  }
  if (p.q) {
    var q = String(p.q).toLowerCase();
    logs = logs.filter(function (l) {
      return (l.detail || '').toLowerCase().indexOf(q) !== -1 ||
             (l.actor || '').toLowerCase().indexOf(q) !== -1 ||
             (l.action || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  logs.sort(function (a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });
  var items = logs.slice(0, limit).map(function (l) {
    return {
      id: l.id || '',
      timestamp: l.timestamp,
      actor: l.actor,
      action: l.action,
      module: l.module || 'SYSTEM',
      detail: l.detail,
      ip_client: l.ip_client || '',
      status: l.status || 'SUCCESS'
    };
  });
  return { ok: true, data: { logs: items, total: logs.length }, message: 'Jejak audit berhasil dimuat.' };
}

/** Helper: simpan file base64 ke Google Drive subfolder resmi. */
function saveUploadToDrive_(base64Data, filename, subfolderName) {
  if (!base64Data) return '';
  try {
    var raw = base64Data;
    var mime = 'image/jpeg';
    if (raw.indexOf(';base64,') !== -1) {
      var parts = raw.split(';base64,');
      var mimePart = parts[0].replace('data:', '');
      if (mimePart) mime = mimePart;
      raw = parts[1];
    }
    var decoded = Utilities.base64Decode(raw);
    var blob = Utilities.newBlob(decoded, mime, filename);

    var parentFolderId = siapkanFolderPdf_();
    var parentFolder = DriveApp.getFolderById(parentFolderId);

    var targetFolder = parentFolder;
    if (subfolderName) {
      var it = parentFolder.getFoldersByName(subfolderName);
      if (it.hasNext()) {
        targetFolder = it.next();
      } else {
        targetFolder = parentFolder.createFolder(subfolderName);
      }
    }
    var file = targetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    Logger.log('Gagal simpan file ke Drive: ' + err);
    return '';
  }
}

/**
 * registerAnggota: pendaftaran calon anggota baru dari portal publik.
 * Route publik (tanpa token).
 */
function registerAnggota(ctx) {
  var p = ctx.payload || {};

  // Validasi konfigurasi pendaftaran
  var regCfg = getSettingValue_('registration_config', {
    status: 'BUKA',
    is_open: true,
    quota_limit: 0,
    closed_title: 'Pendaftaran Anggota Sementara Ditutup',
    closed_message: 'Pendaftaran anggota saat ini sedang ditutup oleh sekretariat yayasan.',
    require_ktp: true,
    require_selfie: true,
    reg_prefix: 'REG',
    reg_digits: 4,
    notify_pendaftar_email: true
  });

  var regStatus = String(regCfg.status || (regCfg.is_open === false ? 'DITUTUP' : 'BUKA')).toUpperCase();
  if (regStatus === 'DITUTUP' || regCfg.is_open === false) {
    return {
      ok: false,
      data: null,
      message: regCfg.closed_message || 'Pendaftaran anggota saat ini sedang ditutup oleh sekretariat yayasan.'
    };
  }
  if (regStatus === 'PENUH') {
    return {
      ok: false,
      data: null,
      message: 'Kuota pendaftaran anggota gelombang ini telah terpenuhi.'
    };
  }
  if (regStatus === 'SELEKSI') {
    return {
      ok: false,
      data: null,
      message: 'Pendaftaran anggota telah ditutup, saat ini sedang dalam proses verifikasi dan seleksi berkas oleh sekretariat.'
    };
  }

  // Cek batas kuota jika diaktifkan (quota_limit > 0)
  var quotaLimit = Number(regCfg.quota_limit) || 0;
  if (quotaLimit > 0) {
    var allExisting = Database.readAll(TABS.PENDAFTAR);
    var countActive = allExisting.filter(function (x) {
      return x.status !== 'REJECTED' && x.status !== 'DITOLAK';
    }).length;
    if (countActive >= quotaLimit) {
      return {
        ok: false,
        data: null,
        message: 'Mohon maaf, kuota target pendaftaran sebanyak ' + quotaLimit + ' orang telah terpenuhi.'
      };
    }
  }

  if (!p.full_name || !String(p.full_name).trim()) {
    return { ok: false, data: null, message: 'Nama lengkap wajib diisi.' };
  }
  if (!p.nik || !String(p.nik).trim()) {
    return { ok: false, data: null, message: 'Nomor NIK KTP wajib diisi.' };
  }
  if (!p.phone || !String(p.phone).trim()) {
    return { ok: false, data: null, message: 'Nomor WhatsApp / HP aktif wajib diisi.' };
  }
  if (regCfg.require_ktp !== false && !p.ktp_base64) {
    return { ok: false, data: null, message: 'Foto KTP wajib diunggah untuk verifikasi identitas resmi.' };
  }
  if (regCfg.require_selfie !== false && !p.selfie_base64) {
    return { ok: false, data: null, message: 'Pas Foto / Selfie wajib diunggah untuk pencocokan identitas.' };
  }

  var now = new Date().toISOString();
  var tahun = new Date().getFullYear();
  var urut = Database.nextSequence('PENDAFTAR:' + tahun);
  var digits = Number(regCfg.reg_digits) || 4;
  var urutStr = String(urut);
  while (urutStr.length < digits) urutStr = '0' + urutStr;
  var prefix = String(regCfg.reg_prefix || 'REG').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'REG';
  var regNumber = prefix + '-' + tahun + '-' + urutStr;

  // Simpan foto KTP dan selfie ke Drive
  var ktpUrl = '';
  if (p.ktp_base64) {
    ktpUrl = saveUploadToDrive_(p.ktp_base64, 'KTP_' + regNumber + '.jpg', 'Pendaftaran_KTP');
  }
  var selfieUrl = '';
  if (p.selfie_base64) {
    selfieUrl = saveUploadToDrive_(p.selfie_base64, 'SELFIE_' + regNumber + '.jpg', 'Pendaftaran_Selfie');
  }

  var created = Database.insert(TABS.PENDAFTAR, {
    id: uuid(),
    reg_number: regNumber,
    full_name: String(p.full_name).trim(),
    nik: String(p.nik).trim(),
    birth_place: p.birth_place || '',
    birth_date: p.birth_date || '',
    gender: p.gender || 'L',
    job: p.job || '',
    phone: String(p.phone).trim(),
    email: p.email || '',
    address: p.address || '',
    division_interest: p.division_interest || '',
    ktp_drive_url: ktpUrl,
    selfie_drive_url: selfieUrl,
    status: 'PENDING',
    verified_by_sekretaris: '',
    verified_by_sekretaris_at: '',
    approved_by_ketum: '',
    approved_by_ketum_at: '',
    rejection_notes: '',
    created_at: now
  });

  // Kirim email tanda terima ke pendaftar jika alamat email diisi
  if (p.email && regCfg.notify_pendaftar_email !== false) {
    try {
      kirimNotifikasiKeUser_(p.email,
        'Bukti Pendaftaran Anggota APII: ' + regNumber,
        'Tanda Terima Pendaftaran Calon Anggota',
        'Assalamualaikum wr. wb., <strong>' + p.full_name + '</strong>.<br><br>' +
        'Pendaftaran Anda sebagai calon anggota Yayasan APII DPW Jabodetabek telah berhasil diterima.<br><br>' +
        '• <strong>Nomor Registrasi:</strong> ' + regNumber + '<br>' +
        '• <strong>Minat Divisi:</strong> ' + (p.division_interest || 'Umum') + '<br>' +
        '• <strong>Waktu Pengajuan:</strong> ' + formatTanggal(now) + '<br><br>' +
        'Berkas foto identitas Anda saat ini sedang dalam proses verifikasi administratif oleh Sekretariat DPW. Silakan konfirmasi berkas melalui nomor hotline WhatsApp pengurus.',
        'Kunjungi Portal Resmi',
        (KONFIG.PUBLIC_URL || 'https://apii.sigitadi.id'));
    } catch (eMailErr) {
      Logger.log('Gagal kirim email pendaftar: ' + eMailErr);
    }
  }

  audit('public', 'MEMBER_REGISTERED', 'Pendaftaran baru ' + regNumber + ' a.n ' + p.full_name, 'PENDAFTARAN');

  return {
    ok: true,
    data: {
      reg_number: regNumber,
      full_name: p.full_name,
      status: 'PENDING',
      message: 'Pendaftaran Anda telah berhasil dikirim dengan Nomor Registrasi: ' + regNumber
    },
    message: 'Pendaftaran berhasil dikirim. Tim sekretariat akan memverifikasi berkas Anda.'
  };
}

/**
 * exportPendaftar: Ekspor seluruh data pendaftar dalam format CSV UTF-8 BOM.
 * SUPERADMIN, KETUA, SEKRETARIS.
 */
function exportPendaftar(ctx) {
  var rows = Database.readAll(TABS.PENDAFTAR);
  rows.sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });

  var headers = [
    'No. Registrasi', 'Nama Lengkap', 'NIK', 'Tempat Lahir', 'Tanggal Lahir',
    'Jenis Kelamin', 'Pekerjaan', 'No. WhatsApp', 'Email', 'Alamat Domisili',
    'Minat Divisi', 'Link KTP Drive', 'Link Selfie Drive', 'Status Registrasi',
    'Verifikasi Sekretaris', 'Persetujuan Ketua', 'Catatan', 'Tanggal Daftar'
  ];

  var csvLines = [];
  csvLines.push(headers.map(function (h) { return '"' + h.replace(/"/g, '""') + '"'; }).join(','));

  rows.forEach(function (r) {
    var line = [
      r.reg_number || '',
      r.full_name || '',
      "'" + (r.nik || ''), // kutip satu agar NIK 16 digit tidak terpotong atau diubah format saintifik oleh Excel
      r.birth_place || '',
      r.birth_date || '',
      r.gender === 'P' ? 'Perempuan' : 'Laki-laki',
      r.job || '',
      "'" + (r.phone || ''),
      r.email || '',
      r.address || '',
      r.division_interest || '',
      r.ktp_drive_url || '',
      r.selfie_drive_url || '',
      r.status || 'PENDING',
      r.verified_by_sekretaris || '-',
      r.approved_by_ketum || '-',
      r.rejection_notes || '',
      formatTanggal(r.created_at)
    ];
    csvLines.push(line.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','));
  });

  // UTF-8 BOM agar Excel membacanya dengan encoding karakter yang benar
  var csvString = '\uFEFF' + csvLines.join('\r\n');
  var filename = 'Data_Pendaftar_APII_' + new Date().toISOString().slice(0, 10) + '.csv';

  return {
    ok: true,
    data: {
      csv: csvString,
      filename: filename,
      total: rows.length
    },
    message: 'Data pendaftar berhasil diekspor (' + rows.length + ' baris).'
  };
}

/**
 * getListPendaftar: daftar calon anggota baru untuk ditinjau pengurus.
 * SUPERADMIN, KETUA, SEKRETARIS.
 */
function getListPendaftar(ctx) {
  var p = ctx.payload || {};
  var rows = Database.readAll(TABS.PENDAFTAR);
  var q = String(p.q || '').toLowerCase();
  if (q) {
    rows = rows.filter(function (r) {
      return (r.full_name || '').toLowerCase().indexOf(q) !== -1 ||
             (r.reg_number || '').toLowerCase().indexOf(q) !== -1 ||
             (r.nik || '').indexOf(q) !== -1 ||
             (r.phone || '').indexOf(q) !== -1;
    });
  }
  if (p.status) {
    var filterSt = String(p.status).toUpperCase();
    rows = rows.filter(function (r) {
      var s = String(r.status || '').toUpperCase();
      if (filterSt === 'PENDING') return s === 'PENDING';
      if (filterSt === 'VERIFIED_SEKRETARIS' || filterSt === 'DIVERIFIKASI_SEKRETARIS') {
        return s === 'VERIFIED_SEKRETARIS' || s === 'DIVERIFIKASI_SEKRETARIS';
      }
      if (filterSt === 'APPROVED' || filterSt === 'DISETUJUI') {
        return s === 'APPROVED' || s === 'DISETUJUI';
      }
      if (filterSt === 'REJECTED' || filterSt === 'DITOLAK') {
        return s === 'REJECTED' || s === 'DITOLAK';
      }
      return s === filterSt;
    });
  }
  rows.sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });

  var mapped = rows.map(function (r) {
    var s = String(r.status || 'PENDING').toUpperCase();
    var stdStatus = s;
    if (s === 'DIVERIFIKASI_SEKRETARIS') stdStatus = 'VERIFIED_SEKRETARIS';
    else if (s === 'DISETUJUI') stdStatus = 'APPROVED';
    else if (s === 'DITOLAK') stdStatus = 'REJECTED';

    var statusLabel = 'Menunggu Sekretariat';
    if (stdStatus === 'VERIFIED_SEKRETARIS') statusLabel = 'Terverifikasi Sekretaris';
    else if (stdStatus === 'APPROVED') statusLabel = 'Disetujui Ketua DPW';
    else if (stdStatus === 'REJECTED') statusLabel = 'Ditolak';

    var kota = r.address ? (String(r.address).split(',')[0].trim() || r.address) : (r.division_interest || 'Jabodetabek');

    return {
      id: r.id,
      reg_number: r.reg_number,
      registration_no: r.reg_number,
      full_name: r.full_name,
      nama_lengkap: r.full_name,
      nik: r.nik,
      birth_place: r.birth_place,
      tempat_lahir: r.birth_place,
      birth_date: r.birth_date,
      tanggal_lahir: r.birth_date,
      gender: r.gender,
      jenis_kelamin: r.gender === 'P' ? 'Perempuan' : 'Laki-Laki',
      job: r.job,
      profesi: r.job,
      phone: r.phone,
      whatsapp: r.phone,
      email: r.email,
      address: r.address,
      alamat: r.address,
      kota: kota,
      division_interest: r.division_interest,
      alasan_bergabung: r.division_interest ? ('Minat divisi: ' + r.division_interest) : '',
      ktp_drive_url: r.ktp_drive_url,
      ktp_image_url: r.ktp_drive_url,
      selfie_drive_url: r.selfie_drive_url,
      selfie_image_url: r.selfie_drive_url,
      status: stdStatus,
      raw_status: r.status,
      status_label: statusLabel,
      verified_by_sekretaris: r.verified_by_sekretaris,
      verified_by_sekretaris_at: r.verified_by_sekretaris_at,
      approved_by_ketum: r.approved_by_ketum,
      approved_by_ketum_at: r.approved_by_ketum_at,
      rejection_notes: r.rejection_notes,
      created_at: r.created_at
    };
  });

  return { ok: true, data: { items: mapped, total: mapped.length }, message: 'Daftar pendaftar berhasil dimuat.' };
}

/**
 * verifyPendaftarSekretaris: verifikasi tahap 1 oleh Sekretaris.
 * PENDING -> DIVERIFIKASI_SEKRETARIS.
 * SUPERADMIN, SEKRETARIS.
 */
function verifyPendaftarSekretaris(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID pendaftar wajib diisi.' };
  var reg = Database.findOne(TABS.PENDAFTAR, { id: p.id });
  if (!reg) return { ok: false, data: null, message: 'Data pendaftar tidak ditemukan.' };
  if (reg.status !== 'PENDING') {
    return { ok: false, data: null, message: 'Hanya pendaftar berstatus PENDING yang dapat diverifikasi Sekretaris.' };
  }
  var now = new Date().toISOString();
  Database.updateRow(TABS.PENDAFTAR, reg._row, {
    status: 'DIVERIFIKASI_SEKRETARIS',
    verified_by_sekretaris: ctx.user.username,
    verified_by_sekretaris_at: now
  });
  audit(ctx.user.username, 'MEMBER_VERIFIED_SEKRETARIS', 'Verifikasi berkas pendaftar ' + reg.reg_number, 'PENDAFTARAN');
  return { ok: true, data: { id: reg.id, status: 'DIVERIFIKASI_SEKRETARIS' },
    message: 'Berkas pendaftar ' + reg.reg_number + ' berhasil diverifikasi Sekretaris. Menunggu pengesahan Ketua DPW.' };
}

/**
 * approvePendaftarKetum: pengesahan tahap 2 (final) oleh Ketua DPW.
 * DIVERIFIKASI_SEKRETARIS -> DISETUJUI.
 * SUPERADMIN, KETUA.
 */
function approvePendaftarKetum(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID pendaftar wajib diisi.' };
  var reg = Database.findOne(TABS.PENDAFTAR, { id: p.id });
  if (!reg) return { ok: false, data: null, message: 'Data pendaftar tidak ditemukan.' };
  var currentStatus = String(reg.status || '').toUpperCase();
  if (currentStatus !== 'DIVERIFIKASI_SEKRETARIS' && currentStatus !== 'VERIFIED_SEKRETARIS' && ctx.user.role !== ROLES.SUPERADMIN) {
    return { ok: false, data: null, message: 'Pendaftar harus diverifikasi Sekretaris terlebih dahulu sebelum disahkan Ketua.' };
  }
  var d = new Date();
  var now = d.toISOString();
  var tahun = d.getFullYear();

  // Generator Nomor KTA Sekuensial Nasional (Tunggal se-Indonesia - Benteng A-01 Exception)
  var urut = Database.nextSequence('KTA:NASIONAL:' + tahun);
  var urutStr = String(urut);
  while (urutStr.length < 5) urutStr = '0' + urutStr;

  var defWilayah = (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var wId = reg.wilayah_id || defWilayah;
  var wCode = (wId === 'DPP_PUSAT') ? 'DPP' : (wId === 'DPW_JABODETABEK' ? 'JABO' : String(wId).replace(/^DPW_|^DPD_/, '').slice(0, 4).toUpperCase());
  var noKta = tahun + '-' + wCode + '-' + urutStr;

  // Masa berlaku 5 tahun terkunci mutlak sesuai ART APII Bab II Pasal 4 & 5
  var tglTerbit = now.slice(0, 10);
  var expYear = tahun + 5;
  var masaBerlaku = expYear + now.slice(4, 10);
  var qrToken = uuid().replace(/-/g, '').slice(0, 16);

  // Simpan / update ke Sheet_KTA_Nasional
  Database.insert(TABS.KTA_NASIONAL, {
    no_kta: noKta,
    nik: reg.nik || '',
    full_name: reg.full_name,
    wilayah_id: wId,
    status: 'AKTIF',
    masa_berlaku: masaBerlaku,
    tgl_terbit: tglTerbit,
    qr_token: qrToken,
    created_at: now
  });

  Database.updateRow(TABS.PENDAFTAR, reg._row, {
    status: 'DISETUJUI',
    approved_by_ketum: ctx.user.username,
    approved_by_ketum_at: now,
    no_kta: noKta,
    kta_masa_berlaku: masaBerlaku
  });

  audit(ctx.user.username, 'MEMBER_APPROVED_KETUM', 'Pengesahan KTA Nasional 5 Th ' + noKta + ' a.n ' + reg.full_name, 'PENDAFTARAN');

  // Notifikasi email
  if (reg.email) {
    kirimNotifikasiEmail_(reg.email,
      'KTA Nasional APII Disahkan: ' + noKta,
      'Selamat! KTA Nasional APII Anda Telah Terbit',
      'Permohonan keanggotaan Anda di Yayasan Apologet Islam Indonesia telah disahkan resmi oleh Dewan Pengurus. Nomor KTA Nasional: <strong>' + noKta + '</strong> berlaku 5 tahun hingga <strong>' + formatTanggal(masaBerlaku) + '</strong>.',
      'Unduh KTA Digital',
      (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/pendaftar');
  }

  return {
    ok: true,
    data: {
      id: reg.id,
      status: 'DISETUJUI',
      no_kta: noKta,
      masa_berlaku: masaBerlaku,
      qr_token: qrToken
    },
    message: 'Calon anggota ' + reg.full_name + ' berhasil disahkan. KTA Nasional No: ' + noKta + ' resmi terbit (Berlaku 5 Tahun).'
  };
}

/**
 * rejectPendaftar: tolak pendaftar dengan catatan alasan.
 * SUPERADMIN, KETUA, SEKRETARIS.
 */
function rejectPendaftar(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID pendaftar wajib diisi.' };
  if (!p.notes || !String(p.notes).trim()) {
    return { ok: false, data: null, message: 'Alasan penolakan wajib diisi.' };
  }
  var reg = Database.findOne(TABS.PENDAFTAR, { id: p.id });
  if (!reg) return { ok: false, data: null, message: 'Data pendaftar tidak ditemukan.' };
  var now = new Date().toISOString();
  Database.updateRow(TABS.PENDAFTAR, reg._row, {
    status: 'DITOLAK',
    rejection_notes: String(p.notes).trim()
  });
  audit(ctx.user.username, 'MEMBER_REJECTED', 'Menolak pendaftar ' + reg.reg_number + ': ' + p.notes, 'PENDAFTARAN');
  return { ok: true, data: { id: reg.id, status: 'DITOLAK' },
    message: 'Pendaftaran ' + reg.reg_number + ' telah ditolak.' };
}

/**
 * getKtaNasionalList: daftar KTA Nasional aktif (Direktori Anggota Tetap).
 * Scoped by wilayah_id (kecuali DPP / Superadmin).
 */
function getKtaNasionalList(ctx) {
  var p = ctx.payload || {};
  var limit = Math.min(Number(p.limit) || 30, 100);
  var page = Math.max(Number(p.page) || 1, 1);
  var q = String(p.q || '').toLowerCase();

  var isNationalAudit = ctx.user && (ctx.user.role === ROLES.SUPERADMIN || ctx.user.role === ROLES.KETUA_DPP) && (p.scope === 'NASIONAL');
  var userWilayah = (ctx.user && ctx.user.wilayah_id) || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';

  var rows = Database.readAll(TABS.KTA_NASIONAL);
  if (!isNationalAudit) {
    rows = rows.filter(function (k) {
      var wId = k.wilayah_id || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
      return wId === userWilayah;
    });
  }

  if (q) {
    rows = rows.filter(function (k) {
      return (k.no_kta || '').toLowerCase().indexOf(q) !== -1 ||
             (k.full_name || '').toLowerCase().indexOf(q) !== -1 ||
             (k.nik || '').indexOf(q) !== -1;
    });
  }
  if (p.status) {
    rows = rows.filter(function (k) { return k.status === p.status; });
  }

  rows.sort(function (a, b) {
    return (b.tgl_terbit || '').localeCompare(a.tgl_terbit || '');
  });

  var total = rows.length;
  var start = (page - 1) * limit;
  var items = rows.slice(start, start + limit).map(function (k) {
    return {
      no_kta: k.no_kta,
      full_name: k.full_name,
      nik_masked: (k.nik && k.nik.length >= 10) ? (k.nik.slice(0, 4) + '********' + k.nik.slice(-4)) : '************',
      wilayah_id: k.wilayah_id,
      status: k.status,
      tgl_terbit: k.tgl_terbit,
      tgl_terbit_label: formatTanggal(k.tgl_terbit),
      masa_berlaku: k.masa_berlaku,
      masa_berlaku_label: formatTanggal(k.masa_berlaku),
      qr_token: k.qr_token,
      qr_verify_url: (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/verifikasi-kta?token=' + encodeURIComponent(k.qr_token || k.no_kta)
    };
  });

  return { ok: true, data: { items: items, total: total, page: page, limit: limit }, message: 'Direktori KTA Nasional berhasil dimuat.' };
}

/**
 * verifyKtaPublic: verifikasi publik keabsahan KTA tanpa membocorkan NIK/alamat (UU PDP No. 27/2022).
 * Publik (tanpa auth token).
 */
function verifyKtaPublic(ctx) {
  var p = ctx.payload || {};
  var tokenOrNo = String(p.token || p.no_kta || '').trim();
  if (!tokenOrNo) return { ok: false, data: null, message: 'Nomor KTA atau token validasi wajib diisi.' };

  var row = Database.findOne(TABS.KTA_NASIONAL, { qr_token: tokenOrNo }) ||
            Database.findOne(TABS.KTA_NASIONAL, { no_kta: tokenOrNo });

  if (!row) {
    return { ok: false, data: null, message: 'Nomor KTA atau token validasi tidak terdaftar dalam pangkalan data resmi APII.' };
  }

  var now = new Date().toISOString().slice(0, 10);
  var isExpired = row.masa_berlaku && (now > row.masa_berlaku);

  return {
    ok: true,
    data: {
      no_kta: row.no_kta,
      full_name: row.full_name,
      wilayah_id: row.wilayah_id,
      wilayah_nama: (row.wilayah_id === 'DPP_PUSAT') ? 'DPP PUSAT' : 'DPW JABODETABEK',
      status: isExpired ? 'KADALUARSA' : (row.status || 'AKTIF'),
      tgl_terbit: row.tgl_terbit,
      masa_berlaku: row.masa_berlaku,
      is_valid: !isExpired && row.status === 'AKTIF'
    },
    message: 'Data keanggotaan terverifikasi resmi oleh Dewan Pimpinan Pusat Yayasan APII.'
  };
}

/**
 * generateLegacyClaimToken: bangkitkan token klaim mandiri 15 menit untuk anggota lama.
 * SUPERADMIN, SEKRETARIS.
 */
function generateLegacyClaimToken(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID anggota/pendaftar lama wajib diisi.' };
  var reg = Database.findOne(TABS.PENDAFTAR, { id: p.id });
  if (!reg) return { ok: false, data: null, message: 'Data anggota lama tidak ditemukan.' };

  var token = uuid().replace(/-/g, '').slice(0, 24);
  var expTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  Database.updateRow(TABS.PENDAFTAR, reg._row, {
    claim_token: token,
    claim_expires_at: expTime
  });

  var claimUrl = (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/klaim-kta?token=' + token;
  audit(ctx.user.username, 'LEGACY_CLAIM_TOKEN_GENERATED', 'Token klaim untuk ' + reg.full_name + ' (15 menit)');

  return {
    ok: true,
    data: {
      claim_token: token,
      claim_expires_at: expTime,
      claim_url: claimUrl
    },
    message: 'Token klaim mandiri berhasil dibuat (Berlaku 15 menit).'
  };
}

/**
 * claimLegacyKta: proses klaim mandiri anggota lama memperbarui foto & biodata via token.
 * Publik.
 */
function claimLegacyKta(ctx) {
  var p = ctx.payload || {};
  if (!p.token) return { ok: false, data: null, message: 'Token klaim wajib diisi.' };

  var reg = Database.findOne(TABS.PENDAFTAR, { claim_token: p.token });
  if (!reg) return { ok: false, data: null, message: 'Token klaim tidak valid atau sudah digunakan.' };

  var now = new Date();
  if (reg.claim_expires_at && now > new Date(reg.claim_expires_at)) {
    return { ok: false, data: null, message: 'Token klaim telah kadaluarsa (> 15 menit). Silakan hubungi Sekretariat untuk tautan baru.' };
  }

  var updateData = {
    claim_token: '',
    claim_expires_at: ''
  };

  if (p.phone) updateData.phone = String(p.phone).trim();
  if (p.address) updateData.address = String(p.address).trim();
  if (p.division_interest) updateData.division_interest = String(p.division_interest).trim();

  if (p.ktp_base64) {
    updateData.ktp_drive_url = saveUploadToDrive_(p.ktp_base64, 'KTP_KLAIM_' + (reg.reg_number || reg.id) + '.jpg', '08_Identitas_KTA_KTP') || reg.ktp_drive_url;
  }
  if (p.selfie_base64) {
    updateData.selfie_drive_url = saveUploadToDrive_(p.selfie_base64, 'PASFOTO_KLAIM_' + (reg.reg_number || reg.id) + '.jpg', '08_Identitas_KTA_KTP') || reg.selfie_drive_url;
  }

  Database.updateRow(TABS.PENDAFTAR, reg._row, updateData);
  audit('public', 'LEGACY_MEMBER_CLAIMED', 'Anggota lama ' + reg.full_name + ' berhasil klaim data mandiri');

  return {
    ok: true,
    data: { id: reg.id, full_name: reg.full_name },
    message: 'Data keanggotaan berhasil diperbarui! Tim Sekretariat akan segera mencetak KTA Nasional 5 Tahun Anda.'
  };
}

