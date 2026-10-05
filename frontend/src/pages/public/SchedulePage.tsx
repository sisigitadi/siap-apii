import React, { useEffect, useState } from 'react';
import { Calendar, MapPin, Tag } from 'lucide-react';
import { publicApi } from '@/api/public.api';
import { PublicSchedule } from '@/api/types';
import { DIVISION_LABELS } from '@/utils/constants';
import { formatDateIndo } from '@/utils/formatters';

export const SchedulePage: React.FC = () => {
  const [schedules, setSchedules] = useState<PublicSchedule[]>([]);

  useEffect(() => {
    publicApi
      .getPublicSchedules()
      .then((res) => setSchedules(res.items))
      .catch(() => {
        // Fallback hanya saat backend tidak terjangkau (mis. demo offline).
        setSchedules([
          {
            id: 'sch-1',
            tracking_id: '#REQ-2026-001',
            program_title: 'Kajian Bulanan & Pembinaan Muallaf APII',
            division: 'DIV_DAKWAH',
            execution_date: '2026-10-15T09:00:00.000Z',
            target_audience: 'Anggota & masyarakat umum',
            category: 'KAJIAN_RUTIN',
            description:
              'Tema: Membangun Etika & Profesionalisme dalam Pembangunan Infrastruktur.',
            location: 'Aula Graha APII / Hybrid Zoom',
          },
          {
            id: 'sch-2',
            tracking_id: '#REQ-2026-002',
            program_title: 'Workshop Sertifikasi Green Building & Smart Infrastructure',
            division: 'DIV_LITBANG',
            execution_date: '2026-10-22T08:30:00.000Z',
            target_audience: 'Anggota praktisi & konsultan',
            category: 'PELATIHAN_VOKASI',
            description:
              'Pelatihan teknis rekayasa infrastruktur ramah lingkungan bersama narasumber praktisi.',
            location: 'Hotel Bidakara Jakarta',
          },
        ]);
      });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-black text-slate-900">Jadwal Kajian & Agenda Kegiatan</h1>
        <p className="text-xs text-slate-600">Agenda pembinaan spiritual, workshop keahlian, dan program sosial DPW APII Jabodetabek.</p>
      </div>

      <div className="space-y-4">
        {schedules.map((item) => (
          <div key={item.id} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {DIVISION_LABELS[item.division]}
                </span>
                {item.category && (
                  <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                    <Tag className="w-3 h-3" /> {item.category}
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900">{item.program_title}</h3>
              <p className="text-xs text-slate-600 max-w-xl">{item.description || item.target_audience || '-'}</p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#0e3b6f]" />
                  {formatDateIndo(item.execution_date, true)}
                </span>
                {item.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-600" />
                    {item.location}
                  </span>
                )}
              </div>
            </div>
            <button className="px-4 py-2 bg-[#0e3b6f] hover:bg-[#092547] text-white rounded-xl text-xs font-semibold shrink-0">
              Daftar / Ikuti
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
