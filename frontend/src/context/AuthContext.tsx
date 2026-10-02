import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole, Division } from '@/api/types';
import { authApi } from '@/api/auth.api';
import { apiClient } from '@/api/client';
import { LEADERSHIP_ROLES } from '@/utils/constants';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  devSwitchRole: (role: UserRole, division?: Division | null) => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
  isLeadership: boolean;
  isSuperadmin: boolean;
  isKetum: boolean;
  isSekretaris: boolean;
  isBendahara: boolean;
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

  const devSwitchRole = (role: UserRole, division: Division | null = null) => {
    const defaultDivision = division || (role.includes('HUMAS') ? 'DIV_HUMAS' : role.includes('DAKWAH') ? 'DIV_DAKWAH' : null);
    const mockUser: User = {
      id: `dev-${role.toLowerCase()}`,
      email: `${role.toLowerCase()}@apii.org`,
      fullName:
        role === 'SUPERADMIN'
          ? 'Superadmin APII'
          : role === 'KETUA_UMUM'
          ? 'Dr. H. Ahmad Fauzi (Ketua DPW)'
          : role === 'SEKRETARIS'
          ? 'Muhammad Rizki, S.T. (Sekretaris)'
          : role === 'BENDAHARA'
          ? 'Hj. Siti Aminah, S.E. (Bendahara)'
          : `Pengurus ${role}`,
      role,
      division: defaultDivision,
      status: 'ACTIVE',
      canManageUsers: LEADERSHIP_ROLES.includes(role),
    };
    setUser(mockUser);
    localStorage.setItem('siap_dev_user', JSON.stringify(mockUser));
  };

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
  const isKetum = user?.role === 'KETUA_UMUM' || isSuperadmin;
  const isSekretaris = user?.role === 'SEKRETARIS' || isSuperadmin;
  const isBendahara = user?.role === 'BENDAHARA' || isSuperadmin;

  const canAccessDivision = (targetDivision: Division): boolean => {
    if (!user) return false;
    if (isLeadership) return true;
    return user.division === targetDivision;
  };

  const canManageUsers = Boolean(user && (user.canManageUsers || isSuperadmin || user.role === 'KETUA_UMUM'));

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
        isKetum,
        isSekretaris,
        isBendahara,
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
