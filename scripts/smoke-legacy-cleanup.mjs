// Uji smoke lokal scripts/remove-legacy-files.mjs — seluruhnya tanpa jaringan.
// Mengunci keputusan pembersihan berkas lama (lewat Apps Script API) dengan
// fixture, termasuk kasus yang HARUS ditolak:
//   1) berkas lama yang seluruh simbolnya sudah pindah → boleh dihapus
//   2) berkas lama dengan satu simbol belum pindah  → DITOLAK (tidak dihapus)
//   3) berkas HTML / JSON tak dikenal                → DITOLAK (keputusan manusia)
//   4) berkas keluaran build & manifest             → tidak pernah masuk rencana
//   5) editor bersih                                 → status clean (idempoten)
//   6) CLI --from-json: status/kode keluar sesuai rencana (tanpa menulis API)
//
// Pakai: node scripts/smoke-legacy-cleanup.mjs   (atau: npm run smoke:cleanup)
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fingerprint, planCleanup, serverFileOf } from './remove-legacy-files.mjs';
import { globalSymbols } from './check-legacy-duplicates.mjs';

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

const ROOT = resolve('.');
const SCRIPT = join(ROOT, 'scripts', 'remove-legacy-files.mjs');
const TMP = mkdtempSync(join(tmpdir(), 'apii-cleanup-smoke-'));
const write = (rel, content) => {
  const p = join(TMP, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, content);
};

// ---------------------------------------------------------------------------
// Fixture build (acuan) — dua modul + manifest
// ---------------------------------------------------------------------------
write('build/A.gs', 'function alpha() { return 1; }\nvar KONFIG = {};\n');
write('build/B.gs', 'function beta() { return 2; }\n');
write('build/appsscript.json', '{ "timeZone": "Asia/Jakarta" }\n');

const buildFiles = ['A.gs', 'B.gs', 'appsscript.json'];
const buildSymbols = new Map();
for (const f of buildFiles.filter((x) => x.endsWith('.gs'))) {
  for (const s of globalSymbols(readFileSync(join(TMP, 'build', f), 'utf8'))) buildSymbols.set(s.name, { file: f });
}

// ---------------------------------------------------------------------------
// 1) Peta nama berkas lokal → editor
// ---------------------------------------------------------------------------
console.log('\n== pemetaan nama berkas (Apps Script API) ==');
check('A.gs → { A, SERVER_JS }', JSON.stringify(serverFileOf('A.gs')) === '{"name":"A","type":"SERVER_JS"}');
check('TemplateSuratDocs.gs → TemplateSuratDocs [SERVER_JS]',
  serverFileOf('TemplateSuratDocs.gs').name === 'TemplateSuratDocs');
check('appsscript.json → { appsscript, JSON }',
  JSON.stringify(serverFileOf('appsscript.json')) === '{"name":"appsscript","type":"JSON"}');

// ---------------------------------------------------------------------------
// 2) Rencana pembersihan
// ---------------------------------------------------------------------------
console.log('\n== rencana pembersihan ==');
const remote = [
  { name: 'appsscript', type: 'JSON', source: '{ "timeZone": "Asia/Jakarta" }\n' },
  { name: 'A', type: 'SERVER_JS', source: 'function alpha() { return 9; }\nvar KONFIG = {};\n' },
  { name: 'B', type: 'SERVER_JS', source: 'function beta() { return 9; }\n' },
  { name: 'Backend', type: 'SERVER_JS', source: 'function alpha() { return 9; }\nfunction beta() { return 9; }\nvar KONFIG = {};\n' },
];
let plan = planCleanup({ remote, buildFiles, buildSymbols });
check('berkas lama yang seluruh simbolnya pindah → boleh dihapus',
  plan.removable.length === 1 && plan.removable[0].name === 'Backend', JSON.stringify(plan.removable.map((f) => f.name)));
check('4 simbol berkas lama terhitung', plan.removable[0].symbols === 3, `(dihitung ${plan.removable[0].symbols})`);
check('berkas keluaran build & manifest tidak pernah masuk rencana dihapus',
  !plan.removable.some((f) => ['A', 'B', 'appsscript'].includes(f.name)));
check('keep = isi project tanpa berkas yang akan dihapus',
  plan.keep.length === 3 && plan.keep.every((f) => f.name !== 'Backend'));

const planUncovered = planCleanup({
  remote: [...remote.slice(0, 3), { name: 'Backend', type: 'SERVER_JS', source: 'function alpha() {}\nfunction fiturLama() {}\n' }],
  buildFiles, buildSymbols,
});
check('berkas lama dengan simbol belum pindah → DITOLAK',
  planUncovered.removable.length === 0 && planUncovered.refused.length === 1,
  `(removable=${planUncovered.removable.length}, refused=${planUncovered.refused.length})`);
check('simbol yang belum pindah dilaporkan lengkap',
  planUncovered.refused[0].missing.some((m) => m.startsWith('fiturLama')));
check('berkas yang ditolak tetap berada di daftar keep (tidak dihapus)',
  planUncovered.keep.some((f) => f.name === 'Backend'));

const planHtml = planCleanup({
  remote: [...remote.slice(0, 3), { name: 'Index', type: 'HTML', source: '<html></html>' }],
  buildFiles, buildSymbols,
});
check('berkas HTML tidak dihapus otomatis', planHtml.removable.length === 0 && planHtml.refused.length === 1);

const planClean = planCleanup({ remote: remote.slice(0, 3), buildFiles, buildSymbols });
check('editor bersih → tidak ada rencana apa pun',
  planClean.removable.length === 0 && planClean.refused.length === 0 && planClean.legacy.length === 0);

// ---------------------------------------------------------------------------
// 3) Sidik jari (pembanding sebelum/sesudah tulis)
// ---------------------------------------------------------------------------
console.log('\n== sidik jari isi project ==');
check('urutan berkas tidak memengaruhi sidik jari',
  fingerprint(remote) === fingerprint([...remote].reverse()));
check('perubahan isi terdeteksi',
  fingerprint(remote) !== fingerprint([{ ...remote[0], source: '{ "timeZone": "UTC" }\n' }, ...remote.slice(1)]));

// ---------------------------------------------------------------------------
// 4) CLI dengan --from-json (tanpa jaringan, tanpa menulis)
// ---------------------------------------------------------------------------
console.log('\n== CLI (--from-json, mode rencana) ==');
const runCli = (files, extra = []) => {
  const p = join(TMP, `remote-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(p, JSON.stringify({ files }));
  const r = spawnSync(process.execPath, [SCRIPT, '--from-json', p, '--build', join(TMP, 'build'), '--json', ...extra],
    { cwd: ROOT, encoding: 'utf8' });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { json = null; }
  return { status: r.status, json, text: `${r.stdout}${r.stderr}` };
};

let r = runCli(remote);
check('rencana: kode keluar 0 dengan status "planned"',
  r.status === 0 && r.json && r.json.status === 'planned', `(status=${r.status}, ${r.json && r.json.status})`);
check('rencana: berkas yang akan dihapus disebutkan', r.json && r.json.removable.length === 1);
check('rencana: TIDAK menulis ke API (tidak ada permintaan updateContent)',
  !/updateContent|Berhasil|dihapus dari editor/.test(r.text));

r = runCli([...remote.slice(0, 3), { name: 'Backend', type: 'SERVER_JS', source: 'function alpha() {}\nfunction fiturLama() {}\n' }]);
check('berkas tersisa dengan simbol belum pindah → kode keluar 1 (blocked)',
  r.status === 1 && r.json && r.json.status === 'blocked', `(status=${r.status})`);
check('alasan penolakan di JSON memuat peringatan "JANGAN dihapus"',
  Boolean(r.json && r.json.refused[0] && /JANGAN dihapus/.test(r.json.refused[0].reason)),
  `(${r.json && r.json.refused[0] && r.json.refused[0].reason})`);
{
  // Mode manusia (tanpa --json) harus menyebut berkas yang ditolak.
  const p = join(TMP, 'remote-human.json');
  writeFileSync(p, JSON.stringify({ files: [...remote.slice(0, 3), { name: 'Backend', type: 'SERVER_JS', source: 'function alpha() {}\nfunction fiturLama() {}\n' }] }));
  const h = spawnSync(process.execPath, [SCRIPT, '--from-json', p, '--build', join(TMP, 'build')], { cwd: ROOT, encoding: 'utf8' });
  check('mode manusia menyebutkan berkas yang TIDAK dihapus + daftar simbolnya',
    h.status === 1 && /TIDAK dihapus/.test(h.stdout) && /fiturLama/.test(h.stdout), `(status=${h.status})`);
}

r = runCli([...remote.slice(0, 3), { name: 'Index', type: 'HTML', source: '<html></html>' }]);
check('HTML tak dikenal → kode keluar 1', r.status === 1, `(status=${r.status})`);

r = runCli(remote.slice(0, 3));
check('editor bersih → kode keluar 0 status clean',
  r.status === 0 && r.json && r.json.status === 'clean', `(status=${r.status})`);

r = spawnSync(process.execPath, [SCRIPT, '--help'], { cwd: ROOT, encoding: 'utf8' });
check('--help → kode keluar 0', r.status === 0 && /Kode keluar/.test(r.stdout));

rmSync(TMP, { recursive: true, force: true });
console.log(`\nHasil: ${pass} lulus, ${fail} gagal.`);
if (fail > 0) process.exit(1);
