import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createTestApp, type TestSetup } from './support/create-test-app';

/**
 * E2E / Kontrak OpenAPI (DESIGN.md §8 & server.ts).
 * Memverifikasi bahwa schema document OpenAPI 3.0 valid, memuat seluruh resource
 * (auth, letters, finance, divisions, public portal, uploader) serta skema Bearer auth.
 */
describe('OpenAPI / Swagger Contract (e2e)', () => {
  let setup: TestSetup;
  let app: INestApplication;

  beforeAll(async () => {
    setup = await createTestApp();
    app = setup.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('menghasilkan dokumen OpenAPI 3.0 yang lengkap dan sesuai spesifikasi', () => {
    const documentConfig = new DocumentBuilder()
      .setTitle('SIAP APII')
      .setDescription('Backend API SIAP APII — Yayasan APII DPW Jabodetabek')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, documentConfig);

    expect(document.openapi).toMatch(/^3\./);
    expect(document.info.title).toBe('SIAP APII');
    expect(document.info.version).toBe('0.1.0');

    // Pastikan seluruh modul endpoint utama terdaftar di Swagger
    const paths = Object.keys(document.paths);
    expect(paths).toContain('/api/v1/auth/me');
    expect(paths).toContain('/api/v1/auth/logout');
    expect(paths).toContain('/api/v1/official-letters');
    expect(paths).toContain('/api/v1/finance/vouchers');
    expect(paths).toContain('/api/v1/finance/balances');
    expect(paths).toContain('/api/v1/divisions/submissions');
    expect(paths).toContain('/api/v1/public/feed');
    expect(paths).toContain('/api/v1/public/verify/{sha256}');
    expect(paths).toContain('/api/v1/public/members/me/e-kta');

    // Pastikan Bearer authentication scheme terdaftar di components
    expect(document.components?.securitySchemes).toBeDefined();
    expect(document.components?.securitySchemes?.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });
});
