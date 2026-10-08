/**
 * ============================================================================
 * Code.gs — Router Utama & Pintu Masuk Web App
 * Yayasan APII DPW Jabodetabek — Sistem Informasi & Administrasi Terpadu
 * ============================================================================
 * Tanggung jawab:
 *   - doGet / doPost: parsing request (action, token, payload)
 *   - Tabel ROUTES: single source of truth RBAC (action -> auth, roles, handler)
 *   - Dispatch ke handler modul domain (Auth/Surat/Keuangan/Divisi)
 *   - Membungkus hasil ke envelope { success, data, message }
 * DILARANG: menulis logika domain di file ini.
 * ==========================================================================*/

// 8 peran pengurus sistem (khusus pengurus yayasan)
var ROLES = {
  SUPERADMIN: 'SUPERADMIN', KETUA: 'KETUA', SEKRETARIS: 'SEKRETARIS',
  BENDAHARA: 'BENDAHARA', PEMBINA: 'PEMBINA', PENGAWAS: 'PENGAWAS',
  KETUA_DIVISI: 'KETUA_DIVISI', ANGGOTA_DIVISI: 'ANGGOTA_DIVISI'
};

// Peran read-only mutlak: Pembina & Pengawas (tidak ada aksi tulis).
var ROLES_READONLY = [ROLES.PEMBINA, ROLES.PENGAWAS];

// 7 divisi kerja
var DIVISIONS = {
  DIV_HUMAS: 'DIV_HUMAS', DIV_LITBANG: 'DIV_LITBANG', DIV_SOSMED: 'DIV_SOSMED',
  DIV_DAKWAH: 'DIV_DAKWAH', DIV_INVESTASI: 'DIV_INVESTASI', DIV_HUKUM: 'DIV_HUKUM',
  DIV_UMUM: 'DIV_UMUM'
};

// Label tampilan divisi (Bahasa Indonesia)
var DIVISION_LABELS = {
  DIV_HUMAS: 'Hubungan Masyarakat', DIV_LITBANG: 'Penelitian & Pengembangan',
  DIV_SOSMED: 'Media Sosial', DIV_DAKWAH: 'Dakwah', DIV_INVESTASI: 'Investasi',
  DIV_HUKUM: 'Hukum', DIV_UMUM: 'Umum'
};

// Label peran (Bahasa Indonesia)
var ROLE_LABELS = {
  SUPERADMIN: 'Administrator Sistem', KETUA: 'Ketua', SEKRETARIS: 'Sekretaris',
  BENDAHARA: 'Bendahara', PEMBINA: 'Pembina', PENGAWAS: 'Pengawas',
  KETUA_DIVISI: 'Ketua Divisi', ANGGOTA_DIVISI: 'Anggota Divisi'
};

// Peran yang boleh membaca modul tertentu.
var SURAT_READ_ROLES = [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS,
                        ROLES.PEMBINA, ROLES.PENGAWAS];
var KEUANGAN_READ_ROLES = [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.BENDAHARA,
                           ROLES.PEMBINA, ROLES.PENGAWAS];
var USERS_READ_ROLES = [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS, ROLES.BENDAHARA];
var DIVISI_SUBMIT_ROLES = [ROLES.SUPERADMIN, ROLES.KETUA_DIVISI, ROLES.ANGGOTA_DIVISI];
var AUDIT_READ_ROLES = [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.PEMBINA, ROLES.PENGAWAS];

// ==========================================================================
// TABEL ROUTES — Single Source of Truth RBAC
// ==========================================================================
// Setiap route: { auth: bool, roles: [array|null], handler: fn }
//   auth  -> true: wajib sesi valid; false: publik (login, verifySurat, registerAnggota)
//   roles -> null: semua peran login; array: salah satu harus cocok.
var ROUTES = {
  // --- Autentikasi & Akun Pengurus (Auth.gs) ---
  login:               { auth: false, roles: null, handler: Auth.login },
  logout:              { auth: true,  roles: null, handler: Auth.logout },
  me:                  { auth: true,  roles: null, handler: Auth.me },
  getListPengguna:     { auth: true,  roles: USERS_READ_ROLES, handler: Auth.getListPengguna },
  createPengguna:      { auth: true,  roles: [ROLES.SUPERADMIN], handler: Auth.createPengguna },
  updatePengguna:      { auth: true,  roles: [ROLES.SUPERADMIN], handler: Auth.updatePengguna },
  getAuditLogs:        { auth: true,  roles: AUDIT_READ_ROLES, handler: Auth.getAuditLogs },

  // --- Pendaftaran Anggota Baru (Auth.gs) ---
  registerAnggota:           { auth: false, roles: null, handler: Auth.registerAnggota },
  getListPendaftar:          { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS], handler: Auth.getListPendaftar },
  verifyPendaftarSekretaris: { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.SEKRETARIS], handler: Auth.verifyPendaftarSekretaris },
  approvePendaftarKetum:     { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: Auth.approvePendaftarKetum },
  rejectPendaftar:           { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS], handler: Auth.rejectPendaftar },
  exportPendaftar:           { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS], handler: Auth.exportPendaftar },

  // --- Dashboard ---
  getDashboard:        { auth: true,  roles: null, handler: Utils.getDashboard },

  // --- Persuratan (Surat.gs) ---
  getListSurat:        { auth: true,  roles: SURAT_READ_ROLES, handler: Surat.getListSurat },
  createSurat:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.SEKRETARIS], handler: Surat.createSurat },
  updateSurat:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.SEKRETARIS], handler: Surat.updateSurat },
  submitSurat:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.SEKRETARIS], handler: Surat.submitSurat },
  approveSurat:        { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: Surat.approveSurat },
  rejectSurat:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: Surat.rejectSurat },
  verifySurat:         { auth: false, roles: null, handler: Surat.verifySurat },
  getPublishedSurat:   { auth: false, roles: null, handler: Surat.getPublishedSurat },
  reserveLetterNumber: { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.SEKRETARIS], handler: Surat.reserveLetterNumber },

  // --- Keuangan & Rekening (Keuangan.gs) ---
  getListKeuangan:     { auth: true,  roles: KEUANGAN_READ_ROLES, handler: Keuangan.getListKeuangan },
  getSaldo:            { auth: true,  roles: KEUANGAN_READ_ROLES, handler: Keuangan.getSaldo },
  createVoucher:       { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.BENDAHARA], handler: Keuangan.createVoucher },
  updateVoucherReceipt:{ auth: true,  roles: [ROLES.SUPERADMIN, ROLES.BENDAHARA], handler: Keuangan.updateVoucherReceipt },
  verifyVoucherBendahara: { auth: true, roles: [ROLES.SUPERADMIN, ROLES.BENDAHARA], handler: Keuangan.verifyVoucherBendahara },
  verifyVoucherKetum:  { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: Keuangan.verifyVoucherKetum },
  rejectVoucher:       { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: Keuangan.rejectVoucher },
  getAccounts:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.BENDAHARA], handler: Keuangan.getAccounts },
  saveAccount:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.BENDAHARA], handler: Keuangan.saveAccount },
  deleteAccount:       { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.BENDAHARA], handler: Keuangan.deleteAccount },
  getPublicAccounts:   { auth: false, roles: null, handler: Keuangan.getPublicAccounts },

  // --- Pengaturan & Penyimpanan (Utils.gs) ---
  getSettings:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: Utils.getSettings },
  saveSettings:        { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: Utils.saveSettings },
  getEditorialHistory: { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: Utils.getEditorialHistory },
  getEditorialRevision: { auth: true, roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: Utils.getEditorialRevision },
  restoreEditorialRevision: { auth: true, roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: Utils.restoreEditorialRevision },
  exportEditorialContent: { auth: true, roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: Utils.exportEditorialContent },
  importEditorialContent: { auth: true, roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: Utils.importEditorialContent },
  getPublicSettings:   { auth: false, roles: null, handler: Utils.getPublicSettings },
  uploadKopImage:      { auth: true,  roles: [ROLES.SUPERADMIN], handler: Utils.uploadKopImage },
  testDriveStorage:    { auth: true,  roles: [ROLES.SUPERADMIN], handler: Utils.testDriveStorage },
  createDriveFolder:   { auth: true,  roles: [ROLES.SUPERADMIN], handler: Utils.createDriveFolder },
  moveDriveFolder:     { auth: true,  roles: [ROLES.SUPERADMIN], handler: Utils.moveDriveFolder },
  resetDriveStorage:   { auth: true,  roles: [ROLES.SUPERADMIN], handler: Utils.resetDriveStorage },
  initDatabaseSchema:  { auth: true,  roles: [ROLES.SUPERADMIN], handler: function (ctx) { Database.initSchema(); return { ok: true, data: null, message: 'Skema database Google Sheets berhasil disinkronkan.' }; } },

  // --- Divisi (Divisi.gs) ---
  getListDivisi:       { auth: true,  roles: null, handler: Divisi.getListDivisi },
  createSubmission:    { auth: true,  roles: DIVISI_SUBMIT_ROLES, handler: Divisi.createSubmission },
  updateSubmission:    { auth: true,  roles: DIVISI_SUBMIT_ROLES, handler: Divisi.updateSubmission },
  ajukanSubmission:    { auth: true,  roles: DIVISI_SUBMIT_ROLES, handler: Divisi.ajukanSubmission },
  approveSubmission:   { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: Divisi.approveSubmission },
  rejectSubmission:    { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: Divisi.rejectSubmission },
  startExecution:      { auth: true,  roles: DIVISI_SUBMIT_ROLES, handler: Divisi.startExecution },
  submitLPJ:           { auth: true,  roles: DIVISI_SUBMIT_ROLES, handler: Divisi.submitLPJ },

  // --- Alias Kompatibilitas (Pencegahan Notif Aksi Tidak Dikenali) ---
  getDashboardSummary: { auth: true,  roles: null, handler: Utils.getDashboard },
  getListProgram:      { auth: true,  roles: null, handler: Divisi.getListDivisi },
  getPublicFeed:       { auth: false, roles: null, handler: Surat.getPublishedSurat },
  verify:              { auth: false, roles: null, handler: Surat.verifySurat }
};

// ==========================================================================
// PINTU MASUK WEB APP
// ==========================================================================

/**
 * Handler GET: action + token + parameter lain via query string.
 * Dipakai frontend untuk semua aksi baca.
 */
function doGet(e) {
  return handleRequest(e.parameter || {});
}

/**
 * Handler POST: body JSON { action, token, payload }.
 * Dipakai frontend untuk semua aksi tulis.
 */
function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents || '{}');
  } catch (err) {
    return jsonOut({ success: false, data: null, message: 'Format permintaan tidak valid.' });
  }
  // POST juga mengizinkan parameter query (action/token) sebagai fallback.
  var merged = {};
  for (var k in body) merged[k] = body[k];
  for (var q in (e.parameter || {})) if (!(q in merged)) merged[q] = e.parameter[q];
  return handleRequest(merged);
}

/**
 * Inti dispatch: validasi route -> sesi -> RBAC -> jalankan handler -> envelope.
 * @param {object} req { action, token, payload }
 */
function handleRequest(req) {
  req = req || {};
  var action = req.action;

  // Cek ping status bila diakses langsung tanpa aksi (misal browser GET)
  if (!action || action === 'ping') {
    return jsonOut({
      success: true,
      data: { status: 'online', version: '2.0.0', service: 'SIAP APII Backend' },
      message: 'Layanan API Yayasan APII DPW Jabodetabek Aktif.'
    });
  }

  var route = ROUTES[action];

  // 1) Aksi tidak dikenali.
  if (!route) {
    return jsonOut({ success: false, data: null, message: 'Aksi tidak dikenali.' });
  }

  // 2) Verifikasi sesi bila route butuh autentikasi.
  var user = null;
  if (route.auth) {
    user = Auth.verifySession(req.token);
    if (!user) {
      return jsonOut({ success: false, data: null,
        message: 'Sesi berakhir atau tidak valid. Silakan login kembali.' });
    }
    // 3) Cek RBAC peran.
    if (route.roles && route.roles.indexOf(user.role) === -1) {
      Utils.audit(user.username, 'FORBIDDEN',
        'Aksi ' + action + ' ditolak untuk peran ' + (ROLE_LABELS[user.role] || user.role));
      return jsonOut({ success: false, data: null,
        message: 'Anda tidak memiliki izin untuk aksi ini.' });
    }
  }

  // 4) Jalankan handler. Handler WAJIB return { ok, data, message }.
  try {
    var payload = req.payload || {};
    if (typeof payload !== 'object' || payload === null) payload = {};
    for (var k in req) {
      if (k !== 'action' && k !== 'token' && k !== 'payload') {
        if (!(k in payload)) payload[k] = req[k];
      }
    }
    var ctx = { user: user, token: req.token, payload: payload };
    var result = route.handler(ctx);
    if (!result) result = { ok: false, data: null, message: 'Handler tidak mengembalikan hasil.' };
    return jsonOut({ success: result.ok, data: result.data, message: result.message || '' });
  } catch (err) {
    // Error terstruktur dari handler: lempar { code, message }.
    if (err && err.appError) {
      return jsonOut({ success: false, data: null, message: err.message });
    }
    // Error tak terduga: catat & beri pesan generik (jangan bocorkan detail).
    Logger.log('ERROR [' + action + ']: ' + err);
    return jsonOut({ success: false, data: null,
      message: 'Terjadi kesalahan sistem. Tim IT telah diberi notifikasi.' });
  }
}

/**
 * Bungus objek ke JSON response (ContentService; Apps Script selalu HTTP 200).
 */
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Helper untuk handler: lempar error aplikasi (ditangkap handleRequest).
 */
function appError(message) {
  var err = new Error(message);
  err.appError = true;
  return err;
}

// ==========================================================================
// SETUP — Jalankan SEKALI pada spreadsheet baru (Project Settings > Run).
// ==========================================================================

/**
 * setup(): buat semua tab + header + seed 9 akun demo (password 'apii2026').
 * Idempoten: tab/header yang sudah ada tidak akan dirusak.
 */
function setup() {
  Database.initSchema();
  seedDemoUsers();
  // Buat folder Drive + template Google Docs (kop, logo & stempel) otomatis.
  siapkanFolderPdf_();
  siapkanTemplateSurat_();
  Logger.log('Setup selesai. Database, folder Drive, & template surat siap.');
}

function seedDemoUsers() {
  var password = 'apii2026';
  var demo = [
    ['superadmin', 'Administrator Sistem', ROLES.SUPERADMIN, '', 'admin@apii-jabo.or.id'],
    ['ketua',      'Ketua Umum',           ROLES.KETUA,      '', 'ketua@apii-jabo.or.id'],
    ['sekretaris', 'Sekretaris',           ROLES.SEKRETARIS, '', 'sekretaris@apii-jabo.or.id'],
    ['bendahara',  'Bendahara',            ROLES.BENDAHARA,  '', 'bendahara@apii-jabo.or.id'],
    ['pembina',    'Pembina',              ROLES.PEMBINA,    '', 'pembina@apii-jabo.or.id'],
    ['pengawas',   'Pengawas',             ROLES.PENGAWAS,   '', 'pengawas@apii-jabo.or.id'],
    ['khumas',     'Ketua Divisi Humas',   ROLES.KETUA_DIVISI,     DIVISIONS.DIV_HUMAS, 'humas@apii-jabo.or.id'],
    ['ahumas',     'Anggota Divisi Humas', ROLES.ANGGOTA_DIVISI,   DIVISIONS.DIV_HUMAS, '']
  ];
  var now = new Date().toISOString();
  demo.forEach(function (row) {
    var existing = Database.findOne('Sheet_Users', { username: row[0] });
    if (existing) return; // jangan timpa akun yang sudah ada
    Database.insert('Sheet_Users', {
      id: Utils.uuid(),
      username: row[0],
      password_hash: Auth.hashPassword(password),
      full_name: row[1],
      email: row[4],
      role: row[2],
      division: row[3],
      is_active: 'TRUE',
      can_manage_users: row[2] === ROLES.SUPERADMIN ? 'TRUE' : 'FALSE',
      created_at: now,
      updated_at: now
    });
  });
  Logger.log('Seed ' + demo.length + ' akun demo selesai (password: ' + password + ').');
}
