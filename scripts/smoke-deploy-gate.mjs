// Uji smoke LOGIKA GERBANG deploy (scripts/deploy-gas.mjs) — tanpa jaringan &
// tanpa menyentuh project Google.
//
// Cara kerja: berkas deploy asli dibaca, lalu tiga hal diganti hanya pada
// salinan sementara di scripts/:
//   1) perintah `clasp`     → skrip tiruan (status/login/push/versi/deployment
//      dijawab lokal; tidak ada unggahan),
//   2) perintah detektor    → memakai snapshot editor tiruan (--no-pull),
//   3) perintah pembersih   → skrip tiruan yang menghapus berkas lama dari
//      snapshot itu (meniru projects.updateContent tanpa jaringan).
// Dengan begitu seluruh alur asli (termasuk urutan langkah & pesan) diuji utuh.
//
// Yang dikunci:
//   - berkas lama dibersihkan OTOMATIS lalu deploy lanjut tanpa klik manual;
//   - `--no-cleanup` mengembalikan perilaku lama (berhenti + minta hapus manual);
//   - bila ada simbol berkas lama yang belum pindah ke modul baru, deploy
//     berhenti TANPA memanggil pembersih (tidak ada penghapusan data).
//
// Pakai: node scripts/smoke-deploy-gate.mjs   (atau: npm run smoke:deploy)
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

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
if (has('versions')) out([{ versionNumber: 13 }, { versionNumber: 12 }]);
if (has('create-version')) out({ versionNumber: 14 });
if (has('update-deployment')) out({ deploymentId: 'AKfycb-stub' });
console.error('perintah clasp tiruan tidak dikenal: ' + args.join(' '));
process.exit(1);
`);

// ---------------------------------------------------------------------------
// Skrip tiruan pengganti pembersih (meniru projects.updateContent): menghapus
// berkas yang tidak ada di daftar keluaran build dari snapshot editor, mencatat
// bahwa ia benar-benar dipanggil, lalu melaporkan "removed & verified".
// ---------------------------------------------------------------------------
const cannedCleanup = join(TMP, 'canned-cleanup.mjs');
writeFileSync(cannedCleanup, `
import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const EXPECTED = new Set(['Konfig', 'Utils', 'Editorial', 'Pengaturan', 'Database', 'Auth', 'Surat', 'Keuangan',
  'Divisi', 'TemplateSurat', 'TemplateSuratDocs', 'Visitor', 'Code', 'AsetLogo', 'AsetStempel', 'Versi', 'appsscript']);
const [editorDir, marker] = process.argv.slice(2);
writeFileSync(marker, 'dipanggil');
const removed = [];
for (const f of readdirSync(editorDir)) {
  if (f === '.clasp.json') continue;
  const key = f.endsWith('.js') ? f.slice(0, -3) : 'appsscript';
  if (!EXPECTED.has(key)) { rmSync(join(editorDir, f)); removed.push({ name: key }); }
}
console.log(JSON.stringify({ status: removed.length ? 'removed' : 'clean', verified: true, files: readdirSync(editorDir).length, removed, refused: [] }));
`);

// ---------------------------------------------------------------------------
// Snapshot editor tiruan
// ---------------------------------------------------------------------------
const makeEditorDir = (name, extra) => {
  const dir = join(TMP, name);
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(buildDir)) {
    if (f.endsWith('.gs')) copyFileSync(join(buildDir, f), join(dir, `${f.slice(0, -3)}.js`));
    else if (f === 'appsscript.json') copyFileSync(join(buildDir, f), join(dir, f));
  }
  if (extra) writeFileSync(join(dir, 'Backend.js'), extra);
  return dir;
};
// Seluruh simbolnya sudah ada di modul baru → aman dibersihkan otomatis.
const editorLegacy = makeEditorDir('editor-legacy', 'function uuid() { return "usang"; }\nvar KONFIG = {};\n');
// Varian untuk --no-cleanup (fixture terpisah agar tidak terhapus skenario lain).
const editorLegacyManual = makeEditorDir('editor-legacy-manual', 'function uuid() { return "usang"; }\nvar KONFIG = {};\n');
// Memuat simbol yang BELUM ada di modul baru → tidak boleh dihapus siapa pun.
const editorUncovered = makeEditorDir('editor-uncovered', 'function uuid() { return "usang"; }\nfunction fiturBelumPindah() {}\n');
const editorClean = makeEditorDir('editor-clean');

const markerFor = (dir) => join(TMP, `marker-${basename(dir)}.txt`);

/** Salinan deploy-gas.mjs dengan clasp, detektor, dan pembersih ditukar ke tiruan. */
const makeStubDeploy = (editorSnapshot) => {
  const src = readFileSync(join(ROOT, 'scripts', 'deploy-gas.mjs'), 'utf8');
  let patched = src
    .replace("const CLASP = 'npx --yes @google/clasp@3';", `const CLASP = 'node ${JSON.stringify(cannedPath).replace(/\\/g, '/')}';`)
    .replace("'node scripts/check-legacy-duplicates.mjs --json'",
      `'node scripts/check-legacy-duplicates.mjs --json --no-pull --from ${JSON.stringify(editorSnapshot).replace(/\\/g, '/')}'`);
  if (patched === src) throw new Error('gagal menyisipkan tiruan: pola perintah clasp/detektor tidak ditemukan di deploy-gas.mjs');
  // Pencap info versi ditulis ke berkas sementara agar uji tidak menyentuh
  // apps-script/Versi.gs milik repository.
  const stampOut = join(TMP, 'Versi-uji.gs');
  const withStamp = patched.replace('node scripts/stamp-build-info.mjs --release ${releaseStamped}',
    `node scripts/stamp-build-info.mjs --release \${releaseStamped} --out ${JSON.stringify(stampOut).replace(/\\/g, '/')}`);
  if (!withStamp.includes('--out')) throw new Error('gagal menyisipkan tiruan: perintah pencap versi tidak ditemukan di deploy-gas.mjs');
  patched = withStamp;
  const withCleanup = patched.replace("'node scripts/remove-legacy-files.mjs --yes --json'",
    `'node ${JSON.stringify(cannedCleanup).replace(/\\/g, '/')} ${JSON.stringify(editorSnapshot).replace(/\\/g, '/')} ${JSON.stringify(markerFor(editorSnapshot)).replace(/\\/g, '/')}'`);
  if (!withCleanup.includes('canned-cleanup')) throw new Error('gagal menyisipkan pembersih tiruan: perintah pembersih tidak ditemukan di deploy-gas.mjs');
  patched = withCleanup;
  writeFileSync(STUB_DEPLOY, patched);
};

const runDeploy = (editorSnapshot, extra = []) => {
  makeStubDeploy(editorSnapshot);
  return spawnSync(process.execPath, [STUB_DEPLOY, '--skip-build', ...extra], { cwd: ROOT, encoding: 'utf8' });
};

try {
  console.log('\n== gerbang deploy: editor KOTOR → dibersihkan OTOMATIS ==');
  let r = runDeploy(editorLegacy);
  const kotor = `${r.stdout}${r.stderr}`;
  check('deploy TIDAK berhenti (kode keluar 0)', r.status === 0, `(status=${r.status})`);
  check('pembersih dipanggil', existsSync(markerFor(editorLegacy)));
  check('disebutkan pembersihan lewat Apps Script API', /lewat Apps Script API/.test(kotor));
  check('berkas lama dilaporkan terhapus & terverifikasi', /dihapus & terverifikasi: Backend/.test(kotor));
  check('editor dinyatakan bersih sebelum versi baru dibuat', /Editor sekarang bersih/.test(kotor));
  check('Backend.js benar-benar hilang dari project', !existsSync(join(editorLegacy, 'Backend.js')));
  check('versi baru tetap dibuat & deployment diperbarui',
    /Versi 14 dibuat/.test(kotor) && /DEPLOY SELESAI/.test(kotor) && /kini menyajikan versi 14/.test(kotor));
  check('urutan langkah tetap 7 periksa → 8 versi → 9 deployment',
    /\[7\] Periksa editor Apps Script/.test(kotor) && /\[8\] Buat versi baru/.test(kotor) && /\[9\] Perbarui deployment/.test(kotor));
  check('nomor rilis dicap SEBELUM push (langkah 5b) dan dilaporkan',
    /\[5b\] Cap nomor rilis Apps Script/.test(kotor) && /release 14 dicap ke apps-script\/Versi\.gs \(versi terakhir di Apps Script: 13\)/.test(kotor));
  check('laporan versi dicocokkan dengan nomor versi yang benar-benar dibuat',
    /Laporan ping cocok dengan rilis ini \(release 14\)/.test(kotor));
  check('langkah 5b berada sebelum unggahan',
    kotor.indexOf('Cap nomor rilis Apps Script') < kotor.indexOf('Unggah kode (clasp push)'));

  console.log('\n== gerbang deploy: --no-cleanup (perilaku lama) ==');
  r = runDeploy(editorLegacyManual, ['--no-cleanup']);
  const manual = `${r.stdout}${r.stderr}`;
  check('deploy dihentikan (kode keluar 1)', r.status === 1, `(status=${r.status})`);
  check('pembersih TIDAK dipanggil', !existsSync(markerFor(editorLegacyManual)));
  check('instruksi hapus manual + saran tanpa --no-cleanup diberikan',
    /klik kanan Backend\.gs/.test(manual) && /--no-cleanup/.test(manual));
  check('dijelaskan produksi belum berubah', /produksi \(\/exec\) belum berubah/.test(manual));
  check('versi baru TIDAK dibuat', !/DEPLOY SELESAI/.test(manual));

  console.log('\n== gerbang deploy: simbol belum pindah → berhenti TANPA menghapus ==');
  r = runDeploy(editorUncovered);
  const uncoveredOut = `${r.stdout}${r.stderr}`;
  check('deploy dihentikan (kode keluar 1)', r.status === 1, `(status=${r.status})`);
  check('pembersih TIDAK dipanggil (tidak ada penghapusan)',
    !existsSync(markerFor(editorUncovered)) && existsSync(join(editorUncovered, 'Backend.js')));
  check('alasan dijelaskan: simbol belum ada di modul baru', /BELUM ada di modul baru/.test(uncoveredOut));
  check('instruksi memindahkan simbol lebih dahulu', /Pindahkan simbol tersebut/.test(uncoveredOut));

  console.log('\n== gerbang deploy: editor BERSIH (tidak ada yang perlu dibersihkan) ==');
  r = runDeploy(editorClean);
  const bersih = `${r.stdout}${r.stderr}`;
  check('deploy selesai (kode keluar 0)', r.status === 0, `(status=${r.status})`);
  check('editor dilaporkan bersih', /Editor bersih: \d+ berkas, 0 berkas lama, 0 definisi ganda/.test(bersih));
  check('pembersih tidak dipanggil saat tidak perlu', !existsSync(markerFor(editorClean)));
  check('versi baru dibuat & deployment diperbarui',
    /DEPLOY SELESAI/.test(bersih) && /kini menyajikan versi 14/.test(bersih));

  console.log('\n== gerbang deploy: --no-release-stamp (laporan release: null) ==');
  r = runDeploy(editorClean, ['--no-release-stamp']);
  const noStamp = `${r.stdout}${r.stderr}`;
  check('deploy tetap selesai (kode keluar 0)', r.status === 0, `(status=${r.status})`);
  check('dijelaskan ping akan melaporkan release: null', /--no-release-stamp/.test(noStamp) && /release: null/.test(noStamp));
  check('tidak ada pencap nomor rilis yang diklaim', !/release 14 dicap ke apps-script/.test(noStamp));
} finally {
  rmSync(STUB_DEPLOY, { force: true });
  rmSync(TMP, { recursive: true, force: true });
}

console.log(`\nHasil: ${pass} lulus, ${fail} gagal.`);
if (fail > 0) process.exit(1);
