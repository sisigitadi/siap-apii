/*
 * Validasi dependensi urutan statement pada direktori migrasi SQL Prisma.
 * Kelas bug utama yang membuat migrasi gagal diterapkan adalah forward reference:
 * sebuah CREATE INDEX / FOREIGN KEY / kolom bertipe enum merujuk entitas yang
 * belum (atau tidak pernah) dideklarasikan lebih dulu.
 *
 * Semua migration.sql diproses berurutan (nama folder sort) DAN state tabel/enum
 * diakumulasi antar-migrasi — persis seperti cara Prisma menerapkannya. Ini
 * menghindari false positive untuk FK yang merujuk tabel dari migrasi sebelumnya.
 *
 * Pemakaian: node scripts/validate-migration.mjs prisma/migrations
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const target = process.argv[2];
if (!target) {
  console.error('Pemakaian: node scripts/validate-migration.mjs <dir-migrasi>');
  process.exit(2);
}

/** Kumpulkan file migration.sql secara berurutan (bisa satu file atau direktori). */
const files = statSync(target).isDirectory()
  ? readdirSync(target)
      .filter((d) => statSync(join(target, d)).isDirectory())
      .sort()
      .map((d) => join(target, d, 'migration.sql'))
  : [target];

const problems = [];

/** Indeks statement global saat setiap entitas pertama kali dideklarasikan. */
const enumAt = new Map();
const tableAt = new Map();

const firstName = (stmt, ...keywords) => {
  for (const kw of keywords) {
    const m = new RegExp(`${kw}\\s+"?([A-Za-z_][A-Za-z0-9_]*)"?`, 'i').exec(stmt);
    if (m) return m[1];
  }
  return null;
};

/** Pecah satu file menjadi statement; kembalikan juga offset global untuk pelabelan. */
function parseStatements(sql) {
  return sql
    .split(/;\s*/)
    .map((s) => s.replace(/--[^\n]*/g, '').trim()) // hapus komentar baris
    .filter((s) => s.length);
}

let globalIndex = 0;

for (const file of files) {
  const statements = parseStatements(readFileSync(resolve(file), 'utf8'));

  statements.forEach((stmt, i) => {
    const g = globalIndex + i;
    const head = stmt.split(/[\s\n]/)[0].toUpperCase();
    const label = `${file.split(/[/\\]/).slice(-2).join('/')} #${i + 1} (${head})`;

    if (/CREATE\s+(TYPE|ENUM)/i.test(stmt)) {
      const name = firstName(stmt, 'TYPE');
      if (name && !enumAt.has(name)) enumAt.set(name, g);
      return;
    }

    if (/CREATE\s+TABLE/i.test(stmt)) {
      const name = firstName(stmt, 'TABLE');
      if (!name) {
        problems.push(`${label}: tidak bisa membaca nama tabel.`);
        return;
      }
      if (!tableAt.has(name)) tableAt.set(name, g);

      // Tipe enum pada definisi kolom harus dideklarasikan SEBELUM tabel ini.
      for (const m of stmt.matchAll(/"([A-Za-z_][A-Za-z0-9_]*)"/g)) {
        const used = m[1];
        if (enumAt.has(used) && enumAt.get(used) > g) {
          problems.push(`${label}: tabel "${name}" memakai enum "${used}" sebelum dideklarasikan.`);
        }
      }
      return;
    }

    if (/CREATE\s+(UNIQUE\s+)?INDEX/i.test(stmt)) {
      const m = /ON\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/i.exec(stmt);
      const table = m?.[1];
      if (!table) {
        problems.push(`${label}: tidak bisa membaca tabel target index.`);
      } else if (!tableAt.has(table)) {
        problems.push(`${label}: index pada tabel "${table}" yang belum pernah dibuat.`);
      } else if (tableAt.get(table) > g) {
        problems.push(`${label}: index pada tabel "${table}" sebelum tabel dibuat.`);
      }
      return;
    }

    if (/ALTER\s+TABLE/i.test(stmt) && /FOREIGN\s+KEY/i.test(stmt)) {
      const table = firstName(stmt, 'TABLE');
      const ref = /REFERENCES\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/i.exec(stmt)?.[1];

      if (table && !tableAt.has(table)) {
        problems.push(`${label}: FK pada tabel "${table}" yang belum pernah dibuat.`);
      }
      if (ref && !tableAt.has(ref)) {
        problems.push(`${label}: REFERENCES tabel "${ref}" yang belum pernah dibuat.`);
      }
      return;
    }
  });

  globalIndex += statements.length;
}

console.log(`Memeriksa ${files.length} file migrasi, ${globalIndex} statement total.`);
console.log(`  Enum ditemukan : ${enumAt.size}`);
console.log(`  Tabel ditemukan: ${tableAt.size}`);

if (problems.length) {
  console.error(`\nDitemukan ${problems.length} potensi masalah urutan/dependensi:`);
  for (const p of problems) console.error(`  x ${p}`);
  process.exit(1);
}

console.log('\nOK: enum, tabel, index, dan foreign key terurut tanpa forward reference.');
