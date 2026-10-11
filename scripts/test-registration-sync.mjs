// Uji verifikasi kontras mode gelap dan sinkronisasi status pendaftaran
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

console.log('== 1. Kontras Mode Gelap Modal Pendaftaran & Tanda Terima ==');

const css = readFileSync('public/style.css', 'utf-8');
const html = readFileSync('public/index.html', 'utf-8');
const appJs = readFileSync('public/app.js', 'utf-8');
const portalJs = readFileSync('portal/portal.js', 'utf-8');

// A. CSS Dark Mode Rules
check('CSS memiliki aturan latar belakang gelap #regModalDialog', css.includes('html.dark #regModalDialog') && css.includes('#0C1A14 !important;'));
check('CSS memiliki aturan judul modal gelap #FFFFFF', css.includes('html.dark #regModalDialog h4') && css.includes('#FFFFFF !important;'));
check('CSS memiliki aturan label modal gelap #E2E8F0', css.includes('html.dark #regModalDialog label') && css.includes('#E2E8F0 !important;'));
check('CSS memiliki aturan teks paragraf dan persetujuan #CBD5E1', css.includes('#regAgreementText') && css.includes('#CBD5E1 !important;'));
check('CSS memiliki aturan kartu UU PDP di mode gelap', css.includes('html.dark #regModalDialog .bg-gradient-to-r.from-emerald-50'));
check('CSS memiliki aturan kotak upload foto di mode gelap', css.includes('html.dark #regModalDialog .border-dashed'));
check('CSS menyertakan input[type="date"] dengan color-scheme: dark', css.includes('html.dark input[type="date"]') && css.includes('color-scheme: dark'));
check('CSS memiliki styling mode gelap tanda terima #regReceiptModal', css.includes('html.dark #regReceiptModal #receiptContent') && css.includes('html.dark #regReceiptModal #closeReceiptBtn'));

// B. HTML Dark Mode Classes
check('HTML #regModalDialog memiliki dark:bg-[#0C1A14]', html.includes('id="regModalDialog"') && html.includes('dark:bg-[#0C1A14]'));
check('HTML Kartu UU PDP memiliki dark:from-[#10241B]', html.includes('dark:from-[#10241B]'));
check('HTML form labels memiliki dark:text-gray-200', html.includes('dark:text-gray-200'));
check('HTML #regClosedStateBox memiliki dark styling', html.includes('id="regClosedStateBox"') && html.includes('dark:bg-amber-950/60'));
check('HTML #regReceiptModal memiliki dark:bg-[#0C1A14]', html.includes('id="regReceiptModal"') && html.includes('dark:bg-[#0C1A14]'));

console.log('\n== 2. Mesin Sinkronisasi Bersama (RFC 6265 Cookie & Storage) ==');

// C. Portal Pengurus Sync
check('Portal memiliki fungsi setSharedConfig', portalJs.includes('setSharedConfig: function'));
check('Portal memiliki fungsi getSharedConfig', portalJs.includes('getSharedConfig: function'));
check('Portal menyimpan apii_registration_config ke shared config', portalJs.includes("self.setSharedConfig('apii_registration_config', regConfigPayload);"));
check('Portal menyimpan apii_reg_status ke shared config', portalJs.includes("self.setSharedConfig('apii_reg_status', selectedStatus);"));
check('Portal menyimpan apii_public_config ke shared config', portalJs.includes("self.setSharedConfig('apii_public_config', payload.public_config);"));
check('Portal merespon perubahan radio button status secara instan', portalJs.includes("radio.addEventListener('change'") && portalJs.includes("self.setSharedConfig('apii_reg_status', val);"));
check('Portal merespon perubahan toggle visibilitas RBAC secara instan', portalJs.includes("pubRegCheckbox.addEventListener('change'") && portalJs.includes("self.setSharedConfig('apii_show_registration', this.checked ? '1' : '0');"));

// D. Portal Publik Sync
check('Public App memiliki fungsi setSharedConfig', appJs.includes('setSharedConfig: function'));
check('Public App memiliki fungsi getSharedConfig', appJs.includes('getSharedConfig: function'));
check('Public App membaca apii_registration_config dari shared config', appJs.includes("self.getSharedConfig('apii_registration_config')"));
check('Public App membaca apii_reg_status dari shared config', appJs.includes("self.getSharedConfig('apii_reg_status')"));
check('Public App mendengarkan visibilitychange untuk auto-sync', appJs.includes("window.addEventListener('visibilitychange'"));
check('Public App mendengarkan focus untuk auto-sync', appJs.includes("window.addEventListener('focus'"));
check('Public App mendengarkan storage untuk auto-sync', appJs.includes("window.addEventListener('storage'"));
check('Public App melakukan polling cookie setiap 1.5 detik untuk sync lintas port', appJs.includes("setInterval") && appJs.includes("self.getSharedConfig('apii_reg_status')"));
check('Public App memulihkan visibilitas tombol saat show_registration diaktifkan', appJs.includes("deskBox.classList.remove('hidden')") && appJs.includes("mobBox.classList.remove('hidden')"));

// E. Backend Sync Support
const backendGs = readFileSync('apps-script/Backend.gs', 'utf-8');
const utilsGs = readFileSync('gas/Utils.gs', 'utf-8');
check('Backend.gs getPublicSettings membaca registration_status mandiri', backendGs.includes("getSettingValue_('registration_status', null)"));
check('Backend.gs getPublicSettings membaca allow_public_registration mandiri', backendGs.includes("getSettingValue_('allow_public_registration', null)"));
check('gas/Utils.gs getPublicSettings membaca registration_status mandiri', utilsGs.includes("getSettingValue_('registration_status', null)"));
check('gas/Utils.gs getPublicSettings membaca allow_public_registration mandiri', utilsGs.includes("getSettingValue_('allow_public_registration', null)"));

console.log('\n== 3. Kepatuhan Bebas Karakter Em Dash ==');
const emDash = '\u2014';
check('public/style.css bebas karakter em dash', !css.includes(emDash));
check('public/index.html bebas karakter em dash', !html.includes(emDash));
check('public/app.js bebas karakter em dash', !appJs.includes(emDash));
check('portal/portal.js bebas karakter em dash', !portalJs.includes(emDash));

console.log(`\nHasil Pengujian: ${pass} lulus, ${fail} gagal.`);
if (fail > 0) process.exit(1);
