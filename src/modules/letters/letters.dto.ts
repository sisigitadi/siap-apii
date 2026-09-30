import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Division, IncomingLetterStatus, LetterStatus, LetterType } from '@prisma/client';

export const kopConfigSchema = z.object({
  logo_url: z.string().url().optional().describe('URL logo di header kop surat'),
  authority_text: z
    .string()
    .default('DEWAN PIMPINAN WILAYAH JABODETABEK')
    .describe('Teks otoritas utama di kop surat'),
  sub_text: z
    .string()
    .default('ASOSIASI PENGACARA PENGADAAN INDONESIA')
    .describe('Teks sub-organisasi'),
  address: z.string().optional().describe('Alamat sekretariat pada kop surat'),
  contact_info: z.string().optional().describe('Kontak sekretariat (telepon/email/website)'),
});
export class KopConfigDto extends createZodDto(kopConfigSchema) {}

export const signatorySchema = z.object({
  role_title: z.string().min(1).describe('Jabatan penandatangan (mis. Ketua Umum, Sekretaris DPW)'),
  name: z.string().min(1).describe('Nama lengkap penandatangan'),
  signature_url: z.string().url().optional().describe('URL tanda tangan digital opsional'),
  has_stamp: z.boolean().default(true).describe('Sertakan overlay stempel basah resmi'),
});
export class SignatoryDto extends createZodDto(signatorySchema) {}

export const contentPayloadSchema = z.object({
  konsiderans: z
    .record(z.string(), z.array(z.string()))
    .optional()
    .describe('Diktum konsiderans hukum (Menimbang, Mengingat, Memutuskan, Menetapkan)'),
  body_text: z.string().optional().describe('Isi utama surat'),
  closing_text: z.string().optional().describe('Kalimat penutup surat'),
});
export class ContentPayloadDto extends createZodDto(contentPayloadSchema) {}

export const createLetterSchema = z.object({
  letter_type: z.nativeEnum(LetterType).describe('Jenis surat resmi (SK, SURAT_TUGAS, dll.)'),
  title: z
    .string()
    .min(5, 'Judul surat minimal 5 karakter')
    .max(255)
    .describe('Perihal atau judul surat'),
  letter_number: z
    .string()
    .max(100)
    .optional()
    .describe('Nomor surat manual (opsional; jika kosong akan otomatis di-generate)'),
  content_payload: contentPayloadSchema.describe('Payload isi surat terstruktur'),
  kop_config: kopConfigSchema.optional().describe('Konfigurasi kop surat resmi'),
  signatories: z
    .array(signatorySchema)
    .min(1, 'Minimal satu penandatangan')
    .describe('Daftar penandatangan surat'),
});
export class CreateLetterDto extends createZodDto(createLetterSchema) {}

export const updateLetterSchema = createLetterSchema.partial();
export class UpdateLetterDto extends createZodDto(updateLetterSchema) {}

export const rejectLetterSchema = z.object({
  rejection_note: z
    .string()
    .min(3, 'Alasan penolakan minimal 3 karakter')
    .max(1000)
    .describe('Alasan atau catatan penolakan dari pimpinan'),
});
export class RejectLetterDto extends createZodDto(rejectLetterSchema) {}

export const letterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('Halaman data'),
  limit: z.coerce.number().int().min(1).max(100).default(10).describe('Jumlah data per halaman'),
  search: z.string().optional().describe('Pencarian judul atau nomor surat'),
  letter_type: z.nativeEnum(LetterType).optional().describe('Filter jenis surat'),
  status: z.nativeEnum(LetterStatus).optional().describe('Filter status surat'),
  year: z.coerce.number().int().optional().describe('Filter tahun penerbitan'),
});
export class LetterQueryDto extends createZodDto(letterQuerySchema) {}

export const letterDetailSchema = z.object({
  id: z.string().uuid(),
  letter_number: z.string(),
  title: z.string(),
  letter_type: z.nativeEnum(LetterType),
  content_payload: contentPayloadSchema,
  kop_config: kopConfigSchema,
  signatories: z.array(signatorySchema),
  sha256_hash: z.string(),
  qr_verify_url: z.string(),
  status: z.nativeEnum(LetterStatus),
  rejection_note: z.string().nullable(),
  pdf_storage_url: z.string().nullable(),
  created_by_id: z.string(),
  approved_by_id: z.string().nullable(),
  published_at: z.date().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
  integrity_verified: z.boolean().optional().describe('Kesesuaian hash SHA-256 dokumen'),
});
export class LetterDetailDto extends createZodDto(letterDetailSchema) {}

export const createIncomingLetterSchema = z.object({
  agenda_number: z.string().min(2).max(50).describe('Nomor agenda surat masuk'),
  source_institution: z.string().min(2).max(255).describe('Instansi / pihak pengirim'),
  letter_number: z.string().min(2).max(100).describe('Nomor surat asal dari pengirim'),
  subject: z.string().min(2).max(255).describe('Perihal / isi ringkas surat'),
  received_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal wajib YYYY-MM-DD')
    .describe('Tanggal diterima (YYYY-MM-DD)'),
  file_url: z.string().url().optional().describe('URL berkas scan surat masuk'),
});
export class CreateIncomingLetterDto extends createZodDto(createIncomingLetterSchema) {}

export const disposeIncomingLetterSchema = z.object({
  disposition_note: z
    .string()
    .min(3, 'Catatan disposisi minimal 3 karakter')
    .max(1000)
    .describe('Instruksi atau catatan disposisi dari pimpinan'),
  disposition_target_division: z
    .nativeEnum(Division)
    .optional()
    .describe('Divisi yang ditugaskan menjalankan disposisi'),
});
export class DisposeIncomingLetterDto extends createZodDto(disposeIncomingLetterSchema) {}

export const incomingLetterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('Halaman data'),
  limit: z.coerce.number().int().min(1).max(100).default(10).describe('Jumlah data per halaman'),
  search: z.string().optional().describe('Pencarian pada perihal, instansi, atau nomor surat'),
  status: z.nativeEnum(IncomingLetterStatus).optional().describe('Filter status disposisi'),
});
export class IncomingLetterQueryDto extends createZodDto(incomingLetterQuerySchema) {}
