/**
 * ============================================================================
 * Surat.gs — Modul Persuratan Resmi
 * ============================================================================
 * State machine: DRAFT -> PENDING_APPROVAL -> PUBLISHED / REJECTED
 *   - create/update: SUPERADMIN, SEKRETARIS (hanya DRAFT)
 *   - submit: SUPERADMIN, SEKRETARIS
 *   - approve/reject: SUPERADMIN, KETUA  (approve memicu generate PDF)
 *   - verifySurat: publik (cek nomor/SHA-256 di portal)
 *
 * Nomor surat otomatis: {urut}/{KODE}/{romawi bulan}/{tahun} — reset per tahun.
 * ==========================================================================*/

/** Peta seluruh jenis surat aktif (bawaan + dinamis dari Sheet_Settings). */
function getLetterTypesMap_() {
  var types = getSettingValue_('letter_types', null);
  var map = {
    SK: { label: 'Surat Keputusan', prefix: 'SK' },
    UNDANGAN: { label: 'Surat Undangan', prefix: 'UND' },
    PENGANTAR: { label: 'Surat Pengantar', prefix: 'PENG' },
    KETERANGAN: { label: 'Surat Keterangan', prefix: 'KET' },
    TUGAS: { label: 'Surat Tugas', prefix: 'TUG' },
    REKOMENDASI: { label: 'Surat Rekomendasi', prefix: 'REK' },
    EDARAN: { label: 'Surat Edaran', prefix: 'EDR' },
    NOTULEN: { label: 'Notulen Rapat', prefix: 'NOT' },
    RAPAT: { label: 'Hasil Rapat / Risalah Rapat', prefix: 'RAPAT' },
    BA: { label: 'Berita Acara', prefix: 'BA' }
  };
  if (Array.isArray(types)) {
    types.forEach(function (t) {
      if (t && t.code) {
        map[t.code] = { label: t.label || t.name || t.code, prefix: t.prefix || t.code };
      }
    });
  }
  return map;
}

/** Bangun nomor surat dinamis dari jenis + tanggal surat. */
function buildLetterNumber(letterType, tanggalSurat) {
  var d = new Date(tanggalSurat || new Date());
  var tahun = d.getFullYear();
  var bulan = toRoman(d.getMonth() + 1);

  var numberingCfg = getSettingValue_('letter_numbering', {
    pattern: '{urut}/{kode}/{org}/{bulanRomawi}/{tahun}',
    org_code: 'DPW-APII',
    digits: 3
  });
  var orgCode = numberingCfg.org_code || 'DPW-APII';
  var digits = Number(numberingCfg.digits) || 3;

  var typeMap = getLetterTypesMap_();
  var typeInfo = typeMap[letterType] || { label: letterType, prefix: letterType };
  var prefix = typeInfo.prefix || letterType;
  var kodeSurat = prefix + '-' + orgCode;

  var urut = Database.nextSequence('SURAT:' + letterType + ':' + tahun);
  var urutStr = String(urut);
  while (urutStr.length < digits) urutStr = '0' + urutStr;

  var pattern = numberingCfg.pattern || '{urut}/{kode}/{org}/{bulanRomawi}/{tahun}';
  var res = pattern
    .replace('{urut}', urutStr)
    .replace('{kode}', prefix)
    .replace('{org}', orgCode)
    .replace('{bulanRomawi}', bulan)
    .replace('{tahun}', String(tahun));

  if (res.indexOf('{') !== -1) {
    res = urutStr + '/' + kodeSurat + '/' + bulan + '/' + tahun;
  }
  return res;
}

/** Canonical string untuk hashing integritas dokumen. */
function suratCanonical(s) {
  return [s.letter_number, s.title, s.letter_type, s.content, s.tanggal_surat].join('|');
}

/** SHA-256 hex dari canonical (dipakai verifikasi keaslian publik). */
function sha256Hex(text) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
  return digest.map(function (b) {
    var h = (b < 0 ? b + 256 : b).toString(16);
    return h.length === 1 ? '0' + h : h;
  }).join('');
}

/**
 * getListSurat: daftar surat + filter status/q + paginasi.
 * Filter visibilitas: SEKRETARIS lihat semua internal; Pembina/Pengawas read-only.
 * @param {object} ctx.payload { status?, q?, limit?, page? }
 */
function getListSurat(ctx) {
  var p = ctx.payload || {};
  var limit = Math.min(Number(p.limit) || 20, 100);
  var page = Math.max(Number(p.page) || 1, 1);
  var q = String(p.q || '').toLowerCase();

  var rows = Database.readAll(TABS.SURAT);

  // Pencarian tebas judul/nomor.
  if (q) {
    rows = rows.filter(function (s) {
      return (s.title || '').toLowerCase().indexOf(q) !== -1 ||
             (s.letter_number || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  // Filter status.
  if (p.status) rows = rows.filter(function (s) { return s.status === p.status; });

  // Urutkan terbaru dibuat.
  rows.sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });

  var typeMap = getLetterTypesMap_();
  var total = rows.length;
  var start = (page - 1) * limit;
  var items = rows.slice(start, start + limit).map(function (s) {
    var tInfo = typeMap[s.letter_type] || { label: LETTER_TYPE_LABELS[s.letter_type] || s.letter_type };
    return {
      id: s.id, letter_number: s.letter_number, title: s.title,
      letter_type: s.letter_type,
      letter_type_label: tInfo.label || s.letter_type,
      status: s.status, status_label: STATUS_LABELS[s.status] || s.status,
      tanggal_surat: s.tanggal_surat, tanggal_label: formatTanggal(s.tanggal_surat),
      created_by: s.created_by, created_by_name: s.created_by_name,
      created_at: s.created_at, submitted_at: s.submitted_at,
      published_at: s.published_at, approved_by: s.approved_by,
      rejection_notes: s.rejection_notes,
      content: s.content || '',
      pdf_url: s.status === 'PUBLISHED' ? s.pdf_url : '',
      qr_verify_url: s.status === 'PUBLISHED' ? s.qr_verify_url : ''
    };
  });

  return { ok: true, data: { items: items, total: total, page: page, limit: limit },
    message: 'Daftar surat berhasil dimuat.' };
}

/**
 * createSurat: buat draf surat. SUPERADMIN, SEKRETARIS.
 * @param {object} ctx.payload { title, letter_type, content{menimbang,mengingat,memutuskan},
 *                                tanggal_surat?, letter_number?, custom_type_code?, custom_type_label? }
 */
function createSurat(ctx) {
  var p = ctx.payload || {};
  if (!p.title) {
    return { ok: false, data: null, message: 'Perihal / judul surat wajib diisi.' };
  }

  var typeMap = getLetterTypesMap_();
  // Tangani custom letter type on-the-fly jika ada
  if (p.custom_type_code && p.custom_type_label) {
    var cCode = String(p.custom_type_code).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    var cLabel = String(p.custom_type_label).trim();
    if (!typeMap[cCode]) {
      var allTypes = getSettingValue_('letter_types', []);
      if (!Array.isArray(allTypes)) allTypes = [];
      allTypes.push({ code: cCode, label: cLabel, prefix: cCode, active: true });
      setSettingValue_('letter_types', allTypes, ctx.user.username);
      typeMap[cCode] = { label: cLabel, prefix: cCode };
    }
    p.letter_type = cCode;
  }

  if (!p.letter_type) {
    return { ok: false, data: null, message: 'Jenis surat wajib dipilih.' };
  }
  if (!typeMap[p.letter_type] && !LETTER_TYPE_CODES[p.letter_type]) {
    return { ok: false, data: null, message: 'Jenis surat tidak valid.' };
  }

  var tanggal = p.tanggal_surat || new Date().toISOString().slice(0, 10);
  var content = p.content || { menimbang: '', mengingat: '', memutuskan: '' };
  var contentStr;
  try { contentStr = JSON.stringify(content); } catch (e) { contentStr = '{}'; }

  // Nomor: pakai input bila ada & unik, jika tidak auto-generate.
  var letterNumber = String(p.letter_number || '').trim();
  if (!letterNumber) {
    letterNumber = buildLetterNumber(p.letter_type, tanggal);
  } else if (Database.findOne(TABS.SURAT, { letter_number: letterNumber })) {
    return { ok: false, data: null, message: 'Nomor surat sudah digunakan.' };
  }

  var now = new Date().toISOString();
  var created = Database.insert(TABS.SURAT, {
    id: uuid(), letter_number: letterNumber, title: p.title,
    letter_type: p.letter_type, content: contentStr, status: 'DRAFT',
    tanggal_surat: tanggal,
    created_by: ctx.user.username, created_by_name: ctx.user.full_name || ctx.user.username,
    created_at: now, submitted_at: '', published_at: '', approved_by: '',
    rejection_notes: '', sha256_hash: '', pdf_url: '', qr_verify_url: ''
  });

  return { ok: true, data: { id: created.id, letter_number: created.letter_number },
    message: 'Draf surat berhasil dibuat dengan nomor ' + created.letter_number + '.' };
}

/**
 * updateSurat: ubah surat. Hanya boleh saat status DRAFT. SUPERADMIN, SEKRETARIS.
 */
function updateSurat(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID surat wajib diisi.' };
  var s = Database.findOne(TABS.SURAT, { id: p.id });
  if (!s) return { ok: false, data: null, message: 'Surat tidak ditemukan.' };
  if (s.status !== 'DRAFT') {
    return { ok: false, data: null,
      message: 'Surat yang sudah diajukan/diterbitkan tidak dapat diubah.' };
  }

  var values = {};
  if (p.title) values.title = p.title;
  if (p.letter_type && LETTER_TYPE_CODES[p.letter_type]) values.letter_type = p.letter_type;
  if (p.tanggal_surat) values.tanggal_surat = p.tanggal_surat;
  if (p.content) {
    try { values.content = JSON.stringify(p.content); } catch (e) { /* abaikan */ }
  }
  // Nomor bisa diganti selama DRAFT & tetap unik.
  if (p.letter_number) {
    var ln = String(p.letter_number).trim();
    if (ln !== s.letter_number) {
      if (Database.findOne(TABS.SURAT, { letter_number: ln })) {
        return { ok: false, data: null, message: 'Nomor surat sudah digunakan.' };
      }
      values.letter_number = ln;
    }
  }
  if (!Object.keys(values).length) {
    return { ok: false, data: null, message: 'Tidak ada perubahan yang dikirim.' };
  }

  Database.updateRow(TABS.SURAT, s._row, values);
  return { ok: true, data: null, message: 'Surat berhasil diperbarui.' };
}

/**
 * submitSurat: ajukan DRAFT ke ketua. SUPERADMIN, SEKRETARIS.
 */
function submitSurat(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID surat wajib diisi.' };
  var s = Database.findOne(TABS.SURAT, { id: p.id });
  if (!s) return { ok: false, data: null, message: 'Surat tidak ditemukan.' };
  if (s.status !== 'DRAFT') {
    return { ok: false, data: null,
      message: 'Hanya surat draf yang dapat diajukan (status saat ini: ' +
               (STATUS_LABELS[s.status] || s.status) + ').' };
  }

  Database.updateRow(TABS.SURAT, s._row, {
    status: 'PENDING_APPROVAL', submitted_at: new Date().toISOString()
  });
  audit(ctx.user.username, 'SURAT_SUBMIT', 'Nomor ' + s.letter_number);

  // Notifikasi email ke Ketua DPW
  kirimNotifikasiKeRole_(ROLES.KETUA,
    'Persetujuan Surat: ' + s.letter_number,
    'Permohonan Persetujuan Surat',
    'Draf surat <strong>' + s.title + '</strong> (Nomor: <code>' + s.letter_number + '</code>) telah diajukan oleh <strong>' + (ctx.user.full_name || ctx.user.username) + '</strong> dan menunggu persetujuan Anda.',
    'Tinjau & Setujui Surat',
    (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/surat');

  return { ok: true, data: null,
    message: 'Surat ' + s.letter_number + ' diajukan ke Ketua untuk persetujuan.' };
}

/**
 * approveSurat: setujui & terbitkan. Hanya KETUA/SUPERADMIN.
 * Memutuskan transisi PENDING_APPROVAL -> PUBLISHED + generate PDF + hash.
 */
function approveSurat(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID surat wajib diisi.' };
  var s = Database.findOne(TABS.SURAT, { id: p.id });
  if (!s) return { ok: false, data: null, message: 'Surat tidak ditemukan.' };
  if (s.status !== 'PENDING_APPROVAL') {
    return { ok: false, data: null,
      message: 'Hanya surat yang menunggu persetujuan yang dapat diterbitkan.' };
  }

  var hash = sha256Hex(suratCanonical(s));
  var pdfUrl = '';
  var verifyUrl = '';
  try {
    pdfUrl = generateSuratPdf_(s);
  } catch (e) {
    Logger.log('Generate PDF gagal: ' + e);
    return { ok: false, data: null,
      message: 'Gagal membuat PDF surat. Tim IT akan memeriksa folder Drive/template.' };
  }
  // URL verifikasi publik (via 99-TemplateSurat.gs, domain dari KONFIG).
  verifyUrl = urlVerifikasiSurat_(s.letter_number);

  Database.updateRow(TABS.SURAT, s._row, {
    status: 'PUBLISHED', published_at: new Date().toISOString(),
    approved_by: ctx.user.username, sha256_hash: hash,
    pdf_url: pdfUrl, qr_verify_url: verifyUrl
  });
  audit(ctx.user.username, 'SURAT_PUBLISHED', 'Nomor ' + s.letter_number);

  // Notifikasi email ke pembuat surat (Sekretaris)
  kirimNotifikasiKeUser_(s.created_by,
    'Surat Telah Diterbitkan: ' + s.letter_number,
    'Surat Resmi Telah Diterbitkan',
    'Surat <strong>' + s.title + '</strong> (Nomor: <code>' + s.letter_number + '</code>) telah disetujui oleh Ketua DPW dan resmi diterbitkan beserta salinan PDF di Google Drive.',
    'Buka Dokumen Resmi',
    (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/surat');

  return { ok: true, data: { pdf_url: pdfUrl, sha256_hash: hash },
    message: 'Surat ' + s.letter_number + ' telah diterbitkan dan PDF tersedia.' };
}

/**
 * rejectSurat: tolak surat. KETUA/SUPERADMIN. Catatan penolakan WAJIB.
 */
function rejectSurat(ctx) {
  var p = ctx.payload || {};
  if (!p.id) return { ok: false, data: null, message: 'ID surat wajib diisi.' };
  if (!p.notes || !String(p.notes).trim()) {
    return { ok: false, data: null, message: 'Alasan penolakan wajib diisi.' };
  }
  var s = Database.findOne(TABS.SURAT, { id: p.id });
  if (!s) return { ok: false, data: null, message: 'Surat tidak ditemukan.' };
  if (s.status !== 'PENDING_APPROVAL') {
    return { ok: false, data: null,
      message: 'Hanya surat yang menunggu persetujuan yang dapat ditolak.' };
  }

  Database.updateRow(TABS.SURAT, s._row, {
    status: 'REJECTED', approved_by: ctx.user.username,
    rejection_notes: String(p.notes).trim()
  });
  audit(ctx.user.username, 'SURAT_REJECTED', 'Nomor ' + s.letter_number + ': ' + p.notes);

  // Notifikasi email ke pembuat surat
  kirimNotifikasiKeUser_(s.created_by,
    'Draf Surat Dikembalikan: ' + s.letter_number,
    'Catatan Perbaikan Draf Surat',
    'Draf surat <strong>' + s.title + '</strong> (Nomor: <code>' + s.letter_number + '</code>) telah dikembalikan oleh Ketua DPW dengan catatan perbaikan:<br/><blockquote style="background:#fee2e2;padding:10px 14px;border-left:4px solid #ef4444;margin:12px 0;color:#991b1b;border-radius:4px;">' + String(p.notes).trim() + '</blockquote>',
    'Perbaiki Draf Surat',
    (KONFIG.PUBLIC_URL || 'https://siapii.sigitadi.id') + '/#/surat');

  return { ok: true, data: null, message: 'Surat ' + s.letter_number + ' telah ditolak.' };
}

/**
 * getPublishedSurat: daftar surat PUBLISHED untuk portal publik (TANPA login).
 * Dipakai section "Dokumen Resmi" di apii.sigitadi.id.
 * @param {object} ctx.payload { limit?, page? }
 */
function getPublishedSurat(ctx) {
  var p = ctx.payload || {};
  var limit = Math.min(Number(p.limit) || 9, 50);
  var page = Math.max(Number(p.page) || 1, 1);

  var rows = Database.readAll(TABS.SURAT)
    .filter(function (s) { return s.status === 'PUBLISHED'; })
    .sort(function (a, b) { return (b.published_at || '').localeCompare(a.published_at || ''); });

  var total = rows.length;
  var start = (page - 1) * limit;
  var items = rows.slice(start, start + limit).map(function (s) {
    return {
      id: s.id, letter_number: s.letter_number, title: s.title,
      letter_type: s.letter_type,
      letter_type_label: LETTER_TYPE_LABELS[s.letter_type] || s.letter_type,
      tanggal_label: formatTanggal(s.tanggal_surat),
      published_at: s.published_at, pdf_url: s.pdf_url
    };
  });

  return { ok: true, data: { items: items, total: total, page: page, limit: limit },
    message: 'Daftar dokumen resmi berhasil dimuat.' };
}

/**
 * verifySurat: verifikasi keaslian surat oleh MASYARAKAT (publik, tanpa login).
 * Dipakai portal publik apii.sigitadi.id.
 * @param {object} ctx.payload { letter_number } atau { hash }
 */
function verifySurat(ctx) {
  var p = ctx.payload || {};
  var s = null;
  if (p.letter_number) {
    s = Database.findOne(TABS.SURAT, { letter_number: String(p.letter_number).trim() });
  } else if (p.hash) {
    s = Database.findOne(TABS.SURAT, { sha256_hash: String(p.hash).trim() });
  }
  if (!s) {
    return { ok: false, data: null,
      message: 'Nomor surat tidak ditemukan dalam sistem.' };
  }
  // Hanya surat PUBLISHED yang bisa diverifikasi publik.
  if (s.status !== 'PUBLISHED') {
    return { ok: false, data: null,
      message: 'Surat dengan nomor ini belum diterbitkan secara resmi.' };
  }
  return {
    ok: true,
    data: {
      letter_number: s.letter_number, title: s.title,
      letter_type_label: LETTER_TYPE_LABELS[s.letter_type] || s.letter_type,
      tanggal_label: formatTanggal(s.tanggal_surat),
      status: s.status, status_label: STATUS_LABELS[s.status],
      published_at: s.published_at, approved_by: s.approved_by,
      sha256_hash: s.sha256_hash, pdf_url: s.pdf_url,
      valid: true
    },
    message: 'Surat sah & diterbitkan resmi oleh Yayasan APII DPW Jabodetabek.'
  };
}

/**
 * generateSuratPdf_: render surat jadi PDF via template Google Docs.
 * Langkah: salin template -> ganti placeholder -> ekspor PDF -> simpan ke Drive.
 * @param {object} s baris Sheet_Surat
 * @return {string} URL publik file PDF
 */
function generateSuratPdf_(s) {
  // Template & folder dibuat otomatis oleh 99-TemplateSurat.gs bila belum ada.
  var templateId = siapkanTemplateSurat_();
  var folderId = siapkanFolderPdf_();

  var content;
  try { content = JSON.parse(s.content || '{}'); } catch (e) { content = {}; }

  // Nama pejabat penanda tangan diambil dari Sheet_Users (pejabat aktif),
  // bukan string hard-coded, supaya cetakan sesuai pemegang jabatan.
  // Bila belum ada akunnya, fallback ke label jabatan.
  var ketuaName = 'Ketua DPW Jabodetabek';
  var sekretarisName = 'Sekretaris DPW Jabodetabek';
  try {
    var ketua = Database.findOne(TABS.USERS, { role: ROLES.KETUA, is_active: 'TRUE' });
    if (ketua && ketua.full_name) ketuaName = ketua.full_name;
    var sek = Database.findOne(TABS.USERS, { role: ROLES.SEKRETARIS, is_active: 'TRUE' });
    if (sek && sek.full_name) sekretarisName = sek.full_name;
  } catch (e) { /* pakai label default */ }

  var placeholder = {
    NOMOR: s.letter_number, JUDUL: s.title,
    JENIS: LETTER_TYPE_LABELS[s.letter_type] || s.letter_type,
    TANGGAL: formatTanggal(s.tanggal_surat),
    TAHUN: String(new Date(s.tanggal_surat || new Date()).getFullYear()),
    MENIMBANG: content.menimbang || '', MENGINGAT: content.mengingat || '',
    MEMUTUSKAN: content.memutuskan || '',
    KETUA: ketuaName, SEKRETARIS: sekretarisName
  };

  // 1) Salin template.
  var fileName = 'Surat - ' + s.letter_type + ' - ' + s.letter_number + '.pdf';
  var copy = DriveApp.getFileById(templateId).makeCopy(fileName.replace(/\.pdf$/, ''));
  var docId = copy.getId();

  try {
    // 2) Ganti placeholder di body.
    var doc = DocumentApp.openById(docId);
    replaceInBody_(doc.getBody(), placeholder);
    // Header & footer juga (kop surat).
    try { replaceInBody_(doc.getHeader(), placeholder); } catch (e) { /* header opsional */ }
    try { replaceInBody_(doc.getFooter(), placeholder); } catch (e) { /* footer opsional */ }
    doc.saveAndClose();

    // 3) Ekspor ke PDF.
    var url = 'https://docs.google.com/document/d/' + docId + '/export?format=pdf';
    var pdfBlob = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    }).getBlob().setName(fileName);

    // 4) Simpan ke folder tujuan & set sharing publik.
    var file = DriveApp.getFolderById(folderId).createFile(pdfBlob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } finally {
    // 5) Buang salinan Docs sementara.
    try { copy.setTrashed(true); } catch (e) { /* sudah terhapus */ }
  }
}

/** Ganti semua placeholder {{KEY}} di seluruh paragraf/tabel sebuah badan teks. */
function replaceInBody_(body, placeholder) {
  for (var key in placeholder) {
    body.replaceText('{{' + key + '}}', String(placeholder[key]));
  }
}

/**
 * reserveLetterNumber: reservasi / booking nomor surat resmi sebelum draf naskah selesai.
 * SUPERADMIN, SEKRETARIS.
 * @param {object} ctx.payload { letter_type, title?, tanggal_surat? }
 */
function reserveLetterNumber(ctx) {
  var p = ctx.payload || {};
  if (!p.letter_type) {
    return { ok: false, data: null, message: 'Jenis surat wajib dipilih.' };
  }
  var tanggal = p.tanggal_surat || new Date().toISOString().slice(0, 10);
  var letterNumber = buildLetterNumber(p.letter_type, tanggal);
  var now = new Date().toISOString();

  var created = Database.insert(TABS.SURAT, {
    id: uuid(),
    letter_number: letterNumber,
    title: p.title || '(Nomor Dipesan: ' + letterNumber + ')',
    letter_type: p.letter_type,
    content: JSON.stringify({ menimbang: '', mengingat: '', memutuskan: '' }),
    status: 'DRAFT',
    tanggal_surat: tanggal,
    created_by: ctx.user.username,
    created_by_name: ctx.user.full_name || ctx.user.username,
    created_at: now,
    submitted_at: '', published_at: '', approved_by: '',
    rejection_notes: '', sha256_hash: '', pdf_url: '', qr_verify_url: ''
  });

  audit(ctx.user.username, 'SURAT_RESERVED', 'Memesan nomor surat resmi ' + letterNumber, 'SURAT');
  return {
    ok: true,
    data: { id: created.id, letter_number: letterNumber },
    message: 'Nomor surat ' + letterNumber + ' berhasil dibooking.'
  };
}

