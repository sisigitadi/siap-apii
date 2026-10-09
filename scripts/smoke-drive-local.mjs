// Uji smoke lokal alur Google Drive (tanpa runtime Apps Script & tanpa jaringan).
// Menguji fungsi backend dari hasil build apps-script/*.gs dengan tiruan DriveApp:
//   1) siapkanFolderPdf_ memakai folder default yang SUDAH ADA (tidak menumpuk)
//   2) createDriveFolder: folder baru + 9 subfolder standar + setelan diperbarui
//   3) moveDriveFolder: penjagaan tanpa parent & parent = folder aktif, lalu pindah
//   4) resetDriveStorage: benar-benar kembali ke folder DEFAULT (bug 2026-10-09)
//
// Uji ini mengunci perilaku yang sebelumnya salah di produksi: dulu
// resetDriveStorage memanggil siapkanFolderPdf_() SEBELUM membersihkan
// drive_storage.custom_folder_id, sehingga folder custom lama tetap dipakai.
//
// Pakai: npm run build:gas && node scripts/smoke-drive-local.mjs
import { readFileSync } from 'node:fs';
import { readBackendBundle } from './backend-modules.mjs';

const code = readBackendBundle();

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

// ---------------------------------------------------------------------------
// Tiruan minimal Google Spreadsheet (in-memory) — sama seperti smoke-editorial
// ---------------------------------------------------------------------------
class FakeRange {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet; this.row = row; this.col = col;
    this.numRows = numRows; this.numCols = numCols;
  }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const line = this.sheet.data[this.row - 1 + r] || [];
      const rowOut = [];
      for (let c = 0; c < this.numCols; c++) {
        const v = line[this.col - 1 + c];
        rowOut.push(v === undefined ? '' : v);
      }
      out.push(rowOut);
    }
    return out;
  }
  setValues(matrix) {
    matrix.forEach((line, r) => {
      const idx = this.row - 1 + r;
      if (!this.sheet.data[idx]) this.sheet.data[idx] = [];
      line.forEach((v, c) => { this.sheet.data[idx][this.col - 1 + c] = v; });
    });
    return this;
  }
  setValue(v) { return this.setValues([[v]]); }
  setFontWeight() { return this; }
  setBackground() { return this; }
}
class FakeSheet {
  constructor(name) { this.name = name; this.data = []; }
  getLastRow() { return this.data.length; }
  getLastColumn() { return this.data.reduce((m, r) => Math.max(m, (r || []).length), 0); }
  getRange(row, col, numRows = 1, numCols = 1) { return new FakeRange(this, row, col, numRows, numCols); }
  appendRow(row) { this.data.push(row.slice()); }
  deleteRow(n) { this.data.splice(n - 1, 1); }
  setFrozenRows() { return this; }
}
class FakeSpreadsheet {
  constructor() { this.sheets = {}; }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { const s = new FakeSheet(n); this.sheets[n] = s; return s; }
}

// ---------------------------------------------------------------------------
// Tiruan minimal DriveApp (folder ber-id, punya induk & anak)
// ---------------------------------------------------------------------------
function iterator(list) {
  let i = 0;
  return { hasNext: () => i < list.length, next: () => list[i++] };
}

function createDrive() {
  const folders = new Map();
  let seq = 0;
  const make = (name, parentId) => {
    const f = {
      id: 'folder-' + (++seq),
      name,
      parents: parentId ? [parentId] : [],
      children: [],
      trashed: false
    };
    folders.set(f.id, f);
    if (parentId) folders.get(parentId).children.push(f.id);
    return f;
  };
  const api = {
    folders,
    make,
    countByName: (n) => [...folders.values()].filter((f) => f.name === n && !f.trashed).length,
    DriveApp: {
      getFolderById(id) {
        const f = folders.get(id);
        if (!f) throw new Error('Folder tidak ditemukan: ' + id);
        return folderApi(f);
      },
      createFolder(name) { return folderApi(make(name, null)); },
      getFoldersByName(name) {
        // Harus mengembalikan objek folder (bukan record internal): DriveApp
        // asli juga memberi getId()/getName()/isTrashed() pada hasil iterasinya.
        return iterator([...folders.values()].filter((f) => f.name === name).map(folderApi));
      }
    }
  };
  function folderApi(f) {
    return {
      getId: () => f.id,
      getName: () => f.name,
      getUrl: () => 'https://drive.example/folders/' + f.id,
      isTrashed: () => f.trashed,
      setTrashed: (v) => { f.trashed = v !== false; },
      createFolder: (n) => folderApi(make(n, f.id)),
      createFile: () => ({ setTrashed: () => {} }),
      getParents: () => iterator(f.parents.map((p) => folders.get(p)).filter(Boolean).map(folderApi)),
      moveTo: (target) => {
        const targetId = target.getId();
        f.parents.forEach((p) => {
          const parent = folders.get(p);
          parent.children = parent.children.filter((c) => c !== f.id);
        });
        f.parents = [targetId];
        folders.get(targetId).children.push(f.id);
      },
      addFolder: (child) => {
        const childId = child.getId();
        if (!f.children.includes(childId)) f.children.push(childId);
        const cf = folders.get(childId);
        if (!cf.parents.includes(f.id)) cf.parents.push(f.id);
      },
      removeFolder: (child) => {
        const childId = child.getId();
        f.children = f.children.filter((c) => c !== childId);
        const cf = folders.get(childId);
        cf.parents = cf.parents.filter((p) => p !== f.id);
      }
    };
  }
  return api;
}

const drive = createDrive();
const propsStore = {};
const spreadsheet = new FakeSpreadsheet();
const api = new Function(
  'SpreadsheetApp', 'PropertiesService', 'DriveApp', 'Logger', 'LockService', 'ContentService',
  code + `
  return { initSchema, KONFIG, setSettingValue_, getSettingValue_, siapkanFolderPdf_,
           createDriveFolder, moveDriveFolder, resetDriveStorage, findOne, TABS };
`
)(
  { openById: () => spreadsheet },
  {
    getScriptProperties: () => ({
      getProperty: (k) => (k in propsStore ? propsStore[k] : null),
      setProperty: (k, v) => { propsStore[k] = String(v); },
      deleteProperty: (k) => { delete propsStore[k]; }
    })
  },
  drive.DriveApp,
  { log: (m) => console.log('      [Logger] ' + m) },
  { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  { createTextOutput: () => ({ setMimeType: () => ({}) }), MimeType: { JSON: 'json' } }
);

const DEFAULT_NAME = api.KONFIG.DRIVE_FOLDER_NAME;
const ctx = { user: { username: 'superadmin' }, payload: {} };

console.log('== Persiapan: produksi memakai folder CUSTOM ==');
api.initSchema();
const custom = drive.make('APII Jabo - Arsip 2026', null);
const defaultFolder = drive.make(DEFAULT_NAME, null);
// Folder default lama yang sudah dibuang ke Trash harus DIABAIKAN saat dipakai ulang.
drive.make(DEFAULT_NAME, null).trashed = true;

api.setSettingValue_('google_drive_folder_id', custom.id, 'seed');
api.setSettingValue_('drive_storage', {
  custom_folder_id: custom.id, folder_name: custom.name, auto_annual_subfolders: true
}, 'seed');
propsStore.DRIVE_FOLDER_ID = custom.id;

check('siapkanFolderPdf_ mengikuti folder custom yang aktif',
  api.siapkanFolderPdf_() === custom.id);
check('reset belum menciptakan folder default tambahan',
  drive.countByName(DEFAULT_NAME) === 1, `(ditemukan: ${drive.countByName(DEFAULT_NAME)})`);

console.log('\n== createDriveFolder ==');
let res = api.createDriveFolder({ user: ctx.user, payload: { folder_name: 'Folder Baru' } });
const created = res.data && res.data.folder_id;
check('folder baru dibuat & dilaporkan', res.ok === true && Boolean(created), `(${res.message})`);
check('folder baru berada di root (tanpa induk)', created && drive.folders.get(created).parents.length === 0);
// Daftar subfolder standar harus persis sama dengan yang ada di createDriveFolder
// (gas/Utils.gs) — perubahan di salah satu harus menggagalkan tes ini.
const EXPECTED_SUBFOLDERS = ['Surat_Resmi', 'Surat_Lampiran', 'Keuangan_Bukti_Nota',
  'Pendaftaran_KTP', 'Pendaftaran_Selfie', 'Surat_Publikasi', 'Keuangan_QRIS',
  'Konten_Hero', 'Konten_Agenda'];
const childNames = (created ? drive.folders.get(created).children : [])
  .map((id) => drive.folders.get(id).name);
check('subfolder standar dibuat persis sesuai daftar (' + EXPECTED_SUBFOLDERS.length + ')',
  childNames.length === EXPECTED_SUBFOLDERS.length &&
  EXPECTED_SUBFOLDERS.every((n) => childNames.includes(n)),
  `(ditemukan: ${JSON.stringify(childNames)})`);
check('folder aktif & setelan berpindah ke folder baru',
  propsStore.DRIVE_FOLDER_ID === created &&
  api.getSettingValue_('drive_storage', {}).custom_folder_id === created);

console.log('\n== moveDriveFolder ==');
res = api.moveDriveFolder({ user: ctx.user, payload: {} });
check('tanpa parent ditolak', res.ok === false && /wajib diisi/.test(res.message), `(${res.message})`);
res = api.moveDriveFolder({ user: ctx.user, payload: { parent_folder_id: created } });
check('parent = folder aktif ditolak', res.ok === false && /tidak boleh sama/.test(res.message), `(${res.message})`);
res = api.moveDriveFolder({ user: ctx.user, payload: { parent_folder_id: custom.id } });
check('pemindahan nyata mengubah induk', res.ok === true &&
  drive.folders.get(created).parents.length === 1 &&
  drive.folders.get(created).parents[0] === custom.id, `(${res.message})`);

console.log('\n== resetDriveStorage (regresi bug 2026-10-09) ==');
res = api.resetDriveStorage({ user: ctx.user, payload: {} });
check('reset sukses', res.ok === true, `(${res.message})`);
check('folder yang dipakai = folder DEFAULT yang sudah ada (dipakai ulang)',
  res.data && res.data.folder_id === defaultFolder.id,
  `(dilaporkan: ${res.data && res.data.folder_id})`);
check('tidak ada folder default duplikat dibuat',
  drive.countByName(DEFAULT_NAME) === 1, `(ditemukan: ${drive.countByName(DEFAULT_NAME)})`);
check('Script Property kembali menunjuk folder default', propsStore.DRIVE_FOLDER_ID === defaultFolder.id);
// Catatan: getSettingValue_ memperlakukan nilai kosong seperti "tidak ada"
// (`if (!row || !row.value)`), jadi barisnya diperiksa langsung di Sheet_Settings.
const gdfRow = api.findOne(api.TABS.SETTINGS, { key: 'google_drive_folder_id' });
check('baris google_drive_folder_id benar-benar dikosongkan (bukan menunjuk folder lama)',
  Boolean(gdfRow) && String(gdfRow.value || '') === '' && String(gdfRow.value || '') !== custom.id,
  `(tercatat: ${JSON.stringify(gdfRow && gdfRow.value)})`);
check('setelan drive_storage mencatat default secara konsisten',
  api.getSettingValue_('drive_storage', {}).custom_folder_id === '' &&
  api.getSettingValue_('drive_storage', {}).folder_name === DEFAULT_NAME,
  `(${JSON.stringify(api.getSettingValue_('drive_storage', {}))})`);
check('panggilan berikutnya tetap memakai folder default yang sama',
  api.siapkanFolderPdf_() === defaultFolder.id);

console.log(`\nHasil: ${pass} lulus, ${fail} gagal.`);
if (fail > 0) process.exit(1);
