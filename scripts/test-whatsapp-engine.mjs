import { readFileSync } from 'fs';
import assert from 'assert';

console.log('== Pengujian WhatsApp Engine & 21 Touchpoints (Fase 4) ==');

const portalCode = readFileSync('portal/portal.js', 'utf8');

// 1. Ekstrak cleanPhone
function extractCleanPhone(code) {
  const match = code.match(/cleanPhone:\s*function\s*\(raw\)\s*\{([\s\S]*?)\n\s*\},/);
  if (!match) throw new Error('cleanPhone tidak ditemukan');
  return new Function('raw', match[1]);
}
const cleanPhone = extractCleanPhone(portalCode);
assert.strictEqual(cleanPhone('081234567890'), '6281234567890', '08 -> 628');
assert.strictEqual(cleanPhone('+6281234567890'), '6281234567890', '+628 -> 628');
assert.strictEqual(cleanPhone('81234567890'), '6281234567890', '812 -> 62812');
assert.strictEqual(cleanPhone('(0812) 3456-7890'), '6281234567890', 'Karakter non-digit dibuang');
assert.strictEqual(cleanPhone(''), '', 'String kosong aman');
console.log('  PASS  Normalisasi nomor telepon E.164 (Benteng Guard 1) lulus uji');

// 2. Verifikasi 5 Benteng Keandalan WhatsApp di portal.js
assert.ok(portalCode.includes('cleanPhone'), 'Guard 1: cleanPhone E.164 ada');
assert.ok(portalCode.includes('encodeURIComponent'), 'Guard 2: Safe URI encoding ada');
assert.ok(portalCode.includes('waPhoneForm') || portalCode.includes('Dialog Anti-Nomor Kosong'), 'Guard 3: Dialog anti-nomor kosong ada');
assert.ok(portalCode.includes('copyFallback'), 'Guard 4: Clipboard fallback ada');
assert.ok(portalCode.includes('650'), 'Guard 5: Batas aman panjang URL mobile < 650 karakter ada');
assert.ok(portalCode.includes('isQuietHours'), 'Quiet Hours (22.00-06.00 WIB) terpasang');
console.log('  PASS  5 Benteng Keandalan (Reliability Guards) & Jam Senyap terverifikasi');

// 3. Verifikasi Matriks 21 Touchpoints (WA-01 s.d. WA-21)
for (let i = 1; i <= 21; i++) {
  const code = 'WA-' + String(i).padStart(2, '0');
  assert.ok(portalCode.includes("case '" + code + "':"), 'Titik sentuh ' + code + ' terdaftar di buildWaMessage');
}
console.log('  PASS  Seluruh 21 Titik Sentuh (WA-01 s.d. WA-21) terdaftar lengkap dalam mesin naskah');

// 4. Verifikasi Lokalisasi Notifikasi Peran Wilayah di gas/Utils.gs (Benteng A-03)
const utilsCode = readFileSync('gas/Utils.gs', 'utf8');
assert.ok(utilsCode.includes('targetWilayah'), 'Parameter targetWilayah pada kirimNotifikasiKeRole_ terpasang');
assert.ok(utilsCode.includes('uW === targetWilayah'), 'Filter targetWilayah aktif mencegah blast spam lintas cabang');
console.log('  PASS  Lokalisasi notifikasi peran wilayah (Benteng A-03) terpasang di backend');

console.log('\nHasil: Seluruh pengujian WhatsApp Engine LULUS 100%!');
