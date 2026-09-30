import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Division, SubmissionStatus } from '@prisma/client';

export const createSubmissionSchema = z.object({
  program_title: z
    .string()
    .min(3, 'Judul program minimal 3 karakter')
    .max(255)
    .describe('Judul atau usulan nama program kerja'),
  budget_estimate: z.coerce
    .number()
    .min(0, 'Estimasi anggaran tidak boleh negatif')
    .describe('Estimasi rencana kebutuhan anggaran (RAB) dalam Rupiah'),
  target_audience: z.string().optional().describe('Sasaran peserta / penerima manfaat program'),
  execution_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal wajib YYYY-MM-DD')
    .optional()
    .describe('Rencana tanggal pelaksanaan program (YYYY-MM-DD)'),
  submission_data: z
    .record(z.string(), z.unknown())
    .default({})
    .describe('Data spesifik dan formulir isian program divisi'),
  attachments: z
    .array(z.string().url('URL lampiran tidak valid'))
    .default([])
    .describe('Daftar URL berkas pendukung di penyimpanan'),
});
export class CreateSubmissionDto extends createZodDto(createSubmissionSchema) {}

export const updateSubmissionSchema = createSubmissionSchema.partial();
export class UpdateSubmissionDto extends createZodDto(updateSubmissionSchema) {}

export const reviewSubmissionSchema = z.object({
  approval_notes: z
    .string()
    .max(1000)
    .optional()
    .describe('Catatan persetujuan atau arahan dari Ketua Umum'),
});
export class ReviewSubmissionDto extends createZodDto(reviewSubmissionSchema) {}

export const rejectSubmissionSchema = z.object({
  approval_notes: z
    .string()
    .min(3, 'Alasan penolakan / revisi minimal 3 karakter')
    .max(1000)
    .describe('Catatan revisi / alasan penolakan dari Ketua Umum'),
});
export class RejectSubmissionDto extends createZodDto(rejectSubmissionSchema) {}

export const submissionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('Halaman data'),
  limit: z.coerce.number().int().min(1).max(100).default(20).describe('Jumlah data per halaman'),
  division: z.nativeEnum(Division).optional().describe('Filter divisi pengusul'),
  status: z.nativeEnum(SubmissionStatus).optional().describe('Filter status usulan'),
  search: z.string().optional().describe('Pencarian judul program atau tracking ID'),
  year: z.coerce.number().int().optional().describe('Filter tahun pengajuan'),
});
export class SubmissionQueryDto extends createZodDto(submissionQuerySchema) {}
