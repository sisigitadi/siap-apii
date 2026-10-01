import { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as crypto from 'node:crypto';
import { JwtService } from '@/infrastructure/jwt/jwt.service';
import { bearer, createTestApp, type TestSetup } from './support/create-test-app';
import type { OfficialLetterRecord, UserRecord } from './support/in-memory-prisma';

/**
 * E2E portal publik (Fase 3) + kontrak envelope (DESIGN §8.2).
 * Disclaimer: Docker/Postgres tidak tersedia di environment ini, sehingga
 * Prisma & Redis diganti dengan in-memory — lihat support/create-test-app.ts.
 */
describe('PublicPortal (e2e)', () => {
  let setup: TestSetup;
  let app: INestApplication;
  let jwt: JwtService;

  const publishedLetter: OfficialLetterRecord = {
    id: crypto.randomUUID(),
    letter_number: 'SK/01/2026/001',
    title: 'Pengangkatan Pengurus Harian',
    letter_type: 'SK',
    content_payload: { blocks: [] },
    kop_config: { title: 'Yayasan APII DPW Jabodetabek' },
    signatories: [],
    sha256_hash: crypto.createHash('sha256').update('published-pdf-bytes').digest('hex'),
    qr_verify_url: 'http://localhost:5173/verify/dummy',
    status: 'PUBLISHED',
    rejection_note: null,
    pdf_storage_url: 's3://bucket/sk-001.pdf',
    created_by_id: crypto.randomUUID(),
    approved_by_id: crypto.randomUUID(),
    published_at: new Date('2026-09-01T00:00:00Z'),
    created_at: new Date('2026-09-01T00:00:00Z'),
    updated_at: new Date('2026-09-01T00:00:00Z'),
  };

  const draftLetter: OfficialLetterRecord = {
    ...publishedLetter,
    id: crypto.randomUUID(),
    letter_number: 'SK/01/2026/002',
    title: 'Rahasia Internal',
    sha256_hash: crypto.createHash('sha256').update('draft-pdf-bytes').digest('hex'),
    status: 'DRAFT',
    published_at: null,
  };

  const member: UserRecord = {
    id: crypto.randomUUID(),
    email: 'anggota@example.com',
    full_name: 'Budi Anggota',
    role: UserRole.PUBLIK_ANGGOTA,
    division: null,
    is_active: true,
    can_manage_users: false,
    profile_picture_url: null,
    member_number: 'APII-2026-0001',
    member_since: new Date('2026-01-01T00:00:00Z'),
    card_issued_at: new Date('2026-01-01T00:00:00Z'),
    card_expires_at: null,
    invited_by_id: null,
    invited_at: null,
    last_login_at: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };

  beforeAll(async () => {
    setup = await createTestApp();
    app = setup.app;
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/public/feed', () => {
    it('mengembalikan envelope standar & hanya surat PUBLISHED', async () => {
      setup.prisma.officialLetters.set(publishedLetter.id, publishedLetter);
      setup.prisma.officialLetters.set(draftLetter.id, draftLetter);

      const response = await setup.request.get('/api/v1/public/feed?page=1&limit=10');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        code: 200,
        message: 'Resource successfully fetched',
      });
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0]).toMatchObject({
        letter_number: 'SK/01/2026/001',
        title: 'Pengangkatan Pengurus Harian',
      });
      expect(response.body.data.total).toBe(1);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(10);
      expect(response.body.data.totalPages).toBe(1);
    });

    it('query limit > 50 → 400 (ZodValidationPipe)', async () => {
      const response = await setup.request.get('/api/v1/public/feed?limit=100');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ success: false, code: 400, data: null });
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('GET /api/v1/public/verify/:sha256', () => {
    it('hash valid & PUBLISHED → verified true', async () => {
      const response = await setup.request.get(
        `/api/v1/public/verify/${publishedLetter.sha256_hash}`,
      );

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        verified: true,
        letter_number: 'SK/01/2026/001',
        title: 'Pengangkatan Pengurus Harian',
        sha256: publishedLetter.sha256_hash,
      });
    });

    it('hash valid tetapi DRAFT → verified false tanpa membocorkan metadata', async () => {
      const response = await setup.request.get(`/api/v1/public/verify/${draftLetter.sha256_hash}`);

      expect(response.status).toBe(200);
      expect(response.body.data.verified).toBe(false);
      expect(response.body.data.letter_number).toBeNull();
      expect(response.body.data.title).toBeNull();
    });

    it('hash tidak ada di DB → verified false', async () => {
      const unknown = crypto.createHash('sha256').update('tidak-ada').digest('hex');
      const response = await setup.request.get(`/api/v1/public/verify/${unknown}`);

      expect(response.status).toBe(200);
      expect(response.body.data.verified).toBe(false);
    });

    it('bukan hex 64 karakter → 400', async () => {
      const response = await setup.request.get('/api/v1/public/verify/bukan-sha256');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/public/members/me/e-kta', () => {
    it('tanpa token → 401 envelope', async () => {
      const response = await setup.request.get('/api/v1/public/members/me/e-kta');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ success: false, code: 401, data: null });
    });

    it('token PUBLIK_ANGGOTA → kartu dengan masa berlaku 5 tahun', async () => {
      setup.prisma.users.set(member.id, member);
      const accessToken = jwt.signAccessToken({
        id: member.id,
        email: member.email,
        role: member.role,
        division: null,
      });

      const response = await setup.request
        .get('/api/v1/public/members/me/e-kta')
        .set('Authorization', bearer(accessToken));

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        member_number: 'APII-2026-0001',
        full_name: 'Budi Anggota',
        email: 'anggota@example.com',
        status: 'ACTIVE',
        qr_verify_url: 'http://localhost:5173/verify/member/APII-2026-0001',
      });
      // card_issued_at 2026-01-01 + 5 tahun (MEMBER_CARD_VALIDITY_YEARS) → 2031
      expect(response.body.data.expires_at).toContain('2031');
    });

    it('token SEKRETARIS → 403 (RolesGuard)', async () => {
      const sekretaris: UserRecord = {
        ...member,
        id: crypto.randomUUID(),
        email: 'sekretaris@example.com',
        full_name: 'Siti Sekretaris',
        role: UserRole.SEKRETARIS,
      };
      setup.prisma.users.set(sekretaris.id, sekretaris);
      const accessToken = jwt.signAccessToken({
        id: sekretaris.id,
        email: sekretaris.email,
        role: sekretaris.role,
        division: null,
      });

      const response = await setup.request
        .get('/api/v1/public/members/me/e-kta')
        .set('Authorization', bearer(accessToken));

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('signature tidak valid → 401', async () => {
      const accessToken = jwt.signAccessToken({
        id: member.id,
        email: member.email,
        role: member.role,
        division: null,
      });
      const segments = accessToken.split('.');
      const forgedToken = `${segments[0]}.${segments[1]}.${segments[2].slice(0, -4)}AAAA`;

      const response = await setup.request
        .get('/api/v1/public/members/me/e-kta')
        .set('Authorization', bearer(forgedToken));

      expect(response.status).toBe(401);
    });
  });
});
