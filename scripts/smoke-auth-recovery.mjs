// ============================================================================
// smoke-auth-recovery.mjs — uji jalur pemulihan sandi superadmin.
//
// Mengapa ada: `login` sengaja menjawab pesan yang SAMA untuk "username tidak
// ditemukan" dan "password salah", jadi kredensial admin yang ditolak adalah
// jalan buntu dari sisi layar. `diagnosaKredensial` + `pemulihanSandiPengguna`
// (gas/Auth.gs) adalah jalur keluarnya. Uji ini menjalankan backend hasil build
// apps-script/*.gs di atas Spreadsheet tiruan (tanpa jaringan, tanpa Apps
// Script) dan mengunci janji-janji keamanannya:
//
//   1) SEBAB bisa dibedakan: akun tidak ada / nonaktif / sandi salah / cocok.
//   2) Penolakan terjadi SEBELUM data disentuh (sandi pendek, ulangan beda,
//      akun tidak ada) — dibuktikan dengan hash & jejak audit yang tidak berubah.
//   3) Keberhasilan: sandi lama mati, sandi baru hidup, sesi lama dicabut,
//      jejak audit PASSWORD_RESET mencatat pelakunya.
//   4) Sandi TIDAK PERNAH muncul di balikan fungsi, di audit, atau di log.
//   5) Jalur ini TIDAK bisa dipanggil lewat HTTP (tidak terdaftar di ROUTES).
//
// Pakai: node scripts/smoke-auth-recovery.mjs
import { createHash } from 'node:crypto';
import { readBackendBundle } from './backend-modules.mjs';

const code = readBackendBundle();

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' — ' + extra : ''}`); }
};

// ---------------------------------------------------------------------------
// Tiruan minimal Google Spreadsheet (in-memory), sama seperti smoke-editorial.
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

/**
 * Bangun backend di atas Spreadsheet tiruan.
 * @param {object} opts
 *   opts.scriptProperties — nilai Script Property (mis. PASSWORD_SALT)
 *   opts.editorEmail      — email yang dilaporkan Session.getActiveUser()
 *   opts.sessionGagal     — true bila getActiveUser() melempar (uji cadangan)
 */
function createBackend(opts = {}) {
  const spreadsheet = new FakeSpreadsheet();
  const props = Object.assign({}, opts.scriptProperties || {});
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
    createTextOutput: (t) => {
      const out = { text: t, setMimeType: () => { keluaran.push(t); return out; } };
      keluaran.push(t);
      return out;
    },
    MimeType: { JSON: 'json' }
  };
  const Utilities = {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    computeDigest: (alg, value) => Array.from(
      createHash('sha256').update(String(value), 'utf8').digest()
    ).map((b) => (b > 127 ? b - 256 : b)),
    base64Decode: () => [],
    newBlob: () => ({})
  };
  const Session = {
    getActiveUser: () => {
      if (opts.sessionGagal) throw new Error('tidak ada konteks pengguna');
      return { getEmail: () => opts.editorEmail || 'pemilik@project.example' };
    }
  };

  const api = new Function(
    'SpreadsheetApp', 'PropertiesService', 'Logger', 'LockService', 'ContentService',
    'Utilities', 'Session',
    code + `
    return { initSchema, TABS, SCHEMA, readAll, findOne, insert, updateRow, deleteRow,
             hashPassword, login, doPost, doGet,
             diagnosaKredensial, laporanKredensialTeks_, pemulihanSandiEditor,
             pemulihanSandiPengguna, pemulihanGagal_, cabutSesiPengguna_,
             SANDI_MIN_PANJANG, ROUTES };
  `
  )(SpreadsheetApp, PropertiesService, Logger, LockService, ContentService, Utilities, Session);

  return { api, props, logLines, keluaran, spreadsheet };
}

// ---------------------------------------------------------------------------
// Data uji: 4 akun + sesi yang sudah ada sebelumnya.
// ---------------------------------------------------------------------------
const SANDI_LAMA = 'SandiLama123';
const SANDI_BARU = 'SandiBaru2026!';
const JAUH_DI_DEPAN = Date.now() + 6 * 24 * 60 * 60 * 1000;

/** Isi skema + akun/sesi awal. Mengembalikan { api, props, ... }. */
function seedBackend(opts = {}) {
  const b = createBackend(opts);
  const { api } = b;
  api.initSchema();
  const buat = (username, role, aktif, hash) => api.insert(api.TABS.USERS, {
    id: 'u-' + username, username, password_hash: hash, full_name: username.toUpperCase(),
    email: username + '@apii.example', role, division: '', is_active: aktif,
    can_manage_users: 'TRUE', is_demo: 'FALSE', permissions: '',
    created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString()
  });
  buat('superadmin', 'SUPERADMIN', 'TRUE', api.hashPassword(SANDI_LAMA));
  buat('ketua', 'KETUA', 'TRUE', api.hashPassword(SANDI_LAMA));
  buat('sekretaris', 'SEKRETARIS', 'FALSE', api.hashPassword(SANDI_LAMA));
  buat('pembina', 'PEMBINA', 'FALSE', api.hashPassword(SANDI_LAMA));

  const sesi = (username, role) => api.insert(api.TABS.SESSIONS, {
    token: 'tok-' + username + '-' + Math.random().toString(16).slice(2),
    user_id: 'u-' + username, username, role, division: '',
    created_at: new Date().toISOString(), expired_at: JAUH_DI_DEPAN
  });
  sesi('superadmin', 'SUPERADMIN');   // 2 sesi lama superadmin
  sesi('superadmin', 'SUPERADMIN');
  sesi('ketua', 'KETUA');             // 1 sesi milik akun lain
  return b;
}

const jumlahBaris = (api, tab) => api.readAll(tab).length;
const hashAkun = (api, username) => api.findOne(api.TABS.USERS, { username }).password_hash;
const loginOk = (api, username, password) => api.login({ payload: { username, password } });

// ===========================================================================
console.log('== Dasar: pesan login sengaja seragam (inilah jalan buntunya) ==');
{
  const { api } = seedBackend();
  const benar = loginOk(api, 'superadmin', SANDI_LAMA);
  const salahSandi = loginOk(api, 'superadmin', 'SandiKeliru99');
  const tidakAda = loginOk(api, 'superadm', SANDI_LAMA);
  check('login sandi benar → ok', benar.ok === true);
  check('login sandi salah → ditolak', salahSandi.ok === false);
  check('login username tak ada → ditolak', tidakAda.ok === false);
  check('pesan kedua kegagalan identik (tidak membocorkan daftar akun)',
    salahSandi.message === tidakAda.message && salahSandi.message === 'Username atau password salah.',
    `"${salahSandi.message}" vs "${tidakAda.message}"`);
}

console.log('\n== Diagnosa: sebab ditolak bisa dibedakan ==');
const bedah = seedBackend();
{
  const { api } = bedah;

  const cocok = api.diagnosaKredensial('superadmin', SANDI_LAMA);
  check('sandi benar → KREDENSIAL_COCOK', cocok.sebab === 'KREDENSIAL_COCOK', cocok.sebab);
  check('sandi benar → kecocokanSandi true', cocok.kecocokanSandi === true);
  check('akun ditemukan & peran dilaporkan', cocok.adaAkun === true && cocok.role === 'SUPERADMIN');

  const salah = api.diagnosaKredensial('superadmin', 'SandiKeliru99');
  check('sandi salah → SANDI_SALAH', salah.sebab === 'SANDI_SALAH', salah.sebab);
  check('sandi salah → kecocokanSandi false', salah.kecocokanSandi === false);
  check('sandi salah → menyarankan pemulihanSandiPengguna',
    /pemulihanSandiPengguna\("superadmin"/.test(salah.tindakanDisarankan), salah.tindakanDisarankan);

  const tanpaUji = api.diagnosaKredensial('superadmin');
  check('tanpa sandi uji → PERLU_SANDI_UJI (bukan menuduh salah)',
    tanpaUji.sebab === 'PERLU_SANDI_UJI' && tanpaUji.kecocokanSandi === null, tanpaUji.sebab);

  const salahKetik = api.diagnosaKredensial('superadminn');
  check('username tak ada → AKUN_TIDAK_DITEMUKAN', salahKetik.sebab === 'AKUN_TIDAK_DITEMUKAN', salahKetik.sebab);
  check('salah ketik 1 huruf → ejaan yang benar disarankan',
    salahKetik.namaMirip.indexOf('superadmin') !== -1, JSON.stringify(salahKetik.namaMirip));
  const bedaSpasi = api.diagnosaKredensial('super admin');
  check('beda spasi → ejaan yang benar disarankan',
    bedaSpasi.namaMirip.indexOf('superadmin') !== -1, JSON.stringify(bedaSpasi.namaMirip));
  const bukanKita = api.diagnosaKredensial('akun-lama-2024');
  check('nama yang memang asing → tanpa saran palsu', bukanKita.namaMirip.length === 0,
    JSON.stringify(bukanKita.namaMirip));
  const hampirSama = api.diagnosaKredensial('superadmin2');
  check('saran ejaan tidak mencampur akun lain',
    hampirSama.namaMirip.indexOf('ketua') === -1 && hampirSama.namaMirip.indexOf('pembina') === -1,
    JSON.stringify(hampirSama.namaMirip));
  check('daftar superadmin ikut dilaporkan (tanpa membocorkan sandi)',
    salahKetik.daftarSuperadmin.indexOf('superadmin') !== -1);
  check('laporan diagnosa tidak memuat kolom password_hash',
    !('password_hash' in salahKetik) && JSON.stringify(salahKetik).indexOf('password_hash') === -1);

  const nonaktif = api.diagnosaKredensial('sekretaris', SANDI_LAMA);
  check('akun nonaktif → AKUN_NONAKTIF walau sandi benar',
    nonaktif.sebab === 'AKUN_NONAKTIF' && nonaktif.kecocokanSandi === true, nonaktif.sebab);
  check('akun nonaktif → saran aktifkanKembali: true',
    /aktifkanKembali:\s*true/.test(nonaktif.tindakanDisarankan), nonaktif.tindakanDisarankan);
  check('akun nonaktif → jumlah sesi tersimpan dilaporkan',
    typeof nonaktif.jumlahSesi === 'number' && nonaktif.jumlahSesi === 0);

  check('sumber salt dilaporkan & terdeteksi belum diset',
    /KONFIG\.PASSWORD_SALT/.test(nonaktif.sumberSalt) && nonaktif.panjangSalt > 0,
    nonaktif.sumberSalt);
  check('laporan teks enak dibaca (untuk panel Executions)',
    /=== DIAGNOSA KREDENSIAL ===/.test(api.laporanKredensialTeks_(cocok)));
}

console.log('\n== Diagnosa: salt dari Script Property lebih diutamakan ==');
{
  const { api } = seedBackend({ scriptProperties: { PASSWORD_SALT: 'salt-dari-property-uji' } });
  const laporan = api.diagnosaKredensial('superadmin');
  check('sumber salt = Script Property PASSWORD_SALT',
    /Script Property PASSWORD_SALT/.test(laporan.sumberSalt), laporan.sumberSalt);
}

console.log('\n== Penolakan: tidak ada data yang disentuh ==');
{
  const { api } = bedah;
  const hashSebelum = hashAkun(api, 'superadmin');
  const auditSebelum = jumlahBaris(api, api.TABS.AUDIT);
  const sesiSebelum = jumlahBaris(api, api.TABS.SESSIONS);

  const kosong = api.pemulihanSandiPengguna('', SANDI_BARU, SANDI_BARU);
  check('username kosong ditolak', kosong.ok === false && /Username wajib diisi/.test(kosong.pesan));
  const pendek = api.pemulihanSandiPengguna('superadmin', 'cukup', 'cukup');
  check('sandi < 10 karakter ditolak (panjang minimum disebut)',
    pendek.ok === false && api.SANDI_MIN_PANJANG === 10 && /minimal 10 karakter/.test(pendek.pesan),
    pendek.pesan);
  const beda = api.pemulihanSandiPengguna('superadmin', SANDI_BARU, SANDI_BARU + 'x');
  check('ulangan sandi berbeda ditolak', beda.ok === false && /Ulangi sandi tidak sama/.test(beda.pesan));
  const hantu = api.pemulihanSandiPengguna('superadminX', SANDI_BARU, SANDI_BARU);
  check('akun tidak ada ditolak + saran diagnosaKredensial',
    hantu.ok === false && /tidak ditemukan/.test(hantu.pesan) && /diagnosaKredensial/.test(hantu.pesan));

  check('empat penolakan tidak mengubah hash sandi', hashAkun(api, 'superadmin') === hashSebelum);
  check('empat penolakan tidak menulis jejak audit', jumlahBaris(api, api.TABS.AUDIT) === auditSebelum,
    `audit ${auditSebelum} → ${jumlahBaris(api, api.TABS.AUDIT)}`);
  check('empat penolakan tidak mencabut sesi', jumlahBaris(api, api.TABS.SESSIONS) === sesiSebelum);
  check('penolakan tidak mengembalikan sandi apa pun',
    pendek.panjangSandiBaru === 0 && JSON.stringify(hantu).indexOf(SANDI_BARU) === -1);
}

console.log('\n== Pemulihan berhasil: sandi lama mati, sandi baru hidup ==');
{
  const { api, logLines } = bedah;
  const auditSebelum = jumlahBaris(api, api.TABS.AUDIT);
  const hasil = api.pemulihanSandiPengguna('superadmin', SANDI_BARU, SANDI_BARU);

  check('ok + ringkasan akun', hasil.ok === true && hasil.username === 'superadmin' && hasil.role === 'SUPERADMIN');
  check('jumlah sesi dicabut dilaporkan = 2', hasil.sesiDicabut === 2, String(hasil.sesiDicabut));
  check('akun aktif tetap aktif (bukan diaktifkan ulang)', hasil.diaktifkanKembali === false);
  check('ringkasan tidak memuat sandi baru',
    JSON.stringify(hasil).indexOf(SANDI_BARU) === -1 && hasil.panjangSandiBaru === SANDI_BARU.length);
  check('hash tersimpan berubah', hashAkun(api, 'superadmin') === api.hashPassword(SANDI_BARU));

  const sesiSuperadmin = api.readAll(api.TABS.SESSIONS).filter((s) => s.username === 'superadmin');
  const sesiKetua = api.readAll(api.TABS.SESSIONS).filter((s) => s.username === 'ketua');
  check('sesi lama superadmin dicabut semua (token bocor ikut mati)', sesiSuperadmin.length === 0);
  check('sesi akun lain TIDAK tersentuh', sesiKetua.length === 1);

  const lama = loginOk(api, 'superadmin', SANDI_LAMA);
  const baru = loginOk(api, 'superadmin', SANDI_BARU);
  check('login dengan sandi LAMA ditolak', lama.ok === false);
  check('login dengan sandi BARU berhasil', baru.ok === true && baru.data.token !== undefined);
  check('sesi baru superadmin tercipta (1)', api.readAll(api.TABS.SESSIONS)
    .filter((s) => s.username === 'superadmin').length === 1);

  const log = api.readAll(api.TABS.AUDIT);
  const jejak = log.filter((l) => l.action === 'PASSWORD_RESET');
  check('jejak audit PASSWORD_RESET tertulis', jumlahBaris(api, api.TABS.AUDIT) > auditSebelum && jejak.length === 1);
  check('jejak audit mencatat PELAKU (email editor)', jejak[0].actor === 'pemilik@project.example', jejak[0].actor);
  check('jejak audit menyebut akun & jumlah sesi dicabut',
    /superadmin/.test(jejak[0].detail) && /2 sesi dicabut/.test(jejak[0].detail), jejak[0].detail);
  check('jejak audit TIDAK memuat sandi (lama maupun baru)',
    JSON.stringify(log).indexOf(SANDI_BARU) === -1 && JSON.stringify(log).indexOf(SANDI_LAMA) === -1);
  check('log eksekusi TIDAK memuat sandi', logLines.join('\n').indexOf(SANDI_BARU) === -1);

  const diagnosaSetelah = api.diagnosaKredensial('superadmin', SANDI_BARU);
  check('diagnosa ulang dengan sandi baru → COCOK', diagnosaSetelah.sebab === 'KREDENSIAL_COCOK');
  const diagnosaLama = api.diagnosaKredensial('superadmin', SANDI_LAMA);
  check('diagnosa ulang dengan sandi lama → SANDI_SALAH (bukti hash benar-benar berganti)',
    diagnosaLama.sebab === 'SANDI_SALAH');
}

console.log('\n== Pintu masuk editor: pemulihanSandiEditor() tanpa argumen ==');
{
  const b = seedBackend();
  const { api, props } = b;

  const kosong = api.pemulihanSandiEditor();
  check('tanpa PEMULIHAN_USERNAME → ditolak beserta petunjuk Script Properties',
    kosong.ok === false && /PEMULIHAN_USERNAME/.test(kosong.pesan), kosong.pesan);

  props.PEMULIHAN_USERNAME = 'superadmin';
  const hanyaDiagnosa = api.pemulihanSandiEditor();
  check('username saja → HANYA mendiagnosa (tanpa sandi baru)',
    hanyaDiagnosa.ok === true && hanyaDiagnosa.diagnosaSaja === true && hanyaDiagnosa.sebab === 'PERLU_SANDI_UJI',
    JSON.stringify(hanyaDiagnosa));
  check('diagnosa tidak mengubah hash sandi',
    hashAkun(api, 'superadmin') === api.hashPassword(SANDI_LAMA));

  props.PEMULIHAN_SANDI_UJI = SANDI_LAMA;
  const cocok = api.pemulihanSandiEditor();
  check('sandi uji benar → sebab KREDENSIAL_COCOK dilaporkan', cocok.sebab === 'KREDENSIAL_COCOK', cocok.sebab);
  check('properti PEMULIHAN_SANDI_UJI dihapus setelah pemanggilan',
    !('PEMULIHAN_SANDI_UJI' in props), JSON.stringify(Object.keys(props)));

  props.PEMULIHAN_SANDI_UJI = 'SandiKeliru99';
  const salah = api.pemulihanSandiEditor();
  check('sandi uji salah → sebab SANDI_SALAH', salah.sebab === 'SANDI_SALAH', salah.sebab);
  check('properti sandi uji dihapus juga saat hasilnya gagal', !('PEMULIHAN_SANDI_UJI' in props));

  props.PEMULIHAN_SANDI_BARU = SANDI_BARU;
  const setelUlang = api.pemulihanSandiEditor();
  check('sandi baru di Script Properties → penyetelan ulang benar-benar jalan',
    setelUlang.ok === true && setelUlang.username === 'superadmin', JSON.stringify(setelUlang));
  check('sesi lama dicabut lewat pintu editor', setelUlang.sesiDicabut === 2, String(setelUlang.sesiDicabut));
  check('properti PEMULIHAN_SANDI_BARU TIDAK tertinggal (tidak ada sandi tersimpan)',
    !('PEMULIHAN_SANDI_BARU' in props), JSON.stringify(Object.keys(props)));
  check('login dengan sandi baru berhasil setelah pemanggilan editor',
    loginOk(api, 'superadmin', SANDI_BARU).ok === true);
  check('login dengan sandi lama sudah mati', loginOk(api, 'superadmin', SANDI_LAMA).ok === false);
  check('ringkasan editor tidak memuat sandi',
    JSON.stringify(setelUlang).indexOf(SANDI_BARU) === -1 &&
    b.logLines.join('\n').indexOf(SANDI_BARU) === -1);

  const nonaktif = seedBackend();
  nonaktif.props.PEMULIHAN_USERNAME = 'sekretaris';
  nonaktif.props.PEMULIHAN_SANDI_BARU = SANDI_BARU;
  nonaktif.props.PEMULIHAN_AKTIFKAN = 'TRUE';
  const hidup = nonaktif.api.pemulihanSandiEditor();
  check('PEMULIHAN_AKTIFKAN=TRUE → akun nonaktif diaktifkan & bisa login',
    hidup.ok === true && hidup.diaktifkanKembali === true &&
    loginOk(nonaktif.api, 'sekretaris', SANDI_BARU).ok === true, JSON.stringify(hidup));
}

console.log('\n== Akun nonaktif: hanya diaktifkan bila diminta ==');
{
  const { api } = seedBackend();
  const tanpaOpsi = api.pemulihanSandiPengguna('pembina', SANDI_BARU, SANDI_BARU);
  check('reset tanpa aktifkanKembali → akun TETAP nonaktif', tanpaOpsi.diaktifkanKembali === false &&
    api.findOne(api.TABS.USERS, { username: 'pembina' }).is_active === 'FALSE');
  check('login akun nonaktif tetap ditolak beserta alasannya',
    loginOk(api, 'pembina', SANDI_BARU).message === 'Akun Anda dinonaktifkan. Hubungi administrator.');

  const hidupLagi = api.pemulihanSandiPengguna('sekretaris', SANDI_BARU, SANDI_BARU, { aktifkanKembali: true });
  check('reset dengan aktifkanKembali: true → akun diaktifkan', hidupLagi.ok === true && hidupLagi.diaktifkanKembali === true);
  check('is_active kini TRUE', api.findOne(api.TABS.USERS, { username: 'sekretaris' }).is_active === 'TRUE');
  check('login dengan sandi baru berhasil setelah diaktifkan', loginOk(api, 'sekretaris', SANDI_BARU).ok === true);
}

console.log('\n== Opsi cabutSesi: false (sesi sengaja dibiarkan) ==');
{
  const { api } = seedBackend();
  loginOk(api, 'ketua', SANDI_LAMA);
  const sebelum = api.readAll(api.TABS.SESSIONS).filter((s) => s.username === 'ketua').length;
  const hasil = api.pemulihanSandiPengguna('ketua', SANDI_BARU, SANDI_BARU, { cabutSesi: false });
  const sesudah = api.readAll(api.TABS.SESSIONS).filter((s) => s.username === 'ketua').length;
  check('cabutSesi: false → sesi tidak dicabut', hasil.sesiDicabut === 0 && sesudah === sebelum, `${sebelum} → ${sesudah}`);
  check('jejak audit mencatat pilihan itu', /cabutSesi: false/.test(
    api.readAll(api.TABS.AUDIT).filter((l) => l.action === 'PASSWORD_RESET')[0].detail));
}

console.log('\n== Pelaku audit tetap tercatat bila email editor tak terbaca ==');
{
  const { api } = seedBackend({ sessionGagal: true });
  const hasil = api.pemulihanSandiPengguna('superadmin', SANDI_BARU, SANDI_BARU);
  const jejak = api.readAll(api.TABS.AUDIT).filter((l) => l.action === 'PASSWORD_RESET')[0];
  check('aktor cadangan "operator-editor" dipakai & pemulihan tetap jalan',
    hasil.ok === true && jejak && jejak.actor === 'operator-editor', jejak && jejak.actor);
}

console.log('\n== Jalur ini TIDAK bisa dipanggil lewat HTTP ==');
{
  const { api } = bedah;
  const body = 'var ROUTES = {';
  const mulai = code.indexOf(body);
  let depth = 0, akhir = -1, inStr = false, ch = '';
  for (let i = code.indexOf('{', mulai); i < code.length; i++) {
    const c = code[i];
    if (inStr) { if (c === '\\') { i++; continue; } if (c === ch) inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; ch = c; continue; }
    if (c === '/' && code[i + 1] === '/') { while (i < code.length && code[i] !== '\n') i++; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { akhir = i; break; } }
  }
  const isiRoutes = akhir === -1 ? '' : code.slice(mulai, akhir + 1);
  check('tabel ROUTES terbaca', isiRoutes.length > 100);
  for (const nama of ['pemulihanSandiEditor', 'pemulihanSandiPengguna', 'diagnosaKredensial',
    'pemulihanGagal_', 'cabutSesiPengguna_', 'aktorEditor_', 'laporanKredensialTeks_',
    'miripUsername_', 'jarakEdit_']) {
    check(`'${nama}' tidak terdaftar di ROUTES`, isiRoutes.indexOf(nama) === -1);
  }
  check('fungsi pemulihan tetap ADA di bundel (hanya tidak dirutekan)',
    /function pemulihanSandiPengguna\(/.test(code) && /function diagnosaKredensial\(/.test(code));

  const viaHttp = api.doPost({
    parameter: {},
    postData: { contents: JSON.stringify({ action: 'pemulihanSandiPengguna', payload: { username: 'superadmin', sandiBaru: SANDI_BARU } }) }
  });
  const balasan = JSON.parse(viaHttp.text || '{}');
  check('doPost dengan action pemulihanSandiPengguna → "Aksi tidak dikenali"',
    balasan.success === false && /Aksi tidak dikenali/.test(balasan.message || ''), JSON.stringify(balasan));
  const viaGet = api.doGet({ parameter: { action: 'diagnosaKredensial', username: 'superadmin' } });
  check('doGet dengan action diagnosaKredensial → ditolak juga',
    JSON.parse(viaGet.text || '{}').success === false, viaGet.text);

  const hashSetelahHttp = hashAkun(api, 'superadmin');
  check('percobaan lewat HTTP tidak mengubah apa pun', hashSetelahHttp === api.hashPassword(SANDI_BARU));
}

// ---------------------------------------------------------------------------
console.log(`\nHasil: ${pass} lulus, ${fail} gagal.`);
if (fail > 0) process.exit(1);
