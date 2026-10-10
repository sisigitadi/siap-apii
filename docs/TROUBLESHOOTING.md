# Troubleshooting — SIAP APII

Daftar error yang paling sering muncul saat pemasangan pertama + cara memperbaikinya.

---

## 1. `Auth is not defined` / `Database is not defined`

**Penyebab:** Anda menempatkan kode `gas/` lama (yang memakai pola `Auth.login(...)`) ke Apps Script.

**Solusi:** Pakai file-file hasil build di `apps-script/*.gs` — di dalamnya pola tersebut sudah diganti jadi pemanggilan global. Jangan salin file-file di folder `gas/` langsung ke Apps Script; jalankan `scripts/build-apps-script.ps1` dulu.

---

## 2. `DB_SPREADSHEET_ID belum diset`

**Penyebab:** `KONFIG.DB_SPREADSHEET_ID` di `Konfig.gs` masih kosong / salah.

**Solusi:** Buka `apps-script/Konfig.gs` → cari `var KONFIG` → pastikan `DB_SPREADSHEET_ID` berisi ID Spreadsheet Anda. ID ini diambil dari URL Sheets:

```
https://docs.google.com/spreadsheets/d/<<<INI_ID_NYA>>>/edit
```

Atau tambah Script Property `DB_SPREADSHEET_ID` (Project Settings ⚙️ → Script properties) yang akan diutamakan.

---

## 3. `You do not have permission to call DriveApp` / meminta izin ulang

**Penyebab:** Scope otorisasi belum lengkap karena `setup()` gagal di tengah.

**Solusi:** Jalankan ulang `setup()`. Saat layar izin muncul → **Advanced** → **Go to project (unsafe)** → **Allow**. Pastikan akun yang dipakai adalah **akun yang sama** dengan pemilik Spreadsheet.

---

## 4. PDF surat gagal dibuat saat `approveSurat`

Gejalanya: surat berstatus PUBLISHED tapi `pdf_url` kosong, atau muncul pesan "Gagal membuat PDF surat".

**Cek bertahap:**

1. **Apakah template ada?** Buka [Drive](https://drive.google.com) → cari file `Template Surat Resmi APII DPW Jabodetabek`. Bila tidak ada: buka Apps Script → jalankan fungsi `generateTemplateSurat` manual.
2. **Apakah folder PDF ada?** Cari folder `APII Jabo - PDF Surat Resmi` di Drive. Bila tidak ada: jalankan fungsi `siapkanFolderPdf_` manual.
3. **Cek eksekusi terakhir:** Apps Script → panel kiri **Executions** → buka log yang gagal → baca pesan errornya.

ID template & folder disimpan otomatis di Script Properties saat `setup()` jalan pertama kali, jadi normalnya tidak perlu diisi manual.

---

## 5. Logo / stempel tidak muncul di template

**Penyebab:** File `AsetLogo.gs` / `AsetStempel.gs` belum disalin, atau isinya bukan base64 yang dihasilkan script build.

**Solusi:**

1. Pastikan seluruh file `apps-script/*.gs` sudah disalin utuh ke editor (13 modul + `AsetLogo.gs` & `AsetStempel.gs`).
2. Jalankan ulang fungsi `generateTemplateSurat` (akan menulis ulang template dengan gambar terbaru).
3. Bila gambar diganti: taruh gambar baru di `Dokumen Sumber/` dengan nama yang sama → jalankan `scripts/build-apps-script.ps1` → salin ulang `AsetLogo.gs` & `AsetStempel.gs` ke Apps Script → jalankan `generateTemplateSurat`.

---

## 6. Frontend: "Sesi berakhir" terus-menerus / API tidak terhubung

**Cek:**

- `window.API_BASE` di `public/config.js` & `portal/config.js` sudah berisi **URL deployment** (bukan deployment ID saja). Formatnya: `https://script.google.com/macros/s/XXX/exec`.
- Deployment dibuat dengan **Execute as: Me** + **Who has access: Anyone**.
- Cek URL langsung di browser: `?action=getPublishedSurat` harus kembalikan JSON, bukan halaman login Google.

---

## 7. Login gagal padahal password benar

**Kemungkinan:**

- Password demo adalah `apii2026` (semua 9 akun). Pastikan tidak ada spasi saat mengetik.
- Bila Anda pernah mengubah `PASSWORD_SALT` di `KONFIG` **setelah** `setup()` jalan, semua password lama jadi tidak dikenali. Solusinya: jalankan ulang `setup()` (tidak akan menghapus data, hanya membuat ulang akun demo yang belum ada) lalu ganti password lewat portal sebagai SUPERADMIN.

---

## 8. Deploy ulang setelah mengubah kode backend

Setiap kali kode backend (`gas/*.gs`) diubah dan disimpan, **deployment lama tidak otomatis ter-update**.

**Cara yang disarankan (satu perintah, sudah terbukti di produksi):**
```bash
npm run deploy:gas          # build → validate → clasp push → Versi baru → perbarui deployment yang sama
npm run deploy:gas:check    # dry-run: build + validasi + preflight berkas saja
```

**Cara manual:** **Deploy → Manage deployments → pilih deployment → ikon ✏️ (Edit) → Version: New version → Deploy.** URL tidak berubah, jadi `API_BASE` frontend tetap sama.

> Keadaan produksi saat ini: **Versi 13** (2026-10-09 00:53 WIB dari `main`; sebelumnya Versi 12 pada 2026-10-08 23:30 WIB) pada deployment `/exec` yang sama. Rincian di [CHANGELOG.md](../CHANGELOG.md) → **Status Produksi Terkini** dan [deploy.md](deploy.md) §4.

---

## 9. Tombol “Reset ke Default” tidak mengembalikan folder Drive — DIPERBAIKI di Versi 13

**Gejala:** menekan **Reset ke Default** di kartu Google Drive menjawab sukses ("berhasil dikembalikan ke folder default organisasi"), tetapi folder penyimpanan yang dipakai **tetap folder custom yang lama**; kartu Drive lalu menampilkan nama folder lama itu.

**Bukti dari produksi (2026-10-09):** uji `npm run smoke:drive -- --confirm` melaporkan `resetDriveStorage` mengembalikan `folder_name` = folder uji custom (bukan `APII Jabo - PDF Surat Resmi`), dan `testDriveStorage` sesudahnya masih menunjuk folder custom tersebut. Jejak audit `DRIVE_STORAGE_RESET` juga tercatat padahal folder tidak berpindah.

**Sebab (di `gas/Utils.gs`):** `resetDriveStorage` memanggil `siapkanFolderPdf_()` **sebelum** menghapus `drive_storage.custom_folder_id`. Urutan itu membuat `siapkanFolderPdf_()` (a) menemukan ID folder custom lama pada `drive_storage`, (b) menuliskannya kembali ke Script Property `DRIVE_FOLDER_ID`, lalu (c) mengembalikan folder custom tersebut sebagai "folder default". Setelah itu barulah `drive_storage` ditulis dengan `custom_folder_id: ''` — sehingga catatan setelan dan folder yang benar-benar dipakai menjadi tidak sinkron.

**Perbaikan (dipasang pada Versi 13, 2026-10-09 00:53 WIB):**
1. `resetDriveStorage` kini menghapus kedua sumber konfigurasi (`google_drive_folder_id` dan `drive_storage.custom_folder_id`) **lebih dahulu**, baru memanggil `siapkanFolderPdf_()`.
2. `siapkanFolderPdf_` kini **memakai ulang** folder bernama `KONFIG.DRIVE_FOLDER_NAME` yang sudah ada (lewat `DriveApp.getFoldersByName`, folder di Trash dilewati) sebelum membuat yang baru — sehingga reset berulang tidak lagi menumpuk folder default.
3. Penjaga regresinya ada di dua tempat: `node scripts/smoke-drive-local.mjs` (16 pemeriksaan, tanpa jaringan) dan `npm run smoke:drive -- --confirm` (produksi, memeriksa folder default benar-benar dipakai ulang).

**Bukti setelah perbaikan:** uji produksi 2026-10-09 pada Versi 13 → **20 pemeriksaan lulus, 0 gagal**; `resetDriveStorage` mengembalikan folder `APII Jabo - PDF Surat Resmi` yang sudah ada (tanpa duplikat baru), lalu folder aktif produksi dipulihkan ke `APII Jabo - Arsip 2026` dan terverifikasi.

---

## 10. Setelah `clasp push` masih "Aksi tidak dikenali" / perilaku lama tetap jalan

**Gejala:** kode baru sudah terunggah, tetapi portal menjawab *"Aksi tidak dikenali"* atau fitur baru tidak terasa — padahal fungsinya jelas ada di project Apps Script.

**Sebab paling sering: definisi ganda.** Semua berkas `.gs` di Apps Script berbagi satu scope global. Bila berkas lama masih tertinggal berdampingan dengan modul baru — terutama `Backend.gs` tunggal dari build sebelum 2026-10-09, atau `Aset.gs` peninggalan zaman dulu — nama yang sama terdefinisi dua kali. Apps Script **tidak** melaporkan ini sebagai error dan diam-diam memakai salah satunya (berkas yang dimuat paling akhir menang), sehingga yang dieksekusi adalah salinan usang.

**Diagnosis satu perintah** (menarik isi editor yang sesungguhnya, tidak mengubah apa pun di Google):
```bash
npm run check:legacy
```
Keluarannya: berkas yang bukan keluaran build, jumlah definisi ganda yang terbentuk berikut modul pasangannya, dan jumlah simbol berkas lama yang belum pindah. Kode keluar: **0** bersih · **1** ada temuan · **2** tidak dapat diverifikasi (mis. belum `clasp login`).

**Solusi:**
1. Bila hasilnya menyatakan **JANGAN hapus** → pindahkan dulu simbol yang disebutkan ke modul yang tepat, lalu `npm run build:gas`.
2. Bila seluruh simbol sudah pindah (skrip menyatakannya "penghapusan terbukti tidak menghilangkan fungsi") → buka editor Apps Script, klik kanan berkas lama → **Delete** (termasuk sisa lain seperti `Aset.gs`).
3. Verifikasi: `npm run check:legacy` harus keluar 0. Setelah itu `npm run deploy:gas` membuat versi baru seperti biasa.

> Sejak gerbang **langkah 7** di `scripts/deploy-gas.mjs`, versi baru tidak dibuat selagi editor masih memuat berkas lama — jadi keadaan ini tidak bisa lagi terlanjur tayang ke produksi.

---

## Butuh bantuan lain?

Buka Apps Script → **Executions** → cari eksekusi yang gagal → salin **seluruh isi log error** beserta nama fungsi. Itu yang dibutuhkan untuk mendiagnosis masalahnya.
