import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AccountCategory, CashFlowStatus, CashFlowType, Prisma, UserRole } from '@prisma/client';
import { FinanceService } from './finance.service';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { AuditService } from '@/infrastructure/audit/audit.service';
import { RedisService } from '@/infrastructure/redis/redis.service';

describe('FinanceService', () => {
  let service: FinanceService;

  const mockPrisma = {
    voucherSequence: { upsert: jest.fn() },
    cashFlow: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
  const mockRedis = { xAdd: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  describe('generateVoucherNumber', () => {
    it('should format voucher number with sequence, Roman month, and year', async () => {
      mockPrisma.voucherSequence.upsert.mockResolvedValue({ current_number: 88 });

      const date = new Date(2025, 1, 10); // Feb 2025 -> II
      const voucherNum = await service.generateVoucherNumber(date);

      expect(voucherNum).toBe('088/KEU-APII/JABO/II/2025');
    });
  });

  describe('createVoucher', () => {
    it('should set status to VERIFIED_BENDAHARA when created by Bendahara', async () => {
      mockPrisma.voucherSequence.upsert.mockResolvedValue({ current_number: 1 });
      mockPrisma.cashFlow.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'voucher-1', ...data }),
      );

      const voucher = await service.createVoucher('bendahara-id', UserRole.BENDAHARA, {
        transaction_date: '2025-03-01',
        type: CashFlowType.INFLOW,
        account_category: AccountCategory.BSI_GIRO,
        amount: 5000000,
        description: 'Infaq donatur',
      });

      expect(voucher.status).toBe(CashFlowStatus.VERIFIED_BENDAHARA);
      expect(voucher.verified_by_bendahara_id).toBe('bendahara-id');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CASH_FLOW_CREATED' }),
      );
    });

    it('should set status to PENDING when created by other roles', async () => {
      mockPrisma.voucherSequence.upsert.mockResolvedValue({ current_number: 2 });
      mockPrisma.cashFlow.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'voucher-2', ...data }),
      );

      const voucher = await service.createVoucher('admin-id', UserRole.SUPERADMIN, {
        transaction_date: '2025-03-01',
        type: CashFlowType.OUTFLOW,
        account_category: AccountCategory.BRANKAS_KAS_KECIL,
        amount: 250000,
        description: 'Konsumsi rapat',
      });

      expect(voucher.status).toBe(CashFlowStatus.PENDING);
    });
  });

  describe('verifyByKetum', () => {
    it('should transition VERIFIED_BENDAHARA to VERIFIED_KETUM and emit event', async () => {
      mockPrisma.cashFlow.findUnique.mockResolvedValue({
        id: 'voucher-1',
        voucher_number: '001/KEU-APII/JABO/III/2025',
        status: CashFlowStatus.VERIFIED_BENDAHARA,
        amount: new Prisma.Decimal(5000000),
        type: CashFlowType.INFLOW,
        account_category: AccountCategory.BSI_GIRO,
      });

      mockPrisma.cashFlow.update.mockResolvedValue({
        id: 'voucher-1',
        voucher_number: '001/KEU-APII/JABO/III/2025',
        status: CashFlowStatus.VERIFIED_KETUM,
        amount: new Prisma.Decimal(5000000),
        type: CashFlowType.INFLOW,
        account_category: AccountCategory.BSI_GIRO,
      });

      const updated = await service.verifyByKetum('voucher-1', 'ketum-id');

      expect(updated.status).toBe(CashFlowStatus.VERIFIED_KETUM);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CASH_FLOW_VERIFIED_KETUM' }),
      );
      expect(mockRedis.xAdd).toHaveBeenCalledWith(
        'audit:security',
        expect.objectContaining({ event: 'CASHBOOK_MUTATED' }),
      );
    });

    it('should reject if voucher has not been verified by Bendahara first', async () => {
      mockPrisma.cashFlow.findUnique.mockResolvedValue({
        id: 'voucher-1',
        status: CashFlowStatus.PENDING,
      });

      await expect(service.verifyByKetum('voucher-1', 'ketum-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getBalances', () => {
    it('should calculate running balance per account accurately for verified transactions', async () => {
      mockPrisma.cashFlow.findMany.mockResolvedValue([
        {
          type: CashFlowType.INFLOW,
          account_category: AccountCategory.BSI_GIRO,
          amount: new Prisma.Decimal(10000000),
        },
        {
          type: CashFlowType.OUTFLOW,
          account_category: AccountCategory.BSI_GIRO,
          amount: new Prisma.Decimal(2000000),
        },
        {
          type: CashFlowType.INFLOW,
          account_category: AccountCategory.BRANKAS_KAS_KECIL,
          amount: new Prisma.Decimal(1000000),
        },
      ]);

      const result = await service.getBalances();

      expect(result.accounts[AccountCategory.BSI_GIRO]).toBe(8000000);
      expect(result.accounts[AccountCategory.BRANKAS_KAS_KECIL]).toBe(1000000);
      expect(result.accounts[AccountCategory.MANDIRI_WAKAF]).toBe(0);
      expect(result.total_balance).toBe(9000000);
    });
  });
});
