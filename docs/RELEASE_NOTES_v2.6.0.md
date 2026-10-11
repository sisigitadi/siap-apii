# Catatan Rilis SIAP APII v2.6.0 Enterprise

**Sistem Informasi & Administrasi Terpadu Yayasan APII DPW Jabodetabek**  
*Tanggal Rilis: 11 Oktober 2026*

---

## 1. Ringkasan Eksekutif Pembaruan

Pembaruan versi 2.6.0 merupakan rilis besar yang memfokuskan pada pembenahan menyeluruh identitas visual, perbaikan aksesibilitas kontras tinggi (WCAG AA), responsivitas tampilan perangkat bergerak (mobile), pemberantasan elemen AI slop (seluruh emoji digantikan dengan ikon SVG monokrom resmi), serta penyelarasan visi, misi, dan pimpinan lembaga Yayasan APII DPW Jabodetabek.

---

## 2. Rincian Pembaruan Utama

### 2.1 Penyelarasan Visi, Misi, dan Kepengurusan Resmi
- **Nama Pimpinan:** Diperbarui secara konsisten menjadi **Ustadz Muhammad Hanafi** (Ketua DPW APII Jabodetabek) baik pada Portal Publik maupun Portal Pengurus.
- **Visi Kelembagaan:** Mengimplementasikan Islam sebagai Agama Rahmatan Lil Alamin.
- **Misi 4 Pilar:**
  1. Transfer Ilmu Pengetahuan bagi sesama umat.
  2. Mengoptimalkan digital dan internet sebagai sarana Dakwah.
  3. Dialog perbandingan agama secara online maupun offline.
  4. Bersinergi dengan Individu, Organisasi Islam, dan Instansi Pemerintah/Swasta guna mengukuhkan Ukhuwah Islamiah.

### 2.2 Sistem Desain "Amanah Modern Enterprise" (Tema Terang & Gelap)
- **Penghapusan Palet Pastel:** Menghapus seluruh warna pastel generik yang menyerupai template AI. Digantikan oleh palet kelembagaan Islam yang bermartabat:
  - **Emerald Keislaman Utama:** `#047857` (Emerald 700), `#064E3B` (Emerald 900), dan `#022C22` (Emerald 950).
  - **Aksen Emas Pencerahan:** `#F59E0B` (Amber 500) dan `#D97706` (Amber 600).
  - **Latar Belakang Arsitektural:** Ornamen geometris Islam 8 sudut (Rub el Hizb) yang halus dan anggun.
- **Pengalih Tema (Dual-Theme Toggle):**
  - Tersedia tombol pengalih tema terang dan gelap di header Portal Publik serta topbar Portal Pengurus.
  - Status tema tersimpan otomatis di `localStorage` (`apii_theme` dan `siapii_theme`) dengan deteksi awal `prefers-color-scheme`.
- **Audit Kontras Tinggi WCAG AA (> 4.5:1):**
  - Mengatasi seluruh masalah teks tidak terbaca akibat warna teks mirip dengan latar belakang.
  - Modal Panduan Alur Demo di tema gelap kini memiliki latar belakang pekat (`#0C1A14` dan `#231B0D`) dengan teks kontras tinggi (`#6EE7B7` dan `#FCD34D`).
  - Badge status warta, agenda, kas, dan surat dinas disesuaikan agar selalu terbaca tajam di kedua mode.
  - Tombol aksi pada tabel (Lihat, Verifikasi, Sahkan, Tolak) memiliki latar dan teks kontras tinggi.

### 2.3 Optimalisasi Tata Letak Mobile (Viewport Handphone <= 640px)
- **Tombol Aksi Tabel Grid 2x2:**
  - Sebelumnya tombol aksi tabel berhimpitan dan terpotong saat dibuka di layar handphone.
  - Kini ditata rapi dalam grid 2 kolom (`grid-template-columns: repeat(2, minmax(0, 1fr))`) dengan target sentuh lega (tinggi tombol minimal 38px sampai 44px).
- **Banner Mode Demo Responsif:**
  - Komponen `#demoModeBanner` otomatis beralih menjadi tata letak bertingkat (`flex-col sm:flex-row`) pada layar sempit sehingga teks panduan dan tombol tidak lagi bertabrakan.
  - Tombol bantuan topbar yang redundant disembunyikan di layar ponsel untuk memberi ruang pada navigasi inti.
- **Zero Horizontal Overflow:** Seluruh kontainer memiliki proteksi `max-w-full overflow-hidden` sehingga tidak ada pergeseran layar ke samping.

### 2.4 Pemberantasan AI Slop dan Standardisasi Ikon SVG
- Seluruh emoji dan karakter glif template (216+ kemunculan) telah diganti menjadi ikon inline SVG monokrom profesional dengan ketebalan garis standar 1.8px.
- Ikon mencakup: navigasi, status surat, status kas, aksi persetujuan, indikator demo, kontak, serta tombol filter.

### 2.5 Efek Visual Proporsional dan Mikro-Animasi Taktil
- **Transisi Antar Halaman:** Animasi masuk halus `.page-enter` (durasi 0.22 detik dengan kurva cubic-bezier) yang memberikan kesan modern tanpa memperlambat interaksi.
- **Umpan Balik Sentuhan Taktil:** Efek tekan `:active { transform: scale(0.98); }` pada seluruh tombol aksi untuk kenyamanan navigasi pengguna.

### 2.6 Penyeragaman Kredit Footer Resmi
- Seluruh footer aplikasi kini menyematkan kredit institusional terpadu:
  `Yayasan APII DPW Jabodetabek (c) 2026 * Dikembangkan oleh sigitadi.id`
- Kredit diterapkan pada layar login, bagian bawah bilah sisi (sidebar), footer modul pengurus, dan footer portal publik.

---

## 3. Hasil Pengujian Otomatis

Seluruh rangkaian pengujian regresi dan rendering lulus 100%:
- `node scripts/test-editorial.mjs`: 30 dari 30 pengujian LULUS (Sanitasi XSS, normalisasi domain, RBAC redaksi, simpan dan muat data).
- `node scripts/test-public-render.mjs`: 42 dari 42 pengujian LULUS (Render hero, profil, warta, agenda, tab switching, akordion FAQ, kontak, sanitasi anti-XSS).
- **Total Pengujian:** 72 LULUS, 0 GAGAL.

---

## 4. Panduan Deployment

### 4.1 Deployment Frontend (Vercel CI/CD)
1. Perubahan kode didorong ke repositori GitHub:
   ```bash
   git add .
   git commit -m "feat(ui): revisi komprehensif tema gelap terang, responsivitas mobile, pembersihan ai-slop svg, dan footer sigitadi.id"
   git push origin main
   ```
2. Vercel secara otomatis mendeteksi perubahan pada branch `main` dan memperbarui:
   - Portal Pengurus: `https://siapii.sigitadi.id`
   - Portal Publik: `https://apii.sigitadi.id`

### 4.2 Deployment Backend (Google Apps Script)
1. Kompilasi bundle lokal:
   ```powershell
   npm run build:gas
   ```
2. Berkas bundle siap-unggah di folder `apps-script/`:
   - `apps-script/Backend.gs` (178.134 karakter, 0 namespace tertinggal)
   - `apps-script/AsetLogo.gs` (31.998 karakter)
   - `apps-script/AsetStempel.gs` (53.446 karakter)
3. Buka editor di [script.google.com](https://script.google.com), salin isi berkas di atas ke masing-masing file proyek.
4. Buat New Version pada menu **Deploy -> Manage deployments -> Edit -> New version**.
