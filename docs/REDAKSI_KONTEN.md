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
  ],
  "faqs_show": true
}
```

> **Catatan skema:** `faqs` tetap berupa array sesuai spesifikasi, sedangkan sakelar visibilitas seksi FAQ disimpan sebagai field saudara `faqs_show` (mengikuti pola `show_section` pada `profile` & `bulletins_events`). Nilai bawaan `true`.
>
> **Perilaku field kosong (graceful fallback):** field teks yang dikosongkan redaksi disimpan apa adanya; portal publik otomatis menampilkan teks bawaan yang tertanam di `public/index.html` sehingga halaman tetap rapi. Sebaliknya, menghapus seluruh baris maklumat/acara/FAQ dihormati (daftar kosong tetap kosong, kecuali poin misi yang kembali ke bawaan agar seksi visi-misi tidak rusak).

---

## 4. Hak Akses (RBAC) & Endpoint

| Endpoint | Method | Akses | Keterangan |
|---|---|---|---|
| `getPublicSettings` | GET | Publik (Bebas) | Mengembalikan `{ config, registration, editorial, kop }`. Mengalirkan data `editorial_content` ke portal publik. |
| `getSettings` | GET | Pengurus Terotorisasi | Mengembalikan konfigurasi lengkap termasuk `editorial_content` untuk diedit di panel redaksi. |
| `saveSettings` | POST | `SUPERADMIN`, `KETUA` | Menyimpan perubahan `editorial_content` ke `Sheet_Settings` dan menginvalidasi cache. Payload: `{ editorial_content: { ... } }`. Setiap penyimpanan mengarsipkan versi sebelumnya ke riwayat versi. |
| `getEditorialHistory` | GET | `SUPERADMIN`, `KETUA` | Daftar **metadata** versi (id, waktu, pelaku, jenis aksi, ringkasan perubahan, ukuran) tanpa isi konten, agar payload tetap ringan. Maksimum `EDITORIAL_HISTORY_MAX` (15) item terbaru. |
| `getEditorialRevision` | GET | `SUPERADMIN`, `KETUA` | Isi lengkap satu versi untuk pratinjau sebelum dipulihkan. Parameter: `id`. |
| `restoreEditorialRevision` | POST | `SUPERADMIN`, `KETUA` | Memulihkan konten aktif ke versi lama. Parameter: `id`. Konten yang sedang aktif diarsipkan lebih dahulu sehingga pemulihan dapat dibatalkan. |
| `exportEditorialContent` | GET | `SUPERADMIN`, `KETUA` | Mengembalikan berkas cadangan `{ filename, json, bytes, format, exported_at, counts }`. Berkas berisi penanda format `apii-editorial-v1`, waktu, pelaku, asal lingkungan, dan seluruh konten ternormalisasi. Setiap ekspor dicatat di jejak audit (`EDITORIAL_EXPORTED`). |
| `importEditorialContent` | POST | `SUPERADMIN`, `KETUA` | Mengimpor konten dari berkas JSON (`{ json: '<isi berkas>' }`). Berkas divalidasi lebih dahulu; konten aktif diarsipkan sebelum ditimpa sehingga impor selalu dapat dibatalkan. Balasan memuat `changed`, `source`, `history`, `warnings`, dan `counts`. Dicatat sebagai `EDITORIAL_IMPORTED`. |

> **Catatan RBAC:** `saveSettings` mengikuti matriks RBAC resmi (`docs/rbac-matrix.md`) & matriks di portal: menu **Pengaturan** hanya tersedia untuk **SUPERADMIN** dan **KETUA**. Sebelumnya route ini hanya mengizinkan `SUPERADMIN` sehingga peran `KETUA` dapat membuka menu Pengaturan namun gagal menyimpan — kini diselaraskan. Peran `SEKRETARIS`, `DIV_HUMAS`, dan `DIV_SOSMED` **tidak** ada pada sistem RBAC 8 peran saat ini (peran divisi direpresentasikan sebagai `KETUA_DIVISI` / `ANGGOTA_DIVISI` dengan field `division`), sehingga tidak diberikan akses tulis pengaturan pada rilis ini.

**Normalisasi server-side** (`Utils.normalizeEditorialContent_`) dijalankan otomatis sebelum penyimpanan maupun sebelum pengiriman ke publik:
- semua teks di-trim dan dibatasi panjangnya;
- `show_section` / `faqs_show` dikoersi menjadi boolean sejati (menerima `true/false`, `'TRUE'/'FALSE'`, `1/0`, `on/off`);
- `status` acara dinormalkan ke `MENDATANG` atau `SELESAI`; kategori kosong kembali ke pilihan standar;
- tautan hanya diizinkan untuk skema `http(s)`, `mailto:`, `tel:`, anchor (`#...`), atau path relatif — skema berbahaya (`javascript:`, `data:`) dibuang;
- item tanpa judul/pertanyaan+jawaban dibuang, dan jumlah item dibatasi (misi 20, maklumat 60, acara 60, FAQ 60).

---

## 5. UI/UX Portal Pengurus (`portal/portal.js`)

Menu **Pengaturan** memiliki sub-tab **`📰 Redaksi Konten Portal`** (berada setelah tab 💰 Keuangan, sebelum 🛡️ RBAC & Publik).

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
7. **Kartu 7: Riwayat Versi & Pemulihan**
   - Menampilkan daftar versi terbaru (waktu, pelaku, jenis aksi `PENYIMPANAN`/`PEMULIHAN`, ringkasan bagian yang berubah, ukuran).
   - Tombol `👁 Pratinjau` membuka modal ringkasan versi (hero, jumlah maklumat/agenda/FAQ, email kontak) beserta JSON lengkap; tombol `↩ Pulihkan` memulihkan versi tersebut setelah konfirmasi.
   - Tombol `⟳ Muat Ulang` menyegarkan daftar; daftar juga otomatis disegarkan setiap kali penyimpanan berhasil.
8. **Kartu 8: Cadangan & Pemindahan Konten (Ekspor/Impor JSON)**
   - Panel **📤 Ekspor Konten Aktif**: tombol `📤 Unduh Berkas Cadangan (.json)` mengunduh berkas JSON lengkap; baris info menampilkan nama berkas, ukuran, dan jumlah item (maklumat/agenda/FAQ/misi).
   - Panel **📥 Impor dari Berkas**: tombol memilih berkas `.json`; isi berkas divalidasi & diringkas di modal konfirmasi (nama berkas, waktu ekspor, pelaku, jumlah item, badge & judul hero) sebelum tombol `📥 Impor & Ganti Konten Aktif` dijalankan.
   - Setelah impor berhasil, seluruh kartu editor dimuat ulang dengan konten hasil impor dan daftar Riwayat Versi menyegar dengan label **`IMPOR BERKAS`**.
9. **Tombol Simpan Terpadu:**
   - Tombol `💾 Simpan Seluruh Perubahan Redaksi` dengan feedback loading instan dan toast sukses.
   - Seluruh kartu disimpan sekaligus melalui satu payload `{ editorial_content: { ... } }` ke `saveSettings`.

### Prinsip Defensif Frontend
- Semua nilai (input, textarea, select) di-escape dengan `Auth.esc()` sebelum dirender ulang oleh list builder.
- Baris tanpa judul (maklumat/acara) atau tanpa pertanyaan & jawaban lengkap (FAQ) otomatis dibuang dari payload.
- Setiap kartu menyediakan input bebas; teks bawaan HTML portal publik tetap menjadi fallback bila field dikosongkan.

---

## 6. Riwayat Versi Konten (Pencegahan Penimpaan Permanen)

### Penyimpanan
- Tabel **baru** `Sheet_EditorialHistory` (dibuat otomatis oleh `initSchema()` / `getSheetSafe_()`, **tidak mengubah skema tabel yang sudah ada**) dengan kolom: `id`, `saved_at`, `saved_by`, `action` (`SAVE` / `RESTORE` / `IMPORT`), `label`, `content`.
- Satu baris = satu versi utuh konten redaksi (JSON ternormalisasi). Tabel ini terpisah dari `Sheet_Settings` agar payload `getSettings` tetap ringan dan riwayat tidak ikut terbaca portal publik.
- Jumlah versi dibatasi `EDITORIAL_HISTORY_MAX` = **15 versi terbaru**; versi terlama dipangkas otomatis (`trimEditorialHistory_`) dengan pencarian ulang berdasarkan `id` agar nomor baris yang bergeser tidak salah hapus.

### Semantik Pemulihan
1. `saveSettings` mengarsipkan **versi sebelumnya** (bukan versi baru) sehingga riwayat merekam keadaan sebelum perubahan.
2. Penyimpanan tanpa perubahan tidak menghasilkan versi baru (tidak ada sampah riwayat).
3. `restoreEditorialRevision` mengarsipkan konten yang **sedang aktif** lebih dahulu (label `Sebelum memulihkan versi …`), baru kemudian menerapkan versi lama dan mencatat aksi `RESTORE`. Karena itu pemulihan selalu dapat dibatalkan.
4. Memulihkan versi yang isinya sama dengan konten aktif tidak mengubah apa pun.
5. Isi versi dinormalisasi ulang saat dibaca & dipulihkan, sehingga baris yang pernah disunting manual di spreadsheet tetap tersanitasi (tautan `javascript:`/`data:` tetap dibuang).
6. Setiap pemulihan dicatat di `Sheet_AuditLogs` (`EDITORIAL_RESTORED`).
7. Seluruh endpoint riwayat hanya untuk `SUPERADMIN` & `KETUA` (wajib sesi login); data riwayat tidak pernah dikirim ke `getPublicSettings`.
8. Impor berkas mengikuti kaidah yang sama: konten aktif diarsipkan lebih dahulu (label `Sebelum impor berkas (…)`), lalu konten hasil impor dicatat dengan aksi `IMPORT`.

---

## 7. Ekspor & Impor Berkas JSON (Cadangan & Pemindahan Lingkungan)

### Format Berkas
```json
{
  "format": "apii-editorial-v1",
  "exported_at": "2026-10-08T11:00:00.000Z",
  "exported_by": "ketua",
  "origin": "https://apii.sigitadi.id",
  "label": "Cadangan konten redaksi Portal Publik SIAP APII",
  "counts": { "missions": 3, "bulletins": 1, "events": 1, "faqs": 3 },
  "content": { "hero": { "…": "…" }, "profile": { "…": "…" }, "bulletins_events": { "…": "…" }, "contact": {}, "social": {}, "faqs": [], "faqs_show": true }
}
```
Nama berkas berpola `redaksi-apii-YYYY-MM-DD-HHMM.json` (tanpa spasi/titik dua agar aman di Windows, macOS, dan Linux).

### Bentuk Berkas yang Diterima saat Impor
1. **Berkas hasil ekspor APII** — `{ format, exported_at, content: { … } }` (disarankan).
2. **Objek konten mentah** — `{ hero: { … }, faqs: [ … ] }`, yaitu bentuk yang sama dengan yang tampil pada tombol *Lihat JSON lengkap versi ini* di kartu Riwayat Versi. Karena itu satu versi riwayat dapat disalin ke lingkungan lain tanpa alat tambahan.
3. **Teks JSON** dari kedua bentuk di atas (BOM di awal berkas ditoleransi).

### Penjagaan Keamanan Impor
- **Berkas tanpa satu pun bagian konten redaksi ditolak** (`hero`, `profile`, `bulletins_events`, `contact`, `social`, `faqs`, `faqs_show`) — berkas JSON sembarang tidak dapat mengosongkan konten aktif menjadi nilai bawaan.
- **Penanda format diperiksa**: bila `format` ada tetapi bukan `apii-editorial*`, impor ditolak dengan pesan yang menyebutkan format berkasnya.
- Seluruh isi berkas **dinormalisasi ulang** sebelum disimpan (trim, batas panjang, batas jumlah item, pembuangan tautan `javascript:`/`data:`), sehingga berkas yang pernah disunting manual tetap aman.
- **Batas sel Google Sheets** berlaku sama: isi berkas di atas `EDITORIAL_CELL_SAFE` (45.000 karakter) ditolak dengan pesan yang jelas dan **tidak menulis apa pun**.
- Impor **tanpa perubahan** (isi berkas identik dengan konten aktif) tidak menghasilkan versi riwayat baru.
- Ekspor & impor hanya untuk `SUPERADMIN` & `KETUA` (wajib sesi login); berkas ekspor tidak memuat data sensitif pengurus maupun baris riwayat versi.

### Batas Sel Google Sheets
Satu sel Google Sheets maksimum **50.000 karakter**. Batas aman internal `EDITORIAL_CELL_SAFE` = **45.000 karakter**:
- konten yang melampaui batas ini **ditolak** saat penyimpanan dengan pesan yang jelas (penyimpanan bersifat *all-or-nothing*, tidak ada pengaturan yang tertulis sebagian);
- versi di atas batas aman tidak diarsipkan (dikembalikan sebagai peringatan `TOO_LARGE`), sehingga riwayat tidak pernah gagal menyimpan karena batas sel.

---

## 8. Prosedur Uji & Validasi Kode

Setiap perubahan wajib melalui serangkaian verifikasi:
```powershell
# 1. Kompilasi bundle Google Apps Script
powershell -ExecutionPolicy Bypass -File .\scripts\build-apps-script.ps1

# 2. Validasi sintaks JS Apps Script
node scripts/validate-apps-script.mjs

# 3. Uji smoke backend
node scripts/smoke-backend.mjs

# 4. Uji smoke Redaksi Konten (mini-CMS: normalisasi, simpan-baca ulang,
#    riwayat versi + pemulihan, ekspor & impor berkas JSON, batas sel,
#    penyimpanan hostil, RBAC, serta jalur doGet/doPost)
node scripts/smoke-editorial.mjs

# 5. Validasi sintaks JS Frontend
node -c portal/portal.js
node -c portal/auth.js
node -c public/app.js
```
Semua uji harus berstatus **LULUS (0 GAGAL)** sebelum perubahan di-deploy ke produksi.
