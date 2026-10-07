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
      registration: null
    },

    init: function () {
      this.bindMobileNav();
      this.bindRegistrationForm();
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
      if (regCfg.is_open === false) {
        return showAlert(regCfg.closed_message || 'Pendaftaran anggota saat ini sedang ditutup oleh panitia/sekretariat.', true);
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
    // KONFIGURASI PUBLIK & PENDAFTARAN DINAMIS
    // ---------------------------------------------------------------
    loadPublicConfig: function () {
      var self = this;
      this.get('getPublicSettings').then(function (res) {
        if (!res || !res.success || !res.data) return;
        var d = res.data;
        var reg = d.registration || {};
        self.state.registration = reg;

        // 1. Visibilitas Menu Pendaftaran Publik (RBAC)
        if (d.config && d.config.show_registration === false) {
          var pendaftarNav = document.querySelectorAll('a[href="#pendaftaran"]');
          for (var i = 0; i < pendaftarNav.length; i++) {
            pendaftarNav[i].classList.add('hidden');
          }
          var secPendaftaran = document.getElementById('pendaftaran');
          if (secPendaftaran) secPendaftaran.classList.add('hidden');
          return;
        }

        // 2. Status Buka / Tutup Pendaftaran
        var form = document.getElementById('regMemberForm');
        var closedBox = document.getElementById('regClosedStateBox');
        var heroBadge = document.getElementById('heroRegBadge');

        if (reg.is_open === false) {
          if (heroBadge) {
            heroBadge.textContent = 'PENDAFTARAN DITUTUP SEMENTARA';
            heroBadge.className = 'absolute -top-4 -right-4 bg-amber-500 text-white text-xs font-black px-3.5 py-1.5 rounded-xl shadow-lg';
          }
          if (form) form.classList.add('hidden');
          if (closedBox) {
            closedBox.classList.remove('hidden');
            var cTitle = closedBox.querySelector('.closed-title');
            var cMsg = closedBox.querySelector('.closed-msg');
            if (cTitle) cTitle.textContent = reg.closed_title || 'Pendaftaran Anggota Sementara Ditutup';
            if (cMsg) cMsg.textContent = reg.closed_message || 'Pendaftaran gelombang saat ini telah ditutup atau sedang dalam proses verifikasi kuota. Pantau pengumuman resmi berkala dari sekretariat yayasan.';
          }
        } else {
          if (form) form.classList.remove('hidden');
          if (closedBox) closedBox.classList.add('hidden');
        }

        // 3. Filter Pilihan Divisi yang Membuka Rekrutmen
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

        // 4. Petunjuk & Pengantar
        if (reg.instructions) {
          var pDesc = document.querySelector('#pendaftaran p.text-gray-600');
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
            return '' +
              '<div class="p-4 rounded-2xl bg-gray-50/80 hover:bg-emerald-50/50 border border-gray-200/90 hover:border-emerald-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">' +
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
