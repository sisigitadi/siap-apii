import { Test, TestingModule } from '@nestjs/testing';
import { Division } from '@prisma/client';
import { RedisService } from '@/infrastructure/redis/redis.service';
import {
  PUBLIC_ROOM,
  WS_CHANNEL,
  type WsEnvelope,
} from '@/infrastructure/websocket/websocket.constants';
import { EventsBusService } from './events-bus.service';

describe('EventsBusService', () => {
  let service: EventsBusService;
  let publish: jest.Mock;

  beforeEach(async () => {
    publish = jest.fn().mockResolvedValue(undefined);
    const redis = { publish } as unknown as RedisService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [EventsBusService, { provide: RedisService, useValue: redis }],
    }).compile();

    service = module.get<EventsBusService>(EventsBusService);
  });

  /** Bantu membaca amplop event yang diterbitkan ke Redis channel */
  function lastEnvelope<TPayload>(): WsEnvelope<TPayload> {
    expect(publish).toHaveBeenCalledWith(WS_CHANNEL, expect.any(String));
    const raw = publish.mock.calls.at(-1)?.[1] as string;
    return JSON.parse(raw) as WsEnvelope<TPayload>;
  }

  describe('emitProgramApproved', () => {
    it('should publish to public + division room', async () => {
      await service.emitProgramApproved({
        trackingId: '#REQ-2025-089',
        division: Division.DIV_DAKWAH,
        title: 'Safari Dakwah',
      });

      const envelope = lastEnvelope<{ trackingId: string }>();
      expect(envelope.event).toBe('PROGRAM_APPROVED');
      expect(envelope.rooms).toEqual([PUBLIC_ROOM, 'division:DIV_DAKWAH']);
      expect(envelope.payload).toEqual({
        trackingId: '#REQ-2025-089',
        division: Division.DIV_DAKWAH,
        title: 'Safari Dakwah',
      });
    });
  });

  describe('emitDocumentPublished', () => {
    it('should publish to public room only', async () => {
      await service.emitDocumentPublished({
        letterNumber: '042/SK-DPW/APII-JABO/III/2025',
        title: 'SK Pengangkatan',
        sha256: 'a'.repeat(64),
      });

      const envelope = lastEnvelope<{ letterNumber: string }>();
      expect(envelope.event).toBe('DOCUMENT_PUBLISHED');
      expect(envelope.rooms).toEqual([PUBLIC_ROOM]);
      expect(envelope.payload.letterNumber).toBe('042/SK-DPW/APII-JABO/III/2025');
    });
  });

  describe('emitCashbookMutated', () => {
    it('should publish to bendahara + dewan pengawas rooms', async () => {
      await service.emitCashbookMutated({
        voucherNumber: '088/KEU-APII/JABO/II/2025',
        type: 'OUTFLOW',
        account: 'BSI_GIRO',
      });

      const envelope = lastEnvelope<{ voucherNumber: string }>();
      expect(envelope.event).toBe('CASHBOOK_MUTATED');
      expect(envelope.rooms).toEqual(['role:bendahara', 'role:dewan_pengawas']);
      expect(envelope.payload.voucherNumber).toBe('088/KEU-APII/JABO/II/2025');
    });
  });

  describe('emitAuditSecurity', () => {
    it('should publish to superadmin + dewan pengawas rooms', async () => {
      await service.emitAuditSecurity({
        userId: 'user-1',
        endpoint: '/api/v1/divisions/submissions',
        timestamp: '2025-01-01T00:00:00.000Z',
      });

      const envelope = lastEnvelope<{ userId: string }>();
      expect(envelope.event).toBe('AUDIT_SECURITY');
      expect(envelope.rooms).toEqual(['role:superadmin', 'role:dewan_pengawas']);
      expect(envelope.payload.userId).toBe('user-1');
    });
  });
});
