/**
 * SIAP APII v3.0.0 Enterprise - Auth.gs
 * Manajemen Otentikasi, Kredensial SHA-256 + Salt, Sesi UUID 7-Hari & 8-Role RBAC
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Mendapatkan atau Menghasilkan Salt Kriptografi Dinamis dari ScriptProperties
 */
function getPasswordSalt_() {
  var props = PropertiesService.getScriptProperties();
  var salt = props.getProperty('APII_PASSWORD_SALT');
  if (!salt) {
    salt = Utilities.getUuid() + '-' + Math.random().toString(36).substring(2);
    props.setProperty('APII_PASSWORD_SALT', salt);
  }
  return salt;
}

/**
 * Hash Kata Sandi dengan Algoritma SHA-256 + Salt
 */
function hashPassword_(plainPassword) {
  var salt = getPasswordSalt_();
  return sha256Hex_(plainPassword + ':' + salt);
}

/**
 * Helper Pemeriksaan Role Read-Only (Pembina & Pengawas)
 */
function isReadOnlyRole_(role) {
  return role === 'pembina' || role === 'pengawas';
}

/**
 * Helper Guard Otorisasi Peran Mutasi (RBAC & SoD)
 * Menolak tegas seluruh mutasi oleh peran Read-Only (pembina & pengawas)
 */
function assertAllowedRoles_(session, allowedRoles) {
  if (!session || !session.valid) {
    return { ok: false, code: 'AUTH_EXPIRED', error: 'Sesi pengurus tidak valid atau telah kedaluwarsa.' };
  }
  if (isReadOnlyRole_(session.role)) {
    return { ok: false, code: 'READ_ONLY_ROLE', error: 'Akses Ditolak: Peran "' + session.role + '" bersifat Read-Only (hanya baca) dan dilarang melakukan mutasi data.' };
  }
  if (allowedRoles && allowedRoles.indexOf(session.role) === -1) {
    return { ok: false, code: 'FORBIDDEN_ROLE', error: 'Akses Ditolak: Peran "' + session.role + '" tidak memiliki otoritas untuk aksi ini.' };
  }
  return { ok: true };
}

/**
 * Helper Pemeriksaan Otoritas Eksekutif Nasional (DPP Pusat)
 */
function isNationalExecutive_(session) {
  if (!session) return false;
  if (session.role === 'superadmin') return true;
  return ['ketua', 'sekretaris', 'bendahara', 'pembina', 'pengawas'].indexOf(session.role) !== -1 && session.wilayahId === 'DPP_PUSAT';
}

/**
 * Resolusi Wilayah Tenant yang Sah Berdasarkan Yurisdiksi Sesi Pemanggil
 */
function resolveAuthorizedWilayah_(session, requestedWilayahId) {
  var sessionWilayah = (session && session.wilayahId) ? session.wilayahId : 'DPP_PUSAT';
  if (isNationalExecutive_(session)) {
    return requestedWilayahId || sessionWilayah;
  }
  return sessionWilayah;
}

/**
 * Guard Isolasi Tenant Pada Mutasi/Pembacaan Rekod Spesifik
 */
function assertRecordTenantAccess_(session, recordWilayahId) {
  if (!session || !session.valid) {
    return { ok: false, code: 'AUTH_EXPIRED', error: 'Sesi pengurus tidak valid.' };
  }
  if (isNationalExecutive_(session)) {
    return { ok: true };
  }
  if (recordWilayahId && String(recordWilayahId) !== String(session.wilayahId)) {
    return { ok: false, code: 'TENANT_FORBIDDEN', error: 'Akses Tenant Ditolak: Anda tidak memiliki hak akses terhadap data wilayah "' + recordWilayahId + '".' };
  }
  return { ok: true };
}

/**
 * Autentikasi Login Pengurus
 */
function handleLogin_(username, password, requestedWilayahId, meta) {
  if (!username || !password) {
    return { ok: false, error: 'Username dan kata sandi wajib diisi.' };
  }

  var users = dbFind('Sheet_Users', { username: username });
  if (users.length === 0) {
    // Coba cari berdasarkan email
    users = dbFind('Sheet_Users', { email: username });
  }

  if (users.length === 0) {
    return { ok: false, error: 'Akun pengurus tidak ditemukan.' };
  }

  var userRow = users[0];
  var isActive = String(userRow[COL_USERS.IS_ACTIVE]).toLowerCase() === 'true' || String(userRow[COL_USERS.IS_ACTIVE]) === '1';
  if (!isActive) {
    return { ok: false, error: 'Akun Anda dinonaktifkan oleh administrator. Silakan hubungi Sekretaris Jenderal atau Superadmin.' };
  }

  // Verifikasi hash password
  var inputHash = hashPassword_(password);
  var storedHash = userRow[COL_USERS.PASSWORD_HASH];

  if (inputHash !== storedHash) {
    // Audit kegagalan login
    logAudit(username, requestedWilayahId || userRow[COL_USERS.WILAYAH_ID], 'LOGIN_FAILED', 'User', userRow[COL_USERS.USER_ID], { reason: 'Password salah' });
    return { ok: false, error: 'Kata sandi tidak sesuai. Silakan periksa kembali.' };
  }

  // Pengurus Berhasil Login -> Terbitkan Token UUID 7 Hari
  var token = Utilities.getUuid();
  var now = new Date();
  var expireDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 Hari
  var loginAtStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
  var expireStr = Utilities.formatDate(expireDate, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');

  var userWilayah = userRow[COL_USERS.WILAYAH_ID] || 'DPP_PUSAT';
  var userRole = userRow[COL_USERS.ROLE] || 'anggota_divisi';
  var userDivisi = userRow[COL_USERS.DIVISI] || '';
  var userFullname = userRow[COL_USERS.FULLNAME] || userRow[COL_USERS.USERNAME];
  var deviceLabel = (meta && meta.device) ? meta.device : 'Web Portal Browser';
  var ipAddr = (meta && meta.ipAddress) ? meta.ipAddress : 'GAS-WebApp';

  // Simpan Sesi Baru (Multi-device concurrent session didukung)
  dbInsert('Sheet_Sessions', [
    token,
    userRow[COL_USERS.USER_ID],
    userRow[COL_USERS.USERNAME],
    userRole,
    userWilayah,
    expireStr,
    userDivisi,
    userFullname,
    deviceLabel,
    ipAddr,
    loginAtStr
  ]);

  // Bersihkan sesi lama yang sudah kedaluwarsa secara berkala (atomic lock)
  purgeExpiredSessions_();

  // Audit sukses login
  logAudit(userRow[COL_USERS.USER_ID], userWilayah, 'LOGIN_SUCCESS', 'Session', token, { role: userRole, divisi: userDivisi });

  return {
    ok: true,
    token: token,
    user: {
      userId: userRow[COL_USERS.USER_ID],
      username: userRow[COL_USERS.USERNAME],
      fullname: userFullname,
      email: userRow[COL_USERS.EMAIL],
      phone: userRow[COL_USERS.PHONE],
      role: userRole,
      divisi: userDivisi,
      wilayahId: userWilayah,
      isNationalExecutive: ['superadmin', 'ketua', 'sekretaris', 'bendahara', 'pembina', 'pengawas'].indexOf(userRole) !== -1 && userWilayah === 'DPP_PUSAT'
    }
  };
}

/**
 * Validasi Token Sesi Aktif & Status Keaktifan Akun Pengurus
 */
function validateSession_(token) {
  if (!token) return { valid: false };

  var session = dbFindOne('Sheet_Sessions', { token: token });
  if (!session) return { valid: false };

  var expireStr = session[COL_SESSIONS.EXPIRES_AT];
  var expireDate = parseDateString_(expireStr);
  var now = new Date();

  if (now > expireDate) {
    // Sesi telah kedaluwarsa -> hapus
    dbDelete('Sheet_Sessions', COL_SESSIONS.TOKEN, token);
    return { valid: false };
  }

  // Periksa status is_active terkini di Sheet_Users (Mencegah akses token lama oleh pejabat demisioner)
  var userId = session[COL_SESSIONS.USER_ID];
  var userRow = dbFindOne('Sheet_Users', { user_id: userId });
  if (!userRow) {
    userRow = dbFindOne('Sheet_Users', { username: session[COL_SESSIONS.USERNAME] });
  }
  if (!userRow) {
    dbDelete('Sheet_Sessions', COL_SESSIONS.TOKEN, token);
    return { valid: false };
  }
  var isActive = String(userRow[COL_USERS.IS_ACTIVE]).toLowerCase() === 'true' || String(userRow[COL_USERS.IS_ACTIVE]) === '1';
  if (!isActive) {
    revokeAllUserSessions_(userRow[COL_USERS.USER_ID]);
    return { valid: false, error: 'Akun telah dinonaktifkan (Demisioner).' };
  }

  return {
    valid: true,
    token: token,
    userId: userRow[COL_USERS.USER_ID],
    username: userRow[COL_USERS.USERNAME],
    fullname: userRow[COL_USERS.FULLNAME] || session[COL_SESSIONS.FULLNAME] || userRow[COL_USERS.USERNAME],
    role: userRow[COL_USERS.ROLE] || session[COL_SESSIONS.ROLE],
    divisi: userRow[COL_USERS.DIVISI] || session[COL_SESSIONS.DIVISI] || '',
    wilayahId: userRow[COL_USERS.WILAYAH_ID] || session[COL_SESSIONS.WILAYAH_ID]
  };
}

/**
 * Pencabutan Seluruh Sesi Aktif Milik Pengguna (Saat Demisioner, Ganti Sandi, atau Reset Sandi)
 */
function revokeAllUserSessions_(usernameOrUserId) {
  if (!usernameOrUserId) return 0;
  return withScriptLock_(function() {
    try {
      var sheet = getTableSheet_('Sheet_Sessions');
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      if (lastRow <= 1 || lastCol <= 0) return 0;

      var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
      var target = String(usernameOrUserId);
      var removed = 0;

      for (var i = data.length - 1; i >= 0; i--) {
        if (String(data[i][COL_SESSIONS.USER_ID]) === target || String(data[i][COL_SESSIONS.USERNAME]) === target) {
          sheet.deleteRow(i + 2);
          removed++;
        }
      }
      if (removed > 0) {
        SpreadsheetApp.flush();
      }
      return removed;
    } catch (e) {
      Logger.log('revokeAllUserSessions_ error: ' + e.message);
      return 0;
    }
  }, 10000);
}

/**
 * Pembersihan Sesi Kedaluwarsa secara Bottom-Up di dalam Atomic ScriptLock
 */
function purgeExpiredSessions_() {
  return withScriptLock_(function() {
    try {
      var sheet = getTableSheet_('Sheet_Sessions');
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      if (lastRow <= 1 || lastCol <= 0) return;

      var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
      var now = new Date();
      var removed = 0;

      for (var i = data.length - 1; i >= 0; i--) {
        var expStr = data[i][COL_SESSIONS.EXPIRES_AT];
        if (expStr) {
          var expDate = parseDateString_(expStr);
          if (now > expDate) {
            sheet.deleteRow(i + 2);
            removed++;
          }
        }
      }
      if (removed > 0) {
        SpreadsheetApp.flush();
      }
    } catch (e) {
      Logger.log('purgeExpiredSessions_ error: ' + e.message);
    }
  }, 10000);
}

/**
 * Logout Pengurus
 */
function handleLogout_(token) {
  if (token) {
    dbDelete('Sheet_Sessions', COL_SESSIONS.TOKEN, token);
  }
  return { ok: true, message: 'Berhasil keluar dari portal SIAP APII.' };
}

/**
 * Ganti Kata Sandi Mandiri (Sekaligus Mencabut Sesi Lama)
 */
function handleChangePassword_(userId, oldPassword, newPassword) {
  if (!oldPassword || !newPassword) {
    return { ok: false, error: 'Kata sandi lama dan baru wajib diisi.' };
  }
  if (newPassword.length < 6) {
    return { ok: false, error: 'Kata sandi baru minimal 6 karakter.' };
  }

  var user = dbFindOne('Sheet_Users', { user_id: userId });
  if (!user) return { ok: false, error: 'Pengguna tidak ditemukan.' };
  if (isReadOnlyRole_(user[COL_USERS.ROLE])) {
    // Tetap izinkan ganti sandi pribadi? Tidak perlu memblokir jika memang ada di Code.gs, atau ikuti guard.
  }

  var oldHash = hashPassword_(oldPassword);
  if (oldHash !== user[COL_USERS.PASSWORD_HASH]) {
    return { ok: false, error: 'Kata sandi lama tidak tepat.' };
  }

  var newHash = hashPassword_(newPassword);
  dbUpdate('Sheet_Users', COL_USERS.USER_ID, userId, { 6: newHash });
  revokeAllUserSessions_(userId);

  logAudit(userId, user[COL_USERS.WILAYAH_ID], 'CHANGE_PASSWORD', 'User', userId, { sessionsRevoked: true });
  return { ok: true, message: 'Kata sandi berhasil diperbarui dan seluruh sesi perangkat lain telah dicabut.' };
}

/**
 * Reset Kata Sandi Darurat oleh Superadmin (Tanpa Mencatat Plaintext ke Audit Log)
 */
function handleResetUserPassword_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin']);
  if (!roleGuard.ok) return roleGuard;

  var targetUserId = payload.target_user_id;
  if (!targetUserId) {
    return { ok: false, error: 'ID pengguna target wajib diisi.' };
  }
  var temporaryPassword = payload.new_temporary_password || 'APII@2026Baru';
  var newHash = hashPassword_(temporaryPassword);

  var updated = dbUpdate('Sheet_Users', COL_USERS.USER_ID, targetUserId, { 6: newHash });
  if (!updated) {
    return { ok: false, error: 'Pengguna target tidak ditemukan.' };
  }

  // Cabut seluruh sesi aktif pengguna target seketika
  revokeAllUserSessions_(targetUserId);

  logAudit(session.userId, session.wilayahId, 'SUPERADMIN_RESET_PASSWORD', 'User', targetUserId, {
    actionBy: 'Superadmin',
    sessionsRevoked: true
  });

  return { ok: true, message: 'Kata sandi pengguna berhasil direset menjadi kata sandi sementara dan seluruh sesi aktifnya dicabut.', temporaryPassword: temporaryPassword };
}

