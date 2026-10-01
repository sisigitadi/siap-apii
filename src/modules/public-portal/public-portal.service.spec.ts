import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Division, LetterStatus, LetterType, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { appConfigToken } from '@/config/app.config';
import { PublicPortalService } from './public-portal.service';

describe('PublicPortalService', () => {
  let service: PublicPortalService;

  const mockPrisma = {
    officialLetter: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    divisionSubmission: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockConfig = {
    PUBLIC_VERIFY_BASE_URL: 'https://app.apii.sigitadi.id/verify',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicPortalService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: appConfigToken, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<PublicPortalService>(PublicPortalService);
  });

  const VALID_SHA256 = 'a'.repeat(64);

  describe('verifyDocument', () => {
    it('should verify a published document by its SHA-256', async () => {
      mockPrisma.officialLetter.findUnique.mockResolvedValue({
        id: 'letter-1',
        status: LetterStatus.PUBLISHED,
        letter_number: '042/SK-DPW/APII-JABO/III/2025',
        title: 'SK Pengangkatan',
        letter_type: LetterType.SK,
        sha256_hash: VALID_SHA256,
        published_at: new Date('2025-03-01T00:00:00Z'),
      });

      const result = await service.verifyDocument(VALID_SHA256);

      expect(result.verified).toBe(true);
      expect(result.letter_number).toBe('042/SK-DPW/APII-JABO/III/2025');
      expect(result.title).toBe('SK Pengangkatan');
      expect(result.sha256).toBe(VALID_SHA256);
    });

    it('should normalise uppercase hash before lookup', async () => {
      mockPrisma.officialLetter.findUnique.mockResolvedValue(null);

      await service.verifyDocument(VALID_SHA256.toUpperCase());

      expect(mockPrisma.officialLetter.findUnique).toHaveBeenCalledWith({
        where: { sha256_hash: VALID_SHA256 },
      });
    });

    it('should return unverified when document is not found', async () => {
      mockPrisma.officialLetter.findUnique.mockResolvedValue(null);

      const result = await service.verifyDocument(VALID_SHA256);

      expect(result.verified).toBe(false);
      expect(result.letter_number).toBeNull();
    });

    it('should return unverified when document is not yet published', async () => {
      mockPrisma.officialLetter.findUnique.mockResolvedValue({
        id: 'letter-1',
        status: LetterStatus.DRAFT,
        sha256_hash: VALID_SHA256,
      });

      const result = await service.verifyDocument(VALID_SHA256);

      expect(result.verified).toBe(false);
    });

    it('should reject a malformed hash', async () => {
      await expect(service.verifyDocument('not-a-hash')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.officialLetter.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('findPublicFeed', () => {
    it('should list only PUBLISHED letters, newest first, paginated', async () => {
      mockPrisma.officialLetter.findMany.mockResolvedValue([
        {
          id: 'letter-1',
          letter_number: '042/SK-DPW/APII-JABO/III/2025',
          title: 'SK Pengangkatan',
          letter_type: LetterType.SK,
          published_at: new Date('2025-03-01T00:00:00Z'),
        },
      ]);
      mockPrisma.officialLetter.count.mockResolvedValue(11);

      const result = await service.findPublicFeed({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(11);
      expect(result.totalPages).toBe(2);
      expect(mockPrisma.officialLetter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: LetterStatus.PUBLISHED },
          orderBy: { published_at: 'desc' },
          skip: 0,
          take: 10,
        }),
      );
    });
  });

  describe('findPublicSchedules', () => {
    it('should list published programs with an execution date', async () => {
      mockPrisma.divisionSubmission.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          tracking_id: '#REQ-2025-089',
          program_title: 'Safari Dakwah',
          division: Division.DIV_DAKWAH,
          execution_date: new Date('2025-04-01T00:00:00Z'),
          target_audience: 'Umum',
        },
      ]);
      mockPrisma.divisionSubmission.count.mockResolvedValue(1);

      const result = await service.findPublicSchedules({ page: 1, limit: 10 });

      expect(result.items[0].tracking_id).toBe('#REQ-2025-089');
      expect(result.total).toBe(1);
      expect(mockPrisma.divisionSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: SubmissionStatus.PUBLISHED, execution_date: { not: null } },
          orderBy: { execution_date: 'asc' },
        }),
      );
    });

    it('should filter schedules by division when provided', async () => {
      mockPrisma.divisionSubmission.findMany.mockResolvedValue([]);
      mockPrisma.divisionSubmission.count.mockResolvedValue(0);

      await service.findPublicSchedules({ page: 1, limit: 10, division: Division.DIV_HUMAS });

      expect(mockPrisma.divisionSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: SubmissionStatus.PUBLISHED,
            execution_date: { not: null },
            division: Division.DIV_HUMAS,
          },
        }),
      );
    });
  });

  describe('getMyMemberCard', () => {
    it('should build a 5-year e-KTA from issue date', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'member-1',
        full_name: 'Anggota Contoh',
        email: 'anggota@siap-apii.local',
        profile_picture_url: 'https://cdn/foto.jpg',
        member_number: 'APII-JABO-0001',
        member_since: new Date('2025-01-01T00:00:00Z'),
        card_issued_at: new Date('2025-01-01T00:00:00Z'),
        card_expires_at: null,
      });

      const card = await service.getMyMemberCard('member-1');

      expect(card.member_number).toBe('APII-JABO-0001');
      expect(card.status).toBe('ACTIVE');
      expect(card.expires_at?.toISOString()).toBe('2030-01-01T00:00:00.000Z');
      expect(card.qr_verify_url).toBe('https://app.apii.sigitadi.id/verify/member/APII-JABO-0001');
    });

    it('should mark an expired card as EXPIRED', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'member-1',
        full_name: 'Anggota Lama',
        email: 'lama@siap-apii.local',
        profile_picture_url: null,
        member_number: 'APII-JABO-0001',
        member_since: new Date('2015-01-01T00:00:00Z'),
        card_issued_at: new Date('2015-01-01T00:00:00Z'),
        card_expires_at: null,
      });

      const card = await service.getMyMemberCard('member-1');

      expect(card.status).toBe('EXPIRED');
    });

    it('should omit QR url when member number is missing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'member-1',
        full_name: 'Anggota Baru',
        email: 'baru@siap-apii.local',
        profile_picture_url: null,
        member_number: null,
        member_since: null,
        card_issued_at: null,
        card_expires_at: null,
      });

      const card = await service.getMyMemberCard('member-1');

      expect(card.member_number).toBeNull();
      expect(card.qr_verify_url).toBeNull();
      expect(card.expires_at).toBeNull();
      expect(card.status).toBe('ACTIVE');
    });

    it('should throw NotFoundException when the member does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMyMemberCard('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
