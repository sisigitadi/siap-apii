// Uji smoke LOGIKA GERBANG deploy (scripts/deploy-gas.mjs) — tanpa jaringan &
// tanpa menyentuh project Google.
//
// Cara kerja: berkas deploy asli dibaca, lalu dua hal diganti hanya pada salinan
// sementara di scripts/:
//   1) perintah `clasp`  → skrip tiruan (status/login/push/versi/deployment
//      dijawab lokal; tidak ada unggahan),
//   2) perintah detektor → memakai snapshot editor tiruan (--no-pull).
// Dengan begitu seluruh alur asli (termasuk urutan langkah & pesan) diuji utuh.
//
// Yang dikunci: versi baru TIDAK pernah dibuat selama editor masih menyimpan
// berkas lama (sumber bug definisi ganda / "Aksi tidak dikenali"), dan deploy
// tetap jalan normal saat editor bersih.
//
// Pakai: node scripts/smoke-deploy-gate.mjs   (atau: npm run smoke:deploy)
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

const ROOT = resolve('.');
const TMP = mkdtempSync(join(tmpdir(), 'apii-deploy-gate-'));
const STUB_DEPLOY = join(ROOT, 'scripts', '.tmp-deploy-gas-gate.mjs');
const buildDir = join(ROOT, 'apps-script');

if (!existsSync(join(buildDir, 'appsscript.json'))) {
  console.log('  FAIL  apps-script/ belum dibangun — jalankan `npm run build:gas` lebih dahulu.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Skrip tiruan pengganti clasp: hanya menjawab perintah yang biasa dipakai
// deploy-gas.mjs. `status` diteruskan ke clasp asli karena murni membaca lokal
// (tanpa kredensial & tanpa jaringan).
// ---------------------------------------------------------------------------
const cannedPath = join(TMP, 'canned-clasp.mjs');
writeFileSync(cannedPath, `
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
const has = (w) => args.includes(w);
const out = (o) => { process.stdout.write(JSON.stringify(o)); process.exit(0); };
if (has('status')) {
  const r = spawnSync('npx --yes @google/clasp@3 status --json', { shell: true, encoding: 'utf8' });
  process.stdout.write(r.stdout || '{}');
  process.exit(r.status ?? 1);
}
if (has('show-authorized-user')) out({ loggedIn: true, email: 'uji@contoh.test' });
if (has('push')) { console.log('Pushed 16 files.'); process.exit(0); }
if (has('create-version')) out({ versionNumber: 14 });
if (has('update-deployment')) out({ deploymentId: 'AKfycb-stub' });
console.error('perintah clasp tiruan tidak dikenal: ' + args.join(' '));
process.exit(1);
`);

// ---------------------------------------------------------------------------
// Snapshot editor tiruan: bersih (meniru hasil clasp pull setelah migrasi) dan
// kotor (masih menyimpan Backend.gs lama).
// ---------------------------------------------------------------------------
const editorClean = join(TMP, 'editor-clean');
const editorLegacy = join(TMP, 'editor-legacy');
mkdirSync(editorClean, { recursive: true });
mkdirSync(editorLegacy, { recursive: true });
for (const f of readdirSync(buildDir)) {
  if (f.endsWith('.gs')) {
    const asJs = `${f.slice(0, -3)}.js`;
    copyFileSync(join(buildDir, f), join(editorClean, asJs));
    copyFileSync(join(buildDir, f), join(editorLegacy, asJs));
  } else if (f === 'appsscript.json') {
    copyFileSync(join(buildDir, f), join(editorClean, f));
    copyFileSync(join(buildDir, f), join(editorLegacy, f));
  }
}
// Berkas lama: nama fungsi yang memang ada di modul baru → definisi ganda.
writeFileSync(join(editorLegacy, 'Backend.js'), 'function uuid() { return "usang"; }\nvar KONFIG = {};\n');

/** Salinan deploy-gas.mjs dengan clasp & detektor ditukar ke versi uji. */
const makeStubDeploy = (editorSnapshot) => {
  const src = readFileSync(join(ROOT, 'scripts', 'deploy-gas.mjs'), 'utf8');
  const patched = src
    .replace("const CLASP = 'npx --yes @google/clasp@3';", `const CLASP = 'node ${JSON.stringify(cannedPath).replace(/\\\\/g, '/')}';`)
    .replace("'node scripts/check-legacy-duplicates.mjs --json'",
      `'node scripts/check-legacy-duplicates.mjs --json --no-pull --from ${JSON.stringify(editorSnapshot).replace(/\\\\/g, '/')}'`);
  if (patched === src) throw new Error('gagal menyisipkan tiruan: pola perintah tidak ditemukan di deploy-gas.mjs');
  writeFileSync(STUB_DEPLOY, patched);
};

const runDeploy = (editorSnapshot, extra = []) => {
  makeStubDeploy(editorSnapshot);
  return spawnSync(process.execPath, [STUB_DEPLOY, '--skip-build', ...extra], { cwd: ROOT, encoding: 'utf8' });
};

try {
  console.log('\n== gerbang deploy: editor KOTOR (berkas lama masih ada) ==');
  let r = runDeploy(editorLegacy);
  const kotor = `${r.stdout}${r.stderr}`;
  check('deploy DIHENTIKAN (kode keluar 1)', r.status === 1, `(status=${r.status})`);
  check('disebutkan berkas lama yang harus dihapus', /masih berisi berkas lama/.test(kotor) && /Backend\.gs/.test(kotor));
  check('instruksi hapus di editor disertakan', /klik kanan Backend\.gs → Delete/.test(kotor));
  check('dijelaskan produksi belum berubah', /produksi \(\/exec\) belum berubah/.test(kotor));
  check('versi baru TIDAK dibuat', !/DEPLOY SELESAI/.test(kotor) && !/Versi 14 dibuat/.test(kotor));
  check('pesan lama "tidak ada perubahan yang dikirim" tidak dipakai setelah push',
    !/tidak ada perubahan yang dikirim/.test(kotor));
  check('push tetap dijalankan sebelum pemeriksaan', /Kode terunggah/.test(kotor));

  console.log('\n== gerbang deploy: editor BERSIH (migrasi sudah selesai) ==');
  r = runDeploy(editorClean);
  const bersih = `${r.stdout}${r.stderr}`;
  check('deploy selesai (kode keluar 0)', r.status === 0, `(status=${r.status})`);
  check('editor dilaporkan bersih', /Editor bersih: \d+ berkas, 0 berkas lama, 0 definisi ganda/.test(bersih));
  check('versi baru dibuat & deployment diperbarui', /DEPLOY SELESAI/.test(bersih) && /kini menyajikan versi 14/.test(bersih));
  check('langkah tetap berurutan (7 periksa → 8 versi → 9 deployment)',
    /\[7\] Periksa editor Apps Script/.test(bersih) && /\[8\] Buat versi baru/.test(bersih) && /\[9\] Perbarui deployment/.test(bersih));
} finally {
  rmSync(STUB_DEPLOY, { force: true });
  rmSync(TMP, { recursive: true, force: true });
}

console.log(`\nHasil: ${pass} lulus, ${fail} gagal.`);
if (fail > 0) process.exit(1);
