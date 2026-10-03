import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Wallet, Users, Layers, FolderOpen, UserCog, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DIVISION_LABELS } from '@/utils/constants';
import { Division } from '@/api/types';

type DashboardSidebarProps = {
  /** Apakah drawer mobile sedang terbuka (di layar >= lg selalu tampil) */
  isOpen: boolean;
  /** Menutup drawer mobile setelah sebuah menu dipilih */
  onClose: () => void;
};

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ isOpen, onClose }) => {
  const { user, isLeadership, isSekretaris, isBendahara, canManageUsers, canAccessDivision, isKetuaDivisi, isAnggotaDivisi, isAnggotaBiasa } = useAuth();

  const allDivisions: Division[] = [
    'DIV_HUMAS',
    'DIV_SOSMED',
    'DIV_DAKWAH',
    'DIV_LITBANG',
    'DIV_INVESTASI',
    'DIV_HUKUM',
    'DIV_UMUM',
  ];

  // Halaman beranda per-jabatan: ketua divisi & anggota divisi berbagi tempat
  const roleHomePath = user
    ? isKetuaDivisi || isAnggotaDivisi
      ? '/dashboard/divisi'
      : isAnggotaBiasa
      ? '/dashboard/anggota'
      : ['KETUA', 'SEKRETARIS', 'BENDAHARA', 'PEMBINA', 'PENGAWAS'].includes(user.role)
      ? `/dashboard/${user.role.toLowerCase()}`
      : '/dashboard'
    : '/dashboard';

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-[#0e3b6f] text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
    }`;

  return (
    <aside
      className={[
        'w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800',
        // Mobile: drawer fixed di sisi kiri, geser keluar saat ditutup.
        // Desktop (lg+): selalu tampil sebagai kolom statis.
        'fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-in-out lg:static',
        isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
        'lg:translate-x-0 lg:shadow-none',
      ].join(' ')}
      aria-label="Menu samping dashboard"
      aria-hidden={!isOpen}
    >
      <div className="p-4 flex-1 space-y-6 overflow-y-auto">
        <div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2">
            Menu Utama
          </div>
          <nav className="space-y-1">
            <NavLink to={roleHomePath} className={linkClass} onClick={onClose}>
              <LayoutDashboard className="w-4 h-4" />
              <span>Beranda Jabatan</span>
            </NavLink>

            {(isSekretaris || isLeadership) && (
              <NavLink to="/dashboard/letters" className={linkClass} onClick={onClose}>
                <FileText className="w-4 h-4 text-sky-400" />
                <span>Persuratan Resmi</span>
              </NavLink>
            )}

            {(isBendahara || isLeadership) && (
              <NavLink to="/dashboard/finance" className={linkClass} onClick={onClose}>
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Buku Kas &amp; Voucher</span>
              </NavLink>
            )}

            {canManageUsers && (
              <NavLink to="/dashboard/users" className={linkClass} onClick={onClose}>
                <Users className="w-4 h-4 text-amber-400" />
                <span>Kelola Pengurus</span>
              </NavLink>
            )}

            <NavLink to="/dashboard/profile" className={linkClass} onClick={onClose}>
              <UserCog className="w-4 h-4 text-slate-300" />
              <span>Profil Saya</span>
            </NavLink>

            <NavLink to="/demo" className={linkClass} onClick={onClose}>
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Mode Demo</span>
            </NavLink>
          </nav>
        </div>

        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">7 Divisi Kerja</span>
            <Layers className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <nav className="space-y-1">
            {allDivisions.map((divKey) => {
              const hasAccess = canAccessDivision(divKey);
              return (
                <NavLink
                  key={divKey}
                  to={`/dashboard/divisions/${divKey}`}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50'
                        : hasAccess
                        ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        : 'text-slate-600 opacity-50 cursor-not-allowed'
                    }`
                  }
                  onClick={(e) => {
                    if (!hasAccess) {
                      e.preventDefault();
                      alert('Akses Dibatasi: Anda hanya dapat membuka workspace divisi Anda sendiri.');
                    } else {
                      onClose();
                    }
                  }}
                >
                  <span className="truncate">{DIVISION_LABELS[divKey]}</span>
                  {hasAccess ? <FolderOpen className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <span className="text-[10px] text-slate-600">Terkunci</span>}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-xs flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 flex items-center justify-center font-bold">
          {user?.fullName?.charAt(0) || 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{user?.fullName || 'Tamu'}</p>
          <p className="text-[10px] text-slate-400 truncate">{user?.email || '-'}</p>
        </div>
      </div>
    </aside>
  );
};
