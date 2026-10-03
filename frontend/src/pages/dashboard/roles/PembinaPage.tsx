import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, Wallet, Eye, Lock } from 'lucide-react';
import { RoleHeader } from '@/components/common/RoleHeader';

/**
 * Halaman Pembina: arah strategis & bimbingan kepengurusan. Akses read-only
 * atas seluruh dokumen dan laporan organisasi.
 */
export const PembinaPage: React.FC = () => {
  const oversight = [
    { label: 'Surat Resmi & SK', desc: 'Semua surat yang sudah dirilis beserta verifikasi SHA-256', to: '/dashboard/letters', icon: FileText },
    { label: 'Buku Kas & Laporan', desc: 'Arus kas, voucher terverifikasi, dan laporan bulanan', to: '/dashboard/finance', icon: Wallet },
  ];

  return (
    <div className="space-y-6">
      <RoleHeader
        title="Dewan Pembina"
        subtitle="Memberikan arah strategis, bimbingan kepengurusan, dan mengawal visi-misi yayasan."
        icon={<BookOpen className="w-6 h-6 text-emerald-300" />}
      />

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-900">
          <span className="font-bold">Akses read-only.</span> Sebagai Pembina Anda dapat melihat seluruh dokumen dan
          laporan, tetapi tidak dapat membuat perubahan operasional.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {oversight.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-400 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-900">{item.label}</h3>
            </div>
            <p className="text-xs text-slate-600">{item.desc}</p>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-900">Program Kerja Jangka Panjang</h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Pembina mengawal arah program kerja jangka panjang yayasan melalui persetujuan tahap awal di Approval Board
          sebelum Ketua merilis keputusan resmi. B progress usulan dari 7 divisi kerja dapat dipantau pada halaman
          tiap divisi.
        </p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {['Kajian', 'Dakwah', 'Sosial', 'Litbang'].map((div) => (
            <div key={div} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <p className="text-[11px] font-bold text-slate-700">{div}</p>
              <p className="text-lg font-black text-slate-900 mt-0.5">2</p>
              <p className="text-[10px] text-slate-500">Program aktif</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
