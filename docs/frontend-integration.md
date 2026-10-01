# Panduan Integrasi Frontend SPA (SIAP APII)

**Sistem Informasi & Administrasi Terpadu Yayasan APII DPW Jabodetabek**

Dokumen ini ditujukan untuk tim pengembang Frontend SPA (`https://app.apii.sigitadi.id`) guna mempermudah konsumsi REST API dan real-time WebSocket yang disediakan oleh backend SIAP APII.

---

## 1. Spesifikasi Endpoint & Base URL

| Lingkungan | Base URL REST API | Endpoint WebSocket | OpenAPI Docs |
|---|---|---|---|
| **Development** | `http://localhost:3000/api/v1` | `ws://localhost:3000/v1/stream/events` | `http://localhost:3000/api/v1/docs` |
| **Production** | `https://apii.sigitadi.id/api/v1` | `wss://apii.sigitadi.id/v1/stream/events` | `https://apii.sigitadi.id/api/v1/docs` |

---

## 2. Format Respon Standar (Envelope)

Semua endpoint REST backend SIAP APII mengembalikan format payload JSON yang seragam:

### 2.1 Respon Sukses (HTTP 200 / 201)
```json
{
  "success": true,
  "code": 200,
  "message": "Resource successfully fetched",
  "data": {
    "id": "cm...",
    "title": "Kajian Rutin DPW"
  },
  "meta": {
    "timestamp": 1770000000
  }
}
```

### 2.2 Respon Galat (HTTP 4xx / 5xx)
```json
{
  "success": false,
  "code": 403,
  "message": "Akses divisi ditolak",
  "error": "ForbiddenException",
  "meta": {
    "timestamp": 1770000000
  }
}
```

---

## 3. Otentikasi & Manajemen Sesi

Backend menerapkan otentikasi hybrid: **HttpOnly Refresh Cookie** dan **Bearer Access Token (RS256)**:

### 3.1 Alur Login Google OAuth 2.0 PKCE
1. Frontend memanggil `GET /api/v1/auth/google/url?code_challenge=...` untuk mendapatkan URL otorisasi Google.
2. Pengguna dialihkan ke Google Login.
3. Google mengalihkan kembali ke `GET /api/v1/auth/google/callback?code=...&state=...`.
4. Backend mengeluarkan:
   - `accessToken` pada body respon (atau redirect ke frontend).
   - Cookie `refreshToken` (HttpOnly, Secure, SameSite=Lax).

### 3.2 Pembaruan Token (Silent Refresh)
Setiap kali `accessToken` kedaluwarsa (15 menit), frontend memanggil:
```http
POST /api/v1/auth/refresh
Credentials: include
```
Backend akan memvalidasi cookie `refreshToken` dan mengembalikan `accessToken` baru.

---

## 4. Integrasi Real-Time WebSocket (`socket.io-client`)

Koneksi real-time digunakan untuk notifikasi approval program, mutasi kas, publikasi surat, dan audit keamanan.

```typescript
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('https://apii.sigitadi.id', {
  path: '/v1/stream/events',
  auth: {
    token: accessToken, // RS256 Bearer Token
  },
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('Terhubung ke WebSocket SIAP APII:', socket.id);
});

// Mendengarkan notifikasi usulan program yang disetujui
socket.on('PROGRAM_APPROVED', (event) => {
  console.log('Program disetujui:', event);
});

// Mendengarkan notifikasi mutasi buku kas
socket.on('CASHBOOK_MUTATED', (event) => {
  console.log('Mutasi kas baru:', event);
});
```

---

## 5. Menghasilkan Tipe TypeScript dari `docs/openapi.json`

Frontend dapat menghasilkan tipe TypeScript dan fetch client secara otomatis menggunakan [openapi-typescript](https://github.com/openapi-ts/openapi-typescript):

```bash
# Di project frontend:
npx openapi-typescript ../siap-apii/docs/openapi.json -o ./src/types/api.d.ts
```

Dengan langkah ini, seluruh tipe data DTO, enum 13 peran, divisi, status dokumen, dan respons envelope terjamin sinkron 100% dengan backend.
