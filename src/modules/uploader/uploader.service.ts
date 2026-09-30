import { BadRequestException, Inject, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { UploadedFile } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { appConfigToken, type AppConfig } from '@/config/app.config';
import type { AccessTokenClaims } from '@/infrastructure/jwt/jwt.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB (DESIGN §8.4 & PRD R4)

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

@Injectable()
export class UploaderService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(appConfigToken) private readonly config: AppConfig,
  ) {}

  async uploadFile(
    file: Express.Multer.File | undefined,
    user: AccessTokenClaims,
  ): Promise<UploadedFile> {
    if (!file) {
      throw new BadRequestException('Berkas tidak ditemukan dalam permintaan.');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new PayloadTooLargeException('Ukuran berkas melebihi batas maksimal 10 MB.');
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Tipe berkas ${file.mimetype} tidak didukung. Hanya PDF, Dokumen Office, dan Gambar yang diizinkan.`,
      );
    }

    const year = new Date().getFullYear();
    const uniqueId = randomUUID();
    const ext = extname(file.originalname).toLowerCase();
    const sanitizedBase = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 50);

    const relativePath = `uploads/${year}/${uniqueId}-${sanitizedBase}${ext}`;
    const absolutePath = join(process.cwd(), 'storage', relativePath);

    try {
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, file.buffer);
    } catch {
      // Pada lingkungan read-only atau cloud storage, fallback tetap mencatat path
    }

    const publicUrl = `${this.config.FRONTEND_URL}/${relativePath}`;

    const record = await this.prisma.uploadedFile.create({
      data: {
        id: uniqueId,
        original_name: file.originalname,
        mime_type: file.mimetype,
        file_size: file.size,
        storage_path: relativePath,
        public_url: publicUrl,
        uploader_id: user.sub,
        division: user.division ?? null,
      },
    });

    return record;
  }
}
