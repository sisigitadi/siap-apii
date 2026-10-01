import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Division, Prisma, SubmissionStatus } from '@prisma/client';
import { DivisionsService } from './divisions.service';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { AuditService } from '@/infrastructure/audit/audit.service';
import { RedisService } from '@/infrastructure/redis/redis.service';

describe('DivisionsService', () => {
  let service: DivisionsService;

  const mockPrisma = {
    submissionSequence: { upsert: jest.fn() },
    divisionSubmission: {
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
        DivisionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<DivisionsService>(DivisionsService);
  });

  describe('generateTrackingId', () => {
    it('should format tracking id with year and zero-padded sequence', async () => {
      mockPrisma.submissionSequence.upsert.mockResolvedValue({ current_number: 89 });

      const date = new Date(2025, 5, 1);
      const trackingId = await service.generateTrackingId(date);

      expect(trackingId).toBe('#REQ-2025-089');
    });
  });

  describe('createSubmission', () => {
    it('should create draft submission and log audit', async () => {
      mockPrisma.submissionSequence.upsert.mockResolvedValue({ current_number: 1 });
      mockPrisma.divisionSubmission.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'sub-1', ...data }),
      );

      const result = await service.createSubmission('user-dakwah', Division.DIV_DAKWAH, {
        program_title: 'Safari Dakwah Ramadhan',
        budget_estimate: 15000000,
        target_audience: 'Masyarakat umum',
        submission_data: { ustadz: ['Ust. Ahmad'] },
        attachments: ['https://storage.apii.sigitadi.id/proposal.pdf'],
      });

      expect(result.status).toBe(SubmissionStatus.DRAFT);
      expect(result.tracking_id).toBe('#REQ-2026-001');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMISSION_CREATED' }),
      );
    });
  });

  describe('updateSubmission', () => {
    it('should throw ForbiddenException if user belongs to another division', async () => {
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue({
        id: 'sub-1',
        division: Division.DIV_DAKWAH,
        status: SubmissionStatus.DRAFT,
      });

      await expect(
        service.updateSubmission('sub-1', 'user-humas', Division.DIV_HUMAS, {
          program_title: 'Judul Baru',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow update on DRAFT by same division', async () => {
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue({
        id: 'sub-1',
        division: Division.DIV_DAKWAH,
        status: SubmissionStatus.DRAFT,
        program_title: 'Judul Lama',
        budget_estimate: new Prisma.Decimal(10000000),
      });

      mockPrisma.divisionSubmission.update.mockResolvedValue({
        id: 'sub-1',
        program_title: 'Judul Diperbarui',
        tracking_id: '#REQ-2025-001',
      });

      const updated = await service.updateSubmission('sub-1', 'user-dakwah', Division.DIV_DAKWAH, {
        program_title: 'Judul Diperbarui',
      });

      expect(updated.program_title).toBe('Judul Diperbarui');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMISSION_UPDATED' }),
      );
    });

    it('should throw NotFoundException when submission does not exist', async () => {
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSubmission('missing', 'user-dakwah', Division.DIV_DAKWAH, {
          program_title: 'Judul Baru',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when status is no longer DRAFT or REJECTED', async () => {
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue({
        id: 'sub-1',
        division: Division.DIV_DAKWAH,
        status: SubmissionStatus.PENDING_APPROVAL,
      });

      await expect(
        service.updateSubmission('sub-1', 'user-dakwah', Division.DIV_DAKWAH, {
          program_title: 'Judul Baru',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitForApproval', () => {
    it('should transition DRAFT to PENDING_APPROVAL', async () => {
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue({
        id: 'sub-1',
        division: Division.DIV_DAKWAH,
        status: SubmissionStatus.DRAFT,
        tracking_id: '#REQ-2025-001',
      });
      mockPrisma.divisionSubmission.update.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING_APPROVAL,
      });

      const updated = await service.submitForApproval('sub-1', 'user-dakwah', Division.DIV_DAKWAH);

      expect(updated.status).toBe(SubmissionStatus.PENDING_APPROVAL);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMISSION_SUBMITTED' }),
      );
    });

    it('should throw NotFoundException when submission does not exist', async () => {
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue(null);

      await expect(
        service.submitForApproval('missing', 'user-dakwah', Division.DIV_DAKWAH),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when submission is already approved', async () => {
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue({
        id: 'sub-1',
        division: Division.DIV_DAKWAH,
        status: SubmissionStatus.APPROVED,
      });

      await expect(
        service.submitForApproval('sub-1', 'user-dakwah', Division.DIV_DAKWAH),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when user belongs to another division', async () => {
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue({
        id: 'sub-1',
        division: Division.DIV_DAKWAH,
        status: SubmissionStatus.DRAFT,
      });

      await expect(
        service.submitForApproval('sub-1', 'user-humas', Division.DIV_HUMAS),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('approve', () => {
    it('should approve submission and emit redis event', async () => {
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue({
        id: 'sub-1',
        division: Division.DIV_DAKWAH,
        status: SubmissionStatus.PENDING_APPROVAL,
        tracking_id: '#REQ-2025-001',
        program_title: 'Safari Dakwah',
      });
      mockPrisma.divisionSubmission.update.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.APPROVED,
        tracking_id: '#REQ-2025-001',
        division: Division.DIV_DAKWAH,
        program_title: 'Safari Dakwah',
      });

      const approved = await service.approve('sub-1', 'ketum-1', {
        approval_notes: 'Disetujui untuk dilaksanakan',
      });

      expect(approved.status).toBe(SubmissionStatus.APPROVED);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMISSION_APPROVED' }),
      );
      expect(mockRedis.xAdd).toHaveBeenCalledWith(
        'audit:security',
        expect.objectContaining({ event: 'PROGRAM_APPROVED' }),
      );
    });

    it('should throw NotFoundException when submission does not exist', async () => {
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue(null);

      await expect(service.approve('missing', 'ketum-1', {})).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when submission is not PENDING_APPROVAL', async () => {
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.DRAFT,
      });

      await expect(service.approve('sub-1', 'ketum-1', {})).rejects.toThrow(BadRequestException);
    });
  });
  describe('reject', () => {
    it('should reject submission with notes', async () => {
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING_APPROVAL,
        tracking_id: '#REQ-2025-001',
      });
      mockPrisma.divisionSubmission.update.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.REJECTED,
      });

      const rejected = await service.reject('sub-1', 'ketum-1', {
        approval_notes: 'RAB terlalu tinggi, mohon disesuaikan',
      });

      expect(rejected.status).toBe(SubmissionStatus.REJECTED);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMISSION_REJECTED' }),
      );
    });

    it('should throw NotFoundException when submission does not exist', async () => {
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue(null);

      await expect(
        service.reject('missing', 'ketum-1', { approval_notes: 'Alasan' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when submission is not PENDING_APPROVAL', async () => {
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.APPROVED,
      });

      await expect(
        service.reject('sub-1', 'ketum-1', { approval_notes: 'Alasan' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('publish', () => {
    it('should transition APPROVED to PUBLISHED', async () => {
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.APPROVED,
        tracking_id: '#REQ-2025-001',
      });
      mockPrisma.divisionSubmission.update.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PUBLISHED,
      });

      const published = await service.publish('sub-1', 'ketum-1');

      expect(published.status).toBe(SubmissionStatus.PUBLISHED);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMISSION_PUBLISHED' }),
      );
    });

    it('should throw BadRequestException when submission is not APPROVED', async () => {
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING_APPROVAL,
      });

      await expect(service.publish('sub-1', 'ketum-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when submission does not exist', async () => {
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue(null);

      await expect(service.publish('missing', 'ketum-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should paginate submissions and build totalPages', async () => {
      mockPrisma.divisionSubmission.findMany.mockResolvedValue([{ id: 'sub-1' }]);
      mockPrisma.divisionSubmission.count.mockResolvedValue(21);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3);
      expect(mockPrisma.divisionSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('should scope query to user division when provided', async () => {
      mockPrisma.divisionSubmission.findMany.mockResolvedValue([]);
      mockPrisma.divisionSubmission.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 }, Division.DIV_DAKWAH);

      expect(mockPrisma.divisionSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { division: Division.DIV_DAKWAH } }),
      );
    });

    it('should apply status, division, search, and year filters', async () => {
      mockPrisma.divisionSubmission.findMany.mockResolvedValue([]);
      mockPrisma.divisionSubmission.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 10,
        status: SubmissionStatus.APPROVED,
        division: Division.DIV_HUMAS,
        search: 'safari',
        year: 2025,
      });

      expect(mockPrisma.divisionSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            division: Division.DIV_HUMAS,
            status: SubmissionStatus.APPROVED,
            OR: [
              { program_title: { contains: 'safari', mode: 'insensitive' } },
              { tracking_id: { contains: 'safari', mode: 'insensitive' } },
            ],
            created_at: { gte: expect.any(Date), lte: expect.any(Date) },
          },
        }),
      );
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException when submission does not exist', async () => {
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when accessing another division submission', async () => {
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue({
        id: 'sub-1',
        division: Division.DIV_HUMAS,
      });

      await expect(service.findById('sub-1', Division.DIV_DAKWAH)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return submission with submitter detail when found', async () => {
      const submission = {
        id: 'sub-1',
        division: Division.DIV_DAKWAH,
        program_title: 'Safari Dakwah',
        submitted_by: {
          id: 'user-1',
          full_name: 'Pengurus',
          email: 'p@apii.id',
          role: 'PUBLIK_ANGGOTA',
        },
      };
      mockPrisma.divisionSubmission.findUnique.mockResolvedValue(submission);

      const found = await service.findById('sub-1');

      expect(found.program_title).toBe('Safari Dakwah');
      expect(found.submitted_by.full_name).toBe('Pengurus');
    });
  });

  describe('getAggregateDashboard', () => {
    it('should aggregate division counts, status counts, approved budget, and upcoming programs', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      mockPrisma.divisionSubmission.findMany.mockResolvedValue([
        {
          division: Division.DIV_DAKWAH,
          status: SubmissionStatus.APPROVED,
          budget_estimate: new Prisma.Decimal(10_000_000),
          execution_date: futureDate,
          program_title: 'Safari Dakwah',
          tracking_id: '#REQ-2026-001',
        },
        {
          division: Division.DIV_HUMAS,
          status: SubmissionStatus.PUBLISHED,
          budget_estimate: new Prisma.Decimal(5_000_000),
          execution_date: null,
          program_title: 'Press Release',
          tracking_id: '#REQ-2026-002',
        },
        {
          division: Division.DIV_DAKWAH,
          status: SubmissionStatus.REJECTED,
          budget_estimate: new Prisma.Decimal(2_000_000),
          execution_date: null,
          program_title: 'Program Lama',
          tracking_id: '#REQ-2026-003',
        },
      ]);

      const dashboard = await service.getAggregateDashboard();

      expect(dashboard.total_submissions).toBe(3);
      expect(dashboard.divisions[Division.DIV_DAKWAH]).toBe(2);
      expect(dashboard.status[SubmissionStatus.APPROVED]).toBe(1);
      expect(dashboard.total_approved_budget).toBe(15_000_000);
      expect(dashboard.upcoming_programs).toHaveLength(1);
      expect(dashboard.upcoming_programs[0].tracking_id).toBe('#REQ-2026-001');
    });
  });
});
