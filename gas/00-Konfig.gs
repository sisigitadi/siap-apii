/**
 * ============================================================================
 * 00-Konfig.gs — Konfigurasi Instalasi (EDIT DI SINI SAJA)
 * ============================================================================
 * Seluruh pengaturan penting ada di file ini. Karena ID Spreadsheet sudah
 * ditanam, Anda TIDAK perlu mengisi Script Properties secara manual.
 * ==========================================================================*/

var KONFIG = {
  // ID Google Sheets database. Diambil dari URL Sheets Anda:
  // https://docs.google.com/spreadsheets/d/<INI_ID>/edit
  DB_SPREADSHEET_ID: '1B0p0Jgb4jk6w3zkHANCzIl_YkB7PE2hj_-ejf4lO4sM',

  // Salt untuk hash password. JANGAN diubah setelah ada pengguna —
  // mengubahnya membuat semua password lama tidak dikenali lagi.
  PASSWORD_SALT: 'apii-jabo-dpw-jabodetabek-2026',

  // Domain portal publik. Dipakai membuat URL verifikasi surat (QR/footer).
  PUBLIC_URL: 'https://apii.sigit.id',

  // Nama folder Google Drive untuk menyimpan PDF surat (dibuat otomatis).
  DRIVE_FOLDER_NAME: 'APII Jabo - PDF Surat Resmi',

  // Nama dokumen template Google Docs (dibuat otomatis beserta kop & stempel).
  TEMPLATE_DOC_NAME: 'Template Surat Resmi APII DPW Jabodetabek'
};
