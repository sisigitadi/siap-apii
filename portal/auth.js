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
 * ==========================================================================*/
(function () {
  'use strict';

  var TOKEN_KEY = 'siapii_token';
  var USER_KEY = 'siapii_user';

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
     *   - success true  → data berisi payload handler
     *   - success false → reject dengan Error(message) agar mudah ditangkap
     *   - 401           → auto-logout + redirect ke login
     */
    fetch: function (action, payload, opts) {
      opts = opts || {};
      var method = (opts.method || 'POST').toUpperCase();
      var url = (window.API_BASE || '') + '?action=' + encodeURIComponent(action);
      var self = this;

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
        // Gunakan text/plain untuk menghindari CORS Preflight (OPTIONS)
        // yang tidak didukung oleh Web App Google Apps Script.
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
        var b = res.body;

        // Sesi berakhir/tidak sah → auto-logout.
        if (res.status === 401 || b.code === 401 || b.expired === true) {
          self.clear();
          self.redirectLogin(b.message || 'Sesi Anda telah berakhir. Silakan login kembali.');
          throw new Error(b.message || 'Sesi berakhir.');
        }

        if (b && b.success === true) return b.data;

        // Apps Script selalu mengembalikan HTTP 200, jadi sesi berakhir
        // dideteksi dari pesan backend lalu auto-logout.
        if (b && b.success === false && /Sesi berakhir|tidak valid|Silakan login kembali/i.test(b.message || '')) {
          self.clear();
          self.redirectLogin(b.message);
          throw new Error(b.message);
        }

        // Gagal normal: lempar pesan agar UI bisa menampilkannya.
        var msg = (b && b.message) || 'Permintaan gagal diproses.';
        if (!opts.quiet) self.toast(msg, 'error');
        throw new Error(msg);
      }).catch(function (err) {
        // Kesalahan jaringan.
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

    // ---------------------------------------------------------------
    // SIKLUS SESI
    // ---------------------------------------------------------------

    /**
     * login: kirim username+password, simpan sesi.
     * @return {Promise<object>} resolve dengan data user.
     */
    login: function (username, password) {
      var self = this;
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
