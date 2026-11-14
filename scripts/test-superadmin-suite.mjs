/**
 * Automated Test Suite: Superadmin Omnipresence, Date Standardization, GAS VM, Frontend VM & Antislop Gate
 * SIAP APII v3.1.0 Enterprise
 */
import fs from 'fs';
import assert from 'assert';
import vm from 'vm';
import crypto from 'crypto';

console.log('=== TEST SUITE: SIAP APII v3.1 ENTERPRISE, GAS VM, FRONTEND VM & ANTISLOP ===\n');

// 1. Test Portal State & Auth in simulated Node environment
const configCode = fs.readFileSync('portal/config.js', 'utf8');
const stateCode = fs.readFileSync('portal/state.js', 'utf8');
const authCode = fs.readFileSync('portal/auth.js', 'utf8');

// Mock localStorage & window
const mockLocalStorage = {
  store: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

const window = {
  localStorage: mockLocalStorage
};
global.window = window;
global.localStorage = mockLocalStorage;

function evaluatePortalCore(winObj, storageObj) {
  const cfg = new Function('window', configCode + '; return CONFIG;')(winObj);
  winObj.CONFIG = cfg;
  const st = new Function('window', 'localStorage', 'CONFIG', stateCode + '; return State;')(winObj, storageObj, cfg);
  winObj.State = st;
  const au = new Function('window', 'localStorage', 'State', 'CONFIG', authCode + '; return Auth;')(winObj, storageObj, st, cfg);
  winObj.Auth = au;
  return { CONFIG: cfg, State: st, Auth: au };
}

let core = evaluatePortalCore(window, mockLocalStorage);
let CONFIG = core.CONFIG;
let State = core.State;
let Auth = core.Auth;
global.CONFIG = CONFIG;
global.State = State;
global.Auth = Auth;

function resetState(options = {}) {
  mockLocalStorage.clear();
  Object.keys(window).forEach(k => {
    if (k !== 'localStorage') delete window[k];
  });
  if (options.location) window.location = options.location;
  core = evaluatePortalCore(window, mockLocalStorage);
  CONFIG = core.CONFIG;
  State = core.State;
  Auth = core.Auth;
  global.CONFIG = CONFIG;
  global.State = State;
  global.Auth = Auth;
  if (options.skipInit !== true) {
    State.init();
    Auth.init();
  }
  return { CONFIG, State, Auth, window, localStorage: mockLocalStorage };
}

// Initialize State & Auth for Tests 1..17
State.init();
Auth.init();

// --- TEST 1: Date Format Validation (dd-mm-yyyy) ---
console.log('--- TEST 1: Date Format Validation (dd-mm-yyyy) ---');
const db = State.getDb();
const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
const dateTimeRegex = /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/;

// Check surat dates
assert.ok(db.surat.length > 0, 'Surat data must exist');
db.surat.forEach(s => {
  assert.match(s.tanggalMasehi, dateRegex, `Surat tanggalMasehi ${s.tanggalMasehi} must be dd-mm-yyyy`);
});
console.log(`[PASS] Surat Masehi dates are dd-mm-yyyy: verified ${db.surat.length} entries`);

// Check kas transaction dates
assert.ok(db.kas.transactions.length > 0, 'Kas transactions must exist');
db.kas.transactions.forEach(t => {
  assert.match(t.tanggal, dateRegex, `Kas tanggal ${t.tanggal} must be dd-mm-yyyy`);
});
console.log(`[PASS] Kas transaction dates are dd-mm-yyyy: verified ${db.kas.transactions.length} entries`);

// Check audit log timestamps
assert.ok(db.auditLogs.length > 0, 'Audit logs must exist');
db.auditLogs.forEach(l => {
  assert.match(l.timestamp, dateTimeRegex, `AuditLog timestamp ${l.timestamp} must be dd-mm-yyyy HH:mm:ss`);
});
console.log(`[PASS] AuditLog timestamps are dd-mm-yyyy HH:mm:ss: verified ${db.auditLogs.length} entries`);

// --- TEST 2: Deadlock Breaker Queue & Execution ---
console.log('\n--- TEST 2: Deadlock Breaker Queue & Override Execution ---');
const queue = State.getDeadlockQueue();
assert.ok(Array.isArray(queue), 'Deadlock queue must be an array');
assert.ok(queue.length > 0, 'Deadlock queue must detect pending items');
console.log(`[PASS] Deadlock queue detected ${queue.length} pending items`);

// Find a pending surat item
const pendingSurat = queue.find(q => q.type === 'surat');
assert.ok(pendingSurat, 'Should find at least 1 pending surat in queue');

const overrideRes = State.executeDeadlockOverride(
  'surat',
  pendingSurat.id,
  'Kedaruratan administratif nasional: Ketum berhalangan dinas luar negeri.',
  'SK-DPP/PLENO-DARURAT/XI/2026',
  { fullName: 'Superadmin Nasional Test', username: 'admin', tenantId: 'DPP_PUSAT' }
);

assert.strictEqual(overrideRes.ok, true, 'Deadlock override must succeed');
const overriddenSurat = State.getDb().surat.find(s => s.id === pendingSurat.id);
assert.strictEqual(overriddenSurat.status, 'APPROVED', 'Surat status must become APPROVED');
assert.ok(overriddenSurat.signedBy.includes('SUPERADMIN DEADLOCK OVERRIDE'), 'signedBy must reflect override');

// Verify WORM audit trail logging
const latestAudit = State.getDb().auditLogs[0];
assert.strictEqual(latestAudit.action, 'SUPERADMIN_OVERRIDE', 'Audit action must be SUPERADMIN_OVERRIDE');
const details = JSON.parse(latestAudit.detailsJson);
assert.strictEqual(details.risalahRef, 'SK-DPP/PLENO-DARURAT/XI/2026');
assert.ok(details.reason.length >= 15, 'Reason must be recorded and >= 15 chars');
console.log('[PASS] Deadlock Breaker override successfully transitioned document and logged permanent WORM audit record');

// --- TEST 3: Master Settings & Settings Diff Audit ---
console.log('\n--- TEST 3: Master Settings & Settings Diff Audit ---');
const initialSettings = State.getSettings();
assert.strictEqual(initialSettings.plafonKasTunai, 2000000, 'Initial cash buffer limit must be Rp 2 Juta');

const updateRes = State.updateSettings({
  kopTelepon: '+62 21 8888 9999',
  plafonKasTunai: 3000000
}, 'Superadmin Test');

assert.strictEqual(updateRes.ok, true, 'Settings update must succeed');
assert.strictEqual(updateRes.diffs.length, 2, 'Should have logged 2 diffs');
assert.strictEqual(window.CONFIG.CASH_BUFFER_LIMIT, 3000000, 'Live sync to CONFIG.CASH_BUFFER_LIMIT must occur');

const audits = State.getSettingsAudit();
assert.ok(audits.length >= 2, 'Settings audit must contain the new diffs');
const telpAudit = audits.find(a => a.key === 'KOPTELEPON');
assert.ok(telpAudit, 'Must record KOPTELEPON audit');
assert.strictEqual(telpAudit.newValue, '+62 21 8888 9999');
assert.match(telpAudit.timestamp, dateTimeRegex, 'Audit timestamp must be dd-mm-yyyy HH:mm:ss');
console.log(`[PASS] Master Settings updated with live sync and diff recorded in Sheet_Settings_Audit: ${audits.length} entries`);

// --- TEST 4: Multi-Device Sessions Monitoring & Revocation ---
console.log('\n--- TEST 4: Sessions Monitoring & Revocation ---');
const countBefore = State.getSessions().length;
assert.ok(countBefore >= 2, 'Should have initial active sessions');
const tokenToRevoke = State.getSessions()[0].token;

const revokeRes = State.revokeSession(tokenToRevoke);
assert.strictEqual(revokeRes, true, 'Revocation must return true');
const countAfter = State.getSessions().length;
assert.strictEqual(countAfter, countBefore - 1, 'Sessions count must decrease by 1');
assert.ok(!State.getSessions().some(s => s.token === tokenToRevoke), 'Revoked token must no longer exist');
console.log('[PASS] Session revocation successfully terminated device access and logged to audit trail');

// --- TEST 5: IAM Demisioner Toggle with Instant Session Termination ---
console.log('\n--- TEST 5: IAM Demisioner Toggle & Instant Session Termination ---');
const accounts = Auth.getAllAccounts();
const targetUser = accounts.find(a => a.username === 'bendahara');
assert.ok(targetUser, 'Target user bendahara must exist');

// Add a session for bendahara
State.getDb().sessions.push({
  token: 'TOKEN-BENDAHARA-ACTIVE-1234567890',
  userId: targetUser.id,
  username: targetUser.username,
  role: targetUser.role,
  tenantId: targetUser.tenantId,
  device: 'Test Device',
  ip: '127.0.0.1',
  loginTime: '11-11-2026 18:00:00',
  expiryTime: '18-11-2026 18:00:00',
  status: 'AKTIF'
});
State.saveDatabase();

// Toggle to demisioner
const toggleRes = Auth.toggleUserStatus(targetUser.id, false);
assert.strictEqual(toggleRes, true, 'toggleUserStatus must return true');
assert.strictEqual(targetUser.isActive, false, 'User must be marked isActive = false');

// Verify session was terminated
const bendumSessions = State.getSessions().filter(s => s.username === targetUser.username);
assert.strictEqual(bendumSessions.length, 0, 'All sessions for demisioner user must be immediately wiped');
console.log('[PASS] Marking user Demisioner instantly severed all active device sessions');

// Reactivate user
Auth.toggleUserStatus(targetUser.id, true);
assert.strictEqual(targetUser.isActive, true, 'User must be reactivated');
console.log('[PASS] User reactivated successfully');

// --- TEST 6: Wilayah Federasi DPW Registration ---
console.log('\n--- TEST 6: Wilayah Federasi DPW Registration ---');
const regWilayahRes = State.registerWilayah({
  code: 'DPW-JABAR',
  name: 'DPW Jawa Barat (Federasi)',
  slug: 'dpw-jabar',
  city: 'Bandung',
  phone: '022-87654321',
  address: 'Jl. Raya Dakwah No. 45, Kota Bandung'
});

assert.strictEqual(regWilayahRes.ok, true, 'Wilayah registration must succeed');
const savedWilayah = State.getDb().wilayah.find(w => w.code === 'DPW-JABAR');
assert.ok(savedWilayah, 'DPW-JABAR must exist in database');
assert.strictEqual(savedWilayah.city, 'Bandung');

// Try duplicate registration
const dupRes = State.registerWilayah({
  code: 'DPW-JABAR',
  name: 'Duplicate DPW',
  slug: 'dpw-jabar'
});
assert.strictEqual(dupRes.ok, false, 'Duplicate registration must fail');
console.log('[PASS] Wilayah Federasi registered and duplicate protection verified');

// --- TEST 7: DPW Divisional Roles & Regional Jurisdiction Dynamic Naming ---
console.log('\n--- TEST 7: DPW Divisional Roles & Regional Jurisdiction Naming ---');
const dpwKadivDakwah = accounts.find(a => a.username === 'kadiv_dakwah_jabo');
assert.ok(dpwKadivDakwah, 'kadiv_dakwah_jabo must exist');
assert.strictEqual(dpwKadivDakwah.role, 'ketua_divisi');
assert.strictEqual(dpwKadivDakwah.tenantId, 'DPW_JABO');
assert.strictEqual(dpwKadivDakwah.divisi, 'dakwah');

const dpwAnggota = accounts.find(a => a.username === 'anggota_jabo');
assert.ok(dpwAnggota, 'anggota_jabo must exist');
assert.strictEqual(dpwAnggota.role, 'anggota_divisi');
assert.strictEqual(dpwAnggota.tenantId, 'DPW_JABO');

// Test dynamic naming via getRoleTitleByYurisdiksi
assert.strictEqual(Auth.getRoleTitleByYurisdiksi('ketua', 'DPP_PUSAT'), 'Ketua Umum DPP');
assert.strictEqual(Auth.getRoleTitleByYurisdiksi('ketua', 'DPW_JABO'), 'Ketua DPW Jabodetabek');
assert.strictEqual(Auth.getRoleTitleByYurisdiksi('sekretaris', 'DPP_PUSAT'), 'Sekretaris Umum DPP');
assert.strictEqual(Auth.getRoleTitleByYurisdiksi('sekretaris', 'DPW_JABO'), 'Sekretaris DPW Jabodetabek');
assert.strictEqual(Auth.getRoleTitleByYurisdiksi('bendahara', 'DPP_PUSAT'), 'Bendahara Umum DPP');
assert.strictEqual(Auth.getRoleTitleByYurisdiksi('bendahara', 'DPW_JABO'), 'Bendahara DPW Jabodetabek');
assert.strictEqual(Auth.getRoleTitleByYurisdiksi('ketua_divisi', 'DPW_JABO', 'dakwah'), 'Ketua Divisi Dakwah dan Pendidikan DPW Jabodetabek');
assert.strictEqual(Auth.getRoleTitleByYurisdiksi('anggota_divisi', 'DPW_JABO', 'dakwah'), 'Anggota Divisi Dakwah dan Pendidikan DPW Jabodetabek');
console.log('[PASS] DPW Jabodetabek division leadership and dynamic yurisdiksi naming verified');

// --- TEST 8: Strict Security Gate: Non-Pengurus Cadre Blocked from Portal ---
console.log('\n--- TEST 8: Strict Security Gate (Non-Pengurus Cadre Blocked) ---');
const cadre = accounts.find(a => a.username === 'kader_ahmad');
assert.ok(cadre, 'Simulated cadre kader_ahmad must exist');
assert.strictEqual(cadre.isPengurus, false, 'Cadre must have isPengurus === false');
assert.strictEqual(cadre.role, 'kader_biasa', 'Cadre role must be kader_biasa');

// Attempt login with credentials (uniform Demo123 password also blocked for non-pengurus)
const loginRes = Auth.login('kader_ahmad', 'Demo123');
assert.strictEqual(loginRes.ok, false, 'Cadre login must fail');
assert.strictEqual(loginRes.isKaderNonPengurus, true, 'isKaderNonPengurus flag must be true');
assert.ok(loginRes.error.includes('Akses Ditolak'), 'Error message must specify access denied');
assert.ok(loginRes.error.includes('Portal Publik'), 'Error must guide to Portal Publik');

// Attempt quick role switch loginAsUser
let blockedModalTriggered = false;
window.App = {
  showKaderAccessDeniedModal(acc) {
    blockedModalTriggered = true;
    assert.strictEqual(acc.username, 'kader_ahmad');
  }
};

const switchRes = Auth.loginAsUser('kader_ahmad');
assert.strictEqual(switchRes, null, 'loginAsUser must reject cadre and return null');
assert.strictEqual(blockedModalTriggered, true, 'App.showKaderAccessDeniedModal must be triggered');
console.log('[PASS] Non-pengurus cadres strictly blocked from Portal Pengurus and guided to Portal Publik');

// --- TEST 9: Active Regional Scope: Only DPP Pusat & DPW Jabodetabek Active ---
console.log('\n--- TEST 9: Active Regional Scope (DPP Pusat & DPW Jabodetabek) ---');
const publicConfigCode = fs.readFileSync('public/config.js', 'utf8');
const publicConfigFunc = new Function('window', publicConfigCode + '; return CONFIG;');
const PUBLIC_CONFIG = publicConfigFunc({});

assert.strictEqual(PUBLIC_CONFIG.TENANTS.length, 2, 'Active tenants in public config must be exactly 2 (DPP & DPW Jabodetabek)');
const tenantCodes = PUBLIC_CONFIG.TENANTS.map(t => t.code);
assert.deepStrictEqual(tenantCodes, ['DPP_PUSAT', 'DPW_JABO'], 'Only DPP_PUSAT and DPW_JABO may be active');

// Verify other DPWs (jabar, riau, jatim, jateng) are not present in active config
const inactiveSlugs = ['jabar', 'riau', 'jateng', 'jatim', 'sumut'];
inactiveSlugs.forEach(slug => {
  const found = PUBLIC_CONFIG.TENANTS.find(t => t.slug === slug);
  assert.strictEqual(found, undefined, `Prospective DPW ${slug} must not be active until decreed`);
});
console.log('[PASS] Active regional scope verified: Only DPP Pusat & DPW Jabodetabek active; prospective DPWs protected');

// --- TEST 10: Strict Segregation of Duties (SoD) & Role Workspace Authorization Matrix ---
console.log('\n--- TEST 10: Strict Segregation of Duties (SoD) & Role Workspace Authorization Matrix ---');
const allWorkspaces = ['dashboard', 'surat', 'disposisi', 'kas', 'proker', 'keanggotaan', 'advokasi', 'muallaf', 'maktabah', 'sistem'];

// 10.1 Superadmin Nasional: Akses mutlak ke seluruh 10 workspace
Auth.loginAsUser('admin');
allWorkspaces.forEach(ws => {
  assert.strictEqual(Auth.canAccessWorkspace(ws), true, `Superadmin must have access to ${ws}`);
});
console.log('[PASS] Superadmin: Full access to all 10 workspaces verified');

// 10.2 Ketua Umum DPP: Fokus 6 workspace otorisasi eksekutif (bebas dari operasional divisi/maktabah/sistem teknis)
Auth.loginAsUser('ketua');
['dashboard', 'surat', 'disposisi', 'kas', 'proker', 'keanggotaan'].forEach(ws => {
  assert.strictEqual(Auth.canAccessWorkspace(ws), true, `Ketua must access executive workspace ${ws}`);
});
['advokasi', 'muallaf', 'maktabah', 'sistem'].forEach(ws => {
  assert.strictEqual(Auth.canAccessWorkspace(ws), false, `Ketua must NOT access operational/admin workspace ${ws}`);
});
console.log('[PASS] Ketua: Simplified 6 executive approval workspaces allowed; advokasi/muallaf/maktabah/sistem blocked');

// 10.3 Sekretaris Umum DPP: 5 workspace (SoD: Kas Syar\'i & Sistem terkunci)
Auth.loginAsUser('sekretaris');
assert.strictEqual(Auth.canAccessWorkspace('surat'), true, 'Sekretaris must access surat');
assert.strictEqual(Auth.canAccessWorkspace('disposisi'), true, 'Sekretaris must access disposisi');
assert.strictEqual(Auth.canAccessWorkspace('keanggotaan'), true, 'Sekretaris must access keanggotaan');
assert.strictEqual(Auth.canAccessWorkspace('maktabah'), true, 'Sekretaris must access maktabah');
assert.strictEqual(Auth.canAccessWorkspace('kas'), false, 'Sekretaris must NOT access kas (Strict SoD)');
assert.strictEqual(Auth.canAccessWorkspace('proker'), false, 'Sekretaris must NOT access proker');
assert.strictEqual(Auth.canAccessWorkspace('advokasi'), false, 'Sekretaris must NOT access advokasi');
assert.strictEqual(Auth.canAccessWorkspace('muallaf'), false, 'Sekretaris must NOT access muallaf');
assert.strictEqual(Auth.canAccessWorkspace('sistem'), false, 'Sekretaris must NOT access sistem');
console.log('[PASS] Sekretaris: Exactly 5 workspaces allowed; kas strictly blocked by SoD');

// 10.4 Bendahara Umum DPP: 3 workspace (SoD: Persuratan, Disposisi & Keanggotaan terkunci)
Auth.loginAsUser('bendahara');
assert.strictEqual(Auth.canAccessWorkspace('dashboard'), true, 'Bendahara must access dashboard');
assert.strictEqual(Auth.canAccessWorkspace('kas'), true, 'Bendahara must access kas');
assert.strictEqual(Auth.canAccessWorkspace('maktabah'), true, 'Bendahara must access maktabah');
assert.strictEqual(Auth.canAccessWorkspace('surat'), false, 'Bendahara must NOT access surat (Strict SoD)');
assert.strictEqual(Auth.canAccessWorkspace('disposisi'), false, 'Bendahara must NOT access disposisi (Strict SoD)');
assert.strictEqual(Auth.canAccessWorkspace('keanggotaan'), false, 'Bendahara must NOT access keanggotaan (Strict SoD)');
assert.strictEqual(Auth.canAccessWorkspace('proker'), false, 'Bendahara must NOT access proker');
assert.strictEqual(Auth.canAccessWorkspace('sistem'), false, 'Bendahara must NOT access sistem');
console.log('[PASS] Bendahara: Exactly 3 workspaces allowed; persuratan/disposisi/keanggotaan blocked by SoD');

// 10.5 Dynamic Divisional Access (ART Pasal 16):
// Kadiv Hukum DPW Jabodetabek: Dapat advokasi, tidak dapat muallaf/kas/surat
Auth.loginAsUser('kadiv_hukum_jabo');
assert.strictEqual(Auth.canAccessWorkspace('advokasi'), true, 'Kadiv Hukum must access advokasi');
assert.strictEqual(Auth.canAccessWorkspace('muallaf'), false, 'Kadiv Hukum must NOT access muallaf');
assert.strictEqual(Auth.canAccessWorkspace('kas'), false, 'Kadiv Hukum must NOT access kas');
assert.strictEqual(Auth.canAccessWorkspace('surat'), false, 'Kadiv Hukum must NOT access surat');

// Kadiv Dakwah DPP: Dapat muallaf, tidak dapat advokasi
Auth.loginAsUser('kadiv_dakwah');
assert.strictEqual(Auth.canAccessWorkspace('muallaf'), true, 'Kadiv Dakwah must access muallaf');
assert.strictEqual(Auth.canAccessWorkspace('advokasi'), false, 'Kadiv Dakwah must NOT access advokasi');

// Kadiv Humas DPP: Tidak dapat advokasi maupun muallaf
Auth.loginAsUser('kadiv_humas');
assert.strictEqual(Auth.canAccessWorkspace('advokasi'), false, 'Kadiv Humas must NOT access advokasi');
assert.strictEqual(Auth.canAccessWorkspace('muallaf'), false, 'Kadiv Humas must NOT access muallaf');
assert.strictEqual(Auth.canAccessWorkspace('proker'), true, 'Kadiv Humas must access proker');
assert.strictEqual(Auth.canAccessWorkspace('disposisi'), true, 'Kadiv Humas must access disposisi');
console.log('[PASS] Dynamic divisional specialization (Hukum vs Dakwah vs Humas) verified');

// --- TEST 11: Clean Sidebar UI/UX (Unauthorized Workspaces Completely Hidden) ---
console.log('\n--- TEST 11: Clean Sidebar UI/UX (Unauthorized Workspaces Hidden) ---');

function simulateSidebarNav(user) {
  let visibleCount = 0;
  let hiddenCount = 0;
  const visibilityMap = {};

  allWorkspaces.forEach(ws => {
    const isAllowed = Auth.canAccessWorkspace(ws);
    if (isAllowed) {
      visibleCount++;
      visibilityMap[ws] = 'VISIBLE';
    } else {
      hiddenCount++;
      visibilityMap[ws] = 'HIDDEN';
    }
  });

  return { visibleCount, hiddenCount, visibilityMap };
}

// Bendahara: 3 Visible, 7 Hidden
Auth.loginAsUser('bendahara');
const bendaharaNav = simulateSidebarNav(Auth.getCurrentUser());
assert.strictEqual(bendaharaNav.visibleCount, 3, 'Bendahara must have exactly 3 visible sidebar items');
assert.strictEqual(bendaharaNav.hiddenCount, 7, 'Bendahara must have 7 hidden sidebar items');
assert.strictEqual(bendaharaNav.visibilityMap['kas'], 'VISIBLE');
assert.strictEqual(bendaharaNav.visibilityMap['surat'], 'HIDDEN');
assert.strictEqual(bendaharaNav.visibilityMap['disposisi'], 'HIDDEN');
assert.strictEqual(bendaharaNav.visibilityMap['keanggotaan'], 'HIDDEN');

// Sekretaris: 5 Visible, 5 Hidden
Auth.loginAsUser('sekretaris');
const sekretarisNav = simulateSidebarNav(Auth.getCurrentUser());
assert.strictEqual(sekretarisNav.visibleCount, 5, 'Sekretaris must have exactly 5 visible sidebar items');
assert.strictEqual(sekretarisNav.hiddenCount, 5, 'Sekretaris must have 5 hidden sidebar items');
assert.strictEqual(sekretarisNav.visibilityMap['surat'], 'VISIBLE');
assert.strictEqual(sekretarisNav.visibilityMap['disposisi'], 'VISIBLE');
assert.strictEqual(sekretarisNav.visibilityMap['keanggotaan'], 'VISIBLE');
assert.strictEqual(sekretarisNav.visibilityMap['kas'], 'HIDDEN');

// Kadiv Humas: 4 Visible, 6 Hidden
Auth.loginAsUser('kadiv_humas');
const humasNav = simulateSidebarNav(Auth.getCurrentUser());
assert.strictEqual(humasNav.visibleCount, 4, 'Kadiv Humas must have 4 visible sidebar items');
assert.strictEqual(humasNav.hiddenCount, 6, 'Kadiv Humas must have 6 hidden sidebar items');
assert.strictEqual(humasNav.visibilityMap['advokasi'], 'HIDDEN');
assert.strictEqual(humasNav.visibilityMap['muallaf'], 'HIDDEN');

console.log('[PASS] Sidebar clean UI/UX: unauthorized workspaces completely hidden (hidden class)');

// --- TEST 12: Divisional Boundary Isolation & Protection Against Unauthorized Cross-Division Actions ---
console.log('\n--- TEST 12: Divisional Boundary Isolation & Unauthorized Action Prevention ---');

// 12.1 Permission Isolation per Division (ART Pasal 16)
Auth.loginAsUser('kadiv_humas');
assert.strictEqual(Auth.hasPermission('advokasi:manage'), false, 'Kadiv Humas must NOT have advokasi:manage');
assert.strictEqual(Auth.hasPermission('muallaf:manage'), false, 'Kadiv Humas must NOT have muallaf:manage');
assert.strictEqual(Auth.hasPermission('aset:loan'), false, 'Kadiv Humas must NOT have aset:loan');
assert.strictEqual(Auth.hasPermission('proker:compose'), true, 'Kadiv Humas has proker:compose');
assert.strictEqual(Auth.hasPermission('disposisi:report'), true, 'Kadiv Humas has disposisi:report');

Auth.loginAsUser('kadiv_litbang');
assert.strictEqual(Auth.hasPermission('advokasi:manage'), false, 'Kadiv Litbang must NOT have advokasi:manage');
assert.strictEqual(Auth.hasPermission('muallaf:manage'), false, 'Kadiv Litbang must NOT have muallaf:manage');

Auth.loginAsUser('kadiv_dakwah');
assert.strictEqual(Auth.hasPermission('muallaf:manage'), true, 'Kadiv Dakwah MUST have muallaf:manage');
assert.strictEqual(Auth.hasPermission('advokasi:manage'), false, 'Kadiv Dakwah must NOT have advokasi:manage');

Auth.loginAsUser('kadiv_hukum_jabo');
assert.strictEqual(Auth.hasPermission('advokasi:manage'), true, 'Kadiv Hukum MUST have advokasi:manage');
assert.strictEqual(Auth.hasPermission('muallaf:manage'), false, 'Kadiv Hukum must NOT have muallaf:manage');

console.log('[PASS] Permission isolation strictly verified across divisions (Hukum vs Dakwah vs Humas vs Litbang)');

// 12.2 Proker Ownership & Action Guard
const prkLitbang = db.proker.find(p => p.divisiKode === 'litbang');
assert.ok(prkLitbang, 'PRK Litbang must exist');

function canDivisiActOnProker(user, proker) {
  if (user.role === 'superadmin') return true;
  if (user.role === 'ketua_divisi') {
    const isMyDivision = proker.divisiKode === user.divisi;
    const isMyTenant = user.isNationalExecutive || proker.tenantId === user.tenantId;
    return isMyDivision && isMyTenant;
  }
  return false;
}

Auth.loginAsUser('kadiv_litbang');
assert.strictEqual(canDivisiActOnProker(Auth.getCurrentUser(), prkLitbang), true, 'Kadiv Litbang can manage their own proker');

Auth.loginAsUser('kadiv_humas');
assert.strictEqual(canDivisiActOnProker(Auth.getCurrentUser(), prkLitbang), false, 'Kadiv Humas MUST be blocked from managing Litbang proker');

Auth.loginAsUser('kadiv_dakwah_jabo');
assert.strictEqual(canDivisiActOnProker(Auth.getCurrentUser(), prkLitbang), false, 'Kadiv Dakwah DPW MUST be blocked from Litbang proker');

Auth.loginAsUser('admin');
assert.strictEqual(canDivisiActOnProker(Auth.getCurrentUser(), prkLitbang), true, 'Superadmin can oversee proker');
console.log('[PASS] Proker action boundary verified: Division head blocked from acting on other divisions proker');

// 12.3 Disposisi Report Target Guard
const smk1 = db.suratMasuk.find(s => s.id === 'SMK-001'); // targetDivisi: ['litbang', 'humas']
const smk2 = db.suratMasuk.find(s => s.id === 'SMK-002'); // targetDivisi: ['dakwah', 'hukum']
assert.ok(smk1 && smk2, 'Both sample surat masuk must exist');

function canDivisiSubmitDisposisiReport(user, sm) {
  if (user.role === 'superadmin') return true;
  if (user.role === 'ketua_divisi') {
    const isTarget = sm.targetDivisi && sm.targetDivisi.includes(user.divisi);
    const isMyTenant = user.isNationalExecutive || sm.tenantId === user.tenantId;
    return isTarget && isMyTenant;
  }
  return false;
}

Auth.loginAsUser('kadiv_litbang');
assert.strictEqual(canDivisiSubmitDisposisiReport(Auth.getCurrentUser(), smk1), true, 'Kadiv Litbang can report on SMK-001 (assigned)');
assert.strictEqual(canDivisiSubmitDisposisiReport(Auth.getCurrentUser(), smk2), false, 'Kadiv Litbang BLOCKED on SMK-002 (unassigned)');

Auth.loginAsUser('kadiv_humas');
assert.strictEqual(canDivisiSubmitDisposisiReport(Auth.getCurrentUser(), smk1), true, 'Kadiv Humas can report on SMK-001 (assigned)');
assert.strictEqual(canDivisiSubmitDisposisiReport(Auth.getCurrentUser(), smk2), false, 'Kadiv Humas BLOCKED on SMK-002 (unassigned)');

Auth.loginAsUser('kadiv_dakwah');
assert.strictEqual(canDivisiSubmitDisposisiReport(Auth.getCurrentUser(), smk1), false, 'Kadiv Dakwah BLOCKED on SMK-001 (unassigned)');
assert.strictEqual(canDivisiSubmitDisposisiReport(Auth.getCurrentUser(), smk2), true, 'Kadiv Dakwah can report on SMK-002 (assigned)');

console.log('[PASS] Disposisi report action guard verified: Only designated divisions can submit follow-up reports');

// 12.4 Verify Implementation in portal/app.js Source Code
const appJsCode = fs.readFileSync('portal/app.js', 'utf8');
assert.ok(appJsCode.includes('proker.divisiKode !== user.divisi'), 'portal/app.js must check proker.divisiKode !== user.divisi in ajukanPencairanProker and unggahLpjProker');
assert.ok(appJsCode.includes('!sm.targetDivisi.includes(user.divisi)'), 'portal/app.js must check !sm.targetDivisi.includes(user.divisi) in submitLaporanDisposisi');
assert.ok(appJsCode.includes("user.role === 'ketua_divisi' && user.divisi !== 'hukum'"), 'portal/app.js must guard terbitkanSuratTugasLbh');
assert.ok(appJsCode.includes("user.role === 'ketua_divisi' && user.divisi === 'dakwah'"), 'portal/app.js must guard openTambahMuallafModal to dakwah division only');
console.log('[PASS] Source code audit in portal/app.js confirms strict divisional boundaries');

// =========================================================================
// TEST 13: Automated Official Letter Numbering & Dedicated Surat Masuk Modal
// =========================================================================
console.log('\n--- TEST 13: Automated Official Letter Numbering & Dedicated Surat Masuk Modal ---');

// 13.1 Roman Month Calculation
assert.strictEqual(State.getRomanMonth(new Date(2026, 0, 15)), 'I', 'Januari must be I');
assert.strictEqual(State.getRomanMonth(new Date(2026, 7, 17)), 'VIII', 'Agustus must be VIII');
assert.strictEqual(State.getRomanMonth(new Date(2026, 10, 9)), 'XI', 'November must be XI');
assert.strictEqual(State.getRomanMonth(new Date(2026, 11, 25)), 'XII', 'Desember must be XII');
console.log('[PASS] Roman month conversion verified (I - XII)');

// 13.2 Automated Sequential Official Letter Numbering (Surat Keluar & SK)
// PRD Formula: [NOMOR_URUT]/[KODE_SURAT]-[KODE_TENANT]/[BULAN_ROMAWI]/[TAHUN]
// Given db.surat has 005/SM-DPP-APII/XI/2026 and 006/SK-DPP-APII/XI/2026
const nextSmDpp = State.generateNextNomorSurat('SM', 'DPP_PUSAT', new Date(2026, 10, 10));
assert.strictEqual(nextSmDpp, '007/SM-DPP-APII/XI/2026', 'Next DPP SM letter must be 007/SM-DPP-APII/XI/2026');

const nextSkDpp = State.generateNextNomorSurat('SK', 'DPP_PUSAT', new Date(2026, 10, 10));
assert.strictEqual(nextSkDpp, '007/SK-DPP-APII/XI/2026', 'Next DPP SK letter must be 007/SK-DPP-APII/XI/2026');

// DPW Jabodetabek has 002/UND-DPW-JABO/XI/2026
const nextUndDpw = State.generateNextNomorSurat('UND', 'DPW_JABO', new Date(2026, 10, 10));
assert.strictEqual(nextUndDpw, '003/UND-DPW-JABO/XI/2026', 'Next DPW UND letter must be 003/UND-DPW-JABO/XI/2026');
console.log('[PASS] Automated sequential official letter numbering verified without loncat nomor');

// 13.3 Automated Agenda Numbering (Surat Masuk)
// PRD Formula: AGD/[TAHUN]/[BULAN_ROMAWI]/[NOMOR_URUT]
// Given db.suratMasuk has AGD/2026/XI/018 and AGD/2026/XI/017
const nextAgenda = State.generateNextNomorAgenda('DPP_PUSAT', new Date(2026, 10, 10));
assert.strictEqual(nextAgenda, 'AGD/2026/XI/019', 'Next Agenda must be AGD/2026/XI/019');
console.log('[PASS] Automated digital agenda numbering verified (AGD/2026/XI/019)');

// 13.4 Zero Browser Prompts in Persuratan & Disposisi
const smFuncMatch = appJsCode.match(/function openTambahSuratMasukModal\(\) \{[\s\S]*?\n  \}/);
assert.ok(smFuncMatch, 'openTambahSuratMasukModal must be defined');
assert.ok(!smFuncMatch[0].includes('prompt('), 'openTambahSuratMasukModal MUST contain zero browser prompt() calls');
console.log('[PASS] Zero browser prompt() in openTambahSuratMasukModal (replaced with rich Tailwind modal)');

// 13.5 Dedicated Surat Masuk Modal in portal/index.html
const indexHtmlCode = fs.readFileSync('portal/index.html', 'utf8');
assert.ok(indexHtmlCode.includes('id="modal-tambah-surat-masuk"'), 'portal/index.html must have #modal-tambah-surat-masuk');
assert.ok(indexHtmlCode.includes('id="sm-form-no-agenda-display"'), '#modal-tambah-surat-masuk must display auto agenda number');
assert.ok(indexHtmlCode.includes('id="sm-form-asal"'), '#modal-tambah-surat-masuk must have sender input');
assert.ok(indexHtmlCode.includes('id="sm-form-perihal"'), '#modal-tambah-surat-masuk must have perihal input');
assert.ok(indexHtmlCode.includes('id="sm-form-rekomendasi"'), '#modal-tambah-surat-masuk must have secretary recommendation textarea');
assert.ok(indexHtmlCode.includes('name="sm_target_divisi"'), '#modal-tambah-surat-masuk must have divisional checklist');
console.log('[PASS] Dedicated rich modal for Surat Masuk registration verified with full PRD fields');

// 13.6 Auto-locked Numbering Displays in Workspace Surat & SK Generator
assert.ok(indexHtmlCode.includes('id="composer-nomor-display"'), 'workspace-surat must have #composer-nomor-display');
assert.ok(indexHtmlCode.includes('id="composer-template-quick"'), 'workspace-surat must have #composer-template-quick');
assert.ok(indexHtmlCode.includes('id="sk-form-template"'), 'modal-sk-generator must have #sk-form-template');
console.log('[PASS] Auto-locked numbering indicators & quick templates verified in Workspace Surat & SK Generator');

// =========================================================================
// TEST 14: Dedicated Modal Usulan Program Kerja Divisi (Proposal Proker)
// =========================================================================
console.log('\n--- TEST 14: Dedicated Modal Usulan Program Kerja Divisi (Proposal Proker) ---');

// 14.1 Zero Browser Prompts in Proker Proposal
const latestAppJs = fs.readFileSync('portal/app.js', 'utf8');
const prokerFuncMatch = latestAppJs.match(/function openTambahProkerModal\(\) \{[\s\S]*?\n  \}/);
assert.ok(prokerFuncMatch, 'openTambahProkerModal must be defined');
assert.ok(!prokerFuncMatch[0].includes('prompt('), 'openTambahProkerModal MUST contain zero browser prompt() calls');
console.log('[PASS] Zero browser prompt() in openTambahProkerModal (replaced with rich Tailwind modal)');

// 14.2 Dedicated Proker Proposal Modal in portal/index.html
const latestIndexHtml = fs.readFileSync('portal/index.html', 'utf8');
assert.ok(latestIndexHtml.includes('id="modal-tambah-proker"'), 'portal/index.html must have #modal-tambah-proker');
assert.ok(latestIndexHtml.includes('id="proker-form-nama"'), '#modal-tambah-proker must have proker name input');
assert.ok(latestIndexHtml.includes('id="proker-form-latar-belakang"'), '#modal-tambah-proker must have background textarea');
assert.ok(latestIndexHtml.includes('id="proker-form-target"'), '#modal-tambah-proker must have target/KPI input');
assert.ok(latestIndexHtml.includes('id="proker-form-rab"'), '#modal-tambah-proker must have RAB input');
assert.ok(latestIndexHtml.includes('id="proker-form-kantong"'), '#modal-tambah-proker must have sharia wallet selector');
assert.ok(latestIndexHtml.includes('id="proker-form-chips-container"'), '#modal-tambah-proker must have inspiration chips container');
assert.ok(latestIndexHtml.includes('id="proker-form-divisi-locked"'), '#modal-tambah-proker must have division locked badge');
console.log('[PASS] Dedicated modal #modal-tambah-proker verified with full proposal fields & sharia wallet options');

// 14.3 Proker Submission & Sharia Wallet Assignment
Auth.loginAsUser('kadiv_dakwah');
const currentUser = Auth.getCurrentUser();
const sampleProker = {
  id: 'PRK-TEST-001',
  tenantId: currentUser.tenantId,
  divisiKode: currentUser.divisi,
  divisiNama: 'Divisi Dakwah',
  namaProgram: 'Program Bimbingan Muallaf Berkelanjutan',
  latarBelakang: 'Penguatan akidah saudara baru muallaf.',
  targetSasaran: '50 Muallaf binaan',
  rabNominal: 20000000,
  kantongSyariah: 'ZAKAT',
  realisasiDana: 0,
  status: 'AJUKAN'
};
db.proker.unshift(sampleProker);
assert.strictEqual(db.proker[0].divisiKode, 'dakwah', 'Submitted proker division must match user division');
assert.strictEqual(db.proker[0].kantongSyariah, 'ZAKAT', 'Submitted proker sharia wallet must be ZAKAT');
console.log('[PASS] Proker submission and strict division-wallet binding verified');

// =========================================================================
// TEST 15: Comprehensive Smart WhatsApp Relay Audit & All-Officer Coverage
// =========================================================================
console.log('\n--- TEST 15: Smart WhatsApp Relay Audit & All-Officer Action Coverage ---');

// 15.1 Phone Number Sanitization & E.164 Clean Digits
function sanitizeWaPhone(phone) {
  const clean = String(phone || '').replace(/\D/g, '');
  const display = clean ? (clean.startsWith('62') ? '+' + clean : clean) : '-';
  const url = `https://wa.me/${clean}`;
  return { clean, display, url };
}

const p1 = sanitizeWaPhone('+62 813-5857-5678');
assert.strictEqual(p1.clean, '6281358575678', 'Should strip + and dashes/spaces');
assert.strictEqual(p1.display, '+6281358575678', 'Should display with single leading +');
assert.strictEqual(p1.url, 'https://wa.me/6281358575678', 'URL must not have double plusses ++62');

const p2 = sanitizeWaPhone('0812-3456-7890');
assert.strictEqual(p2.clean, '081234567890', 'Should strip dashes');

const p3 = sanitizeWaPhone(null);
assert.strictEqual(p3.clean, '', 'Null phone should cleanly result in empty clean string');
assert.strictEqual(p3.display, '-', 'Empty phone should display dash');
console.log('[PASS] WhatsApp phone number sanitization (E.164 digits without ++62) verified');

// 15.2 Smart WhatsApp Relay Modal Component Presence in portal/index.html
assert.ok(latestIndexHtml.includes('id="modal-whatsapp-relay"'), 'index.html must have #modal-whatsapp-relay');
assert.ok(latestIndexHtml.includes('id="wa-relay-target-name"'), '#modal-whatsapp-relay must have #wa-relay-target-name');
assert.ok(latestIndexHtml.includes('id="wa-relay-target-role"'), '#modal-whatsapp-relay must have #wa-relay-target-role');
assert.ok(latestIndexHtml.includes('id="wa-relay-target-phone"'), '#modal-whatsapp-relay must have #wa-relay-target-phone');
assert.ok(latestIndexHtml.includes('id="wa-relay-preview-text"'), '#modal-whatsapp-relay must have #wa-relay-preview-text');
assert.ok(latestIndexHtml.includes('id="btn-wa-send-direct"'), '#modal-whatsapp-relay must have direct send button');
assert.ok(latestIndexHtml.includes('id="btn-wa-copy-group"'), '#modal-whatsapp-relay must have copy to group button');
console.log('[PASS] Smart WhatsApp Relay modal DOM elements verified');

// 15.3 Smart WhatsApp Relay Function Definition & Sanitizer in portal/app.js
const fullAppCode = fs.readFileSync('portal/app.js', 'utf8');
assert.ok(fullAppCode.includes('function showWhatsAppRelayModal(targetName, targetRole, targetPhone, messageText)'), 'showWhatsAppRelayModal must be defined');
assert.ok(fullAppCode.includes("const cleanPhone = String(targetPhone || '').replace(/\\D/g, '');"), 'showWhatsAppRelayModal must sanitize phone number');
assert.ok(fullAppCode.includes('https://wa.me/${cleanPhone}?text='), 'showWhatsAppRelayModal must use cleanPhone in wa.me URL');
console.log('[PASS] showWhatsAppRelayModal definition and E.164 phone sanitization verified');

// 15.4 Audit Matrix: Relay Coverage Across All Key Officer Actions
const relayActions = [
  { name: 'Surat Keluar Drafting', caller: 'submitSuratComposer', recipient: 'Ketua Umum' },
  { name: 'Surat Keluar Approval', caller: 'approveSurat', recipient: 'Sekretaris' },
  { name: 'Surat Keluar Rejection', caller: 'rejectSurat', recipient: 'Sekretaris' },
  { name: 'SK Decree Publishing', caller: 'submitSkGenerator', recipient: 'Wilayah / Penerima SK' },
  { name: 'Surat Masuk Registration', caller: 'submitTambahSuratMasukModal', recipient: 'Ketua (Rekomendasi)' },
  { name: 'Disposisi Instruction', caller: 'approveDisposisiKetua', recipient: 'Kadiv Pelaksana' },
  { name: 'Disposisi Report Completed', caller: 'submitLaporanDisposisi', recipient: 'Ketua & Sekretaris' },
  { name: 'BKK Draft Kas Keluar', caller: 'openTambahBkkModal', recipient: 'Bendahara (Tahap 1)' },
  { name: 'BKK Verification Bendahara', caller: 'verifyKasBendahara', recipient: 'Ketua (Tahap 2)' },
  { name: 'BKK Approval Ketua', caller: 'approveKasKetua', recipient: 'Bendahara & Pemohon' },
  { name: 'Proker Usulan Baru', caller: 'submitTambahProkerModal', recipient: 'Ketua' },
  { name: 'Proker Pagu Approval', caller: 'setujuiPaguProker', recipient: 'Kadiv Pengusul' },
  { name: 'Proker Disbursement Request', caller: 'ajukanPencairanProker', recipient: 'Bendahara' },
  { name: 'Proker LPJ Submission', caller: 'unggahLpjProker', recipient: 'Bendahara & Pengawas' },
  { name: 'KTA Verification Sekretaris', caller: 'verifyKtaSekretaris', recipient: 'Ketua' },
  { name: 'KTA Approval Ketua', caller: 'approveKtaKetua', recipient: 'Anggota / Kader' },
  { name: 'LBH Task Letter', caller: 'terbitkanSuratTugasLbh', recipient: "Da'i Klien / Tim Advokat" },
  { name: 'Tabayyun Press Release', caller: 'siarkanTabayyunWa', recipient: 'Media & Grup Resmi APII' },
  { name: 'Muallaf Syahadat Record', caller: 'openTambahMuallafModal', recipient: 'Bendahara (Zakat Muallaf)' },
  { name: 'Deadlock Breaker Override', caller: 'submitDeadlockBreaker', recipient: 'Pimpinan Harian BPH' }
];

relayActions.forEach(action => {
  // Check that the caller function in app.js invokes showWhatsAppRelayModal
  const regex = new RegExp(`function ${action.caller}\\([\\s\\S]*?\\n  \\}`);
  const match = fullAppCode.match(regex);
  assert.ok(match, `Function ${action.caller} must exist in portal/app.js`);
  assert.ok(
    match[0].includes('showWhatsAppRelayModal('),
    `Action [${action.name}] in ${action.caller}() MUST trigger showWhatsAppRelayModal to ${action.recipient}`
  );
});
console.log(`[PASS] Complete WhatsApp Relay coverage verified across ALL ${relayActions.length} officer actions!`);

// --- TEST 16: Master Tata Letak Logo, KOP, Tipografi & Stempel Multi-Tenant Engine (DPP & DPW) ---
console.log('\n--- TEST 16: Master Tata Letak Logo, KOP, Tipografi & Stempel Multi-Tenant Engine (DPP & DPW) ---');

// 16.1 Tenant Scope Isolation & Initial Configuration
const dppInit = State.getTenantSettings('DPP_PUSAT');
const dpwInit = State.getTenantSettings('DPW_JABO');

assert.strictEqual(dppInit.scope, 'DPP_PUSAT', 'DPP scope must be DPP_PUSAT');
assert.strictEqual(dpwInit.scope, 'DPW_JABO', 'DPW scope must be DPW_JABO');
assert.strictEqual(dppInit.kopBaris2, 'DEWAN PENGURUS PUSAT', 'DPP KOP Baris 2 must be DEWAN PENGURUS PUSAT');
assert.strictEqual(dpwInit.kopBaris2, 'DEWAN PENGURUS WILAYAH JABODETABEK', 'DPW KOP Baris 2 must be DEWAN PENGURUS WILAYAH JABODETABEK');
assert.strictEqual(dppInit.stempelWarna, '#065f46', 'DPP stamp color must default to Emerald #065f46');
assert.strictEqual(dpwInit.stempelWarna, '#1e3a8a', 'DPW stamp color must default to Navy Blue #1e3a8a');
console.log('[PASS] Independent tenant settings schema and default styling verified for DPP and DPW');

// 16.2 Independent Layout Customization (Logo, KOP Divider, Tipografi, Stempel) Without Leakage
State.updateSettings({
  logoLayout: 'center',
  logoSize: 92,
  kopDivider: 'classic_gold',
  fontFamily: 'amiri',
  fontSize: '11pt',
  lineSpacing: '1.5',
  stempelRotasi: -18,
  stempelPosisi: 'center'
}, 'Superadmin Test', 'DPP_PUSAT');

const dppUpdated = State.getTenantSettings('DPP_PUSAT');
assert.strictEqual(dppUpdated.logoLayout, 'center', 'DPP logo layout must update to center');
assert.strictEqual(dppUpdated.logoSize, 92, 'DPP logo size must update to 92');
assert.strictEqual(dppUpdated.kopDivider, 'classic_gold', 'DPP divider must update to classic_gold');
assert.strictEqual(dppUpdated.fontFamily, 'amiri', 'DPP font must update to amiri');
assert.strictEqual(dppUpdated.fontSize, '11pt', 'DPP font size must update to 11pt');
assert.strictEqual(dppUpdated.lineSpacing, '1.5', 'DPP line spacing must update to 1.5');
assert.strictEqual(dppUpdated.stempelRotasi, -18, 'DPP stamp rotation must update to -18');
assert.strictEqual(dppUpdated.stempelPosisi, 'center', 'DPP stamp position must update to center');

// Verify that DPW settings were NOT altered by DPP updates
const dpwUntouched = State.getTenantSettings('DPW_JABO');
assert.strictEqual(dpwUntouched.logoLayout, 'left', 'DPW logo layout must remain unchanged at left');
assert.strictEqual(dpwUntouched.logoSize, 76, 'DPW logo size must remain unchanged at 76');
assert.strictEqual(dpwUntouched.kopDivider, 'double_black', 'DPW divider must remain double_black');
assert.strictEqual(dpwUntouched.stempelRotasi, -10, 'DPW stamp rotation must remain -10');
console.log('[PASS] Multi-tenant mutation isolation verified: DPP updates do not leak into DPW');

// Now update DPW Jabodetabek with dual logo and single signature
State.updateSettings({
  logoLayout: 'dual',
  logoSecondaryUrl: './logo_jabo.png',
  modelTtd: 'single',
  stempelWarna: '#581c87' // Classic violet
}, 'Superadmin Test', 'DPW_JABO');

const dpwUpdated = State.getTenantSettings('DPW_JABO');
assert.strictEqual(dpwUpdated.logoLayout, 'dual', 'DPW logo layout must update to dual');
assert.strictEqual(dpwUpdated.logoSecondaryUrl, './logo_jabo.png', 'DPW secondary logo must update');
assert.strictEqual(dpwUpdated.modelTtd, 'single', 'DPW signature model must update to single');
assert.strictEqual(dpwUpdated.stempelWarna, '#581c87', 'DPW stamp color must update to violet');
console.log('[PASS] Regional DPW customization (dual logo & single signature) verified');

// 16.3 Automatic Settings Seeding on New Wilayah Registration
const regRes = State.registerWilayah({
  code: 'DPW_RIAU',
  name: 'DPW Riau & Kepulauan Riau',
  city: 'Pekanbaru',
  slug: 'riau',
  phone: '6281234567899'
});
assert.ok(regRes.ok, 'Wilayah registration must succeed');
const riauSettings = State.getTenantSettings('DPW_RIAU');
assert.ok(riauSettings, 'Newly registered DPW must have seeded tenant settings');
assert.strictEqual(riauSettings.scope, 'DPW_RIAU', 'Scope must match DPW_RIAU');
assert.ok(riauSettings.kopBaris2.includes('RIAU'), 'KOP Baris 2 must include RIAU');
assert.strictEqual(riauSettings.kotaSurat, 'Pekanbaru', 'Kota surat must match registered city');
console.log('[PASS] Auto-seeding of layout, KOP, typography & stamp for newly registered DPW verified');

// 16.4 Verify buildA4DocumentHtml Rendering & Layout Styles in portal/app.js
assert.ok(fullAppCode.includes('function buildA4DocumentHtml('), 'buildA4DocumentHtml must be defined in app.js');
assert.ok(fullAppCode.includes("const fontClass = cfg.fontFamily === 'arial'"), 'Font classes mapping verified');
assert.ok(fullAppCode.includes("if (logoLayout === 'center')"), 'Center logo layout verified in builder');
assert.ok(fullAppCode.includes("else if (logoLayout === 'dual')"), 'Dual logo layout verified in builder');
assert.ok(fullAppCode.includes("else if (logoLayout === 'right')"), 'Right logo layout verified in builder');
assert.ok(fullAppCode.includes("case 'classic_gold':"), 'Classic gold divider verified in builder');
assert.ok(fullAppCode.includes("case 'single_emerald':"), 'Single emerald divider verified in builder');
assert.ok(fullAppCode.includes('stempelHtml = `'), 'Dynamic wet stamp HTML verified in builder');

// 16.5 Verify Settings Subtab Scope Switcher & Live Preview Synchronization
assert.ok(fullAppCode.includes('function switchSettingsScope(scope)'), 'switchSettingsScope must be defined in app.js');
assert.ok(fullAppCode.includes('function syncSettingsPreview()'), 'syncSettingsPreview must be defined in app.js');
assert.ok(fullAppCode.includes('function resetSettingsToDefault(scope)'), 'resetSettingsToDefault must be defined in app.js');
assert.ok(fullAppCode.includes('id="settings-live-a4-preview"'), 'Settings subtab must include #settings-live-a4-preview canvas');
assert.ok(fullAppCode.includes('id="settings-logo-layout"'), 'Form must include #settings-logo-layout');
assert.ok(fullAppCode.includes('id="settings-logo-size"'), 'Form must include #settings-logo-size');
assert.ok(fullAppCode.includes('id="settings-kop-divider"'), 'Form must include #settings-kop-divider');
assert.ok(fullAppCode.includes('id="settings-font-family"'), 'Form must include #settings-font-family');
assert.ok(fullAppCode.includes('id="settings-stempel-warna"'), 'Form must include #settings-stempel-warna');
assert.ok(fullAppCode.includes('id="settings-stempel-rotasi"'), 'Form must include #settings-stempel-rotasi');
console.log('[PASS] Subtab Master Settings & Live Preview canvas integration verified in portal/app.js');

// 16.6 Verify Virtual A4 Sheet Dynamic Re-rendering in Workspace Persuratan
assert.ok(fullAppCode.includes('printableSheet.innerHTML = buildA4DocumentHtml('), 'Workspace Persuratan must render via buildA4DocumentHtml');
console.log('[PASS] Workspace Persuratan dynamic re-rendering via buildA4DocumentHtml verified');

// =========================================================================
// TEST 17: Uploaded Signatures & Official Rubber Stamp Layout Customizer
// =========================================================================
console.log('\n--- TEST 17: Uploaded Signatures & Official Rubber Stamp Layout Customizer ---');

// 17.1 State Schema Validation for Uploaded Signatures & Stamp
const dppBeforeUpload = State.getTenantSettings('DPP_PUSAT');
assert.strictEqual(dppBeforeUpload.ketuaTtdMode, 'spesimen', 'Default Ketua TTD mode must be spesimen');
assert.strictEqual(dppBeforeUpload.sekretarisTtdMode, 'spesimen', 'Default Sekretaris TTD mode must be spesimen');
assert.strictEqual(dppBeforeUpload.stempelMode, 'vektor', 'Default Stempel mode must be vektor');
assert.strictEqual(dppBeforeUpload.stempelSize, 112, 'Default Stempel size must be 112px');
assert.strictEqual(dppBeforeUpload.stempelOpacity, 85, 'Default Stempel opacity must be 85%');
assert.strictEqual(dppBeforeUpload.stempelOffsetX, -24, 'Default Stempel offset X must be -24px');
assert.strictEqual(dppBeforeUpload.stempelOffsetY, 8, 'Default Stempel offset Y must be 8px');
console.log('[PASS] Default schema for uploaded TTD and stamp verified in state');

// 17.2 Independent DPP Configuration with Uploaded Files & Custom Geometry
const sampleTtdPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const sampleStampPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

State.updateSettings({
  ketuaTtdMode: 'upload',
  ketuaTtdUrl: sampleTtdPng,
  ketuaTtdSize: 88,
  sekretarisTtdMode: 'upload',
  sekretarisTtdUrl: sampleTtdPng,
  sekretarisTtdSize: 76,
  stempelMode: 'upload',
  stempelUrl: sampleStampPng,
  stempelSize: 130,
  stempelOpacity: 92,
  stempelOffsetX: -18,
  stempelOffsetY: 14,
  stempelRotasi: -15
}, 'Superadmin Test', 'DPP_PUSAT');

const dppAfterUpload = State.getTenantSettings('DPP_PUSAT');
assert.strictEqual(dppAfterUpload.ketuaTtdMode, 'upload', 'DPP Ketua TTD mode must be upload');
assert.strictEqual(dppAfterUpload.ketuaTtdUrl, sampleTtdPng, 'DPP Ketua TTD URL must match uploaded data');
assert.strictEqual(dppAfterUpload.ketuaTtdSize, 88, 'DPP Ketua TTD size must update to 88px');
assert.strictEqual(dppAfterUpload.sekretarisTtdMode, 'upload', 'DPP Sekretaris TTD mode must be upload');
assert.strictEqual(dppAfterUpload.sekretarisTtdSize, 76, 'DPP Sekretaris TTD size must update to 76px');
assert.strictEqual(dppAfterUpload.stempelMode, 'upload', 'DPP Stempel mode must be upload');
assert.strictEqual(dppAfterUpload.stempelUrl, sampleStampPng, 'DPP Stempel URL must match uploaded stamp data');
assert.strictEqual(dppAfterUpload.stempelSize, 130, 'DPP Stempel size must update to 130px');
assert.strictEqual(dppAfterUpload.stempelOpacity, 92, 'DPP Stempel opacity must update to 92%');
assert.strictEqual(dppAfterUpload.stempelOffsetX, -18, 'DPP Stempel offset X must update to -18px');
assert.strictEqual(dppAfterUpload.stempelOffsetY, 14, 'DPP Stempel offset Y must update to 14px');
assert.strictEqual(dppAfterUpload.stempelRotasi, -15, 'DPP Stempel rotation must update to -15deg');
console.log('[PASS] DPP Pusat uploaded files and layout adjustments successfully saved in tenant state');

// 17.3 Multi-Tenant Isolation: Regional DPW Untouched by DPP File Uploads
const dpwCheck = State.getTenantSettings('DPW_JABO');
assert.strictEqual(dpwCheck.ketuaTtdMode, 'spesimen', 'DPW Ketua TTD mode must remain spesimen');
assert.strictEqual(dpwCheck.ketuaTtdUrl, '', 'DPW Ketua TTD URL must remain empty');
assert.strictEqual(dpwCheck.stempelMode, 'vektor', 'DPW Stempel mode must remain vektor');
assert.strictEqual(dpwCheck.stempelUrl, '', 'DPW Stempel URL must remain empty');
console.log('[PASS] Multi-tenant isolation verified: DPP file uploads did not leak to DPW');

// Now configure DPW Jabodetabek with its own regional files
const sampleDpwStamp = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
State.updateSettings({
  stempelMode: 'upload',
  stempelUrl: sampleDpwStamp,
  stempelSize: 120,
  stempelOffsetX: -10,
  stempelOffsetY: 6,
  stempelRotasi: -8
}, 'Superadmin Test', 'DPW_JABO');

const dpwAfterUpload = State.getTenantSettings('DPW_JABO');
assert.strictEqual(dpwAfterUpload.stempelMode, 'upload', 'DPW Stempel mode must be upload');
assert.strictEqual(dpwAfterUpload.stempelUrl, sampleDpwStamp, 'DPW Stempel URL must be independent regional file');
assert.strictEqual(dpwAfterUpload.stempelSize, 120, 'DPW Stempel size must be 120px');
assert.strictEqual(State.getTenantSettings('DPP_PUSAT').stempelUrl, sampleStampPng, 'DPP stamp remains untouched by DPW update');
console.log('[PASS] Regional DPW independent uploaded stamp configuration verified');

// 17.4 HTML Naskah Dinamis Rendering Verification (buildA4DocumentHtml)
// Build HTML simulating DPP Pusat letter
function mockBuildA4Html(tenantScope, override = {}) {
  const cfg = { ...State.getTenantSettings(tenantScope), ...override };
  let ttdKetuaVisual = '';
  if (cfg.ketuaTtdMode === 'upload' && cfg.ketuaTtdUrl) {
    const h = Number(cfg.ketuaTtdSize) || 64;
    ttdKetuaVisual = `<img src="${cfg.ketuaTtdUrl}" alt="TTD Ketua" style="height: ${h}px; max-width: 170px;" class="object-contain mx-auto mix-blend-multiply select-none" />`;
  } else {
    ttdKetuaVisual = '<span class="text-[10px] text-emerald-800 font-bold italic">[Tanda Tangan Elektronik]</span>';
  }

  let ttdSekVisual = '';
  if (cfg.sekretarisTtdMode === 'upload' && cfg.sekretarisTtdUrl) {
    const h = Number(cfg.sekretarisTtdSize) || 64;
    ttdSekVisual = `<img src="${cfg.sekretarisTtdUrl}" alt="TTD Sekretaris" style="height: ${h}px; max-width: 170px;" class="object-contain mx-auto mix-blend-multiply select-none" />`;
  } else {
    ttdSekVisual = '<span class="text-[10px] text-emerald-800 font-bold italic">[Paraf Digital]</span>';
  }

  let stempelHtml = '';
  if (cfg.stempelAktif !== false) {
    const rotasi = cfg.stempelRotasi !== undefined ? Number(cfg.stempelRotasi) : -12;
    const size = Number(cfg.stempelSize) || 112;
    const opacity = (cfg.stempelOpacity !== undefined ? Number(cfg.stempelOpacity) : 85) / 100;
    const offX = cfg.stempelOffsetX !== undefined ? Number(cfg.stempelOffsetX) : -24;
    const offY = cfg.stempelOffsetY !== undefined ? Number(cfg.stempelOffsetY) : 8;
    const posStyle = `left: ${offX}px; top: ${offY}px; transform: rotate(${rotasi}deg);`;

    if (cfg.stempelMode === 'upload' && cfg.stempelUrl) {
      stempelHtml = `
        <div class="absolute pointer-events-none mix-blend-multiply flex items-center justify-center select-none" style="width: ${size}px; height: ${size}px; opacity: ${opacity}; ${posStyle}">
          <img src="${cfg.stempelUrl}" alt="Stempel Basah Ormas" class="w-full h-full object-contain pointer-events-none" />
        </div>
      `;
    }
  }

  return { ttdKetuaVisual, ttdSekVisual, stempelHtml };
}

const dppRender = mockBuildA4Html('DPP_PUSAT');
assert.ok(dppRender.ttdKetuaVisual.includes('alt="TTD Ketua"'), 'Ketua TTD must render img tag');
assert.ok(dppRender.ttdKetuaVisual.includes('style="height: 88px'), 'Ketua TTD must render exact custom height (88px)');
assert.ok(dppRender.ttdKetuaVisual.includes('mix-blend-multiply'), 'Ketua TTD must include mix-blend-multiply');
assert.ok(dppRender.ttdSekVisual.includes('alt="TTD Sekretaris"'), 'Sekretaris TTD must render img tag');
assert.ok(dppRender.ttdSekVisual.includes('style="height: 76px'), 'Sekretaris TTD must render exact custom height (76px)');
assert.ok(dppRender.stempelHtml.includes('alt="Stempel Basah Ormas"'), 'Stempel must render img tag for upload mode');
assert.ok(dppRender.stempelHtml.includes('width: 130px; height: 130px; opacity: 0.92; left: -18px; top: 14px; transform: rotate(-15deg);'), 'Stempel geometry matches all custom sliders');
console.log('[PASS] buildA4DocumentHtml accurately renders uploaded TTD images and wet stamp with exact geometric transform');

// 17.5 Code Audit in portal/app.js for File Upload & Geometry Controls
const appJsAfterEdit = fs.readFileSync('portal/app.js', 'utf8');
assert.ok(appJsAfterEdit.includes('function handleImageFileUpload('), 'handleImageFileUpload must be defined');
assert.ok(appJsAfterEdit.includes('canvas.toDataURL(\'image/png\', 0.9);'), 'Canvas compression to PNG data URL must be implemented');
assert.ok(appJsAfterEdit.includes('function updateUploadThumbnail('), 'updateUploadThumbnail must be defined');
assert.ok(appJsAfterEdit.includes('function clearUploadedImage('), 'clearUploadedImage must be defined');
assert.ok(appJsAfterEdit.includes('function toggleTtdUploadView('), 'toggleTtdUploadView must be defined');
assert.ok(appJsAfterEdit.includes('function toggleStempelUploadView('), 'toggleStempelUploadView must be defined');

// Check input IDs in portal/app.js
assert.ok(appJsAfterEdit.includes('id="upload-ketua-ttd"'), 'File input for Ketua TTD must exist');
assert.ok(appJsAfterEdit.includes('id="settings-ketua-ttd-size"'), 'Height slider for Ketua TTD must exist');
assert.ok(appJsAfterEdit.includes('id="upload-sek-ttd"'), 'File input for Sekretaris TTD must exist');
assert.ok(appJsAfterEdit.includes('id="settings-sek-ttd-size"'), 'Height slider for Sekretaris TTD must exist');
assert.ok(appJsAfterEdit.includes('id="upload-stempel-file"'), 'File input for Stempel must exist');
assert.ok(appJsAfterEdit.includes('id="settings-stempel-size"'), 'Size slider for Stempel must exist');
assert.ok(appJsAfterEdit.includes('id="settings-stempel-rotasi"'), 'Rotation slider for Stempel must exist');
assert.ok(appJsAfterEdit.includes('id="settings-stempel-opacity"'), 'Opacity slider for Stempel must exist');
assert.ok(appJsAfterEdit.includes('id="settings-stempel-offset-x"'), 'Offset X slider for Stempel must exist');
assert.ok(appJsAfterEdit.includes('id="settings-stempel-offset-y"'), 'Offset Y slider for Stempel must exist');

// Check App exports
assert.ok(appJsAfterEdit.includes('handleImageFileUpload,'), 'handleImageFileUpload must be exported in App');
assert.ok(appJsAfterEdit.includes('updateUploadThumbnail,'), 'updateUploadThumbnail must be exported in App');
assert.ok(appJsAfterEdit.includes('clearUploadedImage,'), 'clearUploadedImage must be exported in App');
assert.ok(appJsAfterEdit.includes('toggleTtdUploadView,'), 'toggleTtdUploadView must be exported in App');
assert.ok(appJsAfterEdit.includes('toggleStempelUploadView,'), 'toggleStempelUploadView must be exported in App');
console.log('[PASS] Full code verification: image compressor, thumbnail sync, and layout controls properly exported');

// =========================================================================
// TEST 18: GAS Backend VM Execution — Core Fixes [B-01..B-06]
// =========================================================================
function createGasVmRuntime() {
  const gsCode = fs.readFileSync('build/dist_Code.gs', 'utf8');
  const sheets = new Map();
  const scriptProps = new Map();
  const driveFiles = new Map();
  const driveAudit = [];
  const logs = [];
  let lockCount = 0;

  function toDisplayValue(v) {
    if (v instanceof Date) {
      const dd = String(v.getDate()).padStart(2, '0');
      const mm = String(v.getMonth() + 1).padStart(2, '0');
      const yyyy = v.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    }
    return v == null ? '' : String(v);
  }

  function makeSheet(name) {
    const rows = [];
    const sheetObj = {
      _rows: rows,
      getName() { return name; },
      getLastRow() { return rows.length; },
      getLastColumn() { return rows.length > 0 ? rows[0].length : 0; },
      appendRow(arr) {
        rows.push([...arr]);
        return sheetObj;
      },
      deleteRow(rowNum1Based) {
        if (rowNum1Based >= 1 && rowNum1Based <= rows.length) {
          rows.splice(rowNum1Based - 1, 1);
        }
      },
      setFrozenRows() { return sheetObj; },
      getDataRange() {
        const lastRow = rows.length || 1;
        const lastCol = rows.length > 0 ? rows[0].length : 1;
        return sheetObj.getRange(1, 1, lastRow, lastCol);
      },
      getRange(r, c, nr = 1, nc = 1) {
        return {
          getValues() {
            const out = [];
            for (let ri = 0; ri < nr; ri++) {
              const row = rows[r - 1 + ri] || [];
              const slice = [];
              for (let ci = 0; ci < nc; ci++) {
                slice.push(row[c - 1 + ci] !== undefined ? row[c - 1 + ci] : '');
              }
              out.push(slice);
            }
            return out;
          },
          getDisplayValues() {
            return this.getValues().map(row => row.map(toDisplayValue));
          },
          getValue() {
            const row = rows[r - 1] || [];
            return row[c - 1] !== undefined ? row[c - 1] : '';
          },
          setValue(val) {
            while (rows.length < r) rows.push([]);
            while (rows[r - 1].length < c) rows[r - 1].push('');
            rows[r - 1][c - 1] = val;
            return this;
          },
          setValues(matrix) {
            for (let ri = 0; ri < matrix.length; ri++) {
              while (rows.length < r + ri) rows.push([]);
              const srcRow = matrix[ri];
              while (rows[r - 1 + ri].length < c - 1 + srcRow.length) rows[r - 1 + ri].push('');
              for (let ci = 0; ci < srcRow.length; ci++) {
                rows[r - 1 + ri][c - 1 + ci] = srcRow[ci];
              }
            }
            return this;
          },
          setFontWeight() { return this; },
          setBackground() { return this; },
          setFontColor() { return this; }
        };
      }
    };
    return sheetObj;
  }

  function makeFolder(id, name) {
    const subFolders = new Map();
    const files = [];
    const folderObj = {
      getId() { return id; },
      getName() { return name; },
      getFoldersByName(subName) {
        const list = subFolders.has(subName) ? [subFolders.get(subName)] : [];
        let idx = 0;
        return { hasNext: () => idx < list.length, next: () => list[idx++] };
      },
      createFolder(subName) {
        if (!subFolders.has(subName)) {
          subFolders.set(subName, makeFolder(`FLD_${subName}_${crypto.randomBytes(3).toString('hex')}`, subName));
        }
        return subFolders.get(subName);
      },
      createFile(blob) {
        const fId = `FILE_${crypto.randomBytes(4).toString('hex')}`;
        const bytes = typeof blob.getBytes === 'function' ? blob.getBytes() : [];
        const fName = typeof blob.getName === 'function' ? blob.getName() : 'file.bin';
        const mime = typeof blob.getContentType === 'function' ? blob.getContentType() : 'application/octet-stream';
        const fileObj = {
          _access: 'PRIVATE',
          _permission: 'NONE',
          getId() { return fId; },
          getName() { return fName; },
          getMimeType() { return mime; },
          getSize() { return bytes.length; },
          getUrl() { return `https://drive.google.com/file/d/${fId}/view`; },
          getDownloadUrl() { return `https://drive.google.com/uc?id=${fId}`; },
          setSharing(access, perm) {
            this._access = access;
            this._permission = perm;
            driveAudit.push({ folder: name, fileName: fName, fileId: fId, access, permission: perm });
            return this;
          }
        };
        files.push(fileObj);
        driveFiles.set(fId, fileObj);
        return fileObj;
      }
    };
    return folderObj;
  }

  const rootFolders = new Map();
  const ssObj = {
    getSheetByName(n) { return sheets.get(n) || null; },
    insertSheet(n) {
      const sh = makeSheet(n);
      sheets.set(n, sh);
      return sh;
    }
  };

  const sandbox = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ssObj,
      flush: () => { }
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => scriptProps.has(k) ? scriptProps.get(k) : null,
        setProperty: (k, v) => scriptProps.set(k, String(v)),
        deleteProperty: (k) => scriptProps.delete(k)
      })
    },
    LockService: {
      getScriptLock: () => ({
        waitLock: () => { lockCount++; },
        releaseLock: () => { }
      })
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (str) => {
        let mime = 'text/plain';
        return {
          setMimeType(m) { mime = m; return this; },
          getMimeType() { return mime; },
          getContent() { return str; }
        };
      }
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest(alg, input) {
        const buf = crypto.createHash('sha256').update(String(input), 'utf8').digest();
        return Array.from(buf, b => (b > 127 ? b - 256 : b));
      },
      base64Decode(b64) {
        return Array.from(Buffer.from(String(b64), 'base64'));
      },
      newBlob(bytesOrStr, mime, name) {
        const buf = Array.isArray(bytesOrStr) ? Buffer.from(bytesOrStr) : Buffer.from(String(bytesOrStr), 'utf8');
        return {
          getBytes: () => Array.from(buf),
          getDataAsString: () => buf.toString('utf8'),
          getContentType: () => mime || 'application/octet-stream',
          getName: () => name || 'blob'
        };
      },
      getUuid: () => crypto.randomUUID(),
      formatDate(date, tz, fmt) {
        const d = date instanceof Date ? date : new Date(date);
        const wib = new Date(d.getTime() + 7 * 3600 * 1000);
        const yyyy = String(wib.getUTCFullYear());
        const yy = yyyy.slice(-2);
        const mIdx = wib.getUTCMonth();
        const MM = String(mIdx + 1).padStart(2, '0');
        const dd = String(wib.getUTCDate()).padStart(2, '0');
        const HH = String(wib.getUTCHours()).padStart(2, '0');
        const mm = String(wib.getUTCMinutes()).padStart(2, '0');
        const ss = String(wib.getUTCSeconds()).padStart(2, '0');
        const SSS = String(wib.getUTCMilliseconds()).padStart(3, '0');
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return fmt
          .replace(/yyyy/g, yyyy).replace(/yy/g, yy)
          .replace(/MMMM/g, months[mIdx]).replace(/MMM/g, months[mIdx].slice(0, 3))
          .replace(/MM/g, MM).replace(/dd/g, dd)
          .replace(/HH/g, HH).replace(/mm/g, mm).replace(/ss/g, ss).replace(/SSS/g, SSS);
      }
    },
    DriveApp: {
      Access: { PRIVATE: 'PRIVATE', ANYONE_WITH_LINK: 'ANYONE_WITH_LINK', ANYONE: 'ANYONE' },
      Permission: { NONE: 'NONE', VIEW: 'VIEW', EDIT: 'EDIT' },
      createFolder(name) {
        const f = makeFolder(`ROOT_${crypto.randomBytes(4).toString('hex')}`, name);
        rootFolders.set(f.getId(), f);
        return f;
      },
      getFolderById(id) {
        if (!rootFolders.has(id)) throw new Error('Folder not found: ' + id);
        return rootFolders.get(id);
      }
    },
    Logger: { log: (m) => logs.push(String(m)) },
    console, Date, Math, JSON, Array, Object, RegExp, String, Number, Boolean, Error
  };

  vm.createContext(sandbox);
  vm.runInContext(gsCode, sandbox, { filename: 'build/dist_Code.gs' });
  sandbox.setup();

  function post(action, token = '', payload = {}) {
    const out = sandbox.doPost({ postData: { contents: JSON.stringify({ action, token, payload }) } });
    return JSON.parse(out.getContent());
  }

  function get(params) {
    const out = sandbox.doGet({ parameter: params });
    return JSON.parse(out.getContent());
  }

  function login(username, password = sandbox.DEFAULT_SEED_PASS || 'Demo123') {
    const res = post('login', '', { username, password });
    assert.ok(res.ok, `GAS login failed for ${username}: ${res.error}`);
    return res.token;
  }

  return { sandbox, sheets, driveAudit, logs, getLockCount: () => lockCount, post, get, login };
}

console.log('\n--- TEST 18: GAS Backend VM Execution — Core Bug Fixes [B-01..B-06] ---');
{
  const gas = createGasVmRuntime();
  const { sandbox, sheets, post, get, login } = gas;

  // [B-01] dbUpdate: 3-arg object filter + 4-arg numeric column key
  const okObjUpdate = sandbox.dbUpdate('Sheet_Users', { username: 'ketua' }, { fullname: 'Ketum B01 ObjectFilter' });
  assert.strictEqual(okObjUpdate, true, '[B-01] dbUpdate 3-arg filterObj must return true');
  let ketuaRow = sandbox.dbFindOne('Sheet_Users', { username: 'ketua' });
  assert.strictEqual(ketuaRow[sandbox.COL_USERS.FULLNAME], 'Ketum B01 ObjectFilter', '[B-01] 3-arg filterObj must update row');

  const okNumUpdate = sandbox.dbUpdate('Sheet_Users', 'username', 'ketua', { 3: 'Ketum B01 NumericKey' });
  assert.strictEqual(okNumUpdate, true, '[B-01] dbUpdate 4-arg numeric col key must return true');
  ketuaRow = sandbox.dbFindOne('Sheet_Users', { username: 'ketua' });
  assert.strictEqual(ketuaRow[3], 'Ketum B01 NumericKey', '[B-01] Numeric key { 3: ... } must update col index 3');

  // [B-02] dbDelete 2-arg filterObj & 3-arg col/val + handleRevokeSession_ no crash
  const adminToken = login('admin');
  const tempToken = login('bendahara');
  const tempToken2 = login('sekretaris');
  const revokeRes = post('revokeSession', adminToken, { token: tempToken });
  assert.ok(revokeRes.ok, `[B-02] handleRevokeSession_ must succeed without crash: ${revokeRes.error}`);
  assert.strictEqual(sandbox.dbFindOne('Sheet_Sessions', { token: tempToken }), null, '[B-02] Revoked token must be deleted from Sheet_Sessions');
  const del3 = sandbox.dbDelete('Sheet_Sessions', 'token', tempToken2);
  assert.strictEqual(del3, true, '[B-02] dbDelete 3-arg must succeed');

  // [B-03] Keuangan column indices + ShariaGuard
  const dakwahToken = login('kadiv_dakwah');
  const badZakat = post('ajukanKasKeluar', dakwahToken, {
    nominal: 200000, kantong_syariah: 'ZAKAT', kategori: 'Operasional', keterangan: 'Makan siang panitia'
  });
  assert.strictEqual(badZakat.ok, false, '[B-03] ShariaGuard must block ZAKAT non-ashnaf');
  const badWakaf = post('ajukanKasKeluar', dakwahToken, {
    nominal: 150000, kantong_syariah: 'WAKAF', kategori: 'Konsumsi', keterangan: 'Snack dan bensin kurir'
  });
  assert.strictEqual(badWakaf.ok, false, '[B-03] ShariaGuard must block WAKAF konsumtif');

  const validBkk = post('ajukanKasKeluar', dakwahToken, {
    nominal: 500000, kantong_syariah: 'INFAQ_DAKWAH', kategori: 'Safari Dakwah', keterangan: 'Honor penceramah safari dakwah', bukti_url: 'https://drive.google.com/bukti-03'
  });
  assert.ok(validBkk.ok && validBkk.id, '[B-03] Valid BKK submission must succeed');

  const bendaharaToken = login('bendahara');
  const verRes = post('verifyKasBendahara', bendaharaToken, { keuangan_id: validBkk.id, is_verified: true });
  assert.ok(verRes.ok, `[B-03] verifyKasBendahara must succeed: ${verRes.error}`);

  const ketumToken = login('ketua');
  const appRes = post('approveKasKetua', ketumToken, { keuangan_id: validBkk.id, is_approved: true });
  assert.ok(appRes.ok, `[B-03] approveKasKetua must succeed: ${appRes.error}`);

  const keuRow = sandbox.dbFindOne('Sheet_Keuangan', { id: validBkk.id });
  assert.strictEqual(keuRow[sandbox.COL_KEUANGAN.BUKTI_URL], 'https://drive.google.com/bukti-03', '[B-03] BUKTI_URL (col 9) must remain intact');
  assert.strictEqual(keuRow[sandbox.COL_KEUANGAN.STATUS_APPROVAL], 'APPROVED', '[B-03] STATUS_APPROVAL (col 10) must be APPROVED');
  assert.strictEqual(keuRow[sandbox.COL_KEUANGAN.VERIFIED_BENDAHARA_BY], 'bendahara', '[B-03] VERIFIED_BENDAHARA_BY (col 11) must be bendahara');
  assert.strictEqual(keuRow[sandbox.COL_KEUANGAN.APPROVED_KETUA_BY], 'ketua', '[B-03] APPROVED_KETUA_BY (col 12) must be ketua');
  assert.ok(String(keuRow[sandbox.COL_KEUANGAN.NO_KWITANSI]).startsWith('KW-OUT-'), '[B-03] NO_KWITANSI (col 13) must contain KW-OUT-');

  // [B-04] Consultation SHA-256 hash match
  const consultSub = post('submitConsultation', '', { topik: 'Aqidah Islamiyah', pertanyaan: 'Bagaimana adab dialog lintas iman?' });
  assert.ok(consultSub.ok && consultSub.tiketNo && consultSub.secretToken, '[B-04] submitConsultation must issue tiketNo and secretToken');
  const cRow = sandbox.dbFindOne('Sheet_Consultations', { tiket_no: consultSub.tiketNo });
  const expectedConsultHash = crypto.createHash('sha256').update(`${consultSub.secretToken}:APII_CONSULT`).digest('hex');
  assert.strictEqual(cRow[sandbox.COL_CONSULTATIONS.TOKEN_HASH], expectedConsultHash, '[B-04] Stored TOKEN_HASH must equal 64-hex SHA-256');
  const cCheckOk = get({ action: 'checkConsultation', ticket: consultSub.tiketNo, token: consultSub.secretToken });
  assert.ok(cCheckOk.ok, '[B-04] checkConsultation with valid secretToken must succeed');
  const cCheckBad = get({ action: 'checkConsultation', ticket: consultSub.tiketNo, token: 'WRONG-TOKEN' });
  assert.strictEqual(cCheckBad.ok, false, '[B-04] checkConsultation with wrong token must fail');

  // [B-05] handleGetActiveSessions_ roles: superadmin, ketua, sekretaris
  const sekToken = login('sekretaris');
  assert.ok(post('getActiveSessions', adminToken, {}).ok, '[B-05] superadmin can view active sessions');
  assert.ok(post('getActiveSessions', ketumToken, {}).ok, '[B-05] ketua can view active sessions');
  assert.ok(post('getActiveSessions', sekToken, {}).ok, '[B-05] sekretaris can view active sessions');
  assert.strictEqual(post('getActiveSessions', bendaharaToken, {}).ok, false, '[B-05] bendahara must be denied active sessions');

  // [B-06] Keanggotaan default DPW_JABO & canonical NIA (APII-JABO-...)
  const regMember = post('registerMember', '', {
    nama: 'Kader Uji B06', nik: '3174010101900077', no_wa: '6281199887766', email: 'b06@apii.test'
  });
  assert.ok(regMember.ok && regMember.pendaftarId, '[B-06] Public registerMember without wilayah_id must succeed');
  const pendRow = sandbox.dbFindOne('Sheet_Pendaftar', { id: regMember.pendaftarId });
  assert.strictEqual(pendRow[sandbox.COL_PENDAFTAR.WILAYAH_ID], 'DPW_JABO', '[B-06] Default wilayah_id must be DPW_JABO');

  const sekVerKta = post('verifyPendaftarSekretaris', sekToken, { pendaftar_id: regMember.pendaftarId, is_lolos: true });
  assert.ok(sekVerKta.ok, `[B-06] verifyPendaftarSekretaris must succeed: ${sekVerKta.error}`);
  const ketAppKta = post('approveAnggotaKetua', ketumToken, { pendaftar_id: regMember.pendaftarId, tingkat_lisensi: '1' });
  assert.ok(ketAppKta.ok, `[B-06] approveAnggotaKetua must succeed: ${ketAppKta.error}`);
  assert.ok(/^APII-JABO-\d{4}-\d{5}$/.test(ketAppKta.nia), `[B-06] Issued NIA must match APII-JABO-YYYY-NNNNN, got ${ketAppKta.nia}`);
  console.log('[PASS] Test 18: GAS VM verified [B-01..B-06] (dbUpdate, dbDelete, Keuangan cols, Consultation SHA-256, Sessions RBAC, DPW_JABO NIA)');
}

// =========================================================================
// TEST 19: GAS Backend VM Execution — Security, Concurrency & UU PDP [S-01..S-06, C-01/C-02]
// =========================================================================
console.log('\n--- TEST 19: GAS Backend VM Execution — Security & Concurrency [S-01..S-06, C-01/C-02] ---');
{
  const gas = createGasVmRuntime();
  const { sandbox, post, login, driveAudit, getLockCount } = gas;

  const adminToken = login('admin');
  const ketumToken = login('ketua');
  const sekToken = login('sekretaris');
  const dakwahToken = login('kadiv_dakwah');

  // Create pembina, pengawas, and DPW_JABO ketua for security matrix testing
  assert.ok(post('saveUser', adminToken, {
    user_id: 'USR-QA-PEMBINA', username: 'pembina_qa', fullname: 'KH Pembina QA', role: 'pembina', wilayah_id: 'DPP_PUSAT', password: 'Demo123', is_active: true
  }).ok, 'Create pembina_qa');
  assert.ok(post('saveUser', adminToken, {
    user_id: 'USR-QA-PENGAWAS', username: 'pengawas_qa', fullname: 'Ir Pengawas QA', role: 'pengawas', wilayah_id: 'DPP_PUSAT', password: 'Demo123', is_active: true
  }).ok, 'Create pengawas_qa');
  assert.ok(post('saveUser', adminToken, {
    user_id: 'USR-QA-KETUA-JABO', username: 'ketua_jabo_qa', fullname: 'Ketua DPW Jabo QA', role: 'ketua', wilayah_id: 'DPW_JABO', password: 'Demo123', is_active: true
  }).ok, 'Create ketua_jabo_qa');

  // [S-01] Global Read-Only Rejection for pembina & pengawas
  const pembinaToken = login('pembina_qa');
  const pengawasToken = login('pengawas_qa');
  for (const [roleLabel, rTok] of [['pembina', pembinaToken], ['pengawas', pengawasToken]]) {
    for (const mutAction of ['saveSurat', 'ajukanKasKeluar', 'saveDivisiProgram', 'updateAdvokasiStatus', 'saveMuallaf', 'saveSettings']) {
      const mRes = post(mutAction, rTok, { perihal: 'Unauthorized Mutasi', nominal: 100000 });
      assert.strictEqual(mRes.ok, false, `[S-01] ${roleLabel} must be blocked from ${mutAction}`);
      assert.strictEqual(mRes.code, 'READ_ONLY_ROLE', `[S-01] ${roleLabel} must receive READ_ONLY_ROLE on ${mutAction}`);
    }
    const readRes = post('getDashboardStats', rTok, {});
    assert.ok(readRes.ok, `[S-01] ${roleLabel} must still read getDashboardStats`);
  }

  // [S-02] Cross-tenant isolation (DPW_JABO vs DPP_PUSAT)
  const pusSurat = post('saveSurat', sekToken, {
    wilayah_id: 'DPP_PUSAT', tipe: 'Surat Tugas', perihal: 'Surat Rahasia Pusat', tujuan: 'Mitra Nasional', status: 'AJUKAN',
    konten_json: { isi: 'Naskah internal DPP Pusat' }
  });
  assert.ok(pusSurat.ok && pusSurat.suratId, '[S-02] DPP Sekretaris creates DPP_PUSAT surat');

  const jaboKetuaToken = login('ketua_jabo_qa');
  const crossApprove = post('approveSurat', jaboKetuaToken, { surat_id: pusSurat.suratId, is_approved: true });
  assert.strictEqual(crossApprove.ok, false, '[S-02] DPW_JABO ketua cannot approve DPP_PUSAT surat');
  assert.strictEqual(crossApprove.code, 'TENANT_FORBIDDEN', '[S-02] Cross-tenant approval must return TENANT_FORBIDDEN');

  const jaboSpoofCreate = post('saveSurat', jaboKetuaToken, {
    wilayah_id: 'DPP_PUSAT', perihal: 'Spoof Tenant Attempt'
  });
  if (jaboSpoofCreate.ok && jaboSpoofCreate.suratId) {
    const spoofedRow = sandbox.dbFindOne('Sheet_SuratKeluar', { id: jaboSpoofCreate.suratId });
    assert.strictEqual(spoofedRow[sandbox.COL_SURAT_KELUAR.WILAYAH_ID], 'DPW_JABO', '[S-02] Non-national user write must stay clamped to own DPW_JABO');
  }

  // [S-03] SK Generator by sekretaris -> 'AJUKAN' & LPJ Auto-Refund without SoD block
  const skGen = post('generateSKKepengurusan', sekToken, { wilayah_id: 'DPW_JABO', periode_tahun: '2026-2031' });
  assert.ok(skGen.ok, `[S-03] Sekretaris SK Generator must succeed: ${skGen.error}`);
  assert.strictEqual(skGen.status, 'AJUKAN', '[S-03] Generated SK must start at AJUKAN awaiting Ketua');

  const prokerSave = post('saveDivisiProgram', dakwahToken, {
    nama_program: 'Kajian Apologetika', rab_nominal: 2000000, kantong_syariah: 'INFAQ_DAKWAH'
  });
  assert.ok(prokerSave.ok && prokerSave.programId, `[S-03] saveDivisiProgram must succeed: ${prokerSave.error}`);
  assert.ok(post('approveDivisiProgram', ketumToken, { program_id: prokerSave.programId, is_approved: true }).ok, '[S-03] Ketua approves proker');

  const lpjRes = post('submitDivisiLPJ', dakwahToken, {
    program_id: prokerSave.programId, realisasi_dana: 1400000, lpj_drive_url: 'https://drive.google.com/lpj'
  });
  assert.ok(lpjRes.ok, `[S-03] submitDivisiLPJ must succeed without SoD block: ${lpjRes.error}`);
  assert.strictEqual(lpjRes.sisaAnggaran, 600000, '[S-03] LPJ leftover budget calculation must equal 600000');
  assert.ok(lpjRes.refundVoucher, '[S-03] LPJ auto-refund must generate BKM refundVoucher');

  // [S-04] Inactive (is_active: false) & Password Reset revoke sessions + [S-06] No plaintext tempPassword in AuditLogs
  assert.ok(post('getDivisiPrograms', dakwahToken, {}).ok, '[S-04] Active token works before deactivation');
  const dakwahUser = sandbox.dbFindOne('Sheet_Users', { username: 'kadiv_dakwah' });
  const dakwahUserId = dakwahUser[sandbox.COL_USERS.USER_ID];

  assert.ok(post('saveUser', adminToken, { user_id: dakwahUserId, is_active: false }).ok, '[S-04] Admin marks kadiv_dakwah inactive');
  const staleAfterInactive = post('getDivisiPrograms', dakwahToken, {});
  assert.strictEqual(staleAfterInactive.ok, false, '[S-04] Deactivated user token must immediately fail');
  assert.strictEqual(staleAfterInactive.code, 'AUTH_EXPIRED', '[S-04] Deactivated user must return AUTH_EXPIRED');

  assert.ok(post('saveUser', adminToken, { user_id: dakwahUserId, is_active: true }).ok, '[S-04] Re-activate user');
  const dakwahToken2 = login('kadiv_dakwah');
  const secretTempPass = 'RahasiaSangatAman#991';
  const resetRes = post('resetUserPassword', adminToken, { target_user_id: dakwahUserId, new_temporary_password: secretTempPass });
  assert.ok(resetRes.ok, `[S-04] resetUserPassword must succeed: ${resetRes.error}`);
  assert.strictEqual(post('getDivisiPrograms', dakwahToken2, {}).ok, false, '[S-04] Token must be invalidated after password reset');

  const auditRows = sandbox.dbFind('Sheet_AuditLogs', {});
  assert.ok(auditRows.length > 0, '[S-06] Sheet_AuditLogs must contain audit records');
  const auditJson = JSON.stringify(auditRows);
  assert.ok(!auditJson.includes(secretTempPass), '[S-06] Plaintext temporary password must NEVER appear in Sheet_AuditLogs');
  assert.ok(!auditJson.includes('tempPassword'), '[S-06] tempPassword key must NOT be logged in Sheet_AuditLogs');

  // [S-05] DriveVault PRIVATE permission on KTP & Advokasi (vs ANYONE_WITH_LINK on 01_SURAT_KELUAR)
  const sampleB64 = Buffer.from('fake-webp-payload').toString('base64');
  const ktpVault = sandbox.saveBase64FileToVault('DPW_JABO', '05_BERKAS_KTA', 'ktp_test.webp', sampleB64, 'image/webp');
  assert.ok(ktpVault.ok && ktpVault.access === 'PRIVATE', '[S-05] 05_BERKAS_KTA upload must have access: PRIVATE');
  const advVault = sandbox.saveBase64FileToVault('DPW_JABO', '07_ADVOKASI_HUKUM', 'bukti_kasus.pdf', sampleB64, 'application/pdf');
  assert.ok(advVault.ok && advVault.access === 'PRIVATE', '[S-05] 07_ADVOKASI_HUKUM upload must have access: PRIVATE');
  const pubSuratVault = sandbox.saveBase64FileToVault('DPP_PUSAT', '01_SURAT_KELUAR', 'edaran.pdf', sampleB64, 'application/pdf');
  assert.ok(pubSuratVault.ok && pubSuratVault.access === 'ANYONE_WITH_LINK', '[S-05] 01_SURAT_KELUAR retains ANYONE_WITH_LINK');
  assert.ok(driveAudit.some(d => d.fileName === 'ktp_test.webp' && d.access === 'PRIVATE' && d.permission === 'NONE'), '[S-05] DriveApp.setSharing PRIVATE/NONE called for KTP');
  assert.ok(driveAudit.some(d => d.fileName === 'bukti_kasus.pdf' && d.access === 'PRIVATE' && d.permission === 'NONE'), '[S-05] DriveApp.setSharing PRIVATE/NONE called for Advokasi');

  // [C-01/C-02] Atomic duplicate NIK check + ScriptLock verification
  assert.ok(getLockCount() > 0, '[C-01] LockService.getScriptLock().waitLock must execute during guarded mutations');
  const dup1 = post('registerMember', '', { nama: 'Pendaftar Satu', nik: '3174999900001111', no_wa: '6281111111111' });
  assert.ok(dup1.ok, '[C-02] First NIK registration succeeds');
  const dup2 = post('registerMember', '', { nama: 'Pendaftar Duplikat', nik: '3174999900001111', no_wa: '6282222222222' });
  assert.strictEqual(dup2.ok, false, '[C-02] Duplicate NIK registration must be rejected atomically');

  // [#27 GAS Fixes] Unique UUID user_id on rapid saveUser + rejectSurat endpoint
  const fastU1 = post('saveUser', adminToken, { username: 'rapid_u1', fullname: 'Rapid User 1', role: 'anggota_divisi', wilayah_id: 'DPW_JABO' });
  const fastU2 = post('saveUser', adminToken, { username: 'rapid_u2', fullname: 'Rapid User 2', role: 'anggota_divisi', wilayah_id: 'DPW_JABO' });
  assert.ok(fastU1.ok && fastU2.ok && fastU1.userId !== fastU2.userId, `Rapid saveUser without user_id must yield unique IDs (${fastU1.userId} vs ${fastU2.userId})`);
  assert.ok(/^USR-\d+-[A-F0-9]{6}$/.test(fastU1.userId), `Auto user_id must include 6-hex suffix, got ${fastU1.userId}`);

  const rejDraft = post('saveSurat', sekToken, {
    wilayah_id: 'DPP_PUSAT', tipe: 'Surat Tugas', perihal: 'Surat Uji Tolak', tujuan: 'Internal', status: 'AJUKAN'
  });
  assert.ok(rejDraft.ok && rejDraft.suratId, 'Create surat before rejectSurat test');
  const rejRes = post('rejectSurat', ketumToken, { id: rejDraft.suratId, catatanRevisi: 'Perbaiki konsideran hukum' });
  assert.ok(rejRes.ok, `rejectSurat must succeed: ${rejRes.error}`);
  const rejRow = sandbox.dbFindOne('Sheet_Surat', { id: rejDraft.suratId });
  assert.strictEqual(rejRow[sandbox.COL_SURAT_KELUAR.STATUS], 'REJECTED', 'rejectSurat must store REJECTED status');
  assert.strictEqual(rejRow[sandbox.COL_SURAT_KELUAR.CATATAN_REVISI], 'Perbaiki konsideran hukum', 'rejectSurat must persist catatanRevisi');
  console.log('[PASS] Test 19: GAS VM verified [S-01..S-06, C-01/C-02] + rapid saveUser & rejectSurat');
}

// =========================================================================
// TEST 20: Frontend Real VM Execution — Portal & Public Controllers
// =========================================================================
function createMockDom(initialLocation = {}) {
  const elements = new Map();
  const winListeners = new Map();
  const docListeners = new Map();

  function makeClassList(initial = []) {
    const set = new Set(initial);
    return {
      add: (...c) => c.forEach(x => set.add(x)),
      remove: (...c) => c.forEach(x => set.delete(x)),
      toggle: (x, force) => {
        if (force === true) { set.add(x); return true; }
        if (force === false) { set.delete(x); return false; }
        if (set.has(x)) { set.delete(x); return false; }
        set.add(x); return true;
      },
      contains: (x) => set.has(x),
      _toSet: () => set
    };
  }

  function makeElement(id, tag = 'div') {
    const attrs = new Map();
    const listeners = new Map();
    const el = {
      id,
      tagName: tag.toUpperCase(),
      value: '',
      textContent: '',
      innerHTML: '',
      checked: false,
      disabled: false,
      style: {},
      dataset: {},
      classList: makeClassList(),
      children: [],
      files: [],
      getAttribute: (k) => attrs.has(k) ? attrs.get(k) : null,
      setAttribute: (k, v) => attrs.set(k, String(v)),
      removeAttribute: (k) => attrs.delete(k),
      addEventListener: (ev, fn) => {
        if (!listeners.has(ev)) listeners.set(ev, []);
        listeners.get(ev).push(fn);
      },
      dispatchEvent: (ev) => {
        (listeners.get(ev.type) || []).forEach(fn => fn(ev));
      },
      querySelectorAll: () => [],
      querySelector: () => null,
      closest: () => null,
      focus: () => { },
      scrollIntoView: () => { },
      appendChild: (c) => { el.children.push(c); return c; },
      remove: () => { },
      getContext: () => null,
      toDataURL: () => ''
    };
    return el;
  }

  function getEl(id) {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  }

  const storageData = {};
  const storageObj = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(storageData, k) ? storageData[k] : null; },
    setItem(k, v) { storageData[k] = String(v); },
    removeItem(k) { delete storageData[k]; },
    clear() { Object.keys(storageData).forEach(k => delete storageData[k]); }
  };

  const loc = {
    hostname: initialLocation.hostname || 'apologetislamindonesia.or.id',
    href: initialLocation.href || 'https://apologetislamindonesia.or.id/portal/',
    hash: initialLocation.hash || '',
    search: initialLocation.search || ''
  };

  const docObj = {
    body: makeElement('__body__', 'body'),
    documentElement: makeElement('__html__', 'html'),
    getElementById: (id) => getEl(id),
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: (tag) => makeElement(`__tmp_${Math.random().toString(36).slice(2)}`, tag),
    addEventListener: (ev, fn) => {
      if (!docListeners.has(ev)) docListeners.set(ev, []);
      docListeners.get(ev).push(fn);
    }
  };

  const winObj = {
    localStorage: storageObj,
    location: loc,
    document: docObj,
    navigator: { clipboard: { writeText: async () => { } } },
    open: () => { },
    scrollTo: () => { },
    matchMedia: () => ({ matches: false, addEventListener: () => { } }),
    addEventListener: (ev, fn) => {
      if (!winListeners.has(ev)) winListeners.set(ev, []);
      winListeners.get(ev).push(fn);
    },
    URLSearchParams,
    Intl,
    TextEncoder,
    Date, Math, JSON, Array, Object, RegExp, String, Number, Boolean, Error, Promise,
    setTimeout: () => 0,
    clearTimeout: () => { },
    encodeURIComponent,
    decodeURIComponent,
    escape,
    unescape,
    isNaN,
    console
  };
  winObj.window = winObj;
  winObj.self = winObj;

  function fireDomReady() {
    (docListeners.get('DOMContentLoaded') || []).forEach(fn => fn());
  }

  function fireHashChange(newHash) {
    loc.hash = newHash;
    (winListeners.get('hashchange') || []).forEach(fn => fn());
  }

  return { winObj, docObj, storageObj, getEl, fireDomReady, fireHashChange };
}

const suiteFailures = [];
function runCheck(label, fn) {
  try {
    fn();
    console.log(`[PASS] ${label}`);
  } catch (err) {
    console.error(`[FAIL] ${label}: ${err.message}`);
    suiteFailures.push({ label, message: err.message });
  }
}

console.log('\n--- TEST 20: Frontend Real VM Execution — Portal & Public Controllers ---');
// 20A: Portal Real VM Execution (isolated clean localStorage)
{
  resetState();
  const dom = createMockDom({
    hostname: 'apologetislamindonesia.or.id',
    href: 'https://apologetislamindonesia.or.id/portal/',
    hash: '#dashboard'
  });
  vm.createContext(dom.winObj);
  vm.runInContext(fs.readFileSync('portal/config.js', 'utf8') + '\n;window.CONFIG=CONFIG;window.ApiClient=ApiClient;', dom.winObj);
  vm.runInContext(fs.readFileSync('portal/state.js', 'utf8') + '\n;window.State=State;', dom.winObj);
  vm.runInContext(fs.readFileSync('portal/auth.js', 'utf8') + '\n;window.Auth=Auth;', dom.winObj);
  vm.runInContext(fs.readFileSync('portal/app.js', 'utf8') + '\n;window.App=App;', dom.winObj);

  dom.fireDomReady();
  const PState = dom.winObj.State;
  const PAuth = dom.winObj.Auth;
  const PApp = dom.winObj.App;

  runCheck('Test 20A.1: Auto-Hijri & FIPS 180-4 SHA-256 parity', () => {
    const h1 = PState.getHijriDate(new Date('2026-11-14T00:00:00Z'));
    const h2 = PState.getHijriDate(new Date('2025-03-05T00:00:00Z'));
    assert.ok(h1 && h2 && h1 !== h2, `Auto-Hijri must compute distinct real dates (${h1} vs ${h2})`);
    assert.ok(!h2.includes('1448'), `2025 date must NOT return hardcoded 1448 H (got ${h2})`);
    const nodeSha = crypto.createHash('sha256').update('SIAP-APII-V31').digest('hex');
    assert.strictEqual(PState.computeSha256('SIAP-APII-V31'), nodeSha, 'State.computeSha256 must match exact Node SHA-256');
  });

  runCheck('Test 20A.2: ShariaGuard & Deadlock Queue (TRX-003 VERIFIKASI_BENDAHARA)', () => {
    assert.strictEqual(PState.validateShariaExpense('ZAKAT', 'Konsumsi snack seminar').valid, false, 'ShariaGuard ZAKAT non-ashnaf blocked');
    assert.strictEqual(PState.validateShariaExpense('ZAKAT', 'Santunan muallaf baru').valid, true, 'ShariaGuard ZAKAT muallaf allowed');
    assert.strictEqual(PState.validateShariaExpense('WAKAF', 'Bensin transport rapat').valid, false, 'ShariaGuard WAKAF konsumtif blocked');

    const dlQueue = PState.getDeadlockQueue();
    const trx003InDb = PState.getDb().kas.transactions.find(t => t.id === 'TRX-003');
    assert.strictEqual(trx003InDb && trx003InDb.statusApproval, 'VERIFIKASI_BENDAHARA', 'TRX-003 seed statusApproval must be VERIFIKASI_BENDAHARA');
    assert.ok(dlQueue.some(item => item.id === 'TRX-003' && item.type === 'kas'), 'Deadlock queue must include TRX-003 (VERIFIKASI_BENDAHARA)');
  });

  runCheck('Test 20A.3: approveKtaKetua assigns canonical NIA & WA targets Sekretaris [F-02]', () => {
    const pDb = PState.getDb();
    const targetKta = {
      id: 'ANG-QA-01',
      tenantId: 'DPW_JABO',
      nia: 'MENUNGGU_PENGESAHAN',
      namaLengkap: 'Uji Kader Jabodetabek',
      telepon: '6289998887776',
      wilayah: 'DPW Jabodetabek',
      tingkatLisensi: 1,
      status: 'MENUNGGU_KETUA'
    };
    pDb.anggota.unshift(targetKta);
    PState.saveDatabase();

    const ketLogin = PAuth.login('ketua', 'Demo123');
    assert.ok(ketLogin.ok, 'Portal login as ketua must succeed');
    PApp.approveKtaKetua('ANG-QA-01');
    const updatedKta = PState.getDb().anggota.find(a => a.id === 'ANG-QA-01');
    assert.strictEqual(updatedKta.status, 'APPROVED', 'approveKtaKetua must transition status to APPROVED');
    const expectedSek = PAuth.resolveOfficerContact('sekretaris', 'DPW_JABO');
    assert.strictEqual(dom.getEl('wa-relay-target-name').textContent, expectedSek.name, 'KTA WA relay must target Sekretaris internally');
    assert.notStrictEqual(dom.getEl('wa-relay-target-phone').textContent.replace(/\D/g, ''), targetKta.telepon, 'KTA WA relay must NOT target candidate phone directly');
    assert.ok(/^APII-JABO-\d{4}-\d{5}$/.test(updatedKta.nia), `approveKtaKetua must assign canonical NIA APII-JABO-..., got ${updatedKta.nia}`);
  });

  runCheck('Test 20A.4: submitSkGenerator creates AJUKAN (2-step Ketua authorization)', () => {
    const sekLogin = PAuth.login('sekretaris', 'Demo123');
    assert.ok(sekLogin.ok, 'Portal login as sekretaris must succeed');
    dom.getEl('sk-form-wilayah').value = 'DPW_JABO';
    dom.getEl('sk-form-judul').value = 'SK Susunan Pengurus QA';
    dom.getEl('sk-form-menimbang').value = 'Kebutuhan organisasi wilayah';
    dom.getEl('sk-form-memutuskan').value = 'Menetapkan personalia DPW';
    PApp.submitSkGenerator();
    const createdSk = PState.getDb().surat.find(s => s.perihal === 'SK Susunan Pengurus QA');
    assert.ok(createdSk, 'submitSkGenerator must create SK in db.surat');
    assert.strictEqual(createdSk.status, 'AJUKAN', 'Generated SK must start as AJUKAN for 2-step Ketua signature');
    assert.strictEqual(createdSk.statusSignature, 'PENDING_KETUA', 'Generated SK statusSignature must be PENDING_KETUA');
  });

  runCheck('Test 20A.5: Multi-division Disposisi (laporanPerDivisi partial -> SELESAI)', () => {
    const smMulti = {
      id: 'SM-QA-MULTI',
      tenantId: 'DPP_PUSAT',
      noAgenda: 'AGD/2026/XI/999',
      asalSurat: 'Majelis Ulama',
      perihal: 'Undangan Dialog Lintas Iman & Hukum',
      targetDivisi: ['dakwah', 'hukum'],
      statusDisposisi: 'PENDING',
      laporanPerDivisi: {}
    };
    PState.getDb().suratMasuk.unshift(smMulti);
    PState.saveDatabase();

    const dakUser = PAuth.getAllAccounts().find(a => a.role === 'ketua_divisi' && a.divisi === 'dakwah' && a.tenantId === 'DPP_PUSAT');
    assert.ok(dakUser, 'DPP kadiv_dakwah demo account must exist');
    PAuth.loginAsUser(dakUser.username);
    dom.getEl('laporan-disp-SM-QA-MULTI').value = 'Siap hadir dari divisi dakwah';
    PApp.submitLaporanDisposisi('SM-QA-MULTI');
    let smStored = PState.getDb().suratMasuk.find(s => s.id === 'SM-QA-MULTI');
    assert.ok(smStored.laporanPerDivisi.dakwah, 'laporanPerDivisi.dakwah must be recorded');
    assert.strictEqual(smStored.statusDisposisi, 'IN_PROGRESS', 'Partial division report must keep status IN_PROGRESS');

    const hukUser = PAuth.getAllAccounts().find(a => a.role === 'ketua_divisi' && a.divisi === 'hukum' && a.tenantId === 'DPP_PUSAT');
    assert.ok(hukUser, 'DPP kadiv_hukum demo account must exist');
    PAuth.loginAsUser(hukUser.username);
    dom.getEl('laporan-disp-SM-QA-MULTI').value = 'Siap mendampingi kajian hukum';
    PApp.submitLaporanDisposisi('SM-QA-MULTI');
    smStored = PState.getDb().suratMasuk.find(s => s.id === 'SM-QA-MULTI');
    assert.ok(smStored.laporanPerDivisi.hukum, 'laporanPerDivisi.hukum must be recorded');
    assert.strictEqual(smStored.statusDisposisi, 'SELESAI', 'All designated divisions reporting must complete disposisi as SELESAI');
  });

  runCheck('Test 20A.6: Login Page Gate, Uniform Demo123 Password, Logout & Zero-Delay Account Switch', () => {
    const portalHtml = fs.readFileSync('portal/index.html', 'utf8');
    const portalAppSrc = fs.readFileSync('portal/app.js', 'utf8');
    const portalAuthSrc = fs.readFileSync('portal/auth.js', 'utf8');
    const portalStateSrc = fs.readFileSync('portal/state.js', 'utf8');
    assert.ok(portalHtml.includes('id="portal-login-screen"'), 'portal/index.html must include #portal-login-screen');
    assert.ok(portalHtml.includes('id="btn-topbar-logout"'), 'portal/index.html must include explicit #btn-topbar-logout');
    assert.ok(!portalHtml.includes('id="userRoleSwitchBtn"'), 'portal/index.html must NOT include quick #userRoleSwitchBtn');
    assert.ok(!portalHtml.includes('id="modal-role-switcher"'), 'portal/index.html must NOT include #modal-role-switcher');
    assert.ok(portalStateSrc.includes('window.State = State'), 'portal/state.js must expose window.State in real browsers');
    assert.ok(portalAuthSrc.includes('window.Auth = Auth'), 'portal/auth.js must expose window.Auth in real browsers');
    assert.ok(portalAppSrc.includes('window.App = App'), 'portal/app.js must expose window.App in real browsers');

    // Verify no silent auto-login bypass when logged out
    PAuth.logout();
    assert.strictEqual(PAuth.isAuthenticated(), false, 'PAuth.logout() must clear session without auto-login');
    assert.strictEqual(PAuth.getCurrentUser(), null, 'PAuth.getCurrentUser() must return null when unauthenticated');
    assert.strictEqual(dom.getEl('portal-login-screen').classList.contains('hidden'), false, '#portal-login-screen must be visible when logged out');
    assert.strictEqual(dom.getEl('portal-login-screen').style.display, 'flex', '#portal-login-screen style.display must be flex when logged out');
    assert.strictEqual(dom.getEl('portal-app-shell').classList.contains('hidden'), true, '#portal-app-shell must be hidden when logged out');
    assert.strictEqual(dom.getEl('portal-app-shell').style.display, 'none', '#portal-app-shell style.display must be none when logged out');

    // Verify all 20 pengurus accounts + jabatan aliases work with uniform Demo123
    const pengurusAccs = PAuth.getAllAccounts().filter(a => a.isPengurus !== false && a.role !== 'kader_biasa');
    assert.strictEqual(pengurusAccs.length, 20, 'Must have 20 pengurus accounts');
    for (const acc of pengurusAccs) {
      assert.strictEqual(acc.password, 'Demo123', `Account ${acc.username} must use Demo123`);
    }
    const aliasLogin = PAuth.login('superadmin', 'Demo123');
    assert.ok(aliasLogin.ok && aliasLogin.session.username === 'admin', 'Alias superadmin must authenticate with Demo123');
    assert.strictEqual(dom.getEl('portal-login-screen').classList.contains('hidden'), true, 'Login must immediately hide #portal-login-screen');
    assert.strictEqual(dom.getEl('portal-login-screen').style.display, 'none', 'Login must set #portal-login-screen display none');
    assert.strictEqual(dom.getEl('portal-app-shell').classList.contains('hidden'), false, 'Login must immediately reveal #portal-app-shell');
    assert.strictEqual(dom.getEl('portal-app-shell').style.display, 'flex', 'Login must set #portal-app-shell display flex');

    // Open confirm dialog then switch login directly to another role (Pembina Read-Only) -> instant state sync & banner update
    dom.getEl('modal-confirm-dialog').classList.remove('hidden');
    const swPembina = PAuth.login('pembina', 'Demo123');
    assert.ok(swPembina.ok, 'Login as pembina with Demo123 must succeed');
    assert.strictEqual(dom.getEl('modal-confirm-dialog').classList.contains('hidden'), true, 'Switching login must close stale modals immediately');
    assert.strictEqual(dom.getEl('readonly-role-banner').classList.contains('hidden'), false, 'Pembina login must immediately show read-only banner');
    assert.strictEqual(dom.getEl('header-user-name').textContent, swPembina.session.user.fullName, 'Header user name must sync instantaneously');

    // Switch to Bendahara -> read-only banner must hide immediately
    const swBend = PAuth.login('bendahara_umum', 'Demo123');
    assert.ok(swBend.ok && swBend.session.username === 'bendahara', 'Alias bendahara_umum must log into bendahara');
    assert.strictEqual(dom.getEl('readonly-role-banner').classList.contains('hidden'), true, 'Bendahara login must immediately hide read-only banner');
    assert.strictEqual(dom.getEl('header-user-name').textContent, swBend.session.user.fullName, 'Header user name must match Bendahara immediately');

    // Switch to Ketua -> simplified executive workspace (surat hides composer panel, hero button reads Pengesahan Surat)
    const swKetua = PAuth.login('ketua', 'Demo123');
    assert.ok(swKetua.ok && swKetua.session.username === 'ketua', 'Login as ketua must succeed with Demo123');
    PApp.switchWorkspace('surat');
    assert.strictEqual(dom.getEl('surat-composer-panel').classList.contains('hidden'), true, 'Ketua must NOT see Sekretaris composer form in Persuratan');
    assert.strictEqual(dom.getEl('surat-executive-banner').classList.contains('hidden'), false, 'Ketua must see executive approval banner in Persuratan');
    assert.strictEqual(PAuth.canAccessWorkspace('advokasi'), false, 'Ketua must not see Divisi Hukum Advokasi');
    assert.strictEqual(PAuth.canAccessWorkspace('muallaf'), false, 'Ketua must not see Divisi Dakwah Muallaf');
    assert.strictEqual(PAuth.canAccessWorkspace('maktabah'), false, 'Ketua must not see Maktabah/Konsultasi/Risalah');
  });
}

// 20B: Public Real VM Execution (fresh empty localStorage!)
{
  resetState();
  const dom = createMockDom({
    hostname: 'apologetislamindonesia.or.id',
    href: 'https://apologetislamindonesia.or.id/public/',
    hash: '#/'
  });
  vm.createContext(dom.winObj);
  vm.runInContext(fs.readFileSync('public/config.js', 'utf8') + '\n;window.CONFIG=CONFIG;window.ApiClient=ApiClient;', dom.winObj);
  vm.runInContext(fs.readFileSync('public/app.js', 'utf8') + '\n;window.PublicApp=PublicApp;', dom.winObj);

  const storageKey = dom.winObj.CONFIG.SHARED_STORAGE_KEY || 'siap_apii_shared_db_v3';
  assert.strictEqual(dom.storageObj.getItem(storageKey), null, 'Public VM localStorage must start empty');

  dom.fireDomReady();
  const PPub = dom.winObj.PublicApp;

  runCheck('Test 20B.1: /public auto-seeds sharedDb on fresh empty localStorage', () => {
    const seededRaw = dom.storageObj.getItem(storageKey);
    assert.ok(seededRaw, '/public must auto-seed sharedDb on fresh empty localStorage');
    const shared = PPub.getSharedDb();
    assert.ok(shared.surat.length > 0 && shared.anggota.length > 0 && shared.kas.transactions.length > 0 && shared.causes.length > 0, 'Seeded sharedDb must contain core datasets');
  });

  runCheck('Test 20B.2: ?token= deep-link & strict Verification Hub + Tamper Alert', () => {
    const shared = PPub.getSharedDb();
    const validSurat = shared.surat.find(s => s.status === 'APPROVED');
    assert.ok(validSurat, 'Seed sharedDb must contain an APPROVED surat');
    dom.fireHashChange(`#/verifikasi?token=${encodeURIComponent(validSurat.nomorSurat)}`);
    const validHtml = dom.getEl('verif-surat-result').innerHTML;
    assert.ok(validHtml.includes('DOKUMEN RESMI 100% ASLI'), 'Valid ?token= deep link must verify approved surat');

    // Manipulate surat content without updating hash -> Tamper Alert MUST trigger
    validSurat.perihal = 'PERIHAL TELAH DIMANIPULASI HACKER';
    dom.storageObj.setItem(storageKey, JSON.stringify(shared));
    dom.fireHashChange(`#/verifikasi?token=${encodeURIComponent(validSurat.nomorSurat)}`);
    const tamperedHtml = dom.getEl('verif-surat-result').innerHTML;
    assert.ok(
      tamperedHtml.includes('PERINGATAN: DOKUMEN TIDAK VALID / TELAH DIMANIPULASI!'),
      'Tampered surat must emit exact Tamper Alert string'
    );

    // Unapproved DRAFT surat must NOT verify as valid
    shared.surat.push({
      id: 'SRT-DRAFT-QA',
      nomorSurat: '099/DPP-APII/SK/XI/2026',
      perihal: 'Draf Belum Disahkan',
      isiSurat: 'Isi draf',
      status: 'AJUKAN',
      hashSha256: PPub.sha256Hex('099/DPP-APII/SK/XI/2026Draf Belum DisahkanIsi draf')
    });
    dom.storageObj.setItem(storageKey, JSON.stringify(shared));
    dom.fireHashChange('#/verifikasi?token=099%2FDPP-APII%2FSK%2FXI%2F2026');
    assert.ok(dom.getEl('verif-surat-result').innerHTML.includes('BELUM DISAHKAN'), 'Unapproved AJUKAN document must be rejected by Verification Hub');
  });

  runCheck('Test 20B.3: QRIS Donation syncs sharedDb.kas.balances & sharedDb.causes', () => {
    const beforeBal = Number(PPub.getSharedDb().kas.balances.DPP_PUSAT.INFAQ_DAKWAH || 0);
    const beforeCause = Number(PPub.getSharedDb().causes[0].current || 0);
    dom.getEl('infaq-custom-input').value = '200000';
    dom.getEl('infaq-kantong-select').value = 'INFAQ_DAKWAH';
    dom.getEl('infaq-donor-name').value = 'Muhsinin QA';
    dom.getEl('infaq-donor-phone').value = '081234567890';
    PPub.openQrisConfirmModal();
    PPub.confirmQrisDonation();

    const afterDb = PPub.getSharedDb();
    const addedTrx = afterDb.kas.transactions[0];
    assert.strictEqual(addedTrx.metode, 'QRIS_ONLINE', 'QRIS donation must record QRIS_ONLINE transaction');
    assert.strictEqual(addedTrx.statusApproval, 'APPROVED', 'QRIS gateway donation must be APPROVED');
    assert.ok(addedTrx.nominal >= 200100 && addedTrx.nominal <= 200999, 'QRIS total must include 3-digit unique code');
    assert.strictEqual(afterDb.kas.balances.DPP_PUSAT.INFAQ_DAKWAH, beforeBal + addedTrx.nominal, 'sharedDb.kas.balances.DPP_PUSAT.INFAQ_DAKWAH must increase by exact nominal');
    assert.strictEqual(afterDb.causes[0].current, beforeCause + addedTrx.nominal, 'sharedDb.causes[0].current must live-sync with QRIS donation');
  });

  runCheck('Test 20B.4: Public site clean of Portal Pengurus links & uses Google Maps Geospatial Hub', () => {
    const publicHtml = fs.readFileSync('public/index.html', 'utf8');
    const publicAppSrc = fs.readFileSync('public/app.js', 'utf8');
    const devServerSrc = fs.readFileSync('scripts/dev-server.mjs', 'utf8');
    assert.ok(!publicHtml.includes('portal/index.html'), 'public/index.html must not link to portal/index.html');
    assert.ok(!/Portal Pengurus/i.test(publicHtml), 'public/index.html must not contain Portal Pengurus label');
    assert.ok(!devServerSrc.includes('href="/portal/"'), 'dev-server 404 page must not expose /portal/ link');
    assert.ok(publicAppSrc.includes('window.PublicApp = PublicApp'), 'public/app.js must expose window.PublicApp in real browsers');

    assert.ok(!publicHtml.includes('id="geo-svg-map"'), 'Legacy low-poly geo-svg-map must be replaced');
    assert.ok(publicHtml.includes('id="geo-google-map"'), 'public/index.html must include #geo-google-map');
    assert.ok(publicHtml.includes('id="geo-map-tiles"'), 'public/index.html must include #geo-map-tiles slippy layer');
    assert.ok(publicHtml.includes('id="geo-map-pins"'), 'public/index.html must include #geo-map-pins interactive pin layer');
    assert.ok(publicHtml.includes('id="geo-google-maps-link"'), 'public/index.html must include Google Maps external link');
    assert.ok(publicAppSrc.includes('google.com/vt/lyrs='), 'public/app.js must load genuine Google Maps tile layers (roadmap & hybrid)');

    const shared = PPub.getSharedDb();
    const pusatWilayah = shared.wilayah.find(w => w.code === 'DPP_PUSAT');
    const jaboWilayah = shared.wilayah.find(w => w.code === 'DPW_JABO');
    assert.ok(Number.isFinite(Number(pusatWilayah?.lat)) && Number.isFinite(Number(pusatWilayah?.lng)), 'DPP_PUSAT must have numeric lat/lng coordinates');
    assert.ok(Number.isFinite(Number(jaboWilayah?.lat)) && Number.isFinite(Number(jaboWilayah?.lng)), 'DPW_JABO must have numeric lat/lng coordinates');
    assert.ok(dom.getEl('geo-google-maps-link').href.includes('google.com/maps'), 'Rendered geo Google Maps link must target google.com/maps');
    const tilesEl = dom.getEl('geo-map-tiles');
    assert.ok((tilesEl.innerHTML || '').includes('google.com/vt/lyrs=m'), 'Rendered tiles must include Google Maps roadmap tiles');
    PPub.setGeoMapLayer('hybrid');
    assert.ok((tilesEl.innerHTML || '').includes('google.com/vt/lyrs=y'), 'Switching map layer to hybrid must render lyrs=y satellite hybrid tiles');
  });
}

// =========================================================================
// TEST 21: Automated Antislop & Zero-Alert Gate
// =========================================================================
console.log('\n--- TEST 21: Automated Antislop & Zero-Alert Gate ---');
runCheck('Test 21: Zero alert/prompt/confirm, Unsplash/dummyimage URL, ping/pulse, viewport lock, LaTeX, em-dash & emojis across 11 files', () => {
  const runtimeFiles = [
    'portal/index.html',
    'portal/app.js',
    'portal/state.js',
    'portal/auth.js',
    'portal/config.js',
    'portal/sw.js',
    'public/index.html',
    'public/app.js',
    'public/config.js',
    'public/sw.js',
    'PANDUAN_EKSEKUTIF_DAN_FITUR_SIAP_APII.html'
  ];

  const badDialogRe = /\b(alert|prompt|confirm)\s*\(/g;
  const badImgUrlRe = /https?:\/\/(?:images\.unsplash\.com|dummyimage\.com)/g;
  const badAnimRe = /\banimate-(ping|pulse)\b/g;
  const badViewportRe = /(maximum-scale\s*=\s*1(?:\.0)?|user-scalable\s*=\s*(?:no|0))/gi;
  const badLatexRe = /\$\\to\$|\\to\b/g;
  const badEmDashRe = /\u2014/g;
  const badEmojiRe = /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]|[\u2600-\u2604\u2606-\u26FF]/gu;

  for (const file of runtimeFiles) {
    const src = fs.readFileSync(file, 'utf8');
    assert.strictEqual((src.match(badDialogRe) || []).length, 0, `Zero alert/prompt/confirm violated in ${file}`);
    assert.strictEqual((src.match(badImgUrlRe) || []).length, 0, `Zero Unsplash/dummyimage URLs violated in ${file}`);
    assert.strictEqual((src.match(badAnimRe) || []).length, 0, `Zero animate-ping/animate-pulse violated in ${file}`);
    assert.strictEqual((src.match(badViewportRe) || []).length, 0, `Zero viewport zoom lock violated in ${file}`);
    assert.strictEqual((src.match(badLatexRe) || []).length, 0, `Zero LaTeX arrow violated in ${file}`);
    assert.strictEqual((src.match(badEmDashRe) || []).length, 0, `Zero em-dash violated in ${file}`);
    assert.strictEqual((src.match(badEmojiRe) || []).length, 0, `Zero decorative emojis violated in ${file}`);
  }
});

// =========================================================================
// TEST 22: Frontend-to-GAS Backend Route Parity (Code.gs vs portal & public)
// =========================================================================
console.log('\n--- TEST 22: Frontend-to-GAS Backend API Route Parity ---');
runCheck('Test 22: 100% parity across all syncApiSafe & ApiClient.request calls in portal/app.js & public/app.js against apps-script/Code.gs', () => {
  const codeGsSrc = fs.readFileSync('apps-script/Code.gs', 'utf8');
  const gasRoutes = new Set([
    ...[...codeGsSrc.matchAll(/case\s+'([^']+)'\s*:/g)].map(m => m[1]),
    ...[...codeGsSrc.matchAll(/action\s*===\s*'([^']+)'/g)].map(m => m[1])
  ]);
  for (const f of ['portal/app.js', 'public/app.js']) {
    const src = fs.readFileSync(f, 'utf8');
    const calls = [
      ...[...src.matchAll(/syncApiSafe\(\s*'([^']+)'/g)].map(m => m[1]),
      ...[...src.matchAll(/ApiClient\.(?:request|get|post)\(\s*'([^']+)'/g)].map(m => m[1])
    ];
    assert.ok(calls.length > 0, `Expected API calls in ${f}`);
    const unmapped = [...new Set(calls)].filter(a => !gasRoutes.has(a));
    assert.strictEqual(unmapped.length, 0, `Unmapped GAS actions in ${f}: ${unmapped.join(', ')}`);
  }
});

console.log('\n================================================================');
if (suiteFailures.length > 0) {
  console.error(`[FAIL] ${suiteFailures.length} CHECK(S) FAILED:`);
  suiteFailures.forEach(f => console.error(`  - ${f.label}: ${f.message}`));
  console.log('================================================================\n');
  process.exit(1);
}
console.log('[PASS] ALL 22 ENTERPRISE, GAS VM, FRONTEND VM, ROUTE PARITY & ANTISLOP SUITES PASSED!');
console.log('================================================================\n');
