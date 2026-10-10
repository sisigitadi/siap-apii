
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var root = path.resolve(__dirname, '..');

function readSafe(p) {
  try { return fs.readFileSync(path.join(root, p), 'utf8'); } catch (e) { return ''; }
}

var env = readSafe('.env');
var portalConfig = readSafe('portal/config.js');
var publicConfig = readSafe('public/config.js');
var gasManifest = readSafe('gas/appsscript.json');
var versiBuild = readSafe('apps-script/Versi.gs');

function firstMatch(text, re) {
  var m = text && text.match(re);
  return m ? m[1] : null;
}

var gasScriptId = firstMatch(env, /^GAS_SCRIPT_ID=(.+)$/m);
var gasDeploymentIdEnv = firstMatch(env, /^GAS_DEPLOYMENT_ID=(.+)$/m);
var apiPortalId = firstMatch(portalConfig, /https:\/\/script\.google\.com\/macros\/s\/([A-Za-z0-9_-]+)\/exec/);
var apiPublicId = firstMatch(publicConfig, /https:\/\/script\.google\.com\/macros\/s\/([A-Za-z0-9_-]+)\/exec/);

console.log('== Deployment readiness (read-only, no Google access) ==');
console.log('GAS_SCRIPT_ID in .env          : ' + (gasScriptId ? gasScriptId : 'KOSONG'));
console.log('GAS_DEPLOYMENT_ID in .env      : ' + (gasDeploymentIdEnv ? gasDeploymentIdEnv : '(tidak diisi, akan diambil dari config)'));
console.log('API deployment id portalConfig : ' + (apiPortalId || 'TIDAK DITEMUKAN'));
console.log('API deployment id publicConfig : ' + (apiPublicId || 'TIDAK DITEMUKAN'));
console.log('Portal & public pakai API sama : ' + (apiPortalId && apiPortalId === apiPublicId ? 'YA' : 'TIDAK / BELUM SELARAS'));
console.log('Manifest gas/appsscript.json   : ' + (gasManifest.trim() ? 'ADA' : 'TIDAK ADA'));
console.log('Build Versi.gs ada di apps-script/: ' + (versiBuild.trim() ? 'ADA' : 'TIDAK ADA'));

var fatal = [];
if (!gasScriptId) fatal.push('GAS_SCRIPT_ID kosong di .env');
if (!apiPortalId || !apiPublicId) fatal.push('API_BASE di portal/config.js atau public/config.js tidak ditemukan');
if (apiPortalId && apiPublicId && apiPortalId !== apiPublicId) fatal.push('portal/config.js dan public/config.js tidak pakai deployment id yang sama');
if (!gasManifest.trim()) fatal.push('gas/appsscript.json tidak ditemukan');

console.log('');
if (fatal.length === 0) {
  console.log('KESIMPULAN: prasyarat konfigurasi lokal terlihat OK. Backend sudah ada deployment yang bisa diperbarui.');
  process.exit(0);
} else {
  console.log('TUNTUTAN PRASYARAT BELUM TERSEDIA:\n  - ' + fatal.join('\n  - '));
  process.exit(1);
}
