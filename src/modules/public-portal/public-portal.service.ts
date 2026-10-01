import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Division, LetterStatus, LetterType, SubmissionStatus } from '@prisma/client';
import { appConfigToken, type AppConfig } from '@/config/app.config';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import type { PublicFeedQueryDto, PublicScheduleQueryDto } from './public-portal.dto';

/** Masa berlaku e-KTA anggota (FR-PUBLIC-02: 5 tahun) */
export const MEMBER_CARD_VALIDITY_YEARS = 5;

/** Format sidik jari SHA-256 heksadesimal 64 karakter */
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

/** Hasil verifikasi keaslian dokumen (FR-PUBLIC-01 & US-07) */
type VerificationResult = {
  verified: boolean;
  message: string;
  letter_number: string | null;
  title: string | null;
  letter_type: LetterType | null;
  published_at: Date | null;
  sha256: string;
};

/** Item feed informasi publik (surat yang sudah dirilis) */
type PublicFeedItem = {
  id: string;
  letter_number: string;
  title: string;
  letter_type: LetterType;
  published_at: Date;
};

/** Item jadwal program resmi yang dipublikasi divisi */
type PublicScheduleItem = {
  id: string;
  tracking_id: string;
  program_title: string;
  division: Division;
  execution_date: Date;
  target_audience: string | null;
};

type Paginated<TItem> = {
  items: TItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/**
 * Portal publik & e-KTA (FR-PUBLIC-01..03, DESIGN.md §10 "Realtime & Portal").
 *
 * Endpoint publik hanya membaca data berstatus PUBLISHED — tidak pernah
 * membocorkan draf atau dokumen internal.
 */
@Injectable()
export class PublicPortalService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(appConfigToken) private readonly config: AppConfig,
  ) {}

  /**
   * Verifikasi keaslian dokumen via SHA-256 (FR-PUBLIC-01, US-07).
   * Scan QR di PDF → halaman publik → endpoint ini.
   */
  async verifyDocument(rawSha256: string): Promise<VerificationResult> {
    const sha256 = rawSha256.trim().toLowerCase();
    if (!SHA256_PATTERN.test(sha256)) {
      throw new BadRequestException('Format SHA-256 tidak valid (harus 64 karakter heksadesimal)');
    }

    const letter = await this.prisma.officialLetter.findUnique({
      where: { sha256_hash: sha256 },
    });

    // Hanya dokumen yang sudah PUBLISHED yang bisa diverifikasi publik.
    // Dokumen draf/tidak ditemukan → respons netral "TIDAK DIVERIFIKASI".
    if (!letter || letter.status !== LetterStatus.PUBLISHED) {
      return {
        verified: false,
        message: 'TIDAK DIVERIFIKASI — dokumen tidak ditemukan atau belum dirilis resmi.',
        letter_number: null,
        title: null,
        letter_type: null,
        published_at: null,
        sha256,
      };
    }

    return {
      verified: true,
      message: 'DOKUMEN ASLI — sesuai arsip resmi Yayasan APII DPW Jabodetabek.',
      letter_number: letter.letter_number,
      title: letter.title,
      letter_type: letter.letter_type,
      published_at: letter.published_at,
      sha256: letter.sha256_hash,
    };
  }

  /** Feed informasi resmi: surat yang sudah dirilis, terbaru lebih dulu */
  async findPublicFeed(query: PublicFeedQueryDto): Promise<Paginated<PublicFeedItem>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;
    const where = { status: LetterStatus.PUBLISHED };

    const [rows, total] = await Promise.all([
      this.prisma.officialLetter.findMany({
        where,
        skip,
        take: limit,
        orderBy: { published_at: 'desc' },
        select: {
          id: true,
          letter_number: true,
          title: true,
          letter_type: true,
          published_at: true,
        },
      }),
      this.prisma.officialLetter.count({ where }),
    ]);

    return {
      // published_at selalu terisi untuk surat PUBLISHED; Prisma tidak
      // menyempitkan tipe lewat klausa where, jadi ditegaskan di sini.
      items: rows.map((row) => ({ ...row, published_at: row.published_at as Date })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Jadwal kajian & program resmi yang dipublikasi divisi (FR-PUBLIC-03) */
  async findPublicSchedules(query: PublicScheduleQueryDto): Promise<Paginated<PublicScheduleItem>> {
    const { page, limit, division } = query;
    const skip = (page - 1) * limit;
    const where = {
      status: SubmissionStatus.PUBLISHED,
      execution_date: { not: null },
      ...(division ? { division } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.divisionSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { execution_date: 'asc' },
        select: {
          id: true,
          tracking_id: true,
          program_title: true,
          division: true,
          execution_date: true,
          target_audience: true,
        },
      }),
      this.prisma.divisionSubmission.count({ where }),
    ]);

    return {
      // execution_date di-filter `not null` di atas; Prisma tidak menyempitkan
      // tipe lewat klausa where, jadi ditegaskan di sini.
      items: rows.map((row) => ({ ...row, execution_date: row.execution_date as Date })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** e-KTA digital anggota (FR-PUBLIC-02) — hanya untuk PUBLIK_ANGGOTA sendiri */
  async getMyMemberCard(userId: string): Promise<{
    member_number: string | null;
    full_name: string;
    email: string;
    photo_url: string | null;
    member_since: Date | null;
    issued_at: Date | null;
    expires_at: Date | null;
    status: 'ACTIVE' | 'EXPIRED';
    qr_verify_url: string | null;
  }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Data anggota tidak ditemukan.');
    }

    const issuedAt = user.card_issued_at ?? user.member_since ?? null;
    const expiresAt = user.card_expires_at ?? this.addYears(issuedAt, MEMBER_CARD_VALIDITY_YEARS);
    const status: 'ACTIVE' | 'EXPIRED' =
      expiresAt === null || expiresAt.getTime() > Date.now() ? 'ACTIVE' : 'EXPIRED';

    return {
      member_number: user.member_number,
      full_name: user.full_name,
      email: user.email,
      photo_url: user.profile_picture_url,
      member_since: user.member_since,
      issued_at: issuedAt,
      expires_at: expiresAt,
      status,
      qr_verify_url:
        user.member_number !== null
          ? `${this.config.PUBLIC_VERIFY_BASE_URL}/member/${user.member_number}`
          : null,
    };
  }

  private addYears(date: Date | null, years: number): Date | null {
    if (date === null) {
      return null;
    }
    const result = new Date(date.getTime());
    result.setFullYear(result.getFullYear() + years);
    return result;
  }
}
