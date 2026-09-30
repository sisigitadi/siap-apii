import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Division, UserRole } from '@prisma/client';
import { userSchema } from '@/common/dto/user.dto';

export const inviteUserSchema = z.object({
  email: z.string().email().describe('Email Google pengurus yang diundang'),
  fullName: z.string().min(1, 'Nama lengkap wajib diisi').describe('Nama lengkap'),
  role: z.nativeEnum(UserRole).describe('Peran yang diberikan saat aktivasi'),
  division: z
    .nativeEnum(Division)
    .nullable()
    .optional()
    .describe('Divisi — wajib untuk peran DIV_*'),
});
export class InviteUserDto extends createZodDto(inviteUserSchema) {}

export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(UserRole).describe('Peran baru'),
  division: z
    .nativeEnum(Division)
    .nullable()
    .optional()
    .describe('Divisi baru (wajib untuk peran DIV_*)'),
});
export class UpdateUserRoleDto extends createZodDto(updateUserRoleSchema) {}

export const updateDelegationSchema = z.object({
  canManageUsers: z.boolean().describe('Aktifkan atau cabut delegasi pengelolaan anggota'),
});
export class UpdateDelegationDto extends createZodDto(updateDelegationSchema) {}

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('Nomor halaman'),
  limit: z.coerce.number().int().min(1).max(100).default(20).describe('Jumlah entri per halaman'),
  role: z.nativeEnum(UserRole).optional().describe('Filter berdasarkan peran'),
  search: z.string().optional().describe('Pencarian pada nama atau email'),
});
export class ListUsersQueryDto extends createZodDto(listUsersQuerySchema) {}

const userListEntrySchema = userSchema.extend({
  invitedAt: z.string().datetime().nullable().describe('Tanggal undangan (ISO 8601)'),
  lastLoginAt: z.string().datetime().nullable().describe('Login terakhir (ISO 8601)'),
});
export class UserListEntryDto extends createZodDto(userListEntrySchema) {}

export const userListSchema = z.object({
  items: z.array(userListEntrySchema).describe('Daftar pengguna pada halaman ini'),
  total: z.number().int().describe('Total seluruh pengguna yang cocok dengan filter'),
  page: z.number().int().describe('Halaman saat ini'),
  limit: z.number().int().describe('Ukuran halaman'),
});
export class UserListDto extends createZodDto(userListSchema) {}

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type ListUsersInput = z.infer<typeof listUsersQuerySchema>;
export type UserList = z.infer<typeof userListSchema>;
