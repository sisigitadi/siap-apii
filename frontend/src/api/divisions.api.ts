import { apiClient } from './client';
import { Division, DivisionSubmission, SubmissionAggregate, SubmissionCategory, SubmissionStatus } from './types';

export interface CreateSubmissionPayload {
  title: string;
  category: SubmissionCategory;
  description: string;
  proposed_budget: number;
  start_date: string;
  end_date: string;
  location?: string;
  attachments?: string[];
}

export interface SubmissionsListResponse {
  items: DivisionSubmission[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const divisionsApi = {
  async getAggregate(): Promise<SubmissionAggregate> {
    const res = await apiClient.get<SubmissionAggregate>('/divisions/dashboard/aggregate');
    if (!res.success) throw new Error(res.error?.message || 'Gagal memuat agregat divisi');
    return res.data;
  },

  async listSubmissions(params: { division?: Division; status?: SubmissionStatus; page?: number; limit?: number } = {}): Promise<SubmissionsListResponse> {
    const searchParams = new URLSearchParams();
    if (params.division) searchParams.set('division', params.division);
    if (params.status) searchParams.set('status', params.status);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));

    const res = await apiClient.get<SubmissionsListResponse>(`/divisions/submissions?${searchParams.toString()}`);
    if (!res.success) throw new Error(res.error?.message || 'Gagal memuat usulan divisi');
    return res.data;
  },

  async getById(id: string): Promise<DivisionSubmission> {
    const res = await apiClient.get<DivisionSubmission>(`/divisions/submissions/${id}`);
    if (!res.success) throw new Error(res.error?.message || 'Usulan tidak ditemukan');
    return res.data;
  },

  async create(payload: CreateSubmissionPayload): Promise<DivisionSubmission> {
    const res = await apiClient.post<DivisionSubmission>('/divisions/submissions', payload);
    if (!res.success) throw new Error(res.error?.message || 'Gagal membuat usulan program');
    return res.data;
  },

  async submit(id: string): Promise<DivisionSubmission> {
    const res = await apiClient.post<DivisionSubmission>(`/divisions/submissions/${id}/submit`);
    if (!res.success) throw new Error(res.error?.message || 'Gagal mengajukan usulan ke Ketua DPW');
    return res.data;
  },

  async approve(id: string, approved_budget: number): Promise<DivisionSubmission> {
    const res = await apiClient.post<DivisionSubmission>(`/divisions/submissions/${id}/approve`, { approved_budget });
    if (!res.success) throw new Error(res.error?.message || 'Gagal menyetujui usulan');
    return res.data;
  },

  async reject(id: string, reason: string): Promise<DivisionSubmission> {
    const res = await apiClient.post<DivisionSubmission>(`/divisions/submissions/${id}/reject`, { reason });
    if (!res.success) throw new Error(res.error?.message || 'Gagal menolak usulan');
    return res.data;
  },

  async publish(id: string): Promise<DivisionSubmission> {
    const res = await apiClient.post<DivisionSubmission>(`/divisions/submissions/${id}/publish`);
    if (!res.success) throw new Error(res.error?.message || 'Gagal mempublikasikan program ke publik');
    return res.data;
  },
};
