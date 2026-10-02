import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Send, ArrowLeft, FileText, Eye } from 'lucide-react';
import { lettersApi } from '@/api/letters.api';
import { LetterSignatory, LetterType } from '@/api/types';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/common/PageHeader';
import { LETTER_TYPE_LABELS } from '@/utils/constants';
import { formatLetterNumberPreview } from '@/utils/formatters';

const TYPE_CODES: Record<LetterType, string> = {
  SURAT_KEPUTUSAN: 'SK',
  SURAT_TUGAS: 'ST',
  SURAT_KETERANGAN: 'SKet',
  SURAT_UNDANGAN: 'SU',
  SURAT_PERMOHONAN: 'SP',
  SURAT_PEMBERITAHUAN: 'SPb',
  SURAT_REKOMENDASI: 'SR',
  BERITA_ACARA: 'BA',
  MEMORANDUM: 'MO',
  LAINNYA: 'LAIN',
};

const LETTER_TYPES = Object.keys(LETTER_TYPE_LABELS) as LetterType[];

const DEFAULT_SIGNATORIES: LetterSignatory[] = [
  { role: 'SEKRETARIS', name: 'Muhammad Rizki, S.T.', title: 'Sekretaris Wilayah DPW APII', position: 'left' },
  { role: 'KETUA_UMUM', name: 'Dr. H. Ahmad Fauzi', title: 'Ketua DPW APII Jabodetabek', position: 'right' },
];

export const LetterCreatePage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const isEditing = Boolean(id);

  const [type, setType] = useState<LetterType>('SURAT_KEPUTUSAN');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [regarding, setRegarding] = useState('');
  const [recipient, setRecipient] = useState('');
  const [bodyHtml, setBodyHtml] = useState(
    '<p>Dengan hormat,</p>\n<p>Sehubungan dengan ... , kami sampaikan hal-hal sebagai berikut:</p>\n<p>Demikian surat ini kami sampaikan, atas perhatian dan kerja samanya kami ucapkan terima kasih.</p>'
  );
  const [signatories, setSignatories] = useState<LetterSignatory[]>(DEFAULT_SIGNATORIES);
  const [sequence, setSequence] = useState(1);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEditing);

  const letterNumberPreview = useMemo(() => {
    const now = new Date();
    return formatLetterNumberPreview(TYPE_CODES[type], sequence, now.getMonth() + 1, now.getFullYear());
  }, [type, sequence]);

  useEffect(() => {
    if (!id) return;
    lettersApi
      .getById(id)
      .then((letter) => {
        setType(letter.type);
        setTitle(letter.title);
        setSubject(letter.subject);
        setRegarding(letter.regarding || '');
        setRecipient(letter.recipient);
        setBodyHtml(letter.body_html);
        if (letter.signatories?.length) setSignatories(letter.signatories);
      })
      .catch((err) => {
        showError('Gagal Memuat Draf', err instanceof Error ? err.message : 'Surat tidak ditemukan');
        navigate('/dashboard/letters');
      })
      .finally(() => setLoading(false));
  }, [id, navigate, showError]);

  const validate = (): boolean => {
    if (!title.trim() || !subject.trim() || !recipient.trim() || !bodyHtml.trim()) {
      showError('Form Belum Lengkap', 'Judul, perihal, penerima, dan isi surat wajib diisi.');
      return false;
    }
    return true;
  };

  const buildPayload = () => ({
    letter_number: letterNumberPreview,
    type,
    title: title.trim(),
    subject: subject.trim(),
    regarding: regarding.trim() || undefined,
    recipient: recipient.trim(),
    body_html: bodyHtml,
    signatories,
  });

  const handleSaveDraft = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEditing && id) {
        await lettersApi.update(id, buildPayload());
        success('Draf Diperbarui', 'Perubahan surat berhasil disimpan.');
      } else {
        const created = await lettersApi.create(buildPayload());
        success('Draf Tersimpan', `Surat ${created.letter_number} berhasil dibuat sebagai draf.`);
        navigate(`/dashboard/letters/${created.id}`);
        return;
      }
    } catch (err) {
      showError('Gagal Menyimpan', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      let targetId = id;
      if (isEditing && id) {
        await lettersApi.update(id, buildPayload());
      } else {
        const created = await lettersApi.create(buildPayload());
        targetId = created.id;
      }
      if (targetId) {
        await lettersApi.submit(targetId);
        success('Surat Diajukan', 'Draf telah dikirim ke Ketua DPW untuk persetujuan & tanda tangan digital.');
        navigate(`/dashboard/letters/${targetId}`);
      }
    } catch (err) {
      showError('Gagal Mengajukan', err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-[#0e3b6f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const inputClass =
    'w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400';
  const labelClass = 'block text-xs font-bold text-slate-700 mb-1';

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader
        title={isEditing ? 'Edit Draf Surat Resmi' : 'Buat Surat Resmi Baru'}
        subtitle="Sekretaris menyusun draf; nomor surat dibangkitkan otomatis sesuai tipe dokumen."
        actions={
          <button
            onClick={() => navigate('/dashboard/letters')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali
          </button>
        }
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Tipe Surat</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as LetterType)}
              className={inputClass}
            >
              {LETTER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LETTER_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Nomor Surat (Otomatis)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={sequence}
                onChange={(e) => setSequence(Math.max(1, Number(e.target.value) || 1))}
                className={`${inputClass} w-20 shrink-0`}
              />
              <span className="text-[11px] font-mono font-bold text-[#0e3b6f] bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-2 truncate flex-1">
                {letterNumberPreview}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Format: NoUrut/Kode/APII-JB/BulanRomawi/Tahun</p>
          </div>
        </div>

        <div>
          <label className={labelClass}>Judul Surat <span className="text-rose-600">*</span></label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Contoh: Surat Keputusan Pengesahan Struktur Pengurus"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Perihal <span className="text-rose-600">*</span></label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Contoh: Pengesahan Struktur Organisasi"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Perihal Tambahan / Lampiran</label>
            <input
              type="text"
              value={regarding}
              onChange={(e) => setRegarding(e.target.value)}
              placeholder="Opsional: 1 Berkas Rapor Kegiatan"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Penerima / Yang Terhormat <span className="text-rose-600">*</span></label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Contoh: Seluruh Anggota & Pengurus DPW APII Jabodetabek"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Isi Surat (HTML) <span className="text-rose-600">*</span></label>
          <textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            rows={9}
            placeholder="Tulis isi surat dalam format HTML dasar (&lt;p&gt;, &lt;b&gt;, &lt;ul&gt;, &lt;li&gt;)..."
            className={`${inputClass} font-mono resize-y leading-relaxed`}
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Konten akan dirender ke PDF resmi ber-kop APII dengan tanda tangan digital & stempel basah.
          </p>
        </div>

        <div>
          <label className={labelClass}>Penandatangan Resmi</label>
          <div className="space-y-2">
            {signatories.map((sig, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-[#0e3b6f] bg-white border border-slate-200 rounded px-2 py-1 shrink-0">
                  {sig.role === 'KETUA_UMUM' ? 'Ketua DPW' : sig.role === 'SEKRETARIS' ? 'Sekretaris' : 'Bendahara'}
                </span>
                <input
                  type="text"
                  value={sig.name}
                  onChange={(e) => {
                    const next = [...signatories];
                    next[idx] = { ...sig, name: e.target.value };
                    setSignatories(next);
                  }}
                  placeholder="Nama lengkap dengan gelar"
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
                <select
                  value={sig.position}
                  onChange={(e) => {
                    const next = [...signatories];
                    next[idx] = { ...sig, position: e.target.value as LetterSignatory['position'] };
                    setSignatories(next);
                  }}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-700 focus:outline-none"
                >
                  <option value="left">Posisi Kiri</option>
                  <option value="center">Posisi Tengah</option>
                  <option value="right">Posisi Kanan</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={handleSaveDraft}
            disabled={saving || submitting}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Draf
          </button>
          <button
            onClick={handleSaveAndSubmit}
            disabled={saving || submitting}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#0e3b6f] hover:bg-[#092547] text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
            Simpan &amp; Ajukan ke Ketua DPW
          </button>
        </div>
      </div>

      <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 flex items-start gap-3">
        <Eye className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="text-xs text-sky-900 leading-relaxed">
          <p className="font-bold flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> Pratinjau dokumen resmi
          </p>
          <p className="mt-0.5">
            Setelah disimpan, buka halaman detail untuk melihat render HTML A4 lengkap dengan kop surat, stempel basah,
            tanda tangan digital, QR Code verifikasi, dan sidik jari SHA-256.
          </p>
        </div>
      </div>
    </div>
  );
};
