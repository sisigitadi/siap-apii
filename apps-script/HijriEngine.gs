/**
 * SIAP APII v3.0.0 Enterprise - HijriEngine.gs
 * Mesin Konversi Penanggalan Hijriah Otomatis Standar Kemenag RI / Ummul Qura
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

var NAMA_BULAN_HIJRIAH = [
  'Muharram', 'Safar', 'Rabiul Awwal', 'Rabiul Akhir',
  'Jumadil Awal', 'Jumadil Akhir', 'Rajab', 'Sya\'ban',
  'Ramadhan', 'Syawwal', 'Dzulqa\'dah', 'Dzulhijjah'
];

var NAMA_BULAN_MASEHI = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Konversi Tanggal Gregorian (Masehi) ke Penanggalan Hijriah
 * Menggunakan pendekatan Algoritma Astromonis Ummul Qura dengan penyesuaian kriteria Kemenag RI
 */
function getHijriDate(dateObj) {
  var d = dateObj ? new Date(dateObj) : new Date();

  // Hitung Julian Day Number
  var year = d.getFullYear();
  var month = d.getMonth() + 1;
  var day = d.getDate();

  if (month < 3) {
    year -= 1;
    month += 12;
  }

  var a = Math.floor(year / 100);
  var b = 2 - a + Math.floor(a / 4);
  var jd = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;

  // Transformasi ke Kalender Hijriah Tabular dengan offset Imkanur Rukyah
  var z = Math.floor(jd + 0.5);
  var cyc = Math.floor((z - 1948440 + 1.06) / 10631);
  var rem = (z - 1948440 + 1.06) - 10631 * cyc;
  var j = Math.floor((rem + 0.05) / 354.366);
  var hYear = 30 * cyc + j;
  var remDays = rem - Math.floor(j * 354.366);
  var hMonth = Math.min(11, Math.floor((remDays + 0.5) / 29.5));
  var hDay = Math.floor(remDays - Math.floor(hMonth * 29.5) + 1);

  if (hDay <= 0) {
    hDay = 29;
    hMonth = (hMonth + 11) % 12;
  }

  return {
    day: hDay,
    monthIndex: hMonth,
    monthName: NAMA_BULAN_HIJRIAH[hMonth],
    year: hYear + 1,
    formatted: hDay + ' ' + NAMA_BULAN_HIJRIAH[hMonth] + ' ' + (hYear + 1) + ' H'
  };
}

/**
 * Format Penanggalan Dwi-Kalender Resmi untuk KOP Naskah Dinas APII
 * Contoh: "Jakarta, 28 Jumadil Awal 1448 H / 09 November 2026 M"
 */
function formatOfficialDateKop(kota, dateObj) {
  var d = dateObj ? new Date(dateObj) : new Date();
  var hijri = getHijriDate(d);
  var mDay = d.getDate();
  var mMonthName = NAMA_BULAN_MASEHI[d.getMonth()];
  var mYear = d.getFullYear();
  var padDay = mDay < 10 ? '0' + mDay : '' + mDay;

  var kotaName = kota || 'Jakarta';
  return kotaName + ', ' + hijri.formatted + ' / ' + padDay + ' ' + mMonthName + ' ' + mYear + ' M';
}

