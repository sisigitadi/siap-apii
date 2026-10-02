import { apiClient } from './client';
import { DocumentVerification, MemberCard, PublicFeedItem, PublicSchedule } from './types';

export const publicApi = {
  async verifyDocument(sha256: string): Promise<DocumentVerification> {
    const res = await apiClient.get<DocumentVerification>(`/public/verify/${sha256}`);
    if (!res.success) throw new Error(res.error?.message || 'Dokumen tidak ditemukan atau tidak valid');
    return res.data;
  },

  async getPublicFeed(page = 1, limit = 10): Promise<{ items: PublicFeedItem[]; total: number }> {
    const res = await apiClient.get<{ items: PublicFeedItem[]; total: number }>(`/public/feed?page=${page}&limit=${limit}`);
    if (!res.success) throw new Error(res.error?.message || 'Gagal memuat warta publik');
    return res.data;
  },

  async getPublicSchedules(): Promise<{ items: PublicSchedule[]; total: number }> {
    const res = await apiClient.get<{ items: PublicSchedule[]; total: number }>('/public/schedules');
    if (!res.success) throw new Error(res.error?.message || 'Gagal memuat jadwal kegiatan');
    return res.data;
  },

  async getMyMemberCard(): Promise<MemberCard> {
    const res = await apiClient.get<MemberCard>('/public/members/me/e-kta');
    if (!res.success) throw new Error(res.error?.message || 'Gagal memuat e-KTA Anda');
    return res.data;
  },
};
