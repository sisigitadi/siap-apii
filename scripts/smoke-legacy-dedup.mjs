// Uji smoke lokal scripts/check-legacy-duplicates.mjs — seluruhnya tanpa jaringan.
// Memakai fixture di folder sementara: "build" tiruan (apps-script/*.gs) dan
// "editor" tiruan (hasil clasp pull: *.js) untuk mengunci tiap cabang keputusan:
//   1) pemindai simbol tidak tertipu komentar/string/regex/template/bersarang
//   2) editor bersih → kode keluar 0
//   3) berkas lama + definisi ganda → kode keluar 1 (deploy harus berhenti)
//   4) simbol yang belum pindah ke modul baru → kode keluar 1 + peringatan "JANGAN hapus"
//   5) definisi ganda antar modul baru sendiri → kode keluar 1
//   6) tidak dapat diverifikasi (snapshot/build tak ada) → kode keluar 2
//
// Pakai: node scripts/smoke-legacy-dedup.mjs   (atau: npm run smoke:legacy)
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { globalSymbols } from './check-legacy-duplicates.mjs';

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

const ROOT = resolve('.');
const SCRIPT = join(ROOT, 'scripts', 'check-legacy-duplicates.mjs');
const TMP = mkdtempSync(join(tmpdir(), 'apii-dedup-smoke-'));

const write = (rel, content) => {
  const p = join(TMP, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, content.endsWith('\n') ? content : `${content}\n`);
};

/** Jalankan detektor terhadap fixture; kembalikan { status, json, text }. */
const runDetector = (...args) => {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8' });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* bukan mode JSON */ }
  return { status: r.status, json, text: `${r.stdout}${r.stderr}` };
};

// ---------------------------------------------------------------------------
// 1) Pemindai simbol
// ---------------------------------------------------------------------------
console.log('\n== pemindai simbol (scripts/check-legacy-duplicates.mjs) ==');
const tricky = `
// function tidakNyata() { }
/* function jugaTidak() { } */
var KONFIG = { env: 'a//b', brace: '}' };
const RE = /function\\s+(palsu)/;
const TEKS = \`template \${1 + 1} { } \\\` \`;
let daftar = [1, 2].map(function (x) { return x; });
function asli(a) { function bersarang() { return a; } return bersarang(); }
var a = 1, b = 2;
const { x, y } = KONFIG;
class Kotak { isi() { return 1; } }
`;
const names = globalSymbols(tricky).map((s) => `${s.kind}:${s.name}`).sort();
check('komentar & string tidak menghasilkan simbol',
  !names.includes('function:tidakNyata') && !names.includes('function:jugaTidak'));
check('regex literal tidak menghasilkan simbol palsu', !names.some((n) => n.includes('palsu')));
check('fungsi bersarang tidak dicatat', !names.includes('function:bersarang'));
check('deklarasi asli tercatat lengkap',
  ['var:KONFIG', 'var:RE', 'var:TEKS', 'var:daftar', 'function:asli', 'var:a', 'var:b', 'class:Kotak']
    .every((n) => names.includes(n)),
  `(ditemukan: ${names.join(', ')})`);
check('destructuring tidak menimbulkan galat & tidak salah dicatat',
  !names.includes('var:x') && !names.includes('var:y'));
check('nomor baris simbol benar', globalSymbols('var satu = 1;\nvar dua = 2;\n').find((s) => s.name === 'dua').line === 2);

// ---------------------------------------------------------------------------
// 2) Fixture build & editor
// ---------------------------------------------------------------------------
const appsscript = JSON.stringify({ timeZone: 'Asia/Jakarta', runtimeVersion: 'V8', webapp: { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' } }, null, 2);
write('build/A.gs', 'function alpha() { return 1; }\nvar SETTINGS = { a: 1 };\n');
write('build/B.gs', 'function beta() { return 2; }\n');
write('build/appsscript.json', appsscript);

const copy = (src, dst) => write(dst, readFileSync(join(TMP, src), 'utf8'));
copy('build/appsscript.json', 'editor-clean/appsscript.json');
copy('build/A.gs', 'editor-clean/A.js');
copy('build/B.gs', 'editor-clean/B.js');

copy('build/appsscript.json', 'editor-legacy/appsscript.json');
copy('build/A.gs', 'editor-legacy/A.js');
copy('build/B.gs', 'editor-legacy/B.js');
write('editor-legacy/Backend.js', 'function alpha() { return 9; }\nfunction beta() { return 9; }\nvar SETTINGS = {};\nfunction hanyaDiLama() {}\n');

copy('build/appsscript.json', 'editor-uncovered/appsscript.json');
copy('build/A.gs', 'editor-uncovered/A.js');
write('editor-uncovered/Backend.js', 'function alpha() { return 9; }\nfunction fiturBelumPindah() {}\n');

// Semua simbol berkas lama sudah pindah → penghapusan terbukti aman.
copy('build/appsscript.json', 'editor-legacy-covered/appsscript.json');
copy('build/A.gs', 'editor-legacy-covered/A.js');
write('editor-legacy-covered/Backend.js', 'function alpha() { return 9; }\nvar SETTINGS = {};\n');

write('build-dupe/A.gs', 'function alpha() {}\n');
write('build-dupe/B.gs', 'function alpha() {}\n');
write('build-dupe/appsscript.json', appsscript);

// ---------------------------------------------------------------------------
// 3) Keputusan detektor
// ---------------------------------------------------------------------------
console.log('\n== keputusan (fixture, tanpa jaringan) ==');
let r = runDetector('--no-pull', '--from', join(TMP, 'editor-clean'), '--build', join(TMP, 'build'), '--json');
check('editor bersih → kode keluar 0',
  r.status === 0 && r.json && r.json.status === 'clean',
  `(status=${r.status}, json=${r.json && r.json.status})`);
check('editor bersih → tidak ada berkas lama',
  r.json && r.json.editor.legacy.length === 0);

r = runDetector('--no-pull', '--from', join(TMP, 'editor-legacy'), '--build', join(TMP, 'build'), '--json');
check('berkas lama + definisi ganda → kode keluar 1',
  r.status === 1 && r.json && r.json.status === 'blocked', `(status=${r.status})`);
check('3 definisi ganda terdeteksi (alpha, beta, SETTINGS)',
  r.json && r.json.editor.legacy[0] && r.json.editor.legacy[0].collisionCount === 3,
  `(ditemukan: ${r.json && r.json.editor.legacy[0] && r.json.editor.legacy[0].collisionCount})`);
check('simbol yang belum pindah dilaporkan (hanyaDiLama)',
  r.json && r.json.editor.legacy[0].uncovered.some((u) => u.startsWith('hanyaDiLama')),
  `(uncovered: ${JSON.stringify(r.json && r.json.editor.legacy[0].uncovered)})`);
check('berkas lama terdeteksi sebagai Backend.gs (nama editor, bukan .js)',
  r.json && r.json.editor.legacy[0].file === 'Backend.gs');

r = runDetector('--no-pull', '--from', join(TMP, 'editor-uncovered'), '--build', join(TMP, 'build'));
check('simbol belum pindah → kode keluar 1', r.status === 1, `(status=${r.status})`);
check('peringatan "JANGAN hapus" muncul bila ada simbol belum pindah',
  /JANGAN hapus/.test(r.text) && /fiturBelumPindah/.test(r.text));

r = runDetector('--no-pull', '--from', join(TMP, 'editor-legacy-covered'), '--build', join(TMP, 'build'));
check('berkas lama yang seluruh simbolnya sudah pindah tetap menghentikan deploy',
  r.status === 1, `(status=${r.status})`);
check('penghapusan dinyatakan terbukti aman (tanpa "JANGAN hapus")',
  /penghapusan terbukti tidak menghilangkan fungsi/.test(r.text) && !/JANGAN hapus/.test(r.text));

r = runDetector('--no-pull', '--from', join(TMP, 'editor-clean'), '--build', join(TMP, 'build-dupe'), '--json');
check('definisi ganda antar modul baru → kode keluar 1',
  r.status === 1 && r.json && r.json.build.duplicateSymbols.length === 1,
  `(status=${r.status}, dupes=${r.json && r.json.build.duplicateSymbols.length})`);
check('nama simbol ganda dilaporkan', r.json && r.json.build.duplicateSymbols[0].name === 'alpha');

r = runDetector('--no-pull', '--from', join(TMP, 'tidak-ada'), '--build', join(TMP, 'build'));
check('snapshot tak sah → kode keluar 2', r.status === 2, `(status=${r.status})`);
r = runDetector('--no-pull', '--from', join(TMP, 'editor-clean'), '--build', join(TMP, 'tidak-ada'));
check('build belum ada → kode keluar 2', r.status === 2, `(status=${r.status})`);
r = runDetector('--help');
check('--help → kode keluar 0', r.status === 0 && /Kode keluar/.test(r.text), `(status=${r.status})`);

rmSync(TMP, { recursive: true, force: true });
console.log(`\nHasil: ${pass} lulus, ${fail} gagal.`);
if (fail > 0) process.exit(1);
