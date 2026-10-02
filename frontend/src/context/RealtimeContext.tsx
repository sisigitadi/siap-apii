import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { apiClient } from '@/api/client';

interface RealtimeContextType {
  isConnected: boolean;
  liveNotifications: LiveNotification[];
  clearNotifications: () => void;
}

export interface LiveNotification {
  id: string;
  event: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { info, success } = useToast();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [liveNotifications, setLiveNotifications] = useState<LiveNotification[]>([]);

  const clearNotifications = useCallback(() => {
    setLiveNotifications([]);
  }, []);

  useEffect(() => {
    // Only connect if user is authenticated
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Namespace gateway backend: `/v1/stream/events` (DESIGN.md §7). Namespace
    // diberikan lewat URL (bukan via opsi `path`) — transport socket.io tetap
    // di `/socket.io` agar cocok dengan backend
    // (@WebSocketGateway({ namespace: '/v1/stream/events' })), yang dilayani di
    // `/socket.io/v1/stream/events`. Vite mem-proxy `/socket.io` ke :3000.
    // Otentikasi via JWT di handshake socket.io (field `auth.token`).
    const token = apiClient.getAccessToken();
    const socketUrl = window.location.origin;
    const newSocket = io(`${socketUrl}/v1/stream/events`, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      withCredentials: true,
      auth: token ? { token } : undefined,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      // Room `public`, `role:<peran>`, dan `division:<divisi>` sudah di-assign
      // otomatis oleh gateway dari klaim JWT — tidak perlu join manual.
    });

    newSocket.on('UNAUTHORIZED', (data: unknown) => {
      setIsConnected(false);
      info('Real-time', String((data as { message?: string })?.message || 'Otentikasi WebSocket ditolak.'));
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Handle generic events
    const handleIncomingEvent = (event: string, data: Record<string, unknown>) => {
      const notifItem: LiveNotification = {
        id: Math.random().toString(36).substring(2, 9),
        event,
        payload: data,
        timestamp: new Date().toISOString(),
      };
      setLiveNotifications((prev) => [notifItem, ...prev.slice(0, 19)]);

      if (event === 'DOCUMENT_PUBLISHED') {
        success('Surat Resmi Diterbitkan!', String(data?.title || 'Surat telah ditandatangani dan dirilis ke publik.'));
      } else if (event === 'CASHBOOK_MUTATED') {
        success(
          'Mutasi Buku Kas',
          `Voucher ${data?.voucherNumber ? String(data.voucherNumber) : '-'} (${data?.type === 'INFLOW' ? 'Kas Masuk' : 'Kas Keluar'})`,
        );
      } else if (event === 'PROGRAM_APPROVED') {
        success('Program Kerja Disetujui!', String(data?.title || 'Usulan telah disetujui pimpinan.'));
      }
    };

    newSocket.on('DOCUMENT_PUBLISHED', (data) => handleIncomingEvent('DOCUMENT_PUBLISHED', data));
    newSocket.on('CASHBOOK_MUTATED', (data) => handleIncomingEvent('CASHBOOK_MUTATED', data));
    newSocket.on('PROGRAM_APPROVED', (data) => handleIncomingEvent('PROGRAM_APPROVED', data));
    newSocket.on('AUDIT_SECURITY', (data) => handleIncomingEvent('AUDIT_SECURITY', data));

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  return (
    <RealtimeContext.Provider value={{ isConnected, liveNotifications, clearNotifications }}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error('useRealtime must be used within RealtimeProvider');
  return context;
};
