# Yayasan APII DPW Jabodetabek — SIAP APII (v2.0.0 Enterprise)

**Sistem Informasi & Administrasi Terpadu Yayasan APII (Apologet Islam Indonesia)**  
Dewan Pimpinan Wilayah (DPW) Jabodetabek (Jakarta, Bogor, Depok, Tangerang, Bekasi)

Sistem administrasi yayasan modern nir-server (*serverless enterprise*) yang dibangun di atas **Google Apps Script** (backend API & state machine), **Google Sheets** (database ACID berelasi), **Google Drive** (penyimpanan dokumen & berkas terenkripsi), dan **HTML5 + Vanilla JavaScript (SWR Caching) + Tailwind CSS** (frontend antarmuka pengguna). Bebas biaya sewa server VM, stabil, aman, dan siap pakai.

> **Filosofi Sistem:** _"Amanah, Transparan, Cepat, dan Akuntabel."_ Menghubungkan seluruh tata kelola persuratan, buku kas keuangan, program kerja divisi, dan penerimaan anggota baru dalam satu ekosistem terpadu.

---

## 🧱 Tumpukan Teknologi (Technology Stack)

| Lapisan | Teknologi | Peran & Keterangan |
| :--- | :--- | :--- |
| **Backend API** | **Google Apps Script** (`doGet` / `doPost`) | RESTful JSON API, RBAC 8 peran, state machine, generator PDF Docs |
| **Database ACID** | **Google Sheets** | Sheet: `Users`, `Sessions`, `Surat`, `Keuangan`, `Divisi`, `AuditLogs`, `Pendaftar`, `Settings`, `Accounts` |
| **Penyimpanan Dokumen** | **Google Drive** | Arsip PDF surat resmi, kwitansi kas, berkas foto KTP & pas foto |
| **Mesin Render PDF** | **Google Docs Template API** | Kop yayasan, logo resmi, nomor surat otomatis, dan stempel basah |
| **Portal Pengurus (SPA)** | Vanilla JS + SWR Cache + Tailwind CDN | Domain **`siapii.sigitadi.id`** (Akses eksklusif 8 peran pengurus) |
| **Portal Publik** | Vanilla JS + Canvas Watermark + Tailwind CDN | Domain **`apii.sigitadi.id`** (Pendaftaran anggota & profil yayasan) |
| **Otentikasi & Keamanan** | Password Hashing SHA-256 + Sesi Token UUID | Masa berlaku sesi 7 hari, proteksi XSS/CSRF, sanitasi payload |
| **Kepatuhan Privasi** | **UU PDP No. 27/2022** + Canvas Watermarking | Watermark otomatis sisi klien sebelum berkas KTP dikirim ke server |

---

## ✨ Fitur-Fitur Unggulan

### 1. Portal Pengurus (`siapii.sigitadi.id`)
- **Navigasi Super Cepat (0ms Latency)**: Didukung mesin *Stale-While-Revalidate (SWR)* dan *Route Prefetching* di `portal/auth.js`.
- **Kotak Aksi Terpadu (*Action Inbox*)**: Dashboard pimpinan dengan rangkuman aksi mendesak (surat menunggu persetujuan, voucher kas verifikasi, dan usulan divisi).
- **Modul Persuratan Resmi**:
  - Penomoran otomatis dinamis (misal: `042/SK-DPW-APII/III/2026`).
  - Pratinjau Kertas Virtual A4 dengan stempel basah transparan (*mix-blend-mode*) dan watermark status.
  - Cetak ramah printer (`@media print`) dan unduh PDF resmi.
- **Modul Keuangan Kas Dual-Approval**:
  - Pencatatan voucher masuk/keluar oleh Bendahara.
  - Verifikasi ganda: Tahap 1 oleh Bendahara $\to$ Tahap 2 oleh Ketua DPW.
  - Cetak kwitansi kas otomatis terbilang Rupiah dan integrasi bukti bayar Google Drive.
- **Siklus Hidup Usulan Divisi (5-Tahap)**:
  - `DRAFT` $\to$ `AJUKAN` $\to$ `DISETUJUI` $\to$ `PELAKSANAAN` $\to$ `LPJ_SELESAI`.
  - Formulir penyerahan LPJ akuntabel dengan tautan laporan Google Drive dan realisasi anggaran akhir.
- **Manajemen Pendaftar Anggota Baru**:
  - Meninjau berkas pendaftar masuk dari portal publik.
  - Pratinjau KTP ber-watermark dan foto selfie pemohon.
  - Verifikasi berkas oleh Sekretaris $\to$ Pengesahan resmi anggota oleh Ketua DPW.
- **Pengaturan & Master Data Terpadu (Superadmin & Ketua)**:
  - Master rekening bank kas yayasan (CRUD & toggle publik).
  - Master format penomoran dan jenis surat baru (`NOTULEN`, `RAPAT`, `BA`, dll).
  - Upload gambar KOP surat resmi dengan pratinjau Canvas.
  - **Manajemen Penyimpanan Google Drive Terpadu (4 Kotak Aksi)**: Buat folder baru instan di Drive dengan subfolder resmi, gunakan custom ID folder, pindahkan folder aktif ke induk, dan tombol reset satu-klik ke default organisasi.
  - **Modul Redaksi Konten Portal (Mini-CMS Pengurus)**: Sub-tab ke-7 di menu Pengaturan untuk mengelola teks Hero, Sambutan & Visi-Misi, Warta Maklumat Resmi, Agenda Kegiatan DPW, FAQ Akordeon, dan Media Sosial secara mandiri.
- **Jejak Audit Permanen (WORM — Anti-Hapus)**:
  - Seluruh mutasi data dan aktivitas tercatat permanen di `Sheet_AuditLogs` tanpa tombol hapus.

### 2. Portal Publik (`apii.sigitadi.id`)
- **Penyajian Konten Dinamis Terpadu (Single Page Landing)**:
  - **Hero & Tagline Berdasarkan Momen**: Menampilkan headline, deskripsi, dan tombol aksi yang disinkronkan langsung dari panel redaksi.
  - **Seksi Profil Lembaga & Sambutan Pimpinan**: Sambutan resmi Ketua DPW APII Jabodetabek dan komitmen visi-misi keumatan.
  - **Seksi Warta Maklumat & Agenda Acara**: Tab switcher interaktif menyajikan instruksi/maklumat resmi pimpinan dan kalender kegiatan/kajian DPW mendatang lengkap dengan link registrasi dan unduh lampiran.
  - **Akordeon Tanya Jawab (FAQ)**: Jawaban interaktif atas pertanyaan calon anggota dan masyarakat umum.
  - **Kontak & Media Sosial Resmi**: Alamat, email, jam layanan, WhatsApp helpdesk, dan tautan kanal YouTube/Instagram/WA Channel.
- **Formulir Pendaftaran Calon Anggota Baru**:
  - Entri biodata terstruktur: Nama KTP, NIK 16 digit, TTL, Gender, WhatsApp (+62), Email, Profesi, Domisili Jabodetabek, dan Minat 7 Divisi Kerja.
- **Watermark KTP Otomatis Sisi Klien (HTML5 Canvas)**:
  - Mencegah penyalahgunaan identitas dengan cap pengaman diagonal (*"ARSIP PENDAFTARAN APII DPW JABODETABEK - [TANGGAL]"*).
- **Tanda Terima Pendaftaran Digital (Receipt Modal)**:
  - Kode registrasi unik `REG-YYYY-XXXX`, masking NIK terproteksi, dan tombol konfirmasi instan ke WhatsApp Sekretariat.
- **Privasi & Keamanan Maksimal**:
  - Sesuai amanat UU PDP No. 27/2022, data e-KTA tidak dipublikasikan ke publik.
  - Tautan portal pengurus disembunyikan sepenuhnya dari pandangan publik.
  - Formulir verifikasi dokumen internal dinonaktifkan dari akses publik.

---

## 👥 8 Peran Resmi Pengurus Yayasan (RBAC Matrix)

| Username | Peran (*Role*) | Hak Akses Utama |
| :--- | :--- | :--- |
| `superadmin` | **SUPERADMIN** | Akses penuh sistem, manajemen akun pengurus, master data, konfigurasi |
| `ketua` | **KETUA** | Pengesahan akhir surat, persetujuan voucher kas, persetujuan usulan program, pengesahan anggota |
| `sekretaris` | **SEKRETARIS** | Konseptor surat, penomoran dinamis, verifikasi tahap 1 berkas pendaftar anggota baru |
| `bendahara` | **BENDAHARA** | Pembukuan voucher kas, verifikasi kas tahap 1, cetak kwitansi, laporan saldo buku kas |
| `pembina` | **PEMBINA** | Read-Only: Pemantauan kinerja persuratan, buku kas keuangan, program divisi, jejak audit |
| `pengawas` | **PENGAWAS** | Read-Only: Pengawasan kepatuhan hukum, mutasi kas, dan rekam jejak audit sistem |
| `khumas` | **KETUA_DIVISI** | Pengusul program kerja divisi, eksekusi kegiatan, dan penyerahan LPJ akuntabel |
| `ahumas` | **ANGGOTA_DIVISI** | Pelaksana program kerja divisi, asistensi penyusunan usulan program & LPJ |

> *Catatan:* Seluruh akun pengurus bawaan menggunakan password awal: `apii2026`. Harap ubah password saat pertama kali masuk melalui menu Profil Saya.

---

## 🚀 Prosedur Deployment & Pembaruan

### 1. Kompilasi Backend Google Apps Script
Jalankan script bundler PowerShell dari root direktori proyek:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-apps-script.ps1
```
Hasil kompilasi siap-tempel akan diperbarui di folder `apps-script/`:
- `apps-script/Backend.gs`
- `apps-script/AsetLogo.gs`
- `apps-script/AsetStempel.gs`
- `apps-script/appsscript.json` (manifest, disalin dari `gas/appsscript.json` — wajib ada saat `clasp push`)

### 2. Deploy ke Google Apps Script — SATU perintah

```bash
npm run deploy:gas
```

Perintah ini menjalankan seluruh rangkaian secara otomatis: kompilasi bundel → validasi sintaks → preflight daftar berkas yang akan diunggah → `clasp push` → pembuatan **Versi baru** → pembaruan **deployment yang sama** (URL `/exec` tidak berubah, jadi tidak perlu menyunting `portal/config.js` / `public/config.js`).

> **Status produksi (2026-10-09):** backend tayang sebagai **Versi 13** dari `main` dengan URL `/exec` yang tidak berubah, isinya identik dengan `apps-script/` lokal. Ringkasan lengkap: [CHANGELOG.md](./CHANGELOG.md) → **Status Produksi Terkini**.

Prasyarat **sekali saja**:
1. Login CLI (membuka peramban akun Google yayasan):
   ```bash
   npx --yes @google/clasp@3 login
   ```
2. Isi **Script ID** di `.env` (tidak ikut ter-commit): buka Apps Script → ⚙ **Project Settings** → **IDs** → **Script ID**, lalu tulis `GAS_SCRIPT_ID=<nilai>`.
3. Aktifkan **Google Apps Script API** untuk akun tersebut di [script.google.com/home/usersettings](https://script.google.com/home/usersettings). Tanpa ini unggahan ditolak Google dengan pesan `User has not enabled the Apps Script API`.
4. Uji tanpa mengunggah apa pun (build + validasi + preflight berkas):
   ```bash
   npm run deploy:gas:check
   ```

> **Catatan:** `clasp` tidak pernah menghapus berkas di editor Apps Script. Pastikan project tersebut hanya berisi `Backend.gs`, `AsetLogo.gs`, `AsetStempel.gs`, dan `appsscript.json`; hapus sekali secara manual bila masih ada sisa berkas lama (mis. `Aset.gs`) agar tidak terjadi definisi fungsi ganda.

### 2b. Alternatif Manual (bila CLI belum dapat digunakan)
1. Buka [script.google.com](https://script.google.com) pada project yayasan Anda.
2. Salin isi masing-masing file dari folder `apps-script/` ke file script di editor Apps Script.
3. Simpan (Ctrl + S).
4. Klik **Deploy** $\to$ **Manage deployments** $\to$ Pilih versi **New version** $\to$ **Deploy**.
5. Pastikan URL endpoint Web App sinkron pada `portal/config.js` dan `public/config.js`.

### 3. Deployment Frontend via Vercel (CI/CD Otomatis)
Cukup lakukan commit dan push ke branch `main`:
```bash
git add .
git commit -m "feat(release): update sistem siap apii"
git push origin main
```
Vercel akan otomatis men-deploy versi terbaru ke domain produksi:
- Portal Pengurus: `https://siapii.sigitadi.id`
- Portal Publik: `https://apii.sigitadi.id`

---

## 📚 Indeks Dokumentasi

- **[CHANGELOG.md](./CHANGELOG.md)** — Catatan riwayat versi, fitur baru, dan perubahan sistem
- **[docs/REDAKSI_KONTEN.md](./docs/REDAKSI_KONTEN.md)** — Spesifikasi teknis redaksi konten dinamis portal publik (Mini-CMS)
- **[docs/VERSION_CONTROL.md](./docs/VERSION_CONTROL.md)** — Standar Git workflow, branching, dan deployment pipeline
- **[docs/deploy.md](./docs/deploy.md)** — Panduan deployment produksi, konfigurasi DNS CNAME, dan checklist rilis
- **[docs/DESIGN.md](./docs/DESIGN.md)** — Dokumen arsitektur teknis, relasi spreadsheet, dan diagram alur
- **[docs/PRD.md](./docs/PRD.md)** — Product Requirements Document (kebutuhan bisnis dan fungsi)
- **[docs/rbac-matrix.md](./docs/rbac-matrix.md)** — Matriks kewenangan RBAC 8 peran pengurus

---

## 📄 Lisensi & Hak Cipta

Hak Cipta © 2026 **Yayasan APII DPW Jabodetabek**. Seluruh hak dilindungi undang-undang.
Sistem ini dikembangkan khusus untuk operasional resmi organisasi APII.
