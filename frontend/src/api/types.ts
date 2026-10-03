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

export type VoucherStatus = 'PENDING_BENDAHARA' | 'PENDING_KETUA' | 'APPROVED' | 'REJECTED';

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
export interface DocumentVerification {
  verified: boolean;
  document_type: string;
  letter_number: string;
  title: string;
  recipient: string;
  sha256_hash: string;
  published_at: string;
  status: LetterStatus;
  signatories: LetterSignatory[];
}

export interface MemberCard {
  id: string;
  member_number: string;
  fullName: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  division?: Division | null;
  role: UserRole;
  status: UserStatus;
  joined_at: string;
  expires_at: string;
  qr_verify_url: string;
}

export interface PublicSchedule {
  id: string;
  title: string;
  division: Division;
  category: SubmissionCategory;
  description: string;
  start_date: string;
  end_date: string;
  location?: string | null;
}

export interface PublicFeedItem {
  id: string;
  letter_number: string;
  title: string;
  type: LetterType;
  division?: Division | null;
  published_at: string;
  sha256_hash: string;
}
