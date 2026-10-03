import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { ROLE_DUTIES, ROLE_LABELS, DIVISION_LABELS } from '@/utils/constants';

interface RoleHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

/**
 * Header standar untuk halaman per-jabatan: menampilkan jabatan, divisi (jika
 * ada), dan daftar tugas & tanggung jawab dari ROLE_DUTIES (dokumen sumber).
 */
export const RoleHeader: React.FC<RoleHeaderProps> = ({ title, subtitle, icon }) => {
  const { user } = useAuth();
  const duties = user ? ROLE_DUTIES[user.role] ?? [] : [];

  return (
    <div className="bg-gradient-to-r from-[#0e3b6f] via-[#0b2f59] to-[#107548] rounded-3xl p-5 sm:p-6 text-white shadow-lg space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        {icon && (
          <div className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-2xl bg-white/15 flex items-center justify-center">
            {icon}
          </div>
        )}
        <div className="space-y-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-emerald-300 text-[11px] font-semibold">
            {user ? ROLE_LABELS[user.role] : 'Pengurus'}
            {user?.division && ` · ${DIVISION_LABELS[user.division]}`}
          </div>
          <h1 className="text-xl sm:text-2xl font-black truncate">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-slate-200">{subtitle}</p>}
        </div>
      </div>

      {duties.length > 0 && (
        <div className="bg-white/10 rounded-2xl p-3.5 sm:p-4 border border-white/15">
          <p className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider mb-2">
            Tugas &amp; Tanggung Jawab
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5">
            {duties.map((duty, idx) => (
              <li key={idx} className="flex items-start gap-2 text-[11px] sm:text-xs text-slate-100">
                <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                <span>{duty}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
