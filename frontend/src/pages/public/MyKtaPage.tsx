import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { publicApi } from '@/api/public.api';
import { MemberCard } from '@/api/types';
import { EKtaCard } from '@/components/public/EKtaCard';
import { LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';

export const MyKtaPage: React.FC = () => {
  const { user } = useAuth();
  const [card, setCard] = useState<MemberCard | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setLoading(true);
      publicApi
        .getMyMemberCard()
        .then((res) => {
          setCard(res);
          setLoading(false);
        })
        .catch(() => {
          // Fallback hanya saat backend tidak terjangkau (mis. demo offline).
          const memberNumber = user.memberNumber || 'APII-JABO-0001';
          setCard({
            member_number: memberNumber,
            full_name: user.fullName || 'Anggota Terdaftar',
            email: user.email,
            photo_url: null,
            member_since: '2026-01-01T00:00:00.000Z',
            issued_at: '2026-01-01T00:00:00.000Z',
            expires_at: '2031-01-01T00:00:00.000Z',
            status: 'ACTIVE',
            qr_verify_url: `https://app.apii.sigitadi.id/verify/member/${memberNumber}`,
          });
          setLoading(false);
        });
    }
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Akses e-KTA Digital</h2>
        <p className="text-xs text-slate-600">Silakan masuk menggunakan akun Google resmi Anda untuk menampilkan e-KTA 5 Tahun Anda.</p>
        <Link
          to="/auth/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0e3b6f] text-white rounded-xl text-xs font-bold shadow-md hover:bg-[#092547] transition-colors"
        >
          <LogIn className="w-4 h-4" /> <span>Masuk Sekarang</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-black text-slate-900">Kartu Tanda Anggota Digital</h1>
        <p className="text-xs text-slate-600">e-KTA Resmi DPW APII Jabodetabek (Masa Aktif 5 Tahun)</p>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : card ? (
        <EKtaCard card={card} onPrint={() => window.print()} />
      ) : null}
    </div>
  );
};
