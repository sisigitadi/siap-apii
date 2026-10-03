import { INestApplication } from '@nestjs/common';
import { Division, UserRole } from '@prisma/client';
import * as crypto from 'node:crypto';
import { JwtService } from '@/infrastructure/jwt/jwt.service';
import { bearer, createTestApp, type TestSetup } from './support/create-test-app';
import type { UserRecord } from './support/in-memory-prisma';

/**
 * E2E alur otentikasi & RBAC (DESIGN §4.5 & §5.3):
 * - access token RS256 nyata di-sign & diverifikasi oleh JwtService
 * - RolesGuard membatasi endpoint per peran
 * - DivisionGuard menolak akses lintas divisi & memicu audit security
 *   (audit_logs + Redis stream `audit:security` + publish event bus)
 */
describe('Auth & RBAC (e2e)', () => {
  let setup: TestSetup;
  let app: INestApplication;
  let jwt: JwtService;

  const bendahara: UserRecord = {
    id: crypto.randomUUID(),
    email: 'bendahara@example.com',
    full_name: 'Budi Bendahara',
    role: UserRole.BENDAHARA,
    division: Division.DIV_UMUM,
    is_active: true,
    can_manage_users: false,
    profile_picture_url: null,
    member_number: null,
    member_since: null,
    card_issued_at: null,
    card_expires_at: null,
    invited_by_id: null,
    invited_at: null,
    last_login_at: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };

  const ketua: UserRecord = {
    ...bendahara,
    id: crypto.randomUUID(),
    email: 'ketum@example.com',
    full_name: 'Ketua',
    role: UserRole.KETUA,
    division: null,
  };

  const pembina: UserRecord = {
    ...bendahara,
    id: crypto.randomUUID(),
    email: 'pembina@example.com',
    full_name: 'Pembina',
    role: UserRole.PEMBINA,
    division: null,
  };

  beforeAll(async () => {
    setup = await createTestApp();
    app = setup.app;
    jwt = app.get(JwtService);
    setup.prisma.users.set(bendahara.id, bendahara);
    setup.prisma.users.set(ketua.id, ketua);
    setup.prisma.users.set(pembina.id, pembina);
  });

  afterAll(async () => {
    await app.close();
  });

  const tokenFor = (user: UserRecord): string =>
    jwt.signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      division: user.division,
    });

  describe('GET /api/v1/auth/me', () => {
    it('tanpa token → 401', async () => {
      const response = await setup.request.get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe(401);
    });

    it('token valid → profil (camelCase PublicUser)', async () => {
      const response = await setup.request
        .get('/api/v1/auth/me')
        .set('Authorization', bearer(tokenFor(bendahara)));

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: bendahara.id,
        email: 'bendahara@example.com',
        fullName: 'Budi Bendahara',
        role: 'BENDAHARA',
        division: 'DIV_UMUM',
      });
    });

    it('token valid dari cookie access_token juga diterima', async () => {
      const response = await setup.request
        .get('/api/v1/auth/me')
        .set('Cookie', `apii_access_token=${tokenFor(bendahara)}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(bendahara.id);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('token valid → revoked true + cookie di-clear', async () => {
      const response = await setup.request
        .post('/api/v1/auth/logout')
        .set('Authorization', bearer(tokenFor(bendahara)));

      expect(response.status).toBe(201);
      expect(response.body.data).toEqual({ revoked: true });
      expect(response.body.message).toBe('Resource successfully created');
      // Audit LOGOUT wajib tercatat (DESIGN §5.3)
      expect(
        setup.prisma.auditLogs.some((log: { action: string }) => log.action === 'LOGOUT'),
      ).toBe(true);
    });
  });

  describe('GET /api/v1/users (Roles)', () => {
    it('KETUA_DIVISI → 403 (hanya peran pimpinan)', async () => {
      const humas: UserRecord = {
        ...bendahara,
        id: crypto.randomUUID(),
        email: 'humas@example.com',
        full_name: 'Ketua Divisi Humas',
        role: UserRole.KETUA_DIVISI,
        division: Division.DIV_HUMAS,
      };
      setup.prisma.users.set(humas.id, humas);
      const response = await setup.request
        .get('/api/v1/users')
        .set('Authorization', bearer(tokenFor(humas)));

      expect(response.status).toBe(403);
    });

    it('KETUA → 200', async () => {
      const response = await setup.request
        .get('/api/v1/users')
        .set('Authorization', bearer(tokenFor(ketua)));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('PEMBINA → 200 (akses read-only atas seluruh dokumen & laporan organisasi)', async () => {
      const response = await setup.request
        .get('/api/v1/users')
        .set('Authorization', bearer(tokenFor(pembina)));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });
  });

  describe('Oversight read-only PEMBINA (DESIGN §5.1 — read-only atas dokumen & laporan)', () => {
    it('PEMBINA dapat melihat daftar surat resmi (GET /official-letters → 200)', async () => {
      const response = await setup.request
        .get('/api/v1/official-letters')
        .set('Authorization', bearer(tokenFor(pembina)));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('PEMBINA dapat melihat buku kas & voucher (GET /finance/vouchers → 200)', async () => {
      const response = await setup.request
        .get('/api/v1/finance/vouchers')
        .set('Authorization', bearer(tokenFor(pembina)));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('PEMBINA dilarang membuat surat (POST /official-letters → 403)', async () => {
      const response = await setup.request
        .post('/api/v1/official-letters')
        .set('Authorization', bearer(tokenFor(pembina)))
        .send({ letter_type: 'INTERNAL', title: 'x', body: 'x', recipient_name: 'x' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('PEMBINA dilarang membuat voucher kas (POST /finance/vouchers → 403)', async () => {
      const response = await setup.request
        .post('/api/v1/finance/vouchers')
        .set('Authorization', bearer(tokenFor(pembina)))
        .send({ flow_type: 'OUT', amount: 1000, description: 'x' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
});
