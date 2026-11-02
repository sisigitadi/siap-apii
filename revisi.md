# REVISI.MD — Lembar Kerja & Status Implementasi (by ZettBOT)
================================================================================
STATUS: SEMUA FASE AUDIT SELESAI DITERAPKAN & TERVERIFIKASI (PASS 100%)
SOP: PLAN -> APPROVAL -> SURGICAL EXECUTION -> CLEANUP & SYNC TO PRD.MD
================================================================================

Seluruh 4 tahapan audit logika, alur kerja, dan UI/UX telah dieksekusi secara bedah (surgical) dan divalidasi penuh oleh test suite:
- `validate-routes-whitelist.mjs`: 65/65 routes OK, 135 handler whitelisted.
- `smoke:backend`: 66/66 test PASS.
- `smoke:auth`: 85/85 test PASS.
- `check:frontend`: 5 berkas bersih, 0 temuan global leaks.
- `smoke:portal`: 15/15 demo guard PASS.
- `build-apps-script.ps1`: 16 modul terkompilasi bersih (378.230 karakter, 0 namespace tertinggal).

---

### RINGKASAN TINDAKAN BEDAH YANG TELAH DITERAPKAN

1. **Fase 1: Integritas Naskah Surat & Rejection Loop Persuratan**
   - [x] **[portal/portal.js]**: Parse `item.content` (menimbang, mengingat, memutuskan) dan prefill ke textarea pada modal `suratForm`, serta pastikan content terkirim saat mode edit untuk mencegah konsideran hukum terhapus.
   - [x] **[gas/Surat.gs]**: Longgarkan validasi status pada `updateSurat` dan `submitSurat` agar mendukung status `REJECTED`, serta bersihkan catatan penolakan lama saat naskah diajukan ulang ke Ketua DPW.
   - [x] **[portal/portal.js]**: Tampilkan tombol aksi "Ubah" dan "Ajukan" pada baris surat berstatus `REJECTED`.

2. **Fase 2: Hak Kelola & Rejection Loop Usulan Divisi Kerja**
   - [x] **[gas/Divisi.gs]**: Aktifkan hak `can_edit` dan `can_submit` bila status usulan `DITOLAK`.
   - [x] **[gas/Divisi.gs]**: Perbarui `assertOwnDivision_` dan `ajukanSubmission` agar mengizinkan revisi dan pengajuan ulang usulan `DITOLAK` ke Approval Board Ketua.

3. **Fase 3: Validasi NIK, Penyelarasan WA, & Action Inbox Calon Anggota**
   - [x] **[gas/Auth.gs]**: Tambahkan validasi 16 digit numerik (`/^\d{16}$/`) dan pencegahan duplikasi pendaftaran NIK aktif di `Sheet_Pendaftar`.
   - [x] **[gas/Auth.gs]**: Tambahkan notifikasi email otomatis ke Sekretaris saat pendaftaran baru masuk, ke Ketua saat berkas diverifikasi, dan ke calon anggota saat disahkan atau ditolak.
   - [x] **[gas/Utils.gs]**: Integrasikan antrean calon anggota baru dari `Sheet_Pendaftar` ke dalam `getDashboard` Action Inbox untuk peran `SEKRETARIS` (verifikasi berkas) dan `KETUA` (pengesahan final).
   - [x] **[portal/portal.js]**: Arahkan navigasi klik Action Inbox calon anggota langsung ke tab Pendaftar di modul Manajemen Pengguna.
   - [x] **[portal/portal.js]**: Perbaiki mismatch field generator WhatsApp (`k.verified_by_ketum` dan `d.approval_notes`).

4. **Fase 4: Pembersihan UI/UX & Standarisasi Enterprise ZettBOT**
   - [x] **[portal/portal.js]**: Ganti emoji mentah pada elemen input dan tab navigasi dengan ikon SVG inline bergaya Tailwind/Lucide.
   - [x] **[gas/Utils.gs]**: Perbarui template email notifikasi resmi agar menggunakan URL domain dinamis dan menghapus placeholder kontak hardcoded.
   - [x] **[prd.md]**: Catat seluruh pembaruan pada Living Master Context (Official Update Log).

5. **Fase 5: Audit Arsitektur RetroBOT & Optimasi Sistem (v2.5.1 - 2026-10-28)**
   - [x] **[gas/Auth.gs]**: Standardisasi format `expired_at` sesi demo ke epoch ms dan lazy single-row cleanup (K2).
   - [x] **[gas/Auth.gs]**: Eliminasi pemindaian tabel `Sheet_Sessions` penuh pada `verifySession` (K5).
   - [x] **[gas/Utils.gs]**: Optimasi `getDashboard` menghilangkan duplikasi `readAll(TABS.KEUANGAN)` (K3).
   - [x] **[gas/Keuangan.gs & gas/Utils.gs]**: Resolusi dinamis label rekening via `getAccountLabels_()` (T1).
   - [x] **[portal/config.js]**: Sinkronisasi akun demo `ahumas` -> `ahumas1` (T2).
   - [x] **[portal/portal.js]**: Perbaikan komentar penelan klausa ternary dan operator ganda `+ +` pada approval bar L1646.
   - [x] **[gas/Database.gs & gas/Visitor.gs]**: Implementasi TextFinder fast-path pada `Database.findOne` (T5).
   - [x] **[gas/Code.gs]**: Rate limiting endpoint publik berbasis `CacheService` 60s sliding window (K6).
   - [x] **[gas/Code.gs]**: Inisialisasi otomatis `PASSWORD_SALT` ke Script Properties di `setup()` (K4).
   - [x] **[scripts/build-apps-script.mjs]**: Migrasi build Apps Script ke Node.js cross-platform (T4).

6. **Fase 6: Audit & Resolusi Sesi Superadmin & Sinkronisasi Lintas Device (v2.5.2 - Release 27)**
   - [x] **[gas/Database.gs]**: Perbaikan `Database.findOne` TextFinder race condition delay; jika TextFinder tidak langsung menemukan sel baru, fallback aman ke array scan `readAll()` agar verifikasi sesi baru tidak bernilai `null`.
   - [x] **[gas/Database.gs]**: Penyempurnaan `matchFilter_` untuk komparasi string/number dengan `String(...).trim()` guna menghindari inkonsistensi tipe data sel Spreadsheet.
   - [x] **[gas/Database.gs & gas/Pengaturan.gs]**: Penambahan `SpreadsheetApp.flush()` di `insert()`, `updateRow()`, `deleteRow()`, dan `saveSettings()` untuk menjamin seluruh penulisan data langsung committed ke penyimpanan Google Sheets.
   - [x] **[gas/Auth.gs]**: Penambahan resilient username lookup di `verifySession()`: jika pencarian `user_id` gagal akibat latensi indeks baris baru, sistem fallback ke pencarian `username`.
   - [x] **[portal/portal.js]**: Eliminasi jebakan hash URL `#login` di `bootApp()`, `bindLogin()`, dan `demoLoginBtn`. Transisi rute langsung diarahkan ke `#/dashboard` saat login berhasil.
   - [x] **[portal/auth.js & public/app.js]**: Penambahan query param anti-cache `&_t=` timestamp dinamis dan header `cache: 'no-store'` pada seluruh request `GET` di portal pengurus dan publik untuk mencegah browser HP/desktop menyajikan respon usang.
   - [x] **[portal/auth.js]**: Pembersihan total in-memory cache frontend (`self.cache.clear()`) setelah mutasi data `POST` berhasil.
   - [x] **[gas/Pengaturan.gs]**: Sinkronisasi dua arah konfigurasi pendaftaran anggota (`registration_config` <-> `registration_*` flattened keys) pada `getSettings`, `saveSettings`, dan `getPublicSettings`.

