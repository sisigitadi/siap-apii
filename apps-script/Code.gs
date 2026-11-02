/****************************************************************************
 * Code.gs - dibangkitkan otomatis; JANGAN diedit manual.
 * Sumber: gas/Code.gs (scripts/build-apps-script.ps1)
 *****************************************************************************/
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

// 8 peran pengurus sistem (khusus pengurus yayasan) + 1 peran khusus DEMO.
var ROLES = {
  SUPERADMIN: 'SUPERADMIN', KETUA: 'KETUA', SEKRETARIS: 'SEKRETARIS',
  BENDAHARA: 'BENDAHARA', PEMBINA: 'PEMBINA', PENGAWAS: 'PENGAWAS',
  KETUA_DIVISI: 'KETUA_DIVISI', ANGGOTA_DIVISI: 'ANGGOTA_DIVISI',
  // Peran khusus: calon pengguna mencoba alur kerja (read-only mutlak).
  DEMO: 'DEMO'
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
  KETUA_DIVISI: 'Ketua Divisi', ANGGOTA_DIVISI: 'Anggota Divisi',
  DEMO: 'Akun Demo (Read-Only)'
};

// ==========================================================================
// RBAC PER-AKSI (fine-grained permissions)
// ==========================================================================
// Setiap route (auth:true) adalah satu "aksi" yang bisa diizinkan/dicabut
// per pengguna lewat kolom Sheet_Users.permissions. Konvensi nilai kolom:
//   ''            -> warisi default peran (roleDefaultPermissions_), kompatibel
//                    dengan akun lama yang belum punya nilai permissions.
//   '*'           -> semua aksi (hanya SUPERADMIN yang bisa diset begitu).
//   ["a","b",...] -> JSON array aksi eksplisit (hanya aksi yang masuk rentang
//                    peran pengguna yang dihitung -> tidak bisa "naik kelas").
//
// Router mengecek roles (gate kasar modul) DULU, lalu hasPermission_ (gate
// per-aksi). SUPERADMIN selalu lolos.

// Label tampilan tiap aksi (untuk grid checkbox izin di portal pengurus).
var ACTION_LABELS = {
  // Autentikasi & akun
  logout: 'Keluar dari sistem',
  me: 'Lihat data sendiri',
  getDashboard: 'Lihat dashboard ringkasan',
  getListPengguna: 'Lihat daftar pengguna',
  createPengguna: 'Buat pengguna baru',
  updatePengguna: 'Ubah data pengguna',
  resetUserPermissions: 'Reset izin aksi pengguna',
  getAuditLogs: 'Lihat jejak audit',
  // Pendaftaran anggota
  getListPendaftar: 'Lihat pendaftar anggota',
  verifyPendaftarSekretaris: 'Verifikasi berkas pendaftar',
  approvePendaftarKetum: 'Setujui pendaftar jadi anggota',
  rejectPendaftar: 'Tolak pendaftar',
  exportPendaftar: 'Ekspor data pendaftar',
  // Persuratan
  getListSurat: 'Lihat daftar surat',
  createSurat: 'Buat draf surat',
  updateSurat: 'Ubah draf surat',
  submitSurat: 'Ajukan surat ke Ketua',
  approveSurat: 'Setujui & terbitkan surat',
  rejectSurat: 'Tolak surat',
  reserveLetterNumber: 'Reservasi nomor surat',
  getLetterTemplates: 'Lihat template surat',
  saveLetterTemplate: 'Simpan template surat',
  deleteLetterTemplate: 'Hapus template surat',
  // Keuangan
  getListKeuangan: 'Lihat daftar transaksi',
  getSaldo: 'Lihat saldo kas',
  createVoucher: 'Buat voucher transaksi',
  updateVoucherReceipt: 'Unggah kuitansi voucher',
  verifyVoucherBendahara: 'Verifikasi voucher (Bendahara)',
  verifyVoucherKetum: 'Verifikasi voucher (Ketua)',
  rejectVoucher: 'Tolak voucher',
  getAccounts: 'Lihat master rekening',
  saveAccount: 'Simpan master rekening',
  deleteAccount: 'Hapus master rekening',
  // Pengaturan
  getSettings: 'Lihat pengaturan sistem',
  saveSettings: 'Simpan pengaturan sistem',
  getEditorialHistory: 'Lihat riwayat versi konten',
  getEditorialRevision: 'Buka detail versi konten',
  restoreEditorialRevision: 'Kembalikan versi konten',
  exportEditorialContent: 'Ekspor konten redaksi',
  importEditorialContent: 'Impor konten redaksi',
  uploadKopImage: 'Unggah gambar KOP surat',
  testDriveStorage: 'Tes penyimpanan Google Drive',
  createDriveFolder: 'Buat folder Drive',
  moveDriveFolder: 'Pindahkan folder Drive',
  resetDriveStorage: 'Reset penyimpanan Drive',
  initDatabaseSchema: 'Sinkronkan skema database',
  // Divisi
  getListDivisi: 'Lihat program divisi',
  createSubmission: 'Buat usulan program divisi',
  updateSubmission: 'Ubah usulan program divisi',
  ajukanSubmission: 'Ajukan program divisi',
  approveSubmission: 'Setujui program divisi',
  rejectSubmission: 'Tolak program divisi',
  startExecution: 'Mulai eksekusi program divisi',
  submitLPJ: 'Unggah LPJ program divisi',
  // Pengunjung
  getVisitors: 'Lihat statistik pengunjung'
};

// Pengelompokan aksi untuk tampilan grid izin (urutan = urutan tampil).
var ACTION_MODULES = {
  getListPengguna: 'Pengguna', createPengguna: 'Pengguna', updatePengguna: 'Pengguna',
  resetUserPermissions: 'Pengguna', getAuditLogs: 'Pengguna',
  getListPendaftar: 'Pendaftaran', verifyPendaftarSekretaris: 'Pendaftaran',
  approvePendaftarKetum: 'Pendaftaran', rejectPendaftar: 'Pendaftaran',
  exportPendaftar: 'Pendaftaran',
  getListSurat: 'Persuratan', createSurat: 'Persuratan', updateSurat: 'Persuratan',
  submitSurat: 'Persuratan', approveSurat: 'Persuratan', rejectSurat: 'Persuratan',
  reserveLetterNumber: 'Persuratan', getLetterTemplates: 'Persuratan',
  saveLetterTemplate: 'Persuratan', deleteLetterTemplate: 'Persuratan',
  getListKeuangan: 'Keuangan', getSaldo: 'Keuangan', createVoucher: 'Keuangan',
  updateVoucherReceipt: 'Keuangan', verifyVoucherBendahara: 'Keuangan',
  verifyVoucherKetum: 'Keuangan', rejectVoucher: 'Keuangan',
  getAccounts: 'Keuangan', saveAccount: 'Keuangan', deleteAccount: 'Keuangan',
  getSettings: 'Pengaturan', saveSettings: 'Pengaturan',
  getEditorialHistory: 'Pengaturan', getEditorialRevision: 'Pengaturan',
  restoreEditorialRevision: 'Pengaturan', exportEditorialContent: 'Pengaturan',
  importEditorialContent: 'Pengaturan', uploadKopImage: 'Pengaturan',
  testDriveStorage: 'Pengaturan', createDriveFolder: 'Pengaturan',
  moveDriveFolder: 'Pengaturan', resetDriveStorage: 'Pengaturan',
  initDatabaseSchema: 'Pengaturan',
  getListDivisi: 'Divisi', createSubmission: 'Divisi', updateSubmission: 'Divisi',
  ajukanSubmission: 'Divisi', approveSubmission: 'Divisi', rejectSubmission: 'Divisi',
  startExecution: 'Divisi', submitLPJ: 'Divisi',
  getVisitors: 'Pengunjung'
};

// Modul (sheet audit) untuk tiap aksi audit-enabled.
var ACTION_AUDIT_MODULES = {
  createPengguna: 'USERS', updatePengguna: 'USERS', resetUserPermissions: 'USERS',
  saveLetterTemplate: 'TEMPLATES', deleteLetterTemplate: 'TEMPLATES'
};

// Peran yang boleh membaca modul tertentu.
// DEMO termasuk pembaca surat & keuangan agar bisa melihat alur kerja pengurus,
// namun TIDAK termasuk USERS/AUDIT/PENGATURAN (data sensitif) dan TIDAK ada
// satu pun aksi tulis (lihat DEMO_ALLOWED_ACTIONS di bawah).
var SURAT_READ_ROLES = [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS,
                        ROLES.PEMBINA, ROLES.PENGAWAS, ROLES.DEMO];
var KEUANGAN_READ_ROLES = [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.BENDAHARA,
                           ROLES.PEMBINA, ROLES.PENGAWAS, ROLES.DEMO];
var USERS_READ_ROLES = [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS, ROLES.BENDAHARA];
var DIVISI_SUBMIT_ROLES = [ROLES.SUPERADMIN, ROLES.KETUA_DIVISI, ROLES.ANGGOTA_DIVISI];
var AUDIT_READ_ROLES = [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.PEMBINA, ROLES.PENGAWAS];

// ==========================================================================
// AKUN DEMO (read-only mutlak)
// ==========================================================================
// Akun demo dipakai calon pengurus saat presentasi untuk memahami alur kerja,
// logika, dan UI/UX. Akun ini HANYA boleh menjalankan aksi baca di daftar ini.
// Daftar ini adalah penjaga mutlak (defense in depth) terlepas dari RBAC peran:
// semua aksi di luar daftar langsung ditolak di handleRequest().
var DEMO_ALLOWED_ACTIONS = [
  'me', 'logout', 'getDashboard',
  'getListSurat', 'getLetterTemplates',          // lihat persuratan (bukan manajemen)
  'getListKeuangan', 'getSaldo', 'getAccounts',  // lihat keuangan (bukan verifikasi)
  'getListDivisi'                                 // lihat program divisi
];

// ==========================================================================
// TABEL ROUTES — Single Source of Truth RBAC
// ==========================================================================
// Setiap route: { auth: bool, roles: [array|null], handler: fn }
//   auth  -> true: wajib sesi valid; false: publik (login, verifySurat, registerAnggota)
//   roles -> null: semua peran login; array: salah satu harus cocok.
var ROUTES = {
  // --- Autentikasi & Akun Pengurus (Auth.gs) ---
  login:               { auth: false, roles: null, handler: login },
  logout:              { auth: true,  roles: null, handler: logout },
  me:                  { auth: true,  roles: null, handler: me },
  getListPengguna:     { auth: true,  roles: USERS_READ_ROLES, handler: getListPengguna },
  createPengguna:      { auth: true,  roles: [ROLES.SUPERADMIN], handler: createPengguna },
  updatePengguna:      { auth: true,  roles: [ROLES.SUPERADMIN], handler: updatePengguna },
  getAuditLogs:        { auth: true,  roles: AUDIT_READ_ROLES, handler: getAuditLogs },

  // --- Pendaftaran Anggota Baru (Auth.gs) ---
  registerAnggota:           { auth: false, roles: null, handler: registerAnggota },
  getListPendaftar:          { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS], handler: getListPendaftar },
  verifyPendaftarSekretaris: { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.SEKRETARIS], handler: verifyPendaftarSekretaris },
  approvePendaftarKetum:     { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: approvePendaftarKetum },
  rejectPendaftar:           { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS], handler: rejectPendaftar },
  exportPendaftar:           { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS], handler: exportPendaftar },

  // --- Akun Demo (login khusus read-only, tanpa username/password) ---
  loginDemo:           { auth: false, roles: null, handler: loginDemo },

  // --- Dashboard ---
  getDashboard:        { auth: true,  roles: null, handler: getDashboard },

  // --- Persuratan (Surat.gs) ---
  getListSurat:        { auth: true,  roles: SURAT_READ_ROLES, handler: getListSurat },
  createSurat:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.SEKRETARIS], handler: createSurat },
  updateSurat:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.SEKRETARIS], handler: updateSurat },
  submitSurat:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.SEKRETARIS], handler: submitSurat },
  approveSurat:        { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: approveSurat },
  rejectSurat:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: rejectSurat },
  verifySurat:         { auth: false, roles: null, handler: verifySurat },
  getPublishedSurat:   { auth: false, roles: null, handler: getPublishedSurat },
  reserveLetterNumber: { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.SEKRETARIS], handler: reserveLetterNumber },

  // --- Keuangan & Rekening (Keuangan.gs) ---
  getListKeuangan:     { auth: true,  roles: KEUANGAN_READ_ROLES, handler: getListKeuangan },
  getSaldo:            { auth: true,  roles: KEUANGAN_READ_ROLES, handler: getSaldo },
  createVoucher:       { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.BENDAHARA], handler: createVoucher },
  updateVoucherReceipt:{ auth: true,  roles: [ROLES.SUPERADMIN, ROLES.BENDAHARA], handler: updateVoucherReceipt },
  verifyVoucherBendahara: { auth: true, roles: [ROLES.SUPERADMIN, ROLES.BENDAHARA], handler: verifyVoucherBendahara },
  verifyVoucherKetum:  { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: verifyVoucherKetum },
  rejectVoucher:       { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: rejectVoucher },
  getAccounts:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.BENDAHARA], handler: getAccounts },
  saveAccount:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.BENDAHARA], handler: saveAccount },
  deleteAccount:       { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.BENDAHARA], handler: deleteAccount },
  getPublicAccounts:   { auth: false, roles: null, handler: getPublicAccounts },

  // --- Pengaturan & Penyimpanan (Utils.gs) ---
  getSettings:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: getSettings },
  saveSettings:        { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: saveSettings },
  getEditorialHistory: { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: getEditorialHistory },
  getEditorialRevision: { auth: true, roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: getEditorialRevision },
  restoreEditorialRevision: { auth: true, roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: restoreEditorialRevision },
  exportEditorialContent: { auth: true, roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: exportEditorialContent },
  importEditorialContent: { auth: true, roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: importEditorialContent },
  getPublicSettings:   { auth: false, roles: null, handler: getPublicSettings },
  uploadKopImage:      { auth: true,  roles: [ROLES.SUPERADMIN], handler: uploadKopImage },
  testDriveStorage:    { auth: true,  roles: [ROLES.SUPERADMIN], handler: testDriveStorage },
  createDriveFolder:   { auth: true,  roles: [ROLES.SUPERADMIN], handler: createDriveFolder },
  moveDriveFolder:     { auth: true,  roles: [ROLES.SUPERADMIN], handler: moveDriveFolder },
  resetDriveStorage:   { auth: true,  roles: [ROLES.SUPERADMIN], handler: resetDriveStorage },
  initDatabaseSchema:  { auth: true,  roles: [ROLES.SUPERADMIN], handler: function (ctx) { initSchema(); return { ok: true, data: null, message: 'Skema database Google Sheets berhasil disinkronkan.' }; } },

  // --- Divisi (Divisi.gs) ---
  getListDivisi:       { auth: true,  roles: null, handler: getListDivisi },
  createSubmission:    { auth: true,  roles: DIVISI_SUBMIT_ROLES, handler: createSubmission },
  updateSubmission:    { auth: true,  roles: DIVISI_SUBMIT_ROLES, handler: updateSubmission },
  ajukanSubmission:    { auth: true,  roles: DIVISI_SUBMIT_ROLES, handler: ajukanSubmission },
  approveSubmission:   { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: approveSubmission },
  rejectSubmission:    { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: rejectSubmission },
  startExecution:      { auth: true,  roles: DIVISI_SUBMIT_ROLES, handler: startExecution },
  submitLPJ:           { auth: true,  roles: DIVISI_SUBMIT_ROLES, handler: submitLPJ },

  // --- Template Surat (PDF asli overlay; lihat Surat.gs) ---
  getLetterTemplates:  { auth: true,  roles: SURAT_READ_ROLES, handler: getLetterTemplates },
  saveLetterTemplate:  { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.SEKRETARIS], handler: saveLetterTemplate },
  deleteLetterTemplate:{ auth: true,  roles: [ROLES.SUPERADMIN], handler: deleteLetterTemplate },

  // --- Pengunjung Portal Publik (Visitor.gs) ---
  trackVisitor:        { auth: false, roles: null, handler: trackVisitor },
  getVisitors:         { auth: true,  roles: AUDIT_READ_ROLES, handler: getVisitors },

  // --- RBAC per-aksi (Code.gs) ---
  getPermissionsMap:   { auth: true,  roles: [ROLES.SUPERADMIN], handler: getPermissionsMap },
  resetUserPermissions:{ auth: true,  roles: [ROLES.SUPERADMIN], handler: resetUserPermissions },

  // --- Alias Kompatibilitas (Pencegahan Notif Aksi Tidak Dikenali) ---
  getDashboardSummary: { auth: true,  roles: null, handler: getDashboard },
  getListProgram:      { auth: true,  roles: null, handler: getListDivisi },
  getPublicFeed:       { auth: false, roles: null, handler: getPublishedSurat },
  verify:              { auth: false, roles: null, handler: verifySurat }
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
    // Angka versi TIDAK ditulis di sini: keduanya datang dari APP_BUILD_INFO di
    // Versi.gs (dihasilkan scripts/stamp-build-info.mjs) supaya monitoring tidak
    // pernah membaca versi basi. `version` = versi aplikasi dari package.json,
    // `release` = nomor Versi Apps Script yang tayang di deployment /exec.
    var buildInfo = (typeof APP_BUILD_INFO === 'object' && APP_BUILD_INFO) ? APP_BUILD_INFO : {};
    return jsonOut({
      success: true,
      data: {
        status: 'online',
        version: buildInfo.version || null,
        release: buildInfo.release === undefined ? null : buildInfo.release,
        service: 'SIAP APII Backend'
      },
      message: 'Layanan API Yayasan APII DPW Jabodetabek Aktif.'
    });
  }

  var route = ROUTES[action];

  // 1) Aksi tidak dikenali.
  if (!route) {
    return jsonOut({ success: false, data: null, message: 'Aksi tidak dikenali.' });
  }

  // 1a) Rate limiting untuk endpoint publik sensitif (mencegah brute-force & spam flooding).
  if (!route.auth) {
    if (!checkPublicRateLimit_(action, req)) {
      return jsonOut({
        success: false,
        data: null,
        message: 'Terlalu banyak permintaan untuk aksi ini. Harap tunggu 1 menit.'
      });
    }
  }

  // 2) Verifikasi sesi bila route butuh autentikasi.
  var user = null;
  if (route.auth) {
    user = verifySession(req.token);
    if (!user) {
      return jsonOut({ success: false, data: null,
        message: 'Sesi berakhir atau tidak valid. Silakan login kembali.' });
    }
    // 3) Cek RBAC peran (gate kasar modul).
    if (route.roles && route.roles.indexOf(user.role) === -1) {
      audit(user.username, 'FORBIDDEN',
        'Aksi ' + action + ' ditolak untuk peran ' + (ROLE_LABELS[user.role] || user.role), 'RBAC');
      return jsonOut({ success: false, data: null,
        message: 'Anda tidak memiliki izin untuk aksi ini.' });
    }
    // 3a) PENJAGA AKUN DEMO: aksi di luar daftar read-only langsung ditolak.
    //     Ini lapisan keamanan mutlak — tidak bergantung pada RBAC peran.
    if (isDemoUser_(user) && DEMO_ALLOWED_ACTIONS.indexOf(action) === -1) {
      audit(user.username, 'DEMO_BLOCKED',
        'Aksi ' + action + ' diblokir untuk akun demo (read-only)', 'RBAC');
      return jsonOut({ success: false, data: null,
        message: 'Akun demo hanya bisa melihat. Aksi mengubah/menyimpan data tidak diizinkan.' });
    }

    // 3b) Cek RBAC per-AKSI (gate halus: izin spesifik pengguna).
    if (!hasPermission_(user, action)) {
      audit(user.username, 'FORBIDDEN',
        'Aksi ' + action + ' dicabut untuk pengguna ini', 'RBAC');
      return jsonOut({ success: false, data: null,
        message: 'Akses aksi ini telah dicabut dari akun Anda. Hubungi administrator.' });
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
 * checkPublicRateLimit_: pembatas frekuensi request untuk endpoint publik via CacheService.
 * Mencegah abuse, brute-force sandi, dan spamming pendaftaran/analitik.
 * Window geser 60 detik (1 menit).
 * @param {string} action nama route publik
 * @param {object} req request object { payload, visitor_id, ip_client }
 * @return {boolean} true jika diizinkan, false jika melebihi batas (throttled)
 */
function checkPublicRateLimit_(action, req) {
  try {
    if (typeof CacheService === 'undefined' || !CacheService.getScriptCache) {
      return true; // Bypass pada mock / pengujian lokal tanpa CacheService
    }
    var cache = CacheService.getScriptCache();
    if (!cache) return true;

    var limits = {
      login: 15,
      loginDemo: 20,
      registerAnggota: 10,
      trackVisitor: 120,
      verifySurat: 60,
      verify: 60,
      getPublishedSurat: 60,
      getPublicFeed: 60,
      getPublicSettings: 60
    };

    var max = limits[action] || 60;
    var payload = req.payload || {};
    var clientKey = 'rl:' + action;
    if (action === 'login' && payload.username) {
      clientKey += ':' + String(payload.username).toLowerCase().trim();
    } else if (req.visitor_id || payload.visitor_id) {
      clientKey += ':' + String(req.visitor_id || payload.visitor_id);
    } else if (req.client_ip || req.ip_client) {
      clientKey += ':' + String(req.client_ip || req.ip_client);
    }

    var curr = Number(cache.get(clientKey)) || 0;
    if (curr >= max) {
      return false; // Throttled
    }
    cache.put(clientKey, String(curr + 1), 60);
    return true;
  } catch (e) {
    return true; // Fail-open agar kegagalan cache tidak memblokir akses pengguna
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
 * Daftar aksi yang menjadi "default" sebuah peran (berdasarkan tabel ROUTES).
 * Aksi publik (auth:false) & aksi terbuka (roles:null) tidak perlu izin eksplisit.
 * @param {string} role
 * @return {Array<string>} daftar nama aksi (route key)
 */
function roleDefaultPermissions_(role) {
  if (role === ROLES.SUPERADMIN) {
    return Object.keys(ROUTES).filter(function (a) {
      return !!ROUTES[a] && ROUTES[a].auth === true;
    });
  }
  var out = [];
  for (var action in ROUTES) {
    var route = ROUTES[action];
    if (!route || route.auth !== true) continue;
    if (route.roles === null || route.roles.indexOf(role) !== -1) out.push(action);
  }
  return out;
}

/**
 * Parse kolom permissions seorang pengguna menjadi daftar aksi efektif.
 * @param {object} user baris Sheet_Users
 * @return {Array<string>|string} daftar aksi, atau '*' untuk SUPERADMIN
 */
function effectivePermissions_(user) {
  if (!user) return [];
  if (user.role === ROLES.SUPERADMIN) return '*';
  var raw = (user.permissions === undefined || user.permissions === null)
    ? '' : String(user.permissions).trim();
  if (raw === '*') return '*';
  // Tidak ada nilai -> warisi default peran (akun lama tetap kompatibel).
  if (raw === '') return roleDefaultPermissions_(user.role);
  var list = null;
  try {
    var parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) list = parsed;
  } catch (e) { /* bukan JSON, mungkin daftar dipisah koma */ }
  if (list === null) {
    list = raw.split(',').map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });
  }
  // Sandaran: aksi yang diluar jangkauan peran tidak pernah diizinkan.
  var allowed = roleDefaultPermissions_(user.role);
  return list.filter(function (a) { return allowed.indexOf(a) !== -1; });
}

/**
 * Cek apakah baris user adalah akun demo (read-only mutlak).
 * @param {object} user baris Sheet_Users
 * @return {boolean}
 */
function isDemoUser_(user) {
  if (!user) return false;
  if (user.role === ROLES.DEMO) return true;
  var flag = user.is_demo;
  return flag === true || flag === 'TRUE' || flag === 'true';
}

/**
 * Cek apakah pengguna boleh menjalankan sebuah aksi.
 * @param {object} user baris Sheet_Users
 * @param {string} action nama aksi (route key)
 * @return {boolean}
 */
function hasPermission_(user, action) {
  var route = ROUTES[action];
  if (!route) return false;
  if (!route.auth) return true;                   // aksi publik
  if (!user) return false;
  if (user.role === ROLES.SUPERADMIN) return true;
  if (route.roles === null) return true;          // semua peran login
  var perms = effectivePermissions_(user);
  if (perms === '*') return true;
  return perms.indexOf(action) !== -1;
}

/**
 * getPermissionsMap: peta lengkap aksi + default peran, untuk merender grid
 * checkbox izin di portal pengurus (hanya SUPERADMIN).
 */
function getPermissionsMap(ctx) {
  var actions = [];
  for (var action in ROUTES) {
    var route = ROUTES[action];
    if (!route || route.auth !== true) continue;
    if (route.roles === null) continue; // tidak perlu izin eksplisit
    actions.push({
      action: action,
      label: ACTION_LABELS[action] || action,
      module: ACTION_MODULES[action] || 'Lainnya',
      roles: route.roles
    });
  }
  var roleDefaults = {};
  for (var r in ROLES) {
    roleDefaults[ROLES[r]] = roleDefaultPermissions_(ROLES[r]);
  }
  return {
    ok: true,
    data: {
      actions: actions,
      role_defaults: roleDefaults,
      roles: ROLES,
      role_labels: ROLE_LABELS
    },
    message: 'Peta izin aksi berhasil dimuat.'
  };
}

/**
 * resetUserPermissions: kembalikan izin aksi seorang pengguna ke default peran
 * (mengosongkan kolom permissions). Hanya SUPERADMIN.
 * @param {object} ctx.payload { id }
 */
function resetUserPermissions(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID pengguna wajib diisi.' };
  var user = findOne(TABS.USERS, { id: p.id });
  if (!user) return { ok: false, data: null, message: 'Pengguna tidak ditemukan.' };
  updateRow(TABS.USERS, user._row, {
    permissions: '',
    updated_at: new Date().toISOString()
  });
  audit(ctx.user.username, 'PERMISSIONS_RESET',
    'Reset izin aksi pengguna ' + user.username + ' ke default peran ' + user.role,
    'USERS');
  return { ok: true, data: null,
    message: 'Izin aksi ' + user.username + ' dikembalikan ke default peran.' };
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
  initSchema();
  // Amankan PASSWORD_SALT ke Script Properties jika belum ada
  try {
    if (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties) {
      var props = PropertiesService.getScriptProperties();
      if (!props.getProperty('PASSWORD_SALT') && typeof KONFIG !== 'undefined' && KONFIG.PASSWORD_SALT) {
        props.setProperty('PASSWORD_SALT', KONFIG.PASSWORD_SALT);
        Logger.log('PASSWORD_SALT berhasil diamankan ke Script Properties.');
      }
    }
  } catch (eProps) {
    Logger.log('Catatan: Script Properties dilewati: ' + eProps);
  }

  seedDemoUsers();
  // Buat folder Drive + template Google Docs (kop, logo & stempel) otomatis.
  siapkanFolderPdf_();
  siapkanTemplateSurat_();
  Logger.log('Setup selesai. Database, folder Drive, & template surat siap.');
}

/**
 * seedDemoUsers: seed 27 akun lengkap sesuai AD/ART Pasal 16 —
 *   6 pimpinan inti (Superadmin, Ketua, Sekretaris, Bendahara, Pembina, Pengawas)
 * + 7 divisi x (1 Ketua Divisi + 2 Anggota Divisi) = 21
 * Total = 27 akun. Semua password 'apii2026'.
 * Idempoten: akun yang sudah ada tidak ditimpa.
 */
function seedDemoUsers() {
  var password = 'apii2026';

  // [username, nama lengkap, peran, divisi, email]
  var demo = [
    // --- 6 pimpinan inti ---
    ['superadmin', 'Administrator Sistem',  ROLES.SUPERADMIN, '', 'admin@apii-jabo.or.id'],
    ['ketua',      'Ketua Umum',            ROLES.KETUA,      '', 'ketua@apii-jabo.or.id'],
    ['sekretaris', 'Sekretaris',            ROLES.SEKRETARIS, '', 'sekretaris@apii-jabo.or.id'],
    ['bendahara',  'Bendahara',             ROLES.BENDAHARA,  '', 'bendahara@apii-jabo.or.id'],
    ['pembina',    'Pembina',               ROLES.PEMBINA,    '', 'pembina@apii-jabo.or.id'],
    ['pengawas',   'Pengawas',              ROLES.PENGAWAS,   '', 'pengawas@apii-jabo.or.id'],
    // --- 7 divisi kerja x (Ketua + 2 Anggota) ---
    ['khumas',     'Ketua Divisi Humas',    ROLES.KETUA_DIVISI,   DIVISIONS.DIV_HUMAS,     'humas@apii-jabo.or.id'],
    ['ahumas1',    'Anggota Divisi Humas I',  ROLES.ANGGOTA_DIVISI, DIVISIONS.DIV_HUMAS,     ''],
    ['ahumas2',    'Anggota Divisi Humas II', ROLES.ANGGOTA_DIVISI, DIVISIONS.DIV_HUMAS,     ''],
    ['klitbang',   'Ketua Divisi Litbang',  ROLES.KETUA_DIVISI,   DIVISIONS.DIV_LITBANG,   'litbang@apii-jabo.or.id'],
    ['alitbang1',  'Anggota Divisi Litbang I',  ROLES.ANGGOTA_DIVISI, DIVISIONS.DIV_LITBANG, ''],
    ['alitbang2',  'Anggota Divisi Litbang II', ROLES.ANGGOTA_DIVISI, DIVISIONS.DIV_LITBANG, ''],
    ['ksosmed',    'Ketua Divisi Media Sosial', ROLES.KETUA_DIVISI, DIVISIONS.DIV_SOSMED,   'sosmed@apii-jabo.or.id'],
    ['asosmed1',   'Anggota Divisi Media Sosial I',  ROLES.ANGGOTA_DIVISI, DIVISIONS.DIV_SOSMED, ''],
    ['asosmed2',   'Anggota Divisi Media Sosial II', ROLES.ANGGOTA_DIVISI, DIVISIONS.DIV_SOSMED, ''],
    ['kdakwah',    'Ketua Divisi Dakwah',   ROLES.KETUA_DIVISI,   DIVISIONS.DIV_DAKWAH,    'dakwah@apii-jabo.or.id'],
    ['adakwah1',   'Anggota Divisi Dakwah I',  ROLES.ANGGOTA_DIVISI, DIVISIONS.DIV_DAKWAH,  ''],
    ['adakwah2',   'Anggota Divisi Dakwah II', ROLES.ANGGOTA_DIVISI, DIVISIONS.DIV_DAKWAH,  ''],
    ['kinvestasi', 'Ketua Divisi Investasi', ROLES.KETUA_DIVISI,   DIVISIONS.DIV_INVESTASI, 'investasi@apii-jabo.or.id'],
    ['ainvestasi1','Anggota Divisi Investasi I',  ROLES.ANGGOTA_DIVISI, DIVISIONS.DIV_INVESTASI, ''],
    ['ainvestasi2','Anggota Divisi Investasi II', ROLES.ANGGOTA_DIVISI, DIVISIONS.DIV_INVESTASI, ''],
    ['khukum',     'Ketua Divisi Hukum',    ROLES.KETUA_DIVISI,   DIVISIONS.DIV_HUKUM,     'hukum@apii-jabo.or.id'],
    ['ahukum1',    'Anggota Divisi Hukum I',  ROLES.ANGGOTA_DIVISI, DIVISIONS.DIV_HUKUM,     ''],
    ['ahukum2',    'Anggota Divisi Hukum II', ROLES.ANGGOTA_DIVISI, DIVISIONS.DIV_HUKUM,     ''],
    ['kumum',      'Ketua Divisi Umum',     ROLES.KETUA_DIVISI,   DIVISIONS.DIV_UMUM,      'umum@apii-jabo.or.id'],
    ['aumum1',     'Anggota Divisi Umum I',  ROLES.ANGGOTA_DIVISI, DIVISIONS.DIV_UMUM,      ''],
    ['aumum2',     'Anggota Divisi Umum II', ROLES.ANGGOTA_DIVISI, DIVISIONS.DIV_UMUM,      '']
  ];
  // Migrasi nama akun lama -> konvensi 27 akun (jika belum ada targetnya).
  var renames = { 'ahumas': 'ahumas1' };
  for (var oldU in renames) {
    var legacy = findOne('Sheet_Users', { username: oldU });
    var target = findOne('Sheet_Users', { username: renames[oldU] });
    if (legacy && !target) {
      updateRow('Sheet_Users', legacy._row, {
        username: renames[oldU],
        updated_at: new Date().toISOString()
      });
    }
  }

  var now = new Date().toISOString();
  demo.forEach(function (row) {
    var existing = findOne('Sheet_Users', { username: row[0] });
    if (existing) return; // jangan timpa akun yang sudah ada
    insert('Sheet_Users', {
      id: uuid(),
      username: row[0],
      password_hash: hashPassword(password),
      full_name: row[1],
      email: row[4],
      role: row[2],
      division: row[3],
      is_active: 'TRUE',
      can_manage_users: row[2] === ROLES.SUPERADMIN ? 'TRUE' : 'FALSE',
      permissions: '', // warisi default peran (lihat effectivePermissions_)
      created_at: now,
      updated_at: now
    });
  });
  Logger.log('Seed ' + demo.length + ' akun demo selesai (password: ' + password + ').');
}

