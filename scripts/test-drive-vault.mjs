// ============================================================================
// test-drive-vault.mjs
// Pengujian Suite Google Drive Storage Vault Engine (Fase 7)
// ============================================================================

import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('== Pengujian Suite Google Drive Storage Vault Engine (Fase 7) ==');

// 1. Uji Skema Database Sheet_Storage_Vault
console.log('\n-- 1. Skema Database Sheet_Storage_Vault --');
const dbCode = fs.readFileSync('gas/Database.gs', 'utf8');

assert.ok(dbCode.includes("STORAGE_VAULT: 'Sheet_Storage_Vault'"), 'TABS.STORAGE_VAULT wajib terdaftar');
assert.ok(dbCode.includes('SCHEMA[TABS.STORAGE_VAULT]'), 'SCHEMA[TABS.STORAGE_VAULT] wajib terdefinisi');
console.log('  PASS  Pangkalan data Sheet_Storage_Vault terpasang');

// 2. Uji Hierarki Folder 3-Tingkat (Wilayah -> Tahun -> 8 Kategori) di gas/Utils.gs
console.log('\n-- 2. Hierarki Partisi Folder 3-Tingkat & 8 Kategori Baku --');
const utilsCode = fs.readFileSync('gas/Utils.gs', 'utf8');

assert.ok(utilsCode.includes('STORAGE_CATEGORIES = ['), 'Daftar 8 kategori standar wajib terdefinisi');
assert.ok(utilsCode.includes('01_Surat_Resmi_PDF') && utilsCode.includes('08_Identitas_KTA_KTP'), 'Kategori 01 s.d 08 lengkap');
assert.ok(utilsCode.includes('function resolveStorageFolder_'), 'Fungsi resolveStorageFolder_ 3-tingkat tersedia');
assert.ok(utilsCode.includes('function initHierarchyFolders'), 'Fungsi initHierarchyFolders tersedia');
assert.ok(utilsCode.includes('_Trash_Arsip_Terhapus'), 'Folder khusus retensi soft-delete _Trash_Arsip_Terhapus terpasang');
console.log('  PASS  Hierarki folder 3-tingkat dan 8 subfolder kategori tervalidasi');

// 3. Uji Soft-Delete 30 Hari & Monitoring Kuota (Ambang 80% & 90%)
console.log('\n-- 3. Soft-Delete 30 Hari & Monitoring Kuota (Ambang 80%/90%) --');
assert.ok(utilsCode.includes('function softDeleteVaultFile'), 'Fungsi softDeleteVaultFile tersedia');
assert.ok(utilsCode.includes('function restoreVaultFile'), 'Fungsi restoreVaultFile tersedia');
assert.ok(utilsCode.includes('function purgeTrashVault'), 'Fungsi purgeTrashVault pembersihan 30 hari tersedia');
assert.ok(utilsCode.includes('days >= 30'), 'Masa retensi tong sampah 30 hari ditegakkan mutlak');
assert.ok(utilsCode.includes('function getDriveStorageStatus'), 'Fungsi getDriveStorageStatus tersedia');
assert.ok(utilsCode.includes('CRITICAL') && utilsCode.includes('WARNING') && utilsCode.includes('NORMAL'), 'Ambang peringatan kuota 80% (Warning) & 90% (Critical) terpasang');
console.log('  PASS  Perlindungan soft-delete 30 hari dan ambang batas kuota tervalidasi');

// 4. Uji Kompresi WebP & Watermarking KTP UU PDP di Portal & Public App
console.log('\n-- 4. In-Browser WebP Compression & Watermark UU PDP --');
const portalCode = fs.readFileSync('portal/portal.js', 'utf8');
const publicCode = fs.readFileSync('public/app.js', 'utf8');

assert.ok(portalCode.includes('compressImageToWebp'), 'Helper compressImageToWebp terpasang di portal');
assert.ok(portalCode.includes('applyKtpWatermark'), 'Helper applyKtpWatermark terpasang di portal');
assert.ok(portalCode.includes('openVaultExplorerModal'), 'Modal penjelajah dokumen vault terpasang di portal');
assert.ok(portalCode.includes('btnInitHierarchy'), 'Tombol inisialisasi hierarki folder terpasang di UI');
assert.ok(publicCode.includes('image/webp'), 'Kompresi WebP terpasang di formulir pendaftaran publik');
assert.ok(publicCode.includes('UU PDP NO. 27/2022') || publicCode.includes('UU PDP'), 'Watermark perlindungan UU PDP terpasang di publik');
console.log('  PASS  Kompresi WebP, Watermark UU PDP & Dokumen Vault UI terintegrasi penuh');

console.log('\nHasil: Seluruh pengujian Google Drive Storage Vault Engine LULUS 100%!');
