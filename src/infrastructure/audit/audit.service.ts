import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type AuditAction } from '@prisma/client';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { RedisService } from '@/infrastructure/redis/redis.service';

export interface AuditLogInput {
  action: AuditAction;
  actorId?: string | null;
  targetId?: string | null;
  resource?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

const AUDIT_STREAM = 'audit:security';

/**
 * Mencatat event keamanan ke dua tempat sekaligus (DESIGN.md §5.3):
 * 1. tabel `audit_logs` (PostgreSQL) — permanen, untuk pemeriksaan Dewan Pengawas
 * 2. Redis stream `audit:security` — untuk konsumsi real-time (Fase 3)
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: input.action,
          actor_id: input.actorId ?? null,
          target_id: input.targetId ?? null,
          resource: input.resource ?? null,
          ip_address: input.ipAddress ?? null,
          user_agent: input.userAgent ?? null,
          metadata: (input.metadata ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error: unknown) {
      // Audit tidak boleh memutuskan request utama; catat & lanjutkan.
      this.logger.error(`Gagal menulis audit_logs: ${String(error)}`);
    }

    await this.redis.xAdd(AUDIT_STREAM, {
      action: input.action,
      actor_id: input.actorId ?? '',
      target_id: input.targetId ?? '',
      resource: input.resource ?? '',
      ip_address: input.ipAddress ?? '',
      metadata: JSON.stringify(input.metadata ?? {}),
    });
  }
}
