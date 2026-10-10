// Uji smoke TOMBOL MASUK portal pengurus (portal/portal.js) — tanpa jaringan.
//
// Latar belakang (bug produksi 2026-10-10): `App.showLogin()` memakai variabel
// `self` tanpa mendeklarasikannya. Di peramban `self` adalah alias global untuk
// `window`, jadi handler tombol "Masuk sebagai Akun Demo" memanggil
// `window.self.bootApp(...)` yang tidak ada. Hasilnya: login demo BERHASIL di
// server (token & user demo tersimpan di localStorage) tetapi aplikasi tidak
// pernah terbuka — pengunjung hanya melihat pesan merah
// "self.bootApp is not a function" di halaman login.
//
// Yang dikunci uji ini:
//   1. tombol "Masuk sebagai Akun Demo" benar-benar memanggil App.bootApp()
//      dengan user demo (bukan gagal senyap) dan tanpa pesan galat;
//   2. satu klik = satu permintaan `loginDemo` (handler tidak terpasang ganda
//      walau showLogin() dipanggil berkali-kali dalam satu siklus halaman);
//   3. formulir "Masuk" biasa tetap membuka aplikasi setelah kredensial valid;
//   4. penjaga statis: setiap method di objek App yang memakai `self.` WAJIB
//      mendeklarasikan `self` sendiri (mencegah bug kelas ini terulang).
//
// Pakai: node scripts/smoke-portal-login-button.mjs   (atau: npm run smoke:portal:ui)
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

const AUTH_CODE = readFileSync('portal/auth.js', 'utf8');
const PORTAL_CODE = readFileSync('portal/portal.js', 'utf8');

// ---------------------------------------------------------------------------
// DOM tiruan minimal (tanpa dependensi) — cukup untuk portal.js
// ---------------------------------------------------------------------------
function makeEl(id) {
  const classes = new Set();
  const listeners = {};
  const el = {
    id,
    textContent: '',
    innerHTML: '',
    value: '',
    disabled: false,
    className: '',
    hidden: false,
    style: {},
    dataset: {},
    classList: {
      add: (c) => { classes.add(c); },
      remove: (c) => { classes.delete(c); },
      contains: (c) => classes.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !classes.has(c) : !!force;
        if (on) classes.add(c); else classes.delete(c);
        return on;
      },
    },
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener: (type, fn) => {
      listeners[type] = (listeners[type] || []).filter((f) => f !== fn);
    },
    // Simulasi klik/submit sungguhan: semua listener terpasang dipanggil.
    click: () => { (listeners.click || []).slice().forEach((fn) => fn({ target: el, preventDefault() {}, stopPropagation() {} })); },
    submit: () => { (listeners.submit || []).slice().forEach((fn) => fn({ target: el, preventDefault() {}, stopPropagation() {} })); },
    focus: () => {},
    blur: () => {},
    remove: () => {},
    replaceWith: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    getAttribute: () => null,
    setAttribute: () => {},
    contains: () => false,
    appendChild: () => {},
    _listeners: listeners,
  };
  return el;
}

/**
 * Muat portal/auth.js + portal/portal.js yang ASLI di DOM tiruan.
 * `with (window)` dipakai supaya semantik global peramban tetap setia,
 * termasuk `self === window` (inti bug yang dikunci uji ini).
 * @param {object} opts { respond: fn(url, req) => body, hash: string, seed: {token,user} }
 */
function loadPortal({ respond, hash = '#login', seed } = {}) {
  const store = {};
  const calls = [];
  const toasts = [];
  const els = {};
  if (seed && seed.token) store['siapii_token'] = seed.token;
  if (seed && seed.user) store['siapii_user'] = JSON.stringify(seed.user);

  const document = {
    getElementById: (id) => els[id] || (els[id] = makeEl(id)),
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: (tag) => makeEl(tag),
    querySelector: () => null,
    querySelectorAll: () => [],
    readyState: 'complete',
    body: makeEl('body'),
  };
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  const fetchStub = (url, req) => {
    const m = /action=([^&]+)/.exec(url);
    const action = m ? decodeURIComponent(m[1]) : '';
    calls.push({ url, action, method: (req && req.method) || 'GET', body: req && req.body });
    const body = respond ? respond(url, req) : { success: true, data: {}, message: 'ok' };
    if (body === null) return Promise.reject(new Error('jaringan dimatikan uji'));
    return Promise.resolve({ status: 200, json: () => Promise.resolve(body) });
  };

  const window = {
    API_BASE: 'https://contoh.test/exec',
    location: { hash, pathname: '/index.html', href: '' },
    localStorage,
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    console: { log: () => {}, error: () => {} },
    alert: () => {},
  };
  window.self = window;            // peramban: self === window
  window.window = window;
  window.document = document;
  window.fetch = fetchStub;

  const run = (code) => new Function('window', 'document', `with (window) {\n${code}\n}`)(window, document);
  run(AUTH_CODE);
  run(PORTAL_CODE);

  return { App: window.App, Auth: window.Auth, els, calls, toasts, store, window, document };
}

const DEMO_USER = {
  id: 'u-demo', username: 'demo', full_name: 'Akun Demo', role: 'DEMO',
  role_label: 'Akun Demo (Read-Only)', permissions: ['getDashboard'],
};
const SUPERADMIN = { id: 'u-sa', username: 'superadmin', full_name: 'Super Admin', role: 'SUPERADMIN' };

const tick = () => new Promise((r) => setTimeout(r, 0));
/** Ambil elemen dari DOM tiruan (dibuat otomatis bila belum ada). */
const el = (p, id) => p.document.getElementById(id);

// ---------------------------------------------------------------------------
// 1. Tombol "Masuk sebagai Akun Demo" harus membuka aplikasi
// ---------------------------------------------------------------------------
console.log('== Tombol "Masuk sebagai Akun Demo" membuka aplikasi ==');
{
  const p = loadPortal({
    respond: () => ({ success: true, data: { token: 'token-demo', user: DEMO_USER }, message: 'ok' }),
  });
  const booted = [];
  p.App.bootApp = function (user) { booted.push(user); };   // pengganti: tidak perlu render halaman
  p.App.init();

  check('halaman login tampil & aplikasi tersembunyi',
    !el(p, 'loginPage').classList.contains('hidden') && el(p, 'appPage').classList.contains('hidden'));

  el(p, 'demoLoginBtn').click();
  await tick();

  check('permintaan loginDemo terkirim sebagai POST',
    p.calls.some((c) => c.action === 'loginDemo' && c.method === 'POST'),
    `(panggilan: ${p.calls.map((c) => c.action).join(', ') || 'tidak ada'})`);
  check('App.bootApp dipanggil (aplikasi terbuka)', booted.length === 1,
    booted.length === 0 ? `(galat di layar: "${el(p, 'loginAlert').textContent}")` : '');
  check('bootApp menerima user demo (peran DEMO)',
    booted.length === 1 && booted[0] && booted[0].role === 'DEMO');
  check('sesi demo tersimpan di klien', p.Auth.isDemo() === true && !!p.store['siapii_token']);
  check('tidak ada pesan galat di halaman login', el(p, 'loginAlert').textContent === '',
    `(pesan: "${el(p, 'loginAlert').textContent}")`);
  check('tombol demo kembali aktif setelah selesai', el(p, 'demoLoginBtn').disabled === false);
}

// ---------------------------------------------------------------------------
// 2. showLogin() berulang tidak memasang handler ganda
// ---------------------------------------------------------------------------
console.log('\n== Satu klik tetap satu permintaan walau showLogin() diulang ==');
{
  const p = loadPortal({
    respond: () => ({ success: true, data: { token: 'token-demo', user: DEMO_USER }, message: 'ok' }),
  });
  const booted = [];
  p.App.bootApp = function (user) { booted.push(user); };
  p.App.init();
  p.App.showLogin();          // mis. kembali ke halaman login setelah login gagal
  p.App.showLogin();
  const before = p.calls.length;
  el(p, 'demoLoginBtn').click();
  await tick();
  const demoCalls = p.calls.slice(before).filter((c) => c.action === 'loginDemo');
  check('handler demo terpasang sekali saja (satu permintaan loginDemo)', demoCalls.length === 1,
    `(permintaan: ${demoCalls.length})`);
  check('bootApp tetap dipanggil sekali', booted.length === 1, `(dipanggil: ${booted.length})`);
}

// ---------------------------------------------------------------------------
// 3. Formulir "Masuk" biasa (superadmin) tetap membuka aplikasi
// ---------------------------------------------------------------------------
console.log('\n== Formulir "Masuk" biasa membuka aplikasi ==');
{
  const p = loadPortal({
    respond: () => ({ success: true, data: { token: 'token-sa', user: SUPERADMIN }, message: 'ok' }),
  });
  const booted = [];
  p.App.bootApp = function (user) { booted.push(user); };
  p.App.init();
  el(p, 'loginUsername').value = 'superadmin';
  el(p, 'loginPassword').value = 'Icat250704!';
  el(p, 'loginForm').submit();
  await tick();

  check('permintaan login terkirim', p.calls.some((c) => c.action === 'login' && c.method === 'POST'));
  check('App.bootApp dipanggil untuk superadmin',
    booted.length === 1 && booted[0] && booted[0].role === 'SUPERADMIN');
  check('tidak ada pesan galat di halaman login', el(p, 'loginAlert').textContent === '',
    `(pesan: "${el(p, 'loginAlert').textContent}")`);
  check('tombol Masuk kembali normal', el(p, 'loginBtn').disabled === false && el(p, 'loginBtnText').textContent === 'Masuk');
}

// ---------------------------------------------------------------------------
// 4. Penjaga statis: method App yang memakai `self.` wajib mendeklarasikan self
// ---------------------------------------------------------------------------
console.log('\n== Penjaga statis: `self.` tanpa deklarasi di objek App ==');
{
  /**
   * @return {{bad: string[], names: string[]}} nama method yang memakai `self.`
   *   tanpa mendeklarasikan `self`, plus seluruh method yang dipindai (agar uji
   *   ini tidak pernah "lolos secara semu" karena regex tidak mencocok apa pun).
   */
  function methodsMissingSelf(code) {
    const lines = code.split(/\r?\n/);
    const bad = [];
    const names = [];
    for (let i = 0; i < lines.length; i++) {
      const m = /^ {4}([A-Za-z_$][\w$]*): function/.exec(lines[i]);
      if (!m) continue;
      names.push(m[1]);
      let depth = 0, started = false;
      const body = [];
      for (let j = i; j < lines.length; j++) {
        for (const ch of lines[j]) {
          if (ch === '{') { depth++; started = true; } else if (ch === '}') depth--;
        }
        body.push(lines[j]);
        if (started && depth === 0) break;
      }
      const text = body.join('\n');
      const usesSelf = /\bself\s*\./.test(text);
      const declaresSelf = /\bvar\s+self\b/.test(text);
      // Method yang TIDAK memakai `self.` tidak perlu deklarasi apa pun.
      if (usesSelf && !declaresSelf) bad.push(m[1]);
    }
    return { bad, names };
  }

  const real = methodsMissingSelf(PORTAL_CODE);
  check('pemindai menjangkau seluruh method App (termasuk showLogin & bootApp)',
    real.names.length > 50 && real.names.indexOf('showLogin') !== -1 && real.names.indexOf('bootApp') !== -1,
    `(terpindai: ${real.names.length})`);
  check('tidak ada method App yang memakai `self.` tanpa `var self`', real.bad.length === 0,
    `(bermasalah: ${real.bad.join(', ')})`);

  // Bukti penjaga ini benar-benar menangkap bug yang dilaporkan: sisipkan kembali
  // versi rusak (tanpa `var self = ...` di showLogin) dan pastikan terdeteksi.
  const broken = PORTAL_CODE.replace(/\n\s*var self = \(this && this\.bootApp\)[^\n]*\n/, '\n');
  check('versi rusak benar-benar dipakai pada kontrol negatif', broken !== PORTAL_CODE);
  const bad2 = methodsMissingSelf(broken).bad;
  check('penjaga statis menangkap versi rusak (showLogin tanpa `var self`)',
    bad2.indexOf('showLogin') !== -1, `(terdeteksi: ${bad2.join(', ') || 'tidak ada'})`);
}

console.log(`\nHasil: ${pass} lulus, ${fail} gagal.`);
if (fail > 0) process.exit(1);
