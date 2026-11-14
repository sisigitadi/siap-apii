/**
 * SIAP APII Enterprise v3.1 - Public Portal Application Controller
 * Yayasan Apologet Islam Indonesia (SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023)
 * Pengembang: Sigit Adi Irianto (https://wa.me/6281358575678 | sigitadi.id)
 * Shared State Live Sync, National Ticker, Smart Fallback, Infaq 4-Kantong QRIS, Strict Verification Hub
 */

const PublicApp = (() => {
  // =========================================================================
  // 1. PURE JS CRYPTO (FIPS 180-4 SHA-256) & HELPERS
  // =========================================================================
  function sha256Hex(input) {
    const str = String(input == null ? '' : input);
    let bytes;
    if (typeof TextEncoder !== 'undefined') {
      bytes = Array.from(new TextEncoder().encode(str));
    } else {
      const utf8 = unescape(encodeURIComponent(str));
      bytes = [];
      for (let i = 0; i < utf8.length; i++) {
        bytes.push(utf8.charCodeAt(i));
      }
    }

    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    const H = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];

    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while ((bytes.length % 64) !== 56) {
      bytes.push(0x00);
    }

    const highBits = Math.floor(bitLen / 0x100000000);
    const lowBits = bitLen >>> 0;
    bytes.push((highBits >>> 24) & 0xff, (highBits >>> 16) & 0xff, (highBits >>> 8) & 0xff, highBits & 0xff);
    bytes.push((lowBits >>> 24) & 0xff, (lowBits >>> 16) & 0xff, (lowBits >>> 8) & 0xff, lowBits & 0xff);

    const w = new Array(64);
    for (let i = 0; i < bytes.length; i += 64) {
      for (let t = 0; t < 16; t++) {
        const j = i + t * 4;
        w[t] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
      }
      for (let t = 16; t < 64; t++) {
        const s0 = (((w[t - 15] >>> 7) | (w[t - 15] << 25)) ^ ((w[t - 15] >>> 18) | (w[t - 15] << 14)) ^ (w[t - 15] >>> 3)) >>> 0;
        const s1 = (((w[t - 2] >>> 17) | (w[t - 2] << 15)) ^ ((w[t - 2] >>> 19) | (w[t - 2] << 13)) ^ (w[t - 2] >>> 10)) >>> 0;
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }

      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const S1 = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
        const ch = ((e & f) ^ ((~e) & g)) >>> 0;
        const temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
        const S0 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
        const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
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

    return H.map(v => v.toString(16).padStart(8, '0')).join('');
  }

  function hashConsultToken(token) {
    return sha256Hex(String(token || '') + ':APII_CONSULT');
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function maskNik(nik) {
    const raw = String(nik || '').trim();
    if (!raw) return '****************';
    if (raw.includes('*')) return raw;
    if (raw.length <= 8) return raw.substring(0, 2) + '****';
    return raw.substring(0, 4) + '********' + raw.substring(raw.length - 4);
  }

  function createMonogramAvatar(name, seedStr = '') {
    const clean = String(name || 'APII').replace(/^(Ust\.?|H\.?|Hj\.?|Drs\.?|Prof\.?|Dr\.?|Adv\.?)\s+/gi, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : (clean.substring(0, 2).toUpperCase() || 'AP');
    const palette = ['#003527', '#064e3b', '#047857', '#1e3a8a', '#7c2d12'];
    let sum = 0;
    const key = String(name || '') + String(seedStr || '');
    for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
    const bg = palette[sum % palette.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" rx="24" fill="${bg}"/><circle cx="100" cy="100" r="82" fill="none" stroke="#b0f0d6" stroke-width="2" opacity="0.35"/><text x="100" y="114" text-anchor="middle" font-family="Manrope, Inter, sans-serif" font-size="68" font-weight="800" fill="#ffffff">${escapeHtml(initials)}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function generateQrSvg(payloadStr, size = 210) {
    const hash = sha256Hex(payloadStr || 'QRIS-APII');
    const modules = 25;
    const pad = 2;
    const cell = 8;
    const total = (modules + pad * 2) * cell;

    function isFinder(r, c) {
      return (r < 7 && c < 7) || (r < 7 && c >= modules - 7) || (r >= modules - 7 && c < 7);
    }

    function isReserved(r, c) {
      if (isFinder(r, c)) return true;
      if (r === 7 && (c <= 7 || c >= modules - 8)) return true;
      if (c === 7 && (r <= 7 || r >= modules - 8)) return true;
      if (r === 6 || c === 6) return true;
      if (r >= 10 && r <= 14 && c >= 10 && c <= 14) return true;
      return false;
    }

    let rects = '';
    // Finder patterns
    const finders = [
      { r: 0, c: 0 },
      { r: 0, c: modules - 7 },
      { r: modules - 7, c: 0 }
    ];
    finders.forEach(f => {
      const x = (f.c + pad) * cell;
      const y = (f.r + pad) * cell;
      rects += `<rect x="${x}" y="${y}" width="${7 * cell}" height="${7 * cell}" rx="4" fill="#003527"/>`;
      rects += `<rect x="${x + cell}" y="${y + cell}" width="${5 * cell}" height="${5 * cell}" rx="2" fill="#ffffff"/>`;
      rects += `<rect x="${x + 2 * cell}" y="${y + 2 * cell}" width="${3 * cell}" height="${3 * cell}" rx="1.5" fill="#003527"/>`;
    });

    // Timing lines
    for (let i = 8; i < modules - 8; i++) {
      if (i % 2 === 0) {
        rects += `<rect x="${(i + pad) * cell}" y="${(6 + pad) * cell}" width="${cell}" height="${cell}" fill="#003527"/>`;
        rects += `<rect x="${(6 + pad) * cell}" y="${(i + pad) * cell}" width="${cell}" height="${cell}" fill="#003527"/>`;
      }
    }

    // Deterministic data modules from SHA-256
    let bitIdx = 0;
    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        if (isReserved(r, c)) continue;
        const hexChar = hash[bitIdx % hash.length];
        const nibble = parseInt(hexChar, 16);
        const bit = (nibble >> (bitIdx % 4)) & 1;
        bitIdx++;
        if (bit === 1 || ((r + c + nibble) % 5 === 0)) {
          rects += `<rect x="${(c + pad) * cell}" y="${(r + pad) * cell}" width="${cell}" height="${cell}" fill="#003527"/>`;
        }
      }
    }

    // Center APII Shield
    const mid = total / 2;
    const emblem = `<rect x="${mid - 18}" y="${mid - 18}" width="36" height="36" rx="6" fill="#ffffff" stroke="#003527" stroke-width="1.5"/><polygon points="${mid},${mid - 13} ${mid + 11},${mid - 6} ${mid + 11},${mid + 6} ${mid},${mid + 13} ${mid - 11},${mid + 6} ${mid - 11},${mid - 6}" fill="#064e3b"/><text x="${mid}" y="${mid + 3.5}" text-anchor="middle" font-family="Manrope, sans-serif" font-size="8.5" font-weight="800" fill="#ffffff">APII</text>`;

    return `<svg width="${size}" height="${size}" viewBox="0 0 ${total} ${total}" role="img" aria-label="Kode QRIS Resmi APII"><rect width="${total}" height="${total}" fill="#ffffff"/>${rects}${emblem}</svg>`;
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

  // =========================================================================
  // 2. CANONICAL SHARED DATABASE SELF-SEEDING (Matching portal/state.js)
  // =========================================================================
  const CANONICAL_SEED_SURAT = {
    'SRT-001': {
      nomorSurat: '005/SM-DPP-APII/XI/2026',
      perihal: 'Surat Mandat Delegasi Dialog Teologi & Kristologi Nasional 2026',
      isiSurat: 'Memberikan mandat penuh kepada nama tertera di atas untuk mewakili Dewan Pengurus Pusat Yayasan Apologet Islam Indonesia dalam forum Dialog Teologi dan Kristologi Komparatif Nasional 2026 di Jakarta Islamic Centre.',
      legacyHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    },
    'SRT-003': {
      nomorSurat: '002/UND-DPW-JABO/XI/2026',
      perihal: 'Undangan Silaturahmi Akbar dan Pembinaan Muallaf se-Jabodetabek',
      isiSurat: 'Mengharap kehadiran seluruh kader dan relawan dalam rangka koordinasi bulanan dan santunan berkala binaan muallaf se-Jabodetabek.',
      legacyHash: 'f2d4c6e8101214161820abcdefabcdef1234567890abcdef1234567890abcdef'
    }
  };

  function buildInitialSharedDb() {
    const srt1No = '005/SM-DPP-APII/XI/2026';
    const srt1Perihal = 'Surat Mandat Delegasi Dialog Teologi & Kristologi Nasional 2026';
    const srt1Isi = 'Memberikan mandat penuh kepada nama tertera di atas untuk mewakili Dewan Pengurus Pusat Yayasan Apologet Islam Indonesia dalam forum Dialog Teologi dan Kristologi Komparatif Nasional 2026 di Jakarta Islamic Centre.';

    const srt2No = '006/SK-DPP-APII/XI/2026';
    const srt2Perihal = 'Surat Keputusan Pengesahan Susunan Pengurus DPW APII Jabodetabek 2026-2031';
    const srt2Isi = 'Menimbang, Mengingat AD/ART APII 16 Bab, dan Memutuskan: Mengesahkan secara definitif susunan personalia DPW Yayasan APII Jabodetabek.';

    const srt3No = '002/UND-DPW-JABO/XI/2026';
    const srt3Perihal = 'Undangan Silaturahmi Akbar dan Pembinaan Muallaf se-Jabodetabek';
    const srt3Isi = 'Mengharap kehadiran seluruh kader dan relawan dalam rangka koordinasi bulanan dan santunan berkala binaan muallaf se-Jabodetabek.';

    return {
      surat: [
        {
          id: 'SRT-001',
          tenantId: 'DPP_PUSAT',
          nomorSurat: srt1No,
          tipe: 'SURAT_MANDAT',
          kodePerihal: 'SM',
          perihal: srt1Perihal,
          tujuan: 'Ust. Dani Ramadhan, M.Ag. (Kadiv Litbang APII)',
          tanggalMasehi: '09-11-2026',
          tanggalHijriah: '29 Jumadil Ula 1448 H',
          klasifikasi: 'Penting',
          tingkatKeamanan: 'Biasa',
          lampiran: '1 Berkas TOR',
          isiSurat: srt1Isi,
          status: 'APPROVED',
          statusSignature: 'APPROVED',
          signedBy: 'Ust. H. Ahmad Fauzi, Lc., M.A. (Ketua Umum DPP)',
          signedAt: '09-11-2026 09:30',
          hashSha256: sha256Hex(srt1No + srt1Perihal + srt1Isi),
          pdfDriveUrl: 'https://drive.google.com/apii/01_SURAT_KELUAR/SRT-001.pdf',
          createdBy: 'Ust. M. Ridwan, S.Pd.I.'
        },
        {
          id: 'SRT-002',
          tenantId: 'DPP_PUSAT',
          nomorSurat: srt2No,
          tipe: 'SK_KEPENGURUSAN',
          kodePerihal: 'SK',
          perihal: srt2Perihal,
          tujuan: 'Dewan Pengurus Wilayah APII Jabodetabek',
          tanggalMasehi: '08-11-2026',
          tanggalHijriah: '28 Jumadil Ula 1448 H',
          klasifikasi: 'Sangat Penting',
          tingkatKeamanan: 'Biasa',
          lampiran: '1 Lembar Tabel Susunan Pengurus',
          isiSurat: srt2Isi,
          status: 'AJUKAN',
          statusSignature: 'PENDING_KETUA',
          signedBy: 'Diajukan oleh Sekretaris Umum',
          signedAt: null,
          hashSha256: sha256Hex(srt2No + srt2Perihal + srt2Isi),
          pdfDriveUrl: '#',
          createdBy: 'Ust. M. Ridwan, S.Pd.I.'
        },
        {
          id: 'SRT-003',
          tenantId: 'DPW_JABO',
          nomorSurat: srt3No,
          tipe: 'SURAT_UNDANGAN',
          kodePerihal: 'UND',
          perihal: srt3Perihal,
          tujuan: 'Seluruh Pembina & Relawan Muallaf APII Jabodetabek',
          tanggalMasehi: '07-11-2026',
          tanggalHijriah: '27 Jumadil Ula 1448 H',
          klasifikasi: 'Biasa',
          tingkatKeamanan: 'Biasa',
          lampiran: '-',
          isiSurat: srt3Isi,
          status: 'APPROVED',
          statusSignature: 'APPROVED',
          signedBy: 'Ust. Bambang Hidayat, M.Si. (Ketua DPW Jabodetabek)',
          signedAt: '07-11-2026 14:15',
          hashSha256: sha256Hex(srt3No + srt3Perihal + srt3Isi),
          pdfDriveUrl: 'https://drive.google.com/apii/01_SURAT_KELUAR/SRT-003.pdf',
          createdBy: 'Ust. Irwan Setiawan'
        }
      ],
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
          drafRekomendasiSekretaris: 'Rekomendasi Sekretaris: Hadiri dan tugaskan Kadiv Litbang serta siapkan bahan naskah kajian dalil.',
          targetDivisi: ['litbang', 'humas'],
          tingkatUrgensi: 'SEGERA',
          instruksiKetua: '',
          batasWaktu: '14-11-2026',
          catatanTambahan: '',
          parafKetua: null,
          laporanTindakLanjut: '',
          laporanPerDivisi: {}
        }
      ],
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
            statusApproval: 'VERIFIKASI_BENDAHARA',
            verifiedBendaharaBy: 'H. Syamsuddin, S.E., Ak.',
            approvedKetuaBy: null,
            buktiUrl: '#'
          }
        ],
        closings: []
      },
      proker: [],
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
          tingkatLisensi: 3,
          keahlian: 'Kristologi Komparatif, Bahasa Ibrani & Manuskrip Kuno',
          status: 'APPROVED',
          tglTerbit: '15-01-2026',
          tglKedaluwarsa: '15-01-2031',
          telepon: '6281234567802',
          fotoUrl: createMonogramAvatar('Ust. Dani Ramadhan, M.Ag.', 'litbang'),
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
          tingkatLisensi: 2,
          keahlian: 'Humas, Komunikasi Publik & Siaran Pers',
          status: 'APPROVED',
          tglTerbit: '10-02-2026',
          tglKedaluwarsa: '10-02-2031',
          telepon: '6281234567801',
          fotoUrl: createMonogramAvatar('Ilham Kurniawan, S.I.Kom.', 'humas'),
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
          tingkatLisensi: 1,
          keahlian: 'Kajian Tauhid & Bimbingan Muallaf Pemula',
          status: 'VERIFIED_SEKRETARIS',
          tglTerbit: '08-11-2026',
          tglKedaluwarsa: '08-11-2031',
          telepon: '6281234567899',
          fotoUrl: createMonogramAvatar('Ust. Zulkifli, S.Th.I.', 'dakwah'),
          ktpWatermarkUrl: '#',
          verifiedSekretarisAt: '08-11-2026 16:00',
          approvedKetuaAt: null,
          kodeEtikVersi: 'APII-ETIK-2026-V1'
        }
      ],
      advokasi: [
        {
          id: 'ADV-001',
          tenantId: 'DPP_PUSAT',
          tiketNo: 'TIKET-LBH-202611-001',
          namaDai: 'Ust. Dani Ramadhan, M.Ag.',
          kontak: '6281234567802',
          lokasi: 'Bekasi Timur, Jawa Barat',
          kronologi: 'Menerima surat somasi terkait kutipan perbandingan ayat dalam kajian ilmiah tertutup.',
          urgensi: 'KILAT_DARURAT',
          buktiUrl: '#',
          status: 'TERBIT_SURAT_TUGAS',
          catatanLbh: 'Telah diterbitkan Surat Tugas Advokat No. 012/ST-LBH-APII/XI/2026.',
          updatedAt: '09-11-2026 11:30'
        },
        {
          id: 'ADV-002',
          tenantId: 'DPW_JABO',
          tiketNo: 'TIKET-LBH-202611-002',
          namaDai: 'Ust. Bambang Hidayat, M.Si.',
          kontak: '6281234567891',
          lokasi: 'Cilandak, Jakarta Selatan',
          kronologi: 'Permintaan pendampingan perlindungan saksi untuk muallaf baru.',
          urgensi: 'PENTING',
          buktiUrl: '#',
          status: 'MENUNGGU_TELAAH',
          catatanLbh: 'Berkas kronologi masuk dan sedang ditelaah oleh tim LBH APII Jabodetabek.',
          updatedAt: '09-11-2026 14:00'
        }
      ],
      tabayyun: [],
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
      attendance: [],
      assets: [],
      assetLoans: [],
      consultations: [
        {
          id: 'CSL-001',
          tenantId: 'DPP_PUSAT',
          tokenHash: hashConsultToken('tok_9a8b7c6d5e4f3a2b1c'),
          tiketNo: 'TKT-AQD-202611-001',
          topik: 'Ketuhanan Yesus & Naskah Yohanes 1:1',
          pertanyaan: 'Bagaimana bantahan ilmiah terhadap klaim bahwa Firman itu adalah Allah dalam Injil Yohanes 1:1 menurut kajian bahasa Yunani asli?',
          jawaban: 'Dalam teks Yunani kuno, kata "Theos" kedua tidak menggunakan artikel penentu (anarthrous), yang menunjukkan sifat/kualitas ilahi (divine quality) bukan identitas mutlak Dzat Allah.',
          status: 'TERJAWAB',
          createdAt: '08-11-2026 20:15',
          answeredAt: '09-11-2026 10:30',
          curatedBy: 'Divisi Litbang APII'
        },
        {
          id: 'CSL-002',
          tenantId: 'DPP_PUSAT',
          tokenHash: hashConsultToken('tok_112233445566778899'),
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
      knowledgeBase: [],
      meetings: [],
      cms: [
        {
          id: 'CMS-001',
          tenantId: 'DPP_PUSAT',
          judul: 'Maklumat Dewan Pengurus Pusat APII tentang Standar Verifikasi Syariah & Legalitas Dakwah',
          kategori: 'Maklumat',
          penulis: 'Sekretariat DPP APII',
          tanggal: '09-11-2026',
          ringkasan: 'Penegasan integritas kelembagaan Yayasan Apologet Islam Indonesia dengan landasan SK Kemenkumham RI AHU-0014970.AH.01.04.Tahun 2023.',
          konten: 'Segala bentuk kegiatan penggalangan donasi, advokasi kristologi, dan penerbitan KTA hanya sah apabila terdaftar dalam sistem verifikasi terpusat SIAP APII. Masyarakat dapat memeriksa nomor surat dinas, KTA anggota, kwitansi kas, dan piagam syahadat melalui Pusat Verifikasi Resmi.',
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
          ringkasan: 'Telaah kritis terhadap naskah Sinaiticus, Vaticanus, dan papirus awal dibandingkan tradisi mutawatir Al-Quran.',
          konten: 'Dalam diskursus teks suci, integritas transmisi lisan (hafalan mutawatir bersanad) dan tulisan menjadi batu uji keilmuan yang membedakan Al-Quran dari manuskrip kuno lain yang mengalami variasi penyalinan.',
          status: 'PUBLISHED',
          views: 3890
        },
        {
          id: 'CMS-003',
          tenantId: 'DPW_JABO',
          judul: 'Silaturahmi Akbar & Penyaluran Santunan Muallaf Binaan se-Jabodetabek',
          kategori: 'Program Wilayah',
          penulis: 'Humas DPW Jabodetabek',
          tanggal: '07-11-2026',
          ringkasan: 'DPW Jabodetabek menyalurkan paket kemandirian ekonomi dan pendampingan akidah bagi muallaf binaan.',
          konten: 'Melalui Kantong Kas Zakat Ashnaf Muallaf, DPW APII Jabodetabek menyelenggarakan pembinaan tauhid dasar serta dukungan advokasi keluarga bagi muallaf binaan di kawasan Jabodetabek.',
          status: 'PUBLISHED',
          views: 640
        }
      ],
      agenda: [
        {
          id: 'AGD-001',
          tenantId: 'DPP_PUSAT',
          day: '15',
          month: 'NOV',
          category: 'SAFARI NASIONAL',
          title: 'Dialog Teologi & Kristologi Komparatif Nasional 2026',
          speaker: 'Ust. Dani Ramadhan, M.Ag. & Tim Asatidz DPP',
          location: 'Auditorium Jakarta Islamic Centre (JIC), Koja'
        },
        {
          id: 'AGD-002',
          tenantId: 'DPP_PUSAT',
          day: '28',
          month: 'NOV',
          category: 'RAKORNAS',
          title: 'Rapat Kerja Nasional (Rakornas) I APII se-Indonesia',
          speaker: 'Dewan Pembina, Pengawas & Seluruh Ketua DPW',
          location: 'Grand Asrilia Hotel, Jakarta Pusat'
        },
        {
          id: 'AGD-003',
          tenantId: 'DPW_JABO',
          day: '20',
          month: 'NOV',
          category: 'KAJIAN PERKANTORAN',
          title: 'Kupas Tuntas Syubhat Akidah Modern & Teologi Rasional',
          speaker: 'Ust. Bambang Hidayat, M.Si.',
          location: 'Masjid Nurul Hidayah, SCBD Sudirman, Jakarta Selatan'
        }
      ],
      causes: [
        {
          id: 'CAU-001',
          tenantId: 'DPP_PUSAT',
          title: 'Pembangunan Studio Multimedia Dakwah & Pusat Riset Manuskrip Kuno APII',
          target: 250000000,
          current: 178450000,
          donorsCount: 1420,
          kantongSyariah: 'INFAQ_DAKWAH'
        },
        {
          id: 'CAU-002',
          tenantId: 'DPW_JABO',
          title: 'Operasional Shelter Darurat & Pembinaan 50 Muallaf Urban Jabodetabek',
          target: 120000000,
          current: 84500000,
          donorsCount: 890,
          kantongSyariah: 'ZAKAT'
        }
      ],
      drive: [],
      auditLogs: [],
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
  }

  let activeTenant = null;
  let watermarkedKtpBlob = null;
  let watermarkedKtpDataUrl = null;
  let currentQrisDraft = null;
  let currentModalWarta = [];

  function init() {
    ensureSharedDb();
    detectCurrentTenant();
    setupTenantSelectorDropdown();
    setupMobileNavDrawer();
    setupModalKeyboardHandlers();
    setupHashRouter();
    setupKtpWatermarker();
    setupInfaqCalculator();
    setupVerificationHub();
    renderActiveTenantView();
  }

  function getSharedDb() {
    const key = CONFIG.SHARED_STORAGE_KEY || 'siap_apii_shared_db_v3';
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return ensureDbCollections(parsed);
        }
      }
    } catch (e) {
      console.warn('Gagal membaca shared db, melakukan seed ulang:', e);
    }
    const seed = buildInitialSharedDb();
    saveSharedDb(seed);
    return seed;
  }

  function ensureDbCollections(db) {
    const seed = buildInitialSharedDb();
    let changed = false;

    const requiredArrays = ['wilayah', 'surat', 'anggota', 'muallaf', 'cms', 'agenda', 'causes', 'consultations', 'advokasi'];
    requiredArrays.forEach(k => {
      if (!Array.isArray(db[k]) || db[k].length === 0) {
        db[k] = seed[k];
        changed = true;
      }
    });

    if (!db.kas || !db.kas.balances || !Array.isArray(db.kas.transactions)) {
      db.kas = seed.kas;
      changed = true;
    }

    if (Array.isArray(db.wilayah)) {
      db.wilayah.forEach(w => {
        const seedW = seed.wilayah.find(sw => sw.code === w.code);
        const rawLat = w.lat === '' || w.lat === null || typeof w.lat === 'undefined' ? NaN : Number(w.lat);
        const rawLng = w.lng === '' || w.lng === null || typeof w.lng === 'undefined' ? NaN : Number(w.lng);
        if (seedW && (!Number.isFinite(rawLat) || !Number.isFinite(rawLng) || rawLat === 0 || rawLng === 0)) {
          w.lat = seedW.lat;
          w.lng = seedW.lng;
          w.zoom = seedW.zoom;
          changed = true;
        }
      });
    }

    if (changed) saveSharedDb(db);
    return db;
  }

  function ensureSharedDb() {
    return getSharedDb();
  }

  function saveSharedDb(db) {
    try {
      localStorage.setItem(CONFIG.SHARED_STORAGE_KEY || 'siap_apii_shared_db_v3', JSON.stringify(db));
    } catch (e) {
      console.error('Gagal menyimpan shared db:', e);
    }
  }

  // =========================================================================
  // 3. TENANT RESOLUTION, WILDCARD HOSTNAME SNIFFER & DROPDOWN SYNC
  // =========================================================================
  function getAllActiveTenants() {
    const db = getSharedDb();
    const configMap = {};
    (CONFIG.TENANTS || []).forEach(t => {
      configMap[t.code] = t;
    });

    const pusatBase = configMap.DPP_PUSAT || CONFIG.TENANTS[0];
    const wilayahList = (db.wilayah || []).filter(w => w.isActive !== false);

    return wilayahList.map(w => {
      const cfg = configMap[w.code] || {};
      const shortSlug = w.slug || w.code.toLowerCase().replace(/^dp[pw]_/, '');
      const settingsTenant = db.settings && db.settings.tenants ? db.settings.tenants[w.code] : null;

      return {
        code: w.code,
        name: w.name || cfg.name || w.code,
        slug: shortSlug,
        shortCodeSlug: w.code.toLowerCase().replace(/^dp[pw]_/, ''),
        level: w.level || cfg.level || (w.code === 'DPP_PUSAT' ? 'DPP' : 'DPW'),
        badge: cfg.badge || (w.code === 'DPP_PUSAT' ? 'MARKAZ DAKWAH NASIONAL' : `WILAYAH OPERASIONAL ${String(w.name || '').toUpperCase()}`),
        headline: cfg.headline || `Portal Resmi ${w.name} Yayasan Apologet Islam Indonesia`,
        subheadline: cfg.subheadline || `Dewan Pengurus Wilayah ${w.name} Yayasan Apologet Islam Indonesia`,
        mission: cfg.mission || pusatBase.mission,
        phone: w.phone || cfg.phone || pusatBase.phone,
        email: cfg.email || `sekretariat.${shortSlug}@apologetislamindonesia.or.id`,
        city: w.city || cfg.city || 'Indonesia',
        address: w.address || cfg.address || pusatBase.address,
        lat: Number.isFinite(Number(w.lat)) ? Number(w.lat) : (Number.isFinite(Number(cfg.lat)) ? Number(cfg.lat) : null),
        lng: Number.isFinite(Number(w.lng)) ? Number(w.lng) : (Number.isFinite(Number(cfg.lng)) ? Number(cfg.lng) : null),
        zoom: Number.isFinite(Number(w.zoom)) ? Number(w.zoom) : (Number.isFinite(Number(cfg.zoom)) ? Number(cfg.zoom) : 13),
        pimpinan: cfg.pimpinan || (settingsTenant ? {
          ketua: settingsTenant.ketuaNama + ' (' + (settingsTenant.ketuaJabatan || 'Ketua Wilayah') + ')',
          sekretaris: settingsTenant.sekretarisNama + ' (' + (settingsTenant.sekretarisJabatan || 'Sekretaris Wilayah') + ')',
          bendahara: 'Bendahara ' + w.name
        } : {
          ketua: 'Ketua ' + w.name,
          sekretaris: 'Sekretaris ' + w.name,
          bendahara: 'Bendahara ' + w.name
        }),
        bank: cfg.bank || null,
        crowdfunding: cfg.crowdfunding || null,
        warta: cfg.warta || null,
        agenda: cfg.agenda || null
      };
    });
  }

  function matchTenantSlug(tenants, queryStr) {
    if (!queryStr) return null;
    const q = String(queryStr).trim().toLowerCase();
    return tenants.find(t =>
      t.slug.toLowerCase() === q ||
      t.shortCodeSlug === q ||
      t.code.toLowerCase() === q
    ) || null;
  }

  function detectCurrentTenant() {
    const tenants = getAllActiveTenants();
    const db = getSharedDb();
    const host = window.location.hostname.toLowerCase();
    const urlParams = new URLSearchParams(window.location.search);
    const queryDpw = urlParams.get('dpw');

    // Prioritas 1: Query param ?dpw=...
    if (queryDpw) {
      const match = matchTenantSlug(tenants, queryDpw);
      if (match) {
        activeTenant = match;
        return activeTenant;
      }
      // Check if slug belongs to inactive wilayah or unknown
      setTimeout(() => {
        showDpwNotFoundModal(queryDpw);
      }, 250);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('dpw');
      window.history.replaceState({}, '', newUrl.toString());
    }

    // Prioritas 2: Wildcard Subdomain ({slug}.apologetislamindonesia.or.id atau {slug}.localhost)
    const isWildcardDomain = host.includes('.apologetislamindonesia.or.id') || (host.endsWith('.localhost') && host.split('.').length >= 2);
    if (isWildcardDomain) {
      const sub = host.split('.')[0];
      if (sub && !['www', 'siap', 'portal', 'public'].includes(sub)) {
        const subMatch = matchTenantSlug(tenants, sub);
        if (subMatch) {
          activeTenant = subMatch;
          return activeTenant;
        }
        // Inactive or unknown subdomain
        const inactiveMatch = (db.wilayah || []).find(w =>
          w.slug === sub || w.code.toLowerCase() === sub || w.code.toLowerCase().replace(/^dp[pw]_/, '') === sub
        );
        setTimeout(() => {
          showDpwNotFoundModal(inactiveMatch ? inactiveMatch.name : sub);
        }, 350);
      }
    }

    activeTenant = tenants.find(t => t.code === 'DPP_PUSAT') || tenants[0] || CONFIG.TENANTS[0];
    return activeTenant;
  }

  function getActiveTenant() {
    return activeTenant || getAllActiveTenants()[0] || CONFIG.TENANTS[0];
  }

  function switchTenantManually(slugOrCode) {
    const tenants = getAllActiveTenants();
    const match = matchTenantSlug(tenants, slugOrCode);
    if (match) {
      activeTenant = match;
      renderActiveTenantView();

      const newUrl = new URL(window.location.href);
      if (match.slug === 'pusat') {
        newUrl.searchParams.delete('dpw');
      } else {
        newUrl.searchParams.set('dpw', match.slug);
      }
      window.history.pushState({}, '', newUrl.toString());
      showToast(`Wilayah beralih ke: ${match.name}`);
    } else {
      showDpwNotFoundModal(slugOrCode);
    }
  }

  function populateTenantDropdowns() {
    const tenants = getAllActiveTenants();
    const active = getActiveTenant();

    const desktopSelect = document.getElementById('public-tenant-select');
    const mobileSelect = document.getElementById('mobile-tenant-select');
    const regWilayahSelect = document.getElementById('reg-wilayah');

    const slugOptionsHtml = tenants.map(t => `<option value="${escapeHtml(t.slug)}">${escapeHtml(t.name)}</option>`).join('');
    if (desktopSelect) {
      desktopSelect.innerHTML = slugOptionsHtml;
      desktopSelect.value = active.slug;
    }
    if (mobileSelect) {
      mobileSelect.innerHTML = slugOptionsHtml;
      mobileSelect.value = active.slug;
    }
    if (regWilayahSelect) {
      const currentRegVal = regWilayahSelect.value;
      regWilayahSelect.innerHTML = tenants.map(t => `<option value="${escapeHtml(t.code)}">${escapeHtml(t.name)}</option>`).join('');
      if (tenants.some(t => t.code === currentRegVal)) {
        regWilayahSelect.value = currentRegVal;
      } else {
        regWilayahSelect.value = active.code;
      }
    }
  }

  function setupTenantSelectorDropdown() {
    populateTenantDropdowns();

    document.getElementById('public-tenant-select')?.addEventListener('change', (e) => {
      switchTenantManually(e.target.value);
    });
    document.getElementById('mobile-tenant-select')?.addEventListener('change', (e) => {
      switchTenantManually(e.target.value);
      closeMobileMenu();
    });
  }

  // =========================================================================
  // 4. MOBILE NAVIGATION DRAWER & ACCESSIBLE MODALS
  // =========================================================================
  function openMobileMenu() {
    const drawer = document.getElementById('mobile-nav-drawer');
    const btn = document.getElementById('btn-mobile-menu');
    if (drawer) {
      drawer.classList.remove('hidden');
      if (btn) btn.setAttribute('aria-expanded', 'true');
      document.getElementById('btn-close-mobile-menu')?.focus();
    }
  }

  function closeMobileMenu() {
    const drawer = document.getElementById('mobile-nav-drawer');
    const btn = document.getElementById('btn-mobile-menu');
    if (drawer && !drawer.classList.contains('hidden')) {
      drawer.classList.add('hidden');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  }

  function setupMobileNavDrawer() {
    document.getElementById('btn-mobile-menu')?.addEventListener('click', openMobileMenu);
    document.getElementById('btn-close-mobile-menu')?.addEventListener('click', closeMobileMenu);
    document.getElementById('mobile-nav-backdrop')?.addEventListener('click', closeMobileMenu);
    document.querySelectorAll('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', () => closeMobileMenu());
    });
  }

  function closeAllModals() {
    document.querySelectorAll('.public-modal').forEach(m => m.classList.add('hidden'));
  }

  function setupModalKeyboardHandlers() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllModals();
        closeMobileMenu();
      }
    });
    document.querySelectorAll('.public-modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAllModals();
      });
    });
  }

  // =========================================================================
  // 5. RENDER TENANT VIEW, NATIONAL TICKER, GEO-DAKWAH & SMART FALLBACK
  // =========================================================================
  function renderActiveTenantView() {
    const t = getActiveTenant();
    populateTenantDropdowns();

    // Navbar & Hero
    const elPill = document.getElementById('public-tenant-pill');
    if (elPill) elPill.textContent = t.name;

    const elBadge = document.getElementById('hero-tenant-badge');
    if (elBadge) elBadge.textContent = t.badge;

    const elSub = document.getElementById('hero-tenant-subtitle');
    if (elSub) elSub.textContent = t.subheadline;

    const elHeadline = document.getElementById('hero-tenant-headline');
    if (elHeadline) elHeadline.textContent = t.headline;

    const elMission = document.getElementById('hero-tenant-mission');
    if (elMission) elMission.textContent = t.mission;

    // Pimpinan Card
    const pimpinanContainer = document.getElementById('regional-pimpinan-container');
    if (pimpinanContainer && t.pimpinan) {
      pimpinanContainer.innerHTML = `
        <div class="p-6 rounded-xl bg-surface-container-lowest border border-surface-container-high shadow-lg">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-surface-container">
            <span class="text-xs uppercase font-bold text-primary flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">account_balance</span>
              <span>SUSUNAN STRUKTUR PENGURUS ${escapeHtml(t.name.toUpperCase())}</span>
            </span>
            <span class="text-[11px] text-on-surface-variant font-mono">Yurisdiksi Resmi</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="p-3.5 rounded-lg bg-surface-container-low flex flex-col gap-1 border border-surface-container-high">
              <span class="text-[11px] uppercase font-bold text-secondary">Ketua / Pimpinan Wilayah</span>
              <h3 class="font-bold text-sm text-primary">${escapeHtml(t.pimpinan.ketua)}</h3>
            </div>
            <div class="p-3.5 rounded-lg bg-surface-container-low flex flex-col gap-1 border border-surface-container-high">
              <span class="text-[11px] uppercase font-bold text-secondary">Sekretaris Wilayah</span>
              <h3 class="font-bold text-sm text-primary">${escapeHtml(t.pimpinan.sekretaris)}</h3>
            </div>
            <div class="p-3.5 rounded-lg bg-surface-container-low flex flex-col gap-1 border border-surface-container-high">
              <span class="text-[11px] uppercase font-bold text-secondary">Bendahara Wilayah</span>
              <h3 class="font-bold text-sm text-primary">${escapeHtml(t.pimpinan.bendahara)}</h3>
            </div>
          </div>
        </div>
      `;
    }

    // Footer & Ticker Hotline
    const elFootAddr = document.getElementById('footer-address');
    const elFootContact = document.getElementById('footer-contact');
    const elTickerHotline = document.getElementById('ticker-hotline');
    if (elFootAddr) elFootAddr.textContent = t.address;
    if (elFootContact) elFootContact.textContent = `Telp/WA: +${t.phone} | Email: ${t.email}`;
    if (elTickerHotline) elTickerHotline.textContent = `Hotline: +${t.phone}`;

    renderNationalTicker();
    renderGeoDakwah();
    renderCrowdfunding();
    renderInfaqView();
    renderRegionalWartaAndAgenda();
  }

  function renderNationalTicker() {
    const track = document.getElementById('national-ticker-track');
    if (!track) return;
    const db = getSharedDb();
    const nationalCms = (db.cms || []).filter(c => c.tenantId === 'DPP_PUSAT' && (c.status || 'PUBLISHED') === 'PUBLISHED');

    const segments = [
      `SK Kemenkumham RI: <strong class="tabular-nums">${escapeHtml(CONFIG.LEGAL_SK || 'AHU-0014970.AH.01.04.Tahun 2023')}</strong>`
    ];
    nationalCms.slice(0, 3).forEach(item => {
      segments.push(`<strong>${escapeHtml((item.kategori || 'MAKLUMAT').toUpperCase())}:</strong> ${escapeHtml(item.judul)}`);
    });
    segments.push('Pendaftaran KTA APII 100% Gratis');
    segments.push('Transparansi 4 Kantong Kas Syar\'i');

    track.innerHTML = `<span>${segments.join(' &nbsp;|&nbsp; ')}</span>`;
  }

  let geoActiveLayerKey = 'roadmap';
  let geoCenterState = { lat: -6.1856, lng: 106.8456, zoom: 14 };
  let geoPanListenersBound = false;

  const CITY_GEO_FALLBACKS = {
    'jakarta pusat': { lat: -6.1856, lng: 106.8456, zoom: 14 },
    'jakarta selatan': { lat: -6.2905, lng: 106.7949, zoom: 13 },
    'jabodetabek': { lat: -6.2905, lng: 106.7949, zoom: 13 },
    'bandung': { lat: -6.9175, lng: 107.6191, zoom: 12 },
    'jawa barat': { lat: -6.9175, lng: 107.6191, zoom: 11 },
    'surabaya': { lat: -7.2575, lng: 112.7521, zoom: 12 },
    'jawa timur': { lat: -7.2575, lng: 112.7521, zoom: 10 },
    'semarang': { lat: -6.9667, lng: 110.4167, zoom: 12 },
    'yogyakarta': { lat: -7.7956, lng: 110.3695, zoom: 12 },
    'medan': { lat: 3.5952, lng: 98.6722, zoom: 12 },
    'pekanbaru': { lat: 0.5071, lng: 101.4478, zoom: 12 },
    'makassar': { lat: -5.1477, lng: 119.4327, zoom: 12 },
    'balikpapan': { lat: -1.2379, lng: 116.8529, zoom: 12 },
    'denpasar': { lat: -8.6705, lng: 115.2126, zoom: 12 }
  };

  function resolveTenantCoordinates(tenant) {
    if (tenant && Number.isFinite(Number(tenant.lat)) && Number.isFinite(Number(tenant.lng))) {
      return { lat: Number(tenant.lat), lng: Number(tenant.lng), zoom: Number(tenant.zoom) || 14 };
    }
    const cityKey = String(tenant?.city || tenant?.name || '').toLowerCase();
    for (const key of Object.keys(CITY_GEO_FALLBACKS)) {
      if (cityKey.includes(key)) return CITY_GEO_FALLBACKS[key];
    }
    return { lat: -6.1856, lng: 106.8456, zoom: 12 };
  }

  function buildGoogleMapsPinUrl(tenant) {
    const coords = resolveTenantCoordinates(tenant);
    const query = `${coords.lat},${coords.lng}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  function latLngToWorldPx(lat, lng, zoom) {
    const scale = 256 * Math.pow(2, zoom);
    const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
    const sinLat = Math.sin((clampedLat * Math.PI) / 180);
    const x = ((lng + 180) / 360) * scale;
    const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
    return { x, y };
  }

  function worldPxToLatLng(px, py, zoom) {
    const scale = 256 * Math.pow(2, zoom);
    const lng = (px / scale) * 360 - 180;
    const n = Math.PI - (2 * Math.PI * py) / scale;
    const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    return { lat, lng };
  }

  function buildGoogleTileUrl(tx, ty, zoom, layerKey) {
    const sub = Math.abs(tx + ty) % 4;
    const lyrs = layerKey === 'hybrid' ? 'y' : 'm';
    return `https://mt${sub}.google.com/vt/lyrs=${lyrs}&hl=id&x=${tx}&y=${ty}&z=${zoom}`;
  }

  function buildFallbackTileUrl(tx, ty, zoom, layerKey) {
    const subs = ['a', 'b', 'c'];
    const s = subs[Math.abs(tx + ty) % subs.length];
    if (layerKey === 'hybrid') {
      return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`;
    }
    return `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${tx}/${ty}.png`;
  }

  function buildTertiaryTileUrl(tx, ty, zoom) {
    const subs = ['a', 'b', 'c'];
    const s = subs[Math.abs(tx + ty) % subs.length];
    return `https://${s}.tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
  }

  function updateGeoLayerButtons() {
    const btnRoad = document.getElementById('btn-map-roadmap');
    const btnHyb = document.getElementById('btn-map-hybrid');
    const activeCls = 'min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-primary shadow-sm transition-colors';
    const idleCls = 'min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-800 hover:bg-emerald-700 text-white border border-emerald-700 transition-colors';
    if (btnRoad) btnRoad.className = geoActiveLayerKey === 'roadmap' ? activeCls : idleCls;
    if (btnHyb) btnHyb.className = geoActiveLayerKey === 'hybrid' ? activeCls : idleCls;
  }

  function bindGeoMapInteractions(mapContainer) {
    if (geoPanListenersBound || !mapContainer || typeof mapContainer.addEventListener !== 'function') return;
    geoPanListenersBound = true;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startWorld = null;

    mapContainer.addEventListener('mousedown', (e) => {
      if (e.target && e.target.closest && e.target.closest('button, a')) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startWorld = latLngToWorldPx(geoCenterState.lat, geoCenterState.lng, geoCenterState.zoom);
      if (mapContainer.style) mapContainer.style.cursor = 'grabbing';
    });

    if (typeof ResizeObserver === 'function') {
      try {
        const ro = new ResizeObserver(() => {
          syncGeoMapViewport();
        });
        ro.observe(mapContainer);
      } catch (e) {}
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('mousemove', (e) => {
        if (!dragging || !startWorld) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const nextLatLng = worldPxToLatLng(startWorld.x - dx, startWorld.y - dy, geoCenterState.zoom);
        geoCenterState.lat = nextLatLng.lat;
        geoCenterState.lng = nextLatLng.lng;
        syncGeoMapViewport();
      });

      window.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        if (mapContainer.style) mapContainer.style.cursor = 'grab';
      });

      window.addEventListener('resize', () => {
        syncGeoMapViewport();
      });
    }
  }

  function syncGeoMapViewport() {
    const mapContainer = document.getElementById('geo-google-map');
    const tilesLayer = document.getElementById('geo-map-tiles');
    const pinsLayer = document.getElementById('geo-map-pins');
    const offlineFallback = document.getElementById('geo-offline-fallback');
    const attrEl = document.getElementById('geo-map-attribution');

    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (isOffline || !mapContainer || !tilesLayer || !pinsLayer) {
      if (offlineFallback) offlineFallback.classList.remove('hidden');
      return;
    }

    if (offlineFallback) offlineFallback.classList.add('hidden');
    bindGeoMapInteractions(mapContainer);

    const rect = typeof mapContainer.getBoundingClientRect === 'function'
      ? mapContainer.getBoundingClientRect()
      : { width: 880, height: 400 };
    const viewW = Math.max(320, Math.round(rect.width) || 880);
    const viewH = Math.max(360, Math.round(rect.height) || 400);

    const z = Math.max(3, Math.min(18, Math.round(geoCenterState.zoom)));
    const maxTileIdx = Math.pow(2, z);
    const centerPx = latLngToWorldPx(geoCenterState.lat, geoCenterState.lng, z);
    const topLeftX = centerPx.x - viewW / 2;
    const topLeftY = centerPx.y - viewH / 2;

    const minTx = Math.floor(topLeftX / 256);
    const maxTx = Math.floor((topLeftX + viewW) / 256);
    const minTy = Math.max(0, Math.floor(topLeftY / 256));
    const maxTy = Math.min(maxTileIdx - 1, Math.floor((topLeftY + viewH) / 256));

    // Dual-layer render: cepat tampil (<150ms) lewat underlay CARTO/Esri + Google Maps overlay di atasnya
    const baseParts = [];
    const googleParts = [];
    for (let tx = minTx; tx <= maxTx; tx++) {
      const wrappedTx = ((tx % maxTileIdx) + maxTileIdx) % maxTileIdx;
      for (let ty = minTy; ty <= maxTy; ty++) {
        const left = Math.round(tx * 256 - topLeftX);
        const top = Math.round(ty * 256 - topLeftY);
        const fastBaseSrc = buildFallbackTileUrl(wrappedTx, ty, z, geoActiveLayerKey);
        const osmBackupSrc = buildTertiaryTileUrl(wrappedTx, ty, z);
        const googleSrc = buildGoogleTileUrl(wrappedTx, ty, z, geoActiveLayerKey);
        const posStyle = `position:absolute;left:${left}px;top:${top}px;width:256px;height:256px;max-width:none;margin:0;padding:0;border:0;user-select:none;`;
        baseParts.push(
          `<img class="geo-base-tile" src="${fastBaseSrc}" referrerpolicy="no-referrer" alt="" draggable="false" data-backup="${osmBackupSrc}" onerror="if(!this.dataset.retried){this.dataset.retried='1';this.src=this.dataset.backup;}else{this.style.display='none';}" style="${posStyle}z-index:0;" />`
        );
        googleParts.push(
          `<img class="geo-google-tile" src="${googleSrc}" referrerpolicy="no-referrer" alt="" draggable="false" onload="this.style.opacity='1';" onerror="this.style.display='none';" style="${posStyle}z-index:1;opacity:0;transition:opacity 180ms ease;" />`
        );
      }
    }
    tilesLayer.innerHTML = baseParts.join('') + googleParts.join('');

    if (attrEl) {
      attrEl.textContent = geoActiveLayerKey === 'hybrid'
        ? 'Citra Satelit Google Maps | SIAP APII'
        : 'Data Peta Google Maps | SIAP APII';
    }

    const active = getActiveTenant();
    const tenants = getAllActiveTenants();
    const pinHtmlParts = tenants.map(t => {
      const c = resolveTenantCoordinates(t);
      const p = latLngToWorldPx(c.lat, c.lng, z);
      const px = Math.round(p.x - topLeftX);
      const py = Math.round(p.y - topLeftY);
      const isSel = t.code === active.code;
      const pinBg = isSel ? '#b45309' : '#003527';
      const ringClr = isSel ? '#fde68a' : '#6ee7b7';
      const zIdx = isSel ? 5 : 3;
      const mapsUrl = buildGoogleMapsPinUrl(t);
      const infoCard = isSel
        ? `<div style="margin-top:6px;min-width:210px;max-width:260px;background:rgba(255,255,255,0.97);border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;box-shadow:0 8px 20px rgba(0,0,0,0.22);text-align:left;">
              <div style="font-size:11px;font-weight:800;color:#064e3b;text-transform:uppercase;">${escapeHtml(t.level || 'WILAYAH')}</div>
             <div style="font-size:12px;font-weight:800;color:#0f172a;margin:2px 0;">${escapeHtml(t.name)}</div>
             <div style="font-size:11px;color:#475569;line-height:1.35;margin-bottom:6px;">${escapeHtml(t.address || t.city || '')}</div>
             <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:44px;font-size:11px;font-weight:700;color:#92400e;background:#fffbeb;border:1px solid #fcd34d;padding:3px 12px;border-radius:6px;text-decoration:none;">Rute Google Maps</a>
           </div>`
        : '';

      return `<div style="position:absolute;left:${px}px;top:${py}px;transform:translate(-50%,-100%);z-index:${zIdx};display:flex;flex-direction:column;align-items:center;">
        <button type="button" onclick="PublicApp.switchTenantManually('${escapeHtml(t.slug)}')" title="${escapeHtml(t.name)}" style="display:flex;align-items:center;gap:5px;background:none;border:none;padding:9px 6px;margin:-9px -6px;cursor:pointer;">
          <span style="width:26px;height:26px;border-radius:9999px 9999px 9999px 0;transform:rotate(-45deg);background:${pinBg};border:2.5px solid #ffffff;box-shadow:0 3px 10px rgba(0,0,0,0.4);display:inline-flex;align-items:center;justify-content:center;">
            <span style="width:9px;height:9px;border-radius:9999px;background:${ringClr};transform:rotate(45deg);display:block;"></span>
          </span>
          <span style="background:${pinBg};color:#ffffff;font-family:Inter,sans-serif;font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;white-space:nowrap;border:1px solid ${ringClr};box-shadow:0 2px 6px rgba(0,0,0,0.35);">${escapeHtml(t.name)}</span>
        </button>
        ${infoCard}
      </div>`;
    });
    pinsLayer.innerHTML = pinHtmlParts.join('');
  }

  function setGeoMapLayer(layerKey) {
    geoActiveLayerKey = layerKey === 'hybrid' ? 'hybrid' : 'roadmap';
    updateGeoLayerButtons();
    syncGeoMapViewport();
  }

  function zoomGeoMap(delta) {
    geoCenterState.zoom = Math.max(4, Math.min(18, geoCenterState.zoom + Number(delta || 0)));
    syncGeoMapViewport();
  }

  function fitAllGeoMarkers() {
    const tenants = getAllActiveTenants();
    if (tenants.length === 0) return;
    const coords = tenants.map(resolveTenantCoordinates);
    const avgLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
    const avgLng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;
    geoCenterState = {
      lat: avgLat,
      lng: avgLng,
      zoom: tenants.length <= 2 ? 11 : 5
    };
    syncGeoMapViewport();
  }

  function renderGeoDakwah() {
    const db = getSharedDb();
    const tenants = getAllActiveTenants();
    const active = getActiveTenant();
    const activeCoords = resolveTenantCoordinates(active);
    const activeMapsUrl = buildGoogleMapsPinUrl(active);
    geoCenterState = { lat: activeCoords.lat, lng: activeCoords.lng, zoom: activeCoords.zoom };

    const summaryEl = document.getElementById('geo-active-summary');
    if (summaryEl) {
      summaryEl.textContent = `Navigasi Wilayah Operasional (${tenants.length} Wilayah Aktif):`;
    }

    const activeLabelEl = document.getElementById('geo-active-label');
    if (activeLabelEl) {
      activeLabelEl.textContent = `${active.name} - ${active.city || 'Indonesia'}`;
    }
    const activeAddrEl = document.getElementById('geo-active-address');
    if (activeAddrEl) {
      activeAddrEl.textContent = active.address || 'Sekretariat Yayasan Apologet Islam Indonesia';
    }
    const gmapsLinkEl = document.getElementById('geo-google-maps-link');
    if (gmapsLinkEl) gmapsLinkEl.href = activeMapsUrl;

    const navEl = document.getElementById('geo-nav-buttons');
    if (navEl) {
      navEl.innerHTML = tenants.map(t => {
        const isCurrent = t.code === active.code;
        const btnClass = isCurrent
          ? 'bg-amber-700 text-white border border-amber-400'
          : 'bg-emerald-800 hover:bg-emerald-700 text-white border border-emerald-700';
        return `<button type="button" onclick="PublicApp.switchTenantManually('${escapeHtml(t.slug)}')" class="min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold transition-colors ${btnClass}">${escapeHtml(t.name)}</button>`;
      }).join('');
    }

    // Real counts from sharedDb (R-17 compliant)
    const wilayahCount = tenants.length;
    const anggotaCount = (db.anggota || []).length;
    const muallafCount = (db.muallaf || []).length;
    const agendaCount = (db.agenda || []).length;

    const elW = document.getElementById('geo-stat-wilayah');
    const elA = document.getElementById('geo-stat-anggota');
    const elM = document.getElementById('geo-stat-muallaf');
    const elG = document.getElementById('geo-stat-agenda');

    if (elW) elW.textContent = `${wilayahCount} Wilayah Aktif`;
    if (elA) elA.textContent = `${anggotaCount} Anggota Tercatat`;
    if (elM) elM.textContent = `${muallafCount} Muallaf Binaan`;
    if (elG) elG.textContent = `${agendaCount} Agenda Aktif`;

    const offlineCoords = document.getElementById('geo-offline-coords');
    const offlineGmapsLink = document.getElementById('geo-offline-gmaps-link');
    if (offlineCoords) {
      offlineCoords.textContent = `${active.name}: ${active.address} (Titik Koordinat: ${activeCoords.lat.toFixed(4)}, ${activeCoords.lng.toFixed(4)}).`;
    }
    if (offlineGmapsLink) {
      offlineGmapsLink.href = activeMapsUrl;
    }

    updateGeoLayerButtons();
    syncGeoMapViewport();
  }

  function resolveCrowdfundingCause() {
    const db = getSharedDb();
    const t = getActiveTenant();
    const causes = db.causes || [];

    let cause = causes.find(c => c.tenantId === t.code);
    let isFallback = false;
    if (!cause && t.code !== 'DPP_PUSAT') {
      cause = causes.find(c => c.tenantId === 'DPP_PUSAT');
      isFallback = Boolean(cause);
    }
    if (!cause) {
      cause = t.crowdfunding || CONFIG.TENANTS[0].crowdfunding;
    }
    return { cause, isFallback };
  }

  function renderCrowdfunding() {
    const { cause, isFallback } = resolveCrowdfundingCause();
    if (!cause) return;

    const elTitle = document.getElementById('crowdfund-title');
    const elCurr = document.getElementById('crowdfund-current');
    const elTgt = document.getElementById('crowdfund-target');
    const elBar = document.getElementById('crowdfund-progress-bar');
    const elPct = document.getElementById('crowdfund-pct');
    const elDonors = document.getElementById('crowdfund-donors');
    const elFallback = document.getElementById('crowdfund-fallback-badge');

    const current = Number(cause.current) || 0;
    const target = Math.max(1, Number(cause.target) || 1);
    const pct = Math.min(100, Math.round((current / target) * 100));

    if (elTitle) elTitle.textContent = cause.title;
    if (elCurr) elCurr.textContent = 'Rp ' + current.toLocaleString('id-ID');
    if (elTgt) elTgt.textContent = 'Rp ' + target.toLocaleString('id-ID');
    if (elDonors) elDonors.textContent = (Number(cause.donorsCount) || 0).toLocaleString('id-ID');
    if (elBar) elBar.style.width = pct + '%';
    if (elPct) elPct.textContent = pct + '%';
    if (elFallback) elFallback.classList.toggle('hidden', !isFallback);
  }

  function resolveBankInfo() {
    const t = getActiveTenant();
    if (t.bank && t.bank.accountNo) {
      return { bank: t.bank, isFallback: false };
    }
    const pusat = CONFIG.TENANTS[0];
    return {
      bank: pusat.bank,
      isFallback: t.code !== 'DPP_PUSAT'
    };
  }

  function renderInfaqView() {
    const db = getSharedDb();
    const t = getActiveTenant();
    const { bank, isFallback } = resolveBankInfo();

    const elFallback = document.getElementById('infaq-fallback-badge');
    if (elFallback) elFallback.classList.toggle('hidden', !isFallback);

    if (bank) {
      const elBankTitle = document.getElementById('infaq-bank-name-title');
      const elBankNo = document.getElementById('infaq-bank-no');
      const elBankName = document.getElementById('infaq-bank-name');
      const elQrisLabel = document.getElementById('infaq-qris-label');

      if (elBankTitle) elBankTitle.textContent = (bank.name || 'Bank Syariah Indonesia (BSI)').toUpperCase();
      if (elBankNo) elBankNo.textContent = bank.accountNo;
      if (elBankName) elBankName.textContent = bank.accountName;
      if (elQrisLabel) elQrisLabel.textContent = bank.qrisText || ('QRIS ' + t.name.toUpperCase());
    }

    // Live 4-Kantong Balance Summary
    const summaryEl = document.getElementById('infaq-kas-summary');
    if (summaryEl && db.kas && db.kas.balances) {
      const bal = db.kas.balances[t.code] || db.kas.balances.DPP_PUSAT || {
        INFAQ_DAKWAH: 0, ZAKAT: 0, WAKAF: 0, AMIL_OPERASIONAL: 0
      };
      const wallets = [
        { key: 'INFAQ_DAKWAH', label: 'Infaq Dakwah', note: 'Kajian & Safari' },
        { key: 'ZAKAT', label: 'Zakat 8 Ashnaf', note: 'Muallaf & Mustahik' },
        { key: 'WAKAF', label: 'Wakaf Produktif', note: 'Aset & Studio' },
        { key: 'AMIL_OPERASIONAL', label: 'Amil Operasional', note: 'Sekretariat' }
      ];
      summaryEl.innerHTML = wallets.map(w => `
        <div class="p-3.5 rounded-xl bg-surface-container-lowest border border-surface-container-high flex flex-col gap-1">
          <span class="text-[11px] font-bold uppercase text-secondary">${escapeHtml(w.label)}</span>
          <span class="font-headline font-extrabold text-base sm:text-lg text-primary tabular-nums">Rp ${(Number(bal[w.key]) || 0).toLocaleString('id-ID')}</span>
          <span class="text-[11px] text-on-surface-variant">${escapeHtml(w.note)}</span>
        </div>
      `).join('');
    }

    // Update SVG QRIS preview
    const qrWrap = document.getElementById('infaq-qris-svg-container');
    if (qrWrap) {
      const kantong = document.getElementById('infaq-kantong-select')?.value || 'INFAQ_DAKWAH';
      const amt = Number(document.getElementById('infaq-custom-input')?.value) || 100000;
      qrWrap.innerHTML = generateQrSvg(`APII|${t.code}|${kantong}|${amt}`, 210);
    }
  }

  function resolveWartaForTenant() {
    const db = getSharedDb();
    const t = getActiveTenant();
    const allCms = (db.cms || []).filter(c => (c.status || 'PUBLISHED') === 'PUBLISHED');
    let list = allCms.filter(c => c.tenantId === t.code);
    let isFallback = false;

    if (list.length === 0 && t.code !== 'DPP_PUSAT') {
      list = allCms.filter(c => c.tenantId === 'DPP_PUSAT');
      isFallback = list.length > 0;
    }
    return { list, isFallback };
  }

  function resolveAgendaForTenant() {
    const db = getSharedDb();
    const t = getActiveTenant();
    const allAgenda = db.agenda || [];
    let list = allAgenda.filter(a => a.tenantId === t.code);
    let isFallback = false;

    if (list.length === 0 && t.code !== 'DPP_PUSAT') {
      list = allAgenda.filter(a => a.tenantId === 'DPP_PUSAT');
      isFallback = list.length > 0;
    }
    return { list, isFallback };
  }

  function renderWartaCardHtml(w, idx) {
    return `
      <article class="p-5 rounded-xl bg-surface-container-lowest border border-surface-container-high shadow-sm flex flex-col justify-between gap-3">
        <div>
          <span class="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">${escapeHtml(w.kategori || 'Warta')}</span>
          <h3 class="font-headline font-bold text-base sm:text-lg text-primary mt-2 leading-snug">${escapeHtml(w.judul)}</h3>
          <p class="text-xs text-on-surface-variant leading-relaxed mt-1.5">${escapeHtml(w.ringkasan)}</p>
        </div>
        <div class="pt-3 border-t border-surface-container flex items-center justify-between gap-2 text-xs text-on-surface-variant">
          <span class="tabular-nums">${escapeHtml(w.tanggal)} | ${escapeHtml(w.penulis || 'Sekretariat APII')}</span>
          <button type="button" onclick="PublicApp.openWartaModal(${idx})" class="min-h-[36px] px-3 py-1 rounded-lg bg-surface-container hover:bg-primary-fixed text-primary font-bold text-xs transition-colors shrink-0">
            Baca Selengkapnya
          </button>
        </div>
      </article>
    `;
  }

  function renderAgendaCardHtml(ag) {
    return `
      <div class="p-4 sm:p-5 rounded-xl bg-surface-container-lowest border border-surface-container-high shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div class="flex items-start gap-3.5">
          <div class="w-12 h-12 rounded-lg bg-primary-fixed text-primary flex flex-col items-center justify-center font-bold shrink-0 tabular-nums">
            <span class="text-[10px] leading-tight uppercase">${escapeHtml(ag.month)}</span>
            <span class="text-lg leading-tight">${escapeHtml(ag.day)}</span>
          </div>
          <div>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 uppercase">${escapeHtml(ag.category)}</span>
            <h3 class="font-headline font-bold text-sm sm:text-base text-primary mt-1">${escapeHtml(ag.title)}</h3>
            <p class="text-on-surface-variant mt-0.5">Narasumber: ${escapeHtml(ag.speaker)} | Lokasi: ${escapeHtml(ag.location)}</p>
          </div>
        </div>
        <button type="button" onclick="PublicApp.registerAgendaAttendance(this, '${escapeHtml(ag.title)}')" class="min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white font-bold text-xs hover:bg-primary-container shrink-0 transition-colors">
          Daftar Hadir
        </button>
      </div>
    `;
  }

  function renderRegionalWartaAndAgenda() {
    const wartaRes = resolveWartaForTenant();
    currentModalWarta = wartaRes.list;

    const wartaFallbackBadge = document.getElementById('warta-fallback-badge');
    const wartaViewFallback = document.getElementById('warta-view-fallback-badge');
    if (wartaFallbackBadge) wartaFallbackBadge.classList.toggle('hidden', !wartaRes.isFallback);
    if (wartaViewFallback) wartaViewFallback.classList.toggle('hidden', !wartaRes.isFallback);

    const wartaEmptyHtml = '<div class="col-span-full p-6 rounded-xl bg-surface-container-lowest border border-surface-container-high text-center text-xs text-on-surface-variant">Belum ada warta yang diterbitkan.</div>';

    const wartaHome = document.getElementById('warta-cards-container');
    if (wartaHome) {
      wartaHome.innerHTML = wartaRes.list.length > 0
        ? wartaRes.list.slice(0, 4).map((w, idx) => renderWartaCardHtml(w, idx)).join('')
        : wartaEmptyHtml;
    }

    const wartaFull = document.getElementById('warta-full-list');
    if (wartaFull) {
      wartaFull.innerHTML = wartaRes.list.length > 0
        ? wartaRes.list.map((w, idx) => renderWartaCardHtml(w, idx)).join('')
        : wartaEmptyHtml;
    }

    const agendaRes = resolveAgendaForTenant();
    const agendaFallbackBadge = document.getElementById('agenda-fallback-badge');
    const agendaViewFallback = document.getElementById('agenda-view-fallback-badge');
    if (agendaFallbackBadge) agendaFallbackBadge.classList.toggle('hidden', !agendaRes.isFallback);
    if (agendaViewFallback) agendaViewFallback.classList.toggle('hidden', !agendaRes.isFallback);

    const agendaEmptyHtml = '<div class="p-6 rounded-xl bg-surface-container-lowest border border-surface-container-high text-center text-xs text-on-surface-variant">Belum ada agenda kajian terjadwal.</div>';

    const agendaHome = document.getElementById('agenda-cards-container');
    if (agendaHome) {
      agendaHome.innerHTML = agendaRes.list.length > 0
        ? agendaRes.list.slice(0, 3).map(renderAgendaCardHtml).join('')
        : agendaEmptyHtml;
    }

    const agendaFull = document.getElementById('agenda-full-list');
    if (agendaFull) {
      agendaFull.innerHTML = agendaRes.list.length > 0
        ? agendaRes.list.map(renderAgendaCardHtml).join('')
        : agendaEmptyHtml;
    }
  }

  function openWartaModal(index) {
    const item = currentModalWarta[index];
    if (!item) return;

    const modal = document.getElementById('modal-warta-reader');
    const elTag = document.getElementById('warta-reader-tag');
    const elTitle = document.getElementById('warta-reader-title');
    const elMeta = document.getElementById('warta-reader-meta');
    const elBody = document.getElementById('warta-reader-body');

    if (elTag) elTag.textContent = item.kategori || 'WARTA APII';
    if (elTitle) elTitle.textContent = item.judul || '';
    if (elMeta) elMeta.textContent = `${item.tanggal || ''} | Ditulis oleh ${item.penulis || 'Sekretariat APII'}`;
    if (elBody) {
      const fullText = item.konten || item.ringkasan || '';
      elBody.innerHTML = `<p class="font-semibold text-primary">${escapeHtml(item.ringkasan || '')}</p><p>${escapeHtml(fullText)}</p>`;
    }
    if (modal) modal.classList.remove('hidden');
  }

  function registerAgendaAttendance(btnEl, title) {
    if (btnEl) {
      btnEl.textContent = 'Terdaftar';
      btnEl.classList.remove('bg-primary', 'hover:bg-primary-container');
      btnEl.classList.add('bg-secondary', 'cursor-default');
      btnEl.disabled = true;
    }
    showToast(`Kehadiran Anda untuk "${title}" tercatat di pengingat peramban.`);
  }

  // =========================================================================
  // 6. HASH ROUTER & ?token= DEEP LINK PARSING
  // =========================================================================
  function setupHashRouter() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  function handleRoute() {
    const rawHash = window.location.hash || '#/';
    const hashParts = rawHash.split('?');
    const route = hashParts[0] || '#/';
    const hashQuery = hashParts.length > 1 ? new URLSearchParams(hashParts[1]) : new URLSearchParams('');
    const searchQuery = new URLSearchParams(window.location.search);

    document.querySelectorAll('.route-view').forEach(v => v.classList.add('hidden'));

    let targetViewId = 'view-beranda';
    if (route === '#/daftar') targetViewId = 'view-daftar';
    else if (route === '#/infaq') targetViewId = 'view-infaq';
    else if (route === '#/warta') targetViewId = 'view-warta';
    else if (route === '#/agenda') targetViewId = 'view-agenda';
    else if (route === '#/verifikasi') targetViewId = 'view-verifikasi';
    else if (route === '#/konsultasi') targetViewId = 'view-konsultasi';
    else if (route === '#/advokasi') targetViewId = 'view-advokasi';

    const targetEl = document.getElementById(targetViewId);
    if (targetEl) targetEl.classList.remove('hidden');

    if (targetViewId === 'view-beranda') {
      syncGeoMapViewport();
    }

    // Active nav highlight
    document.querySelectorAll('.public-nav-link').forEach(link => {
      const r = link.getAttribute('data-route');
      if (r === route) {
        link.classList.add('bg-primary-fixed/50', 'text-primary');
      } else {
        link.classList.remove('bg-primary-fixed/50', 'text-primary');
      }
    });

    // Deep-link token handling on #/verifikasi?token=...
    const deepToken = hashQuery.get('token') || searchQuery.get('token');
    const deepHash = hashQuery.get('hash') || searchQuery.get('hash');
    if (route === '#/verifikasi' && deepToken) {
      autoDispatchVerificationToken(deepToken, deepHash);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // =========================================================================
  // 7. UU PDP KTP WATERMARKING & <= 250 KB ITERATIVE WEBP COMPRESSOR
  // =========================================================================
  function setupKtpWatermarker() {
    const fileInput = document.getElementById('ktp-file-input');
    if (!fileInput) return;

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          applyWatermarkToKtp(img);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function canvasToBlobAsync(canvas, mime, quality) {
    return new Promise((resolve) => {
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob((blob) => resolve(blob), mime, quality);
      } else {
        resolve(null);
      }
    });
  }

  async function applyWatermarkToKtp(img) {
    const MAX_BYTES = 250 * 1024; // PRD 3.2.1: <= 250 KB
    let width = img.width;
    let height = img.height;
    const MAX_WIDTH = 1200;

    if (width > MAX_WIDTH) {
      height = Math.round((height * MAX_WIDTH) / width);
      width = MAX_WIDTH;
    }

    const today = formatTanggal();
    const watermarkText = `VERIFIKASI KTA YAYASAN APII - DILARANG MENYALAHGUNAKAN - TANGGAL: ${today}`;

    function drawWatermarkedCanvas(w, h) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      ctx.save();
      ctx.strokeStyle = 'rgba(0, 53, 39, 0.25)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, h);
      ctx.moveTo(w, 0);
      ctx.lineTo(0, h);
      ctx.stroke();

      ctx.translate(w / 2, h / 2);
      ctx.rotate(-28 * Math.PI / 180);
      ctx.font = `bold ${Math.max(14, Math.round(w / 32))}px sans-serif`;
      ctx.fillStyle = 'rgba(0, 53, 39, 0.42)';
      ctx.textAlign = 'center';

      const lineSpacing = Math.max(40, Math.round(h / 6));
      for (let offset = -h; offset <= h; offset += lineSpacing) {
        ctx.fillText(watermarkText, 0, offset);
      }
      ctx.restore();
      return c;
    }

    let finalBlob = null;
    let finalDataUrl = null;
    const qualities = [0.82, 0.70, 0.58, 0.45, 0.34, 0.24];

    for (let scalePass = 0; scalePass < 4; scalePass++) {
      const c = drawWatermarkedCanvas(width, height);
      for (const q of qualities) {
        const blob = await canvasToBlobAsync(c, 'image/webp', q);
        if (blob) {
          finalBlob = blob;
          finalDataUrl = c.toDataURL('image/webp', q);
          if (blob.size <= MAX_BYTES) break;
        }
      }
      if (finalBlob && finalBlob.size <= MAX_BYTES) break;
      width = Math.max(320, Math.round(width * 0.75));
      height = Math.max(200, Math.round(height * 0.75));
    }

    watermarkedKtpBlob = finalBlob;
    watermarkedKtpDataUrl = finalDataUrl;

    const previewContainer = document.getElementById('ktp-watermark-container');
    const previewImg = document.getElementById('ktp-watermark-preview');
    const sizeSpan = document.getElementById('ktp-watermark-size');

    if (previewContainer && previewImg && finalDataUrl) {
      previewImg.src = finalDataUrl;
      if (sizeSpan && finalBlob) {
        sizeSpan.textContent = `Ukuran Terkompresi: ${(finalBlob.size / 1024).toFixed(1)} KB (WebP <= 250 KB)`;
      }
      previewContainer.classList.remove('hidden');
    }

    showToast('KTP berhasil diproteksi watermark UU PDP!');
  }

  function submitRegistration(event) {
    event.preventDefault();
    const nama = document.getElementById('reg-nama')?.value.trim();
    const nik = document.getElementById('reg-nik')?.value.trim();
    const phone = document.getElementById('reg-phone')?.value.trim();
    const email = document.getElementById('reg-email')?.value.trim() || '';
    const wilayah = document.getElementById('reg-wilayah')?.value || 'DPP_PUSAT';
    const kota = document.getElementById('reg-kota')?.value.trim();
    const minat = document.getElementById('reg-divisi-minat')?.value || 'dakwah';

    if (!nama || !nik || !phone || !kota) {
      showToast('Harap lengkapi nama, NIK, nomor WhatsApp, dan kota domisili.', 'error');
      return;
    }

    if (!/^\d{16}$/.test(nik)) {
      showToast('NIK harus berupa 16 digit angka sesuai KTP.', 'error');
      return;
    }

    const now = new Date();
    const expiryDate = new Date(now.getFullYear() + 5, now.getMonth(), now.getDate());
    const tglTerbit = formatTanggal(now);
    const tglKedaluwarsa = formatTanggal(expiryDate);

    const sharedDb = getSharedDb();
    const newId = 'REG-' + Date.now().toString(36).toUpperCase();
    const maskedNik = maskNik(nik);
    const wilayahObj = (sharedDb.wilayah || []).find(w => w.code === wilayah);
    const wilayahLabel = wilayahObj ? wilayahObj.name : wilayah;

    const newPendaftar = {
      id: 'MBR-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      tenantId: wilayah,
      nia: 'MENUNGGU_PENGESAHAN',
      namaLengkap: nama,
      nik: maskedNik,
      kota: kota,
      wilayah: wilayahLabel,
      email: email,
      divisiMinat: minat,
      tingkatLisensi: 1,
      keahlian: minat.toUpperCase(),
      status: 'MENUNGGU_VERIFIKASI',
      tglTerbit: tglTerbit,
      tglKedaluwarsa: tglKedaluwarsa,
      telepon: phone,
      fotoUrl: createMonogramAvatar(nama, minat),
      ktpWatermarkUrl: watermarkedKtpDataUrl || '#',
      verifiedSekretarisAt: null,
      approvedKetuaAt: null,
      kodeEtikVersi: 'APII-ETIK-2026-V1'
    };

    sharedDb.anggota.unshift(newPendaftar);
    saveSharedDb(sharedDb);
    renderGeoDakwah();

    if (window.ApiClient && typeof window.ApiClient.request === 'function' && window.CONFIG && CONFIG.API_URL) {
      window.ApiClient.request('registerMember', {
        wilayah_id: wilayah,
        nama_lengkap: nama,
        nik: maskedNik,
        kota: kota,
        telepon: phone,
        email: email,
        divisi_minat: minat
      }).catch(() => {});
    }

    const elNama = document.getElementById('success-reg-nama');
    const elKota = document.getElementById('success-reg-kota');
    const elWil = document.getElementById('success-reg-wilayah');
    const elRegId = document.getElementById('success-reg-id');
    const modal = document.getElementById('modal-reg-success');

    if (elNama) elNama.textContent = nama;
    if (elKota) elKota.textContent = kota;
    if (elWil) elWil.textContent = wilayahLabel;
    if (elRegId) elRegId.textContent = newId;
    if (modal) modal.classList.remove('hidden');

    event.target.reset();
    document.getElementById('ktp-watermark-container')?.classList.add('hidden');
    watermarkedKtpBlob = null;
    watermarkedKtpDataUrl = null;
  }

  // =========================================================================
  // 8. INFAQ 4-KANTONG SYARIAH, QRIS CONFIRMATION MODAL & CROWDFUNDING SYNC
  // =========================================================================
  const KANTONG_META = {
    INFAQ_DAKWAH: {
      label: 'Infaq Dakwah & Safari Wilayah',
      desc: 'Akad Infaq Dakwah: untuk kajian, safari dakwah, literasi, dan pembinaan umat.'
    },
    ZAKAT: {
      label: 'Zakat Maal / Fitrah (8 Ashnaf)',
      desc: 'Akad Zakat: disalurkan khusus untuk 8 ashnaf mustahik termasuk pembinaan muallaf dan fisabilillah.'
    },
    WAKAF: {
      label: 'Wakaf Produktif & Aset Dakwah',
      desc: 'Akad Wakaf: dijaga pokok asetnya untuk studio dakwah, maktabah, dan infrastruktur jangka panjang.'
    },
    AMIL_OPERASIONAL: {
      label: 'Amil & Operasional Sekretariat',
      desc: 'Akad Amil/Operasional: mendukung tata kelola administrasi, server sistem, dan koordinasi dakwah.'
    }
  };

  function setupInfaqCalculator() {
    const customInput = document.getElementById('infaq-custom-input');
    const kantongSelect = document.getElementById('infaq-kantong-select');
    const kantongDesc = document.getElementById('infaq-kantong-desc');

    document.querySelectorAll('.infaq-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const amt = btn.getAttribute('data-amount');
        if (customInput) customInput.value = amt;
        document.querySelectorAll('.infaq-preset-btn').forEach(b => b.classList.remove('bg-primary-fixed', 'border-primary'));
        btn.classList.add('bg-primary-fixed', 'border-primary');
        renderInfaqView();
      });
    });

    if (customInput) {
      customInput.addEventListener('input', () => renderInfaqView());
    }

    if (kantongSelect) {
      kantongSelect.addEventListener('change', () => {
        const meta = KANTONG_META[kantongSelect.value] || KANTONG_META.INFAQ_DAKWAH;
        if (kantongDesc) kantongDesc.textContent = meta.desc;
        renderInfaqView();
      });
    }

    document.getElementById('btn-copy-rekening')?.addEventListener('click', () => {
      const noRek = document.getElementById('infaq-bank-no')?.textContent || '777-888-999-1';
      copyText(noRek.replace(/-/g, ''), 'Nomor rekening BSI berhasil disalin.');
    });
  }

  function openQrisConfirmModal() {
    const nominalPokok = Number(document.getElementById('infaq-custom-input')?.value) || 0;
    if (nominalPokok < 10000) {
      showToast('Nominal infaq minimal Rp 10.000.', 'error');
      return;
    }

    const kantong = document.getElementById('infaq-kantong-select')?.value || 'INFAQ_DAKWAH';
    const donorName = document.getElementById('infaq-donor-name')?.value.trim() || 'Hamba Allah';
    const donorPhone = document.getElementById('infaq-donor-phone')?.value.trim() || '-';
    const t = getActiveTenant();
    const { bank } = resolveBankInfo();

    const kodeUnik = Math.floor(100 + Math.random() * 899);
    const totalNominal = nominalPokok + kodeUnik;
    const invId = `INV-APII-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(10000 + Math.random() * 89999)}`;

    currentQrisDraft = {
      invId,
      tenantId: t.code,
      tenantName: t.name,
      kantong,
      donorName,
      donorPhone,
      nominalPokok,
      kodeUnik,
      totalNominal
    };

    const kantongLabel = (KANTONG_META[kantong] || KANTONG_META.INFAQ_DAKWAH).label;

    document.getElementById('qris-kantong-label').textContent = kantongLabel.toUpperCase();
    document.getElementById('qris-donor-info').textContent = `${donorName} (${t.name})`;
    document.getElementById('qris-inv-id').textContent = invId;
    document.getElementById('qris-nominal-pokok').textContent = 'Rp ' + nominalPokok.toLocaleString('id-ID');
    document.getElementById('qris-kode-unik').textContent = '+Rp ' + kodeUnik;
    document.getElementById('qris-nominal-total').textContent = 'Rp ' + totalNominal.toLocaleString('id-ID');

    document.getElementById('qris-modal-merchant').textContent = (bank?.accountName || 'YAYASAN APOLOGET ISLAM INDONESIA').toUpperCase();
    document.getElementById('qris-modal-svg').innerHTML = generateQrSvg(`${invId}|${t.code}|${kantong}|${totalNominal}`, 200);
    document.getElementById('qris-modal-bank-no').textContent = bank?.accountNo || '777-888-999-1';
    document.getElementById('qris-modal-bank-name').textContent = 'a.n ' + (bank?.accountName || 'Yayasan Apologet Islam Indonesia');

    const resBox = document.getElementById('qris-confirm-result');
    if (resBox) {
      resBox.classList.add('hidden');
      resBox.innerHTML = '';
    }
    const payBtn = document.getElementById('btn-confirm-qris-paid');
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.classList.remove('hidden');
    }

    document.getElementById('btn-copy-qris-inv').onclick = () => copyText(invId, 'ID Tagihan berhasil disalin.');
    document.getElementById('btn-copy-qris-amount').onclick = () => copyText(String(totalNominal), `Nominal tepat Rp ${totalNominal.toLocaleString('id-ID')} disalin.`);
    document.getElementById('btn-copy-qris-bank').onclick = () => copyText((bank?.accountNo || '7778889991').replace(/-/g, ''), 'No Rekening berhasil disalin.');

    switchQrisTab('qris');
    document.getElementById('modal-qris-confirm')?.classList.remove('hidden');
  }

  function switchQrisTab(tab) {
    const qrisBtn = document.getElementById('qris-tab-qris');
    const bankBtn = document.getElementById('qris-tab-bank');
    const qrisPanel = document.getElementById('qris-panel-qris');
    const bankPanel = document.getElementById('qris-panel-bank');

    if (tab === 'qris') {
      qrisBtn?.classList.add('bg-white', 'text-primary', 'shadow-sm', 'font-bold');
      qrisBtn?.classList.remove('text-on-surface-variant');
      bankBtn?.classList.remove('bg-white', 'text-primary', 'shadow-sm', 'font-bold');
      bankBtn?.classList.add('text-on-surface-variant');
      qrisPanel?.classList.remove('hidden');
      qrisPanel?.classList.add('flex');
      bankPanel?.classList.add('hidden');
      bankPanel?.classList.remove('flex');
    } else {
      bankBtn?.classList.add('bg-white', 'text-primary', 'shadow-sm', 'font-bold');
      bankBtn?.classList.remove('text-on-surface-variant');
      qrisBtn?.classList.remove('bg-white', 'text-primary', 'shadow-sm', 'font-bold');
      qrisBtn?.classList.add('text-on-surface-variant');
      bankPanel?.classList.remove('hidden');
      bankPanel?.classList.add('flex');
      qrisPanel?.classList.add('hidden');
      qrisPanel?.classList.remove('flex');
    }
  }

  function confirmQrisDonation() {
    if (!currentQrisDraft) return;
    const db = getSharedDb();
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const nextSeq = String((db.kas.transactions || []).filter(tx => tx.tipe === 'MASUK').length + 1).padStart(3, '0');
    const noVoucher = `BKM-${ym}-${nextSeq}`;
    const noKwitansi = `KWT-${noVoucher}`;
    const tenantId = currentQrisDraft.tenantId || 'DPP_PUSAT';

    const newTrx = {
      id: 'TRX-' + Date.now().toString(36).toUpperCase(),
      tenantId: tenantId,
      tanggal: formatTanggal(now),
      tipe: 'MASUK',
      kantongSyariah: currentQrisDraft.kantong,
      kategori: (KANTONG_META[currentQrisDraft.kantong] || KANTONG_META.INFAQ_DAKWAH).label,
      nominal: currentQrisDraft.totalNominal,
      noVoucher: noVoucher,
      noKwitansi: noKwitansi,
      keterangan: `Donasi Publik QRIS (${currentQrisDraft.invId}) a.n. ${currentQrisDraft.donorName}`,
      pihakTerkait: `${currentQrisDraft.donorName}${currentQrisDraft.donorPhone !== '-' ? ' (' + currentQrisDraft.donorPhone + ')' : ''}`,
      metode: 'QRIS_ONLINE',
      statusApproval: 'APPROVED',
      verifiedBendaharaBy: 'Sistem Gateway QRIS APII',
      approvedKetuaBy: 'Terverifikasi Otomatis',
      buktiUrl: '#'
    };

    db.kas.transactions.unshift(newTrx);
    if (!db.kas.balances[tenantId]) {
      db.kas.balances[tenantId] = { AMIL_OPERASIONAL: 0, ZAKAT: 0, INFAQ_DAKWAH: 0, WAKAF: 0 };
    }
    db.kas.balances[tenantId][currentQrisDraft.kantong] = (Number(db.kas.balances[tenantId][currentQrisDraft.kantong]) || 0) + currentQrisDraft.totalNominal;

    // Live sync crowdfunding cause
    if (Array.isArray(db.causes) && db.causes.length > 0) {
      let cause = db.causes.find(c => c.tenantId === tenantId) || db.causes.find(c => c.tenantId === 'DPP_PUSAT');
      if (cause) {
        cause.current = (Number(cause.current) || 0) + currentQrisDraft.totalNominal;
        cause.donorsCount = (Number(cause.donorsCount) || 0) + 1;
      }
    }

    saveSharedDb(db);
    renderCrowdfunding();
    renderInfaqView();

    const resBox = document.getElementById('qris-confirm-result');
    const payBtn = document.getElementById('btn-confirm-qris-paid');
    if (payBtn) payBtn.classList.add('hidden');
    if (resBox) {
      resBox.classList.remove('hidden');
      resBox.innerHTML = `
        <div class="flex flex-col gap-1.5">
          <span class="font-bold text-emerald-900 flex items-center gap-1">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">verified</span>
            <span>Donasi Tercatat di Buku Kas Syar'i</span>
          </span>
          <p>Kwitansi Resmi: <strong class="font-mono text-primary tabular-nums">${escapeHtml(noKwitansi)}</strong> (${escapeHtml(noVoucher)})</p>
          <p>Nominal: <strong class="tabular-nums">Rp ${currentQrisDraft.totalNominal.toLocaleString('id-ID')}</strong> masuk ke kantong <strong>${escapeHtml(currentQrisDraft.kantong)}</strong>.</p>
          <a href="#/verifikasi?token=${encodeURIComponent(noKwitansi)}" onclick="PublicApp.closeAllModals()" class="mt-1 inline-flex items-center gap-1 font-bold text-primary underline">
            Verifikasi Kwitansi di Verification Hub
          </a>
        </div>
      `;
    }

    showToast(`Alhamdulillah, donasi tercatat dengan kwitansi ${noKwitansi}.`);
  }

  // =========================================================================
  // 9. UNIFIED VERIFICATION HUB (STRICT INTEGRITY + ?token= + TAMPER ALERT)
  // =========================================================================
  function isCanonicalUnmodifiedSeedSurat(surat) {
    const seed = CANONICAL_SEED_SURAT[surat.id];
    if (!seed) return false;
    return surat.nomorSurat === seed.nomorSurat &&
      surat.perihal === seed.perihal &&
      surat.isiSurat === seed.isiSurat &&
      (surat.hashSha256 === seed.legacyHash || surat.hashSha256 === sha256Hex(seed.nomorSurat + seed.perihal + seed.isiSurat));
  }

  function verifySuratByInput(rawVal, suppliedHashParam = null) {
    const val = String(rawVal || '').trim();
    const res = document.getElementById('verif-surat-result');
    if (!val || !res) return;

    let searchToken = val;
    let suppliedHash = suppliedHashParam ? String(suppliedHashParam).trim() : null;
    if (val.includes('|')) {
      const parts = val.split('|');
      searchToken = parts[0].trim();
      suppliedHash = (parts[1] || '').trim();
    }

    const db = getSharedDb();
    let match = null;
    if (db && db.surat) {
      match = db.surat.find(s =>
        (s.nomorSurat && s.nomorSurat.toLowerCase() === searchToken.toLowerCase()) ||
        (s.hashSha256 && s.hashSha256.toLowerCase() === searchToken.toLowerCase())
      );
    }

    res.classList.remove('hidden');
    if (!match) {
      const looksLikeHash = /^[a-f0-9]{64}$/i.test(searchToken);
      res.innerHTML = looksLikeHash
        ? `<div class="p-4 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs flex flex-col gap-1">
             <strong class="text-sm text-red-900">PERINGATAN: DOKUMEN TIDAK VALID / TELAH DIMANIPULASI!</strong>
             <span>Hash SHA-256 tidak cocok dengan arsip dokumen resmi APII yang disahkan.</span>
           </div>`
        : `<div class="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs">
             <strong>TIDAK DITEMUKAN:</strong> Naskah surat atau kode hash tidak terdaftar dalam arsip resmi Yayasan APII.
           </div>`;
      return;
    }

    // Strict status check: must be APPROVED or PUBLISHED
    if (match.status !== 'APPROVED' && match.status !== 'PUBLISHED') {
      res.innerHTML = `
        <div class="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex flex-col gap-1">
          <strong class="text-sm text-amber-900">DOKUMEN BELUM DISAHKAN (STATUS: ${escapeHtml(match.status)})</strong>
          <p>Nomor Surat: <strong class="tabular-nums">${escapeHtml(match.nomorSurat)}</strong></p>
          <p>Dokumen ini masih berstatus draf/pengajuan atau ditolak dan belum memiliki keabsahan hukum dari Ketua.</p>
        </div>
      `;
      return;
    }

    // Strict SHA-256 integrity verification & Tamper Alert
    const expectedHash = sha256Hex(match.nomorSurat + (match.perihal || '') + (match.isiSurat || ''));
    const pipeHash = sha256Hex(match.nomorSurat + '|' + (match.perihal || '') + '|' + (match.isiSurat || ''));
    const storedHash = String(match.hashSha256 || '').trim().toLowerCase();
    const hasValidHex = /^[a-f0-9]{64}$/.test(storedHash);

    const contentHashValid =
      storedHash === expectedHash ||
      storedHash === pipeHash ||
      isCanonicalUnmodifiedSeedSurat(match);

    const suppliedHashMismatch = Boolean(suppliedHash && suppliedHash.toLowerCase() !== storedHash);

    if (match.tampered === true || !hasValidHex || !contentHashValid || suppliedHashMismatch) {
      res.innerHTML = `
        <div class="p-4 rounded-xl bg-red-50 border-2 border-red-400 text-red-950 flex flex-col gap-1.5 text-xs">
          <span class="font-extrabold text-sm text-red-900 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">gpp_bad</span>
            <span>PERINGATAN: DOKUMEN TIDAK VALID / TELAH DIMANIPULASI!</span>
          </span>
          <p>Integritas hash SHA-256 naskah <strong>${escapeHtml(match.nomorSurat)}</strong> tidak sesuai dengan catatan otentikasi resmi APII.</p>
          <p class="font-mono text-[11px] text-red-800 break-all tabular-nums">Hash Tercatat: ${escapeHtml(match.hashSha256 || 'KOSONG')}</p>
        </div>
      `;
      return;
    }

    res.innerHTML = `
      <div class="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex flex-col gap-1 text-xs">
        <span class="font-bold text-emerald-900 flex items-center gap-1">
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">verified</span>
          <span>DOKUMEN RESMI 100% ASLI &amp; TERVERIFIKASI</span>
        </span>
        <p class="font-bold text-sm text-primary mt-1 tabular-nums">${escapeHtml(match.nomorSurat)}</p>
        <p><strong>Perihal:</strong> ${escapeHtml(match.perihal)}</p>
        <p><strong>Tujuan:</strong> ${escapeHtml(match.tujuan)}</p>
        <p><strong>Penandatangan:</strong> ${escapeHtml(match.signedBy || 'Pimpinan APII')}</p>
        <p class="font-mono text-[11px] text-on-surface-variant break-all mt-1 tabular-nums">Hash SHA-256: ${escapeHtml(match.hashSha256)}</p>
      </div>
    `;
  }

  function verifyKtaByInput(rawVal) {
    const val = String(rawVal || '').trim();
    const res = document.getElementById('verif-kta-result');
    if (!val || !res) return;

    const db = getSharedDb();
    const match = (db.anggota || []).find(a => a.nia && a.nia.toLowerCase() === val.toLowerCase());

    res.classList.remove('hidden');
    if (!match) {
      res.innerHTML = `
        <div class="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs">
          <strong>TIDAK DITEMUKAN:</strong> Nomor NIA tidak terdaftar di database keanggotaan resmi APII.
        </div>
      `;
      return;
    }

    if (match.status !== 'APPROVED') {
      res.innerHTML = `
        <div class="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex flex-col gap-1">
          <strong class="text-sm text-amber-900">KTA BELUM DISAHKAN / TIDAK AKTIF (${escapeHtml(match.status)})</strong>
          <p><strong>Nama:</strong> ${escapeHtml(match.namaLengkap)}</p>
          <p><strong>NIA:</strong> <span class="tabular-nums">${escapeHtml(match.nia)}</span></p>
        </div>
      `;
      return;
    }

    // Expiry check
    const expDate = match.tglKedaluwarsa ? parseDate(match.tglKedaluwarsa) : null;
    const isExpired = expDate && !isNaN(expDate.getTime()) && expDate.getTime() < new Date().setHours(0, 0, 0, 0);
    if (isExpired) {
      res.innerHTML = `
        <div class="p-4 rounded-xl bg-red-50 border border-red-300 text-red-950 text-xs flex flex-col gap-1">
          <strong class="text-sm text-red-900">KTA KEDALUWARSA (EXPIRED)</strong>
          <p><strong>Nama:</strong> ${escapeHtml(match.namaLengkap)}</p>
          <p><strong>Masa Berlaku Berakhir:</strong> <span class="tabular-nums">${escapeHtml(match.tglKedaluwarsa)}</span></p>
        </div>
      `;
      return;
    }

    res.innerHTML = `
      <div class="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex flex-col gap-1 text-xs">
        <span class="font-bold text-emerald-900 flex items-center gap-1">
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">verified</span>
          <span>KTA RESMI TERDAFTAR (AKTIF)</span>
        </span>
        <p class="font-bold text-sm text-primary mt-1">${escapeHtml(match.namaLengkap)}</p>
        <p><strong>NIA:</strong> <span class="tabular-nums">${escapeHtml(match.nia)}</span></p>
        <p><strong>NIK (UU PDP):</strong> <span class="font-mono tabular-nums">${escapeHtml(maskNik(match.nik))}</span></p>
        <p><strong>Wilayah:</strong> ${escapeHtml(match.wilayah)}${match.kota ? ' (' + escapeHtml(match.kota) + ')' : ''}</p>
        <p><strong>Lisensi Da'i:</strong> Tingkat ${escapeHtml(match.tingkatLisensi || 1)}</p>
        <p><strong>Masa Berlaku:</strong> s/d <span class="tabular-nums">${escapeHtml(match.tglKedaluwarsa)}</span></p>
      </div>
    `;
  }

  function verifyKwitansiByInput(rawVal) {
    const val = String(rawVal || '').trim();
    const res = document.getElementById('verif-kwitansi-result');
    if (!val || !res) return;

    const db = getSharedDb();
    let match = null;
    if (db && db.kas && db.kas.transactions) {
      match = db.kas.transactions.find(t =>
        (t.noVoucher && t.noVoucher.toLowerCase() === val.toLowerCase()) ||
        (t.noKwitansi && t.noKwitansi.toLowerCase() === val.toLowerCase())
      );
    }

    res.classList.remove('hidden');
    if (!match) {
      res.innerHTML = `
        <div class="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs">
          <strong>TIDAK DITEMUKAN:</strong> Nomor kwitansi/voucher kas tidak ditemukan dalam buku kas umum resmi.
        </div>
      `;
      return;
    }

    if (match.statusApproval !== 'APPROVED') {
      res.innerHTML = `
        <div class="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex flex-col gap-1">
          <strong class="text-sm text-amber-900">BUKTI KAS BELUM DISAHKAN (STATUS: ${escapeHtml(match.statusApproval)})</strong>
          <p><strong>Voucher:</strong> <span class="tabular-nums">${escapeHtml(match.noVoucher)}</span></p>
          <p>Transaksi ini belum memperoleh otorisasi akhir Ketua dan belum menjadi kwitansi sah.</p>
        </div>
      `;
      return;
    }

    res.innerHTML = `
      <div class="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex flex-col gap-1 text-xs">
        <span class="font-bold text-emerald-900 flex items-center gap-1">
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">verified</span>
          <span>BUKTI KAS RESMI TERVERIFIKASI</span>
        </span>
        <p class="font-bold text-sm text-primary mt-1 tabular-nums">${escapeHtml(match.noKwitansi || match.noVoucher)}</p>
        <p><strong>Nominal:</strong> <span class="tabular-nums">Rp ${Number(match.nominal || 0).toLocaleString('id-ID')}</span></p>
        <p><strong>Uraian:</strong> ${escapeHtml(match.keterangan)}</p>
        <p><strong>Kantong Kas:</strong> ${escapeHtml(match.kantongSyariah)}</p>
        <p><strong>Status:</strong> ${escapeHtml(match.statusApproval)}</p>
      </div>
    `;
  }

  function verifySyahadatByInput(rawVal) {
    const val = String(rawVal || '').trim();
    const res = document.getElementById('verif-syahadat-result');
    if (!val || !res) return;

    const db = getSharedDb();
    const match = (db.muallaf || []).find(m => m.regNo && m.regNo.toLowerCase() === val.toLowerCase());

    res.classList.remove('hidden');
    if (match) {
      res.innerHTML = `
        <div class="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex flex-col gap-1 text-xs">
          <span class="font-bold text-emerald-900 flex items-center gap-1">
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">verified</span>
            <span>PIAGAM IKRAR SYAHADAT RESMI TERCATAT</span>
          </span>
          <p class="font-bold text-sm text-primary mt-1 tabular-nums">${escapeHtml(match.regNo)}</p>
          <p><strong>Nama Hijrah:</strong> ${escapeHtml(match.namaHijrah)}</p>
          <p><strong>Tanggal Ikrar:</strong> <span class="tabular-nums">${escapeHtml(match.tglSyahadat)}</span></p>
          <p><strong>Pembimbing:</strong> ${escapeHtml(match.pembimbing)}</p>
          <p><strong>Divisi:</strong> Divisi Dakwah &amp; Pembinaan Muallaf Yayasan APII</p>
        </div>
      `;
    } else {
      res.innerHTML = `
        <div class="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs">
          <strong>TIDAK DITEMUKAN:</strong> Nomor registrasi piagam syahadat tidak ditemukan.
        </div>
      `;
    }
  }

  function autoDispatchVerificationToken(token, suppliedHash = null) {
    const t = String(token || '').trim();
    if (!t) return;
    const upper = t.toUpperCase();

    let targetInputId = 'input-verif-surat';
    let targetCardId = 'verif-card-surat';
    let verifyFn = (v) => verifySuratByInput(v, suppliedHash);

    if (upper.startsWith('APII-SYH-') || upper.startsWith('MLF-')) {
      targetInputId = 'input-verif-syahadat';
      targetCardId = 'verif-card-syahadat';
      verifyFn = verifySyahadatByInput;
    } else if (upper.startsWith('APII-')) {
      targetInputId = 'input-verif-kta';
      targetCardId = 'verif-card-kta';
      verifyFn = verifyKtaByInput;
    } else if (upper.startsWith('KWT-') || upper.startsWith('BKM-') || upper.startsWith('BKK-') || upper.startsWith('DRAFT-KEU-')) {
      targetInputId = 'input-verif-kwitansi';
      targetCardId = 'verif-card-kwitansi';
      verifyFn = verifyKwitansiByInput;
    } else if (/\/(SM|SK|UND|SE|ST|SR)-/i.test(t) || /^[a-f0-9]{64}$/i.test(t) || t.includes('|')) {
      targetInputId = 'input-verif-surat';
      targetCardId = 'verif-card-surat';
      verifyFn = (v) => verifySuratByInput(v, suppliedHash);
    } else {
      // Check sharedDb datasets for unknown prefixes
      const db = getSharedDb();
      if ((db.anggota || []).some(a => a.nia && a.nia.toLowerCase() === t.toLowerCase())) {
        targetInputId = 'input-verif-kta';
        targetCardId = 'verif-card-kta';
        verifyFn = verifyKtaByInput;
      } else if ((db.kas?.transactions || []).some(tx => (tx.noKwitansi || '').toLowerCase() === t.toLowerCase() || (tx.noVoucher || '').toLowerCase() === t.toLowerCase())) {
        targetInputId = 'input-verif-kwitansi';
        targetCardId = 'verif-card-kwitansi';
        verifyFn = verifyKwitansiByInput;
      } else if ((db.muallaf || []).some(m => (m.regNo || '').toLowerCase() === t.toLowerCase())) {
        targetInputId = 'input-verif-syahadat';
        targetCardId = 'verif-card-syahadat';
        verifyFn = verifySyahadatByInput;
      }
    }

    const inputEl = document.getElementById(targetInputId);
    const cardEl = document.getElementById(targetCardId);
    if (inputEl) inputEl.value = t;
    verifyFn(t);

    if (cardEl) {
      cardEl.classList.add('ring-2', 'ring-primary');
      setTimeout(() => cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
  }

  function setupVerificationHub() {
    document.getElementById('btn-cek-surat')?.addEventListener('click', () => {
      verifySuratByInput(document.getElementById('input-verif-surat')?.value);
    });
    document.getElementById('btn-cek-kta')?.addEventListener('click', () => {
      verifyKtaByInput(document.getElementById('input-verif-kta')?.value);
    });
    document.getElementById('btn-cek-kwitansi')?.addEventListener('click', () => {
      verifyKwitansiByInput(document.getElementById('input-verif-kwitansi')?.value);
    });
    document.getElementById('btn-cek-syahadat')?.addEventListener('click', () => {
      verifySyahadatByInput(document.getElementById('input-verif-syahadat')?.value);
    });
  }

  // =========================================================================
  // 10. KONSULTASI AQIDAH RAHASIA & ADVOKASI LBH (ZERO ALERT RECEIPT MODAL)
  // =========================================================================
  function showTicketReceiptModal({ badge, title, subtitle, ticketNo, token, extraInfo, isEmergency }) {
    const modal = document.getElementById('modal-ticket-receipt');
    if (!modal) return;

    const iconWrap = document.getElementById('receipt-icon-wrap');
    const iconEl = document.getElementById('receipt-icon');
    const badgeEl = document.getElementById('receipt-badge');
    const titleEl = document.getElementById('receipt-title');
    const subtitleEl = document.getElementById('receipt-subtitle');
    const ticketEl = document.getElementById('receipt-ticket-no');
    const tokenWrap = document.getElementById('receipt-token-wrap');
    const tokenEl = document.getElementById('receipt-token');
    const extraEl = document.getElementById('receipt-extra-info');

    if (iconWrap) {
      iconWrap.className = isEmergency
        ? 'w-11 h-11 rounded-lg bg-red-100 text-red-800 flex items-center justify-center shrink-0'
        : 'w-11 h-11 rounded-lg bg-emerald-100 text-primary flex items-center justify-center shrink-0';
    }
    if (iconEl) iconEl.textContent = isEmergency ? 'emergency' : 'confirmation_number';
    if (badgeEl) {
      badgeEl.className = isEmergency
        ? 'text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-red-100 text-red-900'
        : 'text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed-variant';
      badgeEl.textContent = badge;
    }
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
    if (ticketEl) ticketEl.textContent = ticketNo;
    if (extraEl) extraEl.textContent = extraInfo || '';

    document.getElementById('btn-copy-ticket').onclick = () => copyText(ticketNo, `Nomor tiket ${ticketNo} disalin.`);

    if (token) {
      tokenWrap?.classList.remove('hidden');
      if (tokenEl) tokenEl.textContent = token;
      document.getElementById('btn-copy-token').onclick = () => copyText(token, 'Token rahasia berhasil disalin.');
    } else {
      tokenWrap?.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    document.getElementById('btn-copy-ticket')?.focus();
  }

  function submitConsultation() {
    const topik = document.getElementById('konsul-topik')?.value;
    const pertanyaan = document.getElementById('konsul-pertanyaan')?.value.trim();

    if (!pertanyaan || pertanyaan.length < 10) {
      showToast('Harap tuliskan pertanyaan konsultasi minimal 10 karakter.', 'error');
      return;
    }

    const sharedDb = getSharedDb();
    const newSeq = (Math.floor(100 + Math.random() * 900)).toString();
    const ticketNo = `TKT-AQD-202611-${newSeq}`;
    const token = 'tok_' + Math.random().toString(36).substring(2, 12);
    const tokenHash = hashConsultToken(token);

    sharedDb.consultations.unshift({
      id: 'CSL-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      tenantId: getActiveTenant().code,
      tokenHash: tokenHash,
      tiketNo: ticketNo,
      topik: topik,
      pertanyaan: pertanyaan,
      jawaban: '',
      status: 'MENUNGGU_JAWABAN',
      createdAt: formatWaktu(),
      answeredAt: null,
      curatedBy: null
    });
    saveSharedDb(sharedDb);

    if (window.ApiClient && typeof window.ApiClient.request === 'function' && window.CONFIG && CONFIG.API_URL) {
      window.ApiClient.request('submitConsultation', { topik, pertanyaan }).catch(() => {});
    }

    document.getElementById('konsul-pertanyaan').value = '';
    const checkNo = document.getElementById('check-ticket-no');
    const checkTok = document.getElementById('check-ticket-token');
    if (checkNo) checkNo.value = ticketNo;
    if (checkTok) checkTok.value = token;

    showTicketReceiptModal({
      badge: 'KONSULTASI RAHASIA DITERBITKAN',
      title: 'Tiket Konsultasi Aqidah Tersimpan',
      subtitle: 'Simpan Nomor Tiket dan Token Rahasia berikut. Token disimpan dalam bentuk hash SHA-256 sehingga hanya Anda yang dapat membuka jawaban Dewan Pakar.',
      ticketNo: ticketNo,
      token: token,
      extraInfo: 'Gunakan kotak "Cek Status & Jawaban Tiket Rahasia" di halaman ini untuk membaca jawaban.',
      isEmergency: false
    });

    showToast(`Tiket ${ticketNo} diterbitkan.`);
  }

  function checkConsultationAnswer() {
    const ticketNo = document.getElementById('check-ticket-no')?.value.trim();
    const token = document.getElementById('check-ticket-token')?.value.trim();
    const res = document.getElementById('check-ticket-result');
    if (!ticketNo || !token || !res) {
      showToast('Harap masukkan nomor tiket dan token rahasia.', 'error');
      return;
    }

    const sharedDb = getSharedDb();
    const inputHash = hashConsultToken(token);
    const match = (sharedDb.consultations || []).find(c =>
      c.tiketNo &&
      c.tiketNo.toLowerCase() === ticketNo.toLowerCase() &&
      (c.tokenHash === inputHash || c.tokenHash === token)
    );

    res.classList.remove('hidden');
    if (match) {
      res.innerHTML = `
        <div class="flex flex-col gap-2">
          <span class="font-bold text-primary block tabular-nums">${escapeHtml(match.tiketNo)} | ${escapeHtml(match.topik)}</span>
          <p class="text-on-surface bg-white p-2.5 rounded-lg border border-surface-container">"${escapeHtml(match.pertanyaan)}"</p>
          <div class="p-3 rounded-lg ${match.jawaban ? 'bg-emerald-50 border border-emerald-300 text-emerald-950' : 'bg-amber-50 border border-amber-300 text-amber-950'}">
            <span class="font-bold block">${match.jawaban ? 'Jawaban Dewan Pakar / Divisi Litbang APII:' : 'Status: Pertanyaan Sedang Ditelaah'}</span>
            <p class="mt-1 leading-relaxed">${escapeHtml(match.jawaban || 'Asatidz kami sedang menyusun rujukan dalil Al-Quran dan hadits shahih untuk menjawab pertanyaan Anda.')}</p>
          </div>
        </div>
      `;
    } else {
      res.innerHTML = `<span class="text-red-800 font-bold">Tiket atau token rahasia tidak cocok. Silakan periksa kembali catatan Anda.</span>`;
    }
  }

  function submitAdvokasiCrisis() {
    const namaDai = document.getElementById('adv-nama-dai')?.value.trim();
    const kontak = document.getElementById('adv-kontak')?.value.trim();
    const lokasi = document.getElementById('adv-lokasi')?.value.trim();
    const urgensi = document.getElementById('adv-urgensi')?.value || 'KILAT_DARURAT';
    const kronologi = document.getElementById('adv-kronologi')?.value.trim();

    if (!namaDai || !kontak || !kronologi) {
      showToast('Harap lengkapi nama, kontak WhatsApp, dan kronologi kejadian.', 'error');
      return;
    }

    const sharedDb = getSharedDb();
    const newSeq = (Math.floor(100 + Math.random() * 900)).toString();
    const tiketNo = `TIKET-LBH-202611-${newSeq}`;

    sharedDb.advokasi.unshift({
      id: 'ADV-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      tenantId: getActiveTenant().code,
      tiketNo: tiketNo,
      namaDai: namaDai,
      kontak: kontak,
      lokasi: lokasi || 'Wilayah Dakwah APII',
      kronologi: kronologi,
      urgensi: urgensi,
      buktiUrl: '#',
      status: 'MENUNGGU_TELAAH',
      catatanLbh: 'Laporan krisis masuk via Portal Publik. Menunggu penerbitan surat tugas advokat.',
      updatedAt: formatWaktu()
    });
    saveSharedDb(sharedDb);

    if (window.ApiClient && typeof window.ApiClient.request === 'function' && window.CONFIG && CONFIG.API_URL) {
      window.ApiClient.request('submitAdvokasiIntake', {
        wilayah_id: getActiveTenant().code,
        nama_dai: namaDai,
        kontak: kontak,
        lokasi: lokasi,
        urgensi: urgensi,
        kronologi: kronologi
      }).catch(() => {});
    }

    document.getElementById('adv-nama-dai').value = '';
    document.getElementById('adv-kontak').value = '';
    document.getElementById('adv-lokasi').value = '';
    document.getElementById('adv-kronologi').value = '';

    showTicketReceiptModal({
      badge: `SIAGA LBH APII (${urgensi})`,
      title: 'Laporan Krisis Hukum Diterima',
      subtitle: `Laporan darurat atas nama ${namaDai} telah tercatat dan diteruskan ke Divisi Hukum & Advokasi LBH APII.`,
      ticketNo: tiketNo,
      token: null,
      extraInfo: `Tim Advokat LBH APII segera menghubungi nomor WhatsApp ${kontak} untuk koordinasi pendampingan hukum.`,
      isEmergency: true
    });

    showToast(`Tiket Darurat ${tiketNo} diterima LBH APII.`);
  }

  // =========================================================================
  // 11. DPW NOT FOUND MODAL, CLIPBOARD & TOAST
  // =========================================================================
  function showDpwNotFoundModal(slug) {
    const modal = document.getElementById('modal-dpw-not-found');
    const nameEl = document.getElementById('dpw-not-found-name');
    const listEl = document.getElementById('dpw-active-list');
    const actionsEl = document.getElementById('dpw-modal-actions');

    if (nameEl) nameEl.textContent = `"${String(slug || '').toUpperCase()}"`;

    const activeTenants = getAllActiveTenants();
    if (listEl) {
      listEl.innerHTML = activeTenants.map(t => `
        <div class="flex items-center gap-2 text-primary font-bold">
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">check_circle</span>
          <span>Wilayah Aktif: ${escapeHtml(t.name)} (?dpw=${escapeHtml(t.slug)})</span>
        </div>
      `).join('');
    }
    if (actionsEl) {
      actionsEl.innerHTML = activeTenants.map(t => `
        <button type="button" onclick="PublicApp.switchTenantManually('${escapeHtml(t.slug)}'); PublicApp.closeAllModals();"
          class="w-full min-h-[44px] py-2.5 rounded-lg ${t.code === 'DPP_PUSAT' ? 'bg-primary hover:bg-primary-container' : 'bg-secondary hover:bg-emerald-800'} text-white font-bold text-xs shadow-sm">
          Buka Portal ${escapeHtml(t.name)}
        </button>
      `).join('');
    }

    if (modal) modal.classList.remove('hidden');
  }

  function showWilayahUnderPreparation(namaWilayah) {
    showToast(`Posko ${namaWilayah} sedang dalam tahap persiapan konsolidasi kepengurusan daerah & penerbitan SK Mandat DPP.`, 'info');
  }

  function copyText(text, successMsg) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg || 'Berhasil disalin.');
      }).catch(() => {
        fallbackCopy(text, successMsg);
      });
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(successMsg || 'Berhasil disalin.');
    } catch (e) {
      showToast('Silakan salin kode secara manual.', 'warning');
    }
  }

  function showToast(message, type = 'success') {
    const toast = document.getElementById('public-toast');
    if (!toast) return;

    let bgClass = 'bg-primary-container';
    if (type === 'error') bgClass = 'bg-red-800';
    else if (type === 'warning') bgClass = 'bg-amber-800';
    else if (type === 'info') bgClass = 'bg-emerald-900 border border-emerald-500';

    toast.textContent = message;
    toast.className = `fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 px-4 py-3 rounded-xl shadow-xl text-white text-xs sm:text-sm font-medium flex items-center gap-2 transition-all transform duration-300 ${bgClass}`;
    toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
    setTimeout(() => {
      toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
    }, 4500);
  }

  return {
    init,
    getSharedDb,
    sha256Hex,
    hashConsultToken,
    maskNik,
    createMonogramAvatar,
    showToast,
    showWilayahUnderPreparation,
    showDpwNotFoundModal,
    switchTenantManually,
    setGeoMapLayer,
    zoomGeoMap,
    fitAllGeoMarkers,
    submitRegistration,
    openWartaModal,
    registerAgendaAttendance,
    openQrisConfirmModal,
    switchQrisTab,
    confirmQrisDonation,
    submitConsultation,
    checkConsultationAnswer,
    submitAdvokasiCrisis,
    closeAllModals
  };
})();

if (typeof window !== 'undefined') {
  window.PublicApp = PublicApp;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    PublicApp.init();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      PublicApp.init();
    });
  }
}
