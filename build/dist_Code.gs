/**
 * SIAP APII v3.0.0 Enterprise - dist_Code.gs (Bundled Distribution)
 * Single-File Distribution untuk Google Apps Script Web App
 * 
 * Tanggal Kompilasi: 2026-11-14T04:50:58.150Z
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */


// ============================================================================
// BERKAS: Database.gs
// ============================================================================

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


// ============================================================================
// BERKAS: Auth.gs
// ============================================================================

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



// ============================================================================
// BERKAS: HijriEngine.gs
// ============================================================================

/**
 * SIAP APII v3.0.0 Enterprise - HijriEngine.gs
 * Mesin Konversi Penanggalan Hijriah Otomatis Standar Kemenag RI / Ummul Qura
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

var NAMA_BULAN_HIJRIAH = [
  'Muharram', 'Safar', 'Rabiul Awwal', 'Rabiul Akhir',
  'Jumadil Awal', 'Jumadil Akhir', 'Rajab', 'Sya\'ban',
  'Ramadhan', 'Syawwal', 'Dzulqa\'dah', 'Dzulhijjah'
];

var NAMA_BULAN_MASEHI = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Konversi Tanggal Gregorian (Masehi) ke Penanggalan Hijriah
 * Menggunakan pendekatan Algoritma Astromonis Ummul Qura dengan penyesuaian kriteria Kemenag RI
 */
function getHijriDate(dateObj) {
  var d = dateObj ? new Date(dateObj) : new Date();

  // Hitung Julian Day Number
  var year = d.getFullYear();
  var month = d.getMonth() + 1;
  var day = d.getDate();

  if (month < 3) {
    year -= 1;
    month += 12;
  }

  var a = Math.floor(year / 100);
  var b = 2 - a + Math.floor(a / 4);
  var jd = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;

  // Transformasi ke Kalender Hijriah Tabular dengan offset Imkanur Rukyah
  var z = Math.floor(jd + 0.5);
  var cyc = Math.floor((z - 1948440 + 1.06) / 10631);
  var rem = (z - 1948440 + 1.06) - 10631 * cyc;
  var j = Math.floor((rem + 0.05) / 354.366);
  var hYear = 30 * cyc + j;
  var remDays = rem - Math.floor(j * 354.366);
  var hMonth = Math.min(11, Math.floor((remDays + 0.5) / 29.5));
  var hDay = Math.floor(remDays - Math.floor(hMonth * 29.5) + 1);

  if (hDay <= 0) {
    hDay = 29;
    hMonth = (hMonth + 11) % 12;
  }

  return {
    day: hDay,
    monthIndex: hMonth,
    monthName: NAMA_BULAN_HIJRIAH[hMonth],
    year: hYear + 1,
    formatted: hDay + ' ' + NAMA_BULAN_HIJRIAH[hMonth] + ' ' + (hYear + 1) + ' H'
  };
}

/**
 * Format Penanggalan Dwi-Kalender Resmi untuk KOP Naskah Dinas APII
 * Contoh: "Jakarta, 28 Jumadil Awal 1448 H / 09 November 2026 M"
 */
function formatOfficialDateKop(kota, dateObj) {
  var d = dateObj ? new Date(dateObj) : new Date();
  var hijri = getHijriDate(d);
  var mDay = d.getDate();
  var mMonthName = NAMA_BULAN_MASEHI[d.getMonth()];
  var mYear = d.getFullYear();
  var padDay = mDay < 10 ? '0' + mDay : '' + mDay;

  var kotaName = kota || 'Jakarta';
  return kotaName + ', ' + hijri.formatted + ' / ' + padDay + ' ' + mMonthName + ' ' + mYear + ' M';
}



// ============================================================================
// BERKAS: TemplateSuratDocs.gs
// ============================================================================

/**
 * SIAP APII v3.0.0 Enterprise - TemplateSuratDocs.gs
 * Spesifikasi Layout Virtual A4, KOP Dinamis DPP/DPW & Stempel Basah Transparan Multiply
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Metadata KOP Surat Resmi DPP & DPW se-Indonesia
 */
function getKopMetadata(wilayahId) {
  var wilayahRow = dbFindOne('Sheet_Wilayah', { id: wilayahId });
  var isDPP = !wilayahId || wilayahId === 'DPP_PUSAT';

  if (isDPP) {
    return {
      tingkat: 'DEWAN PIMPINAN PUSAT',
      namaLembaga: 'YAYASAN APOLOGET ISLAM INDONESIA (APII)',
      legalitas: 'SK Kemenkumham RI: Nomor AHU-0014970.AH.01.04.Tahun 2023',
      alamat: 'Gedung Dakwah Pusat APII, Jakarta, Indonesia',
      kontak: 'Email: dpp@apologetislamindonesia.or.id | Website: apologetislamindonesia.or.id',
      kodeSuratTenant: 'DPP-APII',
      kotaKop: 'Jakarta'
    };
  } else {
    var namaWilayah = wilayahRow ? wilayahRow[COL_WILAYAH.NAMA] : 'Wilayah';
    var kodeTenant = wilayahRow ? wilayahRow[COL_WILAYAH.KODE] : 'DPW';
    var alamatWilayah = wilayahRow ? wilayahRow[COL_WILAYAH.ALAMAT] : 'Sekretariat DPW APII';
    return {
      tingkat: 'DEWAN PIMPINAN WILAYAH (' + namaWilayah.toUpperCase() + ')',
      namaLembaga: 'YAYASAN APOLOGET ISLAM INDONESIA (APII)',
      legalitas: 'SK Kemenkumham RI: Nomor AHU-0014970.AH.01.04.Tahun 2023',
      alamat: alamatWilayah,
      kontak: 'Website: ' + (wilayahRow ? wilayahRow[COL_WILAYAH.SLUG] : 'dpw') + '.apologetislamindonesia.or.id',
      kodeSuratTenant: kodeTenant,
      kotaKop: namaWilayah.replace('DPW ', '')
    };
  }
}

/**
 * Konversi Bulan Integer (1-12) ke Format Romawi Baku Naskah Dinas Indonesia
 */
function toRomanMonth(monthNum) {
  var roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return roman[monthNum] || 'I';
}

/**
 * Struktur Konsideran Baku Surat Keputusan (SK) Pengesahan Kepengurusan
 */
function getKonsideranSKStruktur(wilayahNama, periodeTahun) {
  return {
    menimbang: [
      'Bahwa demi terwujudnya kesinambungan dakwah apologetika Islam yang berkesinambungan, transparan, dan akuntabel di tingkat ' + wilayahNama + ', dipandang perlu mengesahkan susunan kepengurusan definitif.',
      'Bahwa personil yang namanya tercantum dalam lampiran keputusan ini dipandang cakap, amanah, dan memenuhi syarat untuk memangku amanah kepengurusan organisasi.'
    ],
    mengingat: [
      'Undang-Undang Republik Indonesia Nomor 28 Tahun 2004 tentang Perubahan atas Undang-Undang Nomor 16 Tahun 2001 tentang Yayasan.',
      'Keputusan Menteri Hukum dan Hak Asasi Manusia Republik Indonesia Nomor AHU-0014970.AH.01.04.Tahun 2023.',
      'Anggaran Dasar dan Anggaran Rumah Tangga (AD/ART) Yayasan Apologet Islam Indonesia.'
    ],
    memperhatikan: [
      'Hasil musyawarah mufakat pimpinan dan kader tertanggal ' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd MMMM yyyy') + '.'
    ],
    memutuskan: [
      'Mengesahkan Susunan Pengurus ' + wilayahNama + ' Masa Bakti ' + (periodeTahun || '2026-2031') + ' sebagaimana tercantum dalam lampiran yang merupakan bagian tidak terpisahkan dari keputusan ini.',
      'Surat Keputusan ini berlaku sejak tanggal ditetapkan dengan ketentuan apabila terdapat kekeliruan di kemudian hari akan diadakan perbaikan sebagaimana mestinya.'
    ]
  };
}



// ============================================================================
// BERKAS: Surat.gs
// ============================================================================

/**
 * SIAP APII v3.0.0 Enterprise - Surat.gs
 * Alur Kerja Persuratan Keluar, Penomoran Sekuensial Atomic, Verifikasi Hash & Drive Vault
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Daftar Surat Keluar Berdasarkan Tenant Pengurus
 */
function handleGetSuratList_(session, payload) {
  var reqWilayah = payload && payload.wilayah_id ? payload.wilayah_id : session.wilayahId;
  var targetWilayah = resolveAuthorizedWilayah_(session, reqWilayah);

  var filter = targetWilayah === 'ALL' ? null : { wilayah_id: targetWilayah };
  var rawList = dbFind('Sheet_Surat', filter, 200);

  var list = rawList.map(function(row) {
    return {
      id: row[COL_SURAT_KELUAR.ID],
      wilayahId: row[COL_SURAT_KELUAR.WILAYAH_ID],
      nomorSurat: row[COL_SURAT_KELUAR.NOMOR_SURAT],
      tipe: row[COL_SURAT_KELUAR.TIPE],
      perihal: row[COL_SURAT_KELUAR.PERIHAL],
      tujuan: row[COL_SURAT_KELUAR.TUJUAN],
      tanggal: row[COL_SURAT_KELUAR.TANGGAL],
      tanggalHijriah: row[COL_SURAT_KELUAR.TANGGAL_HIJRIAH],
      kontenJson: row[COL_SURAT_KELUAR.KONTEN_JSON],
      status: row[COL_SURAT_KELUAR.STATUS],
      signedBy: row[COL_SURAT_KELUAR.SIGNED_BY],
      hash: row[COL_SURAT_KELUAR.HASH_SHA256],
      pdfUrl: row[COL_SURAT_KELUAR.PDF_DRIVE_URL],
      createdBy: row[COL_SURAT_KELUAR.CREATED_BY],
      createdAt: row[COL_SURAT_KELUAR.CREATED_AT],
      catatanRevisi: row[COL_SURAT_KELUAR.CATATAN_REVISI] || ''
    };
  });

  return { ok: true, list: list };
}

/**
 * Simpan / Ajukan Draf Naskah Dinas Keluar (Sekretaris - SoD Pengonsep)
 */
function handleSaveSurat_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'sekretaris']);
  if (!roleGuard.ok) return roleGuard;

  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);
  var suratId = payload.id || ('SRT-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000));
  var kopMeta = getKopMetadata(wilayahId);
  var now = new Date();
  var tglStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy');
  var hijriFormatted = formatOfficialDateKop(kopMeta.kotaKop, now);

  var status = payload.status || 'DRAFT'; // DRAFT, DRAFT_REVISI, atau AJUKAN
  if (status === 'APPROVED' || status === 'PUBLISHED') {
    status = 'AJUKAN'; // Pengonsep dilarang melangkahi otorisasi Ketua
  }

  var existing = dbFindOne('Sheet_Surat', { id: suratId });
  if (existing) {
    var tenantGuard = assertRecordTenantAccess_(session, existing[COL_SURAT_KELUAR.WILAYAH_ID]);
    if (!tenantGuard.ok) return tenantGuard;

    if (existing[COL_SURAT_KELUAR.STATUS] === 'APPROVED') {
      return { ok: false, error: 'Surat yang telah disahkan (APPROVED) tidak dapat diubah kembali.' };
    }

    var updateMap = {};
    if (payload.tipe !== undefined) updateMap[COL_SURAT_KELUAR.TIPE] = payload.tipe;
    if (payload.perihal !== undefined) updateMap[COL_SURAT_KELUAR.PERIHAL] = payload.perihal;
    if (payload.tujuan !== undefined) updateMap[COL_SURAT_KELUAR.TUJUAN] = payload.tujuan;
    if (payload.konten_json !== undefined) updateMap[COL_SURAT_KELUAR.KONTEN_JSON] = JSON.stringify(payload.konten_json || {});
    updateMap[COL_SURAT_KELUAR.STATUS] = status;
    if (status === 'AJUKAN') {
      updateMap[COL_SURAT_KELUAR.CATATAN_REVISI] = '';
    }
    dbUpdate('Sheet_Surat', COL_SURAT_KELUAR.ID, suratId, updateMap);
  } else {
    var rowArray = [
      suratId,
      wilayahId,
      payload.nomor_surat || 'DRAFT / BELUM DITERBITKAN',
      payload.tipe || 'Surat Tugas',
      payload.perihal || 'Penugasan Dakwah',
      payload.tujuan || 'Yang Dituju',
      tglStr,
      hijriFormatted,
      JSON.stringify(payload.konten_json || {}),
      status,
      '', // signed_by
      '', // hash_sha256
      '', // pdf_drive_url
      session.username,
      Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss'),
      ''  // catatan_revisi
    ];
    dbInsert('Sheet_Surat', rowArray);
  }

  logAudit(session.userId, wilayahId, 'SAVE_SURAT', 'SuratKeluar', suratId, { perihal: payload.perihal, status: status });
  return { ok: true, suratId: suratId, status: status, message: 'Draf surat berhasil disimpan.' };
}

/**
 * Pengesahan & Penerbitan Surat Keluar Resmi (Ketua Umum / Ketua Wilayah)
 * Mengunci nomor sekuensial atomic anti-loncat & membubuhkan tanda tangan + stempel resmi
 */
function handleApproveSurat_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua']);
  if (!roleGuard.ok) return roleGuard;

  var suratId = payload.surat_id || payload.id;
  if (!suratId) {
    return { ok: false, error: 'ID surat wajib disertakan.' };
  }
  var isApproved = (payload.is_approved !== false) && (payload.approved !== false) && (payload.status !== 'REJECTED'); // true = approve, false = reject
  var catatanRevisi = payload.catatan_revisi || payload.catatanRevisi || '';

  return withScriptLock_(function() {
    var suratRow = dbFindOne('Sheet_Surat', { id: suratId });
    if (!suratRow) {
      return { ok: false, error: 'Naskah surat tidak ditemukan.' };
    }

    var wilayahId = suratRow[COL_SURAT_KELUAR.WILAYAH_ID];
    var tenantGuard = assertRecordTenantAccess_(session, wilayahId);
    if (!tenantGuard.ok) return tenantGuard;

    if (suratRow[COL_SURAT_KELUAR.STATUS] === 'APPROVED') {
      return { ok: false, error: 'Surat ini sudah disahkan sebelumnya.' };
    }

    var kopMeta = getKopMetadata(wilayahId);
    var now = new Date();

    if (!isApproved) {
      // Alur Penolakan Tanpa Kunci Mati (Unblocked Rejection Loop dengan Catatan Revisi)
      var rejectMap = {};
      rejectMap[COL_SURAT_KELUAR.STATUS] = 'REJECTED';
      rejectMap[COL_SURAT_KELUAR.CATATAN_REVISI] = catatanRevisi || 'Perlu perbaikan redaksi oleh Sekretariat.';
      dbUpdate('Sheet_Surat', COL_SURAT_KELUAR.ID, suratId, rejectMap);
      logAudit(session.userId, wilayahId, 'REJECT_SURAT', 'SuratKeluar', suratId, { catatanRevisi: rejectMap[COL_SURAT_KELUAR.CATATAN_REVISI] });
      return {
        ok: true,
        status: 'REJECTED',
        catatanRevisi: rejectMap[COL_SURAT_KELUAR.CATATAN_REVISI],
        message: 'Naskah dikembalikan ke Sekretaris dengan catatan revisi.'
      };
    }

    // Jika Disetujui: Bangkitkan Nomor Sekuensial Resmi via Lock Atomic
    var counterType = 'SURAT_' + (suratRow[COL_SURAT_KELUAR.TIPE] || 'UMUM');
    var seqNum = getNextSequence(wilayahId, counterType);
    var padSeq = ('000' + seqNum).slice(-3); // 001, 002, 005
    var romanMonth = toRomanMonth(now.getMonth() + 1);
    var year = now.getFullYear();

    // Kode jenis surat
    var kodeTipe = 'ST';
    var tipe = suratRow[COL_SURAT_KELUAR.TIPE] || '';
    if (tipe.indexOf('Keputusan') !== -1) kodeTipe = 'SK';
    else if (tipe.indexOf('Mandat') !== -1) kodeTipe = 'SM';
    else if (tipe.indexOf('Undangan') !== -1) kodeTipe = 'UND';
    else if (tipe.indexOf('Rekomendasi') !== -1) kodeTipe = 'REK';
    else if (tipe.indexOf('Maklumat') !== -1) kodeTipe = 'MAK';

    // Format baku penomoran: [NOMOR_URUT]/[KODE_SURAT]-[KODE_TENANT]/[BULAN_ROMAWI]/[TAHUN]
    var nomorResmi = padSeq + '/' + kodeTipe + '-' + kopMeta.kodeSuratTenant + '/' + romanMonth + '/' + year;

    // Hitung Tanda Tangan Digital Hash SHA-256 Integritas Naskah (Deterministik untuk Verifikasi Publik)
    var rawToHash = nomorResmi + '|' + suratRow[COL_SURAT_KELUAR.PERIHAL] + '|' + suratRow[COL_SURAT_KELUAR.TANGGAL] + '|' + session.username;
    var hashSha256 = sha256Hex_(rawToHash);

    // Perbarui Database
    var approveMap = {};
    approveMap[COL_SURAT_KELUAR.NOMOR_SURAT] = nomorResmi;
    approveMap[COL_SURAT_KELUAR.STATUS] = 'APPROVED';
    approveMap[COL_SURAT_KELUAR.SIGNED_BY] = session.username;
    approveMap[COL_SURAT_KELUAR.HASH_SHA256] = hashSha256;
    approveMap[COL_SURAT_KELUAR.CATATAN_REVISI] = '';
    dbUpdate('Sheet_Surat', COL_SURAT_KELUAR.ID, suratId, approveMap);

    logAudit(session.userId, wilayahId, 'PUBLISH_SURAT', 'SuratKeluar', suratId, {
      nomorSurat: nomorResmi,
      hash: hashSha256
    });

    return {
      ok: true,
      status: 'APPROVED',
      nomorSurat: nomorResmi,
      hash: hashSha256,
      message: 'Surat dinas resmi berhasil disahkan, ditandatangani, dan diterbitkan.'
    };
  }, 10000);
}

/**
 * One-Click Decree Generator: Mengajukan Draf SK Pengesahan Susunan Kepengurusan A4 (2-Step Auth)
 * Disusun oleh Sekretaris -> Status awal AJUKAN (Menunggu Pengesahan Ketua)
 */
function handleGenerateSKKepengurusan_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'sekretaris']);
  if (!roleGuard.ok) return roleGuard;

  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);
  var wilayahRow = dbFindOne('Sheet_Wilayah', { id: wilayahId });
  var namaWilayah = wilayahRow ? wilayahRow[COL_WILAYAH.NAMA] : 'Wilayah';
  var konsideran = getKonsideranSKStruktur(namaWilayah, payload.periode_tahun);

  var kontenJson = {
    konsideran: konsideran,
    personalia: payload.personalia_list || []
  };

  return handleSaveSurat_(session, {
    wilayah_id: wilayahId,
    tipe: 'Surat Keputusan (SK)',
    perihal: 'Pengesahan Susunan Personalia Pengurus ' + namaWilayah,
    tujuan: 'Jajaran Pengurus & Anggota ' + namaWilayah,
    konten_json: kontenJson,
    status: 'AJUKAN'
  });
}



// ============================================================================
// BERKAS: SuratMasuk.gs
// ============================================================================

/**
 * SIAP APII v3.0.0 Enterprise - SuratMasuk.gs
 * Manajemen Buku Agenda Digital Surat Masuk & Registrasi Berkas Scan/PDF
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Mengambil Daftar Agenda Surat Masuk Beserta Status Disposisi Per Divisi
 */
function handleGetSuratMasukList_(session, payload) {
  var reqWilayah = payload && payload.wilayah_id ? payload.wilayah_id : session.wilayahId;
  var targetWilayah = resolveAuthorizedWilayah_(session, reqWilayah);

  var filter = targetWilayah === 'ALL' ? null : { wilayah_id: targetWilayah };
  var rawList = dbFind('Sheet_Surat_Masuk', filter, 200);
  var rawDisposisi = dbFind('Sheet_Disposisi', filter, 300);

  var dispBySuratMasuk = {};
  for (var i = 0; i < rawDisposisi.length; i++) {
    var dRow = rawDisposisi[i];
    var smId = dRow[COL_DISPOSISI.SURAT_MASUK_ID];
    var laporanPerDivisi = {};
    try {
      if (dRow[COL_DISPOSISI.LAPORAN_PER_DIVISI]) {
        laporanPerDivisi = JSON.parse(dRow[COL_DISPOSISI.LAPORAN_PER_DIVISI]);
      }
    } catch (e) {
      laporanPerDivisi = {};
    }
    dispBySuratMasuk[smId] = {
      disposisiId: dRow[COL_DISPOSISI.ID],
      drafRekomendasi: dRow[COL_DISPOSISI.DRAF_REKOMENDASI_SEKRETARIS],
      instruksiKetua: dRow[COL_DISPOSISI.INSTRUKSI_KETUA],
      targetDivisi: String(dRow[COL_DISPOSISI.TUJUAN_DIVISI_PEJABAT] || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean),
      tingkatUrgensi: dRow[COL_DISPOSISI.TINGKAT_URGENSI],
      batasWaktu: dRow[COL_DISPOSISI.BATAS_WAKTU],
      catatanTambahan: dRow[COL_DISPOSISI.CATATAN_TAMBAHAN],
      parafKetua: dRow[COL_DISPOSISI.PARAF_KETUA],
      status: dRow[COL_DISPOSISI.STATUS],
      laporanTindakLanjut: dRow[COL_DISPOSISI.LAPORAN_TINDAK_LANJUT],
      laporanPerDivisi: laporanPerDivisi
    };
  }

  var list = rawList.map(function(row) {
    var smId = row[COL_SURAT_MASUK.ID];
    var disp = dispBySuratMasuk[smId] || null;
    return {
      id: smId,
      wilayahId: row[COL_SURAT_MASUK.WILAYAH_ID],
      noAgenda: row[COL_SURAT_MASUK.NO_AGENDA],
      asalSurat: row[COL_SURAT_MASUK.ASAL_SURAT],
      noSuratAsli: row[COL_SURAT_MASUK.NO_SURAT_ASLI],
      tglSurat: row[COL_SURAT_MASUK.TGL_SURAT],
      tglTerima: row[COL_SURAT_MASUK.TGL_TERIMA],
      perihal: row[COL_SURAT_MASUK.PERIHAL],
      ringkasan: row[COL_SURAT_MASUK.RINGKASAN],
      pdfUrl: row[COL_SURAT_MASUK.PDF_FILE_URL],
      statusDisposisi: row[COL_SURAT_MASUK.STATUS_DISPOSISI],
      createdAt: row[COL_SURAT_MASUK.CREATED_AT],
      disposisi: disp
    };
  });

  return { ok: true, list: list };
}

/**
 * Registrasi Surat Masuk Baru oleh Sekretaris
 */
function handleSaveSuratMasuk_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'sekretaris']);
  if (!roleGuard.ok) return roleGuard;

  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);

  return withScriptLock_(function() {
    var suratMasukId = payload.id || ('SM-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000));
    var now = new Date();

    // Bangkitkan nomor agenda sekuensial atomic
    var seqAgenda = getNextSequence(wilayahId, 'AGENDA_MASUK');
    var noAgenda = 'AGD-' + now.getFullYear() + '-' + ('000' + seqAgenda).slice(-4); // AGD-2026-0001

    var rowArray = [
      suratMasukId,
      wilayahId,
      noAgenda,
      payload.asal_surat || 'Instansi / Perorangan Luar',
      payload.no_surat_asli || '-',
      payload.tgl_surat || Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy'),
      payload.tgl_terima || Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy'),
      payload.perihal || 'Surat Masuk',
      payload.ringkasan || '',
      payload.pdf_file_url || '',
      'MENUNGGU_DISPOSISI',
      Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
    ];

    dbInsert('Sheet_Surat_Masuk', rowArray);

    // Jika sekretaris langsung menyertakan draf rekomendasi disposisi awal
    if (payload.draf_rekomendasi || payload.tujuan_divisi) {
      var disposisiId = 'DSP-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMddHHmmss');
      dbInsert('Sheet_Disposisi', [
        disposisiId,
        wilayahId,
        suratMasukId,
        payload.draf_rekomendasi || '',
        '', // instruksi_ketua (menunggu)
        payload.tujuan_divisi || 'humas',
        payload.tingkat_urgensi || 'Biasa',
        payload.batas_waktu || '',
        payload.catatan_tambahan || '',
        '', // paraf_ketua
        'DRAF_SEKRETARIS',
        '', // laporan_tindak_lanjut
        Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss'),
        '{}' // laporan_per_divisi
      ]);
    }

    logAudit(session.userId, wilayahId, 'REGISTER_SURAT_MASUK', 'SuratMasuk', suratMasukId, { noAgenda: noAgenda });
    return { ok: true, suratMasukId: suratMasukId, noAgenda: noAgenda, message: 'Surat masuk berhasil diregistrasi ke buku agenda digital.' };
  }, 10000);
}



// ============================================================================
// BERKAS: Disposisi.gs
// ============================================================================

/**
 * SIAP APII v3.0.0 Enterprise - Disposisi.gs
 * Lembar Disposisi Digital Berjenjang, Rekomendasi Sekretaris & Distribusi Multi-Divisi
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Pengesahan Instruksi Disposisi Resmi oleh Ketua Umum / Ketua Wilayah
 * Mendukung Penambahan / Perubahan Multi-Divisi Tujuan saat Otorisasi
 */
function handleSaveDisposisi_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua']);
  if (!roleGuard.ok) return roleGuard;

  var suratMasukId = payload.surat_masuk_id;
  if (!suratMasukId) {
    return { ok: false, error: 'ID surat masuk wajib disertakan.' };
  }

  return withScriptLock_(function() {
    var smRow = dbFindOne('Sheet_Surat_Masuk', { id: suratMasukId });
    if (!smRow) {
      return { ok: false, error: 'Agenda surat masuk tidak ditemukan.' };
    }

    var wilayahId = smRow[COL_SURAT_MASUK.WILAYAH_ID];
    var tenantGuard = assertRecordTenantAccess_(session, wilayahId);
    if (!tenantGuard.ok) return tenantGuard;

    var disposisiId = payload.disposisi_id || ('DSP-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMddHHmmss'));
    var now = new Date();
    var nowStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
    var targetDivisiStr = Array.isArray(payload.tujuan_divisi_pejabat)
      ? payload.tujuan_divisi_pejabat.join(',')
      : (payload.tujuan_divisi_pejabat || 'humas');

    var existing = dbFindOne('Sheet_Disposisi', { surat_masuk_id: suratMasukId });

    if (existing) {
      disposisiId = existing[COL_DISPOSISI.ID];
      var updateMap = {};
      updateMap[COL_DISPOSISI.INSTRUKSI_KETUA] = payload.instruksi_ketua || '[1] Tindak Lanjuti Sesuai Ketentuan';
      updateMap[COL_DISPOSISI.TUJUAN_DIVISI_PEJABAT] = targetDivisiStr;
      updateMap[COL_DISPOSISI.TINGKAT_URGENSI] = payload.tingkat_urgensi || 'Biasa';
      updateMap[COL_DISPOSISI.BATAS_WAKTU] = payload.batas_waktu || '';
      updateMap[COL_DISPOSISI.CATATAN_TAMBAHAN] = payload.catatan_tambahan || '';
      updateMap[COL_DISPOSISI.PARAF_KETUA] = session.username;
      updateMap[COL_DISPOSISI.STATUS] = 'DIDISPOSISIKAN';
      updateMap[COL_DISPOSISI.UPDATED_AT] = nowStr;
      dbUpdate('Sheet_Disposisi', COL_DISPOSISI.SURAT_MASUK_ID, suratMasukId, updateMap);
    } else {
      dbInsert('Sheet_Disposisi', [
        disposisiId,
        wilayahId,
        suratMasukId,
        payload.draf_rekomendasi || '',
        payload.instruksi_ketua || '[1] Tindak Lanjuti Sesuai Ketentuan',
        targetDivisiStr,
        payload.tingkat_urgensi || 'Biasa',
        payload.batas_waktu || '',
        payload.catatan_tambahan || '',
        session.username, // Paraf Ketua
        'DIDISPOSISIKAN',
        '',
        nowStr,
        '{}' // laporan_per_divisi
      ]);
    }

    // Perbarui status surat masuk terkait
    var smUpdate = {};
    smUpdate[COL_SURAT_MASUK.STATUS_DISPOSISI] = 'SUDAH_DIDISPOSISIKAN';
    dbUpdate('Sheet_Surat_Masuk', COL_SURAT_MASUK.ID, suratMasukId, smUpdate);

    logAudit(session.userId, wilayahId, 'APPROVE_DISPOSISI', 'Disposisi', disposisiId, {
      suratMasukId: suratMasukId,
      instruksi: payload.instruksi_ketua,
      tujuan: targetDivisiStr
    });

    return {
      ok: true,
      disposisiId: disposisiId,
      status: 'DIDISPOSISIKAN',
      tujuanDivisi: targetDivisiStr,
      message: 'Lembar disposisi resmi berhasil disahkan dan didistribusikan ke divisi terkait.'
    };
  }, 10000);
}

/**
 * Pelaporan Balik Progres Tindak Lanjut Independen Per Divisi oleh Ketua Divisi
 */
function handleUpdateDisposisiProgress_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  var suratMasukId = payload.surat_masuk_id;
  if (!suratMasukId) {
    return { ok: false, error: 'ID surat masuk wajib disertakan.' };
  }

  return withScriptLock_(function() {
    var dispRow = dbFindOne('Sheet_Disposisi', { surat_masuk_id: suratMasukId });
    var smRow = dbFindOne('Sheet_Surat_Masuk', { id: suratMasukId });
    if (!dispRow && !smRow) {
      return { ok: false, error: 'Data disposisi atau surat masuk tidak ditemukan.' };
    }

    var recordWilayah = dispRow ? dispRow[COL_DISPOSISI.WILAYAH_ID] : smRow[COL_SURAT_MASUK.WILAYAH_ID];
    var tenantGuard = assertRecordTenantAccess_(session, recordWilayah);
    if (!tenantGuard.ok) return tenantGuard;

    var targetStr = dispRow ? String(dispRow[COL_DISPOSISI.TUJUAN_DIVISI_PEJABAT] || '') : '';
    var targetList = targetStr.split(',').map(function(s) { return s.trim().toLowerCase(); }).filter(Boolean);

    var divisiKode = String(payload.divisi_kode || session.divisi || '').toLowerCase();
    if (session.role === 'ketua_divisi' && session.divisi) {
      divisiKode = String(session.divisi).toLowerCase();
      if (targetList.length > 0 && targetList.indexOf(divisiKode) === -1) {
        return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Akses Ditolak: Disposisi ini tidak ditujukan kepada divisi "' + divisiKode + '".' };
      }
    }
    if (!divisiKode) {
      divisiKode = targetList[0] || 'umum';
    }

    var laporanTindakLanjut = payload.laporan_tindak_lanjut || '';
    var isTuntas = payload.is_tuntas !== false;
    var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');

    var laporanPerDivisi = {};
    if (dispRow && dispRow[COL_DISPOSISI.LAPORAN_PER_DIVISI]) {
      try {
        laporanPerDivisi = JSON.parse(dispRow[COL_DISPOSISI.LAPORAN_PER_DIVISI]);
      } catch (e) {
        laporanPerDivisi = {};
      }
    }

    laporanPerDivisi[divisiKode] = {
      laporan: laporanTindakLanjut,
      isTuntas: isTuntas,
      reportedBy: session.username,
      updatedAt: nowStr
    };

    var allDone = isTuntas;
    if (targetList.length > 0) {
      allDone = true;
      for (var i = 0; i < targetList.length; i++) {
        var entry = laporanPerDivisi[targetList[i]];
        if (!entry || entry.isTuntas !== true) {
          allDone = false;
          break;
        }
      }
    }

    var status = allDone ? 'SELESAI_DITINDAKLANJUTI' : 'DALAM_PROGRES';

    if (dispRow) {
      var dispUpdate = {};
      dispUpdate[COL_DISPOSISI.STATUS] = status;
      dispUpdate[COL_DISPOSISI.LAPORAN_TINDAK_LANJUT] = laporanTindakLanjut;
      dispUpdate[COL_DISPOSISI.UPDATED_AT] = nowStr;
      dispUpdate[COL_DISPOSISI.LAPORAN_PER_DIVISI] = JSON.stringify(laporanPerDivisi);
      dbUpdate('Sheet_Disposisi', COL_DISPOSISI.SURAT_MASUK_ID, suratMasukId, dispUpdate);
    }

    var smUpdate = {};
    smUpdate[COL_SURAT_MASUK.STATUS_DISPOSISI] = allDone ? 'SELESAI' : 'DALAM_PROGRES';
    dbUpdate('Sheet_Surat_Masuk', COL_SURAT_MASUK.ID, suratMasukId, smUpdate);

    logAudit(session.userId, recordWilayah, 'UPDATE_DISPOSISI_PROGRESS', 'Disposisi', suratMasukId, {
      divisi: divisiKode,
      status: status,
      allDone: allDone
    });

    return {
      ok: true,
      status: status,
      divisi: divisiKode,
      laporanPerDivisi: laporanPerDivisi,
      allDone: allDone,
      message: allDone ? 'Seluruh divisi tujuan telah menuntaskan laporan disposisi.' : 'Laporan progres divisi "' + divisiKode + '" berhasil dicatat (menunggu divisi lain).'
    };
  }, 10000);
}



// ============================================================================
// BERKAS: ShariaGuard.gs
// ============================================================================

/**
 * SIAP APII v3.0.0 Enterprise - ShariaGuard.gs
 * Benteng Fiqih Kas & Validasi 4 Kantong Syariah (Zakat, Infaq Dakwah, Wakaf, Amil)
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

var KANTONG_SYARIAH = {
  ZAKAT: 'ZAKAT',
  INFAQ_DAKWAH: 'INFAQ_DAKWAH',
  WAKAF: 'WAKAF',
  AMIL_OPERASIONAL: 'AMIL_OPERASIONAL'
};

/**
 * Validasi Kesesuaian Syariah Pengeluaran Kas (Sharia Guard Validation)
 * Mencegah dana Zakat terpakai untuk operasional umum non-ashnaf
 */
function validateShariaDisbursement(kantongSyariah, kategoriPengeluaran, keperluanText) {
  var kantong = (kantongSyariah || '').toUpperCase();
  var teks = ((kategoriPengeluaran || '') + ' ' + (keperluanText || '')).toLowerCase();

  // 1. Validasi Ketat Kantong Zakat (Hanya untuk 8 Ashnaf: Muallaf, Dai Pedalaman Fi Sabilillah, Fakir/Miskin)
  if (kantong === KANTONG_SYARIAH.ZAKAT) {
    var kataKunciAshnaf = ['muallaf', 'mualaf', 'fakir', 'miskin', 'santunan', 'bantuan dai', 'fi sabilillah', 'fisabilillah', 'ibnu sabil'];
    var lolosAshnaf = false;
    for (var i = 0; i < kataKunciAshnaf.length; i++) {
      if (teks.indexOf(kataKunciAshnaf[i]) !== -1) {
        lolosAshnaf = true;
        break;
      }
    }

    if (!lolosAshnaf) {
      return {
        valid: false,
        error: 'PELANGGARAN SYARIAH: Dana Zakat hanya berhak disalurkan kepada 8 Ashnaf (termasuk Muallaf Care & Bantuan Da\'i Pedalaman). Tidak boleh digunakan untuk operasional kantor, konsumsi rapat, atau pembelian aset umum.'
      };
    }
  }

  // 2. Validasi Kantong Wakaf (Hanya untuk Aset Fisik / Produktif Jangka Panjang)
  if (kantong === KANTONG_SYARIAH.WAKAF) {
    var kataKunciBukanWakaf = ['makan', 'snack', 'bensin', 'pulsa', 'honor', 'gaji'];
    for (var j = 0; j < kataKunciBukanWakaf.length; j++) {
      if (teks.indexOf(kataKunciBukanWakaf[j]) !== -1) {
        return {
          valid: false,
          error: 'PELANGGARAN SYARIAH: Dana Wakaf terikat secara hukum syariat untuk pengadaan aset fisik permanen atau wakaf produktif, bukan biaya konsumtif habis pakai.'
        };
      }
    }
  }

  return { valid: true };
}



// ============================================================================
// BERKAS: KwitansiEngine.gs
// ============================================================================

/**
 * SIAP APII v3.0.0 Enterprise - KwitansiEngine.gs
 * Generator Kwitansi Kas Dual-Slip (30% Bonggol : 70% Donatur) & Formula Terbilang Rupiah
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Formula Rekursif Terbilang Baku Bahasa Indonesia
 * Menangani angka dari satuan hingga miliaran Rupiah secara akurat
 */
function angkaKeTerbilang(nominal) {
  var bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  var n = Math.floor(Math.abs(Number(nominal) || 0));

  if (n === 0) return 'Nol Rupiah';

  function konversi(num) {
    if (num < 12) {
      return ' ' + bilangan[num];
    } else if (num < 20) {
      return konversi(num - 10) + ' Belas';
    } else if (num < 100) {
      return konversi(Math.floor(num / 10)) + ' Puluh' + konversi(num % 10);
    } else if (num < 200) {
      return ' Seratus' + konversi(num - 100);
    } else if (num < 1000) {
      return konversi(Math.floor(num / 100)) + ' Ratus' + konversi(num % 100);
    } else if (num < 2000) {
      return ' Seribu' + konversi(num - 1000);
    } else if (num < 1000000) {
      return konversi(Math.floor(num / 1000)) + ' Ribu' + konversi(num % 1000);
    } else if (num < 1000000000) {
      return konversi(Math.floor(num / 1000000)) + ' Juta' + konversi(num % 1000000);
    } else if (num < 1000000000000) {
      return konversi(Math.floor(num / 1000000000)) + ' Milyar' + konversi(num % 1000000000);
    } else {
      return konversi(Math.floor(num / 1000000000000)) + ' Triliun' + konversi(num % 1000000000000);
    }
  }

  var hasil = konversi(n).trim() + ' Rupiah';
  // Rapikan spasi ganda
  return hasil.replace(/\s+/g, ' ');
}

/**
 * Format Angka Rupiah Resmi
 * Contoh: Rp 2.500.000,-
 */
function formatRupiah(nominal) {
  var num = Number(nominal) || 0;
  var str = num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  return 'Rp ' + str + ',-';
}

/**
 * Metadata Kwitansi Dual-Slip Resmi APII
 */
function buildKwitansiData(keuanganRow, wilayahId) {
  var kop = getKopMetadata(wilayahId);
  var nominal = Number(keuanganRow[COL_KEUANGAN.NOMINAL]) || 0;

  return {
    lembaga: kop.namaLembaga,
    legalitas: kop.legalitas,
    tingkatWilayah: kop.tingkat,
    alamat: kop.alamat,
    noVoucher: keuanganRow[COL_KEUANGAN.NO_VOUCHER],
    noKwitansi: keuanganRow[COL_KEUANGAN.NO_KWITANSI],
    tipe: keuanganRow[COL_KEUANGAN.TIPE], // KAS_MASUK atau KAS_KELUAR
    kantongSyariah: keuanganRow[COL_KEUANGAN.KANTONG_SYARIAH],
    kategori: keuanganRow[COL_KEUANGAN.KATEGORI],
    nominalAngka: formatRupiah(nominal),
    nominalTerbilang: angkaKeTerbilang(nominal),
    tanggal: keuanganRow[COL_KEUANGAN.TANGGAL],
    keterangan: keuanganRow[COL_KEUANGAN.KETERANGAN],
    verifikatorBendahara: keuanganRow[COL_KEUANGAN.VERIFIED_BENDAHARA_BY],
    pengesahKetua: keuanganRow[COL_KEUANGAN.APPROVED_KETUA_BY]
  };
}



// ============================================================================
// BERKAS: Keuangan.gs
// ============================================================================

/**
 * SIAP APII v3.0.0 Enterprise - Keuangan.gs
 * Pembukuan Kas Syar'i 4 Kantong, Alur Dual-Approval, Batas Kas Tunai & Rekonsiliasi Bulanan
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Mengambil Mutasi Buku Kas & Ringkasan Saldo 4 Kantong Syariah
 */
function handleGetKeuanganList_(session, payload) {
  var reqWilayah = payload && payload.wilayah_id ? payload.wilayah_id : session.wilayahId;
  var targetWilayah = resolveAuthorizedWilayah_(session, reqWilayah);

  var filter = targetWilayah === 'ALL' ? null : { wilayah_id: targetWilayah };
  var rawList = dbFind('Sheet_Keuangan', filter, 300);

  var saldo = {
    total: 0,
    zakat: 0,
    infaqDakwah: 0,
    wakaf: 0,
    amilOperasional: 0
  };

  var list = rawList.map(function(row) {
    var nominal = Number(row[COL_KEUANGAN.NOMINAL]) || 0;
    var tipe = row[COL_KEUANGAN.TIPE]; // MASUK atau KELUAR
    var status = row[COL_KEUANGAN.STATUS_APPROVAL];
    var kantong = row[COL_KEUANGAN.KANTONG_SYARIAH] || 'INFAQ_DAKWAH';

    // Saldo hanya dipengaruhi transaksi yang APPROVED
    if (status === 'APPROVED') {
      var multiplier = (tipe === 'MASUK') ? 1 : -1;
      var net = nominal * multiplier;

      saldo.total += net;
      if (kantong === 'ZAKAT') saldo.zakat += net;
      else if (kantong === 'WAKAF') saldo.wakaf += net;
      else if (kantong === 'AMIL_OPERASIONAL') saldo.amilOperasional += net;
      else saldo.infaqDakwah += net;
    }

    return {
      id: row[COL_KEUANGAN.ID],
      wilayahId: row[COL_KEUANGAN.WILAYAH_ID],
      noVoucher: row[COL_KEUANGAN.NO_VOUCHER],
      tipe: tipe,
      kantongSyariah: kantong,
      kategori: row[COL_KEUANGAN.KATEGORI],
      nominal: nominal,
      tanggal: row[COL_KEUANGAN.TANGGAL],
      keterangan: row[COL_KEUANGAN.KETERANGAN],
      buktiUrl: row[COL_KEUANGAN.BUKTI_URL],
      status: status,
      statusApproval: status,
      verifiedBendahara: row[COL_KEUANGAN.VERIFIED_BENDAHARA_BY],
      approvedKetua: row[COL_KEUANGAN.APPROVED_KETUA_BY],
      noKwitansi: row[COL_KEUANGAN.NO_KWITANSI],
      createdAt: row[COL_KEUANGAN.CREATED_AT]
    };
  });

  return { ok: true, saldo: saldo, list: list };
}

/**
 * Helper Internal Pembukuan Kas Masuk (BKM) untuk Auto-Refund LPJ Divisi & Sistem Internal
 */
function recordInternalKasMasuk_(wilayahId, nominal, kantong, kategori, keterangan, actorUsername, actorUserId, tanggal, buktiUrl) {
  return withScriptLock_(function() {
    var now = new Date();
    var numNominal = Number(nominal) || 0;
    if (numNominal <= 0) {
      return { ok: false, error: 'Nominal kas masuk harus lebih besar dari 0.' };
    }

    var seqBkm = getNextSequence(wilayahId, 'KAS_BKM');
    var padSeq = ('000' + seqBkm).slice(-3);
    var ym = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMM');
    var noVoucher = 'BKM-' + ym + '-' + padSeq;
    var noKwitansi = 'KW-IN-' + ym + '-' + padSeq;
    var id = 'KEU-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000);

    var rowArray = [
      id,
      wilayahId,
      noVoucher,
      'MASUK',
      kantong || 'INFAQ_DAKWAH',
      kategori || 'Infaq Dakwah Umum',
      numNominal,
      tanggal || Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy'),
      keterangan || 'Penerimaan Infaq / Donasi Dakwah',
      buktiUrl || '',
      'APPROVED',
      actorUsername || 'SYSTEM',
      actorUsername || 'SYSTEM',
      noKwitansi,
      Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
    ];

    dbInsert('Sheet_Keuangan', rowArray);
    logAudit(actorUserId || 'SYSTEM', wilayahId, 'KAS_MASUK', 'Keuangan', id, { noVoucher: noVoucher, nominal: numNominal, kantong: kantong || 'INFAQ_DAKWAH' });

    return {
      ok: true,
      id: id,
      noVoucher: noVoucher,
      noKwitansi: noKwitansi,
      message: 'Kas masuk berhasil dibukukan dan kwitansi resmi siap dicetak.'
    };
  }, 10000);
}

/**
 * Pembukuan Kas Masuk (Infaq, Donasi, Zakat) - Langsung Sah oleh Bendahara
 */
function handleSaveKasMasuk_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'bendahara', 'ketua']);
  if (!roleGuard.ok) return roleGuard;

  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);
  return recordInternalKasMasuk_(
    wilayahId,
    payload.nominal,
    payload.kantong_syariah || 'INFAQ_DAKWAH',
    payload.kategori || 'Infaq Dakwah Umum',
    payload.keterangan || 'Penerimaan Infaq / Donasi Dakwah',
    session.username,
    session.userId,
    payload.tanggal,
    payload.bukti_url
  );
}

/**
 * Pengajuan Voucher Kas Keluar oleh Pengurus / Divisi (Draf Awal)
 */
function handleAjukanKasKeluar_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'bendahara', 'ketua', 'sekretaris', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);
  var now = new Date();
  var nominal = Number(payload.nominal) || 0;
  if (nominal <= 0) {
    return { ok: false, error: 'Nominal pengeluaran kas harus lebih besar dari 0.' };
  }

  var kantong = payload.kantong_syariah || 'INFAQ_DAKWAH';
  var kategori = payload.kategori || 'Operasional Kegiatan';
  var keterangan = payload.keterangan || '';

  // Validasi Sharia Guard
  var shariaCheck = validateShariaDisbursement(kantong, kategori, keterangan);
  if (!shariaCheck.valid) {
    return { ok: false, error: shariaCheck.error };
  }

  var id = 'KEU-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000);
  var draftVoucher = 'DRAFT-BKK-' + Math.floor(1000 + Math.random() * 9000);

  var rowArray = [
    id,
    wilayahId,
    draftVoucher,
    'KELUAR',
    kantong,
    kategori,
    nominal,
    payload.tanggal || Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy'),
    keterangan,
    payload.bukti_url || '',
    'VERIFIKASI_BENDAHARA', // Tahap 1
    '',
    '',
    '',
    Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
  ];

  dbInsert('Sheet_Keuangan', rowArray);
  logAudit(session.userId, wilayahId, 'AJUKAN_KAS_KELUAR', 'Keuangan', id, { nominal: nominal, kantong: kantong });

  return {
    ok: true,
    id: id,
    status: 'VERIFIKASI_BENDAHARA',
    message: 'Permohonan kas keluar berhasil diajukan untuk verifikasi nota oleh Bendahara.'
  };
}

/**
 * Dual-Approval Tahap 1: Verifikasi Kelayakan Nota oleh Bendahara
 */
function handleVerifyKasBendahara_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'bendahara']);
  if (!roleGuard.ok) return roleGuard;

  var keuId = payload.keuangan_id;
  if (!keuId) return { ok: false, error: 'ID transaksi kas wajib diisi.' };

  var row = dbFindOne('Sheet_Keuangan', { id: keuId });
  if (!row) return { ok: false, error: 'Voucher kas tidak ditemukan.' };

  var tenantGuard = assertRecordTenantAccess_(session, row[COL_KEUANGAN.WILAYAH_ID]);
  if (!tenantGuard.ok) return tenantGuard;

  var currentStatus = row[COL_KEUANGAN.STATUS_APPROVAL];
  if (currentStatus !== 'VERIFIKASI_BENDAHARA' && currentStatus !== 'VERIFIED_BENDAHARA') {
    return { ok: false, error: 'Status voucher saat ini (' + currentStatus + ') tidak berada pada antrean verifikasi Bendahara.' };
  }

  var isVerified = payload.is_verified !== false;
  var catatan = payload.catatan || '';
  var status = isVerified ? 'VERIFIKASI_KETUM' : 'REJECTED';

  var updateMap = {};
  updateMap[COL_KEUANGAN.STATUS_APPROVAL] = status;
  updateMap[COL_KEUANGAN.VERIFIED_BENDAHARA_BY] = session.username;
  dbUpdate('Sheet_Keuangan', COL_KEUANGAN.ID, keuId, updateMap);

  logAudit(session.userId, row[COL_KEUANGAN.WILAYAH_ID], 'VERIFY_KAS_BENDAHARA', 'Keuangan', keuId, { status: status, catatan: catatan });
  return { ok: true, status: status, message: isVerified ? 'Voucher lolos verifikasi Bendahara, diteruskan ke Ketua.' : 'Pengajuan kas keluar ditolak Bendahara.' };
}

/**
 * Dual-Approval Tahap 2: Pengesahan Pencairan Kas oleh Ketua Umum / Wilayah
 * Memotong saldo kas secara resmi & menerbitkan nomor BKK sekuensial
 */
function handleApproveKasKetua_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua']);
  if (!roleGuard.ok) return roleGuard;

  var keuId = payload.keuangan_id;
  if (!keuId) return { ok: false, error: 'ID transaksi kas wajib diisi.' };

  return withScriptLock_(function() {
    var row = dbFindOne('Sheet_Keuangan', { id: keuId });
    if (!row) return { ok: false, error: 'Voucher kas tidak ditemukan.' };

    var wilayahId = row[COL_KEUANGAN.WILAYAH_ID];
    var tenantGuard = assertRecordTenantAccess_(session, wilayahId);
    if (!tenantGuard.ok) return tenantGuard;

    if (row[COL_KEUANGAN.STATUS_APPROVAL] === 'APPROVED') {
      return { ok: false, error: 'Voucher kas ini sudah berstatus APPROVED sebelumnya.' };
    }

    var isApproved = payload.is_approved !== false;
    var now = new Date();

    if (!isApproved) {
      var rejectMap = {};
      rejectMap[COL_KEUANGAN.STATUS_APPROVAL] = 'REJECTED';
      rejectMap[COL_KEUANGAN.APPROVED_KETUA_BY] = session.username;
      dbUpdate('Sheet_Keuangan', COL_KEUANGAN.ID, keuId, rejectMap);
      logAudit(session.userId, wilayahId, 'REJECT_KAS_KETUA', 'Keuangan', keuId, { reason: payload.catatan || '' });
      return { ok: true, status: 'REJECTED', message: 'Pencairan kas ditolak oleh Ketua.' };
    }

    // Jika Disahkan: Terbitkan Nomor Resmi BKK Sekuensial
    var seqBkk = getNextSequence(wilayahId, 'KAS_BKK');
    var padSeq = ('000' + seqBkk).slice(-3);
    var ym = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMM');
    var noVoucherResmi = 'BKK-' + ym + '-' + padSeq; // BKK-202611-001
    var noKwitansi = 'KW-OUT-' + ym + '-' + padSeq;

    var approveMap = {};
    approveMap[COL_KEUANGAN.NO_VOUCHER] = noVoucherResmi;
    approveMap[COL_KEUANGAN.STATUS_APPROVAL] = 'APPROVED';
    approveMap[COL_KEUANGAN.APPROVED_KETUA_BY] = session.username;
    approveMap[COL_KEUANGAN.NO_KWITANSI] = noKwitansi;
    dbUpdate('Sheet_Keuangan', COL_KEUANGAN.ID, keuId, approveMap);

    logAudit(session.userId, wilayahId, 'APPROVE_KAS_KETUA', 'Keuangan', keuId, { noVoucher: noVoucherResmi, noKwitansi: noKwitansi });
    return {
      ok: true,
      status: 'APPROVED',
      noVoucher: noVoucherResmi,
      noKwitansi: noKwitansi,
      message: 'Pengeluaran kas telah disahkan resmi oleh Ketua. Saldo buku kas terpotong dan kwitansi dual-slip siap dicetak.'
    };
  }, 10000);
}

/**
 * Rekonsiliasi Kas Bulanan Otomatis (Tiap Tanggal 30/31)
 */
function handleGenerateMonthlyClosing_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'bendahara', 'ketua']);
  if (!roleGuard.ok) return roleGuard;

  var wilayahId = resolveAuthorizedWilayah_(session, payload && payload.wilayah_id);
  var data = handleGetKeuanganList_(session, { wilayah_id: wilayahId });

  var closingReport = {
    wilayahId: wilayahId,
    periodeBulan: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'MMMM yyyy'),
    saldoAkhir: data.saldo,
    totalMutasi: data.list.length,
    generatedAt: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss'),
    generatedBy: session.username
  };

  logAudit(session.userId, wilayahId, 'MONTHLY_CLOSING_GENERATED', 'Keuangan', 'CLOSING-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMM'), closingReport);
  return { ok: true, closingReport: closingReport, message: 'Laporan rekonsiliasi kas bulanan berhasil digenerate untuk Dewan Pengawas.' };
}



// ============================================================================
// BERKAS: Divisi.gs
// ============================================================================

/**
 * SIAP APII v3.0.0 Enterprise - Divisi.gs
 * Pengelolaan Program Kerja 7 Divisi Resmi (ART Pasal 16), RAB, & Pelaporan LPJ
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

var KODE_7_DIVISI = ['humas', 'litbang', 'sosmed', 'dakwah', 'bisnis', 'hukum', 'umum'];

/**
 * Mengambil Daftar Usulan Program Kerja Divisi
 */
function handleGetDivisiPrograms_(session, payload) {
  var reqWilayah = payload && payload.wilayah_id ? payload.wilayah_id : session.wilayahId;
  var targetWilayah = resolveAuthorizedWilayah_(session, reqWilayah);

  var filter = targetWilayah === 'ALL' ? null : { wilayah_id: targetWilayah };
  var rawList = dbFind('Sheet_Divisi', filter, 200);

  var list = rawList.map(function(row) {
    return {
      id: row[COL_DIVISI.ID],
      wilayahId: row[COL_DIVISI.WILAYAH_ID],
      divisiKode: row[COL_DIVISI.DIVISI_KODE],
      namaProgram: row[COL_DIVISI.NAMA_PROGRAM],
      latarBelakang: row[COL_DIVISI.LATAR_BELAKANG],
      targetSasaran: row[COL_DIVISI.TARGET_SASARAN],
      rabNominal: Number(row[COL_DIVISI.RAB_NOMINAL]) || 0,
      tglPelaksanaan: row[COL_DIVISI.TGL_PELAKSANAAN],
      status: row[COL_DIVISI.STATUS], // DRAFT, AJUKAN, DISETUJUI, PELAKSANAAN, LPJ_SELESAI, REJECTED
      catatanKetua: row[COL_DIVISI.CATATAN_KETUA],
      lpjDriveUrl: row[COL_DIVISI.LPJ_DRIVE_URL],
      realisasiDana: Number(row[COL_DIVISI.REALISASI_DANA]) || 0,
      createdBy: row[COL_DIVISI.CREATED_BY],
      updatedAt: row[COL_DIVISI.UPDATED_AT],
      kantongSyariah: row[COL_DIVISI.KANTONG_SYARIAH] || 'INFAQ_DAKWAH'
    };
  });

  return { ok: true, list: list };
}

/**
 * Simpan / Ajukan Usulan Program Kerja Divisi
 */
function handleSaveDivisiProgram_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua_divisi', 'sekretaris', 'ketua']);
  if (!roleGuard.ok) return roleGuard;

  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);
  var programId = payload.id || ('PRG-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000));
  var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
  var divisiKode = String(payload.divisi_kode || session.divisi || 'dakwah').toLowerCase();
  var kantongSyariah = payload.kantong_syariah || 'INFAQ_DAKWAH';

  if (session.role === 'ketua_divisi' && session.divisi && divisiKode !== String(session.divisi).toLowerCase()) {
    return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Ketua Divisi hanya dapat mengajukan program kerja untuk divisinya sendiri (' + session.divisi + ').' };
  }

  var existing = dbFindOne('Sheet_Divisi', { id: programId });
  if (existing) {
    var tenantGuard = assertRecordTenantAccess_(session, existing[COL_DIVISI.WILAYAH_ID]);
    if (!tenantGuard.ok) return tenantGuard;

    if (session.role === 'ketua_divisi' && session.divisi && String(existing[COL_DIVISI.DIVISI_KODE]).toLowerCase() !== String(session.divisi).toLowerCase()) {
      return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Anda tidak berwenang mengubah program kerja divisi lain.' };
    }

    var updateMap = {};
    updateMap[COL_DIVISI.DIVISI_KODE] = divisiKode;
    if (payload.nama_program !== undefined) updateMap[COL_DIVISI.NAMA_PROGRAM] = payload.nama_program;
    if (payload.latar_belakang !== undefined) updateMap[COL_DIVISI.LATAR_BELAKANG] = payload.latar_belakang;
    if (payload.target_sasaran !== undefined) updateMap[COL_DIVISI.TARGET_SASARAN] = payload.target_sasaran;
    if (payload.rab_nominal !== undefined) updateMap[COL_DIVISI.RAB_NOMINAL] = Number(payload.rab_nominal) || 0;
    if (payload.tgl_pelaksanaan !== undefined) updateMap[COL_DIVISI.TGL_PELAKSANAAN] = payload.tgl_pelaksanaan;
    updateMap[COL_DIVISI.STATUS] = payload.status || 'AJUKAN';
    if (payload.catatan_ketua !== undefined) updateMap[COL_DIVISI.CATATAN_KETUA] = payload.catatan_ketua || '';
    updateMap[COL_DIVISI.UPDATED_AT] = nowStr;
    updateMap[COL_DIVISI.KANTONG_SYARIAH] = kantongSyariah;
    dbUpdate('Sheet_Divisi', COL_DIVISI.ID, programId, updateMap);
  } else {
    var rowArray = [
      programId,
      wilayahId,
      divisiKode,
      payload.nama_program || 'Program Kerja Baru',
      payload.latar_belakang || '',
      payload.target_sasaran || '',
      Number(payload.rab_nominal) || 0,
      payload.tgl_pelaksanaan || Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy'),
      payload.status || 'AJUKAN',
      '',
      '',
      0,
      session.username,
      nowStr,
      kantongSyariah
    ];
    dbInsert('Sheet_Divisi', rowArray);
  }

  logAudit(session.userId, wilayahId, 'SAVE_PROGRAM_DIVISI', 'Divisi', programId, { divisi: divisiKode, kantong: kantongSyariah });
  return { ok: true, programId: programId, message: 'Usulan program kerja divisi berhasil disimpan.' };
}

/**
 * Pengesahan / Penolakan Pagu Program Kerja Divisi oleh Ketua
 */
function handleApproveDivisiProgram_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua']);
  if (!roleGuard.ok) return roleGuard;

  var programId = payload.program_id || payload.id;
  if (!programId) return { ok: false, error: 'ID program kerja wajib disertakan.' };

  var row = dbFindOne('Sheet_Divisi', { id: programId });
  if (!row) return { ok: false, error: 'Program kerja tidak ditemukan.' };

  var tenantGuard = assertRecordTenantAccess_(session, row[COL_DIVISI.WILAYAH_ID]);
  if (!tenantGuard.ok) return tenantGuard;

  var isApproved = payload.is_approved !== false;
  var newStatus = isApproved ? 'DISETUJUI' : 'REJECTED';
  var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');

  var updateMap = {};
  updateMap[COL_DIVISI.STATUS] = newStatus;
  updateMap[COL_DIVISI.CATATAN_KETUA] = payload.catatan_ketua || (isApproved ? 'Disetujui Ketua' : 'Perlu penyesuaian RAB');
  if (payload.rab_nominal !== undefined && Number(payload.rab_nominal) > 0) {
    updateMap[COL_DIVISI.RAB_NOMINAL] = Number(payload.rab_nominal);
  }
  updateMap[COL_DIVISI.UPDATED_AT] = nowStr;
  dbUpdate('Sheet_Divisi', COL_DIVISI.ID, programId, updateMap);

  logAudit(session.userId, row[COL_DIVISI.WILAYAH_ID], 'APPROVE_PROGRAM_DIVISI', 'Divisi', programId, { status: newStatus });
  return {
    ok: true,
    programId: programId,
    status: newStatus,
    message: isApproved ? 'Program kerja dan pagu RAB telah disetujui Ketua.' : 'Program kerja dikembalikan dengan catatan Ketua.'
  };
}

/**
 * Pengajuan Pencairan Dana Program Kerja ke Kas Syar'i (BKK Tahap 1)
 * Tidak menambah realisasi_dana sebelum BKK disahkan Ketua
 */
function handleRequestProkerDisbursement_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua_divisi', 'ketua']);
  if (!roleGuard.ok) return roleGuard;

  var programId = payload.program_id || payload.id;
  if (!programId) return { ok: false, error: 'ID program kerja wajib disertakan.' };

  var row = dbFindOne('Sheet_Divisi', { id: programId });
  if (!row) return { ok: false, error: 'Program kerja tidak ditemukan.' };

  var wilayahId = row[COL_DIVISI.WILAYAH_ID];
  var tenantGuard = assertRecordTenantAccess_(session, wilayahId);
  if (!tenantGuard.ok) return tenantGuard;

  if (session.role === 'ketua_divisi' && session.divisi && String(row[COL_DIVISI.DIVISI_KODE]).toLowerCase() !== String(session.divisi).toLowerCase()) {
    return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Anda tidak berwenang mencairkan anggaran divisi lain.' };
  }

  var statusProker = row[COL_DIVISI.STATUS];
  if (statusProker !== 'DISETUJUI' && statusProker !== 'PELAKSANAAN') {
    return { ok: false, error: 'Pencairan hanya dapat diajukan untuk program kerja berstatus DISETUJUI (Status saat ini: ' + statusProker + ').' };
  }

  var nominal = Number(payload.nominal) || Number(row[COL_DIVISI.RAB_NOMINAL]) || 0;
  var kantong = payload.kantong_syariah || row[COL_DIVISI.KANTONG_SYARIAH] || 'INFAQ_DAKWAH';
  var kategori = payload.kategori || ('Pencairan Proker: ' + row[COL_DIVISI.NAMA_PROGRAM]);
  var keterangan = payload.keterangan || ('Realisasi program kerja ' + row[COL_DIVISI.NAMA_PROGRAM] + ' [' + programId + ']');

  var shariaCheck = validateShariaDisbursement(kantong, kategori, keterangan);
  if (!shariaCheck.valid) {
    return { ok: false, error: shariaCheck.error };
  }

  var now = new Date();
  var keuId = 'KEU-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000);
  var draftVoucher = 'DRAFT-BKK-' + Math.floor(1000 + Math.random() * 9000);

  dbInsert('Sheet_Keuangan', [
    keuId,
    wilayahId,
    draftVoucher,
    'KELUAR',
    kantong,
    kategori,
    nominal,
    Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy'),
    keterangan,
    payload.bukti_url || '',
    'VERIFIKASI_BENDAHARA',
    '',
    '',
    '',
    Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
  ]);

  if (statusProker === 'DISETUJUI') {
    var progUpdate = {};
    progUpdate[COL_DIVISI.STATUS] = 'PELAKSANAAN';
    progUpdate[COL_DIVISI.UPDATED_AT] = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
    dbUpdate('Sheet_Divisi', COL_DIVISI.ID, programId, progUpdate);
  }

  logAudit(session.userId, wilayahId, 'REQUEST_PROKER_DISBURSEMENT', 'Divisi', programId, { keuId: keuId, nominal: nominal, kantong: kantong });
  return {
    ok: true,
    programId: programId,
    keuanganId: keuId,
    status: 'VERIFIKASI_BENDAHARA',
    message: 'Permohonan pencairan dana program kerja telah dikirim ke antrean verifikasi Bendahara.'
  };
}

/**
 * Pengunggahan LPJ Program Kerja & Rekonsiliasi Anggaran (Auto-Refund BKM Internal Aman)
 */
function handleSubmitDivisiLPJ_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  var programId = payload.program_id;
  if (!programId) return { ok: false, error: 'ID program kerja wajib disertakan.' };

  return withScriptLock_(function() {
    var row = dbFindOne('Sheet_Divisi', { id: programId });
    if (!row) return { ok: false, error: 'Program kerja tidak ditemukan.' };

    var wilayahId = row[COL_DIVISI.WILAYAH_ID];
    var tenantGuard = assertRecordTenantAccess_(session, wilayahId);
    if (!tenantGuard.ok) return tenantGuard;

    if (session.role === 'ketua_divisi' && session.divisi && String(row[COL_DIVISI.DIVISI_KODE]).toLowerCase() !== String(session.divisi).toLowerCase()) {
      return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Anda hanya dapat mengunggah LPJ untuk divisi sendiri.' };
    }

    var lpjDriveUrl = payload.lpj_drive_url || '';
    var realisasiDana = Number(payload.realisasi_dana) || 0;
    var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');

    var rabNominal = Number(row[COL_DIVISI.RAB_NOMINAL]) || 0;
    var sisaAnggaran = rabNominal - realisasiDana;

    var updateMap = {};
    updateMap[COL_DIVISI.STATUS] = 'LPJ_SELESAI';
    updateMap[COL_DIVISI.LPJ_DRIVE_URL] = lpjDriveUrl;
    updateMap[COL_DIVISI.REALISASI_DANA] = realisasiDana;
    updateMap[COL_DIVISI.UPDATED_AT] = nowStr;
    dbUpdate('Sheet_Divisi', COL_DIVISI.ID, programId, updateMap);

    // Jika ada sisa anggaran lebih dari 0, otomatis bukukan BKM pengembalian kas via helper internal
    var refundRes = null;
    if (sisaAnggaran > 0) {
      var kantongAsal = row[COL_DIVISI.KANTONG_SYARIAH] || 'INFAQ_DAKWAH';
      refundRes = recordInternalKasMasuk_(
        wilayahId,
        sisaAnggaran,
        kantongAsal,
        'Pengembalian Sisa Anggaran Divisi',
        'Pengembalian sisa dana kegiatan ' + row[COL_DIVISI.NAMA_PROGRAM],
        session.username,
        session.userId
      );
    }

    logAudit(session.userId, wilayahId, 'SUBMIT_LPJ', 'Divisi', programId, {
      realisasiDana: realisasiDana,
      sisaAnggaran: sisaAnggaran,
      refundVoucher: refundRes ? refundRes.noVoucher : null
    });

    return {
      ok: true,
      sisaAnggaran: sisaAnggaran,
      refundVoucher: refundRes ? refundRes.noVoucher : null,
      message: 'LPJ program kerja berhasil diserahkan dan diverifikasi.' + (sisaAnggaran > 0 ? ' Sisa anggaran Rp ' + sisaAnggaran + ' otomatis dibukukan kembali ke kas yayasan.' : '')
    };
  }, 10000);
}



// ============================================================================
// BERKAS: Keanggotaan.gs
// ============================================================================

/**
 * SIAP APII v3.0.0 Enterprise - Keanggotaan.gs
 * Registrasi Anggota Nasional 100% Bebas Biaya, NIA Otomatis, Masa Berlaku 5 Tahun & KTA CR80
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Pendaftaran Mandiri Anggota Baru dari Portal Publik (100% Gratis & Selektif)
 */
function handleRegisterMember_(payload) {
  if (!payload || !payload.nama || !payload.nik || !payload.no_wa) {
    return { ok: false, error: 'Nama lengkap, NIK, dan nomor WhatsApp wajib diisi.' };
  }

  return withScriptLock_(function() {
    var now = new Date();
    var wilayahId = payload.wilayah_id || 'DPW_JABO'; // Default wilayah kanonik pilot aktif
    var pendaftarId = 'REG-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000);

    // Cek apakah NIK sudah pernah mendaftar secara atomik
    var existingNik = dbFindOne('Sheet_Pendaftar', { nik: payload.nik });
    if (existingNik) {
      return {
        ok: false,
        error: 'NIK ' + String(payload.nik).substring(0, 4) + '**********' + String(payload.nik).slice(-2) + ' sudah terdaftar di sistem keanggotaan APII.'
      };
    }

    var rowArray = [
      pendaftarId,
      wilayahId,
      payload.nik,
      payload.nama,
      payload.tempat_lahir || '',
      payload.tgl_lahir || '',
      payload.gender || 'Laki-laki',
      payload.alamat || '',
      payload.no_wa,
      payload.email || '',
      payload.divisi_minat || 'dakwah',
      payload.ktp_watermark_url || '',
      payload.pasfoto_url || '',
      'MENUNGGU_VERIFIKASI',
      '', // verified_sekretaris_at
      '', // approved_ketua_at
      ''  // nia_assigned
    ];

    dbInsert('Sheet_Pendaftar', rowArray);
    logAudit('PUBLIC_APPLICANT', wilayahId, 'REGISTER_MEMBER', 'Pendaftar', pendaftarId, { nama: payload.nama });

    return {
      ok: true,
      pendaftarId: pendaftarId,
      wilayahId: wilayahId,
      message: 'Pendaftaran anggota berhasil dikirimkan. Berkas Anda akan diverifikasi oleh Sekretariat Wilayah secara selektif.'
    };
  }, 10000);
}

/**
 * Mengambil Daftar Calon Anggota (Portal Pengurus)
 */
function handleGetPendaftarList_(session, payload) {
  var reqWilayah = payload && payload.wilayah_id ? payload.wilayah_id : session.wilayahId;
  var targetWilayah = resolveAuthorizedWilayah_(session, reqWilayah);

  var filter = targetWilayah === 'ALL' ? null : { wilayah_id: targetWilayah };
  var rawList = dbFind('Sheet_Pendaftar', filter, 300);

  var list = rawList.map(function(row) {
    // Masking NIK untuk privasi pengurus (UU PDP)
    var rawNik = String(row[COL_PENDAFTAR.NIK] || '');
    var maskedNik = rawNik.length >= 8 ? rawNik.substring(0, 4) + '********' + rawNik.slice(-4) : rawNik;

    return {
      id: row[COL_PENDAFTAR.ID],
      wilayahId: row[COL_PENDAFTAR.WILAYAH_ID],
      nikMasked: maskedNik,
      nama: row[COL_PENDAFTAR.NAMA],
      tempatLahir: row[COL_PENDAFTAR.TEMPAT_LAHIR],
      tglLahir: row[COL_PENDAFTAR.TGL_LAHIR],
      gender: row[COL_PENDAFTAR.GENDER],
      alamat: row[COL_PENDAFTAR.ALAMAT],
      noWa: row[COL_PENDAFTAR.NO_WA],
      email: row[COL_PENDAFTAR.EMAIL],
      divisiMinat: row[COL_PENDAFTAR.DIVISI_MINAT],
      ktpUrl: row[COL_PENDAFTAR.KTP_WATERMARK_URL],
      pasfotoUrl: row[COL_PENDAFTAR.PASFOTO_URL],
      status: row[COL_PENDAFTAR.STATUS], // MENUNGGU_VERIFIKASI, VERIFIED_SEKRETARIS, APPROVED, REJECTED
      verifiedSekretarisAt: row[COL_PENDAFTAR.VERIFIED_SEKRETARIS_AT],
      approvedKetuaAt: row[COL_PENDAFTAR.APPROVED_KETUA_AT],
      niaAssigned: row[COL_PENDAFTAR.NIA_ASSIGNED]
    };
  });

  return { ok: true, list: list };
}

/**
 * Verifikasi Tahap 1 Calon Anggota oleh Sekretaris
 */
function handleVerifyPendaftarSekretaris_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'sekretaris']);
  if (!roleGuard.ok) return roleGuard;

  var pendaftarId = payload.pendaftar_id;
  if (!pendaftarId) return { ok: false, error: 'ID pendaftar wajib disertakan.' };

  var pendaftarRow = dbFindOne('Sheet_Pendaftar', { id: pendaftarId });
  if (!pendaftarRow) return { ok: false, error: 'Data pendaftar tidak ditemukan.' };

  var tenantGuard = assertRecordTenantAccess_(session, pendaftarRow[COL_PENDAFTAR.WILAYAH_ID]);
  if (!tenantGuard.ok) return tenantGuard;

  var isLolos = payload.is_lolos !== false;
  var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
  var status = isLolos ? 'VERIFIED_SEKRETARIS' : 'REJECTED';

  var updateMap = {};
  updateMap[COL_PENDAFTAR.STATUS] = status;
  updateMap[COL_PENDAFTAR.VERIFIED_SEKRETARIS_AT] = nowStr;
  dbUpdate('Sheet_Pendaftar', COL_PENDAFTAR.ID, pendaftarId, updateMap);

  logAudit(session.userId, pendaftarRow[COL_PENDAFTAR.WILAYAH_ID], 'VERIFY_PENDAFTAR_SEKRETARIS', 'Pendaftar', pendaftarId, { status: status });
  return { ok: true, status: status, message: isLolos ? 'Berkas pendaftar lolos verifikasi Sekretaris, diajukan ke Ketua.' : 'Pendaftar ditolak.' };
}

/**
 * Helper Internal Penerbitan NIA Kanonik & Pencatatan ke Sheet_KTA_Nasional
 */
function issueCanonicalNiaAndKta_(pendaftarRow, tingkatLisensi, ktaDriveUrl, actorUserId) {
  return withScriptLock_(function() {
    var pendaftarId = pendaftarRow[COL_PENDAFTAR.ID];
    var wilayahId = pendaftarRow[COL_PENDAFTAR.WILAYAH_ID] || 'DPW_JABO';
    var wilayahRow = dbFindOne('Sheet_Wilayah', { id: wilayahId });
    var rawKode = wilayahRow ? wilayahRow[COL_WILAYAH.KODE] : (wilayahId === 'DPP_PUSAT' ? 'PUSAT' : wilayahId);
    var kodeWilayah = String(rawKode || 'JABO').replace(/^(DPW[_-]|DPP[_-])/i, '').toUpperCase() || 'PUSAT';

    var now = new Date();
    var nowStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
    var tahunMasuk = now.getFullYear();

    // Hitung Tanggal Kedaluwarsa Tepat 5 Tahun Kalender
    var expireDate = new Date(now.getFullYear() + 5, now.getMonth(), now.getDate());
    var expireStr = Utilities.formatDate(expireDate, 'Asia/Jakarta', 'dd-MM-yyyy');
    var terbitStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy');

    // Bangkitkan Nomor Induk Anggota (NIA) Sekuensial Atomic
    // Contoh: APII-JABO-2026-00001
    var seqNia = getNextSequence('NASIONAL', 'NIA_NASIONAL');
    var padNia = ('00000' + seqNia).slice(-5);
    var niaResmi = 'APII-' + kodeWilayah + '-' + tahunMasuk + '-' + padNia;

    var lisensi = tingkatLisensi || 'Tingkat 1 (Dai Muda)';

    var updateMap = {};
    updateMap[COL_PENDAFTAR.STATUS] = 'APPROVED';
    updateMap[COL_PENDAFTAR.APPROVED_KETUA_AT] = nowStr;
    updateMap[COL_PENDAFTAR.NIA_ASSIGNED] = niaResmi;
    dbUpdate('Sheet_Pendaftar', COL_PENDAFTAR.ID, pendaftarId, updateMap);

    dbInsert('Sheet_KTA_Nasional', [
      niaResmi,
      wilayahId,
      pendaftarId,
      pendaftarRow[COL_PENDAFTAR.NAMA],
      lisensi,
      terbitStr,
      expireStr,
      'Kode Etik APII v2026 (5 Butir)',
      ktaDriveUrl || '',
      'https://apologetislamindonesia.or.id/public/#/verifikasi?token=' + encodeURIComponent(niaResmi),
      'TRUE'
    ]);

    logAudit(actorUserId, wilayahId, 'APPROVE_ANGGOTA_KTA', 'KTA', niaResmi, {
      pendaftarId: pendaftarId,
      nama: pendaftarRow[COL_PENDAFTAR.NAMA]
    });

    return {
      nia: niaResmi,
      terbitStr: terbitStr,
      expireStr: expireStr
    };
  }, 10000);
}

/**
 * Pengesahan Akhir Anggota & Penerbitan NIA Nasional 5 Tahun oleh Ketua
 */
function handleApproveAnggotaKetua_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua']);
  if (!roleGuard.ok) return roleGuard;

  var pendaftarId = payload.pendaftar_id;
  if (!pendaftarId) return { ok: false, error: 'ID pendaftar wajib disertakan.' };

  var pendaftarRow = dbFindOne('Sheet_Pendaftar', { id: pendaftarId });
  if (!pendaftarRow) return { ok: false, error: 'Data pendaftar tidak ditemukan.' };

  var tenantGuard = assertRecordTenantAccess_(session, pendaftarRow[COL_PENDAFTAR.WILAYAH_ID]);
  if (!tenantGuard.ok) return tenantGuard;

  if (pendaftarRow[COL_PENDAFTAR.STATUS] === 'APPROVED' && pendaftarRow[COL_PENDAFTAR.NIA_ASSIGNED]) {
    return { ok: true, nia: pendaftarRow[COL_PENDAFTAR.NIA_ASSIGNED], message: 'Anggota ini sudah disahkan sebelumnya.' };
  }

  var issued = issueCanonicalNiaAndKta_(pendaftarRow, payload.tingkat_lisensi, payload.kta_drive_url, session.userId);

  return {
    ok: true,
    nia: issued.nia,
    masaBerlaku: '5 Tahun (s/d ' + issued.expireStr + ')',
    message: 'Anggota resmi telah disahkan Ketua. Kartu Tanda Anggota (KTA) Digital CR80 resmi aktif.'
  };
}



// ============================================================================
// BERKAS: InovasiDakwah.gs
// ============================================================================

/**
 * SIAP APII v3.0.0 Enterprise - InovasiDakwah.gs
 * Backend Handlers untuk Rangkaian 17 Fitur Inovasi Dakwah Unggulan
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

// ============================================================================
// 1. MODUL SIAGA ADVOKASI DA'I (LBH APII CRISIS INTAKE)
// ============================================================================

function handleSubmitAdvokasiIntake_(payload) {
  return withScriptLock_(function() {
    var now = new Date();
    var tiketNo = 'LBH-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMdd') + '-' + Math.floor(100 + Math.random() * 900);
    var id = 'ADV-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 100);
    var wilayahId = payload.wilayah_id || 'DPP_PUSAT';

    var rowArray = [
      id,
      wilayahId,
      tiketNo,
      payload.nama_dai || 'Anonim / Dai APII',
      payload.kontak || '',
      payload.lokasi || '',
      payload.kronologi || '',
      payload.urgensi || 'BIASA', // KILAT atau BIASA
      payload.bukti_url || '',
      'MENUNGGU_DISPOSISI_LBH',
      '',
      Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
    ];

    dbInsert('Sheet_Advokasi', rowArray);
    logAudit('CRISIS_INTAKE', wilayahId, 'SUBMIT_ADVOKASI', 'Advokasi', tiketNo, { urgensi: payload.urgensi });

    return {
      ok: true,
      id: id,
      tiketNo: tiketNo,
      message: 'Laporan krisis hukum berhasil diterima LBH APII. Tim advokasi segera menindaklanjuti.'
    };
  }, 10000);
}

function handleGetAdvokasiList_(session, payload) {
  var reqWilayah = payload && payload.wilayah_id ? payload.wilayah_id : session.wilayahId;
  var targetWilayah = resolveAuthorizedWilayah_(session, reqWilayah);
  var filter = targetWilayah === 'ALL' ? null : { wilayah_id: targetWilayah };
  var rawList = dbFind('Sheet_Advokasi', filter, 100);

  var list = rawList.map(function(row) {
    return {
      id: row[COL_ADVOKASI.ID],
      wilayahId: row[COL_ADVOKASI.WILAYAH_ID],
      tiketNo: row[COL_ADVOKASI.TIKET_NO],
      namaDai: row[COL_ADVOKASI.NAMA_DAI],
      kontak: row[COL_ADVOKASI.KONTAK],
      lokasi: row[COL_ADVOKASI.LOKASI],
      kronologi: row[COL_ADVOKASI.KRONOLOGI],
      urgensi: row[COL_ADVOKASI.URGENSI],
      buktiUrl: row[COL_ADVOKASI.BUKTI_URL],
      status: row[COL_ADVOKASI.STATUS],
      catatanLbh: row[COL_ADVOKASI.CATATAN_LBH],
      updatedAt: row[COL_ADVOKASI.UPDATED_AT]
    };
  });

  return { ok: true, list: list };
}

function handleUpdateAdvokasiStatus_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  if (session.role === 'ketua_divisi' && String(session.divisi || '').toLowerCase() !== 'hukum') {
    return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Hanya Ketua Divisi Hukum & Advokasi yang berwenang memperbarui status perkara LBH.' };
  }

  var id = payload.id;
  if (!id) return { ok: false, error: 'ID kasus advokasi wajib disertakan.' };

  var row = dbFindOne('Sheet_Advokasi', { id: id });
  if (!row) return { ok: false, error: 'Kasus advokasi tidak ditemukan.' };

  var tenantGuard = assertRecordTenantAccess_(session, row[COL_ADVOKASI.WILAYAH_ID]);
  if (!tenantGuard.ok) return tenantGuard;

  var status = payload.status || 'PENDAMPINGAN_BERJALAN';
  var catatanLbh = payload.catatan_lbh || '';
  var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');

  var updateMap = {};
  updateMap[COL_ADVOKASI.STATUS] = status;
  updateMap[COL_ADVOKASI.CATATAN_LBH] = catatanLbh;
  updateMap[COL_ADVOKASI.UPDATED_AT] = nowStr;
  dbUpdate('Sheet_Advokasi', COL_ADVOKASI.ID, id, updateMap);

  logAudit(session.userId, row[COL_ADVOKASI.WILAYAH_ID], 'UPDATE_ADVOKASI', 'Advokasi', id, { status: status });
  return { ok: true, status: status, message: 'Status pendampingan LBH APII berhasil diperbarui.' };
}

function handleSaveTabayyun_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'sekretaris', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  if (session.role === 'ketua_divisi') {
    var div = String(session.divisi || '').toLowerCase();
    if (['humas', 'litbang', 'sosmed', 'hukum'].indexOf(div) === -1) {
      return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Divisi Anda tidak berwenang merilis Radar Tabayyun.' };
    }
  }

  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);
  var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
  var id = payload.id || ('TBY-' + new Date().getTime());

  var existing = dbFindOne('Sheet_Tabayyun', { id: id });
  if (existing) {
    var tenantGuard = assertRecordTenantAccess_(session, existing[COL_TABAYYUN.WILAYAH_ID]);
    if (!tenantGuard.ok) return tenantGuard;

    var updateMap = {};
    if (payload.judul !== undefined) updateMap[COL_TABAYYUN.JUDUL] = payload.judul;
    if (payload.kategori_isu !== undefined) updateMap[COL_TABAYYUN.KATEGORI_ISU] = payload.kategori_isu;
    if (payload.klarifikasi !== undefined) updateMap[COL_TABAYYUN.KLARIFIKASI] = payload.klarifikasi;
    if (payload.sumber_rujukan !== undefined) updateMap[COL_TABAYYUN.SUMBER_RUJUKAN] = payload.sumber_rujukan;
    if (payload.status !== undefined) updateMap[COL_TABAYYUN.STATUS] = payload.status;
    updateMap[COL_TABAYYUN.UPDATED_AT] = nowStr;
    dbUpdate('Sheet_Tabayyun', COL_TABAYYUN.ID, id, updateMap);
  } else {
    dbInsert('Sheet_Tabayyun', [
      id,
      wilayahId,
      payload.judul || 'Klarifikasi Resmi APII',
      payload.kategori_isu || 'Klarifikasi Isu Publik',
      payload.klarifikasi || '',
      payload.sumber_rujukan || '',
      payload.status || 'TERVERIFIKASI',
      session.username,
      nowStr,
      nowStr
    ]);
  }

  logAudit(session.userId, wilayahId, 'SAVE_TABAYYUN', 'Tabayyun', id, { judul: payload.judul });
  return { ok: true, id: id, message: 'Rilis Radar Tabayyun berhasil disimpan.' };
}

// ============================================================================
// 2. MODUL MUALLAF CARE & E-SERTIFIKAT IKRAR SYAHADAT (TASHDIQ)
// ============================================================================

function handleGetMuallafList_(session, payload) {
  var reqWilayah = payload && payload.wilayah_id ? payload.wilayah_id : session.wilayahId;
  var targetWilayah = resolveAuthorizedWilayah_(session, reqWilayah);
  var filter = targetWilayah === 'ALL' ? null : { wilayah_id: targetWilayah };
  var rawList = dbFind('Sheet_Muallaf', filter, 100);

  var list = rawList.map(function(row) {
    return {
      id: row[COL_MUALLAF.ID],
      wilayahId: row[COL_MUALLAF.WILAYAH_ID],
      regNo: row[COL_MUALLAF.REG_NO],
      namaAsli: row[COL_MUALLAF.NAMA_ASLI],
      namaHijrah: row[COL_MUALLAF.NAMA_HIJRAH],
      tglSyahadat: row[COL_MUALLAF.TGL_SYAHADAT],
      pembimbing: row[COL_MUALLAF.PEMBIMBING],
      sertifikatUrl: row[COL_MUALLAF.SERTIFIKAT_URL],
      statusZakat: row[COL_MUALLAF.STATUS_ZAKAT],
      createdAt: row[COL_MUALLAF.CREATED_AT]
    };
  });

  return { ok: true, list: list };
}

function handleSaveMuallaf_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  if (session.role === 'ketua_divisi' && String(session.divisi || '').toLowerCase() !== 'dakwah') {
    return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Hanya Ketua Divisi Dakwah yang berwenang mencatat Muallaf binaan.' };
  }

  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);

  return withScriptLock_(function() {
    var now = new Date();
    var seq = getNextSequence(wilayahId, 'MUALLAF_REG');
    var regNo = 'MLF-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyy') + '-' + ('000' + seq).slice(-4);
    var id = 'MLF-ID-' + now.getTime();
    var nominalZakat = Number(payload.nominal_zakat) || 0;

    var rowArray = [
      id,
      wilayahId,
      regNo,
      payload.nama_asli,
      payload.nama_hijrah || '-',
      payload.tgl_syahadat || Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy'),
      payload.pembimbing || session.username,
      payload.sertifikat_url || '',
      payload.status_zakat || (nominalZakat > 0 ? 'DIAJUKAN_BKK_ZAKAT' : 'MENUNGGU_PENYALURAN'),
      Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
    ];

    dbInsert('Sheet_Muallaf', rowArray);

    // Otomatis buat draf BKK Kantong ZAKAT (Ashnaf Muallaf) bila ada pengajuan santunan
    var zakatDraftId = null;
    if (nominalZakat > 0) {
      zakatDraftId = 'KEU-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000);
      dbInsert('Sheet_Keuangan', [
        zakatDraftId,
        wilayahId,
        'DRAFT-BKK-' + Math.floor(1000 + Math.random() * 9000),
        'KELUAR',
        'ZAKAT',
        'Santunan Ashnaf Muallaf',
        nominalZakat,
        Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy'),
        'Santunan Zakat Ashnaf Muallaf a.n. ' + (payload.nama_hijrah || payload.nama_asli) + ' (' + regNo + ')',
        '',
        'VERIFIKASI_BENDAHARA',
        '',
        '',
        '',
        Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
      ]);
    }

    logAudit(session.userId, wilayahId, 'REGISTER_MUALLAF', 'Muallaf', regNo, { nama: payload.nama_asli, zakatDraftId: zakatDraftId });

    return {
      ok: true,
      id: id,
      regNo: regNo,
      zakatDraftId: zakatDraftId,
      message: 'Data muallaf binaan & e-sertifikat syahadat berhasil diterbitkan.' + (zakatDraftId ? ' Draf BKK Santunan Zakat otomatis dibuat.' : '')
    };
  }, 10000);
}

function handleUpdateMuallafProgress_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  if (session.role === 'ketua_divisi' && String(session.divisi || '').toLowerCase() !== 'dakwah') {
    return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Hanya Ketua Divisi Dakwah yang berwenang memperbarui pembinaan Muallaf.' };
  }

  var targetId = payload.id || payload.reg_no;
  if (!targetId) return { ok: false, error: 'ID atau nomor registrasi muallaf wajib disertakan.' };

  var row = dbFindOne('Sheet_Muallaf', { id: targetId });
  if (!row) {
    row = dbFindOne('Sheet_Muallaf', { reg_no: targetId });
  }
  if (!row) return { ok: false, error: 'Data muallaf tidak ditemukan.' };

  var tenantGuard = assertRecordTenantAccess_(session, row[COL_MUALLAF.WILAYAH_ID]);
  if (!tenantGuard.ok) return tenantGuard;

  var updateMap = {};
  if (payload.status_zakat !== undefined) updateMap[COL_MUALLAF.STATUS_ZAKAT] = payload.status_zakat;
  if (payload.pembimbing !== undefined) updateMap[COL_MUALLAF.PEMBIMBING] = payload.pembimbing;
  if (payload.sertifikat_url !== undefined) updateMap[COL_MUALLAF.SERTIFIKAT_URL] = payload.sertifikat_url;
  dbUpdate('Sheet_Muallaf', COL_MUALLAF.ID, row[COL_MUALLAF.ID], updateMap);

  logAudit(session.userId, row[COL_MUALLAF.WILAYAH_ID], 'UPDATE_MUALLAF_PROGRESS', 'Muallaf', row[COL_MUALLAF.REG_NO], { statusZakat: payload.status_zakat });
  return { ok: true, regNo: row[COL_MUALLAF.REG_NO], message: 'Progres pembinaan & penyaluran muallaf berhasil diperbarui.' };
}

// ============================================================================
// 3. PRESENSI DIGITAL ACARA VIA SCAN QR KTA
// ============================================================================

function handleRecordEventAttendance_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'sekretaris', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  var nia = payload.nia;
  if (!nia) return { ok: false, error: 'NIA anggota wajib diisi.' };

  var eventNama = payload.event_nama || 'Safari Dakwah APII';
  var now = new Date();
  var tglStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy');
  var scanTimeStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);

  // Cek validitas NIA di Sheet_KTA_Nasional
  var ktaRow = dbFindOne('Sheet_KTA_Nasional', { nia: nia });
  var namaAnggota = ktaRow ? ktaRow[COL_KTA_NASIONAL.NAMA_LENGKAP] : (payload.nama_anggota || 'Anggota Tamu');
  var isValid = ktaRow ? (String(ktaRow[COL_KTA_NASIONAL.IS_ACTIVE]).toLowerCase() === 'true') : false;

  var id = 'ATT-' + now.getTime();
  dbInsert('Sheet_Attendance', [
    id,
    wilayahId,
    eventNama,
    tglStr,
    nia,
    namaAnggota,
    scanTimeStr,
    session.username
  ]);

  logAudit(session.userId, wilayahId, 'SCAN_ATTENDANCE', 'Attendance', nia, { event: eventNama, isValidKta: isValid });
  return {
    ok: true,
    isValidKta: isValid,
    namaAnggota: namaAnggota,
    timestamp: scanTimeStr,
    message: 'Presensi digital berhasil dicatat: ' + namaAnggota + ' (' + nia + ')'
  };
}

// ============================================================================
// 4. PELACAK ASET & LOGISTIK DAKWAH (ASSET QR TRACKER)
// ============================================================================

function handleGetAssetsList_(session, payload) {
  var reqWilayah = payload && payload.wilayah_id ? payload.wilayah_id : session.wilayahId;
  var targetWilayah = resolveAuthorizedWilayah_(session, reqWilayah);
  var filter = targetWilayah === 'ALL' ? null : { wilayah_id: targetWilayah };
  var rawList = dbFind('Sheet_Assets', filter, 100);

  var list = rawList.map(function(row) {
    return {
      id: row[COL_ASSETS.ID],
      wilayahId: row[COL_ASSETS.WILAYAH_ID],
      kodeAset: row[COL_ASSETS.KODE_ASET],
      namaBarang: row[COL_ASSETS.NAMA_BARANG],
      kategori: row[COL_ASSETS.KATEGORI],
      kondisi: row[COL_ASSETS.KONDISI],
      lokasiSimpan: row[COL_ASSETS.LOKASI_SIMPAN],
      qrUrl: row[COL_ASSETS.QR_URL]
    };
  });

  return { ok: true, list: list };
}

function handleSaveAssetLoan_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'sekretaris', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  var now = new Date();
  var id = 'LOAN-' + now.getTime();
  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);

  dbInsert('Sheet_Asset_Loans', [
    id,
    wilayahId,
    payload.aset_id,
    payload.divisi_peminjam || session.divisi || 'dakwah',
    payload.penanggung_jawab || session.username,
    payload.tgl_pinjam || Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy'),
    payload.tgl_kembali_rencana || '',
    '', // tgl_kembali_aktual
    'DIPINJAM'
  ]);

  logAudit(session.userId, wilayahId, 'SAVE_ASSET_LOAN', 'AssetLoan', id, { asetId: payload.aset_id });
  return { ok: true, id: id, message: 'Peminjaman logistik dakwah berhasil dicatat.' };
}

// ============================================================================
// 5. MAKTABAH APOLOGETIKA & BANK DALIL DA'I
// ============================================================================

function handleSearchKnowledgeBase_(session, payload) {
  var query = ((payload && payload.query) || '').toLowerCase();
  var kategori = (payload && payload.kategori) || '';

  var rawList = dbFind('Sheet_Knowledge_Base', null, 200);
  var filtered = rawList.filter(function(row) {
    var matchCat = !kategori || row[COL_KNOWLEDGE_BASE.KATEGORI] === kategori;
    var rowText = (row[COL_KNOWLEDGE_BASE.TOPIK] + ' ' + row[COL_KNOWLEDGE_BASE.DALIL_TEXT] + ' ' + row[COL_KNOWLEDGE_BASE.KATA_KUNCI]).toLowerCase();
    var matchQuery = !query || rowText.indexOf(query) !== -1;
    return matchCat && matchQuery;
  });

  var list = filtered.map(function(row) {
    return {
      id: row[COL_KNOWLEDGE_BASE.ID],
      kategori: row[COL_KNOWLEDGE_BASE.KATEGORI],
      topik: row[COL_KNOWLEDGE_BASE.TOPIK],
      dalilText: row[COL_KNOWLEDGE_BASE.DALIL_TEXT],
      sumberReferensi: row[COL_KNOWLEDGE_BASE.SUMBER_REFERENSI],
      kataKunci: row[COL_KNOWLEDGE_BASE.KATA_KUNCI]
    };
  });

  return { ok: true, list: list };
}

// ============================================================================
// 6. KANAL KONSULTASI AQIDAH RAHASIA (ANONYMOUS INQUIRY DESK)
// ============================================================================

function handleSubmitConsultation_(payload) {
  if (!payload || !payload.pertanyaan) {
    return { ok: false, error: 'Pertanyaan konsultasi wajib diisi.' };
  }

  return withScriptLock_(function() {
    var now = new Date();
    var tiketNo = 'TKT-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMdd') + '-' + Math.floor(100 + Math.random() * 900);
    var secretToken = Utilities.getUuid().substring(0, 8).toUpperCase(); // Kunci Rahasia untuk Penanya
    var tokenHash = sha256Hex_(secretToken + ':APII_CONSULT');
    var id = 'CNS-' + now.getTime();

    dbInsert('Sheet_Consultations', [
      id,
      tokenHash,
      tiketNo,
      payload.topik || 'Kajian Kristologi & Perbandingan Agama',
      payload.pertanyaan || '',
      '', // Jawaban
      'MENUNGGU_JAWABAN',
      Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss'),
      ''
    ]);

    return {
      ok: true,
      tiketNo: tiketNo,
      secretToken: secretToken,
      message: 'Pertanyaan konsultasi aqidah rahasia berhasil dikirim. Simpan Nomor Tiket dan Kunci Rahasia Anda untuk mengecek jawaban privat dari Dewan Pakar.'
    };
  }, 10000);
}

function handleCheckConsultation_(ticketNo, secretToken) {
  if (!ticketNo || !secretToken) {
    return { ok: false, error: 'Nomor tiket dan kunci rahasia wajib diisi.' };
  }
  var row = dbFindOne('Sheet_Consultations', { tiket_no: ticketNo });
  if (!row) {
    return { ok: false, error: 'Tiket konsultasi tidak ditemukan.' };
  }

  var tokenHash = sha256Hex_(secretToken + ':APII_CONSULT');
  if (row[COL_CONSULTATIONS.TOKEN_HASH] !== tokenHash) {
    return { ok: false, error: 'Kunci rahasia tiket tidak cocok.' };
  }

  return {
    ok: true,
    tiketNo: ticketNo,
    topik: row[COL_CONSULTATIONS.TOPIK],
    pertanyaan: row[COL_CONSULTATIONS.PERTANYAAN],
    jawaban: row[COL_CONSULTATIONS.JAWABAN],
    status: row[COL_CONSULTATIONS.STATUS],
    createdAt: row[COL_CONSULTATIONS.CREATED_AT],
    answeredAt: row[COL_CONSULTATIONS.ANSWERED_AT]
  };
}

function handleGetConsultationsList_(session, payload) {
  var allowedRead = ['superadmin', 'ketua', 'ketua_divisi', 'pembina', 'pengawas'];
  if (allowedRead.indexOf(session.role) === -1) {
    return { ok: false, code: 'FORBIDDEN_ROLE', error: 'Anda tidak memiliki akses ke Meja Konsultasi Aqidah.' };
  }
  if (session.role === 'ketua_divisi') {
    var div = String(session.divisi || '').toLowerCase();
    if (div !== 'litbang' && div !== 'dakwah') {
      return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Meja Konsultasi Aqidah khusus untuk Divisi Litbang atau Dakwah.' };
    }
  }

  var rawList = dbFind('Sheet_Consultations', null, 200);
  var list = rawList.map(function(row) {
    return {
      id: row[COL_CONSULTATIONS.ID],
      tiketNo: row[COL_CONSULTATIONS.TIKET_NO],
      topik: row[COL_CONSULTATIONS.TOPIK],
      pertanyaan: row[COL_CONSULTATIONS.PERTANYAAN],
      jawaban: row[COL_CONSULTATIONS.JAWABAN],
      status: row[COL_CONSULTATIONS.STATUS],
      createdAt: row[COL_CONSULTATIONS.CREATED_AT],
      answeredAt: row[COL_CONSULTATIONS.ANSWERED_AT]
    };
  });

  return { ok: true, list: list };
}

function handleAnswerConsultation_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  if (session.role === 'ketua_divisi') {
    var div = String(session.divisi || '').toLowerCase();
    if (div !== 'litbang' && div !== 'dakwah') {
      return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Hanya Dewan Pakar Litbang/Dakwah atau Ketua yang berwenang menjawab konsultasi.' };
    }
  }

  var targetId = payload.id || payload.tiket_no;
  if (!targetId || !payload.jawaban) {
    return { ok: false, error: 'ID/Nomor tiket dan jawaban wajib diisi.' };
  }

  var row = dbFindOne('Sheet_Consultations', { id: targetId });
  if (!row) {
    row = dbFindOne('Sheet_Consultations', { tiket_no: targetId });
  }
  if (!row) {
    return { ok: false, error: 'Tiket konsultasi tidak ditemukan.' };
  }

  var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
  var updateMap = {};
  updateMap[COL_CONSULTATIONS.JAWABAN] = payload.jawaban;
  updateMap[COL_CONSULTATIONS.STATUS] = 'TERJAWAB';
  updateMap[COL_CONSULTATIONS.ANSWERED_AT] = nowStr;
  dbUpdate('Sheet_Consultations', COL_CONSULTATIONS.ID, row[COL_CONSULTATIONS.ID], updateMap);

  logAudit(session.userId, session.wilayahId, 'ANSWER_CONSULTATION', 'Consultation', row[COL_CONSULTATIONS.TIKET_NO], {});
  return {
    ok: true,
    tiketNo: row[COL_CONSULTATIONS.TIKET_NO],
    status: 'TERJAWAB',
    answeredAt: nowStr,
    message: 'Jawaban konsultasi rahasia telah disimpan dan dapat diakses penanya melalui tiket.'
  };
}

// ============================================================================
// 7. RISALAH MUSYAWARAH DIGITAL (DIGITAL PLENARY LEDGER)
// ============================================================================

function handleSaveMeetingPlenary_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'sekretaris']);
  if (!roleGuard.ok) return roleGuard;

  var now = new Date();
  var id = 'MTG-' + now.getTime();
  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);

  dbInsert('Sheet_Meetings', [
    id,
    wilayahId,
    payload.judul_rapat || 'Rapat Pleno BPH APII',
    payload.tanggal || Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy'),
    payload.notulen_text || '',
    JSON.stringify(payload.action_items || []),
    payload.dokumentasi_url || '',
    session.username,
    session.username
  ]);

  logAudit(session.userId, wilayahId, 'SAVE_MEETING', 'Meetings', id, { judul: payload.judul_rapat });
  return { ok: true, id: id, message: 'Risalah musyawarah pleno berhasil didokumentasikan.' };
}



// ============================================================================
// BERKAS: NotificationDispatcher.gs
// ============================================================================

/**
 * SIAP APII v3.0.0 Enterprise - NotificationDispatcher.gs
 * Smart WhatsApp Handover & Request Relay, Notifikasi Internal & Siaran Grup Komunitas
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Format Nomor Telepon ke Standar Internasional E.164 Indonesia (+628...)
 */
function formatE164(phoneStr) {
  var clean = (phoneStr || '').replace(/[^\d+]/g, '');
  if (clean.indexOf('+62') === 0) return clean;
  if (clean.indexOf('62') === 0) return '+' + clean;
  if (clean.indexOf('08') === 0) return '+628' + clean.substring(2);
  return clean;
}

/**
 * Generator Naskah Berita WhatsApp Handover & Request Relay (Internal Antar-Pengurus)
 */
function buildWhatsAppHandoverMsg(tipe, payload) {
  var baseUrl = 'https://apologetislamindonesia.or.id/portal';

  // 1. Estafet Persuratan Dinas
  if (tipe === 'DRAF_SURAT_SELESAI') {
    return 'Bismillah. *YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n\n' +
      '📢 *LAPORAN ESTAFET PERSURATAN DINAS*\n' +
      '• Perihal: ' + (payload.perihal || 'Surat Dinas') + '\n' +
      '• Konseptor: Sekretaris (' + (payload.sekretaris || 'Sekretariat') + ')\n' +
      '• Tanggal: ' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy') + '\n\n' +
      'Permintaan: Mohon Ketua berkenan menelaah dan mengesahkan naskah dinas resmi di portal pengurus:\n' +
      baseUrl + '/#/surat/' + (payload.suratId || '') + '\n\n' +
      'Jazakumullahu khairan.';
  }

  // 2. Estafet Disposisi Surat Masuk
  if (tipe === 'DISPOSISI_TERBIT') {
    return 'Bismillah. *YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n\n' +
      '📥 *INSTRUKSI DISPOSISI RESMI PIMPINAN*\n' +
      '• No. Agenda: ' + (payload.noAgenda || '') + '\n' +
      '• Asal Surat: ' + (payload.asalSurat || '') + '\n' +
      '• Divisi Dituju: ' + (payload.divisiTujuan || '').toUpperCase() + '\n' +
      '• Instruksi Ketua: ' + (payload.instruksi || '') + '\n' +
      '• Batas Waktu: ' + (payload.batasWaktu || 'Segera') + '\n\n' +
      'Permintaan: Mohon Ketua Divisi segera menindaklanjuti dan mengunggah laporan hasil di portal:\n' +
      baseUrl + '/#/disposisi\n\n' +
      'Jazakumullahu khairan.';
  }

  // 3. Estafet Verifikasi Kas Keluar (Dual-Approval)
  if (tipe === 'KAS_VERIFIKASI_KETUM') {
    return 'Bismillah. *YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n\n' +
      '💰 *PERMOHONAN PENCAIRAN KAS (TAHAP 2)*\n' +
      '• No. Voucher: ' + (payload.noVoucher || '') + '\n' +
      '• Nominal: Rp ' + (payload.nominal || '0') + '\n' +
      '• Pos Kantong: ' + (payload.kantongSyariah || '') + '\n' +
      '• Keperluan: ' + (payload.keperluan || '') + '\n' +
      '• Status: Telah diverifikasi kelayakan nota oleh Bendahara.\n\n' +
      'Permintaan: Mohon Ketua berkenan mengesahkan pencairan dana di portal pengurus:\n' +
      baseUrl + '/#kas\n\n' +
      'Jazakumullahu khairan.';
  }

  // 4. Pendaftaran Anggota Baru (MURNI INTERNAL ANTAR-PENGURUS)
  if (tipe === 'PENDAFTAR_BARU_INTERNAL') {
    return 'Bismillah. *YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n\n' +
      '👤 *PEMBERITAHUAN INTERNAL: PENDAFTAR ANGGOTA BARU*\n' +
      '• Nama: ' + (payload.nama || '') + '\n' +
      '• Wilayah Minat: ' + (payload.wilayah || '') + '\n' +
      '• Waktu Daftar: ' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm') + ' WIB\n\n' +
      'Permintaan: Mohon Sekretaris memeriksa kelayakan berkas foto KTP ber-watermark UU PDP di meja seleksi:\n' +
      baseUrl + '/#/keanggotaan\n\n' +
      '*(Catatan: Notifikasi ini rahasia dan hanya beredar antar-pengurus)*';
  }

  // 5. Siaran Informasi Komunitas (Warta & Agenda ke Grup WhatsApp APII)
  if (tipe === 'BROADCAST_AGENDA_KOMUNITAS') {
    return 'Bismillah. *YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n' +
      '📢 *[AGENDA DAKWAH & KAJIAN ILMIAH RESMI]*\n\n' +
      '• Judul Kajian: ' + (payload.judul || '') + '\n' +
      '• Pemateri: ' + (payload.pemateri || 'Dewan Pakar APII') + '\n' +
      '• Hari / Tanggal: ' + (payload.tanggal || '') + '\n' +
      '• Waktu: ' + (payload.waktu || 'Ba\'da Isya s/d Selesai') + '\n' +
      '• Tempat / Link: ' + (payload.lokasi || '') + '\n' +
      '• Sifat: Terbuka untuk Umum / 100% Gratis\n\n' +
      'Konfirmasi Kehadiran & Unduh Maklumat Resmi:\n' +
      'https://apologetislamindonesia.or.id/#/agenda\n\n' +
      'Barakallahu fiikum. Sebarkan kebaikan dakwah ini.';
  }

  return 'Bismillah. Laporan SIAP APII: ' + JSON.stringify(payload);
}

/**
 * Pembangkit URI wa.me Siap Klik
 */
function createWhatsAppClickUri(phoneStr, messageText) {
  var cleanPhone = formatE164(phoneStr).replace('+', '');
  return 'https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent(messageText);
}



// ============================================================================
// BERKAS: DriveVault.gs
// ============================================================================

/**
 * SIAP APII v3.0.0 Enterprise - DriveVault.gs
 * Manajemen Struktur Google Drive Vault 3-Tingkat Terisolasi & Pemantauan Kuota
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

var VAULT_CATEGORIES = [
  '01_SURAT_KELUAR',
  '02_SURAT_MASUK',
  '03_BUKTI_KAS',
  '04_LPJ_DIVISI',
  '05_BERKAS_KTA',
  '06_ASSET_CMS',
  '07_ADVOKASI_HUKUM',
  '08_MUALLAF_CARE',
  '09_ASET_LOGISTIK',
  '10_RISALAH_RAPAT'
];

// Kategori sensitif (PII KTP, perkara hukum, bukti kas, LPJ, muallaf, risalah pleno) wajib PRIVATE (UU PDP)
var PRIVATE_VAULT_CATEGORIES = [
  '03_BUKTI_KAS',
  '04_LPJ_DIVISI',
  '05_BERKAS_KTA',
  '07_ADVOKASI_HUKUM',
  '08_MUALLAF_CARE',
  '10_RISALAH_RAPAT'
];

/**
 * Mendapatkan atau Membuat Folder Induk Root Vault APII
 */
function getRootVaultFolder_() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('APII_ROOT_VAULT_ID');

  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (e) {
      Logger.log('Folder ID lama tidak valid, membuat folder root baru...');
    }
  }

  // Buat folder root baru di Google Drive
  var root = DriveApp.createFolder('VAULT_SIAP_APII_OFFICIAL');
  props.setProperty('APII_ROOT_VAULT_ID', root.getId());
  return root;
}

/**
 * Mendapatkan Folder Tenant Wilayah (Tingkat 2)
 */
function getTenantFolder_(wilayahId) {
  var root = getRootVaultFolder_();
  var folderName = wilayahId || 'DPP_PUSAT';

  var folders = root.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return root.createFolder(folderName);
}

/**
 * Mendapatkan Folder Kategori Khusus (Tingkat 3)
 */
function getCategoryFolder_(wilayahId, categoryName) {
  var tenantFolder = getTenantFolder_(wilayahId);
  var folders = tenantFolder.getFoldersByName(categoryName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return tenantFolder.createFolder(categoryName);
}

/**
 * Simpan Berkas Base64 ke Folder Vault Kategori dengan Penegakan Akses Privasi UU PDP
 */
function saveBase64FileToVault(wilayahId, categoryName, fileName, base64Data, mimeType) {
  try {
    if (VAULT_CATEGORIES.indexOf(categoryName) === -1) {
      return { ok: false, error: 'Kategori Drive Vault "' + categoryName + '" tidak valid.' };
    }
    var folder = getCategoryFolder_(wilayahId, categoryName);
    var cleanBase64 = String(base64Data || '').replace(/^data:[^;]+;base64,/, '');
    var decoded = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decoded, mimeType || 'application/octet-stream', fileName);

    var file = folder.createFile(blob);
    var isPrivate = PRIVATE_VAULT_CATEGORIES.indexOf(categoryName) !== -1;

    if (isPrivate) {
      file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    } else {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    return {
      ok: true,
      fileId: file.getId(),
      name: file.getName(),
      category: categoryName,
      access: isPrivate ? 'PRIVATE' : 'ANYONE_WITH_LINK',
      url: file.getUrl(),
      downloadUrl: file.getDownloadUrl()
    };
  } catch (err) {
    Logger.log('saveBase64FileToVault Error: ' + err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Handler Daftar Berkas pada Google Drive Vault Tenant
 */
function handleListDriveFiles_(session, payload) {
  var reqWilayah = payload && payload.wilayah_id ? payload.wilayah_id : session.wilayahId;
  var wilayahId = resolveAuthorizedWilayah_(session, reqWilayah);
  if (wilayahId === 'ALL') wilayahId = session.wilayahId || 'DPP_PUSAT';

  var category = payload && payload.category ? String(payload.category) : '';
  if (category && VAULT_CATEGORIES.indexOf(category) === -1) {
    return { ok: false, error: 'Kategori folder Drive Vault tidak dikenali.' };
  }

  var targetCategories = category ? [category] : VAULT_CATEGORIES;
  var files = [];

  for (var i = 0; i < targetCategories.length; i++) {
    var cat = targetCategories[i];
    try {
      var folder = getCategoryFolder_(wilayahId, cat);
      var iter = folder.getFiles();
      while (iter.hasNext()) {
        var f = iter.next();
        if (typeof f.isTrashed === 'function' && f.isTrashed()) continue;
        var isPrivate = PRIVATE_VAULT_CATEGORIES.indexOf(cat) !== -1;
        files.push({
          id: f.getId(),
          name: f.getName(),
          category: cat,
          mimeType: f.getMimeType(),
          size: f.getSize(),
          url: f.getUrl(),
          access: isPrivate ? 'PRIVATE' : 'ANYONE_WITH_LINK',
          createdAt: Utilities.formatDate(f.getDateCreated(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
        });
      }
    } catch (e) {
      Logger.log('handleListDriveFiles_ category error [' + cat + ']: ' + e.message);
    }
  }

  return {
    ok: true,
    wilayahId: wilayahId,
    categories: VAULT_CATEGORIES,
    files: files
  };
}

/**
 * Handler Unggah Berkas ke Google Drive Vault Tenant
 */
function handleUploadDriveFile_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'sekretaris', 'bendahara', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  var wilayahId = resolveAuthorizedWilayah_(session, payload && payload.wilayah_id);
  if (wilayahId === 'ALL') wilayahId = session.wilayahId || 'DPP_PUSAT';

  var category = payload && payload.category ? String(payload.category) : '';
  var fileName = (payload && (payload.file_name || payload.fileName)) || ('dokumen-' + new Date().getTime());
  var base64Data = payload && (payload.base64_data || payload.base64Data);
  var mimeType = (payload && (payload.mime_type || payload.mimeType)) || 'application/octet-stream';

  if (!category || VAULT_CATEGORIES.indexOf(category) === -1) {
    return { ok: false, error: 'Kategori folder Drive Vault wajib valid (01_SURAT_KELUAR s.d. 10_RISALAH_RAPAT).' };
  }
  if (!base64Data) {
    return { ok: false, error: 'Data berkas base64 wajib disertakan.' };
  }

  var res = saveBase64FileToVault(wilayahId, category, fileName, base64Data, mimeType);
  if (res.ok) {
    logAudit(session.userId, wilayahId, 'UPLOAD_DRIVE_FILE', 'DriveVault', res.fileId, {
      category: category,
      fileName: fileName,
      access: res.access
    });
  }
  return res;
}



// ============================================================================
// BERKAS: Setup.gs
// ============================================================================

/**
 * SIAP APII v3.0.0 Enterprise - Setup.gs
 * Fungsi Inisialisasi Idempoten (setup), Seeding Master 28 Tabel & Public API Handlers
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Inisialisasi Idempoten 28 Tabel Google Sheets & Akun Awal
 * Aman dijalankan berulang kali tanpa menimpa data yang sudah ada (Safe Migration)
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Spreadsheet aktif tidak ditemukan. Pastikan skrip terpasang di Google Sheets.');
  }

  Logger.log('=== MEMULAI SETUP IDEMPOTEN SIAP APII v3.0.0 ENTERPRISE ===');

  // 1. Inisialisasi 28 Tabel
  for (var tableName in TABLES_SCHEMA) {
    var sheet = ss.getSheetByName(tableName);
    var cols = TABLES_SCHEMA[tableName];

    if (!sheet) {
      sheet = ss.insertSheet(tableName);
      sheet.appendRow(cols);
      // Format baris header: latar Deep Emerald (#064E3B), teks putih tebal
      var headerRange = sheet.getRange(1, 1, 1, cols.length);
      headerRange.setBackground('#064E3B');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
      Logger.log('[NEW TABLE] ' + tableName + ' (' + cols.length + ' kolom)');
    } else {
      // Periksa dan sinkronisasi kolom yang mungkin belum ada di paling kanan
      var currentLastCol = sheet.getLastColumn();
      var currentHeaders = currentLastCol > 0 ? sheet.getRange(1, 1, 1, currentLastCol).getValues()[0] : [];
      for (var c = 0; c < cols.length; c++) {
        if (currentHeaders.indexOf(cols[c]) === -1) {
          sheet.getRange(1, currentLastCol + 1).setValue(cols[c]);
          currentLastCol++;
        }
      }
    }
  }

  // 2. Inisialisasi Master Data Wilayah (DPP Pusat & Pilot DPW Jabodetabek)
  var sheetWilayah = ss.getSheetByName('Sheet_Wilayah');
  if (sheetWilayah.getLastRow() <= 1) {
    sheetWilayah.appendRow(['DPP_PUSAT', 'Dewan Pimpinan Pusat (DPP)', 'DPP-APII', 'pusat', 'Gedung Dakwah Pusat APII, Jakarta', 'TRUE']);
    sheetWilayah.appendRow(['DPW_JABO', 'DPW Jabodetabek (Pilot Percontohan)', 'DPW-JABO', 'jabodetabek', 'Sekretariat DPW Jabodetabek, Jakarta Selatan', 'TRUE']);
    Logger.log('[SEED WILAYAH] 2 Wilayah Awal (DPP Pusat & DPW Jabodetabek) Berhasil Ditambahkan');
  }

  // 3. Inisialisasi Akun Pengurus Awal (Superadmin, BPH & Perwakilan Divisi)
  var sheetUsers = ss.getSheetByName('Sheet_Users');
  if (sheetUsers.getLastRow() <= 1) {
    var defaultPass = 'Demo123';
    var defaultHash = hashPassword_(defaultPass);
    var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');

    // Superadmin Nasional
    sheetUsers.appendRow([
      'USR-SUPERADMIN-01',
      'DPP_PUSAT',
      'admin',
      'Superadmin Nasional APII',
      'admin@apologetislamindonesia.or.id',
      '+6281358575678',
      defaultHash,
      'superadmin',
      'ALL_PERMISSIONS',
      'TRUE',
      nowStr,
      ''
    ]);

    // Ketua Umum DPP
    sheetUsers.appendRow([
      'USR-KETUM-01',
      'DPP_PUSAT',
      'ketua',
      'Ustadz Ketua Umum DPP APII',
      'ketum@apologetislamindonesia.or.id',
      '+6281200000001',
      defaultHash,
      'ketua',
      'KETUA_APPROVAL',
      'TRUE',
      nowStr,
      ''
    ]);

    // Sekretaris Umum DPP
    sheetUsers.appendRow([
      'USR-SEKJEN-01',
      'DPP_PUSAT',
      'sekretaris',
      'Ustadz Sekretaris Umum DPP APII',
      'sekretaris@apologetislamindonesia.or.id',
      '+6281200000002',
      defaultHash,
      'sekretaris',
      'PERSURATAN_DISPOSISI',
      'TRUE',
      nowStr,
      ''
    ]);

    // Bendahara Umum DPP
    sheetUsers.appendRow([
      'USR-BENDUM-01',
      'DPP_PUSAT',
      'bendahara',
      'Ustadz Bendahara Umum DPP APII',
      'bendahara@apologetislamindonesia.or.id',
      '+6281200000003',
      defaultHash,
      'bendahara',
      'KAS_KEUANGAN',
      'TRUE',
      nowStr,
      ''
    ]);

    // Ketua Divisi Dakwah DPP
    sheetUsers.appendRow([
      'USR-KADIV-DAKWAH-01',
      'DPP_PUSAT',
      'kadiv_dakwah',
      'Ketua Divisi Dakwah DPP APII',
      'dakwah@apologetislamindonesia.or.id',
      '+6281200000004',
      defaultHash,
      'ketua_divisi',
      'DIVISI_DAKWAH',
      'TRUE',
      nowStr,
      'dakwah'
    ]);

    // Ketua Divisi Hukum & Advokasi DPW Jabodetabek
    sheetUsers.appendRow([
      'USR-KADIV-HUKUM-JABO',
      'DPW_JABO',
      'kadiv_hukum_jabo',
      'Ketua Divisi Hukum DPW Jabodetabek',
      'hukum.jabo@apologetislamindonesia.or.id',
      '+6281200000005',
      defaultHash,
      'ketua_divisi',
      'DIVISI_HUKUM',
      'TRUE',
      nowStr,
      'hukum'
    ]);

    Logger.log('[SEED USERS] 6 Akun Pengurus Awal Berhasil Dibuat (Password default: ' + defaultPass + ')');
  }

  // 4. Inisialisasi Rekening Bank Resmi
  var sheetAcc = ss.getSheetByName('Sheet_Accounts');
  if (sheetAcc.getLastRow() <= 1) {
    sheetAcc.appendRow(['ACC-01', 'DPP_PUSAT', 'Bank Syariah Indonesia (BSI)', '7770001497', 'Yayasan Apologet Islam Indonesia', 'BANK', 'TRUE']);
    sheetAcc.appendRow(['ACC-02', 'DPP_PUSAT', 'QRIS Kas Masuk Dakwah Nasional', 'NMID-APII-PUSAT', 'Yayasan Apologet Islam Indonesia', 'QRIS', 'TRUE']);
    sheetAcc.appendRow(['ACC-03', 'DPP_PUSAT', 'Kasir Tunai Kesekretariatan (Batas Rp 2 Juta)', 'CASH-BUFFER-PUSAT', 'Bendahara Umum', 'CASH', 'TRUE']);
  }

  // 5. Inisialisasi Bank Dalil Awal (Knowledge Base)
  var sheetKb = ss.getSheetByName('Sheet_Knowledge_Base');
  if (sheetKb.getLastRow() <= 1) {
    sheetKb.appendRow([
      'KB-01',
      'Kristologi & Teologi',
      'Ketuhanan Yesus dalam Perspektif Al-Qur\'an',
      'QS. Al-Ma\'idah: 72 - "Sesungguhnya telah kafirlah orang-orang yang berkata: Sesungguhnya Allah ialah Al-Masih putra Maryam..."',
      'Tafsir Ibnu Katsir Jilid 3 Hal 150',
      'Yesus, Nabi Isa, Ketuhanan, Tritunggal, Al-Maidah 72',
      'Divisi Litbang APII',
      Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
    ]);
  }

  SpreadsheetApp.flush();
  Logger.log('=== SETUP PARIPURNA SELESAI DENGAN SUKSES ===');
  return { ok: true, message: 'Setup 28 tabel Google Sheets dan inisialisasi master data SIAP APII berhasil dilaksanakan.' };
}

// ============================================================================
// HANDLER FUNGSI PUBLIK & CMS
// ============================================================================

function handleVerifyPublicDoc_(token, expectedHash) {
  if (!token) return { ok: false, error: 'Token verifikasi tidak valid atau kosong.' };
  var cleanToken = String(token).trim();

  // 1. Cek apakah ini KTA Anggota
  var kta = dbFindOne('Sheet_KTA_Nasional', { nia: cleanToken });
  if (kta) {
    if (String(kta[COL_KTA_NASIONAL.IS_ACTIVE]).toLowerCase() !== 'true') {
      return { ok: false, error: 'KTA Anggota tidak aktif atau telah dicabut.' };
    }
    var pendaftarId = kta[COL_KTA_NASIONAL.PENDAFTAR_ID];
    if (pendaftarId) {
      var pend = dbFindOne('Sheet_Pendaftar', { id: pendaftarId });
      if (pend && pend[COL_PENDAFTAR.STATUS] !== 'APPROVED') {
        return { ok: false, error: 'Status pendaftaran anggota belum berstatus APPROVED.' };
      }
    }
    var expStr = kta[COL_KTA_NASIONAL.TGL_KEDALUWARSA];
    if (expStr) {
      var expDate = parseDateString_(expStr);
      var todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (expDate < todayStart) {
        return { ok: false, expired: true, error: 'KTA Anggota telah kedaluwarsa pada ' + expStr + '.' };
      }
    }
    var wilayahRow = dbFindOne('Sheet_Wilayah', { id: kta[COL_KTA_NASIONAL.WILAYAH_ID] });
    return {
      ok: true,
      tipe: 'KTA_ANGGOTA',
      nia: kta[COL_KTA_NASIONAL.NIA],
      nama: kta[COL_KTA_NASIONAL.NAMA_LENGKAP],
      tingkatLisensi: kta[COL_KTA_NASIONAL.TINGKAT_LISENSI],
      wilayah: wilayahRow ? wilayahRow[COL_WILAYAH.NAMA] : 'Wilayah APII',
      tglTerbit: kta[COL_KTA_NASIONAL.TGL_TERBIT],
      tglKedaluwarsa: expStr,
      statusKeaktifan: 'AKTIF RESMI',
      kodeEtik: kta[COL_KTA_NASIONAL.KODE_ETIK_VERSI]
    };
  }

  // 2. Cek apakah ini Surat Dinas Resmi (berdasarkan nomor surat, hash SHA-256, atau ID)
  var surat = dbFindOne('Sheet_Surat', { nomor_surat: cleanToken });
  if (!surat) {
    surat = dbFindOne('Sheet_Surat', { hash_sha256: cleanToken });
  }
  if (!surat) {
    surat = dbFindOne('Sheet_Surat', { id: cleanToken });
  }

  if (surat) {
    var suratStatus = surat[COL_SURAT_KELUAR.STATUS];
    if (suratStatus !== 'APPROVED') {
      return {
        ok: false,
        error: 'Dokumen belum disahkan atau tidak berstatus APPROVED (Status saat ini: ' + suratStatus + ').'
      };
    }

    var storedHash = String(surat[COL_SURAT_KELUAR.HASH_SHA256] || '').trim().toLowerCase();
    var expectedDeterministic = sha256Hex_(
      surat[COL_SURAT_KELUAR.NOMOR_SURAT] + '|' +
      surat[COL_SURAT_KELUAR.PERIHAL] + '|' +
      surat[COL_SURAT_KELUAR.TANGGAL] + '|' +
      surat[COL_SURAT_KELUAR.SIGNED_BY]
    );

    var isTampered = false;
    if (!storedHash || !/^[a-f0-9]{64}$/.test(storedHash)) {
      isTampered = true;
    } else if (storedHash !== expectedDeterministic) {
      isTampered = true;
    } else if (expectedHash && String(expectedHash).trim().toLowerCase() !== storedHash) {
      isTampered = true;
    }

    if (isTampered) {
      return {
        ok: false,
        tampered: true,
        message: 'PERINGATAN: DOKUMEN TIDAK VALID / TELAH DIMANIPULASI!',
        error: 'PERINGATAN: DOKUMEN TIDAK VALID / TELAH DIMANIPULASI!'
      };
    }

    var wilayahRow2 = dbFindOne('Sheet_Wilayah', { id: surat[COL_SURAT_KELUAR.WILAYAH_ID] });
    return {
      ok: true,
      tipe: 'SURAT_DINAS',
      nomorSurat: surat[COL_SURAT_KELUAR.NOMOR_SURAT],
      jenisSurat: surat[COL_SURAT_KELUAR.TIPE],
      perihal: surat[COL_SURAT_KELUAR.PERIHAL],
      penerbit: wilayahRow2 ? wilayahRow2[COL_WILAYAH.NAMA] : 'Yayasan APII',
      tanggal: surat[COL_SURAT_KELUAR.TANGGAL_HIJRIAH] || surat[COL_SURAT_KELUAR.TANGGAL],
      penandatangan: surat[COL_SURAT_KELUAR.SIGNED_BY],
      status: suratStatus,
      hashSha256: storedHash,
      keabsahan: '100% ASLI & TERDAFTAR DI GOOGLE DRIVE VAULT RESMI APII'
    };
  }

  // 3. Cek apakah ini Piagam Ikrar Syahadat Muallaf
  var muallaf = dbFindOne('Sheet_Muallaf', { reg_no: cleanToken });
  if (muallaf) {
    return {
      ok: true,
      tipe: 'PIAGAM_SYAHADAT',
      regNo: muallaf[COL_MUALLAF.REG_NO],
      namaAsli: muallaf[COL_MUALLAF.NAMA_ASLI],
      namaHijrah: muallaf[COL_MUALLAF.NAMA_HIJRAH],
      tglSyahadat: muallaf[COL_MUALLAF.TGL_SYAHADAT],
      pembimbing: muallaf[COL_MUALLAF.PEMBIMBING],
      keabsahan: 'SAH TERCATAT DI DIVISI DAKWAH & PEMBINAAN MUALLAF APII'
    };
  }

  // 4. Cek apakah ini Kwitansi Kas Resmi (BKM / BKK) -> Wajib APPROVED
  var kas = dbFindOne('Sheet_Keuangan', { no_voucher: cleanToken });
  if (!kas) {
    kas = dbFindOne('Sheet_Keuangan', { no_kwitansi: cleanToken });
  }
  if (kas) {
    var kasStatus = kas[COL_KEUANGAN.STATUS_APPROVAL];
    if (kasStatus !== 'APPROVED') {
      return {
        ok: false,
        error: 'Bukti transaksi kas belum berstatus APPROVED (Status saat ini: ' + kasStatus + ').'
      };
    }
    return {
      ok: true,
      tipe: 'KWITANSI_KAS',
      noVoucher: kas[COL_KEUANGAN.NO_VOUCHER],
      noKwitansi: kas[COL_KEUANGAN.NO_KWITANSI],
      kantongSyariah: kas[COL_KEUANGAN.KANTONG_SYARIAH],
      nominal: Number(kas[COL_KEUANGAN.NOMINAL]) || 0,
      tanggal: kas[COL_KEUANGAN.TANGGAL],
      keterangan: kas[COL_KEUANGAN.KETERANGAN],
      status: kasStatus,
      keabsahan: 'BUKTI KAS RESMI TERCATAT DI BUKU KAS UMUM (BKU) APII'
    };
  }

  return { ok: false, error: 'Nomor atau kode verifikasi tidak ditemukan di basis data resmi Yayasan APII.' };
}

function handleGetPublicContent_(wilayahSlug) {
  var slug = wilayahSlug || 'pusat';
  var wilayahRow = dbFindOne('Sheet_Wilayah', { slug: slug });
  var wilayahId = wilayahRow ? wilayahRow[COL_WILAYAH.ID] : 'DPP_PUSAT';

  // Smart Fallback jika data wilayah lokal kosong
  var wartaList = dbFind('Sheet_EditorialHistory', { wilayah_id: wilayahId }, 10);
  if (wartaList.length === 0 && wilayahId !== 'DPP_PUSAT') {
    wartaList = dbFind('Sheet_EditorialHistory', { wilayah_id: 'DPP_PUSAT' }, 10);
  }

  return {
    ok: true,
    wilayah: {
      id: wilayahId,
      nama: wilayahRow ? wilayahRow[COL_WILAYAH.NAMA] : 'Dewan Pimpinan Pusat (DPP)',
      slug: slug,
      alamat: wilayahRow ? wilayahRow[COL_WILAYAH.ALAMAT] : 'Gedung Dakwah Pusat APII, Jakarta'
    },
    wartaMaklumat: wartaList.map(function(r) {
      return { id: r[0], wilayahId: r[1], kategori: r[2], judul: r[3], konten: r[4], author: r[5], updatedAt: r[6] };
    })
  };
}

function handleSavePublicContent_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'sekretaris', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  var wilayahId = resolveAuthorizedWilayah_(session, payload && payload.wilayah_id);
  var id = (payload && payload.id) || ('CMS-' + new Date().getTime());
  var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');

  var existing = dbFindOne('Sheet_EditorialHistory', { id: id });
  if (existing) {
    var tenantGuard = assertRecordTenantAccess_(session, existing[COL_EDITORIAL_HISTORY.WILAYAH_ID]);
    if (!tenantGuard.ok) return tenantGuard;

    var updateMap = {};
    if (payload.kategori !== undefined) updateMap[COL_EDITORIAL_HISTORY.KATEGORI] = payload.kategori;
    if (payload.judul !== undefined) updateMap[COL_EDITORIAL_HISTORY.JUDUL] = payload.judul;
    if (payload.konten !== undefined) updateMap[COL_EDITORIAL_HISTORY.KONTEN] = payload.konten;
    updateMap[COL_EDITORIAL_HISTORY.AUTHOR] = session.username;
    updateMap[COL_EDITORIAL_HISTORY.UPDATED_AT] = nowStr;
    dbUpdate('Sheet_EditorialHistory', COL_EDITORIAL_HISTORY.ID, id, updateMap);
  } else {
    dbInsert('Sheet_EditorialHistory', [
      id,
      wilayahId,
      (payload && payload.kategori) || 'WARTA',
      (payload && payload.judul) || 'Maklumat Resmi APII',
      (payload && payload.konten) || '',
      session.username,
      nowStr
    ]);
  }

  logAudit(session.userId, wilayahId, 'SAVE_PUBLIC_CONTENT', 'EditorialCMS', id, { judul: payload && payload.judul });
  return { ok: true, id: id, message: 'Konten warta/agenda publik berhasil dipublikasikan.' };
}

function handleGetWilayahList_() {
  var raw = dbFind('Sheet_Wilayah', { is_active: 'TRUE' });
  var list = raw.map(function(r) {
    return { id: r[0], nama: r[1], kode: r[2], slug: r[3], alamat: r[4] };
  });
  return { ok: true, list: list };
}

function handleRecordVisitor_(payload) {
  var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
  dbInsert('Sheet_Visitors', [
    'VIS-' + new Date().getTime(),
    payload.wilayah_id || 'DPP_PUSAT',
    nowStr,
    payload.ip_hash || 'anon',
    payload.user_agent || '',
    payload.page_viewed || '/'
  ]);
  return { ok: true };
}

function handleGetDashboardStats_(session, targetWilayah) {
  var wil = resolveAuthorizedWilayah_(session, targetWilayah);

  var filter = wil === 'ALL' ? null : { wilayah_id: wil };
  var suratCount = dbFind('Sheet_Surat', filter).length;
  var suratMasukCount = dbFind('Sheet_Surat_Masuk', filter).length;
  var pendaftarCount = dbFind('Sheet_Pendaftar', filter).length;
  var keuangan = handleGetKeuanganList_(session, { wilayah_id: wil });

  return {
    ok: true,
    stats: {
      suratKeluarCount: suratCount,
      suratMasukCount: suratMasukCount,
      pendaftarCount: pendaftarCount,
      saldoKas: keuangan.saldo
    }
  };
}

function handleGetUsersList_(session) {
  if (session.role !== 'superadmin') {
    return { ok: false, error: 'Hanya Superadmin yang berwenang melihat daftar seluruh pengguna.' };
  }
  var raw = dbFind('Sheet_Users', null, 200);
  var list = raw.map(function(r) {
    return {
      userId: r[COL_USERS.USER_ID],
      wilayahId: r[COL_USERS.WILAYAH_ID],
      username: r[COL_USERS.USERNAME],
      fullname: r[COL_USERS.FULLNAME],
      email: r[COL_USERS.EMAIL],
      phone: r[COL_USERS.PHONE],
      role: r[COL_USERS.ROLE],
      divisi: r[COL_USERS.DIVISI] || '',
      isActive: r[COL_USERS.IS_ACTIVE]
    };
  });
  return { ok: true, list: list };
}

function handleSaveUser_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin']);
  if (!roleGuard.ok) return roleGuard;

  var userId = payload.user_id || ('USR-' + new Date().getTime() + '-' + Utilities.getUuid().substring(0, 6).toUpperCase());
  var passwordHash = hashPassword_(payload.password || 'APII@Baru2026');
  var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
  var isActiveStr = (payload.is_active === false || String(payload.is_active).toUpperCase() === 'FALSE' || String(payload.is_active) === '0')
    ? 'FALSE'
    : 'TRUE';

  var existing = dbFindOne('Sheet_Users', { user_id: userId });
  if (existing) {
    var updateMap = {};
    if (payload.wilayah_id !== undefined) updateMap[COL_USERS.WILAYAH_ID] = payload.wilayah_id;
    if (payload.username !== undefined) updateMap[COL_USERS.USERNAME] = payload.username;
    if (payload.fullname !== undefined) updateMap[COL_USERS.FULLNAME] = payload.fullname;
    if (payload.email !== undefined) updateMap[COL_USERS.EMAIL] = payload.email;
    if (payload.phone !== undefined) updateMap[COL_USERS.PHONE] = payload.phone;
    if (payload.role !== undefined) updateMap[COL_USERS.ROLE] = payload.role;
    if (payload.divisi !== undefined) updateMap[COL_USERS.DIVISI] = payload.divisi;
    updateMap[COL_USERS.IS_ACTIVE] = isActiveStr;
    dbUpdate('Sheet_Users', COL_USERS.USER_ID, userId, updateMap);

    if (isActiveStr === 'FALSE') {
      revokeAllUserSessions_(userId);
      revokeAllUserSessions_(existing[COL_USERS.USERNAME]);
    }
  } else {
    dbInsert('Sheet_Users', [
      userId,
      payload.wilayah_id || 'DPP_PUSAT',
      payload.username,
      payload.fullname,
      payload.email || '',
      payload.phone || '',
      passwordHash,
      payload.role || 'anggota_divisi',
      'STANDARD',
      isActiveStr,
      nowStr,
      payload.divisi || ''
    ]);
  }

  logAudit(session.userId, session.wilayahId, 'SAVE_USER', 'User', userId, { role: payload.role, isActive: isActiveStr });
  return { ok: true, userId: userId, message: 'Data pengguna pengurus berhasil disimpan.' };
}

function handleRegisterNewWilayah_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin']);
  if (!roleGuard.ok) return roleGuard;

  var rawKode = payload.kode || payload.code || 'NEW';
  var cleanCode = String(rawKode).toUpperCase().replace(/^(DPW[_-])/i, '').replace(/[^A-Z0-9]/g, '');
  var id = 'DPW_' + (cleanCode || 'NEW');
  var existing = dbFindOne('Sheet_Wilayah', { id: id });
  if (existing) {
    return { ok: false, error: 'Kode wilayah ' + id + ' sudah terdaftar.' };
  }

  var nama = payload.nama || payload.name || ('DPW ' + cleanCode);
  var kode = payload.kode || payload.code || ('DPW-' + cleanCode);
  var slug = payload.slug || cleanCode.toLowerCase();
  var alamat = payload.alamat || payload.address || (payload.city ? ('Sekretariat DPW APII, ' + payload.city) : '');

  dbInsert('Sheet_Wilayah', [
    id,
    nama,
    kode,
    slug,
    alamat,
    'TRUE'
  ]);

  logAudit(session.userId, 'DPP_PUSAT', 'REGISTER_TENANT_WILAYAH', 'Wilayah', id, { nama: nama, slug: slug });
  return { ok: true, wilayahId: id, slug: slug, message: 'DPW baru berhasil didaftarkan ke jaringan multi-tenant nasional.' };
}

function handleAddNewTenantWilayah_(session, payload) {
  return handleRegisterNewWilayah_(session, payload);
}

function handleGetAuditLogs_(session, payload) {
  if (['superadmin', 'pengawas', 'pembina'].indexOf(session.role) === -1) {
    return { ok: false, error: 'Hanya Dewan Pengawas, Pembina, atau Superadmin yang berwenang meninjau log audit.' };
  }

  var targetWilayah = resolveAuthorizedWilayah_(session, payload && payload.wilayah_id);
  var filter = (session.role === 'superadmin' || session.role === 'pengawas') && targetWilayah === 'ALL' ? null : { wilayah_id: targetWilayah };
  var rawList = dbFind('Sheet_AuditLogs', filter, 200);

  var list = rawList.map(function(r) {
    return {
      id: r[COL_AUDIT_LOGS.ID],
      timestamp: r[COL_AUDIT_LOGS.TIMESTAMP],
      userId: r[COL_AUDIT_LOGS.USER_ID],
      wilayahId: r[COL_AUDIT_LOGS.WILAYAH_ID],
      action: r[COL_AUDIT_LOGS.ACTION],
      entity: r[COL_AUDIT_LOGS.ENTITY],
      recordId: r[COL_AUDIT_LOGS.RECORD_ID],
      entityId: r[COL_AUDIT_LOGS.RECORD_ID],
      details: r[COL_AUDIT_LOGS.DETAILS_JSON],
      ipAddress: r[COL_AUDIT_LOGS.IP_ADDRESS]
    };
  });

  return { ok: true, list: list };
}

function handleGetSettings_(session) {
  var rows = dbFind('Sheet_Settings', null, 500);
  var settings = {};
  for (var i = 0; i < rows.length; i++) {
    settings[rows[i][0]] = rows[i][1];
  }
  return { ok: true, settings: settings };
}

function handleGetSettingsAudit_(session, payload) {
  if (['superadmin', 'pengawas', 'pembina', 'ketua'].indexOf(session.role) === -1) {
    return { ok: false, error: 'Anda tidak memiliki izin melihat riwayat perubahan pengaturan sistem.' };
  }
  var rows = dbFind('Sheet_Settings_Audit', null, 200);
  var list = rows.map(function(r) {
    return {
      id: r[COL_SETTINGS_AUDIT.ID],
      key: r[COL_SETTINGS_AUDIT.KEY],
      oldValue: r[COL_SETTINGS_AUDIT.OLD_VALUE],
      newValue: r[COL_SETTINGS_AUDIT.NEW_VALUE],
      changedBy: r[COL_SETTINGS_AUDIT.CHANGED_BY],
      timestamp: r[COL_SETTINGS_AUDIT.TIMESTAMP]
    };
  });
  return { ok: true, list: list };
}

function handleSaveSettings_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin']);
  if (!roleGuard.ok) return roleGuard;

  var newSettings = payload.settings || {};
  var now = new Date();
  var nowStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
  var existingRows = dbFind('Sheet_Settings', null, 500);
  var existingMap = {};
  for (var i = 0; i < existingRows.length; i++) {
    existingMap[existingRows[i][0]] = existingRows[i][1];
  }

  var changedKeys = [];
  for (var key in newSettings) {
    var oldVal = String(existingMap[key] || '');
    var newVal = String(newSettings[key] || '');
    if (oldVal !== newVal) {
      // Record Diff in Sheet_Settings_Audit
      var auditId = 'SET-AUD-' + Math.floor(1000 + Math.random() * 9000);
      dbInsert('Sheet_Settings_Audit', [
        auditId,
        key.toUpperCase(),
        oldVal,
        newVal,
        session.userId,
        nowStr
      ]);

      // Upsert Sheet_Settings
      var existingRow = dbFindOne('Sheet_Settings', { key: key });
      if (existingRow) {
        dbUpdate('Sheet_Settings', { key: key }, {
          value: newVal,
          updated_by: session.userId,
          updated_at: nowStr
        });
      } else {
        dbInsert('Sheet_Settings', [
          key,
          newVal,
          payload.wilayah_id || 'DPP_PUSAT',
          session.userId,
          nowStr
        ]);
      }
      changedKeys.push(key);
    }
  }

  logAudit(session.userId, 'DPP_PUSAT', 'UPDATE_SETTINGS', 'Settings', 'MASTER_SETTINGS', { changedKeys: changedKeys });
  return { ok: true, message: 'Master Pengaturan Yayasan berhasil disinkronkan.', changedCount: changedKeys.length };
}

function handleGetActiveSessions_(session) {
  if (['superadmin', 'ketua', 'sekretaris'].indexOf(session.role) === -1) {
    return { ok: false, error: 'Hanya Ketua, Sekretaris, atau Superadmin yang berwenang memantau sesi login multi-device.' };
  }

  var userLookup = {};
  var userRows = dbFind('Sheet_Users', null, 300);
  for (var u = 0; u < userRows.length; u++) {
    userLookup[userRows[u][COL_USERS.USER_ID]] = userRows[u];
  }

  var filter = isNationalExecutive_(session) ? null : { wilayah_id: session.wilayahId };
  var rows = dbFind('Sheet_Sessions', filter, 200);
  var sessions = rows.map(function(r) {
    var uRow = userLookup[r[COL_SESSIONS.USER_ID]];
    var fullName = r[COL_SESSIONS.FULLNAME] || (uRow ? uRow[COL_USERS.FULLNAME] : r[COL_SESSIONS.USERNAME]);
    var divisi = r[COL_SESSIONS.DIVISI] || (uRow ? (uRow[COL_USERS.DIVISI] || '') : '');
    return {
      token: r[COL_SESSIONS.TOKEN],
      userId: r[COL_SESSIONS.USER_ID],
      username: r[COL_SESSIONS.USERNAME],
      fullName: fullName,
      role: r[COL_SESSIONS.ROLE],
      tenantId: r[COL_SESSIONS.WILAYAH_ID],
      divisi: divisi,
      device: r[COL_SESSIONS.DEVICE] || 'Web Portal Browser',
      ipAddress: r[COL_SESSIONS.IP_ADDRESS] || '-',
      loginAt: r[COL_SESSIONS.LOGIN_AT] || '-',
      expiresAt: r[COL_SESSIONS.EXPIRES_AT]
    };
  });

  return { ok: true, sessions: sessions };
}

function handleRevokeSession_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin']);
  if (!roleGuard.ok) return roleGuard;

  var token = payload.token;
  if (!token) {
    return { ok: false, error: 'Token sesi wajib disertakan.' };
  }

  var deleted = dbDelete('Sheet_Sessions', COL_SESSIONS.TOKEN, token);
  logAudit(session.userId, 'DPP_PUSAT', 'REVOKE_SESSION', 'Session', token, { revokedBy: session.userId });
  return { ok: deleted, message: deleted ? 'Izin sesi perangkat berhasil dicabut.' : 'Token sesi tidak ditemukan.' };
}

function handleGetDeadlockQueue_(session, payload) {
  if (session.role !== 'superadmin') {
    return { ok: false, error: 'Hanya Superadmin Nasional yang berwenang melihat antrean Deadlock Breaker.' };
  }

  var queue = [];

  // 1. Surat Keluar tertahan
  var suratRows = dbFind('Sheet_Surat', null, 200);
  for (var i = 0; i < suratRows.length; i++) {
    var sr = suratRows[i];
    if (sr[COL_SURAT_KELUAR.STATUS] === 'AJUKAN' || sr[COL_SURAT_KELUAR.STATUS] === 'DRAFT') {
      queue.push({
        type: 'surat',
        id: sr[COL_SURAT_KELUAR.ID],
        wilayahId: sr[COL_SURAT_KELUAR.WILAYAH_ID],
        title: sr[COL_SURAT_KELUAR.PERIHAL],
        status: sr[COL_SURAT_KELUAR.STATUS],
        createdAt: sr[COL_SURAT_KELUAR.CREATED_AT]
      });
    }
  }

  // 2. Kas Keluar tertahan (termasuk VERIFIKASI_BENDAHARA, VERIFIED_BENDAHARA, VERIFIKASI_KETUM)
  var kasRows = dbFind('Sheet_Keuangan', null, 200);
  for (var k = 0; k < kasRows.length; k++) {
    var kr = kasRows[k];
    var ks = kr[COL_KEUANGAN.STATUS_APPROVAL];
    if (kr[COL_KEUANGAN.TIPE] === 'KELUAR' && (ks === 'VERIFIKASI_BENDAHARA' || ks === 'VERIFIED_BENDAHARA' || ks === 'VERIFIKASI_KETUM')) {
      queue.push({
        type: 'kas',
        id: kr[COL_KEUANGAN.ID],
        wilayahId: kr[COL_KEUANGAN.WILAYAH_ID],
        title: kr[COL_KEUANGAN.KETERANGAN] + ' (' + formatRupiah(kr[COL_KEUANGAN.NOMINAL]) + ')',
        status: ks,
        createdAt: kr[COL_KEUANGAN.CREATED_AT]
      });
    }
  }

  // 3. Disposisi / Surat Masuk tertahan
  var smRows = dbFind('Sheet_Surat_Masuk', null, 200);
  for (var m = 0; m < smRows.length; m++) {
    var sm = smRows[m];
    if (sm[COL_SURAT_MASUK.STATUS_DISPOSISI] === 'MENUNGGU_DISPOSISI') {
      queue.push({
        type: 'disposisi',
        id: sm[COL_SURAT_MASUK.ID],
        wilayahId: sm[COL_SURAT_MASUK.WILAYAH_ID],
        title: sm[COL_SURAT_MASUK.NO_AGENDA] + ' - ' + sm[COL_SURAT_MASUK.PERIHAL],
        status: sm[COL_SURAT_MASUK.STATUS_DISPOSISI],
        createdAt: sm[COL_SURAT_MASUK.CREATED_AT]
      });
    }
  }

  // 4. Pendaftar KTA tertahan
  var penRows = dbFind('Sheet_Pendaftar', null, 200);
  for (var p = 0; p < penRows.length; p++) {
    var pr = penRows[p];
    if (pr[COL_PENDAFTAR.STATUS] === 'MENUNGGU_VERIFIKASI' || pr[COL_PENDAFTAR.STATUS] === 'VERIFIED_SEKRETARIS') {
      queue.push({
        type: 'kta',
        id: pr[COL_PENDAFTAR.ID],
        wilayahId: pr[COL_PENDAFTAR.WILAYAH_ID],
        title: 'Calon Anggota: ' + pr[COL_PENDAFTAR.NAMA],
        status: pr[COL_PENDAFTAR.STATUS],
        createdAt: ''
      });
    }
  }

  return { ok: true, queue: queue };
}

function handleExecuteDeadlockBreaker_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin']);
  if (!roleGuard.ok) return roleGuard;

  var docType = payload.doc_type;
  var docId = payload.doc_id;
  var reason = payload.reason;
  var docRef = payload.doc_ref || 'SK-DPP/PLENO-DARURAT/XI/2026';

  if (!reason || reason.length < 15) {
    return { ok: false, error: 'Alasan kedaruratan wajib minimal 15 karakter.' };
  }

  return withScriptLock_(function() {
    var now = new Date();
    var nowStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
    var resolvedItem = null;

    if (docType === 'surat') {
      var surat = dbFindOne('Sheet_Surat', { id: docId });
      if (surat) {
        var wilSurat = surat[COL_SURAT_KELUAR.WILAYAH_ID];
        var nomorResmi = surat[COL_SURAT_KELUAR.NOMOR_SURAT];
        if (!nomorResmi || nomorResmi.indexOf('DRAFT') !== -1) {
          var kopMeta = getKopMetadata(wilSurat);
          var seqNum = getNextSequence(wilSurat, 'SURAT_' + (surat[COL_SURAT_KELUAR.TIPE] || 'UMUM'));
          var padSeq = ('000' + seqNum).slice(-3);
          var kodeTipe = 'ST';
          var tipeSurat = surat[COL_SURAT_KELUAR.TIPE] || '';
          if (tipeSurat.indexOf('Keputusan') !== -1) kodeTipe = 'SK';
          else if (tipeSurat.indexOf('Mandat') !== -1) kodeTipe = 'SM';
          else if (tipeSurat.indexOf('Undangan') !== -1) kodeTipe = 'UND';
          else if (tipeSurat.indexOf('Rekomendasi') !== -1) kodeTipe = 'REK';
          else if (tipeSurat.indexOf('Maklumat') !== -1) kodeTipe = 'MAK';
          nomorResmi = padSeq + '/' + kodeTipe + '-' + kopMeta.kodeSuratTenant + '/' + toRomanMonth(now.getMonth() + 1) + '/' + now.getFullYear();
        }
        var signer = session.userId + ' [SUPERADMIN DEADLOCK OVERRIDE]';
        var hashSha = sha256Hex_(nomorResmi + '|' + surat[COL_SURAT_KELUAR.PERIHAL] + '|' + surat[COL_SURAT_KELUAR.TANGGAL] + '|' + signer);
        dbUpdate('Sheet_Surat', { id: docId }, {
          nomor_surat: nomorResmi,
          status: 'APPROVED',
          signed_by: signer,
          hash_sha256: hashSha
        });
        resolvedItem = { id: docId, type: 'Surat Keluar', nomorSurat: nomorResmi };
      }
    } else if (docType === 'kas') {
      var kas = dbFindOne('Sheet_Keuangan', { id: docId });
      if (kas) {
        var wilKas = kas[COL_KEUANGAN.WILAYAH_ID];
        var noVoucher = kas[COL_KEUANGAN.NO_VOUCHER];
        var noKwitansi = kas[COL_KEUANGAN.NO_KWITANSI];
        if (!noVoucher || noVoucher.indexOf('DRAFT') !== -1) {
          var seqBkk = getNextSequence(wilKas, 'KAS_BKK');
          var padSeqBkk = ('000' + seqBkk).slice(-3);
          var ym = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMM');
          noVoucher = 'BKK-' + ym + '-' + padSeqBkk;
          noKwitansi = 'KW-OUT-' + ym + '-' + padSeqBkk;
        }
        dbUpdate('Sheet_Keuangan', { id: docId }, {
          no_voucher: noVoucher,
          status_approval: 'APPROVED',
          approved_ketua_by: session.userId + ' [SUPERADMIN DEADLOCK OVERRIDE]',
          no_kwitansi: noKwitansi
        });
        resolvedItem = { id: docId, type: 'Kas Keluar', noVoucher: noVoucher };
      }
    } else if (docType === 'disposisi') {
      var disp = dbFindOne('Sheet_Disposisi', { id: docId });
      if (!disp) {
        disp = dbFindOne('Sheet_Disposisi', { surat_masuk_id: docId });
      }
      var smRow = dbFindOne('Sheet_Surat_Masuk', { id: disp ? disp[COL_DISPOSISI.SURAT_MASUK_ID] : docId });
      var smId = smRow ? smRow[COL_SURAT_MASUK.ID] : (disp ? disp[COL_DISPOSISI.SURAT_MASUK_ID] : null);
      if (disp) {
        dbUpdate('Sheet_Disposisi', { id: disp[COL_DISPOSISI.ID] }, {
          status: 'DIDISPOSISIKAN',
          paraf_ketua: 'PARAF_SUPERADMIN_DEADLOCK',
          instruksi_ketua: 'Instruksi Pengesahan Darurat Superadmin: ' + reason,
          updated_at: nowStr
        });
      } else if (smRow) {
        dbInsert('Sheet_Disposisi', [
          'DSP-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMddHHmmss'),
          smRow[COL_SURAT_MASUK.WILAYAH_ID],
          smId,
          '',
          'Instruksi Pengesahan Darurat Superadmin: ' + reason,
          'umum',
          'Segera',
          '',
          '',
          'PARAF_SUPERADMIN_DEADLOCK',
          'DIDISPOSISIKAN',
          '',
          nowStr,
          '{}'
        ]);
      }
      if (smId) {
        dbUpdate('Sheet_Surat_Masuk', { id: smId }, {
          status_disposisi: 'SUDAH_DIDISPOSISIKAN'
        });
        resolvedItem = { id: docId, suratMasukId: smId, type: 'Disposisi' };
      }
    } else if (docType === 'kta') {
      var pendaftar = dbFindOne('Sheet_Pendaftar', { id: docId });
      if (pendaftar) {
        var issued = issueCanonicalNiaAndKta_(pendaftar, payload.tingkat_lisensi, '', session.userId);
        resolvedItem = { id: docId, nia: issued.nia, type: 'KTA Anggota' };
      }
    }

    if (!resolvedItem) {
      return { ok: false, error: 'Dokumen target tidak ditemukan di sistem.' };
    }

    logAudit(session.userId, 'DPP_PUSAT', 'SUPERADMIN_OVERRIDE', docType.toUpperCase(), docId, {
      reason: reason,
      risalahRef: docRef,
      resolvedItem: resolvedItem
    });

    return {
      ok: true,
      message: 'Deadlock Breaker Berhasil: Pengesahan darurat telah dieksekusi dan dicatat di WORM Audit Trail.',
      resolvedItem: resolvedItem
    };
  }, 10000);
}



// ============================================================================
// BERKAS: Code.gs
// ============================================================================

/**
 * SIAP APII v3.0.0 Enterprise - Code.gs
 * Central HTTP Gateway (doGet & doPost) dengan CORS Handler & Action Router Aman
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Helper Respon JSON Berstandar APII dengan Header CORS Lengkap
 */
function createJsonResponse_(dataObj) {
  var output = ContentService.createTextOutput(JSON.stringify(dataObj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Penangan Permintaan HTTP GET (doGet)
 * Digunakan untuk: Health Check, Info Organisasi, Verifikasi Dokumen Publik (QR Scan), dan Data Publik (Warta/Agenda)
 */
function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};
    var action = params.action || 'ping';

    // 1. Health check & Informasi Sistem
    if (action === 'ping') {
      return createJsonResponse_({
        ok: true,
        system: 'SIAP APII v3.0.0 Enterprise',
        organisasi: 'Yayasan Apologet Islam Indonesia (APII)',
        legalitas: 'AHU-0014970.AH.01.04.Tahun 2023',
        status: 'ONLINE',
        timestamp: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
      });
    }

    // 2. Verifikasi Dokumen Publik (QR Code Surat / KTA / Piagam Syahadat / Kwitansi)
    if (action === 'verifyPublic' || action === 'verifyDocument') {
      var token = params.token || params.hash || params.id || '';
      return createJsonResponse_(handleVerifyPublicDoc_(token, params.hash || ''));
    }

    // 3. Pengambilan Konten Publik (Warta Maklumat & Agenda Dakwah)
    if (action === 'getPublicContent') {
      var wilayahSlug = params.wilayah || 'pusat';
      return createJsonResponse_(handleGetPublicContent_(wilayahSlug));
    }

    // 4. Pengambilan Master Tenant Wilayah (Daftar DPW Aktif)
    if (action === 'getWilayahList') {
      return createJsonResponse_(handleGetWilayahList_());
    }

    // 5. Cek Tiket Konsultasi Aqidah Rahasia
    if (action === 'checkConsultation') {
      var ticketNo = params.ticket || '';
      var secretToken = params.token || '';
      return createJsonResponse_(handleCheckConsultation_(ticketNo, secretToken));
    }

    // Rute default
    return createJsonResponse_({ ok: false, error: 'Aksi GET "' + action + '" tidak dikenali.' });
  } catch (err) {
    Logger.log('doGet Error: ' + err.message);
    return createJsonResponse_({ ok: false, error: err.message });
  }
}

var READ_ONLY_POST_ACTIONS_ = [
  'logout',
  'getDashboardStats',
  'getSuratList',
  'getSuratMasukList',
  'getKeuanganList',
  'getDivisiPrograms',
  'getPendaftarList',
  'getAdvokasiList',
  'getMuallafList',
  'getAssetsList',
  'searchKnowledgeBase',
  'getConsultationsList',
  'getAuditLogs',
  'getSettings',
  'getSettingsAudit',
  'listDriveFiles'
];

/**
 * Penangan Permintaan HTTP POST (doPost)
 * Gerbang Utama Transaksi Frontend ke Backend (Auth, Persuratan, Keuangan, Disposisi, KTA, dll.)
 */
function doPost(e) {
  try {
    var rawPost = e && e.postData ? e.postData.contents : '';
    if (!rawPost) {
      return createJsonResponse_({ ok: false, error: 'Payload POST kosong.' });
    }

    var request = JSON.parse(rawPost);
    var action = request.action || '';
    var token = request.token || '';
    var payload = request.payload || {};

    // 1. Aksi Publik Tanpa Token Sesi (Pendaftaran, Verifikasi, Konsultasi, Pelaporan Advokasi)
    if (action === 'login') {
      return createJsonResponse_(handleLogin_(payload.username, payload.password, payload.wilayah_id, payload.meta));
    }
    if (action === 'verifyDocument' || action === 'verifyPublic') {
      return createJsonResponse_(handleVerifyPublicDoc_(payload.token || payload.id || '', payload.hash || ''));
    }
    if (action === 'registerMember') {
      return createJsonResponse_(handleRegisterMember_(payload));
    }
    if (action === 'submitAdvokasiIntake') {
      return createJsonResponse_(handleSubmitAdvokasiIntake_(payload));
    }
    if (action === 'submitConsultation') {
      return createJsonResponse_(handleSubmitConsultation_(payload));
    }
    if (action === 'recordVisitor') {
      return createJsonResponse_(handleRecordVisitor_(payload));
    }

    // 2. Validasi Token Sesi untuk Seluruh Aksi Private Pengurus
    var session = validateSession_(token);
    if (!session.valid) {
      return createJsonResponse_({ ok: false, code: 'AUTH_EXPIRED', error: session.error || 'Sesi pengurus telah kedaluwarsa. Silakan login kembali.' });
    }

    var currentUserId = session.userId;
    var currentRole = session.role;

    // 2b. Guard Global: Peran Read-Only (pembina & pengawas) DILARANG melakukan mutasi apapun
    if (isReadOnlyRole_(currentRole) && READ_ONLY_POST_ACTIONS_.indexOf(action) === -1) {
      return createJsonResponse_({
        ok: false,
        code: 'READ_ONLY_ROLE',
        error: 'Akses Ditolak: Peran "' + currentRole + '" bersifat Read-Only dan tidak diizinkan melakukan mutasi (' + action + ').'
      });
    }

    // 3. Router Berdasarkan Modul Kerja
    switch (action) {
      // Sesi & Profil Pengurus
      case 'logout':
        return createJsonResponse_(handleLogout_(token));
      case 'changePassword':
        return createJsonResponse_(handleChangePassword_(currentUserId, payload.old_password, payload.new_password));
      case 'getDashboardStats':
        return createJsonResponse_(handleGetDashboardStats_(session, payload.target_wilayah));

      // Modul 2: Persuratan Keluar & Naskah Dinas
      case 'getSuratList':
        return createJsonResponse_(handleGetSuratList_(session, payload));
      case 'saveSurat':
        return createJsonResponse_(handleSaveSurat_(session, payload));
      case 'approveSurat':
        return createJsonResponse_(handleApproveSurat_(session, payload));
      case 'rejectSurat':
        return createJsonResponse_(handleApproveSurat_(session, Object.assign({}, payload, { is_approved: false, approved: false, status: 'REJECTED' })));
      case 'generateSKKepengurusan':
        return createJsonResponse_(handleGenerateSKKepengurusan_(session, payload));

      // Modul 3: Agenda Surat Masuk & Lembar Disposisi Multi-Divisi
      case 'getSuratMasukList':
        return createJsonResponse_(handleGetSuratMasukList_(session, payload));
      case 'saveSuratMasuk':
        return createJsonResponse_(handleSaveSuratMasuk_(session, payload));
      case 'saveDisposisi':
        return createJsonResponse_(handleSaveDisposisi_(session, payload));
      case 'updateDisposisiProgress':
        return createJsonResponse_(handleUpdateDisposisiProgress_(session, payload));

      // Modul 4: Keuangan Kas Syar'i (4 Kantong & Dual-Approval)
      case 'getKeuanganList':
        return createJsonResponse_(handleGetKeuanganList_(session, payload));
      case 'saveKasMasuk':
        return createJsonResponse_(handleSaveKasMasuk_(session, payload));
      case 'ajukanKasKeluar':
        return createJsonResponse_(handleAjukanKasKeluar_(session, payload));
      case 'verifyKasBendahara':
        return createJsonResponse_(handleVerifyKasBendahara_(session, payload));
      case 'approveKasKetua':
        return createJsonResponse_(handleApproveKasKetua_(session, payload));
      case 'generateMonthlyClosing':
        return createJsonResponse_(handleGenerateMonthlyClosing_(session, payload));

      // Modul 5: Program Kerja 7 Divisi Resmi
      case 'getDivisiPrograms':
        return createJsonResponse_(handleGetDivisiPrograms_(session, payload));
      case 'saveDivisiProgram':
        return createJsonResponse_(handleSaveDivisiProgram_(session, payload));
      case 'approveDivisiProgram':
        return createJsonResponse_(handleApproveDivisiProgram_(session, payload));
      case 'requestProkerDisbursement':
        return createJsonResponse_(handleRequestProkerDisbursement_(session, payload));
      case 'submitDivisiLPJ':
        return createJsonResponse_(handleSubmitDivisiLPJ_(session, payload));

      // Modul 6: Keanggotaan Nasional & KTA Digital CR80
      case 'getPendaftarList':
        return createJsonResponse_(handleGetPendaftarList_(session, payload));
      case 'verifyPendaftarSekretaris':
        return createJsonResponse_(handleVerifyPendaftarSekretaris_(session, payload));
      case 'approveAnggotaKetua':
        return createJsonResponse_(handleApproveAnggotaKetua_(session, payload));

      // Modul 7 s/d 9: Rangkaian Inovasi Dakwah & CMS
      case 'getAdvokasiList':
        return createJsonResponse_(handleGetAdvokasiList_(session, payload));
      case 'updateAdvokasiStatus':
        return createJsonResponse_(handleUpdateAdvokasiStatus_(session, payload));
      case 'saveTabayyun':
        return createJsonResponse_(handleSaveTabayyun_(session, payload));
      case 'getMuallafList':
        return createJsonResponse_(handleGetMuallafList_(session, payload));
      case 'saveMuallaf':
        return createJsonResponse_(handleSaveMuallaf_(session, payload));
      case 'updateMuallafProgress':
        return createJsonResponse_(handleUpdateMuallafProgress_(session, payload));
      case 'recordEventAttendance':
        return createJsonResponse_(handleRecordEventAttendance_(session, payload));
      case 'getAssetsList':
        return createJsonResponse_(handleGetAssetsList_(session, payload));
      case 'saveAssetLoan':
        return createJsonResponse_(handleSaveAssetLoan_(session, payload));
      case 'searchKnowledgeBase':
        return createJsonResponse_(handleSearchKnowledgeBase_(session, payload));
      case 'getConsultationsList':
        return createJsonResponse_(handleGetConsultationsList_(session, payload));
      case 'answerConsultation':
        return createJsonResponse_(handleAnswerConsultation_(session, payload));
      case 'saveMeetingPlenary':
        return createJsonResponse_(handleSaveMeetingPlenary_(session, payload));
      case 'savePublicContent':
        return createJsonResponse_(handleSavePublicContent_(session, payload));

      // Modul 10: Pengaturan Sistem, Drive Vault, IAM & Superadmin
      case 'listDriveFiles':
        return createJsonResponse_(handleListDriveFiles_(session, payload));
      case 'uploadDriveFile':
        return createJsonResponse_(handleUploadDriveFile_(session, payload));
      case 'getUsersList':
        return createJsonResponse_(handleGetUsersList_(session));
      case 'saveUser':
        return createJsonResponse_(handleSaveUser_(session, payload));
      case 'resetUserPassword':
        return createJsonResponse_(handleResetUserPassword_(session, payload));
      case 'addNewTenantWilayah':
      case 'registerNewWilayah':
        return createJsonResponse_(handleRegisterNewWilayah_(session, payload));
      case 'getAuditLogs':
        return createJsonResponse_(handleGetAuditLogs_(session, payload));
      case 'getSettings':
        return createJsonResponse_(handleGetSettings_(session));
      case 'getSettingsAudit':
        return createJsonResponse_(handleGetSettingsAudit_(session, payload));
      case 'saveSettings':
        return createJsonResponse_(handleSaveSettings_(session, payload));
      case 'getActiveSessions':
        return createJsonResponse_(handleGetActiveSessions_(session));
      case 'revokeSession':
        return createJsonResponse_(handleRevokeSession_(session, payload));
      case 'getDeadlockQueue':
        return createJsonResponse_(handleGetDeadlockQueue_(session, payload));
      case 'executeDeadlockBreaker':
        return createJsonResponse_(handleExecuteDeadlockBreaker_(session, payload));

      default:
        return createJsonResponse_({ ok: false, error: 'Aksi POST "' + action + '" tidak dikenali di sistem.' });
    }
  } catch (err) {
    Logger.log('doPost Error: ' + err.message);
    return createJsonResponse_({ ok: false, error: 'Terjadi kesalahan sistem: ' + err.message });
  }
}


