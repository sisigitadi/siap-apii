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
      pengguna: { q: '', page: 1 },
      audit: { page: 1 }
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
      this.state.user = user || Auth.user;
      var hp = document.getElementById('loginPage');
      var ap = document.getElementById('appPage');
      if (hp) hp.classList.add('hidden');
      if (ap) ap.classList.remove('hidden');

      // Topbar.
      this.renderTopbar();

      // Sidebar.
      this.renderNav();

      // Router pertama kali.
      window.addEventListener('hashchange', this.router);
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
      if (role !== 'ANGGOTA_BIASA') {
        items.push({ id: 'divisi', label: 'Divisi Kerja', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' });
      }
      // Daftar akun: read-only untuk pengurus inti; tulis hanya SUPERADMIN.
      if (has(['SUPERADMIN', 'KETUA', 'SEKRETARIS', 'BENDAHARA'])) {
        items.push({ id: 'pengguna', label: 'Manajemen Pengguna', icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-3.13a4 4 0 10-8 0 4 4 0 008 0zm6 0a4 4 0 10-8 0 4 4 0 008 0z' });
      }
      if (has(['SUPERADMIN', 'KETUA', 'PENGAWAS'])) {
        items.push({ id: 'audit', label: 'Jejak Audit', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' });
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
      pengguna: { t: 'Manajemen Pengguna', s: 'Kelola akun pengurus sistem', fn: 'renderPengguna' },
      audit: { t: 'Jejak Audit', s: 'Catatan keamanan setiap aksi penting', fn: 'renderAudit' },
      profil: { t: 'Profil Saya', s: 'Informasi akun Anda', fn: 'renderProfil' }
    },

    router: function () {
      var hash = (window.location.hash || '#/dashboard').replace('#', '').replace('/', '');
      var key = hash.split('&')[0];
      var page = this.PAGES[key];
      if (!page) { page = this.PAGES.dashboard; key = 'dashboard'; }
      this.state.page = key;

      // Hanya render bila menu tersedia untuk peran ini.
      var allowed = this.navForRole(this.state.user.role).some(function (n) { return n.id === key; });
      if (!allowed) { page = this.PAGES.dashboard; this.state.page = 'dashboard'; }

      document.getElementById('pageTitle').textContent = page.t;
      document.getElementById('pageSubtitle').textContent = page.s;

      // Tandai menu aktif.
      var nav = document.getElementById('navItems');
      Array.prototype.forEach.call(nav.children, function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-nav') === this.state.page);
      }.bind(this));

      this.closeSidebar();

      // Render konten.
      var main = document.getElementById('mainContent');
      main.innerHTML = '<div class="flex items-center justify-center py-20 text-gray-400">' +
        '<svg class="animate-spin h-8 w-8 text-emerald" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">' +
        '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
        '<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg></div>';
      this[page.fn]();
    },

    bindGlobal: function () {
      var self = this;

      // Klik menu navigasi.
      document.getElementById('navItems').addEventListener('click', function (e) {
        var b = e.target.closest('[data-nav]');
        if (!b) return;
        window.location.hash = '#/' + b.getAttribute('data-nav');
      });

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

    /** Toast singkat di pojok kanan atas. */
    toast: function (msg, type) {
      var box = document.getElementById('toastContainer');
      var colors = { success: 'bg-emerald text-white', error: 'bg-red-600 text-white', info: 'bg-gray-800 text-white' };
      var icons = {
        success: 'M5 13l4 4L19 7', error: 'M6 18L18 6M6 6l12 12', info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
      };
      var el = document.createElement('div');
      el.className = 'toast ' + (colors[type] || colors.info) +
        ' px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-3';
      el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="' + (icons[type] || icons.info) + '" /></svg><span>' + Auth.esc(msg) + '</span>';
      box.appendChild(el);
      setTimeout(function () {
        el.style.transition = 'opacity .3s, transform .3s';
        el.style.opacity = '0'; el.style.transform = 'translateX(24px)';
        setTimeout(function () { el.remove(); }, 320);
      }, 3600);
    },

    /** Buka modal dengan HTML bebas. */
    openModal: function (html) {
      document.getElementById('modalPanel').innerHTML = html;
      document.getElementById('modalRoot').classList.remove('hidden');
    },

    closeModal: function () {
      document.getElementById('modalRoot').classList.add('hidden');
      document.getElementById('modalPanel').innerHTML = '';
    },

    /** Baris skeleton saat tabel masih memuat. */
    loadingRow: function (cols) {
      return '<tr><td colspan="' + cols + '" class="text-center text-gray-400 py-10">Memuat data…</td></tr>';
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
        '<div id="dashCards" class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">' +
          '<div class="card bg-white rounded-2xl p-6 animate-pulse h-28"></div>'.repeat(4) +
        '</div>' +
        '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">' +
          '<div class="px-6 py-4 border-b border-emerald-100 flex items-center justify-between">' +
            '<h3 class="font-bold text-emerald-dark">Surat Terbaru</h3>' +
            '<button data-nav="surat" class="text-sm text-emerald font-semibold hover:underline">Lihat semua →</button>' +
          '</div>' +
          '<div class="overflow-x-auto"><table class="tbl"><thead><tr>' +
            '<th>Nomor</th><th>Judul</th><th>Status</th><th>Tanggal</th>' +
            '</tr></thead><tbody id="dashSurat">' + this.loadingRow(4) + '</tbody></table></div>' +
        '</div>';

      // Klik "Lihat semua".
      main.querySelector('[data-nav="surat"]').addEventListener('click', function () {
        window.location.hash = '#/surat';
      });

      Auth.get('getDashboard').then(function (data) {
        if (!data) return;
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
          return '<tr><td class="font-mono text-xs">' + Auth.esc(s.letter_number) + '</td>' +
            '<td class="font-semibold line-clamp-1 max-w-xs">' + Auth.esc(s.title) + '</td>' +
            '<td>' + self.badge(s.status, s.status_label) + '</td>' +
            '<td class="text-gray-500 whitespace-nowrap">' + Auth.esc(s.tanggal) + '</td></tr>';
        }).join('') : '<tr><td colspan="4" class="text-center text-gray-400 py-8">Belum ada surat.</td></tr>';
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
          '<div class="overflow-x-auto"><table class="tbl"><thead><tr>' +
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

      Auth.get('getListSurat', { q: st.q, status: st.status, limit: 50 }).then(function (data) {
        var items = (data && data.items) || [];
        tb.innerHTML = items.length ? items.map(function (s) {
          var acts = '';
          // Detail selalu tersedia.
          acts += self.aBtn('view', 'Detail', 'Lihat detail surat');
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
              '<div class="font-semibold line-clamp-1 max-w-xs">' + Auth.esc(s.title) + '</div></td>' +
            '<td class="whitespace-nowrap text-gray-600">' + Auth.esc(s.letter_type_label) + '</td>' +
            '<td>' + self.badge(s.status, s.status_label) + '</td>' +
            '<td class="whitespace-nowrap text-gray-600">' + Auth.esc(s.created_by_name || s.created_by) + '</td>' +
            '<td class="whitespace-nowrap text-gray-500 text-xs">' + Auth.esc(s.tanggal_label) + '</td>' +
            '<td><div class="flex gap-1.5 flex-wrap min-w-[120px]">' + acts + '</div></td>' +
          '</tr>';
        }).join('') : '<tr><td colspan="6" class="text-center text-gray-400 py-10">Tidak ada surat yang ditemukan.</td></tr>';

        // Binding aksi baris.
        Array.prototype.forEach.call(tb.querySelectorAll('tr[data-id]'), function (tr) {
          var id = tr.getAttribute('data-id');
          Array.prototype.forEach.call(tr.querySelectorAll('[data-act]'), function (b) {
            b.addEventListener('click', function () {
              var act = b.getAttribute('data-act');
              var item = items.filter(function (x) { return x.id === id; })[0];
              if (act === 'view') self.suratDetail(item);
              else if (act === 'edit') self.suratForm(item);
              else if (act === 'submit') self.suratSubmit(item, canWrite, canApprove);
              else if (act === 'approve') self.suratApprove(item, canWrite, canApprove);
              else if (act === 'reject') self.suratReject(item);
            });
          });
        });
      }).catch(function () {
        tb.innerHTML = '<tr><td colspan="6" class="text-center text-red-400 py-10">Gagal memuat data surat.</td></tr>';
      });
    },

    /** Modal buat/ubah draf surat. */
    suratForm: function (item) {
      var self = this;
      var isEdit = !!item;
      var types = window.LETTER_TYPES || {};
      var typeOpts = Object.keys(types).map(function (k) {
        return '<option value="' + k + '"' + (item && item.letter_type === k ? ' selected' : '') + '>' + types[k] + '</option>';
      }).join('');

      this.openModal(
        '<div class="p-6">' +
          '<div class="flex items-center justify-between mb-5">' +
            '<h3 class="text-lg font-extrabold text-emerald-dark">' + (isEdit ? 'Ubah Draf Surat' : 'Buat Surat Baru') + '</h3>' +
            '<button data-close class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">' +
              '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>' +
          '</div>' +
          '<form id="suratFormEl" class="space-y-4">' +
            '<div><label class="lbl">Jenis Surat</label><select id="sfType" class="field">' + typeOpts + '</select></div>' +
            '<div><label class="lbl">Judul Surat <span class="text-red-500">*</span></label>' +
              '<input id="sfTitle" type="text" required class="field" placeholder="cth: Undangan Rapat Pleno" value="' + Auth.esc(item ? item.title : '') + '" /></div>' +
            '<div class="grid sm:grid-cols-2 gap-4">' +
              '<div><label class="lbl">Tanggal Surat</label><input id="sfTanggal" type="date" class="field" value="' + (item ? item.tanggal_surat : new Date().toISOString().slice(0, 10)) + '" /></div>' +
              '<div><label class="lbl">Nomor Surat</label><input id="sfNomor" type="text" class="field font-mono text-xs" placeholder="(otomatis bila kosong)" value="' + Auth.esc(item ? item.letter_number : '') + '" /></div>' +
            '</div>' +
            '<div><label class="lbl">Menimbang</label><textarea id="sfMenimbang" rows="2" class="field" placeholder="Pertimbangan…"></textarea></div>' +
            '<div><label class="lbl">Mengingat</label><textarea id="sfMengingat" rows="2" class="field" placeholder="Dasar hukum / aturan…"></textarea></div>' +
            '<div><label class="lbl">Memutuskan</label><textarea id="sfMemutuskan" rows="3" class="field" placeholder="Isi pokok surat…"></textarea></div>' +
            '<p class="text-xs text-gray-400">' + (isEdit
              ? 'Kosongkan ketiga kotak isi untuk mempertahankan isi lama. Hanya Draf yang dapat diubah.'
              : 'Isi surat dapat dilengkapi nanti selama masih Draf.') + '</p>' +
            '<div class="flex gap-3 pt-2">' +
              '<button type="submit" class="btn btn-primary flex-1 py-3 rounded-xl font-bold">' + (isEdit ? 'Simpan Perubahan' : 'Simpan Draf') + '</button>' +
              '<button type="button" data-close class="btn btn-ghost px-5 rounded-xl font-semibold">Batal</button>' +
            '</div>' +
          '</form>' +
        '</div>');

      // Tutup modal.
      Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
        b.addEventListener('click', function () { self.closeModal(); });
      });

      document.getElementById('suratFormEl').addEventListener('submit', function (e) {
        e.preventDefault();
        var menimbang = document.getElementById('sfMenimbang').value.trim();
        var mengingat = document.getElementById('sfMengingat').value.trim();
        var memutuskan = document.getElementById('sfMemutuskan').value.trim();

        var payload = {
          letter_type: document.getElementById('sfType').value,
          title: document.getElementById('sfTitle').value.trim(),
          tanggal_surat: document.getElementById('sfTanggal').value,
          letter_number: document.getElementById('sfNomor').value.trim()
        };
        // Hanya kirim content bila ada isian (updateSurat menimpa seluruh content).
        if (menimbang || mengingat || memutuskan) {
          payload.content = { menimbang: menimbang, mengingat: mengingat, memutuskan: memutuskan };
        }
        if (isEdit) payload.id = item.id;

        Auth.fetch(isEdit ? 'updateSurat' : 'createSurat', payload).then(function () {
          self.closeModal();
          self.toast(isEdit ? 'Surat berhasil diperbarui.' : 'Draf surat berhasil dibuat.', 'success');
          self.refreshSurat();
        }).catch(function () { /* toast sudah ditampilkan */ });
      });
    },

    /** Muat ulang tabel surat sesuai peran. */
    refreshSurat: function () {
      var r = this.state.user.role;
      this.loadSurat(['SUPERADMIN', 'SEKRETARIS'].indexOf(r) !== -1,
        ['SUPERADMIN', 'KETUA'].indexOf(r) !== -1);
    },

    /** Modal detail surat. */
    suratDetail: function (s) {
      var self = this;
      var rows = [
        ['Nomor Surat', s.letter_number, 'mono'],
        ['Jenis', s.letter_type_label, ''],
        ['Judul', s.title, ''],
        ['Status', null, 'badge'],
        ['Tanggal Surat', s.tanggal_label, ''],
        ['Dibuat Oleh', s.created_by_name || s.created_by, ''],
        ['Disahkan Oleh', s.approved_by || '—', '']
      ];
      if (s.rejection_notes) rows.push(['Catatan Penolakan', s.rejection_notes, 'warn']);

      this.openModal(
        '<div class="p-6">' +
          '<div class="flex items-center justify-between mb-5">' +
            '<h3 class="text-lg font-extrabold text-emerald-dark">Detail Surat</h3>' +
            '<button data-close class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">' +
              '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>' +
          '</div>' +
          '<div class="space-y-1">' + rows.map(function (r) {
            var val = r[2] === 'badge' ? self.badge(s.status, s.status_label)
              : r[2] === 'mono' ? '<span class="font-mono text-xs break-all">' + Auth.esc(r[1]) + '</span>'
              : r[2] === 'warn' ? '<span class="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg block">' + Auth.esc(r[1]) + '</span>'
              : '<span class="text-sm text-gray-800">' + Auth.esc(r[1]) + '</span>';
            return '<div class="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-2 border-b border-gray-50">' +
              '<div class="text-xs font-bold text-gray-400 uppercase tracking-wide sm:w-40 flex-shrink-0">' + r[0] + '</div>' +
              '<div class="min-w-0">' + val + '</div></div>';
          }).join('') + '</div>' +
          (s.pdf_url ?
            '<a href="' + Auth.esc(s.pdf_url) + '" target="_blank" rel="noopener" class="btn btn-primary mt-5 w-full py-3 rounded-xl font-bold inline-flex items-center justify-center gap-2">' +
            '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>' +
            'Unduh PDF Resmi</a>' : '') +
          (s.qr_verify_url ?
            '<a href="' + Auth.esc(s.qr_verify_url) + '" target="_blank" rel="noopener" class="block text-center text-sm text-emerald mt-3 font-semibold hover:underline">Link verifikasi publik →</a>' : '') +
        '</div>');

      Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
        b.addEventListener('click', function () { self.closeModal(); });
      });
    },

    /** Modal konfirmasi generik. */
    confirm: function (title, html, onYes) {
      var self = this;
      this.openModal(
        '<div class="p-6">' +
          '<div class="flex gap-4 mb-5">' +
            '<div class="h-11 w-11 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">' +
            '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>' +
            '<div><h3 class="text-lg font-extrabold text-emerald-dark">' + title + '</h3>' +
            '<p class="text-sm text-gray-600 mt-1">' + html + '</p></div>' +
          '</div>' +
          '<div class="flex gap-3">' +
            '<button id="confirmYes" class="btn btn-primary flex-1 py-3 rounded-xl font-bold">Ya, Lanjutkan</button>' +
            '<button data-close class="btn btn-ghost px-5 rounded-xl font-semibold">Batal</button>' +
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
        '<div class="p-6">' +
          '<h3 class="text-lg font-extrabold text-red-600 mb-2">' + title + '</h3>' +
          '<p class="text-sm text-gray-600 mb-4">' + descHtml + '</p>' +
          '<form id="rejectFormEl">' +
            '<label class="lbl">Alasan Penolakan <span class="text-red-500">*</span></label>' +
            '<textarea id="rejectNotes" required rows="3" class="field" placeholder="Tulis alasan penolakan…"></textarea>' +
            '<div class="flex gap-3 pt-4">' +
              '<button type="submit" class="btn btn-danger flex-1 py-3 rounded-xl font-bold">Tolak</button>' +
              '<button type="button" data-close class="btn btn-ghost px-5 rounded-xl font-semibold">Batal</button>' +
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
          self.toast('Surat diajukan ke Ketua.', 'success');
          self.refreshSurat();
        }).catch(function () {});
      });
    },

    /** Setujui & terbitkan surat (Ketua/Superadmin). */
    suratApprove: function (item) {
      var self = this;
      this.confirm('Terbitkan Surat', 'Surat <b>' + Auth.esc(item.letter_number) + '</b> akan diterbitkan: status PUBLISHED, PDF dibuat, &amp; sidik digital dicatat. Lanjutkan?', function () {
        Auth.fetch('approveSurat', { id: item.id }).then(function () {
          self.toast('Surat berhasil diterbitkan & PDF tersedia.', 'success');
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
          '<div class="overflow-x-auto"><table class="tbl"><thead><tr>' +
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
      Auth.get('getSaldo').then(function (data) {
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
      }).catch(function () {});
    },

    loadKeuangan: function (canWrite, canApprove) {
      var st = this.state.keuangan;
      var tb = document.getElementById('keuRows');
      var self = this;

      Auth.get('getListKeuangan', { q: st.q, status: st.status, type: st.type, limit: 50 }).then(function (data) {
        var items = (data && data.items) || [];
        tb.innerHTML = items.length ? items.map(function (k) {
          var acts = '';
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

          return '<tr data-id="' + k.id + '">' +
            '<td><div class="font-mono text-xs">' + Auth.esc(k.voucher_number) + '</div>' +
              '<div class="text-xs text-gray-500 line-clamp-1 max-w-xs">' + Auth.esc(k.description) + '</div></td>' +
            '<td><span class="badge ' + (k.type === 'MASUK' ? 'badge-PUBLISHED' : 'badge-DRAFT') + '">' +
              (k.type === 'MASUK' ? 'Kas Masuk' : 'Kas Keluar') + '</span></td>' +
            '<td class="font-bold whitespace-nowrap ' + (k.type === 'MASUK' ? 'text-emerald' : 'text-red-600') + '">' +
              (k.type === 'MASUK' ? '+ ' : '− ') + Auth.esc(k.amount_label.replace('Rp ', '')) + '</td>' +
            '<td class="whitespace-nowrap text-gray-600">' + Auth.esc(k.account_label) + '</td>' +
            '<td>' + self.badge(k.status, k.status_label) + '</td>' +
            '<td><div class="flex gap-1.5 flex-wrap min-w-[110px]">' + acts + '</div></td>' +
          '</tr>';
        }).join('') : '<tr><td colspan="6" class="text-center text-gray-400 py-10">Tidak ada voucher yang ditemukan.</td></tr>';

        Array.prototype.forEach.call(tb.querySelectorAll('tr[data-id]'), function (tr) {
          var id = tr.getAttribute('data-id');
          Array.prototype.forEach.call(tr.querySelectorAll('[data-act]'), function (b) {
            b.addEventListener('click', function () {
              var act = b.getAttribute('data-act');
              var item = items.filter(function (x) { return x.id === id; })[0];
              if (act === 'verify-bend') self.voucherVerify(item, 'verifyVoucherBendahara',
                'Verifikasi Bendahara', 'diverifikasi Bendahara & menunggu verifikasi Ketua');
              else if (act === 'approve') self.voucherVerify(item, 'verifyVoucherKetum',
                'Verifikasi Final Ketua', 'disetujui penuh & masuk perhitungan saldo');
              else if (act === 'reject') self.voucherReject(item);
            });
          });
        });
      }).catch(function () {
        tb.innerHTML = '<tr><td colspan="6" class="text-center text-red-400 py-10">Gagal memuat data voucher.</td></tr>';
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
          self.toast('Voucher berhasil diproses.', 'success');
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

    /** Modal buat voucher baru (Bendahara/Superadmin). */
    voucherForm: function () {
      var self = this;
      var accOpts = Object.keys(window.ACCOUNTS || {}).map(function (k) {
        return '<option value="' + k + '">' + window.ACCOUNTS[k] + '</option>';
      }).join('');

      this.openModal(
        '<div class="p-6">' +
          '<div class="flex items-center justify-between mb-5">' +
            '<h3 class="text-lg font-extrabold text-emerald-dark">Buat Voucher Baru</h3>' +
            '<button data-close class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">' +
              '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>' +
          '</div>' +
          '<form id="voucherFormEl" class="space-y-4">' +
            '<div class="grid sm:grid-cols-2 gap-4">' +
              '<div><label class="lbl">Jenis Transaksi</label><select id="vfType" class="field">' +
                '<option value="MASUK">Kas Masuk</option><option value="KELUAR">Kas Keluar</option></select></div>' +
              '<div><label class="lbl">Akun Kas</label><select id="vfAccount" class="field">' + accOpts + '</select></div>' +
            '</div>' +
            '<div><label class="lbl">Jumlah (Rp) <span class="text-red-500">*</span></label>' +
              '<input id="vfAmount" type="number" min="1" step="1" required class="field" placeholder="cth: 1500000" /></div>' +
            '<div><label class="lbl">Kategori</label><input id="vfCategory" type="text" class="field" placeholder="cth: Operasional Sekretariat" /></div>' +
            '<div><label class="lbl">Keterangan <span class="text-red-500">*</span></label>' +
              '<textarea id="vfDesc" required rows="3" class="field" placeholder="Keterangan transaksi…"></textarea></div>' +
            '<div><label class="lbl">Tanggal Transaksi</label>' +
              '<input id="vfTanggal" type="date" class="field" value="' + new Date().toISOString().slice(0, 10) + '" /></div>' +
            '<p class="text-xs text-gray-400">Voucher dibuat berstatus "Menunggu Verifikasi" &amp; butuh persetujuan Bendahara + Ketua.</p>' +
            '<div class="flex gap-3 pt-2">' +
              '<button type="submit" class="btn btn-primary flex-1 py-3 rounded-xl font-bold">Simpan Voucher</button>' +
              '<button type="button" data-close class="btn btn-ghost px-5 rounded-xl font-semibold">Batal</button>' +
            '</div>' +
          '</form>' +
        '</div>');

      Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
        b.addEventListener('click', function () { self.closeModal(); });
      });

      document.getElementById('voucherFormEl').addEventListener('submit', function (e) {
        e.preventDefault();
        var payload = {
          type: document.getElementById('vfType').value,
          account: document.getElementById('vfAccount').value,
          amount: Number(document.getElementById('vfAmount').value),
          category: document.getElementById('vfCategory').value.trim(),
          description: document.getElementById('vfDesc').value.trim(),
          transaction_date: document.getElementById('vfTanggal').value
        };
        Auth.fetch('createVoucher', payload).then(function () {
          self.closeModal();
          self.toast('Voucher berhasil dibuat.', 'success');
          self.refreshKeuangan();
        }).catch(function () {});
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
            '<option value="DITOLAK">Ditolak</option>' +
          '</select>' +
        '</div>' +
        '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">' +
          '<div class="overflow-x-auto"><table class="tbl"><thead><tr>' +
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
          if (d.can_edit) acts += self.aBtn('edit', 'Ubah', 'Ubah draf usulan');
          if (d.can_submit) acts += self.aBtn('submit', 'Ajukan', 'Kirim ke Approval Board Ketua');
          if (canApprove && d.status === 'AJUKAN') {
            acts += self.aBtn('approve', 'Setujui', 'Setujui program');
            acts += self.aBtn('danger reject', 'Tolak', 'Tolak program');
          }
          if (!acts) acts = '<span class="text-xs text-gray-300">—</span>';

          return '<tr data-id="' + d.id + '">' +
            '<td class="font-mono text-xs">' + Auth.esc(d.tracking_id) + '</td>' +
            '<td><div class="font-semibold line-clamp-1 max-w-xs">' + Auth.esc(d.program_title) + '</div>' +
              '<div class="text-xs text-gray-500 line-clamp-1 max-w-xs">' + Auth.esc(d.description) + '</div></td>' +
            '<td class="whitespace-nowrap text-gray-600">' + Auth.esc(d.division_label) + '</td>' +
            '<td class="whitespace-nowrap font-semibold">' + Auth.esc(d.budget_label) + '</td>' +
            '<td>' + self.badge(d.status, d.status_label) + '</td>' +
            '<td><div class="flex gap-1.5 flex-wrap min-w-[110px]">' + acts + '</div></td>' +
          '</tr>';
        }).join('') : '<tr><td colspan="6" class="text-center text-gray-400 py-10">Tidak ada usulan yang ditemukan.</td></tr>';

        Array.prototype.forEach.call(tb.querySelectorAll('tr[data-id]'), function (tr) {
          var id = tr.getAttribute('data-id');
          Array.prototype.forEach.call(tr.querySelectorAll('[data-act]'), function (b) {
            b.addEventListener('click', function () {
              var act = b.getAttribute('data-act');
              var item = items.filter(function (x) { return x.id === id; })[0];
              if (act === 'edit') self.submissionForm(item);
              else if (act === 'submit') self.submissionAjukan(item);
              else if (act === 'approve') self.submissionApprove(item);
              else if (act === 'reject') self.submissionReject(item);
            });
          });
        });
      }).catch(function () {
        tb.innerHTML = '<tr><td colspan="6" class="text-center text-red-400 py-10">Gagal memuat data usulan.</td></tr>';
      });
    },

    refreshDivisi: function () {
      var r = this.state.user.role;
      this.loadDivisi(['SUPERADMIN', 'KETUA_DIVISI', 'ANGGOTA_DIVISI'].indexOf(r) !== -1,
        ['SUPERADMIN', 'KETUA'].indexOf(r) !== -1);
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
        '<div class="p-6">' +
          '<div class="flex items-center justify-between mb-5">' +
            '<h3 class="text-lg font-extrabold text-emerald-dark">' + (isEdit ? 'Ubah Usulan Program' : 'Usulkan Program Divisi') + '</h3>' +
            '<button data-close class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">' +
              '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>' +
          '</div>' +
          '<form id="subFormEl" class="space-y-4">' +
            '<div><label class="lbl">Judul Program <span class="text-red-500">*</span></label>' +
              '<input id="dfTitle" type="text" required class="field" placeholder="cth: Workshop Kepenulisan Islam" value="' + Auth.esc(item ? item.program_title : '') + '" /></div>' +
            '<div><label class="lbl">Deskripsi Program <span class="text-red-500">*</span></label>' +
              '<textarea id="dfDesc" required rows="4" class="field" placeholder="Rincian program…">' + Auth.esc(item ? item.description : '') + '</textarea></div>' +
            '<div class="grid sm:grid-cols-2 gap-4">' +
              '<div><label class="lbl">Estimasi Anggaran (Rp)</label>' +
                '<input id="dfBudget" type="number" min="0" step="1" class="field" placeholder="cth: 5000000" value="' + (item ? item.budget_estimate : '') + '" /></div>' +
              '<div><label class="lbl">Target Peserta</label>' +
                '<input id="dfTarget" type="text" class="field" placeholder="cth: 50 mahasiswa" value="' + Auth.esc(item ? item.target_audience : '') + '" /></div>' +
            '</div>' +
            divField +
            '<div><label class="lbl">Tanggal Pelaksanaan</label>' +
              '<input id="dfTanggal" type="date" class="field" value="' + (item ? item.execution_date : '') + '" /></div>' +
            '<p class="text-xs text-gray-400">Usulan disimpan sebagai Draf. Ajukan ke Ketua setelah siap — divisi tidak dapat mempublikasi sendiri.</p>' +
            '<div class="flex gap-3 pt-2">' +
              '<button type="submit" class="btn btn-primary flex-1 py-3 rounded-xl font-bold">' + (isEdit ? 'Simpan Perubahan' : 'Simpan Draf') + '</button>' +
              '<button type="button" data-close class="btn btn-ghost px-5 rounded-xl font-semibold">Batal</button>' +
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
          self.toast(isEdit ? 'Usulan berhasil diperbarui.' : 'Usulan program berhasil dibuat.', 'success');
          self.refreshDivisi();
        }).catch(function () {});
      });
    },

    submissionAjukan: function (item) {
      var self = this;
      this.confirm('Ajukan Program', 'Usulan <b>' + Auth.esc(item.tracking_id) + '</b> — ' +
        '<b>' + Auth.esc(item.program_title) + '</b> akan dikirim ke Approval Board Ketua. Lanjutkan?', function () {
        Auth.fetch('ajukanSubmission', { id: item.id }).then(function () {
          self.toast('Usulan diajukan ke Ketua.', 'success');
          self.refreshDivisi();
        }).catch(function () {});
      });
    },

    submissionApprove: function (item) {
      var self = this;
      this.confirm('Setujui Program', 'Usulan <b>' + Auth.esc(item.program_title) + '</b> dari divisi <b>' +
        Auth.esc(item.division_label) + '</b> akan disetujui. Lanjutkan?', function () {
        Auth.fetch('approveSubmission', { id: item.id }).then(function () {
          self.toast('Usulan program disetujui.', 'success');
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

    // ---------------------------------------------------------------
    // MANAJEMEN PENGGUNA (SUPERADMIN)
    // ---------------------------------------------------------------
    renderPengguna: function () {
      var main = document.getElementById('mainContent');
      var self = this;

      var newBtn = Auth.isSuperadmin()
        ? '<button id="btnUserBaru" class="btn btn-primary px-5 py-2.5 rounded-xl inline-flex items-center gap-2 font-bold text-sm">' +
          '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" /></svg>' +
          'Buat Akun Baru</button>'
        : '<span class="text-xs text-gray-400 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100">Mode read-only — hanya Administrator Sistem yang dapat mengubah akun</span>';

      main.innerHTML = this.pageHead('Manajemen Pengguna',
        'Buat & kelola akun pengurus. Hanya Administrator Sistem yang dapat mengubah akun.', newBtn) +
        '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 p-4 mb-6">' +
          '<input id="usrQ" type="text" placeholder="Cari username / nama…" class="field" />' +
        '</div>' +
        '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">' +
          '<div class="overflow-x-auto"><table class="tbl"><thead><tr>' +
          '<th>Username</th><th>Nama</th><th>Peran</th><th>Divisi</th><th>Status</th><th>Aksi</th>' +
          '</tr></thead><tbody id="usrRows">' + this.loadingRow(6) + '</tbody></table></div>' +
        '</div>';

      if (Auth.isSuperadmin()) {
        document.getElementById('btnUserBaru').addEventListener('click', function () {
          self.userForm(null);
        });
      }

      var q = '';
      document.getElementById('usrQ').addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        q = e.target.value.trim();
        self.loadPengguna(q);
      });
      document.getElementById('usrQ').addEventListener('input', function (e) {
        q = e.target.value.trim();
        self.loadPengguna(q);
      });

      this.loadPengguna('');
    },

    loadPengguna: function (q) {
      var tb = document.getElementById('usrRows');
      var self = this;
      if (!tb) return;

      Auth.get('getListPengguna', null, { quiet: true }).then(function (data) {
        var users = (data && data.users) || [];
        var ql = q.toLowerCase();
        if (ql) {
          users = users.filter(function (u) {
            return (u.username || '').toLowerCase().indexOf(ql) !== -1 ||
                   (u.full_name || '').toLowerCase().indexOf(ql) !== -1;
          });
        }
        tb.innerHTML = users.length ? users.map(function (u) {
          return '<tr data-id="' + u.id + '">' +
            '<td class="font-mono text-xs font-semibold">' + Auth.esc(u.username) + '</td>' +
            '<td class="font-semibold">' + Auth.esc(u.full_name || '—') +
              '<div class="text-xs text-gray-400 font-normal">' + Auth.esc(u.email || '') + '</div></td>' +
            '<td><span class="badge badge-PUBLISHED">' + Auth.esc(u.role_label || u.role) + '</span></td>' +
            '<td class="text-gray-600 whitespace-nowrap">' + Auth.esc(u.division_label || '—') + '</td>' +
            '<td>' + (u.is_active === 'TRUE'
              ? '<span class="badge badge-PUBLISHED">Aktif</span>'
              : '<span class="badge badge-REJECTED">Nonaktif</span>') + '</td>' +
            '<td><div class="flex gap-1.5">' +
              (Auth.isSuperadmin()
                ? self.aBtn('edit', 'Ubah', 'Ubah akun') +
                  self.aBtn(u.is_active === 'TRUE' ? 'danger toggle' : 'toggle',
                    u.is_active === 'TRUE' ? 'Nonaktifkan' : 'Aktifkan', 'Ubah status akun')
                : '<span class="text-xs text-gray-300">—</span>') +
              '</div></td>' +
          '</tr>';
        }).join('') : '<tr><td colspan="6" class="text-center text-gray-400 py-10">Tidak ada pengguna.</td></tr>';

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
      }).catch(function () {
        tb.innerHTML = '<tr><td colspan="6" class="text-center text-red-400 py-10">Gagal memuat data pengguna.</td></tr>';
      });
    },

    /** Modal buat/ubah akun pengguna (SUPERADMIN). */
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
        '<div class="p-6">' +
          '<div class="flex items-center justify-between mb-5">' +
            '<h3 class="text-lg font-extrabold text-emerald-dark">' + (isEdit ? 'Ubah Akun' : 'Buat Akun Baru') + '</h3>' +
            '<button data-close class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">' +
              '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>' +
          '</div>' +
          '<form id="userFormEl" class="space-y-4">' +
            '<div class="grid sm:grid-cols-2 gap-4">' +
              '<div><label class="lbl">Username <span class="text-red-500">*</span></label>' +
                '<input id="ufUsername" type="text" ' + (isEdit ? 'readonly' : 'required') +
                ' class="field font-mono" placeholder="cth: sekretaris2" value="' + Auth.esc(item ? item.username : '') + '" /></div>' +
              '<div><label class="lbl">Nama Lengkap</label>' +
                '<input id="ufNama" type="text" class="field" placeholder="Nama lengkap" value="' + Auth.esc(item ? item.full_name : '') + '" /></div>' +
            '</div>' +
            '<div><label class="lbl">Email</label>' +
              '<input id="ufEmail" type="email" class="field" placeholder="email@contoh.com" value="' + Auth.esc(item ? item.email : '') + '" /></div>' +
            '<div class="grid sm:grid-cols-2 gap-4">' +
              '<div><label class="lbl">Peran <span class="text-red-500">*</span></label><select id="ufRole" class="field">' + roleOpts + '</select></div>' +
              '<div><label class="lbl">Divisi</label><select id="ufDivisi" class="field">' + divOpts + '</select></div>' +
            '</div>' +
            '<div><label class="lbl">Password ' + (isEdit ? '(kosongkan bila tidak diubah)' : '<span class="text-red-500">*</span>') + '</label>' +
              '<input id="ufPassword" type="password" ' + (isEdit ? '' : 'required') +
              ' class="field" minlength="6" placeholder="Minimal 6 karakter" /></div>' +
            '<label class="flex items-center gap-2.5 text-sm cursor-pointer">' +
              '<input id="ufAktif" type="checkbox" class="h-4 w-4 accent-emerald" ' +
              (!isEdit || item.is_active === 'TRUE' ? 'checked' : '') + ' /> Akun aktif</label>' +
            '<div class="flex gap-3 pt-2">' +
              '<button type="submit" class="btn btn-primary flex-1 py-3 rounded-xl font-bold">' + (isEdit ? 'Simpan Perubahan' : 'Buat Akun') + '</button>' +
              '<button type="button" data-close class="btn btn-ghost px-5 rounded-xl font-semibold">Batal</button>' +
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
          self.toast(isEdit ? 'Akun berhasil diperbarui.' : 'Akun baru berhasil dibuat.', 'success');
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

      main.innerHTML = this.pageHead('Jejak Audit',
        'Catatan keamanan setiap aksi penting: login, persetujuan, penolakan, &amp; aksi sensitif lainnya.', '') +
        '<div class="card bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">' +
          '<div class="overflow-x-auto"><table class="tbl"><thead><tr>' +
          '<th>Waktu</th><th>Pelaku</th><th>Aksi</th><th>Keterangan</th>' +
          '</tr></thead><tbody id="auditRows">' + this.loadingRow(4) + '</tbody></table></div>' +
        '</div>';

      Auth.get('getAuditLogs', { limit: 200 }).then(function (data) {
        var logs = (data && data.logs) || [];
        var tb = document.getElementById('auditRows');
        tb.innerHTML = logs.length ? logs.map(function (l) {
          // Badge warna per kategori aksi.
          var cls = 'badge-DRAFT';
          if (/SUCCESS|PUBLISHED|SETUJU|APPROVED|VERIFY/.test(l.action)) cls = 'badge-PUBLISHED';
          else if (/REJECT|DITOLAK|FAILED|FORBIDDEN/.test(l.action)) cls = 'badge-REJECTED';
          else if (/LOGIN|LOGOUT|SUBMIT|AJUKAN|CREATE|UPDATE/.test(l.action)) cls = 'badge-PENDING_APPROVAL';
          return '<tr>' +
            '<td class="whitespace-nowrap text-xs text-gray-500 font-mono">' + Auth.esc(l.timestamp) + '</td>' +
            '<td class="font-semibold font-mono text-xs">' + Auth.esc(l.actor) + '</td>' +
            '<td><span class="badge ' + cls + '">' + Auth.esc(l.action) + '</span></td>' +
            '<td class="text-sm text-gray-700">' + Auth.esc(l.detail) + '</td>' +
          '</tr>';
        }).join('') : '<tr><td colspan="4" class="text-center text-gray-400 py-10">Belum ada catatan audit.</td></tr>';
      }).catch(function () {
        document.getElementById('auditRows').innerHTML =
          '<tr><td colspan="4" class="text-center text-red-400 py-10">Gagal memuat jejak audit.</td></tr>';
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
