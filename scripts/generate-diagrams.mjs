import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('assets/diagrams');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const diagrams = [
  {
    name: 'diagram_1_transformasi_sistem',
    chart: `flowchart LR
    subgraph Pola_Lama ["Kondisi Manual Sebelumnya"]
        A1["Surat via WhatsApp / Word (Rawan nomor dobel/hilang)"]
        A2["Kas di Catatan Excel Terpisah (Rentan salah hitung & curiga)"]
        A3["KTP Pendaftar di Grup Chat (Bahaya kebocoran data UU PDP)"]
        A4["Koordinasi Mandek Tanpa Kabar (Saling tunggu antar-pengurus)"]
    end

    subgraph SIAP_APII ["Solusi Terpadu SIAP APII"]
        B1["Persuratan Dinas A4 Otomatis (Nomor anti-loncat & stempel sah)"]
        B2["Kas Syar'i 4 Kantong Dual-Approval (Persetujuan bertingkat)"]
        B3["Pendaftaran KTA Watermark KTP (Aman UU PDP & CR80 5 Thn)"]
        B4["Estafet WhatsApp Pintar (Tugas berlanjut otomatis)"]
    end

    Pola_Lama ==>|Transformasi Digital| SIAP_APII`
  },
  {
    name: 'diagram_2_arsitektur_dwi_portal',
    chart: `graph TD
    Root["Sistem Informasi SIAP APII"] --> Publik["1. PORTAL PUBLIK ADAPTIF (Masyarakat & Calon Anggota)"]
    Root --> Portal["2. PORTAL PENGURUS (Private SPA Pengurus)"]

    subgraph Layanan_Publik ["Etalase & Pelayanan Umat"]
        Publik --> P1["Warta Maklumat & Risalah Dakwah"]
        Publik --> P2["Kalender Safari Dakwah & Kajian"]
        Publik --> P3["Pendaftaran Anggota (100% Gratis)"]
        Publik --> P4["Pusat Verifikasi Dokumen & KTA (QR)"]
        Publik --> P5["Kanal Infaq & Rekening Resmi"]
        Publik --> P6["Konsultasi Syubhat Rahasia"]
        Publik --> P7["Peta Sebaran Dakwah Geo-Hub"]
    end

    subgraph Dapur_Pengurus ["Dapur Tata Kelola Administrasi"]
        Portal --> M1["Workspace 1: Dashboard Eksekutif"]
        Portal --> M2["Workspace 2: Persuratan & SK A4"]
        Portal --> M3["Workspace 3: Surat Masuk & Disposisi"]
        Portal --> M4["Workspace 4: Kas 4 Kantong & Kwitansi"]
        Portal --> M5["Workspace 5: Program 7 Divisi Kerja"]
        Portal --> M6["Workspace 6: Keanggotaan & KTA CR80"]
        Portal --> M7["Workspace 7: Siaga Advokasi LBH APII"]
        Portal --> M8["Workspace 8: Muallaf Care & Aset QR"]
        Portal --> M9["Workspace 9: Maktabah Dalil & Risalah"]
        Portal --> M10["Workspace 10: IAM 8 Peran & Drive Vault"]
    end`
  },
  {
    name: 'diagram_3_federasi_dpp_dpw',
    chart: `flowchart TD
    subgraph Standar_Nasional ["1. Standar Mutu DPP (Seragam)"]
        N1["Logo Resmi Yayasan APII Keemasan"]
        N2["Palet Warna Islami (Emerald & Gold)"]
        N3["Legalitas Resmi SK Kemenkumham 2023"]
        N4["Running Ticker Warta Maklumat Pusat"]
    end

    subgraph Otonomi_Lokal ["2. Kustomisasi Mandiri DPW"]
        L1["Banner Sambutan Wilayah Khusus"]
        L2["Warta Berita & Kegiatan Daerah"]
        L3["Kalender Safari Dai Lokal Wilayah"]
        L4["Rekening Kas & QRIS Resmi Daerah"]
        L5["Alamat & Hotline Pengurus Daerah"]
    end

    subgraph Cerdas_Otomatis ["3. Smart Fallback (Penyelamat)"]
        F1["Jika DPW belum isi berita lokal, sistem otomatis tampilkan warta DPP. Tampilan DPW TIDAK PERNAH kosong!"]
    end

    Standar_Nasional --- Otonomi_Lokal --- Cerdas_Otomatis`
  },
  {
    name: 'diagram_4_alur_persuratan_dinas',
    chart: `sequenceDiagram
    autonumber
    actor Sek as Sekretaris
    actor Ket as Ketua Umum/Wilayah
    participant Sys as Sistem SIAP APII
    actor Pub as Instansi Luar / Publik

    Sek->>Sys: Ketik draf surat (Live Preview A4)
    Sek->>Sys: Klik [AJUKAN KE KETUA]
    Sys-->>Ket: Action Inbox Ketua + Notif WhatsApp
    alt Ketua Minta Revisi
        Ket->>Sys: Catatan revisi [REJECT]
        Sys-->>Sek: Draf tidak hilang, edit ulang
    else Ketua Menyetujui
        Ket->>Sys: Klik [SETUJUI & TANDATANGANI]
        Sys->>Sys: Kunci nomor sekuensial anti-loncat
        Sys->>Sys: Bubuhkan TTD & Stempel Multiply
        Sys->>Sys: Tempelkan QR SHA-256 & Hijriah
        Sys-->>Sek: PDF Surat Terbit di Drive Vault
        Sek->>Pub: Kirim PDF ke instansi tujuan
        Pub->>Sys: Scan QR -> Verifikasi 100% Asli
    end`
  },
  {
    name: 'diagram_5_alur_keuangan_kas',
    chart: `flowchart TD
    A["Pengusul / Divisi Input Permohonan Kas Keluar (Lampirkan Nota/RAB)"] --> B["Tahap 1: Verifikasi Bendahara (Cek Nota & Saldo Kantong Syar'i)"]
    
    B -->|Ditolak/Nota Tidak Sah| R1["Status REJECTED (Uang Tidak Keluar)"]
    B -->|Lolos Pemeriksaan| C["Tahap 2: Pengesahan Ketua Umum/Wilayah (Urgensi Pencairan)"]
    
    C -->|Ditolak Ketum| R2["Status REJECTED (Uang Tidak Keluar)"]
    C -->|Disetujui Ketum| D["Status APPROVED (Terbit Nomor BKK)"]
    
    D --> E["Saldo Kas Otomatis Terpotong"]
    D --> F["Cetak Kwitansi Dual-Slip (30% Bonggol : 70% Donatur)"]`
  },
  {
    name: 'diagram_6_alur_pendaftaran_kta',
    chart: `flowchart TD
    User["Calon Anggota Buka Form di HP"] --> Watermark["Mesin HP Otomatis Menimpa Watermark KTP: VERIFIKASI KTA APII - AMAN UU PDP"]
    Watermark --> Submit["Formulir Terkirim (100% Bebas Biaya/Gratis)"]
    
    Submit --> Sek["Verifikasi Sekretaris (Tahap 1): Cek pasfoto & KTP"]
    Sek --> Ket["Pengesahan Ketua: Terbitkan NIA Nasional"]
    
    Ket --> KTA["KTA Digital CR80 Siap Cetak: Depan Identitas 5 Tahun, Belakang Kode Etik & QR"]`
  },
  {
    name: 'diagram_7_17_inovasi_dakwah',
    chart: `flowchart TD
    Root["17 Inovasi Dakwah Unggulan APII"]
    
    subgraph K1 ["1. Perlindungan & Hukum"]
        F1["LBH Siaga Advokasi Dai"]
        F2["Anti-Leak Dynamic Watermarking"]
        F3["Radar Tabayyun Counter-Framing"]
    end
    
    subgraph K2 ["2. Tata Kelola & Syariah"]
        F4["Benteng 4 Kantong Fiqih Kas"]
        F5["Auto-Closing Rekonsiliasi Bulanan"]
        F6["One-Click Decree Generator SK"]
        F7["Penanggalan Hijriah Otomatis"]
        F8["Risalah Musyawarah Digital"]
    end
    
    subgraph K3 ["3. Penguatan Dai & Kader"]
        F9["KTA Digital CR80 Lisensi 1, 2, 3"]
        F10["Maktabah Dalil Apologetika"]
        F11["Presensi Scan QR KTA Acara"]
        F12["Pelacak Aset Logistik Dakwah"]
    end
    
    subgraph K4 ["4. Pelayanan Umat & Publik"]
        F13["Kanal Konsultasi Aqidah Rahasia"]
        F14["Modul Muallaf Care & E-Sertifikat"]
        F15["Infaq Tematik Crowdfunding"]
        F16["Peta Sebaran Dakwah Geo-Hub"]
        F17["PWA Aplikasi Layar HP Ringan"]
    end
    
    Root --> K1
    Root --> K2
    Root --> K3
    Root --> K4`
  }
];

async function run() {
  console.log(`Generating ${diagrams.length} diagrams...`);
  for (const d of diagrams) {
    try {
      const b64 = Buffer.from(d.chart).toString('base64');
      const url = `https://mermaid.ink/img/${b64}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const buf = await res.arrayBuffer();
      const filePath = path.join(outDir, `${d.name}.png`);
      fs.writeFileSync(filePath, Buffer.from(buf));
      console.log(`[OK] ${d.name}.png (${buf.byteLength} bytes)`);
    } catch (err) {
      console.error(`[FAIL] ${d.name}:`, err.message);
    }
  }
  console.log('All diagrams processed!');
}

run();

