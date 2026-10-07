# Yayasan APII DPW Jabodetabek — SIAP APII

**Sistem Informasi & Administrasi Terpadu Yayasan APII (Apologet Islam Indonesia)**
Dewan Pimpinan Wilayah (DPW) Jabodetabek

Sistem administrasi yayasan yang dibangun di atas **Google Apps Script** (backend & logika), **Google Sheets** (database), **Google Drive** (penyimpanan dokumen), dan **HTML + Vanilla JavaScript + Tailwind CSS** (frontend). Tidak ada server yang harus dijalankan, tidak ada biaya infrastruktur, dan seluruhnya dapat dikelola langsung oleh tim yayasan.

> **Filosofi:** _"Cukup untuk berjalan hari ini, mudah dibesarkan besok."_ Setiap fitur dipertanyakan dulu apakah benar-benar menyelesaikan masalah pengurus, bukan menambah kesibukan.

---

## 🧱 Teknologi

| Lapisan          | Teknologi                                                     | Catatan                                                                                                                              |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Backend          | **Google Apps Script** (Web App `doGet` / `doPost`) | Router JSON, RBAC, manajemen sesi, state machine                                                                                     |
| Database         | **Google Sheets**                                       | `Sheet_Users`, `Sheet_Sessions`, `Sheet_Surat`, `Sheet_Keuangan`, `Sheet_Divisi`, `Sheet_AuditLogs`, `Sheet_Sequences` |
| Penyimpanan File | **Google Drive**                                        | PDF surat resmi, kwitansi, lampiran divisi                                                                                           |
| Mesin PDF        | **Google Docs Template** → ekspor PDF                  | Kop yayasan, nomor, tanggal, dan isi surat otomatis                                                                                  |
| Frontend Publik  | HTML + Vanilla JS + Tailwind CSS (CDN)                        | folder`public/` → domain **`apii.sigit.id`**                                                                              |
| Frontend Portal  | HTML + Vanilla JS + Tailwind CSS (CDN)                        | folder`portal/` → domain **`siapii.sigitadi.id`**                                                                         |
| Otentikasi       | Username + Password +**Session Token (UUID)**           | Sesi disimpan di`Sheet_Sessions`, masa berlaku 7 hari                                                                              |
| Tipografi & Tema | Google Fonts (Plus Jakarta Sans / Inter), Emerald + Gold      | Lihat`docs/DESIGN.md §10`                                                                                                         |

---

## ✨ Fitur Inti

- **RBAC 9 peran bertingkat** + delegasi manajemen anggota ke pimpinan (tanpa campur tangan IT).
- **Isolasi divisi mutlak** — akses lintas divisi selalu ditolak + dicatat sebagai event audit keamanan.
- **Persuratan resmi** — nomor surat otomatis, draf, _state machine_ `DRAFT → PENDING_APPROVAL → PUBLISHED / REJECTED`, dan generate PDF dari template Google Docs.
- **Keuangan dual-approval** — voucher dibukukan Bendahara, diverifikasi Bendahara + Ketua; saldo kas otomatis.
- **Workflow 7 divisi** (Humas, Litbang, Sosmed, Dakwah, Investasi, Hukum, Umum) dengan status `DRAFT → AJUKAN → DISETUJUI / DITOLAK`.
- **Portal publik** — landing page yayasan + **form pengecekan keaslian surat** berbasis nomor/SHA-256 (tanpa login).
- **Pembina & Pengawas 100% read-only** — tidak ada tombol aksi yang dirender di layar mereka.

---

## 🚀 Cara Pasang (6 Langkah Saja)

> Semua sudah disiapkan: **Spreadsheet**, **project Apps Script**, **logo**, **stempel**, dan **kop surat**.
> Yang Anda lakukan hanya menyalin file & klik tombol di Google.

**Persiapan (sekali saja):** Jalankan `scripts/build-apps-script.ps1` di folder ini.
Hasilnya 3 file di folder `apps-script/`: `Backend.gs`, `AsetLogo.gs`, `AsetStempel.gs`.

---

**Langkah 1 — Buka project Apps Script Anda**

Buka link Apps Script yang sudah Anda buat → di editor ada file `Code.gs`.

**Langkah 2 — Hapus file lama, buat 3 file baru**

- Klik ikon ⋮ di samping file `Code.gs` → **Delete** (hapus semua file default).
- Klik **+ (New file)** → **Script** → buat 3 file bernama persis: `Backend`, `AsetLogo`, `AsetStempel`.
- Buka masing-masing file di folder `apps-script/` proyek ini, **salin seluruh isinya**, lalu tempel ke file yang sama nama di Apps Script. Simpan (ikon 💾).

**Langkah 3 — Jalankan `setup` (ini yang buat semuanya)**

- Di editor, pastikan file `Backend.gs` terbuka, lalu di toolbar atas pilih fungsi **`setup`** → klik **▶ Run**.
- Saat diminta izin akses Google: pilih akun yayasan → **Advanced** → **Go to project (unsafe)** → **Allow**.

> Fungsi `setup` ini otomatis membuat: **7 sheet database**, **9 akun demo**, **folder Drive** untuk PDF, dan **template Google Docs** lengkap dengan **kop + logo + stempel** Anda. Tidak perlu buat manual sama sekali.

**Langkah 4 — Deploy sebagai Web App**

- Klik **Deploy** (kanan atas) → **New deployment** → ikon ⚙️ → **Web app**.
- Isi: _Description_ `SIAP APII`; **Execute as: Me**; **Who has access: Anyone** → **Deploy**.
- Salin **URL Web app** (format `https://script.google.com/macros/s/xxx/exec`).

**Langkah 5 — Tempel URL ke 2 file frontend**

Buka file di proyek ini, ganti `GANTI_DENGAN_DEPLOYMENT_ID` dengan URL deployment Anda:

- `public/config.js` — baris `window.API_BASE`
- `portal/config.js` — baris `window.API_BASE`

**Langkah 6 — Deploy frontend (opsional, bisa nanti)**

- Folder `public/` → hosting statis (Cloudflare Pages / Netlify) → domain `apii.sigit.id`.
- Folder `portal/` → hosting terpisah → domain `siapii.sigitadi.id`.
- File `logo.png` sudah ada di kedua folder — tidak perlu tambah apa-apa.

Selesai. Backend + database gratis selamanya dalam kuota Google Workspace yayasan.

---

> 🆘 **Kalau error di langkah mana pun**, baca `docs/TROUBLESHOOTING.md` — ada daftar error + cara memperbaiki.

---

## 👤 Akun Demo

Setelah `setup()` dijalankan, 9 akun ini tersedia (password semuanya `apii2026`):

| Username | Peran | Divisi |
| -------------- | -------------------- | --------- |
| `superadmin` | SUPERADMIN | — |
| `ketua` | KETUA | — |
| `sekretaris` | SEKRETARIS | — |
| `bendahara` | BENDAHARA | — |
| `pembina` | PEMBINA (read-only) | — |
| `pengawas` | PENGAWAS (read-only) | — |
| `khumas` | KETUA_DIVISI | DIV_HUMAS |
| `ahumas` | ANGGOTA_DIVISI | DIV_HUMAS |
| `anggota` | ANGGOTA_BIASA | — |

> Ganti password semua akun sebelum penggunaan nyata.

---

## 📚 Dokumentasi

- **[docs/PRD.md](./docs/PRD.md)** — Kebutuhan produk, persona, `FR-*`, user story, metrik sukses
- **[docs/DESIGN.md](./docs/DESIGN.md)** — Arsitektur, skema Google Sheets, alur dokumen, session, PDF engine
- **[docs/rbac-matrix.md](./docs/rbac-matrix.md)** — Matriks izin 9 peran × modul (single source of truth)
- **[docs/PROJECT_RULES.md](./docs/PROJECT_RULES.md)** — Aturan pengembangan & Definition of Done

---

## 🗺️ Roadmap

- **Fase 1 — Fondasi:** ✅ router GAS, database Google Sheets, login + session token, RBAC 9 peran, audit log.
- **Fase 2 — Core:** ✅ persuratan + generate PDF dari template Docs, keuangan dual-approval, workflow 7 divisi.
- **Fase 3 — Portal:** ✅ landing page publik + verifikasi keaslian surat, portal pengurus (dashboard, tabel, aksi).
- **Fase 4 — Pengembangan lanjutan:** 🔜 notifikasi email (GmailApp), e-KTA anggota, laporan keuangan bulanan PDF, import/export CSV.

---

## 🔒 Catatan Keamanan

- Password di-hash **SHA-256 + salt** (tidak pernah disimpan plain-text).
- Session token **UUID** disimpan di `Sheet_Sessions` dengan `expired_at`; setiap request wajib membawa token.
- Setiap percobaan akses yang ditolak dicatat di `Sheet_AuditLogs` beserta waktu & pelaku.
- Deploy Web App dengan **"Anyone"** hanya aman karena seluruh endpoint dilindungi verifikasi sesi + RBAC di router.

---

## 📄 Lisensi

Internal — Yayasan APII DPW Jabodetabek. Tidak untuk distribusi publik tanpa izin.
