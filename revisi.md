# CATATAN REVISI PARIPURNA: PENGATURAN SISTEM, IAM, DEADLOCK BREAKER SUPERADMIN & FORMAT TANGGAL DD-MM-YYYY (SIAP APII v3.0.0)
*Dikelola oleh RetroBOT by Sigit Adi (https://sigitadi.id | 0813-5857-5678)*
*Status: SELESAI DITERAPKAN & TERVERIFIKASI PENUH (11-11-2026)*

---

## 1. Ringkasan Eksekusi & Penyelarasan PRD / Panduan Eksekutif
Sesuai instruksi pengguna dan persetujuan **"OKE TERAPKAN"**, modul Pengaturan Sistem (Workspace 10: `#workspace-sistem`) dan standardisasi format penanggalan telah selesai dikerjakan secara tuntas:

1. **Standardisasi Format Waktu & Penanggalan (`dd-mm-yyyy` & `dd-mm-yyyy HH:mm:ss`)**:
   - Seluruh data seed, form input, tampilan tabel, watermark KTP, KTA digital CR80, dan stempel waktu audit logs telah diselaraskan ke standar baku Indonesia `dd-mm-yyyy` di seluruh layer: `portal/state.js`, `portal/app.js`, `public/app.js`, serta seluruh berkas `apps-script/*.gs`.
   - Menggunakan parser aman `parseDate()` dan `parseDateString_()` guna mencegah bug `NaN` pada runtime JavaScript V8.

2. **Hak Prerogatif Superadmin (Deadlock Breaker)**:
   - PRD Bab 2.3.1 & Panduan Eksekutif Bab 4.D.8: Mengambil alih pengesahan darurat bagi surat dinas keluar, kas keluar (BKK), lembar disposisi, dan KTA anggota yang mandek/terhambat.
   - Modal darurat `#modal-deadlock-breaker` dilengkapi validasi justifikasi darurat minimal 15 karakter, nomor SK referensi, dan persetujuan tanggung jawab hukum.
   - Seluruh eksekusi dicatat permanen dalam WORM Audit Trail dengan tag `SUPERADMIN_OVERRIDE`.

3. **Master Pengaturan Yayasan & KOP A4 (Live Sync + Diff Audit)**:
   - Form live sync untuk Ketua Umum, Sekretaris Jenderal, Bendahara Umum, KOP A4, nomor kontak, SK Kemenkumham, serta Cash Buffer limit (Rp 2.000.000).
   - Setiap modifikasi parameter dicatat riwayat nilai lama vs nilai baru ke `Sheet_Settings_Audit`.

4. **IAM & Manajemen Mandat Pengurus (8-Role RBAC)**:
   - Form CRUD `#modal-user-form` untuk seluruh pengurus.
   - Fitur toggle status **Demisioner / Nonaktif**: Seketika mencabut seluruh izin akses dan memutus otomatis seluruh sesi aktif di semua perangkat.
   - Reset sandi modal `#modal-reset-password` dengan pembuat kata sandi sementara dan template pesan resmi dinas WhatsApp.

5. **Monitoring Sesi Multi-Device (`Sheet_Sessions`)**:
   - Tabel pemantauan gawai aktif (Browser, OS, IP address, waktu login, masa berlaku).
   - Fitur `[Cabut Izin Sesi]` dan `[Cabut Semua Sesi Lain]`.

6. **Master Wilayah Federasi DPW**:
   - Modal registrasi DPW baru (`#modal-wilayah-form`) dengan live sync ke Tenant Switcher federasi.

7. **Zero Browser Alerts**:
   - Menghapus 100% pemanggilan `prompt()` atau `alert()` primitif browser, digantikan dengan modal dialog Tailwind CSS yang elegan, responsif, dan aksesibel.

8. **Kompilasi Backend Google Apps Script**:
   - Seluruh handler baru diintegrasikan di `apps-script/Setup.gs` dan router `apps-script/Code.gs`.
   - Terkompilasi sukses ke `build/dist_Code.gs` (3.194 baris, 121.39 KB).

---

## 2. Hasil Verifikasi Otomatis
- **Test Suite**: `scripts/test-superadmin-suite.mjs`
  - Test 1 (dd-mm-yyyy Date Validation): **PASS**
  - Test 2 (Deadlock Breaker Queue & Override Execution): **PASS**
  - Test 3 (Master Settings & Diff Audit): **PASS**
  - Test 4 (Sessions Monitoring & Revocation): **PASS**
  - Test 5 (IAM Demisioner Toggle & Session Revocation): **PASS**
  - Test 6 (Wilayah DPW Federasi Registration): **PASS**
- **Dev Server**: Berjalan stabil di `http://localhost:3000/portal/` dan `http://localhost:3000/public/`.

---

## 3. Revisi Tambahan: Penulisan Eksplisit Matriks 8-Role RBAC & 18 Roster Resmi
1. **Penulisan Matriks Hak Akses (PRD Bab 2.2)**:
   - Menambahkan 3 mode tampilan di Workspace 10 IAM: `Daftar 18 Akun Pengurus Resmi`, `Matriks Hak Akses 8 Peran RBAC`, dan `Pemisahan Tugas (Segregation of Duties / SoD)`.
   - Menuliskan secara komprehensif seluruh wewenang, batasan ketat, dan ruang kerja bagi 8 peran (`superadmin`, `ketua`, `sekretaris`, `bendahara`, `pembina`, `pengawas`, `ketua_divisi`, `anggota_divisi`).
2. **Penggenapan 18 Akun Pengurus Resmi**:
   - Menambahkan akun ke-18 `USR-018` (`anggota_jabo` / `Ust. Fajar Ramadhan, S.Sos.` - Da'i Lapangan DPW Jabodetabek).
3. **Penyelarasan Modal User Form (`#modal-user-form`)**:
   - Menyelaraskan opsi peran ke 8 role ID baku dan menambahkan selektor otomatis 7 Divisi Kerja Resmi ART Yayasan APII Pasal 16.

---

## 4. Revisi v3.1.0: Pemisahan Publik/Pengurus, Dual-Layer Maps, Login Demo123, Otorisasi Ketua, & Display Mode All-Device
*Status: SELESAI DITERAPKAN & TERVERIFIKASI PENUH (14-11-2026)*

1. **Pembersihan Website Publik dari Akses Portal Pengurus**:
   - Menghapus seluruh tautan, tombol, dan rujukan ke Portal Pengurus di seluruh halaman Website Publik (`/` dan `#/*`).
   - Portal Publik difokuskan 100% untuk layanan umat: profil kelembagaan, pendaftaran KTA gratis, transparansi donasi QRIS, warta maklumat, agenda dakwah, konsultasi akidah, advokasi LBH, dan Unified Verification Hub.

2. **Arsitektur Dual-Layer Geospatial Map Hub**:
   - Mengatasi isu tile Google Maps lambat/stuck pada muatan awal peramban dengan arsitektur **Dual-Layer Render**:
     - *Layer 0 (Underlay):* CARTO Voyager / Esri World Imagery + fallback OSM untuk render kilat (<150ms).
     - *Layer 1 (Overlay):* Google Maps Tile (`mt0..mt3.google.com/vt/lyrs=m|y`) yang di-fade-in otomatis saat tile siap.
   - Dilengkapi `ResizeObserver`, sinkronisasi viewport otomatis pada navigasi rute beranda, dan validasi koordinat aman (`lat !== 0 && lng !== 0`).

3. **Gerbang Login Pengurus Mandiri & Password Seragam "Demo123"**:
   - Halaman login mandiri `#portal-login-screen` di Portal Pengurus (`/portal/`).
   - Standarisasi kata sandi demo seluruh akun pengurus menjadi `"Demo123"` dengan tombol pemilih cepat (quick selector).
   - Fitur toggle sembunyikan/tampilkan kata sandi.
   - Tombol pergantian akun langsung digantikan dengan tombol **Keluar (Logout)** resmi yang membersihkan sesi dan kembali ke layar login tanpa residu.
   - Pergantian akun pengurus via login langsung memperbarui seluruh hak akses, workspace, dan state tanpa jeda/reload.

4. **Penyederhanaan Fitur & Otorisasi Eksekutif Ketua**:
   - Peran `ketua` (`Ketua Umum (DPP) / Ketua DPW`) disederhanakan murni untuk pengawasan eksekutif & otorisasi tingkat akhir.
   - Hak akses workspace dibatasi strictly ke **6 workspace**: `dashboard`, `surat`, `disposisi`, `kas`, `proker`, `keanggotaan`.
   - Modul operasional divisi teknis (`advokasi`, `muallaf`, `maktabah`, `sistem`) disembunyikan dari Ketua.
   - Form pembuatan surat milik Sekretaris `#surat-composer-panel` disembunyikan untuk Ketua, panel pratinjau diperlebar (`lg:col-span-12`), dan judul berganti menjadi **Pengesahan Surat Dinas Resmi (Ketua)** lengkap dengan banner instruksi otorisasi eksekutif.
   - Tombol aksi utama Dashboard disesuaikan menjadi **Pengesahan Surat** dan **Otorisasi Kas Tahap 2**.

5. **Audit & Optimasi Display Mode All-Device (13 Viewport)**:
   - Pengujian live otomatis via Headless Chrome CDP melintasi 13 variasi layar (320px, 360px, 390px, 430px, 844px landscape, 600px, 768px, 820px, 1024px landscape, 1280px, 1366px, 1920px, 2560px) mencakup seluruh 8 rute publik dan 10 workspace portal (247 kombinasi).
   - **Zero Horizontal Overflow:** `H_OVERFLOW_PAGES = 0` (seluruh overflow horizontal pada mobile tereliminasi).
   - **Dynamic Viewport & Safe-Area Insets:** Menggunakan `100dvh` dan `env(safe-area-inset-*)` untuk kenyamanan perangkat berlekuk (notch) atau bilah navigasi gestur.
   - **Standarisasi Touch Target 44×44px:** Seluruh tombol navigasi, select, link footer, form checkbox/radio, dan pin peta memenuhi standar ergonomi sentuh mobile/tablet.
   - **Reflow Responsif 3-State:** Grid ringkasan dashboard, hero CTA, dan topbar drawer bertransisi mulus dari layar ponsel terkecil hingga monitor ultrawide.

