import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { IncomingLetter, UserRole } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { AccessTokenClaims } from '@/infrastructure/jwt/jwt.service';
import {
  CreateIncomingLetterDto,
  DisposeIncomingLetterDto,
  IncomingLetterQueryDto,
} from './letters.dto';
import { IncomingLettersService } from './incoming-letters.service';
import type { IncomingLetterList } from './incoming-letters.service';

@ApiTags('letters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/incoming-letters')
export class IncomingLettersController {
  constructor(private readonly incomingService: IncomingLettersService) {}

  @Post()
  @Roles(UserRole.SEKRETARIS, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Catat agenda surat masuk baru' })
  async createIncoming(
    @CurrentUser() user: AccessTokenClaims,
    @Body() dto: CreateIncomingLetterDto,
    @Req() req: Request,
  ): Promise<IncomingLetter> {
    return this.incomingService.create(user.sub, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get()
  @Roles(UserRole.SEKRETARIS, UserRole.KETUA_UMUM, UserRole.SUPERADMIN, UserRole.DEWAN_PENGAWAS)
  @ApiOperation({ summary: 'Daftar agenda surat masuk & status disposisi' })
  async findAllIncoming(@Query() query: IncomingLetterQueryDto): Promise<IncomingLetterList> {
    return this.incomingService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.SEKRETARIS, UserRole.KETUA_UMUM, UserRole.SUPERADMIN, UserRole.DEWAN_PENGAWAS)
  @ApiOperation({ summary: 'Detail agenda surat masuk' })
  async findIncomingById(@Param('id') id: string): Promise<IncomingLetter> {
    return this.incomingService.findById(id);
  }

  @Post(':id/dispose')
  @Roles(UserRole.KETUA_UMUM, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Berikan instruksi disposisi surat masuk ke divisi' })
  async disposeIncoming(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenClaims,
    @Body() dto: DisposeIncomingLetterDto,
    @Req() req: Request,
  ): Promise<IncomingLetter> {
    return this.incomingService.dispose(id, user.sub, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
