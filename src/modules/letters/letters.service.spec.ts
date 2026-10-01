import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LetterStatus, LetterType } from '@prisma/client';
import { LettersService } from './letters.service';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { AuditService } from '@/infrastructure/audit/audit.service';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { appConfigToken } from '@/config/app.config';

describe('LettersService', () => {
  let service: LettersService;

  const mockPrisma = {
    letterSequence: { upsert: jest.fn() },
    officialLetter: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
  const mockRedis = { xAdd: jest.fn().mockResolvedValue(undefined) };
  const mockConfig = {
    PUBLIC_VERIFY_BASE_URL: 'https://app.apii.sigitadi.id/verify',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LettersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: RedisService, useValue: mockRedis },
        { provide: appConfigToken, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<LettersService>(LettersService);
  });

  describe('generateLetterNumber', () => {
    it('should format letter number with 3-digit sequence, Roman month, and year', async () => {
      mockPrisma.letterSequence.upsert.mockResolvedValue({ current_number: 42 });

      const date = new Date(2025, 2, 15); // March 2025 -> III
      const number = await service.generateLetterNumber(LetterType.SK, date);

      expect(number).toBe('042/SK-DPW/APII-JABO/III/2025');
    });
  });

  describe('computeCanonicalHash', () => {
    it('should generate stable SHA-256 regardless of object key order', () => {
      const payloadA = {
        letter_number: '001/SK/III/2025',
        title: 'SK Panitia',
        letter_type: 'SK',
        content_payload: { body: 'test' },
        kop_config: { text: 'APII' },
        signatories: [{ name: 'Ketum' }],
      };

      const payloadB = {
        signatories: [{ name: 'Ketum' }],
        kop_config: { text: 'APII' },
        title: 'SK Panitia',
        content_payload: { body: 'test' },
        letter_type: 'SK',
        letter_number: '001/SK/III/2025',
      };

      expect(service.computeCanonicalHash(payloadA)).toBe(service.computeCanonicalHash(payloadB));
    });
  });

  describe('createLetter', () => {
    it('should create draft letter with auto-generated number and hash', async () => {
      mockPrisma.letterSequence.upsert.mockResolvedValue({ current_number: 1 });
      mockPrisma.officialLetter.findUnique.mockResolvedValue(null);
      mockPrisma.officialLetter.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'uuid-1', ...data }),
      );

      const result = await service.createLetter('user-1', {
        letter_type: LetterType.SK,
        title: 'Surat Keputusan Pengesahan',
        content_payload: { body_text: 'Isi SK' },
        signatories: [{ role_title: 'Ketua Umum', name: 'Sigit Adi', has_stamp: true }],
      });

      expect(result.status).toBe(LetterStatus.DRAFT);
      expect(result.qr_verify_url).toContain('https://app.apii.sigitadi.id/verify/');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LETTER_CREATED' }),
      );
    });

    it('should throw ConflictException if custom letter number is already taken', async () => {
      mockPrisma.officialLetter.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createLetter('user-1', {
          letter_number: '001/SK-DPW/APII-JABO/I/2025',
          letter_type: LetterType.SK,
          title: 'Surat Keputusan Duplikat',
          content_payload: {},
          signatories: [{ role_title: 'Ketua Umum', name: 'Ketum', has_stamp: true }],
        }),
      ).rejects.toThrow(ConflictException);
    });
    describe('updateLetter', () => {
      it('should allow editing draft letters', async () => {
        mockPrisma.officialLetter.findUnique.mockResolvedValue({
          id: 'letter-1',
          status: LetterStatus.DRAFT,
          letter_number: '001/SK-DPW/APII-JABO/I/2025',
          title: 'Judul Lama',
          letter_type: LetterType.SK,
          content_payload: {},
          kop_config: {},
          signatories: [],
        });

        mockPrisma.officialLetter.update.mockResolvedValue({
          id: 'letter-1',
          title: 'Judul Baru',
          letter_number: '001/SK-DPW/APII-JABO/I/2025',
        });

        const updated = await service.updateLetter('letter-1', 'user-1', {
          title: 'Judul Baru',
        });

        expect(updated.title).toBe('Judul Baru');
        expect(mockAudit.log).toHaveBeenCalledWith(
          expect.objectContaining({ action: 'LETTER_UPDATED' }),
        );
      });

      it('should reject editing letters that are in PENDING_APPROVAL status', async () => {
        mockPrisma.officialLetter.findUnique.mockResolvedValue({
          id: 'letter-1',
          status: LetterStatus.PENDING_APPROVAL,
        });

        await expect(
          service.updateLetter('letter-1', 'user-1', { title: 'Judul Baru' }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw NotFoundException when letter does not exist', async () => {
        mockPrisma.officialLetter.findUnique.mockResolvedValue(null);

        await expect(
          service.updateLetter('missing', 'user-1', { title: 'Judul Baru' }),
        ).rejects.toThrow(NotFoundException);
      });

      it('should recompute hash and QR url when letter number changes', async () => {
        const letter = {
          id: 'letter-1',
          status: LetterStatus.DRAFT,
          letter_number: '001/SK-DPW/APII-JABO/I/2025',
          title: 'Judul Lama',
          letter_type: LetterType.SK,
          content_payload: { body_text: 'Isi' },
          kop_config: { authority_text: 'DPW JABODETABEK' },
          signatories: [{ role_title: 'Ketua Umum', name: 'Ketum', has_stamp: true }],
        };
        mockPrisma.officialLetter.findUnique.mockImplementation(({ where }) => {
          // Pemanggilan pertama mengambil surat berdasarkan ID; pemanggilan kedua
          // memeriksa ketersediaan nomor surat baru (wajib belum digunakan).
          if (where.letter_number) return Promise.resolve(null);
          return Promise.resolve(letter);
        });
        mockPrisma.officialLetter.update.mockImplementation(({ data }) =>
          Promise.resolve({ ...letter, ...data }),
        );

        const updated = await service.updateLetter('letter-1', 'user-1', {
          letter_number: '099/SK-DPW/APII-JABO/I/2025',
        });
        const expectedHash = service.computeCanonicalHash({
          letter_number: '099/SK-DPW/APII-JABO/I/2025',
          title: letter.title,
          letter_type: LetterType.SK,
          content_payload: letter.content_payload,
          kop_config: letter.kop_config,
          signatories: letter.signatories,
        });

        expect(updated.sha256_hash).toBe(expectedHash);
        expect(updated.qr_verify_url).toBe(`https://app.apii.sigitadi.id/verify/${expectedHash}`);
      });

      it('should throw ConflictException when new letter number is already taken', async () => {
        mockPrisma.officialLetter.findUnique
          .mockResolvedValueOnce({
            id: 'letter-1',
            status: LetterStatus.DRAFT,
            letter_number: '001/SK-DPW/APII-JABO/I/2025',
            title: 'Judul',
            letter_type: LetterType.SK,
            content_payload: {},
            kop_config: {},
            signatories: [],
          })
          .mockResolvedValueOnce({ id: 'letter-2' });

        await expect(
          service.updateLetter('letter-1', 'user-1', {
            letter_number: '002/SK-DPW/APII-JABO/I/2025',
          }),
        ).rejects.toThrow(ConflictException);
      });
    });

    describe('submitLetter', () => {
      it('should transition letter from DRAFT to PENDING_APPROVAL', async () => {
        mockPrisma.officialLetter.findUnique.mockResolvedValue({
          id: 'letter-1',
          status: LetterStatus.DRAFT,
          letter_number: '001/SK-DPW/APII-JABO/I/2025',
        });
        mockPrisma.officialLetter.update.mockResolvedValue({
          id: 'letter-1',
          status: LetterStatus.PENDING_APPROVAL,
        });

        const submitted = await service.submitLetter('letter-1', 'user-1');

        expect(submitted.status).toBe(LetterStatus.PENDING_APPROVAL);
        expect(mockAudit.log).toHaveBeenCalledWith(
          expect.objectContaining({ action: 'LETTER_SUBMITTED' }),
        );
      });

      it('should throw NotFoundException when letter does not exist', async () => {
        mockPrisma.officialLetter.findUnique.mockResolvedValue(null);

        await expect(service.submitLetter('missing', 'user-1')).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException when letter is not in DRAFT or REJECTED status', async () => {
        mockPrisma.officialLetter.findUnique.mockResolvedValue({
          id: 'letter-1',
          status: LetterStatus.PUBLISHED,
          letter_number: '001/SK-DPW/APII-JABO/I/2025',
        });

        await expect(service.submitLetter('letter-1', 'user-1')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('approveAndPublishLetter', () => {
      it('should publish letter when integrity hash matches', async () => {
        const payload = {
          letter_number: '001/SK-DPW/APII-JABO/I/2025',
          title: 'Judul SK Sah',
          letter_type: LetterType.SK,
          content_payload: { body: 'text' },
          kop_config: { text: 'kop' },
          signatories: [{ name: 'Ketum' }],
        };
        const validHash = service.computeCanonicalHash(payload);

        mockPrisma.officialLetter.findUnique.mockResolvedValue({
          id: 'letter-1',
          status: LetterStatus.PENDING_APPROVAL,
          ...payload,
          sha256_hash: validHash,
        });

        mockPrisma.officialLetter.update.mockResolvedValue({
          id: 'letter-1',
          status: LetterStatus.PUBLISHED,
          letter_number: payload.letter_number,
          title: payload.title,
          sha256_hash: validHash,
          published_at: new Date(),
        });

        const published = await service.approveAndPublishLetter('letter-1', 'ketum-1');

        expect(published.status).toBe(LetterStatus.PUBLISHED);
        expect(mockAudit.log).toHaveBeenCalledWith(
          expect.objectContaining({ action: 'LETTER_PUBLISHED' }),
        );
      });

      it('should throw ConflictException if letter content was tampered with', async () => {
        const payload = {
          letter_number: '001/SK-DPW/APII-JABO/I/2025',
          title: 'Judul SK Sah',
          letter_type: LetterType.SK,
          content_payload: { body: 'text' },
          kop_config: { text: 'kop' },
          signatories: [{ name: 'Ketum' }],
        };

        mockPrisma.officialLetter.findUnique.mockResolvedValue({
          id: 'letter-1',
          status: LetterStatus.PENDING_APPROVAL,
          ...payload,
          sha256_hash: 'tampered-hash-value',
        });

        await expect(service.approveAndPublishLetter('letter-1', 'ketum-1')).rejects.toThrow(
          ConflictException,
        );
      });

      it('should throw NotFoundException when letter does not exist', async () => {
        mockPrisma.officialLetter.findUnique.mockResolvedValue(null);

        await expect(service.approveAndPublishLetter('missing', 'ketum-1')).rejects.toThrow(
          NotFoundException,
        );
      });

      it('should throw BadRequestException when letter is not PENDING_APPROVAL', async () => {
        mockPrisma.officialLetter.findUnique.mockResolvedValue({
          id: 'letter-1',
          status: LetterStatus.DRAFT,
        });

        await expect(service.approveAndPublishLetter('letter-1', 'ketum-1')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('rejectLetter', () => {
      it('should set status to REJECTED and record rejection note', async () => {
        mockPrisma.officialLetter.findUnique.mockResolvedValue({
          id: 'letter-1',
          status: LetterStatus.PENDING_APPROVAL,
          letter_number: '001/SK-DPW/APII-JABO/I/2025',
        });
        mockPrisma.officialLetter.update.mockResolvedValue({
          id: 'letter-1',
          status: LetterStatus.REJECTED,
          rejection_note: 'Perbaiki pertimbangan menimbang poin 2',
        });

        const rejected = await service.rejectLetter('letter-1', 'ketum-1', {
          rejection_note: 'Perbaiki pertimbangan menimbang poin 2',
        });

        expect(rejected.status).toBe(LetterStatus.REJECTED);
        expect(mockAudit.log).toHaveBeenCalledWith(
          expect.objectContaining({ action: 'LETTER_REJECTED' }),
        );
      });

      it('should throw NotFoundException when letter does not exist', async () => {
        mockPrisma.officialLetter.findUnique.mockResolvedValue(null);

        await expect(
          service.rejectLetter('missing', 'ketum-1', { rejection_note: 'Alasan' }),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException when letter is not PENDING_APPROVAL', async () => {
        mockPrisma.officialLetter.findUnique.mockResolvedValue({
          id: 'letter-1',
          status: LetterStatus.PUBLISHED,
          letter_number: '001/SK-DPW/APII-JABO/I/2025',
        });

        await expect(
          service.rejectLetter('letter-1', 'ketum-1', { rejection_note: 'Alasan' }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('archiveLetter', () => {
      it('should transition PUBLISHED to ARCHIVED', async () => {
        mockPrisma.officialLetter.findUnique.mockResolvedValue({
          id: 'letter-1',
          status: LetterStatus.PUBLISHED,
          letter_number: '001/SK-DPW/APII-JABO/I/2025',
        });
        mockPrisma.officialLetter.update.mockResolvedValue({
          id: 'letter-1',
          status: LetterStatus.ARCHIVED,
        });

        const archived = await service.archiveLetter('letter-1', 'ketum-1');

        expect(archived.status).toBe(LetterStatus.ARCHIVED);
        expect(mockAudit.log).toHaveBeenCalledWith(
          expect.objectContaining({ action: 'LETTER_ARCHIVED' }),
        );
      });

      it('should throw BadRequestException when letter is not PUBLISHED', async () => {
        mockPrisma.officialLetter.findUnique.mockResolvedValue({
          id: 'letter-1',
          status: LetterStatus.DRAFT,
          letter_number: '001/SK-DPW/APII-JABO/I/2025',
        });

        await expect(service.archiveLetter('letter-1', 'ketum-1')).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw NotFoundException when letter does not exist', async () => {
        mockPrisma.officialLetter.findUnique.mockResolvedValue(null);

        await expect(service.archiveLetter('missing', 'ketum-1')).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('findAllLetters', () => {
      it('should paginate letters and build totalPages', async () => {
        mockPrisma.officialLetter.findMany.mockResolvedValue([{ id: 'letter-1' }]);
        mockPrisma.officialLetter.count.mockResolvedValue(11);

        const result = await service.findAllLetters({ page: 1, limit: 10 });

        expect(result.total).toBe(11);
        expect(result.totalPages).toBe(2);
        expect(mockPrisma.officialLetter.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ skip: 0, take: 10 }),
        );
      });

      it('should apply letter type, status, search, and year filters', async () => {
        mockPrisma.officialLetter.findMany.mockResolvedValue([]);
        mockPrisma.officialLetter.count.mockResolvedValue(0);

        await service.findAllLetters({
          page: 1,
          limit: 10,
          letter_type: LetterType.SK,
          status: LetterStatus.PUBLISHED,
          search: 'pengesahan',
          year: 2025,
        });

        expect(mockPrisma.officialLetter.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              letter_type: LetterType.SK,
              status: LetterStatus.PUBLISHED,
              OR: [
                { title: { contains: 'pengesahan', mode: 'insensitive' } },
                { letter_number: { contains: 'pengesahan', mode: 'insensitive' } },
              ],
              created_at: { gte: expect.any(Date), lte: expect.any(Date) },
            },
          }),
        );
      });
    });

    describe('findLetterById', () => {
      it('should report integrity_verified true when stored hash matches recomputed hash', async () => {
        const payload = {
          letter_number: '001/SK-DPW/APII-JABO/I/2025',
          title: 'Judul SK',
          letter_type: LetterType.SK,
          content_payload: { body_text: 'Isi SK' },
          kop_config: { authority_text: 'DPW JABODETABEK' },
          signatories: [{ role_title: 'Ketua Umum', name: 'Ketum', has_stamp: true }],
        };
        const validHash = service.computeCanonicalHash(payload);

        mockPrisma.officialLetter.findUnique.mockResolvedValue({
          id: 'letter-1',
          status: LetterStatus.PUBLISHED,
          sha256_hash: validHash,
          ...payload,
        });

        const detail = await service.findLetterById('letter-1');

        expect(detail.integrity_verified).toBe(true);
      });

      it('should report integrity_verified false when content drifted from stored hash', async () => {
        const payload = {
          letter_number: '001/SK-DPW/APII-JABO/I/2025',
          title: 'Judul SK Diubah',
          letter_type: LetterType.SK,
          content_payload: { body_text: 'Isi yang telah diubah' },
          kop_config: { authority_text: 'DPW JABODETABEK' },
          signatories: [{ role_title: 'Ketua Umum', name: 'Ketum', has_stamp: true }],
        };

        mockPrisma.officialLetter.findUnique.mockResolvedValue({
          id: 'letter-1',
          status: LetterStatus.PUBLISHED,
          sha256_hash: 'stale-hash-tidak-sesuai',
          ...payload,
        });

        const detail = await service.findLetterById('letter-1');

        expect(detail.integrity_verified).toBe(false);
      });

      it('should throw NotFoundException when letter does not exist', async () => {
        mockPrisma.officialLetter.findUnique.mockResolvedValue(null);

        await expect(service.findLetterById('missing')).rejects.toThrow(NotFoundException);
      });
    });
  });
});
