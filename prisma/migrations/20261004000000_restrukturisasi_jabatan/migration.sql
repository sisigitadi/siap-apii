-- Restrukturisasi jabatan: 13 role lama -> 9 (8 jabatan organisasi + SUPERADMIN infra).
-- Pemetaan:
--   KETUA_UMUM      -> KETUA
--   DEWAN_PENGAWAS  -> PENGAWAS
--   PUBLIK_ANGGOTA  -> ANGGOTA_BIASA
--   DIV_*           -> KETUA_DIVISI (divisi nya di kolom `division`)
--   (PEMBINA & ANGGOTA_DIVISI adalah label baru yang belum ada di enum lama)
--
-- Catatan: PostgreSQL tidak mendukung `ALTER TYPE ... DROP VALUE`, jadi enum
-- lama (13 nilai) direkayasa ulang menjadi enum baru (9 nilai) lewat pembuatan
-- tipe pengganti + CAST data lama, lalu tipe lama dibuang.

-- 1. Lengkapi `division` dari role DIV_* lama sebelum role ditukar.
UPDATE "users" SET "division" = 'DIV_HUMAS'     WHERE "role" = 'DIV_HUMAS'     AND "division" IS NULL;
UPDATE "users" SET "division" = 'DIV_LITBANG'   WHERE "role" = 'DIV_LITBANG'   AND "division" IS NULL;
UPDATE "users" SET "division" = 'DIV_SOSMED'    WHERE "role" = 'DIV_SOSMED'    AND "division" IS NULL;
UPDATE "users" SET "division" = 'DIV_DAKWAH'    WHERE "role" = 'DIV_DAKWAH'    AND "division" IS NULL;
UPDATE "users" SET "division" = 'DIV_INVESTASI' WHERE "role" = 'DIV_INVESTASI' AND "division" IS NULL;
UPDATE "users" SET "division" = 'DIV_HUKUM'     WHERE "role" = 'DIV_HUKUM'     AND "division" IS NULL;
UPDATE "users" SET "division" = 'DIV_UMUM'      WHERE "role" = 'DIV_UMUM'      AND "division" IS NULL;

-- 2. Buat enum baru dengan 9 nilai final (urutan = deklarasi schema.prisma).
CREATE TYPE "UserRole_new" AS ENUM (
  'SUPERADMIN',
  'KETUA',
  'SEKRETARIS',
  'BENDAHARA',
  'PEMBINA',
  'PENGAWAS',
  'KETUA_DIVISI',
  'ANGGOTA_DIVISI',
  'ANGGOTA_BIASA'
);

-- 3. Pindahkan kolom `role` ke enum baru sambil memetakan label lama.
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING (
  CASE "role"::text
    WHEN 'SUPERADMIN'     THEN 'SUPERADMIN'::"UserRole_new"
    WHEN 'KETUA_UMUM'     THEN 'KETUA'::"UserRole_new"
    WHEN 'SEKRETARIS'     THEN 'SEKRETARIS'::"UserRole_new"
    WHEN 'BENDAHARA'      THEN 'BENDAHARA'::"UserRole_new"
    WHEN 'DEWAN_PENGAWAS' THEN 'PENGAWAS'::"UserRole_new"
    WHEN 'PUBLIK_ANGGOTA' THEN 'ANGGOTA_BIASA'::"UserRole_new"
    -- Seluruh pengurus divisi (DIV_HUMAS..DIV_UMUM) -> ketua divisi divisi-nya.
    ELSE 'KETUA_DIVISI'::"UserRole_new"
  END
);

-- 4. Ganti enum lama dengan yang baru.
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

