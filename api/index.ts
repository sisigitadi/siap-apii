import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { appConfigToken, type AppConfig } from '../src/config/app.config';

const server: Express = express();
let isAppInitialized = false;

async function bootstrapServer(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(server),
    { bufferLogs: true },
  );

  const config = app.get<AppConfig>(appConfigToken) as AppConfig;

  app.useLogger(
    config.isProduction ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose'],
  );

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
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

  await app.init();
  isAppInitialized = true;
  Logger.log('NestJS serverless instance initialized on Vercel', 'Bootstrap');
}

export default async function handler(req: Request, res: Response): Promise<void> {
  if (!isAppInitialized) {
    await bootstrapServer();
  }
  server(req, res);
}

