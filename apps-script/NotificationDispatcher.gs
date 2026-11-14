/**
 * SIAP APII v3.0.0 Enterprise - NotificationDispatcher.gs
 * Smart WhatsApp Handover & Request Relay, Notifikasi Internal & Siaran Grup Komunitas
 * 
 * Pengembang: Sigit Adi Irianto (https://sigitadi.id | 0813-5857-5678)
 * Hak Cipta: Yayasan Apologet Islam Indonesia (APII) - SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023
 */

/**
 * Format Nomor Telepon ke Standar Internasional E.164 Indonesia (+628...)
 */
function formatE164(phoneStr) {
  var clean = (phoneStr || '').replace(/[^\d+]/g, '');
  if (clean.indexOf('+62') === 0) return clean;
  if (clean.indexOf('62') === 0) return '+' + clean;
  if (clean.indexOf('08') === 0) return '+628' + clean.substring(2);
  return clean;
}

/**
 * Generator Naskah Berita WhatsApp Handover & Request Relay (Internal Antar-Pengurus)
 */
function buildWhatsAppHandoverMsg(tipe, payload) {
  var baseUrl = 'https://apologetislamindonesia.or.id/portal';

  // 1. Estafet Persuratan Dinas
  if (tipe === 'DRAF_SURAT_SELESAI') {
    return 'Bismillah. *YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n\n' +
      '📢 *LAPORAN ESTAFET PERSURATAN DINAS*\n' +
      '• Perihal: ' + (payload.perihal || 'Surat Dinas') + '\n' +
      '• Konseptor: Sekretaris (' + (payload.sekretaris || 'Sekretariat') + ')\n' +
      '• Tanggal: ' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy') + '\n\n' +
      'Permintaan: Mohon Ketua berkenan menelaah dan mengesahkan naskah dinas resmi di portal pengurus:\n' +
      baseUrl + '/#/surat/' + (payload.suratId || '') + '\n\n' +
      'Jazakumullahu khairan.';
  }

  // 2. Estafet Disposisi Surat Masuk
  if (tipe === 'DISPOSISI_TERBIT') {
    return 'Bismillah. *YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n\n' +
      '📥 *INSTRUKSI DISPOSISI RESMI PIMPINAN*\n' +
      '• No. Agenda: ' + (payload.noAgenda || '') + '\n' +
      '• Asal Surat: ' + (payload.asalSurat || '') + '\n' +
      '• Divisi Dituju: ' + (payload.divisiTujuan || '').toUpperCase() + '\n' +
      '• Instruksi Ketua: ' + (payload.instruksi || '') + '\n' +
      '• Batas Waktu: ' + (payload.batasWaktu || 'Segera') + '\n\n' +
      'Permintaan: Mohon Ketua Divisi segera menindaklanjuti dan mengunggah laporan hasil di portal:\n' +
      baseUrl + '/#/disposisi\n\n' +
      'Jazakumullahu khairan.';
  }

  // 3. Estafet Verifikasi Kas Keluar (Dual-Approval)
  if (tipe === 'KAS_VERIFIKASI_KETUM') {
    return 'Bismillah. *YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n\n' +
      '💰 *PERMOHONAN PENCAIRAN KAS (TAHAP 2)*\n' +
      '• No. Voucher: ' + (payload.noVoucher || '') + '\n' +
      '• Nominal: Rp ' + (payload.nominal || '0') + '\n' +
      '• Pos Kantong: ' + (payload.kantongSyariah || '') + '\n' +
      '• Keperluan: ' + (payload.keperluan || '') + '\n' +
      '• Status: Telah diverifikasi kelayakan nota oleh Bendahara.\n\n' +
      'Permintaan: Mohon Ketua berkenan mengesahkan pencairan dana di portal pengurus:\n' +
      baseUrl + '/#kas\n\n' +
      'Jazakumullahu khairan.';
  }

  // 4. Pendaftaran Anggota Baru (MURNI INTERNAL ANTAR-PENGURUS)
  if (tipe === 'PENDAFTAR_BARU_INTERNAL') {
    return 'Bismillah. *YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n\n' +
      '👤 *PEMBERITAHUAN INTERNAL: PENDAFTAR ANGGOTA BARU*\n' +
      '• Nama: ' + (payload.nama || '') + '\n' +
      '• Wilayah Minat: ' + (payload.wilayah || '') + '\n' +
      '• Waktu Daftar: ' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm') + ' WIB\n\n' +
      'Permintaan: Mohon Sekretaris memeriksa kelayakan berkas foto KTP ber-watermark UU PDP di meja seleksi:\n' +
      baseUrl + '/#/keanggotaan\n\n' +
      '*(Catatan: Notifikasi ini rahasia dan hanya beredar antar-pengurus)*';
  }

  // 5. Siaran Informasi Komunitas (Warta & Agenda ke Grup WhatsApp APII)
  if (tipe === 'BROADCAST_AGENDA_KOMUNITAS') {
    return 'Bismillah. *YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n' +
      '📢 *[AGENDA DAKWAH & KAJIAN ILMIAH RESMI]*\n\n' +
      '• Judul Kajian: ' + (payload.judul || '') + '\n' +
      '• Pemateri: ' + (payload.pemateri || 'Dewan Pakar APII') + '\n' +
      '• Hari / Tanggal: ' + (payload.tanggal || '') + '\n' +
      '• Waktu: ' + (payload.waktu || 'Ba\'da Isya s/d Selesai') + '\n' +
      '• Tempat / Link: ' + (payload.lokasi || '') + '\n' +
      '• Sifat: Terbuka untuk Umum / 100% Gratis\n\n' +
      'Konfirmasi Kehadiran & Unduh Maklumat Resmi:\n' +
      'https://apologetislamindonesia.or.id/#/agenda\n\n' +
      'Barakallahu fiikum. Sebarkan kebaikan dakwah ini.';
  }

  return 'Bismillah. Laporan SIAP APII: ' + JSON.stringify(payload);
}

/**
 * Pembangkit URI wa.me Siap Klik
 */
function createWhatsAppClickUri(phoneStr, messageText) {
  var cleanPhone = formatE164(phoneStr).replace('+', '');
  return 'https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent(messageText);
}

