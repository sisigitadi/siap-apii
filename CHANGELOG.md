# Changelog — SIAP APII

Seluruh perubahan penting pada proyek **SIAP APII (Sistem Informasi & Administrasi Terpadu Yayasan APII DPW Jabodetabek)** didokumentasikan di sini mengikuti kaidah [Semantic Versioning](https://semver.org/).

---

## Status Produksi Terkini (dipembarui 2026-10-10)

Ringkasan keadaan produksi sungguhan — dipakai sebagai acuan cepat sebelum/ setelah rilis berikutnya.

| Komponen | Keadaan Produksi |
|---|---|
| **Backend Apps Script** | **Versi 15** tayang pada deployment `/exec` yang sama (`…NJdg`, tidak pernah berubah sejak rilis pertama), dibuat **2026-10-10 01:41 WIB** dari `main` ("SIAP APII rilis 2026-10-10 01:41") — aplikasi **2.5.0**: build per-modul + **pembersihan berkas lama otomatis** + **laporan versi `ping` dari satu sumber**. Versi 14 (2026-10-10 00:44 WIB) adalah rilis sebelumnya. |
| **Editor Apps Script** | **Bersih & terverifikasi** (2026-10-10, ditarik ulang lewat `npm run check:legacy` → kode keluar 0): tepat **17 berkas** — 13 modul `.gs` + `AsetLogo.gs`, `AsetStempel.gs`, `Versi.gs`, `appsscript.json`; **0 berkas lama, 0 definisi ganda** (194 simbol diperiksa). `Backend.gs` tunggal hilang dengan sendirinya saat `clasp push` (API `projects.updateContent` mengganti seluruh isi project). Bila suatu saat berkas lama tetap tertinggal, deploy **membersihkannya sendiri** lewat langkah 7b — tidak ada lagi klik **Delete** manual dalam migrasi (dibuktikan nyata terhadap editor produksi pada 2026-10-10). |
| **Kesetaraan kode** | **Setara pada Versi 15** (17 berkas; dulu satu `Backend.gs` 200.786 karakter di editor) — dengan **dua tambahan yang sudah ada di build lokal tetapi belum tayang di produksi**: (1) `is_demo` pada `sanitizeUser` ([gas/Utils.gs](gas/Utils.gs), pengerasan penjaga mode demo, 2026-10-10) dan (2) **jalur pemulihan sandi** ([gas/Auth.gs](gas/Auth.gs), 2026-10-10, lihat bagian berikutnya). Keduanya sudah masuk `apps-script/` pada build ulang 2026-10-10 dan akan tayang pada `npm run deploy:gas` berikutnya (Versi 16). Frontend tetap benar tanpa flag `is_demo` karena `Auth.isDemo()` mengenali akun demo dari `role === 'DEMO'` juga, dan jalur pemulihan sengaja tidak punya route sehingga tidak bergantung pada frontend. Dikonfirmasi dari dua sisi: `clasp deployments` melaporkan deployment `…NJdg` menyajikan `versionNumber: 15`, dan endpoint produksi menjawab HTTP 200 JSON untuk `ping` dengan `version: "2.5.0"` + `release: 15` — angka yang sama dengan berkas `apps-script/Versi.gs` di repositori. |
| **Fitur redaksi 2.4.0** | **Live.** `getEditorialHistory`, `getEditorialRevision`, `restoreEditorialRevision`, `exportEditorialContent`, `importEditorialContent` dikenali router dan menuntut sesi login (bukan lagi *"Aksi tidak dikenali"*). |
| **Fitur Google Drive 2.0.1** | **Live.** `testDriveStorage`, `createDriveFolder`, `moveDriveFolder`, `resetDriveStorage` dikenali dan dijaga RBAC. Koneksi Drive diuji dengan sesi superadmin: folder aktif `APII Jabo - Arsip 2026`, izin tulis aktif. |
| **Portal** | `siapii.sigitadi.id` (portal pengurus, termasuk tab `📰 Redaksi Konten` dan kartu Drive) dan `apii.sigitadi.id` (konten dinamis dari backend) menyajikan berkas yang identik dengan repo. |
| **Tanpa regresi** | Ekspor → impor ulang berkas yang sama menjawab *"Isi berkas sama dengan konten aktif"*; sidik jari konten publik **identik** sebelum & sesudah uji (`f23cb4cbfcd1b224`). **Rilis Versi 15 diuji ulang dari sisi produksi:** empat route konten (`getPublicSettings`, `getPublishedSurat`, `getPublicAccounts`, `getPublicFeed`) **byte-identik** sebelum vs sesudah deploy (SHA-256 sama), 10/10 route terproteksi menjawab *"Sesi berakhir atau tidak valid"* (0 *"Aksi tidak dikenali"*), dan `verifySurat` benar untuk nomor sah maupun palsu. |
| **🐞 → ✅ Bug `resetDriveStorage`** (ditemukan 2026-10-09, **diperbaiki di Versi 13**) | Sebelumnya tombol **Reset ke Default tidak benar-benar kembali ke folder default**: `siapkanFolderPdf_()` masih membaca `drive_storage.custom_folder_id` karena konfigurasi baru dibersihkan *setelah* folder dibaca, sehingga folder custom lama tetap dipakai dan catatan `drive_storage` menjadi tidak konsisten. Kini `resetDriveStorage` membersihkan seluruh penunjuk folder custom **sebelum** memanggil `siapkanFolderPdf_()`, dan `siapkanFolderPdf_()` **memakai ulang folder default yang sudah ada** (tidak lagi menumpuk folder bernama sama saat reset dijalankan berulang). Dikunci uji lokal 16 pemeriksaan + diverifikasi di produksi. Riwayat lengkap: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md). |
| **🐞 → ✅ Bug tombol masuk portal** (ditemukan & diperbaiki 2026-10-10) | Dua cacat di sisi **frontend** membuat portal pengurus tidak bisa dimasuki dari peramban yang masih menyimpan identitas demo: (1) penjaga mode demo memblokir aksi sesi POST-nya sendiri sehingga **Masuk** (akun apa pun, termasuk superadmin) hanya memunculkan notifikasi *"Mode demo hanya untuk melihat…"* tanpa menyentuh server; (2) `App.showLogin()` memakai `self` tanpa deklarasi — di peramban `self === window` — sehingga tombol **Masuk sebagai Akun Demo** menyimpan sesi demo lalu gagal membuka aplikasi dengan pesan *"self.bootApp is not a function"*. Keduanya kini dikunci uji tanpa jaringan (`npm run smoke:portal` 15 pemeriksaan · `npm run smoke:portal:ui` 17 pemeriksaan, termasuk pemindai `self.` tanpa deklarasi). Rincian: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) §12–§13. |
| **Gerbang pra-push** | **Aktif** (`npm run hooks:install` → hook `.githooks/pre-push`). `npm run gate:push` menjalankan **14 pemeriksaan offline ± 15 detik** (pemindai variabel global frontend, uji tombol masuk portal, **UI portal di peramban sungguhan**, jalur pemulihan sandi, daftar putih route, seluruh smoke tanpa jaringan) sebelum kode pergi ke remote. CI menjalankan perintah yang sama dalam **mode `--ci`**: **9 dari 14** pemeriksaan (yang mandiri — pemindai frontend, penjaga portal, **UI portal di peramban sungguhan**, daftar putih route, template surat, definisi ganda, pembersih berkas lama) benar-benar dijalankan, sedangkan **5 pemeriksaan yang membaca bundel `apps-script/*.gs` dilewati dengan alasan tercetak di log** — bundel itu memang tidak ikut ke repositori (`.gitignore`), dan aset sumbernya `Dokumen Sumber/` juga tidak. `smoke:deploy` (± 145 detik), `smoke:drive` (Drive produksi), `check:legacy`/`cleanup:legacy` (jaringan + kredensial) dan `build:gas`/`deploy:gas` sengaja tidak ikut. |
| **Sisa artefak uji** | Satu folder sandbox `UJI-OTOMATIS-APII-…` (berisi 9 folder uji + subfoldernya) masih ada di My Drive: Google Drive menolak penghapusannya dengan `403 appNotAuthorizedToChild` karena aplikasi uji tidak berhak atas folder yang dibuat backend Apps Script → perlu **1× hapus manual** (tautan ada di keluaran skrip). |
| **Riwayat Versi Produksi** | Sudah terisi sejak 2026-10-09 (1 versi: penyimpanan "Profil & sambutan" oleh superadmin dari portal) — bukan lagi 0 versi. |

> **Laporan versi `ping` kini tidak bisa basi — LIVE sejak Versi 15 (2026-10-10 01:41 WIB).** Produksi menjawab `{"status":"online","version":"2.5.0","release":15}`. Sebelumnya angka `version: '2.0.0'` ditulis manual di `gas/Code.gs` sementara rilisnya sudah belasan — pengawasan (uptime/monitoring) membaca angka yang salah. Sekarang `ping` melaporkan dua angka yang **keduanya dibangkitkan otomatis** dari [apps-script/Versi.gs](scripts/stamp-build-info.mjs): `version` = versi aplikasi dari `package.json` (dicap ulang setiap build, jadi mustahil basi) dan `release` = nomor Versi Apps Script yang tayang (dicap `scripts/deploy-gas.mjs` **sebelum** push lalu dicocokkan dengan nomor yang benar-benar dibuat). Tidak ada lagi angka yang ditulis manual di kode.

### 🧪 Penjaga Regresi Drive (skrip uji)
- `npm run smoke:drive` (baca [scripts/smoke-drive-prod.mjs](scripts/smoke-drive-prod.mjs)) menjalankan rencana uji aman terhadap **produksi sungguhan**: sandbox `UJI-OTOMATIS-APII-…`, `createDriveFolder` 2×, dua penjagaan `moveDriveFolder`, satu pemindahan nyata (terbukti lewat Drive API), `resetDriveStorage` (harus memakai ulang folder default yang sudah ada), lalu pemulihan & verifikasi folder aktif produksi dan pencobaan pembersihan sandbox.
- `npm run smoke:drive:local` (baca [scripts/smoke-drive-local.mjs](scripts/smoke-drive-local.mjs)) menjalankan **16 pemeriksaan tanpa jaringan** dengan `DriveApp` stub: `createDriveFolder` dan `moveDriveFolder` memodifikasi state Google Sheets & Script Properties tiruan (termasuk `DRIVE_FOLDER_ID`), `resetDriveStorage` memasukkan payload kosong dan dipastikan kembali ke folder default, dan satu penjagaan regresi mewajibkan `resetDriveStorage` membersihkan konfigurasi **sebelum** memanggil `siapkanFolderPdf_()`.
- Jalankan `npm run build:gas && npm run smoke:drive:local` sebelum mengubah apa pun di `gas/Utils.gs`, `gas/Pengaturan.gs`, atau `gas/99-TemplateSurat.gs`; jalankan `npm run smoke:drive -- --confirm` hanya bila folder uji produksi perlu direalisasikan.

---

## [Keamanan & Operasional] — Jalur Pemulihan Sandi SUPERADMIN (2026-10-10, backend — perlu 1× `npm run deploy:gas`)

**Masalahnya bukan teoretis:** `login` sengaja menjawab pesan yang **sama** untuk "username tidak ditemukan" dan "sandi salah" (supaya orang luar tidak bisa memetakan daftar akun). Akibat sampingnya, ketika kredensial admin ditolak, operator **tidak bisa mengetahui sebabnya dari layar** dan tidak punya jalan keluar selain menebak — persis jalan buntu yang dilaporkan. Ditambah lagi dua sumber kegagalan yang tak terlihat dari UI: `PASSWORD_SALT` yang berubah (semua hash lama langsung tidak berlaku) dan akun yang `is_active = FALSE`.

### 🌟 Yang ditambahkan (semua di [gas/Auth.gs](gas/Auth.gs))
- **`pemulihanSandiEditor()` — pintu masuk tanpa argumen.** Tombol **Run** di editor Apps Script tidak bisa mengirim argumen, jadi inilah satu-satunya fungsi yang perlu dijalankan operator: masukannya dibaca dari Script Properties (`PEMULIHAN_USERNAME`, opsional `PEMULIHAN_SANDI_UJI`, `PEMULIHAN_SANDI_BARU`, `PEMULIHAN_AKTIFKAN`). Tanpa `PEMULIHAN_SANDI_BARU` ia **hanya mendiagnosa** (tidak menyentuh data); properti sandi **selalu dihapus** di blok `finally` sehingga tidak ada sandi yang tertinggal di Script Properties.
- **`diagnosaKredensial(username, sandiUji)`** membedakan lima sebab dengan jelas: `KREDENSIAL_COCOK`, `SANDI_SALAH`, `PERLU_SANDI_UJI`, `AKUN_NONAKTIF`, `AKUN_TIDAK_DITEMUKAN` — lengkap dengan laporan yang menyarankan langkah berikutnya, menyebut dari mana salt diambil (Script Property vs `KONFIG`), dan **menyarankan ejaan username** (salah ketik 1–2 huruf seperti `superadminn`, atau beda pemisah seperti `super admin`) tanpa pernah menerima login dengan tebakan itu.
- **`pemulihanSandiPengguna(username, sandiBaru, ulangi, opsi)`** menyetel ulang sandi: panjang minimum 10 karakter, ulangan wajib sama, **semua penolakan terjadi sebelum data disentuh**, sesi lama akun itu dicabut (token bocor ikut mati), dan jejak audit `PASSWORD_RESET` mencatat pelaku (email pemilik project saat dijalankan dari editor, dengan cadangan `operator-editor`). Opsi `aktifkanKembali: true` mengaktifkan akun nonaktif; tanpa opsi itu akun **tetap** nonaktif (pemulihan tidak diam-diam mengubah status akun).
- **Sandi tidak pernah dicatat**: ringkasan fungsi, panel Executions, jejak audit, dan Script Properties tidak memuat sandi lama maupun baru — hanya panjang sandi baru.
- **Tidak bisa dipanggil lewat HTTP**: ketiga fungsi (beserta helper-nya) **tidak** didaftarkan di `ROUTES`, jadi `doPost`/`doGet` menjawab *"Aksi tidak dikenali."*; hanya pemilik project yang bisa menjalankannya dari editor.
- **Untuk kasus tidak ada admin sama sekali:** laporan diagnosa mengarahkan ke `seedDemoUsers()` (fungsi editor yang sudah ada, **tidak menimpa akun yang sudah ada**) — jalur ini tidak butuh login portal.

### ✅ Verifikasi (semua lulus, tanpa jaringan)
| Pemeriksaan | Hasil |
|---|---|
| `npm run smoke:auth` ([scripts/smoke-auth-recovery.mjs](scripts/smoke-auth-recovery.mjs)) | **85 lulus, 0 gagal** (± 3 detik) di atas Spreadsheet tiruan — login & sesi sungguhan berjalan di sana |
| Sebab bisa dibedakan | `KREDENSIAL_COCOK` · `SANDI_SALAH` · `PERLU_SANDI_UJI` · `AKUN_NONAKTIF` · `AKUN_TIDAK_DITEMUKAN` (termasuk saran ejaan `superadminn`/`super admin`) |
| Penolakan aman | username kosong · sandi < 10 karakter · ulangan berbeda · akun tidak ada → **hash tidak berubah, audit tidak bertambah, sesi tidak dicabut** |
| Pemulihan berlaku | sandi lama ditolak · sandi baru diterima · 2 sesi lama dicabut · **sesi akun lain tidak tersentuh** · `PASSWORD_RESET` tercatat beserta pelaku · tidak ada sandi di balikan/audit/log |
| Pintu editor | `PEMULIHAN_SANDI_UJI`/`PEMULIHAN_SANDI_BARU` terhapus sesudah pemanggilan · `PEMULIHAN_AKTIFKAN=TRUE` mengaktifkan akun nonaktif · tanpa opsi itu akun tetap nonaktif |
| Tidak bisa lewat HTTP | 9 nama fungsi pemulihan diperiksa **tidak ada di `ROUTES`** + `doPost`/`doGet` menjawab *"Aksi tidak dikenali"* dan tidak mengubah data |
| **Kontrol negatif** | Salinan sementara `apps-script/Code.gs` **plus** route `pemulihanSandiPengguna` → uji melaporkan **2 kegagalan, kode keluar 1** (penjaga ini bukan lulus semu) |
| Gerbang pra-push | `npm run gate:push` → **14/14 lulus** (uji ini ikut di dalamnya) |

### 📄 Dokumentasi
- **[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) §14** — prosedur lengkap: tentukan sebab (Langkah 1) → setel ulang (Langkah 2) → **buktikan** hasilnya (Langkah 3: login jendela penyamaran, sandi lama harus mati, sesi lain putus, jejak audit), beserta tabel aturan keamanannya dan cara memverifikasi prosedurnya sendiri lewat `npm run smoke:auth`.
- **§7** kini mengarahkan ke §14 alih-alih menyarankan `setup()` ulang, karena `setup()` **tidak** mengubah sandi akun yang sudah ada (sumber kebingungan sebelumnya).

### ⚠️ Belum dilakukan (jujur)
- **Belum dideploy.** Jalur ini baru ada di `gas/` + `apps-script/` lokal; project produksi (Versi 15) belum memuatnya sampai `npm run deploy:gas` dijalankan — dan sejak itu Versi 16 menjadi angka yang dilaporkan `ping`.
- Pemulihan diuji terhadap **Spreadsheet tiruan**, bukan terhadap database produksi. Bukti di produksi menyusul secara alami saat prosedur ini dipakai sungguhan (jejak `PASSWORD_RESET` akan muncul di Jejak Audit).
- Uji `smoke:auth` (85 pemeriksaan) **butuh bundel hasil build**, jadi ia termasuk 5 pemeriksaan yang dilewati di CI (mode `--ci`) — ia berjalan di gerbang pra-push lokal, bukan di GitHub Actions. Angka "14/14" di tabel atas adalah gerbang lokal saat tulisan ini dibuat.

---

## [Gerbang Kualitas] — Uji UI Portal di PERAMBAN SUNGGUHAN terhadap Alamat Preview (2026-10-10)

**Masalahnya:** tiga bug 2026-10-10 (penjaga demo memblokir aksi login, `self.bootApp is not a function`, tombol **Masuk** yang diam) tidak terlihat oleh `node -c`, build, maupun lint — semuanya baru muncul saat **peramban sungguhan** merender halaman dan seseorang mengklik tombol. Uji yang ada sebelumnya (`smoke:portal`, `smoke:portal:ui`) berjalan di DOM tiruan; ia mengunci logikanya, tetapi tidak pernah memuat halaman dari sebuah ALAMAT. Padahal yang menjadi produksi bagi pengurus adalah **preview deployment** dari branch — bukan salinan lokal di laptop pemilik. Bagian ini menutup celah itu dan memasangnya di jalur otomatis.

### 🌟 Yang ditambahkan
- **Uji peramban sungguhan** ([scripts/smoke-portal-live.mjs](scripts/smoke-portal-live.mjs), `npm run smoke:portal:live`) — **tanpa paket npm baru**: skrip menyajikan folder `portal/` sendiri (server statis Node), meluncurkan **Chrome/Edge yang sudah terpasang** secara headless, dan mengendalikannya lewat Chrome DevTools Protocol memakai WebSocket bawaan Node 22+.
  - **Klik dengan tetikus sungguhan** (`Input.dispatchMouseEvent`) pada tombol **Masuk** dan **Masuk sebagai Akun Demo** — bukan `.click()` dari skrip, sehingga elemen yang tertutup/berukuran nol pun ketahuan.
  - **Skenario bug yang dilaporkan:** halaman dimuat dari keadaan **sesi demo basi** (token demo tersimpan di `localStorage` + `#login`) lalu formulir Masuk diisi lewat input sungguhan dan diklik — mengunci dua bug sekaligus (penjaga demo & `self.bootApp`).
  - **Tidak menyentuh produksi:** permintaan API dicegat di sisi halaman (stub `fetch` + perekam), lalu sebagai sabuk pengaman kedua nama host API dipetakan ke alamat mati saat peramban diluncurkan. Mode `--live` (login sungguhan + tutup sesi, butuh `APII_TEST_USER`/`APII_TEST_PASS`, menulis 2 baris audit) **hanya** bila diminta eksplisit.
  - **Bisa diarahkan ke alamat mana pun:** `--url https://siapii-xxx.vercel.app` (preview Vercel) atau `--root <folder>` (hasil build lain).
- **Ikut di gerbang pra-push** ([scripts/pre-push-gate.mjs](scripts/pre-push-gate.mjs), kini **14 pemeriksaan**, ± 15 detik): uji peramban berjalan otomatis sebelum kode pergi ke remote. Bila peramban tidak tersedia, uji keluar dengan kode **2** dan gerbang mencetaknya sebagai **dilewati beserta alasannya** — bukan lulus diam-diam, bukan pula gagal.
- **Otomatis pada preview deployment:** [.github/workflows/portal-preview.yml](.github/workflows/portal-preview.yml) dipicu `deployment_status` dari Vercel — begitu preview **berhasil**, uji peramban dijalankan pada alamat preview itu (deployment produksi dilewati karena sudah tayang). Bisa juga dijalankan manual (Actions → *Run workflow* beserta alamatnya).
- **Uji yang sama juga berjalan di CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)): Node dinaikkan ke **22.x** (WebSocket bawaan) dan Chrome tersedia di runner, jadi uji peramban ini termasuk **9 dari 14** pemeriksaan yang benar-benar dijalankan di CI; 5 pemeriksaan yang butuh bundel hasil build tetap dilewati dengan alasan tercetak.

### ✅ Verifikasi (semua dijalankan 2026-10-10)
| Pemeriksaan | Hasil |
|---|---|
| `npm run smoke:portal:live` pada portal asli | **24 lulus, 0 gagal**, kode keluar 0, ± 4–11 detik (bergantung waktu luncur peramban) |
| Gerbang pra-push lokal (14 pemeriksaan) | **14/14 lulus**, kode keluar 0, ± 10–12 detik — dijalankan berulang (3×) tanpa kegagalan sesekali |
| Mode CI pada salinan **tanpa** bundel | **9 dijalankan (semua lulus) · 5 dilewati** dengan alasan, kode keluar 0 — dijalankan **3×** berturut-turut tanpa flake |
| **Kontrol negatif 1** — bug `self.bootApp` dikembalikan ke salinan | **4 gagal, kode keluar 1**, pesannya persis laporan pengurus: `self.bootApp is not a function` |
| **Kontrol negatif 2** — penjaga demo memblokir login lagi + `clear()` sebelum login dihapus | **5 gagal, kode keluar 1**, dengan pesan produksi: *"Mode demo hanya untuk melihat…"* |
| Mode `--url` ke server terpisah (`http://127.0.0.1:3123/`) | **24 lulus**, kode keluar 0 — membuktikan jalur "uji ke alamat" bekerja |
| Tanpa peramban (`PORTAL_BROWSER` salah) | Kode keluar **2**; gerbang mencetak `dilewati (lingkungan)` dan **tetap** lulus pemeriksaan lain — tidak ada hijau palsu |
| YAML kedua workflow | Sah (diurai ulang) |

> **Catatan kejujuran:** uji ini menilai **alur login** (tombol, penyimpanan sesi, aplikasi terbuka) — bukan kebenaran seluruh halaman. Stub sengaja tidak menyediakan data dashboard, dan exception yang berasal dari stub itu (bertanda `UJI:`) dilaporkan sebagai info, bukan kegagalan; semua galat **lain** tetap menggagalkan uji. Pemicu `deployment_status` belum bisa dijalankan di mesin lokal — bukti pertamanya akan datang dari preview Vercel yang sungguhan; bila Vercel tidak menyertakan `environment_url`, langkahnya mencetak peringatan **dan melewatkan uji** secara terlihat, bukan diam-diam. Butuh **Chrome/Edge** serta **Node 22+**; pada mesin tanpa keduanya, perlindungannya kembali ke uji DOM tiruan + pemindai statis.

---

## [Gerbang Kualitas] — Pemindai Variabel Global Frontend & Gerbang Pra-Push (2026-10-10)

Dua bug 2026-10-10 (lihat bagian berikutnya) sama-sama lolos dari `node -c`, build, dan lint biasa: `self` di peramban adalah **global yang terdaftar** (`self === window`), jadi pemeriksa mana pun yang hanya bertanya "apakah nama ini dikenal?" akan menjawab "ya" — persis saat kode menunjuk objek yang salah. Bagian ini menutup kelas bug itu dan memasang pemeriksanya di jalur push.

### 🌟 Yang ditambahkan
- **Pemindai sadar-lingkup** ([scripts/check-frontend-globals.mjs](scripts/check-frontend-globals.mjs), `npm run check:frontend`):
  1. **Alias window** — `self`, `top`, `parent`, `frames`, `globalThis` tidak boleh dipakai sebagai objek implisit kecuali ada deklarasi pada fungsi yang **melingkupinya**. Inilah bedanya dengan grep: `var self` di fungsi lain tidak menolong (dan itulah bentuk bug yang terjadi).
  2. **Nama tak dikenal** — identifier yang dipakai sebagai objek (`X.y`, `X(`, `X[...]`) tetapi tidak dideklarasikan, tidak didefinisikan berkas lain di folder frontend yang sama (`window.X = …`), dan bukan global peramban/library yang dikenal → salah ketik nama seperti `Auh.toast(...)` tertangkap.
  Pemindai mengosongkan komentar, string, dan literal regex lebih dulu (termasuk **flag** `/…/i` yang sempat menimbulkan temuan palsu) sambil menjaga posisi karakter, sehingga nomor baris yang dilaporkan tetap benar. Cakupan: `portal/` dan `public/` (folder `frontend/` tidak ikut — aplikasi React/TypeScript terpisah yang sudah diperiksa `tsc`).
- **Uji pemindainya sendiri** ([scripts/smoke-frontend-globals.mjs](scripts/smoke-frontend-globals.mjs), `npm run smoke:frontend`): **24 pemeriksaan** yang membuktikan pemindai benar-benar bekerja, bukan sekadar berkata "aman": versi rusak dari bug kemarin **harus** tertangkap (dengan nomor baris di sekitar handler tombol demo), berkas asli harus bersih, `var self` di fungsi lain **tidak** boleh dianggap menolong, salah ketik nama harus terdeteksi pada berkas nyata, dan pola lazim (kunci objek, `/…/i.test`, string/komentar berisi `self.`) tidak boleh menghasilkan temuan palsu.
- **Gerbang pra-push** ([.githooks/pre-push](.githooks/pre-push) + [scripts/pre-push-gate.mjs](scripts/pre-push-gate.mjs), `npm run gate:push`): 12 pemeriksaan offline (± 13 detik) sebelum kode pergi ke remote — **angka saat tulisan itu dibuat**; sejak uji peramban ditambahkan, gerbang berisi **14 pemeriksaan** (lihat bagian paling atas). Diaktifkan sekali per klon dengan `npm run hooks:install` ([scripts/install-hooks.mjs](scripts/install-hooks.mjs) menyetel `core.hooksPath=.githooks`). Lewati darurat: `SKIP_GATE=1 git push`. Bila `node` tidak ada, hook melewati dirinya sendiri dengan peringatan alih-alih menggagalkan push yang sah.
- **CI menjalankan gerbang yang sama** ([.github/workflows/ci.yml](.github/workflows/ci.yml), langkah *Pre-Push Gate*) dalam **mode `--ci`** ([scripts/pre-push-gate.mjs](scripts/pre-push-gate.mjs)): 8 pemeriksaan mandiri dijalankan, 5 pemeriksaan yang membaca bundel `apps-script/*.gs` dilewati dan **dicetak sebagai daftar "dilewati" beserta alasannya** — bundel hasil build memang tidak ikut ke repositori karena aset sumbernya (`Dokumen Sumber/`) juga tidak. Gerbang lengkap (saat itu 13/13, kini 14/14) berjalan otomatis di hook pra-push pada mesin yang punya `Dokumen Sumber/`. Dokumentasi: [docs/VERSION_CONTROL.md](docs/VERSION_CONTROL.md) §4b–§4c.

### ✅ Verifikasi (semua lulus)
| Pemeriksaan | Hasil |
|---|---|
| `npm run check:frontend` | **5 berkas dipindai, 0 temuan** (`portal.js`, `auth.js`, `config.js`, `app.js`, `config.js` publik) |
| `npm run smoke:frontend` | **24 lulus, 0 gagal** — termasuk kontrol negatif bug `self` 2026-10-10 dan salah ketik pada berkas nyata |
| `npm run gate:push` | **12/12 lulus** dalam ± 12,5 detik (bukan sekadar cepat: setiap pemeriksaan dibaca kode keluarnya) |
| Hook end-to-end (`.githooks/pre-push`, input stdin seperti `git push`) | Dengan berkas berisi `self.tidakAda()` → **exit 1** dan push ditolak beserta berkas + barisnya; setelah berkas dihapus → **exit 0**. Berkas uji sementara dibersihkan |

> **Catatan kejujuran:** pemindai ini menutup satu **kelas bug** (alias window & nama tak dikenal), bukan kebenaran menyeluruh. Pemeriksaan nama tak dikenal sengaja permisif — nama yang dideklarasikan di mana pun pada folder frontend yang sama dianggap sah — supaya tidak menuduh kode yang benar; konsekuensinya, salah ketik yang kebetulan sama dengan nama variabel lokal berkas lain tidak tertangkap. Kontrol negatif di uji smoke yang menjaga agar pemeriksaan ini tidak pernah "lulus secara semu".

---

## [Perbaikan Portal] — Tombol Masuk & Akun Demo (2026-10-10, tanpa rilis backend baru)

Perbaikan **frontend saja** ([portal/portal.js](portal/portal.js), [portal/auth.js](portal/auth.js)): router & backend Apps Script tidak disentuh, sehingga **tidak ada Versi baru** dan URL `/exec` tidak berubah. Perubahan tayang begitu `git push origin main` memicu build Vercel kedua portal ([docs/deploy.md](docs/deploy.md) §3).

### 🐞 Bug 1 — penjaga mode demo menutup pintu masuknya sendiri
- **Gejala (dilaporkan pemilik sistem, 2026-10-10):** di peramban yang masih menyimpan identitas demo, menekan **Masuk** dengan akun superadmin hanya memunculkan notifikasi *"Mode demo hanya untuk melihat. Perubahan data tidak dapat disimpan."* dan permintaannya tidak pernah dikirim ke server; tombol **Masuk sebagai Akun Demo** pun sama.
- **Sebab:** penjaga demo di [portal/auth.js](portal/auth.js) menolak **semua** POST selama sesi demo aktif, padahal aksi sesi (`login`, `loginDemo`, `logout`, `me`, `registerAnggota`) juga POST — jadi tukar-menukar sesi mustahil, tidak ada jalan keluar dari mode demo.
- **Perbaikan:** `DEMO_GUARD_EXEMPT_ACTIONS` — kelima aksi sesi selalu sampai ke server; penjaga read-only tetap menolak setiap aksi tulis di klien (tanpa menyentuh jaringan) dan backend tetap penjaga mutlak. `Auth.login()`/`Auth.loginAsDemo()` membuang identitas lama (`Auth.clear()`) sebelum menukar sesi supaya tidak ada sisa user demo yang menyertai sesi baru.

### 🐞 Bug 2 — `App.showLogin()` tanpa `var self` (login demo berhasil, aplikasi tidak pernah terbuka)
- **Gejala:** menekan **Masuk sebagai Akun Demo** menyimpan sesi demo (token + user demo ada di `localStorage`) tetapi aplikasi tidak terbuka; halaman login menampilkan pesan merah **"self.bootApp is not a function"**.
- **Sebab:** `showLogin()` memakai `self` tanpa mendeklarasikannya. Di peramban `self` adalah alias global untuk `window`, sehingga handler tombol demo memanggil `window.self.bootApp(...)` → `undefined`. Galat itu ditangkap `.catch` handler dan dituliskan ke kotak pesan halaman login — pesan yang terlihat pengguna adalah jejak bug ini.
- **Perbaikan:** `var self = (this && this.bootApp) ? this : window.App;` di awal `showLogin()` (pola yang sama dengan `App.router()`), dan handler tombol demo kini dipasang **sekali** (`self._demoBound`) sehingga satu klik tidak mengirim beberapa `loginDemo` (membuat beberapa sesi demo) ketika `showLogin()` dipanggil berulang dalam satu siklus halaman (mis. setelah login gagal).

### 🧪 Verifikasi (semua lulus)
| Pemeriksaan | Hasil |
|---|---|
| `npm run smoke:portal` ([scripts/smoke-portal-demo-guard.mjs](scripts/smoke-portal-demo-guard.mjs), baru) | **15 lulus, 0 gagal** — aksi sesi selalu sampai server meski identitas demo tersimpan · aksi tulis tetap ditolak di klien tanpa jaringan + notifikasi demo muncul · sesi baru menggantikan identitas lama · sesi non-demo tidak terblokir |
| `npm run smoke:portal:ui` ([scripts/smoke-portal-login-button.mjs](scripts/smoke-portal-login-button.mjs), baru) | **17 lulus, 0 gagal** — memuat `portal.js` + `auth.js` **asli** di DOM tiruan bersemantik peramban (`self === window`): klik tombol demo → `App.bootApp(user demo)` terpanggil, tanpa pesan galat · satu klik = satu `loginDemo` walau `showLogin()` diulang · formulir **Masuk** membuka aplikasi untuk superadmin · pemindai `self.` tanpa deklarasi menangkap ulang versi rusak (kontrol negatif) |
| Verifikasi peramban sungguhan (dev server lokal, berkas repo, backend produksi) | Klik **Masuk sebagai Akun Demo** → Dashboard terbuka dengan banner **Mode Demo (hanya lihat)**, 5 menu (tanpa Manajemen Pengguna/Jejak Audit/Pengaturan), sesi demo lalu ditutup via `logout`. Jejak jaringan mengonfirmasi `loginDemo` dikirim sebagai POST dan sesi demo dipakai untuk prefetch rute yang diizinkan |
| Sidik jari berkas yang disajikan | Berkas yang disajikan server lokal **identik** dengan berkas repo (SHA-256 `portal/portal.js` sama) — yang diuji memang artefak yang dikirim |

> **Yang perlu diketahui operator:** perbaikan ini **belum tayang di `siapii.sigitadi.id`** sampai perubahan di-commit & `git push origin main` (Vercel membangun portal dari folder `portal/`). Sampai itu terjadi, portal produksi masih memuat `portal.js`/`auth.js` versi lama dan gejala di atas masih bisa muncul di sana.

---

## [Versi 15] — Pemecahan Build Backend, Deploy Mandiri & Laporan Versi (internal, rilis 2026-10-10, aplikasi 2.5.0)

### 🔧 Maintenance
- **Build backend dipecah per modul** ([scripts/build-apps-script.ps1](scripts/build-apps-script.ps1)): dulu seluruh backend digabung jadi satu `apps-script/Backend.gs` yang tembus **256.907 karakter** (hampir 3× ambang peringatan 90.000 di skrip build sendiri). Kini tiap modul `gas/*.gs` diemit ke file `.gs` sendiri di `apps-script/` — file backend terbesar `Auth.gs` (~29.700 karakter); hanya aset base64 (`AsetStempel.gs` ~53.400) yang lebih besar. Logika, urutan eksekusi, dan scope global Apps Script **tidak berubah** — murni pembagian file, memberi ruang untuk modul mendatang.
- **Sumber `gas/Utils.gs` (74.968 karakter) dipecah** ([scripts/split-utils.mjs](scripts/split-utils.mjs), sekali jalan) menjadi:
  - [gas/Utils.gs](gas/Utils.gs) — helper umum, audit log, dashboard, `getSettingValue_`/`setSettingValue_` (~18,5 ribu karakter).
  - [gas/Editorial.gs](gas/Editorial.gs) — konten redaksi dinamis (mini-CMS portal publik).
  - [gas/Pengaturan.gs](gas/Pengaturan.gs) — route pengaturan & penyimpanan Drive (`getSettings`, `saveSettings`, `createDriveFolder`, `moveDriveFolder`, `resetDriveStorage`, `syncEditorialContent`).
- **Skrip uji & validasi disesuaikan** tanpa mengubah pengujian: [scripts/validate-apps-script.mjs](scripts/validate-apps-script.mjs) memvalidasi tiap file `.gs` sendiri, **memeriksa tidak ada function/var global ganda antar modul** (semua file .gs digabung jadi satu scope global di Apps Script — definisi ganda memakai salinan usang), dan gagal bila `Backend.gs` peninggalan masih ada; [scripts/smoke-backend.mjs](scripts/smoke-backend.mjs), [scripts/smoke-editorial.mjs](scripts/smoke-editorial.mjs), dan [scripts/smoke-drive-local.mjs](scripts/smoke-drive-local.mjs) memakai reader bersama baru [scripts/backend-modules.mjs](scripts/backend-modules.mjs).
- **Gerbang definisi ganda sebelum deploy** ([scripts/check-legacy-duplicates.mjs](scripts/check-legacy-duplicates.mjs), baru): menarik isi editor Apps Script yang **sesungguhnya** (`clasp pull`) lalu (1) melaporkan berkas yang bukan keluaran build, (2) menghitung definisi ganda antara berkas lama dan modul baru, (3) memastikan **setiap** simbol berkas lama juga ada di modul baru sehingga penghapusan terbukti tidak menghilangkan fungsi — bila ada yang belum pindah hasilnya menyatakan **JANGAN hapus** beserta daftar simbolnya, dan (4) memeriksa definisi ganda antar modul baru sendiri. Melengkapi pemeriksaan duplikat **lokal** yang sudah ada di [scripts/validate-apps-script.mjs](scripts/validate-apps-script.mjs) (regex, hanya melihat hasil build) dengan sisi yang selama ini tak terlihat: isi editor yang sesungguhnya. Pemindai simbolnya sengaja melewati komentar/string/regex/template dan hanya mencatat deklarasi scope global (fungsi/var/let/const/class). Pakai: `npm run check:legacy` (kode keluar 0 bersih · 1 ada temuan · 2 tak dapat diverifikasi), `--json`, `--from <dir>` (simpan hasil tarikan), `--no-pull` (offline).
- **Deploy kini bergerbang, bukan sekadar mengingatkan**: [scripts/deploy-gas.mjs](scripts/deploy-gas.mjs) menjalankan pemeriksaan di atas sebagai **langkah 7** — setelah `clasp push`, **sebelum** `create-version`. Bila editor masih berisi berkas lama yang **bukan** keluaran build, deploy membersihkannya sendiri (langkah 7b, lihat butir berikut); deploy hanya berhenti — produksi `/exec` tidak berubah — bila ada simbol berkas lama yang **belum pindah** ke modul baru, sebab itu keputusan manusia. `create-version` + `update-deployment` hanya jalan setelah editor bersih (langkah 8 & 9). Dengan begitu versi baru tidak pernah dibuat selagi definisi ganda masih ada — jalur kegagalan "Aksi tidak dikenali" ditutup.
- **Pembersihan berkas lama otomatis lewat Apps Script API** ([scripts/remove-legacy-files.mjs](scripts/remove-legacy-files.mjs), baru): mengirim **seluruh** berkas `apps-script/` ke endpoint `projects.updateContent` lewat helper OAuth yang sama dengan [scripts/smoke-drive-prod.mjs](scripts/smoke-drive-prod.mjs) (`~/.clasprc.json` → refresh token), dan karena endpoint itu mengganti seluruh isi project, berkas yang tidak ada di build (**mis. `Backend.gs` tunggal**) ikut terhapus. Aman: (1) memakai **gerbang kelayakan yang sama** dengan deploy — menarik isi editor dulu dan berhenti bila ada simbol berkas lama yang **belum pindah** ke modul baru; (2) **hanya** menghapus berkas non-build (daftar harapan diambil dari `apps-script/`, aset & manifest dihormati), bukan berkas pilihan bebas; (3) bila keadaannya sudah bersih, ia **tidak menulis apa pun** (no-op); (4) `--dry-run` (bawaan) hanya merencanakan, `--yes` yang menulis, `--json` untuk mesin. Butuh scope `script.projects`; tanpa kredensial hasilnya menyatakan **tidak dapat diverifikasi** dan **tidak pernah** mengklaim bersih.  Kode keluar: 0 bersih/dibersihkan · 1 tak berhasil atau ada temuan · 2 tak dapat diverifikasi.
- **Langkah 7b pada deploy: pembersihan otomatis sebelum versi dibuat**: [scripts/deploy-gas.mjs](scripts/deploy-gas.mjs) kini menjalankan pembersih di atas **setelah** `clasp push` dan gerbang langkah 7. Bila masih ada berkas non-build, deploy membersihkannya sendiri (tidak lagi "klik Delete manual"), sementara keadaan "ada simbol belum pindah" tetap **menghentikan deploy** (produksi `/exec` tidak berubah) karena itu keputusan manusia, bukan pembersihan mekanis. Flag `--no-cleanup` melewati langkah ini untuk pemakaian khusus.
- **Laporan versi `ping` dari satu sumber otomatis** ([scripts/stamp-build-info.mjs](scripts/stamp-build-info.mjs), baru): menghasilkan [apps-script/Versi.gs](scripts/stamp-build-info.mjs) berisi `APP_BUILD_INFO = { version, release }` — `version` dibaca dari `package.json` saat build, `release` (nomor Versi Apps Script) dicap deploy tepat sebelum push dan di-**`null`** bila bundel belum dirilis (lebih baik mengaku belum dirilis daripada mengarang nomor). [gas/Code.gs](gas/Code.gs) hanya membaca `APP_BUILD_INFO` (dengan penjagaan `typeof`), jadi tidak ada lagi angka versi literal di kode yang bisa basi. Gerbang anti-drift di [scripts/validate-apps-script.mjs](scripts/validate-apps-script.mjs): build **gagal** bila versi di `Versi.gs` ≠ `package.json`, bila `release` bukan angka/`null`, atau bila `Code.gs` kembali memuat versi literal — tiga-tiganya dibuktikan gagal secara sengaja sebelum gerbang itu dilepas.
- **Langkah 5b pada deploy: nomor rilis dicap & dicocokkan**: [scripts/deploy-gas.mjs](scripts/deploy-gas.mjs) membaca versi terakhir dari `clasp versions --json`, mencetak nomor berikutnya ke `apps-script/Versi.gs` lewat [scripts/stamp-build-info.mjs](scripts/stamp-build-info.mjs) (lalu memvalidasi ulang bundel), dan di langkah 8 membandingkan nomor yang **benar-benar dibuat** `create-version` dengan yang dicap. Bila tidak sama, deploy berhenti **sebelum** `update-deployment` — produksi tetap menyajikan versi lama, bukan versi yang melaporkan nomor rilis salah. Bila daftar versi tak terbaca, deploy berjalan dengan `release: null` disertai peringatan (bukan angka karangan). Flag `--no-release-stamp` mematikan pencapan.
- **Tiga uji smoke baru tanpa jaringan**: `npm run smoke:legacy` ([scripts/smoke-legacy-dedup.mjs](scripts/smoke-legacy-dedup.mjs)) mengunci pemindai simbol & tiap cabang keputusan detektor dengan fixture; `npm run smoke:deploy` ([scripts/smoke-deploy-gate.mjs](scripts/smoke-deploy-gate.mjs)) menjalankan skrip deploy **asli** dengan `clasp` ditukar ke tiruan lokal untuk membuktikan urutan langkah, pesan, dan kode keluar pada keadaan editor kotor maupun bersih (termasuk cabang auto-cleanup); `npm run smoke:cleanup` ([scripts/smoke-legacy-cleanup.mjs](scripts/smoke-legacy-cleanup.mjs)) menguji tiap cabang keputusan pembersih lewat server tiruan HTTP yang memeriksa bentuk permintaan `updateContent` — **tidak menghapus apa pun** dan tidak menyentuh editor nyata. Ditambah `npm run smoke:version` ([scripts/smoke-version-report.mjs](scripts/smoke-version-report.mjs)) yang mengevaluasi bundel hasil build persis seperti di editor (harness `new Function` + `ContentService` tiruan) untuk memastikan `ping` melaporkan `version`/`release` yang dicap, melaporkan `null` (bukan angka karangan) saat bundel belum dirilis atau `Versi.gs` tidak ada, dan menolak argumen pencap yang tidak sah tanpa menulis berkas.

### ✅ Verifikasi (semua lulus)
| Pemeriksaan | Hasil |
|---|---|
| `npm run build:gas` (termasuk prebuild route-validator) | 17 file output (kini termasuk `Versi.gs`), 0 namespace tertinggal, file backend terbesar 29.700 karakter |
| `node scripts/validate-apps-script.mjs` | 16 file `.gs` + manifest lulus validasi syntax, 194 simbol global unik (0 ganda), versi `Versi.gs` = `package.json` |
| `node scripts/smoke-backend.mjs` | 66 lulus, 0 gagal |
| `node scripts/smoke-editorial.mjs` | 138 lulus, 0 gagal |
| `node scripts/smoke-drive-local.mjs` | 16 lulus, 0 gagal (regresi bug reset Drive tetap terkunci) |
| `node scripts/smoke-template-surat.mjs` | 60 lulus, 0 gagal |
| `node scripts/check-legacy-duplicates.mjs` (editor nyata, 2026-10-10) | 193 simbol di 15 berkas build, 0 definisi ganda antar modul · editor masih 4 berkas termasuk `Backend.gs` (200.786 byte, 154 simbol) → **154 definisi ganda, 0 simbol belum pindah** → kode keluar 1 (deploy ditahan) |
| `npm run smoke:legacy` | 21 lulus, 0 gagal |
| `npm run smoke:deploy` | 27 lulus, 0 gagal (editor kotor → pembersih dijalankan otomatis; simbol belum pindah → deploy berhenti sebelum versi dibuat; editor bersih → tidak ada penulisan; nomor rilis dicap sebelum push & dicocokkan dengan versi yang dibuat; `--no-release-stamp` → `release: null`) |
| `npm run smoke:version` | 21 lulus, 0 gagal (versi dari `package.json` · `release` dari cap deploy · `null` saat belum dirilis · tetap menjawab tanpa `Versi.gs` · argumen pencap tidak sah ditolak tanpa menulis berkas) |
| `npm run smoke:cleanup` | 23 lulus, 0 gagal (no-op saat bersih · bersihkan saat ada berkas lama · tolak saat simbol belum pindah · tak dapat diverifikasi saat tanpa kredensial · `--dry-run` tidak menulis) |
| `npm run deploy:gas` (rilis sungguhan, 2026-10-10 01:41 WIB) | **exit 0** — 17 berkas terunggah, langkah 5b mencetak `release 15 dicap ke apps-script/Versi.gs (versi terakhir di Apps Script: 14)`, editor bersih 17 berkas, `Versi 15 dibuat` + `Laporan ping cocok dengan rilis ini (release 15)`, deployment `…NJdg` diperbarui ke Versi 15 |
| Produksi pasca-deploy (`/exec`) | `ping` HTTP 200 `version 2.5.0` + `release 15` · 4 route konten (`getPublicSettings`, `getPublishedSurat`, `getPublicAccounts`, `getPublicFeed`) **byte-identik** sebelum vs sesudah (SHA-256 sama) · **10/10** route terproteksi menjawab *"Sesi berakhir atau tidak valid"* (0 *"Aksi tidak dikenali"*) · `verifySurat` → *sah* untuk `002/SK/DPW-APII/X/2026`, *tidak ditemukan* untuk nomor palsu · kedua portal HTTP 200 (65.009 & 16.429 byte) |
| Pasca-deploy di sisi repo | `npm run check:legacy` → exit 0 (17 berkas, 0 berkas lama, 0 definisi ganda) · `npm run cleanup:legacy` → exit 0 (*"Tidak ada berkas lama di editor"*) · 12 pemeriksaan lokal lulus ulang di keadaan ber-release 15 |

> **Ternyata `clasp push` sendiri sudah menghapus `Backend.gs`.** Langkah 7 di rilis ini lulus tanpa intervensi: `clasp push` mengirim seluruh berkas lokal ke `projects.updateContent`, dan endpoint itu mengganti seluruh isi project — berkas yang tidak ada di `apps-script/` ikut terhapus. Klaim lama dokumen proyek (*"clasp tidak pernah menghapus berkas di editor"*) **tidak benar** dan sudah dikoreksi; gerbang definisi ganda tetap berguna sebagai jaring pengaman (clasp versi lama / unggahan sebagian) dan kini berpasangan dengan pembersih otomatis untuk kasus itu.
>
> **Sudah di-deploy sebagai Versi 15** (2026-10-10 01:41 WIB, aplikasi 2.5.0). Pada Versi 14, sebelum deploy `npm run check:legacy` melaporkan editor masih memuat `Backend.gs` (200.786 byte, 154 simbol global, **154 definisi ganda**, 0 simbol belum pindah); sesudah `clasp push`, **langkah 7 menemukan editor sudah bersih tanpa intervensi manual** — pemeriksaan itu sendiri yang menutup jalur kegagalan "Aksi tidak dikenali", bukan lagi instruksi ke operator.
>
> **Rilis Versi 15 dijalankan penuh dan diverifikasi dari sisi produksi:** deploy exit 0 (17 berkas, langkah 5b mencetak `release 15 dicap … (versi terakhir di Apps Script: 14)`, langkah 8 `Laporan ping cocok dengan rilis ini (release 15)`, langkah 9 memperbarui `…NJdg` ke Versi 15). Sesudahnya: `ping` → `version 2.5.0` + `release 15`; empat route konten **byte-identik** dengan sebelum deploy; 10/10 route terproteksi menuntut sesi (0 *"Aksi tidak dikenali"*); `verifySurat` sah untuk nomor nyata & menolak nomor palsu; `npm run check:legacy` → kode keluar 0 (17 berkas, 0 berkas lama); `npm run cleanup:legacy` → tidak ada berkas lama; portal `apii.sigitadi.id` & `siapii.sigitadi.id` HTTP 200; 12 pemeriksaan lokal lulus. Rincian: [docs/deploy.md](docs/deploy.md) §Langkah 2 & 2b.

---

## [2.5.0] — 2026-10-09 (Master Template Surat + Indeks Mesin Pencari)

### 🌟 Fitur Baru
- **Master Template Surat** (`gas/TemplateSurat.gs`, tab baru `Sheet_Templates`): setiap template = **PDF asli kop lembaga yang diunggah pengurus**, disimpan utuh di Drive dan dapat diunduh kembali, **plus** spesifikasi blok naskah (array `fields`) yang dipakai merangkai surat jadi PDF resmi.
  - Tiga endpoint baru: `getLetterTemplates` (baca, `SURAT_READ_ROLES`), `saveLetterTemplate` (buat/perbarui + unggah master PDF, `SUPERADMIN`/`SEKRETARIS`), `deleteLetterTemplate` (soft delete — master PDF tidak dihapus dari Drive, `SUPERADMIN`).
  - **Delapan jenis blok naskah** dikenali mesin rendering: `jenis`, `nomor`, `judul`, `tanggal`, `label`, `field`, `spasi`, dan `ttd` (blok tanda tangan Sekretaris & Ketua + stempel). Spesifikasi bawaan disediakan untuk template default & fallback.
  - Karena Apps Script tidak dapat merasterisasi PDF di server, PDF akhir **dirangkai via Google Docs** dari spesifikasi blok — kop lembaga, badan surat, blok tanda tangan + stempel, dan footer verifikasi. Master PDF asli tetap dirujuk dan ditampilkan berdampingan di portal pengurus.
- **`template_id` terikat penuh pada surat**: `createSurat`/`updateSurat` menerima `template_id` yang divalidasi terhadap template aktif (`validasiTemplateId_`), dan `generateSuratPdf_` kini beralih ke `renderTemplatePdf_` bila surat memiliki template — yang lain memakai jalur lama.
- **Kartu manajemen Master Template di tab Pengaturan** portal pengurus ([portal/portal.js](portal/portal.js)): daftar template aktif (template default ditandai, tautan langsung ke master PDF di Drive), tombol **Unggah Template**, serta modal buat/ubah bernama lengkap, keterangan, master PDF, dan centang *Jadikan template default*.
  - **Editor blok naskah visual** di dalam modal: setiap baris satu blok dengan pilihan jenis (8 tipe), teks label, kunci+label field, ukuran font (7–24 pt), perataan kiri/tengah/kanan, tebal, serta tombol naik/turun untuk mengatur urutan dan tombol hapus. Ada tombol **＋ Tambah Blok** dan **↺ Susunan Bawaan**; ringkasan jumlah blok diperbarui langsung. Daftar yang dikosongkan akan memakai susunan bawaan saat disimpan.
  - **Pemilih template saat membuat surat**: dropdown di formulir surat (`suratForm`) memuat daftar template aktif via `getLetterTemplates` dan nilai `template_id` ikut dikirim ke `createSurat`/`updateSurat`.
  - **Peran SEKRETARIS kini dapat membuka tab Pengaturan**, namun hanya sub-tab **🧩 Master Template Surat** yang ditampilkan (sesuai RBAC `saveLetterTemplate`); sub-tab lain disembunyikan. KETUA melihat sub-tab tersebut dalam mode **hanya lihat** (tanpa tombol Ubah/Hapus), dan hanya SUPERADMIN yang dapat menonaktifkan template.
- **Indeks mesin pencari untuk portal publik** (`apii.sigitadi.id`): `public/robots.txt` (mengizinkan seluruh halaman, menutup `config.js` & `assets/`, menunjuk ke sitemap) dan `public/sitemap.xml` (6 URL: halaman utama + seksi `#profil`, `#warta`, `#informasi`, `#faq`, `#kontak`).

### 🛡️ Ketahanan
- **Memperbaiki bug decode data URL**: `saveLetterTemplate` sebelumnya memanggil `Utilities.base64Decode(p.pdf_base64)` secara mentah, padahal portal mengirim *data URL* (`data:application/pdf;base64,…`) — sehingga PDF master gagal terbuka. Kini header MIME dipisahkan lebih dulu, persis seperti `saveUploadToDrive_`.
- `saveLetterTemplate` menolak spesifikasi blok yang tidak sah (tipe campuran, blok tak dikenal) **tanpa menulis apa pun** ke `Sheet_Templates`, tetapi **daftar kosong dari editor visual kini jatuh ke susunan bawaan** (bukan error); unggahan master PDF hanya diterima bila base64 & nama file valid, dan disimpan ke subfolder khusus di dalam folder PDF surat.
- `deleteLetterTemplate` memakai soft delete sehingga riwayat surat yang pernah memakai template tersebut tetap merujuk entri yang ada; hanya `SUPERADMIN` yang dapat menonaktifkan.
- `validasiTemplateId_` menolak penunjuk ke template yang tidak ada/non-aktif, sehingga surat tidak pernah terikat pada template yang sudah dihapus.

### 🧪 Verifikasi & Dokumentasi
- `npm run build:gas` berhasil: `Backend.gs` 246.348 karakter + 2 berkas aset, **seluruh 200 referensi namespace bersih** (0 nama tertinggal), dan `node scripts/validate-apps-script.mjs` lulus penuh untuk ketiga berkas + manifest. `portal/portal.js` dan `gas/TemplateSurat.gs` juga lulus pemeriksaan syntax (`new Function`).
- `npm run deploy:gas:check` (dry-run) memastikan **tepat 4 berkas** yang akan diunggah; tidak ada yang dikirim ke produksi.
- robots.txt & sitemap.xml diuji lewat `serve public` di `localhost:3099`: keduanya **HTTP 200**, `robots.txt` bertipe `text/plain`, `sitemap.xml` bertipe `application/xml`, 6 entri `<url>` seimbang, dan sitemap lulus pemeriksaan well-formed `xml.dom.minidom`.
- Tiga endpoint baru + baris `template_id` ditambahkan ke tabel RBAC Modul Persuratan di [docs/rbac-matrix.md](docs/rbac-matrix.md).
- **Sudah tayang** sejak Versi 14 (2026-10-10 00:44 WIB) untuk sisi backend (Versi 15 menyusul pada 01:41 WIB tanpa mengubah apa pun di sini); `public/` (termasuk dua berkas statis baru) menyusul saat push ke `main` — Vercel men-deploy otomatis dari repositori. Tidak mengubah portal publik yang ada selain penambahan dua berkas statis.

---

## [2.4.0] — 2026-10-08 (Ekspor & Impor Konten Redaksi sebagai Berkas JSON)

### 🌟 Fitur Baru
- **Cadangan & pemindahan konten redaksi lewat berkas JSON**: tab `📰 Redaksi Konten` kini memiliki kartu **`8. Cadangan & Pemindahan Konten (Ekspor/Impor JSON)`**.
  - Panel **📤 Ekspor Konten Aktif** mengunduh satu berkas mandiri (`redaksi-apii-YYYY-MM-DD-HHMM.json`) berisi penanda format `apii-editorial-v1`, waktu & pelaku ekspor, asal lingkungan, ringkasan jumlah item, dan seluruh konten ternormalisasi.
  - Panel **📥 Impor dari Berkas** memvalidasi & meringkas isi berkas pada modal konfirmasi (nama berkas, ukuran, waktu & pelaku ekspor, jumlah maklumat/agenda/FAQ/misi, badge & judul hero) sebelum konten diganti.
  - Setelah impor, kartu editor dimuat ulang dengan konten hasil impor dan Riwayat Versi menandai aksi tersebut dengan label **`IMPOR BERKAS`**.
- **Endpoint baru**: `exportEditorialContent` (GET) & `importEditorialContent` (POST), keduanya khusus `SUPERADMIN` & `KETUA` (wajib sesi login).
- **Impor selalu dapat dibatalkan**: konten yang sedang aktif diarsipkan lebih dahulu (label `Sebelum impor berkas (…)`), lalu hasil impor dicatat sebagai aksi `IMPORT`; keduanya tercatat di `Sheet_AuditLogs` (`EDITORIAL_EXPORTED` / `EDITORIAL_IMPORTED`).

### 🛡️ Ketahanan Impor
- **Berkas tanpa satu pun bagian konten redaksi ditolak** (`hero`, `profile`, `bulletins_events`, `contact`, `social`, `faqs`, `faqs_show`), sehingga berkas JSON sembarang tidak dapat mengosongkan konten produksi menjadi nilai bawaan; tes juga memastikan penolakan **tidak menambah versi riwayat** dan tidak mengubah konten aktif.
- **Penanda format diperiksa**: `format` yang bukan `apii-editorial*` ditolak dengan pesan yang menyebutkan format berkasnya. JSON tidak sah, array JSON, berkas kosong, dan payload kosong juga ditolak dengan pesan yang jelas.
- **Tahan terhadap berkas yang disunting manual**: seluruh isi dinormalisasi ulang (trim, batas panjang, batas jumlah item, pembuangan tautan `javascript:`/`data:`), dan batas sel Google Sheets (`EDITORIAL_CELL_SAFE` 45.000 karakter) tetap berlaku — impor di atas batas ditolak **tanpa menulis apa pun**.
- **Tiga bentuk berkas diterima**: berkas ekspor penuh, objek konten mentah (bentuk yang tampil pada *Lihat JSON lengkap versi ini* di Riwayat Versi), atau teks JSON — BOM di awal berkas ditoleransi.
- Impor tanpa perubahan tidak menghasilkan versi riwayat baru, dan berkas ekspor tidak memuat data sensitif pengurus maupun baris riwayat versi.

### 🧪 Verifikasi & Dokumentasi
- `scripts/smoke-editorial.mjs` diperluas dari 93 → **138 pemeriksaan**: ekspor (nama berkas, penanda format, pelaku, asal lingkungan, audit, konten tidak berubah), pemindahan antar dua lingkungan yang isinya identik, pemulihan berkas pra-impor, tiga bentuk berkas yang diterima, enam bentuk berkas tidak sah yang ditolak tanpa menyentuh konten, sanitasi & batas sel, serta **jalur `doGet`/`doPost` sungguhan** (envelope sukses, penolakan tanpa token, dan penolakan peran read-only).
- `scripts/smoke-backend.mjs` diperluas (64 → **66 pemeriksaan**) untuk memastikan kedua route baru terdaftar di tabel `ROUTES`; `scripts/build-apps-script.ps1` memuat 7 nama fungsi baru agar pola namespace tetap tergantikan bersih.
- **Penjaga regresi Drive ditambahkan** bersama rilis ini (masih perluasan penjaga dari 2.0.1): `scripts/smoke-drive-local.mjs` (16 pemeriksaan, tanpa jaringan) dan `scripts/smoke-drive-prod.mjs` (rencana uji produksi aman). Lihat bagian **Penjaga Regresi Drive (skrip uji)** di atas dan [docs/TROUBLESHOOTING.md §9](#9-tombol-reset-ke-default-tidak-mengembalikan-folder-drive--diperbaiki-di-versi-13).
- Diuji juga di peramban dengan backend tiruan: ekspor menghasilkan berkas nyata, dan impor berkas dari perangkat membalik konten editor ke isi berkas dengan riwayat berlabel `IMPOR BERKAS`.
- `docs/REDAKSI_KONTEN.md` menambah **bagian 7 — Ekspor & Impor Berkas JSON** (format berkas, tiga bentuk berkas, penjagaan keamanan) serta dua endpoint baru pada tabel RBAC.
- **Tayang di produksi sejak 2026-10-08 23:30 WIB sebagai Backend Versi 12** — bukan lagi "menunggu redeploy". Fitur ini murni backend + portal pengurus, **tidak mengubah portal publik**.
- Verifikasi pasca-rilis di produksi sungguhan: ekspor konten aktif (`redaksi-apii-2026-10-08-2334.json`, 4.006 karakter, 3 misi/1 maklumat/1 agenda/3 FAQ) → impor ulang berkas yang sama dijawab *"Isi berkas sama dengan konten aktif"* → sidik jari konten publik identik sebelum & sesudah (`f23cb4cbfcd1b224`). Portal publik dimuat ulang di peramban: seksi dinamis tetap tampil, tanpa error konsol baru.
- Verifikasi yang sama **diulang pada 2026-10-09** (ekspor baru `redaksi-apii-2026-10-09-0023.json`, jumlah item tetap 3/1/1/3, sidik jari tetap `f23cb4cbfcd1b224`, riwayat versi tetap 0 karena memang belum ada penyimpanan perubahan) — hasilnya konsisten, tanpa regresi.
- Rincian keadaan produksi: lihat **Status Produksi Terkini** di bagian atas dokumen ini dan [docs/deploy.md §4](docs/deploy.md).

---

## [2.3.0] — 2026-10-08 (Deploy Backend Apps Script Satu Perintah)

### 🌟 Fitur Baru
- **`npm run deploy:gas`** — menggantikan alur salin-tempel manual ke editor Apps Script. Skrip baru `scripts/deploy-gas.mjs` menjalankan delapan tahap berurutan: preflight konfigurasi → kompilasi bundel → validasi sintaks → preflight daftar berkas → cek login → `clasp push` → pembuatan **Versi baru** → pembaruan **deployment yang sama**.
- **URL `/exec` tidak pernah berubah**: deployment ID dibaca otomatis dari URL `/exec` pada `portal/config.js` (opsional ditimpa via `GAS_DEPLOYMENT_ID`), sehingga `portal/config.js` dan `public/config.js` tidak perlu disunting setiap rilis.
- **Deploy berhenti sebelum menyentuh produksi bila ada masalah**: bundel cacat, daftar berkas tidak sesuai, belum login, atau `portal/config.js` & `public/config.js` menunjuk deployment yang berbeda — semuanya menghentikan proses dengan pesan yang jelas sebelum ada satu byte diunggah.
- **Preflight berkas tanpa kredensial** (`clasp status`) memastikan **tepat** `Backend.gs`, `AsetLogo.gs`, `AsetStempel.gs`, dan manifest `appsscript.json` yang diunggah — tidak ada berkas rahasia/sampah yang terbawa.
- **Mode uji `npm run deploy:gas:check`** (`--dry-run`) menjalankan build, validasi, dan preflight berkas secara nyata lalu hanya menampilkan perintah unggah yang akan dijalankan.
- Prasyarat sekali saja: `npx --yes @google/clasp@3 login`, `GAS_SCRIPT_ID` pada `.env`, dan **Google Apps Script API aktif** untuk akun tersebut di [script.google.com/home/usersettings](https://script.google.com/home/usersettings) (`.clasp.json`, `.clasprc.json`, dan `.env` di-gitignore). Alur manual dipertahankan sebagai cadangan di README, `docs/deploy.md`, dan `docs/VERSION_CONTROL.md`.
- **Manifest `appsscript.json` disertakan sebagai bagian bundel**: sumber acuan `gas/appsscript.json` (tracked) disalin oleh skrip build ke `apps-script/appsscript.json` dan divalidasi sebagai JSON yang sah sebelum unggah. Isinya identik dengan manifest di project produksi (`timeZone` Asia/Jakarta, `runtimeVersion` V8, `webapp.access` ANYONE_ANONYMOUS), sehingga rilis tidak mengubah pengaturan project.

### 🧪 Verifikasi
- Diuji langsung di repo: `--help`, jalur gagal tanpa `GAS_SCRIPT_ID` (exit 1, tanpa perubahan apa pun), dan `--dry-run` penuh (build + validasi + `clasp status` nyata melaporkan tepat 4 berkas yang akan diunggah; perintah `push`/`create-version`/`update-deployment` hanya ditampilkan).
- **Diuji terhadap project produksi sungguhan** (akun clasp terautentikasi, Script ID terpasang): daftar berkas di editor Apps Script diperiksa langsung lewat Apps Script API dan berisi **tepat** `Backend.gs`, `AsetLogo.gs`, `AsetStempel.gs`, dan `appsscript.json` — tidak ada modul pra-bundel yang tersisa sehingga tidak ada risiko definisi fungsi ganda. Manifest lokal terbukti **identik** dengan manifest project.
- Dua kegagalan nyata ditemukan dan diperbaiki pada uji ini: (1) `clasp push` selalu gagal karena folder unggahan tidak memuat `appsscript.json` — kini manifest ikut dibangun & divalidasi; (2) unggahan ditolak Google dengan `User has not enabled the Apps Script API` bila setelan akun belum dinyalakan — kini skrip berhenti dengan instruksi spesifik beserta alamat email akun yang sedang login.
- **Sudah tuntas (catatan awal dipertahankan sebagai jejak).** Saat rilis 2.3.0 ditulis, langkah `push`/`create-version`/`update-deployment` memang belum pernah dijalankan karena setelan akun *Google Apps Script API* belum dinyalakan pemilik project. Setelah setelan itu aktif, seluruh delapan tahap `npm run deploy:gas` benar-benar dijalankan terhadap project produksi sampai tuntas; versi tayang terakhirnya adalah **Versi 12** (2026-10-08 23:30 WIB) pada deployment `/exec` yang sama — lihat **Status Produksi Terkini** di atas.

### ⚠️ Catatan Operasional
- **Ukuran berkas mendekati batas:** `Backend.gs` hasil bundel kini 199.360 karakter; skrip build memperingatkan kedekatan batas ukuran berkas Apps Script. Pertimbangkan memecah modul bila menambah fitur backend berikutnya.
- `clasp` **tidak** menghapus berkas yang ada di editor Apps Script. Project harus hanya berisi `Backend.gs`, `AsetLogo.gs`, `AsetStempel.gs`, dan `appsscript.json`; sisa berkas lama (mis. `Aset.gs`) berpotensi menimbulkan definisi fungsi ganda dan perlu dihapus sekali secara manual.

---

## [2.2.0] — 2026-10-08 (Riwayat Versi Konten Redaksi & Pemulihan)

### 🌟 Fitur Baru
- **Riwayat Versi Konten Redaksi (anti timpa permanen)**: setiap penyimpanan dari tab `📰 Redaksi Konten` kini mengarsipkan versi sebelumnya, sehingga perubahan keliru dapat dipulihkan kapan saja tanpa perlu koding.
  - Kartu baru **`7. Riwayat Versi & Pemulihan`** di portal pengurus: daftar versi terbaru (waktu, pelaku, jenis aksi `PENYIMPANAN`/`PEMULIHAN`, ringkasan bagian yang berubah, ukuran berkas).
  - Tombol `👁 Pratinjau` menampilkan ringkasan satu versi (hero, jumlah maklumat/agenda/FAQ, kontak, visibilitas seksi) beserta JSON lengkapnya sebelum dipulihkan.
  - Tombol `↩ Pulihkan` mengembalikan konten aktif ke versi tersebut setelah konfirmasi; editor langsung dimuat ulang dengan konten hasil pemulihan.
  - Daftar riwayat otomatis disegarkan setelah setiap penyimpanan berhasil.
- **Endpoint baru**: `getEditorialHistory`, `getEditorialRevision`, `restoreEditorialRevision` (ketiganya khusus `SUPERADMIN` & `KETUA`, wajib sesi login).
- **Arsip versi dua arah**: saat pemulihan, konten yang sedang aktif ikut diarsipkan lebih dahulu (label *Sebelum memulihkan versi …*) sehingga pemulihan selalu dapat dibatalkan; aksi pemulihan dicatat sebagai `RESTORE` dan tercatat di jejak audit (`EDITORIAL_RESTORED`).

### 🛡️ Ketahanan & Batas Data
- Tabel **baru** `Sheet_EditorialHistory` (`id`, `saved_at`, `saved_by`, `action`, `label`, `content`) dibuat otomatis oleh `initSchema()`/`getSheetSafe_()` — **tidak ada perubahan pada skema tabel yang sudah ada**; tabel terpisah agar payload `getSettings` tetap ringan dan riwayat tidak pernah bocor ke portal publik.
- Riwayat dibatasi **15 versi terbaru** (`EDITORIAL_HISTORY_MAX`); pemangkasan mencari ulang baris berdasarkan `id` agar nomor baris yang bergeser tidak salah hapus.
- **Perlindungan batas sel Google Sheets (50.000 karakter)**: batas aman `EDITORIAL_CELL_SAFE` = 45.000 karakter. Konten yang melampaui batas kini **ditolak dengan pesan yang jelas** dan penyimpanan bersifat *all-or-nothing* (sebelumnya akan gagal dengan pesan sistem yang tidak informatif); versi di atas batas aman tidak diarsipkan sehingga riwayat tidak pernah rusak.
- Isi versi dinormalisasi ulang saat dibaca & dipulihkan, sehingga baris riwayat yang pernah disunting manual di spreadsheet tetap tersanitasi (tautan `javascript:`/`data:` tetap dibuang).
- Penyimpanan tanpa perubahan tidak menghasilkan versi baru; menyimpan **satu payload berisi pengaturan lain** tetap tidak terpengaruh.

### 🧪 Verifikasi & Dokumentasi
- `scripts/smoke-editorial.mjs` diperluas dari 56 → **93 pemeriksaan**: pencatatan otomatis versi sebelumnya, ringkasan perubahan, daftar & pratinjau, pemulihan (termasuk pembatalan pemulihan), batas 15 versi, `TOO_LARGE`/penolakan batas sel, sanitasi baris hostil, pembuatan tabel riwayat otomatis pada spreadsheet lama (tanpa `setup()`), serta penjagaan RBAC + kebocoran riwayat ke publik.
- `scripts/smoke-backend.mjs` diperluas (58 → **64 pemeriksaan**) untuk memastikan ketiga route riwayat terdaftar di tabel `ROUTES`.
- `docs/REDAKSI_KONTEN.md` menambah bagian **6. Riwayat Versi Konten** (penyimpanan, semantik pemulihan, batas sel) serta tiga endpoint baru pada tabel RBAC.

---

## [2.1.0] — 2026-10-08 (Redaksi Konten Dinamis — Mini-CMS Portal Publik)

### 🌟 Fitur Baru
- **Mini-CMS Redaksi Konten (Portal Pengurus)**: sub-tab baru **`📰 Redaksi Konten`** pada menu Pengaturan & Master Data untuk mengelola seluruh konten dinamis portal publik tanpa koding maupun redeploy.
  - **Hero & Tagline**: badge pengumuman, judul H1, subjudul, teks & tautan tombol CTA.
  - **Profil Lembaga**: toggle visibilitas seksi, sambutan resmi Ketua DPW, visi, dan poin misi.
  - **Maklumat & Siaran Resmi**: list builder (judul, kategori, tanggal, ringkasan, tautan PDF/Drive) dengan tambah/edit/hapus baris.
  - **Agenda & Acara Kegiatan**: list builder (kategori, tanggal, waktu, tempat/platform, narasumber, tautan pendaftaran, status `MENDATANG`/`SELESAI`).
  - **Kontak & Media Sosial Resmi**: alamat sekretariat, jam layanan, email, WhatsApp helpdesk, serta tautan YouTube, Instagram, WhatsApp Channel, Facebook, TikTok (kanal kosong otomatis disembunyikan).
  - **Tanya Jawab Publik (FAQ)**: toggle visibilitas + list builder pertanyaan/jawaban.
  - Tombol `💾 Simpan Seluruh Perubahan Redaksi` menyimpan keenam kartu sekaligus dengan feedback toast.
- **Portal Publik (`apii.sigitadi.id`)**: seksi dinamis baru yang tayang langsung setelah disimpan:
  - **Profil Lembaga (`#profil`)**: kartu sambutan pimpinan bergradasi emerald-gold, visi, dan misi bernomor.
  - **Warta Maklumat & Agenda Kegiatan (`#warta`)**: tab switcher *📌 Maklumat & Siaran* / *📅 Agenda & Acara*, maksimum 6 kartu per tampilan dengan tombol ekspansi, badge emas **MENDATANG** diprioritaskan di atas, dan label abu-abu **Selesai (Arsip Kegiatan)** untuk acara yang telah lewat.
  - **Tanya Jawab (`#faq`)**: akordeon interaktif dengan transisi halus (buka/tutup per pertanyaan).
  - Hero beranda, kontak sekretariat, dan deretan ikon media sosial kini mengikuti data redaksi; tautan navigasi menyesuaikan bila sebuah seksi disembunyikan.
- **Penyimpanan (tanpa perubahan skema tabel)**: seluruh konfigurasi redaksi disimpan sebagai satu objek JSON pada `Sheet_Settings` dengan key `editorial_content`, di-seed otomatis saat `setup()`/`initSchema()`.

### 🛡️ Keamanan & Ketahanan
- **Normalisasi server-side** `Utils.normalizeEditorialContent_`: koersi tipe (`show_section`, `faqs_show`, `status`), trim, batas panjang teks, batas jumlah item (misi 20, maklumat/acara/FAQ 60), serta pembuangan tautan berskema berbahaya (`javascript:`, `data:`) dengan allow-list `http(s)`/`mailto:`/`tel:`/anchor/relatif.
- **Sanitasi XSS sisi klien**: seluruh string dari server melewati `Public.esc()` sebelum dirender ke `innerHTML`.
- **Graceful fallback**: bila data belum tersedia atau field dikosongkan, portal publik tetap tampil rapi memakai teks bawaan HTML; seksi hanya disembunyikan jika toggle redaksi dimatikan.
- `getPublicSettings` kini mengalirkan objek `editorial`; `getSettings` mengembalikan `editorial_content` yang sudah ternormalisasi beserta alias `editorial`.
- **RBAC**: `saveSettings` kini juga terbuka untuk peran **KETUA** sesuai matriks RBAC (sebelumnya hanya `SUPERADMIN`, sehingga Ketua dapat membuka menu Pengaturan namun selalu gagal menyimpan).
- **Perbaikan bug bundler/kritis (pre-existing)**: `exportPendaftar` ditambahkan ke daftar fungsi global di `scripts/build-apps-script.ps1` — tanpa ini, `Backend.gs` gagal dimuat total karena `Auth.exportPendaftar` tidak terdefinisi; dan pemanggilan fungsi frontend `Auth.esc()` pada `gas/Divisi.gs` diganti helper backend `Utils.escHtml_()`.

### 🧪 Verifikasi & Dokumentasi
- Skrip uji baru **`scripts/smoke-editorial.mjs`** (56 pemeriksaan): normalisasi & sanitasi, integrasi seed → `saveSettings` → `getSettings`/`getPublicSettings` dengan tiruan Google Sheets, serta penjagaan RBAC route.
- **`docs/REDAKSI_KONTEN.md`** diperbarui: field `faqs_show`, catatan RBAC endpoint, prinsip defensif frontend, dan prosedur uji terbaru.

---


## [2.0.1] — 2026-10-08 (Google Drive Storage Engine, Bundler Guard, & Cache-Busting)

### 🌟 Fitur Baru & Perbaikan Google Drive
- **Sinkronisasi Dua Arah Root Storage Folder**:
  - Memperbaiki `siapkanFolderPdf_()` agar membaca konfigurasi custom folder dari `Sheet_Settings` dan menyinkronkannya dengan `ScriptProperties.DRIVE_FOLDER_ID`.
  - Memperbarui `saveSettings` agar langsung memperbarui `ScriptProperties` secara seketika saat ID folder diubah.
- **Fitur Buat Folder Baru Langsung (`createDriveFolder`)**:
  - Admin dapat membuat folder baru langsung di Google Drive via antarmuka tanpa perlu keluar dari aplikasi.
  - Otomatis membuatkan subfolder standar: `/Surat_Resmi`, `/Surat_Lampiran`, `/Keuangan_Bukti_Nota`, `/Pendaftaran_KTP`, `/Pendaftaran_Selfie`.
- **Fitur Pindah Folder ke Induk (`moveDriveFolder`)**:
  - Memindahkan folder aktif ke dalam parent folder tujuan (misal ke Shared Drive atau folder Yayasan Pusat).
- **Pengujian Koneksi & Validasi Izin Tulis Real-Time (`testDriveStorage`)**:
  - `testDriveStorage` kini membaca dan menguji folder ID spesifik yang dimasukkan pengguna serta memverifikasi izin TULIS/EDIT dengan uji file temporer.
- **Fitur Reset ke Folder Bawaan (`resetDriveStorage`)**:
  - Menyediakan opsi reset satu-klik untuk mengembalikan folder penyimpanan ke default organisasi.
- **Modernisasi UI Pengaturan Drive di Portal Pengurus**:
  - Kartu status folder aktif (Nama folder, ID folder, tombol salin ID, dan tautan langsung `📂 Buka Folder di Drive ↗`).
  - 4 Kotak Aksi berwarna responsif: Buat Baru (Hijau), Gunakan Folder yang Ada (Biru), Pindahkan ke Induk (Ungu), dan Reset ke Default (Merah).
- **Perbaikan Bundler Google Apps Script & Namespace Guard**:
  - Memperbaiki `scripts/build-apps-script.ps1` dengan menambahkan `exportPendaftar` ke `$fnNames` untuk mengatasi `ReferenceError: Auth is not defined`.
  - Menambahkan *automated safety guard* di build script yang otomatis menggagalkan kompilasi jika terdapat namespace yang tertinggal.
- **Cache-Busting Frontend Vercel**:
  - Menambahkan query parameter `?v=2.1.0` pada pemanggilan script `config.js`, `auth.js`, dan `portal.js` di `portal/index.html` untuk memastikan pembaruan langsung tampil tanpa tertahan cache browser.

---

> **Catatan rilis paralel:** jalur pengembangan Google Drive di rilis **2.0.1** digabung ke cabang ini. Entri *Spesifikasi Final 2.1.0 (Siap Eksekusi)* pada jalur tersebut tidak diduplikasi karena mendokumentasikan fitur yang sama dengan rilis 2.1.0 di atas; bila versi 2.0.1 atau 2.1.0 dari jalur itu sudah pernah di-deploy, gabungkan keduanya secara manual karena fungsinya sama (memindahkan folder Drive) dan tidak boleh dijalankan bersamaan.

## [2.0.0] — 2026-10-07 (Enterprise Modernization & RBAC Hardening)

### 🌟 Fitur Baru & Peningkatan Utama
- **Modernisasi Portal Publik (Pendaftaran Anggota Terpadu)**:
  - Penambahan formulir pendaftaran calon anggota DPW Jabodetabek lengkap: data pribadi (NIK 16 digit, TTL, Jenis Kelamin), kontak (WA, email), profesi, domisili, dan minat 7 divisi kerja.
  - **Watermark KTP Otomatis Sisi Klien (HTML5 Canvas)**: Cap digital pengaman diagonal (*"ARSIP PENDAFTARAN APII DPW JABODETABEK - [TANGGAL]"*) disematkan langsung di peramban pengguna sebelum data dikirim ke server.
  - **Kepatuhan UU Pelindungan Data Pribadi (UU PDP No. 27/2022)**: Menghilangkan paparan data KTP mentah dan menjaga kerahasiaan berkas pendaftar.
  - **Tanda Terima Pendaftaran Digital (Receipt Modal)**: Menghasilkan kode unik pendaftaran `REG-YYYY-XXXX`, masking NIK (`3171********0001`), dan tombol tautan konfirmasi instan ke WhatsApp Sekretariat.
  - **Penghapusan Fitur Verifikasi Dokumen & Digital Publik**: Formulir verifikasi surat SHA-256 dan daftar dokumen resmi dihapus dari portal publik untuk menjaga kerahasiaan tata kelola dokumen yayasan.
  - **Penghapusan Tautan Portal Pengurus di Situs Publik**: URL portal pengurus (`siapii.sigitadi.id`) disembunyikan sepenuhnya dari navbar, menu mobile, dan footer publik.

- **Portal Pengurus (Performa Tinggi & Navigasi 0ms)**:
  - **SWR (Stale-While-Revalidate) Cache Engine**: Pemuatan data instan (`Auth.getCached`) dengan sinkronisasi background otomatis di `portal/auth.js`.
  - **Prefetching Rute Background**: Rute `dashboard`, `surat`, dan `keuangan` dimuat terlebih dahulu saat inisialisasi aplikasi untuk transisi tanpa jeda (*zero latency*).
  - **Hardening RBAC (8 Peran Pengurus Inti)**: Menghapus peran `ANGGOTA_BIASA` dari seluruh portal pengurus, database, dan logika backend. Portal pengurus kini eksklusif bagi 8 peran fungsional pengurus.
  - **Modul Manajemen Pendaftar (Approval Ganda)**:
    - Tab baru `📥 Pendaftaran Masuk` di menu Manajemen Pengguna.
    - Verifikasi berkas tahap 1 oleh Sekretaris (`verifyPendaftarSekretaris`).
    - Pengesahan anggota resmi tahap 2 oleh Ketua DPW (`approvePendaftarKetum`).
    - Penolakan berkas dengan catatan alasan resmi (`rejectPendaftar`).
    - Integrasi WhatsApp Quick Connect untuk berkomunikasi langsung dengan pemohon.

- **Manajemen Pengaturan & Master Data Terpadu (Superadmin & Ketua)**:
  - **Master Persuratan & Format Penomoran**: Pengaturan pola dinamis `{urut}/{kode}/{org}/{bulanRomawi}/{tahun}` dengan digit padding.
  - **Master Jenis Surat Baru**: Dukungan surat jenis `NOTULEN` (Notulen Rapat), `RAPAT` (Risalah Rapat), `BA` (Berita Acara), serta penambahan jenis surat dinamis via `Sheet_Settings`.
  - **Master Rekening Kas Yayasan**: CRUD rekening kas, integrasi bank, nomor rekening, nama pemilik, kategori kas, dan pengaturan visibilitas publik.
  - **KOP Surat Multi-Mode**: Pilihan KOP teks terstandar atau unggah gambar KOP resmi dengan pratinjau Canvas dan penyimpanan ke database.
  - **Pengaturan Google Drive**: Pengujian koneksi dan sinkronisasi folder penyimpanan cloud langsung dari antarmuka web.
  - **Jejak Audit Permanen (WORM — Write Once, Read Many)**: Seluruh riwayat aktivitas sistem dicatat permanen di `Sheet_AuditLogs` tanpa menyediakan endpoint penghapusan untuk menjamin integritas hukum.

---

## [1.5.0] — 2026-10-07 (Tahap 5 — Production Deployment & Vercel Verification)
- Deployment frontend Portal Pengurus ke domain resmi `siapii.sigitadi.id`.
- Deployment frontend Portal Publik ke domain `apii.sigitadi.id`.
- Konfigurasi `vercel.json` dengan rewrite SPA dan caching header.

## [1.4.0] — 2026-10-07 (Tahap 4 — Bukti Kas Drive & Siklus LPJ Divisi 5-Tahap)
- Integrasi bukti transaksi kwitansi kas langsung ke Google Drive folder `Bukti_Kas`.
- Siklus hidup program kerja 5-tahap: `DRAFT → AJUKAN → DISETUJUI → PELAKSANAAN → LPJ_SELESAI`.
- Form penyerahan LPJ akuntabel dengan tautan berkas Drive dan realisasi anggaran akhir.

## [1.3.0] — 2026-10-07 (Tahap 3 — Notifikasi Email & WhatsApp Quick Share)
- Notifikasi email otomatis via `GmailApp` untuk setiap pengajuan surat, verifikasi kas, dan persetujuan divisi.
- Integrasi tombol WhatsApp Quick Share berformat resmi (emotikon, bold Markdown, tracking ID) untuk seluruh modul.

## [1.2.0] — 2026-10-07 (Tahap 2 — Kertas Virtual A4 Replica & Stempel Basah)
- Modal Pratinjau Kertas Virtual A4 resolusi tinggi dengan stempel basah transparan (`mix-blend-mode: multiply`).
- Watermark status otomatis (`DRAFT`, `PENDING_APPROVAL`, `REJECTED`).
- Fitur cetak ramah printer (`@media print`) untuk kertas A4 dan kwitansi kas yayasan.

## [1.1.0] — 2026-10-07 (Tahap 1 — Action Inbox & Card-Feed View)
- Kotak Aksi Terpadu (*Action Items / Approval Inbox*) pada dashboard pimpinan.
- Transformasi tabel menjadi kartu bertingkat responsif (`.tbl-responsive`) untuk perangkat layar sentuh mobile (< 640px).

## [1.0.0] — 2026-10-06 (Fondasi Awal)
- Arsitektur serverless Google Apps Script + Google Sheets database.
- Autentikasi sesi berbasis UUID token.
- CRUD dasar modul surat, keuangan, dan usulan divisi.
