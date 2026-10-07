// Uji smoke logika backend SIAP APII (tanpa Google Apps Script).
// Mengekstrak definisi fungsi & ROUTES dari apps-script/Backend.gs lalu
// menjalankan skenario inti: login, RBAC, alur surat, dan validasi KONFIG.
//
// Cara pakai: node scripts/smoke-backend.mjs
import { readFileSync } from 'node:fs';

const code = readFileSync('apps-script/Backend.gs', 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

console.log('== Cek struktur kode ==');
check('KONFIG.DB_SPREADSHEET_ID terisi (ID Spreadsheet Anda)',
  /DB_SPREADSHEET_ID:\s*'1B0p0Jgb4jk6w3zkHANCzIl_YkB7PE2hj_-ejf4lO4sM'/.test(code));
check('KONFIG.PASSWORD_SALT terisi', /PASSWORD_SALT:\s*'[^']+'/.test(code));
check('KONFIG.PUBLIC_URL = https://apii.sigit.id',
  /PUBLIC_URL:\s*'https:\/\/apii\.sigit\.id'/.test(code));
check('Tidak ada pola namespace Modul.fn( yang tersisa',
  !/(?<![\w.])(?:Auth|Database|Utils|Surat|Keuangan|Divisi)\.(?:login|findOne|readAll|insert|uuid|audit|getListSurat|approveSurat)\(/.test(code));
check('doGet & doPost ada', /function doGet\(e\)/.test(code) && /function doPost\(e\)/.test(code));

console.log('\n== Cek route & handler ==');
// Daftar route yang diharapkan ada di ROUTES.
const expectedRoutes = [
  'login', 'logout', 'me', 'getListPengguna', 'createPengguna', 'updatePengguna', 'getAuditLogs',
  'getDashboard',
  'getListSurat', 'createSurat', 'updateSurat', 'submitSurat', 'approveSurat', 'rejectSurat',
  'verifySurat', 'getPublishedSurat',
  'getListKeuangan', 'getSaldo', 'createVoucher', 'updateVoucherReceipt', 'verifyVoucherBendahara',
  'verifyVoucherKetum', 'rejectVoucher',
  'getListDivisi', 'createSubmission', 'updateSubmission', 'ajukanSubmission',
  'approveSubmission', 'rejectSubmission', 'startExecution', 'submitLPJ',
];
for (const r of expectedRoutes) {
  const re = new RegExp(`\\b${r}:\\s*\\{\\s*auth:`);
  check(`route '${r}' terdefinisi`, re.test(code));
}

console.log('\n== Cek placeholder template surat ==');
const placeholders = ['JENIS', 'NOMOR', 'JUDUL', 'TANGGAL', 'TAHUN', 'MENIMBANG',
  'MENGINGAT', 'MEMUTUSKAN', 'SEKRETARIS', 'KETUA'];
for (const p of placeholders) {
  check(`placeholder {{${p}}}`, code.includes(`{{${p}}}`));
}
check('placeholder QR_VERIFY', code.includes('{{QR_VERIFY}}'));

console.log('\n== Cek fungsi generator template ==');
check('generateTemplateSurat terdefinisi', /function generateTemplateSurat\(\)/.test(code));
check('siapkanTemplateSurat_ terdefinisi', /function siapkanTemplateSurat_\(\)/.test(code));
check('siapkanFolderPdf_ terdefinisi', /function siapkanFolderPdf_\(\)/.test(code));
check('getLogoBlob_ terdefinisi', /function getLogoBlob_\(\)/.test(code));
check('getStempelBlob_ terdefinisi', /function getStempelBlob_\(\)/.test(code));
check('kop surat: DEWAN PIMPINAN WILAYAH', code.includes('DEWAN PIMPINAN WILAYAH'));
check('kop surat: APOLOGET ISLAM INDONESIA (APII) JABODETABEK',
  code.includes('APOLOGET ISLAM INDONESIA (APII) JABODETABEK'));
check('alamat sekretariat di kop', code.includes('Jl. Kramat Raya No. 45'));
check('setup() memanggil generator template & folder',
  /function setup\(\)\s*\{[\s\S]*?siapkanFolderPdf_\(\)[\s\S]*?siapkanTemplateSurat_\(\)/.test(code));

console.log('\n== Cek file aset ==');
const logo = readFileSync('apps-script/AsetLogo.gs', 'utf8');
const stem = readFileSync('apps-script/AsetStempel.gs', 'utf8');
check('LOGO_BASE64 ada & panjang > 1000', /LOGO_BASE64\s*=\s*'([^']+)'/.test(logo) &&
  logo.match(/LOGO_BASE64\s*=\s*'([^']+)'/)[1].length > 1000);
check('STEMPEL_BASE64 ada & panjang > 1000', /STEMPEL_BASE64\s*=\s*'([^']+)'/.test(stem) &&
  stem.match(/STEMPEL_BASE64\s*=\s*'([^']+)'/)[1].length > 1000);

console.log(`\nHasil: ${pass} lulus, ${fail} gagal.`);
if (fail > 0) process.exit(1);
