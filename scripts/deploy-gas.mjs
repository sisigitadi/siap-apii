// ============================================================================
// deploy-gas.mjs — Deploy backend Google Apps Script dengan SATU perintah.
// ============================================================================
// Menggantikan alur salin-tempel manual ke editor Apps Script:
//   1) build bundel gas/*.gs -> apps-script/*.gs
//   2) validasi sintaks bundel
//   3) preflight clasp TANPA kredensial (daftar berkas yang akan diunggah)
//   4) clasp push (13 modul + 2 aset + manifest appsscript.json)
//   5) cap nomor rilis ke apps-script/Versi.gs (versi terakhir + 1), sehingga
//      endpoint `ping` melaporkan versi aplikasi + nomor rilis yang BENAR
//   6) periksa editor: berkas lama & definisi ganda (clasp pull); sisa berkas
//      lama dibersihkan otomatis lewat Apps Script API (project.updateContent)
//      selama seluruh simbolnya sudah ada di modul baru
//   7) buat Versi baru (nomor yang dibuat WAJIB sama dengan yang dicap di 5)
//   8) perbarui deployment yang SAMA -> URL /exec tidak berubah
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
import { GENERATED_FILES, listBackendModules } from './backend-modules.mjs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = process.cwd();
const ARGS = process.argv.slice(2);
const DRY = ARGS.includes('--dry-run') || ARGS.includes('-n');
const SKIP_BUILD = ARGS.includes('--skip-build');
// Pembersihan otomatis berkas lama (Apps Script API) dapat dimatikan.
const NO_CLEANUP = ARGS.includes('--no-cleanup');
// Pencapan nomor Versi Apps Script ke apps-script/Versi.gs (dibaca `ping`).
const NO_RELEASE_STAMP = ARGS.includes('--no-release-stamp');
const CLASP = 'npx --yes @google/clasp@3';
// appsscript.json WAJIB ikut: `clasp push` menolak jalan tanpa manifest.
// appsscript.json WAJIB ikut: `clasp push` menolak jalan tanpa manifest.
// Backend kini satu file per modul (lihat scripts/build-apps-script.ps1).
const BUNDLE_FILES = [...listBackendModules(), 'AsetLogo.gs', 'AsetStempel.gs', ...GENERATED_FILES, 'appsscript.json'];

const descIdx = ARGS.findIndex((a) => a === '--desc' || a === '-d');
const DESC = descIdx !== -1 && ARGS[descIdx + 1] ? ARGS[descIdx + 1] : null;

if (ARGS.includes('--help') || ARGS.includes('-h')) {
  console.log(`Pakai: node scripts/deploy-gas.mjs [opsi]

  --dry-run, -n     Tampilkan rencana (build + validasi + preflight) tanpa mengunggah
  --skip-build      Lewati kompilasi bundel (pakai apps-script/*.gs yang ada)
  --no-release-stamp  Jangan mencap nomor rilis ke apps-script/Versi.gs;
                    endpoint ping akan melaporkan release: null
  --no-cleanup      Jangan membersihkan berkas lama otomatis; hentikan deploy dan
                    minta penghapusan manual
  --desc "<teks>"   Deskripsi versi deploy (default: timestamp rilis)
  --help, -h        Bantuan ini`);
  process.exit(0);
}

const step = (n, m) => console.log(`\n[${n}] ${m}`);
const ok = (m) => console.log(`    ✔ ${m}`);
const info = (m) => console.log(`    · ${m}`);
const warn = (m) => console.log(`    ! ${m}`);

function fail(message, hint, note) {
  console.error(`\n    ✘ ${message}`);
  if (hint) console.error(`      → ${hint}`);
  console.error(`\n${note || 'Deploy dibatalkan (tidak ada perubahan yang dikirim).'}`);
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
/**
 * Nomor Versi Apps Script tertinggi dari keluaran `clasp versions --json`.
 * @returns {number|null} angka tertinggi (0 = project belum punya versi),
 *   atau null bila keluaran tidak dapat dibaca.
 */
function latestVersionNumber(jsonText) {
  try {
    const parsed = JSON.parse((jsonText || '').trim());
    const numbers = (Array.isArray(parsed) ? parsed : [])
      .map((v) => Number(v && v.versionNumber))
      .filter((n) => Number.isFinite(n) && n > 0);
    return numbers.length ? Math.max(...numbers) : 0;
  } catch {
    return null;
  }
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
  ok('Bundel diperbarui: apps-script/<Modul>.gs per modul + AsetLogo.gs, AsetStempel.gs, Versi.gs (+ manifest appsscript.json)');
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
step('5b', 'Cap nomor rilis Apps Script ke berkas versi');
// ---------------------------------------------------------------------------
// Endpoint `ping` melaporkan `release` dari apps-script/Versi.gs. Angka itu
// harus sama dengan Versi Apps Script yang nanti dibuat & disajikan, jadi dicap
// TEPAT SEBELUM push: versi terakhir dibaca dari Apps Script, nomor berikutnya
// diprediksi (create-version selalu membuat nomor terakhir + 1), lalu langkah 8
// membandingkan prediksi dengan nomor yang benar-benar dibuat. Meleset = deploy
// berhenti sebelum deployment diperbarui, jadi monitoring tidak pernah dibohongi.
let releaseStamped = null;
if (DRY) {
  console.log(`    $ ${CLASP} --json versions`);
  console.log('    $ node scripts/stamp-build-info.mjs --release <versi terakhir + 1>');
  console.log('    · (dry-run) berkas versi tidak diubah.');
} else if (NO_RELEASE_STAMP) {
  warn('Dilewati (--no-release-stamp): endpoint ping akan melaporkan release: null.');
} else {
  const versRes = run(`${CLASP} --json versions`, { silent: true, allowFail: true });
  const latest = latestVersionNumber(versRes.stdout);
  if (latest === null) {
    warn('Nomor Versi Apps Script tidak dapat dibaca — berkas versi akan melaporkan release: null.');
    warn('Versi aplikasi tetap dilaporkan, tetapi monitoring tidak dapat memastikan nomor rilis.');
  } else {
    releaseStamped = latest + 1;
    run(`node scripts/stamp-build-info.mjs --release ${releaseStamped}`, { silent: true });
    ok(`release ${releaseStamped} dicap ke apps-script/Versi.gs (versi terakhir di Apps Script: ${latest}).`);
    // Hasil cap tetap harus lulus validasi (syntax + kesamaan versi package.json)
    // sebelum diunggah, supaya laporan versi tidak pernah setengah jadi.
    run('node scripts/validate-apps-script.mjs', { silent: true });
    ok('Bundel & info versi lulus validasi ulang setelah dicap.');
  }
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
  ok('Kode terunggah — hasilnya diverifikasi di langkah 7.');
}

// ---------------------------------------------------------------------------
step(7, 'Periksa editor Apps Script (berkas lama & definisi ganda)');
// ---------------------------------------------------------------------------
// Semua berkas .gs berbagi satu scope global di Apps Script, jadi berkas lama
// yang masih tertinggal (Backend.gs tunggal sebelum build dipecah, atau
// Aset.gs peninggalan zaman dulu) membuat definisi ganda yang TIDAK dilaporkan
// sebagai error — runtime diam-diam memakai salah satunya (gejala: "Aksi tidak
// dikenali" karena salinan usang yang dieksekusi). Terbukti pada rilis Versi 14
// (2026-10-10) bahwa `clasp push` sudah menghapus berkas lama: API
// projects.updateContent mengganti SELURUH isi project, jadi editor langsung
// berisi tepat berkas lokal. Pemeriksaan ini tetap ada untuk menutup kemungkinan
// sisa (versi clasp lebih lama / unggahan sebagian) — versi baru tidak pernah
// dibuat selagi editor masih kotor.
const dupRes = run('node scripts/check-legacy-duplicates.mjs --json', { silent: true, real: true, allowFail: true });
let dup = null;
try { dup = JSON.parse((dupRes.stdout || '').trim()); } catch { dup = null; }

if (!dup) {
  if (DRY) {
    warn('Pemeriksaan editor tidak dapat dijalankan pada dry-run (lihat keluaran di atas).');
  } else {
    fail('Keluaran pemeriksaan editor tidak dapat dibaca.',
      'Jalankan manual: npm run check:legacy',
      'Deploy dihentikan sebelum versi baru dibuat: kode sudah terunggah, tetapi produksi (/exec) belum berubah.');
  }
} else if (dup.status === 'clean') {
  ok(`Editor bersih: ${dup.editor.files.length} berkas, 0 berkas lama, 0 definisi ganda (${dup.build.symbols} simbol global diperiksa).`);
} else if (dup.status === 'unverified') {
  if (DRY) {
    warn(`(dry-run) editor belum diverifikasi: ${dup.reason}`);
  } else {
    fail(`Editor tidak dapat diverifikasi: ${dup.reason}`, dup.hint || 'Jalankan manual: npm run check:legacy',
      'Deploy dihentikan sebelum versi baru dibuat: kode sudah terunggah, tetapi produksi (/exec) belum berubah.');
  }
} else {
  const legacyFiles = (dup.editor.legacy || []).map((l) => l.file);
  const uncovered = (dup.editor.legacy || []).filter((l) => l.uncovered.length);
  warn(`${legacyFiles.length} berkas lama masih ada di editor: ${legacyFiles.join(', ')}`);
  for (const l of dup.editor.legacy || []) {
    info(`${l.file}: ${l.collisionCount} definisi ganda dengan modul baru, ${l.uncovered.length} simbol belum pindah`);
  }
  const legacyList = legacyFiles.join(', ');
  const afterPush = 'Deploy dihentikan sebelum versi baru dibuat: kode sudah terunggah, tetapi produksi (/exec) belum berubah.';
  if (DRY) {
    if (uncovered.length) {
      warn(`(dry-run) ${uncovered.length} berkas lama memuat simbol yang belum ada di modul baru — deploy sungguhan akan DITOLAK sampai simbol itu dipindahkan.`);
    } else if (NO_CLEANUP) {
      warn(`(dry-run) deploy sungguhan akan DIHENTIKAN di langkah ini sampai ${legacyList} dihapus manual.`);
    } else {
      warn(`(dry-run) deploy sungguhan akan membersihkan sendiri berkas ini lewat Apps Script API: ${legacyList}.`);
    }
  } else if (uncovered.length) {
    fail(`${uncovered.length} berkas lama memuat simbol yang BELUM ada di modul baru — jangan dihapus dulu.`,
      'Pindahkan simbol tersebut ke modul yang tepat → npm run build:gas → jalankan ulang deploy.',
      afterPush);
  } else if (NO_CLEANUP) {
    fail('Editor Apps Script masih berisi berkas lama sehingga terjadi definisi ganda.',
      `Buka editor Apps Script → klik kanan ${legacyList} → Delete, atau jalankan ulang tanpa \`--no-cleanup\` ` +
      'agar dibersihkan otomatis lewat Apps Script API. Seluruh simbol berkas lama sudah terbukti ada di modul baru.',
      afterPush);
  } else {
    // Pembersihan otomatis: hapus berkas lama lewat projects.updateContent —
    // hanya berkas yang seluruh simbolnya sudah ada di modul baru (langkah 7
    // sudah membuktikannya di atas), isi berkas lain dikirim apa adanya.
    info(`Membersihkan ${legacyList} lewat Apps Script API (projects.updateContent)…`);
    const cleanRes = run('node scripts/remove-legacy-files.mjs --yes --json', { silent: true, real: true, allowFail: true });
    let clean = null;
    try { clean = JSON.parse((cleanRes.stdout || '').trim()); } catch { clean = null; }
    if (clean && clean.status === 'removed' && clean.verified) {
      ok(`${clean.removed.length} berkas lama dihapus & terverifikasi: ${clean.removed.map((f) => f.name).join(', ')}`);
      const recheck = run('node scripts/check-legacy-duplicates.mjs --json', { silent: true, real: true, allowFail: true });
      let re = null;
      try { re = JSON.parse((recheck.stdout || '').trim()); } catch { re = null; }
      if (re && re.status === 'clean') {
        ok(`Editor sekarang bersih (${re.editor.files.length} berkas) — lanjut ke langkah 8.`);
      } else {
        fail('Editor masih belum bersih setelah pembersihan otomatis.',
          `Periksa manual: npm run check:legacy  ·  masih ada: ${((re && re.editor && re.editor.legacy) || []).map((l) => l.file).join(', ') || '(tidak terbaca)'}`,
          afterPush);
      }
    } else {
      fail('Pembersihan otomatis berkas lama tidak berhasil.',
        (clean && clean.status === 'unverified'
          ? `${clean.reason} — jalankan manual: npm run cleanup:legacy -- --yes`
          : `Jalankan manual: npm run cleanup:legacy -- --yes   (atau hapus ${legacyList} di editor)`),
        afterPush);
    }
  }
}

// ---------------------------------------------------------------------------
step(8, 'Buat versi baru');
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

  // Laporan `ping` hanya benar bila nomor yang dicap di langkah 5b sama dengan
  // nomor yang baru dibuat. Bila tidak (mis. ada versi dibuat orang lain di
  // sela-sela), deploy dihentikan SEBELUM deployment diperbarui: produksi tetap
  // menyajikan versi lama, bukan versi yang melaporkan nomor rilis salah.
  if (releaseStamped !== null && versionNumber !== releaseStamped) {
    fail(`Nomor Versi Apps Script yang dibuat (${versionNumber}) tidak sama dengan yang dicap ke berkas versi (${releaseStamped}).`,
      'Berkas versi melaporkan nomor yang salah — jangan lanjutkan. Jalankan ulang deploy agar nomornya dicap ulang.',
      'Deploy dihentikan sebelum deployment diperbarui: produksi (/exec) masih menyajikan versi sebelumnya.');
  }
  if (releaseStamped !== null) {
    ok(`Laporan ping cocok dengan rilis ini (release ${versionNumber}).`);
  }
}

// ---------------------------------------------------------------------------
step(9, 'Perbarui deployment yang sama (URL /exec tidak berubah)');
// ---------------------------------------------------------------------------
if (DRY) {
  console.log(`    $ ${CLASP} update-deployment ${deploymentId} -V <versi> -d "${desc}" --json`);
  console.log('    (versi dibuat pada langkah 8; URL /exec tidak berubah)');
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
  console.log(`   1. Buka ${url}?action=ping → harus menjawab JSON dengan status "online", version, dan release ${versionNumber}`);
  console.log('      (monitoring membaca kedua angka itu; release = versi yang baru tayang)');
  console.log('   2. Login portal → Pengaturan → 📰 Redaksi Konten → Simpan → cek Riwayat Versi bertambah.');
}
console.log('\n Catatan penting: editor Apps Script HARUS hanya berisi output build per-modul:');
console.log('   Konfig.gs, Utils.gs, Editorial.gs, Pengaturan.gs, Database.gs, Auth.gs,');
console.log('   Surat.gs, Keuangan.gs, Divisi.gs, TemplateSurat.gs, TemplateSuratDocs.gs,');
console.log('   Visitor.gs, Code.gs, AsetLogo.gs, AsetStempel.gs, Versi.gs, appsscript.json.');
console.log(' Langkah 7 memeriksa hal itu langsung dari editor (clasp pull) — bukan asumsi:');
console.log(' bila masih ada berkas lama (mis. Backend.gs / Aset.gs), definisi ganda akan');
console.log(' membuat Apps Script diam-diam memakai salinan usang. Sisa itu dibersihkan');
console.log(' otomatis lewat Apps Script API; deploy hanya dihentikan bila ada simbol');
console.log(' berkas lama yang belum pindah ke modul baru (butuh tindakan manusia).');
console.log(' Periksa: npm run check:legacy   ·   bersihkan: npm run cleanup:legacy -- --yes');
console.log('============================================================');
