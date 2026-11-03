// ============================================================================
// build-apps-script.mjs (Cross-Platform Node.js Builder)
// ============================================================================
// Menggabungkan seluruh berkas gas/*.gs menjadi apps-script/Backend.gs
// dengan transformasi namespace otomatis (Modul.fn -> fn) yang bekerja di
// semua sistem operasi (Windows, Linux, macOS).
//
// Pakai: node scripts/build-apps-script.mjs
// ============================================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
// 1) Kompilasi Backend.gs
// ---------------------------------------------------------------------------
const ORDER = ['00-Konfig', 'Utils', 'Database', 'Auth', 'Surat', 'Keuangan', 'Divisi', 'Code', '99-TemplateSurat'];

const FN_NAMES = [
  'hashPassword','login','loginWithGoogle','logout','verifySession','me','getListPengguna',
  'createPengguna','updatePengguna','getAuditLogs',
  'registerAnggota','getListPendaftar','verifyPendaftarSekretaris','approvePendaftarKetum','rejectPendaftar',
  'exportPendaftar','getKtaNasionalList','verifyKtaPublic','generateLegacyClaimToken','claimLegacyKta','saveUploadToDrive_',
  'initSchema','readAll','findOne','findMany','insert','updateRow','deleteRow',
  'nextSequence','getPartitionedSequenceKey','seedDefaultAccounts_','seedDefaultSettings_',
  'uuid','audit','formatRupiah','formatTanggal','toRoman','sanitizeUser','getDashboard',
  'terbilang','getSettingValue_','setSettingValue_','getSettings','saveSettings','getPublicSettings','getPublicWilayahList','uploadKopImage','testDriveStorage',
  'getEditorialContent','saveEditorialContent',
  'createDriveFolder','moveDriveFolder','resetDriveStorage','initHierarchyFolders','getDriveStorageStatus','getListVaultFiles','softDeleteVaultFile','restoreVaultFile','purgeTrashVault','resolveStorageFolder_',
  'getListSurat','createSurat','updateSurat','submitSurat','approveSurat',
  'rejectSurat','verifySurat','getPublishedSurat','reserveLetterNumber','getLetterTypesMap_',
  'getSaldo','getListKeuangan','createVoucher','updateVoucherReceipt','verifyVoucherBendahara',
  'verifyVoucherKetum','rejectVoucher','resubmitVoucher','voidVoucher','getVoucherDetail','getKasSimulatorData','saveKasSimulation','convertSimulationToKas','buildVoucherNumber','getBranchShortCode_','getAccountLabels_','getAccounts','saveAccount','deleteAccount','getPublicAccounts','verifyKwitansiPublic',
  'getListDivisi','createSubmission','updateSubmission','ajukanSubmission',
  'approveSubmission','rejectSubmission','startExecution','submitLPJ','buildTrackingId',
  'getFormasiPengurus','savePejabatFormasi','createPltDelegasi','getListPltDelegasi','revokePltDelegasi','generateSkPengurus',
  'siapkanFolderPdf_','siapkanTemplateSurat_','generateTemplateSurat',
  'getLogoBlob_','getStempelBlob_','urlVerifikasiSurat_','parSurat_'
];

const fnPattern = FN_NAMES.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const nsRegex = new RegExp(`(?<![\\w.])(?:Auth|Database|Utils|Surat|Keuangan|Divisi)\\.(${fnPattern})(?![\\w])`, 'g');

const chunks = [];
let totalReplaced = 0;

for (const name of ORDER) {
  const path = join(SRC_DIR, `${name}.gs`);
  if (!existsSync(path)) {
    throw new Error(`File tidak ditemukan: ${path}`);
  }
  let content = readFileSync(path, 'utf8');
  const matches = content.match(nsRegex);
  if (matches) {
    totalReplaced += matches.length;
  }
  content = content.replace(nsRegex, '$1');

  chunks.push(
    '/' + '*'.repeat(76) + '\n' +
    ` * ${name}.gs\n` +
    ' ' + '*'.repeat(77) + '/\n' +
    content.trimEnd() + '\n\n'
  );
}

const backend = chunks.join('');

// Verifikasi tidak ada namespace tertinggal (kecuali referensi file *.gs)
const danglingRegex = /(?<![\w.])(?:Auth|Database|Utils|Surat|Keuangan|Divisi)\.(?!gs\b)[a-zA-Z0-9_]+/g;
const unreplaced = backend.match(danglingRegex);
if (unreplaced && unreplaced.length > 0) {
  const bad = Array.from(new Set(unreplaced)).join(', ');
  throw new Error(`Ditemukan referensi namespace yang belum diganti di Backend.gs: ${bad}`);
}

const outBackend = join(OUT_DIR, 'Backend.gs');
writeFileSync(outBackend, backend, 'utf8');

console.log(`Namespace terganti: ${totalReplaced} referensi (semua bersih, 0 namespace tertinggal)`);
console.log(`Backend.gs        : ${backend.length} karakter`);
console.log(`Selesai -> ${outBackend}`);
