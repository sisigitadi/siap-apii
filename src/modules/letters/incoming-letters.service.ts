import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { IncomingLetter, IncomingLetterStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { AuditService } from '@/infrastructure/audit/audit.service';
import {
  CreateIncomingLetterDto,
  DisposeIncomingLetterDto,
  IncomingLetterQueryDto,
} from './letters.dto';

/** Hasil daftar surat masuk yang terpaginasi. */
export type IncomingLetterList = {
  items: IncomingLetter[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

@Injectable()
export class IncomingLettersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    userId: string,
    dto: CreateIncomingLetterDto,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<IncomingLetter> {
    const existing = await this.prisma.incomingLetter.findUnique({
      where: { agenda_number: dto.agenda_number },
    });
    if (existing) {
      throw new ConflictException(`Nomor agenda ${dto.agenda_number} sudah tercatat.`);
    }

    const item = await this.prisma.incomingLetter.create({
      data: {
        agenda_number: dto.agenda_number,
        source_institution: dto.source_institution,
        letter_number: dto.letter_number,
        subject: dto.subject,
        received_date: new Date(dto.received_date),
        file_url: dto.file_url,
        received_by_id: userId,
        status: IncomingLetterStatus.RECEIVED,
      },
    });

    await this.audit.log({
      action: 'INCOMING_LETTER_CREATED',
      actorId: userId,
      targetId: item.id,
      resource: `/incoming-letters/${item.id}`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { agendaNumber: item.agenda_number, subject: item.subject },
    });

    return item;
  }

  async findAll(query: IncomingLetterQueryDto): Promise<IncomingLetterList> {
    const { page, limit, search, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.IncomingLetterWhereInput = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { source_institution: { contains: search, mode: 'insensitive' } },
        { letter_number: { contains: search, mode: 'insensitive' } },
        { agenda_number: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.incomingLetter.findMany({
        where,
        skip,
        take: limit,
        orderBy: { received_date: 'desc' },
      }),
      this.prisma.incomingLetter.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<IncomingLetter> {
    const item = await this.prisma.incomingLetter.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Surat masuk dengan ID ${id} tidak ditemukan.`);
    }
    return item;
  }

  async dispose(
    id: string,
    userId: string,
    dto: DisposeIncomingLetterDto,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<IncomingLetter> {
    const item = await this.prisma.incomingLetter.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Surat masuk dengan ID ${id} tidak ditemukan.`);
    }

    const updated = await this.prisma.incomingLetter.update({
      where: { id },
      data: {
        disposition_note: dto.disposition_note,
        disposition_target_division: dto.disposition_target_division,
        disposed_by_id: userId,
        disposed_at: new Date(),
        status: IncomingLetterStatus.DISPOSED,
      },
    });

    await this.audit.log({
      action: 'INCOMING_LETTER_DISPOSED',
      actorId: userId,
      targetId: id,
      resource: `/incoming-letters/${id}/dispose`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: {
        agendaNumber: item.agenda_number,
        targetDivision: dto.disposition_target_division,
        note: dto.disposition_note,
      },
    });

    return updated;
  }
}
