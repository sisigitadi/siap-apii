import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, Search, Mail, ShieldCheck, KeyRound } from 'lucide-react';
import { usersApi } from '@/api/users.api';
import { Division, User, UserRole } from '@/api/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { ROLE_LABELS, DIVISION_LABELS } from '@/utils/constants';

const ROLE_KEYS = Object.keys(ROLE_LABELS) as UserRole[];
const DIVISION_KEYS = Object.keys(DIVISION_LABELS) as Division[];

export const UsersListPage: React.FC = () => {
  const { user: currentUser, isSuperadmin, refreshProfile } = useAuth();
  const { success, error: showError } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [inviteForm, setInviteForm] = useState({
    email: '',
    fullName: '',
    role: 'ANGGOTA_HUMAS' as UserRole,
    division: 'DIV_HUMAS' as Division | null,
  });
  const [roleForm, setRoleForm] = useState<{ role: UserRole; division: Division | null }>({
    role: 'ANGGOTA_HUMAS',
    division: null,
  });
  const [inviting, setInviting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({ search: search.trim() || undefined, limit: 50 });
      setUsers(res.items || []);
    } catch (err) {
      showError('Gagal Memuat Pengguna', err instanceof Error ? err.message : 'Server tidak merespons');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [search, showError]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleInvite = async () => {
    if (!inviteForm.email.trim() || !inviteForm.fullName.trim()) {
      showError('Form Belum Lengkap', 'Nama lengkap dan email Google wajib diisi.');
      return;
    }
    setInviting(true);
    try {
      await usersApi.invite({
        email: inviteForm.email.trim(),
        fullName: inviteForm.fullName.trim(),
        role: inviteForm.role,
        division: inviteForm.division,
      });
      success('Undangan Terkirim', `Email verifikasi telah dikirim ke ${inviteForm.email}.`);
      setShowInviteModal(false);
      setInviteForm({ ...inviteForm, email: '', fullName: '' });
      fetchUsers();
    } catch (err) {
      showError('Gagal Mengundang', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!editTarget) return;
    setActionLoading(editTarget.id);
    try {
      await usersApi.updateRole(editTarget.id, {
        role: roleForm.role,
        division: roleForm.division,
      });
      success('Peran Diperbarui', `${editTarget.fullName} kini berperan sebagai ${ROLE_LABELS[roleForm.role]}.`);
      setEditTarget(null);
      fetchUsers();
      if (editTarget.id === currentUser?.id) refreshProfile();
    } catch (err) {
      showError('Gagal Mengubah Peran', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleDelegation = async (target: User) => {
    setActionLoading(target.id);
    try {
      await usersApi.updateDelegation(target.id, !target.canManageUsers);
      success(
        target.canManageUsers ? 'Delegasi Dicolok' : 'Delegasi Diberikan',
        `${target.fullName} ${target.canManageUsers ? 'tidak lagi' : 'kini'} dapat mengelola anggota.`
      );
      fetchUsers();
    } catch (err) {
      showError('Gagal Memperbarui Delegasi', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kelola Pengurus &amp; Delegasi"
        subtitle="Manajemen peran, divisi, dan izin delegasi seluruh pengurus DPW APII Jabodetabek."
        actions={
          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0e3b6f] hover:bg-[#092547] text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <UserPlus className="w-4 h-4" /> <span>Undang Pengurus</span>
          </button>
        }
      />

      <div className="bg-white p-3.5 rounded-2xl border border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchUsers();
          }}
          className="relative"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau email pengurus..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-300"
          />
        </form>
      </div>

      {loading ? (
        <LoadingSpinner label="Memuat daftar pengurus..." />
      ) : users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200">
          <EmptyState
            icon={UserPlus}
            title="Belum Ada Pengurus Terdaftar"
            description="Undang pengurus baru melalui email Google resmi untuk mulai mengelola organisasi."
          />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left">
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pengurus</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Peran</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Divisi</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Delegasi</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0e3b6f] to-[#107548] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                          {u.fullName?.charAt(0) || 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate flex items-center gap-1">
                            {u.fullName}
                            {u.id === currentUser?.id && (
                              <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">Anda</span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                            <Mail className="w-2.5 h-2.5" /> {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell align-top">
                      <span className="text-[11px] font-semibold text-slate-700">{ROLE_LABELS[u.role] || u.role}</span>
                      <span
                        className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-700'
                            : u.status === 'SUSPENDED'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {u.status === 'ACTIVE' ? 'Aktif' : u.status === 'SUSPENDED' ? 'Suspend' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell align-top">
                      <span className="text-[11px] text-slate-600">{u.division ? DIVISION_LABELS[u.division] : '-'}</span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {u.canManageUsers ? (
                        <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> Bisa Kelola
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Tidak</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {isSuperadmin && (
                          <>
                            <button
                              onClick={() => {
                                setEditTarget(u);
                                setRoleForm({ role: u.role, division: u.division });
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-[#0e3b6f] hover:text-white text-slate-700 rounded-lg text-[10px] font-bold transition-colors"
                            >
                              Ubah Peran
                            </button>
                            <button
                              onClick={() => handleToggleDelegation(u)}
                              disabled={actionLoading === u.id || u.id === currentUser?.id}
                              className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-[10px] font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              {u.canManageUsers ? 'Cabut' : 'Delegasikan'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Undang Pengurus Baru"
        description="Undangan akan dikirim ke email Google resmi calon pengurus."
        size="md"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap <span className="text-rose-600">*</span></label>
            <input
              type="text"
              value={inviteForm.fullName}
              onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
              placeholder="Contoh: Ir. Hendra Kusuma, M.T."
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Google <span className="text-rose-600">*</span></label>
            <input
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              placeholder="Contoh: hendra@gmail.com"
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Peran Awal</label>
            <select
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as UserRole })}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              {ROLE_KEYS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Divisi (Opsional)</label>
            <select
              value={inviteForm.division || ''}
              onChange={(e) => setInviteForm({ ...inviteForm, division: (e.target.value || null) as Division | null })}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              <option value="">Tanpa Divisi (Pimpinan Pusat)</option>
              {DIVISION_KEYS.map((d) => (
                <option key={d} value={d}>
                  {DIVISION_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setShowInviteModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleInvite}
              disabled={inviting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#0e3b6f] hover:bg-[#092547] rounded-lg transition-colors disabled:opacity-50"
            >
              {inviting && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <Mail className="w-3.5 h-3.5" /> Kirim Undangan
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Ubah Peran &amp; Divisi"
        description={editTarget?.fullName}
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
            <KeyRound className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900 leading-relaxed">
              Perubahan peran akan langsung memengaruhi modul &amp; menu yang dapat diakses pengurus ini.
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Peran</label>
            <select
              value={roleForm.role}
              onChange={(e) => setRoleForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              {ROLE_KEYS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Divisi</label>
            <select
              value={roleForm.division || ''}
              onChange={(e) => setRoleForm((prev) => ({ ...prev, division: (e.target.value || null) as Division | null }))}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              <option value="">Tanpa Divisi (Pimpinan Pusat)</option>
              {DIVISION_KEYS.map((d) => (
                <option key={d} value={d}>
                  {DIVISION_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setEditTarget(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleUpdateRole}
              disabled={actionLoading !== null}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#0e3b6f] hover:bg-[#092547] rounded-lg transition-colors disabled:opacity-50"
            >
              {actionLoading !== null && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Simpan Perubahan
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
