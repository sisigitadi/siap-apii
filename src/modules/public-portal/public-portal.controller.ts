import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { AccessTokenClaims } from '@/infrastructure/jwt/jwt.service';
import {
  MemberCardDto,
  PublicFeedListDto,
  PublicFeedQueryDto,
  PublicScheduleListDto,
  PublicScheduleQueryDto,
  VerificationResultDto,
} from './public-portal.dto';
import { PublicPortalService } from './public-portal.service';

/**
 * Catatan: method mengembalikan tipe "mentah" (bukan instance DTO) —
 * nestjs-zod + patchNestJsSwagger membaca skema dari kelas DTO di dekorator
 * @ApiOkResponse, jadi swagger.json tetap akurat tanpa duplikasi tipe.
 */
@ApiTags('Portal Publik')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Otentikasi diperlukan untuk endpoint anggota' })
@Controller('api/v1/public')
export class PublicPortalController {
  constructor(private readonly publicPortal: PublicPortalService) {}

  @Public()
  @Get('verify/:sha256')
  @ApiOperation({ summary: 'Verifikasi keaslian dokumen via sidik jari SHA-256 (publik)' })
  @ApiOkResponse({ type: VerificationResultDto, description: 'Hasil verifikasi dokumen' })
  async verifyDocument(@Param('sha256') sha256: string): Promise<VerificationResultDto> {
    return this.publicPortal.verifyDocument(sha256);
  }

  @Public()
  @Get('feed')
  @ApiOperation({ summary: 'Feed informasi resmi yang sudah dirilis (publik)' })
  @ApiOkResponse({ type: PublicFeedListDto, description: 'Daftar surat berstatus PUBLISHED' })
  async findPublicFeed(@Query() query: PublicFeedQueryDto): Promise<PublicFeedListDto> {
    return this.publicPortal.findPublicFeed(query);
  }

  @Public()
  @Get('schedules')
  @ApiOperation({ summary: 'Jadwal kajian & program resmi yang dipublikasi (publik)' })
  @ApiOkResponse({ type: PublicScheduleListDto, description: 'Daftar program berstatus PUBLISHED' })
  async findPublicSchedules(
    @Query() query: PublicScheduleQueryDto,
  ): Promise<PublicScheduleListDto> {
    return this.publicPortal.findPublicSchedules(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PUBLIK_ANGGOTA)
  @Get('members/me/e-kta')
  @ApiOperation({ summary: 'e-KTA digital anggota (hanya PUBLIK_ANGGOTA, data sendiri)' })
  @ApiOkResponse({ type: MemberCardDto, description: 'Kartu anggota digital 5 tahun' })
  async getMyMemberCard(@CurrentUser() user: AccessTokenClaims): Promise<MemberCardDto> {
    return this.publicPortal.getMyMemberCard(user.sub);
  }
}
