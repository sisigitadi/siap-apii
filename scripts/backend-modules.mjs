// Pembaca bersama untuk hasil build apps-script/.
//
// Dulu backend adalah satu file apps-script/Backend.gs; sejak build dipecah,
// logika backend tersebar di beberapa file .gs (Konfig.gs, Utils.gs, ...).
// Reader ini menggabungkan kembali semua file .gs backend dalam urutan build,
// sehingga skrip uji cukup memanggil readBackendBundle() dan tetap menguji
// seluruh kode hasil build seperti satu scope global Apps Script.
//
// Aset (AsetLogo.gs / AsetStempel.gs) tidak ikut: base64 gambar hanya
// memboros memori dan tidak memengaruhi logika yang diuji.
import { readFileSync, readdirSync } from 'node:fs';

const BACKEND_DIR = 'apps-script';

// Urutan file .gs hasil build. Harus sama dengan $order di
// scripts/build-apps-script.ps1 — Apps Script menggabungkan semua file .gs
// jadi satu scope global, jadi urutan hanya penti untuk keterbacaan diff.
const BACKEND_MODULES = [
  'Konfig.gs', 'Utils.gs', 'Editorial.gs', 'Pengaturan.gs', 'Database.gs',
  'Auth.gs', 'Surat.gs', 'Keuangan.gs', 'Divisi.gs', 'TemplateSurat.gs',
  'TemplateSuratDocs.gs', 'Visitor.gs', 'Code.gs',
];

const ASSET_FILES = new Set(['AsetLogo.gs', 'AsetStempel.gs']);

/** Membaca satu file backend hasil build. */
export function readBackendFile(name) {
  return readFileSync(`${BACKEND_DIR}/${name}`, 'utf8');
}

/** Menggabungkan seluruh file .gs backend (tanpa aset) jadi satu string. */
export function readBackendBundle() {
  return BACKEND_MODULES.map(readBackendFile).join('\n');
}

/** Nama file .gs backend yang ada di apps-script/ (urutan build). */
export function listBackendModules() {
  return [...BACKEND_MODULES];
}

/** True bila apps-script/ sudah berisi build baru per-modul (bukan Backend.gs). */
export function isModularBuild() {
  const files = new Set(readdirSync(BACKEND_DIR));
  if (files.has('Backend.gs')) return false;
  for (const f of files) {
    if (f === 'appsscript.json' || !f.endsWith('.gs')) continue;
    if (!ASSET_FILES.has(f) && !BACKEND_MODULES.includes(f)) return false;
  }
  return BACKEND_MODULES.every((f) => files.has(f));
}
