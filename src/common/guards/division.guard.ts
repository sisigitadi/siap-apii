import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Division } from '@prisma/client';
import type { Request } from 'express';
import { CROSS_DIVISION_ROLES } from '@/common/constants/user-role.constant';
import { DIVISION_KEY } from '@/common/decorators/division.decorator';
import { AuditService } from '@/infrastructure/audit/audit.service';
import { EventsBusService } from '@/infrastructure/websocket/events-bus.service';

/**
 * Isolasi divisi mutlak (DESIGN.md §5.3). Setiap penolakan wajib memicu
 * SecurityAuditEvent → audit_logs + Redis stream + event real-time
 * `AUDIT_SECURITY` ke room superadmin & pengawas (DESIGN.md §7.2).
 */
@Injectable()
export class DivisionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
    private readonly eventsBus: EventsBusService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Division | undefined>(DIVISION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.user) {
      throw new UnauthorizedException('Otentikasi diperlukan');
    }
    const { user } = request;

    // Pengurus tingkat wilayah boleh melihat semua divisi
    if (CROSS_DIVISION_ROLES.includes(user.role)) {
      return true;
    }
    if (user.division === required) {
      return true;
    }

    // Tolak + catat sebagai event keamanan
    await this.audit.log({
      action: 'CROSS_DIVISION_DENIED',
      actorId: user.sub,
      resource: request.originalUrl,
      ipAddress: request.ip ?? null,
      userAgent: request.headers['user-agent'] ?? null,
      metadata: {
        requiredDivision: required,
        userDivision: user.division,
        userRole: user.role,
      },
    });
    await this.eventsBus.emitAuditSecurity({
      userId: user.sub,
      endpoint: request.originalUrl,
      timestamp: new Date().toISOString(),
    });
    throw new ForbiddenException('Akses divisi ditolak');
  }
}
