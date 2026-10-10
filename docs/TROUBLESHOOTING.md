# Troubleshooting — SIAP APII

Daftar error yang paling sering muncul saat pemasangan pertama + cara memperbaikinya.

---

## 1. `Auth is not defined` / `Database is not defined`

**Penyebab:** Anda menempatkan kode `gas/` lama (yang memakai pola `Auth.login(...)`) ke Apps Script.

**Solusi:** Pakai file-file hasil build di `apps-script/*.gs` — di dalamnya pola tersebut sudah diganti jadi pemanggilan global. Jangan salin file-file di folder `gas/` langsung ke Apps Script; jalankan `scripts/build-apps-script.ps1` dulu.

---

## 2. `DB_SPREADSHEET_ID belum diset`

**Penyebab:** `KONFIG.DB_SPREADSHEET_ID` di `Konfig.gs` masih kosong / salah.

**Solusi:** Buka `apps-script/Konfig.gs` → cari `var KONFIG` → pastikan `DB_SPREADSHEET_ID` berisi ID Spreadsheet Anda. ID ini diambil dari URL Sheets:

```
https://docs.google.com/spreadsheets/d/<<<INI_ID_NYA>>>/edit
```

Atau tambah Script Property `DB_SPREADSHEET_ID` (Project Settings ⚙️ → Script properties) yang akan diutamakan.

---

## 3. `You do not have permission to call DriveApp` / meminta izin ulang

**Penyebab:** Scope otorisasi belum lengkap karena `setup()` gagal di tengah.

**Solusi:** Jalankan ulang `setup()`. Saat layar izin muncul → **Advanced** → **Go to project (unsafe)** → **Allow**. Pastikan akun yang dipakai adalah **akun yang sama** dengan pemilik Spreadsheet.

---

## 4. PDF surat gagal dibuat saat `approveSurat`

Gejalanya: surat berstatus PUBLISHED tapi `pdf_url` kosong, atau muncul pesan "Gagal membuat PDF surat".

**Cek bertahap:**

1. **Apakah template ada?** Buka [Drive](https://drive.google.com) → cari file `Template Surat Resmi APII DPW Jabodetabek`. Bila tidak ada: buka Apps Script → jalankan fungsi `generateTemplateSurat` manual.
2. **Apakah folder PDF ada?** Cari folder `APII Jabo - PDF Surat Resmi` di Drive. Bila tidak ada: jalankan fungsi `siapkanFolderPdf_` manual.
3. **Cek eksekusi terakhir:** Apps Script → panel kiri **Executions** → buka log yang gagal → baca pesan errornya.

ID template & folder disimpan otomatis di Script Properties saat `setup()` jalan pertama kali, jadi normalnya tidak perlu diisi manual.

---

## 5. Logo / stempel tidak muncul di template

**Penyebab:** File `AsetLogo.gs` / `AsetStempel.gs` belum disalin, atau isinya bukan base64 yang dihasilkan script build.

**Solusi:**

1. Pastikan seluruh file `apps-script/*.gs` sudah disalin utuh ke editor (13 modul + `AsetLogo.gs` & `AsetStempel.gs`).
2. Jalankan ulang fungsi `generateTemplateSurat` (akan menulis ulang template dengan gambar terbaru).
3. Bila gambar diganti: taruh gambar baru di `Dokumen Sumber/` dengan nama yang sama → jalankan `scripts/build-apps-script.ps1` → salin ulang `AsetLogo.gs` & `AsetStempel.gs` ke Apps Script → jalankan `generateTemplateSurat`.

---

## 6. Frontend: "Sesi berakhir" terus-menerus / API tidak terhubung

**Cek:**

- `window.API_BASE` di `public/config.js` & `portal/config.js` sudah berisi **URL deployment** (bukan deployment ID saja). Formatnya: `https://script.google.com/macros/s/XXX/exec`.
- Deployment dibuat dengan **Execute as: Me** + **Who has access: Anyone**.
- Cek URL langsung di browser: `?action=getPublishedSurat` harus kembalikan JSON, bukan halaman login Google.

---

## 7. Login gagal padahal password benar

**Kemungkinan (urut dari yang paling sering):**

1. **Sandi sudah pernah diganti.** Sandi bawaan `apii2026` hanya berlaku untuk akun yang belum pernah diubah sandinya lewat portal. Pastikan juga tidak ada spasi ikut terketik dan tulisan besar/kecil benar.
2. **`PASSWORD_SALT` berubah setelah akun dibuat.** Backend membaca `PASSWORD_SALT` dari **Script Property** lebih dulu, baru dari `KONFIG`. Mengisi Script Property *setelah* `setup()`/akun dibuat — atau mengubah nilainya — membuat **semua** hash sandi lama tidak berlaku sekaligus.
3. **Akun dinonaktifkan (`is_active = FALSE`).** Pesannya memang berbeda (*"Akun Anda dinonaktifkan…"*), tetapi bila yang dicoba akun lain, gejalanya sama-sama "tidak bisa masuk".
4. **Username salah ketik / akun tidak ada.** Pesan di layar **sengaja disamakan** antara "username tidak ditemukan" dan "sandi salah", jadi tampilan tidak bisa membedakannya.

Cara paling cepat memastikan sebabnya tanpa menebak: jalankan **§14** dari editor Apps Script, lalu kembali ke sini bila ternyata bukan itu penyebabnya.

---

## 8. Deploy ulang setelah mengubah kode backend

Setiap kali kode backend (`gas/*.gs`) diubah dan disimpan, **deployment lama tidak otomatis ter-update**.

**Cara yang disarankan (satu perintah, sudah terbukti di produksi):**
```bash
npm run deploy:gas          # build → validate → clasp push → Versi baru → perbarui deployment yang sama
npm run deploy:gas:check    # dry-run: build + validasi + preflight berkas saja
```

**Cara manual:** **Deploy → Manage deployments → pilih deployment → ikon ✏️ (Edit) → Version: New version → Deploy.** URL tidak berubah, jadi `API_BASE` frontend tetap sama.

> Keadaan produksi saat ini: **Versi 15** (2026-10-10 01:41 WIB dari `main`, aplikasi 2.5.0, build per-modul + laporan versi dari satu sumber; sebelumnya Versi 14 pada 2026-10-10 00:44 WIB) pada deployment `/exec` yang sama. Rincian di [CHANGELOG.md](../CHANGELOG.md) → **Status Produksi Terkini** dan [deploy.md](deploy.md) §4.

---

## 9. Tombol “Reset ke Default” tidak mengembalikan folder Drive — DIPERBAIKI di Versi 13

**Gejala:** menekan **Reset ke Default** di kartu Google Drive menjawab sukses ("berhasil dikembalikan ke folder default organisasi"), tetapi folder penyimpanan yang dipakai **tetap folder custom yang lama**; kartu Drive lalu menampilkan nama folder lama itu.

**Bukti dari produksi (2026-10-09):** uji `npm run smoke:drive -- --confirm` melaporkan `resetDriveStorage` mengembalikan `folder_name` = folder uji custom (bukan `APII Jabo - PDF Surat Resmi`), dan `testDriveStorage` sesudahnya masih menunjuk folder custom tersebut. Jejak audit `DRIVE_STORAGE_RESET` juga tercatat padahal folder tidak berpindah.

**Sebab (di `gas/Utils.gs`):** `resetDriveStorage` memanggil `siapkanFolderPdf_()` **sebelum** menghapus `drive_storage.custom_folder_id`. Urutan itu membuat `siapkanFolderPdf_()` (a) menemukan ID folder custom lama pada `drive_storage`, (b) menuliskannya kembali ke Script Property `DRIVE_FOLDER_ID`, lalu (c) mengembalikan folder custom tersebut sebagai "folder default". Setelah itu barulah `drive_storage` ditulis dengan `custom_folder_id: ''` — sehingga catatan setelan dan folder yang benar-benar dipakai menjadi tidak sinkron.

**Perbaikan (dipasang pada Versi 13, 2026-10-09 00:53 WIB):**
1. `resetDriveStorage` kini menghapus kedua sumber konfigurasi (`google_drive_folder_id` dan `drive_storage.custom_folder_id`) **lebih dahulu**, baru memanggil `siapkanFolderPdf_()`.
2. `siapkanFolderPdf_` kini **memakai ulang** folder bernama `KONFIG.DRIVE_FOLDER_NAME` yang sudah ada (lewat `DriveApp.getFoldersByName`, folder di Trash dilewati) sebelum membuat yang baru — sehingga reset berulang tidak lagi menumpuk folder default.
3. Penjaga regresinya ada di dua tempat: `node scripts/smoke-drive-local.mjs` (16 pemeriksaan, tanpa jaringan) dan `npm run smoke:drive -- --confirm` (produksi, memeriksa folder default benar-benar dipakai ulang).

**Bukti setelah perbaikan:** uji produksi 2026-10-09 pada Versi 13 → **20 pemeriksaan lulus, 0 gagal**; `resetDriveStorage` mengembalikan folder `APII Jabo - PDF Surat Resmi` yang sudah ada (tanpa duplikat baru), lalu folder aktif produksi dipulihkan ke `APII Jabo - Arsip 2026` dan terverifikasi.

---

## 10. Setelah `clasp push` masih "Aksi tidak dikenali" / perilaku lama tetap jalan

**Gejala:** kode baru sudah terunggah, tetapi portal menjawab *"Aksi tidak dikenali"* atau fitur baru tidak terasa — padahal fungsinya jelas ada di project Apps Script.

**Sebab paling sering: definisi ganda.** Semua berkas `.gs` di Apps Script berbagi satu scope global. Bila berkas lama masih tertinggal berdampingan dengan modul baru — terutama `Backend.gs` tunggal dari build sebelum 2026-10-09, atau `Aset.gs` peninggalan zaman dulu — nama yang sama terdefinisi dua kali. Apps Script **tidak** melaporkan ini sebagai error dan diam-diam memakai salah satunya (berkas yang dimuat paling akhir menang), sehingga yang dieksekusi adalah salinan usang.

**Diagnosis satu perintah** (menarik isi editor yang sesungguhnya, tidak mengubah apa pun di Google):
```bash
npm run check:legacy
```
Keluarannya: berkas yang bukan keluaran build, jumlah definisi ganda yang terbentuk berikut modul pasangannya, dan jumlah simbol berkas lama yang belum pindah. Kode keluar: **0** bersih · **1** ada temuan · **2** tidak dapat diverifikasi (mis. belum `clasp login`).

**Solusi:**
1. Bila hasilnya menyatakan **JANGAN hapus** → pindahkan dulu simbol yang disebutkan ke modul yang tepat, lalu `npm run build:gas`.
2. Bila seluruh simbol sudah pindah (skrip menyatakannya "penghapusan terbukti tidak menghilangkan fungsi") → cukup jalankan `npm run cleanup:legacy -- --yes`. Pembersih menarik isi editor, memakai gerbang kelayakan yang sama, lalu mengirim build lokal lewat Apps Script API (`projects.updateContent`) sehingga berkas lama — termasuk sisa seperti `Aset.gs` — **hilang otomatis tanpa klik Delete di editor**. Tanpa `--yes` ia hanya merencanakan; `--json` untuk mesin; kode keluar 0 bersih/dibersihkan · 1 tak berhasil/ada temuan · 2 tak dapat diverifikasi.
3. Verifikasi: `npm run check:legacy` harus keluar 0. Setelah itu `npm run deploy:gas` membuat versi baru seperti biasa.

> Sejak gerbang **langkah 7** di `scripts/deploy-gas.mjs`, versi baru tidak dibuat selagi editor masih memuat berkas lama, dan **langkah 7b** membersihkan berkas yang bukan keluaran build sendiri lewat Apps Script API — jadi keadaan ini tidak bisa lagi terlanjur tayang ke produksi maupun menuntut tombol **Delete** manual. Langkah 7b hanya dihentikan (dan deploy ditahan) bila ada simbol berkas lama yang belum pindah ke modul baru.
>
> **Bukti rilis Versi 14 (2026-10-10):** sebelum deploy, editor memang masih memuat `Backend.gs` (200.786 byte, 154 definisi ganda dengan modul baru). Begitu `clasp push` dijalankan, berkas itu **hilang dengan sendirinya** — API `projects.updateContent` mengganti seluruh isi project — sehingga editor tepat berisi 16 berkas dan langkah 7 lulus tanpa tindakan manual. Versi 14 tayang tanpa `Backend.gs` ikut terbawa, dan `npm run check:legacy` pasca-deploy keluar **0**. Jadi klaim lama "`clasp` tidak pernah menghapus berkas" tidak berlaku: bila Anda menemui gejala di atas, periksa dulu dengan `npm run check:legacy` — kemungkinan besar editor sudah bersih tanpa perlu menghapus apa pun.

---

## 11. Pengawasan membaca versi yang salah dari `ping` — DIPERBAIKI 2026-10-10

**Gejala:** alat monitoring/uptime yang memeriksa `?action=ping` melaporkan `version: "2.0.0"` (atau angka lain yang tidak pernah berubah), padahal backend sudah berkali-kali dirilis. Akibatnya alarm "versi produksi tertinggal" tidak pernah benar maupun salah — angkanya memang tidak berarti.

**Sebab:** angka versi ditulis manual sebagai konstanta di `gas/Code.gs` (`version: '2.0.0'`), sementara rilis sesungguhnya ditandai nomor **Versi Apps Script** (13, 14, …). Dua skema angka yang terpisah, dan yang dilaporkan `ping` tidak pernah ikut diperbarui.

**Perbaikan:** tidak ada lagi angka versi yang ditulis manual. `ping` membaca `APP_BUILD_INFO` dari `apps-script/Versi.gs` — berkas yang **dibangkitkan otomatis**: `version` diambil dari `package.json` setiap build (`npm run version:gas` / ikut di `npm run build:gas`), dan `release` dicap oleh `npm run deploy:gas` **tepat sebelum** `clasp push` (nomor versi tertinggi + 1), lalu dicocokkan dengan nomor yang benar-benar dibuat `create-version`. Bila tidak cocok, deploy berhenti sebelum `update-deployment` sehingga produksi tetap menyajikan versi lama. Bila bundel belum dirilis, `release` dilaporkan `null` — bukan angka karangan.

**Cara memakai untuk pengawasan:**
```bash
curl -s "<URL_EXEC>?action=ping"   # {"success":true,"data":{"status":"online","version":"2.5.0","release":15,...}}
```
Alarm yang disarankan: `status != "online"`, atau `release` berbeda dari Versi Apps Script terakhir (`npx --yes @google/clasp@3 versions`), atau `version` berbeda dari `version` di `package.json`. Nilai `release: null` berarti rilis itu di-deploy tanpa pencapan (`--no-release-stamp`, atau daftar versi tak terbaca) — periksa ulang, jangan anggap rilis terbaru.

**Bila muncul lagi:** jalankan `npm run build:gas` (memperbarui `version`) lalu `npm run deploy:gas` (mencap `release`). Gerbang [scripts/validate-apps-script.mjs](../scripts/validate-apps-script.mjs) menolak build bila versi `Versi.gs` berbeda dari `package.json` atau bila kode kembali memuat versi literal, jadi angka basi tidak bisa lolos lagi. Uji perilakunya tanpa jaringan: `npm run smoke:version`.

---

## 12. Tombol **Masuk** tidak bereaksi: muncul "Mode demo hanya untuk melihat…" — DIPERBAIKI 2026-10-10

**Gejala:** pengunjung yang perambannya masih menyimpan identitas akun demo (mis. sesi demo kedaluwarsa lalu halaman login terbuka) **tidak bisa masuk sama sekali**. Menekan **Masuk** — termasuk dengan akun superadmin yang benar — hanya memunculkan notifikasi *"Mode demo hanya untuk melihat. Perubahan data tidak dapat disimpan."* dan permintaannya **tidak pernah dikirim ke server**.

**Sebab (di `portal/auth.js`):** penjaga mode demo memblokir **semua** permintaan POST selama sesi demo aktif, termasuk aksi sesi itu sendiri (`login`, `loginDemo`, `logout`, `me`) yang juga dikirim sebagai POST. Akibatnya penukaran sesi mustahil: pintu keluarnya demo sekaligus pintu masuknya akun biasa sama-sama ditutup.

**Perbaikan:** `DEMO_GUARD_EXEMPT_ACTIONS = ['login', 'loginDemo', 'logout', 'me', 'registerAnggota']` — kelima aksi itu selalu sampai ke server; penjaga read-only **tetap utuh** untuk semua aksi tulis (ditolak di klien tanpa menyentuh jaringan, ditolak lagi oleh backend). `Auth.login()` dan `Auth.loginAsDemo()` juga membuang identitas lama (`Auth.clear()`) sebelum menukar sesi, sehingga tidak ada sisa user demo yang menyertai sesi baru.

**Uji penjaga:** `npm run smoke:portal` (15 pemeriksaan, tanpa jaringan) memuat `portal/auth.js` yang asli di sandbox, dan `npm run smoke:portal:live` (24 pemeriksaan) menjalankan alur yang sama di **peramban sungguhan** dari sebuah alamat — termasuk skenario "sesi demo basi" ini. Dengan mengembalikan bug-nya ke salinan sementara (penjaga demo mengecualikan `login` lagi + `clear()` sebelum login dihapus), uji peramban itu melaporkan **5 kegagalan, kode keluar 1** (dibuktikan 2026-10-10).

---

## 13. Tombol **Masuk sebagai Akun Demo** gagal: pesan merah `self.bootApp is not a function` — DIPERBAIKI 2026-10-10

**Gejala:** klik akun demo tampak tidak terjadi apa-apa, lalu halaman login menampilkan pesan merah **"self.bootApp is not a function"**. Sesi demo sebenarnya sudah dibuat server (token & user demo tersimpan di `localStorage`) tetapi **aplikasi tidak pernah terbuka**.

**Sebab (di `portal/portal.js`):** `App.showLogin()` memakai variabel `self` tanpa mendeklarasikannya, sedangkan di peramban `self` adalah **alias global untuk `window`**. Handler tombol demo di dalamnya karena itu memanggil `window.self.bootApp(...)` → `undefined` → `TypeError` yang tertangkap `.catch` dan dituliskan ke kotak pesan halaman login.

**Perbaikan:** `var self = (this && this.bootApp) ? this : window.App;` di awal `showLogin()` (pola yang sama dengan `App.router()`), plus handler tombol demo kini dipasang **sekali** (`self._demoBound`) supaya satu klik tidak mengirim beberapa permintaan `loginDemo`/membuat beberapa sesi demo ketika `showLogin()` dipanggil berulang dalam satu siklus halaman.

**Uji penjaga:** `npm run smoke:portal:ui` (17 pemeriksaan, tanpa jaringan) memuat `portal/portal.js` + `portal/auth.js` yang asli di DOM tiruan dengan semantik peramban (`self === window`), lalu **menekan tombolnya sungguhan** dan mewajibkan `App.bootApp()` dipanggil dengan user demo. Uji itu juga memindai seluruh method objek `App` dan **gagal bila ada yang memakai `self.` tanpa `var self`** — kelas bug ini tidak bisa terulang diam-diam. Lapis keduanya adalah `npm run smoke:portal:live` ([scripts/smoke-portal-live.mjs](../scripts/smoke-portal-live.mjs)): peramban sungguhan (chrome/edge headless) memuat halaman dari sebuah alamat, mengklik tombol demo dengan **tetikus sungguhan**, lalu mewajibkan aplikasi terbuka. Mengembalikan bug `var self` ke salinan sementara membuat uji itu **gagal dengan pesan yang identik dengan laporan pengurus** (`self.bootApp is not a function`), kode keluar 1 (dibuktikan 2026-10-10). Sejak itu uji ini ikut di gerbang pra-push dan dijalankan otomatis pada setiap preview deployment Vercel ([.github/workflows/portal-preview.yml](../.github/workflows/portal-preview.yml)).

> Kedua perbaikan di atas ada di sisi **frontend** (`portal/`), bukan backend Apps Script — jadi tidak ada Versi baru yang dibuat. Tayang begitu `git push origin main` memicu build Vercel kedua portal.

---

## 14. Kredensial SUPERADMIN ditolak — diagnosa & pemulihan sandi (jalur editor)

**Kapan dipakai:** tidak ada akun ber-peran SUPERADMIN yang bisa masuk, atau sebuah akun pengurus ditolak tanpa sebab yang jelas. Pesan di layar login tidak dapat membedakan "username tidak ada", "sandi salah", "akun nonaktif", dan "salt berubah" — itu memang disengaja agar orang luar tidak bisa memetakan daftar akun. Yang bisa membedakannya adalah tiga fungsi di [gas/Auth.gs](../gas/Auth.gs) — `pemulihanSandiEditor` (pintu masuk tanpa argumen), `diagnosaKredensial`, dan `pemulihanSandiPengguna` — yang **hanya** bisa dijalankan dari editor Apps Script.

**Mengapa aman dipegang:**

| Aturan | Konsekuensi praktis |
|---|---|
| Tidak terdaftar di `ROUTES` | Tidak ada URL/`doPost` yang bisa memanggilnya; permintaan HTTP bernama itu dijawab *"Aksi tidak dikenali."* — hanya pemilik project yang bisa menjalankannya dari editor |
| Sandi tidak pernah dicatat | Ringkasan & panel Executions tidak memuat sandi; yang tercatat hanya panjang sandi baru |
| Sandi dihapus dari Script Properties | Properti `PEMULIHAN_SANDI_*` dihapus kembali di blok `finally`, apa pun hasilnya |
| Setiap penyetelan ulang menulis jejak | Jejak audit `PASSWORD_RESET` berisi pelaku (email pemilik project), akun, dan jumlah sesi yang dicabut |
| Sesi lama dicabut otomatis | Token yang mungkin sudah bocor/tersimpan di peramban lama langsung mati |
| Penolakan terjadi lebih dulu | Sandi < 10 karakter, ulangan tidak sama, atau akun tidak ada → ditolak **tanpa** mengubah data |
| Panjang minimum 10 karakter | Sandi hasil pemulihan tidak lebih lemah dari aturan akun lain |

### Langkah 1 — Tentukan sebabnya (tidak mengubah apa pun)

1. Buka [script.google.com](https://script.google.com) → project produksi SIAP APII → **Project Settings ⚙️ → Script Properties**.
2. Tambahkan properti:

   | Properti | Nilai | Wajib? |
   |---|---|---|
   | `PEMULIHAN_USERNAME` | akun yang diperiksa, mis. `superadmin` | ✅ |
   | `PEMULIHAN_SANDI_UJI` | sandi yang tadi dicoba di portal (bila ingin diuji kecocokannya) | opsional |

3. Buka **Editor** → file `Auth.gs` → pilih fungsi **`pemulihanSandiEditor`** dari daftar fungsi → **Run**.
4. Baca panel **Execution log**. Baris `Sebab` menjawab pertanyaannya:

   | `Sebab` | Artinya | Tindakan |
   |---|---|---|
   | `KREDENSIAL_COCOK` | akun ada, aktif, hash sandi uji cocok | masalahnya **bukan** di backend — coba jendela penyamaran (identitas lama di `localStorage`), periksa ejaan username, lihat §6 |
   | `SANDI_SALAH` | akun aktif, hash tidak cocok | lanjut **Langkah 2** (atau curigai `PASSWORD_SALT` yang pernah diubah → §7) |
   | `AKUN_NONAKTIF` | akun ada & sandi cocok, tetapi `is_active = FALSE` | **Langkah 2** dengan `PEMULIHAN_AKTIFKAN = TRUE` |
   | `AKUN_TIDAK_DITEMUKAN` | tidak ada baris dengan username itu | baca baris `Nama mirip ejaannya` (salah ketik/beda spasi, mis. `superadminn` atau `super admin`) dan baris `Akun SUPERADMIN`; ulangi dengan ejaan yang benar |
   | `PERLU_SANDI_UJI` | akun ada & aktif; sandi uji belum diisi | isi `PEMULIHAN_SANDI_UJI` lalu ulangi, atau langsung ke **Langkah 2** |

> Bila `AKUN_TIDAK_DITEMUKAN` **dan** daftar `Akun SUPERADMIN` kosong (tidak ada admin sama sekali): jalankan fungsi **`seedDemoUsers()`** dari editor — fungsi itu **tidak menimpa akun yang sudah ada** — lalu ulangi Langkah 1/2 dengan `superadmin`. Ini dijalankan dari editor, jadi tidak perlu login portal.

### Langkah 2 — Setel ulang sandi (hanya bila memang perlu)

1. Di **Script Properties** yang sama, tambahkan:

   | Properti | Nilai |
   |---|---|
   | `PEMULIHAN_SANDI_BARU` | sandi baru, **minimal 10 karakter** |
   | `PEMULIHAN_AKTIFKAN` | `TRUE` — hanya bila akunnya nonaktif dan ingin diaktifkan kembali |

2. **Run** `pemulihanSandiEditor` lagi. Panel log menampilkan blok `=== DIAGNOSA KREDENSIAL ===` yang membuktikan hasilnya: akun ada, aktif, dan sandi baru **COCOK**.
3. Hapus `PEMULIHAN_USERNAME` bila sudah selesai (properti sandi sudah dihapus otomatis oleh fungsi — pastikan tidak ada sisa `PEMULIHAN_SANDI_*` di daftar Script Properties).

### Langkah 3 — Buktikan pemulihannya bekerja

1. Buka portal pengurus di **jendela penyamaran** (agar identitas lama di `localStorage` tidak menyamar jadi hasil uji) → masuk dengan akun & sandi baru → dashboard terbuka.
2. Buktikan sandi lama **sudah mati**: keluar, lalu coba masuk dengan sandi lama → *"Username atau password salah."*
3. Buktikan sesi lama **ikut dicabut** (bila akun itu sedang login di perangkat lain, sesinya harus putus): di tab/perangkat yang masih memakai token lama, muat ulang portal → muncul *"Sesi berakhir atau tidak valid"* dan diarahkan login lagi.
4. Buka portal → **Jejak Audit** (SUPERADMIN/KETUA/PEMBINA/PENGAWAS) → cari aksi **`PASSWORD_RESET`**: pelakunya email pemilik project, detailnya menyebut akun + jumlah sesi dicabut, dan **tidak ada sandi** di kolom mana pun.
5. Bila sandi hasil pemulihan hanya ingin dipakai sekali, ganti lagi dari portal: **Manajemen Pengguna** (khusus SUPERADMIN) → ubah akun → kolom **Password** ("kosongkan bila tidak diubah") → simpan. Dengan begitu sandi yang sempat ditulis di Script Properties tidak menetap sebagai sandi permanen.

### Cara memverifikasi prosedur ini sendiri (tanpa menyentuh produksi)

```bash
npm run build:gas     # bangkitkan apps-script/*.gs dari gas/*.gs
npm run smoke:auth    # 85 pemeriksaan, tanpa jaringan, ± 3 detik
```

> Uji ini membaca bundel `apps-script/` hasil `build:gas`, jadi ia berjalan di mesin yang punya `Dokumen Sumber/` (klon lokal). Di CI (mode `--ci`) ia termasuk pemeriksaan yang **dilewati beserta alasan yang tercetak di log** — bukan gagal, tetapi juga tidak dihitung lulus. Gerbang pra-push lokal (`npm run gate:push`, otomatis lewat hook) yang menjalankannya penuh.

Yang diuji [scripts/smoke-auth-recovery.mjs](../scripts/smoke-auth-recovery.mjs) di atas Spreadsheet tiruan (login & sesi sungguhan berjalan di sana):

- pesan login yang seragam (bukti jalan buntunya), lalu **sebab** yang bisa dibedakan: `KREDENSIAL_COCOK`, `SANDI_SALAH`, `PERLU_SANDI_UJI`, `AKUN_NONAKTIF`, `AKUN_TIDAK_DITEMUKAN` — termasuk saran ejaan untuk `superadminn` / `super admin`;
- empat bentuk penolakan (username kosong, sandi < 10 karakter, ulangan berbeda, akun tidak ada) **tidak mengubah** hash, tidak menulis audit, dan tidak mencabut sesi;
- penyetelan ulang benar-benar berlaku: sandi lama ditolak, sandi baru diterima, sesi lama akun itu habis, **sesi akun lain tidak tersentuh**;
- jejak audit `PASSWORD_RESET` mencatat pelaku; tidak ada sandi di balikan fungsi, audit, maupun log;
- pintu editor `pemulihanSandiEditor()`: hanya mendiagnosa bila `PEMULIHAN_SANDI_BARU` kosong, dan properti `PEMULIHAN_SANDI_UJI`/`PEMULIHAN_SANDI_BARU` **selalu terhapus** sesudahnya;
- `PEMULIHAN_AKTIFKAN=TRUE` mengaktifkan kembali akun nonaktif, sedangkan tanpa opsi itu akun tetap nonaktif;
- **tidak bisa dipanggil lewat HTTP**: tidak ada nama fungsi pemulihan di `ROUTES`, dan `doPost`/`doGet` dengan nama aksi itu dijawab *"Aksi tidak dikenali."*

Uji itu juga **gagal bila penjaga itu dilanggar** — dengan menambahkan route `pemulihanSandiPengguna` ke salinan `apps-script/Code.gs`, uji melaporkan 2 kegagalan dan kode keluar 1 (dibuktikan 2026-10-10 pada salinan sementara, bukan pada repositori).

Perubahan di `gas/Auth.gs` baru tayang setelah `npm run deploy:gas` (lihat §8). Selama belum dideploy, jalur pemulihan **belum ada** di project produksi.

---

## Butuh bantuan lain?

Buka Apps Script → **Executions** → cari eksekusi yang gagal → salin **seluruh isi log error** beserta nama fungsi. Itu yang dibutuhkan untuk mendiagnosis masalahnya.
