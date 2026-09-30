import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AccessTokenClaims } from '@/infrastructure/jwt/jwt.service';

/**
 * Ambil klaim JWT pengguna terautentikasi: `@CurrentUser() user`.
 * Wajib dipakai di endpoint yang sudah lewat `JwtAuthGuard`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenClaims => {
    const request = ctx.switchToHttp().getRequest<{ user?: AccessTokenClaims }>();
    if (!request.user) {
      throw new UnauthorizedException('Pengguna belum terautentikasi');
    }
    return request.user;
  },
);
