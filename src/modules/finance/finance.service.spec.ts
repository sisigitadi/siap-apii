import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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

    it('should throw NotFoundException when voucher does not exist', async () => {
      mockPrisma.cashFlow.findUnique.mockResolvedValue(null);

      await expect(service.verifyByKetum('missing', 'ketum-id')).rejects.toThrow(NotFoundException);
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

  describe('verifyByBendahara', () => {
    it('should transition PENDING to VERIFIED_BENDAHARA', async () => {
      mockPrisma.cashFlow.findUnique.mockResolvedValue({
        id: 'voucher-1',
        voucher_number: '001/KEU-APII/JABO/III/2025',
        status: CashFlowStatus.PENDING,
      });
      mockPrisma.cashFlow.update.mockResolvedValue({
        id: 'voucher-1',
        status: CashFlowStatus.VERIFIED_BENDAHARA,
      });

      const updated = await service.verifyByBendahara('voucher-1', 'bendahara-id');

      expect(updated.status).toBe(CashFlowStatus.VERIFIED_BENDAHARA);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CASH_FLOW_VERIFIED_BENDAHARA' }),
      );
    });

    it('should throw NotFoundException when voucher does not exist', async () => {
      mockPrisma.cashFlow.findUnique.mockResolvedValue(null);

      await expect(service.verifyByBendahara('missing', 'bendahara-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when voucher is not PENDING', async () => {
      mockPrisma.cashFlow.findUnique.mockResolvedValue({
        id: 'voucher-1',
        status: CashFlowStatus.REJECTED,
      });

      await expect(service.verifyByBendahara('voucher-1', 'bendahara-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('rejectVoucher', () => {
    it('should set status to REJECTED with a note', async () => {
      mockPrisma.cashFlow.findUnique.mockResolvedValue({
        id: 'voucher-1',
        voucher_number: '001/KEU-APII/JABO/III/2025',
        status: CashFlowStatus.PENDING,
      });
      mockPrisma.cashFlow.update.mockResolvedValue({
        id: 'voucher-1',
        status: CashFlowStatus.REJECTED,
        rejection_note: 'Kwitansi tidak dapat dibuktikan',
      });

      const rejected = await service.rejectVoucher('voucher-1', 'ketum-id', {
        rejection_note: 'Kwitansi tidak dapat dibuktikan',
      });

      expect(rejected.status).toBe(CashFlowStatus.REJECTED);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CASH_FLOW_REJECTED' }),
      );
    });

    it('should throw BadRequestException when voucher is already VERIFIED_KETUM', async () => {
      mockPrisma.cashFlow.findUnique.mockResolvedValue({
        id: 'voucher-1',
        status: CashFlowStatus.VERIFIED_KETUM,
      });

      await expect(
        service.rejectVoucher('voucher-1', 'ketum-id', { rejection_note: 'Alasan' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when voucher does not exist', async () => {
      mockPrisma.cashFlow.findUnique.mockResolvedValue(null);

      await expect(
        service.rejectVoucher('missing', 'ketum-id', { rejection_note: 'Alasan' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should paginate vouchers and build totalPages', async () => {
      mockPrisma.cashFlow.findMany.mockResolvedValue([{ id: 'voucher-1' }]);
      mockPrisma.cashFlow.count.mockResolvedValue(25);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3);
      expect(mockPrisma.cashFlow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('should apply type, account, status, and date range filters', async () => {
      mockPrisma.cashFlow.findMany.mockResolvedValue([]);
      mockPrisma.cashFlow.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 10,
        type: CashFlowType.INFLOW,
        account_category: AccountCategory.BSI_GIRO,
        status: CashFlowStatus.VERIFIED_KETUM,
        start_date: '2025-01-01',
        end_date: '2025-12-31',
      });

      expect(mockPrisma.cashFlow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            type: CashFlowType.INFLOW,
            account_category: AccountCategory.BSI_GIRO,
            status: CashFlowStatus.VERIFIED_KETUM,
            transaction_date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31') },
          },
        }),
      );
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException when voucher does not exist', async () => {
      mockPrisma.cashFlow.findUnique.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });

    it('should return voucher with creator detail when found', async () => {
      const voucher = {
        id: 'voucher-1',
        voucher_number: '001/KEU-APII/JABO/III/2025',
        amount: new Prisma.Decimal(5_000_000),
        created_by: {
          id: 'user-1',
          full_name: 'Bendahara',
          email: 'b@apii.id',
          role: UserRole.BENDAHARA,
        },
      };
      mockPrisma.cashFlow.findUnique.mockResolvedValue(voucher);

      const found = await service.findById('voucher-1');

      expect(found.voucher_number).toBe('001/KEU-APII/JABO/III/2025');
      expect(found.created_by.full_name).toBe('Bendahara');
    });
  });

  describe('getMonthlyReport', () => {
    it('should compute opening balance, monthly flow, and closing balance', async () => {
      mockPrisma.cashFlow.findMany
        .mockResolvedValueOnce([
          {
            type: CashFlowType.INFLOW,
            account_category: AccountCategory.BSI_GIRO,
            amount: new Prisma.Decimal(10_000_000),
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'voucher-1',
            voucher_number: '001/KEU-APII/JABO/III/2025',
            transaction_date: new Date(2025, 2, 10),
            type: CashFlowType.INFLOW,
            account_category: AccountCategory.BSI_GIRO,
            amount: new Prisma.Decimal(4_000_000),
            description: 'Infaq donatur',
            status: CashFlowStatus.VERIFIED_KETUM,
          },
          {
            id: 'voucher-2',
            voucher_number: '002/KEU-APII/JABO/III/2025',
            transaction_date: new Date(2025, 2, 15),
            type: CashFlowType.OUTFLOW,
            account_category: AccountCategory.BRANKAS_KAS_KECIL,
            amount: new Prisma.Decimal(1_500_000),
            description: 'Konsumsi rapat pengurus',
            status: CashFlowStatus.VERIFIED_KETUM,
          },
        ]);

      const report = await service.getMonthlyReport({ year: 2025, month: 3 });

      expect(report.opening_balance).toBe(10_000_000);
      expect(report.total_inflow).toBe(4_000_000);
      expect(report.total_outflow).toBe(1_500_000);
      expect(report.closing_balance).toBe(12_500_000);
      expect(report.accounts[AccountCategory.BSI_GIRO].inflow).toBe(4_000_000);
      expect(report.accounts[AccountCategory.BRANKAS_KAS_KECIL].outflow).toBe(1_500_000);
      expect(report.transactions).toHaveLength(2);
    });
  });
});
