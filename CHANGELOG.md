# Changelog — SIAP APII

Seluruh perubahan penting pada proyek **SIAP APII (Sistem Informasi & Administrasi Terpadu Yayasan APII DPW Jabodetabek)** didokumentasikan di sini mengikuti kaidah [Semantic Versioning](https://semver.org/).

---

## [2.4.0] — 2026-10-08 (Ekspor & Impor Konten Redaksi sebagai Berkas JSON)

### 🌟 Fitur Baru
- **Cadangan & pemindahan konten redaksi lewat berkas JSON**: tab `📰 Redaksi Konten` kini memiliki kartu **`8. Cadangan & Pemindahan Konten (Ekspor/Impor JSON)`**.
  - Panel **📤 Ekspor Konten Aktif** mengunduh satu berkas mandiri (`redaksi-apii-YYYY-MM-DD-HHMM.json`) berisi penanda format `apii-editorial-v1`, waktu & pelaku ekspor, asal lingkungan, ringkasan jumlah item, dan seluruh konten ternormalisasi.
  - Panel **📥 Impor dari Berkas** memvalidasi & meringkas isi berkas pada modal konfirmasi (nama berkas, ukuran, waktu & pelaku ekspor, jumlah maklumat/agenda/FAQ/misi, badge & judul hero) sebelum konten diganti.
  - Setelah impor, kartu editor dimuat ulang dengan konten hasil impor dan Riwayat Versi menandai aksi tersebut dengan label **`IMPOR BERKAS`**.
- **Endpoint baru**: `exportEditorialContent` (GET) & `importEditorialContent` (POST), keduanya khusus `SUPERADMIN` & `KETUA` (wajib sesi login).
- **Impor selalu dapat dibatalkan**: konten yang sedang aktif diarsipkan lebih dahulu (label `Sebelum impor berkas (…)`), lalu hasil impor dicatat sebagai aksi `IMPORT`; keduanya tercatat di `Sheet_AuditLogs` (`EDITORIAL_EXPORTED` / `EDITORIAL_IMPORTED`).

### 🛡️ Ketahanan Impor
- **Berkas tanpa satu pun bagian konten redaksi ditolak** (`hero`, `profile`, `bulletins_events`, `contact`, `social`, `faqs`, `faqs_show`), sehingga berkas JSON sembarang tidak dapat mengosongkan konten produksi menjadi nilai bawaan; tes juga memastikan penolakan **tidak menambah versi riwayat** dan tidak mengubah konten aktif.
- **Penanda format diperiksa**: `format` yang bukan `apii-editorial*` ditolak dengan pesan yang menyebutkan format berkasnya. JSON tidak sah, array JSON, berkas kosong, dan payload kosong juga ditolak dengan pesan yang jelas.
- **Tahan terhadap berkas yang disunting manual**: seluruh isi dinormalisasi ulang (trim, batas panjang, batas jumlah item, pembuangan tautan `javascript:`/`data:`), dan batas sel Google Sheets (`EDITORIAL_CELL_SAFE` 45.000 karakter) tetap berlaku — impor di atas batas ditolak **tanpa menulis apa pun**.
- **Tiga bentuk berkas diterima**: berkas ekspor penuh, objek konten mentah (bentuk yang tampil pada *Lihat JSON lengkap versi ini* di Riwayat Versi), atau teks JSON — BOM di awal berkas ditoleransi.
- Impor tanpa perubahan tidak menghasilkan versi riwayat baru, dan berkas ekspor tidak memuat data sensitif pengurus maupun baris riwayat versi.

### 🧪 Verifikasi & Dokumentasi
- `scripts/smoke-editorial.mjs` diperluas dari 93 → **138 pemeriksaan**: ekspor (nama berkas, penanda format, pelaku, asal lingkungan, audit, konten tidak berubah), pemindahan antar dua lingkungan yang isinya identik, pemulihan berkas pra-impor, tiga bentuk berkas yang diterima, enam bentuk berkas tidak sah yang ditolak tanpa menyentuh konten, sanitasi & batas sel, serta **jalur `doGet`/`doPost` sungguhan** (envelope sukses, penolakan tanpa token, dan penolakan peran read-only).
- `scripts/smoke-backend.mjs` diperluas (64 → **66 pemeriksaan**) untuk memastikan kedua route baru terdaftar di tabel `ROUTES`; `scripts/build-apps-script.ps1` memuat 7 nama fungsi baru agar pola namespace tetap tergantikan bersih.
- Diuji juga di peramban dengan backend tiruan: ekspor menghasilkan berkas nyata, dan impor berkas dari perangkat membalik konten editor ke isi berkas dengan riwayat berlabel `IMPOR BERKAS`.
- `docs/REDAKSI_KONTEN.md` menambah **bagian 7 — Ekspor & Impor Berkas JSON** (format berkas, tiga bentuk berkas, penjagaan keamanan) serta dua endpoint baru pada tabel RBAC.
- **Belum tayang sampai backend di-redeploy** (`npm run deploy:gas`); fitur ini murni backend + portal pengurus, tidak mengubah portal publik.

---

## [2.3.0] — 2026-10-08 (Deploy Backend Apps Script Satu Perintah)

### 🌟 Fitur Baru
- **`npm run deploy:gas`** — menggantikan alur salin-tempel manual ke editor Apps Script. Skrip baru `scripts/deploy-gas.mjs` menjalankan delapan tahap berurutan: preflight konfigurasi → kompilasi bundel → validasi sintaks → preflight daftar berkas → cek login → `clasp push` → pembuatan **Versi baru** → pembaruan **deployment yang sama**.
- **URL `/exec` tidak pernah berubah**: deployment ID dibaca otomatis dari URL `/exec` pada `portal/config.js` (opsional ditimpa via `GAS_DEPLOYMENT_ID`), sehingga `portal/config.js` dan `public/config.js` tidak perlu disunting setiap rilis.
- **Deploy berhenti sebelum menyentuh produksi bila ada masalah**: bundel cacat, daftar berkas tidak sesuai, belum login, atau `portal/config.js` & `public/config.js` menunjuk deployment yang berbeda — semuanya menghentikan proses dengan pesan yang jelas sebelum ada satu byte diunggah.
- **Preflight berkas tanpa kredensial** (`clasp status`) memastikan **tepat** `Backend.gs`, `AsetLogo.gs`, `AsetStempel.gs`, dan manifest `appsscript.json` yang diunggah — tidak ada berkas rahasia/sampah yang terbawa.
- **Mode uji `npm run deploy:gas:check`** (`--dry-run`) menjalankan build, validasi, dan preflight berkas secara nyata lalu hanya menampilkan perintah unggah yang akan dijalankan.
- Prasyarat sekali saja: `npx --yes @google/clasp@3 login`, `GAS_SCRIPT_ID` pada `.env`, dan **Google Apps Script API aktif** untuk akun tersebut di [script.google.com/home/usersettings](https://script.google.com/home/usersettings) (`.clasp.json`, `.clasprc.json`, dan `.env` di-gitignore). Alur manual dipertahankan sebagai cadangan di README, `docs/deploy.md`, dan `docs/VERSION_CONTROL.md`.
- **Manifest `appsscript.json` disertakan sebagai bagian bundel**: sumber acuan `gas/appsscript.json` (tracked) disalin oleh skrip build ke `apps-script/appsscript.json` dan divalidasi sebagai JSON yang sah sebelum unggah. Isinya identik dengan manifest di project produksi (`timeZone` Asia/Jakarta, `runtimeVersion` V8, `webapp.access` ANYONE_ANONYMOUS), sehingga rilis tidak mengubah pengaturan project.

### 🧪 Verifikasi
- Diuji langsung di repo: `--help`, jalur gagal tanpa `GAS_SCRIPT_ID` (exit 1, tanpa perubahan apa pun), dan `--dry-run` penuh (build + validasi + `clasp status` nyata melaporkan tepat 4 berkas yang akan diunggah; perintah `push`/`create-version`/`update-deployment` hanya ditampilkan).
- **Diuji terhadap project produksi sungguhan** (akun clasp terautentikasi, Script ID terpasang): daftar berkas di editor Apps Script diperiksa langsung lewat Apps Script API dan berisi **tepat** `Backend.gs`, `AsetLogo.gs`, `AsetStempel.gs`, dan `appsscript.json` — tidak ada modul pra-bundel yang tersisa sehingga tidak ada risiko definisi fungsi ganda. Manifest lokal terbukti **identik** dengan manifest project.
- Dua kegagalan nyata ditemukan dan diperbaiki pada uji ini: (1) `clasp push` selalu gagal karena folder unggahan tidak memuat `appsscript.json` — kini manifest ikut dibangun & divalidasi; (2) unggahan ditolak Google dengan `User has not enabled the Apps Script API` bila setelan akun belum dinyalakan — kini skrip berhenti dengan instruksi spesifik beserta alamat email akun yang sedang login.
- **Tidak diverifikasi:** langkah `push`/`create-version`/`update-deployment` belum pernah tuntas dari sisi agent karena setelan akun `Google Apps Script API` masih perlu dinyalakan pemilik project.

### ⚠️ Catatan Operasional
- `clasp` **tidak** menghapus berkas yang ada di editor Apps Script. Project harus hanya berisi `Backend.gs`, `AsetLogo.gs`, `AsetStempel.gs`, dan `appsscript.json`; sisa berkas lama (mis. `Aset.gs`) berpotensi menimbulkan definisi fungsi ganda dan perlu dihapus sekali secara manual.

---

## [2.2.0] — 2026-10-08 (Riwayat Versi Konten Redaksi & Pemulihan)

### 🌟 Fitur Baru
- **Riwayat Versi Konten Redaksi (anti timpa permanen)**: setiap penyimpanan dari tab `📰 Redaksi Konten` kini mengarsipkan versi sebelumnya, sehingga perubahan keliru dapat dipulihkan kapan saja tanpa perlu koding.
  - Kartu baru **`7. Riwayat Versi & Pemulihan`** di portal pengurus: daftar versi terbaru (waktu, pelaku, jenis aksi `PENYIMPANAN`/`PEMULIHAN`, ringkasan bagian yang berubah, ukuran berkas).
  - Tombol `👁 Pratinjau` menampilkan ringkasan satu versi (hero, jumlah maklumat/agenda/FAQ, kontak, visibilitas seksi) beserta JSON lengkapnya sebelum dipulihkan.
  - Tombol `↩ Pulihkan` mengembalikan konten aktif ke versi tersebut setelah konfirmasi; editor langsung dimuat ulang dengan konten hasil pemulihan.
  - Daftar riwayat otomatis disegarkan setelah setiap penyimpanan berhasil.
- **Endpoint baru**: `getEditorialHistory`, `getEditorialRevision`, `restoreEditorialRevision` (ketiganya khusus `SUPERADMIN` & `KETUA`, wajib sesi login).
- **Arsip versi dua arah**: saat pemulihan, konten yang sedang aktif ikut diarsipkan lebih dahulu (label *Sebelum memulihkan versi …*) sehingga pemulihan selalu dapat dibatalkan; aksi pemulihan dicatat sebagai `RESTORE` dan tercatat di jejak audit (`EDITORIAL_RESTORED`).

### 🛡️ Ketahanan & Batas Data
- Tabel **baru** `Sheet_EditorialHistory` (`id`, `saved_at`, `saved_by`, `action`, `label`, `content`) dibuat otomatis oleh `initSchema()`/`getSheetSafe_()` — **tidak ada perubahan pada skema tabel yang sudah ada**; tabel terpisah agar payload `getSettings` tetap ringan dan riwayat tidak pernah bocor ke portal publik.
- Riwayat dibatasi **15 versi terbaru** (`EDITORIAL_HISTORY_MAX`); pemangkasan mencari ulang baris berdasarkan `id` agar nomor baris yang bergeser tidak salah hapus.
- **Perlindungan batas sel Google Sheets (50.000 karakter)**: batas aman `EDITORIAL_CELL_SAFE` = 45.000 karakter. Konten yang melampaui batas kini **ditolak dengan pesan yang jelas** dan penyimpanan bersifat *all-or-nothing* (sebelumnya akan gagal dengan pesan sistem yang tidak informatif); versi di atas batas aman tidak diarsipkan sehingga riwayat tidak pernah rusak.
- Isi versi dinormalisasi ulang saat dibaca & dipulihkan, sehingga baris riwayat yang pernah disunting manual di spreadsheet tetap tersanitasi (tautan `javascript:`/`data:` tetap dibuang).
- Penyimpanan tanpa perubahan tidak menghasilkan versi baru; menyimpan **satu payload berisi pengaturan lain** tetap tidak terpengaruh.

### 🧪 Verifikasi & Dokumentasi
- `scripts/smoke-editorial.mjs` diperluas dari 56 → **93 pemeriksaan**: pencatatan otomatis versi sebelumnya, ringkasan perubahan, daftar & pratinjau, pemulihan (termasuk pembatalan pemulihan), batas 15 versi, `TOO_LARGE`/penolakan batas sel, sanitasi baris hostil, pembuatan tabel riwayat otomatis pada spreadsheet lama (tanpa `setup()`), serta penjagaan RBAC + kebocoran riwayat ke publik.
- `scripts/smoke-backend.mjs` diperluas (58 → **64 pemeriksaan**) untuk memastikan ketiga route riwayat terdaftar di tabel `ROUTES`.
- `docs/REDAKSI_KONTEN.md` menambah bagian **6. Riwayat Versi Konten** (penyimpanan, semantik pemulihan, batas sel) serta tiga endpoint baru pada tabel RBAC.

---

## [2.1.0] — 2026-10-08 (Redaksi Konten Dinamis — Mini-CMS Portal Publik)

### 🌟 Fitur Baru
- **Mini-CMS Redaksi Konten (Portal Pengurus)**: sub-tab baru **`📰 Redaksi Konten`** pada menu Pengaturan & Master Data untuk mengelola seluruh konten dinamis portal publik tanpa koding maupun redeploy.
  - **Hero & Tagline**: badge pengumuman, judul H1, subjudul, teks & tautan tombol CTA.
  - **Profil Lembaga**: toggle visibilitas seksi, sambutan resmi Ketua DPW, visi, dan poin misi.
  - **Maklumat & Siaran Resmi**: list builder (judul, kategori, tanggal, ringkasan, tautan PDF/Drive) dengan tambah/edit/hapus baris.
  - **Agenda & Acara Kegiatan**: list builder (kategori, tanggal, waktu, tempat/platform, narasumber, tautan pendaftaran, status `MENDATANG`/`SELESAI`).
  - **Kontak & Media Sosial Resmi**: alamat sekretariat, jam layanan, email, WhatsApp helpdesk, serta tautan YouTube, Instagram, WhatsApp Channel, Facebook, TikTok (kanal kosong otomatis disembunyikan).
  - **Tanya Jawab Publik (FAQ)**: toggle visibilitas + list builder pertanyaan/jawaban.
  - Tombol `💾 Simpan Seluruh Perubahan Redaksi` menyimpan keenam kartu sekaligus dengan feedback toast.
- **Portal Publik (`apii.sigitadi.id`)**: seksi dinamis baru yang tayang langsung setelah disimpan:
  - **Profil Lembaga (`#profil`)**: kartu sambutan pimpinan bergradasi emerald-gold, visi, dan misi bernomor.
  - **Warta Maklumat & Agenda Kegiatan (`#warta`)**: tab switcher *📌 Maklumat & Siaran* / *📅 Agenda & Acara*, maksimum 6 kartu per tampilan dengan tombol ekspansi, badge emas **MENDATANG** diprioritaskan di atas, dan label abu-abu **Selesai (Arsip Kegiatan)** untuk acara yang telah lewat.
  - **Tanya Jawab (`#faq`)**: akordeon interaktif dengan transisi halus (buka/tutup per pertanyaan).
  - Hero beranda, kontak sekretariat, dan deretan ikon media sosial kini mengikuti data redaksi; tautan navigasi menyesuaikan bila sebuah seksi disembunyikan.
- **Penyimpanan (tanpa perubahan skema tabel)**: seluruh konfigurasi redaksi disimpan sebagai satu objek JSON pada `Sheet_Settings` dengan key `editorial_content`, di-seed otomatis saat `setup()`/`initSchema()`.

### 🛡️ Keamanan & Ketahanan
- **Normalisasi server-side** `Utils.normalizeEditorialContent_`: koersi tipe (`show_section`, `faqs_show`, `status`), trim, batas panjang teks, batas jumlah item (misi 20, maklumat/acara/FAQ 60), serta pembuangan tautan berskema berbahaya (`javascript:`, `data:`) dengan allow-list `http(s)`/`mailto:`/`tel:`/anchor/relatif.
- **Sanitasi XSS sisi klien**: seluruh string dari server melewati `Public.esc()` sebelum dirender ke `innerHTML`.
- **Graceful fallback**: bila data belum tersedia atau field dikosongkan, portal publik tetap tampil rapi memakai teks bawaan HTML; seksi hanya disembunyikan jika toggle redaksi dimatikan.
- `getPublicSettings` kini mengalirkan objek `editorial`; `getSettings` mengembalikan `editorial_content` yang sudah ternormalisasi beserta alias `editorial`.
- **RBAC**: `saveSettings` kini juga terbuka untuk peran **KETUA** sesuai matriks RBAC (sebelumnya hanya `SUPERADMIN`, sehingga Ketua dapat membuka menu Pengaturan namun selalu gagal menyimpan).
- **Perbaikan bug bundler/kritis (pre-existing)**: `exportPendaftar` ditambahkan ke daftar fungsi global di `scripts/build-apps-script.ps1` — tanpa ini, `Backend.gs` gagal dimuat total karena `Auth.exportPendaftar` tidak terdefinisi; dan pemanggilan fungsi frontend `Auth.esc()` pada `gas/Divisi.gs` diganti helper backend `Utils.escHtml_()`.

### 🧪 Verifikasi & Dokumentasi
- Skrip uji baru **`scripts/smoke-editorial.mjs`** (56 pemeriksaan): normalisasi & sanitasi, integrasi seed → `saveSettings` → `getSettings`/`getPublicSettings` dengan tiruan Google Sheets, serta penjagaan RBAC route.
- **`docs/REDAKSI_KONTEN.md`** diperbarui: field `faqs_show`, catatan RBAC endpoint, prinsip defensif frontend, dan prosedur uji terbaru.

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
