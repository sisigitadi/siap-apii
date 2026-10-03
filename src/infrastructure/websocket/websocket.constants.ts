import { Division, UserRole } from '@prisma/client';

/**
 * Event bus WebSocket real-time (DESIGN.md §7).
 *
 * Transport: Redis pub/sub channel `ws:events`. Setiap instance API
 * berlangganan channel ini, sehingga event yang dipancarkan dari instance
 * manapun sampai ke socket di semua instance (wajib di Vercel — koneksi
 * WebSocket ter-pin per instance, lihat DESIGN.md §11.3).
 */

/** Channel Redis pub/tempat event bus */
export const WS_CHANNEL = 'ws:events';

/** Namespace gateway (DESIGN.md §7: `wss://<host>/v1/stream/events`) */
export const WS_NAMESPACE = '/v1/stream/events';

/** Room publik — semua koneksi tergabung (termasuk portal publik) */
export const PUBLIC_ROOM = 'public';

/** Event yang dipancarkan ke frontend (DESIGN.md §7.2) */
export enum WsEvent {
  PROGRAM_APPROVED = 'PROGRAM_APPROVED',
  DOCUMENT_PUBLISHED = 'DOCUMENT_PUBLISHED',
  CASHBOOK_MUTATED = 'CASHBOOK_MUTATED',
  AUDIT_SECURITY = 'AUDIT_SECURITY',
}

/** Nama room role: `role:ketua` (DESIGN.md §7.1) */
export function roleRoom(role: UserRole): string {
  return `role:${role.toLowerCase()}`;
}

/** Nama room divisi: `division:DIV_DAKWAH` (DESIGN.md §7.1) */
export function divisionRoom(division: Division): string {
  return `division:${division}`;
}

/** Amplop event yang mengalir lewat Redis channel menuju gateway */
export interface WsEnvelope<TPayload> {
  event: WsEvent;
  rooms: string[];
  payload: TPayload;
}

/** Payload ringkas per event (DESIGN.md §7.2) */
export interface ProgramApprovedPayload {
  trackingId: string;
  division: Division;
  title: string;
}

export interface DocumentPublishedPayload {
  letterNumber: string;
  title: string;
  sha256: string;
}

export interface CashbookMutatedPayload {
  voucherNumber: string;
  type: 'INFLOW' | 'OUTFLOW';
  account: string;
}

export interface AuditSecurityPayload {
  userId: string;
  endpoint: string;
  timestamp: string;
}
