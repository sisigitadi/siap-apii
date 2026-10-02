import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileBarChart, ArrowLeft, TrendingUp, TrendingDown, Wallet, Scale } from 'lucide-react';
import { financeApi } from '@/api/finance.api';
import { MonthlyReport } from '@/api/types';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { CASH_ACCOUNTS, CASH_CATEGORIES } from '@/utils/constants';
import { formatRupiah } from '@/utils/formatters';

const MONTH_LABELS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export const FinanceReportPage: React.FC = () => {
  const { error: showError } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await financeApi.getMonthlyReport(month, year);
      setReport(data);
    } catch (err) {
      showError('Gagal Memuat Laporan', err instanceof Error ? err.message : 'Server tidak merespons');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [month, year, showError]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const categoryEntries = report?.by_category
    ? Object.entries(report.by_category).sort((a, b) => b[1] - a[1])
    : [];
  const accountEntries = report?.by_account ? Object.entries(report.by_account) : [];
  const maxCategory = categoryEntries.length > 0 ? categoryEntries[0][1] : 1;

  const years: number[] = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) years.push(y);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Laporan Kas Bulanan"
        subtitle="Rekapitulasi pemasukan & pengeluaran resmi yang telah melalui dual-approval."
        actions={
          <Link
            to="/dashboard/finance"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" /> Buku Kas
          </Link>
        }
      />

      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-2.5">
        <span className="text-xs font-bold text-slate-700">Periode Laporan:</span>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            {MONTH_LABELS.map((label, idx) => (
              <option key={label} value={idx + 1}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Menyusun laporan kas bulanan..." />
      ) : !report ? (
        <div className="bg-white rounded-2xl border border-slate-200">
          <EmptyState
            icon={FileBarChart}
            title="Belum Ada Data Periode Ini"
            description="Belum terdapat transaksi yang disetujui pada bulan & tahun yang dipilih."
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span>Saldo Awal</span>
                <Wallet className="w-4 h-4 text-slate-500" />
              </div>
              <h3 className="text-base font-black text-slate-900 mt-2">{formatRupiah(report.opening_balance)}</h3>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-emerald-200">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                <span>Total Pemasukan</span>
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="text-base font-black text-emerald-700 mt-2">{formatRupiah(report.total_income)}</h3>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-rose-200">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-rose-600">
                <span>Total Pengeluaran</span>
                <TrendingDown className="w-4 h-4" />
              </div>
              <h3 className="text-base font-black text-rose-700 mt-2">{formatRupiah(report.total_expense)}</h3>
            </div>
            <div className="bg-gradient-to-br from-[#0e3b6f] to-[#092547] text-white p-4 rounded-2xl shadow-sm">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-300">
                <span>Saldo Akhir</span>
                <Scale className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-base font-black mt-2">{formatRupiah(report.closing_balance)}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {MONTH_LABELS[report.month - 1]} {report.year}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Rincian per Kategori</h3>
              {categoryEntries.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Tidak ada transaksi pada periode ini.</p>
              ) : (
                <div className="space-y-2.5">
                  {categoryEntries.map(([cat, amount]) => (
                    <div key={cat}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-700">{CASH_CATEGORIES[cat as keyof typeof CASH_CATEGORIES] || cat}</span>
                        <span className="font-bold text-slate-900 font-mono">{formatRupiah(amount)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                          style={{ width: `${Math.max(3, (amount / maxCategory) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Rincian per Rekening Resmi</h3>
              {accountEntries.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Tidak ada transaksi pada periode ini.</p>
              ) : (
                <div className="space-y-3">
                  {accountEntries.map(([acc, vals]) => (
                    <div key={acc} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] font-bold text-slate-800 mb-2">{CASH_ACCOUNTS[acc as keyof typeof CASH_ACCOUNTS] || acc}</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[9px] text-slate-500 font-bold uppercase">Masuk</p>
                          <p className="text-[11px] font-black text-emerald-700 font-mono">{formatRupiah(vals.income)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-500 font-bold uppercase">Keluar</p>
                          <p className="text-[11px] font-black text-rose-700 font-mono">{formatRupiah(vals.expense)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-500 font-bold uppercase">Net</p>
                          <p className={`text-[11px] font-black font-mono ${vals.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {formatRupiah(vals.net)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
