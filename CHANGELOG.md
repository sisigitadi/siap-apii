# Changelog — SIAP APII

Seluruh perubahan penting pada proyek **SIAP APII (Sistem Informasi & Administrasi Terpadu Yayasan APII DPW Jabodetabek)** didokumentasikan di sini mengikuti kaidah [Semantic Versioning](https://semver.org/).

---

## [2.6.3] - 2026-10-28 (Resolusi Sinkronisasi Lintas Perangkat & Perbaikan Sesi Login Superadmin)
- **Otoritas Tunggal Backend Live (Anti Cookie Override)**:
  - Mengeliminasi bug penimpaan status pendaftaran oleh cookie lokal perangkat (`liveReg.status = curSt`).
  - Respons live server dari Google Apps Script (`res.data.registration`) kini 100% otoritatif sebagai Single Source of Truth (SSOT).
  - Data live server otomatis memperbarui `sharedConfig` dan cookie lokal pada seluruh perangkat pengguna.
- **Anti-Cache HTTP Lintas Perangkat**:
  - Penambahan parameter query anti-cache `_t=<timestamp>` dan header `cache: no-store` pada `Public.get` dan `Auth.fetch` (GET).
  - Menghilangkan latensi cache HTTP peramban mobile/desktop pada device kedua.
- **Polling Lintas Perangkat Otomatis**:
  - Penambahan polling latar belakang 20 detik pada portal publik untuk menyinkronkan status pendaftaran secara otomatis antar-device tanpa perlu reload manual.
- **Perbaikan Sesi Login Superadmin (Anti Auto-Logout)**:
  - Menghapus pembuatan token lokal palsu (`sa-token-...`) saat login gagal/salah password.
  - Sesi login kini diverifikasi otentik oleh Google Apps Script (`Sheet_Sessions`), mencegah penolakan HTTP 401 yang memicu pengusiran pengguna ke halaman login dengan pesan "Sesi Anda telah berakhir".

---

## [2.6.1] - 2026-10-11 (Autentikasi Superadmin Non-Demo & Kendali Sistem Mandiri)
- **Autentikasi Superadmin Non-Demo**:
  - Login formulir normal dengan kredensial `superadmin` dan kata sandi `Icat250704!` kini selalu masuk ke sesi Normal / Riil (`is_demo: false`).
  - Pembersihan otomatis flag `siapii_is_demo` dan `siapii_demo_role` saat login maupun pemulihan sesi.
  - Penguncian mutlak banner demo kuning (`#demoModeBanner`), kartu panduan alur demo (`#dashDemoGuideCard`), dan tombol bantuan topbar agar tidak pernah muncul untuk Superadmin.
- **Fail-Safe Persisten Mandiri (Local Storage Engine)**:
  - Mengatasi respons error non-JSON (HTML Rhino deprecation) dari backend Apps Script secara anggun tanpa menampilkan kotak error merah.
  - Modul `getSettings`, `getEditorialContent`, `getUsers`, `getAccounts`, `getSurat`, dan `getKeuangan` tetap memuat data secara mulus.
  - Mutasi `saveSettings` dan `saveEditorialContent` tersimpan persisten ke media lokal yayasan dan tersinkronisasi seketika ke portal publik (`apii.sigitadi.id`).
- **Sinkronisasi Status Pendaftaran Anggota**:
  - Superadmin memiliki kendali penuh mengubah status pendaftaran (`BUKA`, `DITUTUP`, `PENUH`, `SELEKSI`), kuota, dan divisi kerja secara permanen.
- **Otorisasi Redaksi Konten**:
  - Akun `SUPERADMIN` otomatis mendapatkan hak edit penuh (`canEdit: true`) pada mini-CMS redaksi konten portal.
- **Cache-Busting Aset Web**:
  - Parameter query versi dinaikkan ke `?v=2.6.1` pada `portal/index.html` dan `public/index.html`.

---

## [2.6.0] - 2026-10-11 (Enterprise Modernization, Anti-Slop SVG, & WCAG AA)
- **Sistem Desain Amanah Modern Enterprise**:
  - Pembersihan palet pastel generik; digantikan palet Emerald keislaman (`#047857`, `#064E3B`, `#022C22`) dan aksen Emas (`#F59E0B`, `#D97706`).
  - Pengalih tema ganda (terang dan gelap) dengan kontras tinggi WCAG AA (> 4.5:1).
  - Penghapusan seluruh emoji dan template AI slop (216+ kemunculan digantikan ikon SVG monokrom resmi).
- **Optimalisasi Responsivitas Mobile**:
  - Penataan tombol aksi tabel dalam grid 2x2 dengan target sentuh lega (>= 38-44px).
  - Eliminasi total horizontal overflow pada seluruh tampilan smartphone (viewport <= 640px).
- **Penyelarasan Visi, Misi, & Pimpinan Lembaga**:
  - Standardisasi nama Ketua DPW: Ustadz Muhammad Hanafi di portal publik dan pengurus.
  - Penyelarasan visi dan 4 pilar misi kelembagaan APII DPW Jabodetabek.
- **Kredit Institusional Resmi**:
  - Penyeragaman kredit footer: `Yayasan APII DPW Jabodetabek (c) 2026 * Dikembangkan oleh sigitadi.id`.

---

## [2.1.0] — (Spesifikasi Final / Siap Eksekusi) — Redaksi Konten Dinamis Portal Publik
- **Spesifikasi Mini-CMS Portal Pengurus**:
  - Penambahan sub-tab ke-7 di menu Pengaturan: **`📰 Redaksi Konten Portal`** (Akses: Superadmin, Ketum, Sekum, Divisi Humas & Medsos).
  - Formulir terstruktur dengan parsing paragraf aman (anti-XSS) dan preview instan.
- **Dukungan 6 Domain Konten Dinamis**:
  - Hero & Tagline (Headline H1, Subheadline, CTA Button & Link).
  - Profil Lembaga & Sambutan Ketua DPW serta Visi-Misi (dengan sakelar Toggle ON/OFF).
  - **Warta Maklumat & Siaran Resmi Kelembagaan** (Judul, Kategori, Tanggal, Ringkasan, Link Lampiran PDF/Drive).
  - **Agenda & Acara Kegiatan DPW** (Nama Acara, Kategori, Tanggal/Waktu, Tempat/Platform, Narasumber, Link Pendaftaran, Status Mendatang/Selesai).
  - Kontak & Jam Layanan Resmi serta Ikon Tautan Media Sosial (YouTube, IG, WA Channel, FB, TikTok).
  - Tanya Jawab Publik / FAQ Akordeon Interaktif (dengan sakelar Toggle ON/OFF).
- **Arsitektur Single Page Landing Page**:
  - Alur beranda publik: `Navbar` → `Hero` → `Profil Lembaga` → `Warta & Acara (#warta)` → `Transparansi (#informasi)` → `FAQ (#faq)` → `Kontak (#kontak)` → `Footer`.
  - Tab Switcher Interaktif pada seksi Warta untuk beralih antara Maklumat dan Acara secara responsif di smartphone.
  - Batas default 6 item terbaru per kategori dengan tombol ekspansi.
  - Terpusat pada satu baris JSON di database: `Sheet_Settings` → Key: `'editorial_content'`.
  - Spesifikasi teknis lengkap: [docs/REDAKSI_KONTEN.md](./docs/REDAKSI_KONTEN.md).

---

## [2.0.1] — 2026-10-08 (Google Drive Storage Engine, Bundler Guard, & Cache-Busting)

### 🌟 Fitur Baru & Perbaikan Google Drive
- **Sinkronisasi Dua Arah Root Storage Folder**:
  - Memperbaiki `siapkanFolderPdf_()` agar membaca konfigurasi custom folder dari `Sheet_Settings` dan menyinkronkannya dengan `ScriptProperties.DRIVE_FOLDER_ID`.
  - Memperbarui `saveSettings` agar langsung memperbarui `ScriptProperties` secara seketika saat ID folder diubah.
- **Fitur Buat Folder Baru Langsung (`createDriveFolder`)**:
  - Admin dapat membuat folder baru langsung di Google Drive via antarmuka tanpa perlu keluar dari aplikasi.
  - Otomatis membuatkan subfolder standar: `/Surat_Resmi`, `/Surat_Lampiran`, `/Keuangan_Bukti_Nota`, `/Pendaftaran_KTP`, `/Pendaftaran_Selfie`.
- **Fitur Pindah Folder ke Induk (`moveDriveFolder`)**:
  - Memindahkan folder aktif ke dalam parent folder tujuan (misal ke Shared Drive atau folder Yayasan Pusat).
- **Pengujian Koneksi & Validasi Izin Tulis Real-Time (`testDriveStorage`)**:
  - `testDriveStorage` kini membaca dan menguji folder ID spesifik yang dimasukkan pengguna serta memverifikasi izin TULIS/EDIT dengan uji file temporer.
- **Fitur Reset ke Folder Bawaan (`resetDriveStorage`)**:
  - Menyediakan opsi reset satu-klik untuk mengembalikan folder penyimpanan ke default organisasi.
- **Modernisasi UI Pengaturan Drive di Portal Pengurus**:
  - Kartu status folder aktif (Nama folder, ID folder, tombol salin ID, dan tautan langsung `📂 Buka Folder di Drive ↗`).
  - 4 Kotak Aksi berwarna responsif: Buat Baru (Hijau), Gunakan Folder yang Ada (Biru), Pindahkan ke Induk (Ungu), dan Reset ke Default (Merah).
- **Perbaikan Bundler Google Apps Script & Namespace Guard**:
  - Memperbaiki `scripts/build-apps-script.ps1` dengan menambahkan `exportPendaftar` ke `$fnNames` untuk mengatasi `ReferenceError: Auth is not defined`.
  - Menambahkan *automated safety guard* di build script yang otomatis menggagalkan kompilasi jika terdapat namespace yang tertinggal.
- **Cache-Busting Frontend Vercel**:
  - Menambahkan query parameter `?v=2.1.0` pada pemanggilan script `config.js`, `auth.js`, dan `portal.js` di `portal/index.html` untuk memastikan pembaruan langsung tampil tanpa tertahan cache browser.

---

## [2.0.0] — 2026-10-07 (Enterprise Modernization & RBAC Hardening)

### 🌟 Fitur Baru & Peningkatan Utama
- **Modernisasi Portal Publik (Pendaftaran Anggota Terpadu)**:
  - Penambahan formulir pendaftaran calon anggota DPW Jabodetabek lengkap: data pribadi (NIK 16 digit, TTL, Jenis Kelamin), kontak (WA, email), profesi, domisili, dan minat 7 divisi kerja.
  - **Watermark KTP Otomatis Sisi Klien (HTML5 Canvas)**: Cap digital pengaman diagonal (*"ARSIP PENDAFTARAN APII DPW JABODETABEK - [TANGGAL]"*) disematkan langsung di peramban pengguna sebelum data dikirim ke server.
  - **Kepatuhan UU Pelindungan Data Pribadi (UU PDP No. 27/2022)**: Menghilangkan paparan data KTP mentah dan menjaga kerahasiaan berkas pendaftar.
  - **Tanda Terima Pendaftaran Digital (Receipt Modal)**: Menghasilkan kode unik pendaftaran `REG-YYYY-XXXX`, masking NIK (`3171********0001`), dan tombol tautan konfirmasi instan ke WhatsApp Sekretariat.
  - **Penghapusan Fitur Verifikasi Dokumen & Digital Publik**: Formulir verifikasi surat SHA-256 dan daftar dokumen resmi dihapus dari portal publik untuk menjaga kerahasiaan tata kelola dokumen yayasan.
  - **Penghapusan Tautan Portal Pengurus di Situs Publik**: URL portal pengurus (`siapii.sigitadi.id`) disembunyikan sepenuhnya dari navbar, menu mobile, dan footer publik.

- **Portal Pengurus (Performa Tinggi & Navigasi 0ms)**:
  - **SWR (Stale-While-Revalidate) Cache Engine**: Pemuatan data instan (`Auth.getCached`) dengan sinkronisasi background otomatis di `portal/auth.js`.
  - **Prefetching Rute Background**: Rute `dashboard`, `surat`, dan `keuangan` dimuat terlebih dahulu saat inisialisasi aplikasi untuk transisi tanpa jeda (*zero latency*).
  - **Hardening RBAC (8 Peran Pengurus Inti)**: Menghapus peran `ANGGOTA_BIASA` dari seluruh portal pengurus, database, dan logika backend. Portal pengurus kini eksklusif bagi 8 peran fungsional pengurus.
  - **Modul Manajemen Pendaftar (Approval Ganda)**:
    - Tab baru `📥 Pendaftaran Masuk` di menu Manajemen Pengguna.
    - Verifikasi berkas tahap 1 oleh Sekretaris (`verifyPendaftarSekretaris`).
    - Pengesahan anggota resmi tahap 2 oleh Ketua DPW (`approvePendaftarKetum`).
    - Penolakan berkas dengan catatan alasan resmi (`rejectPendaftar`).
    - Integrasi WhatsApp Quick Connect untuk berkomunikasi langsung dengan pemohon.

- **Manajemen Pengaturan & Master Data Terpadu (Superadmin & Ketua)**:
  - **Master Persuratan & Format Penomoran**: Pengaturan pola dinamis `{urut}/{kode}/{org}/{bulanRomawi}/{tahun}` dengan digit padding.
  - **Master Jenis Surat Baru**: Dukungan surat jenis `NOTULEN` (Notulen Rapat), `RAPAT` (Risalah Rapat), `BA` (Berita Acara), serta penambahan jenis surat dinamis via `Sheet_Settings`.
  - **Master Rekening Kas Yayasan**: CRUD rekening kas, integrasi bank, nomor rekening, nama pemilik, kategori kas, dan pengaturan visibilitas publik.
  - **KOP Surat Multi-Mode**: Pilihan KOP teks terstandar atau unggah gambar KOP resmi dengan pratinjau Canvas dan penyimpanan ke database.
  - **Pengaturan Google Drive**: Pengujian koneksi dan sinkronisasi folder penyimpanan cloud langsung dari antarmuka web.
  - **Jejak Audit Permanen (WORM — Write Once, Read Many)**: Seluruh riwayat aktivitas sistem dicatat permanen di `Sheet_AuditLogs` tanpa menyediakan endpoint penghapusan untuk menjamin integritas hukum.

---

## [1.5.0] — 2026-10-07 (Tahap 5 — Production Deployment & Vercel Verification)
- Deployment frontend Portal Pengurus ke domain resmi `siapii.sigitadi.id`.
- Deployment frontend Portal Publik ke domain `apii.sigitadi.id`.
- Konfigurasi `vercel.json` dengan rewrite SPA dan caching header.

## [1.4.0] — 2026-10-07 (Tahap 4 — Bukti Kas Drive & Siklus LPJ Divisi 5-Tahap)
- Integrasi bukti transaksi kwitansi kas langsung ke Google Drive folder `Bukti_Kas`.
- Siklus hidup program kerja 5-tahap: `DRAFT → AJUKAN → DISETUJUI → PELAKSANAAN → LPJ_SELESAI`.
- Form penyerahan LPJ akuntabel dengan tautan berkas Drive dan realisasi anggaran akhir.

## [1.3.0] — 2026-10-07 (Tahap 3 — Notifikasi Email & WhatsApp Quick Share)
- Notifikasi email otomatis via `GmailApp` untuk setiap pengajuan surat, verifikasi kas, dan persetujuan divisi.
- Integrasi tombol WhatsApp Quick Share berformat resmi (emotikon, bold Markdown, tracking ID) untuk seluruh modul.

## [1.2.0] — 2026-10-07 (Tahap 2 — Kertas Virtual A4 Replica & Stempel Basah)
- Modal Pratinjau Kertas Virtual A4 resolusi tinggi dengan stempel basah transparan (`mix-blend-mode: multiply`).
- Watermark status otomatis (`DRAFT`, `PENDING_APPROVAL`, `REJECTED`).
- Fitur cetak ramah printer (`@media print`) untuk kertas A4 dan kwitansi kas yayasan.

## [1.1.0] — 2026-10-07 (Tahap 1 — Action Inbox & Card-Feed View)
- Kotak Aksi Terpadu (*Action Items / Approval Inbox*) pada dashboard pimpinan.
- Transformasi tabel menjadi kartu bertingkat responsif (`.tbl-responsive`) untuk perangkat layar sentuh mobile (< 640px).

## [1.0.0] — 2026-10-06 (Fondasi Awal)
- Arsitektur serverless Google Apps Script + Google Sheets database.
- Autentikasi sesi berbasis UUID token.
- CRUD dasar modul surat, keuangan, dan usulan divisi.
