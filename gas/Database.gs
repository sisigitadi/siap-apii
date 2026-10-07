/**
 * ============================================================================
 * Database.gs — Wrapper Tunggal Akses Google Sheets
 * ============================================================================
 * Satu-satunya file yang menyentuh SpreadsheetApp. Modul domain (Surat/
 * Keuangan/Divisi/Auth) HANYA memanggil API di sini, tidak pernah Sheet
 * langsung. Inilah yang membuat backend data bisa diganti tanpa sentuh domain.
 *
 * Konvensi: baris 1 = header (nama kolom). Baris 2+ = data.
 * ==========================================================================*/

// Nama tab (sheet) di spreadsheet database.
var TABS = {
  USERS: 'Sheet_Users',
  SESSIONS: 'Sheet_Sessions',
  SURAT: 'Sheet_Surat',
  KEUANGAN: 'Sheet_Keuangan',
  DIVISI: 'Sheet_Divisi',
  AUDIT: 'Sheet_AuditLogs',
  SEQUENCES: 'Sheet_Sequences'
};

// Definisi header tiap tab (dipakai initSchema & insert).
var SCHEMA = {};
SCHEMA[TABS.USERS] = ['id', 'username', 'password_hash', 'full_name', 'email', 'role',
  'division', 'is_active', 'can_manage_users', 'created_at', 'updated_at'];
SCHEMA[TABS.SESSIONS] = ['token', 'user_id', 'username', 'role', 'division',
  'created_at', 'expired_at'];
SCHEMA[TABS.SURAT] = ['id', 'letter_number', 'title', 'letter_type', 'content', 'status',
  'tanggal_surat', 'created_by', 'created_by_name', 'created_at', 'submitted_at',
  'published_at', 'approved_by', 'rejection_notes', 'sha256_hash', 'pdf_url', 'qr_verify_url'];
SCHEMA[TABS.KEUANGAN] = ['id', 'voucher_number', 'type', 'account', 'amount', 'category',
  'description', 'transaction_date', 'status', 'verified_by_bendahara',
  'verified_by_bendahara_at', 'verified_by_ketum', 'verified_by_ketum_at',
  'rejection_notes', 'created_by', 'created_at'];
SCHEMA[TABS.DIVISI] = ['id', 'tracking_id', 'division', 'program_title', 'description',
  'budget_estimate', 'target_audience', 'execution_date', 'status', 'submitted_by',
  'submitted_by_name', 'submitted_at', 'reviewed_by', 'reviewed_at', 'approval_notes',
  'created_at'];
SCHEMA[TABS.AUDIT] = ['timestamp', 'actor', 'action', 'detail'];
SCHEMA[TABS.SEQUENCES] = ['key', 'value'];

/**
 * Inisialisasi semua tab + header. Idempoten.
 * Dipanggil oleh setup(). Bisa juga dijalankan manual untuk membuat tab baru.
 */
function initSchema() {
  var ss = getSpreadsheet_();
  for (var tab in SCHEMA) {
    var sheet = ss.getSheetByName(tab);
    if (!sheet) {
      sheet = ss.insertSheet(tab);
    }
    // Tulis header hanya bila baris 1 kosong (jangan timpa data existing).
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, SCHEMA[tab].length).setValues([SCHEMA[tab]]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, SCHEMA[tab].length)
        .setFontWeight('bold')
        .setBackground('#E6F4EC');
    }
  }
  return true;
}

/** Buka spreadsheet database (ID dari KONFIG; bisa juga via Script Properties). */
function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('DB_SPREADSHEET_ID') ||
           KONFIG.DB_SPREADSHEET_ID;
  if (!id) throw new Error('DB_SPREADSHEET_ID belum diset (isi di 00-Konfig.gs).');
  return SpreadsheetApp.openById(id);
}

/**
 * Baca seluruh baris tab sebagai array objek (dengan field header).
 * @param {string} tab nama tab
 * @return {Array<object>} [{ field: value, _row: <nomor baris> }]
 */
function readAll(tab) {
  var sheet = getSpreadsheet_().getSheetByName(tab);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return []; // hanya header / kosong
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var obj = { _row: i + 2 }; // baris 2 adalah data pertama
    for (var c = 0; c < headers.length; c++) {
      var key = headers[c];
      if (!key) continue;
      var val = rows[i][c];
      if (val === null || val === undefined) {
        val = '';
      } else if (typeof val === 'boolean') {
        val = val ? 'TRUE' : 'FALSE';
      }
      obj[key] = val;
    }
    out.push(obj);
  }
  return out;
}

/**
 * Cari baris pertama yang cocok semua filter.
 * @param {string} tab
 * @param {object} filter { field: value } (string compare case-sensitive)
 * @return {object|null} objek baris atau null
 */
function findOne(tab, filter) {
  var rows = readAll(tab);
  for (var i = 0; i < rows.length; i++) {
    if (matchFilter_(rows[i], filter)) return rows[i];
  }
  return null;
}

/** Cari semua baris yang cocok filter. */
function findMany(tab, filter) {
  return readAll(tab).filter(function (r) { return matchFilter_(r, filter); });
}

function matchFilter_(row, filter) {
  for (var k in filter) {
    var want = filter[k];
    var have = row[k];
    if (typeof want === 'boolean' || typeof have === 'boolean') {
      var bWant = want === true || String(want).toUpperCase() === 'TRUE';
      var bHave = have === true || String(have).toUpperCase() === 'TRUE';
      if (bWant !== bHave) return false;
    } else if (typeof want === 'string') {
      if (String(have) !== want) return false;
    } else if (have !== want) {
      return false;
    }
  }
  return true;
}

/**
 * Tambahkan satu baris. Hanya field yang ada di SCHEMA[tab] yang ditulis
 * (field tidak dikenal diabaikan agar header tetap rapi).
 * @param {string} tab
 * @param {object} values { field: value }
 * @return {object} nilai yang ditulis + _row
 */
function insert(tab, values) {
  var sheet = getSpreadsheet_().getSheetByName(tab);
  if (!sheet) throw new Error('Tab tidak ditemukan: ' + tab);
  var headers = SCHEMA[tab];
  var row = headers.map(function (h) {
    var v = values[h];
    return (v === undefined || v === null) ? '' : v;
  });
  sheet.appendRow(row);
  var obj = { _row: sheet.getLastRow() };
  headers.forEach(function (h, i) { obj[h] = row[i]; });
  return obj;
}

/**
 * Perbarui satu baris berdasarkan _row (dari hasil readAll/findOne/findMany).
 * Hanya field di SCHEMA[tab] yang diperbarui.
 * @param {string} tab
 * @param {number} rowNum nomor baris (obj._row)
 * @param {object} values { field: value } field yang ingin diubah
 */
function updateRow(tab, rowNum, values) {
  var sheet = getSpreadsheet_().getSheetByName(tab);
  if (!sheet) throw new Error('Tab tidak ditemukan: ' + tab);
  var headers = SCHEMA[tab];
  var range = sheet.getRange(rowNum, 1, 1, headers.length);
  var currentValues = range.getValues()[0];
  var hasChange = false;
  headers.forEach(function (h, idx) {
    if (values[h] !== undefined && values[h] !== null) {
      currentValues[idx] = values[h];
      hasChange = true;
    }
  });
  if (!hasChange) return false;
  range.setValues([currentValues]);
  return true;
}

/**
 * Hapus satu baris (berdasarkan _row).
 */
function deleteRow(tab, rowNum) {
  var sheet = getSpreadsheet_().getSheetByName(tab);
  if (!sheet) return false;
  sheet.deleteRow(rowNum);
  return true;
}

/**
 * Ambil & increment nomor urut berikutnya (aman konkuren via LockService).
 * @param {string} key mis. 'SURAT:SK:2026' atau 'KEU:2026'
 * @return {number} nilai counter setelah increment
 */
function nextSequence(key) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // tunggu maks 10 detik
  } catch (e) {
    throw new Error('Sistem sibuk, coba beberapa saat lagi.');
  }
  try {
    var row = findOne(TABS.SEQUENCES, { key: key });
    var next = 1;
    if (row) {
      next = (parseInt(row.value, 10) || 0) + 1;
      updateRow(TABS.SEQUENCES, row._row, { value: next });
    } else {
      insert(TABS.SEQUENCES, { key: key, value: 1 });
    }
    return next;
  } finally {
    lock.releaseLock();
  }
}
