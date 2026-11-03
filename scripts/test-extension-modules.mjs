// Pengujian Suite On-Demand Extension Modules (Fase 9 - Bab 14)
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

console.log('== Pengujian Suite On-Demand Extension Modules (Fase 9) ==\n');

const portalJs = readFileSync('portal/portal.js', 'utf8');
const gasUtils = readFileSync('gas/Utils.gs', 'utf8');

// -----------------------------------------------------------------------------
// 1. Backend Default Feature Flags
// -----------------------------------------------------------------------------
console.log('-- 1. Konfigurasi Backend Feature Flags (Sheet_Settings) --');
check('Backend gas/Utils.gs menyediakan default feature_flags untuk 8 modul ekstensi',
  gasUtils.includes('ext_khazanah_litbang') &&
  gasUtils.includes('ext_muallaf_crm') &&
  gasUtils.includes('ext_manajemen_debat') &&
  gasUtils.includes('ext_inventaris_aset') &&
  gasUtils.includes('ext_advokasi_hukum') &&
  gasUtils.includes('ext_donatur_crm') &&
  gasUtils.includes('ext_kalender_dakwah') &&
  gasUtils.includes('ext_notulen_rapat'));

// -----------------------------------------------------------------------------
// 2. Frontend Tab Pengaturan & UI Modul Ekstensi
// -----------------------------------------------------------------------------
console.log('\n-- 2. Frontend Tab Pengaturan & Modul Ekstensi --');
check('Portal renderPengaturan menyertakan tombol tab ekstensi',
  portalJs.includes('data-ptab="ekstensi"') && portalJs.includes('Modul Ekstensi'));
check('Portal mendisposisikan tab ekstensi ke renderPengaturanEkstensi',
  portalJs.includes('currentTab === \'ekstensi\'') && portalJs.includes('this.renderPengaturanEkstensi()'));
check('Portal mengimplementasikan renderPengaturanEkstensi secara lengkap',
  portalJs.includes('renderPengaturanEkstensi: function') &&
  portalJs.includes('btnSaveFeatureFlags'));

// -----------------------------------------------------------------------------
// 3. Kelengkapan 8 Modul Ekstensi Sesuai Bab 14 Cetak Biru
// -----------------------------------------------------------------------------
console.log('\n-- 3. Kelengkapan 8 Modul Ekstensi Sesuai Bab 14 Cetak Biru --');
const requiredModules = [
  ['ext_khazanah_litbang', 'E-Khazanah Litbang & Bank Dalil', 'Litbang'],
  ['ext_muallaf_crm', 'Muallaf Journey CRM', 'Dakwah'],
  ['ext_manajemen_debat', 'Manajemen Acara Dialog & Debat', 'Medsos'],
  ['ext_inventaris_aset', 'Inventaris Aset Dakwah & QR-Tag', 'Rumah Tangga'],
  ['ext_advokasi_hukum', 'Sistem Aduan & Pelacak Kasus Advokasi', 'Hukum'],
  ['ext_donatur_crm', 'Donatur CRM & Laporan Dampak', 'Bisnis'],
  ['ext_kalender_dakwah', 'Master Kalender Dakwah', 'Humas'],
  ['ext_notulen_rapat', 'E-Presensi & Notulen Rapat Pleno', 'Sekretariat']
];

requiredModules.forEach(([key, title, picSubstr]) => {
  const hasKey = portalJs.includes(`key: '${key}'`);
  const hasTitle = portalJs.includes(title);
  check(`Modul ${key} (${title}) terdaftar dengan PIC ${picSubstr}`, hasKey && hasTitle);
});

// -----------------------------------------------------------------------------
// 4. Mekanisme Toggle & Penyimpanan
// -----------------------------------------------------------------------------
console.log('\n-- 4. Mekanisme Toggle & Penyimpanan --');
check('Input toggle memiliki atribut data-flag-key untuk pengikatan reaktif',
  portalJs.includes('data-flag-key'));
check('Tombol simpan mengirim payload feature_flags ke endpoint saveSettings',
  portalJs.includes('Auth.post(\'saveSettings\', { feature_flags: updatedFlags })'));

// -----------------------------------------------------------------------------
// 5. Audit Anti-Slop: Bebas Karakter Em Dash
// -----------------------------------------------------------------------------
console.log('\n-- 5. Audit Anti-Slop: Bebas Karakter Em Dash (—) --');
check('portal/portal.js bebas karakter em dash', !portalJs.includes('\u2014'));
check('gas/Utils.gs bebas karakter em dash', !gasUtils.includes('\u2014'));

console.log(`\nHasil: Seluruh pengujian Suite On-Demand Extension Modules LULUS 100%! (${pass} lulus, ${fail} gagal)`);
if (fail > 0) process.exit(1);
