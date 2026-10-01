import { UnauthorizedException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { Socket } from 'socket.io';
import type { AppConfig } from '@/config/app.config';
import { JwtService } from '@/infrastructure/jwt/jwt.service';
import { RedisService } from '@/infrastructure/redis/redis.service';
import type { AccessTokenClaims } from '@/infrastructure/jwt/jwt.service';
import { PUBLIC_ROOM, WsEvent } from './websocket.constants';
import { EventsGateway } from './events.gateway';

type MockServer = {
  to: jest.Mock;
  emit: jest.Mock;
};

type MockSocket = {
  id: string;
  handshake: {
    auth?: Record<string, unknown>;
    query?: Record<string, unknown>;
    headers: Record<string, string | undefined>;
  };
  join: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
};

function makeClaims(role: AccessTokenClaims['role'], division: string | null): AccessTokenClaims {
  return {
    sub: 'user-1',
    email: 'admin@apii-jabo.id',
    role,
    division: division as AccessTokenClaims['division'],
    jti: 'jti-1',
    iat: 1,
    exp: 2,
    typ: 'access',
  };
}

function makeSocket(overrides: Partial<MockSocket> = {}): MockSocket {
  return {
    id: 'socket-1',
    handshake: { auth: {}, headers: {} },
    join: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
    ...overrides,
  };
}

describe('EventsGateway', () => {
  let gateway: EventsGateway;
  let server: MockServer;
  let onMessage: ((raw: string) => void) | undefined;
  let subscriber: { quit: jest.Mock };
  let verifyAccessToken: jest.Mock;
  let corsOrigins: string[];

  beforeEach(() => {
    server = { to: jest.fn().mockReturnValue({ emit: jest.fn() }), emit: jest.fn() };
    subscriber = { quit: jest.fn().mockResolvedValue(undefined) };
    onMessage = undefined;

    const subscribe = jest
      .fn()
      .mockImplementation(async (_channel: string, cb: (raw: string) => void) => {
        onMessage = cb;
        return subscriber as unknown as Redis;
      });
    const redis = { subscribe } as unknown as RedisService;

    verifyAccessToken = jest.fn();
    const jwt = { verifyAccessToken } as unknown as JwtService;

    corsOrigins = [];
    const config = { corsOrigins } as unknown as AppConfig;

    gateway = new EventsGateway(redis, jwt, config);
    // @WebSocketServer() diisi manual — tidak ada server socket.io asli di unit test
    (gateway as unknown as { server: MockServer }).server = server;
  });

  describe('onModuleInit', () => {
    it('should subscribe to the WebSocket event bus channel', async () => {
      await gateway.onModuleInit();
      expect(onMessage).toBeDefined();
    });

    it('should quit the subscriber on destroy', async () => {
      await gateway.onModuleInit();
      await gateway.onModuleDestroy();
      expect(subscriber.quit).toHaveBeenCalledTimes(1);
    });
  });

  describe('event bus fanout (Redis -> socket rooms)', () => {
    beforeEach(async () => {
      await gateway.onModuleInit();
    });

    it('should forward envelope payload to every target room', () => {
      onMessage?.(
        JSON.stringify({
          event: WsEvent.DOCUMENT_PUBLISHED,
          rooms: [PUBLIC_ROOM, 'role:ketua_umum'],
          payload: { letterNumber: '042/SK-DPW/APII-JABO/III/2025' },
        }),
      );

      expect(server.to).toHaveBeenCalledTimes(2);
      expect(server.to).toHaveBeenCalledWith(PUBLIC_ROOM);
      expect(server.to).toHaveBeenCalledWith('role:ketua_umum');
      expect(server.to(PUBLIC_ROOM).emit).toHaveBeenCalledWith(
        WsEvent.DOCUMENT_PUBLISHED,
        expect.objectContaining({ letterNumber: '042/SK-DPW/APII-JABO/III/2025' }),
      );
    });

    it('should ignore a malformed message without throwing', () => {
      expect(() => onMessage?.('not-json')).not.toThrow();
      expect(server.to).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should handle disconnect without error', async () => {
      const socket = makeSocket();
      await expect(gateway.handleDisconnect(socket as unknown as Socket)).resolves.toBeUndefined();
    });
  });

  describe('handleConnection', () => {
    beforeEach(async () => {
      await gateway.onModuleInit();
    });

    it('should join public, role, and division rooms with a valid token', async () => {
      verifyAccessToken.mockReturnValue(makeClaims('DIV_DAKWAH', 'DIV_DAKWAH'));
      const socket = makeSocket({ handshake: { auth: { token: 'valid' }, headers: {} } });

      await gateway.handleConnection(socket as unknown as Socket);

      expect(socket.join).toHaveBeenCalledWith([
        PUBLIC_ROOM,
        'role:div_dakwah',
        'division:DIV_DAKWAH',
      ]);
      expect(socket.emit).toHaveBeenCalledWith(
        'CONNECTED',
        expect.objectContaining({ rooms: expect.any(Array) }),
      );
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('should join only public + role rooms when user has no division', async () => {
      verifyAccessToken.mockReturnValue(makeClaims('BENDAHARA', null));
      const socket = makeSocket({ handshake: { auth: { token: 'valid' }, headers: {} } });

      await gateway.handleConnection(socket as unknown as Socket);

      expect(socket.join).toHaveBeenCalledWith([PUBLIC_ROOM, 'role:bendahara']);
    });

    it('should accept token from handshake query as fallback', async () => {
      verifyAccessToken.mockReturnValue(makeClaims('KETUA_UMUM', null));
      const socket = makeSocket({ handshake: { query: { token: 'valid' }, headers: {} } });

      await gateway.handleConnection(socket as unknown as Socket);

      expect(socket.join).toHaveBeenCalledWith([PUBLIC_ROOM, 'role:ketua_umum']);
    });

    it('should reject a connection without a token', async () => {
      const socket = makeSocket();

      await gateway.handleConnection(socket as unknown as Socket);

      expect(socket.emit).toHaveBeenCalledWith('UNAUTHORIZED', expect.any(Object));
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(verifyAccessToken).not.toHaveBeenCalled();
    });

    it('should reject a connection with an invalid token', async () => {
      verifyAccessToken.mockImplementation(() => {
        throw new UnauthorizedException('Signature token tidak valid');
      });
      const socket = makeSocket({ handshake: { auth: { token: 'bogus' }, headers: {} } });

      await gateway.handleConnection(socket as unknown as Socket);

      expect(socket.emit).toHaveBeenCalledWith(
        'UNAUTHORIZED',
        expect.objectContaining({ message: 'Signature token tidak valid' }),
      );
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('should reject a connection from a disallowed origin', async () => {
      corsOrigins.push('https://app.apii.sigitadi.id');
      verifyAccessToken.mockReturnValue(makeClaims('KETUA_UMUM', null));
      const socket = makeSocket({
        handshake: { auth: { token: 'valid' }, headers: { origin: 'https://evil.example' } },
      });

      await gateway.handleConnection(socket as unknown as Socket);

      expect(socket.emit).toHaveBeenCalledWith(
        'UNAUTHORIZED',
        expect.objectContaining({ message: expect.stringContaining('Origin tidak diizinkan') }),
      );
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('should allow an allowed origin', async () => {
      corsOrigins.push('https://app.apii.sigitadi.id');
      verifyAccessToken.mockReturnValue(makeClaims('KETUA_UMUM', null));
      const socket = makeSocket({
        handshake: {
          auth: { token: 'valid' },
          headers: { origin: 'https://app.apii.sigitadi.id' },
        },
      });

      await gateway.handleConnection(socket as unknown as Socket);

      expect(socket.join).toHaveBeenCalled();
      expect(socket.disconnect).not.toHaveBeenCalled();
    });
  });
});
