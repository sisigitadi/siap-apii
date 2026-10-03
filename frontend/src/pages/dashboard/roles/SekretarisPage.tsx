import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PenLine, FileText, Archive, Plus } from 'lucide-react';
import { RoleHeader } from '@/components/common/RoleHeader';
import { useAuth } from '@/context/AuthContext';
import { lettersApi } from '@/api/letters.api';
import { OfficialLetter } from '@/api/types';

/**
 * Halaman Sekretaris: persuratan resmi — draf, surat masuk, penomoran, arsip.
 */
export const SekretarisPage: React.FC = () => {
  const { isSekretaris } = useAuth();
  const [drafts, setDrafts] = useState<OfficialLetter[]>([]);
  const [published, setPublished] = useState<OfficialLetter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSekretaris) return;
    Promise.allSettled([
      lettersApi.list({ status: 'DRAFT' }),
      lettersApi.list({ status: 'PUBLISHED' }),
    ]).then(([draftRes, publishedRes]) => {
      if (draftRes.status === 'fulfilled') setDrafts(draftRes.value.items);
      if (publishedRes.status === 'fulfilled') setPublished(publishedRes.value.items);
      setLoading(false);
    });
  }, [isSekretaris]);

  return (
    <div className="space-y-6">
      <RoleHeader
        title="Sekretariat & Persuratan Resmi"
        subtitle="Kelola surat masuk/keluar, draf SK, penomoran otomatis, dan arsip."
        icon={<PenLine className="w-6 h-6 text-emerald-300" />}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <Link to="/dashboard/letters/create" className="flex-1 px-4 py-3 bg-[#0e3b6f] hover:bg-[#0b2f59] text-white rounded-2xl text-sm font-bold inline-flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Buat Surat Resmi Baru
        </Link>
        <Link to="/dashboard/letters" className="flex-1 px-4 py-3 bg-white border border-slate-200 hover:border-[#0e3b6f] text-slate-800 rounded-2xl text-sm font-bold inline-flex items-center justify-center gap-2">
          <FileText className="w-4 h-4" /> Kelola Semua Surat
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Draf Aktif</h2>
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              {loading ? '…' : drafts.length}
            </span>
          </div>
          <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-slate-400 text-center py-6">Memuat…</p>
            ) : drafts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Belum ada draf. Buat surat baru untuk memulai.</p>
            ) : (
              drafts.map((letter) => (
                <Link key={letter.id} to={`/dashboard/letters/${letter.id}/edit`} className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{letter.title}</p>
                    <p className="text-[10px] text-slate-500 truncate">{letter.letter_number || 'Nomor otomatis saat submit'}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold text-amber-700">Draf</span>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Archive className="w-4 h-4 text-slate-500" /> Sudah Dirilis
            </h2>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              {loading ? '…' : published.length}
            </span>
          </div>
          <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-slate-400 text-center py-6">Memuat…</p>
            ) : published.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Belum ada surat yang dirilis.</p>
            ) : (
              published.map((letter) => (
                <Link key={letter.id} to={`/dashboard/letters/${letter.id}`} className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{letter.title}</p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">{letter.letter_number}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold text-emerald-700">Rilis</span>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
