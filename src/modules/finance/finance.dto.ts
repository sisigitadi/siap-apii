import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { AccountCategory, CashFlowStatus, CashFlowType } from '@prisma/client';

export const createCashFlowSchema = z.object({
  transaction_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal wajib YYYY-MM-DD')
    .describe('Tanggal transaksi'),
  type: z
    .nativeEnum(CashFlowType)
    .describe('Tipe transaksi (INFLOW = Penerimaan, OUTFLOW = Pengeluaran)'),
  account_category: z.nativeEnum(AccountCategory).describe('Kategori akun rekening resmi yayasan'),
  amount: z.coerce
    .number()
    .positive('Nominal transaksi harus lebih besar dari 0')
    .describe('Nominal transaksi dalam Rupiah'),
  description: z
    .string()
    .min(3, 'Uraian transaksi minimal 3 karakter')
    .max(500)
    .describe('Uraian atau peruntukan transaksi kas'),
  receipt_attachment_url: z
    .string()
    .url()
    .optional()
    .describe('URL berkas bukti transfer atau kwitansi di storage'),
});
export class CreateCashFlowDto extends createZodDto(createCashFlowSchema) {}

export const rejectVoucherSchema = z.object({
  rejection_note: z
    .string()
    .min(3, 'Alasan penolakan minimal 3 karakter')
    .max(1000)
    .describe('Alasan penolakan voucher keuangan'),
});
export class RejectVoucherDto extends createZodDto(rejectVoucherSchema) {}

export const cashFlowQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('Halaman data'),
  limit: z.coerce.number().int().min(1).max(100).default(20).describe('Jumlah data per halaman'),
  type: z.nativeEnum(CashFlowType).optional().describe('Filter tipe transaksi'),
  account_category: z.nativeEnum(AccountCategory).optional().describe('Filter rekening kas'),
  status: z.nativeEnum(CashFlowStatus).optional().describe('Filter status verifikasi'),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filter tanggal mulai (YYYY-MM-DD)'),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filter tanggal selesai (YYYY-MM-DD)'),
});
export class CashFlowQueryDto extends createZodDto(cashFlowQuerySchema) {}

export const monthlyReportQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).describe('Tahun laporan'),
  month: z.coerce.number().int().min(1).max(12).describe('Bulan laporan (1-12)'),
});
export class MonthlyReportQueryDto extends createZodDto(monthlyReportQuerySchema) {}
