import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  FileSignature,
  CheckCircle2,
  XCircle,
  Archive,
  Edit3,
  Send,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { lettersApi } from '@/api/letters.api';
import { OfficialLetter } from '@/api/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge, LetterTypeBadge, DivisionBadge } from '@/components/common/StatusBadge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { RejectReasonModal } from '@/components/common/RejectReasonModal';
import { LetterPreview } from '@/components/letters/LetterPreview';
import { formatDateIndo } from '@/utils/formatters';

export const LetterDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSekretaris, isKetua } = useAuth();
  const { success, error: showError } = useToast();

  const [letter, setLetter] = useState<OfficialLetter | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchLetter = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await lettersApi.getById(id);
      setLetter(data);
    } catch (err) {
      showError('Surat Tidak Ditemukan', err instanceof Error ? err.message : 'Dokumen mungkin telah diarsipkan');
      navigate('/dashboard/letters');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, showError]);

  useEffect(() => {
    fetchLetter();
  }, [fetchLetter]);

  const handleApproveAndPublish = async () => {
    if (!letter) return;
    setActionLoading('approve');
    try {
      const updated = await lettersApi.approveAndPublish(letter.id);
      setLetter(updated);
      success('Surat Diterbitkan', `${updated.letter_number} kini berstatus Rilis Resmi & ditandatangani digital.`);
    } catch (err) {
      showError('Gagal Menyetujui', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (reason: string) => {
    if (!letter) return;
    setActionLoading('reject');
    try {
      const updated = await lettersApi.reject(letter.id, reason);
      setLetter(updated);
      success('Surat Ditolak', 'Catatan revisi telah dikirim kepada Sekretaris.');
    } catch (err) {
      showError('Gagal Menolak', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmit = async () => {
    if (!letter) return;
    setActionLoading('submit');
    try {
      const updated = await lettersApi.submit(letter.id);
      setLetter(updated);
      success('Surat Diajukan', 'Menunggu persetujuan & tanda tangan Ketua DPW.');
    } catch (err) {
      showError('Gagal Mengajukan', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchive = async () => {
    if (!letter) return;
    setActionLoading('archive');
    try {
      const updated = await lettersApi.archive(letter.id);
      setLetter(updated);
      success('Surat Diarsipkan', `${updated.letter_number} telah dipindahkan ke arsip resmi.`);
    } catch (err) {
      showError('Gagal Mengarsipkan', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (!letter) return;
    setActionLoading('download');
    try {
      const blob = await lettersApi.downloadPdf(letter.id);
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `${letter.letter_number.replace(/[^a-zA-Z0-9._-]/g, '-')}.pdf`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      success('PDF Diunduh', `Versi PDF ${letter.letter_number} berhasil diunduh (immutable).`);
    } catch (err) {
      showError('Gagal Mengunduh PDF', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" label="Memuat dokumen resmi..." className="min-h-[50vh]" />;
  }

  if (!letter) {
    return null;
  }

  const canEdit = isSekretaris && (letter.status === 'DRAFT' || letter.status === 'REJECTED');
  const canSubmit = isSekretaris && (letter.status === 'DRAFT' || letter.status === 'REJECTED');
  const canApprove = isKetua && letter.status === 'PENDING_APPROVAL';
  const canArchive = (isSekretaris || isKetua) && letter.status === 'PUBLISHED';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Detail & Alur Persetujuan"
        subtitle={`${letter.letter_number} · ${letter.title}`}
        actions={
          <button
            onClick={() => navigate('/dashboard/letters')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" /> Daftar Surat
          </button>
        }
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <StatusBadge status={letter.status} className="text-xs px-2.5 py-1" />
          <LetterTypeBadge type={letter.type} />
          {letter.division && <DivisionBadge division={letter.division} />}
          <span className="text-[11px] text-slate-500">Diperbarui {formatDateIndo(letter.updatedAt, true)}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <Link
              to={`/dashboard/letters/${letter.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Draf
            </Link>
          )}
          {canSubmit && (
            <button
              onClick={handleSubmit}
              disabled={actionLoading !== null}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            >
              {actionLoading === 'submit' ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Ajukan ke Ketua DPW
            </button>
          )}
          {canApprove && (
            <>
              <button
                onClick={handleApproveAndPublish}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                {actionLoading === 'approve' ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FileSignature className="w-3.5 h-3.5" />}
                Setujui &amp; Tanda Tangani
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" /> Tolak &amp; Revisi
              </button>
            </>
          )}
          {canArchive && (
            <button
              onClick={handleArchive}
              disabled={actionLoading !== null}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            >
              {actionLoading === 'archive' ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
              Arsipkan
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors no-print"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak
          </button>
          {(letter.status === 'PUBLISHED' || letter.status === 'PENDING_APPROVAL' || letter.status === 'ARCHIVED') && (
            <button
              onClick={handleDownloadPdf}
              disabled={actionLoading !== null}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#0e3b6f] hover:bg-[#0b2f59] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 no-print"
            >
              {actionLoading === 'download' ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Unduh PDF
            </button>
          )}
        </div>
      </div>

      {letter.status === 'REJECTED' && letter.rejection_reason && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-900">
            <p className="font-bold">Catatan Revisi dari Ketua DPW:</p>
            <p className="mt-0.5 leading-relaxed">{letter.rejection_reason}</p>
          </div>
        </div>
      )}

      {letter.status === 'PUBLISHED' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-xs text-emerald-900 flex-1 min-w-0">
            <p className="font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Dokumen Sah &amp; Terverifikasi Integritas
            </p>
            <p className="font-mono text-[10px] text-emerald-700 mt-0.5 break-all">SHA-256: {letter.sha256_hash}</p>
          </div>
          <Link
            to={`/verify/${letter.sha256_hash}`}
            target="_blank"
            className="text-[10px] font-bold text-emerald-700 border border-emerald-300 rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 shrink-0"
          >
            Buka Verifikator Publik
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Pembuat</p>
          <p className="text-xs font-semibold text-slate-900 mt-1 truncate">{letter.creator?.fullName || 'Sekretaris Wilayah'}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Pemberi Persetujuan</p>
          <p className="text-xs font-semibold text-slate-900 mt-1 truncate">{letter.approver?.fullName || (letter.status === 'PUBLISHED' ? 'Ketua DPW' : '-')}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Tgl Rilis</p>
          <p className="text-xs font-semibold text-slate-900 mt-1">{letter.published_at ? formatDateIndo(letter.published_at) : '-'}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Penerima</p>
          <p className="text-xs font-semibold text-slate-900 mt-1 truncate">{letter.recipient}</p>
        </div>
      </div>

      <div className="no-print">
        <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
          <FileSignature className="w-4 h-4 text-[#0e3b6f]" /> Pratinjau Dokumen Resmi (A4)
        </h3>
      </div>
      <LetterPreview letter={letter} />

      <RejectReasonModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleReject}
        title="Tolak Surat Resmi"
        description="Surat akan dikembalikan kepada Sekretaris beserta catatan revisi untuk diperbaiki."
        confirmLabel="Tolak &amp; Kirim Catatan"
      />
    </div>
  );
};
