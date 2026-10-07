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
  SEQUENCES: 'Sheet_Sequences',
  PENDAFTAR: 'Sheet_Pendaftar',
  ACCOUNTS: 'Sheet_Accounts',
  SETTINGS: 'Sheet_Settings'
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
  'rejection_notes', 'created_by', 'created_at', 'receipt_url'];
SCHEMA[TABS.DIVISI] = ['id', 'tracking_id', 'division', 'program_title', 'description',
  'budget_estimate', 'target_audience', 'execution_date', 'status', 'submitted_by',
  'submitted_by_name', 'submitted_at', 'reviewed_by', 'reviewed_at', 'approval_notes',
  'created_at', 'started_at', 'lpj_url', 'lpj_notes', 'realisasi_anggaran', 'lpj_submitted_at'];
SCHEMA[TABS.AUDIT] = ['id', 'timestamp', 'actor', 'action', 'module', 'detail', 'ip_client', 'status'];
SCHEMA[TABS.SEQUENCES] = ['key', 'value'];
SCHEMA[TABS.PENDAFTAR] = ['id', 'reg_number', 'full_name', 'nik', 'birth_place', 'birth_date',
  'gender', 'job', 'phone', 'email', 'address', 'division_interest', 'ktp_drive_url',
  'selfie_drive_url', 'status', 'verified_by_sekretaris', 'verified_by_sekretaris_at',
  'approved_by_ketum', 'approved_by_ketum_at', 'rejection_notes', 'created_at'];
SCHEMA[TABS.ACCOUNTS] = ['id', 'code', 'name', 'bank_name', 'account_number', 'holder_name',
  'category', 'is_active', 'show_on_public', 'created_at', 'updated_at'];
SCHEMA[TABS.SETTINGS] = ['key', 'value', 'description', 'updated_by', 'updated_at'];

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
    } else {
      // Auto-migrate: tambahkan kolom baru jika belum ada di header baris 1
      var lastCol = sheet.getLastColumn();
      var currentHeaders = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
      SCHEMA[tab].forEach(function(col) {
        if (currentHeaders.indexOf(col) === -1) {
          lastCol++;
          sheet.getRange(1, lastCol).setValue(col).setFontWeight('bold').setBackground('#E6F4EC');
        }
      });
    }
  }

  // Seed default master rekening jika kosong
  seedDefaultAccounts_();

  // Seed default pengaturan sistem jika kosong
  seedDefaultSettings_();

  return true;
}

/** Seed rekening kas bawaan jika Sheet_Accounts kosong (dikosongkan agar pengurus menginput rekening riil via portal). */
function seedDefaultAccounts_() {
  // Tidak mengisi dummy rekening secara otomatis. Rekening dikelola penuh oleh pengurus via portal master rekening.
}

/** Seed pengaturan bawaan jika Sheet_Settings kosong. */
function seedDefaultSettings_() {
  try {
    var settings = readAll(TABS.SETTINGS);
    var now = new Date().toISOString();
    var setIfMissing = function (key, val, desc) {
      var exist = settings.some(function (s) { return s.key === key; });
      if (!exist) {
        insert(TABS.SETTINGS, {
          key: key, value: typeof val === 'object' ? JSON.stringify(val) : String(val),
          description: desc, updated_by: 'system', updated_at: now
        });
      }
    };

    setIfMissing('letter_numbering', {
      pattern: '{urut}/{kode}/{org}/{bulanRomawi}/{tahun}',
      org_code: 'DPW-APII',
      digits: 3,
      reset_cycle: 'yearly'
    }, 'Format penomoran surat resmi');

    setIfMissing('letter_types', [
      { code: 'SK', label: 'Surat Keputusan', prefix: 'SK', active: true },
      { code: 'UNDANGAN', label: 'Surat Undangan', prefix: 'UND', active: true },
      { code: 'PENGANTAR', label: 'Surat Pengantar', prefix: 'PENG', active: true },
      { code: 'KETERANGAN', label: 'Surat Keterangan', prefix: 'KET', active: true },
      { code: 'TUGAS', label: 'Surat Tugas', prefix: 'TUG', active: true },
      { code: 'REKOMENDASI', label: 'Surat Rekomendasi', prefix: 'REK', active: true },
      { code: 'EDARAN', label: 'Surat Edaran', prefix: 'EDR', active: true },
      { code: 'NOTULEN', label: 'Notulen Rapat', prefix: 'NOT', active: true },
      { code: 'RAPAT', label: 'Hasil Rapat / Risalah Rapat', prefix: 'RAPAT', active: true },
      { code: 'BA', label: 'Berita Acara', prefix: 'BA', active: true }
    ], 'Daftar jenis naskah dan surat resmi');

    setIfMissing('letter_kop', {
      mode: 'text',
      custom_kop_image: '',
      org_name: 'DEWAN PIMPINAN WILAYAH APOLOGET ISLAM INDONESIA (APII) JABODETABEK',
      address: 'DKI Jakarta & Sekitarnya, Indonesia',
      phone: '0812-8888-2026',
      email: 'sekretariat@apii.sigitadi.id',
      website: 'https://apii.sigitadi.id'
    }, 'Pengaturan KOP surat dan logo');

    setIfMissing('public_config', {
      show_verification: true,
      show_finance: true,
      show_programs: true,
      show_accounts: true,
      announcement_banner: 'Selamat datang di Portal Resmi Yayasan APII DPW Jabodetabek.'
    }, 'Pengaturan visibilitas portal publik');

    setIfMissing('drive_storage', {
      custom_folder_id: '',
      folder_name: 'APII Jabo - PDF Surat Resmi'
    }, 'Pengaturan penyimpanan Google Drive');

    setIfMissing('registration_config', {
      is_open: true,
      closed_title: 'Pendaftaran Anggota Sementara Ditutup',
      closed_message: 'Pendaftaran gelombang saat ini telah ditutup atau sedang dalam proses verifikasi kuota. Pantau pengumuman resmi berkala dari sekretariat yayasan.',
      instructions: 'Silakan isi formulir pendaftaran anggota Yayasan APII DPW Jabodetabek dengan data yang valid sesuai identitas KTP resmi.',
      require_ktp: true,
      require_selfie: true,
      max_file_size_mb: 3,
      reg_prefix: 'REG',
      reg_digits: 4,
      open_divisions: [
        'DIV_DAKWAH',
        'DIV_HUKUM',
        'DIV_HUMAS',
        'DIV_MEDIA',
        'DIV_SOSIAL',
        'DIV_LITBANG',
        'DIV_EKONOMI'
      ],
      contact_wa: '081288882026',
      wa_template: 'Halo Sekretariat APII DPW Jabodetabek, saya telah mendaftar anggota baru dengan No. Registrasi: {reg_number} a.n {full_name}. Mohon verifikasi berkas saya.',
      notify_email: 'sekretariat@apii.sigitadi.id',
      agreement_text: 'Saya menyatakan bahwa data yang saya berikan adalah benar dan sah. Saya bersedia menaati AD/ART, kode etik, dan peraturan Yayasan APII DPW Jabodetabek.'
    }, 'Pengaturan pendaftaran anggota dan rekrutmen');
  } catch (e) {
    Logger.log('Gagal seed settings: ' + e);
  }
}

/** Buka spreadsheet database (ID dari KONFIG; bisa juga via Script Properties). */
function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('DB_SPREADSHEET_ID') ||
           KONFIG.DB_SPREADSHEET_ID;
  if (!id) throw new Error('DB_SPREADSHEET_ID belum diset (isi di 00-Konfig.gs).');
  return SpreadsheetApp.openById(id);
}

/**
 * Ambil tab sheet secara aman. Jika tab belum ada di spreadsheet dan terdaftar di SCHEMA,
 * sheet akan dibuat secara otomatis beserta header lengkapnya.
 * @param {string} tab nama tab
 * @return {GoogleAppsScript.Spreadsheet.Sheet|null}
 */
function getSheetSafe_(tab) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(tab);
  if (!sheet && SCHEMA && SCHEMA[tab]) {
    try {
      sheet = ss.insertSheet(tab);
      sheet.getRange(1, 1, 1, SCHEMA[tab].length).setValues([SCHEMA[tab]]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, SCHEMA[tab].length)
        .setFontWeight('bold')
        .setBackground('#E6F4EC');
    } catch (e) {
      Logger.log('Gagal auto-create sheet ' + tab + ': ' + e);
      sheet = ss.getSheetByName(tab);
    }
  }
  return sheet;
}

/**
 * Baca seluruh baris tab sebagai array objek (dengan field header).
 * @param {string} tab nama tab
 * @return {Array<object>} [{ field: value, _row: <nomor baris> }]
 */
function readAll(tab) {
  var sheet = getSheetSafe_(tab);
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
  var sheet = getSheetSafe_(tab);
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
  var sheet = getSheetSafe_(tab);
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
 * PERINGATAN: TABS.AUDIT bersifat WORM (Write Once, Read Many) permanen dan dilarang dihapus.
 */
function deleteRow(tab, rowNum) {
  if (tab === TABS.AUDIT) {
    throw new Error('AKSES DITOLAK: Jejak audit sistem bersifat permanen dan tidak dapat dihapus.');
  }
  var sheet = getSheetSafe_(tab);
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
