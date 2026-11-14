# SIAP APII Enterprise (v3.1.0)
### Sistem Informasi & Administrasi Terpadu Yayasan Apologet Islam Indonesia
**SK Kemenkumham RI No. AHU-0014970.AH.01.04.Tahun 2023**

---

## 🌟 Tentang SIAP APII Enterprise

**SIAP APII Enterprise** adalah sistem tata kelola kelembagaan, persuratan dinas digital, transparansi keuangan syariah, dan pembinaan anggota berskala nasional yang dikembangkan khusus untuk **Yayasan Apologet Islam Indonesia (APII)**.

Sistem dirancang dengan arsitektur **Serverless Zero-Cloud-Cost** memanfaatkan ekosistem Google Workspace (Google Apps Script, Google Sheets 28 Tabel ACID, dan Google Drive Vault) yang dipadukan dengan **Dwi-Portal Responsive** (Portal Publik Adaptif dan Portal Pengurus Private SPA 10-Workspace).

---

## 🏛️ Legalitas & Standar Entitas

* **Nama Entitas:** Yayasan Apologet Islam Indonesia (APII)
* **Nomor SK Kemenkumham RI:** `AHU-0014970.AH.01.04.Tahun 2023`
* **Domain Dasar:**
  * DPP Nasional: `apologetislamindonesia.or.id`
  * DPW Wilayah: `{wilayah}.apologetislamindonesia.or.id` (contoh: `jabodetabek.apologetislamindonesia.or.id`)
* **Pengembang Resmi:** Sigit Adi Irianto (Freelance Software Engineer) | [WhatsApp](https://wa.me/6281358575678) | [sigitadi.id](https://sigitadi.id)

---

## 📐 Arsitektur Sistem

```
+-----------------------------------------------------------------------------------+
|                            WILDCARD DNS CLOUDFLARE                                |
|  *.apologetislamindonesia.or.id  /  apologetislamindonesia.or.id                 |
+-----------------------------------------------------------------------------------+
                                   |
         +-------------------------+-------------------------+
         |                                                   |
         v                                                   v
+----------------------------------+   +--------------------------------------------+
|     ZONA 1: PORTAL PUBLIK        |   |       ZONA 2: PORTAL PENGURUS SPA          |
|         (Directory: /public)     |   |          (Directory: /portal)              |
|                                  |   |                                            |
|  - Subdomain Sniffer (DPP / DPW) |   |  - Topbar Multi-Tenant Switcher            |
|  - Pendaftaran Anggota 100% Free |   |  - 10 Workspaces Operasional Pimpinan      |
|  - KTP Watermarker UU PDP <200KB |   |  - Live Virtual A4 Composer & Stamp Blend  |
|  - Transparansi Infaq & QRIS     |   |  - Pembukuan Kas Dual-Approval & 4 Dompet  |
|  - Warta, Maklumat & Agenda      |   |  - Kwitansi Proporsional Dual-Slip 30%:70% |
|  - Unified Public Verif Hub      |   |  - KTA Digital CR80 ISO/IEC 7810 Canvas    |
|  - Konsultasi Kristologi Anonim  |   |  - Smart WhatsApp Handover Relay           |
+----------------------------------+   +--------------------------------------------+
         |                                                   |
         +-------------------------+-------------------------+
                                   | (CORS text/plain JSON POST)
                                   v
+-----------------------------------------------------------------------------------+
|               BACKEND: GOOGLE APPS SCRIPT MODULAR / BUNDLED                       |
|   (apps-script/*.gs  -->  Compiled via Node.js to: build/dist_Code.gs)             |
|                                                                                   |
|  - Mutex LockService (Anti Race-Condition)                                        |
|  - 28 Google Sheets ACID Tables & Relational Lookups                              |
|  - Auth UUID Session 7-Hari & 8-Role RBAC                                         |
|  - Sharia Guard (Kas Zakat Khusus 8 Ashnaf; Anti Salah Salur)                     |
|  - Hijri Calendar Ummul Qura & Indonesian Terbilang Engine                        |
|  - 17 Modul Inovasi Dakwah Terintegrasi                                           |
|  - Google Drive Vault 3-Tier Security Hierarchy                                   |
+-----------------------------------------------------------------------------------+
```

---

## 📂 Struktur Direktori Proyek

```
Development Website DPP APII/
├── apps-script/                        # 17 Berkas Modul Backend Google Apps Script
│   ├── Database.gs                     # 28 Skema Tabel, Mutex Lock & Safe Query Engine
│   ├── Auth.gs                         # SHA-256 Hashing, 7-Day UUID Session & 8 Roles
│   ├── HijriEngine.gs                  # Kalkulator Ummul Qura / Kemenag
│   ├── TemplateSuratDocs.gs            # Layout A4, KOP DPP/DPW & Stempel Multiply
│   ├── Surat.gs                        # Alur Persuratan Keluar & Penomoran Otomatis
│   ├── SuratMasuk.gs                   # Buku Agenda Digital Surat Masuk
│   ├── Disposisi.gs                    # Multi-Divisi Disposisi & Instruksi Ketua
│   ├── ShariaGuard.gs                  # Validasi Syariah 8 Ashnaf Kas Zakat
│   ├── KwitansiEngine.gs               # Kwitansi Dual-Slip & Mesin Terbilang Rupiah
│   ├── Keuangan.gs                     # 4 Dompet Syariah & Dual-Approval Kas
│   ├── Divisi.gs                       # Manajemen Proker 7 Divisi (ART Ps 16) & LPJ
│   ├── Keanggotaan.gs                  # Pendaftaran Gratis, KTA 5-Tahun & NIA Urut
│   ├── InovasiDakwah.gs                # 17 Modul Inovasi (LBH, Muallaf, Maktabah, dll)
│   ├── NotificationDispatcher.gs       # Smart WhatsApp Relay (wa.me E.164)
│   ├── DriveVault.gs                   # Manajemen Berkas Arsip 3-Tier
│   ├── Setup.gs                        # Idempotent Database Initialization & Seeding
│   └── Code.gs                         # Central HTTP Router (doGet & doPost)
├── build/
│   └── dist_Code.gs                    # Single-file Bundle siap salin ke Google Apps Script (114.87 KB)
├── portal/                             # ZONA 2: Portal Pengurus Private SPA
│   ├── config.js                       # Pengaturan Endpoint API & Auto-Demo Mode
│   ├── auth.js                         # State Sesi UUID, Akun Demo & Switcher Pengurus
│   ├── state.js                        # SWR In-Memory Caching & Local Mock Engine
│   ├── app.js                          # Controller 10 Workspace, Live A4 & CR80 Canvas
│   ├── index.html                      # Single-File SPA Shell Lengkap
│   ├── manifest.json                   # Web App Manifest PWA Pengurus
│   └── sw.js                           # Service Worker Offline Caching
├── public/                             # ZONA 1: Portal Publik Adaptif
│   ├── config.js                       # Pengaturan Publik, Rekening BSI & Crowdfunding
│   ├── app.js                          # Subdomain Sniffer, Hash Router, KTP Watermarker
│   ├── index.html                      # Landing Page Publik Adaptif & Verification Hub
│   ├── manifest.json                   # Web App Manifest PWA Publik
│   └── sw.js                           # Service Worker Offline Caching
├── scripts/
│   ├── build-apps-script.mjs           # Node.js Syntax Gate & Single-file Bundler
│   ├── generate-diagrams.mjs           # Image Exporter 7 Diagram Alur SIAP APII
│   └── generate-html.mjs               # Kompiler Dokumen Panduan Eksekutif Base64
├── assets/diagrams/                    # 7 Diagram Arsitektur Format PNG & JPG
├── prd.md                              # Blueprint Teknis Lengkap 28 Tabel & 10 Workspace
├── revisi.md                           # Laporan Audit & Verifikasi Pre-Eksekusi 7 Lapisan
├── PANDUAN_EKSEKUTIF_DAN_FITUR_SIAP_APII.md   # Dokumen Presentasi Klien
└── README.md                           # Dokumentasi Panduan Utama (Berkas ini)
```

---

## 🚀 Panduan Instalasi & Deployment

### 1. Backend Google Apps Script

1. Buka [script.google.com](https://script.google.com) dan buat proyek baru (beri nama `SIAP APII Backend Enterprise`).
2. Terdapat 2 opsi penyalinan:
   * **Opsi A (Single-file - Rekomendasi):** Buka berkas `build/dist_Code.gs`, salin seluruh isinya (2.968 baris), dan tempel ke editor Google Apps Script menggantikan berkas `Code.gs`.
   * **Opsi B (Modular via Clasp CLI):** Pasang Google Clasp (`npm i -g @google/clasp`), inisialisasi `.clasp.json`, lalu jalankan `clasp push` dari direktori `apps-script/`.
3. Jalankan fungsi **`setup()`** dari menu editor Apps Script:
   * Fungsi ini bersifat **idempotent** (aman dijalankan berulang kali).
   * Otomatis membuat Google Spreadsheet 28 lembar ACID dengan kunci mutex.
   * Mengkonfigurasi keamanan `ScriptProperties` (`SESSION_SALT`, `EMERGENCY_RESET_KEY`).
   * Menghasilkan akun default **Superadmin**:
     * Username: `admin`
     * Password: `APII@Admin2026`
   * Menghasilkan akun BPH percontohan (Ketua Umum, Sekretaris Umum, Bendahara Umum, Ketua DPW Jabodetabek).
4. Klik **Deploy** $\to$ **New Deployment**:
   * Pilih tipe: **Web App**.
   * Description: `SIAP APII v3.0.0 Production`.
   * Execute as: **Me (akun Google Anda)**.
   * Who has access: **Anyone** (wajib Anyone agar frontend dapat mengakses via CORS).
5. Salin URL Web App yang dihasilkan (format: `https://script.google.com/macros/s/.../exec`).
6. Tempelkan URL tersebut ke:
   * `portal/config.js` $\to$ ubah `API_URL: 'https://script.google.com/macros/s/.../exec'`
   * `public/config.js` $\to$ ubah `API_URL: 'https://script.google.com/macros/s/.../exec'`

---

### 2. Frontend (Portal Publik & Portal Pengurus)

Dapat di-hosting pada layanan statis gratis apa pun:
* **Cloudflare Pages / Netlify / Vercel / GitHub Pages**:
  * Direktori root publik: arahkan ke `public/` (atau gunakan subfolder `portal/` dan `public/`).
* **Pengujian Lokal Langsung:**
  * Buka langsung berkas `public/index.html` dan `portal/index.html` pada peramban peramban (Chrome, Edge, Firefox, Safari).
  * Sistem telah dilengkapi fitur **Auto-Demo Mock Mode**:
    * Jika `API_URL` masih kosong atau peramban dalam keadaan offline, sistem otomatis mengaktifkan mesin mock lokal berbasis `localStorage` dengan data lengkap 10 workspace sehingga seluruh tombol, form, modal, live A4, dan cetak KTA dapat diuji seketika tanpa hambatan (*zero dead buttons*).

---

## 🔑 Fitur Utama & Keunggulan

### 1. Naskah Surat Keluar (Live Virtual A4 Composer)
* Tampilan visual presisi kertas **A4 ($210 \times 297\text{ mm}$)** dengan KOP resmi dinamis (DPP Pusat / DPW Wilayah), basmalah kaligrafi Arab, dan penomoran otomatis berurutan (`005/SM-DPP-APII/XI/2026`).
* Otorisasi pengesahan berstempel basah digital dengan teknologi CSS blend mode `multiply`.
* Terintegrasi cetak langsung atau simpan sebagai PDF beresolusi tinggi via fitur cetak browser.
* Dilengkapi kode verifikasi hash integrity SHA-256 dan footer rujukan ke portal publik.

### 2. Pembukuan Kas 4 Dompet Syariah & Dual-Approval
* **Pemisahan 4 Dompet:**
  1. *Kas Operasional Dakwah:* Biaya rutin, ATK, server, listrik, sekretariat.
  2. *Kas Zakat (Ashnaf Guard):* Khusus 8 Ashnaf syar'i (Fisabilillah, Fakir, Miskin, Muallaf, dll).
  3. *Kas Infaq & Shadaqah:* Kegiatan dakwah umum, seminar kristologi komparatif.
  4. *Kas Wakaf Produktif:* Pembebasan lahan, pembangunan studio dakwah dan markaz abadi.
* **Dual-Approval:** Setiap pengeluaran kas (BKK) wajib mendapatkan persetujuan Ketua sebelum dapat dicairkan oleh Bendahara.
* **Kwitansi Dual-Slip (Proporsional $30\% : 70\%$):**
  * Slip 1 ($30\%$): Arsip Bendahara Yayasan.
  * Slip 2 ($70\%$): Bukti Sah Pembayar / Muzakki.
  * Dilengkapi konversi angka ke terbilang otomatis Bahasa Indonesia (*e.g.* Rp 15.000.000 $\to$ *"Lima Belas Juta Rupiah"*).

### 3. Keanggotaan & KTA Digital CR80 (ISO/IEC 7810 ID-1)
* Pendaftaran anggota **100% Gratis** tanpa pungutan biaya atau iuran apa pun.
* Masa berlaku KTA dikunci **5 tahun penuh** sejak tanggal pengesahan.
* Renderer Canvas presisi kartu fisik ($1012 \times 638\text{ px}$ @ 300 DPI) lengkap dengan ornamen emas Islami, foto resmi, chip EMV, QR validasi, dan nomor NIA unik.
* Tombol unduh langsung gambar KTA berkualitas tinggi dalam format PNG.

### 4. Proteksi KTP Kepatuhan UU PDP No. 27/2022
* Saat calon anggota mengunggah foto KTP pada Portal Publik, foto diproses langsung di peramban pengguna (*client-side HTML5 Canvas*).
* Otomatis dibubuhi stempel watermark diagonal berulang:
  `"HANYA UNTUK PENDAFTARAN ANGGOTA YAYASAN APOLOGET ISLAM INDONESIA • [WAKTU/TANGGAL] • UU PDP NO. 27/2022"`
* Otomatis dikompresi ke format WebP di bawah **200 KB**, mencegah penyalahgunaan data pribadi oleh pihak yang tidak bertanggung jawab.

### 5. Smart WhatsApp Handover Relay
* Notifikasi pendaftaran anggota diarahkan melalui tautan pre-filled WhatsApp resmi (`wa.me` standar E.164) **khusus antar-pengurus internal** (Pemohon $\to$ Sekretaris $\to$ Ketua $\to$ Sekretaris).
* **Prinsip Privasi Ketat:** Sistem tidak pernah mengirim pesan WhatsApp spam ke nomor pelamar umum.

### 6. Unified Public Verification Hub
* Menyediakan pusat pemeriksaan keabsahan satu pintu bagi masyarakat umum:
  * **Cek Surat Dinas:** Berdasarkan nomor naskah surat atau hash SHA-256.
  * **Cek KTA Digital:** Berdasarkan Nomor Induk Anggota (NIA) atau NIK terdaftar.
  * **Cek Kwitansi Kas:** Berdasarkan nomor bukti kas masuk (BKM) atau kas keluar (BKK).
* Mengeluarkan lencana verifikasi berstempel legalitas SK Kemenkumham RI.

---

## 🛠️ Perintah Uji Coba & Build

```bash
# Validasi sintaks seluruh berkas JavaScript frontend
node -c portal/config.js portal/auth.js portal/state.js portal/app.js
node -c public/config.js public/app.js

# Re-build dan validasi bundle Google Apps Script (menghasilkan build/dist_Code.gs)
node scripts/build-apps-script.mjs

# Re-generate gambar diagram arsitektur ke folder assets/diagrams/
node scripts/generate-diagrams.mjs
```

---

## 📞 Dukungan Teknis & Konsultasi

Untuk pertanyaan implementasi, integrasi domain kustom, atau kustomisasi fitur lebih lanjut:

**Sigit Adi Irianto**
* **Jabatan:** Freelance Software Engineer & Lead Architect
* **WhatsApp:** [+62 813-5857-5678](https://wa.me/6281358575678)
* **Website Portofolio:** [sigitadi.id](https://sigitadi.id)
* **Organisasi Klien:** Yayasan Apologet Islam Indonesia (APII)

