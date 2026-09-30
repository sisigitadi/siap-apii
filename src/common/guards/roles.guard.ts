import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { ROLES_KEY } from '@/common/decorators/roles.decorator';

/**
 * RBAC sederhana: periksa `role` dari token terhadap daftar @Roles(...).
 * Wajib didahului JwtAuthGuard (PROJECT_RULES.md §3.1).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.user) {
      throw new UnauthorizedException('Otentikasi diperlukan');
    }
    return required.includes(request.user.role);
  }
}
