import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuditService } from '@/infrastructure/audit/audit.service';
import { EventsBusService } from '@/infrastructure/websocket/events-bus.service';
import type { AccessTokenClaims } from '@/infrastructure/jwt/jwt.service';
import { DivisionGuard } from './division.guard';

function makeClaims(role: AccessTokenClaims['role'], division: string | null): AccessTokenClaims {
  return {
    sub: 'user-1',
    email: 'admin@apii-jabo.id',
    role,
    division: division as AccessTokenClaims['division'],
    jti: 'jti-1',
    iat: 1,
    exp: 2,
    typ: 'access',
  };
}

function makeExecutionContext(user: AccessTokenClaims | undefined): ExecutionContext {
  const request = {
    user,
    originalUrl: '/api/v1/letters?division=DIV_LITBANG',
    ip: '203.0.113.10',
    headers: { 'user-agent': 'jest-agent' },
  } as unknown as Request;

  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () =>
      function handler() {
        /* metadata proxy */
      },
    getClass: () =>
      class HandlerClass {
        /* metadata proxy */
      },
  } as unknown as ExecutionContext;
}

describe('DivisionGuard', () => {
  let guard: DivisionGuard;
  let reflector: Reflector;
  let auditLog: jest.Mock;
  let emitAuditSecurity: jest.Mock;

  beforeEach(() => {
    reflector = new Reflector();
    auditLog = jest.fn().mockResolvedValue(undefined);
    emitAuditSecurity = jest.fn().mockResolvedValue(undefined);
    const audit = { log: auditLog } as unknown as AuditService;
    const eventsBus = {
      emitAuditSecurity,
    } as unknown as EventsBusService;
    guard = new DivisionGuard(reflector, audit, eventsBus);
  });

  function setRequiredDivision(division: string | undefined): void {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(division);
  }

  it('mengizinkan tanpa metadata @Division', async () => {
    setRequiredDivision(undefined);
    await expect(
      guard.canActivate(makeExecutionContext(makeClaims('KETUA_DIVISI', 'DIV_HUMAS'))),
    ).resolves.toBe(true);
    expect(auditLog).not.toHaveBeenCalled();
    expect(emitAuditSecurity).not.toHaveBeenCalled();
  });

  it('mengizinkan peran tingkat wilaya melintasi divisi', async () => {
    setRequiredDivision('DIV_LITBANG');
    await expect(
      guard.canActivate(makeExecutionContext(makeClaims('SEKRETARIS', null))),
    ).resolves.toBe(true);
    expect(auditLog).not.toHaveBeenCalled();
    expect(emitAuditSecurity).not.toHaveBeenCalled();
  });

  it('mengizinkan admin divisi yang divisinya cocok', async () => {
    setRequiredDivision('DIV_HUMAS');
    await expect(
      guard.canActivate(makeExecutionContext(makeClaims('KETUA_DIVISI', 'DIV_HUMAS'))),
    ).resolves.toBe(true);
  });

  it('menolak admin divisi lain & mencatat CROSS_DIVISION_DENIED', async () => {
    setRequiredDivision('DIV_LITBANG');
    const claims = makeClaims('KETUA_DIVISI', 'DIV_HUMAS');

    await expect(guard.canActivate(makeExecutionContext(claims))).rejects.toThrow(
      ForbiddenException,
    );

    expect(auditLog).toHaveBeenCalledTimes(1);
    expect(auditLog).toHaveBeenCalledWith({
      action: 'CROSS_DIVISION_DENIED',
      actorId: claims.sub,
      resource: '/api/v1/letters?division=DIV_LITBANG',
      ipAddress: '203.0.113.10',
      userAgent: 'jest-agent',
      metadata: {
        requiredDivision: 'DIV_LITBANG',
        userDivision: 'DIV_HUMAS',
        userRole: 'KETUA_DIVISI',
      },
    });
    expect(emitAuditSecurity).toHaveBeenCalledWith({
      userId: claims.sub,
      endpoint: '/api/v1/letters?division=DIV_LITBANG',
      timestamp: expect.any(String),
    });
  });

  it('menolak anggota publik tanpa divisi & mencatat audit', async () => {
    setRequiredDivision('DIV_HUMAS');
    const claims = makeClaims('ANGGOTA_BIASA', null);

    await expect(guard.canActivate(makeExecutionContext(claims))).rejects.toThrow(
      'Akses divisi ditolak',
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CROSS_DIVISION_DENIED', actorId: claims.sub }),
    );
  });
});
