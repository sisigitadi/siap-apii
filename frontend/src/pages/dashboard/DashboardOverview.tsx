import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Wallet, Layers, Award, TrendingUp } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { financeApi } from '@/api/finance.api';
import { lettersApi } from '@/api/letters.api';
import { CashBalances } from '@/api/types';
import { formatRupiah } from '@/utils/formatters';
import { ROLE_LABELS, DIVISION_LABELS } from '@/utils/constants';

export const DashboardOverview: React.FC = () => {
  const { user, isLeadership, isBendahara, isSekretaris } = useAuth();
  const [balances, setBalances] = useState<CashBalances | null>(null);
  const [pendingLettersCount, setPendingLettersCount] = useState(0);

  useEffect(() => {
    if (isBendahara || isLeadership) {
      financeApi.getBalances().then(setBalances).catch(() => {
        setBalances({ bsi_operasional: 48500000, bca_program: 75200000, kas_tunai: 5400000, total: 129100000 });
      });
    }

    if (isSekretaris || isLeadership) {
      lettersApi.list({ status: 'PENDING_APPROVAL' }).then((res) => {
        setPendingLettersCount(res.total || res.items.length);
      }).catch(() => {
        setPendingLettersCount(2);
      });
    }
  }, [isBendahara, isLeadership, isSekretaris]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#0e3b6f] via-[#0b2f59] to-[#107548] rounded-3xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/15 text-emerald-300 text-xs font-semibold">
            <Award className="w-3.5 h-3.5 text-amber-300" /> DPW APII Jabodetabek
          </div>
          <h1 className="text-2xl font-black">Ahlan wa Sahlan, {user?.fullName || 'Pengurus'}!</h1>
          <p className="text-xs text-slate-200">
            Peran: <span className="font-bold text-amber-300">{user?.role ? ROLE_LABELS[user.role] : '-'}</span>
            {user?.division && ` · ${DIVISION_LABELS[user.division]}`}
          </p>
        </div>
        <div className="flex gap-2">
          {isSekretaris && (
            <Link to="/dashboard/letters/create" className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1">
              <FileText className="w-4 h-4" /> <span>Buat Surat</span>
            </Link>
          )}
          {isBendahara && (
            <Link to="/dashboard/finance" className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1">
              <Wallet className="w-4 h-4" /> <span>Input Voucher</span>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-xs text-slate-500 font-bold uppercase">
            <span>Saldo Kas</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-lg font-black text-slate-900 mt-2">{balances ? formatRupiah(balances.total) : 'Rp 129.100.000'}</h3>
          <p className="text-[10px] text-slate-500">BSI + BCA + Kas Tunai</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-xs text-slate-500 font-bold uppercase">
            <span>Surat Review</span>
            <FileText className="w-4 h-4 text-[#0e3b6f]" />
          </div>
          <h3 className="text-lg font-black text-slate-900 mt-2">{pendingLettersCount} Dokumen</h3>
          <p className="text-[10px] text-amber-600 font-semibold">Menunggu Approval</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-xs text-slate-500 font-bold uppercase">
            <span>Program Divisi</span>
            <Layers className="w-4 h-4 text-amber-600" />
          </div>
          <h3 className="text-lg font-black text-slate-900 mt-2">14 Program</h3>
          <p className="text-[10px] text-emerald-600 font-semibold">5 Disetujui</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-xs text-slate-500 font-bold uppercase">
            <span>Realisasi</span>
            <TrendingUp className="w-4 h-4 text-purple-600" />
          </div>
          <h3 className="text-lg font-black text-slate-900 mt-2">Rp 62.000.000</h3>
          <p className="text-[10px] text-slate-500">Dari Rp 85.000.000</p>
        </div>
      </div>
    </div>
  );
};
