import { apiClient } from './client';
import { User } from './types';

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  user: User;
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
  }
};
