import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Calendar, CreditCard, ArrowRight, CheckCircle2, Search, FileText } from 'lucide-react';
import { publicApi } from '@/api/public.api';
import { PublicFeedItem } from '@/api/types';
import { formatDateIndo } from '@/utils/formatters';

export const LandingPage: React.FC = () => {
  const [feedItems, setFeedItems] = useState<PublicFeedItem[]>([]);
  const [hashInput, setHashInput] = useState('');

  useEffect(() => {
    publicApi.getPublicFeed(1, 4).then((res) => setFeedItems(res.items)).catch(() => {
      setFeedItems([
        {
          id: 'mock-1',
          letter_number: '001/SK/APII-JB/I/2026',
          title: 'Surat Keputusan Pengesahan Struktur Pengurus DPW Jabodetabek',
          type: 'SURAT_KEPUTUSAN',
          published_at: new Date().toISOString(),
          sha256_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        },
      ]);
    });
  }, []);

  return (
    <div className="space-y-12 pb-16">
      <section className="bg-gradient-to-b from-[#0e3b6f] to-slate-900 text-white py-14 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" /> Portal Resmi DPW APII Jabodetabek
          </div>
          <h1 className="text-3xl sm:text-5xl font-black">
            Pelayanan Administrasi Terpadu
          </h1>
          <p className="text-sm text-slate-300 max-w-lg mx-auto">
            Tata kelola organisasi transparan berbasis integritas digital SHA-256 dan persuratan resmi.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (hashInput.trim()) window.location.href = `/verify/${hashInput.trim()}`;
            }}
            className="flex items-center bg-white/10 p-1 rounded-xl border border-white/20 max-w-md mx-auto"
          >
            <Search className="w-4 h-4 text-slate-300 ml-2" />
            <input
              type="text"
              placeholder="Hash SHA-256 Dokumen..."
              value={hashInput}
              onChange={(e) => setHashInput(e.target.value)}
              className="w-full bg-transparent px-2 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-hidden"
            />
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold">
              Verifikasi
            </button>
          </form>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/verify" className="p-6 bg-white rounded-2xl border border-slate-200 hover:border-emerald-500 transition-all">
          <ShieldCheck className="w-8 h-8 text-teal-600 mb-2" />
          <h3 className="font-bold text-slate-900 mb-1">Verifikasi Dokumen</h3>
          <p className="text-xs text-slate-600 mb-4">Validasi keaslian SK & surat resmi berbasis tanda tangan digital.</p>
          <span className="text-xs font-bold text-teal-700 inline-flex items-center gap-1">Buka Verifikator <ArrowRight className="w-3.5 h-3.5" /></span>
        </Link>
        <Link to="/schedule" className="p-6 bg-white rounded-2xl border border-slate-200 hover:border-[#0e3b6f] transition-all">
          <Calendar className="w-8 h-8 text-[#0e3b6f] mb-2" />
          <h3 className="font-bold text-slate-900 mb-1">Jadwal Kajian & Kegiatan</h3>
          <p className="text-xs text-slate-600 mb-4">Agenda kajian, pelatihan, dan program kerja DPW APII.</p>
          <span className="text-xs font-bold text-[#0e3b6f] inline-flex items-center gap-1">Lihat Jadwal <ArrowRight className="w-3.5 h-3.5" /></span>
        </Link>
        <Link to="/members/me" className="p-6 bg-white rounded-2xl border border-slate-200 hover:border-amber-500 transition-all">
          <CreditCard className="w-8 h-8 text-amber-600 mb-2" />
          <h3 className="font-bold text-slate-900 mb-1">e-KTA Digital 5 Tahun</h3>
          <p className="text-xs text-slate-600 mb-4">Kartu anggota resmi dengan QR Code validasi keanggotaan.</p>
          <span className="text-xs font-bold text-amber-700 inline-flex items-center gap-1">Akses e-KTA <ArrowRight className="w-3.5 h-3.5" /></span>
        </Link>
      </section>

      <section className="max-w-5xl mx-auto px-4">
        <div className="bg-slate-900 text-white rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-3">Warta Resmi & Surat Terbit</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {feedItems.map((item) => (
              <div key={item.id} className="p-4 bg-slate-800 rounded-xl border border-slate-700 text-xs">
                <div className="flex justify-between text-slate-400 mb-1">
                  <span className="font-mono text-emerald-400 font-semibold">{item.letter_number}</span>
                  <span>{formatDateIndo(item.published_at)}</span>
                </div>
                <h4 className="text-sm font-bold text-white mb-2">{item.title}</h4>
                <Link to={`/verify/${item.sha256_hash}`} className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Cek Keaslian
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
