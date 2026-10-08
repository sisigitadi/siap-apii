// Memvalidasi syntax JavaScript dari file output apps-script/*.gs
// Cara pakai: node scripts/validate-apps-script.mjs
import { readFileSync, statSync } from 'node:fs';

const files = [
  'apps-script/Backend.gs',
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

if (failed) {
  console.log(`\n${failed} file gagal validasi syntax.`);
  process.exit(1);
}
console.log('\nSemua file lulus validasi syntax JavaScript.');
