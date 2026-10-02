import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { OfficialLetter, UserRole } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { AccessTokenClaims } from '@/infrastructure/jwt/jwt.service';
import { CreateLetterDto, LetterQueryDto, RejectLetterDto, UpdateLetterDto } from './letters.dto';
import { LettersService } from './letters.service';
import type { LetterDetail, LetterList } from './letters.service';
import { LettersPdfService, type RenderableLetter } from './letters-pdf.service';

@ApiTags('letters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('official-letters')
export class LettersController {
  constructor(
    private readonly lettersService: LettersService,
    private readonly pdfService: LettersPdfService,
  ) {}

  @Post()
  @Roles(UserRole.SEKRETARIS, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Buat draf surat resmi baru' })
  async createLetter(
    @CurrentUser() user: AccessTokenClaims,
    @Body() dto: CreateLetterDto,
    @Req() req: Request,
  ): Promise<OfficialLetter> {
    return this.lettersService.createLetter(user.sub, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get()
  @Roles(UserRole.SEKRETARIS, UserRole.KETUA_UMUM, UserRole.SUPERADMIN, UserRole.DEWAN_PENGAWAS)
  @ApiOperation({ summary: 'Daftar surat resmi terfilter & terpaginasi' })
  async findAllLetters(@Query() query: LetterQueryDto): Promise<LetterList> {
    return this.lettersService.findAllLetters(query);
  }

  @Get(':id')
  @Roles(UserRole.SEKRETARIS, UserRole.KETUA_UMUM, UserRole.SUPERADMIN, UserRole.DEWAN_PENGAWAS)
  @ApiOperation({ summary: 'Detail surat resmi beserta status integritas SHA-256' })
  async findLetterById(@Param('id') id: string): Promise<LetterDetail> {
    return this.lettersService.findLetterById(id);
  }

  @Get(':id/render-html')
  @Roles(UserRole.SEKRETARIS, UserRole.KETUA_UMUM, UserRole.SUPERADMIN, UserRole.DEWAN_PENGAWAS)
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'Render pratinjau HTML A4 dokumen resmi ber-kop dan ber-stempel' })
  async renderHtml(@Param('id') id: string): Promise<string> {
    const letter = await this.lettersService.findLetterById(id);
    const renderable = letter as unknown as RenderableLetter;
    const qrDataUrl = await this.pdfService.generateQrDataUrl(letter.qr_verify_url);
    return this.pdfService.renderLetterHtml(renderable, qrDataUrl);
  }

  @Get(':id/render-pdf')
  @Roles(UserRole.SEKRETARIS, UserRole.KETUA_UMUM, UserRole.SUPERADMIN, UserRole.DEWAN_PENGAWAS)
  @ApiOperation({ summary: 'Render dokumen resmi ke PDF (FR-LETTER-04/05/06)' })
  async renderPdf(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const letter = await this.lettersService.findLetterById(id);
    const pdf = await this.pdfService.renderLetterPdf(letter as unknown as RenderableLetter);
    res.set('Content-Type', 'application/pdf');
    res.send(pdf);
  }

  @Get(':id/download')
  @Roles(UserRole.SEKRETARIS, UserRole.KETUA_UMUM, UserRole.SUPERADMIN, UserRole.DEWAN_PENGAWAS)
  @ApiOperation({ summary: 'Unduh PDF immutable surat resmi (FR-LETTER-09)' })
  async downloadPdf(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const letter = await this.lettersService.findLetterById(id);
    const renderable = letter as unknown as RenderableLetter;
    const filename = `${letter.letter_number.replace(/[^a-zA-Z0-9._-]/g, '-')}.pdf`;

    // FR-LETTER-09: arsipkan PDF sekali saat unduh pertama, lalu sajikan hasilnya.
    if (!letter.pdf_storage_url) {
      const publicUrl = await this.pdfService.persistLetterPdf(renderable);
      if (publicUrl) {
        await this.lettersService.recordPdfStorageUrl(id, publicUrl);
      }
    }

    const stored = await this.lettersService.readStoredPdf(renderable);
    if (stored) {
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(stored);
      return;
    }

    // Fallback: render on-demand (filesystem read-only / serverless).
    const pdf = await this.pdfService.renderLetterPdf(renderable);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  }

  @Patch(':id')
  @Roles(UserRole.SEKRETARIS, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Perbarui draf surat resmi' })
  async updateLetter(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenClaims,
    @Body() dto: UpdateLetterDto,
    @Req() req: Request,
  ): Promise<OfficialLetter> {
    return this.lettersService.updateLetter(id, user.sub, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post(':id/submit')
  @Roles(UserRole.SEKRETARIS, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Ajukan draf surat ke pimpinan (PENDING_APPROVAL)' })
  async submitLetter(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenClaims,
    @Req() req: Request,
  ): Promise<OfficialLetter> {
    return this.lettersService.submitLetter(id, user.sub, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post(':id/approve-and-publish')
  @Roles(UserRole.KETUA_UMUM, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Setujui dan rilis surat resmi ke publik (PUBLISHED)' })
  async approveAndPublishLetter(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenClaims,
    @Req() req: Request,
  ): Promise<OfficialLetter> {
    return this.lettersService.approveAndPublishLetter(id, user.sub, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post(':id/reject')
  @Roles(UserRole.KETUA_UMUM, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Tolak surat resmi dengan catatan revisi (REJECTED)' })
  async rejectLetter(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenClaims,
    @Body() dto: RejectLetterDto,
    @Req() req: Request,
  ): Promise<OfficialLetter> {
    return this.lettersService.rejectLetter(id, user.sub, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post(':id/archive')
  @Roles(UserRole.SEKRETARIS, UserRole.KETUA_UMUM, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Arsipkan surat resmi yang telah rilis' })
  async archiveLetter(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenClaims,
    @Req() req: Request,
  ): Promise<OfficialLetter> {
    return this.lettersService.archiveLetter(id, user.sub, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
