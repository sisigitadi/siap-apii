# PRD — Product Requirements Document

# Sistem Informasi & Administrasi Terpadu Yayasan APII DPW Jabodetabek

| Field | Nilai |
|---|---|
| **Produk** | Portal administrasi Yayasan APII DPW Jabodetabek (backend Google Apps Script + frontend HTML/JS) |
| **Versi** | 2.0 (Demo Production-Ready) |
| **Status** | Disetujui untuk pengembangan |
| **Penulis** | Tim Arsitektur & Backend |
| **Dokumen terkait** | `DESIGN.md` (teknis) · `PROJECT_RULES.md` (aturan) · `rbac-matrix.md` (izin) · `../README.md` (mulai) |

---

## 1. Ringkasan Eksekutif

### 1.1 Masalah yang Dipecahkan
Yayasan APII DPW Jabodetabek saat ini mengelola administrasi — persuratan, keuangan, usulan program 7 divisi, dan kartu anggota — secara **manual dan terpencar** (chat WhatsApp, spreadsheet acak, kertas). Akibatnya:

- **Nomor surat tidak teratur** dan mudah dobel/tanggal;
- **Buku kas sulit dilacak**, tidak ada verifikasi ganda, rekonsiliasi bank merepotkan;
- **Usulan divisi mengendap** tanpa status jelas (siapa yang menunggu persetujuan apa);
- **Keabsahan dokumen diragukan** — tidak ada cara memverifikasi surat asli vs palsu;
- **Pengurus baru bingung** karena tidak ada sistem yang memandu langkah-langkahnya.

### 1.2 Visi Produk
> **"Satu portal terpadu tempat pengurus yayasan — siapa pun yang tidak mengerti IT — bisa mengurus surat, keuangan, dan program divisi dengan tenang, jelas, dan terlindungi."**

### 1.3 Prinsip Produk
Karena pengguna sebagian besar **belum terbiasa administrasi digital**, produk ini memegang prinsip:

1. **Jelas daripada lengkap.** Lebih baik sedikit fitur yang dipahami, daripada banyak fitur yang tidak terpakai.
2. **Pandu, jangan membebani.** Setiap layar menunjukkan langkah selanjutnya dan status saat ini dalam Bahasa Indonesia.
3. **Aman secara default.** Pengguna tidak perlu "mikir" keamanan — hak akses dan jejak audit bekerja di belakang layar.
4. **Terpercaya & dapat diverifikasi.** Setiap dokumen resmi dapat dicek keasliannya secara publik.

### 1.4 Solusi Singkat
Sebuah **backend Google Apps Script** yang merespons JSON melalui `doGet`/`doPost`, dengan **Google Sheets** sebagai database dan **Google Drive** sebagai penyimpanan dokumen. Frontend terbagi dua domain: **portal publik** (`apii.sigitadi.id`) dan **portal pengurus** (`siapii.sigitadi.id`). Detail teknis ada di `DESIGN.md`; dokumen ini berfokus pada **kebutuhan pengguna dan produk**.

---

## 2. Tujuan & Metrik Keberhasilan

### 2.1 Tujuan Bisnis
| # | Tujuan | Bagaimana Diukur |
|---|---|---|
| G1 | Mengakhiri penomoran surat manual yang kacau | 100% surat resmi memakai nomor otomatis berurutan |
| G2 | Membuat keuangan transparan & terverifikasi ganda | Setiap transaksi memiliki tanda tangan Bendahara **dan** Ketua |
| G3 | Menghilangkan kebingungan status usulan divisi | Pengurus bisa lihat status 100% usulan |
| G4 | Memberi kepastian keaslian dokumen | Verifikasi publik nomor/SHA-256 aktif untuk semua surat resmi |
| G5 | Onboarding pengurus baru tanpa drama | Superadmin/ketua membuat akun langsung, tanpa menunggu IT |

### 2.2 Metrik Sukses (setelah 3 bulan penggunaan)
| Metrik | Target | Cara Ukur |
|---|---|---|
| **Adopsi pengurus aktif** | ≥ 80% pengurus login & melakukan ≥1 aksi/bulan | Audit `Sheet_Sessions` |
| **Surat dibuat di sistem** | ≥ 90% surat resmi dibuat lewat portal | Counter baris `Sheet_Surat` |
| **Rata-rata waktu selesai surat** | Dari draft → rilis ≤ 3 hari kerja | Selisih `created_at` → status `PUBLISHED` |
| **Selisih saldo buku kas** | 0 (nol) selisih antara sistem & rekening bank | Rekonsiliasi bulanan |
| **Kasus dokumen palsu** | Verifikasi publik bisa dipakai; 0 kasus tidak terverifikasi | Log aksi `verifySurat` |
| **Tiket "bagaimana caranya"** | Menurun ≥ 50% bulan ke-3 | Catatan tim pendamping |

### 2.3 Anti-Metrik (yang kita HINDARI)
- ❌ Banyaknya fitur mewah — **bukan** indikator sukses di fase ini.
- ❌ Jumlah endpoint API — kompleksitas tambahan dianggap **utang**, bukan pencapaian.

---

## 3. Pengguna Target (Personas)

Ada 9 peran teknis (lihat `rbac-matrix.md`), dikelompokkan menjadi **5 persona produk** agar kebutuhannya jelas.

### 3.1 Persona A — "Pengurus Inti" (Ketua, Sekretaris, Bendahara)
- **Profil:** Pengurus harian yayasan. Usia 35–60 tahun. Menggunakan WhatsApp & email setiap hari, tapi **jarang sekali** memakai aplikasi administrasi web.
- **Frustrasi saat ini:** Nomor surat berantakan; harus menandatangani dokumen fisik berkali-kali; lupa siapa yang harus approve; kas sulit dilacak.
- **Keinginan:** Melihat semua yang butuh tindakannya di **satu layar**, lalu menyetujui/menolak dengan **satu tombol**.
- **Kebutuhan kunci:** Dasbor agregat, antrian persetujuan, pencarian dokumen cepat.
- **Kutipan:** _"Saya cuma mau tahu: apa yang harus saya tanda tangani hari ini, dan mana yang sudah selesai."_

### 3.2 Persona B — "Admin Divisi" (Koordinator 7 divisi)
- **Profil:** Relawan yang mengelola program divisinya (Humas, Litbang, Sosmed, Dakwah, Investasi, Hukum, Umum). Menulis proposal & laporan kegiatan.
- **Frustrasi saat ini:** Usulan dikirim via chat lalu hilang; tidak tahu sudah sampai tahap mana; divisi lain bisa lihat berkasnya.
- **Keinginan:** Tempat mengusulkan program dengan status yang jelas, dan **hanya divisi saya** yang bisa melihat data divisi saya.
- **Kebutuhan kunci:** Form usulan per divisi, indikator status real-time, riwayat usulan.
- **Kutipan:** _"Saya mau tahu proposal saya sudah masuk ke tangan siapa, tanpa harus nanya-nanya."_

### 3.3 Persona C — "Dewan Pembina & Pengawas" (read-only)
- **Profil:** Tokoh senior yang mengawasi, bukan operasional. Butuh transparansi tanpa harus belajar operasi sistem.
- **Keinginan:** Bisa **melihat** buku kas, surat, dan usulan **tanpa bisa mengubah** apa pun.
- **Kebutuhan kunci:** Akses baca saja ke semua modul, tampilan ringkas, **tidak ada tombol aksi**.
- **Kutipan:** _"Saya ingin memantau, bukan dipaksa jadi operator."_

### 3.4 Persona D — "Anggota Publik" (masyarakat & pemegang kartu anggota)
- **Profil:** Anggota biasa yayasan dan masyarakat umum yang menerima surat resmi.
- **Frustrasi saat ini:** Sulit memastikan keaslian surat yang diterima; jadwal kegiatan tidak jelas.
- **Keinginan:** Buka portal → cek **keaslian surat** dengan memasukkan nomor, kapan saja.
- **Kebutuhan kunci:** Portal publik tanpa login, form verifikasi surat.
- **Kutipan:** _"Saya ingin tahu surat yang saya terima benar-benar resmi dari Yayasan."_

### 3.5 Persona E — "Superadmin / Tim IT"
- **Profil:** Operator teknis kecil (1–2 orang). Bertanggung jawab membuat sistem berjalan.
- **Frustrasi saat ini:** Setiap ada pengurus baru, semua nunggu dia setup akun manual.
- **Keinginan:** Setup sekali (database, template surat, akun inti), lalu **delegasikan** manajemen anggota ke pimpinan.
- **Kebutuhan kunci:** Konfigurasi terpusat (Script Properties), kelola akun, jejak audit keamanan.
- **Kutipan:** _"Saya ingin setup sekali, lalu pimpinan bisa kelola sendiri tanpa telepon saya."_

---

## 4. Ruang Lingkup (Scope)

### 4.1 Dalam Ruang Lingkup (yang DIBANGUN)

| Modul | Singkatnya |
|---|---|
| **Autentikasi & Kelola Akun** | Login username/password, session token aman, kelola anggota oleh superadmin |
| **Persuratan Resmi** | Nomor surat otomatis, editor isi, state machine ketat, generate PDF dari template Docs |
| **Keuangan** | Buku kas, voucher dual-approval, saldo otomatis |
| **Workflow 7 Divisi** | Usulan program per divisi, status real-time, persetujuan oleh Ketua |
| **Portal Publik** | Landing page yayasan + verifikasi keaslian surat (tanpa login) |
| **Audit & Keamanan** | Setiap aksi ditolak/izin dicetak di `Sheet_AuditLogs` |

### 4.2 Di Luar Ruang Lingkup — DITANGGUHKAN (lihat `DESIGN.md §12`)
Item berikut **sengaja tidak dibangun** di fase awal. Bukan dibuang — dicatat dengan pemicu aktivasi:

| Item | Kapan Dipakai Kembali |
|---|---|
| Login dengan akun Google (SSO) | Saat seluruh pengurus sudah siap bermigrasi ke login Google |
| Notifikasi email otomatis (GmailApp) | Saat volume approval tinggi & pengurus minta pengingat |
| e-KTA digital anggota | Saat data anggota sudah lengkap & terverifikasi |
| Laporan keuangan bulanan PDF berstempel | Saat rekonsiliasi bulanan sudah rutin |
| Import/export data massal (CSV) | Saat migrasi data lama dalam jumlah besar |
| Upload lampiran multi-file ke Drive | Saat divisi rutin melampirkan proposal/foto |

### 4.3 Asumsi Awal
1. Seluruh pengurus internal memiliki akun Google Workspace yayasan (untuk akses Sheets/Drive backend).
2. Infrastruktur dasar: akun Google Workspace yayasan (gratis dalam batas kuota) + hosting statis untuk 2 frontend.
3. Konvensi nomor surat sementara mengikuti pola `042/SK-DPW/APII-JABO/III/2026`; mudah diubah sebelum data banyak.

---

## 5. Kebutuhan Fungsional

Setiap kebutuhan diberi ID untuk dilacak. Prioritas: **P0** (wajib MVP) · **P1** (penting, fase lanjutan) · **P2** (nice-to-have).

### 5.1 Autentikasi, Akun & Sesi (`FR-AUTH`)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-AUTH-01 | Login dengan **username + password** (sistem kustom, tanpa login Google di fase ini) | P0 |
| FR-AUTH-02 | Sesi aman via **token UUID** disimpan di `Sheet_Sessions` dengan masa berlaku; logout memutuskan sesi | P0 |
| FR-AUTH-03 | Token disimpan di `localStorage` frontend & dilampirkan pada setiap request; backend menolak token tidak valid/expired | P0 |
| FR-AUTH-04 | Superadmin dapat **membuat/mengubah/mencabut akun** pengurus (nama, peran, divisi, password) | P0 |
| FR-AUTH-05 | Password disimpan dalam bentuk hash SHA-256 + salt, tidak pernah plain-text | P0 |
| FR-AUTH-06 | Pengguna hanya melihat data **divisinya sendiri** (kecuali peran lintas-divisi); pelanggaran dicatat + ditolak | P0 |
| FR-AUTH-07 | Akun nonaktif (`is_active=FALSE`) langsung ditolak saat login & saat sesi diverifikasi | P0 |
| FR-AUTH-08 | Halaman profil: ganti nama tampilan & password sendiri | P1 |

### 5.2 Persuratan Resmi (`FR-LETTER`)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-LETTER-01 | Buat surat resmi: pilih jenis (SK, Undangan, Pengantar, Keterangan, Tugas, Rekomendasi, Edaran) | P0 |
| FR-LETTER-02 | **Nomor surat otomatis** berurutan per jenis/bulan romawi/tahun (mis. `042/SK-DPW/APII-JABO/III/2026`); tidak bisa dobel. Sekretaris dapat mengedit nomor saat status `DRAFT`; terkunci setelah diajukan | P0 |
| FR-LETTER-03 | Editor teks sederhana untuk isi surat (konsiderans: Menimbang, Mengingat, Memutuskan) | P0 |
| FR-LETTER-04 | Generate **PDF final** dari template Google Docs dengan kop yayasan, logo, nomor & tanggal otomatis; disimpan ke Drive | P0 |
| FR-LETTER-05 | **State machine ketat:** `DRAFT` → `PENDING_APPROVAL` (hanya SEKRETARIS) → `PUBLISHED` / `REJECTED` (hanya KETUA) | P0 |
| FR-LETTER-06 | Setelah `PUBLISHED`: PDF immutable, hash SHA-256 dicatat, link PDF ditulis ke Sheet | P0 |
| FR-LETTER-07 | Verifikasi publik: cek nomor surat → layar "DOKUMEN ASLI" (nomor, tanggal, jenis) atau "TIDAK DIVERIFIKASI" | P0 |
| FR-LETTER-08 | Daftar surat dengan filter status & pencarian; paginasi | P1 |
| FR-LETTER-09 | Unduh PDF surat yang sudah terbit | P1 |

### 5.3 Keuangan / Voucher Kas (`FR-FINANCE`)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-FINANCE-01 | Bendahara membuat voucher: tanggal, jenis (masuk/keluar), rekening, nilai, kategori, deskripsi | P0 |
| FR-FINANCE-02 | **Nomor voucher otomatis** (mis. `088/KEU-APII/JABO/II/2026`) | P0 |
| FR-FINANCE-03 | **Dual-approval ketat:** `PENDING` → `VERIFIED_BY_BENDAHARA` → `VERIFIED_BY_KETUM` → `APPROVED` | P0 |
| FR-FINANCE-04 | Hanya BENDAHARA yang bisa verifikasi tahap 1; hanya KETUA verifikasi tahap 2 (final) | P0 |
| FR-FINANCE-05 | Hanya voucher `APPROVED` yang masuk perhitungan saldo buku kas | P0 |
| FR-FINANCE-06 | Buku kas dengan saldo berjalan; read-only bagi Pembina & Pengawas (tidak ada tombol aksi) | P0 |
| FR-FINANCE-07 | Tolak voucher dengan catatan (status `REJECTED`) | P1 |
| FR-FINANCE-08 | Filter buku kas per bulan & jenis | P1 |

### 5.4 Workflow 7 Divisi (`FR-DIVISION`)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-DIVISION-01 | Anggota/ketua divisi membuat usulan program: judul, deskripsi, anggaran, sasaran, tanggal pelaksanaan | P0 |
| FR-DIVISION-02 | **Isolasi divisi mutlak:** divisi hanya bisa melihat & mengusulkan divisinya sendiri; akses lintas divisi ditolak + diaudit | P0 |
| FR-DIVISION-03 | **Tracking ID otomatis** format `#REQ-2026-089` | P0 |
| FR-DIVISION-04 | Workflow: `DRAFT` → `AJUKAN` → `DISETUJUI` / `DITOLAK`; divisi tidak bisa mempublikasi/sendiri | P0 |
| FR-DIVISION-05 | Hanya KETUA (Approval Board) yang bisa `DISETUJUI` / `DITOLAK` dengan catatan | P0 |
| FR-DIVISION-06 | Peran lintas-divisi (Ketua, Sekretaris, Bendahara, Pembina, Pengawas, Superadmin) melihat semua divisi | P0 |
| FR-DIVISION-07 | Dasbor agregat: jumlah usulan per divisi per status | P1 |

### 5.5 Portal Publik (`FR-PUBLIC`)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-PUBLIC-01 | Landing page elegan: profil yayasan, 7 divisi, informasi kontak (tanpa login) | P0 |
| FR-PUBLIC-02 | **Form cek keaslian surat** berbasis nomor surat atau SHA-256; hasil jelas ASLI / TIDAK DIVERIFIKASI | P0 |
| FR-PUBLIC-03 | Tombol/link menuju portal pengurus (`siapii.sigitadi.id`) | P0 |
| FR-PUBLIC-04 | Tampilan responsif (mobile, tablet, desktop) | P0 |

---

## 6. User Story & Acceptance Criteria

### 6.1 Autentikasi
| ID | Story | Acceptance Criteria |
|---|---|---|
| US-01 | Sebagai **pengurus**, saya ingin login dengan username & password, agar tidak perlu mengingat alur rumit. | a) Form hanya minta username + password; b) Gagal → pesan jelas "Username atau password salah"; c) Berhasil → masuk dasbor sesuai peran. |
| US-02 | Sebagai **superadmin**, saya ingin menambahkan akun pengurus baru, agar tidak perlu kontak IT. | a) Form: username, nama, peran, divisi, password; b) Username dobel ditolak; c) Akun langsung bisa login. |
| US-03 | Sebagai **anggota divisi Media**, saya ingin tidak bisa melihat data divisi Humas, sehingga privasi divisi saya juga terjaga. | a) Akses divisi lain → ditolak + audit event; b) Daftar saya hanya tampilkan divisi sendiri. |

### 6.2 Persuratan
| ID | Story | Acceptance Criteria |
|---|---|---|
| US-04 | Sebagai **sekretaris**, saya ingin sistem memberi nomor surat otomatis, tapi tetap bisa mengeditnya bila perlu. | a) Pilih jenis → nomor langsung muncul & **bisa diedit selama draft**; b) Sistem tolak nomor dobel/format salah; c) Setelah diajukan, nomor terkunci. |
| US-05 | Sebagai **ketua**, saya ingin menyetujui surat dari satu layar, agar tidak perlu bertemu fisik. | a) Antrian approval tampilkan: nomor, perihal, pemohon, tanggal; b) "Setujui" → `PUBLISHED` + PDF tergenerate & link tersimpan; c) "Tolak" → wajib isi alasan. |
| US-06 | Sebagai **penerima surat**, saya ingin mengecek nomor surat untuk memastikan keasliannya. | a) Masukkan nomor di portal publik (tanpa login); b) Cocok → "DOKUMEN ASLI" + nomor + tanggal + jenis; c) Tidak cocok → "TIDAK DIVERIFIKASI". |

### 6.3 Keuangan
| ID | Story | Acceptance Criteria |
|---|---|---|
| US-07 | Sebagai **bendahara**, saya ingin mencatat pengeluaran, agar buku kas bisa dipertanggungjawabkan. | a) Form: tanggal, jenis, rekening, nilai, kategori, deskripsi; b) Simpan → voucher bernomor otomatis; c) Status "menunggu verifikasi". |
| US-08 | Sebagai **ketua**, saya ingin baru menandatangani setelah bendahara menandatangani, agar ada cek ganda. | a) Voucher tanpa tanda tangan bendahara → tombol saya nonaktif; b) Setelah bendahara verifikasi → muncul di antrian saya; c) Verifikasi saya → voucher `APPROVED`, saldo terupdate. |
| US-09 | Sebagai **pengawas**, saya ingin melihat buku kas tanpa bisa mengubah, agar bisa audit dengan tenang. | a) Buku kas tampil dengan saldo berjalan; b) Tidak ada tombol tambah/edit/hapus; c) Hanya voucher `APPROVED` yang dihitung. |

### 6.4 Divisi
| ID | Story | Acceptance Criteria |
|---|---|---|
| US-10 | Sebagai **admin divisi Sosmed**, saya ingin mengusulkan program dengan status jelas, agar tidak menanya-nanya. | a) Buat usulan → simpan draf / ajukan; b) Status berubah di layar saya; c) Hanya divisi saya yang terlihat. |
| US-11 | Sebagai **ketua**, saya ingin melihat dasbor semua divisi, agar tahu mana yang menumpuk. | a) Kartu per divisi: jumlah usulan per status; b) Klik kartu → detail divisi; c) Bisa setujui/tolak dengan catatan. |

---

## 7. Kebutuhan Non-Fungsional

| Kategori | Kebutuhan |
|---|---|
| **Keamanan** | Semua aksi non-publik wajib token sesi valid; RBAC + isolasi divisi di router backend; audit log tidak bisa diubah dari frontend; password hashed; HTTPS di hosting frontend. |
| **Performa** | Response backend ≤ 3 detik (batas wajar Google Apps Script); generate PDF ≤ 10 detik; frontend ringan (Tailwind CDN, tanpa build step). |
| **Ketersediaan** | Mengandalkan infrastruktur Google (Sheets, Drive, Apps Script) — uptime mengikuti Google Workspace. |
| **Usability** | Bahasa Indonesia di semua tempat; status pakai label manusia ("Menunggu Persetujuan", bukan `PENDING_APPROVAL`); tombol besar & jelas untuk pengurus senior. |
| **Aksesibilitas** | Kontras warna memadai (WCAG AA); font cukup besar; responsif tablet & mobile. |
| **Kompatibilitas** | Browser modern (Chrome, Edge, Firefox, Safari 2 tahun terakhir). |
| **Pemeliharaan** | Kode GAS modular per domain (`Auth`, `Surat`, `Keuangan`, `Divisi`, `Database`); frontend vanilla JS tanpa dependency build. |
| **Privasi Data** | Data anggota tidak diekspos publik; hanya surat `PUBLISHED` yang bisa diverifikasi publik. |

---

## 8. Pengalaman Pengguna (UX) & Panduan Desain

Frontend mengikuti design system **"Amanah Modern Enterprise"** — hijau zamrud (emerald) + aksen emas/amber, nuansa Islam-institusional, font Plus Jakarta Sans. Konsekuensinya:

1. **Bahasa Indonesia di semua tempat** — pesan error, nama fitur, status dokumen.
2. **Response konsisten** — semua API memakai envelope `{ success, data, message }` (lihat `DESIGN.md §9`) sehingga frontend punya satu cara memproses.
3. **Status sebagai bahasa** — label status Indonesia yang jelas, bukan kode teknis, di `message` API.
4. **Pesan error yang memandu** — sertakan petunjuk perbaikan. Contoh: _"Nomor surat wajib diisi. Sistem akan membuatnya otomatis saat Anda menyimpan draft."_
5. **Loading state friendly** — tombol nonaktif + indikator saat operasi lambat (generate PDF).
6. **Read-only terlihat** — Pembina & Pengawas tidak melihat tombol aksi sama sekali, bukan sekadar dinonaktifkan.

---

## 9. Risiko & Mitigasi

| # | Risiko | Dampak | Mitigasi |
|---|---|---|---|
| R1 | **Pengurus menolak pakai sistem** karena dianggap rumit | Tinggi | Onboarding terbimbing; UI minimal; tim pendamping 1 bulan pertama |
| R2 | **Kuota Google Workspace** tercapai (Sheets/Drive/Apps Script) | Sedang | Pantau usage; arsipkan data lama; migrasi ke database terpisah saat menjadi batasan |
| R3 | **Nomor surat tidak sesuai ART/POB** resmi yayasan | Sedang | Konvensi sementara; konfirmasi ke pengurus inti; nomor di-generate, mudah diubah sebelum data banyak |
| R4 | **Password lupa / dibagikan** | Sedang | Superadmin bisa reset password; himbauan ganti password berkala |
| R5 | **Kebocoran data divisi** karena bug isolasi | Tinggi | Isolasi divisi diterapkan di router backend + audit event setiap penolakan |
| R6 | **Dokumen "final" berubah** tanpa sepengetahuan Ketua | Tinggi | Setelah `PUBLISHED`, hash dicatat & tidak bisa diedit; perubahan = dokumen baru |
| R7 | **Token sesi disalahgunakan** di perangkat umum | Sedang | Masa berlaku token 7 hari; tombol logout; sesi bisa dihapus manual dari Sheet |
| R8 | **Script Properties belum diset** → sistem error | Sedang | Validasi di startup dengan pesan Bahasa Indonesia yang jelas |

---

## 10. Rencana Rilis (Release Plan)

| Fase | Lingkup | FR yang Tercakup | Kriteria Selesai |
|---|---|---|---|
| **Fase 1 — Fondasi** | Router GAS, Google Sheets database, login + session token, RBAC 9 peran, audit log | FR-AUTH-01..07, FR-PUBLIC-01 | Login jalan; RBAC teruji; isolasi divisi ditolak + diaudit |
| **Fase 2 — Core** | Persuratan + generate PDF template, keuangan dual-approval, workflow 7 divisi | FR-LETTER-*, FR-FINANCE-*, FR-DIVISION-* | Satu surat bisa dibuat → diapprove → PDF tersimpan; voucher lewati dual-approval; divisi mengajukan & diapprove |
| **Fase 3 — Portal** | Landing publik + verifikasi surat, portal pengurus lengkap | FR-PUBLIC-*, FR-LETTER-07 | Publik bisa cek surat; pengurus kelola seluruh modul dari portal |
| **Fase 4 — Pengembangan Lanjutan** | Notifikasi email, e-KTA, laporan PDF, CSV import/export | FR-AUTH-08, FR-FINANCE-08, item §4.2 | Fitur lanjutan aktif & terdokumentasi |

**Definisi "selesai" per fitur** mengikuti `PROJECT_RULES.md` (DoD): kode + komentar + dokumentasi + pesan Bahasa Indonesia.

---

## 11. Pertanyaan Terbuka (Open Questions)

| # | Pertanyaan | Default Sementara |
|---|---|---|
| Q1 | Apakah konvensi nomor surat `042/SK-DPW/APII-JABO/III/2026` resmi sesuai ART/POB? | Pakai pola ini; mudah diubah saat belum banyak data |
| Q2 | Format voucher `088/KEU-APII/JABO/II/2026` — apakah penomoran reset tiap tahun? | Ya, reset per tahun |
| Q3 | Apakah nama 7 divisi (Humas, Litbang, Sosmed, Dakwah, Investasi, Hukum, Umum) sudah final? | Pakai daftar ini; konstanta `DIVISIONS` mudah diubah |
| Q4 | Kapan migrasi ke login Google (SSO) diaktifkan? | Setelah seluruh pengurus siap; sistem kustom tetap berjalan |
| Q5 | Siapa saja 9 akun inti di seed awal? | Lihat tabel akun demo di `README.md` (password `apii2026`) |

---

## 12. Tanda Tangan & Persetujuan

| Peran | Nama | Tanggal | Status |
|---|---|---|---|
| Ketua Yayasan APII DPW Jabodetabek | | | Menunggu |
| Sekretaris | | | Menunggu |
| Bendahara | | | Menunggu |
| Tim Teknis (Arsitektur) | | | Menunggu |

---

*Draft dokumen ini bersifat hidup — diperbarui seiring pembelajaran. Setiap perubahan kebutuhan fungsi (§5) wajib update ID `FR-*` terkait dan draf ini, sebelum kode ditulis.*
