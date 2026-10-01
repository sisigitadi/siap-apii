# Panduan Deployment & Operasional Produksi (SIAP APII)

**Sistem Informasi & Administrasi Terpadu Yayasan APII DPW Jabodetabek — Backend API**

> Dokumen ini adalah panduan resmi deployment, manajemen infrastruktur cloud, strategi database, dan prosedur pemulihan bencana (disaster recovery) untuk backend SIAP APII.

---

## 1. Ringkasan Infrastruktur Produksi

Backend SIAP APII dirancang dengan arsitektur **Serverless Monolith** di mana logika bisnis berjalan sebagai satu unit NestJS terpadu pada compute Vercel, didukung oleh layanan cloud terkelola (managed services):

| Komponen | Layanan / Provider | Region | Keterangan |
|---|---|---|---|
| **Compute (API)** | **Vercel** Serverless Functions | `sin1` (Singapura) | Auto-scaling, SSL terkelola, CDN global, HTTP/2 & HTTP/3 |
| **Database** | **Neon** Serverless PostgreSQL 16 | `ap-southeast-1` (Singapura) | Connection pooling (PgBouncer), auto-suspend, branching, PITR |
| **Cache & Event Bus** | **Upstash** Serverless Redis 7 | `ap-southeast-1` (Singapura) | Token blacklist, PKCE state, pub/sub WebSocket (`ws:events`), audit stream |
| **Object Storage** | **Cloudflare R2** (S3 Compatible) | Global / APAC | Berkas lampiran usulan program, arsip surat, PDF SK & voucher |
| **Domain API** | `https://apii.sigitadi.id` | Cloudflare DNS | Mengarah ke CNAME Vercel |
| **Frontend SPA** | `https://app.apii.sigitadi.id` | Vercel Project Terpisah | SPA frontend yang mengonsumsi API ini |

---

## 2. Checklist Environment Variables Produksi

Seluruh variabel lingkungan dikonfigurasi melalui menu **Settings → Environment Variables** pada project Vercel.

| Nama Variabel | Wajib | Contoh Nilai Produksi | Keterangan |
|---|:---:|---|---|
| `NODE_ENV` | Ya | `production` | Mengaktifkan optimasi performa dan level log produksi |
| `PORT` | Tidak | `3000` | Port listen default (Vercel menangani routing otomatis) |
| `FRONTEND_URL` | Ya | `https://app.apii.sigitadi.id` | URL frontend untuk callback OAuth & tautan sistem |
| `PUBLIC_VERIFY_BASE_URL` | Ya | `https://app.apii.sigitadi.id/verify` | Base URL QR code verifikasi surat publik & e-KTA |
| `CORS_ORIGINS` | Ya | `https://app.apii.sigitadi.id` | Daftar origin CORS (pisahkan koma jika multi-domain) |
| `DATABASE_URL` | Ya | `postgresql://user:pass@ep-xyz-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` | Connection string PostgreSQL Neon (gunakan pooled connection) |
| `DIRECT_URL` | Ya (CLI) | `postgresql://user:pass@ep-xyz.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` | Direct connection Neon (khusus eksekusi `prisma migrate`) |
| `REDIS_URL` | Ya | `rediss://default:token@singapore-redis.upstash.io:6379` | Connection string Upstash Redis dengan TLS (`rediss://`) |
| `JWT_PRIVATE_KEY` | Ya | `"-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"` | Kunci privat RS256 2048-bit (string satu baris dengan `\n`) |
| `JWT_PUBLIC_KEY` | Ya | `"-----BEGIN PUBLIC KEY-----\nMIIB...\n-----END PUBLIC KEY-----"` | Kunci publik RS256 (string satu baris dengan `\n`) |
| `GOOGLE_CLIENT_ID` | Ya | `123456789-abc.apps.googleusercontent.com` | Google Cloud OAuth 2.0 Web Client ID |
| `GOOGLE_CLIENT_SECRET` | Ya | `GOCSPX-xxxxxxxxxxxxxxxx` | Google Cloud OAuth 2.0 Web Client Secret |
| `GOOGLE_CALLBACK_URL` | Ya | `https://apii.sigitadi.id/api/v1/auth/google/callback` | URL callback OAuth terdaftar di Google Cloud Console |
| `S3_ENDPOINT` | Opsional | `https://<account-id>.r2.cloudflarestorage.com` | Endpoint Cloudflare R2 |
| `S3_REGION` | Opsional | `auto` | Region storage S3 |
| `S3_ACCESS_KEY_ID` | Opsional | `xxxxxxxxxxxxxxxx` | Access key storage |
| `S3_SECRET_ACCESS_KEY` | Opsional | `xxxxxxxxxxxxxxxx` | Secret key storage |
| `S3_BUCKET_NAME` | Opsional | `apii-jabo-storage` | Nama bucket S3 penyimpanan berkas |

### Panduan Pembuatan RSA Keypair RS256
Jalankan utilitas pembuat kunci di lokal:
```bash
npm run keys
```
Output yang dihasilkan dapat langsung disalin ke Environment Variables Vercel. Pastikan karakter baris baru tetap berupa `\n` atau disalin secara utuh.

---

## 3. Langkah Deployment ke Vercel

### 3.1 Setup Awal Project
1. Masuk ke [Vercel Dashboard](https://vercel.com).
2. Klik **Add New Project** dan impor repository GitHub `sisigitadi/siap-apii`.
3. Pada **Project Settings**:
   - **Framework Preset**: *Other*
   - **Root Directory**: `./`
   - **Build Command**: `prisma generate && nest build` (sudah tercantum di `vercel.json`)
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
4. Masukkan seluruh variabel lingkungan dari checklist di atas ke bagian **Environment Variables**.
5. Klik **Deploy**.

### 3.2 Konfigurasi Domain
1. Masuk ke menu **Settings → Domains**.
2. Tambahkan domain `apii.sigitadi.id`.
3. Tambahkan CNAME record di DNS management (Cloudflare / Registrar):
   - `CNAME` `apii` → `cname.vercel-dns.com`
4. Vercel akan otomatis menerbitkan sertifikat SSL Let's Encrypt / DigiCert.



---

## 4. Manajemen Database (Neon PostgreSQL)

### 4.1 Menjalankan Migrasi Skema
Jangan menjalankan `prisma migrate dev` di lingkungan produksi. Gunakan perintah deploy:

```bash
# Eksekusi dari mesin admin / deployment script
npx prisma migrate deploy
```
*Catatan:* Pastikan `DATABASE_URL` atau `DIRECT_URL` mengarah ke direct connection Neon saat menjalankan migrasi (agar tidak terhalang batas connection pooling PgBouncer).

### 4.2 Inisialisasi Data Awal (Superadmin Seeding)
Setelah migrasi skema selesai pada basis data baru, jalankan seed untuk membuat akun Superadmin dan struktur awal:
```bash
npm run seed
```

### 4.3 Neon Branching untuk Preview Deployment
Neon mendukung pencabangan basis data instan (*branching*):
1. Setiap kali membuat Pull Request di GitHub, buat Neon database branch dari branch `main`.
2. Pasang connection string branch tersebut pada Environment Variable *Preview* di Vercel.
3. Uji coba migrasi baru di branch preview secara aman tanpa mempengaruhi basis data produksi.

### 4.4 Pemulihan Bencana (Point-In-Time Recovery / PITR)
Neon menyimpan histori log WAL transaksi basis data secara berkelanjutan:
1. Buka dashboard project Neon di konsol web.
2. Masuk ke tab **Branches** → **Restore**.
3. Pilih waktu pemulihan hingga ke detik spesifik sebelum insiden terjadi (misalnya: *10 menit yang lalu*).
4. Buat branch baru dari titik waktu tersebut dan arahkan `DATABASE_URL` ke branch baru untuk memulihkan operasional.

---

## 5. Prosedur Rollback & Zero-Downtime

### 5.1 Rollback Aplikasi (Vercel)
Jika rilis backend mengalami galat kritis:
1. Buka menu **Deployments** di Vercel Dashboard.
2. Cari deployment stabil sebelumnya (status Ready).
3. Klik titik tiga (`...`) → pilih **Instant Rollback**.
4. Trafik akan dialihkan secara instan (< 1 detik) ke build sebelumnya.

### 5.2 Rollback Migrasi Skema Database
Sesuai aturan **PROJECT_RULES.md §4 (Prisma Integrity)**, setiap migrasi yang dibuat ke produksi wajib bersifat **backward compatible (expand-and-contract)**:
- **Fase Tambah (Expand)**: Tambahkan kolom nullable atau tabel baru terlebih dahulu sebelum kode aplikasi dirilis.
- **Fase Hapus (Contract)**: Hapus kolom lama hanya setelah kode lama tidak lagi aktif.
Jika migrasi perlu dibatalkan:
1. Tulis skema migrasi baru bertipe perbaikan (`add_column_back` atau `drop_failed_table`).
2. Terapkan dengan `npx prisma migrate deploy`.

### 5.3 Pembersihan Cache Redis
Setelah rollback versi aplikasi, kosongkan cache yang berpotensi tidak kompatibel:
```bash
# Menggunakan redis-cli atau Upstash Console
redis-cli -u $REDIS_URL FLUSHDB
```

---

## 6. Verifikasi & Pemantauan Pasca Deploy

Setelah deployment selesai, verifikasi endpoint utama melalui terminal:

```bash
# 1. Periksa ketersediaan dokumentasi OpenAPI & Healthcheck
curl -I https://apii.sigitadi.id/api/v1/docs

# 2. Periksa respon envelope standar portal publik
curl -s https://apii.sigitadi.id/api/v1/public/feed | jq .

# 3. Periksa verifikasi dokumen SHA-256
curl -s https://apii.sigitadi.id/api/v1/public/verify/0000000000000000000000000000000000000000000000000000000000000000 | jq .
```

Respon sukses harus mengembalikan format envelope standar:
```json
{
  "success": true,
  "code": 200,
  "message": "Resource successfully fetched",
  "data": { ... },
  "meta": { "timestamp": 1770000000 }
}
```

---

## 7. Catatan Arsitektur Serverless Vercel

1. **Cold Starts**:
   Vercel Functions akan dimatikan jika tidak ada lalu lintas. Instance pertama membutuhkan 1–2 detik untuk inisialisasi NestJS runtime. Bundle dijaga di bawah 250 MB untuk meminimalkan durasi cold start.
2. **Koneksi WebSocket di Serverless**:
   Koneksi WebSocket ter-pin pada instance function yang aktif. Multiplexing pesan lintas instance dijamin 100% konsisten melalui Redis pub/sub (`EventsBusService` pada channel `ws:events`).
3. **Region Singapur (`sin1`)**:
   Pengaturan `regions: ["sin1"]` pada `vercel.json` memastikan latensi terendah (~15-30ms) bagi seluruh pengguna di wilayah Jabodetabek dan Indonesia.
