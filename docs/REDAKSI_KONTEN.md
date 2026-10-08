# Spesifikasi Teknis: Redaksi Konten Dinamis Portal Publik (Mini-CMS)

Dokumen ini adalah **sumber acuan tunggal (*single source of truth*)** bagi arsitektur dan implementasi konten pada **Portal Publik SIAP-APII (`apii.sigitadi.id`)** dan modul pengelolaannya di **Portal Pengurus (`siapii.sigitadi.id`)**.

---

## 1. Filosofi & Pemisahan Konten

Portal Publik membagi konten ke dalam dua jenis secara tegas:

| Jenis Konten | Metode Pembuatan | Lingkup Komponen | Alasan Arsitektural |
|---|---|---|---|
| **KONTEN STATIS** | Hardcoded via Koding (HTML5/CSS/JS) | • Kerangka tata letak semantik (`<header>`, `<main>`, `<section>`, `<footer>`)<br>• Desain token Tailwind (Emerald `#047857`, Gold `#F59E0B`, Dark `#022C22`)<br>• Mesin KTP Canvas Watermark UU PDP No. 27/2022<br>• Verifikasi kriptografi SHA-256 hash surat digital<br>• Komponen UI dasar (modal dialog, toast notification, skeleton loader) | Menjamin kecepatan pemuatan instan (0ms render), stabilitas visual, kepatuhan hukum privasi (UU PDP), dan keandalan sistem tanpa risiko salah format oleh staf redaksi. |
| **KONTEN DINAMIS** | Pengaturan Redaksi Konten (Mini-CMS di Portal Pengurus) | • **Hero & Tagline:** Headline H1, Subheadline, Teks CTA, Link CTA<br>• **Profil Lembaga:** Sambutan Ketua DPW, Visi, Poin Misi (Toggle ON/OFF)<br>• **Maklumat & Siaran Resmi:** Judul, Kategori, Tanggal, Ringkasan, Link Dokumen<br>• **Agenda & Acara:** Nama Acara, Kategori, Tanggal/Jam, Tempat/Zoom, Pembicara, Link Pendaftaran, Status Mendatang/Selesai<br>• **Tanya Jawab (FAQ):** Daftar Q&A akordeon interaktif (Toggle ON/OFF)<br>• **Kontak & Sosmed:** Alamat sekretariat, jam kerja, email resmi, no WhatsApp helpdesk, tautan YouTube, Instagram, WhatsApp Channel, Facebook, TikTok | Memberikan keleluasaan penuh bagi pengurus (Ketum, Sekum, Humas, Media) untuk merilis warta, mengubah kontak, atau menerbitkan agenda baru seketika tanpa perlu koding atau *redeploy*. |

---

## 2. Alur Halaman Portal Publik (`public/index.html`)

Sistem mengusung konsep **Single Page Application (SPA) Landing Page** terpadu:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. NAVBAR (Brand Logo, Menu Navigasi Smooth-Scroll, Tombol Daftar)     │
├────────────────────────────────────────────────────────────────────────┤
│ 2. BANNER PENGUMUMAN URGEN (Announcement Alert Bar)                   │
├────────────────────────────────────────────────────────────────────────┤
│ 3. HERO SECTION (#beranda)                                             │
│    • Badge Tahun, Headline H1, Subheadline, Tombol CTA Utama           │
│    • Kartu Samping: Kepatuhan UU PDP & 3 Pilar Keunggulan              │
├────────────────────────────────────────────────────────────────────────┤
│ 4. PROFIL LEMBAGA (#profil) [Toggle ON/OFF]                            │
│    • Sambutan Resmi Ketua DPW                                          │
│    • Visi & Poin Misi APII Jabodetabek                                │
├────────────────────────────────────────────────────────────────────────┤
│ 5. WARTA MAKLUMAT & AGENDA ACARA (#warta) [Toggle ON/OFF]              │
│    • Tab Switcher: [📌 Maklumat & Siaran]  |  [📅 Agenda & Acara]      │
│    • Grid Card Interaktif (Maks 6 item default + tombol ekspansi)      │
│    • Tombol Link Unduh Dokumen PDF & Link Pendaftaran Acara            │
├────────────────────────────────────────────────────────────────────────┤
│ 6. TRANSPARANSI DOKUMEN & KEUANGAN (#informasi)                       │
│    • Arsip Surat Keputusan/Edaran Sah (Dinamis dari modul Surat)       │
│    • Rekening Kas Resmi Yayasan (Dinamis dari master rekening)        │
├────────────────────────────────────────────────────────────────────────┤
│ 7. TANYA JAWAB / FAQ (#faq) [Toggle ON/OFF]                            │
│    • Akordeon Interaktif Buka/Tutup Pertanyaan                         │
├────────────────────────────────────────────────────────────────────────┤
│ 8. KONTAK & SALURAN RESMI (#kontak)                                    │
│    • Alamat Lengkap Sekretariat, Email, Jam Layanan, No WhatsApp       │
│    • Tautan Ikon Media Sosial (YouTube, IG, WA Channel, dll.)          │
├────────────────────────────────────────────────────────────────────────┤
│ 9. FOOTER (Hak Cipta, 5 Wilayah Layanan, & Tautan Navigasi Bawah)      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Skema Data Backend (`Sheet_Settings` $\to$ Key: `'editorial_content'`)

Disimpan sebagai nilai string JSON di baris `'editorial_content'` tabel `Sheet_Settings`:

```json
{
  "hero": {
    "badge": "Penerimaan Anggota Baru 2026",
    "headline": "Keanggotaan & Kolaborasi Yayasan APII DPW Jabodetabek",
    "subheadline": "Wadah sinergi para ahli, akademisi, dan praktisi pengkaji Islam di Indonesia untuk riset, pemberdayaan, dan kemaslahatan umat.",
    "cta_text": "Info Dokumen & Keuangan Kas →",
    "cta_link": "#informasi"
  },
  "profile": {
    "show_section": true,
    "ketua_name": "Ust. Sigit Adi, S.T., M.Kom.",
    "ketua_title": "Ketua DPW APII Jabodetabek",
    "greeting": "Assalamu'alaikum Warahmatullahi Wabarakatuh. Selamat datang di portal resmi Dewan Pimpinan Wilayah Yayasan Apologet Islam Indonesia (APII) Jabodetabek. Melalui sistem terpadu ini, kami berkomitmen menghadirkan transparansi penuh, kemudahan pendaftaran anggota, dan akuntabilitas publik bagi kemaslahatan umat.",
    "vision": "Menjadi pusat pengkajian, literasi, dan advokasi Islam yang unggul, terpercaya, dan berakhlakul karimah.",
    "missions": [
      "Mengembangkan riset komparatif dan dakwah transformatif di wilayah Jabodetabek.",
      "Membangun jejaring keilmuan antar cendekiawan, praktisi, dan ormas Islam.",
      "Menegakkan transparansi kelembagaan dan akuntabilitas umat."
    ]
  },
  "bulletins_events": {
    "show_section": true,
    "section_title": "Warta Kelembagaan & Agenda Kegiatan",
    "section_subtitle": "Maklumat resmi, siaran pers pimpinan, serta jadwal acara dan kajian DPW APII Jabodetabek.",
    "bulletins": [
      {
        "id": "mak-1",
        "title": "Maklumat Dewan Pimpinan Wilayah tentang Pelaksanaan Dakwah Ramadhan 1447 H",
        "category": "Maklumat Resmi",
        "date": "2026-03-01",
        "summary": "Instruksi kepada seluruh jajaran pengurus divisi dan anggota mengenai pedoman dakwah digital dan safari keumatan di 5 wilayah Jabodetabek.",
        "link": ""
      }
    ],
    "events": [
      {
        "id": "evt-1",
        "title": "Seminar Nasional Litbang: Metodologi Komparasi Agama Kontemporer",
        "category": "Kajian Ilmiah",
        "date_str": "Sabtu, 25 April 2026",
        "time_str": "09.00 – 12.00 WIB",
        "location": "Aula Pusat Dakwah APII & Live Zoom",
        "speaker": "Dewan Pakar APII & Akademisi Tamu",
        "link": "https://forms.gle/apii-seminar-2026",
        "status": "MENDATANG"
      }
    ]
  },
  "contact": {
    "address": "Jl. Kramat Raya No. 45, Senen, Jakarta Pusat 10450",
    "email": "sekretariat@apii.sigitadi.id",
    "whatsapp_helpdesk": "081288882026",
    "service_hours": "Senin – Sabtu, 08.30 – 16.30 WIB"
  },
  "social": {
    "youtube": "https://youtube.com/@apii_official",
    "instagram": "https://instagram.com/apii_jabodetabek",
    "whatsapp_channel": "https://whatsapp.com/channel/apii-jabo",
    "facebook": "",
    "tiktok": ""
  },
  "faqs": [
    {
      "q": "Siapa yang dapat mendaftar sebagai anggota APII DPW Jabodetabek?",
      "a": "Warga negara Indonesia beragama Islam yang berdomisili atau beraktivitas di wilayah Jakarta, Bogor, Depok, Tangerang, dan Bekasi, serta bersedia mematuhi AD/ART yayasan."
    },
    {
      "q": "Apakah pendaftaran anggota dipungut biaya?",
      "a": "Tidak ada biaya pendaftaran. Keanggotaan terbuka dan bebas biaya administrasi registrasi."
    },
    {
      "q": "Bagaimana perlindungan data pribadi saya dijamin?",
      "a": "KTP yang diunggah otomatis dibubuhi cap digital pelindung langsung di peramban Anda sebelum dikirim ke server sesuai amanat UU Perlindungan Data Pribadi No. 27/2022."
    }
  ]
}
```

---

## 4. Hak Akses (RBAC) & Endpoint

| Endpoint | Method | Akses | Keterangan |
|---|---|---|---|
| `getPublicSettings` | GET | Publik (Bebas) | Mengembalikan `{ config, registration, editorial, kop }`. Mengalirkan data `editorial_content` ke portal publik. |
| `getSettings` | GET | Pengurus Terotorisasi | Mengembalikan konfigurasi lengkap termasuk `editorial_content` untuk diedit di panel redaksi. |
| `saveSettings` | POST | `SUPERADMIN`, `KETUA`, `SEKRETARIS`, `DIV_HUMAS`, `DIV_SOSMED` | Menyimpan perubahan `editorial_content` ke `Sheet_Settings` dan menginvalidasi cache. |

---

## 5. UI/UX Portal Pengurus (`portal/portal.js`)

Menu **Pengaturan** memiliki sub-tab ke-7: **`📰 Redaksi Konten Portal`**.

### Formulir Terstruktur:
1. **Kartu 1: Hero & Tagline Beranda**
   - Input: Badge, Headline H1, Subheadline, Teks CTA, Link CTA.
2. **Kartu 2: Profil Lembaga & Sambutan Pimpinan**
   - Toggle: `Tampilkan Seksi Profil (ON/OFF)`.
   - Input: Nama Ketua, Jabatan, Sambutan Resmi (multi-line textarea), Visi Lembaga, Poin Misi (textarea per baris).
3. **Kartu 3: Kelola Maklumat & Siaran Resmi**
   - Toggle: `Tampilkan Seksi Warta & Acara (ON/OFF)`.
   - Input: Judul Seksi & Subjudul Seksi.
   - List Builder: Tombol `➕ Tambah Maklumat`, Form baris (Judul, Kategori, Tanggal, Ringkasan, Link Dokumen), Tombol Hapus per baris.
4. **Kartu 4: Kelola Agenda & Acara Kegiatan**
   - List Builder: Tombol `➕ Tambah Acara`, Form baris (Nama Acara, Kategori, Tanggal & Waktu, Tempat/Platform, Narasumber, Link Pendaftaran, Status: *Mendatang* / *Selesai*), Tombol Hapus per baris.
5. **Kartu 5: Kontak Pelayanan & Media Sosial**
   - Input: Alamat Lengkap, Jam Kerja, Email Resmi, No WhatsApp Helpdesk.
   - Input Media Sosial: URL YouTube, Instagram, WhatsApp Channel, Facebook, TikTok.
6. **Kartu 6: Tanya Jawab Publik (FAQ)**
   - Toggle: `Tampilkan Seksi FAQ (ON/OFF)`.
   - List Builder: Tombol `➕ Tambah Tanya Jawab`, Input Pertanyaan & Jawaban, Tombol Hapus.
7. **Tombol Simpan Terpadu:**
   - Tombol `💾 Simpan Seluruh Perubahan Redaksi` dengan feedback loading instan dan toast sukses.

---

## 6. Prosedur Uji & Validasi Kode

Setiap perubahan wajib melalui serangkaian verifikasi:
```powershell
# 1. Kompilasi bundle Google Apps Script
powershell -ExecutionPolicy Bypass -File .\scripts\build-apps-script.ps1

# 2. Validasi sintaks JS Apps Script
node scripts/validate-apps-script.mjs

# 3. Uji smoke backend
node scripts/smoke-backend.mjs

# 4. Validasi sintaks JS Frontend
node -c portal/portal.js
node -c portal/auth.js
node -c public/app.js
```
Semua uji harus berstatus **LULUS (0 GAGAL)** sebelum perubahan di-deploy ke produksi.
