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

export const logoutResultSchema = z.object({
  revoked: z.boolean().describe('Apakah sesi berhasil dicabut'),
});

export class LogoutResultDto extends createZodDto(logoutResultSchema) {}
