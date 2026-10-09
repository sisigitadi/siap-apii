/**
 * ============================================================================
 * Pengaturan.gs — Route Pengaturan & Penyimpanan Drive
 * ============================================================================
 * Tanggung jawab: getSettings (baca seluruh pengaturan sistem), updateSettings
 * (simpan perubahan), getDriveStorage/resetDriveStorage (status & reset
 * penyimpanan Drive), createDriveFolder, dan syncEditorialContent.
 *
 * Catatan: fungsi getSettingValue_ tetap di Utils.gs karena dipakai banyak
 * modul lain; modul ini hanya menangani route pengaturan yang dibawa ROUTES.
 * ==========================================================================*/
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
    open_divisions: Array.isArray(regCfg.open_divisions) ? regCfg.open_divisions.filter(function (d) {
      return !!DIVISION_LABELS[d];
    }) : Object.keys(DIVISIONS),
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
 * uploadEditorialImages_: tangani gambar yang diunggah dari form redaksi
 * (hero beranda & poster agenda/acara). Berkas dikirim sebagai data URL base64,
 * disimpan ke subfolder Drive yayasan yang sesuai, lalu URL hasilnya dipakai
 * sebagai image_url. Field base64 dibuang sehingga tidak pernah tersimpan di
 * Sheet_Settings (sel Google Sheets terbatas 50.000 karakter).
 * @param {object} content objek editorial_content mentah (diubah secara inplace)
 * @param {string} user username pelaku (untuk audit bila diperlukan)
 * @return {object} content yang sama, sudah tanpa field base64
 */
function uploadEditorialImages_(content, user) {
  if (!content || typeof content !== 'object') return content;
  var stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // --- Hero beranda ---
  if (content.hero && typeof content.hero === 'object' && content.hero.image_base64) {
    var ext = uploadImageExt_(content.hero.image_base64);
    var url = saveUploadToDrive_(content.hero.image_base64, 'hero-' + stamp + '.' + ext, 'Konten_Hero');
    if (url) content.hero.image_url = url;
    delete content.hero.image_base64;
  }

  // --- Poster setiap agenda/acara ---
  var be = content.bulletins_events;
  if (be && Array.isArray(be.events)) {
    for (var i = 0; i < be.events.length; i++) {
      var ev = be.events[i];
      if (!ev || typeof ev !== 'object' || !ev.image_base64) continue;
      var evExt = uploadImageExt_(ev.image_base64);
      var evName = 'agenda-' + stamp + '-' + (i + 1) + '.' + evExt;
      var evUrl = saveUploadToDrive_(ev.image_base64, evName, 'Konten_Agenda');
      if (evUrl) ev.image_url = evUrl;
      delete ev.image_base64;
    }
  }

  return content;
}

/**
 * uploadImageExt_: ekstensi berkas dari data URL gambar (png/jpg/webp/gif).
 * @param {string} dataUrl mis. 'data:image/png;base64,...'
 * @return {string} ekstensi tanpa titik; default 'jpg'
 */
function uploadImageExt_(dataUrl) {
  var s = String(dataUrl || '');
  var m = s.match(/^data:image\/([a-z0-9+.-]+);/i);
  if (!m) return 'jpg';
  var t = m[1].toLowerCase().split('+')[0];
  if (t === 'jpeg') return 'jpg';
  if (['png', 'jpg', 'webp', 'gif'].indexOf(t) !== -1) return t;
  return 'jpg';
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
      // Unggah gambar hero & poster agenda ke Drive SEBELUM normalisasi: data
      // URL base64 tidak boleh masuk ke sel Sheet_Settings (batas 50.000 kar.).
      value = uploadEditorialImages_(value, user);
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

  // 3) Sinkronisasi khusus Google Drive: bila google_drive_folder_id / custom_folder_id
  //    diubah, verifikasi foldernya lalu simpan sebagai folder aktif (Script Properties)
  //    agar surat & berkas berikutnya tersimpan di folder yang benar.
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
    open_divisions: Object.keys(DIVISIONS),
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
      },
      media: {
        hero_image_url: (getEditorialContent_().hero && getEditorialContent_().hero.image_url) || ''
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
    var subfolders = ['Surat_Resmi', 'Surat_Lampiran', 'Keuangan_Bukti_Nota', 'Pendaftaran_KTP', 'Pendaftaran_Selfie', 'Surat_Publikasi', 'Keuangan_QRIS', 'Konten_Hero', 'Konten_Agenda'];
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
    var user = (ctx.user && ctx.user.username) || 'admin';

    // Bersihkan SELURUH penunjuk folder custom TERLEBIH DAHULU. Bila ini
    // dilakukan setelah siapkanFolderPdf_(), fungsi tersebut masih membaca
    // drive_storage.custom_folder_id sehingga folder custom lama dipakai ulang
    // (dan ID-nya dituliskan kembali ke ScriptProperties) — "Reset ke Default"
    // tidak benar-benar kembali ke folder default organisasi.
    props.deleteProperty('DRIVE_FOLDER_ID');
    setSettingValue_('google_drive_folder_id', '', user);
    setSettingValue_('drive_storage', {
      custom_folder_id: '',
      folder_name: '',
      auto_annual_subfolders: true
    }, user);

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
