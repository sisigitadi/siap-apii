/**
 * SIAP APII v3.0.0 Enterprise - Divisi.gs
 * Pengelolaan Program Kerja 7 Divisi Resmi (ART Pasal 16), RAB, & Pelaporan LPJ
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

var KODE_7_DIVISI = ['humas', 'litbang', 'sosmed', 'dakwah', 'bisnis', 'hukum', 'umum'];

/**
 * Mengambil Daftar Usulan Program Kerja Divisi
 */
function handleGetDivisiPrograms_(session, payload) {
  var reqWilayah = payload && payload.wilayah_id ? payload.wilayah_id : session.wilayahId;
  var targetWilayah = resolveAuthorizedWilayah_(session, reqWilayah);

  var filter = targetWilayah === 'ALL' ? null : { wilayah_id: targetWilayah };
  var rawList = dbFind('Sheet_Divisi', filter, 200);

  var list = rawList.map(function(row) {
    return {
      id: row[COL_DIVISI.ID],
      wilayahId: row[COL_DIVISI.WILAYAH_ID],
      divisiKode: row[COL_DIVISI.DIVISI_KODE],
      namaProgram: row[COL_DIVISI.NAMA_PROGRAM],
      latarBelakang: row[COL_DIVISI.LATAR_BELAKANG],
      targetSasaran: row[COL_DIVISI.TARGET_SASARAN],
      rabNominal: Number(row[COL_DIVISI.RAB_NOMINAL]) || 0,
      tglPelaksanaan: row[COL_DIVISI.TGL_PELAKSANAAN],
      status: row[COL_DIVISI.STATUS], // DRAFT, AJUKAN, DISETUJUI, PELAKSANAAN, LPJ_SELESAI, REJECTED
      catatanKetua: row[COL_DIVISI.CATATAN_KETUA],
      lpjDriveUrl: row[COL_DIVISI.LPJ_DRIVE_URL],
      realisasiDana: Number(row[COL_DIVISI.REALISASI_DANA]) || 0,
      createdBy: row[COL_DIVISI.CREATED_BY],
      updatedAt: row[COL_DIVISI.UPDATED_AT],
      kantongSyariah: row[COL_DIVISI.KANTONG_SYARIAH] || 'INFAQ_DAKWAH'
    };
  });

  return { ok: true, list: list };
}

/**
 * Simpan / Ajukan Usulan Program Kerja Divisi
 */
function handleSaveDivisiProgram_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua_divisi', 'sekretaris', 'ketua']);
  if (!roleGuard.ok) return roleGuard;

  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);
  var programId = payload.id || ('PRG-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000));
  var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
  var divisiKode = String(payload.divisi_kode || session.divisi || 'dakwah').toLowerCase();
  var kantongSyariah = payload.kantong_syariah || 'INFAQ_DAKWAH';

  if (session.role === 'ketua_divisi' && session.divisi && divisiKode !== String(session.divisi).toLowerCase()) {
    return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Ketua Divisi hanya dapat mengajukan program kerja untuk divisinya sendiri (' + session.divisi + ').' };
  }

  var existing = dbFindOne('Sheet_Divisi', { id: programId });
  if (existing) {
    var tenantGuard = assertRecordTenantAccess_(session, existing[COL_DIVISI.WILAYAH_ID]);
    if (!tenantGuard.ok) return tenantGuard;

    if (session.role === 'ketua_divisi' && session.divisi && String(existing[COL_DIVISI.DIVISI_KODE]).toLowerCase() !== String(session.divisi).toLowerCase()) {
      return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Anda tidak berwenang mengubah program kerja divisi lain.' };
    }

    var updateMap = {};
    updateMap[COL_DIVISI.DIVISI_KODE] = divisiKode;
    if (payload.nama_program !== undefined) updateMap[COL_DIVISI.NAMA_PROGRAM] = payload.nama_program;
    if (payload.latar_belakang !== undefined) updateMap[COL_DIVISI.LATAR_BELAKANG] = payload.latar_belakang;
    if (payload.target_sasaran !== undefined) updateMap[COL_DIVISI.TARGET_SASARAN] = payload.target_sasaran;
    if (payload.rab_nominal !== undefined) updateMap[COL_DIVISI.RAB_NOMINAL] = Number(payload.rab_nominal) || 0;
    if (payload.tgl_pelaksanaan !== undefined) updateMap[COL_DIVISI.TGL_PELAKSANAAN] = payload.tgl_pelaksanaan;
    updateMap[COL_DIVISI.STATUS] = payload.status || 'AJUKAN';
    if (payload.catatan_ketua !== undefined) updateMap[COL_DIVISI.CATATAN_KETUA] = payload.catatan_ketua || '';
    updateMap[COL_DIVISI.UPDATED_AT] = nowStr;
    updateMap[COL_DIVISI.KANTONG_SYARIAH] = kantongSyariah;
    dbUpdate('Sheet_Divisi', COL_DIVISI.ID, programId, updateMap);
  } else {
    var rowArray = [
      programId,
      wilayahId,
      divisiKode,
      payload.nama_program || 'Program Kerja Baru',
      payload.latar_belakang || '',
      payload.target_sasaran || '',
      Number(payload.rab_nominal) || 0,
      payload.tgl_pelaksanaan || Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy'),
      payload.status || 'AJUKAN',
      '',
      '',
      0,
      session.username,
      nowStr,
      kantongSyariah
    ];
    dbInsert('Sheet_Divisi', rowArray);
  }

  logAudit(session.userId, wilayahId, 'SAVE_PROGRAM_DIVISI', 'Divisi', programId, { divisi: divisiKode, kantong: kantongSyariah });
  return { ok: true, programId: programId, message: 'Usulan program kerja divisi berhasil disimpan.' };
}

/**
 * Pengesahan / Penolakan Pagu Program Kerja Divisi oleh Ketua
 */
function handleApproveDivisiProgram_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua']);
  if (!roleGuard.ok) return roleGuard;

  var programId = payload.program_id || payload.id;
  if (!programId) return { ok: false, error: 'ID program kerja wajib disertakan.' };

  var row = dbFindOne('Sheet_Divisi', { id: programId });
  if (!row) return { ok: false, error: 'Program kerja tidak ditemukan.' };

  var tenantGuard = assertRecordTenantAccess_(session, row[COL_DIVISI.WILAYAH_ID]);
  if (!tenantGuard.ok) return tenantGuard;

  var isApproved = payload.is_approved !== false;
  var newStatus = isApproved ? 'DISETUJUI' : 'REJECTED';
  var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');

  var updateMap = {};
  updateMap[COL_DIVISI.STATUS] = newStatus;
  updateMap[COL_DIVISI.CATATAN_KETUA] = payload.catatan_ketua || (isApproved ? 'Disetujui Ketua' : 'Perlu penyesuaian RAB');
  if (payload.rab_nominal !== undefined && Number(payload.rab_nominal) > 0) {
    updateMap[COL_DIVISI.RAB_NOMINAL] = Number(payload.rab_nominal);
  }
  updateMap[COL_DIVISI.UPDATED_AT] = nowStr;
  dbUpdate('Sheet_Divisi', COL_DIVISI.ID, programId, updateMap);

  logAudit(session.userId, row[COL_DIVISI.WILAYAH_ID], 'APPROVE_PROGRAM_DIVISI', 'Divisi', programId, { status: newStatus });
  return {
    ok: true,
    programId: programId,
    status: newStatus,
    message: isApproved ? 'Program kerja dan pagu RAB telah disetujui Ketua.' : 'Program kerja dikembalikan dengan catatan Ketua.'
  };
}

/**
 * Pengajuan Pencairan Dana Program Kerja ke Kas Syar'i (BKK Tahap 1)
 * Tidak menambah realisasi_dana sebelum BKK disahkan Ketua
 */
function handleRequestProkerDisbursement_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua_divisi', 'ketua']);
  if (!roleGuard.ok) return roleGuard;

  var programId = payload.program_id || payload.id;
  if (!programId) return { ok: false, error: 'ID program kerja wajib disertakan.' };

  var row = dbFindOne('Sheet_Divisi', { id: programId });
  if (!row) return { ok: false, error: 'Program kerja tidak ditemukan.' };

  var wilayahId = row[COL_DIVISI.WILAYAH_ID];
  var tenantGuard = assertRecordTenantAccess_(session, wilayahId);
  if (!tenantGuard.ok) return tenantGuard;

  if (session.role === 'ketua_divisi' && session.divisi && String(row[COL_DIVISI.DIVISI_KODE]).toLowerCase() !== String(session.divisi).toLowerCase()) {
    return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Anda tidak berwenang mencairkan anggaran divisi lain.' };
  }

  var statusProker = row[COL_DIVISI.STATUS];
  if (statusProker !== 'DISETUJUI' && statusProker !== 'PELAKSANAAN') {
    return { ok: false, error: 'Pencairan hanya dapat diajukan untuk program kerja berstatus DISETUJUI (Status saat ini: ' + statusProker + ').' };
  }

  var nominal = Number(payload.nominal) || Number(row[COL_DIVISI.RAB_NOMINAL]) || 0;
  var kantong = payload.kantong_syariah || row[COL_DIVISI.KANTONG_SYARIAH] || 'INFAQ_DAKWAH';
  var kategori = payload.kategori || ('Pencairan Proker: ' + row[COL_DIVISI.NAMA_PROGRAM]);
  var keterangan = payload.keterangan || ('Realisasi program kerja ' + row[COL_DIVISI.NAMA_PROGRAM] + ' [' + programId + ']');

  var shariaCheck = validateShariaDisbursement(kantong, kategori, keterangan);
  if (!shariaCheck.valid) {
    return { ok: false, error: shariaCheck.error };
  }

  var now = new Date();
  var keuId = 'KEU-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000);
  var draftVoucher = 'DRAFT-BKK-' + Math.floor(1000 + Math.random() * 9000);

  dbInsert('Sheet_Keuangan', [
    keuId,
    wilayahId,
    draftVoucher,
    'KELUAR',
    kantong,
    kategori,
    nominal,
    Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy'),
    keterangan,
    payload.bukti_url || '',
    'VERIFIKASI_BENDAHARA',
    '',
    '',
    '',
    Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
  ]);

  if (statusProker === 'DISETUJUI') {
    var progUpdate = {};
    progUpdate[COL_DIVISI.STATUS] = 'PELAKSANAAN';
    progUpdate[COL_DIVISI.UPDATED_AT] = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
    dbUpdate('Sheet_Divisi', COL_DIVISI.ID, programId, progUpdate);
  }

  logAudit(session.userId, wilayahId, 'REQUEST_PROKER_DISBURSEMENT', 'Divisi', programId, { keuId: keuId, nominal: nominal, kantong: kantong });
  return {
    ok: true,
    programId: programId,
    keuanganId: keuId,
    status: 'VERIFIKASI_BENDAHARA',
    message: 'Permohonan pencairan dana program kerja telah dikirim ke antrean verifikasi Bendahara.'
  };
}

/**
 * Pengunggahan LPJ Program Kerja & Rekonsiliasi Anggaran (Auto-Refund BKM Internal Aman)
 */
function handleSubmitDivisiLPJ_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  var programId = payload.program_id;
  if (!programId) return { ok: false, error: 'ID program kerja wajib disertakan.' };

  return withScriptLock_(function() {
    var row = dbFindOne('Sheet_Divisi', { id: programId });
    if (!row) return { ok: false, error: 'Program kerja tidak ditemukan.' };

    var wilayahId = row[COL_DIVISI.WILAYAH_ID];
    var tenantGuard = assertRecordTenantAccess_(session, wilayahId);
    if (!tenantGuard.ok) return tenantGuard;

    if (session.role === 'ketua_divisi' && session.divisi && String(row[COL_DIVISI.DIVISI_KODE]).toLowerCase() !== String(session.divisi).toLowerCase()) {
      return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Anda hanya dapat mengunggah LPJ untuk divisi sendiri.' };
    }

    var lpjDriveUrl = payload.lpj_drive_url || '';
    var realisasiDana = Number(payload.realisasi_dana) || 0;
    var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');

    var rabNominal = Number(row[COL_DIVISI.RAB_NOMINAL]) || 0;
    var sisaAnggaran = rabNominal - realisasiDana;

    var updateMap = {};
    updateMap[COL_DIVISI.STATUS] = 'LPJ_SELESAI';
    updateMap[COL_DIVISI.LPJ_DRIVE_URL] = lpjDriveUrl;
    updateMap[COL_DIVISI.REALISASI_DANA] = realisasiDana;
    updateMap[COL_DIVISI.UPDATED_AT] = nowStr;
    dbUpdate('Sheet_Divisi', COL_DIVISI.ID, programId, updateMap);

    // Jika ada sisa anggaran lebih dari 0, otomatis bukukan BKM pengembalian kas via helper internal
    var refundRes = null;
    if (sisaAnggaran > 0) {
      var kantongAsal = row[COL_DIVISI.KANTONG_SYARIAH] || 'INFAQ_DAKWAH';
      refundRes = recordInternalKasMasuk_(
        wilayahId,
        sisaAnggaran,
        kantongAsal,
        'Pengembalian Sisa Anggaran Divisi',
        'Pengembalian sisa dana kegiatan ' + row[COL_DIVISI.NAMA_PROGRAM],
        session.username,
        session.userId
      );
    }

    logAudit(session.userId, wilayahId, 'SUBMIT_LPJ', 'Divisi', programId, {
      realisasiDana: realisasiDana,
      sisaAnggaran: sisaAnggaran,
      refundVoucher: refundRes ? refundRes.noVoucher : null
    });

    return {
      ok: true,
      sisaAnggaran: sisaAnggaran,
      refundVoucher: refundRes ? refundRes.noVoucher : null,
      message: 'LPJ program kerja berhasil diserahkan dan diverifikasi.' + (sisaAnggaran > 0 ? ' Sisa anggaran Rp ' + sisaAnggaran + ' otomatis dibukukan kembali ke kas yayasan.' : '')
    };
  }, 10000);
}

