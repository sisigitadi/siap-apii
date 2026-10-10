import { readFileSync } from 'node:fs';
console.log('P3: start');
const el = () => ({ style: {}, dataset: {}, children: [], attrs: {}, classList: { add() {}, remove() {}, contains() { return false; } }, addEventListener() {}, getAttribute() { return null; }, appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; }, setAttribute() {}, textContent: '', innerHTML: '' });
const doc = { getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [], addEventListener: () => {}, body: el(), createElement: () => el() };
const g = { document: doc, console, navigator: { userAgent: 'node' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, location: { href: 'https://apii.sigitadi.id/', origin: 'https://apii.sigitadi.id' }, open: () => {}, fetch: () => Promise.reject(new Error('no net')) };
g.window = g;
globalThis.window = g;
globalThis.document = doc;
globalThis.navigator = g.navigator;
globalThis.localStorage = g.localStorage;
globalThis.location = g.location;
globalThis.open = g.open;
console.log('P3: shim ready');
try {
  new Function(readFileSync('public/app.js', 'utf8')).call(g);
  console.log('P3: app.js evaluated, Public keys:', Object.keys(g.window.Public || {}).length);
} catch (e) {
  console.log('P3: app.js threw:', e && e.message);
}
