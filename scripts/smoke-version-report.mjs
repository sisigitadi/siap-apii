// Uji smoke LAPORAN VERSI endpoint `ping` — tanpa jaringan & tanpa Google.
//
// Yang dikunci:
//   - laporan versi datang dari apps-script/Versi.gs (dihasilkan
//     scripts/stamp-build-info.mjs), BUKAN angka manual di kode;
//   - `version` = versi package.json, `release` = nomor Versi Apps Script yang
//     dicap deploy (null bila bundel belum dirilis — bukan angka karangan);
//   - bundel tanpa Versi.gs tetap menjawab, dengan version/release null;
//   - skrip pencap menolak argumen tidak sah TANPA menulis berkas apa pun.
//
// Pakai: node scripts/smoke-version-report.mjs   (atau: npm run smoke:version)
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { listBackendModules, readBackendFile } from './backend-modules.mjs';
import { appVersionFrom, buildInfoSource, readStampedRelease } from './stamp-build-info.mjs';

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

const ROOT = resolve('.');
const pkgVersion = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const TMP = mkdtempSync(join(tmpdir(), 'apii-versi-'));
const runStamp = (...args) => spawnSync(process.execPath, ['scripts/stamp-build-info.mjs', ...args],
  { cwd: ROOT, encoding: 'utf8' });

try {
  // ---------------------------------------------------------------------------
  console.log('== Skrip pencap info versi (tanpa jaringan) ==');
  check('versi acuan = package.json', appVersionFrom(ROOT) === pkgVersion);

  const outNull = join(TMP, 'Versi-null.gs');
  let r = runStamp('--out', outNull);
  const nullSrc = existsSync(outNull) ? readFileSync(outNull, 'utf8') : '';
  check('berhasil tanpa --release (kode keluar 0)', r.status === 0, `(status=${r.status})`);
  check('version diambil dari package.json', nullSrc.includes(`version: '${pkgVersion}'`));
  check('release null selama belum dirilis', readStampedRelease(outNull) === null);
  check('berkas hasil parse sebagai JavaScript/Apps Script', (() => {
    try { new Function(nullSrc); return true; } catch { return false; }
  })());

  const out15 = join(TMP, 'Versi-15.gs');
  r = runStamp('--release', '15', '--out', out15);
  check('--release menulis nomor rilis', r.status === 0 && readStampedRelease(out15) === 15, `(status=${r.status})`);

  r = runStamp('--keep-release', '--out', out15);
  check('--keep-release mempertahankan angka yang sudah tercap', r.status === 0 && readStampedRelease(out15) === 15);

  const bad0 = join(TMP, 'salah-0.gs');
  const badAbc = join(TMP, 'salah-abc.gs');
  r = runStamp('--release', '0', '--out', bad0);
  check('--release 0 ditolak (kode keluar 2)', r.status === 2, `(status=${r.status})`);
  check('tidak ada berkas ditulis saat argumen salah', !existsSync(bad0));
  r = runStamp('--release', 'abc', '--out', badAbc);
  check('--release non-angka ditolak (kode keluar 2)', r.status === 2 && !existsSync(badAbc), `(status=${r.status})`);

  // ---------------------------------------------------------------------------
  console.log('\n== Perilaku endpoint ping (bundel dievaluasi seperti di editor) ==');
  const core = listBackendModules().map(readBackendFile).join('\n');
  const pingWith = (extraSource) => {
    const ContentService = {
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
      MimeType: { JSON: 'json' },
    };
    const SpreadsheetApp = { openById: () => ({ getSheets: () => [], getSheetByName: () => null }) };
    const PropertiesService = { getScriptProperties: () => ({ getProperty: () => null }) };
    const Logger = { log: () => {} };
    const LockService = { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) };
    const api = new Function(
      'SpreadsheetApp', 'PropertiesService', 'Logger', 'LockService', 'ContentService',
      // APP_BUILD_INFO boleh saja tidak terdefinisi (mis. bundel tanpa Versi.gs);
      // harness ini yang mengakalinya, sedangkan kode produksi memakai
      // `typeof APP_BUILD_INFO === 'object'` agar tetap menjawab.
      `${core}\n${extraSource}\nreturn { handleRequest, APP_BUILD_INFO: typeof APP_BUILD_INFO === 'object' ? APP_BUILD_INFO : null };`
    )(SpreadsheetApp, PropertiesService, Logger, LockService, ContentService);
    return { payload: JSON.parse(api.handleRequest({ action: 'ping' }).text), info: api.APP_BUILD_INFO };
  };

  const stamped = pingWith(buildInfoSource({ version: pkgVersion, release: 15 }));
  check('ping menjawab sukses & status online',
    stamped.payload.success === true && stamped.payload.data.status === 'online');
  check('ping melaporkan versi aplikasi dari package.json', stamped.payload.data.version === pkgVersion);
  check('ping melaporkan nomor rilis yang dicap', stamped.payload.data.release === 15);
  check('nama layanan tetap ada', stamped.payload.data.service === 'SIAP APII Backend');
  check('pesan layanan aktif tetap ada', /Aktif/.test(stamped.payload.message));

  const unstamped = pingWith(buildInfoSource({ version: pkgVersion, release: null }));
  check('belum dirilis → release dilaporkan null (bukan angka karangan)',
    unstamped.payload.data.release === null && unstamped.payload.data.version === pkgVersion);

  const missing = pingWith('// bundel tanpa Versi.gs');
  check('tanpa Versi.gs → version & release null, bukan galat',
    missing.payload.data.version === null && missing.payload.data.release === null);

  // ---------------------------------------------------------------------------
  console.log('\n== Bundel hasil build & gerbang anti-drift ==');
  const versiPath = join(ROOT, 'apps-script', 'Versi.gs');
  if (!existsSync(versiPath)) {
    check('apps-script/Versi.gs ada (hasil build)', false, '— jalankan `npm run build:gas` lebih dahulu.');
  } else {
    check('apps-script/Versi.gs ada (hasil build)', true);
    const real = pingWith(readFileSync(versiPath, 'utf8'));
    check('bundel nyata melaporkan versi package.json', real.payload.data.version === pkgVersion);
    check('bundel nyata melaporkan release angka-atau-null',
      real.payload.data.release === null || Number.isInteger(real.payload.data.release),
      `(release=${JSON.stringify(real.payload.data.release)})`);
  }
  const codePath = join(ROOT, 'apps-script', 'Code.gs');
  if (existsSync(codePath)) {
    const codeSrc = readFileSync(codePath, 'utf8');
    check('Code.gs membaca APP_BUILD_INFO (tanpa angka versi literal)',
      /APP_BUILD_INFO/.test(codeSrc) && !/version:\s*'\d/.test(codeSrc));
  } else {
    check('apps-script/Code.gs ada (hasil build)', false, '— jalankan `npm run build:gas` lebih dahulu.');
  }
} finally {
  rmSync(TMP, { recursive: true, force: true });
}

console.log(`\nHasil: ${pass} lulus, ${fail} gagal.`);
if (fail > 0) process.exit(1);
