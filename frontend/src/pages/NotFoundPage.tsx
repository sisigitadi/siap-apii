import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ShieldAlert } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center">
        <ShieldAlert className="w-8 h-8 text-rose-600" />
      </div>
      <div className="space-y-1">
        <h1 className="text-5xl font-black text-slate-900">404</h1>
        <h2 className="text-lg font-bold text-slate-800">Halaman Tidak Ditemukan</h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          URL yang Anda akses tidak terdaftar di Sistem Informasi Administrasi DPW APII Jabodetabek.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0e3b6f] hover:bg-[#092547] text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
        >
          <Home className="w-4 h-4" /> Beranda Portal
        </Link>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
        >
          Dasbor Pengurus
        </Link>
      </div>
    </div>
  );
};
