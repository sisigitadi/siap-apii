/**
 * SIAP APII v3.0.0 Enterprise - Disposisi.gs
 * Lembar Disposisi Digital Berjenjang, Rekomendasi Sekretaris & Distribusi Multi-Divisi
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Pengesahan Instruksi Disposisi Resmi oleh Ketua Umum / Ketua Wilayah
 * Mendukung Penambahan / Perubahan Multi-Divisi Tujuan saat Otorisasi
 */
function handleSaveDisposisi_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua']);
  if (!roleGuard.ok) return roleGuard;

  var suratMasukId = payload.surat_masuk_id;
  if (!suratMasukId) {
    return { ok: false, error: 'ID surat masuk wajib disertakan.' };
  }

  return withScriptLock_(function() {
    var smRow = dbFindOne('Sheet_Surat_Masuk', { id: suratMasukId });
    if (!smRow) {
      return { ok: false, error: 'Agenda surat masuk tidak ditemukan.' };
    }

    var wilayahId = smRow[COL_SURAT_MASUK.WILAYAH_ID];
    var tenantGuard = assertRecordTenantAccess_(session, wilayahId);
    if (!tenantGuard.ok) return tenantGuard;

    var disposisiId = payload.disposisi_id || ('DSP-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMddHHmmss'));
    var now = new Date();
    var nowStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
    var targetDivisiStr = Array.isArray(payload.tujuan_divisi_pejabat)
      ? payload.tujuan_divisi_pejabat.join(',')
      : (payload.tujuan_divisi_pejabat || 'humas');

    var existing = dbFindOne('Sheet_Disposisi', { surat_masuk_id: suratMasukId });

    if (existing) {
      disposisiId = existing[COL_DISPOSISI.ID];
      var updateMap = {};
      updateMap[COL_DISPOSISI.INSTRUKSI_KETUA] = payload.instruksi_ketua || '[1] Tindak Lanjuti Sesuai Ketentuan';
      updateMap[COL_DISPOSISI.TUJUAN_DIVISI_PEJABAT] = targetDivisiStr;
      updateMap[COL_DISPOSISI.TINGKAT_URGENSI] = payload.tingkat_urgensi || 'Biasa';
      updateMap[COL_DISPOSISI.BATAS_WAKTU] = payload.batas_waktu || '';
      updateMap[COL_DISPOSISI.CATATAN_TAMBAHAN] = payload.catatan_tambahan || '';
      updateMap[COL_DISPOSISI.PARAF_KETUA] = session.username;
      updateMap[COL_DISPOSISI.STATUS] = 'DIDISPOSISIKAN';
      updateMap[COL_DISPOSISI.UPDATED_AT] = nowStr;
      dbUpdate('Sheet_Disposisi', COL_DISPOSISI.SURAT_MASUK_ID, suratMasukId, updateMap);
    } else {
      dbInsert('Sheet_Disposisi', [
        disposisiId,
        wilayahId,
        suratMasukId,
        payload.draf_rekomendasi || '',
        payload.instruksi_ketua || '[1] Tindak Lanjuti Sesuai Ketentuan',
        targetDivisiStr,
        payload.tingkat_urgensi || 'Biasa',
        payload.batas_waktu || '',
        payload.catatan_tambahan || '',
        session.username, // Paraf Ketua
        'DIDISPOSISIKAN',
        '',
        nowStr,
        '{}' // laporan_per_divisi
      ]);
    }

    // Perbarui status surat masuk terkait
    var smUpdate = {};
    smUpdate[COL_SURAT_MASUK.STATUS_DISPOSISI] = 'SUDAH_DIDISPOSISIKAN';
    dbUpdate('Sheet_Surat_Masuk', COL_SURAT_MASUK.ID, suratMasukId, smUpdate);

    logAudit(session.userId, wilayahId, 'APPROVE_DISPOSISI', 'Disposisi', disposisiId, {
      suratMasukId: suratMasukId,
      instruksi: payload.instruksi_ketua,
      tujuan: targetDivisiStr
    });

    return {
      ok: true,
      disposisiId: disposisiId,
      status: 'DIDISPOSISIKAN',
      tujuanDivisi: targetDivisiStr,
      message: 'Lembar disposisi resmi berhasil disahkan dan didistribusikan ke divisi terkait.'
    };
  }, 10000);
}

/**
 * Pelaporan Balik Progres Tindak Lanjut Independen Per Divisi oleh Ketua Divisi
 */
function handleUpdateDisposisiProgress_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  var suratMasukId = payload.surat_masuk_id;
  if (!suratMasukId) {
    return { ok: false, error: 'ID surat masuk wajib disertakan.' };
  }

  return withScriptLock_(function() {
    var dispRow = dbFindOne('Sheet_Disposisi', { surat_masuk_id: suratMasukId });
    var smRow = dbFindOne('Sheet_Surat_Masuk', { id: suratMasukId });
    if (!dispRow && !smRow) {
      return { ok: false, error: 'Data disposisi atau surat masuk tidak ditemukan.' };
    }

    var recordWilayah = dispRow ? dispRow[COL_DISPOSISI.WILAYAH_ID] : smRow[COL_SURAT_MASUK.WILAYAH_ID];
    var tenantGuard = assertRecordTenantAccess_(session, recordWilayah);
    if (!tenantGuard.ok) return tenantGuard;

    var targetStr = dispRow ? String(dispRow[COL_DISPOSISI.TUJUAN_DIVISI_PEJABAT] || '') : '';
    var targetList = targetStr.split(',').map(function(s) { return s.trim().toLowerCase(); }).filter(Boolean);

    var divisiKode = String(payload.divisi_kode || session.divisi || '').toLowerCase();
    if (session.role === 'ketua_divisi' && session.divisi) {
      divisiKode = String(session.divisi).toLowerCase();
      if (targetList.length > 0 && targetList.indexOf(divisiKode) === -1) {
        return { ok: false, code: 'DIVISION_FORBIDDEN', error: 'Akses Ditolak: Disposisi ini tidak ditujukan kepada divisi "' + divisiKode + '".' };
      }
    }
    if (!divisiKode) {
      divisiKode = targetList[0] || 'umum';
    }

    var laporanTindakLanjut = payload.laporan_tindak_lanjut || '';
    var isTuntas = payload.is_tuntas !== false;
    var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');

    var laporanPerDivisi = {};
    if (dispRow && dispRow[COL_DISPOSISI.LAPORAN_PER_DIVISI]) {
      try {
        laporanPerDivisi = JSON.parse(dispRow[COL_DISPOSISI.LAPORAN_PER_DIVISI]);
      } catch (e) {
        laporanPerDivisi = {};
      }
    }

    laporanPerDivisi[divisiKode] = {
      laporan: laporanTindakLanjut,
      isTuntas: isTuntas,
      reportedBy: session.username,
      updatedAt: nowStr
    };

    var allDone = isTuntas;
    if (targetList.length > 0) {
      allDone = true;
      for (var i = 0; i < targetList.length; i++) {
        var entry = laporanPerDivisi[targetList[i]];
        if (!entry || entry.isTuntas !== true) {
          allDone = false;
          break;
        }
      }
    }

    var status = allDone ? 'SELESAI_DITINDAKLANJUTI' : 'DALAM_PROGRES';

    if (dispRow) {
      var dispUpdate = {};
      dispUpdate[COL_DISPOSISI.STATUS] = status;
      dispUpdate[COL_DISPOSISI.LAPORAN_TINDAK_LANJUT] = laporanTindakLanjut;
      dispUpdate[COL_DISPOSISI.UPDATED_AT] = nowStr;
      dispUpdate[COL_DISPOSISI.LAPORAN_PER_DIVISI] = JSON.stringify(laporanPerDivisi);
      dbUpdate('Sheet_Disposisi', COL_DISPOSISI.SURAT_MASUK_ID, suratMasukId, dispUpdate);
    }

    var smUpdate = {};
    smUpdate[COL_SURAT_MASUK.STATUS_DISPOSISI] = allDone ? 'SELESAI' : 'DALAM_PROGRES';
    dbUpdate('Sheet_Surat_Masuk', COL_SURAT_MASUK.ID, suratMasukId, smUpdate);

    logAudit(session.userId, recordWilayah, 'UPDATE_DISPOSISI_PROGRESS', 'Disposisi', suratMasukId, {
      divisi: divisiKode,
      status: status,
      allDone: allDone
    });

    return {
      ok: true,
      status: status,
      divisi: divisiKode,
      laporanPerDivisi: laporanPerDivisi,
      allDone: allDone,
      message: allDone ? 'Seluruh divisi tujuan telah menuntaskan laporan disposisi.' : 'Laporan progres divisi "' + divisiKode + '" berhasil dicatat (menunggu divisi lain).'
    };
  }, 10000);
}

