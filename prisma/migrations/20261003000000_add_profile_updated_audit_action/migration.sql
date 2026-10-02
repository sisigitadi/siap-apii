-- Tambah aksi audit untuk pembaruan profil mandiri (FR-AUTH-08)

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PROFILE_UPDATED';
