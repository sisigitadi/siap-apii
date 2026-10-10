// Uji fungsional logika REDAKSI KONTEN DINAMIS backend (tanpa Google Apps Script).
// Mengekstrak fungsi editorial dari apps-script/Backend.gs lalu menjalankan
// skenario: sanitasi anti-XSS, normalisasi struktur, RBAC, simpan & muat.
//
// Cara pakai: node scripts/test-editorial.mjs
import { readFileSync } from 'node:fs';

const code = readFileSync('apps-script/Backend.gs', 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

/** Ekstrak satu definisi top-level (var/function) berdasarkan baris pembukanya. */
function extractDef(marker) {
  const i = code.indexOf(marker);
  if (i < 0) throw new Error('Marker tidak ditemukan: ' + marker);
  const lines = code.slice(i).split('\n');
  let end = -1;
  for (let k = 1; k < lines.length; k++) {
    const t = lines[k].trimEnd();
    if (t === '}' || t === '};') { end = k; break; }
  }
  if (end < 0) throw new Error('Akhir definisi tidak ditemukan untuk: ' + marker);
  return lines.slice(0, end + 1).join('\n');
}

const src = [
  extractDef('var DEFAULT_EDITORIAL_ ='),
  extractDef('function sanitizeText_('),
  extractDef('function sanitizeMultiline_('),
  extractDef('function sanitizeUrl_('),
  extractDef('function sanitizeEditorialContent_('),
  extractDef('function loadEditorial_('),
  extractDef('function canEditEditorial_('),
  extractDef('function getEditorialContent('),
  extractDef('function saveEditorialContent(')
].join('\n\n');

let stored = null; // simulasi baris Sheet_Settings 'editorial_content' (juga di-shadow di bawah)

const stubs = `
var ROLES = { SUPERADMIN:'SUPERADMIN', KETUA:'KETUA', SEKRETARIS:'SEKRETARIS', BENDAHARA:'BENDAHARA',
  PEMBINA:'PEMBINA', PENGAWAS:'PENGAWAS', KETUA_DIVISI:'KETUA_DIVISI', ANGGOTA_DIVISI:'ANGGOTA_DIVISI' };
var DIVISIONS = { DIV_HUMAS:'DIV_HUMAS', DIV_SOSMED:'DIV_SOSMED', DIV_LITBANG:'DIV_LITBANG', DIV_DAKWAH:'DIV_DAKWAH' };
var __calls = { setSettingValue: [], audit: [] };
var stored = null; // state di dalam scope factory (new Function tidak melihat scope modul)
function getSettingValue_(k, d) { return (k === 'editorial_content') ? stored : (d !== undefined ? d : null); }
function setSettingValue_(k, v, u) { __calls.setSettingValue.push({ k, v, u }); stored = v; }
function audit(u, a, c, m) { __calls.audit.push({ u, a, c, m }); }
function appError(msg) { throw new Error(msg); }
`;

const factory = new Function(stubs + '\n' + src + '\n' +
  'return { sanitizeText_, sanitizeMultiline_, sanitizeUrl_, sanitizeEditorialContent_, ' +
  'canEditEditorial_, getEditorialContent, saveEditorialContent, __calls, ' +
  'setStored: function (v) { stored = v; } };');
const F = factory();

console.log('== Sanitasi string (anti-XSS) ==');
const xss = F.sanitizeText_('<script>alert("XSS")</script>');
check('Tag <script> diblokir', xss.indexOf('<') === -1 && xss.indexOf('>') === -1, `-> ${JSON.stringify(xss)}`);
const apo = F.sanitizeText_("Assalamu'alaikum Warahmatullah");
check('Apostrof Bahasa Indonesia tetap utuh', apo === "Assalamu'alaikum Warahmatullah", `-> ${JSON.stringify(apo)}`);
const multi = F.sanitizeMultiline_('Baris 1\n\nBaris 2');
check('Multiline mempertahankan newline', multi === 'Baris 1\nBaris 2', `-> ${JSON.stringify(multi)}`);
check('sanitizeUrl_ menolak javascript:', F.sanitizeUrl_('javascript:alert(1)') === '');
check('sanitizeUrl_ menerima https:', F.sanitizeUrl_('https://apii.sigitadi.id') === 'https://apii.sigitadi.id');
check('sanitizeUrl_ menerima anchor #', F.sanitizeUrl_('#informasi') === '#informasi');

console.log('\n== Normalisasi objek redaksi ==');
const clean = F.sanitizeEditorialContent_({
  hero: { headline: '<b>Judul</b> Aman', cta_link: 'javascript:evil' },
  bulletins_events: { events: [
    { title: 'Acara A', status: 'mendatang' },
    { title: 'Acara B', status: 'SELESAI' }
  ] },
  profile: { missions: ['Misi 1', '', '  Misi 2  '] },
  unknown_field: 'dihapus'
});
check('6 domain selalu ada setelah normalisasi',
  ['hero', 'profile', 'bulletins_events', 'contact', 'social', 'faqs'].every((k) => clean[k] !== undefined));
check('HTML injection pada headline dinetralkan', clean.hero.headline.indexOf('<') === -1, `-> ${clean.hero.headline}`);
check('cta_link javascript: diganti default', clean.hero.cta_link === '#informasi', `-> ${clean.hero.cta_link}`);
check('Status event dinormalisasi (huruf besar)', clean.bulletins_events.events[0].status === 'MENDATANG');
check('Misi kosong dibuang & dirapikan', clean.profile.missions.join('|') === 'Misi 1|Misi 2');
check('Field tidak dikenal dibuang', !('unknown_field' in clean));
check('Array non-array dibertifikasi aman',
  JSON.stringify(F.sanitizeEditorialContent_({ bulletins_events: { bulletins: 'bukan array' } }).bulletins_events.bulletins) === '[]');


console.log('\n== RBAC redaksi (canEditEditorial_) ==');
check('SUPERADMIN boleh edit', F.canEditEditorial_({ role: 'SUPERADMIN' }) === true);
check('SEKRETARIS boleh edit', F.canEditEditorial_({ role: 'SEKRETARIS' }) === true);
check('BENDAHARA ditolak', F.canEditEditorial_({ role: 'BENDAHARA' }) === false);
check('KETUA_DIVISI DIV_HUMAS boleh edit', F.canEditEditorial_({ role: 'KETUA_DIVISI', division: 'DIV_HUMAS' }) === true);
check('KETUA_DIVISI DIV_SOSMED boleh edit', F.canEditEditorial_({ role: 'KETUA_DIVISI', division: 'DIV_SOSMED' }) === true);
check('KETUA_DIVISI DIV_LITBANG ditolak', F.canEditEditorial_({ role: 'KETUA_DIVISI', division: 'DIV_LITBANG' }) === false);
check('Pengguna null ditolak', F.canEditEditorial_(null) === false);

console.log('\n== Simpan & muat redaksi ==');
let threw = null;
try { F.saveEditorialContent({ user: { role: 'BENDAHARA', username: 'bend' }, payload: { editorial: {} } }); }
catch (e) { threw = e.message; }
check('saveEditorialContent menolak peran tidak berwenang', threw !== null && /Akses ditolak/.test(threw));

stored = null;
const saved = F.saveEditorialContent({
  user: { role: 'SEKRETARIS', username: 'sekretaris' },
  payload: { editorial: { hero: { headline: 'Headline Baru Resmi' }, social: { instagram: 'https://instagram.com/apii' } } }
});
check('saveEditorialContent mengembalikan ok & data bersih', saved.ok === true && saved.data.hero.headline === 'Headline Baru Resmi');
check('saveEditorialContent menyimpan field lain (social)', saved.data.social.instagram === 'https://instagram.com/apii');
check('saveEditorialContent menulis Sheet_Settings', F.__calls.setSettingValue.length === 1 && F.__calls.setSettingValue[0].k === 'editorial_content');
check('saveEditorialContent mencatat audit log', F.__calls.audit.length === 1 && F.__calls.audit[0].a === 'EDITORIAL_UPDATED');

const loaded = F.getEditorialContent({ user: { role: 'KETUA', username: 'ketua' } });
check('getEditorialContent memuat data tersimpan', loaded.data.hero.headline === 'Headline Baru Resmi');
check('getEditorialContent melaporkan can_edit untuk KETUA', loaded.can_edit === true);
check('getEditorialContent melaporkan can_edit=false untuk PEMBINA', F.getEditorialContent({ user: { role: 'PEMBINA' } }).can_edit === false);

F.setStored(null);
const fresh = F.getEditorialContent({ user: { role: 'SUPERADMIN' } });
check('Fallback default ketika editorial_content belum diset', fresh.data.faqs.length > 0 && fresh.data.hero.badge.length > 0);
check('Default berisi 6 domain lengkap',
  ['hero', 'profile', 'bulletins_events', 'contact', 'social', 'faqs'].every((k) => fresh.data[k] !== undefined));

console.log(`\nHasil: ${pass} lulus, ${fail} gagal.`);
if (fail > 0) process.exit(1);
