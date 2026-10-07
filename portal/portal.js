/**
 * ============================================================================
 * portal.js — Aplikasi Portal Pengurus (siapii.sigitadi.id)
 * ============================================================================
 * Arsitektur: satu file, hash router (#/dashboard, #/surat, ...).
 *   App.init()   → restore sesi → tampilkan login atau boot aplikasi
 *   App.router() → render halaman sesuai hash & peran (RBAC dari backend)
 * Semua data backend di-escape (Auth.esc) sebelum innerHTML.
 * ==========================================================================*/
(function () {
  'use strict';

  var App = {
    // State memori per modul (filter & paginasi).
    state: {
      page: 'dashboard',
      user: null,
      surat: { status: '', q: '', page: 1 },
      keuangan: { status: '', type: '', q: '', page: 1 },
      divisi: { status: '', q: '', page: 1 },
      pengguna: { tab: 'pengurus', q: '', page: 1 },
      pengaturan: { tab: 'rekening' },
      audit: { modul: '', actor: '', page: 1 }
    },

    /** Konversi angka ke kalimat rupiah Indonesia untuk Kwitansi / Bukti Kas. */
    terbilang: function (n) {
      n = Math.floor(Math.abs(Number(n) || 0));
      if (n === 0) return 'Nol Rupiah';
      var satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
      function convert(num) {
        if (num < 12) return satuan[num];
        if (num < 20) return convert(num - 10) + ' Belas';
        if (num < 100) return convert(Math.floor(num / 10)) + ' Puluh' + (num % 10 ? ' ' + convert(num % 10) : '');
        if (num < 200) return 'Seratus' + (num % 100 ? ' ' + convert(num % 100) : '');
        if (num < 1000) return convert(Math.floor(num / 100)) + ' Ratus' + (num % 100 ? ' ' + convert(num % 100) : '');
        if (num < 2000) return 'Seribu' + (num % 1000 ? ' ' + convert(num % 1000) : '');
        if (num < 1000000) return convert(Math.floor(num / 1000)) + ' Ribu' + (num % 1000 ? ' ' + convert(num % 1000) : '');
        if (num < 1000000000) return convert(Math.floor(num / 1000000)) + ' Juta' + (num % 1000000 ? ' ' + convert(num % 1000000) : '');
        if (num < 1000000000000) return convert(Math.floor(num / 1000000000)) + ' Miliar' + (num % 1000000000 ? ' ' + convert(num % 1000000000) : '');
        return convert(Math.floor(num / 1000000000000)) + ' Triliun' + (num % 1000000000000 ? ' ' + convert(num % 1000000000000) : '');
      }
      return (convert(n).trim() + ' Rupiah').replace(/\s+/g, ' ');
    },

    /** Prefetch data rute di background agar transisi 0ms instan tanpa jeda. */
    prefetchRoute: function (key) {
      if (key === 'dashboard') {
        Auth.getCached('getDashboard');
      } else if (key === 'surat') {
        Auth.getCached('getListSurat', { q: '', status: '', limit: 50 });
      } else if (key === 'keuangan') {
        Auth.getCached('getSaldo');
        Auth.getCached('getListKeuangan', { q: '', status: '', type: '', limit: 50 });
        Auth.getCached('getAccounts');
      } else if (key === 'divisi') {
        Auth.getCached('getListDivisi', { q: '', status: '', limit: 50 });
      } else if (key === 'pengguna') {
        Auth.getCached('getListPengguna');
        Auth.getCached('getListPendaftar');
      } else if (key === 'pengaturan') {
        Auth.getCached('getAccounts');
        Auth.getCached('getSettings');
      } else if (key === 'audit') {
        Auth.getCached('getAuditLogs', { limit: 200 });
      }
    },

    // ---------------------------------------------------------------
    // SIKLUS HIDUP
    // ---------------------------------------------------------------
    init: function () {
      var self = this;

      // Binding halaman login.
      this.bindLogin();

      // Binding global.
      this.bindGlobal();

      // Sediakan chip akun demo.
      this.renderDemoAccounts();

      // Coba restore sesi dari localStorage.
      var restored = Auth.restore();
      var hash = window.location.hash || '';

      if (restored && hash.indexOf('#login') !== 0) {
        // Validasi token ke backend; bila 401 → Auth.fetch sudah redirect.
        Auth.me().then(function (u) {
          if (u) self.bootApp(u);
          else self.showLogin();
        }).catch(function () { self.showLogin(); });
      } else {
        this.showLogin(hash);
      }
    },

    /** Tampilkan halaman login (sembunyikan aplikasi). */
    showLogin: function (hash) {
      var hp = document.getElementById('loginPage');
      var ap = document.getElementById('appPage');
      if (hp) hp.classList.remove('hidden');
      if (ap) ap.classList.add('hidden');

      // Pesan redirect (mis. "Sesi berakhir").
      var alert = document.getElementById('loginAlert');
      if (alert) {
        var m = /msg=([^&]+)/.exec(hash || window.location.hash || '');
        if (m) {
          alert.textContent = decodeURIComponent(m[1]);
          alert.className = 'mb-6 px-4 py-3 rounded-xl text-sm font-medium bg-red-50 text-red-700 border border-red-100';
        } else {
          alert.classList.add('hidden');
        }
      }
      var u = document.getElementById('loginUsername');
      if (u) u.focus();
      window.location.hash = '#login';
    },

    /** Boot aplikasi setelah login valid. */
    bootApp: function (user) {
      var self = this;
      this.state.user = user || Auth.user;
      var hp = document.getElementById('loginPage');
      var ap = document.getElementById('appPage');
      if (hp) hp.classList.add('hidden');
      if (ap) ap.classList.remove('hidden');

      // Topbar.
      this.renderTopbar();

      // Sidebar.
      this.renderNav();

      // Prefetch data rute penting di background untuk navigasi 0ms.
      this.prefetchRoute('dashboard');
      this.prefetchRoute('surat');
      this.prefetchRoute('keuangan');

      // Router pertama kali & listener hashchange terikat scope.
      if (this._onHashChange) window.removeEventListener('hashchange', this._onHashChange);
      this._onHashChange = function () { self.router(); };
      window.addEventListener('hashchange', this._onHashChange);
      this.router();
    },

    // ---------------------------------------------------------------
    // LOGIN
    // ---------------------------------------------------------------
    bindLogin: function () {
      var form = document.getElementById('loginForm');
      if (!form) return;
      var self = this;

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var u = (document.getElementById('loginUsername').value || '').trim();
        var p = document.getElementById('loginPassword').value || '';
        if (!u || !p) return;

        // State loading.
        var btn = document.getElementById('loginBtn');
        var spin = document.getElementById('loginSpinner');
        var txt = document.getElementById('loginBtnText');
        var alert = document.getElementById('loginAlert');
        btn.disabled = true; spin.classList.remove('hidden'); txt.textContent = 'Memproses…';
        alert.classList.add('hidden');

        Auth.login(u, p).then(function (user) {
          btn.disabled = false; spin.classList.add('hidden'); txt.textContent = 'Masuk';
          if (user) self.bootApp(user);
          else self.showLogin();
        }).catch(function (err) {
          btn.disabled = false; spin.classList.add('hidden'); txt.textContent = 'Masuk';
          alert.textContent = err.message || 'Login gagal. Periksa username & password Anda.';
          alert.className = 'mb-6 px-4 py-3 rounded-xl text-sm font-medium bg-red-50 text-red-700 border border-red-100';
        });
      });
    },

    /** Chip akun demo (klik isi username + password). */
    renderDemoAccounts: function () {
      var box = document.getElementById('demoAccounts');
      if (!box) return;
      box.innerHTML = (window.DEMO_ACCOUNTS || []).map(function (a) {
        return '<button type="button" data-demo="' + a.u +
          '" class="text-xs px-3 py-1.5 rounded-lg bg-emerald-light text-emerald-dark font-semibold hover:bg-emerald hover:text-white transition">' +
          a.u + '</button>';
      }).join('');
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-demo]');
        if (!b) return;
        document.getElementById('loginUsername').value = b.getAttribute('data-demo');
        document.getElementById('loginPassword').value = 'apii2026';
        document.getElementById('loginPassword').focus();
      });
    },

    // ---------------------------------------------------------------
    // TOPBAR & SIDEBAR
    // ---------------------------------------------------------------
    renderTopbar: function () {
      var u = this.state.user;
      var av = document.getElementById('userAvatar');
      var nm = document.getElementById('userName');
      var rl = document.getElementById('userRole');
      if (av) av.textContent = Auth.initials();
      if (nm) nm.textContent = u.full_name || u.username;
      var role = u.role_label || (window.ROLES[u.role] || u.role);
      if (u.division_label) role += ' · ' + u.division_label;
      if (rl) rl.textContent = role;
    },

    /** Daftar menu sesuai peran (RBAC frontend; backend tetap penjaga mutlak). */
    navForRole: function (role) {
      var items = [{ id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' }];
      var has = function (arr) { return arr.indexOf(role) !== -1; };

      if (has(['SUPERADMIN', 'KETUA', 'SEKRETARIS', 'PEMBINA', 'PENGAWAS'])) {
        items.push({ id: 'surat', label: 'Persuratan', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' });
      }
      if (has(['SUPERADMIN', 'KETUA', 'BENDAHARA', 'PEMBINA', 'PENGAWAS'])) {
        items.push({ id: 'keuangan', label: 'Keuangan', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' });
      }
      // Divisi Kerja untuk semua 8 peran pengurus
      items.push({ id: 'divisi', label: 'Divisi Kerja', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' });
      // Daftar akun: read-only untuk pengurus inti; tulis hanya SUPERADMIN.
      if (has(['SUPERADMIN', 'KETUA', 'SEKRETARIS', 'BENDAHARA'])) {
        items.push({ id: 'pengguna', label: 'Manajemen Pengguna', icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-3.13a4 4 0 10-8 0 4 4 0 008 0zm6 0a4 4 0 10-8 0 4 4 0 008 0z' });
      }
      if (has(['SUPERADMIN', 'KETUA', 'PEMBINA', 'PENGAWAS'])) {
        items.push({ id: 'audit', label: 'Jejak Audit', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' });
      }
      if (has(['SUPERADMIN', 'KETUA'])) {
        items.push({ id: 'pengaturan', label: 'Pengaturan & Master', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' });
      }
      items.push({ id: 'profil', label: 'Profil Saya', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' });
      return items;
    },

    renderNav: function () {
      var nav = document.getElementById('navItems');
      if (!nav) return;
      var items = this.navForRole(this.state.user.role);
      nav.innerHTML = items.map(function (it) {
        return '<button data-nav="' + it.id + '" class="nav-item w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700">' +
          '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="' + it.icon + '" /></svg>' +
          '<span>' + it.label + '</span></button>';
      }).join('');
    },

    // ---------------------------------------------------------------
    // ROUTER
    // ---------------------------------------------------------------
    PAGES: {
      dashboard: { t: 'Dashboard', s: 'Ringkasan aktivitas yayasan', fn: 'renderDashboard' },
      surat: { t: 'Persuratan', s: 'Kelola surat resmi: draf → persetujuan → terbit', fn: 'renderSurat' },
      keuangan: { t: 'Keuangan', s: 'Buku kas & voucher dengan verifikasi ganda', fn: 'renderKeuangan' },
      divisi: { t: 'Divisi Kerja', s: 'Usulan program dari 7 divisi kerja', fn: 'renderDivisi' },
      pengguna: { t: 'Manajemen Pengguna', s: 'Kelola akun pengurus sistem & pendaftar anggota', fn: 'renderPengguna' },
      audit: { t: 'Jejak Audit', s: 'Catatan keamanan & log kepatuhan (WORM - Anti-Hapus)', fn: 'renderAudit' },
      pengaturan: { t: 'Pengaturan & Master Data', s: 'Master rekening kas, format KOP surat, pendaftaran anggota, RBAC, dan Google Drive', fn: 'renderPengaturan' },
      profil: { t: 'Profil Saya', s: 'Informasi akun Anda', fn: 'renderProfil' }
    },

    router: function () {
      var self = (this && this.PAGES) ? this : window.App;
      var hash = (window.location.hash || '#/dashboard').replace('#', '').replace('/', '');
      var key = hash.split('&')[0];
      var page = self.PAGES[key];
      if (!page) { page = self.PAGES.dashboard; key = 'dashboard'; }
      self.state.page = key;

      // Hanya render bila menu tersedia untuk peran ini.
      var allowed = self.navForRole(self.state.user.role).some(function (n) { return n.id === key; });
      if (!allowed) { page = self.PAGES.dashboard; self.state.page = 'dashboard'; }

      document.getElementById('pageTitle').textContent = page.t;
      document.getElementById('pageSubtitle').textContent = page.s;

      // Tandai menu aktif.
      var nav = document.getElementById('navItems');
      if (nav) {
        Array.prototype.forEach.call(nav.children, function (btn) {
          btn.classList.toggle('active', btn.getAttribute('data-nav') === self.state.page);
        });
      }

      self.closeSidebar();

      // Transisi instan dengan progress bar halus di bagian atas
      if (typeof Auth.showProgress === 'function') Auth.showProgress();
      self[page.fn]();
      setTimeout(function () {
        if (typeof Auth.hideProgress === 'function') Auth.hideProgress();
      }, 350);
    },

    bindGlobal: function () {
      var self = this;

      // Klik menu navigasi.
      document.getElementById('navItems').addEventListener('click', function (e) {
        var b = e.target.closest('[data-nav]');
        if (!b) return;
        window.location.hash = '#/' + b.getAttribute('data-nav');
      });

      // Prefetch data saat kursor mouse hover di atas tombol navigasi (0ms latency).
      document.getElementById('navItems').addEventListener('mouseenter', function (e) {
        var b = e.target.closest('[data-nav]');
        if (b) self.prefetchRoute(b.getAttribute('data-nav'));
      }, true);

      // Menu user.
      var umb = document.getElementById('userMenuBtn');
      var um = document.getElementById('userMenu');
      umb.addEventListener('click', function (e) {
        e.stopPropagation();
        um.classList.toggle('hidden');
      });
      document.addEventListener('click', function (e) {
        if (!um.classList.contains('hidden') && !um.contains(e.target) && !umb.contains(e.target)) {
          um.classList.add('hidden');
        }
      });
      um.addEventListener('click', function (e) {
        var b = e.target.closest('.user-menu-item');
        if (b) { um.classList.add('hidden'); window.location.hash = '#/' + b.getAttribute('data-nav'); }
      });

      // Logout.
      document.getElementById('logoutBtn').addEventListener('click', function () { Auth.logout(); });

      // Toggle sidebar mobile.
      document.getElementById('menuToggle').addEventListener('click', function () {
        document.getElementById('sidebar').classList.toggle('-translate-x-full');
        document.getElementById('sidebarOverlay').classList.toggle('hidden');
      });
      document.getElementById('sidebarOverlay').addEventListener('click', function () { self.closeSidebar(); });

      // Tutup modal saat klik backdrop / ESC.
      var root = document.getElementById('modalRoot');
      root.addEventListener('click', function (e) { if (e.target === root) self.closeModal(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') self.closeModal(); });
    },

    closeSidebar: function () {
      document.getElementById('sidebar').classList.add('-translate-x-full');
      document.getElementById('sidebarOverlay').classList.add('hidden');
    },

    /** Toast singkat di pojok kanan atas, mendukung aksi cepat (mis. Bagikan ke WA). */
    toast: function (msg, type, actionLabel, onAction) {
      var box = document.getElementById('toastContainer');
      var colors = { success: 'bg-emerald text-white', error: 'bg-red-600 text-white', info: 'bg-gray-800 text-white' };
      var icons = {
        success: 'M5 13l4 4L19 7', error: 'M6 18L18 6M6 6l12 12', info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
      };
      var el = document.createElement('div');
      el.className = 'toast ' + (colors[type] || colors.info) +
        ' px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center justify-between gap-3';

      var leftHtml = '<div class="flex items-center gap-2.5 min-w-0">' +
        '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="' + (icons[type] || icons.info) + '" /></svg>' +
        '<span class="truncate">' + Auth.esc(msg) + '</span>' +
        '</div>';

      var rightHtml = '';
      if (actionLabel && typeof onAction === 'function') {
        rightHtml = '<button type="button" class="toast-act-btn px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0 shadow-sm">' +
          '<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>' +
          Auth.esc(actionLabel) +
          '</button>';
      }

      el.innerHTML = leftHtml + rightHtml;
      box.appendChild(el);

      var actBtn = el.querySelector('.toast-act-btn');
      if (actBtn) {
        actBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          onAction();
        });
      }

      var duration = (actionLabel && typeof onAction === 'function') ? 6000 : 3600;
      setTimeout(function () {
        el.style.transition = 'opacity .3s, transform .3s';
        el.style.opacity = '0'; el.style.transform = 'translateX(24px)';
        setTimeout(function () { el.remove(); }, 320);
      }, duration);
    },

    /** Buka link WhatsApp Quick Share. */
    openWhatsApp: function (text) {
      if (!text) return;
      var url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text);
      window.open(url, '_blank', 'noopener,noreferrer');
    },

    /** Format teks WhatsApp untuk Surat Resmi. */
    buildSuratWaText: function (s) {
      var stat = s.status_label || s.status || 'DRAF';
      var pembuat = s.created_by_name || s.created_by || 'Sekretariat';
      var portalUrl = window.PORTAL_URL || 'https://siapii.sigitadi.id';
      var text = '🏛️ *SIAP APII — SURAT RESMI*\n' +
        '━━━━━━━━━━━━━━━━━━━\n' +
        '📄 *Nomor:* ' + (s.letter_number || '(Draf)') + '\n' +
        '📌 *Perihal:* ' + (s.title || '-') + '\n' +
        '🏷️ *Jenis:* ' + (s.letter_type_label || s.letter_type || 'Surat') + '\n' +
        '📅 *Tanggal:* ' + (s.tanggal_label || s.tanggal_surat || '-') + '\n' +
        '⚡ *Status:* ' + stat + '\n' +
        '👤 *Pembuat:* ' + pembuat + '\n';
      if (s.rejection_notes) {
        text += '⚠️ *Catatan:* ' + s.rejection_notes + '\n';
      }
      if (s.pdf_url) {
        text += '📥 *Unduh PDF:* ' + s.pdf_url + '\n';
      }
      if (s.qr_verify_url) {
        text += '🔒 *Verifikasi Dokumen:* ' + s.qr_verify_url + '\n';
      }
      text += '━━━━━━━━━━━━━━━━━━━\n' +
        '🌐 *Buka Portal:* ' + portalUrl + '/#/surat';
      return text;
    },

    /** Format teks WhatsApp untuk Voucher Keuangan. */
    buildKeuanganWaText: function (k) {
      var stat = k.status_label || k.status || 'PENDING';
      var jenis = k.type === 'MASUK' ? 'Kas Masuk (+)' : 'Kas Keluar (−)';
      var portalUrl = window.PORTAL_URL || 'https://siapii.sigitadi.id';
      var text = '💵 *SIAP APII — BUKU KAS & VOUCHER*\n' +
        '━━━━━━━━━━━━━━━━━━━\n' +
        '🔖 *No. Voucher:* ' + (k.voucher_number || '-') + '\n' +
        '📂 *Jenis:* ' + jenis + '\n' +
        '💰 *Nominal:* ' + (k.amount_label || ('Rp ' + Number(k.amount || 0).toLocaleString('id-ID'))) + '\n' +
        '📝 *Keterangan:* ' + (k.description || '-') + '\n' +
        '🏷️ *Akun:* ' + (k.account_label || k.account || '-') + '\n' +
        '📅 *Tanggal:* ' + (k.transaction_date || '-') + '\n' +
        '⚡ *Status:* ' + stat + '\n' +
        '👤 *Dibuat Oleh:* ' + (k.created_by || '-') + '\n';
      if (k.receipt_url) {
        text += '📎 *Bukti Kas:* ' + k.receipt_url + '\n';
      }
      if (k.verified_by_bendahara) {
        text += '✅ *Verifikasi Bendahara:* ' + k.verified_by_bendahara + '\n';
      }
      if (k.approved_by_ketum) {
        text += '🌟 *Verifikasi Ketua:* ' + k.approved_by_ketum + '\n';
      }
      if (k.rejection_notes) {
        text += '⚠️ *Catatan Penolakan:* ' + k.rejection_notes + '\n';
      }
      text += '━━━━━━━━━━━━━━━━━━━\n' +
        '🌐 *Buka Portal:* ' + portalUrl + '/#/keuangan';
      return text;
    },

    /** Format teks WhatsApp untuk Usulan Program Divisi. */
    buildDivisiWaText: function (d) {
      var stat = d.status_label || d.status || 'DRAFT';
      var portalUrl = window.PORTAL_URL || 'https://siapii.sigitadi.id';
      var text = '🎯 *SIAP APII — USULAN PROGRAM DIVISI*\n' +
        '━━━━━━━━━━━━━━━━━━━\n' +
        '🔖 *Tracking ID:* ' + (d.tracking_id || '-') + '\n' +
        '💡 *Program:* ' + (d.program_title || '-') + '\n' +
        '🏢 *Divisi:* ' + (d.division_label || d.division || '-') + '\n' +
        '💰 *Estimasi Anggaran:* ' + (d.budget_label || ('Rp ' + Number(d.budget_estimate || 0).toLocaleString('id-ID'))) + '\n';
      if (d.realisasi_anggaran) {
        text += '💵 *Realisasi Anggaran:* ' + (d.realisasi_label || ('Rp ' + Number(d.realisasi_anggaran).toLocaleString('id-ID'))) + '\n';
      }
      text += '📅 *Target Pelaksanaan:* ' + (d.execution_date || '-') + '\n' +
        '👥 *Target Peserta:* ' + (d.target_audience || '-') + '\n' +
        '⚡ *Status:* ' + stat + '\n';
      if (d.started_at) {
        text += '🚀 *Mulai Pelaksanaan:* ' + d.started_at.slice(0, 10) + '\n';
      }
      if (d.lpj_url) {
        text += '📄 *Dokumen LPJ:* ' + d.lpj_url + '\n';
      }
      if (d.rejection_notes) {
        text += '⚠️ *Catatan Penolakan:* ' + d.rejection_notes + '\n';
      }
      text += '━━━━━━━━━━━━━━━━━━━\n' +
        '🌐 *Buka Portal:* ' + portalUrl + '/#/divisi';
      return text;
    },

    /** Buka modal dengan HTML bebas. */
    openModal: function (html, maxWidthClass) {
      var panel = document.getElementById('modalPanel');
      panel.className = 'modal-panel bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full ' + (maxWidthClass || 'max-w-lg') + ' max-h-[92vh] overflow-y-auto';
      panel.innerHTML = html;
      document.getElementById('modalRoot').classList.remove('hidden');
    },

    closeModal: function () {
      document.getElementById('modalRoot').classList.add('hidden');
      var panel = document.getElementById('modalPanel');
      panel.className = 'modal-panel bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto';
      panel.innerHTML = '';
    },

    /** Baris skeleton saat tabel masih memuat. */
    loadingRow: function (cols) {
      return '<tr class="tbl-empty"><td colspan="' + cols + '" class="text-center text-gray-400 py-10">Memuat data…</td></tr>';
    },

    /** Tombol aksi WhatsApp kecil dengan ikon resmi. */
    waBtn: function (title) {
      return '<button data-act="wa" title="' + (title || 'Bagikan ke WhatsApp') + '" class="p-1.5 rounded-lg font-semibold transition btn-wa-ghost inline-flex items-center justify-center flex-shrink-0">' +
        '<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>' +
        '</button>';
    },

    /** Tombol aksi kecil. */
    aBtn: function (cls, label, title) {
      return '<button data-act="' + cls + '" title="' + (title || label) +
        '" class="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition ' +
        (cls === 'danger' ? 'bg-red-50 text-red-600 hover:bg-red-100' :
          cls === 'gold' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' :
          'bg-emerald-light text-emerald-dark hover:bg-emerald hover:text-white') +
        '">' + label + '</button>';
    },

    /** Badge status (class .badge-<STATUS>). */
    badge: function (status, label) {
      return '<span class="badge badge-' + status + '">' + Auth.esc(label) + '</span>';
    },

    /** Header standar halaman (judul + tombol kanan). */
    pageHead: function (title, desc, actionsHtml) {
      return '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">' +
        '<div><h2 class="text-xl font-extrabold text-emerald-dark">' + title + '</h2>' +
        '<p class="text-sm text-gray-500 mt-1">' + desc + '</p></div>' +
        (actionsHtml ? '<div class="flex gap-2 flex-wrap">' + actionsHtml + '</div>' : '') +
        '</div>';
    },

    // ---------------------------------------------------------------
    // DASHBOARD
    // ---------------------------------------------------------------
    renderDashboard: function () {
      var main = document.getElementById('mainContent');
      var u = this.state.user;
      var self = this;

      main.innerHTML = this.pageHead('Selamat datang, ' + Auth.esc(u.full_name || u.username) + ' 👋',
        'Ringkasan aktivitas Yayasan APII DPW Jabodetabek hari ini.', '') +
        '<div id="dashInbox" class="mb-8"></div>' +
        '<div id="dashCards" class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">' +
          '<div class="card bg-white rounded-2xl p-6 animate-pulse h-28"></div>'.repeat(4) +
        '</div>' +
        '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">' +
          '<div class="px-6 py-4 border-b border-emerald-100 flex items-center justify-between">' +
            '<h3 class="font-bold text-emerald-dark">Surat Terbaru</h3>' +
            '<button data-nav="surat" class="text-sm text-emerald font-semibold hover:underline">Lihat semua →</button>' +
          '</div>' +
          '<div class="overflow-x-auto"><table class="tbl tbl-responsive"><thead><tr>' +
            '<th>Nomor &amp; Judul</th><th>Status</th><th>Tanggal</th>' +
            '</tr></thead><tbody id="dashSurat">' + this.loadingRow(3) + '</tbody></table></div>' +
        '</div>';

      // Klik "Lihat semua".
      main.querySelector('[data-nav="surat"]').addEventListener('click', function () {
        window.location.hash = '#/surat';
      });

      Auth.get('getDashboard').then(function (data) {
        if (!data) return;

        // 1) Unified Action Inbox
        var inboxEl = document.getElementById('dashInbox');
        if (inboxEl) {
          var items = data.action_items || [];
          if (items.length > 0) {
            var itemsHtml = items.map(function (it, idx) {
              var modColor = it.module === 'surat'
                ? 'bg-amber-100 text-amber-700'
                : it.module === 'keuangan'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-blue-100 text-blue-700';

              var iconSvg = it.module === 'surat'
                ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>'
                : it.module === 'keuangan'
                  ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>'
                  : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>';

              return '<div class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-emerald-50/50 transition border-b border-gray-100 last:border-b-0">' +
                '<div class="flex items-start gap-3.5 min-w-0">' +
                  '<div class="mt-0.5 w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center ' + modColor + '">' +
                    iconSvg +
                  '</div>' +
                  '<div class="min-w-0 flex-1">' +
                    '<div class="flex items-center gap-2 flex-wrap mb-1">' +
                      '<span class="badge ' + Auth.esc(it.badge_class || 'badge-PENDING') + '">' + Auth.esc(it.badge) + '</span>' +
                      '<span class="text-xs font-mono text-gray-500">' + Auth.esc(it.subtitle) + '</span>' +
                    '</div>' +
                    '<h4 class="text-sm font-bold text-gray-900 truncate">' + Auth.esc(it.title) + '</h4>' +
                    '<p class="text-xs text-gray-500 mt-0.5">' + Auth.esc(it.detail) + '</p>' +
                  '</div>' +
                '</div>' +
                '<div class="flex items-center gap-2 sm:self-center flex-shrink-0 w-full sm:w-auto">' +
                  '<button type="button" data-inbox-wa="' + idx + '" class="btn btn-wa-ghost text-xs px-3 py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm" title="Bagikan ke WhatsApp">' +
                    '<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>' +
                    '<span>WA</span>' +
                  '</button>' +
                  '<button type="button" data-nav-target="' + Auth.esc(it.target_nav) + '" data-item-id="' + Auth.esc(it.id) + '" class="flex-1 sm:flex-initial btn btn-primary text-xs px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm">' +
                    '<span>' + Auth.esc(it.action_label || 'Tinjau') + '</span>' +
                    '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>' +
                  '</button>' +
                '</div>' +
              '</div>';
            }).join('');

            inboxEl.innerHTML = '<div class="card bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden ring-4 ring-amber-50/50">' +
              '<div class="px-5 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center justify-between">' +
                '<div class="flex items-center gap-2.5">' +
                  '<div class="w-2.5 h-2.5 rounded-full bg-white animate-ping"></div>' +
                  '<h3 class="font-extrabold text-sm tracking-wide flex items-center gap-1.5">' +
                    '<span>⚡ PERLU TINDAKAN ANDA</span>' +
                  '</h3>' +
                '</div>' +
                '<span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-white">' +
                  items.length + ' Menunggu' +
                '</span>' +
              '</div>' +
              '<div class="divide-y divide-gray-100">' + itemsHtml + '</div>' +
            '</div>';

            inboxEl.querySelectorAll('[data-inbox-wa]').forEach(function (btn) {
              btn.addEventListener('click', function () {
                var idx = parseInt(this.getAttribute('data-inbox-wa'), 10);
                var it = items[idx];
                if (!it) return;
                var text = '⚡ *TINDAKAN DIPERLUKAN — SIAP APII*\n' +
                  '━━━━━━━━━━━━━━━━━━━\n' +
                  '📌 *' + it.badge + ':* ' + it.title + '\n' +
                  '🔖 *Keterangan:* ' + it.subtitle + '\n' +
                  'ℹ️ *Rincian:* ' + it.detail + '\n' +
                  '━━━━━━━━━━━━━━━━━━━\n' +
                  '🌐 *Tinjau di Portal:* ' + (window.PORTAL_URL || 'https://siapii.sigitadi.id') + '/#/' + it.target_nav;
                self.openWhatsApp(text);
              });
            });

            inboxEl.querySelectorAll('[data-nav-target]').forEach(function (btn) {
              btn.addEventListener('click', function () {
                var target = this.getAttribute('data-nav-target');
                window.location.hash = '#/' + target;
              });
            });
          } else {
            inboxEl.innerHTML = '<div class="rounded-2xl p-4 bg-emerald-50/80 border border-emerald-200/80 text-emerald-900 flex items-center gap-3.5">' +
              '<div class="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">' +
                '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>' +
              '</div>' +
              '<div class="text-xs sm:text-sm">' +
                '<span class="font-bold text-emerald-950">Semua Beres!</span> Tidak ada dokumen atau permohonan yang memerlukan tindakan Anda saat ini.' +
              '</div>' +
            '</div>';
          }
        }

        var c = data.counts || {};
        var cards = [];

        if ('surat_total' in c) {
          cards.push(self.statCard('Surat Resmi', c.surat_total, 'Menunggu: ' + (c.surat_pending || 0), 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'));
        }
        if ('saldo' in c) {
          cards.push(self.statCard('Saldo Kas', 'Rp ' + Number(c.saldo || 0).toLocaleString('id-ID'),
            'Masuk: Rp ' + Number(c.total_masuk || 0).toLocaleString('id-ID'), 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'));
        }
        if ('keuangan_total' in c) {
          cards.push(self.statCard('Voucher', c.keuangan_total, 'Dalam proses: ' + (c.keuangan_pending || 0), 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z'));
        }
        if ('divisi_total' in c) {
          cards.push(self.statCard('Usulan Divisi', c.divisi_total, 'Menunggu: ' + (c.divisi_pending || 0), 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'));
        }
        if ('pengguna_total' in c) {
          cards.push(self.statCard('Pengguna', c.pengguna_total, 'Akun terdaftar di sistem', 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-3.13a4 4 0 10-8 0 4 4 0 008 0zm6 0a4 4 0 10-8 0 4 4 0 008 0z'));
        }
        document.getElementById('dashCards').innerHTML = cards.join('');

        // Surat terbaru.
        var list = (data.lists && data.lists.surat_terbaru) || [];
        var tb = document.getElementById('dashSurat');
        tb.innerHTML = list.length ? list.map(function (s) {
          return '<tr>' +
            '<td><div class="font-mono text-xs text-gray-500">' + Auth.esc(s.letter_number) + '</div>' +
              '<div class="font-semibold text-emerald-dark">' + Auth.esc(s.title) + '</div></td>' +
            '<td><span class="sm:hidden text-gray-400 font-medium text-xs">Status: </span>' + self.badge(s.status, s.status_label) + '</td>' +
            '<td class="text-gray-500 whitespace-nowrap text-xs"><span class="sm:hidden text-gray-400 font-medium">Tanggal: </span>' + Auth.esc(s.tanggal) + '</td>' +
          '</tr>';
        }).join('') : '<tr class="tbl-empty"><td colspan="3" class="text-center text-gray-400 py-8">Belum ada surat.</td></tr>';
      }).catch(function () { /* Auth.fetch sudah menampilkan toast */ });
    },

    statCard: function (label, value, sub, icon) {
      return '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-6">' +
        '<div class="flex items-start justify-between mb-3">' +
          '<div class="h-11 w-11 bg-emerald-light rounded-xl flex items-center justify-center">' +
          '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="' + icon + '" /></svg>' +
          '</div></div>' +
        '<div class="text-2xl font-extrabold text-emerald-dark leading-none mb-1">' + value + '</div>' +
        '<div class="text-sm font-semibold text-gray-700">' + label + '</div>' +
        '<div class="text-xs text-gray-400 mt-1">' + sub + '</div>' +
        '</div>';
    },

    // ---------------------------------------------------------------
    // PERSURATAN
    // ---------------------------------------------------------------
    renderSurat: function () {
      var main = document.getElementById('mainContent');
      var u = this.state.user;
      var self = this;
      var canWrite = ['SUPERADMIN', 'SEKRETARIS'].indexOf(u.role) !== -1;
      var canApprove = ['SUPERADMIN', 'KETUA'].indexOf(u.role) !== -1;

      var newBtn = canWrite ?
        '<button id="btnSuratBaru" class="btn btn-primary px-5 py-2.5 rounded-xl inline-flex items-center gap-2 font-bold text-sm">' +
        '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" /></svg>' +
        'Buat Surat Baru</button>' : '';

      main.innerHTML = this.pageHead('Persuratan Resmi',
        'Draf → Persetujuan Ketua → Diterbitkan dengan PDF & sidik digital.', newBtn) +
        '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-4 mb-6 flex flex-col sm:flex-row gap-3">' +
          '<input id="suratQ" type="text" placeholder="Cari judul / nomor surat…" class="field flex-1" />' +
          '<select id="suratStatus" class="field sm:w-52">' +
            '<option value="">Semua Status</option>' +
            '<option value="DRAFT">Draf</option><option value="PENDING_APPROVAL">Menunggu Persetujuan</option>' +
            '<option value="PUBLISHED">Diterbitkan</option><option value="REJECTED">Ditolak</option>' +
          '</select>' +
          '<button id="suratCari" class="btn btn-ghost px-5 py-2.5 rounded-xl font-semibold text-sm">Cari</button>' +
        '</div>' +
        '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">' +
          '<div class="overflow-x-auto"><table class="tbl tbl-responsive"><thead><tr>' +
          '<th>Nomor &amp; Judul</th><th>Jenis</th><th>Status</th><th>Dibuat Oleh</th><th>Tanggal</th><th>Aksi</th>' +
          '</tr></thead><tbody id="suratRows">' + this.loadingRow(6) + '</tbody></table></div>' +
        '</div>';

      if (canWrite) {
        document.getElementById('btnSuratBaru').addEventListener('click', function () {
          self.suratForm(null);
        });
      }

      var st = this.state.surat;
      document.getElementById('suratQ').value = st.q;
      document.getElementById('suratStatus').value = st.status;

      var load = function () {
        st.q = document.getElementById('suratQ').value.trim();
        st.status = document.getElementById('suratStatus').value;
        self.loadSurat(canWrite, canApprove);
      };
      document.getElementById('suratCari').addEventListener('click', load);
      document.getElementById('suratStatus').addEventListener('change', load);
      document.getElementById('suratQ').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') load();
      });

      load();
    },

    loadSurat: function (canWrite, canApprove) {
      var st = this.state.surat;
      var tb = document.getElementById('suratRows');
      var self = this;

      Auth.getCached('getListSurat', { q: st.q, status: st.status, limit: 50 }, function (data) {
        var items = (data && data.items) || [];
        tb.innerHTML = items.length ? items.map(function (s) {
          var acts = '';
          // Detail selalu tersedia.
          acts += self.aBtn('view', 'Detail', 'Lihat detail surat');
          acts += self.waBtn('Bagikan surat ke WhatsApp');
          // Penulis: ajukkan draft.
          if (canWrite && s.status === 'DRAFT') {
            acts += self.aBtn('edit', 'Ubah', 'Ubah draf surat');
            acts += self.aBtn('submit', 'Ajukan', 'Ajukan ke Ketua');
          }
          // Ketua: setujui / tolak.
          if (canApprove && s.status === 'PENDING_APPROVAL') {
            acts += self.aBtn('approve', 'Terbitkan', 'Setujui & terbitkan PDF');
            acts += self.aBtn('danger reject', 'Tolak', 'Tolak surat');
          }
          return '<tr data-id="' + s.id + '">' +
            '<td><div class="font-mono text-xs text-gray-500">' + Auth.esc(s.letter_number) + '</div>' +
              '<div class="font-semibold text-gray-900 leading-snug">' + Auth.esc(s.title) + '</div></td>' +
            '<td class="whitespace-nowrap text-gray-600 text-xs sm:text-sm"><span class="sm:hidden text-gray-400 font-medium">Jenis: </span>' + Auth.esc(s.letter_type_label) + '</td>' +
            '<td><span class="sm:hidden text-gray-400 font-medium text-xs">Status: </span>' + self.badge(s.status, s.status_label) + '</td>' +
            '<td class="whitespace-nowrap text-gray-600 text-xs sm:text-sm"><span class="sm:hidden text-gray-400 font-medium">Dibuat: </span>' + Auth.esc(s.created_by_name || s.created_by) + '</td>' +
            '<td class="whitespace-nowrap text-gray-500 text-xs"><span class="sm:hidden text-gray-400 font-medium">Tanggal: </span>' + Auth.esc(s.tanggal_label) + '</td>' +
            '<td class="tbl-actions"><div class="flex gap-1.5 flex-wrap min-w-[120px]">' + acts + '</div></td>' +
          '</tr>';
        }).join('') : '<tr class="tbl-empty"><td colspan="6" class="text-center text-gray-400 py-10">Tidak ada surat yang ditemukan.</td></tr>';

        // Binding aksi baris.
        Array.prototype.forEach.call(tb.querySelectorAll('tr[data-id]'), function (tr) {
          var id = tr.getAttribute('data-id');
          Array.prototype.forEach.call(tr.querySelectorAll('[data-act]'), function (b) {
            b.addEventListener('click', function () {
              var act = b.getAttribute('data-act');
              var item = items.filter(function (x) { return x.id === id; })[0];
              if (act === 'view') self.suratDetail(item);
              else if (act === 'wa') self.openWhatsApp(self.buildSuratWaText(item));
              else if (act === 'edit') self.suratForm(item);
              else if (act === 'submit') self.suratSubmit(item, canWrite, canApprove);
              else if (act === 'approve') self.suratApprove(item, canWrite, canApprove);
              else if (act === 'reject') self.suratReject(item);
            });
          });
        });
      });
    },

    /** Modal buat/ubah draf surat. */
    suratForm: function (item) {
      var self = this;
      var isEdit = !!item;
      var types = window.LETTER_TYPES || {};
      var typeOpts = Object.keys(types).map(function (k) {
        return '<option value="' + k + '"' + (item && item.letter_type === k ? ' selected' : '') + '>' + types[k] + '</option>';
      }).join('') + '<option value="CUSTOM">+ Jenis Surat Baru (Kustom)...</option>';

      this.openModal(
        '<div class="p-4 sm:p-6">' +
          '<div class="flex items-center justify-between gap-2 mb-5 flex-wrap">' +
            '<div class="flex items-center gap-2 flex-wrap min-w-0">' +
              '<h3 class="text-base sm:text-lg font-extrabold text-emerald-dark">' + (isEdit ? 'Ubah Draf Surat' : 'Buat Surat Baru') + '</h3>' +
              (!isEdit ? '<button type="button" id="sfBookingBtn" class="btn btn-ghost px-2.5 py-1 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-300 rounded-xl inline-flex items-center gap-1 shadow-sm flex-shrink-0" title="Ambil/reservasi nomor surat resmi terlebih dahulu">🔖 Booking Nomor</button>' : '') +
            '</div>' +
            '<button data-close class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 ml-auto">' +
              '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>' +
          '</div>' +
          '<form id="suratFormEl" class="space-y-4">' +
            '<div><label class="lbl">Jenis Surat</label><select id="sfType" class="field">' + typeOpts + '</select></div>' +
            '<div id="sfCustomBox" class="hidden p-3.5 bg-amber-50 rounded-xl border border-amber-200 space-y-2">' +
              '<div class="text-xs font-bold text-amber-900">Jenis Surat Kustom Baru:</div>' +
              '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' +
                '<input id="sfCustomCode" type="text" placeholder="Kode (cth: NOTULEN_KHUSUS)" class="field text-xs font-mono uppercase" />' +
                '<input id="sfCustomLabel" type="text" placeholder="Nama Jenis (cth: Notulen Rapat Khusus)" class="field text-xs" />' +
              '</div>' +
            '</div>' +
            '<div><label class="lbl">Judul / Perihal Surat <span class="text-red-500">*</span></label>' +
              '<input id="sfTitle" type="text" required class="field" placeholder="cth: Undangan Rapat Kerja DPW" value="' + Auth.esc(item ? item.title : '') + '" /></div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
              '<div><label class="lbl">Tanggal Surat</label><input id="sfTanggal" type="date" class="field" value="' + (item ? item.tanggal_surat : new Date().toISOString().slice(0, 10)) + '" /></div>' +
              '<div><label class="lbl">Nomor Surat</label><input id="sfNomor" type="text" class="field font-mono text-xs" placeholder="(otomatis bila kosong)" value="' + Auth.esc(item ? item.letter_number : '') + '" /></div>' +
            '</div>' +
            '<div><label class="lbl">Menimbang (Konsideran)</label><textarea id="sfMenimbang" rows="2" class="field" placeholder="Pertimbangan latar belakang diterbitkannya surat…"></textarea></div>' +
            '<div><label class="lbl">Mengingat (Dasar Hukum / AD-ART)</label><textarea id="sfMengingat" rows="2" class="field" placeholder="Dasar hukum / ketentuan anggaran dasar APII…"></textarea></div>' +
            '<div><label class="lbl">Memutuskan / Isi Pokok Surat</label><textarea id="sfMemutuskan" rows="3" class="field" placeholder="Ketetapan, agenda rapat, atau isi pokok instruksi…"></textarea></div>' +
            '<div>' +
              '<label class="lbl">Lampiran Naskah / Dokumen Resmi (PDF/Gambar/Dokumen)</label>' +
              '<input id="sfAttachmentFile" type="file" accept="application/pdf,image/*,.doc,.docx" class="field text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-emerald-light file:text-emerald-dark" />' +
              (item && item.attachment_url ? '<a href="' + Auth.esc(item.attachment_url) + '" target="_blank" rel="noopener" class="text-xs text-emerald-800 font-bold underline mt-1.5 inline-flex items-center gap-1"><span>📎 Buka Lampiran Naskah di Drive</span></a>' : '') +
              '<p class="text-[11px] text-gray-400 mt-1">File akan diunggah otomatis ke Google Drive folder <code>/Surat_Lampiran/</code>.</p>' +
            '</div>' +
            '<p class="text-xs text-gray-400">' + (isEdit
              ? 'Kosongkan ketiga kotak isi untuk mempertahankan isi lama. Hanya Draf yang dapat diubah.'
              : 'Isi surat dapat dilengkapi nanti selama masih berstatus Draf.') + '</p>' +
            '<div class="flex gap-3 pt-2">' +
              '<button type="submit" id="btnSubmitSurat" class="btn btn-primary flex-1 py-3 rounded-xl font-bold">' + (isEdit ? 'Simpan Perubahan' : 'Simpan Draf Surat') + '</button>' +
              '<button type="button" data-close class="btn btn-ghost px-5 rounded-xl font-semibold">Batal</button>' +
            '</div>' +
          '</form>' +
        '</div>');

      // Tutup modal.
      Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
        b.addEventListener('click', function () { self.closeModal(); });
      });

      // Toggle input jenis surat kustom
      var sfTypeEl = document.getElementById('sfType');
      var sfCustomBox = document.getElementById('sfCustomBox');
      sfTypeEl.addEventListener('change', function () {
        if (sfTypeEl.value === 'CUSTOM') sfCustomBox.classList.remove('hidden');
        else sfCustomBox.classList.add('hidden');
      });

      // Tombol Booking Nomor Saja
      var sfBookingBtn = document.getElementById('sfBookingBtn');
      if (sfBookingBtn) {
        sfBookingBtn.addEventListener('click', function () {
          var titleVal = document.getElementById('sfTitle').value.trim() || 'Reservasi Nomor Surat';
          var typeVal = sfTypeEl.value === 'CUSTOM' ? (document.getElementById('sfCustomCode').value.trim() || 'SURAT') : sfTypeEl.value;
          self.confirm('Booking Nomor Surat', 'Sistem akan mereservasi nomor urut resmi berikutnya untuk surat "<b>' + Auth.esc(titleVal) + '</b>". Lanjutkan?', function () {
            Auth.fetch('reserveLetterNumber', { letter_type: typeVal, title: titleVal }).then(function (res) {
              if (res && res.letter_number) {
                document.getElementById('sfNomor').value = res.letter_number;
                self.toast('Nomor surat berhasil dibooking: ' + res.letter_number, 'success');
              } else {
                self.toast('Nomor surat berhasil dipesan.', 'success');
              }
              self.refreshSurat();
            }).catch(function () {});
          });
        });
      }

      document.getElementById('suratFormEl').addEventListener('submit', function (e) {
        e.preventDefault();
        var submitBtn = document.getElementById('btnSubmitSurat');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Menyimpan...'; }

        var menimbang = document.getElementById('sfMenimbang').value.trim();
        var mengingat = document.getElementById('sfMengingat').value.trim();
        var memutuskan = document.getElementById('sfMemutuskan').value.trim();

        var letterTypeVal = document.getElementById('sfType').value;
        if (letterTypeVal === 'CUSTOM') {
          letterTypeVal = (document.getElementById('sfCustomCode').value || '').trim().toUpperCase() || 'SURAT_KUSTOM';
        }

        var payload = {
          letter_type: letterTypeVal,
          title: document.getElementById('sfTitle').value.trim(),
          tanggal_surat: document.getElementById('sfTanggal').value,
          letter_number: document.getElementById('sfNomor').value.trim()
        };
        // Hanya kirim content bila ada isian (updateSurat menimpa seluruh content).
        if (menimbang || mengingat || memutuskan) {
          payload.content = { menimbang: menimbang, mengingat: mengingat, memutuskan: memutuskan };
        }
        if (isEdit) payload.id = item.id;

        var doSend = function () {
          Auth.fetch(isEdit ? 'updateSurat' : 'createSurat', payload).then(function () {
            self.closeModal();
            self.toast(isEdit ? 'Surat berhasil diperbarui.' : 'Draf surat berhasil dibuat.', 'success');
            self.refreshSurat();
          }).catch(function () {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = isEdit ? 'Simpan Perubahan' : 'Simpan Draf Surat'; }
          });
        };

        var fileEl = document.getElementById('sfAttachmentFile');
        if (fileEl && fileEl.files && fileEl.files[0]) {
          var file = fileEl.files[0];
          var reader = new FileReader();
          reader.onload = function (evt) {
            payload.attachment_base64 = evt.target.result;
            payload.attachment_file_name = file.name;
            doSend();
          };
          reader.onerror = function () { doSend(); };
          reader.readAsDataURL(file);
        } else {
          doSend();
        }
      });
    },

    /** Muat ulang tabel surat sesuai peran. */
    refreshSurat: function () {
      var r = this.state.user.role;
      this.loadSurat(['SUPERADMIN', 'SEKRETARIS'].indexOf(r) !== -1,
        ['SUPERADMIN', 'KETUA'].indexOf(r) !== -1);
    },

    /** Modal detail surat dengan Pratinjau Kertas Virtual A4 (Paper Replica) & Metadata. */
    suratDetail: function (s) {
      var self = this;
      var canApprove = ['SUPERADMIN', 'KETUA'].indexOf(this.state.user.role) !== -1;
      var canWrite = ['SUPERADMIN', 'SEKRETARIS'].indexOf(this.state.user.role) !== -1;

      // Parsing konten
      var contentObj = {};
      try {
        contentObj = typeof s.content === 'object' ? (s.content || {}) : JSON.parse(s.content || '{}');
      } catch (e) {
        contentObj = {};
      }

      var bodyHtml = '';
      if (contentObj.menimbang || contentObj.mengingat || contentObj.memutuskan) {
        if (contentObj.menimbang) {
          bodyHtml += '<div class="flex flex-col sm:flex-row gap-1 sm:gap-4 items-start">' +
            '<div class="w-24 sm:w-28 font-bold text-gray-900 flex-shrink-0">Menimbang :</div>' +
            '<div class="flex-1">' + Auth.esc(contentObj.menimbang) + '</div></div>';
        }
        if (contentObj.mengingat) {
          bodyHtml += '<div class="flex flex-col sm:flex-row gap-1 sm:gap-4 items-start">' +
            '<div class="w-24 sm:w-28 font-bold text-gray-900 flex-shrink-0">Mengingat :</div>' +
            '<div class="flex-1">' + Auth.esc(contentObj.mengingat) + '</div></div>';
        }
        if (contentObj.memutuskan) {
          bodyHtml += '<div class="flex flex-col sm:flex-row gap-1 sm:gap-4 items-start">' +
            '<div class="w-24 sm:w-28 font-bold text-gray-900 flex-shrink-0">Memutuskan :</div>' +
            '<div class="flex-1 font-semibold text-gray-950">' + Auth.esc(contentObj.memutuskan) + '</div></div>';
        }
      } else if (typeof s.content === 'string' && s.content.trim()) {
        bodyHtml = '<p class="leading-relaxed">' + Auth.esc(s.content) + '</p>';
      } else {
        bodyHtml = '<div class="bg-amber-50/50 border border-amber-100 rounded-xl p-4 text-center text-amber-900 text-xs italic">' +
          'Isi butir konsideran (menimbang, mengingat, memutuskan) belum diisi pada draf surat ini. Anda dapat mengisinya melalui menu <strong>Ubah</strong>.' +
          '</div>';
      }

      // Watermark status
      var watermarkHtml = '';
      if (s.status === 'DRAFT') {
        watermarkHtml = '<div class="paper-watermark paper-watermark-DRAFT">DRAF SURAT</div>';
      } else if (s.status === 'PENDING_APPROVAL') {
        watermarkHtml = '<div class="paper-watermark paper-watermark-PENDING_APPROVAL">MENUNGGU KETUA</div>';
      } else if (s.status === 'REJECTED') {
        watermarkHtml = '<div class="paper-watermark paper-watermark-REJECTED">DITOLAK</div>';
      }

      var ketuaName = s.approved_by || 'Dr. H. Ahmad Fauzi, M.Pd';
      var sekretarisName = s.created_by_name || s.created_by || 'M. Rahmatullah, S.T';

      // Rows metadata
      var metaRows = [
        ['Nomor Surat', s.letter_number, 'mono'],
        ['Jenis Surat', s.letter_type_label, ''],
        ['Perihal / Judul', s.title, ''],
        ['Status Dokumen', null, 'badge'],
        ['Tanggal Surat', s.tanggal_label || s.tanggal_surat, ''],
        ['Dibuat Oleh', s.created_by_name || s.created_by, ''],
        ['Disahkan Oleh', s.approved_by || '—', '']
      ];
      if (s.rejection_notes) metaRows.push(['Catatan Penolakan', s.rejection_notes, 'warn']);
      if (s.pdf_url) metaRows.push(['URL Dokumen PDF', s.pdf_url, 'link']);
      if (s.qr_verify_url) metaRows.push(['URL Verifikasi Publik', s.qr_verify_url, 'link']);

      var modalHtml = '<div class="p-4 sm:p-6">' +
        // Header Modal
        '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-gray-100 no-print">' +
          '<div class="flex items-center gap-2 flex-wrap min-w-0">' +
            '<div class="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl">' +
              '<button type="button" id="tabPaperBtn" class="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white text-emerald-dark shadow-sm transition">📄 Kertas A4</button>' +
              '<button type="button" id="tabMetaBtn" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-900 transition">📋 Metadata</button>' +
            '</div>' +
            self.badge(s.status, s.status_label) +
          '</div>' +
          '<div class="flex items-center gap-1.5 self-start sm:self-center flex-wrap w-full sm:w-auto justify-start sm:justify-end">' +
            '<button type="button" id="btnWaShareLetter" class="btn text-xs px-3 py-1.5 rounded-xl font-bold inline-flex items-center gap-1.5 btn-wa-ghost shadow-sm" title="Bagikan Ringkasan ke WhatsApp">' +
              '<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>' +
              '<span>Share WA</span>' +
            '</button>' +
            '<button type="button" id="btnPrintLetter" class="btn btn-ghost text-xs px-3 py-1.5 rounded-xl font-bold inline-flex items-center gap-1.5">' +
              '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>' +
              '<span>Cetak</span>' +
            '</button>' +
            (s.pdf_url ?
              '<a href="' + Auth.esc(s.pdf_url) + '" target="_blank" rel="noopener" class="btn btn-primary text-xs px-3 py-1.5 rounded-xl font-bold inline-flex items-center gap-1.5">' +
                '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' +
                '<span>Unduh PDF</span>' +
              '</a>' : '') +
            (s.qr_verify_url ?
              '<button type="button" id="btnCopyVerify" class="btn btn-ghost text-xs px-3 py-1.5 rounded-xl font-bold inline-flex items-center gap-1.5" title="Salin Link Publik">' +
                '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>' +
                '<span class="hidden sm:inline">Salin Link</span>' +
              '</button>' : '') +
            '<button type="button" data-close class="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition">' +
              '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +

        // Tab A: Kertas Virtual A4
        '<div id="viewPaper" class="overflow-x-auto py-2 -mx-1 sm:mx-0">' +
          '<div id="printPaperArea" class="paper-a4 p-3.5 sm:p-10 text-gray-900 shadow-xl border border-gray-200 rounded-xl relative overflow-hidden bg-white max-w-[760px] mx-auto select-text">' +
            watermarkHtml +

            // KOP SURAT (Dukungan Gambar KOP Resmi Uploaded vs Teks Standar)
            (window._kopSettings && window._kopSettings.kop_mode === 'image' && window._kopSettings.kop_image_base64
              ? '<div class="mb-2 text-center"><img src="' + window._kopSettings.kop_image_base64 + '" alt="KOP Surat Resmi" class="w-full max-h-36 object-contain mx-auto" /></div>'
              : '<div class="flex items-center gap-2.5 sm:gap-6 mb-2">' +
                  '<img src="logo.png" alt="Logo DPW APII" class="w-12 h-12 sm:w-20 sm:h-20 object-contain flex-shrink-0" />' +
                  '<div class="flex-1 text-center font-serif leading-tight min-w-0">' +
                    '<div class="text-[10px] sm:text-xs font-bold text-[#1B5E20] uppercase tracking-wider">DEWAN PIMPINAN WILAYAH</div>' +
                    '<div class="text-xs sm:text-lg font-black text-gray-900 tracking-tight mt-0.5 break-words">YAYASAN APOLOGET ISLAM INDONESIA (APII)</div>' +
                    '<div class="text-[11px] sm:text-sm font-bold text-gray-800 tracking-normal">WILAYAH JABODETABEK</div>' +
                    '<div class="text-[8.5px] sm:text-[10.5px] text-gray-600 font-sans mt-1 leading-snug">' +
                      'Gedung Pusat Dakwah APII Wilayah Jabodetabek Lt. 3, Jl. Kramat Raya No. 45, Senen, Jakarta Pusat 10450<br class="hidden sm:inline"/>' +
                      'Telp: (021) 390-8812 &bull; Email: sekretariat.dpw@apii-jabodetabek.or.id &bull; Website: siapii.sigitadi.id' +
                    '</div>' +
                  '</div>' +
                '</div>'
            ) +

            // DOUBLE DIVIDER LINE
            '<div class="hr-double-top"></div>' +
            '<div class="hr-double-bottom"></div>' +

            // JUDUL SURAT & NOMOR
            '<div class="text-center my-6">' +
              '<h2 class="text-sm sm:text-base font-bold uppercase tracking-widest underline decoration-2 underline-offset-4">' +
                Auth.esc(s.letter_type_label || 'SURAT RESMI') +
              '</h2>' +
              '<div class="font-mono text-xs text-gray-700 mt-1.5 font-medium">' +
                'Nomor : ' + Auth.esc(s.letter_number) +
              '</div>' +
              '<div class="text-xs font-bold uppercase text-gray-800 mt-3 tracking-wider">TENTANG</div>' +
              '<div class="text-xs sm:text-sm font-black uppercase text-gray-900 max-w-lg mx-auto mt-1 leading-snug">' +
                Auth.esc(s.title) +
              '</div>' +
            '</div>' +

            // ISI DOKUMEN
            '<div class="my-6 space-y-4 text-xs sm:text-[13px] leading-relaxed text-gray-800 text-justify">' +
              bodyHtml +
            '</div>' +

            // PENETAPAN
            '<div class="mt-8 text-right text-xs sm:text-[13px] text-gray-800 font-serif">' +
              '<div>Ditetapkan di : <strong>Jakarta</strong></div>' +
              '<div>Pada tanggal : <strong>' + Auth.esc(s.tanggal_label || s.tanggal_surat) + '</strong></div>' +
            '</div>' +

            // BLOK TANDA TANGAN & STEMPEL
            '<div class="mt-8 grid grid-cols-2 gap-4 text-xs sm:text-[13px] font-serif">' +
              // SEKRETARIS (Kiri)
              '<div class="text-center">' +
                '<div class="font-medium text-gray-700">Sekretaris DPW Jabodetabek,</div>' +
                '<div class="h-20 sm:h-24 flex items-center justify-center">' +
                  (s.status === 'PUBLISHED' ? '<span class="font-serif italic text-emerald-800 text-xs sm:text-sm opacity-60">Tertanda digital</span>' : '') +
                '</div>' +
                '<div class="font-bold underline text-gray-900">' + Auth.esc(sekretarisName) + '</div>' +
                '<div class="text-[10px] text-gray-500 font-sans mt-0.5">Sekretaris Wilayah</div>' +
              '</div>' +

              // KETUA + STEMPEL BASAH (Kanan)
              '<div class="text-center relative">' +
                '<div class="font-medium text-gray-700">Ketua DPW Jabodetabek,</div>' +
                '<div class="h-20 sm:h-24 relative flex items-center justify-center">' +
                  (s.status === 'PUBLISHED' ?
                    '<img src="stempel.png" alt="Stempel Basah Resmi APII" class="stempel-basah" />' +
                    '<span class="font-serif italic text-emerald-900 text-xs sm:text-sm opacity-70 relative z-[2]">Tertanda & Disahkan</span>'
                    : '') +
                '</div>' +
                '<div class="font-bold underline text-gray-900 relative z-[4]">' + Auth.esc(ketuaName) + '</div>' +
                '<div class="text-[10px] text-gray-500 font-sans mt-0.5 relative z-[4]">Ketua Dewan Pimpinan Wilayah</div>' +
              '</div>' +
            '</div>' +

            // FOOTER RESMI KERTAS
            '<div class="mt-12 pt-3 border-t border-gray-300 flex flex-col sm:flex-row items-center justify-between text-[9px] sm:text-[10px] text-gray-500 font-sans gap-2">' +
              '<div>Yayasan Aliansi Pendidikan dan Informatika Indonesia (APII) DPW Jabodetabek</div>' +
              (s.status === 'PUBLISHED' ?
                '<div class="text-emerald-700 font-medium flex items-center gap-1.5">' +
                  '<span>🔒 Dokumen Sah Terverifikasi</span>' +
                  (s.qr_verify_url ? '• <a href="' + Auth.esc(s.qr_verify_url) + '" target="_blank" rel="noopener" class="underline hover:text-emerald-900">Cek Keaslian Digital</a>' : '') +
                '</div>' : '<div class="text-gray-400">Salinan Dokumen Internal</div>') +
            '</div>' +
          '</div>' +
        '</div>' +

        // Tab B: Metadata
        '<div id="viewMeta" class="hidden py-2 space-y-1">' +
          metaRows.map(function (r) {
            var val = r[2] === 'badge' ? self.badge(s.status, s.status_label)
              : r[2] === 'mono' ? '<span class="font-mono text-xs break-all">' + Auth.esc(r[1]) + '</span>'
              : r[2] === 'warn' ? '<span class="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl block border border-red-100">' + Auth.esc(r[1]) + '</span>'
              : r[2] === 'link' ? '<a href="' + Auth.esc(r[1]) + '" target="_blank" rel="noopener" class="text-emerald text-xs font-semibold hover:underline break-all">' + Auth.esc(r[1]) + ' ↗</a>'
              : '<span class="text-sm text-gray-800">' + Auth.esc(r[1]) + '</span>';
            return '<div class="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-2.5 border-b border-gray-100">' +
              '<div class="text-xs font-bold text-gray-400 uppercase tracking-wide sm:w-44 flex-shrink-0">' + r[0] + '</div>' +
              '<div class="min-w-0 flex-1">' + val + '</div></div>';
          }).join('') +
        '</div>' +

        // Approval Action Bar (Khusus Pimpinan saat status PENDING_APPROVAL)
        (canApprove && s.status === 'PENDING_APPROVAL' ?
          '<div class="mt-6 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-amber-50/70 p-4 rounded-2xl border border-amber-200 no-print">' +
            '<div class="text-xs text-amber-900 font-medium text-center sm:text-left">' +
              '⚡ <strong>Persetujuan Pimpinan:</strong> Dokumen menunggu keputusan Anda untuk disahkan dan diterbitkan dengan PDF & stempel resmi.' +
            '</div>' +
            '<div class="flex gap-2 w-full sm:w-auto flex-shrink-0">' +
              '<button type="button" id="modalApproveBtn" class="btn btn-primary text-xs px-4 py-2.5 rounded-xl font-bold flex-1 sm:flex-initial flex items-center justify-center gap-1.5 shadow-sm">' +
                '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>' +
                '<span>Setujui & Terbitkan</span>' +
              '</button>' +
              '<button type="button" id="modalRejectBtn" class="btn btn-danger text-xs px-4 py-2.5 rounded-xl font-bold flex-1 sm:flex-initial flex items-center justify-center gap-1.5 shadow-sm">' +
                '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>' +
                '<span>Tolak</span>' +
              '</button>' +
            '</div>' +
          '</div>' : '') +
      '</div>';

      this.openModal(modalHtml, 'max-w-4xl');

      // Bind tabs
      var tabPaperBtn = document.getElementById('tabPaperBtn');
      var tabMetaBtn = document.getElementById('tabMetaBtn');
      var viewPaper = document.getElementById('viewPaper');
      var viewMeta = document.getElementById('viewMeta');

      if (tabPaperBtn && tabMetaBtn) {
        tabPaperBtn.addEventListener('click', function () {
          tabPaperBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white text-emerald-dark shadow-sm transition';
          tabMetaBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-900 transition';
          viewPaper.classList.remove('hidden');
          viewMeta.classList.add('hidden');
        });
        tabMetaBtn.addEventListener('click', function () {
          tabMetaBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white text-emerald-dark shadow-sm transition';
          tabPaperBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-900 transition';
          viewMeta.classList.remove('hidden');
          viewPaper.classList.add('hidden');
        });
      }

      // Bind WhatsApp share
      var waLetterBtn = document.getElementById('btnWaShareLetter');
      if (waLetterBtn) {
        waLetterBtn.addEventListener('click', function () {
          self.openWhatsApp(self.buildSuratWaText(s));
        });
      }

      // Bind print
      var printBtn = document.getElementById('btnPrintLetter');
      if (printBtn) {
        printBtn.addEventListener('click', function () {
          window.print();
        });
      }

      // Bind copy verify link
      var copyBtn = document.getElementById('btnCopyVerify');
      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          if (navigator.clipboard && s.qr_verify_url) {
            navigator.clipboard.writeText(s.qr_verify_url).then(function () {
              self.toast('Link verifikasi berhasil disalin ke clipboard!', 'success');
            }).catch(function () {
              prompt('Salin link verifikasi surat:', s.qr_verify_url);
            });
          } else if (s.qr_verify_url) {
            prompt('Salin link verifikasi surat:', s.qr_verify_url);
          }
        });
      }

      // Bind modal approve & reject buttons if available
      var modalApprove = document.getElementById('modalApproveBtn');
      if (modalApprove) {
        modalApprove.addEventListener('click', function () {
          self.suratApprove(s, canWrite, canApprove);
        });
      }
      var modalReject = document.getElementById('modalRejectBtn');
      if (modalReject) {
        modalReject.addEventListener('click', function () {
          self.suratReject(s);
        });
      }

      // Bind close buttons
      Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
        b.addEventListener('click', function () { self.closeModal(); });
      });
    },

    /** Modal konfirmasi generik. */
    confirm: function (title, html, onYes) {
      var self = this;
      this.openModal(
        '<div class="p-4 sm:p-6">' +
          '<div class="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 mb-5">' +
            '<div class="h-10 w-10 sm:h-11 sm:w-11 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">' +
            '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>' +
            '<div class="min-w-0"><h3 class="text-base sm:text-lg font-extrabold text-emerald-dark break-words">' + title + '</h3>' +
            '<p class="text-xs sm:text-sm text-gray-600 mt-1 break-words">' + html + '</p></div>' +
          '</div>' +
          '<div class="flex flex-col sm:flex-row gap-2.5 sm:gap-3">' +
            '<button id="confirmYes" class="btn btn-primary flex-1 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm">Ya, Lanjutkan</button>' +
            '<button data-close class="btn btn-ghost px-5 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm">Batal</button>' +
          '</div>' +
        '</div>');
      Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
        b.addEventListener('click', function () { self.closeModal(); });
      });
      document.getElementById('confirmYes').addEventListener('click', function () {
        self.closeModal();
        onYes();
      });
    },

    /** Modal penolakan dengan catatan wajib (dipakai surat & voucher). */
    rejectModal: function (title, descHtml, action, id, onDone) {
      var self = this;
      this.openModal(
        '<div class="p-4 sm:p-6">' +
          '<h3 class="text-base sm:text-lg font-extrabold text-red-600 mb-2 break-words">' + title + '</h3>' +
          '<p class="text-xs sm:text-sm text-gray-600 mb-4 break-words">' + descHtml + '</p>' +
          '<form id="rejectFormEl">' +
            '<label class="lbl">Alasan Penolakan <span class="text-red-500">*</span></label>' +
            '<textarea id="rejectNotes" required rows="3" class="field" placeholder="Tulis alasan penolakan…"></textarea>' +
            '<div class="flex flex-col sm:flex-row gap-2.5 sm:gap-3 pt-4">' +
              '<button type="submit" class="btn btn-danger flex-1 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm">Tolak</button>' +
              '<button type="button" data-close class="btn btn-ghost px-5 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm">Batal</button>' +
            '</div>' +
          '</form>' +
        '</div>');
      Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
        b.addEventListener('click', function () { self.closeModal(); });
      });
      document.getElementById('rejectFormEl').addEventListener('submit', function (e) {
        e.preventDefault();
        Auth.fetch(action, { id: id, notes: document.getElementById('rejectNotes').value.trim() })
          .then(function () {
            self.closeModal();
            self.toast('Dokumen telah ditolak.', 'success');
            if (onDone) onDone();
          }).catch(function () {});
      });
    },

    /** Ajukan draf surat ke Ketua. */
    suratSubmit: function (item) {
      var self = this;
      this.confirm('Ajukan Surat', 'Surat <b>' + Auth.esc(item.letter_number) + '</b> akan diajukan ke Ketua untuk persetujuan. Lanjutkan?', function () {
        Auth.fetch('submitSurat', { id: item.id }).then(function () {
          self.toast('Surat diajukan ke Ketua.', 'success', '📲 Kabari via WA', function () {
            self.openWhatsApp(self.buildSuratWaText(item));
          });
          self.refreshSurat();
        }).catch(function () {});
      });
    },

    /** Setujui & terbitkan surat (Ketua/Superadmin). */
    suratApprove: function (item) {
      var self = this;
      this.confirm('Terbitkan Surat', 'Surat <b>' + Auth.esc(item.letter_number) + '</b> akan diterbitkan: status PUBLISHED, PDF dibuat, &amp; sidik digital dicatat. Lanjutkan?', function () {
        Auth.fetch('approveSurat', { id: item.id }).then(function () {
          self.toast('Surat berhasil diterbitkan & PDF tersedia.', 'success', '📲 Bagikan WA', function () {
            self.openWhatsApp(self.buildSuratWaText(item));
          });
          self.refreshSurat();
        }).catch(function () {});
      });
    },

    /** Tolak surat. */
    suratReject: function (item) {
      var self = this;
      this.rejectModal('Tolak Surat',
        'Surat <span class="font-mono text-xs">' + Auth.esc(item.letter_number) + '</span> akan dikembalikan ke Sekretaris dengan alasan di bawah ini.',
        'rejectSurat', item.id, function () { self.refreshSurat(); });
    },

    // ---------------------------------------------------------------
    // KEUANGAN
    // ---------------------------------------------------------------
    renderKeuangan: function () {
      var main = document.getElementById('mainContent');
      var u = this.state.user;
      var self = this;
      var canWrite = ['SUPERADMIN', 'BENDAHARA'].indexOf(u.role) !== -1;
      var canApprove = ['SUPERADMIN', 'KETUA'].indexOf(u.role) !== -1;

      var newBtn = canWrite ?
        '<button id="btnVoucherBaru" class="btn btn-primary px-5 py-2.5 rounded-xl inline-flex items-center gap-2 font-bold text-sm">' +
        '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" /></svg>' +
        'Buat Voucher</button>' : '';

      main.innerHTML = this.pageHead('Buku Kas &amp; Voucher',
        'Verifikasi ganda: Bendahara → Ketua. Hanya voucher APPROVED yang masuk saldo.', newBtn) +
        '<div id="keuCards" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">' +
          '<div class="card bg-white rounded-2xl p-6 animate-pulse h-28"></div>'.repeat(3) +
        '</div>' +
        '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-4 mb-6 flex flex-col sm:flex-row gap-3">' +
          '<input id="keuQ" type="text" placeholder="Cari nomor voucher / keterangan…" class="field flex-1" />' +
          '<select id="keuStatus" class="field sm:w-48">' +
            '<option value="">Semua Status</option><option value="PENDING">Menunggu Verifikasi</option>' +
            '<option value="VERIFIED_BY_BENDAHARA">Diverifikasi Bendahara</option>' +
            '<option value="APPROVED">Disetujui</option><option value="REJECTED">Ditolak</option>' +
          '</select>' +
          '<select id="keuType" class="field sm:w-40">' +
            '<option value="">Semua Jenis</option><option value="MASUK">Kas Masuk</option><option value="KELUAR">Kas Keluar</option>' +
          '</select>' +
        '</div>' +
        '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">' +
          '<div class="overflow-x-auto"><table class="tbl tbl-responsive"><thead><tr>' +
          '<th>Nomor Voucher</th><th>Jenis</th><th>Jumlah</th><th>Akun</th><th>Status</th><th>Aksi</th>' +
          '</tr></thead><tbody id="keuRows">' + this.loadingRow(6) + '</tbody></table></div>' +
        '</div>';

      if (canWrite) {
        document.getElementById('btnVoucherBaru').addEventListener('click', function () {
          self.voucherForm();
        });
      }

      var st = this.state.keuangan;
      document.getElementById('keuQ').value = st.q;
      document.getElementById('keuStatus').value = st.status;
      document.getElementById('keuType').value = st.type;

      var load = function () {
        st.q = document.getElementById('keuQ').value.trim();
        st.status = document.getElementById('keuStatus').value;
        st.type = document.getElementById('keuType').value;
        self.loadKeuangan(canWrite, canApprove);
      };
      document.getElementById('keuStatus').addEventListener('change', load);
      document.getElementById('keuType').addEventListener('change', load);
      document.getElementById('keuQ').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') load();
      });

      // Kartu saldo.
      this.loadSaldoCards();

      load();
    },

    loadSaldoCards: function () {
      Auth.getCached('getSaldo', null, function (data) {
        if (!data) return;
        var cards = [
          { l: 'Total Saldo Kas', v: 'Rp ' + Number(data.saldo || 0).toLocaleString('id-ID'), c: 'text-emerald' },
          { l: 'Total Kas Masuk', v: 'Rp ' + Number(data.total_masuk || 0).toLocaleString('id-ID'), c: 'text-emerald-dark' },
          { l: 'Total Kas Keluar', v: 'Rp ' + Number(data.total_keluar || 0).toLocaleString('id-ID'), c: 'text-red-600' }
        ];
        var box = document.getElementById('keuCards');
        if (!box) return;
        box.innerHTML = cards.map(function (c) {
          return '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-6">' +
            '<div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">' + c.l + '</div>' +
            '<div class="text-2xl font-extrabold ' + c.c + ' leading-none">' + c.v + '</div></div>';
        }).join('');
      });
    },

    loadKeuangan: function (canWrite, canApprove) {
      var st = this.state.keuangan;
      var tb = document.getElementById('keuRows');
      var self = this;

      Auth.getCached('getListKeuangan', { q: st.q, status: st.status, type: st.type, limit: 50 }, function (data) {
        var items = (data && data.items) || [];
        tb.innerHTML = items.length ? items.map(function (k) {
          var acts = '';
          acts += self.aBtn('view', 'Detail', 'Lihat detail voucher');
          acts += self.waBtn('Bagikan voucher ke WhatsApp');
          if (canWrite && k.status === 'PENDING') {
            acts += self.aBtn('verify-bend', 'Verifikasi', 'Verifikasi sebagai Bendahara');
          }
          if (canApprove && k.status === 'VERIFIED_BY_BENDAHARA') {
            acts += self.aBtn('approve', 'Setujui', 'Verifikasi final sebagai Ketua');
          }
          if (canApprove && (k.status === 'PENDING' || k.status === 'VERIFIED_BY_BENDAHARA')) {
            acts += self.aBtn('danger reject', 'Tolak', 'Tolak voucher');
          }
          if (!acts) acts = '<span class="text-xs text-gray-300">—</span>';

          var receiptLink = k.receipt_url ?
            '<div class="mt-1"><a href="' + Auth.esc(k.receipt_url) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 transition" title="Buka Bukti Transaksi di Google Drive">' +
            '<svg class="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg> Bukti Kas ↗</a></div>' : '';

          return '<tr data-id="' + k.id + '">' +
            '<td><div class="font-mono text-xs text-gray-500">' + Auth.esc(k.voucher_number) + '</div>' +
              '<div class="text-sm font-semibold text-gray-900 leading-snug">' + Auth.esc(k.description) + '</div>' + receiptLink + '</td>' +
            '<td><span class="badge ' + (k.type === 'MASUK' ? 'badge-PUBLISHED' : 'badge-DRAFT') + '">' +
              (k.type === 'MASUK' ? 'Kas Masuk' : 'Kas Keluar') + '</span></td>' +
            '<td class="font-bold whitespace-nowrap ' + (k.type === 'MASUK' ? 'text-emerald' : 'text-red-600') + '">' +
              (k.type === 'MASUK' ? '+ ' : '− ') + Auth.esc(k.amount_label.replace('Rp ', '')) + '</td>' +
            '<td class="whitespace-nowrap text-gray-600 text-xs sm:text-sm"><span class="sm:hidden text-gray-400 font-medium">Akun: </span>' + Auth.esc(k.account_label) + '</td>' +
            '<td><span class="sm:hidden text-gray-400 font-medium text-xs">Status: </span>' + self.badge(k.status, k.status_label) + '</td>' +
            '<td class="tbl-actions"><div class="flex gap-1.5 flex-wrap min-w-[120px]">' + acts + '</div></td>' +
          '</tr>';
        }).join('') : '<tr class="tbl-empty"><td colspan="6" class="text-center text-gray-400 py-10">Tidak ada voucher yang ditemukan.</td></tr>';

        Array.prototype.forEach.call(tb.querySelectorAll('tr[data-id]'), function (tr) {
          var id = tr.getAttribute('data-id');
          Array.prototype.forEach.call(tr.querySelectorAll('[data-act]'), function (b) {
            b.addEventListener('click', function () {
              var act = b.getAttribute('data-act');
              var item = items.filter(function (x) { return x.id === id; })[0];
              if (act === 'view') self.voucherDetail(item);
              else if (act === 'wa') self.openWhatsApp(self.buildKeuanganWaText(item));
              else if (act === 'verify-bend') self.voucherVerify(item, 'verifyVoucherBendahara',
                'Verifikasi Bendahara', 'diverifikasi Bendahara & menunggu verifikasi Ketua');
              else if (act === 'approve') self.voucherVerify(item, 'verifyVoucherKetum',
                'Verifikasi Final Ketua', 'disetujui penuh & masuk perhitungan saldo');
              else if (act === 'reject') self.voucherReject(item);
            });
          });
        });
      });
    },

    refreshKeuangan: function () {
      var r = this.state.user.role;
      this.loadSaldoCards();
      this.loadKeuangan(['SUPERADMIN', 'BENDAHARA'].indexOf(r) !== -1,
        ['SUPERADMIN', 'KETUA'].indexOf(r) !== -1);
    },

    voucherVerify: function (item, action, title, effect) {
      var self = this;
      this.confirm(title, 'Voucher <b>' + Auth.esc(item.voucher_number) + '</b> sebesar <b>' +
        Auth.esc(item.amount_label) + '</b> akan ' + effect + '. Lanjutkan?', function () {
        Auth.fetch(action, { id: item.id }).then(function () {
          self.toast('Voucher berhasil diproses.', 'success', '📲 Kabari via WA', function () {
            self.openWhatsApp(self.buildKeuanganWaText(item));
          });
          self.refreshKeuangan();
        }).catch(function () {});
      });
    },

    voucherReject: function (item) {
      var self = this;
      this.rejectModal('Tolak Voucher',
        'Voucher <span class="font-mono text-xs">' + Auth.esc(item.voucher_number) + '</span> akan ditolak dengan alasan di bawah ini.',
        'rejectVoucher', item.id, function () { self.refreshKeuangan(); });
    },

    /** Modal detail voucher keuangan dengan aksi WhatsApp, otorisasi & cetak kwitansi. */
    voucherDetail: function (k) {
      var self = this;
      var u = this.state.user;
      var canWrite = ['SUPERADMIN', 'BENDAHARA'].indexOf(u.role) !== -1;
      var canApprove = ['SUPERADMIN', 'KETUA'].indexOf(u.role) !== -1;

      var isMasuk = k.type === 'MASUK';
      var amountColor = isMasuk ? 'text-emerald' : 'text-red-600';
      var bgBanner = isMasuk ? 'from-emerald-50 to-emerald-100/60' : 'from-red-50 to-amber-50';

      var metaRows = [
        ['Nomor Voucher', k.voucher_number, 'mono'],
        ['Jenis Transaksi', isMasuk ? 'Kas Masuk (+)' : 'Kas Keluar (−)', ''],
        ['Akun Kas', k.account_label || k.account, ''],
        ['Kategori Transaksi', k.category || '—', ''],
        ['Tanggal Transaksi', k.transaction_date || '—', ''],
        ['Dibuat Oleh', k.created_by || '—', ''],
        ['Verifikasi Bendahara', k.verified_by_bendahara || 'Belum diverifikasi', ''],
        ['Verifikasi Ketua', k.approved_by_ketum || 'Belum disetujui', '']
      ];
      if (k.rejection_notes) metaRows.push(['Alasan Penolakan', k.rejection_notes, 'warn']);

      var modalHtml = '<div class="p-4 sm:p-6">' +
        '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-gray-100">' +
          '<div class="flex items-center gap-2 flex-wrap min-w-0">' +
            '<span class="font-mono text-xs font-bold text-gray-500 break-all">' + Auth.esc(k.voucher_number) + '</span>' +
            self.badge(k.status, k.status_label) +
          '</div>' +
          '<div class="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-start sm:justify-end">' +
            '<button type="button" id="btnPrintKwitansi" class="btn text-xs px-3 py-1.5 rounded-xl font-bold inline-flex items-center gap-1.5 btn-ghost shadow-sm" title="Cetak Kwitansi / Slip Pembayaran">' +
              '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>' +
              '<span>Cetak Kwitansi</span>' +
            '</button>' +
            '<button type="button" id="btnWaShareVoucher" class="btn text-xs px-3 py-1.5 rounded-xl font-bold inline-flex items-center gap-1.5 btn-wa-ghost shadow-sm" title="Bagikan ke WhatsApp">' +
              '<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>' +
              '<span>Share WA</span>' +
            '</button>' +
            '<button type="button" data-close class="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100">' +
              '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="bg-gradient-to-br ' + bgBanner + ' rounded-2xl p-4 sm:p-6 border border-gray-200/80 mb-5 text-center">' +
          '<div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">' + (isMasuk ? 'Total Kas Masuk' : 'Total Pengeluaran Kas') + '</div>' +
          '<div class="text-2xl sm:text-3xl font-black ' + amountColor + ' tracking-tight break-words">' + (isMasuk ? '+ ' : '− ') + Auth.esc(k.amount_label) + '</div>' +
          '<div class="text-xs sm:text-sm font-semibold text-gray-800 mt-2 max-w-md mx-auto break-words">' + Auth.esc(k.description) + '</div>' +
        '</div>' +
        (k.receipt_url ?
          '<div class="mb-5 p-3.5 sm:p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
            '<div class="flex items-center gap-3">' +
              '<div class="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">' +
                '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' +
              '</div>' +
              '<div><div class="text-xs font-bold text-emerald-950">Bukti Kas / Nota Transaksi</div>' +
                '<div class="text-[11px] text-emerald-700">Tersimpan di Google Drive / Cloud</div></div>' +
            '</div>' +
            '<a href="' + Auth.esc(k.receipt_url) + '" target="_blank" rel="noopener noreferrer" class="btn text-xs bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-xl font-bold shadow-sm inline-flex items-center gap-1.5 transition self-start sm:self-center">Buka Bukti ↗</a>' +
          '</div>' : '') +
        '<div class="space-y-1 divide-y divide-gray-100">' +
          metaRows.map(function (r) {
            var val = r[2] === 'mono' ? '<span class="font-mono text-xs text-gray-700 font-semibold">' + Auth.esc(r[1]) + '</span>'
              : r[2] === 'warn' ? '<span class="text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-xl block border border-red-100 font-medium">' + Auth.esc(r[1]) + '</span>'
              : '<span class="text-sm text-gray-800 font-medium">' + Auth.esc(r[1]) + '</span>';
            return '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2.5">' +
              '<span class="text-xs font-bold text-gray-400 uppercase tracking-wide">' + r[0] + '</span>' +
              '<div>' + val + '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
        (canWrite ?
          '<div class="mt-4 pt-3 border-t border-gray-100">' +
            '<details class="text-xs text-gray-600 group">' +
              '<summary class="font-semibold cursor-pointer text-emerald-700 hover:text-emerald-800 select-none flex items-center gap-1 py-1">' +
                '<span>' + (k.receipt_url ? '✏️ Ganti Tautan Bukti Kas' : '➕ Tambah Tautan Bukti Kas Google Drive') + '</span>' +
              '</summary>' +
              '<div class="mt-2.5 flex gap-2">' +
                '<input id="vDetailReceiptInput" type="url" class="field text-xs flex-1" placeholder="https://drive.google.com/..." value="' + Auth.esc(k.receipt_url || '') + '" />' +
                '<button type="button" id="btnSaveVoucherReceipt" class="btn btn-primary text-xs px-3.5 py-2 rounded-xl font-bold">Simpan</button>' +
              '</div>' +
            '</details>' +
          '</div>' : '') +
        (canWrite && k.status === 'PENDING' ?
          '<div class="mt-6 pt-4 border-t border-gray-100 flex gap-2">' +
            '<button type="button" id="vDetailVerifyBend" class="btn btn-primary flex-1 py-2.5 rounded-xl font-bold text-xs">Verifikasi Bendahara</button>' +
            '<button type="button" id="vDetailReject" class="btn btn-danger px-4 py-2.5 rounded-xl font-bold text-xs">Tolak</button>' +
          '</div>' :
          canApprove && k.status === 'VERIFIED_BY_BENDAHARA' ?
          '<div class="mt-6 pt-4 border-t border-gray-100 flex gap-2">' +
            '<button type="button" id="vDetailApproveKetum" class="btn btn-primary flex-1 py-2.5 rounded-xl font-bold text-xs">Setujui Pengeluaran (Ketua)</button>' +
            '<button type="button" id="vDetailReject" class="btn btn-danger px-4 py-2.5 rounded-xl font-bold text-xs">Tolak</button>' +
          '</div>' : '') +
      '</div>';

      this.openModal(modalHtml, 'max-w-xl');

      var kwitansiBtn = document.getElementById('btnPrintKwitansi');
      if (kwitansiBtn) {
        kwitansiBtn.addEventListener('click', function () {
          self.printKwitansi(k);
        });
      }

      var waBtn = document.getElementById('btnWaShareVoucher');
      if (waBtn) {
        waBtn.addEventListener('click', function () {
          self.openWhatsApp(self.buildKeuanganWaText(k));
        });
      }

      var btnSaveReceipt = document.getElementById('btnSaveVoucherReceipt');
      if (btnSaveReceipt) {
        btnSaveReceipt.addEventListener('click', function () {
          var newUrl = (document.getElementById('vDetailReceiptInput').value || '').trim();
          btnSaveReceipt.disabled = true;
          btnSaveReceipt.textContent = 'Menyimpan...';
          Auth.fetch('updateVoucherReceipt', { id: k.id, receipt_url: newUrl }).then(function () {
            self.toast('Tautan bukti kas berhasil disimpan.', 'success');
            self.closeModal();
            self.refreshKeuangan();
          }).catch(function () {
            btnSaveReceipt.disabled = false;
            btnSaveReceipt.textContent = 'Simpan';
          });
        });
      }

      var btnVerifyBend = document.getElementById('vDetailVerifyBend');
      if (btnVerifyBend) {
        btnVerifyBend.addEventListener('click', function () {
          self.closeModal();
          self.voucherVerify(k, 'verifyVoucherBendahara', 'Verifikasi Bendahara', 'diverifikasi Bendahara & menunggu verifikasi Ketua');
        });
      }

      var btnApproveKetum = document.getElementById('vDetailApproveKetum');
      if (btnApproveKetum) {
        btnApproveKetum.addEventListener('click', function () {
          self.closeModal();
          self.voucherVerify(k, 'verifyVoucherKetum', 'Verifikasi Final Ketua', 'disetujui penuh & masuk perhitungan saldo');
        });
      }

      var btnReject = document.getElementById('vDetailReject');
      if (btnReject) {
        btnReject.addEventListener('click', function () {
          self.closeModal();
          self.voucherReject(k);
        });
      }

      Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
        b.addEventListener('click', function () { self.closeModal(); });
      });
    },

    /** Modal Cetak Bukti Kas / Kwitansi Resmi dengan Terbilang & Tanda Tangan. */
    printKwitansi: function (k) {
      var self = this;
      var isMasuk = k.type === 'MASUK';
      var terbilangText = this.terbilang(k.amount);
      var kopHtml = (window._kopSettings && window._kopSettings.kop_mode === 'image' && window._kopSettings.kop_image_base64)
        ? '<div class="mb-3 text-center"><img src="' + window._kopSettings.kop_image_base64 + '" alt="KOP APII" class="w-full max-h-28 object-contain mx-auto" /></div>'
        : '<div class="flex items-center gap-3 sm:gap-4 mb-2 pb-2 border-b-2 border-emerald-900">' +
            '<img src="logo.png" alt="Logo DPW APII" class="w-10 h-10 sm:w-14 sm:h-14 object-contain flex-shrink-0" />' +
            '<div class="flex-1 text-center font-serif leading-tight min-w-0">' +
              '<div class="text-[9px] sm:text-[11px] font-bold text-[#1B5E20] uppercase tracking-wider">DEWAN PIMPINAN WILAYAH</div>' +
              '<div class="text-xs sm:text-base font-black text-gray-900 tracking-tight break-words">YAYASAN APOLOGET ISLAM INDONESIA (APII)</div>' +
              '<div class="text-[10px] sm:text-xs font-bold text-gray-800">WILAYAH JABODETABEK</div>' +
              '<div class="text-[8px] sm:text-[9px] text-gray-600 font-sans mt-0.5 break-words">' +
                'Gedung Pusat Dakwah APII Wilayah Jabodetabek &bull; Telp: (021) 390-8812 &bull; Website: siapii.sigitadi.id' +
              '</div>' +
            '</div>' +
          '</div>';

      var modalHtml = '<div class="p-3.5 sm:p-6">' +
        '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-gray-100 no-print">' +
          '<h3 class="text-xs sm:text-sm font-bold text-gray-700">Pratinjau Cetak Kwitansi Resmi</h3>' +
          '<div class="flex items-center gap-2 justify-end">' +
            '<button type="button" id="btnDoPrintKwitansi" class="btn btn-primary text-xs px-3 sm:px-4 py-2 rounded-xl font-bold inline-flex items-center gap-1.5 shadow-sm">' +
              '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>' +
              '<span>Cetak / PDF</span>' +
            '</button>' +
            '<button type="button" data-close class="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100">' +
              '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +

        // Kertas Kwitansi Area
        '<div id="printKwitansiArea" class="p-4 sm:p-8 bg-white border border-gray-300 rounded-2xl shadow-lg max-w-[700px] w-full mx-auto text-gray-900 select-text text-xs sm:text-sm font-sans overflow-x-hidden">' +
          kopHtml +
          '<div class="text-center my-3">' +
            '<h2 class="text-xs sm:text-base font-extrabold uppercase tracking-wider underline decoration-2 underline-offset-4 break-words">' +
              (isMasuk ? 'BUKTI PENERIMAAN KAS / KWITANSI' : 'BUKTI PENGELUARAN KAS / KWITANSI') +
            '</h2>' +
            '<div class="font-mono text-xs text-gray-600 mt-1 break-all">Nomor: ' + Auth.esc(k.voucher_number) + '</div>' +
          '</div>' +
          '<div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 text-xs text-gray-600 mb-4 pb-2 border-b border-gray-200">' +
            '<div>Tanggal Transaksi: <strong class="text-gray-900">' + Auth.esc(k.transaction_date) + '</strong></div>' +
            '<div class="text-left sm:text-right">Akun Kas: <strong class="text-gray-900 break-words">' + Auth.esc(k.account_label || k.account) + '</strong></div>' +
          '</div>' +
          '<div class="space-y-3 leading-relaxed">' +
            '<div class="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3"><span class="w-auto sm:w-36 text-gray-500 font-semibold flex-shrink-0">' + (isMasuk ? 'Telah Diterima Dari' : 'Diserahkan Kepada') + ' :</span>' +
              '<span class="font-bold text-gray-900 break-words">' + Auth.esc(k.created_by || 'Bendahara DPW APII') + '</span></div>' +
            '<div class="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3"><span class="w-auto sm:w-36 text-gray-500 font-semibold flex-shrink-0">Jumlah Uang :</span>' +
              '<span class="font-black text-emerald-800 text-base sm:text-lg break-words">' + Auth.esc(k.amount_label) + '</span></div>' +
            '<div class="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs sm:text-sm font-serif italic text-gray-800 break-words">' +
              'Terbilang: &ldquo;<strong>' + Auth.esc(terbilangText) + '</strong>&rdquo;' +
            '</div>' +
            '<div class="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 pt-1"><span class="w-auto sm:w-36 text-gray-500 font-semibold flex-shrink-0">Kategori :</span>' +
              '<span class="text-gray-800 break-words">' + Auth.esc(k.category || 'Operasional') + '</span></div>' +
            '<div class="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3"><span class="w-auto sm:w-36 text-gray-500 font-semibold flex-shrink-0">Untuk Keperluan :</span>' +
              '<span class="font-medium text-gray-900 flex-1 break-words">' + Auth.esc(k.description) + '</span></div>' +
          '</div>' +

          // 3 Kolom Tanda Tangan: responsif mobile
          '<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-2 mt-8 pt-4 border-t border-gray-200 text-center text-xs">' +
            '<div>' +
              '<div class="text-gray-500 mb-1">' + (isMasuk ? 'Penyetor / Penerima' : 'Penerima Dana') + '</div>' +
              '<div class="h-10 sm:h-16 flex items-center justify-center text-[10px] text-gray-300 italic">(Tanda Tangan)</div>' +
              '<div class="font-bold text-gray-800 border-t border-gray-300 pt-1 mt-1 break-words">( ..................................... )</div>' +
            '</div>' +
            '<div>' +
              '<div class="text-gray-500 mb-1">Bendahara DPW</div>' +
              '<div class="h-10 sm:h-16 flex items-center justify-center font-serif text-emerald-900 font-semibold text-xs break-words">' + Auth.esc(k.verified_by_bendahara || 'M. Yusuf Ramadhan, S.E') + '</div>' +
              '<div class="font-bold text-gray-800 border-t border-gray-300 pt-1 mt-1 break-words">M. Yusuf Ramadhan, S.E</div>' +
            '</div>' +
            '<div>' +
              '<div class="text-gray-500 mb-1">Mengetahui, Ketua DPW</div>' +
              '<div class="h-10 sm:h-16 flex items-center justify-center font-serif text-emerald-900 font-semibold text-xs break-words">' + Auth.esc(k.approved_by_ketum || 'Dr. H. Ahmad Fauzi, M.Pd') + '</div>' +
              '<div class="font-bold text-gray-800 border-t border-gray-300 pt-1 mt-1 break-words">Dr. H. Ahmad Fauzi, M.Pd</div>' +
            '</div>' +
          '</div>' +
          '<div class="mt-6 pt-2 border-t border-gray-100 flex flex-col sm:flex-row justify-between gap-1 text-[10px] text-gray-400 font-mono">' +
            '<span>SIAP APII DPW Jabodetabek</span>' +
            '<span>Status: ' + Auth.esc(k.status) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';

      this.openModal(modalHtml, 'max-w-2xl');

      document.getElementById('btnDoPrintKwitansi').addEventListener('click', function () {
        window.print();
      });

      Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
        b.addEventListener('click', function () { self.closeModal(); });
      });
    },

    /** Modal buat voucher baru dengan master rekening dinamis & kategori kustom. */
    voucherForm: function () {
      var self = this;

      // Ambil pengaturan keuangan dan master rekening secara paralel
      Promise.all([
        Auth.getCached('getAccounts', null),
        Auth.getCached('getSettings', null)
      ]).then(function (results) {
        var accData = results[0];
        var sData = results[1];
        var s = (sData && (sData.settings || sData.data)) || sData || {};
        var fCfg = s.finance_config || {};

        var catsMasuk = Array.isArray(fCfg.categories_masuk) && fCfg.categories_masuk.length ? fCfg.categories_masuk : [
          'Infaq & Sedekah', 'Iuran Pengurus DPW', 'Donasi Wakaf', 'Hibah Khusus', 'Dana Sponsor Kegiatan'
        ];
        var catsKeluar = Array.isArray(fCfg.categories_keluar) && fCfg.categories_keluar.length ? fCfg.categories_keluar : [
          'Operasional Sekretariat', 'Honorarium & Ujrah', 'Transportasi & Perjalanan Dinas',
          'Konsumsi Kegiatan', 'Pembelian Inventaris & Aset', 'Santunan Sosial & Kemanusiaan',
          'Publikasi Media & Dokumentasi', 'Pemeliharaan Web & IT'
        ];

        var buildCatOptions = function (type) {
          var arr = type === 'MASUK' ? catsMasuk : catsKeluar;
          return arr.map(function (c) {
            return '<option value="' + Auth.esc(c) + '">' + Auth.esc(c) + '</option>';
          }).join('') + '<option value="CUSTOM">+ Kategori Baru (Ketik Manual)...</option>';
        };

        var accList = Array.isArray(accData) ? accData : ((accData && (accData.accounts || accData.data || accData.items)) || []);
        var accOpts = accList.length ? accList.map(function (a) {
          var name = a.name || a.nama_rekening || 'Akun Kas';
          var bank = a.bank_name || a.bank_vendor || name;
          var num = a.account_number || a.nomor_rekening || '-';
          return '<option value="' + (a.code || a.id) + '">' + Auth.esc(name + ' (' + bank + ' - ' + num + ')') + '</option>';
        }).join('') : Object.keys(window.ACCOUNTS || {}).map(function (k) {
          return '<option value="' + k + '">' + window.ACCOUNTS[k] + '</option>';
        }).join('');

        self.openModal(
          '<div class="p-4 sm:p-6">' +
            '<div class="flex items-center justify-between gap-2 mb-5">' +
              '<h3 class="text-base sm:text-lg font-extrabold text-emerald-dark">Buat Voucher Kas Baru</h3>' +
              '<button data-close class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">' +
                '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>' +
            '</div>' +
            '<form id="voucherFormEl" class="space-y-4">' +
              '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
                '<div><label class="lbl">Jenis Transaksi</label><select id="vfType" class="field">' +
                  '<option value="MASUK">Kas Masuk (Penerimaan)</option><option value="KELUAR">Kas Keluar (Pengeluaran)</option></select></div>' +
                '<div><label class="lbl">Akun Kas</label><select id="vfAccount" class="field">' + accOpts + '</select></div>' +
              '</div>' +
              '<div><label class="lbl">Jumlah (Rp) <span class="text-red-500">*</span></label>' +
                '<input id="vfAmount" type="number" min="1" step="1" required class="field" placeholder="cth: 1500000" /></div>' +
              '<div>' +
                '<label class="lbl">Kategori Transaksi</label>' +
                '<select id="vfCategorySelect" class="field">' + buildCatOptions('MASUK') + '</select>' +
                '<input id="vfCategoryCustom" type="text" class="field mt-2 hidden" placeholder="Ketik nama kategori transaksi baru…" />' +
              '</div>' +
              '<div><label class="lbl">Keterangan Transaksi <span class="text-red-500">*</span></label>' +
                '<textarea id="vfDesc" required rows="3" class="field" placeholder="Uraian peruntukan atau sumber dana…"></textarea></div>' +
              '<div><label class="lbl">Tanggal Transaksi</label>' +
                '<input id="vfTanggal" type="date" class="field" value="' + new Date().toISOString().slice(0, 10) + '" /></div>' +
              '<div>' +
                '<label class="lbl">Unggah Bukti Nota / Kuitansi / Struk (Gambar/PDF)</label>' +
                '<input id="vfReceiptFile" type="file" accept="image/*,application/pdf" class="field text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-emerald-light file:text-emerald-dark" />' +
                '<p class="text-[11px] text-gray-400 mt-1">File akan diunggah otomatis ke Google Drive folder <code>/Keuangan_Bukti_Nota/</code>.</p>' +
              '</div>' +
              '<div><label class="lbl">Atau Tautan Google Drive / Cloud Eksternal (Opsional)</label>' +
                '<input id="vfReceipt" type="url" class="field text-xs" placeholder="https://drive.google.com/file/d/.../view" />' +
              '</div>' +
              '<p class="text-xs text-gray-400">Kas Masuk langsung disahkan Bendahara. Kas Keluar diverifikasi bertingkat oleh Bendahara &amp; disetujui Ketua DPW.</p>' +
              '<div class="flex flex-col sm:flex-row gap-2.5 sm:gap-3 pt-2">' +
                '<button type="submit" id="btnSubmitVoucher" class="btn btn-primary flex-1 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm">Simpan Voucher</button>' +
                '<button type="button" data-close class="btn btn-ghost px-5 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm">Batal</button>' +
              '</div>' +
            '</form>' +
          '</div>');

        var typeSel = document.getElementById('vfType');
        var catSel = document.getElementById('vfCategorySelect');
        var catCust = document.getElementById('vfCategoryCustom');

        // Ganti kategori saat jenis berubah
        typeSel.addEventListener('change', function () {
          catSel.innerHTML = buildCatOptions(typeSel.value);
          catCust.classList.add('hidden');
        });

        // Toggle kategori kustom
        catSel.addEventListener('change', function () {
          if (catSel.value === 'CUSTOM') {
            catCust.classList.remove('hidden');
            catCust.focus();
          } else {
            catCust.classList.add('hidden');
          }
        });

        Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
          b.addEventListener('click', function () { self.closeModal(); });
        });

        document.getElementById('voucherFormEl').addEventListener('submit', function (e) {
          e.preventDefault();
          var btnSub = document.getElementById('btnSubmitVoucher');
          if (btnSub) { btnSub.disabled = true; btnSub.textContent = 'Menyimpan...'; }

          var finalCategory = catSel.value === 'CUSTOM' ? catCust.value.trim() : catSel.value;
          if (!finalCategory) finalCategory = 'Operasional';

          var payload = {
            type: document.getElementById('vfType').value,
            account: document.getElementById('vfAccount').value,
            amount: Number(document.getElementById('vfAmount').value),
            category: finalCategory,
            description: document.getElementById('vfDesc').value.trim(),
            transaction_date: document.getElementById('vfTanggal').value,
            receipt_url: (document.getElementById('vfReceipt').value || '').trim()
          };

          var doSendVoucher = function () {
            Auth.fetch('createVoucher', payload).then(function () {
              self.closeModal();
              self.toast('Voucher berhasil dibuat.', 'success', '📲 Kabari via WA', function () {
                self.openWhatsApp(self.buildKeuanganWaText({
                  voucher_number: '(Voucher Baru)',
                  type: payload.type,
                  amount: payload.amount,
                  amount_label: 'Rp ' + Number(payload.amount).toLocaleString('id-ID'),
                  description: payload.description,
                  account: payload.account,
                  account_label: payload.account,
                  transaction_date: payload.transaction_date,
                  receipt_url: payload.receipt_url,
                  status: payload.type === 'MASUK' ? 'APPROVED' : 'PENDING',
                  status_label: payload.type === 'MASUK' ? 'Disetujui' : 'Menunggu Verifikasi',
                  created_by: self.state.user.full_name || self.state.user.username
                }));
              });
              self.refreshKeuangan();
            }).catch(function () {
              if (btnSub) { btnSub.disabled = false; btnSub.textContent = 'Simpan Voucher'; }
            });
          };

          var fileEl = document.getElementById('vfReceiptFile');
          if (fileEl && fileEl.files && fileEl.files[0]) {
            var file = fileEl.files[0];
            var reader = new FileReader();
            reader.onload = function (evt) {
              payload.receipt_base64 = evt.target.result;
              payload.receipt_file_name = file.name;
              doSendVoucher();
            };
            reader.onerror = function () { doSendVoucher(); };
            reader.readAsDataURL(file);
          } else {
            doSendVoucher();
          }
        });
      });
    },

    // ---------------------------------------------------------------
    // DIVISI KERJA
    // ---------------------------------------------------------------
    renderDivisi: function () {
      var main = document.getElementById('mainContent');
      var u = this.state.user;
      var self = this;
      var canSubmit = ['SUPERADMIN', 'KETUA_DIVISI', 'ANGGOTA_DIVISI'].indexOf(u.role) !== -1;
      var canApprove = ['SUPERADMIN', 'KETUA'].indexOf(u.role) !== -1;

      var newBtn = canSubmit ?
        '<button id="btnUsulanBaru" class="btn btn-primary px-5 py-2.5 rounded-xl inline-flex items-center gap-2 font-bold text-sm">' +
        '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" /></svg>' +
        'Usulkan Program</button>' : '';

      main.innerHTML = this.pageHead('Divisi Kerja',
        canSubmit
          ? 'Usulkan program divisi Anda. Persetujuan hanya melalui Approval Board Ketua.'
          : 'Usulan program dari seluruh divisi kerja. Persetujuan melalui Approval Board Ketua.', newBtn) +
        '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-4 mb-6 flex flex-col sm:flex-row gap-3">' +
          '<input id="divQ" type="text" placeholder="Cari judul / tracking ID…" class="field flex-1" />' +
          '<select id="divStatus" class="field sm:w-48">' +
            '<option value="">Semua Status</option><option value="DRAFT">Draf</option>' +
            '<option value="AJUKAN">Diajukan</option><option value="DISETUJUI">Disetujui</option>' +
            '<option value="PELAKSANAAN">Pelaksanaan</option><option value="LPJ_SELESAI">LPJ Selesai</option>' +
            '<option value="DITOLAK">Ditolak</option>' +
          '</select>' +
        '</div>' +
        '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">' +
          '<div class="overflow-x-auto"><table class="tbl tbl-responsive"><thead><tr>' +
          '<th>Tracking</th><th>Program</th><th>Divisi</th><th>Anggaran</th><th>Status</th><th>Aksi</th>' +
          '</tr></thead><tbody id="divRows">' + this.loadingRow(6) + '</tbody></table></div>' +
        '</div>';

      if (canSubmit) {
        document.getElementById('btnUsulanBaru').addEventListener('click', function () {
          self.submissionForm(null);
        });
      }

      var st = this.state.divisi;
      document.getElementById('divQ').value = st.q;
      document.getElementById('divStatus').value = st.status;

      var load = function () {
        st.q = document.getElementById('divQ').value.trim();
        st.status = document.getElementById('divStatus').value;
        self.loadDivisi(canSubmit, canApprove);
      };
      document.getElementById('divStatus').addEventListener('change', load);
      document.getElementById('divQ').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') load();
      });

      load();
    },

    loadDivisi: function (canSubmit, canApprove) {
      var st = this.state.divisi;
      var tb = document.getElementById('divRows');
      var self = this;

      Auth.get('getListDivisi', { q: st.q, status: st.status, limit: 50 }).then(function (data) {
        var items = (data && data.items) || [];
        tb.innerHTML = items.length ? items.map(function (d) {
          var acts = '';
          acts += self.aBtn('view', 'Detail', 'Lihat detail usulan');
          acts += self.waBtn('Bagikan usulan ke WhatsApp');
          if (d.can_edit) acts += self.aBtn('edit', 'Ubah', 'Ubah draf usulan');
          if (d.can_submit) acts += self.aBtn('submit', 'Ajukan', 'Kirim ke Approval Board Ketua');
          if (canApprove && d.status === 'AJUKAN') {
            acts += self.aBtn('approve', 'Setujui', 'Setujui program');
            acts += self.aBtn('danger reject', 'Tolak', 'Tolak program');
          }
          if (d.can_start) {
            acts += self.aBtn('start', 'Mulai', 'Mulai pelaksanaan program kerja di lapangan');
          }
          if (d.can_lpj) {
            acts += self.aBtn('lpj', 'Kirim LPJ', 'Serahkan Laporan Pertanggungjawaban (LPJ)');
          }
          if (!acts) acts = '<span class="text-xs text-gray-300">—</span>';

          return '<tr data-id="' + d.id + '">' +
            '<td><div class="font-mono text-xs text-gray-500">' + Auth.esc(d.tracking_id) + '</div>' +
              '<div class="font-semibold text-gray-900 leading-snug">' + Auth.esc(d.program_title) + '</div>' +
              '<div class="text-xs text-gray-500 line-clamp-1 mt-0.5">' + Auth.esc(d.description) + '</div></td>' +
            '<td class="whitespace-nowrap text-gray-600 text-xs sm:text-sm"><span class="sm:hidden text-gray-400 font-medium">Divisi: </span>' + Auth.esc(d.division_label) + '</td>' +
            '<td class="whitespace-nowrap font-bold text-gray-800 text-xs sm:text-sm"><span class="sm:hidden text-gray-400 font-medium">Anggaran: </span>' + Auth.esc(d.budget_label) + '</td>' +
            '<td><span class="sm:hidden text-gray-400 font-medium text-xs">Status: </span>' + self.badge(d.status, d.status_label) + '</td>' +
            '<td class="tbl-actions"><div class="flex gap-1.5 flex-wrap min-w-[120px]">' + acts + '</div></td>' +
          '</tr>';
        }).join('') : '<tr class="tbl-empty"><td colspan="6" class="text-center text-gray-400 py-10">Tidak ada usulan yang ditemukan.</td></tr>';

        Array.prototype.forEach.call(tb.querySelectorAll('tr[data-id]'), function (tr) {
          var id = tr.getAttribute('data-id');
          Array.prototype.forEach.call(tr.querySelectorAll('[data-act]'), function (b) {
            b.addEventListener('click', function () {
              var act = b.getAttribute('data-act');
              var item = items.filter(function (x) { return x.id === id; })[0];
              if (act === 'view') self.submissionDetail(item);
              else if (act === 'wa') self.openWhatsApp(self.buildDivisiWaText(item));
              else if (act === 'edit') self.submissionForm(item);
              else if (act === 'submit') self.submissionAjukan(item);
              else if (act === 'approve') self.submissionApprove(item);
              else if (act === 'reject') self.submissionReject(item);
              else if (act === 'start') self.submissionStart(item);
              else if (act === 'lpj') self.submissionLPJForm(item);
            });
          });
        });
      }).catch(function () {
        tb.innerHTML = '<tr class="tbl-empty"><td colspan="6" class="text-center text-red-400 py-10">Gagal memuat data usulan.</td></tr>';
      });
    },

    refreshDivisi: function () {
      var r = this.state.user.role;
      this.loadDivisi(['SUPERADMIN', 'KETUA_DIVISI', 'ANGGOTA_DIVISI'].indexOf(r) !== -1,
        ['SUPERADMIN', 'KETUA'].indexOf(r) !== -1);
    },

    /** Modal detail usulan program divisi dengan aksi WhatsApp & otorisasi. */
    submissionDetail: function (d) {
      var self = this;
      var u = this.state.user;
      var canApprove = ['SUPERADMIN', 'KETUA'].indexOf(u.role) !== -1;

      var lifecycleSteps = [
        { k: 'DRAFT', l: 'Draf', icon: '📝' },
        { k: 'AJUKAN', l: 'Pengajuan', icon: '📤' },
        { k: 'DISETUJUI', l: 'Disetujui', icon: '✅' },
        { k: 'PELAKSANAAN', l: 'Pelaksanaan', icon: '🚀' },
        { k: 'LPJ_SELESAI', l: 'LPJ Selesai', icon: '🏆' }
      ];
      var stepRank = { DRAFT: 0, AJUKAN: 1, DISETUJUI: 2, PELAKSANAAN: 3, LPJ_SELESAI: 4 };
      var currentRank = stepRank[d.status] !== undefined ? stepRank[d.status] : (d.status === 'DITOLAK' ? -1 : 0);

      var stepperHtml = '';
      if (d.status === 'DITOLAK') {
        stepperHtml = '<div class="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800 text-xs mb-5 font-semibold">' +
          '<span class="text-xl">❌</span> <div><div>Usulan Ditolak / Perlu Perbaikan</div><div class="text-[11px] text-red-600 font-normal">Silakan perbaiki poin-poin yang diminta oleh Ketua DPW.</div></div>' +
        '</div>';
      } else {
        stepperHtml = '<div class="mb-5 bg-emerald-50/50 p-3.5 sm:p-4 rounded-2xl border border-emerald-100">' +
          '<div class="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider mb-3">Siklus Program Kerja (5 Tahap)</div>' +
          '<div class="overflow-x-auto pb-1 -mx-1 px-1">' +
            '<div class="grid grid-cols-5 gap-1.5 text-center min-w-[320px]">' +
            lifecycleSteps.map(function (st, idx) {
              var isPassed = idx < currentRank;
              var isCurrent = idx === currentRank;
              var circleCls = isPassed ? 'bg-emerald-600 text-white shadow-xs' :
                isCurrent ? 'bg-emerald-500 text-white ring-4 ring-emerald-200 shadow-sm' :
                'bg-gray-100 text-gray-400';
              var textCls = (isPassed || isCurrent) ? 'font-bold text-gray-800' : 'text-gray-400';
              return '<div class="flex flex-col items-center">' +
                '<div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 transition ' + circleCls + '">' +
                  (isPassed ? '✓' : st.icon) +
                '</div>' +
                '<div class="text-[10px] leading-tight ' + textCls + '">' + st.l + '</div>' +
              '</div>';
            }).join('') +
          '</div>' +
          '</div>' +
        '</div>';
      }

      var lpjHtml = (d.status === 'LPJ_SELESAI' || d.lpj_url) ?
        '<div class="mt-5 p-4 bg-teal-50/90 border border-teal-200 rounded-2xl">' +
          '<div class="flex items-center justify-between pb-2.5 mb-2.5 border-b border-teal-100">' +
            '<div class="flex items-center gap-2">' +
              '<span class="text-lg">📋</span>' +
              '<span class="text-xs font-bold text-teal-950 uppercase tracking-wide">Laporan Pertanggungjawaban (LPJ)</span>' +
            '</div>' +
            '<span class="badge badge-LPJ_SELESAI">Selesai Akuntabel</span>' +
          '</div>' +
          '<div class="grid sm:grid-cols-2 gap-2 text-xs mb-3">' +
            '<div><span class="text-gray-500">Estimasi Awal:</span> <div class="font-bold text-gray-800">' + Auth.esc(d.budget_label) + '</div></div>' +
            '<div><span class="text-gray-500">Realisasi Anggaran:</span> <div class="font-bold text-teal-700">' + Auth.esc(d.realisasi_label || ('Rp ' + Number(d.realisasi_anggaran || 0).toLocaleString('id-ID'))) + '</div></div>' +
          '</div>' +
          (d.lpj_notes ? '<div class="text-xs text-gray-700 bg-white p-3 rounded-xl border border-teal-100 mb-3 leading-relaxed"><strong class="text-gray-900">Catatan Pelaksanaan:</strong> ' + Auth.esc(d.lpj_notes) + '</div>' : '') +
          (d.lpj_url ? '<a href="' + Auth.esc(d.lpj_url) + '" target="_blank" rel="noopener noreferrer" class="btn text-xs bg-teal-700 hover:bg-teal-800 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm inline-flex items-center gap-1.5 w-full justify-center transition">Buka Berkas LPJ di Google Drive ↗</a>' : '') +
        '</div>' : '';

      var metaRows = [
        ['Tracking ID', d.tracking_id, 'mono'],
        ['Divisi Pengusul', d.division_label || d.division, ''],
        ['Estimasi Anggaran', d.budget_label, 'bold'],
        ['Target Peserta', d.target_audience || '—', ''],
        ['Rencana Pelaksanaan', d.execution_date || '—', ''],
        ['Dibuat Oleh', d.created_by || '—', ''],
        ['Status Persetujuan', null, 'badge']
      ];
      if (d.rejection_notes) metaRows.push(['Alasan Penolakan', d.rejection_notes, 'warn']);

      var modalHtml = '<div class="p-4 sm:p-6">' +
        '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-gray-100">' +
          '<div class="flex items-center gap-2 flex-wrap min-w-0">' +
            '<span class="font-mono text-xs font-bold text-gray-500 break-all">' + Auth.esc(d.tracking_id) + '</span>' +
            self.badge(d.status, d.status_label) +
          '</div>' +
          '<div class="flex items-center gap-2 justify-end">' +
            '<button type="button" id="btnWaShareSub" class="btn text-xs px-3 py-1.5 rounded-xl font-bold inline-flex items-center gap-1.5 btn-wa-ghost shadow-sm" title="Bagikan ke WhatsApp">' +
              '<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>' +
              '<span>Share WA</span>' +
            '</button>' +
            '<button type="button" data-close class="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100">' +
              '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
        stepperHtml +
        '<div class="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 sm:p-6 border border-emerald-100 mb-5">' +
          '<div class="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">' + Auth.esc(d.division_label || d.division) + '</div>' +
          '<h3 class="text-lg sm:text-xl font-extrabold text-gray-900 leading-snug break-words">' + Auth.esc(d.program_title) + '</h3>' +
          '<div class="flex items-center gap-3 mt-3 flex-wrap text-xs text-gray-600">' +
            '<span>💰 Anggaran: <strong class="text-emerald-dark font-bold break-words">' + Auth.esc(d.budget_label) + '</strong></span>' +
            '<span>📅 Rencana: <strong>' + Auth.esc(d.execution_date || 'Fleksibel') + '</strong></span>' +
          '</div>' +
        '</div>' +
        '<div class="mb-5">' +
          '<div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Rincian Deskripsi Program</div>' +
          '<div class="bg-gray-50 p-4 rounded-xl text-sm text-gray-800 leading-relaxed whitespace-pre-line border border-gray-100">' +
            Auth.esc(d.description) +
          '</div>' +
        '</div>' +
        lpjHtml +
        '<div class="space-y-1 divide-y divide-gray-100 mt-4">' +
          metaRows.map(function (r) {
            var val = r[2] === 'badge' ? self.badge(d.status, d.status_label)
              : r[2] === 'mono' ? '<span class="font-mono text-xs text-gray-700 font-semibold">' + Auth.esc(r[1]) + '</span>'
              : r[2] === 'bold' ? '<span class="font-bold text-sm text-gray-900">' + Auth.esc(r[1]) + '</span>'
              : r[2] === 'warn' ? '<span class="text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-xl block border border-red-100 font-medium">' + Auth.esc(r[1]) + '</span>'
              : '<span class="text-sm text-gray-800 font-medium">' + Auth.esc(r[1]) + '</span>';
            return '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2.5">' +
              '<span class="text-xs font-bold text-gray-400 uppercase tracking-wide">' + r[0] + '</span>' +
              '<div>' + val + '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
        '<div class="mt-6 pt-4 border-t border-gray-100 flex gap-2 flex-wrap">' +
          (d.can_edit ? '<button type="button" id="subDetailEdit" class="btn btn-ghost text-xs px-4 py-2.5 rounded-xl font-bold">Ubah Draf</button>' : '') +
          (d.can_submit ? '<button type="button" id="subDetailSubmit" class="btn btn-primary flex-1 py-2.5 rounded-xl font-bold text-xs">Ajukan ke Ketua</button>' : '') +
          (canApprove && d.status === 'AJUKAN' ?
            '<button type="button" id="subDetailApprove" class="btn btn-primary flex-1 py-2.5 rounded-xl font-bold text-xs">Setujui Program</button>' +
            '<button type="button" id="subDetailReject" class="btn btn-danger px-4 py-2.5 rounded-xl font-bold text-xs">Tolak</button>' : '') +
          (d.can_start ? '<button type="button" id="subDetailStart" class="btn btn-primary flex-1 py-2.5 rounded-xl font-bold text-xs">🚀 Mulai Pelaksanaan</button>' : '') +
          (d.can_lpj ? '<button type="button" id="subDetailLPJ" class="btn bg-teal-700 hover:bg-teal-800 text-white flex-1 py-2.5 rounded-xl font-bold text-xs">📋 Serahkan LPJ</button>' : '') +
        '</div>' +
      '</div>';

      this.openModal(modalHtml, 'max-w-xl');

      var waBtn = document.getElementById('btnWaShareSub');
      if (waBtn) {
        waBtn.addEventListener('click', function () {
          self.openWhatsApp(self.buildDivisiWaText(d));
        });
      }

      var btnEdit = document.getElementById('subDetailEdit');
      if (btnEdit) {
        btnEdit.addEventListener('click', function () {
          self.closeModal();
          self.submissionForm(d);
        });
      }

      var btnSubmit = document.getElementById('subDetailSubmit');
      if (btnSubmit) {
        btnSubmit.addEventListener('click', function () {
          self.closeModal();
          self.submissionAjukan(d);
        });
      }

      var btnApprove = document.getElementById('subDetailApprove');
      if (btnApprove) {
        btnApprove.addEventListener('click', function () {
          self.closeModal();
          self.submissionApprove(d);
        });
      }

      var btnReject = document.getElementById('subDetailReject');
      if (btnReject) {
        btnReject.addEventListener('click', function () {
          self.closeModal();
          self.submissionReject(d);
        });
      }

      var btnStart = document.getElementById('subDetailStart');
      if (btnStart) {
        btnStart.addEventListener('click', function () {
          self.closeModal();
          self.submissionStart(d);
        });
      }

      var btnLPJ = document.getElementById('subDetailLPJ');
      if (btnLPJ) {
        btnLPJ.addEventListener('click', function () {
          self.closeModal();
          self.submissionLPJForm(d);
        });
      }

      Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
        b.addEventListener('click', function () { self.closeModal(); });
      });
    },

    /** Modal buat/ubah usulan program divisi. */
    submissionForm: function (item) {
      var self = this;
      var isEdit = !!item;
      var u = this.state.user;
      var isSuperadmin = u.role === 'SUPERADMIN';
      var divOpts = Object.keys(window.DIVISIONS || {}).map(function (k) {
        var sel = (item && item.division === k) || (!item && u.division === k) ? ' selected' : '';
        return '<option value="' + k + '"' + sel + '>' + window.DIVISIONS[k] + '</option>';
      }).join('');
      // Peran divisi TIDAK boleh memilih divisi lain (backend memaksa dari token).
      var divField = (!isSuperadmin)
        ? '<input type="hidden" id="dfDivision" value="' + Auth.esc(item ? item.division : u.division) + '" />' +
          '<div><label class="lbl">Divisi</label><input type="text" class="field bg-gray-50" value="' +
          Auth.esc(item ? item.division_label : (u.division_label || window.DIVISIONS[u.division] || '')) + '" readonly /></div>'
        : '<div><label class="lbl">Divisi</label><select id="dfDivision" class="field">' + divOpts + '</select></div>';

      this.openModal(
        '<div class="p-4 sm:p-6">' +
          '<div class="flex items-center justify-between gap-2 mb-5">' +
            '<h3 class="text-base sm:text-lg font-extrabold text-emerald-dark break-words">' + (isEdit ? 'Ubah Usulan Program' : 'Usulkan Program Divisi') + '</h3>' +
            '<button data-close class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">' +
              '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>' +
          '</div>' +
          '<form id="subFormEl" class="space-y-4">' +
            '<div><label class="lbl">Judul Program <span class="text-red-500">*</span></label>' +
              '<input id="dfTitle" type="text" required class="field" placeholder="cth: Workshop Kepenulisan Islam" value="' + Auth.esc(item ? item.program_title : '') + '" /></div>' +
            '<div><label class="lbl">Deskripsi Program <span class="text-red-500">*</span></label>' +
              '<textarea id="dfDesc" required rows="4" class="field" placeholder="Rincian program…">' + Auth.esc(item ? item.description : '') + '</textarea></div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
              '<div><label class="lbl">Estimasi Anggaran (Rp)</label>' +
                '<input id="dfBudget" type="number" min="0" step="1" class="field" placeholder="cth: 5000000" value="' + (item ? item.budget_estimate : '') + '" /></div>' +
              '<div><label class="lbl">Target Peserta</label>' +
                '<input id="dfTarget" type="text" class="field" placeholder="cth: 50 mahasiswa" value="' + Auth.esc(item ? item.target_audience : '') + '" /></div>' +
            '</div>' +
            divField +
            '<div><label class="lbl">Tanggal Pelaksanaan</label>' +
              '<input id="dfTanggal" type="date" class="field" value="' + (item ? item.execution_date : '') + '" /></div>' +
            '<p class="text-xs text-gray-400">Usulan disimpan sebagai Draf. Ajukan ke Ketua setelah siap — divisi tidak dapat mempublikasi sendiri.</p>' +
            '<div class="flex flex-col sm:flex-row gap-2.5 sm:gap-3 pt-2">' +
              '<button type="submit" class="btn btn-primary flex-1 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm">' + (isEdit ? 'Simpan Perubahan' : 'Simpan Draf') + '</button>' +
              '<button type="button" data-close class="btn btn-ghost px-5 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm">Batal</button>' +
            '</div>' +
          '</form>' +
        '</div>');

      Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
        b.addEventListener('click', function () { self.closeModal(); });
      });

      document.getElementById('subFormEl').addEventListener('submit', function (e) {
        e.preventDefault();
        var payload = {
          program_title: document.getElementById('dfTitle').value.trim(),
          description: document.getElementById('dfDesc').value.trim(),
          budget_estimate: Number(document.getElementById('dfBudget').value) || 0,
          target_audience: document.getElementById('dfTarget').value.trim(),
          execution_date: document.getElementById('dfTanggal').value,
          division: document.getElementById('dfDivision').value
        };
        if (isEdit) payload.id = item.id;

        Auth.fetch(isEdit ? 'updateSubmission' : 'createSubmission', payload).then(function () {
          self.closeModal();
          self.toast(isEdit ? 'Usulan berhasil diperbarui.' : 'Usulan program berhasil dibuat.', 'success', !isEdit ? '📲 Kabari via WA' : null, !isEdit ? function () {
            self.openWhatsApp(self.buildDivisiWaText({
              tracking_id: '(Usulan Baru)',
              program_title: payload.program_title,
              description: payload.description,
              budget_estimate: payload.budget_estimate,
              budget_label: 'Rp ' + Number(payload.budget_estimate).toLocaleString('id-ID'),
              target_audience: payload.target_audience,
              execution_date: payload.execution_date,
              division: payload.division,
              division_label: window.DIVISIONS[payload.division] || payload.division,
              status: 'DRAFT',
              status_label: 'Draf'
            }));
          } : null);
          self.refreshDivisi();
        }).catch(function () {});
      });
    },

    submissionAjukan: function (item) {
      var self = this;
      this.confirm('Ajukan Program', 'Usulan <b>' + Auth.esc(item.tracking_id) + '</b> — ' +
        '<b>' + Auth.esc(item.program_title) + '</b> akan dikirim ke Approval Board Ketua. Lanjutkan?', function () {
        Auth.fetch('ajukanSubmission', { id: item.id }).then(function () {
          self.toast('Usulan diajukan ke Ketua.', 'success', '📲 Kabari via WA', function () {
            self.openWhatsApp(self.buildDivisiWaText(item));
          });
          self.refreshDivisi();
        }).catch(function () {});
      });
    },

    submissionApprove: function (item) {
      var self = this;
      this.confirm('Setujui Program', 'Usulan <b>' + Auth.esc(item.program_title) + '</b> dari divisi <b>' +
        Auth.esc(item.division_label) + '</b> akan disetujui. Lanjutkan?', function () {
        Auth.fetch('approveSubmission', { id: item.id }).then(function () {
          self.toast('Usulan program disetujui.', 'success', '📲 Bagikan WA', function () {
            self.openWhatsApp(self.buildDivisiWaText(item));
          });
          self.refreshDivisi();
        }).catch(function () {});
      });
    },

    submissionReject: function (item) {
      var self = this;
      this.rejectModal('Tolak Program',
        'Usulan <b>' + Auth.esc(item.program_title) + '</b> akan ditolak dengan alasan di bawah ini.',
        'rejectSubmission', item.id, function () { self.refreshDivisi(); });
    },

    submissionStart: function (item) {
      var self = this;
      this.confirm('Mulai Pelaksanaan Program',
        'Program <b>' + Auth.esc(item.program_title) + '</b> (' + Auth.esc(item.tracking_id) + ') dari divisi <b>' +
        Auth.esc(item.division_label) + '</b> akan masuk tahap <b>Pelaksanaan</b> di lapangan. Lanjutkan?', function () {
        Auth.fetch('startExecution', { id: item.id }).then(function () {
          self.toast('Program kerja resmi masuk tahap Pelaksanaan!', 'success', '📲 Bagikan WA', function () {
            self.openWhatsApp(self.buildDivisiWaText(Object.assign({}, item, {
              status: 'PELAKSANAAN',
              status_label: 'Pelaksanaan',
              started_at: new Date().toISOString()
            })));
          });
          self.refreshDivisi();
        }).catch(function () {});
      });
    },

    /** Modal serahkan Laporan Pertanggungjawaban (LPJ). */
    submissionLPJForm: function (item) {
      var self = this;
      var defaultRealisasi = item.realisasi_anggaran || item.budget_estimate || '';

      this.openModal(
        '<div class="p-4 sm:p-6">' +
          '<div class="flex items-center justify-between gap-2 mb-4">' +
            '<div class="min-w-0">' +
              '<h3 class="text-base sm:text-lg font-extrabold text-teal-900 break-words">Serahkan LPJ Program Kerja</h3>' +
              '<p class="text-xs text-gray-500 font-mono break-all">' + Auth.esc(item.tracking_id) + ' — ' + Auth.esc(item.program_title) + '</p>' +
            '</div>' +
            '<button data-close class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0">' +
              '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>' +
            '</button>' +
          '</div>' +
          '<div class="bg-teal-50/70 border border-teal-100 rounded-2xl p-4 mb-4 text-xs text-teal-900">' +
            '<div class="flex flex-col sm:flex-row justify-between sm:items-center gap-1 mb-1 font-semibold">' +
              '<span>Divisi: ' + Auth.esc(item.division_label) + '</span>' +
              '<span>Estimasi Awal: ' + Auth.esc(item.budget_label) + '</span>' +
            '</div>' +
            '<p class="text-gray-600">Setelah LPJ diserahkan, status program menjadi <strong>LPJ Selesai</strong> secara akuntabel.</p>' +
          '</div>' +
          '<form id="lpjFormEl" class="space-y-4">' +
            '<div><label class="lbl">Tautan Dokumen LPJ (Google Drive / Cloud) <span class="text-red-500">*</span></label>' +
              '<input id="lpjUrl" type="url" required class="field" placeholder="https://drive.google.com/drive/folders/..." value="' + Auth.esc(item.lpj_url || '') + '" />' +
              '<p class="text-[11px] text-gray-400 mt-1">Lampirkan tautan folder/file dokumen LPJ, laporan kegiatan, &amp; bukti pengeluaran di Google Drive.</p></div>' +
            '<div><label class="lbl">Realisasi Anggaran Akhir (Rp) <span class="text-red-500">*</span></label>' +
              '<input id="lpjRealisasi" type="number" min="0" step="1" required class="field" placeholder="cth: 4800000" value="' + defaultRealisasi + '" /></div>' +
            '<div><label class="lbl">Catatan &amp; Evaluasi Pelaksanaan</label>' +
              '<textarea id="lpjNotes" rows="3" class="field" placeholder="Catatan keberhasilan, kendala, atau evaluasi kegiatan…">' + Auth.esc(item.lpj_notes || '') + '</textarea></div>' +
            '<div class="flex flex-col sm:flex-row gap-2.5 sm:gap-3 pt-2">' +
              '<button type="submit" class="btn bg-teal-700 hover:bg-teal-800 text-white flex-1 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm shadow-sm">Kirim LPJ Selesai</button>' +
              '<button type="button" data-close class="btn btn-ghost px-5 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm">Batal</button>' +
            '</div>' +
          '</form>' +
        '</div>');

      Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
        b.addEventListener('click', function () { self.closeModal(); });
      });

      document.getElementById('lpjFormEl').addEventListener('submit', function (e) {
        e.preventDefault();
        var payload = {
          id: item.id,
          lpj_url: document.getElementById('lpjUrl').value.trim(),
          realisasi_anggaran: Number(document.getElementById('lpjRealisasi').value) || 0,
          lpj_notes: document.getElementById('lpjNotes').value.trim()
        };
        Auth.fetch('submitLPJ', payload).then(function () {
          self.closeModal();
          self.toast('LPJ berhasil diserahkan. Siklus program selesai!', 'success', '📲 Bagikan WA', function () {
            self.openWhatsApp(self.buildDivisiWaText(Object.assign({}, item, {
              status: 'LPJ_SELESAI',
              status_label: 'LPJ Selesai',
              realisasi_anggaran: payload.realisasi_anggaran,
              realisasi_label: 'Rp ' + payload.realisasi_anggaran.toLocaleString('id-ID'),
              lpj_url: payload.lpj_url
            })));
          });
          self.refreshDivisi();
        }).catch(function () {});
      });
    },

    // ---------------------------------------------------------------
    // MANAJEMEN PENGGUNA (SUPERADMIN)
    // ---------------------------------------------------------------
    renderPengguna: function () {
      var main = document.getElementById('mainContent');
      var self = this;
      var currentTab = this.state.pengguna.tab || 'pengurus';

      var newBtn = (currentTab === 'pengurus' && Auth.isSuperadmin())
        ? '<button id="btnUserBaru" class="btn btn-primary px-5 py-2.5 rounded-xl inline-flex items-center gap-2 font-bold text-sm">' +
          '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" /></svg>' +
          'Buat Akun Pengurus</button>'
        : '';

      main.innerHTML = this.pageHead('Manajemen Pengguna &amp; Pendaftar',
        'Kelola 8 peran pengurus yayasan dan verifikasi berkas calon anggota dari portal publik.', newBtn) +
        '<div class="flex items-center gap-2 p-1.5 bg-gray-100 rounded-2xl mb-6 max-w-md">' +
          '<button type="button" id="tabPengurusBtn" class="flex-1 py-2 px-4 rounded-xl text-xs font-bold transition ' + (currentTab === 'pengurus' ? 'bg-white text-emerald-dark shadow-sm' : 'text-gray-500 hover:text-gray-900') + '">👥 Pengurus Yayasan</button>' +
          '<button type="button" id="tabPendaftarBtn" class="flex-1 py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ' + (currentTab === 'pendaftar' ? 'bg-white text-emerald-dark shadow-sm' : 'text-gray-500 hover:text-gray-900') + '">' +
            '<span>📥 Pendaftaran Masuk</span>' +
            '<span id="pendaftarBadge" class="hidden px-2 py-0.5 text-[10px] rounded-full bg-amber-500 text-white font-extrabold">0</span>' +
          '</button>' +
        '</div>' +
        '<div id="penggunaContainer"></div>';

      document.getElementById('tabPengurusBtn').addEventListener('click', function () {
        self.state.pengguna.tab = 'pengurus';
        self.renderPengguna();
      });
      document.getElementById('tabPendaftarBtn').addEventListener('click', function () {
        self.state.pengguna.tab = 'pendaftar';
        self.renderPengguna();
      });

      // Update badge pending
      Auth.getCached('getListPendaftar', null, function (pData) {
        var pItems = (pData && pData.items) || [];
        var pendingCount = pItems.filter(function (x) { return x.status === 'PENDING' || x.status === 'VERIFIED_SEKRETARIS'; }).length;
        var badge = document.getElementById('pendaftarBadge');
        if (badge && pendingCount > 0) {
          badge.textContent = pendingCount;
          badge.classList.remove('hidden');
        }
      });

      if (currentTab === 'pengurus') {
        this.renderPengurusView();
      } else {
        this.renderPendaftarView();
      }
    },

    renderPengurusView: function () {
      var box = document.getElementById('penggunaContainer');
      var self = this;
      box.innerHTML =
        '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-4 mb-6">' +
          '<input id="usrQ" type="text" placeholder="Cari nama pengurus / username…" class="field" />' +
        '</div>' +
        '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">' +
          '<div class="overflow-x-auto"><table class="tbl tbl-responsive"><thead><tr>' +
          '<th>Username</th><th>Nama Pengurus</th><th>Peran Organisasi</th><th>Divisi Kerja</th><th>Status Akun</th><th>Aksi</th>' +
          '</tr></thead><tbody id="usrRows">' + this.loadingRow(6) + '</tbody></table></div>' +
        '</div>';

      var btnBaru = document.getElementById('btnUserBaru');
      if (btnBaru) {
        btnBaru.addEventListener('click', function () { self.userForm(null); });
      }

      var q = '';
      var inputQ = document.getElementById('usrQ');
      inputQ.addEventListener('input', function (e) {
        q = e.target.value.trim();
        self.loadPengguna(q);
      });

      this.loadPengguna('');
    },

    loadPengguna: function (q) {
      var tb = document.getElementById('usrRows');
      var self = this;
      if (!tb) return;

      Auth.getCached('getListPengguna', null, function (data) {
        var users = (data && data.users) || [];
        var ql = (q || '').toLowerCase();
        if (ql) {
          users = users.filter(function (u) {
            return (u.username || '').toLowerCase().indexOf(ql) !== -1 ||
                   (u.full_name || '').toLowerCase().indexOf(ql) !== -1;
          });
        }
        tb.innerHTML = users.length ? users.map(function (u) {
          return '<tr data-id="' + u.id + '">' +
            '<td><div class="font-mono text-xs font-semibold text-emerald-dark">' + Auth.esc(u.username) + '</div>' +
              '<div class="font-semibold text-gray-900 leading-snug">' + Auth.esc(u.full_name || '—') + '</div>' +
              '<div class="text-xs text-gray-400 font-normal">' + Auth.esc(u.email || '') + '</div></td>' +
            '<td><span class="sm:hidden text-gray-400 font-medium text-xs">Peran: </span><span class="badge badge-PUBLISHED">' + Auth.esc(u.role_label || u.role) + '</span></td>' +
            '<td class="text-gray-600 whitespace-nowrap text-xs sm:text-sm"><span class="sm:hidden text-gray-400 font-medium">Divisi: </span>' + Auth.esc(u.division_label || '—') + '</td>' +
            '<td><span class="sm:hidden text-gray-400 font-medium text-xs">Status: </span>' + (u.is_active === 'TRUE'
              ? '<span class="badge badge-PUBLISHED">Aktif</span>'
              : '<span class="badge badge-REJECTED">Nonaktif</span>') + '</td>' +
            '<td class="tbl-actions"><div class="flex gap-1.5 flex-wrap">' +
              (Auth.isSuperadmin()
                ? self.aBtn('edit', 'Ubah', 'Ubah akun') +
                  self.aBtn(u.is_active === 'TRUE' ? 'danger toggle' : 'toggle',
                    u.is_active === 'TRUE' ? 'Nonaktifkan' : 'Aktifkan', 'Ubah status akun')
                : '<span class="text-xs text-gray-300">—</span>') +
              '</div></td>' +
          '</tr>';
        }).join('') : '<tr class="tbl-empty"><td colspan="6" class="text-center text-gray-400 py-10">Tidak ada pengurus yang ditemukan.</td></tr>';

        Array.prototype.forEach.call(tb.querySelectorAll('tr[data-id]'), function (tr) {
          var id = tr.getAttribute('data-id');
          Array.prototype.forEach.call(tr.querySelectorAll('[data-act]'), function (b) {
            b.addEventListener('click', function () {
              var act = b.getAttribute('data-act');
              var item = users.filter(function (x) { return x.id === id; })[0];
              if (act === 'edit') self.userForm(item);
              else if (act === 'toggle') self.userToggle(item);
            });
          });
        });
      });
    },

    renderPendaftarView: function () {
      var box = document.getElementById('penggunaContainer');
      var self = this;
      box.innerHTML =
        '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-4 mb-6 flex flex-col sm:flex-row gap-3 items-center">' +
          '<input id="pendaftarQ" type="text" placeholder="Cari nama pemohon / NIK / WA / kota…" class="field flex-1" />' +
          '<select id="pendaftarStatus" class="field sm:w-56">' +
            '<option value="">Semua Status Berkas</option>' +
            '<option value="PENDING">Menunggu Sekretariat</option>' +
            '<option value="VERIFIED_SEKRETARIS">Terverifikasi Sekretaris</option>' +
            '<option value="APPROVED">Disetujui Ketua DPW</option>' +
            '<option value="REJECTED">Ditolak</option>' +
          '</select>' +
          '<button type="button" id="btnExportPendaftar" class="btn btn-ghost px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border border-emerald-200 text-emerald-800 hover:bg-emerald-50 whitespace-nowrap">' +
            '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' +
            '<span>📥 Ekspor CSV</span></button>' +
        '</div>' +
        '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">' +
          '<div class="overflow-x-auto"><table class="tbl tbl-responsive"><thead><tr>' +
          '<th>No. Registrasi &amp; Nama</th><th>NIK &amp; Kontak</th><th>Domisili</th><th>Tgl Daftar</th><th>Status</th><th>Aksi</th>' +
          '</tr></thead><tbody id="pendaftarRows">' + this.loadingRow(6) + '</tbody></table></div>' +
        '</div>';

      var load = function () {
        self.loadPendaftar();
      };
      document.getElementById('pendaftarQ').addEventListener('input', load);
      document.getElementById('pendaftarStatus').addEventListener('change', load);

      var btnExp = document.getElementById('btnExportPendaftar');
      if (btnExp) {
        btnExp.addEventListener('click', function () {
          btnExp.disabled = true;
          self.toast('Menyiapkan file ekspor CSV pendaftar...', 'info');
          Auth.fetch('exportPendaftar', {}).then(function (res) {
            btnExp.disabled = false;
            if (res && res.csv) {
              var blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
              var url = URL.createObjectURL(blob);
              var a = document.createElement('a');
              a.href = url;
              a.download = res.filename || ('Pendaftar_APII_' + new Date().toISOString().slice(0, 10) + '.csv');
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              self.toast('File CSV pendaftar berhasil diunduh.', 'success');
            } else {
              self.toast('Data pendaftar kosong untuk diekspor.', 'warning');
            }
          }).catch(function (err) {
            btnExp.disabled = false;
            self.toast('Gagal ekspor: ' + Auth.esc(err.message), 'error');
          });
        });
      }

      this.loadPendaftar();
    },

    loadPendaftar: function () {
      var tb = document.getElementById('pendaftarRows');
      var self = this;
      if (!tb) return;
      var q = (document.getElementById('pendaftarQ') ? document.getElementById('pendaftarQ').value.trim() : '').toLowerCase();
      var st = document.getElementById('pendaftarStatus') ? document.getElementById('pendaftarStatus').value : '';

      Auth.getCached('getListPendaftar', null, function (data) {
        var items = (data && data.items) || [];
        if (q) {
          items = items.filter(function (x) {
            return (x.nama_lengkap || '').toLowerCase().indexOf(q) !== -1 ||
                   (x.nik || '').toLowerCase().indexOf(q) !== -1 ||
                   (x.whatsapp || '').toLowerCase().indexOf(q) !== -1 ||
                   (x.registration_no || '').toLowerCase().indexOf(q) !== -1 ||
                   (x.kota || '').toLowerCase().indexOf(q) !== -1;
          });
        }
        if (st) {
          items = items.filter(function (x) { return x.status === st; });
        }

        tb.innerHTML = items.length ? items.map(function (p) {
          var statusBadge = self.badge(p.status, p.status_label || p.status);
          return '<tr data-id="' + p.id + '">' +
            '<td><div class="font-mono text-xs text-gray-500 font-bold">' + Auth.esc(p.registration_no) + '</div>' +
              '<div class="font-bold text-gray-900 leading-snug">' + Auth.esc(p.nama_lengkap) + '</div>' +
              '<div class="text-xs text-gray-500">' + Auth.esc(p.profesi || '') + '</div></td>' +
            '<td><div class="font-mono text-xs text-gray-600">' + Auth.esc(p.nik) + '</div>' +
              '<div class="text-xs text-emerald-800 font-semibold">WA: ' + Auth.esc(p.whatsapp) + '</div>' +
              '<div class="text-xs text-gray-400">' + Auth.esc(p.email || '') + '</div></td>' +
            '<td class="text-gray-700 text-xs sm:text-sm">' + Auth.esc(p.kota || '—') + '</td>' +
            '<td class="text-gray-500 text-xs whitespace-nowrap">' + Auth.esc((p.created_at || '').slice(0, 10)) + '</td>' +
            '<td>' + statusBadge + '</td>' +
            '<td class="tbl-actions"><div class="flex gap-1.5">' +
              self.aBtn('review', 'Periksa Berkas', 'Lihat biodata, KTP & foto selfie') +
            '</div></td>' +
          '</tr>';
        }).join('') : '<tr class="tbl-empty"><td colspan="6" class="text-center text-gray-400 py-10">Tidak ada pendaftar yang sesuai filter.</td></tr>';

        Array.prototype.forEach.call(tb.querySelectorAll('tr[data-id]'), function (tr) {
          var id = tr.getAttribute('data-id');
          var btn = tr.querySelector('[data-act="review"]');
          if (btn) {
            btn.addEventListener('click', function () {
              var item = items.filter(function (x) { return x.id === id; })[0];
              if (item) self.pendaftarDetail(item);
            });
          }
        });
      });
    },

    /** Modal periksa berkas pendaftaran anggota (biodata, KTP watermarked, foto selfie, verifikasi). */
    pendaftarDetail: function (p) {
      var self = this;
      var u = this.state.user;
      var canVerifySekretaris = ['SUPERADMIN', 'SEKRETARIS'].indexOf(u.role) !== -1;
      var canApproveKetum = ['SUPERADMIN', 'KETUA'].indexOf(u.role) !== -1;

      var ktpHtml = p.ktp_image_url
        ? '<div class="mt-2 text-center">' +
            '<a href="' + Auth.esc(p.ktp_image_url) + '" target="_blank" rel="noopener">' +
              '<img src="' + Auth.esc(p.ktp_image_url) + '" alt="KTP Watermarked" class="max-h-48 max-w-full object-contain rounded-xl border border-gray-200 mx-auto shadow-sm hover:opacity-95 transition" />' +
            '</a>' +
            '<p class="text-[11px] text-gray-500 mt-1 italic">Klik gambar untuk melihat resolusi penuh (Watermarked ARSIP APII)</p>' +
          '</div>'
        : '<div class="p-6 bg-gray-50 rounded-xl text-center text-xs text-gray-400">Tidak ada lampiran foto KTP</div>';

      var selfieHtml = p.selfie_image_url
        ? '<div class="mt-2 text-center">' +
            '<a href="' + Auth.esc(p.selfie_image_url) + '" target="_blank" rel="noopener">' +
              '<img src="' + Auth.esc(p.selfie_image_url) + '" alt="Pas Foto / Selfie" class="max-h-48 max-w-full object-contain rounded-xl border border-gray-200 mx-auto shadow-sm hover:opacity-95 transition" />' +
            '</a>' +
            '<p class="text-[11px] text-gray-500 mt-1 italic">Foto Verifikasi Wajah Pemohon</p>' +
          '</div>'
        : '<div class="p-6 bg-gray-50 rounded-xl text-center text-xs text-gray-400">Tidak ada lampiran foto selfie</div>';

      var modalHtml = '<div class="p-4 sm:p-6">' +
        '<div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-gray-100 gap-2">' +
          '<div class="min-w-0">' +
            '<div class="font-mono text-xs text-gray-500 font-bold break-all">' + Auth.esc(p.registration_no) + '</div>' +
            '<h3 class="text-base sm:text-lg font-black text-emerald-dark break-words">' + Auth.esc(p.nama_lengkap) + '</h3>' +
          '</div>' +
          '<div class="flex items-center gap-2 justify-end flex-wrap">' +
            self.badge(p.status, p.status_label || p.status) +
            '<button type="button" data-close class="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100">' +
              '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +

        // Detail Biodata
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-6">' +
          '<div class="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-100">' +
            '<div><span class="text-gray-400 block">NIK:</span><span class="font-mono font-bold text-gray-900 break-all">' + Auth.esc(p.nik) + '</span></div>' +
            '<div><span class="text-gray-400 block">Tempat, Tanggal Lahir:</span><span class="font-semibold text-gray-800 break-words">' + Auth.esc(p.tempat_lahir || '-') + ', ' + Auth.esc(p.tanggal_lahir || '-') + '</span></div>' +
            '<div><span class="text-gray-400 block">Jenis Kelamin:</span><span class="font-semibold text-gray-800 break-words">' + Auth.esc(p.jenis_kelamin || '-') + '</span></div>' +
            '<div><span class="text-gray-400 block">Profesi / Keahlian:</span><span class="font-semibold text-gray-800 break-words">' + Auth.esc(p.profesi || '-') + '</span></div>' +
          '</div>' +
          '<div class="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-100">' +
            '<div><span class="text-gray-400 block">WhatsApp:</span><a href="https://wa.me/' + encodeURIComponent((p.whatsapp || '').replace(/[^0-9]/g, '')) + '" target="_blank" class="font-bold text-emerald font-mono hover:underline break-all">' + Auth.esc(p.whatsapp) + ' ↗</a></div>' +
            '<div><span class="text-gray-400 block">Email:</span><span class="font-semibold text-gray-800 break-all">' + Auth.esc(p.email || '-') + '</span></div>' +
            '<div><span class="text-gray-400 block">Kota / Domisili:</span><span class="font-semibold text-gray-800 break-words">' + Auth.esc(p.kota || '-') + '</span></div>' +
            '<div><span class="text-gray-400 block">Alamat Lengkap:</span><span class="text-gray-800 break-words">' + Auth.esc(p.alamat || '-') + '</span></div>' +
          '</div>' +
        '</div>' +

        (p.alasan_bergabung ?
          '<div class="p-3 bg-amber-50/70 rounded-xl border border-amber-200 mb-6 text-xs text-amber-950">' +
            '<span class="font-bold block mb-1">Motivasi &amp; Alasan Bergabung APII:</span>' +
            '<p class="italic break-words">' + Auth.esc(p.alasan_bergabung) + '</p>' +
          '</div>' : '') +

        // Berkas Gambar KTP & Selfie
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">' +
          '<div class="p-3 bg-white rounded-xl border border-emerald-100">' +
            '<div class="text-xs font-bold text-emerald-dark">Foto KTP (Watermarked)</div>' +
            ktpHtml +
          '</div>' +
          '<div class="p-3 bg-white rounded-xl border border-emerald-100">' +
            '<div class="text-xs font-bold text-emerald-dark">Pas Foto / Selfie</div>' +
            selfieHtml +
          '</div>' +
        '</div>' +

        // Action Buttons Verifikasi Ganda & Cetak Tanda Terima
        '<div class="flex gap-2 pt-2 border-t border-gray-100 flex-wrap">' +
          (canVerifySekretaris && p.status === 'PENDING' ?
            '<button type="button" id="btnVerifSekretaris" class="btn btn-primary flex-1 py-3 rounded-xl font-bold text-xs shadow-sm">✅ Verifikasi Berkas (Sekretaris)</button>' : '') +
          (canApproveKetum && (p.status === 'VERIFIED_SEKRETARIS' || p.status === 'DIVERIFIKASI_SEKRETARIS') ?
            '<button type="button" id="btnApproveKetum" class="btn bg-gold hover:bg-gold-light text-emerald-dark flex-1 py-3 rounded-xl font-extrabold text-xs shadow-sm">🌟 Sahkan &amp; Setujui Anggota (Ketua DPW)</button>' : '') +
          (p.status === 'PENDING' || p.status === 'VERIFIED_SEKRETARIS' || p.status === 'DIVERIFIKASI_SEKRETARIS' ?
            '<button type="button" id="btnRejectPendaftar" class="btn btn-danger px-4 py-3 rounded-xl font-bold text-xs">Tolak Berkas</button>' : '') +
          '<button type="button" id="btnPrintReceiptBtn" class="btn btn-ghost px-4 py-3 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 border border-gray-200"><span>🖨️ Cetak Tanda Terima</span></button>' +
          '<button type="button" data-close class="btn btn-ghost px-5 rounded-xl font-semibold text-xs">Tutup</button>' +
        '</div>' +
      '</div>';

      this.openModal(modalHtml, 'max-w-2xl');

      var bVerifSekretaris = document.getElementById('btnVerifSekretaris');
      if (bVerifSekretaris) {
        bVerifSekretaris.addEventListener('click', function () {
          self.confirm('Verifikasi Berkas Calon Anggota', 'Apakah berkas NIK dan data pendaftaran <b>' + Auth.esc(p.nama_lengkap) + '</b> sudah sah & valid?', function () {
            Auth.fetch('verifyPendaftarSekretaris', { id: p.id }).then(function () {
              self.closeModal();
              self.toast('Berkas berhasil diverifikasi oleh Sekretaris. Menunggu persetujuan Ketua DPW.', 'success');
              self.loadPendaftar();
            }).catch(function () {});
          });
        });
      }

      var bApproveKetum = document.getElementById('btnApproveKetum');
      if (bApproveKetum) {
        bApproveKetum.addEventListener('click', function () {
          self.confirm('Pengesahan Anggota Baru', 'Sahkan <b>' + Auth.esc(p.nama_lengkap) + '</b> sebagai Anggota Resmi APII DPW Jabodetabek?', function () {
            Auth.fetch('approvePendaftarKetum', { id: p.id }).then(function () {
              self.closeModal();
              self.toast('Pendaftaran anggota berhasil disahkan & disetujui penuh oleh Ketua DPW.', 'success');
              self.loadPendaftar();
            }).catch(function () {});
          });
        });
      }

      var bReject = document.getElementById('btnRejectPendaftar');
      if (bReject) {
        bReject.addEventListener('click', function () {
          self.rejectModal('Tolak Pendaftaran', 'Pendaftaran <b>' + Auth.esc(p.nama_lengkap) + '</b> akan ditolak dengan alasan di bawah ini.',
            'rejectPendaftar', p.id, function () { self.loadPendaftar(); });
        });
      }

      var bPrintReceipt = document.getElementById('btnPrintReceiptBtn');
      if (bPrintReceipt) {
        bPrintReceipt.addEventListener('click', function () {
          self.cetakTandaTerima(p);
        });
      }

      Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
        b.addEventListener('click', function () { self.closeModal(); });
      });
    },

    /** Cetak tanda terima pendaftaran anggota resmi */
    cetakTandaTerima: function (p) {
      var self = this;
      var receiptHtml =
        '<div class="p-6 bg-white max-w-xl mx-auto printable-receipt" id="receiptPrintArea">' +
          '<div class="flex items-center justify-between border-b-2 border-emerald-900 pb-3 mb-4">' +
            '<div class="flex items-center gap-3">' +
              '<div class="w-12 h-12 rounded-xl bg-emerald-900 text-gold-light flex items-center justify-center font-black text-xl">APII</div>' +
              '<div>' +
                '<h2 class="text-sm font-extrabold text-emerald-950 uppercase tracking-wide">YAYASAN APOLOGET ISLAM INDONESIA</h2>' +
                '<p class="text-[10px] text-gray-600 font-semibold">DEWAN PIMPINAN WILAYAH (DPW) JABODETABEK</p>' +
              '</div>' +
            '</div>' +
            '<div class="text-right">' +
              '<span class="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">TANDA TERIMA</span>' +
              '<div class="text-[10px] text-gray-500 font-mono mt-0.5">' + Auth.esc((p.created_at || '').slice(0, 10)) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="text-center my-3">' +
            '<h3 class="text-base font-black text-gray-900 uppercase">BUKTI PENDAFTARAN ANGGOTA</h3>' +
            '<div class="font-mono text-sm font-extrabold text-emerald-800 bg-emerald-50 inline-block px-3 py-1 rounded-lg border border-emerald-200 mt-1">' +
              Auth.esc(p.registration_no || 'REG-APII') + '</div>' +
          '</div>' +
          '<div class="space-y-2 text-xs py-3 border-y border-dashed border-gray-300 my-3">' +
            '<div class="flex justify-between"><span class="text-gray-500">Nama Lengkap:</span><strong class="text-gray-900">' + Auth.esc(p.nama_lengkap) + '</strong></div>' +
            '<div class="flex justify-between"><span class="text-gray-500">NIK:</span><span class="font-mono font-bold text-gray-800">' + Auth.esc(p.nik) + '</span></div>' +
            '<div class="flex justify-between"><span class="text-gray-500">WhatsApp / Telp:</span><span class="font-mono text-gray-800">' + Auth.esc(p.whatsapp) + '</span></div>' +
            '<div class="flex justify-between"><span class="text-gray-500">Domisili:</span><span class="text-gray-800">' + Auth.esc(p.kota || '—') + '</span></div>' +
            '<div class="flex justify-between"><span class="text-gray-500">Status Pendaftaran:</span>' + self.badge(p.status, p.status_label || p.status) + '</div>' +
          '</div>' +
          '<div class="p-3 bg-gray-50 rounded-xl text-[10px] text-gray-500 leading-relaxed mb-4">' +
            'Dokumen ini adalah tanda terima registrasi pendaftaran resmi Yayasan APII DPW Jabodetabek. ' +
            'Pendaftar dapat memantau status verifikasi berkas secara berkala melalui narahubung Sekretariat DPW.' +
          '</div>' +
          '<div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 no-print">' +
            '<button type="button" id="btnDoPrintReceipt" class="btn btn-primary px-5 py-2.5 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 shadow-sm">' +
              '<span>🖨️ Cetak / Simpan PDF</span></button>' +
            '<button type="button" data-close class="btn btn-ghost px-4 py-2.5 rounded-xl font-semibold text-xs">Tutup</button>' +
          '</div>' +
        '</div>';

      self.openModal(receiptHtml, 'max-w-xl');

      var bDoPrint = document.getElementById('btnDoPrintReceipt');
      if (bDoPrint) {
        bDoPrint.addEventListener('click', function () {
          window.print();
        });
      }

      Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
        b.addEventListener('click', function () { self.closeModal(); });
      });
    },

    /** Modal buat/ubah akun pengguna pengurus (SUPERADMIN). Hanya 8 peran pengurus. */
    userForm: function (item) {
      var self = this;
      var isEdit = !!item;
      var R = window.ROLES || {};
      var D = window.DIVISIONS || {};

      var roleOpts = Object.keys(R).map(function (k) {
        return '<option value="' + k + '"' + (item && item.role === k ? ' selected' : '') + '>' + R[k] + '</option>';
      }).join('');
      var divOpts = '<option value="">— Tidak ada —</option>' + Object.keys(D).map(function (k) {
        return '<option value="' + k + '"' + (item && item.division === k ? ' selected' : '') + '>' + D[k] + '</option>';
      }).join('');

      this.openModal(
        '<div class="p-4 sm:p-6">' +
          '<div class="flex items-center justify-between gap-2 mb-5">' +
            '<h3 class="text-base sm:text-lg font-extrabold text-emerald-dark break-words">' + (isEdit ? 'Ubah Akun Pengurus' : 'Buat Akun Pengurus Baru') + '</h3>' +
            '<button data-close class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">' +
              '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>' +
          '</div>' +
          '<form id="userFormEl" class="space-y-4">' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
              '<div><label class="lbl">Username <span class="text-red-500">*</span></label>' +
                '<input id="ufUsername" type="text" ' + (isEdit ? 'readonly' : 'required') +
                ' class="field font-mono" placeholder="cth: sekretaris2" value="' + Auth.esc(item ? item.username : '') + '" /></div>' +
              '<div><label class="lbl">Nama Lengkap</label>' +
                '<input id="ufNama" type="text" class="field" placeholder="Nama lengkap pengurus" value="' + Auth.esc(item ? item.full_name : '') + '" /></div>' +
            '</div>' +
            '<div><label class="lbl">Email</label>' +
              '<input id="ufEmail" type="email" class="field" placeholder="email@contoh.com" value="' + Auth.esc(item ? item.email : '') + '" /></div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
              '<div><label class="lbl">Peran Organisasi <span class="text-red-500">*</span></label><select id="ufRole" class="field">' + roleOpts + '</select></div>' +
              '<div><label class="lbl">Divisi Kerja</label><select id="ufDivisi" class="field">' + divOpts + '</select></div>' +
            '</div>' +
            '<div><label class="lbl">Password ' + (isEdit ? '(kosongkan bila tidak diubah)' : '<span class="text-red-500">*</span>') + '</label>' +
              '<input id="ufPassword" type="password" ' + (isEdit ? '' : 'required') +
              ' class="field" minlength="6" placeholder="Minimal 6 karakter" /></div>' +
            '<label class="flex items-center gap-2.5 text-sm cursor-pointer">' +
              '<input id="ufAktif" type="checkbox" class="h-4 w-4 accent-emerald" ' +
              (!isEdit || item.is_active === 'TRUE' ? 'checked' : '') + ' /> Akun aktif</label>' +
            '<div class="flex flex-col sm:flex-row gap-2.5 sm:gap-3 pt-2">' +
              '<button type="submit" class="btn btn-primary flex-1 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm">' + (isEdit ? 'Simpan Perubahan' : 'Buat Akun Pengurus') + '</button>' +
              '<button type="button" data-close class="btn btn-ghost px-5 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm">Batal</button>' +
            '</div>' +
          '</form>' +
        '</div>');

      Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
        b.addEventListener('click', function () { self.closeModal(); });
      });

      document.getElementById('userFormEl').addEventListener('submit', function (e) {
        e.preventDefault();
        var payload = {
          full_name: document.getElementById('ufNama').value.trim(),
          email: document.getElementById('ufEmail').value.trim(),
          role: document.getElementById('ufRole').value,
          division: document.getElementById('ufDivisi').value,
          is_active: document.getElementById('ufAktif').checked,
          password: document.getElementById('ufPassword').value
        };
        if (!isEdit) payload.username = document.getElementById('ufUsername').value.trim();
        else payload.id = item.id;

        Auth.fetch(isEdit ? 'updatePengguna' : 'createPengguna', payload).then(function () {
          self.closeModal();
          self.toast(isEdit ? 'Akun pengurus berhasil diperbarui.' : 'Akun pengurus baru berhasil dibuat.', 'success');
          self.loadPengguna(document.getElementById('usrQ') ? document.getElementById('usrQ').value.trim() : '');
        }).catch(function () {});
      });
    },

    userToggle: function (item) {
      var self = this;
      var akan = item.is_active === 'TRUE' ? 'dinonaktifkan' : 'diaktifkan kembali';
      this.confirm((item.is_active === 'TRUE' ? 'Nonaktifkan' : 'Aktifkan') + ' Akun',
        'Akun <b>' + Auth.esc(item.username) + '</b> akan ' + akan + '. Lanjutkan?', function () {
          Auth.fetch('updatePengguna', {
            id: item.id,
            is_active: item.is_active !== 'TRUE'
          }).then(function () {
            self.toast('Status akun berhasil diubah.', 'success');
            self.loadPengguna(document.getElementById('usrQ') ? document.getElementById('usrQ').value.trim() : '');
          }).catch(function () {});
        });
    },

    // ---------------------------------------------------------------
    // JEJAK AUDIT
    // ---------------------------------------------------------------
    renderAudit: function () {
      var main = document.getElementById('mainContent');
      var self = this;

      var exportBtn = '<button type="button" id="btnExportAuditCsv" class="btn btn-ghost px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border-emerald-300 text-emerald-800 bg-white hover:bg-emerald-50 shadow-sm">' +
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' +
        '<span>Ekspor CSV</span></button>';

      main.innerHTML = this.pageHead('Jejak Audit &amp; Kepatuhan',
        'Catatan keamanan setiap aksi penting organisasi. Dilindungi integritas WORM tanpa hak hapus.', exportBtn) +
        // WORM Security Banner
        '<div class="p-5 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 text-white rounded-2xl mb-6 shadow-md border border-emerald-800/60 flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">' +
          '<div class="flex items-center gap-3.5">' +
            '<div class="w-10 h-10 rounded-xl bg-gold text-emerald-dark flex items-center justify-center font-bold flex-shrink-0 shadow">' +
              '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>' +
            '</div>' +
            '<div>' +
              '<div class="font-extrabold text-sm sm:text-base text-gold-light flex items-center gap-2">' +
                '<span>Jurnal Audit Terkunci &amp; Permanen (WORM - Write Once, Read Many)</span>' +
                '<span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-800/80 text-emerald-200 border border-emerald-600">Anti-Hapus</span>' +
              '</div>' +
              '<p class="text-xs text-emerald-200/90 mt-0.5">Catatan ini dienkripsi pada database pusat dan tidak memiliki fungsi hapus demi akuntabilitas hukum organisasi APII.</p>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Filter Bar
        '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-4 mb-6 flex flex-col sm:flex-row gap-3">' +
          '<select id="auditModul" class="field sm:w-48 text-xs">' +
            '<option value="">Semua Modul</option>' +
            '<option value="AUTH">AUTH (Login/Logout)</option>' +
            '<option value="SURAT">SURAT (Persuratan)</option>' +
            '<option value="KEUANGAN">KEUANGAN (Buku Kas)</option>' +
            '<option value="DIVISI">DIVISI (Program Kerja)</option>' +
            '<option value="USER">USER (Pengguna)</option>' +
            '<option value="PENDAFTAR">PENDAFTAR (Calon Anggota)</option>' +
            '<option value="SETTINGS">SETTINGS (Pengaturan)</option>' +
          '</select>' +
          '<input id="auditActor" type="text" placeholder="Filter pelaku (username)…" class="field flex-1 text-xs" />' +
          '<input id="auditDate" type="date" class="field sm:w-48 text-xs" />' +
        '</div>' +

        '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">' +
          '<div class="overflow-x-auto"><table class="tbl tbl-responsive"><thead><tr>' +
          '<th>Waktu</th><th>Pelaku</th><th>Modul &amp; Aksi</th><th>Keterangan Aktivitas</th>' +
          '</tr></thead><tbody id="auditRows">' + this.loadingRow(4) + '</tbody></table></div>' +
        '</div>';

      var filterLogs = function () {
        self.loadAuditLogs();
      };
      document.getElementById('auditModul').addEventListener('change', filterLogs);
      document.getElementById('auditActor').addEventListener('input', filterLogs);
      document.getElementById('auditDate').addEventListener('change', filterLogs);

      this.loadAuditLogs();
    },

    loadAuditLogs: function () {
      var tb = document.getElementById('auditRows');
      var self = this;
      if (!tb) return;

      var mFilter = document.getElementById('auditModul') ? document.getElementById('auditModul').value : '';
      var aFilter = document.getElementById('auditActor') ? document.getElementById('auditActor').value.trim().toLowerCase() : '';
      var dFilter = document.getElementById('auditDate') ? document.getElementById('auditDate').value : '';

      Auth.getCached('getAuditLogs', { limit: 200 }, function (data) {
        var logs = (data && data.logs) || [];

        // Pasang exporter CSV
        var expBtn = document.getElementById('btnExportAuditCsv');
        if (expBtn) {
          expBtn.onclick = function () {
            self.exportAuditCsv(logs);
          };
        }

        if (mFilter) {
          logs = logs.filter(function (l) { return (l.module || l.action || '').toUpperCase().indexOf(mFilter) !== -1; });
        }
        if (aFilter) {
          logs = logs.filter(function (l) { return (l.actor || '').toLowerCase().indexOf(aFilter) !== -1; });
        }
        if (dFilter) {
          logs = logs.filter(function (l) { return (l.timestamp || '').indexOf(dFilter) !== -1; });
        }

        tb.innerHTML = logs.length ? logs.map(function (l) {
          var cls = 'badge-DRAFT';
          if (/SUCCESS|PUBLISHED|SETUJU|APPROVED|VERIFY/.test(l.action)) cls = 'badge-PUBLISHED';
          else if (/REJECT|DITOLAK|FAILED|FORBIDDEN/.test(l.action)) cls = 'badge-REJECTED';
          else if (/LOGIN|LOGOUT|SUBMIT|AJUKAN|CREATE|UPDATE/.test(l.action)) cls = 'badge-PENDING_APPROVAL';

          var modBadge = l.module ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 mr-1.5">' + Auth.esc(l.module) + '</span>' : '';

          return '<tr>' +
            '<td class="whitespace-nowrap text-xs text-gray-500 font-mono"><span class="sm:hidden text-gray-400 font-sans font-medium">Waktu: </span>' + Auth.esc(l.timestamp) + '</td>' +
            '<td class="font-semibold font-mono text-xs text-emerald-dark"><span class="sm:hidden text-gray-400 font-sans font-medium">Pelaku: </span>' + Auth.esc(l.actor) + '</td>' +
            '<td><span class="sm:hidden text-gray-400 font-medium text-xs">Aksi: </span>' + modBadge + '<span class="badge ' + cls + '">' + Auth.esc(l.action) + '</span></td>' +
            '<td class="text-sm text-gray-700 leading-snug">' + Auth.esc(l.detail) + '</td>' +
          '</tr>';
        }).join('') : '<tr class="tbl-empty"><td colspan="4" class="text-center text-gray-400 py-10">Belum ada catatan audit yang sesuai filter.</td></tr>';
      });
    },

    exportAuditCsv: function (logs) {
      if (!logs || !logs.length) {
        this.toast('Tidak ada log untuk diekspor.', 'info');
        return;
      }
      var rows = [['Timestamp', 'Pelaku', 'Modul', 'Aksi', 'Keterangan', 'IP Client']];
      logs.forEach(function (l) {
        rows.push([
          l.timestamp || '',
          l.actor || '',
          l.module || '',
          l.action || '',
          (l.detail || '').replace(/"/g, '""'),
          l.ip_client || ''
        ]);
      });
      var csvContent = '\uFEFF' + rows.map(function (r) {
        return r.map(function (cell) { return '"' + cell + '"'; }).join(',');
      }).join('\r\n');

      var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'Audit_Logs_APII_' + new Date().toISOString().slice(0, 10) + '.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.toast('Jejak audit berhasil diekspor ke file CSV.', 'success');
    },

    // ---------------------------------------------------------------
    // PENGATURAN & MASTER DATA (SUPERADMIN & KETUA)
    // ---------------------------------------------------------------
    renderPengaturan: function () {
      var main = document.getElementById('mainContent');
      var self = this;
      var currentTab = this.state.pengaturan.tab || 'rekening';

      main.innerHTML = this.pageHead('Pengaturan &amp; Master Data',
        'Kelola master rekening kas, format penomoran & KOP surat resmi, pendaftaran anggota, aturan keuangan, RBAC, dan Google Drive.', '') +
        '<div class="flex items-center gap-2 p-1.5 bg-gray-100 rounded-2xl mb-6 flex-wrap max-w-4xl">' +
          '<button type="button" data-ptab="rekening" class="py-2 px-3.5 rounded-xl text-xs font-bold transition ' + (currentTab === 'rekening' ? 'bg-white text-emerald-dark shadow-sm' : 'text-gray-500 hover:text-gray-900') + '">💳 Master Rekening</button>' +
          '<button type="button" data-ptab="surat" class="py-2 px-3.5 rounded-xl text-xs font-bold transition ' + (currentTab === 'surat' ? 'bg-white text-emerald-dark shadow-sm' : 'text-gray-500 hover:text-gray-900') + '">📄 Format &amp; KOP Surat</button>' +
          '<button type="button" data-ptab="pendaftaran" class="py-2 px-3.5 rounded-xl text-xs font-bold transition ' + (currentTab === 'pendaftaran' ? 'bg-white text-emerald-dark shadow-sm' : 'text-gray-500 hover:text-gray-900') + '">📝 Pendaftaran</button>' +
          '<button type="button" data-ptab="keuangan" class="py-2 px-3.5 rounded-xl text-xs font-bold transition ' + (currentTab === 'keuangan' ? 'bg-white text-emerald-dark shadow-sm' : 'text-gray-500 hover:text-gray-900') + '">💰 Keuangan</button>' +
          '<button type="button" data-ptab="rbac" class="py-2 px-3.5 rounded-xl text-xs font-bold transition ' + (currentTab === 'rbac' ? 'bg-white text-emerald-dark shadow-sm' : 'text-gray-500 hover:text-gray-900') + '">🛡️ RBAC &amp; Publik</button>' +
          '<button type="button" data-ptab="drive" class="py-2 px-3.5 rounded-xl text-xs font-bold transition ' + (currentTab === 'drive' ? 'bg-white text-emerald-dark shadow-sm' : 'text-gray-500 hover:text-gray-900') + '">☁️ Google Drive</button>' +
        '</div>' +
        '<div id="pengaturanBox"></div>';

      Array.prototype.forEach.call(main.querySelectorAll('[data-ptab]'), function (btn) {
        btn.addEventListener('click', function () {
          self.state.pengaturan.tab = btn.getAttribute('data-ptab');
          self.renderPengaturan();
        });
      });

      if (currentTab === 'rekening') this.renderPengaturanRekening();
      else if (currentTab === 'surat') this.renderPengaturanSurat();
      else if (currentTab === 'pendaftaran') this.renderPengaturanPendaftaran();
      else if (currentTab === 'keuangan') this.renderPengaturanKeuangan();
      else if (currentTab === 'rbac') this.renderPengaturanRbac();
      else if (currentTab === 'drive') this.renderPengaturanDrive();
    },

    renderPengaturanRekening: function () {
      var box = document.getElementById('pengaturanBox');
      var self = this;
      box.innerHTML =
        '<div class="flex items-center justify-between mb-4 flex-wrap gap-2">' +
          '<div>' +
            '<h3 class="text-base font-extrabold text-emerald-dark">Master Rekening &amp; Kas Yayasan</h3>' +
            '<p class="text-xs text-gray-500">Rekening dengan tanda &ldquo;Tampil di Publik&rdquo; akan langsung muncul di portal publik (apii.sigitadi.id).</p>' +
          '</div>' +
          '<button type="button" id="btnAddAccount" class="btn btn-primary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm">' +
            '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>' +
            '<span>Tambah Rekening</span></button>' +
        '</div>' +
        '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">' +
          '<div class="overflow-x-auto"><table class="tbl tbl-responsive"><thead><tr>' +
          '<th>Nama Rekening</th><th>Jenis</th><th>Bank / Lembaga</th><th>Nomor Rekening</th><th>Atas Nama</th><th>Kategori</th><th>Publik</th><th>Status</th><th>Aksi</th>' +
          '</tr></thead><tbody id="accountRows">' + this.loadingRow(9) + '</tbody></table></div>' +
        '</div>';

      document.getElementById('btnAddAccount').addEventListener('click', function () {
        self.accountForm(null);
      });

      this.loadAccountsList();
    },

    loadAccountsList: function () {
      var tb = document.getElementById('accountRows');
      var self = this;
      if (!tb) return;

      var renderRows = function (data) {
        if (!document.getElementById('accountRows')) return;
        tb = document.getElementById('accountRows');
        var accounts = Array.isArray(data) ? data : ((data && (data.accounts || data.items || data.data)) || []);
        if (!Array.isArray(accounts)) accounts = [];

        tb.innerHTML = accounts.length ? accounts.map(function (a) {
          var nama = a.name || a.nama_rekening || '—';
          var bank = a.bank_name || a.bank_vendor || '—';
          var noRek = a.account_number || a.nomor_rekening || '—';
          var atasNama = a.holder_name || a.atas_nama || '—';
          var kategori = a.category || 'Operasional DPW';
          var jenis = a.jenis || ((noRek && noRek !== '-') ? 'BANK' : 'KAS');
          var isPub = (a.show_on_public === 'TRUE' || a.show_on_public === true || a.show_on_public === 'true' || a.show_on_public === 1);
          var isAktif = (a.is_active === 'TRUE' || a.is_active === true || a.is_active === 'true' || a.is_active === 1 || a.is_active === undefined);
          var accId = a.id || a.code;

          return '<tr data-id="' + accId + '">' +
            '<td class="font-bold text-gray-900">' + Auth.esc(nama) + '</td>' +
            '<td><span class="badge ' + (jenis === 'BANK' ? 'badge-PUBLISHED' : 'badge-PENDING_APPROVAL') + '">' + Auth.esc(jenis) + '</span></td>' +
            '<td class="text-gray-700 font-semibold">' + Auth.esc(bank) + '</td>' +
            '<td class="font-mono text-xs font-bold text-emerald-dark">' + Auth.esc(String(noRek)) + '</td>' +
            '<td class="text-xs text-gray-600">' + Auth.esc(atasNama) + '</td>' +
            '<td><span class="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-lg">' + Auth.esc(kategori) + '</span></td>' +
            '<td>' + (isPub ? '<span class="badge badge-PUBLISHED text-[11px]">🌐 Tampil di Publik</span>' : '<span class="badge text-gray-400 bg-gray-100 text-[11px]">🔒 Internal</span>') + '</td>' +
            '<td>' + (isAktif ? '<span class="badge badge-PUBLISHED">Aktif</span>' : '<span class="badge badge-REJECTED">Nonaktif</span>') + '</td>' +
            '<td class="tbl-actions"><div class="flex gap-1.5">' +
              self.aBtn('edit-acc', 'Ubah', 'Ubah rincian rekening') +
              self.aBtn('danger del-acc', 'Hapus', 'Hapus rekening') +
            '</div></td>' +
          '</tr>';
        }).join('') : '<tr class="tbl-empty"><td colspan="9" class="text-center text-gray-400 py-10">Belum ada rekening kas terdaftar. Silakan klik tombol "Tambah Rekening".</td></tr>';

        Array.prototype.forEach.call(tb.querySelectorAll('tr[data-id]'), function (tr) {
          var id = tr.getAttribute('data-id');
          var item = accounts.filter(function (x) { return String(x.id || x.code) === String(id); })[0];
          var editBtn = tr.querySelector('[data-act="edit-acc"]');
          var delBtn = tr.querySelector('[data-act="danger del-acc"]');
          if (editBtn) editBtn.onclick = function () { self.accountForm(item); };
          if (delBtn) delBtn.onclick = function () {
            self.confirm('Hapus Rekening', 'Hapus rekening "<b>' + Auth.esc(item.name || item.nama_rekening) + '</b>"? Tindakan ini tidak dapat dibatalkan.', function () {
              Auth.fetch('deleteAccount', { id: item.id || item.code }).then(function () {
                Auth.cache.invalidate(['accounts', 'keuangan', 'dashboard']);
                self.toast('Rekening berhasil dihapus.', 'success');
                self.loadAccountsList();
              }).catch(function () {});
            });
          };
        });
      };

      Auth.getCached('getAccounts', null, renderRows).then(function (res) {
        if (res) renderRows(res);
      }).catch(function (err) {
        if (tb) {
          tb.innerHTML = '<tr class="tbl-empty"><td colspan="9" class="text-center text-red-500 py-8 font-medium">Gagal memuat daftar rekening: ' + Auth.esc(err.message || 'Koneksi bermasalah') + '</td></tr>';
        }
      });
    },

    accountForm: function (item) {
      var self = this;
      var isEdit = !!item;
      var currJenis = (item && (item.jenis || ((item.account_number && item.account_number !== '-') ? 'BANK' : 'KAS'))) || 'BANK';
      var currKategori = (item && item.category) || 'Operasional DPW';
      var isPublicChecked = item ? (item.show_on_public === 'TRUE' || item.show_on_public === true) : true;
      var isActiveChecked = item ? (item.is_active === 'TRUE' || item.is_active === true) : true;

      this.openModal(
        '<div class="p-4 sm:p-6">' +
          '<div class="flex items-center justify-between gap-2 mb-5">' +
            '<h3 class="text-base sm:text-lg font-extrabold text-emerald-dark break-words">' + (isEdit ? 'Ubah Master Rekening Kas' : 'Tambah Rekening Kas Baru') + '</h3>' +
            '<button data-close class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">' +
              '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>' +
          '</div>' +
          '<form id="accFormEl" class="space-y-4">' +
            '<div><label class="lbl">Nama Akun Rekening <span class="text-red-500">*</span></label>' +
              '<input id="afNama" type="text" required class="field" placeholder="cth: Kas BSI Operasional Yayasan / Bank Mandiri Wakaf" value="' + Auth.esc(item ? (item.name || item.nama_rekening) : '') + '" /></div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
              '<div><label class="lbl">Jenis Akun <span class="text-red-500">*</span></label><select id="afJenis" class="field">' +
                '<option value="BANK"' + (currJenis === 'BANK' ? ' selected' : '') + '>Rekening Bank</option>' +
                '<option value="KAS"' + (currJenis === 'KAS' ? ' selected' : '') + '>Kas Tunai / Brankas</option>' +
              '</select></div>' +
              '<div><label class="lbl">Nama Bank / Lembaga <span class="text-red-500">*</span></label>' +
                '<input id="afVendor" type="text" required class="field" placeholder="cth: Bank Syariah Indonesia (BSI) / Bank Mandiri / Kas Tunai" value="' + Auth.esc(item ? (item.bank_name || item.bank_vendor) : '') + '" /></div>' +
            '</div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
              '<div><label class="lbl">Nomor Rekening <span class="text-red-500">*</span></label>' +
                '<input id="afNomor" type="text" required class="field font-mono font-bold" placeholder="cth: 7218390881 (atau - untuk kas tunai)" value="' + Auth.esc(item ? (item.account_number || item.nomor_rekening) : '') + '" /></div>' +
              '<div><label class="lbl">Atas Nama Pemilik Rekening <span class="text-red-500">*</span></label>' +
                '<input id="afAtasNama" type="text" required class="field" placeholder="cth: YAYASAN APII DPW JABODETABEK" value="' + Auth.esc(item ? (item.holder_name || item.atas_nama) : 'YAYASAN APII DPW JABODETABEK') + '" /></div>' +
            '</div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
              '<div><label class="lbl">Kategori Peruntukan</label>' +
                '<select id="afCategory" class="field">' +
                  '<option value="Operasional DPW"' + (currKategori === 'Operasional DPW' ? ' selected' : '') + '>Operasional DPW</option>' +
                  '<option value="Wakaf & Dakwah"' + (currKategori === 'Wakaf & Dakwah' ? ' selected' : '') + '>Wakaf & Dakwah</option>' +
                  '<option value="Zakat & Infaq"' + (currKategori === 'Zakat & Infaq' ? ' selected' : '') + '>Zakat & Infaq</option>' +
                  '<option value="Sosial Kemanusiaan"' + (currKategori === 'Sosial Kemanusiaan' ? ' selected' : '') + '>Sosial Kemanusiaan</option>' +
                  '<option value="Kas Kecil Sekretariat"' + (currKategori === 'Kas Kecil Sekretariat' ? ' selected' : '') + '>Kas Kecil Sekretariat</option>' +
                '</select></div>' +
              '<div><label class="lbl">Kode Akun Internal (Opsional)</label>' +
                '<input id="afCode" type="text" class="field font-mono text-xs uppercase" placeholder="cth: KAS_BSI (otomatis bila kosong)" value="' + Auth.esc(item ? item.code : '') + '" /></div>' +
            '</div>' +
            '<div class="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-2">' +
              '<label class="flex items-center gap-2.5 text-xs font-bold text-emerald-950 cursor-pointer">' +
                '<input id="afShowPublic" type="checkbox" class="h-4 w-4 accent-emerald rounded" ' + (isPublicChecked ? 'checked' : '') + ' />' +
                '<span>🌐 Tampilkan Rekening Ini di Portal Publik (apii.sigitadi.id)</span>' +
              '</label>' +
              '<p class="text-[11px] text-emerald-800 leading-relaxed pl-6.5">' +
                'Jika dicentang, nomor rekening akan langsung muncul di halaman publik yayasan untuk donasi, infaq, dan transaksi resmi.' +
              '</p>' +
            '</div>' +
            '<label class="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer pt-1">' +
              '<input id="afActive" type="checkbox" class="h-4 w-4 accent-emerald rounded" ' + (isActiveChecked ? 'checked' : '') + ' />' +
              '<span class="font-semibold">Rekening Aktif (dapat digunakan untuk transaksi buku kas)</span>' +
            '</label>' +
            '<div class="flex flex-col sm:flex-row gap-2.5 sm:gap-3 pt-3 border-t border-gray-100">' +
              '<button type="submit" class="btn btn-primary flex-1 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm shadow-sm">' + (isEdit ? 'Simpan Perubahan' : 'Tambah Rekening') + '</button>' +
              '<button type="button" data-close class="btn btn-ghost px-5 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm">Batal</button>' +
            '</div>' +
          '</form>' +
        '</div>');

      Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
        b.addEventListener('click', function () { self.closeModal(); });
      });

      document.getElementById('accFormEl').addEventListener('submit', function (e) {
        e.preventDefault();
        var nama = document.getElementById('afNama').value.trim();
        var jenis = document.getElementById('afJenis').value;
        var bank = document.getElementById('afVendor').value.trim() || nama;
        var nomor = document.getElementById('afNomor').value.trim() || '-';
        var atasNama = document.getElementById('afAtasNama').value.trim() || 'YAYASAN APII DPW JABODETABEK';
        var kategori = document.getElementById('afCategory').value;
        var kodeManual = document.getElementById('afCode').value.trim();
        var kode = kodeManual || ('ACC_' + (bank || nama).toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 15));
        var isPublic = document.getElementById('afShowPublic').checked;
        var isActive = document.getElementById('afActive').checked;

        var payload = {
          name: nama,
          nama_rekening: nama,
          code: kode,
          bank_name: bank,
          bank_vendor: bank,
          account_number: nomor,
          nomor_rekening: nomor,
          holder_name: atasNama,
          atas_nama: atasNama,
          category: kategori,
          jenis: jenis,
          show_on_public: isPublic,
          is_active: isActive
        };
        if (isEdit) payload.id = item.id;

        Auth.fetch('saveAccount', payload).then(function () {
          Auth.cache.invalidate(['accounts', 'keuangan', 'dashboard']);
          self.closeModal();
          self.toast(isEdit ? 'Rekening berhasil diperbarui.' : 'Rekening baru berhasil ditambahkan dan disinkronkan.', 'success');
          self.loadAccountsList();
        }).catch(function () {});
      });
    },

    renderPengaturanSurat: function () {
      var box = document.getElementById('pengaturanBox');
      var self = this;
      box.innerHTML = '<div class="card bg-white rounded-2xl p-8 border border-emerald-100 text-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-dark mx-auto mb-2"></div><p class="text-xs text-gray-500 font-semibold">Memuat konfigurator format &amp; KOP surat...</p></div>';

      Auth.getCached('getSettings', null).then(function (sData) {
        var s = (sData && (sData.settings || sData.data)) || sData || {};
        window._kopSettings = s;
        var kop = s.letter_kop || {};
        var kopMode = s.kop_mode || kop.mode || 'text';
        var kopImg = s.kop_image_base64 || kop.custom_kop_image || '';
        var footerImg = s.custom_footer_image || kop.custom_footer_image || '';
        var footerMode = s.footer_mode || kop.footer_mode || 'text';
        var footerText = s.footer_text || kop.footer_text || 'Yayasan Apologet Islam Indonesia (APII) • Dewan Pimpinan Wilayah Jabodetabek';
        var stempelImg = s.stempel_image || kop.stempel_image || '';
        var ttdKetuaImg = s.ttd_ketua_image || kop.ttd_ketua_image || '';
        var ttdSekretarisImg = s.ttd_sekretaris_image || kop.ttd_sekretaris_image || '';
        var stempelScale = Number(s.stempel_scale || kop.stempel_scale) || 95;
        var stempelOverlap = Number(s.stempel_overlap || kop.stempel_overlap) || 30;

        var numCfg = s.letter_numbering || {};
        var pattern = s.letter_pattern || numCfg.pattern || '{urut}/{kode}/{org}/{bulanRomawi}/{tahun}';
        var orgName = kop.org_name || 'DEWAN PIMPINAN WILAYAH APOLOGET ISLAM INDONESIA (APII) JABODETABEK';
        var address = kop.address || 'DKI Jakarta & Sekitarnya, Indonesia';
        var phone = kop.phone || '0812-8888-2026';
        var email = kop.email || 'sekretariat@apii.sigitadi.id';
        var website = kop.website || 'https://apii.sigitadi.id';

        box.innerHTML =
          '<div class="grid lg:grid-cols-12 gap-6 items-start">' +
            // KOLOM KIRI (7/12): Form Pengaturan & Berkas
            '<div class="lg:col-span-7 space-y-5">' +
              // KARTU 1: Mode KOP & Berkas Banner
              '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-5 space-y-4">' +
                '<div class="flex items-center justify-between">' +
                  '<h3 class="text-sm sm:text-base font-extrabold text-emerald-dark">1. Mode Format KOP &amp; Footer Naskah</h3>' +
                  '<span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">⚡ Live Reactive</span>' +
                '</div>' +
                '<div>' +
                  '<label class="lbl">Pilihan Format KOP Dokumen</label>' +
                  '<div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-1.5">' +
                    '<label class="flex items-center gap-2 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition">' +
                      '<input type="radio" name="kopMode" value="image" ' + (kopMode === 'image' ? 'checked' : '') + ' class="accent-emerald" />' +
                      '<span class="text-xs font-bold text-gray-800">🖼️ Banner Grafis</span>' +
                    '</label>' +
                    '<label class="flex items-center gap-2 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition">' +
                      '<input type="radio" name="kopMode" value="pdf_master" ' + (kopMode === 'pdf_master' ? 'checked' : '') + ' class="accent-emerald" />' +
                      '<span class="text-xs font-bold text-gray-800">📄 Master PDF</span>' +
                    '</label>' +
                    '<label class="flex items-center gap-2 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition">' +
                      '<input type="radio" name="kopMode" value="text" ' + (kopMode !== 'image' && kopMode !== 'pdf_master' ? 'checked' : '') + ' class="accent-emerald" />' +
                      '<span class="text-xs font-bold text-gray-800">📝 Teks Resmi</span>' +
                    '</label>' +
                  '</div>' +
                '</div>' +
                '<div class="grid sm:grid-cols-2 gap-4">' +
                  '<div>' +
                    '<label class="lbl">Unggah Header Banner KOP (PNG/JPG/PDF)</label>' +
                    '<input id="kopFileInput" type="file" accept="image/*,application/pdf" class="field text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-emerald-light file:text-emerald-dark" />' +
                    '<p class="text-[10px] text-gray-400 mt-1">Rekomendasi lebar 1200x260 px untuk dokumen A4 tajam.</p>' +
                  '</div>' +
                  '<div>' +
                    '<label class="lbl">Unggah Footer Banner (Opsional PNG/JPG)</label>' +
                    '<input id="footerFileInput" type="file" accept="image/*" class="field text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-emerald-light file:text-emerald-dark" />' +
                    '<p class="text-[10px] text-gray-400 mt-1">Banner catatan kaki bagian bawah halaman kertas A4.</p>' +
                  '</div>' +
                '</div>' +
              '</div>' +

              // KARTU 2: Stempel Basah & Tanda Tangan Digital
              '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-5 space-y-4">' +
                '<h3 class="text-sm sm:text-base font-extrabold text-emerald-dark">2. Stempel Basah &amp; Tanda Tangan Digital</h3>' +
                '<div class="grid sm:grid-cols-3 gap-3">' +
                  '<div>' +
                    '<label class="lbl">Stempel Resmi (PNG Transparan)</label>' +
                    '<input id="stempelFileInput" type="file" accept="image/png" class="field text-xs file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-emerald-light file:text-emerald-dark" />' +
                  '</div>' +
                  '<div>' +
                    '<label class="lbl">Tanda Tangan Ketua (PNG Transparan)</label>' +
                    '<input id="ttdKetuaFileInput" type="file" accept="image/png" class="field text-xs file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-emerald-light file:text-emerald-dark" />' +
                  '</div>' +
                  '<div>' +
                    '<label class="lbl">Tanda Tangan Sekretaris (PNG Transparan)</label>' +
                    '<input id="ttdSekretarisFileInput" type="file" accept="image/png" class="field text-xs file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-emerald-light file:text-emerald-dark" />' +
                  '</div>' +
                '</div>' +
                '<div class="grid sm:grid-cols-2 gap-4 p-3.5 bg-gray-50 rounded-xl border border-gray-200">' +
                  '<div>' +
                    '<div class="flex items-center justify-between mb-1">' +
                      '<label class="text-xs font-bold text-gray-700">Ukuran Diameter Stempel</label>' +
                      '<span id="lblStempelScale" class="text-xs font-mono font-bold text-emerald-dark">' + stempelScale + 'px</span>' +
                    '</div>' +
                    '<input id="sliderStempelScale" type="range" min="60" max="140" step="5" value="' + stempelScale + '" class="w-full accent-emerald" />' +
                  '</div>' +
                  '<div>' +
                    '<div class="flex items-center justify-between mb-1">' +
                      '<label class="text-xs font-bold text-gray-700">Posisi Overlap terhadap TTD Ketua</label>' +
                      '<span id="lblStempelOverlap" class="text-xs font-mono font-bold text-emerald-dark">' + stempelOverlap + '%</span>' +
                    '</div>' +
                    '<input id="sliderStempelOverlap" type="range" min="0" max="60" step="5" value="' + stempelOverlap + '" class="w-full accent-emerald" />' +
                  '</div>' +
                '</div>' +
                '<p class="text-[11px] text-gray-500">Sesuai kaidah naskah dinas resmi DPW, stempel basah akan menimpa tanda tangan Ketua DPW di sisi kanan secara autentik.</p>' +
              '</div>' +

              // KARTU 3: Penomoran & Teks Lembaga
              '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-5 space-y-4">' +
                '<h3 class="text-sm sm:text-base font-extrabold text-emerald-dark">3. Pola Penomoran &amp; Teks Identitas Lembaga</h3>' +
                '<div>' +
                  '<label class="lbl">Format Pola Penomoran Surat Otomatis</label>' +
                  '<input id="patternInput" type="text" class="field font-mono text-xs font-bold" value="' + Auth.esc(pattern) + '" />' +
                  '<p class="text-[11px] text-gray-400 mt-1">Tag: <code class="bg-gray-100 px-1 rounded">{urut}</code>, <code class="bg-gray-100 px-1 rounded">{kode}</code>, <code class="bg-gray-100 px-1 rounded">{org}</code>, <code class="bg-gray-100 px-1 rounded">{bulanRomawi}</code>, <code class="bg-gray-100 px-1 rounded">{tahun}</code></p>' +
                '</div>' +
                '<div class="space-y-3 pt-2 border-t border-gray-100">' +
                  '<div><label class="lbl">Nama Lembaga (Baris Utama KOP)</label><input id="kopOrgName" type="text" class="field text-xs font-semibold" value="' + Auth.esc(orgName) + '" /></div>' +
                  '<div><label class="lbl">Alamat Sekretariat Lengkap</label><input id="kopAddress" type="text" class="field text-xs" value="' + Auth.esc(address) + '" /></div>' +
                  '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
                    '<div><label class="lbl">Kontak Telepon</label><input id="kopPhone" type="text" class="field text-xs" value="' + Auth.esc(phone) + '" /></div>' +
                    '<div><label class="lbl">Email Resmi</label><input id="kopEmail" type="email" class="field text-xs" value="' + Auth.esc(email) + '" /></div>' +
                  '</div>' +
                  '<div><label class="lbl">Teks Catatan Kaki (Footer)</label><input id="kopFooterText" type="text" class="field text-xs" value="' + Auth.esc(footerText) + '" /></div>' +
                '</div>' +
              '</div>' +

              // Kancing Aksi
              '<div class="flex flex-col sm:flex-row gap-3 pt-2">' +
                '<button type="button" id="btnSaveSuratSetting" class="btn btn-primary flex-1 py-3 rounded-xl font-bold text-xs sm:text-sm shadow-sm inline-flex items-center justify-center gap-2">' +
                  '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>' +
                  '<span>Simpan Format &amp; KOP Surat</span></button>' +
                '<button type="button" id="btnPrintSampleA4" class="btn btn-ghost px-5 py-3 rounded-xl font-bold text-xs sm:text-sm border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 inline-flex items-center justify-center gap-2 shadow-sm">' +
                  '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>' +
                  '<span>🖨️ Cetak / Pratinjau Sample A4</span></button>' +
              '</div>' +
            '</div>' +

            // KOLOM KANAN (5/12): Live Reactive A4 Paper Replica Preview
            '<div class="lg:col-span-5 sticky top-20">' +
              '<div class="card bg-gray-100/90 rounded-2xl border border-gray-300 p-4 shadow-sm flex flex-col items-center">' +
                '<div class="w-full flex items-center justify-between mb-2.5 px-1">' +
                  '<span class="text-[11px] font-extrabold text-gray-600 uppercase tracking-wider">Pratinjau Kertas A4 (Live 0 ms)</span>' +
                  '<span class="text-[10px] bg-white border border-gray-300 text-gray-500 font-mono px-2 py-0.5 rounded-md">Rasio A4 Standar</span>' +
                '</div>' +

                // Virtual A4 Paper
                '<div id="livePaperPreview" class="w-full bg-white rounded-lg shadow-md border border-gray-300 p-5 text-[10px] text-gray-800 leading-relaxed font-sans min-h-[520px] flex flex-col justify-between transition-all select-none">' +
                  // KOP Header Container
                  '<div id="previewKopBox" class="text-center pb-2 border-b-2 border-emerald-900 mb-3">' +
                    // Dirender secara live oleh renderLivePreview()
                  '</div>' +

                  // Badan Naskah Sample
                  '<div class="space-y-2 flex-1 my-2">' +
                    '<div class="text-center font-bold text-emerald-950 uppercase tracking-wide">SURAT KEPUTUSAN DEWAN PIMPINAN WILAYAH</div>' +
                    '<div id="previewSampleNumber" class="text-center font-mono text-[9px] text-gray-600">Nomor: 001/SK-DPW-APII/X/2026</div>' +
                    '<div class="text-center text-[9px] font-semibold text-gray-700 italic">TENTANG PENGESAHAN STRUKTUR ORGANISASI</div>' +
                    '<div class="pt-2 text-[9px] text-justify text-gray-700 leading-snug space-y-1">' +
                      '<p><strong>Menimbang:</strong> Bahwa demi kelancaran dakwah dan penataan kelembagaan, dipandang perlu menerbitkan surat keputusan ini.</p>' +
                      '<p><strong>Mengingat:</strong> Anggaran Dasar dan Anggaran Rumah Tangga Yayasan APII DPW Jabodetabek.</p>' +
                      '<p><strong>Memutuskan:</strong> Menetapkan susunan pengurus dan program kerja tahun berjalan.</p>' +
                    '</div>' +
                  '</div>' +

                  // Tanda Tangan & Stempel Live Replica
                  '<div class="pt-3 border-t border-gray-200 mt-2">' +
                    '<div class="grid grid-cols-2 text-center text-[9px] gap-2 items-end">' +
                      // Kolom Kiri: Sekretaris
                      '<div class="space-y-1">' +
                        '<div class="text-gray-600">Sekretaris DPW,</div>' +
                        '<div id="previewTtdSekBox" class="h-12 flex items-center justify-center">' +
                          (ttdSekretarisImg ? '<img src="' + ttdSekretarisImg + '" class="max-h-12 max-w-full object-contain" />' : '<span class="text-gray-300 italic text-[8px]">[Tanda Tangan]</span>') +
                        '</div>' +
                        '<div class="font-bold underline text-gray-900">( Ust. Ahmad Fauzi, S.Pd.I )</div>' +
                      '</div>' +

                      // Kolom Kanan: Ketua + Stempel Overlap
                      '<div class="space-y-1 relative">' +
                        '<div class="text-gray-600">Ketua DPW,</div>' +
                        '<div class="h-12 flex items-center justify-center relative">' +
                          '<div id="previewTtdKetBox" class="z-0">' +
                            (ttdKetuaImg ? '<img src="' + ttdKetuaImg + '" class="max-h-12 max-w-full object-contain" />' : '<span class="text-gray-300 italic text-[8px]">[Tanda Tangan]</span>') +
                          '</div>' +
                          '<div id="previewStempelBox" class="absolute z-10 pointer-events-none transition-all">' +
                            (stempelImg ? '<img src="' + stempelImg + '" style="width:' + (stempelScale * 0.45) + 'px; height:' + (stempelScale * 0.45) + 'px;" class="object-contain opacity-85" />' : '') +
                          '</div>' +
                        '</div>' +
                        '<div class="font-bold underline text-gray-900">( Ust. Sigit Adi Santoso, M.Pd )</div>' +
                      '</div>' +
                    '</div>' +
                  '</div>' +

                  // Footer Dokumen Live Replica
                  '<div id="previewFooterBox" class="pt-2 mt-3 border-t border-gray-200 flex items-center justify-between text-[8px] text-gray-500">' +
                    '<span id="previewFooterText" class="truncate">' + Auth.esc(footerText) + '</span>' +
                    '<span class="font-mono bg-gray-100 px-1 py-0.5 rounded text-[7px] text-emerald-800 font-bold">QR VERIFIED</span>' +
                  '</div>' +
                '</div>' +

                '<p class="text-[11px] text-gray-500 mt-3 text-center leading-tight">Pratinjau ini merespons langsung setiap ketikan teks, pergeseran slider stempel, dan unggahan berkas.</p>' +
              '</div>' +
            '</div>' +
          '</div>';

        // Fungsi Updater Pratinjau Interaktif Realtime
        var updateLivePreview = function () {
          var currMode = document.querySelector('input[name="kopMode"]:checked') ? document.querySelector('input[name="kopMode"]:checked').value : 'text';
          var currOrg = (document.getElementById('kopOrgName').value || orgName).trim();
          var currAddr = (document.getElementById('kopAddress').value || address).trim();
          var currPhone = (document.getElementById('kopPhone').value || phone).trim();
          var currEmail = (document.getElementById('kopEmail').value || email).trim();
          var currFooter = (document.getElementById('kopFooterText').value || footerText).trim();
          var currScale = Number(document.getElementById('sliderStempelScale').value) || 95;
          var currOverlap = Number(document.getElementById('sliderStempelOverlap').value) || 30;

          document.getElementById('lblStempelScale').textContent = currScale + 'px';
          document.getElementById('lblStempelOverlap').textContent = currOverlap + '%';

          var pKop = document.getElementById('previewKopBox');
          if (currMode === 'image' && kopImg) {
            pKop.innerHTML = '<img src="' + kopImg + '" class="w-full max-h-24 object-contain mx-auto" alt="KOP Banner" />';
          } else if (currMode === 'pdf_master') {
            pKop.innerHTML = '<div class="py-2 bg-emerald-50 text-emerald-800 rounded font-bold text-[9px] border border-dashed border-emerald-300">📄 Format Template Dokumen PDF Penuh Aktif</div>';
          } else {
            pKop.innerHTML = '<div class="font-extrabold text-[11px] text-emerald-950 uppercase tracking-tight">' + Auth.esc(currOrg) + '</div>' +
              '<div class="text-[9px] text-gray-600 mt-0.5">' + Auth.esc(currAddr) + '</div>' +
              '<div class="text-[8px] text-emerald-800 font-medium">' + Auth.esc(currPhone) + ' • ' + Auth.esc(currEmail) + '</div>';
          }

          var pFooterText = document.getElementById('previewFooterText');
          if (pFooterText) pFooterText.textContent = currFooter;

          var stempelBox = document.getElementById('previewStempelBox');
          if (stempelBox) {
            var scaledPx = Math.round(currScale * 0.45);
            var overlapOffset = Math.round((currOverlap / 100) * scaledPx * 0.6);
            stempelBox.style.left = 'calc(50% - ' + (scaledPx / 2 + overlapOffset) + 'px)';
            stempelBox.style.top = 'calc(50% - ' + (scaledPx / 2) + 'px)';
            if (stempelImg) {
              stempelBox.innerHTML = '<img src="' + stempelImg + '" style="width:' + scaledPx + 'px; height:' + scaledPx + 'px;" class="object-contain opacity-85" />';
            } else {
              stempelBox.innerHTML = '';
            }
          }

          var ttdKetBox = document.getElementById('previewTtdKetBox');
          if (ttdKetBox) {
            ttdKetBox.innerHTML = ttdKetuaImg ? '<img src="' + ttdKetuaImg + '" class="max-h-12 max-w-full object-contain" />' : '<span class="text-gray-300 italic text-[8px]">[Tanda Tangan]</span>';
          }

          var ttdSekBox = document.getElementById('previewTtdSekBox');
          if (ttdSekBox) {
            ttdSekBox.innerHTML = ttdSekretarisImg ? '<img src="' + ttdSekretarisImg + '" class="max-h-12 max-w-full object-contain" />' : '<span class="text-gray-300 italic text-[8px]">[Tanda Tangan]</span>';
          }
        };

        // Pasang event listener realtime pada seluruh input teks dan radio
        ['kopOrgName', 'kopAddress', 'kopPhone', 'kopEmail', 'kopFooterText'].forEach(function (id) {
          var el = document.getElementById(id);
          if (el) el.addEventListener('input', updateLivePreview);
        });
        ['sliderStempelScale', 'sliderStempelOverlap'].forEach(function (id) {
          var el = document.getElementById(id);
          if (el) el.addEventListener('input', updateLivePreview);
        });
        Array.prototype.forEach.call(document.querySelectorAll('input[name="kopMode"]'), function (r) {
          r.addEventListener('change', updateLivePreview);
        });

        // Helper FileReader
        var setupFileWatcher = function (inputId, callback) {
          var el = document.getElementById(inputId);
          if (!el) return;
          el.addEventListener('change', function (e) {
            var file = e.target.files && e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function (evt) {
              callback(evt.target.result);
              updateLivePreview();
            };
            reader.readAsDataURL(file);
          });
        };

        setupFileWatcher('kopFileInput', function (b64) {
          kopImg = b64;
          var rImg = document.querySelector('input[name="kopMode"][value="image"]');
          if (rImg) rImg.checked = true;
        });
        setupFileWatcher('footerFileInput', function (b64) {
          footerImg = b64;
          footerMode = 'image';
        });
        setupFileWatcher('stempelFileInput', function (b64) { stempelImg = b64; });
        setupFileWatcher('ttdKetuaFileInput', function (b64) { ttdKetuaImg = b64; });
        setupFileWatcher('ttdSekretarisFileInput', function (b64) { ttdSekretarisImg = b64; });

        updateLivePreview();

        // Handler Simpan
        document.getElementById('btnSaveSuratSetting').addEventListener('click', function () {
          var mode = document.querySelector('input[name="kopMode"]:checked').value;
          var newPat = document.getElementById('patternInput').value.trim() || '{urut}/{kode}/{org}/{bulanRomawi}/{tahun}';
          var orgNameVal = document.getElementById('kopOrgName').value.trim() || orgName;
          var addressVal = document.getElementById('kopAddress').value.trim() || address;
          var phoneVal = document.getElementById('kopPhone').value.trim() || phone;
          var emailVal = document.getElementById('kopEmail').value.trim() || email;
          var footerTextVal = document.getElementById('kopFooterText').value.trim() || footerText;
          var scaleVal = Number(document.getElementById('sliderStempelScale').value) || 95;
          var overlapVal = Number(document.getElementById('sliderStempelOverlap').value) || 30;

          var payload = {
            kop_mode: mode,
            kop_image_base64: kopImg,
            custom_footer_image: footerImg,
            footer_mode: footerMode,
            footer_text: footerTextVal,
            stempel_image: stempelImg,
            ttd_ketua_image: ttdKetuaImg,
            ttd_sekretaris_image: ttdSekretarisImg,
            stempel_scale: scaleVal,
            stempel_overlap: overlapVal,
            letter_pattern: newPat,
            letter_kop: {
              mode: mode,
              custom_kop_image: kopImg,
              custom_footer_image: footerImg,
              footer_mode: footerMode,
              footer_text: footerTextVal,
              stempel_image: stempelImg,
              ttd_ketua_image: ttdKetuaImg,
              ttd_sekretaris_image: ttdSekretarisImg,
              stempel_scale: scaleVal,
              stempel_overlap: overlapVal,
              org_name: orgNameVal,
              address: addressVal,
              phone: phoneVal,
              email: emailVal,
              website: website
            },
            letter_numbering: {
              pattern: newPat,
              org_code: 'DPW-APII',
              digits: 3,
              reset_cycle: 'yearly'
            }
          };

          Auth.fetch('saveSettings', payload).then(function () {
            Auth.cache.invalidate(['settings', 'surat', 'dashboard']);
            self.toast('Pengaturan format &amp; KOP surat resmi berhasil disimpan.', 'success');
          }).catch(function () {});
        });

        // Handler Modal Sample Cetak A4
        document.getElementById('btnPrintSampleA4').addEventListener('click', function () {
          var currMode = document.querySelector('input[name="kopMode"]:checked').value;
          var currOrg = document.getElementById('kopOrgName').value.trim() || orgName;
          var currAddr = document.getElementById('kopAddress').value.trim() || address;
          var currPhone = document.getElementById('kopPhone').value.trim() || phone;
          var currEmail = document.getElementById('kopEmail').value.trim() || email;
          var currFooter = document.getElementById('kopFooterText').value.trim() || footerText;
          var currScale = Number(document.getElementById('sliderStempelScale').value) || 95;
          var currOverlap = Number(document.getElementById('sliderStempelOverlap').value) || 30;

          self.openModal(
            '<div class="p-4 sm:p-6 max-w-4xl mx-auto">' +
              '<div class="flex items-center justify-between pb-3 mb-4 border-b border-gray-200">' +
                '<div class="flex items-center gap-2">' +
                  '<span class="text-xl">🖨️</span>' +
                  '<div><h3 class="text-base font-extrabold text-emerald-dark">Pratinjau Sample Dokumen Cetak A4</h3><p class="text-xs text-gray-500">Uji coba format cetak fisik printer atau simpan sebagai PDF.</p></div>' +
                '</div>' +
                '<button data-close class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">' +
                  '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>' +
              '</div>' +

              // Kertas A4 Ukuran Nyata
              '<div id="samplePrintA4Doc" class="bg-white p-8 sm:p-12 rounded-xl shadow-lg border border-gray-300 max-w-2xl mx-auto text-gray-900 leading-relaxed font-serif text-xs space-y-4">' +
                // KOP
                (currMode === 'image' && kopImg
                  ? '<img src="' + kopImg + '" class="w-full max-h-28 object-contain mb-4 mx-auto" />'
                  : '<div class="text-center pb-3 border-b-4 border-double border-emerald-900 mb-4">' +
                      '<div class="font-bold text-sm tracking-wide text-emerald-950 uppercase">' + Auth.esc(currOrg) + '</div>' +
                      '<div class="text-[11px] text-gray-700 mt-0.5">' + Auth.esc(currAddr) + '</div>' +
                      '<div class="text-[10px] text-emerald-800 font-sans font-semibold mt-0.5">' + Auth.esc(currPhone) + ' • ' + Auth.esc(currEmail) + '</div>' +
                    '</div>') +

                // Judul & Nomor
                '<div class="text-center font-bold text-sm text-emerald-950 uppercase tracking-wider pt-2">SURAT KEPUTUSAN DEWAN PIMPINAN WILAYAH</div>' +
                '<div class="text-center font-mono text-xs font-semibold text-gray-700">Nomor: 001/SK-DPW-APII/X/2026</div>' +
                '<div class="text-center font-bold text-xs pt-1 uppercase">TENTANG<br>PENGESAHAN PROGRAM KERJA &amp; KEPENGURUSAN TAHUNAN</div>' +

                // Isi Surat
                '<div class="pt-3 space-y-2 text-justify text-xs leading-normal">' +
                  '<p><strong>Menimbang:</strong> Bahwa untuk menjaga ketertiban administrasi dan optimalisasi syiar dakwah keumatan, Dewan Pimpinan Wilayah Yayasan APII Jabodetabek memandang perlu menerbitkan naskah ketetapan resmi.</p>' +
                  '<p><strong>Mengingat:</strong> 1. Anggaran Dasar &amp; Anggaran Rumah Tangga Yayasan APII.<br>2. Hasil Musyawarah Wilayah Pengurus DPW Jabodetabek Tahun 2026.</p>' +
                  '<p><strong>Memutuskan:</strong> Mengesahkan agenda aksi dan tata kelola persuratan terpadu sebagaimana terlampir dalam keputusan ini.</p>' +
                  '<p class="pt-2 text-right">Ditetapkan di: Jakarta<br>Pada tanggal: ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + '</p>' +
                '</div>' +

                // Tanda Tangan & Stempel
                '<div class="pt-6 grid grid-cols-2 text-center text-xs gap-4 items-end">' +
                  '<div class="space-y-1">' +
                    '<div>Sekretaris DPW,</div>' +
                    '<div class="h-16 flex items-center justify-center">' +
                      (ttdSekretarisImg ? '<img src="' + ttdSekretarisImg + '" class="max-h-16 object-contain" />' : '<span class="text-gray-300 italic text-xs">[Tanda Tangan Digital]</span>') +
                    '</div>' +
                    '<div class="font-bold underline text-gray-900">( Ust. Ahmad Fauzi, S.Pd.I )</div>' +
                  '</div>' +
                  '<div class="space-y-1 relative">' +
                    '<div>Ketua DPW,</div>' +
                    '<div class="h-16 flex items-center justify-center relative">' +
                      '<div class="z-0">' +
                        (ttdKetuaImg ? '<img src="' + ttdKetuaImg + '" class="max-h-16 object-contain" />' : '<span class="text-gray-300 italic text-xs">[Tanda Tangan Digital]</span>') +
                      '</div>' +
                      '<div class="absolute z-10 pointer-events-none" style="left:calc(50% - ' + (currScale / 2 + (currOverlap / 100) * currScale * 0.4) + 'px); top:calc(50% - ' + (currScale / 2) + 'px);">' +
                        (stempelImg ? '<img src="' + stempelImg + '" style="width:' + currScale + 'px; height:' + currScale + 'px;" class="object-contain opacity-85" />' : '') +
                      '</div>' +
                    '</div>' +
                    '<div class="font-bold underline text-gray-900">( Ust. Sigit Adi Santoso, M.Pd )</div>' +
                  '</div>' +
                '</div>' +

                // Footer
                '<div class="pt-6 border-t border-gray-300 flex items-center justify-between text-[10px] text-gray-500 font-sans mt-4">' +
                  '<span>' + Auth.esc(currFooter) + '</span>' +
                  '<span class="font-mono bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">VERIFIKASI SHA-256</span>' +
                '</div>' +
              '</div>' +

              '<div class="flex justify-end gap-3 pt-5">' +
                '<button type="button" data-close class="btn btn-ghost px-5 rounded-xl font-semibold text-xs">Tutup</button>' +
                '<button type="button" id="btnExecuteWindowPrint" class="btn btn-primary px-6 py-2.5 rounded-xl font-bold text-xs inline-flex items-center gap-2 shadow-sm">' +
                  '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>' +
                  '<span>Cetak Naskah Sekarang (PDF / Printer)</span></button>' +
              '</div>' +
            '</div>'
          );

          Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
            b.addEventListener('click', function () { self.closeModal(); });
          });

          var btnPrint = document.getElementById('btnExecuteWindowPrint');
          if (btnPrint) {
            btnPrint.addEventListener('click', function () {
              window.print();
            });
          }
        });
      }).catch(function (err) {
        box.innerHTML = '<div class="p-6 bg-red-50 text-red-700 rounded-2xl text-xs font-bold">Gagal memuat konfigurator surat: ' + Auth.esc(err.message) + '</div>';
      });
    },

    renderPengaturanPendaftaran: function () {
      var box = document.getElementById('pengaturanBox');
      var self = this;
      box.innerHTML = '<div class="card bg-white rounded-2xl p-8 border border-emerald-100 text-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-dark mx-auto mb-2"></div><p class="text-xs text-gray-500 font-semibold">Memuat pengaturan pendaftaran...</p></div>';

      Auth.getCached('getSettings', null).then(function (sData) {
        var s = (sData && (sData.settings || sData.data)) || sData || {};
        var reg = s.registration_config || {};
        var rawStatus = s.registration_status || reg.status || (s.registration_is_open === false ? 'DITUTUP' : 'BUKA');
        var regStatus = ['BUKA', 'DITUTUP', 'PENUH', 'SELEKSI'].indexOf(rawStatus) !== -1 ? rawStatus : 'BUKA';
        var quotaLimit = Number(s.registration_quota_limit !== undefined ? s.registration_quota_limit : (reg.quota_limit !== undefined ? reg.quota_limit : 0)) || 0;
        var notifyPendaftarEmail = s.registration_notify_pendaftar_email !== undefined ? s.registration_notify_pendaftar_email : (reg.notify_pendaftar_email !== false);

        var closedTitle = s.registration_closed_title || reg.closed_title || 'Pendaftaran Anggota Sementara Ditutup';
        var closedMsg = s.registration_closed_message || reg.closed_message || 'Pendaftaran gelombang saat ini telah ditutup atau sedang dalam proses verifikasi kuota. Pantau pengumuman resmi berkala dari sekretariat yayasan.';
        var instructions = s.registration_instructions || reg.instructions || 'Silakan isi formulir pendaftaran anggota Yayasan APII DPW Jabodetabek dengan data yang valid sesuai identitas KTP resmi.';
        var requireKtp = s.registration_require_ktp !== undefined ? s.registration_require_ktp : (reg.require_ktp !== false);
        var requireSelfie = s.registration_require_selfie !== undefined ? s.registration_require_selfie : (reg.require_selfie !== false);
        var maxFileSize = Number(s.registration_max_file_size_mb || reg.max_file_size_mb) || 3;
        var regPrefix = s.registration_reg_prefix || reg.reg_prefix || 'REG';
        var regDigits = Number(s.registration_reg_digits || reg.reg_digits) || 4;
        var contactWa = s.registration_contact_wa || reg.contact_wa || '081288882026';
        var notifyEmail = s.registration_notify_email || reg.notify_email || 'sekretariat@apii.sigitadi.id';
        var waTemplate = s.registration_wa_template || reg.wa_template || 'Halo Sekretariat APII DPW Jabodetabek, saya telah mendaftar anggota baru dengan No. Registrasi: {reg_number} a.n {full_name}. Mohon verifikasi berkas saya.';
        var agreementText = s.registration_agreement_text || reg.agreement_text || 'Saya menyatakan bahwa data yang saya berikan adalah benar dan sah. Saya bersedia menaati AD/ART, kode etik, dan peraturan Yayasan APII DPW Jabodetabek.';
        var openDivs = s.registration_open_divisions || reg.open_divisions || [
          'DIV_DAKWAH', 'DIV_HUKUM', 'DIV_HUMAS', 'DIV_MEDIA', 'DIV_SOSIAL', 'DIV_LITBANG', 'DIV_EKONOMI'
        ];

        var divisionsList = [
          { id: 'DIV_DAKWAH', name: 'Divisi Dakwah & Pembinaan', desc: 'Kajian, tabligh, dakwah apologetika & pembinaan mualaf' },
          { id: 'DIV_HUKUM', name: 'Divisi Advokasi & Hukum', desc: 'Bantuan hukum, advokasi keumatan & kepatuhan' },
          { id: 'DIV_HUMAS', name: 'Divisi Humas & Kemitraan', desc: 'Hubungan ormas, instansi pemerintah & lintas pihak' },
          { id: 'DIV_MEDIA', name: 'Divisi Media, IT & Publikasi', desc: 'Portal web, konten sosmed, podcast & sistem IT' },
          { id: 'DIV_SOSIAL', name: 'Divisi Sosial & Kemanusiaan', desc: 'Tanggap bencana, santunan dhuafa & aksi kemanusiaan' },
          { id: 'DIV_LITBANG', name: 'Divisi Litbang & Diklat', desc: 'Riset apologetika komparatif & kaderisasi' },
          { id: 'DIV_EKONOMI', name: 'Divisi Pemberdayaan Ekonomi & Logistik', desc: 'Koperasi, unit usaha & logistik inventaris' }
        ];

        box.innerHTML =
          '<div class="space-y-6">' +
            // KARTU 1: STATUS PEMBUKAAN & KUOTA PENDAFTARAN
            '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 space-y-5">' +
              '<div>' +
                '<h3 class="text-base font-extrabold text-emerald-dark">Status &amp; Kebijakan Pembukaan Pendaftaran</h3>' +
                '<p class="text-xs text-gray-500">Pilih status penerimaan calon anggota baru dan kuota pendaftar di portal publik (apii.sigitadi.id).</p>' +
              '</div>' +

              // 4 PILIHAN STATUS
              '<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">' +
                '<label class="flex flex-col p-3.5 rounded-xl border-2 cursor-pointer transition ' + (regStatus === 'BUKA' ? 'border-emerald-600 bg-emerald-50/50' : 'border-gray-200 hover:bg-gray-50') + '">' +
                  '<div class="flex items-center justify-between mb-1">' +
                    '<span class="text-xs font-black text-emerald-900">🟢 BUKA</span>' +
                    '<input type="radio" name="regStatusOption" value="BUKA" class="accent-emerald" ' + (regStatus === 'BUKA' ? 'checked' : '') + ' />' +
                  '</div>' +
                  '<span class="text-[11px] text-gray-500">Formulir aktif dibuka untuk pendaftaran publik.</span>' +
                '</label>' +
                '<label class="flex flex-col p-3.5 rounded-xl border-2 cursor-pointer transition ' + (regStatus === 'DITUTUP' ? 'border-amber-600 bg-amber-50/50' : 'border-gray-200 hover:bg-gray-50') + '">' +
                  '<div class="flex items-center justify-between mb-1">' +
                    '<span class="text-xs font-black text-amber-900">🔴 DITUTUP</span>' +
                    '<input type="radio" name="regStatusOption" value="DITUTUP" class="accent-emerald" ' + (regStatus === 'DITUTUP' ? 'checked' : '') + ' />' +
                  '</div>' +
                  '<span class="text-[11px] text-gray-500">Pendaftaran ditutup sementara waktu.</span>' +
                '</label>' +
                '<label class="flex flex-col p-3.5 rounded-xl border-2 cursor-pointer transition ' + (regStatus === 'PENUH' ? 'border-red-600 bg-red-50/50' : 'border-gray-200 hover:bg-gray-50') + '">' +
                  '<div class="flex items-center justify-between mb-1">' +
                    '<span class="text-xs font-black text-red-900">⛔ KUOTA PENUH</span>' +
                    '<input type="radio" name="regStatusOption" value="PENUH" class="accent-emerald" ' + (regStatus === 'PENUH' ? 'checked' : '') + ' />' +
                  '</div>' +
                  '<span class="text-[11px] text-gray-500">Target pendaftar telah terpenuhi.</span>' +
                '</label>' +
                '<label class="flex flex-col p-3.5 rounded-xl border-2 cursor-pointer transition ' + (regStatus === 'SELEKSI' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50') + '">' +
                  '<div class="flex items-center justify-between mb-1">' +
                    '<span class="text-xs font-black text-blue-900">🔍 TAHAP SELEKSI</span>' +
                    '<input type="radio" name="regStatusOption" value="SELEKSI" class="accent-emerald" ' + (regStatus === 'SELEKSI' ? 'checked' : '') + ' />' +
                  '</div>' +
                  '<span class="text-[11px] text-gray-500">Sedang dalam proses verifikasi berkas.</span>' +
                '</label>' +
              '</div>' +

              // PENGATURAN KUOTA
              '<div class="grid sm:grid-cols-2 gap-4 pt-2">' +
                '<div>' +
                  '<label class="lbl">Target Batas Kuota Pendaftar</label>' +
                  '<input id="regQuotaInput" type="number" min="0" class="field font-mono text-xs" placeholder="0 = Tanpa batas kuota" value="' + quotaLimit + '" />' +
                  '<p class="text-[11px] text-gray-400 mt-1">Isi 0 jika pendaftaran tidak dibatasi kuota maksimum.</p>' +
                '</div>' +
                '<div class="flex items-center pt-5">' +
                  '<label class="flex items-center gap-2.5 text-xs text-gray-800 cursor-pointer font-semibold">' +
                    '<input type="checkbox" id="regNotifyPendaftarEmail" class="h-4 w-4 accent-emerald rounded" ' + (notifyPendaftarEmail ? 'checked' : '') + ' />' +
                    '<span>Kirim tanda terima pendaftaran otomatis ke email calon anggota</span>' +
                  '</label>' +
                '</div>' +
              '</div>' +

              // KONDISI SAAT PENDAFTARAN BUKAN BUKA
              '<div id="closedSettingsGroup" class="' + (regStatus === 'BUKA' ? 'hidden' : '') + ' p-4 bg-amber-50/80 rounded-xl border border-amber-200/80 space-y-3">' +
                '<h4 class="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">' +
                  '<span>⚠️ Pengumuman Resmi Saat Pendaftaran Tidak Menerima Isian</span></h4>' +
                '<div>' +
                  '<label class="lbl text-amber-900">Judul Pengumuman Penutupan / Status</label>' +
                  '<input id="regClosedTitle" type="text" class="field text-xs bg-white" value="' + Auth.esc(closedTitle) + '" />' +
                '</div>' +
                '<div>' +
                  '<label class="lbl text-amber-900">Pesan / Alasan Status (Tampil di Layar Pengunjung)</label>' +
                  '<textarea id="regClosedMsg" rows="2" class="field text-xs bg-white">' + Auth.esc(closedMsg) + '</textarea>' +
                '</div>' +
              '</div>' +

              // INSTRUKSI PENDAFTARAN
              '<div>' +
                '<label class="lbl">Teks Petunjuk / Pengantar Pendaftaran</label>' +
                '<textarea id="regInstructions" rows="2" class="field text-xs">' + Auth.esc(instructions) + '</textarea>' +
                '<p class="text-[11px] text-gray-400 mt-1">Teks ini tampil di atas formulir pendaftaran anggota di portal publik.</p>' +
              '</div>' +
            '</div>' +

            // KARTU 2 & 3: BERKAS & PENOMORAN
            '<div class="grid lg:grid-cols-2 gap-6">' +
              '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 space-y-4">' +
                '<h3 class="text-base font-extrabold text-emerald-dark">Ketentuan Berkas Identitas</h3>' +
                '<div class="space-y-3">' +
                  '<label class="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">' +
                    '<input type="checkbox" id="regReqKtp" class="h-4 w-4 accent-emerald" ' + (requireKtp ? 'checked' : '') + ' />' +
                    '<div><strong class="text-xs text-gray-900 block">Wajib Unggah Foto KTP Asli</strong><span class="text-[11px] text-gray-500">Diperlukan untuk validasi NIK dan domisili calon anggota.</span></div>' +
                  '</label>' +
                  '<label class="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">' +
                    '<input type="checkbox" id="regReqSelfie" class="h-4 w-4 accent-emerald" ' + (requireSelfie ? 'checked' : '') + ' />' +
                    '<div><strong class="text-xs text-gray-900 block">Wajib Unggah Pas Foto / Selfie</strong><span class="text-[11px] text-gray-500">Diperlukan untuk penerbitan Kartu Tanda Anggota (KTA).</span></div>' +
                  '</label>' +
                '</div>' +
                '<div>' +
                  '<label class="lbl">Batas Maksimal Ukuran Unggahan Foto (MB)</label>' +
                  '<select id="regMaxFile" class="field text-xs">' +
                    '<option value="1"' + (maxFileSize === 1 ? ' selected' : '') + '>1 MB (Hemat penyimpanan Drive)</option>' +
                    '<option value="2"' + (maxFileSize === 2 ? ' selected' : '') + '>2 MB (Standar foto HP)</option>' +
                    '<option value="3"' + (maxFileSize === 3 ? ' selected' : '') + '>3 MB (Rekomendasi optimal)</option>' +
                    '<option value="5"' + (maxFileSize === 5 ? ' selected' : '') + '>5 MB (Kualitas tinggi)</option>' +
                  '</select>' +
                '</div>' +
              '</div>' +

              '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 space-y-4">' +
                '<h3 class="text-base font-extrabold text-emerald-dark">Format Penomoran &amp; Notifikasi</h3>' +
                '<div class="grid grid-cols-2 gap-3">' +
                  '<div>' +
                    '<label class="lbl">Prefix Kode Registrasi</label>' +
                    '<input id="regPrefixInput" type="text" class="field font-mono text-xs uppercase font-bold" value="' + Auth.esc(regPrefix) + '" />' +
                  '</div>' +
                  '<div>' +
                    '<label class="lbl">Jumlah Digit Urut</label>' +
                    '<select id="regDigitsInput" class="field text-xs font-mono">' +
                      '<option value="3"' + (regDigits === 3 ? ' selected' : '') + '>3 Digit (cth: 001)</option>' +
                      '<option value="4"' + (regDigits === 4 ? ' selected' : '') + '>4 Digit (cth: 0001)</option>' +
                      '<option value="5"' + (regDigits === 5 ? ' selected' : '') + '>5 Digit (cth: 00001)</option>' +
                    '</select>' +
                  '</div>' +
                '</div>' +
                '<div class="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs">' +
                  '<span class="text-gray-500">Contoh Hasil Nomor Registrasi:</span> ' +
                  '<span id="regPreviewBadge" class="font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg">' +
                    regPrefix + '-' + new Date().getFullYear() + '-' + ('0'.repeat(regDigits - 1) + '1') + '</span>' +
                '</div>' +
                '<div>' +
                  '<label class="lbl">Hotline WhatsApp Pendaftaran (Sekretariat)</label>' +
                  '<input id="regContactWa" type="text" class="field font-mono text-xs" placeholder="cth: 081288882026 atau 6281288882026" value="' + Auth.esc(contactWa) + '" />' +
                '</div>' +
                '<div>' +
                  '<label class="lbl">Email Notifikasi Pendaftar Baru Masuk (Sekretariat)</label>' +
                  '<input id="regNotifyEmail" type="email" class="field text-xs" placeholder="sekretariat@apii.sigitadi.id" value="' + Auth.esc(notifyEmail) + '" />' +
                '</div>' +
              '</div>' +
            '</div>' +

            // KARTU 4: PILIHAN DIVISI YANG MEMBUKA REKRUTMEN
            '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 space-y-4">' +
              '<div>' +
                '<h3 class="text-base font-extrabold text-emerald-dark">Divisi Kerja yang Membuka Rekrutmen</h3>' +
                '<p class="text-xs text-gray-500">Centang divisi yang saat ini menerima pendaftaran anggota. Divisi yang tidak dicentang tidak akan muncul pada pilihan minat di formulir publik.</p>' +
              '</div>' +
              '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2" id="divChecklistContainer">' +
                divisionsList.map(function (d) {
                  var isChecked = openDivs.indexOf(d.id) !== -1;
                  return '<label class="flex items-start gap-3 p-3.5 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition">' +
                    '<input type="checkbox" name="openDiv" value="' + d.id + '" class="h-4 w-4 mt-0.5 accent-emerald" ' + (isChecked ? 'checked' : '') + ' />' +
                    '<div class="min-w-0 flex-1">' +
                      '<strong class="text-xs font-bold text-gray-900 block">' + Auth.esc(d.name) + '</strong>' +
                      '<span class="text-[11px] text-gray-500 block leading-tight mt-0.5">' + Auth.esc(d.desc) + '</span>' +
                    '</div>' +
                  '</label>';
                }).join('') +
              '</div>' +
            '</div>' +

            // KARTU 5: PAKTA INTEGRITAS & TEMPLATE PESAN WA
            '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 space-y-4">' +
              '<h3 class="text-base font-extrabold text-emerald-dark">Pakta Integritas &amp; Konfirmasi Pesan WhatsApp</h3>' +
              '<div>' +
                '<label class="lbl">Teks Pernyataan Persetujuan AD/ART (Pakta Integritas)</label>' +
                '<textarea id="regAgreementText" rows="2" class="field text-xs">' + Auth.esc(agreementText) + '</textarea>' +
              '</div>' +
              '<div>' +
                '<label class="lbl">Template Pesan Konfirmasi WhatsApp Calon Anggota</label>' +
                '<textarea id="regWaTemplate" rows="2" class="field text-xs font-mono">' + Auth.esc(waTemplate) + '</textarea>' +
                '<p class="text-[11px] text-gray-400 mt-1">Tag dinamis: <code class="bg-gray-100 px-1 rounded">{reg_number}</code>, <code class="bg-gray-100 px-1 rounded">{full_name}</code></p>' +
              '</div>' +
              '<div class="pt-3 border-t border-gray-100">' +
                '<button type="button" id="btnSaveRegSettings" class="btn btn-primary px-6 py-3 rounded-xl font-bold text-xs sm:text-sm shadow-sm inline-flex items-center gap-2">' +
                  '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>' +
                  '<span>Simpan Pengaturan Pendaftaran</span></button>' +
              '</div>' +
            '</div>' +
          '</div>';

        // Interaksi Pilihan Status
        var grpClosed = document.getElementById('closedSettingsGroup');
        var statusRadios = document.querySelectorAll('input[name="regStatusOption"]');
        Array.prototype.forEach.call(statusRadios, function (r) {
          r.addEventListener('change', function () {
            if (r.value === 'BUKA') {
              if (grpClosed) grpClosed.classList.add('hidden');
            } else {
              if (grpClosed) grpClosed.classList.remove('hidden');
            }
          });
        });

        // Live preview nomor registrasi
        var prefixIn = document.getElementById('regPrefixInput');
        var digitsIn = document.getElementById('regDigitsInput');
        var badgePreview = document.getElementById('regPreviewBadge');
        var updateBadge = function () {
          var p = (prefixIn.value || 'REG').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'REG';
          var d = Number(digitsIn.value) || 4;
          if (badgePreview) badgePreview.textContent = p + '-' + new Date().getFullYear() + '-' + ('0'.repeat(d - 1) + '1');
        };
        if (prefixIn) prefixIn.addEventListener('input', updateBadge);
        if (digitsIn) digitsIn.addEventListener('change', updateBadge);

        // Handler Simpan
        document.getElementById('btnSaveRegSettings').addEventListener('click', function () {
          var openDivSelected = [];
          Array.prototype.forEach.call(document.querySelectorAll('input[name="openDiv"]:checked'), function (c) {
            openDivSelected.push(c.value);
          });

          var selectedStatus = 'BUKA';
          var checkedRadio = document.querySelector('input[name="regStatusOption"]:checked');
          if (checkedRadio) selectedStatus = checkedRadio.value;

          var pfix = (document.getElementById('regPrefixInput').value || 'REG').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'REG';
          var dgts = Number(document.getElementById('regDigitsInput').value) || 4;
          var qVal = Number(document.getElementById('regQuotaInput').value) || 0;
          var notifyPendaftar = document.getElementById('regNotifyPendaftarEmail').checked;

          var regConfigPayload = {
            status: selectedStatus,
            is_open: selectedStatus === 'BUKA',
            quota_limit: qVal,
            notify_pendaftar_email: notifyPendaftar,
            closed_title: document.getElementById('regClosedTitle').value.trim() || 'Pendaftaran Anggota Sementara Ditutup',
            closed_message: document.getElementById('regClosedMsg').value.trim(),
            instructions: document.getElementById('regInstructions').value.trim(),
            require_ktp: document.getElementById('regReqKtp').checked,
            require_selfie: document.getElementById('regReqSelfie').checked,
            max_file_size_mb: Number(document.getElementById('regMaxFile').value) || 3,
            reg_prefix: pfix,
            reg_digits: dgts,
            contact_wa: document.getElementById('regContactWa').value.trim(),
            notify_email: document.getElementById('regNotifyEmail').value.trim(),
            open_divisions: openDivSelected,
            agreement_text: document.getElementById('regAgreementText').value.trim(),
            wa_template: document.getElementById('regWaTemplate').value.trim()
          };

          var payload = {
            registration_config: regConfigPayload,
            registration_status: selectedStatus,
            registration_is_open: selectedStatus === 'BUKA',
            registration_quota_limit: qVal,
            registration_notify_pendaftar_email: notifyPendaftar,
            registration_closed_title: regConfigPayload.closed_title,
            registration_closed_message: regConfigPayload.closed_message,
            registration_instructions: regConfigPayload.instructions,
            registration_require_ktp: regConfigPayload.require_ktp,
            registration_require_selfie: regConfigPayload.require_selfie,
            registration_max_file_size_mb: regConfigPayload.max_file_size_mb,
            registration_reg_prefix: regConfigPayload.reg_prefix,
            registration_reg_digits: regConfigPayload.reg_digits,
            registration_contact_wa: regConfigPayload.contact_wa,
            registration_notify_email: regConfigPayload.notify_email,
            registration_open_divisions: regConfigPayload.open_divisions,
            registration_agreement_text: regConfigPayload.agreement_text,
            registration_wa_template: regConfigPayload.wa_template
          };

          Auth.fetch('saveSettings', payload).then(function () {
            Auth.cache.invalidate(['settings', 'pendaftar', 'dashboard']);
            self.toast('Pengaturan pendaftaran anggota berhasil disimpan.', 'success');
          }).catch(function () {});
        });
      }).catch(function (err) {
        box.innerHTML = '<div class="p-6 bg-red-50 text-red-700 rounded-2xl text-xs font-bold">Gagal memuat pengaturan pendaftaran: ' + Auth.esc(err.message) + '</div>';
      });
    },

    // ---------------------------------------------------------------
    // PENGATURAN KEUANGAN & OTORISASI DUAL CONTROL
    // ---------------------------------------------------------------
    renderPengaturanKeuangan: function () {
      var box = document.getElementById('pengaturanBox');
      var self = this;
      box.innerHTML = '<div class="card bg-white rounded-2xl p-8 border border-emerald-100 text-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-dark mx-auto mb-2"></div><p class="text-xs text-gray-500 font-semibold">Memuat pengaturan tata kelola keuangan...</p></div>';

      Auth.getCached('getSettings', null).then(function (sData) {
        var s = (sData && (sData.settings || sData.data)) || sData || {};
        var fCfg = s.finance_config || {};
        var vPat = fCfg.voucher_pattern || '{urut}/KEU-APII/JABO/{bulanRomawi}/{tahun}';
        var dualCtrl = fCfg.dual_control_enabled !== false;
        var threshold = Number(fCfg.approval_threshold || 0);

        var catsMasuk = Array.isArray(fCfg.categories_masuk) && fCfg.categories_masuk.length ? fCfg.categories_masuk.slice() : [
          'Infaq & Sedekah', 'Iuran Pengurus DPW', 'Donasi Wakaf', 'Hibah Khusus', 'Dana Sponsor Kegiatan'
        ];
        var catsKeluar = Array.isArray(fCfg.categories_keluar) && fCfg.categories_keluar.length ? fCfg.categories_keluar.slice() : [
          'Operasional Sekretariat', 'Honorarium & Ujrah', 'Transportasi & Perjalanan Dinas',
          'Konsumsi Kegiatan', 'Pembelian Inventaris & Aset', 'Santunan Sosial & Kemanusiaan',
          'Publikasi Media & Dokumentasi', 'Pemeliharaan Web & IT'
        ];

        var renderChipList = function (list, containerId, onRemove) {
          var el = document.getElementById(containerId);
          if (!el) return;
          el.innerHTML = list.map(function (c, idx) {
            return '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200">' +
              '<span>' + Auth.esc(c) + '</span>' +
              '<button type="button" data-del-idx="' + idx + '" class="text-emerald-600 hover:text-red-600 font-bold ml-1 text-sm leading-none">&times;</button>' +
            '</span>';
          }).join('') || '<span class="text-xs text-gray-400 italic">Belum ada kategori kustom.</span>';

          Array.prototype.forEach.call(el.querySelectorAll('[data-del-idx]'), function (btn) {
            btn.addEventListener('click', function () {
              var idx = Number(btn.getAttribute('data-del-idx'));
              list.splice(idx, 1);
              renderChipList(list, containerId, onRemove);
            });
          });
        };

        box.innerHTML =
          '<div class="space-y-6">' +
            // KARTU 1: FORMAT PENOMORAN VOUCHER KAS
            '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 space-y-4">' +
              '<div class="flex items-center justify-between flex-wrap gap-2">' +
                '<div>' +
                  '<h3 class="text-base font-extrabold text-emerald-dark">Format Penomoran Voucher Kas</h3>' +
                  '<p class="text-xs text-gray-500">Pola otomatis untuk penomoran voucher transaksi kas masuk dan keluar.</p>' +
                '</div>' +
                '<span class="text-xs font-bold text-emerald-800 bg-emerald-100/60 px-3 py-1 rounded-full border border-emerald-200">DPW JABODETABEK</span>' +
              '</div>' +
              '<div>' +
                '<label class="lbl">Pola Penomoran Voucher</label>' +
                '<input id="finVoucherPattern" type="text" class="field font-mono text-xs" value="' + Auth.esc(vPat) + '" />' +
                '<p class="text-[11px] text-gray-400 mt-1">Variabel tersedia: <code class="bg-gray-100 px-1 rounded">{urut}</code>, <code class="bg-gray-100 px-1 rounded">{bulanRomawi}</code>, <code class="bg-gray-100 px-1 rounded">{tahun}</code>, <code class="bg-gray-100 px-1 rounded">{bulan}</code></p>' +
              '</div>' +
              '<div class="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs flex items-center justify-between">' +
                '<span class="text-gray-500">Contoh Hasil Nomor Voucher:</span> ' +
                '<span id="finVoucherPreview" class="font-mono font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg"></span>' +
              '</div>' +
            '</div>' +

            // KARTU 2: KATEGORI KAS MASUK & KAS KELUAR
            '<div class="grid lg:grid-cols-2 gap-6">' +
              // KAS MASUK
              '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 space-y-4">' +
                '<div class="flex items-center justify-between">' +
                  '<h3 class="text-sm sm:text-base font-extrabold text-emerald-dark">Kategori Kas Masuk</h3>' +
                  '<span class="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">Penerimaan</span>' +
                '</div>' +
                '<div id="chipsMasukBox" class="flex flex-wrap gap-2 min-h-[60px] p-3 bg-gray-50/70 rounded-xl border border-gray-200"></div>' +
                '<div class="flex gap-2">' +
                  '<input id="inNewCatMasuk" type="text" placeholder="Tambah kategori kas masuk baru..." class="field text-xs flex-1" />' +
                  '<button type="button" id="btnAddCatMasuk" class="btn btn-secondary px-3 py-2 rounded-xl text-xs font-bold">+ Tambah</button>' +
                '</div>' +
              '</div>' +

              // KAS KELUAR
              '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 space-y-4">' +
                '<div class="flex items-center justify-between">' +
                  '<h3 class="text-sm sm:text-base font-extrabold text-emerald-dark">Kategori Kas Keluar</h3>' +
                  '<span class="text-xs font-bold text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full">Pengeluaran</span>' +
                '</div>' +
                '<div id="chipsKeluarBox" class="flex flex-wrap gap-2 min-h-[60px] p-3 bg-gray-50/70 rounded-xl border border-gray-200"></div>' +
                '<div class="flex gap-2">' +
                  '<input id="inNewCatKeluar" type="text" placeholder="Tambah kategori kas keluar baru..." class="field text-xs flex-1" />' +
                  '<button type="button" id="btnAddCatKeluar" class="btn btn-secondary px-3 py-2 rounded-xl text-xs font-bold">+ Tambah</button>' +
                '</div>' +
              '</div>' +
            '</div>' +

            // KARTU 3: ATURAN OTORISASI DUAL CONTROL
            '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 space-y-4">' +
              '<h3 class="text-base font-extrabold text-emerald-dark">Tata Kelola &amp; Otorisasi Dual-Control</h3>' +
              '<div class="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/80 space-y-3 text-xs text-emerald-950">' +
                '<div class="flex items-start gap-2.5">' +
                  '<span class="text-base">📥</span>' +
                  '<div>' +
                    '<strong class="block text-emerald-900 font-extrabold">Transaksi Kas Masuk (Penerimaan)</strong>' +
                    '<p class="text-emerald-800/90 leading-relaxed">Disahkan dan dibukukan langsung oleh <b>Bendahara DPW</b> berstatus <code>APPROVED</code> seketika bukti transfer/infaq diverifikasi.</p>' +
                  '</div>' +
                '</div>' +
                '<div class="flex items-start gap-2.5 pt-2 border-t border-emerald-200/60">' +
                  '<span class="text-base">📤</span>' +
                  '<div>' +
                    '<strong class="block text-emerald-900 font-extrabold">Transaksi Kas Keluar (Pengeluaran Dua Tahap)</strong>' +
                    '<p class="text-emerald-800/90 leading-relaxed">Draf diinput ➔ Diverifikasi oleh <b>Bendahara</b> (<code>VERIFIED_BY_BENDAHARA</code>) ➔ Disetujui final oleh <b>Ketua DPW</b> (<code>APPROVED</code>) sebelum dana dicairkan.</p>' +
                  '</div>' +
                '</div>' +
              '</div>' +
              '<div class="grid sm:grid-cols-2 gap-4 pt-2">' +
                '<label class="flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">' +
                  '<input type="checkbox" id="finDualControl" class="h-4 w-4 accent-emerald" ' + (dualCtrl ? 'checked' : '') + ' />' +
                  '<div><strong class="text-xs text-gray-900 block">Wajib Otorisasi Dual-Control Kas Keluar</strong><span class="text-[11px] text-gray-500">Mencegah pencairan dana sepihak tanpa verifikasi Ketua DPW.</span></div>' +
                '</label>' +
                '<div>' +
                  '<label class="lbl">Ambang Batas Wajib Otorisasi Ketua (Rp)</label>' +
                  '<input id="finThreshold" type="number" min="0" step="50000" class="field font-mono text-xs" value="' + threshold + '" />' +
                  '<p class="text-[11px] text-gray-400 mt-1">Isi 0 jika seluruh nominal pengeluaran wajib persetujuan Ketua.</p>' +
                '</div>' +
              '</div>' +
              '<div class="pt-3 border-t border-gray-100">' +
                '<button type="button" id="btnSaveFinanceSettings" class="btn btn-primary px-6 py-3 rounded-xl font-bold text-xs sm:text-sm shadow-sm inline-flex items-center gap-2">' +
                  '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>' +
                  '<span>Simpan Tata Kelola Keuangan</span></button>' +
              '</div>' +
            '</div>' +
          '</div>';

        // Update preview voucher
        var patternIn = document.getElementById('finVoucherPattern');
        var prevBadge = document.getElementById('finVoucherPreview');
        var updateVoucherPrev = function () {
          var pat = patternIn.value || '{urut}/KEU-APII/JABO/{bulanRomawi}/{tahun}';
          var rom = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
          var now = new Date();
          var res = pat
            .replace('{urut}', '001')
            .replace('{bulanRomawi}', rom[now.getMonth()])
            .replace('{bulan}', String(now.getMonth() + 1).padStart(2, '0'))
            .replace('{tahun}', String(now.getFullYear()));
          if (prevBadge) prevBadge.textContent = res;
        };
        if (patternIn) patternIn.addEventListener('input', updateVoucherPrev);
        updateVoucherPrev();

        // Render chips
        renderChipList(catsMasuk, 'chipsMasukBox');
        renderChipList(catsKeluar, 'chipsKeluarBox');

        // Add chip handlers
        document.getElementById('btnAddCatMasuk').addEventListener('click', function () {
          var val = (document.getElementById('inNewCatMasuk').value || '').trim();
          if (val && catsMasuk.indexOf(val) === -1) {
            catsMasuk.push(val);
            document.getElementById('inNewCatMasuk').value = '';
            renderChipList(catsMasuk, 'chipsMasukBox');
          }
        });
        document.getElementById('btnAddCatKeluar').addEventListener('click', function () {
          var val = (document.getElementById('inNewCatKeluar').value || '').trim();
          if (val && catsKeluar.indexOf(val) === -1) {
            catsKeluar.push(val);
            document.getElementById('inNewCatKeluar').value = '';
            renderChipList(catsKeluar, 'chipsKeluarBox');
          }
        });

        // Save Finance Settings
        document.getElementById('btnSaveFinanceSettings').addEventListener('click', function () {
          var newPat = (document.getElementById('finVoucherPattern').value || '').trim() || '{urut}/KEU-APII/JABO/{bulanRomawi}/{tahun}';
          var isDual = document.getElementById('finDualControl').checked;
          var thVal = Number(document.getElementById('finThreshold').value) || 0;

          var fConfigPayload = {
            voucher_pattern: newPat,
            categories_masuk: catsMasuk,
            categories_keluar: catsKeluar,
            dual_control_enabled: isDual,
            approval_threshold: thVal
          };

          var payload = {
            finance_config: fConfigPayload
          };

          Auth.fetch('saveSettings', payload).then(function () {
            Auth.cache.invalidate(['settings', 'keuangan', 'dashboard']);
            self.toast('Pengaturan tata kelola keuangan berhasil disimpan.', 'success');
          }).catch(function () {});
        });
      }).catch(function (err) {
        box.innerHTML = '<div class="p-6 bg-red-50 text-red-700 rounded-2xl text-xs font-bold">Gagal memuat pengaturan keuangan: ' + Auth.esc(err.message) + '</div>';
      });
    },

    renderPengaturanRbac: function () {
      var box = document.getElementById('pengaturanBox');
      var self = this;
      box.innerHTML = '<div class="card bg-white rounded-2xl p-8 border border-emerald-100 text-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-dark mx-auto mb-2"></div><p class="text-xs text-gray-500 font-semibold">Memuat pengaturan RBAC & visibilitas...</p></div>';

      Auth.getCached('getSettings', null).then(function (sData) {
        var s = (sData && (sData.settings || sData.data)) || sData || {};
        var pub = s.public_config || {};
        var allowReg = s.allow_public_registration !== undefined ? s.allow_public_registration : (pub.show_registration !== false);
        var allowVerif = s.allow_public_verification !== undefined ? s.allow_public_verification : (pub.show_verification !== false);
        var showKeu = s.show_keuangan_public !== undefined ? s.show_keuangan_public : (pub.show_finance !== false || pub.show_accounts !== false);
        var showProg = s.show_program_public !== undefined ? s.show_program_public : (pub.show_programs !== false);

        var bannerActive = s.announcement_banner_active !== undefined ? s.announcement_banner_active : (pub.announcement_banner_active !== false);
        var bannerText = s.announcement_banner_text || pub.announcement_banner || 'Selamat datang di Portal Resmi Yayasan APII DPW Jabodetabek. Mari bersinergi membangun peradaban dakwah yang kokoh.';
        var bannerType = s.announcement_banner_type || pub.announcement_banner_type || 'info';

        box.innerHTML =
          '<div class="space-y-6">' +
            // KARTU 1: BANNER PENGUMUMAN RESMI PORTAL PUBLIK
            '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 space-y-4">' +
              '<div class="flex items-center justify-between">' +
                '<h3 class="text-base font-extrabold text-emerald-dark">Banner Pengumuman Resmi Portal Publik</h3>' +
                '<span class="text-xs font-bold text-emerald-800 bg-emerald-100/60 px-3 py-1 rounded-full border border-emerald-200">apii.sigitadi.id</span>' +
              '</div>' +
              '<label class="flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">' +
                '<input type="checkbox" id="pubBannerActive" class="h-4 w-4 accent-emerald" ' + (bannerActive ? 'checked' : '') + ' />' +
                '<div><strong class="text-xs text-gray-900 block">Aktifkan Banner Pengumuman di Atas Portal Publik</strong><span class="text-[11px] text-gray-500">Menampilkan pita siaran informasi penting di bagian atas halaman muka.</span></div>' +
              '</label>' +
              '<div>' +
                '<label class="lbl">Teks Pengumuman Resmi</label>' +
                '<textarea id="pubBannerText" rows="2" class="field text-xs">' + Auth.esc(bannerText) + '</textarea>' +
              '</div>' +
              '<div>' +
                '<label class="lbl">Gaya Tampilan Banner</label>' +
                '<select id="pubBannerType" class="field text-xs">' +
                  '<option value="info"' + (bannerType === 'info' ? ' selected' : '') + '>🔵 Info Resmi (Biru Tenang)</option>' +
                  '<option value="warning"' + (bannerType === 'warning' ? ' selected' : '') + '>🟠 Perhatian / Penting (Kuning Emas)</option>' +
                  '<option value="success"' + (bannerType === 'success' ? ' selected' : '') + '>🟢 Sukacita / Pengumuman (Hijau APII)</option>' +
                '</select>' +
              '</div>' +
            '</div>' +

            // KARTU 2: Visibilitas Seksi Portal Publik
            '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 space-y-4">' +
              '<h3 class="text-base font-extrabold text-emerald-dark">Visibilitas Seksi Portal Publik</h3>' +
              '<div class="grid sm:grid-cols-2 gap-4 text-xs">' +
                '<label class="flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">' +
                  '<input type="checkbox" id="setPubReg" class="h-4 w-4 accent-emerald" ' + (allowReg ? 'checked' : '') + ' />' +
                  '<div><strong class="text-gray-900 block">Pendaftaran Anggota Terbuka</strong><span class="text-gray-500">Masyarakat dapat mendaftar mandiri dengan foto KTP & selfie.</span></div>' +
                '</label>' +
                '<label class="flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">' +
                  '<input type="checkbox" id="setPubVerif" class="h-4 w-4 accent-emerald" ' + (allowVerif ? 'checked' : '') + ' />' +
                  '<div><strong class="text-gray-900 block">Verifikasi Dokumen Publik</strong><span class="text-gray-500">Pencarian nomor surat & validasi sidik digital SHA-256.</span></div>' +
                '</label>' +
                '<label class="flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">' +
                  '<input type="checkbox" id="setPubKeu" class="h-4 w-4 accent-emerald" ' + (showKeu ? 'checked' : '') + ' />' +
                  '<div><strong class="text-gray-900 block">Transparansi Kas & Rekening Publik</strong><span class="text-gray-500">Tampilkan rekening donasi dan ringkasan kas yayasan di publik.</span></div>' +
                '</label>' +
                '<label class="flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">' +
                  '<input type="checkbox" id="setPubProg" class="h-4 w-4 accent-emerald" ' + (showProg ? 'checked' : '') + ' />' +
                  '<div><strong class="text-gray-900 block">Tampilkan Program Kerja Divisi</strong><span class="text-gray-500">Publik dapat melihat kiprah dan program divisi kerja.</span></div>' +
                '</label>' +
              '</div>' +
              '<div class="pt-2">' +
                '<button type="button" id="btnSaveRbacPublic" class="btn btn-primary px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm">Simpan Visibilitas &amp; Siaran Publik</button>' +
              '</div>' +
            '</div>' +

            // Matriks RBAC Readonly Reference
            '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-6">' +
              '<h3 class="text-base font-extrabold text-emerald-dark mb-3">Matriks Hak Akses (8 Peran Pengurus)</h3>' +
              '<div class="overflow-x-auto"><table class="tbl tbl-responsive text-xs"><thead><tr>' +
              '<th>Peran</th><th>Persuratan</th><th>Keuangan</th><th>Divisi Kerja</th><th>Pengguna</th><th>Audit Log</th><th>Pengaturan</th>' +
              '</tr></thead><tbody>' +
                '<tr><td class="font-bold text-emerald-950">SUPERADMIN</td><td>Full Akses</td><td>Full Akses</td><td>Full Akses</td><td>Full Akses</td><td>Baca Log</td><td>Full Akses</td></tr>' +
                '<tr><td class="font-bold text-emerald-950">KETUA DPW</td><td>Setujui/Tolak</td><td>Verifikasi Final</td><td>Setujui Program</td><td>Lihat Pengurus</td><td>Baca Log</td><td>Full Akses</td></tr>' +
                '<tr><td class="font-bold text-emerald-950">SEKRETARIS</td><td>Draf/Ajukan</td><td>—</td><td>Lihat Program</td><td>Verif Pendaftar</td><td>—</td><td>—</td></tr>' +
                '<tr><td class="font-bold text-emerald-950">BENDAHARA</td><td>—</td><td>Draf/Verifikasi</td><td>Lihat Program</td><td>Lihat Pengurus</td><td>—</td><td>Master Rekening</td></tr>' +
                '<tr><td class="font-bold text-emerald-950">PEMBINA</td><td>Lihat Surat</td><td>Lihat Kas</td><td>Lihat Program</td><td>—</td><td>Baca Log</td><td>—</td></tr>' +
                '<tr><td class="font-bold text-emerald-950">PENGAWAS</td><td>Lihat Surat</td><td>Lihat Kas</td><td>Lihat Program</td><td>—</td><td>Baca Log</td><td>—</td></tr>' +
                '<tr><td class="font-bold text-emerald-950">KETUA_DIVISI</td><td>—</td><td>—</td><td>Usul/LPJ Divisi</td><td>—</td><td>—</td><td>—</td></tr>' +
                '<tr><td class="font-bold text-emerald-950">ANGGOTA_DIVISI</td><td>—</td><td>—</td><td>Usul/LPJ Divisi</td><td>—</td><td>—</td><td>—</td></tr>' +
              '</tbody></table></div>' +
            '</div>' +
          '</div>';

        document.getElementById('btnSaveRbacPublic').addEventListener('click', function () {
          var regVal = document.getElementById('setPubReg').checked;
          var verifVal = document.getElementById('setPubVerif').checked;
          var keuVal = document.getElementById('setPubKeu').checked;
          var progVal = document.getElementById('setPubProg').checked;
          var bActive = document.getElementById('pubBannerActive').checked;
          var bText = document.getElementById('pubBannerText').value.trim();
          var bType = document.getElementById('pubBannerType').value;

          var payload = {
            allow_public_registration: regVal,
            allow_public_verification: verifVal,
            show_keuangan_public: keuVal,
            show_program_public: progVal,
            announcement_banner_active: bActive,
            announcement_banner_text: bText,
            announcement_banner_type: bType,
            public_config: {
              show_registration: regVal,
              show_verification: verifVal,
              show_finance: keuVal,
              show_accounts: keuVal,
              show_programs: progVal,
              announcement_banner: bText,
              announcement_banner_active: bActive,
              announcement_banner_type: bType
            }
          };

          Auth.fetch('saveSettings', payload).then(function () {
            Auth.cache.invalidate(['settings', 'dashboard']);
            self.toast('Pengaturan visibilitas & pengumuman publik berhasil disimpan.', 'success');
          }).catch(function () {});
        });
      }).catch(function (err) {
        box.innerHTML = '<div class="p-6 bg-red-50 text-red-700 rounded-2xl text-xs font-bold">Gagal memuat pengaturan RBAC: ' + Auth.esc(err.message) + '</div>';
      });
    },

    renderPengaturanDrive: function () {
      var box = document.getElementById('pengaturanBox');
      var self = this;
      box.innerHTML = '<div class="card bg-white rounded-2xl p-8 border border-emerald-100 text-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-dark mx-auto mb-2"></div><p class="text-xs text-gray-500 font-semibold">Memuat pengaturan Google Drive...</p></div>';

      Auth.getCached('getSettings', null).then(function (sData) {
        var s = (sData && (sData.settings || sData.data)) || sData || {};
        var drv = s.drive_storage || {};
        var folderId = s.google_drive_folder_id || drv.custom_folder_id || '';
        var folderName = drv.folder_name || 'APII Jabo - PDF Surat Resmi';
        var autoSub = s.auto_annual_subfolders !== undefined ? s.auto_annual_subfolders : true;

        box.innerHTML =
          '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 max-w-2xl space-y-5">' +
            '<div class="flex items-center gap-3">' +
              '<div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">' +
                '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z"/></svg>' +
              '</div>' +
              '<div>' +
                '<h3 class="text-base font-extrabold text-gray-900">Penyimpanan Dokumen Cloud (Google Drive)</h3>' +
                '<p class="text-xs text-gray-500">Simpan otomatis PDF surat, berkas LPJ, bukti nota kas, dan arsip pendaftaran.</p>' +
              '</div>' +
            '</div>' +
            '<div>' +
              '<label class="lbl">Google Drive Custom Folder ID (Opsional)</label>' +
              '<input id="driveFolderInput" type="text" class="field font-mono text-xs" placeholder="Kosongkan untuk menggunakan folder otomatis APII" value="' + Auth.esc(folderId) + '" />' +
              '<p class="text-[11px] text-gray-400 mt-1">Dapatkan ID folder dari URL Google Drive: <code class="bg-gray-100 px-1 rounded">drive.google.com/drive/folders/{ID}</code></p>' +
            '</div>' +
            '<div>' +
              '<label class="lbl">Nama Folder Default Organisasi</label>' +
              '<input id="driveFolderName" type="text" class="field text-xs bg-gray-50" readonly value="' + Auth.esc(folderName) + '" />' +
            '</div>' +
            '<div>' +
              '<label class="flex items-center gap-2.5 text-xs font-semibold text-gray-800 cursor-pointer">' +
                '<input id="driveAutoSub" type="checkbox" class="h-4 w-4 accent-emerald" ' + (autoSub ? 'checked' : '') + ' />' +
                'Buat subfolder arsip otomatis per tahun (contoh: /2026/Surat, /2026/Voucher)' +
              '</label>' +
            '</div>' +
            '<div class="flex gap-3 pt-2 flex-wrap sm:flex-nowrap">' +
              '<button type="button" id="btnTestDrive" class="btn btn-ghost px-5 py-2.5 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 border border-gray-200">' +
                '<span>⚡ Uji Koneksi Drive</span></button>' +
              '<button type="button" id="btnSaveDrive" class="btn btn-primary px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm flex-1">' +
                '<span>Simpan Pengaturan</span></button>' +
            '</div>' +
          '</div>';

        document.getElementById('btnTestDrive').addEventListener('click', function () {
          var btn = document.getElementById('btnTestDrive');
          btn.disabled = true;
          btn.textContent = 'Menguji...';
          Auth.fetch('testDriveStorage', { folder_id: document.getElementById('driveFolderInput').value.trim() }).then(function (res) {
            btn.disabled = false;
            btn.textContent = '⚡ Uji Koneksi Drive';
            self.toast((res && res.message) || 'Koneksi Google Drive terhubung & aktif!', 'success');
          }).catch(function () {
            btn.disabled = false;
            btn.textContent = '⚡ Uji Koneksi Drive';
          });
        });

        document.getElementById('btnSaveDrive').addEventListener('click', function () {
          var fId = document.getElementById('driveFolderInput').value.trim();
          var autoSubVal = document.getElementById('driveAutoSub').checked;
          var payload = {
            google_drive_folder_id: fId,
            auto_annual_subfolders: autoSubVal,
            drive_storage: {
              custom_folder_id: fId,
              folder_name: folderName,
              auto_annual_subfolders: autoSubVal
            }
          };
          Auth.fetch('saveSettings', payload).then(function () {
            Auth.cache.invalidate(['settings', 'dashboard']);
            self.toast('Pengaturan Google Drive berhasil disimpan.', 'success');
          }).catch(function () {});
        });
      }).catch(function (err) {
        box.innerHTML = '<div class="p-6 bg-red-50 text-red-700 rounded-2xl text-xs font-bold">Gagal memuat pengaturan Drive: ' + Auth.esc(err.message) + '</div>';
      });
    },

    // ---------------------------------------------------------------
    // PROFIL
    // ---------------------------------------------------------------
    renderProfil: function () {
      var main = document.getElementById('mainContent');
      var u = this.state.user;

      main.innerHTML = this.pageHead('Profil Saya', 'Informasi akun & peran Anda di sistem.', '') +
        '<div class="grid lg:grid-cols-3 gap-6">' +
          '<div class="card bg-gradient-to-br from-emerald-dark to-emerald rounded-2xl p-8 text-white text-center">' +
            '<div class="h-24 w-24 bg-white/15 rounded-3xl flex items-center justify-center mx-auto mb-5 text-4xl font-extrabold text-gold-light">' +
              Auth.initials() + '</div>' +
            '<h3 class="text-xl font-extrabold">' + Auth.esc(u.full_name || u.username) + '</h3>' +
            '<p class="text-emerald-light/80 text-sm mt-1 font-mono">@' + Auth.esc(u.username) + '</p>' +
            '<div class="mt-4 inline-block bg-gold text-emerald-dark text-xs font-bold px-4 py-1.5 rounded-full">' +
              Auth.esc(u.role_label || u.role) + '</div>' +
          '</div>' +
          '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-8 lg:col-span-2">' +
            '<h3 class="font-bold text-emerald-dark mb-4">Informasi Akun</h3>' +
            '<div class="space-y-1">' +
              this.profileRow('Username', u.username, true) +
              this.profileRow('Nama Lengkap', u.full_name || '—') +
              this.profileRow('Email', u.email || '—') +
              this.profileRow('Peran', u.role_label || u.role) +
              this.profileRow('Divisi', u.division_label || 'Tidak terikat divisi') +
              this.profileRow('Status', u.is_active === 'TRUE' ? 'Aktif' : 'Nonaktif') +
            '</div>' +
            '<div class="mt-6 pt-6 border-t border-gray-100 text-xs text-gray-400">' +
              'Perubahan data akun dilakukan oleh Administrator Sistem melalui menu Manajemen Pengguna. ' +
              'Sesi login berlaku 7 hari &amp; akan otomatis berakhir setelahnya.' +
            '</div>' +
          '</div>' +
        '</div>';
    },

    profileRow: function (label, value, mono) {
      return '<div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-gray-50">' +
        '<div class="text-xs font-bold text-gray-400 uppercase tracking-wide sm:w-40 flex-shrink-0">' + label + '</div>' +
        '<div class="text-sm text-gray-800 ' + (mono ? 'font-mono' : 'font-semibold') + '">' + Auth.esc(value) + '</div>' +
        '</div>';
    }
  };

  window.App = App;
  document.addEventListener('DOMContentLoaded', function () { App.init(); });
})();
