import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { ACCESS_COOKIE } from '@/common/utils/cookies.util';
import { JwtService } from '@/infrastructure/jwt/jwt.service';

type CookieRequest = Request & { cookies?: Record<string, string | undefined> };

/**
 * Guard default: verifikasi access token dari cookie httpOnly atau
 * header `Authorization: Bearer`. Endpoint publik pakai @Public().
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<CookieRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Otentikasi diperlukan untuk mengakses endpoint ini');
    }
    request.user = this.jwt.verifyAccessToken(token);
    return true;
  }

  private extractToken(request: CookieRequest): string | null {
    const fromCookie = request.cookies?.[ACCESS_COOKIE];
    if (fromCookie) {
      return fromCookie;
    }
    const header = request.headers.authorization;
    if (!header) {
      return null;
    }
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return null;
    }
    return token;
  }
}
