# Matriks RBAC — Izin per Peran

**Yayasan APII DPW Jabodetabek — Sistem Informasi & Administrasi Terpadu**

> Sumber kebenaran izin akses. Setiap aksi router baru **wajib** didaftarkan di sini dan di tabel `ROUTES` `Code.gs`.

**Legenda:**
- `✏️` = baca + tulis (create/update)
- `👁️` = read-only
- `✅` = akses penuh (termasuk approve/publish)
- `🚫` = tidak ada akses (ditolak + audit event `FORBIDDEN`)
- `🔒` = hanya divisi sendiri (isolasi divisi)

---

## Matriks Utama: 9 Peran × Modul

| Peran | auth (kelola akun) | surat | keuangan | divisi | portal publik | audit log |
|---|---|---|---|---|---|---|
| `SUPERADMIN` | ✅ kelola semua akun | ✏️ + konfigurasi template | 👁️ + reset | ✅ semua divisi | 👁️ | ✅ |
| `KETUA` | 👁️ | ✅ **approve & rilis surat** | ✅ **verifikasi final voucher** | ✅ **Approval Board** | 👁️ | 👁️ |
| `SEKRETARIS` | 👁️ | ✏️ **CRUD + ajukan surat** | 🚫 | 👁️ semua divisi | 👁️ | 🚫 |
| `BENDAHARA` | 👁️ | 🚫 | ✏️ **voucher + verifikasi tahap 1** | 👁️ semua divisi | 👁️ | 🚫 |
| `PEMBINA` | 🚫 | 👁️ | 👁️ | 👁️ semua divisi | 👁️ | 🚫 |
| `PENGAWAS` | 🚫 | 👁️ | 👁️ | 👁️ semua divisi | 👁️ | 🚫 |
| `KETUA_DIVISI` | 🚫 | 🚫 | 🚫 | 🔒 **divisi sendiri** (CRUD + ajukan) | 👁️ | 🚫 |
| `ANGGOTA_DIVISI` | 🚫 | 🚫 | 🚫 | 🔒 **divisi sendiri** (create + ajukan) | 👁️ | 🚫 |
| `ANGGOTA_BIASA` | 👁️ akun sendiri | 🚫 | 🚫 | 🚫 | 👁️ + verifikasi surat | 🚫 |

---

## Matriks Detail per Aksi Router

### Modul Autentikasi (`Auth.gs`)
| Aksi | SUPERADMIN | KETUA | SEKRETARIS | BENDAHARA | PEMBINA | PENGAWAS | KETUA_DIVISI | ANGGOTA_DIVISI | ANGGOTA_BIASA |
|---|---|---|---|---|---|---|---|---|---|
| `login` | ✅ publik | ✅ publik | ✅ publik | ✅ publik | ✅ publik | ✅ publik | ✅ publik | ✅ publik | ✅ publik |
| `logout` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `me` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `getListPengguna` | ✅ | 👁️ | 👁️ | 👁️ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| `createPengguna` | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| `updatePengguna` | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| `getAuditLogs` | ✅ | 👁️ | 🚫 | 🚫 | 🚫 | 👁️ | 🚫 | 🚫 | 🚫 |

### Modul Persuratan (`Surat.gs`)
| Aksi | SUPERADMIN | KETUA | SEKRETARIS | BENDAHARA | PEMBINA | PENGAWAS | KETUA/ANGGOTA DIVISI | ANGGOTA_BIASA |
|---|---|---|---|---|---|---|---|---|
| `getListSurat` | ✅ | ✅ | ✅ | 👁️ | 👁️ | 👁️ | 🚫 | 🚫 |
| `createSurat` | ✅ | 🚫 | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| `updateSurat` | ✅ (hanya DRAFT) | 🚫 | ✅ (hanya DRAFT) | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| `submitSurat` | ✅ | 🚫 | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| `approveSurat` | ✅ | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| `rejectSurat` | ✅ | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| `verifySurat` | ✅ publik | ✅ publik | ✅ publik | ✅ publik | ✅ publik | ✅ publik | ✅ publik | ✅ publik |
| `getLetterTemplates` | ✅ | ✅ | ✅ | 👁️ | 👁️ | 👁️ | 🚫 | 🚫 |
| `saveLetterTemplate` | ✅ | 🚫 | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| `deleteLetterTemplate` | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |

### Modul Keuangan (`Keuangan.gs`)
| Aksi | SUPERADMIN | KETUA | SEKRETARIS | BENDAHARA | PEMBINA | PENGAWAS | DIVISI | ANGGOTA_BIASA |
|---|---|---|---|---|---|---|---|---|
| `getListKeuangan` | ✅ | ✅ | 🚫 | ✅ | 👁️ | 👁️ | 🚫 | 🚫 |
| `getSaldo` | ✅ | ✅ | 🚫 | ✅ | 👁️ | 👁️ | 🚫 | 🚫 |
| `createVoucher` | ✅ | 🚫 | 🚫 | ✅ | 🚫 | 🚫 | 🚫 | 🚫 |
| `verifyVoucherBendahara` | ✅ | 🚫 | 🚫 | ✅ | 🚫 | 🚫 | 🚫 | 🚫 |
| `verifyVoucherKetum` | ✅ | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| `rejectVoucher` | ✅ | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |

### Modul Divisi (`Divisi.gs`)
| Aksi | SUPERADMIN | KETUA | SEKRETARIS | BENDAHARA | PEMBINA | PENGAWAS | KETUA_DIVISI | ANGGOTA_DIVISI | ANGGOTA_BIASA |
|---|---|---|---|---|---|---|---|---|---|
| `getListDivisi` | ✅ semua | ✅ semua | ✅ semua | ✅ semua | ✅ semua | ✅ semua | 🔒 sendiri | 🔒 sendiri | 🚫 |
| `createSubmission` | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🔒 sendiri | 🔒 sendiri | 🚫 |
| `updateSubmission` | ✅ (DRAFT) | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🔒 (DRAFT) | 🔒 (DRAFT) | 🚫 |
| `ajukanSubmission` | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🔒 sendiri | 🔒 sendiri | 🚫 |
| `approveSubmission` | ✅ | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| `rejectSubmission` | ✅ | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |

### Dashboard
| Aksi | Semua peran login |
|---|---|
| `getDashboard` | ✅ (statistik difilter otomatis sesuai peran & divisi) |

---

## Catatan Penting per Peran

### SUPERADMIN
- Satu-satunya yang bisa membuat/mengubah/mencabut akun + melihat `Sheet_AuditLogs`.
- Bisa reset data, tapi **tidak boleh** menggantikan approve Ketua (pemisahan tugas — `approveSurat` tetap butuh peran KETUA/SUPERADMIN, namun secara operasional diserahkan ke Ketua).

### KETUA
- **Persetujuan tunggal** untuk: rilis surat (`PENDING_APPROVAL → PUBLISHED` + PDF), Approval Board divisi, dan verifikasi final voucher (`VERIFIED_BY_BENDAHARA → APPROVED`).
- Veto: bisa menolak dengan catatan wajib (`rejection_notes` / `approval_notes`).
- Bisa melihat daftar **Master Template Surat** (termasuk tautan master PDF di Drive) tetapi **read-only** — `saveLetterTemplate` menolak peran ini, sehingga kartu manajemen tidak memunculkan tombol Ubah/Hapus. Rilis 2.5.0.

### SEKRETARIS
- Full CRUD surat, tapi **tidak bisa** mempublikasi sendiri (wajib approval Ketua).
- Bisa edit nomor surat hanya saat status `DRAFT`.
- Bisa membuat/mengubah **Master Template Surat** (`saveLetterTemplate`), sehingga menu **Pengaturan & Master** kini tersedia untuk peran ini — namun **hanya sub-tab `🧩 Master Template Surat`** yang ditampilkan; sub-tab lain (Rekening, Format & KOP, Pendaftaran, Keuangan, Redaksi, RBAC, Drive) disembunyikan. Rilis 2.5.0.

### BENDAHARA
- Hanya peran yang bisa membuat voucher & verifikasi tahap 1.
- Dual-approval: Bendahara verify dulu, baru Ketua verifikasi final.

### PEMBINA
- **Read-only mutlak** atas seluruh dokumen & laporan (surat, buku kas, usulan divisi, daftar pengurus) — tidak ada aksi tulis.
- Frontend **tidak merender** tombol aksi apa pun.

### PENGAWAS
- **Read-only mutlak** — tidak ada aksi tulis di modul apa pun.
- Bisa melihat jejak audit (`getAuditLogs`) untuk pengawasan.

### KETUA_DIVISI / ANGGOTA_DIVISI
- **Hanya divisi sendiri.** Mencoba akses data divisi lain → **ditolak + audit event `FORBIDDEN`**.
- Divisi diambil dari `user.division` (token), **bukan** dari payload frontend.
- Workflow ketat: `Simpan DRAFT` / `Ajukan` saja — **0 publikasi langsung**.

### ANGGOTA_BIASA
- Hanya portal publik + verifikasi surat. Tidak ada akses modul internal.

---

## Audit Event per Aksi

| Aksi / Event | Audit Action | Pelaku tercatat |
|---|---|---|
| Login berhasil | `LOGIN_SUCCESS` | username |
| Login gagal | `LOGIN_FAILED` | username percobaan |
| Akses ditolak (RBAC/isolasi) | `FORBIDDEN` | username + aksi |
| Surat diajukan | `SURAT_SUBMIT` | sekretaris |
| Surat dipublikasi | `SURAT_PUBLISHED` | ketua |
| Surat ditolak | `SURAT_REJECTED` | ketua |
| Voucher diverifikasi bendahara | `KEU_VERIFY_BENDAHARA` | bendahara |
| Voucher diverifikasi ketua | `KEU_VERIFY_KETUM` | ketua |
| Voucher ditolak | `KEU_REJECTED` | ketua |
| Usulan diajukan | `DIVISI_AJUKAN` | anggota divisi |
| Usulan disetujui | `DIVISI_SETUJU` | ketua |
| Usulan ditolak | `DIVISI_TOLAK` | ketua |
| Akun dibuat/diubah | `USER_CREATE` / `USER_UPDATE` | superadmin |

---

## Cara Menggunakan Matriks Ini (untuk Developer)

1. **Saat membuat aksi router baru**, tentukan: butuh login? peran apa? divisi sendiri?
2. Tambahkan baris ke tabel `ROUTES` di `Code.gs` **dan** ke matriks ini.
3. Pastikan frontend menyembunyikan (bukan sekadar menonaktifkan) menu/tombol yang tidak diizinkan.
4. Jika matriks & kode berbeda → **matriks yang menang** (fix kodenya).
