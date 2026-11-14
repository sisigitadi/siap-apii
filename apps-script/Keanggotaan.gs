/**
 * SIAP APII v3.0.0 Enterprise - Keanggotaan.gs
 * Registrasi Anggota Nasional 100% Bebas Biaya, NIA Otomatis, Masa Berlaku 5 Tahun & KTA CR80
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Pendaftaran Mandiri Anggota Baru dari Portal Publik (100% Gratis & Selektif)
 */
function handleRegisterMember_(payload) {
  if (!payload || !payload.nama || !payload.nik || !payload.no_wa) {
    return { ok: false, error: 'Nama lengkap, NIK, dan nomor WhatsApp wajib diisi.' };
  }

  return withScriptLock_(function() {
    var now = new Date();
    var wilayahId = payload.wilayah_id || 'DPW_JABO'; // Default wilayah kanonik pilot aktif
    var pendaftarId = 'REG-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000);

    // Cek apakah NIK sudah pernah mendaftar secara atomik
    var existingNik = dbFindOne('Sheet_Pendaftar', { nik: payload.nik });
    if (existingNik) {
      return {
        ok: false,
        error: 'NIK ' + String(payload.nik).substring(0, 4) + '**********' + String(payload.nik).slice(-2) + ' sudah terdaftar di sistem keanggotaan APII.'
      };
    }

    var rowArray = [
      pendaftarId,
      wilayahId,
      payload.nik,
      payload.nama,
      payload.tempat_lahir || '',
      payload.tgl_lahir || '',
      payload.gender || 'Laki-laki',
      payload.alamat || '',
      payload.no_wa,
      payload.email || '',
      payload.divisi_minat || 'dakwah',
      payload.ktp_watermark_url || '',
      payload.pasfoto_url || '',
      'MENUNGGU_VERIFIKASI',
      '', // verified_sekretaris_at
      '', // approved_ketua_at
      ''  // nia_assigned
    ];

    dbInsert('Sheet_Pendaftar', rowArray);
    logAudit('PUBLIC_APPLICANT', wilayahId, 'REGISTER_MEMBER', 'Pendaftar', pendaftarId, { nama: payload.nama });

    return {
      ok: true,
      pendaftarId: pendaftarId,
      wilayahId: wilayahId,
      message: 'Pendaftaran anggota berhasil dikirimkan. Berkas Anda akan diverifikasi oleh Sekretariat Wilayah secara selektif.'
    };
  }, 10000);
}

/**
 * Mengambil Daftar Calon Anggota (Portal Pengurus)
 */
function handleGetPendaftarList_(session, payload) {
  var reqWilayah = payload && payload.wilayah_id ? payload.wilayah_id : session.wilayahId;
  var targetWilayah = resolveAuthorizedWilayah_(session, reqWilayah);

  var filter = targetWilayah === 'ALL' ? null : { wilayah_id: targetWilayah };
  var rawList = dbFind('Sheet_Pendaftar', filter, 300);

  var list = rawList.map(function(row) {
    // Masking NIK untuk privasi pengurus (UU PDP)
    var rawNik = String(row[COL_PENDAFTAR.NIK] || '');
    var maskedNik = rawNik.length >= 8 ? rawNik.substring(0, 4) + '********' + rawNik.slice(-4) : rawNik;

    return {
      id: row[COL_PENDAFTAR.ID],
      wilayahId: row[COL_PENDAFTAR.WILAYAH_ID],
      nikMasked: maskedNik,
      nama: row[COL_PENDAFTAR.NAMA],
      tempatLahir: row[COL_PENDAFTAR.TEMPAT_LAHIR],
      tglLahir: row[COL_PENDAFTAR.TGL_LAHIR],
      gender: row[COL_PENDAFTAR.GENDER],
      alamat: row[COL_PENDAFTAR.ALAMAT],
      noWa: row[COL_PENDAFTAR.NO_WA],
      email: row[COL_PENDAFTAR.EMAIL],
      divisiMinat: row[COL_PENDAFTAR.DIVISI_MINAT],
      ktpUrl: row[COL_PENDAFTAR.KTP_WATERMARK_URL],
      pasfotoUrl: row[COL_PENDAFTAR.PASFOTO_URL],
      status: row[COL_PENDAFTAR.STATUS], // MENUNGGU_VERIFIKASI, VERIFIED_SEKRETARIS, APPROVED, REJECTED
      verifiedSekretarisAt: row[COL_PENDAFTAR.VERIFIED_SEKRETARIS_AT],
      approvedKetuaAt: row[COL_PENDAFTAR.APPROVED_KETUA_AT],
      niaAssigned: row[COL_PENDAFTAR.NIA_ASSIGNED]
    };
  });

  return { ok: true, list: list };
}

/**
 * Verifikasi Tahap 1 Calon Anggota oleh Sekretaris
 */
function handleVerifyPendaftarSekretaris_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'sekretaris']);
  if (!roleGuard.ok) return roleGuard;

  var pendaftarId = payload.pendaftar_id;
  if (!pendaftarId) return { ok: false, error: 'ID pendaftar wajib disertakan.' };

  var pendaftarRow = dbFindOne('Sheet_Pendaftar', { id: pendaftarId });
  if (!pendaftarRow) return { ok: false, error: 'Data pendaftar tidak ditemukan.' };

  var tenantGuard = assertRecordTenantAccess_(session, pendaftarRow[COL_PENDAFTAR.WILAYAH_ID]);
  if (!tenantGuard.ok) return tenantGuard;

  var isLolos = payload.is_lolos !== false;
  var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
  var status = isLolos ? 'VERIFIED_SEKRETARIS' : 'REJECTED';

  var updateMap = {};
  updateMap[COL_PENDAFTAR.STATUS] = status;
  updateMap[COL_PENDAFTAR.VERIFIED_SEKRETARIS_AT] = nowStr;
  dbUpdate('Sheet_Pendaftar', COL_PENDAFTAR.ID, pendaftarId, updateMap);

  logAudit(session.userId, pendaftarRow[COL_PENDAFTAR.WILAYAH_ID], 'VERIFY_PENDAFTAR_SEKRETARIS', 'Pendaftar', pendaftarId, { status: status });
  return { ok: true, status: status, message: isLolos ? 'Berkas pendaftar lolos verifikasi Sekretaris, diajukan ke Ketua.' : 'Pendaftar ditolak.' };
}

/**
 * Helper Internal Penerbitan NIA Kanonik & Pencatatan ke Sheet_KTA_Nasional
 */
function issueCanonicalNiaAndKta_(pendaftarRow, tingkatLisensi, ktaDriveUrl, actorUserId) {
  return withScriptLock_(function() {
    var pendaftarId = pendaftarRow[COL_PENDAFTAR.ID];
    var wilayahId = pendaftarRow[COL_PENDAFTAR.WILAYAH_ID] || 'DPW_JABO';
    var wilayahRow = dbFindOne('Sheet_Wilayah', { id: wilayahId });
    var rawKode = wilayahRow ? wilayahRow[COL_WILAYAH.KODE] : (wilayahId === 'DPP_PUSAT' ? 'PUSAT' : wilayahId);
    var kodeWilayah = String(rawKode || 'JABO').replace(/^(DPW[_-]|DPP[_-])/i, '').toUpperCase() || 'PUSAT';

    var now = new Date();
    var nowStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
    var tahunMasuk = now.getFullYear();

    // Hitung Tanggal Kedaluwarsa Tepat 5 Tahun Kalender
    var expireDate = new Date(now.getFullYear() + 5, now.getMonth(), now.getDate());
    var expireStr = Utilities.formatDate(expireDate, 'Asia/Jakarta', 'dd-MM-yyyy');
    var terbitStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy');

    // Bangkitkan Nomor Induk Anggota (NIA) Sekuensial Atomic
    // Contoh: APII-JABO-2026-00001
    var seqNia = getNextSequence('NASIONAL', 'NIA_NASIONAL');
    var padNia = ('00000' + seqNia).slice(-5);
    var niaResmi = 'APII-' + kodeWilayah + '-' + tahunMasuk + '-' + padNia;

    var lisensi = tingkatLisensi || 'Tingkat 1 (Dai Muda)';

    var updateMap = {};
    updateMap[COL_PENDAFTAR.STATUS] = 'APPROVED';
    updateMap[COL_PENDAFTAR.APPROVED_KETUA_AT] = nowStr;
    updateMap[COL_PENDAFTAR.NIA_ASSIGNED] = niaResmi;
    dbUpdate('Sheet_Pendaftar', COL_PENDAFTAR.ID, pendaftarId, updateMap);

    dbInsert('Sheet_KTA_Nasional', [
      niaResmi,
      wilayahId,
      pendaftarId,
      pendaftarRow[COL_PENDAFTAR.NAMA],
      lisensi,
      terbitStr,
      expireStr,
      'Kode Etik APII v2026 (5 Butir)',
      ktaDriveUrl || '',
      'https://apologetislamindonesia.or.id/public/#/verifikasi?token=' + encodeURIComponent(niaResmi),
      'TRUE'
    ]);

    logAudit(actorUserId, wilayahId, 'APPROVE_ANGGOTA_KTA', 'KTA', niaResmi, {
      pendaftarId: pendaftarId,
      nama: pendaftarRow[COL_PENDAFTAR.NAMA]
    });

    return {
      nia: niaResmi,
      terbitStr: terbitStr,
      expireStr: expireStr
    };
  }, 10000);
}

/**
 * Pengesahan Akhir Anggota & Penerbitan NIA Nasional 5 Tahun oleh Ketua
 */
function handleApproveAnggotaKetua_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua']);
  if (!roleGuard.ok) return roleGuard;

  var pendaftarId = payload.pendaftar_id;
  if (!pendaftarId) return { ok: false, error: 'ID pendaftar wajib disertakan.' };

  var pendaftarRow = dbFindOne('Sheet_Pendaftar', { id: pendaftarId });
  if (!pendaftarRow) return { ok: false, error: 'Data pendaftar tidak ditemukan.' };

  var tenantGuard = assertRecordTenantAccess_(session, pendaftarRow[COL_PENDAFTAR.WILAYAH_ID]);
  if (!tenantGuard.ok) return tenantGuard;

  if (pendaftarRow[COL_PENDAFTAR.STATUS] === 'APPROVED' && pendaftarRow[COL_PENDAFTAR.NIA_ASSIGNED]) {
    return { ok: true, nia: pendaftarRow[COL_PENDAFTAR.NIA_ASSIGNED], message: 'Anggota ini sudah disahkan sebelumnya.' };
  }

  var issued = issueCanonicalNiaAndKta_(pendaftarRow, payload.tingkat_lisensi, payload.kta_drive_url, session.userId);

  return {
    ok: true,
    nia: issued.nia,
    masaBerlaku: '5 Tahun (s/d ' + issued.expireStr + ')',
    message: 'Anggota resmi telah disahkan Ketua. Kartu Tanda Anggota (KTA) Digital CR80 resmi aktif.'
  };
}

