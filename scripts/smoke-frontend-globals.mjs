// Uji smoke GERBANG VARIABEL GLOBAL FRONTEND (scripts/check-frontend-globals.mjs)
// — tanpa jaringan, tanpa DOM.
//
// Menguji pemindai itu sendiri, bukan berkas proyek saja: kalau pemindainya
// salah, "0 temuan" pada berkas asli tidak berarti apa-apa. Karena itu setiap
// pemeriksaan yang berbunyi "aman" di sini berpasangan dengan kontrol negatif
// yang membuktikan pemindai benar-benar menangkap masalahnya.
//
// Khusus bug produksi 2026-10-10 (`self.bootApp is not a function`):
//   1. versi rusak (tanpa `var self` di showLogin) HARUS tertangkap;
//   2. versi benar (berkas asli) TIDAK boleh menghasilkan temuan;
//   3. deklarasi `var self` di fungsi LAIN tidak boleh dianggap menolong —
//      inilah yang membedakan pemindai ini dari grep.
//
// Pakai: node scripts/smoke-frontend-globals.mjs   (atau: npm run smoke:frontend)
import { readFileSync } from 'node:fs';
import { analyse, stripLiterals, findFunctions, siblingGlobals, scanFrontends } from './check-frontend-globals.mjs';

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

/** Temuan bertipe tertentu untuk nama tertentu. */
const has = (findings, kind, name) => findings.some((f) => f.kind === kind && f.name === name);
const globalsOf = (...names) => new Set(names);

console.log('== 1. Stripper: posisi & baris terjaga ==');
{
  const src = [
    'var a = 1;',
    '// self.komentar()',
    "var s = 'self.dalamString()';",
    'var r = /self\\/regex/i.test(x);',
    '/* blok',
    '   self.blok() */',
    'var akhir = 2;',
  ].join('\n');
  const out = stripLiterals(src);
  check('panjang keluaran sama dengan masukan', out.length === src.length,
    `(${out.length} vs ${src.length})`);
  check('jumlah baris sama', out.split('\n').length === src.split('\n').length);
  check('komentar dinetralkan', out.indexOf('komentar') === -1);
  check('string dinetralkan', out.indexOf('dalamString') === -1);
  check('regex + flag dinetralkan', out.indexOf('regex') === -1 && !/\bi\b/.test(out));
  check('kode nyata tetap utuh', out.indexOf('var a = 1;') !== -1 && out.indexOf('var akhir = 2;') !== -1);
}

console.log('\n== 2. Pemeta lingkup fungsi ==');
{
  const src = 'var o = {\n  luar: function (a) {\n    var b = 1;\n    var f = function (c) { return a + b + c; };\n  }\n};';
  const fns = findFunctions(stripLiterals(src));
  check('dua fungsi bersarang ditemukan', fns.length === 2, `(ditemukan ${fns.length})`);
  check('fungsi dalam benar-benar termuat di fungsi luar',
    fns.length === 2 && fns[0].start < fns[1].start && fns[0].bodyEnd > fns[1].bodyEnd);
}

console.log('\n== 3. Alias window: bug asli tertangkap, kode benar bersih ==');
{
  const asli = readFileSync('portal/portal.js', 'utf8');

  // (a) Versi rusak: persis bug 2026-10-10 — `var self` di showLogin dibuang.
  const rusak = asli.replace(/\n\s*var self = \(this && this\.bootApp\)[^\n]*\n/, '\n');
  check('versi rusak benar-benar dipakai', rusak !== asli);
  const temuanRusak = analyse(rusak, globalsOf('Auth', 'App')).findings;
  check('versi rusak terdeteksi sebagai alias-window `self`', has(temuanRusak, 'alias-window', 'self'),
    `(temuan: ${temuanRusak.map((f) => f.kind + '/' + f.name).join(', ') || 'tidak ada'})`);
  const barisRusak = temuanRusak.filter((f) => f.kind === 'alias-window' && f.name === 'self').map((f) => f.line);
  check('deteksi menunjuk ke pemanggilan handler demo (sekitar baris 120-140)',
    barisRusak.some((l) => l >= 110 && l <= 145), `(baris: ${barisRusak.join(', ')})`);

  // (b) Berkas asli: tidak ada temuan alias.
  const bersih = analyse(asli, globalsOf('Auth', 'App')).findings;
  check('berkas asli tidak menghasilkan temuan alias-window',
    !bersih.some((f) => f.kind === 'alias-window'),
    `(temuan: ${bersih.map((f) => f.kind + '/' + f.name).join(', ') || 'tidak ada'})`);

  // (c) Deklarasi di fungsi LAIN tidak menolong (inti pemeriksaan sadar-lingkup).
  const lain = 'var A = {\n'
    + '  a: function () { var self = this; return self.a(); },\n'
    + '  b: function () { return self.b(); }\n'
    + '};';
  const temuanLain = analyse(lain).findings;
  check('deklarasi `var self` di fungsi lain TIDAK dianggap menolong',
    has(temuanLain, 'alias-window', 'self'));
  check('fungsi yang mendeklarasikannya sendiri tetap lolos',
    !temuanLain.some((f) => f.line === 2));

  // (d) Bentuk sah lain: deklarasi dari parameter/lingkup luar.
  const parameter = 'function luar(self) {\n  return function () { return self.x(); };\n}';
  check('`self` dari parameter fungsi luar dianggap sah',
    !analyse(parameter).findings.some((f) => f.kind === 'alias-window'));
}

console.log('\n== 4. Nama tak dikenal: salah ketik tertangkap ==');
{
  const typo = 'var A = {\n  jalan: function () { Auth.fetch("ping"); Auh.toast("halo"); }\n};';
  const temuan = analyse(typo, globalsOf('Auth')).findings;
  check('salah ketik nama (`Auh`) terdeteksi', has(temuan, 'nama-tak-dikenal', 'Auh'),
    `(temuan: ${temuan.map((f) => f.name).join(', ') || 'tidak ada'})`);
  check('nama yang memang global (`Auth`) tidak dilaporkan', !temuan.some((f) => f.name === 'Auth'));
  check('nama properti (`fetch`, `toast`) tidak dilaporkan',
    !temuan.some((f) => f.name === 'fetch' || f.name === 'toast'));
}

console.log('\n== 5. Tanpa temuan palsu pada pola yang lazim ==');
{
  const snippet = [
    'var cfg = { api: 1 };',                        // kunci objek
    'var hasil = /surat/i.test(nama) ? cfg.api : 0;', // regex + flag
    "var teks = 'self.palsu()';",                    // string berisi alias
    '// self.komentar()',                            // komentar
    'var arr = [1, 2].map(function (n) { return n * 2; });',
    'if (typeof window !== "undefined") { window.API_BASE = "x"; }',
  ].join('\n');
  const temuan = analyse(snippet).findings;
  check('tidak ada temuan palsu', temuan.length === 0,
    `(temuan: ${temuan.map((f) => f.kind + '/' + f.name + ' baris ' + f.line).join(', ')})`);
}

console.log('\n== 6. Gerbang pada berkas asli: bersih, tetapi tetap peka ==');
{
  // (a) Jalur yang benar-benar dipakai gerbang (daftar global dihitung dari
  //     definisi berkas sekitarnya, bukan daftar tulis-tangan di uji ini).
  const { results, totalFindings } = scanFrontends();
  // Menuntut kelima berkas yang diketahui benar-benar dipindai (bukti pemindai
  // tidak jalan di daftar kosong) tanpa mematok jumlah — berkas frontend baru
  // yang sah tidak boleh membuat uji ini gagal.
  const dipindai = results.map((r) => r.file.split('\\').join('/'));
  const wajib = ['portal/portal.js', 'portal/auth.js', 'portal/config.js', 'public/app.js', 'public/config.js'];
  const hilang = wajib.filter((f) => dipindai.indexOf(f) === -1);
  check('gerbang memindai seluruh berkas frontend yang diharapkan', hilang.length === 0,
    `(dipindai: ${dipindai.length}; tidak ikut: ${hilang.join(', ') || 'tidak ada'})`);
  for (const r of results) {
    if (r.findings.length) console.log(`         ${r.file}: ${r.findings.length} temuan`);
  }
  check('seluruh berkas frontend bersih dari temuan', totalFindings === 0,
    `(total temuan: ${totalFindings})`);

  // (b) Kepekaan gerbang pada berkas nyata: dengan daftar global yang SAMA
  //     (yang paling permisif), versi rusak dan salah ketik tetap tertangkap —
  //     bukti bahwa "0 temuan" tadi bukan karena gerbangnya buta.
  const portalGlobals = siblingGlobals('portal');
  const asli = readFileSync('portal/portal.js', 'utf8');
  const rusak = asli.replace(/\n\s*var self = \(this && this\.bootApp\)[^\n]*\n/, '\n');
  const temuanRusak = analyse(rusak, portalGlobals).findings.filter((f) => f.kind === 'alias-window');
  check('bug `self` tetap tertangkap walau daftar global permisif', temuanRusak.length > 0,
    `(temuan: ${temuanRusak.length})`);

  // Seluruh kemunculan diganti (bukan hanya yang pertama): kemunculan pertama
  // `Auth.fetch` di portal.js ada di dalam KOMENTAR — lewat stripper, komentar
  // memang tidak dianggap kode, jadi mengganti hanya satu kemunculan bisa
  // menghasilkan uji yang lolos semu.
  const typo = asli.split('Auth.fetch').join('Authh.fetch');
  check('salah ketik pada berkas nyata terdeteksi', typo !== asli,
    '(pola `Auth.fetch` tidak ditemukan — perbarui uji ini)');
  const temuanTypo = analyse(typo, portalGlobals).findings.filter((f) => f.kind === 'nama-tak-dikenal');
  check('salah ketik nama dideteksi pada berkas nyata', temuanTypo.length > 0,
    `(temuan: ${temuanTypo.length})`);
}

console.log(`\nHasil: ${pass} lulus, ${fail} gagal.`);
if (fail > 0) process.exit(1);
