import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, FileText, Wallet, ScrollText, Lock } from 'lucide-react';
import { RoleHeader } from '@/components/common/RoleHeader';

/**
 * Halaman Pengawas: pengawasan kepatuhan, audit trail, buku kas, dan usulan
 * sanksi/SP. Akses read-only.
 */
export const PengawasPage: React.FC = () => {
  const oversight = [
    { label: 'Audit Surat Resmi', desc: 'Periksa seluruh surat & integritas SHA-256 tanpa bisa mengubah', to: '/dashboard/letters', icon: FileText },
    { label: 'Live Ledger Kas', desc: 'Buku kas berjalan & voucher yang sudah terverifikasi', to: '/dashboard/finance', icon: Wallet },
    { label: 'Daftar Pengurus', desc: 'Audit siapa yang memegang jabatan dan delegasi apa', to: '/dashboard/users', icon: ScrollText },
  ];

  return (
    <div className="space-y-6">
      <RoleHeader
        title="Dewan Pengawas"
        subtitle="Mengawasi kepatuhan kepengurusan terhadap ART/ADRT, audit trail, dan usulan sanksi/SP."
        icon={<ShieldCheck className="w-6 h-6 text-emerald-300" />}
      />

      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
        <Lock className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <p className="text-xs text-rose-900">
          <span className="font-bold">Akses read-only.</span> Tidak ada tombol tambah/edit/hapus. Pelanggaran
          kebijakan (mis. akses lintas divisi) tercatat otomatis di audit log.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {oversight.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-rose-300 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-rose-900">{item.label}</h3>
            </div>
            <p className="text-xs text-slate-600">{item.desc}</p>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Event Keamanan Terbaru</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">Pelanggaran & penolakan akses yang tercatat di sistem</p>
        </div>
        <div className="p-4 space-y-2">
          {[
            { event: 'CROSS_DIVISION_DENIED', note: 'Anggota Divisi Dakwah mencoba membuka usulan Litbang', time: '10:24 WIB' },
            { event: 'LETTER_REJECTED', note: 'SK/04/2026/002 ditolak dengan catatan revisi', time: '09:05 WIB' },
            { event: 'LOGIN_SUCCESS', note: 'Pengawas masuk dari perangkat baru', time: '08:41 WIB' },
          ].map((log, idx) => (
            <div key={idx} className="flex items-start justify-between gap-2 p-2.5 bg-slate-50 rounded-xl">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 font-mono">{log.event}</p>
                <p className="text-[10px] text-slate-600 truncate">{log.note}</p>
              </div>
              <span className="shrink-0 text-[10px] text-slate-400 font-mono">{log.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
