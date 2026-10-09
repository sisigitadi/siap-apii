/**
 * ============================================================================
 * TemplateSurat.gs — Master Template Surat (Multi-Template + PDF Asli)
 * ============================================================================
 * Tab: Sheet_Templates (lihat SCHEMA di Database.gs).
 *
 * Setiap template = PDF asli (master kop lembaga) yang diunggah pengurus,
 * disimpan utuh & dapat diunduh kembali, PLUS spesifikasi blok naskah
 * (array `fields`) yang dipakai merangkai surat jadi PDF resmi.
 *
 *   getLetterTemplates  — daftar template aktif (SURAT_READ_ROLES)
 *   saveLetterTemplate  — buat/perbarui template + simpan master PDF (Upload)
 *   deleteLetterTemplate— nonaktifkan template (soft delete; master PDF utuh)
 *
 * Rendering: karena Apps Script tidak dapat merasterisasi PDF di server,
 * PDF akhir dirangkai via Google Docs dari spesifikasi blok template —
 * kop lembaga, badan surat, blok tanda tangan + stempel, dan footer
 * verifikasi. Master PDF asli tetap disimpan di Drive sebagai rujukan
 * resmi dan ditampilkan berdampingan di portal pengurus.
 * ========================================================================= */

/**
 * getLetterTemplates: daftar template surat aktif.
 * @param {object} ctx.payload { include_inactive? }
 */
function getLetterTemplates(ctx) {
  var p = ctx.payload || {};
  var rows = Database.readAll(TABS.TEMPLATES)
    .filter(function (t) {
      if (p.include_inactive) return true;
      return String(t.is_active).toUpperCase() !== 'FALSE';
    })
    .sort(function (a, b) {
      // Default selalu paling atas, lalu termuat dibuat.
      var ad = String(a.is_default).toUpperCase() === 'TRUE' ? 0 : 1;
      var bd = String(b.is_default).toUpperCase() === 'TRUE' ? 0 : 1;
      if (ad !== bd) return ad - bd;
      return (b.created_at || '').localeCompare(a.created_at || '');
    })
    .map(function (t) {
      var fields = [];
      try { fields = JSON.parse(t.fields || '[]'); } catch (e) { fields = []; }
      if (!Array.isArray(fields)) fields = [];
      return {
        id: t.id,
        name: t.name,
        description: t.description || '',
        pdf_url: t.pdf_url || '',
        drive_file_id: t.drive_file_id || '',
        fields: fields,
        is_default: String(t.is_default).toUpperCase() === 'TRUE',
        is_active: String(t.is_active).toUpperCase() !== 'FALSE',
        page_count: Number(t.page_count) || 1,
        created_by: t.created_by,
        created_at: t.created_at
      };
    });
  return { ok: true, data: { items: rows }, message: 'Daftar template surat berhasil dimuat.' };
}

/** Ambil template default (yang dipakai bila surat tanpa template_id). */
function getDefaultTemplate_() {
  var rows = Database.readAll(TABS.TEMPLATES);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].is_default).toUpperCase() === 'TRUE' &&
        String(rows[i].is_active).toUpperCase() !== 'FALSE') {
      return rows[i];
    }
  }
  return null;
}

/**
 * saveLetterTemplate: buat atau perbarui template surat.
 * @param {object} ctx.payload { id?, name, description?, fields, is_default?,
 *                                pdf_base64?, pdf_name? }
 */
function saveLetterTemplate(ctx) {
  var p = ctx.payload || {};
  var name = String(p.name || '').trim();
  if (!name) {
    return { ok: false, data: null, message: 'Nama template wajib diisi.' };
  }
  if (name.length > 120) name = name.slice(0, 120);

  // Spesifikasi blok: bila tidak dikirim atau daftar kosong dari editor
  // visual portal, pakai rangkaian bawaan. Input yang tidak sah ditolak.
  var fields = (p.fields === undefined || p.fields === null || p.fields === '')
    ? defaultTemplateFields_()
    : validateTemplateFields_(p.fields);
  if (!fields && Array.isArray(p.fields) && p.fields.length === 0) {
    fields = defaultTemplateFields_();
  }
  if (!fields) {
    return { ok: false, data: null,
      message: 'Spesifikasi blok naskah tidak valid (harus berupa daftar blok).' };
  }

  var now = new Date().toISOString();
  var values = {
    name: name,
    description: String(p.description || '').trim().slice(0, 500),
    fields: JSON.stringify(fields),
    is_default: p.is_default ? 'TRUE' : 'FALSE',
    updated_at: now
  };

  // ---- Unggah master PDF asli (opsional) ----
  if (p.pdf_base64) {
    var safeName = String(p.pdf_name || (name + '.pdf')).replace(/[^\w.\- ]+/g, '_');
    var folderId = siapkanFolderTemplatePdf_();
    try {
      // Portal mengirim data URL ("data:application/pdf;base64,...");
      // pisahkan header MIME-nya sebelum didekode, seperti saveUploadToDrive_.
      var rawPdf = String(p.pdf_base64);
      if (rawPdf.indexOf(';base64,') !== -1) rawPdf = rawPdf.split(';base64,')[1];
      var blob = Utilities.newBlob(Utilities.base64Decode(rawPdf),
        'application/pdf', safeName);
      var file = DriveApp.getFolderById(folderId).createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      values.drive_file_id = file.getId();
      values.pdf_url = file.getUrl();
    } catch (e) {
      return { ok: false, data: null,
        message: 'Gagal menyimpan master PDF: ' + (e.message || e) };
    }
  }

  // ---- Hapus flag default pada template lain bila ini dijadikan default ----
  if (p.is_default) {
    Database.readAll(TABS.TEMPLATES).forEach(function (t) {
      if (String(t.is_default).toUpperCase() === 'TRUE' &&
          String(t.is_active).toUpperCase() !== 'FALSE' &&
          t.id !== p.id) {
        Database.updateRow(TABS.TEMPLATES, t._row, { is_default: 'FALSE', updated_at: now });
      }
    });
  }

  if (p.id) {
    // Perbarui template yang sudah ada.
    var row = Database.findOne(TABS.TEMPLATES, { id: p.id });
    if (!row) return { ok: false, data: null, message: 'Template tidak ditemukan.' };
    if (!values.drive_file_id && row.drive_file_id) {
      values.drive_file_id = row.drive_file_id;
      values.pdf_url = row.pdf_url;
    }
    Database.updateRow(TABS.TEMPLATES, row._row, values);
    audit(ctx.user.username, 'TEMPLATE_UPDATE', 'Memperbarui template "' + name + '"', 'TEMPLATES');
    return { ok: true, data: { id: row.id }, message: 'Template "' + name + '" berhasil diperbarui.' };
  }

  // Template baru.
  var created = Database.insert(TABS.TEMPLATES, {
    id: uuid(), name: name, description: values.description,
    drive_file_id: values.drive_file_id || '', pdf_url: values.pdf_url || '',
    fields: values.fields, is_default: values.is_default, is_active: 'TRUE',
    page_count: Number(p.page_count) || 1,
    created_by: ctx.user.username, created_at: now, updated_at: now
  });
  audit(ctx.user.username, 'TEMPLATE_CREATE', 'Membuat template "' + name + '"', 'TEMPLATES');
  return { ok: true, data: { id: created.id },
    message: 'Template "' + name + '" berhasil disimpan.' };
}

/**
 * deleteLetterTemplate: nonaktifkan template (soft delete).
 * Master PDF asli tidak dihapus dari Drive, hanya dipindah dari daftar aktif.
 * @param {object} ctx.payload { id }
 */
function deleteLetterTemplate(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID template wajib diisi.' };
  var row = Database.findOne(TABS.TEMPLATES, { id: p.id });
  if (!row) return { ok: false, data: null, message: 'Template tidak ditemukan.' };
  if (String(row.is_default).toUpperCase() === 'TRUE') {
    return { ok: false, data: null,
      message: 'Template default tidak dapat dihapus. Jadikan template lain default terlebih dahulu.' };
  }
  Database.updateRow(TABS.TEMPLATES, row._row, {
    is_active: 'FALSE', is_default: 'FALSE',
    updated_at: new Date().toISOString()
  });
  audit(ctx.user.username, 'TEMPLATE_DELETE',
    'Menonaktifkan template "' + row.name + '"', 'TEMPLATES');
  return { ok: true, data: null, message: 'Template "' + row.name + '" telah dinonaktifkan.' };
}

/**
 * Tipe blok naskah yang dikenali mesin rendering template.
 *   jenis    — label jenis surat (mis. "SURAT KEPUTUSAN")
 *   nomor    — baris "Nomor : 001/SK-DPW-APII/JABO/X/2026"
 *   judul    — perihal / judul surat
 *   tanggal  — "Ditetapkan di Jakarta pada tanggal {tanggal}"
 *   label    — teks statis bebas (mis. "TENTANG")
 *   field    — "Label : nilai" diambil dari content[key]
 *   spasi    — baris kosong (atur jarak)
 *   ttd      — blok tanda tangan Sekretaris & Ketua + stempel
 */
var TEMPLATE_BLOCK_TYPES = ['jenis', 'nomor', 'judul', 'tanggal', 'label',
  'field', 'spasi', 'ttd'];

/** Spesifikasi blok bawaan (dipakai template default & fallback). */
function defaultTemplateFields_() {
  return [
    { type: 'jenis', align: 'center', size: 13, bold: true },
    { type: 'nomor', align: 'center', size: 11 },
    { type: 'spasi', size: 6 },
    { type: 'label', text: 'TENTANG', align: 'center', size: 9, bold: true },
    { type: 'judul', align: 'center', size: 12, bold: true },
    { type: 'spasi', size: 8 },
    { type: 'field', key: 'menimbang', label: 'Menimbang :', size: 11 },
    { type: 'field', key: 'mengingat', label: 'Mengingat :', size: 11 },
    { type: 'field', key: 'memutuskan', label: 'Memutuskan :', size: 11 },
    { type: 'spasi', size: 8 },
    { type: 'tanggal', size: 11 },
    { type: 'spasi', size: 12 },
    { type: 'ttd' }
  ];
}

/**
 * Validasi & normalisasi spesifikasi blok yang dikirim portal.
 * @param {*} raw array blok (boleh string JSON)
 * @return {Array|null} array blok bersih, atau null bila tidak valid
 */
function validateTemplateFields_(raw) {
  var fields = raw;
  if (typeof raw === 'string') {
    try { fields = JSON.parse(raw); } catch (e) { return null; }
  }
  if (!Array.isArray(fields) || fields.length === 0) return null;
  var clean = [];
  for (var i = 0; i < fields.length && i < 60; i++) {
    var b = fields[i];
    if (!b || typeof b !== 'object') continue;
    var type = String(b.type || '').toLowerCase();
    if (TEMPLATE_BLOCK_TYPES.indexOf(type) === -1) continue;
    var out = { type: type };
    if (type === 'label') out.text = String(b.text || '').slice(0, 300);
    if (type === 'field') {
      out.key = String(b.key || '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
      out.label = String(b.label || '').slice(0, 60);
    }
    out.size = Math.min(Math.max(Number(b.size) || 11, 7), 24);
    out.bold = !!b.bold;
    var align = String(b.align || '').toLowerCase();
    out.align = (align === 'center' || align === 'right') ? align : 'left';
    clean.push(out);
  }
  return clean.length ? clean : null;
}

/** Pastikan subfolder master PDF template ada (di dalam folder PDF surat). */
function siapkanFolderTemplatePdf_() {
  var baseId = siapkanFolderPdf_();
  var props = PropertiesService.getScriptProperties();
  var subId = props.getProperty('TEMPLATE_PDF_FOLDER_ID');
  if (subId) {
    try { DriveApp.getFolderById(subId); return subId; }
    catch (e) { subId = ''; }
  }
  // Cari subfolder yang sudah ada dulu (hindari duplikat).
  var it = DriveApp.getFolderById(baseId).getFoldersByName('Master Template Surat');
  var folder = null;
  while (it.hasNext()) {
    var f = it.next();
    var trashed = false;
    try { trashed = f.isTrashed(); } catch (e) { trashed = false; }
    if (!trashed) { folder = f; break; }
  }
  if (!folder) folder = DriveApp.getFolderById(baseId).createFolder('Master Template Surat');
  props.setProperty('TEMPLATE_PDF_FOLDER_ID', folder.getId());
  return folder.getId();
}

// ==========================================================================
// MESIN RENDER PDF (Google Docs)
// ==========================================================================

/**
 * renderTemplatePdf_: rangkai surat jadi PDF dari spesifikasi blok template.
 * Dipanggil generateSuratPdf_ bila surat memiliki template_id.
 * @param {object} s baris Sheet_Surat (sudah memiliki template_id)
 * @param {object} template baris Sheet_Templates
 * @return {string} URL publik file PDF
 */
function renderTemplatePdf_(s, template) {
  var folderId = siapkanFolderPdf_();
  var fields;
  try { fields = JSON.parse(template.fields || '[]'); } catch (e) { fields = []; }
  if (!Array.isArray(fields) || !fields.length) fields = defaultTemplateFields_();

  var content;
  try { content = JSON.parse(s.content || '{}'); } catch (e) { content = {}; }

  var ketuaName = 'Ketua DPW Jabodetabek';
  var sekretarisName = 'Sekretaris DPW Jabodetabek';
  try {
    var ketua = Database.findOne(TABS.USERS, { role: ROLES.KETUA, is_active: 'TRUE' });
    if (ketua && ketua.full_name) ketuaName = ketua.full_name;
    var sek = Database.findOne(TABS.USERS, { role: ROLES.SEKRETARIS, is_active: 'TRUE' });
    if (sek && sek.full_name) sekretarisName = sek.full_name;
  } catch (e) { /* pakai label jabatan */ }

  var vals = {
    jenis: LETTER_TYPE_LABELS[s.letter_type] || s.letter_type,
    nomor: s.letter_number,
    judul: s.title,
    tanggal: formatTanggal(s.tanggal_surat),
    tahun: String(new Date(s.tanggal_surat || new Date()).getFullYear())
  };
  for (var k in content) {
    if (typeof content[k] === 'string') vals[k] = content[k];
  }

  var fileName = 'Surat - ' + s.letter_type + ' - ' + s.letter_number + '.pdf';
  var docName = 'Surat - ' + s.letter_type + ' - ' + s.letter_number;
  var doc = DocumentApp.create(docName);
  var body = doc.getBody();
  try {
    body.setPageWidth(595.0).setPageHeight(842.0)
        .setMarginTop(54.0).setMarginBottom(54.0)
        .setMarginLeft(54.0).setMarginRight(54.0);
  } catch (e) { /* ukuran default, tidak fatal */ }

  // KOP surat + badan + footer.
  tulisKopSuratT_(doc, body);
  fields.forEach(function (b) { tulisBlokT_(body, b, vals, ketuaName, sekretarisName); });
  tulisFooterSuratT_(doc, vals.tahun, urlVerifikasiSurat_(s.letter_number));
  doc.saveAndClose();

  var pdfUrl = '';
  try {
    var url = 'https://docs.google.com/document/d/' + doc.getId() + '/export?format=pdf';
    var pdfBlob = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    }).getBlob().setName(fileName);
    var file = DriveApp.getFolderById(folderId).createFile(pdfBlob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    pdfUrl = file.getUrl();
  } finally {
    try { DriveApp.getFileById(doc.getId()).setTrashed(true); } catch (e) { /* ok */ }
  }
  return pdfUrl;
}

/** Ambil teks KOP dari pengaturan (letter_kop) dengan fallback aman. */
function kopSettingT_() {
  var cfg = {};
  try { cfg = getSettingValue_('letter_kop', {}) || {}; } catch (e) { cfg = {}; }
  var org = cfg.org_name ||
    'DEWAN PIMPINAN WILAYAH APOLOGET ISLAM INDONESIA (APII) JABODETABEK';
  var isApii = /APOLOGET/i.test(org);
  return {
    baris1: isApii ? 'DEWAN PIMPINAN WILAYAH' : '',
    baris2: org,
    baris3: cfg.address || 'DKI Jakarta & Sekitarnya, Indonesia',
    telp: cfg.phone || '0812-8888-2026',
    email: cfg.email || 'sekretariat@apii.sigitadi.id'
  };
}

/** Tulis KOP surat: logo, nama lembaga, alamat, garis pemisah ganda. */
function tulisKopSuratT_(doc, body) {
  var kop = null;
  try { kop = doc.getHeader(); } catch (e) { kop = null; }
  if (!kop) { try { kop = doc.addHeader(); } catch (e) { kop = null; } }
  if (!kop) kop = body;

  try {
    var logoImg = (kop === body)
      ? kop.insertImage(0, getLogoBlob_())
      : kop.appendImage(getLogoBlob_());
    logoImg.setWidth(80.0).setHeight(80.0);
  } catch (e) {
    Logger.log('Logo gagal ditanam di kop template: ' + e);
  }

  var k = kopSettingT_();
  if (k.baris1) parSuratT_(kop, k.baris1, 10, true, 'center', '#1B5E20');
  parSuratT_(kop, k.baris2, 13, true, 'center', '#0d1c2f');
  parSuratT_(kop, k.baris3 + ' | Telp: ' + k.telp + ' | Email: ' + k.email,
    7.5, false, 'center', '#555555');

  try {
    var g1 = kop.appendHorizontalRule();
    var g2 = kop.appendHorizontalRule();
    if (g1 && g1.setSpacingBefore) g1.setSpacingBefore(3).setSpacingAfter(0);
    if (g2 && g2.setSpacingBefore) g2.setSpacingBefore(0).setSpacingAfter(4);
  } catch (e) { /* garis opsional */ }
}

/** Tulis footer: nama yayasan + tahun + URL verifikasi keaslian. */
function tulisFooterSuratT_(doc, tahun, verifyUrl) {
  var footer = null;
  try { footer = doc.getFooter(); } catch (e) { footer = null; }
  if (!footer) { try { footer = doc.addFooter(); } catch (e) { footer = null; } }
  if (!footer) return;
  parSuratT_(footer,
    'Yayasan Apologet Islam Indonesia (APII) • Dewan Pimpinan Wilayah ' +
    'Jabodetabek • Tahun ' + (tahun || ''), 8, false, 'center', '#666666');
  parSuratT_(footer, 'Verifikasi keaslian surat: ' + (verifyUrl || ''),
    8, false, 'center', '#666666');
}

/**
 * tulisBlokT_: render satu blok naskah ke badan dokumen.
 * @param {object} body badan dokumen
 * @param {object} b spesifikasi blok
 * @param {object} vals peta nilai (jenis/nomor/judul/tanggal + content keys)
 * @param {string} ketuaName nama Ketua
 * @param {string} sekretarisName nama Sekretaris
 */
function tulisBlokT_(body, b, vals, ketuaName, sekretarisName) {
  switch (b.type) {
    case 'jenis':
      parSuratT_(body, vals.jenis || '', b.size, b.bold, b.align);
      break;
    case 'nomor':
      parSuratT_(body, 'Nomor : ' + (vals.nomor || ''), b.size, b.bold, b.align);
      break;
    case 'judul':
      parSuratT_(body, vals.judul || '', b.size, b.bold, b.align);
      break;
    case 'tanggal':
      parSuratT_(body, 'Ditetapkan di Jakarta pada tanggal ' +
        (vals.tanggal || ''), b.size, b.bold, b.align);
      break;
    case 'label':
      parSuratT_(body, b.text || '', b.size, b.bold, b.align);
      break;
    case 'field': {
      var key = b.key || '';
      var val = key ? (vals[key] || '') : '';
      // Nilai multi-baris -> satu paragraf per baris (label hanya di baris pertama).
      var lines = String(val).split(/\r?\n/);
      if (!lines.length || (lines.length === 1 && lines[0] === '')) lines = [''];
      lines.forEach(function (ln, i) {
        var txt = (i === 0 && b.label) ? (b.label + ' ' + ln) : ln;
        parSuratT_(body, txt, b.size, b.bold, b.align);
      });
      break;
    }
    case 'spasi':
      parSuratT_(body, '', b.size);
      break;
    case 'ttd':
      tulisBlokTtdT_(body, ketuaName, sekretarisName);
      break;
    default:
      break;
  }
}

/** Blok tanda tangan: Sekretaris (kiri) & Ketua (kanan) + stempel basah. */
function tulisBlokTtdT_(body, ketuaName, sekretarisName) {
  var table = body.appendTable();
  try { table.setBorderColor('#ffffff').setBorderWidth(0.5); } catch (e) {}
  var row = table.appendTableRow();
  var cSek = row.appendTableCell();
  var cKet = row.appendTableCell();
  try { cSek.setWidth(243.0); cKet.setWidth(243.0); } catch (e) {}

  parSuratT_(cSek, 'Sekretaris DPW Jabodetabek,', 11, false, 'center');
  parSuratT_(cSek, '', 10); parSuratT_(cSek, '', 10); parSuratT_(cSek, '', 10);
  parSuratT_(cSek, '( ' + sekretarisName + ' )', 11, true, 'center');

  parSuratT_(cKet, 'Ketua DPW Jabodetabek,', 11, false, 'center');
  try {
    var stempelImg = cKet.appendImage(getStempelBlob_());
    stempelImg.setWidth(95.0).setHeight(95.0);
  } catch (e) {
    Logger.log('Stempel gagal ditanam di template: ' + e);
  }
  parSuratT_(cKet, '( ' + ketuaName + ' )', 11, true, 'center');
}

/** Helper: tambah satu paragraf terformat ke container manapun. */
function parSuratT_(container, text, size, bold, align, color) {
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
