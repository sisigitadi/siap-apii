-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPERADMIN', 'KETUA_UMUM', 'SEKRETARIS', 'BENDAHARA', 'DEWAN_PENGAWAS', 'DIV_HUMAS', 'DIV_LITBANG', 'DIV_SOSMED', 'DIV_DAKWAH', 'DIV_INVESTASI', 'DIV_HUKUM', 'DIV_UMUM', 'PUBLIK_ANGGOTA');

-- CreateEnum
CREATE TYPE "Division" AS ENUM ('DIV_HUMAS', 'DIV_LITBANG', 'DIV_SOSMED', 'DIV_DAKWAH', 'DIV_INVESTASI', 'DIV_HUKUM', 'DIV_UMUM');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_DENIED', 'LOGOUT', 'CROSS_DIVISION_DENIED', 'ROLE_CHANGED', 'DELEGATION_TOGGLED', 'USER_INVITED', 'USER_ACTIVATED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "division" "Division",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "can_manage_users" BOOLEAN NOT NULL DEFAULT false,
    "profile_picture_url" TEXT,
    "invited_by_id" TEXT,
    "invited_at" TIMESTAMPTZ,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actor_id" TEXT,
    "target_id" TEXT,
    "resource" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_jti_key" ON "refresh_sessions"("jti");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_idx" ON "refresh_sessions"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

