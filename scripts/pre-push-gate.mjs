// ============================================================================
// pre-push-gate.mjs — gerbang yang dijalankan SEBELUM kode didorong ke remote.
//
// Dipanggil oleh hook `.githooks/pre-push` (aktif setelah `npm run hooks:install`)
// dan juga dipakai CI, sehingga pemeriksaan yang sama berjalan di laptop dan di
// server. Semua pemeriksaan di sini WAJIB: (a) tanpa jaringan, (b) tanpa menulis
// ke produksi, (c) selesai dalam hitungan detik — gerbang yang lambat akan
// dilewati orang, dan gerbang yang dilewati tidak menjaga apa pun.
//
// SENGAJA TIDAK ikut di sini, beserta alasannya:
//   - scripts/smoke-deploy-gate.mjs  : ±145 detik (menjalankan skrip deploy asli
//                                      dengan clasp tiruan) → terlalu lambat
//                                      untuk setiap push; jalankan manual.
//   - scripts/smoke-drive-prod.mjs   : menyentuh Google Drive PRODUKSI.
//   - scripts/check-legacy-duplicates.mjs / cleanup : menarik isi editor Apps
//                                      Script (jaringan + kredensial clasp).
//   - build:gas / deploy:gas         : menulis ke Apps Script (rilis sungguhan).
//
// Kode keluar 2 dari sebuah pemeriksaan berarti "TIDAK BISA DIJALANKAN di
// lingkungan ini" (mis. uji peramban tanpa Chrome/Edge). Pemeriksaan seperti itu
// dicetak sebagai DILEWATI beserta alasannya — bukan gagal, tetapi juga tidak
// pernah dihitung lulus.
//
// Pakai:
//   node scripts/pre-push-gate.mjs        (atau: npm run gate:push)
//   node scripts/pre-push-gate.mjs --ci   (mode CI: lihat "Mode CI" di bawah)
//   SKIP_GATE=1 git push                  (lewati gerbang sekali — darurat)
//
// Kode keluar: 0 semua lulus · 1 ada yang gagal.
//
// MODE CI (--ci / GATE_CI=1). Sebagian pemeriksaan membaca bundel hasil build
// `apps-script/*.gs`, sedangkan bundel itu SENGAJA tidak ikut ke repositori
// (.gitignore) — ia dibangkitkan lokal, dan `Dokumen Sumber/` (gambar logo &
// stempel sumbernya) juga tidak ikut ke repositori. Di mesin CI yang hanya
// menyimpan isi repo, bundel itu karena itu MEMANG tidak ada. Dalam mode ini
// pemeriksaan yang butuh bundel dilewati dengan alasan yang dicetak terang-
// terangan (bukan gagal senyap, bukan pula hijau palsu), sedangkan pemeriksaan
// mandiri — pemindai frontend, penjaga portal, daftar putih route — tetap
// dijalankan penuh. Bila bundel kebetulan ada, semua pemeriksaan tetap jalan.
// ============================================================================
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// [label, skrip, butuhBundel] — butuhBundel: membaca apps-script/*.gs hasil build.
const CHECKS = [
  ['Gerbang variabel global frontend', 'scripts/check-frontend-globals.mjs', false],
  ['Uji pemindai frontend (alias self, salah ketik)', 'scripts/smoke-frontend-globals.mjs', false],
  ['Penjaga mode demo portal', 'scripts/smoke-portal-demo-guard.mjs', false],
  ['Tombol masuk portal (demo & formulir)', 'scripts/smoke-portal-login-button.mjs', false],
  // Uji UI di peramban SUNGGUHAN (Chrome/Edge terpasang) terhadap alamat
  // preview lokal. Tanpa peramban ia keluar dengan kode 2 → dicatat sebagai
  // "dilewati" beserta alasannya, bukan gagal dan bukan lulus.
  ['Portal di peramban sungguhan (alamat preview)', 'scripts/smoke-portal-live.mjs', false],
  ['Daftar putih route backend', 'scripts/validate-routes-whitelist.mjs', false],
  ['Smoke backend', 'scripts/smoke-backend.mjs', true],
  ['Smoke pemulihan sandi akun (jalur darurat)', 'scripts/smoke-auth-recovery.mjs', true],
  ['Smoke konten redaksi', 'scripts/smoke-editorial.mjs', true],
  ['Smoke master template surat', 'scripts/smoke-template-surat.mjs', false],
  ['Smoke gerbang definisi ganda', 'scripts/smoke-legacy-dedup.mjs', false],
  ['Smoke pembersih berkas lama', 'scripts/smoke-legacy-cleanup.mjs', false],
  ['Smoke laporan versi ping', 'scripts/smoke-version-report.mjs', true],
  ['Smoke Drive lokal', 'scripts/smoke-drive-local.mjs', true],
];

// Bundel hasil build (gitignored) hanya diperlukan oleh pemeriksaan bertanda
// butuhBundel; keberadaannya dipastikan lewat file modul pertama.
const BUNDEL = 'apps-script/Konfig.gs';
const MODE_CI = process.argv.includes('--ci') || process.env.GATE_CI === '1';
const adaBundel = existsSync(join(ROOT, BUNDEL));

const BARIS_AKHIR = /(Hasil:|Berkas dipindai:|OK\b|Tidak ada)/;

const mulai = Date.now();
const gagal = [];
const dilewati = [];
console.log('=== Gerbang pra-push SIAP APII ===');
console.log(`${CHECKS.length} pemeriksaan offline (tanpa jaringan, tanpa menyentuh produksi).`);
if (MODE_CI) console.log(`Mode CI: bundel ${BUNDEL} ${adaBundel ? 'ADA — semua pemeriksaan dijalankan' : 'TIDAK ada'}.`);
console.log('');

for (const [label, script, butuhBundel] of CHECKS) {
  const path = join(ROOT, script);
  if (!existsSync(path)) {
    gagal.push({ label, script, alasan: 'berkas skrip tidak ditemukan' });
    console.log(`  ✘  ${label.padEnd(48)} skrip tidak ditemukan: ${script}`);
    continue;
  }
  if (MODE_CI && butuhBundel && !adaBundel) {
    dilewati.push({ label, script, alasan: `bundel ${BUNDEL} tidak ada di checkout` });
    console.log(`  ––  ${label.padEnd(48)} tidak dijalankan di CI (bundel ${BUNDEL} tidak ada di checkout)`);
    continue;
  }
  const t0 = Date.now();
  const res = spawnSync(process.execPath, [path], {
    cwd: ROOT, encoding: 'utf8', timeout: 120000,
  });
  const ms = Date.now() - t0;
  const keluaran = ((res.stdout || '') + (res.stderr || '')).trim();
  const ringkas = keluaran.split('\n').reverse().find((l) => BARIS_AKHIR.test(l)) || '';
  const ok = res.status === 0;
  // Kode keluar 2 = lingkungan tidak mendukung (mis. tanpa peramban).
  if (res.status === 2) {
    const sebab = keluaran.split('\n').find((l) => l.startsWith('TIDAK BISA DIJALANKAN')) || 'lingkungan tidak mendukung';
    dilewati.push({ label, script, alasan: sebab.replace('TIDAK BISA DIJALANKAN: ', '') });
    console.log(`  ––  ${label.padEnd(48)} ${String(ms).padStart(6)} ms  dilewati (lingkungan)`);
    continue;
  }
  if (!ok) gagal.push({ label, script, alasan: ringkas || `kode keluar ${res.status}` });
  console.log(`  ${ok ? '✔' : '✘'}  ${label.padEnd(48)} ${String(ms).padStart(6)} ms  ${ringkas}`.trimEnd());
  if (!ok) {
    console.log('     ---- keluaran lengkap ----');
    for (const l of keluaran.split('\n')) console.log('     ' + l);
    console.log('     -------------------------');
  }
}

const total = Date.now() - mulai;
if (dilewati.length) {
  console.log(`\nDilewati (${dilewati.length} dari ${CHECKS.length}) — bukan lulus, bukan gagal:`);
  for (const d of dilewati) console.log(`  - ${d.label} (${d.script}): ${d.alasan}`);
  if (dilewati.some((d) => /bundel/.test(d.alasan))) {
    console.log('  Pemeriksaan backend perlu bundel hasil build yang TIDAK ikut ke repositori (aset sumbernya `Dokumen Sumber/` juga tidak).');
    console.log('  Jalankan gerbang lengkapnya di mesin klon lokal: npm run build:gas && npm run gate:push');
  }
}
if (gagal.length) {
  console.log(`\nGERBANG MENOLAK PUSH — ${gagal.length} dari ${CHECKS.length} pemeriksaan gagal (${total} ms):`);
  for (const g of gagal) console.log(`  - ${g.label} (${g.script}): ${g.alasan}`);
  console.log('\nPerbaiki akar masalahnya, bukan gerbangnya. Untuk melewati sekali (darurat): SKIP_GATE=1 git push');
  process.exit(1);
}
console.log(`\nSemua pemeriksaan lulus (${total} ms). Push dilanjutkan.`);
process.exit(0);
