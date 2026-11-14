/**
 * SIAP APII v3.0.0 Enterprise - ShariaGuard.gs
 * Benteng Fiqih Kas & Validasi 4 Kantong Syariah (Zakat, Infaq Dakwah, Wakaf, Amil)
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

var KANTONG_SYARIAH = {
  ZAKAT: 'ZAKAT',
  INFAQ_DAKWAH: 'INFAQ_DAKWAH',
  WAKAF: 'WAKAF',
  AMIL_OPERASIONAL: 'AMIL_OPERASIONAL'
};

/**
 * Validasi Kesesuaian Syariah Pengeluaran Kas (Sharia Guard Validation)
 * Mencegah dana Zakat terpakai untuk operasional umum non-ashnaf
 */
function validateShariaDisbursement(kantongSyariah, kategoriPengeluaran, keperluanText) {
  var kantong = (kantongSyariah || '').toUpperCase();
  var teks = ((kategoriPengeluaran || '') + ' ' + (keperluanText || '')).toLowerCase();

  // 1. Validasi Ketat Kantong Zakat (Hanya untuk 8 Ashnaf: Muallaf, Dai Pedalaman Fi Sabilillah, Fakir/Miskin)
  if (kantong === KANTONG_SYARIAH.ZAKAT) {
    var kataKunciAshnaf = ['muallaf', 'mualaf', 'fakir', 'miskin', 'santunan', 'bantuan dai', 'fi sabilillah', 'fisabilillah', 'ibnu sabil'];
    var lolosAshnaf = false;
    for (var i = 0; i < kataKunciAshnaf.length; i++) {
      if (teks.indexOf(kataKunciAshnaf[i]) !== -1) {
        lolosAshnaf = true;
        break;
      }
    }

    if (!lolosAshnaf) {
      return {
        valid: false,
        error: 'PELANGGARAN SYARIAH: Dana Zakat hanya berhak disalurkan kepada 8 Ashnaf (termasuk Muallaf Care & Bantuan Da\'i Pedalaman). Tidak boleh digunakan untuk operasional kantor, konsumsi rapat, atau pembelian aset umum.'
      };
    }
  }

  // 2. Validasi Kantong Wakaf (Hanya untuk Aset Fisik / Produktif Jangka Panjang)
  if (kantong === KANTONG_SYARIAH.WAKAF) {
    var kataKunciBukanWakaf = ['makan', 'snack', 'bensin', 'pulsa', 'honor', 'gaji'];
    for (var j = 0; j < kataKunciBukanWakaf.length; j++) {
      if (teks.indexOf(kataKunciBukanWakaf[j]) !== -1) {
        return {
          valid: false,
          error: 'PELANGGARAN SYARIAH: Dana Wakaf terikat secara hukum syariat untuk pengadaan aset fisik permanen atau wakaf produktif, bukan biaya konsumtif habis pakai.'
        };
      }
    }
  }

  return { valid: true };
}

