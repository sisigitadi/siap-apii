// ============================================================================
// stamp-build-info.mjs — Menghasilkan apps-script/Versi.gs
// ============================================================================
// Berkas ini adalah SATU-SATUNYA sumber angka versi yang dilaporkan endpoint
// `ping`, sehingga tidak ada lagi angka yang ditulis manual di kode:
//
//   version : versi aplikasi, dibaca dari package.json saat build. Karena
//             dicap ulang setiap build, angka ini tidak bisa basi.
//   release : nomor Versi Apps Script yang benar-benar disajikan deployment
//             /exec. Diisi scripts/deploy-gas.mjs tepat SEBELUM push (versi
//             terakhir + 1) dan dibandingkan lagi dengan nomor yang benar-benar
//             dibuat, jadi laporan monitoring selalu sama dengan rilis nyata.
//             null = bundel ini belum dirilis (mis. hasil `npm run build:gas`),
//             dan itu lebih baik daripada mengaku nomor rilis yang salah.
//
// Pakai:
//   node scripts/stamp-build-info.mjs                    (release: null)
//   node scripts/stamp-build-info.mjs --release 15       (dicap untuk rilis 15)
//   node scripts/stamp-build-info.mjs --out <berkas>     (default apps-script/Versi.gs)
//   node scripts/stamp-build-info.mjs --json             (keluaran mesin)
//
// Kode keluar: 0 berhasil · 2 argumen/konfigurasi tidak sah (tidak ada berkas
// yang ditulis bila gagal, sehingga bundel lama tidak pernah setengah tercap).
// ============================================================================
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** Isi berkas apps-script/Versi.gs untuk pasangan versi & rilis tertentu. */
export function buildInfoSource({ version, release }) {
  const releaseLiteral = release === null || release === undefined ? 'null' : String(release);
  return `/**
 * ============================================================================
 * Versi.gs — Info versi bundel (DIHASILKAN OTOMATIS, jangan diedit manual)
 * ============================================================================
 * Dibangkitkan oleh scripts/stamp-build-info.mjs. Angka di bawah ini yang
 * dilaporkan endpoint \`ping\`, jadi JANGAN menulis versi manual di berkas lain:
 *
 *   version : versi aplikasi (dari package.json, ikut setiap build)
 *   release : nomor Versi Apps Script yang tayang di deployment /exec
 *             (dicap oleh scripts/deploy-gas.mjs sebelum push; null = belum
 *             dirilis, mis. hasil \`npm run build:gas\` saja)
 * ==========================================================================*/

var APP_BUILD_INFO = {
  version: '${version}',
  release: ${releaseLiteral}
};
`;
}

/** Versi aplikasi acuan (package.json). */
export function appVersionFrom(root = process.cwd()) {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  return pkg.version;
}

/**
 * Membaca release dari bundel yang sudah ada (dipakai generator versi:bundel
 * agar tidak menurunkan angka rilis yang sudah dicap deploy pada build berikut).
 */
export function readStampedRelease(file) {
  if (!existsSync(file)) return null;
  const m = readFileSync(file, 'utf8').match(/release:\s*(\d+|null)/);
  if (!m || m[1] === 'null') return null;
  return Number(m[1]);
}

const main = () => {
  const ARGS = process.argv.slice(2);
  const argOf = (n) => {
    const i = ARGS.indexOf(n);
    return i !== -1 && ARGS[i + 1] && !ARGS[i + 1].startsWith('-') ? ARGS[i + 1] : null;
  };
  const AS_JSON = ARGS.includes('--json');
  const OUT = resolve(argOf('--out') || 'apps-script/Versi.gs');
  const KEEP = ARGS.includes('--keep-release');
  const bad = (msg) => {
    if (AS_JSON) console.log(JSON.stringify({ ok: false, error: msg }, null, 2));
    else console.error(`FAIL ${msg}`);
    process.exit(2);
  };

  if (ARGS.includes('--help') || ARGS.includes('-h')) {
    console.log(`Mencap info versi bundel ke aplikasi Apps Script.

Pakai: node scripts/stamp-build-info.mjs [opsi]

  --release <n>    Nomor Versi Apps Script yang akan disajikan (bilangan bulat > 0)
  --keep-release   Pertahankan angka rilis yang sudah tercap (bila ada)
  --out <berkas>   Berkas keluaran (default: apps-script/Versi.gs)
  --json           Keluarkan hasil sebagai JSON
  --help, -h       Bantuan ini

Kode keluar: 0 berhasil · 2 argumen tidak sah (tidak ada berkas yang ditulis).`);
    process.exit(0);
  }

  let version;
  try {
    version = appVersionFrom();
  } catch (e) {
    bad(`package.json tidak dapat dibaca: ${e.message}`);
  }
  if (!SEMVER.test(String(version || ''))) {
    bad(`versi package.json bukan semver yang sah: ${JSON.stringify(version)}`);
  }

  let release = null;
  const raw = argOf('--release');
  if (raw !== null) {
    if (!/^\d+$/.test(raw) || Number(raw) < 1) bad(`--release harus bilangan bulat > 0 (diterima: ${JSON.stringify(raw)})`);
    release = Number(raw);
  } else if (KEEP) {
    release = readStampedRelease(OUT);
  }

  const source = buildInfoSource({ version, release });
  try {
    writeFileSync(OUT, source, 'utf8');
  } catch (e) {
    bad(`tidak dapat menulis ${OUT}: ${e.message}`);
  }

  if (AS_JSON) console.log(JSON.stringify({ ok: true, out: OUT, version, release }, null, 2));
  else console.log(`OK   ${OUT} — version ${version}, release ${release === null ? 'null (belum dirilis)' : release}`);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
