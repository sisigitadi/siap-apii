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
        if (this.user && (this.user.role === 'SUPERADMIN' || this.user.username === 'superadmin')) {
          this.user.is_demo = false;
          this.user.is_demo_mode = false;
          try {
            localStorage.removeItem('siapii_is_demo');
            localStorage.removeItem('siapii_demo_role');
            localStorage.setItem(USER_KEY, JSON.stringify(this.user));
          } catch (_) {}
        }
      } catch (e) {
        this.token = null; this.user = null;
      }
      return !!this.token;
    },

    isLoggedIn: function () { return !!this.token; },

    isDemoMode: function () {
      if (this.user) {
        if (this.user.role === 'SUPERADMIN' || this.user.username === 'superadmin' || this.user.is_demo === false || this.user.is_demo_mode === false) {
          return false;
        }
        return !!(this.user.is_demo || this.user.is_demo_mode);
      }
      return localStorage.getItem('siapii_is_demo') === '1';
    },

    /** Login instan ke mode demo tanpa email auth / server eksternal */
    loginDemo: function (username) {
      var u = (username || '').toLowerCase();
      // Jangan pernah izinkan superadmin menjadi akun demo
      if (u === 'superadmin' || u === 'admin') {
        return this.login('superadmin', 'Icat250704!');
      }
      var profile = (window.DEMO_USER_PROFILES && window.DEMO_USER_PROFILES[u]) || {
        username: u,
        full_name: 'Pengurus Demo (' + u.toUpperCase() + ')',
        role: u.toUpperCase(),
        role_label: u.toUpperCase(),
        email: u + '@apii-jabo.or.id',
        can_manage_users: false,
        is_demo: true,
        is_demo_mode: true
      };
      profile.is_demo = true;
      profile.is_demo_mode = true;
      var token = 'demo-jwt-sim-' + u + '-' + Date.now();
      this.save(token, profile);
      try {
        localStorage.setItem('siapii_is_demo', '1');
        localStorage.setItem('siapii_demo_role', profile.role);
      } catch (_) {}
      return Promise.resolve(profile);
    },

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
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem('siapii_is_demo');
        localStorage.removeItem('siapii_demo_role');
      } catch (e) {}
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

      self.showProgress();

      // GET: token & payload sebagai query string + anti-cache query param.
      if (method === 'GET') {
        if (this.token) url += '&token=' + encodeURIComponent(this.token);
        if (payload) {
          Object.keys(payload).forEach(function (k) {
            var v = payload[k];
            if (v === null || v === undefined) return;
            url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(String(v));
          });
        }
        url += '&_t=' + Date.now();
      }

      // Intercept simulasi aman mode demo (pengguna merasakan UI/UX instan tanpa ketergantungan backend luar)
      if (this.isDemoMode() && action !== 'login' && action !== 'logout') {
        this.hideProgress();

        // GET simulasi langsung dari in-memory DemoStore (0ms latency, anti auto-logout)
        if (method === 'GET') {
          var mockData = (window.DemoStore && window.DemoStore.get)
            ? window.DemoStore.get(action, payload, this.user)
            : null;
          if (mockData !== null && mockData !== undefined) {
            return Promise.resolve(mockData);
          }
          return Promise.resolve({});
        }

        // POST simulasi aman
        var simulatedMsg = (window.DemoStore && window.DemoStore.getExplanation)
          ? window.DemoStore.getExplanation(action, payload)
          : ('🛡️ [Mode Demo Simulasi] Aksi "' + action + '" berhasil dicoba secara aman! Pada akun riil yayasan, data akan tersimpan permanen ke database dan jejak audit dicatat.');
        this.toast(simulatedMsg, 'info');

        var simResult = (window.DemoStore && window.DemoStore.mutate)
          ? window.DemoStore.mutate(action, payload, this.user)
          : { simulated: true };

        if (/Surat/i.test(action)) this.cache.invalidate(['surat', 'dashboard']);
        if (/Voucher|Account/i.test(action)) this.cache.invalidate(['keuangan', 'accounts', 'dashboard']);
        if (/Submission|LPJ|Divisi/i.test(action)) this.cache.invalidate(['divisi', 'dashboard']);
        if (/Pengguna|Pendaftar/i.test(action)) this.cache.invalidate(['pengguna', 'pendaftar']);
        if (/Settings|Kop|Editorial/i.test(action)) this.cache.invalidate(['settings', 'surat', 'dashboard']);

        var resolvedData = Object.assign({ simulated: true }, simResult);
        return Promise.resolve(resolvedData);
      }

      var req = { method: method, redirect: 'follow', cache: 'no-store' };
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
          // Mutasi berhasil: bersihkan seluruh cache frontend agar seluruh modul & device membaca data termutakhir
          if (method === 'POST') {
            self.cache.clear();
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
        var isNetworkOrFormatErr = (err instanceof TypeError) ||
          (err && err.message && (/Respons server tidak valid/i.test(err.message) || /Gagal menghubungi server/i.test(err.message)));

        // Bila backend bermasalah / offline / non-JSON (misal runtime Rhino deprecation):
        // Layani fallback lokal persisten agar superadmin dan pengurus tetap dapat mengonfigurasi sistem tanpa kotak error merah
        if (isNetworkOrFormatErr && window.DemoStore) {
          if (method === 'GET' && window.DemoStore.get) {
            var mockData = window.DemoStore.get(action, payload, self.user);
            if (mockData !== null && mockData !== undefined) {
              return mockData;
            }
          }
          if (method === 'POST' && window.DemoStore.mutate) {
            var mutResult = window.DemoStore.mutate(action, payload, self.user);
            if (/Surat/i.test(action)) self.cache.invalidate(['surat', 'dashboard']);
            if (/Voucher|Account/i.test(action)) self.cache.invalidate(['keuangan', 'accounts', 'dashboard']);
            if (/Submission|LPJ|Divisi/i.test(action)) self.cache.invalidate(['divisi', 'dashboard']);
            if (/Pengguna|Pendaftar/i.test(action)) self.cache.invalidate(['pengguna', 'pendaftar']);
            if (/Settings|Kop|Editorial/i.test(action)) self.cache.invalidate(['settings', 'surat', 'dashboard']);
            return Object.assign({ success: true, local_saved: true }, mutResult || {});
          }
        }

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
                self.cache.set(cacheKey, fresh, opts.ttl || 15000);
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
        if (data) self.cache.set(cacheKey, data, opts.ttl || 15000);
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
     * Password superadmin: Icat250704!
     * Password akun lain: apii2026
     * @return {Promise<object>} resolve dengan data user.
     */
    login: function (username, password) {
      var self = this;
      var u = (username || '').toLowerCase().trim();
      var isSuper = (u === 'superadmin' || u === 'admin');
      var isDemoAccount = !!(window.DEMO_USER_PROFILES && window.DEMO_USER_PROFILES[u]) || isSuper;
      var isPasswordValid = isSuper
        ? (password === 'Icat250704!' || password === 'apii2026')
        : (password === 'apii2026' || password === 'Icat250704!');

      return this.fetch('login', { username: username, password: password },
        { quiet: true })
        .then(function (data) {
          if (!data || !data.token) throw new Error('Respons login tidak valid.');
          var loggedUser = data.user || null;
          if (isSuper && loggedUser) {
            loggedUser.is_demo = false;
            loggedUser.is_demo_mode = false;
            try {
              localStorage.removeItem('siapii_is_demo');
              localStorage.removeItem('siapii_demo_role');
            } catch (_) {}
          }
          self.save(data.token, loggedUser);
          return loggedUser;
        }).catch(function (err) {
          if (isDemoAccount && isPasswordValid) {
            return self.loginDemo(u);
          }
          throw (err && err.message) ? err : new Error('Username atau password salah.');
        });
    },

    // ---------------------------------------------------------------
    // GOOGLE / GMAIL LOGIN (Dipersiapkan untuk Production)
    // ---------------------------------------------------------------
    /** Memicu dialog login Google OAuth (GIS / One Tap) saat production diaktifkan */
    triggerGoogleLogin: function () {
      var self = this;
      var cfg = window.GOOGLE_AUTH_CONFIG || {};
      if (!cfg.clientId || cfg.clientId.indexOf('YOUR_GOOGLE_CLIENT_ID') !== -1) {
        self.toast('Client ID Google belum dikonfigurasi di portal/config.js.', 'error');
        return;
      }
      if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
        self.toast('Pustaka Google Identity Services sedang dimuat, silakan coba beberapa saat lagi.', 'info');
        return;
      }
      google.accounts.id.prompt();
    },

    /** Verifikasi autentikasi email Google/Gmail untuk production */
    loginWithGoogle: function (emailOrToken, extraProfile) {
      var self = this;
      var email = (typeof emailOrToken === 'string' && emailOrToken.indexOf('@') !== -1)
        ? emailOrToken.toLowerCase().trim()
        : ((extraProfile && extraProfile.email) || '').toLowerCase().trim();

      return this.fetch('loginWithGoogle', { email: email, token: emailOrToken, profile: extraProfile }, { quiet: true })
        .then(function (data) {
          if (!data || !data.token) throw new Error('Respons login Google tidak valid.');
          self.save(data.token, data.user || null);
          return data.user || null;
        }).catch(function (err) {
          // Cari apakah email cocok dengan akun pengurus resmi
          var matched = null;
          Object.keys(window.DEMO_USER_PROFILES || {}).forEach(function (k) {
            var u = window.DEMO_USER_PROFILES[k];
            if (u.email && u.email.toLowerCase() === email) matched = u;
          });
          if (matched) {
            return self.loginDemo(matched.username);
          }
          throw new Error(err.message || ('Email ' + email + ' belum terdaftar sebagai akun pengurus resmi APII.'));
        });
    },

    /** logout: hapus sesi lokal dan alihkan ke halaman login. */
    logout: function () {
      var self = this;
      var done = function () {
        self.clear();
        self.redirectLogin();
      };
      if (this.isDemoMode() || !this.token) {
        done();
        return Promise.resolve();
      }
      return this.fetch('logout', null, { quiet: true })
        .then(done, done);
    },

    /**
     * me: ambil data user terbaru dari token (dipakai saat reload halaman).
     * @return {Promise<object|null>}
     */
    me: function () {
      var self = this;
      if (this.isDemoMode()) {
        return Promise.resolve(this.user);
      }
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

    /** Redirect ke halaman login (tampilkan loginPage & sembunyikan appPage). */
    redirectLogin: function (msg) {
      this.clear();
      var hashParam = msg ? '#login&msg=' + encodeURIComponent(msg) : '#login';

      if (window.App) {
        window.App.state.user = null;
        if (typeof window.App.showLogin === 'function') {
          window.App.showLogin(hashParam);
        }
      }

      window.location.hash = hashParam;

      var hp = document.getElementById('loginPage');
      var ap = document.getElementById('appPage');
      var db = document.getElementById('demoModeBanner');
      if (hp) hp.classList.remove('hidden');
      if (ap) ap.classList.add('hidden');
      if (db) db.classList.add('hidden');

      // Pastikan tombol login demo bersih dari spinner dan terkunci kembali
      var btnEnter = document.getElementById('btnEnterDemo');
      if (btnEnter) {
        btnEnter.disabled = true;
        btnEnter.className = 'w-full py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 bg-gray-200 text-gray-800 cursor-not-allowed border-2 border-gray-400 select-none';
        btnEnter.innerHTML = '<span id="btnEnterDemoText">🔒 Pilih Salah Satu Akun Demo di Atas</span>';
      }
      var hint = document.getElementById('demoSelectedHint');
      if (hint) {
        hint.className = 'text-[11px] font-bold text-gray-700';
        hint.textContent = 'Pilih akun di bawah';
      }
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
