import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Layers, Lock, CheckCircle2, Globe, XCircle } from 'lucide-react';
import { divisionsApi } from '@/api/divisions.api';
import { Division, DivisionSubmission, SubmissionAggregate, SubmissionCategory, SubmissionStatus } from '@/api/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { RejectReasonModal } from '@/components/common/RejectReasonModal';
import { DIVISION_LABELS } from '@/utils/constants';
import { formatRupiah, formatDateIndo } from '@/utils/formatters';

const CATEGORY_LABELS: Record<SubmissionCategory, string> = {
  KAJIAN_RUTIN: 'Kajian Rutin',
  BAKTI_SOSIAL: 'Bakti Sosial',
  PELATIHAN_VOKASI: 'Pelatihan Vokasi',
  KONTEN_DAKWAH: 'Konten Dakwah',
  RISET_SURVEI: 'Riset & Survei',
  ADVOKASI_HUKUM: 'Advokasi Hukum',
  OPERASIONAL_DIVISI: 'Operasional Divisi',
  LAINNYA: 'Lainnya',
};

const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS) as SubmissionCategory[];

const STATUS_FILTERS: { value: '' | SubmissionStatus; label: string }[] = [
  { value: '', label: 'Semua Status' },
  { value: 'DRAFT', label: 'Draf' },
  { value: 'PENDING_APPROVAL', label: 'Menunggu Persetujuan' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'REJECTED', label: 'Ditolak' },
  { value: 'PUBLISHED', label: 'Dipublikasikan' },
];

export const DivisionDetailPage: React.FC = () => {
  const { division } = useParams<{ division: string }>();
  const navigate = useNavigate();
  const { user, isKetua, canAccessDivision, isLeadership } = useAuth();
  const { success, error: showError } = useToast();

  const divisionKey = division as Division;
  const hasAccess = divisionKey ? canAccessDivision(divisionKey) : false;

  const [submissions, setSubmissions] = useState<DivisionSubmission[]>([]);
  const [aggregate, setAggregate] = useState<SubmissionAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'' | SubmissionStatus>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<DivisionSubmission | null>(null);
  const [approveBudget, setApproveBudget] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    category: 'KAJIAN_RUTIN' as SubmissionCategory,
    description: '',
    proposed_budget: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    location: '',
  });
  const [creating, setCreating] = useState(false);

  const fetchSubmissions = useCallback(async () => {
    if (!divisionKey) return;
    setLoading(true);
    try {
      const res = await divisionsApi.listSubmissions({
        division: isLeadership ? undefined : divisionKey,
        status: statusFilter || undefined,
        limit: 20,
      });
      setSubmissions(res.items || []);
    } catch (err) {
      showError('Gagal Memuat Usulan', err instanceof Error ? err.message : 'Server tidak merespons');
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [divisionKey, statusFilter, isLeadership, showError]);

  const fetchAggregate = useCallback(async () => {
    try {
      const data = await divisionsApi.getAggregate();
      setAggregate(data);
    } catch {
      setAggregate(null);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) {
      fetchSubmissions();
      fetchAggregate();
    } else {
      setLoading(false);
    }
  }, [hasAccess, fetchSubmissions, fetchAggregate]);

  const handleCreate = async () => {
    const budget = Number(form.proposed_budget);
    if (!form.title.trim() || !form.description.trim() || !budget || budget <= 0) {
      showError('Form Belum Lengkap', 'Judul, deskripsi, dan usulan anggaran wajib diisi.');
      return;
    }
    setCreating(true);
    try {
      await divisionsApi.create({
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
        proposed_budget: budget,
        start_date: form.start_date,
        end_date: form.end_date,
        location: form.location.trim() || undefined,
      });
      success('Usulan Dibuat', 'Draf program kerja telah disimpan di workspace divisi.');
      setShowCreateModal(false);
      setForm({ ...form, title: '', description: '', proposed_budget: '', location: '' });
      fetchSubmissions();
      fetchAggregate();
    } catch (err) {
      showError('Gagal Membuat Usulan', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = async (subId: string) => {
    setActionLoading(subId);
    try {
      await divisionsApi.submit(subId);
      success('Usulan Diajukan', 'Program kerja dikirim ke Ketua DPW untuk approval board.');
      fetchSubmissions();
      fetchAggregate();
    } catch (err) {
      showError('Gagal Mengajukan', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    const budget = Number(approveBudget);
    if (!budget || budget <= 0) {
      showError('Anggaran Tidak Valid', 'Masukkan nominal anggaran yang disetujui.');
      return;
    }
    setActionLoading(approveTarget.id);
    try {
      await divisionsApi.approve(approveTarget.id, budget);
      success('Usulan Disetujui', `Anggaran ${formatRupiah(budget)} telah disetujui pada approval board.`);
      setApproveTarget(null);
      setApproveBudget('');
      fetchSubmissions();
      fetchAggregate();
    } catch (err) {
      showError('Gagal Menyetujui', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublish = async (subId: string) => {
    setActionLoading(subId);
    try {
      await divisionsApi.publish(subId);
      success('Program Dipublikasikan', 'Kegiatan kini tampil di portal publik & jadwal kegiatan.');
      fetchSubmissions();
      fetchAggregate();
    } catch (err) {
      showError('Gagal Mempublikasikan', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (reason: string) => {
    if (!rejectTargetId) return;
    setActionLoading(rejectTargetId);
    try {
      await divisionsApi.reject(rejectTargetId, reason);
      success('Usulan Ditolak', 'Catatan revisi telah dikirim ke divisi pengaju.');
      fetchSubmissions();
      fetchAggregate();
    } catch (err) {
      showError('Gagal Menolak', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setActionLoading(null);
      setRejectTargetId(null);
    }
  };

  if (!divisionKey || !DIVISION_LABELS[divisionKey]) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-3">
        <h2 className="text-lg font-bold text-slate-900">Divisi Tidak Ditemukan</h2>
        <button onClick={() => navigate('/dashboard')} className="text-xs font-bold text-[#0e3b6f]">
          Kembali ke Dasbor
        </button>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6 text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Workspace Terkunci</h2>
        <p className="text-xs text-slate-600">
          Anda hanya dapat membuka workspace divisi{' '}
          <span className="font-bold">{user?.division ? DIVISION_LABELS[user.division] : '-'}</span>. Pimpinan
          (Ketua/Sekretaris/Bendahara/Dewan Pengawas) dapat membuka seluruh divisi.
        </p>
      </div>
    );
  }

  const divAggregate = aggregate?.by_division?.[divisionKey] || 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={DIVISION_LABELS[divisionKey]}
        subtitle={`Workspace program kerja divisi · ${isLeadership ? 'Tampilan Pimpinan (semua divisi)' : 'Isolasi divisi aktif'}`}
        actions={
          !isLeadership && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> <span>Usulkan Program</span>
            </button>
          )
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Usulan</p>
          <h3 className="text-lg font-black text-slate-900 mt-1">{divAggregate}</h3>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Menunggu Review</p>
          <h3 className="text-lg font-black text-amber-600 mt-1">{aggregate?.by_status.PENDING_APPROVAL ?? 0}</h3>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Disetujui</p>
          <h3 className="text-lg font-black text-emerald-600 mt-1">{aggregate?.by_status.APPROVED ?? 0}</h3>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Anggaran Disetujui</p>
          <h3 className="text-sm font-black text-slate-900 mt-1.5">{formatRupiah(aggregate?.total_approved_budget ?? 0)}</h3>
        </div>
      </div>

      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-2.5">
        <span className="text-xs font-bold text-slate-700">Daftar Program Kerja</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | SubmissionStatus)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-300"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner label="Memuat program kerja divisi..." />
      ) : submissions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200">
          <EmptyState
            icon={Layers}
            title="Belum Ada Program Kerja"
            description="Buat usulan program pertama untuk divisi ini, lalu ajukan ke Ketua DPW."
            action={
              !isLeadership && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                >
                  <Plus className="w-4 h-4" /> Usulkan Program
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => (
            <div key={sub.id} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={sub.status} />
                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {CATEGORY_LABELS[sub.category]}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{sub.title}</h3>
                  <p className="text-xs text-slate-600 line-clamp-2">{sub.description}</p>
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 pt-1">
                    <span>
                      <span className="font-semibold">Diajukan:</span> {formatRupiah(sub.proposed_budget)}
                    </span>
                    {sub.approved_budget != null && (
                      <span className="text-emerald-700 font-semibold">Disetujui: {formatRupiah(sub.approved_budget)}</span>
                    )}
                    <span>
                      <span className="font-semibold">Periode:</span> {formatDateIndo(sub.start_date)} - {formatDateIndo(sub.end_date)}
                    </span>
                    {sub.location && (
                      <span>
                        <span className="font-semibold">Lokasi:</span> {sub.location}
                      </span>
                    )}
                  </div>
                  {sub.status === 'REJECTED' && sub.rejection_note && (
                    <p className="text-[10px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
                      <span className="font-bold">Catatan Ketua DPW:</span> {sub.rejection_note}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  {sub.status === 'DRAFT' && !isLeadership && (
                    <button
                      onClick={() => handleSubmit(sub.id)}
                      disabled={actionLoading !== null}
                      className="px-2.5 py-1 bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-lg text-[10px] font-bold disabled:opacity-50"
                    >
                      {actionLoading === sub.id ? '...' : 'Ajukan'}
                    </button>
                  )}
                  {sub.status === 'PENDING_APPROVAL' && isKetua && (
                    <>
                      <button
                        onClick={() => {
                          setApproveTarget(sub);
                          setApproveBudget(String(sub.proposed_budget));
                        }}
                        disabled={actionLoading !== null}
                        className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Setujui
                      </button>
                      <button
                        onClick={() => {
                          setRejectTargetId(sub.id);
                          setShowRejectModal(true);
                        }}
                        disabled={actionLoading !== null}
                        className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <XCircle className="w-3 h-3" /> Tolak
                      </button>
                    </>
                  )}
                  {sub.status === 'APPROVED' && isKetua && (
                    <button
                      onClick={() => handlePublish(sub.id)}
                      disabled={actionLoading !== null}
                      className="px-2.5 py-1 bg-teal-100 hover:bg-teal-200 text-teal-800 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <Globe className="w-3 h-3" /> Publikasikan
                    </button>
                  )}
                  {sub.status === 'PUBLISHED' && (
                    <span className="text-[10px] text-teal-700 font-bold flex items-center gap-1">
                      <Globe className="w-3 h-3" /> Tampil di Portal Publik
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Usulkan Program Kerja Divisi"
        subtitle={DIVISION_LABELS[divisionKey]}
        description="Draf akan disimpan di workspace divisi sebelum diajukan ke Ketua DPW."
        size="lg"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Judul Program <span className="text-rose-600">*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Contoh: Kajian Bulanan & Pembinaan Mualaf"
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kategori</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as SubmissionCategory })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                {CATEGORY_KEYS.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Usulan Anggaran (Rp) <span className="text-rose-600">*</span></label>
              <input
                type="number"
                min={0}
                value={form.proposed_budget}
                onChange={(e) => setForm({ ...form, proposed_budget: e.target.value })}
                placeholder="Contoh: 5000000"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Mulai</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Selesai</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi (Opsional)</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Contoh: Aula Graha APII / Hybrid Zoom"
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi Program <span className="text-rose-600">*</span></label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Jelaskan tujuan, bentuk kegiatan, dan dampak program..."
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-100 resize-none"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
            >
              {creating && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Simpan Draf Usulan
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(approveTarget)}
        onClose={() => {
          setApproveTarget(null);
          setApproveBudget('');
        }}
        title="Approval Board - Setujui Usulan"
        description={approveTarget?.title}
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
            Usulan anggaran divisi:{' '}
            <span className="font-black font-mono">{formatRupiah(approveTarget?.proposed_budget ?? 0)}</span>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Anggaran Disetujui (Rp) <span className="text-rose-600">*</span></label>
            <input
              type="number"
              min={0}
              value={approveBudget}
              onChange={(e) => setApproveBudget(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            {approveBudget && Number(approveBudget) > 0 && (
              <p className="text-[10px] text-emerald-700 font-bold mt-1">Terbilang: {formatRupiah(Number(approveBudget))}</p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setApproveTarget(null);
                setApproveBudget('');
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleApprove}
              disabled={actionLoading !== null}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
            >
              {actionLoading !== null && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <CheckCircle2 className="w-3.5 h-3.5" /> Setujui Usulan
            </button>
          </div>
        </div>
      </Modal>

      <RejectReasonModal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectTargetId(null);
        }}
        onConfirm={handleReject}
        title="Tolak Usulan Program"
        description="Usulan akan dikembalikan ke divisi dengan catatan revisi dari Ketua DPW."
        confirmLabel="Tolak &amp; Kirim Catatan"
      />
    </div>
  );
};
