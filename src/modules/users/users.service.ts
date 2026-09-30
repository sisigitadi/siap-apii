import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Division, UserRole } from '@prisma/client';
import { DIVISION_ROLES, DELEGATABLE_ROLES } from '@/common/constants/user-role.constant';
import { toPublicUser, type PublicUser } from '@/common/dto/user.dto';
import type { AccessTokenClaims } from '@/infrastructure/jwt/jwt.service';
import { AuditService } from '@/infrastructure/audit/audit.service';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import type { InviteUserInput, ListUsersInput, UpdateUserRoleInput } from './users.dto';

/**
 * Pengelolaan anggota: undang, daftar, ubah peran, delegasi (FR-AUTH-03/04/07).
 * Pemanggilan tanpa delegasi → 403 (DESIGN.md §5.2).
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async invite(input: InviteUserInput, actor: AccessTokenClaims): Promise<PublicUser> {
    await this.assertCanManageUsers(actor);
    const division = this.resolveDivision(input.role, input.division);

    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('Email sudah terdaftar sebagai pengguna');
    }

    const created = await this.prisma.user.create({
      data: {
        email: input.email,
        full_name: input.fullName,
        role: input.role,
        division,
        is_active: true,
        can_manage_users: false,
        invited_at: new Date(),
        invited_by_id: actor.sub,
      },
    });
    await this.audit.log({
      action: 'USER_INVITED',
      actorId: actor.sub,
      targetId: created.id,
      metadata: { email: created.email, role: created.role, division },
    });
    return toPublicUser(created);
  }

  async list(query: ListUsersInput): Promise<{
    items: Array<PublicUser & { invitedAt: string | null; lastLoginAt: string | null }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, role, search } = query;
    const where = {
      ...(role ? { role } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' as const } },
              { full_name: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: rows.map((user) => ({
        ...toPublicUser(user),
        invitedAt: user.invited_at?.toISOString() ?? null,
        lastLoginAt: user.last_login_at?.toISOString() ?? null,
      })),
      total,
      page,
      limit,
    };
  }

  async updateRole(
    userId: string,
    input: UpdateUserRoleInput,
    actor: AccessTokenClaims,
  ): Promise<PublicUser> {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }
    const division = this.resolveDivision(input.role, input.division);
    const previousRole = target.role;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: input.role, division },
    });
    await this.audit.log({
      action: 'ROLE_CHANGED',
      actorId: actor.sub,
      targetId: userId,
      metadata: { previousRole, newRole: input.role, division },
    });
    return toPublicUser(updated);
  }

  async updateDelegation(
    userId: string,
    canManageUsers: boolean,
    actor: AccessTokenClaims,
  ): Promise<PublicUser> {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }
    if (canManageUsers && !DELEGATABLE_ROLES.includes(target.role)) {
      throw new BadRequestException(
        'Delegasi hanya bisa diberikan kepada Ketua Umum, Sekretaris, atau Bendahara',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { can_manage_users: canManageUsers },
    });
    await this.audit.log({
      action: 'DELEGATION_TOGGLED',
      actorId: actor.sub,
      targetId: userId,
      metadata: { canManageUsers, targetRole: target.role },
    });
    return toPublicUser(updated);
  }

  /** Superadmin atau pemegang flag delegasi (DESIGN.md §5.2) */
  private async assertCanManageUsers(actor: AccessTokenClaims): Promise<void> {
    if (actor.role === 'SUPERADMIN') {
      return;
    }
    const actorRecord = await this.prisma.user.findUnique({ where: { id: actor.sub } });
    if (!actorRecord || !actorRecord.can_manage_users) {
      throw new ForbiddenException('Anda tidak memiliki delegasi untuk mengelola anggota');
    }
  }

  /** Role DIV_* wajib punya divisi; role lain tidak boleh (DESIGN.md §4.1) */
  private resolveDivision(role: UserRole, division: Division | null | undefined): Division | null {
    const requiresDivision = DIVISION_ROLES.includes(role);
    if (requiresDivision && !division) {
      throw new BadRequestException(`Peran ${role} wajib memiliki divisi`);
    }
    if (!requiresDivision && division) {
      throw new BadRequestException(`Peran ${role} tidak boleh memiliki divisi`);
    }
    return division ?? null;
  }
}
