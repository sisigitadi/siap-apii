# Matriks RBAC — Izin per Peran

**Yayasan APII DPW Jabodetabek — Backend API**

> Sumber kebenaran izin akses. Setiap endpoint baru **wajib** didaftarkan di sini saat dibuat.

**Legenda:**
- `✏️` = baca + tulis (create/update/delete)
- `👁️` = read-only
- `✅` = akses penuh (termasuk approve/publish)
- `🚫` = tidak ada akses (403 + audit event)
- `🔒` = hanya milik divisi sendiri (isolasi `DivisionGuard`)

---

## Matriks Utama: 13 Peran × Modul

| Peran | auth | letters | finance | divisions | public-portal | uploader |
|---|---|---|---|---|---|---|
| `SUPERADMIN` | ✅ + delegasi awal | ✅ + konfigurasi kop | 👁️ + reset | ✅ semua divisi | 👁️ | ✅ |
| `KETUA_UMUM` | 👁️ | ✅ **approve & rilis SK** | ✅ **verify_by_ketum** | ✅ **Approval Board** | 👁️ | ✅ |
| `SEKRETARIS` | 👁️ (jika didelegasikan) | ✏️ CRUD surat | 🚫 | 👁️ | 👁️ | ✅ |
| `BENDAHARA` | 👁️ (jika didelegasikan) | 🚫 | ✅ voucher + `verify_by_bendahara` + laporan | 👁️ | 👁️ | ✅ |
| `DEWAN_PENGAWAS` | 🚫 | 👁️ | 👁️ **live ledger** | 👁️ | 👁️ | 🚫 |
| `DIV_HUMAS` | 🚫 | 🚫 | 🚫 | 🔒 divisi humas | 👁️ | 🔒 |
| `DIV_LITBANG` | 🚫 | 🚫 | 🚫 | 🔒 divisi litbang | 👁️ | 🔒 |
| `DIV_SOSMED` | 🚫 | 🚫 | 🚫 | 🔒 divisi sosmed | 👁️ | 🔒 |
| `DIV_DAKWAH` | 🚫 | 🚫 | 🚫 | 🔒 divisi dakwah | 👁️ | 🔒 |
| `DIV_INVESTASI` | 🚫 | 🚫 | 🚫 | 🔒 divisi investasi | 👁️ | 🔒 |
| `DIV_HUKUM` | 🚫 | 🚫 | 🚫 | 🔒 divisi hukum | 👁️ | 🔒 |
| `DIV_UMUM` | 🚫 | 🚫 | 🚫 | 🔒 divisi umum | 👁️ | 🔒 |
| `PUBLIK_ANGGOTA` | 👁️ sesi sendiri | 🚫 | 🚫 | 🚫 | 👁️ + e-KTA sendiri | 🚫 |

---

## Catatan Penting per Peran

### SUPERADMIN
- Satu-satunya yang bisa `POST /auth/delegation/init` & toggle `can_manage_users`.
- Bisa reset/migrasi database, tapi **tidak** menggantikan approve Ketua Umum (pemisahan tugas).
- Melihat semua audit event via `role:superadmin` room.

### KETUA_UMUM
- **Persetujuan tunggal** untuk: rilis SK (`PENDING_APPROVAL → PUBLISHED`), Approval Board divisi, dan `verify_by_ketum` voucher.
- Veto: bisa menolak dengan catatan (`approval_notes`).

### SEKRETARIS
- Full CRUD surat, tapi **tidak bisa** mempublikasi sendiri (harus approval Ketua).
- Verifikasi berkas lampiran (`ocr_verified` manual review di Fase 1).

### BENDAHARA
- Hanya role yang bisa membuat voucher & melihat laporan bersetempel.
- Dual-approval: Bendahara verify dulu, baru Ketua Umum.

### DEWAN_PENGAWAS
- **Read-only mutlak** — tidak ada endpoint tulis di modul apa pun.
- Akses khusus: live ledger via room `role:dewan_pengawas` + audit trail.
- Bisa mengajukan form usulan sanksi/SP (endpoint khusus, diproses Ketua Umum).

### DIV_* (7 Divisi)
- **Hanya divisi sendiri.** Mencoba akses `/divisions/humas/*` dengan `DIV_DAKWAH` → **403 + audit event**.
- Workflow ketat: `Simpan DRAFT` / `Ajukan PENDING_APPROVAL` saja — **0 publikasi langsung**.

### PUBLIK_ANGGOTA
- Hanya portal publik + data e-KTA sendiri (berdasar `user.id` di token).
- Tidak ada akses modul internal apa pun.


---

## Aturan Delegasi Manajemen Anggota

```
SUPERADMIN ──toggle can_manage_users──▶ KETUA_UMUM / SEKRETARIS / BENDAHARA
                                        │
                                        └──▶ POST /users/invite (tanpa campur tangan IT)
                                                │
                                                └──▶ audit_logs + event AUDIT_SECURITY (room superadmin)
```

- Delegasi **tidak** berlaku untuk role divisi (`DIV_*`) atau `PUBLIK_ANGGOTA`.
- Superadmin dapat mencabut delegasi kapan saja (semua perubahan tercatat di `audit_logs`).
- Pengguna yang diundang menerima email Google OAuth; setelah login pertama, akun aktif dengan role/divisi yang ditentukan pengundang.

---

## Aturan Audit Event

Setiap aksi berikut **wajib** memicu `SecurityAuditEvent` (Redis stream `audit:security` + `audit_logs`):

| Pemicu | severity | Terlihat oleh |
|---|---|---|
| 403 cross-division | `WARNING` | superadmin, dewan_pengawas |
| 403 role kurang | `WARNING` | superadmin, dewan_pengawas |
| Perubahan delegasi | `CRITICAL` | superadmin |
| Undangan pengurus baru | `INFO` | superadmin, pengundang |
| Publikasi SK | `INFO` | semua (event `DOCUMENT_PUBLISHED`) |
| Approval usulan divisi | `INFO` | divisi terkait |
| Mutasi buku kas terverifikasi | `INFO` | bendahara, dewan_pengawas |

---

## Contoh Endpoint → Guard (Fase 1-2)

> Catatan: path berikut mencerminkan kode nyata di `src/modules/*` (auto-sync
> Sprint 1). Sebelumnya tabel ini memakai path placeholder yang tidak pernah
> ada implementasinya (`/auth/google/login`, `/letters/:id/render-pdf`) — sudah
> dikoreksi.

| Endpoint | Guard yang dipasang |
|---|---|
| `GET /api/v1/auth/google` | (publik) — URL otorisasi Google (PKCE) |
| `GET /api/v1/auth/google/callback` | (publik) — set cookie, redirect ke frontend |
| `POST /api/v1/auth/refresh` | (publik, butuh refresh cookie) |
| `GET /api/v1/auth/me` | `JwtAuthGuard` |
| `PATCH /api/v1/auth/me` | `JwtAuthGuard` — ubah nama/foto profil sendiri (FR-AUTH-08) |
| `POST /api/v1/auth/logout` · `/logout-all` | `JwtAuthGuard` |
| `POST /api/v1/users/invite` | `JwtAuthGuard` + `Roles(SUPERADMIN, KETUA_UMUM, SEKRETARIS, BENDAHARA)` + cek `can_manage_users` |
| `PATCH /api/v1/users/:id/role` | `JwtAuthGuard` + `Roles(SUPERADMIN)` |
| `GET /api/v1/official-letters` | `JwtAuthGuard` + `Roles(SEKRETARIS, KETUA_UMUM, SUPERADMIN, DEWAN_PENGAWAS)` |
| `POST /api/v1/official-letters` | `JwtAuthGuard` + `Roles(SEKRETARIS, SUPERADMIN)` |
| `POST /api/v1/official-letters/:id/submit` | `JwtAuthGuard` + `Roles(SEKRETARIS, SUPERADMIN)` |
| `POST /api/v1/official-letters/:id/approve-and-publish` | `JwtAuthGuard` + `Roles(KETUA_UMUM, SUPERADMIN)` |
| `POST /api/v1/official-letters/:id/reject` | `JwtAuthGuard` + `Roles(KETUA_UMUM, SUPERADMIN)` |
| `GET /api/v1/official-letters/:id/render-html` | `JwtAuthGuard` + `Roles(SEKRETARIS, KETUA_UMUM, SUPERADMIN, DEWAN_PENGAWAS)` |
| `GET /api/v1/official-letters/:id/render-pdf` | `JwtAuthGuard` + `Roles(SEKRETARIS, KETUA_UMUM, SUPERADMIN, DEWAN_PENGAWAS)` — PDF on-demand (FR-LETTER-04/05/06) |
| `GET /api/v1/official-letters/:id/download` | `JwtAuthGuard` + `Roles(SEKRETARIS, KETUA_UMUM, SUPERADMIN, DEWAN_PENGAWAS)` — unduh PDF immutable (FR-LETTER-09) |
| `GET /api/v1/finance/vouchers` | `JwtAuthGuard` + `Roles(BENDAHARA, KETUA_UMUM, DEWAN_PENGAWAS)` |
| `POST /api/v1/finance/vouchers` | `JwtAuthGuard` + `Roles(BENDAHARA)` |
| `POST /api/v1/finance/vouchers/:id/verify-ketum` | `JwtAuthGuard` + `Roles(KETUA_UMUM)` |
| `GET /api/v1/divisions/submissions` | `JwtAuthGuard` + `DivisionGuard` (divisi sendiri) atau `Roles(KETUA_UMUM, SUPERADMIN, DEWAN_PENGAWAS)` |
| `POST /api/v1/divisions/submissions/:id/approve` | `JwtAuthGuard` + `Roles(KETUA_UMUM, SUPERADMIN)` |
| `GET /api/v1/public/feed` | (publik) |
| `GET /api/v1/public/schedules` | (publik) |
| `GET /api/v1/public/verify/:sha256` | (publik) |
| `GET /api/v1/public/members/me/e-kta` | `JwtAuthGuard` + `Roles(PUBLIK_ANGGOTA)` |
| `WS /v1/stream/events` | JWT di handshake socket.io (room: `public`, `role:<x>`, `division:<x>`) |
| `POST /api/v1/uploads` | `JwtAuthGuard` (divisi hanya untuk lampiran own-scope) |

---

## Cara Menggunakan Matriks Ini (untuk Developer)

1. **Saat membuat endpoint baru**, tentukan: butuh login? peran apa? divisi sendiri?
2. Pasang decorator guard di controller, **lalu** tambahkan baris ke tabel di atas.
3. Tulis unit test untuk **kedua** kasus: diizinkan & ditolak (403).
4. Jika matriks & kode berbeda → **matriks yang menang** (fix kodenya).
