import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { InMemoryPrisma } from './in-memory-prisma';
import { InMemoryRedis } from './in-memory-redis';

// Env WAJIB di-set sebelum AppModule di-evaluate (loadAppConfig baca process.env).
import './e2e-env';

/** `request(httpServer)` mengembalikan TestAgent (supertest >= 7). */
type TestAgentInstance = ReturnType<typeof request>;

export interface TestSetup {
  app: INestApplication;
  prisma: InMemoryPrisma;
  redis: InMemoryRedis;
  request: TestAgentInstance;
}

/**
 * Bootstrap aplikasi Nest lengkap (semua module + guard/pipe/filter/interceptor
 * global) dengan Prisma & Redis diganti implementasi in-memory. Middleware
 * cross-cutting (helmet, cookieParser, prefix, CORS) diset identik dengan
 * server.ts agar rute & header yang diuji sama dengan produksi.
 */
export async function createTestApp(): Promise<TestSetup> {
  const prisma = new InMemoryPrisma();
  const redis = new InMemoryRedis();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(RedisService)
    .useValue(redis)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: true, credentials: true });

  await app.init();

  return {
    app,
    prisma,
    redis,
    request: request(app.getHttpServer()),
  };
}

/** Helper: Authorization header Bearer untuk token yang diberikan. */
export function bearer(token: string): string {
  return `Bearer ${token}`;
}
