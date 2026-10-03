import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CashFlow, UserRole } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { AccessTokenClaims } from '@/infrastructure/jwt/jwt.service';
import {
  CashFlowQueryDto,
  CreateCashFlowDto,
  MonthlyReportQueryDto,
  RejectVoucherDto,
} from './finance.dto';
import { FinanceService } from './finance.service';
import type { CashBalances, CashFlowList, MonthlyReport, VoucherDetail } from './finance.service';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('vouchers')
  @Roles(UserRole.BENDAHARA, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Buat voucher kas baru (otomatis bernomor resmi)' })
  async createVoucher(
    @CurrentUser() user: AccessTokenClaims,
    @Body() dto: CreateCashFlowDto,
    @Req() req: Request,
  ): Promise<CashFlow> {
    return this.financeService.createVoucher(user.sub, user.role, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('vouchers')
  @Roles(UserRole.BENDAHARA, UserRole.KETUA, UserRole.SUPERADMIN, UserRole.PEMBINA, UserRole.PENGAWAS)
  @ApiOperation({ summary: 'Daftar voucher kas terfilter & terpaginasi' })
  async findAll(@Query() query: CashFlowQueryDto): Promise<CashFlowList> {
    return this.financeService.findAll(query);
  }

  @Get('balances')
  @Roles(UserRole.BENDAHARA, UserRole.KETUA, UserRole.SUPERADMIN, UserRole.PEMBINA, UserRole.PENGAWAS)
  @ApiOperation({ summary: 'Saldo kas berjalan real-time per rekening resmi yayasan' })
  async getBalances(): Promise<CashBalances> {
    return this.financeService.getBalances();
  }

  @Get('reports/monthly')
  @Roles(UserRole.BENDAHARA, UserRole.KETUA, UserRole.SUPERADMIN, UserRole.PEMBINA, UserRole.PENGAWAS)
  @ApiOperation({ summary: 'Laporan rekapitulasi kas bulanan resmi' })
  async getMonthlyReport(@Query() query: MonthlyReportQueryDto): Promise<MonthlyReport> {
    return this.financeService.getMonthlyReport(query);
  }

  @Get('vouchers/:id')
  @Roles(UserRole.BENDAHARA, UserRole.KETUA, UserRole.SUPERADMIN, UserRole.PEMBINA, UserRole.PENGAWAS)
  @ApiOperation({ summary: 'Detail voucher kas dan status dual-approval' })
  async findById(@Param('id') id: string): Promise<VoucherDetail> {
    return this.financeService.findById(id);
  }

  @Post('vouchers/:id/verify-bendahara')
  @Roles(UserRole.BENDAHARA, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Verifikasi voucher oleh Bendahara' })
  async verifyByBendahara(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenClaims,
    @Req() req: Request,
  ): Promise<CashFlow> {
    return this.financeService.verifyByBendahara(id, user.sub, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('vouchers/:id/verify-ketum')
  @Roles(UserRole.KETUA, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Persetujuan akhir voucher oleh Ketua (masuk buku kas resmi)' })
  async verifyByKetum(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenClaims,
    @Req() req: Request,
  ): Promise<CashFlow> {
    return this.financeService.verifyByKetum(id, user.sub, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('vouchers/:id/reject')
  @Roles(UserRole.BENDAHARA, UserRole.KETUA, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Tolak voucher keuangan dengan alasan tertulis' })
  async rejectVoucher(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenClaims,
    @Body() dto: RejectVoucherDto,
    @Req() req: Request,
  ): Promise<CashFlow> {
    return this.financeService.rejectVoucher(id, user.sub, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
