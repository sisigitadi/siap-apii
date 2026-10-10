// Memvalidasi syntax JavaScript dari setiap file output apps-script/*.gs.
// Setiap modul divalidasi sendiri-sendiri: di Apps Script tiap file .gs harus
// lulus parse mandiri sebelum project bisa disimpan.
// Cara pakai: node scripts/validate-apps-script.mjs
import { existsSync, readFileSync, statSync } from 'node:fs';
import { GENERATED_FILES, listBackendModules } from './backend-modules.mjs';

const generated = GENERATED_FILES.map((n) => `apps-script/${n}`);
const files = [
  ...listBackendModules().map((n) => `apps-script/${n}`),
  'apps-script/AsetLogo.gs',
  'apps-script/AsetStempel.gs',
  ...generated,
];

let failed = 0;
// Berkas bangkitan (Versi.gs) wajib ada: tanpa itu endpoint `ping` kehilangan
// sumber angka versinya. Dibuat oleh build, jadi ketiadaannya berarti bundel
// belum dibangun ulang setelah perubahan. Tidak dihitung dua kali di bawah
// (daftar pemeriksaan menyaring berkas yang benar-benar ada).
for (const f of generated) {
  if (existsSync(f)) continue;
  failed++;
  console.log(`FAIL ${f} tidak ada — jalankan \`npm run build:gas\` (berkas versi dihasilkan otomatis).`);
}
const present = files.filter(existsSync);
for (const f of present) {
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
for (const f of present) {
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

// Laporan versi endpoint `ping` harus berasal dari satu sumber otomatis:
// package.json (versi aplikasi) + cap deploy (nomor Versi Apps Script).
// Angka yang ditulis manual di kode = sumber drift lama (`ping` melaporkan
// "2.0.0" selagi rilisnya sudah belasan), dan itu yang gerbang ini cegah.
const pkgVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
const versiPath = 'apps-script/Versi.gs';
if (existsSync(versiPath)) {
  const versiSrc = readFileSync(versiPath, 'utf8');
  const vMatch = versiSrc.match(/version:\s*'([^']+)'/);
  const rMatch = versiSrc.match(/release:\s*(\d+|null)/);
  if (!vMatch || vMatch[1] !== pkgVersion) {
    failed++;
    console.log(`FAIL ${versiPath}: version ${vMatch ? `'${vMatch[1]}'` : '(tidak ditemukan)'} ≠ package.json ${pkgVersion} — jalankan \`npm run build:gas\`.`);
  } else if (!rMatch) {
    failed++;
    console.log(`FAIL ${versiPath}: release tidak sah (harus bilangan bulat atau null).`);
  } else {
    console.log(`OK   ${versiPath} (version ${vMatch[1]} = package.json, release ${rMatch[1]})`);
  }
}
const codePath = 'apps-script/Code.gs';
if (existsSync(codePath)) {
  const codeSrc = readFileSync(codePath, 'utf8');
  if (/version:\s*'\d/.test(codeSrc)) {
    failed++;
    console.log(`FAIL ${codePath}: masih ada versi literal di laporan ping — pakai APP_BUILD_INFO dari Versi.gs.`);
  } else if (!/APP_BUILD_INFO/.test(codeSrc)) {
    failed++;
    console.log(`FAIL ${codePath}: laporan ping tidak membaca APP_BUILD_INFO (sumber versi otomatis).`);
  }
}

if (failed) {
  console.log(`\n${failed} masalah ditemukan (syntax / duplikat global / manifest).`);
  process.exit(1);
}
console.log(`\nSemua file lulus validasi syntax JavaScript (${Object.keys(globals).length} simbol global unik).`);
