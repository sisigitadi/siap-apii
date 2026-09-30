# PRD — Product Requirements Document

# Sistem Informasi & Administrasi Terpadu Yayasan APII DPW Jabodetabek

| Field | Nilai |
|---|---|
| **Produk** | Backend API + WebSocket untuk portal administrasi Yayasan APII DPW Jabodetabek |
| **Versi** | 1.0 (Fase awal / MVP) |
| **Status** | Disetujui untuk pengembangan Fase 1 |
| **Penulis** | Tim Backend & Arsitektur |
| **Dokumen terkait** | `DESIGN.md` (teknis) · `PROJECT_RULES.md` (aturan) · `rbac-matrix.md` (izin) · `../README.md` (mulai) |

---

## 1. Ringkasan Eksekutif

### 1.1 Masalah yang Dipecahkan
Yayasan APII DPW Jabodetabek saat ini mengelola administrasi — persuratan, keuangan, usulan program 7 divisi, dan kartu anggota — secara **manual dan terpencar** (chat WhatsApp, spreadsheet, kertas). Akibatnya:
- **Nomor surat tidak teratur** dan mudah dobel/tanggal;
- **Buku kas sulit dilacak**, tidak ada verifikasi ganda, rekonsiliasi BSI merepotkan;
- **Usulan divisi mengendap** tanpa status jelas (siapa yang menunggu persetujuan apa);
- **Keabsahan dokumen diragukan** — tidak ada cara memverifikasi SK asli vs palsu;
- **Pengurus baru bingung** karena tidak ada sistem yang memandu langkah-langkahnya.

### 1.2 Visi Produk
> **"Satu portal terpadu tempat pengurus yayasan — siapa pun yang tidak mengerti IT — bisa mengurus surat, keuangan, dan program divisi dengan tenang, jelas, dan terlindungi."**

### 1.3 Prinsip Produk
Karena pengguna sebagian besar **belum terbiasa administrasi digital**, produk ini memegang prinsip:

1. **Jelas daripada lengkap.** Lebih baik sedikit fitur yang dipahami, daripada banyak fitur yang tidak terpakai.
2. **Pandu, jangan membebani.** Setiap layar menunjukkan langkah selanjutnya dan status saat ini dalam Bahasa Indonesia.
3. **Aman secara default.** Pengguna tidak perlu "mikir" keamanan — hak akses dan jejak audit bekerja di belakang layar.
4. **Terpercaya & dapat diverifikasi.** Setiap dokumen resmi dapat dicek keasliannya publik via QR/SHA-256.

### 1.4 Solusi Singkat
Sebuah backend REST + WebSocket (NestJS, monolith sederhana) dengan 6 modul fungsional yang melayani **13 peran bertingkat** di bawah isolasi divisi ketat. Detail teknis lihat `DESIGN.md`; dokumen ini berfokus pada **kebutuhan pengguna dan produk**.

---

## 2. Tujuan & Metrik Keberhasilan

### 2.1 Tujuan Bisnis
| # | Tujuan | Bagaimana Diukur |
|---|---|---|
| G1 | Mengakhiri penomoran surat manual yang kacau | 100% surat resmi memakai nomor otomatis berurutan |
| G2 | Membuat keuangan transparan & terverifikasi ganda | Setiap transaksi > Rp 0 memiliki tanda tangan Bendahara **dan** Ketua Umum |
| G3 | Menghilangkan kebingungan status usulan divisi | Pengurus bisa lihat status real-time 100% usulan |
| G4 | Memberi kepastian keaslian dokumen | Verifikasi publik QR/SHA-256 aktif untuk semua SK yang dirilis |
| G5 | Onboarding pengurus baru tanpa drama | Delegasi undang akun oleh pimpinan, tanpa menunggu IT |

### 2.2 Metrik Sukses (setelah 3 bulan penggunaan)
| Metrik | Target | Cara Ukur |
|---|---|---|
| **Adopsi pengurus aktif** | ≥ 80% pengurus login & melakukan ≥1 aksi/bulan | Audit session |
| **Surat dibuat di sistem** | ≥ 90% surat resmi dibuat lewat portal | Counter `official_letters` |
| **Rata-rata waktu selesai surat** | Dari draft → rilis ≤ 3 hari kerja | Selisih `created_at` → status `PUBLISHED` |
| **Selisih saldo buku kas** | 0 (nol) selisih antara sistem & rekening BSI | Rekonsiliasi bulanan |
| **Kasus dokumen palsu** | Verifikasi publik bisa dipakai; 0 kasus tidak terverifikasi | Log `/public/verify` |
| **Tiket "bagaimana caranya"** | Menurun ≥ 50% bulan ke-3 | Catatan tim pendamping |

### 2.3 Anti-Metrik (yang kita HINDARI)
- ❌ Banyaknya fitur mewah (chunking upload, transcode video) — **bukan** indikator sukses di fase ini.
- ❌ Jumlah endpoint API — kompleksitas tambahan dianggap **utang**, bukan pencapaian.

---

## 3. Pengguna Target (Personas)

Karena ada 13 peran teknis (lihat `rbac-matrix.md`), di sini dikelompokkan menjadi **5 persona produk** agar kebutuhannya jelas.

### 3.1 Persona A — "Pengurus Inti" (Ketua Umum, Wakil, Sekretaris, Bendahara, Kabid Kajian)
- **Profil:** Pengurus harian yayasan. Usia 35–60 tahun. Menggunakan WhatsApp & email Gmail setiap hari, tapi **jarang sekali** memakai aplikasi administrasi web.
- **Frustrasi saat ini:** Nomor surat berantakan; harus menandatangani dokumen fisik berkali-kali; lupa siapa yang harus approve; kas sulit dilacak.
- **Keinginan:** Bisa melihat semua yang butuh tindakannya di **satu layar**, lalu menyetujui/menolak dengan **satu tombol**.
- **Kebutuhan kunci:** Dasbor agregat, antrian persetujuan, notifikasi, pencarian dokumen cepat.
- **Kutipan:** *"Saya cuma mau tahu: apa yang harus saya tanda tangani hari ini, dan mana yang sudah selesai."*

### 3.2 Persona B — "Admin Divisi" (Koordinator 7 divisi: Kajian, Dakwah, Sosial, Pendidikan, Litbang, Media, Pembinaan Ummah)
- **Profil:** Relawan yang mengelola program divisinya. Upload dokumen pendukung (proposal, foto, laporan, surat undangan).
- **Frustrasi saat ini:** Usulan dikirim via chat lalu hilang; tidak tahu sudah sampai tahap mana; divisi lain bisa lihat berkasnya.
- **Keinginan:** Tempat upload yang terstruktur dengan status yang jelas, dan **hanya divisi saya** yang bisa melihat berkas divisi saya.
- **Kebutuhan kunci:** Uploader 7-tab per divisi, indikator status real-time, riwayat usulan.
- **Kutipan:** *"Saya mau tahu proposal saya sudah masuk ke tangan siapa, tanpa harus nanya-nanya."*

### 3.3 Persona C — "Dewan Pengawas & Penasihat" (read-only)
- **Profil:** Tokoh senior yang mengawasi, bukan operasional. Butuh transparansi tanpa harus belajar operasi sistem.
- **Keinginan:** Bisa **melihat** buku kas, surat, dan usulan **tanpa bisa mengubah** apa pun.
- **Kebutuhan kunci:** Akses baca saja ke semua modul, tampilan ringkas, tidak ada tombol edit.
- **Kutipan:** *"Saya ingin memantau, bukan dipaksa jadi operator."*

### 3.4 Persona D — "Anggota Publik" (Pemegang e-KTA)
- **Profil:** Anggota biasa yayasan. Ingin tahu jadwal kajian & status keanggotaan.
- **Frustrasi saat ini:** Kartu anggota hilang/tidak jelas masa berlaku; susah cari jadwal kajian resmi.
- **Keinginan:** Buka portal → lihat **e-KTA digital 5-tahun** + jadwal kajian resmi, kapan saja.
- **Kebutuhan kunci:** Portal publik (bisa tanpa login kompleks), verifikasi keaslian dokumen via QR.
- **Kutipan:** *"Kalau kartu saya hilang, saya tetap bisa tunjukkan saya anggota resmi."*

### 3.5 Persona E — "Superadmin / Tim IT"
- **Profil:** Operator teknis kecil (1–2 orang). Bertanggung jawab membuat sistem berjalan.
- **Frustrasi saat ini:** Setiap ada pengurus baru, semua nunggu dia setup akun manual.
- **Keinginan:** Setup sekali (branding, kop, stempel, nomor surat), lalu **delegasikan** manajemen anggota ke pimpinan.
- **Kebutuhan kunci:** Konfigurasi branding terpusat, delegasi undangan akun, jejak audit keamanan.
- **Kutipan:** *"Saya ingin setup sekali, lalu pimpinan bisa undang orang sendiri tanpa telepon saya."*

---

## 4. Ruang Lingkup (Scope)

### 4.1 Dalam Ruang Lingkup — Fase 1–4 (yang DIBANGUN)

| Modul | Singkatnya |
|---|---|
| **Autentikasi & Delegasi** | Login Google (satu klik), session aman, undang & kelola anggota oleh pimpinan |
| **Persuratan Resmi** | Nomor surat otomatis, template kop/stempel, render PDF, verifikasi publik |
| **Keuangan** | Buku kas, voucher dual-approval, laporan terstempel, hitung saldo otomatis |
| **Workflow 7 Divisi** | Uploader multi-berkas per divisi, status real-time, approval berjenjang |
| **Portal Publik & e-KTA** | e-KTA 5 tahun, jadwal kajian resmi, verifikasi dokumen publik |
| **Notifikasi Real-time** | Event push (status dokumen, approval, audit keamanan) |

### 4.2 Di Luar Ruang Lingkup — DITANGGUHKAN (lihat `DESIGN.md` §9)
Item berikut **sengaja tidak dibangun** di fase awal. Bukan dibuang — dicatat dengan pemicu aktivasi:

| Item | Kapan Dipakai Kembali |
|---|---|
| ClamAV scan malware upload | Saat ada insiden file mencurigakan / volume upload tinggi |
| Transkoding video HLS | Saat divisi Media rutin upload video besar |
| OCR kwitansi otomatis | Saat penginputan manual kwitansi jadi bottleneck |
| PostgreSQL RLS | Saat ada kebutuhan isolasi tingkat baris lintas aplikasi |
| WebSocket chunked upload | Saat file rutin > 100 MB |
| Antrian worker terpisah (BullMQ) | Saat beban render PDF menyebabkan response lambat |
| Login alternatif non-Google | Saat ada anggota tanpa akun Google |

### 4.3 Asumsi Awal
1. Semua pengurus internal **memiliki akun Google** (panduan pembuatan disediakan tim pendamping).
2. Infrastruktur dasar tersedia: **Vercel** (project `siap-apii`, domain `apii.sigitadi.id`) sebagai compute, plus tiga managed service eksternal — PostgreSQL (**Neon**), Redis (**Upstash**), dan storage S3 (**Cloudflare R2**) (lihat `DESIGN.md` §11). Development lokal memakai `docker compose`; SSL dan CDN diurus otomatis Vercel. Frontend SPA / halaman verifikasi QR publik di domain `app.apii.sigitadi.id` (§11 Q8).
3. Dokumen referensi (Anggaran Rumah Tangga, Pedoman Operasional Baku) sudah/tidak ada — **konvensi nomor sementara** mengikuti pola `042/SK-DPW/APII-JABO/III/2025` yang ditemukan di mockup; **perlu konfirmasi** (lihat §11).

---

## 5. Kebutuhan Fungsional

Setiap kebutuhan diberi ID untuk dilacak. Prioritas: **P0** (wajib MVP) · **P1** (penting, fase 1–2) · **P2** (nice-to-have, fase 3+).

### 5.1 Autentikasi, Akun & Delegasi (`FR-AUTH`)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-AUTH-01 | Login dengan akun Google (OAuth PKCE) — satu klik, tanpa password baru | P0 |
| FR-AUTH-02 | Session aman via JWT RS256 + refresh; logout memutuskan semua perangkat | P0 |
| FR-AUTH-03 | Superadmin dapat **mendelegasikan** hak kelola anggota ke Ketua/Sekretaris/Bendahara | P0 |
| FR-AUTH-04 | Pengurus yang didelegasi dapat mengundang anggota baru (nama, peran, divisi) lewat email Google | P0 |
| FR-AUTH-05 | Anggota yang diundang: setelah login pertama, akun langsung aktif dengan peran/divisi yang ditentukan | P0 |
| FR-AUTH-06 | Pengguna hanya melihat data **divisinya sendiri** (kecuali peran lintas-divisi); pelanggaran dicatat + tolak 403 | P0 |
| FR-AUTH-07 | Superadmin dapat mencabut/mengubah peran kapan saja; semua perubahan tercatat di audit log | P0 |
| FR-AUTH-08 | Halaman profil: ganti nama tampilan & foto (opsional) | P1 |

### 5.2 Persuratan Resmi (`FR-LETTER`)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-LETTER-01 | Buat surat resmi: pilih jenis (SK, Undangan, Pengantar, Keterangan, Tugas, Rekomendasi, Edaran) | P0 |
| FR-LETTER-02 | **Nomor surat otomatis** berurutan per jenis/bulan/romawi/tahun (mis. `042/SK-DPW/APII-JABO/III/2025`); tidak bisa dobel. **Sekretaris dapat mengedit** nomor saat status `DRAFT` — sistem cek format & keunikan; terkunci setelah diajukan/dirilis | P0 |
| FR-LETTER-03 | Editor teks sederhana (bukan HTML rumit) untuk isi surat | P0 |
| FR-LETTER-04 | Render **PDF final** dengan kop yayasan, logo, stempel basah, nomor & tanggal otomatis | P0 |
| FR-LETTER-05 | Tanda tangan elektronik peran (Ketua, Sekretaris, Bendahara) tampil di PDF sesuai jenis surat | P0 |
| FR-LETTER-06 | **QR code keaslian** di setiap PDF; scan → halaman verifikasi publik (SHA-256 cocok = asli) | P0 |
| FR-LETTER-07 | Status dokumen: `DRAFT` → `PENDING_APPROVAL` → `PUBLISHED` (atau `REJECTED`); tidak ada publikasi langsung | P0 |
| FR-LETTER-08 | Pencarian & filter surat (nomor, tanggal, jenis, perihal) dengan paginasi | P0 |
| FR-LETTER-09 | Unduh ulang PDF kapan saja; versi tidak pernah berubah setelah `PUBLISHED` | P0 |
| FR-LETTER-10 | Lampirkan berkas pendukung opsional (maks 10 MB/file) | P1 |

### 5.3 Keuangan (`FR-FINANCE`)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-FINANCE-01 | Catat pemasukan & pengeluaran (tanggal, kategori, deskripsi, nilai, bukti) | P0 |
| FR-FINANCE-02 | **Voucher resmi** otomatis bernomor (mis. `088/KEU-APII/JABO/II/2025`) untuk setiap transaksi | P0 |
| FR-FINANCE-03 | **Dual-approval**: transaksi baru berstatus pending → Bendahara tandatangan → Ketua Umum tandatangan → terbit | P0 |
| FR-FINANCE-04 | Penolakan harus disertai alasan (tercatat di audit + notifikasi ke pengaju) | P0 |
| FR-FINANCE-05 | Buku kas (ledger) dengan **saldo berjalan otomatis** per kategori & total | P0 |
| FR-FINANCE-06 | Laporan kas periodik (bulanan) dengan **kop & stempel**, siap unduh PDF | P0 |
| FR-FINANCE-07 | Catat info rekening resmi (BSI Giro, Brankas, Mandiri Wakaf) sebagai referensi pembayaran | P1 |
| FR-FINANCE-08 | Export data transaksi ke CSV/Excel untuk audit eksternal | P1 |
| FR-FINANCE-09 | Rekonsiliasi: cocokkan saldo sistem vs rekening BSI (input manual, catat selisih) | P1 |
| FR-FINANCE-10 | Foto bukti/kwitansi diupload & ditampilkan di voucher | P0 |

### 5.4 Workflow 7 Divisi (`FR-DIVISION`)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-DIVISION-01 | Tiap divisi (Kajian, Dakwah, Sosial, Pendidikan, Litbang, Media, Pembinaan Ummah) punya workspace sendiri | P0 |
| FR-DIVISION-02 | Ajukan usulan program: judul, deskripsi, anggaran, target, jadwal | P0 |
| FR-DIVISION-03 | **Uploader multi-berkas** per usulan: proposal, surat undangan, foto kegiatan, laporan, dokumen pendukung | P0 |
| FR-DIVISION-04 | Status usulan real-time: `DRAFT` → `AJUKAN` → `DIREVIEW` → `DISETUJUI`/`DITOLAK` → `SELESAI` | P0 |
| FR-DIVISION-05 | Approval berjenjang: Ketua Divisi → Sekretaris (cek administratif) → Ketua Umum | P0 |
| FR-DIVISION-06 | Penolakan disertai catatan revisi; usulan bisa diperbaiki & diajukan ulang | P0 |
| FR-DIVISION-07 | Pengurus inti lihat **dasbor agregat semua divisi** (jumlah usulan, status, deadline kalender) | P0 |
| FR-DIVISION-08 | **Kalender program** — tampilkan usulan yang disetujui di timeline bulanan | P1 |
| FR-DIVISION-09 | Notifikasi otomatis saat status usulan berubah ke pihak terkait | P0 |
| FR-DIVISION-10 | Berkas divisi **hanya** terlihat anggota divisi itu + pengurus inti (bukan divisi lain) | P0 |

### 5.5 Portal Publik & e-KTA (`FR-PUBLIC`)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-PUBLIC-01 | Halaman publik **verifikasi dokumen** via QR/SHA-256 — tanpa login | P0 |
| FR-PUBLIC-02 | Anggota lihat **e-KTA digital** sendiri: foto, nama, nomor anggota, masa berlaku 5 tahun, QR | P0 |
| FR-PUBLIC-03 | Jadwal kajian & program resmi yang dipublikasi (dari divisi) untuk umum | P0 |
| FR-PUBLIC-04 | Pengajuan perpanjangan keanggotaan (notifikasi ke admin) sebelum kadaluwarsa | P1 |
| FR-PUBLIC-05 | e-KTA dapat diunduh sebagai PDF (tampilan kartu) untuk cetak/digital | P1 |
| FR-PUBLIC-06 | Peringatan 60/30/7 hari sebelum e-KTA kadaluwarsa via email/notifikasi | P1 |

### 5.6 Notifikasi Real-time & Audit (`FR-NOTIF`)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-NOTIF-01 | Notifikasi push real-time di portal (WebSocket) saat: status dokumen berubah, ada antrian approval, audit keamanan | P0 |
| FR-NOTIF-02 | Pemberitahuan email untuk kejadian penting (dokumen ditolak, diundang sebagai anggota) | P1 |
| FR-NOTIF-03 | Halaman notifikasi pribadi dengan tanda sudah/belum dibaca | P1 |
| FR-NOTIF-04 | **Security audit log**: login, logout, gagal akses, delegasi diubah, dokumen diubah — terlihat superadmin real-time | P0 |

---

## 6. User Stories Kunci (dengan Acceptance Criteria)

Ditulis dari sudut pandang persona (§3). Format: *Sebagai [persona], saya ingin [aksi], sehingga [manfaat].*

### 6.1 Autentikasi & Delegasi
| ID | Story | Acceptance Criteria |
|---|---|---|
| US-01 | Sebagai **pengurus**, saya ingin login pakai akun Google saya, sehingga tidak perlu menghafal password baru. | a) Klik "Masuk dengan Google" → popup Google; b) Setelah izin, langsung masuk dasbor peran saya; c) Session bertahan 7 hari tanpa login ulang. |
| US-02 | Sebagai **superadmin**, saya ingin mendelegasikan kelola anggota ke Sekretaris, sehingga tidak semua urusan minta tolong saya. | a) Toggle `can_manage_users` di daftar pengguna; b) Sekretaris langsung dapat menu "Kelola Anggota"; c) Perubahan tercatat di audit log. |
| US-03 | Sebagai **sekretaris**, saya ingin mengundang pengurus baru lewat emailnya, sehingga dia bisa langsung aktif setelah login. | a) Isi nama + email Google + peran + divisi → kirim undangan; b) Pengundang lihat status "menunggu login"; c) Saat undangan login pertama, status jadi "aktif" dengan peran yang ditentukan. |
| US-04 | Sebagai **anggota divisi Media**, saya ingin tidak bisa melihat berkas divisi Kajian, sehingga privasi divisi saya juga terjaga. | a) Akses API divisi lain → 403 + audit event; b) Daftar saya hanya tampilkan divisi sendiri. |

### 6.2 Persuratan
| ID | Story | Acceptance Criteria |
|---|---|---|
| US-05 | Sebagai **sekretaris**, saya ingin sistem memberi nomor surat otomatis, tapi saya tetap bisa mengeditnya bila perlu, sehingga tidak ada nomor dobel atau terlewat. | a) Pilih jenis surat → nomor langsung muncul & **bisa saya edit selama masih draft**; b) Nomor urut per jenis/bulan/tahun; c) Sistem tolak nomor dobel/format salah; d) Setelah diajukan, nomor terkunci; e) Dua orang membuat surat bersamaan → tidak bentrok. |
| US-06 | Sebagai **ketua umum**, saya ingin menyetujui surat dari satu layar, sehingga tidak perlu bertemu fisik untuk tanda tangan. | a) Antrian approval tampilkan: nomor, perihal, pemohon, tanggal; b) "Setujui" → status `PUBLISHED`, PDF ada tanda tangan saya + stempel; c) "Tolak" → wajib isi alasan, pemohon dapat notifikasi. |
| US-07 | Sebagai **penerima surat**, saya ingin memindai QR di surat untuk memastikan itu asli, sehingga saya tidak tertipu dokumen palsu. | a) Scan QR → buka halaman publik (tanpa login); b) Cocok SHA-256 → "DOKUMEN ASLI" + nomor + tanggal; c) Tidak cocok / tidak ditemukan → "TIDAK DIVERIFIKASI". |

### 6.3 Keuangan
| ID | Story | Acceptance Criteria |
|---|---|---|
| US-08 | Sebagai **bendahara**, saya ingin mencatat pengeluaran beserta foto kwitansi, sehingga buku kas bisa dipertanggungjawabkan. | a) Form: tanggal, nilai, kategori, deskripsi, foto; b) Simpan → voucher bernomor otomatis; c) Status "menunggu persetujuan Ketua". |
| US-09 | Sebagai **ketua umum**, saya ingin baru tanda tangan setelah bendahara menandatangani, sehingga ada cek ganda. | a) Transaksi tanpa tanda tangan bendahara → tombol saya nonaktif; b) Setelah bendahara tandatangan → muncul di antrian saya; c) Tandatangan saya → voucher terbit, saldo terupdate. |
| US-10 | Sebagai **dewan pengawas**, saya ingin melihat buku kas tanpa bisa mengubah, sehingga saya bisa audit dengan tenang. | a) Buku kas tampil dengan saldo berjalan; b) Tidak ada tombol tambah/edit/hapus; c) Bisa unduh laporan berstempel. |

### 6.4 Divisi & Portal
| ID | Story | Acceptance Criteria |
|---|---|---|
| US-11 | Sebagai **admin divisi Sosial**, saya ingin mengupload proposal + foto kegiatan dalam satu usulan, sehingga berkas tidak berserakan di chat. | a) Buat usulan → tab upload terbuka; b) Bisa tambah banyak berkas dengan label jenis; c) Status berubah real-time di layar saya. |
| US-12 | Sebagai **ketua umum**, saya ingin melihat dasbor semua divisi, sehingga tahu mana yang numpuk/menunggu. | a) Kartu per divisi: jumlah usulan per status; b) Klik kartu → detail divisi; c) Data update otomatis (WebSocket). |
| US-13 | Sebagai **anggota**, saya ingin melihat e-KTA digital saya, sehingga tidak masalah kalau kartu fisik hilang. | a) Buka portal → e-KTA saya (foto, nomor, berlaku 5 tahun); b) Ada QR verifikasi; c) Bisa unduh PDF kartu. |

---

## 7. Kebutuhan Non-Fungsional

| Kategori | Kebutuhan |
|---|---|
| **Keamanan** | Semua endpoint non-publik di belakang JWT; RBAC + isolasi divisi level aplikasi; audit log tidak bisa diubah; secret via env (tidak di-commit); HTTPS saja di produksi. |
| **Performa** | Response API ≤ 300ms (p95) untuk operasi baca; render PDF ≤ 5 detik untuk dokumen ≤ 10 halaman; WebSocket event ≤ 2 detik sampai klien. |
| **Ketersediaan** | Monolith 1 proses, restart cepat; data tersimpan di PostgreSQL (tidak hilang saat restart); file tersimpan di MinIO. |
| **Skalabilitas** | Mendukung ≥ 200 pengguna aktif & ≥ 5.000 dokumen tanpa perubahan arsitektur (cukup naikkan resource). |
| **Usability** | Semua teks Bahasa Indonesia; tiap layar tampilkan status & langkah selanjutnya; error pakai bahasa manusia (bukan kode); onboarding pertama memandu pengguna. |
| **Aksesibilitas** | Kontras warna memadai (WCAG AA); bisa dipakai tanpa mouse di fitur utama; font cukup besar untuk pengguna usia 50+. |
| **Kompatibilitas** | Browser modern (Chrome, Edge, Firefox, Safari versi 2 tahun terakhir); responsif untuk tablet (pengurus sering pakai iPad). |
| **Pemeliharaan** | Kode 100% TypeScript, tanpa `any`; tes unit untuk logika bisnis penting; migrasi database terdokumentasi. |
| **Privasi Data** | Data anggota tidak diekspos publik; hanya e-KTA & dokumen yang sengaja dipublikasi yang bisa diakses umum. |

---

## 8. Pengalaman Pengguna (UX) & Panduan Desain

Frontend mengikuti design system **"Amanah Modern Enterprise"** (hijau zamrud + aksen emas amber, nuansa Islam-institusional). Untuk backend, konsekuensinya:

1. **Bahasa Indonesia di semua tempat** — pesan error, nama fitur, status dokumen. Contoh: bukan "Record not found", tapi "Dokumen tidak ditemukan."
2. **Response konsisten** — semua API memakai envelope `{ success, data, message, errors? }` (lihat `PROJECT_RULES.md` §2.4) agar frontend tinggal satu cara memproses.
3. **Status sebagai bahasa** — gunakan label status Indonesia yang jelas (`Draft`, `Menunggu Persetujuan`, `Diterbitkan`, `Ditolak`), bukan kode teknis, di sisi API `message`.
4. **Pesan error yang memandu** — sertakan `hint` untuk perbaikan. Contoh: `"Nomor surat wajib diisi. Sistem akan membuatnya otomatis saat Anda menyimpan draft."`
5. **Pagination & filter default** — daftar panjang selalu paginasi (default 20) agar frontend tidak kewalahan.
6. **Loading state friendly** — operasi lambat (render PDF) kembalikan `accepted` + id job sederhana, frontend polling status.

---

## 9. Risiko & Mitigasi

| # | Risiko | Dampak | Mitigasi |
|---|---|---|---|
| R1 | **Pengurus menolak pakai sistem** karena dianggap rumit | Tinggi | Onboarding terbimbing; UI minimal; metrik adopsi dipantau (§2.2); tim pendamping 1 bulan pertama |
| R2 | **Email pengurus bukan Gmail** sehingga tidak bisa login | Tinggi | Cek ketersediaan akun Google di awal; panduan buat akun; login alternatif ditangguhkan (bisa diaktifkan, §4.2) |
| R3 | **Nomor surat tidak sesuai ART/POB** resmi yayasan | Sedang | Konvensi sementara dipakai dulu; konfirmasi ke pengurus inti (§11 Q1); nomor di-generate, mudah diubah konvensinya sebelum banyak data |
| R4 | **File besar** (video kegiatan) membebani storage/render | Sedang | Batas 10 MB/file di fase awal; HLS transkoding ditangguhkan dengan pemicu jelas |
| R5 | **Saldo kas tidak cocok** dengan rekening BSI saat rekonsiliasi | Sedang | Fitur rekonsiliasi input manual (FR-FINANCE-09); pelatihan input rutin mingguan |
| R6 | **Kebocoran data divisi** karena bug isolasi | Tinggi | Guard isolasi divisi wajib di setiap endpoint + audit event 403; tes e2e akses lintas divisi |
| R7 | **Dokumen "final" berubah** tanpa sepengetahuan Ketua | Tinggi | Setelah `PUBLISHED`, PDF immutable (hash dicatat); perubahan = dokumen baru + referensi |
| R8 | **Superadmin keluar/tidak ada** — tidak ada yang setup awal | Sedang | Seed 4 akun inti; delegasi kelola anggota bisa dipegang beberapa peran |
| R9 | **Performa render PDF** menurun saat volume dokumen naik | Rendah | Render sinkron cukup di fase ini; worker terpisah (BullMQ) sebagai opsi fase 2 (§9 DESIGN) |
| R10 | **Pengguna lupa logout** di perangkat umum | Sedang | Refresh token berumur pendek; tombol "Keluar dari semua perangkat" (FR-AUTH-02) |

---

## 10. Rencana Rilis (Release Plan)

Selaras dengan `DESIGN.md` §10. Setiap fase menghasilkan **potongan yang bisa dipakai**, bukan tunggu semua selesai.

| Fase | Lingkup | FR yang Tercakup | Kriteria Selesai |
|---|---|---|---|
| **Fase 1 — Fondasi** | Scaffold, Prisma + migrasi + seed, OAuth PKCE + JWT RS256, RBAC Guards, envelope + filter, Swagger | FR-AUTH-01/02/03/04/05/06/07 | Login Google jalan; superadmin bisa undang anggota; isolasi divisi teruji; API doc bisa diakses |
| **Fase 2 — Core** | Persuratan + PDF engine, keuangan dual-approval + laporan, workflow 7 divisi + uploader | FR-LETTER-* , FR-FINANCE-*, FR-DIVISION-01..06,09,10 | Satu SK lengkap bisa dibuat → diapprove → PDF + QR terverifikasi; voucher kas lewat dual-approval; admin divisi bisa upload & lihat status |
| **Fase 3 — Realtime & Portal** | WebSocket event bus, notifikasi, portal publik + e-KTA + verifikasi | FR-NOTIF-*, FR-PUBLIC-01/02/03 | Status dokumen update real-time di 2 browser; anggota lihat e-KTA; QR scan verifikasi asli |
| **Fase 4 — Ship** | Dockerfile final, e2e test, panduan deploy, pelatihan | FR-*, + FR-PUBLIC-04/05/06, FR-FINANCE-08/09 | Bisa deploy bersih; e2e lulus; tim yayasan dilatih & dokumen diserahkan |

**Definisi "selesai" per fitur** mengikuti `PROJECT_RULES.md` §8 (DoD): kode + tes + dokumen + tidak ada `any` + pesan Indonesia.

---

## 11. Pertanyaan Terbuka (Open Questions)

Butuh konfirmasi dari pemangku kepentingan yayasan **sebelum Fase 2** (Fase 1 tidak terpengaruh):

| # | Pertanyaan | Mengapa Penting | Default Sementara |
|---|---|---|---|
| Q1 | Apakah konvensi nomor surat `042/SK-DPW/APII-JABO/III/2025` resmi sesuai ART/POB? Apakah kode tiap jenis surat (SK, Undangan, dll.) benar seperti di mockup? | Nomor salah sekali → semua dokumen pertama salah | Pakai pola mockup; mudah diubah saat belum banyak data |
| Q2 | Format voucher kas `088/KEU-APII/JABO/II/2025` — apakah penomoran ulang tiap tahun mulai dari 001? | Menentukan logika reset counter | Ya, reset per tahun |
| Q3 | Apakah nama 7 divisi (Kajian, Dakwah, Sosial, Pendidikan, Litbang, Media, Pembinaan Ummah) sudah final? | Nama dipakai di seluruh sistem & data seed | Pakai daftar ini sesuai mockup |
| Q4 | Masa berlaku e-KTA 5 tahun — hitung dari tanggal apa (terbit kartu / pertama kali daftar)? | Menentukan field tanggal di model | Dari tanggal terbit kartu |
| Q5 | Rekening BSI Giro, Brankas, Mandiri Wakaf — apakah nomor rekening perlu disimpan di sistem (dan siapa boleh lihat)? | Data sensitif; ruang lingkup PII | Simpan nama bank + jenis saja dulu, nomor ditunda |
| Q6 | Siapa saja yang menjadi 4 akun inti di seed awal (nama + email)? | Fase 1 butuh data seed | SUPERADMIN: **si.sigitadi@gmail.com**; 3 akun inti lainnya (Ketua/Sekretaris/Bendahara) placeholder dulu — admin bisa tambah/kurang sendiri lewat menu kelola anggota |
| Q7 | Apakah perlu eskalasi otomatis jika approval tertunda > N hari? | Operasional vs fitur tambahan | Ditunda; notifikasi manual dulu |
| Q8 | ✅ **TERJAWAB:** backend = **`apii.sigitadi.id`** (compute di Vercel project `siap-apii`, repo `github.com/sisigitadi/siap-apii`); frontend SPA = **`app.apii.sigitadi.id`** (Vercel project terpisah). | Menentukan `PUBLIC_VERIFY_BASE_URL` (URL QR), callback Google OAuth, CORS, dan sertifikat SSL | Backend API: `https://apii.sigitadi.id`. Frontend SPA: `https://app.apii.sigitadi.id` → `PUBLIC_VERIFY_BASE_URL=https://app.apii.sigitadi.id/verify` + `CORS_ORIGINS=https://app.apii.sigitadi.id`. Fase 1 tetap jalan dengan `localhost` |

---

## 12. Tanda Tangan & Persetujuan

| Peran | Nama | Tanggal | Status |
|---|---|---|---|
| Ketua Umum Yayasan APII DPW Jabodetabek | | | Menunggu |
| Sekretaris | | | Menunggu |
| Bendahara | | | Menunggu |
| Tim Teknis (Arsitektur) | | | Menunggu |

---

*Draft dokumen ini bersifat hidup — diperbarui seiring pembelajaran. Setiap perubahan kebutuhan fungsi (§5) wajib update ID `FR-*` terkait dan draf ini, sebelum kode ditulis (lihat `PROJECT_RULES.md` §9).*

