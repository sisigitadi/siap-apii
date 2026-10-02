import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { User as UserIcon, Mail, Phone, MapPin, CreditCard, Shield, LogOut, Edit3, Save, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/common/PageHeader';
import { ROLE_LABELS, DIVISION_LABELS } from '@/utils/constants';
import { formatDateIndo } from '@/utils/formatters';

export const ProfilePage: React.FC = () => {
  const { user, logout, refreshProfile } = useAuth();
  const { success, error: showError } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!fullName.trim()) {
      showError('Nama Wajib Diisi', 'Nama lengkap tidak boleh kosong.');
      return;
    }
    setSaving(true);
    try {
      const { authApi } = await import('@/api/auth.api');
      await authApi.updateProfile({ full_name: fullName.trim() });
      await refreshProfile();
      setIsEditing(false);
      success('Profil Diperbarui', 'Nama tampilan Anda berhasil disimpan.');
    } catch (err) {
      showError('Gagal Menyimpan', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-3">
        <h2 className="text-lg font-bold text-slate-900">Sesi Berakhir</h2>
        <Link to="/auth/login" className="text-xs font-bold text-[#0e3b6f]">
          Masuk Kembali
        </Link>
      </div>
    );
  }

  const infoItems = [
    { icon: Mail, label: 'Email Resmi', value: user.email },
    { icon: UserIcon, label: 'Nama Lengkap', value: user.fullName },
    { icon: Shield, label: 'Peran Organisasi', value: ROLE_LABELS[user.role] || user.role },
    { icon: UserIcon, label: 'Divisi Kerja', value: user.division ? DIVISION_LABELS[user.division] : 'Pimpinan Pusat (Tanpa Divisi)' },
    { icon: CreditCard, label: 'Nomor Pokok Anggota (NPA)', value: user.memberNumber || 'APII-JB-MEMBER' },
    { icon: Phone, label: 'Nomor WhatsApp', value: user.phone || '-' },
    { icon: MapPin, label: 'Kota Domisili', value: user.city || '-' },
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader
        title="Profil Pengurus"
        subtitle="Informasi identitas, peran, dan keanggotaan resmi DPW APII Jabodetabek."
      />

      <div className="bg-gradient-to-r from-[#0e3b6f] via-[#0b2f59] to-[#107548] rounded-3xl p-6 text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-2xl font-black backdrop-blur-sm">
          {user.fullName?.charAt(0) || 'U'}
        </div>
        <div className="flex-1 space-y-0.5">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={saving}
                maxLength={100}
                className="px-3 py-1.5 rounded-lg bg-white/95 text-slate-900 text-sm font-bold border-2 border-white/40 focus:outline-none focus:ring-2 focus:ring-white/60 min-w-[200px]"
                placeholder="Nama Lengkap"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition-colors"
              >
                <Save className="w-3.5 h-3.5" /> Simpan
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setFullName(user.fullName);
                }}
                disabled={saving}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/15 hover:bg-white/25 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Batal
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black">{user.fullName}</h2>
              <button
                onClick={() => {
                  setFullName(user.fullName);
                  setIsEditing(true);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 bg-white/15 hover:bg-white/25 text-white rounded-lg text-[10px] font-bold transition-colors"
                title="Ubah nama tampilan (FR-AUTH-08)"
              >
                <Edit3 className="w-3 h-3" /> Ubah
              </button>
            </div>
          )}
          <p className="text-xs text-slate-200">{ROLE_LABELS[user.role] || user.role}</p>
          <p className="text-[11px] text-emerald-300 font-semibold">
            {user.division ? DIVISION_LABELS[user.division] : 'Pimpinan Pusat DPW'}
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1">
          <span
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
              user.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-slate-500/20 text-slate-300'
            }`}
          >
            {user.status === 'ACTIVE' ? 'Anggota Aktif' : user.status === 'SUSPENDED' ? 'Duspend' : 'Nonaktif'}
          </span>
          {user.createdAt && (
            <span className="text-[10px] text-slate-300">Bergabung sejak {formatDateIndo(user.createdAt)}</span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Detail Identitas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {infoItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <Icon className="w-4 h-4 text-[#0e3b6f] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</p>
                  <p className="text-xs font-semibold text-slate-800 truncate">{item.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Aksi Cepat</h3>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Link
            to="/members/me"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-colors"
          >
            <CreditCard className="w-4 h-4" /> Lihat e-KTA Digital 5 Tahun
          </Link>
          <button
            onClick={async () => {
              await logout();
              success('Anda Telah Keluar', 'Sesi login berhasil diakhiri dengan aman.');
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors"
          >
            <LogOut className="w-4 h-4" /> Keluar dari Sistem
          </button>
        </div>
      </div>
    </div>
  );
};
