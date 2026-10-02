import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { OfficialLetter } from '@/api/types';
import { formatDateIndo } from '@/utils/formatters';

interface LetterPreviewProps {
  letter: OfficialLetter;
}

export const LetterPreview: React.FC<LetterPreviewProps> = ({ letter }) => {
  return (
    <div className="bg-white text-black p-8 md:p-12 max-w-[800px] mx-auto shadow-xl rounded-lg border border-slate-200 print:shadow-none print:border-none print:p-0">
      {/* KOP SURAT */}
      <div className="flex items-center gap-4 pb-4 border-b-2 border-slate-900 mb-6">
        <div className="w-20 h-20 shrink-0">
          <img
            src="/assets/logo-apii.jpg"
            alt="Logo DPW APII"
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
        <div className="flex-1 text-center pr-10">
          <h2 className="text-sm md:text-base font-bold tracking-wider text-[#0e3b6f] uppercase">
            DEWAN PENGURUS WILAYAH
          </h2>
          <h1 className="text-base md:text-lg font-black text-slate-900 tracking-tight leading-tight uppercase">
            ASOSIASI PENGEMBANG INFRASTRUKTUR INDONESIA
          </h1>
          <p className="text-xs font-bold text-[#107548] tracking-widest uppercase">
            WILAYAH JABODETABEK (JAKARTA, BOGOR, DEPOK, TANGERANG, BEKASI)
          </p>
          <p className="text-[10px] text-slate-600 mt-1">
            Sekretariat: Jabodetabek, DKI Jakarta · Email: sekretariat@apii.org · Portal: https://apii.sigitadi.id
          </p>
        </div>
      </div>

      {/* METADATA SURAT */}
      <div className="flex justify-between items-start text-xs mb-6 leading-relaxed">
        <div className="space-y-1">
          <p>
            <span className="font-semibold w-20 inline-block">Nomor</span>: {letter.letter_number}
          </p>
          <p>
            <span className="font-semibold w-20 inline-block">Lampiran</span>: {letter.regarding ? '1 Berkas' : '-'}
          </p>
          <p>
            <span className="font-semibold w-20 inline-block">Perihal</span>: <span className="font-bold underline">{letter.subject}</span>
          </p>
        </div>
        <div className="text-right">
          <p>Jakarta, {formatDateIndo(letter.published_at || letter.createdAt)}</p>
        </div>
      </div>

      {/* PENERIMA */}
      <div className="text-xs mb-6 leading-relaxed">
        <p>Kepada Yth.</p>
        <p className="font-bold">{letter.recipient}</p>
        <p>di Tempat</p>
      </div>

      {/* ISI SURAT */}
      <div
        className="text-xs leading-relaxed text-justify space-y-3 mb-8 min-h-[160px]"
        dangerouslySetInnerHTML={{ __html: letter.body_html || '<p>Dengan hormat,</p><p>Sehubungan dengan...</p>' }}
      />

      {/* TANDA TANGAN & STEMPEL OVERLAY */}
      <div className="mt-8 pt-4">
        <p className="text-xs text-center font-semibold mb-6">DEWAN PENGURUS WILAYAH APII JABODETABEK</p>

        <div className="relative flex justify-around items-end text-xs text-center">
          {/* Stempel APII Overlay */}
          <div className="absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 pointer-events-none opacity-85 z-20">
            <img
              src="/assets/stempel-apii.png"
              alt="Stempel Basah APII"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          {/* Signatory 1 (Sekretaris / Pembuat) */}
          <div className="w-48 relative z-10">
            <p className="font-medium text-slate-700">Sekretaris Wilayah,</p>
            <div className="h-20 flex items-center justify-center">
              <span className="font-serif italic text-slate-400 text-sm">[Tanda Tangan Digital]</span>
            </div>
            <p className="font-bold underline text-slate-900">Muhammad Rizki, S.T.</p>
            <p className="text-[10px] text-slate-600">NPA. APII-JB-0002</p>
          </div>

          {/* Signatory 2 (Ketua Umum) */}
          <div className="w-48 relative z-10">
            <p className="font-medium text-slate-700">Ketua DPW APII,</p>
            <div className="h-20 flex items-center justify-center">
              <span className="font-serif italic text-slate-400 text-sm">[Tanda Tangan Digital]</span>
            </div>
            <p className="font-bold underline text-slate-900">Dr. H. Ahmad Fauzi</p>
            <p className="text-[10px] text-slate-600">NPA. APII-JB-0001</p>
          </div>
        </div>
      </div>

      {/* FOOTER QR & SHA256 INTEGRITY */}
      <div className="mt-12 pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-600">
        <div className="space-y-0.5">
          <p className="font-semibold text-slate-800">Verifikasi Integritas Dokumen Resmi:</p>
          <p className="font-mono text-[9px] text-slate-500 truncate max-w-sm">
            SHA256: {letter.sha256_hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
          </p>
          <p className="text-[9px] text-teal-700">Pindai QR Code untuk memeriksa keabsahan di portal resmi APII.</p>
        </div>
        <div className="bg-white p-1 rounded border border-slate-200 shrink-0">
          <QRCodeSVG value={letter.qr_verify_url || `https://app.apii.sigitadi.id/verify/${letter.sha256_hash}`} size={56} />
        </div>
      </div>
    </div>
  );
};
