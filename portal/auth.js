/**
 * ============================================================================
 * auth.js — Lapisan Autentikasi Frontend Portal Pengurus
 * ============================================================================
 * Tanggung jawab:
 *   - Menyimpan/membaca token di localStorage ("siapii_token")
 *   - Auth.fetch(): envelope request GET/POST + penanganan response backend
 *     { success, data, message } + auto-logout pada 401
 *   - login()/logout()/me() wrappers
 *   - isReadOnly(): cek peran read-only (Pembina/Pengawas)
 *   - Penjaga mode demo: menolak aksi TULIS saat sesi demo aktif
 *     (lihat DEMO_GUARD_EXEMPT_ACTIONS — aksi sesi/login tidak pernah diblokir)
 * ==========================================================================*/
(function () {
  'use strict';

  var TOKEN_KEY = 'siapii_token';
  var USER_KEY = 'siapii_user';

  // Aksi sesi/autentikasi yang TIDAK BOLEH diblokir penjaga mode demo.
  // Semua aksi ini juga dikirim sebagai POST: `login`, `loginDemo`, `logout`,
  // `me`, `registerAnggota`. Bila penjaga demo ikut memblokirnya, siapa pun yang
  // perambannya masih menyimpan identitas demo tidak bisa keluar dari mode demo
  // — tombol "Masuk" (akun apa pun) dan "Masuk sebagai Akun Demo" hanya
  // memunculkan notifikasi "Mode demo hanya untuk melihat…" tanpa pernah
  // menghubungi server. Persis kegagalan yang terjadi di produksi 2026-10-10;
  // dikunci uji `npm run smoke:portal`.
  var DEMO_GUARD_EXEMPT_ACTIONS = ['login', 'loginDemo', 'logout', 'me', 'registerAnggota'];

  var Auth = {
    /** Token sesi saat ini (string) atau null. */
    token: null,
    /** Data user hasil login (sanitizeUser). */
    user: null,

    /** Ambil token & user dari localStorage saat modul dimuat. */
    restore: function () {
      try {
        this.token = localStorage.getItem(TOKEN_KEY) || null;
        var u = localStorage.getItem(USER_KEY);
        this.user = u ? JSON.parse(u) : null;
      } catch (e) {
        this.token = null; this.user = null;
      }
      return !!this.token;
    },

    isLoggedIn: function () { return !!this.token; },

    /** Simpan sesi hasil login. */
    save: function (token, user) {
      this.token = token; this.user = user;
      try {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } catch (e) { /* localStorage tidak tersedia — sesi hanya di memori */ }
    },

    /** Hapus sesi dari memori & localStorage. */
    clear: function () {
      this.token = null; this.user = null;
      try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch (e) {}
      this.cache.clear();
    },

    // ---------------------------------------------------------------
    // IN-MEMORY SWR (STALE-WHILE-REVALIDATE) CACHE ENGINE
    // ---------------------------------------------------------------
    cache: {
      store: {},
      get: function (key) {
        var item = this.store[key];
        if (!item) return null;
        if (Date.now() > item.expiresAt) {
          delete this.store[key];
          return null;
        }
        return item.data;
      },
      set: function (key, data, ttlMs) {
        this.store[key] = {
          data: data,
          expiresAt: Date.now() + (ttlMs || 60000) // default 1 menit
        };
      },
      invalidate: function (namespaces) {
        if (!namespaces) { this.store = {}; return; }
        if (typeof namespaces === 'string') namespaces = [namespaces];
        var self = this;
        Object.keys(this.store).forEach(function (k) {
          namespaces.forEach(function (ns) {
            if (k.toLowerCase().indexOf(ns.toLowerCase()) !== -1) {
              delete self.store[k];
            }
          });
        });
      },
      clear: function () { this.store = {}; }
    },

    /** Indikator loading bar tipis di atas layar (#topProgressBar). */
    showProgress: function () {
      var bar = document.getElementById('topProgressBar');
      if (bar) {
        bar.style.width = '35%';
        bar.classList.remove('opacity-0');
      }
    },

    hideProgress: function () {
      var bar = document.getElementById('topProgressBar');
      if (bar) {
        bar.style.width = '100%';
        setTimeout(function () {
          bar.classList.add('opacity-0');
          setTimeout(function () { bar.style.width = '0%'; }, 250);
        }, 150);
      }
    },

    // ---------------------------------------------------------------
    // KOMUNIKASI BACKEND
    // ---------------------------------------------------------------

    /**
     * fetch: panggil aksi backend.
     * @param {string} action   nama aksi (lihat ROUTES di Code.gs)
     * @param {object} payload  parameter aksi (opsional)
     * @param {object} opts     { method: 'GET'|'POST' (default POST), quiet: true }
     * @return {Promise<object>} resolve dengan { success, data, message }
     */
    fetch: function (action, payload, opts) {
      opts = opts || {};
      var method = (opts.method || 'POST').toUpperCase();
      var url = (window.API_BASE || '') + '?action=' + encodeURIComponent(action);
      var self = this;

      // Akun demo: blokir semua aksi TULIS di frontend sebelum mencapai server.
      // Backend juga menolak (DEMO_ALLOWED_ACTIONS), tapi pesan ini lebih ramah.
      // Aksi sesi (login/logout/…) dikecualikan: tanpa itu, sesi demo yang masih
      // tersimpan membuat halaman login tidak bisa dipakai sama sekali.
      if (this.isDemo() && method !== 'GET' &&
          DEMO_GUARD_EXEMPT_ACTIONS.indexOf(action) === -1) {
        var demoMsg = 'Mode demo hanya untuk melihat. Perubahan data tidak dapat disimpan.';
        if (!opts.quiet) this.toast(demoMsg, 'error');
        return Promise.reject(new Error(demoMsg));
      }

      self.showProgress();

      // GET: token & payload sebagai query string.
      if (method === 'GET') {
        if (this.token) url += '&token=' + encodeURIComponent(this.token);
        if (payload) {
          Object.keys(payload).forEach(function (k) {
            var v = payload[k];
            if (v === null || v === undefined) return;
            url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(String(v));
          });
        }
      }

      var req = { method: method, redirect: 'follow' };
      if (method === 'POST') {
        req.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
        req.body = JSON.stringify({
          action: action,
          token: this.token || null,
          payload: payload || {}
        });
      }

      return fetch(url, req).then(function (r) {
        return r.json().then(function (body) {
          return { status: r.status, body: body || {} };
        }).catch(function () {
          throw new Error('Respons server tidak valid (bukan JSON).');
        });
      }).then(function (res) {
        self.hideProgress();
        var b = res.body;

        // Sesi berakhir/tidak sah -> auto-logout.
        if (res.status === 401 || b.code === 401 || b.expired === true) {
          self.clear();
          self.redirectLogin(b.message || 'Sesi Anda telah berakhir. Silakan login kembali.');
          throw new Error(b.message || 'Sesi berakhir.');
        }

        if (b && b.success === true) {
          // Mutasi berhasil: bersihkan cache namespace terkait secara otomatis
          if (method === 'POST') {
            if (/Surat/i.test(action)) self.cache.invalidate(['surat', 'dashboard']);
            if (/Voucher|Account/i.test(action)) self.cache.invalidate(['keuangan', 'accounts', 'dashboard']);
            if (/Submission|LPJ/i.test(action)) self.cache.invalidate(['divisi', 'dashboard']);
            if (/Pengguna|Pendaftar/i.test(action)) self.cache.invalidate(['pengguna', 'pendaftar']);
            if (/Settings|Kop|Editorial/i.test(action)) self.cache.invalidate(['settings', 'surat', 'dashboard']);
          }
          return b.data;
        }

        if (b && b.success === false && /Sesi berakhir|tidak valid|Silakan login kembali/i.test(b.message || '')) {
          self.clear();
          self.redirectLogin(b.message);
          throw new Error(b.message);
        }

        var msg = (b && b.message) || 'Permintaan gagal diproses.';
        if (!opts.quiet) self.toast(msg, 'error');
        throw new Error(msg);
      }).catch(function (err) {
        self.hideProgress();
        if (err instanceof TypeError) {
          var m = 'Gagal menghubungi server. Periksa koneksi internet Anda.';
          if (!opts.quiet) self.toast(m, 'error');
          throw new Error(m);
        }
        throw err;
      });
    },

    /** Alias GET. */
    get: function (action, payload, opts) {
      var o = opts || {}; o.method = 'GET';
      return this.fetch(action, payload, o);
    },

    /**
     * getCached: ambil data instan dari in-memory cache (0 ms),
     * sambil memperbarui di latar belakang jika expired (SWR).
     * Mendukung pemanggilan via Promise (.then) MAUPUN via callback function.
     */
    getCached: function (action, payload, optsOrCallback, maybeCb) {
      var self = this;
      var cb = typeof optsOrCallback === 'function' ? optsOrCallback : (typeof maybeCb === 'function' ? maybeCb : null);
      var opts = (typeof optsOrCallback === 'object' && optsOrCallback !== null) ? optsOrCallback : {};
      var cacheKey = action + ':' + JSON.stringify(payload || {});
      var cachedData = opts.force ? null : this.cache.get(cacheKey);

      if (cachedData !== null && cachedData !== undefined) {
        if (cb) {
          try { cb(cachedData); } catch (e) { console.error('Error in getCached callback:', e); }
        }
        if (opts.revalidate !== false) {
          setTimeout(function () {
            self.get(action, payload, { quiet: true }).then(function (fresh) {
              if (fresh) {
                self.cache.set(cacheKey, fresh, opts.ttl || 60000);
                if (cb) {
                  try { cb(fresh); } catch (e) {}
                }
              }
            }).catch(function () {});
          }, 50);
        }
        return Promise.resolve(cachedData);
      }

      return this.get(action, payload, opts).then(function (data) {
        if (data) self.cache.set(cacheKey, data, opts.ttl || 60000);
        if (cb) {
          try { cb(data); } catch (e) { console.error('Error in getCached callback:', e); }
        }
        return data;
      });
    },

    // ---------------------------------------------------------------
    // SIKLUS SESI
    // ---------------------------------------------------------------

    /**
     * login: kirim username+password, simpan sesi.
     * @return {Promise<object>} resolve dengan data user.
     */
    login: function (username, password) {
      var self = this;
      // Buang identitas lama (mis. sisa akun demo dari kunjungan sebelumnya)
      // sebelum menukar sesi: tidak ada user lama yang boleh bocor ke sesi baru,
      // dan penjaga demo tidak lagi melihat sesi yang sudah tidak dipakai.
      this.clear();
      return this.fetch('login', { username: username, password: password },
        { quiet: true })
        .then(function (data) {
          if (!data || !data.token) throw new Error('Respons login tidak valid.');
          self.save(data.token, data.user || null);
          return data.user || null;
        });
    },

    /** logout: panggil backend lalu hapus sesi lokal. */
    logout: function () {
      var self = this;
      var done = function () { self.clear(); self.redirectLogin(); };
      if (!this.token) { done(); return Promise.resolve(); }
      return this.fetch('logout', null, { quiet: true })
        .then(done, done);
    },

    /**
     * me: ambil data user terbaru dari token (dipakai saat reload halaman).
     * @return {Promise<object|null>}
     */
    loginWithDemo: function () { return; },
    /**
     * loginAsDemo: masuk ke akun demo read-only (tanpa username/password).
     * Backend tetap penjaga mutlak (semua aksi tulis ditolak), frontend
     * hanya menyembunyikan tombol agar UX jelas.
     * @return {Promise<object>} resolve dengan data user demo.
     */
    loginAsDemo: function () {
      var self = this;
      // Sama seperti login(): mulai dari keadaan bersih, jangan mewarisi sesi lama.
      this.clear();
      return this.fetch('loginDemo', null, { quiet: true })
        .then(function (data) {
          if (!data || !data.token) throw new Error('Akun demo belum tersedia.');
          self.save(data.token, data.user || null);
          return data.user || null;
        });
    },

    /** True bila sesi saat ini adalah akun demo (read-only presentasi). */
    isDemo: function () {
      return !!(this.user && (this.user.is_demo === true || this.user.role === 'DEMO'));
    },

    me: function () {
      var self = this;
      return this.get('me', null, { quiet: true })
        .then(function (data) {
          var u = (data && data.user) || null;
          if (u) {
            self.user = u;
            try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch (e) {}
          }
          return u;
        });
    },

    // ---------------------------------------------------------------
    // HELPERS PERAN & UI
    // ---------------------------------------------------------------

    /** True bila peran read-only (Pembina/Pengawas) → tombol aksi disembunyikan. */
    isReadOnly: function () {
      var r = this.user && this.user.role;
      return (window.READONLY_ROLES || []).indexOf(r) !== -1;
    },

    /** True bila user adalah SUPERADMIN. */
    isSuperadmin: function () {
      return !!(this.user && this.user.role === 'SUPERADMIN');
    },

    /** Inisial nama untuk avatar. */
    initials: function () {
      var n = (this.user && (this.user.full_name || this.user.username)) || '?';
      return n.split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); })
        .join('').toUpperCase();
    },

    /** Redirect ke halaman login (hash #login supaya satu file). */
    redirectLogin: function (msg) {
      var target = window.location.pathname.split('/').pop() || 'index.html';
      var hash = '#login';
      if (window.location.hash === '#login') return; // sudah di login
      if (msg) hash += '&msg=' + encodeURIComponent(msg);
      window.location.href = target + hash;
    },

    /** Toast notifikasi singkat (container ada di portal.js; fallback aman). */
    toast: function (msg, type) {
      if (window.App && typeof App.toast === 'function') { App.toast(msg, type); return; }
      try { alert(msg); } catch (e) {}
    },

    /** Escape HTML untuk mencegah XSS dari data backend. */
    esc: function (str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    },
  };

  window.Auth = Auth;
})();
