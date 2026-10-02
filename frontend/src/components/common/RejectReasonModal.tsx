import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface RejectReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  title?: string;
  description?: string;
  confirmLabel?: string;
}

export const RejectReasonModal: React.FC<RejectReasonModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Tolak Dokumen',
  description = 'Berikan catatan revisi yang jelas agar pemohon dapat memperbaiki pengajuan.',
  confirmLabel = 'Tolak & Kirim Catatan',
}) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
      setReason('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} description={description} size="md">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-800 leading-relaxed">
            Tindakan ini akan mengubah status menjadi <span className="font-bold">Ditolak / Perlu Revisi</span> dan
            memberitahu pemohon melalui notifikasi real-time.
          </p>
        </div>

        <div>
          <label htmlFor="reject-reason" className="block text-xs font-bold text-slate-700 mb-1.5">
            Catatan Revisi <span className="text-rose-600">*</span>
          </label>
          <textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Contoh: Format kop surat belum sesuai standar APII, mohon perbarui nomor referensi..."
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 resize-none"
            autoFocus
          />
          <p className="text-[10px] text-slate-400 mt-1">Minimal 10 karakter.</p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reason.trim() || reason.trim().length < 10 || submitting}
            className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {submitting && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
