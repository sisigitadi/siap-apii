import { apiClient } from './client';
import { OfficialLetter, LetterStatus, LetterType, LetterSignatory } from './types';

export interface CreateLetterPayload {
  letter_number: string;
  type: LetterType;
  title: string;
  subject: string;
  regarding?: string;
  recipient: string;
  body_html: string;
  signatories: LetterSignatory[];
}

export interface UpdateLetterPayload {
  title?: string;
  subject?: string;
  regarding?: string;
  recipient?: string;
  body_html?: string;
  signatories?: LetterSignatory[];
}

export interface LettersListResponse {
  items: OfficialLetter[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const lettersApi = {
  async list(params: { status?: LetterStatus; search?: string; page?: number; limit?: number } = {}): Promise<LettersListResponse> {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.search) searchParams.set('search', params.search);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));

    const res = await apiClient.get<LettersListResponse>(`/official-letters?${searchParams.toString()}`);
    if (!res.success) throw new Error(res.error?.message || 'Gagal mengambil daftar surat');
    return res.data;
  },

  async getById(id: string): Promise<OfficialLetter> {
    const res = await apiClient.get<OfficialLetter>(`/official-letters/${id}`);
    if (!res.success) throw new Error(res.error?.message || 'Surat tidak ditemukan');
    return res.data;
  },

  async getHtmlPreview(id: string): Promise<string> {
    const res = await fetch(`/api/v1/official-letters/${id}/render-html`, {
      headers: {
        Authorization: `Bearer ${apiClient.getAccessToken()}`,
      },
      credentials: 'include',
    });
    return res.text();
  },

  async downloadPdf(id: string): Promise<Blob> {
    const res = await fetch(`/api/v1/official-letters/${id}/download`, {
      headers: {
        Authorization: `Bearer ${apiClient.getAccessToken()}`,
      },
      credentials: 'include',
    });
    if (!res.ok) {
      let message = 'Gagal mengunduh PDF';
      try {
        const body = await res.json();
        message = body?.error?.message || body?.message || message;
      } catch {
        // response bukan JSON
      }
      throw new Error(message);
    }
    return res.blob();
  },

  async create(payload: CreateLetterPayload): Promise<OfficialLetter> {
    const res = await apiClient.post<OfficialLetter>('/official-letters', payload);
    if (!res.success) throw new Error(res.error?.message || 'Gagal membuat draf surat');
    return res.data;
  },

  async update(id: string, payload: UpdateLetterPayload): Promise<OfficialLetter> {
    const res = await apiClient.patch<OfficialLetter>(`/official-letters/${id}`, payload);
    if (!res.success) throw new Error(res.error?.message || 'Gagal menyimpan draf surat');
    return res.data;
  },

  async submit(id: string): Promise<OfficialLetter> {
    const res = await apiClient.post<OfficialLetter>(`/official-letters/${id}/submit`);
    if (!res.success) throw new Error(res.error?.message || 'Gagal mengajukan surat ke pimpinan');
    return res.data;
  },

  async approveAndPublish(id: string): Promise<OfficialLetter> {
    const res = await apiClient.post<OfficialLetter>(`/official-letters/${id}/approve-and-publish`);
    if (!res.success) throw new Error(res.error?.message || 'Gagal menyetujui dan merilis surat');
    return res.data;
  },

  async reject(id: string, reason: string): Promise<OfficialLetter> {
    const res = await apiClient.post<OfficialLetter>(`/official-letters/${id}/reject`, { reason });
    if (!res.success) throw new Error(res.error?.message || 'Gagal menolak surat');
    return res.data;
  },

  async archive(id: string): Promise<OfficialLetter> {
    const res = await apiClient.post<OfficialLetter>(`/official-letters/${id}/archive`);
    if (!res.success) throw new Error(res.error?.message || 'Gagal mengarsipkan surat');
    return res.data;
  },
};
