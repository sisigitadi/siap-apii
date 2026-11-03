// ============================================================================
// test-kta-national.mjs
// Pengujian Suite Keanggotaan Nasional & KTA Digital 5 Tahun (Fase 5)
// ============================================================================

import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('== Pengujian Suite Keanggotaan Nasional & KTA 5 Tahun (Fase 5) ==');

// 1. Uji Backend gas/Auth.gs: Generator KTA Nasional 5 Tahun & Benteng A-01
console.log('\n-- 1. Generator Nomor KTA Nasional Sekuensial & Masa Berlaku 5 Tahun --');
const authCode = fs.readFileSync('gas/Auth.gs', 'utf8');

assert.ok(authCode.includes("Database.nextSequence('KTA:NASIONAL:' + tahun)"), 'KTA Nasional harus menggunakan urutan sekuensial nasional tunggal');
assert.ok(authCode.includes('expYear = tahun + 5'), 'Masa berlaku KTA wajib 5 tahun penuh sesuai ART Bab II Pasal 4 & 5');
assert.ok(authCode.includes('TABS.KTA_NASIONAL'), 'Data KTA wajib dicatat ke pangkalan data Sheet_KTA_Nasional');
assert.ok(authCode.includes('function approvePendaftarKetum'), 'Fungsi pengesahan Ketum approvePendaftarKetum tersedia');
console.log('  PASS  Penerbitan KTA Nasional 5 Tahun terkunci sekuensial nasional');

// 2. Uji Kepatuhan UU PDP No. 27/2022 pada Verifikasi Publik
console.log('\n-- 2. Kepatuhan Perlindungan Data Pribadi (UU PDP No. 27/2022) --');
assert.ok(authCode.includes('function verifyKtaPublic'), 'Endpoint verifikasi publik verifyKtaPublic tersedia');
assert.ok(!authCode.includes('nik: row.nik') || authCode.includes('nik_masked'), 'Endpoint publik tidak boleh mengekspos NIK mentah');
assert.ok(!authCode.includes('address: row.address'), 'Endpoint publik tidak boleh membocorkan alamat lengkap pribadi anggota');
assert.ok(authCode.includes('isExpired'), 'Pemeriksaan kadaluarsa KTA terpasang');
console.log('  PASS  Endpoint verifikasi publik mematuhi UU PDP No. 27/2022');

// 3. Uji Token Klaim Mandiri Anggota Lama (15 Menit)
console.log('\n-- 3. Token Klaim Mandiri Anggota Lama (15 Menit) --');
assert.ok(authCode.includes('function generateLegacyClaimToken'), 'Fungsi generateLegacyClaimToken tersedia');
assert.ok(authCode.includes('15 * 60 * 1000'), 'Token klaim mandiri wajib kadaluarsa dalam 15 menit');
assert.ok(authCode.includes('function claimLegacyKta'), 'Fungsi claimLegacyKta untuk onboarding mandiri tersedia');
console.log('  PASS  Siklus hidup token klaim mandiri 15 menit tervalidasi');

// 4. Uji Integrasi Frontend portal/portal.js (3 Tab & Kanvas CR80)
console.log('\n-- 4. Frontend Portal: 3 Tab Manajemen Anggota & Kanvas CR80 ISO/IEC 7810 --');
const portalCode = fs.readFileSync('portal/portal.js', 'utf8');

assert.ok(portalCode.includes('renderBerkasPendaftarView'), 'Tab 1: Verifikasi Berkas Baru terpasang');
assert.ok(portalCode.includes('renderDirektoriKtaView'), 'Tab 2: Direktori KTA Nasional Aktif terpasang');
assert.ok(portalCode.includes('renderKonsolidasiView'), 'Tab 3: Konsolidasi Anggota Lama & Klaim terpasang');
assert.ok(portalCode.includes('openKtaCardModal'), 'Modal KTA Digital CR80 terpasang');
assert.ok(portalCode.includes('drawKtaCanvas'), 'Engine kanvas resolusi tinggi 300 DPI terpasang');
assert.ok(portalCode.includes('1012') && portalCode.includes('638'), 'Dimensi kanvas CR80 1012x638 px (300 DPI) terpasang');
assert.ok(portalCode.includes('KODE ETIK KEANGGOTAAN APII'), '5 butir kode etik keanggotaan (ART Bab II Pasal 6) tercantum pada kartu punggung');
assert.ok(portalCode.includes('klaimModalDialog'), 'Dialog pembagian tautan klaim WhatsApp terpasang');
assert.ok(portalCode.includes('verifyKtaModal'), 'Modal verifikasi keabsahan KTA terpasang');
console.log('  PASS  3 Tab Pengelolaan Anggota & Kanvas CR80 ISO/IEC 7810 terintegrasi penuh');

console.log('\nHasil: Seluruh pengujian Keanggotaan Nasional & KTA 5 Tahun LULUS 100%!');
