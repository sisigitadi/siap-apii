# REVISI.MD — Lembar Kerja & Rencana Eksekusi Sistem (RetroBOT Lifecycle)
================================================================================
STATUS: SEDANG BERJALAN (FASE 4 SELESAI, MENUJU FASE 5)
SOP: PLAN -> APPROVAL ("OKE TERAPKAN") -> SURGICAL EXECUTION -> VERIFY & SYNC PRD
ARSITEK: RetroBOT v3.0 by Sigit Adi (https://sigitadi.id)
RUJUKAN UTAMA: rancangan_SIAP_APII.md (16 Bab Terpadu)
================================================================================

## 1. Status Pembersihan Repositori (Completed)
- [x] **Pembersihan Artefak Vercel:** Menghapus seluruh berkas `vercel.json` (root, portal, public, frontend).
- [x] **Pembersihan AI Agent Non-Gemini:** Menghapus `ZettBOT.md`, `wealth_advisor_agent.py`, `.commandcode/`, `.freebuff/`.
- [x] **Setup Routing Hosting Statis / cPanel:** Membuat berkas `.htaccess` di root, `portal/`, dan `public/` dengan aturan SPA Rewrite dan *Security Headers* (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`).
- [x] **Pembaruan Konteks & Branding Dokumentasi:** Sinkronisasi `prd.md`, `revisi.md`, dan `README.md` ke standar RetroBOT Lifecycle Architecture.
- [x] **Pelacakan Cetak Biru:** Menyertakan `rancangan_SIAP_APII.md` ke dalam *tracking* Git repositori.

---

## 2. Rencana Tahapan Eksekusi Paripurna (Fase 0 s.d. Fase 10)

Setelah pengguna memberikan instruksi tegas **"OKE TERAPKAN"**, implementasi kode akan dieksekusi secara bedah per fase berikut:

### Fase 0: Penyelarasan PRD & Master Context
- [x] Sinkronisasi Zona Atas dan Zona Bawah `prd.md` dengan Bab 1 s.d. Bab 16 `rancangan_SIAP_APII.md`.
- [x] Penguncian skema 10 tabel basis data master dan ekstensi.

### Fase 1: Multi-Tenant Database & Partisi Sekuensial (gas/Database.gs & gas/00-Konfig.gs)
- [x] Inisialisasi tab sheet baru: `Sheet_Wilayah`, `Sheet_KTA_Nasional`, `Sheet_Settings_Audit`, `Sheet_Kas_Simulator`.
- [x] Injeksi kolom `wilayah_id` pada seluruh tabel operasional (Surat, Keuangan, Anggota, Formasi, Log).
- [x] Implementasi atomic sequence locking dengan partisi wilayah (`SURAT:{wilayah}:{tipe}:{thn}`, `KEU:{wilayah}:{thn}`, `KTA:NASIONAL:{thn}`).
- [x] Penambahan `SpreadsheetApp.flush()` sebelum pelepasan kunci `lock.releaseLock()`.
- [x] Penyiapan skrip migrasi data eksisting ke tenant awal `DPW_JABODETABEK`.

### Fase 2: Tata Naskah Dinas, KOP & Stempel Digital (gas/Surat.gs & portal/portal.js)
- [x] Komposer Virtual A4 (Split-Screen Live Preview & Dynamic DPP/DPW KOP).
- [x] 5 Klaster Surat: Umum/Dinas, Undangan/Tugas, SK Penetapan, Proposal/LPJ (Tri-Signature), Muallaf (Catur-Signature).
- [x] Rotasi stempel basah acak 3°–5° dengan latar transparan PNG & blend-mode multiply.
- [x] Penegakan aturan CSS cetak `@media print { break-inside: avoid; }` pada blok tanda tangan (Benteng A-12).
- [x] Pembukaan gembok status REJECTED (Rejection Loop Benteng A-08) pada backend & frontend.

### Fase 3: Keuangan Kas Syar'i & Kalkulator Digital (gas/Keuangan.gs & portal/portal.js)
- [x] Kalkulator simulasi kas masuk bersih & pipa proyeksi inflow (TikTok Live 50%, YouTube 30%, QRIS 0.7%, Donatur Tetap) berfitur konversi 1-klik (Benteng A-10).
- [x] Alur persetujuan kas bertingkat (*Dual-Approval System*) dengan rute status `DRAFT_REVISI` dan tombol perbaiki/ajukan ulang (Benteng A-08).
- [x] Kwitansi *Dual-Slip* Landscape (Bonggol Arsip Kasir 30% & Lembar Utama Donatur 70%) berstempel basah transparan (3°–5° rotasi), QR validasi, dan watermark audit `BATAL/VOID` (Benteng A-09).
- [x] Proteksi batas kas kecil mandiri Bendahara (Rp 500rb) dan peringatan cadangan kas aman operasional (Rp 2jt).
- [x] Partisi counter nomor kwitansi/voucher per wilayah (`KW-M`, `VKK`, `BON`, `BA-KEU`) dan isolasi saldo multi-tenant (Benteng A-01 & Benteng A-02).

### Fase 4: Routing Disposisi & WhatsApp Engine (gas/Utils.gs & portal/portal.js)
- [x] 21 Titik Sentuh Notifikasi WhatsApp resmi (WA-01 s.d. WA-21) dalam mesin naskah terpadu `buildWaMessage`.
- [x] 5 Benteng Keandalan (*Reliability Guards*): Sanitasi E.164, Safe URI encoding, Dialog Anti-Nomor Kosong, Clipboard Fallback, dan Proteksi Teks < 650 Karakter.
- [x] Jam senyap (*Quiet Hours* 22.00–06.00 WIB) dengan penandaan otomatis pesan senyap organisasi.
- [x] Lokalisasi notifikasi peran wilayah `kirimNotifikasiKeRole_(role, ..., targetWilayah)` untuk mencegah spam blast lintas cabang (Benteng A-03).

### Fase 5: Keanggotaan Nasional & KTA 5 Tahun (gas/Auth.gs & portal/portal.js)
- [x] Penegakan masa berlaku KTA terkunci mutlak 5 tahun (ART Bab II Pasal 4 & 5).
- [x] Generator KTA sekuensial nasional tunggal (KTA:NASIONAL:{tahun} - e.g. 2026-JABO-00142) dengan pencatatan Sheet_KTA_Nasional.
- [x] Kepatuhan UU PDP No. 27/2022 pada endpoint verifikasi publik /verifikasi-kta (masking NIK & privasi alamat).
- [x] Modul konsolidasi anggota lama & klaim mandiri tautan WhatsApp (token 15 menit).
- [x] Generator KTA digital kanvas CR80 ISO/IEC 7810 ID-1 (1012x638 px, 300 DPI), tampak muka & punggung (5 butir kode etik ART Bab II Pasal 6), cetak instan & unduh PNG.
- [x] Navigasi 3 Tab Pengelolaan Anggota di portal: Verifikasi Berkas Baru, Direktori KTA Nasional Aktif, dan Konsolidasi Anggota Lama.

### Fase 6: Formasi Pengurus & Delegasi Plt (gas/Divisi.gs & portal/portal.js)
- [x] Pemetaan BPH & 7 Divisi Resmi APII sesuai ART Bab V Pasal 14 & 16 (Sheet_Pengurus).
- [x] Manajemen masa bakti & sisa masa jabatan kepengurusan 5 tahun (Tenure Management).
- [x] One-Click Decree Generator SK Struktur Kepengurusan DPP ber-konsideran hukum lengkap & penomoran naskah dinas sekuensial.
- [x] Modul Delegasi Pelaksana Tugas (Plt / Ad-Interim) maksimal 60 hari berfitur auto-revoke & pembatalan awal (Sheet_Plt_Delegasi).
- [x] Antarmuka Tab Formasi Pengurus & Plt di menu Pengaturan dengan visual bagan organisasi interaktif.

### Fase 7: Google Drive Storage Vault Engine (gas/Utils.gs & portal/portal.js)
- [x] Struktur folder hierarkis 3 tingkat (Root -> Wilayah -> Tahun -> 8 Kategori Baku + _Trash_Arsip).
- [x] Pangkalan data indeks berkas digital Sheet_Storage_Vault terpasang.
- [x] Kompresi gambar WebP otomatis di browser klien (< 250 KB) untuk efisiensi kuota 95%.
- [x] Watermark dinamis KTP pendaftar dengan kepatuhan UU PDP No. 27/2022.
- [x] Mekanisme Soft-Delete recycle bin retensi 30 hari & ambang kuota 80% (Warning) / 90% (Critical).
- [x] Antarmuka Penjelajah Dokumen Vault terintegrasi di portal pengurus.

### Fase 8: Website Publik Adaptif Tunggal (public/app.js & public/index.html)
- [x] Lensa wilayah dinamis (*Regional Lens*) berbasis URL slug/parameter (`?w=jabo`, `?w=pusat`), pemilih cabang di header/drawer, dan sinkronisasi kontak & KOP.
- [x] Ticker maklumat nasional DPP (*National Syndication Alert Bar*) aktif di seluruh varian wilayah.
- [x] Formulir pendaftaran anggota adaptif multi-tenant (`#regWilayah`) terhubung ke partisi wilayah.
- [x] Hub validasi publik terpadu (`#verifikasi`) untuk Surat Resmi, KTA Nasional Digital (5 tahun), dan Kwitansi Kas donatur berstandar UU PDP No. 27/2022.

### Fase 9: On-Demand Extension Modules (portal/portal.js)
- [ ] Sakelar toggle dan konfigurasi parameter 8 modul ekstensi (Muallaf CRM, Debat, Inventaris, Donatur, dll).

### Fase 10: Validasi, Quality Assurance & Kompilasi Akhir
- [ ] Menjalankan skrip validasi rute `validate-routes-whitelist.mjs`.
- [ ] Menjalankan smoke test backend, auth, dan portal.
- [ ] Kompilasi modul via `build-apps-script.ps1`.
- [ ] Verifikasi akhir di repositori GitHub.

---

## 3. Gerbang Persetujuan Eksekusi
Seluruh persiapan pembersihan repositori telah selesai. Kode aplikasi pada `gas/`, `apps-script/`, `portal/`, dan `public/` saat ini masih terjaga aman.
Ketik: **"OKE TERAPKAN"** untuk memulai eksekusi bedah Fase 0 dan Fase 1.
