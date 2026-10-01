import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createTestApp } from '../test/support/create-test-app';

async function exportOpenApi(): Promise<void> {
  const { app } = await createTestApp();

  const documentConfig = new DocumentBuilder()
    .setTitle('SIAP APII')
    .setDescription('Backend API SIAP APII — Yayasan APII DPW Jabodetabek')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig);
  const outputPath = resolve(process.cwd(), 'docs', 'openapi.json');

  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');

  console.log(`OpenAPI specification exported to: ${outputPath}`);
  await app.close();
}

void exportOpenApi().catch((err) => {
  console.error('Failed to export OpenAPI specification:', err);
  process.exit(1);
});
