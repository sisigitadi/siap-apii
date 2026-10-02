import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Wallet, Users, Layers, FolderOpen, UserCog } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DIVISION_LABELS } from '@/utils/constants';
import { Division } from '@/api/types';

export const DashboardSidebar: React.FC = () => {
  const { user, isLeadership, isSekretaris, isBendahara, canManageUsers, canAccessDivision } = useAuth();

  const allDivisions: Division[] = [
    'DIV_HUMAS',
    'DIV_SOSMED',
    'DIV_DAKWAH',
    'DIV_LITBANG',
    'DIV_INVESTASI',
    'DIV_HUKUM',
    'DIV_UMUM',
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-[calc(100vh-4rem)] flex flex-col shrink-0 border-r border-slate-800">
      <div className="p-4 flex-1 space-y-6">
        <div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2">
            Menu Utama
          </div>
          <nav className="space-y-1">
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-[#0e3b6f] text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Ringkasan Dasbor</span>
            </NavLink>

            {(isSekretaris || isLeadership) && (
              <NavLink
                to="/dashboard/letters"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-[#0e3b6f] text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`
                }
              >
                <FileText className="w-4 h-4 text-sky-400" />
                <span>Persuratan Resmi</span>
              </NavLink>
            )}

            {(isBendahara || isLeadership) && (
              <NavLink
                to="/dashboard/finance"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-[#0e3b6f] text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`
                }
              >
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Buku Kas & Voucher</span>
              </NavLink>
            )}

            {canManageUsers && (
              <NavLink
                to="/dashboard/users"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-[#0e3b6f] text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`
                }
              >
                <Users className="w-4 h-4 text-amber-400" />
                <span>Kelola Pengurus</span>
              </NavLink>
            )}

            <NavLink
              to="/dashboard/profile"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-[#0e3b6f] text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <UserCog className="w-4 h-4 text-slate-300" />
              <span>Profil Saya</span>
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
