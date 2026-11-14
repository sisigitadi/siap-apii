# PRD (Product Requirements Document) - SIAP APII v3.0.0 Enterprise
**Sistem Informasi & Administrasi Terpadu Yayasan Apologet Islam Indonesia (APII)**
*Dielaborasi dan diselaraskan secara komprehensif dari Kerangka Acuan Kerja (TOR) resmi oleh RetroBOT by Sigit Adi (https://sigitadi.id)*

---

================================================================================
ZONA ATAS: SPESIFIKASI KEBUTUHAN PRODUK (BLUEPRINT UTAMA)
================================================================================

## 1. Identitas Sistem, Landasan Hukum, Wilayah Kerja & Problem Statement
- **Nama Sistem:** SIAP APII (Sistem Informasi & Administrasi Terpadu Yayasan Apologet Islam Indonesia).
- **Pemberi Tugas:** Yayasan Apologet Islam Indonesia (APII).
- **Pelaksana Pekerjaan:** Sigit Adi Irianto (Freelance Software Engineer - https://sigitadi.id | https://wa.me/6281358575678).
- **Landasan Hukum & Legalitas:**
  - Akta Pendirian Yayasan & Keputusan Menteri Hukum dan HAM RI Nomor: **AHU-0014970.AH.01.04.Tahun 2023**.
  - Anggaran Dasar dan Anggaran Rumah Tangga (AD/ART) Yayasan APII (16 Bab Kodifikasi Organisasi).
  - Undang-Undang Perlindungan Data Pribadi (UU PDP) No. 27 Tahun 2022.
- **Wilayah Kerja & Multi-Tenancy:**
  - Dewan Pimpinan Pusat (DPP) Nasional.
  - Dewan Pimpinan Wilayah (DPW) se-Indonesia (Pilot Wilayah Perdana: **DPW Jabodetabek**, disusul Riau, Jawa Barat, Jawa Tengah, Jawa Timur, Sumatera Utara, dan provinsi lainnya).
- **Arsitektur Domain & Wildcard Subdomain Routing (Federated Multi-Tenant):**
  - **Sistem Pusat (DPP Nasional):**
    - **Portal Publik DPP:** `https://apologetislamindonesia.or.id` (Landing page nasional, warta maklumat pusat, pendaftaran anggota nasional, kanal infaq pusat, verifikasi QR dokumen/KTA, peta dakwah nasional).
    - **Portal Pengurus DPP:** `https://apologetislamindonesia.or.id/portal` (Workspace administrasi internal pimpinan pusat dengan akses Tenant Switcher nasional).
  - **Sistem Wilayah (DPW se-Indonesia):**
    - **Portal Publik DPW:** `https://{wilayah}.apologetislamindonesia.or.id` (Contoh: `jabodetabek.`, `riau.`, `jabar.`, `jateng.`, `jatim.apologetislamindonesia.or.id`).
    - **Portal Pengurus DPW:** `https://{wilayah}.apologetislamindonesia.or.id/portal` (Workspace administrasi lokal pengurus wilayah terpartisi ketat).
  - **Infrastruktur Routing Tunggal (Wildcard DNS + Single DocumentRoot):**
    - Konfigurasi DNS Wildcard `*.apologetislamindonesia.or.id` diarahkan ke satu IP server / DocumentRoot hosting yang sama.
    - **Hostname Sniffer (`detectCurrentTenant()`):** Saat peramban membuka situs, skrip JavaScript secara instan mendeteksi `window.location.hostname`.
      - Jika hostname adalah `apologetislamindonesia.or.id` atau `www.apologetislamindonesia.or.id` $\to$ sistem menetapkan konteks tenant `DPP_PUSAT`.
      - Jika hostname memiliki subdomain `{slug}.apologetislamindonesia.or.id` $\to$ sistem mencocokkan `{slug}` ke tabel `Sheet_Wilayah` (misal: `riau` $\to$ `DPW_RIAU`).
    - **Kustomisasi Tampilan Publik DPW vs Sindikasi Nasional:**
      - *Kerangka Standar Seragam:* Tata letak, tipografi, logo resmi APII, palet warna, navigasi, dan legalitas tetap seragam mengikuti standar mutu DPP nasional.
      - *Kustomisasi Konten Lokal DPW:* Pengurus DPW dapat mengkustomisasi banner hero lokal, kontak hotline & alamat sekretariat daerah, warta lokal, agenda kajian wilayah, dan rekening/QRIS kas wilayah.
      - *Smart Fallback:* Jika pengurus DPW belum mengunggah banner atau warta lokal, antarmuka publik secara cerdas menampilkan konten unggulan DPP Pusat (*National Fallback*).
      - *Sindikasi Ticker Nasional:* Baris warta maklumat penting (*National Announcement Ticker*) dari DPP Pusat tetap tersindikasikan otomatis di seluruh portal publik DPW se-Indonesia.
  - *(Lingkungan Staging/Demo Pengembang: `siapii.sigitadi.id` & `apii.sigitadi.id`)*.
- **Problem Statement:**
  Yayasan APII memiliki jangkauan dakwah nasional yang berkembang pesat. Sebelumnya, tata kelola persuratan, buku kas keuangan, program 7 divisi kerja, dan pendaftaran anggota baru berjalan parsial melalui WhatsApp dan spreadsheet terpisah. Pola kerja manual ini menimbulkan risiko fatal:
  1. Tabrakan atau lompatan nomor surat dinas resmi di hadapan instansi eksternal.
  2. Pencatatan kas keluar tanpa verifikasi berjenjang (*dual-approval*) dan rentan kebocoran dana.
  3. Usulan kegiatan divisi mandek tanpa alur disposisi dan pemantauan realisasi anggaran yang jelas.
  4. Kerentanan kebocoran data identitas pendaftar (KTP/NIK) yang melanggar ketentuan UU PDP.
  5. Ketiadaan instrumen verifikasi keaslian surat dan Kartu Tanda Anggota (KTA) secara instan di mata publik dan aparat hukum.
- **Solusi Utama:**
  Membangun platform sistem informasi nir-server (*serverless cloud architecture*) dwimoda yang terpadu, berbasis Google Apps Script (Modular Backend), Google Sheets ACID Wrapper (`Database.gs`), Google Drive Vault terenkripsi, dan antarmuka web modern (Single Page Application, Vanilla JS + Tailwind CSS + SWR Memory Caching) yang cepat, akuntabel, berkepastian hukum, dan terjangkau secara operasional bagi yayasan.

---

## 2. Struktur Organisasi & Peran Pengguna (RBAC Matrix 8 Peran)

### 2.1 Struktur Organisasi Yayasan APII (Berdasarkan Bagan Resmi TOR)
1. **Dewan Pembina:** Penentu arah kebijakan maklumat dakwah & pengesahan SK Pusat.
2. **Dewan Pengawas:** Pengawas tata kelola hukum, kepatuhan anggaran kas, dan jejak audit.
3. **Pengurus Harian (BPH):**
   - **Ketua Umum (DPP) / Ketua Wilayah (DPW):** Pemimpin tertinggi, pemutus kebijakan, penandatangan surat keputusan/rekomendasi, dan pengesah pengeluaran kas tahap 2 (*Ketum Approval*).
   - **Sekretaris Umum (DPP) / Sekretaris Wilayah (DPW):** Gerbang administrasi persuratan, konseptor surat dinas, pengelola agenda surat masuk & **penerbit draf rekomendasi disposisi**, verifikator tahap 1 pendaftar anggota, dan pengelola inventaris/aset.
   - **Bendahara Umum (DPP) / Bendahara Wilayah (DPW):** Otoritas buku kas, verifikator tahap 1 kas keluar, verifikator mutlak kas masuk, penerbit kwitansi dual-slip resmi, dan rekonsiliator rekening kas/bank yayasan.
4. **7 Divisi Kerja Resmi (Sesuai ART Yayasan APII Pasal 16):**
   - **Divisi Humas (`humas`):** Komunikasi eksternal, hubungan antar-lembaga, siaran pers, dan kemitraan ormas Islam.
   - **Divisi Litbang (`litbang`):** Penelitian, kajian teologis perbandingan agama, pengkajian naskah syubhat, dan bank dalil dakwah.
   - **Divisi Sosmed & Digital (`sosmed`):** Pengelolaan media sosial resmi, publikasi warta digital, kurasi konten website, dan radar tabayyun counter-framing.
   - **Divisi Dakwah dan Pendidikan (`dakwah`):** Safari dakwah, dauroh kader, kurikulum apologetika, pembinaan muallaf, dan presensi kajian.
   - **Divisi Bisnis & Kaderisasi (`bisnis`):** Kemandirian ekonomi yayasan, merchandise, pembinaan wirausaha anggota, dan pelatihan kader baru.
   - **Divisi Hukum & Advokasi (`hukum`):** Bantuan hukum dai/pengurus, advokasi sengketa dakwah, layanan siaga krisis LBH APII, dan pendampingan regulasi.
   - **Divisi Umum & Aset (`umum`):** Logistik perlengkapan acara, pemeliharaan aset fisik ber-QR, operasional kendaraan dakwah, dan kesekretariatan.
5. **Pelaksana Lapangan:** Anggota Divisi (staf teknis lapangan yang membantu pelaksanaan program kerja).

### 2.2 Matriks Hak Akses (8 Peran RBAC Terpadu)

| Peran (Role ID) | Deskripsi & Wewenang Utama | Akses Modul Utama | Otoritas Persetujuan (Approval) |
| :--- | :--- | :--- | :--- |
| **`superadmin`** | Administrator sistem pusat. Mengelola seluruh tenant DPP & DPW se-Indonesia, akun user, master wilayah, konfigurasi global, audit logs, dan pemulihan darurat. | Seluruh Modul (Akses Penuh & Tenant Switcher Global) | Bypass darurat teknis & pemecah kebuntuan (*Deadlock Breaker*) |
| **`ketua`** | Ketua Umum (DPP) / Ketua Wilayah (DPW). Pemegang otoritas tertinggi di tingkatannya. | Dashboard, Persuratan, Kas, Divisi, Keanggotaan, Disposisi, Vault, Redaksi, Advokasi | - Sahkan Surat Dinas Keluar<br/>- Dual-Approval Kas Keluar Tahap 2<br/>- Sahkan Instruksi Disposisi Surat Masuk<br/>- Sahkan Program Kerja Divisi<br/>- Pengesahan Akhir KTA Anggota |
| **`sekretaris`** | Sekretaris Umum / Wilayah. Penjaga gerbang administrasi yayasan. | Persuratan, Surat Masuk, Disposisi, Keanggotaan, Divisi, Vault, Redaksi, Aset | - Konseptor & Penerbit Surat Keluar<br/>- Registrasi Surat Masuk<br/>- **Penerbit Draf Rekomendasi Disposisi**<br/>- Verifikasi Tahap 1 Pendaftar KTA |
| **`bendahara`** | Bendahara Umum / Wilayah. Penjaga kepatuhan kas dan perbendaharaan syar'i. | Keuangan Kas, Kas Simulator, Kwitansi, Master Rekening, Audit Kas, Rekonsiliasi | - Verifikasi Tahap 1 Kas Keluar (Cek Nota)<br/>- Direct Approval Kas Masuk (Infaq/Donasi)<br/>- Cetak Kwitansi Kas Dual-Slip |
| **`pembina`** | Dewan Pembina yayasan. Mengarahkan visi maklumat dan kebijakan jangka panjang. | Dashboard, Warta, Maklumat, Arsip Surat, Laporan Kas (*Read-Only*) | Pemantauan Makro, Ulasan Kebijakan, & Audit Syar'i |
| **`pengawas`** | Dewan Pengawas yayasan. Memastikan kepatuhan tata kelola hukum dan keuangan. | Dashboard, Audit Logs, Buku Kas, Surat Masuk/Keluar, LPJ (*Read-Only*) | Pengawasan Kepatuhan, Laporan Rekonsiliasi Bulanan, & Temuan Audit |
| **`ketua_divisi`** | Ketua dari 7 Divisi Resmi (Humas, Litbang, Sosmed, Dakwah, Bisnis, Hukum, Umum). | Usulan Program Divisi, Realisasi LPJ, Kotak Disposisi Divisi, Vault Divisi, Modul Terkait Divisinya | - Pengusul Program Kerja Divisi<br/>- Pelapor LPJ & Realisasi Anggaran<br/>- Pelaksana Instruksi Disposisi Masuk |
| **`anggota_divisi`** | Anggota staf lapangan yang terdaftar pada divisi terkait. | Usulan Divisi (Bantu Draf), Catatan Kegiatan, Kotak Disposisi Divisi | Draf Teknis Internal Divisi |

### 2.3 Spesifikasi Alur Kerja, Logika, UI/UX, dan Batasan Kewenangan 8 Peran
1. **Superadmin (Sistem & Tata Kelola Nasional):**
   - *Logic & Scope:* Memiliki hak akses omnipresen lintas-tenant (DPP dan seluruh DPW). Dapat melihat, memfilter, dan mengelola seluruh data melalui Tenant Switcher di topbar.
   - *UI/UX:* Dilengkapi tab menu khusus "Sistem & IAM" (Manajemen Pengguna, Reset Password, Registrasi DPW Baru, Audit Log Inspector, dan Master Settings). Di dashboard, terdapat ringkasan kesehatan server (*system health*), kuota Google Drive yayasan, dan traffic API.
   - *Checks & Balances:* Setiap tindakan Superadmin yang mengubah data atau membypass status persetujuan secara otomatis dicatat permanen di `Sheet_AuditLogs` dengan flag `SUPERADMIN_OVERRIDE` dan tidak dapat dihapus.
2. **Ketua Umum (DPP) & Ketua Wilayah (DPW):**
   - *Logic & Scope:* Otoritas eksekutif tertinggi di wilayahnya. Pada level DPP, Ketua Umum memiliki Tenant Switcher untuk memonitor seluruh DPW. Pada level DPW, Ketua Wilayah hanya melihat data provinsinya.
   - *UI/UX:* Fokus pada **Action Inbox** di baris teratas Dashboard: "X Surat Menunggu Pengesahan", "Y Voucher Kas Menunggu Persetujuan Tahap 2", "Z Draf Disposisi Perlu Instruksi", "N Pendaftar KTA Siap Disahkan". Tombol aksi: `[Tandatangani & Sahkan]`, `[Minta Revisi]`, `[Tolak]`.
3. **Sekretaris Umum & Sekretaris Wilayah:**
   - *Logic & Scope:* Pusat operasional dokumen persuratan, agenda surat masuk, draf disposisi, dan verifikasi awal keanggotaan.
   - *UI/UX:* Workspace persuratan dengan split-screen editor naskah dinas A4 live, register surat masuk dengan drag-and-drop berkas PDF, serta modul verifikasi pendaftar KTA dengan viewer KTP ter-watermark aman.
4. **Bendahara Umum & Bendahara Wilayah:**
   - *Logic & Scope:* Penegak disiplin kas syar'i. Mengelola 4 kantong kas (Zakat, Infaq Dakwah, Wakaf, Amil/Operasional).
   - *UI/UX:* Buku kas mutasi warna kontras (Hijau untuk Masuk, Merah untuk Keluar), panel filter per kantong syar'i, tombol input voucher kilat, simulator arus kas, dan modal cetak kwitansi dual-slip dengan generator terbilang instan.
5. **Dewan Pembina:**
   - *Logic & Scope:* Pemantauan strategis tingkat makro. Akses baca penuh (*read-only*) ke seluruh kebijakan, maklumat, arsip surat resmi, dan ikhtisar kas nasional.
   - *UI/UX:* Dashboard eksekutif berbasis grafik tren: sebaran anggota nasional, realisasi dakwah, ringkasan saldo kas umum, dan unduh laporan berkala tanpa tombol manipulasi data.
6. **Dewan Pengawas:**
   - *Logic & Scope:* Pengawasan hukum dan transparansi keuangan. Berhak memeriksa seluruh jejak audit (`Sheet_AuditLogs`), berkas nota kas keluar, dan LPJ divisi.
   - *UI/UX:* Tampilan tabel audit log berfitur filter forensik (berdasarkan tanggal, user, tipe mutasi, dan IP address), peninjau dokumen nota/struk belanja, serta panel penerimaan Laporan Rekonsiliasi Bulanan otomatis.
7. **Ketua Divisi (7 Divisi Resmi ART Pasal 16):**
   - *Logic & Scope:* Pemimpin teknis program kerja sektoral. Bertanggung jawab atas permohonan anggaran, pelaksanaan kegiatan, pelaporan LPJ, dan eksekusi lembar disposisi yang diarahkan ke divisinya.
   - *UI/UX:* Modul khusus divisi dengan tab: Usulan Program Kerja, Realisasi LPJ & Anggaran, Kotak Disposisi Divisi, dan modul fungsional sesuai divisinya (misal: Divisi Hukum mengakses LBH Siaga Advokasi, Divisi Umum mengakses Aset QR Tracker, Divisi Dakwah mengakses Presensi & Muallaf Care).
8. **Anggota Divisi:**
   - *Logic & Scope:* Pelaksana lapangan. Membantu penyusunan draf usulan kegiatan, mengunggah dokumentasi foto kegiatan lapangan, dan mencatat presensi acara.
   - *UI/UX:* Tampilan ringkas ramah ponsel cerdas (*mobile-first*) untuk penginputan laporan kegiatan dan pemindaian QR Code KTA pada acara dakwah.

### 2.4 Mekanisme Tenant Switcher di Portal Pengurus
- **Lokasi UI:** Terletak di bagian atas bilah navigasi (*topbar navbar*) portal pengurus (`/portal`), berdampingan dengan profil pengguna.
- **Ketersediaan Akses:**
  - *Aktif & Bebas Memilih:* Akun tingkat pusat dengan peran `superadmin`, `ketua` (Ketum), `sekretaris` (Sekjen), `bendahara` (Bendum), `pembina`, dan `pengawas` dapat membuka dropdown pemilih tenant:
    `[DPP PUSAT (Nasional)]` | `[DPW JABODETABEK]` | `[DPW RIAU]` | `[DPW JAWA BARAT]` | `[DPW JAWA TENGAH]` | `[DPW JAWA TIMUR]` | `[+ Tambah DPW Baru]`.
  - *Terkunci Mutlak:* Akun pengurus DPW menampilkan badge statis wilayahnya (misal: `[DPW JABODETABEK] - Terkunci`), dropdown dinonaktifkan demi integritas partisi data.
- **Performa Transisi:** Penggantian tenant pada akun pimpinan pusat dieksekusi secara instan ($0\text{ ms}$) melalui perubahan state konteks SWR memory cache frontend, memicu pembaruan filter data aktif tanpa perlu login ulang.

---

## 3. Arsitektur Nir-Server Multi-Tenant & Google Drive Vault

```mermaid
graph TD
    UserClient["Perangkat Pengurus (PC/HP)<br/>Private SPA (Vanilla JS + Tailwind + PWA)"] -->|HTTPS + Token UUID| RoutingGateway["Backend Gateway (Code.gs)"]
    PublicUser["Masyarakat / Calon Anggota<br/>Portal Publik Adaptif (*.apologetislamindonesia.or.id)"] -->|HTTPS (Hostname Sniffer)| RoutingGateway
    
    subgraph Google_Apps_Script_Modular_Engine ["Google Apps Script Modular Backend Engine"]
        RoutingGateway --> AuthMod["Auth.gs (RBAC & Sesi 7 Hari)"]
        RoutingGateway --> SuratMod["Surat.gs, TemplateSuratDocs.gs & HijriEngine.gs"]
        RoutingGateway --> DisposisiMod["Disposisi.gs & SuratMasuk.gs"]
        RoutingGateway --> KeuanganMod["Keuangan.gs, KwitansiEngine.gs & ShariaGuard.gs"]
        RoutingGateway --> DivisiMod["Divisi.gs (7 Divisi ART Ps 16)"]
        RoutingGateway --> KTAMod["Keanggotaan.gs, KTACanvas.gs & Watermark.gs"]
        RoutingGateway --> InovasiMod["InovasiDakwah.gs (Advokasi, Muallaf, Aset, Maktabah)"]
        RoutingGateway --> NotifMod["NotificationDispatcher.gs (Smart Relay WA & Email)"]
        RoutingGateway --> DriveMod["DriveVault.gs"]
        RoutingGateway --> DBMapper["Database.gs (ACID Wrapper + Mutex Lock)"]
    end
    
    DBMapper --> SheetsDB[("Google Sheets ACID Database<br/>(28 Tabel Terpartisi Wilayah)")]
    DriveMod --> DriveVault[("Google Drive Vault 3-Tingkat<br/>(Root Tenant > Modul > Periode/Entitas)")]
```

### 3.1 Spesifikasi Arsitektur Backend, Frontend & Multi-Tenancy
- **Struktur Repositori (Monorepo Terpadu):** Kode dikelola dalam 1 repositori monorepo dengan 4 folder utama:
  - `apps-script/`: Seluruh modul logika backend Google Apps Script.
  - `portal/`: Single Page Application (SPA) untuk portal internal pengurus.
  - `public/`: Antarmuka adaptif publik (landing page, pendaftaran anggota, kanal infaq, verifikasi QR).
  - `scripts/`: Skrip otomasi build, pengujian sintaks, dan deployment clasp (`build-apps-script.mjs`).
- **Pola Komunikasi Data (CORS JSON API):** Frontend berkomunikasi ke backend GAS melalui HTTP POST/GET (`doPost`/`doGet`) dengan format pertukaran JSON `{ action: string, token?: string, payload: object }` berkecepatan tinggi.
- **Kebijakan Sesi Pengurus (Multi-Device Concurrent Session):** Pengurus diizinkan login secara bersamaan di laptop dan ponsel cerdas (HP); setiap login menghasilkan token UUID unik berdurasi 7 hari yang tersimpan mandiri di `Sheet_Sessions`.
- **Database Wrapper:** `Database.gs` menerapkan locking transaksi mutlak (`LockService.getScriptLock()`) untuk mencegah tabrakan data (*race condition*) antar pengurus, dilengkapi pemetaan kolom berbasis indeks numerik aman (*Index-Based Column Mapping*) dan sanitasi data otomatis.
- **Multi-Tenant Partitioning:** Seluruh entitas transaksi dan master data memiliki kolom partisi `wilayah_id` (`DPP_PUSAT`, `DPW_JABODETABEK`, `DPW_RIAU`, dll.). Pengurus hanya dapat melihat dan mengelola data sesuai tenant masing-masing, kecuali peran berotoritas nasional dengan Tenant Switcher.

### 3.2 Struktur Folder Google Drive Vault 3-Tingkat
Penyimpanan berkas dikelola otomatis oleh `DriveVault.gs` dengan hierarki terisolasi:
```text
[ROOT_VAULT_APII]
├── [DPP_PUSAT]
│   ├── 01_SURAT_KELUAR (PDF naskah dinas resmi terstempel)
│   ├── 02_SURAT_MASUK (Scan/PDF surat masuk dari instansi luar)
│   ├── 03_BUKTI_KAS (Struk, nota belanja, bukti transfer bank)
│   ├── 04_LPJ_DIVISI (Laporan pertanggungjawaban program kerja 7 divisi)
│   ├── 05_BERKAS_KTA (Pasfoto formal & arsip KTP ber-watermark UU PDP)
│   ├── 06_ASSET_CMS (Hero banner, warta dakwah, infografis)
│   ├── 07_ADVOKASI_HUKUM (Dokumen somasi, berkas perkara LBH APII)
│   ├── 08_MUALLAF_CARE (Piagam syahadat & dokumen pembinaan)
│   ├── 09_ASET_LOGISTIK (Foto inventaris fisik & label QR)
│   └── 10_RISALAH_RAPAT (Notulensi pleno, daftar hadir, dokumentasi)
└── [DPW_JABODETABEK]
    ├── 01_SURAT_KELUAR
    ├── 02_SURAT_MASUK
    ├── 03_BUKTI_KAS
    ├── 04_LPJ_DIVISI
    ├── 05_BERKAS_KTA
    ├── 06_ADVOKASI_HUKUM
    ├── 07_MUALLAF_CARE
    ├── 08_ASET_LOGISTIK
    └── 09_RISALAH_RAPAT
```
- **Ketentuan Vault:**
  1. Kompresi gambar sisi klien sebelum unggah (WebP format, ukuran $< 250\text{ KB}$).
  2. Proteksi Akses: File KTP dan berkas perkara hukum hanya memiliki hak akses *Restricted* dan hanya dapat dilihat oleh pejabat berwenang via token presigned URL sementara.
  3. Sistem Recycle Bin dengan masa retensi 30 hari sebelum penghapusan permanen, serta peringatan kapasitas kuota Google Drive pada ambang batas $80\%$ dan $90\%$.

---

## 4. Alur Kerja Aplikasi (8 User Flows & Rangkaian Inovasi Terpadu)

### Flow 1: Naskah Surat Dinas Keluar & Live Preview A4
1. **Draf Naskah:** Sekretaris menyusun surat dinas di modul persuratan. Form dilengkapi pemilihan jenis naskah (Surat Keputusan, Surat Tugas, Undangan, Rekomendasi, Maklumat, Surat Keterangan).
2. **Split-Screen Virtual A4 Preview:** Sekretaris melihat pratinjau langsung berukuran standar A4 lengkap dengan KOP resmi (DPP atau DPW dinamis), penanggalan Hijriah & Masehi otomatis, margin standar, konsideran hukum (Menimbang, Mengingat, Memutuskan), serta penataan paragraf otomatis.
3. **Pengajuan (`AJUKAN`):** Naskah diajukan ke Ketua. Notifikasi otomatis masuk ke *Action Inbox* Ketua.
4. **Penelaahan & Approval Ketua:**
   - Jika ada koreksi: Ketua mencantumkan catatan revisi $\to$ status berubah menjadi `REJECTED`. Naskah **tidak terkunci mati**; Sekretaris dapat langsung mengedit kembali konsideran dan mengajukan ulang (*Unblocked Rejection Loop*).
   - Jika disetujui: Ketua menekan tombol pengesahan $\to$ status berubah menjadi `APPROVED`.
5. **Penerbitan (`PUBLISHED`):**
   - Sistem membangkitkan nomor surat sekuensial resmi anti-loncat via lock atomic.
   - **Pembubuhan Tanda Tangan & Stempel Resmi:** Sistem membubuhkan gambar spesimen tanda tangan resmi pengurus, stempel basah transparan dengan rotasi dinamis acak ($3^\circ - 5^\circ$) berteknologi *Canvas/CSS Multiply Blend Mode*, dan QR Code verifikasi publik hash SHA-256.
   - Dokumen diekspor menjadi PDF beresolusi cetak tinggi dan tersimpan aman di Google Drive Vault.

### Flow 2: Kotak Surat Masuk & Lembar Disposisi Berjenjang (Multi-Divisi)
1. **Penerimaan & Pencatatan Agenda (Sekretaris):**
   - Surat masuk fisik di-scan atau surat digital PDF diunggah oleh Sekretaris ke Modul Kotak Surat Masuk.
   - Sekretaris mengisi metadata: Nomor Agenda, Asal Instansi/Pengirim, Nomor Surat Asli, Tanggal Diterima, Perihal, Ringkasan Isi, dan mengunggah berkas PDF lampiran.
2. **Penyusunan Draf Rekomendasi Disposisi (Sekretaris):**
   - **Sekretaris berhak menyusun draf rekomendasi awal disposisi** sebelum diteruskan ke pimpinan.
   - Draf rekomendasi mencakup: Usulan satu atau lebih divisi pelaksana (Multi-Divisi), usulan tingkat urgensi (Biasa, Segera, Sangat Segera), dan usulan arahan tindak lanjut.
3. **Pengesahan & Instruksi Disposisi (Ketua Umum / Ketua Wilayah):**
   - Ketua menerima notifikasi lembar disposisi masuk di *Action Inbox*.
   - Ketua menelaah draf rekomendasi: dapat menyetujui, menambah, atau memodifikasi daftar divisi tujuan secara fleksibel.
   - Pilihan instruksi baku disposisi Ketua:
     - `[1] Tindak Lanjuti Sesuai Ketentuan`
     - `[2] Wakili / Hadiri Acara`
     - `[3] Siapkan Bahan / Tanggapan Tertulis`
     - `[4] Koordinasikan dengan Divisi Terkait`
     - `[5] Untuk Diketahui & Arsipkan`
   - Ketua menetapkan tenggat waktu (*deadline*) dan membubuhkan paraf digital pengesahan.
4. **Distribusi Fleksibel Multi-Divisi:**
   - Satu surat masuk dapat didisposisikan secara paralel ke beberapa divisi sekaligus (misal: Divisi Humas & Divisi Hukum).
   - Lembar disposisi otomatis terbit di kotak masuk masing-masing Ketua Divisi yang dituju dengan pelacakan progres mandiri per divisi.
5. **Pelaporan Balik & Penutupan Disposisi:**
   - Masing-masing Ketua Divisi mengunggah bukti tindak lanjut (foto kehadiran, risalah rapat, atau naskah balasan).
   - Status disposisi divisi ditutup menjadi `SELESAI_DITINDAKLANJUTI`.

### Flow 3: Keuangan Kas Syar'i, Penomoran BKM/BKK & Dual-Slip Kwitansi
1. **Pencatatan Transaksi & Penomoran Resmi:**
   - Draf transaksi kas menggunakan ID sementara (`DRAFT-KEU-XXX`) untuk menjaga integritas urutan buku kas.
   - **Kas Masuk (Infaq, Sedekah, Donasi Dakwah, Zakat):** Bendahara menginput penerimaan $\to$ status langsung `APPROVED` $\to$ sistem menerbitkan nomor resmi **BKM-YYYYMM-XXX** (Bukti Kas Masuk) sekuensial. Saldo kas bertambah seketika dan kwitansi resmi siap dicetak.
   - **Kas Keluar (Operasional, Advokasi, Safari Dakwah, Aset):** Draf kas keluar diinput dengan melampirkan foto nota/kuitansi awal $\to$ status `VERIFIKASI_BENDAHARA`.
2. **Verifikasi Kas Keluar Bertingkat (Dual-Approval):**
   - **Tahap 1 (Bendahara):** Bendahara memverifikasi kelayakan anggaran, memeriksa kesesuaian kantong fiqih kas, dan kelengkapan nota fisik $\to$ status naik menjadi `VERIFIKASI_KETUM`. Jika ditolak, transaksi berstatus `REJECTED` tanpa celah loncatan nomor kas.
   - **Tahap 2 (Ketua):** Ketua Umum/Wilayah memeriksa urgensi pencairan dana $\to$ mengesahkan persetujuan $\to$ status resmi `APPROVED` $\to$ sistem menerbitkan nomor resmi **BKK-YYYYMM-XXX** (Bukti Kas Keluar) sekuensial. Saldo buku kas terpotong seketika.
3. **Pencetakan Kwitansi Kas Dual-Slip Syar'i:**
   - Format cetak terbagi 2 zona pada selembar kertas:
     - **Bonggol Kwitansi ($30\%$ sisi kiri):** Arsip permanen Bendahara untuk audit berkala.
     - **Lembar Kwitansi Resmi ($70\%$ sisi kanan):** Diserahkan kepada donatur atau penerima dana tunai.
   - Dilengkapi generator otomatis terbilang Rupiah resmi, nomor voucher resmi BKM/BKK, dan QR code keabsahan kas.
4. **Aturan Kas Tunai (*Cash Buffer*) & Kas Simulator:**
   - Uang tunai di brankas kesekretariatan dibatasi maksimal **Rp 2.000.000,-**. Transaksi di atas nominal tersebut wajib disalurkan melalui transfer bank resmi yayasan.
   - Fitur **Kas Simulator** memungkinkan Bendahara mensimulasikan arus kas masa depan sebelum menyetujui proposal program kerja besar.

### Flow 4: Program Kerja 7 Divisi Resmi (Integrasi Bertahap ke Kas)
1. **Pengajuan Proposal (`DRAFT` $\to$ `AJUKAN`):** Ketua Divisi menyusun rincian program kerja (latar belakang, target sasaran umat, rencana anggaran biaya/RAB, tanggal pelaksanaan).
2. **Persetujuan Pimpinan (`DISETUJUI` sebagai Pagu Otorisasi):** Ketua Umum/Wilayah menelaah proposal dan ketersediaan anggaran. Persetujuan ini menetapkan pagu otorisasi kegiatan resmi.
3. **Permohonan Pencairan Kas (Integrasi Bertahap):**
   - Saat divisi siap mengeksekusi kegiatan, Ketua Divisi mengajukan permohonan pencairan dana (bisa bertahap atau sekaligus).
   - Pengajuan ini otomatis memicu draf kas keluar di Modul Keuangan Kas untuk diverifikasi Bendahara (Tahap 1) dan disahkan Ketua (Tahap 2).
4. **Masa Eksekusi (`PELAKSANAAN`):** Program kerja berjalan di lapangan didukung anggota divisi setelah dana dicairkan.
5. **Pelaporan LPJ Akuntabel (`LPJ_SELESAI`):** Ketua Divisi mengunggah link dokumen LPJ Google Drive, rincian nota realisasi dana, dokumentasi foto, dan mencatat sisa saldo anggaran (jika ada).
6. **Rekonsiliasi Anggaran:** Dana sisa otomatis dikembalikan ke buku kas umum yayasan melalui modul keuangan sebagai transaksi Kas Masuk pengembalian sisa anggaran.

### Flow 5: Keanggotaan Nasional & Penerbitan KTA Digital 5 Tahun (100% Bebas Biaya)
1. **Pendaftaran Mandiri Bebas Biaya:** Calon anggota mengakses formulir online di portal publik adaptif (`apologetislamindonesia.or.id`). Pendaftaran **100% Bebas Biaya (Gratis & Selektif)**, tanpa pungutan uang pangkal/iuran.
2. **Client-Side Watermarking KTP Otomatis (Amanat UU PDP No. 27/2022):**
   - Sebelum berkas KTP terkirim ke server, browser menjalankan modul Canvas untuk menimpa foto KTP dengan garis watermark tebal menyilang bertuliskan:
     `"VERIFIKASI KTA YAYASAN APII - DILARANG MENYALAHGUNAKAN - TANGGAL: [YYYY-MM-DD]"`.
   - Mencegah kebocoran data KTP dari penyalahgunaan pinjaman online liar atau kejahatan siber.
3. **Verifikasi Tahap 1 (Sekretaris):** Sekretaris memeriksa kesesuaian biodata, kejelasan pasfoto formal, dan kelayakan berkas KTP.
4. **Pengesahan Akhir & Pembentukan NIA (Ketua):**
   - Ketua Umum menyetujui pengangkatan anggota $\to$ Sistem menerbitkan **Nomor Induk Anggota (NIA)** nasional sekuensial:
     Format: `APII-[KODE_WILAYAH]-[TAHUN_MASUK]-[NOMOR_URUT_NASIONAL]` (Contoh: `APII-JKT-2026-00125`).
5. **Penerbitan KTA Digital Standar DPP (CR80 ISO/IEC 7810 ID-1):**
   - Dihasilkan via HTML5 Canvas Renderer beresolusi tinggi ($1012 \times 638\text{ px}$, $300\text{ DPI}$).
   - **Tampak Muka (Depan):** Logo Yayasan APII keemasan, KOP DPP, Pasfoto formal, Nama Lengkap, NIA, Wilayah Domisili, Tingkat Kompetensi Da'i (Tingkat 1/2/3), dan **Masa Berlaku Terkunci Mutlak 5 Tahun** sejak tanggal diterbitkan.
   - **Tampak Belakang:** Memuat teks resmi **5 Butir Kode Etik Anggota Yayasan APII**, tanda tangan digital Ketua Umum, dan QR Code verifikasi publik.

### Flow 6: Redaksi Konten Portal Publik (Mini-CMS Pengurus)
1. Tim Divisi Sosmed & Digital / Sekretaris membuka Modul Redaksi di portal pengurus.
2. Pengurus memperbarui teks: Warta Maklumat Pimpinan, Pengumuman Penting, Agenda Safari Dakwah & Kajian, Banner Hero, Daftar Tanya-Jawab (FAQ), dan Rekening Infaq Resmi.
3. Seluruh revisi tersimpan dengan jejak rekam riwayat di `Sheet_EditorialHistory` dan langsung tayang seketika di portal publik tanpa kompilasi ulang kode.

### Flow 7: Mesin Notifikasi & Estafet Kerja WhatsApp Lintas-Pengurus (Smart Relay Dispatcher)
Untuk menjamin seluruh mata rantai tata kelola organisasi berjalan berkesinambungan tanpa ada berkas yang mandek atau saling menunggu tanpa kabar, sistem mengintegrasikan **Smart WhatsApp Handover & Request Relay**:

1. **Prinsip Dwi-Fungsi Estafet WhatsApp:**
   - **Laporan Penyelesaian Tugas (*Completion Handover*):** Menginformasikan kepada pengurus terkait bahwa suatu tahapan tugas telah berhasil diselesaikan oleh pejabat yang berwenang.
   - **Permintaan Tindak Lanjut (*Action Request*):** Meminta pejabat berikutnya pada rantai komando untuk segera memeriksa, memproses, atau melanjutkan tugas tersebut dilengkapi tautan langsung ke dokumen di portal pengurus.

2. **Matriks 5 Alur Estafet Kerja Lintas-Pengurus:**
   - **A. Estafet Persuratan Dinas:**
     - *Draf Selesai:* Sekretaris selesai buat draf surat $\to$ memicu tombol WA ke **Ketua Umum/Wilayah**: *"Laporan: Draf Surat [Perihal] telah selesai disusun. Permintaan: Mohon Ketua berkenan menelaah dan menandatangani di tautan: [Link Portal]"*.
     - *Surat Disahkan:* Ketua sahkan surat $\to$ memicu WA ke **Sekretaris**: *"Laporan: Surat [No. Surat] telah resmi disahkan & ditandatangani. Permintaan: Mohon Sekretaris mendistribusikan PDF resmi dan mengarsipkan."*
     - *Surat Direvisi:* Ketua tolak/kembalikan naskah $\to$ memicu WA ke **Sekretaris**: *"Catatan Revisi: [Catatan Ketua]. Permintaan: Mohon disesuaikan kembali di editor persuratan."*
   - **B. Estafet Kotak Surat Masuk & Disposisi Berjenjang:**
     - *Registrasi Agenda Selesai:* Sekretaris registrasi surat masuk & buat draf rekomendasi $\to$ memicu WA ke **Ketua**: *"Laporan: Surat masuk dari [Asal Surat] No. Agenda [No] telah diregistrasi beserta Draf Rekomendasi Disposisi. Permintaan: Mohon Ketua memberikan arahan instruksi disposisi resmi di portal."*
     - *Instruksi Disposisi Terbit:* Ketua sahkan instruksi disposisi $\to$ memicu WA ke **Ketua Divisi Pelaksana (Multi-Divisi)** & **Sekretaris**: *"Instruksi Disposisi Ketua No. [Agenda]: [Instruksi Ketua] dengan batas waktu [Tenggat]. Permintaan: Mohon Ketua Divisi [Nama Divisi] segera menindaklanjuti dan mengunggah laporan hasil di portal."*
     - *Tindak Lanjut Tuntas:* Ketua Divisi lapor hasil $\to$ memicu WA ke **Ketua & Sekretaris**: *"Laporan: Divisi [Nama] telah selesai menindaklanjuti disposisi [Agenda] dengan bukti terlampir di portal. Status ditutup."*
   - **C. Estafet Keuangan Kas Syar'i (Dual-Approval):**
     - *Pengajuan Kas Keluar:* Pengusul (Ketua Divisi/Sekretaris) input voucher $\to$ memicu WA ke **Bendahara**: *"Permohonan pencairan kas sebesar [Rp ...] untuk [Keperluan] telah diajukan beserta bukti nota. Permintaan: Mohon Bendahara memverifikasi kelayakan nota."*
     - *Verifikasi Tahap 1 Tuntas:* Bendahara verifikasi nota $\to$ memicu WA ke **Ketua**: *"Laporan: Voucher Kas Keluar [Nominal] telah diverifikasi lolos Tahap 1 oleh Bendahara. Permintaan: Mohon Ketua mengesahkan persetujuan pencairan dana di portal."*
     - *Persetujuan Tahap 2 Tuntas:* Ketua setujui kas $\to$ memicu WA ke **Bendahara** & **Pengusul**: *"Laporan: Kas Keluar [No. BKK] sebesar [Rp ...] telah disahkan Ketua. Permintaan: Mohon Bendahara memproses pencairan dan mencetak kwitansi dual-slip resmi."*
     - *Penerimaan Kas Masuk (Infaq/Donasi):* Bendahara bukukan kas masuk $\to$ memicu WA ke **Donatur** & **Ketua**: *"Alhamdulillah, dana infaq dakwah sebesar [Rp ...] telah diterima dan dibukukan di Kas Yayasan APII (No. BKM-...). Kwitansi digital terlampir."*
   - **D. Estafet Program Kerja 7 Divisi:**
     - *Proposal Diajukan:* Ketua Divisi ajukan RAB $\to$ memicu WA ke **Ketua**: *"Proposal Program Kerja [Nama Program] divisi [Divisi] telah diajukan. Permintaan: Mohon Ketua menelaah pagu otorisasi anggaran."*
     - *Proposal Disetujui:* Ketua setujui proposal $\to$ memicu WA ke **Ketua Divisi**: *"Laporan: Program kerja telah disetujui. Divisi dipersilakan mengajukan permohonan pencairan kas bertahap ke Bendahara saat kegiatan dimulai."*
     - *Kegiatan Selesai & LPJ:* Ketua Divisi unggah LPJ $\to$ memicu WA ke **Bendahara & Ketua**: *"Laporan: LPJ kegiatan [Nama] telah diunggah di Drive Vault dengan realisasi dana [Rp ...]. Sisa anggaran sebesar [Rp ...] siap disetorkan kembali ke kas yayasan."*
   - **E. Estafet Pendaftaran Anggota & KTA (Internal Antar-Pengurus Saja):**
     - *Batasan Privasi Mutlak:* Jalur WhatsApp pendaftaran anggota **hanya beroperasi untuk koordinasi internal antar-pengurus**, tidak pernah mengirim pesan WhatsApp keluar ke nomor publik/calon anggota (mencegah nomor pengurus dijadikan sasaran spam). Calon anggota memantau status secara mandiri via portal publik atau email otomatis.
     - *Pendaftar Masuk:* Calon anggota submit form publik $\to$ memicu notifikasi internal ke **Sekretaris**: *"Pemberitahuan Internal: Calon anggota baru atas nama [Nama] NIK [16 digit terproteksi] telah mendaftar di portal. Mohon Sekretaris memeriksa kelayakan berkas KTP ber-watermark."*
     - *Verifikasi Tahap 1 Tuntas:* Sekretaris loloskan berkas $\to$ memicu WA internal ke **Ketua**: *"Laporan Internal: Berkas KTP & biodata [Nama] telah diverifikasi lengkap oleh Sekretaris. Permintaan: Mohon Ketua mengesahkan pengangkatan anggota & nomor NIA nasional di portal."*
     - *KTA Disahkan:* Ketua sahkan anggota $\to$ memicu WA konfirmasi internal ke **Sekretaris**: *"Laporan Internal: Anggota atas nama [Nama] telah disahkan Ketua (NIA: [NIA], Masa Berlaku 5 Tahun). Berkas KTA digital resmi telah terbit di Drive Vault. Proses administrasi tuntas."*
   - **F. Siaran Informasi Dakwah & Komunitas (Warta, Agenda & Maklumat ke WhatsApp Group):**
     - Pada setiap penerbitan Warta Maklumat, Jadwal Safari Dakwah, Tabligh Akbar, atau Rilis LBH APII di Modul Redaksi, sistem menyediakan tombol **[Siarkan ke Grup WhatsApp APII]**.
     - Mengklik tombol akan menyiapkan naskah siaran terformat rapi untuk dibagikan ke WhatsApp Group resmi jamaah, kader, dan simpatisan:
       - *KOP Resmi:* `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*`
       - *Kategori Siaran:* `[AGENDA DAKWAH & KAJIAN ILMIAH]` atau `[WARTA MAKLUMAT RESMI]`
       - *Rincian Lengkap:* Judul Kegiatan/Edaran, Hari/Tanggal, Waktu Pelaksanaan, Lokasi/Link Streaming, Pemateri/Dewan Pakar APII, dan Keterangan Kehadiran (Gratis / Terbuka untuk Umum).
       - *Tautan Resmi:* Link langsung ke portal publik untuk konfirmasi kehadiran atau unduh PDF maklumat (`https://apologetislamindonesia.or.id/#/agenda/...`).
       - *Penutup Adab:* Salam penutup resmi kelembagaan.

3. **Mekanisme UI/UX Modal "Smart WhatsApp Relay Action Card":**
   - Setiap kali seorang pengurus menyelesaikan aksi di portal (klik tombol *Submit*, *Verifikasi*, atau *Approve*), sistem secara otomatis memunculkan modal dialog cerdas:
     - **Resolusi Otomatis Kontak Tujuan:** Sistem otomatis mencari nama dan nomor WhatsApp E.164 (`+628...`) pejabat target berikutnya dari tabel `Sheet_Users` berdasarkan peran dan wilayah terkait.
     - **Pratinjau Naskah Berita Terformat:** Naskah tersusun rapi dengan KOP resmi APII, ringkasan tindakan yang baru saja diselesaikan, permintaan tindak lanjut yang spesifik, tenggat waktu, dan URL rujukan langsung ke naskah/voucher di portal.
     - **Tiga Tombol Aksi Nyata (Zero-Friction):**
       1. `[Kirim Pesan ke Pejabat Target via WhatsApp]` $\to$ Membuka `https://wa.me/{nomor_target}?text={encoded_berita}`.
       2. `[Salin Naskah untuk Grup Resmi Pengurus / Jamaah]` $\to$ Menyalin seluruh teks ke papan klip untuk dibagikan ke WhatsApp Group resmi.
       3. `[Tutup / Lewati]`.

---

### 4.8 Modul Ekstensi Inovasi & Keunggulan Dakwah (17 Fitur Strategis)

Guna menempatkan Yayasan APII sebagai organisasi dakwah apologetika paling modern, transparan, dan tangguh di Indonesia, sistem diperkaya dengan 17 modul inovasi terintegrasi:

1. **Feature A: PWA (Progressive Web App) & Offline Fallback**
   - Portal pengurus dan publik dilengkapi file manifest `manifest.json`, icon multi-resolusi, dan Service Worker ringan.
   - Pengurus dan jamaah dapat memasang (*install*) aplikasi langsung ke layar utama smartphone (Android/iOS) atau desktop layaknya aplikasi native tanpa beban memori.
   - Menyediakan kemampuan *offline caching* untuk dokumen teks penting (Kode Etik, Bank Dalil, Agenda Kajian) saat berada di area blank spot dakwah pedalaman.

2. **Feature B: One-Click Decree Generator (SK Pengesahan Struktur Pengurus DPP/DPW & Personalia Divisi)**
   - Modul otomatisasi pembentukan Surat Keputusan (SK) resmi pengesahan susunan kepengurusan DPP, DPW, maupun personalia 7 divisi kerja.
   - Dilengkapi konsideran hukum ormas baku (Menimbang, Mengingat, Memperhatikan, Memutuskan), format lampiran bagan tabel nama pengurus & jabatan terstruktur rapi, tanda tangan Ketua Umum & Sekretaris Jenderal, serta stempel basah transparan.

3. **Feature C: Modul Siaga Advokasi Da'i (LBH APII Crisis Intake)**
   - Kanal cepat pelaporan insiden hukum, somasi, intimidasi dakwah, atau persekusi yang dialami para dai/kader APII di lapangan.
   - Pengurus atau publik dapat mengisi form darurat: Nama Dai, Lokasi Kejadian, Kronologi Peristiwa, Foto/Dokumen Bukti Somasi, dan Tingkat Urgensi (`KILAT / DARURAT`).
   - Memicu notifikasi estafet darurat prioritas tinggi ke Ketua Divisi Hukum & Advokasi serta Ketua Umum untuk penerbitan surat tugas pendampingan hukum dan rilis advokasi resmi.

4. **Feature D: Infaq Tematik Program Kerja (Cause-Specific Crowdfunding)**
   - Program kerja divisi tertentu (misal: Program Safari Dakwah Suku Terasing, Beasiswa Muallaf, Cetak Buku Dialog Teologi) dapat diaktifkan sebagai program donasi tematik di portal publik.
   - Dilengkapi kartu kampanye interaktif, target nominal dana, nominal terkumpul secara real-time, dan persentase progres donasi yang langsung terikat ke pos kas masuk yang relevan.

5. **Feature E: Presensi Digital Acara via Pemindai QR KTA (Event Attendance Scanner)**
   - Modul pemindai kamera web/ponsel di portal pengurus untuk mencatat kehadiran kader/anggota pada dauroh ilmiah, tabligh akbar, atau musyawarah kerja.
   - Pengurus memindai QR Code pada KTA fisik/digital peserta $\to$ sistem memvalidasi keaktifan anggota dan langsung mencatat waktu kehadiran ke `Sheet_Attendance`.

6. **Feature F: Benteng 4 Kantong Fiqih Kas (Multi-Wallet Sharia Separation)**
   - Penegakan kaidah syariah dalam tata kelola keuangan yayasan dengan membagi kas ke dalam 4 kantong terpisah:
     1. **Kantong Zakat:** Khusus penerimaan dan penyaluran hak 8 ashnaf (termasuk muallaf dan fii sabilillah).
     2. **Kantong Infaq Dakwah:** Operasional kajian, percetakan buku dalil, dan safari dakwah.
     3. **Kantong Wakaf:** Aset fisik tanah, bangunan sekretariat, dan sarana ibadah/dakwah permanen.
     4. **Kantong Amil/Operasional:** Biaya kesekretariatan, listrik, internet, dan operasional pengurus.
   - *Sharia Guard Engine:* Sistem memblokir pengajuan kas keluar jika dana Zakat diajukan untuk operasional umum non-ashnaf.

7. **Feature G: Kanal Konsultasi Aqidah Rahasia (Anonymous Inquiry Desk)**
   - Layanan tanya-jawab syubhat kristologi dan teologi komparatif bagi masyarakat awam atau calon muallaf yang membutuhkan jawaban ilmiah namun menghendaki kerahasiaan identitas.
   - Penanya mendapatkan ID Tiket dan Kunci Rahasia unik (hash token). Penanya dapat mengecek status jawaban dari Dewan Pakar / Divisi Litbang APII secara privat tanpa harus mendaftar akun atau mengungkap nomor telepon.

8. **Feature H: Maktabah Apologetika Digital & Bank Dalil Da'i**
   - Basis data pustaka digital internal yang memuat referensi ayat Al-Qur'an, Hadits shahih, kitab tafsir, dan perbandingan teks lintas agama yang telah diverifikasi oleh Divisi Litbang APII.
   - Dilengkapi fitur pencarian cepat (*instant keyword search*) berdasarkan topik (misal: "Ketuhanan Yesus", "Nubuat Nabi Muhammad di Kitab Terdahulu", "Penebusan Dosa") sebagai bekal referensi cepat bagi para dai saat berdialog di mimbar publik.

9. **Feature I: Modul Muallaf Care & E-Sertifikat Syahadat (Tashdiq Syahadatain)**
   - Modul terenkripsi untuk pendataan warga binaan muallaf yang dibimbing oleh Divisi Dakwah APII.
   - *E-Sertifikat Ikrar Syahadat:* Penerbitan otomatis Piagam Masuk Islam berformat cetak A4 elegan, memuat nama asli, nama hijrah (opsional), saksi-saksi, pembimbing syahadat, nomor registrasi nasional, dan QR verifikasi resmi.
   - Terintegrasi dengan penyaluran santunan zakat muallaf dari Kantong Zakat Kas Syar'i.

10. **Feature J: Pelacak Aset & Peminjaman Logistik Dakwah (Asset QR Tracker)**
    - Pencatatan seluruh inventaris fisik yayasan (sound system lapangan, mobil operasional dakwah, genset, proyektor, kamera studio) oleh Divisi Umum & Aset.
    - Sistem menghasilkan stiker QR Code unik untuk setiap aset fisik. Saat dipindai, menampilkan riwayat pemeliharaan, kondisi alat, dan log peminjaman antar-divisi yang terdata rapi di `Sheet_Asset_Loans`.

11. **Feature K: Anti-Leak Dynamic Watermarking Dokumen Internal**
    - Saat pengurus membuka pratinjau dokumen persuratan internal, draf rahasia, atau data pendaftar KTP di portal pengurus, canvas antarmuka secara otomatis menimpakan watermark diagonal transparan:
      `[NAMA PENGURUS] - [NIK/USER ID] - [TIMESTAMP DETIK] - RAHASIA APII`.
    - Mencegah kebocoran tangkapan layar (*screenshot*) dokumen internal ke publik karena sumber pembocor dapat diidentifikasi secara pasti.

12. **Feature L: Mesin Penanggalan Hijriah Otomatis (Auto-Hijri Engine)**
    - Modul konversi kalender Masehi ke Hijriah standar Kementerian Agama RI / Ummul Qura terpasang di modul persuratan.
    - Setiap surat dinas keluar otomatis mencantumkan dwi-penanggalan resmi di bawah KOP (Contoh: `Jakarta, 28 Jumadil Awal 1448 H / 09 November 2026 M`) tanpa perlu diketik manual.

13. **Feature M: Auto-Closing Rekonsiliasi Kas Bulanan (Tiap Akhir Bulan)**
    - Pada setiap akhir bulan kalender (tanggal 30/31 pukul 23:59 WIB), modul keuangan secara otomatis mengompilasi Laporan Arus Kas Bulanan format PSAK 409 / Standar Entitas Nirlaba.
    - File rekapitulasi PDF otomatis digenerate dan dikirim ke folder Google Drive Vault khusus Dewan Pengawas & Pembina untuk audit periodik.

14. **Feature N: Radar Tabayyun & Counter-Framing Media (Divisi Sosmed & Humas)**
    - Instrumen gerak cepat bagi Divisi Sosmed dan Humas untuk merespons framing jahat, video editan provokatif, atau hoaks yang menyerang dakwah APII.
    - Menyediakan form penerbitan *Klarifikasi Resmi (Tabayyun Release)* satu pintu berformat lembar pers dinamis dengan tombol satu klik untuk menyiarkan klarifikasi ke seluruh jejaring media sosial dan grup WhatsApp.

15. **Feature O: Jenjang Lisensi & Kompetensi Da'i di KTA Digital**
    - Sertifikasi kompetensi dai terintegrasi pada KTA Digital anggota, terbagi atas 3 tingkatan:
      - **Tingkat 1:** Dai Kader Muda (Dakwah umum kemasyarakatan).
      - **Tingkat 2:** Dai Madya / Lapangan (Dialog keagamaan & pembinaan muallaf).
      - **Tingkat 3:** Dewan Pakar / Apologet Senior (Kajian kristologi mendalam & riset perbandingan agama).
    - Status lisensi ini terverifikasi secara terbuka saat masyarakat memindai QR Code KTA di portal publik.

16. **Feature P: Peta Interaktif Sebaran Dakwah (APII Geo-Dakwah Hub)**
    - Peta interaktif kepulauan Indonesia berbasis Leaflet/SVG di portal publik.
    - Menampilkan titik-titik posko DPW APII yang telah terbentuk, persebaran dai binaan, lokasi binaan muallaf, serta agenda tabligh akbar terdekat per provinsi.

17. **Feature Q: Risalah Musyawarah Digital (Digital Plenary Ledger)**
    - Modul notulensi rapat pleno BPH, Rapat Kerja Wilayah (Rakerwil), dan Rapat Kerja Nasional (Rakernas).
    - Mencatat resume musyawarah, daftar hadir berparaf digital, dokumentasi foto, dan mengekstrak *Action Items* yang langsung mendisposisikan tugas ke modul divisi atau surat tugas.

---

## 5. Desain Basis Data (28 Tabel Google Sheets ACID Wrapper)

Seluruh tabel menggunakan penamaan bersih dengan awalan `Sheet_` tanpa karakter underscore ganda, diakses menggunakan konstanta pemetaan indeks numerik posisi kolom di `Database.gs`:

### 5.1 Kelompok Master Data & Identitas
1. `Sheet_Wilayah`: Master tenant wilayah (ID Wilayah, Nama DPP/DPW, Kode Penomoran, Alamat Sekretariat, Status Aktif).
2. `Sheet_Users`: Kredensial akun pengurus, email, password ter-hash SHA-256 + salt, peran RBAC, ID wilayah, nomor WhatsApp E.164, status aktif.
3. `Sheet_Sessions`: Token sesi aktif UUID (berlaku 7 hari), user ID, peran, timestamp expired.
4. `Sheet_Settings`: Parameter konfigurasi yayasan, nama Ketua Umum, Sekretaris, Bendahara, KOP surat resmi, dan konfigurasi folder induk Google Drive Vault.
5. `Sheet_Settings_Audit`: Riwayat audit atas setiap perubahan parameter yayasan pada `Sheet_Settings`.
6. `Sheet_Sequences`: Counter nomor urut sekuensial atomic per tenant wilayah untuk menjamin tidak ada nomor ganda pada surat dinas, voucher kas, nomor agenda, dan NIA anggota.
7. `Sheet_AuditLogs`: Rekam jejak permanen WORM (*Write-Once-Read-Many*) atas setiap login, mutasi kas, pengesahan surat, dan perubahan hak akses pengurus (dilengkapi timestamp, user, IP, dan payload aksi).

### 5.2 Kelompok Administrasi & Persuratan
8. `Sheet_Surat`: Master naskah surat keluar resmi, nomor urut sekuensial, kode surat, perihal, isi konsideran JSON, status approval, tanda tangan, link PDF Drive, hash verifikasi.
9. `Sheet_Surat_Masuk`: Agenda registrasi surat masuk, nomor agenda, asal instansi, nomor surat asal, tanggal diterima, perihal, file scan PDF Drive, status tindak lanjut.
10. `Sheet_Disposisi`: Lembar disposisi digital berjenjang, relasi ID surat masuk, draf rekomendasi Sekretaris, instruksi resmi Ketua, pejabat/divisi penerima disposisi, batas tenggat waktu, paraf digital, catatan pelaporan balik.
11. `Sheet_Templates`: Master template surat Docs/PDF, konfigurasi posisi koordinat stempel, KOP dinamis, dan teks statis regulasi.

### 5.3 Kelompok Keuangan & Perbendaharaan Syar'i
12. `Sheet_Keuangan`: Buku kas umum voucher penerimaan/pengeluaran kas, kategori transaksi, pos kantong syar'i (Zakat/Infaq/Wakaf/Amil), nominal Rupiah, tanggal, status dual-approval, link nota Drive, nomor kwitansi, ID wilayah.
13. `Sheet_Accounts`: Master rekening bank yayasan, dompet digital, akun kas tunai kasir, dan QRIS donasi.
14. `Sheet_Kas_Simulator`: Data proyeksi simulasi arus kas jangka pendek/menengah untuk perencanaan anggaran kegiatan.
15. `Sheet_Causes`: Program donasi tematik (crowdfunding divisi), target nominal, nominal terkumpul, periode aktif, rekening terhubung.

### 5.4 Kelompok Program Divisi & Keanggotaan
16. `Sheet_Divisi`: Proposal usulan program kerja dari 7 divisi resmi, rincian RAB, target capaian umat, status persetujuan Ketua, tautan berkas LPJ Google Drive, realisasi biaya.
17. `Sheet_Pendaftar`: Formulir registrasi calon anggota baru, biodata lengkap, NIK 16 digit terproteksi, pilihan divisi minat, tautan KTP ber-watermark UU PDP, status seleksi.
18. `Sheet_KTA_Nasional`: Master data keanggotaan tetap, NIA nasional resmi, tingkat lisensi dai (1/2/3), tanggal disahkan, tanggal kedaluwarsa (terkunci 5 tahun), link kartu KTA format cetak CR80 di Drive Vault.
19. `Sheet_Attendance`: Rekam presensi acara/dauroh via pemindaian QR KTA, ID event, NIA anggota, timestamp presensi, status validasi.

### 5.5 Kelompok Redaksi, Komunikasi & Publikasi
20. `Sheet_EditorialHistory`: Riwayat pembaruan teks redaksi portal publik (warta maklumat, agenda kegiatan, pengumuman, rilis tabayyun).
21. `Sheet_Visitors`: Rekam statistik anonim kunjungan portal publik (device viewport, waktu akses, hit counter).

### 5.6 Kelompok Modul Khusus Inovasi Dakwah
22. `Sheet_Advokasi`: Data pelaporan kasus advokasi hukum dai, pelapor, kronologi, urgensi (KILAT/BIASA), status penanganan LBH APII, arsip berkas perkara.
23. `Sheet_Muallaf`: Data pembinaan muallaf terenkripsi, tanggal syahadat, pembimbing, nomor sertifikat syahadat, status penyaluran zakat muallaf.
24. `Sheet_Assets`: Master inventaris logistik dakwah fisik, kode QR aset, kondisi, lokasi simpan, penanggung jawab Divisi Umum.
25. `Sheet_Asset_Loans`: Catatan peminjaman logistik dakwah fisik, tanggal pinjam/kembali, divisi peminjam, paraf penanggung jawab.
26. `Sheet_Consultations`: Tiket konsultasi aqidah privat (Anonymous Inquiry Desk), token rahasia, teks pertanyaan, jawaban Dewan Pakar, status selesai.
27. `Sheet_Knowledge_Base`: Bank dalil dan komparasi teologi apologetika, topik pembahasan, dalil Al-Qur'an/Hadits/kitab eksternal, kurasi Divisi Litbang.
28. `Sheet_Meetings`: Risalah rapat pleno BPH/Rakernas, daftar hadir berparaf digital, rangkuman keputusan, daftar tindak lanjut (*action items*).

---

## 6. Aturan Validasi Khusus, Algoritma & Keamanan Sistem

### 6.1 Format Penomoran Naskah Sekuensial Otomatis (Atomic Locking)
Format standar penomoran surat keluar yayasan:
$$\text{[NOMOR\_URUT] / [KODE\_SURAT] - [KODE\_TENANT] / [BULAN\_ROMAWI] / [TAHUN]}$$
- Contoh Surat Mandat DPP: `005/SM-DPP-APII/XI/2026`
- Contoh Surat Tugas DPW: `012/ST-DPW-JABO/XI/2026`
- **Jaminan Keamanan:** Nomor dihitung dari counter `Sheet_Sequences` di dalam blok `LockService.getScriptLock()` dengan perintah `SpreadsheetApp.flush()` sebelum pelepasan kunci lock, menjamin penomoran tidak akan pernah dobel meskipun ada 10 pengurus mengajukan surat pada detik yang sama.

### 6.2 Format Penomoran Induk Anggota (NIA) Nasional
Format baku kartu anggota nasional:
$$\text{APII - [KODE\_WILAYAH] - [TAHUN\_MASUK] - [NOMOR\_URUT\_NASIONAL]}$$
- Contoh: `APII-JKT-2026-00042`
- Masa berlaku dihitung tepat 5 tahun kalender: $\text{Tanggal Terbit} + 5\text{ Tahun}$.

### 6.3 Standar Kepatuhan UU PDP No. 27 Tahun 2022
1. Seluruh citra KTP wajib diolah di memori peramban klien (*Client-Side HTML5 Canvas*) sebelum byte data dikirim melalui jaringan.
2. Teks watermark bertuliskan tanggal transaksi dan tujuan spesifik menutup minimal $60\%$ area kartu identitas tanpa menutupi NIK untuk kepentingan verifikasi admin.
3. NIK disimpan dengan proteksi akses, dan tidak pernah ditampilkan secara utuh pada antarmuka publik atau QR code verifikasi (hanya menampilkan 4 digit awal dan 4 digit akhir, contoh: `3174**********01`).

### 6.4 Format Kwitansi Kas Dual-Slip Syar'i
- Lembar kwitansi mencantumkan: Nomor Voucher, Tanggal Pembukuan, Telah Diterima Dari / Diserahkan Kepada, Jumlah Nominal (Angka dan Huruf Terbilang Otomatis), Perihal Keperluan (Akun Pos Kas), dan Tanda Tangan/Paraf Bendahara + Cap Digital Kas.
- Kwitansi memiliki 2 bagian terpisah dengan garis putus-putus (*tear-off separator*):
  - Bagian Kiri ($30\%$): Bonggol arsip buku kas yayasan.
  - Bagian Kanan ($70\%$): Kwitansi sah untuk pihak pembayar/penerima.

### 6.5 Benteng 4 Kantong Fiqih Kas & Sharia Guard Engine
- Seluruh mutasi kas keluar divalidasi oleh `ShariaGuard.gs`:
  - Kas masuk dari pos `ZAKAT` hanya boleh dialokasikan untuk pos pengeluaran ashnaf (Muallaf Care, Bantuan Dai Pedalaman, Fakir Miskin).
  - Upaya penarikan dana Zakat untuk operasional kesekretariatan atau pengadaan aset fisik secara mutlak dibatalkan oleh sistem (*validation error exception*).

### 6.6 Anti-Leak Dynamic Watermarking Dokumen Internal
- Pratinjau draf surat dan dokumen berstatus rahasia di portal pengurus dilindungi oleh modul watermark canvas yang menimpakan pola teks diagonal transparan ($15\%$ opacity) memuat identitas pengurus aktif, ID sesi, dan stempel waktu UTC+7.

### 6.7 Mesin Penanggalan Hijriah Otomatis (Auto-Hijri Engine)
- Modul `HijriEngine.gs` mengonversi tanggal Gregorian ke penanggalan Hijriah dengan algoritma Ummul Qura yang disinkronkan dengan kriteria Imkanur Rukyah Kementerian Agama RI, menghasilkan penanggalan akurat tanpa intervensi manual.

---

## 7. Rencana Antarmuka Pengguna (UI/UX Design Specs)

### 7.1 Portal Pengurus (Private SPA - 10 Workspace Terpadu)
1. **Workspace 1: Dashboard Eksekutif & Action Inbox:**
   - Ringkasan statistik operasional: Surat Terbit Bulan Ini, Saldo 4 Kantong Kas, Program Divisi Berjalan, Anggota Baru.
   - *Action Inbox (Kotak Aksi Cepat):* Notifikasi mendesak berbasis peran pengguna.
   - Tenant Switcher di topbar (khusus pimpinan DPP & Superadmin).
2. **Workspace 2: Persuratan Dinas & Live Composer A4:**
   - Split-screen editor naskah dinas dengan pratinjau live A4 berstempel transparan multiply.
   - One-Click Decree Generator untuk penerbitan SK kepengurusan resmi.
3. **Workspace 3: Kotak Surat Masuk & Lembar Disposisi Multi-Divisi:**
   - Registrasi agenda surat masuk dan berkas digital scan PDF.
   - Form Draf Rekomendasi Disposisi oleh Sekretaris dan Pengesahan Instruksi oleh Ketua.
4. **Workspace 4: Keuangan Kas Syar'i & Dual-Slip Kwitansi:**
   - Buku kas umum dengan visualisasi saldo 4 kantong syar'i.
   - Fitur dual-approval kas keluar, simulator kas, dan cetak kwitansi dual-slip.
5. **Workspace 5: Program Kerja 7 Divisi Resmi (ART Pasal 16):**
   - Panel terpisah untuk masing-masing divisi: Humas, Litbang, Sosmed, Dakwah, Bisnis, Hukum, dan Umum.
   - Pengajuan proposal, realisasi anggaran bertahap, dan pelaporan LPJ.
6. **Workspace 6: Keanggotaan Nasional & KTA Digital:**
   - Seleksi berkas calon anggota dengan viewer KTP ter-watermark aman.
   - Kanvas cetak KTA standar industri CR80 ($300\text{ DPI}$) dua sisi dengan masa berlaku 5 tahun dan 5 butir Kode Etik.
7. **Workspace 7: Siaga Advokasi LBH APII & Perlindungan Dai:**
   - Dasbor intake laporan insiden hukum, manajemen perkara, dan disposisi kilat pendampingan hukum.
8. **Workspace 8: Muallaf Care, Presensi KTA & Logistik Dakwah:**
   - Pembinaan muallaf & e-sertifikat syahadat ber-QR.
   - Pemindai presensi kajian via kamera ponsel untuk memindai QR KTA anggota.
   - Pelacak inventaris aset fisik dan peminjaman logistik via label QR.
9. **Workspace 9: Maktabah Apologetika & Risalah Musyawarah:**
   - Bank dalil pencarian instan untuk rujukan dai di mimbar dakwah.
   - Notulensi pleno BPH dan Rakernas berparaf digital dengan pelacak action items.
10. **Workspace 10: Pengaturan Sistem, IAM & Vault:**
    - Manajemen akun pengurus (8-Role RBAC), reset sandi darurat, dan registrasi DPW baru.
    - File explorer Drive Vault 3-tingkat dan indikator kapasitas kuota Google Drive.

### 7.2 Portal Publik Adaptif (Landing Page & Layanan Umat)
- **Design System Islami Kontemporer Elegan (Anti-AI Slop):**
  - Palet warna resmi: Deep Emerald (`#064E3B`), Warm Gold (`#D97706`), dan Slate Grey (`#0F172A`).
  - Tipografi: Manrope / Poppins dengan hierarki visual kuat, whitespace lapang, dan bayangan lembut.
  - Bebas dari komponen dummy statis; seluruh data dinamis terhubung ke backend.
- **Dynamic Hostname Sniffing:** Otomatis menyesuaikan konteks wilayah berdasarkan subdomain (DPP Pusat atau DPW Wilayah terkait).
- **Peta Interaktif Sebaran Dakwah (APII Geo-Dakwah Hub):** Visualisasi sebaran posko DPW dan agenda dakwah se-Indonesia.
- **Kanal Donasi Tematik (Crowdfunding Infaq):** Program donasi spesifik dengan bar progres dana real-time.
- **Kanal Konsultasi Aqidah Rahasia (Anonymous Inquiry Desk):** Form privat tanya-jawab syubhat dengan kunci token rahasia.
- **Unified Public Verification Hub:** Pemindai QR publik untuk verifikasi keabsahan surat dinas, KTA anggota, dan sertifikat syahadat via streaming proxy Apps Script.
- **PWA Mobile-Ready:** Pengunjung dan jamaah dapat menginstal portal ke beranda ponsel cerdas.

---

## 8. Kriteria Pengujian & Matriks Penerimaan UAT (Acceptance Checklist)

- [ ] **Wildcard Routing & Hostname Sniffing:** Akses melalui subdomain wilayah (misal `jabodetabek.`) otomatis menampilkan profil, kontak sekretariat, dan agenda DPW Jabodetabek dengan fallback cerdas ke konten nasional.
- [ ] **Tenant Switcher Pimpinan:** Akun pimpinan DPP dan Superadmin dapat beralih tenant wilayah dalam $0\text{ ms}$ di topbar portal pengurus; akun DPW terkunci ketat pada wilayahnya.
- [ ] **Otentikasi & Keamanan Sesi:** Pengurus dapat login aman; sesi kedaluwarsa otomatis dalam 7 hari; hak akses 8 peran terisolasi ketat sesuai matriks RBAC.
- [ ] **Penomoran Sekuensial Surat Keluar:** Penomoran berjalan sekuensial tanpa loncat atau dobel, stempel transparan multiply terpasang rapi, penanggalan Hijriah terisi akurat, QR Code verifikasi terbaca valid.
- [ ] **Alur Kotak Surat & Disposisi:** Sekretaris berhasil meregistrasi surat masuk dan menerbitkan draf rekomendasi; Ketua berhasil mengesahkan instruksi disposisi; disposisi terdistribusi ke kotak masuk divisi pelaksana.
- [ ] **Dual-Approval Kas & Benteng 4 Kantong:** Kas keluar tidak dapat memotong saldo sebelum disetujui bertingkat oleh Bendahara dan Ketua; Kas masuk dapat disahkan langsung oleh Bendahara; Saldo Zakat terproteksi dari penarikan non-ashnaf; Cetak kwitansi dual-slip menghasilkan lembar bonggol $30\%$ dan lembar donatur $70\%$.
- [ ] **Program Kerja 7 Divisi & LPJ:** Seluruh 7 divisi dapat menyusun usulan kegiatan, mencairkan anggaran bertahap, dan mengunggah LPJ akuntabel.
- [ ] **Pendaftaran KTA & UU PDP:** Citra KTP calon anggota otomatis ter-watermark tebal menyilang di browser; Ketua dapat mengesahkan anggota; Kartu KTA terbit ukuran CR80 $300\text{ DPI}$, masa berlaku 5 tahun, dan memuat 5 butir Kode Etik di sisi belakang.
- [ ] **Smart WhatsApp Handover Relay:** Notifikasi pendaftaran anggota hanya terkirim ke internal pengurus (bukan ke nomor publik); tombol sebar agenda/warta ke WhatsApp Group menghasilkan naskah siap kirim yang rapi dan lengkap.
- [ ] **17 Fitur Inovasi Teruji:** Fitur LBH Advokasi, Muallaf Care, Presensi QR KTA, Aset Tracker, Maktabah Dalil, dan PWA berjalan lancar dan terhubung ke basis data.

---

================================================================================
ZONA BAWAH: MASTER CONTEXT & LOGIKA SISTEM TERKINI (LIVING CONTEXT)
================================================================================

### A. Status Arsitektur & Lingkungan Aktif
- **Versi Sistem Terkini:** v3.0.0 Enterprise (Multi-Tenant DPP + DPW se-Indonesia).
- **Core Engine:** Modular Google Apps Script terpusat di `apps-script/` dengan builder lintas platform Node.js (`scripts/build-apps-script.mjs`).
- **Penyebaran Skrip (Deploy):** Terintegrasi via `@google/clasp` dengan syntax gate dan version release reporter otomatis.
- **Frontend SPA Runtime:** Vanilla JavaScript ES6+, Tailwind CSS CDN, SWR In-Memory Caching (`portal/auth.js` dan modul pengurus), proteksi `.htaccess` untuk server Apache/LiteSpeed mandiri.
- **Mode Notifikasi Aktif:** Manual WhatsApp Dispatcher (E.164 + `wa.me` URI click-to-chat) + Direct Workspace Email Service.

### B. Skema 28 Kolom Database Berjalan & Pemetaan Indeks (Index-Based Mapping)
Setiap mutasi dan pembacaan tabel pada `Database.gs` dikontrol melalui konstanta `COL` berbasis indeks array posisi integer:

```javascript
// Cuplikan Indeks Pemetaan 28 Tabel Database.gs
const COL_WILAYAH = { ID: 0, NAMA: 1, KODE: 2, SLUG: 3, ALAMAT: 4, IS_ACTIVE: 5 };
const COL_USERS = { USER_ID: 0, WILAYAH_ID: 1, USERNAME: 2, FULLNAME: 3, EMAIL: 4, PHONE: 5, PASSWORD_HASH: 6, ROLE: 7, PERMISSIONS: 8, IS_ACTIVE: 9, CREATED_AT: 10 };
const COL_SESSIONS = { TOKEN: 0, USER_ID: 1, USERNAME: 2, ROLE: 3, WILAYAH_ID: 4, EXPIRES_AT: 5 };
const COL_SETTINGS = { KEY: 0, VALUE: 1, WILAYAH_ID: 2, UPDATED_BY: 3, UPDATED_AT: 4 };
const COL_SETTINGS_AUDIT = { ID: 0, KEY: 1, OLD_VALUE: 2, NEW_VALUE: 3, CHANGED_BY: 4, TIMESTAMP: 5 };
const COL_SEQUENCES = { TENANT_ID: 0, COUNTER_TYPE: 1, CURRENT_VAL: 2, LAST_UPDATED: 3 };
const COL_AUDIT_LOGS = { ID: 0, TIMESTAMP: 1, USER_ID: 2, WILAYAH_ID: 3, ACTION: 4, ENTITY: 5, RECORD_ID: 6, DETAILS_JSON: 7, IP_ADDRESS: 8 };

const COL_SURAT_KELUAR = { ID: 0, WILAYAH_ID: 1, NOMOR_SURAT: 2, TIPE: 3, PERIHAL: 4, TUJUAN: 5, TANGGAL: 6, TANGGAL_HIJRIAH: 7, KONTEN_JSON: 8, STATUS: 9, SIGNED_BY: 10, HASH_SHA256: 11, PDF_DRIVE_URL: 12, CREATED_BY: 13, CREATED_AT: 14 };
const COL_SURAT_MASUK = { ID: 0, WILAYAH_ID: 1, NO_AGENDA: 2, ASAL_SURAT: 3, NO_SURAT_ASLI: 4, TGL_SURAT: 5, TGL_TERIMA: 6, PERIHAL: 7, RINGKASAN: 8, PDF_FILE_URL: 9, STATUS_DISPOSISI: 10, CREATED_AT: 11 };
const COL_DISPOSISI = { ID: 0, WILAYAH_ID: 1, SURAT_MASUK_ID: 2, DRAF_REKOMENDASI_SEKRETARIS: 3, INSTRUKSI_KETUA: 4, TUJUAN_DIVISI_PEJABAT: 5, TINGKAT_URGENSI: 6, BATAS_WAKTU: 7, CATATAN_TAMBAHAN: 8, PARAF_KETUA: 9, STATUS: 10, LAPORAN_TINDAK_LANJUT: 11, UPDATED_AT: 12 };
const COL_TEMPLATES = { ID: 0, WILAYAH_ID: 1, KODE_TEMPLATE: 2, JUDUL: 3, STRUKTUR_JSON: 4, IS_DEFAULT: 5 };

const COL_KEUANGAN = { ID: 0, WILAYAH_ID: 1, NO_VOUCHER: 2, TIPE: 3, KANTONG_SYARIAH: 4, KATEGORI: 5, NOMINAL: 6, TANGGAL: 7, KETERANGAN: 8, BUKTI_URL: 9, STATUS_APPROVAL: 10, VERIFIED_BENDAHARA_BY: 11, APPROVED_KETUA_BY: 12, NO_KWITANSI: 13, CREATED_AT: 14 };
const COL_ACCOUNTS = { ID: 0, WILAYAH_ID: 1, NAMA_AKUN: 2, NO_REKENING: 3, ATAS_NAMA: 4, TIPE_AKUN: 5, IS_ACTIVE: 6 };
const COL_KAS_SIMULATOR = { ID: 0, WILAYAH_ID: 1, NAMA_SIMULASI: 2, SCENARIO_JSON: 3, CREATED_BY: 4, CREATED_AT: 5 };
const COL_CAUSES = { ID: 0, WILAYAH_ID: 1, JUDUL_PROGRAM: 2, DIVISI_KODE: 3, TARGET_NOMINAL: 4, TERKUMPUL_NOMINAL: 5, DESKRIPSI: 6, BANNER_URL: 7, STATUS: 8, EXPIRES_AT: 9 };

const COL_DIVISI = { ID: 0, WILAYAH_ID: 1, DIVISI_KODE: 2, NAMA_PROGRAM: 3, LATAR_BELAKANG: 4, TARGET_SASARAN: 5, RAB_NOMINAL: 6, TGL_PELAKSANAAN: 7, STATUS: 8, CATATAN_KETUA: 9, LPJ_DRIVE_URL: 10, REALISASI_DANA: 11, CREATED_BY: 12, UPDATED_AT: 13 };
const COL_PENDAFTAR = { ID: 0, WILAYAH_ID: 1, NIK: 2, NAMA: 3, TEMPAT_LAHIR: 4, TGL_LAHIR: 5, GENDER: 6, ALAMAT: 7, NO_WA: 8, EMAIL: 9, DIVISI_MINAT: 10, KTP_WATERMARK_URL: 11, PASFOTO_URL: 12, STATUS: 13, VERIFIED_SEKRETARIS_AT: 14, APPROVED_KETUA_AT: 15, NIA_ASSIGNED: 16 };
const COL_KTA_NASIONAL = { NIA: 0, WILAYAH_ID: 1, PENDAFTAR_ID: 2, NAMA_LENGKAP: 3, TINGKAT_LISENSI: 4, TGL_TERBIT: 5, TGL_KEDALUWARSA: 6, KODE_ETIK_VERSI: 7, KTA_DRIVE_URL: 8, QR_VERIFY_URL: 9, IS_ACTIVE: 10 };
const COL_ATTENDANCE = { ID: 0, WILAYAH_ID: 1, EVENT_NAMA: 2, TANGGAL: 3, NIA: 4, NAMA_ANGGOTA: 5, SCAN_TIMESTAMP: 6, VERIFIED_BY: 7 };

const COL_EDITORIAL_HISTORY = { ID: 0, WILAYAH_ID: 1, KATEGORI: 2, JUDUL: 3, KONTEN: 4, AUTHOR: 5, UPDATED_AT: 6 };
const COL_VISITORS = { ID: 0, WILAYAH_ID: 1, TIMESTAMP: 2, IP_HASH: 3, USER_AGENT: 4, PAGE_VIEWED: 5 };

const COL_ADVOKASI = { ID: 0, WILAYAH_ID: 1, TIKET_NO: 2, NAMA_DAI: 3, KONTAK: 4, LOKASI: 5, KRONOLOGI: 6, URGENSI: 7, BUKTI_URL: 8, STATUS: 9, CATATAN_LBH: 10, UPDATED_AT: 11 };
const COL_MUALLAF = { ID: 0, WILAYAH_ID: 1, REG_NO: 2, NAMA_ASLI: 3, NAMA_HIJRAH: 4, TGL_SYAHADAT: 5, PEMBIMBING: 6, SERTIFIKAT_URL: 7, STATUS_ZAKAT: 8, CREATED_AT: 9 };
const COL_ASSETS = { ID: 0, WILAYAH_ID: 1, KODE_ASET: 2, NAMA_BARANG: 3, KATEGORI: 4, KONDISI: 5, LOKASI_SIMPAN: 6, QR_URL: 7, CREATED_AT: 8 };
const COL_ASSET_LOANS = { ID: 0, WILAYAH_ID: 1, ASET_ID: 2, DIVISI_PEMINJAM: 3, PENANGGUNG_JAWAB: 4, TGL_PINJAM: 5, TGL_KEMBALI_RENCANA: 6, TGL_KEMBALI_AKTUAL: 7, STATUS: 8 };
const COL_CONSULTATIONS = { ID: 0, TOKEN_HASH: 1, TIKET_NO: 2, TOPIK: 3, PERTANYAAN: 4, JAWABAN: 5, STATUS: 6, CREATED_AT: 7, ANSWERED_AT: 8 };
const COL_KNOWLEDGE_BASE = { ID: 0, KATEGORI: 1, TOPIK: 2, DALIL_TEXT: 3, SUMBER_REFERENSI: 4, KATA_KUNCI: 5, CURATED_BY: 6, UPDATED_AT: 7 };
const COL_MEETINGS = { ID: 0, WILAYAH_ID: 1, JUDUL_RAPAT: 2, TANGGAL: 3, NOTULEN_TEXT: 4, ACTION_ITEMS_JSON: 5, DOKUMENTASI_URL: 6, PARAF_PIMPINAN: 7, CREATED_BY: 8 };
```

### C. Logika Bisnis & Formula Hitung yang Berlaku
- **Formula Terbilang Rupiah:** Rekursif terbilang baku Indonesia terpasang di `KwitansiEngine.gs` menangani nominal ribuan hingga miliaran Rupiah dengan imbuhan `Rupiah` resmi.
- **Enkripsi Integritas Dokumen:** Setiap surat keluar yang disahkan dihitung hash-nya menggunakan:
  $$\text{Hash} = \text{SHA-256}(\text{NomorSurat} + \text{Tanggal} + \text{KontenUtama} + \text{Penandatangan})$$
- **Pembersihan Sesi Otomatis Resisten Bug:** `purgeExpiredSessions_` menghapus baris sesi kedaluwarsa secara descending (*bottom-up*) untuk mencegah pergeseran baris data yang membatalkan sesi pengurus aktif lain.

### D. Log Pembaruan Resmi (Official Update Log)
- **v1.0.0 s/d v2.0.0:** Fondasi awal sistem administrasi internal berbasis Google Apps Script monolitik dan spreadsheet tunggal.
- **v2.5.0:** Pemisahan arsitektur monolitik menjadi 17 modul modular Apps Script, integrasi Mini-CMS Redaksi, pemantauan pengunjung `Visitor.gs`, penegasan dual-approval kas keluar, dan standardisasi UI Anti-AI.
- **v2.5.1 & v2.5.2:** Audit performa RetroBOT, eliminasi N+1 kueri dashboard, akselerasi `createTextFinder`, perbaikan race condition verifikasi sesi, cache-busting `&_t=` dinamis, dan penegakan `SpreadsheetApp.flush()` mutlak di setiap penulisan data.
- **v3.0.0 Enterprise (Harmonisasi Paripurna PRD, TOR Resmi, & Rangkaian Inovasi Terpadu):**
  - **Arsitektur Subdomain & Wildcard Routing:** Penetapan domain produksi `apologetislamindonesia.or.id` (DPP) dan `{wilayah}.apologetislamindonesia.or.id` (DPW se-Indonesia) berbasis Wildcard DNS tunggal dan deteksi hostname instan (`detectCurrentTenant()`).
  - **Tenant Switcher & Otonomi DPW:** Penambahan pemilih tenant instan $0\text{ ms}$ untuk pimpinan DPP di topbar portal pengurus, disertai partisi data terisolasi untuk masing-masing DPW.
  - **Superadmin RBAC Omnipresence & Governance:** Wewenang global Superadmin melintasi tenant DPP & seluruh DPW, dilengkapi penegakan WORM Audit Trail bertanda `SUPERADMIN_OVERRIDE`.
  - **Spesifikasi 8 Peran RBAC Terpadu:** Kodifikasi mendalam atas alur kerja harian, batasan wewenang, dan personalisasi antarmuka UI/UX untuk Ketua, Sekretaris, Bendahara, Ketua Divisi, Anggota Divisi, Pembina, Pengawas, dan Superadmin.
  - **Smart WhatsApp Handover & Relay Dispatcher:** Penegasan alur pendaftaran anggota hanya untuk internal antar-pengurus (tanpa pesan WA ke publik), serta fitur *Community Broadcast* 1-klik untuk syiar Warta, Agenda Dakwah, dan Infaq ke WhatsApp Group.
  - **Rangkaian 17 Fitur Inovasi Dakwah:** Penambahan PWA & Offline Fallback, One-Click Decree Generator, LBH Siaga Advokasi, Infaq Tematik Crowdfunding, Presensi Scan QR KTA, Benteng 4 Kantong Fiqih Kas (Sharia Guard), Kanal Konsultasi Aqidah Rahasia, Maktabah Dalil, Muallaf Care & E-Sertifikat Syahadat, Aset QR Tracker, Anti-Leak Dynamic Watermarking, Auto-Hijri Engine, Auto-Closing Kas Bulanan, Radar Tabayyun Media, Jenjang Lisensi Da'i di KTA, Geo-Dakwah Hub, dan Risalah Musyawarah Digital.
  - **Ekspansi Basis Data ACID:** Skema database ditingkatkan dari 19 menjadi **28 Tabel Google Sheets ACID Wrapper** terindeks numerik.
  - **Kepatuhan Regulasi Penuh:** Penegakan Akta & SK Kemenkumham No. AHU-0014970.AH.01.04.Tahun 2023, AD/ART APII 16 Bab, dan standar UU Perlindungan Data Pribadi No. 27/2022.
