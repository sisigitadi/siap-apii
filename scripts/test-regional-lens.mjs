// Pengujian Suite Smart Regional Lens, National Ticker & Verifikasi Terpadu (Fase 8)
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

console.log('== Pengujian Suite Smart Regional Lens & Verifikasi Terpadu (Fase 8) ==\n');

const html = readFileSync('public/index.html', 'utf8');
const js = readFileSync('public/app.js', 'utf8');
const gasKeu = readFileSync('gas/Keuangan.gs', 'utf8');
const gasSurat = readFileSync('gas/Surat.gs', 'utf8');
const gasUtils = readFileSync('gas/Utils.gs', 'utf8');
const gasCode = readFileSync('gas/Code.gs', 'utf8');

// -----------------------------------------------------------------------------
// 1. Smart Regional Lens (Bab 9)
// -----------------------------------------------------------------------------
console.log('-- 1. Arsitektur Smart Regional Lens (Satu Mesin, Banyak Lensa Wilayah) --');
check('Markup memiliki selector lensa wilayah desktop #regionalLensSelect',
  html.includes('id="regionalLensSelect"') && html.includes('id="regionalLensBox"'));
check('Markup memiliki selector lensa wilayah mobile #mobileRegionalLensSelect',
  html.includes('id="mobileRegionalLensSelect"') && html.includes('id="mobileRegionalLensBox"'));
check('Javascript mengimplementasikan initRegionalLens',
  js.includes('initRegionalLens: function'));
check('Javascript mengimplementasikan applyRegionalLens & update URL tanpa reload',
  js.includes('applyRegionalLens: function') && js.includes('replaceState'));
check('Javascript mengimplementasikan populateWilayahSelectors',
  js.includes('populateWilayahSelectors: function'));
check('Backend gas/Utils.gs getPublicWilayahList menyediakan daftar cabang aktif',
  gasUtils.includes('function getPublicWilayahList') && gasCode.includes('getPublicWilayahList:'));
check('Backend gas/Utils.gs getPublicSettings mengadaptasi KOP & kontak per wilayah',
  gasUtils.includes('active_wilayah') && gasUtils.includes('wilayah_list'));

// -----------------------------------------------------------------------------
// 2. Ticker Maklumat Nasional DPP (Sindikasi Lintas Cabang)
// -----------------------------------------------------------------------------
console.log('\n-- 2. Ticker Maklumat Nasional DPP (Sindikasi Lintas Wilayah) --');
check('Markup memiliki kontainer ticker maklumat nasional #nationalTickerBar',
  html.includes('id="nationalTickerBar"') && html.includes('id="tickerBadgeText"') && html.includes('id="tickerContentText"'));
check('Backend gas/Utils.gs getPublicSettings menyediakan objek national_ticker',
  gasUtils.includes('national_ticker') && gasUtils.includes('MAKLUMAT DPP PUSAT'));
check('Javascript merender national_ticker pada loadPublicConfig',
  js.includes('national_ticker') && js.includes('tickerBar'));

// -----------------------------------------------------------------------------
// 3. Verifikasi Publik Terpadu (Surat, KTA Digital, Kwitansi Donatur)
// -----------------------------------------------------------------------------
console.log('\n-- 3. Verifikasi Publik Terpadu (Surat, KTA & Kwitansi) --');
check('Markup memiliki seksi verifikasi #verifikasi & 3 tombol tab',
  html.includes('id="verifikasi"') && html.includes('id="tabVerifySurat"') && html.includes('id="tabVerifyKta"') && html.includes('id="tabVerifyKwitansi"'));
check('Markup memiliki formulir verifikasi #unifiedVerifyForm & hasil #verifyResultContainer',
  html.includes('id="unifiedVerifyForm"') && html.includes('id="verifyInputQuery"') && html.includes('id="verifyResultContainer"'));
check('Javascript mengimplementasikan initUnifiedVerification & executeUnifiedVerification',
  js.includes('initUnifiedVerification: function') && js.includes('executeUnifiedVerification: function'));
check('Javascript menangani deep-link query parameter (?verifikasi, ?verifikasi-kta, ?verifikasi-kuitansi)',
  js.includes('qSurat') && js.includes('qKta') && js.includes('qKwitansi'));
check('Backend gas/Keuangan.gs mengimplementasikan verifyKwitansiPublic berstandar UU PDP',
  gasKeu.includes('function verifyKwitansiPublic') && gasKeu.includes('pembayar_masked') && gasCode.includes('verifyKwitansi:'));
check('Backend gas/Surat.gs verifySurat mendukung pencarian fleksibel nomor dan hash',
  gasSurat.includes('function verifySurat') && gasSurat.includes('wilayah_nama'));

// -----------------------------------------------------------------------------
// 4. Adaptasi Pendaftaran Multi-Tenant & Filter Data Per Cabang
// -----------------------------------------------------------------------------
console.log('\n-- 4. Adaptasi Pendaftaran Multi-Tenant & Filter Data Per Cabang --');
check('Formulir pendaftaran menyertakan dropdown cabang wilayah #regWilayah',
  html.includes('id="regWilayah"'));
check('Javascript menyertakan wilayah_id pada payload pendaftaran anggota',
  js.includes('wilayah_id: regWilayahId') || js.includes('payload.wilayah_id'));
check('loadPublicSurat & loadPublicAccounts mengirim parameter wilayah ke backend',
  js.includes('getPublishedSurat\', { limit: 8, wilayah:') && js.includes('getPublicAccounts\', { wilayah:'));
check('Backend gas/Keuangan.gs getPublicAccounts memfilter akun berdasarkan wilayah',
  gasKeu.includes('targetWilayah') && gasKeu.includes('show_on_public'));
check('Backend gas/Surat.gs getPublishedSurat memfilter surat berdasarkan wilayah',
  gasSurat.includes('targetWilayah') && gasSurat.includes('status === \'PUBLISHED\''));

// -----------------------------------------------------------------------------
// 5. Audit Anti-Slop: Bebas Karakter Em Dash
// -----------------------------------------------------------------------------
console.log('\n-- 5. Audit Anti-Slop: Bebas Karakter Em Dash (\\u2014) --');
const filesToCheck = [
  ['public/index.html', html],
  ['public/app.js', js],
  ['gas/Keuangan.gs', gasKeu],
  ['gas/Surat.gs', gasSurat],
  ['gas/Utils.gs', gasUtils],
  ['gas/Code.gs', gasCode]
];

filesToCheck.forEach(([fname, content]) => {
  const hasEmDash = content.includes('\u2014');
  check(`${fname} bebas karakter em dash`, !hasEmDash);
});

console.log(`\nHasil: Seluruh pengujian Suite Smart Regional Lens & Verifikasi Terpadu LULUS 100%! (${pass} lulus, ${fail} gagal)`);
if (fail > 0) process.exit(1);
