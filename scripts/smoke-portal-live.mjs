// ============================================================================
// smoke-portal-live.mjs — uji UI portal pengurus di PERAMBAN SUNGGUHAN
// terhadap sebuah ALAMAT (lokal atau preview deployment).
//
// Mengapa ada: `npm run smoke:portal:ui` menjalankan portal/auth.js +
// portal/portal.js di DOM tiruan — cepat dan tanpa jaringan, tetapi ia tidak
// pernah memuat halaman sungguhan. Tiga bug 2026-10-10 (penjaga demo memblokir
// aksi login, `self.bootApp is not a function`, tombol Masuk diam) semuanya
// hanya terlihat ketika peramban benar-benar merender halaman: urutan pemuatan
// skrip, klik sungguhan pada tombol, dan semantik `self === window`. Uji ini
// menutup celah itu dan dijalankan OTOMATIS sebelum push/publish.
//
// Cara kerja:
//   1. Menyajikan folder portal (default `portal/`, ubah dengan `--root`) lewat
//      server statis bawaan Node — tanpa dependensi — lalu memakai alamat itu,
//      ATAU memakai alamat yang diberikan (`--url`, mis. URL preview Vercel).
//   2. Meluncurkan peramban Chromium yang SUDAH terpasang di mesin (Chrome/Edge)
//      secara headless dan mengendalikannya lewat Chrome DevTools Protocol
//      (WebSocket bawaan Node 22+). Tidak ada paket npm baru, tidak ada unduhan
//      peramban.
//   3. Mengunci tiga hal yang paling sering rusak di halaman login:
//        - klik SUNGGUHAN pada tombol "Masuk sebagai Akun Demo" membuka aplikasi
//          (bukan pesan merah "self.bootApp is not a function");
//        - dengan sesi demo BASI tersimpan, formulir Masuk tetap sampai ke
//          server (bukan diblokir penjaga mode demo) dan aplikasi terbuka
//          sebagai akun non-demo;
//        - tidak ada galat/exception JS selama proses login.
//   4. Permintaan API DICEGAT di sisi halaman (fetch diganti stub) sehingga uji
//      ini tidak pernah menulis apa pun ke backend produksi. Sebagai sabuk
//      pengaman kedua, nama host API dipetakan ke alamat mati saat peluncuran,
//      jadi permintaan yang lolos stub sekalipun tidak akan menyentuh produksi.
//
// Pakai:
//   node scripts/smoke-portal-live.mjs                     # preview lokal (default)
//   node scripts/smoke-portal-live.mjs --url https://siapii-xxx.vercel.app
//   node scripts/smoke-portal-live.mjs --root /path/build  # uji hasil build lain
//   node scripts/smoke-portal-live.mjs --live              # uji SUNGGUHAN ke backend
//
// Mode `--live` (opsional, menulis ke produksi): tidak memakai stub — formulir
// diisi dengan kredensial dari `APII_TEST_USER` / `APII_TEST_PASS`, login
// dijalankan sungguhan, lalu sesi ditutup. Menulis dua baris audit
// (LOGIN_SUCCESS + LOGOUT) di spreadsheet produksi; karena itu HARUS diminta
// eksplisit dan tidak pernah dipakai oleh gerbang otomatis.
//
// Kode keluar: 0 lulus · 1 ada yang gagal · 2 TIDAK BISA DIJALANKAN
//   (peramban tidak ditemukan / alamat tidak bisa dibuka / kredensial --live
//   tidak diisi). Gerbang pra-push memperlakukan 2 sebagai "dilewati" dengan
//   alasan tercetak, bukan sebagai lulus maupun gagal.
// ============================================================================
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';

// ---------------------------------------------------------------------------
// Argumen
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const out = { url: '', root: 'portal', live: false, browser: '', timeout: 30000, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') out.url = String(argv[++i] || '');
    else if (a === '--root') out.root = String(argv[++i] || 'portal');
    else if (a === '--browser') out.browser = String(argv[++i] || '');
    else if (a === '--timeout') out.timeout = Number(argv[++i]) || out.timeout;
    else if (a === '--live') out.live = true;
    else if (a === '--verbose') out.verbose = true;
    else if (a === '--help' || a === '-h') { console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(0, 60).join('\n')); process.exit(0); }
  }
  return out;
}
const ARGS = parseArgs(process.argv.slice(2));

let pass = 0, fail = 0;
const info = [];
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' — ' + extra : ''}`); }
};
const catat = (msg) => { info.push(msg); if (ARGS.verbose) console.log(`  info  ${msg}`); };
const tidakBisaDijalankan = (sebab) => {
  console.log(`\nTIDAK BISA DIJALANKAN: ${sebab}`);
  console.log('Uji ini butuh peramban Chromium (Chrome/Edge) di mesin ini. Setel PORTAL_BROWSER bila lokasinya tidak lazim.');
  process.exit(2);
};

// ---------------------------------------------------------------------------
// Data uji (dipakai stub di sisi halaman)
// ---------------------------------------------------------------------------
const SANDI_UJI = 'uji-sandi-valid-123';
const USER_UJI = {
  id: 'u-uji', username: 'superadmin', full_name: 'Super Admin Uji', role: 'SUPERADMIN',
  role_label: 'Administrator Sistem', division: '', is_active: 'TRUE',
  permissions: ['*'], permissions_customized: false, is_demo: 'FALSE'
};
const USER_DEMO = {
  id: 'u-demo', username: 'demo', full_name: 'Akun Demo', role: 'DEMO',
  role_label: 'Akun Demo (Read-Only)', division: '', is_active: 'TRUE',
  permissions: ['getDashboard'], permissions_customized: false, is_demo: 'TRUE'
};
const HOST_API = 'script.google.com';

// ---------------------------------------------------------------------------
// Server statis bawaan (tanpa dependensi) — "alamat preview" lokal
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

/** @return {Promise<{url:string, close:()=>Promise<void>, root:string}>} */
function serveRoot(rootDir) {
  const root = resolve(rootDir);
  if (!existsSync(join(root, 'index.html'))) {
    tidakBisaDijalankan(`folder ${root} tidak memuat index.html`);
  }
  const server = createServer((req, res) => {
    const path = decodeURIComponent(String(req.url || '/').split('?')[0]);
    const wanted = path === '/' ? '/index.html' : path;
    const file = normalize(join(root, wanted));
    if (!file.startsWith(root + sep) && file !== root) { res.writeHead(403); res.end('dilarang'); return; }
    if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end('tidak ada'); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((resolvePromise, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolvePromise({
        root,
        url: `http://127.0.0.1:${port}/`,
        close: () => new Promise((r) => server.close(() => r()))
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Penemuan peramban (Chrome/Edge) — tidak ada unduhan apa pun
// ---------------------------------------------------------------------------
function cariPeramban() {
  const dariEnv = process.env.PORTAL_BROWSER || process.env.CHROME_PATH || ARGS.browser;
  const kandidat = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
      ]
    : process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          '/Applications/Chromium.app/Contents/MacOS/Chromium'
        ]
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome',
         '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
         '/usr/bin/microsoft-edge'];
  if (dariEnv) {
    if (!existsSync(dariEnv)) tidakBisaDijalankan(`peramban yang ditunjuk PORTAL_BROWSER tidak ada: ${dariEnv}`);
    return dariEnv;
  }
  const ada = kandidat.find((p) => existsSync(p));
  if (!ada) {
    tidakBisaDijalankan(`tidak menemukan Chrome/Edge di lokasi lazim (${process.platform}): ${kandidat.join(', ')}`);
  }
  return ada;
}

// ---------------------------------------------------------------------------
// Klien CDP minimal (WebSocket bawaan Node 22+)
// ---------------------------------------------------------------------------
function connectCdp(wsUrl) {
  return new Promise((resolvePromise, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    const listeners = [];
    let nextId = 1;
    const api = {
      /** Kirim perintah CDP; `sesi` untuk perintah ber-scope halaman. */
      send(method, params = {}, sesi) {
        const id = nextId++;
        const pesan = sesi ? { id, method, params, sessionId: sesi } : { id, method, params };
        ws.send(JSON.stringify(pesan));
        return new Promise((res, rej) => pending.set(id, { res, rej }));
      },
      on(fn) { listeners.push(fn); },
      close() { try { ws.close(); } catch (e) { /* sudah tertutup */ } }
    };
    ws.addEventListener('open', () => resolvePromise(api));
    ws.addEventListener('error', () => reject(new Error('gagal menyambung ke peramban (WebSocket CDP)')));
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id); pending.delete(msg.id);
        if (msg.error) p.rej(new Error(`${msg.error.message || 'galat CDP'} (${msg.error.code || '?'})`));
        else p.res(msg.result);
        return;
      }
      if (msg.method) listeners.forEach((fn) => fn(msg));
    });
  });
}

/** Jalankan peramban headless dan kembalikan handle + sesi CDP halaman kosong. */
async function launchBrowser(browserPath, { blokirApi }) {
  const profil = mkdtempSync(join(tmpdir(), 'apii-uji-ui-'));
  const args = [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--mute-audio', '--no-sandbox', '--disable-dev-shm-usage',
    '--window-size=1280,900', '--remote-debugging-port=0', `--user-data-dir=${profil}`,
    'about:blank'
  ];
  // Sabuk pengaman: permintaan yang lolos stub tetap tidak sampai ke backend.
  if (blokirApi) args.push(`--host-resolver-rules=MAP ${HOST_API} 127.0.0.1:1`);
  const proc = spawn(browserPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let buf = '';
  const wsUrl = await new Promise((res, rej) => {
    const batas = setTimeout(() => rej(new Error('peramban tidak melaporkan DevTools dalam 25 detik')),
      Math.max(25000, ARGS.timeout));
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(buf);
      if (m) { clearTimeout(batas); res(m[1]); }
    });
    proc.on('exit', (code) => {
      clearTimeout(batas);
      rej(new Error(`peramban keluar lebih awal (kode ${code}): ${buf.trim().split('\n').slice(-2).join(' | ') || 'tanpa pesan'}`));
    });
  });
  const cdp = await connectCdp(wsUrl);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  return {
    cdp, sessionId, targetId, proc,
    async close() {
      try { await cdp.send('Target.closeTarget', { targetId }); } catch (e) { /* diabaikan */ }
      cdp.close();
      try { proc.kill(); } catch (e) { /* sudah mati */ }
      // Profil sementara dihapus dengan percobaan ulang: di Windows peramban
      // kadang masih memegang berkasnya beberapa ratus milidetik setelah keluar,
      // dan folder yang tertinggal akan menumpuk di direktori sementara.
      for (let i = 0; i < 8; i++) {
        try {
          if (!existsSync(profil)) break;
          rmSync(profil, { recursive: true, force: true });
          break;
        } catch (e) {
          await new Promise((r) => setTimeout(r, 150));
        }
      }
      if (existsSync(profil)) catat(`profil sementara peramban belum bisa dihapus (dikunci proses lain): ${profil}`);
    }
  };
}

// ---------------------------------------------------------------------------
// Perekam konsol/jaringan + helper evaluasi
// ---------------------------------------------------------------------------
function buatPerekam() {
  const exceptions = [], consoleError = [], gagalMuatt = [], responsBuruk = [];
  const urlPermintaan = new Map();
  let fase = 'login';
  return {
    faseKe(f) { fase = f; },
    handle(msg) {
      const p = msg.params || {};
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = p.exceptionDetails || {};
        exceptions.push({ fase, teks: d.exception && (d.exception.description || d.exception.value) || d.text || 'exception', url: d.url });
      } else if (msg.method === 'Runtime.consoleAPICalled' && p.type === 'error') {
        consoleError.push({ fase, teks: (p.args || []).map((a) => a.value || a.description || a.type).join(' ') });
      } else if (msg.method === 'Log.entryAdded' && p.entry && p.entry.level === 'error') {
        consoleError.push({ fase, teks: p.entry.text || '', url: p.entry.url || '' });
      } else if (msg.method === 'Network.requestWillBeSent') {
        urlPermintaan.set(p.requestId, p.request && p.request.url);
      } else if (msg.method === 'Network.loadingFailed') {
        gagalMuatt.push({ fase, url: urlPermintaan.get(p.requestId) || '', error: p.errorText || '' });
      } else if (msg.method === 'Network.responseReceived') {
        const r = p.response || {};
        if (r.status >= 400) responsBuruk.push({ fase, status: r.status, url: r.url || '' });
      }
    },
    ringkas() { return { exceptions, consoleError, gagalMuatt, responsBuruk }; }
  };
}

/** Url CDN/font yang kegagalannya bukan cacat portal (mis. mesin tanpa internet). */
const hostDiabaikan = (url) => /cdn\.tailwindcss\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(String(url || ''));

function buatEvaluator(cdp, sessionId) {
  return async function evaluate(expr) {
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate',
      { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
    if (exceptionDetails) {
      throw new Error('evaluate gagal: ' + (exceptionDetails.exception?.description || exceptionDetails.text || 'exception'));
    }
    return result.value;
  };
}

async function tunggu(evaluate, expr, { timeout = ARGS.timeout, interval = 100, label = expr } = {}) {
  const batas = Date.now() + timeout;
  for (;;) {
    try { const v = await evaluate(expr); if (v) return v; } catch (e) { /* halaman belum siap */ }
    if (Date.now() > batas) throw new Error(`timeout menunggu: ${label}`);
    await new Promise((r) => setTimeout(r, interval));
  }
}

/** Klik SUNGGUHAN dengan tetikus (bukan .click() dari skrip). */
async function klikNyata(cdp, sessionId, evaluate, idPilih) {
  const kotak = await evaluate(`(() => {
    var el = ${idPilih};
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    var r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, hidden: el.classList.contains('hidden') };
  })()`);
  if (!kotak || kotak.w < 2 || kotak.h < 2) return null;
  const dasar = { x: Math.round(kotak.x), y: Math.round(kotak.y), button: 'left', clickCount: 1 };
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...dasar, buttons: 0 }, sessionId);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...dasar, buttons: 1 }, sessionId);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...dasar, buttons: 0 }, sessionId);
  return kotak;
}

// ---------------------------------------------------------------------------
// Skrip yang disuntikkan SEBELUM skrip halaman berjalan
// ---------------------------------------------------------------------------
function skripAwal({ seedDemo, stub }) {
  return `(() => {
  var DEMO = ${JSON.stringify(USER_DEMO)};
  var UJI = ${JSON.stringify(USER_UJI)};
  var SANDI = ${JSON.stringify(SANDI_UJI)};
  window.__uji = { calls: [], seedDemo: ${seedDemo ? 'true' : 'false'} };
  ${seedDemo ? `
  try {
    localStorage.setItem('siapii_token', 'tok-uji-demo');
    localStorage.setItem('siapii_user', JSON.stringify(DEMO));
  } catch (e) {}` : ''}
  ${stub ? `
  var asli = window.fetch;
  var balasan = function (action, body) {
    if (action === 'login') {
      if (body && body.username === UJI.username && body.password === SANDI) {
        return { success: true, data: { token: 'tok-uji-superadmin', expired_at: Date.now() + 3600000, user: UJI }, message: 'Login berhasil (stub uji UI).' };
      }
      return { success: false, data: null, message: 'Username atau password salah.' };
    }
    if (action === 'loginDemo') {
      return { success: true, data: { token: 'tok-uji-demo', expired_at: Date.now() + 3600000, user: DEMO }, message: 'Selamat datang di akun demo.' };
    }
    if (action === 'me') {
      var punya = localStorage.getItem('siapii_token');
      if (punya === 'tok-uji-superadmin') return { success: true, data: { user: UJI }, message: 'ok' };
      if (punya === 'tok-uji-demo') return { success: true, data: { user: DEMO }, message: 'ok' };
      return { success: false, data: null, message: 'Sesi tidak valid.' };
    }
    if (action === 'logout') return { success: true, data: null, message: 'Anda telah keluar.' };
    return { success: false, data: null, message: 'UJI: data ' + action + ' tidak disediakan harness.' };
  };
  window.fetch = function (url, opts) {
    var m = /[?&]action=([^&]+)/.exec(String(url || ''));
    var action = m ? decodeURIComponent(m[1]) : '';
    var body = {};
    try { body = (opts && opts.body) ? JSON.parse(opts.body) : {}; } catch (e) { body = {}; }
    window.__uji.calls.push({ action: action, method: (opts && opts.method) || 'GET', body: body, url: String(url || '') });
    var hasil = balasan(action, body.payload || body);
    return Promise.resolve(new Response(JSON.stringify(hasil), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  };` : `
  // Mode --live: fetch dibiarkan asli (menyentuh backend sungguhan).
  var asli = window.fetch;
  window.fetch = function (url, opts) {
    var m = /[?&]action=([^&]+)/.exec(String(url || ''));
    var body = {};
    try { body = (opts && opts.body) ? JSON.parse(opts.body) : {}; } catch (e) { body = {}; }
    window.__uji.calls.push({ action: m ? decodeURIComponent(m[1]) : '', method: (opts && opts.method) || 'GET', body: body });
    return asli.apply(this, arguments);
  };`}
})();`;
}

// ===========================================================================
// Alur uji
// ===========================================================================
const mulai = Date.now();
console.log('=== Uji UI portal di peramban sungguhan ===');
// Kendali peramban memakai WebSocket bawaan Node (stabil sejak Node 22).
// Node lama harus gagal dengan pesan jelas, bukan crash yang membingungkan.
if (typeof WebSocket !== 'function') {
  tidakBisaDijalankan(`Node ${process.version} tidak menyediakan WebSocket bawaan — butuh Node 22+ untuk mengendalikan peramban.`);
}
const peramban = cariPeramban();
const live = ARGS.live;
const userLive = process.env.APII_TEST_USER || '';
const sandiLive = process.env.APII_TEST_PASS || '';
if (live && (!userLive || !sandiLive)) {
  tidakBisaDijalankan('mode --live butuh kredensial uji di APII_TEST_USER & APII_TEST_PASS (jangan pakai akun asli).');
}
const server = ARGS.url ? null : await serveRoot(ARGS.root);
const urlDasar = ARGS.url || server.url;
console.log(`Peramban : ${peramban}`);
console.log(`Alamat   : ${urlDasar}${live ? '   (mode --live: menyentuh backend sungguhan)' : (ARGS.url ? '   (stub API di sisi halaman)' : `   (menyajikan ${server.root})`)}`);
console.log('');

const perekam = buatPerekam();
const sesi = await (async () => {
  try {
    return await launchBrowser(peramban, { blokirApi: !live });
  } catch (e) {
    if (server) await server.close();
    tidakBisaDijalankan(e.message);
  }
})();
const { cdp, sessionId, close } = sesi;
cdp.on((msg) => perekam.handle(msg));

try {
  for (const d of ['Page.enable', 'Runtime.enable', 'Log.enable', 'Network.enable']) {
    await cdp.send(d, {}, sessionId);
  }
  const evaluate = buatEvaluator(cdp, sessionId);

  // Skrip awal dipasang per-dokumen: setiap navigasi ulang memakai stub/seed
  // yang sama, sehingga skenario "sesi demo basi" benar-benar mulai dari nol.
  const skrip = (opts) => cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: skripAwal(opts) }, sessionId);

  // -------------------------------------------------------------------------
  console.log('== 1. Halaman login tampil (tanpa sesi tersimpan) ==');
  await skrip({ seedDemo: false, stub: !live });
  await cdp.send('Page.navigate', { url: urlDasar + '#login' }, sessionId);
  await tunggu(evaluate, 'document.readyState === "complete" && !!window.App && !!window.Auth',
    { label: 'portal.js & auth.js termuat' });
  check('portal.js + auth.js termuat dan terdefinisi', true);
  await tunggu(evaluate, '!document.getElementById("loginPage").classList.contains("hidden")', { label: 'halaman login tampil' });
  check('halaman login tampil, aplikasi belum dibuka', await evaluate(
    '!document.getElementById("loginPage").classList.contains("hidden") && document.getElementById("appPage").classList.contains("hidden")'));

  const kotak = await klikNyata(cdp, sessionId, evaluate, 'document.getElementById("demoLoginBtn")');
  check('tombol "Masuk sebagai Akun Demo" terlihat & bisa diklik (hit-test nyata)', !!kotak,
    kotak ? '' : 'tombol tidak terlihat / berukuran nol');

  // -------------------------------------------------------------------------
  console.log('\n== 2. Klik demo membuka aplikasi ==');
  // Tunggu sampai alurnya MANTAP lebih dahulu (berhasil ATAU gagal), baru
  // membaca keadaan: aplikasi terbuka, sidebar terisi, dan sesi tersimpan di
  // klien — atau pesan galat muncul. Membaca di tengah transisi membuat uji
  // ini rapuh (gagal sesekali tanpa cacat kode).
  await tunggu(evaluate,
    '(function () {' +
    '  var app = !document.getElementById("appPage").classList.contains("hidden");' +
    '  var galat = (document.getElementById("loginAlert").textContent || "").length > 0;' +
    '  var siap = document.getElementById("navItems").children.length > 0 && !!localStorage.getItem("siapii_token");' +
    '  return galat || (app && siap);' +
    '})()',
    { label: 'aplikasi terbuka setelah login demo' }).catch(() => {});
  const setelahKlik = await evaluate('({ appTampil: !document.getElementById("appPage").classList.contains("hidden"), alert: document.getElementById("loginAlert").textContent || "", demoCalls: window.__uji.calls.filter(function (c) { return c.action === "loginDemo"; }).length, token: localStorage.getItem("siapii_token") })');
  check('tepat satu permintaan loginDemo terkirim (bukan nol, bukan berulang)', setelahKlik.demoCalls === 1, `(${setelahKlik.demoCalls} permintaan)`);
  check('aplikasi terbuka setelah klik demo', setelahKlik.appTampil === true,
    setelahKlik.appTampil ? '' : `pesan di layar: "${setelahKlik.alert}"`);
  check('tidak ada pesan galat di halaman login (mis. "self.bootApp is not a function")', setelahKlik.alert === '', `"${setelahKlik.alert}"`);
  check('sesi demo tersimpan di klien', setelahKlik.token === 'tok-uji-demo', String(setelahKlik.token));
  check('banner Mode Demo tampil untuk akun demo',
    await evaluate('!document.getElementById("demoBanner").classList.contains("hidden")'));
  check('sidebar terisi menu (aplikasi benar-benar dirender)',
    await evaluate('document.getElementById("navItems").children.length > 0'));

  // -------------------------------------------------------------------------
  console.log('\n== 3. Sesi demo BASI + formulir Masuk (bug 2026-10-10) ==');
  perekam.faseKe('login-basi');
  await skrip({ seedDemo: true, stub: !live });
  // Query unik memaksa DOKUMEN BARU dimuat (navigasi ke alamat + '#login' yang
  // sama hanyalah perubahan hash — skrip awal tidak akan jalan ulang).
  await cdp.send('Page.navigate', { url: urlDasar + '?uji=basi#login' }, sessionId);
  await tunggu(evaluate, 'document.readyState === "complete" && !!window.App && !!window.Auth && window.__uji.seedDemo === true',
    { label: 'muat ulang dengan identitas demo tersimpan' });
  check('identitas demo tersimpan terdeteksi di klien', await evaluate('localStorage.getItem("siapii_token") === "tok-uji-demo"'));

  const kredensial = live ? { u: userLive, p: sandiLive } : { u: USER_UJI.username, p: SANDI_UJI };
  const sebelumSubmit = await evaluate('window.__uji.calls.length');
  // Isi formulir seperti pengguna: fokuskan kolom lalu ketik lewat Input domain.
  await evaluate('document.getElementById("loginUsername").focus()');
  await cdp.send('Input.insertText', { text: kredensial.u }, sessionId);
  await evaluate('document.getElementById("loginPassword").focus()');
  await cdp.send('Input.insertText', { text: kredensial.p }, sessionId);
  check('nilai formulir terisi lewat input sungguhan (bukan diisi skrip)',
    (await evaluate('document.getElementById("loginUsername").value')) === kredensial.u);

  const kotakMasuk = await klikNyata(cdp, sessionId, evaluate, 'document.getElementById("loginBtn")');
  check('tombol "Masuk" terlihat & bisa diklik', !!kotakMasuk);
  // Alur selesai = tombol kembali aktif DAN hasilnya jelas (aplikasi terbuka
  // atau pesan galat tampil). Baru setelah itu keadaan dibaca, sehingga
  // pemeriksaan di bawah menilai hasil akhir — bukan potret di tengah proses.
  await tunggu(evaluate,
    '(function () {' +
    '  var btn = document.getElementById("loginBtn");' +
    '  var app = !document.getElementById("appPage").classList.contains("hidden");' +
    '  var galat = (document.getElementById("loginAlert").textContent || "").length > 0;' +
    '  return btn && btn.disabled === false && (app || galat);' +
    '})()',
    { label: 'formulir Masuk selesai diproses' }).catch(() => {});
  const setelahMasuk = await evaluate(`({
    appTampil: !document.getElementById("appPage").classList.contains("hidden"),
    alert: document.getElementById("loginAlert").textContent || "",
    loginCalls: window.__uji.calls.slice(${sebelumSubmit}).filter(function (c) { return c.action === "login"; }).length,
    kirim: (window.__uji.calls.filter(function (c) { return c.action === "login"; }).slice(-1)[0] || {}).body || {},
    demoBanner: document.getElementById("demoBanner").classList.contains("hidden"),
    btn: document.getElementById("loginBtn").disabled,
    btnTeks: document.getElementById("loginBtnText").textContent,
    token: localStorage.getItem("siapii_token")
  })`);
  check('formulir Masuk TIDAK diblokir penjaga mode demo (permintaan terkirim)', setelahMasuk.loginCalls === 1,
    setelahMasuk.loginCalls === 0 ? `(tidak ada permintaan; pesan di layar: "${setelahMasuk.alert}")` : `(${setelahMasuk.loginCalls} permintaan)`);
  check('username & sandi ikut terkirim di payload',
    ((setelahMasuk.kirim.payload || setelahMasuk.kirim).username === kredensial.u),
    JSON.stringify(setelahMasuk.kirim).slice(0, 120));
  check('aplikasi terbuka sebagai akun non-demo', setelahMasuk.appTampil === true,
    setelahMasuk.appTampil ? '' : `pesan di layar: "${setelahMasuk.alert}"`);
  check('tidak ada pesan galat di halaman login', setelahMasuk.alert === '', `"${setelahMasuk.alert}"`);
  check('identitas demo tidak menempel ke sesi baru (banner demo tersembunyi)', setelahMasuk.demoBanner === true);
  check('sesi baru tersimpan di klien', setelahMasuk.token && setelahMasuk.token !== 'tok-uji-demo', String(setelahMasuk.token));
  check('tombol Masuk kembali normal', setelahMasuk.btn === false && setelahMasuk.btnTeks === 'Masuk',
    `disabled=${setelahMasuk.btn}, teks="${setelahMasuk.btnTeks}"`);

  // -------------------------------------------------------------------------
  console.log('\n== 4. Penjaga formulir kosong ==');
  const jumlahSebelum = await evaluate('window.__uji.calls.length');
  await cdp.send('Page.navigate', { url: urlDasar + '?uji=kosong#login' }, sessionId);
  await tunggu(evaluate, '!!window.App && !document.getElementById("loginPage").classList.contains("hidden")', { label: 'kembali ke halaman login' });
  await evaluate('document.getElementById("loginUsername").value = ""; document.getElementById("loginPassword").value = ""; document.getElementById("loginForm").dispatchEvent(new Event("submit", { cancelable: true }));');
  await new Promise((r) => setTimeout(r, 400));
  const barusan = await evaluate(`window.__uji.calls.filter(function (c) { return c.action === "login"; }).length`);
  check('formulir kosong tidak mengirim permintaan login', barusan === 0, `(${barusan} permintaan)`);
  catat(`total permintaan tercatat: ${jumlahSebelum} sebelum langkah ini`);

  // -------------------------------------------------------------------------
  console.log('\n== 5. Kebersihan konsol & jaringan ==');
  perekam.faseKe('pasca-boot');
  const r = perekam.ringkas();
  // Artefak harness: stub ini memang tidak menyediakan data dashboard, dan
  // setiap balasan stub yang kosong diberi penanda "UJI:" supaya galat yang
  // berasal darinya dapat dipisahkan dari galat kode portal. Semua galat LAIN
  // tetap dihitung sebagai kegagalan — penyaring ini tidak melemahkan apa pun.
  const artefakHarness = (e) => String(e.teks || '').includes('UJI:');
  const dariHarness = [...r.exceptions, ...r.consoleError].filter(artefakHarness).length;
  const galatSebelumBoot = {
    exceptions: r.exceptions.filter((e) => e.fase !== 'pasca-boot' && !artefakHarness(e)),
    consoleError: r.consoleError.filter((e) => e.fase !== 'pasca-boot' && !artefakHarness(e)),
    gagalMuatt: r.gagalMuatt.filter((e) => e.fase !== 'pasca-boot' && !hostDiabaikan(e.url)),
    responsBuruk: r.responsBuruk.filter((e) => e.fase !== 'pasca-boot' && !hostDiabaikan(e.url))
  };
  if (dariHarness) {
    catat(`${dariHarness} exception berasal dari stub harness (penanda "UJI:") — data dashboard memang tidak disediakan uji ini, jadi prefetch-nya ditolak. Bukan cacat portal, bukan pula bukti aman: yang diperiksa di sini adalah tombol masuk.`);
  }
  check('tidak ada exception JS selama alur login', galatSebelumBoot.exceptions.length === 0,
    galatSebelumBoot.exceptions.map((e) => e.teks.split('\n')[0]).join(' | '));
  check('tidak ada console error selama alur login', galatSebelumBoot.consoleError.length === 0,
    galatSebelumBoot.consoleError.map((e) => e.teks.split('\n')[0]).join(' | '));
  check('tidak ada permintaan gagal ke aset portal', galatSebelumBoot.gagalMuatt.length === 0,
    galatSebelumBoot.gagalMuatt.map((e) => `${e.url || '(tanpa url)'} ${e.error}`).join(' | '));
  check('tidak ada respons HTTP >= 400 dari aset portal', galatSebelumBoot.responsBuruk.length === 0,
    galatSebelumBoot.responsBuruk.map((e) => `${e.status} ${e.url}`).join(' | '));

  const pascaBoot = {
    exceptions: r.exceptions.filter((e) => e.fase === 'pasca-boot' && !artefakHarness(e)),
    consoleError: r.consoleError.filter((e) => e.fase === 'pasca-boot' && !artefakHarness(e))
  };
  if (pascaBoot.exceptions.length || pascaBoot.consoleError.length) {
    catat(`${pascaBoot.exceptions.length} exception & ${pascaBoot.consoleError.length} console error SETELAH aplikasi terbuka — dilaporkan sebagai info, bukan kegagalan: harness ini memang tidak menyediakan data dashboard (stub), jadi render lanjutan boleh gagal menyajikan data tanpa menandakan cacat tombol masuk.`);
    pascaBoot.exceptions.slice(0, 3).forEach((e) => catat('contoh exception pasca-boot: ' + e.teks.split('\n')[0]));
  }

  if (live) {
    console.log('\n== 6. Mode --live: sesi ditutup kembali ==');
    const keluar = await evaluate('(function () { try { Auth.clear(); return localStorage.getItem("siapii_token") === null; } catch (e) { return false; } })()');
    check('sesi uji dibersihkan dari peramban', keluar === true);
  }
} catch (err) {
  fail++;
  console.log(`  FAIL  alur uji terhenti — ${err.message}`);
} finally {
  await close();
  if (server) await server.close();
}

const total = Date.now() - mulai;
if (info.length && !ARGS.verbose) {
  console.log(`\nCatatan (${info.length}):`);
  info.forEach((i) => console.log('  - ' + i));
}
console.log(`\nHasil: ${pass} lulus, ${fail} gagal. (${total} ms)`);
if (fail > 0) process.exit(1);
