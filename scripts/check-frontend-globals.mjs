// ============================================================================
// check-frontend-globals.mjs — gerbang "tanpa variabel global tak dideklarasikan"
// untuk berkas frontend (portal pengurus & portal publik).
//
// Latar belakang (bug produksi 2026-10-10): `App.showLogin()` memakai `self`
// tanpa mendeklarasikannya. Di peramban `self` adalah ALIAS GLOBAL untuk
// `window`, jadi pemakaian itu tidak memicu ReferenceError apa pun — ia
// diam-diam menunjuk `window`, dan `window.bootApp` tidak ada. Kegagalannya
// baru muncul jauh di dalam rantai promise sebagai TypeError
// "self.bootApp is not a function", sementara `node -c` dan lint biasa
// (termasuk aturan no-undef) menganggapnya sah karena `self` memang global
// yang terdaftar.
//
// Pemindai ini menutup celah itu dengan dua pemeriksaan sadar-lingkup:
//
//   1. ALIAS WINDOW (error): `self`, `top`, `parent`, `frames`, `globalThis`
//      tidak boleh dipakai sebagai objek implisit kecuali ada deklarasi
//      (`var self = this;`) pada fungsi yang MELINGKUPINYA. Inilah kelas bug di
//      atas: deklarasi `var self` di fungsi LAIN tidak menolong — dan itulah
//      bedanya dengan grep, pemindai ini memahami lingkup fungsi bersarang.
//
//   2. NAMA TAK DIKENAL (error): identifier yang dipakai sebagai objek
//      (`X.y`, `X(`, `X[...]`) tetapi tidak dideklarasikan di lingkup mana pun,
//      tidak didefinisikan berkas lain pada folder frontend yang sama
//      (`window.X = …` di config.js/auth.js), dan bukan global peramban/library
//      yang dikenal. Ini menangkap salah ketik nama seperti `Auh.toast(...)`.
//
// Aman terhadap komentar, string, dan literal regex (isinya dikosongkan lebih
// dulu sambil menjaga posisi karakter, sehingga nomor baris tetap benar).
//
// Pakai:
//   node scripts/check-frontend-globals.mjs            (atau: npm run check:frontend)
//   node scripts/check-frontend-globals.mjs --json      (keluaran untuk mesin)
//   node scripts/check-frontend-globals.mjs --list      (daftar berkas saja)
//
// Kode keluar: 0 bersih · 1 ada temuan.
// ============================================================================
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Folder frontend yang benar-benar tayang di produksi (lihat docs/deploy.md §3).
// `frontend/` sengaja tidak ikut: itu aplikasi React/TypeScript terpisah yang
// diperiksa `tsc` (variabel tak dikenal sudah menjadi galat kompilasi di sana).
const FRONTENDS = [
  { dir: 'portal', label: 'Portal Pengurus (siapii.sigitadi.id)' },
  { dir: 'public', label: 'Portal Publik (apii.sigitadi.id)' },
];

// Alias window: dipakai apa adanya sebagai objek hampir selalu bug.
const FORBIDDEN_ALIASES = ['self', 'top', 'parent', 'frames', 'globalThis'];

// Global standar peramban/JS yang sah dipakai tanpa deklarasi.
const BUILTIN_GLOBALS = new Set([
  'window', 'document', 'navigator', 'location', 'history', 'screen', 'console',
  'alert', 'confirm', 'prompt', 'fetch', 'localStorage', 'sessionStorage',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'queueMicrotask',
  'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'FormData',
  'Headers', 'Request', 'Response', 'Image', 'Audio', 'Event', 'CustomEvent',
  'KeyboardEvent', 'MouseEvent', 'TouchEvent', 'InputEvent', 'DragEvent',
  'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'EventSource',
  'WebSocket', 'Worker', 'MessageChannel', 'TextEncoder', 'TextDecoder',
  'Intl', 'JSON', 'Math', 'Date', 'RegExp', 'Error', 'TypeError', 'RangeError',
  'SyntaxError', 'ReferenceError', 'EvalError', 'URIError', 'AggregateError',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt',
  'Function', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Proxy', 'Reflect',
  'ArrayBuffer', 'Uint8Array', 'Uint16Array', 'Int32Array', 'Float64Array',
  'DataView', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'structuredClone',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
  'escape', 'unescape', 'atob', 'btoa', 'crypto', 'performance', 'matchMedia',
  'getComputedStyle', 'devicePixelRatio', 'innerWidth', 'innerHeight',
  'scrollX', 'scrollY', 'pageXOffset', 'pageYOffset', 'scrollTo', 'scrollBy',
  'print', 'open', 'close', 'focus', 'blur', 'stop',
  'undefined', 'NaN', 'Infinity', 'arguments',
]);

// Library dari CDN yang memang global di halaman (dipakai sebagian fitur).
const EXTERNAL_GLOBALS = new Set(['tailwind', 'XLSX', 'html2canvas', 'jspdf', 'QRCode', 'Chart']);

const KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break',
  'continue', 'return', 'function', 'var', 'let', 'const', 'new', 'delete',
  'typeof', 'instanceof', 'in', 'of', 'try', 'catch', 'finally', 'throw',
  'class', 'extends', 'super', 'this', 'void', 'yield', 'await', 'async',
  'export', 'import', 'with', 'debugger', 'null', 'true', 'false',
]);

// ---------------------------------------------------------------------------
// 1. Kosongkan komentar, string, dan literal regex — panjang & baris terjaga
// ---------------------------------------------------------------------------
export function stripLiterals(code) {
  const out = code.split('');
  const n = code.length;
  let i = 0;
  let prevSig = '';
  const blank = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' ';
  };
  while (i < n) {
    const c = code[i];
    if (c === '/' && code[i + 1] === '/') {
      const start = i;
      while (i < n && code[i] !== '\n') i++;
      blank(start, i);
      continue;
    }
    if (c === '/' && code[i + 1] === '*') {
      const start = i;
      i += 2;
      while (i < n && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i = Math.min(n, i + 2);
      blank(start, i);
      prevSig = 'x';
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const start = i;
      const quote = c;
      i++;
      while (i < n) {
        if (code[i] === '\\') { i += 2; continue; }
        if (code[i] === quote) { i++; break; }
        i++;
      }
      blank(start, i);
      prevSig = 'x';
      continue;
    }
    if (c === '/' && /[=[(,;:!&|?{}+\-*%~^<>]/.test(prevSig || '')) {
      // Literal regex (bukan pembagian): ditebak dari karakter bermakna terakhir.
      const start = i;
      let inClass = false;
      i++;
      while (i < n) {
        const ch = code[i];
        if (ch === '\\') { i += 2; continue; }
        if (ch === '\n') break;
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) { i++; break; }
        i++;
      }
      // Flag regex (`/…/i.test(...)`) ikut dikosongkan, jangan sampai huruf `i`
      // pada `/…/i` terbaca sebagai identifier.
      while (i < n && /[a-z]/.test(code[i])) i++;
      blank(start, i);
      prevSig = 'x';
      continue;
    }
    if (!/\s/.test(c)) prevSig = c;
    i++;
  }
  return out.join('');
}

// ---------------------------------------------------------------------------
// 2. Lingkup fungsi (rentang badan) + atribusi tiap deklarasi ke lingkupnya
// ---------------------------------------------------------------------------
const MAX_LOOKAHEAD = 400; // penjaga agar `function` tanpa `(`/`{` tidak melebar liar

export function findFunctions(s) {
  const fns = [];
  const re = /\bfunction\b/g;
  let m;
  while ((m = re.exec(s))) {
    let j = m.index + m[0].length;
    const jLimit = Math.min(s.length, j + MAX_LOOKAHEAD);
    while (j < jLimit && s[j] !== '(') j++;
    if (s[j] !== '(') continue;
    let depth = 0;
    let paramsEnd = -1;
    for (let k = j; k < s.length; k++) {
      if (s[k] === '(') depth++;
      else if (s[k] === ')') { depth--; if (depth === 0) { paramsEnd = k; break; } }
    }
    if (paramsEnd < 0) continue;
    let b = paramsEnd + 1;
    const bLimit = Math.min(s.length, b + MAX_LOOKAHEAD);
    while (b < bLimit && s[b] !== '{') b++;
    if (s[b] !== '{') continue;
    let d2 = 0;
    let end = -1;
    for (let p = b; p < s.length; p++) {
      if (s[p] === '{') d2++;
      else if (s[p] === '}') { d2--; if (d2 === 0) { end = p; break; } }
    }
    if (end < 0) continue;
    fns.push({
      start: m.index,
      params: s.slice(j + 1, paramsEnd),
      bodyStart: b,
      bodyEnd: end,
      declared: new Set(),
    });
  }
  return fns.sort((a, b) => a.start - b.start);
}

/**
 * Analisis satu berkas.
 * @param {string} code
 * @param {Set<string>} knownGlobals nama global yang sah dari luar berkas ini
 *   (global peramban + library + definisi berkas lain pada folder yang sama)
 * @return {{findings: {name: string, kind: string, line: number, message: string, snippet: string}[], fileGlobals: Set<string>}}
 */
export function analyse(code, knownGlobals = BUILTIN_GLOBALS) {
  const s = stripLiterals(code);
  const fns = findFunctions(s);
  const fileGlobals = new Set();

  /** Lingkup fungsi yang melingkupi posisi, terdalam lebih dulu. */
  const chain = (pos) => fns
    .filter((f) => f.start < pos && f.bodyEnd > pos)
    .sort((a, b) => b.start - a.start);
  /** Pemilik deklarasi: fungsi terdalam yang memuatnya, atau berkas (top level). */
  const declare = (name, pos) => {
    const owner = chain(pos)[0];
    if (owner) owner.declared.add(name);
    else fileGlobals.add(name);
  };

  for (const f of fns) {
    for (const part of f.params.split(',')) {
      const name = /^\s*([A-Za-z_$][\w$]*)/.exec(part);
      if (name) f.declared.add(name[1]);
    }
  }
  for (const re of [
    /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)/g,
    /\bfunction\s+([A-Za-z_$][\w$]*)/g,
    /\bclass\s+([A-Za-z_$][\w$]*)/g,
    /\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g,
  ]) {
    let m;
    while ((m = re.exec(s))) declare(m[1], m.index);
  }

  const visible = (name, pos) => fileGlobals.has(name) || chain(pos).some((f) => f.declared.has(name));

  const lines = code.split(/\r?\n/);
  const lineOf = (pos) => {
    let line = 1;
    for (let k = 0; k < pos; k++) if (code[k] === '\n') line++;
    return line;
  };
  const findings = [];
  const report = (name, pos, kind, message) => {
    const line = lineOf(pos);
    findings.push({ name, kind, line, message, snippet: (lines[line - 1] || '').trim().slice(0, 120) });
  };

  // (1) Alias window tanpa deklarasi pada lingkup yang melingkupinya.
  //     SENGAJA tidak memakai knownGlobals: alias ini ada di daftar global
  //     peramban justru karena itulah masalahnya.
  const aliasRe = new RegExp(`(^|[^A-Za-z0-9_$.])(${FORBIDDEN_ALIASES.join('|')})\\s*(?=[.[(])`, 'g');
  let am;
  while ((am = aliasRe.exec(s))) {
    const name = am[2];
    const pos = am.index + am[1].length;
    if (visible(name, pos)) continue;
    report(name, pos, 'alias-window',
      '`' + name + '` dipakai sebagai objek tanpa deklarasi pada lingkup ini — di peramban `' + name +
      '` adalah alias GLOBAL untuk `window`, sehingga kode menunjuk objek yang salah tanpa ReferenceError. ' +
      'Tulis `var self = this;` (atau `var self = window;`) di fungsi yang memakainya, atau pakai `window` eksplisit.');
  }

  // (2) Nama tak dikenal dipakai sebagai objek/pemanggilan.
  const identRe = /([A-Za-z_$][\w$]*)\s*(?=[.(\[])/g;
  let m;
  while ((m = identRe.exec(s))) {
    const name = m[1];
    const pos = m.index;
    const prev = pos > 0 ? s[pos - 1] : '';
    if (prev === '.' || /[A-Za-z0-9_$]/.test(prev)) continue; // properti atau sambungan nama
    if (KEYWORDS.has(name)) continue;
    if (knownGlobals.has(name)) continue;
    if (visible(name, pos)) continue;
    report(name, pos, 'nama-tak-dikenal',
      '`' + name + '` dipakai tetapi tidak dideklarasikan di berkas ini, tidak didefinisikan berkas lain pada folder frontend yang sama, dan bukan global peramban/library yang dikenal — kemungkinan salah ketik nama.');
  }

  return { findings, fileGlobals };
}

// ---------------------------------------------------------------------------
// 3. Global yang didefinisikan berkas/HTML lain pada folder yang sama
// ---------------------------------------------------------------------------
export function siblingGlobals(dir) {
  const names = new Set(BUILTIN_GLOBALS);
  for (const n of EXTERNAL_GLOBALS) names.add(n);
  for (const file of readdirSync(dir)) {
    if (!/\.(js|html)$/.test(file) || /\.min\.js$/.test(file)) continue;
    const code = stripLiterals(readFileSync(join(dir, file), 'utf8'));
    let m;
    const reWindow = /\bwindow\s*\.\s*([A-Za-z_$][\w$]*)\s*=/g;
    while ((m = reWindow.exec(code))) names.add(m[1]);
    const reVar = /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/g;
    while ((m = reVar.exec(code))) names.add(m[1]);
    const reFn = /\bfunction\s+([A-Za-z_$][\w$]*)/g;
    while ((m = reFn.exec(code))) names.add(m[1]);
  }
  return names;
}

// ---------------------------------------------------------------------------
// 4. Jalan (hanya saat dipanggil sebagai CLI — impor untuk uji tidak menulis apa pun)
// ---------------------------------------------------------------------------
export function scanFrontends(frontends = FRONTENDS) {
  const results = [];
  let totalFindings = 0;
  for (const { dir, label } of frontends) {
    if (!existsSync(dir)) continue;
    const globals = siblingGlobals(dir);
    const files = readdirSync(dir).sort()
      .filter((f) => f.endsWith('.js') && !f.endsWith('.min.js'))
      .map((f) => join(dir, f));
    for (const file of files) {
      const { findings } = analyse(readFileSync(file, 'utf8'), globals);
      totalFindings += findings.length;
      results.push({ file, label, findings });
    }
  }
  return { results, totalFindings };
}

function main() {
  const AS_JSON = process.argv.includes('--json');
  const LIST_ONLY = process.argv.includes('--list');

  if (LIST_ONLY) {
    for (const { dir } of FRONTENDS) {
      if (!existsSync(dir)) continue;
      for (const file of readdirSync(dir).sort()) {
        if (file.endsWith('.js') && !file.endsWith('.min.js')) console.log(join(dir, file));
      }
    }
    process.exit(0);
  }

  const { results, totalFindings } = scanFrontends();

  if (AS_JSON) {
    console.log(JSON.stringify({ totalFindings, results }, null, 2));
    process.exit(totalFindings ? 1 : 0);
  }

  console.log('=== Gerbang variabel global frontend ===');
  for (const { file, findings } of results) {
    if (!findings.length) continue;
    console.log('\n' + file);
    for (const f of findings) {
      console.log(`  ${String(f.line).padStart(5)}  ${f.kind.toUpperCase()}  ${f.name}`);
      console.log(`         ${f.message}`);
      console.log(`         > ${f.snippet}`);
    }
  }
  const clean = results.filter((r) => !r.findings.length).length;
  console.log(`\nBerkas dipindai: ${results.length} (${clean} bersih). Temuan: ${totalFindings}.`);
  if (totalFindings) {
    console.log('Perbaiki temuan di atas — variabel global tak dideklarasikan adalah kelas bug "login tidak pernah terbuka" (2026-10-10).');
    process.exit(1);
  }
  console.log('Tidak ada pemakaian variabel global tak dideklarasikan yang berisiko.');
  process.exit(0);
}

// Jalankan hanya bila berkas ini yang dieksekusi (`node scripts/check-frontend-globals.mjs`),
// bukan ketika diimpor uji smoke — impor tidak boleh memindai dan keluar sendiri.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
