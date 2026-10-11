# Catatan Rilis SIAP APII v2.6.2

**Sistem Informasi & Administrasi Terpadu Yayasan APII DPW Jabodetabek**  
*Tanggal Rilis: 11 Oktober 2026*

---

## 1. Ringkasan Pembaruan

Versi 2.6.2 memperbaiki dua masalah operasional kritis:

1. **Teks modal pendaftaran tidak terbaca di mode gelap** karena warna teks sama dengan latar belakang.
2. **Pengaturan buka/tutup pendaftaran di Portal Pengurus tidak tersinkronisasi** ke Portal Publik, sehingga perubahan status di panel admin tidak mempengaruhi formulir pendaftaran calon anggota.

---

## 2. Rincian Pembaruan

### 2.1 Perbaikan Kontras Mode Gelap Modal Pendaftaran (WCAG AA)

Seluruh elemen di modal pendaftaran (`#regModalDialog`) dan tanda terima digital (`#regReceiptModal`) kini memiliki kontras yang memadai (rasio > 4.5:1) saat portal dalam mode gelap:

| Elemen | Warna Lama | Warna Baru |
| :--- | :--- | :--- |
| Judul section & heading | Tidak terdefinisi (hitam di latar gelap) | `#FFFFFF` |
| Label form & teks utama | Tidak terdefinisi | `#E2E8F0` |
| Paragraf, keterangan, persetujuan | Tidak terdefinisi | `#CBD5E1` |
| Latar belakang modal | Tidak terdefinisi | `#0C1A14` |
| Kartu UU PDP (Perlindungan Data Pribadi) | `from-emerald-50` (terang) | `#10241B` dengan border `#1E3D30` |
| Kotak upload KTP & pas foto | Warna terang | `#10241B` border `#2A4D40` |
| Input date, select option | Tanpa `color-scheme: dark` | Ditambahkan `color-scheme: dark` |
| Tombol Batal | Abu-abu terang | `#CBD5E1` dengan hover `#10241B` |
| Alert box (sukses/error) | Warna terang | Varian gelap: merah `#2D0F0F`, hijau `#062818` |
| Notice pendaftaran ditutup | Kuning terang | `#231B0D` border `#78350F` teks `#FDE68A` |
| Tanda terima: latar, teks, tombol | Warna terang | Varian gelap konsisten dengan palet utama |

**File yang diubah:**
- `public/style.css` — 158+ baris CSS dark mode baru
- `public/index.html` — Inline dark classes pada 20+ elemen modal

### 2.2 Mesin Sinkronisasi Pengaturan Lintas Port (RFC 6265 Cookie + Storage)

Pengaturan pendaftaran yang diubah di Portal Pengurus (`:3000`) kini langsung berdampak pada Portal Publik (`:3001`) tanpa reload manual.

**Mekanisme:**

```
Portal Pengurus (:3000)                Portal Publik (:3001)
    setSharedConfig()     ─── cookie ───>   getSharedConfig()
         │                                       │
    localStorage ────── storage event ──────> loadPublicConfig()
         │                                       │
    radio/toggle change ── polling 1.5s ──> auto-refresh UI
```

**Kunci konfigurasi bersama:**
- `apii_reg_status` — Status pendaftaran (`BUKA`/`DITUTUP`/`PENUH`/`SELEKSI`)
- `apii_reg_is_open` — Flag boolean buka/tutup
- `apii_registration_config` — Objek konfigurasi lengkap (kuota, divisi, dll.)
- `apii_show_registration` — Visibilitas menu pendaftaran (RBAC)
- `apii_public_config` — Konfigurasi publik umum

**Sinkronisasi otomatis di Portal Publik:**
- `visibilitychange` — Saat tab browser mendapatkan fokus kembali
- `focus` — Saat jendela browser mendapatkan fokus
- `storage` — Saat localStorage berubah dari tab lain
- Polling cookie setiap 1.5 detik — Mendeteksi perubahan lintas port (cookie dibagikan antar port pada hostname yang sama per RFC 6265)

**Sinkronisasi instan di Portal Pengurus:**
- Perubahan radio button status pendaftaran langsung menulis ke cookie dan menampilkan toast konfirmasi
- Perubahan toggle visibilitas RBAC langsung menulis ke cookie

**File yang diubah:**
- `portal/portal.js` — Fungsi `setSharedConfig`/`getSharedConfig`, handler radio & toggle instan
- `public/app.js` — Fungsi `setSharedConfig`/`getSharedConfig`, `loadPublicConfig` dengan auto-sync
- `gas/Utils.gs` — Backend membaca `registration_status` dan `allow_public_registration` mandiri

### 2.3 Perbaikan Kompatibilitas Parser Google Apps Script & Pembersihan Karakter

1. **Pemecahan String Multi-Baris Pendek:** Teks salam sambutan `greeting` di `DEFAULT_EDITORIAL_` yang sebelumnya berupa baris tunggal 405 karakter dipecah menjadi 5 baris pendek terkatung (< 120 karakter) dengan operator `+`. Ini mencegah *hard line-wrap* otomatis oleh clipboard atau editor web Apps Script yang memicu error `Syntax error: Unterminated string literal. line: 638`.
2. **Ejaan Baku KBBI Tanpa Apostrof:** Menyeragamkan ejaan kata salam menjadi `Assalamualaikum` (tanpa tanda apostrof `'` maupun *escape* `\'`) pada `gas/Utils.gs` dan `gas/Auth.gs` guna mengeliminasi ambiguitas tokenizer.
3. **Keluaran UTF-8 Murni Tanpa BOM:** Skrip `build-apps-script.ps1` diperbarui agar menghasilkan berkas `.gs` dalam format UTF-8 murni tanpa Byte Order Mark (`\uFEFF`) yang dapat mengacaukan interpreter Apps Script.
4. **Pembersihan Em Dash Komentar:** Seluruh karakter em dash (`—`) dan en dash (`–`) di seluruh berkas `gas/*.gs` dinormalisasi menjadi tanda strip `-` ASCII standar.

### 2.4 Cache-Busting v2.6.2

Query parameter versi `?v=2.6.2` diperbarui pada seluruh stylesheet dan skrip JavaScript di `portal/index.html` (5 file) dan `public/index.html` (3 file).

---

## 3. Hasil Pengujian

| Suite | Jumlah | Hasil |
| :--- | :--- | :--- |
| Sanitasi & RBAC Redaksi | 30 | LULUS |
| Rendering Portal Publik | 42 | LULUS |
| Sinkronisasi Pendaftaran & Kontras | 37 | LULUS |
| **Total** | **109** | **109 LULUS, 0 GAGAL** |

---

## 4. File yang Dimodifikasi

| File | Perubahan | Baris |
| :--- | :--- | :--- |
| `public/style.css` | CSS dark mode modal pendaftaran & tanda terima | +158 |
| `public/index.html` | Inline dark classes, cache-bust v2.6.2 | ~114 |
| `public/app.js` | SharedConfig engine, auto-sync listeners | +163 |
| `portal/portal.js` | SharedConfig engine, radio/toggle sync handlers | +160 |
| `gas/Utils.gs` | Backend status mandiri | +16 |
| `portal/index.html` | Cache-bust v2.6.2 | ~5 |
| `package.json` | Versi 2.6.1 -> 2.6.2 | 1 |
| `scripts/test-registration-sync.mjs` | Suite pengujian baru (37 tes) | baru |

---

## 5. Instruksi Deploy

1. **Build Apps Script:** `npm run build:gas`
2. **Salin** `apps-script/Backend.gs` ke editor Apps Script (ganti seluruh isi file `Backend.gs` yang ada)
3. **Deploy ulang** sebagai Web App (New Deployment / Manage Deployments > versi baru)
4. Portal statis (`portal/` dan `public/`) otomatis terdeploy via Vercel CI/CD pada push ke `main`
