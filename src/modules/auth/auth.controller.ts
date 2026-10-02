import {
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { appConfigToken, type AppConfig } from '@/config/app.config';
import { UserDto } from '@/common/dto/user.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from '@/common/utils/cookies.util';
import type { AccessTokenClaims } from '@/infrastructure/jwt/jwt.service';
import {
  AuthorizationUrlDto,
  LogoutResultDto,
  TokenPairDto,
  UpdateProfileDto,
  type TokenPair,
} from './auth.dto';
import { AuthService, type ClientMeta } from './auth.service';

type CookieRequest = Request & { cookies?: Record<string, string | undefined> };

/**
 * Catatan: method ini mengembalikan tipe "mentah" (bukan instance DTO).
 * nestjs-zod + patchNestJsSwagger membaca skema dari kelas DTO di dekorator
 * @ApiOkResponse, jadi swagger.json tetap akurat tanpa duplikasi tipe.
 */
@ApiTags('Autentikasi')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Otentikasi diperlukan atau token tidak valid' })
@ApiForbiddenResponse({ description: 'Akses ditolak (mis. email belum terdaftar)' })
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(appConfigToken) private readonly config: AppConfig,
  ) {}

  private static meta(req: Request): ClientMeta {
    return {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
    };
  }

  private static readRefreshCookie(req: CookieRequest): string | undefined {
    return req.cookies?.[REFRESH_COOKIE];
  }

  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Dapatkan URL otorisasi Google (memulai PKCE)' })
  @ApiOkResponse({ type: AuthorizationUrlDto, description: 'URL untuk redirect ke Google' })
  async getGoogleAuthUrl(): Promise<{ authorizationUrl: string }> {
    return { authorizationUrl: await this.auth.getAuthorizationUrl() };
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Callback Google — terima token, set cookie, redirect ke frontend' })
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const tokens = await this.auth.handleGoogleCallback(code, state, AuthController.meta(req));
      setAuthCookies(res, this.config, tokens.accessToken, tokens.refreshToken);
      await res.redirect(this.config.FRONTEND_URL);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login gagal';
      const target = new URL('/auth/error', this.config.FRONTEND_URL);
      target.searchParams.set('message', message);
      await res.redirect(target.toString());
    }
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Perbarui sesi (rotasi refresh token)' })
  @ApiOkResponse({ type: TokenPairDto, description: 'Pasangan token baru' })
  async refresh(
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenPair> {
    const refreshToken = AuthController.readRefreshCookie(req);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token tidak ditemukan');
    }
    const tokens = await this.auth.refresh(refreshToken, AuthController.meta(req));
    setAuthCookies(res, this.config, tokens.accessToken, tokens.refreshToken);
    return tokens;
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout dari perangkat ini' })
  @ApiOkResponse({ type: LogoutResultDto })
  async logout(
    @CurrentUser() user: AccessTokenClaims,
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ revoked: boolean }> {
    await this.auth.logout(
      AuthController.readRefreshCookie(req),
      user.sub,
      AuthController.meta(req),
    );
    clearAuthCookies(res, this.config);
    return { revoked: true };
  }

  @Post('logout-all')
  @ApiOperation({ summary: 'Logout dari semua perangkat (FR-AUTH-02)' })
  @ApiOkResponse({ type: LogoutResultDto })
  async logoutAll(
    @CurrentUser() user: AccessTokenClaims,
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ revoked: boolean }> {
    await this.auth.logoutAll(user.sub, AuthController.meta(req));
    clearAuthCookies(res, this.config);
    return { revoked: true };
  }

  @Get('me')
  @ApiOperation({ summary: 'Profil pengguna yang sedang login' })
  @ApiOkResponse({ type: UserDto })
  async me(@CurrentUser() user: AccessTokenClaims): Promise<TokenPair['user']> {
    return this.auth.getProfile(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Perbarui nama tampilan & foto profil sendiri (FR-AUTH-08)' })
  @ApiOkResponse({ type: UserDto, description: 'Profil yang sudah diperbarui' })
  async updateMe(
    @CurrentUser() user: AccessTokenClaims,
    @Body() dto: UpdateProfileDto,
    @Req() req: Request,
  ): Promise<TokenPair['user']> {
    return this.auth.updateProfile(user.sub, dto, AuthController.meta(req));
  }
}
