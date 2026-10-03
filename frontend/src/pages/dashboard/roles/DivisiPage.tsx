import React from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Plus, Eye, Users as UsersIcon } from 'lucide-react';
import { RoleHeader } from '@/components/common/RoleHeader';
import { useAuth } from '@/context/AuthContext';
import { DIVISION_LABELS } from '@/utils/constants';

/**
 * Halaman bersama Ketua Divisi & Anggota Divisi (requirement: anggota divisi
 * berada di tempat yang sama dengan ketua divisi). Perbedaan: Ketua Divisi
 * bisa mengajukan & mengunggah; Anggota Divisi hanya melihat & unggah dokumen
 * pendukung.
 */
export const DivisiPage: React.FC = () => {
  const { user, isKetuaDivisi, canAccessDivision } = useAuth();
  const division = user?.division;

  const divisions = (Object.keys(DIVISION_LABELS) as Array<keyof typeof DIVISION_LABELS>).filter(
    (key) => key === division || canAccessDivision(key),
  );

  const list = divisions.length > 0 ? divisions : [];

  return (
    <div className="space-y-6">
      <RoleHeader
        title={isKetuaDivisi ? 'Workspace Ketua Divisi' : 'Workspace Anggota Divisi'}
        subtitle={
          isKetuaDivisi
            ? 'Ajukan usulan program kerja, unggah berkas pendukung, dan pantau persetujuan.'
            : 'Lihat progres usulan divisi dan unggah dokumen pendukung kegiatan.'
        }
        icon={<FolderKanban className="w-6 h-6 text-emerald-300" />}
      />

      {division && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <FolderKanban className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">{DIVISION_LABELS[division]}</h2>
                <p className="text-[11px] text-slate-500">Divisi kerja Anda — data terisolasi dari divisi lain</p>
              </div>
            </div>
            {isKetuaDivisi && (
              <Link
                to={`/dashboard/divisions/${division}`}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Ajukan Program Baru
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((divKey) => (
          <Link
            key={divKey}
            to={`/dashboard/divisions/${divKey}`}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-400 transition-colors group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                <FolderKanban className="w-5 h-5 text-slate-600" />
              </div>
              {divKey === division ? (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Divisi Anda
                </span>
              ) : (
                <Eye className="w-4 h-4 text-slate-400" />
              )}
            </div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-900">{DIVISION_LABELS[divKey]}</h3>
            <p className="text-[11px] text-slate-500 mt-1">Lihat usulan program &amp; unggah berkas pendukung</p>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
        <div className="flex items-center gap-2 mb-3">
          <UsersIcon className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-900">Anggota Divisi</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {['Ust. Ahmad Sahid (Ketua)', 'Fatimah Az-Zahra', 'Muhammad Ilham', 'Siti Nurhaliza'].map((name) => (
            <span key={name} className="text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
