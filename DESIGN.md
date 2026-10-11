# DESIGN.md — Yayasan APII DPW Jabodetabek

Panduan identitas visual, tema, dan sistem desain untuk Portal Publik (`apii.sigitadi.id`) dan Portal Pengurus (`siapii.sigitadi.id`).

---

## 1. Identitas & Karakter Lembaga

- **Nama Lembaga:** Yayasan APII (Apologet Islam Indonesia) DPW Jabodetabek
- **Bidang Gerak:** Sosial, Kemasyarakatan, dan Keagamaan
- **Visi Utama:** Mengimplementasikan Islam sebagai Agama Rahmatan Lil Alamin
- **Misi:**
  1. Transfer Ilmu Pengetahuan bagi sesama umat.
  2. Mengoptimalkan digital dan internet sebagai sarana Dakwah.
  3. Dialog perbandingan agama secara online maupun offline.
  4. Bersinergi dengan Individu, Organisasi Islam, dan Instansi Pemerintah/Swasta guna mengukuhkan Ukhuwah Islamiah.
- **Karakter Desain:** Bersahaja, berwibawa, teduh, terpercaya, dan tertata rapi. Mencerminkan nilai keislaman yang moderat, inklusif, dan menjunjung tinggi ukhuwah serta akuntabilitas publik.

---

## 2. Antislop Dials

| Parameter | Level | Keterangan |
| :--- | :---: | :--- |
| **ENERGY** | **1 (Calm)** | Lembaga publik resmi dan terpercaya. Tidak ada efek neon, tidak ada partikel melayang acak, dan tidak ada elemen berlebihan. |
| **RHYTHM** | **2 (Balanced)** | Komposisi konten harmonis, struktur seksi bervariasi dengan alur bernalar (profil, program dakwah, transparansi, kontak). |
| **MOTION** | **1 (Subtle)** | Transisi halus pada interaksi tombol, alih tema, pembukaan menu, dan dialog modal. Tanpa loop animasi berulang yang mengganggu. |

---

## 3. Palet Warna (Color System)

Palet warna dibatasi pada 2 warna inti (Emerald Keislaman dan Slate Netral) ditambah 1 aksen emas (Gold Pencerahan), memenuhi aturan R-29 (maksimal 2-3 warna inti + 1 aksen).

### 3.1 Tema Terang (Light Mode)
- **Latar Belakang Utama:** `#F8FAF8` (Off-white bernuansa sejuk, bersih dan terhormat)
- **Permukaan Kartu / Kontainer:** `#FFFFFF` (Putih murni dengan garis batas tegas, bukan pastel)
- **Warna Inti (Emerald Keislaman):**
  - Emerald Utama: `#047857`
  - Emerald Gelap (Teks Judul / Header): `#022C22`
  - Emerald Aksen (Bukan pastel): `rgba(4, 120, 87, 0.08)`
- **Warna Aksen (Emas / Royal Gold):**
  - Gold Utama: `#D97706` / `#F59E0B`
  - Gold Terang: `#FBBF24`
- **Teks Netral:**
  - Teks Utama: `#0F172A` (Slate 900)
  - Teks Sekunder: `#334155` (Slate 700)
  - Teks Redup: `#475569` (Slate 600, kontras tinggi)
- **Garis Batas (Border):** `#E2E8F0` / `rgba(4, 120, 87, 0.2)`
- **Motif Latar Belakang:** Geometris Islam bintang 8 sudut (*Rub el Hizb*) halus dengan opasitas 3-5%.

### 3.2 Tema Gelap (Dark Mode — Executive Islamic Midnight)
- **Latar Belakang Dasar (Ground):** `#060D0A` (Deepest Islamic Obsidian Green, solid dan berwibawa)
- **Permukaan Kartu (Card Surface):** `#0C1A14` (Solid dark emerald surface, kontras tinggi)
- **Permukaan Mengambang / Modal / Menu:** `#12241C` (Elevated dark emerald)
- **Permukaan Inset / Form Input:** `#08130F`
- **Warna Inti (Emerald Cerah Adaptif):**
  - Emerald Teks / Aksen: `#10B981` / `#34D399` / `#6EE7B7`
  - Emerald Latar Tertekan: `rgba(4, 120, 87, 0.2)`
- **Warna Aksen (Emas Hangat):**
  - Gold Teks / Tombol: `#F59E0B` / `#FCD34D`
  - Gold Glow / Border Aksen: `rgba(245, 158, 11, 0.35)`
- **Teks Netral (Kontras Tinggi Tanpa Tabrakan):**
  - Teks Utama (Headings): `#FFFFFF` / `#F8FAFC`
  - Teks Isi (Body): `#E2E8F0` / `#CBD5E1`
  - Teks Redup (Muted/Meta): `#94A3B8` (tetap memenuhi WCAG AA 4.5:1)
  - Kontras Tombol Emas: Teks di atas tombol emas selalu menggunakan `#022C22` (hitam-hijau pekat), tidak pernah hijau muda!
- **Garis Batas (Border):** `#1E3D30` (tegas, rapi, membingkai elemen secara presisi)
- **Pemberantasan Warna Pastel:** Tidak menggunakan chip/latar pastel pucat (`bg-emerald-50`, `bg-amber-100`, `bg-purple-50`). Semua badge dan kotak informasi menggunakan palet *executive jewel* transparan dengan batas bercahaya halus.
- **Motif Latar Belakang:** Geometris Islam bintang 8 sudut (*Rub el Hizb*) berulang dengan opasitas 6-8% sebagai ornamen arsitektural yang elegan.

---

## 4. Tipografi

- **Font Keluarga:** `'Plus Jakarta Sans', sans-serif`
- **Alasan Pemilihan:** Tipografi modern karya desainer Indonesia yang sangat ergonomis untuk bahasa Indonesia, memiliki kejelasan tinggi pada angka kas, surat dinas resmi, dan dokumen keagamaan.
- **Skala Ukuran:**
  - H1 Hero: `2.25rem - 3.75rem` (36px - 60px), bobot 800
  - H2 Seksi: `1.875rem - 2.25rem` (30px - 36px), bobot 800
  - H3 Kartu / Sub-seksi: `1.125rem - 1.25rem` (18px - 20px), bobot 700
  - Teks Isi: `0.875rem - 1rem` (14px - 16px), bobot 400/500, tinggi baris 1.6
  - Keterangan & Badge: `0.75rem - 0.8125rem` (12px - 13px), bobot 600/700

---

## 5. Tombol Pengalih Tema (Theme Toggle)

- Disediakan tombol pengalih tema terang/gelap pada header Portal Publik dan topbar Portal Pengurus.
- Disertai ikon Matahari (mode terang) dan Bulan (mode gelap).
- Menyimpan preferensi pengguna di `localStorage` (`apii_theme` untuk publik, `siapii_theme` untuk pengurus).
- Mendeteksi preferensi sistem `prefers-color-scheme` secara otomatis jika pengguna belum memilih secara manual.
- Mengubah kelas `dark` pada elemen `<html>`.

---

## 6. Kaidah Kualitas & Kepatuhan Antislop

1. **R-02 (Bahasa Manusiawi & Bebas Em Dash):** Seluruh salinan teks bebas dari karakter em dash (`—`). Digunakan koma, titik, titik dua, atau kurung buka-tutup.
2. **R-03 (Responsivitas Mobile):** Target ketukan minimal 44px, navigasi ringkas, dan tanpa luapan horizontal (*zero overflow*).
3. **R-21 & R-34 (Dual Theme Berfungsi Penuh):** Kedua mode (terang dan gelap) memiliki kontras teks di atas 4.5:1 (WCAG AA) dan seluruh komponen terlihat jelas.
4. **R-26 & R-32 (Aksesibilitas & Kontrol Nyata):** Setiap tombol memiliki aksi nyata, dapat dinavigasi dengan keyboard (Tab, Enter, Space), dan modal dapat ditutup dengan tombol Escape.
5. **R-38 (Konten Otentik):** Menampilkan visi dan misi resmi Yayasan APII secara nyata tanpa teks tiruan (*filler slop*).
