// ============================================================================
// smoke-drive-prod.mjs — Uji AMAN alur Google Drive terhadap PRODUKSI.
// ============================================================================
// Menguji tiga aksi yang MENGUBAH Drive sungguhan tanpa menyentuh dokumen asli:
//
//   1) createDriveFolder  → folder uji + 5 subfolder standar
//   2) moveDriveFolder    → 2 penjagaan negatif + 1 pemindahan nyata
//   3) resetDriveStorage  → kembali ke folder default sistem
//
// Cara aman bekerjanya:
//   • Seluruh folder uji dibuat DI DALAM satu folder sandbox
//     `UJI-OTOMATIS-APII-<stempel>` yang dibuat skrip ini lewat Drive API.
//   • Sandbox itu milik skrip (kredensial clasp), jadi skrip mencoba
//     menghapusnya sendiri; folder buatan backend berada di dalamnya sehingga
//     ikut terbuang bersama sandbox.
//   • Konfigurasi produksi (folder aktif) dipulihkan di akhir dan diverifikasi
//     ULANG; sandbox hanya dibersihkan bila pemulihan terbukti berhasil.
//
// BATASAN YANG SUDAH TERBUKTI (penting, baca sebelum menilai hasil):
//   Google Drive menolak menghapus folder yang berisi berkas yang TIDAK dibuat
//   oleh aplikasi ini:
//       HTTP 403 appNotAuthorizedToChild —
//       "The user has not granted the app <client> write access to the child file …"
//   Folder yang dibuat backend Apps Script selalu masuk kategori itu, sehingga
//   sandbox yang berisi folder uji TIDAK dapat dihapus otomatis oleh skrip.
//   Skrip melaporkannya jujur sebagai "perlu tindakan manual" (exit 2) beserta
//   tautan folder, dan tidak pernah menyatakan pembersihan berhasil palsu.
//
// Pakai:
//   node scripts/smoke-drive-prod.mjs                 # tampilkan rencana saja
//   node scripts/smoke-drive-prod.mjs --confirm       # jalankan uji produksi
//   node scripts/smoke-drive-prod.mjs --confirm --sandbox <folderId>
//                                                     # pakai ulang sandbox yang ada
//
// Kode keluar: 0 = semua lulus & bersih · 1 = ada pemeriksaan gagal ·
//              2 = pemeriksaan lulus tetapi sandbox perlu dihapus manual.
//
// Prasyarat (sekali saja): npx --yes @google/clasp@3 login
// Akun uji harus SUPERADMIN (lihat APII_TEST_USER / APII_TEST_PASS).
//
// Catatan: jejak audit (WORM) akan memuat DRIVE_FOLDER_CREATED/DRIVE_FOLDER_MOVED/
// DRIVE_STORAGE_RESET dari uji ini — memang begitu desainnya agar terlihat di UI.
// ============================================================================
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ARGS = process.argv.slice(2);
const CONFIRM = ARGS.includes('--confirm');
const ROOT = process.cwd();
const MARKER = 'UJI-OTOMATIS-APII';
const SUBFOLDERS = ['Surat_Resmi', 'Surat_Lampiran', 'Keuangan_Bukti_Nota', 'Pendaftaran_KTP', 'Pendaftaran_Selfie'];
const DEFAULT_FOLDER_NAME = 'APII Jabo - PDF Surat Resmi';
const sandboxArgIdx = ARGS.findIndex((a) => a === '--sandbox');
const SANDBOX_ARG = sandboxArgIdx !== -1 ? String(ARGS[sandboxArgIdx + 1] || '') : '';

if (ARGS.includes('--help') || ARGS.includes('-h')) {
  console.log(`Pakai: node scripts/smoke-drive-prod.mjs [--confirm] [--sandbox <folderId>]

  (tanpa opsi)       Tampilkan rencana uji tanpa menyentuh apa pun.
  --confirm          Jalankan uji sungguhan (membuat folder uji, mengubah lalu
                     memulihkan folder aktif produksi, lalu membersihkan).
  --sandbox <id>     Pakai ulang folder sandbox yang sudah ada (namanya wajib
                     diawali "${MARKER}") alih-alih membuat yang baru.
  --help, -h         Bantuan ini.

Kode keluar: 0 lulus & bersih · 1 ada pemeriksaan gagal · 2 perlu hapus manual.`);
  process.exit(0);
}

const step = (n, m) => console.log(`\n[${n}] ${m}`);
const ok = (m) => console.log(`    ✔ ${m}`);
const info = (m) => console.log(`    · ${m}`);
const warn = (m) => console.log(`    ! ${m}`);
const bad = (m) => console.log(`    ✘ ${m}`);

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`    PASS  ${name}`); }
  else { fail++; console.log(`    FAIL  ${name} ${extra}`); }
  return Boolean(cond);
}

// ---------------------------------------------------------------------------
// Bahan dasar: URL API dari config portal + kredensial clasp untuk Drive API
// ---------------------------------------------------------------------------
function apiBase() {
  for (const file of ['portal/config.js', 'public/config.js']) {
    const p = join(ROOT, file);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec/);
    if (m) return m[0];
  }
  return '';
}

function claspCredentials() {
  const p = join(homedir(), '.clasprc.json');
  if (!existsSync(p)) return null;
  try {
    const cred = JSON.parse(readFileSync(p, 'utf8'));
    return (cred.tokens && cred.tokens.default) || cred.token || null;
  } catch { return null; }
}

const API = apiBase();
const cred = claspCredentials();

console.log('============================================================');
console.log(' UJI AMAN GOOGLE DRIVE — SIAP APII DPW Jabodetabek');
console.log(` Mode: ${CONFIRM ? 'UJI PRODUKSI' : 'RENCANA (tidak menyentuh apa pun)'}`);
console.log('============================================================');

if (!API) {
  console.error('\n✘ URL backend tidak ditemukan di portal/config.js (window.API_BASE).');
  process.exit(1);
}
if (!cred || !cred.refresh_token) {
  console.error('\n✘ Kredensial clasp tidak ditemukan (~/.clasprc.json).');
  console.error('  Jalankan sekali: npx --yes @google/clasp@3 login');
  process.exit(1);
}

if (!CONFIRM) {
  console.log(`
 Rencana yang akan dijalankan (tanpa menyentuh apa pun sekarang):

   1. Snapshot produksi: folder aktif + sidik jari konten publik.
   2. ${SANDBOX_ARG ? `Pakai ulang sandbox ${SANDBOX_ARG}` : `Buat folder sandbox "${MARKER}-<stempel>" lewat Drive API`}.
   3. createDriveFolder → folder A di dalam sandbox; uji 5 subfolder standar,
      izin tulis, dan perpindahan folder aktif.
   4. createDriveFolder → folder B di dalam sandbox.
   5. moveDriveFolder   → tanpa parent (harus ditolak), parent = folder aktif
      (harus ditolak), lalu memindahkan B ke dalam A (dibuktikan lewat Drive API).
   6. resetDriveStorage → folder aktif harus kembali ke default sistem.
      Bila sistem membuat folder default baru, folder itu dipindah ke sandbox.
   7. Pulihkan folder aktif produksi ke nilai snapshot dan verifikasi ulang
      (konfigurasi + sidik jari konten publik harus identik lagi).
   8. Bersihkan sandbox. Bila Google menolak (folder uji berisi folder buatan
      backend — lihat catatan batasan di berkas ini), skrip berhenti dengan
      tautan folder + status "perlu hapus manual", bukan klaim palsu.

 Jalankan ulang dengan --confirm untuk mengeksekusi.
`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Helper HTTP & Drive
// ---------------------------------------------------------------------------
const post = async (action, payload, token) => {
  const r = await fetch(`${API}?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token: token || null, payload: payload || {} }),
    redirect: 'follow'
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { success: false, message: `respons bukan JSON: ${t.slice(0, 200)}` }; }
};

let accessToken = '';
async function driveToken() {
  if (accessToken) return accessToken;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cred.client_id, client_secret: cred.client_secret,
      refresh_token: cred.refresh_token, grant_type: 'refresh_token'
    })
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('refresh token ditolak — jalankan ulang: npx --yes @google/clasp@3 login');
  accessToken = j.access_token;
  return accessToken;
}

async function drive(method, path, body) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    method,
    headers: Object.assign({ Authorization: `Bearer ${await driveToken()}` },
      body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  const reason = json && json.error && json.error.errors && json.error.errors[0]
    ? json.error.errors[0].reason : '';
  return { status: r.status, json, reason, text: text.replace(/\s+/g, ' ').slice(0, 220) };
}

async function folderMeta(id) {
  const r = await drive('GET', `files/${id}?fields=id,name,parents,trashed`);
  return r.json || null;
}

async function listChildren(folderId, mime) {
  const parts = [`'${folderId}' in parents`, 'trashed=false'];
  if (mime) parts.push(`mimeType='${mime}'`);
  const r = await drive('GET',
    `files?q=${encodeURIComponent(parts.join(' and '))}&fields=files(id,name,mimeType)&pageSize=100`);
  return (r.json && r.json.files) || [];
}

async function listMarked() {
  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name contains '${MARKER}'`);
  const r = await drive('GET', `files?q=${q}&fields=files(id,name,parents,trashed)&pageSize=100`);
  return (r.json && r.json.files) || [];
}

const folderUrl = (id) => `https://drive.google.com/drive/folders/${id}`;
const username = process.env.APII_TEST_USER || 'superadmin';
const password = process.env.APII_TEST_PASS || 'apii2026';

// ===========================================================================
// 1) Snapshot konfigurasi produksi
// ===========================================================================
step(1, 'Snapshot konfigurasi produksi');
const login = await post('login', { username, password });
const authToken = login.data && login.data.token;
if (!authToken) {
  bad(`login gagal untuk "${username}": ${login.message || JSON.stringify(login).slice(0, 140)}`);
  process.exit(1);
}
ok(`login sebagai ${login.data.user.username} (${login.data.user.role})`);

const settings0 = await post('getSettings', {}, authToken);
const snapSettings = (settings0.data && (settings0.data.settings || settings0.data)) || {};
const snapFolderId = String(snapSettings.google_drive_folder_id || '');
const snapDrive = snapSettings.drive_storage || {};
const active0 = await post('testDriveStorage', {}, authToken);
const snapActiveId = (active0.data && active0.data.folder_id) || '';
const snapActiveName = (active0.data && active0.data.folder_name) || '';

const pub0 = await post('getPublicSettings', {});
// Riwayat versi redaksi dipakai untuk membedakan "konten berubah karena\n// pengurus lain menyimpan" dari "konten berubah tanpa jejak".
const hist0 = await post('getEditorialHistory', {}, authToken);
const histIds0 = new Set(((hist0.data && hist0.data.items) || []).map((i) => i.id));
const fingerprint = (o) => {
  const s = JSON.stringify((o.data && o.data.editorial) || null);
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return `${(h >>> 0).toString(16)}:${s.length}`;
};
const fp0 = fingerprint(pub0);

info(`folder aktif      : ${snapActiveName} (${snapFolderId})`);
info(`drive_storage     : ${JSON.stringify(snapDrive)}`);
info(`sidik jari konten : ${fp0}`);
check('snapshot lengkap (folder aktif terbaca)', Boolean(snapActiveId), `(data: ${JSON.stringify(active0.data)})`);

const canRestore = Boolean(snapDrive.custom_folder_id || snapFolderId);
if (!canRestore) {
  warn('Produksi memakai folder DEFAULT (tanpa custom_folder_id) → uji resetDriveStorage dilewati');
  warn('agar tidak ada folder default duplikat yang ditinggalkan.');
}

// ===========================================================================
// 2) Folder sandbox
// ===========================================================================
step(2, SANDBOX_ARG ? `Pakai ulang sandbox ${SANDBOX_ARG}` : 'Buat folder sandbox milik uji');
let sandboxId = SANDBOX_ARG;
let sandboxName = '';
if (SANDBOX_ARG) {
  const meta = await folderMeta(SANDBOX_ARG);
  if (!meta) {
    bad(`sandbox ${SANDBOX_ARG} tidak ditemukan / bukan folder.`);
    process.exit(1);
  }
  sandboxName = meta.name || '';
  if (!sandboxName.startsWith(MARKER)) {
    bad(`folder ${SANDBOX_ARG} bernama "${sandboxName}" — bukan folder uji (wajib diawali ${MARKER}). Dibatalkan.`);
    process.exit(1);
  }
  check('sandbox lama masih ada & memang folder uji', true);
  ok(`sandbox: ${sandboxName} → ${folderUrl(sandboxId)}`);
} else {
  const now = new Date();
  const pad2 = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}`;
  sandboxName = `${MARKER}-${stamp}`;
  const made = await drive('POST', 'files', { name: sandboxName, mimeType: 'application/vnd.google-apps.folder' });
  sandboxId = made.json && made.json.id;
  check('folder sandbox dibuat lewat Drive API', made.status === 200 && Boolean(sandboxId),
    `(HTTP ${made.status} ${made.text})`);
  if (!sandboxId) { bad('tidak dapat melanjutkan tanpa sandbox'); process.exit(1); }
  ok(`sandbox: ${sandboxName} → ${folderUrl(sandboxId)}`);
}

const made = { aId: '', bId: '', movedToSandboxId: '' };
let restored = false;
let cleanupManual = false;

async function restoreConfig() {
  const r = await post('saveSettings', {
    settings: { google_drive_folder_id: snapDrive.custom_folder_id || snapFolderId, drive_storage: snapDrive }
  }, authToken);
  const after = await post('getSettings', {}, authToken);
  const s = (after.data && (after.data.settings || after.data)) || {};
  const active = await post('testDriveStorage', {}, authToken);
  const back = String(s.google_drive_folder_id || '') === snapFolderId &&
    (active.data && active.data.folder_id) === snapActiveId;
  return { r, back, active };
}

try {
  // =========================================================================
  // 3) createDriveFolder (A)
  // =========================================================================
  step(3, 'createDriveFolder — folder A di dalam sandbox');
  const aName = `${sandboxName}-A-${Date.now().toString().slice(-5)}`;
  const a = await post('createDriveFolder', { folder_name: aName, parent_folder_id: sandboxId }, authToken);
  check('createDriveFolder menjawab sukses', a.success === true && Boolean(a.data && a.data.folder_id), `(${a.message})`);
  check('pesan menyebut folder berhasil dibuat', /berhasil dibuat/.test(a.message || ''), `(${a.message})`);
  made.aId = (a.data && a.data.folder_id) || '';
  if (made.aId) ok(`folder A: ${folderUrl(made.aId)}`);

  const kids = made.aId ? await listChildren(made.aId, 'application/vnd.google-apps.folder') : [];
  const kidNames = kids.map((k) => k.name).sort();
  check('5 subfolder standar dibuat di dalam A', JSON.stringify(kidNames) === JSON.stringify([...SUBFOLDERS].sort()),
    `(ditemukan: ${JSON.stringify(kidNames)})`);

  const aMeta = made.aId ? await folderMeta(made.aId) : null;
  check('A berada DI DALAM sandbox (bukan di My Drive)', ((aMeta && aMeta.parents) || []).includes(sandboxId),
    `(parents: ${JSON.stringify(aMeta && aMeta.parents)})`);

  const st1 = await post('getSettings', {}, authToken);
  const s1 = (st1.data && (st1.data.settings || st1.data)) || {};
  check('folder aktif produksi berpindah ke A', String(s1.google_drive_folder_id || '') === made.aId,
    `(aktif: ${s1.google_drive_folder_id})`);
  const tw = await post('testDriveStorage', { folder_id: made.aId }, authToken);
  check('A dapat ditulisi (uji izin tulis)', /izin tulis aktif/.test(tw.message || ''), `(${tw.message})`);

  // =========================================================================
  // 4) createDriveFolder (B)
  // =========================================================================
  step(4, 'createDriveFolder — folder B di dalam sandbox');
  const bName = `${sandboxName}-B-${Date.now().toString().slice(-5)}`;
  const b = await post('createDriveFolder', { folder_name: bName, parent_folder_id: sandboxId }, authToken);
  check('createDriveFolder kedua sukses', b.success === true && Boolean(b.data && b.data.folder_id), `(${b.message})`);
  made.bId = (b.data && b.data.folder_id) || '';
  if (made.bId) ok(`folder B: ${folderUrl(made.bId)}`);

  // =========================================================================
  // 5) moveDriveFolder
  // =========================================================================
  step(5, 'moveDriveFolder — penjagaan & pemindahan nyata');
  const guard1 = await post('moveDriveFolder', {}, authToken);
  check('tanpa parent ditolak dengan pesan jelas',
    guard1.success === false && /wajib diisi/.test(guard1.message || ''), `(${guard1.message})`);
  const guard2 = await post('moveDriveFolder', { parent_folder_id: made.bId }, authToken);
  check('parent = folder aktif ditolak',
    guard2.success === false && /tidak boleh sama/.test(guard2.message || ''), `(${guard2.message})`);

  const mv = await post('moveDriveFolder', { parent_folder_id: made.aId }, authToken);
  check('pemindahan B ke dalam A sukses', mv.success === true && /berhasil dipindahkan/.test(mv.message || ''), `(${mv.message})`);
  const bMeta = made.bId ? await folderMeta(made.bId) : null;
  check('Drive membuktikan B kini berinduk A', ((bMeta && bMeta.parents) || []).includes(made.aId),
    `(parents: ${JSON.stringify(bMeta && bMeta.parents)})`);

  // =========================================================================
  // 6) resetDriveStorage
  // =========================================================================
  if (canRestore) {
    step(6, `resetDriveStorage — harus kembali ke default "${DEFAULT_FOLDER_NAME}"`);
    const rs = await post('resetDriveStorage', {}, authToken);
    const rsName = (rs.data && rs.data.folder_name) || '';
    check('reset menjawab sukses', rs.success === true && Boolean(rs.data && rs.data.folder_id), `(${rs.message})`);
    check('folder yang dipakai benar-benar folder DEFAULT sistem (bukan folder custom lama)',
      rsName === DEFAULT_FOLDER_NAME,
      `(dilaporkan: "${rsName}" — folder custom masih terbaca oleh siapkanFolderPdf_)`);

    const st2 = await post('getSettings', {}, authToken);
    const s2 = (st2.data && (st2.data.settings || st2.data)) || {};
    check('konfigurasi tercatat kembali ke default (custom_folder_id kosong)',
      String((s2.drive_storage || {}).custom_folder_id || '') === '' && String(s2.google_drive_folder_id || '') === '',
      `(${JSON.stringify(s2.drive_storage)})`);

    // Folder default yang SUDAH ADA sebelum reset (mis. dibuat setup()) harus
    // DIPAKAI ULANG, bukan ditumpuk. Catat dulu agar bisa dibedakan.
    const qDefault = encodeURIComponent(
      `mimeType='application/vnd.google-apps.folder' and name='${DEFAULT_FOLDER_NAME}'`);
    const before = ((await drive('GET', `files?q=${qDefault}&fields=files(id,name,trashed)&pageSize=100`)).json || {}).files || [];
    const beforeIds = new Set(before.filter((f) => !f.trashed).map((f) => f.id));

    const activeNow = await post('testDriveStorage', {}, authToken);
    const activeId = (activeNow.data && activeNow.data.folder_id) || '';

    if (beforeIds.size) {
      check('reset memakai ulang folder default yang sudah ada (tidak membuat duplikat)',
        beforeIds.has(activeId), `(aktif: ${activeId}; sudah ada: ${[...beforeIds].join(', ')})`);
    } else {
      info('belum ada folder default sebelum reset — sistem wajar membuat satu folder baru.');
    }

    if (activeId && !beforeIds.has(activeId)) {
      // Folder default BARU buatan sistem → pindahkan ke sandbox supaya tidak
      // meninggalkan sampah di My Drive. Folder yang sudah ada tidak disentuh.
      const mv2 = await post('moveDriveFolder', { parent_folder_id: sandboxId }, authToken);
      const dMeta = activeId ? await folderMeta(activeId) : null;
      const inSandbox = ((dMeta && dMeta.parents) || []).includes(sandboxId);
      made.movedToSandboxId = inSandbox ? activeId : '';
      info(`folder default BARU dipindahkan ke sandbox: ${inSandbox ? 'ya' : 'tidak'} (${mv2.message})`);
    } else if (activeId) {
      info('folder default lama dipakai ulang — tidak ada folder baru yang perlu dibersihkan.');
    }
  } else {
    step(6, 'resetDriveStorage — DILEWATI (produksi memakai folder default; lihat catatan di atas)');
  }

  // =========================================================================
  // 7) Pulihkan konfigurasi produksi
  // =========================================================================
  step(7, 'Pulihkan folder aktif produksi ke kondisi snapshot');
  const rest = await restoreConfig();
  check('saveSettings (gunakan folder yang ada) sukses', rest.r.success === true, `(${rest.r.message})`);
  check('folder aktif kembali seperti semula', rest.back === true,
    `(aktif: ${rest.active.data && rest.active.data.folder_name} / ${rest.active.data && rest.active.data.folder_id})`);
  restored = rest.back;

  const pub1 = await post('getPublicSettings', {});
  const fp1 = fingerprint(pub1);
  if (fp1 === fp0) {
    check('konten publik tidak berubah (sidik jari sama)', true, '');
  } else {
    // Konten redaksi TIDAK pernah ditulis oleh uji ini. Bila berubah, cek apakah
    // ada versi riwayat baru (penyimpanan sah dari portal) atau tidak (mencurigakan).
    const hist1 = await post('getEditorialHistory', {}, authToken);
    const baru = ((hist1.data && hist1.data.items) || []).filter((i) => !histIds0.has(i.id));
    if (baru.length) {
      warn(`konten publik berubah saat uji berjalan (${fp1} vs ${fp0}) — ada ${baru.length} versi riwayat baru:`);
      baru.slice(0, 3).forEach((v) => info(`   ${v.saved_at} | ${v.action} | ${v.saved_by} | ${v.label}`));
      info('  → penyimpanan dari portal oleh pihak lain; BUKAN akibat uji ini (uji hanya menyentuh pengaturan Drive).');
    } else {
      check('konten publik tidak berubah (sidik jari sama)', false,
        `(${fp1} vs ${fp0}) — berubah TANPA versi riwayat baru: periksa apakah Sheet_Settings disunting manual.`);
    }
  }
} catch (err) {
  bad(`uji terhenti: ${err.message}`);
  fail++;
} finally {
  // =======================================================================
  // 8) Pembersihan otomatis
  // =======================================================================
  step(8, 'Pembersihan otomatis');
  if (!restored) {
    cleanupManual = true;
    warn('Konfigurasi produksi BELUM terbukti pulih — pembersihan dibatalkan agar tidak ada yang hilang.');
    warn(`Periksa manual: ${folderUrl(sandboxId)}`);
  } else {
    const delA = await drive('DELETE', `files/${made.aId}`);
    const delB = await drive('DELETE', `files/${made.bId}`);
    const delS = await drive('DELETE', `files/${sandboxId}`);
    info(`hapus A=${delA.status}${delA.reason ? ' ' + delA.reason : ''} | ` +
         `hapus B=${delB.status}${delB.reason ? ' ' + delB.reason : ''} | ` +
         `hapus sandbox=${delS.status}${delS.reason ? ' ' + delS.reason : ''}`);

    if (delS.status === 204) {
      const sisa = (await listMarked()).filter((f) => f.id === sandboxId);
      check('sandbox terhapus dari Drive', sisa.length === 0);
      ok(`sandbox beserta isinya dibersihkan: ${sandboxName}`);
    } else {
      // Batasan Drive yang sudah terbukti: folder uji berisi folder buatan
      // backend → klien uji tidak punya izin menghapus turunannya.
      const limited = delS.reason === 'appNotAuthorizedToChild';
      cleanupManual = true;
      warn(`Drive menolak menghapus sandbox (HTTP ${delS.status}${delS.reason ? ' ' + delS.reason : ''}).`);
      if (limited) {
        warn('Sebabnya batasan Google: app ini tidak punya izin atas folder yang dibuat backend Apps Script,');
        warn('sehingga folder tersebut tidak bisa dihapus oleh kredensial uji — bukan kesalahan backend.');
      }
      warn(`Tindakan manual (1 kali): buka ${folderUrl(sandboxId)} lalu hapus folder "${sandboxName}".`);
    }
  }
}

console.log('\n============================================================');
console.log(` Hasil: ${pass} lulus, ${fail} gagal.`);
console.log(` Folder aktif produksi: ${restored ? 'PULIH ✓' : 'PERLU DIPERIKSA MANUAL'}`);
console.log(` Pembersihan sandbox  : ${cleanupManual ? 'PERLU TINDAKAN MANUAL (lihat langkah 8)' : 'selesai otomatis'}`);
console.log(' Jejak audit (WORM) dari uji ini tetap tersimpan dan dapat dilihat pengurus.');
console.log('============================================================');
if (fail > 0) process.exit(1);
if (cleanupManual || !restored) process.exit(2);
