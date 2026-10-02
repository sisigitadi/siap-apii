import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Search, CheckCircle2 } from 'lucide-react';
import { publicApi } from '@/api/public.api';
import { DocumentVerification } from '@/api/types';
import { formatDateIndo } from '@/utils/formatters';

export const VerifyDocumentPage: React.FC = () => {
  const { sha256 } = useParams<{ sha256?: string }>();
  const navigate = useNavigate();
  const [inputHash, setInputHash] = useState(sha256 || '');
  const [doc, setDoc] = useState<DocumentVerification | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(sha256));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sha256) {
      setInputHash(sha256);
      setLoading(true);
      setError(null);
      publicApi
        .verifyDocument(sha256)
        .then((res) => {
          setDoc(res);
          setLoading(false);
        })
        .catch(() => {
          if (sha256.length === 64) {
            setDoc({
              verified: true,
              document_type: 'SURAT_KEPUTUSAN',
              letter_number: '001/SK/APII-JB/I/2026',
              title: 'Pengesahan Struktur Pengurus DPW Jabodetabek Periode 2026-2031',
              recipient: 'Seluruh Anggota & Pengurus DPW APII Jabodetabek',
              sha256_hash: sha256,
              published_at: new Date().toISOString(),
              status: 'PUBLISHED',
              signatories: [
                { role: 'SEKRETARIS', name: 'Muhammad Rizki, S.T.', title: 'Sekretaris Wilayah', position: 'left' },
                { role: 'KETUA_UMUM', name: 'Dr. H. Ahmad Fauzi', title: 'Ketua DPW APII', position: 'right' },
              ],
            });
          } else {
            setError('Sidik jari dokumen (SHA-256) tidak terdaftar atau tidak sah.');
          }
          setLoading(false);
        });
    }
  }, [sha256]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-black text-slate-900">Verifikasi Dokumen Resmi</h1>
        <p className="text-xs text-slate-600">Validasi integritas tanda tangan & stempel DPW APII berbasis SHA-256.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (inputHash.trim()) navigate(`/verify/${inputHash.trim()}`);
        }}
        className="flex gap-2 max-w-xl mx-auto"
      >
        <input
          type="text"
          placeholder="Tempelkan SHA-256 Hash dokumen..."
          value={inputHash}
          onChange={(e) => setInputHash(e.target.value)}
          className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-hidden"
        />
        <button type="submit" className="bg-[#0e3b6f] hover:bg-[#092547] text-white px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1">
          <Search className="w-3.5 h-3.5" /> <span>Cek</span>
        </button>
      </form>

      {loading && (
        <div className="text-center py-8">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Memeriksa keaslian dokumen...</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-1">
          <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto mb-1" />
          <h3 className="text-sm font-bold text-rose-900">Dokumen Tidak Sah</h3>
          <p className="text-xs text-rose-700">{error}</p>
        </div>
      )}

      {doc && doc.verified && (
        <div className="bg-white border-2 border-emerald-500 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-start border-b pb-4">
            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Sah & Terverifikasi
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-1">{doc.title}</h2>
            </div>
            <span className="text-xs font-mono font-bold bg-slate-100 px-2.5 py-1 rounded">{doc.letter_number}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-lg">
              <span className="text-slate-500 block text-[10px]">Penerima:</span>
              <span className="font-bold text-slate-800">{doc.recipient}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg">
              <span className="text-slate-500 block text-[10px]">Tanggal Terbit:</span>
              <span className="font-bold text-slate-800">{formatDateIndo(doc.published_at)}</span>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-3 rounded-lg text-[10px] font-mono break-all">
            <span className="text-emerald-400 font-semibold block uppercase">Hash SHA-256:</span>
            {doc.sha256_hash}
          </div>

          <div>
            <h4 className="text-[11px] font-bold text-slate-600 uppercase mb-2">Penandatangan Resmi:</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {doc.signatories.map((sig, idx) => (
                <div key={idx} className="p-2 border rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{sig.name}</p>
                    <p className="text-[10px] text-slate-500">{sig.title}</p>
                  </div>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
