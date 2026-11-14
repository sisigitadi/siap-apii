/**
 * SIAP APII v3.0.0 Enterprise - InovasiDakwah.gs
 * Backend Handlers untuk Rangkaian 17 Fitur Inovasi Dakwah Unggulan
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

// ============================================================================
// 1. MODUL SIAGA ADVOKASI DA'I (LBH APII CRISIS INTAKE)
// ============================================================================

function handleSubmitAdvokasiIntake_(payload) {
  return withScriptLock_(function() {
    var now = new Date();
    var tiketNo = 'LBH-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMdd') + '-' + Math.floor(100 + Math.random() * 900);
    var id = 'ADV-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 100);
    var wilayahId = payload.wilayah_id || 'DPP_PUSAT';

    var rowArray = [
      id,
      wilayahId,
      tiketNo,
      payload.nama_dai || 'Anonim / Dai APII',
      payload.kontak || '',
      payload.lokasi || '',
      payload.kronologi || '',
      payload.urgensi || 'BIASA', // KILAT atau BIASA
      payload.bukti_url || '',
      'MENUNGGU_DISPOSISI_LBH',
      '',
      Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
    ];

    dbInsert('Sheet_Advokasi', rowArray);
    logAudit('CRISIS_INTAKE', wilayahId, 'SUBMIT_ADVOKASI', 'Advokasi', tiketNo, { urgensi: payload.urgensi });

    return {
      ok: true,
      id: id,
      tiketNo: tiketNo,
      message: 'Laporan krisis hukum berhasil diterima LBH APII. Tim advokasi segera menindaklanjuti.'
    };
  }, 10000);
}

function handleGetAdvokasiList_(session, payload) {
  var reqWilayah = payload && payload.wilayah_id ? payload.wilayah_id : session.wilayahId;
  var targetWilayah = resolveAuthorizedWilayah_(session, reqWilayah);
  var filter = targetWilayah === 'ALL' ? null : { wilayah_id: targetWilayah };
  var rawList = dbFind('Sheet_Advokasi', filter, 100);

  var list = rawList.map(function(row) {
    return {
      id: row[COL_ADVOKASI.ID],
      wilayahId: row[COL_ADVOKASI.WILAYAH_ID],
      tiketNo: row[COL_ADVOKASI.TIKET_NO],
      namaDai: row[COL_ADVOKASI.NAMA_DAI],
      kontak: row[COL_ADVOKASI.KONTAK],
      lokasi: row[COL_ADVOKASI.LOKASI],
      kronologi: row[COL_ADVOKASI.KRONOLOGI],
      urgensi: row[COL_ADVOKASI.URGENSI],
      buktiUrl: row[COL_ADVOKASI.BUKTI_URL],
      status: row[COL_ADVOKASI.STATUS],
      catatanLbh: row[COL_ADVOKASI.CATATAN_LBH],
      updatedAt: row[COL_ADVOKASI.UPDATED_AT]
    };
  });

  return { ok: true, list: list };
}

function handleUpdateAdvokasiStatus_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  if (session.role === 'ketua_divisi' && String(session.divisi || '').toLowerCase() !== 'hukum') {
    return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Hanya Ketua Divisi Hukum & Advokasi yang berwenang memperbarui status perkara LBH.' };
  }

  var id = payload.id;
  if (!id) return { ok: false, error: 'ID kasus advokasi wajib disertakan.' };

  var row = dbFindOne('Sheet_Advokasi', { id: id });
  if (!row) return { ok: false, error: 'Kasus advokasi tidak ditemukan.' };

  var tenantGuard = assertRecordTenantAccess_(session, row[COL_ADVOKASI.WILAYAH_ID]);
  if (!tenantGuard.ok) return tenantGuard;

  var status = payload.status || 'PENDAMPINGAN_BERJALAN';
  var catatanLbh = payload.catatan_lbh || '';
  var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');

  var updateMap = {};
  updateMap[COL_ADVOKASI.STATUS] = status;
  updateMap[COL_ADVOKASI.CATATAN_LBH] = catatanLbh;
  updateMap[COL_ADVOKASI.UPDATED_AT] = nowStr;
  dbUpdate('Sheet_Advokasi', COL_ADVOKASI.ID, id, updateMap);

  logAudit(session.userId, row[COL_ADVOKASI.WILAYAH_ID], 'UPDATE_ADVOKASI', 'Advokasi', id, { status: status });
  return { ok: true, status: status, message: 'Status pendampingan LBH APII berhasil diperbarui.' };
}

function handleSaveTabayyun_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'sekretaris', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  if (session.role === 'ketua_divisi') {
    var div = String(session.divisi || '').toLowerCase();
    if (['humas', 'litbang', 'sosmed', 'hukum'].indexOf(div) === -1) {
      return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Divisi Anda tidak berwenang merilis Radar Tabayyun.' };
    }
  }

  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);
  var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
  var id = payload.id || ('TBY-' + new Date().getTime());

  var existing = dbFindOne('Sheet_Tabayyun', { id: id });
  if (existing) {
    var tenantGuard = assertRecordTenantAccess_(session, existing[COL_TABAYYUN.WILAYAH_ID]);
    if (!tenantGuard.ok) return tenantGuard;

    var updateMap = {};
    if (payload.judul !== undefined) updateMap[COL_TABAYYUN.JUDUL] = payload.judul;
    if (payload.kategori_isu !== undefined) updateMap[COL_TABAYYUN.KATEGORI_ISU] = payload.kategori_isu;
    if (payload.klarifikasi !== undefined) updateMap[COL_TABAYYUN.KLARIFIKASI] = payload.klarifikasi;
    if (payload.sumber_rujukan !== undefined) updateMap[COL_TABAYYUN.SUMBER_RUJUKAN] = payload.sumber_rujukan;
    if (payload.status !== undefined) updateMap[COL_TABAYYUN.STATUS] = payload.status;
    updateMap[COL_TABAYYUN.UPDATED_AT] = nowStr;
    dbUpdate('Sheet_Tabayyun', COL_TABAYYUN.ID, id, updateMap);
  } else {
    dbInsert('Sheet_Tabayyun', [
      id,
      wilayahId,
      payload.judul || 'Klarifikasi Resmi APII',
      payload.kategori_isu || 'Klarifikasi Isu Publik',
      payload.klarifikasi || '',
      payload.sumber_rujukan || '',
      payload.status || 'TERVERIFIKASI',
      session.username,
      nowStr,
      nowStr
    ]);
  }

  logAudit(session.userId, wilayahId, 'SAVE_TABAYYUN', 'Tabayyun', id, { judul: payload.judul });
  return { ok: true, id: id, message: 'Rilis Radar Tabayyun berhasil disimpan.' };
}

// ============================================================================
// 2. MODUL MUALLAF CARE & E-SERTIFIKAT IKRAR SYAHADAT (TASHDIQ)
// ============================================================================

function handleGetMuallafList_(session, payload) {
  var reqWilayah = payload && payload.wilayah_id ? payload.wilayah_id : session.wilayahId;
  var targetWilayah = resolveAuthorizedWilayah_(session, reqWilayah);
  var filter = targetWilayah === 'ALL' ? null : { wilayah_id: targetWilayah };
  var rawList = dbFind('Sheet_Muallaf', filter, 100);

  var list = rawList.map(function(row) {
    return {
      id: row[COL_MUALLAF.ID],
      wilayahId: row[COL_MUALLAF.WILAYAH_ID],
      regNo: row[COL_MUALLAF.REG_NO],
      namaAsli: row[COL_MUALLAF.NAMA_ASLI],
      namaHijrah: row[COL_MUALLAF.NAMA_HIJRAH],
      tglSyahadat: row[COL_MUALLAF.TGL_SYAHADAT],
      pembimbing: row[COL_MUALLAF.PEMBIMBING],
      sertifikatUrl: row[COL_MUALLAF.SERTIFIKAT_URL],
      statusZakat: row[COL_MUALLAF.STATUS_ZAKAT],
      createdAt: row[COL_MUALLAF.CREATED_AT]
    };
  });

  return { ok: true, list: list };
}

function handleSaveMuallaf_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  if (session.role === 'ketua_divisi' && String(session.divisi || '').toLowerCase() !== 'dakwah') {
    return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Hanya Ketua Divisi Dakwah yang berwenang mencatat Muallaf binaan.' };
  }

  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);

  return withScriptLock_(function() {
    var now = new Date();
    var seq = getNextSequence(wilayahId, 'MUALLAF_REG');
    var regNo = 'MLF-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyy') + '-' + ('000' + seq).slice(-4);
    var id = 'MLF-ID-' + now.getTime();
    var nominalZakat = Number(payload.nominal_zakat) || 0;

    var rowArray = [
      id,
      wilayahId,
      regNo,
      payload.nama_asli,
      payload.nama_hijrah || '-',
      payload.tgl_syahadat || Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy'),
      payload.pembimbing || session.username,
      payload.sertifikat_url || '',
      payload.status_zakat || (nominalZakat > 0 ? 'DIAJUKAN_BKK_ZAKAT' : 'MENUNGGU_PENYALURAN'),
      Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
    ];

    dbInsert('Sheet_Muallaf', rowArray);

    // Otomatis buat draf BKK Kantong ZAKAT (Ashnaf Muallaf) bila ada pengajuan santunan
    var zakatDraftId = null;
    if (nominalZakat > 0) {
      zakatDraftId = 'KEU-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000);
      dbInsert('Sheet_Keuangan', [
        zakatDraftId,
        wilayahId,
        'DRAFT-BKK-' + Math.floor(1000 + Math.random() * 9000),
        'KELUAR',
        'ZAKAT',
        'Santunan Ashnaf Muallaf',
        nominalZakat,
        Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy'),
        'Santunan Zakat Ashnaf Muallaf a.n. ' + (payload.nama_hijrah || payload.nama_asli) + ' (' + regNo + ')',
        '',
        'VERIFIKASI_BENDAHARA',
        '',
        '',
        '',
        Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
      ]);
    }

    logAudit(session.userId, wilayahId, 'REGISTER_MUALLAF', 'Muallaf', regNo, { nama: payload.nama_asli, zakatDraftId: zakatDraftId });

    return {
      ok: true,
      id: id,
      regNo: regNo,
      zakatDraftId: zakatDraftId,
      message: 'Data muallaf binaan & e-sertifikat syahadat berhasil diterbitkan.' + (zakatDraftId ? ' Draf BKK Santunan Zakat otomatis dibuat.' : '')
    };
  }, 10000);
}

function handleUpdateMuallafProgress_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  if (session.role === 'ketua_divisi' && String(session.divisi || '').toLowerCase() !== 'dakwah') {
    return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Hanya Ketua Divisi Dakwah yang berwenang memperbarui pembinaan Muallaf.' };
  }

  var targetId = payload.id || payload.reg_no;
  if (!targetId) return { ok: false, error: 'ID atau nomor registrasi muallaf wajib disertakan.' };

  var row = dbFindOne('Sheet_Muallaf', { id: targetId });
  if (!row) {
    row = dbFindOne('Sheet_Muallaf', { reg_no: targetId });
  }
  if (!row) return { ok: false, error: 'Data muallaf tidak ditemukan.' };

  var tenantGuard = assertRecordTenantAccess_(session, row[COL_MUALLAF.WILAYAH_ID]);
  if (!tenantGuard.ok) return tenantGuard;

  var updateMap = {};
  if (payload.status_zakat !== undefined) updateMap[COL_MUALLAF.STATUS_ZAKAT] = payload.status_zakat;
  if (payload.pembimbing !== undefined) updateMap[COL_MUALLAF.PEMBIMBING] = payload.pembimbing;
  if (payload.sertifikat_url !== undefined) updateMap[COL_MUALLAF.SERTIFIKAT_URL] = payload.sertifikat_url;
  dbUpdate('Sheet_Muallaf', COL_MUALLAF.ID, row[COL_MUALLAF.ID], updateMap);

  logAudit(session.userId, row[COL_MUALLAF.WILAYAH_ID], 'UPDATE_MUALLAF_PROGRESS', 'Muallaf', row[COL_MUALLAF.REG_NO], { statusZakat: payload.status_zakat });
  return { ok: true, regNo: row[COL_MUALLAF.REG_NO], message: 'Progres pembinaan & penyaluran muallaf berhasil diperbarui.' };
}

// ============================================================================
// 3. PRESENSI DIGITAL ACARA VIA SCAN QR KTA
// ============================================================================

function handleRecordEventAttendance_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'sekretaris', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  var nia = payload.nia;
  if (!nia) return { ok: false, error: 'NIA anggota wajib diisi.' };

  var eventNama = payload.event_nama || 'Safari Dakwah APII';
  var now = new Date();
  var tglStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy');
  var scanTimeStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);

  // Cek validitas NIA di Sheet_KTA_Nasional
  var ktaRow = dbFindOne('Sheet_KTA_Nasional', { nia: nia });
  var namaAnggota = ktaRow ? ktaRow[COL_KTA_NASIONAL.NAMA_LENGKAP] : (payload.nama_anggota || 'Anggota Tamu');
  var isValid = ktaRow ? (String(ktaRow[COL_KTA_NASIONAL.IS_ACTIVE]).toLowerCase() === 'true') : false;

  var id = 'ATT-' + now.getTime();
  dbInsert('Sheet_Attendance', [
    id,
    wilayahId,
    eventNama,
    tglStr,
    nia,
    namaAnggota,
    scanTimeStr,
    session.username
  ]);

  logAudit(session.userId, wilayahId, 'SCAN_ATTENDANCE', 'Attendance', nia, { event: eventNama, isValidKta: isValid });
  return {
    ok: true,
    isValidKta: isValid,
    namaAnggota: namaAnggota,
    timestamp: scanTimeStr,
    message: 'Presensi digital berhasil dicatat: ' + namaAnggota + ' (' + nia + ')'
  };
}

// ============================================================================
// 4. PELACAK ASET & LOGISTIK DAKWAH (ASSET QR TRACKER)
// ============================================================================

function handleGetAssetsList_(session, payload) {
  var reqWilayah = payload && payload.wilayah_id ? payload.wilayah_id : session.wilayahId;
  var targetWilayah = resolveAuthorizedWilayah_(session, reqWilayah);
  var filter = targetWilayah === 'ALL' ? null : { wilayah_id: targetWilayah };
  var rawList = dbFind('Sheet_Assets', filter, 100);

  var list = rawList.map(function(row) {
    return {
      id: row[COL_ASSETS.ID],
      wilayahId: row[COL_ASSETS.WILAYAH_ID],
      kodeAset: row[COL_ASSETS.KODE_ASET],
      namaBarang: row[COL_ASSETS.NAMA_BARANG],
      kategori: row[COL_ASSETS.KATEGORI],
      kondisi: row[COL_ASSETS.KONDISI],
      lokasiSimpan: row[COL_ASSETS.LOKASI_SIMPAN],
      qrUrl: row[COL_ASSETS.QR_URL]
    };
  });

  return { ok: true, list: list };
}

function handleSaveAssetLoan_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'sekretaris', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  var now = new Date();
  var id = 'LOAN-' + now.getTime();
  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);

  dbInsert('Sheet_Asset_Loans', [
    id,
    wilayahId,
    payload.aset_id,
    payload.divisi_peminjam || session.divisi || 'dakwah',
    payload.penanggung_jawab || session.username,
    payload.tgl_pinjam || Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy'),
    payload.tgl_kembali_rencana || '',
    '', // tgl_kembali_aktual
    'DIPINJAM'
  ]);

  logAudit(session.userId, wilayahId, 'SAVE_ASSET_LOAN', 'AssetLoan', id, { asetId: payload.aset_id });
  return { ok: true, id: id, message: 'Peminjaman logistik dakwah berhasil dicatat.' };
}

// ============================================================================
// 5. MAKTABAH APOLOGETIKA & BANK DALIL DA'I
// ============================================================================

function handleSearchKnowledgeBase_(session, payload) {
  var query = ((payload && payload.query) || '').toLowerCase();
  var kategori = (payload && payload.kategori) || '';

  var rawList = dbFind('Sheet_Knowledge_Base', null, 200);
  var filtered = rawList.filter(function(row) {
    var matchCat = !kategori || row[COL_KNOWLEDGE_BASE.KATEGORI] === kategori;
    var rowText = (row[COL_KNOWLEDGE_BASE.TOPIK] + ' ' + row[COL_KNOWLEDGE_BASE.DALIL_TEXT] + ' ' + row[COL_KNOWLEDGE_BASE.KATA_KUNCI]).toLowerCase();
    var matchQuery = !query || rowText.indexOf(query) !== -1;
    return matchCat && matchQuery;
  });

  var list = filtered.map(function(row) {
    return {
      id: row[COL_KNOWLEDGE_BASE.ID],
      kategori: row[COL_KNOWLEDGE_BASE.KATEGORI],
      topik: row[COL_KNOWLEDGE_BASE.TOPIK],
      dalilText: row[COL_KNOWLEDGE_BASE.DALIL_TEXT],
      sumberReferensi: row[COL_KNOWLEDGE_BASE.SUMBER_REFERENSI],
      kataKunci: row[COL_KNOWLEDGE_BASE.KATA_KUNCI]
    };
  });

  return { ok: true, list: list };
}

// ============================================================================
// 6. KANAL KONSULTASI AQIDAH RAHASIA (ANONYMOUS INQUIRY DESK)
// ============================================================================

function handleSubmitConsultation_(payload) {
  if (!payload || !payload.pertanyaan) {
    return { ok: false, error: 'Pertanyaan konsultasi wajib diisi.' };
  }

  return withScriptLock_(function() {
    var now = new Date();
    var tiketNo = 'TKT-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMdd') + '-' + Math.floor(100 + Math.random() * 900);
    var secretToken = Utilities.getUuid().substring(0, 8).toUpperCase(); // Kunci Rahasia untuk Penanya
    var tokenHash = sha256Hex_(secretToken + ':APII_CONSULT');
    var id = 'CNS-' + now.getTime();

    dbInsert('Sheet_Consultations', [
      id,
      tokenHash,
      tiketNo,
      payload.topik || 'Kajian Kristologi & Perbandingan Agama',
      payload.pertanyaan || '',
      '', // Jawaban
      'MENUNGGU_JAWABAN',
      Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss'),
      ''
    ]);

    return {
      ok: true,
      tiketNo: tiketNo,
      secretToken: secretToken,
      message: 'Pertanyaan konsultasi aqidah rahasia berhasil dikirim. Simpan Nomor Tiket dan Kunci Rahasia Anda untuk mengecek jawaban privat dari Dewan Pakar.'
    };
  }, 10000);
}

function handleCheckConsultation_(ticketNo, secretToken) {
  if (!ticketNo || !secretToken) {
    return { ok: false, error: 'Nomor tiket dan kunci rahasia wajib diisi.' };
  }
  var row = dbFindOne('Sheet_Consultations', { tiket_no: ticketNo });
  if (!row) {
    return { ok: false, error: 'Tiket konsultasi tidak ditemukan.' };
  }

  var tokenHash = sha256Hex_(secretToken + ':APII_CONSULT');
  if (row[COL_CONSULTATIONS.TOKEN_HASH] !== tokenHash) {
    return { ok: false, error: 'Kunci rahasia tiket tidak cocok.' };
  }

  return {
    ok: true,
    tiketNo: ticketNo,
    topik: row[COL_CONSULTATIONS.TOPIK],
    pertanyaan: row[COL_CONSULTATIONS.PERTANYAAN],
    jawaban: row[COL_CONSULTATIONS.JAWABAN],
    status: row[COL_CONSULTATIONS.STATUS],
    createdAt: row[COL_CONSULTATIONS.CREATED_AT],
    answeredAt: row[COL_CONSULTATIONS.ANSWERED_AT]
  };
}

function handleGetConsultationsList_(session, payload) {
  var allowedRead = ['superadmin', 'ketua', 'ketua_divisi', 'pembina', 'pengawas'];
  if (allowedRead.indexOf(session.role) === -1) {
    return { ok: false, code: 'FORBIDDEN_ROLE', error: 'Anda tidak memiliki akses ke Meja Konsultasi Aqidah.' };
  }
  if (session.role === 'ketua_divisi') {
    var div = String(session.divisi || '').toLowerCase();
    if (div !== 'litbang' && div !== 'dakwah') {
      return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Meja Konsultasi Aqidah khusus untuk Divisi Litbang atau Dakwah.' };
    }
  }

  var rawList = dbFind('Sheet_Consultations', null, 200);
  var list = rawList.map(function(row) {
    return {
      id: row[COL_CONSULTATIONS.ID],
      tiketNo: row[COL_CONSULTATIONS.TIKET_NO],
      topik: row[COL_CONSULTATIONS.TOPIK],
      pertanyaan: row[COL_CONSULTATIONS.PERTANYAAN],
      jawaban: row[COL_CONSULTATIONS.JAWABAN],
      status: row[COL_CONSULTATIONS.STATUS],
      createdAt: row[COL_CONSULTATIONS.CREATED_AT],
      answeredAt: row[COL_CONSULTATIONS.ANSWERED_AT]
    };
  });

  return { ok: true, list: list };
}

function handleAnswerConsultation_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  if (session.role === 'ketua_divisi') {
    var div = String(session.divisi || '').toLowerCase();
    if (div !== 'litbang' && div !== 'dakwah') {
      return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Hanya Dewan Pakar Litbang/Dakwah atau Ketua yang berwenang menjawab konsultasi.' };
    }
  }

  var targetId = payload.id || payload.tiket_no;
  if (!targetId || !payload.jawaban) {
    return { ok: false, error: 'ID/Nomor tiket dan jawaban wajib diisi.' };
  }

  var row = dbFindOne('Sheet_Consultations', { id: targetId });
  if (!row) {
    row = dbFindOne('Sheet_Consultations', { tiket_no: targetId });
  }
  if (!row) {
    return { ok: false, error: 'Tiket konsultasi tidak ditemukan.' };
  }

  var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
  var updateMap = {};
  updateMap[COL_CONSULTATIONS.JAWABAN] = payload.jawaban;
  updateMap[COL_CONSULTATIONS.STATUS] = 'TERJAWAB';
  updateMap[COL_CONSULTATIONS.ANSWERED_AT] = nowStr;
  dbUpdate('Sheet_Consultations', COL_CONSULTATIONS.ID, row[COL_CONSULTATIONS.ID], updateMap);

  logAudit(session.userId, session.wilayahId, 'ANSWER_CONSULTATION', 'Consultation', row[COL_CONSULTATIONS.TIKET_NO], {});
  return {
    ok: true,
    tiketNo: row[COL_CONSULTATIONS.TIKET_NO],
    status: 'TERJAWAB',
    answeredAt: nowStr,
    message: 'Jawaban konsultasi rahasia telah disimpan dan dapat diakses penanya melalui tiket.'
  };
}

// ============================================================================
// 7. RISALAH MUSYAWARAH DIGITAL (DIGITAL PLENARY LEDGER)
// ============================================================================

function handleSaveMeetingPlenary_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'sekretaris']);
  if (!roleGuard.ok) return roleGuard;

  var now = new Date();
  var id = 'MTG-' + now.getTime();
  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);

  dbInsert('Sheet_Meetings', [
    id,
    wilayahId,
    payload.judul_rapat || 'Rapat Pleno BPH APII',
    payload.tanggal || Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy'),
    payload.notulen_text || '',
    JSON.stringify(payload.action_items || []),
    payload.dokumentasi_url || '',
    session.username,
    session.username
  ]);

  logAudit(session.userId, wilayahId, 'SAVE_MEETING', 'Meetings', id, { judul: payload.judul_rapat });
  return { ok: true, id: id, message: 'Risalah musyawarah pleno berhasil didokumentasikan.' };
}

