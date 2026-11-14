/**
 * SIAP APII v3.0.0 Enterprise - Code.gs
 * Central HTTP Gateway (doGet & doPost) dengan CORS Handler & Action Router Aman
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Helper Respon JSON Berstandar APII dengan Header CORS Lengkap
 */
function createJsonResponse_(dataObj) {
  var output = ContentService.createTextOutput(JSON.stringify(dataObj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Penangan Permintaan HTTP GET (doGet)
 * Digunakan untuk: Health Check, Info Organisasi, Verifikasi Dokumen Publik (QR Scan), dan Data Publik (Warta/Agenda)
 */
function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};
    var action = params.action || 'ping';

    // 1. Health check & Informasi Sistem
    if (action === 'ping') {
      return createJsonResponse_({
        ok: true,
        system: 'SIAP APII v3.0.0 Enterprise',
        organisasi: 'Yayasan Apologet Islam Indonesia (APII)',
        legalitas: 'AHU-0014970.AH.01.04.Tahun 2023',
        status: 'ONLINE',
        timestamp: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
      });
    }

    // 2. Verifikasi Dokumen Publik (QR Code Surat / KTA / Piagam Syahadat / Kwitansi)
    if (action === 'verifyPublic' || action === 'verifyDocument') {
      var token = params.token || params.hash || params.id || '';
      return createJsonResponse_(handleVerifyPublicDoc_(token, params.hash || ''));
    }

    // 3. Pengambilan Konten Publik (Warta Maklumat & Agenda Dakwah)
    if (action === 'getPublicContent') {
      var wilayahSlug = params.wilayah || 'pusat';
      return createJsonResponse_(handleGetPublicContent_(wilayahSlug));
    }

    // 4. Pengambilan Master Tenant Wilayah (Daftar DPW Aktif)
    if (action === 'getWilayahList') {
      return createJsonResponse_(handleGetWilayahList_());
    }

    // 5. Cek Tiket Konsultasi Aqidah Rahasia
    if (action === 'checkConsultation') {
      var ticketNo = params.ticket || '';
      var secretToken = params.token || '';
      return createJsonResponse_(handleCheckConsultation_(ticketNo, secretToken));
    }

    // Rute default
    return createJsonResponse_({ ok: false, error: 'Aksi GET "' + action + '" tidak dikenali.' });
  } catch (err) {
    Logger.log('doGet Error: ' + err.message);
    return createJsonResponse_({ ok: false, error: err.message });
  }
}

var READ_ONLY_POST_ACTIONS_ = [
  'logout',
  'getDashboardStats',
  'getSuratList',
  'getSuratMasukList',
  'getKeuanganList',
  'getDivisiPrograms',
  'getPendaftarList',
  'getAdvokasiList',
  'getMuallafList',
  'getAssetsList',
  'searchKnowledgeBase',
  'getConsultationsList',
  'getAuditLogs',
  'getSettings',
  'getSettingsAudit',
  'listDriveFiles'
];

/**
 * Penangan Permintaan HTTP POST (doPost)
 * Gerbang Utama Transaksi Frontend ke Backend (Auth, Persuratan, Keuangan, Disposisi, KTA, dll.)
 */
function doPost(e) {
  try {
    var rawPost = e && e.postData ? e.postData.contents : '';
    if (!rawPost) {
      return createJsonResponse_({ ok: false, error: 'Payload POST kosong.' });
    }

    var request = JSON.parse(rawPost);
    var action = request.action || '';
    var token = request.token || '';
    var payload = request.payload || {};

    // 1. Aksi Publik Tanpa Token Sesi (Pendaftaran, Verifikasi, Konsultasi, Pelaporan Advokasi)
    if (action === 'login') {
      return createJsonResponse_(handleLogin_(payload.username, payload.password, payload.wilayah_id, payload.meta));
    }
    if (action === 'verifyDocument' || action === 'verifyPublic') {
      return createJsonResponse_(handleVerifyPublicDoc_(payload.token || payload.id || '', payload.hash || ''));
    }
    if (action === 'registerMember') {
      return createJsonResponse_(handleRegisterMember_(payload));
    }
    if (action === 'submitAdvokasiIntake') {
      return createJsonResponse_(handleSubmitAdvokasiIntake_(payload));
    }
    if (action === 'submitConsultation') {
      return createJsonResponse_(handleSubmitConsultation_(payload));
    }
    if (action === 'recordVisitor') {
      return createJsonResponse_(handleRecordVisitor_(payload));
    }

    // 2. Validasi Token Sesi untuk Seluruh Aksi Private Pengurus
    var session = validateSession_(token);
    if (!session.valid) {
      return createJsonResponse_({ ok: false, code: 'AUTH_EXPIRED', error: session.error || 'Sesi pengurus telah kedaluwarsa. Silakan login kembali.' });
    }

    var currentUserId = session.userId;
    var currentRole = session.role;

    // 2b. Guard Global: Peran Read-Only (pembina & pengawas) DILARANG melakukan mutasi apapun
    if (isReadOnlyRole_(currentRole) && READ_ONLY_POST_ACTIONS_.indexOf(action) === -1) {
      return createJsonResponse_({
        ok: false,
        code: 'READ_ONLY_ROLE',
        error: 'Akses Ditolak: Peran "' + currentRole + '" bersifat Read-Only dan tidak diizinkan melakukan mutasi (' + action + ').'
      });
    }

    // 3. Router Berdasarkan Modul Kerja
    switch (action) {
      // Sesi & Profil Pengurus
      case 'logout':
        return createJsonResponse_(handleLogout_(token));
      case 'changePassword':
        return createJsonResponse_(handleChangePassword_(currentUserId, payload.old_password, payload.new_password));
      case 'getDashboardStats':
        return createJsonResponse_(handleGetDashboardStats_(session, payload.target_wilayah));

      // Modul 2: Persuratan Keluar & Naskah Dinas
      case 'getSuratList':
        return createJsonResponse_(handleGetSuratList_(session, payload));
      case 'saveSurat':
        return createJsonResponse_(handleSaveSurat_(session, payload));
      case 'approveSurat':
        return createJsonResponse_(handleApproveSurat_(session, payload));
      case 'rejectSurat':
        return createJsonResponse_(handleApproveSurat_(session, Object.assign({}, payload, { is_approved: false, approved: false, status: 'REJECTED' })));
      case 'generateSKKepengurusan':
        return createJsonResponse_(handleGenerateSKKepengurusan_(session, payload));

      // Modul 3: Agenda Surat Masuk & Lembar Disposisi Multi-Divisi
      case 'getSuratMasukList':
        return createJsonResponse_(handleGetSuratMasukList_(session, payload));
      case 'saveSuratMasuk':
        return createJsonResponse_(handleSaveSuratMasuk_(session, payload));
      case 'saveDisposisi':
        return createJsonResponse_(handleSaveDisposisi_(session, payload));
      case 'updateDisposisiProgress':
        return createJsonResponse_(handleUpdateDisposisiProgress_(session, payload));

      // Modul 4: Keuangan Kas Syar'i (4 Kantong & Dual-Approval)
      case 'getKeuanganList':
        return createJsonResponse_(handleGetKeuanganList_(session, payload));
      case 'saveKasMasuk':
        return createJsonResponse_(handleSaveKasMasuk_(session, payload));
      case 'ajukanKasKeluar':
        return createJsonResponse_(handleAjukanKasKeluar_(session, payload));
      case 'verifyKasBendahara':
        return createJsonResponse_(handleVerifyKasBendahara_(session, payload));
      case 'approveKasKetua':
        return createJsonResponse_(handleApproveKasKetua_(session, payload));
      case 'generateMonthlyClosing':
        return createJsonResponse_(handleGenerateMonthlyClosing_(session, payload));

      // Modul 5: Program Kerja 7 Divisi Resmi
      case 'getDivisiPrograms':
        return createJsonResponse_(handleGetDivisiPrograms_(session, payload));
      case 'saveDivisiProgram':
        return createJsonResponse_(handleSaveDivisiProgram_(session, payload));
      case 'approveDivisiProgram':
        return createJsonResponse_(handleApproveDivisiProgram_(session, payload));
      case 'requestProkerDisbursement':
        return createJsonResponse_(handleRequestProkerDisbursement_(session, payload));
      case 'submitDivisiLPJ':
        return createJsonResponse_(handleSubmitDivisiLPJ_(session, payload));

      // Modul 6: Keanggotaan Nasional & KTA Digital CR80
      case 'getPendaftarList':
        return createJsonResponse_(handleGetPendaftarList_(session, payload));
      case 'verifyPendaftarSekretaris':
        return createJsonResponse_(handleVerifyPendaftarSekretaris_(session, payload));
      case 'approveAnggotaKetua':
        return createJsonResponse_(handleApproveAnggotaKetua_(session, payload));

      // Modul 7 s/d 9: Rangkaian Inovasi Dakwah & CMS
      case 'getAdvokasiList':
        return createJsonResponse_(handleGetAdvokasiList_(session, payload));
      case 'updateAdvokasiStatus':
        return createJsonResponse_(handleUpdateAdvokasiStatus_(session, payload));
      case 'saveTabayyun':
        return createJsonResponse_(handleSaveTabayyun_(session, payload));
      case 'getMuallafList':
        return createJsonResponse_(handleGetMuallafList_(session, payload));
      case 'saveMuallaf':
        return createJsonResponse_(handleSaveMuallaf_(session, payload));
      case 'updateMuallafProgress':
        return createJsonResponse_(handleUpdateMuallafProgress_(session, payload));
      case 'recordEventAttendance':
        return createJsonResponse_(handleRecordEventAttendance_(session, payload));
      case 'getAssetsList':
        return createJsonResponse_(handleGetAssetsList_(session, payload));
      case 'saveAssetLoan':
        return createJsonResponse_(handleSaveAssetLoan_(session, payload));
      case 'searchKnowledgeBase':
        return createJsonResponse_(handleSearchKnowledgeBase_(session, payload));
      case 'getConsultationsList':
        return createJsonResponse_(handleGetConsultationsList_(session, payload));
      case 'answerConsultation':
        return createJsonResponse_(handleAnswerConsultation_(session, payload));
      case 'saveMeetingPlenary':
        return createJsonResponse_(handleSaveMeetingPlenary_(session, payload));
      case 'savePublicContent':
        return createJsonResponse_(handleSavePublicContent_(session, payload));

      // Modul 10: Pengaturan Sistem, Drive Vault, IAM & Superadmin
      case 'listDriveFiles':
        return createJsonResponse_(handleListDriveFiles_(session, payload));
      case 'uploadDriveFile':
        return createJsonResponse_(handleUploadDriveFile_(session, payload));
      case 'getUsersList':
        return createJsonResponse_(handleGetUsersList_(session));
      case 'saveUser':
        return createJsonResponse_(handleSaveUser_(session, payload));
      case 'resetUserPassword':
        return createJsonResponse_(handleResetUserPassword_(session, payload));
      case 'addNewTenantWilayah':
      case 'registerNewWilayah':
        return createJsonResponse_(handleRegisterNewWilayah_(session, payload));
      case 'getAuditLogs':
        return createJsonResponse_(handleGetAuditLogs_(session, payload));
      case 'getSettings':
        return createJsonResponse_(handleGetSettings_(session));
      case 'getSettingsAudit':
        return createJsonResponse_(handleGetSettingsAudit_(session, payload));
      case 'saveSettings':
        return createJsonResponse_(handleSaveSettings_(session, payload));
      case 'getActiveSessions':
        return createJsonResponse_(handleGetActiveSessions_(session));
      case 'revokeSession':
        return createJsonResponse_(handleRevokeSession_(session, payload));
      case 'getDeadlockQueue':
        return createJsonResponse_(handleGetDeadlockQueue_(session, payload));
      case 'executeDeadlockBreaker':
        return createJsonResponse_(handleExecuteDeadlockBreaker_(session, payload));

      default:
        return createJsonResponse_({ ok: false, error: 'Aksi POST "' + action + '" tidak dikenali di sistem.' });
    }
  } catch (err) {
    Logger.log('doPost Error: ' + err.message);
    return createJsonResponse_({ ok: false, error: 'Terjadi kesalahan sistem: ' + err.message });
  }
}

