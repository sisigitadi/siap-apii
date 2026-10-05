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
if (failed) {
  console.log(`\n${failed} file gagal validasi syntax.`);
  process.exit(1);
}
console.log('\nSemua file lulus validasi syntax JavaScript.');
