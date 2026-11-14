/**
 * SIAP APII v3.0.0 Enterprise - Setup.gs
 * Fungsi Inisialisasi Idempoten (setup), Seeding Master 28 Tabel & Public API Handlers
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Inisialisasi Idempoten 28 Tabel Google Sheets & Akun Awal
 * Aman dijalankan berulang kali tanpa menimpa data yang sudah ada (Safe Migration)
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Spreadsheet aktif tidak ditemukan. Pastikan skrip terpasang di Google Sheets.');
  }

  Logger.log('=== MEMULAI SETUP IDEMPOTEN SIAP APII v3.0.0 ENTERPRISE ===');

  // 1. Inisialisasi 28 Tabel
  for (var tableName in TABLES_SCHEMA) {
    var sheet = ss.getSheetByName(tableName);
    var cols = TABLES_SCHEMA[tableName];

    if (!sheet) {
      sheet = ss.insertSheet(tableName);
      sheet.appendRow(cols);
      // Format baris header: latar Deep Emerald (#064E3B), teks putih tebal
      var headerRange = sheet.getRange(1, 1, 1, cols.length);
      headerRange.setBackground('#064E3B');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
      Logger.log('[NEW TABLE] ' + tableName + ' (' + cols.length + ' kolom)');
    } else {
      // Periksa dan sinkronisasi kolom yang mungkin belum ada di paling kanan
      var currentLastCol = sheet.getLastColumn();
      var currentHeaders = currentLastCol > 0 ? sheet.getRange(1, 1, 1, currentLastCol).getValues()[0] : [];
      for (var c = 0; c < cols.length; c++) {
        if (currentHeaders.indexOf(cols[c]) === -1) {
          sheet.getRange(1, currentLastCol + 1).setValue(cols[c]);
          currentLastCol++;
        }
      }
    }
  }

  // 2. Inisialisasi Master Data Wilayah (DPP Pusat & Pilot DPW Jabodetabek)
  var sheetWilayah = ss.getSheetByName('Sheet_Wilayah');
  if (sheetWilayah.getLastRow() <= 1) {
    sheetWilayah.appendRow(['DPP_PUSAT', 'Dewan Pimpinan Pusat (DPP)', 'DPP-APII', 'pusat', 'Gedung Dakwah Pusat APII, Jakarta', 'TRUE']);
    sheetWilayah.appendRow(['DPW_JABO', 'DPW Jabodetabek (Pilot Percontohan)', 'DPW-JABO', 'jabodetabek', 'Sekretariat DPW Jabodetabek, Jakarta Selatan', 'TRUE']);
    Logger.log('[SEED WILAYAH] 2 Wilayah Awal (DPP Pusat & DPW Jabodetabek) Berhasil Ditambahkan');
  }

  // 3. Inisialisasi Akun Pengurus Awal (Superadmin, BPH & Perwakilan Divisi)
  var sheetUsers = ss.getSheetByName('Sheet_Users');
  if (sheetUsers.getLastRow() <= 1) {
    var defaultPass = 'Demo123';
    var defaultHash = hashPassword_(defaultPass);
    var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');

    // Superadmin Nasional
    sheetUsers.appendRow([
      'USR-SUPERADMIN-01',
      'DPP_PUSAT',
      'admin',
      'Superadmin Nasional APII',
      'admin@apologetislamindonesia.or.id',
      '+6281358575678',
      defaultHash,
      'superadmin',
      'ALL_PERMISSIONS',
      'TRUE',
      nowStr,
      ''
    ]);

    // Ketua Umum DPP
    sheetUsers.appendRow([
      'USR-KETUM-01',
      'DPP_PUSAT',
      'ketua',
      'Ustadz Ketua Umum DPP APII',
      'ketum@apologetislamindonesia.or.id',
      '+6281200000001',
      defaultHash,
      'ketua',
      'KETUA_APPROVAL',
      'TRUE',
      nowStr,
      ''
    ]);

    // Sekretaris Umum DPP
    sheetUsers.appendRow([
      'USR-SEKJEN-01',
      'DPP_PUSAT',
      'sekretaris',
      'Ustadz Sekretaris Umum DPP APII',
      'sekretaris@apologetislamindonesia.or.id',
      '+6281200000002',
      defaultHash,
      'sekretaris',
      'PERSURATAN_DISPOSISI',
      'TRUE',
      nowStr,
      ''
    ]);

    // Bendahara Umum DPP
    sheetUsers.appendRow([
      'USR-BENDUM-01',
      'DPP_PUSAT',
      'bendahara',
      'Ustadz Bendahara Umum DPP APII',
      'bendahara@apologetislamindonesia.or.id',
      '+6281200000003',
      defaultHash,
      'bendahara',
      'KAS_KEUANGAN',
      'TRUE',
      nowStr,
      ''
    ]);

    // Ketua Divisi Dakwah DPP
    sheetUsers.appendRow([
      'USR-KADIV-DAKWAH-01',
      'DPP_PUSAT',
      'kadiv_dakwah',
      'Ketua Divisi Dakwah DPP APII',
      'dakwah@apologetislamindonesia.or.id',
      '+6281200000004',
      defaultHash,
      'ketua_divisi',
      'DIVISI_DAKWAH',
      'TRUE',
      nowStr,
      'dakwah'
    ]);

    // Ketua Divisi Hukum & Advokasi DPW Jabodetabek
    sheetUsers.appendRow([
      'USR-KADIV-HUKUM-JABO',
      'DPW_JABO',
      'kadiv_hukum_jabo',
      'Ketua Divisi Hukum DPW Jabodetabek',
      'hukum.jabo@apologetislamindonesia.or.id',
      '+6281200000005',
      defaultHash,
      'ketua_divisi',
      'DIVISI_HUKUM',
      'TRUE',
      nowStr,
      'hukum'
    ]);

    Logger.log('[SEED USERS] 6 Akun Pengurus Awal Berhasil Dibuat (Password default: ' + defaultPass + ')');
  }

  // 4. Inisialisasi Rekening Bank Resmi
  var sheetAcc = ss.getSheetByName('Sheet_Accounts');
  if (sheetAcc.getLastRow() <= 1) {
    sheetAcc.appendRow(['ACC-01', 'DPP_PUSAT', 'Bank Syariah Indonesia (BSI)', '7770001497', 'Yayasan Apologet Islam Indonesia', 'BANK', 'TRUE']);
    sheetAcc.appendRow(['ACC-02', 'DPP_PUSAT', 'QRIS Kas Masuk Dakwah Nasional', 'NMID-APII-PUSAT', 'Yayasan Apologet Islam Indonesia', 'QRIS', 'TRUE']);
    sheetAcc.appendRow(['ACC-03', 'DPP_PUSAT', 'Kasir Tunai Kesekretariatan (Batas Rp 2 Juta)', 'CASH-BUFFER-PUSAT', 'Bendahara Umum', 'CASH', 'TRUE']);
  }

  // 5. Inisialisasi Bank Dalil Awal (Knowledge Base)
  var sheetKb = ss.getSheetByName('Sheet_Knowledge_Base');
  if (sheetKb.getLastRow() <= 1) {
    sheetKb.appendRow([
      'KB-01',
      'Kristologi & Teologi',
      'Ketuhanan Yesus dalam Perspektif Al-Qur\'an',
      'QS. Al-Ma\'idah: 72 - "Sesungguhnya telah kafirlah orang-orang yang berkata: Sesungguhnya Allah ialah Al-Masih putra Maryam..."',
      'Tafsir Ibnu Katsir Jilid 3 Hal 150',
      'Yesus, Nabi Isa, Ketuhanan, Tritunggal, Al-Maidah 72',
      'Divisi Litbang APII',
      Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
    ]);
  }

  SpreadsheetApp.flush();
  Logger.log('=== SETUP PARIPURNA SELESAI DENGAN SUKSES ===');
  return { ok: true, message: 'Setup 28 tabel Google Sheets dan inisialisasi master data SIAP APII berhasil dilaksanakan.' };
}

// ============================================================================
// HANDLER FUNGSI PUBLIK & CMS
// ============================================================================

function handleVerifyPublicDoc_(token, expectedHash) {
  if (!token) return { ok: false, error: 'Token verifikasi tidak valid atau kosong.' };
  var cleanToken = String(token).trim();

  // 1. Cek apakah ini KTA Anggota
  var kta = dbFindOne('Sheet_KTA_Nasional', { nia: cleanToken });
  if (kta) {
    if (String(kta[COL_KTA_NASIONAL.IS_ACTIVE]).toLowerCase() !== 'true') {
      return { ok: false, error: 'KTA Anggota tidak aktif atau telah dicabut.' };
    }
    var pendaftarId = kta[COL_KTA_NASIONAL.PENDAFTAR_ID];
    if (pendaftarId) {
      var pend = dbFindOne('Sheet_Pendaftar', { id: pendaftarId });
      if (pend && pend[COL_PENDAFTAR.STATUS] !== 'APPROVED') {
        return { ok: false, error: 'Status pendaftaran anggota belum berstatus APPROVED.' };
      }
    }
    var expStr = kta[COL_KTA_NASIONAL.TGL_KEDALUWARSA];
    if (expStr) {
      var expDate = parseDateString_(expStr);
      var todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (expDate < todayStart) {
        return { ok: false, expired: true, error: 'KTA Anggota telah kedaluwarsa pada ' + expStr + '.' };
      }
    }
    var wilayahRow = dbFindOne('Sheet_Wilayah', { id: kta[COL_KTA_NASIONAL.WILAYAH_ID] });
    return {
      ok: true,
      tipe: 'KTA_ANGGOTA',
      nia: kta[COL_KTA_NASIONAL.NIA],
      nama: kta[COL_KTA_NASIONAL.NAMA_LENGKAP],
      tingkatLisensi: kta[COL_KTA_NASIONAL.TINGKAT_LISENSI],
      wilayah: wilayahRow ? wilayahRow[COL_WILAYAH.NAMA] : 'Wilayah APII',
      tglTerbit: kta[COL_KTA_NASIONAL.TGL_TERBIT],
      tglKedaluwarsa: expStr,
      statusKeaktifan: 'AKTIF RESMI',
      kodeEtik: kta[COL_KTA_NASIONAL.KODE_ETIK_VERSI]
    };
  }

  // 2. Cek apakah ini Surat Dinas Resmi (berdasarkan nomor surat, hash SHA-256, atau ID)
  var surat = dbFindOne('Sheet_Surat', { nomor_surat: cleanToken });
  if (!surat) {
    surat = dbFindOne('Sheet_Surat', { hash_sha256: cleanToken });
  }
  if (!surat) {
    surat = dbFindOne('Sheet_Surat', { id: cleanToken });
  }

  if (surat) {
    var suratStatus = surat[COL_SURAT_KELUAR.STATUS];
    if (suratStatus !== 'APPROVED') {
      return {
        ok: false,
        error: 'Dokumen belum disahkan atau tidak berstatus APPROVED (Status saat ini: ' + suratStatus + ').'
      };
    }

    var storedHash = String(surat[COL_SURAT_KELUAR.HASH_SHA256] || '').trim().toLowerCase();
    var expectedDeterministic = sha256Hex_(
      surat[COL_SURAT_KELUAR.NOMOR_SURAT] + '|' +
      surat[COL_SURAT_KELUAR.PERIHAL] + '|' +
      surat[COL_SURAT_KELUAR.TANGGAL] + '|' +
      surat[COL_SURAT_KELUAR.SIGNED_BY]
    );

    var isTampered = false;
    if (!storedHash || !/^[a-f0-9]{64}$/.test(storedHash)) {
      isTampered = true;
    } else if (storedHash !== expectedDeterministic) {
      isTampered = true;
    } else if (expectedHash && String(expectedHash).trim().toLowerCase() !== storedHash) {
      isTampered = true;
    }

    if (isTampered) {
      return {
        ok: false,
        tampered: true,
        message: 'PERINGATAN: DOKUMEN TIDAK VALID / TELAH DIMANIPULASI!',
        error: 'PERINGATAN: DOKUMEN TIDAK VALID / TELAH DIMANIPULASI!'
      };
    }

    var wilayahRow2 = dbFindOne('Sheet_Wilayah', { id: surat[COL_SURAT_KELUAR.WILAYAH_ID] });
    return {
      ok: true,
      tipe: 'SURAT_DINAS',
      nomorSurat: surat[COL_SURAT_KELUAR.NOMOR_SURAT],
      jenisSurat: surat[COL_SURAT_KELUAR.TIPE],
      perihal: surat[COL_SURAT_KELUAR.PERIHAL],
      penerbit: wilayahRow2 ? wilayahRow2[COL_WILAYAH.NAMA] : 'Yayasan APII',
      tanggal: surat[COL_SURAT_KELUAR.TANGGAL_HIJRIAH] || surat[COL_SURAT_KELUAR.TANGGAL],
      penandatangan: surat[COL_SURAT_KELUAR.SIGNED_BY],
      status: suratStatus,
      hashSha256: storedHash,
      keabsahan: '100% ASLI & TERDAFTAR DI GOOGLE DRIVE VAULT RESMI APII'
    };
  }

  // 3. Cek apakah ini Piagam Ikrar Syahadat Muallaf
  var muallaf = dbFindOne('Sheet_Muallaf', { reg_no: cleanToken });
  if (muallaf) {
    return {
      ok: true,
      tipe: 'PIAGAM_SYAHADAT',
      regNo: muallaf[COL_MUALLAF.REG_NO],
      namaAsli: muallaf[COL_MUALLAF.NAMA_ASLI],
      namaHijrah: muallaf[COL_MUALLAF.NAMA_HIJRAH],
      tglSyahadat: muallaf[COL_MUALLAF.TGL_SYAHADAT],
      pembimbing: muallaf[COL_MUALLAF.PEMBIMBING],
      keabsahan: 'SAH TERCATAT DI DIVISI DAKWAH & PEMBINAAN MUALLAF APII'
    };
  }

  // 4. Cek apakah ini Kwitansi Kas Resmi (BKM / BKK) -> Wajib APPROVED
  var kas = dbFindOne('Sheet_Keuangan', { no_voucher: cleanToken });
  if (!kas) {
    kas = dbFindOne('Sheet_Keuangan', { no_kwitansi: cleanToken });
  }
  if (kas) {
    var kasStatus = kas[COL_KEUANGAN.STATUS_APPROVAL];
    if (kasStatus !== 'APPROVED') {
      return {
        ok: false,
        error: 'Bukti transaksi kas belum berstatus APPROVED (Status saat ini: ' + kasStatus + ').'
      };
    }
    return {
      ok: true,
      tipe: 'KWITANSI_KAS',
      noVoucher: kas[COL_KEUANGAN.NO_VOUCHER],
      noKwitansi: kas[COL_KEUANGAN.NO_KWITANSI],
      kantongSyariah: kas[COL_KEUANGAN.KANTONG_SYARIAH],
      nominal: Number(kas[COL_KEUANGAN.NOMINAL]) || 0,
      tanggal: kas[COL_KEUANGAN.TANGGAL],
      keterangan: kas[COL_KEUANGAN.KETERANGAN],
      status: kasStatus,
      keabsahan: 'BUKTI KAS RESMI TERCATAT DI BUKU KAS UMUM (BKU) APII'
    };
  }

  return { ok: false, error: 'Nomor atau kode verifikasi tidak ditemukan di basis data resmi Yayasan APII.' };
}

function handleGetPublicContent_(wilayahSlug) {
  var slug = wilayahSlug || 'pusat';
  var wilayahRow = dbFindOne('Sheet_Wilayah', { slug: slug });
  var wilayahId = wilayahRow ? wilayahRow[COL_WILAYAH.ID] : 'DPP_PUSAT';

  // Smart Fallback jika data wilayah lokal kosong
  var wartaList = dbFind('Sheet_EditorialHistory', { wilayah_id: wilayahId }, 10);
  if (wartaList.length === 0 && wilayahId !== 'DPP_PUSAT') {
    wartaList = dbFind('Sheet_EditorialHistory', { wilayah_id: 'DPP_PUSAT' }, 10);
  }

  return {
    ok: true,
    wilayah: {
      id: wilayahId,
      nama: wilayahRow ? wilayahRow[COL_WILAYAH.NAMA] : 'Dewan Pimpinan Pusat (DPP)',
      slug: slug,
      alamat: wilayahRow ? wilayahRow[COL_WILAYAH.ALAMAT] : 'Gedung Dakwah Pusat APII, Jakarta'
    },
    wartaMaklumat: wartaList.map(function(r) {
      return { id: r[0], wilayahId: r[1], kategori: r[2], judul: r[3], konten: r[4], author: r[5], updatedAt: r[6] };
    })
  };
}

function handleSavePublicContent_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'sekretaris', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  var wilayahId = resolveAuthorizedWilayah_(session, payload && payload.wilayah_id);
  var id = (payload && payload.id) || ('CMS-' + new Date().getTime());
  var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');

  var existing = dbFindOne('Sheet_EditorialHistory', { id: id });
  if (existing) {
    var tenantGuard = assertRecordTenantAccess_(session, existing[COL_EDITORIAL_HISTORY.WILAYAH_ID]);
    if (!tenantGuard.ok) return tenantGuard;

    var updateMap = {};
    if (payload.kategori !== undefined) updateMap[COL_EDITORIAL_HISTORY.KATEGORI] = payload.kategori;
    if (payload.judul !== undefined) updateMap[COL_EDITORIAL_HISTORY.JUDUL] = payload.judul;
    if (payload.konten !== undefined) updateMap[COL_EDITORIAL_HISTORY.KONTEN] = payload.konten;
    updateMap[COL_EDITORIAL_HISTORY.AUTHOR] = session.username;
    updateMap[COL_EDITORIAL_HISTORY.UPDATED_AT] = nowStr;
    dbUpdate('Sheet_EditorialHistory', COL_EDITORIAL_HISTORY.ID, id, updateMap);
  } else {
    dbInsert('Sheet_EditorialHistory', [
      id,
      wilayahId,
      (payload && payload.kategori) || 'WARTA',
      (payload && payload.judul) || 'Maklumat Resmi APII',
      (payload && payload.konten) || '',
      session.username,
      nowStr
    ]);
  }

  logAudit(session.userId, wilayahId, 'SAVE_PUBLIC_CONTENT', 'EditorialCMS', id, { judul: payload && payload.judul });
  return { ok: true, id: id, message: 'Konten warta/agenda publik berhasil dipublikasikan.' };
}

function handleGetWilayahList_() {
  var raw = dbFind('Sheet_Wilayah', { is_active: 'TRUE' });
  var list = raw.map(function(r) {
    return { id: r[0], nama: r[1], kode: r[2], slug: r[3], alamat: r[4] };
  });
  return { ok: true, list: list };
}

function handleRecordVisitor_(payload) {
  var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
  dbInsert('Sheet_Visitors', [
    'VIS-' + new Date().getTime(),
    payload.wilayah_id || 'DPP_PUSAT',
    nowStr,
    payload.ip_hash || 'anon',
    payload.user_agent || '',
    payload.page_viewed || '/'
  ]);
  return { ok: true };
}

function handleGetDashboardStats_(session, targetWilayah) {
  var wil = resolveAuthorizedWilayah_(session, targetWilayah);

  var filter = wil === 'ALL' ? null : { wilayah_id: wil };
  var suratCount = dbFind('Sheet_Surat', filter).length;
  var suratMasukCount = dbFind('Sheet_Surat_Masuk', filter).length;
  var pendaftarCount = dbFind('Sheet_Pendaftar', filter).length;
  var keuangan = handleGetKeuanganList_(session, { wilayah_id: wil });

  return {
    ok: true,
    stats: {
      suratKeluarCount: suratCount,
      suratMasukCount: suratMasukCount,
      pendaftarCount: pendaftarCount,
      saldoKas: keuangan.saldo
    }
  };
}

function handleGetUsersList_(session) {
  if (session.role !== 'superadmin') {
    return { ok: false, error: 'Hanya Superadmin yang berwenang melihat daftar seluruh pengguna.' };
  }
  var raw = dbFind('Sheet_Users', null, 200);
  var list = raw.map(function(r) {
    return {
      userId: r[COL_USERS.USER_ID],
      wilayahId: r[COL_USERS.WILAYAH_ID],
      username: r[COL_USERS.USERNAME],
      fullname: r[COL_USERS.FULLNAME],
      email: r[COL_USERS.EMAIL],
      phone: r[COL_USERS.PHONE],
      role: r[COL_USERS.ROLE],
      divisi: r[COL_USERS.DIVISI] || '',
      isActive: r[COL_USERS.IS_ACTIVE]
    };
  });
  return { ok: true, list: list };
}

function handleSaveUser_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin']);
  if (!roleGuard.ok) return roleGuard;

  var userId = payload.user_id || ('USR-' + new Date().getTime() + '-' + Utilities.getUuid().substring(0, 6).toUpperCase());
  var passwordHash = hashPassword_(payload.password || 'APII@Baru2026');
  var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
  var isActiveStr = (payload.is_active === false || String(payload.is_active).toUpperCase() === 'FALSE' || String(payload.is_active) === '0')
    ? 'FALSE'
    : 'TRUE';

  var existing = dbFindOne('Sheet_Users', { user_id: userId });
  if (existing) {
    var updateMap = {};
    if (payload.wilayah_id !== undefined) updateMap[COL_USERS.WILAYAH_ID] = payload.wilayah_id;
    if (payload.username !== undefined) updateMap[COL_USERS.USERNAME] = payload.username;
    if (payload.fullname !== undefined) updateMap[COL_USERS.FULLNAME] = payload.fullname;
    if (payload.email !== undefined) updateMap[COL_USERS.EMAIL] = payload.email;
    if (payload.phone !== undefined) updateMap[COL_USERS.PHONE] = payload.phone;
    if (payload.role !== undefined) updateMap[COL_USERS.ROLE] = payload.role;
    if (payload.divisi !== undefined) updateMap[COL_USERS.DIVISI] = payload.divisi;
    updateMap[COL_USERS.IS_ACTIVE] = isActiveStr;
    dbUpdate('Sheet_Users', COL_USERS.USER_ID, userId, updateMap);

    if (isActiveStr === 'FALSE') {
      revokeAllUserSessions_(userId);
      revokeAllUserSessions_(existing[COL_USERS.USERNAME]);
    }
  } else {
    dbInsert('Sheet_Users', [
      userId,
      payload.wilayah_id || 'DPP_PUSAT',
      payload.username,
      payload.fullname,
      payload.email || '',
      payload.phone || '',
      passwordHash,
      payload.role || 'anggota_divisi',
      'STANDARD',
      isActiveStr,
      nowStr,
      payload.divisi || ''
    ]);
  }

  logAudit(session.userId, session.wilayahId, 'SAVE_USER', 'User', userId, { role: payload.role, isActive: isActiveStr });
  return { ok: true, userId: userId, message: 'Data pengguna pengurus berhasil disimpan.' };
}

function handleRegisterNewWilayah_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin']);
  if (!roleGuard.ok) return roleGuard;

  var rawKode = payload.kode || payload.code || 'NEW';
  var cleanCode = String(rawKode).toUpperCase().replace(/^(DPW[_-])/i, '').replace(/[^A-Z0-9]/g, '');
  var id = 'DPW_' + (cleanCode || 'NEW');
  var existing = dbFindOne('Sheet_Wilayah', { id: id });
  if (existing) {
    return { ok: false, error: 'Kode wilayah ' + id + ' sudah terdaftar.' };
  }

  var nama = payload.nama || payload.name || ('DPW ' + cleanCode);
  var kode = payload.kode || payload.code || ('DPW-' + cleanCode);
  var slug = payload.slug || cleanCode.toLowerCase();
  var alamat = payload.alamat || payload.address || (payload.city ? ('Sekretariat DPW APII, ' + payload.city) : '');

  dbInsert('Sheet_Wilayah', [
    id,
    nama,
    kode,
    slug,
    alamat,
    'TRUE'
  ]);

  logAudit(session.userId, 'DPP_PUSAT', 'REGISTER_TENANT_WILAYAH', 'Wilayah', id, { nama: nama, slug: slug });
  return { ok: true, wilayahId: id, slug: slug, message: 'DPW baru berhasil didaftarkan ke jaringan multi-tenant nasional.' };
}

function handleAddNewTenantWilayah_(session, payload) {
  return handleRegisterNewWilayah_(session, payload);
}

function handleGetAuditLogs_(session, payload) {
  if (['superadmin', 'pengawas', 'pembina'].indexOf(session.role) === -1) {
    return { ok: false, error: 'Hanya Dewan Pengawas, Pembina, atau Superadmin yang berwenang meninjau log audit.' };
  }

  var targetWilayah = resolveAuthorizedWilayah_(session, payload && payload.wilayah_id);
  var filter = (session.role === 'superadmin' || session.role === 'pengawas') && targetWilayah === 'ALL' ? null : { wilayah_id: targetWilayah };
  var rawList = dbFind('Sheet_AuditLogs', filter, 200);

  var list = rawList.map(function(r) {
    return {
      id: r[COL_AUDIT_LOGS.ID],
      timestamp: r[COL_AUDIT_LOGS.TIMESTAMP],
      userId: r[COL_AUDIT_LOGS.USER_ID],
      wilayahId: r[COL_AUDIT_LOGS.WILAYAH_ID],
      action: r[COL_AUDIT_LOGS.ACTION],
      entity: r[COL_AUDIT_LOGS.ENTITY],
      recordId: r[COL_AUDIT_LOGS.RECORD_ID],
      entityId: r[COL_AUDIT_LOGS.RECORD_ID],
      details: r[COL_AUDIT_LOGS.DETAILS_JSON],
      ipAddress: r[COL_AUDIT_LOGS.IP_ADDRESS]
    };
  });

  return { ok: true, list: list };
}

function handleGetSettings_(session) {
  var rows = dbFind('Sheet_Settings', null, 500);
  var settings = {};
  for (var i = 0; i < rows.length; i++) {
    settings[rows[i][0]] = rows[i][1];
  }
  return { ok: true, settings: settings };
}

function handleGetSettingsAudit_(session, payload) {
  if (['superadmin', 'pengawas', 'pembina', 'ketua'].indexOf(session.role) === -1) {
    return { ok: false, error: 'Anda tidak memiliki izin melihat riwayat perubahan pengaturan sistem.' };
  }
  var rows = dbFind('Sheet_Settings_Audit', null, 200);
  var list = rows.map(function(r) {
    return {
      id: r[COL_SETTINGS_AUDIT.ID],
      key: r[COL_SETTINGS_AUDIT.KEY],
      oldValue: r[COL_SETTINGS_AUDIT.OLD_VALUE],
      newValue: r[COL_SETTINGS_AUDIT.NEW_VALUE],
      changedBy: r[COL_SETTINGS_AUDIT.CHANGED_BY],
      timestamp: r[COL_SETTINGS_AUDIT.TIMESTAMP]
    };
  });
  return { ok: true, list: list };
}

function handleSaveSettings_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin']);
  if (!roleGuard.ok) return roleGuard;

  var newSettings = payload.settings || {};
  var now = new Date();
  var nowStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
  var existingRows = dbFind('Sheet_Settings', null, 500);
  var existingMap = {};
  for (var i = 0; i < existingRows.length; i++) {
    existingMap[existingRows[i][0]] = existingRows[i][1];
  }

  var changedKeys = [];
  for (var key in newSettings) {
    var oldVal = String(existingMap[key] || '');
    var newVal = String(newSettings[key] || '');
    if (oldVal !== newVal) {
      // Record Diff in Sheet_Settings_Audit
      var auditId = 'SET-AUD-' + Math.floor(1000 + Math.random() * 9000);
      dbInsert('Sheet_Settings_Audit', [
        auditId,
        key.toUpperCase(),
        oldVal,
        newVal,
        session.userId,
        nowStr
      ]);

      // Upsert Sheet_Settings
      var existingRow = dbFindOne('Sheet_Settings', { key: key });
      if (existingRow) {
        dbUpdate('Sheet_Settings', { key: key }, {
          value: newVal,
          updated_by: session.userId,
          updated_at: nowStr
        });
      } else {
        dbInsert('Sheet_Settings', [
          key,
          newVal,
          payload.wilayah_id || 'DPP_PUSAT',
          session.userId,
          nowStr
        ]);
      }
      changedKeys.push(key);
    }
  }

  logAudit(session.userId, 'DPP_PUSAT', 'UPDATE_SETTINGS', 'Settings', 'MASTER_SETTINGS', { changedKeys: changedKeys });
  return { ok: true, message: 'Master Pengaturan Yayasan berhasil disinkronkan.', changedCount: changedKeys.length };
}

function handleGetActiveSessions_(session) {
  if (['superadmin', 'ketua', 'sekretaris'].indexOf(session.role) === -1) {
    return { ok: false, error: 'Hanya Ketua, Sekretaris, atau Superadmin yang berwenang memantau sesi login multi-device.' };
  }

  var userLookup = {};
  var userRows = dbFind('Sheet_Users', null, 300);
  for (var u = 0; u < userRows.length; u++) {
    userLookup[userRows[u][COL_USERS.USER_ID]] = userRows[u];
  }

  var filter = isNationalExecutive_(session) ? null : { wilayah_id: session.wilayahId };
  var rows = dbFind('Sheet_Sessions', filter, 200);
  var sessions = rows.map(function(r) {
    var uRow = userLookup[r[COL_SESSIONS.USER_ID]];
    var fullName = r[COL_SESSIONS.FULLNAME] || (uRow ? uRow[COL_USERS.FULLNAME] : r[COL_SESSIONS.USERNAME]);
    var divisi = r[COL_SESSIONS.DIVISI] || (uRow ? (uRow[COL_USERS.DIVISI] || '') : '');
    return {
      token: r[COL_SESSIONS.TOKEN],
      userId: r[COL_SESSIONS.USER_ID],
      username: r[COL_SESSIONS.USERNAME],
      fullName: fullName,
      role: r[COL_SESSIONS.ROLE],
      tenantId: r[COL_SESSIONS.WILAYAH_ID],
      divisi: divisi,
      device: r[COL_SESSIONS.DEVICE] || 'Web Portal Browser',
      ipAddress: r[COL_SESSIONS.IP_ADDRESS] || '-',
      loginAt: r[COL_SESSIONS.LOGIN_AT] || '-',
      expiresAt: r[COL_SESSIONS.EXPIRES_AT]
    };
  });

  return { ok: true, sessions: sessions };
}

function handleRevokeSession_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin']);
  if (!roleGuard.ok) return roleGuard;

  var token = payload.token;
  if (!token) {
    return { ok: false, error: 'Token sesi wajib disertakan.' };
  }

  var deleted = dbDelete('Sheet_Sessions', COL_SESSIONS.TOKEN, token);
  logAudit(session.userId, 'DPP_PUSAT', 'REVOKE_SESSION', 'Session', token, { revokedBy: session.userId });
  return { ok: deleted, message: deleted ? 'Izin sesi perangkat berhasil dicabut.' : 'Token sesi tidak ditemukan.' };
}

function handleGetDeadlockQueue_(session, payload) {
  if (session.role !== 'superadmin') {
    return { ok: false, error: 'Hanya Superadmin Nasional yang berwenang melihat antrean Deadlock Breaker.' };
  }

  var queue = [];

  // 1. Surat Keluar tertahan
  var suratRows = dbFind('Sheet_Surat', null, 200);
  for (var i = 0; i < suratRows.length; i++) {
    var sr = suratRows[i];
    if (sr[COL_SURAT_KELUAR.STATUS] === 'AJUKAN' || sr[COL_SURAT_KELUAR.STATUS] === 'DRAFT') {
      queue.push({
        type: 'surat',
        id: sr[COL_SURAT_KELUAR.ID],
        wilayahId: sr[COL_SURAT_KELUAR.WILAYAH_ID],
        title: sr[COL_SURAT_KELUAR.PERIHAL],
        status: sr[COL_SURAT_KELUAR.STATUS],
        createdAt: sr[COL_SURAT_KELUAR.CREATED_AT]
      });
    }
  }

  // 2. Kas Keluar tertahan (termasuk VERIFIKASI_BENDAHARA, VERIFIED_BENDAHARA, VERIFIKASI_KETUM)
  var kasRows = dbFind('Sheet_Keuangan', null, 200);
  for (var k = 0; k < kasRows.length; k++) {
    var kr = kasRows[k];
    var ks = kr[COL_KEUANGAN.STATUS_APPROVAL];
    if (kr[COL_KEUANGAN.TIPE] === 'KELUAR' && (ks === 'VERIFIKASI_BENDAHARA' || ks === 'VERIFIED_BENDAHARA' || ks === 'VERIFIKASI_KETUM')) {
      queue.push({
        type: 'kas',
        id: kr[COL_KEUANGAN.ID],
        wilayahId: kr[COL_KEUANGAN.WILAYAH_ID],
        title: kr[COL_KEUANGAN.KETERANGAN] + ' (' + formatRupiah(kr[COL_KEUANGAN.NOMINAL]) + ')',
        status: ks,
        createdAt: kr[COL_KEUANGAN.CREATED_AT]
      });
    }
  }

  // 3. Disposisi / Surat Masuk tertahan
  var smRows = dbFind('Sheet_Surat_Masuk', null, 200);
  for (var m = 0; m < smRows.length; m++) {
    var sm = smRows[m];
    if (sm[COL_SURAT_MASUK.STATUS_DISPOSISI] === 'MENUNGGU_DISPOSISI') {
      queue.push({
        type: 'disposisi',
        id: sm[COL_SURAT_MASUK.ID],
        wilayahId: sm[COL_SURAT_MASUK.WILAYAH_ID],
        title: sm[COL_SURAT_MASUK.NO_AGENDA] + ' - ' + sm[COL_SURAT_MASUK.PERIHAL],
        status: sm[COL_SURAT_MASUK.STATUS_DISPOSISI],
        createdAt: sm[COL_SURAT_MASUK.CREATED_AT]
      });
    }
  }

  // 4. Pendaftar KTA tertahan
  var penRows = dbFind('Sheet_Pendaftar', null, 200);
  for (var p = 0; p < penRows.length; p++) {
    var pr = penRows[p];
    if (pr[COL_PENDAFTAR.STATUS] === 'MENUNGGU_VERIFIKASI' || pr[COL_PENDAFTAR.STATUS] === 'VERIFIED_SEKRETARIS') {
      queue.push({
        type: 'kta',
        id: pr[COL_PENDAFTAR.ID],
        wilayahId: pr[COL_PENDAFTAR.WILAYAH_ID],
        title: 'Calon Anggota: ' + pr[COL_PENDAFTAR.NAMA],
        status: pr[COL_PENDAFTAR.STATUS],
        createdAt: ''
      });
    }
  }

  return { ok: true, queue: queue };
}

function handleExecuteDeadlockBreaker_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin']);
  if (!roleGuard.ok) return roleGuard;

  var docType = payload.doc_type;
  var docId = payload.doc_id;
  var reason = payload.reason;
  var docRef = payload.doc_ref || 'SK-DPP/PLENO-DARURAT/XI/2026';

  if (!reason || reason.length < 15) {
    return { ok: false, error: 'Alasan kedaruratan wajib minimal 15 karakter.' };
  }

  return withScriptLock_(function() {
    var now = new Date();
    var nowStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
    var resolvedItem = null;

    if (docType === 'surat') {
      var surat = dbFindOne('Sheet_Surat', { id: docId });
      if (surat) {
        var wilSurat = surat[COL_SURAT_KELUAR.WILAYAH_ID];
        var nomorResmi = surat[COL_SURAT_KELUAR.NOMOR_SURAT];
        if (!nomorResmi || nomorResmi.indexOf('DRAFT') !== -1) {
          var kopMeta = getKopMetadata(wilSurat);
          var seqNum = getNextSequence(wilSurat, 'SURAT_' + (surat[COL_SURAT_KELUAR.TIPE] || 'UMUM'));
          var padSeq = ('000' + seqNum).slice(-3);
          var kodeTipe = 'ST';
          var tipeSurat = surat[COL_SURAT_KELUAR.TIPE] || '';
          if (tipeSurat.indexOf('Keputusan') !== -1) kodeTipe = 'SK';
          else if (tipeSurat.indexOf('Mandat') !== -1) kodeTipe = 'SM';
          else if (tipeSurat.indexOf('Undangan') !== -1) kodeTipe = 'UND';
          else if (tipeSurat.indexOf('Rekomendasi') !== -1) kodeTipe = 'REK';
          else if (tipeSurat.indexOf('Maklumat') !== -1) kodeTipe = 'MAK';
          nomorResmi = padSeq + '/' + kodeTipe + '-' + kopMeta.kodeSuratTenant + '/' + toRomanMonth(now.getMonth() + 1) + '/' + now.getFullYear();
        }
        var signer = session.userId + ' [SUPERADMIN DEADLOCK OVERRIDE]';
        var hashSha = sha256Hex_(nomorResmi + '|' + surat[COL_SURAT_KELUAR.PERIHAL] + '|' + surat[COL_SURAT_KELUAR.TANGGAL] + '|' + signer);
        dbUpdate('Sheet_Surat', { id: docId }, {
          nomor_surat: nomorResmi,
          status: 'APPROVED',
          signed_by: signer,
          hash_sha256: hashSha
        });
        resolvedItem = { id: docId, type: 'Surat Keluar', nomorSurat: nomorResmi };
      }
    } else if (docType === 'kas') {
      var kas = dbFindOne('Sheet_Keuangan', { id: docId });
      if (kas) {
        var wilKas = kas[COL_KEUANGAN.WILAYAH_ID];
        var noVoucher = kas[COL_KEUANGAN.NO_VOUCHER];
        var noKwitansi = kas[COL_KEUANGAN.NO_KWITANSI];
        if (!noVoucher || noVoucher.indexOf('DRAFT') !== -1) {
          var seqBkk = getNextSequence(wilKas, 'KAS_BKK');
          var padSeqBkk = ('000' + seqBkk).slice(-3);
          var ym = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMM');
          noVoucher = 'BKK-' + ym + '-' + padSeqBkk;
          noKwitansi = 'KW-OUT-' + ym + '-' + padSeqBkk;
        }
        dbUpdate('Sheet_Keuangan', { id: docId }, {
          no_voucher: noVoucher,
          status_approval: 'APPROVED',
          approved_ketua_by: session.userId + ' [SUPERADMIN DEADLOCK OVERRIDE]',
          no_kwitansi: noKwitansi
        });
        resolvedItem = { id: docId, type: 'Kas Keluar', noVoucher: noVoucher };
      }
    } else if (docType === 'disposisi') {
      var disp = dbFindOne('Sheet_Disposisi', { id: docId });
      if (!disp) {
        disp = dbFindOne('Sheet_Disposisi', { surat_masuk_id: docId });
      }
      var smRow = dbFindOne('Sheet_Surat_Masuk', { id: disp ? disp[COL_DISPOSISI.SURAT_MASUK_ID] : docId });
      var smId = smRow ? smRow[COL_SURAT_MASUK.ID] : (disp ? disp[COL_DISPOSISI.SURAT_MASUK_ID] : null);
      if (disp) {
        dbUpdate('Sheet_Disposisi', { id: disp[COL_DISPOSISI.ID] }, {
          status: 'DIDISPOSISIKAN',
          paraf_ketua: 'PARAF_SUPERADMIN_DEADLOCK',
          instruksi_ketua: 'Instruksi Pengesahan Darurat Superadmin: ' + reason,
          updated_at: nowStr
        });
      } else if (smRow) {
        dbInsert('Sheet_Disposisi', [
          'DSP-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMddHHmmss'),
          smRow[COL_SURAT_MASUK.WILAYAH_ID],
          smId,
          '',
          'Instruksi Pengesahan Darurat Superadmin: ' + reason,
          'umum',
          'Segera',
          '',
          '',
          'PARAF_SUPERADMIN_DEADLOCK',
          'DIDISPOSISIKAN',
          '',
          nowStr,
          '{}'
        ]);
      }
      if (smId) {
        dbUpdate('Sheet_Surat_Masuk', { id: smId }, {
          status_disposisi: 'SUDAH_DIDISPOSISIKAN'
        });
        resolvedItem = { id: docId, suratMasukId: smId, type: 'Disposisi' };
      }
    } else if (docType === 'kta') {
      var pendaftar = dbFindOne('Sheet_Pendaftar', { id: docId });
      if (pendaftar) {
        var issued = issueCanonicalNiaAndKta_(pendaftar, payload.tingkat_lisensi, '', session.userId);
        resolvedItem = { id: docId, nia: issued.nia, type: 'KTA Anggota' };
      }
    }

    if (!resolvedItem) {
      return { ok: false, error: 'Dokumen target tidak ditemukan di sistem.' };
    }

    logAudit(session.userId, 'DPP_PUSAT', 'SUPERADMIN_OVERRIDE', docType.toUpperCase(), docId, {
      reason: reason,
      risalahRef: docRef,
      resolvedItem: resolvedItem
    });

    return {
      ok: true,
      message: 'Deadlock Breaker Berhasil: Pengesahan darurat telah dieksekusi dan dicatat di WORM Audit Trail.',
      resolvedItem: resolvedItem
    };
  }, 10000);
}

