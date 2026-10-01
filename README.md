# Yayasan APII DPW Jabodetabek — Backend API

**Sistem Informasi & Administrasi Terpadu Yayasan APII (Apologet Islam Indonesia)**
Dewan Pimpinan Wilayah (DPW) Jabodetabek

Backend REST API + WebSocket yang menjadi fondasi reaktif untuk Single Page Application (SPA) frontend. Dibangun dengan prinsip **"cukup untuk berjalan hari ini, mudah dibesarkan besok"** — sengaja dirancang sederhana agar mudah dioperasikan dan dipelihara tim yang baru pertama kali mengelola sistem administrasi digital.

---

## 🧱 Teknologi

| Lapisan | Teknologi | Catatan |
|---|---|---|
| Runtime & Bahasa | **Node.js 20+ / TypeScript** (NestJS) | Monolith 1 proses, modular 6 modul |
| Database | **PostgreSQL 16** | ORM **Prisma**, RBAC level aplikasi; managed **Neon** di produksi |
| Cache & Pub/Sub | **Redis 7** | Cache + broker pesan WebSocket; **Upstash** di produksi |
| Penyimpanan File | **MinIO** (S3-compatible) | PDF, lampiran, logo, stempel; **Cloudflare R2** di produksi |
| Otentikasi | **Google OAuth 2.0 (PKCE) + JWT (RS256)** | Sesi berbasis refresh token |
| Real-time | **WebSocket** (`socket.io`) | Notifikasi & event bus per divisi/role |
| Engine PDF | **Puppeteer** (headless Chromium) | Render SK dengan kop, stempel, QR |
| Kontrak API | **OpenAPI 3.1** (auto-generated) | Dari schema **Zod**, tanpa duplikasi typing |
| Deployment | **Vercel** (satu server function) | Domain `apii.sigitadi.id`; lihat [DESIGN.md §11](./docs/DESIGN.md#11-deployment--infrastruktur) |

---

## ✨ Fitur Inti

- **RBAC 13 peran bertingkat** + delegasi manajemen anggota ke pimpinan (tanpa campur tangan IT).
- **Isolasi divisi mutlak** — akses lintas divisi selalu ditolak (`403`) + dicatat sebagai event audit keamanan.
- **Persuratan resmi** — nomor surat otomatis, draf kolaboratif, render PDF A4 dengan Logo DPW, Stempel Basah, dan QR verifikasi SHA-256.
- **Keuangan dual-approval** — voucher dibukukan Bendahara, diverifikasi Bendahara + Ketua Umum; buku kas & laporan bersetempel.
- **7-tab workflow divisi** (Humas, Sosmed, Dakwah, Litbang, Investasi, Hukum, Umum) dengan status `DRAFT` → `PENDING_APPROVAL` → `APPROVED`.
- **Portal publik & anggota** — feed informasi resmi, verifikasi SK via SHA-256, jadwal kajian, e-KTA 5 tahun.
- **Notifikasi real-time** — event `PROGRAM_APPROVED`, `DOCUMENT_PUBLISHED`, `CASHBOOK_MUTATED` ke room yang berhak.

---

## 🚀 Cara Menjalankan

### Prasyarat
- **Node.js 20+** dan **npm** (cek: `node --version`)
- **Docker** + Docker Compose (hanya untuk menjalankan PostgreSQL, Redis, MinIO **secara lokal** saat development; produksi memakai managed service, lihat [DESIGN.md §11](./docs/DESIGN.md#11-deployment--infrastruktur))

### 4 Langkah

```bash
# 1. Install dependency aplikasi
npm install

# 2. Siapkan environment & keypair RS256 untuk JWT
cp .env.example .env       # Windows PowerShell: Copy-Item .env.example .env
npm run keys               # buat keys/private.pem & keys/public.pem (direferensikan .env)

# 3. Jalankan database, cache, dan storage (background)
docker compose up -d db redis minio

# 4. Siapkan database lalu jalankan aplikasi
npm run migrate     # buat seluruh tabel
npm run seed        # isi 4 akun inti (superadmin=si.sigitadi@gmail.com) + logo/stempel contoh
npm run dev         # API siap di http://localhost:3000/api/v1
```

> Aplikasi **gagal berjalan** bila `.env` tidak lengkap atau keypair RS256 tidak ada —
> validasi Zod di startup sengaja ketat (fail fast, PROJECT_RULES.md §3.6).
> Tanpa Docker, unit test tetap bisa dijalankan: `npm test` (Prisma/Redis di-mock).

Dokumentasi interaktif (Swagger UI): **http://localhost:3000/api/v1/docs**
Kontrak JSON untuk codegen frontend: **http://localhost:3000/api/v1/swagger.json**

---

## 📜 Daftar Script

| Script | Kegunaan |
|---|---|
| `npm run dev` | Mode pengembangan dengan hot-reload |
| `npm run build` | Build produksi ke `dist/` (webpack, satu bundle `dist/server.js`) |
| `npm run start:prod` | Jalankan hasil build |
| `npm run keys` | Buat keypair RS256 JWT di `keys/` (jalan sekali saat setup) |
| `npm run migrate` | Migrasi skema database (Prisma) |
| `npm run migrate:reset` | Reset & ulang migrasi (hati-hati: hapus data) |
| `npm run seed` | Isi data awal (akun inti, branding aset) |
| `npm run test` | Unit test (Jest) |
| `npm run lint` | Cek aturan kode (termasuk larangan tipe `any`) |
| `npm run format` | Format kode dengan Prettier |

> OpenAPI tidak perlu script terpisah — Swagger UI tersedia otomatis di `/api/v1/docs` saat server berjalan (`patchNestJsSwagger()` dari `nestjs-zod`).

---

## ⚙️ Konfigurasi Environment

Salin `.env.example` menjadi `.env` lalu sesuaikan:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://apii:apii@localhost:5432/apii_jabo
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=apii-jabo
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxx
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
PUBLIC_VERIFY_BASE_URL=https://app.apii.sigitadi.id/verify   # domain frontend SPA (PRD Q8)
CORS_ORIGINS=https://app.apii.sigitadi.id                    # asal frontend yang diizinkan ke API
```

> Generator keypair RS256: `npm run keys` (membuat `keys/private.pem` & `keys/public.pem`).

---

## 📁 Struktur Folder

```
.
├── src/
│   ├── modules/                    # 6 modul fungsional
│   │   ├── auth/                   # Google OAuth, JWT, RBAC, Delegasi
│   │   ├── letters/                # Persuratan, Kop, Stempel, PDF Engine
│   │   ├── finance/                # Buku Kas, Dual-Approval, Laporan
│   │   ├── divisions/              # 7-tab workflow divisi
│   │   ├── public-portal/          # Feed, Verifikasi SK, Jadwal, e-KTA
│   │   └── uploader/               # Upload file (REST multipart) + Storage
│   ├── common/                     # Guards, Interceptors, Pipes, Filters
│   ├── infrastructure/             # Prisma, Redis, S3, PDF, WebSocket
│   └── config/                     # Konfigurasi terpusat
├── prisma/
│   ├── schema.prisma               # Skema database (sumber kebenaran)
│   ├── migrations/                 # Riwayat migrasi
│   └── seed.ts                     # Data awal
├── docs/
│   ├── DESIGN.md                   # Arsitektur & keputusan desain
│   ├── PRD.md                      # Kebutuhan produk & persona
│   ├── PROJECT_RULES.md            # Aturan pengembangan & kontribusi
│   └── rbac-matrix.md              # Matriks izin detail per peran
├── README.md                       # Mulai dari sini
└── docker-compose.yml              # Infrastruktur lokal
```

---

## 📚 Dokumentasi

- **[PRD.md](./docs/PRD.md)** — Product Requirements: persona, kebutuhan fungsi (`FR-*`), user story, metrik sukses, risiko
- **[DESIGN.md](./docs/DESIGN.md)** — Arsitektur, model data, alur dokumen, keputusan desain
- **[PROJECT_RULES.md](./docs/PROJECT_RULES.md)** — Aturan kode, keamanan, alur git, Definition of Done
- **[docs/rbac-matrix.md](./docs/rbac-matrix.md)** — Matriks izin 13 peran × modul
- **[docs/deploy.md](./docs/deploy.md)** — Panduan deployment produksi (Vercel, Neon PITR, Upstash, R2, Zero-Downtime)
- **[docs/frontend-integration.md](./docs/frontend-integration.md)** — Panduan integrasi Frontend SPA, WebSocket, format envelope, dan generate TypeScript types dari OpenAPI


---

## 🗺️ Roadmap

- **Fase 1 — Fondasi:** ✅ scaffold, Prisma + migrasi + seed, OAuth PKCE + JWT RS256, RBAC Guards, OpenAPI.
- **Fase 2 — Core:** ✅ persuratan + PDF engine, keuangan dual-approval, workflow 7 divisi.
- **Fase 3 — Realtime & Portal:** ✅ WebSocket event bus (`/v1/stream/events`, room multiplexing + Redis pub/sub), portal publik (feed, verifikasi SHA-256, jadwal) & e-KTA 5 tahun.
- **Fase 4 — Ship:** ✅ konfigurasi deploy Vercel (`vercel.json` + `api/index.ts` + env produksi), docker-compose final untuk dev, e2e test suite lengkap, panduan deploy (`docs/deploy.md`).

**Ditangguhkan ke Fase 2+** (lihat `DESIGN.md`): scan ClamAV, transkoding HLS video, OCR kwitansi, PostgreSQL RLS, chunked WebSocket upload, antrian worker terpisah.

---

## 🚢 Deployment

Target produksi: **Vercel** (project `siap-apii`), domain **`apii.sigitadi.id`**, repo `github.com/sisigitadi/siap-apii`. Detail lengkap deployment, migrasi database, dan strategi pemulihan ada di **[docs/deploy.md](./docs/deploy.md)** serta **[DESIGN.md §11](./docs/DESIGN.md#11-deployment--infrastruktur)**.

**Ringkasnya:**

| Komponen | Produksi |
|---|---|
| Compute (NestJS) | Vercel — satu server function, region `sin1` (Singapura) |
| PostgreSQL | Neon (serverless Postgres) |
| Redis | Upstash (serverless) |
| Storage S3 | Cloudflare R2 |
| Chromium (PDF) | `puppeteer-core` + `@sparticuz/chromium` |
| SSL + CDN | Otomatis oleh Vercel |

> Kode aplikasi **tidak berubah** — hanya environment variables yang berbeda. Development tetap pakai `docker compose` (lihat "Cara Menjalankan").

---

## 📄 Lisensi

Internal — Yayasan APII DPW Jabodetabek. Tidak untuk distribusi publik tanpa izin.
