/**
 * SIAP APII v3.0.0 Enterprise - TemplateSuratDocs.gs
 * Spesifikasi Layout Virtual A4, KOP Dinamis DPP/DPW & Stempel Basah Transparan Multiply
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Metadata KOP Surat Resmi DPP & DPW se-Indonesia
 */
function getKopMetadata(wilayahId) {
  var wilayahRow = dbFindOne('Sheet_Wilayah', { id: wilayahId });
  var isDPP = !wilayahId || wilayahId === 'DPP_PUSAT';

  if (isDPP) {
    return {
      tingkat: 'DEWAN PIMPINAN PUSAT',
      namaLembaga: 'YAYASAN APOLOGET ISLAM INDONESIA (APII)',
      legalitas: 'SK Kemenkumham RI: Nomor AHU-0014970.AH.01.04.Tahun 2023',
      alamat: 'Gedung Dakwah Pusat APII, Jakarta, Indonesia',
      kontak: 'Email: dpp@apologetislamindonesia.or.id | Website: apologetislamindonesia.or.id',
      kodeSuratTenant: 'DPP-APII',
      kotaKop: 'Jakarta'
    };
  } else {
    var namaWilayah = wilayahRow ? wilayahRow[COL_WILAYAH.NAMA] : 'Wilayah';
    var kodeTenant = wilayahRow ? wilayahRow[COL_WILAYAH.KODE] : 'DPW';
    var alamatWilayah = wilayahRow ? wilayahRow[COL_WILAYAH.ALAMAT] : 'Sekretariat DPW APII';
    return {
      tingkat: 'DEWAN PIMPINAN WILAYAH (' + namaWilayah.toUpperCase() + ')',
      namaLembaga: 'YAYASAN APOLOGET ISLAM INDONESIA (APII)',
      legalitas: 'SK Kemenkumham RI: Nomor AHU-0014970.AH.01.04.Tahun 2023',
      alamat: alamatWilayah,
      kontak: 'Website: ' + (wilayahRow ? wilayahRow[COL_WILAYAH.SLUG] : 'dpw') + '.apologetislamindonesia.or.id',
      kodeSuratTenant: kodeTenant,
      kotaKop: namaWilayah.replace('DPW ', '')
    };
  }
}

/**
 * Konversi Bulan Integer (1-12) ke Format Romawi Baku Naskah Dinas Indonesia
 */
function toRomanMonth(monthNum) {
  var roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return roman[monthNum] || 'I';
}

/**
 * Struktur Konsideran Baku Surat Keputusan (SK) Pengesahan Kepengurusan
 */
function getKonsideranSKStruktur(wilayahNama, periodeTahun) {
  return {
    menimbang: [
      'Bahwa demi terwujudnya kesinambungan dakwah apologetika Islam yang berkesinambungan, transparan, dan akuntabel di tingkat ' + wilayahNama + ', dipandang perlu mengesahkan susunan kepengurusan definitif.',
      'Bahwa personil yang namanya tercantum dalam lampiran keputusan ini dipandang cakap, amanah, dan memenuhi syarat untuk memangku amanah kepengurusan organisasi.'
    ],
    mengingat: [
      'Undang-Undang Republik Indonesia Nomor 28 Tahun 2004 tentang Perubahan atas Undang-Undang Nomor 16 Tahun 2001 tentang Yayasan.',
      'Keputusan Menteri Hukum dan Hak Asasi Manusia Republik Indonesia Nomor AHU-0014970.AH.01.04.Tahun 2023.',
      'Anggaran Dasar dan Anggaran Rumah Tangga (AD/ART) Yayasan Apologet Islam Indonesia.'
    ],
    memperhatikan: [
      'Hasil musyawarah mufakat pimpinan dan kader tertanggal ' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd MMMM yyyy') + '.'
    ],
    memutuskan: [
      'Mengesahkan Susunan Pengurus ' + wilayahNama + ' Masa Bakti ' + (periodeTahun || '2026-2031') + ' sebagaimana tercantum dalam lampiran yang merupakan bagian tidak terpisahkan dari keputusan ini.',
      'Surat Keputusan ini berlaku sejak tanggal ditetapkan dengan ketentuan apabila terdapat kekeliruan di kemudian hari akan diadakan perbaikan sebagaimana mestinya.'
    ]
  };
}

