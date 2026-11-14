/**
 * SIAP APII v3.0.0 Enterprise - KwitansiEngine.gs
 * Generator Kwitansi Kas Dual-Slip (30% Bonggol : 70% Donatur) & Formula Terbilang Rupiah
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Formula Rekursif Terbilang Baku Bahasa Indonesia
 * Menangani angka dari satuan hingga miliaran Rupiah secara akurat
 */
function angkaKeTerbilang(nominal) {
  var bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  var n = Math.floor(Math.abs(Number(nominal) || 0));

  if (n === 0) return 'Nol Rupiah';

  function konversi(num) {
    if (num < 12) {
      return ' ' + bilangan[num];
    } else if (num < 20) {
      return konversi(num - 10) + ' Belas';
    } else if (num < 100) {
      return konversi(Math.floor(num / 10)) + ' Puluh' + konversi(num % 10);
    } else if (num < 200) {
      return ' Seratus' + konversi(num - 100);
    } else if (num < 1000) {
      return konversi(Math.floor(num / 100)) + ' Ratus' + konversi(num % 100);
    } else if (num < 2000) {
      return ' Seribu' + konversi(num - 1000);
    } else if (num < 1000000) {
      return konversi(Math.floor(num / 1000)) + ' Ribu' + konversi(num % 1000);
    } else if (num < 1000000000) {
      return konversi(Math.floor(num / 1000000)) + ' Juta' + konversi(num % 1000000);
    } else if (num < 1000000000000) {
      return konversi(Math.floor(num / 1000000000)) + ' Milyar' + konversi(num % 1000000000);
    } else {
      return konversi(Math.floor(num / 1000000000000)) + ' Triliun' + konversi(num % 1000000000000);
    }
  }

  var hasil = konversi(n).trim() + ' Rupiah';
  // Rapikan spasi ganda
  return hasil.replace(/\s+/g, ' ');
}

/**
 * Format Angka Rupiah Resmi
 * Contoh: Rp 2.500.000,-
 */
function formatRupiah(nominal) {
  var num = Number(nominal) || 0;
  var str = num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  return 'Rp ' + str + ',-';
}

/**
 * Metadata Kwitansi Dual-Slip Resmi APII
 */
function buildKwitansiData(keuanganRow, wilayahId) {
  var kop = getKopMetadata(wilayahId);
  var nominal = Number(keuanganRow[COL_KEUANGAN.NOMINAL]) || 0;

  return {
    lembaga: kop.namaLembaga,
    legalitas: kop.legalitas,
    tingkatWilayah: kop.tingkat,
    alamat: kop.alamat,
    noVoucher: keuanganRow[COL_KEUANGAN.NO_VOUCHER],
    noKwitansi: keuanganRow[COL_KEUANGAN.NO_KWITANSI],
    tipe: keuanganRow[COL_KEUANGAN.TIPE], // KAS_MASUK atau KAS_KELUAR
    kantongSyariah: keuanganRow[COL_KEUANGAN.KANTONG_SYARIAH],
    kategori: keuanganRow[COL_KEUANGAN.KATEGORI],
    nominalAngka: formatRupiah(nominal),
    nominalTerbilang: angkaKeTerbilang(nominal),
    tanggal: keuanganRow[COL_KEUANGAN.TANGGAL],
    keterangan: keuanganRow[COL_KEUANGAN.KETERANGAN],
    verifikatorBendahara: keuanganRow[COL_KEUANGAN.VERIFIED_BENDAHARA_BY],
    pengesahKetua: keuanganRow[COL_KEUANGAN.APPROVED_KETUA_BY]
  };
}

