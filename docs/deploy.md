# Panduan Deployment & Operasional Produksi (SIAP APII)

**Sistem Informasi & Administrasi Terpadu Yayasan APII DPW Jabodetabek (v2.0.0 Enterprise)**

> Dokumen panduan resmi deployment, konfigurasi custom domain, sinkronisasi Google Apps Script, dan prosedur operasional produksi SIAP APII.

---

## 1. Ringkasan Infrastruktur Produksi (100% Serverless & Gratis)

SIAP APII berjalan di atas arsitektur serverless modern tanpa memerlukan server VM berbayar. Seluruh beban komputasi backend, basis data, dan penyimpanan dokumen dikelola oleh infrastruktur Google Workspace gratis selamanya dalam kuota yayasan, sedangkan antarmuka web di-hosting pada Vercel Global Edge Network.

| Komponen | Layanan / Provider | Endpoint / Target | Keterangan |
|---|---|---|---|
| **Portal Pengurus (SPA)** | **Vercel** Edge CDN (`sin1` SG) | `https://siapii.sigitadi.id` | Single Page Application 8 peran pengurus (folder `portal/`) |
| **Portal Publik** | **Vercel / Static Web** | `https://apii.sigit.id` | Profil yayasan & pendaftaran calon anggota baru (UU PDP No. 27/2022) |
| **Backend API** | **Google Apps Script** Web App | `https://script.google.com/macros/s/.../exec` | Router RESTful JSON, RBAC 8 peran, sesi token 7-hari |
| **Database ACID** | **Google Sheets** | Spreadsheet ID: `1B0p0Jgb...` | Sheet: Users, Sessions, Surat, Keuangan, Divisi, Audit, Pendaftar, Settings, Accounts |
| **Document Storage** | **Google Drive** | `APII Jabo - PDF Surat Resmi` | Arsip PDF surat resmi, kwitansi kas, berkas KTP & selfie pemohon |
| **Mesin Render PDF** | **Google Docs Template** | Auto-generated via `setup()` | Kop surat resmi, stempel basah, logo, nomor otomatis |
| **Notifikasi Background** | **GmailApp / MailApp** | Otomatis via GAS | Email persetujuan surat, voucher kas, & pendaftaran anggota |
| **Notifikasi Interaktif** | **WhatsApp Web Link** | Click-to-Chat URI | Quick share dokumen, voucher, & konfirmasi pendaftar |

---

## 2. Struktur Domain & Routing

```
                          Internet / Pengguna
                                  │
            ┌─────────────────────┴─────────────────────┐
            ▼                                           ▼
    https://apii.sigit.id                    https://siapii.sigitadi.id
    [Portal Publik APII]                     [Portal Pengurus SIAPII]
    - Profil Yayasan & 7 Divisi              - Unified Action Inbox
    - Formulir Pendaftaran Anggota           - Modul Persuratan (A4 Virtual)
    - Auto-Watermark KTP (UU PDP)            - Buku Kas & Dual-Approval
    - Tanda Terima Digital Pendaftar         - Usulan Divisi & LPJ 5-Tahap
    (Tanpa tautan portal admin)              - Verifikasi Pendaftar Masuk
                                             - Pengaturan & Master Data
                                             - Log Audit Permanen (WORM)
                                                        │
                                                        ▼ (REST JSON HTTPS)
                                             Google Apps Script Web App
                                                        │
                                ┌───────────────────────┴───────────────────────┐
                                ▼                                               ▼
                       Google Sheets (Database)                       Google Drive (Dokumen/Foto)
```

### Konfigurasi DNS Domain (`sigitadi.id`)
Di dashboard DNS manajemen domain (Cloudflare / Registrar cPanel):
- **Host / Subdomain:** `siapii`
- **Tipe Record:** `CNAME`
- **Target / Value:** `cname.vercel-dns.com`
- **Proxy Status (Cloudflare):** DNS Only (atau Proxied dengan SSL Full/Strict)
- **Status:** **TERVERIFIKASI AKTIF** (`3e8cffbb0e16a642.vercel-dns-017.com`)

---

## 3. Langkah Deployment Frontend ke Vercel

### 3.1 Otomatisasi GitHub CI/CD (Rekomendasi Utama)
Project Vercel telah terhubung langsung dengan repository GitHub:
- **Repository:** `sisigitadi/siap-apii`
- **Branch Produksi:** `main`
- **Output Directory:** `portal` (dikonfigurasi pada `vercel.json` di root)
- **Framework Preset:** `Other` (Static Site)

Setiap kali Anda melakukan perintah `git push origin main`, Vercel secara otomatis mendeteksi perubahan, mengompilasi aset, dan memperbarui deployment produksi di `https://siapii.sigitadi.id` dalam hitungan detik.

### 3.2 Konfigurasi `vercel.json`
Konfigurasi `vercel.json` di root proyek:
```json
{
  "version": 2,
  "outputDirectory": "portal",
  "cleanUrls": true,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 4. Alur Pembaruan Backend (Google Apps Script)

Setiap kali terdapat pembaruan kode pada folder `gas/`:

### Langkah 1 — Kompilasi Bundle Lokal
Jalankan script bundler di terminal PowerShell:
```powershell
npm run build:gas
# Atau:
powershell -ExecutionPolicy Bypass -File scripts\build-apps-script.ps1
```
Script akan:
1. Menggabungkan seluruh modul `.gs` secara terurut (`00-Konfig`, `Utils`, `Database`, `Auth`, `Surat`, `Keuangan`, `Divisi`, `Code`, `99-TemplateSurat`).
2. Menghilangkan pola namespace `Modul.fn()` menjadi pemanggilan fungsi global Apps Script murni.
3. Menghasilkan file siap-unggah:
   - `apps-script/Backend.gs`
   - `apps-script/AsetLogo.gs`
   - `apps-script/AsetStempel.gs`

### Langkah 2 — Perbarui Kode di Google Apps Script
1. Buka project Apps Script di browser: [script.google.com](https://script.google.com).
2. Salin isi masing-masing file dari folder `apps-script/` ke editor Google Apps Script:
   - Isi `apps-script/Backend.gs` $\to$ file `Backend.gs`
   - Isi `apps-script/AsetLogo.gs` $\to$ file `AsetLogo.gs`
   - Isi `apps-script/AsetStempel.gs` $\to$ file `AsetStempel.gs`
3. Tekan **Save** (Ctrl+S / ikon 💾).

### Langkah 3 — Perbarui Versi Web App (New Deployment)
1. Klik tombol **Deploy** di pojok kanan atas editor Apps Script.
2. Pilih **Manage deployments**.
3. Klik ikon pensil (Edit) pada deployment aktif.
4. Pada kolom **Version**, pilih **New version**.
5. Isi deskripsi (contoh: *Release v2.0.0 - Pendaftaran Anggota & Hardening RBAC*).
6. Klik **Deploy**.
7. Salin URL Web App yang dihasilkan (format: `https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec`).
8. Jika ID Deployment berubah, perbarui baris `window.API_BASE` pada:
   - `portal/config.js`
   - `public/config.js`
   Lalu lakukan `git push origin main`.

---

## 5. Checklist Verifikasi Produksi (Health Check)

| No | Parameter Pemeriksaan | Target Hasil | Metode Pengujian |
|---|---|---|---|
| 1 | **Konektivitas Portal Pengurus** | HTTP 200 OK | Akses `https://siapii.sigitadi.id` di browser |
| 2 | **Konektivitas Portal Publik** | HTTP 200 OK | Akses `https://apii.sigit.id` di browser |
| 3 | **Sertifikat SSL/TLS** | Valid (HTTPS) | Cek gembok SSL di peramban |
| 4 | **Pemuatan Aset** | Semua file HTTP 200 | Periksa console: `portal.js`, `style.css`, `logo.png` |
| 5 | **Autentikasi Pengurus** | Sesi token aktif | Login dengan salah satu dari 8 peran pengurus |
| 6 | **Action Inbox** | Render dokumen pending | Masuk ke dashboard dengan role Ketua/Sekretaris/Bendahara |
| 7 | **Kertas Virtual A4** | Modal A4 + Watermark | Buka detail surat di modul Persuratan |
| 8 | **Quick Share WhatsApp** | Buka dialog kirim pesan | Klik ikon WhatsApp pada surat/voucher/usulan |
| 9 | **Bukti Kas Drive** | Tautan terbuka di tab baru | Cek voucher dengan bukti di modul Keuangan |
| 10 | **Siklus Usulan LPJ** | Stepper 5-tahap aktif | Buka detail usulan program di modul Divisi |
| 11 | **Formulir Pendaftaran** | Validasi + Canvas Watermark | Unggah KTP di portal publik, cek cap watermark |
| 12 | **Verifikasi Pendaftar** | Approval ganda berfungsi | Sekretaris verifikasi berkas $\to$ Ketua sahkan anggota |
| 13 | **Privasi & Kerahasiaan** | Bebas link admin | Pastikan portal publik tidak memuat link portal pengurus |

---

## 6. Prosedur Pencadangan & Pemulihan Bencana (Disaster Recovery)

1. **Pencadangan Basis Data:**
   - Karena database berbasis **Google Sheets**, seluruh riwayat revisi baris data secara otomatis disimpan oleh Google (*Version History*).
   - Pengurus dapat mengunduh salinan berkala (.xlsx / .csv) melalui menu **File $\to$ Download $\to$ Microsoft Excel (.xlsx)**.
2. **Pencadangan Berkas PDF & Nota:**
   - Seluruh PDF surat dan dokumen nota tersimpan rapi di Google Drive yayasan pada folder `APII Jabo - PDF Surat Resmi`.
3. **Audit Trail Keamanan:**
   - Seluruh aktivitas login, persetujuan surat, verifikasi kas, dan pengajuan program tercatat permanen di tab `Sheet_AuditLogs` (WORM - Anti Hapus) dan dapat dipantau langsung oleh Superadmin, Ketua, Pembina, dan Pengawas.
