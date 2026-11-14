/**
 * SIAP APII v3.0.0 Enterprise - SuratMasuk.gs
 * Manajemen Buku Agenda Digital Surat Masuk & Registrasi Berkas Scan/PDF
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Mengambil Daftar Agenda Surat Masuk Beserta Status Disposisi Per Divisi
 */
function handleGetSuratMasukList_(session, payload) {
  var reqWilayah = payload && payload.wilayah_id ? payload.wilayah_id : session.wilayahId;
  var targetWilayah = resolveAuthorizedWilayah_(session, reqWilayah);

  var filter = targetWilayah === 'ALL' ? null : { wilayah_id: targetWilayah };
  var rawList = dbFind('Sheet_Surat_Masuk', filter, 200);
  var rawDisposisi = dbFind('Sheet_Disposisi', filter, 300);

  var dispBySuratMasuk = {};
  for (var i = 0; i < rawDisposisi.length; i++) {
    var dRow = rawDisposisi[i];
    var smId = dRow[COL_DISPOSISI.SURAT_MASUK_ID];
    var laporanPerDivisi = {};
    try {
      if (dRow[COL_DISPOSISI.LAPORAN_PER_DIVISI]) {
        laporanPerDivisi = JSON.parse(dRow[COL_DISPOSISI.LAPORAN_PER_DIVISI]);
      }
    } catch (e) {
      laporanPerDivisi = {};
    }
    dispBySuratMasuk[smId] = {
      disposisiId: dRow[COL_DISPOSISI.ID],
      drafRekomendasi: dRow[COL_DISPOSISI.DRAF_REKOMENDASI_SEKRETARIS],
      instruksiKetua: dRow[COL_DISPOSISI.INSTRUKSI_KETUA],
      targetDivisi: String(dRow[COL_DISPOSISI.TUJUAN_DIVISI_PEJABAT] || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean),
      tingkatUrgensi: dRow[COL_DISPOSISI.TINGKAT_URGENSI],
      batasWaktu: dRow[COL_DISPOSISI.BATAS_WAKTU],
      catatanTambahan: dRow[COL_DISPOSISI.CATATAN_TAMBAHAN],
      parafKetua: dRow[COL_DISPOSISI.PARAF_KETUA],
      status: dRow[COL_DISPOSISI.STATUS],
      laporanTindakLanjut: dRow[COL_DISPOSISI.LAPORAN_TINDAK_LANJUT],
      laporanPerDivisi: laporanPerDivisi
    };
  }

  var list = rawList.map(function(row) {
    var smId = row[COL_SURAT_MASUK.ID];
    var disp = dispBySuratMasuk[smId] || null;
    return {
      id: smId,
      wilayahId: row[COL_SURAT_MASUK.WILAYAH_ID],
      noAgenda: row[COL_SURAT_MASUK.NO_AGENDA],
      asalSurat: row[COL_SURAT_MASUK.ASAL_SURAT],
      noSuratAsli: row[COL_SURAT_MASUK.NO_SURAT_ASLI],
      tglSurat: row[COL_SURAT_MASUK.TGL_SURAT],
      tglTerima: row[COL_SURAT_MASUK.TGL_TERIMA],
      perihal: row[COL_SURAT_MASUK.PERIHAL],
      ringkasan: row[COL_SURAT_MASUK.RINGKASAN],
      pdfUrl: row[COL_SURAT_MASUK.PDF_FILE_URL],
      statusDisposisi: row[COL_SURAT_MASUK.STATUS_DISPOSISI],
      createdAt: row[COL_SURAT_MASUK.CREATED_AT],
      disposisi: disp
    };
  });

  return { ok: true, list: list };
}

/**
 * Registrasi Surat Masuk Baru oleh Sekretaris
 */
function handleSaveSuratMasuk_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'sekretaris']);
  if (!roleGuard.ok) return roleGuard;

  var wilayahId = resolveAuthorizedWilayah_(session, payload.wilayah_id);

  return withScriptLock_(function() {
    var suratMasukId = payload.id || ('SM-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000));
    var now = new Date();

    // Bangkitkan nomor agenda sekuensial atomic
    var seqAgenda = getNextSequence(wilayahId, 'AGENDA_MASUK');
    var noAgenda = 'AGD-' + now.getFullYear() + '-' + ('000' + seqAgenda).slice(-4); // AGD-2026-0001

    var rowArray = [
      suratMasukId,
      wilayahId,
      noAgenda,
      payload.asal_surat || 'Instansi / Perorangan Luar',
      payload.no_surat_asli || '-',
      payload.tgl_surat || Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy'),
      payload.tgl_terima || Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy'),
      payload.perihal || 'Surat Masuk',
      payload.ringkasan || '',
      payload.pdf_file_url || '',
      'MENUNGGU_DISPOSISI',
      Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
    ];

    dbInsert('Sheet_Surat_Masuk', rowArray);

    // Jika sekretaris langsung menyertakan draf rekomendasi disposisi awal
    if (payload.draf_rekomendasi || payload.tujuan_divisi) {
      var disposisiId = 'DSP-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMddHHmmss');
      dbInsert('Sheet_Disposisi', [
        disposisiId,
        wilayahId,
        suratMasukId,
        payload.draf_rekomendasi || '',
        '', // instruksi_ketua (menunggu)
        payload.tujuan_divisi || 'humas',
        payload.tingkat_urgensi || 'Biasa',
        payload.batas_waktu || '',
        payload.catatan_tambahan || '',
        '', // paraf_ketua
        'DRAF_SEKRETARIS',
        '', // laporan_tindak_lanjut
        Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss'),
        '{}' // laporan_per_divisi
      ]);
    }

    logAudit(session.userId, wilayahId, 'REGISTER_SURAT_MASUK', 'SuratMasuk', suratMasukId, { noAgenda: noAgenda });
    return { ok: true, suratMasukId: suratMasukId, noAgenda: noAgenda, message: 'Surat masuk berhasil diregistrasi ke buku agenda digital.' };
  }, 10000);
}

