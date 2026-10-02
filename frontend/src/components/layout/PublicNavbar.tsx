import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, Calendar, CreditCard, LayoutDashboard, LogIn } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export const PublicNavbar: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  const navLinks = [
    { label: 'Beranda', path: '/' },
    { label: 'Verifikasi Dokumen', path: '/verify', icon: ShieldCheck },
    { label: 'Jadwal Kajian', path: '/schedule', icon: Calendar },
    { label: 'e-KTA Anggota', path: '/members/me', icon: CreditCard },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0e3b6f] to-[#107548] p-0.5 shadow-sm flex items-center justify-center">
              <img
                src="/assets/logo-apii.jpg"
                alt="Logo APII"
                className="w-full h-full object-cover rounded-[10px]"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-[#0e3b6f] group-hover:text-[#107548] transition-colors">
                SIAP APII
              </span>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                DPW Jabodetabek
              </span>
            </div>
          </Link>

          {/* Nav Items */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#0e3b6f]/10 text-[#0e3b6f] font-semibold'
                      : 'text-slate-600 hover:text-[#0e3b6f] hover:bg-slate-100'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Action / Auth Button */}
          <div className="flex items-center gap-3">
            {user ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-2 bg-[#0e3b6f] hover:bg-[#092547] text-white px-4 py-2 rounded-lg text-sm font-medium transition-shadow shadow-sm hover:shadow"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Dasbor Pengurus</span>
              </Link>
            ) : (
              <Link
                to="/auth/login"
                className="flex items-center gap-2 bg-gradient-to-r from-[#0e3b6f] to-[#107548] hover:opacity-95 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Masuk Portal</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
