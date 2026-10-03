import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Division, DivisionSubmission, UserRole } from '@prisma/client';
import { CROSS_DIVISION_ROLES, DIVISION_ROLES } from '@/common/constants/user-role.constant';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { AccessTokenClaims } from '@/infrastructure/jwt/jwt.service';
import {
  CreateSubmissionDto,
  RejectSubmissionDto,
  ReviewSubmissionDto,
  SubmissionQueryDto,
  UpdateSubmissionDto,
} from './divisions.dto';
import { DivisionsService } from './divisions.service';
import type {
  SubmissionAggregate,
  SubmissionList,
  SubmissionWithSubmitter,
} from './divisions.service';

@ApiTags('divisions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('divisions')
export class DivisionsController {
  constructor(private readonly divisionsService: DivisionsService) {}

  @Post('submissions')
  @Roles(...DIVISION_ROLES, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Buat draf usulan program kerja baru' })
  async createSubmission(
    @CurrentUser() user: AccessTokenClaims,
    @Body() dto: CreateSubmissionDto,
    @Req() req: Request,
  ): Promise<DivisionSubmission> {
    if (!user.division && user.role !== UserRole.SUPERADMIN) {
      throw new BadRequestException('Pengguna tidak memiliki divisi yang terdaftar.');
    }
    const division = user.division ?? Division.DIV_UMUM;
    return this.divisionsService.createSubmission(user.sub, division, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('dashboard/aggregate')
  @Roles(...CROSS_DIVISION_ROLES)
  @ApiOperation({ summary: 'Dasbor agregat usulan program 7 divisi untuk pimpinan' })
  async getAggregateDashboard(): Promise<SubmissionAggregate> {
    return this.divisionsService.getAggregateDashboard();
  }

  @Get('submissions')
  @Roles(...DIVISION_ROLES, ...CROSS_DIVISION_ROLES)
  @ApiOperation({
    summary: 'Daftar usulan program kerja (terisolasi per divisi bagi pengurus divisi)',
  })
  async findAllSubmissions(
    @CurrentUser() user: AccessTokenClaims,
    @Query() query: SubmissionQueryDto,
  ): Promise<SubmissionList> {
    const isLeadership = CROSS_DIVISION_ROLES.includes(user.role);
    const scopedDivision = isLeadership ? undefined : (user.division ?? undefined);
    return this.divisionsService.findAll(query, scopedDivision);
  }

  @Get('submissions/:id')
  @Roles(...DIVISION_ROLES, ...CROSS_DIVISION_ROLES)
  @ApiOperation({ summary: 'Detail usulan program kerja' })
  async findSubmissionById(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<SubmissionWithSubmitter> {
    const isLeadership = CROSS_DIVISION_ROLES.includes(user.role);
    const scopedDivision = isLeadership ? undefined : (user.division ?? undefined);
    return this.divisionsService.findById(id, scopedDivision);
  }

  @Patch('submissions/:id')
  @Roles(...DIVISION_ROLES, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Perbarui usulan program (hanya DRAFT atau REJECTED)' })
  async updateSubmission(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenClaims,
    @Body() dto: UpdateSubmissionDto,
    @Req() req: Request,
  ): Promise<DivisionSubmission> {
    const isSuper = user.role === UserRole.SUPERADMIN;
    return this.divisionsService.updateSubmission(
      id,
      user.sub,
      isSuper ? null : (user.division ?? null),
      dto,
      { ip: req.ip, userAgent: req.headers['user-agent'] },
    );
  }

  @Post('submissions/:id/submit')
  @Roles(...DIVISION_ROLES, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Ajukan usulan program ke Ketua (PENDING_APPROVAL)' })
  async submitForApproval(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenClaims,
    @Req() req: Request,
  ): Promise<DivisionSubmission> {
    const isSuper = user.role === UserRole.SUPERADMIN;
    return this.divisionsService.submitForApproval(
      id,
      user.sub,
      isSuper ? null : (user.division ?? null),
      { ip: req.ip, userAgent: req.headers['user-agent'] },
    );
  }

  @Post('submissions/:id/approve')
  @Roles(UserRole.KETUA, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Approval Board: Setujui usulan program kerja oleh Ketua' })
  async approveSubmission(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenClaims,
    @Body() dto: ReviewSubmissionDto,
    @Req() req: Request,
  ): Promise<DivisionSubmission> {
    return this.divisionsService.approve(id, user.sub, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('submissions/:id/reject')
  @Roles(UserRole.KETUA, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Tolak usulan program kerja dengan catatan revisi' })
  async rejectSubmission(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenClaims,
    @Body() dto: RejectSubmissionDto,
    @Req() req: Request,
  ): Promise<DivisionSubmission> {
    return this.divisionsService.reject(id, user.sub, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('submissions/:id/publish')
  @Roles(UserRole.KETUA, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Publikasi program terlaksana ke portal publik' })
  async publishSubmission(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenClaims,
    @Req() req: Request,
  ): Promise<DivisionSubmission> {
    return this.divisionsService.publish(id, user.sub, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
