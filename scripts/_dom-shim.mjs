// Shim DOM minimal untuk menguji render portal publik tanpa browser (Node).
// Parser HTML sebagian + elemen palsu (El) + installShim() yang memasang
// document/window/globalThis palsu agar IIFE public/app.js dapat dimuat.
const VOID_TAGS = new Set(['area','base','br','col','embed','hr','img','input','link',
  'meta','param','source','track','wbr','path','circle','ellipse','line','polygon',
  'polyline','rect','stop','use','feGaussianBlur','feMergeNode']);

function parseAttrs(str) {
  const attrs = {};
  const re = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]*)))?/g;
  let m;
  while ((m = re.exec(str))) attrs[m[1].toLowerCase()] = (m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : (m[4] || ''));
  return attrs;
}

function El(tag) {
  if (!(this instanceof El)) return new El(tag);
  this.tag = tag; this.attrs = {}; this.children = []; this._handlers = {};
  this.style = {}; this.dataset = {}; this.parentNode = null; this._cls = null;
}
El.prototype._clsSet = function () {
  if (!this._cls) this._cls = new Set((this.attrs.class || '').split(/\s+/).filter(Boolean));
  return this._cls;
};
El.prototype._syncCls = function () { this.attrs.class = Array.from(this._clsSet()).join(' '); };
Object.defineProperty(El.prototype, 'classList', { get: function () {
  const s = this._clsSet(), self = this;
  return {
    add: function () { for (let i = 0; i < arguments.length; i++) s.add(arguments[i]); self._syncCls(); },
    remove: function () { for (let i = 0; i < arguments.length; i++) s.delete(arguments[i]); self._syncCls(); },
    contains: (c) => s.has(c),
    toggle: function (c, f) { if (f === undefined) f = !s.has(c); if (f) s.add(c); else s.delete(c); self._syncCls(); }
  };
}});
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
  return `<${el.tag}${attrs}>${el.children.map((c) => (c.isText ? c.text : outerHTML(c))).join('')}</${el.tag}>`;
}
function matchesSel(el, sel) {
  for (const p of sel.split(/(?=[.#])/).filter(Boolean)) {
    if (p.startsWith('.')) { if (!el._clsSet().has(p.slice(1))) return false; }
    else if (p.startsWith('#')) { if (el.attrs.id !== p.slice(1)) return false; }
    else if (el.tag !== p.toLowerCase()) return false;
  }
  return true;
}
El.prototype.querySelector = function (sel) { return this.querySelectorAll(sel)[0] || null; };
El.prototype.querySelectorAll = function (sel) {
  const out = [];
  (function walk(n) { for (const c of n.children) if (c instanceof El) { if (matchesSel(c, sel)) out.push(c); walk(c); } })(this);
  return out;
};
El.prototype.closest = function (sel) {
  let n = this;
  while (n && n instanceof El) { if (matchesSel(n, sel)) return n; n = n.parentNode; }
  return null;
};
//__PART2__
