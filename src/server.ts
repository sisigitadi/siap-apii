import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'node:path';
import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { appConfigToken, type AppConfig } from './config/app.config';

/**
 * Entry point tunggal (Vercel server function / `npm run start:prod`).
 * Konvensi: logika cross-cutting express (helmet, cookie, CORS, prefix, OpenAPI)
 * ada di sini; wiring DI (guard/pipe/filter/interceptor global) ada di AppModule.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const config = app.get<AppConfig>(appConfigToken) as AppConfig;

  app.useLogger(
    config.isProduction ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose'],
  );

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');

  // Sajikan folder `storage` secara statis (lampiran upload & PDF final surat).
  // Di production Vercel, folder ini read-only — gunakan CDN/storage eksternal
  // (DESIGN.md §11); di development ini cukup.
  app.useStaticAssets(join(process.cwd(), 'storage'));

  app.enableCors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
    credentials: true,
  });

  const documentConfig = new DocumentBuilder()
    .setTitle('SIAP APII')
    .setDescription('Backend API SIAP APII — Yayasan APII DPW Jabodetabek')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, documentConfig);
  SwaggerModule.setup('api/v1/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(config.PORT);
  Logger.log(`SIAP APII listening on :${config.PORT} (${config.NODE_ENV})`, 'Bootstrap');
  Logger.log(`OpenAPI:  http://localhost:${config.PORT}/api/v1/docs`, 'Bootstrap');
}

void bootstrap().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Gagal bootstrap:', error);
  process.exit(1);
});
