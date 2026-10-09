// Memvalidasi syntax JavaScript dari setiap file output apps-script/*.gs.
// Setiap modul divalidasi sendiri-sendiri: di Apps Script tiap file .gs harus
// lulus parse mandiri sebelum project bisa disimpan.
// Cara pakai: node scripts/validate-apps-script.mjs
import { existsSync, readFileSync, statSync } from 'node:fs';
import { listBackendModules } from './backend-modules.mjs';

const files = [
  ...listBackendModules().map((n) => `apps-script/${n}`),
  'apps-script/AsetLogo.gs',
  'apps-script/AsetStempel.gs',
];

let failed = 0;
for (const f of files) {
  const code = readFileSync(f, 'utf8');
  try {
    // Bungkus dalam Function agar deklarasi `var`/`function` global valid tanpa menjalankannya.
    new Function(code);
    console.log(`OK   ${f} (${statSync(f).size} bytes)`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${f}: ${e.message}`);
  }
}
// Semua file .gs digabung menjadi SATU scope global oleh Apps Script, jadi
// dua modul tidak boleh mendefinisikan function/var global dengan nama sama
// (definisi ganda diam-diam memakai salinan usang — persis kegagalan yang
// pecah modul ini cegah). Ini juga mendeteksi file lama yang tertinggal.
const globals = {};
let dupCount = 0;
for (const f of files) {
  const re = /^(?:function\s+([A-Za-z0-9_$]+)\s*\(|var\s+([A-Za-z0-9_$]+)\s*=)/gm;
  let m;
  while ((m = re.exec(readFileSync(f, 'utf8')))) {
    const name = m[1] || m[2];
    (globals[name] = globals[name] || []).push(f);
  }
}
for (const [name, where] of Object.entries(globals)) {
  if (where.length < 2) continue;
  dupCount++;
  const uniq = [...new Set(where)];
  console.log(`FAIL ${name} didefinisikan ganda di: ${uniq.join(', ')}`);
}
if (dupCount) failed += dupCount;

// Manifest Apps Script wajib sah: `clasp push` menolak jalan bila manifest
// hilang, dan manifest yang rusak membuat project gagal disimpan.
const manifestPath = 'apps-script/appsscript.json';
try {
  const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || !parsed.webapp) {
    throw new Error('manifest tidak memuat konfigurasi webapp');
  }
  console.log(`OK   ${manifestPath} (manifest sah, runtime ${parsed.runtimeVersion || '?'})`);
} catch (e) {
  failed++;
  console.log(`FAIL ${manifestPath}: ${e.message}`);
}

// Pastikan tidak ada output basi dari build lama (Backend.gs tunggal) yang
// tertinggal dan bisa tertukar saat diunggah ke editor Apps Script.
if (existsSync('apps-script/Backend.gs')) {
  failed++;
  console.log('FAIL apps-script/Backend.gs masih ada — jalankan build ulang; output kini per-modul.');
}

if (failed) {
  console.log(`\n${failed} masalah ditemukan (syntax / duplikat global / manifest).`);
  process.exit(1);
}
console.log(`\nSemua file lulus validasi syntax JavaScript (${Object.keys(globals).length} simbol global unik).`);
