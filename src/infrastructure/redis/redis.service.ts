import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import type { AppConfig } from '@/config/app.config';
import { appConfigToken } from '@/config/app.config';
import { Inject } from '@nestjs/common';

/**
 * Redis dipakai untuk: cache, blacklist jti refresh token, PKCE state OAuth,
 * dan stream audit keamanan (DESIGN.md §5.3 & §7.1).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(@Inject(appConfigToken) config: AppConfig) {
    this.client = new Redis(config.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    this.logger.log('Terhubung ke Redis');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async setEx(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  /** Pub/sub WebSocket event bus (dipakai penuh di Fase 3) */
  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message);
  }

  /** Tambahkan entry ke Redis stream (mis. audit keamanan, DESIGN.md §5.3) */
  async xAdd(stream: string, fields: Record<string, string>): Promise<void> {
    await this.client.xadd(stream, '*', ...Object.entries(fields).flat());
  }
}
