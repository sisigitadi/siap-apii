import { Injectable } from '@nestjs/common';
import { RedisService } from '@/infrastructure/redis/redis.service';
import {
  AuditSecurityPayload,
  CashbookMutatedPayload,
  DocumentPublishedPayload,
  ProgramApprovedPayload,
  PUBLIC_ROOM,
  WS_CHANNEL,
  WsEnvelope,
  WsEvent,
  divisionRoom,
  roleRoom,
} from './websocket.constants';

/**
 * Pintu tunggal untuk memancarkan event real-time (DESIGN.md §7.2).
 *
 * Service bisnis tidak perlu tahu room tujuan — pemetaan event → room
 * ada di sini. Event diterbitkan ke Redis channel `ws:events`; setiap
 * `EventsGateway` di setiap instance meneruskannya ke socket pada room
 * yang berhak (sehingga konsisten lintas instance Vercel).
 */
@Injectable()
export class EventsBusService {
  constructor(private readonly redis: RedisService) {}

  /** Ketua menyetujui usulan divisi → `public` + `division:<x>` */
  async emitProgramApproved(payload: ProgramApprovedPayload): Promise<void> {
    await this.publish(
      WsEvent.PROGRAM_APPROVED,
      [PUBLIC_ROOM, divisionRoom(payload.division)],
      payload,
    );
  }

  /** SK dirilis → `public` */
  async emitDocumentPublished(payload: DocumentPublishedPayload): Promise<void> {
    await this.publish(WsEvent.DOCUMENT_PUBLISHED, [PUBLIC_ROOM], payload);
  }

  /** Buku kas terverifikasi (masuk buku kas) → bendahara + pengawas */
  async emitCashbookMutated(payload: CashbookMutatedPayload): Promise<void> {
    await this.publish(
      WsEvent.CASHBOOK_MUTATED,
      [roleRoom('BENDAHARA'), roleRoom('PENGAWAS')],
      payload,
    );
  }

  /** Pelanggaran keamanan (mis. 403 lintas divisi) → superadmin + pengawas */
  async emitAuditSecurity(payload: AuditSecurityPayload): Promise<void> {
    await this.publish(
      WsEvent.AUDIT_SECURITY,
      [roleRoom('SUPERADMIN'), roleRoom('PENGAWAS')],
      payload,
    );
  }

  private async publish<TPayload>(
    event: WsEvent,
    rooms: string[],
    payload: TPayload,
  ): Promise<void> {
    const envelope: WsEnvelope<TPayload> = { event, rooms, payload };
    await this.redis.publish(WS_CHANNEL, JSON.stringify(envelope));
  }
}
