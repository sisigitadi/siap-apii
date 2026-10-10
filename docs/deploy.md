# Panduan Deployment & Operasional Produksi (SIAP APII)

**Sistem Informasi & Administrasi Terpadu Yayasan APII DPW Jabodetabek (v2.5.0 Enterprise)**

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

> **Status rilis terakhir — 2026-10-10 01:41 WIB.**
> Backend produksi menyajikan **Versi 15** (aplikasi **2.5.0**) pada deployment `/exec` yang sama (`…NJdg`), dibangun dari `main` — build per-modul (13 file `.gs` + 2 aset + manifest, 345.007 karakter total) beserta akun demo read-only, master template surat, dan pelacakan pengunjung. Isi berkasnya **identik** dengan bundel `apps-script/` hasil build lokal dan manifest-nya sama dengan `gas/appsscript.json`, sehingga yang tayang benar-benar kode di repositori — dikonfirmasi dari dua sisi: `clasp deployments` menyajikan `versionNumber: 15`, dan `ping` produksi melaporkan `version: "2.5.0"` + `release: 15`, sama dengan `apps-script/Versi.gs` lokal. Editor Apps Script terverifikasi **bersih** pasca-deploy (17 berkas, 0 berkas lama). Seluruh sepuluh tahap alur di bawah ini sudah **dijalankan penuh dan terbukti** — termasuk pemeriksaan editor (langkah 7) dan pembersihan otomatis (langkah 7b) — dan URL `/exec` tidak pernah berubah sejak rilis pertama.
>
> Delta rilis: v12 = 199.360 → v13 = 200.682 (perbaikan reset folder Drive) → v14 = 345.007 karakter sebagai 16 berkas terpisah (build dipecah per-modul + fitur 2.5.0) → **v15 = 17 berkas** (menambah `Versi.gs`, sumber angka versi `ping`; dulu satu `Backend.gs` 200.786 karakter di editor).
>
> **Cara memeriksa ulang kapan pun:** `npm run deploy:gas:check` (dry-run: build + validasi + `clasp status`, memastikan berkas unggahan **tepat** sesuai daftar, + pemeriksaan editor) dan `npm run check:legacy` (berkas lama/definisi ganda), lalu bandingkan Versi Apps Script terakhir dengan `apps-script/` melalui Apps Script API (`projects/{scriptId}/versions` dan `.../deployments`).
>
> **Laporan versi tidak bisa basi:** `GET <url>/exec?action=ping` menjawab `{ status, version, release }` — `version` = versi aplikasi dari `package.json` (dicap saat build), `release` = nomor Versi Apps Script yang tayang (dicap langkah 5b, dicocokkan dengan nomor yang benar-benar dibuat). Pakai kedua angka itu untuk pengawasan; tidak ada angka versi yang ditulis manual di kode.
>
> **Pembersihan berkas lama kini otomatis:** bila editor masih menyimpan berkas non-build (`Backend.gs` tunggal, `Aset.gs` zaman dulu, dsb.), deploy membersihkannya sendiri lewat Apps Script API (`projects.updateContent`) di **langkah 7b** — tidak lagi memerlukan klik **Delete** manual. Migrasi dari build tunggal ke build per-modul karena itu tidak butuh operasi editor sama sekali.

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
3. Menghasilkan file siap-unggah — **satu file per modul** di `apps-script/` (`Konfig.gs` … `Code.gs`), plus `AsetLogo.gs`, `AsetStempel.gs`, dan `Versi.gs` (info versi yang dilaporkan `ping`; lihat langkah 5b), lalu menghapus output basi dari build lama (termasuk `Backend.gs` tunggal).

### Langkah 2 — Deploy Satu Perintah (disarankan)

```bash
npm run deploy:gas            # deploy penuh (build → validate → push → versi baru → update deployment)
npm run deploy:gas:check      # --dry-run: build + validasi + preflight berkas + periksa editor (tanpa mengunggah)
npm run deploy:gas -- --desc "rilis 2.3.0 riwayat versi konten"
```

Yang dilakukan skrip `scripts/deploy-gas.mjs`:

| Tahap | Tindakan | Catatan |
|---|---|---|
| 1 | Preflight konfigurasi | Membaca `GAS_SCRIPT_ID` dari `.env`; deployment ID diambil otomatis dari URL `/exec` di `portal/config.js` (gagal bila kedua config menunjuk deployment berbeda). |
| 2 | Kompilasi bundel | Menjalankan `scripts/build-apps-script.ps1`. |
| 3 | Validasi sintaks | Menjalankan `scripts/validate-apps-script.mjs` (bundel cacat dihentikan sebelum diunggah). |
| 4 | Preflight berkas (tanpa kredensial) | `clasp status` — memastikan **tepat** berkas yang diunggah: 13 file `.gs` per-modul (`Konfig` … `Code`) + `AsetLogo.gs`, `AsetStempel.gs`, `Versi.gs`, dan manifest `appsscript.json` (tidak ada berkas lain/rahasia/berkas sampah yang terbawa). |
| 5 | Cek login | `clasp show-authorized-user`; bila belum login, deploy dihentikan dengan instruksi. |
| 5b | **Cap nomor rilis ke laporan versi** | `clasp versions --json` → nomor tertinggi + 1 dicap ke `apps-script/Versi.gs` lewat [scripts/stamp-build-info.mjs](../scripts/stamp-build-info.mjs) (lalu bundel divalidasi ulang). Endpoint `ping` melaporkan nomor itu, jadi pengawasan membaca versi yang benar-benar tayang. Bila daftar versi tak terbaca, deploy berjalan dengan `release: null` + peringatan; `--no-release-stamp` melewatinya. |
| 6 | Unggah kode | `clasp push --force`. Bila Google menolak karena setelan akun, skrip berhenti dengan instruksi spesifik (lihat prasyarat 3). |
| 7 | **Periksa editor (gerbang definisi ganda)** | Menjalankan [scripts/check-legacy-duplicates.mjs](../scripts/check-legacy-duplicates.mjs): menarik isi editor yang sesungguhnya (`clasp pull`), mendaftar berkas yang bukan keluaran build, menghitung definisi ganda antar berkas, lalu memastikan setiap simbol berkas lama juga ada di modul baru. Bila ada simbol berkas lama yang **belum pindah** ke modul baru, **deploy dihentikan sebelum versi baru dibuat** (produksi `/exec` tidak berubah) beserta daftar simbolnya — itu keputusan manusia, bukan pembersihan mekanis. Pada rilis Versi 14, berkas lama sudah hilang dengan sendirinya saat langkah 6, sehingga langkah ini lulus tanpa intervensi (lihat blok **Penting** di bawah). |
| 7b | **Bersihkan berkas lama otomatis** | Bila ada berkas yang **bukan** keluaran build, menjalankan [scripts/remove-legacy-files.mjs](../scripts/remove-legacy-files.mjs) — mengirim seluruh berkas `apps-script/` ke `projects.updateContent` lewat Apps Script API sehingga isi project menjadi tepat sama dengan build lokal. Aman: hanya menyentuh berkas di luar daftar build, keadaan bersih = **tanpa penulisan sama sekali**, dan bila keadaannya tak dapat dipastikan (kredensial/scope hilang) deploy dihentikan alih-alih mengklaim bersih. Lewati dengan `--no-cleanup`; jalankan sendiri kapan pun dengan `npm run cleanup:legacy -- --yes`. |
| 8 | Versi baru | `clasp create-version` — versi *immutable* sebagai jejak rilis. Hanya dijalankan bila langkah 7/7b menyatakan editor bersih. Nomor yang dibuat **wajib** sama dengan yang dicap di langkah 5b; bila meleset (mis. ada versi dibuat orang lain di sela-sela), deploy berhenti **sebelum** langkah 9 sehingga produksi tetap menyajikan versi lama, bukan versi yang melaporkan nomor rilis salah. |
| 9 | Perbarui deployment | `clasp update-deployment -V <versi>` pada deployment ID yang sama sehingga URL `/exec` **tidak berubah**. |

Prasyarat sekali saja:
1. `npx --yes @google/clasp@3 login` (akun Google pemilik project Apps Script).
2. `GAS_SCRIPT_ID=<Script ID>` pada `.env` — Apps Script → ⚙ Project Settings → IDs.
3. **Aktifkan Google Apps Script API** untuk akun tersebut di [script.google.com/home/usersettings](https://script.google.com/home/usersettings) → *Google Apps Script API* → **ON**. Tanpa ini Google menolak setiap unggahan dengan pesan `User has not enabled the Apps Script API` (dapat membaca project, tetapi tidak boleh menulis).
4. Opsional: `GAS_DEPLOYMENT_ID=<id>` pada `.env` untuk menimpa deployment ID yang dibaca dari `portal/config.js` (mis. bila URL `/exec` di config tersebut keliru atau berbeda dari yang ingin diperbarui).

> **Penting — risiko definisi ganda:** semua berkas `.gs` di Apps Script berbagi satu scope global. Bila editor masih menyimpan berkas lama (`Backend.gs` tunggal dari build lama, `Aset.gs` zaman dulu, dsb.) sementara modul baru sudah diunggah, nama yang sama terdefinisi dua kali dan Apps Script **tidak** melaporkannya sebagai error — runtime diam-diam memakai salinan usang (gejala persis: *"Aksi tidak dikenali"*). Editor harus hanya berisi output build per-modul: 13 file `.gs` + `AsetLogo.gs`, `AsetStempel.gs`, `Versi.gs`, `appsscript.json`.
>
> **Yang terbukti pada rilis Versi 14 (2026-10-10):** `clasp push` **sudah menghapus** `Backend.gs` lama tanpa tindakan manual. `clasp` memang tidak punya perintah hapus, tetapi push mengirim seluruh berkas lokal ke API `projects.updateContent`, yang **mengganti seluruh isi project** — berkas yang tidak ada di `apps-script/` ikut terhapus. Jadi editor langsung berisi tepat 16 berkas dan langkah 7 lulus tanpa intervensi. Klaim lama di dokumen ini ("`clasp` tidak pernah menghapus berkas") **tidak benar** dan telah dikoreksi di sini. Bila suatu saat berkas lama tetap tertinggal (mis. `clasp` versi lebih lama atau unggahan sebagian), **langkah 7b membersihkannya otomatis** lewat Apps Script API — tidak ada klik **Delete** manual; deploy hanya berhenti bila ada simbol berkas lama yang belum ada di modul baru (butuh keputusan manusia).
>
> Pemeriksaan bisa dijalankan kapan pun tanpa menyentuh Google:
> ```bash
> npm run check:legacy                  # kode keluar 0 bersih · 1 ada temuan · 2 tak dapat diverifikasi
> npm run check:legacy -- --from .snapshot-editor   # simpan hasil tarikan untuk diperiksa manual
> npm run cleanup:legacy                 # --dry-run: rencana pembersihan (tidak menulis apa pun)
> npm run cleanup:legacy -- --yes         # bersihkan sungguhan lewat Apps Script API
> ```
> Pembersih memakai gerbang kelayakan yang **sama** dengan deploy: bila ada simbol berkas lama yang belum ada di modul baru, ia menolak menghapus dan meminta keputusan manusia.
> Skrip yang sama membuktikan penghapusan tidak berbahaya: setiap simbol berkas lama dicocokkan dengan modul baru, dan bila ada simbol yang belum pindah hasilnya menyatakan **JANGAN hapus** beserta daftar simbolnya.

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
| 20 | **Tombol Masuk & Akun Demo** | Aplikasi terbuka, bukan pesan galat | `npm run smoke:portal` (15) + `npm run smoke:portal:ui` (17) tanpa jaringan, lalu dari peramban **bersih**: klik **Masuk sebagai Akun Demo** $\to$ Dashboard + banner **Mode Demo (hanya lihat)**; dan dari keadaan sesi demo masih tersimpan: **Masuk** dengan akun biasa tetap sampai ke server (bukan notifikasi *"Mode demo hanya untuk melihat…"*) |
| 21 | **Sesi demo read-only utuh** | Aksi tulis ditolak | Sebagai akun demo, coba simpan apa pun $\to$ ditolak di klien tanpa permintaan jaringan; menu *Manajemen Pengguna*, *Jejak Audit*, dan *Pengaturan & Master* tidak muncul |
| 22 | **Jalur pemulihan kredensial admin** | Sebab diketahui + sandi bisa disetel ulang | `npm run smoke:auth` (85 pemeriksaan tanpa jaringan: sebab dibedakan, penolakan aman, sandi lama mati, sesi dicabut, jejak `PASSWORD_RESET`, tidak bisa dipanggil lewat HTTP). Prosedur produksinya dari editor Apps Script: [docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md) §14 |
| 23 | **Pra-publish: UI portal di peramban SUNGGUHAN** | Tombol Masuk & tombol demo benar-benar membuka aplikasi (bukan pesan merah), termasuk dari keadaan sesi demo basi | Otomatis: gerbang pra-push (`npm run gate:push`, 14 pemeriksaan) + workflow [portal-preview.yml](../.github/workflows/portal-preview.yml) yang dijalankan pada setiap **preview deployment** Vercel. Manual: `npm run smoke:portal:live -- --url <alamat-preview>` (24 pemeriksaan, ± 5–11 detik, tanpa menulis data produksi) |

> **Checklist ini berlaku untuk kedua sisi:** `portal/` (frontend, tayang lewat build Vercel) dan `apps-script/` (backend, tayang lewat `npm run deploy:gas`). Perbaikan yang hanya menyentuh `portal/` **tidak** membuat Versi Apps Script baru — ia tayang begitu `git push origin main` memicu build Vercel; sebaliknya perubahan `gas/` tidak berpengaruh apa pun sampai dideploy. Bila keduanya berubah, jalankan `npm run deploy:gas` **dan** pastikan commit-nya ter-push.

> **Catatan ukuran berkas:** dulu seluruh backend digabung di satu `Backend.gs` yang tembus 199.360 karakter dan terus bertambah hingga 256.907 karakter — skrip build memperingatkan kedekatan batas ukuran berkas Apps Script. Sejak 2026-10-09 build dipecah per-modul: file backend terbesar kini `Auth.gs` (~41.400 karakter — tumbuh 2026-10-10 karena jalur pemulihan sandi) dan `Code.gs` (~32.700); hanya `AsetStempel.gs` (base64, ~53.400 karakter) yang mendekati separuh batas. Modul baru cukup ditambahkan ke `$order` di `scripts/build-apps-script.ps1`.

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
4. **Pemulihan Akses Admin (kredensial ditolak / tidak ada admin):**
   - Jalur pemulihannya ada di **editor Apps Script**, bukan lewat jaringan: `pemulihanSandiEditor()` (tanpa argumen, membaca Script Properties) mendiagnosa sebabnya lebih dahulu — akun tidak ada, sandi salah, akun nonaktif, atau `PASSWORD_SALT` berubah — lalu menyetel ulang sandi atas perintah eksplisit. Prosedur langkah demi langkah beserta cara membuktikan hasilnya: [docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md) §14.
   - Setiap penyetelan ulang menulis jejak `PASSWORD_RESET` (pelaku, akun, jumlah sesi dicabut) dan **mencabut sesi lama** akun tersebut, sehingga token yang mungkin sudah bocor ikut mati.
