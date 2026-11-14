/**
 * SIAP APII v3.0.0 Enterprise - DriveVault.gs
 * Manajemen Struktur Google Drive Vault 3-Tingkat Terisolasi & Pemantauan Kuota
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

var VAULT_CATEGORIES = [
  '01_SURAT_KELUAR',
  '02_SURAT_MASUK',
  '03_BUKTI_KAS',
  '04_LPJ_DIVISI',
  '05_BERKAS_KTA',
  '06_ASSET_CMS',
  '07_ADVOKASI_HUKUM',
  '08_MUALLAF_CARE',
  '09_ASET_LOGISTIK',
  '10_RISALAH_RAPAT'
];

// Kategori sensitif (PII KTP, perkara hukum, bukti kas, LPJ, muallaf, risalah pleno) wajib PRIVATE (UU PDP)
var PRIVATE_VAULT_CATEGORIES = [
  '03_BUKTI_KAS',
  '04_LPJ_DIVISI',
  '05_BERKAS_KTA',
  '07_ADVOKASI_HUKUM',
  '08_MUALLAF_CARE',
  '10_RISALAH_RAPAT'
];

/**
 * Mendapatkan atau Membuat Folder Induk Root Vault APII
 */
function getRootVaultFolder_() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('APII_ROOT_VAULT_ID');

  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (e) {
      Logger.log('Folder ID lama tidak valid, membuat folder root baru...');
    }
  }

  // Buat folder root baru di Google Drive
  var root = DriveApp.createFolder('VAULT_SIAP_APII_OFFICIAL');
  props.setProperty('APII_ROOT_VAULT_ID', root.getId());
  return root;
}

/**
 * Mendapatkan Folder Tenant Wilayah (Tingkat 2)
 */
function getTenantFolder_(wilayahId) {
  var root = getRootVaultFolder_();
  var folderName = wilayahId || 'DPP_PUSAT';

  var folders = root.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return root.createFolder(folderName);
}

/**
 * Mendapatkan Folder Kategori Khusus (Tingkat 3)
 */
function getCategoryFolder_(wilayahId, categoryName) {
  var tenantFolder = getTenantFolder_(wilayahId);
  var folders = tenantFolder.getFoldersByName(categoryName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return tenantFolder.createFolder(categoryName);
}

/**
 * Simpan Berkas Base64 ke Folder Vault Kategori dengan Penegakan Akses Privasi UU PDP
 */
function saveBase64FileToVault(wilayahId, categoryName, fileName, base64Data, mimeType) {
  try {
    if (VAULT_CATEGORIES.indexOf(categoryName) === -1) {
      return { ok: false, error: 'Kategori Drive Vault "' + categoryName + '" tidak valid.' };
    }
    var folder = getCategoryFolder_(wilayahId, categoryName);
    var cleanBase64 = String(base64Data || '').replace(/^data:[^;]+;base64,/, '');
    var decoded = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decoded, mimeType || 'application/octet-stream', fileName);

    var file = folder.createFile(blob);
    var isPrivate = PRIVATE_VAULT_CATEGORIES.indexOf(categoryName) !== -1;

    if (isPrivate) {
      file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    } else {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    return {
      ok: true,
      fileId: file.getId(),
      name: file.getName(),
      category: categoryName,
      access: isPrivate ? 'PRIVATE' : 'ANYONE_WITH_LINK',
      url: file.getUrl(),
      downloadUrl: file.getDownloadUrl()
    };
  } catch (err) {
    Logger.log('saveBase64FileToVault Error: ' + err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Handler Daftar Berkas pada Google Drive Vault Tenant
 */
function handleListDriveFiles_(session, payload) {
  var reqWilayah = payload && payload.wilayah_id ? payload.wilayah_id : session.wilayahId;
  var wilayahId = resolveAuthorizedWilayah_(session, reqWilayah);
  if (wilayahId === 'ALL') wilayahId = session.wilayahId || 'DPP_PUSAT';

  var category = payload && payload.category ? String(payload.category) : '';
  if (category && VAULT_CATEGORIES.indexOf(category) === -1) {
    return { ok: false, error: 'Kategori folder Drive Vault tidak dikenali.' };
  }

  var targetCategories = category ? [category] : VAULT_CATEGORIES;
  var files = [];

  for (var i = 0; i < targetCategories.length; i++) {
    var cat = targetCategories[i];
    try {
      var folder = getCategoryFolder_(wilayahId, cat);
      var iter = folder.getFiles();
      while (iter.hasNext()) {
        var f = iter.next();
        if (typeof f.isTrashed === 'function' && f.isTrashed()) continue;
        var isPrivate = PRIVATE_VAULT_CATEGORIES.indexOf(cat) !== -1;
        files.push({
          id: f.getId(),
          name: f.getName(),
          category: cat,
          mimeType: f.getMimeType(),
          size: f.getSize(),
          url: f.getUrl(),
          access: isPrivate ? 'PRIVATE' : 'ANYONE_WITH_LINK',
          createdAt: Utilities.formatDate(f.getDateCreated(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
        });
      }
    } catch (e) {
      Logger.log('handleListDriveFiles_ category error [' + cat + ']: ' + e.message);
    }
  }

  return {
    ok: true,
    wilayahId: wilayahId,
    categories: VAULT_CATEGORIES,
    files: files
  };
}

/**
 * Handler Unggah Berkas ke Google Drive Vault Tenant
 */
function handleUploadDriveFile_(session, payload) {
  var roleGuard = assertAllowedRoles_(session, ['superadmin', 'ketua', 'sekretaris', 'bendahara', 'ketua_divisi']);
  if (!roleGuard.ok) return roleGuard;

  var wilayahId = resolveAuthorizedWilayah_(session, payload && payload.wilayah_id);
  if (wilayahId === 'ALL') wilayahId = session.wilayahId || 'DPP_PUSAT';

  var category = payload && payload.category ? String(payload.category) : '';
  var fileName = (payload && (payload.file_name || payload.fileName)) || ('dokumen-' + new Date().getTime());
  var base64Data = payload && (payload.base64_data || payload.base64Data);
  var mimeType = (payload && (payload.mime_type || payload.mimeType)) || 'application/octet-stream';

  if (!category || VAULT_CATEGORIES.indexOf(category) === -1) {
    return { ok: false, error: 'Kategori folder Drive Vault wajib valid (01_SURAT_KELUAR s.d. 10_RISALAH_RAPAT).' };
  }
  if (!base64Data) {
    return { ok: false, error: 'Data berkas base64 wajib disertakan.' };
  }

  var res = saveBase64FileToVault(wilayahId, category, fileName, base64Data, mimeType);
  if (res.ok) {
    logAudit(session.userId, wilayahId, 'UPLOAD_DRIVE_FILE', 'DriveVault', res.fileId, {
      category: category,
      fileName: fileName,
      access: res.access
    });
  }
  return res;
}

