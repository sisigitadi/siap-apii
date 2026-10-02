import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Mail, MapPin, Globe } from 'lucide-react';
import { ORG_NAME, DPW_NAME } from '@/utils/constants';

export const PublicFooter: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-12 pb-8 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand Info */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-emerald-700/30 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                SIAP
              </div>
              <div>
                <h4 className="text-white font-bold text-base leading-tight">{ORG_NAME}</h4>
                <p className="text-xs text-emerald-400 font-medium">{DPW_NAME}</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              Sistem Informasi Administrasi & Pelayanan Terpadu DPW APII Jabodetabek. Menjamin transparansi, integritas dokumen berbasis SHA-256, dan tata kelola organisasi modern.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h5 className="text-white font-semibold text-sm mb-3">Layanan Terpadu</h5>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/verify" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                  Verifikasi Dokumen & SK
                </Link>
              </li>
              <li>
                <Link to="/schedule" className="hover:text-white transition-colors">
                  Jadwal Kegiatan & Kajian
                </Link>
              </li>
              <li>
                <Link to="/members/me" className="hover:text-white transition-colors">
                  e-KTA Digital 5 Tahun
                </Link>
              </li>
              <li>
                <Link to="/auth/login" className="hover:text-white transition-colors">
                  Portal Masuk Pengurus
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Details */}
          <div>
            <h5 className="text-white font-semibold text-sm mb-3">Sekretariat DPW</h5>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Jabodetabek, DKI Jakarta, Indonesia</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>sekretariat@apii.org</span>
              </li>
              <li className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>https://apii.sigitadi.id</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} DPW APII Jabodetabek. Seluruh Hak Cipta Dilindungi.</p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Sistem Operasional v1.0.0
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
