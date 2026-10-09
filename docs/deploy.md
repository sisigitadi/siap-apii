# Panduan Deployment & Operasional Produksi (SIAP APII)

**Sistem Informasi & Administrasi Terpadu Yayasan APII DPW Jabodetabek (v2.0.0 Enterprise)**

> Dokumen panduan resmi deployment, konfigurasi custom domain, sinkronisasi Google Apps Script, dan prosedur operasional produksi SIAP APII.

---

## 1. Ringkasan Infrastruktur Produksi (100% Serverless & Gratis)

SIAP APII berjalan di atas arsitektur serverless modern tanpa memerlukan server VM berbayar. Seluruh beban komputasi backend, basis data, dan penyimpanan dokumen dikelola oleh infrastruktur Google Workspace gratis selamanya dalam kuota yayasan, sedangkan antarmuka web di-hosting pada Vercel Global Edge Network.

| Komponen | Layanan / Provider | Endpoint / Target | Keterangan |
|---|---|---|---|
| **Portal Pengurus (SPA)** | **Vercel** Edge CDN (`sin1` SG) | `https://siapii.sigitadi.id` | Single Page Application 8 peran pengurus (folder `portal/`) |
| **Portal Publik** | **Vercel / Static Web** | `https://apii.sigitadi.id` | Profil yayasan & pendaftaran calon anggota baru (UU PDP No. 27/2022) |
| **Backend API** | **Google Apps Script** Web App | `https://script.google.com/macros/s/.../exec` | Router RESTful JSON, RBAC 8 peran, sesi token 7-hari |
| **Database ACID** | **Google Sheets** | Spreadsheet ID: `1B0p0Jgb...` | Sheet: Users, Sessions, Surat, Keuangan, Divisi, Audit, Pendaftar, Settings, Accounts |
| **Document Storage** | **Google Drive** | `APII Jabo - PDF Surat Resmi` | Arsip PDF surat resmi, kwitansi kas, berkas KTP & selfie pemohon |
| **Mesin Render PDF** | **Google Docs Template** | Auto-generated via `setup()` | Kop surat resmi, stempel basah, logo, nomor otomatis |
| **Notifikasi Background** | **GmailApp / MailApp** | Otomatis via GAS | Email persetujuan surat, voucher kas, & pendaftaran anggota |
| **Notifikasi Interaktif** | **WhatsApp Web Link** | Click-to-Chat URI | Quick share dokumen, voucher, & konfirmasi pendaftar |

---

## 2. Struktur Domain & Routing

```
                          Internet / Pengguna
                                  │
            ┌─────────────────────┴─────────────────────┐
            ▼                                           ▼
    https://apii.sigitadi.id                    https://siapii.sigitadi.id
    [Portal Publik APII]                     [Portal Pengurus SIAPII]
    - Profil Yayasan & 7 Divisi              - Unified Action Inbox
    - Formulir Pendaftaran Anggota           - Modul Persuratan (A4 Virtual)
    - Auto-Watermark KTP (UU PDP)            - Buku Kas & Dual-Approval
    - Tanda Terima Digital Pendaftar         - Usulan Divisi & LPJ 5-Tahap
    (Tanpa tautan portal admin)              - Verifikasi Pendaftar Masuk
                                             - Pengaturan & Master Data
                                             - Log Audit Permanen (WORM)
                                                        │
                                                        ▼ (REST JSON HTTPS)
                                             Google Apps Script Web App
                                                        │
                                ┌───────────────────────┴───────────────────────┐
                                ▼                                               ▼
                       Google Sheets (Database)                       Google Drive (Dokumen/Foto)
```

### Konfigurasi DNS Domain (`sigitadi.id`)
Di dashboard DNS manajemen domain (Cloudflare / Registrar cPanel):
- **Host / Subdomain:** `siapii`
- **Tipe Record:** `CNAME`
- **Target / Value:** `cname.vercel-dns.com`
- **Proxy Status (Cloudflare):** DNS Only (atau Proxied dengan SSL Full/Strict)
- **Status:** **TERVERIFIKASI AKTIF** (`3e8cffbb0e16a642.vercel-dns-017.com`)

---

## 3. Langkah Deployment Frontend ke Vercel (100% Otomatis CI/CD)

Untuk memastikan kedua portal berjalan secara otomatis tanpa perlu mengunggah berkas secara manual ke server web (Nginx/cPanel/VPS), sistem menggunakan arsitektur **Dual-Project Vercel** dari satu repositori GitHub yang sama (`sisigitadi/siap-apii`).

### 3.1 Proyek 1: Portal Pengurus (`siapii.sigitadi.id`)
- **Repository:** `sisigitadi/siap-apii`
- **Branch Produksi:** `main`
- **Root Directory:** `portal` (atau `.` dengan `outputDirectory: portal` pada `vercel.json`)
- **Custom Domain:** `siapii.sigitadi.id`
- **DNS Record:** CNAME `siapii` $\to$ `cname.vercel-dns.com` (Sudah Aktif)

### 3.2 Proyek 2: Portal Publik (`apii.sigitadi.id`)
- **Repository:** `sisigitadi/siap-apii` (Repositori yang sama)
- **Branch Produksi:** `main`
- **Root Directory:** `public` (menggunakan konfigurasi otomatis `public/vercel.json`)
- **Custom Domain:** `apii.sigitadi.id`
- **DNS Record:** CNAME `apii` $\to$ `cname.vercel-dns.com`

Setiap kali perintah `git push origin main` dieksekusi, Vercel secara otomatis mendeteksi perubahan dan memperbarui kedua portal secara serentak tanpa perlu login ke server VPS/Nginx selamanya.

---

## 4. Alur Pembaruan Backend (Google Apps Script)

> **Status rilis terakhir — 2026-10-09 00:53 WIB.**
> Backend produksi menyajikan **Versi 13** pada deployment `/exec` yang sama (`…NJdg`), dibangun dari `main` — perbaikan **Reset ke Default** + pemakaian ulang folder default Drive. Isi berkasnya **identik** dengan bundel `apps-script/` hasil build lokal saat itu (`Backend.gs` 200.682 karakter — sebelum build dipecah per-modul pada 2026-10-09) dan manifest-nya sama dengan `gas/appsscript.json`, sehingga yang tayang benar-benar kode di repositori. Seluruh delapan tahap alur di bawah ini sudah **dijalankan penuh dan terbukti** — `push`, `create-version`, dan `update-deployment` tidak lagi berstatus "belum pernah diuji" — dan URL `/exec` tidak pernah berubah sejak rilis pertama.
>
> Delta rilis: v11 = 190.118 → v12 = 199.360 (+9.242, modul Google Drive + mini-CMS redaksi) → **v13 = 200.682 karakter (+1.322, perbaikan reset folder Drive)**.
>
> **Cara memeriksa ulang kapan pun:** `npm run deploy:gas:check` (dry-run: build + validasi + `clasp status`, memastikan **tepat** empat berkas) lalu bandingkan Versi Apps Script terakhir dengan `apps-script/` melalui Apps Script API (`projects/{scriptId}/versions` dan `.../deployments`).

Setiap kali terdapat pembaruan kode pada folder `gas/`:

### Langkah 1 — Kompilasi Bundle Lokal
Jalankan script bundler di terminal PowerShell:
```powershell
npm run build:gas
# Atau:
powershell -ExecutionPolicy Bypass -File scripts\build-apps-script.ps1
```
Script akan:
1. Membaca setiap modul `.gs` secara terurut (`00-Konfig`, `Utils`, `Editorial`, `Pengaturan`, `Database`, `Auth`, `Surat`, `Keuangan`, `Divisi`, `TemplateSurat`, `99-TemplateSurat`, `Visitor`, `Code`).
2. Menghilangkan pola namespace `Modul.fn()` menjadi pemanggilan fungsi global Apps Script murni.
3. Menghasilkan file siap-unggah — **satu file per modul** di `apps-script/` (`Konfig.gs` … `Code.gs`), plus `AsetLogo.gs` dan `AsetStempel.gs`, lalu menghapus output basi dari build lama (termasuk `Backend.gs` tunggal).

### Langkah 2 — Deploy Satu Perintah (disarankan)

```bash
npm run deploy:gas            # deploy penuh (build → validate → push → versi baru → update deployment)
npm run deploy:gas:check      # --dry-run: hanya build + validasi + preflight berkas
npm run deploy:gas -- --desc "rilis 2.3.0 riwayat versi konten"
```

Yang dilakukan skrip `scripts/deploy-gas.mjs`:

| Tahap | Tindakan | Catatan |
|---|---|---|
| 1 | Preflight konfigurasi | Membaca `GAS_SCRIPT_ID` dari `.env`; deployment ID diambil otomatis dari URL `/exec` di `portal/config.js` (gagal bila kedua config menunjuk deployment berbeda). |
| 2 | Kompilasi bundel | Menjalankan `scripts/build-apps-script.ps1`. |
| 3 | Validasi sintaks | Menjalankan `scripts/validate-apps-script.mjs` (bundel cacat dihentikan sebelum diunggah). |
| 4 | Preflight berkas (tanpa kredensial) | `clasp status` — memastikan **tepat** berkas yang diunggah: 13 file `.gs` per-modul (`Konfig` … `Code`) + `AsetLogo.gs`, `AsetStempel.gs`, dan manifest `appsscript.json` (tidak ada berkas lain/rahasia/berkas sampah yang ikut terbawa). |
| 5 | Cek login | `clasp show-authorized-user`; bila belum login, deploy dihentikan dengan instruksi. |
| 6 | Unggah kode | `clasp push --force`. Bila Google menolak karena setelan akun, skrip berhenti dengan instruksi spesifik (lihat prasyarat 3). |
| 7 | Versi baru | `clasp create-version` — versi *immutable* sebagai jejak rilis. |
| 8 | Perbarui deployment | `clasp update-deployment -V <versi>` pada deployment ID yang sama sehingga URL `/exec` **tidak berubah**. |

Prasyarat sekali saja:
1. `npx --yes @google/clasp@3 login` (akun Google pemilik project Apps Script).
2. `GAS_SCRIPT_ID=<Script ID>` pada `.env` — Apps Script → ⚙ Project Settings → IDs.
3. **Aktifkan Google Apps Script API** untuk akun tersebut di [script.google.com/home/usersettings](https://script.google.com/home/usersettings) → *Google Apps Script API* → **ON**. Tanpa ini Google menolak setiap unggahan dengan pesan `User has not enabled the Apps Script API` (dapat membaca project, tetapi tidak boleh menulis).
4. Opsional: `GAS_DEPLOYMENT_ID=<id>` pada `.env` untuk menimpa deployment ID yang dibaca dari `portal/config.js` (mis. bila URL `/exec` di config tersebut keliru atau berbeda dari yang ingin diperbarui).

> **Penting:** `clasp` tidak menghapus berkas yang ada di editor Apps Script. Project tersebut harus hanya berisi output build per-modul (13 file `.gs` + `AsetLogo.gs`, `AsetStempel.gs`, `appsscript.json`). **Migrasi sekali dari build lama:** hapus `Backend.gs` tunggal dari editor — isinya kini tersebar di file-file per-modul; sisa berkas lama lain (mis. `Aset.gs`) juga harus dihapus agar tidak terjadi definisi fungsi ganda.

### Langkah 2b — Alternatif Manual
1. Buka project Apps Script di browser: [script.google.com](https://script.google.com).
2. Salin isi masing-masing file dari folder `apps-script/` ke editor Google Apps Script — buat satu file `.gs` baru per modul (`Konfig.gs`, `Utils.gs`, `Editorial.gs`, `Pengaturan.gs`, `Database.gs`, `Auth.gs`, `Surat.gs`, `Keuangan.gs`, `Divisi.gs`, `TemplateSurat.gs`, `TemplateSuratDocs.gs`, `Visitor.gs`, `Code.gs`, `AsetLogo.gs`, `AsetStempel.gs`), lalu hapus file lama (`Backend.gs` dan sisa lainnya) agar tidak ada definisi fungsi ganda.
   - Isi `apps-script/appsscript.json` $\to$ **Project Settings** → centang *Show “appsscript.json” manifest file in editor* lalu sesuaikan bila perlu
3. Tekan **Save** (Ctrl+S / ikon 💾).

### Langkah 3 — Perbarui Versi Web App (Manual)
1. Klik tombol **Deploy** di pojok kanan atas editor Apps Script.
2. Pilih **Manage deployments**.
3. Klik ikon pensil (Edit) pada deployment aktif.
4. Pada kolom **Version**, pilih **New version**.
5. Isi deskripsi (contoh: *Release v2.0.0 - Pendaftaran Anggota & Hardening RBAC*).
6. Klik **Deploy**.
7. Salin URL Web App yang dihasilkan (format: `https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec`).
8. Jika ID Deployment berubah, perbarui baris `window.API_BASE` pada:
   - `portal/config.js`
   - `public/config.js`
   Lalu lakukan `git push origin main`.

---

## 5. Checklist Verifikasi Produksi (Health Check)

| No | Parameter Pemeriksaan | Target Hasil | Metode Pengujian |
|---|---|---|---|
| 1 | **Konektivitas Portal Pengurus** | HTTP 200 OK | Akses `https://siapii.sigitadi.id` di browser |
| 2 | **Konektivitas Portal Publik** | HTTP 200 OK | Akses `https://apii.sigitadi.id` di browser |
| 3 | **Sertifikat SSL/TLS** | Valid (HTTPS) | Cek gembok SSL di peramban |
| 4 | **Pemuatan Aset** | Semua file HTTP 200 | Periksa console: `portal.js`, `style.css`, `logo.png` |
| 5 | **Autentikasi Pengurus** | Sesi token aktif | Login dengan salah satu dari 8 peran pengurus |
| 6 | **Action Inbox** | Render dokumen pending | Masuk ke dashboard dengan role Ketua/Sekretaris/Bendahara |
| 7 | **Kertas Virtual A4** | Modal A4 + Watermark | Buka detail surat di modul Persuratan |
| 8 | **Quick Share WhatsApp** | Buka dialog kirim pesan | Klik ikon WhatsApp pada surat/voucher/usulan |
| 9 | **Bukti Kas Drive** | Tautan terbuka di tab baru | Cek voucher dengan bukti di modul Keuangan |
| 10 | **Siklus Usulan LPJ** | Stepper 5-tahap aktif | Buka detail usulan program di modul Divisi |
| 11 | **Formulir Pendaftaran** | Validasi + Canvas Watermark | Unggah KTP di portal publik, cek cap watermark |
| 12 | **Verifikasi Pendaftar** | Approval ganda berfungsi | Sekretaris verifikasi berkas $\to$ Ketua sahkan anggota |
| 13 | **Privasi & Kerahasiaan** | Bebas link admin | Pastikan portal publik tidak memuat link portal pengurus |
| 14 | **Route baru terdaftar** | Dikenali router (bukan *"Aksi tidak dikenali"*) | Kumpulkan seluruh aksi dari `portal/portal.js`: 40 aksi unik → 36 menuntut login, 4 publik menjawab normal, 0 tidak dikenali (per 2026-10-09) |
| 15 | **Penjagaan RBAC** | Ditolak tanpa token | POST tiap aksi redaksi & Drive tanpa token → *"Sesi berakhir atau tidak valid. Silakan login kembali."*; kontrol aksi ngawur tetap *"Aksi tidak dikenali."* |
| 16 | **Koneksi Google Drive** | Folder aktif + izin tulis | `testDriveStorage` dengan sesi superadmin → *"Koneksi Google Drive terhubung dan izin tulis aktif"* beserta ID/URL folder |
| 17 | **Riwayat Versi Redaksi** | Daftar versi tampil | Buka tab `📰 Redaksi Konten` → kartu `7. Riwayat Versi & Pemulihan` (kosong = belum ada penyimpanan, bukan kegagalan) |
| 18 | **Ekspor & Impor Redaksi** | Berkas bolak-balik konsisten | Ekspor `exportEditorialContent` → impor ulang berkas yang sama → *"Isi berkas sama dengan konten aktif"*, dan sidik jari `getPublicSettings.editorial` **identik** sebelum & sesudah |
| 19 | **Konten dinamis publik** | Seksi tampil tanpa error | Muat ulang `apii.sigitadi.id`: hero, warta, profil, dan FAQ mengikuti backend; tidak ada error konsol baru (peringatan Tailwind CDN memang bawaan) |

> **Catatan ukuran berkas:** dulu seluruh backend digabung di satu `Backend.gs` yang tembus 199.360 karakter dan terus bertambah hingga 256.907 karakter — skrip build memperingatkan kedekatan batas ukuran berkas Apps Script. Sejak 2026-10-09 build dipecah per-modul: file backend terbesar kini `Auth.gs` (~29.700 karakter) dan hanya `AsetStempel.gs` (base64, ~53.400 karakter) yang mendekati separuh batas. Modul baru cukup ditambahkan ke `$order` di `scripts/build-apps-script.ps1`.

### 5b. Uji AMAN perubahan Drive sungguhan (`npm run smoke:drive`)

Perubahan pada modul Google Drive (`createDriveFolder`, `moveDriveFolder`, `resetDriveStorage`) hanya terbukti lewat eksekusi nyata. Skrip `scripts/smoke-drive-prod.mjs` melakukannya dengan aman:

```bash
npm run smoke:drive                      # tampilkan rencana saja (tidak menyentuh apa pun)
npm run smoke:drive -- --confirm         # jalankan uji produksi
npm run smoke:drive -- --confirm --sandbox <folderId>   # pakai ulang sandbox yang sudah ada
```

Yang dilakukan: membuat satu folder sandbox `UJI-OTOMATIS-APII-<stempel>` lewat Drive API, menjalankan `createDriveFolder` 2× (memeriksa 5 subfolder standar + izin tulis), dua penjagaan `moveDriveFolder`, satu pemindahan nyata (dibuktikan lewat Drive API), lalu `resetDriveStorage` (harus benar-benar memakai folder default yang sudah ada); setelah itu **folder aktif produksi dipulihkan dan diverifikasi**, dan sandbox dicoba dibersihkan.

Sebelum menyentuh produksi, jalankan versi lokalnya (tanpa jaringan, tanpa kredensial) yang mengunci perilaku folder default & reset:
```bash
npm run build:gas && node scripts/smoke-drive-local.mjs
```

Kode keluar: **0** semua lulus & bersih · **1** ada pemeriksaan gagal · **2** lulus tetapi sandbox perlu dihapus manual.

> ⚠️ **Batasan yang sudah terbukti:** Google Drive menolak menghapus folder sandbox yang berisi folder buatan backend Apps Script (`403 appNotAuthorizedToChild`) karena kredensial uji (scope `drive.file`) tidak berhak atas berkas milik aplikasi lain. Karena itu penghapusan **tidak selalu otomatis** — skrip akan memberi tautan folder + status “perlu tindakan manual” alih-alih mengklaim bersih.
>
> Prasyarat: `npx --yes @google/clasp@3 login` (dipakai untuk Drive API) dan akun uji `SUPERADMIN` (ubah lewat `APII_TEST_USER` / `APII_TEST_PASS`).

---

## 6. Prosedur Pencadangan & Pemulihan Bencana (Disaster Recovery)

1. **Pencadangan Basis Data:**
   - Karena database berbasis **Google Sheets**, seluruh riwayat revisi baris data secara otomatis disimpan oleh Google (*Version History*).
   - Pengurus dapat mengunduh salinan berkala (.xlsx / .csv) melalui menu **File $\to$ Download $\to$ Microsoft Excel (.xlsx)**.
2. **Pencadangan Berkas PDF & Nota:**
   - Seluruh PDF surat dan dokumen nota tersimpan rapi di Google Drive yayasan pada folder `APII Jabo - PDF Surat Resmi`.
3. **Audit Trail Keamanan:**
   - Seluruh aktivitas login, persetujuan surat, verifikasi kas, dan pengajuan program tercatat permanen di tab `Sheet_AuditLogs` (WORM - Anti Hapus) dan dapat dipantau langsung oleh Superadmin, Ketua, Pembina, dan Pengawas.
