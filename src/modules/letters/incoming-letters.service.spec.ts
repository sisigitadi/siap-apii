import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Division, IncomingLetterStatus } from '@prisma/client';
import { IncomingLettersService } from './incoming-letters.service';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { AuditService } from '@/infrastructure/audit/audit.service';

describe('IncomingLettersService', () => {
  let service: IncomingLettersService;

  const mockPrisma = {
    incomingLetter: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAudit = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncomingLettersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<IncomingLettersService>(IncomingLettersService);
  });

  describe('create', () => {
    it('should create an incoming letter with RECEIVED status', async () => {
      mockPrisma.incomingLetter.findUnique.mockResolvedValue(null);
      mockPrisma.incomingLetter.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'inc-1', ...data }),
      );

      const result = await service.create('user-1', {
        agenda_number: 'AG-2025-001',
        source_institution: 'DPP APII Pusat',
        letter_number: '123/DPP/APII/2025',
        subject: 'Undangan Rapat Koordinasi Nasional',
        received_date: '2025-03-10',
      });

      expect(result.status).toBe(IncomingLetterStatus.RECEIVED);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INCOMING_LETTER_CREATED' }),
      );
    });

    it('should throw ConflictException if agenda number exists', async () => {
      mockPrisma.incomingLetter.findUnique.mockResolvedValue({ id: 'exists' });

      await expect(
        service.create('user-1', {
          agenda_number: 'AG-2025-001',
          source_institution: 'DPP',
          letter_number: '123',
          subject: 'Perihal',
          received_date: '2025-03-10',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('dispose', () => {
    it('should update disposition and set status to DISPOSED', async () => {
      mockPrisma.incomingLetter.findUnique.mockResolvedValue({
        id: 'inc-1',
        agenda_number: 'AG-2025-001',
      });
      mockPrisma.incomingLetter.update.mockResolvedValue({
        id: 'inc-1',
        status: IncomingLetterStatus.DISPOSED,
        disposition_note: 'Tindak lanjuti segera',
        disposition_target_division: Division.DIV_HUMAS,
      });

      const updated = await service.dispose('inc-1', 'ketum-1', {
        disposition_note: 'Tindak lanjuti segera',
        disposition_target_division: Division.DIV_HUMAS,
      });

      expect(updated.status).toBe(IncomingLetterStatus.DISPOSED);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INCOMING_LETTER_DISPOSED' }),
      );
    });

    it('should throw NotFoundException if incoming letter does not exist', async () => {
      mockPrisma.incomingLetter.findUnique.mockResolvedValue(null);

      await expect(
        service.dispose('not-found', 'ketum-1', {
          disposition_note: 'Catatan',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
