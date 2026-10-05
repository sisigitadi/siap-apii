// Enums & Roles
//
// SUPERADMIN adalah peran infrastruktur teknis (bukan jabatan organisasi).
// 8 jabatan organisasi: Ketua, Sekretaris, Bendahara, Pembina, Pengawas,
// Ketua Divisi, Anggota Divisi, Anggota Biasa.
export type UserRole =
  | 'SUPERADMIN'
  | 'KETUA'
  | 'SEKRETARIS'
  | 'BENDAHARA'
  | 'PEMBINA'
  | 'PENGAWAS'
  | 'KETUA_DIVISI'
  | 'ANGGOTA_DIVISI'
  | 'ANGGOTA_BIASA';

export type Division =
  | 'DIV_HUMAS'
  | 'DIV_SOSMED'
  | 'DIV_DAKWAH'
  | 'DIV_LITBANG'
  | 'DIV_INVESTASI'
  | 'DIV_HUKUM'
  | 'DIV_UMUM';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  division: Division | null;
  status: UserStatus;
  canManageUsers: boolean;
  memberNumber?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  address?: string | null;
  city?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    timestamp?: string;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Letters
export type LetterType =
  | 'SURAT_KEPUTUSAN'
  | 'SURAT_TUGAS'
  | 'SURAT_KETERANGAN'
  | 'SURAT_UNDANGAN'
  | 'SURAT_PERMOHONAN'
  | 'SURAT_PEMBERITAHUAN'
  | 'SURAT_REKOMENDASI'
  | 'BERITA_ACARA'
  | 'MEMORANDUM'
  | 'LAINNYA';

export type LetterStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';

export interface LetterSignatory {
  role: 'KETUA' | 'SEKRETARIS' | 'BENDAHARA';
  name: string;
  title: string;
  position: 'left' | 'right' | 'center';
  signatureUrl?: string | null;
}

export interface OfficialLetter {
  id: string;
  letter_number: string;
  type: LetterType;
  title: string;
  subject: string;
  regarding?: string | null;
  recipient: string;
  body_html: string;
  division: Division | null;
  signatories: LetterSignatory[];
  sha256_hash: string;
  qr_verify_url: string;
  pdf_storage_url?: string | null;
  status: LetterStatus;
  rejection_reason?: string | null;
  published_at?: string | null;
  created_by: string;
  approved_by?: string | null;
  createdAt: string;
  updatedAt: string;
  creator?: {
    fullName: string;
    email: string;
  };
  approver?: {
    fullName: string;
    email: string;
  };
}

// Finance
export type CashFlowType = 'INCOME' | 'EXPENSE';

export type CashCategory =
  | 'INFAQ_SEDEKAH'
  | 'WAKAF'
  | 'SPONSORSHIP'
  | 'IURAN_ANGGOTA'
  | 'OPERASIONAL'
  | 'PROGRAM_KERJA'
  | 'BANTUAN_SOSIAL'
  | 'HONORARIUM'
  | 'PENGADAAN_ASET'
  | 'LAIN_LAIN';

export type CashAccount = 'BSI_OPERASIONAL' | 'BCA_PROGRAM' | 'KAS_TUNAI_SEKRETARIAT';

/**
 * Status voucher sesuai enum backend CashFlowStatus (schema.prisma). Nama enum
 * ini BUKAN alias frontend lama (PENDING_KETUA dsb.) — memakai nama backend
 * agar filter & badge langsung cocok dengan API.
 */
export type VoucherStatus = 'PENDING' | 'VERIFIED_BENDAHARA' | 'VERIFIED_KETUM' | 'REJECTED';

/**
 * Jenis surat resmi sesuai enum backend LetterType (schema.prisma), dipakai pada
 * response API publik (feed & verifikasi). Berbeda dari `LetterType` lama.
 */
export type BackendLetterType =
  | 'SK'
  | 'SURAT_TUGAS'
  | 'REKOMENDASI'
  | 'MAKLUMAT'
  | 'UNDANGAN'
  | 'PENGANTAR'
  | 'EDARAN';

export interface CashFlow {
  id: string;
  voucher_number: string;
  type: CashFlowType;
  category: CashCategory;
  account: CashAccount;
  amount: number;
  description: string;
  division: Division | null;
  attachment_url?: string | null;
  verified_by_bendahara: boolean;
  bendahara_verified_at?: string | null;
  verified_by_ketum: boolean;
  ketum_verified_at?: string | null;
  status: VoucherStatus;
  rejection_reason?: string | null;
  submitted_by: string;
  transaction_date: string;
  createdAt: string;
  updatedAt: string;
  submitter?: {
    fullName: string;
    email: string;
  };
}

export interface CashBalances {
  bsi_operasional: number;
  bca_program: number;
  kas_tunai: number;
  total: number;
}

export interface MonthlyReport {
  month: number;
  year: number;
  opening_balance: number;
  total_income: number;
  total_expense: number;
  closing_balance: number;
  by_category: Record<string, number>;
  by_account: Record<string, { income: number; expense: number; net: number }>;
}

// Divisions
export type SubmissionStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';

export type SubmissionCategory =
  | 'KAJIAN_RUTIN'
  | 'BAKTI_SOSIAL'
  | 'PELATIHAN_VOKASI'
  | 'KONTEN_DAKWAH'
  | 'RISET_SURVEI'
  | 'ADVOKASI_HUKUM'
  | 'OPERASIONAL_DIVISI'
  | 'LAINNYA';

export interface DivisionSubmission {
  id: string;
  division: Division;
  title: string;
  category: SubmissionCategory;
  description: string;
  proposed_budget: number;
  approved_budget?: number | null;
  start_date: string;
  end_date: string;
  location?: string | null;
  status: SubmissionStatus;
  rejection_note?: string | null;
  submitted_by: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  attachments?: string[];
  published_at?: string | null;
  createdAt: string;
  updatedAt: string;
  submitter?: {
    fullName: string;
    email: string;
  };
  reviewer?: {
    fullName: string;
    email: string;
  };
}

export interface SubmissionAggregate {
  total: number;
  by_status: {
    DRAFT: number;
    PENDING_APPROVAL: number;
    APPROVED: number;
    REJECTED: number;
    PUBLISHED: number;
  };
  by_division: Record<Division, number>;
  total_proposed_budget: number;
  total_approved_budget: number;
}

// Public Portal
/**
 * Hasil verifikasi dokumen sesuai kontrak backend (public-portal.dto.ts).
 * Field `sha256` dan `signatories` mengikuti response server; jangan dipakai
 * dengan alias lama (sha256_hash/signatories lama).
 */
export interface DocumentVerification {
  verified: boolean;
  message?: string;
  letter_number: string | null;
  title: string | null;
  letter_type: BackendLetterType | null;
  published_at: string | null;
  sha256: string;
  signatories: { name: string; role_title: string }[] | null;
}

export interface MemberCard {
  member_number: string | null;
  full_name: string;
  email: string;
  photo_url: string | null;
  member_since: string | null;
  issued_at: string | null;
  expires_at: string | null;
  status: 'ACTIVE' | 'EXPIRED';
  qr_verify_url: string | null;
}

export interface PublicSchedule {
  id: string;
  tracking_id: string;
  program_title: string;
  division: Division;
  execution_date: string;
  target_audience: string | null;
  category: string | null;
  description: string | null;
  location: string | null;
}

export interface PublicFeedItem {
  id: string;
  letter_number: string;
  title: string;
  letter_type: BackendLetterType;
  published_at: string;
  sha256_hash: string;
}
