/**
 * SIAP APII v3.0.0 Enterprise - Database.gs
 * ACID Wrapper 28 Tabel Google Sheets dengan Atomic Mutex Lock & Index-Based Column Mapping
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

// Konstanta Pemetaan Kolom Berbasis Indeks Integer (Index-Based Column Mapping)
// Mencegah kerapuhan referensi string header (Standar Rekayasa RetroBOT v3.0)

var COL_WILAYAH = { ID: 0, NAMA: 1, KODE: 2, SLUG: 3, ALAMAT: 4, IS_ACTIVE: 5 };
var COL_USERS = { USER_ID: 0, WILAYAH_ID: 1, USERNAME: 2, FULLNAME: 3, EMAIL: 4, PHONE: 5, PASSWORD_HASH: 6, ROLE: 7, PERMISSIONS: 8, IS_ACTIVE: 9, CREATED_AT: 10, DIVISI: 11 };
var COL_SESSIONS = { TOKEN: 0, USER_ID: 1, USERNAME: 2, ROLE: 3, WILAYAH_ID: 4, EXPIRES_AT: 5, DIVISI: 6, FULLNAME: 7, DEVICE: 8, IP_ADDRESS: 9, LOGIN_AT: 10 };
var COL_SETTINGS = { KEY: 0, VALUE: 1, WILAYAH_ID: 2, UPDATED_BY: 3, UPDATED_AT: 4 };
var COL_SETTINGS_AUDIT = { ID: 0, KEY: 1, OLD_VALUE: 2, NEW_VALUE: 3, CHANGED_BY: 4, TIMESTAMP: 5 };
var COL_SEQUENCES = { TENANT_ID: 0, COUNTER_TYPE: 1, CURRENT_VAL: 2, LAST_UPDATED: 3 };
var COL_AUDIT_LOGS = { ID: 0, TIMESTAMP: 1, USER_ID: 2, WILAYAH_ID: 3, ACTION: 4, ENTITY: 5, RECORD_ID: 6, DETAILS_JSON: 7, IP_ADDRESS: 8 };

var COL_SURAT_KELUAR = { ID: 0, WILAYAH_ID: 1, NOMOR_SURAT: 2, TIPE: 3, PERIHAL: 4, TUJUAN: 5, TANGGAL: 6, TANGGAL_HIJRIAH: 7, KONTEN_JSON: 8, STATUS: 9, SIGNED_BY: 10, HASH_SHA256: 11, PDF_DRIVE_URL: 12, CREATED_BY: 13, CREATED_AT: 14, CATATAN_REVISI: 15 };
var COL_SURAT_MASUK = { ID: 0, WILAYAH_ID: 1, NO_AGENDA: 2, ASAL_SURAT: 3, NO_SURAT_ASLI: 4, TGL_SURAT: 5, TGL_TERIMA: 6, PERIHAL: 7, RINGKASAN: 8, PDF_FILE_URL: 9, STATUS_DISPOSISI: 10, CREATED_AT: 11 };
var COL_DISPOSISI = { ID: 0, WILAYAH_ID: 1, SURAT_MASUK_ID: 2, DRAF_REKOMENDASI_SEKRETARIS: 3, INSTRUKSI_KETUA: 4, TUJUAN_DIVISI_PEJABAT: 5, TINGKAT_URGENSI: 6, BATAS_WAKTU: 7, CATATAN_TAMBAHAN: 8, PARAF_KETUA: 9, STATUS: 10, LAPORAN_TINDAK_LANJUT: 11, UPDATED_AT: 12, LAPORAN_PER_DIVISI: 13 };
var COL_TEMPLATES = { ID: 0, WILAYAH_ID: 1, KODE_TEMPLATE: 2, JUDUL: 3, STRUKTUR_JSON: 4, IS_DEFAULT: 5 };

var COL_KEUANGAN = { ID: 0, WILAYAH_ID: 1, NO_VOUCHER: 2, TIPE: 3, KANTONG_SYARIAH: 4, KATEGORI: 5, NOMINAL: 6, TANGGAL: 7, KETERANGAN: 8, BUKTI_URL: 9, STATUS_APPROVAL: 10, VERIFIED_BENDAHARA_BY: 11, APPROVED_KETUA_BY: 12, NO_KWITANSI: 13, CREATED_AT: 14 };
var COL_ACCOUNTS = { ID: 0, WILAYAH_ID: 1, NAMA_AKUN: 2, NO_REKENING: 3, ATAS_NAMA: 4, TIPE_AKUN: 5, IS_ACTIVE: 6 };
var COL_KAS_SIMULATOR = { ID: 0, WILAYAH_ID: 1, NAMA_SIMULASI: 2, SCENARIO_JSON: 3, CREATED_BY: 4, CREATED_AT: 5 };
var COL_CAUSES = { ID: 0, WILAYAH_ID: 1, JUDUL_PROGRAM: 2, DIVISI_KODE: 3, TARGET_NOMINAL: 4, TERKUMPUL_NOMINAL: 5, DESKRIPSI: 6, BANNER_URL: 7, STATUS: 8, EXPIRES_AT: 9 };

var COL_DIVISI = { ID: 0, WILAYAH_ID: 1, DIVISI_KODE: 2, NAMA_PROGRAM: 3, LATAR_BELAKANG: 4, TARGET_SASARAN: 5, RAB_NOMINAL: 6, TGL_PELAKSANAAN: 7, STATUS: 8, CATATAN_KETUA: 9, LPJ_DRIVE_URL: 10, REALISASI_DANA: 11, CREATED_BY: 12, UPDATED_AT: 13, KANTONG_SYARIAH: 14 };
var COL_PENDAFTAR = { ID: 0, WILAYAH_ID: 1, NIK: 2, NAMA: 3, TEMPAT_LAHIR: 4, TGL_LAHIR: 5, GENDER: 6, ALAMAT: 7, NO_WA: 8, EMAIL: 9, DIVISI_MINAT: 10, KTP_WATERMARK_URL: 11, PASFOTO_URL: 12, STATUS: 13, VERIFIED_SEKRETARIS_AT: 14, APPROVED_KETUA_AT: 15, NIA_ASSIGNED: 16 };
var COL_KTA_NASIONAL = { NIA: 0, WILAYAH_ID: 1, PENDAFTAR_ID: 2, NAMA_LENGKAP: 3, TINGKAT_LISENSI: 4, TGL_TERBIT: 5, TGL_KEDALUWARSA: 6, KODE_ETIK_VERSI: 7, KTA_DRIVE_URL: 8, QR_VERIFY_URL: 9, IS_ACTIVE: 10 };
var COL_ATTENDANCE = { ID: 0, WILAYAH_ID: 1, EVENT_NAMA: 2, TANGGAL: 3, NIA: 4, NAMA_ANGGOTA: 5, SCAN_TIMESTAMP: 6, VERIFIED_BY: 7 };

var COL_EDITORIAL_HISTORY = { ID: 0, WILAYAH_ID: 1, KATEGORI: 2, JUDUL: 3, KONTEN: 4, AUTHOR: 5, UPDATED_AT: 6 };
var COL_VISITORS = { ID: 0, WILAYAH_ID: 1, TIMESTAMP: 2, IP_HASH: 3, USER_AGENT: 4, PAGE_VIEWED: 5 };

var COL_ADVOKASI = { ID: 0, WILAYAH_ID: 1, TIKET_NO: 2, NAMA_DAI: 3, KONTAK: 4, LOKASI: 5, KRONOLOGI: 6, URGENSI: 7, BUKTI_URL: 8, STATUS: 9, CATATAN_LBH: 10, UPDATED_AT: 11 };
var COL_MUALLAF = { ID: 0, WILAYAH_ID: 1, REG_NO: 2, NAMA_ASLI: 3, NAMA_HIJRAH: 4, TGL_SYAHADAT: 5, PEMBIMBING: 6, SERTIFIKAT_URL: 7, STATUS_ZAKAT: 8, CREATED_AT: 9 };
var COL_ASSETS = { ID: 0, WILAYAH_ID: 1, KODE_ASET: 2, NAMA_BARANG: 3, KATEGORI: 4, KONDISI: 5, LOKASI_SIMPAN: 6, QR_URL: 7, CREATED_AT: 8 };
var COL_ASSET_LOANS = { ID: 0, WILAYAH_ID: 1, ASET_ID: 2, DIVISI_PEMINJAM: 3, PENANGGUNG_JAWAB: 4, TGL_PINJAM: 5, TGL_KEMBALI_RENCANA: 6, TGL_KEMBALI_AKTUAL: 7, STATUS: 8 };
var COL_CONSULTATIONS = { ID: 0, TOKEN_HASH: 1, TIKET_NO: 2, TOPIK: 3, PERTANYAAN: 4, JAWABAN: 5, STATUS: 6, CREATED_AT: 7, ANSWERED_AT: 8 };
var COL_KNOWLEDGE_BASE = { ID: 0, KATEGORI: 1, TOPIK: 2, DALIL_TEXT: 3, SUMBER_REFERENSI: 4, KATA_KUNCI: 5, CURATED_BY: 6, UPDATED_AT: 7 };
var COL_MEETINGS = { ID: 0, WILAYAH_ID: 1, JUDUL_RAPAT: 2, TANGGAL: 3, NOTULEN_TEXT: 4, ACTION_ITEMS_JSON: 5, DOKUMENTASI_URL: 6, PARAF_PIMPINAN: 7, CREATED_BY: 8 };
var COL_TABAYYUN = { ID: 0, WILAYAH_ID: 1, JUDUL: 2, KATEGORI_ISU: 3, KLARIFIKASI: 4, SUMBER_RUJUKAN: 5, STATUS: 6, AUTHOR: 7, CREATED_AT: 8, UPDATED_AT: 9 };

// Definisi Skema Tabel Google Sheets
var TABLES_SCHEMA = {
  Sheet_Wilayah: ['id', 'nama', 'kode', 'slug', 'alamat', 'is_active'],
  Sheet_Users: ['user_id', 'wilayah_id', 'username', 'fullname', 'email', 'phone', 'password_hash', 'role', 'permissions', 'is_active', 'created_at', 'divisi'],
  Sheet_Sessions: ['token', 'user_id', 'username', 'role', 'wilayah_id', 'expires_at', 'divisi', 'fullname', 'device', 'ip_address', 'login_at'],
  Sheet_Settings: ['key', 'value', 'wilayah_id', 'updated_by', 'updated_at'],
  Sheet_Settings_Audit: ['id', 'key', 'old_value', 'new_value', 'changed_by', 'timestamp'],
  Sheet_Sequences: ['tenant_id', 'counter_type', 'current_val', 'last_updated'],
  Sheet_AuditLogs: ['id', 'timestamp', 'user_id', 'wilayah_id', 'action', 'entity', 'record_id', 'details_json', 'ip_address'],
  Sheet_Surat: ['id', 'wilayah_id', 'nomor_surat', 'tipe', 'perihal', 'tujuan', 'tanggal', 'tanggal_hijriah', 'konten_json', 'status', 'signed_by', 'hash_sha256', 'pdf_drive_url', 'created_by', 'created_at', 'catatan_revisi'],
  Sheet_Surat_Masuk: ['id', 'wilayah_id', 'no_agenda', 'asal_surat', 'no_surat_asli', 'tgl_surat', 'tgl_terima', 'perihal', 'ringkasan', 'pdf_file_url', 'status_disposisi', 'created_at'],
  Sheet_Disposisi: ['id', 'wilayah_id', 'surat_masuk_id', 'draf_rekomendasi_sekretaris', 'instruksi_ketua', 'tujuan_divisi_pejabat', 'tingkat_urgensi', 'batas_waktu', 'catatan_tambahan', 'paraf_ketua', 'status', 'laporan_tindak_lanjut', 'updated_at', 'laporan_per_divisi'],
  Sheet_Templates: ['id', 'wilayah_id', 'kode_template', 'judul', 'struktur_json', 'is_default'],
  Sheet_Keuangan: ['id', 'wilayah_id', 'no_voucher', 'tipe', 'kantong_syariah', 'kategori', 'nominal', 'tanggal', 'keterangan', 'bukti_url', 'status_approval', 'verified_bendahara_by', 'approved_ketua_by', 'no_kwitansi', 'created_at'],
  Sheet_Accounts: ['id', 'wilayah_id', 'nama_akun', 'no_rekening', 'atas_nama', 'tipe_akun', 'is_active'],
  Sheet_Kas_Simulator: ['id', 'wilayah_id', 'nama_simulasi', 'scenario_json', 'created_by', 'created_at'],
  Sheet_Causes: ['id', 'wilayah_id', 'judul_program', 'divisi_kode', 'target_nominal', 'terkumpul_nominal', 'deskripsi', 'banner_url', 'status', 'expires_at'],
  Sheet_Divisi: ['id', 'wilayah_id', 'divisi_kode', 'nama_program', 'latar_belakang', 'target_sasaran', 'rab_nominal', 'tgl_pelaksanaan', 'status', 'catatan_ketua', 'lpj_drive_url', 'realisasi_dana', 'created_by', 'updated_at', 'kantong_syariah'],
  Sheet_Pendaftar: ['id', 'wilayah_id', 'nik', 'nama', 'tempat_lahir', 'tgl_lahir', 'gender', 'alamat', 'no_wa', 'email', 'divisi_minat', 'ktp_watermark_url', 'pasfoto_url', 'status', 'verified_sekretaris_at', 'approved_ketua_at', 'nia_assigned'],
  Sheet_KTA_Nasional: ['nia', 'wilayah_id', 'pendaftar_id', 'nama_lengkap', 'tingkat_lisensi', 'tgl_terbit', 'tgl_kedaluwarsa', 'kode_etik_versi', 'kta_drive_url', 'qr_verify_url', 'is_active'],
  Sheet_Attendance: ['id', 'wilayah_id', 'event_nama', 'tanggal', 'nia', 'nama_anggota', 'scan_timestamp', 'verified_by'],
  Sheet_EditorialHistory: ['id', 'wilayah_id', 'kategori', 'judul', 'konten', 'author', 'updated_at'],
  Sheet_Visitors: ['id', 'wilayah_id', 'timestamp', 'ip_hash', 'user_agent', 'page_viewed'],
  Sheet_Advokasi: ['id', 'wilayah_id', 'tiket_no', 'nama_dai', 'kontak', 'lokasi', 'kronologi', 'urgensi', 'bukti_url', 'status', 'catatan_lbh', 'updated_at'],
  Sheet_Muallaf: ['id', 'wilayah_id', 'reg_no', 'nama_asli', 'nama_hijrah', 'tgl_syahadat', 'pembimbing', 'sertifikat_url', 'status_zakat', 'created_at'],
  Sheet_Assets: ['id', 'wilayah_id', 'kode_aset', 'nama_barang', 'kategori', 'kondisi', 'lokasi_simpan', 'qr_url', 'created_at'],
  Sheet_Asset_Loans: ['id', 'wilayah_id', 'aset_id', 'divisi_peminjam', 'penanggung_jawab', 'tgl_pinjam', 'tgl_kembali_rencana', 'tgl_kembali_aktual', 'status'],
  Sheet_Consultations: ['id', 'token_hash', 'tiket_no', 'topik', 'pertanyaan', 'jawaban', 'status', 'created_at', 'answered_at'],
  Sheet_Knowledge_Base: ['id', 'kategori', 'topik', 'dalil_text', 'sumber_referensi', 'kata_kunci', 'curated_by', 'updated_at'],
  Sheet_Meetings: ['id', 'wilayah_id', 'judul_rapat', 'tanggal', 'notulen_text', 'action_items_json', 'dokumentasi_url', 'paraf_pimpinan', 'created_by'],
  Sheet_Tabayyun: ['id', 'wilayah_id', 'judul', 'kategori_isu', 'klarifikasi', 'sumber_rujukan', 'status', 'author', 'created_at', 'updated_at']
};

/**
 * Mendapatkan objek Spreadsheet aktif dengan proteksi
 */
function getDbSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Spreadsheet aktif tidak ditemukan. Pastikan skrip terikat pada Google Sheets APII.');
  }
  return ss;
}

/**
 * Mendapatkan Sheet berdasarkan nama tabel
 */
function getTableSheet_(tableName) {
  var ss = getDbSpreadsheet_();
  var sheet = ss.getSheetByName(tableName);
  if (!sheet) {
    throw new Error('Tabel "' + tableName + '" tidak ditemukan. Jalankan setup() terlebih dahulu.');
  }
  return sheet;
}

/**
 * Operasi Pencarian Data dengan Filter Obyek (Read)
 * Mengembalikan array of array row values (raw data stabil tanpa pergeseran timezone)
 */
function dbFind(tableName, filterObj, limit) {
  var sheet = getTableSheet_(tableName);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return [];

  // Gunakan getDisplayValues untuk stabilitas data tanggal dan format angka
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  var schema = TABLES_SCHEMA[tableName] || [];

  var results = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var match = true;

    if (filterObj) {
      for (var key in filterObj) {
        var colIdx = schema.indexOf(key);
        if (colIdx !== -1) {
          if (String(row[colIdx]) !== String(filterObj[key])) {
            match = false;
            break;
          }
        }
      }
    }

    if (match) {
      results.push(row);
      if (limit && results.length >= limit) break;
    }
  }

  return results;
}

/**
 * Pencarian Satu Baris Data (Find One)
 */
function dbFindOne(tableName, filterObj) {
  var res = dbFind(tableName, filterObj, 1);
  return res.length > 0 ? res[0] : null;
}

var __SCRIPT_LOCK_DEPTH = 0;

/**
 * Eksekusi Transaksi Atomik Re-Entrant Menggunakan ScriptLock
 * Aman dipanggil bersarang (nested) tanpa menyebabkan deadlock pada eksekutor yang sama.
 */
function withScriptLock_(fn, timeoutMs) {
  var isOuter = __SCRIPT_LOCK_DEPTH === 0;
  var lock = isOuter ? LockService.getScriptLock() : null;
  if (isOuter) {
    lock.waitLock(timeoutMs || 10000);
  }
  __SCRIPT_LOCK_DEPTH++;
  try {
    return fn();
  } finally {
    __SCRIPT_LOCK_DEPTH--;
    if (isOuter && lock) {
      try {
        lock.releaseLock();
      } catch (e) {
        Logger.log('withScriptLock_ release warning: ' + e.message);
      }
    }
  }
}

/**
 * Helper Kanonik Hash SHA-256 ke Hex String 64 Karakter Lowercase
 */
function sha256Hex_(input) {
  var rawBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(input === undefined || input === null ? '' : input), Utilities.Charset.UTF_8);
  var hexStr = '';
  for (var i = 0; i < rawBytes.length; i++) {
    var byteVal = (rawBytes[i] < 0 ? rawBytes[i] + 256 : rawBytes[i]).toString(16);
    hexStr += (byteVal.length === 1 ? '0' : '') + byteVal;
  }
  return hexStr;
}

/**
 * Operasi Penyisipan Baris Baru (Insert) dengan Atomic Mutex Lock
 */
function dbInsert(tableName, rowArray) {
  return withScriptLock_(function() {
    try {
      var sheet = getTableSheet_(tableName);
      sheet.appendRow(rowArray);
      SpreadsheetApp.flush(); // Penulisan mutlak sebelum melepaskan lock
      return true;
    } catch (err) {
      Logger.log('dbInsert Error [' + tableName + ']: ' + err.message);
      throw err;
    }
  }, 10000);
}

/**
 * Operasi Pembaruan Baris (Update Row)
 * Mendukung 4 argumen: (tableName, keyColIndex, keyValue, updatedColMap)
 * maupun 3 argumen: (tableName, filterObj, updatedColMap)
 */
function dbUpdate(tableName, keyColOrFilter, keyValOrMap, maybeUpdatedMap) {
  var isFilterMode = (typeof keyColOrFilter === 'object' && keyColOrFilter !== null);
  var filterObj = isFilterMode ? keyColOrFilter : null;
  var keyColIndex = isFilterMode ? -1 : keyColOrFilter;
  var keyValue = isFilterMode ? null : keyValOrMap;
  var updatedColMap = isFilterMode ? keyValOrMap : maybeUpdatedMap;

  if (!updatedColMap || typeof updatedColMap !== 'object') {
    return false;
  }

  return withScriptLock_(function() {
    try {
      var sheet = getTableSheet_(tableName);
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      if (lastRow <= 1 || lastCol <= 0) return false;

      var schema = TABLES_SCHEMA[tableName] || [];
      if (!isFilterMode && typeof keyColIndex === 'string') {
        var resolvedKeyIdx = (!isNaN(Number(keyColIndex)) && String(Number(keyColIndex)) === String(keyColIndex).trim())
          ? Number(keyColIndex)
          : schema.indexOf(keyColIndex);
        keyColIndex = resolvedKeyIdx;
      }

      var range = sheet.getRange(2, 1, lastRow - 1, lastCol);
      var values = range.getValues();
      var updated = false;

      for (var i = 0; i < values.length; i++) {
        var isMatch = false;
        if (isFilterMode) {
          isMatch = true;
          var hasFilterKey = false;
          for (var fKey in filterObj) {
            hasFilterKey = true;
            var fColIdx = (!isNaN(Number(fKey)) && String(Number(fKey)) === String(fKey).trim())
              ? Number(fKey)
              : schema.indexOf(fKey);
            if (fColIdx === -1 || fColIdx >= values[i].length || String(values[i][fColIdx]) !== String(filterObj[fKey])) {
              isMatch = false;
              break;
            }
          }
          if (!hasFilterKey) isMatch = false;
        } else {
          isMatch = (keyColIndex >= 0 && keyColIndex < values[i].length && String(values[i][keyColIndex]) === String(keyValue));
        }

        if (isMatch) {
          for (var colKey in updatedColMap) {
            var trimmedKey = String(colKey).trim();
            var isNumKey = trimmedKey !== '' && !isNaN(Number(colKey)) && String(Number(colKey)) === trimmedKey;
            var targetColIdx = isNumKey ? Number(colKey) : schema.indexOf(colKey);
            if (targetColIdx !== -1 && (targetColIdx < lastCol || targetColIdx < schema.length)) {
              while (values[i].length <= targetColIdx) {
                values[i].push('');
              }
              values[i][targetColIdx] = updatedColMap[colKey];
            }
          }
          sheet.getRange(i + 2, 1, 1, values[i].length).setValues([values[i]]);
          updated = true;
          break;
        }
      }

      if (updated) {
        SpreadsheetApp.flush();
      }
      return updated;
    } catch (err) {
      Logger.log('dbUpdate Error [' + tableName + ']: ' + err.message);
      throw err;
    }
  }, 10000);
}

/**
 * Operasi Penghapusan Baris (Delete Row)
 * Mendukung 3 argumen: (tableName, keyColIndex, keyValue)
 * maupun 2 argumen: (tableName, filterObj)
 */
function dbDelete(tableName, keyColOrFilter, keyValue) {
  var isFilterMode = (typeof keyColOrFilter === 'object' && keyColOrFilter !== null);
  var filterObj = isFilterMode ? keyColOrFilter : null;
  var keyColIndex = isFilterMode ? -1 : keyColOrFilter;

  return withScriptLock_(function() {
    try {
      var sheet = getTableSheet_(tableName);
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      if (lastRow <= 1 || lastCol <= 0) return false;

      var schema = TABLES_SCHEMA[tableName] || [];
      if (!isFilterMode && typeof keyColIndex === 'string') {
        keyColIndex = (!isNaN(Number(keyColIndex)) && String(Number(keyColIndex)) === String(keyColIndex).trim())
          ? Number(keyColIndex)
          : schema.indexOf(keyColIndex);
      }

      var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
      var deletedCount = 0;

      for (var i = values.length - 1; i >= 0; i--) {
        var isMatch = false;
        if (isFilterMode) {
          isMatch = true;
          var hasFilterKey = false;
          for (var fKey in filterObj) {
            hasFilterKey = true;
            var fColIdx = (!isNaN(Number(fKey)) && String(Number(fKey)) === String(fKey).trim())
              ? Number(fKey)
              : schema.indexOf(fKey);
            if (fColIdx === -1 || fColIdx >= values[i].length || String(values[i][fColIdx]) !== String(filterObj[fKey])) {
              isMatch = false;
              break;
            }
          }
          if (!hasFilterKey) isMatch = false;
        } else {
          isMatch = (keyColIndex >= 0 && keyColIndex < values[i].length && String(values[i][keyColIndex]) === String(keyValue));
        }

        if (isMatch) {
          sheet.deleteRow(i + 2);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        SpreadsheetApp.flush();
        return true;
      }
      return false;
    } catch (err) {
      Logger.log('dbDelete Error [' + tableName + ']: ' + err.message);
      throw err;
    }
  }, 10000);
}

/**
 * Generator Nomor Urut Sekuensial Atomic (Counter Anti-Loncat & Anti-Ganda)
 * Format counter_type: SURAT, BKM, BKK, AGENDA, NIA
 */
function getNextSequence(tenantId, counterType) {
  return withScriptLock_(function() {
    try {
      var sheet = getTableSheet_('Sheet_Sequences');
      var lastRow = sheet.getLastRow();
      var nowFormatted = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
      var currentNum = 1;

      if (lastRow > 1) {
        var data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
        var foundRowIdx = -1;

        for (var i = 0; i < data.length; i++) {
          if (String(data[i][COL_SEQUENCES.TENANT_ID]) === String(tenantId) &&
              String(data[i][COL_SEQUENCES.COUNTER_TYPE]) === String(counterType)) {
            currentNum = Number(data[i][COL_SEQUENCES.CURRENT_VAL]) + 1;
            foundRowIdx = i + 2;
            break;
          }
        }

        if (foundRowIdx !== -1) {
          sheet.getRange(foundRowIdx, 3, 1, 2).setValues([[currentNum, nowFormatted]]);
        } else {
          sheet.appendRow([tenantId, counterType, currentNum, nowFormatted]);
        }
      } else {
        sheet.appendRow([tenantId, counterType, currentNum, nowFormatted]);
      }

      SpreadsheetApp.flush();
      return currentNum;
    } catch (err) {
      Logger.log('getNextSequence Error: ' + err.message);
      throw err;
    }
  }, 10000);
}

/**
 * Pencatatan Log Audit Permanen WORM (Write-Once-Read-Many)
 */
function logAudit(userId, wilayahId, action, entity, recordId, detailsObj, ipAddress) {
  try {
    var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
    var detailsJson = detailsObj ? JSON.stringify(detailsObj) : '{}';
    var logId = 'LOG-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000);

    dbInsert('Sheet_AuditLogs', [
      logId,
      nowStr,
      userId || 'ANONYMOUS',
      wilayahId || 'DPP_PUSAT',
      action,
      entity,
      recordId || '',
      detailsJson,
      ipAddress || ''
    ]);
  } catch (e) {
    Logger.log('Gagal mencatat audit log: ' + e.message);
  }
}


/**
 * Helper Parsing Tanggal Mendukung format dd-MM-yyyy maupun yyyy-MM-dd
 */
function parseDateString_(str) {
  if (!str) return new Date();
  if (str instanceof Date) return str;
  var s = String(str).trim();
  var m = s.match(/^(\d{2})-(\d{2})-(\d{4})(.*)$/);
  if (m) {
    return new Date(m[3] + '-' + m[2] + '-' + m[1] + (m[4] ? m[4].replace(' ', 'T') : 'T00:00:00') + '+07:00');
  }
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(s)) {
    return new Date(s);
  }
  return new Date((s.indexOf(' ') !== -1 ? s.replace(' ', 'T') : (s.indexOf('T') !== -1 ? s : s + 'T00:00:00')) + '+07:00');
}
