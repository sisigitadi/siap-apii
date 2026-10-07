/**
 * ============================================================================
 * app.js — Logika Frontend Portal Publik (apii.sigit.id)
 * ============================================================================
 * Pola Module (IIFE). Semua logika publik di sini: mobile nav, verifikasi
 * surat, daftar dokumen resmi, daftar divisi. Tidak ada autentikasi.
 * ==========================================================================*/
(function () {
  'use strict';

  var Public = {
    state: {
      ktpBase64: '',
      selfieBase64: ''
    },

    init: function () {
      this.bindMobileNav();
      this.bindRegistrationForm();
      this.renderDivisions();
    },

    // ---------------------------------------------------------------
    // PENDAFTARAN ANGGOTA & WATERMARK KTP CANVAS
    // ---------------------------------------------------------------
    bindRegistrationForm: function () {
      var self = this;
      var form = document.getElementById('regMemberForm');
      var ktpInput = document.getElementById('regKtpInput');
      var selfieInput = document.getElementById('regSelfieInput');
      var btnHapusKtp = document.getElementById('btnHapusKtp');
      var btnHapusSelfie = document.getElementById('btnHapusSelfie');
      var closeReceiptBtn = document.getElementById('closeReceiptBtn');
      var receiptModal = document.getElementById('regReceiptModal');

      if (!form) return;

      if (closeReceiptBtn && receiptModal) {
        closeReceiptBtn.addEventListener('click', function () {
          receiptModal.classList.add('hidden');
        });
      }

      // KTP Handler with HTML5 Canvas auto-watermark
      if (ktpInput) {
        ktpInput.addEventListener('change', function (e) {
          var file = e.target.files && e.target.files[0];
          if (!file) return;
          self.processKtpWatermark(file);
        });
      }

      if (btnHapusKtp) {
        btnHapusKtp.addEventListener('click', function () {
          self.state.ktpBase64 = '';
          if (ktpInput) ktpInput.value = '';
          var box = document.getElementById('ktpPreviewBox');
          if (box) box.classList.add('hidden');
          var img = document.getElementById('ktpPreviewImg');
          if (img) img.src = '';
        });
      }

      // Selfie Handler
      if (selfieInput) {
        selfieInput.addEventListener('change', function (e) {
          var file = e.target.files && e.target.files[0];
          if (!file) return;
          self.processSelfie(file);
        });
      }

      if (btnHapusSelfie) {
        btnHapusSelfie.addEventListener('click', function () {
          self.state.selfieBase64 = '';
          if (selfieInput) selfieInput.value = '';
          var box = document.getElementById('selfiePreviewBox');
          if (box) box.classList.add('hidden');
          var img = document.getElementById('selfiePreviewImg');
          if (img) img.src = '';
        });
      }

      // Submit Form
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        self.submitRegistration();
      });
    },

    processKtpWatermark: function (file) {
      var self = this;
      var reader = new FileReader();
      reader.onload = function (evt) {
        var img = new Image();
        img.onload = function () {
          // Scale to max width 1280px maintaining aspect ratio
          var maxW = 1280;
          var w = img.width;
          var h = img.height;
          if (w > maxW) {
            h = Math.round((h * maxW) / w);
            w = maxW;
          }
          var canvas = document.getElementById('ktpCanvas') || document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');

          // Draw original image
          ctx.drawImage(img, 0, 0, w, h);

          // Semi-transparent diagonal watermarking
          ctx.save();
          var dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
          var wmLine1 = 'ARSIP PENDAFTARAN APII DPW JABODETABEK - ' + dateStr;
          var wmLine2 = 'HANYA UNTUK VERIFIKASI KEANGGOTAAN RESMI (UU PDP NO. 27/2022)';

          // Rotate canvas for diagonal pattern
          var fontSize = Math.max(16, Math.round(w / 30));
          ctx.font = 'bold ' + fontSize + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          var diagDist = Math.sqrt(w * w + h * h);
          var step = fontSize * 4.2;

          // Draw multiple diagonal stripes
          ctx.translate(w / 2, h / 2);
          ctx.rotate(-28 * Math.PI / 180);

          for (var y = -diagDist; y <= diagDist; y += step) {
            ctx.fillStyle = 'rgba(220, 38, 38, 0.42)'; // Stamped red security watermark
            ctx.fillText(wmLine1, 0, y);
            ctx.font = 'bold ' + Math.round(fontSize * 0.72) + 'px sans-serif';
            ctx.fillStyle = 'rgba(2, 44, 34, 0.40)';
            ctx.fillText(wmLine2, 0, y + fontSize * 1.1);
            ctx.font = 'bold ' + fontSize + 'px sans-serif';
          }
          ctx.restore();

          // Bottom protection banner
          var bannerH = Math.max(32, Math.round(h * 0.075));
          ctx.fillStyle = 'rgba(4, 120, 87, 0.88)';
          ctx.fillRect(0, h - bannerH, w, bannerH);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold ' + Math.max(12, Math.round(bannerH * 0.45)) + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('APII DPW JABODETABEK • TERPROTEKSI WATERMARK DIGITAL • ' + dateStr, w / 2, h - (bannerH / 2));

          // Export compressed JPEG
          var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          self.state.ktpBase64 = dataUrl;

          var previewImg = document.getElementById('ktpPreviewImg');
          var previewBox = document.getElementById('ktpPreviewBox');
          if (previewImg) previewImg.src = dataUrl;
          if (previewBox) previewBox.classList.remove('hidden');
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    },

    processSelfie: function (file) {
      var self = this;
      var reader = new FileReader();
      reader.onload = function (evt) {
        var img = new Image();
        img.onload = function () {
          var maxDim = 800;
          var w = img.width;
          var h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          self.state.selfieBase64 = dataUrl;

          var previewImg = document.getElementById('selfiePreviewImg');
          var previewBox = document.getElementById('selfiePreviewBox');
          if (previewImg) previewImg.src = dataUrl;
          if (previewBox) previewBox.classList.remove('hidden');
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    },

    submitRegistration: function () {
      var self = this;
      var alertBox = document.getElementById('regAlertBox');
      var submitBtn = document.getElementById('regSubmitBtn');

      var fullName = (document.getElementById('regFullName').value || '').trim();
      var nik = (document.getElementById('regNik').value || '').trim();
      var genderElem = document.querySelector('input[name="regGender"]:checked');
      var gender = genderElem ? genderElem.value : 'L';
      var birthPlace = (document.getElementById('regBirthPlace').value || '').trim();
      var birthDate = (document.getElementById('regBirthDate').value || '').trim();
      var phone = (document.getElementById('regPhone').value || '').trim();
      var email = (document.getElementById('regEmail').value || '').trim();
      var job = (document.getElementById('regJob').value || '').trim();
      var division = (document.getElementById('regDivision').value || '').trim();
      var address = (document.getElementById('regAddress').value || '').trim();
      var agreement = document.getElementById('regAgreement').checked;

      function showAlert(msg, isErr) {
        if (!alertBox) return;
        alertBox.className = 'mt-4 p-4 rounded-xl text-sm font-semibold ' +
          (isErr ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200');
        alertBox.innerHTML = msg;
        alertBox.classList.remove('hidden');
      }

      if (!fullName) return showAlert('Mohon isi Nama Lengkap sesuai KTP.', true);
      if (!nik || nik.length !== 16 || !/^\d+$/.test(nik)) return showAlert('Nomor NIK KTP harus terdiri dari 16 digit angka.', true);
      if (!phone) return showAlert('Nomor WhatsApp aktif wajib diisi.', true);
      if (!self.state.ktpBase64) return showAlert('Foto KTP wajib diunggah untuk verifikasi identitas resmi.', true);
      if (!self.state.selfieBase64) return showAlert('Pas Foto / Selfie wajib diunggah untuk pencocokan wajah.', true);
      if (!agreement) return showAlert('Anda harus menyetujui pernyataan keabsahan data dan AD/ART.', true);

      if (alertBox) alertBox.classList.add('hidden');

      var originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> <span>Mengirim berkas pendaftaran...</span>';
      }

      var fullPhone = phone.startsWith('0') ? '62' + phone.slice(1) : (phone.startsWith('+62') ? phone.slice(1) : (phone.startsWith('62') ? phone : '62' + phone));

      var payload = {
        full_name: fullName,
        nik: nik,
        gender: gender,
        birth_place: birthPlace,
        birth_date: birthDate,
        phone: fullPhone,
        email: email,
        job: job,
        division_interest: division,
        address: address,
        ktp_base64: self.state.ktpBase64,
        selfie_base64: self.state.selfieBase64
      };

      self.post('registerAnggota', payload).then(function (res) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHtml;
        }
        if (res && res.success) {
          var receiptData = {};
          for (var k in payload) receiptData[k] = payload[k];
          if (res.data) { for (var k2 in res.data) receiptData[k2] = res.data[k2]; }
          self.showRegistrationReceipt(receiptData);
          document.getElementById('regMemberForm').reset();
          self.state.ktpBase64 = '';
          self.state.selfieBase64 = '';
          var ktpBox = document.getElementById('ktpPreviewBox');
          if (ktpBox) ktpBox.classList.add('hidden');
          var selfieBox = document.getElementById('selfiePreviewBox');
          if (selfieBox) selfieBox.classList.add('hidden');
        } else {
          showAlert((res && res.message) || 'Gagal mengirim pendaftaran. Coba beberapa saat lagi.', true);
        }
      }).catch(function (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHtml;
        }
        showAlert('Terjadi kesalahan jaringan: ' + (err && err.message ? err.message : 'Silakan coba lagi.'), true);
      });
    },

    showRegistrationReceipt: function (data) {
      var modal = document.getElementById('regReceiptModal');
      var content = document.getElementById('receiptContent');
      var waBtn = document.getElementById('receiptWaBtn');
      if (!modal || !content) return;

      var regNum = data.reg_number || 'REG-' + new Date().getFullYear() + '-0000';
      var maskedNik = data.nik ? data.nik.slice(0, 4) + '********' + data.nik.slice(12) : '3171********0001';
      var dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

      content.innerHTML = '' +
        '<div class="text-center pb-4 border-b border-gray-100">' +
          '<div class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Nomor Registrasi Anda</div>' +
          '<div class="text-2xl font-black text-emerald font-mono bg-emerald-light/40 py-2 px-4 rounded-xl inline-block border border-emerald/20">' + this.esc(regNum) + '</div>' +
          '<div class="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">' +
            '<span class="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>' +
            'MENUNGGU VERIFIKASI SEKRETARIAT' +
          '</div>' +
        '</div>' +
        '<div class="grid grid-cols-2 gap-3 text-xs">' +
          '<div><div class="text-gray-400 font-bold uppercase">Nama Pendaftar</div><div class="font-extrabold text-gray-800 text-sm mt-0.5">' + this.esc(data.full_name) + '</div></div>' +
          '<div><div class="text-gray-400 font-bold uppercase">NIK Terlindungi</div><div class="font-bold text-gray-700 text-sm font-mono mt-0.5">' + this.esc(maskedNik) + '</div></div>' +
          '<div><div class="text-gray-400 font-bold uppercase">Minat Divisi</div><div class="font-bold text-gray-700 mt-0.5">' + this.esc(data.division_interest || 'Umum') + '</div></div>' +
          '<div><div class="text-gray-400 font-bold uppercase">Waktu Pengajuan</div><div class="font-medium text-gray-600 mt-0.5">' + this.esc(dateStr) + ' WIB</div></div>' +
        '</div>' +
        '<div class="bg-gray-50 rounded-2xl p-4 text-xs text-gray-600 border border-gray-200 leading-relaxed">' +
          '<strong>Langkah Selanjutnya:</strong><br>' +
          '1. Berkas KTP ber-watermark Anda sedang ditinjau oleh Sekretariat DPW.<br>' +
          '2. Klik tombol di bawah untuk konfirmasi ke WhatsApp Pengurus agar proses verifikasi lebih cepat.' +
        '</div>';

      var waMsg = encodeURIComponent(
        'Assalamu’alaikum / Halo Sekretariat APII DPW Jabodetabek,\n\n' +
        'Saya telah mendaftar sebagai calon anggota baru:\n' +
        '• No. Registrasi: ' + regNum + '\n' +
        '• Nama: ' + data.full_name + '\n' +
        '• Divisi: ' + (data.division_interest || 'Umum') + '\n\n' +
        'Mohon konfirmasi dan verifikasi berkas pendaftaran saya. Terima kasih.'
      );
      if (waBtn) {
        waBtn.href = 'https://wa.me/6281283626100?text=' + waMsg;
      }

      modal.classList.remove('hidden');
    },



    // ---------------------------------------------------------------
    // DIVISI KERJA (statis 7 divisi sesuai sistem)
    // ---------------------------------------------------------------
    renderDivisions: function () {
      var grid = document.getElementById('divisiGrid');
      if (!grid) return;

      var icons = {
        'Hubungan Masyarakat': 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
        'Penelitian & Pengembangan': 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
        'Media Sosial': 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
        'Dakwah': 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
        'Investasi': 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
        'Hukum': 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
        'Umum': 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
      };

      var divisions = ['Hubungan Masyarakat', 'Penelitian & Pengembangan', 'Media Sosial',
        'Dakwah', 'Investasi', 'Hukum', 'Umum'];

      grid.innerHTML = divisions.map(function (name) {
        var icon = icons[name] || icons['Umum'];
        return '' +
          '<div class="divisi-card bg-white rounded-2xl shadow-sm border-2 border-gray-100 p-6 text-center">' +
            '<div class="h-14 w-14 bg-emerald-light rounded-2xl flex items-center justify-center mx-auto mb-4">' +
              '<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="' + icon + '" /></svg>' +
            '</div>' +
            '<h3 class="font-bold text-emerald-dark text-base">' + name + '</h3>' +
            '<p class="text-xs text-gray-500 mt-2">Mengusulkan program kerja melalui Approval Board Ketua.</p>' +
          '</div>';
      }).join('');
    },

    /** Escape HTML untuk mencegah XSS dari data backend. */
    esc: function (str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    },
  };

  window.Public = Public;
  document.addEventListener('DOMContentLoaded', function () { Public.init(); });
})();
