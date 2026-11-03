// ============================================================================
// validate-routes-whitelist.mjs
// Validasi RBAC Routes Whitelist, Handlers, dan Endpoint Frontend SIAP APII
// ============================================================================
// Memastikan:
//   1. Seluruh route di gas/Code.gs terdefinisi dengan aman (auth & roles valid)
//   2. Route publik (auth: false) HANYA rute yang ada di daftar putih aman
//   3. Semua handler di gas/Code.gs benar-benar terdefinisi di modul domain gas/
//   4. Semua pemanggilan aksi dari portal/portal.js dan public/app.js terdaftar di ROUTES
//   5. apps-script/Backend.gs bebas dari namespace tak terganti pada ROUTES
// ============================================================================

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

let passed = 0;
let failed = 0;

function check(desc, condition, details = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${desc}`);
  } else {
    failed++;
    console.error(`  FAIL  ${desc}${details ? ` -> ${details}` : ''}`);
  }
}

console.log('=== 1. Evaluasi & Parsing Tabel ROUTES di gas/Code.gs ===');

const codeGsPath = join('gas', 'Code.gs');
if (!existsSync(codeGsPath)) {
  console.error(`File ${codeGsPath} tidak ditemukan!`);
  process.exit(1);
}
const codeGs = readFileSync(codeGsPath, 'utf8');

function createMockModule(modName) {
  return new Proxy({}, {
    get: (_, prop) => {
      const fn = function () {};
      fn._mod = modName;
      fn._name = String(prop);
      return fn;
    }
  });
}

const sandbox = {
  Auth: createMockModule('Auth'),
  Surat: createMockModule('Surat'),
  Keuangan: createMockModule('Keuangan'),
  Utils: createMockModule('Utils'),
  Divisi: createMockModule('Divisi'),
  Database: createMockModule('Database')
};
vm.createContext(sandbox);

const startIdx = codeGs.indexOf('var ROLES = {');
const endIdx = codeGs.indexOf('// PINTU MASUK WEB APP');
check('Blok tabel ROUTES & konstanta RBAC ditemukan di gas/Code.gs', startIdx !== -1 && endIdx !== -1);

if (startIdx === -1 || endIdx === -1) {
  process.exit(1);
}

const declarationsCode = codeGs.substring(startIdx, endIdx);
vm.runInContext(declarationsCode, sandbox);

const routes = sandbox.ROUTES;
const routeNames = Object.keys(routes || {});
check(`Berhasil mem-parsing ${routeNames.length} routes lengkap dari Code.gs`, routeNames.length >= 45, `Ditemukan: ${routeNames.length}`);

console.log('\n=== 2. Validasi Whitelist Route Publik (auth: false) ===');

// Daftar putih ketat untuk route publik yang boleh diakses tanpa token
const APPROVED_PUBLIC_ROUTES = new Set([
  'login',
  'loginWithGoogle',
  'registerAnggota',
  'verifyKtaPublic',
  'claimLegacyKta',
  'verifySurat',
  'getPublishedSurat',
  'getPublicAccounts',
  'verifyKwitansi',
  'verifyReceipt',
  'getPublicSettings',
  'getPublicWilayahList',
  'getPublicFeed',
  'verify'
]);

const publicRoutesFound = [];
const unauthorizedPublicRoutes = [];

for (const [name, cfg] of Object.entries(routes)) {
  if (!cfg.auth) {
    publicRoutesFound.push(name);
    if (!APPROVED_PUBLIC_ROUTES.has(name)) {
      unauthorizedPublicRoutes.push(name);
    }
  }
}

check('Tidak ada route publik di luar daftar putih resmi', unauthorizedPublicRoutes.length === 0, `Route ilegal: ${unauthorizedPublicRoutes.join(', ')}`);
check('Semua route publik resmi terdaftar dalam ROUTES', APPROVED_PUBLIC_ROUTES.size === publicRoutesFound.length, `Terdaftar ${publicRoutesFound.length}/${APPROVED_PUBLIC_ROUTES.size}`);

console.log('\n=== 3. Validasi Keberadaan Handler di gas/*.gs ===');

const modules = {
  Auth: readFileSync(join('gas', 'Auth.gs'), 'utf8'),
  Surat: readFileSync(join('gas', 'Surat.gs'), 'utf8'),
  Keuangan: readFileSync(join('gas', 'Keuangan.gs'), 'utf8'),
  Utils: readFileSync(join('gas', 'Utils.gs'), 'utf8'),
  Divisi: readFileSync(join('gas', 'Divisi.gs'), 'utf8'),
  Database: readFileSync(join('gas', 'Database.gs'), 'utf8')
};

for (const [name, cfg] of Object.entries(routes)) {
  const handler = cfg.handler;
  if (typeof handler !== 'function') {
    check(`Handler route '${name}' adalah fungsi yang dapat dieksekusi`, false, `Tipe handler: ${typeof handler}`);
    continue;
  }

  // Jika handler anonim/inline (contoh: initDatabaseSchema)
  if (!handler._mod) {
    check(`Handler route '${name}' adalah fungsi inline yang valid`, true);
    continue;
  }

  const modName = handler._mod;
  const fnName = handler._name;
  const modContent = modules[modName];

  if (!modContent) {
    check(`Modul domain '${modName}' untuk route '${name}' ditemukan`, false, `Modul tidak dikenal: ${modName}`);
  } else {
    const fnDefRegex = new RegExp(`function\\s+${fnName}\\s*\\(`);
    const isFnDefined = fnDefRegex.test(modContent);
    check(`Handler '${modName}.${fnName}' untuk route '${name}' terdefinisi di gas/${modName}.gs`, isFnDefined, `Fungsi ${fnName} tidak ada di gas/${modName}.gs`);
  }
}

console.log('\n=== 4. Validasi Pemanggilan API Frontend (Portal & Public) ===');

// Ekstraksi pemanggilan API dari portal/portal.js: Auth.fetch('action', ...)
const portalPath = join('portal', 'portal.js');
const portalActions = new Set();
if (existsSync(portalPath)) {
  const portalContent = readFileSync(portalPath, 'utf8');
  const authFetchRegex = /Auth\.fetch\s*\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
  let match;
  while ((match = authFetchRegex.exec(portalContent)) !== null) {
    portalActions.add(match[1]);
  }
}

// Ekstraksi pemanggilan API dari public/app.js: (this|self|Public).(get|post)('action', ...)
const publicPath = join('public', 'app.js');
const publicActions = new Set();
if (existsSync(publicPath)) {
  const publicContent = readFileSync(publicPath, 'utf8');
  const pubCallRegex = /(?:this|self|Public)\.(?:get|post)\s*\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
  let match;
  while ((match = pubCallRegex.exec(publicContent)) !== null) {
    publicActions.add(match[1]);
  }
  // Tindakan verifikasi dinamis yang didefinisikan dalam variabel action
  const varActionRegex = /action\s*=\s*['"](verify[a-zA-Z0-9_]*)['"]/g;
  while ((match = varActionRegex.exec(publicContent)) !== null) {
    publicActions.add(match[1]);
  }
}

const portalList = Array.from(portalActions);
const publicList = Array.from(publicActions);

check(`Menemukan aksi API pada portal/portal.js (${portalList.length} unik)`, portalList.length > 0);
check(`Menemukan aksi API pada public/app.js (${publicList.length} unik)`, publicList.length > 0);

const unmappedPortal = portalList.filter(act => !routes[act]);
const unmappedPublic = publicList.filter(act => !routes[act]);

check('Semua aksi API dari portal/portal.js terdaftar di ROUTES', unmappedPortal.length === 0, `Tidak terdaftar: ${unmappedPortal.join(', ')}`);
check('Semua aksi API dari public/app.js terdaftar di ROUTES', unmappedPublic.length === 0, `Tidak terdaftar: ${unmappedPublic.join(', ')}`);

console.log('\n=== 5. Validasi Backend.gs (Kompilasi Apps Script) ===');

const backendGsPath = join('apps-script', 'Backend.gs');
if (existsSync(backendGsPath)) {
  const backendGs = readFileSync(backendGsPath, 'utf8');
  const routesInBackend = backendGs.match(/var\s+ROUTES\s*=\s*\{([\s\S]*?)\n\};/);
  if (routesInBackend) {
    // Pastikan tidak ada namespace tertinggal pada handler (kecuali komentar berekstensi .gs)
    const hasDanglingNs = /(?<![\w.])(?:Auth|Surat|Keuangan|Utils|Divisi|Database)\.(?!gs\b)[a-zA-Z0-9_]+/.test(routesInBackend[1]);
    check('Tabel ROUTES di Backend.gs bebas dari pemanggilan namespace (telah ditransformasi)', !hasDanglingNs);
  } else {
    check('Tabel ROUTES ditemukan di Backend.gs', false);
  }
} else {
  console.log('  INFO  apps-script/Backend.gs belum dikompilasi, lewati cek ini.');
}

console.log('\n============================================================');
console.log(`Hasil Validasi Rute: ${passed} LULUS, ${failed} GAGAL`);
console.log('============================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
