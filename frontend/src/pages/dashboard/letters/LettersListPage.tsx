import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus, Search, FileSignature, Archive } from 'lucide-react';
import { lettersApi } from '@/api/letters.api';
import { LetterStatus, OfficialLetter } from '@/api/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge, LetterTypeBadge } from '@/components/common/StatusBadge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { formatDateIndo } from '@/utils/formatters';

const STATUS_FILTERS: { value: '' | LetterStatus; label: string }[] = [
  { value: '', label: 'Semua Status' },
  { value: 'DRAFT', label: 'Draf' },
  { value: 'PENDING_APPROVAL', label: 'Menunggu Persetujuan' },
  { value: 'PUBLISHED', label: 'Rilis Resmi' },
  { value: 'REJECTED', label: 'Ditolak' },
  { value: 'ARCHIVED', label: 'Diarsipkan' },
];

export const LettersListPage: React.FC = () => {
  const { isSekretaris, isKetua } = useAuth();
  const { error: showError } = useToast();
  const [letters, setLetters] = useState<OfficialLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'' | LetterStatus>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLetters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lettersApi.list({
        status: statusFilter || undefined,
        search: search.trim() || undefined,
        page,
        limit: 10,
      });
      setLetters(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      showError('Gagal Memuat Surat', err instanceof Error ? err.message : 'Server tidak merespons');
      setLetters([
        {
          id: 'demo-1',
          letter_number: '001/SK/APII-JB/I/2026',
          type: 'SURAT_KEPUTUSAN',
          title: 'Pengesahan Struktur Pengurus DPW Jabodetabek Periode 2026-2031',
          subject: 'Pengesahan Struktur Organisasi',
          regarding: null,
          recipient: 'Seluruh Anggota & Pengurus DPW APII Jabodetabek',
          body_html: '<p>Dengan hormat,</p>',
          division: null,
          signatories: [],
          sha256_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
          qr_verify_url: '',
          status: 'PUBLISHED',
          rejection_reason: null,
          published_at: new Date().toISOString(),
          created_by: 'demo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'demo-2',
          letter_number: '002/ST/APII-JB/I/2026',
          type: 'SURAT_TUGAS',
          title: 'Penugasan Delegasi Workshop Green Infrastructure Nasional',
          subject: 'Surat Tugas Delegasi',
          regarding: null,
          recipient: 'Divisi Litbang DPW APII',
          body_html: '<p>Dengan hormat,</p>',
          division: 'DIV_LITBANG',
          signatories: [],
          sha256_hash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
          qr_verify_url: '',
          status: 'PENDING_APPROVAL',
          rejection_reason: null,
          published_at: null,
          created_by: 'demo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      setTotal(2);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page, showError]);

  useEffect(() => {
    fetchLetters();
  }, [fetchLetters]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLetters();
  };


  return (
    <div className="space-y-5">
      <PageHeader
        title="Persuratan Resmi DPW"
        subtitle="Tata kelola surat keputusan, tugas, undangan & arsip resmi berbasis integritas SHA-256."
        actions={
          isSekretaris && (
            <Link
              to="/dashboard/letters/create"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0e3b6f] hover:bg-[#092547] text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> <span>Buat Surat Baru</span>
            </Link>
          )
        }
      />

      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor / judul / perihal surat..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-300"
          />
        </form>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as '' | LetterStatus);
            setPage(1);
          }}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-300"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner label="Memuat daftar surat resmi..." />
      ) : letters.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200">
          <EmptyState
            icon={FileText}
            title="Belum Ada Surat Tersimpan"
            description="Daftar surat resmi akan muncul di sini setelah Sekretaris membuat draf pertama."
            action={
              isSekretaris && (
                <Link
                  to="/dashboard/letters/create"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0e3b6f] hover:bg-[#092547] text-white rounded-xl text-xs font-bold"
                >
                  <Plus className="w-4 h-4" /> Buat Surat Pertama
                </Link>
              )
            }
          />
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left">
                    <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nomor &amp; Judul</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Jenis</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Diperbarui</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {letters.map((letter) => (
                    <tr key={letter.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 align-top">
                        <p className="text-[11px] font-mono font-bold text-[#0e3b6f]">{letter.letter_number}</p>
                        <p className="text-xs font-semibold text-slate-900 mt-0.5 line-clamp-1 max-w-xs">{letter.title}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell align-top">
                        <LetterTypeBadge type={letter.type} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StatusBadge status={letter.status} />
                        {letter.status === 'PUBLISHED' && isKetua && (
                          <p className="text-[9px] text-teal-600 font-semibold mt-1 flex items-center gap-0.5">
                            <FileSignature className="w-2.5 h-2.5" /> Ditandatangani
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell align-top">
                        <p className="text-xs text-slate-600">{formatDateIndo(letter.updatedAt, true)}</p>
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <Link
                          to={`/dashboard/letters/${letter.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-[#0e3b6f] hover:text-white text-slate-700 rounded-lg text-[10px] font-bold transition-colors"
                        >
                          {letter.status === 'ARCHIVED' ? <Archive className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                          Detail
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Menampilkan {letters.length} dari {total} surat</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Sebelumnya
              </button>
              <span className="px-2 font-bold text-slate-700">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
