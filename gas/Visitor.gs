/**
 * ============================================================================
 * Visitor.gs — Pelacakan & Statistik Pengunjung Portal Publik
 * ============================================================================
 * Tab: Sheet_Visitors (lihat SCHEMA di Database.gs).
 *
 * Cara kerja:
 *   - Portal publik membuat visitor_id di sisi klien (localStorage) lalu
 *     mengirimnya ke `trackVisitor` setiap kali halaman dibuka.
 *   - Kunjungan pertama sebuah visitor_id = pengunjung unik (is_unique=TRUE).
 *   - Kunjungan berikutnya memperbarui baris yang sama: last_seen, last_page,
 *     visit_count+1 (satu baris per pengunjung, bukan per kunjungan).
 *
 * Privasi: hanya data agregat (device/OS/lokasi/waktu) yang disimpan. Tidak
 * ada nama/NIK/email. Lokasi berasal dari lookup IP publik di sisi klien
 * (opsional, gagal diam-diam).
 * ==========================================================================*/

/** Placeholder untuk deteksi device klien (dipakai bila frontend tidak mengirim). */
var DEVICE_TYPES = ['mobile', 'tablet', 'desktop'];

/**
 * trackVisitor: catat/iperbarui kunjungan portal publik. Aksi PUBLIK.
 * @param {object} ctx.payload { visitor_id, page, referrer?, device?, os?,
 *                                browser?, user_agent?, timezone?, country?,
 *                                city?, region?, latitude?, longitude? }
 */
function trackVisitor(ctx) {
  var p = ctx.payload || {};
  var visitorId = String(p.visitor_id || '').trim();
  var page = String(p.page || '').trim();

  if (!visitorId) {
    return { ok: false, data: null, message: 'visitor_id wajib diisi.' };
  }

  var now = new Date().toISOString();

  // Deteksi device/OS/browser dari user agent bila tidak dikirim klien.
  var ua = String(p.user_agent || '');
  var device = String(p.device || detectDevice_(ua));
  var os = String(p.os || detectOS_(ua));
  var browser = String(p.browser || detectBrowser_(ua));

  var existing = Database.findOne(TABS.VISITORS, { visitor_id: visitorId });
  if (existing) {
    // Pengunjung lama: update kunjungan terakhir.
    var values = {
      last_seen: now,
      last_page: page || existing.last_page,
      visit_count: (Number(existing.visit_count) || 1) + 1,
      updated_at: now
    };
    // Lengkapi field yang masih kosong (klien awal tidak mengirim lokasi).
    if (!existing.device && device) values.device = device;
    if (!existing.os && os) values.os = os;
    if (!existing.browser && browser) values.browser = browser;
    if (!existing.country && p.country) values.country = String(p.country);
    if (!existing.city && p.city) values.city = String(p.city);
    if (!existing.timezone && p.timezone) values.timezone = String(p.timezone);
    Database.updateRow(TABS.VISITORS, existing._row, values);
    return {
      ok: true,
      data: { visitor_id: visitorId, visit_count: values.visit_count, is_unique: false },
      message: 'Kunjungan tercatat.'
    };
  }

  // Pengunjung baru = unik.
  Database.insert(TABS.VISITORS, {
    id: uuid(),
    visitor_id: visitorId,
    ip: '', // IP klien tidak diekspos oleh Apps Script web app; lokasi dari klien.
    user_agent: ua,
    device: device,
    os: os,
    browser: browser,
    country: String(p.country || ''),
    city: String(p.city || ''),
    region: String(p.region || ''),
    latitude: String(p.latitude || ''),
    longitude: String(p.longitude || ''),
    timezone: String(p.timezone || ''),
    referrer: String(p.referrer || ''),
    first_page: page,
    last_page: page,
    first_seen: now,
    last_seen: now,
    visit_count: 1,
    is_unique: 'TRUE'
  });

  return {
    ok: true,
    data: { visitor_id: visitorId, visit_count: 1, is_unique: true },
    message: 'Pengunjung baru tercatat.'
  };
}

/**
 * getVisitors: statistik pengunjung portal publik.
 * SUPERADMIN, KETUA, PEMBINA, PENGAWAS.
 * @param {object} ctx.payload { days? (default 30), limit? (default 100) }
 */
function getVisitors(ctx) {
  var p = ctx.payload || {};
  var days = Math.max(1, Math.min(Number(p.days) || 30, 365));
  var limit = Math.min(Number(p.limit) || 100, 1000);

  var all = Database.readAll(TABS.VISITORS);
  var since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Hanya pengunjung yang terlihat dalam rentang `days` terakhir.
  var recent = all.filter(function (v) {
    return (v.last_seen || '') >= since;
  });

  var countBy = function (field) {
    var map = {};
    recent.forEach(function (v) {
      var key = v[field] || 'Tidak diketahui';
      map[key] = (map[key] || 0) + 1;
    });
    return Object.keys(map)
      .map(function (k) { return { label: k, count: map[k] }; })
      .sort(function (a, b) { return b.count - a.count; });
  };

  var todayStr = new Date().toISOString().slice(0, 10);
  var visitorsToday = recent.filter(function (v) {
    return (v.last_seen || '').slice(0, 10) === todayStr;
  }).length;

  // Tren harian (7 hari terakhir, terhitung mundur).
  var dailyTrend = [];
  for (var i = 6; i >= 0; i--) {
    var dayStr = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    var dayCount = recent.filter(function (v) {
      return (v.last_seen || '').slice(0, 10) === dayStr;
    }).length;
    dailyTrend.push({ date: dayStr, count: dayCount });
  }

  var items = recent
    .sort(function (a, b) {
      return (b.last_seen || '').localeCompare(a.last_seen || '');
    })
    .slice(0, limit)
    .map(function (v) {
      return {
        id: v.id,
        visitor_id: v.visitor_id,
        device: v.device || '—',
        os: v.os || '—',
        browser: v.browser || '—',
        country: v.country || '',
        city: v.city || '',
        timezone: v.timezone || '',
        first_page: v.first_page || '',
        last_page: v.last_page || '',
        referrer: v.referrer || '',
        first_seen: v.first_seen,
        last_seen: v.last_seen,
        visit_count: Number(v.visit_count) || 1
      };
    });

  return {
    ok: true,
    data: {
      totals: {
        unique_visitors: recent.length,
        total_visits: recent.reduce(function (sum, v) {
          return sum + (Number(v.visit_count) || 1);
        }, 0),
        visitors_today: visitorsToday,
        all_time_unique: all.length
      },
      by_device: countBy('device'),
      by_os: countBy('os'),
      by_browser: countBy('browser'),
      by_country: countBy('country').slice(0, 10),
      daily_trend: dailyTrend,
      items: items
    },
    message: 'Statistik pengunjung berhasil dimuat.'
  };
}

/** Deteksi tipe device dari User-Agent. */
function detectDevice_(ua) {
  if (!ua) return '';
  var s = ua.toLowerCase();
  if (/(ipad|tablet|playbook|silk)/.test(s)) return 'tablet';
  if (/(mobi|android|iphone|ipod|blackberry|opera mini|iemobile|windows phone)/.test(s)) {
    return 'mobile';
  }
  return 'desktop';
}

/** Deteksi sistem operasi dari User-Agent. */
function detectOS_(ua) {
  if (!ua) return '';
  var s = ua.toLowerCase();
  if (/windows nt 10/.test(s)) return 'Windows 10/11';
  if (/windows nt 6\.3/.test(s)) return 'Windows 8.1';
  if (/windows nt 6\.2/.test(s)) return 'Windows 8';
  if (/windows nt 6\.1/.test(s)) return 'Windows 7';
  if (/windows/.test(s)) return 'Windows';
  if (/android (\d+)/.test(s)) {
    var ver = s.match(/android (\d+(?:\.\d+)?)/);
    return 'Android ' + (ver ? ver[1] : '');
  }
  if (/iphone os (\d+)/.test(s) || /cpu os (\d+)/.test(s)) {
    var iv = s.match(/(?:iphone os|cpu os) (\d+(?:_\d+)?)/);
    return 'iOS ' + (iv ? iv[1].replace(/_/g, '.') : '');
  }
  if (/mac os x/.test(s)) return 'macOS';
  if (/cros/.test(s)) return 'ChromeOS';
  if (/linux/.test(s)) return 'Linux';
  return '';
}

/** Deteksi browser dari User-Agent. */
function detectBrowser_(ua) {
  if (!ua) return '';
  var s = ua.toLowerCase();
  if (/edg\/(\d+)/.test(s)) return 'Microsoft Edge';
  if (/opr\/(\d+)|opera/.test(s)) return 'Opera';
  if (/chrome\/(\d+)/.test(s) && !/chromium/.test(s)) return 'Google Chrome';
  if (/chromium/.test(s)) return 'Chromium';
  if (/firefox\/(\d+)/.test(s)) return 'Mozilla Firefox';
  if (/safari/.test(s) && !/chrome/.test(s)) return 'Safari';
  if (/msie|trident/.test(s)) return 'Internet Explorer';
  return '';
}
