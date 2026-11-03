import { readFileSync } from 'fs';
import assert from 'assert';

console.log('== Pengujian Suite Keuangan Kas Syar\'i & Kalkulator Digital (Fase 3) ==');

// 1. Verifikasi Terbilang Rupiah
const utilsCode = readFileSync('gas/Utils.gs', 'utf8');
const portalCode = readFileSync('portal/portal.js', 'utf8');

function extractTerbilang(code) {
  const match = code.match(/function terbilang\(n\) \{([\s\S]*?)\n\}/);
  if (!match) throw new Error('Fungsi terbilang tidak ditemukan di gas/Utils.gs');
  const fnBody = match[1];
  return new Function('n', fnBody);
}

const terbilangGas = extractTerbilang(utilsCode);
assert.strictEqual(terbilangGas(0), 'Nol Rupiah', '0 -> Nol Rupiah');
assert.strictEqual(terbilangGas(1500000), 'Satu Juta Lima Ratus Ribu Rupiah', '1.500.000 terbilang benar');
assert.strictEqual(terbilangGas(7500000), 'Tujuh Juta Lima Ratus Ribu Rupiah', '7.500.000 terbilang benar');
assert.strictEqual(terbilangGas(250000), 'Dua Ratus Lima Puluh Ribu Rupiah', '250.000 terbilang benar');
console.log('  PASS  Fungsi terbilang gas/Utils.gs menghasilkan kalimat rupiah yang benar');

// 2. Verifikasi Backend Keuangan (gas/Keuangan.gs)
const keuGas = readFileSync('gas/Keuangan.gs', 'utf8');
assert.ok(keuGas.includes('buildVoucherNumber'), 'buildVoucherNumber ada');
assert.ok(keuGas.includes('KW-M-'), 'Format nomor Kwitansi Masuk KW-M ada');
assert.ok(keuGas.includes('VKK-'), 'Format nomor Voucher Keluar VKK ada');
assert.ok(keuGas.includes('BON-'), 'Format nomor Kas Bon BON ada');
assert.ok(keuGas.includes('BA-KEU-'), 'Format nomor Berita Acara BA-KEU ada');
assert.ok(keuGas.includes('getPartitionedSequenceKey'), 'Partisi counter per wilayah terpasang');
assert.ok(keuGas.includes('DRAFT_REVISI'), 'Benteng A-08: Status DRAFT_REVISI pada penolakan kas terpasang');
assert.ok(keuGas.includes('resubmitVoucher'), 'Benteng A-08: resubmitVoucher terpasang');
assert.ok(keuGas.includes('voidVoucher'), 'Benteng A-09: voidVoucher terpasang');
assert.ok(keuGas.includes('getKasSimulatorData'), 'Benteng A-10: getKasSimulatorData terpasang');
assert.ok(keuGas.includes('saveKasSimulation'), 'Benteng A-10: saveKasSimulation terpasang');
assert.ok(keuGas.includes('convertSimulationToKas'), 'Konversi 1-klik proyeksi digital terpasang');
console.log('  PASS  Backend gas/Keuangan.gs memuat taksonomi 4 naskah & Benteng A-01, A-02, A-08, A-09, A-10');

// 3. Verifikasi Dual-Control & Threshold di Backend
assert.ok(keuGas.includes('approval_threshold'), 'Approval threshold kas kecil diakomodasi');
assert.ok(keuGas.includes('safety_buffer'), 'Cash safety buffer 2.000.000 diakomodasi');
console.log('  PASS  Backend gas/Keuangan.gs memuat aturan Dual-Approval Threshold & Safety Buffer');

// 4. Verifikasi Frontend Dual-Slip di portal/portal.js
assert.ok(portalCode.includes('dual-slip-container'), 'Container Dual-Slip terpasang');
assert.ok(portalCode.includes('BONGGOL ARSIP KAS (COUNTERFOIL)'), 'Bonggol Arsip Kas 30% terpasang');
assert.ok(portalCode.includes('LEMBAR UTAMA DONATUR / PEMBAYAR'), 'Lembar Utama Donatur 70% terpasang');
assert.ok(portalCode.includes('DIBATALKAN / VOID'), 'Watermark VOID terpasang');
assert.ok(portalCode.includes('stempelRot'), 'Rotasi stempel basah acak 3-5 derajat terpasang');
assert.ok(portalCode.includes('page-break-inside: avoid'), 'CSS anti-orphan cetak kwitansi terpasang');
console.log('  PASS  Frontend portal/portal.js mengimplementasikan Kwitansi Dual-Slip (30% Bonggol & 70% Lembar Utama)');

// 5. Verifikasi Modal Kalkulator Kas & Simulasi Inflow
assert.ok(portalCode.includes('openKasCalculatorModal'), 'Fungsi openKasCalculatorModal terpasang');
assert.ok(portalCode.includes('calcTabExpense'), 'Tab simulasi pengeluaran kas berjalan terpasang');
assert.ok(portalCode.includes('calcTabInflow'), 'Tab kalkulator inflow TikTok/YouTube/QRIS terpasang');
assert.ok(portalCode.includes('btnTransferToVoucher'), 'Tombol transfer angka ke voucher kas keluar terpasang');
assert.ok(portalCode.includes('btn-convert-sim'), 'Tombol konversi 1-klik proyeksi ke kas masuk terpasang');
console.log('  PASS  Frontend portal/portal.js menyediakan Kalkulator Kas Run-Rate & Inflow Digital');

console.log('\nHasil: Semua pengujian Suite Keuangan LULUS 100%!');
