-- Fase 3: Realtime & Portal
-- Field e-KTA anggota (FR-PUBLIC-02): nomor anggota unik + masa berlaku kartu 5 tahun.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "member_number" VARCHAR(50);
ALTER TABLE "users" ADD COLUMN "member_since" TIMESTAMPTZ;
ALTER TABLE "users" ADD COLUMN "card_issued_at" TIMESTAMPTZ;
ALTER TABLE "users" ADD COLUMN "card_expires_at" TIMESTAMPTZ;

-- CreateIndex
CREATE UNIQUE INDEX "users_member_number_key" ON "users"("member_number");

-- CreateIndex
CREATE UNIQUE INDEX "official_letters_sha256_hash_key" ON "official_letters"("sha256_hash");
