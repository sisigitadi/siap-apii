import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, Award, Calendar } from 'lucide-react';
import { MemberCard } from '@/api/types';
import { formatDateIndo } from '@/utils/formatters';

interface EKtaCardProps {
  card: MemberCard;
  onPrint?: () => void;
}

export const EKtaCard: React.FC<EKtaCardProps> = ({ card, onPrint }) => {
  const isExpired = card.expires_at
    ? new Date(card.expires_at).getTime() < Date.now()
    : false;

  return (
    <div className="flex flex-col items-center">
      {/* Front of Card */}
      <div className="w-full max-w-[420px] aspect-[1.586/1] rounded-2xl p-6 bg-gradient-to-br from-[#0e3b6f] via-[#092547] to-[#041121] text-white shadow-2xl relative overflow-hidden border border-amber-400/30 flex flex-col justify-between">
        {/* Background decorative watermark */}
        <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
        <div className="absolute -left-8 -bottom-8 w-44 h-44 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

        {/* Card Header */}
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white p-0.5 shadow-md flex items-center justify-center">
              <img
                src="/assets/logo-apii.jpg"
                alt="Logo APII"
                className="w-full h-full object-cover rounded-[10px]"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide text-white">ASOSIASI PENGEMBANG INFRASTRUKTUR INDONESIA</h3>
              <p className="text-[10px] text-amber-300 font-semibold tracking-wider">DPW JABODETABEK · e-KTA DIGITAL</p>
            </div>
          </div>
          <div className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300">
            <Award className="w-4 h-4" />
          </div>
        </div>

        {/* Card Body */}
        <div className="my-auto py-2 flex items-center justify-between relative z-10">
          <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Nama Anggota</p>
            <p className="text-base font-bold text-white tracking-wide">{card.full_name}</p>
            <p className="text-xs font-mono text-emerald-400 mt-0.5 tracking-wider font-semibold">
              {card.member_number || 'APII-JB-MEMBER'}
            </p>
          </div>

          <div className="bg-white p-1.5 rounded-lg shadow-md">
            <QRCodeSVG value={card.qr_verify_url || `https://app.apii.sigitadi.id/verify/member/${card.member_number}`} size={64} />
          </div>
        </div>

        {/* Card Footer */}
        <div className="flex items-end justify-between pt-2 border-t border-slate-700/60 relative z-10 text-[10px]">
          <div>
            <span className="text-slate-400">Masa Berlaku: </span>
            <span className={`font-semibold ${isExpired ? 'text-rose-400' : 'text-emerald-300'}`}>
              s.d. {formatDateIndo(card.expires_at)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="font-semibold">Terverifikasi 5 Tahun</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {onPrint && (
        <button
          onClick={onPrint}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors shadow-xs"
        >
          <Calendar className="w-4 h-4 text-[#0e3b6f]" />
          <span>Cetak / Simpan e-KTA</span>
        </button>
      )}
    </div>
  );
};
