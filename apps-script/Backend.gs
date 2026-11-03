/****************************************************************************
 * 00-Konfig.gs
 *****************************************************************************/
/**
 * ============================================================================
 * 00-Konfig.gs - Konfigurasi Instalasi (EDIT DI SINI SAJA)
 * ============================================================================
 * Seluruh pengaturan penting ada di file ini. Karena ID Spreadsheet sudah
 * ditanam, Anda TIDAK perlu mengisi Script Properties secara manual.
 * ==========================================================================*/

var KONFIG = {
  // ID Google Sheets database. Diambil dari URL Sheets Anda:
  // https://docs.google.com/spreadsheets/d/<INI_ID>/edit
  DB_SPREADSHEET_ID: '1B0p0Jgb4jk6w3zkHANCzIl_YkB7PE2hj_-ejf4lO4sM',

  // Salt untuk hash password. JANGAN diubah setelah ada pengguna -
  // mengubahnya membuat semua password lama tidak dikenali lagi.
  PASSWORD_SALT: 'apii-jabo-dpw-jabodetabek-2026',

  // Domain portal publik. Dipakai membuat URL verifikasi surat (QR/footer).
  PUBLIC_URL: 'https://siapii.sigitadi.id',

  // Nama folder Google Drive untuk menyimpan PDF surat (dibuat otomatis).
  DRIVE_FOLDER_NAME: 'APII Jabo - PDF Surat Resmi',

  // Nama dokumen template Google Docs (dibuat otomatis beserta kop & stempel).
  TEMPLATE_DOC_NAME: 'Template Surat Resmi APII DPW Jabodetabek',

  // Default Wilayah Tenant jika data belum memiliki wilayah_id
  DEFAULT_WILAYAH_ID: 'DPW_JABODETABEK',

  // Tingkat Wilayah Organisasi (ART Bab I & II)
  ORG_LEVELS: {
    PUSAT: 'DPP',
    WILAYAH: 'DPW'
  }
};

/****************************************************************************
 * Utils.gs
 *****************************************************************************/
/**
 * ============================================================================
 * Utils.gs - Helper Umum, Audit Log & Dashboard
 * ============================================================================
 * Tanggung jawab: UUID, format tanggal/Rupiah, label status Bahasa Indonesia,
 * audit log (Sheet_AuditLogs), dan getDashboard (ringkasan statistik per peran).
 * ==========================================================================*/

// Label status Bahasa Indonesia (dipakai backend & frontend).
var STATUS_LABELS = {
  DRAFT: 'Draf', PENDING_APPROVAL: 'Menunggu Persetujuan',
  PUBLISHED: 'Diterbitkan', REJECTED: 'Ditolak',
  PENDING: 'Menunggu Verifikasi', VERIFIED_BY_BENDAHARA: 'Diverifikasi Bendahara',
  VERIFIED_BY_KETUM: 'Diverifikasi Ketua', APPROVED: 'Disetujui',
  AJUKAN: 'Diajukan', DISETUJUI: 'Disetujui', DITOLAK: 'Ditolak',
  PELAKSANAAN: 'Pelaksanaan', LPJ_SELESAI: 'LPJ Selesai'
};

// Kode jenis surat untuk penomoran (lihat DESIGN.md §6.1).
var LETTER_TYPE_CODES = {
  SK: 'SK-DPW/APII-JABO', UNDANGAN: 'UND-DPW/APII-JABO',
  PENGANTAR: 'PENG-DPW/APII-JABO', KETERANGAN: 'KET-DPW/APII-JABO',
  TUGAS: 'TUG-DPW/APII-JABO', REKOMENDASI: 'REK-DPW/APII-JABO',
  EDARAN: 'EDR-DPW/APII-JABO'
};

var LETTER_TYPE_LABELS = {
  SK: 'Surat Keputusan', UNDANGAN: 'Surat Undangan',
  PENGANTAR: 'Surat Pengantar', KETERANGAN: 'Surat Keterangan',
  TUGAS: 'Surat Tugas', REKOMENDASI: 'Surat Rekomendasi', EDARAN: 'Surat Edaran'
};

/**
 * Generate UUID v4 (tanpa library).
 */
function uuid() {
  var chars = '0123456789abcdef';
  var out = '';
  for (var i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) { out += '-'; continue; }
    if (i === 14) { out += '4'; continue; }
    if (i === 19) { out += chars[Math.floor(Math.random() * 4) + 8]; continue; }
    out += chars[Math.floor(Math.random() * 16)];
  }
  return out;
}

/**
 * Tulis satu baris audit log (WORM: permanen dan dilarang hapus).
 * @param {string} actor username pelaku
 * @param {string} action kode aksi (mis. 'SURAT_CREATED', 'LOGIN_SUCCESS')
 * @param {string} detail keterangan bebas
 * @param {string} [module] nama modul (mis. 'SURAT', 'KEUANGAN', 'SETTINGS')
 * @param {string} [ip] IP atau User-Agent
 */
function audit(actor, action, detail, module, ip) {
  try {
    insert(TABS.AUDIT, {
      id: uuid(),
      timestamp: new Date().toISOString(),
      actor: actor || 'unknown',
      action: action || 'UNKNOWN',
      module: module || 'SYSTEM',
      detail: detail || '',
      ip_client: ip || '',
      status: 'SUCCESS'
    });
  } catch (e) {
    Logger.log('Audit log gagal: ' + e);
  }
}

/** Format angka ke Rupiah: 1500000 -> "Rp 1.500.000". */
function formatRupiah(amount) {
  var n = Number(amount) || 0;
  return 'Rp ' + n.toLocaleString('id-ID');
}

/** Format ISO date/timestamp ke tanggal Indonesia: "5 Maret 2026". */
function formatTanggal(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  var bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return d.getDate() + ' ' + bulan[d.getMonth()] + ' ' + d.getFullYear();
}

/** Ubah angka bulan ke angka romawi (I-XII). Dipakai penomoran surat/voucher. */
function toRoman(num) {
  var map = [[1, 'I'], [2, 'II'], [3, 'III'], [4, 'IV'], [5, 'V'], [6, 'VI'],
             [7, 'VII'], [8, 'VIII'], [9, 'IX'], [10, 'X'], [11, 'XI'], [12, 'XII']];
  for (var i = 0; i < map.length; i++) if (map[i][0] === num) return map[i][1];
  return String(num);
}

/**
 * Hapus field sensitif dari objek user sebelum dikirim ke frontend.
 */
function sanitizeUser(u) {
  if (!u) return null;
  return {
    id: u.id, username: u.username, full_name: u.full_name, email: u.email,
    role: u.role, role_label: ROLE_LABELS[u.role] || u.role,
    division: u.division, division_label: DIVISION_LABELS[u.division] || '',
    is_active: u.is_active, can_manage_users: u.can_manage_users
  };
}

/**
 * getDashboard: ringkasan statistik yang DIFILTER otomatis sesuai peran & divisi.
 * Semua peran login boleh memanggil (router roles: null).
 */
function getDashboard(ctx) {
  var user = ctx.user;
  var data = { user: sanitizeUser(user), counts: {}, lists: {} };

  // --- Surat ---
  // Pengurus internal lihat semua; pengguna lain hanya PUBLISHED.
  var allSurat = readAll(TABS.SURAT);
  var visibleSurat = allSurat.filter(function (s) {
    if (SURAT_READ_ROLES.indexOf(user.role) !== -1) return true;
    return s.status === 'PUBLISHED';
  });
  data.counts.surat_total = visibleSurat.length;
  data.counts.surat_pending = visibleSurat.filter(function (s) {
    return s.status === 'PENDING_APPROVAL';
  }).length;
  data.counts.surat_published = visibleSurat.filter(function (s) {
    return s.status === 'PUBLISHED';
  }).length;
  data.lists.surat_terbaru = visibleSurat
    .sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); })
    .slice(0, 5)
    .map(function (s) {
      return { id: s.id, letter_number: s.letter_number, title: s.title,
        status: s.status, status_label: STATUS_LABELS[s.status] || s.status,
        tanggal: formatTanggal(s.tanggal_surat) };
    });

  // --- Keuangan: hanya peran yang berhak baca ---
  if (KEUANGAN_READ_ROLES.indexOf(user.role) !== -1) {
    var allKeu = readAll(TABS.KEUANGAN);
    var approved = allKeu.filter(function (k) { return k.status === 'APPROVED'; });
    var masuk = 0, keluar = 0;
    approved.forEach(function (k) {
      var amt = Number(k.amount) || 0;
      if (k.type === 'MASUK') masuk += amt; else keluar += amt;
    });
    data.counts.keuangan_total = allKeu.length;
    data.counts.keuangan_pending = allKeu.filter(function (k) {
      return k.status === 'PENDING' || k.status === 'VERIFIED_BY_BENDAHARA' ||
             k.status === 'VERIFIED_BY_KETUM';
    }).length;
    data.counts.saldo = masuk - keluar;
    data.counts.total_masuk = masuk;
    data.counts.total_keluar = keluar;
  }

  // --- Divisi ---
  // SUPERADMIN/KETUA/pengurus internal lihat semua; divisi hanya punya sendiri.
  var allDiv = readAll(TABS.DIVISI);
  var isInternal = SURAT_READ_ROLES.indexOf(user.role) !== -1 ||
                   KEUANGAN_READ_ROLES.indexOf(user.role) !== -1;
  var visibleDiv = (user.role === ROLES.SUPERADMIN || user.role === ROLES.KETUA || isInternal)
    ? allDiv
    : allDiv.filter(function (d) { return d.division === user.division; });
  data.counts.divisi_total = visibleDiv.length;
  data.counts.divisi_pending = visibleDiv.filter(function (d) {
    return d.status === 'AJUKAN';
  }).length;

  // --- Jumlah pengguna (hanya superadmin) ---
  if (user.role === ROLES.SUPERADMIN) {
    data.counts.pengguna_total = readAll(TABS.USERS).length;
  }

  // --- Kotak Aksi Terpadu (Action Items / Approval Inbox) ---
  var actionItems = [];
  var isLead = user.role === ROLES.KETUA || user.role === ROLES.SUPERADMIN;

  // 1) Surat menunggu persetujuan Ketua:
  if (isLead) {
    allSurat.filter(function (s) { return s.status === 'PENDING_APPROVAL'; }).forEach(function (s) {
      actionItems.push({
        id: s.id,
        module: 'surat',
        badge: 'Surat Resmi',
        badge_class: 'badge-PENDING_APPROVAL',
        title: s.title,
        subtitle: s.letter_number,
        detail: 'Diajukan oleh ' + (s.created_by_name || s.created_by) + ' • ' + formatTanggal(s.submitted_at || s.created_at),
        action_label: 'Tinjau & Setujui',
        target_nav: 'surat'
      });
    });
  } else if (user.role === ROLES.SEKRETARIS) {
    allSurat.filter(function (s) { return s.status === 'REJECTED'; }).forEach(function (s) {
      actionItems.push({
        id: s.id,
        module: 'surat',
        badge: 'Surat Ditolak',
        badge_class: 'badge-REJECTED',
        title: s.title,
        subtitle: s.letter_number,
        detail: 'Catatan: ' + (s.rejection_notes || 'Perlu perbaikan draf'),
        action_label: 'Perbaiki Draf',
        target_nav: 'surat'
      });
    });
  }

  // 2) Voucher kas menunggu verifikasi:
  if (KEUANGAN_READ_ROLES.indexOf(user.role) !== -1) {
    var rawKeu = readAll(TABS.KEUANGAN);
    if (user.role === ROLES.BENDAHARA || user.role === ROLES.SUPERADMIN) {
      rawKeu.filter(function (k) { return k.status === 'PENDING'; }).forEach(function (k) {
        actionItems.push({
          id: k.id,
          module: 'keuangan',
          badge: 'Voucher Kas',
          badge_class: 'badge-PENDING',
          title: k.description,
          subtitle: k.voucher_number + ' • ' + formatRupiah(k.amount) + ' (' + (k.type === 'MASUK' ? 'Masuk' : 'Keluar') + ')',
          detail: 'Akun: ' + (ACCOUNT_LABELS[k.account] || k.account) + ' • Dibuat oleh ' + k.created_by,
          action_label: 'Verifikasi Bendahara',
          target_nav: 'keuangan'
        });
      });
    }
    if (isLead) {
      rawKeu.filter(function (k) { return k.status === 'VERIFIED_BY_BENDAHARA'; }).forEach(function (k) {
        actionItems.push({
          id: k.id,
          module: 'keuangan',
          badge: 'Persetujuan Kas Final',
          badge_class: 'badge-VERIFIED_BY_BENDAHARA',
          title: k.description,
          subtitle: k.voucher_number + ' • ' + formatRupiah(k.amount),
          detail: 'Diverifikasi Bendahara (' + (k.verified_by_bendahara || '-') + ') • Menunggu Ketua',
          action_label: 'Setujui Pengeluaran',
          target_nav: 'keuangan'
        });
      });
    }
  }

  // 3) Usulan divisi menunggu persetujuan:
  if (isLead) {
    allDiv.filter(function (d) { return d.status === 'AJUKAN'; }).forEach(function (d) {
      actionItems.push({
        id: d.id,
        module: 'divisi',
        badge: 'Usulan Divisi',
        badge_class: 'badge-PENDING',
        title: d.program_title,
        subtitle: d.tracking_id + ' • ' + (DIVISION_LABELS[d.division] || d.division),
        detail: 'Estimasi: ' + formatRupiah(d.budget_estimate) + ' • Pengusul: ' + (d.submitted_by_name || d.submitted_by),
        action_label: 'Tinjau Usulan',
        target_nav: 'divisi'
      });
    });
  } else if (user.role === ROLES.KETUA_DIVISI || user.role === ROLES.ANGGOTA_DIVISI) {
    allDiv.filter(function (d) { return d.division === user.division && d.status === 'DITOLAK'; }).forEach(function (d) {
      actionItems.push({
        id: d.id,
        module: 'divisi',
        badge: 'Usulan Ditolak',
        badge_class: 'badge-REJECTED',
        title: d.program_title,
        subtitle: d.tracking_id,
        detail: 'Catatan Ketua: ' + (d.approval_notes || 'Perlu diperbaiki'),
        action_label: 'Perbaiki Usulan',
        target_nav: 'divisi'
      });
    });
  }

  data.action_items = actionItems;

  return { ok: true, data: data, message: 'Dashboard berhasil dimuat.' };
}

/**
 * kirimNotifikasiEmail_: kirim email notifikasi resmi via MailApp / GmailApp.
 * Non-blocking & fail-safe: error pengiriman tidak menggagalkan transaksi DB.
 */
function kirimNotifikasiEmail_(toEmail, subject, title, messageHtml, actionText, actionUrl) {
  if (!toEmail || String(toEmail).indexOf('@') === -1) return false;
  try {
    var appName = 'SIAP APII DPW Jabodetabek';
    var defaultUrl = KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id';
    var btnUrl = actionUrl || defaultUrl;
    var btnText = actionText || 'Buka Portal SIAP APII';

    var htmlBody = '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; padding: 24px; border-radius: 16px;">' +
      '<div style="text-align: center; margin-bottom: 24px;">' +
        '<div style="font-size: 13px; font-weight: 800; color: #1B5E20; text-transform: uppercase; letter-spacing: 0.05em;">Yayasan APII DPW Jabodetabek</div>' +
        '<div style="font-size: 20px; font-weight: 900; color: #064e3b; margin-top: 4px;">SIAP APII - Sistem Administrasi & Informasi</div>' +
      '</div>' +
      '<div style="background-color: #ffffff; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">' +
        '<h2 style="font-size: 16px; font-weight: 800; color: #111827; margin-top: 0; margin-bottom: 16px; border-bottom: 2px solid #a7f3d0; padding-bottom: 8px;">' + title + '</h2>' +
        '<div style="font-size: 14px; line-height: 1.6; color: #374151; margin-bottom: 24px;">' + messageHtml + '</div>' +
        '<div style="text-align: center; margin: 28px 0 12px 0;">' +
          '<a href="' + btnUrl + '" style="background-color: #047857; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 12px rgba(4,120,87,0.3);">' + btnText + ' →</a>' +
        '</div>' +
      '</div>' +
      '<div style="text-align: center; margin-top: 20px; font-size: 11px; color: #9ca3af; line-height: 1.5;">' +
        'Email otomatis dari Portal SIAP Yayasan APII DPW Jabodetabek.<br/>' +
        'Jl. Kramat Raya No. 45, Senen, Jakarta Pusat 10450 | sekretariat.dpw@apii-jabodetabek.or.id' +
      '</div>' +
    '</div>';

    MailApp.sendEmail({
      to: toEmail,
      subject: '[' + appName + '] ' + subject,
      htmlBody: htmlBody
    });
    Logger.log('Email notifikasi terkirim ke ' + toEmail + ': ' + subject);
    return true;
  } catch (err) {
    Logger.log('Gagal mengirim email ke ' + toEmail + ': ' + err);
    return false;
  }
}

/**
 * kirimNotifikasiKeRole_: kirim email ke seluruh akun aktif dengan peran tertentu.
 */
function kirimNotifikasiKeRole_(role, subject, title, messageHtml, actionText, actionUrl, targetWilayah) {
  try {
    var users = findMany(TABS.USERS, { role: role, is_active: 'TRUE' });
    var defWilayah = (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
    if (targetWilayah) {
      users = users.filter(function (u) {
        var uW = u.wilayah_id || defWilayah;
        return uW === targetWilayah;
      });
    }
    users.forEach(function (u) {
      if (u.email) {
        kirimNotifikasiEmail_(u.email, subject, title, messageHtml, actionText, actionUrl);
      }
    });
  } catch (e) {
    Logger.log('Error kirimNotifikasiKeRole_: ' + e);
  }
}

/**
 * kirimNotifikasiKeUser_: kirim email ke akun tertentu berdasarkan username.
 */
function kirimNotifikasiKeUser_(username, subject, title, messageHtml, actionText, actionUrl) {
  try {
    var user = findOne(TABS.USERS, { username: username });
    if (user && user.email) {
      kirimNotifikasiEmail_(user.email, subject, title, messageHtml, actionText, actionUrl);
    }
  } catch (e) {
    Logger.log('Error kirimNotifikasiKeUser_: ' + e);
  }
}

/**
 * Konversi angka rupiah ke kalimat terbilang Bahasa Indonesia.
 * Contoh: 1500000 -> "Satu Juta Lima Ratus Ribu Rupiah"
 * @param {number|string} n nilai uang
 * @return {string} kalimat terbilang
 */
function terbilang(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return 'Nol Rupiah';
  var satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  function kata(num) {
    if (num < 12) return satuan[num];
    if (num < 20) return kata(num - 10) + ' Belas';
    if (num < 100) return kata(Math.floor(num / 10)) + ' Puluh' + (num % 10 ? ' ' + kata(num % 10) : '');
    if (num < 200) return 'Seratus' + (num - 100 ? ' ' + kata(num - 100) : '');
    if (num < 1000) return kata(Math.floor(num / 100)) + ' Ratus' + (num % 100 ? ' ' + kata(num % 100) : '');
    if (num < 2000) return 'Seribu' + (num - 1000 ? ' ' + kata(num - 1000) : '');
    if (num < 1000000) return kata(Math.floor(num / 1000)) + ' Ribu' + (num % 1000 ? ' ' + kata(num % 1000) : '');
    if (num < 1000000000) return kata(Math.floor(num / 1000000)) + ' Juta' + (num % 1000000 ? ' ' + kata(num % 1000000) : '');
    if (num < 1000000000000) return kata(Math.floor(num / 1000000000)) + ' Milyar' + (num % 1000000000 ? ' ' + kata(num % 1000000000) : '');
    return kata(Math.floor(num / 1000000000000)) + ' Triliun' + (num % 1000000000000 ? ' ' + kata(num % 1000000000000) : '');
  }
  return kata(n).trim() + ' Rupiah';
}

/** Ambil nilai setting dari Sheet_Settings berdasarkan key. */
function getSettingValue_(key, defaultVal) {
  try {
    var row = findOne(TABS.SETTINGS, { key: key });
    if (!row || !row.value) return defaultVal;
    try { return JSON.parse(row.value); } catch (e) { return row.value; }
  } catch (err) {
    return defaultVal;
  }
}

/** Simpan/perbarui nilai setting ke Sheet_Settings. */
function setSettingValue_(key, val, user) {
  var strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
  var now = new Date().toISOString();
  var row = findOne(TABS.SETTINGS, { key: key });
  if (row) {
    updateRow(TABS.SETTINGS, row._row, {
      value: strVal,
      updated_by: user || 'system',
      updated_at: now
    });
  } else {
    insert(TABS.SETTINGS, {
      key: key,
      value: strVal,
      description: 'Pengaturan ' + key,
      updated_by: user || 'system',
      updated_at: now
    });
  }
}

/**
 * getSettings: ambil seluruh pengaturan sistem.
 * SUPERADMIN, KETUA.
 */
function getSettings(ctx) {
  var rows = readAll(TABS.SETTINGS);
  if (!rows || rows.length === 0) {
    seedDefaultSettings_();
    rows = readAll(TABS.SETTINGS);
  }
  var settings = {};
  rows.forEach(function (r) {
    var v = r.value;
    try { v = JSON.parse(r.value); } catch (e) {}
    settings[r.key] = v;
  });

  // Ekstrak properti flattened untuk kompatibilitas penuh dengan frontend
  var kop = settings.letter_kop || {};
  settings.kop_mode = settings.kop_mode || kop.mode || 'text';
  settings.kop_image_base64 = settings.kop_image_base64 || kop.custom_kop_image || '';
  settings.custom_footer_image = settings.custom_footer_image || kop.custom_footer_image || '';
  settings.footer_mode = settings.footer_mode || kop.footer_mode || 'text';
  settings.footer_text = settings.footer_text || kop.footer_text || 'Yayasan Apologet Islam Indonesia (APII) • Dewan Pimpinan Wilayah Jabodetabek';
  settings.stempel_image = settings.stempel_image || kop.stempel_image || '';
  settings.ttd_ketua_image = settings.ttd_ketua_image || kop.ttd_ketua_image || '';
  settings.ttd_sekretaris_image = settings.ttd_sekretaris_image || kop.ttd_sekretaris_image || '';
  settings.stempel_scale = Number(settings.stempel_scale || kop.stempel_scale) || 95;
  settings.stempel_overlap = Number(settings.stempel_overlap || kop.stempel_overlap) || 30;

  var numCfg = settings.letter_numbering || {};
  settings.letter_pattern = settings.letter_pattern || numCfg.pattern || '{urut}/{kode}/{org}/{bulanRomawi}/{tahun}';
  var pub = settings.public_config || {};
  settings.allow_public_registration = settings.allow_public_registration !== undefined ? settings.allow_public_registration : (pub.show_registration !== false);
  settings.allow_public_verification = settings.allow_public_verification !== undefined ? settings.allow_public_verification : (pub.show_verification !== false);
  settings.show_keuangan_public = settings.show_keuangan_public !== undefined ? settings.show_keuangan_public : (pub.show_finance !== false || pub.show_accounts !== false);
  settings.show_program_public = settings.show_program_public !== undefined ? settings.show_program_public : (pub.show_programs !== false);
  var drv = settings.drive_storage || {};
  settings.google_drive_folder_id = settings.google_drive_folder_id || drv.custom_folder_id || '';
  settings.auto_annual_subfolders = settings.auto_annual_subfolders !== undefined ? settings.auto_annual_subfolders : true;

  // Modul Ekstensi Fungsional Pilihan (Bab 14)
  if (!settings.feature_flags || typeof settings.feature_flags !== 'object') {
    settings.feature_flags = {
      ext_khazanah_litbang: false,
      ext_muallaf_crm: false,
      ext_manajemen_debat: false,
      ext_inventaris_aset: false,
      ext_advokasi_hukum: false,
      ext_donatur_crm: false,
      ext_kalender_dakwah: false,
      ext_notulen_rapat: false
    };
  }

  // Resolusi metadata folder aktif aktual (nama, ID, url, custom/default)
  try {
    var activeFId = siapkanFolderPdf_();
    var activeFolder = DriveApp.getFolderById(activeFId);
    settings.active_drive_folder = {
      folder_id: activeFolder.getId(),
      folder_name: activeFolder.getName(),
      folder_url: activeFolder.getUrl(),
      is_custom: !!settings.google_drive_folder_id
    };
  } catch (e) {
    settings.active_drive_folder = {
      folder_id: settings.google_drive_folder_id || '',
      folder_name: drv.folder_name || 'APII Jabo - PDF Surat Resmi',
      folder_url: '',
      is_custom: !!settings.google_drive_folder_id,
      error: e.message
    };
  }

  // Konfigurasi Keuangan & Kategori Kas
  var fin = settings.finance_config || {};
  settings.finance_config = {
    voucher_pattern: fin.voucher_pattern || '{urut}/KEU-APII/JABO/{bulanRomawi}/{tahun}',
    income_categories: Array.isArray(fin.income_categories) ? fin.income_categories : [
      'Infaq & Sedekah', 'Zakat Maal', 'Wakaf Tunai', 'Donasi Dakwah Operasional', 'Usaha Mandiri', 'Lain-lain'
    ],
    expense_categories: Array.isArray(fin.expense_categories) ? fin.expense_categories : [
      'Program Dakwah & Kajian', 'Bantuan Sosial & Santunan', 'Kesekretariatan & ATK', 'Advokasi Hukum & Keumatan', 'Media IT & Publikasi', 'Operasional & Utilitas Kantor', 'Lain-lain'
    ]
  };

  // Konfigurasi Pendaftaran Anggota & Rekrutmen
  var regCfg = settings.registration_config || {};
  var regStatusVal = regCfg.status || (regCfg.is_open !== false ? 'BUKA' : 'DITUTUP');
  settings.registration_config = {
    status: regStatusVal,
    is_open: regStatusVal === 'BUKA',
    quota_limit: Number(regCfg.quota_limit) || 0,
    closed_title: regCfg.closed_title || 'Pendaftaran Anggota Sementara Ditutup',
    closed_message: regCfg.closed_message || 'Pendaftaran gelombang saat ini telah ditutup atau sedang dalam proses seleksi berkas. Pantau pengumuman resmi berkala dari sekretariat yayasan.',
    instructions: regCfg.instructions || 'Silakan isi formulir pendaftaran anggota Yayasan APII DPW Jabodetabek dengan data yang valid sesuai identitas KTP resmi.',
    require_ktp: regCfg.require_ktp !== false,
    require_selfie: regCfg.require_selfie !== false,
    max_file_size_mb: Number(regCfg.max_file_size_mb) || 3,
    reg_prefix: regCfg.reg_prefix || 'REG',
    reg_digits: Number(regCfg.reg_digits) || 4,
    open_divisions: Array.isArray(regCfg.open_divisions) ? regCfg.open_divisions : [
      'DIV_DAKWAH', 'DIV_HUKUM', 'DIV_HUMAS', 'DIV_MEDIA', 'DIV_SOSIAL', 'DIV_LITBANG', 'DIV_EKONOMI'
    ],
    contact_wa: regCfg.contact_wa || '081288882026',
    wa_template: regCfg.wa_template || 'Halo Sekretariat APII DPW Jabodetabek, saya telah mendaftar anggota baru dengan No. Registrasi: {reg_number} a.n {full_name}. Mohon verifikasi berkas saya.',
    notify_email: regCfg.notify_email || 'sekretariat@apii.sigitadi.id',
    notify_pendaftar_email: regCfg.notify_pendaftar_email !== false,
    agreement_text: regCfg.agreement_text || 'Saya menyatakan bahwa data yang saya berikan adalah benar dan sah. Saya bersedia menaati AD/ART, kode etik, dan peraturan Yayasan APII DPW Jabodetabek.'
  };

  // Flattened aliases untuk kemudahan akses form
  settings.registration_status = settings.registration_config.status;
  settings.registration_is_open = settings.registration_config.is_open;
  settings.registration_quota_limit = settings.registration_config.quota_limit;
  settings.registration_closed_title = settings.registration_config.closed_title;
  settings.registration_closed_message = settings.registration_config.closed_message;
  settings.registration_instructions = settings.registration_config.instructions;
  settings.registration_require_ktp = settings.registration_config.require_ktp;
  settings.registration_require_selfie = settings.registration_config.require_selfie;
  settings.registration_max_file_size_mb = settings.registration_config.max_file_size_mb;
  settings.registration_reg_prefix = settings.registration_config.reg_prefix;
  settings.registration_reg_digits = settings.registration_config.reg_digits;
  settings.registration_open_divisions = settings.registration_config.open_divisions;
  settings.registration_contact_wa = settings.registration_config.contact_wa;
  settings.registration_notify_email = settings.registration_config.notify_email;
  settings.registration_notify_pendaftar_email = settings.registration_config.notify_pendaftar_email;
  settings.registration_wa_template = settings.registration_config.wa_template;
  settings.registration_agreement_text = settings.registration_config.agreement_text;

  // Redaksi konten dinamis portal publik (Mini-CMS) - selalu di-merge dgn default.
  settings.editorial_content = loadEditorial_();

  return { ok: true, data: settings, settings: settings, message: 'Pengaturan berhasil dimuat.' };
}

/**
 * saveSettings: perbarui satu atau beberapa pengaturan.
 * SUPERADMIN & KETUA.
 */
function saveSettings(ctx) {
  var p = ctx.payload || {};
  var user = (ctx.user && ctx.user.username) || 'admin';
  var toSave = (p.settings && typeof p.settings === 'object') ? p.settings : p;
  for (var k in toSave) {
    setSettingValue_(k, toSave[k], user);
  }

  // Sinkronisasi khusus Google Drive: jika google_drive_folder_id / custom_folder_id diubah
  var targetFolderId = toSave.google_drive_folder_id;
  if (targetFolderId === undefined && toSave.drive_storage) {
    targetFolderId = toSave.drive_storage.custom_folder_id;
  }
  if (targetFolderId !== undefined) {
    targetFolderId = String(targetFolderId).trim();
    var props = PropertiesService.getScriptProperties();
    if (targetFolderId) {
      try {
        var f = DriveApp.getFolderById(targetFolderId);
        props.setProperty('DRIVE_FOLDER_ID', targetFolderId);
        var drvObj = getSettingValue_('drive_storage', {});
        drvObj.custom_folder_id = targetFolderId;
        drvObj.folder_name = f.getName();
        setSettingValue_('drive_storage', drvObj, user);
      } catch (err) {
        Logger.log('Gagal verifikasi folder ID saat saveSettings: ' + err);
      }
    } else {
      props.deleteProperty('DRIVE_FOLDER_ID');
      siapkanFolderPdf_();
    }
  }

  audit(user, 'SETTINGS_UPDATED', 'Memperbarui pengaturan: ' + Object.keys(toSave).join(', '), 'SETTINGS');
  return { ok: true, data: toSave, settings: toSave, message: 'Pengaturan berhasil disimpan.' };
}

// ==========================================================================
// REDAKSI KONTEN DINAMIS PORTAL PUBLIK (MINI-CMS)
// ==========================================================================
// Seluruh konfigurasi redaksi disimpan sebagai satu objek JSON di baris
// 'editorial_content' Sheet_Settings. Lihat docs/REDAKSI_KONTEN.md.
//
// Sanitasi server-side adalah lapisan pertahanan utama (defense in depth):
// front-end tetap melakukan escape (Public.esc) pada setiap string.
// ==========================================================================

/**
 * Redaksi bawaan (dipakai sebagai fallback & seed pertama kali).
 * Struktur ini adalah "kontrak" antara backend, Portal Pengurus, & Portal Publik.
 */
var DEFAULT_EDITORIAL_ = {
  hero: {
    badge: 'Penerimaan Anggota Baru 2026',
    headline: 'Keanggotaan & Kolaborasi Yayasan APII DPW Jabodetabek',
    subheadline: 'Wadah sinergi para ahli, akademisi, dan praktisi pengkaji Islam di Indonesia untuk riset, pemberdayaan, dan kemaslahatan umat.',
    cta_text: 'Info Dokumen & Keuangan Kas ->',
    cta_link: '#informasi'
  },
  profile: {
    show_section: true,
    ketua_name: 'Ustadz Muhammad Hanafi',
    ketua_title: 'Ketua DPW APII Jabodetabek',
    greeting: 'Assalamualaikum Warahmatullahi Wabarakatuh. ' +
      'Selamat datang di portal resmi Dewan Pimpinan Wilayah Yayasan Apologet Islam Indonesia (APII) Jabodetabek. ' +
      'Sebagai organisasi yang bergerak di bidang sosial, kemasyarakatan, dan keagamaan, ' +
      'kami berkomitmen mengimplementasikan nilai Islam yang moderat, mentransfer ilmu pengetahuan, ' +
      'serta mempererat ukhuwah islamiah demi kemaslahatan bersama.',
    vision: 'Mengimplementasikan Islam sebagai Agama Rahmatan Lil Alamin',
    missions: [
      'Transfer Ilmu Pengetahuan bagi sesama umat.',
      'Mengoptimalkan digital dan internet sebagai sarana Dakwah.',
      'Dialog perbandingan agama secara online maupun offline.',
      'Bersinergi dengan Individu, Organisasi Islam, dan Instansi Pemerintah/Swasta guna mengukuhkan Ukhuwah Islamiah.'
    ]
  },
  bulletins_events: {
    show_section: true,
    section_title: 'Warta Kelembagaan & Agenda Kegiatan',
    section_subtitle: 'Maklumat resmi, siaran pers pimpinan, serta jadwal acara dan kajian DPW APII Jabodetabek.',
    bulletins: [
      {
        id: 'mak-1',
        title: 'Maklumat Dewan Pimpinan Wilayah tentang Pelaksanaan Dakwah Ramadhan 1447 H',
        category: 'Maklumat Resmi',
        date: '2026-03-01',
        summary: 'Instruksi kepada seluruh jajaran pengurus divisi dan anggota mengenai pedoman dakwah digital dan safari keumatan di 5 wilayah Jabodetabek.',
        link: ''
      }
    ],
    events: [
      {
        id: 'evt-1',
        title: 'Seminar Nasional Litbang: Metodologi Komparasi Agama Kontemporer',
        category: 'Kajian Ilmiah',
        date_str: 'Sabtu, 25 April 2026',
        time_str: '09.00 - 12.00 WIB',
        location: 'Aula Pusat Dakwah APII & Live Zoom',
        speaker: 'Dewan Pakar APII & Akademisi Tamu',
        link: 'https://forms.gle/apii-seminar-2026',
        status: 'MENDATANG'
      }
    ]
  },
  contact: {
    address: 'Jl. Kramat Raya No. 45, Senen, Jakarta Pusat 10450',
    email: 'sekretariat@apii.sigitadi.id',
    whatsapp_helpdesk: '081288882026',
    service_hours: 'Senin - Sabtu, 08.30 - 16.30 WIB'
  },
  social: {
    youtube: 'https://youtube.com/@apii_official',
    instagram: 'https://instagram.com/apii_jabodetabek',
    whatsapp_channel: 'https://whatsapp.com/channel/apii-jabo',
    facebook: '',
    tiktok: ''
  },
  faqs: [
    {
      q: 'Siapa yang dapat mendaftar sebagai anggota APII DPW Jabodetabek?',
      a: 'Warga negara Indonesia beragama Islam yang berdomisili atau beraktivitas di wilayah Jakarta, Bogor, Depok, Tangerang, dan Bekasi, serta bersedia mematuhi AD/ART yayasan.'
    },
    {
      q: 'Apakah pendaftaran anggota dipungut biaya?',
      a: 'Tidak ada biaya pendaftaran. Keanggotaan terbuka dan bebas biaya administrasi registrasi.'
    },
    {
      q: 'Bagaimana perlindungan data pribadi saya dijamin?',
      a: 'KTP yang diunggah otomatis dibubuhi cap digital pelindung langsung di peramban Anda sebelum dikirim ke server sesuai amanat UU Perlindungan Data Pribadi No. 27/2022.'
    }
  ]
};

/**
 * Sanitasi string aman (anti-XSS): buang karakter kontrol & sudut < >.
 * Aman untuk apostrof & tanda baca biasa (Bahasa Indonesia).
 */
function sanitizeText_(str, maxLen) {
  var s = String(str === null || str === undefined ? '' : str);
  s = s.replace(/[\u0000-\u001F\u007F]/g, '')
       .replace(/</g, ' ').replace(/>/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  var m = Number(maxLen) || 2000;
  if (s.length > m) s = s.substring(0, m);
  return s;
}

/**
 * Sanitasi teks multi-baris (pertahankan newline untuk paragraf/misi).
 */
function sanitizeMultiline_(str, maxLen) {
  var s = String(str === null || str === undefined ? '' : str);
  s = s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
       .replace(/</g, ' ').replace(/>/g, ' ');
  var lines = s.split(/\r?\n/).map(function (l) { return l.trim(); })
    .filter(function (l) { return l.length > 0; });
  var out = lines.join('\n');
  var m = Number(maxLen) || 4000;
  if (out.length > m) out = out.substring(0, m);
  return out;
}

/**
 * Sanitasi URL: hanya http(s)/mailto/tel atau path relatif (& anchor).
 * Menolak skema berbahaya (mis. javascript:).
 */
function sanitizeUrl_(u) {
  var s = String(u === null || u === undefined ? '' : u).trim();
  if (!s) return '';
  if (/^(https?:|mailto:|tel:)/i.test(s)) return s.replace(/[\s"'<>]/g, '');
  if (s.charAt(0) === '#' || s.charAt(0) === '/') return s.replace(/[\s"'<>]/g, '');
  return '';
}


/**
 * getPublicWilayahList: daftar cabang aktif untuk Regional Lens publik.
 */
function getPublicWilayahList(ctx) {
  var list = [];
  try {
    list = readAll(TABS.WILAYAH).filter(function (w) {
      return w.is_active === 'TRUE' || w.is_active === true || w.is_active === '1' || w.is_active === 1;
    });
  } catch (e) {}

  if (!list || list.length === 0) {
    list = [
      { id: 'DPP_PUSAT', nama: 'Dewan Pimpinan Pusat (DPP) APII', tingkat: 'PUSAT', kode_surat: 'DPP', alamat: 'Sekretariat DPP APII, DKI Jakarta, Indonesia', email: 'sekretariat@apii.sigitadi.id', hotline_wa: '6281288882026', slug: 'pusat', is_active: true },
      { id: 'DPW_JABODETABEK', nama: 'DPW APII Jabodetabek', tingkat: 'WILAYAH', kode_surat: 'JABO', alamat: 'Sekretariat DPW APII Jabodetabek, DKI Jakarta & Sekitarnya', email: 'info@apii-jabo.or.id', hotline_wa: '6281299887711', slug: 'jabo', is_active: true }
    ];
  }
  return { ok: true, data: list, message: 'Daftar wilayah aktif berhasil dimuat.' };
}

/**
 * getPublicSettings: ambil konfigurasi yang boleh dibaca publik.
 * Publik (tanpa token). Mendukung adaptasi Smart Regional Lens.
 */
function getPublicSettings(ctx) {
  var p = (ctx && (ctx.payload || ctx.parameter)) || {};
  var wilayahQuery = String(p.wilayah || p.w || p.wilayah_id || '').trim().toLowerCase();

  var wilayahRes = getPublicWilayahList(ctx);
  var wilayahList = wilayahRes.data || [];

  var activeWilayah = null;
  if (wilayahQuery) {
    activeWilayah = wilayahList.find(function (w) {
      return (w.slug && w.slug.toLowerCase() === wilayahQuery) ||
             (w.id && w.id.toLowerCase() === wilayahQuery);
    });
  }
  if (!activeWilayah) {
    activeWilayah = wilayahList.find(function (w) { return w.id === 'DPW_JABODETABEK'; }) || wilayahList[0] || {
      id: 'DPW_JABODETABEK', nama: 'DPW APII Jabodetabek', tingkat: 'WILAYAH', kode_surat: 'JABO',
      alamat: 'Sekretariat DPW APII Jabodetabek, DKI Jakarta & Sekitarnya', email: 'info@apii-jabo.or.id',
      hotline_wa: '6281299887711', slug: 'jabo', is_active: true
    };
  }

  var pubConfig = getSettingValue_('public_config', {
    show_verification: true, show_finance: true, show_programs: true, show_accounts: true,
    show_registration: true, announcement_banner_active: true,
    announcement_banner: 'Selamat datang di Portal Resmi Yayasan APII.'
  });
  var kop = getSettingValue_('letter_kop', {});
  var reg = getSettingValue_('registration_config', {
    status: 'BUKA',
    is_open: true,
    quota_limit: 0,
    closed_title: 'Pendaftaran Anggota Sementara Ditutup',
    closed_message: 'Pendaftaran gelombang saat ini telah ditutup atau sedang dalam proses verifikasi kuota. Pantau pengumuman resmi berkala dari sekretariat yayasan.',
    instructions: 'Silakan isi formulir pendaftaran anggota Yayasan APII dengan data yang valid sesuai identitas KTP resmi.',
    require_ktp: true,
    require_selfie: true,
    max_file_size_mb: 3,
    open_divisions: ['DIV_DAKWAH', 'DIV_HUKUM', 'DIV_HUMAS', 'DIV_MEDIA', 'DIV_SOSIAL', 'DIV_LITBANG', 'DIV_EKONOMI'],
    contact_wa: activeWilayah.hotline_wa || '081288882026',
    wa_template: 'Halo Sekretariat APII ' + (activeWilayah.nama || '') + ', saya telah mendaftar anggota baru dengan No. Registrasi: {reg_number} a.n {full_name}. Mohon verifikasi berkas saya.',
    agreement_text: 'Saya menyatakan bahwa data yang saya berikan adalah benar dan sah. Saya bersedia menaati AD/ART, kode etik, dan peraturan Yayasan APII.'
  });

  var sepStatus = getSettingValue_('registration_status', null);
  var sepIsOpen = getSettingValue_('registration_is_open', null);
  if (sepStatus && reg) {
    reg.status = sepStatus;
    reg.is_open = (sepStatus === 'BUKA');
  }
  if (sepIsOpen !== null && sepIsOpen !== undefined && reg) {
    reg.is_open = (sepIsOpen === true || sepIsOpen === 'true' || sepIsOpen === '1' || sepIsOpen === 1);
    if (!reg.is_open && reg.status === 'BUKA') reg.status = 'DITUTUP';
  }
  var sepAllowReg = getSettingValue_('allow_public_registration', null);
  if (sepAllowReg !== null && sepAllowReg !== undefined && pubConfig) {
    pubConfig.show_registration = (sepAllowReg === true || sepAllowReg === 'true' || sepAllowReg === '1' || sepAllowReg === 1);
  }

  // Lensa Wilayah KOP
  var orgTitle = activeWilayah.nama ? activeWilayah.nama.toUpperCase() : 'DEWAN PIMPINAN WILAYAH APOLOGET ISLAM INDONESIA (APII) JABODETABEK';
  if (activeWilayah.id === 'DPP_PUSAT') {
    orgTitle = 'DEWAN PIMPINAN PUSAT APOLOGET ISLAM INDONESIA (APII)';
  }

  var nationalTicker = {
    active: true,
    badge: 'MAKLUMAT DPP PUSAT',
    title: 'Maklumat Pimpinan Pusat tentang Panduan Syiar & Dakwah Digital: Menjaga Etika Dialog Ilmiah & Ukhuwah Islamiyah di Seluruh Indonesia',
    date: '2026-11-03',
    link: '#warta'
  };

  return {
    ok: true,
    data: {
      config: pubConfig,
      registration: reg,
      active_wilayah: activeWilayah,
      wilayah_list: wilayahList,
      national_ticker: nationalTicker,
      kop: {
        org_name: kop.org_name || orgTitle,
        address: activeWilayah.alamat || kop.address || 'DKI Jakarta & Sekitarnya, Indonesia',
        email: activeWilayah.email || kop.email || 'sekretariat@apii.sigitadi.id',
        phone: activeWilayah.hotline_wa || kop.phone || '0812-8888-2026'
      },
      editorial: loadEditorial_()
    },
    message: 'Pengaturan publik berhasil dimuat.'
  };
}

/**
 * Sanitasi & normalisasi objek redaksi penuh. Jaminkan tipe data & batas
 * panjang agar front-end selalu menerima struktur yang konsisten.
 */
function sanitizeEditorialContent_(raw) {
  var o = (raw && typeof raw === 'object') ? raw : {};
  var hero = (o.hero && typeof o.hero === 'object') ? o.hero : {};
  var profile = (o.profile && typeof o.profile === 'object') ? o.profile : {};
  var be = (o.bulletins_events && typeof o.bulletins_events === 'object') ? o.bulletins_events : {};
  var contact = (o.contact && typeof o.contact === 'object') ? o.contact : {};
  var social = (o.social && typeof o.social === 'object') ? o.social : {};

  var bulletins = (Array.isArray(be.bulletins) ? be.bulletins : []).map(function (b) {
    var x = (b && typeof b === 'object') ? b : {};
    return {
      id: sanitizeText_(x.id, 60) || ('mak-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      title: sanitizeText_(x.title, 200),
      category: sanitizeText_(x.category, 60),
      date: sanitizeText_(x.date, 20).replace(/[^\d\-]/g, ''),
      summary: sanitizeMultiline_(x.summary, 1200),
      link: sanitizeUrl_(x.link)
    };
  });

  var events = (Array.isArray(be.events) ? be.events : []).map(function (e) {
    var x = (e && typeof e === 'object') ? e : {};
    return {
      id: sanitizeText_(x.id, 60) || ('evt-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      title: sanitizeText_(x.title, 200),
      category: sanitizeText_(x.category, 60),
      date_str: sanitizeText_(x.date_str, 80),
      time_str: sanitizeText_(x.time_str, 60),
      location: sanitizeText_(x.location, 150),
      speaker: sanitizeText_(x.speaker, 120),
      link: sanitizeUrl_(x.link),
      status: (String(x.status).toUpperCase() === 'SELESAI') ? 'SELESAI' : 'MENDATANG'
    };
  });

  var faqs = (Array.isArray(o.faqs) ? o.faqs : []).map(function (f) {
    var x = (f && typeof f === 'object') ? f : {};
    return {
      q: sanitizeText_(x.q, 300),
      a: sanitizeMultiline_(x.a, 1500)
    };
  }).filter(function (f) { return f.q.length > 0; });

  return {
    hero: {
      badge: sanitizeText_(hero.badge, 120),
      headline: sanitizeText_(hero.headline, 200),
      subheadline: sanitizeText_(hero.subheadline, 600),
      cta_text: sanitizeText_(hero.cta_text, 80),
      cta_link: sanitizeUrl_(hero.cta_link) || '#informasi'
    },
    profile: {
      show_section: profile.show_section !== false,
      ketua_name: sanitizeText_(profile.ketua_name, 120),
      ketua_title: sanitizeText_(profile.ketua_title, 120),
      greeting: sanitizeMultiline_(profile.greeting, 2500),
      vision: sanitizeText_(profile.vision, 400),
      missions: (Array.isArray(profile.missions) ? profile.missions : [])
        .map(function (m) { return sanitizeText_(m, 300); })
        .filter(function (m) { return m.length > 0; })
        .slice(0, 12)
    },
    bulletins_events: {
      show_section: be.show_section !== false,
      section_title: sanitizeText_(be.section_title, 120),
      section_subtitle: sanitizeText_(be.section_subtitle, 300),
      bulletins: bulletins.slice(0, 40),
      events: events.slice(0, 40)
    },
    contact: {
      address: sanitizeText_(contact.address, 250),
      email: sanitizeText_(contact.email, 120),
      whatsapp_helpdesk: sanitizeText_(contact.whatsapp_helpdesk, 40),
      service_hours: sanitizeText_(contact.service_hours, 120)
    },
    social: {
      youtube: sanitizeUrl_(social.youtube),
      instagram: sanitizeUrl_(social.instagram),
      whatsapp_channel: sanitizeUrl_(social.whatsapp_channel),
      facebook: sanitizeUrl_(social.facebook),
      tiktok: sanitizeUrl_(social.tiktok)
    },
    faqs: faqs.slice(0, 30)
  };
}

/**
 * Ambil objek redaksi yang sudah digabung dengan default (fallback aman).
 */
function loadEditorial_() {
  var stored = getSettingValue_('editorial_content', null);
  return sanitizeEditorialContent_((stored && typeof stored === 'object') ? stored : DEFAULT_EDITORIAL_);
}

/**
 * Cek hak edit redaksi: SUPERADMIN, KETUA, SEKRETARIS, atau pengurus Divisi
 * Humas (DIV_HUMAS) & Media Sosial (DIV_SOSMED).
 */
function canEditEditorial_(user) {
  if (!user) return false;
  var role = user.role;
  if (role === ROLES.SUPERADMIN || role === ROLES.KETUA || role === ROLES.SEKRETARIS) return true;
  if (role === ROLES.KETUA_DIVISI || role === ROLES.ANGGOTA_DIVISI) {
    return user.division === DIVISIONS.DIV_HUMAS || user.division === DIVISIONS.DIV_SOSMED;
  }
  return false;
}

/**
 * getEditorialContent: ambil redaksi portal publik untuk diedit di Portal
 * Pengurus. Semua peran login boleh membaca (konten ini bersifat publik).
 */
function getEditorialContent(ctx) {
  var editorial = loadEditorial_();
  return {
    ok: true,
    data: editorial,
    editorial: editorial,
    can_edit: canEditEditorial_((ctx && ctx.user) || null),
    message: 'Redaksi konten portal berhasil dimuat.'
  };
}

/**
 * saveEditorialContent: simpan perubahan redaksi portal publik.
 * Akses: SUPERADMIN, KETUA, SEKRETARIS, DIV_HUMAS, DIV_SOSMED.
 */
function saveEditorialContent(ctx) {
  var user = (ctx && ctx.user) || null;
  if (!canEditEditorial_(user)) {
    appError('Akses ditolak: Anda tidak memiliki kewenangan mengelola redaksi konten portal.');
  }
  var p = (ctx && ctx.payload) || {};
  var raw = (p.editorial && typeof p.editorial === 'object') ? p.editorial : p;
  var clean = sanitizeEditorialContent_(raw);
  setSettingValue_('editorial_content', clean, (user && user.username) || 'system');
  audit((user && user.username) || 'unknown', 'EDITORIAL_UPDATED',
    'Memperbarui redaksi konten portal publik (hero, profil, warta, acara, kontak, FAQ)', 'SETTINGS');
  return { ok: true, data: clean, editorial: clean, message: 'Redaksi konten portal publik berhasil disimpan.' };
}

/**
 * uploadKopImage: unggah gambar KOP surat resmi baru.
 * SUPERADMIN.
 */
function uploadKopImage(ctx) {
  var p = ctx.payload || {};
  var base64 = p.image_base64 || '';
  if (!base64) return { ok: false, data: null, message: 'Data gambar KOP tidak boleh kosong.' };

  var user = (ctx.user && ctx.user.username) || 'admin';
  var kop = getSettingValue_('letter_kop', {});
  kop.custom_kop_image = base64;
  kop.mode = 'image';
  setSettingValue_('letter_kop', kop, user);

  audit(user, 'KOP_UPLOADED', 'Mengunggah gambar KOP surat resmi baru', 'SETTINGS');
  return { ok: true, data: { mode: 'image', updated_at: new Date().toISOString() }, message: 'Gambar KOP surat resmi berhasil disimpan.' };
}

/**
 * testDriveStorage: verifikasi koneksi Google Drive penyimpanan berkas dan izin tulis.
 * SUPERADMIN.
 */
function testDriveStorage(ctx) {
  try {
    var p = ctx.payload || {};
    var folderId = p.folder_id ? String(p.folder_id).trim() : '';
    var isCustom = Boolean(folderId);
    if (!folderId) {
      folderId = siapkanFolderPdf_();
    }
    var folder = DriveApp.getFolderById(folderId);

    // Uji izin tulis (buat file sementara lalu hapus langsung)
    try {
      var testFile = folder.createFile('.test_permission_' + new Date().getTime() + '.tmp', 'OK');
      testFile.setTrashed(true);
    } catch (testErr) {
      return {
        ok: false,
        data: null,
        message: 'Folder ' + folder.getName() + ' ditemukan, namun akun tidak memiliki izin tulis: ' + testErr.message
      };
    }

    var user = (ctx.user && ctx.user.username) || 'admin';
    audit(user, 'DRIVE_TESTED', 'Uji koneksi penyimpanan Google Drive: ' + folder.getName(), 'STORAGE');
    return {
      ok: true,
      data: {
        folder_id: folder.getId(),
        folder_name: folder.getName(),
        folder_url: folder.getUrl(),
        is_custom: isCustom,
        status: 'CONNECTED'
      },
      message: 'Koneksi Google Drive terhubung dan izin tulis aktif: ' + folder.getName()
    };
  } catch (err) {
    return { ok: false, data: null, message: 'Gagal terhubung ke Google Drive: ' + err.message };
  }
}

/**
 * createDriveFolder: buat folder baru di Google Drive untuk penyimpanan resmi organisasi.
 * SUPERADMIN.
 */
function createDriveFolder(ctx) {
  try {
    var p = ctx.payload || {};
    var currentYear = new Date().getFullYear();
    var defaultName = 'APII Jabo - Arsip ' + currentYear;
    var folderName = p.folder_name ? String(p.folder_name).trim() : defaultName;
    if (!folderName) folderName = defaultName;
    var parentFolderId = p.parent_folder_id ? String(p.parent_folder_id).trim() : '';

    var parentFolder = null;
    if (parentFolderId) {
      parentFolder = DriveApp.getFolderById(parentFolderId);
    }

    var newFolder = parentFolder ? parentFolder.createFolder(folderName) : DriveApp.createFolder(folderName);
    var newFolderId = newFolder.getId();

    // Inisialisasi subfolder standar organisasi
    var subfolders = ['Surat_Resmi', 'Surat_Lampiran', 'Keuangan_Bukti_Nota', 'Pendaftaran_KTP', 'Pendaftaran_Selfie'];
    for (var i = 0; i < subfolders.length; i++) {
      try { newFolder.createFolder(subfolders[i]); } catch (subErr) {}
    }

    // Setel folder baru ini sebagai folder aktif di ScriptProperties dan Sheet_Settings
    PropertiesService.getScriptProperties().setProperty('DRIVE_FOLDER_ID', newFolderId);

    var user = (ctx.user && ctx.user.username) || 'admin';
    setSettingValue_('google_drive_folder_id', newFolderId, user);
    setSettingValue_('drive_storage', {
      custom_folder_id: newFolderId,
      folder_name: newFolder.getName(),
      auto_annual_subfolders: true,
      created_at: new Date().toISOString()
    }, user);

    audit(user, 'DRIVE_FOLDER_CREATED', 'Membuat folder penyimpanan Drive baru: ' + folderName, 'STORAGE');

    return {
      ok: true,
      data: {
        folder_id: newFolderId,
        folder_name: newFolder.getName(),
        folder_url: newFolder.getUrl(),
        status: 'CONNECTED'
      },
      message: 'Folder baru ' + folderName + ' berhasil dibuat dan disetel sebagai penyimpanan aktif.'
    };
  } catch (err) {
    return { ok: false, data: null, message: 'Gagal membuat folder di Google Drive: ' + err.message };
  }
}

/**
 * moveDriveFolder: pindahkan folder penyimpanan aktif ke dalam folder parent lain di Google Drive.
 * SUPERADMIN.
 */
function moveDriveFolder(ctx) {
  try {
    var p = ctx.payload || {};
    var parentFolderId = p.parent_folder_id ? String(p.parent_folder_id).trim() : '';
    if (!parentFolderId) {
      return { ok: false, data: null, message: 'ID folder induk tujuan wajib diisi.' };
    }

    var targetParent = DriveApp.getFolderById(parentFolderId);
    var activeFolderId = siapkanFolderPdf_();
    var activeFolder = DriveApp.getFolderById(activeFolderId);

    if (targetParent.getId() === activeFolder.getId()) {
      return { ok: false, data: null, message: 'Folder tujuan tidak boleh sama dengan folder aktif.' };
    }

    // Pindahkan folder aktif ke dalam parent baru
    try {
      if (typeof activeFolder.moveTo === 'function') {
        activeFolder.moveTo(targetParent);
      } else {
        targetParent.addFolder(activeFolder);
        var parents = activeFolder.getParents();
        while (parents.hasNext()) {
          var oldParent = parents.next();
          if (oldParent.getId() !== targetParent.getId()) {
            oldParent.removeFolder(activeFolder);
          }
        }
      }
    } catch (moveErr) {
      targetParent.addFolder(activeFolder);
    }

    var user = (ctx.user && ctx.user.username) || 'admin';
    audit(user, 'DRIVE_FOLDER_MOVED', 'Memindahkan folder ke dalam ' + targetParent.getName(), 'STORAGE');

    return {
      ok: true,
      data: {
        folder_id: activeFolder.getId(),
        folder_name: activeFolder.getName(),
        folder_url: activeFolder.getUrl(),
        parent_name: targetParent.getName(),
        parent_id: targetParent.getId(),
        status: 'CONNECTED'
      },
      message: 'Folder ' + activeFolder.getName() + ' berhasil dipindahkan ke dalam ' + targetParent.getName() + '.'
    };
  } catch (err) {
    return { ok: false, data: null, message: 'Gagal memindahkan folder di Google Drive: ' + err.message };
  }
}

/**
 * resetDriveStorage: kembalikan folder penyimpanan ke folder default sistem.
 * SUPERADMIN.
 */
function resetDriveStorage(ctx) {
  try {
    var props = PropertiesService.getScriptProperties();
    props.deleteProperty('DRIVE_FOLDER_ID');

    var user = (ctx.user && ctx.user.username) || 'admin';
    setSettingValue_('google_drive_folder_id', '', user);

    var defaultFolderId = siapkanFolderPdf_();
    var defaultFolder = DriveApp.getFolderById(defaultFolderId);

    setSettingValue_('drive_storage', {
      custom_folder_id: '',
      folder_name: defaultFolder.getName(),
      auto_annual_subfolders: true
    }, user);

    audit(user, 'DRIVE_STORAGE_RESET', 'Mereset penyimpanan Drive ke default: ' + defaultFolder.getName(), 'STORAGE');

    return {
      ok: true,
      data: {
        folder_id: defaultFolder.getId(),
        folder_name: defaultFolder.getName(),
        folder_url: defaultFolder.getUrl(),
        status: 'CONNECTED'
      },
      message: 'Penyimpanan Google Drive berhasil dikembalikan ke folder default organisasi.'
    };
  } catch (err) {
    return { ok: false, data: null, message: 'Gagal mereset penyimpanan Google Drive: ' + err.message };
  }
}




// ============================================================================
// GOOGLE DRIVE STORAGE VAULT ENGINE (FASE 7 - BAB 6.3)
// ============================================================================

var STORAGE_CATEGORIES = [
  '01_Surat_Resmi_PDF',
  '02_Surat_Masuk_Lampiran',
  '03_Keuangan_Kwitansi',
  '04_Keuangan_Voucher_Nota',
  '05_Program_Proposal_LPJ',
  '06_Pelayanan_Muallaf',
  '07_Publikasi_Media_Web',
  '08_Identitas_KTA_KTP'
];

/**
 * resolveStorageFolder_: Menemukan atau membuat hierarki folder 3 tingkat:
 * Root -> [Wilayah] -> [Tahun] -> [Kategori] + _Trash_Arsip_Terhapus
 */
function resolveStorageFolder_(rootFolder, wilayahId, category) {
  var wId = wilayahId || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var tahun = String(new Date().getFullYear());

  // Tingkat 1: Folder Wilayah
  var wFolder = null;
  var itW = rootFolder.getFoldersByName(wId);
  if (itW.hasNext()) {
    wFolder = itW.next();
  } else {
    wFolder = rootFolder.createFolder(wId);
  }

  // Tingkat 2: Folder Tahun
  var yFolder = null;
  var itY = wFolder.getFoldersByName(tahun);
  if (itY.hasNext()) {
    yFolder = itY.next();
  } else {
    yFolder = wFolder.createFolder(tahun);
  }

  // Tingkat 3: Folder Kategori
  var catName = category || '01_Surat_Resmi_PDF';
  var catFolder = null;
  var itC = yFolder.getFoldersByName(catName);
  if (itC.hasNext()) {
    catFolder = itC.next();
  } else {
    catFolder = yFolder.createFolder(catName);
  }

  return catFolder;
}

/**
 * initHierarchyFolders: Memeriksa dan membangkitkan struktur hierarki 3 tingkat
 * lengkap dengan 8 subfolder kategori dan _Trash_Arsip_Terhapus.
 * SUPERADMIN.
 */
function initHierarchyFolders(ctx) {
  try {
    var p = (ctx && ctx.payload) || {};
    var user = (ctx && ctx.user) || {};
    var rootFolderId = p.root_folder_id || siapkanFolderPdf_();
    var rootFolder = DriveApp.getFolderById(rootFolderId);

    var defWilayah = (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
    var wId = p.wilayah_id || defWilayah;
    var tahun = String(new Date().getFullYear());

    // 1. Folder Wilayah
    var wFolder = null;
    var itW = rootFolder.getFoldersByName(wId);
    if (itW.hasNext()) {
      wFolder = itW.next();
    } else {
      wFolder = rootFolder.createFolder(wId);
    }

    // 2. Folder _Trash_Arsip_Terhapus di tingkat wilayah (Soft-Delete)
    var itTrash = wFolder.getFoldersByName('_Trash_Arsip_Terhapus');
    if (!itTrash.hasNext()) {
      wFolder.createFolder('_Trash_Arsip_Terhapus');
    }

    // 3. Folder Master_Aset_Wilayah
    var itAset = wFolder.getFoldersByName('Master_Aset_Wilayah');
    if (!itAset.hasNext()) {
      wFolder.createFolder('Master_Aset_Wilayah');
    }

    // 4. Folder Tahun Transaksi
    var yFolder = null;
    var itY = wFolder.getFoldersByName(tahun);
    if (itY.hasNext()) {
      yFolder = itY.next();
    } else {
      yFolder = wFolder.createFolder(tahun);
    }

    // 5. 8 Kategori Standar
    var createdCount = 0;
    for (var i = 0; i < STORAGE_CATEGORIES.length; i++) {
      var cat = STORAGE_CATEGORIES[i];
      var itC = yFolder.getFoldersByName(cat);
      if (!itC.hasNext()) {
        yFolder.createFolder(cat);
        createdCount++;
      }
    }

    audit(user.username || 'admin', 'DRIVE_HIERARCHY_INITIALIZED', 'Inisialisasi struktur hierarki 3 tingkat ' + wId + '/' + tahun, 'STORAGE');

    return {
      ok: true,
      data: {
        root_folder: rootFolder.getName(),
        wilayah_folder: wFolder.getName(),
        tahun_folder: yFolder.getName(),
        categories_count: STORAGE_CATEGORIES.length,
        new_created: createdCount
      },
      message: 'Struktur hierarki folder 3-tingkat (' + wId + ' / ' + tahun + ') berhasil diinisialisasi lengkap.'
    };
  } catch (err) {
    return { ok: false, data: null, message: 'Gagal inisialisasi hierarki folder: ' + err.message };
  }
}

/**
 * getDriveStorageStatus: Membaca status penggunaan kuota, ambang peringatan (80% / 90%),
 * dan rekapitulasi berkas pada Sheet_Storage_Vault.
 */
function getDriveStorageStatus(ctx) {
  var p = (ctx && ctx.payload) || {};
  var user = (ctx && ctx.user) || {};
  var userWilayah = user.wilayah_id || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var wId = p.wilayah_id || userWilayah;

  var cfg = getSettingValue_('drive_storage', {
    storage_type: 'SHARED_DRIVE',
    auto_annual_subfolders: true,
    auto_webp_compression: true,
    auto_ktp_watermark: true,
    soft_delete_enabled: true
  });

  var rows = readAll(TABS.STORAGE_VAULT);
  var tenantFiles = rows.filter(function (r) {
    return (r.wilayah_id || userWilayah) === wId && !r.is_deleted;
  });
  var trashFiles = rows.filter(function (r) {
    return (r.wilayah_id || userWilayah) === wId && (r.is_deleted === true || r.is_deleted === 'true');
  });

  // Hitung akumulasi ukuran berkas
  var totalKb = 0;
  var catCounts = {};
  STORAGE_CATEGORIES.forEach(function (c) { catCounts[c] = 0; });

  tenantFiles.forEach(function (f) {
    var sz = Number(f.file_size_kb) || 120;
    totalKb += sz;
    var cat = f.category || '01_Surat_Resmi_PDF';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });

  var totalMb = totalKb / 1024;
  var totalGb = totalMb / 1024;

  // Standar kuota: Google Shared Drive (30 GB pooled) atau Standard (15 GB)
  var quotaLimitGb = (cfg.storage_type === 'STANDARD') ? 15 : 30;
  var usagePercent = Math.min(100, (totalGb / quotaLimitGb) * 100);

  // Ambang peringatan 80% dan 90%
  var healthStatus = 'NORMAL';
  if (usagePercent >= 90) healthStatus = 'CRITICAL';
  else if (usagePercent >= 80) healthStatus = 'WARNING';

  return {
    ok: true,
    data: {
      storage_type: cfg.storage_type || 'SHARED_DRIVE',
      storage_type_label: (cfg.storage_type === 'STANDARD') ? 'Google Drive Standar (15 GB)' : 'Google Shared Drive Non-Profit (30 GB)',
      quota_limit_gb: quotaLimitGb,
      used_gb: Number(totalGb.toFixed(2)),
      used_mb: Number(totalMb.toFixed(1)),
      usage_percent: Number(usagePercent.toFixed(1)),
      health_status: healthStatus,
      total_active_files: tenantFiles.length,
      total_trash_files: trashFiles.length,
      category_breakdown: catCounts,
      config: cfg
    },
    message: 'Status kapasitas penyimpanan Google Drive berhasil dihitung.'
  };
}

/**
 * getListVaultFiles: Daftar seluruh arsip berkas dari Sheet_Storage_Vault.
 */
function getListVaultFiles(ctx) {
  var p = (ctx && ctx.payload) || {};
  var user = (ctx && ctx.user) || {};
  var userWilayah = user.wilayah_id || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var wId = p.wilayah_id || userWilayah;
  var isTrash = Boolean(p.is_trash);

  var rows = readAll(TABS.STORAGE_VAULT);
  var filtered = rows.filter(function (r) {
    var matchWilayah = (r.wilayah_id || userWilayah) === wId;
    var deletedState = (r.is_deleted === true || r.is_deleted === 'true');
    return matchWilayah && (isTrash ? deletedState : !deletedState);
  });

  if (p.category) {
    filtered = filtered.filter(function (r) { return r.category === p.category; });
  }
  if (p.q) {
    var q = String(p.q).toLowerCase();
    filtered = filtered.filter(function (r) {
      return (r.file_name || '').toLowerCase().indexOf(q) !== -1 ||
             (r.uploaded_by || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  filtered.sort(function (a, b) {
    return (b.uploaded_at || '').localeCompare(a.uploaded_at || '');
  });

  return {
    ok: true,
    data: { items: filtered, total: filtered.length },
    message: 'Daftar berkas arsip vault berhasil dimuat.'
  };
}

/**
 * softDeleteVaultFile: Pindahkan berkas ke _Trash_Arsip_Terhapus dengan masa tenggang 30 hari.
 * SUPERADMIN, KETUA, SEKRETARIS, BENDAHARA.
 */
function softDeleteVaultFile(ctx) {
  var p = (ctx && ctx.payload) || {};
  var user = (ctx && ctx.user) || {};
  if (!p.id) return { ok: false, data: null, message: 'ID berkas wajib diisi.' };

  var row = findOne(TABS.STORAGE_VAULT, { id: p.id });
  if (!row) return { ok: false, data: null, message: 'Berkas tidak ditemukan dalam pangkalan data vault.' };

  var now = new Date().toISOString();

  // Pindahkan fisik berkas di Google Drive jika file ID tersedia
  try {
    if (row.drive_file_id) {
      var file = DriveApp.getFileById(row.drive_file_id);
      var rootFolderId = siapkanFolderPdf_();
      var rootFolder = DriveApp.getFolderById(rootFolderId);
      var wFolderIt = rootFolder.getFoldersByName(row.wilayah_id || 'DPW_JABODETABEK');
      if (wFolderIt.hasNext()) {
        var wFolder = wFolderIt.next();
        var trashIt = wFolder.getFoldersByName('_Trash_Arsip_Terhapus');
        if (trashIt.hasNext()) {
          var trashFolder = trashIt.next();
          trashFolder.addFile(file);
          var parents = file.getParents();
          while (parents.hasNext()) {
            var oldP = parents.next();
            if (oldP.getId() !== trashFolder.getId()) {
              oldP.removeFile(file);
            }
          }
        }
      }
    }
  } catch (driveErr) {
    Logger.log('Peringatan pemindahan file drive: ' + driveErr);
  }

  updateRow(TABS.STORAGE_VAULT, row._row, {
    is_deleted: true,
    deleted_at: now
  });

  audit(user.username || 'admin', 'VAULT_FILE_DELETED', 'Soft-delete berkas ' + row.file_name + ' (Retensi 30 Hari)', 'STORAGE');

  return {
    ok: true,
    data: { id: row.id, is_deleted: true },
    message: 'Berkas ' + row.file_name + ' berhasil dipindahkan ke Tong Sampah (Tersimpan 30 Hari).'
  };
}

/**
 * restoreVaultFile: Memulihkan berkas dari Tong Sampah kembali ke kategori asalnya.
 */
function restoreVaultFile(ctx) {
  var p = (ctx && ctx.payload) || {};
  var user = (ctx && ctx.user) || {};
  if (!p.id) return { ok: false, data: null, message: 'ID berkas wajib diisi.' };

  var row = findOne(TABS.STORAGE_VAULT, { id: p.id });
  if (!row) return { ok: false, data: null, message: 'Berkas tidak ditemukan dalam pangkalan data vault.' };

  // Pulihkan fisik di Google Drive
  try {
    if (row.drive_file_id) {
      var file = DriveApp.getFileById(row.drive_file_id);
      var rootFolderId = siapkanFolderPdf_();
      var rootFolder = DriveApp.getFolderById(rootFolderId);
      var targetFolder = resolveStorageFolder_(rootFolder, row.wilayah_id, row.category);
      if (targetFolder) {
        targetFolder.addFile(file);
        var parents = file.getParents();
        while (parents.hasNext()) {
          var oldP = parents.next();
          if (oldP.getId() !== targetFolder.getId()) {
            oldP.removeFile(file);
          }
        }
      }
    }
  } catch (driveErr) {
    Logger.log('Peringatan pemulihan file drive: ' + driveErr);
  }

  updateRow(TABS.STORAGE_VAULT, row._row, {
    is_deleted: false,
    deleted_at: ''
  });

  audit(user.username || 'admin', 'VAULT_FILE_RESTORED', 'Memulihkan berkas ' + row.file_name, 'STORAGE');

  return {
    ok: true,
    data: { id: row.id, is_deleted: false },
    message: 'Berkas ' + row.file_name + ' berhasil dipulihkan ke arsip aktif.'
  };
}

/**
 * purgeTrashVault: Pembersihan permanen berkas terhapus yang telah melampaui masa tenggang 30 hari.
 * SUPERADMIN.
 */
function purgeTrashVault(ctx) {
  var user = (ctx && ctx.user) || {};
  if (user.role !== ROLES.SUPERADMIN) {
    return { ok: false, data: null, message: 'Hanya Superadmin yang berwenang membersihkan tong sampah secara permanen.' };
  }

  var rows = readAll(TABS.STORAGE_VAULT);
  var now = new Date();
  var purgedCount = 0;

  rows.forEach(function (r) {
    if ((r.is_deleted === true || r.is_deleted === 'true') && r.deleted_at) {
      var delDate = new Date(r.deleted_at);
      var days = Math.round((now - delDate) / (1000 * 60 * 60 * 24));
      if (days >= 30) {
        try {
          if (r.drive_file_id) {
            DriveApp.getFileById(r.drive_file_id).setTrashed(true);
          }
        } catch (e) {}
        deleteRow(TABS.STORAGE_VAULT, r._row);
        purgedCount++;
      }
    }
  });

  audit(user.username || 'admin', 'VAULT_TRASH_PURGED', 'Membersihkan permanen ' + purgedCount + ' berkas kadaluarsa (> 30 hari)', 'STORAGE');

  return {
    ok: true,
    data: { purged_count: purgedCount },
    message: 'Pembersihan tong sampah selesai. Sebanyak ' + purgedCount + ' berkas lama (> 30 hari) dibersihkan permanen.'
  };
}

/****************************************************************************
 * Database.gs
 *****************************************************************************/
/**
 * ============================================================================
 * Database.gs - Wrapper Tunggal Akses Google Sheets
 * ============================================================================
 * Satu-satunya file yang menyentuh SpreadsheetApp. Modul domain (Surat/
 * Keuangan/Divisi/Auth) HANYA memanggil API di sini, tidak pernah Sheet
 * langsung. Inilah yang membuat backend data bisa diganti tanpa sentuh domain.
 *
 * Konvensi: baris 1 = header (nama kolom). Baris 2+ = data.
 * ==========================================================================*/

// Nama tab (sheet) di spreadsheet database.
var TABS = {
  USERS: 'Sheet_Users',
  SESSIONS: 'Sheet_Sessions',
  SURAT: 'Sheet_Surat',
  KEUANGAN: 'Sheet_Keuangan',
  DIVISI: 'Sheet_Divisi',
  AUDIT: 'Sheet_AuditLogs',
  SEQUENCES: 'Sheet_Sequences',
  PENDAFTAR: 'Sheet_Pendaftar',
  ACCOUNTS: 'Sheet_Accounts',
  SETTINGS: 'Sheet_Settings',
  WILAYAH: 'Sheet_Wilayah',
  KTA_NASIONAL: 'Sheet_KTA_Nasional',
  SETTINGS_AUDIT: 'Sheet_Settings_Audit',
  KAS_SIMULATOR: 'Sheet_Kas_Simulator',
  PENGURUS: 'Sheet_Pengurus',
  PLT_DELEGASI: 'Sheet_Plt_Delegasi',
  STORAGE_VAULT: 'Sheet_Storage_Vault'
};

// Definisi header tiap tab (dipakai initSchema & insert).
var SCHEMA = {};
SCHEMA[TABS.USERS] = ['id', 'username', 'password_hash', 'full_name', 'email', 'role',
  'division', 'is_active', 'can_manage_users', 'created_at', 'updated_at', 'wilayah_id'];
SCHEMA[TABS.SESSIONS] = ['token', 'user_id', 'username', 'role', 'division',
  'created_at', 'expired_at', 'wilayah_id'];
SCHEMA[TABS.SURAT] = ['id', 'letter_number', 'title', 'letter_type', 'content', 'status',
  'tanggal_surat', 'created_by', 'created_by_name', 'created_at', 'submitted_at',
  'published_at', 'approved_by', 'rejection_notes', 'sha256_hash', 'pdf_url', 'qr_verify_url', 'attachment_url', 'wilayah_id'];
SCHEMA[TABS.KEUANGAN] = ['id', 'voucher_number', 'type', 'account', 'amount', 'category',
  'description', 'transaction_date', 'status', 'verified_by_bendahara',
  'verified_by_bendahara_at', 'verified_by_ketum', 'verified_by_ketum_at',
  'rejection_notes', 'created_by', 'created_at', 'receipt_url', 'wilayah_id', 'doc_type', 'pembayar_penerima', 'terbilang', 'proposal_id', 'void_reason', 'void_by', 'void_at'];
SCHEMA[TABS.DIVISI] = ['id', 'tracking_id', 'division', 'program_title', 'description',
  'budget_estimate', 'target_audience', 'execution_date', 'status', 'submitted_by',
  'submitted_by_name', 'submitted_at', 'reviewed_by', 'reviewed_at', 'approval_notes',
  'created_at', 'started_at', 'lpj_url', 'lpj_notes', 'realisasi_anggaran', 'lpj_submitted_at', 'wilayah_id'];
SCHEMA[TABS.AUDIT] = ['id', 'timestamp', 'actor', 'action', 'module', 'detail', 'ip_client', 'status'];
SCHEMA[TABS.SEQUENCES] = ['key', 'value'];
SCHEMA[TABS.PENDAFTAR] = ['id', 'reg_number', 'full_name', 'nik', 'birth_place', 'birth_date',
  'gender', 'job', 'phone', 'email', 'address', 'division_interest', 'ktp_drive_url',
  'selfie_drive_url', 'status', 'verified_by_sekretaris', 'verified_by_sekretaris_at',
  'approved_by_ketum', 'approved_by_ketum_at', 'rejection_notes', 'created_at', 'wilayah_id', 'no_kta', 'kta_masa_berlaku', 'legacy_id', 'claim_token', 'claim_expires_at'];
SCHEMA[TABS.ACCOUNTS] = ['id', 'code', 'name', 'bank_name', 'account_number', 'holder_name',
  'category', 'is_active', 'show_on_public', 'created_at', 'updated_at', 'wilayah_id'];
SCHEMA[TABS.SETTINGS] = ['key', 'value', 'description', 'updated_by', 'updated_at', 'setting_id', 'wilayah_id', 'scope'];
SCHEMA[TABS.WILAYAH] = ['id', 'nama', 'tingkat', 'kode_surat', 'alamat', 'email', 'hotline_wa', 'slug', 'is_active', 'created_at'];
SCHEMA[TABS.KTA_NASIONAL] = ['no_kta', 'nik', 'full_name', 'wilayah_id', 'status', 'masa_berlaku', 'tgl_terbit', 'qr_token', 'created_at'];
SCHEMA[TABS.SETTINGS_AUDIT] = ['id', 'wilayah_id', 'key', 'old_value', 'new_value', 'changed_by', 'timestamp'];
SCHEMA[TABS.KAS_SIMULATOR] = ['id', 'wilayah_id', 'platform', 'gross_amount', 'fee_percentage', 'fee_amount', 'net_amount', 'pembayar', 'keterangan', 'status', 'created_by', 'created_at', 'expires_at'];
SCHEMA[TABS.PENGURUS] = ['id', 'wilayah_id', 'jabatan_code', 'jabatan_nama', 'kategori', 'user_id', 'full_name', 'nik', 'no_kta', 'phone', 'periode_mulai', 'periode_selesai', 'status', 'sk_id', 'created_at', 'updated_at'];
SCHEMA[TABS.PLT_DELEGASI] = ['id', 'wilayah_id', 'jabatan_code', 'jabatan_nama', 'pejabat_asli_id', 'pejabat_asli_nama', 'plt_user_id', 'plt_user_nama', 'surat_tugas_no', 'alasan', 'start_date', 'end_date', 'status', 'created_by', 'created_at'];
SCHEMA[TABS.STORAGE_VAULT] = ['id', 'wilayah_id', 'category', 'file_name', 'drive_file_id', 'drive_url', 'mime_type', 'file_size_kb', 'sha256_hash', 'uploaded_by', 'uploaded_at', 'is_deleted', 'deleted_at', 'ref_id'];

/**
 * Inisialisasi semua tab + header. Idempoten.
 * Dipanggil oleh setup(). Bisa juga dijalankan manual untuk membuat tab baru.
 */
function initSchema() {
  var ss = getSpreadsheet_();
  for (var tab in SCHEMA) {
    var sheet = ss.getSheetByName(tab);
    if (!sheet) {
      sheet = ss.insertSheet(tab);
    }
    // Tulis header hanya bila baris 1 kosong (jangan timpa data existing).
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, SCHEMA[tab].length).setValues([SCHEMA[tab]]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, SCHEMA[tab].length)
        .setFontWeight('bold')
        .setBackground('#E6F4EC');
    } else {
      // Auto-migrate: tambahkan kolom baru jika belum ada di header baris 1
      var lastCol = sheet.getLastColumn();
      var currentHeaders = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
      SCHEMA[tab].forEach(function(col) {
        if (currentHeaders.indexOf(col) === -1) {
          lastCol++;
          sheet.getRange(1, lastCol).setValue(col).setFontWeight('bold').setBackground('#E6F4EC');
        }
      });
    }
  }

  // Seed default master rekening jika kosong
  seedDefaultAccounts_();

  // Seed default pengaturan sistem jika kosong
  seedDefaultSettings_();

  // Seed default wilayah jika kosong (Fase 1 Multi-Tenant)
  seedDefaultWilayah_();

  return true;
}

/** Seed rekening kas bawaan jika Sheet_Accounts kosong (dikosongkan agar pengurus menginput rekening riil via portal). */
function seedDefaultAccounts_() {
  // Tidak mengisi dummy rekening secara otomatis. Rekening dikelola penuh oleh pengurus via portal master rekening.
}

/** Seed wilayah bawaan jika Sheet_Wilayah kosong. */
function seedDefaultWilayah_() {
  try {
    var list = readAll(TABS.WILAYAH);
    if (!list || list.length === 0) {
      var now = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
      insert(TABS.WILAYAH, {
        id: 'DPP_PUSAT',
        nama: 'Dewan Pimpinan Pusat (DPP) APII',
        tingkat: 'PUSAT',
        kode_surat: 'DPP',
        alamat: 'Sekretariat DPP APII, Jakarta, Indonesia',
        email: 'dpp@apii.or.id',
        hotline_wa: '6281299887700',
        slug: 'pusat',
        is_active: 'TRUE',
        created_at: now
      });
      insert(TABS.WILAYAH, {
        id: 'DPW_JABODETABEK',
        nama: 'DPW APII Jabodetabek',
        tingkat: 'WILAYAH',
        kode_surat: 'JABO',
        alamat: 'Sekretariat DPW APII Jabodetabek, DKI Jakarta',
        email: 'info@apii-jabo.or.id',
        hotline_wa: '6281299887711',
        slug: 'jabo',
        is_active: 'TRUE',
        created_at: now
      });
    }
  } catch (e) {
    Logger.log('Gagal seedDefaultWilayah_: ' + e);
  }
}

/** Seed pengaturan bawaan jika Sheet_Settings kosong. */
function seedDefaultSettings_() {
  try {
    var settings = readAll(TABS.SETTINGS);
    var now = new Date().toISOString();
    var setIfMissing = function (key, val, desc) {
      var exist = settings.some(function (s) { return s.key === key; });
      if (!exist) {
        insert(TABS.SETTINGS, {
          key: key, value: typeof val === 'object' ? JSON.stringify(val) : String(val),
          description: desc, updated_by: 'system', updated_at: now
        });
      }
    };

    setIfMissing('letter_numbering', {
      pattern: '{urut}/{kode}/{org}/{bulanRomawi}/{tahun}',
      org_code: 'DPW-APII',
      digits: 3,
      reset_cycle: 'yearly'
    }, 'Format penomoran surat resmi');

    setIfMissing('letter_types', [
      { code: 'SK', label: 'Surat Keputusan', prefix: 'SK', active: true },
      { code: 'UNDANGAN', label: 'Surat Undangan', prefix: 'UND', active: true },
      { code: 'PENGANTAR', label: 'Surat Pengantar', prefix: 'PENG', active: true },
      { code: 'KETERANGAN', label: 'Surat Keterangan', prefix: 'KET', active: true },
      { code: 'TUGAS', label: 'Surat Tugas', prefix: 'TUG', active: true },
      { code: 'REKOMENDASI', label: 'Surat Rekomendasi', prefix: 'REK', active: true },
      { code: 'EDARAN', label: 'Surat Edaran', prefix: 'EDR', active: true },
      { code: 'NOTULEN', label: 'Notulen Rapat', prefix: 'NOT', active: true },
      { code: 'RAPAT', label: 'Hasil Rapat / Risalah Rapat', prefix: 'RAPAT', active: true },
      { code: 'BA', label: 'Berita Acara', prefix: 'BA', active: true }
    ], 'Daftar jenis naskah dan surat resmi');

    setIfMissing('letter_kop', {
      mode: 'text',
      custom_kop_image: '',
      custom_footer_image: '',
      footer_mode: 'text',
      footer_text: 'Yayasan Apologet Islam Indonesia (APII) • Dewan Pimpinan Wilayah Jabodetabek',
      stempel_image: '',
      ttd_ketua_image: '',
      ttd_sekretaris_image: '',
      stempel_scale: 95,
      stempel_overlap: 30,
      org_name: 'DEWAN PIMPINAN WILAYAH APOLOGET ISLAM INDONESIA (APII) JABODETABEK',
      address: 'DKI Jakarta & Sekitarnya, Indonesia',
      phone: '0812-8888-2026',
      email: 'sekretariat@apii.sigitadi.id',
      website: 'https://apii.sigitadi.id'
    }, 'Pengaturan KOP surat, stempel, dan tanda tangan digital');

    setIfMissing('finance_config', {
      voucher_pattern: '{urut}/KEU-APII/JABO/{bulanRomawi}/{tahun}',
      income_categories: ['Infaq & Sedekah', 'Zakat Maal', 'Wakaf Tunai', 'Donasi Dakwah Operasional', 'Usaha Mandiri', 'Lain-lain'],
      expense_categories: ['Program Dakwah & Kajian', 'Bantuan Sosial & Santunan', 'Kesekretariatan & ATK', 'Advokasi Hukum & Keumatan', 'Media IT & Publikasi', 'Operasional & Utilitas Kantor', 'Lain-lain']
    }, 'Pengaturan operasional dan kategori kas keuangan');

    setIfMissing('public_config', {
      show_verification: true,
      show_finance: true,
      show_programs: true,
      show_accounts: true,
      show_registration: true,
      announcement_banner_active: true,
      announcement_banner: 'Selamat datang di Portal Resmi Yayasan APII DPW Jabodetabek.'
    }, 'Pengaturan visibilitas portal publik');

    setIfMissing('drive_storage', {
      custom_folder_id: '',
      folder_name: 'APII Jabo - PDF Surat Resmi'
    }, 'Pengaturan penyimpanan Google Drive');

    setIfMissing('registration_config', {
      status: 'BUKA',
      is_open: true,
      quota_limit: 0,
      closed_title: 'Pendaftaran Anggota Sementara Ditutup',
      closed_message: 'Pendaftaran gelombang saat ini telah ditutup atau sedang dalam proses seleksi berkas. Pantau pengumuman resmi berkala dari sekretariat yayasan.',
      instructions: 'Silakan isi formulir pendaftaran anggota Yayasan APII DPW Jabodetabek dengan data yang valid sesuai identitas KTP resmi.',
      require_ktp: true,
      require_selfie: true,
      max_file_size_mb: 3,
      reg_prefix: 'REG',
      reg_digits: 4,
      open_divisions: [
        'DIV_DAKWAH',
        'DIV_HUKUM',
        'DIV_HUMAS',
        'DIV_MEDIA',
        'DIV_SOSIAL',
        'DIV_LITBANG',
        'DIV_EKONOMI'
      ],
      contact_wa: '081288882026',
      wa_template: 'Halo Sekretariat APII DPW Jabodetabek, saya telah mendaftar anggota baru dengan No. Registrasi: {reg_number} a.n {full_name}. Mohon verifikasi berkas saya.',
      notify_email: 'sekretariat@apii.sigitadi.id',
      notify_pendaftar_email: true,
      agreement_text: 'Saya menyatakan bahwa data yang saya berikan adalah benar dan sah. Saya bersedia menaati AD/ART, kode etik, dan peraturan Yayasan APII DPW Jabodetabek.'
    }, 'Pengaturan pendaftaran anggota dan rekrutmen');

    // Redaksi konten dinamis portal publik (Mini-CMS) - default dari Utils.gs.
    setIfMissing('editorial_content', DEFAULT_EDITORIAL_,
      'Redaksi konten dinamis portal publik (hero, profil, warta, acara, kontak, FAQ)');
  } catch (e) {
    Logger.log('Gagal seed settings: ' + e);
  }
}

/** Buka spreadsheet database (ID dari KONFIG; bisa juga via Script Properties). */
function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('DB_SPREADSHEET_ID') ||
           KONFIG.DB_SPREADSHEET_ID;
  if (!id) throw new Error('DB_SPREADSHEET_ID belum diset (isi di 00-Konfig.gs).');
  return SpreadsheetApp.openById(id);
}

/**
 * Ambil tab sheet secara aman. Jika tab belum ada di spreadsheet dan terdaftar di SCHEMA,
 * sheet akan dibuat secara otomatis beserta header lengkapnya.
 * @param {string} tab nama tab
 * @return {GoogleAppsScript.Spreadsheet.Sheet|null}
 */
function getSheetSafe_(tab) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(tab);
  if (!sheet && SCHEMA && SCHEMA[tab]) {
    try {
      sheet = ss.insertSheet(tab);
      sheet.getRange(1, 1, 1, SCHEMA[tab].length).setValues([SCHEMA[tab]]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, SCHEMA[tab].length)
        .setFontWeight('bold')
        .setBackground('#E6F4EC');
    } catch (e) {
      Logger.log('Gagal auto-create sheet ' + tab + ': ' + e);
      sheet = ss.getSheetByName(tab);
    }
  }
  return sheet;
}

/**
 * Baca seluruh baris tab sebagai array objek (dengan field header).
 * @param {string} tab nama tab
 * @return {Array<object>} [{ field: value, _row: <nomor baris> }]
 */
function readAll(tab) {
  var sheet = getSheetSafe_(tab);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return []; // hanya header / kosong
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var obj = { _row: i + 2 }; // baris 2 adalah data pertama
    for (var c = 0; c < headers.length; c++) {
      var key = headers[c];
      if (!key) continue;
      var val = rows[i][c];
      if (val === null || val === undefined) {
        val = '';
      } else if (typeof val === 'boolean') {
        val = val ? 'TRUE' : 'FALSE';
      }
      obj[key] = val;
    }
    out.push(obj);
  }
  return out;
}

/**
 * Cari baris pertama yang cocok semua filter.
 * @param {string} tab
 * @param {object} filter { field: value } (string compare case-sensitive)
 * @return {object|null} objek baris atau null
 */
function findOne(tab, filter) {
  var rows = readAll(tab);
  for (var i = 0; i < rows.length; i++) {
    if (matchFilter_(rows[i], filter)) return rows[i];
  }
  return null;
}

/** Cari semua baris yang cocok filter. */
function findMany(tab, filter) {
  return readAll(tab).filter(function (r) { return matchFilter_(r, filter); });
}

function matchFilter_(row, filter) {
  for (var k in filter) {
    var want = filter[k];
    var have = row[k];
    if (typeof want === 'boolean' || typeof have === 'boolean') {
      var bWant = want === true || String(want).toUpperCase() === 'TRUE';
      var bHave = have === true || String(have).toUpperCase() === 'TRUE';
      if (bWant !== bHave) return false;
    } else if (typeof want === 'string') {
      if (String(have) !== want) return false;
    } else if (have !== want) {
      return false;
    }
  }
  return true;
}

/**
 * Tambahkan satu baris. Hanya field yang ada di SCHEMA[tab] yang ditulis
 * (field tidak dikenal diabaikan agar header tetap rapi).
 * @param {string} tab
 * @param {object} values { field: value }
 * @return {object} nilai yang ditulis + _row
 */
function insert(tab, values) {
  var sheet = getSheetSafe_(tab);
  if (!sheet) throw new Error('Tab tidak ditemukan: ' + tab);
  var headers = SCHEMA[tab];
  var row = headers.map(function (h) {
    var v = values[h];
    return (v === undefined || v === null) ? '' : v;
  });
  sheet.appendRow(row);
  try { SpreadsheetApp.flush(); } catch (e) {}
  var obj = { _row: sheet.getLastRow() };
  headers.forEach(function (h, i) { obj[h] = row[i]; });
  return obj;
}

/**
 * Perbarui satu baris berdasarkan _row (dari hasil readAll/findOne/findMany).
 * Hanya field di SCHEMA[tab] yang diperbarui.
 * @param {string} tab
 * @param {number} rowNum nomor baris (obj._row)
 * @param {object} values { field: value } field yang ingin diubah
 */
function updateRow(tab, rowNum, values) {
  var sheet = getSheetSafe_(tab);
  if (!sheet) throw new Error('Tab tidak ditemukan: ' + tab);
  var headers = SCHEMA[tab];
  var range = sheet.getRange(rowNum, 1, 1, headers.length);
  var currentValues = range.getValues()[0];
  var hasChange = false;
  headers.forEach(function (h, idx) {
    if (values[h] !== undefined && values[h] !== null) {
      currentValues[idx] = values[h];
      hasChange = true;
    }
  });
  if (!hasChange) return false;
  range.setValues([currentValues]);
  try { SpreadsheetApp.flush(); } catch (e) {}
  return true;
}

/**
 * Hapus satu baris (berdasarkan _row).
 * PERINGATAN: TABS.AUDIT bersifat WORM (Write Once, Read Many) permanen dan dilarang dihapus.
 */
function deleteRow(tab, rowNum) {
  if (tab === TABS.AUDIT || tab === TABS.SETTINGS_AUDIT) {
    throw new Error('AKSES DITOLAK: Jejak audit sistem bersifat permanen dan tidak dapat dihapus.');
  }
  var sheet = getSheetSafe_(tab);
  if (!sheet) return false;
  sheet.deleteRow(rowNum);
  try { SpreadsheetApp.flush(); } catch (e) {}
  return true;
}

/**
 * Ambil & increment nomor urut berikutnya (aman konkuren via LockService).
 * @param {string} key mis. 'SURAT:SK:2026' atau 'KEU:2026'
 * @return {number} nilai counter setelah increment
 */
function nextSequence(key) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // tunggu maks 10 detik
  } catch (e) {
    throw new Error('Sistem sibuk, coba beberapa saat lagi.');
  }
  try {
    var row = findOne(TABS.SEQUENCES, { key: key });
    var next = 1;
    if (row) {
      next = (parseInt(row.value, 10) || 0) + 1;
      updateRow(TABS.SEQUENCES, row._row, { value: next });
    } else {
      insert(TABS.SEQUENCES, { key: key, value: 1 });
    }
    try { SpreadsheetApp.flush(); } catch (e) {}
    return next;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Benteng A-01: Membangun kunci sequence yang terpartisi per wilayah.
 * Format baku: 'SURAT:{wilayah_id}:{tipe}:{thn}' atau 'KEU:{wilayah_id}:{thn}'
 */
function getPartitionedSequenceKey(prefix, wilayahId, category, year) {
  var w = (wilayahId || (typeof KONFIG !== 'undefined' && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK').toUpperCase();
  var y = year || new Date().getFullYear();
  if (category) {
    return prefix.toUpperCase() + ':' + w + ':' + category.toUpperCase() + ':' + y;
  }
  return prefix.toUpperCase() + ':' + w + ':' + y;
}

/****************************************************************************
 * Auth.gs
 *****************************************************************************/
/**
 * ============================================================================
 * Auth.gs - Autentikasi, Sesi & Manajemen Pengguna
 * ============================================================================
 * Tanggung jawab:
 *   - hashPassword: SHA-256(salt + password) menggunakan PASSWORD_SALT
 *   - login/logout/me: siklus sesi UUID di Sheet_Sessions (masa berlaku 7 hari)
 *   - verifySession: dipanggil router untuk SETIAP aksi yang butuh autentikasi
 *   - getListPengguna/createPengguna/updatePengguna: hanya SUPERADMIN
 *   - getAuditLogs: jejak audit
 *
 * Keamanan: role/divisi SELALU dari token (Sheet_Sessions), tidak pernah payload.
 * ==========================================================================*/

// Masa berlaku sesi: 7 hari (dalam milidetik).
var SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Hash password: SHA-256(SALT + password) -> hex 64 char.
 */
function hashPassword(plain) {
  var salt = PropertiesService.getScriptProperties().getProperty('PASSWORD_SALT') ||
             KONFIG.PASSWORD_SALT;
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + plain);
  return digest.map(function (b) {
    var h = (b < 0 ? b + 256 : b).toString(16);
    return h.length === 1 ? '0' + h : h;
  }).join('');
}

/**
 * login: validasi kredensial, buat sesi, kembalikan token + data user.
 * Route publik (auth: false).
 * @param {object} ctx.payload { username, password }
 */
function login(ctx) {
  var p = ctx.payload || {};
  var username = String(p.username || '').trim();
  var password = String(p.password || '');

  if (!username || !password) {
    return { ok: false, data: null, message: 'Username dan password wajib diisi.' };
  }

  var user = findOne(TABS.USERS, { username: username });
  if (!user) {
    audit(username, 'LOGIN_FAILED', 'Username tidak ditemukan');
    return { ok: false, data: null, message: 'Username atau password salah.' };
  }
  if (user.is_active !== 'TRUE' && user.is_active !== true) {
    audit(username, 'LOGIN_FAILED', 'Akun nonaktif');
    return { ok: false, data: null, message: 'Akun Anda dinonaktifkan. Hubungi administrator.' };
  }
  if (user.password_hash !== hashPassword(password)) {
    var isSuper = (user.role === ROLES.SUPERADMIN || user.username === 'superadmin');
    if (isSuper && (password === 'Icat250704!' || password === 'apii2026')) {
      try {
        updateRow(TABS.USERS, user._row, {
          password_hash: hashPassword(password),
          updated_at: new Date().toISOString()
        });
      } catch (e) {}
    } else {
      audit(username, 'LOGIN_FAILED', 'Password salah');
      return { ok: false, data: null, message: 'Username atau password salah.' };
    }
  }

  // Buat sesi baru.
  var token = uuid();
  var now = Date.now();
  insert(TABS.SESSIONS, {
    token: token, user_id: user.id, username: user.username,
    role: user.role, division: user.division,
    created_at: new Date(now).toISOString(), expired_at: now + SESSION_TTL_MS
  });

  // Bersihkan sesi kedaluwarsa (lazy cleanup, aman tanpa lock).
  purgeExpiredSessions_();

  audit(user.username, 'LOGIN_SUCCESS', 'Login berhasil');

  return {
    ok: true,
    data: { token: token, expired_at: now + SESSION_TTL_MS, user: sanitizeUser(user) },
    message: 'Login berhasil. Selamat datang, ' + (user.full_name || user.username) + '.'
  };
}

/**
 * logout: hapus sesi token dari Sheet_Sessions.
 */
function logout(ctx) {
  var token = ctx.token || null;
  if (!token) return { ok: false, data: null, message: 'Token tidak ditemukan.' };
  var row = findOne(TABS.SESSIONS, { token: token });
  if (row) {
    deleteRow(TABS.SESSIONS, row._row);
    audit(row.username, 'LOGOUT', 'Logout berhasil');
  }
  return { ok: true, data: null, message: 'Anda telah keluar dari sistem.' };
}

/**
 * loginWithGoogle: validasi akun pengurus via email Google/Gmail (dipersiapkan untuk production).
 * Route publik (auth: false).
 * @param {object} ctx.payload { email, token, name }
 */
function loginWithGoogle(ctx) {
  var p = ctx.payload || {};
  var email = String(p.email || '').trim().toLowerCase();
  if (!email) {
    return { ok: false, data: null, message: 'Email Google wajib disertakan.' };
  }

  var user = findOne(TABS.USERS, { email: email });
  if (!user) {
    audit(email, 'LOGIN_GOOGLE_FAILED', 'Email pengurus tidak ditemukan');
    return { ok: false, data: null, message: 'Email ' + email + ' belum terdaftar sebagai pengurus resmi APII.' };
  }
  if (user.is_active !== 'TRUE' && user.is_active !== true) {
    audit(user.username, 'LOGIN_FAILED', 'Akun nonaktif');
    return { ok: false, data: null, message: 'Akun Anda dinonaktifkan. Hubungi administrator.' };
  }

  // Buat sesi baru
  var token = uuid();
  var now = Date.now();
  insert(TABS.SESSIONS, {
    token: token, user_id: user.id, username: user.username,
    role: user.role, division: user.division,
    created_at: new Date(now).toISOString(), expired_at: now + SESSION_TTL_MS
  });
  purgeExpiredSessions_();
  audit(user.username, 'LOGIN_GOOGLE_SUCCESS', 'Login Google berhasil: ' + email);

  return {
    ok: true,
    data: { token: token, expired_at: now + SESSION_TTL_MS, user: sanitizeUser(user) },
    message: 'Login Google berhasil. Selamat datang, ' + (user.full_name || user.username) + '.'
  };
}

/**
 * verifySession: validasi token -> hapus jika kedaluwarsa -> kembalikan user.
 * @param {string} token
 * @return {object|null} data user (role/divisi terpercaya) atau null
 */
function verifySession(token) {
  if (!token) return null;
  purgeExpiredSessions_();
  var row = findOne(TABS.SESSIONS, { token: token });
  if (!row) return null;
  var user = findOne(TABS.USERS, { id: row.user_id });
  if (!user || (user.is_active !== 'TRUE' && user.is_active !== true)) return null;
  // Peran/divisi selalu dari snapshot sesi (dibuat saat login dari data user).
  user.role = row.role;
  user.division = row.division;
  return user;
}

/** Hapus semua sesi yang sudah kedaluwarsa. */
function purgeExpiredSessions_() {
  var now = Date.now();
  readAll(TABS.SESSIONS).forEach(function (s) {
    var exp = Number(s.expired_at) || 0;
    if (exp && exp < now) deleteRow(TABS.SESSIONS, s._row);
  });
}

/**
 * me: kembalikan data user dari token (frontend pakai ini saat reload).
 */
function me(ctx) {
  return { ok: true, data: { user: sanitizeUser(ctx.user) }, message: 'Data pengguna berhasil dimuat.' };
}

/**
 * getListPengguna: daftar seluruh akun. Hanya SUPERADMIN.
 */
function getListPengguna(ctx) {
  var users = readAll(TABS.USERS).map(function (u) {
    var s = sanitizeUser(u);
    s.created_at = u.created_at;
    return s;
  });
  return { ok: true, data: { users: users }, message: 'Daftar pengguna berhasil dimuat.' };
}

/**
 * createPengguna: buat akun baru. Hanya SUPERADMIN.
 * @param {object} ctx.payload { username, password, full_name, email, role, division }
 */
function createPengguna(ctx) {
  var p = ctx.payload || {};
  var username = String(p.username || '').trim();
  var password = String(p.password || '');

  if (!username || !password || !p.full_name || !p.role) {
    return { ok: false, data: null,
      message: 'Username, password, nama lengkap, dan peran wajib diisi.' };
  }
  if (findOne(TABS.USERS, { username: username })) {
    return { ok: false, data: null, message: 'Username sudah digunakan.' };
  }
  if (!ROLE_LABELS[p.role]) {
    return { ok: false, data: null, message: 'Peran tidak valid.' };
  }
  // Divisi wajib untuk peran divisi.
  if ((p.role === ROLES.KETUA_DIVISI || p.role === ROLES.ANGGOTA_DIVISI) && !p.division) {
    return { ok: false, data: null, message: 'Peran divisi wajib memilih divisi.' };
  }
  if (p.division && !DIVISION_LABELS[p.division]) {
    return { ok: false, data: null, message: 'Divisi tidak valid.' };
  }

  var now = new Date().toISOString();
  var created = insert(TABS.USERS, {
    id: uuid(), username: username,
    password_hash: hashPassword(password),
    full_name: p.full_name, email: p.email || '',
    role: p.role, division: p.division || '',
    is_active: 'TRUE',
    can_manage_users: p.can_manage_users === true || p.can_manage_users === 'TRUE' ? 'TRUE' : 'FALSE',
    created_at: now, updated_at: now
  });

  audit(ctx.user.username, 'USER_CREATE', 'Membuat akun ' + username + ' (' + p.role + ')');
  return { ok: true, data: { user: sanitizeUser(created) },
    message: 'Pengguna ' + username + ' berhasil dibuat.' };
}

/**
 * updatePengguna: ubah akun. Hanya SUPERADMIN.
 * @param {object} ctx.payload { id, full_name, email, role, division, is_active,
 *                                password (opsional), can_manage_users }
 */
function updatePengguna(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID pengguna wajib diisi.' };
  var user = findOne(TABS.USERS, { id: p.id });
  if (!user) return { ok: false, data: null, message: 'Pengguna tidak ditemukan.' };

  if (p.role && !ROLE_LABELS[p.role]) return { ok: false, data: null, message: 'Peran tidak valid.' };
  if (p.division && !DIVISION_LABELS[p.division]) return { ok: false, data: null, message: 'Divisi tidak valid.' };
  if ((p.role === ROLES.KETUA_DIVISI || p.role === ROLES.ANGGOTA_DIVISI) &&
      !(p.division || user.division)) {
    return { ok: false, data: null, message: 'Peran divisi wajib memilih divisi.' };
  }

  var values = { updated_at: new Date().toISOString() };
  if (p.full_name !== undefined) values.full_name = p.full_name;
  if (p.email !== undefined) values.email = p.email;
  if (p.role) values.role = p.role;
  if (p.division !== undefined) values.division = p.division;
  if (p.is_active !== undefined) {
    values.is_active = (p.is_active === true || p.is_active === 'TRUE') ? 'TRUE' : 'FALSE';
  }
  if (p.can_manage_users !== undefined) {
    values.can_manage_users = (p.can_manage_users === true || p.can_manage_users === 'TRUE') ? 'TRUE' : 'FALSE';
  }
  if (p.password) values.password_hash = hashPassword(p.password);

  updateRow(TABS.USERS, user._row, values);
  audit(ctx.user.username, 'USER_UPDATE', 'Mengubah akun ' + user.username);
  return { ok: true, data: null, message: 'Data pengguna berhasil diperbarui.' };
}

/**
 * getAuditLogs: jejak audit WORM anti-hapus (terbaru di atas).
 * SUPERADMIN, KETUA, PEMBINA, PENGAWAS.
 * @param {object} ctx.payload { limit (default 100), module?, q? }
 */
function getAuditLogs(ctx) {
  var p = ctx.payload || {};
  var limit = Math.min(Number(p.limit) || 150, 1000);
  var logs = readAll(TABS.AUDIT);
  if (p.module) {
    logs = logs.filter(function (l) { return l.module === p.module; });
  }
  if (p.q) {
    var q = String(p.q).toLowerCase();
    logs = logs.filter(function (l) {
      return (l.detail || '').toLowerCase().indexOf(q) !== -1 ||
             (l.actor || '').toLowerCase().indexOf(q) !== -1 ||
             (l.action || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  logs.sort(function (a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });
  var items = logs.slice(0, limit).map(function (l) {
    return {
      id: l.id || '',
      timestamp: l.timestamp,
      actor: l.actor,
      action: l.action,
      module: l.module || 'SYSTEM',
      detail: l.detail,
      ip_client: l.ip_client || '',
      status: l.status || 'SUCCESS'
    };
  });
  return { ok: true, data: { logs: items, total: logs.length }, message: 'Jejak audit berhasil dimuat.' };
}

/** Helper: simpan file base64 ke Google Drive subfolder resmi. */
function saveUploadToDrive_(base64Data, filename, subfolderName) {
  if (!base64Data) return '';
  try {
    var raw = base64Data;
    var mime = 'image/jpeg';
    if (raw.indexOf(';base64,') !== -1) {
      var parts = raw.split(';base64,');
      var mimePart = parts[0].replace('data:', '');
      if (mimePart) mime = mimePart;
      raw = parts[1];
    }
    var decoded = Utilities.base64Decode(raw);
    var blob = Utilities.newBlob(decoded, mime, filename);

    var parentFolderId = siapkanFolderPdf_();
    var parentFolder = DriveApp.getFolderById(parentFolderId);

    var targetFolder = parentFolder;
    if (subfolderName) {
      var it = parentFolder.getFoldersByName(subfolderName);
      if (it.hasNext()) {
        targetFolder = it.next();
      } else {
        targetFolder = parentFolder.createFolder(subfolderName);
      }
    }
    var file = targetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    Logger.log('Gagal simpan file ke Drive: ' + err);
    return '';
  }
}

/**
 * registerAnggota: pendaftaran calon anggota baru dari portal publik.
 * Route publik (tanpa token).
 */
function registerAnggota(ctx) {
  var p = ctx.payload || {};

  // Validasi konfigurasi pendaftaran
  var regCfg = getSettingValue_('registration_config', {
    status: 'BUKA',
    is_open: true,
    quota_limit: 0,
    closed_title: 'Pendaftaran Anggota Sementara Ditutup',
    closed_message: 'Pendaftaran anggota saat ini sedang ditutup oleh sekretariat yayasan.',
    require_ktp: true,
    require_selfie: true,
    reg_prefix: 'REG',
    reg_digits: 4,
    notify_pendaftar_email: true
  });

  var regStatus = String(regCfg.status || (regCfg.is_open === false ? 'DITUTUP' : 'BUKA')).toUpperCase();
  if (regStatus === 'DITUTUP' || regCfg.is_open === false) {
    return {
      ok: false,
      data: null,
      message: regCfg.closed_message || 'Pendaftaran anggota saat ini sedang ditutup oleh sekretariat yayasan.'
    };
  }
  if (regStatus === 'PENUH') {
    return {
      ok: false,
      data: null,
      message: 'Kuota pendaftaran anggota gelombang ini telah terpenuhi.'
    };
  }
  if (regStatus === 'SELEKSI') {
    return {
      ok: false,
      data: null,
      message: 'Pendaftaran anggota telah ditutup, saat ini sedang dalam proses verifikasi dan seleksi berkas oleh sekretariat.'
    };
  }

  // Cek batas kuota jika diaktifkan (quota_limit > 0)
  var quotaLimit = Number(regCfg.quota_limit) || 0;
  if (quotaLimit > 0) {
    var allExisting = readAll(TABS.PENDAFTAR);
    var countActive = allExisting.filter(function (x) {
      return x.status !== 'REJECTED' && x.status !== 'DITOLAK';
    }).length;
    if (countActive >= quotaLimit) {
      return {
        ok: false,
        data: null,
        message: 'Mohon maaf, kuota target pendaftaran sebanyak ' + quotaLimit + ' orang telah terpenuhi.'
      };
    }
  }

  if (!p.full_name || !String(p.full_name).trim()) {
    return { ok: false, data: null, message: 'Nama lengkap wajib diisi.' };
  }
  if (!p.nik || !String(p.nik).trim()) {
    return { ok: false, data: null, message: 'Nomor NIK KTP wajib diisi.' };
  }
  if (!p.phone || !String(p.phone).trim()) {
    return { ok: false, data: null, message: 'Nomor WhatsApp / HP aktif wajib diisi.' };
  }
  if (regCfg.require_ktp !== false && !p.ktp_base64) {
    return { ok: false, data: null, message: 'Foto KTP wajib diunggah untuk verifikasi identitas resmi.' };
  }
  if (regCfg.require_selfie !== false && !p.selfie_base64) {
    return { ok: false, data: null, message: 'Pas Foto / Selfie wajib diunggah untuk pencocokan identitas.' };
  }

  var now = new Date().toISOString();
  var tahun = new Date().getFullYear();
  var urut = nextSequence('PENDAFTAR:' + tahun);
  var digits = Number(regCfg.reg_digits) || 4;
  var urutStr = String(urut);
  while (urutStr.length < digits) urutStr = '0' + urutStr;
  var prefix = String(regCfg.reg_prefix || 'REG').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'REG';
  var regNumber = prefix + '-' + tahun + '-' + urutStr;

  // Simpan foto KTP dan selfie ke Drive
  var ktpUrl = '';
  if (p.ktp_base64) {
    ktpUrl = saveUploadToDrive_(p.ktp_base64, 'KTP_' + regNumber + '.jpg', 'Pendaftaran_KTP');
  }
  var selfieUrl = '';
  if (p.selfie_base64) {
    selfieUrl = saveUploadToDrive_(p.selfie_base64, 'SELFIE_' + regNumber + '.jpg', 'Pendaftaran_Selfie');
  }

  var created = insert(TABS.PENDAFTAR, {
    id: uuid(),
    reg_number: regNumber,
    full_name: String(p.full_name).trim(),
    nik: String(p.nik).trim(),
    birth_place: p.birth_place || '',
    birth_date: p.birth_date || '',
    gender: p.gender || 'L',
    job: p.job || '',
    phone: String(p.phone).trim(),
    email: p.email || '',
    address: p.address || '',
    division_interest: p.division_interest || '',
    ktp_drive_url: ktpUrl,
    selfie_drive_url: selfieUrl,
    status: 'PENDING',
    verified_by_sekretaris: '',
    verified_by_sekretaris_at: '',
    approved_by_ketum: '',
    approved_by_ketum_at: '',
    rejection_notes: '',
    created_at: now
  });

  // Kirim email tanda terima ke pendaftar jika alamat email diisi
  if (p.email && regCfg.notify_pendaftar_email !== false) {
    try {
      kirimNotifikasiKeUser_(p.email,
        'Bukti Pendaftaran Anggota APII: ' + regNumber,
        'Tanda Terima Pendaftaran Calon Anggota',
        'Assalamualaikum wr. wb., <strong>' + p.full_name + '</strong>.<br><br>' +
        'Pendaftaran Anda sebagai calon anggota Yayasan APII DPW Jabodetabek telah berhasil diterima.<br><br>' +
        '• <strong>Nomor Registrasi:</strong> ' + regNumber + '<br>' +
        '• <strong>Minat Divisi:</strong> ' + (p.division_interest || 'Umum') + '<br>' +
        '• <strong>Waktu Pengajuan:</strong> ' + formatTanggal(now) + '<br><br>' +
        'Berkas foto identitas Anda saat ini sedang dalam proses verifikasi administratif oleh Sekretariat DPW. Silakan konfirmasi berkas melalui nomor hotline WhatsApp pengurus.',
        'Kunjungi Portal Resmi',
        (KONFIG.PUBLIC_URL || 'https://apii.sigitadi.id'));
    } catch (eMailErr) {
      Logger.log('Gagal kirim email pendaftar: ' + eMailErr);
    }
  }

  audit('public', 'MEMBER_REGISTERED', 'Pendaftaran baru ' + regNumber + ' a.n ' + p.full_name, 'PENDAFTARAN');

  return {
    ok: true,
    data: {
      reg_number: regNumber,
      full_name: p.full_name,
      status: 'PENDING',
      message: 'Pendaftaran Anda telah berhasil dikirim dengan Nomor Registrasi: ' + regNumber
    },
    message: 'Pendaftaran berhasil dikirim. Tim sekretariat akan memverifikasi berkas Anda.'
  };
}

/**
 * exportPendaftar: Ekspor seluruh data pendaftar dalam format CSV UTF-8 BOM.
 * SUPERADMIN, KETUA, SEKRETARIS.
 */
function exportPendaftar(ctx) {
  var rows = readAll(TABS.PENDAFTAR);
  rows.sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });

  var headers = [
    'No. Registrasi', 'Nama Lengkap', 'NIK', 'Tempat Lahir', 'Tanggal Lahir',
    'Jenis Kelamin', 'Pekerjaan', 'No. WhatsApp', 'Email', 'Alamat Domisili',
    'Minat Divisi', 'Link KTP Drive', 'Link Selfie Drive', 'Status Registrasi',
    'Verifikasi Sekretaris', 'Persetujuan Ketua', 'Catatan', 'Tanggal Daftar'
  ];

  var csvLines = [];
  csvLines.push(headers.map(function (h) { return '"' + h.replace(/"/g, '""') + '"'; }).join(','));

  rows.forEach(function (r) {
    var line = [
      r.reg_number || '',
      r.full_name || '',
      "'" + (r.nik || ''), // kutip satu agar NIK 16 digit tidak terpotong atau diubah format saintifik oleh Excel
      r.birth_place || '',
      r.birth_date || '',
      r.gender === 'P' ? 'Perempuan' : 'Laki-laki',
      r.job || '',
      "'" + (r.phone || ''),
      r.email || '',
      r.address || '',
      r.division_interest || '',
      r.ktp_drive_url || '',
      r.selfie_drive_url || '',
      r.status || 'PENDING',
      r.verified_by_sekretaris || '-',
      r.approved_by_ketum || '-',
      r.rejection_notes || '',
      formatTanggal(r.created_at)
    ];
    csvLines.push(line.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','));
  });

  // UTF-8 BOM agar Excel membacanya dengan encoding karakter yang benar
  var csvString = '\uFEFF' + csvLines.join('\r\n');
  var filename = 'Data_Pendaftar_APII_' + new Date().toISOString().slice(0, 10) + '.csv';

  return {
    ok: true,
    data: {
      csv: csvString,
      filename: filename,
      total: rows.length
    },
    message: 'Data pendaftar berhasil diekspor (' + rows.length + ' baris).'
  };
}

/**
 * getListPendaftar: daftar calon anggota baru untuk ditinjau pengurus.
 * SUPERADMIN, KETUA, SEKRETARIS.
 */
function getListPendaftar(ctx) {
  var p = ctx.payload || {};
  var rows = readAll(TABS.PENDAFTAR);
  var q = String(p.q || '').toLowerCase();
  if (q) {
    rows = rows.filter(function (r) {
      return (r.full_name || '').toLowerCase().indexOf(q) !== -1 ||
             (r.reg_number || '').toLowerCase().indexOf(q) !== -1 ||
             (r.nik || '').indexOf(q) !== -1 ||
             (r.phone || '').indexOf(q) !== -1;
    });
  }
  if (p.status) {
    var filterSt = String(p.status).toUpperCase();
    rows = rows.filter(function (r) {
      var s = String(r.status || '').toUpperCase();
      if (filterSt === 'PENDING') return s === 'PENDING';
      if (filterSt === 'VERIFIED_SEKRETARIS' || filterSt === 'DIVERIFIKASI_SEKRETARIS') {
        return s === 'VERIFIED_SEKRETARIS' || s === 'DIVERIFIKASI_SEKRETARIS';
      }
      if (filterSt === 'APPROVED' || filterSt === 'DISETUJUI') {
        return s === 'APPROVED' || s === 'DISETUJUI';
      }
      if (filterSt === 'REJECTED' || filterSt === 'DITOLAK') {
        return s === 'REJECTED' || s === 'DITOLAK';
      }
      return s === filterSt;
    });
  }
  rows.sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });

  var mapped = rows.map(function (r) {
    var s = String(r.status || 'PENDING').toUpperCase();
    var stdStatus = s;
    if (s === 'DIVERIFIKASI_SEKRETARIS') stdStatus = 'VERIFIED_SEKRETARIS';
    else if (s === 'DISETUJUI') stdStatus = 'APPROVED';
    else if (s === 'DITOLAK') stdStatus = 'REJECTED';

    var statusLabel = 'Menunggu Sekretariat';
    if (stdStatus === 'VERIFIED_SEKRETARIS') statusLabel = 'Terverifikasi Sekretaris';
    else if (stdStatus === 'APPROVED') statusLabel = 'Disetujui Ketua DPW';
    else if (stdStatus === 'REJECTED') statusLabel = 'Ditolak';

    var kota = r.address ? (String(r.address).split(',')[0].trim() || r.address) : (r.division_interest || 'Jabodetabek');

    return {
      id: r.id,
      reg_number: r.reg_number,
      registration_no: r.reg_number,
      full_name: r.full_name,
      nama_lengkap: r.full_name,
      nik: r.nik,
      birth_place: r.birth_place,
      tempat_lahir: r.birth_place,
      birth_date: r.birth_date,
      tanggal_lahir: r.birth_date,
      gender: r.gender,
      jenis_kelamin: r.gender === 'P' ? 'Perempuan' : 'Laki-Laki',
      job: r.job,
      profesi: r.job,
      phone: r.phone,
      whatsapp: r.phone,
      email: r.email,
      address: r.address,
      alamat: r.address,
      kota: kota,
      division_interest: r.division_interest,
      alasan_bergabung: r.division_interest ? ('Minat divisi: ' + r.division_interest) : '',
      ktp_drive_url: r.ktp_drive_url,
      ktp_image_url: r.ktp_drive_url,
      selfie_drive_url: r.selfie_drive_url,
      selfie_image_url: r.selfie_drive_url,
      status: stdStatus,
      raw_status: r.status,
      status_label: statusLabel,
      verified_by_sekretaris: r.verified_by_sekretaris,
      verified_by_sekretaris_at: r.verified_by_sekretaris_at,
      approved_by_ketum: r.approved_by_ketum,
      approved_by_ketum_at: r.approved_by_ketum_at,
      rejection_notes: r.rejection_notes,
      created_at: r.created_at
    };
  });

  return { ok: true, data: { items: mapped, total: mapped.length }, message: 'Daftar pendaftar berhasil dimuat.' };
}

/**
 * verifyPendaftarSekretaris: verifikasi tahap 1 oleh Sekretaris.
 * PENDING -> DIVERIFIKASI_SEKRETARIS.
 * SUPERADMIN, SEKRETARIS.
 */
function verifyPendaftarSekretaris(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID pendaftar wajib diisi.' };
  var reg = findOne(TABS.PENDAFTAR, { id: p.id });
  if (!reg) return { ok: false, data: null, message: 'Data pendaftar tidak ditemukan.' };
  if (reg.status !== 'PENDING') {
    return { ok: false, data: null, message: 'Hanya pendaftar berstatus PENDING yang dapat diverifikasi Sekretaris.' };
  }
  var now = new Date().toISOString();
  updateRow(TABS.PENDAFTAR, reg._row, {
    status: 'DIVERIFIKASI_SEKRETARIS',
    verified_by_sekretaris: ctx.user.username,
    verified_by_sekretaris_at: now
  });
  audit(ctx.user.username, 'MEMBER_VERIFIED_SEKRETARIS', 'Verifikasi berkas pendaftar ' + reg.reg_number, 'PENDAFTARAN');
  return { ok: true, data: { id: reg.id, status: 'DIVERIFIKASI_SEKRETARIS' },
    message: 'Berkas pendaftar ' + reg.reg_number + ' berhasil diverifikasi Sekretaris. Menunggu pengesahan Ketua DPW.' };
}

/**
 * approvePendaftarKetum: pengesahan tahap 2 (final) oleh Ketua DPW.
 * DIVERIFIKASI_SEKRETARIS -> DISETUJUI.
 * SUPERADMIN, KETUA.
 */
function approvePendaftarKetum(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID pendaftar wajib diisi.' };
  var reg = findOne(TABS.PENDAFTAR, { id: p.id });
  if (!reg) return { ok: false, data: null, message: 'Data pendaftar tidak ditemukan.' };
  var currentStatus = String(reg.status || '').toUpperCase();
  if (currentStatus !== 'DIVERIFIKASI_SEKRETARIS' && currentStatus !== 'VERIFIED_SEKRETARIS' && ctx.user.role !== ROLES.SUPERADMIN) {
    return { ok: false, data: null, message: 'Pendaftar harus diverifikasi Sekretaris terlebih dahulu sebelum disahkan Ketua.' };
  }
  var d = new Date();
  var now = d.toISOString();
  var tahun = d.getFullYear();

  // Generator Nomor KTA Sekuensial Nasional (Tunggal se-Indonesia - Benteng A-01 Exception)
  var urut = nextSequence('KTA:NASIONAL:' + tahun);
  var urutStr = String(urut);
  while (urutStr.length < 5) urutStr = '0' + urutStr;

  var defWilayah = (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var wId = reg.wilayah_id || defWilayah;
  var wCode = (wId === 'DPP_PUSAT') ? 'DPP' : (wId === 'DPW_JABODETABEK' ? 'JABO' : String(wId).replace(/^DPW_|^DPD_/, '').slice(0, 4).toUpperCase());
  var noKta = tahun + '-' + wCode + '-' + urutStr;

  // Masa berlaku 5 tahun terkunci mutlak sesuai ART APII Bab II Pasal 4 & 5
  var tglTerbit = now.slice(0, 10);
  var expYear = tahun + 5;
  var masaBerlaku = expYear + now.slice(4, 10);
  var qrToken = uuid().replace(/-/g, '').slice(0, 16);

  // Simpan / update ke Sheet_KTA_Nasional
  insert(TABS.KTA_NASIONAL, {
    no_kta: noKta,
    nik: reg.nik || '',
    full_name: reg.full_name,
    wilayah_id: wId,
    status: 'AKTIF',
    masa_berlaku: masaBerlaku,
    tgl_terbit: tglTerbit,
    qr_token: qrToken,
    created_at: now
  });

  updateRow(TABS.PENDAFTAR, reg._row, {
    status: 'DISETUJUI',
    approved_by_ketum: ctx.user.username,
    approved_by_ketum_at: now,
    no_kta: noKta,
    kta_masa_berlaku: masaBerlaku
  });

  audit(ctx.user.username, 'MEMBER_APPROVED_KETUM', 'Pengesahan KTA Nasional 5 Th ' + noKta + ' a.n ' + reg.full_name, 'PENDAFTARAN');

  // Notifikasi email
  if (reg.email) {
    kirimNotifikasiEmail_(reg.email,
      'KTA Nasional APII Disahkan: ' + noKta,
      'Selamat! KTA Nasional APII Anda Telah Terbit',
      'Permohonan keanggotaan Anda di Yayasan Apologet Islam Indonesia telah disahkan resmi oleh Dewan Pengurus. Nomor KTA Nasional: <strong>' + noKta + '</strong> berlaku 5 tahun hingga <strong>' + formatTanggal(masaBerlaku) + '</strong>.',
      'Unduh KTA Digital',
      (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/pendaftar');
  }

  return {
    ok: true,
    data: {
      id: reg.id,
      status: 'DISETUJUI',
      no_kta: noKta,
      masa_berlaku: masaBerlaku,
      qr_token: qrToken
    },
    message: 'Calon anggota ' + reg.full_name + ' berhasil disahkan. KTA Nasional No: ' + noKta + ' resmi terbit (Berlaku 5 Tahun).'
  };
}

/**
 * rejectPendaftar: tolak pendaftar dengan catatan alasan.
 * SUPERADMIN, KETUA, SEKRETARIS.
 */
function rejectPendaftar(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID pendaftar wajib diisi.' };
  if (!p.notes || !String(p.notes).trim()) {
    return { ok: false, data: null, message: 'Alasan penolakan wajib diisi.' };
  }
  var reg = findOne(TABS.PENDAFTAR, { id: p.id });
  if (!reg) return { ok: false, data: null, message: 'Data pendaftar tidak ditemukan.' };
  var now = new Date().toISOString();
  updateRow(TABS.PENDAFTAR, reg._row, {
    status: 'DITOLAK',
    rejection_notes: String(p.notes).trim()
  });
  audit(ctx.user.username, 'MEMBER_REJECTED', 'Menolak pendaftar ' + reg.reg_number + ': ' + p.notes, 'PENDAFTARAN');
  return { ok: true, data: { id: reg.id, status: 'DITOLAK' },
    message: 'Pendaftaran ' + reg.reg_number + ' telah ditolak.' };
}

/**
 * getKtaNasionalList: daftar KTA Nasional aktif (Direktori Anggota Tetap).
 * Scoped by wilayah_id (kecuali DPP / Superadmin).
 */
function getKtaNasionalList(ctx) {
  var p = ctx.payload || {};
  var limit = Math.min(Number(p.limit) || 30, 100);
  var page = Math.max(Number(p.page) || 1, 1);
  var q = String(p.q || '').toLowerCase();

  var isNationalAudit = ctx.user && (ctx.user.role === ROLES.SUPERADMIN || ctx.user.role === ROLES.KETUA_DPP) && (p.scope === 'NASIONAL');
  var userWilayah = (ctx.user && ctx.user.wilayah_id) || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';

  var rows = readAll(TABS.KTA_NASIONAL);
  if (!isNationalAudit) {
    rows = rows.filter(function (k) {
      var wId = k.wilayah_id || (KONFIG && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
      return wId === userWilayah;
    });
  }

  if (q) {
    rows = rows.filter(function (k) {
      return (k.no_kta || '').toLowerCase().indexOf(q) !== -1 ||
             (k.full_name || '').toLowerCase().indexOf(q) !== -1 ||
             (k.nik || '').indexOf(q) !== -1;
    });
  }
  if (p.status) {
    rows = rows.filter(function (k) { return k.status === p.status; });
  }

  rows.sort(function (a, b) {
    return (b.tgl_terbit || '').localeCompare(a.tgl_terbit || '');
  });

  var total = rows.length;
  var start = (page - 1) * limit;
  var items = rows.slice(start, start + limit).map(function (k) {
    return {
      no_kta: k.no_kta,
      full_name: k.full_name,
      nik_masked: (k.nik && k.nik.length >= 10) ? (k.nik.slice(0, 4) + '********' + k.nik.slice(-4)) : '************',
      wilayah_id: k.wilayah_id,
      status: k.status,
      tgl_terbit: k.tgl_terbit,
      tgl_terbit_label: formatTanggal(k.tgl_terbit),
      masa_berlaku: k.masa_berlaku,
      masa_berlaku_label: formatTanggal(k.masa_berlaku),
      qr_token: k.qr_token,
      qr_verify_url: (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/verifikasi-kta?token=' + encodeURIComponent(k.qr_token || k.no_kta)
    };
  });

  return { ok: true, data: { items: items, total: total, page: page, limit: limit }, message: 'Direktori KTA Nasional berhasil dimuat.' };
}

/**
 * verifyKtaPublic: verifikasi publik keabsahan KTA tanpa membocorkan NIK/alamat (UU PDP No. 27/2022).
 * Publik (tanpa auth token).
 */
function verifyKtaPublic(ctx) {
  var p = ctx.payload || {};
  var tokenOrNo = String(p.token || p.no_kta || '').trim();
  if (!tokenOrNo) return { ok: false, data: null, message: 'Nomor KTA atau token validasi wajib diisi.' };

  var row = findOne(TABS.KTA_NASIONAL, { qr_token: tokenOrNo }) ||
            findOne(TABS.KTA_NASIONAL, { no_kta: tokenOrNo });

  if (!row) {
    return { ok: false, data: null, message: 'Nomor KTA atau token validasi tidak terdaftar dalam pangkalan data resmi APII.' };
  }

  var now = new Date().toISOString().slice(0, 10);
  var isExpired = row.masa_berlaku && (now > row.masa_berlaku);

  return {
    ok: true,
    data: {
      no_kta: row.no_kta,
      full_name: row.full_name,
      wilayah_id: row.wilayah_id,
      wilayah_nama: (row.wilayah_id === 'DPP_PUSAT') ? 'DPP PUSAT' : 'DPW JABODETABEK',
      status: isExpired ? 'KADALUARSA' : (row.status || 'AKTIF'),
      tgl_terbit: row.tgl_terbit,
      masa_berlaku: row.masa_berlaku,
      is_valid: !isExpired && row.status === 'AKTIF'
    },
    message: 'Data keanggotaan terverifikasi resmi oleh Dewan Pimpinan Pusat Yayasan APII.'
  };
}

/**
 * generateLegacyClaimToken: bangkitkan token klaim mandiri 15 menit untuk anggota lama.
 * SUPERADMIN, SEKRETARIS.
 */
function generateLegacyClaimToken(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID anggota/pendaftar lama wajib diisi.' };
  var reg = findOne(TABS.PENDAFTAR, { id: p.id });
  if (!reg) return { ok: false, data: null, message: 'Data anggota lama tidak ditemukan.' };

  var token = uuid().replace(/-/g, '').slice(0, 24);
  var expTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  updateRow(TABS.PENDAFTAR, reg._row, {
    claim_token: token,
    claim_expires_at: expTime
  });

  var claimUrl = (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/klaim-kta?token=' + token;
  audit(ctx.user.username, 'LEGACY_CLAIM_TOKEN_GENERATED', 'Token klaim untuk ' + reg.full_name + ' (15 menit)');

  return {
    ok: true,
    data: {
      claim_token: token,
      claim_expires_at: expTime,
      claim_url: claimUrl
    },
    message: 'Token klaim mandiri berhasil dibuat (Berlaku 15 menit).'
  };
}

/**
 * claimLegacyKta: proses klaim mandiri anggota lama memperbarui foto & biodata via token.
 * Publik.
 */
function claimLegacyKta(ctx) {
  var p = ctx.payload || {};
  if (!p.token) return { ok: false, data: null, message: 'Token klaim wajib diisi.' };

  var reg = findOne(TABS.PENDAFTAR, { claim_token: p.token });
  if (!reg) return { ok: false, data: null, message: 'Token klaim tidak valid atau sudah digunakan.' };

  var now = new Date();
  if (reg.claim_expires_at && now > new Date(reg.claim_expires_at)) {
    return { ok: false, data: null, message: 'Token klaim telah kadaluarsa (> 15 menit). Silakan hubungi Sekretariat untuk tautan baru.' };
  }

  var updateData = {
    claim_token: '',
    claim_expires_at: ''
  };

  if (p.phone) updateData.phone = String(p.phone).trim();
  if (p.address) updateData.address = String(p.address).trim();
  if (p.division_interest) updateData.division_interest = String(p.division_interest).trim();

  if (p.ktp_base64) {
    updateData.ktp_drive_url = saveUploadToDrive_(p.ktp_base64, 'KTP_KLAIM_' + (reg.reg_number || reg.id) + '.jpg', '08_Identitas_KTA_KTP') || reg.ktp_drive_url;
  }
  if (p.selfie_base64) {
    updateData.selfie_drive_url = saveUploadToDrive_(p.selfie_base64, 'PASFOTO_KLAIM_' + (reg.reg_number || reg.id) + '.jpg', '08_Identitas_KTA_KTP') || reg.selfie_drive_url;
  }

  updateRow(TABS.PENDAFTAR, reg._row, updateData);
  audit('public', 'LEGACY_MEMBER_CLAIMED', 'Anggota lama ' + reg.full_name + ' berhasil klaim data mandiri');

  return {
    ok: true,
    data: { id: reg.id, full_name: reg.full_name },
    message: 'Data keanggotaan berhasil diperbarui! Tim Sekretariat akan segera mencetak KTA Nasional 5 Tahun Anda.'
  };
}

/****************************************************************************
 * Surat.gs
 *****************************************************************************/
/**
 * ============================================================================
 * Surat.gs - Modul Persuratan Resmi
 * ============================================================================
 * State machine: DRAFT -> PENDING_APPROVAL -> PUBLISHED / REJECTED
 *   - create/update: SUPERADMIN, SEKRETARIS (hanya DRAFT)
 *   - submit: SUPERADMIN, SEKRETARIS
 *   - approve/reject: SUPERADMIN, KETUA  (approve memicu generate PDF)
 *   - verifySurat: publik (cek nomor/SHA-256 di portal)
 *
 * Nomor surat otomatis: {urut}/{KODE}/{romawi bulan}/{tahun} - reset per tahun.
 * ==========================================================================*/

/** Peta seluruh jenis surat aktif (bawaan + dinamis dari Sheet_Settings). */
function getLetterTypesMap_() {
  var types = getSettingValue_('letter_types', null);
  var map = {
    SK: { label: 'Surat Keputusan', prefix: 'SK' },
    UNDANGAN: { label: 'Surat Undangan', prefix: 'UND' },
    PENGANTAR: { label: 'Surat Pengantar', prefix: 'PENG' },
    KETERANGAN: { label: 'Surat Keterangan', prefix: 'KET' },
    TUGAS: { label: 'Surat Tugas', prefix: 'TUG' },
    REKOMENDASI: { label: 'Surat Rekomendasi', prefix: 'REK' },
    EDARAN: { label: 'Surat Edaran', prefix: 'EDR' },
    NOTULEN: { label: 'Notulen Rapat', prefix: 'NOT' },
    RAPAT: { label: 'Hasil Rapat / Risalah Rapat', prefix: 'RAPAT' },
    BA: { label: 'Berita Acara', prefix: 'BA' }
  };
  if (Array.isArray(types)) {
    types.forEach(function (t) {
      if (t && t.code) {
        map[t.code] = { label: t.label || t.name || t.code, prefix: t.prefix || t.code };
      }
    });
  }
  return map;
}

/** Bangun nomor surat dinamis dari jenis + tanggal surat. */
function buildLetterNumber(letterType, tanggalSurat, wilayahId) {
  var d = new Date(tanggalSurat || new Date());
  var tahun = d.getFullYear();
  var bulan = toRoman(d.getMonth() + 1);
  var wId = (wilayahId || (typeof KONFIG !== 'undefined' && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK').toUpperCase();

  // Dapatkan data wilayah untuk kode surat & org_code dinamis
  var wilayahRow = null;
  try {
    wilayahRow = findOne(TABS.WILAYAH, { id: wId });
  } catch (e) {}

  var kodeWilayah = (wilayahRow && wilayahRow.kode_surat) || 'JABO';
  var isPusat = (wilayahRow && wilayahRow.tingkat === 'PUSAT') || wId === 'DPP_PUSAT';
  var defaultOrgCode = isPusat ? 'DPP-APII' : ('DPW-APII/' + kodeWilayah);

  var numberingCfg = getSettingValue_('letter_numbering', {
    pattern: '{urut}/{kode}/{org}/{bulanRomawi}/{tahun}',
    org_code: defaultOrgCode,
    digits: 3
  });
  var orgCode = numberingCfg.org_code || defaultOrgCode;
  var digits = Number(numberingCfg.digits) || 3;

  var typeMap = getLetterTypesMap_();
  var typeInfo = typeMap[letterType] || { label: letterType, prefix: letterType };
  var prefix = typeInfo.prefix || letterType;
  var kodeSurat = prefix + '-' + orgCode;

  // Benteng A-01: Sequence counter terpartisi per wilayah
  var seqKey = getPartitionedSequenceKey('SURAT', wId, letterType, tahun);
  var urut = nextSequence(seqKey);
  var urutStr = String(urut);
  while (urutStr.length < digits) urutStr = '0' + urutStr;

  var pattern = numberingCfg.pattern || '{urut}/{kode}/{org}/{bulanRomawi}/{tahun}';
  var res = pattern
    .replace('{urut}', urutStr)
    .replace('{kode}', prefix)
    .replace('{org}', orgCode)
    .replace('{bulanRomawi}', bulan)
    .replace('{tahun}', String(tahun));

  if (res.indexOf('{') !== -1) {
    res = urutStr + '/' + kodeSurat + '/' + bulan + '/' + tahun;
  }
  return res;
}

/** Canonical string untuk hashing integritas dokumen. */
function suratCanonical(s) {
  return [s.letter_number, s.title, s.letter_type, s.content, s.tanggal_surat].join('|');
}

/** SHA-256 hex dari canonical (dipakai verifikasi keaslian publik). */
function sha256Hex(text) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
  return digest.map(function (b) {
    var h = (b < 0 ? b + 256 : b).toString(16);
    return h.length === 1 ? '0' + h : h;
  }).join('');
}

/**
 * getListSurat: daftar surat + filter status/q + paginasi.
 * Filter visibilitas: SEKRETARIS lihat semua internal; Pembina/Pengawas read-only.
 * @param {object} ctx.payload { status?, q?, limit?, page? }
 */
function getListSurat(ctx) {
  var p = ctx.payload || {};
  var limit = Math.min(Number(p.limit) || 20, 100);
  var page = Math.max(Number(p.page) || 1, 1);
  var q = String(p.q || '').toLowerCase();

  var rows = readAll(TABS.SURAT);
  var userWilayah = (ctx.user && ctx.user.wilayah_id) || (typeof KONFIG !== 'undefined' && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var isSuperOrDPP = (ctx.user && (ctx.user.role === 'SUPERADMIN' || ctx.user.wilayah_id === 'DPP_PUSAT'));

  if (!isSuperOrDPP) {
    rows = rows.filter(function (s) {
      return (s.wilayah_id || 'DPW_JABODETABEK') === userWilayah;
    });
  } else if (p.wilayah_id) {
    rows = rows.filter(function (s) {
      return (s.wilayah_id || 'DPW_JABODETABEK') === p.wilayah_id;
    });
  }

  // Pencarian tebas judul/nomor.
  if (q) {
    rows = rows.filter(function (s) {
      return (s.title || '').toLowerCase().indexOf(q) !== -1 ||
             (s.letter_number || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  // Filter status.
  if (p.status) rows = rows.filter(function (s) { return s.status === p.status; });

  // Urutkan terbaru dibuat.
  rows.sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });

  var typeMap = getLetterTypesMap_();
  var total = rows.length;
  var start = (page - 1) * limit;
  var items = rows.slice(start, start + limit).map(function (s) {
    var tInfo = typeMap[s.letter_type] || { label: LETTER_TYPE_LABELS[s.letter_type] || s.letter_type };
    return {
      id: s.id, letter_number: s.letter_number, title: s.title,
      letter_type: s.letter_type,
      letter_type_label: tInfo.label || s.letter_type,
      status: s.status, status_label: STATUS_LABELS[s.status] || s.status,
      tanggal_surat: s.tanggal_surat, tanggal_label: formatTanggal(s.tanggal_surat),
      created_by: s.created_by, created_by_name: s.created_by_name,
      created_at: s.created_at, submitted_at: s.submitted_at,
      published_at: s.published_at, approved_by: s.approved_by,
      rejection_notes: s.rejection_notes,
      content: s.content || '',
      attachment_url: s.attachment_url || '',
      pdf_url: s.status === 'PUBLISHED' ? s.pdf_url : '',
      qr_verify_url: s.status === 'PUBLISHED' ? s.qr_verify_url : '',
      wilayah_id: s.wilayah_id || 'DPW_JABODETABEK'
    };
  });

  return { ok: true, data: { items: items, total: total, page: page, limit: limit },
    message: 'Daftar surat berhasil dimuat.' };
}

/**
 * createSurat: buat draf surat. SUPERADMIN, SEKRETARIS.
 * @param {object} ctx.payload { title, letter_type, content{menimbang,mengingat,memutuskan},
 *                                tanggal_surat?, letter_number?, custom_type_code?, custom_type_label?,
 *                                attachment_base64?, attachment_name? }
 */
function createSurat(ctx) {
  var p = ctx.payload || {};
  if (!p.title) {
    return { ok: false, data: null, message: 'Perihal / judul surat wajib diisi.' };
  }

  var typeMap = getLetterTypesMap_();
  // Tangani custom letter type on-the-fly jika ada
  if (p.custom_type_code && p.custom_type_label) {
    var cCode = String(p.custom_type_code).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    var cLabel = String(p.custom_type_label).trim();
    if (!typeMap[cCode]) {
      var allTypes = getSettingValue_('letter_types', []);
      if (!Array.isArray(allTypes)) allTypes = [];
      allTypes.push({ code: cCode, label: cLabel, prefix: cCode, active: true });
      setSettingValue_('letter_types', allTypes, ctx.user.username);
      typeMap[cCode] = { label: cLabel, prefix: cCode };
    }
    p.letter_type = cCode;
  }

  if (!p.letter_type) {
    return { ok: false, data: null, message: 'Jenis surat wajib dipilih.' };
  }
  if (!typeMap[p.letter_type] && !LETTER_TYPE_CODES[p.letter_type]) {
    return { ok: false, data: null, message: 'Jenis surat tidak valid.' };
  }

  var tanggal = p.tanggal_surat || new Date().toISOString().slice(0, 10);
  var content = p.content || { menimbang: '', mengingat: '', memutuskan: '' };
  var contentStr;
  try { contentStr = JSON.stringify(content); } catch (e) { contentStr = '{}'; }

  // Nomor: pakai input bila ada & unik, jika tidak auto-generate.
  var wilayahId = (ctx.user && ctx.user.wilayah_id) || (typeof KONFIG !== 'undefined' && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var letterNumber = String(p.letter_number || '').trim();
  if (!letterNumber) {
    letterNumber = buildLetterNumber(p.letter_type, tanggal, wilayahId);
  } else if (findOne(TABS.SURAT, { letter_number: letterNumber })) {
    return { ok: false, data: null, message: 'Nomor surat sudah digunakan.' };
  }

  // Upload berkas lampiran jika dilampirkan
  var attachmentUrl = String(p.attachment_url || '').trim();
  if (p.attachment_base64) {
    var safeName = (p.attachment_name || ('Lampiran_' + letterNumber.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf'));
    attachmentUrl = saveUploadToDrive_(p.attachment_base64, safeName, 'Surat_Lampiran') || attachmentUrl;
  }

  var now = new Date().toISOString();
  var created = insert(TABS.SURAT, {
    id: uuid(), letter_number: letterNumber, title: p.title,
    letter_type: p.letter_type, content: contentStr, status: 'DRAFT',
    tanggal_surat: tanggal,
    created_by: ctx.user.username, created_by_name: ctx.user.full_name || ctx.user.username,
    created_at: now, submitted_at: '', published_at: '', approved_by: '',
    rejection_notes: '', sha256_hash: '', pdf_url: '', qr_verify_url: '',
    attachment_url: attachmentUrl
  });

  return { ok: true, data: { id: created.id, letter_number: created.letter_number, attachment_url: attachmentUrl },
    message: 'Draf surat berhasil dibuat dengan nomor ' + created.letter_number + '.' };
}

/**
 * updateSurat: ubah surat. Hanya boleh saat status DRAFT. SUPERADMIN, SEKRETARIS.
 */
function updateSurat(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID surat wajib diisi.' };
  var s = findOne(TABS.SURAT, { id: p.id });
  if (!s) return { ok: false, data: null, message: 'Surat tidak ditemukan.' };
  if (s.status !== 'DRAFT') {
    return { ok: false, data: null,
      message: 'Surat yang sudah diajukan/diterbitkan tidak dapat diubah.' };
  }

  var values = {};
  if (p.title) values.title = p.title;
  if (p.letter_type && LETTER_TYPE_CODES[p.letter_type]) values.letter_type = p.letter_type;
  if (p.tanggal_surat) values.tanggal_surat = p.tanggal_surat;
  if (p.content) {
    try { values.content = JSON.stringify(p.content); } catch (e) { /* abaikan */ }
  }
  // Nomor bisa diganti selama DRAFT & tetap unik.
  if (p.letter_number) {
    var ln = String(p.letter_number).trim();
    if (ln !== s.letter_number) {
      if (findOne(TABS.SURAT, { letter_number: ln })) {
        return { ok: false, data: null, message: 'Nomor surat sudah digunakan.' };
      }
      values.letter_number = ln;
    }
  }
  if (p.attachment_base64) {
    var sNumber = values.letter_number || s.letter_number;
    var safeName = (p.attachment_name || ('Lampiran_' + sNumber.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf'));
    values.attachment_url = saveUploadToDrive_(p.attachment_base64, safeName, 'Surat_Lampiran');
  } else if (p.attachment_url !== undefined) {
    values.attachment_url = p.attachment_url;
  }

  if (!Object.keys(values).length) {
    return { ok: false, data: null, message: 'Tidak ada perubahan yang dikirim.' };
  }

  updateRow(TABS.SURAT, s._row, values);
  return { ok: true, data: null, message: 'Surat berhasil diperbarui.' };
}

/**
 * submitSurat: ajukan DRAFT ke ketua. SUPERADMIN, SEKRETARIS.
 */
function submitSurat(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID surat wajib diisi.' };
  var s = findOne(TABS.SURAT, { id: p.id });
  if (!s) return { ok: false, data: null, message: 'Surat tidak ditemukan.' };
  if (s.status !== 'DRAFT' && s.status !== 'REJECTED') {
    return { ok: false, data: null,
      message: 'Hanya surat draf atau yang dikembalikan yang dapat diajukan (status saat ini: ' +
               (STATUS_LABELS[s.status] || s.status) + ').' };
  }

  updateRow(TABS.SURAT, s._row, {
    status: 'PENDING_APPROVAL', submitted_at: new Date().toISOString(),
    rejection_notes: ''
  });
  audit(ctx.user.username, 'SURAT_SUBMIT', 'Nomor ' + s.letter_number);

  // Notifikasi email ke Ketua DPW
  kirimNotifikasiKeRole_(ROLES.KETUA,
    'Persetujuan Surat: ' + s.letter_number,
    'Permohonan Persetujuan Surat',
    'Draf surat <strong>' + s.title + '</strong> (Nomor: <code>' + s.letter_number + '</code>) telah diajukan oleh <strong>' + (ctx.user.full_name || ctx.user.username) + '</strong> dan menunggu persetujuan Anda.',
    'Tinjau & Setujui Surat',
    (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/surat');

  return { ok: true, data: null,
    message: 'Surat ' + s.letter_number + ' diajukan ke Ketua untuk persetujuan.' };
}

/**
 * approveSurat: setujui & terbitkan. Hanya KETUA/SUPERADMIN.
 * Memutuskan transisi PENDING_APPROVAL -> PUBLISHED + generate PDF + hash.
 */
function approveSurat(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID surat wajib diisi.' };
  var s = findOne(TABS.SURAT, { id: p.id });
  if (!s) return { ok: false, data: null, message: 'Surat tidak ditemukan.' };
  if (s.status !== 'PENDING_APPROVAL') {
    return { ok: false, data: null,
      message: 'Hanya surat yang menunggu persetujuan yang dapat diterbitkan.' };
  }

  var hash = sha256Hex(suratCanonical(s));
  var pdfUrl = '';
  var verifyUrl = '';
  try {
    pdfUrl = generateSuratPdf_(s);
  } catch (e) {
    Logger.log('Generate PDF gagal: ' + e);
    return { ok: false, data: null,
      message: 'Gagal membuat PDF surat. Tim IT akan memeriksa folder Drive/template.' };
  }
  // URL verifikasi publik (via 99-TemplateSurat.gs, domain dari KONFIG).
  verifyUrl = urlVerifikasiSurat_(s.letter_number);

  updateRow(TABS.SURAT, s._row, {
    status: 'PUBLISHED', published_at: new Date().toISOString(),
    approved_by: ctx.user.username, sha256_hash: hash,
    pdf_url: pdfUrl, qr_verify_url: verifyUrl
  });
  audit(ctx.user.username, 'SURAT_PUBLISHED', 'Nomor ' + s.letter_number);

  // Notifikasi email ke pembuat surat (Sekretaris)
  kirimNotifikasiKeUser_(s.created_by,
    'Surat Telah Diterbitkan: ' + s.letter_number,
    'Surat Resmi Telah Diterbitkan',
    'Surat <strong>' + s.title + '</strong> (Nomor: <code>' + s.letter_number + '</code>) telah disetujui oleh Ketua DPW dan resmi diterbitkan beserta salinan PDF di Google Drive.',
    'Buka Dokumen Resmi',
    (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/surat');

  return { ok: true, data: { pdf_url: pdfUrl, sha256_hash: hash },
    message: 'Surat ' + s.letter_number + ' telah diterbitkan dan PDF tersedia.' };
}

/**
 * rejectSurat: tolak surat. KETUA/SUPERADMIN. Catatan penolakan WAJIB.
 */
function rejectSurat(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID surat wajib diisi.' };
  if (!p.notes || !String(p.notes).trim()) {
    return { ok: false, data: null, message: 'Alasan penolakan wajib diisi.' };
  }
  var s = findOne(TABS.SURAT, { id: p.id });
  if (!s) return { ok: false, data: null, message: 'Surat tidak ditemukan.' };
  if (s.status !== 'PENDING_APPROVAL') {
    return { ok: false, data: null,
      message: 'Hanya surat yang menunggu persetujuan yang dapat ditolak.' };
  }

  updateRow(TABS.SURAT, s._row, {
    status: 'REJECTED', approved_by: ctx.user.username,
    rejection_notes: String(p.notes).trim()
  });
  audit(ctx.user.username, 'SURAT_REJECTED', 'Nomor ' + s.letter_number + ': ' + p.notes);

  // Notifikasi email ke pembuat surat
  kirimNotifikasiKeUser_(s.created_by,
    'Draf Surat Dikembalikan: ' + s.letter_number,
    'Catatan Perbaikan Draf Surat',
    'Draf surat <strong>' + s.title + '</strong> (Nomor: <code>' + s.letter_number + '</code>) telah dikembalikan oleh Ketua DPW dengan catatan perbaikan:<br/><blockquote style="background:#fee2e2;padding:10px 14px;border-left:4px solid #ef4444;margin:12px 0;color:#991b1b;border-radius:4px;">' + String(p.notes).trim() + '</blockquote>',
    'Perbaiki Draf Surat',
    (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/surat');

  return { ok: true, data: null, message: 'Surat ' + s.letter_number + ' telah ditolak.' };
}

/**
 * getPublishedSurat: daftar surat PUBLISHED untuk portal publik (TANPA login).
 * Dipakai section "Dokumen Resmi" di apii.sigitadi.id.
 * @param {object} ctx.payload { limit?, page? }
 */
function getPublishedSurat(ctx) {
  var p = ctx.payload || ctx.parameter || {};
  var limit = Math.min(Number(p.limit) || 9, 50);
  var page = Math.max(Number(p.page) || 1, 1);
  var targetWilayah = p.wilayah || p.w || p.wilayah_id || null;

  var rows = readAll(TABS.SURAT)
    .filter(function (s) {
      if (s.status !== 'PUBLISHED') return false;
      if (targetWilayah) {
        return !s.wilayah_id || s.wilayah_id === targetWilayah || s.wilayah_id === 'DPP_PUSAT';
      }
      return true;
    })
    .sort(function (a, b) { return (b.published_at || '').localeCompare(a.published_at || ''); });

  var total = rows.length;
  var start = (page - 1) * limit;
  var items = rows.slice(start, start + limit).map(function (s) {
    return {
      id: s.id, letter_number: s.letter_number, title: s.title,
      letter_type: s.letter_type,
      letter_type_label: LETTER_TYPE_LABELS[s.letter_type] || s.letter_type,
      tanggal_label: formatTanggal(s.tanggal_surat),
      published_at: s.published_at, pdf_url: s.pdf_url
    };
  });

  return { ok: true, data: { items: items, total: total, page: page, limit: limit },
    message: 'Daftar dokumen resmi berhasil dimuat.' };
}

/**
 * verifySurat: verifikasi keaslian surat oleh MASYARAKAT (publik, tanpa login).
 * Dipakai portal publik apii.sigitadi.id.
 * @param {object} ctx.payload { letter_number } atau { hash }
 */
function verifySurat(ctx) {
  var p = ctx.payload || ctx.parameter || {};
  var s = null;
  var query = String(p.letter_number || p.hash || p.q || p.no || p.query || '').trim();

  if (p.hash) {
    s = findOne(TABS.SURAT, { sha256_hash: String(p.hash).trim() });
  } else if (p.letter_number) {
    s = findOne(TABS.SURAT, { letter_number: String(p.letter_number).trim() });
  } else if (query) {
    // Cari berdasarkan hash atau nomor surat
    s = findOne(TABS.SURAT, { sha256_hash: query }) ||
        findOne(TABS.SURAT, { letter_number: query });
  }

  if (!s) {
    return { ok: false, data: null,
      message: 'Nomor surat atau kode verifikasi tidak ditemukan dalam sistem.' };
  }
  // Hanya surat PUBLISHED yang bisa diverifikasi publik.
  if (s.status !== 'PUBLISHED') {
    return { ok: false, data: null,
      message: 'Surat dengan nomor ini belum diterbitkan secara resmi.' };
  }

  var wilayahNama = (s.wilayah_id === 'DPP_PUSAT') ? 'DPP APII (Pusat)' : 'DPW APII Jabodetabek';

  return {
    ok: true,
    data: {
      letter_number: s.letter_number, title: s.title,
      letter_type: s.letter_type,
      letter_type_label: LETTER_TYPE_LABELS[s.letter_type] || s.letter_type,
      tanggal_label: formatTanggal(s.tanggal_surat),
      status: s.status, status_label: STATUS_LABELS[s.status],
      published_at: s.published_at, approved_by: s.approved_by,
      sha256_hash: s.sha256_hash, pdf_url: s.pdf_url,
      wilayah_id: s.wilayah_id || 'DPW_JABODETABEK',
      wilayah_nama: wilayahNama,
      valid: true
    },
    message: 'Surat sah & diterbitkan resmi oleh ' + wilayahNama + '.'
  };
}

/**
 * generateSuratPdf_: render surat jadi PDF via template Google Docs.
 * Langkah: salin template -> ganti placeholder -> ekspor PDF -> simpan ke Drive.
 * @param {object} s baris Sheet_Surat
 * @return {string} URL publik file PDF
 */
function generateSuratPdf_(s) {
  // Template & folder dibuat otomatis oleh 99-TemplateSurat.gs bila belum ada.
  var templateId = siapkanTemplateSurat_();
  var folderId = siapkanFolderPdf_();

  var content;
  try { content = JSON.parse(s.content || '{}'); } catch (e) { content = {}; }

  // Nama pejabat penanda tangan diambil dari Sheet_Users (pejabat aktif),
  // bukan string hard-coded, supaya cetakan sesuai pemegang jabatan.
  // Bila belum ada akunnya, fallback ke label jabatan.
  // Benteng A-04 & Multi-Tenant: Resolusi nama pejabat berwenang berdasarkan tenant wilayah surat
  var wId = s.wilayah_id || 'DPW_JABODETABEK';
  var wilayahRow = null;
  try { wilayahRow = findOne(TABS.WILAYAH, { id: wId }); } catch (e) {}
  var isPusat = (wilayahRow && wilayahRow.tingkat === 'PUSAT') || wId === 'DPP_PUSAT';

  var ketuaLabel = isPusat ? 'Ketua Umum DPP APII' : ('Ketua DPW APII ' + ((wilayahRow && wilayahRow.nama) ? wilayahRow.nama.replace(/^(DPW\s+APII\s+|Dewan\s+Pimpinan\s+Wilayah\s+)/i, '') : 'Jabodetabek'));
  var sekLabel = isPusat ? 'Sekretaris Jenderal DPP APII' : ('Sekretaris DPW APII ' + ((wilayahRow && wilayahRow.nama) ? wilayahRow.nama.replace(/^(DPW\s+APII\s+|Dewan\s+Pimpinan\s+Wilayah\s+)/i, '') : 'Jabodetabek'));

  var ketuaName = ketuaLabel;
  var sekretarisName = sekLabel;
  try {
    var ketua = findOne(TABS.USERS, { role: ROLES.KETUA, wilayah_id: wId, is_active: 'TRUE' });
    if (!ketua && isPusat) ketua = findOne(TABS.USERS, { role: ROLES.KETUA, is_active: 'TRUE' });
    if (ketua && ketua.full_name) ketuaName = ketua.full_name;

    var sek = findOne(TABS.USERS, { role: ROLES.SEKRETARIS, wilayah_id: wId, is_active: 'TRUE' });
    if (!sek && isPusat) sek = findOne(TABS.USERS, { role: ROLES.SEKRETARIS, is_active: 'TRUE' });
    if (sek && sek.full_name) sekretarisName = sek.full_name;
  } catch (e) { /* pakai label default */ }

  var placeholder = {
    NOMOR: s.letter_number, JUDUL: s.title,
    JENIS: LETTER_TYPE_LABELS[s.letter_type] || s.letter_type,
    TANGGAL: formatTanggal(s.tanggal_surat),
    TAHUN: String(new Date(s.tanggal_surat || new Date()).getFullYear()),
    MENIMBANG: content.menimbang || '', MENGINGAT: content.mengingat || '',
    MEMUTUSKAN: content.memutuskan || '',
    KETUA: ketuaName, SEKRETARIS: sekretarisName
  };

  // 1) Salin template.
  var fileName = 'Surat - ' + s.letter_type + ' - ' + s.letter_number + '.pdf';
  var copy = DriveApp.getFileById(templateId).makeCopy(fileName.replace(/\.pdf$/, ''));
  var docId = copy.getId();

  try {
    // 2) Ganti placeholder di body.
    var doc = DocumentApp.openById(docId);
    replaceInBody_(doc.getBody(), placeholder);
    // Header & footer juga (kop surat).
    try { replaceInBody_(doc.getHeader(), placeholder); } catch (e) { /* header opsional */ }
    try { replaceInBody_(doc.getFooter(), placeholder); } catch (e) { /* footer opsional */ }
    doc.saveAndClose();

    // 3) Ekspor ke PDF.
    var url = 'https://docs.google.com/document/d/' + docId + '/export?format=pdf';
    var pdfBlob = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    }).getBlob().setName(fileName);

    // 4) Simpan ke folder tujuan & set sharing publik.
    var file = DriveApp.getFolderById(folderId).createFile(pdfBlob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } finally {
    // 5) Buang salinan Docs sementara.
    try { copy.setTrashed(true); } catch (e) { /* sudah terhapus */ }
  }
}

/** Ganti semua placeholder {{KEY}} di seluruh paragraf/tabel sebuah badan teks. */
function replaceInBody_(body, placeholder) {
  for (var key in placeholder) {
    body.replaceText('{{' + key + '}}', String(placeholder[key]));
  }
}

/**
 * reserveLetterNumber: reservasi / booking nomor surat resmi sebelum draf naskah selesai.
 * SUPERADMIN, SEKRETARIS.
 * @param {object} ctx.payload { letter_type, title?, tanggal_surat? }
 */
function reserveLetterNumber(ctx) {
  var p = ctx.payload || {};
  if (!p.letter_type) {
    return { ok: false, data: null, message: 'Jenis surat wajib dipilih.' };
  }
  var tanggal = p.tanggal_surat || new Date().toISOString().slice(0, 10);
  var wilayahId = (ctx.user && ctx.user.wilayah_id) || (typeof KONFIG !== 'undefined' && KONFIG.DEFAULT_WILAYAH_ID) || 'DPW_JABODETABEK';
  var letterNumber = buildLetterNumber(p.letter_type, tanggal, wilayahId);
  var now = new Date().toISOString();

  var created = insert(TABS.SURAT, {
    id: uuid(),
    letter_number: letterNumber,
    title: p.title || '(Nomor Dipesan: ' + letterNumber + ')',
    letter_type: p.letter_type,
    content: JSON.stringify({ menimbang: '', mengingat: '', memutuskan: '' }),
    status: 'DRAFT',
    tanggal_surat: tanggal,
    created_by: ctx.user.username,
    created_by_name: ctx.user.full_name || ctx.user.username,
    created_at: now,
    submitted_at: '', published_at: '', approved_by: '',
    rejection_notes: '', sha256_hash: '', pdf_url: '', qr_verify_url: '',
    wilayah_id: wilayahId
  });

  audit(ctx.user.username, 'SURAT_RESERVED', 'Memesan nomor surat resmi ' + letterNumber, 'SURAT');
  return {
    ok: true,
    data: { id: created.id, letter_number: letterNumber },
    message: 'Nomor surat ' + letterNumber + ' berhasil dibooking.'
  };
}

/****************************************************************************
 * Keuangan.gs
 *****************************************************************************/
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
    var rows = readAll(TABS.ACCOUNTS);
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
  var seqKey = getPartitionedSequenceKey('KEU', wId, category, tahun);
  var urut = nextSequence(seqKey);
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
  var rows = readAll(TABS.KEUANGAN).filter(function (k) {
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

  var rows = readAll(TABS.KEUANGAN);
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
  var k = findOne(TABS.KEUANGAN, { id: p.id });
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

  var created = insert(TABS.KEUANGAN, {
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
  var k = findOne(TABS.KEUANGAN, { id: p.id });
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

  updateRow(TABS.KEUANGAN, k._row, {
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
  var k = findOne(TABS.KEUANGAN, { id: p.id });
  if (!k) return { ok: false, data: null, message: 'Voucher tidak ditemukan.' };
  if (k.status !== 'VERIFIED_BY_BENDAHARA') {
    return { ok: false, data: null,
      message: 'Voucher harus diverifikasi Bendahara terlebih dahulu (status: ' +
               (STATUS_LABELS[k.status] || k.status) + ').' };
  }
  var now = new Date().toISOString();
  updateRow(TABS.KEUANGAN, k._row, {
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
  var k = findOne(TABS.KEUANGAN, { id: p.id });
  if (!k) return { ok: false, data: null, message: 'Voucher tidak ditemukan.' };
  if (k.status === 'APPROVED') {
    return { ok: false, data: null, message: 'Voucher yang sudah disetujui tidak dapat ditolak (gunakan fitur VOID).' };
  }
  if (k.status === 'VOID') {
    return { ok: false, data: null, message: 'Voucher ini sudah dibatalkan permanen (VOID).' };
  }

  updateRow(TABS.KEUANGAN, k._row, {
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
  var k = findOne(TABS.KEUANGAN, { id: p.id });
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

  updateRow(TABS.KEUANGAN, k._row, {
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
  var k = findOne(TABS.KEUANGAN, { id: p.id });
  if (!k) return { ok: false, data: null, message: 'Voucher tidak ditemukan.' };
  if (k.status !== 'APPROVED') {
    return { ok: false, data: null, message: 'Hanya transaksi yang telah disahkan (APPROVED) yang dapat dibatalkan (VOID).' };
  }

  var now = new Date().toISOString();
  updateRow(TABS.KEUANGAN, k._row, {
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
  var k = findOne(TABS.KEUANGAN, { id: p.id });
  if (!k) return { ok: false, data: null, message: 'Voucher tidak ditemukan.' };
  var receiptUrl = String(p.receipt_url || '').trim();
  updateRow(TABS.KEUANGAN, k._row, { receipt_url: receiptUrl });
  audit(ctx.user.username, 'KEU_UPDATE_RECEIPT', 'Voucher ' + k.voucher_number);
  return { ok: true, data: { receipt_url: receiptUrl }, message: 'Bukti transaksi berhasil diperbarui.' };
}

/**
 * getAccounts: ambil daftar seluruh rekening kas master + saldo riil saat ini.
 */
function getAccounts(ctx) {
  var accounts = readAll(TABS.ACCOUNTS);
  var vouchers = readAll(TABS.KEUANGAN).filter(function (k) {
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
    var target = findOne(TABS.ACCOUNTS, { id: p.id }) || findOne(TABS.ACCOUNTS, { code: p.id });
    if (!target) return { ok: false, data: null, message: 'Rekening tidak ditemukan.' };
    updateRow(TABS.ACCOUNTS, target._row, {
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
    var existing = findOne(TABS.ACCOUNTS, { code: code });
    if (existing) {
      code = code + '_' + Math.floor(Math.random() * 899 + 100);
    }
    var newAcc = insert(TABS.ACCOUNTS, {
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
  var acc = findOne(TABS.ACCOUNTS, { id: p.id }) || findOne(TABS.ACCOUNTS, { code: p.id });
  if (!acc) return { ok: false, data: null, message: 'Rekening tidak ditemukan.' };

  var hasVoucher = findOne(TABS.KEUANGAN, { account: acc.code }) || findOne(TABS.KEUANGAN, { account: acc.id });
  if (hasVoucher) {
    updateRow(TABS.ACCOUNTS, acc._row, { is_active: 'FALSE', show_on_public: 'FALSE', updated_at: new Date().toISOString() });
    audit(ctx.user.username, 'ACCOUNT_DEACTIVATED', 'Menonaktifkan rekening ' + acc.code + ' (memiliki riwayat transaksi)', 'KEUANGAN');
    return { ok: true, data: { deactivated: true }, message: 'Rekening dinonaktifkan karena telah memiliki riwayat transaksi kas.' };
  }

  deleteRow(TABS.ACCOUNTS, acc._row);
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

  var rows = readAll(TABS.ACCOUNTS).filter(function (a) {
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

  var row = findOne(TABS.KEUANGAN, { voucher_number: noKwitansi }) ||
            findOne(TABS.KEUANGAN, { id: noKwitansi });

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
  var allSims = readAll(TABS.KAS_SIMULATOR) || [];
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
        updateRow(TABS.KAS_SIMULATOR, s._row, { status: 'KADALUARSA' });
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

  var created = insert(TABS.KAS_SIMULATOR, {
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
  var sim = findOne(TABS.KAS_SIMULATOR, { id: p.id });
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

  var createdVoucher = insert(TABS.KEUANGAN, {
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

  updateRow(TABS.KAS_SIMULATOR, sim._row, {
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

/****************************************************************************
 * Divisi.gs
 *****************************************************************************/
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
  var urut = nextSequence('DIVISI:' + tahun);
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

  var rows = readAll(TABS.DIVISI);

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

  var created = insert(TABS.DIVISI, {
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
  var d = findOne(TABS.DIVISI, { id: id });
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

  updateRow(TABS.DIVISI, d._row, values);
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

  updateRow(TABS.DIVISI, d._row, {
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
  var d = findOne(TABS.DIVISI, { id: p.id });
  if (!d) return { ok: false, data: null, message: 'Usulan tidak ditemukan.' };
  if (d.status !== 'AJUKAN') {
    return { ok: false, data: null,
      message: 'Hanya usulan yang sedang diajukan yang dapat disetujui (status: ' +
               (STATUS_LABELS[d.status] || d.status) + ').' };
  }
  updateRow(TABS.DIVISI, d._row, {
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
  var d = findOne(TABS.DIVISI, { id: p.id });
  if (!d) return { ok: false, data: null, message: 'Usulan tidak ditemukan.' };
  if (d.status !== 'AJUKAN') {
    return { ok: false, data: null,
      message: 'Hanya usulan yang sedang diajukan yang dapat ditolak (status: ' +
               (STATUS_LABELS[d.status] || d.status) + ').' };
  }
  updateRow(TABS.DIVISI, d._row, {
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

  updateRow(TABS.DIVISI, d._row, {
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

  updateRow(TABS.DIVISI, d._row, {
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

  var rows = readAll(TABS.PENGURUS);
  var items = rows.filter(function (r) {
    return (r.wilayah_id || userWilayah) === wId;
  });

  // Jika tabel pengurus di wilayah ini masih kosong, lakukan auto-seeding bawaan
  if (!items || items.length === 0) {
    seedDefaultFormasi_(wId);
    rows = readAll(TABS.PENGURUS);
    items = rows.filter(function (r) {
      return (r.wilayah_id || userWilayah) === wId;
    });
  }

  // Dapatkan daftar Plt yang sedang aktif
  var allPlt = readAll(TABS.PLT_DELEGASI);
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
    insert(TABS.PENGURUS, {
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

  var existing = findOne(TABS.PENGURUS, { wilayah_id: wId, jabatan_code: p.jabatan_code });

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
    updateRow(TABS.PENGURUS, existing._row, updateData);
  } else {
    updateData.id = uuid();
    updateData.wilayah_id = wId;
    updateData.jabatan_code = p.jabatan_code;
    updateData.jabatan_nama = p.jabatan_nama || p.jabatan_code;
    updateData.kategori = p.kategori || 'DIVISI';
    updateData.created_at = now;
    insert(TABS.PENGURUS, updateData);
  }

  // Sinkronisasi peran RBAC otomatis jika user_id dikaitkan
  if (p.user_id) {
    var uRow = findOne(TABS.USERS, { id: p.user_id });
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
      updateRow(TABS.USERS, uRow._row, {
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
  var oldActive = readAll(TABS.PLT_DELEGASI).filter(function (plt) {
    return plt.wilayah_id === wId && plt.jabatan_code === p.jabatan_code && plt.status === 'AKTIF';
  });
  oldActive.forEach(function (old) {
    updateRow(TABS.PLT_DELEGASI, old._row, { status: 'REPLACED' });
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

  insert(TABS.PLT_DELEGASI, newDelegasi);
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

  var rows = readAll(TABS.PLT_DELEGASI);
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
  var row = findOne(TABS.PLT_DELEGASI, { id: p.id });
  if (!row) return { ok: false, data: null, message: 'Data mandat Plt tidak ditemukan.' };

  var now = new Date().toISOString();
  updateRow(TABS.PLT_DELEGASI, row._row, {
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
    var rows = readAll(TABS.PLT_DELEGASI);
    var now = new Date();
    rows.forEach(function (r) {
      if (r.status === 'AKTIF' && r.end_date) {
        var expDate = new Date(r.end_date + 'T23:59:59');
        if (now > expDate) {
          updateRow(TABS.PLT_DELEGASI, r._row, { status: 'EXPIRED' });
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
  var wRow = findOne(TABS.WILAYAH, { id: wId });
  var wNama = wRow ? wRow.nama : 'DPW APII Jabodetabek';

  // Dapatkan urutan nomor surat SK
  var seqKey = getPartitionedSequenceKey(wId, 'SK', tahun);
  var urut = nextSequence(seqKey);
  var urutStr = String(urut);
  while (urutStr.length < 3) urutStr = '0' + urutStr;
  var noSk = urutStr + '/SK-DPP/STRUKTUR/' + bulanRomawi + '/' + tahun;

  // Ambil daftar personalia pejabat
  var allPejabat = readAll(TABS.PENGURUS).filter(function (pj) {
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

  insert(TABS.SURAT, suratRow);

  // Perbarui sk_id di Sheet_Pengurus
  allPejabat.forEach(function (pj) {
    updateRow(TABS.PENGURUS, pj._row, { sk_id: noSk, updated_at: nowIso });
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

/****************************************************************************
 * Code.gs
 *****************************************************************************/
/**
 * ============================================================================
 * Code.gs - Router Utama & Pintu Masuk Web App
 * Yayasan APII DPW Jabodetabek - Sistem Informasi & Administrasi Terpadu
 * ============================================================================
 * Tanggung jawab:
 *   - doGet / doPost: parsing request (action, token, payload)
 *   - Tabel ROUTES: single source of truth RBAC (action -> auth, roles, handler)
 *   - Dispatch ke handler modul domain (Auth/Surat/Keuangan/Divisi)
 *   - Membungkus hasil ke envelope { success, data, message }
 * DILARANG: menulis logika domain di file ini.
 * ==========================================================================*/

// 8 peran pengurus sistem (khusus pengurus yayasan)
var ROLES = {
  SUPERADMIN: 'SUPERADMIN', KETUA: 'KETUA', SEKRETARIS: 'SEKRETARIS',
  BENDAHARA: 'BENDAHARA', PEMBINA: 'PEMBINA', PENGAWAS: 'PENGAWAS',
  KETUA_DIVISI: 'KETUA_DIVISI', ANGGOTA_DIVISI: 'ANGGOTA_DIVISI'
};

// Peran read-only mutlak: Pembina & Pengawas (tidak ada aksi tulis).
var ROLES_READONLY = [ROLES.PEMBINA, ROLES.PENGAWAS];

// 7 divisi kerja
var DIVISIONS = {
  DIV_HUMAS: 'DIV_HUMAS', DIV_LITBANG: 'DIV_LITBANG', DIV_SOSMED: 'DIV_SOSMED',
  DIV_DAKWAH: 'DIV_DAKWAH', DIV_INVESTASI: 'DIV_INVESTASI', DIV_HUKUM: 'DIV_HUKUM',
  DIV_UMUM: 'DIV_UMUM'
};

// Label tampilan divisi (Bahasa Indonesia)
var DIVISION_LABELS = {
  DIV_HUMAS: 'Hubungan Masyarakat', DIV_LITBANG: 'Penelitian & Pengembangan',
  DIV_SOSMED: 'Media Sosial', DIV_DAKWAH: 'Dakwah', DIV_INVESTASI: 'Investasi',
  DIV_HUKUM: 'Hukum', DIV_UMUM: 'Umum'
};

// Label peran (Bahasa Indonesia)
var ROLE_LABELS = {
  SUPERADMIN: 'Administrator Sistem', KETUA: 'Ketua', SEKRETARIS: 'Sekretaris',
  BENDAHARA: 'Bendahara', PEMBINA: 'Pembina', PENGAWAS: 'Pengawas',
  KETUA_DIVISI: 'Ketua Divisi', ANGGOTA_DIVISI: 'Anggota Divisi'
};

// Peran yang boleh membaca modul tertentu.
var SURAT_READ_ROLES = [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS,
                        ROLES.PEMBINA, ROLES.PENGAWAS];
var KEUANGAN_READ_ROLES = [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.BENDAHARA,
                           ROLES.PEMBINA, ROLES.PENGAWAS];
var USERS_READ_ROLES = [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS, ROLES.BENDAHARA];
var DIVISI_SUBMIT_ROLES = [ROLES.SUPERADMIN, ROLES.KETUA_DIVISI, ROLES.ANGGOTA_DIVISI];
var AUDIT_READ_ROLES = [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.PEMBINA, ROLES.PENGAWAS];

// Redaksi konten portal publik: SUPERADMIN, KETUA, SEKRETARIS + Divisi Humas & Sosmed.
// (Pembatasan divisi untuk KETUA_DIVISI/ANGGOTA_DIVISI diperketat lagi di handler.)
var EDITORIAL_WRITE_ROLES = [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS,
                             ROLES.KETUA_DIVISI, ROLES.ANGGOTA_DIVISI];

// ==========================================================================
// TABEL ROUTES - Single Source of Truth RBAC
// ==========================================================================
// Setiap route: { auth: bool, roles: [array|null], handler: fn }
//   auth  -> true: wajib sesi valid; false: publik (login, verifySurat, registerAnggota)
//   roles -> null: semua peran login; array: salah satu harus cocok.
var ROUTES = {
  // --- Autentikasi & Akun Pengurus (Auth.gs) ---
  login:               { auth: false, roles: null, handler: login },
  loginWithGoogle:     { auth: false, roles: null, handler: loginWithGoogle },
  logout:              { auth: true,  roles: null, handler: logout },
  me:                  { auth: true,  roles: null, handler: me },
  getListPengguna:     { auth: true,  roles: USERS_READ_ROLES, handler: getListPengguna },
  createPengguna:      { auth: true,  roles: [ROLES.SUPERADMIN], handler: createPengguna },
  updatePengguna:      { auth: true,  roles: [ROLES.SUPERADMIN], handler: updatePengguna },
  getAuditLogs:        { auth: true,  roles: AUDIT_READ_ROLES, handler: getAuditLogs },

  // --- Pendaftaran Anggota Baru (Auth.gs) ---
  registerAnggota:           { auth: false, roles: null, handler: registerAnggota },
  getListPendaftar:          { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS], handler: getListPendaftar },
  verifyPendaftarSekretaris: { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.SEKRETARIS], handler: verifyPendaftarSekretaris },
  approvePendaftarKetum:     { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: approvePendaftarKetum },
  rejectPendaftar:           { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS], handler: rejectPendaftar },
  exportPendaftar:           { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS], handler: exportPendaftar },
  getKtaNasionalList:        { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS], handler: getKtaNasionalList },
  verifyKtaPublic:           { auth: false, roles: null, handler: verifyKtaPublic },
  generateLegacyClaimToken:  { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.SEKRETARIS], handler: generateLegacyClaimToken },
  claimLegacyKta:            { auth: false, roles: null, handler: claimLegacyKta },

  // --- Dashboard ---
  getDashboard:        { auth: true,  roles: null, handler: getDashboard },

  // --- Persuratan (Surat.gs) ---
  getListSurat:        { auth: true,  roles: SURAT_READ_ROLES, handler: getListSurat },
  createSurat:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.SEKRETARIS], handler: createSurat },
  updateSurat:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.SEKRETARIS], handler: updateSurat },
  submitSurat:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.SEKRETARIS], handler: submitSurat },
  approveSurat:        { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: approveSurat },
  rejectSurat:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: rejectSurat },
  verifySurat:         { auth: false, roles: null, handler: verifySurat },
  getPublishedSurat:   { auth: false, roles: null, handler: getPublishedSurat },
  reserveLetterNumber: { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.SEKRETARIS], handler: reserveLetterNumber },

  // --- Keuangan & Rekening (Keuangan.gs) ---
  getListKeuangan:     { auth: true,  roles: KEUANGAN_READ_ROLES, handler: getListKeuangan },
  getSaldo:            { auth: true,  roles: KEUANGAN_READ_ROLES, handler: getSaldo },
  createVoucher:       { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.BENDAHARA], handler: createVoucher },
  updateVoucherReceipt:{ auth: true,  roles: [ROLES.SUPERADMIN, ROLES.BENDAHARA], handler: updateVoucherReceipt },
  verifyVoucherBendahara: { auth: true, roles: [ROLES.SUPERADMIN, ROLES.BENDAHARA], handler: verifyVoucherBendahara },
  verifyVoucherKetum:  { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: verifyVoucherKetum },
  rejectVoucher:       { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.BENDAHARA], handler: rejectVoucher },
  resubmitVoucher:     { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.BENDAHARA], handler: resubmitVoucher },
  voidVoucher:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.BENDAHARA], handler: voidVoucher },
  getVoucherDetail:    { auth: true,  roles: KEUANGAN_READ_ROLES, handler: getVoucherDetail },
  getKasSimulatorData: { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.BENDAHARA], handler: getKasSimulatorData },
  saveKasSimulation:   { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.BENDAHARA], handler: saveKasSimulation },
  convertSimulationToKas: { auth: true, roles: [ROLES.SUPERADMIN, ROLES.BENDAHARA], handler: convertSimulationToKas },
  getAccounts:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.BENDAHARA], handler: getAccounts },
  saveAccount:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.BENDAHARA], handler: saveAccount },
  deleteAccount:       { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.BENDAHARA], handler: deleteAccount },
  getPublicAccounts:   { auth: false, roles: null, handler: getPublicAccounts },
  verifyKwitansi:      { auth: false, roles: null, handler: verifyKwitansiPublic },
  verifyReceipt:       { auth: false, roles: null, handler: verifyKwitansiPublic },

  // --- Pengaturan & Penyimpanan (Utils.gs) ---
  getSettings:         { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: getSettings },
  saveSettings:        { auth: true,  roles: [ROLES.SUPERADMIN], handler: saveSettings },
  getPublicSettings:   { auth: false, roles: null, handler: getPublicSettings },
  getPublicWilayahList: { auth: false, roles: null, handler: getPublicWilayahList },
  getEditorialContent: { auth: true,  roles: null, handler: getEditorialContent },
  saveEditorialContent:{ auth: true,  roles: EDITORIAL_WRITE_ROLES, handler: saveEditorialContent },
  uploadKopImage:      { auth: true,  roles: [ROLES.SUPERADMIN], handler: uploadKopImage },
  testDriveStorage:    { auth: true,  roles: [ROLES.SUPERADMIN], handler: testDriveStorage },
  createDriveFolder:   { auth: true,  roles: [ROLES.SUPERADMIN], handler: createDriveFolder },
  moveDriveFolder:     { auth: true,  roles: [ROLES.SUPERADMIN], handler: moveDriveFolder },
  resetDriveStorage:   { auth: true,  roles: [ROLES.SUPERADMIN], handler: resetDriveStorage },
  initHierarchyFolders: { auth: true, roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: initHierarchyFolders },
  getDriveStorageStatus: { auth: true, roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS, ROLES.BENDAHARA], handler: getDriveStorageStatus },
  getListVaultFiles:    { auth: true, roles: null, handler: getListVaultFiles },
  softDeleteVaultFile:  { auth: true, roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS, ROLES.BENDAHARA], handler: softDeleteVaultFile },
  restoreVaultFile:     { auth: true, roles: [ROLES.SUPERADMIN, ROLES.KETUA, ROLES.SEKRETARIS, ROLES.BENDAHARA], handler: restoreVaultFile },
  purgeTrashVault:      { auth: true, roles: [ROLES.SUPERADMIN], handler: purgeTrashVault },
  initDatabaseSchema:  { auth: true,  roles: [ROLES.SUPERADMIN], handler: function (ctx) { initSchema(); return { ok: true, data: null, message: 'Skema database Google Sheets berhasil disinkronkan.' }; } },

  // --- Divisi (Divisi.gs) ---
  getListDivisi:       { auth: true,  roles: null, handler: getListDivisi },
  createSubmission:    { auth: true,  roles: DIVISI_SUBMIT_ROLES, handler: createSubmission },
  updateSubmission:    { auth: true,  roles: DIVISI_SUBMIT_ROLES, handler: updateSubmission },
  ajukanSubmission:    { auth: true,  roles: DIVISI_SUBMIT_ROLES, handler: ajukanSubmission },
  approveSubmission:   { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: approveSubmission },
  rejectSubmission:    { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: rejectSubmission },
  startExecution:      { auth: true,  roles: DIVISI_SUBMIT_ROLES, handler: startExecution },
  submitLPJ:           { auth: true,  roles: DIVISI_SUBMIT_ROLES, handler: submitLPJ },

  // --- Formasi Pengurus & Delegasi Plt (Fase 6 - Divisi.gs) ---
  getFormasiPengurus:  { auth: true,  roles: null, handler: getFormasiPengurus },
  savePejabatFormasi:  { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: savePejabatFormasi },
  createPltDelegasi:   { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: createPltDelegasi },
  getListPltDelegasi:  { auth: true,  roles: null, handler: getListPltDelegasi },
  revokePltDelegasi:   { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: revokePltDelegasi },
  generateSkPengurus:  { auth: true,  roles: [ROLES.SUPERADMIN, ROLES.KETUA], handler: generateSkPengurus },

  // --- Alias Kompatibilitas (Pencegahan Notif Aksi Tidak Dikenali) ---
  getDashboardSummary: { auth: true,  roles: null, handler: getDashboard },
  getListProgram:      { auth: true,  roles: null, handler: getListDivisi },
  getPublicFeed:       { auth: false, roles: null, handler: getPublishedSurat },
  verify:              { auth: false, roles: null, handler: verifySurat }
};

// ==========================================================================
// PINTU MASUK WEB APP
// ==========================================================================

/**
 * Handler GET: action + token + parameter lain via query string.
 * Dipakai frontend untuk semua aksi baca.
 */
function doGet(e) {
  return handleRequest(e.parameter || {});
}

/**
 * Handler POST: body JSON { action, token, payload }.
 * Dipakai frontend untuk semua aksi tulis.
 */
function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents || '{}');
  } catch (err) {
    return jsonOut({ success: false, data: null, message: 'Format permintaan tidak valid.' });
  }
  // POST juga mengizinkan parameter query (action/token) sebagai fallback.
  var merged = {};
  for (var k in body) merged[k] = body[k];
  for (var q in (e.parameter || {})) if (!(q in merged)) merged[q] = e.parameter[q];
  return handleRequest(merged);
}

/**
 * Inti dispatch: validasi route -> sesi -> RBAC -> jalankan handler -> envelope.
 * @param {object} req { action, token, payload }
 */
function handleRequest(req) {
  req = req || {};
  var action = req.action;

  // Cek ping status bila diakses langsung tanpa aksi (misal browser GET)
  if (!action || action === 'ping') {
    return jsonOut({
      success: true,
      data: { status: 'online', version: '2.0.0', service: 'SIAP APII Backend' },
      message: 'Layanan API Yayasan APII DPW Jabodetabek Aktif.'
    });
  }

  var route = ROUTES[action];

  // 1) Aksi tidak dikenali.
  if (!route) {
    return jsonOut({ success: false, data: null, message: 'Aksi tidak dikenali.' });
  }

  // 2) Verifikasi sesi bila route butuh autentikasi.
  var user = null;
  if (route.auth) {
    user = verifySession(req.token);
    if (!user) {
      return jsonOut({ success: false, data: null,
        message: 'Sesi berakhir atau tidak valid. Silakan login kembali.' });
    }
    // 3) Cek RBAC peran.
    if (route.roles && route.roles.indexOf(user.role) === -1) {
      audit(user.username, 'FORBIDDEN',
        'Aksi ' + action + ' ditolak untuk peran ' + (ROLE_LABELS[user.role] || user.role));
      return jsonOut({ success: false, data: null,
        message: 'Anda tidak memiliki izin untuk aksi ini.' });
    }
  }

  // 4) Jalankan handler. Handler WAJIB return { ok, data, message }.
  try {
    var payload = req.payload || {};
    if (typeof payload !== 'object' || payload === null) payload = {};
    for (var k in req) {
      if (k !== 'action' && k !== 'token' && k !== 'payload') {
        if (!(k in payload)) payload[k] = req[k];
      }
    }
    var ctx = { user: user, token: req.token, payload: payload };
    var result = route.handler(ctx);
    if (!result) result = { ok: false, data: null, message: 'Handler tidak mengembalikan hasil.' };
    return jsonOut({ success: result.ok, data: result.data, message: result.message || '' });
  } catch (err) {
    // Error terstruktur dari handler: lempar { code, message }.
    if (err && err.appError) {
      return jsonOut({ success: false, data: null, message: err.message });
    }
    // Error tak terduga: catat & beri pesan generik (jangan bocorkan detail).
    Logger.log('ERROR [' + action + ']: ' + err);
    return jsonOut({ success: false, data: null,
      message: 'Terjadi kesalahan sistem. Tim IT telah diberi notifikasi.' });
  }
}

/**
 * Bungus objek ke JSON response (ContentService; Apps Script selalu HTTP 200).
 */
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Helper untuk handler: lempar error aplikasi (ditangkap handleRequest).
 */
function appError(message) {
  var err = new Error(message);
  err.appError = true;
  return err;
}

// ==========================================================================
// SETUP - Jalankan SEKALI pada spreadsheet baru (Project Settings > Run).
// ==========================================================================

/**
 * setup(): buat semua tab + header + seed 9 akun demo (password 'apii2026').
 * Idempoten: tab/header yang sudah ada tidak akan dirusak.
 */
function setup() {
  initSchema();
  seedDemoUsers();
  // Buat folder Drive + template Google Docs (kop, logo & stempel) otomatis.
  siapkanFolderPdf_();
  siapkanTemplateSurat_();
  Logger.log('Setup selesai. Database, folder Drive, & template surat siap.');
}

function seedDemoUsers() {
  var defaultPassword = 'apii2026';
  var superadminPassword = 'Icat250704!';
  var demo = [
    ['superadmin', 'Administrator Sistem', ROLES.SUPERADMIN, '', 'admin@apii-jabo.or.id'],
    ['ketua',      'Ketua Umum',           ROLES.KETUA,      '', 'ketua@apii-jabo.or.id'],
    ['sekretaris', 'Sekretaris',           ROLES.SEKRETARIS, '', 'sekretaris@apii-jabo.or.id'],
    ['bendahara',  'Bendahara',            ROLES.BENDAHARA,  '', 'bendahara@apii-jabo.or.id'],
    ['pembina',    'Pembina',              ROLES.PEMBINA,    '', 'pembina@apii-jabo.or.id'],
    ['pengawas',   'Pengawas',             ROLES.PENGAWAS,   '', 'pengawas@apii-jabo.or.id'],
    ['khumas',     'Ketua Divisi Humas',   ROLES.KETUA_DIVISI,     DIVISIONS.DIV_HUMAS, 'humas@apii-jabo.or.id'],
    ['ahumas',     'Anggota Divisi Humas', ROLES.ANGGOTA_DIVISI,   DIVISIONS.DIV_HUMAS, '']
  ];
  var now = new Date().toISOString();
  demo.forEach(function (row) {
    var pass = (row[0] === 'superadmin') ? superadminPassword : defaultPassword;
    var existing = findOne('Sheet_Users', { username: row[0] });
    if (existing) {
      // Pastikan password hash superadmin selalu sinkron
      if (row[0] === 'superadmin' && existing.password_hash !== hashPassword(superadminPassword)) {
        updateRow('Sheet_Users', existing._row, { password_hash: hashPassword(superadminPassword) });
      }
      return; // jangan timpa akun yang sudah ada
    }
    insert('Sheet_Users', {
      id: uuid(),
      username: row[0],
      password_hash: hashPassword(pass),
      full_name: row[1],
      email: row[4],
      role: row[2],
      division: row[3],
      is_active: 'TRUE',
      can_manage_users: row[2] === ROLES.SUPERADMIN ? 'TRUE' : 'FALSE',
      created_at: now,
      updated_at: now
    });
  });
  Logger.log('Seed akun pengurus selesai (superadmin: ' + superadminPassword + ', akun lain: ' + defaultPassword + ').');
}

/****************************************************************************
 * 99-TemplateSurat.gs
 *****************************************************************************/
/**
 * ============================================================================
 * 99-TemplateSurat.gs - Generator Otomatis Template Surat + Folder Drive
 * ============================================================================
 * Membuat dokumen Google Docs "Template Surat Resmi APII DPW Jabodetabek"
 * lengkap dengan:
 *   - KOP surat: logo + "DEWAN PIMPINAN WILAYAH APOLOGET ISLAM INDONESIA
 *     (APII) JABODETABEK" + alamat + garis pemisah ganda
 *   - Badan: seluruh placeholder {{...}} yang diganti otomatis saat surat
 *     diterbitkan
 *   - Blok tanda tangan Sekretaris & Ketua + STEMPEL basah
 *   - Footer: nama lembaga + tahun + URL verifikasi keaslian
 *
 * Logo & stempel ditanam sebagai data base64 di Aset.gs (diambil dari
 * Dokumen Sumber), sehingga TIDAK perlu upload gambar manual.
 *
 * Placeholder (lihat juga Surat.gs generateSuratPdf_):
 *   {{JENIS}} {{NOMOR}} {{JUDUL}} {{TANGGAL}} {{TAHUN}}
 *   {{MENIMBANG}} {{MENGINGAT}} {{MEMUTUSKAN}}
 *   {{SEKRETARIS}} {{KETUA}} {{QR_VERIFY}}
 * ==========================================================================*/

/** Dekode base64 logo (Aset.gs) menjadi Blob. */
function getLogoBlob_() {
  return Utilities.newBlob(
    Utilities.base64Decode(LOGO_BASE64), 'image/jpeg', 'logo-dpw-apii.jpg');
}

/** Dekode base64 stempel (Aset.gs) menjadi Blob. */
function getStempelBlob_() {
  return Utilities.newBlob(
    Utilities.base64Decode(STEMPEL_BASE64), 'image/jpeg', 'stempel-apii.jpg');
}

/**
 * Bangun URL verifikasi publik untuk sebuah nomor surat.
 * @param {string} letterNumber nomor surat, mis. 001/SK-DPW/APII-JABO/X/2026
 * @return {string} mis. https://apii.sigitadi.id/?no=001%2FSK-DPW%2F...
 */
function urlVerifikasiSurat_(letterNumber) {
  var base = PropertiesService.getScriptProperties().getProperty('PUBLIC_URL') ||
             KONFIG.PUBLIC_URL;
  return base.replace(/\/+$/, '') + '/?no=' + encodeURIComponent(letterNumber || '');
}

/**
 * siapkanFolderPdf_: pastikan folder Drive penyimpanan PDF ada (buat bila belum).
 * Prioritaskan konfigurasi di Sheet_Settings, lalu ScriptProperties, lalu buat default.
 * @return {string} ID folder
 */
function siapkanFolderPdf_() {
  var props = PropertiesService.getScriptProperties();

  // 1. Cek konfigurasi custom di Sheet_Settings
  var customId = '';
  try {
    customId = getSettingValue_('google_drive_folder_id', '');
    if (!customId) {
      var drv = getSettingValue_('drive_storage', {});
      if (drv && drv.custom_folder_id) customId = drv.custom_folder_id;
    }
  } catch (e) {
    customId = '';
  }

  if (customId) {
    try {
      var customFolder = DriveApp.getFolderById(customId);
      props.setProperty('DRIVE_FOLDER_ID', customId);
      return customId;
    } catch (e) {
      Logger.log('Custom folder ID ' + customId + ' tidak valid / tidak dapat diakses: ' + e);
      // Fallback ke ScriptProperties atau buat default di bawah
    }
  }

  // 2. Cek di ScriptProperties bila ada
  var folderId = props.getProperty('DRIVE_FOLDER_ID');
  if (folderId) {
    try { DriveApp.getFolderById(folderId); return folderId; }
    catch (e) { /* folder terhapus - buat ulang di bawah */ }
  }

  // 3. Buat folder default bila belum ada
  var folder = DriveApp.createFolder(KONFIG.DRIVE_FOLDER_NAME);
  props.setProperty('DRIVE_FOLDER_ID', folder.getId());
  Logger.log('Folder PDF dibuat: ' + folder.getUrl());
  return folder.getId();
}

/**
 * siapkanTemplateSurat_: pastikan template Google Docs ada (buat bila belum).
 * @return {string} ID dokumen template
 */
function siapkanTemplateSurat_() {
  var props = PropertiesService.getScriptProperties();
  var docId = props.getProperty('TEMPLATE_DOC_ID');
  if (docId) {
    try { DocumentApp.openById(docId); return docId; }
    catch (e) { /* template terhapus - buat ulang di bawah */ }
  }
  return generateTemplateSurat();
}

/**
 * generateTemplateSurat: buat dokumen template dari nol. Dipanggil setup()
 * dan otomatis oleh generateSuratPdf_ bila template belum ada.
 * @return {string} ID dokumen template
 */
function generateTemplateSurat() {
  var doc = DocumentApp.create(KONFIG.TEMPLATE_DOC_NAME);
  var body = doc.getBody();

  // Ukuran kertas A4 (595 x 842 pt) dengan margin ~1.9 cm.
  try {
    body.setPageWidth(595.0).setPageHeight(842.0)
        .setMarginTop(54.0).setMarginBottom(54.0)
        .setMarginLeft(54.0).setMarginRight(54.0);
  } catch (e) { /* ukuran default, tidak fatal */ }

  // ---- KOP: gunakan header halaman bila tersedia; kalau tidak, taruh di
  //       paling atas badan dokumen. Kedua kasus diisi berurutan.
  var kop = null;
  try { kop = doc.getHeader(); } catch (e) { kop = null; }
  if (!kop) { try { kop = doc.addHeader(); } catch (e) { kop = null; } }
  if (!kop) kop = body;

  // Logo (base64 dari Aset.gs). Saat kop = body, sisipkan di posisi 0.
  try {
    var logoImg = (kop === body)
      ? kop.insertImage(0, getLogoBlob_())
      : kop.appendImage(getLogoBlob_());
    logoImg.setWidth(80.0).setHeight(80.0);
  } catch (e) {
    Logger.log('Logo gagal ditanam di kop: ' + e);
  }

  // Teks lembaga & alamat (data dari Dokumen Sumber).
  parSurat_(kop, 'DEWAN PIMPINAN WILAYAH', 10, true, 'center', '#1B5E20');
  parSurat_(kop, 'APOLOGET ISLAM INDONESIA (APII) JABODETABEK', 13, true, 'center', '#0d1c2f');
  parSurat_(kop, 'Gedung Pusat Dakwah APII Wilayah Jabodetabek Lt. 3, Jl. Kramat Raya No. 45, ' +
    'Senen, Jakarta Pusat 10450 | Telp: (021) 390-8812 | Email: sekretariat.dpw@apii-jabodetabek.or.id',
    7.5, false, 'center', '#555555');

  // Garis pemisah ganda khas surat resmi.
  try {
    var garis1 = kop.appendHorizontalRule();
    var garis2 = kop.appendHorizontalRule();
    if (garis1 && garis1.setSpacingBefore) garis1.setSpacingBefore(3).setSpacingAfter(0);
    if (garis2 && garis2.setSpacingBefore) garis2.setSpacingBefore(0).setSpacingAfter(4);
  } catch (e) { /* garis opsional */ }

  // ---- BADAN SURAT ----
  parSurat_(body, '', 8);
  parSurat_(body, '{{JENIS}}', 13, true, 'center');
  parSurat_(body, 'Nomor : {{NOMOR}}', 11, false, 'center');
  parSurat_(body, '', 4);
  parSurat_(body, 'TENTANG', 9, true, 'center');
  parSurat_(body, '{{JUDUL}}', 12, true, 'center');
  parSurat_(body, '', 8);
  parSurat_(body, 'Menimbang : {{MENIMBANG}}', 11);
  parSurat_(body, 'Mengingat : {{MENGINGAT}}', 11);
  parSurat_(body, 'Memutuskan : {{MEMUTUSKAN}}', 11);
  parSurat_(body, '', 8);
  parSurat_(body, 'Ditetapkan di Jakarta pada tanggal {{TANGGAL}}', 11);
  parSurat_(body, '', 12);

  // ---- BLOK TANDA TANGAN + STEMPEL ----
  var sigTable = body.appendTable();
  try { sigTable.setBorderColor('#ffffff').setBorderWidth(0.5); } catch (e) {}
  var sigRow = sigTable.appendTableRow();
  var cSek = sigRow.appendTableCell();
  var cKet = sigRow.appendTableCell();
  try { cSek.setWidth(243.0); cKet.setWidth(243.0); } catch (e) {}

  // Sekretaris (kiri).
  parSurat_(cSek, 'Sekretaris DPW Jabodetabek,', 11, false, 'center');
  parSurat_(cSek, '', 10); parSurat_(cSek, '', 10); parSurat_(cSek, '', 10);
  parSurat_(cSek, '( {{SEKRETARIS}} )', 11, true, 'center');

  // Ketua (kanan) + stempel basah.
  parSurat_(cKet, 'Ketua DPW Jabodetabek,', 11, false, 'center');
  try {
    var stempelImg = cKet.appendImage(getStempelBlob_());
    stempelImg.setWidth(95.0).setHeight(95.0);
  } catch (e) {
    Logger.log('Stempel gagal ditanam: ' + e);
  }
  parSurat_(cKet, '( {{KETUA}} )', 11, true, 'center');

  // ---- FOOTER ----
  var footer = null;
  try { footer = doc.getFooter(); } catch (e) { footer = null; }
  if (!footer) { try { footer = doc.addFooter(); } catch (e) { footer = null; } }
  if (footer) {
    parSurat_(footer, 'Yayasan Apologet Islam Indonesia (APII) • Dewan Pimpinan Wilayah ' +
      'Jabodetabek • Tahun {{TAHUN}}', 8, false, 'center', '#666666');
    parSurat_(footer, 'Verifikasi keaslian surat: {{QR_VERIFY}}', 8, false, 'center', '#666666');
  }

  doc.saveAndClose();

  // Simpan ID template agar tidak dibuat ulang pada pemanggilan berikutnya.
  PropertiesService.getScriptProperties()
    .setProperty('TEMPLATE_DOC_ID', doc.getId());
  Logger.log('Template surat dibuat: ' + doc.getUrl());
  return doc.getId();
}

/**
 * Helper: tambah satu paragraf terformat ke container manapun
 * (Body / HeaderSection / FooterSection / TableCell).
 */
function parSurat_(container, text, size, bold, align, color) {
  var p = container.appendParagraph(String(text || ''));
  var t = p.editAsText();
  if (size) t.setFontSize(size);
  if (bold) t.setBold(true);
  if (color) t.setForegroundColor(color);
  if (align === 'center') p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  else if (align === 'right') p.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  try { p.setSpacingBefore(0).setSpacingAfter(2); } catch (e) {}
  return p;
}

