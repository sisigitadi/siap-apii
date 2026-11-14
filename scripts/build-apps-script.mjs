/**
 * SIAP APII v3.0.0 Enterprise - build-apps-script.mjs
 * Validasi Sintaks Otomatis & Bundler Multi-Modul Apps Script ke build/dist_Code.gs
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const srcDir = path.resolve('apps-script');
const buildDir = path.resolve('build');
const distFile = path.join(buildDir, 'dist_Code.gs');

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Urutan penggabungan modul yang aman (Database & Auth terlebih dahulu)
const order = [
  'Database.gs',
  'Auth.gs',
  'HijriEngine.gs',
  'TemplateSuratDocs.gs',
  'Surat.gs',
  'SuratMasuk.gs',
  'Disposisi.gs',
  'ShariaGuard.gs',
  'KwitansiEngine.gs',
  'Keuangan.gs',
  'Divisi.gs',
  'Keanggotaan.gs',
  'InovasiDakwah.gs',
  'NotificationDispatcher.gs',
  'DriveVault.gs',
  'Setup.gs',
  'Code.gs'
];

console.log('=== MEMULAI VALIDASI & BUILD BACKEND GOOGLE APPS SCRIPT ===\n');

let combinedCode = `/**
 * SIAP APII v3.0.0 Enterprise - dist_Code.gs (Bundled Distribution)
 * Single-File Distribution untuk Google Apps Script Web App
 * 
 * Tanggal Kompilasi: ${new Date().toISOString()}
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

`;

let hasError = false;
let totalLines = 0;

for (const filename of order) {
  const filePath = path.join(srcDir, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`[SKIP] Berkas tidak ditemukan: ${filename}`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').length;
  totalLines += lines;

  // Uji Sintaks via Node.js vm
  try {
    // Wrap di function untuk memvalidasi syntax tanpa mengeksekusi
    new vm.Script(`function __syntaxTest_${filename.replace(/\W/g, '_')}() {\n${content}\n}`);
    console.log(`[PASS] ${filename.padEnd(26)} : ${lines} baris (${content.length} bytes)`);
  } catch (err) {
    console.error(`[FAIL] ${filename} - Sintaks Error:`, err.message);
    hasError = true;
  }

  combinedCode += `\n// ============================================================================\n`;
  combinedCode += `// BERKAS: ${filename}\n`;
  combinedCode += `// ============================================================================\n\n`;
  combinedCode += content + `\n`;
}

if (hasError) {
  console.error('\n[GAGAL] Terdapat kesalahan sintaks pada berkas modul Apps Script. Build dibatalkan.');
  process.exit(1);
}

fs.writeFileSync(distFile, combinedCode, 'utf8');
console.log(`\n[SUKSES] Seluruh modul berhasil divalidasi dan digabungkan!`);
console.log(`Berkas Output : ${distFile}`);
console.log(`Total Baris   : ${totalLines} baris`);
console.log(`Ukuran Berkas : ${(combinedCode.length / 1024).toFixed(2)} KB\n`);

