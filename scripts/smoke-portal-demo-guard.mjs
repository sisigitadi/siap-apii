// Uji smoke PENJAGA MODE DEMO portal pengurus (portal/auth.js) — tanpa jaringan.
//
// Latar belakang (bug produksi 2026-10-10): penjaga "mode demo" di frontend
// memblokir SELURUH aksi POST selama sesi demo aktif — padahal `login`,
// `loginDemo`, dan `logout` juga POST. Akibatnya, pengunjung yang masih
// menyimpan identitas demo di peramban (mis. token kedaluwarsa lalu halaman
// login terbuka tanpa identitas dibersihkan) tidak bisa lagi masuk sama sekali:
// menekan "Masuk" dengan akun superadmin maupun "Masuk sebagai Akun Demo"
// sama-sama hanya memunculkan notifikasi "Mode demo hanya untuk melihat.
// Perubahan data tidak dapat disimpan." dan permintaannya tidak pernah dikirim.
//
// Yang dikunci uji ini:
//   1. aksi autentikasi/sesi (login, loginDemo, logout, me) SELALU sampai ke
//      server, bahkan ketika identitas demo masih tersimpan di klien;
//   2. penjaga read-only tetap utuh: aksi tulis tetap ditolak di klien tanpa
//      menyentuh jaringan;
//   3. sesi baru menggantikan identitas lama (tidak ada sisa user demo);
//   4. sesi non-demo tidak pernah ikut terblokir.
//
// Pakai: node scripts/smoke-portal-demo-guard.mjs   (atau: npm run smoke:portal)
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

const DEMO_MSG = 'Mode demo hanya untuk melihat. Perubahan data tidak dapat disimpan.';
const code = readFileSync('portal/auth.js', 'utf8');

/**
 * Sandbox portal: `window` + `localStorage` + `fetch` tiruan, memuat portal/auth.js
 * yang ASLI (tidak ada salinan logika yang bisa menyimpang).
 * @param {object} opts { respond: fn(url, req) => body, seed: {token, user} }
 */
function loadPortal({ respond, seed } = {}) {
  const store = {};
  const calls = [];
  const toasts = [];
  if (seed && seed.user) store['siapii_user'] = JSON.stringify(seed.user);
  if (seed && seed.token) store['siapii_token'] = seed.token;
  if (seed && seed.rawUser) store['siapii_user'] = seed.rawUser;

  const window = {
    API_BASE: 'https://contoh.test/exec',
    location: { hash: '#login', pathname: '/portal/index.html', href: '' },
    App: { toast: (msg, type) => toasts.push({ msg, type }) },
  };
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  const fetchStub = (url, req) => {
    const action = /action=([^&]+)/.exec(url) ? decodeURIComponent(/action=([^&]+)/.exec(url)[1]) : '';
    calls.push({ url, action, method: (req && req.method) || 'GET', body: req && req.body });
    const body = respond ? respond(url, req) : { success: true, data: { token: 'token-baru', user: { username: 'superadmin', role: 'SUPERADMIN' } }, message: 'ok' };
    if (body === null) return Promise.reject(new Error('jaringan dimatikan uji'));
    return Promise.resolve({
      status: 200,
      json: () => Promise.resolve(body),
    });
  };

  // `App` juga disuntik sebagai variabel global karena portal/auth.js memanggil
  // `App.toast(...)` (di peramban ia global hasil `window.App = App`), dan
  // `document` minimal untuk bilah progres (#topProgressBar).
  const document = { getElementById: () => null };
  new Function('window', 'localStorage', 'fetch', 'alert', 'console', 'App', 'document', code)(
    window, localStorage, fetchStub, () => {}, { log: () => {}, error: () => {} }, window.App, document
  );
  return { Auth: window.Auth, calls, toasts, store, window };
}

/** Aksi ditolak penjaga demo di klien? */
const blockedByDemo = (err) => !!err && String(err.message).indexOf('Mode demo') !== -1;

const DEMO_USER = { username: 'demo', role: 'DEMO', is_demo: true, full_name: 'Akun Demo' };

console.log('== Penjaga demo: aksi autentikasi tetap sampai ke server ==');
{
  // Klien menyimpan identitas demo (gejala produksi: token sudah tidak dipakai,
  // tetapi identitas demo masih ada saat halaman login terbuka).
  const p = loadPortal({ seed: { user: DEMO_USER } });
  p.Auth.restore();
  check('identitas demo ter-restore dari localStorage', p.Auth.isDemo() === true);

  let err = null;
  const user = await p.Auth.login('superadmin', 'Icat250704!').catch((e) => { err = e; return null; });
  check('login superadmin TIDAK diblokir penjaga demo', !blockedByDemo(err),
    err ? `(ditolak: ${err.message})` : '');
  check('permintaan login benar-benar dikirim ke server',
    p.calls.some((c) => c.action === 'login' && c.method === 'POST'),
    `(panggilan: ${p.calls.map((c) => c.action).join(', ') || 'tidak ada'})`);
  check('sesi baru menggantikan identitas demo', user !== null && p.Auth.isDemo() === false && p.Auth.user.role === 'SUPERADMIN');
  check('tidak ada notifikasi mode demo saat login', !p.toasts.some((t) => t.msg === DEMO_MSG));
}

console.log('\n== Penjaga demo: tombol "Masuk sebagai Akun Demo" tetap berfungsi ==');
{
  const p = loadPortal({
    seed: { user: DEMO_USER },
    respond: () => ({ success: true, data: { token: 'token-demo', user: DEMO_USER }, message: 'ok' }),
  });
  p.Auth.restore();
  let err = null;
  const user = await p.Auth.loginAsDemo().catch((e) => { err = e; return null; });
  check('loginDemo TIDAK diblokir penjaga demo', !blockedByDemo(err), err ? `(ditolak: ${err.message})` : '');
  check('permintaan loginDemo dikirim ke server', p.calls.some((c) => c.action === 'loginDemo'));
  check('sesi demo tersimpan', user !== null && p.Auth.isDemo() === true);
}

console.log('\n== Penjaga demo: logout tetap bisa keluar dari mode demo ==');
{
  const p = loadPortal({ seed: { token: 'token-demo', user: DEMO_USER } });
  p.Auth.restore();
  let err = null;
  const done = await p.Auth.logout().catch((e) => { err = e; return null; });
  check('logout TIDAK diblokir penjaga demo', !blockedByDemo(err), err ? `(ditolak: ${err.message})` : '');
  check('permintaan logout dikirim ke server', p.calls.some((c) => c.action === 'logout'));
  check('sesi demo dibersihkan setelah logout', p.Auth.isDemo() === false && p.Auth.token === null);
}

console.log('\n== Penjaga demo: aksi tulis tetap ditolak di klien (tanpa jaringan) ==');
{
  const p = loadPortal({ seed: { token: 'token-demo', user: DEMO_USER } });
  p.Auth.restore();
  let err = null;
  await p.Auth.fetch('createSurat', { judul: 'uji' }).catch((e) => { err = e; return null; });
  check('aksi tulis ditolak dengan pesan mode demo', blockedByDemo(err));
  check('aksi tulis tidak pernah dikirim ke server', p.calls.length === 0, `(panggilan: ${p.calls.map((c) => c.action).join(', ')})`);
  check('notifikasi mode demo muncul untuk aksi tulis', p.toasts.some((t) => t.msg === DEMO_MSG));
}

console.log('\n== Sesi non-demo tidak ikut terblokir ==');
{
  const p = loadPortal({ seed: { token: 'token-sa', user: { username: 'superadmin', role: 'SUPERADMIN' } } });
  p.Auth.restore();
  let err = null;
  await p.Auth.fetch('createSurat', { judul: 'uji' }).catch((e) => { err = e; return null; });
  check('superadmin bisa mengirim aksi tulis', err === null && p.calls.some((c) => c.action === 'createSurat'));
}

console.log(`\nHasil: ${pass} lulus, ${fail} gagal.`);
if (fail > 0) process.exit(1);
