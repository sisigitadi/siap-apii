/**
 * ============================================================================
 * Utils.gs — Helper Umum, Audit Log & Dashboard
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
    Database.insert(TABS.AUDIT, {
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

/** Ubah angka bulan ke angka romawi (I–XII). Dipakai penomoran surat/voucher. */
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
  var allSurat = Database.readAll(TABS.SURAT);
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
    var allKeu = Database.readAll(TABS.KEUANGAN);
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
  var allDiv = Database.readAll(TABS.DIVISI);
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
    data.counts.pengguna_total = Database.readAll(TABS.USERS).length;
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
    var rawKeu = Database.readAll(TABS.KEUANGAN);
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
          detail: 'Diverifikasi Bendahara (' + (k.verified_by_bendahara || '—') + ') • Menunggu Ketua',
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
        '<div style="font-size: 20px; font-weight: 900; color: #064e3b; margin-top: 4px;">SIAP APII — Sistem Administrasi & Informasi</div>' +
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
function kirimNotifikasiKeRole_(role, subject, title, messageHtml, actionText, actionUrl) {
  try {
    var users = Database.findMany(TABS.USERS, { role: role, is_active: 'TRUE' });
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
    var user = Database.findOne(TABS.USERS, { username: username });
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
    var row = Database.findOne(TABS.SETTINGS, { key: key });
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
  var row = Database.findOne(TABS.SETTINGS, { key: key });
  if (row) {
    Database.updateRow(TABS.SETTINGS, row._row, {
      value: strVal,
      updated_by: user || 'system',
      updated_at: now
    });
  } else {
    Database.insert(TABS.SETTINGS, {
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
  var rows = Database.readAll(TABS.SETTINGS);
  if (!rows || rows.length === 0) {
    seedDefaultSettings_();
    rows = Database.readAll(TABS.SETTINGS);
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

/**
 * getPublicSettings: ambil konfigurasi yang boleh dibaca publik.
 * Publik (tanpa token).
 */
function getPublicSettings(ctx) {
  var pubConfig = getSettingValue_('public_config', {
    show_verification: true, show_finance: true, show_programs: true, show_accounts: true,
    show_registration: true, announcement_banner_active: true,
    announcement_banner: 'Selamat datang di Portal Resmi Yayasan APII DPW Jabodetabek.'
  });
  var kop = getSettingValue_('letter_kop', {});
  var reg = getSettingValue_('registration_config', {
    status: 'BUKA',
    is_open: true,
    quota_limit: 0,
    closed_title: 'Pendaftaran Anggota Sementara Ditutup',
    closed_message: 'Pendaftaran gelombang saat ini telah ditutup atau sedang dalam proses verifikasi kuota. Pantau pengumuman resmi berkala dari sekretariat yayasan.',
    instructions: 'Silakan isi formulir pendaftaran anggota Yayasan APII DPW Jabodetabek dengan data yang valid sesuai identitas KTP resmi.',
    require_ktp: true,
    require_selfie: true,
    max_file_size_mb: 3,
    open_divisions: ['DIV_DAKWAH', 'DIV_HUKUM', 'DIV_HUMAS', 'DIV_MEDIA', 'DIV_SOSIAL', 'DIV_LITBANG', 'DIV_EKONOMI'],
    contact_wa: '081288882026',
    wa_template: 'Halo Sekretariat APII DPW Jabodetabek, saya telah mendaftar anggota baru dengan No. Registrasi: {reg_number} a.n {full_name}. Mohon verifikasi berkas saya.',
    agreement_text: 'Saya menyatakan bahwa data yang saya berikan adalah benar dan sah. Saya bersedia menaati AD/ART, kode etik, dan peraturan Yayasan APII DPW Jabodetabek.'
  });
  return {
    ok: true,
    data: {
      config: pubConfig,
      registration: reg,
      kop: {
        org_name: kop.org_name || 'DEWAN PIMPINAN WILAYAH APOLOGET ISLAM INDONESIA (APII) JABODETABEK',
        address: kop.address || 'DKI Jakarta & Sekitarnya, Indonesia',
        email: kop.email || 'sekretariat@apii.sigitadi.id',
        phone: kop.phone || '0812-8888-2026'
      }
    },
    message: 'Pengaturan publik berhasil dimuat.'
  };
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


