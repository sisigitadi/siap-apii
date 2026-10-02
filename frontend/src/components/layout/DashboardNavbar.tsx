import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Radio, ExternalLink, ChevronDown, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRealtime } from '@/context/RealtimeContext';
import { ROLE_LABELS, DIVISION_LABELS } from '@/utils/constants';
import { UserRole, Division } from '@/api/types';

export const DashboardNavbar: React.FC = () => {
  const { user, logout, devSwitchRole } = useAuth();
  const { isConnected, liveNotifications, clearNotifications } = useRealtime();
  const navigate = useNavigate();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const devRoles: { role: UserRole; division?: Division; label: string }[] = [
    { role: 'SUPERADMIN', label: 'Superadmin' },
    { role: 'KETUA_UMUM', label: 'Ketua DPW' },
    { role: 'SEKRETARIS', label: 'Sekretaris' },
    { role: 'BENDAHARA', label: 'Bendahara' },
    { role: 'KADIV_HUMAS', division: 'DIV_HUMAS', label: 'Kadiv Humas' },
    { role: 'KADIV_DAKWAH', division: 'DIV_DAKWAH', label: 'Kadiv Dakwah' },
  ];

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-white border-b border-slate-200">
      <div className="flex items-center gap-3">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#0e3b6f] flex items-center justify-center text-white font-bold text-xs">
            APII
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">SIAP DPW Jabodetabek</h1>
            <p className="text-[10px] text-slate-500">Administrasi Terpadu</p>
          </div>
        </Link>
        <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${isConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
          <Radio className={`w-3 h-3 ${isConnected ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
          <span>{isConnected ? 'Real-time' : 'REST'}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative">
          <button onClick={() => setShowRoleMenu(!showRoleMenu)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-900 border border-amber-300">
            <Sparkles className="w-3 h-3 text-amber-600" />
            <span className="font-bold">{user?.role ? ROLE_LABELS[user.role] || user.role : 'Peran'}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 animate-fade-in">
              {devRoles.map((r) => (
                <button key={r.role} onClick={() => { devSwitchRole(r.role, r.division); setShowRoleMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50">
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <button onClick={() => setShowNotifMenu(!showNotifMenu)} className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
            <Bell className="w-5 h-5" />
            {liveNotifications.length > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />}
          </button>
          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50">
              <div className="flex items-center justify-between pb-2 border-b">
                <span className="text-xs font-bold">Notifikasi</span>
                {liveNotifications.length > 0 && <button onClick={clearNotifications} className="text-[10px] text-slate-500">Hapus</button>}
              </div>
              <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                {liveNotifications.length === 0 ? <p className="text-xs text-slate-400 text-center py-2">Belum ada aktivitas baru</p> : liveNotifications.map((n) => (
                  <div key={n.id} className="p-2 bg-slate-50 rounded text-xs">
                    <p className="font-semibold">{n.event}</p>
                    <p className="text-[10px] text-slate-500">{new Date(n.timestamp).toLocaleTimeString('id-ID')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <Link to="/" target="_blank" className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100">
          <ExternalLink className="w-3 h-3" />
          <span>Portal</span>
        </Link>
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="hidden lg:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-900 truncate max-w-[120px]">{user?.fullName || 'Pengguna'}</span>
            <span className="text-[10px] text-slate-500">{user?.division ? DIVISION_LABELS[user.division] : '-'}</span>
          </div>
          <button onClick={async () => { await logout(); navigate('/'); }} className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
