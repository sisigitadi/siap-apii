import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { MemberCard } from '@/api/types';
import { EKtaCard } from '@/components/public/EKtaCard';

export const VerifyMemberPage: React.FC = () => {
  const { memberNumber } = useParams<{ memberNumber?: string }>();
  const [member, setMember] = useState<MemberCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO(Fase E): ganti ke endpoint publik verifikasi keanggotaan ketika ada.
    // Sementara menampilkan data contoh agar UI verifikasi e-KTA dapat dievaluasi.
    setTimeout(() => {
      if (memberNumber) {
        setMember({
          member_number: memberNumber,
          full_name: 'Ir. Hendra Kusuma, M.T.',
          email: 'hendra.kusuma@member.apii.org',
          photo_url: null,
          member_since: '2026-01-01T00:00:00.000Z',
          issued_at: '2026-01-01T00:00:00.000Z',
          expires_at: '2031-01-01T00:00:00.000Z',
          status: 'ACTIVE',
          qr_verify_url: `https://app.apii.sigitadi.id/verify/member/${memberNumber}`,
        });
      }
      setLoading(false);
    }, 400);
  }, [memberNumber]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-black text-slate-900">Verifikasi e-KTA Anggota</h1>
        <p className="text-xs text-slate-600">Pusat validasi status keaktifan anggota resmi DPW APII Jabodetabek.</p>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Memeriksa data keanggotaan...</p>
        </div>
      ) : member ? (
        <div className="space-y-6">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center flex items-center justify-center gap-2 text-emerald-800 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Anggota Sah & Aktif Terdaftar di DPW APII Jabodetabek</span>
          </div>

          <EKtaCard card={member} onPrint={() => window.print()} />
        </div>
      ) : (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-1">
          <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto mb-1" />
          <h3 className="text-sm font-bold text-rose-900">Nomor Anggota Tidak Ditemukan</h3>
          <p className="text-xs text-rose-700">Pastikan nomor NPA yang Anda masukkan sesuai.</p>
        </div>
      )}
    </div>
  );
};
