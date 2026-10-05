# Troubleshooting — SIAP APII

Daftar error yang paling sering muncul saat pemasangan pertama + cara memperbaikinya.

---

## 1. `Auth is not defined` / `Database is not defined`

**Penyebab:** Anda menempatkan kode `gas/` lama (yang memakai pola `Auth.login(...)`) ke Apps Script.

**Solusi:** Pakai file `apps-script/Backend.gs` yang sudah dirakit — di dalamnya pola tersebut sudah diganti jadi pemanggilan global. Jangan salin file-file di folder `gas/` langsung ke Apps Script; jalankan `scripts/build-apps-script.ps1` dulu.

---

## 2. `DB_SPREADSHEET_ID belum diset`

**Penyebab:** `KONFIG.DB_SPREADSHEET_ID` di `Backend.gs` masih kosong / salah.

**Solusi:** Buka `apps-script/Backend.gs` → cari `var KONFIG` → pastikan `DB_SPREADSHEET_ID` berisi ID Spreadsheet Anda. ID ini diambil dari URL Sheets:

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

1. Pastikan 3 file (`Backend.gs`, `AsetLogo.gs`, `AsetStempel.gs`) sudah disalin utuh.
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

Setiap kali kode `Backend.gs` diubah dan disimpan, **deployment lama tidak otomatis ter-update**:

**Deploy → Manage deployments → pilih deployment → ikon ✏️ (Edit) → Version: New version → Deploy.** URL tidak berubah, jadi `API_BASE` frontend tetap sama.

---

## Butuh bantuan lain?

Buka Apps Script → **Executions** → cari eksekusi yang gagal → salin **seluruh isi log error** beserta nama fungsi. Itu yang dibutuhkan untuk mendiagnosis masalahnya.
