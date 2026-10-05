# DESIGN.md — Arsitektur & Keputusan Desain

**Sistem Informasi & Administrasi Terpadu Yayasan APII DPW Jabodetabek**

> Dokumen ini adalah **sumber kebenaran arsitektur**. Setiap keputusan teknis di sini sudah dipertimbangkan; jika ingin mengubah, update dokumen ini dulu, baru kode.

---

## 1. Pendahuluan

### 1.1 Untuk Siapa
Pengguna akhir adalah **pengurus dan admin yayasan yang sebagian besar belum terbiasa dengan sistem administrasi digital**. Karena itu sistem ini dirancang dengan satu prinsip penggerak:

> **"Cukup untuk berjalan hari ini, mudah dibesarkan besok."**

Setiap fitur dipertanyakan dulu: *apakah ini benar-benar menyelesaikan masalah pengguna, atau hanya menambah kesibukan?* Yang dipertahankan adalah **fungsi**, bukan **kemegahan teknis**.

### 1.2 Prinsip Desain
1. **Tanpa server, tanpa biaya.** Seluruh backend berjalan di Google Apps Script; database di Google Sheets; file di Google Drive. Nol biaya infrastruktur dalam kuota Workspace.
2. **Modular, bukan spaghetti.** Kode GAS dipecah per domain: `Code.gs` (routing), `Auth.gs`, `Surat.gs`, `Keuangan.gs`, `Divisi.gs`, `Database.gs` (wrapper), `Utils.gs` (helper).
3. **Keamanan adalah default.** Setiap aksi dilindungi verifikasi sesi + RBAC di tabel router; pelanggaran dicatat, bukan diam-diam ditolak.
4. **Frontend statis & ringan.** HTML + Vanilla JS + Tailwind CDN, tanpa build step, mudah dideploy ke hosting manapun.
5. **Boros pada dokumentasi, pelit pada kompleksitas.** Komentar & docs murah; bug mahal.

---

## 2. Arsitektur Sistem

### 2.1 Diagram

```
   🌐 apii.sigit.id (publik)          🌐 siapii.sigitadi.id (portal pengurus)
   public/index.html + app.js          portal/index.html + portal.js + auth.js
            │  fetch JSON (CORS)                 │  fetch JSON + token
            └───────────────┬────────────────────┘
                            ▼
        ┌─────────────────────────────────────────────────┐
        │        GOOGLE APPS SCRIPT WEB APP                │
        │        Code.gs  (doGet / doPost → router)        │
        │                                                  │
        │  ┌────────────────────────────────────────────┐  │
        │  │ TABEL ROUTES (RBAC single source of truth) │  │
        │  │ action → { auth, roles, handler }          │  │
        │  └────────────────────────────────────────────┘  │
        │  ┌────────────────────────────────────────────┐  │
        │  │ Auth.gs · Surat.gs · Keuangan.gs · Divisi  │  │
        │  │ Database.gs (wrapper) · Utils.gs (helper)  │  │
        │  └────────────────────────────────────────────┘  │
        └───────┬───────────────────┬───────────────────────┘
                │                   │
                ▼                   ▼
        ┌───────────────┐   ┌───────────────┐
        │ GOOGLE SHEETS │   │ GOOGLE DRIVE  │
        │  (database)   │   │  (PDF, file)  │
        │ 7 tab + header│   │               │
        └───────────────┘   └───────────────┘
                │
                ▼
        ┌───────────────────────────────┐
        │ GOOGLE DOCS (template surat)  │
        │  → ekspor PDF saat PUBLISHED  │
        └───────────────────────────────┘
```

### 2.2 Mengapa Google Apps Script (bukan server sendiri)

| Kriteria | Google Apps Script (dipilih) | Server tradisional |
|---|---|---|
| Biaya | ✅ Rp 0 dalam kuota Workspace | ❌ VPS/biaya berulang |
| Setup & deploy | ✅ Salin kode → deploy Web App | ❌ konfigurasi server, SSL, domain |
| Tim kecil & baru | ✅ 1 hal untuk dipelihara | ❌ butuh DevOps |
| Akses data yayasan | ✅ Sheets/Drive native | ❌ perlu integrasi manual |
| Skala ke depan | ⚠️ ada batas kuota & 6 menit/runtime — **dipantau** | ✅ |

> **Batasan yang disadari:** Apps Script cocok untuk volume administrasi yayasan (ribuan baris). Jika beban meledak, lapisan `Database.gs` dapat diganti implementasinya tanpa mengubah `Auth/Surat/Keuangan/Divisi` — itulah guna pola _wrapper/repository_.

### 2.3 Alur Request (lengkap)

```
Frontend fetch(action, payload, token)
   → doGet/doPost(e)               # Code.gs
   → parse action + token + payload
   → ROUTES[action] ditemukan?     # tidak → 404 "Aksi tidak dikenali"
   → route.auth? → verifySession(token)   # Auth.gs, cek Sheet_Sessions + expired
   → route.roles? → cek role user  # tidak match → audit + 403
   → route.handler(ctx)            # Surat.gs / Keuangan.gs / Divisi.gs
   → envelope { success, data, message }
   → JSON (CORS *)
```

---

## 3. Audit Kompleksitas: Rencana Awal → Versi Sederhana

| # | Rencana Awal | **Versi Sederhana (dipilih)** | Alasan |
|---|---|---|---|
| 1 | Login Google OAuth + SSO | **Username + password + session token UUID** | Pengurus belum siap migrasi semua ke Google; login kustom lebih mudah didemokan. SSO tetap bisa ditambahkan nanti (lihat §12) |
| 2 | Database relasional penuh | **Google Sheets (tab per domain)** | Cukup untuk volume yayasan; bisa dilihat langsung oleh pengurus; nol biaya |
| 3 | WebSocket notifikasi real-time | **Polling manual / refresh halaman** | Apps Script tidak mendukung WebSocket. Notifikasi email (GmailApp) cadangan Fase 4 |
| 4 | ORM & migrasi terstruktur | **Wrapper `Database.gs` + header tab sebagai skema** | Satu lapisan abstraksi; ganti backend data tinggal ubah 1 file |
| 5 | Upload file multipart besar | **Ditangguhkan**; link Drive dicatat manual di field | File awal = PDF surat (generate sistem). Upload lampiran menyusul |
| 6 | Dual-approval Bendahara + Ketua | **DIPERTAHANKAN** (2 status + 2 kolom verifikator) | Kontrol kepercayaan yang diminta; sudah sederhana |
| 7 | State machine surat & divisi ketat | **DIPERTAHANKAN** | Inti kepercayaan dokumen; dijalankan di backend, frontend hanya menampilkan |
| 8 | Generate PDF dengan library Chromium | **Template Google Docs → ekspor PDF** | Tidak butuh library; kop & formatting dijaga oleh template Docs |

**Yang tetap utuh:** RBAC 9 peran + isolasi divisi (tolak + audit), persuratan + nomor otomatis + PDF, keuangan dual-approval + saldo, workflow 7 divisi, portal publik + verifikasi surat, audit log.

---

## 4. Model Data (Google Sheets)

### 4.1 Cara Kerja
- Setiap tab = satu "tabel". **Baris 1 = header** (nama kolom), baris 2+ = data.
- `Database.gs` membaca header lalu memetakan setiap baris menjadi objek `{ field: value, _row: <nomor baris> }`.
- Field boolean disimpan sebagai string `"TRUE"` / `"FALSE"`.
- Angka (amount, budget) disimpan sebagai number Google Sheets.
- Tanggal disimpan sebagai ISO string (`yyyy-MM-dd`); `expired_at` sebagai epoch ms.

### 4.2 `Sheet_Users` — Pengguna
| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | string (UUID) | Primary key |
| `username` | string | Unik, dipakai saat login |
| `password_hash` | string | SHA-256(salt + password), hex 64 char |
| `full_name` | string | Nama lengkap |
| `email` | string | Email pengurus (opsional) |
| `role` | enum | 9 peran (§5.1) |
| `division` | enum | `DIV_*` — hanya untuk `KETUA_DIVISI` / `ANGGOTA_DIVISI` |
| `is_active` | `"TRUE"`/`"FALSE"` | Nonaktifkan akun tanpa menghapus |
| `can_manage_users` | `"TRUE"`/`"FALSE"` | Flag delegasi kelola anggota |
| `created_at` | string | ISO timestamp |
| `updated_at` | string | ISO timestamp |

### 4.3 `Sheet_Sessions` — Sesi Login
| Kolom | Tipe | Keterangan |
|---|---|---|
| `token` | string (UUID) | Primary key; dikirim frontend di setiap request |
| `user_id` | string (UUID) | FK → `Sheet_Users.id` |
| `username` | string | Denormalisasi untuk audit |
| `role` | enum | Snapshot peran saat login |
| `division` | enum | Snapshot divisi saat login |
| `created_at` | string | ISO timestamp |
| `expired_at` | number | Epoch ms; default `created_at + 7 hari` |

> Implementasi: `Auth.gs` — token dibuang otomatis saat expired (lazy cleanup) maupun saat logout.

### 4.4 `Sheet_Surat` — Persuratan Resmi
| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | string (UUID) | Primary key |
| `letter_number` | string | Unik; auto-generate, bisa diedit saat DRAFT |
| `title` | string | Judul / perihal |
| `letter_type` | enum | `SK` · `UNDANGAN` · `PENGANTAR` · `KETERANGAN` · `TUGAS` · `REKOMENDASI` · `EDARAN` |
| `content` | string (JSON) | `{ menimbang, mengingat, memutuskan }` |
| `status` | enum | `DRAFT` · `PENDING_APPROVAL` · `PUBLISHED` · `REJECTED` |
| `tanggal_surat` | string | ISO date; default hari ini |
| `created_by` | string | Username pembuat |
| `created_by_name` | string | Nama pembuat (denormalisasi) |
| `created_at` | string | ISO timestamp |
| `submitted_at` | string | Saat diajukan ke ketua |
| `published_at` | string | Saat disetujui & PDF terbit |
| `approved_by` | string | Username ketua penyetuju |
| `rejection_notes` | string | Alasan penolakan (wajib saat REJECTED) |
| `sha256_hash` | string | Checksum integritas dokumen |
| `pdf_url` | string | Link Drive setelah generate PDF |
| `qr_verify_url` | string | URL verifikasi publik |

### 4.5 `Sheet_Keuangan` — Voucher & Buku Kas
| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | string (UUID) | Primary key |
| `voucher_number` | string | Unik; auto-generate (`088/KEU-APII/JABO/II/2026`) |
| `type` | enum | `MASUK` · `KELUAR` |
| `account` | enum | `KAS_BSI` · `BRANKAS` · `MANDIRI_WAKAF` |
| `amount` | number | Nilai transaksi (Rupiah) |
| `category` | string | Kategori (mis. "Operasional", "Kegiatan Divisi") |
| `description` | string | Keterangan transaksi |
| `transaction_date` | string | ISO date |
| `status` | enum | `PENDING` · `VERIFIED_BY_BENDAHARA` · `VERIFIED_BY_KETUM` · `APPROVED` · `REJECTED` |
| `verified_by_bendahara` | string | Username bendahara |
| `verified_by_bendahara_at` | string | ISO timestamp |
| `verified_by_ketum` | string | Username ketua |
| `verified_by_ketum_at` | string | ISO timestamp |
| `rejection_notes` | string | Alasan penolakan |
| `created_by` | string | Username pembuat voucher |
| `created_at` | string | ISO timestamp |

### 4.6 `Sheet_Divisi` — Usulan Program Divisi
| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | string (UUID) | Primary key |
| `tracking_id` | string | Unik; `#REQ-2026-089` |
| `division` | enum | `DIV_HUMAS` · `DIV_LITBANG` · `DIV_SOSMED` · `DIV_DAKWAH` · `DIV_INVESTASI` · `DIV_HUKUM` · `DIV_UMUM` |
| `program_title` | string | Judul program |
| `description` | string | Deskripsi program |
| `budget_estimate` | number | Estimasi anggaran |
| `target_audience` | string | Sasaran peserta |
| `execution_date` | string | ISO date |
| `status` | enum | `DRAFT` · `AJUKAN` · `DISETUJUI` · `DITOLAK` |
| `submitted_by` | string | Username pengusul |
| `submitted_by_name` | string | Nama pengusul |
| `submitted_at` | string | ISO timestamp |
| `reviewed_by` | string | Username ketua reviewer |
| `reviewed_at` | string | ISO timestamp |
| `approval_notes` | string | Catatan ketua (saat DISETUJUI/DITOLAK) |
| `created_at` | string | ISO timestamp |

### 4.7 Tab Pendukung
| Tab | Kegunaan |
|---|---|
| `Sheet_AuditLogs` | Jejak audit: `timestamp`, `actor` (username), `action`, `detail`. Setiap penolakan akses & transisi status penting dicatat |
| `Sheet_Sequences` | Counter nomor urut per tahun & jenis: `key` (mis. `SURAT:SK:2026`), `value` (counter). Increment terkunci via `LockService` agar tidak bentrok |

---

## 5. RBAC, Hierarki & Delegasi

### 5.1 Daftar Peran
| Role | Cakupan Wewenang |
|---|---|
| `SUPERADMIN` | Infrastruktur, konfigurasi sistem, kelola akun, lihat audit |
| `KETUA` | Persetujuan tunggal (rilis surat, Approval Board divisi, verifikasi final voucher) |
| `SEKRETARIS` | CRUD surat, mengajukan surat ke ketua |
| `BENDAHARA` | Membuat voucher & verifikasi tahap 1, laporan keuangan |
| `PEMBINA` | **Read-only mutlak** atas seluruh dokumen & laporan |
| `PENGAWAS` | **Read-only mutlak** — audit trail, buku kas |
| `KETUA_DIVISI` | Memimpin divisi kerja; wajib field `division` |
| `ANGGOTA_DIVISI` | Anggota divisi kerja; wajib field `division` |
| `ANGGOTA_BIASA` | Hanya portal publik + data sendiri |

### 5.2 Penerapan di Kode
- Tabel `ROUTES` di `Code.gs` = **single source of truth** izin: `action → { auth, roles, handler }`.
- Handler menerima `ctx.user` hasil `verifySession()` — **tidak pernah** membaca role/divisi dari payload frontend.
- Isolasi divisi: handler membandingkan `ctx.user.division` dengan divisi data. Tidak cocok → lempar error 403 + audit.
- Pembina/Pengawas: `ROLES_READONLY` — frontend **tidak merender** tombol aksi; backend juga menolak aksi tulis meski dipanggil langsung.

### 5.3 Delegasi Kelola Anggota
```
SUPERADMIN ──toggle can_manage_users──▶ KETUA / SEKRETARIS / BENDAHARA
                    │
                    └──▶ kelola akun pengurus (tanpa campur tangan IT)
```
Setiap perubahan dicatat di `Sheet_AuditLogs`.

---

## 6. Alur Dokumen & Konvensi Penomoran

### 6.1 Nomor Surat Otomatis
Format: `{nomor_urut}/{KODE}/{roman_bulan}/{tahun}` — contoh SK: `042/SK-DPW/APII-JABO/III/2026`

Aturan:
- `nomor_urut` = increment per-tahun dari `Sheet_Sequences` (key `SURAT:{TYPE}:{tahun}`), terkunci `LockService` agar tidak bentrok.
- `KODE` per jenis surat: `SK` → `SK-DPW/APII-JABO`, `UNDANGAN` → `UND-DPW/APII-JABO`, dst.
- `roman_bulan` = bulan dari `tanggal_surat` (I–XII).
- Urutan **reset tiap tahun baru**.
- **Sekretaris dapat mengedit `letter_number`** selama status `DRAFT`. Setelah `PENDING_APPROVAL`/`PUBLISHED`, nomor **terkunci**.

### 6.2 Nomor Voucher
Format: `{nomor_urut}/KEU-APII/JABO/{roman_bulan}/{tahun}` — contoh `088/KEU-APII/JABO/II/2026`. Counter dari `Sheet_Sequences` (key `KEU:{tahun}`), reset per tahun.

### 6.3 Tracking ID Usulan Divisi
Format: `#REQ-{tahun}-{nomor_urut:3digit}` — contoh `#REQ-2026-089`.

### 6.4 State Machine Surat (`Sheet_Surat`)
```
DRAFT ──submit (SEKRETARIS)──▶ PENDING_APPROVAL ──approve (KETUA)──▶ PUBLISHED
                                   │
                                   └──reject (KETUA, wajib catatan)──▶ REJECTED
```
- `DRAFT` & `PENDING_APPROVAL` hanya terlihat penulis + peran internal yang berhak.
- `PUBLISHED`: bisa diverifikasi publik via nomor surat; PDF immutable (hash dicatat).
- Transisi `PENDING_APPROVAL → PUBLISHED` **hanya** oleh `KETUA` (atau `SUPERADMIN`) + memicu generate PDF.

### 6.5 State Machine Voucher (`Sheet_Keuangan`) — Dual Approval
```
PENDING ──verify (BENDAHARA)──▶ VERIFIED_BY_BENDAHARA ──verify (KETUA)──▶ VERIFIED_BY_KETUM ──▶ APPROVED
   │                                                                                        ▲
   └─────────────────────────── reject (KETUA/BENDAHARA) ──▶ REJECTED                         │
   └──────────────────────────────────────────────────────────────────────────────────────────┘
                        (saat KETUA verifikasi, jika kedua tanda tangan lengkap → langsung APPROVED)
```
- **Kedua** tanda tangan wajib ada sebelum voucher memengaruhi saldo.
- Hanya voucher `APPROVED` yang dihitung di saldo buku kas.

### 6.6 Workflow Usulan Divisi (`Sheet_Divisi`)
```
DRAFT ──ajukan──▶ AJUKAN ──setujui (KETUA)──▶ DISETUJUI
                     │
                     └──tolak (KETUA, wajib catatan)──▶ DITOLAK
```
- **Aturan ketat: 0 publikasi langsung.** Divisi hanya bisa `Simpan Draf` / `Ajukan ke Ketua`.
- Persetujuan/penolakan **hanya** melalui Approval Board `KETUA`.
- Divisi **hanya melihat & mengusulkan divisinya sendiri** (divisi diambil dari `user.division`, bukan payload).

---

## 7. Session & Keamanan

### 7.1 Sistem Login Kustom (alur)
```
[Frontend] POST action=login { username, password }
   → Auth.gs: cari user di Sheet_Users (username)
   → cek is_active == TRUE dan password_hash == SHA-256(salt + password)
   → gagal? audit "LOGIN_FAILED" + 401 "Username atau password salah"
   → berhasil? generate token UUID → tulis Sheet_Sessions { token, user_id, expired_at: now+7h }
   → kembalikan { token, user, expired_at }
[Frontend] simpan token ke localStorage("siapii_token")
[Frontend] setiap fetch: GET ?action=...&token=...  atau  POST { action, token, payload }
   → Auth.gs: verifySession(token) → cek ada di Sheet_Sessions, expired_at > now, user masih aktif
   → tidak valid? 401 "Sesi berakhir, silakan login kembali" (frontend auto-logout)
```

> **Kenapa token di query/body, bukan header `Authorization`?** Web App Apps Script **tidak** menyertakan request header di objek event `doGet`/`doPost`. Cara andal mengirim token adalah via query parameter (GET) atau body JSON (POST).

### 7.2 Password Hashing
`hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, SALT + password)` → hex. Salt di Script Properties (`PASSWORD_SALT`), tidak pernah di-commit.

### 7.3 Audit Log
`Utils.audit(actor, action, detail)` menulis ke `Sheet_AuditLogs`:
- `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`
- `FORBIDDEN` (setiap aksi ditolak RBAC/isolasi divisi)
- `SURAT_SUBMIT`, `SURAT_PUBLISHED`, `SURAT_REJECTED`
- `KEU_VERIFY_BENDAHARA`, `KEU_VERIFY_KETUM`, `KEU_REJECTED`
- `DIVISI_AJUKAN`, `DIVISI_SETUJU`, `DIVISI_TOLAK`
- `USER_CREATE`, `USER_UPDATE`

### 7.4 CORS & Akses
Response JSON dari Apps Script otomatis menyertakan `Access-Control-Allow-Origin: *`, sehingga fetch dari kedua domain frontend berjalan tanpa konfigurasi tambahan.

---

## 8. PDF Engine (Template Google Docs)

### 8.1 Cara Kerja
1. Buat satu Google Docs sebagai **template surat** (bagian header: kop + `logo.png` placeholder; badan berisi placeholder).
2. Salin ID template dari URL → simpan di Script Properties `TEMPLATE_DOC_ID`.
3. Saat surat di-approve (`PENDING_APPROVAL → PUBLISHED`), `Surat.gs`:
   - `DriveApp.getFileById(TEMPLATE_DOC_ID).makeCopy(namaFile)` → salinan sementara.
   - Buka dengan `DocumentApp.openById()`, ganti placeholder di seluruh body + header/footer:
     - `{{NOMOR}}`, `{{JUDUL}}`, `{{TANGGAL}}`, `{{JENIS}}`
     - `{{MENIMBANG}}`, `{{MENGINGAT}}`, `{{MEMUTUSKAN}}`
     - `{{KETUA}}`, `{{SEKRETARIS}}`, `{{TAHUN}}`
   - Ekspor PDF: `UrlFetchApp.fetch('https://docs.google.com/document/d/<id>/export?format=pdf', { Authorization: Bearer <oauthToken> })` → `Blob`.
   - Simpan Blob ke folder Drive (`DRIVE_FOLDER_ID`), set sharing `ANYONE_WITH_LINK`/`VIEW` → dapat URL publik.
   - Hapus salinan Docs sementara (`setTrashed(true)`).
   - Tulis `pdf_url` + `sha256_hash` (dari canonical payload) + `qr_verify_url` ke `Sheet_Surat`.

### 8.2 Keunggulan
- **Kop & layout dijaga desainer** — cukup edit template Docs, tidak sentuh kode.
- Tanpa library eksternal, tanpa batasan ukuran bundle.
- Hasil PDF konsisten untuk setiap jenis surat.

---

## 9. Kontrak API

### 9.1 Envelope (satu format untuk semua response)
```json
{ "success": true,  "message": "Daftar surat berhasil dimuat.", "data": { ... } }
{ "success": false, "message": "Anda tidak memiliki izin untuk aksi ini.", "data": null }
```
> Apps Script selalu mengembalikan HTTP 200 untuk `ContentService`; kode error dibawa di field `message` + `data=null`. Frontend **hanya** mengecek `response.success`.

### 9.2 Cara Memanggil
- **GET** (baca): `GET <URL_EXEC>?action=<aksi>&token=<TOKEN>&limit=20&page=1`
- **POST** (tulis): `POST <URL_EXEC>` body `application/json`:
  ```json
  { "action": "createSurat", "token": "<TOKEN>", "payload": { "title": "...", "letter_type": "SK" } }
  ```

### 9.3 Daftar Aksi (Ringkasan)

| Aksi | Method | Peran yang Diizinkan | Keterangan |
|---|---|---|---|
| `login` | POST | publik | `{ username, password }` → `{ token, user }` |
| `logout` | POST | login | Hapus sesi |
| `me` | GET | login | Info user dari token |
| `getListSurat` | GET | SURAT_READ | Daftar + filter status/q + paginasi |
| `createSurat` | POST | `SUPERADMIN, SEKRETARIS` | Buat draft |
| `updateSurat` | POST | `SUPERADMIN, SEKRETARIS` | Hanya jika status `DRAFT` |
| `submitSurat` | POST | `SUPERADMIN, SEKRETARIS` | `DRAFT → PENDING_APPROVAL` |
| `approveSurat` | POST | `SUPERADMIN, KETUA` | `PENDING_APPROVAL → PUBLISHED` + PDF |
| `rejectSurat` | POST | `SUPERADMIN, KETUA` | `PENDING_APPROVAL → REJECTED` (wajib catatan) |
| `verifySurat` | GET/POST | publik | Cek nomor/SHA-256 → status keaslian |
| `getListKeuangan` | GET | KEUANGAN_READ | Daftar voucher |
| `getSaldo` | GET | KEUANGAN_READ | Total saldo kas |
| `createVoucher` | POST | `SUPERADMIN, BENDAHARA` | Buat voucher `PENDING` |
| `verifyVoucherBendahara` | POST | `SUPERADMIN, BENDAHARA` | `PENDING → VERIFIED_BY_BENDAHARA` |
| `verifyVoucherKetum` | POST | `SUPERADMIN, KETUA` | `VERIFIED_BY_BENDAHARA → APPROVED` |
| `rejectVoucher` | POST | `SUPERADMIN, KETUA` | `→ REJECTED` (wajib catatan) |
| `getListDivisi` | GET | login | Isolasi: divisi hanya lihat sendiri |
| `createSubmission` | POST | `SUPERADMIN, KETUA_DIVISI, ANGGOTA_DIVISI` | Divisi dari `user.division` |
| `ajukanSubmission` | POST | idem | `DRAFT → AJUKAN` |
| `approveSubmission` | POST | `SUPERADMIN, KETUA` | `AJUKAN → DISETUJUI` |
| `rejectSubmission` | POST | `SUPERADMIN, KETUA` | `AJUKAN → DITOLAK` |
| `getListPengguna` | GET | `SUPERADMIN` | Kelola akun |
| `createPengguna` | POST | `SUPERADMIN` | Buat akun |
| `updatePengguna` | POST | `SUPERADMIN` | Ubah peran/status/password |
| `getDashboard` | GET | login | Ringkasan statistik per peran |
| `getAuditLogs` | GET | `SUPERADMIN` | Jejak audit |

> Daftar lengkap + implementasi ada di `Code.gs` (tabel `ROUTES`). Matriks per peran di `rbac-matrix.md`.

---

## 10. Frontend — Design System "Amanah Modern Enterprise"

### 10.1 Identitas Visual
Kesan: **Amanah · Bersih · Modern** (nuansa Islam-institusional, tidak murahan, tidak generik).

| Elemen | Nilai |
|---|---|
| Warna utama | **Hijau Zamrud (Emerald)** `#047857` … `#022C22` |
| Background | Putih / Off-White `#FFFFFF`, `#F7FAF7` |
| Aksen | **Emas/Amber (Gold)** `#F59E0B`, `#FBBF24` |
| Font | **Plus Jakarta Sans** (fallback Inter) via Google Fonts |
| Logo | `<img src="logo.png">` di header publik & sidebar portal |
| Sudut | `rounded-xl` / `rounded-2xl` (lembut, ramah) |
| Bayangan | `shadow-sm` … `shadow-xl` halus, tidak keras |
| Tekstur | Pola geometris Islam subtil (inline SVG, opacity rendah) di hero |

### 10.2 Dua Domain Terpisah

| Domain | Folder | Isi | Audiens |
|---|---|---|---|
| `apii.sigit.id` | `public/` | `index.html`, `app.js`, `style.css` | Masyarakat umum (tanpa login) |
| `siapii.sigitadi.id` | `portal/` | `index.html`, `portal.js`, `auth.js`, `style.css` | Pengurus (login wajib) |

### 10.3 Arsitektur Frontend (Vanilla JS, anti-spaghetti)
Pola **Module (IIFE)** — setiap file satu tanggung jawab:

- `auth.js` → modul `Auth`: simpan/baca token `localStorage`, `Auth.login()`, `Auth.logout()`, `Auth.fetch(action, payload)` (melampirkan token + parsing envelope), `Auth.hasRole([...])`, `Auth.isReadOnly()`.
- `portal.js` → modul `App`: **state** (`state.user`, `state.view`, `state.data`), **router** (`App.navigate(view)`), dan **renderer** per view (`renderDashboard`, `renderSurat`, …) yang membangun DOM string. Menu & tombol aksi dirender hanya jika `Auth.hasRole()` diizinkan.
- `app.js` (publik) → modul `Public`: smooth scroll, mobile nav, handler form verifikasi surat.

> Pemisahan **State / API / DOM** ini membuat penambahan modul baru cukup menambah satu fungsi renderer + satu baris di router.

### 10.4 Aturan Tampilan per Peran
- Menu sidebar punya atribut `data-roles` — disembunyikan jika peran user tidak terdaftar.
- Pembina & Pengawas (`ROLES_READONLY`): **tidak ada** tombol create/edit/approve yang dirender (bukan disabled — disembunyikan total).
- Status dokumen selalu pakai **label Indonesia**: `DRAFT` → "Draf", `PENDING_APPROVAL` → "Menunggu Persetujuan", `PUBLISHED` → "Diterbitkan", `REJECTED` → "Ditolak", dll.

---

## 11. Deployment & Batasan Platform

### 11.1 Komponen Produksi
| Komponen | Produksi |
|---|---|
| Backend | Google Apps Script Web App (deploy "Me" + "Anyone") |
| Database | Google Sheets (`DB-SIAP-APII`) |
| File | Google Drive (folder khusus, sharing link) |
| Template PDF | Google Docs (1 file template) |
| Frontend publik | Hosting statis → `apii.sigit.id` |
| Frontend portal | Hosting statis → `siapii.sigitadi.id` |
| SSL | Otomatis oleh hosting statis |

### 11.2 Batasan Google Apps Script (wajib tahu)

| Batas | Dampak | Mitigasi |
|---|---|---|
| Eksekusi maksimal **6 menit** | Render PDF massal bisa timeout | Generate PDF satu per satu saat approve; batch job ditunda |
| Kuota harian `UrlFetchApp` / email | Callout berlebihan terkena limit | Hanya fetch saat perlu; caching di frontend |
| Web App tidak terima request header | Token tidak bisa lewat `Authorization` | Token via query param (GET) / body (POST) — sudah dirancang demikian |
| Sheets ~10 juta sel | Batas data jangka panjang | Cukup untuk ribuan dokumen; arsip rutin |
| Tidak ada WebSocket | Notifikasi real-time | Refresh manual / polling halaman; email notifikasi di Fase 4 |
| `LockService` per script | Kunci konkurensi terbatas | Cukup untuk counter nomor surat |

### 11.3 Catatan Deployment
1. **Script Properties** wajib diset sebelum deploy (lihat `README.md` Tahap 2).
2. Deploy Web App dengan **Execute as: Me** (agar bisa akses Sheets/Drive pemilik) + **Anyone** (agar frontend bisa panggil).
3. Setiap perubahan kode GAS → **Deploy → Manage deployments → Edit → New version** (agar URL tetap, versi baru aktif).
4. Frontend: ganti `API_BASE` lalu deploy ulang folder `public/` dan `portal/`.

---

## 12. Roadmap & Item Ditangguhkan

Ditangguhkan dengan pemicu aktivasi jelas (bukan dibuang):

| Item | Kapan Diaktifkan |
|---|---|
| Login Google / SSO | Saat seluruh pengurus siap migrasi |
| Notifikasi email (GmailApp) | Saat volume approval tinggi |
| e-KTA digital anggota | Saat data anggota lengkap & terverifikasi |
| Laporan keuangan bulanan PDF | Saat rekonsiliasi rutin |
| Upload lampiran ke Drive | Saat divisi rutin lampirkan proposal/foto |
| Import/export CSV massal | Saat migrasi data besar |
| Scheduled job (Trigger time-driven) | Saat perlu ringkasan harian otomatis |

---

*Setiap keputusan teknis di dokumen ini sudah dipertimbangkan terhadap kebutuhan nyata pengurus. Jika akan mengubah arsitektur, update dokumen ini dulu, baru kode.*
