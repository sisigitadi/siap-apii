// ============================================================================
// install-hooks.mjs — aktifkan hook repo (.githooks) pada klon ini.
//
// Hook tidak "ikut aktif" hanya karena ada di dalam repo: Git perlu
// `core.hooksPath` menunjuk ke sana, dan itu setelan lokal per klon. Skrip ini
// menyetelnya (`git config --local`) dan memastikan hook dapat dieksekusi,
// supaya gerbang pra-push benar-benar berjalan — bukan sekadar tersedia sebagai
// berkas yang tak pernah dipanggil.
//
// Pakai: npm run hooks:install      (atau: node scripts/install-hooks.mjs)
// Kode keluar: 0 berhasil · 1 gagal.
// ============================================================================
import { chmodSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const HOOKS_DIR = '.githooks';
const HOOK = `${HOOKS_DIR}/pre-push`;

const git = (args) => spawnSync('git', args, { encoding: 'utf8' });

if (!existsSync(HOOK)) {
  console.error(`✘ Hook ${HOOK} tidak ditemukan — jalankan dari akar repositori.`);
  process.exit(1);
}

const res = git(['config', '--local', 'core.hooksPath', HOOKS_DIR]);
if (res.status !== 0) {
  console.error('✘ Gagal menyetel core.hooksPath:', (res.stderr || '').trim());
  process.exit(1);
}

let chmodOk = true;
try {
  chmodSync(HOOK, 0o755);
} catch (e) {
  chmodOk = false;
  console.warn(`⚠ Tidak dapat menandai ${HOOK} sebagai executable (${e.message}).`);
  console.warn('  Di Windows hal ini umum dan hook tetap dijalankan Git for Windows.');
}

const cek = git(['config', '--local', '--get', 'core.hooksPath']);
const aktif = (cek.stdout || '').trim() === HOOKS_DIR;

console.log(`✔ core.hooksPath = ${(cek.stdout || '').trim() || '(kosong)'}`);
console.log(chmodOk ? `✔ ${HOOK} executable` : `⚠ ${HOOK} tidak executable`);
if (!aktif) {
  console.error('✘ Gerbang pra-push belum aktif — periksa keluaran di atas.');
  process.exit(1);
}
console.log('✔ Gerbang pra-push aktif. Uji cepat: node scripts/pre-push-gate.mjs');
console.log('  Lewati sekali bila darurat: SKIP_GATE=1 git push');
