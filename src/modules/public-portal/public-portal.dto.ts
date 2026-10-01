import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Division, LetterType } from '@prisma/client';

const pageField = z.coerce.number().int().min(1).default(1).describe('Halaman data');
const limitField = z.coerce
  .number()
  .int()
  .min(1)
  .max(50)
  .default(10)
  .describe('Jumlah data per halaman (maks 50)');

export const publicFeedQuerySchema = z.object({
  page: pageField,
  limit: limitField,
});
export class PublicFeedQueryDto extends createZodDto(publicFeedQuerySchema) {}

export const publicScheduleQuerySchema = z.object({
  page: pageField,
  limit: limitField,
  division: z.nativeEnum(Division).optional().describe('Filter divisi penyelenggara program'),
});
export class PublicScheduleQueryDto extends createZodDto(publicScheduleQuerySchema) {}

/**
 * Hasil verifikasi keaslian dokumen via SHA-256 (FR-PUBLIC-01 & US-07).
 * Field dokumen hanya diisi bila `verified` true (tidak membocorkan
 * keberadaan dokumen yang belum dirilis).
 */
export const verificationResultSchema = z.object({
  verified: z.boolean().describe('DOKUMEN ASLI (true) atau TIDAK DIVERIFIKASI (false)'),
  message: z.string().describe('Pesan hasil verifikasi untuk ditampilkan ke publik'),
  letter_number: z
    .string()
    .nullable()
    .describe('Nomor surat resmi (null bila tidak terverifikasi)'),
  title: z.string().nullable().describe('Perihal surat (null bila tidak terverifikasi)'),
  letter_type: z
    .nativeEnum(LetterType)
    .nullable()
    .describe('Jenis surat (null bila tidak terverifikasi)'),
  published_at: z.date().nullable().describe('Tanggal rilis resmi (null bila tidak terverifikasi)'),
  sha256: z.string().describe('Sidik jari SHA-256 yang diperiksa'),
});
export class VerificationResultDto extends createZodDto(verificationResultSchema) {}

export const publicFeedItemSchema = z.object({
  id: z.string().uuid(),
  letter_number: z.string().describe('Nomor surat resmi'),
  title: z.string().describe('Perihal surat'),
  letter_type: z.nativeEnum(LetterType).describe('Jenis surat'),
  published_at: z.date().describe('Tanggal rilis resmi'),
});
export class PublicFeedItemDto extends createZodDto(publicFeedItemSchema) {}

export const publicFeedListSchema = z.object({
  items: z.array(publicFeedItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  totalPages: z.number().int(),
});
export class PublicFeedListDto extends createZodDto(publicFeedListSchema) {}

export const publicScheduleItemSchema = z.object({
  id: z.string().uuid(),
  tracking_id: z.string().describe('Nomor pelaporan usulan (mis. #REQ-2025-089)'),
  program_title: z.string().describe('Nama program/kajian'),
  division: z.nativeEnum(Division).describe('Divisi penyelenggara'),
  execution_date: z.date().describe('Tanggal pelaksanaan'),
  target_audience: z.string().nullable().describe('Sasaran peserta'),
});
export class PublicScheduleItemDto extends createZodDto(publicScheduleItemSchema) {}

export const publicScheduleListSchema = z.object({
  items: z.array(publicScheduleItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  totalPages: z.number().int(),
});
export class PublicScheduleListDto extends createZodDto(publicScheduleListSchema) {}

/** Status masa berlaku e-KTA (FR-PUBLIC-02) */
export const memberCardStatusSchema = z.enum(['ACTIVE', 'EXPIRED']);

export const memberCardSchema = z.object({
  member_number: z.string().nullable().describe('Nomor anggota resmi'),
  full_name: z.string().describe('Nama lengkap anggota'),
  email: z.string().email().describe('Email anggota'),
  photo_url: z.string().nullable().describe('URL foto anggota (e-KTA)'),
  member_since: z.date().nullable().describe('Tanggal mulai menjadi anggota'),
  issued_at: z.date().nullable().describe('Tanggal terbit e-KTA'),
  expires_at: z.date().nullable().describe('Masa berlaku e-KTA (5 tahun sejak terbit)'),
  status: memberCardStatusSchema.describe('ACTIVE bila masih berlaku, EXPIRED bila lewat'),
  qr_verify_url: z.string().nullable().describe('URL verifikasi keanggotaan untuk QR e-KTA'),
});
export class MemberCardDto extends createZodDto(memberCardSchema) {}
