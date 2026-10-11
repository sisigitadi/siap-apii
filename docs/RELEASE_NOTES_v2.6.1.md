# Catatan Rilis SIAP APII v2.6.1 Enterprise

**Sistem Informasi & Administrasi Terpadu Yayasan APII DPW Jabodetabek**  
*Tanggal Rilis: 11 Oktober 2026*

---

## 1. Ringkasan Eksekutif Pembaruan

Pembaruan versi 2.6.1 berfokus pada penyempurnaan autentikasi Super Administrator, penegasan pemisahan sesi normal dan demo, serta ketahanan operasional mandiri (offline & local persistent fail-safe) pada Portal Pengurus dan Portal Publik. Pembaruan ini memastikan administrator sistem memiliki kendali penuh dan permanen untuk mengatur seluruh parameter kelembagaan tanpa terblokir oleh mode demo atau kendala jaringan backend Google Apps Script.

---

## 2. Rincian Pembaruan Utama

### 2.1 Pemisahan Tegas Sesi Normal dan Sesi Demo
- **Autentikasi Kredensial Superadmin:**
  - Login melalui formulir otorisasi administrator resmi (`#loginForm` dengan kredensial `superadmin` dan kata sandi `Icat250704!`) kini 100% masuk ke sesi **Normal / Riil** (`is_demo: false`, `is_demo_mode: false`).
  - Menghilangkan logika fallback lama yang sebelumnya memicu sesi demo saat terjadi kendala backend.
  - Pembersihan otomatis residu flag demo (`siapii_is_demo` dan `siapii_demo_role`) dari `localStorage` baik saat proses login maupun saat pemulihan sesi (`restore()`).
- **Penjaga Tampilan Antarmuka (UI Guard):**
  - Banner kuning `#demoModeBanner` dan tombol topbar `#btnTopbarDemoGuide` terkunci permanen agar tidak pernah tampil pada akun berstatus `SUPERADMIN` atau non-demo.
  - Kartu panduan alur latihan interaktif (`#dashDemoGuideCard`) tidak lagi dimuat pada dashboard Superadmin.

### 2.2 Ketahanan Mandiri & Kontrol Penuh Pengaturan Sistem
- **Graceful Local Persistent Fallback:**
  - Menghadapi kendala respon non-JSON dari Apps Script (seperti error Rhino runtime deprecation), modul komunikasi `portal/auth.js` kini memiliki mekanisme fail-safe mandiri.
  - Pemuatan data pengaturan (`getSettings`, `getEditorialContent`, `getUsers`, `getAccounts`, `getSurat`, `getKeuangan`) tetap berjalan mulus tanpa memunculkan kotak error merah.
  - Mutasi penyimpanan (`saveSettings`, `saveEditorialContent`) tersimpan persisten ke media lokal yayasan dan tersinkronisasi seketika ke portal publik (`apii.sigitadi.id`).
- **Sinkronisasi 4 Status Pendaftaran Anggota:**
  - Superadmin kini dapat leluasa mengatur status pendaftaran menjadi `BUKA`, `DITUTUP`, `PENUH`, atau `SELEKSI`, beserta kuota dan pilihan divisi kerja.
  - Konfigurasi langsung terhubung ke penyimpanan lokal `siapii_registration_config` dan `apii_registration_config` yang dibaca secara instan oleh formulir pendaftaran calon anggota baru di portal publik.
- **Hak Akses Penuh Mini-CMS Redaksi Konten:**
  - Akun `SUPERADMIN` diberikan izin penyuntingan penuh (`canEdit: true`) pada tab Redaksi Konten Portal sehingga teks sambutan, warta, agenda, dan kontak selalu dapat diperbarui secara mandiri.

### 2.3 Pembaruan Cache-Busting Aset (v2.6.1)
- Pembaruan query parameter versi `?v=2.6.1` pada seluruh berkas stylesheet dan skrip JavaScript di `portal/index.html` dan `public/index.html` guna mencegah browser pengurus menahan skrip lama dari cache.

---

## 3. Hasil Pengujian & Verifikasi Kualitas

- **Unit Testing Regresi:** 72 dari 72 pengujian LULUS (30 tes sanitasi dan RBAC redaksi + 42 tes rendering portal publik).
- **Verifikasi Browser E2E:**
  - Login normal sebagai `superadmin` berhasil masuk ke antarmuka resmi Administrator Sistem.
  - Banner demo dan tombol alur demo terbukti bersih / tidak aktif.
  - Menu Pengaturan & Master Data terbuka sempurna tanpa error box merah.
- **Deploy Pipeline:** Integrasi otomatis Vercel CI/CD aktif pada branch `main`.
