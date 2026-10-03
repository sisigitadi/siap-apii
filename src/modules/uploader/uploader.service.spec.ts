import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { Division, UserRole } from '@prisma/client';
import { UploaderService } from './uploader.service';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { appConfigToken } from '@/config/app.config';
import type { AccessTokenClaims } from '@/infrastructure/jwt/jwt.service';

describe('UploaderService', () => {
  let service: UploaderService;

  const mockPrisma = {
    uploadedFile: {
      create: jest.fn(),
    },
  };

  const mockConfig = {
    FRONTEND_URL: 'https://app.apii.sigitadi.id',
  };

  const mockUser: AccessTokenClaims = {
    sub: 'user-1',
    email: 'user@apii.local',
    role: UserRole.KETUA_DIVISI,
    division: Division.DIV_HUMAS,
    jti: 'jti-1',
    iat: 1234567,
    exp: 2345678,
    typ: 'access',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploaderService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: appConfigToken, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<UploaderService>(UploaderService);
  });

  it('should throw BadRequestException if file is undefined', async () => {
    await expect(service.uploadFile(undefined, mockUser)).rejects.toThrow(BadRequestException);
  });

  it('should throw PayloadTooLargeException if file exceeds 10MB', async () => {
    const oversizedFile = {
      originalname: 'big_video.mp4',
      mimetype: 'video/mp4',
      size: 15 * 1024 * 1024,
      buffer: Buffer.from('abc'),
    } as Express.Multer.File;

    await expect(service.uploadFile(oversizedFile, mockUser)).rejects.toThrow(
      PayloadTooLargeException,
    );
  });

  it('should throw BadRequestException if MIME type is not allowed', async () => {
    const invalidTypeFile = {
      originalname: 'script.sh',
      mimetype: 'application/x-sh',
      size: 1024,
      buffer: Buffer.from('echo hello'),
    } as Express.Multer.File;

    await expect(service.uploadFile(invalidTypeFile, mockUser)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should save valid PDF and return file record', async () => {
    const validFile = {
      originalname: 'proposal_kegiatan.pdf',
      mimetype: 'application/pdf',
      size: 1024 * 500, // 500 KB
      buffer: Buffer.from('fake-pdf-content'),
    } as Express.Multer.File;

    mockPrisma.uploadedFile.create.mockImplementation(({ data }) =>
      Promise.resolve({ ...data, created_at: new Date() }),
    );

    const result = await service.uploadFile(validFile, mockUser);

    expect(result.original_name).toBe('proposal_kegiatan.pdf');
    expect(result.mime_type).toBe('application/pdf');
    expect(result.uploader_id).toBe('user-1');
    expect(result.division).toBe(Division.DIV_HUMAS);
    expect(result.public_url).toContain('https://app.apii.sigitadi.id/uploads/');
  });
});
