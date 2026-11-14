/**
 * SIAP APII v3.0.0 Enterprise - Keuangan.gs
 * Pembukuan Kas Syar'i 4 Kantong, Alur Dual-Approval, Batas Kas Tunai & Rekonsiliasi Bulanan
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Mengambil Mutasi Buku Kas & Ringkasan Saldo 4 Kantong Syariah
 */
function handleGetKeuanganList_(session, payload) {
  var reqWilayah = payload && payload.wilayah_id ? payload.wilayah_id : session.wilayahId;
  var targetWilayah = resolveAuthorizedWilayah_(session, reqWilayah);

  var filter = targetWilayah === 'ALL' ? null : { wilayah_id: targetWilayah };
  var rawList = dbFind('Sheet_Keuangan', filter, 300);

  var saldo = {
    total: 0,
    zakat: 0,
    infaqDakwah: 0,
    wakaf: 0,
    amilOperasional: 0
  };

  var list = rawList.map(function(row) {
    var nominal = Number(row[COL_KEUANGAN.NOMINAL]) || 0;
    var tipe = row[COL_KEUANGAN.TIPE]; // MASUK atau KELUAR
    var status = row[COL_KEUANGAN.STATUS_APPROVAL];
    var kantong = row[COL_KEUANGAN.KANTONG_SYARIAH] || 'INFAQ_DAKWAH';

    // Saldo hanya dipengaruhi transaksi yang APPROVED
    if (status === 'APPROVED') {
      var multiplier = (tipe === 'MASUK') ? 1 : -1;
      var net = nominal * multiplier;

      saldo.total += net;
      if (kantong === 'ZAKAT') saldo.zakat += net;
      else if (kantong === 'WAKAF') saldo.wakaf += net;
      else if (kantong === 'AMIL_OPERASIONAL') saldo.amilOperasional += net;
      else saldo.infaqDakwah += net;
    }

    return {
      id: row[COL_KEUANGAN.ID],
      wilayahId: row[COL_KEUANGAN.WILAYAH_ID],
      noVoucher: row[COL_KEUANGAN.NO_VOUCHER],
      tipe: tipe,
      kantongSyariah: kantong,
      kategori: row[COL_KEUANGAN.KATEGORI],
      nominal: nominal,
      tanggal: row[COL_KEUANGAN.TANGGAL],
      keterangan: row[COL_KEUANGAN.KETERANGAN],
      buktiUrl: row[COL_KEUANGAN.BUKTI_URL],
      status: status,
      statusApproval: status,
      verifiedBendahara: row[COL_KEUANGAN.VERIFIED_BENDAHARA_BY],
      approvedKetua: row[COL_KEUANGAN.APPROVED_KETUA_BY],
      noKwitansi: row[COL_KEUANGAN.NO_KWITANSI],
      createdAt: row[COL_KEUANGAN.CREATED_AT]
    };
  });

  return { ok: true, saldo: saldo, list: list };
}

/**
 * Helper Internal Pembukuan Kas Masuk (BKM) untuk Auto-Refund LPJ Divisi & Sistem Internal
 */
function recordInternalKasMasuk_(wilayahId, nominal, kantong, kategori, keterangan, actorUsername, actorUserId, tanggal, buktiUrl) {
  return withScriptLock_(function() {
    var now = new Date();
    var numNominal = Number(nominal) || 0;
    if (numNominal <= 0) {
      return { ok: false, error: 'Nominal kas masuk harus lebih besar dari 0.' };
    }

    var seqBkm = getNextSequence(wilayahId, 'KAS_BKM');
    var padSeq = ('000' + seqBkm).slice(-3);
    var ym = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMM');
    var noVoucher = 'BKM-' + ym + '-' + padSeq;
    var noKwitansi = 'KW-IN-' + ym + '-' + padSeq;
    var id = 'KEU-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000);

    var rowArray = [
      id,
      wilayahId,
      noVoucher,
      'MASUK',
      kantong || 'INFAQ_DAKWAH',
      kategori || 'Infaq Dakwah Umum',
      numNominal,
      tanggal || Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy'),
      keterangan || 'Penerimaan Infaq / Donasi Dakwah',
      buktiUrl || '',
      'APPROVED',
      actorUsername || 'SYSTEM',
      actorUsername || 'SYSTEM',
      noKwitansi,
      Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
    ];

    dbInsert('Sheet_Keuangan', rowArray);
    logAudit(actorUserId || 'SYSTEM', wilayahId, 'KAS_MASUK', 'Keuangan', id, { noVoucher: noVoucher, nominal: numNominal, kantong: kantong || 'INFAQ_DAKWAH' });

    return {
      ok: true,
      id: id,
      noVoucher: noVoucher,
      noKwitansi: noKwitansi,
      message: 'Kas masuk berhasil dibukukan dan kwitansi resmi siap dicetak.'
    };
  }, 10000);
}

/**
 * Pembukuan Kas Masuk (Infaq, Donasi, Zakat) - Langsung Sah oleh Bendahara
 */
function handleSaveKasMasuk_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'bendahara', 'ketua']);
  if (!roleGuard.ok) return roleGuard;

  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);
  return recordInternalKasMasuk_(
    wilayahId,
    payload.nominal,
    payload.kantong_syariah || 'INFAQ_DAKWAH',
    payload.kategori || 'Infaq Dakwah Umum',
    payload.keterangan || 'Penerimaan Infaq / Donasi Dakwah',
    session.username,
    session.userId,
    payload.tanggal,
    payload.bukti_url
  );
}

/**
 * Pengajuan Voucher Kas Keluar oleh Pengurus / Divisi (Draf Awal)
 */
function handleAjukanKasKeluar_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'bendahara', 'ketua', 'sekretaris', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);
  var now = new Date();
  var nominal = Number(payload.nominal) || 0;
  if (nominal <= 0) {
    return { ok: false, error: 'Nominal pengeluaran kas harus lebih besar dari 0.' };
  }

  var kantong = payload.kantong_syariah || 'INFAQ_DAKWAH';
  var kategori = payload.kategori || 'Operasional Kegiatan';
  var keterangan = payload.keterangan || '';

  // Validasi Sharia Guard
  var shariaCheck = validateShariaDisbursement(kantong, kategori, keterangan);
  if (!shariaCheck.valid) {
    return { ok: false, error: shariaCheck.error };
  }

  var id = 'KEU-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000);
  var draftVoucher = 'DRAFT-BKK-' + Math.floor(1000 + Math.random() * 9000);

  var rowArray = [
    id,
    wilayahId,
    draftVoucher,
    'KELUAR',
    kantong,
    kategori,
    nominal,
    payload.tanggal || Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy'),
    keterangan,
    payload.bukti_url || '',
    'VERIFIKASI_BENDAHARA', // Tahap 1
    '',
    '',
    '',
    Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
  ];

  dbInsert('Sheet_Keuangan', rowArray);
  logAudit(session.userId, wilayahId, 'AJUKAN_KAS_KELUAR', 'Keuangan', id, { nominal: nominal, kantong: kantong });

  return {
    ok: true,
    id: id,
    status: 'VERIFIKASI_BENDAHARA',
    message: 'Permohonan kas keluar berhasil diajukan untuk verifikasi nota oleh Bendahara.'
  };
}

/**
 * Dual-Approval Tahap 1: Verifikasi Kelayakan Nota oleh Bendahara
 */
function handleVerifyKasBendahara_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'bendahara']);
  if (!roleGuard.ok) return roleGuard;

  var keuId = payload.keuangan_id;
  if (!keuId) return { ok: false, error: 'ID transaksi kas wajib diisi.' };

  var row = dbFindOne('Sheet_Keuangan', { id: keuId });
  if (!row) return { ok: false, error: 'Voucher kas tidak ditemukan.' };

  var tenantGuard = assertRecordTenantAccess_(session, row[COL_KEUANGAN.WILAYAH_ID]);
  if (!tenantGuard.ok) return tenantGuard;

  var currentStatus = row[COL_KEUANGAN.STATUS_APPROVAL];
  if (currentStatus !== 'VERIFIKASI_BENDAHARA' && currentStatus !== 'VERIFIED_BENDAHARA') {
    return { ok: false, error: 'Status voucher saat ini (' + currentStatus + ') tidak berada pada antrean verifikasi Bendahara.' };
  }

  var isVerified = payload.is_verified !== false;
  var catatan = payload.catatan || '';
  var status = isVerified ? 'VERIFIKASI_KETUM' : 'REJECTED';

  var updateMap = {};
  updateMap[COL_KEUANGAN.STATUS_APPROVAL] = status;
  updateMap[COL_KEUANGAN.VERIFIED_BENDAHARA_BY] = session.username;
  dbUpdate('Sheet_Keuangan', COL_KEUANGAN.ID, keuId, updateMap);

  logAudit(session.userId, row[COL_KEUANGAN.WILAYAH_ID], 'VERIFY_KAS_BENDAHARA', 'Keuangan', keuId, { status: status, catatan: catatan });
  return { ok: true, status: status, message: isVerified ? 'Voucher lolos verifikasi Bendahara, diteruskan ke Ketua.' : 'Pengajuan kas keluar ditolak Bendahara.' };
}

/**
 * Dual-Approval Tahap 2: Pengesahan Pencairan Kas oleh Ketua Umum / Wilayah
 * Memotong saldo kas secara resmi & menerbitkan nomor BKK sekuensial
 */
function handleApproveKasKetua_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua']);
  if (!roleGuard.ok) return roleGuard;

  var keuId = payload.keuangan_id;
  if (!keuId) return { ok: false, error: 'ID transaksi kas wajib diisi.' };

  return withScriptLock_(function() {
    var row = dbFindOne('Sheet_Keuangan', { id: keuId });
    if (!row) return { ok: false, error: 'Voucher kas tidak ditemukan.' };

    var wilayahId = row[COL_KEUANGAN.WILAYAH_ID];
    var tenantGuard = assertRecordTenantAccess_(session, wilayahId);
    if (!tenantGuard.ok) return tenantGuard;

    if (row[COL_KEUANGAN.STATUS_APPROVAL] === 'APPROVED') {
      return { ok: false, error: 'Voucher kas ini sudah berstatus APPROVED sebelumnya.' };
    }

    var isApproved = payload.is_approved !== false;
    var now = new Date();

    if (!isApproved) {
      var rejectMap = {};
      rejectMap[COL_KEUANGAN.STATUS_APPROVAL] = 'REJECTED';
      rejectMap[COL_KEUANGAN.APPROVED_KETUA_BY] = session.username;
      dbUpdate('Sheet_Keuangan', COL_KEUANGAN.ID, keuId, rejectMap);
      logAudit(session.userId, wilayahId, 'REJECT_KAS_KETUA', 'Keuangan', keuId, { reason: payload.catatan || '' });
      return { ok: true, status: 'REJECTED', message: 'Pencairan kas ditolak oleh Ketua.' };
    }

    // Jika Disahkan: Terbitkan Nomor Resmi BKK Sekuensial
    var seqBkk = getNextSequence(wilayahId, 'KAS_BKK');
    var padSeq = ('000' + seqBkk).slice(-3);
    var ym = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMM');
    var noVoucherResmi = 'BKK-' + ym + '-' + padSeq; // BKK-202611-001
    var noKwitansi = 'KW-OUT-' + ym + '-' + padSeq;

    var approveMap = {};
    approveMap[COL_KEUANGAN.NO_VOUCHER] = noVoucherResmi;
    approveMap[COL_KEUANGAN.STATUS_APPROVAL] = 'APPROVED';
    approveMap[COL_KEUANGAN.APPROVED_KETUA_BY] = session.username;
    approveMap[COL_KEUANGAN.NO_KWITANSI] = noKwitansi;
    dbUpdate('Sheet_Keuangan', COL_KEUANGAN.ID, keuId, approveMap);

    logAudit(session.userId, wilayahId, 'APPROVE_KAS_KETUA', 'Keuangan', keuId, { noVoucher: noVoucherResmi, noKwitansi: noKwitansi });
    return {
      ok: true,
      status: 'APPROVED',
      noVoucher: noVoucherResmi,
      noKwitansi: noKwitansi,
      message: 'Pengeluaran kas telah disahkan resmi oleh Ketua. Saldo buku kas terpotong dan kwitansi dual-slip siap dicetak.'
    };
  }, 10000);
}

/**
 * Rekonsiliasi Kas Bulanan Otomatis (Tiap Tanggal 30/31)
 */
function handleGenerateMonthlyClosing_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'bendahara', 'ketua']);
  if (!roleGuard.ok) return roleGuard;

  var wilayahId = resolveAuthorizedWilayah_(session, payload && payload.wilayah_id);
  var data = handleGetKeuanganList_(session, { wilayah_id: wilayahId });

  var closingReport = {
    wilayahId: wilayahId,
    periodeBulan: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'MMMM yyyy'),
    saldoAkhir: data.saldo,
    totalMutasi: data.list.length,
    generatedAt: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss'),
    generatedBy: session.username
  };

  logAudit(session.userId, wilayahId, 'MONTHLY_CLOSING_GENERATED', 'Keuangan', 'CLOSING-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMM'), closingReport);
  return { ok: true, closingReport: closingReport, message: 'Laporan rekonsiliasi kas bulanan berhasil digenerate untuk Dewan Pengawas.' };
}

