/**
 * ============================================================================
 * app.js - Logika Frontend Portal Publik (apii.sigitadi.id)
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
      registration: null
    },

    init: function () {
      this.initTheme();
      this.bindMobileNav();
      this.bindRegistrationForm();
      this.bindRegistrationModal();
      this.loadPublicConfig();
      this.loadPublicSurat();
      this.loadPublicAccounts();
    },

    initTheme: function () {
      var self = this;
      var saved = null;
      try { saved = localStorage.getItem('apii_theme'); } catch (e) {}
      var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      var isDark = saved === 'dark' || (!saved && prefersDark);
      self.applyTheme(isDark);

      var btn = document.getElementById('themeToggleBtn');
      if (btn) {
        btn.onclick = function () {
          var nowDark = document.documentElement.classList.contains('dark');
          self.applyTheme(!nowDark);
        };
      }
    },

    applyTheme: function (isDark) {
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      try { localStorage.setItem('apii_theme', isDark ? 'dark' : 'light'); } catch (e) {}

      var sun = document.getElementById('themeIconSun');
      var moon = document.getElementById('themeIconMoon');
      var btn = document.getElementById('themeToggleBtn');
      if (sun && moon) {
        if (isDark) {
          sun.classList.remove('hidden');
          moon.classList.add('hidden');
        } else {
          sun.classList.add('hidden');
          moon.classList.remove('hidden');
        }
      }
      if (btn) {
        btn.setAttribute('aria-label', isDark ? 'Ubah ke mode terang' : 'Ubah ke mode gelap');
        btn.title = isDark ? 'Ubah ke mode terang' : 'Ubah ke mode gelap';
      }
    },

    getDefaultEditorial: function () {
      return {
        hero: {
          badge: 'Penerimaan Anggota Baru 2026',
          headline: 'Keanggotaan & Kolaborasi Yayasan APII DPW Jabodetabek',
          subheadline: 'Wadah sinergi para ahli, akademisi, dan praktisi pengkaji Islam di Indonesia untuk riset, pemberdayaan, dan kemaslahatan umat.',
          cta_text: 'Info Dokumen & Keuangan Kas',
          cta_link: '#informasi'
        },
        profile: {
          show_section: true,
          ketua_name: 'Ustadz Muhammad Hanafi',
          ketua_title: 'Ketua DPW APII Jabodetabek',
          greeting: "Assalamu'alaikum Warahmatullahi Wabarakatuh. Selamat datang di portal resmi Dewan Pimpinan Wilayah Yayasan Apologet Islam Indonesia (APII) Jabodetabek. Sebagai organisasi yang bergerak di bidang sosial, kemasyarakatan, dan keagamaan, kami berkomitmen mengimplementasikan nilai Islam yang moderat, mentransfer ilmu pengetahuan, serta mempererat ukhuwah islamiah demi kemaslahatan bersama.",
          vision: 'Mengimplementasikan Islam sebagai Agama Rahmatan Lil Alamin',
          missions: [
            'Transfer Ilmu Pengetahuan bagi sesama umat.',
            'Mengoptimalkan digital dan internet sebagai sarana Dakwah.',
            'Dialog perbandingan agama secara online maupun offline.',
            'Bersinergi dengan Individu, Organisasi Islam, dan Instansi Pemerintah/Swasta guna mengukuhkan Ukhuwah Islamiah.'
          ]
        }
      };
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

      var bindOpenClick = function (btnId) {
        var el = document.getElementById(btnId);
        if (el) {
          el.addEventListener('click', function () {
            var menu = document.getElementById('mobileMenu');
            if (menu) menu.classList.add('hidden');
            self.openRegModal();
          });
        }
      };

      // Ikat tombol pendaftaran langsung dari markup statis awal
      bindOpenClick('headerRegBtnDesktop');
      bindOpenClick('headerRegBtnMobile');
      bindOpenClick('headerRegBtnDrawer');
      bindOpenClick('heroRegBtnMain');
      bindOpenClick('heroCardRegBtn');

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
      var heroBtn = document.getElementById('heroRegBtnMain');
      var heroCardBtn = document.getElementById('heroCardRegBtn');
      if (!deskBox && !mobBox && !drawerBox && !heroBtn && !heroCardBtn) return;

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
        if (heroBtn) {
          heroBtn.classList.remove('hidden');
          heroBtn.onclick = function () { self.openRegModal(); };
        }
        if (heroCardBtn) {
          heroCardBtn.classList.remove('hidden');
          heroCardBtn.onclick = function () { self.openRegModal(); };
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
        if (heroBtn) heroBtn.classList.add('hidden');
        if (heroCardBtn) heroCardBtn.classList.add('hidden');
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
          (isErr ? 'bg-red-50 dark:bg-[#2D0F0F] text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800' : 'bg-emerald-50 dark:bg-[#062818] text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800');
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
        '<div class="text-center pb-4 border-b border-gray-100 dark:border-[#1E3D30]">' +
          '<div class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Nomor Registrasi Anda</div>' +
          '<div class="text-xl sm:text-2xl font-black text-emerald dark:text-emerald-400 font-mono bg-emerald-light/40 dark:bg-[#10241B] py-2 px-3 sm:px-4 rounded-xl inline-block border border-emerald/20 dark:border-[#1E3D30] break-all max-w-full">' + this.esc(regNum) + '</div>' +
          '<div class="mt-2 inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-3 py-1 rounded-full text-center flex-wrap justify-center">' +
            '<span class="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>' +
            'MENUNGGU VERIFIKASI SEKRETARIAT' +
          '</div>' +
        '</div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">' +
          '<div><div class="text-gray-400 dark:text-gray-400 font-bold uppercase">Nama Pendaftar</div><div class="font-extrabold text-gray-800 dark:text-white text-sm mt-0.5 break-words">' + this.esc(data.full_name) + '</div></div>' +
          '<div><div class="text-gray-400 dark:text-gray-400 font-bold uppercase">NIK Terlindungi</div><div class="font-bold text-gray-700 dark:text-gray-200 text-sm font-mono mt-0.5 break-all">' + this.esc(maskedNik) + '</div></div>' +
          '<div><div class="text-gray-400 dark:text-gray-400 font-bold uppercase">Minat Divisi</div><div class="font-bold text-gray-700 dark:text-gray-200 mt-0.5 break-words">' + this.esc(data.division_interest || 'Umum') + '</div></div>' +
          '<div><div class="text-gray-400 dark:text-gray-400 font-bold uppercase">Waktu Pengajuan</div><div class="font-medium text-gray-600 dark:text-gray-300 mt-0.5">' + this.esc(dateStr) + ' WIB</div></div>' +
        '</div>' +
        '<div class="bg-gray-50 dark:bg-[#10241B] rounded-2xl p-4 text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#1E3D30] leading-relaxed">' +
          '<strong class="text-gray-800 dark:text-white">Langkah Selanjutnya:</strong><br>' +
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

    /**
     * Sinkronisasi konfigurasi bersama lintas port (localhost:3000 <-> localhost:3001)
     * dan lintas subdomain (*.sigitadi.id) menggunakan RFC 6265 cookie + localStorage.
     */
    setSharedConfig: function (key, value) {
      var valStr = typeof value === 'string' ? value : JSON.stringify(value);
      try { localStorage.setItem(key, valStr); } catch (_) {}
      try {
        var enc = encodeURIComponent(valStr);
        var host = (window.location && window.location.hostname) || '';
        var isSigit = host.indexOf('sigitadi.id') !== -1;
        var domainPart = isSigit ? '; domain=.sigitadi.id' : '';
        document.cookie = key + '=' + enc + '; path=/' + domainPart + '; max-age=31536000; SameSite=Lax';
      } catch (_) {}
    },

    getSharedConfig: function (key) {
      try {
        var nameEQ = key + '=';
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
          var c = ca[i].trim();
          if (c.indexOf(nameEQ) === 0) {
            var raw = decodeURIComponent(c.substring(nameEQ.length));
            try { return JSON.parse(raw); } catch (_) { return raw; }
          }
        }
      } catch (_) {}
      try {
        var ls = localStorage.getItem(key);
        if (ls) {
          try { return JSON.parse(ls); } catch (_) { return ls; }
        }
      } catch (_) {}
      return null;
    },

    // ---------------------------------------------------------------
    // KONFIGURASI PUBLIK & PENDAFTARAN DINAMIS
    // ---------------------------------------------------------------
    loadPublicConfig: function () {
      var self = this;

      var applyConfig = function (d) {
        if (!d) return;
        var reg = d.registration || {};
        self.state.registration = reg;
        try {
          localStorage.setItem('apii_registration_config', JSON.stringify(reg));
        } catch (_) {}

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

        // 1b. Redaksi Konten Dinamis Portal Publik (Mini-CMS)
        var ed = d.editorial || self.getDefaultEditorial();
        var defEd = self.getDefaultEditorial();
        if (ed && ed.profile) {
          if (!ed.profile.vision || ed.profile.vision.indexOf('Mengimplementasikan Islam') === -1) {
            ed.profile.vision = defEd.profile.vision;
            ed.profile.missions = defEd.profile.missions;
            ed.profile.greeting = defEd.profile.greeting;
            ed.profile.ketua_name = defEd.profile.ketua_name;
            ed.profile.ketua_title = defEd.profile.ketua_title;
          }
        }
        try { self.renderEditorial(ed); } catch (e) { console.error('Redaksi gagal dirender:', e); }

        // 2. Visibilitas Menu Pendaftaran Publik (RBAC) & Status Header Tunggal
        var rawStatus = reg.status || (reg.is_open === false ? 'DITUTUP' : 'BUKA');
        var deskBox = document.getElementById('headerRegDesktop');
        var mobBox = document.getElementById('headerRegMobile');
        var drawerBox = document.getElementById('mobileMenuRegContainer');
        var heroBtn = document.getElementById('heroRegBtnMain');
        var heroCardBtn = document.getElementById('heroCardRegBtn');
        var heroBadge = document.getElementById('heroRegBadge');

        if (d.config && d.config.show_registration === false) {
          if (deskBox) deskBox.classList.add('hidden');
          if (mobBox) mobBox.classList.add('hidden');
          if (drawerBox) drawerBox.classList.add('hidden');
          if (heroBtn) heroBtn.classList.add('hidden');
          if (heroCardBtn) heroCardBtn.classList.add('hidden');
          if (heroBadge) heroBadge.classList.add('hidden');
          return;
        } else {
          if (deskBox) deskBox.classList.remove('hidden');
          if (mobBox) mobBox.classList.remove('hidden');
          if (drawerBox) drawerBox.classList.remove('hidden');
          if (heroBadge) heroBadge.classList.remove('hidden');
        }

        // Render Status Header Tunggal & Tombol Hero
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

          if (actionSec) actionSec.classList.remove('hidden');
          if (agreeWrapper) agreeWrapper.classList.remove('hidden');
          if (agreeInput) agreeInput.required = true;
          if (submitRow) submitRow.classList.remove('hidden');
          if (submitBtn) submitBtn.classList.remove('hidden');
          if (inlineNotice) inlineNotice.classList.add('hidden');
        } else {
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
          var divisionsMap = {
            'DIV_DAKWAH': 'Divisi Dakwah & Pembinaan',
            'DIV_HUKUM': 'Divisi Advokasi & Hukum',
            'DIV_HUMAS': 'Divisi Humas & Kemitraan',
            'DIV_MEDIA': 'Divisi Media, IT & Publikasi',
            'DIV_SOSIAL': 'Divisi Sosial & Kemanusiaan',
            'DIV_LITBANG': 'Divisi Litbang & Diklat',
            'DIV_EKONOMI': 'Divisi Pemberdayaan Ekonomi & Logistik'
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
      };

      // Konfigurasi awal bawaan (Fail-safe mandiri)
      var defaultSettings = {
        config: { show_registration: true },
        registration: {
          status: 'BUKA',
          is_open: true,
          quota_limit: 0,
          closed_title: 'Pendaftaran Anggota Sementara Ditutup',
          closed_message: 'Pendaftaran gelombang saat ini telah ditutup atau sedang dalam proses verifikasi kuota. Pantau pengumuman resmi berkala dari sekretariat yayasan.',
          instructions: 'Silakan isi formulir pendaftaran anggota Yayasan APII DPW Jabodetabek dengan data yang valid sesuai identitas KTP resmi.',
          require_ktp: true,
          require_selfie: true,
          max_file_size_mb: 3,
          open_divisions: ['DIV_DAKWAH', 'DIV_HUKUM', 'DIV_HUMAS', 'DIV_MEDIA', 'DIV_SOSIAL', 'DIV_LITBANG', 'DIV_EKONOMI'],
          contact_wa: '081288882026',
          notify_email: 'sekretariat@apii.sigitadi.id',
          wa_template: 'Halo Sekretariat APII DPW Jabodetabek, saya telah mendaftar anggota baru dengan No. Registrasi: {reg_number} a.n {full_name}. Mohon verifikasi berkas saya.',
          agreement_text: 'Saya menyatakan bahwa data yang saya berikan adalah benar dan sah. Saya bersedia menaati AD/ART, kode etik, dan peraturan Yayasan APII DPW Jabodetabek.'
        },
        editorial: self.getDefaultEditorial()
      };

      // Periksa sinkronisasi bersama lintas port & domain (RFC 6265 Cookie + LocalStorage)
      var sharedReg = self.getSharedConfig('apii_registration_config') || self.getSharedConfig('siapii_registration_config');
      if (sharedReg && typeof sharedReg === 'object') {
        defaultSettings.registration = Object.assign(defaultSettings.registration, sharedReg);
      }
      var sharedStatus = self.getSharedConfig('apii_reg_status');
      if (sharedStatus && typeof sharedStatus === 'string') {
        defaultSettings.registration.status = sharedStatus;
        defaultSettings.registration.is_open = (sharedStatus === 'BUKA');
      }
      var sharedIsOpen = self.getSharedConfig('apii_reg_is_open');
      if (sharedIsOpen !== null && sharedIsOpen !== undefined) {
        defaultSettings.registration.is_open = (sharedIsOpen === '1' || sharedIsOpen === 1 || sharedIsOpen === true);
        if (!defaultSettings.registration.is_open && defaultSettings.registration.status === 'BUKA') {
          defaultSettings.registration.status = 'DITUTUP';
        }
      }
      var sharedPubConfig = self.getSharedConfig('apii_public_config');
      if (sharedPubConfig && typeof sharedPubConfig === 'object') {
        defaultSettings.config = Object.assign(defaultSettings.config, sharedPubConfig);
      }
      var sharedShowReg = self.getSharedConfig('apii_show_registration');
      if (sharedShowReg !== null && sharedShowReg !== undefined) {
        defaultSettings.config.show_registration = (sharedShowReg === '1' || sharedShowReg === 1 || sharedShowReg === true);
      }
      var sharedEdit = self.getSharedConfig('apii_editorial') || self.getSharedConfig('siapii_editorial');
      if (sharedEdit && typeof sharedEdit === 'object') {
        defaultSettings.editorial = Object.assign(defaultSettings.editorial, sharedEdit);
      }

      // Terapkan konfigurasi tersinkronisasi terlebih dahulu secara instan (0 delay)
      applyConfig(defaultSettings);

      // Kemudian coba update dengan data live dari server jika tersedia
      this.get('getPublicSettings').then(function (res) {
        if (res && res.success && res.data) {
          var liveReg = res.data.registration || {};
          var liveConf = res.data.config || {};
          var curSt = self.getSharedConfig('apii_reg_status');
          if (curSt) {
            liveReg.status = curSt;
            liveReg.is_open = (curSt === 'BUKA');
          }
          var curShow = self.getSharedConfig('apii_show_registration');
          if (curShow !== null && curShow !== undefined) {
            liveConf.show_registration = (curShow === '1' || curShow === 1 || curShow === true);
          }
          res.data.registration = liveReg;
          res.data.config = liveConf;
          applyConfig(res.data);
        }
      }).catch(function (err) {
        console.warn('Gagal memuat konfigurasi publik dari live backend (menggunakan konfigurasi tersinkronisasi):', err);
      });

      // Auto-sinkronisasi saat pengguna berpindah tab atau jendela mendapatkan fokus
      if (!this._syncListenersAttached) {
        this._syncListenersAttached = true;
        window.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') {
            self.loadPublicConfig();
          }
        });
        window.addEventListener('focus', function () {
          self.loadPublicConfig();
        });
        window.addEventListener('storage', function (e) {
          if (e && e.key && (e.key.indexOf('registration') !== -1 || e.key.indexOf('apii_') !== -1)) {
            self.loadPublicConfig();
          }
        });
        // Polling ringan lintas port (1.5 detik) memastikan pembaruan langsung terdeteksi
        setInterval(function () {
          var curSt = self.getSharedConfig('apii_reg_status') || 'BUKA';
          var curShow = self.getSharedConfig('apii_show_registration');
          var sig = curSt + ':' + curShow;
          if (self._lastSyncedSig !== undefined && self._lastSyncedSig !== sig) {
            self._lastSyncedSig = sig;
            self.loadPublicConfig();
          } else {
            self._lastSyncedSig = sig;
          }
        }, 1500);
      }
    },

    // ---------------------------------------------------------------
    // REDAKSI KONTEN DINAMIS PORTAL PUBLIK (MINI-CMS)
    // Semua string di-escape via this.esc(); paragraf dipisah per baris
    // (parsing aman anti-XSS). Jika data kosong, fallback statis HTML
    // (skeleton/teks bawaan) tetap ditampilkan tanpa merusak halaman.
    // ---------------------------------------------------------------

    /** Pemetaah render 6 domain redaksi ke kontainer masing-masing. */
    renderEditorial: function (ed) {
      if (!ed || typeof ed !== 'object') return;
      this.renderEditorialHero(ed.hero);
      this.renderEditorialProfile(ed.profile);
      this.renderEditorialWarta(ed.bulletins_events);
      this.renderEditorialFaq(ed.faqs);
      this.renderEditorialContact(ed.contact, ed.social);
    },

    /** Bagi teks multi-baris menjadi paragraf <p> aman (anti-XSS). */
    editorialParas: function (text) {
      var self = this;
      if (!text) return '';
      return String(text).split(/\r?\n/).map(function (line) {
        var t = line.trim();
        return t ? '<p>' + self.esc(t) + '</p>' : '';
      }).join('');
    },

    /** Format tanggal ISO (YYYY-MM-DD) → "1 Mar 2026"; fallback string asli. */
    fmtEditorialDate: function (iso) {
      if (!iso) return '';
      var parts = String(iso).split('-');
      if (parts.length !== 3) return String(iso);
      var months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      var d = parseInt(parts[2], 10), m = parseInt(parts[1], 10) - 1, y = parseInt(parts[0], 10);
      if (isNaN(d) || isNaN(m) || isNaN(y)) return String(iso);
      return d + ' ' + (months[m] || '') + ' ' + y;
    },

    renderEditorialHero: function (h) {
      if (!h || typeof h !== 'object') return;
      var badge = document.getElementById('heroBadge');
      var badgeText = document.getElementById('heroBadgeText');
      if (badge && badgeText) {
        if (h.badge) { badgeText.textContent = h.badge; badge.classList.remove('hidden'); }
        else { badge.classList.add('hidden'); }
      }
      var headline = document.getElementById('heroHeadline');
      if (headline && h.headline) headline.textContent = h.headline;
      var sub = document.getElementById('heroSubHeadline');
      if (sub && h.subheadline) sub.textContent = h.subheadline;
      var ctaBtn = document.getElementById('heroCtaBtn');
      var ctaText = document.getElementById('heroCtaText');
      if (ctaText && h.cta_text) ctaText.textContent = h.cta_text;
      if (ctaBtn && h.cta_link) ctaBtn.setAttribute('href', h.cta_link);
    },

    renderEditorialProfile: function (p) {
      var sec = document.getElementById('profileSection');
      if (!sec) return;
      var parentSec = sec.parentElement || sec.parentNode || sec;
      if (!p || p.show_section === false) {
        if (parentSec && parentSec.style) parentSec.style.display = 'none';
        return;
      }
      if (parentSec && parentSec.style && parentSec.style.display === 'none') {
        parentSec.style.display = '';
      }
      var box = document.getElementById('profileContent');
      if (!box) return;

      var defP = this.getDefaultEditorial().profile;
      if (p.vision && (p.vision.indexOf('Menjadi pusat pengkajian') !== -1 || p.vision === '')) {
        p.vision = defP.vision;
        p.missions = defP.missions;
        p.greeting = defP.greeting;
        p.ketua_name = defP.ketua_name;
        p.ketua_title = defP.ketua_title;
      }

      var self = this;
      var missions = (Array.isArray(p.missions) ? p.missions : []).map(function (m) {
        return '<li class="flex items-start gap-2.5">' +
          '<span class="h-5 w-5 rounded-full bg-gold text-emerald-dark text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">✓</span>' +
          '<span>' + self.esc(m) + '</span></li>';
      }).join('');
      box.innerHTML =
        '<div class="lg:col-span-3 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-emerald-900/20 rounded-3xl p-8 border border-emerald-100 dark:border-emerald-900/60 flex flex-col justify-between">' +
          '<div>' +
            '<div class="flex items-center gap-4 mb-5">' +
              '<div class="h-14 w-14 bg-emerald-light dark:bg-emerald-900/60 rounded-2xl flex items-center justify-center flex-shrink-0">' +
                '<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-emerald dark:text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>' +
              '</div>' +
              '<div><div class="font-extrabold text-emerald-dark dark:text-emerald-100 text-lg">' + this.esc(p.ketua_name || 'Ustadz Muhammad Hanafi') + '</div>' +
              '<div class="text-xs text-gray-500 dark:text-gray-400 font-medium">' + this.esc(p.ketua_title || 'Ketua DPW APII Jabodetabek') + '</div></div>' +
            '</div>' +
            '<div class="space-y-3 text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">' + this.editorialParas(p.greeting) + '</div>' +
          '</div>' +
          '<div class="mt-6 pt-5 border-t border-emerald-100 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-2">' +
            '<span>🏛️</span>' +
            '<span>Dewan Pimpinan Wilayah Jabodetabek</span>' +
          '</div>' +
        '</div>' +
        '<div class="lg:col-span-2 bg-emerald-dark rounded-3xl p-8 text-white flex flex-col justify-between">' +
          '<div>' +
            '<div class="font-extrabold text-gold-light text-xl mb-3">Visi Lembaga</div>' +
            '<div class="bg-white/10 rounded-2xl p-4 mb-5 border border-white/10">' +
              '<p class="text-sm text-emerald-light/95 leading-relaxed font-medium">&ldquo;' + this.esc(p.vision || '') + '&rdquo;</p>' +
            '</div>' +
            '<div class="font-extrabold text-gold-light text-base mb-3">Misi Utama</div>' +
            '<ul class="space-y-2.5 text-xs sm:text-sm text-emerald-light/90 leading-relaxed">' + missions + '</ul>' +
          '</div>' +
          '<div class="mt-6 pt-5 border-t border-white/20 text-xs text-emerald-200">' +
            'Nilai dasar: Moderat, Ilmiah, Santun, dan Rahmatan Lil Alamin.' +
          '</div>' +
        '</div>';
    },




    renderEditorialWarta: function (be) {
      var self = this;
      var sec = document.getElementById('wartaSection');
      if (!sec) return;
      var parentSec = sec.parentElement || sec.parentNode || sec;
      if (!be || be.show_section === false) {
        if (parentSec && parentSec.style) parentSec.style.display = 'none';
        return;
      }
      if (parentSec && parentSec.style && parentSec.style.display === 'none') {
        parentSec.style.display = '';
      }

      var t = document.getElementById('wartaTitle');
      if (t && be.section_title) t.textContent = be.section_title;
      var st = document.getElementById('wartaSubtitle');
      if (st && be.section_subtitle) st.textContent = be.section_subtitle;

      // Maklumat / siaran pers
      self.state.bulletins = (Array.isArray(be.bulletins) ? be.bulletins : []);
      self.state.bulletinCount = 6;
      self.renderBulletins();
      var moreBtn = document.getElementById('bulletinMoreBtn');
      if (moreBtn && !moreBtn.dataset.bound) {
        moreBtn.dataset.bound = '1';
        moreBtn.addEventListener('click', function () {
          self.state.bulletinCount += 6;
          self.renderBulletins();
        });
      }

      // Agenda: MENDATANG di atas, SELESAI (arsip) di bawah
      var events = (Array.isArray(be.events) ? be.events.slice() : []);
      events.sort(function (a, b) {
        var ai = (a.status === 'SELESAI') ? 1 : 0, bi = (b.status === 'SELESAI') ? 1 : 0;
        return ai - bi;
      });
      self.state.events = events;
      self.state.eventCount = 6;
      self.renderEvents();
      var moreEvtBtn = document.getElementById('eventMoreBtn');
      if (moreEvtBtn && !moreEvtBtn.dataset.bound) {
        moreEvtBtn.dataset.bound = '1';
        moreEvtBtn.addEventListener('click', function () {
          self.state.eventCount += 6;
          self.renderEvents();
        });
      }

      // Tab switcher Maklumat <-> Agenda
      var tabB = document.getElementById('wartaTabBulletins');
      var tabE = document.getElementById('wartaTabEvents');
      var paneB = document.getElementById('wartaBulletinsPane');
      var paneE = document.getElementById('wartaEventsPane');
      var setTab = function (isEvents) {
        var onCls = ['active', 'bg-white', 'text-emerald-dark', 'shadow-sm'];
        if (isEvents) {
          paneB.classList.add('hidden'); paneE.classList.remove('hidden');
          tabE.classList.add.apply(tabE.classList, onCls); tabE.classList.remove('text-gray-500');
          tabB.classList.remove.apply(tabB.classList, onCls); tabB.classList.add('text-gray-500');
          tabE.setAttribute('aria-selected', 'true'); tabB.setAttribute('aria-selected', 'false');
        } else {
          paneE.classList.add('hidden'); paneB.classList.remove('hidden');
          tabB.classList.add.apply(tabB.classList, onCls); tabB.classList.remove('text-gray-500');
          tabE.classList.remove.apply(tabE.classList, onCls); tabE.classList.add('text-gray-500');
          tabB.setAttribute('aria-selected', 'true'); tabE.setAttribute('aria-selected', 'false');
        }
      };
      if (tabB && !tabB.dataset.bound) { tabB.dataset.bound = '1'; tabB.addEventListener('click', function () { setTab(false); }); }
      if (tabE && !tabE.dataset.bound) { tabE.dataset.bound = '1'; tabE.addEventListener('click', function () { setTab(true); }); }
    },

    renderBulletins: function () {
      var self = this;
      var list = document.getElementById('bulletinList');
      if (!list) return;
      var all = Array.isArray(this.state.bulletins) ? this.state.bulletins : [];
      var shown = all.slice(0, this.state.bulletinCount || 6);
      var empty = document.getElementById('bulletinEmpty');
      if (!all.length) {
        list.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
      } else {
        if (empty) empty.classList.add('hidden');
        list.innerHTML = shown.map(function (b) {
          var dateStr = self.fmtEditorialDate(b.date);
          return '<div class="bg-white rounded-2xl border border-emerald-100 p-6 flex flex-col hover:shadow-lg hover:border-emerald/30 transition doc-card">' +
            '<div class="flex items-center gap-2 mb-3 flex-wrap">' +
              (b.category ? '<span class="badge badge-published">' + self.esc(b.category) + '</span>' : '') +
              (dateStr ? '<span class="text-[11px] text-gray-400 font-semibold">' + self.esc(dateStr) + '</span>' : '') +
            '</div>' +
            '<h3 class="font-extrabold text-emerald-dark text-base sm:text-lg mb-2 leading-snug">' + self.esc(b.title) + '</h3>' +
            '<div class="text-sm text-gray-600 leading-relaxed space-y-2 flex-1">' + self.editorialParas(b.summary) + '</div>' +
            (b.link ? '<a href="' + self.esc(b.link) + '" target="_blank" rel="noopener noreferrer" class="mt-4 inline-flex items-center gap-1.5 text-emerald font-bold text-sm hover:underline self-start">Baca selengkapnya →</a>' : '') +
          '</div>';
        }).join('');
      }
      var moreWrap = document.getElementById('bulletinMoreWrap');
      if (moreWrap) moreWrap.classList.toggle('hidden', all.length <= (this.state.bulletinCount || 6));
    },

    renderEvents: function () {
      var self = this;
      var list = document.getElementById('eventList');
      if (!list) return;
      var all = Array.isArray(this.state.events) ? this.state.events : [];
      var shown = all.slice(0, this.state.eventCount || 6);
      var empty = document.getElementById('eventEmpty');
      if (!all.length) {
        list.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
      } else {
        if (empty) empty.classList.add('hidden');
        list.innerHTML = shown.map(function (e) {
          var done = (e.status === 'SELESAI');
          var badge = done
            ? '<span class="badge badge-draft">Selesai (Arsip Kegiatan)</span>'
            : '<span class="badge badge-published">Mendatang</span>';
          return '<div class="rounded-2xl border p-6 flex flex-col hover:shadow-lg transition doc-card ' +
            (done ? 'border-gray-200 bg-gray-50/60 opacity-70' : 'border-emerald-100 bg-white hover:border-emerald/30') + '">' +
            '<div class="flex items-center gap-2 mb-3 flex-wrap">' +
              (e.category ? '<span class="badge badge-pending">' + self.esc(e.category) + '</span>' : '') + badge +
            '</div>' +
            '<h3 class="font-extrabold text-base sm:text-lg mb-3 leading-snug ' + (done ? 'text-gray-500' : 'text-emerald-dark') + '">' + self.esc(e.title) + '</h3>' +
            '<div class="space-y-1.5 text-sm text-gray-600 dark:text-gray-300 mb-3">' +
              (e.date_str ? '<div class="flex items-center gap-2"><svg class="w-4 h-4 text-emerald flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>' + self.esc(e.date_str) + (e.time_str ? ' · ' + self.esc(e.time_str) : '') + '</span></div>' : '') +
              (e.location ? '<div class="flex items-center gap-2"><svg class="w-4 h-4 text-emerald flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span>' + self.esc(e.location) + '</span></div>' : '') +
              (e.speaker ? '<div class="flex items-center gap-2"><svg class="w-4 h-4 text-emerald flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg><span>' + self.esc(e.speaker) + '</span></div>' : '') +
            '</div>' +
            ((e.link && !done) ? '<a href="' + self.esc(e.link) + '" target="_blank" rel="noopener noreferrer" class="mt-auto inline-flex items-center gap-1.5 text-emerald font-bold text-sm hover:underline self-start">Detail &amp; pendaftaran &rarr;</a>' : '') +
          '</div>';
        }).join('');
      }
      var moreWrap = document.getElementById('eventMoreWrap');
      if (moreWrap) moreWrap.classList.toggle('hidden', all.length <= (this.state.eventCount || 6));
    },

    renderEditorialFaq: function (faqs) {
      var self = this;
      var list = document.getElementById('faqList');
      var sec = document.getElementById('faqSection');
      if (!list) return;
      var parentSec = sec ? (sec.parentElement || sec.parentNode || sec) : null;
      var arr = (Array.isArray(faqs) ? faqs : []).filter(function (f) { return f && f.q; });
      if (!arr.length) {
        if (parentSec && parentSec.style) parentSec.style.display = 'none';
        return;
      }
      if (parentSec && parentSec.style && parentSec.style.display === 'none') {
        parentSec.style.display = '';
      }
      list.innerHTML = arr.map(function (f) {
        return '<div class="faq-item bg-white rounded-2xl border border-emerald-100 overflow-hidden">' +
          '<button type="button" class="faq-trigger w-full flex items-center justify-between gap-4 p-5 text-left font-bold text-emerald-dark text-sm sm:text-base hover:bg-emerald-50/50 transition">' +
            '<span>' + self.esc(f.q) + '</span>' +
            '<svg class="faq-chevron h-5 w-5 text-emerald flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" /></svg>' +
          '</button>' +
          '<div class="faq-answer"><div class="px-5 pb-5 pt-4 text-sm text-gray-600 leading-relaxed space-y-2 border-t border-gray-100">' + self.editorialParas(f.a) + '</div></div>' +
        '</div>';
      }).join('');
      // Akordion: hanya satu item terbuka pada satu waktu
      Array.prototype.forEach.call(list.querySelectorAll('.faq-trigger'), function (btn) {
        btn.addEventListener('click', function () {
          var item = btn.closest('.faq-item');
          var isOpen = item.classList.contains('open');
          Array.prototype.forEach.call(list.querySelectorAll('.faq-item.open'), function (o) { o.classList.remove('open'); });
          if (!isOpen) item.classList.add('open');
        });
      });
      // Buka pertanyaan pertama secara default
      var first = list.querySelector('.faq-item');
      if (first) first.classList.add('open');
    },

    renderEditorialContact: function (c, s) {
      if (c && typeof c === 'object') {
        var addr = document.getElementById('contactAddressVal');
        if (addr && c.address) { addr.textContent = c.address; addr.classList.add('whitespace-pre-line'); }
        var email = document.getElementById('contactEmailVal');
        if (email && c.email) email.textContent = c.email;
        var hours = document.getElementById('contactHoursVal');
        if (hours && c.service_hours) hours.textContent = c.service_hours;
        var waCard = document.getElementById('contactWaCard');
        var waVal = document.getElementById('contactWaVal');
        if (waCard && waVal && c.whatsapp_helpdesk) {
          var digits = String(c.whatsapp_helpdesk).replace(/\D/g, '').replace(/^0/, '62');
          waVal.textContent = c.whatsapp_helpdesk;
          waCard.classList.remove('hidden');
          if (digits) {
            waCard.style.cursor = 'pointer';
            waCard.title = 'Chat WhatsApp Helpdesk';
            waCard.addEventListener('click', function () {
              window.open('https://wa.me/' + digits + '?text=' + encodeURIComponent('Halo Sekretariat APII DPW Jabodetabek, saya ingin bertanya terkait informasi portal.'), '_blank', 'noopener');
            });
          }
        }
      }
      this.renderEditorialSocial(s);
    },

    renderEditorialSocial: function (s) {
      var self = this;
      var row = document.getElementById('socialLinksRow');
      if (!row || !s || typeof s !== 'object') return;
      var defs = [
        { url: s.youtube, label: 'YouTube', icon: '<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>' },
        { url: s.instagram, label: 'Instagram', icon: '<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" /></svg>' },
        { url: s.whatsapp_channel, label: 'WhatsApp Channel', icon: '<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.207zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>' },
        { url: s.facebook, label: 'Facebook', icon: '<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>' },
        { url: s.tiktok, label: 'TikTok', icon: '<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.14-5.91 3.18-1.86.04-3.69-.68-5.04-1.92-1.99-1.83-2.85-4.73-2.16-7.36.69-2.62 2.94-4.72 5.6-5.25.32-.06.65-.1.98-.11v4.04c-1.66.38-2.98 1.96-2.98 3.7 0 1.72 1.31 3.31 2.98 3.69 1.69.4 3.56-.45 4.29-2.03.26-.53.4-1.12.41-1.71.02-3.13.01-6.25.01-9.38.01-1.08-.01-2.16.02-3.24.08-1.13.34-2.22.79-3.24.31-.72.75-1.39 1.28-1.97-.01 0 .01 0 .02.01z" /></svg>' }
      ];
      var links = defs.filter(function (d) { return d.url; });
      if (!links.length) return;
      row.innerHTML = links.map(function (d) {
        return '<a href="' + self.esc(d.url) + '" target="_blank" rel="noopener noreferrer" aria-label="' + self.esc(d.label) + '" class="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition">' + d.icon + '<span>' + self.esc(d.label) + '</span></a>';
      }).join('');
      row.classList.remove('hidden');
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
              '<div class="public-surat-card p-4 rounded-2xl bg-gray-50/80 hover:bg-emerald-50/50 border border-gray-200/90 hover:border-emerald-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">' +
                '<div class="flex-1 min-w-0">' +
                  '<div class="flex items-center gap-2 mb-1 flex-wrap">' +
                    '<span class="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">' + self.esc(s.letter_type_label || s.letter_type) + '</span>' +
                    '<span class="text-xs text-gray-400 font-medium">' + self.esc(s.tanggal_label || '') + '</span>' +
                  '</div>' +
                  '<h4 class="font-bold text-gray-900 text-sm leading-snug break-words">' + self.esc(s.title) + '</h4>' +
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
              '<div class="public-account-card p-4 sm:p-5 rounded-2xl bg-gradient-to-br ' + colorBg + ' border shadow-xs transition hover:shadow-md">' +
                '<div class="flex items-center justify-between mb-2.5 flex-wrap gap-2">' +
                  '<div class="flex items-center gap-2">' +
                    '<span class="text-xs font-black text-gray-950 uppercase tracking-wide">' + self.esc(bankName) + '</span>' +
                  '</div>' +
                  '<span class="text-[10px] font-bold ' + colorBadge + ' px-2.5 py-0.5 rounded-full border shadow-2xs">' + self.esc(category) + '</span>' +
                '</div>' +
                '<div class="public-account-num-box flex items-center justify-between gap-3 mt-1.5 flex-wrap sm:flex-nowrap bg-white/70 p-3 rounded-xl border border-white/60">' +
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
              '</div>';
          }).join('');
          container.classList.remove('hidden');
          if (emptyEl) emptyEl.classList.add('hidden');
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
  };

  window.Public = Public;
  document.addEventListener('DOMContentLoaded', function () { Public.init(); });
})();
