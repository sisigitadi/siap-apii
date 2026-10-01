import {
  Inject,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { Redis } from 'ioredis';
import { appConfigToken, type AppConfig } from '@/config/app.config';
import { JwtService } from '@/infrastructure/jwt/jwt.service';
import { RedisService } from '@/infrastructure/redis/redis.service';
import {
  PUBLIC_ROOM,
  WS_CHANNEL,
  WS_NAMESPACE,
  WsEnvelope,
  divisionRoom,
  roleRoom,
} from './websocket.constants';

type HandshakeAuth = { token?: string };

/**
 * Mengambil JWT dari handshake socket.io (DESIGN.md §7: "otentikasi via JWT
 * di handshake"). Mendukung `auth.token` (socket.io v4, cara resmi) dan
 * `query.token` untuk klien lawas.
 */
function extractHandshakeToken(client: Socket): string | null {
  const auth = (client.handshake.auth ?? {}) as HandshakeAuth;
  if (auth.token) {
    return auth.token;
  }
  const query = (client.handshake.query ?? {}) as Record<string, string | string[]>;
  const queryToken = query.token;
  if (typeof queryToken === 'string') {
    return queryToken;
  }
  return null;
}

/**
 * Gateway event bus real-time (DESIGN.md §7).
 *
 * Gateway hanya meneruskan event — tidak ada logika bisnis (PROJECT_RULES.md
 * §2.3). Setiap koneksi diotentikasi via JWT, asalnya dicek terhadap
 * CORS_ORIGINS, lalu digabungkan ke room: `public` (semua), `role:<peran>`,
 * dan `division:<divisi>` (§7.1).
 */
@WebSocketGateway({ namespace: WS_NAMESPACE, cors: { credentials: true, origin: true } })
export class EventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(EventsGateway.name);
  private subscriber: Redis | null = null;

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    @Inject(appConfigToken) private readonly config: AppConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    // Berlangganan channel event bus; event dari instance manapun dipancarkan
    // ulang ke socket lokal pada room tujuan (konsistensi lintas instance).
    this.subscriber = await this.redis.subscribe(WS_CHANNEL, (raw) => {
      this.handleBusMessage(raw);
    });
    this.logger.log(`Berlangganan event bus Redis channel "${WS_CHANNEL}"`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit();
    this.subscriber = null;
  }

  private handleBusMessage(raw: string): void {
    try {
      const envelope = JSON.parse(raw) as WsEnvelope<Record<string, unknown>>;
      for (const room of envelope.rooms) {
        this.server.to(room).emit(envelope.event, envelope.payload);
      }
    } catch (error: unknown) {
      // Pesan rusak tidak boleh memutuskan langganan event bus.
      this.logger.error(`Gagal meneruskan event bus: ${String(error)}`);
    }
  }

  async handleConnection(client: Socket): Promise<void> {
    const reject = (message: string): void => {
      client.emit('UNAUTHORIZED', { message });
      client.disconnect(true);
      this.logger.warn(`Koneksi WebSocket ditolak: ${message}`);
    };

    const origin = client.handshake.headers.origin ?? null;
    if (origin && this.config.corsOrigins.length > 0 && !this.config.corsOrigins.includes(origin)) {
      reject(`Origin tidak diizinkan: ${origin}`);
      return;
    }

    try {
      const token = extractHandshakeToken(client);
      if (!token) {
        throw new UnauthorizedException('Token otentikasi tidak ditemukan di handshake');
      }
      const claims = this.jwt.verifyAccessToken(token);

      const rooms = [PUBLIC_ROOM, roleRoom(claims.role)];
      if (claims.division) {
        rooms.push(divisionRoom(claims.division));
      }
      await client.join(rooms);
      client.emit('CONNECTED', { rooms });
      this.logger.debug(
        `Socket ${client.id} bergabung ke ${rooms.length} room (role: ${claims.role})`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Otentikasi WebSocket gagal';
      reject(message);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    this.logger.debug(`Socket ${client.id} terputus`);
  }
}
