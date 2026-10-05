/**
 * ============================================================================
 * Auth.gs — Autentikasi, Sesi & Manajemen Pengguna
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
  if (user.is_active !== 'TRUE') {
    audit(username, 'LOGIN_FAILED', 'Akun nonaktif');
    return { ok: false, data: null, message: 'Akun Anda dinonaktifkan. Hubungi administrator.' };
  }
  if (user.password_hash !== hashPassword(password)) {
    audit(username, 'LOGIN_FAILED', 'Password salah');
    return { ok: false, data: null, message: 'Username atau password salah.' };
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
  if (!user || user.is_active !== 'TRUE') return null;
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
 * getAuditLogs: jejak audit (terbaru di atas). SUPERADMIN/KETUA/PENGAWAS.
 * @param {object} ctx.payload { limit (default 100) }
 */
function getAuditLogs(ctx) {
  var limit = Math.min(Number(ctx.payload.limit) || 100, 500);
  var logs = Database.readAll(TABS.AUDIT)
    .sort(function (a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); })
    .slice(0, limit)
    .map(function (l) {
      return { timestamp: l.timestamp, actor: l.actor, action: l.action, detail: l.detail };
    });
  return { ok: true, data: { logs: logs }, message: 'Jejak audit berhasil dimuat.' };
}
