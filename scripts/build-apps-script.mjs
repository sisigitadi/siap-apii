// ============================================================================
// build-apps-script.mjs (Cross-Platform Node.js Builder)
// ============================================================================
// Menggantikan scripts/build-apps-script.ps1 agar build bisa dijalankan di
// semua platform (Windows, macOS, Linux) tanpa ketergantungan PowerShell.
//
// Tanggung jawab:
//   1. Validasi routes whitelist (validate-routes-whitelist.mjs)
//   2. Transformasi namespace: gas/*.gs -> apps-script/*.gs (menghilangkan namespace)
//   3. Salin manifest appsscript.json
//   4. Menjalankan stamp-build-info.mjs untuk Versi.gs
//   5. Membersihkan file basi di apps-script/
//   6. Menampilkan ringkasan ukuran berkas
//
// Pakai: node scripts/build-apps-script.mjs
// ============================================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const SRC_DIR = 'gas';
const OUT_DIR = 'apps-script';

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// 0) Pra-pemeriksaan routes whitelist
// ---------------------------------------------------------------------------
try {
  execFileSync('node', ['scripts/validate-routes-whitelist.mjs'], { stdio: 'inherit' });
} catch (err) {
  console.error('\x1b[31mPRA-PERIKSAAN ROUTES GAGAL: perbaiki daftar putih sebelum build.\x1b[0m');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1) Modul backend: urutan kompilasi modul
// ---------------------------------------------------------------------------
const ORDER = [
  { src: '00-Konfig',        out: 'Konfig.gs' },
  { src: 'Utils',            out: 'Utils.gs' },
  { src: 'Editorial',        out: 'Editorial.gs' },
  { src: 'Pengaturan',       out: 'Pengaturan.gs' },
  { src: 'Database',         out: 'Database.gs' },
  { src: 'Auth',             out: 'Auth.gs' },
  { src: 'Surat',            out: 'Surat.gs' },
  { src: 'Keuangan',         out: 'Keuangan.gs' },
  { src: 'Divisi',           out: 'Divisi.gs' },
  { src: 'TemplateSurat',    out: 'TemplateSurat.gs' },
  { src: '99-TemplateSurat', out: 'TemplateSuratDocs.gs' },
  { src: 'Visitor',          out: 'Visitor.gs' },
  { src: 'Code',             out: 'Code.gs' }
];

const FN_NAMES = [
  'hashPassword','login','loginDemo','logout','verifySession','me','getListPengguna',
  'createPengguna','updatePengguna','getAuditLogs',
  'registerAnggota','getListPendaftar','verifyPendaftarSekretaris','approvePendaftarKetum','rejectPendaftar',
  'exportPendaftar','saveUploadToDrive_',
  'initSchema','readAll','findOne','findMany','insert','updateRow','deleteRow',
  'nextSequence','seedDefaultAccounts_','seedDefaultSettings_',
  'uuid','audit','formatRupiah','formatTanggal','toRoman','sanitizeUser','getDashboard',
  'terbilang','getSettingValue_','setSettingValue_','getSettings','saveSettings','getPublicSettings','getPublicWilayahList','uploadKopImage','testDriveStorage',
  'defaultEditorialContent_','normalizeEditorialContent_','getEditorialContent_','editorialStr_','editorialUrl_','editorialBool_',
  'editorialChangedSections_','editorialHistoryRows_','editorialHistoryList_','recordEditorialRevision_',
  'editorialFmtStamp_',
  'trimEditorialHistory_','getEditorialRevision_','editorialActionOf_',
  'editorialExportFilename_','editorialCounts_','editorialExportFile_','parseEditorialImport_',
  'getEditorialHistory','getEditorialRevision','restoreEditorialRevision',
  'exportEditorialContent','importEditorialContent',
  'escHtml_',
  'createDriveFolder','moveDriveFolder','resetDriveStorage',
  'getListSurat','createSurat','updateSurat','submitSurat','approveSurat',
  'rejectSurat','verifySurat','getPublishedSurat','reserveLetterNumber','getLetterTypesMap_',
  'getSaldo','getListKeuangan','createVoucher','updateVoucherReceipt','verifyVoucherBendahara',
  'verifyVoucherKetum','rejectVoucher','buildVoucherNumber','getAccountLabels_','getAccounts','saveAccount','deleteAccount','getPublicAccounts','verifyKwitansiPublic',
  'getListDivisi','createSubmission','updateSubmission','ajukanSubmission',
  'approveSubmission','rejectSubmission','startExecution','submitLPJ','buildTrackingId',
  'siapkanFolderPdf_','siapkanTemplateSurat_','generateTemplateSurat',
  'getLogoBlob_','getStempelBlob_','urlVerifikasiSurat_','parSurat_',
  // Template surat (TemplateSurat.gs)
  'getLetterTemplates','saveLetterTemplate','deleteLetterTemplate','getDefaultTemplate_',
  'siapkanFolderTemplatePdf_','defaultTemplateFields_','validateTemplateFields_',
  'renderTemplatePdf_','validasiTemplateId_','kopSettingT_','tulisKopSuratT_',
  'tulisFooterSuratT_','tulisBlokT_','tulisBlokTtdT_','parSuratT_',
  // Pengunjung (Visitor.gs)
  'trackVisitor','getVisitors','detectDevice_','detectOS_','detectBrowser_',
  // Router & RBAC per-aksi (Code.gs)
  'getPermissionsMap','resetUserPermissions','setup','seedDemoUsers',
  'roleDefaultPermissions_','effectivePermissions_','hasPermission_'
];

const fnPattern = FN_NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const nsRegex = new RegExp(`(?<![\\w.])(?:Auth|Database|Utils|Surat|Keuangan|Divisi|Visitor|Editorial|Pengaturan)\\.(${fnPattern})(?![\\w])`, 'g');

const keepFiles = new Set(['appsscript.json', 'AsetLogo.gs', 'AsetStempel.gs', 'Versi.gs']);
const sizes = {};
let totalReplaced = 0;

for (const entry of ORDER) {
  const path = join(SRC_DIR, `${entry.src}.gs`);
  if (!existsSync(path)) throw new Error(`File tidak ditemukan: ${path}`);
  let content = readFileSync(path, 'utf8');

  // Hitung jumlah penggantian
  const matches = content.match(nsRegex);
  if (matches) totalReplaced += matches.length;

  content = content.replace(nsRegex, '$1');

  const banner = [
    '/' + '*'.repeat(76),
    ` * ${entry.out} - dibangkitkan otomatis; JANGAN diedit manual.`,
    ` * Sumber: ${SRC_DIR}/${entry.src}.gs (scripts/build-apps-script.mjs)`,
    ' ' + '*'.repeat(77) + '/',
    content.trimEnd(),
    '\n'
  ].join('\n');

  const outPath = join(OUT_DIR, entry.out);
  // Simpan dengan CRLF atau LF konsisten UTF8
  writeFileSync(outPath, banner, 'utf8');
  sizes[entry.out] = banner.length;
  keepFiles.add(entry.out);
}

// Verifikasi namespace tidak tersisa
const allBackend = ORDER.map((e) => readFileSync(join(OUT_DIR, e.out), 'utf8')).join('\n');
const unreplacedCalls = allBackend.match(/(?<![\w.])(?:Auth|Database|Utils|Surat|Keuangan|Divisi|Visitor|Editorial|Pengaturan)\.(?!gs\b)[a-zA-Z0-9_]+\s*\(/g) || [];
const unreplacedHandlers = allBackend.match(/handler:\s*(?:Auth|Database|Utils|Surat|Keuangan|Divisi|Visitor|Editorial|Pengaturan)\.[a-zA-Z0-9_]+/g) || [];
const allUnreplaced = [...unreplacedCalls, ...unreplacedHandlers];

if (allUnreplaced.length > 0) {
  const unique = [...new Set(allUnreplaced)].join(', ');
  throw new Error(`Ditemukan referensi namespace yang belum diganti di apps-script/*.gs: ${unique}`);
}

console.log(`Namespace terganti: ${totalReplaced} referensi (semua bersih, 0 namespace tertinggal)`);

// ---------------------------------------------------------------------------
// 1b) Bersihkan file lama / basi di apps-script/
// ---------------------------------------------------------------------------
for (const file of readdirSync(OUT_DIR)) {
  if (!keepFiles.has(file)) {
    console.warn(`Menghapus output basi: apps-script/${file}`);
    unlinkSync(join(OUT_DIR, file));
  }
}

// ---------------------------------------------------------------------------
// 2) Manifest appsscript.json
// ---------------------------------------------------------------------------
const manifestSrc = join(SRC_DIR, 'appsscript.json');
if (!existsSync(manifestSrc)) throw new Error(`Manifest tidak ditemukan: ${manifestSrc}`);
copyFileSync(manifestSrc, join(OUT_DIR, 'appsscript.json'));
console.log(`Manifest            : appsscript.json disalin ke ${OUT_DIR}`);

// ---------------------------------------------------------------------------
// 3) Info versi bundel (Versi.gs)
// ---------------------------------------------------------------------------
try {
  execFileSync('node', ['scripts/stamp-build-info.mjs'], { stdio: 'inherit' });
} catch (err) {
  console.error('\x1b[31mGAGAL mencetak apps-script/Versi.gs (info versi).\x1b[0m');
  process.exit(1);
}
console.log('Info versi          : Versi.gs (version dari package.json, release dicap saat deploy)');

// ---------------------------------------------------------------------------
// 4) Ringkasan ukuran
// ---------------------------------------------------------------------------
if (existsSync(join(OUT_DIR, 'AsetLogo.gs'))) sizes['AsetLogo.gs'] = readFileSync(join(OUT_DIR, 'AsetLogo.gs'), 'utf8').length;
if (existsSync(join(OUT_DIR, 'AsetStempel.gs'))) sizes['AsetStempel.gs'] = readFileSync(join(OUT_DIR, 'AsetStempel.gs'), 'utf8').length;
if (existsSync(join(OUT_DIR, 'Versi.gs'))) sizes['Versi.gs'] = readFileSync(join(OUT_DIR, 'Versi.gs'), 'utf8').length;

console.log('\nOutput apps-script/ (semua JANGAN diedit manual):');
let totalChars = 0;
for (const k of Object.keys(sizes).sort()) {
  const len = sizes[k];
  console.log(`  ${k.padEnd(20)} ${String(len).padStart(9)} karakter`);
  totalChars += len;
  if (len > 90000) console.warn(`PERINGATAN: ${k} mendekati batas ukuran file Apps Script!`);
}
console.log(`  ${'---------'.padEnd(20)} ${'---------'.padStart(9)} karakter`);
console.log(`  Total                ${String(totalChars).padStart(9)} karakter (+ manifest appsscript.json)`);
console.log(`Selesai -> ${OUT_DIR} (ambil semua file .gs + appsscript.json saat unggah)\n`);
