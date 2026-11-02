// ============================================================================
// smoke-db-columns.mjs — uji regresi LETAK KOLOM Sheet_Users & ketahanan izin aksi.
//
// Mengapa ada (bug 2026-10-10): komit 39eae63 menyisipkan `is_demo` &
// `permissions` di TENGAH SCHEMA USERS, tetapi initSchema() menambahkan kolom
// baru di AKHIR sheet produksi. insert()/updateRow() lalu memetakan nama kolom
// lewat INDEKS SCHEMA, bukan header fisik, sehingga setiap tulisan ke baris
// pengguna menempatkan nilai di kolom yang salah: JSON `permissions` tertulis
// ke kolom fisik `updated_at`, stempel waktu tertulis ke kolom fisik
// `permissions`. Akibatnya menyimpan Izin Aksi di portal (centang/uncentang)
// selalu kembali seperti semula setelah halaman direfresh — gejala yang
// dilaporkan pengguna.
//
// Uji ini menjalankan backend hasil build apps-script/*.gs di atas Spreadsheet
// tiruan dan mengunci tiga janji:
//   1) Simulasi sheet produksi LAMA (header fisik 11 kolom + is_demo &
//      permissions menempel di akhir): initSchema() meluruskan urutan dan
//      memulihkan data salah letak tanpa kehilangan nilai sah.
//   2) updateRow menulis ke kolom berdasarkan header FISIK, jadi menyimpan
//      izin aksi bertahan setelah dibaca ulang (round-trip).
//   3) Sheet yang sudah lurus tidak disentuh lagi (idempoten).
//
// Pakai: node scripts/smoke-db-columns.mjs
import { readBackendBundle } from './backend-modules.mjs';

const code = readBackendBundle();

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' — ' + extra : ''}`); }
};

// ---------------------------------------------------------------------------
// Tiruan minimal Google Spreadsheet (in-memory), sama seperti smoke-auth.
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
  constructor(name, seedRows) { this.name = name; this.data = seedRows ? seedRows.map((r) => r.slice()) : []; }
  getLastRow() { return this.data.length; }
  getLastColumn() { return this.data.reduce((m, r) => Math.max(m, (r || []).length), 0); }
  getRange(row, col, numRows = 1, numCols = 1) { return new FakeRange(this, row, col, numRows, numCols); }
  appendRow(row) { this.data.push(row.slice()); }
  deleteRow(n) { this.data.splice(n - 1, 1); }
  setFrozenRows() { return this; }
  /** Salin isi sheet sebagai array of array (untuk inspeksi langsung). */
  snapshot() { return this.data.map((r) => r.slice()); }
}
class FakeSpreadsheet {
  constructor(sheets = {}) { this.sheets = sheets; }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { if (!this.sheets[n]) this.sheets[n] = new FakeSheet(n); return this.sheets[n]; }
}

/**
 * Bangun backend di atas Spreadsheet tiruan.
 * @param {object} opts
 *   opts.seedSheets   — { namaTab: array_of_array } isi sheet awal (header+data)
 *   opts.scriptProperties — nilai Script Property (mis. DB_SPREADSHEET_ID)
 *   opts.editorEmail  — email yang dilaporkan Session.getActiveUser()
 */
function createBackend(opts = {}) {
  const sheets = {};
  for (const name in (opts.seedSheets || {})) {
    sheets[name] = new FakeSheet(name, opts.seedSheets[name]);
  }
  const spreadsheet = new FakeSpreadsheet(sheets);
  const props = Object.assign({ DB_SPREADSHEET_ID: 'sheet-uji' }, opts.scriptProperties || {});
  const SpreadsheetApp = { openById: () => spreadsheet };
  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (k) => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = v; },
      deleteProperty: (k) => { delete props[k]; }
    })
  };
  const logLines = [];
  const Logger = { log: (m) => { logLines.push(String(m)); } };
  const LockService = { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) };
  const keluaran = [];
  const ContentService = {
    createTextOutput: (t) => { const o = { setMimeType: () => o }; keluaran.push(t); return o; },
    MimeType: { JSON: 'json' }
  };
  const Utilities = { DigestAlgorithm: { SHA_256: 'SHA_256' }, base64Decode: () => [], newBlob: () => ({}) };
  const Session = { getActiveUser: () => ({ getEmail: () => opts.editorEmail || 'pemilik@project.example' }) };

  const api = new Function(
    'SpreadsheetApp', 'PropertiesService', 'Logger', 'LockService', 'ContentService',
    'Utilities', 'Session',
    code + `
    return { initSchema, TABS, SCHEMA, readAll, findOne, insert, updateRow, deleteRow,
             luruskanKolomPengguna_, readSheetHeaders_, hashPassword };
  `
  )(SpreadsheetApp, PropertiesService, Logger, LockService, ContentService, Utilities, Session);

  return { api, props, logLines, keluaran, spreadsheet, sheets };
}

// ---------------------------------------------------------------------------
// Fixture: baris pengguna dalam URUTAN FISIK LAMA (produksi pra-39eae63).
//
// Inilah kondisi sheet produksi yang sebenarnya: 11 kolom asli + is_demo &
// permissions menempel di AKHIR oleh auto-migrasi initSchema versi sebelumnya.
// ---------------------------------------------------------------------------
const HEADER_LAMA = ['id', 'username', 'password_hash', 'full_name', 'email', 'role',
  'division', 'is_active', 'can_manage_users', 'created_at', 'updated_at',
  'is_demo', 'permissions'];
const DIBUAT = '2026-09-01T08:00:00.000Z';
const DIUBAH = '2026-10-09T10:00:00.000Z';
const IZIN_KETUA = JSON.stringify(['lihat_pengguna', 'kelola_surat']);

/** Satu baris pengguna fisik lama yang SUDAH teracuni oleh bug (updateRow lama). */
function barisTeracuni(override) {
  // Urutan HEADER_LAMA. Setelah superadmin menyimpan izin aksi dengan kode lama:
  //   - JSON permissions tertulis ke kolom fisik `updated_at`;
  //   - stempel updated_at tertulis ke kolom fisik `permissions`;
  //   - created_at & is_demo tetap di tempatnya (tidak ikut ditulis).
  const row = ['u-ketua', 'ketua', 'hashketua', 'Ketua DPW', 'ketua@apii.example', 'KETUA',
    '', 'TRUE', 'TRUE', DIBUAT, IZIN_KETUA, '', DIUBAH];
  return Object.assign(row, override || {});
}

/** Baris hasil INSERT kode lama: keempat kolom belakang saling bertukar. */
function barisTertukar() {
  return ['u-demo', 'demo', 'hashdemo', 'Akun Demo', 'demo@apii.example', 'DEMO',
    '', 'TRUE', 'FALSE', 'FALSE', '[]', DIBUAT, DIUBAH];
}

console.log('== Fixture: header fisik lama dikenali & diluruskan ==');
{
  const b = createBackend({ seedSheets: { Sheet_Users: [HEADER_LAMA, barisTeracuni()] } });
  const berubah = b.api.luruskanKolomPengguna_();
  check('luruskanKolomPengguna_ melaporkan sheet diubah', berubah === true);
  const fisik = b.api.readSheetHeaders_(b.sheets.Sheet_Users);
  check('header fisik sekarang = SCHEMA (13 kolom, urutan sama)',
    JSON.stringify(fisik) === JSON.stringify(b.api.SCHEMA[b.api.TABS.USERS]),
    JSON.stringify(fisik));
  const ketua = b.api.findOne(b.api.TABS.USERS, { username: 'ketua' });
  check('username & role ketua tidak hilang', ketua.username === 'ketua' && ketua.role === 'KETUA');
  check('created_at ketua dipertahankan', ketua.created_at === DIBUAT);
  check('updated_at ketua dipulihkan dari kolom fisik permissions', ketua.updated_at === DIUBAH,
    ketua.updated_at);
  check('permissions ketua dipulihkan dari kolom fisik updated_at (JSON array)',
    ketua.permissions === IZIN_KETUA, JSON.stringify(ketua.permissions));
  check('is_demo ketua bersih (bukan stempel waktu)', ketua.is_demo === '', JSON.stringify(ketua.is_demo));
}

console.log('\n== Fixture: baris hasil INSERT kode lama (4 kolom belakang tertukar) ==');
{
  const b = createBackend({ seedSheets: { Sheet_Users: [HEADER_LAMA, barisTertukar()] } });
  b.api.luruskanKolomPengguna_();
  const demo = b.api.findOne(b.api.TABS.USERS, { username: 'demo' });
  // INSERT kode lama menulis: created_at fisik <- is_demo, updated_at fisik <-
  // permissions, is_demo fisik <- created_at, permissions fisik <- updated_at.
  check('is_demo dipulihkan dari kolom fisik created_at', demo.is_demo === 'FALSE', JSON.stringify(demo.is_demo));
  check('created_at dipulihkan dari kolom fisik is_demo', demo.created_at === DIBUAT, demo.created_at);
  check('updated_at dipulihkan dari kolom fisik permissions', demo.updated_at === DIUBAH, demo.updated_at);
  check('permissions "[]" dipulihkan dari kolom fisik updated_at', demo.permissions === '[]', JSON.stringify(demo.permissions));
}

console.log('\n== Idempoten: sheet yang sudah lurus tidak disentuh ==');
{
  const b = createBackend({});
  b.api.initSchema();
  b.api.insert(b.api.TABS.USERS, {
    id: 'u-1', username: 'superadmin', password_hash: 'h', full_name: 'Superadmin',
    email: 's@e.x', role: 'SUPERADMIN', division: '', is_active: 'TRUE',
    can_manage_users: 'TRUE', is_demo: 'FALSE', permissions: '*',
    created_at: DIBUAT, updated_at: DIUBAH
  });
  const sebelum = b.sheets.Sheet_Users.snapshot();
  const berubah = b.api.luruskanKolomPengguna_();
  check('luruskanKolomPengguna_ false pada sheet yang sudah lurus', berubah === false);
  check('isi sheet tidak berubah', JSON.stringify(sebelum) === JSON.stringify(b.sheets.Sheet_Users.snapshot()));
}

console.log('\n== Round-trip: simpan izin aksi lalu baca ulang (intinya bug ini) ==');
{
  const b = createBackend({ seedSheets: { Sheet_Users: [HEADER_LAMA, barisTeracuni()] } });
  // initSchema memanggil luruskanKolomPengguna_ — simulasi deploy baru.
  b.api.initSchema();
  const ketua = b.api.findOne(b.api.TABS.USERS, { username: 'ketua' });
  check('setelah initSchema, izin ketua terbaca sebagai JSON array',
    ketua.permissions === IZIN_KETUA, JSON.stringify(ketua.permissions));

  // Superadmin MENGHAPUS satu izin (centang 'lihat_pengguna' dicentang?).
  const disimpan = ['kelola_surat'];
  b.api.updateRow(b.api.TABS.USERS, ketua._row, {
    permissions: JSON.stringify(disimpan),
    updated_at: '2026-10-10T09:00:00.000Z'
  });
  const setelah = b.api.findOne(b.api.TABS.USERS, { username: 'ketua' });
  check('izin disimpan persis seperti yang dipilih superadmin',
    setelah.permissions === JSON.stringify(disimpan), JSON.stringify(setelah.permissions));
  check('updated_at ikut diperbarui', setelah.updated_at === '2026-10-10T09:00:00.000Z', setelah.updated_at);
  check('created_at tidak tergeser oleh update', setelah.created_at === DIBUAT, setelah.created_at);
  check('username/role tidak berubah', setelah.username === 'ketua' && setelah.role === 'KETUA');

  // Baca ulang dari sheet fisik (simulasi refresh halaman portal).
  const fisik = b.sheets.Sheet_Users.snapshot();
  const headerFisik = fisik[0];
  const kolomPerm = headerFisik.indexOf('permissions');
  const barisFisik = fisik.find((r) => r[1] === 'ketua');
  check('kolom fisik permissions berisi JSON array (bukan stempel waktu)',
    barisFisik[kolomPerm] === JSON.stringify(disimpan), JSON.stringify(barisFisik[kolomPerm]));
  check('kolom fisik permissions & updated_at tidak tertukar',
    headerFisik.indexOf('permissions') === 10 && headerFisik.indexOf('updated_at') === 12,
    JSON.stringify(headerFisik));
}

console.log('\n== insert() ke sheet lama: kolom baru tidak memutus field ==');
{
  const b = createBackend({ seedSheets: { Sheet_Users: [HEADER_LAMA.slice(0, 11)] } });
  b.api.luruskanKolomPengguna_();
  const dibuat = b.api.insert(b.api.TABS.USERS, {
    id: 'u-bendahara', username: 'bendahara', password_hash: 'h', full_name: 'Bendahara',
    email: 'b@e.x', role: 'BENDAHARA', division: '', is_active: 'TRUE',
    can_manage_users: 'FALSE', is_demo: 'FALSE', permissions: JSON.stringify(['lihat_keuangan']),
    created_at: DIBUAT, updated_at: DIUBAH
  });
  check('insert mengembalikan permissions yang ditulis',
    dibuat.permissions === JSON.stringify(['lihat_keuangan']), JSON.stringify(dibuat.permissions));
  const baca = b.api.findOne(b.api.TABS.USERS, { username: 'bendahara' });
  check('readAll membaca permissions di kolom yang benar',
    baca.permissions === JSON.stringify(['lihat_keuangan']), JSON.stringify(baca.permissions));
  check('readAll membaca updated_at di kolom yang benar', baca.updated_at === DIUBAH, baca.updated_at);
}

console.log('\n== pastikanKolom_: header fisik lebih pendek dari field ==');
{
  const b = createBackend({
    seedSheets: {
      Sheet_Users: [
        HEADER_LAMA.slice(0, 9),
        ['u-superadmin', 'superadmin', 'hash', 'Superadmin', 's@e.x', 'SUPERADMIN',
          '', 'TRUE', 'TRUE']
      ]
    }
  });
  b.api.luruskanKolomPengguna_();
  const u = b.api.findOne(b.api.TABS.USERS, { username: 'superadmin' });
  check('fixture 9 kolom punya baris yang bisa diupdate', u && u.username === 'superadmin');
  // Sheet hanya 9 kolom + 4 dari SCHEMA (13); updateRow harus melebarkan,
  // bukan memotong nilai.
  const ok = b.api.updateRow(b.api.TABS.USERS, u._row, {
    permissions: JSON.stringify(['kelola_surat']), updated_at: DIUBAH
  });
  check('updateRow ke sheet pendek berhasil', ok === true);
  const baca = b.api.findOne(b.api.TABS.USERS, { username: 'superadmin' });
  check('permissions tertulis ke kolom yang dibuatkan',
    baca.permissions === JSON.stringify(['kelola_surat']), JSON.stringify(baca.permissions));
}

console.log(`\nHasil: ${pass} lulus, ${fail} gagal.`);
if (fail > 0) process.exit(1);
