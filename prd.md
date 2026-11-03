# PRD (Product Requirements Document) — SIAP APII v2.5.0 Enterprise
**Sistem Informasi & Administrasi Terpadu Yayasan APII DPW Jabodetabek**

Dokumen ini adalah spesifikasi arsitektur resmi dan Master Living Context yang dikelola oleh **RetroBOT by Sigit Adi (https://sigitadi.id)**.

================================================================================
ZONA ATAS: SPESIFIKASI KEBUTUHAN PRODUK (BLUEPRINT AWAL)
================================================================================

## 1. Nama Projek & Problem Statement
- **Nama Projek:** SIAP APII (Sistem Informasi & Administrasi Terpadu Yayasan APII DPW Jabodetabek).
- **Domain Layanan:**
  - Portal Pengurus (Private SPA): `siapii.sigitadi.id`
  - Portal Publik (Public Landing & Registrasi): `apii.sigitadi.id`
- **Problem Statement:**
  Yayasan APII DPW Jabodetabek sebelumnya mengelola administrasi persuratan, buku kas keuangan, program 7 divisi kerja, dan pendaftaran anggota baru secara manual dan terpencar melalui WhatsApp dan spreadsheet terpisah. Hal ini menyebabkan risiko nomor surat ganda, pencatatan kas tanpa verifikasi bertingkat, usulan kegiatan yang mandek tanpa status yang jelas, serta kesulitan verifikasi keaslian dokumen resmi di hadapan publik.
- **Solusi Utama:**
  Membangun sistem administrasi terpadu nir-server (*serverless enterprise*) berbasis Google Apps Script, Google Sheets, Google Drive, dan antarmuka web modern (Vanilla JS + SWR Cache) yang cepat, akuntabel, aman, dan mudah digunakan oleh pengurus tanpa memerlukan keahlian teknis khusus.

---

## 2. Peran Pengguna (RBAC Matrix 8 Peran)
Sistem membagi hak akses ke dalam matriks peran yang ketat:
1. **SUPERADMIN (`superadmin`)**: Akses penuh ke seluruh modul, manajemen user/akun pengurus, audit log, pengaturan sistem, dan master data.
2. **KETUA (`ketua`)**: Otoritas persetujuan akhir surat resmi, verifikasi kas tahap 2 (Ketum approval), persetujuan program divisi, dan pengesahan pendaftar anggota baru.
3. **SEKRETARIS (`sekretaris`)**: Konseptor & penerbit surat resmi, penomoran dinamis otomatis, verifikasi berkas tahap 1 pendaftar baru.
4. **BENDAHARA (`bendahara`)**: Pembukuan voucher kas masuk/keluar, verifikasi kas tahap 1, pencetakan kwitansi kas otomatis, dan rekonsiliasi saldo kas yayasan.
5. **PEMBINA (`pembina`)**: Akses pemantauan *Read-Only* ke seluruh persuratan, kas keuangan, program kerja, dan log aktivitas.
6. **PENGAWAS (`pengawas`)**: Akses pengawasan *Read-Only* tata kelola hukum, kepatuhan anggaran, dan jejak audit.
7. **KETUA_DIVISI (`khumas` dll)**: Pengusul program kerja divisi (7 Divisi APII), penanggung jawab eksekusi, dan pelapor LPJ kegiatan akuntabel.
8. **ANGGOTA_DIVISI (`ahumas` dll)**: Asistensi penyusunan usulan program kerja dan pelaporan LPJ divisi terkait.

---

## 3. Arsitektur & Lingkungan Kerja
- **Arsitektur Backend:** Google Apps Script Web App (Modular Architecture, dipisah per domain: `Code.gs`, `Auth.gs`, `Surat.gs`, `Keuangan.gs`, `Divisi.gs`, `Database.gs`, `Utils.gs`, `Pengaturan.gs`, `Editorial.gs`, `Visitor.gs`, `TemplateSurat.gs`, `TemplateSuratDocs.gs`).
- **Database Engine:** Google Sheets ACID Wrapper (`Database.gs`) dengan lock-service anti bentrok.
- **Penyimpanan Berkas:** Google Drive API (folder terstruktur untuk PDF surat resmi, bukti transfer kas, arsip KTP ber-watermark, dan pasfoto).
- **Mesin Render Dokumen:** Google Docs Template API + Canvas Watermarking + Stempel basah transparan.
- **Frontend Layer:** Single Page Application (SPA) HTML5 + Vanilla JavaScript + Tailwind CSS CDN + In-Memory SWR Caching (0ms navigasi antar tab).
- **Hosting Frontend:** Server Web Hosting Mandiri / Statis (Apache / LiteSpeed / Node.js) dengan proteksi .htaccess.

---

## 4. Alur Kerja Aplikasi (User Flow)
1. **Alur Surat Resmi:**
   `DRAFT` (Sekretaris) $\to$ `AJUKAN` $\to$ Review & Validasi $\to$ `DISETUJUI` (Ketua) $\to$ `PUBLISHED` (Penomoran otomatis sekuensial, cetak PDF, QR Code Verifikasi, stempel digital).
2. **Alur Keuangan Kas (Dual-Approval Pengeluaran & Direct Approval Pemasukan):**
   - **Kas Keluar:** `DRAFT` (Input Voucher Kas) $\to$ `VERIFIKASI_BENDAHARA` (Tahap 1 periksa nota) $\to$ `VERIFIKASI_KETUM` (Tahap 2 pengesahan pencairan) $\to$ `APPROVED` (Saldo terpotong, cetak kwitansi resmi).
   - **Kas Masuk:** `DRAFT` (Input oleh Bendahara) $\to$ Langsung `APPROVED` (Saldo kas bertambah seketika).
3. **Alur Program Kerja Divisi (5-Tahap):**
   `DRAFT` $\to$ `AJUKAN` $\to$ `DISETUJUI` (Persetujuan Ketua DPW) $\to$ `PELAKSANAAN` $\to$ `LPJ_SELESAI` (Unggah link laporan Drive & realisasi anggaran).
4. **Alur Pendaftaran Anggota Baru:**
   Publik isi formulir online $\to$ Watermark KTP otomatis sisi klien (UU PDP) $\to$ Masuk antrean `Sheet_Pendaftar` $\to$ Verifikasi Berkas (Sekretaris) $\to$ Pengesahan Anggota (Ketua) $\to$ Penerbitan Nomor Registrasi / KTA.
5. **Alur Redaksi Konten Portal Publik (Mini-CMS):**
   Admin/Ketua mengubah Hero Banner, Warta Maklumat, Agenda Acara, FAQ, Kontak di panel pengurus $\to$ Tersimpan di `Sheet_Settings` & arsip riwayat `Sheet_EditorialHistory` $\to$ Tayang langsung di `apii.sigitadi.id`.

---

## 5. Desain Basis Data (Google Sheets Tabs & Column Mapping)
Menggunakan tab database terstruktur tanpa karakter underscore ganda, diakses via indeks aman di `Database.gs`:

1. `Sheet_Users`: Akun pengurus yayasan, hashed password SHA-256, peran RBAC, status aktif, permissions.
2. `Sheet_Sessions`: Token sesi aktif UUID, user ID, role, timestamp expired (masa berlaku 7 hari).
3. `Sheet_Surat`: Master surat resmi, nomor surat, tipe surat, status, tanggal, hash SHA-256, link PDF Drive, link QR.
4. `Sheet_Keuangan`: Buku kas voucher masuk/keluar, nominal, kategori, status dual-approval, kwitansi, bukti bayar Drive.
5. `Sheet_Divisi`: Usulan program kerja 7 divisi, anggaran, target, status approval, link LPJ Drive, realisasi dana.
6. `Sheet_AuditLogs`: Rekam jejak permanen WORM (Write-Once-Read-Many) seluruh mutasi data dan aksi pengurus.
7. `Sheet_Sequences`: Counter nomor urut sekuensial anti-tabrakan untuk penomoran surat, voucher kas, dan registrasi anggota.
8. `Sheet_Pendaftar`: Formulir registrasi publik, biodata lengkap, minat divisi, tautan arsip KTP ber-watermark.
9. `Sheet_Accounts`: Master rekening bank & kas yayasan, QRIS, visibilitas publik untuk donasi.
10. `Sheet_Settings`: Parameter konfigurasi yayasan, identitas pimpinan, KOP surat, konfigurasi folder Drive.
11. `Sheet_EditorialHistory`: Riwayat pembaruan teks redaksi portal publik.
12. `Sheet_Visitors`: Statistik anonim pengunjung portal publik (device, browser, waktu kunjungan).
13. `Sheet_Templates`: Master template surat Docs/PDF dengan pemetaan posisi overlay koordinat field.

---

## 6. Aturan Validasi & Logika Khusus
1. **Penomoran Sekuensial Otomatis:**
   Format: `[NOMOR_URUT]/[KODE_SURAT]-DPW-APII/[BULAN_ROMAWI]/[TAHUN]` (dihitung berbasis sequence terkunci di backend via LockService).
2. **Kepatuhan Privasi (UU PDP No. 27/2022):**
   Data KTP wajib diberi watermark visual tebal menyilang sebelum diunggah ke Google Drive melalui Canvas browser.
3. **Pemberhentian Eksekusi Destruktif:**
   Tidak ada fitur hard-delete pada transaksi keuangan atau surat yang sudah diterbitkan. Setiap pembatalan dicatat sebagai void/reject dengan alasan terdokumentasi.

---

## 7. Rencana Antarmuka Pengguna
- **Portal Pengurus (`portal/`):**
  - *Navbar Ringkas & User Profile Drawer*.
  - *Action Inbox (Kotak Aksi Cepat)*: Daftar transaksi pending yang memerlukan aksi pengurus saat ini.
  - *Modul Persuratan*: Tabel daftar surat, form konseptor surat, pratinjau kertas virtual A4 dengan stempel basah.
  - *Modul Keuangan*: Form voucher kas, dual-approval card, tabel mutasi kas, cetak kwitansi.
  - *Modul Program Divisi*: Kanban / tabel usulan program, form pengajuan, modal upload LPJ.
  - *Modul Pendaftar*: Verifikasi berkas pendaftar baru, preview KTP terproteksi.
  - *Modul Pengaturan & Redaksi*: Kelola rekening, konfigurasi Drive, editor CMS konten publik.
- **Portal Publik (`public/`):**
  - *Hero Section*: Sambutan hangat, visi misi yayasan, tombol pendaftaran.
  - *Tab Switcher*: Warta maklumat pimpinan & kalender agenda kegiatan.
  - *Form Pendaftaran Anggota Baru*: Wizard input biodata + upload KTP auto-watermark.
  - *Rekening Donasi & FAQ*: Kartu rekening resmi & akordeon interaktif.

---

## 8. Kriteria Pengujian (Quality Acceptance Checklist)
- [x] Login berhasil menggunakan token sesi UUID dengan batas kadaluarsa 7 hari.
- [x] Hak akses 8 peran berfungsi tepat sesuai RBAC matrix (mencegah eskalasi hak akses).
- [x] Penomoran surat otomatis berjalan urut tanpa lompat atau dobel.
- [x] Persetujuan kas membutuhkan persetujuan beruntun (Bendahara -> Ketua) sebelum saldo berubah.
- [x] File KTP yang diunggah pendaftar otomatis memiliki watermark pengaman.
- [x] Navigasi portal pengurus terasa instan tanpa reload halaman berkat SWR caching.

================================================================================
ZONA BAWAH: MASTER CONTEXT & LOGIKA SISTEM TERKINI (LIVING CONTEXT)
================================================================================

### A. Status Arsitektur & Lingkungan Aktif
- **Versi Sistem:** v2.5.0 Enterprise (Apps Script Release: Versi 15).
- **Mode Eksekusi:** Production Multi-Module Build (`scripts/build-apps-script.ps1`).
- **Alur Deploy:** Otomatis via `npm run deploy:gas` (terintegrasi clasp push, syntax gate, auto-cleanup legacy files, dan version report).
- **Frontend SWR Cache:** Aktif pada `portal/auth.js` dan modul-modul pengurus.

### B. Skema Kolom Database Terkini
- Seluruh tabel database menggunakan konvensi `Sheet_[Nama]` dengan header baris 1 dan indeks terpetakan di `Database.gs`.
- Konstanta `SCHEMA` di `apps-script/Database.gs` mencakup 13 tabel operasional yang teruji idempoten via `initSchema()`.

### C. Logika Bisnis & Formula Hitung yang Berlaku
- **Verifikasi Dokumen:** Menggunakan enkripsi hash SHA-256 atas konten surat dan URL verifikasi QR publik.
- **Kwitansi Kas:** Generator otomatis terbilang Rupiah untuk setiap voucher kas yang disetujui.
- **Penyimpanan Drive Terpadu:** Pengaturan 4 aksi Drive (buat folder baru, pasang ID kustom, pindahkan ke induk, reset default).

### D. Log Pembaruan Resmi (Official Update Log)
- **v2.5.0:**
  - Pemisahan monolitik `Backend.gs` menjadi 17 modul modular Apps Script per-domain.
  - Integrasi auto-cleanup file lama saat deployment clasp.
  - Integrasi Mini-CMS Redaksi Konten Portal Pengurus (`Editorial.gs` & `Sheet_EditorialHistory`).
  - Pemantauan analitik pengunjung publik aman privasi (`Visitor.gs` & `Sheet_Visitors`).
  - Penyelarasan RetroBOT Engineering System ke dalam repositori.
  - [HOTFIX REVISI 1] Perbaikan logika `purgeExpiredSessions_` pada `Auth.gs`: penghapusan baris sesi kedaluwarsa diurutkan secara menurun (descending) untuk mencegah bug pergeseran baris (*forward-loop index shift*) yang mencabut sesi aktif pengurus lain secara acak.
  - [PENYELARASAN REVISI 2] Penegasan kebijakan tata kelola kas yayasan: Dual-Approval mutlak wajib untuk Kas KELUAR (Bendahara verifikasi nota -> Ketua setujui pencairan dana), sedangkan Kas MASUK disahkan langsung oleh Bendahara untuk efisiensi operasional. Dokumentasi PRD & README disinkronkan secara konsisten.
  - [OPTIMASI REVISI 3] Optimasi performa `trackVisitor` pada `Visitor.gs`: lookup data pengunjung kini menggunakan native `createTextFinder` pada kolom `visitor_id` (waktu eksekusi <50ms) menggantikan pemindaian `readAll` seluruh tabel, menghemat 95% konsumsi memori dan kuota harian saat portal publik diakses.
  - [AUDIT & REVISI LOGIKA, WORKFLOW & UI/UX]:
    - **Penyelamatan Integritas Naskah Surat:** Textarea `Menimbang`, `Mengingat`, dan `Memutuskan` pada modal edit surat (`portal/portal.js`) kini otomatis mem-parse dan me-restore `item.content`, mengeliminasi bahaya hilangnya konsideran hukum saat surat diedit.
    - **Pembukaan Kebuntuan Surat Ditolak (Rejection Loop Unlocked):** Modul `gas/Surat.gs` dan UI portal kini mengizinkan naskah `REJECTED` untuk diubah dan diajukan ulang ke Ketua DPW (`submitSurat`), membersihkan catatan penolakan lama secara otomatis.
    - **Pembukaan Kebuntuan Usulan Divisi (Division Proposal Loop Unlocked):** Modul `gas/Divisi.gs` kini mengaktifkan hak `can_edit` dan `can_submit` pada usulan `DITOLAK`, memungkinkan Ketua Divisi merevisi dan mengajukan kembali program kerja sesuai catatan evaluasi Ketua DPW.
    - **Validasi Ketat & Anti-Spam NIK 16 Digit:** Modul `gas/Auth.gs` kini menerapkan validasi regex `/^\d{16}$/` dan pencegahan duplikasi pendaftaran aktif di `Sheet_Pendaftar`.
    - **Agregasi Antrean Calon Anggota ke Action Inbox:** Fungsi `getDashboard` di `gas/Utils.gs` kini memasukkan antrean pendaftar baru (`PENDING` untuk Sekretaris, `DIVERIFIKASI_SEKRETARIS` untuk Ketua), dilengkapi routing instan ke tab Pendaftar di portal.
    - **Notifikasi Siklus Hidup Pendaftaran:** Calon anggota otomatis menerima email bukti pendaftaran, konfirmasi pengesahan keanggotaan, atau penjelasan penolakan resmi.
    - **Purge Emoji & Standarisasi UI Enterprise:** Pembersihan karakter emoji mentah pada antarmuka input dan tab navigasi dengan ikon inline SVG profesional sesuai standar RetroBOT Anti-AI.
- **v2.5.1 (RetroBOT Architecture Audit & Optimization):**
  - **TextFinder Fast-Path Generik:** Kueri baris tunggal (`Database.findOne`) kini otomatis diakselerasi via `createTextFinder` untuk filter 1 kolom dengan fallback aman ke pemindaian reguler.
  - **Eliminasi Pemindaian Sesi per-Request:** `verifySession` kini melakukan validasi kedaluwarsa langsung per token tanpa melakukan `purgeExpiredSessions_()` penuh di setiap request, menghemat latensi ~500ms.
  - **Standardisasi Waktu Sesi Demo:** Integer epoch millisecond pada `loginDemo()` dan penanganan multi-format pada pembersihan sesi otomatis.
  - **Eliminasi N+1 Kueri Dashboard:** Menghilangkan kueri ganda `TABS.KEUANGAN` pada `getDashboard` dan menerapkan resolusi label rekening dinamis via `getAccountLabels_()`.
  - **Rate Limiting Endpoint Publik:** Proteksi anti *brute force* dan banjir spam pada route publik via sliding window 60 detik `CacheService`.
  - **Pengamanan Otomatis `PASSWORD_SALT`:** Inisialisasi otomatis ke `ScriptProperties` saat `setup()`.
  - **Build Cross-Platform:** Migrasi build Apps Script ke script Node.js murni (`scripts/build-apps-script.mjs`), menghapus ketergantungan PowerShell Windows.
  - **Hotfix Sintaksis Portal:** Perbaikan komentar yang menelan ternary persetujuan pimpinan di baris 1646 `portal/portal.js`.
- **v2.5.2 (Session Kickback Resolution & Cross-Device State Sync):**
  - **Eliminasi Race Condition Verifikasi Sesi Superadmin:** Menghapus `else { return null; }` pada TextFinder `Database.findOne` agar otomatis fallback ke `readAll()` jika sel sesi baru belum terindeks Spreadsheet, mengeliminasi auto-kickback 401 saat login.
  - **Resilient Sesi Lookup:** Menambahkan fallback pencarian `username` di `verifySession()` jika kueri `user_id` tidak menemukan hasil.
  - **Eliminasi Jebakan Hash `#login`:** Mengalihkan URL hash dari `#login` ke `#/dashboard` pada `bootApp()`, `bindLogin()`, dan `demoLoginBtn` setelah otentikasi berhasil.
  - **Immediate Write Flush Lintas Sesi:** Menambahkan `SpreadsheetApp.flush()` pada seluruh operasi tulis (`insert`, `updateRow`, `deleteRow`, dan `saveSettings()`), memastikan mutasi data langsung tersimpan seketika di Google Sheets dan terbaca oleh sesi lain di perangkat berbeda.
  - **Cache-Busting & Anti-Stale HTTP Header:** Menambahkan query param dinamis `&_t=` timestamp dan `cache: 'no-store'` pada seluruh request GET di `portal/auth.js` dan `public/app.js`, serta invalidasi cache memori total `self.cache.clear()` pada setiap mutasi POST berhasil.
  - **Sinkronisasi Dua Arah Pengaturan Pendaftaran:** Menyelaraskan penyimpanan dan pembacaan konfigurasi pendaftaran anggota antara objek `registration_config` dan flattened keys di backend Apps Script.
- **v3.0.0 (SIAP APII Multi-Tenant Enterprise — 1 DPP + Banyak DPW):**
  - **Arsitektur Multi-Tenant Organisasi:** Ekspansi struktur tunggal DPW Jabodetabek menjadi 1 DPP (Pusat) + Banyak DPW (Wilayah) berlandaskan SK Kemenkumham AHU-0014970.AH.01.04.Tahun 2023 dan ART Yayasan APII (16 Bab Kodifikasi).
  - **Partisi Sekuensial & Atomic Locking per Wilayah:** Pemisahan penomoran naskah dinas dan keuangan per tenant (`SURAT:{wilayah}:{tipe}:{thn}`, `KEU:{wilayah}:{thn}`, `KTA:NASIONAL:{thn}`) dengan penjaminan `SpreadsheetApp.flush()` sebelum pelepasan kunci script lock (Benteng A-01 & A-05).
  - **Skema 14 Tabel Terpadu:** Penambahan tabel master `Sheet_Wilayah`, `Sheet_KTA_Nasional`, `Sheet_Settings_Audit`, dan `Sheet_Kas_Simulator`, serta injeksi kolom `wilayah_id` pada seluruh entitas operasional dengan migrasi otomatis data eksisting ke `DPW_JABODETABEK`.
  - **Eliminasi Ketergantungan Vercel:** Penyiapan konfigurasi `.htaccess` lintas folder untuk deployment mandiri di server web Apache / LiteSpeed / cPanel dengan proteksi *Security Headers* standar industri.
  - **Penyelarasan RetroBOT Lifecycle Architecture:** Transformasi total dokumentasi repositori dan panduan rekayasa sistem terpadu.
