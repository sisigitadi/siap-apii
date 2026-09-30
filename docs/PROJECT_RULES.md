# PROJECT RULES — Aturan Pengembangan

**Yayasan APII DPW Jabodetabek — Backend API**

Dokumen ini adalah **kontrak tim**. Setiap kontribusi wajib mematuhi aturan di bawah. Tujuannya bukan membatasi, melainkan menjaga kode tetap **mudah dibaca, aman, dan konsisten** — terutama untuk anggota tim yang baru pertama kali terlibat.

---

## 1. Aturan Struktur & Penamaan

### 1.1 Modul
- Setiap modul berdiri sendiri di `src/modules/<nama-modul>/` dan **tidak boleh** mengimpor modul lain secara langsung (gunakan event/service bersama lewat `infrastructure/`).
- Satu modul = satu tanggung jawab bisnis. Jika sebuah modul membawa 2 tanggung jawab, pecah.

### 1.2 Penamaan berkas
| Jenis | Pola | Contoh |
|---|---|---|
| Controller | `<resource>.controller.ts` | `letters.controller.ts` |
| Service | `<resource>.service.ts` | `letters.service.ts` |
| DTO (Zod) | `<resource>.dto.ts` | `create-letter.dto.ts` |
| Guard | `<nama>.guard.ts` | `division.guard.ts` |
| Gateway WS | `<nama>.gateway.ts` | `events.gateway.ts` |
| Enum/konstanta | `<nama>.constant.ts` | `user-role.constant.ts` |

- **File & variabel:** `kebab-case` untuk file, `camelCase` untuk variabel/fungsi, `PascalCase` untuk class/interface/type Zod.
- **Tabel & kolom Prisma:** `snake_case` (mis. `official_letters`, `created_at`).
- **Endpoint:** plural `kebab-case` (mis. `/api/v1/official-letters`).

---

## 2. Aturan Kode & Tipe Data

### 2.1 DILARANG `any`
- **Semua** input dan output wajib memiliki tipe eksplisit.
- Validasi input memakai **Zod**; inference tipe via `z.infer<typeof X>`.
- ESLint rule `@typescript-eslint/no-explicit-any` **disetel error**. Yang `any` lolos review = PR ditolak.

### 2.2 DTO adalah kontrak tunggal
- Satu file DTO Zod digunakan untuk **validasi request + dokumentasi OpenAPI + tipe response**. Tidak ada duplikasi definisi tipe.
- Setiap field DTO wajib punya `describe()` untuk teks dokumentasi (muncul di Swagger UI).

### 2.3 Lapisan modul (jangan berlapis-lapis)
```
Controller  → terima request, validasi (ZodPipe), kirim response
Service     → logika bisnis + transaksi database (Prisma)
Gateway     → hanya untuk WebSocket event; tidak ada logika bisnis
```
- **Dilarang** membuat abstraction/interface tambahan sebelum ada 2+ implementasi. Hindari *over-abstraction*.

### 2.4 Response envelope standar
Selalu bungkus response sukses dengan interceptor global:
```json
{
  "success": true,
  "code": 200,
  "message": "Resource successfully fetched",
  "data": {},
  "meta": { "timestamp": 1741584000 }
}
```
- `data` wajib bertipe DTO. `meta.timestamp` = epoch detik UTC.

### 2.5 Error
- Gunakan **exception standar NestJS** (`BadRequestException`, `ForbiddenException`, `UnauthorizedException`, `NotFoundException`).
- Global `HttpExceptionFilter` menerjemahkan ke envelope konsisten:
```json
{ "success": false, "code": 403, "message": "Akses divisi ditolak", "data": null, "meta": { "timestamp": 1741584000 } }
```

---

## 3. Aturan Keamanan (Zero-Trust)

1. **Setiap endpoint non-publik wajib memakai `@UseGuards`** — paling tidak `JwtAuthGuard`.
2. **Isolasi divisi wajib**: endpoint milik divisi memakai `@Division(...)` decorator + `DivisionGuard`. Akses lintas divisi → `403` + **wajib** memicu `SecurityAuditEvent` (ditulis ke Redis stream + tabel `audit_logs`).
3. **Jangan pernah log:**
   - password / secret / token / keypair,
   - data sensitif anggota (nomor KTP, nomor rekening) dalam plain text.
4. **Integritas dokumen**: `sha256_hash` dihitung dari *canonical payload*; direcompute & dicocokkan saat publish. Hash tidak pernah dijadikan "rahasia" — fungsinya hanya integrity check.
5. **File upload**: validasi ekstensi + MIME + ukuran maksimum di level aplikasi (tidak mempercayai klien).
6. **Environment**: semua kredensial via `.env` (tidak pernah hardcode). `.env` **tidak** boleh di-commit (`.gitignore`).

---

## 4. Aturan Database & Migrasi

- `prisma/schema.prisma` adalah **sumber kebenaran**. Ubah skema → `npm run migrate --name <deskripsi>` → commit folder migrasi.
- **Dilarang** mengedit file migrasi lama yang sudah di-apply.
- Field JSONB (kop, signatories, submission_data) tetap divalidasi dengan Zod di lapisan aplikasi — PostgreSQL tidak memvalidasi isinya.
- Transaksi multi-tulis (mis. voucher + jurnal) wajib memakai `prisma.$transaction`.


---

## 5. Aturan Git & Commit

### 5.1 Branch
- `main` = selalu bisa deploy.
- Branch fitur: `feat/<modul>/<deskripsi-singkat>` (mis. `feat/letters/render-pdf`).
- Branch perbaikan: `fix/<modul>/<deskripsi-singkat>`.

### 5.2 Conventional Commits
```
feat: tambah render PDF SK dengan stempel basah
fix: koreksi perhitungan saldo buku kas saat outflow
docs: lengkapi matriks RBAC untuk divisi hukum
refactor: sederhanakan validasi nomor surat
test: tambah unit test dual-approval voucher
chore: update dependency prisma
```
- Subjek imperatif, huruf kecil, tanpa titik akhir, maksimal 72 karakter.

### 5.3 Pull Request
- 1 PR = 1 perubahan fokus. Hindari PR raksasa.
- PR wajib: `npm run lint` bersih, `npm run test` hijau, deskripsi memuat "apa & mengapa".

---

## 6. Aturan Bahasa

- **Teks UI / pesan error / nama fitur**: **Bahasa Indonesia** (sesuai pengguna akhir).
- **Nama variabel, fungsi, class, file, tabel**: **Bahasa Inggris** (menjaga konsistensi dengan ekosistem).
- Komentar kode: Bahasa Indonesia singkat hanya saat logika non-obvious. Kode yang jelas tidak perlu komentar.

---

## 7. Aturan Testing

- **Service** yang mengandung logika bisnis penting wajib punya unit test.
- **Guard** (RBAC & divisi) wajib diuji: kasus *diizinkan* & kasus *ditolak*.
- Test file menempel di sisi: `letters.service.spec.ts`.
- Nama test deskriptif dalam Bahasa Inggris.

---

## 8. Definition of Done

Sebuah tugas dianggap selesai jika **semua** terpenuhi:
- [ ] Fitur berjalan sesuai `DESIGN.md`
- [ ] Semua input/output bertipe eksplisit (tidak ada `any`)
- [ ] Endpoint terlindungi guard + tercatat di matriks RBAC (`rbac-matrix.md`)
- [ ] Endpoint didokumentasikan otomatis di Swagger (Zod → OpenAPI)
- [ ] Event audit dipicu pada aksi sensitif (403 cross-division, publish, approval)
- [ ] Unit test hijau, `npm run lint` bersih
- [ ] Migrasi ter-commit & dapat dijalankan ulang dari nol (`migrate:reset` + `seed`)
- [ ] Tidak ada kredensial yang ter-commit
- [ ] **Fase 4 (ship) saja:** backup database produksi via Neon point-in-time restore + panduan deploy Vercel (`vercel.json`, env produksi) tersedia (lihat `DESIGN.md` §11)

---

## 9. Aturan Review

Saat meninjau PR, tanyakan:
1. Apakah ini menyelesaikan masalah pengguna akhir? (Jika hanya "keren tapi tidak terpakai" → tolak.)
2. Apakah rekan tim baru bisa memahami kode ini dalam 10 menit? (Jika tidak → sederhanakan.)
3. Apakah ada jalan pintas yang melewati guard/audit? (Jika ada → tolak.)
4. Apakah penambahan ini sesuai roadmap `DESIGN.md`, atau malah menyusupkan kompleksitas yang ditangguhkan?

> **Ingat:** Pengguna akhir ini adalah pengurus yayasan yang **belum terbiasa administrasi digital**. Setiap kompleksitas yang kita tambahkan adalah beban untuk mereka. Pilih selalu yang paling sederhana yang masih menyelesaikan pekerjaan.
