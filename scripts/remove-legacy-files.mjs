// ============================================================================
// remove-legacy-files.mjs — Menghapus berkas LAMA di editor Apps Script lewat
// Apps Script API (projects.updateContent), tanpa klik manual di editor.
// ============================================================================
// Latar belakang: `clasp push` mengirim seluruh berkas lokal ke
// projects.updateContent, dan API itu MENGGANTI seluruh isi project — jadi
// berkas yang tidak ada di apps-script/ ikut terhapus (terbukti pada rilis
// Versi 14, 2026-10-10). Skrip ini menutup kasus sisa: bila setelah push masih
// ada berkas lama (clasp versi lebih lama, unggahan sebagian, atau berkas yang
// ditambahkan manual di editor), sisa itu dibersihkan langsung lewat API.
//
// Prinsip aman:
//   1. Hanya berkas SERVER_JS yang SELURUH simbol globalnya sudah ada di modul
//      baru yang boleh dihapus — kalau ada satu simbol yang belum pindah,
//      berkas itu DITOLAK (dilaporkan, tidak disentuh).
//   2. Berkas JSON (manifest) dan HTML tidak pernah dihapus otomatis.
//   3. Isi berkas yang dipertahankan dikirim APA ADANYA (tidak menyentuh kode),
//      jadi pembersihan tidak pernah sekaligus mengubah kode.
//   4. Mode default = rencana (tidak menulis); tulis hanya dengan --yes.
//   5. Setelah menulis, isi project dibaca ulang dan dibandingkan dengan
//      rencana — kegagalan diverifikasi, bukan diasumsikan.
//
// Pakai:
//   node scripts/remove-legacy-files.mjs                  (rencana saja)
//   node scripts/remove-legacy-files.mjs --yes            (bersihkan)
//   node scripts/remove-legacy-files.mjs --json           (untuk skrip lain)
//   node scripts/remove-legacy-files.mjs --self-test-write (uji jalur tulis:
//        kirim ulang isi project tanpa perubahan, lalu buktikan identik)
//
// Kode keluar: 0 tidak ada sisa / pembersihan terverifikasi
//              1 ada berkas yang DITOLAK dihapus (perlu tindakan manusia)
//              2 tidak dapat dijalankan (kredensial / API / build)
//
// Catatan: operasi ini hanya menyentuh ISI PROJECT (HEAD), bukan versi rilis —
// deployment produksi tetap menyajikan versi yang sudah dibuat.
// ============================================================================
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globalSymbols } from './check-legacy-duplicates.mjs';

const API = 'https://script.googleapis.com/v1/projects';

// ---------------------------------------------------------------------------
// Fungsi murni (dipakai juga oleh uji smoke)
// ---------------------------------------------------------------------------
/** Nama berkas lokal hasil build → nama+kunci berkas di editor Apps Script. */
export function serverFileOf(localName) {
  if (localName === 'appsscript.json') return { name: 'appsscript', type: 'JSON' };
  if (localName.endsWith('.gs')) return { name: localName.slice(0, -3), type: 'SERVER_JS' };
  return null;
}

/**
 * Menyusun rencana pembersihan.
 * @param {object} p
 * @param {Array<{name:string,type:string,source:string}>} p.remote  isi project sekarang
 * @param {string[]} p.buildFiles  nama berkas lokal hasil build (mis. Auth.gs)
 * @param {Map<string, unknown>} p.buildSymbols  simbol global modul baru
 * @returns {{ keep: object[], removable: object[], refused: object[], legacy: object[] }}
 */
export function planCleanup({ remote, buildFiles, buildSymbols }) {
  const expected = new Set(buildFiles.map((f) => serverFileOf(f)).filter(Boolean).map((e) => `${e.type}:${e.name}`));
  const legacy = remote.filter((f) => !expected.has(`${f.type}:${f.name}`));
  const removable = [];
  const refused = [];
  for (const f of legacy) {
    if (f.type !== 'SERVER_JS') {
      refused.push({ name: f.name, type: f.type, reason: `jenis berkas ${f.type} tidak dihapus otomatis (periksa manual)` });
      continue;
    }
    const syms = globalSymbols(f.source || '');
    const missing = syms.filter((s) => !buildSymbols.has(s.name));
    if (missing.length) {
      refused.push({
        name: f.name, type: f.type, bytes: (f.source || '').length,
        reason: `${missing.length} simbol belum ada di modul baru — JANGAN dihapus`,
        missing: missing.map((s) => `${s.name} (baris ${s.line})`),
      });
      continue;
    }
    removable.push({
      name: f.name, type: f.type, bytes: (f.source || '').length,
      symbols: syms.length,
      reason: `seluruh ${syms.length} simbolnya sudah ada di modul baru`,
    });
  }
  const removableKeys = new Set(removable.map((f) => `${f.type}:${f.name}`));
  const keep = remote.filter((f) => !removableKeys.has(`${f.type}:${f.name}`));
  return { keep, removable, refused, legacy };
}

/** Sidik jari isi project (untuk membuktikan tidak ada yang berubah). */
export function fingerprint(files) {
  return files
    .map((f) => `${f.type}:${f.name}:${createHash('sha256').update(f.source || '').digest('hex')}`)
    .sort()
    .join('\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const main = async () => {
  const ARGS = process.argv.slice(2);
  const argOf = (n) => {
    const i = ARGS.indexOf(n);
    return i !== -1 && ARGS[i + 1] && !ARGS[i + 1].startsWith('-') ? ARGS[i + 1] : null;
  };
  const APPLY = ARGS.includes('--yes') || ARGS.includes('-y');
  const AS_JSON = ARGS.includes('--json');
  const QUIET = ARGS.includes('--quiet');
  const SELF_TEST = ARGS.includes('--self-test-write');
  const BUILD_DIR = resolve(argOf('--build') || 'apps-script');
  const FROM_JSON = argOf('--from-json');

  if (ARGS.includes('--help') || ARGS.includes('-h')) {
    console.log(`Membersihkan berkas lama di editor Apps Script langsung lewat Apps Script API.

Pakai: node scripts/remove-legacy-files.mjs [opsi]

  --yes, -y           Lakukan pembersihan (tanpa ini hanya mencetak rencana)
  --json              Keluarkan hasil sebagai JSON (dipakai scripts/deploy-gas.mjs)
  --build <dir>       Folder hasil build yang jadi acuan (default: apps-script)
  --from-json <file>  Pakai isi project dari berkas JSON (untuk uji/offline)
  --self-test-write   Uji jalur tulis: kirim ulang isi project tanpa perubahan,
                      lalu baca ulang dan buktikan hasilnya identik
  --quiet             Hanya ringkasan
  --help, -h          Bantuan ini

Kode keluar: 0 bersih/terverifikasi · 1 ada berkas yang ditolak dihapus · 2 gagal dijalankan.`);
    process.exit(0);
  }

  const log = (...m) => { if (!AS_JSON) console.log(...m); };
  const ok = (m) => log(`OK   ${m}`);
  const warn = (m) => log(`!    ${m}`);
  const bad = (m) => log(`FAIL ${m}`);
  const info = (m) => log(`     ${m}`);

  const out = (status, payload, human) => {
    if (AS_JSON) console.log(JSON.stringify(payload, null, 2));
    else human();
    process.exit(status === 'clean' || status === 'removed' || status === 'planned' ? 0 : status === 'blocked' ? 1 : 2);
  };
  const unverified = (reason, hint) => out('unverified', { status: 'unverified', reason, hint }, () => {
    console.log('\n=== Bersihkan berkas lama di editor Apps Script (Apps Script API) ===');
    console.log(`\nFAIL Tidak dapat dijalankan: ${reason}`);
    if (hint) console.log(`     → ${hint}`);
  });

  // --- Kredensial & konfigurasi -------------------------------------------
  let scriptId = '';
  if (existsSync('.clasp.json')) {
    try {
      const j = JSON.parse(readFileSync('.clasp.json', 'utf8'));
      if (j.scriptId) scriptId = j.scriptId;
    } catch { /* pesan jelas menyusul */ }
  }
  if (!scriptId && process.env.GAS_SCRIPT_ID) scriptId = process.env.GAS_SCRIPT_ID;
  if (!scriptId) {
    for (const f of ['.env', '.env.local']) {
      if (!existsSync(f)) continue;
      const m = readFileSync(f, 'utf8').match(/^\s*GAS_SCRIPT_ID\s*=\s*(.+)$/m);
      if (m) { scriptId = m[1].trim().replace(/^["']|["']$/g, ''); break; }
    }
  }
  if (!scriptId && !FROM_JSON) {
    unverified('Script ID tidak ditemukan', 'Isi .clasp.json atau GAS_SCRIPT_ID di .env (lihat scripts/deploy-gas.mjs langkah 1).');
  }

  // Token akses dari kredensial clasp yang sudah ada (tanpa menyentuh berkas).
  let cred = null;
  if (!FROM_JSON) {
    const p = join(homedir(), '.clasprc.json');
    if (existsSync(p)) {
      try {
        const j = JSON.parse(readFileSync(p, 'utf8'));
        cred = (j.tokens && j.tokens.default) || j.token || null;
      } catch { cred = null; }
    }
    if (!cred || !cred.refresh_token) {
      unverified('kredensial clasp tidak ditemukan (~/.clasprc.json)',
        'Jalankan sekali: npx --yes @google/clasp@3 login');
    }
  }

  let accessToken = '';
  const token = async () => {
    if (accessToken) return accessToken;
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: cred.client_id, client_secret: cred.client_secret,
        refresh_token: cred.refresh_token, grant_type: 'refresh_token',
      }),
    });
    const j = await r.json();
    if (!j.access_token) {
      unverified('refresh token ditolak Google',
        'Jalankan ulang: npx --yes @google/clasp@3 login');
    }
    accessToken = j.access_token;
    return accessToken;
  };

  const apiCall = async (method, body) => {
    const r = await fetch(`${API}/${scriptId}/content`, {
      method,
      headers: Object.assign({ Authorization: `Bearer ${await token()}` },
        body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { json = null; }
    return { status: r.status, json, text };
  };

  // --- Isi project sekarang ------------------------------------------------
  let remote = [];
  if (FROM_JSON) {
    try {
      const j = JSON.parse(readFileSync(resolve(FROM_JSON), 'utf8'));
      remote = j.files || j;
    } catch (e) {
      unverified(`tidak dapat membaca ${FROM_JSON}: ${e.message}`, 'Berkas itu harus memuat {"files":[...]} hasil projects.getContent.');
    }
  } else {
    const res = await apiCall('GET');
    if (res.status !== 200 || !res.json || !res.json.files) {
      unverified(`projects.getContent menolak permintaan (HTTP ${res.status})`,
        `${(res.json && (res.json.error && res.json.error.message)) || res.text.slice(0, 160)} — pastikan Apps Script API aktif dan scope script.projects tersedia.`);
    }
    remote = res.json.files;
  }

  // --- Sisi build ----------------------------------------------------------
  if (!existsSync(BUILD_DIR)) {
    unverified(`folder hasil build tidak ditemukan: ${BUILD_DIR}`, 'Jalankan `npm run build:gas` lebih dahulu.');
  }
  const buildFiles = readdirSync(BUILD_DIR).filter((f) => f.endsWith('.gs') || f === 'appsscript.json').sort();
  const buildSymbols = new Map();
  for (const f of buildFiles.filter((x) => x.endsWith('.gs'))) {
    for (const s of globalSymbols(readFileSync(join(BUILD_DIR, f), 'utf8'))) buildSymbols.set(s.name, { file: f, kind: s.kind });
  }

  const plan = planCleanup({ remote, buildFiles, buildSymbols });

  // --- Uji jalur tulis (tanpa perubahan isi) -------------------------------
  if (SELF_TEST) {
    const before = fingerprint(remote);
    const res = await apiCall('PUT', { files: remote.map(({ name, type, source }) => ({ name, type, source })) });
    if (res.status !== 200) {
      unverified(`uji tulis gagal (HTTP ${res.status})`,
        `${(res.json && (res.json.error && res.json.error.message)) || res.text.slice(0, 160)}`);
    }
    const after = await apiCall('GET');
    const same = after.status === 200 && fingerprint(after.json.files) === before;
    out(same ? 'clean' : 'blocked', {
      status: same ? 'clean' : 'blocked', selfTest: true,
      files: remote.length, identical: same,
      before: before.slice(0, 12), after: after.status === 200 ? fingerprint(after.json.files).slice(0, 12) : null,
    }, () => {
      console.log('\n=== Uji jalur tulis (self-test) ===');
      console.log(`    ${remote.length} berkas dikirim ulang tanpa perubahan.`);
      if (same) ok('Isi project setelah tulis identik dengan sebelumnya (jalur tulis API terbukti bekerja).');
      else bad('Isi project BERUBAH setelah tulis ulang — periksa sebelum memakai pembersihan otomatis.');
    });
  }

  // --- Laporan rencana ------------------------------------------------------
  const human = () => {
    console.log('\n=== Bersihkan berkas lama di editor Apps Script (Apps Script API) ===');
    console.log(`    Isi project: ${remote.length} berkas · acuan build: ${buildFiles.length} berkas (${buildSymbols.size} simbol global)`);
    if (!plan.legacy.length) {
      ok('Tidak ada berkas lama di editor — tidak ada yang perlu dibersihkan.');
    }
    for (const f of plan.removable) {
      ok(`${f.name} (${f.bytes.toLocaleString('id-ID')} byte) dapat dihapus: ${f.reason}`);
    }
    for (const f of plan.refused) {
      bad(`${f.name} TIDAK dihapus: ${f.reason}`);
      if (!QUIET) for (const m of f.missing || []) info(`- ${m}`);
    }
    if (plan.removable.length && !APPLY) {
      console.log('\nMode rencana — belum ada yang dihapus. Jalankan dengan --yes untuk membersihkan.');
    }
  };

  if (!plan.removable.length) {
    out(plan.refused.length ? 'blocked' : 'clean', {
      status: plan.refused.length ? 'blocked' : 'clean',
      files: remote.length, removed: [], refused: plan.refused,
    }, human);
  }

  if (!APPLY) {
    const status = plan.refused.length ? 'blocked' : plan.removable.length ? 'planned' : 'clean';
    out(status, {
      status, dryRun: true,
      files: remote.length, removable: plan.removable, refused: plan.refused,
    }, human);
  }

  // --- Eksekusi ------------------------------------------------------------
  const before = fingerprint(remote);
  const res = await apiCall('PUT', { files: plan.keep.map(({ name, type, source }) => ({ name, type, source })) });
  if (res.status !== 200) {
    unverified(`projects.updateContent gagal (HTTP ${res.status})`,
      `${(res.json && (res.json.error && res.json.error.message)) || res.text.slice(0, 160)}`);
  }
  const after = await apiCall('GET');
  if (after.status !== 200 || !after.json || !after.json.files) {
    unverified('isi project tidak dapat dibaca ulang setelah pembersihan',
      'Jalankan `npm run check:legacy` untuk memeriksa keadaan terakhir.');
  }
  const afterNames = new Set(after.json.files.map((f) => `${f.type}:${f.name}`));
  const stillThere = plan.removable.filter((f) => afterNames.has(`${f.type}:${f.name}`));
  const keepChanged = plan.keep.filter((f) => {
    const now = after.json.files.find((x) => x.type === f.type && x.name === f.name);
    return !now || createHash('sha256').update(now.source || '').digest('hex') !== createHash('sha256').update(f.source || '').digest('hex');
  });
  const verified = !stillThere.length && !keepChanged.length;

  out(verified ? 'removed' : 'blocked', {
    status: verified ? 'removed' : 'blocked',
    files: after.json.files.length,
    removed: plan.removable.map((f) => ({ name: f.name, bytes: f.bytes, symbols: f.symbols })),
    refused: plan.refused,
    verified,
    stillThere: stillThere.map((f) => f.name),
    keepChanged: keepChanged.map((f) => f.name),
  }, () => {
    human();
    console.log('');
    for (const f of plan.removable) ok(`${f.name} dihapus dari editor (${f.bytes.toLocaleString('id-ID')} byte).`);
    if (!verified) {
      if (stillThere.length) bad(`masih ada setelah pembersihan: ${stillThere.map((f) => f.name).join(', ')}`);
      if (keepChanged.length) bad(`isi berubah pada berkas yang seharusnya utuh: ${keepChanged.map((f) => f.name).join(', ')}`);
    } else {
      ok(`Terverifikasi: project kini ${after.json.files.length} berkas, isi berkas lain tidak berubah.`);
      info('Versi rilis yang sedang tayang tidak terpengaruh (deployment tetap pada versi terakhir).');
    }
  });
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`FAIL kesalahan tak terduga: ${e.message}`);
    process.exit(2);
  });
}
