// Membagi gas/Utils.gs menjadi tiga file sumber yang lebih kecil:
//
//   gas/Utils.gs      — helper umum, audit log, dashboard (tidak berubah isinya)
//   gas/Editorial.gs  — konten redaksi dinamis (mini-CMS portal publik)
//   gas/Pengaturan.gs — route pengaturan, pemindahan & penyimpanan Drive
//
// Alasan: Backend.gs (bundle build) mendekati 257.000 karakter — hampir 3x
// ambang 90.000 di skrip build sendiri. Memecah sumber berdasarkan batas blok
// yang alami (Utils.gs -> Editorial.gs -> Pengaturan.gs) membuat tiap file .gs
// hasil build tetap kecil tanpa mengubah satu pun baris logika.
//
// Idempoten: bila ketiga marker sudah tidak ada (sudah dipecah), skrip keluar
// tanpa mengubah apa pun.
//
// Cara pakai: node scripts/split-utils.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SRC = 'gas/Utils.gs';
const EOL = '\r\n';

const src = readFileSync(SRC, 'utf8');

const BANNER = '// ==========================================================================' + EOL + '// KONTEN REDAKSI DINAMIS';
const EDITORIAL_BODY = '/** Key Sheet_Settings penyimpan konten redaksi dinamis. */';
const SETTINGS_DOC = '/**' + EOL + ' * getSettings:';

const iBanner = src.indexOf(BANNER);
const iEditorialBody = src.indexOf(EDITORIAL_BODY);
const iSettings = src.indexOf(SETTINGS_DOC);

if (iBanner === -1 || iEditorialBody === -1 || iSettings === -1) {
  if (existsSync('gas/Editorial.gs') && existsSync('gas/Pengaturan.gs')) {
    console.log('OK   Utils.gs sudah dipecah; tidak ada yang dilakukan.');
    process.exit(0);
  }
  console.log('FAIL tidak menemukan batas blok di Utils.gs — periksa komentar penanda.');
  process.exit(1);
}

// --- Bagian 1: Utils.gs (helper, audit log, dashboard) ----------------------
// Header baru menjelaskan bahwa Editorial & Pengaturan dulunya bagian file ini.
const UTILS_HEADER = [
  '/**',
  ' * ============================================================================',
  ' * Utils.gs — Helper Umum, Audit Log & Dashboard',
  ' * ============================================================================',
  ' * Tanggung jawab: UUID, format tanggal/Rupiah, label status Bahasa Indonesia,',
  ' * audit log (Sheet_AuditLogs), getDashboard (ringkasan statistik per peran),',
  ' * notifikasi email, serta getter/setter pengaturan (getSettingValue_).',
  ' *',
  ' * Catatan: konten redaksi dinamis dipindah ke Editorial.gs, dan route',
  ' * pengaturan beserta penyimpanan Drive dipindah ke Pengaturan.gs. Ketiganya',
  ' * dulunya satu file ini; dipecah agar masing-masing file .gs hasil build',
  ' * tetap jauh di bawah batas ukuran file Apps Script.',
  ' * ==========================================================================*/',
  ''
].join(EOL);

const headerEnd = src.indexOf(' * ==========================================================================*/', src.indexOf('/**')) + ' * ==========================================================================*/'.length;
const utilsBody = src.slice(headerEnd, iBanner).trim();
writeFileSync(SRC, UTILS_HEADER + utilsBody + EOL);
console.log('OK   gas/Utils.gs ditulis ulang (helper, audit log, dashboard).');

// --- Bagian 2: Editorial.gs (mini-CMS portal publik) -------------------------
const EDITORIAL_HEADER = [
  '/**',
  ' * ============================================================================',
  ' * Editorial.gs — Konten Redaksi Dinamis (Mini-CMS Portal Publik)',
  ' * ============================================================================',
  ' * Seluruh konten yang dikelola pengurus disimpan sebagai satu nilai JSON di',
  ' * Sheet_Settings dengan key "editorial_content" (lihat docs/REDAKSI_KONTEN.md).',
  ' * Fungsi di sini HANYA menyiapkan/normalisasi struktur; pemetaan ke markup',
  ' * portal publik tetap dilakukan di public/app.js.',
  ' * ==========================================================================*/',
  ''
].join(EOL);

const editorialBody = src.slice(iEditorialBody, iSettings).trim();
writeFileSync('gas/Editorial.gs', EDITORIAL_HEADER + editorialBody + EOL);
console.log('OK   gas/Editorial.gs dibuat (konten redaksi dinamis).');

// --- Bagian 3: Pengaturan.gs (route pengaturan & penyimpanan Drive) ----------
const PENGATURAN_HEADER = [
  '/**',
  ' * ============================================================================',
  ' * Pengaturan.gs — Route Pengaturan & Penyimpanan Drive',
  ' * ============================================================================',
  ' * Tanggung jawab: getSettings (baca seluruh pengaturan sistem), updateSettings',
  ' * (simpan perubahan), getDriveStorage/resetDriveStorage (status & reset',
  ' * penyimpanan Drive), createDriveFolder, dan syncEditorialContent.',
  ' *',
  ' * Catatan: fungsi getSettingValue_ tetap di Utils.gs karena dipakai banyak',
  ' * modul lain; modul ini hanya menangani route pengaturan yang dibawa ROUTES.',
  ' * ==========================================================================*/',
  ''
].join(EOL);

const pengaturanBody = src.slice(iSettings).trim();
writeFileSync('gas/Pengaturan.gs', PENGATURAN_HEADER + pengaturanBody + EOL);
console.log('OK   gas/Pengaturan.gs dibuat (route pengaturan & Drive).');
