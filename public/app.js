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
    init: function () {
      this.bindMobileNav();
      this.bindVerifyForm();
      this.loadDocuments();
      this.renderDivisions();
    },

    /** Panggil backend (GET, publik). */
    get: function (action, params) {
      var url = (window.API_BASE || '') + '?action=' + encodeURIComponent(action);
      if (params) {
        Object.keys(params).forEach(function (k) {
          url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
        });
      }
      return fetch(url, { method: 'GET' }).then(function (r) { return r.json(); });
    },

    /** POST publik. */
    post: function (action, payload) {
      return fetch(window.API_BASE || '', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: action, payload: payload || {} }),
        redirect: 'follow'
      }).then(function (r) { return r.json(); });
    },

    bindMobileNav: function () {
      var toggle = document.getElementById('mobileToggle');
      var menu = document.getElementById('mobileMenu');
      if (!toggle || !menu) return;
      toggle.addEventListener('click', function () {
        menu.classList.toggle('hidden');
      });
      menu.querySelectorAll('.mobile-link').forEach(function (link) {
        link.addEventListener('click', function () { menu.classList.add('hidden'); });
      });
    },

    // ---------------------------------------------------------------
    // VERIFIKASI SURAT
    // ---------------------------------------------------------------
    bindVerifyForm: function () {
      var form = document.getElementById('verifyForm');
      if (!form) return;
      var self = this;

      // Isi otomatis bila ada ?no= di URL (dari QR/link verifikasi surat).
      var q = new URLSearchParams(window.location.search).get('no');
      if (q) {
        var input = document.getElementById('verifyInput');
        if (input) { input.value = q; this.runVerify(q); }
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var no = (document.getElementById('verifyInput').value || '').trim();
        if (!no) return;
        self.runVerify(no);
      });
    },

    runVerify: function (letterNumber) {
      var box = document.getElementById('verifyResult');
      var loading = document.getElementById('verifyLoading');
      var btn = document.getElementById('verifyBtn');
      if (!box) return;

      box.classList.add('hidden');
      loading.classList.remove('hidden');
      btn.disabled = true;

      var self = this;
      this.post('verifySurat', { letter_number: letterNumber }).then(function (res) {
        loading.classList.add('hidden');
        btn.disabled = false;
        box.classList.remove('hidden');
        if (res && res.success) {
          box.innerHTML = self.htmlValid(res.data);
        } else {
          box.innerHTML = self.htmlInvalid((res && res.message) || 'Surat tidak ditemukan.');
        }
      }).catch(function () {
        loading.classList.add('hidden');
        btn.disabled = false;
        box.classList.remove('hidden');
        box.innerHTML = self.htmlInvalid('Gagal menghubungi server. Coba beberapa saat lagi.');
      });
    },

    htmlValid: function (d) {
      return '' +
        '<div class="border-2 border-emerald bg-emerald-light/40 rounded-xl p-6">' +
          '<div class="flex items-center gap-3 mb-4">' +
            '<div class="h-12 w-12 bg-emerald rounded-full flex items-center justify-center flex-shrink-0">' +
              '<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>' +
            '</div>' +
            '<div><div class="font-extrabold text-emerald text-lg">SURAT SAH &amp; DITERBITKAN RESMI</div>' +
            '<div class="text-sm text-gray-600">Dokumen terverifikasi di sistem Yayasan APII DPW Jabodetabek</div></div>' +
          '</div>' +
          '<div class="grid sm:grid-cols-2 gap-4 text-sm">' +
            '<div><div class="text-gray-500 text-xs uppercase tracking-wide">Nomor Surat</div><div class="font-bold text-gray-800 break-all">' + this.esc(d.letter_number) + '</div></div>' +
            '<div><div class="text-gray-500 text-xs uppercase tracking-wide">Jenis</div><div class="font-bold text-gray-800">' + this.esc(d.letter_type_label) + '</div></div>' +
            '<div><div class="text-gray-500 text-xs uppercase tracking-wide">Tanggal Surat</div><div class="font-bold text-gray-800">' + this.esc(d.tanggal_label) + '</div></div>' +
            '<div><div class="text-gray-500 text-xs uppercase tracking-wide">Disahkan Oleh</div><div class="font-bold text-gray-800">' + this.esc(d.approved_by || 'Ketua DPW Jabodetabek') + '</div></div>' +
          '</div>' +
          '<div class="mt-4 pt-4 border-t border-emerald/20">' +
            '<div class="text-gray-500 text-xs uppercase tracking-wide mb-1">Sidik Digital (SHA-256)</div>' +
            '<code class="text-xs text-emerald-dark break-all font-mono">' + this.esc(d.sha256_hash) + '</code>' +
          '</div>' +
          (d.pdf_url ?
            '<a href="' + this.esc(d.pdf_url) + '" target="_blank" rel="noopener" class="mt-4 inline-flex items-center gap-2 bg-emerald hover:bg-emerald-dark text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition">' +
              '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>' +
              'Unduh PDF Resmi</a>' : '') +
        '</div>';
    },

    htmlInvalid: function (msg) {
      return '' +
        '<div class="border-2 border-red-200 bg-red-50 rounded-xl p-6 flex items-start gap-3">' +
          '<div class="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">' +
            '<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" /></svg>' +
          '</div>' +
          '<div><div class="font-extrabold text-red-700 text-lg mb-1">TIDAK DAPAT DIVERIFIKASI</div>' +
            '<div class="text-sm text-gray-700">' + this.esc(msg) + '</div>' +
            '<div class="text-xs text-gray-500 mt-2">Pastikan nomor surat ditulis lengkap &amp; sesuai. Hubungi sekretariat bila masih gagal.</div></div>' +
        '</div>';
    },

    // ---------------------------------------------------------------
    // DOKUMEN RESMI
    // ---------------------------------------------------------------
    loadDocuments: function () {
      var list = document.getElementById('dokumenList');
      var empty = document.getElementById('dokumenEmpty');
      var stat = document.getElementById('statSurat');
      if (!list) return;
      var self = this;

      this.get('getPublishedSurat', { limit: 9 }).then(function (res) {
        if (!res || !res.success || !res.data.items.length) {
          list.innerHTML = '';
          if (empty) empty.classList.remove('hidden');
          if (stat) stat.textContent = '0';
          return;
        }
        if (stat) stat.textContent = res.data.total;
        list.innerHTML = res.data.items.map(function (s) {
          return '' +
            '<a href="' + self.esc(s.pdf_url || '#') + '" target="_blank" rel="noopener" class="doc-card bg-white rounded-2xl shadow-md border border-emerald-100 p-6 flex flex-col">' +
              '<div class="flex items-center justify-between mb-4">' +
                '<span class="badge badge-published">Diterbitkan</span>' +
                '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>' +
              '</div>' +
              '<div class="text-xs font-bold text-emerald uppercase tracking-wide mb-2">' + self.esc(s.letter_type_label) + '</div>' +
              '<h3 class="font-bold text-gray-800 text-base mb-3 line-clamp-2">' + self.esc(s.title) + '</h3>' +
              '<div class="text-xs text-gray-500 font-mono break-all mb-4">' + self.esc(s.letter_number) + '</div>' +
              '<div class="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between text-xs">' +
                '<span class="text-gray-500">' + self.esc(s.tanggal_label) + '</span>' +
                '<span class="text-emerald font-semibold inline-flex items-center gap-1">Unduh PDF' +
                  '<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg></span>' +
              '</div>' +
            '</a>';
        }).join('');
      }).catch(function () {
        list.innerHTML = '<div class="col-span-full text-center text-gray-400 py-12">Gagal memuat dokumen.</div>';
      });
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
