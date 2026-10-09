// Uji smoke Redaksi Konten Dinamis (mini-CMS) SIAP APII.
// Menguji fungsi backend dari hasil build apps-script/*.gs tanpa runtime Apps Script:
//   1) Normalisasi editorial_content (default, koersi tipe, tautan berbahaya, batas item)
//   2) Integrasi seed skema -> saveSettings -> getSettings/getPublicSettings (fake Spreadsheet)
//   3) RBAC route pengaturan
// Pakai: node scripts/smoke-editorial.mjs
import { readFileSync } from 'node:fs';
import { readBackendBundle } from './backend-modules.mjs';

const code = readBackendBundle();

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

// ---------------------------------------------------------------------------
// Tiruan minimal Google Spreadsheet (in-memory) untuk menguji jalur database.
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

function createBackend() {
  const spreadsheet = new FakeSpreadsheet();
  const SpreadsheetApp = { openById: () => spreadsheet };
  const PropertiesService = { getScriptProperties: () => ({ getProperty: () => null }) };
  const Logger = { log: () => {} };
  const LockService = { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) };
  const ContentService = { createTextOutput: () => ({ setMimeType: () => ({}) }), MimeType: { JSON: 'json' } };
  const api = new Function(
    'SpreadsheetApp', 'PropertiesService', 'Logger', 'LockService', 'ContentService',
    code + `
    return { initSchema, getSettings, saveSettings, getPublicSettings, getEditorialContent_,
             normalizeEditorialContent_, getEditorialHistory, getEditorialRevision,
             restoreEditorialRevision, recordEditorialRevision_, editorialHistoryList_,
             exportEditorialContent, importEditorialContent, parseEditorialImport_,
             editorialActionOf_, editorialExportFile_, EDITORIAL_CONTENT_KEYS_,
             EDITORIAL_HISTORY_MAX, EDITORIAL_CELL_SAFE, EDITORIAL_EXPORT_FORMAT,
             TABS, ROUTES, readAll, insert, findOne };
  `
  )(SpreadsheetApp, PropertiesService, Logger, LockService, ContentService);
  return api;
}

const sandbox = new Function(
  'RecursionGuard',
  code + `
  return { normalizeEditorialContent_ };
`
)(null);
const normalize = sandbox.normalizeEditorialContent_;

// ---------------------------------------------------------------------------
console.log('== Normalisasi: nilai bawaan ==');
const def = normalize(null);
check('hero bawaan terisi', def.hero.badge === 'Penerimaan Anggota Baru 2026' && def.hero.cta_link === '#informasi');
check('toggle profil & warta bawaan aktif', def.profile.show_section === true && def.bulletins_events.show_section === true);
check('misi bawaan 3 poin', def.profile.missions.length === 3);
check('maklumat & acara bawaan terkirim', def.bulletins_events.bulletins.length === 1 && def.bulletins_events.events.length === 1);
check('FAQ bawaan 3 item & tampil', def.faqs.length === 3 && def.faqs_show === true);
check('kontak & media sosial bawaan terisi',
  !!def.contact.address && !!def.contact.email && !!def.social.youtube && !!def.social.whatsapp_channel);

console.log('\n== Normalisasi: koersi tipe & pembersihan ==');
const cleaned = normalize({
  hero: { badge: '  Spasi Dibersihkan  ', headline: 12345, cta_link: '#warta' },
  profile: { show_section: 'FALSE', missions: ['  A  ', '', null, 'B', 42] },
  bulletins_events: {
    show_section: 'true',
    bulletins: [{ title: '  Maklumat  ', category: '', date: '2026-01-05', link: 'https://ok.example/x' }, { summary: 'tanpa judul' }],
    events: [{ title: 'Acara A', status: 'selesai' }, { title: 'Acara B', status: 'aneh' }]
  },
  contact: { email: '  a@b.id ' },
  social: { facebook: '' },
  faqs: [{ q: ' Q ', a: ' A ' }, { q: 'Q2', a: '' }, 'bukan-objek'],
  faqs_show: 'off'
});
check('teks di-trim', cleaned.hero.badge === 'Spasi Dibersihkan');
check('angka dikoersi menjadi string', cleaned.hero.headline === '12345');
check("show_section 'FALSE' -> false", cleaned.profile.show_section === false);
check('misi: trim, buang kosong, angka dikoersi', JSON.stringify(cleaned.profile.missions) === JSON.stringify(['A', 'B', '42']));
check('kategori kosong -> "Maklumat Resmi"', cleaned.bulletins_events.bulletins[0].category === 'Maklumat Resmi');
check('maklumat tanpa judul dibuang', cleaned.bulletins_events.bulletins.length === 1);
check('status "selesai" -> SELESAI, status tak dikenal -> MENDATANG',
  cleaned.bulletins_events.events[0].status === 'SELESAI' && cleaned.bulletins_events.events[1].status === 'MENDATANG');
check('id maklumat dibuat otomatis', /^mak-/.test(cleaned.bulletins_events.bulletins[0].id));
check('FAQ tanpa jawaban dibuang', cleaned.faqs.length === 1);
check("faqs_show 'off' -> false", cleaned.faqs_show === false);

console.log('\n== Normalisasi: tautan berbahaya ditolak ==');
const bad = normalize({
  hero: { cta_link: 'javascript:alert(1)' },
  bulletins_events: {
    bulletins: [{ title: 'T', link: 'javascript:alert(2)' }],
    events: [{ title: 'E', link: 'data:text/html,<script>alert(1)</script>' }]
  },
  social: { facebook: 'JavaScript:alert(3)', tiktok: 'https://ok.example/tiktok' }
});
check('CTA javascript: ditolak', bad.hero.cta_link === '');
check('tautan maklumat javascript: ditolak', bad.bulletins_events.bulletins[0].link === '');
check('tautan acara data: ditolak', bad.bulletins_events.events[0].link === '');
check('sosmed JavaScript: ditolak (case-insensitive)', bad.social.facebook === '');
check('tautan https tetap diizinkan', bad.social.tiktok === 'https://ok.example/tiktok');

console.log('\n== Normalisasi: batas panjang & jumlah item ==');
const long = normalize({
  hero: { headline: 'X'.repeat(5000) },
  profile: { missions: Array.from({ length: 50 }, (_, i) => 'M' + i) },
  bulletins_events: {
    bulletins: Array.from({ length: 200 }, (_, i) => ({ title: 'B' + i })),
    events: Array.from({ length: 200 }, (_, i) => ({ title: 'E' + i }))
  },
  faqs: Array.from({ length: 200 }, (_, i) => ({ q: 'Q' + i, a: 'A' + i }))
});
check('headline dibatasi 200 karakter', long.hero.headline.length === 200);
check('misi dibatasi 20 poin', long.profile.missions.length === 20);
check('maklumat dibatasi 60 item', long.bulletins_events.bulletins.length === 60);
check('acara dibatasi 60 item', long.bulletins_events.events.length === 60);
check('FAQ dibatasi 60 item', long.faqs.length === 60);

console.log('\n== Normalisasi: daftar kosong dihormati ==');
const emptied = normalize({ bulletins_events: { bulletins: [], events: [] }, faqs: [], profile: { missions: [] } });
check('maklumat & acara kosong tetap kosong',
  emptied.bulletins_events.bulletins.length === 0 && emptied.bulletins_events.events.length === 0);
check('FAQ kosong tetap kosong', emptied.faqs.length === 0);
check('misi kosong kembali ke bawaan (seksi tidak rusak)', emptied.profile.missions.length === 3);
check('normalisasi idempoten', JSON.stringify(normalize(cleaned)) === JSON.stringify(normalize(normalize(cleaned))));

// ---------------------------------------------------------------------------
console.log('\n== Integrasi: seed skema pada spreadsheet kosong ==');
const api = createBackend();
api.initSchema();
const keys = api.readAll(api.TABS.SETTINGS).map((r) => r.key);
check('seed editorial_content dibuat otomatis', keys.indexOf('editorial_content') !== -1);
check('seed pengaturan lain tetap utuh',
  keys.indexOf('letter_numbering') !== -1 && keys.indexOf('public_config') !== -1 && keys.indexOf('registration_config') !== -1);
const seeded = api.readAll(api.TABS.SETTINGS).filter((r) => r.key === 'editorial_content')[0].value;
check('nilai tersimpan sebagai string JSON', typeof seeded === 'string' && seeded.trim().charAt(0) === '{');

console.log('\n== Integrasi: getSettings & getPublicSettings ==');
const settings = api.getSettings({ user: { role: 'KETUA' } });
check('data.editorial_content ternormalisasi', !!settings.data.editorial_content && !!settings.data.editorial_content.hero);
check('alias data.editorial tersedia', !!settings.data.editorial && settings.data.editorial.hero.badge === settings.data.editorial_content.hero.badge);
check('pengaturan lain tidak rusak', !!settings.data.registration_config && typeof settings.data.kop_mode === 'string');
const pub1 = api.getPublicSettings({ payload: {} });
check('payload publik memuat editorial', !!pub1.data.editorial && !!pub1.data.editorial.hero);
check('payload publik tetap memuat config & registration', !!pub1.data.config && !!pub1.data.registration);

console.log('\n== Integrasi: saveSettings -> dibaca kembali ==');
const saved = api.saveSettings({
  user: { username: 'ketua' },
  payload: {
    editorial_content: {
      hero: { badge: 'Badge Baru Uji', headline: 'Judul Baru', subheadline: 'Sub baru', cta_text: 'Klik', cta_link: '#faq' },
      profile: { show_section: false, ketua_name: 'Nama Uji', ketua_title: 'Jabatan Uji', greeting: 'Salam uji', vision: 'Visi uji', missions: ['Satu', 'Dua'] },
      bulletins_events: {
        show_section: true, section_title: 'Judul Warta Uji', section_subtitle: 'Sub Warta Uji',
        bulletins: [{ id: 'mak-9', title: 'Maklumat Baru', category: '', date: '2026-05-05', summary: 'Ringkas', link: 'javascript:alert(1)' }],
        events: [{ id: 'evt-9', title: 'Acara Baru', category: 'Seminar', date_str: 'Sabtu', time_str: '09.00', location: 'Aula', speaker: 'Narasumber', link: 'https://forms.gle/x', status: 'selesai' }]
      },
      contact: { address: 'Alamat Uji', email: 'uji@apii.id', whatsapp_helpdesk: '08123', service_hours: 'Jam Uji' },
      social: { youtube: 'https://youtu.be/x' },
      faqs: [{ q: 'Tanya?', a: 'Jawab.' }],
      faqs_show: false
    }
  }
});
check('saveSettings melaporkan sukses', saved.ok === true);
const after = api.getPublicSettings({ payload: {} }).data.editorial;
check('hero baru tersimpan', after.hero.badge === 'Badge Baru Uji' && after.hero.cta_link === '#faq');
check('toggle profil tersimpan', after.profile.show_section === false);
check('misi baru tersimpan', JSON.stringify(after.profile.missions) === JSON.stringify(['Satu', 'Dua']));
check('kategori kosong dinormalkan sebelum simpan', after.bulletins_events.bulletins[0].category === 'Maklumat Resmi');
check('tautan javascript: dibersihkan sebelum simpan', after.bulletins_events.bulletins[0].link === '');
check('status acara dinormalkan ke SELESAI', after.bulletins_events.events[0].status === 'SELESAI');
check('kontak & media sosial tersimpan', after.contact.email === 'uji@apii.id' && after.social.youtube === 'https://youtu.be/x');
check('FAQ & toggle tersimpan', after.faqs.length === 1 && after.faqs_show === false);

const rows = api.readAll(api.TABS.SETTINGS);
const rowEd = rows.filter((r) => r.key === 'editorial_content');
check('baris editorial_content diperbarui (bukan duplikat)', rowEd.length === 1);
check('updated_by mencatat pelaku', rowEd[0].updated_by === 'ketua');
check('nilai dapat di-parse ulang', JSON.parse(rowEd[0].value).hero.badge === 'Badge Baru Uji');
check('pengaturan lain tidak tertimpa', rows.filter((r) => r.key === 'letter_kop').length === 1);

console.log('\n== RBAC route pengaturan ==');
check('saveSettings: SUPERADMIN & KETUA (sesuai matriks RBAC)',
  api.ROUTES.saveSettings.roles.indexOf('SUPERADMIN') !== -1 && api.ROUTES.saveSettings.roles.indexOf('KETUA') !== -1);
check('saveSettings tetap wajib login', api.ROUTES.saveSettings.auth === true);
check('getPublicSettings tetap publik', api.ROUTES.getPublicSettings.auth === false);
check('getSettings tetap khusus pengurus', api.ROUTES.getSettings.auth === true);

// ---------------------------------------------------------------------------
// RIWAYAT VERSI KONTEN REDAKSI
// ---------------------------------------------------------------------------
console.log('\n== Riwayat versi: pencatatan otomatis ==');
const historyRows = () => api.readAll(api.TABS.EDITORIAL_HISTORY);
const historyCount = () => historyRows().length;
check('tabel Sheet_EditorialHistory terdaftar di TABS',
  api.TABS.EDITORIAL_HISTORY === 'Sheet_EditorialHistory');
check('versi sebelumnya tercatat otomatis saat menyimpan', historyCount() >= 1,
  `(ada ${historyCount()} versi)`);

const archivedDefault = historyRows()
  .filter((r) => { try { return JSON.parse(r.content).hero.badge === 'Penerimaan Anggota Baru 2026'; } catch (e) { return false; } })[0];
check('isi versi lama terarsip utuh (bukan hanya metadata)', !!archivedDefault);
check('ringkasan perubahan terisi', !!archivedDefault && /Perubahan: /.test(archivedDefault.label));
check('pelaku & waktu tercatat', !!archivedDefault && archivedDefault.saved_by === 'ketua' &&
  !isNaN(Date.parse(archivedDefault.saved_at)));
check('action default SAVE', !!archivedDefault && archivedDefault.action === 'SAVE');

const beforeNoop = historyCount();
api.saveSettings({ user: { username: 'ketua' }, payload: { editorial_content: api.getEditorialContent_() } });
check('menyimpan tanpa perubahan tidak menambah versi', historyCount() === beforeNoop);

console.log('\n== Riwayat versi: daftar & pratinjau ==');
const list = api.getEditorialHistory({ user: { role: 'KETUA' } });
check('getEditorialHistory mengembalikan daftar versi', list.ok === true && list.data.items.length >= 1);
check('daftar versi TIDAK memuat isi konten (payload ringan)',
  list.data.items.every((it) => it.content === undefined && typeof it.chars === 'number'));
check('daftar versi terurut terbaru lebih dahulu',
  list.data.items.length < 2 || String(list.data.items[0].saved_at) >= String(list.data.items[1].saved_at));
check('daftar versi dibatasi jumlah maksimum', list.data.items.length <= api.EDITORIAL_HISTORY_MAX);

const preview = api.getEditorialRevision({ payload: { id: archivedDefault.id } });
check('pratinjau satu versi memuat konten lengkap', preview.ok === true &&
  preview.data.content.hero.badge === 'Penerimaan Anggota Baru 2026');
check('pratinjau versi tak dikenal ditolak',
  api.getEditorialRevision({ payload: { id: 'rev-tidak-ada' } }).ok === false);
let errNull = false;
try { api.getEditorialRevision({ payload: {} }); } catch (e) { errNull = true; }
check('pratinjau tanpa id aman (tidak melempar error)', !errNull);

console.log('\n== Riwayat versi: pemulihan ==');
const restored = api.restoreEditorialRevision({ user: { username: 'ketua' }, payload: { id: archivedDefault.id } });
check('pemulihan melaporkan sukses', restored.ok === true && restored.data.restored === true);
check('konten aktif kembali ke versi lama',
  api.getPublicSettings({ payload: {} }).data.editorial.hero.badge === 'Penerimaan Anggota Baru 2026');
check('daftar riwayat disertakan setelah pemulihan', Array.isArray(restored.data.history) && restored.data.history.length >= 2);
check('konten sebelum pemulihan diarsipkan (pemulihan dapat dibatalkan)',
  historyRows().some((r) => /^Sebelum memulihkan versi/.test(r.label)));
check('aksi pemulihan ditandai RESTORE',
  historyRows().some((r) => r.action === 'RESTORE' && /^Dipulihkan dari versi/.test(r.label)));

// Pulihkan kembali ke kondisi sebelum pemulihan -> bukti pemulihan dua arah.
const undoRev = historyRows().filter((r) => /^Sebelum memulihkan versi/.test(r.label))[0];
const undone = api.restoreEditorialRevision({ user: { username: 'ketua' }, payload: { id: undoRev.id } });
check('pemulihan dapat dibatalkan (kembali ke versi terbaru)', undone.ok === true &&
  api.getPublicSettings({ payload: {} }).data.editorial.hero.badge === 'Badge Baru Uji');
check('pemulihan konten yang sama tidak mengubah apa pun',
  api.restoreEditorialRevision({ user: { username: 'ketua' }, payload: { id: undoRev.id } }).data.restored === false);
check('pemulihan versi tak dikenal ditolak',
  api.restoreEditorialRevision({ user: { username: 'ketua' }, payload: { id: 'rev-tidak-ada' } }).ok === false);

console.log('\n== Riwayat versi: batas jumlah versi ==');
for (let i = 0; i < 20; i++) {
  const c = api.getEditorialContent_();
  c.hero.headline = 'Versi uji ' + i;
  api.saveSettings({ user: { username: 'superadmin' }, payload: { editorial_content: c } });
}
check(`riwayat dibatasi ${api.EDITORIAL_HISTORY_MAX} versi terbaru`,
  historyCount() === api.EDITORIAL_HISTORY_MAX, `(ada ${historyCount()})`);
check('versi terbaru tetap tersimpan setelah pemangkasan',
  JSON.parse(api.readAll(api.TABS.SETTINGS).filter((r) => r.key === 'editorial_content')[0].value)
    .hero.headline === 'Versi uji 19');

console.log('\n== Riwayat versi: perlindungan batas sel Google Sheets ==');
const huge = { faqs: Array.from({ length: 60 }, (_, i) => ({ q: 'Pertanyaan ' + i, a: 'J'.repeat(2000) })) };
const headlineBeforeHuge = api.getPublicSettings({ payload: {} }).data.editorial.hero.headline;
const hugeSave = api.saveSettings({ user: { username: 'ketua' }, payload: { editorial_content: huge } });
check('konten melampaui batas sel ditolak dengan pesan jelas',
  hugeSave.ok === false && /terlalu besar/.test(hugeSave.message || ''));
check('penolakan tidak menulis apa pun (all-or-nothing)',
  api.getPublicSettings({ payload: {} }).data.editorial.hero.headline === headlineBeforeHuge);
const tooLarge = api.recordEditorialRevision_(huge, 'ketua', 'SAVE', 'uji');
check('versi terlalu besar tidak diarsipkan (reason TOO_LARGE)',
  tooLarge.saved === false && tooLarge.reason === 'TOO_LARGE');
check('pemangkasan tetap menjaga batas setelah versi besar', historyCount() <= api.EDITORIAL_HISTORY_MAX);
api.saveSettings({ user: { username: 'ketua' }, payload: { editorial_content: api.normalizeEditorialContent_(null) } });

console.log('\n== Riwayat versi: isi hostil dari spreadsheet tetap disanitasi ==');
api.insert(api.TABS.EDITORIAL_HISTORY, {
  id: 'rev-hostil', saved_at: '2026-01-01T00:00:00.000Z', saved_by: 'manual', action: 'SAVE',
  label: 'baris ditulis manual di spreadsheet',
  content: JSON.stringify({ hero: { cta_link: 'javascript:alert(1)' }, faqs: [{ q: 'Q', a: 'A' }] })
});
const hostile = api.getEditorialRevision({ payload: { id: 'rev-hostil' } });
check('tautan javascript: di riwayat ikut ditolak', hostile.data.content.hero.cta_link === '');
const hostileRestore = api.restoreEditorialRevision({ user: { username: 'ketua' }, payload: { id: 'rev-hostil' } });
check('pemulihan versi hostil tidak menyuntikkan tautan berbahaya',
  hostileRestore.ok === true && api.getPublicSettings({ payload: {} }).data.editorial.hero.cta_link === '');
api.saveSettings({ user: { username: 'ketua' }, payload: { editorial_content: api.normalizeEditorialContent_(null) } });

console.log('\n== Migrasi otomatis: tabel riwayat tanpa setup()/initSchema ==');
const fresh = createBackend();
const emptyHist = fresh.getEditorialHistory({ user: { role: 'KETUA' } });
check('spreadsheet lama tanpa tabel riwayat tetap aman dibaca',
  emptyHist.ok === true && emptyHist.data.items.length === 0);
const autoSnap = fresh.recordEditorialRevision_({ faqs: [{ q: 'Q', a: 'A' }] }, 'ketua', 'SAVE', 'uji auto');
check('tabel riwayat dibuat otomatis saat penyimpanan pertama', autoSnap.saved === true);
check('baris riwayat langsung terbaca setelah dibuat otomatis',
  fresh.readAll(fresh.TABS.EDITORIAL_HISTORY).length === 1);
check('header tabel riwayat benar',
  JSON.stringify(fresh.readAll(fresh.TABS.EDITORIAL_HISTORY)[0] &&
    Object.keys(fresh.readAll(fresh.TABS.EDITORIAL_HISTORY)[0]).filter((k) => k !== '_row').sort()) ===
  JSON.stringify(['action', 'content', 'id', 'label', 'saved_at', 'saved_by']));

console.log('\n== RBAC route riwayat versi & berkas cadangan ==');
const editorialRoutes = Object.keys(api.ROUTES).filter((k) => /editorial/i.test(k)).sort();
check('lima route editorial terdaftar (riwayat + ekspor/impor)',
  JSON.stringify(editorialRoutes) ===
  JSON.stringify(['exportEditorialContent', 'getEditorialHistory', 'getEditorialRevision',
    'importEditorialContent', 'restoreEditorialRevision']),
  `(terdaftar: ${editorialRoutes.join(', ')})`);
const editorialRolesOk = editorialRoutes.every((k) => api.ROUTES[k].auth === true &&
  api.ROUTES[k].roles.indexOf('SUPERADMIN') !== -1 && api.ROUTES[k].roles.indexOf('KETUA') !== -1);
check('seluruh route editorial wajib login & hanya SUPERADMIN/KETUA', editorialRolesOk);
check('riwayat versi TIDAK bocor ke publik (getPublicSettings)',
  api.getPublicSettings({ payload: {} }).data.editorial_history === undefined &&
  api.getPublicSettings({ payload: {} }).data.history === undefined);
check('getSettings tidak memuat baris riwayat versi',
  Object.keys(api.getSettings({ user: { role: 'KETUA' } }).data)
    .every((k) => !/^rev-/.test(k) && !/editorial_rev/.test(k)));

// ---------------------------------------------------------------------------
// EKSPOR & IMPOR KONTEN REDAKSI (berkas JSON)
// ---------------------------------------------------------------------------
console.log('\n== Ekspor: berkas cadangan konten ==');
const store = createBackend();
store.initSchema();
store.saveSettings({ user: { username: 'ketua' }, payload: { editorial_content: {
  hero: { badge: 'Badge Lingkungan Uji', headline: 'Judul Uji', cta_link: '#faq' },
  faqs: [{ q: 'Q uji', a: 'A uji' }]
} } });
const exported = store.exportEditorialContent({ user: { username: 'ketua' } });
check('ekspor melaporkan sukses dan menyertakan isi berkas',
  exported.ok === true && typeof exported.data.json === 'string' && exported.data.json.length > 100);
check('nama berkas berakhiran .json & aman untuk sistem berkas',
  /^redaksi-apii-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(exported.data.filename),
  `(nama: ${exported.data.filename})`);
const file = JSON.parse(exported.data.json);
check('berkas memuat penanda format & waktu ekspor',
  file.format === 'apii-editorial-v1' && !isNaN(Date.parse(file.exported_at)));
check('berkas memuat pelaku & asal lingkungan',
  file.exported_by === 'ketua' && file.origin === 'https://apii.sigitadi.id');
check('berkas memuat konten ternormalisasi', file.content.hero.badge === 'Badge Lingkungan Uji');
check('ringkasan jumlah item disertakan di respons',
  exported.data.counts.faqs === 1 && exported.data.counts.bulletins >= 1);
check('ekspor tercatat di jejak audit',
  store.readAll(store.TABS.AUDIT).some((r) => r.action === 'EDITORIAL_EXPORTED'));
check('ekspor tidak mengubah konten aktif',
  store.getPublicSettings({ payload: {} }).data.editorial.hero.badge === 'Badge Lingkungan Uji');

console.log('\n== Impor: pemindahan konten antar lingkungan ==');
const target = createBackend();
target.initSchema();
const imported = target.importEditorialContent({ user: { username: 'superadmin' }, payload: { json: exported.data.json } });
check('impor melaporkan sukses', imported.ok === true && imported.data.imported === true);
check('konten kedua lingkungan identik',
  JSON.stringify(target.getPublicSettings({ payload: {} }).data.editorial) ===
  JSON.stringify(store.getPublicSettings({ payload: {} }).data.editorial));
check('asal berkas dilaporkan ke pengurus',
  imported.data.source.exported_by === 'ketua' && imported.data.source.format === 'apii-editorial-v1');
check('bagian yang berubah dilaporkan', Array.isArray(imported.data.changed) && imported.data.changed.length >= 1);
check('aksi impor ditandai IMPORT di riwayat',
  target.readAll(target.TABS.EDITORIAL_HISTORY).some((r) => r.action === 'IMPORT'));
check('impor juga terbaca sebagai IMPORT di daftar riwayat pengurus',
  target.getEditorialHistory({ user: { role: 'KETUA' } }).data.items.some((it) => it.action === 'IMPORT'));
check('konten sebelum impor diarsipkan (impor dapat dibatalkan)',
  target.readAll(target.TABS.EDITORIAL_HISTORY).some((r) => /^Sebelum impor berkas/.test(r.label)));
check('impor tercatat di jejak audit',
  target.readAll(target.TABS.AUDIT).some((r) => r.action === 'EDITORIAL_IMPORTED'));
check('impor berkas yang sama tidak mengubah apa pun',
  target.importEditorialContent({ user: { username: 'ketua' }, payload: { json: exported.data.json } }).data.imported === false);
check('berkas ekspor dapat dipulihkan seperti versi riwayat lain', (() => {
  const pra = target.readAll(target.TABS.EDITORIAL_HISTORY).filter((r) => /^Sebelum impor berkas/.test(r.label))[0];
  target.restoreEditorialRevision({ user: { username: 'ketua' }, payload: { id: pra.id } });
  return target.getPublicSettings({ payload: {} }).data.editorial.hero.badge !== 'Badge Lingkungan Uji';
})());

console.log('\n== Impor: bentuk berkas yang diterima ==');
const raw = JSON.parse(exported.data.json).content;
raw.hero.badge = 'Badge Impor Mentah';
const rawImport = target.importEditorialContent({ user: { username: 'ketua' }, payload: { json: JSON.stringify(raw) } });
check('objek konten mentah (tanpa pembungkus) dapat diimpor',
  rawImport.ok === true && rawImport.data.imported === true &&
  target.getPublicSettings({ payload: {} }).data.editorial.hero.badge === 'Badge Impor Mentah');
check('payload berupa objek (bukan teks) juga diterima',
  target.importEditorialContent({ user: { username: 'ketua' }, payload: { content: { hero: { badge: 'Badge Via Objek' } } } }).ok === true &&
  target.getPublicSettings({ payload: {} }).data.editorial.hero.badge === 'Badge Via Objek');
check('tanda BOM di awal berkas tetap terbaca',
  target.parseEditorialImport_('\uFEFF{"hero":{"badge":"X"}}').ok === true);
check('jenis aksi tak dikenal dibaca sebagai SAVE',
  target.editorialActionOf_('hapus') === 'SAVE' && target.editorialActionOf_('import') === 'IMPORT' &&
  target.editorialActionOf_(null) === 'SAVE');
check('penanda format diperiksa dari konstanta bersama',
  target.EDITORIAL_EXPORT_FORMAT === file.format &&
  target.EDITORIAL_CONTENT_KEYS_.indexOf('hero') !== -1);

console.log('\n== Impor: berkas tidak sah ditolak tanpa menyentuh konten ==');
const badgeSebelum = target.getPublicSettings({ payload: {} }).data.editorial.hero.badge;
const versiSebelum = target.readAll(target.TABS.EDITORIAL_HISTORY).length;
[
  ['teks bukan JSON', '{ini bukan json'],
  ['array JSON', '[1,2,3]'],
  ['objek tanpa bagian konten', '{"foo":1,"bar":2}'],
  ['berkas kosong', '   '],
  ['format asing', JSON.stringify({ format: 'format-lain-v9', content: { hero: { badge: 'X' } } })],
  ['dokumen versi tanpa konten', JSON.stringify({ format: 'apii-editorial-v1', exported_at: '2026-01-01T00:00:00.000Z' })]
].forEach(([label, isi]) => {
  const res = target.importEditorialContent({ user: { username: 'ketua' }, payload: { json: isi } });
  check(`impor ${label} ditolak dengan pesan jelas`,
    res.ok === false && typeof res.message === 'string' && res.message.length > 20);
});
check('impor tanpa payload ditolak',
  target.importEditorialContent({ user: { username: 'ketua' }, payload: {} }).ok === false);
check('penolakan tidak mengubah konten aktif',
  target.getPublicSettings({ payload: {} }).data.editorial.hero.badge === badgeSebelum);
check('penolakan tidak menambah versi riwayat',
  target.readAll(target.TABS.EDITORIAL_HISTORY).length === versiSebelum);

console.log('\n== Impor: sanitasi & batas ukuran ==');
const hostilImpor = target.importEditorialContent({ user: { username: 'ketua' }, payload: { json: JSON.stringify({
  hero: { badge: 'Badge Hostil', cta_link: 'javascript:alert(1)' },
  social: { facebook: 'data:text/html,x' },
  faqs: [{ q: 'Q', a: 'A' }]
}) } });
const setelahHostil = target.getPublicSettings({ payload: {} }).data.editorial;
check('tautan berbahaya dari berkas impor dibuang',
  hostilImpor.ok === true && setelahHostil.hero.cta_link === '' && setelahHostil.social.facebook === '');
check('bagian yang tidak ada di berkas kembali ke bawaan (konten tetap utuh)',
  setelahHostil.bulletins_events.bulletins.length >= 1 && setelahHostil.faqs.length === 1);
check('berkas melampaui batas sel ditolak dengan pesan jelas',
  target.importEditorialContent({ user: { username: 'ketua' }, payload: { json: JSON.stringify({
    faqs: Array.from({ length: 60 }, (_, i) => ({ q: 'P' + i, a: 'J'.repeat(2000) }))
  }) } }).ok === false);
check('konten tidak berubah setelah penolakan batas sel',
  target.getPublicSettings({ payload: {} }).data.editorial.hero.badge === 'Badge Hostil');
const riwayatImpor = target.readAll(target.TABS.EDITORIAL_HISTORY).length;
check(`riwayat setelah rangkaian impor tetap dibatasi ${target.EDITORIAL_HISTORY_MAX} versi`,
  riwayatImpor <= target.EDITORIAL_HISTORY_MAX, `(ada ${riwayatImpor})`);
const teksBerkas = exported.data.json;
check('berkas cadangan tidak memuat data sensitif pengurus',
  !/password|token|secret|_hash/i.test(teksBerkas));
check('berkas cadangan tidak memuat baris riwayat versi',
  !/editorial_history|Sheet_EditorialHistory/.test(teksBerkas));

// ---------------------------------------------------------------------------
// Integrasi HTTP: lewat doGet/doPost (envelope + RBAC sesi sungguhan)
// ---------------------------------------------------------------------------
function createHttpBackend() {
  const spreadsheet = new FakeSpreadsheet();
  const SpreadsheetApp = { openById: () => spreadsheet };
  const PropertiesService = { getScriptProperties: () => ({ getProperty: () => null }) };
  const Logger = { log: () => {} };
  const LockService = { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) };
  const captured = { text: '' };
  const ContentService = {
    createTextOutput: (text) => {
      captured.text = text;
      return { setMimeType: () => ({ text }) };
    },
    MimeType: { JSON: 'json' }
  };
  const api = new Function(
    'SpreadsheetApp', 'PropertiesService', 'Logger', 'LockService', 'ContentService',
    code + `
    return { initSchema, doGet, doPost, readAll, insert, findOne, getPublicSettings, TABS };
  `
  )(SpreadsheetApp, PropertiesService, Logger, LockService, ContentService);
  return { api, captured };
}

console.log('\n== Integrasi HTTP: doGet/doPost (jalur nyata portal) ==');
const http = createHttpBackend();
http.api.initSchema();
const seedSession = (token, role) => {
  const now = new Date().toISOString();
  http.api.insert(http.api.TABS.USERS, {
    id: 'u-' + token, username: token, password_hash: 'x', full_name: 'Uji ' + role,
    email: '', role: role, division: '', is_active: 'TRUE', can_manage_users: 'FALSE',
    created_at: now, updated_at: now
  });
  http.api.insert(http.api.TABS.SESSIONS, {
    token: token, user_id: 'u-' + token, username: token, role: role, division: '',
    created_at: now, expired_at: Date.now() + 3600000
  });
};
seedSession('tok-ketua', 'KETUA');
seedSession('tok-pengawas', 'PENGAWAS');

http.api.doGet({ parameter: { action: 'exportEditorialContent', token: 'tok-ketua' } });
const bodyEkspor = JSON.parse(http.captured.text);
check('doGet mengembalikan berkas cadangan lewat route resmi',
  bodyEkspor.success === true && bodyEkspor.data.filename.slice(-5) === '.json' && !!bodyEkspor.data.json);

http.api.doPost({ postData: { contents: JSON.stringify({
  action: 'importEditorialContent', token: 'tok-ketua',
  payload: { json: JSON.stringify({ hero: { badge: 'Badge Lewat HTTP' } }) }
}) }, parameter: {} });
const bodyImpor = JSON.parse(http.captured.text);
check('doPost mengimpor berkas lewat route resmi',
  bodyImpor.success === true && bodyImpor.data.imported === true &&
  http.api.getPublicSettings({ payload: {} }).data.editorial.hero.badge === 'Badge Lewat HTTP');

http.api.doGet({ parameter: { action: 'exportEditorialContent' } });
const tanpaToken = JSON.parse(http.captured.text);
check('ekspor tanpa token ditolak sebelum handler berjalan',
  tanpaToken.success === false && /Sesi berakhir/i.test(tanpaToken.message || ''));

http.api.doGet({ parameter: { action: 'exportEditorialContent', token: 'tok-pengawas' } });
const peranSalah = JSON.parse(http.captured.text);
check('ekspor oleh peran read-only ditolak RBAC',
  peranSalah.success === false && /izin/i.test(peranSalah.message || ''));

http.api.doPost({ postData: { contents: JSON.stringify({
  action: 'importEditorialContent', token: 'tok-pengawas',
  payload: { json: JSON.stringify({ hero: { badge: 'Badge Ilegal' } }) }
}) }, parameter: {} });
const imporIlegal = JSON.parse(http.captured.text);
check('impor oleh peran read-only ditolak & konten tidak berubah',
  imporIlegal.success === false &&
  http.api.getPublicSettings({ payload: {} }).data.editorial.hero.badge === 'Badge Lewat HTTP');

const sebelumTakDikenal = JSON.parse(http.captured.text);
http.api.doGet({ parameter: { action: 'exportEditorialNtah', token: 'tok-ketua' } });
check('aksi tak dikenal tetap ditolak seperti sebelumnya',
  /Aksi tidak dikenali/.test(JSON.parse(http.captured.text).message || '') &&
  sebelumTakDikenal.success === false);

console.log(`\nHasil: ${pass} lulus, ${fail} gagal.`);
if (fail > 0) process.exit(1);
