import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
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
  });
});
