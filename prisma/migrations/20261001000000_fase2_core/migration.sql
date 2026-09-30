-- CreateEnum
CREATE TYPE "LetterType" AS ENUM ('SK', 'SURAT_TUGAS', 'REKOMENDASI', 'MAKLUMAT', 'UNDANGAN', 'PENGANTAR', 'EDARAN');

-- CreateEnum
CREATE TYPE "LetterStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "IncomingLetterStatus" AS ENUM ('RECEIVED', 'DISPOSITION_PENDING', 'DISPOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CashFlowType" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "AccountCategory" AS ENUM ('BSI_GIRO', 'BRANKAS_KAS_KECIL', 'MANDIRI_WAKAF');

-- CreateEnum
CREATE TYPE "CashFlowStatus" AS ENUM ('PENDING', 'VERIFIED_BENDAHARA', 'VERIFIED_KETUM', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'LETTER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LETTER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'LETTER_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'LETTER_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'LETTER_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'LETTER_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE 'LETTER_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE 'INCOMING_LETTER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'INCOMING_LETTER_DISPOSED';
ALTER TYPE "AuditAction" ADD VALUE 'CASH_FLOW_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'CASH_FLOW_VERIFIED_BENDAHARA';
ALTER TYPE "AuditAction" ADD VALUE 'CASH_FLOW_VERIFIED_KETUM';
ALTER TYPE "AuditAction" ADD VALUE 'CASH_FLOW_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBMISSION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBMISSION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBMISSION_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBMISSION_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBMISSION_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBMISSION_PUBLISHED';

-- CreateTable
CREATE TABLE "official_letters" (
    "id" TEXT NOT NULL,
    "letter_number" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "letter_type" "LetterType" NOT NULL,
    "content_payload" JSONB NOT NULL,
    "kop_config" JSONB NOT NULL,
    "signatories" JSONB NOT NULL,
    "sha256_hash" VARCHAR(64) NOT NULL,
    "qr_verify_url" TEXT NOT NULL,
    "status" "LetterStatus" NOT NULL DEFAULT 'DRAFT',
    "rejection_note" TEXT,
    "pdf_storage_url" TEXT,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "official_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "letter_sequences" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "letter_type" "LetterType" NOT NULL,
    "current_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "letter_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incoming_letters" (
    "id" TEXT NOT NULL,
    "agenda_number" VARCHAR(50) NOT NULL,
    "source_institution" VARCHAR(255) NOT NULL,
    "letter_number" VARCHAR(100) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "received_date" DATE NOT NULL,
    "file_url" TEXT,
    "disposition_note" TEXT,
    "disposition_target_division" "Division",
    "status" "IncomingLetterStatus" NOT NULL DEFAULT 'RECEIVED',
    "received_by_id" TEXT NOT NULL,
    "disposed_by_id" TEXT,
    "disposed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "incoming_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_flow" (
    "id" TEXT NOT NULL,
    "voucher_number" VARCHAR(50) NOT NULL,
    "transaction_date" DATE NOT NULL,
    "type" "CashFlowType" NOT NULL,
    "account_category" "AccountCategory" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "description" TEXT NOT NULL,
    "receipt_attachment_url" TEXT,
    "status" "CashFlowStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_note" TEXT,
    "verified_by_bendahara_id" TEXT,
    "verified_by_bendahara_at" TIMESTAMPTZ,
    "verified_by_ketum_id" TEXT,
    "verified_by_ketum_at" TIMESTAMPTZ,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cash_flow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_sequences" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "current_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "voucher_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "division_submissions" (
    "id" TEXT NOT NULL,
    "tracking_id" VARCHAR(50) NOT NULL,
    "division" "Division" NOT NULL,
    "program_title" VARCHAR(255) NOT NULL,
    "budget_estimate" DECIMAL(15,2) NOT NULL,
    "target_audience" TEXT,
    "execution_date" DATE,
    "submission_data" JSONB NOT NULL DEFAULT '{}',
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "approval_notes" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMPTZ,
    "submitted_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "division_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_sequences" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "current_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "submission_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploaded_files" (
    "id" TEXT NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "public_url" TEXT NOT NULL,
    "uploader_id" TEXT NOT NULL,
    "division" "Division",
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploaded_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "official_letters_letter_number_key" ON "official_letters"("letter_number");

-- CreateIndex
CREATE INDEX "official_letters_letter_type_idx" ON "official_letters"("letter_type");

-- CreateIndex
CREATE INDEX "official_letters_status_idx" ON "official_letters"("status");

-- CreateIndex
CREATE INDEX "official_letters_created_by_id_idx" ON "official_letters"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "letter_sequences_year_letter_type_key" ON "letter_sequences"("year", "letter_type");

-- CreateIndex
CREATE UNIQUE INDEX "incoming_letters_agenda_number_key" ON "incoming_letters"("agenda_number");

-- CreateIndex
CREATE INDEX "incoming_letters_status_idx" ON "incoming_letters"("status");

-- CreateIndex
CREATE INDEX "incoming_letters_received_date_idx" ON "incoming_letters"("received_date");

-- CreateIndex
CREATE UNIQUE INDEX "cash_flow_voucher_number_key" ON "cash_flow"("voucher_number");

-- CreateIndex
CREATE INDEX "cash_flow_transaction_date_idx" ON "cash_flow"("transaction_date");

-- CreateIndex
CREATE INDEX "cash_flow_account_category_idx" ON "cash_flow"("account_category");

-- CreateIndex
CREATE INDEX "cash_flow_status_idx" ON "cash_flow"("status");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_sequences_year_key" ON "voucher_sequences"("year");

-- CreateIndex
CREATE UNIQUE INDEX "division_submissions_tracking_id_key" ON "division_submissions"("tracking_id");

-- CreateIndex
CREATE INDEX "division_submissions_division_idx" ON "division_submissions"("division");

-- CreateIndex
CREATE INDEX "division_submissions_status_idx" ON "division_submissions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "submission_sequences_year_key" ON "submission_sequences"("year");

-- CreateIndex
CREATE INDEX "uploaded_files_uploader_id_idx" ON "uploaded_files"("uploader_id");

-- CreateIndex
CREATE INDEX "uploaded_files_division_idx" ON "uploaded_files"("division");

-- AddForeignKey
ALTER TABLE "official_letters" ADD CONSTRAINT "official_letters_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "official_letters" ADD CONSTRAINT "official_letters_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_flow" ADD CONSTRAINT "cash_flow_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "division_submissions" ADD CONSTRAINT "division_submissions_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

