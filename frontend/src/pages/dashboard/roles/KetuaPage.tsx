import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gavel, FileText, Wallet, Layers, CheckCircle2 } from 'lucide-react';
import { RoleHeader } from '@/components/common/RoleHeader';
import { useAuth } from '@/context/AuthContext';
import { lettersApi } from '@/api/letters.api';
import { financeApi } from '@/api/finance.api';
import { OfficialLetter, CashFlow } from '@/api/types';
import { formatRupiah } from '@/utils/formatters';

/**
 * Halaman Ketua: Approval Board — semua yang butuh persetujuan tunggal
 * (surat, voucher kas, usulan program) dalam satu layar (PRD Persona A).
 */
export const KetuaPage: React.FC = () => {
  const { isKetua } = useAuth();
  const [pendingLetters, setPendingLetters] = useState<OfficialLetter[]>([]);
  const [pendingVouchers, setPendingVouchers] = useState<CashFlow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isKetua) return;
    Promise.allSettled([
      lettersApi.list({ status: 'PENDING_APPROVAL' }),
      financeApi.listVouchers({ status: 'VERIFIED_BENDAHARA' }),
    ]).then(([letters, vouchers]) => {
      if (letters.status === 'fulfilled') setPendingLetters(letters.value.items);
      if (vouchers.status === 'fulfilled') setPendingVouchers(vouchers.value.items);
      setLoading(false);
    });
  }, [isKetua]);

  return (
    <div className="space-y-6">
      <RoleHeader
        title="Approval Board Ketua"
        subtitle="Semua persetujuan tunggal: surat resmi, voucher kas, dan usulan program kerja."
        icon={<Gavel className="w-6 h-6 text-emerald-300" />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link to="/dashboard/letters?status=PENDING_APPROVAL" className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-[#0e3b6f] transition-colors">
          <div className="flex justify-between items-center text-xs text-slate-500 font-bold uppercase">
            <span>Surat Menunggu</span>
            <FileText className="w-4 h-4 text-[#0e3b6f]" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mt-2">{loading ? '…' : pendingLetters.length}</h3>
          <p className="text-[10px] text-amber-600 font-semibold">Butuh persetujuan &amp; rilis</p>
        </Link>

        <Link to="/dashboard/finance?status=VERIFIED_BENDAHARA" className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-[#0e3b6f] transition-colors">
          <div className="flex justify-between items-center text-xs text-slate-500 font-bold uppercase">
            <span>Voucher Menunggu</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mt-2">{loading ? '…' : pendingVouchers.length}</h3>
          <p className="text-[10px] text-amber-600 font-semibold">Sudah ditandatangani Bendahara</p>
        </Link>

        <Link to="/dashboard/divisions/DIV_HUMAS" className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-[#0e3b6f] transition-colors">
          <div className="flex justify-between items-center text-xs text-slate-500 font-bold uppercase">
            <span>Usulan Program</span>
            <Layers className="w-4 h-4 text-amber-600" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mt-2">7 Divisi</h3>
          <p className="text-[10px] text-emerald-600 font-semibold">Lihat agregat &amp; kalender</p>
        </Link>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Antrian Surat Resmi</h2>
            <Link to="/dashboard/letters" className="text-[11px] font-bold text-[#0e3b6f] hover:underline">Lihat semua</Link>
          </div>
          <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-slate-400 text-center py-6">Memuat…</p>
            ) : pendingLetters.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Tidak ada surat menunggu persetujuan.</p>
            ) : (
              pendingLetters.map((letter) => (
                <div key={letter.id} className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{letter.title}</p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">{letter.letter_number}</p>
                  </div>
                  <Link to={`/dashboard/letters/${letter.id}`} className="shrink-0 px-2.5 py-1 bg-[#0e3b6f] text-white rounded-lg text-[10px] font-bold">
                    Review
                  </Link>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Antrian Voucher Kas</h2>
            <Link to="/dashboard/finance" className="text-[11px] font-bold text-[#0e3b6f] hover:underline">Lihat semua</Link>
          </div>
          <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-slate-400 text-center py-6">Memuat…</p>
            ) : pendingVouchers.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Tidak ada voucher menunggu persetujuan.</p>
            ) : (
              pendingVouchers.map((voucher) => (
                <div key={voucher.id} className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{voucher.description}</p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">{voucher.voucher_number}</p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-slate-900">{formatRupiah(voucher.amount)}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <p className="text-xs text-emerald-900">
          <span className="font-bold">Kontrol ganda:</span> voucher hanya bisa Anda tandatangani setelah Bendahara
          menandatanganinya terlebih dahulu. Surat hanya dirilis setelah Sekretaris mengajukannya.
        </p>
      </div>
    </div>
  );
};
