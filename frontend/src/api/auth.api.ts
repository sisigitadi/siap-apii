import { apiClient } from './client';
import { User } from './types';

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

/**
 * Bentuk user yang dikembalikan backend (PublicUser, DESIGN.md §4.1). Berbeda
 * dengan `User` frontend: backend memakai `isActive`, frontend memakai `status`.
 */
export interface BackendPublicUser {
  id: string;
  email: string;
  fullName: string;
  role: User['role'];
  division: User['division'];
  isActive: boolean;
  canManageUsers: boolean;
}

export interface DevLoginResponse {
  user: BackendPublicUser;
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  async getGoogleAuthUrl(): Promise<{ authorizationUrl: string }> {
    const res = await apiClient.get<{ authorizationUrl: string }>('/auth/google');
    if (!res.success) throw new Error(res.error?.message || 'Gagal membuat URL otorisasi Google');
    return res.data;
  },

  async getProfile(): Promise<User> {
    const res = await apiClient.get<User>('/auth/me');
    if (!res.success) throw new Error(res.error?.message || 'Sesi telah berakhir');
    return res.data;
  },

  async updateProfile(payload: { full_name: string; profile_picture_url?: string }): Promise<User> {
    const res = await apiClient.patch<User>('/auth/me', payload);
    if (!res.success) throw new Error(res.error?.message || 'Gagal memperbarui profil');
    return res.data;
  },

  async logout(): Promise<void> {
    await apiClient.post<{ revoked: boolean }>('/auth/logout');
    apiClient.setAccessToken(null);
  },

  async logoutAll(): Promise<void> {
    await apiClient.post<{ revoked: boolean }>('/auth/logout-all');
    apiClient.setAccessToken(null);
  },

  // Mock login for development and testing if backend is offline or for rapid UI evaluation
  async devLoginAs(role: string, email: string): Promise<User> {
    // In dev, simulated user session can be used for quick role switching
    const isDivisionRole = role === 'KETUA_DIVISI' || role === 'ANGGOTA_DIVISI';
    const mockUser: User = {
      id: 'dev-user-123',
      email,
      fullName: role === 'SUPERADMIN' ? 'Sigit Adi (Superadmin)' : role === 'KETUA' ? 'Ketua DPW APII' : 'Pengurus DPW APII',
      role: role as User['role'],
      division: isDivisionRole ? 'DIV_HUMAS' : null,
      status: 'ACTIVE',
      canManageUsers: role === 'SUPERADMIN' || role === 'KETUA',
    };
    return mockUser;
  },

  /**
   * Login demo NYATA ke backend (Fase D): menerbitkan JWT asli untuk akun seed
   * via POST /api/v1/auth/dev-login. Hanya tersedia di non-production atau saat
   * backend mengaktifkan ENABLE_DEV_LOGIN.
   *
   * Saat backend tidak mengaktifkan mode demo (404), pemanggil bisa fallback ke
   * devLoginAs() yang hanya mensimulasikan peran di sisi klien.
   */
  async devLogin(email: string): Promise<DevLoginResponse> {
    const res = await apiClient.post<DevLoginResponse>('/auth/dev-login', { email });
    if (!res.success) throw new Error(res.error?.message || 'Login demo gagal');
    apiClient.setAccessToken(res.data.accessToken);
    return res.data;
  },
};
