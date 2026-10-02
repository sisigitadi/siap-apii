import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { LetterStatus, LetterType, OfficialLetter, Prisma } from '@prisma/client';
import { appConfigToken, type AppConfig } from '@/config/app.config';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { AuditService } from '@/infrastructure/audit/audit.service';
import { EventsBusService } from '@/infrastructure/websocket/events-bus.service';
import { CreateLetterDto, LetterQueryDto, RejectLetterDto, UpdateLetterDto } from './letters.dto';
import { LettersPdfService } from './letters-pdf.service';

/** Shape relasi `created_by` / `approved_by` yang di-`select` pada query surat. */
type LetterActorSelect = { select: { id: true; full_name: true; email: true; role: true } };

/** Surat resmi dengan data pembuat & approver (hasil query `include` Prisma). */
export type LetterWithRelations = Prisma.OfficialLetterGetPayload<{
  include: { created_by: LetterActorSelect; approved_by: LetterActorSelect };
}>;

/** Detail surat beserta status verifikasi integritas (DESIGN.md §6.3). */
export type LetterDetail = LetterWithRelations & { integrity_verified: boolean };

/** Hasil daftar surat resmi yang terpaginasi. */
export type LetterList = {
  items: LetterWithRelations[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const LETTER_TYPE_CODES: Record<LetterType, string> = {
  SK: 'SK-DPW/APII-JABO',
  SURAT_TUGAS: 'ST-DPW/APII-JABO',
  REKOMENDASI: 'REK-DPW/APII-JABO',
  MAKLUMAT: 'MAK-DPW/APII-JABO',
  UNDANGAN: 'UND-DPW/APII-JABO',
  PENGANTAR: 'SP-DPW/APII-JABO',
  EDARAN: 'SE-DPW/APII-JABO',
};

const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/**
 * Serialisasi kanonik rekursif: urutkan key setiap objek (termasuk nested)
 * secara abjad supaya SHA-256 stabil walau driver/Postgres jsonb menyusun ulang
 * urutan key (FR-LETTER-05 — integritas harus diverifikasi setelah round-trip DB).
 * Array dipertahankan urutannya (urutan penandatangan & konsiderans bermakna).
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(record[key]);
        return acc;
      }, {});
  }
  return value;
}

@Injectable()
export class LettersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly eventsBus: EventsBusService,
    private readonly pdfService: LettersPdfService,
    @Inject(appConfigToken) private readonly config: AppConfig,
  ) {}

  async generateLetterNumber(letterType: LetterType, date = new Date()): Promise<string> {
    const year = date.getFullYear();
    const month = date.getMonth();
    const romanMonth = ROMAN_MONTHS[month] ?? 'I';
    const code = LETTER_TYPE_CODES[letterType] ?? 'SURAT-DPW/APII-JABO';

    const seq = await this.prisma.letterSequence.upsert({
      where: {
        year_letter_type: { year, letter_type: letterType },
      },
      update: { current_number: { increment: 1 } },
      create: { year, letter_type: letterType, current_number: 1 },
    });

    const sequencePadded = String(seq.current_number).padStart(3, '0');
    return `${sequencePadded}/${code}/${romanMonth}/${year}`;
  }

  computeCanonicalHash(payload: {
    letter_number: string;
    title: string;
    letter_type: string;
    content_payload: unknown;
    kop_config: unknown;
    signatories: unknown;
  }): string {
    return createHash('sha256').update(JSON.stringify(canonicalize(payload))).digest('hex');
  }

  async createLetter(
    userId: string,
    dto: CreateLetterDto,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<OfficialLetter> {
    let letterNumber = dto.letter_number?.trim();
    if (letterNumber) {
      const existing = await this.prisma.officialLetter.findUnique({
        where: { letter_number: letterNumber },
      });
      if (existing) {
        throw new ConflictException(`Nomor surat ${letterNumber} sudah digunakan.`);
      }
    } else {
      letterNumber = await this.generateLetterNumber(dto.letter_type);
    }

    const kopConfig = dto.kop_config ?? {
      authority_text: 'DEWAN PIMPINAN WILAYAH JABODETABEK',
      sub_text: 'ASOSIASI PENGACARA PENGADAAN INDONESIA',
      address: 'DKI Jakarta, Jawa Barat, Banten',
      contact_info: 'sekretariat@apii.sigitadi.id',
    };

    const hash = this.computeCanonicalHash({
      letter_number: letterNumber,
      title: dto.title,
      letter_type: dto.letter_type,
      content_payload: dto.content_payload,
      kop_config: kopConfig,
      signatories: dto.signatories,
    });

    const qrVerifyUrl = `${this.config.PUBLIC_VERIFY_BASE_URL}/${hash}`;

    const letter = await this.prisma.officialLetter.create({
      data: {
        letter_number: letterNumber,
        title: dto.title,
        letter_type: dto.letter_type,
        content_payload: dto.content_payload as unknown as Prisma.InputJsonValue,
        kop_config: kopConfig as unknown as Prisma.InputJsonValue,
        signatories: dto.signatories as unknown as Prisma.InputJsonValue,
        sha256_hash: hash,
        qr_verify_url: qrVerifyUrl,
        status: LetterStatus.DRAFT,
        created_by_id: userId,
      },
    });

    await this.audit.log({
      action: 'LETTER_CREATED',
      actorId: userId,
      targetId: letter.id,
      resource: `/official-letters/${letter.id}`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { letterNumber: letter.letter_number, title: letter.title },
    });

    return letter;
  }

  async findAllLetters(query: LetterQueryDto): Promise<LetterList> {
    const { page, limit, search, letter_type, status, year } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OfficialLetterWhereInput = {};
    if (letter_type) where.letter_type = letter_type;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { letter_number: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (year) {
      where.created_at = {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31, 23, 59, 59, 999),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.officialLetter.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          created_by: {
            select: { id: true, full_name: true, email: true, role: true },
          },
          approved_by: {
            select: { id: true, full_name: true, email: true, role: true },
          },
        },
      }),
      this.prisma.officialLetter.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findLetterById(id: string): Promise<LetterDetail> {
    const letter = await this.prisma.officialLetter.findUnique({
      where: { id },
      include: {
        created_by: {
          select: { id: true, full_name: true, email: true, role: true },
        },
        approved_by: {
          select: { id: true, full_name: true, email: true, role: true },
        },
      },
    });

    if (!letter) {
      throw new NotFoundException(`Surat dengan ID ${id} tidak ditemukan.`);
    }

    const currentHash = this.computeCanonicalHash({
      letter_number: letter.letter_number,
      title: letter.title,
      letter_type: letter.letter_type,
      content_payload: letter.content_payload,
      kop_config: letter.kop_config,
      signatories: letter.signatories,
    });

    return {
      ...letter,
      integrity_verified: currentHash === letter.sha256_hash,
    };
  }

  async updateLetter(
    id: string,
    userId: string,
    dto: UpdateLetterDto,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<OfficialLetter> {
    const letter = await this.prisma.officialLetter.findUnique({ where: { id } });
    if (!letter) {
      throw new NotFoundException(`Surat dengan ID ${id} tidak ditemukan.`);
    }

    if (letter.status !== LetterStatus.DRAFT && letter.status !== LetterStatus.REJECTED) {
      throw new BadRequestException(
        `Surat berstatus ${letter.status} tidak dapat diubah (hanya DRAFT atau REJECTED).`,
      );
    }

    const nextTitle = dto.title ?? letter.title;
    const nextType = dto.letter_type ?? letter.letter_type;
    const nextContent = dto.content_payload ?? letter.content_payload;
    const nextKop = dto.kop_config ?? letter.kop_config;
    const nextSignatories = dto.signatories ?? letter.signatories;

    let nextNumber = letter.letter_number;
    if (dto.letter_number && dto.letter_number !== letter.letter_number) {
      const exists = await this.prisma.officialLetter.findUnique({
        where: { letter_number: dto.letter_number },
      });
      if (exists) {
        throw new ConflictException(`Nomor surat ${dto.letter_number} sudah digunakan.`);
      }
      nextNumber = dto.letter_number;
    }

    const newHash = this.computeCanonicalHash({
      letter_number: nextNumber,
      title: nextTitle,
      letter_type: nextType,
      content_payload: nextContent,
      kop_config: nextKop,
      signatories: nextSignatories,
    });

    const newQrUrl = `${this.config.PUBLIC_VERIFY_BASE_URL}/${newHash}`;

    const updated = await this.prisma.officialLetter.update({
      where: { id },
      data: {
        letter_number: nextNumber,
        title: nextTitle,
        letter_type: nextType,
        content_payload: nextContent as unknown as Prisma.InputJsonValue,
        kop_config: nextKop as unknown as Prisma.InputJsonValue,
        signatories: nextSignatories as unknown as Prisma.InputJsonValue,
        sha256_hash: newHash,
        qr_verify_url: newQrUrl,
      },
    });

    await this.audit.log({
      action: 'LETTER_UPDATED',
      actorId: userId,
      targetId: updated.id,
      resource: `/official-letters/${updated.id}`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { letterNumber: updated.letter_number, title: updated.title },
    });

    return updated;
  }

  async submitLetter(
    id: string,
    userId: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<OfficialLetter> {
    const letter = await this.prisma.officialLetter.findUnique({ where: { id } });
    if (!letter) {
      throw new NotFoundException(`Surat dengan ID ${id} tidak ditemukan.`);
    }

    if (letter.status !== LetterStatus.DRAFT && letter.status !== LetterStatus.REJECTED) {
      throw new BadRequestException(
        `Surat hanya bisa diajukan dari status DRAFT atau REJECTED (status saat ini: ${letter.status}).`,
      );
    }

    const updated = await this.prisma.officialLetter.update({
      where: { id },
      data: { status: LetterStatus.PENDING_APPROVAL },
    });

    await this.audit.log({
      action: 'LETTER_SUBMITTED',
      actorId: userId,
      targetId: id,
      resource: `/official-letters/${id}/submit`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { letterNumber: letter.letter_number },
    });

    return updated;
  }

  async approveAndPublishLetter(
    id: string,
    userId: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<OfficialLetter> {
    const letter = await this.prisma.officialLetter.findUnique({ where: { id } });
    if (!letter) {
      throw new NotFoundException(`Surat dengan ID ${id} tidak ditemukan.`);
    }

    if (letter.status !== LetterStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Hanya surat berstatus PENDING_APPROVAL yang dapat disetujui (status saat ini: ${letter.status}).`,
      );
    }

    const currentHash = this.computeCanonicalHash({
      letter_number: letter.letter_number,
      title: letter.title,
      letter_type: letter.letter_type,
      content_payload: letter.content_payload,
      kop_config: letter.kop_config,
      signatories: letter.signatories,
    });

    if (currentHash !== letter.sha256_hash) {
      throw new ConflictException(
        'Integritas dokumen gagal diverifikasi: data konten tidak sesuai dengan hash.',
      );
    }

    const published = await this.prisma.officialLetter.update({
      where: { id },
      data: {
        status: LetterStatus.PUBLISHED,
        approved_by_id: userId,
        published_at: new Date(),
        rejection_note: null,
      },
    });

    await this.audit.log({
      action: 'LETTER_PUBLISHED',
      actorId: userId,
      targetId: id,
      resource: `/official-letters/${id}/publish`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: {
        letterNumber: published.letter_number,
        title: published.title,
        sha256: published.sha256_hash,
      },
    });

    // Event real-time ke room `public` (DESIGN.md §7.2)
    await this.eventsBus.emitDocumentPublished({
      letterNumber: published.letter_number,
      title: published.title,
      sha256: published.sha256_hash,
    });

    // FR-LETTER-09: arsipkan PDF immutable sekali saat rilis (best-effort).
    // Gagal simpan (FS read-only/serverless) tidak membatalkan rilis — endpoint
    // /download akan merender ulang dengan hash yang sama (tetap immutable).
    const pdfUrl = await this.pdfService.persistLetterPdf(
      published as unknown as import('./letters-pdf.service').RenderableLetter,
    );
    if (pdfUrl) {
      await this.recordPdfStorageUrl(id, pdfUrl);
      return { ...published, pdf_storage_url: pdfUrl };
    }

    return published;
  }

  async rejectLetter(
    id: string,
    userId: string,
    dto: RejectLetterDto,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<OfficialLetter> {
    const letter = await this.prisma.officialLetter.findUnique({ where: { id } });
    if (!letter) {
      throw new NotFoundException(`Surat dengan ID ${id} tidak ditemukan.`);
    }

    if (letter.status !== LetterStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Hanya surat berstatus PENDING_APPROVAL yang dapat ditolak (status saat ini: ${letter.status}).`,
      );
    }

    const updated = await this.prisma.officialLetter.update({
      where: { id },
      data: {
        status: LetterStatus.REJECTED,
        rejection_note: dto.rejection_note,
      },
    });

    await this.audit.log({
      action: 'LETTER_REJECTED',
      actorId: userId,
      targetId: id,
      resource: `/official-letters/${id}/reject`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: {
        letterNumber: letter.letter_number,
        rejectionNote: dto.rejection_note,
      },
    });

    return updated;
  }

  async archiveLetter(
    id: string,
    userId: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<OfficialLetter> {
    const letter = await this.prisma.officialLetter.findUnique({ where: { id } });
    if (!letter) {
      throw new NotFoundException(`Surat dengan ID ${id} tidak ditemukan.`);
    }

    if (letter.status !== LetterStatus.PUBLISHED) {
      throw new BadRequestException(
        `Hanya surat yang sudah PUBLISHED yang dapat diarsipkan (status saat ini: ${letter.status}).`,
      );
    }

    const updated = await this.prisma.officialLetter.update({
      where: { id },
      data: { status: LetterStatus.ARCHIVED },
    });

    await this.audit.log({
      action: 'LETTER_ARCHIVED',
      actorId: userId,
      targetId: id,
      resource: `/official-letters/${id}/archive`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { letterNumber: letter.letter_number },
    });

    return updated;
  }

  /**
   * Catat URL penyimpanan PDF final setelah arsip-arsip berhasil ditulis (FR-LETTER-09).
   */
  async recordPdfStorageUrl(id: string, pdfStorageUrl: string): Promise<void> {
    await this.prisma.officialLetter.update({
      where: { id },
      data: { pdf_storage_url: pdfStorageUrl },
    });
  }

  /**
   * Baca PDF final yang sudah diarsipkan di storage lokal. Mengembalikan `null`
   * bila berkas tidak ada (mis. filesystem read-only) — pemanggil fallback ke render on-demand.
   */
  async readStoredPdf(letter: {
    id: string;
    letter_number: string;
    title: string;
    sha256_hash: string;
    qr_verify_url: string;
    kop_config: unknown;
    content_payload: unknown;
    signatories: unknown;
  }): Promise<Buffer | null> {
    try {
      return await readFile(this.pdfService.pdfStoragePath(letter.id));
    } catch {
      return null;
    }
  }
}
