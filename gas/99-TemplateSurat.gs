/**
 * ============================================================================
 * 99-TemplateSurat.gs — Generator Otomatis Template Surat + Folder Drive
 * ============================================================================
 * Membuat dokumen Google Docs "Template Surat Resmi APII DPW Jabodetabek"
 * lengkap dengan:
 *   - KOP surat: logo + "DEWAN PIMPINAN WILAYAH APOLOGET ISLAM INDONESIA
 *     (APII) JABODETABEK" + alamat + garis pemisah ganda
 *   - Badan: seluruh placeholder {{...}} yang diganti otomatis saat surat
 *     diterbitkan
 *   - Blok tanda tangan Sekretaris & Ketua + STEMPEL basah
 *   - Footer: nama lembaga + tahun + URL verifikasi keaslian
 *
 * Logo & stempel ditanam sebagai data base64 di Aset.gs (diambil dari
 * Dokumen Sumber), sehingga TIDAK perlu upload gambar manual.
 *
 * Placeholder (lihat juga Surat.gs generateSuratPdf_):
 *   {{JENIS}} {{NOMOR}} {{JUDUL}} {{TANGGAL}} {{TAHUN}}
 *   {{MENIMBANG}} {{MENGINGAT}} {{MEMUTUSKAN}}
 *   {{SEKRETARIS}} {{KETUA}} {{QR_VERIFY}}
 * ==========================================================================*/

/** Dekode base64 logo (Aset.gs) menjadi Blob. */
function getLogoBlob_() {
  return Utilities.newBlob(
    Utilities.base64Decode(LOGO_BASE64), 'image/jpeg', 'logo-dpw-apii.jpg');
}

/** Dekode base64 stempel (Aset.gs) menjadi Blob. */
function getStempelBlob_() {
  return Utilities.newBlob(
    Utilities.base64Decode(STEMPEL_BASE64), 'image/jpeg', 'stempel-apii.jpg');
}

/**
 * Bangun URL verifikasi publik untuk sebuah nomor surat.
 * @param {string} letterNumber nomor surat, mis. 001/SK-DPW/APII-JABO/X/2026
 * @return {string} mis. https://apii.sigitadi.id/?no=001%2FSK-DPW%2F...
 */
function urlVerifikasiSurat_(letterNumber) {
  var base = PropertiesService.getScriptProperties().getProperty('PUBLIC_URL') ||
             KONFIG.PUBLIC_URL;
  return base.replace(/\/+$/, '') + '/?no=' + encodeURIComponent(letterNumber || '');
}

/**
 * siapkanFolderPdf_: pastikan folder Drive penyimpanan PDF ada (buat bila belum).
 * Prioritaskan konfigurasi di Sheet_Settings, lalu ScriptProperties, lalu buat default.
 * @return {string} ID folder
 */
function siapkanFolderPdf_() {
  var props = PropertiesService.getScriptProperties();

  // 1. Cek konfigurasi custom di Sheet_Settings
  var customId = '';
  try {
    customId = getSettingValue_('google_drive_folder_id', '');
    if (!customId) {
      var drv = getSettingValue_('drive_storage', {});
      if (drv && drv.custom_folder_id) customId = drv.custom_folder_id;
    }
  } catch (e) {
    customId = '';
  }

  if (customId) {
    try {
      var customFolder = DriveApp.getFolderById(customId);
      props.setProperty('DRIVE_FOLDER_ID', customId);
      return customId;
    } catch (e) {
      Logger.log('Custom folder ID ' + customId + ' tidak valid / tidak dapat diakses: ' + e);
      // Fallback ke ScriptProperties atau buat default di bawah
    }
  }

  // 2. Cek di ScriptProperties bila ada
  var folderId = props.getProperty('DRIVE_FOLDER_ID');
  if (folderId) {
    try { DriveApp.getFolderById(folderId); return folderId; }
    catch (e) { /* folder terhapus — buat ulang di bawah */ }
  }

  // 3. Buat folder default bila belum ada
  var folder = DriveApp.createFolder(KONFIG.DRIVE_FOLDER_NAME);
  props.setProperty('DRIVE_FOLDER_ID', folder.getId());
  Logger.log('Folder PDF dibuat: ' + folder.getUrl());
  return folder.getId();
}

/**
 * siapkanTemplateSurat_: pastikan template Google Docs ada (buat bila belum).
 * @return {string} ID dokumen template
 */
function siapkanTemplateSurat_() {
  var props = PropertiesService.getScriptProperties();
  var docId = props.getProperty('TEMPLATE_DOC_ID');
  if (docId) {
    try { DocumentApp.openById(docId); return docId; }
    catch (e) { /* template terhapus — buat ulang di bawah */ }
  }
  return generateTemplateSurat();
}

/**
 * generateTemplateSurat: buat dokumen template dari nol. Dipanggil setup()
 * dan otomatis oleh generateSuratPdf_ bila template belum ada.
 * @return {string} ID dokumen template
 */
function generateTemplateSurat() {
  var doc = DocumentApp.create(KONFIG.TEMPLATE_DOC_NAME);
  var body = doc.getBody();

  // Ukuran kertas A4 (595 x 842 pt) dengan margin ~1.9 cm.
  try {
    body.setPageWidth(595.0).setPageHeight(842.0)
        .setMarginTop(54.0).setMarginBottom(54.0)
        .setMarginLeft(54.0).setMarginRight(54.0);
  } catch (e) { /* ukuran default, tidak fatal */ }

  // ---- KOP: gunakan header halaman bila tersedia; kalau tidak, taruh di
  //       paling atas badan dokumen. Kedua kasus diisi berurutan.
  var kop = null;
  try { kop = doc.getHeader(); } catch (e) { kop = null; }
  if (!kop) { try { kop = doc.addHeader(); } catch (e) { kop = null; } }
  if (!kop) kop = body;

  // Logo (base64 dari Aset.gs). Saat kop = body, sisipkan di posisi 0.
  try {
    var logoImg = (kop === body)
      ? kop.insertImage(0, getLogoBlob_())
      : kop.appendImage(getLogoBlob_());
    logoImg.setWidth(80.0).setHeight(80.0);
  } catch (e) {
    Logger.log('Logo gagal ditanam di kop: ' + e);
  }

  // Teks lembaga & alamat (data dari Dokumen Sumber).
  parSurat_(kop, 'DEWAN PIMPINAN WILAYAH', 10, true, 'center', '#1B5E20');
  parSurat_(kop, 'APOLOGET ISLAM INDONESIA (APII) JABODETABEK', 13, true, 'center', '#0d1c2f');
  parSurat_(kop, 'Gedung Pusat Dakwah APII Wilayah Jabodetabek Lt. 3, Jl. Kramat Raya No. 45, ' +
    'Senen, Jakarta Pusat 10450 | Telp: (021) 390-8812 | Email: sekretariat.dpw@apii-jabodetabek.or.id',
    7.5, false, 'center', '#555555');

  // Garis pemisah ganda khas surat resmi.
  try {
    var garis1 = kop.appendHorizontalRule();
    var garis2 = kop.appendHorizontalRule();
    if (garis1 && garis1.setSpacingBefore) garis1.setSpacingBefore(3).setSpacingAfter(0);
    if (garis2 && garis2.setSpacingBefore) garis2.setSpacingBefore(0).setSpacingAfter(4);
  } catch (e) { /* garis opsional */ }

  // ---- BADAN SURAT ----
  parSurat_(body, '', 8);
  parSurat_(body, '{{JENIS}}', 13, true, 'center');
  parSurat_(body, 'Nomor : {{NOMOR}}', 11, false, 'center');
  parSurat_(body, '', 4);
  parSurat_(body, 'TENTANG', 9, true, 'center');
  parSurat_(body, '{{JUDUL}}', 12, true, 'center');
  parSurat_(body, '', 8);
  parSurat_(body, 'Menimbang : {{MENIMBANG}}', 11);
  parSurat_(body, 'Mengingat : {{MENGINGAT}}', 11);
  parSurat_(body, 'Memutuskan : {{MEMUTUSKAN}}', 11);
  parSurat_(body, '', 8);
  parSurat_(body, 'Ditetapkan di Jakarta pada tanggal {{TANGGAL}}', 11);
  parSurat_(body, '', 12);

  // ---- BLOK TANDA TANGAN + STEMPEL ----
  var sigTable = body.appendTable();
  try { sigTable.setBorderColor('#ffffff').setBorderWidth(0.5); } catch (e) {}
  var sigRow = sigTable.appendTableRow();
  var cSek = sigRow.appendTableCell();
  var cKet = sigRow.appendTableCell();
  try { cSek.setWidth(243.0); cKet.setWidth(243.0); } catch (e) {}

  // Sekretaris (kiri).
  parSurat_(cSek, 'Sekretaris DPW Jabodetabek,', 11, false, 'center');
  parSurat_(cSek, '', 10); parSurat_(cSek, '', 10); parSurat_(cSek, '', 10);
  parSurat_(cSek, '( {{SEKRETARIS}} )', 11, true, 'center');

  // Ketua (kanan) + stempel basah.
  parSurat_(cKet, 'Ketua DPW Jabodetabek,', 11, false, 'center');
  try {
    var stempelImg = cKet.appendImage(getStempelBlob_());
    stempelImg.setWidth(95.0).setHeight(95.0);
  } catch (e) {
    Logger.log('Stempel gagal ditanam: ' + e);
  }
  parSurat_(cKet, '( {{KETUA}} )', 11, true, 'center');

  // ---- FOOTER ----
  var footer = null;
  try { footer = doc.getFooter(); } catch (e) { footer = null; }
  if (!footer) { try { footer = doc.addFooter(); } catch (e) { footer = null; } }
  if (footer) {
    parSurat_(footer, 'Yayasan Apologet Islam Indonesia (APII) • Dewan Pimpinan Wilayah ' +
      'Jabodetabek • Tahun {{TAHUN}}', 8, false, 'center', '#666666');
    parSurat_(footer, 'Verifikasi keaslian surat: {{QR_VERIFY}}', 8, false, 'center', '#666666');
  }

  doc.saveAndClose();

  // Simpan ID template agar tidak dibuat ulang pada pemanggilan berikutnya.
  PropertiesService.getScriptProperties()
    .setProperty('TEMPLATE_DOC_ID', doc.getId());
  Logger.log('Template surat dibuat: ' + doc.getUrl());
  return doc.getId();
}

/**
 * Helper: tambah satu paragraf terformat ke container manapun
 * (Body / HeaderSection / FooterSection / TableCell).
 */
function parSurat_(container, text, size, bold, align, color) {
  var p = container.appendParagraph(String(text || ''));
  var t = p.editAsText();
  if (size) t.setFontSize(size);
  if (bold) t.setBold(true);
  if (color) t.setForegroundColor(color);
  if (align === 'center') p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  else if (align === 'right') p.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  try { p.setSpacingBefore(0).setSpacingAfter(2); } catch (e) {}
  return p;
}
