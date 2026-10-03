import { INestApplication } from '@nestjs/common';
import { Division, Prisma, SubmissionStatus, UserRole } from '@prisma/client';
import * as crypto from 'node:crypto';
import { JwtService } from '@/infrastructure/jwt/jwt.service';
import { bearer, createTestApp, type TestSetup } from './support/create-test-app';
import type { DivisionSubmissionRecord, UserRecord } from './support/in-memory-prisma';

/**
 * E2E Isolasi Divisi Mutlak & Dasbor Agregat (DESIGN §5.3 & §6.2).
 */
describe('Division Isolation (e2e)', () => {
  let setup: TestSetup;
  let app: INestApplication;
  let jwt: JwtService;

  const humasUser: UserRecord = {
    id: crypto.randomUUID(),
    email: 'humas@apii-jabo.id',
    full_name: 'Ketua Divisi Humas',
    role: UserRole.KETUA_DIVISI,
    division: Division.DIV_HUMAS,
    is_active: true,
    can_manage_users: false,
    profile_picture_url: null,
    member_number: 'APII-HUMAS-01',
    member_since: new Date('2026-01-01'),
    card_issued_at: new Date('2026-01-01'),
    card_expires_at: null,
    invited_by_id: null,
    invited_at: null,
    last_login_at: null,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  const litbangUser: UserRecord = {
    id: crypto.randomUUID(),
    email: 'litbang@apii-jabo.id',
    full_name: 'Ketua Divisi Litbang',
    role: UserRole.KETUA_DIVISI,
    division: Division.DIV_LITBANG,
    is_active: true,
    can_manage_users: false,
    profile_picture_url: null,
    member_number: 'APII-LITBANG-01',
    member_since: new Date('2026-01-01'),
    card_issued_at: new Date('2026-01-01'),
    card_expires_at: null,
    invited_by_id: null,
    invited_at: null,
    last_login_at: null,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  const ketumUser: UserRecord = {
    id: crypto.randomUUID(),
    email: 'ketum@apii-jabo.id',
    full_name: 'Ketua',
    role: UserRole.KETUA,
    division: null,
    is_active: true,
    can_manage_users: true,
    profile_picture_url: null,
    member_number: 'APII-KETUM-01',
    member_since: new Date('2026-01-01'),
    card_issued_at: new Date('2026-01-01'),
    card_expires_at: null,
    invited_by_id: null,
    invited_at: null,
    last_login_at: null,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  const humasSubmission: DivisionSubmissionRecord = {
    id: crypto.randomUUID(),
    tracking_id: '#REQ-2026-001',
    division: Division.DIV_HUMAS,
    program_title: 'Podcast Literasi Pajak',
    budget_estimate: new Prisma.Decimal('5000000'),
    target_audience: 'Mahasiswa',
    execution_date: new Date('2026-11-15T00:00:00Z'),
    submission_data: { description: 'Seri podcast' },
    attachments: [],
    status: SubmissionStatus.DRAFT,
    approval_notes: null,
    reviewed_by_id: null,
    reviewed_at: null,
    submitted_by_id: humasUser.id,
    created_at: new Date('2026-10-01T00:00:00Z'),
    updated_at: new Date('2026-10-01T00:00:00Z'),
  };

  const litbangSubmission: DivisionSubmissionRecord = {
    id: crypto.randomUUID(),
    tracking_id: '#REQ-2026-002',
    division: Division.DIV_LITBANG,
    program_title: 'Riset UMKM 2026',
    budget_estimate: new Prisma.Decimal('12000000'),
    target_audience: 'UMKM',
    execution_date: new Date('2026-12-01T00:00:00Z'),
    submission_data: { description: 'Survei' },
    attachments: [],
    status: SubmissionStatus.APPROVED,
    approval_notes: 'Disetujui',
    reviewed_by_id: ketumUser.id,
    reviewed_at: new Date('2026-10-02T00:00:00Z'),
    submitted_by_id: litbangUser.id,
    created_at: new Date('2026-10-01T00:00:00Z'),
    updated_at: new Date('2026-10-02T00:00:00Z'),
  };

  beforeAll(async () => {
    setup = await createTestApp();
    app = setup.app;
    jwt = app.get(JwtService);
  });

  beforeEach(() => {
    setup.prisma.clear();
    setup.redis.clear();

    setup.prisma.users.set(humasUser.id, humasUser);
    setup.prisma.users.set(litbangUser.id, litbangUser);
    setup.prisma.users.set(ketumUser.id, ketumUser);

    setup.prisma.divisionSubmissions.set(humasSubmission.id, humasSubmission);
    setup.prisma.divisionSubmissions.set(litbangSubmission.id, litbangSubmission);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/divisions/submissions', () => {
    it('Ketua Divisi Humas hanya melihat usulan divisi Humas', async () => {
      const token = jwt.signAccessToken({
        id: humasUser.id,
        email: humasUser.email,
        role: humasUser.role,
        division: humasUser.division,
      });

      const res = await setup.request
        .get('/api/v1/divisions/submissions')
        .set('Authorization', bearer(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].id).toBe(humasSubmission.id);
      expect(res.body.data.items[0].division).toBe(Division.DIV_HUMAS);
    });

    it('Ketua (CROSS_DIVISION_ROLES) dapat melihat seluruh usulan dari semua divisi', async () => {
      const token = jwt.signAccessToken({
        id: ketumUser.id,
        email: ketumUser.email,
        role: ketumUser.role,
        division: null,
      });

      const res = await setup.request
        .get('/api/v1/divisions/submissions')
        .set('Authorization', bearer(token));

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(2);
    });
  });

  describe('GET /api/v1/divisions/submissions/:id', () => {
    it('Ketua Divisi Humas dapat membaca usulan milik divisinya sendiri', async () => {
      const token = jwt.signAccessToken({
        id: humasUser.id,
        email: humasUser.email,
        role: humasUser.role,
        division: humasUser.division,
      });

      const res = await setup.request
        .get(`/api/v1/divisions/submissions/${humasSubmission.id}`)
        .set('Authorization', bearer(token));

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(humasSubmission.id);
    });

    it('Ketua Divisi Humas dilarang membaca usulan milik DIV_LITBANG (403 Forbidden)', async () => {
      const token = jwt.signAccessToken({
        id: humasUser.id,
        email: humasUser.email,
        role: humasUser.role,
        division: humasUser.division,
      });

      const res = await setup.request
        .get(`/api/v1/divisions/submissions/${litbangSubmission.id}`)
        .set('Authorization', bearer(token));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/divisions/submissions', () => {
    it('membuat usulan baru otomatis menyematkan divisi akun dan tracking_id #REQ-YYYY-NNN', async () => {
      const token = jwt.signAccessToken({
        id: humasUser.id,
        email: humasUser.email,
        role: humasUser.role,
        division: humasUser.division,
      });

      const res = await setup.request
        .post('/api/v1/divisions/submissions')
        .set('Authorization', bearer(token))
        .send({
          program_title: 'Kampanye Media Sosial Ramadhan',
          budget_estimate: 3500000,
          target_audience: 'Umum',
          execution_date: '2026-11-20',
          submission_data: { channels: ['Instagram'] },
          attachments: [],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.division).toBe(Division.DIV_HUMAS);
      expect(res.body.data.tracking_id).toMatch(/^#REQ-\d{4}-\d{3}$/);
      expect(res.body.data.status).toBe(SubmissionStatus.DRAFT);
    });
  });

  describe('GET /api/v1/divisions/dashboard/aggregate', () => {
    it('pengurus divisi biasa ditolak mengakses dashboard agregat (403)', async () => {
      const token = jwt.signAccessToken({
        id: humasUser.id,
        email: humasUser.email,
        role: humasUser.role,
        division: humasUser.division,
      });

      const res = await setup.request
        .get('/api/v1/divisions/dashboard/aggregate')
        .set('Authorization', bearer(token));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Ketua dapat mengakses statistik agregat 7 divisi', async () => {
      const token = jwt.signAccessToken({
        id: ketumUser.id,
        email: ketumUser.email,
        role: ketumUser.role,
        division: null,
      });

      const res = await setup.request
        .get('/api/v1/divisions/dashboard/aggregate')
        .set('Authorization', bearer(token));

      expect(res.status).toBe(200);
      expect(res.body.data.total_submissions).toBe(2);
      expect(res.body.data.divisions.DIV_HUMAS).toBe(1);
      expect(res.body.data.divisions.DIV_LITBANG).toBe(1);
    });
  });
});
