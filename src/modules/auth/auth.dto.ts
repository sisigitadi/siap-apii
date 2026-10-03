import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { userSchema } from '@/common/dto/user.dto';

export const tokenPairSchema = z.object({
  user: userSchema.describe('Profil pengguna yang baru login'),
  accessToken: z.string().describe('Access token JWT RS256'),
  refreshToken: z.string().describe('Refresh token JWT RS256'),
});

export class TokenPairDto extends createZodDto(tokenPairSchema) {}

export type TokenPair = z.infer<typeof tokenPairSchema>;

export const authorizationUrlSchema = z.object({
  authorizationUrl: z.string().url().describe('URL untuk membuka halaman persetujuan Google'),
});

export class AuthorizationUrlDto extends createZodDto(authorizationUrlSchema) {}

export const devLoginSchema = z.object({
  email: z.string().email().describe('Email akun demo yang akan dimasuki (lihat seed demo)'),
});
export class DevLoginDto extends createZodDto(devLoginSchema) {}

export const logoutResultSchema = z.object({
  revoked: z.boolean().describe('Apakah sesi berhasil dicabut'),
});

export class LogoutResultDto extends createZodDto(logoutResultSchema) {}

export const updateProfileSchema = z.object({
  full_name: z
    .string()
    .min(1, 'Nama lengkap wajib diisi')
    .max(100, 'Nama lengkap maksimal 100 karakter')
    .describe('Nama tampilan baru'),
  profile_picture_url: z
    .string()
    .url()
    .optional()
    .describe('URL foto profil baru (opsional)'),
});
export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
