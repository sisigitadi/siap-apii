# PROJECT_RULES.md — Aturan Pengembangan

**Yayasan APII DPW Jabodetabek — Sistem Informasi & Administrasi Terpadu**

> Aturan main bersama. Dipatuhi sebelum kode ditulis, saat review, dan saat selesai.

---

## 1. Struktur Kode

### 1.1 Backend (Google Apps Script — folder `gas/`)
| File | Tanggung Jawab | Dilarang |
|---|---|---|
| `Code.gs` | `doGet`/`doPost`, parsing request, **tabel `ROUTES`**, dispatch, envelope response | menulis logika domain |
| `Auth.gs` | login, hash password, buat/verifikasi/hapus sesi | mengakses Sheet selain Users/Sessions |
| `Surat.gs` | logika surat + nomor surat + generate PDF | mengakses Sheet Keuangan/Divisi |
| `Keuangan.gs` | logika voucher + dual-approval + saldo | mengakses Sheet Surat/Divisi |
| `Divisi.gs` | logika usulan divisi + isolasi divisi | menerima `division` dari payload |
| `Database.gs` | satu-satunya yang menyentuh `SpreadsheetApp` | dipanggil dari luar modul domain |
| `Utils.gs` | audit log, format tanggal/Rupiah, helper umum | memegang state bisnis |

### 1.2 Frontend (folder `public/` & `portal/`)
- Setiap file = satu modul IIFE (`Auth`, `App`, `Public`) — tidak ada variabel global liar.
- **Pemisahan wajib:** State (`App.state`) / API (`Auth.fetch`) / DOM (fungsi `render*`).
- Tidak ada inline `onclick` di HTML — binding event dilakukan setelah render.
- Template HTML string dipakai untuk render; setelah render, lakukan `bindEvents()`.

---

## 2. Konvensi Penamaan & Gaya

- **Bahasa Indonesia** untuk: pesan error, label UI, status, komentar fungsi publik.
- **Bahasa Inggris** untuk: nama fungsi, variabel, kolom Sheet, nama aksi router (`camelCase`).
- Konstanta global di GAS: `UPPER_SNAKE_CASE` (`ROUTES`, `ROLES`, `DIVISIONS`).
- Setiap fungsi GAS publik (handler) wajib komentar 1-3 baris: _apa, siapa yang boleh, output_.
- Status enum: `UPPER_SNAKE_CASE` (`PENDING_APPROVAL`, `VERIFIED_BY_BENDAHARA`).

---

## 3. Keamanan (Wajib)

1. **Tidak pernah** percaya input frontend: role/divisi selalu dari `ctx.user` (hasil verifikasi token).
2. Setiap aksi baru wajib daftar di tabel `ROUTES` dengan `auth` + `roles` — tidak ada handler "publik" yang menulis data.
3. Setiap penolakan akses → `Utils.audit(..., 'FORBIDDEN', ...)` sebelum lempar error.
4. Password: hanya hash SHA-256+salt; tidak pernah log/return plain-text.
5. Secret (Spreadsheet ID, folder Drive, salt) **hanya** di Script Properties — tidak di-commit.
6. Frontend: token di `localStorage`; saat `success === false` dengan pesan sesi → auto-logout.

---

## 4. Response Envelope

Semua handler mengembalikan objek (router yang bungkus ke JSON):
```js
return { ok: true,  data: {...}, message: 'Surat berhasil dibuat.' };
return { ok: false, data: null,  message: 'Nomor surat sudah digunakan.' };
```
Router menulis `{ success, data, message }`. Frontend **hanya** cek `success`.

---

## 5. Testing & Validasi

- **Tidak ada framework test otomatis** (biaya setup melebihi manfaat untuk skala ini). Gantinya:
  1. Setiap handler dieksekusi manual via "Test function" di editor Apps Script setelah diubah.
  2. Setiap perubahan state machine diuji untuk **semua transisi ilegal** (mis. approve surat DRAFT → harus gagal + audit).
  3. Setiap aksi RBAC diuji login sebagai peran yang ditolak → harus `success: false`.
  4. Isolasi divisi diuji: ketua divisi A akses divisi B → harus `success: false` + `FORBIDDEN`.
  5. Frontend: buka di Chrome + mobile viewport; cek menu disembunyikan sesuai peran.
- **Wajib** jalankan `setup()` sekali di spreadsheet baru sebelum demo/aplikasi apapun.

---

## 6. Workflow Git & Commit

- Commit pesan: `<tipe>: <deskripsi singkat>` — tipe: `feat`, `fix`, `docs`, `refactor`, `style`.
- Contoh: `feat: tambah aksi rejectVoucher dengan catatan wajib`.
- Satu commit = satu perubahan fokus. Jangan campur fitur baru dengan perbaikan typo massal.
- Branch: `main` untuk siap-demo; kerja fitur besar di branch `feat/<nama>`.

---

## 7. Aturan Kompleksitas (Cegah Over-Engineering)

- **Sebelum** menambahkan sesuatu, tanya: apakah ini menyelesaikan masalah nyata pengurus hari ini?
- Jika tidak, catat di bagian "Ditangguhkan" `DESIGN.md` §12 dengan pemicu aktivasi, lalu lanjut.
- Dilarang: menambah library/dependency tanpa persetujuan; membuat abstraksi untuk dipakai sekali.
- `Database.gs` adalah **satu-satunya** abstraksi yang dibayar mahal — karena memungkinkan ganti backend data tanpa sentuh domain.

---

## 8. Checklist Selesai (Definition of Done)

Sebelum sebuah fitur dianggap selesai:
- [ ] Handler terdaftar di `ROUTES` + matriks `rbac-matrix.md` diupdate.
- [ ] Isolasi divisi & read-only ditegakkan di backend (bukan cuma frontend).
- [ ] Audit event dicatat untuk aksi penting & penolakan.
- [ ] Frontend menyembunyikan menu/tombol sesuai peran.
- [ ] Pesan error/sukses dalam Bahasa Indonesia dan jelas.
- [ ] Diuji manual sesuai §5; `setup()` berjalan bersih di spreadsheet baru.
- [ ] Tidak ada hardcoded ID/secret; semua via Script Properties.

---

## 9. Aturan Dokumentasi

- `README.md` — cara setup & deploy (pintu masuk).
- `docs/PRD.md` — **APA** yang dibangun (kebutuhan, scope, user story).
- `docs/DESIGN.md` — **BAGAIMANA** (arsitektur, skema, keputusan teknis).
- `docs/rbac-matrix.md` — **SIAPA** boleh **APA**.
- `docs/PROJECT_RULES.md` — aturan main (dokumen ini).

> Urutan baca baru join: `README` → `PRD` → `DESIGN` → `rbac-matrix` → `PROJECT_RULES`.

*Aturan ini menjaga kualitas tanpa memperlambat. Jika sebuah aturan menghambat penyelesaian masalah pengguna, bicarakan — bukan diam-diam dilanggar.*
