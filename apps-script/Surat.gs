/**
 * SIAP APII v3.0.0 Enterprise - Surat.gs
 * Alur Kerja Persuratan Keluar, Penomoran Sekuensial Atomic, Verifikasi Hash & Drive Vault
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Daftar Surat Keluar Berdasarkan Tenant Pengurus
 */
function handleGetSuratList_(session, payload) {
  var reqWilayah = payload && payload.wilayah_id ? payload.wilayah_id : session.wilayahId;
  var targetWilayah = resolveAuthorizedWilayah_(session, reqWilayah);

  var filter = targetWilayah === 'ALL' ? null : { wilayah_id: targetWilayah };
  var rawList = dbFind('Sheet_Surat', filter, 200);

  var list = rawList.map(function(row) {
    return {
      id: row[COL_SURAT_KELUAR.ID],
      wilayahId: row[COL_SURAT_KELUAR.WILAYAH_ID],
      nomorSurat: row[COL_SURAT_KELUAR.NOMOR_SURAT],
      tipe: row[COL_SURAT_KELUAR.TIPE],
      perihal: row[COL_SURAT_KELUAR.PERIHAL],
      tujuan: row[COL_SURAT_KELUAR.TUJUAN],
      tanggal: row[COL_SURAT_KELUAR.TANGGAL],
      tanggalHijriah: row[COL_SURAT_KELUAR.TANGGAL_HIJRIAH],
      kontenJson: row[COL_SURAT_KELUAR.KONTEN_JSON],
      status: row[COL_SURAT_KELUAR.STATUS],
      signedBy: row[COL_SURAT_KELUAR.SIGNED_BY],
      hash: row[COL_SURAT_KELUAR.HASH_SHA256],
      pdfUrl: row[COL_SURAT_KELUAR.PDF_DRIVE_URL],
      createdBy: row[COL_SURAT_KELUAR.CREATED_BY],
      createdAt: row[COL_SURAT_KELUAR.CREATED_AT],
      catatanRevisi: row[COL_SURAT_KELUAR.CATATAN_REVISI] || ''
    };
  });

  return { ok: true, list: list };
}

/**
 * Simpan / Ajukan Draf Naskah Dinas Keluar (Sekretaris - SoD Pengonsep)
 */
function handleSaveSurat_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'sekretaris']);
  if (!roleGuard.ok) return roleGuard;

  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);
  var suratId = payload.id || ('SRT-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000));
  var kopMeta = getKopMetadata(wilayahId);
  var now = new Date();
  var tglStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy');
  var hijriFormatted = formatOfficialDateKop(kopMeta.kotaKop, now);

  var status = payload.status || 'DRAFT'; // DRAFT, DRAFT_REVISI, atau AJUKAN
  if (status === 'APPROVED' || status === 'PUBLISHED') {
    status = 'AJUKAN'; // Pengonsep dilarang melangkahi otorisasi Ketua
  }

  var existing = dbFindOne('Sheet_Surat', { id: suratId });
  if (existing) {
    var tenantGuard = assertRecordTenantAccess_(session, existing[COL_SURAT_KELUAR.WILAYAH_ID]);
    if (!tenantGuard.ok) return tenantGuard;

    if (existing[COL_SURAT_KELUAR.STATUS] === 'APPROVED') {
      return { ok: false, error: 'Surat yang telah disahkan (APPROVED) tidak dapat diubah kembali.' };
    }

    var updateMap = {};
    if (payload.tipe !== undefined) updateMap[COL_SURAT_KELUAR.TIPE] = payload.tipe;
    if (payload.perihal !== undefined) updateMap[COL_SURAT_KELUAR.PERIHAL] = payload.perihal;
    if (payload.tujuan !== undefined) updateMap[COL_SURAT_KELUAR.TUJUAN] = payload.tujuan;
    if (payload.konten_json !== undefined) updateMap[COL_SURAT_KELUAR.KONTEN_JSON] = JSON.stringify(payload.konten_json || {});
    updateMap[COL_SURAT_KELUAR.STATUS] = status;
    if (status === 'AJUKAN') {
      updateMap[COL_SURAT_KELUAR.CATATAN_REVISI] = '';
    }
    dbUpdate('Sheet_Surat', COL_SURAT_KELUAR.ID, suratId, updateMap);
  } else {
    var rowArray = [
      suratId,
      wilayahId,
      payload.nomor_surat || 'DRAFT / BELUM DITERBITKAN',
      payload.tipe || 'Surat Tugas',
      payload.perihal || 'Penugasan Dakwah',
      payload.tujuan || 'Yang Dituju',
      tglStr,
      hijriFormatted,
      JSON.stringify(payload.konten_json || {}),
      status,
      '', // signed_by
      '', // hash_sha256
      '', // pdf_drive_url
      session.username,
      Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss'),
      ''  // catatan_revisi
    ];
    dbInsert('Sheet_Surat', rowArray);
  }

  logAudit(session.userId, wilayahId, 'SAVE_SURAT', 'SuratKeluar', suratId, { perihal: payload.perihal, status: status });
  return { ok: true, suratId: suratId, status: status, message: 'Draf surat berhasil disimpan.' };
}

/**
 * Pengesahan & Penerbitan Surat Keluar Resmi (Ketua Umum / Ketua Wilayah)
 * Mengunci nomor sekuensial atomic anti-loncat & membubuhkan tanda tangan + stempel resmi
 */
function handleApproveSurat_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua']);
  if (!roleGuard.ok) return roleGuard;

  var suratId = payload.surat_id || payload.id;
  if (!suratId) {
    return { ok: false, error: 'ID surat wajib disertakan.' };
  }
  var isApproved = (payload.is_approved !== false) && (payload.approved !== false) && (payload.status !== 'REJECTED'); // true = approve, false = reject
  var catatanRevisi = payload.catatan_revisi || payload.catatanRevisi || '';

  return withScriptLock_(function() {
    var suratRow = dbFindOne('Sheet_Surat', { id: suratId });
    if (!suratRow) {
      return { ok: false, error: 'Naskah surat tidak ditemukan.' };
    }

    var wilayahId = suratRow[COL_SURAT_KELUAR.WILAYAH_ID];
    var tenantGuard = assertRecordTenantAccess_(session, wilayahId);
    if (!tenantGuard.ok) return tenantGuard;

    if (suratRow[COL_SURAT_KELUAR.STATUS] === 'APPROVED') {
      return { ok: false, error: 'Surat ini sudah disahkan sebelumnya.' };
    }

    var kopMeta = getKopMetadata(wilayahId);
    var now = new Date();

    if (!isApproved) {
      // Alur Penolakan Tanpa Kunci Mati (Unblocked Rejection Loop dengan Catatan Revisi)
      var rejectMap = {};
      rejectMap[COL_SURAT_KELUAR.STATUS] = 'REJECTED';
      rejectMap[COL_SURAT_KELUAR.CATATAN_REVISI] = catatanRevisi || 'Perlu perbaikan redaksi oleh Sekretariat.';
      dbUpdate('Sheet_Surat', COL_SURAT_KELUAR.ID, suratId, rejectMap);
      logAudit(session.userId, wilayahId, 'REJECT_SURAT', 'SuratKeluar', suratId, { catatanRevisi: rejectMap[COL_SURAT_KELUAR.CATATAN_REVISI] });
      return {
        ok: true,
        status: 'REJECTED',
        catatanRevisi: rejectMap[COL_SURAT_KELUAR.CATATAN_REVISI],
        message: 'Naskah dikembalikan ke Sekretaris dengan catatan revisi.'
      };
    }

    // Jika Disetujui: Bangkitkan Nomor Sekuensial Resmi via Lock Atomic
    var counterType = 'SURAT_' + (suratRow[COL_SURAT_KELUAR.TIPE] || 'UMUM');
    var seqNum = getNextSequence(wilayahId, counterType);
    var padSeq = ('000' + seqNum).slice(-3); // 001, 002, 005
    var romanMonth = toRomanMonth(now.getMonth() + 1);
    var year = now.getFullYear();

    // Kode jenis surat
    var kodeTipe = 'ST';
    var tipe = suratRow[COL_SURAT_KELUAR.TIPE] || '';
    if (tipe.indexOf('Keputusan') !== -1) kodeTipe = 'SK';
    else if (tipe.indexOf('Mandat') !== -1) kodeTipe = 'SM';
    else if (tipe.indexOf('Undangan') !== -1) kodeTipe = 'UND';
    else if (tipe.indexOf('Rekomendasi') !== -1) kodeTipe = 'REK';
    else if (tipe.indexOf('Maklumat') !== -1) kodeTipe = 'MAK';

    // Format baku penomoran: [NOMOR_URUT]/[KODE_SURAT]-[KODE_TENANT]/[BULAN_ROMAWI]/[TAHUN]
    var nomorResmi = padSeq + '/' + kodeTipe + '-' + kopMeta.kodeSuratTenant + '/' + romanMonth + '/' + year;

    // Hitung Tanda Tangan Digital Hash SHA-256 Integritas Naskah (Deterministik untuk Verifikasi Publik)
    var rawToHash = nomorResmi + '|' + suratRow[COL_SURAT_KELUAR.PERIHAL] + '|' + suratRow[COL_SURAT_KELUAR.TANGGAL] + '|' + session.username;
    var hashSha256 = sha256Hex_(rawToHash);

    // Perbarui Database
    var approveMap = {};
    approveMap[COL_SURAT_KELUAR.NOMOR_SURAT] = nomorResmi;
    approveMap[COL_SURAT_KELUAR.STATUS] = 'APPROVED';
    approveMap[COL_SURAT_KELUAR.SIGNED_BY] = session.username;
    approveMap[COL_SURAT_KELUAR.HASH_SHA256] = hashSha256;
    approveMap[COL_SURAT_KELUAR.CATATAN_REVISI] = '';
    dbUpdate('Sheet_Surat', COL_SURAT_KELUAR.ID, suratId, approveMap);

    logAudit(session.userId, wilayahId, 'PUBLISH_SURAT', 'SuratKeluar', suratId, {
      nomorSurat: nomorResmi,
      hash: hashSha256
    });

    return {
      ok: true,
      status: 'APPROVED',
      nomorSurat: nomorResmi,
      hash: hashSha256,
      message: 'Surat dinas resmi berhasil disahkan, ditandatangani, dan diterbitkan.'
    };
  }, 10000);
}

/**
 * One-Click Decree Generator: Mengajukan Draf SK Pengesahan Susunan Kepengurusan A4 (2-Step Auth)
 * Disusun oleh Sekretaris -> Status awal AJUKAN (Menunggu Pengesahan Ketua)
 */
function handleGenerateSKKepengurusan_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'sekretaris']);
  if (!roleGuard.ok) return roleGuard;

  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);
  var wilayahRow = dbFindOne('Sheet_Wilayah', { id: wilayahId });
  var namaWilayah = wilayahRow ? wilayahRow[COL_WILAYAH.NAMA] : 'Wilayah';
  var konsideran = getKonsideranSKStruktur(namaWilayah, payload.periode_tahun);

  var kontenJson = {
    konsideran: konsideran,
    personalia: payload.personalia_list || []
  };

  return handleSaveSurat_(session, {
    wilayah_id: wilayahId,
    tipe: 'Surat Keputusan (SK)',
    perihal: 'Pengesahan Susunan Personalia Pengurus ' + namaWilayah,
    tujuan: 'Jajaran Pengurus & Anggota ' + namaWilayah,
    konten_json: kontenJson,
    status: 'AJUKAN'
  });
}

