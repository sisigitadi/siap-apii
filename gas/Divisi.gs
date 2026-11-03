/**
 * ============================================================================
 * Divisi.gs - Modul Usulan Program Divisi Kerja
 * ============================================================================
 * Aturan KETAT:
 *   1. Divisi hanya melihat & mengusulkan divisinya SENDIRI (diambil dari
 *      ctx.user.division, TIDAK PERNAH dari payload frontend).
 *   2. Workflow: DRAFT -> AJUKAN -> DISETUJUI / DITOLAK.
 *      NOL publikasi langsung - divisi hanya Simpan Draf / Ajukan.
 *   3. approve/reject HANYA via Approval Board KETUA (atau SUPERADMIN).
 *
 * Tracking ID otomatis: #REQ-{tahun}-{urut 3 digit}
 * ==========================================================================*/

/** Bangun tracking ID baru (#REQ-2026-089). */
function buildTrackingId() {
  var tahun = new Date().getFullYear();
  var urut = Database.nextSequence('DIVISI:' + tahun);
  var urutStr = String(urut);
  while (urutStr.length < 3) urutStr = '0' + urutStr;
  return '#REQ-' + tahun + '-' + urutStr;
}

/**
 * getListDivisi: daftar usulan dengan ISOLASI DIVISI otomatis.
 * - SUPERADMIN/KETUA/pengurus internal: lihat semua divisi.
 * - KETUA_DIVISI/ANGGOTA_DIVISI: hanya divisi sendiri.
 * - Lainnya: daftar kosong.
 * @param {object} ctx.payload { status?, q?, limit?, page? }
 */
function getListDivisi(ctx) {
  var p = ctx.payload || {};
  var limit = Math.min(Number(p.limit) || 20, 100);
  var page = Math.max(Number(p.page) || 1, 1);
  var q = String(p.q || '').toLowerCase();

  var rows = Database.readAll(TABS.DIVISI);

  // --- ISOLASI DIVISI (dari token, bukan payload) ---
  var user = ctx.user;
  var isDivisionRole = user.role === ROLES.KETUA_DIVISI ||
                       user.role === ROLES.ANGGOTA_DIVISI;
  if (isDivisionRole) {
    rows = rows.filter(function (d) { return d.division === user.division; });
  }

  if (q) {
    rows = rows.filter(function (d) {
      return (d.program_title || '').toLowerCase().indexOf(q) !== -1 ||
             (d.tracking_id || '').toLowerCase().indexOf(q) !== -1 ||
             (d.description || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  if (p.status) rows = rows.filter(function (d) { return d.status === p.status; });

  rows.sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });

  var total = rows.length;
  var start = (page - 1) * limit;
  var items = rows.slice(start, start + limit).map(function (d) {
    return {
      id: d.id, tracking_id: d.tracking_id, division: d.division,
      division_label: DIVISION_LABELS[d.division] || d.division,
      program_title: d.program_title, description: d.description,
      budget_estimate: Number(d.budget_estimate) || 0,
      budget_label: formatRupiah(d.budget_estimate),
      target_audience: d.target_audience, execution_date: d.execution_date,
      tanggal_label: formatTanggal(d.execution_date),
      status: d.status, status_label: STATUS_LABELS[d.status] || d.status,
      submitted_by: d.submitted_by, submitted_by_name: d.submitted_by_name,
      submitted_at: d.submitted_at, reviewed_by: d.reviewed_by,
      reviewed_at: d.reviewed_at, approval_notes: d.approval_notes,
      started_at: d.started_at || '',
      lpj_url: d.lpj_url || '',
      lpj_notes: d.lpj_notes || '',
      realisasi_anggaran: Number(d.realisasi_anggaran) || 0,
      realisasi_label: formatRupiah(d.realisasi_anggaran || 0),
      lpj_submitted_at: d.lpj_submitted_at || '',
      can_edit: d.status === 'DRAFT' && (isDivisionRole || user.role === ROLES.SUPERADMIN),
      can_submit: d.status === 'DRAFT' && (isDivisionRole || user.role === ROLES.SUPERADMIN),
      can_start: d.status === 'DISETUJUI' && (isDivisionRole || user.role === ROLES.SUPERADMIN),
      can_lpj: (d.status === 'PELAKSANAAN' || d.status === 'DISETUJUI') && (isDivisionRole || user.role === ROLES.SUPERADMIN)
    };
  });

  return { ok: true, data: { items: items, total: total, page: page, limit: limit,
                             my_division: user.division || '' },
    message: 'Daftar usulan divisi berhasil dimuat.' };
}

/**
 * createSubmission: buat usulan program divisi. DIVISI_SUBMIT_ROLES.
 * Divisi SELALU dari token user (frontend tidak bisa memilih divisi lain).
 * @param {object} ctx.payload { program_title, description, budget_estimate,
 *                                target_audience, execution_date }
 */
function createSubmission(ctx) {
  var p = ctx.payload || {};
  var user = ctx.user;

  if (user.role === ROLES.KETUA_DIVISI || user.role === ROLES.ANGGOTA_DIVISI) {
    if (!user.division) {
      return { ok: false, data: null,
        message: 'Akun Anda tidak terdaftar pada divisi manapun. Hubungi administrator.' };
    }
  }
  if (!p.program_title || !String(p.program_title).trim()) {
    return { ok: false, data: null, message: 'Judul program wajib diisi.' };
  }
  if (!p.description || !String(p.description).trim()) {
    return { ok: false, data: null, message: 'Deskripsi program wajib diisi.' };
  }

  // Division: SUPERADMIN boleh pilih via payload; peran divisi dipaksa dari token.
  var division;
  if (user.role === ROLES.SUPERADMIN && p.division && DIVISION_LABELS[p.division]) {
    division = p.division;
  } else {
    division = user.division;
  }
  if (!division || !DIVISION_LABELS[division]) {
    return { ok: false, data: null, message: 'Divisi tidak valid.' };
  }

  var created = Database.insert(TABS.DIVISI, {
    id: uuid(), tracking_id: buildTrackingId(), division: division,
    program_title: String(p.program_title).trim(),
    description: String(p.description).trim(),
    budget_estimate: Number(p.budget_estimate) || 0,
    target_audience: p.target_audience || '',
    execution_date: p.execution_date || '',
    status: 'DRAFT',
    submitted_by: user.username, submitted_by_name: user.full_name || user.username,
    submitted_at: '', reviewed_by: '', reviewed_at: '', approval_notes: '',
    started_at: '', lpj_url: '', lpj_notes: '', realisasi_anggaran: 0, lpj_submitted_at: '',
    created_at: new Date().toISOString()
  });

  return { ok: true, data: { id: created.id, tracking_id: created.tracking_id },
    message: 'Usulan divisi ' + created.tracking_id + ' berhasil disimpan sebagai draf.' };
}

/**
 * Cari usulan + validasi kepemilikan divisi (isolation). Lempar appError bila gagal.
 * @return {object} baris usulan
 */
function assertOwnDivision_(ctx, id, requireDraft) {
  var d = Database.findOne(TABS.DIVISI, { id: id });
  if (!d) appError('Usulan tidak ditemukan.');
  var user = ctx.user;
  if (user.role === ROLES.KETUA_DIVISI || user.role === ROLES.ANGGOTA_DIVISI) {
    if (d.division !== user.division) {
      audit(user.username, 'FORBIDDEN',
        'Akses usulan ' + d.tracking_id + ' divisi ' + d.division + ' (user: ' + user.division + ')');
      appError('Anda hanya dapat mengakses usulan divisi Anda sendiri.');
    }
  }
  if (requireDraft && d.status !== 'DRAFT') {
    appError('Usulan yang sudah diajukan tidak dapat diubah (status: ' +
             (STATUS_LABELS[d.status] || d.status) + ').');
  }
  return d;
}

/**
 * updateSubmission: ubah usulan (hanya DRAFT + divisi sendiri).
 */
function updateSubmission(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID usulan wajib diisi.' };
  var d = assertOwnDivision_(ctx, p.id, true);

  var values = {};
  if (p.program_title) values.program_title = String(p.program_title).trim();
  if (p.description) values.description = String(p.description).trim();
  if (p.budget_estimate !== undefined) values.budget_estimate = Number(p.budget_estimate) || 0;
  if (p.target_audience !== undefined) values.target_audience = p.target_audience;
  if (p.execution_date !== undefined) values.execution_date = p.execution_date;
  if (!Object.keys(values).length) {
    return { ok: false, data: null, message: 'Tidak ada perubahan yang dikirim.' };
  }

  Database.updateRow(TABS.DIVISI, d._row, values);
  return { ok: true, data: null, message: 'Usulan ' + d.tracking_id + ' berhasil diperbarui.' };
}

/**
 * ajukanSubmission: DRAFT -> AJUKAN (kirim ke Approval Board Ketua).
 * Aturan ketat: divisi TIDAK BISA mempublikasi/approve sendiri.
 */
function ajukanSubmission(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID usulan wajib diisi.' };
  var d = assertOwnDivision_(ctx, p.id, true);

  Database.updateRow(TABS.DIVISI, d._row, {
    status: 'AJUKAN', submitted_at: new Date().toISOString()
  });
  audit(ctx.user.username, 'DIVISI_AJUKAN', 'Usulan ' + d.tracking_id);

  // Notifikasi email ke Ketua DPW (Approval Board)
  kirimNotifikasiKeRole_(ROLES.KETUA,
    'Usulan Program Baru: ' + d.tracking_id,
    'Usulan Program Divisi Menunggu Persetujuan',
    'Usulan program <strong>' + d.program_title + '</strong> (ID: <code>' + d.tracking_id + '</code>) dari <strong>' + (DIVISION_LABELS[d.division] || d.division) + '</strong> telah diajukan oleh <strong>' + (d.submitted_by_name || d.submitted_by) + '</strong> dengan estimasi anggaran <strong>' + formatRupiah(d.budget_estimate) + '</strong>.',
    'Tinjau Usulan Program',
    (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/divisi');

  return { ok: true, data: null,
    message: 'Usulan ' + d.tracking_id + ' diajukan ke Ketua (Approval Board).' };
}

/**
 * approveSubmission: setujui usulan. HANYA Approval Board (KETUA/SUPERADMIN).
 */
function approveSubmission(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID usulan wajib diisi.' };
  var d = Database.findOne(TABS.DIVISI, { id: p.id });
  if (!d) return { ok: false, data: null, message: 'Usulan tidak ditemukan.' };
  if (d.status !== 'AJUKAN') {
    return { ok: false, data: null,
      message: 'Hanya usulan yang sedang diajukan yang dapat disetujui (status: ' +
               (STATUS_LABELS[d.status] || d.status) + ').' };
  }
  Database.updateRow(TABS.DIVISI, d._row, {
    status: 'DISETUJUI', reviewed_by: ctx.user.username,
    reviewed_at: new Date().toISOString(),
    approval_notes: (p.notes || '').trim()
  });
  audit(ctx.user.username, 'DIVISI_SETUJU', 'Usulan ' + d.tracking_id);

  // Notifikasi email ke Pengusul Divisi
  kirimNotifikasiKeUser_(d.submitted_by,
    'Usulan Program Disetujui: ' + d.tracking_id,
    'Usulan Program Divisi Disetujui',
    'Usulan program <strong>' + d.program_title + '</strong> (ID: <code>' + d.tracking_id + '</code>) telah disetujui oleh Ketua DPW untuk pelaksanaan program kerja.' + (p.notes ? '<br/><strong>Catatan Ketua:</strong> ' + String(p.notes).replace(/[<>&]/g, '') : ''),
    'Buka Portal Divisi',
    (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/divisi');

  return { ok: true, data: null, message: 'Usulan ' + d.tracking_id + ' disetujui.' };
}

/**
 * rejectSubmission: tolak usulan. HANYA KETUA/SUPERADMIN. Catatan WAJIB.
 */
function rejectSubmission(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID usulan wajib diisi.' };
  if (!p.notes || !String(p.notes).trim()) {
    return { ok: false, data: null, message: 'Alasan penolakan wajib diisi.' };
  }
  var d = Database.findOne(TABS.DIVISI, { id: p.id });
  if (!d) return { ok: false, data: null, message: 'Usulan tidak ditemukan.' };
  if (d.status !== 'AJUKAN') {
    return { ok: false, data: null,
      message: 'Hanya usulan yang sedang diajukan yang dapat ditolak (status: ' +
               (STATUS_LABELS[d.status] || d.status) + ').' };
  }
  Database.updateRow(TABS.DIVISI, d._row, {
    status: 'DITOLAK', reviewed_by: ctx.user.username,
    reviewed_at: new Date().toISOString(),
    approval_notes: String(p.notes).trim()
  });
  audit(ctx.user.username, 'DIVISI_TOLAK', 'Usulan ' + d.tracking_id + ': ' + p.notes);

  // Notifikasi email ke Pengusul Divisi
  kirimNotifikasiKeUser_(d.submitted_by,
    'Usulan Program Perlu Perbaikan: ' + d.tracking_id,
    'Usulan Program Dikembalikan untuk Perbaikan',
    'Usulan program <strong>' + d.program_title + '</strong> (ID: <code>' + d.tracking_id + '</code>) telah dikembalikan oleh Ketua DPW dengan catatan perbaikan:<br/><blockquote style="background:#fee2e2;padding:10px 14px;border-left:4px solid #ef4444;margin:12px 0;color:#991b1b;border-radius:4px;">' + String(p.notes).trim() + '</blockquote>',
    'Perbaiki Usulan Program',
    (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/divisi');

  return { ok: true, data: null, message: 'Usulan ' + d.tracking_id + ' ditolak.' };
}

/**
 * startExecution: transisi DISETUJUI -> PELAKSANAAN.
 * Dilakukan oleh Divisi terkait atau SUPERADMIN ketika program mulai berjalan.
 */
function startExecution(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID usulan wajib diisi.' };
  var d = assertOwnDivision_(ctx, p.id, false);

  if (d.status !== 'DISETUJUI') {
    return { ok: false, data: null,
      message: 'Hanya usulan berstatus Disetujui yang dapat dimulai pelaksanaannya (status: ' +
               (STATUS_LABELS[d.status] || d.status) + ').' };
  }

  Database.updateRow(TABS.DIVISI, d._row, {
    status: 'PELAKSANAAN',
    started_at: new Date().toISOString()
  });
  audit(ctx.user.username, 'DIVISI_MULAI', 'Usulan ' + d.tracking_id);

  return { ok: true, data: null,
    message: 'Program ' + d.tracking_id + ' telah masuk tahap Pelaksanaan.' };
}

/**
 * submitLPJ: serahkan Laporan Pertanggungjawaban (LPJ).
 * Status berubah menjadi LPJ_SELESAI.
 * Menyimpan lpj_url (tautan Google Drive / dokumen), lpj_notes, dan realisasi_anggaran.
 */
function submitLPJ(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID usulan wajib diisi.' };
  var d = assertOwnDivision_(ctx, p.id, false);

  if (d.status !== 'PELAKSANAAN' && d.status !== 'DISETUJUI') {
    return { ok: false, data: null,
      message: 'Hanya usulan berstatus Pelaksanaan atau Disetujui yang dapat menyerahkan LPJ (status: ' +
               (STATUS_LABELS[d.status] || d.status) + ').' };
  }

  var lpjUrl = String(p.lpj_url || '').trim();
  if (!lpjUrl) {
    return { ok: false, data: null, message: 'Tautan dokumen LPJ (Google Drive / Cloud) wajib diisi.' };
  }

  var realisasi = Number(p.realisasi_anggaran);
  if (isNaN(realisasi) || realisasi < 0) {
    realisasi = Number(d.budget_estimate) || 0;
  }

  var lpjNotes = String(p.lpj_notes || '').trim();

  Database.updateRow(TABS.DIVISI, d._row, {
    status: 'LPJ_SELESAI',
    lpj_url: lpjUrl,
    lpj_notes: lpjNotes,
    realisasi_anggaran: realisasi,
    lpj_submitted_at: new Date().toISOString()
  });
  audit(ctx.user.username, 'DIVISI_LPJ', 'LPJ ' + d.tracking_id + ' (Realisasi: ' + formatRupiah(realisasi) + ')');

  // Notifikasi email ke Ketua DPW
  kirimNotifikasiKeRole_(ROLES.KETUA,
    'LPJ Program Kerja Selesai: ' + d.tracking_id,
    'Laporan Pertanggungjawaban (LPJ) Program Telah Diserahkan',
    'Divisi <strong>' + (DIVISION_LABELS[d.division] || d.division) + '</strong> telah menyelesaikan pelaksanaan program <strong>' + d.program_title + '</strong> (ID: <code>' + d.tracking_id + '</code>) dan menyerahkan LPJ.<br/>' +
    '<strong>Realisasi Anggaran:</strong> ' + formatRupiah(realisasi) + ' (Estimasi awal: ' + formatRupiah(d.budget_estimate) + ')<br/>' +
    (lpjNotes ? '<strong>Catatan LPJ:</strong> ' + String(lpjNotes).replace(/[<>&]/g, '') + '<br/>' : '') +
    '<strong>Tautan LPJ:</strong> <a href="' + lpjUrl + '" target="_blank">' + lpjUrl + '</a>',
    'Tinjau Laporan di Portal',
    (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/divisi');

  return { ok: true, data: null,
    message: 'LPJ Program ' + d.tracking_id + ' berhasil diserahkan. Siklus program selesai!' };
}


// ============================================================================
// MODUL FORMASI PENGURUS & DELEGASI PLT (FASE 6 - ART BAB V PASAL 14 & 16)
// ============================================================================

/**
 * getFormasiPengurus: memuat bagan struktur BPH & 7 Divisi resmi + status Plt.
 * Menghitung sisa masa bakti pengurus (tenure management 5 tahun).
 */
function getFormasiPengurus(ctx) {
  var p = (ctx && ctx.payload) || {};
  var user = (ctx && ctx.user) || {};
  var userWilayah = (user.wilayah_id) || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var wId = p.wilayah_id || userWilayah;

  // Jalankan auto-revoke Plt terlebih dahulu
  autoRevokePlt_();

  var rows = Database.readAll(TABS.PENGURUS);
  var items = rows.filter(function (r) {
    return (r.wilayah_id || userWilayah) === wId;
  });

  // Jika tabel pengurus di wilayah ini masih kosong, lakukan auto-seeding bawaan
  if (!items || items.length === 0) {
    seedDefaultFormasi_(wId);
    rows = Database.readAll(TABS.PENGURUS);
    items = rows.filter(function (r) {
      return (r.wilayah_id || userWilayah) === wId;
    });
  }

  // Dapatkan daftar Plt yang sedang aktif
  var allPlt = Database.readAll(TABS.PLT_DELEGASI);
  var activePltList = allPlt.filter(function (plt) {
    return (plt.wilayah_id || userWilayah) === wId && plt.status === 'AKTIF';
  });

  var now = new Date();

  // Pasang status Plt ke jabatan terkait
  var mapped = items.map(function (pejabat) {
    var pltObj = null;
    for (var i = 0; i < activePltList.length; i++) {
      if (activePltList[i].jabatan_code === pejabat.jabatan_code) {
        pltObj = activePltList[i];
        break;
      }
    }
    return {
      id: pejabat.id,
      wilayah_id: pejabat.wilayah_id,
      jabatan_code: pejabat.jabatan_code,
      jabatan_nama: pejabat.jabatan_nama,
      kategori: pejabat.kategori,
      user_id: pejabat.user_id,
      full_name: pejabat.full_name,
      nik: pejabat.nik,
      no_kta: pejabat.no_kta,
      phone: pejabat.phone,
      periode_mulai: pejabat.periode_mulai || '2023',
      periode_selesai: pejabat.periode_selesai || '2028',
      status: pejabat.status || 'AKTIF',
      is_plt: !!pltObj,
      plt_detail: pltObj ? {
        plt_user_nama: pltObj.plt_user_nama,
        surat_tugas_no: pltObj.surat_tugas_no,
        alasan: pltObj.alasan,
        start_date: pltObj.start_date,
        end_date: pltObj.end_date,
        sisa_hari: Math.max(0, Math.ceil((new Date(pltObj.end_date + 'T23:59:59') - now) / (1000 * 60 * 60 * 24)))
      } : null
    };
  });

  // Kelompokkan per kategori
  var bph = mapped.filter(function (m) { return m.kategori === 'BPH'; });
  var divisi = mapped.filter(function (m) { return m.kategori === 'DIVISI'; });
  var dewan = mapped.filter(function (m) { return m.kategori === 'DEWAN'; });

  // Hitung sisa masa bakti (default periode 5 tahun)
  var thnMulai = 2023;
  var thnSelesai = 2028;
  if (items[0] && items[0].periode_selesai) {
    thnSelesai = Number(items[0].periode_selesai) || 2028;
    thnMulai = Number(items[0].periode_mulai) || 2023;
  }
  var sisaBulan = Math.max(0, (thnSelesai - now.getFullYear()) * 12 - now.getMonth());
  var sisaTahun = Math.floor(sisaBulan / 12);
  var sisaBulanSisa = sisaBulan % 12;

  var tenureInfo = {
    periode_mulai: thnMulai,
    periode_selesai: thnSelesai,
    periode_label: thnMulai + '-' + thnSelesai,
    sisa_label: sisaTahun + ' Tahun ' + sisaBulanSisa + ' Bulan',
    is_expiring_soon: sisaBulan <= 3,
    status: sisaBulan > 0 ? 'AKTIF SAH' : 'DEMISIONER'
  };

  return {
    ok: true,
    data: {
      bph: bph,
      divisi: divisi,
      dewan: dewan,
      all: mapped,
      tenure: tenureInfo,
      active_plt_count: activePltList.length
    },
    message: 'Formasi kepengurusan berhasil dimuat.'
  };
}

/**
 * seedDefaultFormasi_: inisialisasi susunan formasi pengurus baku jika belum ada.
 */
function seedDefaultFormasi_(wId) {
  var now = new Date().toISOString();
  var defaultBagan = [
    { code: 'BPH_KETUA', nama: (wId === 'DPP_PUSAT' ? 'Ketua Umum' : 'Ketua Wilayah'), kat: 'BPH', namaPejabat: 'Ust. Ahmad Daman Huri' },
    { code: 'BPH_SEKRETARIS', nama: (wId === 'DPP_PUSAT' ? 'Sekretaris Umum' : 'Sekretaris Wilayah'), kat: 'BPH', namaPejabat: 'Ust. Muhammad Faiz' },
    { code: 'BPH_BENDAHARA', nama: (wId === 'DPP_PUSAT' ? 'Bendahara Umum' : 'Bendahara Wilayah'), kat: 'BPH', namaPejabat: 'H. Bambang Sugiarto' },
    { code: 'DIV_HUMAS', nama: 'Ketua Divisi Hubungan Masyarakat & Antar-Lembaga', kat: 'DIVISI', namaPejabat: 'Ust. Ridwan Kamil' },
    { code: 'DIV_LITBANG', nama: 'Ketua Divisi Penelitian & Pengembangan (Litbang)', kat: 'DIVISI', namaPejabat: 'Dr. Ilham Habibie' },
    { code: 'DIV_SOSMED', nama: 'Ketua Divisi Media Sosial & Digital Dakwah', kat: 'DIVISI', namaPejabat: 'Ahmad Zaki' },
    { code: 'DIV_DAKWAH', nama: 'Ketua Divisi Dakwah & Pendidikan', kat: 'DIVISI', namaPejabat: 'Ust. Abdul Somad' },
    { code: 'DIV_INVESTASI', nama: 'Ketua Divisi Bisnis, Investasi & Baitul Mal', kat: 'DIVISI', namaPejabat: 'Ir. Sandiaga Syar\'i' },
    { code: 'DIV_HUKUM', nama: 'Ketua Divisi Advokasi Hukum & HAM', kat: 'DIVISI', namaPejabat: 'Adv. Munarman SH' },
    { code: 'DIV_UMUM', nama: 'Ketua Divisi Rumah Tangga & Perlengkapan Umum', kat: 'DIVISI', namaPejabat: 'Subhan' },
    { code: 'DEWAN_PEMBINA', nama: 'Dewan Pembina Yayasan APII', kat: 'DEWAN', namaPejabat: 'Prof. Dr. KH. Didin Hafidhuddin' },
    { code: 'DEWAN_PENGAWAS', nama: 'Dewan Pengawas Yayasan APII', kat: 'DEWAN', namaPejabat: 'Drs. H. Mulyadi' }
  ];

  defaultBagan.forEach(function (b) {
    Database.insert(TABS.PENGURUS, {
      id: uuid(),
      wilayah_id: wId,
      jabatan_code: b.code,
      jabatan_nama: b.nama,
      kategori: b.kat,
      user_id: '',
      full_name: b.namaPejabat,
      nik: '',
      no_kta: '',
      phone: '',
      periode_mulai: '2023',
      periode_selesai: '2028',
      status: 'AKTIF',
      sk_id: '',
      created_at: now,
      updated_at: now
    });
  });
}

/**
 * savePejabatFormasi: simpan / mutasi pejabat struktur kepengurusan.
 * Mengikat otomatis RBAC login di Sheet_Users (Bab 8.3.B).
 * SUPERADMIN, KETUA.
 */
function savePejabatFormasi(ctx) {
  var p = (ctx && ctx.payload) || {};
  var user = (ctx && ctx.user) || {};
  if (user.role !== ROLES.SUPERADMIN && user.role !== ROLES.KETUA && user.role !== ROLES.KETUA_DPP) {
    return { ok: false, data: null, message: 'Hanya Ketua atau Superadmin yang berwenang memperbarui susunan formasi pengurus.' };
  }

  if (!p.jabatan_code) return { ok: false, data: null, message: 'Kode jabatan wajib diisi.' };
  if (!p.full_name) return { ok: false, data: null, message: 'Nama lengkap pejabat wajib diisi.' };

  var userWilayah = user.wilayah_id || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var wId = p.wilayah_id || userWilayah;
  var now = new Date().toISOString();

  var existing = Database.findOne(TABS.PENGURUS, { wilayah_id: wId, jabatan_code: p.jabatan_code });

  var updateData = {
    full_name: String(p.full_name).trim(),
    nik: String(p.nik || '').trim(),
    no_kta: String(p.no_kta || '').trim(),
    phone: String(p.phone || '').trim(),
    periode_mulai: String(p.periode_mulai || '2023').trim(),
    periode_selesai: String(p.periode_selesai || '2028').trim(),
    status: p.status || 'AKTIF',
    updated_at: now
  };
  if (p.user_id) updateData.user_id = p.user_id;
  if (p.jabatan_nama) updateData.jabatan_nama = p.jabatan_nama;
  if (p.kategori) updateData.kategori = p.kategori;

  if (existing) {
    Database.updateRow(TABS.PENGURUS, existing._row, updateData);
  } else {
    updateData.id = uuid();
    updateData.wilayah_id = wId;
    updateData.jabatan_code = p.jabatan_code;
    updateData.jabatan_nama = p.jabatan_nama || p.jabatan_code;
    updateData.kategori = p.kategori || 'DIVISI';
    updateData.created_at = now;
    Database.insert(TABS.PENGURUS, updateData);
  }

  // Sinkronisasi peran RBAC otomatis jika user_id dikaitkan
  if (p.user_id) {
    var uRow = Database.findOne(TABS.USERS, { id: p.user_id });
    if (uRow) {
      var assignedRole = ROLES.KETUA_DIVISI;
      var assignedDiv = '';
      if (p.jabatan_code === 'BPH_KETUA') assignedRole = ROLES.KETUA;
      else if (p.jabatan_code === 'BPH_SEKRETARIS') assignedRole = ROLES.SEKRETARIS;
      else if (p.jabatan_code === 'BPH_BENDAHARA') assignedRole = ROLES.BENDAHARA;
      else if (p.jabatan_code === 'DEWAN_PEMBINA') assignedRole = ROLES.PEMBINA;
      else if (p.jabatan_code === 'DEWAN_PENGAWAS') assignedRole = ROLES.PENGAWAS;
      else {
        assignedRole = ROLES.KETUA_DIVISI;
        assignedDiv = p.jabatan_code;
      }
      Database.updateRow(TABS.USERS, uRow._row, {
        role: assignedRole,
        division: assignedDiv,
        updated_at: now
      });
    }
  }

  audit(user.username, 'PENGURUS_UPDATED', 'Pengangkatan pejabat ' + p.jabatan_code + ': ' + p.full_name, 'DIVISI');

  return {
    ok: true,
    data: updateData,
    message: 'Formasi jabatan ' + (p.jabatan_nama || p.jabatan_code) + ' a.n ' + p.full_name + ' berhasil ditetapkan.'
  };
}

/**
 * createPltDelegasi: delegasi wewenang Pelaksana Tugas (Plt / Ad-Interim).
 * Batas maksimal mutlak: 60 hari sesuai ART APII Bab V.
 * SUPERADMIN, KETUA.
 */
function createPltDelegasi(ctx) {
  var p = (ctx && ctx.payload) || {};
  var user = (ctx && ctx.user) || {};
  if (user.role !== ROLES.SUPERADMIN && user.role !== ROLES.KETUA && user.role !== ROLES.KETUA_DPP) {
    return { ok: false, data: null, message: 'Hanya Ketua atau Superadmin yang berwenang menerbitkan mandat Pelaksana Tugas (Plt).' };
  }

  if (!p.jabatan_code) return { ok: false, data: null, message: 'Jabatan yang didelegasikan wajib dipilih.' };
  if (!p.plt_user_nama) return { ok: false, data: null, message: 'Nama pejabat Plt wajib diisi.' };
  if (!p.start_date || !p.end_date) return { ok: false, data: null, message: 'Tanggal mulai dan berakhirnya mandat Plt wajib diisi.' };

  var sDate = new Date(p.start_date);
  var eDate = new Date(p.end_date);
  var durasiHari = Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24));

  // Benteng Pertahanan: Maksimal 60 Hari sesuai ART Bab V
  if (durasiHari > 60) {
    return {
      ok: false,
      data: null,
      message: 'Berdasarkan ART APII Bab V, masa jabatan Pelaksana Tugas (Plt / Ad-Interim) dibatasi maksimal 60 hari (durasi yang diajukan: ' + durasiHari + ' hari).'
    };
  }
  if (durasiHari <= 0) {
    return {
      ok: false,
      data: null,
      message: 'Tanggal akhir mandat Plt harus lebih besar dari tanggal mulai tugas.'
    };
  }

  var userWilayah = user.wilayah_id || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var wId = p.wilayah_id || userWilayah;
  var now = new Date().toISOString();

  // Nonaktifkan delegasi aktif sebelumnya untuk jabatan yang sama jika ada
  var oldActive = Database.readAll(TABS.PLT_DELEGASI).filter(function (plt) {
    return plt.wilayah_id === wId && plt.jabatan_code === p.jabatan_code && plt.status === 'AKTIF';
  });
  oldActive.forEach(function (old) {
    Database.updateRow(TABS.PLT_DELEGASI, old._row, { status: 'REPLACED' });
  });

  var newDelegasi = {
    id: uuid(),
    wilayah_id: wId,
    jabatan_code: p.jabatan_code,
    jabatan_nama: p.jabatan_nama || p.jabatan_code,
    pejabat_asli_id: p.pejabat_asli_id || '',
    pejabat_asli_nama: p.pejabat_asli_nama || '',
    plt_user_id: p.plt_user_id || '',
    plt_user_nama: String(p.plt_user_nama).trim(),
    surat_tugas_no: p.surat_tugas_no || ('ST/PLT/' + new Date().getFullYear() + '/' + Math.floor(100 + Math.random() * 900)),
    alasan: String(p.alasan || 'Penugasan Ad-Interim').trim(),
    start_date: p.start_date,
    end_date: p.end_date,
    status: 'AKTIF',
    created_by: user.username,
    created_at: now
  };

  Database.insert(TABS.PLT_DELEGASI, newDelegasi);
  audit(user.username, 'PLT_DELEGATED', 'Mandat Plt ' + p.jabatan_code + ' kepada ' + p.plt_user_nama + ' (' + durasiHari + ' hari)', 'DIVISI');

  return {
    ok: true,
    data: newDelegasi,
    message: 'Mandat Pelaksana Tugas (Plt) ' + newDelegasi.jabatan_nama + ' a.n ' + newDelegasi.plt_user_nama + ' sah diterbitkan selama ' + durasiHari + ' hari.'
  };
}

/**
 * getListPltDelegasi: daftar riwayat penugasan Plt di wilayah terkait.
 */
function getListPltDelegasi(ctx) {
  var p = (ctx && ctx.payload) || {};
  var user = (ctx && ctx.user) || {};
  var userWilayah = user.wilayah_id || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var wId = p.wilayah_id || userWilayah;

  autoRevokePlt_();

  var rows = Database.readAll(TABS.PLT_DELEGASI);
  var filtered = rows.filter(function (r) {
    return (r.wilayah_id || userWilayah) === wId;
  });

  filtered.sort(function (a, b) {
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

  return {
    ok: true,
    data: { items: filtered },
    message: 'Daftar riwayat delegasi Plt berhasil dimuat.'
  };
}

/**
 * revokePltDelegasi: pembatalan/pemberhentian awal mandat Plt sebelum 60 hari.
 * SUPERADMIN, KETUA.
 */
function revokePltDelegasi(ctx) {
  var p = (ctx && ctx.payload) || {};
  var user = (ctx && ctx.user) || {};
  if (user.role !== ROLES.SUPERADMIN && user.role !== ROLES.KETUA && user.role !== ROLES.KETUA_DPP) {
    return { ok: false, data: null, message: 'Hanya Ketua atau Superadmin yang berwenang mencabut mandat Plt.' };
  }

  if (!p.id) return { ok: false, data: null, message: 'ID penugasan Plt wajib diisi.' };
  var row = Database.findOne(TABS.PLT_DELEGASI, { id: p.id });
  if (!row) return { ok: false, data: null, message: 'Data mandat Plt tidak ditemukan.' };

  var now = new Date().toISOString();
  Database.updateRow(TABS.PLT_DELEGASI, row._row, {
    status: 'REVOKED'
  });

  audit(user.username, 'PLT_REVOKED', 'Pencabutan Plt ' + row.jabatan_nama + ' a.n ' + row.plt_user_nama, 'DIVISI');

  return {
    ok: true,
    data: { id: row.id, status: 'REVOKED' },
    message: 'Mandat Plt ' + row.jabatan_nama + ' a.n ' + row.plt_user_nama + ' berhasil dicabut resmi.'
  };
}

/**
 * autoRevokePlt_: evaluasi otomatis kedaluwarsa Plt yang telah melampaui tanggal berakhir.
 * Dipanggil secara pasif di setiap pemanggilan formasi atau delegasi.
 */
function autoRevokePlt_() {
  try {
    var rows = Database.readAll(TABS.PLT_DELEGASI);
    var now = new Date();
    rows.forEach(function (r) {
      if (r.status === 'AKTIF' && r.end_date) {
        var expDate = new Date(r.end_date + 'T23:59:59');
        if (now > expDate) {
          Database.updateRow(TABS.PLT_DELEGASI, r._row, { status: 'EXPIRED' });
          audit('system', 'PLT_AUTO_REVOKED', 'Mandat Plt ' + r.jabatan_nama + ' a.n ' + r.plt_user_nama + ' berakhir otomatis (> 60 hari)', 'DIVISI');
        }
      }
    });
  } catch (e) {
    Logger.log('Gagal autoRevokePlt_: ' + e);
  }
}

/**
 * generateSkPengurus: One-Click Decree Generator SK Struktur Kepengurusan DPP.
 * Mandat ART Bab V Pasal 14 Ayat 9.
 * Menghasilkan naskah hukum resmi dengan konsideran, diktum, dan matriks personalia.
 */
function generateSkPengurus(ctx) {
  var p = (ctx && ctx.payload) || {};
  var user = (ctx && ctx.user) || {};
  if (user.role !== ROLES.SUPERADMIN && user.role !== ROLES.KETUA && user.role !== ROLES.KETUA_DPP) {
    return { ok: false, data: null, message: 'Hanya Pimpinan DPP atau Superadmin yang berwenang menerbitkan SK Struktur Kepengurusan.' };
  }

  var d = new Date();
  var tahun = d.getFullYear();
  var bulanRomawi = toRoman(d.getMonth() + 1);

  var defWilayah = (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var wId = p.wilayah_id || defWilayah;

  // Dapatkan nama wilayah
  var wRow = Database.findOne(TABS.WILAYAH, { id: wId });
  var wNama = wRow ? wRow.nama : 'DPW APII Jabodetabek';

  // Dapatkan urutan nomor surat SK
  var seqKey = Database.getPartitionedSequenceKey(wId, 'SK', tahun);
  var urut = Database.nextSequence(seqKey);
  var urutStr = String(urut);
  while (urutStr.length < 3) urutStr = '0' + urutStr;
  var noSk = urutStr + '/SK-DPP/STRUKTUR/' + bulanRomawi + '/' + tahun;

  // Ambil daftar personalia pejabat
  var allPejabat = Database.readAll(TABS.PENGURUS).filter(function (pj) {
    return (pj.wilayah_id || defWilayah) === wId && pj.status === 'AKTIF';
  });

  var thnMulai = p.periode_mulai || '2023';
  var thnSelesai = p.periode_selesai || '2028';

  // Susun Lampiran Personalia HTML
  var tabelPersonaliaHtml = '<table style="width:100%; border-collapse:collapse; margin-top:14px; font-size:11px;" border="1" cellpadding="6">' +
    '<thead><tr style="background-color:#064e3b; color:#ffffff;">' +
    '<th>No.</th><th>Jabatan Organisasi</th><th>Nama Lengkap</th><th>No. KTA Nasional</th><th>Keterangan</th>' +
    '</tr></thead><tbody>' +
    allPejabat.map(function (pj, idx) {
      return '<tr>' +
        '<td style="text-align:center;">' + (idx + 1) + '</td>' +
        '<td><strong>' + pj.jabatan_nama + '</strong></td>' +
        '<td>' + pj.full_name + '</td>' +
        '<td style="font-family:monospace; text-align:center;">' + (pj.no_kta || '-') + '</td>' +
        '<td style="text-align:center;">' + (pj.kategori || 'DIVISI') + '</td>' +
        '</tr>';
    }).join('') +
    '</tbody></table>';

  // Susun Naskah SK Hukum Lengkap
  var contentSk =
    '<div style="text-align:center; margin-bottom:20px;">' +
    '<h3 style="margin:0; text-transform:uppercase; font-size:15px; color:#064e3b;">KEPUTUSAN DEWAN PIMPINAN PUSAT</h3>' +
    '<h2 style="margin:2px 0; text-transform:uppercase; font-size:16px; color:#022c22;">YAYASAN APOLOGET ISLAM INDONESIA</h2>' +
    '<div style="font-size:12px; font-weight:bold; margin-top:4px;">NOMOR: ' + noSk + '</div>' +
    '<div style="font-size:12px; font-weight:bold; text-transform:uppercase; margin-top:6px;">TENTANG</div>' +
    '<div style="font-size:13px; font-weight:black; text-transform:uppercase; color:#064e3b; margin-top:4px;">' +
    'PENGESAHAN SUSUNAN PENGURUS WILAYAH YAYASAN APII ' + wNama.toUpperCase() + '<br/>MASA BAKTI ' + thnMulai + ' - ' + thnSelesai +
    '</div>' +
    '</div>' +
    '<div style="font-size:11.5px; line-height:1.6; text-align:justify;">' +
    '<p><strong>MENIMBANG:</strong><br/>' +
    'a. Bahwa demi kelancaran jalannya roda organisasi, kesinambungan dakwah syiar Islam, serta tertib administrasi Yayasan Apologet Islam Indonesia di tingkat wilayah, dipandang perlu mengesahkan susunan kepengurusan definitif.<br/>' +
    'b. Bahwa nama-nama yang tercantum dalam keputusan ini dipandang cakap, amanah, loyal, dan memenuhi persyaratan integritas untuk mengemban tugas organisasi.<br/>' +
    'c. Bahwa berdasarkan pertimbangan sebagaimana dimaksud pada huruf a dan b, perlu menetapkan Surat Keputusan Dewan Pimpinan Pusat Yayasan APII.</p>' +
    '<p><strong>MENGINGAT:</strong><br/>' +
    '1. Akta Pendirian Yayasan Apologet Islam Indonesia.<br/>' +
    '2. Surat Keputusan Menteri Hukum dan HAM RI Nomor: AHU-0014970.AH.01.04.Tahun 2023.<br/>' +
    '3. Anggaran Dasar (AD) dan Anggaran Rumah Tangga (ART) Yayasan APII Bab V Pasal 14 &amp; 16.</p>' +
    '<p style="text-align:center; font-weight:bold; margin:16px 0;">MEMUTUSKAN:</p>' +
    '<p><strong>MENETAPKAN:</strong><br/>' +
    '<strong>PERTAMA:</strong> Mengesahkan Susunan Pengurus Wilayah Yayasan Apologet Islam Indonesia ' + wNama + ' Masa Bakti ' + thnMulai + ' - ' + thnSelesai + ' sebagaimana tercantum dalam lampiran surat keputusan ini.<br/>' +
    '<strong>KEDUA:</strong> Menugaskan kepada segenap pengurus yang telah ditetapkan untuk melaksanakan amanah kepengurusan dengan penuh tanggung jawab syar\'i, berpegang teguh pada kode etik keanggotaan, serta menjunjung tinggi marwah dakwah APII.<br/>' +
    '<strong>KETIGA:</strong> Surat Keputusan ini berlaku terhitung sejak tanggal ditetapkan selama masa bakti 5 (lima) tahun, dengan ketentuan apabila di kemudian hari terdapat kekeliruan akan diadakan perbaikan sebagaimana mestinya.</p>' +
    '</div>' +
    '<div style="margin-top:20px;">' +
    '<h4 style="font-size:12px; text-transform:uppercase; color:#064e3b; margin-bottom:6px;">LAMPIRAN: SUSUNAN PERSONALIA PENGURUS</h4>' +
    tabelPersonaliaHtml +
    '</div>';

  var nowIso = d.toISOString();
  var suratId = uuid();

  var suratRow = {
    id: suratId,
    letter_number: noSk,
    title: 'SK Susunan Pengurus ' + wNama + ' (' + thnMulai + '-' + thnSelesai + ')',
    letter_type: 'SK',
    content: contentSk,
    status: 'PUBLISHED',
    tanggal_surat: nowIso.slice(0, 10),
    created_by: user.username,
    created_by_name: user.full_name || user.username,
    created_at: nowIso,
    submitted_at: nowIso,
    published_at: nowIso,
    approved_by: 'Ketua Umum DPP',
    rejection_notes: '',
    sha256_hash: '',
    pdf_url: (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/surat',
    qr_verify_url: (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/verifikasi-surat?no=' + encodeURIComponent(noSk),
    attachment_url: '',
    wilayah_id: wId
  };

  Database.insert(TABS.SURAT, suratRow);

  // Perbarui sk_id di Sheet_Pengurus
  allPejabat.forEach(function (pj) {
    Database.updateRow(TABS.PENGURUS, pj._row, { sk_id: noSk, updated_at: nowIso });
  });

  audit(user.username, 'SK_PENGURUS_GENERATED', 'Penerbitan SK Struktur DPP ' + noSk + ' (' + wNama + ')', 'DIVISI');

  return {
    ok: true,
    data: {
      id: suratId,
      letter_number: noSk,
      title: suratRow.title,
      total_pejabat: allPejabat.length,
      published_at: nowIso
    },
    message: 'Surat Keputusan (SK) Struktur Kepengurusan DPP No: ' + noSk + ' resmi diterbitkan!'
  };
}
