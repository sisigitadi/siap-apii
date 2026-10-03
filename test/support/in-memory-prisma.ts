import {
  AuditAction,
  Division,
  LetterStatus,
  LetterType,
  Prisma,
  SubmissionStatus,
  UserRole,
} from '@prisma/client';

/**
 * Prisma in-memory untuk e2e (DESIGN.md §10: "e2e tests | Supertest + Prisma
 * testcontainer | pakai Postgres asli"). Versi ini memakai store in-memory
 * karena Docker/Postgres tidak tersedia di environment ini; kontrak delegate
 * (where/findMany/count/create) dibuat minimal tetapi faithful terhadap
 * pemakaian nyata di service, sehingga e2e tetap menguji Nest stack lengkap
 * (guard → pipe → service → interceptor → filter) tanpa I/O eksternal.
 */

export interface UserRecord {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  division: Division | null;
  is_active: boolean;
  can_manage_users: boolean;
  profile_picture_url: string | null;
  member_number: string | null;
  member_since: Date | null;
  card_issued_at: Date | null;
  card_expires_at: Date | null;
  invited_by_id: string | null;
  invited_at: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface OfficialLetterRecord {
  id: string;
  letter_number: string;
  title: string;
  letter_type: LetterType;
  content_payload: Prisma.JsonValue;
  kop_config: Prisma.JsonValue;
  signatories: Prisma.JsonValue;
  sha256_hash: string;
  qr_verify_url: string;
  status: LetterStatus;
  rejection_note: string | null;
  pdf_storage_url: string | null;
  created_by_id: string;
  approved_by_id: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CashFlowRecord {
  id: string;
  voucher_number: string;
  type: string;
  account_category: string;
  amount: Prisma.Decimal;
  description: string;
  transaction_date: Date;
  status: string;
  receipt_photo_url: string | null;
  verified_by_bendahara_at: Date | null;
  verified_by_ketum_at: Date | null;
  created_by_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface DivisionSubmissionRecord {
  id: string;
  tracking_id: string;
  division: Division;
  program_title: string;
  budget_estimate: Prisma.Decimal;
  target_audience: string | null;
  execution_date: Date | null;
  submission_data: Prisma.JsonValue;
  attachments: Prisma.JsonValue;
  status: SubmissionStatus;
  approval_notes: string | null;
  reviewed_by_id: string | null;
  reviewed_at: Date | null;
  submitted_by_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface AuditLogRecord {
  id: string;
  action: AuditAction;
  actor_id: string | null;
  target_id: string | null;
  resource: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Prisma.JsonValue;
  created_at: Date;
}

export interface RefreshSessionRecord {
  id: string;
  jti: string;
  user_id: string;
  user_agent: string | null;
  ip_address: string | null;
  revoked: boolean;
  expires_at: Date;
  created_at: Date;
}

/** Bentuk `where` yang dipakai service: equality sederhana + `{ not: null }`. */
type WhereFilter = Record<string, string | { not: null } | undefined>;

function matches<TRecord extends object>(record: TRecord, where: WhereFilter | undefined): boolean {
  if (!where) {
    return true;
  }
  const source = record as Record<string, unknown>;
  return Object.entries(where).every(([key, expected]) => {
    if (expected === undefined) {
      return true;
    }
    const actual = source[key];
    if (typeof expected === 'string') {
      return actual === expected;
    }
    // Satu-satunya operator yang dipakai: { not: null } (lihat public-portal).
    return actual !== null && actual !== undefined;
  });
}

function selectFields<TRecord extends object>(
  record: TRecord,
  select: Record<string, boolean> | undefined,
): Partial<TRecord> {
  if (!select) {
    return record;
  }
  const source = record as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const [key, enabled] of Object.entries(select)) {
    if (enabled) {
      picked[key] = source[key];
    }
  }
  return picked as Partial<TRecord>;
}

export class InMemoryPrisma {
  readonly users = new Map<string, UserRecord>();
  readonly officialLetters = new Map<string, OfficialLetterRecord>();
  readonly divisionSubmissions = new Map<string, DivisionSubmissionRecord>();
  readonly cashFlows = new Map<string, CashFlowRecord>();
  readonly submissionSequences = new Map<number, number>();
  readonly auditLogs: AuditLogRecord[] = [];
  readonly refreshSessions = new Map<string, RefreshSessionRecord>();

  user = {
    findUnique: async ({
      where,
    }: {
      where: { id?: string; email?: string };
    }): Promise<UserRecord | null> => {
      if (where.id) {
        return this.users.get(where.id) ?? null;
      }
      if (where.email) {
        return [...this.users.values()].find((user) => user.email === where.email) ?? null;
      }
      return null;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<UserRecord>;
    }): Promise<UserRecord> => {
      const current = this.users.get(where.id);
      if (!current) {
        throw new Error(`InMemoryPrisma: user ${where.id} tidak ditemukan`);
      }
      const updated = { ...current, ...data, updated_at: new Date() };
      this.users.set(where.id, updated);
      return updated;
    },
    findMany: async ({
      where,
      skip = 0,
      take = 10,
      orderBy,
      select,
    }: {
      where?: WhereFilter;
      skip?: number;
      take?: number;
      orderBy?: { created_at?: 'asc' | 'desc' };
      select?: Record<string, boolean>;
    }): Promise<Partial<UserRecord>[]> => {
      let rows = [...this.users.values()].filter((user) => matches(user, where as never));
      if (orderBy?.created_at) {
        rows = rows.sort((left, right) => {
          const leftTime = left.created_at.getTime();
          const rightTime = right.created_at.getTime();
          return orderBy.created_at === 'asc' ? leftTime - rightTime : rightTime - leftTime;
        });
      }
      return rows.slice(skip, skip + take).map((user) => selectFields(user, select) as never);
    },
    count: async ({ where }: { where?: WhereFilter }): Promise<number> => {
      return [...this.users.values()].filter((user) => matches(user, where as never)).length;
    },
    create: async ({
      data,
    }: {
      data: Omit<UserRecord, 'id' | 'created_at' | 'updated_at'>;
    }): Promise<UserRecord> => {
      const record: UserRecord = {
        ...data,
        id: crypto.randomUUID(),
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.users.set(record.id, record);
      return record;
    },
  };

  officialLetter = {
    findUnique: async ({
      where,
    }: {
      where: { sha256_hash?: string };
    }): Promise<OfficialLetterRecord | null> => {
      if (!where.sha256_hash) {
        return null;
      }
      return (
        [...this.officialLetters.values()].find(
          (letter) => letter.sha256_hash === where.sha256_hash,
        ) ?? null
      );
    },
    findMany: async ({
      where,
      skip = 0,
      take = 10,
      orderBy,
      select,
    }: {
      where?: WhereFilter;
      skip?: number;
      take?: number;
      orderBy?: { published_at?: 'asc' | 'desc' };
      select?: Record<string, boolean>;
    }): Promise<Partial<OfficialLetterRecord>[]> => {
      let rows = [...this.officialLetters.values()].filter((letter) =>
        matches(letter, where as never),
      );
      if (orderBy?.published_at) {
        rows = rows.sort((left, right) => {
          const leftTime = left.published_at?.getTime() ?? 0;
          const rightTime = right.published_at?.getTime() ?? 0;
          return orderBy.published_at === 'asc' ? leftTime - rightTime : rightTime - leftTime;
        });
      }
      return rows.slice(skip, skip + take).map((letter) => selectFields(letter, select) as never);
    },
    count: async ({ where }: { where?: WhereFilter }): Promise<number> => {
      return [...this.officialLetters.values()].filter((letter) => matches(letter, where as never))
        .length;
    },
  };

  submissionSequence = {
    upsert: async ({
      where,
      create,
    }: {
      where: { year: number };
      update: { current_number: { increment: number } };
      create: { year: number; current_number: number };
    }): Promise<{ year: number; current_number: number }> => {
      const current = this.submissionSequences.get(where.year) ?? create.current_number - 1;
      const next = current + 1;
      this.submissionSequences.set(where.year, next);
      return { year: where.year, current_number: next };
    },
  };

  cashFlow = {
    findUnique: async ({
      where,
      include,
    }: {
      where: { id: string };
      include?: { created_by?: { select?: Record<string, boolean> } };
    }): Promise<(CashFlowRecord & { created_by?: Partial<UserRecord> }) | null> => {
      const flow = this.cashFlows.get(where.id);
      if (!flow) return null;
      let created_by: Partial<UserRecord> | undefined;
      if (include?.created_by) {
        const user = this.users.get(flow.created_by_id);
        created_by = user ? selectFields(user, include.created_by.select) : undefined;
      }
      return { ...flow, ...(created_by ? { created_by } : {}) } as never;
    },
    findMany: async ({
      where,
      skip = 0,
      take,
      orderBy,
      include,
    }: {
      where?: WhereFilter;
      skip?: number;
      take?: number;
      orderBy?: Array<Record<string, 'asc' | 'desc'>>;
      include?: { created_by?: { select?: Record<string, boolean> } };
    }): Promise<Array<CashFlowRecord & { created_by?: Partial<UserRecord> }>> => {
      let rows = [...this.cashFlows.values()].filter((flow) => matches(flow, where as never));
      if (orderBy?.some((o) => o.transaction_date)) {
        rows = rows.sort((left, right) => {
          const leftTime = left.transaction_date?.getTime() ?? 0;
          const rightTime = right.transaction_date?.getTime() ?? 0;
          return orderBy.some((o) => o.transaction_date === 'asc')
            ? leftTime - rightTime
            : rightTime - leftTime;
        });
      } else if (orderBy?.some((o) => o.created_at)) {
        rows = rows.sort((left, right) => {
          const leftTime = left.created_at?.getTime() ?? 0;
          const rightTime = right.created_at?.getTime() ?? 0;
          return orderBy.some((o) => o.created_at === 'asc')
            ? leftTime - rightTime
            : rightTime - leftTime;
        });
      }
      return rows.slice(skip, take ? skip + take : undefined).map((flow) => {
        let created_by: Partial<UserRecord> | undefined;
        if (include?.created_by) {
          const user = this.users.get(flow.created_by_id);
          created_by = user ? selectFields(user, include.created_by.select) : undefined;
        }
        return { ...flow, ...(created_by ? { created_by } : {}) } as never;
      });
    },
    count: async ({ where }: { where?: WhereFilter }): Promise<number> => {
      return [...this.cashFlows.values()].filter((flow) => matches(flow, where as never)).length;
    },
  };

  divisionSubmission = {
    create: async ({
      data,
    }: {
      data: Omit<DivisionSubmissionRecord, 'id' | 'created_at' | 'updated_at'>;
    }): Promise<DivisionSubmissionRecord> => {
      const id = crypto.randomUUID();
      const record: DivisionSubmissionRecord = {
        ...data,
        id,
        approval_notes: null,
        reviewed_by_id: null,
        reviewed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.divisionSubmissions.set(id, record);
      return record;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<DivisionSubmissionRecord>;
    }): Promise<DivisionSubmissionRecord> => {
      const current = this.divisionSubmissions.get(where.id);
      if (!current) {
        throw new Error(`InMemoryPrisma: submission ${where.id} tidak ditemukan`);
      }
      const updated: DivisionSubmissionRecord = { ...current, ...data, updated_at: new Date() };
      this.divisionSubmissions.set(where.id, updated);
      return updated;
    },
    findUnique: async ({
      where,
      include,
    }: {
      where: { id: string };
      include?: { submitted_by?: { select?: Record<string, boolean> } };
    }): Promise<(DivisionSubmissionRecord & { submitted_by?: Partial<UserRecord> }) | null> => {
      const submission = this.divisionSubmissions.get(where.id);
      if (!submission) return null;
      let submitted_by: Partial<UserRecord> | undefined;
      if (include?.submitted_by) {
        const user = this.users.get(submission.submitted_by_id);
        submitted_by = user ? selectFields(user, include.submitted_by.select) : undefined;
      }
      return { ...submission, ...(submitted_by ? { submitted_by } : {}) };
    },
    findMany: async ({
      where,
      skip = 0,
      take = 10,
      orderBy,
      select,
      include,
    }: {
      where?: WhereFilter;
      skip?: number;
      take?: number;
      orderBy?: { execution_date?: 'asc' | 'desc'; created_at?: 'asc' | 'desc' };
      select?: Record<string, boolean>;
      include?: { submitted_by?: { select?: Record<string, boolean> } };
    }): Promise<Partial<DivisionSubmissionRecord>[]> => {
      let rows = [...this.divisionSubmissions.values()].filter((submission) =>
        matches(submission, where as never),
      );
      if (orderBy?.execution_date) {
        rows = rows.sort((left, right) => {
          const leftTime = left.execution_date?.getTime() ?? 0;
          const rightTime = right.execution_date?.getTime() ?? 0;
          return orderBy.execution_date === 'asc' ? leftTime - rightTime : rightTime - leftTime;
        });
      } else if (orderBy?.created_at) {
        rows = rows.sort((left, right) => {
          const leftTime = left.created_at?.getTime() ?? 0;
          const rightTime = right.created_at?.getTime() ?? 0;
          return orderBy.created_at === 'asc' ? leftTime - rightTime : rightTime - leftTime;
        });
      }
      return rows.slice(skip, skip + take).map((submission) => {
        if (select) {
          return selectFields(submission, select) as never;
        }
        let submitted_by: Partial<UserRecord> | undefined;
        if (include?.submitted_by) {
          const user = this.users.get(submission.submitted_by_id);
          submitted_by = user ? selectFields(user, include.submitted_by.select) : undefined;
        }
        return { ...submission, ...(submitted_by ? { submitted_by } : {}) } as never;
      });
    },
    count: async ({ where }: { where?: WhereFilter }): Promise<number> => {
      return [...this.divisionSubmissions.values()].filter((submission) =>
        matches(submission, where as never),
      ).length;
    },
  };

  auditLog = {
    create: async ({
      data,
    }: {
      data: Omit<AuditLogRecord, 'id' | 'created_at'>;
    }): Promise<AuditLogRecord> => {
      const record: AuditLogRecord = { ...data, id: crypto.randomUUID(), created_at: new Date() };
      this.auditLogs.push(record);
      return record;
    },
  };

  refreshSession = {
    create: async ({
      data,
    }: {
      data: Omit<RefreshSessionRecord, 'id' | 'created_at'>;
    }): Promise<RefreshSessionRecord> => {
      const record: RefreshSessionRecord = {
        ...data,
        id: crypto.randomUUID(),
        created_at: new Date(),
      };
      this.refreshSessions.set(record.jti, record);
      return record;
    },
    update: async ({
      where,
      data,
    }: {
      where: { jti: string };
      data: Partial<RefreshSessionRecord>;
    }): Promise<RefreshSessionRecord> => {
      const current = this.refreshSessions.get(where.jti);
      if (!current) {
        throw new Error(`InMemoryPrisma: refresh session ${where.jti} tidak ditemukan`);
      }
      const updated = { ...current, ...data };
      this.refreshSessions.set(where.jti, updated);
      return updated;
    },
    findUnique: async ({
      where,
    }: {
      where: { jti: string };
    }): Promise<RefreshSessionRecord | null> => {
      return this.refreshSessions.get(where.jti) ?? null;
    },
  };

  /** Kosongkan store antar test (dipanggil di beforeEach). */
  clear(): void {
    this.users.clear();
    this.officialLetters.clear();
    this.divisionSubmissions.clear();
    this.cashFlows.clear();
    this.submissionSequences.clear();
    this.auditLogs.length = 0;
    this.refreshSessions.clear();
  }

  /**
   * Eksekusi berurutan (interactive transactions Prisma tidak dipakai di
   * service — hanya bentuk array). Hasil di-reduce sama seperti Prisma.
   */
  $transaction = async <TResult>(operations: Promise<TResult>[]): Promise<TResult[]> => {
    const results: TResult[] = [];
    for (const operation of operations) {
      results.push(await operation);
    }
    return results;
  };
}
