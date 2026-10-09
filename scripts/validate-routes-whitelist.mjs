// Memvalidasi bahwa setiap handler `Modul.fn` di tabel ROUTES (gas/Code.gs)
// terdaftar di daftar putih $fnNames (scripts/build-apps-script.ps1).
//
// Mengapa ini perlu: build hanya mengganti `Modul.fn` -> `fn` untuk nama yang
// ada di daftar putih. Bila sebuah route memakai nama yang tidak terdaftar,
// build gagal ("referensi namespace yang belum diganti") dan bundle tertinggal
// versi lama — itulah yang dulu membuat tombol login demo mengirim
// "Aksi tidak dikenali." Pemeriksaan ini gagal lebih awal dengan pesan jelas.
//
// Cara pakai: node scripts/validate-routes-whitelist.mjs
import { readFileSync, readdirSync } from 'node:fs';

const ROUTES_FILE = 'gas/Code.gs';
const BUILD_FILE = 'scripts/build-apps-script.ps1';

let failed = 0;

// --- 1) Kumpulkan nama handler dari tabel ROUTES -----------------------------
const routesSrc = readFileSync(ROUTES_FILE, 'utf8');
// Ambil badan `var ROUTES = { ... };` agar pola `handler:` hanya dipindai di
// dalam tabel route, bukan di komentar atau kode lain.
const routesStart = routesSrc.indexOf('var ROUTES = {');
if (routesStart === -1) {
  console.log(`FAIL tidak menemukan "var ROUTES = {" di ${ROUTES_FILE}`);
  process.exit(1);
}
// Temukan kurung kurawal penutup yang seimbang dari kurung pembuka pertama.
let depth = 0, routesEnd = -1, inStr = false, strCh = '';
for (let i = routesSrc.indexOf('{', routesStart); i < routesSrc.length; i++) {
  const c = routesSrc[i];
  if (inStr) {
    if (c === '\\') { i++; continue; }
    if (c === strCh) inStr = false;
    continue;
  }
  if (c === '"' || c === "'") { inStr = true; strCh = c; continue; }
  if (c === '/' && routesSrc[i + 1] === '/') {
    // lompati komentar satu baris
    while (i < routesSrc.length && routesSrc[i] !== '\n') i++;
    continue;
  }
  if (c === '{') depth++;
  else if (c === '}') { depth--; if (depth === 0) { routesEnd = i; break; } }
}
if (routesEnd === -1) {
  console.log(`FAIL kurung kurawal ROUTES di ${ROUTES_FILE} tidak seimbang`);
  process.exit(1);
}
const routesBody = routesSrc.slice(routesStart, routesEnd + 1);

// handler: Modul.fn  ->  catat fn;  handler: function (...) ->  lewati (inline).
const handlerRegex = /handler:\s*(?:function\b|([A-Za-z0-9_]+)\.([A-Za-z0-9_]+))/g;
const handlers = [];
let m;
while ((m = handlerRegex.exec(routesBody)) !== null) {
  if (m[1]) handlers.push({ module: m[1], fn: m[2] });
}
if (!handlers.length) {
  console.log(`FAIL tidak menemukan satu pun "handler: Modul.fn" di ${ROUTES_FILE}`);
  failed++;
}

// --- 2) Kumpulkan daftar putih dari skrip build -----------------------------
const buildSrc = readFileSync(BUILD_FILE, 'utf8');
const wlStart = buildSrc.indexOf('$fnNames = @(');
if (wlStart === -1) {
  console.log(`FAIL tidak menemukan "$fnNames = @(" di ${BUILD_FILE}`);
  process.exit(1);
}
// Daftar berakhir pada baris yang hanya berisi ')' (komentar diabaikan).
const wlBlock = buildSrc.slice(wlStart, buildSrc.indexOf('\n)', wlStart) + 1);
const whitelist = [...wlBlock.matchAll(/'([^']+)'/g)].map((x) => x[1]);
if (!whitelist.length) {
  console.log(`FAIL daftar putih $fnNames di ${BUILD_FILE} kosong / gagal diurai`);
  failed++;
}
const wlSet = new Set(whitelist);

// --- 3) Daftar semua fungsi yang didefinisikan di gas/*.gs ------------------
// Pemanggilan Modul.fn() hanya sah bila fn benar-benar ada; tanpa ini, nama
// yang typo lolos pemeriksaan daftar putih tapi tetap rusak saat runtime.
const gasDir = readdirSync('gas').filter((f) => f.endsWith('.gs'));
const defined = new Set();
for (const f of gasDir) {
  const src = readFileSync(`gas/${f}`, 'utf8');
  const re = /^function\s+([A-Za-z0-9_$]+)\s*\(/gm;
  let dm;
  while ((dm = re.exec(src)) !== null) defined.add(dm[1]);
}

// --- 4) Bandingkan ----------------------------------------------------------
const missing = [];
const undefinedFns = [];
const seen = new Set();
for (const h of handlers) {
  const key = `${h.module}.${h.fn}`;
  if (seen.has(key)) continue;
  seen.add(key);
  if (!wlSet.has(h.fn)) missing.push(h);
  if (!defined.has(h.fn)) undefinedFns.push(h);
}

const uniq = (arr) => [...new Set(arr.map((h) => `${h.module}.${h.fn}`))];

if (missing.length) {
  failed++;
  console.log(`FAIL ${missing.length} handler ROUTES tidak ada di daftar putih $fnNames:`);
  for (const name of uniq(missing)) {
    console.log(`      - ${name}`);
  }
  console.log(`\nTambahkan nama fungsinya ke $fnNames di ${BUILD_FILE}.`);
}
if (undefinedFns.length) {
  failed++;
  console.log(`FAIL ${undefinedFns.length} handler ROUTES merujuk fungsi yang tidak didefinisikan di gas/*.gs:`);
  for (const name of uniq(undefinedFns)) {
    console.log(`      - ${name}`);
  }
}

// --- 5) Ringkasan sukses ----------------------------------------------------
if (!failed) {
  console.log(`OK   ${handlers.length} handler ROUTES di ${ROUTES_FILE} semuanya terdaftar di daftar putih.`);
  console.log(`OK   ${whitelist.length} nama di $fnNames; ${defined.size} fungsi terdefinisi di ${gasDir.length} file gas/.`);
}
if (failed) {
  console.log(`\n${failed} pemeriksaan gagal.`);
  process.exit(1);
}
