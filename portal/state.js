/**
 * SIAP APII Enterprise - State Management & Shared Real-Time Database Bridge
 * Yayasan Apologet Islam Indonesia (SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023)
 * Pengembang: Sigit Adi Irianto (https://wa.me/6281358575678 | sigitadi.id)
 * Connects /portal and /public with 28 Tables, 7 Divisions, 4 Sharia Wallets, and 17 Innovations
 */

const State = (() => {
  const STORAGE_KEY = (typeof CONFIG !== 'undefined' && CONFIG.SHARED_STORAGE_KEY) || 'siap_apii_shared_db_v3';

  // In-memory working cache
  let db = null;

  // Indonesian Islamic Month Names (Kemenag RI / Ummul Qura)
  const HIJRI_MONTHS_ID = [
    'Muharram', 'Safar', 'Rabiul Awwal', 'Rabiul Akhir',
    'Jumadil Awal', 'Jumadil Akhir', 'Rajab', 'Sya\'ban',
    'Ramadhan', 'Syawwal', 'Dzulqa\'dah', 'Dzulhijjah'
  ];

  // Pure synchronous JS FIPS 180-4 SHA-256 returning 64-char lowercase hex
  function computeSha256(str) {
    const input = String(str === undefined || str === null ? '' : str);
    let bytes;
    if (typeof TextEncoder !== 'undefined') {
      bytes = new TextEncoder().encode(input);
    } else {
      const utf8 = unescape(encodeURIComponent(input));
      bytes = new Uint8Array(utf8.length);
      for (let i = 0; i < utf8.length; i++) {
        bytes[i] = utf8.charCodeAt(i);
      }
    }

    const K = new Uint32Array([
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]);

    const H = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]);

    const bitLen = bytes.length * 8;
    const totalLen = Math.ceil((bytes.length + 9) / 64) * 64;
    const padded = new Uint8Array(totalLen);
    padded.set(bytes);
    padded[bytes.length] = 0x80;

    const view = new DataView(padded.buffer);
    const highBits = Math.floor(bitLen / 0x100000000);
    const lowBits = bitLen >>> 0;
    view.setUint32(totalLen - 8, highBits, false);
    view.setUint32(totalLen - 4, lowBits, false);

    const w = new Uint32Array(64);
    const rotr = (n, x) => (x >>> n) | (x << (32 - n));

    for (let offset = 0; offset < totalLen; offset += 64) {
      for (let i = 0; i < 16; i++) {
        w[i] = view.getUint32(offset + i * 4, false);
      }
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
        const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }

      let a = H[0], b = H[1], c = H[2], d = H[3];
      let e = H[4], f = H[5], g = H[6], h = H[7];

      for (let i = 0; i < 64; i++) {
        const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
        const ch = (e & f) ^ ((~e) & g);
        const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) >>> 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      H[0] = (H[0] + a) >>> 0;
      H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0;
      H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0;
      H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0;
      H[7] = (H[7] + h) >>> 0;
    }

    let hex = '';
    for (let i = 0; i < 8; i++) {
      hex += H[i].toString(16).padStart(8, '0');
    }
    return hex;
  }

  function hashConsultToken(token) {
    return computeSha256(String(token === undefined || token === null ? '' : token) + ':APII_CONSULT');
  }

  // UU PDP No. 27/2022: Masking NIK menjadi format baku XXXX********XXXX
  function maskNik(nik) {
    const clean = String(nik || '').replace(/\s+/g, '').trim();
    if (!clean) return '';
    if (clean.length <= 4) return '*'.repeat(clean.length);
    if (clean.length <= 8) {
      return clean.slice(0, 2) + '*'.repeat(clean.length - 4) + clean.slice(-2);
    }
    const midLen = Math.max(4, clean.length - 8);
    return clean.slice(0, 4) + '*'.repeat(midLen) + clean.slice(-4);
  }

  // Deterministic Monogram SVG Data URI (R-23: Zero Unsplash stock photos)
  function createMonogramAvatar(name, role) {
    const raw = String(name || 'APII').trim();
    const titles = /^(ust\.?|ustadz|prof\.?|dr\.?|drs\.?|k\.?h\.?|h\.?|hj\.?|adv\.?|ir\.?)$/i;
    const words = raw
      .replace(/[,]/g, ' ')
      .split(/\s+/)
      .filter(w => w && !titles.test(w) && !/^[A-Z]\.[A-Za-z.]+$/.test(w));
    const sourceWords = words.length > 0 ? words : raw.split(/\s+/).filter(Boolean);
    let initials = 'AP';
    if (sourceWords.length >= 2) {
      initials = (sourceWords[0][0] + sourceWords[1][0]).toUpperCase();
    } else if (sourceWords.length === 1) {
      initials = sourceWords[0].slice(0, 2).toUpperCase();
    }
    initials = initials.replace(/[^A-Z0-9]/g, '') || 'AP';

    const roleKey = String(role || '').toLowerCase();
    const palette = {
      superadmin: '#0F172A',
      ketua: '#064E3B',
      sekretaris: '#0F766E',
      bendahara: '#B45309',
      pembina: '#1E3A8A',
      pengawas: '#4338CA',
      ketua_divisi: '#047857',
      anggota_divisi: '#334155',
      kader_biasa: '#475569'
    };
    let bg = palette[roleKey];
    if (!bg) {
      const fallbacks = ['#064E3B', '#0F172A', '#0F766E', '#1E3A8A', '#B45309', '#334155'];
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
      }
      bg = fallbacks[Math.abs(hash) % fallbacks.length];
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="${initials}"><rect width="100" height="100" rx="18" fill="${bg}"/><circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/><text x="50" y="57" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="36" font-weight="700" fill="#FFFFFF" letter-spacing="1">${initials}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  // Sharia Guard Engine [PRD 356, 481] matching ShariaGuard.gs
  function validateShariaExpense(kantongSyariah, kategori, keterangan) {
    const kantong = String(kantongSyariah || '').toUpperCase().trim();
    const teks = (String(kategori || '') + ' ' + String(keterangan || '')).toLowerCase();

    if (kantong === 'ZAKAT') {
      const kataKunciAshnaf = [
        'muallaf', 'mualaf', 'fakir', 'miskin', 'santunan',
        'bantuan dai', 'fi sabilillah', 'fisabilillah', 'ibnu sabil',
        'gharimin', 'riqab', 'ashnaf', 'asnaf'
      ];
      const lolosAshnaf = kataKunciAshnaf.some(k => teks.includes(k));
      if (!lolosAshnaf) {
        return {
          valid: false,
          error: 'PELANGGARAN SYARIAH: Dana Zakat hanya berhak disalurkan kepada 8 Ashnaf (termasuk Muallaf Care & Bantuan Da\'i Pedalaman). Tidak boleh digunakan untuk operasional kantor, konsumsi rapat, atau pembelian aset umum.'
        };
      }
    }

    if (kantong === 'WAKAF') {
      const kataKunciBukanWakaf = [
        'makan', 'snack', 'bensin', 'pulsa', 'honor', 'gaji',
        'listrik', 'atk', 'konsumsi', 'air', 'internet', 'sewa server', 'operasional rutin'
      ];
      const melanggarWakaf = kataKunciBukanWakaf.some(k => teks.includes(k));
      if (melanggarWakaf) {
        return {
          valid: false,
          error: 'PELANGGARAN SYARIAH: Dana Wakaf terikat secara hukum syariat untuk pengadaan aset fisik permanen atau wakaf produktif, bukan biaya konsumtif habis pakai, gaji, atau listrik.'
        };
      }
    }

    return { valid: true };
  }

  // Initial Rich Database Seeding
  const INITIAL_DB = {
    // 1. Surat Keluar (Sheet_Surat)
    surat: [
      {
        id: 'SRT-001',
        tenantId: 'DPP_PUSAT',
        nomorSurat: '005/SM-DPP-APII/XI/2026',
        tipe: 'SURAT_MANDAT',
        kodePerihal: 'SM',
        perihal: 'Surat Mandat Delegasi Dialog Teologi & Kristologi Nasional 2026',
        tujuan: 'Ust. Dani Ramadhan, M.Ag. (Kadiv Litbang APII)',
        tanggalMasehi: '09-11-2026',
        tanggalHijriah: '29 Jumadil Awal 1448 H',
        klasifikasi: 'Penting',
        tingkatKeamanan: 'Biasa',
        lampiran: '1 Berkas TOR',
        isiSurat: 'Memberikan mandat penuh kepada nama tertera di atas untuk mewakili Dewan Pengurus Pusat Yayasan Apologet Islam Indonesia dalam forum Dialog Teologi dan Kristologi Komparatif Nasional 2026 di Jakarta Islamic Centre.',
        status: 'APPROVED',
        statusSignature: 'APPROVED',
        signedBy: 'Ust. H. Ahmad Fauzi, Lc., M.A. (Ketua Umum DPP)',
        signedAt: '09-11-2026 09:30',
        catatanRevisi: '',
        hashSha256: computeSha256('005/SM-DPP-APII/XI/2026' + 'Surat Mandat Delegasi Dialog Teologi & Kristologi Nasional 2026' + 'Memberikan mandat penuh kepada nama tertera di atas untuk mewakili Dewan Pengurus Pusat Yayasan Apologet Islam Indonesia dalam forum Dialog Teologi dan Kristologi Komparatif Nasional 2026 di Jakarta Islamic Centre.'),
        pdfDriveUrl: 'https://drive.google.com/apii/01_SURAT_KELUAR/SRT-001.pdf',
        createdBy: 'Ust. M. Ridwan, S.Pd.I.'
      },
      {
        id: 'SRT-002',
        tenantId: 'DPP_PUSAT',
        nomorSurat: '006/SK-DPP-APII/XI/2026',
        tipe: 'SK_KEPENGURUSAN',
        kodePerihal: 'SK',
        perihal: 'Surat Keputusan Pengesahan Susunan Pengurus DPW APII Jabodetabek 2026-2031',
        tujuan: 'Dewan Pengurus Wilayah APII Jabodetabek',
        tanggalMasehi: '08-11-2026',
        tanggalHijriah: '28 Jumadil Awal 1448 H',
        klasifikasi: 'Sangat Penting',
        tingkatKeamanan: 'Biasa',
        lampiran: '1 Lembar Tabel Susunan Pengurus',
        isiSurat: 'Menimbang, Mengingat AD/ART APII 16 Bab, dan Memutuskan: Mengesahkan secara definitif susunan personalia DPW Yayasan APII Jabodetabek.',
        status: 'AJUKAN',
        statusSignature: 'PENDING_KETUA',
        signedBy: 'Diajukan oleh Sekretaris Umum',
        signedAt: null,
        catatanRevisi: '',
        hashSha256: computeSha256('006/SK-DPP-APII/XI/2026' + 'Surat Keputusan Pengesahan Susunan Pengurus DPW APII Jabodetabek 2026-2031' + 'Menimbang, Mengingat AD/ART APII 16 Bab, dan Memutuskan: Mengesahkan secara definitif susunan personalia DPW Yayasan APII Jabodetabek.'),
        pdfDriveUrl: '#',
        createdBy: 'Ust. M. Ridwan, S.Pd.I.'
      },
      {
        id: 'SRT-003',
        tenantId: 'DPW_JABO',
        nomorSurat: '002/UND-DPW-JABO/XI/2026',
        tipe: 'SURAT_UNDANGAN',
        kodePerihal: 'UND',
        perihal: 'Undangan Silaturahmi Akbar dan Pembinaan Muallaf se-Jabodetabek',
        tujuan: 'Seluruh Pembina & Relawan Muallaf APII Jabodetabek',
        tanggalMasehi: '07-11-2026',
        tanggalHijriah: '27 Jumadil Awal 1448 H',
        klasifikasi: 'Biasa',
        tingkatKeamanan: 'Biasa',
        lampiran: '-',
        isiSurat: 'Mengharap kehadiran seluruh kader dan relawan dalam rangka koordinasi bulanan dan santunan berkala binaan muallaf se-Jabodetabek.',
        status: 'APPROVED',
        statusSignature: 'APPROVED',
        signedBy: 'Ust. Bambang Hidayat, M.Si. (Ketua DPW Jabodetabek)',
        signedAt: '07-11-2026 14:15',
        catatanRevisi: '',
        hashSha256: computeSha256('002/UND-DPW-JABO/XI/2026' + 'Undangan Silaturahmi Akbar dan Pembinaan Muallaf se-Jabodetabek' + 'Mengharap kehadiran seluruh kader dan relawan dalam rangka koordinasi bulanan dan santunan berkala binaan muallaf se-Jabodetabek.'),
        pdfDriveUrl: 'https://drive.google.com/apii/01_SURAT_KELUAR/SRT-003.pdf',
        createdBy: 'Ust. Irwan Setiawan'
      }
    ],

    // 2. Surat Masuk & Lembar Disposisi 2-Tahap (Sheet_Surat_Masuk & Sheet_Disposisi)
    suratMasuk: [
      {
        id: 'SMK-001',
        tenantId: 'DPP_PUSAT',
        noAgenda: 'AGD/2026/XI/018',
        asalSurat: 'Kementerian Agama RI - Ditjen Bimas Islam',
        noSuratAsli: 'B-421/Setjen/BimasIslam/XI/2026',
        tglSurat: '08-11-2026',
        tglTerima: '09-11-2026',
        perihal: 'Permohonan Narasumber Dialog Literasi Apologetika & Kerukunan',
        ringkasan: 'Permohonan kehadiran narasumber pakar teologi komparatif dalam dialog antar-tokoh agama.',
        pdfFileUrl: '#',
        statusDisposisi: 'PENDING_KETUA',
        // Draf Rekomendasi Sekretaris (Tahap 1)
        drafRekomendasiSekretaris: 'Rekomendasi Sekretaris: Hadiri dan tugaskan Kadiv Litbang serta siapkan bahan naskah kajian dalil.',
        targetDivisi: ['litbang', 'humas'],
        tingkatUrgensi: 'SEGERA',
        // Otorisasi Ketua (Tahap 2)
        instruksiKetua: '',
        batasWaktu: '14-11-2026',
        catatanTambahan: '',
        parafKetua: null,
        laporanTindakLanjut: '',
        laporanPerDivisi: {}
      },
      {
        id: 'SMK-002',
        tenantId: 'DPP_PUSAT',
        noAgenda: 'AGD/2026/XI/017',
        asalSurat: 'Majelis Ulama Indonesia (MUI) Prov. DKI Jakarta',
        noSuratAsli: '102/MUI-DKI/Kom-Ukhuwah/XI/2026',
        tglSurat: '05-11-2026',
        tglTerima: '06-11-2026',
        perihal: 'Undangan Rapat Koordinasi Penanganan Pemurtadan & Perlindungan Muallaf',
        ringkasan: 'Koordinasi penanganan kasus pemurtadan terselubung dan penguatan shelter binaan muallaf.',
        pdfFileUrl: '#',
        statusDisposisi: 'DISPOSISI_TERBIT',
        drafRekomendasiSekretaris: 'Dihadiri oleh Kadiv Dakwah & LBH APII dengan membawa data 10 kasus dampingan.',
        targetDivisi: ['dakwah', 'hukum'],
        tingkatUrgensi: 'SANGAT_RAHASIA_PENTING',
        instruksiKetua: 'TINDAK_LANJUTI, WAKILKAN_HADIRI',
        batasWaktu: '10-11-2026',
        catatanTambahan: 'Siapkan resume pendampingan hukum dan dokumen perlindungan muallaf.',
        parafKetua: 'Ust. H. Ahmad Fauzi, Lc., M.A.',
        laporanTindakLanjut: 'Telah dihadiri oleh Ust. Yohanes Fachruddin dan Adv. M. Rizqi, S.H. Dokumen diserahkan ke komisi fatwa MUI.',
        laporanPerDivisi: {
          dakwah: {
            laporan: 'Telah dihadiri oleh Ust. Yohanes Fachruddin dan memaparkan data 10 kasus dampingan muallaf.',
            pelapor: 'Ust. Yohanes Fachruddin',
            tanggal: '09-11-2026 10:00:00'
          },
          hukum: {
            laporan: 'Adv. M. Rizqi, S.H. menyerahkan resume pendampingan hukum ke komisi fatwa MUI.',
            pelapor: 'Adv. M. Rizqi, S.H., M.H.',
            tanggal: '09-11-2026 10:15:00'
          }
        }
      }
    ],

    // 3. Keuangan Kas Syar'i (4 Kantong, Dual-Approval, Dual-Slip Kwitansi)
    kas: {
      balances: {
        DPP_PUSAT: {
          AMIL_OPERASIONAL: 42850000,
          ZAKAT: 85200000,
          INFAQ_DAKWAH: 63100000,
          WAKAF: 145000000
        },
        DPW_JABO: {
          AMIL_OPERASIONAL: 12500000,
          ZAKAT: 24000000,
          INFAQ_DAKWAH: 18500000,
          WAKAF: 35000000
        }
      },
      transactions: [
        {
          id: 'TRX-001',
          tenantId: 'DPP_PUSAT',
          tanggal: '09-11-2026',
          tipe: 'MASUK',
          kantongSyariah: 'INFAQ_DAKWAH',
          kategori: 'Infaq Dakwah Tematik',
          nominal: 15000000,
          noVoucher: 'BKM-202611-001',
          noKwitansi: 'KWT-BKM-202611-001',
          keterangan: 'Infaq Program Safari Dakwah Kristologi Komparatif',
          pihakTerkait: 'Hamba Allah (Transfer BSI Kas Pusat)',
          metode: 'TRANSFER_BANK',
          statusApproval: 'APPROVED',
          verifiedBendaharaBy: 'H. Syamsuddin, S.E., Ak.',
          approvedKetuaBy: 'Ust. H. Ahmad Fauzi, Lc., M.A.',
          buktiUrl: '#'
        },
        {
          id: 'TRX-002',
          tenantId: 'DPP_PUSAT',
          tanggal: '08-11-2026',
          tipe: 'KELUAR',
          kantongSyariah: 'AMIL_OPERASIONAL',
          kategori: 'Operasional Server & Digitalisasi',
          nominal: 3500000,
          noVoucher: 'BKK-202611-001',
          noKwitansi: 'KWT-BKK-202611-001',
          keterangan: 'Biaya Sewa Server Cloud, Domain & Zoom Pro Dakwah Nov 2026',
          pihakTerkait: 'Divisi Sosmed & Digital',
          metode: 'TRANSFER_BANK',
          statusApproval: 'APPROVED',
          verifiedBendaharaBy: 'H. Syamsuddin, S.E., Ak.',
          approvedKetuaBy: 'Ust. H. Ahmad Fauzi, Lc., M.A.',
          buktiUrl: '#'
        },
        {
          id: 'TRX-003',
          tenantId: 'DPP_PUSAT',
          tanggal: '09-11-2026',
          tipe: 'KELUAR',
          kantongSyariah: 'ZAKAT',
          kategori: 'Santunan Muallaf & Fisabilillah',
          nominal: 7500000,
          noVoucher: 'DRAFT-KEU-003',
          noKwitansi: 'PENDING',
          keterangan: 'Bantuan Darurat Biaya Hidup & Hukum Muallaf Terancam Pengusiran (Ashnaf Muallaf & Fisabilillah)',
          pihakTerkait: 'Divisi Hukum & Advokasi (LBH APII)',
          metode: 'TUNAI',
          statusApproval: 'VERIFIKASI_BENDAHARA', // Tahap 1 lolos, menunggu pengesahan Ketua
          verifiedBendaharaBy: 'H. Syamsuddin, S.E., Ak.',
          approvedKetuaBy: null,
          buktiUrl: '#'
        }
      ],
      closings: [
        {
          id: 'CLS-2026-10',
          tenantId: 'DPP_PUSAT',
          periode: 'Oktober 2026',
          tanggalClosing: '31-10-2026',
          totalPemasukan: 142500000,
          totalPengeluaran: 68400000,
          saldoAkhir: 336150000,
          statusPsak409: 'RECONCILED_AUDITED',
          auditedBy: 'Drs. H. Sudirman, Ak., CA (Dewan Pengawas)',
          arsipDrivePdf: 'https://drive.google.com/apii/03_BUKTI_KAS/Laporan_PSAK409_Okt2026.pdf'
        }
      ]
    },

    // 4. Program Kerja 7 Divisi Resmi ART Pasal 16 (Sheet_Divisi)
    proker: [
      {
        id: 'PRK-001',
        tenantId: 'DPP_PUSAT',
        divisiKode: 'litbang',
        divisiNama: 'Divisi Litbang',
        kantongSyariah: 'INFAQ_DAKWAH',
        namaProgram: 'Penyusunan Modul & Silabus Kristologi Komparatif untuk 500 Da’i',
        latarBelakang: 'Kebutuhan standardisasi argumentasi ilmiah apologetika Islam berlandaskan manuskrip kuno.',
        targetSasaran: '500 Dai Muda dan Asatidz se-Indonesia',
        rabNominal: 25000000,
        realisasiDana: 18500000,
        tglPelaksanaan: '15-11-2026',
        status: 'DISETUJUI',
        catatanKetua: 'Disetujui. Koordinasikan pencairan berkala dengan Bendahara Umum.',
        lpjDriveUrl: 'https://drive.google.com/apii/04_LPJ_DIVISI/LPJ_Modul_Litbang.pdf',
        statusLpj: 'LPJ_SELESAI',
        createdBy: 'Ust. Dani Ramadhan, M.Ag.'
      },
      {
        id: 'PRK-002',
        tenantId: 'DPP_PUSAT',
        divisiKode: 'hukum',
        divisiNama: 'Divisi Hukum & Advokasi',
        kantongSyariah: 'INFAQ_DAKWAH',
        namaProgram: 'Posko Siaga Bantuan Hukum 24 Jam Kasus Diskriminasi Agama & Somasi Da\'i',
        latarBelakang: 'Maraknya intimidasi dan somasi terhadap dai di pelosok saat berdialog ilmiah.',
        targetSasaran: 'Seluruh dai APII dan ormas mitra di 38 provinsi',
        rabNominal: 35000000,
        realisasiDana: 12000000,
        tglPelaksanaan: '01-12-2026',
        status: 'PELAKSANAAN',
        catatanKetua: 'Sangat mendesak. Pantau realisasi bersama tim advokat LBH APII.',
        lpjDriveUrl: '#',
        statusLpj: 'PROGRES',
        createdBy: 'Adv. M. Rizqi, S.H., M.H.'
      },
      {
        id: 'PRK-003',
        tenantId: 'DPP_PUSAT',
        divisiKode: 'dakwah',
        divisiNama: 'Divisi Dakwah dan Pendidikan',
        kantongSyariah: 'ZAKAT',
        namaProgram: 'Shelter Perlindungan & Program Kemandirian Ekonomi 10 Muallaf Binaan',
        latarBelakang: 'Perlindungan tempat tinggal dan modal usaha bagi muallaf yang diusir keluarga.',
        targetSasaran: '10 Muallaf binaan Jakarta & Jabar',
        rabNominal: 40000000,
        realisasiDana: 0,
        tglPelaksanaan: '20-12-2026',
        status: 'AJUKAN',
        catatanKetua: 'Menunggu review alokasi dari Kantong Kas Zakat.',
        lpjDriveUrl: '#',
        statusLpj: 'BELUM_MULAI',
        createdBy: 'Ust. Yohanes Fachruddin'
      },
      {
        id: 'PRK-004',
        tenantId: 'DPP_PUSAT',
        divisiKode: 'sosmed',
        divisiNama: 'Divisi Sosmed & Digital',
        kantongSyariah: 'INFAQ_DAKWAH',
        namaProgram: 'Radar Tabayyun Counter-Framing & Live Streaming Kajian Apologetika',
        latarBelakang: 'Pemberantasan framing video potongan ceramah dai yang dipelintir akun provokatif.',
        targetSasaran: 'Warganet dan jamaah digital di YouTube, TikTok & Instagram',
        rabNominal: 15000000,
        realisasiDana: 5000000,
        tglPelaksanaan: '20-11-2026',
        status: 'PELAKSANAAN',
        catatanKetua: 'Lanjutkan counter-framing secara cepat dan beradab.',
        lpjDriveUrl: '#',
        statusLpj: 'PROGRES',
        createdBy: 'Ahmad Farhan, S.Kom.'
      }
    ],

    // 5. Keanggotaan Nasional & KTA Digital CR80 2-Sisi (Sheet_Pendaftar & Sheet_KTA_Nasional)
    anggota: [
      {
        id: 'MBR-001',
        tenantId: 'DPP_PUSAT',
        nia: 'APII-PUSAT-2026-00125',
        namaLengkap: 'Ust. Dani Ramadhan, M.Ag.',
        nik: '3171********0001',
        kota: 'Jakarta Pusat',
        wilayah: 'DPP Pusat (Nasional)',
        divisiMinat: 'litbang',
        tingkatLisensi: 3, // Tingkat 3 - Dewan Pakar Senior
        keahlian: 'Kristologi Komparatif, Bahasa Ibrani & Manuskrip Kuno',
        status: 'APPROVED',
        tglTerbit: '15-01-2026',
        tglKedaluwarsa: '15-01-2031',
        telepon: '6281234567802',
        fotoUrl: createMonogramAvatar('Ust. Dani Ramadhan, M.Ag.', 'ketua_divisi'),
        ktpWatermarkUrl: '#',
        verifiedSekretarisAt: '14-01-2026 10:00',
        approvedKetuaAt: '15-01-2026 08:30',
        kodeEtikVersi: 'APII-ETIK-2026-V1'
      },
      {
        id: 'MBR-002',
        tenantId: 'DPP_PUSAT',
        nia: 'APII-PUSAT-2026-00126',
        namaLengkap: 'Ilham Kurniawan, S.I.Kom.',
        nik: '3275********0002',
        kota: 'Bekasi',
        wilayah: 'DPP Pusat (Nasional)',
        divisiMinat: 'humas',
        tingkatLisensi: 2, // Tingkat 2 - Da'i Madya / Lapangan
        keahlian: 'Humas, Komunikasi Publik & Siaran Pers',
        status: 'APPROVED',
        tglTerbit: '10-02-2026',
        tglKedaluwarsa: '10-02-2031',
        telepon: '6281234567801',
        fotoUrl: createMonogramAvatar('Ilham Kurniawan, S.I.Kom.', 'ketua_divisi'),
        ktpWatermarkUrl: '#',
        verifiedSekretarisAt: '09-02-2026 11:00',
        approvedKetuaAt: '10-02-2026 09:15',
        kodeEtikVersi: 'APII-ETIK-2026-V1'
      },
      {
        id: 'MBR-003',
        tenantId: 'DPW_JABO',
        nia: 'APII-JABO-2026-00042',
        namaLengkap: 'Ust. Zulkifli, S.Th.I.',
        nik: '3674********0003',
        kota: 'Tangerang Selatan',
        wilayah: 'DPW Jabodetabek',
        divisiMinat: 'dakwah',
        tingkatLisensi: 1, // Tingkat 1 - Kader Da'i Muda
        keahlian: 'Kajian Tauhid & Bimbingan Muallaf Pemula',
        status: 'VERIFIED_SEKRETARIS', // Menunggu pengesahan Ketua DPW
        tglTerbit: '08-11-2026',
        tglKedaluwarsa: '08-11-2031',
        telepon: '6281234567899',
        fotoUrl: createMonogramAvatar('Ust. Zulkifli, S.Th.I.', 'anggota_divisi'),
        ktpWatermarkUrl: '#',
        verifiedSekretarisAt: '08-11-2026 16:00',
        approvedKetuaAt: null,
        kodeEtikVersi: 'APII-ETIK-2026-V1'
      }
    ],

    // 6. Siaga Advokasi LBH APII (Sheet_Advokasi)
    advokasi: [
      {
        id: 'ADV-001',
        tenantId: 'DPP_PUSAT',
        tiketNo: 'TIKET-LBH-202611-001',
        namaDai: 'Ust. Dani Ramadhan, M.Ag.',
        kontak: '6281234567802',
        lokasi: 'Bekasi Timur, Jawa Barat',
        kronologi: 'Menerima surat somasi dari pihak yayasan luar terkait kutipan perbandingan ayat dalam kajian ilmiah tertutup.',
        urgensi: 'KILAT_DARURAT',
        buktiUrl: '#',
        status: 'TERBIT_SURAT_TUGAS',
        catatanLbh: 'Telah diterbitkan Surat Tugas Advokat No. 012/ST-LBH-APII/XI/2026. Adv. M. Rizqi, S.H. ditunjuk sebagai kuasa pendamping.',
        updatedAt: '09-11-2026 11:30'
      },
      {
        id: 'ADV-002',
        tenantId: 'DPW_JABO',
        tiketNo: 'TIKET-LBH-202611-002',
        namaDai: 'Ust. Bambang Hidayat, M.Si.',
        kontak: '6281234567891',
        lokasi: 'Cilandak, Jakarta Selatan',
        kronologi: 'Permintaan pendampingan perlindungan saksi untuk muallaf baru yang diancam pembatalan hak waris keluarga.',
        urgensi: 'PENTING',
        buktiUrl: '#',
        status: 'MENUNGGU_TELAAH',
        catatanLbh: 'Berkas kronologi masuk dan sedang ditelaah oleh tim LBH APII Jabodetabek.',
        updatedAt: '09-11-2026 14:00'
      }
    ],

    // 7. Radar Tabayyun & Counter-Framing Media (Divisi Sosmed & Humas)
    tabayyun: [
      {
        id: 'TBY-001',
        tenantId: 'DPP_PUSAT',
        judulKlarifikasi: 'Klarifikasi Resmi DPP APII atas Potongan Video Kajian Surat Al-Maidah Ayat 72',
        saluranMedia: 'TikTok & YouTube Shorts',
        linkSumberFitnah: 'https://tiktok.com/@provokasi/video/99999',
        naskahKlarifikasi: 'Dewan Pengurus Pusat Yayasan APII menegaskan bahwa video yang beredar telah dipotong secara sengaja di menit ke 12:45 untuk menimbulkan kesan penistaan. Kajian aslinya adalah bedah naskah tafsir ilmiah berdurasi 1 jam 40 menit.',
        statusRilis: 'RELEASED',
        tglRilis: '09-11-2026',
        penanggungJawab: 'Ahmad Farhan (Kadiv Sosmed) & Ilham Kurniawan (Kadiv Humas)'
      }
    ],

    // 8. Muallaf Care & Tashdiq Syahadatain A4 (Sheet_Muallaf)
    muallaf: [
      {
        id: 'MLF-001',
        tenantId: 'DPP_PUSAT',
        regNo: 'APII-SYH-2026-0045',
        namaAsli: 'Christian Robertus Sihombing',
        namaHijrah: 'Muhammad Zayd Abdullah',
        tglSyahadat: '25-10-2026',
        tempatSyahadat: 'Markaz Dakwah Pusat APII, Jakarta',
        pembimbing: 'Ust. Yohanes Fachruddin (Kadiv Dakwah)',
        saksi1: 'Ust. Dani Ramadhan, M.Ag.',
        saksi2: 'H. Syamsuddin, S.E.',
        sertifikatUrl: 'https://drive.google.com/apii/08_MUALLAF_CARE/Piagam_Syahadat_Zayd.pdf',
        statusZakat: 'TERIMA_SANTUNAN_ZAKAT',
        nominalSantunan: 5000000,
        createdAt: '25-10-2026 15:30'
      },
      {
        id: 'MLF-002',
        tenantId: 'DPW_JABO',
        regNo: 'APII-SYH-2026-0046',
        namaAsli: 'Maria Fransisca Natalia',
        namaHijrah: 'Siti Maryam Shalihah',
        tglSyahadat: '02-11-2026',
        tempatSyahadat: 'Sekretariat DPW APII Jabodetabek',
        pembimbing: 'Ust. Bambang Hidayat, M.Si.',
        saksi1: 'Ust. Irwan Setiawan',
        saksi2: 'Fathur Rahman, S.Pd.',
        sertifikatUrl: 'https://drive.google.com/apii/08_MUALLAF_CARE/Piagam_Syahadat_Maryam.pdf',
        statusZakat: 'PROSES_PENGAJUAN',
        nominalSantunan: 3500000,
        createdAt: '02-11-2026 11:00'
      }
    ],

    // 9. Presensi Scan QR KTA Acara (Sheet_Attendance)
    attendance: [
      {
        id: 'ATT-001',
        tenantId: 'DPP_PUSAT',
        eventNama: 'Dauroh Kristologi Komparatif Nasional 2026',
        tanggal: '09-11-2026',
        nia: 'APII-PUSAT-2026-00125',
        namaAnggota: 'Ust. Dani Ramadhan, M.Ag.',
        scanTimestamp: '09-11-2026 08:15:22',
        verifiedBy: 'Panitia Divisi Dakwah'
      },
      {
        id: 'ATT-002',
        tenantId: 'DPP_PUSAT',
        eventNama: 'Dauroh Kristologi Komparatif Nasional 2026',
        tanggal: '09-11-2026',
        nia: 'APII-PUSAT-2026-00126',
        namaAnggota: 'Ilham Kurniawan, S.I.Kom.',
        scanTimestamp: '09-11-2026 08:20:10',
        verifiedBy: 'Panitia Divisi Dakwah'
      }
    ],

    // 10. Pelacak Aset & Peminjaman Logistik QR (Sheet_Assets & Sheet_Asset_Loans)
    assets: [
      {
        id: 'AST-001',
        tenantId: 'DPP_PUSAT',
        kodeAset: 'AST-PUSAT-SND-01',
        namaBarang: 'Sound System Portable Wireless 500W Outdoor',
        kategori: 'Perlengkapan Acara',
        kondisi: 'Baik & Berfungsi Penuh',
        lokasiSimpan: 'Gudang Logistik Divisi Umum Lt. 1',
        qrUrl: '#',
        createdAt: '10-01-2026'
      },
      {
        id: 'AST-002',
        tenantId: 'DPP_PUSAT',
        kodeAset: 'AST-PUSAT-MOB-01',
        namaBarang: 'Mobil Operasional Dakwah & Advokasi APII (Toyota HiAce)',
        kategori: 'Kendaraan Dakwah',
        kondisi: 'Baik / Servis Rutin',
        lokasiSimpan: 'Garasi Sekretariat DPP',
        qrUrl: '#',
        createdAt: '10-01-2026'
      }
    ],
    assetLoans: [
      {
        id: 'LON-001',
        tenantId: 'DPP_PUSAT',
        asetId: 'AST-PUSAT-SND-01',
        namaBarang: 'Sound System Portable Wireless 500W Outdoor',
        divisiPeminjam: 'dakwah',
        penanggungJawab: 'Ust. Yohanes Fachruddin',
        tglPinjam: '08-11-2026',
        tglKembaliRencana: '10-11-2026',
        tglKembaliAktual: null,
        status: 'DIPINJAM'
      }
    ],

    // 11. Kanal Konsultasi Aqidah Rahasia (Sheet_Consultations)
    consultations: [
      {
        id: 'CSL-001',
        tokenHash: 'tok_9a8b7c6d5e4f3a2b1c',
        tiketNo: 'TKT-AQD-202611-001',
        topik: 'Ketuhanan Yesus & Naskah Yohanes 1:1',
        pertanyaan: 'Bagaimana bantahan ilmiah terhadap klaim bahwa Firman itu adalah Allah dalam Injil Yohanes 1:1 menurut kajian bahasa Yunani asli?',
        jawaban: 'Dalam teks Yunani kuno, kata "Theos" kedua tidak menggunakan artikel penentu (anarthrous), yang menunjukkan sifat/kualitas ilahi (divine quality) bukan identitas mutlak Dzat Allah. Hal ini dijelaskan secara rinci oleh para sarjana tekstual kredibel.',
        status: 'TERJAWAB',
        createdAt: '08-11-2026 20:15',
        answeredAt: '09-11-2026 10:30',
        curatedBy: 'Divisi Litbang APII'
      },
      {
        id: 'CSL-002',
        tokenHash: 'tok_112233445566778899',
        tiketNo: 'TKT-AQD-202611-002',
        topik: 'Keraguan Syubhat Penyaliban',
        pertanyaan: 'Saya seorang mahasiswa yang sering diajak debat teologi mengenai QS An-Nisa 157. Mohon referensi kitab komparatif yang tepat.',
        jawaban: '',
        status: 'MENUNGGU_JAWABAN',
        createdAt: '09-11-2026 13:45',
        answeredAt: null,
        curatedBy: null
      }
    ],

    // 12. Maktabah Apologetika Digital & Bank Dalil Mimbar (Sheet_Knowledge_Base)
    knowledgeBase: [
      {
        id: 'KB-001',
        kategori: 'Kristologi & Teologi Komparatif',
        topik: 'Ketuhanan Yesus dalam Perspektif Al-Qur\'an',
        dalilText: 'QS. Al-Ma\'idah: 72 - "Sesungguhnya telah kafirlah orang-orang yang berkata: Sesungguhnya Allah ialah Al-Masih putra Maryam..."',
        sumberReferensi: 'Tafsir Ibnu Katsir Jilid 3 Hal 150',
        kataKunci: 'Yesus, Nabi Isa, Al-Maidah 72, Ketuhanan, Tritunggal',
        curatedBy: 'Divisi Litbang APII',
        updatedAt: '09-11-2026 10:00'
      },
      {
        id: 'KB-002',
        kategori: 'Tekstual & Manuskrip Kuno',
        topik: 'Perbandingan Manuskrip Sinaiticus & Tradisi Mutawatir',
        dalilText: 'Al-Hijr: 9 - "Sesungguhnya Kamilah yang menurunkan Al-Qur\'an, dan pasti Kami pula yang memeliharanya."',
        sumberReferensi: 'Kajian Tekstual Bruce M. Metzger vs Al-Itqan As-Suyuthi',
        kataKunci: 'Manuskrip, Sinaiticus, Vaticanus, Otentisitas Teks, Al-Hijr 9',
        curatedBy: 'Divisi Litbang APII',
        updatedAt: '08-11-2026 14:00'
      },
      {
        id: 'KB-003',
        kategori: 'Hukum & Advokasi Dakwah',
        topik: 'Landasan Konstitusional Kebebasan Menyampaikan Pendapat Ilmiah',
        dalilText: 'UUD 1945 Pasal 28E Ayat (3) dan UU No. 39 Tahun 1999 tentang HAM',
        sumberReferensi: 'Kompilasi Regulasi Hukum Dakwah LBH APII',
        kataKunci: 'Kebebasan Berpendapat, Dialog Ilmiah, Hak Asasi, Perlindungan Dai',
        curatedBy: 'Divisi Hukum & Advokasi',
        updatedAt: '07-11-2026 16:30'
      }
    ],

    // 13. Risalah Musyawarah Digital Pleno (Sheet_Meetings)
    meetings: [
      {
        id: 'MTG-001',
        tenantId: 'DPP_PUSAT',
        judulRapat: 'Rapat Pleno BPH DPP APII: Evaluasi Safari Dakwah & Peluncuran SIAP APII v3.0',
        tanggal: '08-11-2026',
        pimpinanRapat: 'Ust. H. Ahmad Fauzi, Lc., M.A.',
        notulenText: 'Rapat pleno memutuskan penerbitan SK pengurus DPW percontohan, alokasi santunan 10 muallaf melalui Kantong Zakat, dan percepatan koordinasi LBH APII untuk pendampingan dai.',
        actionItems: [
          { task: 'Menerbitkan SK Pengesahan DPW Jabodetabek A4 ber-QR', pic: 'sekretaris', deadline: '10-11-2026', status: 'SELESAI' },
          { task: 'Verifikasi pencairan santunan zakat muallaf tahap 1', pic: 'bendahara', deadline: '11-11-2026', status: 'PROGRES' },
          { task: 'Koordinasi pembukaan posko siaga bantuan hukum LBH', pic: 'kadiv_hukum', deadline: '15-11-2026', status: 'PROGRES' }
        ],
        parafPimpinan: 'Ust. H. Ahmad Fauzi (Ketua) & Ust. M. Ridwan (Sekretaris)',
        dokumentasiUrl: '#'
      }
    ],

    // 14. Redaksi Mini-CMS Publik (Sheet_EditorialHistory)
    cms: [
      {
        id: 'CMS-001',
        tenantId: 'DPP_PUSAT',
        judul: 'Maklumat Dewan Pengurus Pusat APII tentang Standar Verifikasi Syariah & Legalitas Dakwah',
        kategori: 'Maklumat',
        penulis: 'Sekretariat DPP APII',
        tanggal: '09-11-2026',
        ringkasan: 'Penegasan integritas kelembagaan Yayasan Apologet Islam Indonesia dengan landasan SK Kemenkumham RI AHU-0014970.AH.01.04.Tahun 2023.',
        konten: 'Segala bentuk kegiatan penggalangan donasi, advokasi kristologi, dan penerbitan KTA hanya sah apabila terdaftar dalam sistem verifikasi terpusat SIAP APII.',
        status: 'PUBLISHED',
        views: 1420
      },
      {
        id: 'CMS-002',
        tenantId: 'DPP_PUSAT',
        judul: 'Kajian Komparatif: Membedah Otentisitas Manuskrip Kuno & Argumentasi Teologis Islam',
        kategori: 'Kristologi',
        penulis: 'Ust. Dani Ramadhan, M.Ag.',
        tanggal: '05-11-2026',
        ringkasan: 'Telaah kritis terhadap naskah Sinaiticus, Vaticanus, dan papirus awal dibandingkan tradisi mutawatir Al-Qur’an.',
        konten: 'Dalam diskursus teks suci, integritas transmisi lisan dan tulisan menjadi batu uji keilmuan yang paling kokoh...',
        status: 'PUBLISHED',
        views: 3890
      }
    ],

    // 15. Drive Vault Arsip Digital (10 Subfolder Kanonik PRD)
    drive: [
      {
        id: 'DRV-001',
        tenantId: 'DPP_PUSAT',
        folder: '01_SURAT_KELUAR',
        nama: '005_SM_DPP_APII_XI_2026.pdf',
        ukuran: '1.2 MB',
        diunggahOleh: 'Ust. M. Ridwan, S.Pd.I.',
        tanggal: '09-11-2026',
        url: '#'
      },
      {
        id: 'DRV-002',
        tenantId: 'DPP_PUSAT',
        folder: '03_BUKTI_KAS',
        nama: 'Kwitansi_BKM_202611_001.pdf',
        ukuran: '850 KB',
        diunggahOleh: 'H. Syamsuddin, S.E.',
        tanggal: '09-11-2026',
        url: '#'
      },
      {
        id: 'DRV-003',
        tenantId: 'DPP_PUSAT',
        folder: '08_MUALLAF_CARE',
        nama: 'Piagam_Syahadat_APII_SYH_2026_0045.pdf',
        ukuran: '1.8 MB',
        diunggahOleh: 'Ust. Yohanes Fachruddin',
        tanggal: '25-10-2026',
        url: '#'
      }
    ],

    // Metadata Kuota Google Drive & Recycle Bin 30 Hari
    driveQuota: {
      usedMb: 12450,
      limitMb: 15360,
      warningThresholdPct: 80,
      criticalThresholdPct: 90,
      recycleBinRetentionDays: 30,
      recycleBin: []
    },

    // Kampanye Crowdfunding Infaq & Wakaf Produktif (Sinkron Portal Publik & Kas)
    causes: [
      {
        id: 'CSE-001',
        tenantId: 'DPP_PUSAT',
        title: 'Pembangunan Studio Multimedia Dakwah & Pusat Riset Manuskrip Kuno APII',
        kantongSyariah: 'WAKAF',
        target: 250000000,
        current: 178450000,
        donorsCount: 1420,
        isActive: true
      },
      {
        id: 'CSE-002',
        tenantId: 'DPW_JABO',
        title: 'Operasional Shelter Darurat & Pembinaan 50 Muallaf Urban Jabodetabek',
        kantongSyariah: 'ZAKAT',
        target: 120000000,
        current: 84500000,
        donorsCount: 890,
        isActive: true
      }
    ],

    // 16. Audit Logs Forensik (Sheet_AuditLogs)
    auditLogs: [
      {
        id: 'LOG-001',
        timestamp: '09-11-2026 08:30:15',
        userId: 'USR-001',
        wilayahId: 'DPP_PUSAT',
        action: 'SUPERADMIN_INITIALIZATION',
        entity: 'System',
        recordId: 'SYS-INIT',
        entityId: 'SYS-INIT',
        detailsJson: '{"version":"3.0.0 Enterprise","db":"initialized"}',
        ipAddress: '127.0.0.1'
      },
      {
        id: 'LOG-002',
        timestamp: '09-11-2026 09:30:44',
        userId: 'USR-002',
        wilayahId: 'DPP_PUSAT',
        action: 'APPROVE_SURAT',
        entity: 'Surat',
        recordId: 'SRT-001',
        entityId: 'SRT-001',
        detailsJson: '{"nomor":"005/SM-DPP-APII/XI/2026","signedBy":"Ust. H. Ahmad Fauzi"}',
        ipAddress: '127.0.0.1'
      }
    ],

    // 17. Master Parameter Yayasan & Template KOP / Naskah / TTD / Stempel (Sheet_Settings)
    settings: {
      ketuaUmum: 'Ust. H. Ahmad Fauzi, Lc., M.A.',
      sekretarisJenderal: 'Ust. M. Ridwan, S.Pd.I.',
      bendaharaUmum: 'H. Syamsuddin, S.E.',
      kopBaris1: 'YAYASAN APOLOGET ISLAM INDONESIA (APII)',
      kopBaris2: 'DEWAN PENGURUS PUSAT (DPP NASIONAL)',
      kopAlamat: 'Gedung Pusat Dakwah APII, Jl. Kramat Raya No. 45, Senen, Jakarta Pusat 10450',
      kopTelepon: '6281358575678',
      kopEmail: 'sekretariat@apologetislamindonesia.or.id',
      kopAhu: 'AHU-0014970.AH.01.04.Tahun 2023',
      plafonKasTunai: 2000000,
      activeSettingsScope: 'DPP_PUSAT',
      tenants: {
        DPP_PUSAT: {
          scope: 'DPP_PUSAT',
          scopeLabel: 'DPP Pusat (Nasional)',
          level: 'DPP',
          // Logo Layout
          logoUrl: './logo_apii.png',
          logoSecondaryUrl: './logo_apii.png',
          logoLayout: 'left', // 'left', 'center', 'dual', 'right'
          logoSize: 76, // px (60 - 105)
          // KOP Text & Style
          kopBaris1: 'YAYASAN APOLOGET ISLAM INDONESIA (APII)',
          kopBaris2: 'DEWAN PENGURUS PUSAT',
          kopBaris3: 'SK KEMENKUMHAM RI NO. AHU-0014970.AH.01.04.TAHUN 2023',
          kopAlamat: 'Gedung Pusat Dakwah APII, Jl. Kramat Raya No. 45, Senen, Jakarta Pusat 10450',
          kopTelepon: '+62 813-5857-5678',
          kopEmail: 'sekretariat@apologetislamindonesia.or.id',
          kopWebsite: 'https://apologetislamindonesia.or.id',
          kopDivider: 'double_black', // 'double_black', 'single_emerald', 'classic_gold', 'thick_simple'
          // Surat Layout & Tipografi
          fontFamily: 'times', // 'times', 'arial', 'calibri', 'amiri'
          fontSize: '12pt', // '11pt', '12pt'
          lineSpacing: '1.25', // '1.15', '1.25', '1.5'
          showBismillah: true,
          showHijriDate: true,
          kotaSurat: 'Jakarta',
          // Tanda Tangan & Pimpinan
          modelTtd: 'dual', // 'dual', 'single'
          ketuaNama: 'Ust. H. Ahmad Fauzi, Lc., M.A.',
          ketuaJabatan: 'Ketua Umum DPP',
          ketuaNia: 'APII-PUSAT-2026-00001',
          ketuaTtdMode: 'spesimen', // 'spesimen', 'upload'
          ketuaTtdUrl: '',
          ketuaTtdSize: 64, // px height
          sekretarisNama: 'Ust. M. Ridwan, S.Pd.I.',
          sekretarisJabatan: 'Sekretaris Umum DPP',
          sekretarisNia: 'APII-PUSAT-2026-00002',
          sekretarisTtdMode: 'spesimen',
          sekretarisTtdUrl: '',
          sekretarisTtdSize: 64,
          spesimenTtdType: 'digital_paraf', // 'digital_paraf', 'qr_tte', 'kombinasi'
          // Stempel Digital Basah
          stempelAktif: true,
          stempelMode: 'vektor', // 'vektor', 'upload'
          stempelUrl: '',
          stempelSize: 112, // px width & height
          stempelOpacity: 85, // %
          stempelTeksLuar: 'YAYASAN APOLOGET ISLAM INDONESIA',
          stempelTeksDalam: 'DEWAN PENGURUS PUSAT',
          stempelWarna: '#065f46', // Emerald
          stempelPosisi: 'overlap_left', // 'overlap_left', 'center', 'beside', 'custom'
          stempelOffsetX: -24, // px offset
          stempelOffsetY: 8,
          stempelRotasi: -12 // degrees
        },
        DPW_JABO: {
          scope: 'DPW_JABO',
          scopeLabel: 'DPW Jabodetabek (Pilot Wilayah)',
          level: 'DPW',
          // Logo Layout
          logoUrl: './logo_apii.png',
          logoSecondaryUrl: './logo_apii.png',
          logoLayout: 'left',
          logoSize: 76,
          // KOP Text & Style
          kopBaris1: 'YAYASAN APOLOGET ISLAM INDONESIA (APII)',
          kopBaris2: 'DEWAN PENGURUS WILAYAH JABODETABEK',
          kopBaris3: 'WILAYAH KERJA: DKI JAKARTA, BOGOR, DEPOK, TANGERANG, BEKASI',
          kopAlamat: 'Graha Dakwah DPW Jabodetabek, Jl. TB Simatupang No. 18, Jakarta Selatan 12560',
          kopTelepon: '+62 812-3456-7891',
          kopEmail: 'dpw.jabodetabek@apologetislamindonesia.or.id',
          kopWebsite: 'https://apologetislamindonesia.or.id/portal/?dpw=jabo',
          kopDivider: 'double_black',
          // Surat Layout & Tipografi
          fontFamily: 'times',
          fontSize: '12pt',
          lineSpacing: '1.25',
          showBismillah: true,
          showHijriDate: true,
          kotaSurat: 'Jakarta Selatan',
          // Tanda Tangan & Pimpinan
          modelTtd: 'dual',
          ketuaNama: 'Ust. Bambang Hidayat, M.Si.',
          ketuaJabatan: 'Ketua DPW Jabodetabek',
          ketuaNia: 'APII-JABO-2026-00001',
          ketuaTtdMode: 'spesimen',
          ketuaTtdUrl: '',
          ketuaTtdSize: 64,
          sekretarisNama: 'Ust. Irwan Setiawan',
          sekretarisJabatan: 'Sekretaris DPW Jabodetabek',
          sekretarisNia: 'APII-JABO-2026-00002',
          sekretarisTtdMode: 'spesimen',
          sekretarisTtdUrl: '',
          sekretarisTtdSize: 64,
          spesimenTtdType: 'digital_paraf',
          // Stempel Digital Basah
          stempelAktif: true,
          stempelMode: 'vektor',
          stempelUrl: '',
          stempelSize: 112,
          stempelOpacity: 85,
          stempelTeksLuar: 'YAYASAN APOLOGET ISLAM INDONESIA',
          stempelTeksDalam: 'DPW JABODETABEK',
          stempelWarna: '#1e3a8a', // Navy Blue Khas Wilayah
          stempelPosisi: 'overlap_left',
          stempelOffsetX: -24,
          stempelOffsetY: 8,
          stempelRotasi: -10
        }
      }
    },

    // 18. Audit Diff Pengaturan Yayasan (Sheet_Settings_Audit)
    settingsAudit: [
      {
        id: 'SET-AUD-001',
        key: 'PLAFON_KAS_TUNAI',
        oldValue: '1000000',
        newValue: '2000000',
        changedBy: 'Superadmin Nasional (admin)',
        timestamp: '09-11-2026 08:35:00'
      }
    ],

    // 19. Monitoring Sesi Multi-Device (Sheet_Sessions)
    sessions: [
      {
        token: 'SESSION-001',
        userId: 'USR-001',
        username: 'admin',
        fullName: 'Super Administrator Nasional',
        role: 'superadmin',
        tenantId: 'DPP_PUSAT',
        wilayahId: 'DPP_PUSAT',
        divisi: null,
        device: 'Desktop Chrome / Windows 11',
        ipAddress: '127.0.0.1',
        loginAt: '11-11-2026 08:00:00',
        expiresAt: '18-11-2026 08:00:00',
        isCurrent: false
      },
      {
        token: 'SESSION-002',
        userId: 'USR-002',
        username: 'ketua',
        fullName: 'Ust. H. Ahmad Fauzi, Lc., M.A.',
        role: 'ketua',
        tenantId: 'DPP_PUSAT',
        wilayahId: 'DPP_PUSAT',
        divisi: null,
        device: 'Mobile Safari / iOS 18 (Ponsel Ketum)',
        ipAddress: '180.252.12.44',
        loginAt: '11-11-2026 09:15:20',
        expiresAt: '18-11-2026 09:15:20',
        isCurrent: false
      },
      {
        token: 'SESSION-003',
        userId: 'USR-003',
        username: 'sekretaris',
        fullName: 'Ust. M. Ridwan, S.Pd.I.',
        role: 'sekretaris',
        tenantId: 'DPP_PUSAT',
        wilayahId: 'DPP_PUSAT',
        divisi: null,
        device: 'Laptop Workstation / Windows 11',
        ipAddress: '127.0.0.1',
        loginAt: '11-11-2026 08:30:11',
        expiresAt: '18-11-2026 08:30:11',
        isCurrent: false
      }
    ],

    // 20. Master Wilayah Federasi (Sheet_Wilayah)
    wilayah: [
      {
        code: 'DPP_PUSAT',
        name: 'DPP Pusat (Nasional)',
        slug: 'pusat',
        level: 'DPP',
        phone: '6281358575678',
        city: 'Jakarta Pusat',
        address: 'Gedung Pusat Dakwah APII, Jl. Kramat Raya No. 45, Senen, Jakarta Pusat 10450',
        lat: -6.1856,
        lng: 106.8456,
        zoom: 14,
        isActive: true
      },
      {
        code: 'DPW_JABO',
        name: 'DPW Jabodetabek',
        slug: 'jabodetabek',
        level: 'DPW',
        phone: '6281234567891',
        city: 'Jakarta Selatan',
        address: 'Graha Dakwah DPW Jabodetabek, Jl. TB Simatupang No. 18, Jakarta Selatan 12560',
        lat: -6.2905,
        lng: 106.7949,
        zoom: 13,
        isActive: true
      }
    ]
  };

  function init() {
    loadDatabase();
  }

  function parseDate(str) {
    if (!str) return new Date();
    if (str instanceof Date) return str;
    const s = String(str).trim();
    const m = s.match(/^(\d{2})-(\d{2})-(\d{4})(.*)$/);
    if (m) {
      return new Date(`${m[3]}-${m[2]}-${m[1]}${m[4] ? m[4].replace(' ', 'T') : 'T00:00:00'}`);
    }
    return new Date(s);
  }

  function formatTanggal(d = new Date()) {
    const date = (d instanceof Date) ? d : parseDate(d);
    if (isNaN(date.getTime())) return String(d);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  function formatWaktu(d = new Date()) {
    const date = (d instanceof Date) ? d : parseDate(d);
    if (isNaN(date.getTime())) return String(d);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    const secs = String(date.getSeconds()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${mins}:${secs}`;
  }

  function getRomanMonth(d = new Date()) {
    const date = (d instanceof Date) ? d : parseDate(d);
    const m = isNaN(date.getTime()) ? (new Date().getMonth() + 1) : (date.getMonth() + 1);
    const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return roman[(m - 1) % 12] || 'XI';
  }

  function generateNextNomorSurat(kodeTipe = 'SM', tenantId = 'DPP_PUSAT', d = new Date()) {
    const database = getDb();
    const date = (d instanceof Date) ? d : parseDate(d);
    const year = isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
    const romanMonth = getRomanMonth(date);

    const tenantCode = (tenantId === 'DPP_PUSAT' || !tenantId) ? 'DPP-APII' : tenantId.replace('_', '-');
    
    // Normalisasi kode tipe surat resmi
    let tipeCode = kodeTipe.toUpperCase();
    if (tipeCode === 'SURAT_MANDAT') tipeCode = 'SM';
    else if (tipeCode === 'SK_KEPENGURUSAN') tipeCode = 'SK';
    else if (tipeCode === 'SURAT_UNDANGAN') tipeCode = 'UND';
    else if (tipeCode === 'SURAT_EDARAN') tipeCode = 'SE';
    else if (tipeCode === 'SURAT_TUGAS') tipeCode = 'ST';
    else if (tipeCode === 'SURAT_REKOMENDASI') tipeCode = 'SR';

    let maxSeq = 0;
    const suratList = database.surat || [];
    suratList.forEach(s => {
      if (!s.nomorSurat) return;
      // Format resmi: [NOMOR_URUT]/[KODE_SURAT]-[KODE_TENANT]/[BULAN_ROMAWI]/[TAHUN]
      const parts = s.nomorSurat.split('/');
      if (parts.length >= 4) {
        const seqStr = parts[0];
        const middlePart = parts[1];
        const yearPart = parts[3];
        if (yearPart == year && middlePart.endsWith(tenantCode)) {
          const num = parseInt(seqStr, 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    });

    const nextSeq = maxSeq + 1;
    const padSeq = String(nextSeq).padStart(3, '0');
    return `${padSeq}/${tipeCode}-${tenantCode}/${romanMonth}/${year}`;
  }

  function generateNextNomorAgenda(tenantId = 'DPP_PUSAT', d = new Date()) {
    const database = getDb();
    const date = (d instanceof Date) ? d : parseDate(d);
    const year = isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
    const romanMonth = getRomanMonth(date);

    let maxSeq = 0;
    const smList = database.suratMasuk || [];
    smList.forEach(sm => {
      if (!sm.noAgenda) return;
      // Format resmi buku agenda: AGD/2026/XI/018 atau AGD-2026-0001
      const matchSlash = sm.noAgenda.match(/AGD\/\d{4}\/[A-Z]+\/(\d+)/i);
      const matchDash = sm.noAgenda.match(/AGD-\d{4}-(\d+)/i);
      let num = null;
      if (matchSlash) num = parseInt(matchSlash[1], 10);
      else if (matchDash) num = parseInt(matchDash[1], 10);
      if (num !== null && !isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    });

    const nextSeq = maxSeq + 1;
    const padSeq = String(nextSeq).padStart(3, '0');
    return `AGD/${year}/${romanMonth}/${padSeq}`;
  }

  function generateNextNia(tenantId = 'DPP_PUSAT', d = new Date()) {
    const database = getDb();
    const date = (d instanceof Date) ? d : parseDate(d);
    const year = isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();

    const wilCode = (!tenantId || tenantId === 'DPP_PUSAT')
      ? 'PUSAT'
      : String(tenantId).toUpperCase().replace(/^DPW[_-]/i, '').replace(/^DPP[_-]/i, '').replace(/[^A-Z0-9]/g, '') || 'PUSAT';

    let maxSeq = 0;
    (database.anggota || []).forEach(a => {
      if (!a.nia) return;
      const m = String(a.nia).match(/^APII-[A-Z0-9]+-(\d{4})-(\d+)$/i);
      if (m && Number(m[1]) === year) {
        const num = parseInt(m[2], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(5, '0');
    return `APII-${wilCode}-${year}-${nextSeq}`;
  }

  function getWilayahList(activeOnly = false) {
    const database = getDb();
    const list = Array.isArray(database.wilayah) ? database.wilayah : INITIAL_DB.wilayah;
    return activeOnly ? list.filter(w => w.isActive !== false) : list.slice();
  }

  function normalizeDatesInObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => normalizeDatesInObject(item));
    }
    const res = {};
    for (const k in obj) {
      const v = obj[k];
      if (typeof v === 'string') {
        res[k] = v.replace(/\b(20\d{2})-(\d{2})-(\d{2})\b/g, (m, y, mo, d) => `${d}-${mo}-${y}`);
      } else if (typeof v === 'object' && v !== null) {
        res[k] = normalizeDatesInObject(v);
      } else {
        res[k] = v;
      }
    }
    return res;
  }

  function loadDatabase() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        db = normalizeDatesInObject(JSON.parse(raw));
        if (!db.settings) db.settings = JSON.parse(JSON.stringify(INITIAL_DB.settings));
        if (!db.settingsAudit) db.settingsAudit = JSON.parse(JSON.stringify(INITIAL_DB.settingsAudit));
        if (!db.sessions) db.sessions = JSON.parse(JSON.stringify(INITIAL_DB.sessions));
        if (!db.wilayah) db.wilayah = JSON.parse(JSON.stringify(INITIAL_DB.wilayah));
        if (!db.causes) db.causes = JSON.parse(JSON.stringify(INITIAL_DB.causes));
        if (!db.driveQuota) db.driveQuota = JSON.parse(JSON.stringify(INITIAL_DB.driveQuota));
        if (Array.isArray(db.surat)) {
          db.surat.forEach(s => {
            if (s.catatanRevisi === undefined) s.catatanRevisi = '';
          });
        }
        if (Array.isArray(db.suratMasuk)) {
          db.suratMasuk.forEach(sm => {
            if (!sm.laporanPerDivisi || typeof sm.laporanPerDivisi !== 'object') sm.laporanPerDivisi = {};
          });
        }
        if (Array.isArray(db.anggota)) {
          db.anggota.forEach(a => {
            if (!a.fotoUrl || String(a.fotoUrl).includes('images.unsplash.com')) {
              a.fotoUrl = createMonogramAvatar(a.namaLengkap, 'anggota_divisi');
            }
          });
        }
        if (Array.isArray(db.auditLogs)) {
          db.auditLogs.forEach(l => {
            if (!l.entityId) l.entityId = l.recordId || '-';
          });
        }
      } else {
        db = JSON.parse(JSON.stringify(INITIAL_DB));
        saveDatabase();
      }
    } catch (e) {
      console.warn('Gagal memuat basis data bersama, menggunakan initial seeding:', e);
      db = JSON.parse(JSON.stringify(INITIAL_DB));
    }
  }

  function saveDatabase() {
    if (!db) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      console.error('Gagal menyimpan basis data bersama ke LocalStorage:', e);
    }
  }

  function getDb() {
    if (!db) loadDatabase();
    return db;
  }

  function getSettings(scope) {
    const database = getDb();
    if (!database.settings) database.settings = JSON.parse(JSON.stringify(INITIAL_DB.settings));
    if (!database.settings.tenants) {
      database.settings.tenants = JSON.parse(JSON.stringify(INITIAL_DB.settings.tenants || {}));
    }
    const activeScope = scope || database.settings.activeSettingsScope || 'DPP_PUSAT';
    const tenantCfg = database.settings.tenants[activeScope] || database.settings.tenants['DPP_PUSAT'] || {};
    
    // Return combined object with top-level backward-compat properties + tenant configuration
    return Object.assign({}, database.settings, tenantCfg, {
      currentScope: activeScope,
      tenants: database.settings.tenants
    });
  }

  function getTenantSettings(scope) {
    return getSettings(scope);
  }

  function getSettingsAudit() {
    const database = getDb();
    return database.settingsAudit || INITIAL_DB.settingsAudit || [];
  }

  function updateSettings(newSettings, changedBy = 'Superadmin Nasional', targetScope = null) {
    const database = getDb();
    if (!database.settings) database.settings = JSON.parse(JSON.stringify(INITIAL_DB.settings));
    if (!database.settings.tenants) {
      database.settings.tenants = JSON.parse(JSON.stringify(INITIAL_DB.settings.tenants || {}));
    }

    const scope = targetScope || newSettings.scope || database.settings.activeSettingsScope || 'DPP_PUSAT';
    if (!database.settings.tenants[scope]) {
      // Clone from DPP_PUSAT as fallback base
      database.settings.tenants[scope] = JSON.parse(JSON.stringify(database.settings.tenants.DPP_PUSAT || {}));
      database.settings.tenants[scope].scope = scope;
    }

    const oldTenant = database.settings.tenants[scope];
    const diffs = [];

    // Track diffs and update
    for (const key in newSettings) {
      if (key === 'tenants' || key === 'diffs') continue;
      const oldVal = String(oldTenant[key] !== undefined ? oldTenant[key] : (database.settings[key] || ''));
      const newVal = String(newSettings[key] !== undefined ? newSettings[key] : '');
      if (oldVal !== newVal) {
        const auditEntry = {
          id: 'SET-AUD-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
          key: (scope !== 'DPP_PUSAT' ? `${scope}_` : '') + key.toUpperCase(),
          oldValue: oldVal,
          newValue: newVal,
          changedBy: changedBy,
          timestamp: formatWaktu(new Date())
        };
        database.settingsAudit.unshift(auditEntry);
        diffs.push(auditEntry);
      }
      oldTenant[key] = newSettings[key];
      // Keep root synced if it's a root property or if updating DPP
      if (database.settings[key] !== undefined || scope === 'DPP_PUSAT') {
        database.settings[key] = newSettings[key];
      }
    }

    if (newSettings.activeSettingsScope) {
      database.settings.activeSettingsScope = newSettings.activeSettingsScope;
    }

    // Live sync ke CONFIG jika plafon kas berubah
    if (database.settings.plafonKasTunai && window.CONFIG) {
      window.CONFIG.CASH_BUFFER_LIMIT = Number(database.settings.plafonKasTunai);
    }

    saveDatabase();
    logAudit('UPDATE_SETTINGS', 'Settings', `SETTINGS_${scope}`, { changedKeys: diffs.map(d => d.key), scope });
    return { ok: true, diffs: diffs, settings: database.settings, tenantSettings: oldTenant };
  }

  function getSessions() {
    const database = getDb();
    return database.sessions || [];
  }

  function revokeSession(token) {
    const database = getDb();
    const idx = (database.sessions || []).findIndex(s => s.token === token);
    if (idx === -1) return false;
    const rev = database.sessions.splice(idx, 1)[0];
    saveDatabase();
    logAudit('REVOKE_SESSION', 'Session', token, { username: rev.username, device: rev.device });
    return true;
  }

  function getDeadlockQueue() {
    const database = getDb();
    const queue = [];

    // 1. Surat keluar yang menunggu tanda tangan (AJUKAN)
    (database.surat || []).forEach(s => {
      if (s.status === 'AJUKAN' || s.statusSignature === 'PENDING_KETUA') {
        queue.push({
          type: 'surat',
          typeLabel: 'Surat Dinas Keluar',
          id: s.id,
          nomor: s.nomorSurat,
          perihal: s.perihal,
          pemohon: s.createdBy,
          wilayah: s.tenantId,
          tanggal: s.tanggalMasehi,
          stuckReason: 'Menunggu tanda tangan & stempel Ketua'
        });
      }
    });

    // 2. Kas keluar yang menunggu approval (DRAFT / VERIFIKASI_BENDAHARA / VERIFIED_BENDAHARA)
    (database.kas?.transactions || []).forEach(t => {
      if (t.tipe === 'KELUAR' && (t.statusApproval === 'DRAFT' || t.statusApproval === 'VERIFIKASI_BENDAHARA' || t.statusApproval === 'VERIFIED_BENDAHARA')) {
        queue.push({
          type: 'kas',
          typeLabel: 'Pengeluaran Kas (BKK)',
          id: t.id,
          nomor: t.noVoucher,
          perihal: t.keterangan + ' (Rp ' + Number(t.nominal).toLocaleString('id-ID') + ')',
          pemohon: t.pihakTerkait,
          wilayah: t.tenantId,
          tanggal: t.tanggal,
          stuckReason: t.statusApproval === 'DRAFT' ? 'Menunggu verifikasi nota Bendahara (Tahap 1)' : 'Menunggu otorisasi pencairan Ketua (Tahap 2)'
        });
      }
    });

    // 3. Surat masuk yang belum disahkan disposisinya
    (database.suratMasuk || []).forEach(sm => {
      if (sm.statusDisposisi === 'PENDING_KETUA') {
        queue.push({
          type: 'disposisi',
          typeLabel: 'Disposisi Surat Masuk',
          id: sm.id,
          nomor: sm.noAgenda,
          perihal: sm.perihal + ' (Dari: ' + sm.asalSurat + ')',
          pemohon: 'Sekretariat APII',
          wilayah: sm.tenantId,
          tanggal: sm.tglTerima,
          stuckReason: 'Draf rekomendasi disposisi menanti instruksi resmi Ketua'
        });
      }
    });

    // 4. Pendaftar KTA yang menunggu pengesahan
    (database.anggota || []).forEach(a => {
      if (a.status === 'MENUNGGU_VERIFIKASI' || a.status === 'VERIFIED_SEKRETARIS') {
        queue.push({
          type: 'kta',
          typeLabel: 'Pengesahan KTA Anggota',
          id: a.id,
          nomor: a.nik,
          perihal: a.namaLengkap + ' (' + a.keahlian + ')',
          pemohon: a.namaLengkap,
          wilayah: a.wilayah || a.tenantId,
          tanggal: a.tglTerbit || formatTanggal(),
          stuckReason: a.status === 'MENUNGGU_VERIFIKASI' ? 'Menunggu verifikasi berkas KTP Sekretaris' : 'Menunggu pengesahan KTA 5 tahun Ketua'
        });
      }
    });

    return queue;
  }

  function executeDeadlockOverride(docType, docId, reason, docRef, superadminUser) {
    const database = getDb();
    const actor = superadminUser || ((window.Auth && Auth.getCurrentUser && Auth.getCurrentUser()) || { fullName: 'Superadmin Nasional', username: 'admin', tenantId: 'DPP_PUSAT' });
    let resolvedItem = null;

    if (docType === 'surat') {
      const surat = database.surat.find(s => s.id === docId);
      if (surat) {
        surat.status = 'APPROVED';
        surat.statusSignature = 'APPROVED';
        surat.signedBy = actor.fullName + ' [SUPERADMIN DEADLOCK OVERRIDE]';
        surat.signedAt = formatWaktu();
        surat.catatanDeadlock = reason;
        resolvedItem = { nomor: surat.nomorSurat, perihal: surat.perihal };
      }
    } else if (docType === 'kas') {
      const trx = database.kas.transactions.find(t => t.id === docId);
      if (trx) {
        trx.statusApproval = 'APPROVED';
        trx.approvedKetuaBy = actor.fullName + ' [SUPERADMIN DEADLOCK OVERRIDE]';
        trx.verifiedBendaharaBy = trx.verifiedBendaharaBy || actor.fullName;
        trx.noKwitansi = 'KWT-' + trx.noVoucher;
        trx.catatanDeadlock = reason;
        const balances = database.kas.balances[trx.tenantId] || database.kas.balances['DPP_PUSAT'];
        if (balances && balances[trx.kantongSyariah] !== undefined) {
          balances[trx.kantongSyariah] = Math.max(0, Number(balances[trx.kantongSyariah]) - Number(trx.nominal));
        }
        resolvedItem = { nomor: trx.noVoucher, perihal: trx.keterangan };
      }
    } else if (docType === 'disposisi') {
      const sm = database.suratMasuk.find(x => x.id === docId);
      if (sm) {
        sm.statusDisposisi = 'DISAHKAN_KETUA';
        sm.instruksiKetua = 'Instruksi Pengesahan Darurat Superadmin: ' + reason;
        sm.parafKetua = 'PARAF_SUPERADMIN_DEADLOCK';
        sm.batasWaktu = formatTanggal(new Date(Date.now() + 7 * 86400000));
        resolvedItem = { nomor: sm.noAgenda, perihal: sm.perihal };
      }
    } else if (docType === 'kta') {
      const anggota = database.anggota.find(a => a.id === docId);
      if (anggota) {
        anggota.status = 'APPROVED';
        anggota.approvedKetuaAt = formatWaktu();
        anggota.verifiedSekretarisAt = anggota.verifiedSekretarisAt || formatWaktu();
        if (!anggota.nia || anggota.nia === 'MENUNGGU_PENGESAHAN') {
          anggota.nia = generateNextNia(anggota.tenantId || anggota.wilayah || 'DPP_PUSAT');
        }
        resolvedItem = { nomor: anggota.nia, perihal: anggota.namaLengkap };
      }
    }

    if (!resolvedItem) return { ok: false, error: 'Dokumen target tidak ditemukan di basis data.' };

    saveDatabase();
    logAudit('SUPERADMIN_OVERRIDE', docType.toUpperCase(), docId, {
      reason: reason,
      risalahRef: docRef || 'MUSYAWARAH_DARURAT_BPH',
      resolvedItem: resolvedItem,
      overrideBy: actor.username,
      actorName: actor.fullName
    });

    return { ok: true, resolvedItem: resolvedItem };
  }

  function registerWilayah(wilayahData) {
    const database = getDb();
    const existing = (database.wilayah || []).find(w => w.code === wilayahData.code);
    if (existing) return { ok: false, error: 'Kode wilayah sudah terdaftar!' };

    const newW = {
      code: wilayahData.code,
      name: wilayahData.name,
      slug: wilayahData.slug || wilayahData.code.toLowerCase().replace('dpw_', ''),
      level: 'DPW',
      phone: wilayahData.phone || '6281234567899',
      city: wilayahData.city || 'Ibukota Provinsi',
      address: wilayahData.address || 'Sekretariat DPW APII',
      isActive: true
    };

    if (!database.wilayah) database.wilayah = [];
    database.wilayah.push(newW);

    if (window.CONFIG && Array.isArray(window.CONFIG.TENANTS)) {
      if (!window.CONFIG.TENANTS.find(t => t.code === newW.code)) {
        window.CONFIG.TENANTS.push(newW);
      }
    }

    if (database.kas && database.kas.balances && !database.kas.balances[newW.code]) {
      database.kas.balances[newW.code] = {
        ZAKAT: 0,
        INFAQ_DAKWAH: 0,
        WAKAF: 0,
        AMIL_OPERASIONAL: 0
      };
    }

    // Auto-seed template KOP & layout settings for the new DPW
    if (!database.settings) database.settings = JSON.parse(JSON.stringify(INITIAL_DB.settings));
    if (!database.settings.tenants) database.settings.tenants = {};
    if (!database.settings.tenants[newW.code]) {
      database.settings.tenants[newW.code] = {
        scope: newW.code,
        scopeLabel: newW.name,
        level: 'DPW',
        logoUrl: './logo_apii.png',
        logoSecondaryUrl: './logo_apii.png',
        logoLayout: 'left',
        logoSize: 76,
        kopBaris1: 'YAYASAN APOLOGET ISLAM INDONESIA (APII)',
        kopBaris2: `DEWAN PENGURUS WILAYAH (${newW.name.toUpperCase()})`,
        kopBaris3: `SEKRETARIAT WILAYAH KOTA ${newW.city.toUpperCase()}`,
        kopAlamat: newW.address || `Sekretariat DPW APII, ${newW.city}`,
        kopTelepon: newW.phone || '+62 812-3456-7899',
        kopEmail: `dpw.${newW.slug}@apologetislamindonesia.or.id`,
        kopWebsite: `https://apologetislamindonesia.or.id/portal/?dpw=${newW.slug}`,
        kopDivider: 'double_black',
        fontFamily: 'times',
        fontSize: '12pt',
        lineSpacing: '1.25',
        showBismillah: true,
        showHijriDate: true,
        kotaSurat: newW.city,
        modelTtd: 'dual',
        ketuaNama: `Ketua ${newW.name}`,
        ketuaJabatan: `Ketua ${newW.name}`,
        ketuaNia: `APII-${newW.code.replace('DPW_', '')}-2026-00001`,
        ketuaTtdMode: 'spesimen',
        ketuaTtdUrl: '',
        ketuaTtdSize: 64,
        sekretarisNama: `Sekretaris ${newW.name}`,
        sekretarisJabatan: `Sekretaris ${newW.name}`,
        sekretarisNia: `APII-${newW.code.replace('DPW_', '')}-2026-00002`,
        sekretarisTtdMode: 'spesimen',
        sekretarisTtdUrl: '',
        sekretarisTtdSize: 64,
        spesimenTtdType: 'digital_paraf',
        stempelAktif: true,
        stempelMode: 'vektor',
        stempelUrl: '',
        stempelSize: 112,
        stempelOpacity: 85,
        stempelTeksLuar: 'YAYASAN APOLOGET ISLAM INDONESIA',
        stempelTeksDalam: newW.name.toUpperCase(),
        stempelWarna: '#1e3a8a',
        stempelPosisi: 'overlap_left',
        stempelOffsetX: -24,
        stempelOffsetY: 8,
        stempelRotasi: -10
      };
    }

    saveDatabase();
    logAudit('REGISTER_DPW', 'Wilayah', newW.code, { name: newW.name, slug: newW.slug });
    return { ok: true, wilayah: newW };
  }

  // Helper Auto-Hijri Engine Kemenag RI [PRD 4.8.15]
  function getHijriDate(dateStr) {
    let d = dateStr ? parseDate(dateStr) : new Date();
    if (isNaN(d.getTime())) d = new Date();

    const monthAliases = {
      muharram: 'Muharram',
      safar: 'Safar',
      rabiulawal: 'Rabiul Awwal',
      'rabiul awwal': 'Rabiul Awwal',
      rabiulakhir: 'Rabiul Akhir',
      'rabiul akhir': 'Rabiul Akhir',
      jumadilawal: 'Jumadil Awal',
      'jumadil awal': 'Jumadil Awal',
      'jumadil ula': 'Jumadil Awal',
      jumadilakhir: 'Jumadil Akhir',
      'jumadil akhir': 'Jumadil Akhir',
      rajab: 'Rajab',
      syakban: 'Sya\'ban',
      'sya\'ban': 'Sya\'ban',
      ramadan: 'Ramadhan',
      ramadhan: 'Ramadhan',
      syawal: 'Syawwal',
      syawwal: 'Syawwal',
      zulkaidah: 'Dzulqa\'dah',
      dzulqadah: 'Dzulqa\'dah',
      'dzulqa\'dah': 'Dzulqa\'dah',
      zulhijah: 'Dzulhijjah',
      dzulhijjah: 'Dzulhijjah'
    };

    try {
      if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
        const fmt = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        const parts = fmt.formatToParts(d);
        const dayVal = parseInt((parts.find(p => p.type === 'day') || {}).value, 10);
        const rawMonth = String((parts.find(p => p.type === 'month') || {}).value || '').trim();
        const yearVal = parseInt((parts.find(p => p.type === 'year') || {}).value, 10);

        if (dayVal >= 1 && dayVal <= 30 && yearVal >= 1300 && yearVal <= 1700) {
          let monthName = monthAliases[rawMonth.toLowerCase()];
          if (!monthName) {
            const numFmt = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', { month: 'numeric' });
            const numParts = numFmt.formatToParts(d);
            const mNum = parseInt((numParts.find(p => p.type === 'month') || {}).value, 10);
            if (mNum >= 1 && mNum <= 12) {
              monthName = HIJRI_MONTHS_ID[mNum - 1];
            } else {
              monthName = rawMonth;
            }
          }
          return `${dayVal} ${monthName} ${yearVal} H`;
        }
      }
    } catch (e) {}

    // Arithmetic fallback matching HijriEngine.gs (Kuwaiti / tabular Ummul Qura approximation)
    let year = d.getFullYear();
    let month = d.getMonth() + 1;
    const day = d.getDate();
    if (month < 3) {
      year -= 1;
      month += 12;
    }
    const a = Math.floor(year / 100);
    const b = 2 - a + Math.floor(a / 4);
    const jd = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;
    const z = Math.floor(jd + 0.5);
    const cyc = Math.floor((z - 1948440 + 1.06) / 10631);
    const rem = (z - 1948440 + 1.06) - 10631 * cyc;
    const j = Math.floor((rem + 0.05) / 354.366);
    const hYear = 30 * cyc + j + 1;
    const remDays = rem - Math.floor(j * 354.366);
    let hMonth = Math.min(11, Math.floor((remDays + 0.5) / 29.5));
    let hDay = Math.floor(remDays - Math.floor(hMonth * 29.5) + 1);
    if (hDay <= 0) {
      hDay = 29;
      hMonth = (hMonth + 11) % 12;
    }
    return `${hDay} ${HIJRI_MONTHS_ID[hMonth]} ${hYear} H`;
  }

  // Audit Logger
  function logAudit(action, entity, recordId, details = {}) {
    const database = getDb();
    const user = ((window.Auth && typeof Auth.getCurrentUser === 'function') ? Auth.getCurrentUser() : null) || { id: 'SYSTEM', tenantId: 'DPP_PUSAT' };
    const now = new Date();
    const nowStr = formatWaktu(now);

    const logEntry = {
      id: 'LOG-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      timestamp: nowStr,
      userId: user.id || 'ANONYMOUS',
      wilayahId: user.tenantId || 'DPP_PUSAT',
      action: action,
      entity: entity,
      recordId: recordId,
      entityId: recordId,
      detailsJson: JSON.stringify(details),
      ipAddress: '127.0.0.1'
    };

    database.auditLogs.unshift(logEntry);
    saveDatabase();
    return logEntry;
  }

  return {
    init,
    getDb,
    saveDatabase,
    getHijriDate,
    computeSha256,
    hashConsultToken,
    validateShariaExpense,
    maskNik,
    createMonogramAvatar,
    logAudit,
    formatTanggal,
    formatWaktu,
    parseDate,
    getRomanMonth,
    generateNextNomorSurat,
    generateNextNomorAgenda,
    generateNextNia,
    getWilayahList,
    getSettings,
    getTenantSettings,
    getSettingsAudit,
    updateSettings,
    getSessions,
    revokeSession,
    getDeadlockQueue,
    executeDeadlockOverride,
    registerWilayah
  };
})();

if (typeof window !== 'undefined') {
  window.State = State;
}

// Auto-run pada startup
State.init();
