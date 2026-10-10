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
      selfieBase64: '',
      registration: null,
      editorial: { bulletinsExpanded: false, eventsExpanded: false },
      editorialLists: { bulletins: [], events: [] }
    },

    init: function () {
      this.bindMobileNav();
      this.bindRegistrationForm();
      this.bindRegistrationModal();
      this.bindEditorialUi();
      this.loadPublicConfig();
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
    // MODAL FORMULIR PENDAFTARAN & STATUS HEADER
    // ---------------------------------------------------------------
    openRegModal: function () {
      var regCfg = this.state.registration || {};
      var rawStatus = regCfg.status || (regCfg.is_open === false ? 'DITUTUP' : 'BUKA');
      if (rawStatus !== 'BUKA' || regCfg.is_open === false) {
        alert(regCfg.closed_message || 'Pendaftaran anggota saat ini sedang tidak dibuka.');
        return;
      }
      var modal = document.getElementById('regModal');
      if (modal) {
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
      }
    },

    closeRegModal: function () {
      var modal = document.getElementById('regModal');
      if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
      }
    },

    bindRegistrationModal: function () {
      var self = this;
      var closeBtn = document.getElementById('closeRegModalBtn');
      var cancelBtn = document.getElementById('cancelRegModalBtn');
      var regModal = document.getElementById('regModal');
      var receiptModal = document.getElementById('regReceiptModal');
      var closeReceiptBtn = document.getElementById('closeReceiptBtn');

      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          self.closeRegModal();
        });
      }
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
          self.closeRegModal();
        });
      }
      if (regModal) {
        regModal.addEventListener('click', function (e) {
          if (e.target === regModal) {
            self.closeRegModal();
          }
        });
      }
      if (closeReceiptBtn && receiptModal) {
        closeReceiptBtn.addEventListener('click', function () {
          receiptModal.classList.add('hidden');
          document.body.classList.remove('overflow-hidden');
        });
      }
      if (receiptModal) {
        receiptModal.addEventListener('click', function (e) {
          if (e.target === receiptModal) {
            receiptModal.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
          }
        });
      }

      // Tombol Esc menutup semua modal aktif
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
          self.closeRegModal();
          if (receiptModal && !receiptModal.classList.contains('hidden')) {
            receiptModal.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
          }
        }
      });
    },

    updateHeaderRegStatus: function (status, reg) {
      var self = this;
      var deskBox = document.getElementById('headerRegDesktop');
      var mobBox = document.getElementById('headerRegMobile');
      var drawerBox = document.getElementById('mobileMenuRegContainer');
      if (!deskBox && !mobBox && !drawerBox) return;

      var isOpen = (status === 'BUKA' && (!reg || reg.is_open !== false));

      if (isOpen) {
        var deskHtml = '' +
          '<button type="button" id="headerRegBtnDesktop" class="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-emerald-dark px-4 sm:px-5 py-2.5 rounded-xl font-extrabold text-sm shadow-md hover:shadow-lg transition cursor-pointer">' +
            '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>' +
            '<span>Daftar Anggota DPW</span>' +
          '</button>';

        var mobHtml = '' +
          '<button type="button" id="headerRegBtnMobile" class="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-light text-emerald-dark px-3 py-1.5 rounded-lg font-extrabold text-xs shadow transition cursor-pointer">' +
            '<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>' +
            '<span>Daftar</span>' +
          '</button>';

        var drawerHtml = '' +
          '<button type="button" id="headerRegBtnDrawer" class="w-full inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-light text-emerald-dark py-3 rounded-xl font-bold text-sm shadow transition cursor-pointer">' +
            '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>' +
            '<span>Daftar Anggota Sekarang</span>' +
          '</button>';

        if (deskBox) {
          deskBox.innerHTML = deskHtml;
          var btnD = document.getElementById('headerRegBtnDesktop');
          if (btnD) btnD.addEventListener('click', function () { self.openRegModal(); });
        }
        if (mobBox) {
          mobBox.innerHTML = mobHtml;
          var btnM = document.getElementById('headerRegBtnMobile');
          if (btnM) btnM.addEventListener('click', function () { self.openRegModal(); });
        }
        if (drawerBox) {
          drawerBox.innerHTML = drawerHtml;
          var btnDr = document.getElementById('headerRegBtnDrawer');
          if (btnDr) btnDr.addEventListener('click', function () {
            var menu = document.getElementById('mobileMenu');
            if (menu) menu.classList.add('hidden');
            self.openRegModal();
          });
        }
      } else {
        // SELAIN BUKA: Tampilkan Informasi Status yang Tidak Bisa Diklik
        var badgeLabelDesk = 'Pendaftaran Ditutup';
        var badgeLabelMob = 'Ditutup';
        var badgeDrawer = '🔒 Pendaftaran Ditutup Sementara';
        var icon = '🔒';
        var badgeDeskClass = 'bg-amber-50 text-amber-800 border-amber-300';
        var badgeMobClass = 'bg-amber-50 text-amber-800 border-amber-300';
        var badgeDrawerClass = 'bg-amber-50 text-amber-800 border-amber-200';

        if (status === 'PENUH') {
          badgeLabelDesk = 'Kuota Penuh';
          badgeLabelMob = 'Penuh';
          badgeDrawer = '⛔ Kuota Pendaftaran Penuh';
          icon = '⛔';
          badgeDeskClass = 'bg-red-50 text-red-800 border-red-300';
          badgeMobClass = 'bg-red-50 text-red-800 border-red-300';
          badgeDrawerClass = 'bg-red-50 text-red-800 border-red-200';
        } else if (status === 'SELEKSI') {
          badgeLabelDesk = 'Tahap Seleksi';
          badgeLabelMob = 'Seleksi';
          badgeDrawer = '🔍 Tahap Seleksi & Verifikasi';
          icon = '🔍';
          badgeDeskClass = 'bg-blue-50 text-blue-800 border-blue-300';
          badgeMobClass = 'bg-blue-50 text-blue-800 border-blue-300';
          badgeDrawerClass = 'bg-blue-50 text-blue-800 border-blue-200';
        }

        var disabledDeskHtml = '' +
          '<div class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border ' + badgeDeskClass + ' select-none cursor-not-allowed shadow-xs" title="' + self.esc(badgeLabelDesk) + '">' +
            '<span>' + icon + '</span>' +
            '<span>' + self.esc(badgeLabelDesk) + '</span>' +
          '</div>';

        var disabledMobHtml = '' +
          '<div class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border ' + badgeMobClass + ' select-none cursor-not-allowed" title="' + self.esc(badgeLabelDesk) + '">' +
            '<span>' + icon + '</span>' +
            '<span>' + self.esc(badgeLabelMob) + '</span>' +
          '</div>';

        var disabledDrawerHtml = '' +
          '<div class="w-full text-center py-2.5 px-3 rounded-xl text-xs font-bold border ' + badgeDrawerClass + ' select-none cursor-not-allowed">' +
            self.esc(badgeDrawer) +
          '</div>';

        if (deskBox) deskBox.innerHTML = disabledDeskHtml;
        if (mobBox) mobBox.innerHTML = disabledMobHtml;
        if (drawerBox) drawerBox.innerHTML = disabledDrawerHtml;
      }
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

      var regCfg = self.state.registration || {};
      var rawStatus = regCfg.status || (regCfg.is_open === false ? 'DITUTUP' : 'BUKA');
      if (rawStatus !== 'BUKA' || regCfg.is_open === false) {
        return showAlert(regCfg.closed_message || 'Pengiriman formulir pendaftaran saat ini sedang dinonaktifkan.', true);
      }

      var requireKtp = regCfg.require_ktp !== false;
      var requireSelfie = regCfg.require_selfie !== false;

      if (!fullName) return showAlert('Mohon isi Nama Lengkap sesuai KTP.', true);
      if (!nik || nik.length !== 16 || !/^\d+$/.test(nik)) return showAlert('Nomor NIK KTP harus terdiri dari 16 digit angka.', true);
      if (!phone) return showAlert('Nomor WhatsApp aktif wajib diisi.', true);
      if (requireKtp && !self.state.ktpBase64) return showAlert('Foto KTP wajib diunggah untuk verifikasi identitas resmi.', true);
      if (requireSelfie && !self.state.selfieBase64) return showAlert('Pas Foto / Selfie wajib diunggah untuk pencocokan wajah.', true);
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
          self.closeRegModal();
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
          '<div class="text-xl sm:text-2xl font-black text-emerald font-mono bg-emerald-light/40 py-2 px-3 sm:px-4 rounded-xl inline-block border border-emerald/20 break-all max-w-full">' + this.esc(regNum) + '</div>' +
          '<div class="mt-2 inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full text-center flex-wrap justify-center">' +
            '<span class="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>' +
            'MENUNGGU VERIFIKASI SEKRETARIAT' +
          '</div>' +
        '</div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">' +
          '<div><div class="text-gray-400 font-bold uppercase">Nama Pendaftar</div><div class="font-extrabold text-gray-800 text-sm mt-0.5 break-words">' + this.esc(data.full_name) + '</div></div>' +
          '<div><div class="text-gray-400 font-bold uppercase">NIK Terlindungi</div><div class="font-bold text-gray-700 text-sm font-mono mt-0.5 break-all">' + this.esc(maskedNik) + '</div></div>' +
          '<div><div class="text-gray-400 font-bold uppercase">Minat Divisi</div><div class="font-bold text-gray-700 mt-0.5 break-words">' + this.esc(data.division_interest || 'Umum') + '</div></div>' +
          '<div><div class="text-gray-400 font-bold uppercase">Waktu Pengajuan</div><div class="font-medium text-gray-600 mt-0.5">' + this.esc(dateStr) + ' WIB</div></div>' +
        '</div>' +
        '<div class="bg-gray-50 rounded-2xl p-4 text-xs text-gray-600 border border-gray-200 leading-relaxed">' +
          '<strong>Langkah Selanjutnya:</strong><br>' +
          '1. Berkas KTP ber-watermark Anda sedang ditinjau oleh Sekretariat DPW.<br>' +
          '2. Klik tombol di bawah untuk konfirmasi ke WhatsApp Pengurus agar proses verifikasi lebih cepat.' +
        '</div>';

      var regCfg = this.state.registration || {};
      var rawWa = String(regCfg.contact_wa || '081288882026').replace(/[^0-9]/g, '');
      var waPhone = rawWa.startsWith('0') ? '62' + rawWa.slice(1) : (rawWa.startsWith('62') ? rawWa : '62' + rawWa);
      var tmpl = regCfg.wa_template || 'Assalamu’alaikum / Halo Sekretariat APII DPW Jabodetabek,\n\nSaya telah mendaftar sebagai calon anggota baru:\n• No. Registrasi: {reg_number}\n• Nama: {full_name}\n• Divisi: {division}\n\nMohon konfirmasi dan verifikasi berkas pendaftaran saya. Terima kasih.';

      var waText = tmpl
        .replace(/\{reg_number\}/g, regNum)
        .replace(/\{full_name\}/g, data.full_name || '')
        .replace(/\{division\}/g, data.division_interest || 'Umum');

      if (waBtn) {
        waBtn.href = 'https://wa.me/' + waPhone + '?text=' + encodeURIComponent(waText);
      }

      modal.classList.remove('hidden');
    },

  // ---------------------------------------------------------------
  // KONTEN REDAKSI DINAMIS (MINI-CMS)
  // Hero, profil lembaga, warta maklumat, agenda acara, FAQ, kontak & sosmed.
  // Semua teks dari server WAJIB melewati Public.esc(); bila data kosong atau
  // gagal dimuat, markup bawaan di index.html tetap tampil rapi (graceful fallback).
  // ---------------------------------------------------------------

  /** Sembunyikan seksi beserta tautan navigasinya (untuk toggle redaksi). */
  hideSection: function (id) {
    var sec = document.getElementById(id);
    if (sec) sec.classList.add('hidden');
    var links = document.querySelectorAll('[data-nav-sec="' + id + '"]');
    Array.prototype.forEach.call(links, function (l) { l.classList.add('hidden'); });
  },

  /** Inisial nama pimpinan untuk kartu sambutan (mengabaikan gelar umum). */
  initials: function (name) {
    var words = String(name || '').split(/\s+/).map(function (w) {
      return w.replace(/[^\w\u00C0-\u024F]/g, '');
    });
    var clean = words.filter(function (w) {
      return w && !/^(ust|hj|h|kh|dr|drs|ir|prof|ny|muh|s|st|m)$/i.test(w);
    });
    var picks = clean.slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); });
    return picks.join('') || 'AP';
  },

  /** Format YYYY-MM-DD (atau ISO) menjadi "1 Maret 2026". */
  formatTanggal: function (iso) {
    if (!iso) return '';
    var bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    if (!m) return String(iso);
    var idx = Number(m[2]) - 1;
    if (idx < 0 || idx > 11) return String(iso);
    return Number(m[3]) + ' ' + bulan[idx] + ' ' + m[1];
  },

  /** Binding interaksi: tab warta, akordeon FAQ, tombol ekspansi daftar. */
  bindEditorialUi: function () {
    var self = this;

    // Akordeon FAQ (event delegation: bekerja untuk konten bawaan HTML maupun hasil render server).
    var faqList = document.getElementById('faqList');
    if (faqList) {
      faqList.addEventListener('click', function (e) {
        var btn = e.target.closest('.faq-q');
        if (!btn) return;
        var item = btn.closest('.faq-item');
        if (!item) return;
        var willOpen = !item.classList.contains('open');
        item.classList.toggle('open', willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        var body = item.querySelector('.faq-a');
        if (body) body.style.gridTemplateRows = willOpen ? '1fr' : '0fr';
        var chev = item.querySelector('.faq-chevron');
        if (chev) chev.style.transform = willOpen ? 'rotate(180deg)' : 'none';
      });
    }

    // Maklumat & Siaran dan Agenda & Acara ditampilkan berdampingan
    // (tidak digabung dalam tab) agar pengunjung langsung melihat semuanya.
    var p1 = document.getElementById('wartaPanelMaklumat');
    var p2 = document.getElementById('wartaPanelAgenda');
    if (p1) p1.classList.remove('hidden');
    if (p2) p2.classList.remove('hidden');

    // Ekspansi daftar (maks 6 item default).
    var moreB = document.getElementById('wartaBulletinMore');
    if (moreB) {
      moreB.addEventListener('click', function () {
        self.state.editorial.bulletinsExpanded = !self.state.editorial.bulletinsExpanded;
        self.renderBulletinCards();
      });
    }
    var moreE = document.getElementById('wartaEventMore');
    if (moreE) {
      moreE.addEventListener('click', function () {
        self.state.editorial.eventsExpanded = !self.state.editorial.eventsExpanded;
        self.renderEventCards();
      });
    }
  },

  /** Distribusi konten redaksi ke masing-masing seksi. */
  renderEditorial: function (ed) {
    if (!ed || typeof ed !== 'object') return;
    this.renderEditorialHero(ed.hero || {});
    this.renderEditorialProfile(ed.profile || {});
    this.renderEditorialWarta(ed.bulletins_events || {});
    this.renderEditorialFaq(ed);
    this.renderEditorialContact(ed.contact || {}, ed.social || {});
  },

  renderEditorialHero: function (hero) {
    var badge = document.getElementById('heroBadgeText');
    if (badge && hero.badge) badge.textContent = hero.badge;

    var h1 = document.getElementById('heroHeadline');
    if (h1 && hero.headline) {
      // Escape lebih dulu, baru beri aksen emas pada frasa identitas lembaga (aman dari XSS).
      var safe = this.esc(hero.headline);
      safe = safe.replace(/Yayasan APII/g, '<span class="text-gold-light">Yayasan APII</span>');
      h1.innerHTML = safe;
    }

    var sub = document.getElementById('heroSubheadline');
    if (sub && hero.subheadline) sub.textContent = hero.subheadline;

    var ctaText = document.getElementById('heroCtaText');
    if (ctaText && hero.cta_text) ctaText.textContent = hero.cta_text;

    var ctaBtn = document.getElementById('heroCtaBtn');
    if (ctaBtn && hero.cta_link) ctaBtn.setAttribute('href', hero.cta_link);
  },

  renderEditorialProfile: function (prof) {
    if (prof.show_section === false) {
      this.hideSection('profil');
      return;
    }
    var self = this;

    var greeting = document.getElementById('profileGreeting');
    if (greeting && prof.greeting) greeting.textContent = prof.greeting;

    var name = document.getElementById('profileKetuaName');
    if (name && prof.ketua_name) name.textContent = prof.ketua_name;

    var title = document.getElementById('profileKetuaTitle');
    if (title && prof.ketua_title) title.textContent = prof.ketua_title;

    var avatar = document.getElementById('profileKetuaInitial');
    if (avatar && prof.ketua_name) avatar.textContent = this.initials(prof.ketua_name);

    var vision = document.getElementById('profileVision');
    if (vision && prof.vision) vision.textContent = prof.vision;

    var missions = document.getElementById('profileMissions');
    if (missions && Array.isArray(prof.missions) && prof.missions.length) {
      missions.innerHTML = prof.missions.map(function (m, i) {
        return '<li class="flex items-start gap-3">' +
          '<span class="h-6 w-6 rounded-full bg-emerald text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">' + (i + 1) + '</span>' +
          '<span>' + self.esc(m) + '</span></li>';
      }).join('');
    }
  },

  renderEditorialWarta: function (be) {      if (be.show_section === false) {
      this.hideSection('warta');
      return;
    }

    var title = document.getElementById('wartaTitle');
    if (title && be.section_title) title.textContent = be.section_title;

    var sub = document.getElementById('wartaSubtitle');
    if (sub && be.section_subtitle) sub.textContent = be.section_subtitle;

    this.state.editorialLists = {
      bulletins: Array.isArray(be.bulletins) ? be.bulletins : [],
      events: Array.isArray(be.events) ? be.events : [],
      agendaSectionKey: 'agenda_section'
    };

    var agendaTitleEl = document.getElementById('wartaAgendaTitle');
    if (agendaTitleEl && be.agenda_section_title) agendaTitleEl.textContent = be.agenda_section_title;
    var agendaSubEl = document.getElementById('wartaAgendaSubtitle');
    if (agendaSubEl && be.agenda_section_subtitle) agendaSubEl.textContent = be.agenda_section_subtitle;

    this.renderBulletinCards();
    this.renderEventCards();
  },

  /** Grid kartu maklumat & siaran resmi (maks 6 item + tombol ekspansi). */
  renderBulletinCards: function () {
    var self = this;
    var list = document.getElementById('wartaBulletinList');
    var statusEl = document.getElementById('wartaBulletinStatus');
    var wrap = document.getElementById('wartaBulletinListWrap');
    var moreWrap = document.getElementById('wartaBulletinMoreWrap');
    var moreText = document.getElementById('wartaBulletinMoreText');
    if (!list || !statusEl) return;

    var items = this.state.editorialLists.bulletins || [];
    var limit = 6;

    if (!items.length) {
      list.innerHTML = '';
      if (wrap) wrap.classList.add('hidden');
      if (moreWrap) moreWrap.classList.add('hidden');
      statusEl.textContent = 'Belum ada maklumat resmi yang diterbitkan.';
      statusEl.classList.remove('hidden');
      return;
    }

    var expanded = !!this.state.editorial.bulletinsExpanded;
    var shown = expanded ? items.length : Math.min(limit, items.length);

    list.innerHTML = items.slice(0, shown).map(function (b) {
      var dateLabel = self.formatTanggal(b.date);
      return '<article class="bg-white rounded-2xl p-5 sm:p-6 border border-emerald-100 shadow-sm hover:shadow-md hover:border-emerald-300 transition flex flex-col">' +
          '<div class="flex items-center gap-2 mb-3 flex-wrap">' +
            '<span class="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">' + self.esc(b.category || 'Maklumat Resmi') + '</span>' +
            (dateLabel ? '<span class="text-xs text-gray-400 font-medium">' + self.esc(dateLabel) + '</span>' : '') +
          '</div>' +
          '<h3 class="font-bold text-gray-900 text-sm sm:text-base leading-snug mb-2 break-words">' + self.esc(b.title) + '</h3>' +
          (b.summary ? '<p class="text-xs text-gray-600 leading-relaxed flex-1">' + self.esc(b.summary) + '</p>' : '<div class="flex-1"></div>') +
          '<div class="mt-4 pt-3.5 border-t border-gray-100">' +
            (b.link
              ? '<a href="' + self.esc(b.link) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-xs font-bold text-emerald hover:text-emerald-dark transition">' +
                  '<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' +
                  '<span>Buka Dokumen Resmi</span></a>'
              : '<span class="text-[11px] font-semibold text-gray-400">Arsip Sekretariat</span>') +
          '</div>' +
        '</article>';
    }).join('');

    statusEl.classList.add('hidden');
    if (wrap) wrap.classList.remove('hidden');

    if (moreWrap && moreText) {
      if (items.length > limit) {
        moreWrap.classList.remove('hidden');
        moreText.textContent = expanded
          ? 'Ringkas Kembali'
          : 'Tampilkan Semua Maklumat (' + items.length + ')';
      } else {
        moreWrap.classList.add('hidden');
      }
    }
  },

  /** Grid kartu agenda: MENDATANG diprioritaskan, SELESAI diarsipkan berlabel abu-abu. */
  renderEventCards: function () {
    var self = this;
    var list = document.getElementById('wartaEventList');
    var statusEl = document.getElementById('wartaEventStatus');
    var wrap = document.getElementById('wartaEventListWrap');
    var moreWrap = document.getElementById('wartaEventMoreWrap');
    var moreText = document.getElementById('wartaEventMoreText');
    if (!list || !statusEl) return;

    var items = (this.state.editorialLists.events || []).slice();
    var limit = 6;

    if (!items.length) {
      list.innerHTML = '';
      if (wrap) wrap.classList.add('hidden');
      if (moreWrap) moreWrap.classList.add('hidden');
      statusEl.textContent = 'Belum ada agenda kegiatan yang dijadwalkan.';
      statusEl.classList.remove('hidden');
      return;
    }

    // Acara MENDATANG selalu tampil di atas; urutan asli redaksi dipertahankan.
    items.sort(function (a, b) {
      var aDone = String(a.status || '').toUpperCase() === 'SELESAI' ? 1 : 0;
      var bDone = String(b.status || '').toUpperCase() === 'SELESAI' ? 1 : 0;
      return aDone - bDone;
    });

    var expanded = !!this.state.editorial.eventsExpanded;
    var shown = expanded ? items.length : Math.min(limit, items.length);

    list.innerHTML = items.slice(0, shown).map(function (e) {
      var done = String(e.status || '').toUpperCase() === 'SELESAI';
      var meta = [];
      if (e.date_str || e.time_str) {
        meta.push('🗓️ ' + [e.date_str, e.time_str].filter(function (x) { return !!x; }).join(' • '));
      }
      if (e.location) meta.push('📍 ' + e.location);
      if (e.speaker) meta.push('🎤 ' + e.speaker);
      var img = e.image_url || null;

      return '<article class="bg-white rounded-2xl p-5 sm:p-6 border shadow-sm transition flex flex-col ' +
          (done ? 'border-gray-200 hover:border-gray-300' : 'border-emerald-200 hover:shadow-md hover:border-emerald-400') + '">' +
          (img
            ? '<div class="relative mb-3 overflow-hidden rounded-xl bg-gray-100">' +
              '<img src="' + self.esc(img) + '" alt="' + self.esc(e.title) + '" class="w-full h-44 sm:h-52 object-cover transition hover:scale-105" />' +
              '<div class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>' +
            '</div>' : '<div class="mb-3"></div>') +
          '<div class="flex items-center justify-between gap-2 mb-3 flex-wrap">' +
            '<span class="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ' +
              (done ? 'text-gray-600 bg-gray-100' : 'text-emerald-800 bg-emerald-100/80') + '">' + self.esc(e.category || 'Kajian') + '</span>' +
            (done
              ? '<span class="text-[10px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-0.5 rounded-full">⚪ Selesai (Arsip Kegiatan)</span>'
              : '<span class="text-[10px] font-black text-emerald-dark bg-gold px-2.5 py-0.5 rounded-full shadow-xs">🟢 MENDATANG</span>') +
          '</div>' +
          '<h3 class="font-bold text-sm sm:text-base leading-snug mb-3 break-words ' + (done ? 'text-gray-600' : 'text-gray-900') + '">' + self.esc(e.title) + '</h3>' +
          (meta.length
            ? '<ul class="space-y-1.5 text-xs text-gray-600 leading-relaxed flex-1">' + meta.map(function (m) {
                return '<li class="break-words">' + self.esc(m) + '</li>';
              }).join('') + '</ul>'
            : '<div class="flex-1"></div>') +
          '<div class="mt-4 pt-3.5 border-t border-gray-100">' +
            (e.link && !done
              ? '<a href="' + self.esc(e.link) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-1.5 w-full bg-emerald hover:bg-emerald-dark text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-sm transition">' +
                  '<span>Daftar / Info Acara</span><span aria-hidden="true">→</span></a>'
              : '<span class="text-[11px] font-semibold ' + (done ? 'text-gray-400' : 'text-gray-400') + '">' +
                  (done ? 'Kegiatan telah terlaksana' : 'Informasi pendaftaran melalui sekretariat') + '</span>') +
          '</div>' +
        '</article>';
    }).join('');

    statusEl.classList.add('hidden');
    if (wrap) wrap.classList.remove('hidden');

    if (moreWrap && moreText) {
      if (items.length > limit) {
        moreWrap.classList.remove('hidden');
        moreText.textContent = expanded
          ? 'Ringkas Kembali'
          : 'Tampilkan Semua Agenda (' + items.length + ')';
      } else {
        moreWrap.classList.add('hidden');
      }
    }
  },

  /** Akordeon FAQ dinamis (mempertahankan konten bawaan HTML bila daftar kosong). */
  renderEditorialFaq: function (ed) {
    if (ed.faqs_show === false) {
      this.hideSection('faq');
      return;
    }
    var self = this;
    var list = document.getElementById('faqList');
    var items = Array.isArray(ed.faqs) ? ed.faqs : [];
    if (!list || !items.length) return;

    list.innerHTML = items.map(function (f) {
      return '<div class="faq-item bg-white rounded-2xl border border-emerald-100 shadow-xs overflow-hidden transition hover:border-emerald-300">' +
          '<button type="button" class="faq-q w-full flex items-center justify-between gap-4 text-left px-5 sm:px-6 py-4 cursor-pointer" aria-expanded="false">' +
            '<span class="font-bold text-sm sm:text-base text-gray-900 break-words">' + self.esc(f.q) + '</span>' +
            '<svg class="faq-chevron h-5 w-5 text-emerald flex-shrink-0 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg>' +
          '</button>' +
          '<div class="faq-a grid transition-all duration-300 ease-out" style="grid-template-rows: 0fr;">' +
            '<div class="overflow-hidden"><p class="px-5 sm:px-6 pb-5 text-sm text-gray-600 leading-relaxed">' + self.esc(f.a) + '</p></div>' +
          '</div>' +
        '</div>';
    }).join('');
  },

  /** Kontak pelayanan & kanal media sosial resmi. */
  renderEditorialContact: function (contact, social) {
    var self = this;

    var addr = document.getElementById('contactAddress');
    if (addr && contact.address) addr.textContent = contact.address;

    var mail = document.getElementById('contactEmail');
    if (mail && contact.email) {
      mail.textContent = contact.email;
      mail.setAttribute('href', 'mailto:' + contact.email);
    }

    var hours = document.getElementById('contactHours');
    if (hours && contact.service_hours) hours.textContent = contact.service_hours;

    var wa = document.getElementById('contactWa');
    if (wa && contact.whatsapp_helpdesk) {
      var digits = String(contact.whatsapp_helpdesk).replace(/[^0-9]/g, '');
      if (digits.charAt(0) === '0') digits = '62' + digits.slice(1);
      wa.textContent = contact.whatsapp_helpdesk;
      wa.setAttribute('href', 'https://wa.me/' + digits);
    }

    var box = document.getElementById('contactSocial');
    if (!box) return;

    var svg = function (path) {
      return '<svg class="h-4 w-4 fill-current flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>';
    };
    var channels = [
      { key: 'youtube', label: 'YouTube', icon: svg('M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z') },
      { key: 'instagram', label: 'Instagram', icon: svg('M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2-.1-1.3-.1-1.7-.1-4.9s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4 1.3-.1 1.7-.1 4.9-.1zm0 3.2a6.6 6.6 0 100 13.2 6.6 6.6 0 000-13.2zm0 10.9a4.3 4.3 0 110-8.6 4.3 4.3 0 010 8.6zm6.9-11.1a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z') },
      { key: 'whatsapp_channel', label: 'Saluran WhatsApp', icon: svg('M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z') },
      { key: 'facebook', label: 'Facebook', icon: svg('M22 12a10 10 0 10-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0022 12z') },
      { key: 'tiktok', label: 'TikTok', icon: svg('M16.6 5.8a4.8 4.8 0 01-1.1-3.1h-3.3v13.2a2.7 2.7 0 11-1.9-2.6V9.9a6 6 0 105.1 5.9V9.4a8 8 0 004.6 1.5V7.6a4.7 4.7 0 01-3.4-1.8z') }
    ];

    var html = channels.map(function (c) {
      var url = social[c.key];
      if (!url) return '';
      return '<a href="' + self.esc(url) + '" target="_blank" rel="noopener noreferrer" ' +
        'class="inline-flex items-center gap-2 bg-white/10 hover:bg-gold hover:text-emerald-dark border border-white/20 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition">' +
        c.icon + '<span>' + c.label + '</span></a>';
    }).join('');

    if (html) {
      box.innerHTML = html;
      box.classList.remove('hidden');
    }
  },

  // ---------------------------------------------------------------
  // KONFIGURASI PUBLIK & PENDAFTARAN DINAMIS
  // ---------------------------------------------------------------
    loadPublicConfig: function () {
      var self = this;
      this.get('getPublicSettings').then(function (res) {
        if (!res || !res.success || !res.data) return;
        var d = res.data;
        var reg = d.registration || {};
        self.state.registration = reg;

        // 0. Konten redaksi dinamis (mini-CMS): hero, profil, warta, agenda, FAQ, kontak.
        self.renderEditorial(d.editorial || {});

        // 1. Banner Pengumuman Resmi Portal Publik
        var bannerBox = document.getElementById('announcementBannerContainer');
        if (bannerBox) {
          if (d.announcement_banner_active && d.announcement_banner) {
            var bType = d.announcement_banner_type || 'info';
            var bBg = 'bg-blue-600 text-white';
            var bIcon = '📢';
            if (bType === 'warning') {
              bBg = 'bg-amber-600 text-white';
              bIcon = '⚠️';
            } else if (bType === 'success') {
              bBg = 'bg-emerald-700 text-white';
              bIcon = '🌟';
            }
            bannerBox.className = bBg + ' px-4 py-2.5 text-xs sm:text-sm font-bold text-center flex items-center justify-center gap-2 shadow-xs';
            bannerBox.innerHTML = '<span>' + bIcon + '</span> <span>' + self.esc(d.announcement_banner) + '</span>';
          } else {
            bannerBox.className = 'hidden';
            bannerBox.innerHTML = '';
          }
        }

        // 2. Visibilitas Menu Pendaftaran Publik (RBAC) & Status Header Tunggal
        var rawStatus = reg.status || (reg.is_open === false ? 'DITUTUP' : 'BUKA');

        if (d.config && d.config.show_registration === false) {
          var deskBox = document.getElementById('headerRegDesktop');
          if (deskBox) deskBox.classList.add('hidden');
          var mobBox = document.getElementById('headerRegMobile');
          if (mobBox) mobBox.classList.add('hidden');
          var drawerBox = document.getElementById('mobileMenuRegContainer');
          if (drawerBox) drawerBox.classList.add('hidden');
          return;
        }

        // Render Status Header Tunggal (BUKA -> Tombol Daftar, status lain -> Badge Info Disabled)
        self.updateHeaderRegStatus(rawStatus, reg);

        // 3. Status Pendaftaran 4 Opsi (BUKA, DITUTUP, PENUH, SELEKSI)
        var form = document.getElementById('regMemberForm');
        var closedBox = document.getElementById('regClosedStateBox');
        var heroBadge = document.getElementById('heroRegBadge');
        var actionSec = document.getElementById('regActionSection');
        var agreeWrapper = document.getElementById('regAgreementWrapper');
        var agreeInput = document.getElementById('regAgreement');
        var submitRow = document.getElementById('regSubmitBtnRow');
        var submitBtn = document.getElementById('regSubmitBtn');
        var inlineNotice = document.getElementById('regClosedInlineNotice');

        if (rawStatus === 'BUKA' && reg.is_open !== false) {
          if (heroBadge) {
            heroBadge.textContent = 'PENERIMAAN ANGGOTA BARU DIBUKA';
            heroBadge.className = 'absolute -top-4 -right-4 bg-gold text-emerald-dark text-xs font-black px-3.5 py-1.5 rounded-xl shadow-lg';
          }
          if (form) form.classList.remove('hidden');
          if (closedBox) closedBox.classList.add('hidden');

          // Tampilkan tombol kirim formulir dan centang & teks persetujuan HANYA jika status BUKA
          if (actionSec) actionSec.classList.remove('hidden');
          if (agreeWrapper) agreeWrapper.classList.remove('hidden');
          if (agreeInput) agreeInput.required = true;
          if (submitRow) submitRow.classList.remove('hidden');
          if (submitBtn) submitBtn.classList.remove('hidden');
          if (inlineNotice) inlineNotice.classList.add('hidden');
        } else {
          // SELAIN PENDAFTARAN DIBUKA: JANGAN MENAMPILKAN TOMBOL KIRIM DAN CENTANG & TEKS PERSETUJUAN
          if (actionSec) actionSec.classList.add('hidden');
          if (agreeWrapper) agreeWrapper.classList.add('hidden');
          if (agreeInput) {
            agreeInput.required = false;
            agreeInput.checked = false;
          }
          if (submitRow) submitRow.classList.add('hidden');
          if (submitBtn) submitBtn.classList.add('hidden');

          if (closedBox) {
            closedBox.classList.remove('hidden');
            var cTitle = closedBox.querySelector('.closed-title');
            var cMsg = closedBox.querySelector('.closed-msg');
            var badgeText = 'PENDAFTARAN DITUTUP SEMENTARA';
            var badgeClass = 'absolute -top-4 -right-4 bg-amber-500 text-white text-xs font-black px-3.5 py-1.5 rounded-xl shadow-lg';

            if (rawStatus === 'PENUH') {
              badgeText = 'KUOTA PENDAFTARAN PENUH';
              badgeClass = 'absolute -top-4 -right-4 bg-red-600 text-white text-xs font-black px-3.5 py-1.5 rounded-xl shadow-lg';
              if (cTitle) cTitle.textContent = reg.closed_title || 'Kuota Pendaftaran Telah Terpenuhi';
              if (cMsg) cMsg.textContent = reg.closed_message || 'Batas kuota target penerimaan anggota baru DPW Jabodetabek telah terpenuhi. Pantau pembukaan gelombang berikutnya.';
            } else if (rawStatus === 'SELEKSI') {
              badgeText = 'TAHAP SELEKSI & VERIFIKASI';
              badgeClass = 'absolute -top-4 -right-4 bg-blue-600 text-white text-xs font-black px-3.5 py-1.5 rounded-xl shadow-lg';
              if (cTitle) cTitle.textContent = reg.closed_title || 'Tahap Seleksi & Verifikasi Berkas';
              if (cMsg) cMsg.textContent = reg.closed_message || 'Saat ini panitia dan sekretariat sedang melakukan proses verifikasi serta seleksi administrasi berkas pendaftar.';
            } else {
              if (cTitle) cTitle.textContent = reg.closed_title || 'Pendaftaran Anggota Sementara Ditutup';
              if (cMsg) cMsg.textContent = reg.closed_message || 'Pendaftaran gelombang saat ini telah ditutup atau sedang dalam proses verifikasi kuota. Pantau pengumuman resmi berkala dari sekretariat yayasan.';
            }

            if (heroBadge) {
              heroBadge.textContent = badgeText;
              heroBadge.className = badgeClass;
            }
          }

          if (inlineNotice) {
            inlineNotice.classList.remove('hidden');
            var inTitle = inlineNotice.querySelector('.inline-notice-title');
            var inDesc = inlineNotice.querySelector('.inline-notice-desc');
            if (rawStatus === 'PENUH') {
              if (inTitle) inTitle.textContent = 'Kuota Pendaftaran Telah Terpenuhi';
              if (inDesc) inDesc.textContent = reg.closed_message || 'Batas kuota target penerimaan anggota baru DPW Jabodetabek telah terpenuhi. Pengiriman formulir dinonaktifkan.';
            } else if (rawStatus === 'SELEKSI') {
              if (inTitle) inTitle.textContent = 'Tahap Seleksi & Verifikasi Berkas';
              if (inDesc) inDesc.textContent = reg.closed_message || 'Saat ini panitia sedang melakukan proses verifikasi dan seleksi berkas. Pengiriman formulir dinonaktifkan.';
            } else {
              if (inTitle) inTitle.textContent = 'Pendaftaran Sementara Ditutup';
              if (inDesc) inDesc.textContent = reg.closed_message || 'Pendaftaran saat ini sedang tidak dibuka. Pengiriman formulir pendaftaran dinonaktifkan.';
            }
          }

          if (form) form.classList.add('hidden');
        }

        // 4. Filter Pilihan Divisi yang Membuka Rekrutmen
        var selDiv = document.getElementById('regDivision');
        if (selDiv && Array.isArray(reg.open_divisions) && reg.open_divisions.length > 0) {
          // 7 divisi sesuai AD/ART Pasal 16 (kode = backend DIVISIONS).
          var divisionsMap = {
            'DIV_HUMAS': 'Divisi Humas & Kemitraan',
            'DIV_LITBANG': 'Divisi Litbang & Diklat',
            'DIV_SOSMED': 'Divisi Media Sosial & Digital',
            'DIV_DAKWAH': 'Divisi Dakwah & Pendidikan',
            'DIV_INVESTASI': 'Divisi Pengembangan & Investasi Bisnis',
            'DIV_HUKUM': 'Divisi Hukum & Advokasi',
            'DIV_UMUM': 'Divisi Umum & Operasional'
          };
          var optHtml = '<option value="">-- Pilih Minat Divisi Kerja --</option>';
          reg.open_divisions.forEach(function (code) {
            var label = divisionsMap[code] || code;
            optHtml += '<option value="' + self.esc(label) + '">' + self.esc(label) + '</option>';
          });
          selDiv.innerHTML = optHtml;
        }

        // 5. Petunjuk & Pengantar
        if (reg.instructions) {
          var pDesc = document.querySelector('#regModal p.text-gray-600');
          if (pDesc) pDesc.textContent = reg.instructions;
        }
      }).catch(function (err) {
        console.warn('Gagal memuat konfigurasi publik:', err);
      });
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
            var card = '' +
              '<div class="p-4 rounded-2xl bg-gray-50/80 hover:bg-emerald-50/50 border border-gray-200/90 hover:border-emerald-300 transition flex flex-col sm:flex-row sm:items-start justify-between gap-3 shadow-xs">' +
                '<div class="flex-1 min-w-0">' +
                  '<div class="flex items-center gap-2 mb-1 flex-wrap">' +
                    '<span class="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">' + self.esc(s.letter_type_label || s.letter_type) + '</span>' +
                    '<span class="text-xs text-gray-400 font-medium">' + self.esc(s.tanggal_label || '') + '</span>' +
                  '</div>' +
                  '<h4 class="font-bold text-gray-900 text-sm leading-snug break-words">' + self.esc(s.title) + '</h4>' +
                  '<div class="text-xs text-gray-500 font-mono mt-1 break-all">' + self.esc(s.letter_number) + '</div>' +
                '</div>';
            if (s.show_image_on_public && s.image_url) {
              card += '<button type="button" class="sm:flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-bold bg-emerald hover:bg-emerald-dark text-white px-3.5 py-2 rounded-xl shadow-xs transition" data-lookimg="' + self.esc(s.image_url) + '">' +
                '<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m0 0l-6-6m6 6l6.414-6.414a2 2 0 112.828 2.828L18.414 14.414a2 2 0 01-2.828 0L10 16.414a2 2 0 01-2.828-2.828L12.414 10 10 12.414 16 16"/></svg>' +
                '<span>Lihat Surat</span>' +
              '</button>';
            } else {
              card += '<span class="sm:flex-shrink-0 text-[11px] font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg">Arsip Fisik</span>';
            }
            card += '</div>';
            return card;
          }).join('');
          listEl.querySelectorAll('[data-lookimg]').forEach(function (btn) {
            btn.addEventListener('click', function () { self.showPictureModal(btn.getAttribute('data-lookimg')); });
          });
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
      var loadingEl = document.getElementById('loadingAccount');
      var container = document.getElementById('publicAccountList');
      var emptyEl = document.getElementById('emptyAccount');
      if (!container) return;

      this.get('getPublicAccounts').then(function (res) {
        if (loadingEl) loadingEl.classList.add('hidden');
        if (res && res.success && res.data && res.data.length) {
          container.innerHTML = res.data.map(function (acc, idx) {
            var bankName = acc.bank_name || acc.bank_vendor || acc.name || 'Bank Yayasan';
            var accNum = acc.account_number || acc.nomor_rekening || '-';
            var holder = acc.holder_name || acc.atas_nama || 'YAYASAN APII DPW JABODETABEK';
            var category = acc.category || 'Operasional DPW';

            var isBsi = /BSI|Syariah|Muamalat/i.test(bankName);
            var isMandiri = /Mandiri/i.test(bankName);
            var isBca = /BCA|BNI|BRI|CIMB/i.test(bankName);

            var colorBg = 'from-gray-50 via-slate-50 to-gray-100 border-gray-300';
            var colorBadge = 'text-gray-700 bg-gray-200/80 border-gray-300';
            var colorBtn = 'text-gray-800 border-gray-300 hover:bg-gray-100';

            if (isBsi) {
              colorBg = 'from-emerald-500/10 via-emerald-50 to-teal-50/50 border-emerald-300/80';
              colorBadge = 'text-emerald-800 bg-emerald-100/90 border-emerald-200/80';
              colorBtn = 'text-emerald-800 border-emerald-300 hover:bg-emerald-100';
            } else if (isMandiri) {
              colorBg = 'from-amber-500/10 via-amber-50 to-orange-50/50 border-amber-300/80';
              colorBadge = 'text-amber-900 bg-amber-100/90 border-amber-200/80';
              colorBtn = 'text-amber-900 border-amber-300 hover:bg-amber-100';
            } else if (isBca) {
              colorBg = 'from-sky-500/10 via-sky-50 to-blue-50/50 border-sky-300/80';
              colorBadge = 'text-sky-900 bg-sky-100/90 border-sky-200/80';
              colorBtn = 'text-sky-900 border-sky-300 hover:bg-sky-100';
            }

            var btnId = 'copyBtn_' + idx;

            return '' +
              '<div class="p-4 sm:p-5 rounded-2xl bg-gradient-to-br ' + colorBg + ' border shadow-xs transition hover:shadow-md">' +
                '<div class="flex items-center justify-between mb-2.5 flex-wrap gap-2">' +
                  '<div class="flex items-center gap-2">' +
                    '<span class="text-xs font-black text-gray-950 uppercase tracking-wide">' + self.esc(bankName) + '</span>' +
                  '</div>' +
                  '<span class="text-[10px] font-bold ' + colorBadge + ' px-2.5 py-0.5 rounded-full border shadow-2xs">' + self.esc(category) + '</span>' +
                '</div>' +
                '<div class="flex items-center justify-between gap-3 mt-1.5 flex-wrap sm:flex-nowrap bg-white/70 p-3 rounded-xl border border-white/60">' +
                  '<div class="text-base sm:text-xl font-black font-mono text-gray-900 tracking-wider break-all min-w-0 select-all">' + self.esc(accNum) + '</div>' +
                  (accNum !== '-' ?
                    '<button type="button" id="' + btnId + '" ' +
                            'onclick="(function(btn){ ' +
                              'navigator.clipboard.writeText(\'' + self.esc(accNum) + '\'); ' +
                              'var origText = btn.innerHTML; ' +
                              'btn.innerHTML = \'Tersalin ✓\'; ' +
                              'btn.classList.add(\'bg-emerald-600\', \'text-white\'); ' +
                              'setTimeout(function(){ btn.innerHTML = origText; btn.classList.remove(\'bg-emerald-600\', \'text-white\'); }, 2000); ' +
                              'window.Public && window.Public.showToast(\'Nomor rekening ' + self.esc(bankName) + ' berhasil disalin!\'); ' +
                            '})(this);" ' +
                            'class="inline-flex items-center gap-1.5 text-xs font-bold bg-white ' + colorBtn + ' px-3.5 py-1.5 rounded-xl border shadow-xs transition active:scale-95 flex-shrink-0 cursor-pointer">' +
                      '<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>' +
                      '<span>Salin</span>' +
                    '</button>' : '') +
                '</div>' +
                '<div class="text-xs text-gray-600 mt-2.5 font-medium break-words flex items-center gap-1.5">' +
                  '<span class="text-gray-400">a.n.</span> ' +
                  '<strong class="text-gray-900 font-extrabold">' + self.esc(holder) + '</strong>' +
                '</div>' +
                (acc.show_qris_on_public && acc.qris_image_url
                  ? '<div class="mt-4 pt-4 border-t border-dashed border-gray-300/80 text-center">' +
                      '<p class="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">Scan QRIS untuk Infaq / Donasi</p>' +
                      '<button type="button" data-lookimg="' + self.esc(acc.qris_image_url) + '" class="inline-block rounded-xl overflow-hidden border-2 border-emerald-300/80 hover:border-emerald-500 transition shadow-sm hover:shadow-md cursor-zoom-in">' +
                        '<img src="' + self.esc(acc.qris_image_url) + '" alt="QRIS ' + self.esc(bankName) + '" class="w-40 h-40 object-contain bg-white" />' +
                      '</button>' +
                    '</div>'
                  : '') +
              '</div>';
          }).join('');
          container.classList.remove('hidden');
          if (emptyEl) emptyEl.classList.add('hidden');
          container.querySelectorAll('[data-lookimg]').forEach(function (btn) {
            btn.addEventListener('click', function () { self.showPictureModal(btn.getAttribute('data-lookimg')); });
          });
        } else {
          container.classList.add('hidden');
          if (emptyEl) emptyEl.classList.remove('hidden');
        }
      }).catch(function () {
        if (loadingEl) loadingEl.classList.add('hidden');
        container.classList.add('hidden');
        if (emptyEl) emptyEl.classList.remove('hidden');
      });
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
    showPictureModal: function (src) {
      var win = window.open(src, '_blank', 'noopener');
      if (win) win.focus();
    },
  };

  window.Public = Public;
  document.addEventListener('DOMContentLoaded', function () { Public.init(); });
})();
