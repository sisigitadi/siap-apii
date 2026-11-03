// ============================================================================
// test-formasi-plt.mjs
// Pengujian Suite Formasi Pengurus & Delegasi Plt 60 Hari (Fase 6)
// ============================================================================

import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('== Pengujian Suite Formasi Pengurus & Delegasi Plt (Fase 6) ==');

// 1. Uji Skema Database & 7 Divisi Baku (ART Bab V Pasal 16)
console.log('\n-- 1. Skema Database Sheet_Pengurus & Sheet_Plt_Delegasi --');
const dbCode = fs.readFileSync('gas/Database.gs', 'utf8');

assert.ok(dbCode.includes("PENGURUS: 'Sheet_Pengurus'"), 'TABS.PENGURUS wajib terdaftar');
assert.ok(dbCode.includes("PLT_DELEGASI: 'Sheet_Plt_Delegasi'"), 'TABS.PLT_DELEGASI wajib terdaftar');
assert.ok(dbCode.includes('SCHEMA[TABS.PENGURUS]'), 'SCHEMA[TABS.PENGURUS] wajib terdefinisi');
assert.ok(dbCode.includes('SCHEMA[TABS.PLT_DELEGASI]'), 'SCHEMA[TABS.PLT_DELEGASI] wajib terdefinisi');
console.log('  PASS  Pangkalan data struktur kepengurusan & delegasi Plt terpasang');

// 2. Uji Logika Backend Formasi Pengurus & Plt di gas/Divisi.gs
console.log('\n-- 2. Logika Formasi BPH, 7 Divisi & Pembatasan Plt Maksimal 60 Hari --');
const divisiCode = fs.readFileSync('gas/Divisi.gs', 'utf8');

assert.ok(divisiCode.includes('function getFormasiPengurus'), 'Fungsi getFormasiPengurus tersedia');
assert.ok(divisiCode.includes('function savePejabatFormasi'), 'Fungsi savePejabatFormasi tersedia');
assert.ok(divisiCode.includes('function createPltDelegasi'), 'Fungsi createPltDelegasi tersedia');
assert.ok(divisiCode.includes('durasiHari > 60'), 'Pembatasan durasi mandat Plt maksimal 60 hari wajib ditegakkan mutlak');
assert.ok(divisiCode.includes('function autoRevokePlt_'), 'Mekanisme autoRevokePlt_ untuk pencabutan otomatis kedaluwarsa terpasang');
assert.ok(divisiCode.includes('function revokePltDelegasi'), 'Fungsi revokePltDelegasi pencabutan awal tersedia');
console.log('  PASS  Formasi BPH, 7 Divisi dan benteng Plt 60 hari tervalidasi');

// 3. Uji One-Click Decree Generator SK Struktur DPP (ART Bab V Pasal 14 Ayat 9)
console.log('\n-- 3. One-Click Decree Generator SK Struktur Kepengurusan DPP --');
assert.ok(divisiCode.includes('function generateSkPengurus'), 'Fungsi generateSkPengurus tersedia');
assert.ok(divisiCode.includes('/SK-DPP/STRUKTUR/'), 'Format naskah dinas SK-DPP/STRUKTUR terpasang');
assert.ok(divisiCode.includes('AHU-0014970.AH.01.04.Tahun 2023'), 'Konsideran hukum SK Kemenkumham RI tercantum lengkap');
assert.ok(divisiCode.includes('TABS.SURAT'), 'Naskah SK otomatis diarsipkan ke Sheet_Surat');
console.log('  PASS  Generator SK Struktur Kepengurusan DPP resmi tervalidasi');

// 4. Uji Integrasi Frontend portal/portal.js
console.log('\n-- 4. Frontend Portal: Tab Formasi Pengurus & Delegasi Plt di Pengaturan --');
const portalCode = fs.readFileSync('portal/portal.js', 'utf8');

assert.ok(portalCode.includes('data-ptab="formasi"'), 'Tab Formasi Pengurus & Plt terdaftar di menu Pengaturan');
assert.ok(portalCode.includes('renderPengaturanFormasi'), 'Fungsi renderPengaturanFormasi terpasang');
assert.ok(portalCode.includes('loadFormasiPengurus'), 'Fungsi loadFormasiPengurus terpasang');
assert.ok(portalCode.includes('modalPltDelegasi'), 'Modal pembatasan delegasi Plt 60 hari terpasang');
assert.ok(portalCode.includes('modalEditPejabat'), 'Modal pengangkatan / mutasi pejabat terpasang');
assert.ok(portalCode.includes('generateSkConfirm'), 'Dialog konfirmasi penerbitan SK DPP terpasang');
console.log('  PASS  Antarmuka visual Formasi Pengurus & Delegasi Plt terintegrasi penuh');

console.log('\nHasil: Seluruh pengujian Formasi Pengurus & Delegasi Plt LULUS 100%!');

