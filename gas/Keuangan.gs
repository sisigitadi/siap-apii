/**
 * ============================================================================
 * Keuangan.gs - Modul Buku Kas Syar'i, Kwitansi Dual-Slip & Simulator Digital
 * ============================================================================
 * Alur Kerja Pengendalian Kas & Dual-Approval System:
 *   - PENDING --verify(BENDAHARA)--> VERIFIED_BY_BENDAHARA (atau AUTO APPROVED jika <= threshold)
 *   - VERIFIED_BY_BENDAHARA --verify(KETUA)--> APPROVED
 *   - Setiap penolakan beralih ke status DRAFT_REVISI (Benteng A-08, anti-deadlock)
 *   - Pembatalan transaksi disahkan menjadi status VOID (Benteng A-09, anti-fraud)
 *   - Multi-tenant partitioning per wilayah (Benteng A-01 & Benteng A-02)
 *
 * Taksonomi Penomoran Otomatis:
 *   - Kwitansi Kas Masuk: {urut}/KW-M-{wilayah}/{bulanRomawi}/{tahun}
 *   - Voucher Kas Keluar: {urut}/VKK-{wilayah}/{bulanRomawi}/{tahun}
 *   - Kas Bon Operasional: {urut}/BON-{wilayah}/{bulanRomawi}/{tahun}
 *   - Berita Acara Rekonsiliasi: {urut}/BA-KEU-{wilayah}/{bulanRomawi}/{tahun}
 * ==========================================================================*/

var ACCOUNT_LABELS = {
  KAS_BSI: 'Kas BSI', BRANKAS: 'Brankas', MANDIRI_WAKAF: 'Bank Mandiri Wakaf'
};

/** Ambil label akun kas dinamis dari Sheet_Accounts. */
function getAccountLabels_() {
  try {
    var rows = Database.readAll(TABS.ACCOUNTS);
    if (rows && rows.length > 0) {
      var map = {};
      rows.forEach(function (r) {
        if (r.is_active === 'TRUE' || r.is_active === true) {
          map[r.code] = r.name || r.bank_name || r.code;
        }
      });
      if (Object.keys(map).length > 0) return map;
    }
  } catch (e) {}
  return ACCOUNT_LABELS;
}

/** Ambil kode singkatan wilayah untuk penomoran dokumen */
function getBranchShortCode_(wilayahId) {
  if (!wilayahId || wilayahId === 'DPW_JABODETABEK') return 'JABO';
  if (wilayahId === 'DPP_PUSAT') return 'DPP';
  var clean = String(wilayahId).replace(/^DPW_|^DPD_/, '');
  return clean.slice(0, 4).toUpperCase();
}

/** Bangun nomor voucher/kwitansi baru berpartisi wilayah & tahun. */
function buildVoucherNumber(transactionDate, wilayahId, docType) {
  var d = new Date(transactionDate || new Date());
  var tahun = d.getFullYear();
  var bulan = toRoman(d.getMonth() + 1);
  var wId = wilayahId || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var wCode = getBranchShortCode_(wId);
  var dt = docType || 'VOUCHER_KELUAR';

  var category = (dt === 'KWITANSI_MASUK') ? 'KWM' : (dt === 'KAS_BON' ? 'BON' : (dt === 'BA_REKONSILIASI' ? 'BA' : 'VKK'));
  var seqKey = Database.getPartitionedSequenceKey('KEU', wId, category, tahun);
  var urut = Database.nextSequence(seqKey);
  var urutStr = String(urut);
  while (urutStr.length < 3) urutStr = '0' + urutStr;

  if (dt === 'KWITANSI_MASUK') {
    return urutStr + '/KW-M-' + wCode + '/' + bulan + '/' + tahun;
  } else if (dt === 'KAS_BON') {
    return urutStr + '/BON-' + wCode + '/' + bulan + '/' + tahun;
  } else if (dt === 'BA_REKONSILIASI') {
    return urutStr + '/BA-KEU-' + wCode + '/' + bulan + '/' + tahun;
  }
  return urutStr + '/VKK-' + wCode + '/' + bulan + '/' + tahun;
}

/**
 * getSaldo: total saldo kas dari voucher APPROVED (MASUK - KELUAR).
 * Multi-tenant scoped (Benteng A-02).
 */
function getSaldo(ctx) {
  var isNationalAudit = ctx.user && (ctx.user.role === ROLES.SUPERADMIN || ctx.user.role === ROLES.KETUA_DPP) && (ctx.payload && ctx.payload.scope === 'NASIONAL');
  var userWilayah = (ctx.user && ctx.user.wilayah_id) || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var rows = Database.readAll(TABS.KEUANGAN).filter(function (k) {
    if (k.status !== 'APPROVED') return false;
    var wId = k.wilayah_id || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
    return isNationalAudit ? true : (wId === userWilayah);
  });
  var masuk = 0, keluar = 0;
  rows.forEach(function (k) {
    var amt = Number(k.amount) || 0;
    if (k.type === 'MASUK') masuk += amt; else keluar += amt;
  });
  var saldo = masuk - keluar;

  // Rincian per akun dinamis
  var accMap = getAccountLabels_();
  var perAccount = {};
  for (var acc in accMap) {
    var m = 0, k2 = 0;
    rows.forEach(function (r) {
      if (r.account !== acc) return;
      var amt = Number(r.amount) || 0;
      if (r.type === 'MASUK') m += amt; else k2 += amt;
    });
    perAccount[acc] = { label: accMap[acc], masuk: m, keluar: k2, saldo: m - k2 };
  }

  var finCfg = getSettingValue_('finance_config', { safety_buffer: 2000000, approval_threshold: 500000 });
  var safetyBuffer = Number(finCfg && finCfg.safety_buffer) || 2000000;
  var isBufferLow = saldo < safetyBuffer;

  return {
    ok: true,
    data: {
      saldo: saldo,
      total_masuk: masuk,
      total_keluar: keluar,
      per_account: perAccount,
      safety_buffer: safetyBuffer,
      safety_buffer_warning: isBufferLow ? 'PERINGATAN: Posisi saldo kas berada di bawah batas aman operasional (' + formatRupiah(safetyBuffer) + ')!' : null,
      wilayah_id: isNationalAudit ? 'NASIONAL' : userWilayah
    },
    message: 'Saldo kas berhasil dimuat.'
  };
}

/**
 * getListKeuangan: daftar voucher + filter + paginasi + multi-tenant isolation.
 * @param {object} ctx.payload { status?, type?, doc_type?, q?, limit?, page?, scope? }
 */
function getListKeuangan(ctx) {
  var p = ctx.payload || {};
  var limit = Math.min(Number(p.limit) || 20, 100);
  var page = Math.max(Number(p.page) || 1, 1);
  var q = String(p.q || '').toLowerCase();

  var isNationalAudit = ctx.user && (ctx.user.role === ROLES.SUPERADMIN || ctx.user.role === ROLES.KETUA_DPP) && (p.scope === 'NASIONAL');
  var userWilayah = (ctx.user && ctx.user.wilayah_id) || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';

  var rows = Database.readAll(TABS.KEUANGAN);
  if (!isNationalAudit) {
    rows = rows.filter(function (k) {
      var wId = k.wilayah_id || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
      return wId === userWilayah;
    });
  }

  if (q) {
    rows = rows.filter(function (k) {
      return (k.voucher_number || '').toLowerCase().indexOf(q) !== -1 ||
             (k.description || '').toLowerCase().indexOf(q) !== -1 ||
             (k.category || '').toLowerCase().indexOf(q) !== -1 ||
             (k.pembayar_penerima || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  if (p.status) rows = rows.filter(function (k) { return k.status === p.status; });
  if (p.type) rows = rows.filter(function (k) { return k.type === p.type; });
  if (p.doc_type) rows = rows.filter(function (k) { return (k.doc_type || (k.type === 'MASUK' ? 'KWITANSI_MASUK' : 'VOUCHER_KELUAR')) === p.doc_type; });

  rows.sort(function (a, b) {
    return (b.transaction_date || '').localeCompare(a.transaction_date || '') ||
           (b.created_at || '').localeCompare(a.created_at || '');
  });

  var total = rows.length;
  var start = (page - 1) * limit;
  var isBendahara = ctx.user && (ctx.user.role === ROLES.BENDAHARA || ctx.user.role === ROLES.SUPERADMIN);
  var isKetua = ctx.user && (ctx.user.role === ROLES.KETUA || ctx.user.role === ROLES.SUPERADMIN);

  var items = rows.slice(start, start + limit).map(function (k) {
    var docType = k.doc_type || (k.type === 'MASUK' ? 'KWITANSI_MASUK' : 'VOUCHER_KELUAR');
    var isVoid = (k.status === 'VOID');
    return {
      id: k.id,
      voucher_number: k.voucher_number,
      type: k.type,
      doc_type: docType,
      account: k.account,
      account_label: ACCOUNT_LABELS[k.account] || k.account,
      amount: Number(k.amount) || 0,
      amount_label: formatRupiah(k.amount),
      terbilang: k.terbilang || terbilang(k.amount),
      category: k.category,
      description: k.description,
      pembayar_penerima: k.pembayar_penerima || '',
      proposal_id: k.proposal_id || '',
      transaction_date: k.transaction_date,
      tanggal_label: formatTanggal(k.transaction_date),
      status: k.status,
      status_label: isVoid ? 'DIBATALKAN / VOID' : (STATUS_LABELS[k.status] || k.status),
      receipt_url: k.receipt_url || '',
      wilayah_id: k.wilayah_id || userWilayah,
      verified_by_bendahara: k.verified_by_bendahara,
      verified_by_bendahara_at: k.verified_by_bendahara_at,
      verified_by_ketum: k.verified_by_ketum,
      verified_by_ketum_at: k.verified_by_ketum_at,
      rejection_notes: k.rejection_notes,
      void_reason: k.void_reason || '',
      void_by: k.void_by || '',
      void_at: k.void_at || '',
      created_by: k.created_by,
      can_revise: (k.status === 'DRAFT_REVISI' || k.status === 'REJECTED') && (isBendahara || ctx.user.username === k.created_by),
      can_void: (k.status === 'APPROVED') && (isBendahara || isKetua)
    };
  });

  return {
    ok: true,
    data: { items: items, total: total, page: page, limit: limit },
    message: 'Daftar voucher berhasil dimuat.'
  };
}

/**
 * getVoucherDetail: ambil rincian lengkap 1 voucher / kwitansi resmi.
 */
function getVoucherDetail(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID voucher wajib diisi.' };
  var k = Database.findOne(TABS.KEUANGAN, { id: p.id });
  if (!k) return { ok: false, data: null, message: 'Voucher tidak ditemukan.' };

  var userWilayah = (ctx.user && ctx.user.wilayah_id) || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var wId = k.wilayah_id || userWilayah;
  var docType = k.doc_type || (k.type === 'MASUK' ? 'KWITANSI_MASUK' : 'VOUCHER_KELUAR');
  var tb = k.terbilang || terbilang(k.amount);

  var detail = {
    id: k.id,
    voucher_number: k.voucher_number,
    type: k.type,
    doc_type: docType,
    account: k.account,
    account_label: ACCOUNT_LABELS[k.account] || k.account,
    amount: Number(k.amount) || 0,
    amount_label: formatRupiah(k.amount),
    terbilang: tb,
    category: k.category,
    description: k.description,
    pembayar_penerima: k.pembayar_penerima || '',
    proposal_id: k.proposal_id || '',
    transaction_date: k.transaction_date,
    tanggal_label: formatTanggal(k.transaction_date),
    status: k.status,
    status_label: (k.status === 'VOID') ? 'DIBATALKAN / VOID' : (STATUS_LABELS[k.status] || k.status),
    receipt_url: k.receipt_url || '',
    wilayah_id: wId,
    verified_by_bendahara: k.verified_by_bendahara || '',
    verified_by_bendahara_at: k.verified_by_bendahara_at || '',
    verified_by_ketum: k.verified_by_ketum || '',
    verified_by_ketum_at: k.verified_by_ketum_at || '',
    rejection_notes: k.rejection_notes || '',
    void_reason: k.void_reason || '',
    void_by: k.void_by || '',
    void_at: k.void_at || '',
    created_by: k.created_by,
    created_at: k.created_at,
    qr_verify_url: (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/verifikasi-kuitansi?no=' + encodeURIComponent(k.voucher_number)
  };

  return { ok: true, data: detail, message: 'Detail transaksi berhasil dimuat.' };
}

/**
 * createVoucher: buat voucher baru (Dual-Approval & Threshold). SUPERADMIN, BENDAHARA.
 * @param {object} ctx.payload { type, doc_type, account, amount, category, description,
 *                                pembayar_penerima, proposal_id, transaction_date, receipt_url, receipt_base64 }
 */
function createVoucher(ctx) {
  var p = ctx.payload || {};
  if (!p.type || (p.type !== 'MASUK' && p.type !== 'KELUAR')) {
    return { ok: false, data: null, message: 'Jenis transaksi harus MASUK atau KELUAR.' };
  }
  var accMap = getAccountLabels_();
  if (!accMap[p.account]) {
    return { ok: false, data: null, message: 'Akun kas tidak valid.' };
  }
  var amount = Number(p.amount);
  if (!amount || amount <= 0) {
    return { ok: false, data: null, message: 'Nilai transaksi harus lebih dari 0.' };
  }
  if (!p.description || !String(p.description).trim()) {
    return { ok: false, data: null, message: 'Keterangan transaksi wajib diisi.' };
  }

  var userWilayah = (ctx.user && ctx.user.wilayah_id) || p.wilayah_id || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var tanggal = p.transaction_date || new Date().toISOString().slice(0, 10);
  var docType = p.doc_type || (p.type === 'MASUK' ? 'KWITANSI_MASUK' : 'VOUCHER_KELUAR');
  var vNumber = buildVoucherNumber(tanggal, userWilayah, docType);
  var receiptUrl = String(p.receipt_url || '').trim();

  // Unggah berkas nota/kuitansi ke Drive jika ada
  if (p.receipt_base64) {
    var safeName = (p.receipt_name || ('Nota_' + vNumber.replace(/[^a-zA-Z0-9]/g, '_') + '.jpg'));
    receiptUrl = saveUploadToDrive_(p.receipt_base64, safeName, 'Keuangan_Bukti_Nota') || receiptUrl;
  }

  var now = new Date().toISOString();
  var isBendaharaOrAdmin = ctx.user && (ctx.user.role === ROLES.BENDAHARA || ctx.user.role === ROLES.SUPERADMIN);

  // Baca konfigurasi threshold pengeluaran mandiri Bendahara
  var finCfg = getSettingValue_('finance_config', { approval_threshold: 500000 });
  var threshold = Number(finCfg && finCfg.approval_threshold) || 500000;

  var initialStatus = 'PENDING';
  var verifiedBendahara = '';
  var verifiedBendaharaAt = '';
  var verifiedKetum = '';
  var verifiedKetumAt = '';

  if (p.type === 'MASUK' && isBendaharaOrAdmin) {
    // Kas Masuk langsung disahkan oleh Bendahara
    initialStatus = 'APPROVED';
    verifiedBendahara = ctx.user.username;
    verifiedBendaharaAt = now;
  } else if (p.type === 'KELUAR' && isBendaharaOrAdmin) {
    if (amount <= threshold) {
      // Kas Kecil di bawah threshold disahkan langsung oleh Bendahara (Mandiri)
      initialStatus = 'APPROVED';
      verifiedBendahara = ctx.user.username;
      verifiedBendaharaAt = now;
      verifiedKetum = 'AUTO_THRESHOLD';
      verifiedKetumAt = now;
    } else {
      // Di atas threshold: diverifikasi Tahap 1 oleh Bendahara, menunggu persetujuan Ketua
      initialStatus = 'VERIFIED_BY_BENDAHARA';
      verifiedBendahara = ctx.user.username;
      verifiedBendaharaAt = now;
    }
  }

  var tbText = terbilang(amount);

  var created = Database.insert(TABS.KEUANGAN, {
    id: uuid(),
    voucher_number: vNumber,
    type: p.type,
    account: p.account,
    amount: amount,
    category: p.category || '',
    description: String(p.description).trim(),
    transaction_date: tanggal,
    status: initialStatus,
    verified_by_bendahara: verifiedBendahara,
    verified_by_bendahara_at: verifiedBendaharaAt,
    verified_by_ketum: verifiedKetum,
    verified_by_ketum_at: verifiedKetumAt,
    rejection_notes: '',
    created_by: ctx.user.username,
    created_at: now,
    receipt_url: receiptUrl,
    wilayah_id: userWilayah,
    doc_type: docType,
    pembayar_penerima: String(p.pembayar_penerima || '').trim(),
    terbilang: tbText,
    proposal_id: p.proposal_id || '',
    void_reason: '',
    void_by: '',
    void_at: ''
  });

  // Notifikasi berjenjang
  if (initialStatus === 'PENDING') {
    kirimNotifikasiKeRole_(ROLES.BENDAHARA,
      'Voucher Kas Baru: ' + created.voucher_number,
      'Pemberitahuan Voucher Kas Menunggu Verifikasi',
      'Voucher kas baru <strong>' + created.voucher_number + '</strong> bernilai <strong>' + formatRupiah(amount) + '</strong> (' + (p.type === 'MASUK' ? 'Kas Masuk' : 'Kas Keluar') + ') telah dibuat oleh <strong>' + (ctx.user.full_name || ctx.user.username) + '</strong> dan menunggu verifikasi Anda.',
      'Verifikasi Voucher Kas',
      (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/keuangan');
  } else if (initialStatus === 'VERIFIED_BY_BENDAHARA') {
    kirimNotifikasiKeRole_(ROLES.KETUA,
      'Persetujuan Final Kas: ' + created.voucher_number,
      'Voucher Kas Menunggu Persetujuan Ketua',
      'Voucher kas keluar <strong>' + created.voucher_number + '</strong> senilai <strong>' + formatRupiah(amount) + '</strong> (' + created.description + ') telah diverifikasi oleh Bendahara dan kini menunggu persetujuan final Anda.',
      'Tinjau & Setujui Kas',
      (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/keuangan');
  }

  var statusMsg = (initialStatus === 'APPROVED') ? ' (Langsung disahkan)' :
                  (initialStatus === 'VERIFIED_BY_BENDAHARA') ? ' (Menunggu persetujuan Ketua)' : ' (Menunggu verifikasi Bendahara)';

  return {
    ok: true,
    data: {
      id: created.id,
      voucher_number: created.voucher_number,
      doc_type: docType,
      receipt_url: receiptUrl,
      status: initialStatus,
      terbilang: tbText
    },
    message: 'Transaksi ' + created.voucher_number + ' berhasil dicatat.' + statusMsg
  };
}

/**
 * verifyVoucherBendahara: verifikasi tahap 1. SUPERADMIN, BENDAHARA.
 */
function verifyVoucherBendahara(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID voucher wajib diisi.' };
  var k = Database.findOne(TABS.KEUANGAN, { id: p.id });
  if (!k) return { ok: false, data: null, message: 'Voucher tidak ditemukan.' };
  if (k.status !== 'PENDING') {
    return { ok: false, data: null,
      message: 'Voucher ini tidak dapat diverifikasi (status: ' +
               (STATUS_LABELS[k.status] || k.status) + ').' };
  }
  var now = new Date().toISOString();

  var isMasuk = (k.type === 'MASUK');
  var finCfg = getSettingValue_('finance_config', { approval_threshold: 500000 });
  var threshold = Number(finCfg && finCfg.approval_threshold) || 500000;

  var isUnderThreshold = Number(k.amount) <= threshold;
  var nextStatus = (isMasuk || isUnderThreshold) ? 'APPROVED' : 'VERIFIED_BY_BENDAHARA';
  var verifiedKetumVal = (isUnderThreshold && !isMasuk) ? 'AUTO_THRESHOLD' : '';
  var verifiedKetumAtVal = (isUnderThreshold && !isMasuk) ? now : '';

  Database.updateRow(TABS.KEUANGAN, k._row, {
    status: nextStatus,
    verified_by_bendahara: ctx.user.username,
    verified_by_bendahara_at: now,
    verified_by_ketum: verifiedKetumVal,
    verified_by_ketum_at: verifiedKetumAtVal
  });
  audit(ctx.user.username, 'KEU_VERIFY_BENDAHARA', 'Voucher ' + k.voucher_number + ' -> ' + nextStatus);

  if (nextStatus === 'APPROVED') {
    return { ok: true, data: null,
      message: 'Voucher ' + k.voucher_number + ' berhasil disahkan oleh Bendahara dan masuk pembukuan saldo.' };
  }

  // Notifikasi email ke Ketua DPW untuk persetujuan final kas KELUAR
  kirimNotifikasiKeRole_(ROLES.KETUA,
    'Persetujuan Final Kas: ' + k.voucher_number,
    'Voucher Kas Menunggu Persetujuan Ketua',
    'Voucher kas keluar <strong>' + k.voucher_number + '</strong> senilai <strong>' + formatRupiah(k.amount) + '</strong> (' + k.description + ') telah diverifikasi oleh Bendahara dan kini menunggu persetujuan final Anda.',
    'Tinjau & Setujui Kas',
    (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/keuangan');

  return { ok: true, data: null,
    message: 'Voucher ' + k.voucher_number + ' diverifikasi Bendahara. Menunggu persetujuan final Ketua.' };
}

/**
 * verifyVoucherKetum: verifikasi final. SUPERADMIN, KETUA.
 */
function verifyVoucherKetum(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID voucher wajib diisi.' };
  var k = Database.findOne(TABS.KEUANGAN, { id: p.id });
  if (!k) return { ok: false, data: null, message: 'Voucher tidak ditemukan.' };
  if (k.status !== 'VERIFIED_BY_BENDAHARA') {
    return { ok: false, data: null,
      message: 'Voucher harus diverifikasi Bendahara terlebih dahulu (status: ' +
               (STATUS_LABELS[k.status] || k.status) + ').' };
  }
  var now = new Date().toISOString();
  Database.updateRow(TABS.KEUANGAN, k._row, {
    status: 'APPROVED', verified_by_ketum: ctx.user.username, verified_by_ketum_at: now
  });
  audit(ctx.user.username, 'KEU_VERIFY_KETUM', 'Voucher ' + k.voucher_number + ' APPROVED');

  // Notifikasi email ke pembuat voucher
  kirimNotifikasiKeUser_(k.created_by,
    'Voucher Kas Disetujui: ' + k.voucher_number,
    'Voucher Kas Telah Disetujui Penuh',
    'Voucher kas <strong>' + k.voucher_number + '</strong> bernilai <strong>' + formatRupiah(k.amount) + '</strong> (' + k.description + ') telah disetujui penuh oleh Ketua dan resmi dicatatkan ke saldo buku kas yayasan.',
    'Lihat Buku Kas',
    (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/keuangan');

  return { ok: true, data: null,
    message: 'Voucher ' + k.voucher_number + ' disetujui penuh & masuk perhitungan saldo.' };
}

/**
 * rejectVoucher: tolak voucher beralih ke DRAFT_REVISI (Benteng A-08). SUPERADMIN, KETUA, BENDAHARA.
 */
function rejectVoucher(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID voucher wajib diisi.' };
  if (!p.notes || !String(p.notes).trim()) {
    return { ok: false, data: null, message: 'Alasan penolakan / catatan revisi wajib diisi.' };
  }
  var k = Database.findOne(TABS.KEUANGAN, { id: p.id });
  if (!k) return { ok: false, data: null, message: 'Voucher tidak ditemukan.' };
  if (k.status === 'APPROVED') {
    return { ok: false, data: null, message: 'Voucher yang sudah disetujui tidak dapat ditolak (gunakan fitur VOID).' };
  }
  if (k.status === 'VOID') {
    return { ok: false, data: null, message: 'Voucher ini sudah dibatalkan permanen (VOID).' };
  }

  Database.updateRow(TABS.KEUANGAN, k._row, {
    status: 'DRAFT_REVISI',
    rejection_notes: String(p.notes).trim()
  });
  audit(ctx.user.username, 'KEU_REVISE_REQUESTED', 'Voucher ' + k.voucher_number + ' -> DRAFT_REVISI: ' + p.notes);

  // Notifikasi email ke pembuat voucher
  kirimNotifikasiKeUser_(k.created_by,
    'Revisi Voucher Kas: ' + k.voucher_number,
    'Permintaan Perbaikan Berkas Voucher Kas',
    'Voucher kas <strong>' + k.voucher_number + '</strong> bernilai <strong>' + formatRupiah(k.amount) + '</strong> memerlukan perbaikan berkas dengan catatan:<br/><blockquote style="background:#fef3c7;padding:10px 14px;border-left:4px solid #f59e0b;margin:12px 0;color:#92400e;border-radius:4px;">' + String(p.notes).trim() + '</blockquote>Silakan perbaiki nota atau keterangan melalui tombol [Perbaiki & Ajukan Ulang] di portal.',
    'Buka Portal Keuangan',
    (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/keuangan');

  return { ok: true, data: null, message: 'Voucher ' + k.voucher_number + ' dikembalikan ke pemohon untuk revisi.' };
}

/**
 * resubmitVoucher: ajukan ulang voucher yang berstatus DRAFT_REVISI / REJECTED (Benteng A-08).
 */
function resubmitVoucher(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID voucher wajib diisi.' };
  var k = Database.findOne(TABS.KEUANGAN, { id: p.id });
  if (!k) return { ok: false, data: null, message: 'Voucher tidak ditemukan.' };

  if (k.status !== 'DRAFT_REVISI' && k.status !== 'REJECTED') {
    return { ok: false, data: null, message: 'Hanya voucher yang memerlukan revisi yang dapat diajukan ulang.' };
  }

  var amount = p.amount ? Number(p.amount) : Number(k.amount);
  var desc = p.description ? String(p.description).trim() : k.description;
  var cat = p.category ? String(p.category).trim() : k.category;
  var pembayar = p.pembayar_penerima ? String(p.pembayar_penerima).trim() : (k.pembayar_penerima || '');
  var receiptUrl = k.receipt_url || '';

  if (p.receipt_base64) {
    var safeName = (p.receipt_name || ('Nota_' + k.voucher_number.replace(/[^a-zA-Z0-9]/g, '_') + '.jpg'));
    receiptUrl = saveUploadToDrive_(p.receipt_base64, safeName, 'Keuangan_Bukti_Nota') || receiptUrl;
  } else if (p.receipt_url) {
    receiptUrl = String(p.receipt_url).trim();
  }

  var tbText = terbilang(amount);

  Database.updateRow(TABS.KEUANGAN, k._row, {
    amount: amount,
    description: desc,
    category: cat,
    pembayar_penerima: pembayar,
    receipt_url: receiptUrl,
    terbilang: tbText,
    status: 'PENDING',
    rejection_notes: ''
  });

  audit(ctx.user.username, 'KEU_RESUBMIT', 'Voucher ' + k.voucher_number + ' diajukan ulang setelah revisi');

  kirimNotifikasiKeRole_(ROLES.BENDAHARA,
    'Voucher Kas Diajukan Ulang: ' + k.voucher_number,
    'Pemberitahuan Revisi Voucher Kas Siap Diverifikasi',
    'Voucher kas <strong>' + k.voucher_number + '</strong> bernilai <strong>' + formatRupiah(amount) + '</strong> telah diperbaiki oleh <strong>' + (ctx.user.full_name || ctx.user.username) + '</strong> dan siap diverifikasi kembali.',
    'Verifikasi Ulang Voucher',
    (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/keuangan');

  return { ok: true, data: { id: k.id, status: 'PENDING' }, message: 'Voucher ' + k.voucher_number + ' berhasil diajukan ulang.' };
}

/**
 * voidVoucher: batalkan transaksi kas yang sudah APPROVED secara sah (Benteng A-09).
 * SUPERADMIN, KETUA, BENDAHARA.
 */
function voidVoucher(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID voucher wajib diisi.' };
  if (!p.reason || !String(p.reason).trim()) {
    return { ok: false, data: null, message: 'Alasan pembatalan (VOID) wajib diisi.' };
  }
  var k = Database.findOne(TABS.KEUANGAN, { id: p.id });
  if (!k) return { ok: false, data: null, message: 'Voucher tidak ditemukan.' };
  if (k.status !== 'APPROVED') {
    return { ok: false, data: null, message: 'Hanya transaksi yang telah disahkan (APPROVED) yang dapat dibatalkan (VOID).' };
  }

  var now = new Date().toISOString();
  Database.updateRow(TABS.KEUANGAN, k._row, {
    status: 'VOID',
    void_reason: String(p.reason).trim(),
    void_by: ctx.user.username,
    void_at: now
  });

  audit(ctx.user.username, 'KEU_VOID_TRANSACTION', 'Membatalkan voucher ' + k.voucher_number + ' (VOID): ' + p.reason);

  return { ok: true, data: { id: k.id, status: 'VOID' }, message: 'Transaksi ' + k.voucher_number + ' berhasil dibatalkan (VOID).' };
}

/**
 * updateVoucherReceipt: perbarui tautan bukti transaksi / nota di Google Drive.
 */
function updateVoucherReceipt(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID voucher wajib diisi.' };
  var k = Database.findOne(TABS.KEUANGAN, { id: p.id });
  if (!k) return { ok: false, data: null, message: 'Voucher tidak ditemukan.' };
  var receiptUrl = String(p.receipt_url || '').trim();
  Database.updateRow(TABS.KEUANGAN, k._row, { receipt_url: receiptUrl });
  audit(ctx.user.username, 'KEU_UPDATE_RECEIPT', 'Voucher ' + k.voucher_number);
  return { ok: true, data: { receipt_url: receiptUrl }, message: 'Bukti transaksi berhasil diperbarui.' };
}

/**
 * getAccounts: ambil daftar seluruh rekening kas master + saldo riil saat ini.
 */
function getAccounts(ctx) {
  var accounts = Database.readAll(TABS.ACCOUNTS);
  var vouchers = Database.readAll(TABS.KEUANGAN).filter(function (k) {
    return k.status === 'APPROVED';
  });

  var items = accounts.map(function (a) {
    var masuk = 0, keluar = 0;
    vouchers.forEach(function (v) {
      if (v.account === a.code || v.account === a.id) {
        var amt = Number(v.amount) || 0;
        if (v.type === 'MASUK') masuk += amt; else keluar += amt;
      }
    });
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      nama_rekening: a.name,
      bank_name: a.bank_name || a.name,
      bank_vendor: a.bank_name || a.name,
      account_number: a.account_number || '-',
      nomor_rekening: a.account_number || '-',
      holder_name: a.holder_name || '',
      atas_nama: a.holder_name || '',
      category: a.category || 'Operasional DPW',
      jenis: (a.account_number && a.account_number !== '-') ? 'BANK' : 'KAS',
      is_active: a.is_active === 'TRUE' || a.is_active === true,
      show_on_public: a.show_on_public === 'TRUE' || a.show_on_public === true,
      saldo: masuk - keluar,
      total_masuk: masuk,
      total_keluar: keluar,
      created_at: a.created_at,
      updated_at: a.updated_at
    };
  });

  return { ok: true, data: items, accounts: items, message: 'Daftar rekening berhasil dimuat.' };
}

/**
 * saveAccount: buat atau perbarui rekening kas.
 */
function saveAccount(ctx) {
  var p = ctx.payload || {};
  var name = p.name || p.nama_rekening;
  if (!name) {
    return { ok: false, data: null, message: 'Nama akun rekening wajib diisi.' };
  }
  var bankName = p.bank_name || p.bank_vendor || name;
  var code = p.code || ('ACC_' + String(bankName || name).trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 15));
  code = String(code).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  var accountNumber = p.account_number || p.nomor_rekening || '-';
  var holderName = p.holder_name || p.atas_nama || 'YAYASAN APOLOGET ISLAM INDONESIA';
  var category = p.category || (accountNumber !== '-' ? 'Operasional DPW' : 'Kas Kecil');
  var now = new Date().toISOString();

  var isPublic = (p.show_on_public === true || p.show_on_public === 'TRUE' || p.show_on_public === 'true' || p.show_on_public === 1);
  var isActive = (p.is_active !== false && p.is_active !== 'FALSE' && p.is_active !== 'false' && p.is_active !== 0);

  if (p.id) {
    var target = Database.findOne(TABS.ACCOUNTS, { id: p.id }) || Database.findOne(TABS.ACCOUNTS, { code: p.id });
    if (!target) return { ok: false, data: null, message: 'Rekening tidak ditemukan.' };
    Database.updateRow(TABS.ACCOUNTS, target._row, {
      name: name,
      bank_name: bankName,
      account_number: accountNumber,
      holder_name: holderName,
      category: category,
      is_active: isActive ? 'TRUE' : 'FALSE',
      show_on_public: isPublic ? 'TRUE' : 'FALSE',
      updated_at: now
    });
    audit(ctx.user.username, 'ACCOUNT_UPDATED', 'Memperbarui rekening ' + code + ' (' + name + ')', 'KEUANGAN');
    return { ok: true, data: { id: target.id, code: code, name: name }, message: 'Rekening berhasil diperbarui.' };
  } else {
    var existing = Database.findOne(TABS.ACCOUNTS, { code: code });
    if (existing) {
      code = code + '_' + Math.floor(Math.random() * 899 + 100);
    }
    var newAcc = Database.insert(TABS.ACCOUNTS, {
      id: uuid(),
      code: code,
      name: name,
      bank_name: bankName,
      account_number: accountNumber,
      holder_name: holderName,
      category: category,
      is_active: isActive ? 'TRUE' : 'FALSE',
      show_on_public: isPublic ? 'TRUE' : 'FALSE',
      created_at: now,
      updated_at: now
    });
    audit(ctx.user.username, 'ACCOUNT_CREATED', 'Menambah rekening baru ' + code + ' (' + name + ')', 'KEUANGAN');
    return { ok: true, data: { id: newAcc.id, code: code, name: name }, message: 'Rekening baru berhasil ditambahkan.' };
  }
}

/**
 * deleteAccount: nonaktifkan atau hapus rekening kas.
 */
function deleteAccount(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID rekening wajib diisi.' };
  var acc = Database.findOne(TABS.ACCOUNTS, { id: p.id }) || Database.findOne(TABS.ACCOUNTS, { code: p.id });
  if (!acc) return { ok: false, data: null, message: 'Rekening tidak ditemukan.' };

  var hasVoucher = Database.findOne(TABS.KEUANGAN, { account: acc.code }) || Database.findOne(TABS.KEUANGAN, { account: acc.id });
  if (hasVoucher) {
    Database.updateRow(TABS.ACCOUNTS, acc._row, { is_active: 'FALSE', show_on_public: 'FALSE', updated_at: new Date().toISOString() });
    audit(ctx.user.username, 'ACCOUNT_DEACTIVATED', 'Menonaktifkan rekening ' + acc.code + ' (memiliki riwayat transaksi)', 'KEUANGAN');
    return { ok: true, data: { deactivated: true }, message: 'Rekening dinonaktifkan karena telah memiliki riwayat transaksi kas.' };
  }

  Database.deleteRow(TABS.ACCOUNTS, acc._row);
  audit(ctx.user.username, 'ACCOUNT_DELETED', 'Menghapus rekening ' + acc.code, 'KEUANGAN');
  return { ok: true, data: { deleted: true }, message: 'Rekening kas berhasil dihapus.' };
}

/**
 * getPublicAccounts: daftar rekening donasi aktif untuk publik.
 * Mendukung filter wilayah (Regional Lens).
 */
function getPublicAccounts(ctx) {
  var p = ctx.payload || ctx.parameter || {};
  var targetWilayah = p.wilayah || p.w || p.wilayah_id || null;

  var rows = Database.readAll(TABS.ACCOUNTS).filter(function (a) {
    var isPub = (a.is_active === 'TRUE' || a.is_active === true) &&
                (a.show_on_public === 'TRUE' || a.show_on_public === true);
    if (!isPub) return false;
    if (targetWilayah) {
      // Tampilkan rekening cabang terkait atau rekening nasional DPP
      return !a.wilayah_id || a.wilayah_id === targetWilayah || a.wilayah_id === 'DPP_PUSAT';
    }
    return true;
  });
  var items = rows.map(function (a) {
    return {
      code: a.code,
      name: a.name,
      nama_rekening: a.name,
      bank_name: a.bank_name || a.name,
      bank_vendor: a.bank_name || a.name,
      account_number: a.account_number || '-',
      nomor_rekening: a.account_number || '-',
      holder_name: a.holder_name || 'YAYASAN APOLOGET ISLAM INDONESIA',
      atas_nama: a.holder_name || 'YAYASAN APOLOGET ISLAM INDONESIA',
      category: a.category || 'Operasional DPW',
      wilayah_id: a.wilayah_id || 'DPW_JABODETABEK'
    };
  });
  return { ok: true, data: items, message: 'Rekening resmi publik berhasil dimuat.' };
}

/**
 * verifyKwitansiPublic: verifikasi keabsahan kwitansi/voucher kas publik (UU PDP No. 27/2022).
 * Dapat dipanggil via QR Code pada kwitansi dual-slip atau pencarian nomor kwitansi.
 */
function verifyKwitansiPublic(ctx) {
  var p = ctx.payload || ctx.parameter || {};
  var noKwitansi = String(p.voucher_number || p.no || p.no_kwitansi || p.id || p.query || '').trim();
  if (!noKwitansi) {
    return { ok: false, data: null, message: 'Nomor bukti kwitansi wajib disertakan.' };
  }

  var row = Database.findOne(TABS.KEUANGAN, { voucher_number: noKwitansi }) ||
            Database.findOne(TABS.KEUANGAN, { id: noKwitansi });

  if (!row) {
    return { ok: false, data: null, message: 'Nomor kwitansi atau bukti kas tidak terdaftar dalam pangkalan data resmi.' };
  }

  // Masking nama pembayar/donatur sesuai standar UU PDP
  var rawName = String(row.pembayar_penerima || '').trim();
  var maskedName = '-';
  if (rawName) {
    var parts = rawName.split(' ');
    if (parts.length === 1) {
      maskedName = parts[0].slice(0, 2) + '***';
    } else {
      maskedName = parts[0] + ' ' + parts.slice(1).map(function (w) { return w.charAt(0) + '***'; }).join(' ');
    }
  }

  var isApproved = (row.status === 'APPROVED');
  var isVoid = (row.status === 'VOID');

  var wilayahNama = (row.wilayah_id === 'DPP_PUSAT') ? 'DPP APII (Pusat)' : 'DPW APII Jabodetabek';

  return {
    ok: true,
    data: {
      voucher_number: row.voucher_number,
      doc_type: row.doc_type || 'KWITANSI_MASUK',
      type: row.type,
      amount: row.amount,
      terbilang: row.terbilang || (terbilang(Number(row.amount) || 0) + ' Rupiah'),
      transaction_date: row.transaction_date,
      pembayar_masked: maskedName,
      category: row.category,
      wilayah_id: row.wilayah_id,
      wilayah_nama: wilayahNama,
      status: row.status,
      is_valid: isApproved,
      is_void: isVoid,
      void_reason: isVoid ? (row.void_reason || 'Dibatalkan oleh otoritas keuangan') : null,
      verified_at: row.verified_by_ketum_at || row.verified_by_bendahara_at || row.created_at
    },
    message: isApproved ? 'Kwitansi sah & tercatat resmi dalam pembukuan kas APII.' :
             (isVoid ? 'Kwitansi telah DIBATALKAN (VOID) dan tidak berlaku lagi.' : 'Kwitansi sedang dalam proses verifikasi otoritas keuangan.')
  };
}

/**
 * ============================================================================
 * KAS SIMULATOR & DIGITAL INFLOW PIPELINE (Benteng A-10)
 * ============================================================================
 */

/**
 * getKasSimulatorData: ambil pangkalan data simulasi kas & proyeksi inflow digital.
 */
function getKasSimulatorData(ctx) {
  var userWilayah = (ctx.user && ctx.user.wilayah_id) || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var allSims = Database.readAll(TABS.KAS_SIMULATOR) || [];
  var now = new Date();

  // Filter per wilayah & auto-expire jika > 30 hari (Benteng A-10)
  var branchSims = [];
  allSims.forEach(function (s) {
    var wId = s.wilayah_id || userWilayah;
    if (wId !== userWilayah) return;

    // Periksa kadaluarsa 30 hari untuk status PROYEKSI_DIGITAL atau PENDING_SETTLEMENT
    if (s.status === 'PROYEKSI_DIGITAL' || s.status === 'PENDING_SETTLEMENT') {
      var expDate = s.expires_at ? new Date(s.expires_at) : (s.created_at ? new Date(new Date(s.created_at).getTime() + 30*86400000) : null);
      if (expDate && now > expDate) {
        Database.updateRow(TABS.KAS_SIMULATOR, s._row, { status: 'KADALUARSA' });
        s.status = 'KADALUARSA';
      }
    }
    branchSims.push(s);
  });

  // Hitung saldo riil saat ini
  var saldoRes = getSaldo(ctx);
  var saldoRiil = (saldoRes && saldoRes.data && saldoRes.data.saldo) || 0;

  // Hitung total proyeksi aktif (belum cair)
  var totalProyeksiNet = 0;
  branchSims.forEach(function (s) {
    if (s.status === 'PROYEKSI_DIGITAL' || s.status === 'PENDING_SETTLEMENT') {
      totalProyeksiNet += (Number(s.net_amount) || 0);
    }
  });

  var freeCashFlow = saldoRiil + totalProyeksiNet;

  return {
    ok: true,
    data: {
      saldo_riil: saldoRiil,
      total_proyeksi: totalProyeksiNet,
      free_cash_flow: freeCashFlow,
      safety_buffer: (saldoRes && saldoRes.data && saldoRes.data.safety_buffer) || 2000000,
      items: branchSims,
      default_rates: {
        TIKTOK: 50,
        YOUTUBE: 30,
        QRIS: 0.7,
        DONATUR_TETAP: 0,
        USD_TO_IDR: 16250
      }
    },
    message: 'Data simulasi kas berhasil dimuat.'
  };
}

/**
 * saveKasSimulation: simpan entri proyeksi inflow digital baru.
 */
function saveKasSimulation(ctx) {
  var p = ctx.payload || {};
  var userWilayah = (ctx.user && ctx.user.wilayah_id) || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var platform = p.platform || 'TIKTOK';
  var grossAmount = Number(p.gross_amount) || 0;
  var feePct = Number(p.fee_percentage) || (platform === 'TIKTOK' ? 50 : (platform === 'YOUTUBE' ? 30 : (platform === 'QRIS' ? 0.7 : 0)));
  var feeAmount = Number(p.fee_amount) || Math.round((grossAmount * feePct) / 100);
  var netAmount = Number(p.net_amount) || (grossAmount - feeAmount);

  var now = new Date();
  var expiresAt = new Date(now.getTime() + 30 * 86400000).toISOString();

  var created = Database.insert(TABS.KAS_SIMULATOR, {
    id: uuid(),
    wilayah_id: userWilayah,
    platform: platform,
    gross_amount: grossAmount,
    fee_percentage: feePct,
    fee_amount: feeAmount,
    net_amount: netAmount,
    pembayar: String(p.pembayar || 'Donatur Siaran Langsung / Digital').trim(),
    keterangan: String(p.keterangan || ('Proyeksi Inflow ' + platform)).trim(),
    status: p.status || 'PROYEKSI_DIGITAL',
    created_by: ctx.user.username,
    created_at: now.toISOString(),
    expires_at: expiresAt
  });

  audit(ctx.user.username, 'KAS_SIMULATION_SAVED', 'Simulasi Inflow ' + platform + ': ' + formatRupiah(netAmount));

  return {
    ok: true,
    data: created,
    message: 'Proyeksi inflow digital berhasil disimpan (Berlaku 30 hari).'
  };
}

/**
 * convertSimulationToKas: konversi 1-klik proyeksi digital menjadi Kwitansi Masuk resmi.
 */
function convertSimulationToKas(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID simulasi wajib diisi.' };
  var sim = Database.findOne(TABS.KAS_SIMULATOR, { id: p.id });
  if (!sim) return { ok: false, data: null, message: 'Data simulasi tidak ditemukan.' };

  if (sim.status === 'DANA_CAIR_MUTASI') {
    return { ok: false, data: null, message: 'Proyeksi ini telah dikonversi sebelumnya menjadi bukti kas masuk.' };
  }
  if (sim.status === 'KADALUARSA') {
    return { ok: false, data: null, message: 'Proyeksi ini telah kadaluarsa (> 30 hari).' };
  }

  var userWilayah = sim.wilayah_id || (ctx.user && ctx.user.wilayah_id) || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var tanggal = p.transaction_date || new Date().toISOString().slice(0, 10);
  var netAmt = Number(sim.net_amount) || 0;
  var accountCode = p.account || 'KAS_BSI';

  var vNumber = buildVoucherNumber(tanggal, userWilayah, 'KWITANSI_MASUK');
  var now = new Date().toISOString();
  var tbText = terbilang(netAmt);

  var createdVoucher = Database.insert(TABS.KEUANGAN, {
    id: uuid(),
    voucher_number: vNumber,
    type: 'MASUK',
    account: accountCode,
    amount: netAmt,
    category: 'Donasi Digital & Media',
    description: 'Pencairan ' + sim.platform + ' (' + sim.keterangan + ')',
    transaction_date: tanggal,
    status: 'APPROVED',
    verified_by_bendahara: ctx.user.username,
    verified_by_bendahara_at: now,
    verified_by_ketum: 'AUTO_THRESHOLD',
    verified_by_ketum_at: now,
    rejection_notes: '',
    created_by: ctx.user.username,
    created_at: now,
    receipt_url: '',
    wilayah_id: userWilayah,
    doc_type: 'KWITANSI_MASUK',
    pembayar_penerima: sim.pembayar || 'Donatur Media Digital',
    terbilang: tbText,
    proposal_id: '',
    void_reason: '',
    void_by: '',
    void_at: ''
  });

  Database.updateRow(TABS.KAS_SIMULATOR, sim._row, {
    status: 'DANA_CAIR_MUTASI'
  });

  audit(ctx.user.username, 'KAS_SIMULATION_CONVERTED', 'Konversi ' + sim.platform + ' -> ' + vNumber + ' (' + formatRupiah(netAmt) + ')');

  return {
    ok: true,
    data: {
      voucher: createdVoucher,
      simulation_id: sim.id
    },
    message: 'Proyeksi ' + sim.platform + ' berhasil dikonversi menjadi Kwitansi Masuk sah No: ' + vNumber
  };
}
