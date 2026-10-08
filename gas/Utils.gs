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
 * escHtml_: escape entitas HTML untuk teks yang disisipkan ke badan email
 * atau dokumen HTML dari sisi backend (pengganti Auth.esc sisi frontend).
 * @param {*} str nilai apa pun
 * @return {string} teks aman untuk HTML
 */
function escHtml_(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ==========================================================================
// KONTEN REDAKSI DINAMIS (MINI-CMS) — Portal Publik
// ==========================================================================
// Seluruh konten yang dikelola pengurus disimpan sebagai satu nilai JSON di
// Sheet_Settings dengan key 'editorial_content' (lihat docs/REDAKSI_KONTEN.md).
// Fungsi di bawah HANYA menyiapkan/normalisasi struktur; pemetaan ke markup
// portal publik tetap dilakukan di public/app.js.
// ==========================================================================

/** Key Sheet_Settings penyimpan konten redaksi dinamis. */
var EDITORIAL_KEY = 'editorial_content';

/** Batas maksimum jumlah item daftar agar payload tetap wajar & aman. */
var EDITORIAL_LIMITS_ = { missions: 20, bulletins: 60, events: 60, faqs: 60 };

/**
 * defaultEditorialContent_: konten redaksi bawaan (dipakai saat instalasi baru).
 * Nilai ini juga menjadi fallback bila pengurus mengosongkan sebuah field.
 * @return {object} struktur konten redaksi lengkap
 */
function defaultEditorialContent_() {
  return {
    hero: {
      badge: 'Penerimaan Anggota Baru 2026',
      headline: 'Keanggotaan & Kolaborasi Yayasan APII DPW Jabodetabek',
      subheadline: 'Wadah sinergi para ahli, akademisi, dan praktisi pengkaji Islam di Indonesia untuk riset, pemberdayaan, dan kemaslahatan umat.',
      cta_text: 'Info Dokumen & Keuangan Kas →',
      cta_link: '#informasi'
    },
    profile: {
      show_section: true,
      ketua_name: 'Ust. Sigit Adi, S.T., M.Kom.',
      ketua_title: 'Ketua DPW APII Jabodetabek',
      greeting: "Assalamu'alaikum Warahmatullahi Wabarakatuh. Selamat datang di portal resmi Dewan Pimpinan Wilayah Yayasan Apologet Islam Indonesia (APII) Jabodetabek. Melalui sistem terpadu ini, kami berkomitmen menghadirkan transparansi penuh, kemudahan pendaftaran anggota, dan akuntabilitas publik bagi kemaslahatan umat.",
      vision: 'Menjadi pusat pengkajian, literasi, dan advokasi Islam yang unggul, terpercaya, dan berakhlakul karimah.',
      missions: [
        'Mengembangkan riset komparatif dan dakwah transformatif di wilayah Jabodetabek.',
        'Membangun jejaring keilmuan antar cendekiawan, praktisi, dan ormas Islam.',
        'Menegakkan transparansi kelembagaan dan akuntabilitas umat.'
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
          time_str: '09.00 – 12.00 WIB',
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
      service_hours: 'Senin – Sabtu, 08.30 – 16.30 WIB'
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
    ],
    faqs_show: true
  };
}

/**
 * editorialStr_: ambil string aman (trim + batas panjang).
 * Kosong yang dikirim eksplisit tetap dikosongkan (bukan diisi bawaan) agar
 * redaksi bisa menyembunyikan sebuah teks; frontend akan memakai teks bawaan
 * HTML bila nilainya kosong.
 * @param {*} val nilai mentah
 * @param {string} fallback dipakai hanya bila val tidak dikirim (undefined/null)
 * @param {number} maxLen batas panjang karakter
 * @return {string}
 */
function editorialStr_(val, fallback, maxLen) {
  if (val === undefined || val === null) return fallback;
  var s = typeof val === 'string' ? val : String(val);
  s = s.replace(/\r\n/g, '\n').trim();
  if (maxLen > 0 && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/**
 * editorialUrl_: validasi tautan; hanya http(s), mailto, tel, anchor, atau
 * path relatif yang diizinkan (mencegah skema berbahaya seperti javascript:).
 * @return {string} tautan aman, atau '' bila tidak valid
 */
function editorialUrl_(val, fallback, maxLen) {
  var s = editorialStr_(val, fallback, maxLen > 0 ? maxLen : 500);
  if (!s) return '';
  if (/^(https?:|mailto:|tel:)/i.test(s)) return s;
  if (/^(#|\/|\.\/)/.test(s)) return s;
  return '';
}

/**
 * editorialBool_: koersi nilai apa pun (boolean / 'TRUE' / 1) menjadi boolean.
 * @return {boolean}
 */
function editorialBool_(val, fallback) {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'boolean') return val;
  var s = String(val).toLowerCase();
  if (s === 'false' || s === '0' || s === 'off' || s === 'no') return false;
  if (s === 'true' || s === '1' || s === 'on' || s === 'yes') return true;
  return fallback;
}

/**
 * normalizeEditorialContent_: gabungkan data tersimpan dengan nilai bawaan,
 * koersi tipe, buang item cacat, dan batasi jumlah item.
 * @param {object|string} raw nilai mentah (objek atau JSON string)
 * @return {object} konten redaksi siap pakai
 */
function normalizeEditorialContent_(raw) {
  var src = raw;
  if (typeof src === 'string') {
    try { src = JSON.parse(src); } catch (e) { src = null; }
  }
  if (!src || typeof src !== 'object') src = {};

  var def = defaultEditorialContent_();
  var out = {};

  // --- 1) Hero & tagline ---
  var hSrc = (src.hero && typeof src.hero === 'object') ? src.hero : {};
  out.hero = {
    badge: editorialStr_(hSrc.badge, def.hero.badge, 120),
    headline: editorialStr_(hSrc.headline, def.hero.headline, 200),
    subheadline: editorialStr_(hSrc.subheadline, def.hero.subheadline, 600),
    cta_text: editorialStr_(hSrc.cta_text, def.hero.cta_text, 80),
    cta_link: editorialUrl_(hSrc.cta_link, def.hero.cta_link, 300)
  };

  // --- 2) Profil lembaga & sambutan pimpinan ---
  var pSrc = (src.profile && typeof src.profile === 'object') ? src.profile : {};
  var rawMissions = Array.isArray(pSrc.missions) ? pSrc.missions : def.profile.missions;
  var missions = [];
  rawMissions.slice(0, EDITORIAL_LIMITS_.missions).forEach(function (m) {
    var line = editorialStr_(m, '', 300);
    if (line) missions.push(line);
  });
  if (!missions.length) missions = def.profile.missions.slice();
  out.profile = {
    show_section: editorialBool_(pSrc.show_section, def.profile.show_section),
    ketua_name: editorialStr_(pSrc.ketua_name, def.profile.ketua_name, 120),
    ketua_title: editorialStr_(pSrc.ketua_title, def.profile.ketua_title, 120),
    greeting: editorialStr_(pSrc.greeting, def.profile.greeting, 2000),
    vision: editorialStr_(pSrc.vision, def.profile.vision, 500),
    missions: missions
  };

  // --- 3 & 4) Maklumat, siaran resmi, agenda & acara ---
  var bSrc = (src.bulletins_events && typeof src.bulletins_events === 'object') ? src.bulletins_events : {};
  var rawBulletins = Array.isArray(bSrc.bulletins) ? bSrc.bulletins : def.bulletins_events.bulletins;
  var bulletins = [];
  rawBulletins.slice(0, EDITORIAL_LIMITS_.bulletins).forEach(function (b, i) {
    if (!b || typeof b !== 'object') return;
    var title = editorialStr_(b.title, '', 200);
    if (!title) return;
    bulletins.push({
      id: editorialStr_(b.id, 'mak-' + (i + 1) + '-' + uuid().slice(0, 8), 60),
      title: title,
      // Kategori bersifat enumeratif: nilai kosong dikembalikan ke pilihan standar.
      category: editorialStr_(b.category, 'Maklumat Resmi', 60) || 'Maklumat Resmi',
      date: editorialStr_(b.date, '', 20),
      summary: editorialStr_(b.summary, '', 800),
      link: editorialUrl_(b.link, '', 500)
    });
  });

  var rawEvents = Array.isArray(bSrc.events) ? bSrc.events : def.bulletins_events.events;
  var events = [];
  rawEvents.slice(0, EDITORIAL_LIMITS_.events).forEach(function (e, i) {
    if (!e || typeof e !== 'object') return;
    var title = editorialStr_(e.title, '', 200);
    if (!title) return;
    var status = String(e.status || 'MENDATANG').toUpperCase() === 'SELESAI' ? 'SELESAI' : 'MENDATANG';
    events.push({
      id: editorialStr_(e.id, 'evt-' + (i + 1) + '-' + uuid().slice(0, 8), 60),
      title: title,
      category: editorialStr_(e.category, 'Kajian Ilmiah', 60) || 'Kajian Ilmiah',
      date_str: editorialStr_(e.date_str, '', 80),
      time_str: editorialStr_(e.time_str, '', 80),
      location: editorialStr_(e.location, '', 160),
      speaker: editorialStr_(e.speaker, '', 160),
      link: editorialUrl_(e.link, '', 500),
      status: status
    });
  });

  out.bulletins_events = {
    show_section: editorialBool_(bSrc.show_section, def.bulletins_events.show_section),
    section_title: editorialStr_(bSrc.section_title, def.bulletins_events.section_title, 160),
    section_subtitle: editorialStr_(bSrc.section_subtitle, def.bulletins_events.section_subtitle, 400),
    bulletins: bulletins,
    events: events
  };

  // --- 5) Kontak & media sosial resmi ---
  var cSrc = (src.contact && typeof src.contact === 'object') ? src.contact : {};
  out.contact = {
    address: editorialStr_(cSrc.address, def.contact.address, 300),
    email: editorialStr_(cSrc.email, def.contact.email, 160),
    whatsapp_helpdesk: editorialStr_(cSrc.whatsapp_helpdesk, def.contact.whatsapp_helpdesk, 30),
    service_hours: editorialStr_(cSrc.service_hours, def.contact.service_hours, 160)
  };

  var sSrc = (src.social && typeof src.social === 'object') ? src.social : {};
  out.social = {
    youtube: editorialUrl_(sSrc.youtube, def.social.youtube, 300),
    instagram: editorialUrl_(sSrc.instagram, def.social.instagram, 300),
    whatsapp_channel: editorialUrl_(sSrc.whatsapp_channel, def.social.whatsapp_channel, 300),
    facebook: editorialUrl_(sSrc.facebook, def.social.facebook, 300),
    tiktok: editorialUrl_(sSrc.tiktok, def.social.tiktok, 300)
  };

  // --- 6) Tanya jawab publik (FAQ) ---
  var rawFaqs = Array.isArray(src.faqs) ? src.faqs : def.faqs;
  var faqs = [];
  rawFaqs.slice(0, EDITORIAL_LIMITS_.faqs).forEach(function (f) {
    if (!f || typeof f !== 'object') return;
    var q = editorialStr_(f.q, '', 300);
    var a = editorialStr_(f.a, '', 2000);
    if (!q || !a) return;
    faqs.push({ q: q, a: a });
  });
  out.faqs = faqs;
  out.faqs_show = editorialBool_(src.faqs_show, def.faqs_show);

  return out;
}

/**
 * getEditorialContent_: baca & normalisasi konten redaksi dari Sheet_Settings.
 * Selalu mengembalikan struktur lengkap (fallback ke bawaan bila belum ada).
 * @return {object}
 */
function getEditorialContent_() {
  return normalizeEditorialContent_(getSettingValue_(EDITORIAL_KEY, null));
}

// --------------------------------------------------------------------------
// RIWAYAT VERSI KONTEN REDAKSI (pencegahan penimpaan permanen)
// --------------------------------------------------------------------------
// Setiap penyimpanan mengarsipkan versi SEBELUMNYA ke Sheet_EditorialHistory
// (tabel terpisah agar payload getSettings tetap ringan), sehingga pengurus
// dapat meninjau dan memulihkan versi lama kapan saja.
// --------------------------------------------------------------------------

/** Jumlah maksimum versi yang disimpan di riwayat redaksi. */
var EDITORIAL_HISTORY_MAX = 15;

// Sel Google Sheets maksimum 50.000 karakter; sisakan margin aman. Versi yang
// lebih besar dari ini tidak diarsipkan (dilaporkan sebagai peringatan) agar
// penyimpanan tidak gagal karena batas sel.
var EDITORIAL_CELL_SAFE = 45000;

// Penanda format berkas cadangan konten redaksi. Dicek saat impor agar berkas
// asing tidak pernah menimpa konten produksi.
var EDITORIAL_EXPORT_FORMAT = 'apii-editorial-v1';

// Bagian konten redaksi yang dikenali. Berkas impor wajib memuat minimal satu
// kunci di bawah ini; tanpa itu berkas dianggap bukan konten redaksi sehingga
// tidak dapat menimpa seluruh konten dengan nilai bawaan.
var EDITORIAL_CONTENT_KEYS_ = ['hero', 'profile', 'bulletins_events', 'contact',
  'social', 'faqs', 'faqs_show'];

/** Singkatan bulan Indonesia untuk label riwayat versi. */
var EDITORIAL_MONTHS_ID_ = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/**
 * editorialFmtStamp_: format waktu versi menjadi label ringkas yang mudah dibaca
 * pengurus (mis. '08 Okt 2026 18.11') tanpa bergantung pada locale runtime.
 * @param {string} iso waktu ISO
 * @return {string}
 */
function editorialFmtStamp_(iso) {
  var d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return String(iso || '');
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  return pad(d.getDate()) + ' ' + EDITORIAL_MONTHS_ID_[d.getMonth()] + ' ' + d.getFullYear() +
    ' ' + pad(d.getHours()) + '.' + pad(d.getMinutes());
}

/** Label bagian konten untuk ringkasan perubahan antarversi. */
var EDITORIAL_SECTIONS_ = [
  { key: 'hero', label: 'Hero & tagline' },
  { key: 'profile', label: 'Profil & sambutan' },
  { key: 'bulletins_events', label: 'Maklumat & agenda' },
  { key: 'contact', label: 'Kontak' },
  { key: 'social', label: 'Media sosial' },
  { key: 'faqs', label: 'FAQ' },
  { key: 'faqs_show', label: 'Visibilitas FAQ' }
];

/**
 * editorialChangedSections_: daftar label bagian yang berbeda antara dua versi.
 * Dipakai sebagai ringkasan perubahan pada daftar riwayat versi.
 * @param {object} prev konten versi sebelumnya
 * @param {object} next konten versi baru
 * @return {Array<string>}
 */
function editorialChangedSections_(prev, next) {
  var a = prev || {};
  var b = next || {};
  var labels = [];
  EDITORIAL_SECTIONS_.forEach(function (s) {
    if (JSON.stringify(a[s.key] === undefined ? null : a[s.key]) !==
        JSON.stringify(b[s.key] === undefined ? null : b[s.key])) {
      labels.push(s.label);
    }
  });
  return labels;
}

/**
 * editorialHistoryRows_: seluruh baris riwayat redaksi, terbaru lebih dahulu.
 * @return {Array<object>}
 */
function editorialHistoryRows_() {
  var rows = [];
  try {
    rows = Database.readAll(TABS.EDITORIAL_HISTORY);
  } catch (e) {
    Logger.log('Gagal membaca riwayat redaksi: ' + e);
    return [];
  }
  rows = rows.filter(function (r) { return r && r.id; });
  rows.sort(function (a, b) {
    return String(b.saved_at).localeCompare(String(a.saved_at));
  });
  return rows;
}

/**
 * trimEditorialHistory_: sisakan hanya EDITORIAL_HISTORY_MAX versi terbaru.
 * Baris lama dihapus dengan mencari ulang berdasarkan id (nomor baris bergeser
 * setiap kali satu baris dihapus).
 * @return {number} jumlah versi yang dihapus
 */
function trimEditorialHistory_() {
  var rows = editorialHistoryRows_();
  if (rows.length <= EDITORIAL_HISTORY_MAX) return 0;
  var removed = 0;
  rows.slice(EDITORIAL_HISTORY_MAX).forEach(function (r) {
    try {
      var fresh = Database.findOne(TABS.EDITORIAL_HISTORY, { id: r.id });
      if (fresh && Database.deleteRow(TABS.EDITORIAL_HISTORY, fresh._row)) removed++;
    } catch (e) {
      Logger.log('Gagal memangkas riwayat redaksi: ' + e);
    }
  });
  return removed;
}

/**
 * editorialActionOf_: normalisasi jenis aksi riwayat versi redaksi. Nilai tak
 * dikenal (mis. baris yang disunting manual di spreadsheet) dibaca sebagai
 * 'SAVE' agar frontend tidak pernah menampilkan jenis aksi yang salah.
 * @param {*} val 'SAVE' | 'RESTORE' | 'IMPORT'
 * @return {string}
 */
function editorialActionOf_(val) {
  var a = String(val === undefined || val === null ? '' : val).toUpperCase();
  return (a === 'RESTORE' || a === 'IMPORT') ? a : 'SAVE';
}

/**
 * recordEditorialRevision_: arsipkan satu versi konten redaksi ke riwayat.
 * Versi besar (di atas batas aman sel Google Sheets) TIDAK diarsipkan agar
 * penyimpanan tetap berhasil; pemanggil menerima alasan penolakannya.
 * @param {object} content konten siap simpan (akan dinormalisasi ulang)
 * @param {string} user username pelaku
 * @param {string} action 'SAVE' | 'RESTORE' | 'IMPORT'
 * @param {string} label ringkasan singkat perubahan
 * @return {object} { saved: boolean, reason: string, chars: number }
 */
function recordEditorialRevision_(content, user, action, label) {
  var json = JSON.stringify(normalizeEditorialContent_(content));
  if (json.length > EDITORIAL_CELL_SAFE) {
    return { saved: false, reason: 'TOO_LARGE', chars: json.length };
  }
  try {
    Database.insert(TABS.EDITORIAL_HISTORY, {
      id: 'rev-' + new Date().getTime() + '-' + uuid().slice(0, 8),
      saved_at: new Date().toISOString(),
      saved_by: user || 'system',
      action: editorialActionOf_(action),
      label: label || '',
      content: json
    });
    trimEditorialHistory_();
    return { saved: true, reason: '', chars: json.length };
  } catch (e) {
    Logger.log('Gagal mengarsipkan versi redaksi: ' + e);
    return { saved: false, reason: 'ERROR', chars: json.length };
  }
}

/**
 * editorialHistoryList_: metadata riwayat versi (tanpa isi konten) agar
 * payload tetap kecil. Isi lengkap diambil lewat getEditorialRevision_.
 * @param {number} [limit] jumlah maksimum item
 * @return {Array<object>}
 */
function editorialHistoryList_(limit) {
  var max = Number(limit) > 0 ? Number(limit) : EDITORIAL_HISTORY_MAX;
  return editorialHistoryRows_().slice(0, max).map(function (r) {
    return {
      id: r.id,
      saved_at: r.saved_at,
      saved_by: r.saved_by || 'system',
      action: editorialActionOf_(r.action),
      label: r.label || '',
      chars: String(r.content || '').length
    };
  });
}

/**
 * getEditorialRevision_: isi lengkap satu versi (dinormalisasi ulang agar aman
 * dipulihkan walau nilainya pernah ditulis manual di spreadsheet).
 * @param {string} id id versi
 * @return {object|null} { meta, content }
 */
function getEditorialRevision_(id) {
  if (!id) return null;
  var row = null;
  try {
    row = Database.findOne(TABS.EDITORIAL_HISTORY, { id: String(id) });
  } catch (e) {
    row = null;
  }
  if (!row) return null;
  return {
    meta: {
      id: row.id,
      saved_at: row.saved_at,
      saved_by: row.saved_by || 'system',
      action: editorialActionOf_(row.action),
      label: row.label || ''
    },
    content: normalizeEditorialContent_(row.content)
  };
}

/**
 * getEditorialHistory: daftar versi konten redaksi (metadata saja).
 * SUPERADMIN & KETUA.
 */
function getEditorialHistory(ctx) {
  return {
    ok: true,
    data: {
      items: editorialHistoryList_(),
      max: EDITORIAL_HISTORY_MAX,
      cell_safe: EDITORIAL_CELL_SAFE
    },
    message: 'Riwayat versi konten redaksi berhasil dimuat.'
  };
}

/**
 * getEditorialRevision: isi lengkap satu versi untuk pratinjau sebelum dipulihkan.
 * SUPERADMIN & KETUA.
 */
function getEditorialRevision(ctx) {
  var p = ctx.payload || {};
  var rev = getEditorialRevision_(p.id);
  if (!rev) return { ok: false, data: null, message: 'Versi tersebut tidak ditemukan di riwayat redaksi.' };
  return { ok: true, data: rev, message: 'Versi redaksi berhasil dimuat.' };
}

/**
 * restoreEditorialRevision: pulihkan konten redaksi ke versi lama.
 * Kondisi saat ini diarsipkan lebih dahulu sehingga pemulihan tetap dapat
 * dibatalkan (tidak ada konten yang hilang permanen).
 * SUPERADMIN & KETUA.
 */
function restoreEditorialRevision(ctx) {
  var p = ctx.payload || {};
  var user = (ctx.user && ctx.user.username) || 'admin';
  var rev = getEditorialRevision_(p.id);
  if (!rev) return { ok: false, data: null, message: 'Versi tersebut tidak ditemukan di riwayat redaksi.' };

  var current = getEditorialContent_();
  var storedRaw = getSettingValue_(EDITORIAL_KEY, null);
  if (storedRaw !== null && JSON.stringify(current) === JSON.stringify(rev.content)) {
    return {
      ok: true,
      data: { content: current, restored: false, history: editorialHistoryList_() },
      message: 'Konten aktif sudah sama dengan versi tersebut — tidak ada perubahan.'
    };
  }

  // 1) Arsipkan kondisi saat ini agar pemulihan dapat dibatalkan.
  var snapshot = recordEditorialRevision_(
    current, user, 'SAVE', 'Sebelum memulihkan versi ' + editorialFmtStamp_(rev.meta.saved_at));

  // 2) Jadikan versi lama sebagai konten aktif & catat aksi pemulihan.
  setSettingValue_(EDITORIAL_KEY, rev.content, user);
  recordEditorialRevision_(rev.content, user, 'RESTORE', 'Dipulihkan dari versi ' + editorialFmtStamp_(rev.meta.saved_at));

  audit(user, 'EDITORIAL_RESTORED',
    'Memulihkan konten redaksi dari versi ' + rev.meta.id + ' (' + rev.meta.saved_at + ')', 'SETTINGS');

  var warnings = [];
  if (!snapshot.saved && snapshot.reason === 'TOO_LARGE') {
    warnings.push('Konten sebelumnya terlalu besar untuk diarsipkan otomatis (batas sel Google Sheets).');
  }

  return {
    ok: true,
    data: {
      content: rev.content,
      restored: true,
      restored_from: rev.meta,
      history: editorialHistoryList_(),
      warnings: warnings
    },
    message: 'Konten redaksi berhasil dipulihkan ke versi ' + editorialFmtStamp_(rev.meta.saved_at) + '.'
  };
}

// --------------------------------------------------------------------------
// EKSPOR & IMPOR KONTEN REDAKSI (berkas JSON)
// --------------------------------------------------------------------------
// Seluruh konten redaksi dapat diunduh sebagai satu berkas JSON untuk
// pencadangan (backup) dan dipindahkan ke lingkungan lain — misalnya
// menyiapkan konten di lingkungan uji lalu memasukkannya ke produksi.
// Berkas ekspor bersifat mandiri: memuat penanda format, waktu, pelaku, dan
// seluruh konten yang sudah ternormalisasi.
// --------------------------------------------------------------------------

/**
 * editorialExportFilename_: nama berkas cadangan yang ramah sistem berkas
 * (tanpa spasi/titik dua) agar aman diunduh di Windows, macOS, maupun Linux.
 * @param {string} iso waktu ekspor
 * @return {string} mis. 'redaksi-apii-2026-10-08-1811.json'
 */
function editorialExportFilename_(iso) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) d = new Date();
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  return 'redaksi-apii-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.json';
}

/**
 * editorialCounts_: ringkasan jumlah item konten (dipakai portal untuk
 * menampilkan isi berkas sebelum impor benar-benar dijalankan).
 * @param {object} content konten redaksi ternormalisasi
 * @return {object}
 */
function editorialCounts_(content) {
  var c = content || {};
  var be = c.bulletins_events || {};
  return {
    missions: Array.isArray((c.profile || {}).missions) ? c.profile.missions.length : 0,
    bulletins: Array.isArray(be.bulletins) ? be.bulletins.length : 0,
    events: Array.isArray(be.events) ? be.events.length : 0,
    faqs: Array.isArray(c.faqs) ? c.faqs.length : 0
  };
}

/**
 * editorialExportFile_: rakit berkas cadangan konten redaksi (objek + teks JSON).
 * @param {string} user username pelaku
 * @return {object}
 */
function editorialExportFile_(user) {
  var now = new Date().toISOString();
  var actor = user || 'system';
  var content = getEditorialContent_();
  var counts = editorialCounts_(content);
  var payload = {
    format: EDITORIAL_EXPORT_FORMAT,
    exported_at: now,
    exported_by: actor,
    origin: (typeof KONFIG !== 'undefined' && KONFIG && KONFIG.PUBLIC_URL) ? KONFIG.PUBLIC_URL : '',
    label: 'Cadangan konten redaksi Portal Publik SIAP APII',
    counts: counts,
    content: content
  };
  var json = JSON.stringify(payload, null, 2);
  return {
    filename: editorialExportFilename_(now),
    json: json,
    bytes: json.length,
    format: EDITORIAL_EXPORT_FORMAT,
    exported_at: now,
    exported_by: actor,
    counts: counts,
    content: content
  };
}

/**
 * parseEditorialImport_: baca & validasi berkas impor konten redaksi.
 * Menerima tiga bentuk agar praktis dipakai:
 *   1) berkas hasil ekspor APII  : { format, exported_at, content: { ... } }
 *   2) objek konten mentah       : { hero: { ... }, faqs: [ ... ] }
 *      (bentuk yang sama dengan yang tampil pada 'Lihat JSON lengkap versi ini')
 *   3) teks JSON dari kedua bentuk di atas
 * Berkas tanpa satu pun bagian konten redaksi DITOLAK, agar berkas JSON
 * sembarang tidak menimpa seluruh konten dengan nilai bawaan.
 * @param {*} raw teks JSON atau objek
 * @return {object} { ok, content, meta, message }
 */
function parseEditorialImport_(raw) {
  var data = raw;
  if (typeof data === 'string') {
    data = data.replace(/^\uFEFF/, '').trim();
    if (!data) {
      return { ok: false, content: null, meta: null,
        message: 'Berkas kosong — tidak ada isi yang dapat diimpor.' };
    }
    try {
      data = JSON.parse(data);
    } catch (e) {
      return { ok: false, content: null, meta: null,
        message: 'Berkas bukan JSON yang sah. Pilih berkas hasil ekspor redaksi (.json) yang belum diubah formatnya.' };
    }
  }
  if (data === undefined || data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, content: null, meta: null,
      message: 'Isi berkas tidak dikenali. Berkas harus berupa objek JSON konten redaksi.' };
  }

  // Berkas ekspor penuh dibungkus { format, exported_at, content }.
  var wrapped = (data.content && typeof data.content === 'object' && !Array.isArray(data.content)) ? data : null;
  if (wrapped && wrapped.format && String(wrapped.format).indexOf('apii-editorial') !== 0) {
    return { ok: false, content: null, meta: null,
      message: 'Format berkas "' + String(wrapped.format) + '" tidak dikenali. Berkas yang didukung: cadangan redaksi APII (format ' + EDITORIAL_EXPORT_FORMAT + ').' };
  }

  var content = wrapped ? wrapped.content : data;
  var known = EDITORIAL_CONTENT_KEYS_.filter(function (k) {
    return Object.prototype.hasOwnProperty.call(content, k);
  });
  if (!known.length) {
    return { ok: false, content: null, meta: null,
      message: 'Berkas tidak memuat bagian konten redaksi (hero, profil, maklumat, kontak, media sosial, atau FAQ). Impor dibatalkan agar konten aktif tidak tertimpa.' };
  }

  return {
    ok: true,
    content: normalizeEditorialContent_(content),
    meta: {
      format: (wrapped && wrapped.format) ? String(wrapped.format) : 'konten-mentah',
      exported_at: (wrapped && wrapped.exported_at) ? String(wrapped.exported_at) : '',
      exported_by: (wrapped && wrapped.exported_by) ? String(wrapped.exported_by) : '',
      origin: (wrapped && wrapped.origin) ? String(wrapped.origin) : '',
      sections: known
    },
    message: ''
  };
}

/**
 * exportEditorialContent: unduh seluruh konten redaksi sebagai berkas JSON
 * untuk pencadangan atau pemindahan ke lingkungan lain.
 * SUPERADMIN & KETUA.
 */
function exportEditorialContent(ctx) {
  var user = (ctx.user && ctx.user.username) || 'system';
  var file = editorialExportFile_(user);
  audit(user, 'EDITORIAL_EXPORTED',
    'Mengekspor konten redaksi ke berkas ' + file.filename + ' (' + file.bytes + ' karakter)', 'SETTINGS');
  return {
    ok: true,
    data: {
      filename: file.filename,
      json: file.json,
      bytes: file.bytes,
      format: file.format,
      exported_at: file.exported_at,
      counts: file.counts
    },
    message: 'Berkas cadangan konten redaksi siap diunduh.'
  };
}

/**
 * importEditorialContent: pulihkan atau pindahkan konten redaksi dari berkas
 * JSON. Konten yang sedang aktif diarsipkan lebih dahulu sehingga impor selalu
 * dapat dibatalkan (tidak ada konten yang hilang permanen).
 * SUPERADMIN & KETUA.
 */
function importEditorialContent(ctx) {
  var p = ctx.payload || {};
  var user = (ctx.user && ctx.user.username) || 'admin';
  var parsed = parseEditorialImport_(p.json !== undefined ? p.json : p.content);
  if (!parsed.ok) return { ok: false, data: null, message: parsed.message };

  var json = JSON.stringify(parsed.content);
  if (json.length > EDITORIAL_CELL_SAFE) {
    return {
      ok: false, data: null,
      message: 'Isi berkas terlalu besar (' + json.length + ' karakter), sedangkan satu sel Google Sheets ' +
        'maksimum 50.000 karakter. Kurangi jumlah maklumat/agenda/FAQ di berkas tersebut, lalu impor kembali.'
    };
  }

  var current = getEditorialContent_();
  if (JSON.stringify(current) === json) {
    return {
      ok: true,
      data: {
        content: current, imported: false, changed: [],
        source: parsed.meta, history: editorialHistoryList_(), warnings: [],
        counts: editorialCounts_(current)
      },
      message: 'Isi berkas sama dengan konten aktif — tidak ada yang berubah.'
    };
  }

  var changed = editorialChangedSections_(current, parsed.content);
  var stamp = parsed.meta.exported_at ? editorialFmtStamp_(parsed.meta.exported_at) : '';
  var asal = [];
  if (parsed.meta.exported_by) asal.push('oleh ' + parsed.meta.exported_by);
  if (stamp) asal.push(stamp);
  if (parsed.meta.origin) asal.push(parsed.meta.origin);
  var sourceNote = asal.length ? asal.join(' · ') : 'berkas lokal';

  // 1) Arsipkan konten aktif agar impor dapat dibatalkan.
  var warnings = [];
  var snapshot = recordEditorialRevision_(current, user, 'SAVE', 'Sebelum impor berkas (' + sourceNote + ')');
  if (!snapshot.saved) {
    warnings.push(snapshot.reason === 'TOO_LARGE'
      ? 'Konten sebelumnya terlalu besar untuk diarsipkan sehingga tidak masuk riwayat versi.'
      : 'Konten sebelumnya gagal diarsipkan ke riwayat versi (lihat log sistem).');
  }

  // 2) Terapkan konten dari berkas & catat aksi IMPOR.
  setSettingValue_(EDITORIAL_KEY, parsed.content, user);
  var recorded = recordEditorialRevision_(parsed.content, user, 'IMPORT', 'Impor dari berkas (' + sourceNote + ')');
  if (!recorded.saved) {
    warnings.push('Versi hasil impor gagal diarsipkan ke riwayat versi (lihat log sistem).');
  }

  audit(user, 'EDITORIAL_IMPORTED',
    'Mengimpor konten redaksi dari berkas JSON (' + sourceNote + '); bagian berubah: ' +
    (changed.length ? changed.join(', ') : 'tidak ada'), 'SETTINGS');

  return {
    ok: true,
    data: {
      content: parsed.content,
      imported: true,
      changed: changed,
      source: parsed.meta,
      history: editorialHistoryList_(),
      warnings: warnings,
      counts: editorialCounts_(parsed.content)
    },
    message: 'Konten redaksi berhasil diimpor' +
      (changed.length ? '. Bagian berubah: ' + changed.join(', ') + '.' : '.')
  };
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

  // Konten redaksi dinamis (mini-CMS) — selalu ternormalisasi & lengkap.
  settings[EDITORIAL_KEY] = getEditorialContent_();
  settings.editorial = settings[EDITORIAL_KEY];

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
  var warnings = [];
  var prepared = {};

  // 1) Validasi & normalisasi SELURUH nilai lebih dahulu: bila ada yang tidak
  //    sah, tidak ada satu pun pengaturan yang tertulis (all-or-nothing).
  for (var k in toSave) {
    var value = toSave[k];
    if (k === EDITORIAL_KEY) {
      value = normalizeEditorialContent_(value);
      var len = JSON.stringify(value).length;
      if (len > EDITORIAL_CELL_SAFE) {
        return {
          ok: false, data: null,
          message: 'Konten redaksi terlalu besar (' + len + ' karakter), sedangkan satu sel Google Sheets ' +
            'maksimum 50.000 karakter. Kurangi jumlah maklumat/agenda atau ringkas isinya, lalu simpan kembali.'
        };
      }
    }
    prepared[k] = value;
  }

  // 2) Tulis nilai yang sudah tervalidasi; versi SEBELUMNYA konten redaksi
  //    diarsipkan lebih dahulu agar penyimpanan tidak menimpa permanen.
  for (var key in prepared) {
    if (key === EDITORIAL_KEY) {
      var storedRaw = getSettingValue_(EDITORIAL_KEY, null);
      if (storedRaw !== null) {
        var previous = normalizeEditorialContent_(storedRaw);
        var changed = editorialChangedSections_(previous, prepared[key]);
        if (changed.length) {
          var snapshot = recordEditorialRevision_(
            previous, user, 'SAVE', 'Perubahan: ' + changed.join(', '));
          if (!snapshot.saved) {
            warnings.push(snapshot.reason === 'TOO_LARGE'
              ? 'Versi sebelumnya terlalu besar untuk diarsipkan sehingga tidak masuk riwayat versi.'
              : 'Versi sebelumnya gagal diarsipkan ke riwayat versi (lihat log sistem).');
          }
        }
      }
    }
    setSettingValue_(key, prepared[key], user);
  }

  audit(user, 'SETTINGS_UPDATED', 'Memperbarui pengaturan: ' + Object.keys(prepared).join(', '), 'SETTINGS');
  return { ok: true, data: prepared, settings: prepared, warnings: warnings, message: 'Pengaturan berhasil disimpan.' };
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
      editorial: getEditorialContent_(),
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
 * testDriveStorage: verifikasi koneksi Google Drive penyimpanan berkas.
 * SUPERADMIN.
 */
function testDriveStorage(ctx) {
  try {
    var folderId = siapkanFolderPdf_();
    var folder = DriveApp.getFolderById(folderId);
    var user = (ctx.user && ctx.user.username) || 'admin';
    audit(user, 'DRIVE_TESTED', 'Uji koneksi penyimpanan Google Drive: ' + folder.getName(), 'STORAGE');
    return {
      ok: true,
      data: {
        folder_id: folder.getId(),
        folder_name: folder.getName(),
        folder_url: folder.getUrl(),
        status: 'CONNECTED'
      },
      message: 'Koneksi Google Drive berhasil terverifikasi.'
    };
  } catch (err) {
    return { ok: false, data: null, message: 'Gagal terhubung ke Google Drive: ' + err.message };
  }
}

