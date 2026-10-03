import React from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, CalendarDays, FileText, MapPin } from 'lucide-react';
import { RoleHeader } from '@/components/common/RoleHeader';
import { useAuth } from '@/context/AuthContext';

/**
 * Halaman Anggota Biasa: e-KTA 5 tahun, jadwal kegiatan, dan feed informasi
 * publik.
 */
export const AnggotaBiasaPage: React.FC = () => {
  const { user } = useAuth();

  const quickLinks = [
    { label: 'e-KTA Digital', desc: 'Kartu anggota 5 tahun + QR verifikasi', to: '/members/me', icon: CreditCard },
    { label: 'Jadwal Kajian', desc: 'Agenda kajian & program resmi yang dipublikasi', to: '/schedule', icon: CalendarDays },
    { label: 'Feed Informasi', desc: 'Maklumat & surat resmi yang sudah rilis', to: '/', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <RoleHeader
        title="Portal Anggota"
        subtitle="Akses e-KTA 5 tahun, jadwal kegiatan, dan informasi resmi yayasan."
        icon={<CreditCard className="w-6 h-6 text-emerald-300" />}
      />

      {user?.memberNumber && (
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">Nomor Pokok Anggota</p>
              <p className="text-xl font-black font-mono mt-0.5">{user.memberNumber}</p>
            </div>
            <MapPin className="w-6 h-6 text-emerald-300" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {quickLinks.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-400 transition-colors group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 mb-2">
              <item.icon className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-900">{item.label}</h3>
            <p className="text-[11px] text-slate-500 mt-1">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};
