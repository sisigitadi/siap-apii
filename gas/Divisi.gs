/**
 * ============================================================================
 * Divisi.gs — Modul Usulan Program Divisi Kerja
 * ============================================================================
 * Aturan KETAT:
 *   1. Divisi hanya melihat & mengusulkan divisinya SENDIRI (diambil dari
 *      ctx.user.division, TIDAK PERNAH dari payload frontend).
 *   2. Workflow: DRAFT -> AJUKAN -> DISETUJUI / DITOLAK.
 *      NOL publikasi langsung — divisi hanya Simpan Draf / Ajukan.
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
    'Usulan program <strong>' + d.program_title + '</strong> (ID: <code>' + d.tracking_id + '</code>) telah disetujui oleh Ketua DPW untuk pelaksanaan program kerja.' + (p.notes ? '<br/><strong>Catatan Ketua:</strong> ' + Auth.esc(p.notes) : ''),
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
    (lpjNotes ? '<strong>Catatan LPJ:</strong> ' + Auth.esc(lpjNotes) + '<br/>' : '') +
    '<strong>Tautan LPJ:</strong> <a href="' + lpjUrl + '" target="_blank">' + lpjUrl + '</a>',
    'Tinjau Laporan di Portal',
    (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/divisi');

  return { ok: true, data: null,
    message: 'LPJ Program ' + d.tracking_id + ' berhasil diserahkan. Siklus program selesai!' };
}
