// Uji integrasi render redaksi portal publik (tanpa browser).
// Memuat public/index.html + public/app.js pada shim DOM minimal lalu
// menjalankan Public.renderEditorial(...) untuk memverifikasi: keluaran
// ter-escape (anti-XSS), urutan agenda MENDATANG dulu, perilaku akordion
// FAQ, perpindahan tab warta, dan penyembunyian seksi saat dimatikan.
//
// Cara pakai: node scripts/test-public-render.mjs
import { readFileSync, openSync, writeSync } from 'node:fs';
const _markFd = openSync('scripts/_mark.log', 'w');
function mark(s) { try { writeSync(_markFd, 'MARK: ' + s + '\n'); } catch (e) {} }
mark('start');

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

// ---------------------- Minimal DOM shim ----------------------
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr', 'path', 'circle', 'ellipse',
  'line', 'polygon', 'polyline', 'rect', 'stop', 'use', 'feGaussianBlur', 'feMergeNode']);

function parseAttrs(str) {
  const attrs = {};
  const re = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]*)))?/g;
  let m;
  while ((m = re.exec(str))) {
    attrs[m[1].toLowerCase()] = (m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : (m[4] || ''));
  }
  return attrs;
}

function parseHTML(html) {
  const tokenRe = /<!--[\s\S]*?-->|<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^>]*?)?)\s*(\/?)>|<\/([a-zA-Z][a-zA-Z0-9-]*)>/g;
  const root = new El('#root');
  const stack = [root];
  let last = 0, m;
  while ((m = tokenRe.exec(html))) {
    if (m.index > last) {
      const txt = html.slice(last, m.index);
      if (txt.trim()) stack[stack.length - 1].children.push({ text: txt, parentNode: stack[stack.length - 1], isText: true });
    }
    last = tokenRe.lastIndex;
    if (m[0].startsWith('<!--')) continue;
    if (m[4]) {
      const tag = m[4].toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; }
    } else {
      const tag = m[1].toLowerCase();
      const el = new El(tag);
      el.attrs = parseAttrs(m[2] || '');
      const parent = stack[stack.length - 1];
      el.parentNode = parent;
      parent.children.push(el);
      const selfClosed = m[3] === '/' || VOID_TAGS.has(tag);
      if (!selfClosed) {
        stack.push(el);
        if (tag === 'script' || tag === 'style') {
          const end = html.indexOf('</' + tag + '>', tokenRe.lastIndex);
          if (end !== -1) {
            const raw = html.slice(tokenRe.lastIndex, end);
            if (raw.trim()) el.children.push({ text: raw, parentNode: el, isText: true });
            tokenRe.lastIndex = end + tag.length + 3;
            last = tokenRe.lastIndex;
            stack.pop();
          }
        }
      }
    }
  }
  return root;
}

function El(tag) {
  if (!(this instanceof El)) return new El(tag);
  this.tag = tag;
  this.attrs = {};
  this.children = [];
  this._handlers = {};
  this.style = {};
  this.dataset = {};
  this.parentNode = null;
  this._clsSet = null;
}
Object.defineProperty(El.prototype, 'parentElement', {
  get: function () { return this.parentNode instanceof El ? this.parentNode : null; }
});
El.prototype._syncCls = function () { this.attrs.class = Array.from(this._clsSet).join(' '); };
El.prototype._ensureCls = function () {
  if (!this._clsSet) this._clsSet = new Set((this.attrs.class || '').split(/\s+/).filter(Boolean));
  return this._clsSet;
};
Object.defineProperty(El.prototype, 'classList', {
  get: function () {
    const self = this;
    return {
      add: function () { const s = self._ensureCls(); for (let i = 0; i < arguments.length; i++) s.add(arguments[i]); self._syncCls(); },
      remove: function () { const s = self._ensureCls(); for (let i = 0; i < arguments.length; i++) s.delete(arguments[i]); self._syncCls(); },
      contains: (c) => self._ensureCls().has(c),
      toggle: function (c, f) { const s = self._ensureCls(); if (f === undefined) f = !s.has(c); if (f) s.add(c); else s.delete(c); self._syncCls(); }
    };
  }
});
El.prototype.getAttribute = function (k) { return this.attrs[k] || null; };
El.prototype.setAttribute = function (k, v) { this.attrs[k] = String(v); };
El.prototype.appendChild = function (c) { this.children.push(c); c.parentNode = this; return c; };
El.prototype.addEventListener = function (ev, fn) { (this._handlers[ev] = this._handlers[ev] || []).push(fn); };
El.prototype.dispatchEvent = function (ev) { (this._handlers[ev.type] || []).forEach((f) => f({ type: ev.type, target: this })); };
El.prototype._text = function () {
  let out = '';
  for (const c of this.children) out += c.isText ? c.text : (c._text ? c._text() : '');
  return out;
};
Object.defineProperty(El.prototype, 'textContent', {
  get: function () { return this._text(); },
  set: function (v) { this.children = [{ text: String(v), parentNode: this, isText: true }]; }
});
Object.defineProperty(El.prototype, 'innerHTML', {
  get: function () { return this.children.map((c) => (c.isText ? c.text : outerHTML(c))).join(''); },
  set: function (v) {
    const holder = parseHTML('<div id="__frag">' + v + '</div>').children.find((c) => c instanceof El && c.tag === 'div');
    const kids = holder ? holder.children : [];
    kids.forEach((k) => { k.parentNode = this; });
    this.children = kids;
  }
});
function outerHTML(el) {
  const attrs = Object.keys(el.attrs).map((k) => ` ${k}="${el.attrs[k]}"`).join('');
  const inner = el.children.map((c) => (c.isText ? c.text : outerHTML(c))).join('');
  return `<${el.tag}${attrs}>${inner}</${el.tag}>`;
}
function matchesSel(el, sel) {
  for (const p of sel.split(/(?=[.#])/).filter(Boolean)) {
    if (p.startsWith('.')) { if (!el._ensureCls().has(p.slice(1))) return false; }
    else if (p.startsWith('#')) { if (el.attrs.id !== p.slice(1)) return false; }
    else if (el.tag !== p.toLowerCase()) return false;
  }
  return true;
}
El.prototype.querySelector = function (sel) { return this.querySelectorAll(sel)[0] || null; };
El.prototype.querySelectorAll = function (sel) {
  const out = [];
  const walk = (n) => {
    for (const c of n.children) if (c instanceof El) { if (matchesSel(c, sel)) out.push(c); walk(c); }
  };
  walk(this);
  return out;
};
El.prototype.closest = function (sel) {
  let n = this;
  while (n && n instanceof El) {
    if (matchesSel(n, sel)) return n;
    n = n.parentNode;
  }
  return null;
};

const htmlDoc = parseHTML(readFileSync('public/index.html', 'utf8'));
mark('index.html parsed');
const bodyEl = htmlDoc.querySelector('body') || htmlDoc;

const documentShim = {
  getElementById: (id) => htmlDoc.querySelectorAll('#' + String(id).replace(/[^\w-]/g, ''))[0] || null,
  querySelector: (sel) => htmlDoc.querySelector(sel),
  querySelectorAll: (sel) => htmlDoc.querySelectorAll(sel),
  addEventListener: () => {},
  createElement: (t) => new El(t),
  body: bodyEl
};

const globalShim = {
  document: documentShim, console,
  navigator: { userAgent: 'node' },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  location: { href: 'https://apii.sigitadi.id/', origin: 'https://apii.sigitadi.id' },
  __openCalls: []
};
globalShim.window = globalShim;
globalShim.open = (url) => { globalShim.__openCalls.push(url); return {}; };
globalShim.fetch = () => Promise.reject(new Error('no network in test'));

globalThis.window = globalShim;
globalThis.document = documentShim;
try { Object.defineProperty(globalThis, 'navigator', { value: globalShim.navigator, configurable: true, writable: true }); } catch (_) {}
globalThis.localStorage = globalShim.localStorage;
globalThis.location = globalShim.location;
globalThis.open = globalShim.open;

// Muat app.js (IIFE mendaftarkan window.Public; init hanya jalan di DOMContentLoaded)
mark('before app.js eval');
new Function(readFileSync('public/app.js', 'utf8')).call(globalShim);
mark('after app.js eval');
const Public = globalShim.window.Public;
if (!Public) { mark('FATAL: window.Public undefined'); process.exit(1); }
mark('Public ok, keys=' + Object.keys(Public).length);
// Bungkus renderEditorial agar setiap panggilan dicatat (untuk isolasi crash).
const _origRender = Public.renderEditorial.bind(Public);
Public.renderEditorial = function (ed) {
  mark('renderEditorial start');
  const r = _origRender(ed);
  mark('renderEditorial done');
  return r;
};



// ---------------------- Fixture data ----------------------
const sample = {
  hero: { badge: 'Badge Dinamis 2026', headline: 'Headline Redaksi', subheadline: 'Sub headline redaksi.', cta_text: 'Lihat Warta →', cta_link: '#warta' },
  profile: { show_section: true, ketua_name: 'Ust. Contoh, M.Kom.', ketua_title: 'Ketua DPW',
    greeting: 'Salam pembuka.\n\nParagraf kedua sambutan.', vision: 'Visi dinamis.',
    missions: ['Misi pertama', 'Misi kedua', 'Misi ketiga'] },
  bulletins_events: { show_section: true, section_title: 'Warta Dinamis', section_subtitle: 'Sub warta dinamis.',
    bulletins: [
      { id: 'b1', title: 'Maklumat Pertama', category: 'Maklumat Resmi', date: '2026-03-01', summary: 'Isi maklumat pertama.', link: 'https://apii.sigitadi.id/1' },
      { id: 'b2', title: 'Siaran Kedua', category: 'Siaran Pers', date: '2026-02-10', summary: 'Isi siaran kedua.', link: '' }
    ],
    events: [
      { id: 'e1', title: 'Acara Selesai Lama', category: 'Kajian', date_str: '1 Jan 2026', time_str: '08.00 WIB', location: 'Aula', speaker: 'Ustadz A', link: '', status: 'SELESAI' },
      { id: 'e2', title: 'Acara Mendatang Baru', category: 'Seminar', date_str: '10 Des 2026', time_str: '09.00 WIB', location: 'Zoom', speaker: 'Ustadz B', link: 'https://apii.sigitadi.id/daftar', status: 'MENDATANG' }
    ] },
  contact: { address: 'Jl. Contoh No. 1', email: 'redaksi@apii.sigitadi.id', whatsapp_helpdesk: '081299990001', service_hours: 'Senin–Jumat, 08.00–17.00 WIB' },
  social: { youtube: 'https://youtube.com/@apii', instagram: 'https://instagram.com/apii', whatsapp_channel: '', facebook: '', tiktok: '' },
  faqs: [
    { q: 'Pertanyaan pertama?', a: 'Jawaban pertama.' },
    { q: 'Pertanyaan kedua?', a: 'Jawaban kedua.' }
  ]
};

console.log('== Kontainer DOM tersedia di index.html ==');
const need = ['heroBadge', 'heroHeadline', 'profileContent', 'bulletinList', 'eventList', 'faqList', 'socialLinksRow', 'wartaTabEvents'];
for (const id of need) check(`Elemen #${id} ada`, !!documentShim.getElementById(id));

console.log('\n== Render hero & profil ==');
Public.renderEditorial(sample);
check('Headline hero terisi', documentShim.getElementById('heroHeadline').textContent === 'Headline Redaksi');
check('Badge hero terisi', documentShim.getElementById('heroBadgeText').textContent === 'Badge Dinamis 2026');
check('CTA hero link diubah', documentShim.getElementById('heroCtaBtn').getAttribute('href') === '#warta');
const pc = documentShim.getElementById('profileContent');
check('Sambutan profil dirender', pc.innerHTML.indexOf('Salam pembuka') !== -1 && pc.innerHTML.indexOf('Paragraf kedua') !== -1);
check('Misi (3 item) dirender', pc.innerHTML.split('Misi ').length - 1 >= 3);
check('Nama pimpinan tampil', pc.innerHTML.indexOf('Ust. Contoh, M.Kom.') !== -1);

console.log('\n== Render warta: maklumat & agenda ==');
const bl = documentShim.getElementById('bulletinList');
check('Dua kartu maklumat dirender', bl.querySelectorAll('.doc-card').length === 2);
check('Badge kategori maklumat tampil', bl.innerHTML.indexOf('Maklumat Resmi') !== -1);
check('Tanggal diformat (1 Mar 2026)', bl.innerHTML.indexOf('1 Mar 2026') !== -1);
check('Tombol "Baca selengkapnya" muncul jika ada link', bl.innerHTML.indexOf('Baca selengkapnya') !== -1);
const ev = documentShim.getElementById('eventList');
const evTitles = ev.querySelectorAll('.doc-card').map((c) => c.querySelector('h3').textContent);
check('Agenda MENDATANG didahulukan', evTitles[0] === 'Acara Mendatang Baru' && evTitles[1] === 'Acara Selesai Lama', `-> ${JSON.stringify(evTitles)}`);
check('Badge Selesai (Arsip Kegiatan) tampil', ev.innerHTML.indexOf('Selesai (Arsip Kegiatan)') !== -1);
check('Kartu selesai dibuat abu-abu', ev.innerHTML.indexOf('opacity-70') !== -1);

console.log('\n== Tab warta berpindah ==');
const paneB = documentShim.getElementById('wartaBulletinsPane');
const paneE = documentShim.getElementById('wartaEventsPane');
check('Awalnya pane maklumat tampil', !paneB.classList.contains('hidden'));
check('Awalnya pane agenda tersembunyi', paneE.classList.contains('hidden'));
documentShim.getElementById('wartaTabEvents').dispatchEvent({ type: 'click' });
check('Klik tab: pane agenda tampil', !paneE.classList.contains('hidden'));
check('Klik tab: pane maklumat tersembunyi', paneB.classList.contains('hidden'));

console.log('\n== Akordion FAQ ==');
const fl = documentShim.getElementById('faqList');
check('Dua item FAQ dirender', fl.querySelectorAll('.faq-item').length === 2);
check('Item FAQ pertama terbuka default', fl.querySelectorAll('.faq-item.open').length === 1);
const triggers = fl.querySelectorAll('.faq-trigger');
triggers[1].dispatchEvent({ type: 'click' });
check('Klik item kedua: item pertama ditutup', !triggers[0].closest('.faq-item').classList.contains('open'));
check('Klik item kedua: item kedua terbuka', triggers[1].closest('.faq-item').classList.contains('open'));

console.log('\n== Kontak & media sosial ==');
check('Alamat kontak terisi', documentShim.getElementById('contactAddressVal').textContent === 'Jl. Contoh No. 1');
check('Email kontak terisi', documentShim.getElementById('contactEmailVal').textContent === 'redaksi@apii.sigitadi.id');
check('Kartu WhatsApp tampil', !documentShim.getElementById('contactWaCard').classList.contains('hidden'));
globalShim.__openCalls.length = 0;
documentShim.getElementById('contactWaCard').dispatchEvent({ type: 'click' });
check('Klik WA membuka wa.me/62...', globalShim.__openCalls.length === 1 && /wa\.me\/6281299990001/.test(globalShim.__openCalls[0]));
const soc = documentShim.getElementById('socialLinksRow');
check('Baris sosial tampil', !soc.classList.contains('hidden'));
check('Dua tautan sosial (youtube+instagram)', soc.querySelectorAll('a').length === 2);
check('Sosial kosong disembunyikan (tiktok)', soc.innerHTML.indexOf('TikTok') === -1);

console.log('\n== Toggle sembunyikan seksi & fallback ==');
Public.renderEditorial({ profile: { show_section: false }, bulletins_events: { show_section: false }, faqs: [] });
check('Seksi profil disembunyikan', documentShim.getElementById('profileSection').parentNode.style.display === 'none');
check('Seksi warta disembunyikan', documentShim.getElementById('wartaSection').parentNode.style.display === 'none');
check('Seksi FAQ disembunyikan (FAQ kosong)', documentShim.getElementById('faqSection').parentNode.style.display === 'none');

console.log('\n== Anti-XSS pada render ==');
Public.renderEditorial({
  bulletins_events: { show_section: true, bulletins: [
    { id: 'x', title: 'Bahaya <script>alert(1)</script>', category: 'Edaran', date: '2026-01-01', summary: 'Coba <img src=x onerror=alert(2)>', link: '' }
  ], events: [] },
  faqs: [{ q: 'Q <b>tebal</b>?', a: 'A <i>italic</i>' }]
});
const blHtml = documentShim.getElementById('bulletinList').innerHTML;
check('Tag <script> di-escape (bukan tag mentah)', blHtml.indexOf('<script>') === -1 && blHtml.indexOf('&lt;script&gt;') !== -1);
check('Tag <img> & atribut di-escape (bukan tag mentah)', blHtml.indexOf('<img') === -1 && blHtml.indexOf('&lt;img') !== -1);
const faqHtml = documentShim.getElementById('faqList').innerHTML;
check('Tag <b>/<i> pada FAQ di-escape', faqHtml.indexOf('&lt;b&gt;') !== -1 && faqHtml.indexOf('<b>tebal</b>') === -1);

mark('ALL DONE, pass=' + pass + ' fail=' + fail);
console.log(`\nHasil: ${pass} lulus, ${fail} gagal.`);
if (fail > 0) process.exit(1);
