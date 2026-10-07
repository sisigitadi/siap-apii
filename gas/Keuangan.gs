/**
 * ============================================================================
 * Keuangan.gs — Modul Buku Kas & Voucher (Dual Approval)
 * ============================================================================
 * State machine:
 *   PENDING --verify(BENDAHARA)--> VERIFIED_BY_BENDAHARA --verify(KETUA)--> APPROVED
 *   setiap tahap bisa --reject--> REJECTED (catatan wajib)
 * Hanya voucher APPROVED yang masuk perhitungan saldo.
 *
 * Nomor voucher otomatis: {urut}/KEU-APII/JABO/{romawi bulan}/{tahun}
 * ==========================================================================*/

var ACCOUNT_LABELS = {
  KAS_BSI: 'Kas BSI', BRANKAS: 'Brankas', MANDIRI_WAKAF: 'Bank Mandiri Wakaf'
};

/** Bangun nomor voucher baru (increment counter per tahun). */
function buildVoucherNumber(transactionDate) {
  var d = new Date(transactionDate || new Date());
  var tahun = d.getFullYear();
  var bulan = toRoman(d.getMonth() + 1);
  var urut = Database.nextSequence('KEU:' + tahun);
  var urutStr = String(urut);
  while (urutStr.length < 3) urutStr = '0' + urutStr;
  return urutStr + '/KEU-APII/JABO/' + bulan + '/' + tahun;
}

/**
 * getSaldo: total saldo kas dari voucher APPROVED (MASUK - KELUANGAN).
 * KEUANGAN_READ_ROLES.
 */
function getSaldo(ctx) {
  var rows = Database.readAll(TABS.KEUANGAN).filter(function (k) {
    return k.status === 'APPROVED';
  });
  var masuk = 0, keluar = 0;
  rows.forEach(function (k) {
    var amt = Number(k.amount) || 0;
    if (k.type === 'MASUK') masuk += amt; else keluar += amt;
  });
  // Rincian per akun.
  var perAccount = {};
  for (var acc in ACCOUNT_LABELS) {
    var m = 0, k2 = 0;
    rows.forEach(function (r) {
      if (r.account !== acc) return;
      var amt = Number(r.amount) || 0;
      if (r.type === 'MASUK') m += amt; else k2 += amt;
    });
    perAccount[acc] = { label: ACCOUNT_LABELS[acc], masuk: m, keluar: k2, saldo: m - k2 };
  }
  return { ok: true,
    data: { saldo: masuk - keluar, total_masuk: masuk, total_keluar: keluar,
            per_account: perAccount },
    message: 'Saldo kas berhasil dimuat.' };
}

/**
 * getListKeuangan: daftar voucher + filter + paginasi. KEUANGAN_READ_ROLES.
 * @param {object} ctx.payload { status?, type?, q?, limit?, page? }
 */
function getListKeuangan(ctx) {
  var p = ctx.payload || {};
  var limit = Math.min(Number(p.limit) || 20, 100);
  var page = Math.max(Number(p.page) || 1, 1);
  var q = String(p.q || '').toLowerCase();

  var rows = Database.readAll(TABS.KEUANGAN);
  if (q) {
    rows = rows.filter(function (k) {
      return (k.voucher_number || '').toLowerCase().indexOf(q) !== -1 ||
             (k.description || '').toLowerCase().indexOf(q) !== -1 ||
             (k.category || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  if (p.status) rows = rows.filter(function (k) { return k.status === p.status; });
  if (p.type) rows = rows.filter(function (k) { return k.type === p.type; });

  rows.sort(function (a, b) {
    return (b.transaction_date || '').localeCompare(a.transaction_date || '');
  });

  var total = rows.length;
  var start = (page - 1) * limit;
  var items = rows.slice(start, start + limit).map(function (k) {
    return {
      id: k.id, voucher_number: k.voucher_number, type: k.type,
      account: k.account, account_label: ACCOUNT_LABELS[k.account] || k.account,
      amount: Number(k.amount) || 0, amount_label: formatRupiah(k.amount),
      category: k.category, description: k.description,
      transaction_date: k.transaction_date,
      tanggal_label: formatTanggal(k.transaction_date),
      status: k.status, status_label: STATUS_LABELS[k.status] || k.status,
      verified_by_bendahara: k.verified_by_bendahara,
      verified_by_bendahara_at: k.verified_by_bendahara_at,
      verified_by_ketum: k.verified_by_ketum, verified_by_ketum_at: k.verified_by_ketum_at,
      rejection_notes: k.rejection_notes, created_by: k.created_by
    };
  });

  return { ok: true, data: { items: items, total: total, page: page, limit: limit },
    message: 'Daftar voucher berhasil dimuat.' };
}

/**
 * createVoucher: buat voucher baru berstatus PENDING. SUPERADMIN, BENDAHARA.
 * @param {object} ctx.payload { type, account, amount, category, description,
 *                                transaction_date }
 */
function createVoucher(ctx) {
  var p = ctx.payload || {};
  if (!p.type || (p.type !== 'MASUK' && p.type !== 'KELUAR')) {
    return { ok: false, data: null, message: 'Jenis transaksi harus MASUK atau KELUAR.' };
  }
  if (!ACCOUNT_LABELS[p.account]) {
    return { ok: false, data: null, message: 'Akun kas tidak valid.' };
  }
  var amount = Number(p.amount);
  if (!amount || amount <= 0) {
    return { ok: false, data: null, message: 'Nilai transaksi harus lebih dari 0.' };
  }
  if (!p.description || !String(p.description).trim()) {
    return { ok: false, data: null, message: 'Keterangan transaksi wajib diisi.' };
  }

  var tanggal = p.transaction_date || new Date().toISOString().slice(0, 10);
  var created = Database.insert(TABS.KEUANGAN, {
    id: uuid(), voucher_number: buildVoucherNumber(tanggal),
    type: p.type, account: p.account, amount: amount,
    category: p.category || '', description: String(p.description).trim(),
    transaction_date: tanggal, status: 'PENDING',
    verified_by_bendahara: '', verified_by_bendahara_at: '',
    verified_by_ketum: '', verified_by_ketum_at: '',
    rejection_notes: '', created_by: ctx.user.username,
    created_at: new Date().toISOString()
  });

  // Notifikasi email ke Bendahara
  kirimNotifikasiKeRole_(ROLES.BENDAHARA,
    'Voucher Kas Baru: ' + created.voucher_number,
    'Pemberitahuan Voucher Kas Menunggu Verifikasi',
    'Voucher kas baru <strong>' + created.voucher_number + '</strong> bernilai <strong>' + formatRupiah(amount) + '</strong> (' + (p.type === 'MASUK' ? 'Kas Masuk' : 'Kas Keluar') + ') telah dibuat oleh <strong>' + (ctx.user.full_name || ctx.user.username) + '</strong> dan menunggu verifikasi Anda.',
    'Verifikasi Voucher Kas',
    (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/keuangan');

  return { ok: true, data: { id: created.id, voucher_number: created.voucher_number },
    message: 'Voucher ' + created.voucher_number + ' berhasil dibuat.' };
}

/**
 * verifyVoucherBendahara: verifikasi tahap 1. SUPERADMIN, BENDAHARA.
 * PENDING -> VERIFIED_BY_BENDAHARA.
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
  Database.updateRow(TABS.KEUANGAN, k._row, {
    status: 'VERIFIED_BY_BENDAHARA',
    verified_by_bendahara: ctx.user.username, verified_by_bendahara_at: now
  });
  audit(ctx.user.username, 'KEU_VERIFY_BENDAHARA', 'Voucher ' + k.voucher_number);

  // Notifikasi email ke Ketua DPW untuk persetujuan final
  kirimNotifikasiKeRole_(ROLES.KETUA,
    'Persetujuan Final Kas: ' + k.voucher_number,
    'Voucher Kas Menunggu Persetujuan Ketua',
    'Voucher kas <strong>' + k.voucher_number + '</strong> senilai <strong>' + formatRupiah(k.amount) + '</strong> (' + k.description + ') telah diverifikasi oleh Bendahara dan kini menunggu persetujuan final Anda.',
    'Tinjau & Setujui Kas',
    (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/keuangan');

  return { ok: true, data: null,
    message: 'Voucher ' + k.voucher_number + ' diverifikasi Bendahara. Menunggu verifikasi Ketua.' };
}

/**
 * verifyVoucherKetum: verifikasi final. SUPERADMIN, KETUA.
 * VERIFIED_BY_BENDAHARA -> APPROVED (kedua tanda tangan lengkap).
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
    'Voucher kas <strong>' + k.voucher_number + '</strong> bernilai <strong>' + formatRupiah(k.amount) + '</strong> (' + k.description + ') telah disetujui penuh oleh Ketua DPW dan resmi dicatatkan ke saldo buku kas yayasan.',
    'Lihat Buku Kas',
    (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/keuangan');

  return { ok: true, data: null,
    message: 'Voucher ' + k.voucher_number + ' disetujui penuh & masuk perhitungan saldo.' };
}

/**
 * rejectVoucher: tolak voucher. SUPERADMIN, KETUA. Catatan WAJIB.
 * Bisa dari PENDING atau VERIFIED_BY_BENDAHARA.
 */
function rejectVoucher(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID voucher wajib diisi.' };
  if (!p.notes || !String(p.notes).trim()) {
    return { ok: false, data: null, message: 'Alasan penolakan wajib diisi.' };
  }
  var k = Database.findOne(TABS.KEUANGAN, { id: p.id });
  if (!k) return { ok: false, data: null, message: 'Voucher tidak ditemukan.' };
  if (k.status === 'APPROVED') {
    return { ok: false, data: null, message: 'Voucher yang sudah disetujui tidak dapat ditolak.' };
  }
  if (k.status === 'REJECTED') {
    return { ok: false, data: null, message: 'Voucher ini sudah berstatus ditolak.' };
  }
  Database.updateRow(TABS.KEUANGAN, k._row, {
    status: 'REJECTED', rejection_notes: String(p.notes).trim()
  });
  audit(ctx.user.username, 'KEU_REJECTED', 'Voucher ' + k.voucher_number + ': ' + p.notes);

  // Notifikasi email ke pembuat voucher
  kirimNotifikasiKeUser_(k.created_by,
    'Voucher Kas Ditolak: ' + k.voucher_number,
    'Pemberitahuan Penolakan Voucher Kas',
    'Voucher kas <strong>' + k.voucher_number + '</strong> bernilai <strong>' + formatRupiah(k.amount) + '</strong> telah ditolak dengan catatan:<br/><blockquote style="background:#fee2e2;padding:10px 14px;border-left:4px solid #ef4444;margin:12px 0;color:#991b1b;border-radius:4px;">' + String(p.notes).trim() + '</blockquote>',
    'Buka Portal Keuangan',
    (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/keuangan');

  return { ok: true, data: null, message: 'Voucher ' + k.voucher_number + ' telah ditolak.' };
}
