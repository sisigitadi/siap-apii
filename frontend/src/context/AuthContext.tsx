import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole, Division } from '@/api/types';
import { authApi } from '@/api/auth.api';
import { apiClient } from '@/api/client';
import { LEADERSHIP_ROLES, DIVISION_ROLES, READONLY_ROLES, ROLE_LABELS, DEMO_EMAILS } from '@/utils/constants';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  devSwitchRole: (role: UserRole, division?: Division | null) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
  isLeadership: boolean;
  isSuperadmin: boolean;
  isKetua: boolean;
  isSekretaris: boolean;
  isBendahara: boolean;
  isPembina: boolean;
  isPengawas: boolean;
  isKetuaDivisi: boolean;
  isAnggotaDivisi: boolean;
  isAnggotaBiasa: boolean;
  isReadonly: boolean;
  canAccessDivision: (division: Division) => boolean;
  canManageUsers: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await authApi.getProfile();
      setUser(profile);
    } catch {
      // If no active session, check local dev user or leave null
      const savedDevUser = localStorage.getItem('siap_dev_user');
      if (savedDevUser) {
        setUser(JSON.parse(savedDevUser));
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const loginWithGoogle = async () => {
    const { authorizationUrl } = await authApi.getGoogleAuthUrl();
    window.location.href = authorizationUrl;
  };

  const devSwitchRole = useCallback(
    async (role: UserRole, division: Division | null = null) => {
      const defaultDivision = division ?? (DIVISION_ROLES.includes(role) ? 'DIV_HUMAS' : null);

      try {
        // Login demo NYATA: menerbitkan JWT asli untuk akun seed (Fase D) agar
        // dashboard role dapat memanggil API terotentikasi.
        const { user: backendUser } = await authApi.devLogin(DEMO_EMAILS[role]);
        const appUser: User = {
          id: backendUser.id,
          email: backendUser.email,
          fullName: backendUser.fullName,
          role: backendUser.role,
          division: backendUser.division ?? defaultDivision,
          status: backendUser.isActive ? 'ACTIVE' : 'INACTIVE',
          canManageUsers: backendUser.canManageUsers,
        };
        setUser(appUser);
        localStorage.setItem('siap_dev_user', JSON.stringify(appUser));
        return;
      } catch {
        // Backend tidak mengaktifkan mode demo (mis. production tanpa
        // ENABLE_DEV_LOGIN) → fallback simulasi sisi klien. Tanpa JWT, halaman
        // authenticated akan 401, tapi navigasi & UI publik tetap dapat dicoba.
      }

      const label = ROLE_LABELS[role];
      const mockUser: User = {
        id: `dev-${role.toLowerCase()}`,
        email: `${role.toLowerCase()}@apii-jabodetabek.or.id`,
        fullName:
          role === 'SUPERADMIN'
            ? 'Sigit Adi (Superadmin)'
            : role === 'KETUA'
            ? 'Dr. H. Ahmad Fauzi (Ketua)'
            : role === 'SEKRETARIS'
            ? 'Muhammad Rizki, S.T. (Sekretaris)'
            : role === 'BENDAHARA'
            ? 'Hj. Siti Aminah, S.E. (Bendahara)'
            : role === 'PEMBINA'
            ? 'Prof. H. Ridwan Hakim, Lc. (Pembina)'
            : role === 'PENGAWAS'
            ? 'H. Abdul Karim, M.M. (Pengawas)'
            : role === 'KETUA_DIVISI'
            ? `Ust. Ahmad Sahid (Ketua Divisi Humas)`
            : role === 'ANGGOTA_DIVISI'
            ? 'Fatimah Az-Zahra (Anggota Divisi Humas)'
            : `Budi Anggota (${label})`,
        role,
        division: defaultDivision,
        status: 'ACTIVE',
        canManageUsers: LEADERSHIP_ROLES.includes(role),
      };
      setUser(mockUser);
      localStorage.setItem('siap_dev_user', JSON.stringify(mockUser));
    },
    [],
  );

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      setUser(null);
      localStorage.removeItem('siap_dev_user');
      apiClient.setAccessToken(null);
    }
  };

  const hasRole = (...roles: UserRole[]): boolean => {
    if (!user) return false;
    if (user.role === 'SUPERADMIN') return true;
    return roles.includes(user.role);
  };

  const isLeadership = user ? LEADERSHIP_ROLES.includes(user.role) : false;
  const isSuperadmin = user?.role === 'SUPERADMIN';
  const isKetua = user?.role === 'KETUA' || isSuperadmin;
  const isSekretaris = user?.role === 'SEKRETARIS' || isSuperadmin;
  const isBendahara = user?.role === 'BENDAHARA' || isSuperadmin;
  const isPembina = user?.role === 'PEMBINA';
  const isPengawas = user?.role === 'PENGAWAS';
  const isKetuaDivisi = user?.role === 'KETUA_DIVISI';
  const isAnggotaDivisi = user?.role === 'ANGGOTA_DIVISI';
  const isAnggotaBiasa = user?.role === 'ANGGOTA_BIASA';
  const isReadonly = user ? READONLY_ROLES.includes(user.role) : false;

  const canAccessDivision = (targetDivision: Division): boolean => {
    if (!user) return false;
    if (isLeadership) return true;
    return user.division === targetDivision;
  };

  const canManageUsers = Boolean(user && (user.canManageUsers || isSuperadmin || user.role === 'KETUA'));

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithGoogle,
        devSwitchRole,
        logout,
        refreshProfile,
        hasRole,
        isLeadership,
        isSuperadmin,
        isKetua,
        isSekretaris,
        isBendahara,
        isPembina,
        isPengawas,
        isKetuaDivisi,
        isAnggotaDivisi,
        isAnggotaBiasa,
        isReadonly,
        canAccessDivision,
        canManageUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
