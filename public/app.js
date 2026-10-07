/**
 * ============================================================================
 * app.js — Logika Frontend Portal Publik (apii.sigitadi.id)
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
      this.loadPublicSurat();
      this.loadPublicAccounts();
    },

    bindMobileNav: function () {
      var btn = document.getElementById('mobileToggle');
      var menu = document.getElementById('mobileMenu');
      if (!btn || !menu) return;
      btn.addEventListener('click', function () {
        menu.classList.toggle('hidden');
      });
      var links = document.querySelectorAll('.mobile-link');
      for (var i = 0; i < links.length; i++) {
        links[i].addEventListener('click', function () {
          menu.classList.add('hidden');
        });
      }
    },

    get: function (action, params) {
      var base = window.API_BASE || '';
      var url = new URL(base);
      url.searchParams.set('action', action);
      if (params) {
        Object.keys(params).forEach(function (k) {
          url.searchParams.set(k, params[k]);
        });
      }
      return fetch(url.toString(), { redirect: 'follow' })
        .then(function (r) { return r.json(); });
    },

    post: function (action, payload) {
      var base = window.API_BASE || '';
      return fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: action, payload: payload || {} }),
        redirect: 'follow'
      }).then(function (r) { return r.json(); });
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
    // ARSIP SURAT & DOKUMEN RESMI PUBLIK
    // ---------------------------------------------------------------
    loadPublicSurat: function () {
      var self = this;
      var loadingEl = document.getElementById('loadingSurat');
      var listEl = document.getElementById('publicSuratList');
      var emptyEl = document.getElementById('emptySurat');
      if (!listEl) return;

      this.get('getPublishedSurat', { limit: 8 }).then(function (res) {
        if (loadingEl) loadingEl.classList.add('hidden');
        if (res && res.success && res.data && res.data.items && res.data.items.length) {
          listEl.innerHTML = res.data.items.map(function (s) {
            return '' +
              '<div class="p-4 rounded-2xl bg-gray-50/80 hover:bg-emerald-50/50 border border-gray-200/90 hover:border-emerald-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">' +
                '<div class="flex-1">' +
                  '<div class="flex items-center gap-2 mb-1">' +
                    '<span class="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">' + self.esc(s.letter_type_label || s.letter_type) + '</span>' +
                    '<span class="text-xs text-gray-400 font-medium">' + self.esc(s.tanggal_label || '') + '</span>' +
                  '</div>' +
                  '<h4 class="font-bold text-gray-900 text-sm leading-snug">' + self.esc(s.title) + '</h4>' +
                  '<div class="text-xs text-gray-500 font-mono mt-0.5 break-all">' + self.esc(s.letter_number) + '</div>' +
                '</div>' +
                '<div class="sm:flex-shrink-0">' +
                  (s.pdf_url ?
                    '<a href="' + self.esc(s.pdf_url) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald hover:bg-emerald-dark text-white px-3.5 py-2 rounded-xl shadow-xs transition">' +
                      '<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' +
                      '<span>Unduh PDF</span>' +
                    '</a>' :
                    '<span class="text-[11px] font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg">Arsip Fisik</span>') +
                '</div>' +
              '</div>';
          }).join('');
          listEl.classList.remove('hidden');
        } else {
          if (emptyEl) emptyEl.classList.remove('hidden');
        }
      }).catch(function () {
        if (loadingEl) loadingEl.classList.add('hidden');
        if (emptyEl) emptyEl.classList.remove('hidden');
      });
    },

    // ---------------------------------------------------------------
    // REKENING KEUANGAN RESMI YAYASAN
    // ---------------------------------------------------------------
    loadPublicAccounts: function () {
      var self = this;
      var container = document.getElementById('publicAccountList');
      if (!container) return;

      this.get('getPublicAccounts').then(function (res) {
        if (res && res.success && res.data && res.data.length) {
          container.innerHTML = res.data.map(function (acc) {
            var isBsi = /BSI|Syariah/i.test(acc.bank_name || acc.name);
            var colorBg = isBsi ? 'from-emerald-50/70 to-teal-50/40 border-emerald-200' : 'from-amber-50/70 to-orange-50/40 border-amber-200';
            var colorBadge = isBsi ? 'text-emerald-700 bg-emerald-100/70' : 'text-amber-800 bg-amber-100/70';
            var colorBtn = isBsi ? 'text-emerald-800 border-emerald-300 hover:bg-emerald-100' : 'text-amber-900 border-amber-300 hover:bg-amber-100';

            return '' +
              '<div class="p-4 rounded-2xl bg-gradient-to-br ' + colorBg + ' border">' +
                '<div class="flex items-center justify-between mb-2">' +
                  '<span class="text-xs font-black text-gray-900 uppercase tracking-wider">' + self.esc(acc.bank_name || acc.name) + '</span>' +
                  '<span class="text-[10px] font-bold ' + colorBadge + ' px-2.5 py-0.5 rounded-full">' + self.esc(acc.category || 'Operasional DPW') + '</span>' +
                '</div>' +
                '<div class="flex items-center justify-between gap-2 mt-1">' +
                  '<div class="text-xl font-extrabold font-mono text-gray-900 tracking-wider">' + self.esc(acc.account_number) + '</div>' +
                  '<button type="button" onclick="navigator.clipboard.writeText(\'' + self.esc(acc.account_number) + '\'); window.Public && window.Public.showToast(\'Nomor rekening berhasil disalin!\');" ' +
                          'class="text-xs font-bold bg-white ' + colorBtn + ' px-3 py-1.5 rounded-xl border shadow-xs transition">' +
                    'Salin' +
                  '</button>' +
                '</div>' +
                '<div class="text-xs text-gray-600 mt-2 font-medium">a.n. <strong>' + self.esc(acc.holder_name || 'YAYASAN APII DPW JABODETABEK') + '</strong></div>' +
              '</div>';
          }).join('');
        }
      }).catch(function () {});
    },

    // ---------------------------------------------------------------
    // FLOATING TOAST NOTIFIKASI
    // ---------------------------------------------------------------
    showToast: function (msg) {
      var toast = document.getElementById('publicToast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'publicToast';
        toast.className = 'fixed bottom-6 right-6 z-50 bg-emerald-dark text-white px-5 py-3 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2 border border-emerald/30 transition-all duration-300 transform translate-y-12 opacity-0 pointer-events-none';
        document.body.appendChild(toast);
      }
      toast.innerHTML = '<svg class="h-4 w-4 text-gold-light" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> ' + this.esc(msg);
      toast.classList.remove('translate-y-12', 'opacity-0', 'pointer-events-none');
      setTimeout(function () {
        toast.classList.add('translate-y-12', 'opacity-0', 'pointer-events-none');
      }, 3000);
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
