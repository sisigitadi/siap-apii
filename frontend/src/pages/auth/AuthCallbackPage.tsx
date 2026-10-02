import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export const AuthCallbackPage: React.FC = () => {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    refreshProfile().then(() => {
      navigate('/dashboard');
    });
  }, [refreshProfile, navigate]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
      <div className="w-8 h-8 border-3 border-[#0e3b6f] border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-slate-600 font-medium">Memverifikasi sesi login Google...</p>
    </div>
  );
};
