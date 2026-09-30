import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Division, DivisionSubmission, Prisma, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { AuditService } from '@/infrastructure/audit/audit.service';
import { RedisService } from '@/infrastructure/redis/redis.service';
import {
  CreateSubmissionDto,
  RejectSubmissionDto,
  ReviewSubmissionDto,
  SubmissionQueryDto,
  UpdateSubmissionDto,
} from './divisions.dto';

/** Tipe usulan program dengan data pengusul (hasil query `include` Prisma). */
export type SubmissionWithSubmitter = Prisma.DivisionSubmissionGetPayload<{
  include: {
    submitted_by: { select: { id: true; full_name: true; email: true; role: true } };
  };
}>;

/** Hasil daftar usulan program yang terpaginasi. */
export type SubmissionList = {
  items: SubmissionWithSubmitter[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/** Dasbor agregat usulan program 7 divisi untuk pimpinan. */
export type SubmissionAggregate = {
  total_submissions: number;
  divisions: Record<Division, number>;
  status: Record<SubmissionStatus, number>;
  total_approved_budget: number;
  upcoming_programs: Array<{
    tracking_id: string;
    program_title: string;
    division: Division;
    execution_date: Date;
  }>;
};

@Injectable()
export class DivisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Menghasilkan ID Pelacakan unik berurutan per tahun (DESIGN.md §6.2).
   * Format: #REQ-{tahun}-{nomor_urut}
   * Contoh: #REQ-2025-089
   */
  async generateTrackingId(date = new Date()): Promise<string> {
    const year = date.getFullYear();
    const seq = await this.prisma.submissionSequence.upsert({
      where: { year },
      update: { current_number: { increment: 1 } },
      create: { year, current_number: 1 },
    });

    const padded = String(seq.current_number).padStart(3, '0');
    return `#REQ-${year}-${padded}`;
  }

  async createSubmission(
    userId: string,
    division: Division,
    dto: CreateSubmissionDto,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<DivisionSubmission> {
    const trackingId = await this.generateTrackingId();

    const submission = await this.prisma.divisionSubmission.create({
      data: {
        tracking_id: trackingId,
        division,
        program_title: dto.program_title,
        budget_estimate: new Prisma.Decimal(dto.budget_estimate),
        target_audience: dto.target_audience,
        execution_date: dto.execution_date ? new Date(dto.execution_date) : null,
        submission_data: dto.submission_data as unknown as Prisma.InputJsonValue,
        attachments: dto.attachments as unknown as Prisma.InputJsonValue,
        status: SubmissionStatus.DRAFT,
        submitted_by_id: userId,
      },
    });

    await this.audit.log({
      action: 'SUBMISSION_CREATED',
      actorId: userId,
      targetId: submission.id,
      resource: `/divisions/submissions/${submission.id}`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: {
        trackingId: submission.tracking_id,
        division: submission.division,
        title: submission.program_title,
      },
    });

    return submission;
  }

  async updateSubmission(
    id: string,
    userId: string,
    userDivision: Division | null,
    dto: UpdateSubmissionDto,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<DivisionSubmission> {
    const submission = await this.prisma.divisionSubmission.findUnique({ where: { id } });
    if (!submission) {
      throw new NotFoundException(`Usulan program dengan ID ${id} tidak ditemukan.`);
    }

    if (userDivision && submission.division !== userDivision) {
      throw new ForbiddenException('Akses usulan program lintas divisi ditolak.');
    }

    if (
      submission.status !== SubmissionStatus.DRAFT &&
      submission.status !== SubmissionStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Hanya usulan berstatus DRAFT atau REJECTED yang dapat diubah (status saat ini: ${submission.status}).`,
      );
    }

    const updated = await this.prisma.divisionSubmission.update({
      where: { id },
      data: {
        program_title: dto.program_title ?? submission.program_title,
        budget_estimate:
          dto.budget_estimate !== undefined
            ? new Prisma.Decimal(dto.budget_estimate)
            : submission.budget_estimate,
        target_audience: dto.target_audience ?? submission.target_audience,
        execution_date: dto.execution_date
          ? new Date(dto.execution_date)
          : submission.execution_date,
        submission_data:
          dto.submission_data !== undefined
            ? (dto.submission_data as unknown as Prisma.InputJsonValue)
            : undefined,
        attachments:
          dto.attachments !== undefined
            ? (dto.attachments as unknown as Prisma.InputJsonValue)
            : undefined,
      },
    });

    await this.audit.log({
      action: 'SUBMISSION_UPDATED',
      actorId: userId,
      targetId: updated.id,
      resource: `/divisions/submissions/${updated.id}`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { trackingId: updated.tracking_id, title: updated.program_title },
    });

    return updated;
  }

  async submitForApproval(
    id: string,
    userId: string,
    userDivision: Division | null,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<DivisionSubmission> {
    const submission = await this.prisma.divisionSubmission.findUnique({ where: { id } });
    if (!submission) {
      throw new NotFoundException(`Usulan program dengan ID ${id} tidak ditemukan.`);
    }

    if (userDivision && submission.division !== userDivision) {
      throw new ForbiddenException('Akses usulan program lintas divisi ditolak.');
    }

    if (
      submission.status !== SubmissionStatus.DRAFT &&
      submission.status !== SubmissionStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Hanya usulan berstatus DRAFT atau REJECTED yang dapat diajukan (status saat ini: ${submission.status}).`,
      );
    }

    const updated = await this.prisma.divisionSubmission.update({
      where: { id },
      data: { status: SubmissionStatus.PENDING_APPROVAL },
    });

    await this.audit.log({
      action: 'SUBMISSION_SUBMITTED',
      actorId: userId,
      targetId: id,
      resource: `/divisions/submissions/${id}/submit`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { trackingId: submission.tracking_id },
    });

    return updated;
  }
  async approve(
    id: string,
    reviewerId: string,
    dto: ReviewSubmissionDto,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<DivisionSubmission> {
    const submission = await this.prisma.divisionSubmission.findUnique({ where: { id } });
    if (!submission) {
      throw new NotFoundException(`Usulan program dengan ID ${id} tidak ditemukan.`);
    }

    if (submission.status !== SubmissionStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Hanya usulan berstatus PENDING_APPROVAL yang dapat disetujui (status saat ini: ${submission.status}).`,
      );
    }

    const updated = await this.prisma.divisionSubmission.update({
      where: { id },
      data: {
        status: SubmissionStatus.APPROVED,
        approval_notes: dto.approval_notes,
        reviewed_by_id: reviewerId,
        reviewed_at: new Date(),
      },
    });

    await this.audit.log({
      action: 'SUBMISSION_APPROVED',
      actorId: reviewerId,
      targetId: id,
      resource: `/divisions/submissions/${id}/approve`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: {
        trackingId: submission.tracking_id,
        division: submission.division,
        title: submission.program_title,
      },
    });

    await this.redis.xAdd('audit:security', {
      event: 'PROGRAM_APPROVED',
      trackingId: updated.tracking_id,
      division: updated.division,
      title: updated.program_title,
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  async reject(
    id: string,
    reviewerId: string,
    dto: RejectSubmissionDto,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<DivisionSubmission> {
    const submission = await this.prisma.divisionSubmission.findUnique({ where: { id } });
    if (!submission) {
      throw new NotFoundException(`Usulan program dengan ID ${id} tidak ditemukan.`);
    }

    if (submission.status !== SubmissionStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Hanya usulan berstatus PENDING_APPROVAL yang dapat ditolak (status saat ini: ${submission.status}).`,
      );
    }

    const updated = await this.prisma.divisionSubmission.update({
      where: { id },
      data: {
        status: SubmissionStatus.REJECTED,
        approval_notes: dto.approval_notes,
        reviewed_by_id: reviewerId,
        reviewed_at: new Date(),
      },
    });

    await this.audit.log({
      action: 'SUBMISSION_REJECTED',
      actorId: reviewerId,
      targetId: id,
      resource: `/divisions/submissions/${id}/reject`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: {
        trackingId: submission.tracking_id,
        rejectionNotes: dto.approval_notes,
      },
    });

    return updated;
  }

  async publish(
    id: string,
    reviewerId: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<DivisionSubmission> {
    const submission = await this.prisma.divisionSubmission.findUnique({ where: { id } });
    if (!submission) {
      throw new NotFoundException(`Usulan program dengan ID ${id} tidak ditemukan.`);
    }

    if (submission.status !== SubmissionStatus.APPROVED) {
      throw new BadRequestException(
        `Hanya usulan berstatus APPROVED yang dapat dipublikasikan (status saat ini: ${submission.status}).`,
      );
    }

    const updated = await this.prisma.divisionSubmission.update({
      where: { id },
      data: { status: SubmissionStatus.PUBLISHED },
    });

    await this.audit.log({
      action: 'SUBMISSION_PUBLISHED',
      actorId: reviewerId,
      targetId: id,
      resource: `/divisions/submissions/${id}/publish`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { trackingId: submission.tracking_id },
    });

    return updated;
  }

  async findAll(query: SubmissionQueryDto, scopedDivision?: Division): Promise<SubmissionList> {
    const { page, limit, status, division, search, year } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.DivisionSubmissionWhereInput = {};
    if (scopedDivision) {
      where.division = scopedDivision;
    } else if (division) {
      where.division = division;
    }

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { program_title: { contains: search, mode: 'insensitive' } },
        { tracking_id: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (year) {
      where.created_at = {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31, 23, 59, 59, 999),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.divisionSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          submitted_by: {
            select: { id: true, full_name: true, email: true, role: true },
          },
        },
      }),
      this.prisma.divisionSubmission.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string, scopedDivision?: Division): Promise<SubmissionWithSubmitter> {
    const submission = await this.prisma.divisionSubmission.findUnique({
      where: { id },
      include: {
        submitted_by: {
          select: { id: true, full_name: true, email: true, role: true },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException(`Usulan program dengan ID ${id} tidak ditemukan.`);
    }

    if (scopedDivision && submission.division !== scopedDivision) {
      throw new ForbiddenException('Akses usulan program lintas divisi ditolak.');
    }

    return submission;
  }

  async getAggregateDashboard(): Promise<SubmissionAggregate> {
    const all = await this.prisma.divisionSubmission.findMany({
      select: {
        division: true,
        status: true,
        budget_estimate: true,
        execution_date: true,
        program_title: true,
        tracking_id: true,
      },
    });

    const divisionCounts: Record<Division, number> = {
      [Division.DIV_HUMAS]: 0,
      [Division.DIV_LITBANG]: 0,
      [Division.DIV_SOSMED]: 0,
      [Division.DIV_DAKWAH]: 0,
      [Division.DIV_INVESTASI]: 0,
      [Division.DIV_HUKUM]: 0,
      [Division.DIV_UMUM]: 0,
    };

    const statusCounts: Record<SubmissionStatus, number> = {
      [SubmissionStatus.DRAFT]: 0,
      [SubmissionStatus.PENDING_APPROVAL]: 0,
      [SubmissionStatus.APPROVED]: 0,
      [SubmissionStatus.REJECTED]: 0,
      [SubmissionStatus.PUBLISHED]: 0,
    };

    let totalApprovedBudget = 0;
    const upcomingPrograms: {
      tracking_id: string;
      program_title: string;
      division: Division;
      execution_date: Date;
    }[] = [];

    const now = new Date();

    for (const item of all) {
      divisionCounts[item.division] = (divisionCounts[item.division] || 0) + 1;
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;

      if (item.status === SubmissionStatus.APPROVED || item.status === SubmissionStatus.PUBLISHED) {
        totalApprovedBudget += Number(item.budget_estimate);
      }

      if (
        item.execution_date &&
        item.execution_date >= now &&
        (item.status === SubmissionStatus.APPROVED || item.status === SubmissionStatus.PUBLISHED)
      ) {
        upcomingPrograms.push({
          tracking_id: item.tracking_id,
          program_title: item.program_title,
          division: item.division,
          execution_date: item.execution_date,
        });
      }
    }

    upcomingPrograms.sort((a, b) => a.execution_date.getTime() - b.execution_date.getTime());

    return {
      total_submissions: all.length,
      divisions: divisionCounts,
      status: statusCounts,
      total_approved_budget: totalApprovedBudget,
      upcoming_programs: upcomingPrograms.slice(0, 10),
    };
  }
}
