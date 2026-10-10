// Uji smoke tanpa jaringan untuk gas/TemplateSurat.gs (Master Template Surat).
// ===========================================================================
// Memuat gas/99-TemplateSurat.gs + gas/TemplateSurat.gs mentah, lalu
// menjalankannya di atas tiruan Google Services DALAM MEMORI (tidak ada
// panggilan UrlFetchApp/DriveApp/DocumentApp/SpreadsheetApp sungguhan):
//
//   A) validasi blok tidak sah ditolak
//      validateTemplateFields_ menolak JSON rusak, non-array, array kosong,
//      dan blok dengan type tidak dikenal; saveLetterTemplate menolak
//      spesifikasi yang seluruhnya tidak sah.
//
//   B) soft delete mempertahankan master PDF
//      deleteLetterTemplate hanya menyetel is_active='FALSE'; kolom
//      drive_file_id & pdf_url SAMA SEKALI tidak berubah dan file Drive-nya
//      tidak dibuang ke Trash. Template default tidak boleh dihapus.
//
//   C) renderTemplatePdf_ menghasilkan URL PDF
//      surat bertemplate dirangkai sampai PDF tanpa menyentuh jaringan:
//      dokumen antara dibuang, file PDF dibuat di folder surat, dan nilai
//      baliknya adalah URL https://drive.google.com/... yang bisa dibagikan.
//
// Pakai: node scripts/smoke-template-surat.mjs
import { readFileSync } from 'node:fs';

// Kode yang diuji: 99-TemplateSurat.gs (siapkanFolderPdf_, getLogoBlob_,
// getStempelBlob_, urlVerifikasiSurat_) + TemplateSurat.gs (unit uji).
const code =
  readFileSync('gas/99-TemplateSurat.gs', 'utf8') + '\n' +
  readFileSync('gas/TemplateSurat.gs', 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

// ---------------------------------------------------------------------------
// Tiruan minimal SpreadsheetApp + Database (in-memory, mengikuti SCHEMA asli)
// ---------------------------------------------------------------------------
const TABS = {
  USERS: 'Sheet_Users', AUDIT: 'Sheet_AuditLogs', SETTINGS: 'Sheet_Settings',
  TEMPLATES: 'Sheet_Templates'
};
const SCHEMA = {};
SCHEMA[TABS.USERS] = ['id', 'username', 'password_hash', 'full_name', 'email', 'role',
  'division', 'is_active', 'can_manage_users', 'permissions', 'created_at', 'updated_at'];
SCHEMA[TABS.AUDIT] = ['id', 'timestamp', 'actor', 'action', 'module', 'detail', 'ip_client', 'status'];
SCHEMA[TABS.SETTINGS] = ['key', 'value', 'description', 'updated_by', 'updated_at'];
SCHEMA[TABS.TEMPLATES] = ['id', 'name', 'description', 'drive_file_id', 'pdf_url',
  'fields', 'is_default', 'is_active', 'page_count', 'created_by', 'created_at', 'updated_at'];

function matchFilter_(row, filter) {
  for (const k in filter) {
    const want = filter[k], have = row[k];
    if (typeof want === 'boolean' || typeof have === 'boolean') {
      const bW = want === true || String(want).toUpperCase() === 'TRUE';
      const bH = have === true || String(have).toUpperCase() === 'TRUE';
      if (bW !== bH) return false;
    } else if (typeof want === 'string') {
      if (String(have) !== want) return false;
    } else if (have !== want) {
      return false;
    }
  }
  return true;
}

function createDatabase() {
  const tables = {};
  const api = {
    readAll(tab) { return (tables[tab] || []).map((r) => ({ ...r })); },
    findOne(tab, filter) {
      const rows = api.readAll(tab);
      for (let i = 0; i < rows.length; i++) if (matchFilter_(rows[i], filter)) return rows[i];
      return null;
    },
    findMany(tab, filter) { return api.readAll(tab).filter((r) => matchFilter_(r, filter)); },
    insert(tab, values) {
      if (!tables[tab]) tables[tab] = [];
      const headers = SCHEMA[tab];
      const obj = { _row: tables[tab].length + 2 };
      headers.forEach((h) => {
        const v = values[h];
        obj[h] = (v === undefined || v === null) ? '' : v;
      });
      tables[tab].push(obj);
      return { ...obj };
    },
    updateRow(tab, rowNum, values) {
      const rows = tables[tab] || [];
      const row = rows.find((r) => r._row === rowNum);
      if (!row) return false;
      let changed = false;
      SCHEMA[tab].forEach((h) => {
        if (values[h] !== undefined && values[h] !== null) { row[h] = values[h]; changed = true; }
      });
      return changed;
    },
    // Helper pribadi untuk uji (bukan bagian dari API Database asli).
    _raw(tab) { return tables[tab] || []; }
  };
  return api;
}

const Database = createDatabase();

// ---------------------------------------------------------------------------
// Tiruan minimal Google Services. UrlFetchApp TIDAK pernah menyentuh
// jaringan — panggilan dicatat dan dibalas dengan blob PDF fiktif.
// ---------------------------------------------------------------------------
const scriptProps = {};
const PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (k) => (k in scriptProps ? scriptProps[k] : null),
    setProperty: (k, v) => { scriptProps[k] = String(v); },
    deleteProperty: (k) => { delete scriptProps[k]; }
  })
};

let fileSeq = 0;
const driveFiles = new Map();   // id -> record file
const driveFolders = new Map();  // id -> record folder
function folderRecord(name) {
  const id = 'folder-' + (++fileSeq);
  const rec = { id, name, children: [], files: [], trashed: false };
  driveFolders.set(id, rec);
  return rec;
}
function fileRecord(name, folderId, mime) {
  const id = 'file-' + (++fileSeq);
  const rec = { id, name, folderId, mime, trashed: false, shared: false };
  driveFiles.set(id, rec);
  driveFolders.get(folderId).files.push(rec);
  return rec;
}
function fileApi(rec) {
  return {
    getId: () => rec.id,
    getName: () => rec.name,
    getUrl: () => 'https://drive.google.com/file/d/' + rec.id + '/view?usp=drivesdk',
    isTrashed: () => rec.trashed,
    setTrashed: (v) => { rec.trashed = v !== false; },
    setSharing: () => { rec.shared = true; }
  };
}
function folderApi(rec) {
  return {
    getId: () => rec.id,
    getName: () => rec.name,
    getUrl: () => 'https://drive.google.com/drive/folders/' + rec.id,
    isTrashed: () => rec.trashed,
    createFolder: (n) => folderApi(folderRecord(n)),
    createFile: (blob) => fileApi(fileRecord(blob.name || 'tanpa-nama', rec.id, blob.mime || 'application/octet-stream')),
    getFoldersByName: (n) => {
      const found = rec.children.map((c) => driveFolders.get(c)).filter((f) => f && f.name === n && !f.trashed);
      let i = 0;
      return { hasNext: () => i < found.length, next: () => folderApi(found[i++]) };
    }
  };
}
// Root Drive membatasi pembuatan folder & pencarian ke tingkat teratas.
const rootFolder = folderRecord('My Drive');
const DriveApp = {
  Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
  Permission: { VIEW: 'VIEW' },
  getFolderById: (id) => folderApi(driveFolders.get(id)),
  getFileById: (id) => fileApi(driveFiles.get(id)),
  createFolder: (n) => folderApi(folderRecord(n)),
  getFoldersByName: (n) => {
    const found = [...driveFolders.values()].filter((f) => f.name === n && !f.trashed && f !== rootFolder);
    let i = 0;
    return { hasNext: () => i < found.length, next: () => folderApi(found[i++]) };
  }
};

// Tiruan DocumentApp: setiap container mencatat paragraf/gambar/tabel yang
// ditulis, agar uji bisa membuktikan APA yang dirender mesin template.
function makeContainer() {
  const paras = [], images = [];
  const image = { setWidth() { return this; }, setHeight() { return this; } };
  const self = {
    paragraphs: paras,
    images: images,
    appendParagraph: (text) => {
      const p = { text: String(text) };
      const edit = {
        setFontSize() { return edit; }, setBold() { return edit; },
        setForegroundColor() { return edit; }
      };
      paras.push(p);
      return { editAsText: () => edit,
        setAlignment() { return self; },
        setSpacingBefore() { return self; }, setSpacingAfter() { return self; } };
    },
    insertImage: (idx, blob) => { images.push(blob.name || 'image'); return image; },
    appendImage: (blob) => { images.push(blob.name || 'image'); return image; },
    appendHorizontalRule: () => ({
      setSpacingBefore() { return this; }, setSpacingAfter() { return this; }
    }),
    appendTable: () => {
      const table = {
        setBorderColor() { return table; }, setBorderWidth() { return table; },
        appendTableRow: () => ({
          // Paragraf sel ikut tercatat di container induknya (blok ttd) agar
          // uji bisa membuktikan nama Ketua/Sekretaris ikut dirender.
          appendTableCell: () => {
            const cell = makeContainer();
            cell.setWidth = () => cell;
            const inner = cell.appendParagraph;
            cell.appendParagraph = (text) => { paras.push({ text: String(text) }); return inner(text); };
            return cell;
          }
        })
      };
      return table;
    }
  };
  return self;
}
let docSeq = 0;
const docsCreated = [];
const DocumentApp = {
  HorizontalAlignment: { CENTER: 'CENTER', RIGHT: 'RIGHT' },
  create: (name) => {
    const id = 'doc-' + (++docSeq);
    // Dokumen Apps Script otomatis muncul di Drive — daftarkan agar
    // DriveApp.getFileById(id).setTrashed(true) di renderTemplatePdf_ jalan.
    driveFiles.set(id, { id, name, folderId: null,
      mime: 'application/vnd.google-apps.document', trashed: false, shared: false });
    const header = makeContainer(), footer = makeContainer();
    const doc = {
      id, name, headerAsked: 0, footerAsked: 0,
      getBody: () => doc.body,
      getHeader: () => { doc.headerAsked++; return doc._hasHeader ? header : null; },
      addHeader: () => { doc._hasHeader = true; return header; },
      getFooter: () => { doc.footerAsked++; return doc._hasFooter ? footer : null; },
      addFooter: () => { doc._hasFooter = true; return footer; },
      getId: () => id,
      getUrl: () => 'https://docs.google.com/document/d/' + id + '/edit',
      saveAndClose: () => {}
    };
    doc.body = makeContainer();
    doc.header = header;
    doc.footer = footer;
    docsCreated.push(doc);
    return doc;
  }
};

// Tiruan UrlFetchApp: MENCEGAH panggilan jaringan. Mencatat URL export lalu
// membalas blob PDF fiktif — inilah inti "tanpa jaringan" dari uji ini.
const fetchCalls = [];
const UrlFetchApp = {
  fetch: (url, opts) => {
    fetchCalls.push({ url, opts });
    const blob = {
      name: 'export.pdf', mime: 'application/pdf',
      setName: (n) => { blob.name = n; return blob; }
    };
    return { getBlob: () => blob };
  }
};

const Utilities = {
  base64Decode: (s) => Buffer.from(String(s).replace(/^data:[^;]+;base64,/, ''), 'base64'),
  newBlob: (bytes, mime, name) => ({ bytes, mime, name, setName(n) { this.name = n; return this; } })
};
const ScriptApp = { getOAuthToken: () => 'oauth-token-uji' };
const Logger = { log: () => {} };

// Aset base64 asli dihasilkan build ke apps-script/Aset*.gs. Di sini dipakai
// placeholder valid agar getLogoBlob_/getStempelBlob_ (dekoder) berjalan;
// isinya tidak memengaruhi perilaku yang diuji.
const LOGO_BASE64 = 'dGVzdC1sb2dvLWJhc2U2NA==';
const STEMPEL_BASE64 = 'dGVzdC1zdGVtcGVsLWJhc2U2NA==';

// ---------------------------------------------------------------------------
// Eksternal lain yang dipakai TemplateSurat.gs (definisi asli dari gas/*.gs)
// ---------------------------------------------------------------------------
const KONFIG = {
  PUBLIC_URL: 'https://apii.sigitadi.id',
  DRIVE_FOLDER_NAME: 'APII Jabo - PDF Surat Resmi'
};
const ROLES = { SUPERADMIN: 'SUPERADMIN', KETUA: 'KETUA', SEKRETARIS: 'SEKRETARIS' };
const LETTER_TYPE_LABELS = {
  SK: 'Surat Keputusan', UNDANGAN: 'Surat Undangan', PENGANTAR: 'Surat Pengantar',
  KETERANGAN: 'Surat Keterangan', TUGAS: 'Surat Tugas', REKOMENDASI: 'Surat Rekomendasi',
  EDARAN: 'Surat Edaran'
};

function uuid() {
  const chars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) { out += '-'; continue; }
    if (i === 14) { out += '4'; continue; }
    if (i === 19) { out += chars[Math.floor(Math.random() * 4) + 8]; continue; }
    out += chars[Math.floor(Math.random() * 16)];
  }
  return out;
}

function audit(actor, action, detail, module) {
  Database.insert(TABS.AUDIT, {
    id: uuid(), timestamp: new Date().toISOString(),
    actor: actor || 'unknown', action: action || 'UNKNOWN',
    module: module || 'SYSTEM', detail: detail || '', ip_client: '', status: 'SUCCESS'
  });
}

function getSettingValue_(key, defaultVal) {
  const row = Database.findOne(TABS.SETTINGS, { key });
  if (!row || !row.value) return defaultVal;
  try { return JSON.parse(row.value); } catch (e) { return row.value; }
}

function formatTanggal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
    'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return d.getDate() + ' ' + bulan[d.getMonth()] + ' ' + d.getFullYear();
}

// ---------------------------------------------------------------------------
// Muat kode produksi ke dalam sandbox (hanya mendefinisikan fungsi)
// ---------------------------------------------------------------------------
const api = new Function(
  'Database', 'PropertiesService', 'DriveApp', 'DocumentApp', 'UrlFetchApp',
  'Utilities', 'ScriptApp', 'Logger', 'KONFIG', 'TABS', 'ROLES',
  'LETTER_TYPE_LABELS', 'uuid', 'audit', 'getSettingValue_', 'formatTanggal',
  'LOGO_BASE64', 'STEMPEL_BASE64',
  code + `
  return { getLetterTemplates, saveLetterTemplate, deleteLetterTemplate,
           validateTemplateFields_, defaultTemplateFields_, renderTemplatePdf_ };
`
)(
  Database, PropertiesService, DriveApp, DocumentApp, UrlFetchApp,
  Utilities, ScriptApp, Logger, KONFIG, TABS, ROLES,
  LETTER_TYPE_LABELS, uuid, audit, getSettingValue_, formatTanggal,
  LOGO_BASE64, STEMPEL_BASE64
);

const ctx = { user: { username: 'superadmin' } };
console.log('== A) Validasi blok tidak sah ditolak ==');
check('JSON rusak ditolak', api.validateTemplateFields_('{bukan:json}') === null);
check('string kosong ditolak', api.validateTemplateFields_('') === null);
check('objek (bukan array) ditolak', api.validateTemplateFields_('{"type":"label"}') === null);
check('array kosong ditolak', api.validateTemplateFields_('[]') === null);
check('null ditolak', api.validateTemplateFields_(null) === null);
check('blok type tidak dikenal ditolak semuanya',
  api.validateTemplateFields_([{ type: 'HANCUR' }, { type: 'sampah' }]) === null);
check('blok tidak sah dibuang; blok sah tetap',
  (() => {
    const out = api.validateTemplateFields_([
      { type: 'label', text: 'TENTANG' }, { type: 'PEMBATALAN' }, { type: 'spasi' }
    ]);
    return Array.isArray(out) && out.length === 2 &&
      out[0].type === 'label' && out[1].type === 'spasi';
  })(),
  `(${JSON.stringify(api.validateTemplateFields_([{ type: 'label', text: 'TENTANG' }, { type: 'PEMBATALAN' }, { type: 'spasi' }]))})`);
check('field dinormalisasi: key, size, align',
  (() => {
    const out = api.validateTemplateFields_([
      { type: 'field', key: 'menimbang aneh!', label: 'Menimbang :', size: 99, align: 'kiri' }
    ]);
    return out[0].key === 'menimbang_aneh_' && out[0].size === 24 && out[0].align === 'left';
  })());
check('size minimal 7 & label terpotong',
  (() => {
    const out = api.validateTemplateFields_([
      { type: 'field', key: 'x', label: 'A'.repeat(100), size: 2 }
    ]);
    return out[0].size === 7 && out[0].label.length === 60;
  })());
check('maksimum 60 blok (sisanya dibuang)',
  api.validateTemplateFields_(Array.from({ length: 70 }, () => ({ type: 'spasi' }))).length === 60);
check('spesifikasi bawaan selalu sah',
  Array.isArray(api.defaultTemplateFields_()) && api.defaultTemplateFields_().length > 0);

console.log('\n== A2) saveLetterTemplate menolak blok tidak sah ==');
let res = api.saveLetterTemplate({ user: ctx.user, payload: { name: 'Blok Rusak', fields: 'bukan-array' } });
check('input bukan array ditolak',
  res.ok === false && /tidak valid/.test(res.message), `(${res.message})`);
res = api.saveLetterTemplate({ user: ctx.user, payload: { name: 'Blok Rusak', fields: [{ type: 'hancur' }] } });
check('semua blok tidak dikenal -> ditolak',
  res.ok === false && /tidak valid/.test(res.message), `(${res.message})`);
check('tidak ada baris template yang dibuat untuk input ditolak',
  Database.readAll(TABS.TEMPLATES).length === 0);
res = api.saveLetterTemplate({ user: ctx.user, payload: { name: '' } });
check('nama kosong ditolak',
  res.ok === false && /wajib diisi/.test(res.message), `(${res.message})`);
res = api.saveLetterTemplate({ user: ctx.user, payload: { name: 'Sah', fields: [{ type: 'label', text: 'TENTANG' }] } });
check('blok sah diterima & tersimpan',
  res.ok === true && Boolean(res.data && res.data.id), `(${res.message})`);
check('fields tersimpan persis seperti hasil validasi',
  (() => {
    const row = Database.findOne(TABS.TEMPLATES, { id: res.data.id });
    return row && JSON.parse(row.fields).length === 1 &&
      JSON.parse(row.fields)[0].text === 'TENTANG';
  })());
check('tidak ada master PDF yang diunggah',
  (() => {
    const row = Database.findOne(TABS.TEMPLATES, { id: res.data.id });
    return row && row.drive_file_id === '' && row.pdf_url === '';
  })());
check('jejak audit TEMPLATE_CREATE tercatat',
  Database.findOne(TABS.AUDIT, { action: 'TEMPLATE_CREATE' }) !== null);
console.log('\n== B) Soft delete mempertahankan master PDF ==');
// Template lengkap dengan master PDF asli diunggah pengurus.
res = api.saveLetterTemplate({
  user: ctx.user,
  payload: {
    name: 'SK Resmi 2026',
    description: 'Template surat keputusan',
    pdf_base64: 'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iag==',
    pdf_name: 'SK Resmi 2026.pdf',
    fields: [{ type: 'jenis' }, { type: 'nomor' }, { type: 'ttd' }]
  }
});
check('template dengan master PDF tersimpan',
  res.ok === true && Boolean(res.data && res.data.id), `(${res.message})`);
const tplId = res.data && res.data.id;
const rowBefore = Database.findOne(TABS.TEMPLATES, { id: tplId });
const masterFileId = rowBefore.drive_file_id;
check('master PDF tercatat dengan drive_file_id & pdf_url',
  Boolean(masterFileId) && /^https:\/\/drive\.google\.com\//.test(rowBefore.pdf_url),
  `(${JSON.stringify({ drive_file_id: masterFileId, pdf_url: rowBefore.pdf_url })})`);
check('master PDF benar-benar dibuat di Drive (folder template)',
  driveFiles.has(masterFileId) && !driveFiles.get(masterFileId).trashed);
check('master PDF tersimpan di subfolder "Master Template Surat"',
  driveFiles.get(masterFileId).folderId !== scriptProps.DRIVE_FOLDER_ID &&
  driveFolders.get(driveFiles.get(masterFileId).folderId).name === 'Master Template Surat');

// Nonaktifkan template (soft delete).
res = api.deleteLetterTemplate({ user: ctx.user, payload: { id: tplId } });
check('deleteLetterTemplate menjawab sukses',
  res.ok === true && /dinonaktifkan/.test(res.message), `(${res.message})`);
const rowAfter = Database.findOne(TABS.TEMPLATES, { id: tplId });
check('is_active menjadi FALSE (soft delete, baris tetap ada)',
  Boolean(rowAfter) && rowAfter.is_active === 'FALSE');
check('is_default ikut dibersihkan menjadi FALSE',
  Boolean(rowAfter) && rowAfter.is_default === 'FALSE');
check('drive_file_id master PDF TIDAK berubah',
  rowAfter.drive_file_id === masterFileId,
  `(sebelum=${masterFileId} setelah=${rowAfter.drive_file_id})`);
check('pdf_url master PDF TIDAK berubah',
  rowAfter.pdf_url === rowBefore.pdf_url,
  `(sebelum=${rowBefore.pdf_url} setelah=${rowAfter.pdf_url})`);
check('file master PDF TIDAK dibuang ke Trash',
  !driveFiles.get(masterFileId).trashed);
check('tidak ada file Drive baru/dihapus saat soft delete',
  [...driveFiles.values()].filter((f) => f.trashed).length === 0);
check('jejak audit TEMPLATE_DELETE tercatat',
  Database.findOne(TABS.AUDIT, { action: 'TEMPLATE_DELETE' }) !== null);
console.log('\n== B2) Soft delete: daftar & penjagaan template default ==');
let list = api.getLetterTemplates({ payload: {} });
check('template nonaktif disembunyikan dari daftar aktif',
  list.ok === true && list.data.items.every((t) => t.is_active === true) &&
  list.data.items.every((t) => t.id !== tplId));
list = api.getLetterTemplates({ payload: { include_inactive: true } });
check('include_inactive=true menampilkan kembali template nonaktif',
  list.data.items.some((t) => t.id === tplId && t.is_active === false));
check('master PDF tetap dapat diunduh dari template nonaktif',
  (() => {
    const t = list.data.items.find((x) => x.id === tplId);
    return Boolean(t) && /^https:\/\/drive\.google\.com\//.test(t.pdf_url) &&
      t.drive_file_id === masterFileId;
  })());

// Template default tidak boleh dihapus.
res = api.saveLetterTemplate({
  user: ctx.user,
  payload: { name: 'Template Default', is_default: true, fields: [{ type: 'judul' }] }
});
check('template default tersimpan', res.ok === true, `(${res.message})`);
const defId = res.data && res.data.id;
check('hanya satu template yang bernilai default',
  Database.readAll(TABS.TEMPLATES).filter((t) => t.is_default === 'TRUE').length === 1);
res = api.deleteLetterTemplate({ user: ctx.user, payload: { id: defId } });
check('template default TIDAK boleh dihapus',
  res.ok === false && /default/.test(res.message), `(${res.message})`);
check('template default tetap aktif setelah penolakan',
  Database.findOne(TABS.TEMPLATES, { id: defId }).is_active === 'TRUE');
res = api.deleteLetterTemplate({ user: ctx.user, payload: { id: 'id-tidak-ada' } });
check('ID tidak ditemukan ditolak',
  res.ok === false && /tidak ditemukan/.test(res.message), `(${res.message})`);
res = api.deleteLetterTemplate({ user: ctx.user, payload: {} });
check('tanpa ID ditolak', res.ok === false && /wajib diisi/.test(res.message), `(${res.message})`);
console.log('\n== C) renderTemplatePdf_ menghasilkan URL PDF ==');
// Pengurus aktif (nama dipakai di blok tanda tangan).
Database.insert(TABS.USERS, {
  id: 'u-1', username: 'ketum', full_name: 'H. Ahmad Sigid, S.Sos.',
  role: ROLES.KETUA, is_active: 'TRUE'
});
Database.insert(TABS.USERS, {
  id: 'u-2', username: 'sekretaris', full_name: 'Muhammad Ridwan, S.Kom.',
  role: ROLES.SEKRETARIS, is_active: 'TRUE'
});

// Pakai spesifikasi blok lengkap (judul/tanggal/field/ttd) agar isi render
// bisa dibuktikan; template SK Resmi di atas hanya berisi jenis/nomor/ttd.
const fullFields = JSON.stringify(api.defaultTemplateFields_());
const renderRow = { ...Database.findOne(TABS.TEMPLATES, { id: tplId }), fields: fullFields };
const surat = {
  id: 'surat-1',
  letter_number: '001/SK-DPW/APII-JABO/X/2026',
  letter_type: 'SK',
  title: 'Pengangkatan Koordinator Dakwah Wilayah',
  tanggal_surat: '2026-10-09',
  content: JSON.stringify({
    menimbang: 'a. kedudukan',
    mengingat: 'Anggaran Dasar',
    memutuskan: 'Menetapkan koordinator'
  })
};
fetchCalls.length = 0;
const pdfUrl = api.renderTemplatePdf_(surat, renderRow);

check('nilai balik berupa URL PDF (https://drive.google.com/)',
  typeof pdfUrl === 'string' && /^https:\/\/drive\.google\.com\//.test(pdfUrl),
  `(diperoleh: ${JSON.stringify(pdfUrl)})`);
check('URL PDF tidak kosong & memiliki id file',
  /\/file\/d\/file-\d+\//.test(pdfUrl), `(${pdfUrl})`);
// Master PDF unggahan pengurus juga bermime application/pdf; PDF hasil render
// dibedakan dari namanya yang selalu diawali "Surat - ".
const pdfFiles = [...driveFiles.values()].filter(
  (f) => f.mime === 'application/pdf' && f.name.startsWith('Surat - '));
check('satu file PDF baru dibuat di folder surat', pdfFiles.length === 1,
  `(ditemukan: ${JSON.stringify([...driveFiles.values()].map((f) => f.name))})`);
const pdfFile = pdfFiles[0];
check('file PDF diberi nama sesuai jenis + nomor surat',
  /^Surat - SK - 001\/SK-DPW\/APII-JABO\/X\/2026\.pdf$/.test(pdfFile.name),
  `(${pdfFile.name})`);
check('file PDF dibuat di folder PDF surat (bukan folder template)',
  driveFolders.get(pdfFile.folderId).name === KONFIG.DRIVE_FOLDER_NAME);
check('file PDF dibagikan dengan akses link (siap dipublikasikan)',
  pdfFile.shared === true);
check('dokumen antahan Google Docs dibuang ke Trash setelah dirender',
  docsCreated.length === 1 && driveFiles.get(docsCreated[0].id) &&
  driveFiles.get(docsCreated[0].id).trashed === true);
check('ekspor PDF memakai endpoint docs.google.com (tanpa jaringan)',
  fetchCalls.length === 1 && /^https:\/\/docs\.google\.com\/document\/d\/.+\/export\?format=pdf$/.test(fetchCalls[0].url),
  `(${JSON.stringify(fetchCalls.map((f) => f.url))})`);
check('permintaan ekspor membawa token OAuth Apps Script',
  fetchCalls[0].opts && /Bearer oauth-token-uji/.test(fetchCalls[0].opts.headers.Authorization));

// Isi render: mesin harus memakai spesifikasi blok template.
const body = docsCreated[0].body.paragraphs.map((p) => p.text);
const allText = body.join('\n');
check('jenis surat dirender dari LETTER_TYPE_LABELS',
  body.includes('Surat Keputusan'));
check('nomor surat dirender',
  body.some((t) => t.indexOf('Nomor : 001/SK-DPW/APII-JABO/X/2026') !== -1));
check('judul surat dirender', body.includes('Pengangkatan Koordinator Dakwah Wilayah'));
check('tanggal diformat Indonesia',
  body.some((t) => /Ditetapkan di Jakarta pada tanggal 9 Oktober 2026/.test(t)));
check('blok field mengambil nilai dari content surat',
  body.some((t) => /^Menimbang : a\. kedudukan$/.test(t)));
check('blok ttd memuat nama Ketua & Sekretaris aktif',
  allText.indexOf('H. Ahmad Sigid, S.Sos.') !== -1 &&
  allText.indexOf('Muhammad Ridwan, S.Kom.') !== -1);
check('logo lembaga ditanam di kop (header)',
  docsCreated[0].header.images.length === 1,
  `(gambar header: ${docsCreated[0].header.images.length})`);
check('URL verifikasi keaslian ditulis di footer',
  docsCreated[0].footer.paragraphs.some((p) => /Verifikasi keaslian surat/.test(p.text)) &&
  docsCreated[0].footer.paragraphs.some((p) => p.text.indexOf('001%2FSK-DPW%2FAPII-JABO%2FX%2F2026') !== -1));

console.log('\n== C2) renderTemplatePdf_ tangguh terhadap fields rusak ==');
const surat2 = { ...surat, letter_number: '002/UND-DPW/APII-JABO/X/2026', letter_type: 'UNDANGAN' };
let url2 = api.renderTemplatePdf_(surat2, { ...renderRow, fields: 'JSON-RUSAK' });
check('fields JSON rusak -> memakai blok bawaan & tetap menghasilkan URL',
  typeof url2 === 'string' && /^https:\/\/drive\.google\.com\//.test(url2), `(${JSON.stringify(url2)})`);
url2 = api.renderTemplatePdf_(surat2, { ...renderRow, fields: '[]' });
check('fields array kosong -> memakai blok bawaan & tetap menghasilkan URL',
  typeof url2 === 'string' && /^https:\/\/drive\.google\.com\//.test(url2));
const surat3 = { ...surat, content: '{bukan-json' };
const url3 = api.renderTemplatePdf_(surat3, renderRow);
check('content surat JSON rusak tidak menghentikan render',
  typeof url3 === 'string' && /^https:\/\/drive\.google\.com\//.test(url3));

console.log(`\nHasil: ${pass} lulus, ${fail} gagal.`);
if (fail > 0) process.exit(1);

