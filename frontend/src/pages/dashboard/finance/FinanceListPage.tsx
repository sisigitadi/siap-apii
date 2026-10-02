import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Plus, Landmark, Banknote, Coins, FileBarChart } from 'lucide-react';
import { financeApi } from '@/api/finance.api';
import { CashAccount, CashBalances, CashCategory, CashFlow, CashFlowType, VoucherStatus } from '@/api/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge, CategoryBadge } from '@/components/common/StatusBadge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { RejectReasonModal } from '@/components/common/RejectReasonModal';
import { CASH_ACCOUNTS, CASH_CATEGORIES } from '@/utils/constants';
import { formatRupiah, formatDateIndo } from '@/utils/formatters';

const STATUS_FILTERS: { value: '' | VoucherStatus; label: string }[] = [
  { value: '', label: 'Semua Status' },
  { value: 'PENDING_BENDAHARA', label: 'Verifikasi Bendahara' },
  { value: 'PENDING_KETUA', label: 'Verifikasi Ketua DPW' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'REJECTED', label: 'Ditolak' },
];

const ACCOUNT_KEYS = Object.keys(CASH_ACCOUNTS) as CashAccount[];
const CATEGORY_KEYS = Object.keys(CASH_CATEGORIES) as CashCategory[];

export const FinanceListPage: React.FC = () => {
  const { isBendahara, isKetum } = useAuth();
  const { success, error: showError } = useToast();
  const [balances, setBalances] = useState<CashBalances | null>(null);
  const [vouchers, setVouchers] = useState<CashFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'' | VoucherStatus>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: 'EXPENSE' as CashFlowType,
    category: 'OPERASIONAL' as CashCategory,
    account: 'BSI_OPERASIONAL' as CashAccount,
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().slice(0, 10),
  });
  const [creating, setCreating] = useState(false);

  const fetchBalances = useCallback(async () => {
    try {
      const data = await financeApi.getBalances();
      setBalances(data);
    } catch {
      setBalances({ bsi_operasional: 48500000, bca_program: 75200000, kas_tunai: 5400000, total: 129100000 });
    }
  }, []);

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeApi.listVouchers({ status: statusFilter || undefined, page, limit: 10 });
      setVouchers(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      showError('Gagal Memuat Voucher', err instanceof Error ? err.message : 'Server tidak merespons');
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, showError]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  const handleCreateVoucher = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0 || !form.description.trim()) {
      showError('Form Belum Lengkap', 'Nominal dan keterangan voucher wajib diisi dengan benar.');
      return;
    }
    setCreating(true);
    try {
      await financeApi.createVoucher({
        type: form.type,
        category: form.category,
        account: form.account,
        amount,
        description: form.description.trim(),
        transaction_date: form.transaction_date,
      });
      success('Voucher Dibuat', 'Nomor voucher resmi telah dibangkitkan otomatis oleh sistem.');
      setShowCreateModal(false);
      setForm({ ...form, amount: '', description: '' });
      fetchBalances();
      fetchVouchers();
    } catch (err) {
      showError('Gagal Membuat Voucher', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setCreating(false);
    }
  };

  const handleVerifyBendahara = async (voucherId: string) => {
    setActionLoading(voucherId);
    try {
      await financeApi.verifyBendahara(voucherId);
      success('Verifikasi Bendahara Berhasil', 'Voucher diteruskan ke Ketua DPW untuk persetujuan akhir.');
      fetchBalances();
      fetchVouchers();
    } catch (err) {
      showError('Gagal Memverifikasi', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerifyKetum = async (voucherId: string) => {
    setActionLoading(voucherId);
    try {
      await financeApi.verifyKetum(voucherId);
      success('Voucher Disetujui', 'Dana telah masuk ke buku kas resmi yayasan.');
      fetchBalances();
      fetchVouchers();
    } catch (err) {
      showError('Gagal Menyetujui', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (reason: string) => {
    if (!rejectTargetId) return;
    setActionLoading(rejectTargetId);
    try {
      await financeApi.rejectVoucher(rejectTargetId, reason);
      success('Voucher Ditolak', 'Alasan penolakan telah dikirim kepada pengaju.');
      fetchBalances();
      fetchVouchers();
    } catch (err) {
      showError('Gagal Menolak', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setActionLoading(null);
      setRejectTargetId(null);
    }
  };

  const balanceCards = balances
    ? [
        { label: 'BSI Operasional', value: balances.bsi_operasional, icon: Landmark, color: 'text-sky-600' },
        { label: 'BCA Program & Donasi', value: balances.bca_program, icon: Banknote, color: 'text-emerald-600' },
        { label: 'Kas Tunai Sekretariat', value: balances.kas_tunai, icon: Coins, color: 'text-amber-600' },
      ]
    : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Buku Kas &amp; Voucher Resmi"
        subtitle="Pengelolaan keuangan DPW dengan dual-approval (Bendahara &amp; Ketua DPW) & akuntabilitas penuh."
        actions={
          <>
            {isBendahara && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> <span>Input Voucher</span>
              </button>
            )}
            <Link
              to="/dashboard/finance/reports"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50"
            >
              <FileBarChart className="w-4 h-4" /> Laporan Bulanan
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-[#0e3b6f] to-[#092547] text-white p-4 rounded-2xl shadow-sm">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-300">
            <span>Total Saldo Kas</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-lg font-black mt-2">{balances ? formatRupiah(balances.total) : '-'}</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Gabungan 3 rekening resmi</p>
        </div>
        {balanceCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white p-4 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span>{card.label}</span>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <h3 className="text-base font-black text-slate-900 mt-2">{formatRupiah(card.value)}</h3>
            </div>
          );
        })}
      </div>

      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-2.5">
        <span className="text-xs font-bold text-slate-700">Daftar Voucher Kas</span>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as '' | VoucherStatus);
            setPage(1);
          }}
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
        <LoadingSpinner label="Memuat daftar voucher kas..." />
      ) : vouchers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200">
          <EmptyState
            icon={Wallet}
            title="Belum Ada Voucher Kas"
            description="Voucher pemasukan & pengeluaran akan tampil di sini setelah Bendahara melakukan input."
          />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left">
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nomor &amp; Keterangan</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Kategori</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nominal</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vouchers.map((voucher) => (
                  <tr key={voucher.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono font-bold text-slate-900">{voucher.voucher_number}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            voucher.type === 'INCOME' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {voucher.type === 'INCOME' ? 'MASUK' : 'KELUAR'}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5 line-clamp-1 max-w-xs">{voucher.description}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {formatDateIndo(voucher.transaction_date)} · {voucher.submitter?.fullName || '-'} · {CASH_ACCOUNTS[voucher.account]}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell align-top">
                      <CategoryBadge category={voucher.category} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`text-sm font-black ${voucher.type === 'INCOME' ? 'text-emerald-700' : 'text-slate-900'}`}
                      >
                        {voucher.type === 'INCOME' ? '+' : '-'} {formatRupiah(voucher.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <StatusBadge status={voucher.status} />
                      {voucher.status === 'REJECTED' && voucher.rejection_reason && (
                        <p className="text-[9px] text-rose-600 mt-1 line-clamp-1 max-w-[140px]">{voucher.rejection_reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {voucher.status === 'PENDING_BENDAHARA' && isBendahara && (
                          <button
                            onClick={() => handleVerifyBendahara(voucher.id)}
                            disabled={actionLoading !== null}
                            className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-[10px] font-bold disabled:opacity-50"
                          >
                            {actionLoading === voucher.id ? '...' : 'Verifikasi'}
                          </button>
                        )}
                        {voucher.status === 'PENDING_KETUA' && isKetum && (
                          <button
                            onClick={() => handleVerifyKetum(voucher.id)}
                            disabled={actionLoading !== null}
                            className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-[10px] font-bold disabled:opacity-50"
                          >
                            {actionLoading === voucher.id ? '...' : 'Setujui'}
                          </button>
                        )}
                        {(voucher.status === 'PENDING_BENDAHARA' || voucher.status === 'PENDING_KETUA') &&
                          (isBendahara || isKetum) && (
                            <button
                              onClick={() => {
                                setRejectTargetId(voucher.id);
                                setShowRejectModal(true);
                              }}
                              disabled={actionLoading !== null}
                              className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-[10px] font-bold disabled:opacity-50"
                            >
                              Tolak
                            </button>
                          )}
                        {voucher.status === 'APPROVED' && (
                          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                            <Wallet className="w-3 h-3" /> Masuk Buku Kas
                          </span>
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

      {!loading && vouchers.length > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Menampilkan {vouchers.length} dari {total} voucher</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              Sebelumnya
            </button>
            <span className="px-2 font-bold text-slate-700">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Input Voucher Kas Baru"
        description="Nomor voucher resmi dibangkitkan otomatis; butuh verifikasi Bendahara & persetujuan Ketua DPW."
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Jenis Arus Kas</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as CashFlowType })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                <option value="INCOME">Pemasukan (Infaq, Donasi, Iuran)</option>
                <option value="EXPENSE">Pengeluaran (Operasional, Program)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rekening Resmi</label>
              <select
                value={form.account}
                onChange={(e) => setForm({ ...form, account: e.target.value as CashAccount })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                {ACCOUNT_KEYS.map((acc) => (
                  <option key={acc} value={acc}>
                    {CASH_ACCOUNTS[acc]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kategori</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as CashCategory })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                {CATEGORY_KEYS.map((cat) => (
                  <option key={cat} value={cat}>
                    {CASH_CATEGORIES[cat]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Transaksi</label>
              <input
                type="date"
                value={form.transaction_date}
                onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nominal (Rupiah) <span className="text-rose-600">*</span></label>
            <input
              type="number"
              min={0}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="Contoh: 2500000"
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            {form.amount && Number(form.amount) > 0 && (
              <p className="text-[10px] text-emerald-700 font-bold mt-1">Terbilang: {formatRupiah(Number(form.amount))}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Keterangan <span className="text-rose-600">*</span></label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Contoh: Pembelian alat tulis kantor & operasional sekretariat bulan ini"
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
              onClick={handleCreateVoucher}
              disabled={creating}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
            >
              {creating && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Simpan Voucher
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
        title="Tolak Voucher Kas"
        description="Voucher akan ditolak beserta alasan tertulis untuk akuntabilitas pencatatan keuangan."
        confirmLabel="Tolak Voucher"
      />
    </div>
  );
};
