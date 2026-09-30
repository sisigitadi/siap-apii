import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Division, type User, UserRole } from '@prisma/client';

/**
 * Representasi pengguna yang aman dikirim ke klien (DESIGN.md §4.1).
 * Dipakai bersama oleh modul auth & users — ditaruh di common supaya tidak
 * ada modul yang saling import (PROJECT_RULES.md §1.1).
 */
export const userSchema = z.object({
  id: z.string().uuid().describe('ID pengguna (UUID)'),
  email: z.string().email().describe('Email Google/Workspace terdaftar'),
  fullName: z.string().describe('Nama lengkap'),
  role: z.nativeEnum(UserRole).describe('Peran pengguna (RBAC, DESIGN.md §5.1)'),
  division: z.nativeEnum(Division).nullable().describe('Divisi — hanya untuk peran DIV_*'),
  isActive: z.boolean().describe('Status aktif akun'),
  canManageUsers: z.boolean().describe('Boleh mengelola anggota (hasil delegasi)'),
});

export class UserDto extends createZodDto(userSchema) {}

export type PublicUser = z.infer<typeof userSchema>;

/** Pemetaan Prisma User (snake_case) → PublicUser (camelCase) */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    division: user.division,
    isActive: user.is_active,
    canManageUsers: user.can_manage_users,
  };
}
