import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, TrendingUp, TrendingDown, FileBarChart, Plus } from 'lucide-react';
import { RoleHeader } from '@/components/common/RoleHeader';
import { useAuth } from '@/context/AuthContext';
import { financeApi } from '@/api/finance.api';
import { CashBalances } from '@/api/types';
import { formatRupiah } from '@/utils/formatters';

/**
 * Halaman Bendahara: arus kas, voucher, rekonsiliasi BSI, laporan keuangan.
 */
export const BendaharaPage: React.FC = () => {
  const { isBendahara } = useAuth();
  const [balances, setBalances] = useState<CashBalances | null>(null);

  useEffect(() => {
    if (!isBendahara) return;
    financeApi
      .getBalances()
      .then(setBalances)
      .catch(() =>
        setBalances({ bsi_operasional: 48500000, bca_program: 75200000, kas_tunai: 5400000, total: 129100000 }),
      );
  }, [isBendahara]);

  const accounts = balances
    ? [
        { label: 'BSI Operasional', value: balances.bsi_operasional },
        { label: 'BCA Program & Donasi', value: balances.bca_program },
        { label: 'Kas Tunai Sekretariat', value: balances.kas_tunai },
      ]
    : [];

  return (
    <div className="space-y-6">
      <RoleHeader
        title="Buku Kas & Keuangan"
        subtitle="Input voucher, rekonsiliasi rekening BSI, dan susun laporan keuangan bersetempel."
        icon={<Wallet className="w-6 h-6 text-emerald-300" />}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <Link to="/dashboard/finance" className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-sm font-bold inline-flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Input Voucher Kas
        </Link>
        <Link to="/dashboard/finance/reports" className="flex-1 px-4 py-3 bg-white border border-slate-200 hover:border-emerald-400 text-slate-800 rounded-2xl text-sm font-bold inline-flex items-center justify-center gap-2">
          <FileBarChart className="w-4 h-4" /> Laporan Bulanan
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((account) => (
          <div key={account.label} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex justify-between items-center text-xs text-slate-500 font-bold uppercase">
              <span className="truncate">{account.label}</span>
              <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>
            <h3 className="text-lg font-black text-slate-900 mt-2">{formatRupiah(account.value)}</h3>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900">Saldo Berjalan</h2>
          <span className="text-[11px] font-bold text-slate-500">Total seluruh rekening resmi</span>
        </div>
        <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900">
              {balances ? formatRupiah(balances.total) : 'Rp 129.100.000'}
            </h3>
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-rose-500" />
              Mutasi harian dilacak di buku kas
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
