import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Gavel,
  PenLine,
  Wallet,
  BookOpen,
  ShieldCheck,
  FolderKanban,
  CreditCard,
  Globe,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROLE_DUTIES, ROLE_LABELS, ORGANIZATION_ROLES } from '@/utils/constants';
import { UserRole } from '@/api/types';

/**
 * Halaman mode demo: satu pintu untuk mencoba SEMUA jabatan (termasuk halaman
 * publik) tanpa login Google. Berguna untuk presentasi & evaluasi UI.
 */
export const DemoPage: React.FC = () => {
  const { devSwitchRole, user } = useAuth();
  const navigate = useNavigate();

  const roleMeta: Record<UserRole, { icon: React.ElementType; accent: string }> = {
    SUPERADMIN: { icon: Sparkles, accent: 'bg-slate-100 text-slate-700 border-slate-200' },
    KETUA: { icon: Gavel, accent: 'bg-blue-50 text-blue-700 border-blue-200' },
    SEKRETARIS: { icon: PenLine, accent: 'bg-sky-50 text-sky-700 border-sky-200' },
    BENDAHARA: { icon: Wallet, accent: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    PEMBINA: { icon: BookOpen, accent: 'bg-amber-50 text-amber-700 border-amber-200' },
    PENGAWAS: { icon: ShieldCheck, accent: 'bg-rose-50 text-rose-700 border-rose-200' },
    KETUA_DIVISI: { icon: FolderKanban, accent: 'bg-teal-50 text-teal-700 border-teal-200' },
    ANGGOTA_DIVISI: { icon: FolderKanban, accent: 'bg-teal-50 text-teal-700 border-teal-200' },
    ANGGOTA_BIASA: { icon: CreditCard, accent: 'bg-purple-50 text-purple-700 border-purple-200' },
  };

  const publicPages = [
    { label: 'Beranda Publik', desc: 'Etalase informasi resmi yayasan', to: '/' },
    { label: 'Verifikasi Dokumen', desc: 'Cek keaslian SK via SHA-256', to: '/verify' },
    { label: 'Verifikasi e-KTA', desc: 'Validasi status keanggotaan', to: '/verify/member/APII-JABO-0001' },
    { label: 'Jadwal Kajian', desc: 'Agenda kajian & program resmi', to: '/schedule' },
  ];

  const handleSwitch = (role: UserRole) => {
    devSwitchRole(role);
    if (role === 'ANGGOTA_BIASA') {
      navigate('/dashboard/anggota');
    } else if (role === 'KETUA_DIVISI' || role === 'ANGGOTA_DIVISI') {
      navigate('/dashboard/divisi');
    } else if (role === 'SUPERADMIN') {
      navigate('/dashboard');
    } else {
      navigate(`/dashboard/${role.toLowerCase()}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
            <Sparkles className="w-3.5 h-3.5" /> Mode Demo
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Coba Semua Jabatan &amp; Halaman</h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto">
            Satu pintu untuk menjelajahi seluruh peran organisasi (Ketua, Sekretaris, Bendahara, Pembina, Pengawas,
            Ketua Divisi, Anggota Divisi, Anggota Biasa) beserta halaman publik — tanpa login Google.
          </p>
          {user && (
            <p className="text-[11px] text-slate-500">
              Sedang aktif: <span className="font-bold">{ROLE_LABELS[user.role]}</span>
            </p>
          )}
        </div>

        <section>
          <h2 className="text-sm font-bold text-slate-900 mb-3 px-1">Jabatan Organisasi (klik untuk masuk)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ORGANIZATION_ROLES.map((role) => {
              const meta = roleMeta[role];
              const Icon = meta.icon;
              const active = user?.role === role;
              return (
                <button
                  key={role}
                  onClick={() => handleSwitch(role)}
                  className={`text-left bg-white p-4 rounded-2xl border shadow-xs transition-all hover:shadow-md hover:-translate-y-0.5 ${
                    active ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mb-3 ${meta.accent}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{ROLE_LABELS[role]}</h3>
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                    {(ROLE_DUTIES[role] ?? [])[0] ?? '—'}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0e3b6f] mt-3">
                    Masuk sebagai ini <ArrowRight className="w-3 h-3" />
                  </span>
                </button>
              );
            })}
          </div>
        </section>


        <section>
          <h2 className="text-sm font-bold text-slate-900 mb-3 px-1 flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-emerald-600" /> Halaman Publik
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {publicPages.map((page) => (
              <Link
                key={page.to}
                to={page.to}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-400 transition-colors group"
              >
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-900">{page.label}</h3>
                <p className="text-[10px] text-slate-500 mt-1">{page.desc}</p>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 mt-3">
                  Buka <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <div className="text-center">
          <Link
            to="/auth/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0e3b6f] hover:bg-[#0b2f59] text-white rounded-xl text-sm font-bold"
          >
            Login Google Sebenarnya <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};
