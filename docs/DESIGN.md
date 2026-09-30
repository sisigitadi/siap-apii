# DESIGN.md — Arsitektur & Keputusan Desain

**Sistem Informasi & Administrasi Terpadu Yayasan APII DPW Jabodetabek — Backend API**

> Dokumen ini adalah **sumber kebenatan arsitektur**. Setiap keputusan teknis di sini sudah dipertimbangkan; jika ingin mengubah, update dokumen ini dulu, baru kode.

---

## 1. Pendahuluan

### 1.1 Untuk Siapa
Pengguna akhir adalah **pengurus dan admin yayasan yang sebagian besar belum terbiasa dengan sistem administrasi digital**. Karena itu, backend ini dirancang dengan satu prinsip penggerak:

> **"Cukup untuk berjalan hari ini, mudah dibesarkan besok."**

Setiap fitur dipertanyakan dulu: *apakah ini benar-benar menyelesaikan masalah pengguna, atau hanya menambah kesibukan?* Yang dipertahankan adalah **fungsi**, bukan **kemegahan teknis**.

### 1.2 Prinsip Desain
1. **Monolith dulu, bukan microservices.** Satu proses NestJS, enam modul. Deploy = satu unit (detail di §11).
2. **Tipe data pasti.** Tidak ada `any`. Zod sebagai kontrak tunggal: validasi + tipe + OpenAPI.
3. **Keamanan adalah default, bukan add-on.** Setiap endpoint terlindungi guard; pelanggaran dicatat, bukan diam-diam ditolak.
4. **Boros pada dokumentasi, pelit pada kompleksitas.** Komentar & docs murah; bug mahal.
5. **Fase 2 eksplisit.** Hal yang belum dibutuhkan ditangguhkan dan **ditulis di sini** (§9), bukan dihilangkan begitu saja.

---

## 2. Arsitektur Sistem

### 2.1 Diagram
```
        Frontend SPA (mockup sudah ada)
              │  REST (JSON) + WebSocket /events
              ▼
   ┌───────────────────────────────────────────────┐
   │      NESTJS MONOLITH  (1 proses, 6 modul)      │
   │                                                │
   │  ┌──────────────────────────────────────────┐  │
   │  │ auth · letters · finance · divisions     │  │
   │  │ public-portal · uploader                 │  │
   │  └──────────────────────────────────────────┘  │
   │  ┌──────────────────────────────────────────┐  │
   │  │ common: JwtAuthGuard · DivisionGuard     │  │
   │  │        RolesGuard · ZodValidationPipe    │  │
   │  │        ResponseInterceptor (envelope)    │  │
   │  │        HttpExceptionFilter · AuditLogger │  │
   │  └──────────────────────────────────────────┘  │
   └───────────────┬───────────────────────────────┘
                   │
   ┌───────────────┼───────────────────┬──────────────┐
   ▼               ▼                   ▼              ▼
 PostgreSQL 16   Redis 7            Storage S3    Puppeteer
 (Prisma ORM)   cache + WS pub/sub  (MinIO/R2)    render PDF
```
> Pada produksi (deploy ke Vercel, §11), keempat komponen di bagian bawah dijalankan sebagai **managed service eksternal** — monolith NestJS-nya tetap satu unit.

### 2.2 Mengapa Monolith, bukan Microservices
| Kriteria | Monolith (dipilih) | Microservices |
|---|---|---|
| Tim kecil & baru | ✅ 1 hal untuk dipelihara | ❌ butuh DevOps khusus |
| Latensi transaksi | ✅ 1 proses, tanpa network hop | ❌ RPC antar service |
| Deploy | ✅ 1 unit (satu server function, §11) | ❌ koordinasi banyak service |
| Skala ke depan | ⚠️ butuh refactor — **dijadwalkan** | ✅ |

Monolith NestJS modular **tetap membatasi modul agar tidak saling lepas** (lihat `PROJECT_RULES.md` §1.1), sehingga refactor ke microservices kelak bersifat "memindahkan", bukan "membongkar".

---

## 3. Audit Kompleksitas: Rencana Awal → Versi Sederhana

Master prompt awal mensyaratkan banyak *enterprise machinery*. Setelah audit terhadap **kebutuhan nyata pengguna awal**, berikut keputusannya:

| # | Rencana Awal | **Versi Sederhana (dipilih)** | Alasan |
|---|---|---|---|
| 1 | WebSocket chunked upload gateway (SHA-256 per-chunk, reassembly, backpressure, resume) | **REST multipart upload** + progress bar di frontend | File awal = SK, kwitansi, foto (kecil). Chunking hanya pantas untuk file raksasa. Pengguna tak pernah melihat protokolnya. |
| 2 | WebSocket `/events` untuk notifikasi real-time | **DIPERTAHANKAN** — room divisi & role | Nilai nyata: notifikasi "SK disetujui", "buku kas berubah" → kurangi refresh manual. |
| 3 | Worker terpisah (BullMQ): PDF queue, ClamAV, ffprobe, transcode HLS | **PDF render on-demand sinkron**; **ClamAV/HLS/OCR → ditangguhkan (§9)** | Render SK < 2 detik; tak butuh antrian. Tak ada payload awal yang butuh antivirus/transcode. |
| 4 | PostgreSQL Row-Level Security (RLS) | **RBAC level aplikasi (Guards)** saja | RLS sulit di-debug & dimigrasi. Isolasi tetap 100% via `DivisionGuard` + audit event. |
| 5 | 2 proses (API + Worker) + Redis sebagai queue | **1 proses**; Redis hanya cache + pub/sub | Satu hal yang dijalankan; cocok tim kecil. |
| 6 | Google OAuth 2.0 PKCE + JWT RS256 keypair | **DIPERTAHANKAN** | Ini inti keamanan & delegasi Gmail — bukan kompleksitas, tapi kebutuhan. |
| 7 | Dual-approval Bendahara + Ketua Umum | **DIPERTAHANKAN** (2 flag + 1 status) | Sudah sederhana; ini kontrol kepercayaan yang diminta. |
| 8 | Sub-layer berlapis per modul | **Modul datar**: controller → service → prisma | Mudah dibaca anggota tim baru. |
| 9 | OpenAPI 3.1 auto-sync untuk Orval | **DIPERTAHANKAN** — `nestjs-zod` + `@nestjs/swagger` | Justru menghemat pengetikan manual di frontend. |

**Yang tetap utuh:** RBAC 13 peran + delegasi Gmail + isolasi divisi (403 + audit), persuratan + render PDF Kop/Logo/Stempel/QR SHA-256, finance dual-approval + laporan bersetempel, 7-tab workflow divisi, portal publik (verifikasi SK + jadwal + e-KTA), notifikasi real-time.


---

## 4. Model Data

Didefinisikan di `prisma/schema.prisma`. Field JSONB **tetap divalidasi Zod** di lapisan aplikasi (PostgreSQL tidak memvalidasi isinya).

### 4.1 `users` — Pengguna & Delegasi
| Field | Tipe | Keterangan |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | varchar(255) | Unik; email Google/Workspace terdaftar |
| `full_name` | varchar(255) | Nama lengkap |
| `role` | enum `UserRole` | 13 peran (lihat §5) |
| `division` | enum `Division?` | Hanya untuk role `DIV_*` |
| `is_active` | boolean | Soft-disable akun |
| `can_manage_users` | boolean | **Flag delegasi** pimpinan (invite tanpa IT) |
| `created_at` / `updated_at` | timestamptz | Audit |

### 4.2 `official_letters` — Persuratan Resmi
| Field | Tipe | Keterangan |
|---|---|---|
| `id` | UUID | Primary key |
| `letter_number` | varchar(100) | Unik; auto-generate (lihat §6.1) |
| `title` | varchar(255) | Judul surat |
| `letter_type` | enum | `SK` · `REKOMENDASI` · `MAKLUMAT` · `SURAT_TUGAS` |
| `content_payload` | JSONB | Konsiderans: `Menimbang`, `Mengingat`, `Memutuskan` |
| `kop_config` | JSONB | Posisi/skala logo, teks otoritas, margin |
| `signatories` | JSONB | Array ketua/sekretaris + posisi stempel basah |
| `sha256_hash` | varchar(64) | Checksum integritas dokumen |
| `qr_verify_url` | text | `https://app.apii.sigitadi.id/verify/{sha256}` (dari `PUBLIC_VERIFY_BASE_URL`) |
| `status` | enum | `DRAFT` · `PENDING_APPROVAL` · `PUBLISHED` · `ARCHIVED` |
| `pdf_storage_url` | text? | URL S3 setelah render |
| `created_by` | UUID → users | Akuntabilitas |

### 4.3 `cash_flow` — Arus Kas & Voucher (Dual-Approval)
| Field | Tipe | Keterangan |
|---|---|---|
| `id` | UUID | Primary key |
| `voucher_number` | varchar(50) | Unik; auto-generate |
| `transaction_date` | date | Tanggal transaksi |
| `type` | enum | `INFLOW` · `OUTFLOW` |
| `account_category` | enum | `BSI_GIRO` (BSI Giro Utama) · `BRANKAS_KAS_KECIL` (Kas Tunai Brankas) · `MANDIRI_WAKAF` (Mandiri Wakaf) |
| `amount` | decimal(15,2) | Nominal |
| `description` | text | Uraian |
| `receipt_attachment_url` | text? | Bukti di S3 |
| `verified_by_bendahara` | UUID → users? | Tanda tangan Bendahara |
| `verified_by_ketum` | UUID → users? | Tanda tangan Ketua Umum |

### 4.4 `division_submissions` — Usulan 7 Divisi
| Field | Tipe | Keterangan |
|---|---|---|
| `id` | UUID | Primary key |
| `tracking_id` | varchar(50) | Unik; `#REQ-2025-089` |
| `division` | enum `Division` | Divisi pengusul |
| `program_title` | varchar(255) | Judul program |
| `budget_estimate` | decimal(15,2) | Estimasi anggaran |
| `target_audience` | text? | Sasaran |
| `execution_date` | date? | Tanggal pelaksanaan |
| `submission_data` | JSONB | Skema dinamis per divisi (7 Zod schema) |
| `attachments` | JSONB | `[]` default; daftar URL S3 |
| `status` | enum | `DRAFT` · `PENDING_APPROVAL` · `APPROVED` · `REJECTED` · `PUBLISHED` |
| `approval_notes` | text? | Catatan Ketua Umum |
| `reviewed_at` | timestamptz? | Timestamp review |

### 4.5 Tabel Pendukung
| Tabel | Kegunaan |
|---|---|
| `audit_logs` | Jejak audit: 403 cross-division, publish, approval, delegasi |
| `refresh_sessions` | Refresh token (jti) + blacklist di Redis |
| `letter_sequences` | Counter nomor surat per tahun (atomic increment) |
| `member_cards` | e-KTA: masa berlaku 5 tahun, hash + QR |
| `uploaded_files` | Metadata file S3 (tipe, ukuran, scan status) |
| `division_forms` | Definisi field dinamis per divisi (opsional, untuk UI adaptif) |


---

## 5. RBAC, Hierarki & Delegasi

### 5.1 Daftar Peran (`UserRole`)
| Role | Cakupan Wewenang |
|---|---|
| `SUPERADMIN` | Infrastruktur, rilis/migrasi DB, delegasi awal, konfigurasi sistem |
| `KETUA_UMUM` | Veto, persetujuan tunggal (Approval Board), rilis SK resmi |
| `SEKRETARIS` | Surat masuk/keluar, editor Kop & SK, verifikasi berkas |
| `BENDAHARA` | Arus kas, voucher, rekonsiliasi BSI, laporan keuangan |
| `DEWAN_PENGAWAS` | **Read-only**: audit trail, live ledger, form usulan sanksi/SP |
| `DIV_HUMAS` | Relasi eksternal, MoU, proposal mitra |
| `DIV_LITBANG` | Pelatihan SDM, silabus da'i, evaluasi |
| `DIV_SOSMED` | Kalender konten publikasi, asset grafis |
| `DIV_DAKWAH` | Penjadwalan safari dakwah, direktori asatidz |
| `DIV_INVESTASI` | Unit usaha wakaf, kaderisasi |
| `DIV_HUKUM` | Arsip legalitas, advokasi |
| `DIV_UMUM` | Pengadaan inventaris gedung |
| `PUBLIK_ANGGOTA` | **Read-only**: e-KTA, maklumat sah, jadwal kajian |

> Matriks izin **per endpoint-group** ada di **[rbac-matrix.md](./rbac-matrix.md)** — single source of truth yang bisa direview tanpa membaca kode.

### 5.2 Mekanisme Delegasi Akun Gmail
1. **Inisialisasi (sekali):** Superadmin mendaftarkan domain/email Google via `POST /api/v1/auth/delegation/init`.
2. **Delegasi wewenang:** Superadmin men-toggle `can_manage_users = true` pada Ketua Umum / Sekretaris / Bendahara → mereka dapat **mengundang pengurus baru** (`POST /api/v1/users/invite`) **tanpa campur tangan IT**.
3. **Audit:** setiap perubahan delegasi & undangan dicatat ke `audit_logs`.

### 5.3 Isolasi Divisi Mutlak (Zero Cross-Dashboard)
- Endpoint milik divisi memakai decorator `@Division(DIV_DAKWAH)` + `DivisionGuard`.
- `DivisionGuard` membandingkan `req.user.division` dengan divisi endpoint. **Tidak cocok → `403`**.
- Setiap penolakan **wajib** memicu `SecurityAuditEvent`:
  - ditulis ke **Redis stream** (`audit:security`) untuk konsumsi real-time, dan
  - dipersistensi ke **`audit_logs`** (PostgreSQL) untuk pemeriksaan Dewan Pengawas.
- Tidak ada jalan pintas: service layer **tidak** menerima `division` dari request — hanya dari token terautentikasi.

---

## 6. Alur Dokumen & Konvensi Penomoran

### 6.1 Nomor Surat Otomatis
Format: `{nomor_urut}/{KODE}/{roman_bulan}/{tahun}`
- Contoh SK: `042/SK-DPW/APII-JABO/III/2025`
- Contoh Keuangan: `088/KEU-APII/JABO/II/2025`

Aturan:
- `nomor_urut` = increment per-tahun dari tabel `letter_sequences` (atomic via transaksi).
- `KODE` ditentukan oleh `letter_type` & modul.
- `roman_bulan` = bulan `transaction_date`/`created_at` (I–XII).
- Urutan reset tiap tahun baru.
- **Sekretaris dapat mengedit `letter_number`** selama status masih `DRAFT` (mis. menyesuaikan penomoran khusus). Sistem tetap memvalidasi format & keunikan nomor. Setelah status berubah ke `PENDING_APPROVAL`/`PUBLISHED`, nomor **terkunci**.

### 6.2 Tracking ID Usulan Divisi
Format: `#REQ-{tahun}-{nomor_urut}` — contoh `#REQ-2025-089`.

### 6.3 State Machine Surat (`official_letters`)
```
DRAFT ──submit──▶ PENDING_APPROVAL ──approve──▶ PUBLISHED ──archive──▶ ARCHIVED
                        │
                        └──reject──▶ DRAFT (dengan catatan)
```
- `DRAFT` & `PENDING_APPROVAL` hanya terlihat Sekretaris/Ketua/Superadmin.
- `PUBLISHED` muncul di portal publik & QR dapat diverifikasi.
- Transisi `PENDING_APPROVAL → PUBLISHED` **hanya** oleh KETUA_UMUM (atau SUPERADMIN), memicu event `DOCUMENT_PUBLISHED`.

### 6.4 State Machine Voucher (`cash_flow`)
```
[Input Bendahara] ▶ MENUNGGU_VERIFIKASI
      │                    │
      │          verify_by_bendahara (BENDAHARA)
      │                    ▼
      │          verify_by_ketum (KETUA_UMUM)  ▶  TERVERIFIKASI (masuk buku kas)
      │
      └─ reject ▶ DITOLAK
```
- **Kedua** tanda tangan wajib ada sebelum masuk buku kas & memengaruhi saldo.

### 6.5 Workflow Usulan Divisi (`division_submissions`)
- **Aturan ketat: 0 publikasi langsung.** Divisi hanya bisa:
  - `Simpan Draf` → `DRAFT`
  - `Ajukan ke Ketua Umum` → `PENDING_APPROVAL`
- Persetujuan/reject **hanya** melalui Approval Board KETUA_UMUM → `APPROVED` / `REJECTED`.
- `PUBLISHED` (muncul di portal) hanya untuk program yang sudah terlaksana & dilaporkan.

---

## 7. Real-time: WebSocket Event Bus

**Endpoint:** `wss://<host>/v1/stream/events` (socket.io, otentikasi via JWT di handshake).

### 7.1 Room Multiplexing
| Room | Anggota |
|---|---|
| `public` | Semua koneksi (termasuk portal publik) |
| `role:ketua_umum` | Hanya Ketua Umum |
| `role:bendahara` | Hanya Bendahara |
| `role:dewan_pengawas` | Hanya Dewan Pengawas |
| `division:<DIVISI>` | Anggota divisi tersebut |

Server memakai **Redis pub/sub** sehingga beberapa instance API tetap konsisten — ini **wajib** saat deploy ke Vercel, karena setiap koneksi WebSocket ter-pin ke satu instance function (lihat §11.3).

### 7.2 Event yang Dipancarkan
| Event | Pemicu | Tujuan (room) | Payload ringkas |
|---|---|---|---|
| `PROGRAM_APPROVED` | Ketua setujui usulan divisi | `public` + `division:<x>` | `trackingId`, `division`, `title` |
| `DOCUMENT_PUBLISHED` | SK dipublikasi | `public` | `letterNumber`, `title`, `sha256` |
| `CASHBOOK_MUTATED` | Buku kas berubah | `role:bendahara` + `role:dewan_pengawas` | `voucherNumber`, `type`, `account` |
| `AUDIT_SECURITY` | 403 cross-division | `role:superadmin` + `role:dewan_pengawas` | `userId`, `endpoint`, `timestamp` |

> Frontend memakai event ini untuk **refetch** data terkait (mis. live ledger), bukan untuk mutasi.

---

## 8. PDF Engine & Konvensi API

### 8.1 Generator Dokumen Otentik
**Endpoint:** `GET /api/v1/letters/:id/render-pdf` (SEKRETARIS / KETUA_UMUM)

Pipeline sinkron:
1. Ambil surat + `kop_config` + `signatories`.
2. **Validasi integritas**: recompute SHA-256 dari canonical payload; cocokkan dengan `sha256_hash`. Jika mismatch → `409 Conflict` (dokumen diubah tanpa seizin).
3. Render HTML A4 (Puppeteer, headless Chromium) dengan:
   - **Logo DPW Emas** di kop (`Logo DPW Jabodetabek 1.jpg`),
   - **Teks Otoritas** "Dewan Pimpinan Wilayah Jabodetabek",
   - **Tanda tangan digital** pimpinan,
   - **Stempel Bulat Biru APII** (PNG transparan) overlay di atas tanda tangan (`Stempel APII Jabo.png`),
   - **QR Code** pojok bawah → `https://app.apii.sigitadi.id/verify/{sha256}` (frontend SPA).
4. Upload PDF ke storage S3 (MinIO lokal / Cloudflare R2 produksi) → simpan `pdf_storage_url`.
5. Kembalikan response (PDF stream atau presigned URL).

### 8.2 Response Envelope
Semua response JSON (sukses & error) memakai bentuk standar:
```json
{
  "success": true,
  "code": 200,
  "message": "Resource successfully fetched",
  "data": {},
  "meta": { "timestamp": 1741584000 }
}
```
- `data` selalu bertipe DTO (tidak pernah `any`).
- `meta.timestamp` = epoch detik UTC.
- Daftar kode error: `400` (validasi), `401` (belum login), `403` (ditolak/ lintas divisi), `404`, `409` (konflik integritas), `500`.

### 8.3 OpenAPI 3.1 Contract-First
- Schema **Zod** → `@nestjs/swagger` + `nestjs-zod` → `swagger.json` ter-generate otomatis.
- Frontend memakai **Orval** / `@openapi-typescript/codegen` → typed client **tanpa pengetikan manual**.
- `GET /api/v1/swagger.json` (publik untuk codegen) & `/api/v1/docs` (Swagger UI).

### 8.4 Upload File (Sederhana)
- **REST multipart** `POST /api/v1/uploads` → validasi ekstensi + MIME + ukuran → simpan ke storage S3 (MinIO lokal / Cloudflare R2 produksi) → kembalikan `fileId` + URL.
- Frontend menampilkan progress bar native (XHR/fetch progress).
- Metadata tersimpan di `uploaded_files`.

---

## 9. Yang Ditangguhkan (Fase 2+)

Berikut **sengaja belum dibangun**. Saat dibutuhkan, pasang sebagai modul baru tanpa membongkar yang ada:

| Fitur | Picu Aktifasi | Catatan |
|---|---|---|
| **ClamAV scan** PDF | Saat ada lampiran dari pihak luar | Jalankan sebagai sidecar container |
| **Transkoding HLS** video | Saat video kajian > 100 MB | FFmpeg; simpan ke storage S3 |
| **ffprobe metadata** audio | Saat podcast dipublikasi | Pelengkap katalog konten |
| **OCR kwitansi** | Saat voucher > 500/bulan | Untuk auto-fill `description` |
| **PostgreSQL RLS** | Saat ada banyak tenant DPW | Defense-in-depth di atas Guards |
| **Chunked WS upload** | Saat file > 500 MB rutin | Baru pertimbangkan SHA-256 per-chunk |
| **Antrian worker (BullMQ)** | Saat render PDF > 5 detik | Pindahkan render ke worker |
| **Audit stream dashboard** | Saat Dewan Pengawas minta live audit | Konsumsi Redis stream |

---

## 10. Roadmap Pengiriman

| Fase | Lingkup | Kriteria Selesai |
|---|---|---|
| **1 — Fondasi** | Scaffold NestJS, Prisma + migrasi + seed, Google OAuth PKCE + JWT RS256, Guards (RBAC/Division), envelope + filter, OpenAPI | `migrate` + `seed` jalan; login Google berhasil; 403 cross-division tercatat di audit |
| **2 — Core** | Modul letters + PDF engine, finance dual-approval + laporan bersetempel, divisions 7-tab workflow | Render 1 SK dengan stempel + QR; voucher lewat 2-tier approve |
| **3 — Realtime & Portal** | WebSocket event bus, public-portal (feed, verify, jadwal, e-KTA) | Event sampai ke room benar; verifikasi SHA-256 publik |
| **4 — Ship** | Konfigurasi deploy Vercel (`vercel.json` + env produksi), docker-compose final untuk dev, e2e test, panduan deploy | Deploy ke `apii.sigitadi.id` menyala penuh; `docker compose up` (dev) jalan dari nol |

---

## 11. Deployment & Infrastruktur

### 11.1 Target Deployment

| Item | Keterangan |
|---|---|
| **Repository** | `https://github.com/sisigitadi/siap-apii` (GitHub) — sumber kode, CI, dan rilis |
| **Platform** | **Vercel** (project `siap-apii`, deploy otomatis dari repo GitHub) — SSL, CDN global, dan auto-scale jadi tanggung jawab platform |
| **Domain API** | `https://apii.sigitadi.id` (sudah ditentukan) |
| **Frontend SPA** | `https://app.apii.sigitadi.id` — Vercel project terpisah (sudah ditentukan, lihat PRD §11 Q8) |
| **SSL** | Otomatis dikelola Vercel |

**Model:** NestJS berjalan sebagai **satu server function** — Vercel mendeteksi entrypoint `src/server.ts` yang memanggil `app.listen()`, lalu merute seluruh request ke sana. Satu unit deploy = satu function = **tetap monolith** (lihat §2.2).

### 11.2 Mengapa Vercel, bukan VPS Sendiri

Tim kita kecil dan baru; setiap jam yang dihabiskan untuk patch OS, urus SSL, konfigurasi nginx, dan restart saat crash adalah jam yang tidak ambil dari membangun fitur. Vercel menghapus beban operasional itu.

Dua alasan yang dulu mendorong ke arah VPS — **WebSocket** dan **Chromium** — kini sudah didukung Vercel:
- **WebSocket:** Public Beta di semua plan; `socket.io` jalan normal (koneksi ter-pin per instance, lihat §11.3).
- **Chromium:** bisa di-bundle dalam batas ukuran function memakai `puppeteer-core` + `@sparticuz/chromium` (varian ringan untuk serverless).

**Konsekuensi yang wajib dipahami:** Vercel hanya menjalankan *compute*. Tiga dependensi stateful kita harus dipindahkan ke **managed service eksternal**:

| Komponen | Lokal (development) | Produksi (Vercel) | Catatan |
|---|---|---|---|
| **PostgreSQL 16** | `docker compose` | **Neon** (serverless Postgres) | Skema `JSONB`/`timestamptz`/enum tetap utuh — tidak ada perubahan kode |
| **Redis 7** | `docker compose` | **Upstash** (serverless Redis) | Cache + pub/sub WebSocket; tetap satu `REDIS_URL` |
| **Storage S3** | MinIO (`docker compose`) | **Cloudflare R2** (S3-compatible, gratis egress) | Kode tak berubah — hanya beda `S3_ENDPOINT` |
| **Chromium** | Puppeteer lokal | `puppeteer-core` + `@sparticuz/chromium` | Render PDF di dalam function |

> **Pilihan provider Postgres: Neon.** Tiga alasannya: (1) *serverless native* — koneksi ditangani tanpa server yang harus dijaga; (2) fitur *branching* membuat DB preview untuk tiap Vercel preview deploy, jadi migrasi bisa diuji tanpa menyentuh data produksi; (3) free tier cukup untuk fase awal. Supabase/Railway tetap opsi cadangan jika kebutuhan berubah — kode tidak terikat provider (hanya `DATABASE_URL`).

> **Inti:** kode aplikasi **tidak berubah** antara lokal dan produksi — yang berbeda hanya environment variables. Prinsip "cukup untuk berjalan hari ini" tetap terjaga, dan beban operasional (backup, patch, SSL, restart) berpindah ke provider.

### 11.3 Batasan Platform (wajib tahu sebelum coding)

| Batas | Nilai | Dampak ke kita |
|---|---|---|
| Ukuran function (uncompressed) | **250 MB** | Pakai `puppeteer-core` + `@sparticuz/chromium`; **jangan** pakai `puppeteer` full (bundle Chromium penuh menembus batas ini) |
| Memory | Hobby **2 GB** / Pro **4 GB** | Satu render PDF ~300–500 MB — cukup; jangan render paralel di function yang sama |
| Max duration | Hobby **300 s** / Pro **800 s** (max 1800 s extended beta) | Render SK < 2 detik — sangat aman |
| Region default | `iad1` (Washington DC) | **Wajib ganti ke `sin1` (Singapura)** untuk latensi ke pengguna Indonesia |
| WebSocket | Public Beta; koneksi **ter-pin per instance** | Redis pub/sub wajib untuk konsistensi antar-instance — sudah ada di §7.1 |
| Cron | HTTP GET ke endpoint via `vercel.json` | Penjadwalan lewat endpoint aplikasi, bukan OS cron |

### 11.4 Catatan Teknis Deployment

1. **Chromium ringan, bukan bundle penuh.** Install `puppeteer-core` + `@sparticuz/chromium`. **Jangan** `import 'puppeteer'` (menarik Chromium ~170 MB+ dan menembus batas 250 MB). Set `executablePath` dari `@sparticuz/chromium` dengan flag `--no-sandbox --disable-dev-shm-usage --single-process`.
2. **Region `sin1`.** Default Vercel adalah `iad1` (AS Timur) → latensi ~250–300 ms dari Indonesia. Pilih `sin1` (Singapura) di pengaturan project. (Pro/Enterprise bisa multi-region; Fase 1 cukup satu region.)
3. **WebSocket (§7) di Vercel:** setiap koneksi ter-pin ke satu instance function; Fluid compute memungkinkan satu instance memegang banyak koneksi sekaligus. Redis pub/sub tetap jadi perekat antar-instance — **desain §7.1 sudah memenuhi ini tanpa perubahan**. Karena fitur ini masih Beta, frontend wajib punya *fallback* ke polling jika upgrade gagal (ditangani di Fase 3).
4. **Cold start.** Function "tidur" saat sepi → request pertama bisa lambat 1–3 detik. Mitigasi: jaga bundle tetap ramping. Jika terasa mengganggu di produksi, baru pertimbangkan pre-warming (Fase 4).
5. **Backup database produksi** lewat fitur bawaan Neon (point-in-time restore), **bukan** `pg_dump` OS cron. `PROJECT_RULES.md` §8 memasukkan ini ke DoD Fase 4.
6. **Scheduled jobs** (jika nanti perlu, mis. ringkasan harian): pakai Vercel Cron di `vercel.json` yang memicu endpoint HTTP di aplikasi.
7. **Environment variables produksi** di-set di dashboard Vercel: `DATABASE_URL` (Neon), `REDIS_URL` (Upstash), `S3_ENDPOINT` + `S3_ACCESS_KEY` + `S3_SECRET_KEY` + `S3_BUCKET` (R2), `GOOGLE_*`, `JWT_*`, `PUBLIC_VERIFY_BASE_URL` (`https://app.apii.sigitadi.id/verify`), `CORS_ORIGINS` (`https://app.apii.sigitadi.id`). Untuk private key RS256: simpan sebagai **string satu baris** di env var, bukan path file — supaya kunci tidak pernah masuk repo dan tersedia di semua instance.
8. **Database jangan diturunkan ke MySQL.** Skema memakai `JSONB`, `timestamptz`, dan enum PostgreSQL. Migrasi ke MySQL = penulisan ulang besar. Jika terpaksa, tunda dan dokumentasikan sebagai technical debt.
9. **Frontend SPA** di-deploy sebagai Vercel project terpisah; backend hanya sajikan `swagger.json` + `/api/v1/docs`.
