import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AccountCategory,
  CashFlow,
  CashFlowStatus,
  CashFlowType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { AuditService } from '@/infrastructure/audit/audit.service';
import { RedisService } from '@/infrastructure/redis/redis.service';
import {
  CashFlowQueryDto,
  CreateCashFlowDto,
  MonthlyReportQueryDto,
  RejectVoucherDto,
} from './finance.dto';

/** Voucher kas dengan data pembuat (hasil query `include` Prisma). */
export type VoucherDetail = Prisma.CashFlowGetPayload<{
  include: {
    created_by: { select: { id: true; full_name: true; email: true; role: true } };
  };
}>;

/** Hasil daftar voucher kas yang terpaginasi. */
export type CashFlowList = {
  items: VoucherDetail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/** Saldo kas berjalan per rekening resmi yayasan (DESIGN.md §7.2). */
export type CashBalances = {
  accounts: Record<AccountCategory, number>;
  total_balance: number;
};

/** Rekapitulasi kas bulanan (DESIGN.md §7.3). */
export type MonthlyReport = {
  period: { year: number; month: number };
  opening_balance: number;
  total_inflow: number;
  total_outflow: number;
  closing_balance: number;
  accounts: Record<AccountCategory, { inflow: number; outflow: number; net: number }>;
  transactions: CashFlow[];
};

const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
  ) {}

  async generateVoucherNumber(date = new Date()): Promise<string> {
    const year = date.getFullYear();
    const month = date.getMonth();
    const romanMonth = ROMAN_MONTHS[month] ?? 'I';

    const seq = await this.prisma.voucherSequence.upsert({
      where: { year },
      update: { current_number: { increment: 1 } },
      create: { year, current_number: 1 },
    });

    const padded = String(seq.current_number).padStart(3, '0');
    return `${padded}/KEU-APII/JABO/${romanMonth}/${year}`;
  }

  async createVoucher(
    userId: string,
    userRole: UserRole,
    dto: CreateCashFlowDto,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<CashFlow> {
    const transactionDate = new Date(dto.transaction_date);
    const voucherNumber = await this.generateVoucherNumber(transactionDate);

    const isBendahara = userRole === UserRole.BENDAHARA;
    const initialStatus = isBendahara ? CashFlowStatus.VERIFIED_BENDAHARA : CashFlowStatus.PENDING;

    const voucher = await this.prisma.cashFlow.create({
      data: {
        voucher_number: voucherNumber,
        transaction_date: transactionDate,
        type: dto.type,
        account_category: dto.account_category,
        amount: new Prisma.Decimal(dto.amount),
        description: dto.description,
        receipt_attachment_url: dto.receipt_attachment_url,
        status: initialStatus,
        verified_by_bendahara_id: isBendahara ? userId : null,
        verified_by_bendahara_at: isBendahara ? new Date() : null,
        created_by_id: userId,
      },
    });

    await this.audit.log({
      action: 'CASH_FLOW_CREATED',
      actorId: userId,
      targetId: voucher.id,
      resource: `/finance/vouchers/${voucher.id}`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: {
        voucherNumber: voucher.voucher_number,
        amount: dto.amount,
        type: dto.type,
        account: dto.account_category,
      },
    });

    return voucher;
  }

  async verifyByBendahara(
    id: string,
    userId: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<CashFlow> {
    const voucher = await this.prisma.cashFlow.findUnique({ where: { id } });
    if (!voucher) {
      throw new NotFoundException(`Voucher dengan ID ${id} tidak ditemukan.`);
    }

    if (voucher.status !== CashFlowStatus.PENDING) {
      throw new BadRequestException(
        `Voucher hanya dapat diverifikasi Bendahara jika berstatus PENDING (status saat ini: ${voucher.status}).`,
      );
    }

    const updated = await this.prisma.cashFlow.update({
      where: { id },
      data: {
        status: CashFlowStatus.VERIFIED_BENDAHARA,
        verified_by_bendahara_id: userId,
        verified_by_bendahara_at: new Date(),
      },
    });

    await this.audit.log({
      action: 'CASH_FLOW_VERIFIED_BENDAHARA',
      actorId: userId,
      targetId: id,
      resource: `/finance/vouchers/${id}/verify-bendahara`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { voucherNumber: voucher.voucher_number },
    });

    return updated;
  }

  async verifyByKetum(
    id: string,
    userId: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<CashFlow> {
    const voucher = await this.prisma.cashFlow.findUnique({ where: { id } });
    if (!voucher) {
      throw new NotFoundException(`Voucher dengan ID ${id} tidak ditemukan.`);
    }

    if (voucher.status !== CashFlowStatus.VERIFIED_BENDAHARA) {
      throw new BadRequestException(
        `Voucher harus diverifikasi oleh Bendahara terlebih dahulu sebelum disetujui Ketua Umum (status saat ini: ${voucher.status}).`,
      );
    }

    const updated = await this.prisma.cashFlow.update({
      where: { id },
      data: {
        status: CashFlowStatus.VERIFIED_KETUM,
        verified_by_ketum_id: userId,
        verified_by_ketum_at: new Date(),
      },
    });

    await this.audit.log({
      action: 'CASH_FLOW_VERIFIED_KETUM',
      actorId: userId,
      targetId: id,
      resource: `/finance/vouchers/${id}/verify-ketum`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: {
        voucherNumber: voucher.voucher_number,
        amount: voucher.amount.toString(),
        type: voucher.type,
      },
    });

    await this.redis.xAdd('audit:security', {
      event: 'CASHBOOK_MUTATED',
      voucherNumber: updated.voucher_number,
      type: updated.type,
      account: updated.account_category,
      amount: updated.amount.toString(),
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  async rejectVoucher(
    id: string,
    userId: string,
    dto: RejectVoucherDto,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<CashFlow> {
    const voucher = await this.prisma.cashFlow.findUnique({ where: { id } });
    if (!voucher) {
      throw new NotFoundException(`Voucher dengan ID ${id} tidak ditemukan.`);
    }

    if (voucher.status === CashFlowStatus.VERIFIED_KETUM) {
      throw new BadRequestException('Voucher yang telah disetujui final tidak dapat ditolak.');
    }

    const updated = await this.prisma.cashFlow.update({
      where: { id },
      data: {
        status: CashFlowStatus.REJECTED,
        rejection_note: dto.rejection_note,
      },
    });

    await this.audit.log({
      action: 'CASH_FLOW_REJECTED',
      actorId: userId,
      targetId: id,
      resource: `/finance/vouchers/${id}/reject`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: {
        voucherNumber: voucher.voucher_number,
        rejectionNote: dto.rejection_note,
      },
    });

    return updated;
  }

  async findAll(query: CashFlowQueryDto): Promise<CashFlowList> {
    const { page, limit, type, account_category, status, start_date, end_date } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CashFlowWhereInput = {};
    if (type) where.type = type;
    if (account_category) where.account_category = account_category;
    if (status) where.status = status;
    if (start_date || end_date) {
      where.transaction_date = {};
      if (start_date) where.transaction_date.gte = new Date(start_date);
      if (end_date) where.transaction_date.lte = new Date(end_date);
    }

    const [items, total] = await Promise.all([
      this.prisma.cashFlow.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ transaction_date: 'desc' }, { created_at: 'desc' }],
        include: {
          created_by: {
            select: { id: true, full_name: true, email: true, role: true },
          },
        },
      }),
      this.prisma.cashFlow.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<VoucherDetail> {
    const voucher = await this.prisma.cashFlow.findUnique({
      where: { id },
      include: {
        created_by: {
          select: { id: true, full_name: true, email: true, role: true },
        },
      },
    });

    if (!voucher) {
      throw new NotFoundException(`Voucher dengan ID ${id} tidak ditemukan.`);
    }

    return voucher;
  }

  async getBalances(): Promise<CashBalances> {
    const verified = await this.prisma.cashFlow.findMany({
      where: { status: CashFlowStatus.VERIFIED_KETUM },
      select: { type: true, account_category: true, amount: true },
    });

    const balances: Record<AccountCategory, number> = {
      [AccountCategory.BSI_GIRO]: 0,
      [AccountCategory.BRANKAS_KAS_KECIL]: 0,
      [AccountCategory.MANDIRI_WAKAF]: 0,
    };

    let totalBalance = 0;

    for (const item of verified) {
      const num = Number(item.amount);
      const delta = item.type === CashFlowType.INFLOW ? num : -num;
      balances[item.account_category] += delta;
      totalBalance += delta;
    }

    return {
      accounts: balances,
      total_balance: totalBalance,
    };
  }

  async getMonthlyReport(query: MonthlyReportQueryDto): Promise<MonthlyReport> {
    const { year, month } = query;
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const [priorTransactions, monthTransactions] = await Promise.all([
      this.prisma.cashFlow.findMany({
        where: {
          status: CashFlowStatus.VERIFIED_KETUM,
          transaction_date: { lt: startOfMonth },
        },
        select: { type: true, account_category: true, amount: true },
      }),
      this.prisma.cashFlow.findMany({
        where: {
          status: CashFlowStatus.VERIFIED_KETUM,
          transaction_date: { gte: startOfMonth, lte: endOfMonth },
        },
        orderBy: { transaction_date: 'asc' },
      }),
    ]);

    let openingBalance = 0;
    for (const item of priorTransactions) {
      const num = Number(item.amount);
      openingBalance += item.type === CashFlowType.INFLOW ? num : -num;
    }

    let totalInflow = 0;
    let totalOutflow = 0;
    const accountSummary: Record<
      AccountCategory,
      { inflow: number; outflow: number; net: number }
    > = {
      [AccountCategory.BSI_GIRO]: { inflow: 0, outflow: 0, net: 0 },
      [AccountCategory.BRANKAS_KAS_KECIL]: { inflow: 0, outflow: 0, net: 0 },
      [AccountCategory.MANDIRI_WAKAF]: { inflow: 0, outflow: 0, net: 0 },
    };

    for (const item of monthTransactions) {
      const num = Number(item.amount);
      if (item.type === CashFlowType.INFLOW) {
        totalInflow += num;
        accountSummary[item.account_category].inflow += num;
        accountSummary[item.account_category].net += num;
      } else {
        totalOutflow += num;
        accountSummary[item.account_category].outflow += num;
        accountSummary[item.account_category].net -= num;
      }
    }

    const closingBalance = openingBalance + totalInflow - totalOutflow;

    return {
      period: { year, month },
      opening_balance: openingBalance,
      total_inflow: totalInflow,
      total_outflow: totalOutflow,
      closing_balance: closingBalance,
      accounts: accountSummary,
      transactions: monthTransactions,
    };
  }
}
