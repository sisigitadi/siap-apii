// ============================================================================
// deploy-gas.mjs — Deploy backend Google Apps Script dengan SATU perintah.
// ============================================================================
// Menggantikan alur salin-tempel manual ke editor Apps Script:
//   1) build bundel gas/*.gs -> apps-script/*.gs
//   2) validasi sintaks bundel
//   3) preflight clasp TANPA kredensial (daftar berkas yang akan diunggah)
//   4) clasp push (4 berkas: 3 bundel + manifest appsscript.json)
//   5) buat Versi baru
//   6) perbarui deployment yang SAMA -> URL /exec tidak berubah
//
// Pakai:
//   npm run deploy:gas                 (deploy penuh)
//   npm run deploy:gas -- --dry-run    (hanya build + validasi + preflight)
//   npm run deploy:gas -- --desc "release 2.3.0"
//
// Prasyarat sekali saja:
//   npx --yes @google/clasp@3 login          (login akun Google yayasan)
//   GAS_SCRIPT_ID=<Script ID> di .env        (Project Settings > Script ID)
//   Google Apps Script API AKTIF untuk akun clasp:
//     https://script.google.com/home/usersettings  (tanpa ini, unggahan
//     ditolak Google dengan pesan "User has not enabled the Apps Script API")
// ============================================================================
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = process.cwd();
const ARGS = process.argv.slice(2);
const DRY = ARGS.includes('--dry-run') || ARGS.includes('-n');
const SKIP_BUILD = ARGS.includes('--skip-build');
const CLASP = 'npx --yes @google/clasp@3';
// appsscript.json WAJIB ikut: `clasp push` menolak jalan tanpa manifest.
const BUNDLE_FILES = ['Backend.gs', 'AsetLogo.gs', 'AsetStempel.gs', 'appsscript.json'];

const descIdx = ARGS.findIndex((a) => a === '--desc' || a === '-d');
const DESC = descIdx !== -1 && ARGS[descIdx + 1] ? ARGS[descIdx + 1] : null;

if (ARGS.includes('--help') || ARGS.includes('-h')) {
  console.log(`Pakai: node scripts/deploy-gas.mjs [opsi]

  --dry-run, -n     Tampilkan rencana (build + validasi + preflight) tanpa mengunggah
  --skip-build      Lewati kompilasi bundel (pakai apps-script/*.gs yang ada)
  --desc "<teks>"   Deskripsi versi deploy (default: timestamp rilis)
  --help, -h        Bantuan ini`);
  process.exit(0);
}

const step = (n, m) => console.log(`\n[${n}] ${m}`);
const ok = (m) => console.log(`    ✔ ${m}`);
const info = (m) => console.log(`    · ${m}`);
const warn = (m) => console.log(`    ! ${m}`);

function fail(message, hint) {
  console.error(`\n    ✘ ${message}`);
  if (hint) console.error(`      → ${hint}`);
  console.error('\nDeploy dibatalkan (tidak ada perubahan yang dikirim).');
  process.exit(1);
}

/** Jalankan perintah shell; kembalikan status + keluaran. */
function run(cmd, { silent = false, allowFail = false, real = false } = {}) {
  // `real: true` dipakai untuk langkah lokal (build & validasi) yang tetap
  // dijalankan pada mode --dry-run karena tidak menyentuh project di Google.
  if (DRY && !real) console.log(`    $ ${cmd}`);
  if (DRY && !real) return { status: 0, stdout: '', stderr: '', dry: true };
  const r = spawnSync(cmd, { shell: true, encoding: 'utf8' });
  const stdout = r.stdout || '';
  const stderr = r.stderr || '';
  if (!silent) {
    if (stdout.trim()) console.log(stdout.trim().split('\n').map((l) => `      ${l}`).join('\n'));
    if (stderr.trim()) console.error(stderr.trim().split('\n').map((l) => `      ${l}`).join('\n'));
  }
  if (r.status !== 0 && !allowFail) {
    fail(`Perintah gagal: ${cmd}`, 'Jalankan perintah tersebut manual untuk melihat pesan lengkapnya.');
  }
  return { status: r.status, stdout, stderr };
}

/** Baca KEY=VALUE dari .env / .env.local tanpa dependensi tambahan. */
function readEnvFiles() {
  const out = {};
  for (const file of ['.env', '.env.local']) {
    const p = join(ROOT, file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let value = m[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (out[m[1]] === undefined) out[m[1]] = value;
    }
  }
  return out;
}

/** Ambil deployment ID dari URL /exec di config.js agar URL produksi tidak berubah. */
function deploymentIdsFromConfig() {
  const found = [];
  for (const file of ['portal/config.js', 'public/config.js']) {
    const p = join(ROOT, file);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/macros\/s\/([A-Za-z0-9_-]{20,})\/exec/);
    if (m) found.push({ file, id: m[1] });
  }
  return found;
}

const env = readEnvFiles();
const getVar = (name) => process.env[name] || env[name] || '';

console.log('============================================================');
console.log(' Deploy Backend Apps Script — SIAP APII DPW Jabodetabek');
console.log(` Mode: ${DRY ? 'DRY-RUN (tidak mengunggah apa pun)' : 'DEPLOY PRODUKSI'}`);
console.log('============================================================');

// ---------------------------------------------------------------------------
step(1, 'Preflight konfigurasi');
// ---------------------------------------------------------------------------
const claspJsonPath = join(ROOT, '.clasp.json');
let scriptId = getVar('GAS_SCRIPT_ID');
let claspJson = {};
if (existsSync(claspJsonPath)) {
  try { claspJson = JSON.parse(readFileSync(claspJsonPath, 'utf8')); } catch { claspJson = {}; }
}
if (!scriptId && claspJson.scriptId) scriptId = claspJson.scriptId;
if (!scriptId) {
  fail('GAS_SCRIPT_ID belum diisi.',
    'Buka project Apps Script → ⚙ Project Settings → Script ID, lalu tambahkan baris ' +
    'GAS_SCRIPT_ID=<nilai> di file .env (tidak ikut ter-commit).');
}
info(`Script ID: ${scriptId.slice(0, 6)}…${scriptId.slice(-4)} (disamarkan)`);

// .clasp.json dibuat/diperbarui agar bundel di apps-script/ yang diunggah.
// Berkas ini bersifat konfigurasi lokal (di-gitignore) dan juga ditulis saat
// --dry-run supaya preflight berkas di langkah 4 dapat diverifikasi nyata.
const nextClaspJson = Object.assign({}, claspJson, { scriptId, rootDir: 'apps-script' });
if (JSON.stringify(nextClaspJson) !== JSON.stringify(claspJson)) {
  writeFileSync(claspJsonPath, JSON.stringify(nextClaspJson, null, 2) + '\n');
  ok('.clasp.json disiapkan (rootDir: apps-script)');
} else {
  ok('.clasp.json sudah sesuai');
}

// Deployment ID diambil dari config.js supaya URL /exec tetap sama.
const fromConfig = deploymentIdsFromConfig();
const configIds = [...new Set(fromConfig.map((c) => c.id))];
if (configIds.length > 1) {
  fail('portal/config.js dan public/config.js menunjuk deployment yang BERBEDA.',
    'Samakan API_BASE kedua file tersebut sebelum deploy agar tidak memperbarui deployment yang salah.');
}
const deploymentId = getVar('GAS_DEPLOYMENT_ID') || configIds[0] || '';
if (!deploymentId) {
  fail('Deployment ID tidak ditemukan.',
    'Isi GAS_DEPLOYMENT_ID=<id> di .env, atau pastikan API_BASE di portal/config.js memuat ' +
    'URL https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec.');
}
info(`Deployment ID: ${deploymentId.slice(0, 6)}…${deploymentId.slice(-4)} (URL /exec akan tetap sama)`);

// ---------------------------------------------------------------------------
step(2, 'Kompilasi bundel Apps Script');
// ---------------------------------------------------------------------------
if (SKIP_BUILD) {
  warn('Dilewati (--skip-build).');
} else {
  run('powershell -ExecutionPolicy Bypass -File ./scripts/build-apps-script.ps1', { silent: true, real: true });
  ok('Bundel diperbarui: apps-script/Backend.gs, AsetLogo.gs, AsetStempel.gs (+ manifest appsscript.json)');
}
for (const f of BUNDLE_FILES) {
  if (!existsSync(join(ROOT, 'apps-script', f))) {
    fail(`apps-script/${f} tidak ditemukan.`, 'Jalankan npm run build:gas lebih dahulu.');
  }
}

// ---------------------------------------------------------------------------
step(3, 'Validasi sintaks bundel');
// ---------------------------------------------------------------------------
run('node scripts/validate-apps-script.mjs', { silent: true, real: true });  ok('Bundel & manifest lulus validasi sintaks.');

// ---------------------------------------------------------------------------
step(4, 'Preflight berkas yang akan diunggah (tanpa kredensial)');
// ---------------------------------------------------------------------------
// clasp status hanya membaca project LOKAL (tidak butuh kredensial), jadi
// preflight ini juga dijalankan pada mode --dry-run.
const statusRes = spawnSync(`${CLASP} --json status`, { shell: true, encoding: 'utf8' });
let filesToPush = [];
let untracked = [];
try {
  const parsed = JSON.parse((statusRes.stdout || '').trim());
  filesToPush = (parsed.filesToPush || []).map((p) => String(p).split(/[\\/]/).pop()).sort();
  untracked = parsed.untrackedFiles || [];
} catch {
  fail('Tidak dapat membaca daftar berkas dari clasp.',
    'Jalankan `npx --yes @google/clasp@3 status` manual untuk memeriksa.');
}
const expected = [...BUNDLE_FILES].sort();
if (JSON.stringify(filesToPush) !== JSON.stringify(expected)) {
  fail(`Daftar berkas tidak sesuai. Ditemukan: [${filesToPush.join(', ')}]`,
    `Yang diharapkan tepat: [${expected.join(', ')}]. Periksa isi folder apps-script/.`);
}
ok(`Tepat ${filesToPush.length} berkas akan diunggah: ${filesToPush.join(', ')}`);
if (untracked.length) {
  warn(`${untracked.length} berkas di apps-script/ tidak ikut diunggah: ${untracked.join(', ')}`);
}

// ---------------------------------------------------------------------------
step(5, 'Status login clasp');
// ---------------------------------------------------------------------------
const authRes = run(`${CLASP} show-authorized-user --json`, { silent: true, allowFail: true });
let authorizedEmail = '';
if (DRY) {
  info('(dry-run) status login tidak diwajibkan.');
} else {
  let loggedIn = false;
  try {
    const parsedAuth = JSON.parse(authRes.stdout.trim());
    loggedIn = parsedAuth.loggedIn === true;
    authorizedEmail = parsedAuth.email || '';
  } catch { loggedIn = false; }
  if (!loggedIn) {
    fail('Belum login ke clasp.',
      'Jalankan sekali: npx --yes @google/clasp@3 login   (pakai akun Google yayasan pemilik project Apps Script)');
  }
  ok(`Terautentikasi ke script.google.com${authorizedEmail ? ' sebagai ' + authorizedEmail : ''}.`);
}

// ---------------------------------------------------------------------------
step(6, 'Unggah kode (clasp push)');
// ---------------------------------------------------------------------------
const pushRes = run(`${CLASP} push --force`, { silent: true, allowFail: true });
if (!DRY) {
  const pushOut = `${pushRes.stdout || ''}\n${pushRes.stderr || ''}`;
  if (pushRes.status !== 0) {
    // Tampilkan keluaran asli agar penyebabnya selalu terlihat.
    if (pushOut.trim()) {
      console.error(pushOut.trim().split('\n').map((l) => `      ${l}`).join('\n'));
    }
    // Penyebab paling sering: setelan akun Google (bukan kesalahan kode).
    if (/has not enabled the Apps Script API/i.test(pushOut)) {
      fail('Google menolak unggahan: akun ini belum mengaktifkan Google Apps Script API.',
        'Buka https://script.google.com/home/usersettings memakai akun ' +
        (authorizedEmail ? authorizedEmail + ' ' : '') +
        'lalu aktifkan “Google Apps Script API”, tunggu beberapa menit, dan jalankan ulang perintah ini.');
    }
    if (/manifest/i.test(pushOut) && /appsscript/i.test(pushOut)) {
      fail('Manifest appsscript.json tidak ada di folder unggahan.',
        'Jalankan `npm run build:gas` — manifest disalin dari gas/appsscript.json.');
    }
    fail(`Perintah gagal: ${CLASP} push --force`,
      'Jalankan perintah tersebut manual untuk melihat pesan lengkapnya.');
  }
  ok('Kode terunggah. Catatan: clasp TIDAK menghapus berkas lama di editor — lihat pengingat di akhir.');
}

// ---------------------------------------------------------------------------
step(7, 'Buat versi baru');
// ---------------------------------------------------------------------------
const desc = DESC || `SIAP APII rilis ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
let versionNumber = null;
if (DRY) {
  console.log(`    $ ${CLASP} --json create-version "${desc}"`);
} else {
  const verRes = run(`${CLASP} --json create-version "${desc}"`, { silent: true });
  try {
    versionNumber = JSON.parse(verRes.stdout.trim()).versionNumber;
  } catch {
    const m = `${verRes.stdout}\n${verRes.stderr}`.match(/[Vv]ersion[^\d]{0,12}(\d+)/);
    versionNumber = m ? Number(m[1]) : null;
  }
  if (!versionNumber) {
    fail('Nomor versi tidak dapat dibaca dari keluaran clasp.',
      'Jalankan `npx --yes @google/clasp@3 versions` untuk melihat versi terbaru.');
  }
  ok(`Versi ${versionNumber} dibuat — "${desc}"`);
}

// ---------------------------------------------------------------------------
step(8, 'Perbarui deployment yang sama (URL /exec tidak berubah)');
// ---------------------------------------------------------------------------
if (DRY) {
  console.log(`    $ ${CLASP} update-deployment ${deploymentId} -V <versi> -d "${desc}" --json`);
  console.log('    (versi dibuat pada langkah 7; URL /exec tidak berubah)');
} else {
  run(`${CLASP} update-deployment ${deploymentId} -V ${versionNumber} -d "${desc}" --json`, { silent: true });
  ok(`Deployment ${deploymentId.slice(0, 6)}…${deploymentId.slice(-4)} kini menyajikan versi ${versionNumber}.`);
}

// ---------------------------------------------------------------------------
console.log('\n============================================================');
if (DRY) {
  console.log(' DRY-RUN selesai — tidak ada yang diunggah.');
  console.log(' Jalankan tanpa --dry-run untuk deploy sungguhan.');
} else {
  const url = `https://script.google.com/macros/s/${deploymentId}/exec`;
  console.log(' DEPLOY SELESAI.');
  console.log(` Endpoint: ${url}`);
  console.log(' URL /exec tidak berubah, jadi portal/config.js & public/config.js tidak perlu diedit.');
  console.log('\n Verifikasi cepat:');
  console.log(`   1. Buka ${url} → harus menjawab JSON {"status":"online",...}`);
  console.log('   2. Login portal → Pengaturan → 📰 Redaksi Konten → Simpan → cek Riwayat Versi bertambah.');
}
console.log('\n Catatan penting: clasp tidak pernah menghapus berkas di editor Apps Script.');
console.log(' Pastikan project tersebut HANYA berisi: Backend.gs, AsetLogo.gs, AsetStempel.gs,');
console.log(' dan appsscript.json. Jika masih ada sisa berkas lama (mis. Aset.gs, Code.gs),');
console.log(' hapus sekali secara manual dari editor agar tidak ada definisi fungsi ganda.');
console.log('============================================================');
