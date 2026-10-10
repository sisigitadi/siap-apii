// ============================================================================
// check-legacy-duplicates.mjs — Deteksi definisi ganda antara berkas LAMA di
// editor Google Apps Script dan modul hasil build, SEBELUM deploy.
// ============================================================================
// Mengapa ini ada: semua berkas .gs di Apps Script berbagi SATU scope global.
// Bila editor masih menyimpan berkas lama (Backend.gs tunggal sebelum build
// dipecah, atau Aset.gs peninggalan zaman dulu) sementara modul baru sudah
// diunggah, maka nama yang sama terdefinisi dua kali. Apps Script TIDAK
// melaporkan ini sebagai error — runtime diam-diam memakai salah satunya
// (berkas yang dimuat paling akhir menang). Gejalanya persis bug "Aksi tidak
// dikenali" yang pernah terjadi: kode baru ada di project, tetapi salinan usang
// yang dieksekusi.
//
// Karena `clasp` tidak punya perintah hapus, penghapusan berkas lama dilakukan
// manual di editor. Skrip ini membuat langkah itu tidak bisa keliru: ia menarik
// isi editor yang SESUNGGUHNYA (clasp pull), lalu
//   1) melaporkan berkas di editor yang bukan bagian keluaran build,
//   2) menghitung definisi ganda antara berkas lama dan modul baru,
//   3) memastikan setiap simbol berkas lama juga ada di modul baru, sehingga
//      penghapusan terbukti tidak menghilangkan fungsi apa pun,
//   4) memeriksa definisi ganda antar modul baru sendiri.
//
// Pakai:
//   node scripts/check-legacy-duplicates.mjs                    (tarik editor)
//   node scripts/check-legacy-duplicates.mjs --json             (untuk skrip lain)
//   node scripts/check-legacy-duplicates.mjs --from .editor-snapshot
//   node scripts/check-legacy-duplicates.mjs --from snap --no-pull   (offline)
//   node scripts/check-legacy-duplicates.mjs --build apps-script
//
// Kode keluar:
//   0  editor sudah bersih (hanya berkas keluaran build) & tidak ada definisi ganda
//   1  ada temuan: berkas lama / definisi ganda / simbol yang belum pindah
//   2  tidak dapat diverifikasi (belum login clasp, build belum ada, snapshot tak sah)
// ============================================================================
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERATED_FILES, listBackendModules } from './backend-modules.mjs';

// ---------------------------------------------------------------------------
// Pemindai simbol global (fungsi, var/let/const, class) pada satu berkas .gs.
//
// Pendekatan: buang komentar, string, template literal, dan regex literal (agar
// isinya tidak dianggap kode), lalu tokenkan sisa kode dan catat deklarasi yang
// berada di kedalaman kurung kurawal 0. Definisi di dalam fungsi tidak dihitung
// karena yang bentrok antar berkas hanya scope global.
//
// Batasan yang disadari: destructuring (`const { a } = …`) dan fungsi ekspresi
// bernama tidak menghasilkan simbol; `let` di header for-loop pada aras teratas
// ikut tercatat. Semuanya hanya bisa membuat deteksi lebih longgar, bukan salah
// melaporkan definisi ganda antar berkas.
// ---------------------------------------------------------------------------
export function stripToCode(src) {
  const out = [];
  const lineOfOut = [];
  let line = 1;
  const emit = (ch) => { out.push(ch); lineOfOut.push(line); };
  let depth = 0;
  let lastSig = '';
  let mode = 'code';
  let strCh = '';
  let inClass = false;
  const frames = []; // template literal yang sedang dilewati
  const regexAllowedAfter = /[=(,:[!&|?+\-*%~^<>{;}]/;

  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];

    if (mode === 'template') {
      if (c === '\\') { i += 2; continue; }
      if (c === '\n') { line++; emit('\n'); i++; continue; }
      if (c === '`') { const f = frames.pop(); depth = f.depth; mode = 'code'; i++; continue; }
      if (c === '$' && d === '{') {
        const f = frames[frames.length - 1];
        f.depth = depth; f.inInterp = true; depth = 0; mode = 'code'; i += 2; continue;
      }
      i++; continue;
    }
    if (mode === 'line') { if (c === '\n') { line++; emit('\n'); mode = 'code'; } i++; continue; }
    if (mode === 'block') {
      if (c === '*' && d === '/') { mode = 'code'; i += 2; continue; }
      if (c === '\n') { line++; emit('\n'); }
      i++; continue;
    }
    if (mode === 'str') {
      if (c === '\\') { i += 2; continue; }
      if (c === '\n') { line++; emit('\n'); }
      if (c === strCh) mode = 'code';
      i++; continue;
    }
    if (mode === 'regex') {
      if (c === '\\') { i += 2; continue; }
      if (c === '\n') { line++; emit('\n'); mode = 'code'; i++; continue; } // regex tak boleh multi-baris
      if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) mode = 'code';
      i++; continue;
    }

    // mode === 'code'
    if (c === '\n') { emit(c); line++; i++; continue; }
    if (c === '/' && d === '/') { mode = 'line'; i += 2; continue; }
    if (c === '/' && d === '*') { mode = 'block'; i += 2; continue; }
    if (c === '"' || c === "'") { mode = 'str'; strCh = c; i++; continue; }
    if (c === '`') { frames.push({ depth, inInterp: false }); mode = 'template'; i++; continue; }
    if (c === '/' && (lastSig === '' || regexAllowedAfter.test(lastSig))) { mode = 'regex'; inClass = false; i++; continue; }
    if (c === '{') { depth++; emit(c); lastSig = c; i++; continue; }
    if (c === '}') {
      const top = frames[frames.length - 1];
      if (depth === 0 && top && top.inInterp) { top.inInterp = false; depth = top.depth; mode = 'template'; i++; continue; }
      depth = Math.max(0, depth - 1); emit(c); lastSig = c; i++; continue;
    }
    if (!/\s/.test(c)) lastSig = c;
    emit(c);
    i++;
  }
  return { code: out.join(''), lineOf: lineOfOut };
}

const ID = /[A-Za-z_$][A-Za-z0-9_$]*/y;

/** Deklarasi scope global dari satu sumber .gs: [{ kind, name, line }]. */
export function globalSymbols(src) {
  const { code, lineOf } = stripToCode(src);
  const tokens = [];
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (/\s/.test(c)) { i++; continue; }
    ID.lastIndex = i;
    const m = ID.exec(code);
    if (m) { tokens.push({ v: m[0], id: true, pos: i }); i = ID.lastIndex; continue; }
    tokens.push({ v: c, id: false, pos: i });
    i++;
  }

  const lineAt = (pos) => lineOf[pos] || 1;
  const out = [];
  const seen = new Set();
  const push = (kind, name, pos) => {
    const key = `${kind}:${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, name, line: lineAt(pos) });
  };
  // Tanda yang membuat `function` berikutnya adalah ekspresi, bukan deklarasi
  // global (mis. `var f = function g() { … };`).
  const exprBefore = new Set(['=', '(', ',', ':', '[', '!', '?', '&', '|', '=>', 'return', 'typeof', 'new']);

  let depth = 0;
  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t];
    if (!tok.id) {
      if (tok.v === '{') depth++;
      else if (tok.v === '}') depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0) continue;
    const prev = tokens[t - 1];
    const prevIsExpr = prev && exprBefore.has(prev.v);
    if ((tok.v === 'function' || tok.v === 'class') && !prevIsExpr) {
      const name = tokens[t + 1];
      if (name && name.id) push(tok.v === 'class' ? 'class' : 'function', name.v, name.pos);
      continue;
    }
    if ((tok.v === 'var' || tok.v === 'let' || tok.v === 'const') && !(prev && prev.v === '.')) {
      const name = tokens[t + 1];
      if (!name || !name.id) continue; // destructuring: sengaja dilewati
      const after = tokens[t + 2];
      if (after && ['=', ';', ',', ')'].includes(after.v)) push('var', name.v, name.pos);
      // Deklarator lain dalam satu pernyataan: `var a = 1, b = 2;`
      let parens = 0;
      let brackets = 0;
      for (let k = t + 2; k < tokens.length; k++) {
        const s = tokens[k];
        if (!s.id) {
          if (s.v === '(') parens++;
          else if (s.v === ')') { if (parens === 0) break; parens--; }
          else if (s.v === '[') brackets++;
          else if (s.v === ']') brackets--;
          else if (s.v === '{') depth++;
          else if (s.v === '}') { if (depth === 0) break; depth--; }
          else if (s.v === ';' && parens === 0 && brackets === 0 && depth === 0) break;
          else if (s.v === ',' && parens === 0 && brackets === 0 && depth === 0) {
            const nxt = tokens[k + 1];
            const aft = tokens[k + 2];
            if (nxt && nxt.id && (!aft || ['=', ';', ','].includes(aft.v))) push('var', nxt.v, nxt.pos);
          }
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const main = () => {
  const ARGS = process.argv.slice(2);
  const argOf = (name) => {
    const i = ARGS.indexOf(name);
    return i !== -1 && ARGS[i + 1] && !ARGS[i + 1].startsWith('-') ? ARGS[i + 1] : null;
  };
  const FROM = argOf('--from');
  const BUILD_DIR = resolve(argOf('--build') || 'apps-script');
  const NO_PULL = ARGS.includes('--no-pull');
  const AS_JSON = ARGS.includes('--json');
  const QUIET = ARGS.includes('--quiet');
  const CLASP = 'npx --yes @google/clasp@3';
  const MAX_NAMES = 12;

  if (ARGS.includes('--help') || ARGS.includes('-h')) {
    console.log(`Deteksi definisi ganda antara berkas lama di editor Apps Script dan modul hasil build.

Pakai: node scripts/check-legacy-duplicates.mjs [opsi]

  --from <dir>   Pakai folder ini sebagai salinan editor. Bila belum berisi
                 appsscript.json, isinya ditarik dari Google ke folder tersebut
                 (tersimpan agar bisa diperiksa manual).
  --no-pull      Jangan tarik dari Google; hanya baca snapshot yang ada di
                 --from (untuk uji otomatis & pemakaian offline).
  --build <dir>  Folder hasil build yang dibandingkan (default: apps-script).
  --json         Keluarkan hasil sebagai JSON (dipakai scripts/deploy-gas.mjs).
  --quiet        Sembunyikan daftar nama (hanya ringkasan angka).
  --help, -h     Bantuan ini.

Kode keluar: 0 bersih · 1 ada temuan · 2 tidak dapat diverifikasi.`);
    process.exit(0);
  }

  const log = (...m) => { if (!AS_JSON) console.log(...m); };
  const ok = (m) => log(`OK   ${m}`);
  const warn = (m) => log(`!    ${m}`);
  const bad = (m) => log(`FAIL ${m}`);
  const info = (m) => log(`     ${m}`);

  /** Nama berkas editor untuk sebuah berkas hasil tarikan (clasp: .js <-> .gs). */
  const editorName = (f) => (f.endsWith('.js') ? `${f.slice(0, -3)}.gs` : f);
  /** Kunci pembanding antar sisi: nama berkas tanpa ekstensi. */
  const fileKey = (f) => f.replace(/\.[^.]+$/, '');
  const mask = (id) => `${id.slice(0, 6)}…${id.slice(-4)}`;

  const snapshotDir = FROM ? resolve(FROM) : mkdtempSync(join(tmpdir(), 'apii-editor-'));
  const cleanupSnapshot = () => { if (!FROM) rmSync(snapshotDir, { recursive: true, force: true }); };
  const finish = (status, payload, human) => {
    if (AS_JSON) console.log(JSON.stringify(payload, null, 2));
    else human();
    cleanupSnapshot();
    process.exit(status === 'clean' ? 0 : status === 'blocked' ? 1 : 2);
  };
  const unverified = (reason, hint) => finish('unverified', { status: 'unverified', reason, hint }, () => {
    console.log('\n=== Deteksi definisi ganda: editor Apps Script vs modul hasil build ===');
    console.log(`\nFAIL Tidak dapat memverifikasi: ${reason}`);
    if (hint) console.log(`     → ${hint}`);
    console.log('\nEditor TIDAK diperiksa — jangan menganggap migrasi sudah aman.');
  });

  // -------------------------------------------------------------------------
  // 1) Sisi build: berkas yang akan diunggah + simbol globalnya
  // -------------------------------------------------------------------------
  if (!existsSync(BUILD_DIR)) {
    unverified(`folder hasil build tidak ditemukan: ${BUILD_DIR}`,
      'Jalankan `npm run build:gas` lebih dahulu (pastikan aset di "Dokumen Sumber/" tersedia).');
  }
  const buildFiles = readdirSync(BUILD_DIR).filter((f) => f.endsWith('.gs') || f === 'appsscript.json').sort();
  if (!buildFiles.some((f) => f.endsWith('.gs'))) {
    unverified(`tidak ada berkas .gs di ${BUILD_DIR}`, 'Jalankan `npm run build:gas` lebih dahulu.');
  }
  const buildSymbols = new Map(); // nama -> [{ kind, file }]
  for (const f of buildFiles.filter((x) => x.endsWith('.gs'))) {
    for (const s of globalSymbols(readFileSync(join(BUILD_DIR, f), 'utf8'))) {
      if (!buildSymbols.has(s.name)) buildSymbols.set(s.name, []);
      buildSymbols.get(s.name).push({ kind: s.kind, file: f });
    }
  }
  const buildDuplicates = [...buildSymbols.entries()]
    .filter(([, defs]) => new Set(defs.map((d) => d.file)).size > 1)
    .map(([name, defs]) => ({ name, files: [...new Set(defs.map((d) => d.file))] }));

  const expectedModules = new Set([...listBackendModules(), 'AsetLogo.gs', 'AsetStempel.gs', ...GENERATED_FILES]);
  const unexpectedBuild = buildFiles.filter((f) => f.endsWith('.gs') && !expectedModules.has(f));

  // -------------------------------------------------------------------------
  // 2) Sisi editor: tarik isi project Apps Script yang sesungguhnya
  // -------------------------------------------------------------------------
  let scriptId = '';
  if (!NO_PULL) {
    if (existsSync('.clasp.json')) {
      try {
        const j = JSON.parse(readFileSync('.clasp.json', 'utf8'));
        if (j.scriptId) scriptId = j.scriptId;
      } catch { /* pesan jelas menyusul */ }
    }
    if (!scriptId) {
      for (const file of ['.env', '.env.local']) {
        if (!existsSync(file)) continue;
        const m = readFileSync(file, 'utf8').match(/^\s*GAS_SCRIPT_ID\s*=\s*(.+)$/m);
        if (m) { scriptId = m[1].trim().replace(/^["']|["']$/g, ''); break; }
      }
    }
    if (!scriptId) process.env.GAS_SCRIPT_ID && (scriptId = process.env.GAS_SCRIPT_ID);
    if (!scriptId) {
      unverified('Script ID tidak ditemukan',
        'Isi .clasp.json atau GAS_SCRIPT_ID di .env (lihat langkah 1 scripts/deploy-gas.mjs).');
    }
    if (!AS_JSON) {
      console.log('\n=== Deteksi definisi ganda: editor Apps Script vs modul hasil build ===');
      console.log(`\n[1] Menarik isi editor (script ID ${mask(scriptId)}) → ${snapshotDir}`);
    }
    mkdirSync(snapshotDir, { recursive: true });
    writeFileSync(join(snapshotDir, '.clasp.json'), `${JSON.stringify({ scriptId, rootDir: '.' }, null, 2)}\n`);
    const r = spawnSync(`${CLASP} pull -f`, { cwd: snapshotDir, shell: true, encoding: 'utf8', timeout: 180000 });
    if (r.status !== 0 || r.error) {
      const detail = `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-4).join(' | ');
      unverified(`clasp pull gagal${detail ? ` (${detail})` : ''}`,
        'Pastikan sudah login: npx --yes @google/clasp@3 login  — lalu jalankan ulang perintah ini.');
    }
    if (!AS_JSON) {
      const pulled = readdirSync(snapshotDir).filter((f) => f.endsWith('.js') || f === 'appsscript.json');
      log(`    ✔ ${pulled.length} berkas ditarik: ${pulled.map(editorName).join(', ')}`);
    }
  } else if (!existsSync(join(snapshotDir, 'appsscript.json'))) {
    unverified(`snapshot ${snapshotDir} tidak berisi appsscript.json`,
      'Tanpa --no-pull skrip ini menarik sendiri; dengan --no-pull arahkan --from ke folder salinan editor.');
  }

  const editorFiles = readdirSync(snapshotDir).filter((f) => f.endsWith('.js') || f === 'appsscript.json').sort();
  if (!editorFiles.includes('appsscript.json')) {
    unverified(`snapshot ${snapshotDir} tidak berisi appsscript.json`,
      'Arahkan --from ke folder hasil `clasp pull` project Apps Script.');
  }

  const expectedKeys = new Set(buildFiles.map(fileKey));
  const legacy = [];
  const editorSymbols = new Map(); // nama -> [berkas editor]
  for (const f of editorFiles) {
    if (f === 'appsscript.json') continue;
    const syms = globalSymbols(readFileSync(join(snapshotDir, f), 'utf8'));
    for (const s of syms) {
      if (!editorSymbols.has(s.name)) editorSymbols.set(s.name, []);
      editorSymbols.get(s.name).push({ file: editorName(f), kind: s.kind });
    }
    if (expectedKeys.has(fileKey(f))) continue; // bagian keluaran build: normal
    const collisions = syms.filter((s) => buildSymbols.has(s.name));
    const uncovered = syms.filter((s) => !buildSymbols.has(s.name));
    const groups = new Map(); // berkas modul -> jumlah nama yang sama
    for (const s of collisions) {
      for (const d of buildSymbols.get(s.name)) groups.set(d.file, (groups.get(d.file) || 0) + 1);
    }
    legacy.push({
      file: editorName(f),
      pulledAs: f,
      bytes: statSync(join(snapshotDir, f)).size,
      symbols: syms.length,
      collisionCount: collisions.length,
      collisionsByModule: [...groups.entries()].sort((a, b) => b[1] - a[1]).map(([file, count]) => ({ file, count })),
      collisionNames: collisions.map((s) => `${s.name} (${buildSymbols.get(s.name).map((d) => d.file).join(', ')})`),
      uncovered: uncovered.map((s) => `${s.name} (baris ${s.line})`),
    });
  }
  const missing = buildFiles.filter((f) => !editorFiles.some((e) => fileKey(e) === fileKey(f)));
  const editorSelfDuplicates = [...editorSymbols.entries()]
    .filter(([, defs]) => new Set(defs.map((d) => d.file)).size > 1)
    .map(([name, defs]) => ({ name, files: [...new Set(defs.map((d) => d.file))] }));

  // -------------------------------------------------------------------------
  // 3) Laporan
  // -------------------------------------------------------------------------
  // Catatan: berkas asing di folder build hanya diperingatkan, bukan digagalkan di
  // sini — preflight `clasp status` di scripts/deploy-gas.mjs sudah menolaknya
  // (daftar berkas unggahan harus tepat), dan skrip ini fokus pada definisi ganda.
  const problems = [];
  if (legacy.length) problems.push(`${legacy.length} berkas lama masih ada di editor`);
  if (buildDuplicates.length) problems.push(`${buildDuplicates.length} definisi ganda antar modul baru`);

  finish(problems.length ? 'blocked' : 'clean', {
    status: problems.length ? 'blocked' : 'clean',
    build: { dir: BUILD_DIR, files: buildFiles, symbols: buildSymbols.size, duplicateSymbols: buildDuplicates, unexpectedFiles: unexpectedBuild },
    editor: {
      snapshot: snapshotDir,
      scriptId: scriptId ? mask(scriptId) : null,
      files: editorFiles.map(editorName),
      legacy,
      missingBuildFiles: missing,
      duplicateSymbols: editorSelfDuplicates,
    },
    problems,
  }, () => {
    if (QUIET) {
      log(`\n[2] Build  : ${buildFiles.length} berkas, ${buildSymbols.size} simbol global` +
        (buildDuplicates.length ? `, ${buildDuplicates.length} GANDA` : ', tidak ada ganda'));
      log(`[3] Editor : ${editorFiles.length} berkas${legacy.length ? `, ${legacy.length} di antaranya LAMA` : ', bersih'}`);
    } else {
      console.log(`\n[2] Sisi build (${BUILD_DIR})`);
      console.log(`    ${buildFiles.length} berkas: ${buildFiles.join(', ')}`);
      info(`${buildSymbols.size} simbol global terdeteksi.`);
      if (buildDuplicates.length) {
        bad(`${buildDuplicates.length} simbol terdefinisi di lebih dari satu modul baru:`);
        for (const d of buildDuplicates.slice(0, MAX_NAMES)) info(`- ${d.name}: ${d.files.join(' & ')}`);
        info('Simbol harus ada di SATU modul saja (scope global Apps Script dipakai bersama).');
      } else {
        ok('Tidak ada definisi ganda antar modul baru.');
      }
      if (unexpectedBuild.length) {
        warn(`Berkas di luar daftar modul/aset: ${unexpectedBuild.join(', ')} — preflight deploy akan menolaknya.`);
      }

      console.log(`\n[3] Sisi editor (${editorFiles.length} berkas, snapshot ${snapshotDir})`);
      console.log(`    ${editorFiles.map(editorName).join(', ')}`);
      if (missing.length) {
        info(`${missing.length} berkas build belum ada di editor (normal bila dijalankan sebelum \`clasp push\`): ${missing.join(', ')}`);
      }
      if (editorSelfDuplicates.length) {
        warn(`${editorSelfDuplicates.length} simbol ganda di antara berkas editor sendiri: ${editorSelfDuplicates.slice(0, MAX_NAMES).map((d) => d.name).join(', ')}`);
      }
    }

    if (!legacy.length) {
      console.log('\nOK   Editor hanya berisi berkas keluaran build — tidak ada berkas lama, tidak ada definisi ganda.');
    } else {
      console.log('\n[4] Berkas lama yang harus dihapus dari editor');
      for (const l of legacy) {
        bad(`${l.file} (${l.bytes.toLocaleString('id-ID')} byte, ${l.symbols} simbol global di dalamnya)`);
        if (l.collisionCount) {
          info(`${l.collisionCount} simbol JUGA ada di modul baru → definisi ganda; Apps Script memakai salah satunya diam-diam.`);
          if (!QUIET) {
            for (const g of l.collisionsByModule.slice(0, 8)) info(`· ${g.count} nama sama dengan ${g.file}`);
            if (l.collisionsByModule.length > 8) info(`· … dan ${l.collisionsByModule.length - 8} modul lain`);
            for (const n of l.collisionNames.slice(0, MAX_NAMES)) info(`- ${n}`);
            if (l.collisionNames.length > MAX_NAMES) info(`- … dan ${l.collisionNames.length - MAX_NAMES} nama lain (pakai --json untuk daftar penuh)`);
          }
        }
        if (l.uncovered.length) {
          bad(`${l.uncovered.length} simbol BELUM ada di modul baru — JANGAN hapus berkas ini sebelum simbol itu dipindahkan:`);
          for (const n of l.uncovered) info(`- ${n}`);
        } else {
          ok(`Semua ${l.symbols} simbolnya sudah ada di modul baru → penghapusan terbukti tidak menghilangkan fungsi.`);
        }
      }
      console.log('\nLangkah: buka editor Apps Script → klik kanan berkas di atas → Delete.');
      console.log('Kemudian jalankan ulang `npm run deploy:gas` (push diulang dengan aman; versi baru belum dibuat).');
    }

    console.log(`\n${problems.length ? `FAIL ${problems.length} masalah: ${problems.join('; ')} → jangan deploy dulu.` : 'OK   Tidak ada definisi ganda: aman untuk melanjutkan deploy.'}`);
  });
};

// Hanya jalankan CLI bila berkas ini dieksekusi langsung (impor untuk uji aman).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
