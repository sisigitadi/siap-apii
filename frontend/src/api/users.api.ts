import { apiClient } from './client';
import { Division, User, UserRole } from './types';

export interface InviteUserPayload {
  email: string;
  fullName: string;
  role: UserRole;
  division?: Division | null;
}

export interface UpdateUserRolePayload {
  role: UserRole;
  division?: Division | null;
}

export interface UserListResponse {
  items: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const usersApi = {
  async list(params: { role?: UserRole; division?: Division; search?: string; page?: number; limit?: number } = {}): Promise<UserListResponse> {
    const searchParams = new URLSearchParams();
    if (params.role) searchParams.set('role', params.role);
    if (params.division) searchParams.set('division', params.division);
    if (params.search) searchParams.set('search', params.search);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));

    const res = await apiClient.get<UserListResponse>(`/users?${searchParams.toString()}`);
    if (!res.success) throw new Error(res.error?.message || 'Gagal memuat daftar pengguna');
    return res.data;
  },

  async invite(payload: InviteUserPayload): Promise<User> {
    const res = await apiClient.post<User>('/users/invite', payload);
    if (!res.success) throw new Error(res.error?.message || 'Gagal mengundang pengguna');
    return res.data;
  },

  async updateRole(id: string, payload: UpdateUserRolePayload): Promise<User> {
    const res = await apiClient.patch<User>(`/users/${id}/role`, payload);
    if (!res.success) throw new Error(res.error?.message || 'Gagal mengubah peran pengguna');
    return res.data;
  },

  async updateDelegation(id: string, canManageUsers: boolean): Promise<User> {
    const res = await apiClient.patch<User>(`/users/${id}/delegation`, { canManageUsers });
    if (!res.success) throw new Error(res.error?.message || 'Gagal memperbarui izin delegasi');
    return res.data;
  },
};
