/**
 * SIAP APII Enterprise - UI Application Controller
 * Yayasan Apologet Islam Indonesia (SK Kemenkumham: AHU-0014970.AH.01.04.Tahun 2023)
 * Pengembang: Sigit Adi Irianto (https://wa.me/6281358575678 | sigitadi.id)
 * 10 PRD Workspaces, Smart WhatsApp Relay, CR80 2-Sisi, Dual-Approval, Auto-Hijri
 */

const App = (() => {
  let activeWorkspace = 'dashboard';
  let lastSessionUserId = null;
  let currentKtaSide = 'front'; // 'front' | 'back'
  let currentSettingsScope = 'DPP_PUSAT';
  let drawer, backdrop, toastEl;
  let confirmCallback = null;
  let currentAuditFilter = 'ALL';

  const VALID_WORKSPACES = [
    'dashboard', 'surat', 'disposisi', 'kas', 'proker',
    'keanggotaan', 'advokasi', 'muallaf', 'maktabah', 'sistem'
  ];

  function parseDate(str) {
    if (!str) return new Date();
    if (str instanceof Date) return str;
    const s = String(str).trim();
    const m = s.match(/^(\d{2})-(\d{2})-(\d{4})(.*)$/);
    if (m) {
      return new Date(`${m[3]}-${m[2]}-${m[1]}${m[4] ? m[4].replace(' ', 'T') : 'T00:00:00'}`);
    }
    return new Date(s);
  }

  function formatTanggal(d = new Date()) {
    const date = (d instanceof Date) ? d : parseDate(d);
    if (isNaN(date.getTime())) return String(d);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  function formatWaktu(d = new Date()) {
    const date = (d instanceof Date) ? d : parseDate(d);
    if (isNaN(date.getTime())) return String(d);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    const secs = String(date.getSeconds()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${mins}:${secs}`;
  }

  function formatTanggalDisplay(val) {
    if (!val) return '-';
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.replace(/^(\d{4})-(\d{2})-(\d{2})(.*)$/, (m, y, mo, d, rest) => `${d}-${mo}-${y}${rest}`);
    }
    return str;
  }

  function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('hidden');
  }

  function closeAllModals() {
    document.querySelectorAll('[id^="modal-"]').forEach(el => {
      if (!el.classList.contains('hidden')) el.classList.add('hidden');
    });
    const knownModalIds = [
      'modal-confirm-dialog', 'modal-whatsapp-relay', 'modal-kader-denied',
      'modal-tenant-switcher', 'modal-user-form', 'modal-reset-password',
      'modal-deadlock-breaker', 'modal-tambah-surat-masuk', 'modal-tambah-proker',
      'modal-asset-qr', 'modal-surat-preview', 'modal-sk-generator',
      'modal-reject-surat', 'modal-tambah-bkm', 'modal-tambah-bkk',
      'modal-kas-simulator', 'modal-closing-psak', 'modal-kwitansi-preview',
      'modal-ktp-viewer', 'modal-kta-preview', 'modal-tambah-advokasi',
      'modal-syahadat-preview', 'modal-tambah-muallaf', 'modal-scanner-presensi',
      'modal-tambah-risalah', 'modal-tambah-wilayah', 'modal-tambah-warta-cms'
    ];
    knownModalIds.forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('hidden')) el.classList.add('hidden');
    });
    closeDrawer();
  }

  function openConfirmDialog(title, message, onConfirm) {
    confirmCallback = typeof onConfirm === 'function' ? onConfirm : null;
    const modal = document.getElementById('modal-confirm-dialog');
    const titleEl = document.getElementById('confirm-dialog-title');
    const msgEl = document.getElementById('confirm-dialog-message');
    const okBtn = document.getElementById('confirm-dialog-ok');
    if (titleEl) titleEl.textContent = title || 'Konfirmasi Tindakan';
    if (msgEl) msgEl.textContent = message || 'Apakah Anda yakin ingin melanjutkan?';
    if (okBtn) {
      okBtn.onclick = () => {
        closeModal('modal-confirm-dialog');
        if (confirmCallback) {
          const cb = confirmCallback;
          confirmCallback = null;
          cb();
        }
      };
    }
    if (modal) modal.classList.remove('hidden');
  }

  function printTarget(target) {
    document.body.setAttribute('data-print-target', target || 'a4');
    const cleanup = () => {
      document.body.removeAttribute('data-print-target');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 1200);
  }

  function renderWatermarkOverlay(elId, isApproved = false) {
    const container = document.getElementById(elId);
    if (!container) return;
    container.setAttribute('data-approved', isApproved ? 'true' : 'false');
    const user = Auth.getCurrentUser();
    if (!user) return;
    const stamp = formatWaktu(new Date());
    const text = `${user.fullName || 'PENGURUS'} - ${user.id || user.username || 'ID'} - ${stamp} - RAHASIA APII`;
    container.innerHTML = Array.from({ length: 6 }, () =>
      `<div class="watermark-diagonal-line">${text} &bull; ${text}</div>`
    ).join('');
  }

  function resolveOfficerSafe(role, tenantId = 'DPP_PUSAT', divisi = null) {
    if (typeof Auth.resolveOfficerContact === 'function') {
      const resolved = Auth.resolveOfficerContact(role, tenantId, divisi);
      if (resolved && resolved.name) return resolved;
    }
    const db = State.getDb();
    const users = Array.isArray(db.users) ? db.users : [];
    const match =
      users.find(u => u.status === 'active' && u.role === role && u.tenantId === tenantId && (!divisi || u.divisi === divisi)) ||
      users.find(u => u.status === 'active' && u.role === role && u.tenantId === tenantId) ||
      users.find(u => u.status === 'active' && u.role === role && u.tenantId === 'DPP_PUSAT') ||
      users.find(u => u.role === 'superadmin');
    const roleLabel = (CONFIG.ROLES[role] && CONFIG.ROLES[role].label) || role.toUpperCase();
    if (match) {
      return {
        name: match.fullName,
        phone: (match.phone || match.whatsapp || '6281358575678').replace(/[^0-9]/g, ''),
        roleLabel: roleLabel,
        userId: match.id
      };
    }
    return {
      name: 'Pengurus Struktural APII',
      phone: '6281358575678',
      roleLabel: roleLabel,
      userId: ''
    };
  }

  function syncApiSafe(action, payload = {}) {
    if (typeof ApiClient === 'object' && typeof ApiClient.request === 'function' && CONFIG.API_URL) {
      Promise.resolve(ApiClient.request(action, payload)).catch(() => {});
    }
  }

  function getWilayahOptionsSafe() {
    if (typeof State.getWilayahList === 'function') {
      const list = State.getWilayahList();
      if (Array.isArray(list) && list.length > 0) return list;
    }
    const db = State.getDb();
    if (Array.isArray(db.wilayah) && db.wilayah.length > 0) return db.wilayah;
    return CONFIG.TENANTS || [];
  }

  function parseHashWorkspace() {
    const raw = (window.location.hash || '').replace(/^#\/?/, '').trim().toLowerCase();
    return VALID_WORKSPACES.includes(raw) ? raw : 'dashboard';
  }

  function isScopedRecordVisible(recTenantId, recDivisi = null) {
    const user = Auth.getCurrentUser();
    if (!user) return false;
    const tenantOk = user.isNationalExecutive || !recTenantId || recTenantId === user.tenantId;
    if (!tenantOk) return false;
    if ((user.role === 'ketua_divisi' || user.role === 'anggota_divisi') && user.divisi && recDivisi) {
      if (Array.isArray(recDivisi)) return recDivisi.includes(user.divisi);
      return recDivisi === user.divisi;
    }
    return true;
  }

  function syncAuthVisibility(isAuthed) {
    const loginScreen = document.getElementById('portal-login-screen');
    const appShell = document.getElementById('portal-app-shell');
    if (isAuthed) {
      if (loginScreen) {
        loginScreen.classList.add('hidden');
        loginScreen.classList.remove('flex');
        loginScreen.hidden = true;
        if (loginScreen.style) loginScreen.style.display = 'none';
      }
      if (appShell) {
        appShell.classList.remove('hidden');
        appShell.classList.add('flex');
        appShell.hidden = false;
        if (appShell.style) appShell.style.display = 'flex';
      }
    } else {
      if (appShell) {
        appShell.classList.add('hidden');
        appShell.classList.remove('flex');
        appShell.hidden = true;
        if (appShell.style) appShell.style.display = 'none';
      }
      if (loginScreen) {
        loginScreen.classList.remove('hidden');
        loginScreen.classList.add('flex');
        loginScreen.hidden = false;
        if (loginScreen.style) loginScreen.style.display = 'flex';
      }
    }
  }

  function showLoginError(message) {
    const banner = document.getElementById('login-error-banner');
    const textEl = document.getElementById('login-error-text');
    if (textEl) textEl.textContent = message || 'Username atau kata sandi tidak valid.';
    if (banner) banner.classList.remove('hidden');
  }

  function clearLoginError() {
    const banner = document.getElementById('login-error-banner');
    const textEl = document.getElementById('login-error-text');
    if (textEl) textEl.textContent = '';
    if (banner) banner.classList.add('hidden');
  }

  function toggleLoginPasswordVisibility() {
    const pwdInput = document.getElementById('login-password');
    const iconEl = document.getElementById('login-password-eye-icon');
    if (!pwdInput) return;
    const isPassword = pwdInput.type === 'password';
    pwdInput.type = isPassword ? 'text' : 'password';
    if (iconEl) iconEl.textContent = isPassword ? 'visibility_off' : 'visibility';
  }

  function prefillLoginUsername(username) {
    const userInput = document.getElementById('login-username');
    const pwdInput = document.getElementById('login-password');
    clearLoginError();
    if (userInput) userInput.value = username || '';
    if (pwdInput) pwdInput.focus();
  }

  function handleLoginSubmit(event) {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    clearLoginError();

    const userInput = document.getElementById('login-username');
    const pwdInput = document.getElementById('login-password');
    const username = (userInput ? userInput.value : '').trim();
    const password = pwdInput ? pwdInput.value : '';

    if (!username || !password) {
      showLoginError('Username jabatan dan kata sandi wajib diisi.');
      if (!username && userInput) userInput.focus();
      else if (pwdInput) pwdInput.focus();
      return false;
    }

    const res = Auth.login(username, password);
    if (!res || !res.ok) {
      showLoginError((res && res.error) ? res.error : 'Username atau kata sandi tidak valid.');
      if (pwdInput) {
        pwdInput.value = '';
        pwdInput.focus();
      }
      return false;
    }

    if (pwdInput) pwdInput.value = '';
    return false;
  }

  function setupLoginForm() {
    const form = document.getElementById('portal-login-form');
    if (!form) return;
    if (form.dataset && form.dataset.boundSubmit === '1') return;
    if (form.dataset) form.dataset.boundSubmit = '1';
    form.addEventListener('submit', handleLoginSubmit);
  }

  function resetTransientUiState(session) {
    closeAllModals();
    const targetTenantId = session?.user?.tenantId || 'DPP_PUSAT';
    currentSettingsScope = targetTenantId;
    currentAuditFilter = 'ALL';
    currentKtaSide = 'front';
    if (typeof editingSuratId !== 'undefined') editingSuratId = null;
    if (typeof currentKtaAnggota !== 'undefined') currentKtaAnggota = null;
    if (typeof maktabahSearchQuery !== 'undefined') maktabahSearchQuery = '';
    if (typeof currentActiveSistemTab !== 'undefined') currentActiveSistemTab = 'iam';
    if (typeof auditSearchQuery !== 'undefined') auditSearchQuery = '';
    if (typeof currentIamView !== 'undefined') currentIamView = 'users';

    const maktabahInput = document.getElementById('maktabah-search-input');
    if (maktabahInput) maktabahInput.value = '';
  }

  function init() {
    drawer = document.getElementById('enterprise-drawer');
    backdrop = document.getElementById('drawer-backdrop');
    toastEl = document.getElementById('global-toast');

    setupNavigation();
    setupTenantSwitcher();
    setupLoginForm();
    setupA4Composer();

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAllModals();
    });

    const maktabahInput = document.getElementById('maktabah-search-input');
    if (maktabahInput) {
      maktabahInput.addEventListener('input', (e) => {
        maktabahSearchQuery = e.target.value || '';
        renderMaktabahWorkspace();
      });
    }

    window.addEventListener('hashchange', () => {
      if (!Auth.isAuthenticated()) return;
      const target = parseHashWorkspace();
      if (target !== activeWorkspace && Auth.canAccessWorkspace(target)) {
        switchWorkspace(target, { skipHashUpdate: true });
      }
    });

    const currentUser = Auth.getCurrentUser();
    if (!currentUser) {
      onSessionLoggedOut({ skipToast: true });
      return;
    }

    lastSessionUserId = currentUser.id || currentUser.username || null;
    syncAuthVisibility(true);
    const initialWs = parseHashWorkspace();
    activeWorkspace = Auth.canAccessWorkspace(initialWs) ? initialWs : 'dashboard';

    updateHeaderContext();
    updateDrawerNavAccess();
    switchWorkspace(activeWorkspace, { skipHashUpdate: !window.location.hash, instantScroll: true });
  }

  function showToast(message, type = 'success') {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.className = `fixed bottom-6 right-6 z-50 px-4 py-3 rounded shadow-xl text-white font-medium flex items-center gap-2 transition-all transform duration-300 ${
      type === 'error' ? 'bg-red-700' : (type === 'warning' ? 'bg-amber-700' : 'bg-[#064E3B]')
    }`;
    toastEl.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
    setTimeout(() => {
      toastEl.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
    }, 3500);
  }

  function setupNavigation() {
    document.querySelectorAll('[data-workspace]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = btn.getAttribute('data-workspace');
        if (!Auth.canAccessWorkspace(target)) {
          const user = Auth.getCurrentUser();
          showToast(`Akses Dibatasi: Peran ${CONFIG.ROLES[user.role]?.label || user.role} tidak berwenang membuka Ruang Kerja ${target.toUpperCase()}.`, 'error');
          return;
        }
        switchWorkspace(target);
        closeDrawer();
      });
    });
  }

  function switchWorkspace(workspaceId, opts = {}) {
    const user = Auth.getCurrentUser();
    if (!user) {
      onSessionLoggedOut({ skipToast: true });
      return;
    }
    if (!Auth.canAccessWorkspace(workspaceId)) {
      showToast(`Akses Ditolak: Peran ${CONFIG.ROLES[user.role]?.label || user.role} tidak berwenang membuka Ruang Kerja ${workspaceId.toUpperCase()}.`, 'error');
      return;
    }

    activeWorkspace = workspaceId;
    if (!opts.skipHashUpdate && window.location.hash !== `#${workspaceId}`) {
      try {
        window.location.hash = `#${workspaceId}`;
      } catch (e) {}
    }

    // Sembunyikan semua workspace
    document.querySelectorAll('.workspace-pane').forEach(el => el.classList.add('hidden'));

    // Tampilkan workspace aktif
    const activeEl = document.getElementById(`workspace-${workspaceId}`);
    if (activeEl) {
      activeEl.classList.remove('hidden');
    }

    // Perbarui gaya navigasi aktif di sidebar Slate Navy (#0F172A) + Deep Emerald (#064E3B)
    document.querySelectorAll('[data-workspace]').forEach(btn => {
      if (btn.getAttribute('data-workspace') === workspaceId) {
        btn.classList.add('bg-[#064E3B]', 'text-white', 'font-bold');
        btn.classList.remove('text-slate-200', 'hover:bg-slate-800');
      } else {
        btn.classList.remove('bg-[#064E3B]', 'text-white', 'font-bold');
        btn.classList.add('text-slate-200', 'hover:bg-slate-800');
      }
    });

    renderCurrentWorkspace();
    if (opts.instantScroll) {
      window.scrollTo(0, 0);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function updateDrawerNavAccess() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    let visibleCount = 0;

    document.querySelectorAll('[data-workspace]').forEach(btn => {
      const ws = btn.getAttribute('data-workspace');
      const isAllowed = Auth.canAccessWorkspace(ws);

      const oldLock = btn.querySelector('.workspace-lock-indicator');
      if (oldLock) oldLock.remove();

      if (isAllowed) {
        visibleCount++;
        btn.classList.remove('hidden', 'opacity-40', 'cursor-not-allowed');
        btn.removeAttribute('aria-disabled');
      } else {
        btn.classList.add('hidden');
        btn.classList.remove('bg-[#064E3B]', 'text-white', 'font-bold');
        btn.setAttribute('aria-disabled', 'true');
      }
    });

    const drawerTitleEl = document.getElementById('drawer-nav-title');
    if (drawerTitleEl) {
      const roleLabel = CONFIG.ROLES[user.role]?.label || user.role;
      if (user.role === 'superadmin') {
        drawerTitleEl.textContent = '10 Ruang Kerja (Akses Superadmin)';
      } else {
        drawerTitleEl.textContent = `${visibleCount} Ruang Kerja Mandat (${roleLabel})`;
      }
    }
  }

  function updateHeaderContext() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    const wilayahList = getWilayahOptionsSafe();
    const tenant = wilayahList.find(t => t.code === user.tenantId || t.id === user.tenantId) || wilayahList[0] || { name: 'DPP Pusat (Nasional)' };

    // Header Wilayah
    const topTenantEl = document.getElementById('header-current-tenant');
    if (topTenantEl) topTenantEl.textContent = tenant.name;

    // Kunci Tenant Switcher untuk DPW
    const lockIcon = document.getElementById('tenant-lock-icon');
    const lockInd = document.getElementById('tenant-lock-indicator');
    if (!user.isNationalExecutive) {
      if (lockIcon) lockIcon.textContent = 'lock';
      if (lockInd) lockInd.className = 'w-2 h-2 rounded-full bg-amber-600';
    } else {
      if (lockIcon) lockIcon.textContent = 'unfold_more';
      if (lockInd) lockInd.className = 'w-2 h-2 rounded-full bg-emerald-700';
    }

    // Header User
    const topUserRoleEl = document.getElementById('header-user-role');
    if (topUserRoleEl) topUserRoleEl.textContent = CONFIG.ROLES[user.role]?.label || user.role;

    const topUserNameEl = document.getElementById('header-user-name');
    if (topUserNameEl) topUserNameEl.textContent = user.fullName;

    // Drawer Profile
    const drawerUserNameEl = document.getElementById('drawer-user-name');
    if (drawerUserNameEl) drawerUserNameEl.textContent = user.fullName;

    const drawerUserRoleEl = document.getElementById('drawer-user-role');
    if (drawerUserRoleEl) drawerUserRoleEl.textContent = CONFIG.ROLES[user.role]?.label || user.role;

    // Read-Only Banner untuk Pembina / Pengawas
    const roBanner = document.getElementById('readonly-role-banner');
    const roText = document.getElementById('readonly-role-text');
    if (user.isPembinaReadOnly) {
      roBanner.classList.remove('hidden');
      roText.textContent = 'MODE DEWAN PEMBINA: EKSEKUTIF MAKRO & PENGAWASAN KEBIJAKAN (READ-ONLY)';
    } else if (user.isPengawasReadOnly) {
      roBanner.classList.remove('hidden');
      roText.textContent = 'MODE DEWAN PENGAWAS: FORENSIC AUDIT SYARIAH & REKONSILIASI KAS PSAK 409 (READ-ONLY)';
    } else {
      roBanner.classList.add('hidden');
    }
  }

  function onSessionChanged(session) {
    if (!session || !session.user) {
      onSessionLoggedOut({ skipToast: true });
      return;
    }

    const nextUserId = session.user.id || session.user.username || null;
    const isAccountSwitch = lastSessionUserId !== nextUserId;
    lastSessionUserId = nextUserId;

    syncAuthVisibility(true);
    clearLoginError();
    resetTransientUiState(session);

    updateHeaderContext();
    updateDrawerNavAccess();

    // Saat ganti akun/login baru, otomatis mulai bersih di Dashboard jabatan aktif tanpa jeda
    const targetWorkspace = isAccountSwitch || !Auth.canAccessWorkspace(activeWorkspace)
      ? 'dashboard'
      : activeWorkspace;

    switchWorkspace(targetWorkspace, { instantScroll: true, skipHashUpdate: false });
    const roleLabel = Auth.getRoleTitleByYurisdiksi
      ? Auth.getRoleTitleByYurisdiksi(session.user.role, session.user.tenantId, session.user.divisi)
      : (CONFIG.ROLES[session.user.role]?.label || session.user.role);
    showToast(`Login berhasil: ${session.user.fullName} (${roleLabel})`);
  }

  function onSessionLoggedOut(opts = {}) {
    lastSessionUserId = null;
    resetTransientUiState({ user: { tenantId: 'DPP_PUSAT' } });
    activeWorkspace = 'dashboard';

    try {
      if (window.location.hash) {
        window.history.replaceState({}, '', window.location.pathname + window.location.search);
      }
    } catch (e) {}

    clearLoginError();
    const pwdInput = document.getElementById('login-password');
    const userInput = document.getElementById('login-username');
    if (pwdInput) pwdInput.value = '';
    if (userInput) {
      userInput.value = '';
      if (!opts.skipFocus) {
        try { userInput.focus(); } catch (e) {}
      }
    }

    syncAuthVisibility(false);
    window.scrollTo(0, 0);

    if (!opts.skipToast) {
      showToast('Anda telah keluar dari Portal Pengurus. Silakan login kembali.', 'warning');
    }
  }

  function openDrawer() {
    if (drawer) drawer.classList.remove('-translate-x-full');
    if (backdrop) backdrop.classList.remove('hidden');
  }

  function closeDrawer() {
    if (drawer) drawer.classList.add('-translate-x-full');
    if (backdrop) backdrop.classList.add('hidden');
  }

  // =========================================================================
  // ROUTER WORKSPACES RENDERING
  // =========================================================================
  function renderCurrentWorkspace() {
    switch (activeWorkspace) {
      case 'dashboard':
        renderDashboard();
        break;
      case 'surat':
        renderSuratWorkspace();
        break;
      case 'disposisi':
        renderDisposisiWorkspace();
        break;
      case 'kas':
        renderKasWorkspace();
        break;
      case 'proker':
        renderProkerWorkspace();
        break;
      case 'keanggotaan':
        renderKeanggotaanWorkspace();
        break;
      case 'advokasi':
        renderAdvokasiWorkspace();
        break;
      case 'muallaf':
        renderMuallafWorkspace();
        break;
      case 'maktabah':
        renderMaktabahWorkspace();
        break;
      case 'sistem':
        renderSistemWorkspace();
        break;
    }
  }

  // =========================================================================
  // 1. DASHBOARD EKSEKUTIF & ACTION INBOX
  // =========================================================================
  function renderDashboard() {
    const db = State.getDb();
    const user = Auth.getCurrentUser();
    const tenantId = user.tenantId;
    const isDivRole = (user.role === 'ketua_divisi' || user.role === 'anggota_divisi') && !!user.divisi;

    // Filter data sesuai yurisdiksi tenant dan divisi
    const pendingSurat = db.surat.filter(s =>
      (s.status === 'AJUKAN' || s.status === 'PENDING_KETUA') &&
      isScopedRecordVisible(s.tenantId)
    );
    const pendingDisposisi = db.suratMasuk.filter(s => {
      if (!isScopedRecordVisible(s.tenantId, isDivRole ? s.targetDivisi : null)) return false;
      if (isDivRole) return s.statusDisposisi === 'IN_PROGRESS' && (!s.laporanPerDivisi || !s.laporanPerDivisi[user.divisi]);
      return s.statusDisposisi === 'PENDING_KETUA' || s.statusDisposisi === 'DRAFT_DISPOSISI';
    });
    const pendingKas = db.kas.transactions.filter(t =>
      t.statusApproval !== 'APPROVED' && isScopedRecordVisible(t.tenantId)
    );
    const pendingKta = db.anggota.filter(a =>
      a.status !== 'APPROVED' && isScopedRecordVisible(a.tenantId)
    );

    // Update Counter Urgent (Hanya hitung antrean ruang kerja mandat resmi pengguna)
    let urgentCount = 0;
    if (Auth.canAccessWorkspace('surat')) urgentCount += pendingSurat.length;
    if (Auth.canAccessWorkspace('disposisi')) urgentCount += pendingDisposisi.length;
    if (Auth.canAccessWorkspace('kas')) urgentCount += pendingKas.length;
    if (Auth.canAccessWorkspace('keanggotaan')) urgentCount += pendingKta.length;

    const badgeEl = document.getElementById('dash-urgent-count');
    if (badgeEl) badgeEl.textContent = urgentCount;

    // Toggle Tombol Tindakan Cepat di Hero Banner sesuai wewenang peran
    const btnDashSurat = document.getElementById('dash-btn-surat');
    if (btnDashSurat) {
      if (Auth.canAccessWorkspace('surat') && !Auth.isReadOnly()) {
        btnDashSurat.classList.remove('hidden');
        btnDashSurat.textContent = user.role === 'ketua' ? 'Pengesahan Surat' : '+ Buat Surat A4';
      } else {
        btnDashSurat.classList.add('hidden');
      }
    }

    const btnDashKas = document.getElementById('dash-btn-kas');
    if (btnDashKas) {
      if (Auth.canAccessWorkspace('kas')) {
        btnDashKas.classList.remove('hidden');
        btnDashKas.textContent = user.role === 'ketua' ? 'Otorisasi Kas Tahap 2' : 'Buka Kas Syar\'i';
      } else {
        btnDashKas.classList.add('hidden');
      }
    }

    // Render ALL 4 Action Inbox types
    const inboxContainer = document.getElementById('dashboard-action-inbox');
    if (inboxContainer) {
      let cardsHtml = '';

      if (pendingSurat.length > 0 && Auth.canAccessWorkspace('surat')) {
        cardsHtml += `
          <div class="p-4 rounded-lg bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">OTORISASI SURAT DINAS</span>
                <span class="text-xs font-mono text-slate-600">${pendingSurat[0].jenisSurat || 'DINAS'}</span>
              </div>
              <h3 class="font-bold text-sm text-slate-900">${pendingSurat[0].perihal}</h3>
              <p class="tabular-nums text-xs text-slate-600 font-mono mt-1">${pendingSurat[0].nomorSurat}</p>
            </div>
            <div class="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span class="tabular-nums text-xs font-semibold text-slate-600">${pendingSurat.length} Menunggu Pengesahan</span>
              <button type="button" onclick="App.switchWorkspace('surat')" class="text-xs font-bold text-emerald-900 hover:underline">Tinjau Surat &rarr;</button>
            </div>
          </div>
        `;
      }

      if (pendingDisposisi.length > 0 && Auth.canAccessWorkspace('disposisi')) {
        cardsHtml += `
          <div class="p-4 rounded-lg bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-900">URGENSI DISPOSISI</span>
                <span class="text-xs text-slate-600">${pendingDisposisi[0].tingkatUrgensi || 'Normal'}</span>
              </div>
              <h3 class="font-bold text-sm text-slate-900">${pendingDisposisi[0].asalSurat}</h3>
              <p class="text-xs text-slate-600 mt-1 line-clamp-2">${pendingDisposisi[0].perihal}</p>
            </div>
            <div class="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span class="tabular-nums text-xs font-semibold text-slate-600">${pendingDisposisi.length} Menunggu Arahan/Laporan</span>
              <button type="button" onclick="App.switchWorkspace('disposisi')" class="text-xs font-bold text-emerald-900 hover:underline">Buka Disposisi &rarr;</button>
            </div>
          </div>
        `;
      }

      if (pendingKas.length > 0 && Auth.canAccessWorkspace('kas')) {
        cardsHtml += `
          <div class="p-4 rounded-lg bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">DUAL-APPROVAL KAS</span>
                <span class="text-xs text-slate-600">${pendingKas[0].kantongSyariah}</span>
              </div>
              <h3 class="font-bold text-sm text-slate-900">${pendingKas[0].keterangan}</h3>
              <p class="tabular-nums text-xs text-emerald-800 font-extrabold mt-1">Rp ${Number(pendingKas[0].nominal || 0).toLocaleString('id-ID')}</p>
            </div>
            <div class="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-600">Status: ${pendingKas[0].statusApproval}</span>
              <button type="button" onclick="App.switchWorkspace('kas')" class="text-xs font-bold text-emerald-900 hover:underline">Verifikasi Kas &rarr;</button>
            </div>
          </div>
        `;
      }

      if (pendingKta.length > 0 && Auth.canAccessWorkspace('keanggotaan')) {
        cardsHtml += `
          <div class="p-4 rounded-lg bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">VERIFIKASI KTA</span>
                <span class="text-xs text-slate-600">Lisensi Tingkat ${pendingKta[0].tingkatLisensi}</span>
              </div>
              <h3 class="font-bold text-sm text-slate-900">${pendingKta[0].namaLengkap}</h3>
              <p class="text-xs text-slate-600 mt-1">${pendingKta[0].kota} &bull; Keahlian: ${pendingKta[0].keahlian}</p>
            </div>
            <div class="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span class="tabular-nums text-xs font-semibold text-slate-600">${pendingKta.length} Pendaftar Baru</span>
              <button type="button" onclick="App.switchWorkspace('keanggotaan')" class="text-xs font-bold text-emerald-900 hover:underline">Verifikasi &rarr;</button>
            </div>
          </div>
        `;
      }

      if (!cardsHtml) {
        cardsHtml = `
          <div class="col-span-3 p-6 text-center rounded-lg bg-white border border-slate-200">
            <span class="material-symbols-outlined text-emerald-700 text-[36px]">check_circle</span>
            <h4 class="font-bold text-sm text-slate-900 mt-2">Semua Tindakan Mandat Selesai</h4>
            <p class="text-xs text-slate-600">Tidak ada berkas yang membutuhkan persetujuan peran ${CONFIG.ROLES[user.role]?.label || user.role} saat ini.</p>
          </div>
        `;
      }

      inboxContainer.innerHTML = cardsHtml;
    }

    // Update Totals (tenant-isolated when !isNationalExecutive)
    const balances = db.kas.balances[tenantId] || db.kas.balances['DPP_PUSAT'] || {};
    const totalKas = (balances.AMIL_OPERASIONAL || 0) + (balances.ZAKAT || 0) + (balances.INFAQ_DAKWAH || 0) + (balances.WAKAF || 0);
    const totalKasEl = document.getElementById('dash-total-kas');
    if (totalKasEl) totalKasEl.textContent = 'Rp ' + totalKas.toLocaleString('id-ID');

    const scopedSuratCount = db.surat.filter(s => isScopedRecordVisible(s.tenantId)).length;
    const totalSuratEl = document.getElementById('dash-total-surat');
    if (totalSuratEl) totalSuratEl.textContent = scopedSuratCount + ' Naskah';

    const scopedAnggotaCount = db.anggota.filter(a => isScopedRecordVisible(a.tenantId)).length;
    const totalAnggotaEl = document.getElementById('dash-total-anggota');
    if (totalAnggotaEl) totalAnggotaEl.textContent = scopedAnggotaCount + ' Kader';

    // Dynamic Wilayah Counter
    const wilayahList = getWilayahOptionsSafe();
    const dpwList = wilayahList.filter(w => w.code !== 'DPP_PUSAT' && w.id !== 'DPP_PUSAT');
    const totalWilayahEl = document.getElementById('dash-total-wilayah');
    const wilayahCaptionEl = document.getElementById('dash-wilayah-caption');
    if (totalWilayahEl) totalWilayahEl.textContent = `${dpwList.length} DPW`;
    if (wilayahCaptionEl) {
      wilayahCaptionEl.textContent = dpwList.length > 0
        ? dpwList.map(w => w.name).slice(0, 2).join(', ')
        : 'DPP Pusat (Nasional)';
    }

    // Superadmin Governance Summary (Drive Quota & Deadlock Queue)
    const saSummaryEl = document.getElementById('dash-superadmin-summary');
    if (saSummaryEl) {
      if (user.role === 'superadmin') {
        const driveUsed = db.driveQuota ? Number(db.driveQuota.usedGb || 0) : 4.2;
        const driveMax = db.driveQuota ? Number(db.driveQuota.totalGb || 15) : 15;
        const drivePct = Math.min(100, Math.round((driveUsed / driveMax) * 100));
        const deadlockTotal = pendingSurat.length + pendingDisposisi.length + pendingKas.length + pendingKta.length;
        saSummaryEl.classList.remove('hidden');
        saSummaryEl.innerHTML = `
          <div class="p-4 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-4">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-600">Google Drive Vault Quota</span>
              <h4 class="tabular-nums font-display font-bold text-base text-slate-900 mt-0.5">${driveUsed} GB / ${driveMax} GB (${drivePct}%)</h4>
              <p class="text-[11px] ${drivePct >= 80 ? 'text-red-700 font-bold' : 'text-slate-600'} mt-0.5">
                ${drivePct >= 90 ? 'Kritis (>= 90%): Segera arsipkan atau bersihkan Recycle Bin!' : (drivePct >= 80 ? 'Peringatan (>= 80%): Mendekati batas kapasitas.' : 'Kapasitas Vault Nasional dalam batas aman.')}
              </p>
            </div>
            <button type="button" onclick="App.switchWorkspace('sistem'); App.switchSistemSubTab('drive');" class="min-h-[44px] px-3 py-2 rounded bg-slate-900 text-white text-xs font-bold shrink-0">Buka Vault</button>
          </div>
          <div class="p-4 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-4">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-600">Antrean Deadlock Breaker</span>
              <h4 class="tabular-nums font-display font-bold text-base text-slate-900 mt-0.5">${deadlockTotal} Berkas Tertunda</h4>
              <p class="text-[11px] text-slate-600 mt-0.5">Hak prerogatif pengambilalihan darurat Superadmin Nasional.</p>
            </div>
            <button type="button" onclick="App.switchWorkspace('sistem'); App.switchSistemSubTab('deadlock');" class="min-h-[44px] px-3 py-2 rounded bg-amber-800 text-white text-xs font-bold shrink-0">Panel Deadlock</button>
          </div>
        `;
      } else {
        saSummaryEl.classList.add('hidden');
        saSummaryEl.innerHTML = '';
      }
    }
  }

  // =========================================================================
  // 2. PERSURATAN DINAS, BUILDER NASKAH A4 & LIVE A4 COMPOSER
  // =========================================================================
  function buildA4DocumentHtml(data = {}, tenantScope = 'DPP_PUSAT', overrideSettings = null) {
    const db = State.getDb();
    const scope = tenantScope || data?.tenantId || (db.settings && db.settings.activeSettingsScope) || 'DPP_PUSAT';
    let cfg = Object.assign({}, State.getTenantSettings(scope) || {});
    if (overrideSettings && typeof overrideSettings === 'object') {
      cfg = Object.assign(cfg, overrideSettings);
    }

    // Font typography classes & styles
    const fontClass = cfg.fontFamily === 'arial' ? 'font-arial' :
                      cfg.fontFamily === 'calibri' ? 'font-calibri' :
                      cfg.fontFamily === 'amiri' ? 'font-amiri' : 'font-times';
    const fontSizeStyle = cfg.fontSize ? `font-size: ${cfg.fontSize};` : 'font-size: 12pt;';
    const lineSpacingStyle = cfg.lineSpacing ? `line-height: ${cfg.lineSpacing};` : 'line-height: 1.25;';

    // Logo settings
    const logoUrl = cfg.logoUrl || './logo_apii.png';
    const logoSecondaryUrl = cfg.logoSecondaryUrl || './logo_apii.png';
    const logoSize = Number(cfg.logoSize) || 76;
    const logoLayout = cfg.logoLayout || 'left';

    // KOP texts
    const kopBaris1 = cfg.kopBaris1 || 'YAYASAN APOLOGET ISLAM INDONESIA (APII)';
    const kopBaris2 = cfg.kopBaris2 || (scope === 'DPP_PUSAT' ? 'DEWAN PENGURUS PUSAT' : 'DEWAN PENGURUS WILAYAH');
    const kopBaris3 = cfg.kopBaris3 || 'SK KEMENKUMHAM RI NO. AHU-0014970.AH.01.04.TAHUN 2023';
    const kopAlamat = cfg.kopAlamat || 'Gedung Pusat Dakwah APII, Jl. Kramat Raya No. 45, Senen, Jakarta Pusat 10450';
    const kopTelepon = cfg.kopTelepon || '+62 813-5857-5678';
    const kopEmail = cfg.kopEmail || 'sekretariat@apologetislamindonesia.or.id';
    const kopWebsite = cfg.kopWebsite ? ` | Web: ${cfg.kopWebsite}` : '';

    // KOP Divider
    let dividerHtml = '';
    switch (cfg.kopDivider) {
      case 'single_emerald':
        dividerHtml = '<div class="border-b-[3px] border-emerald-800 pb-1 mb-4"></div>';
        break;
      case 'classic_gold':
        dividerHtml = '<div class="border-b-2 border-amber-600 pb-1 mb-0.5"></div><div class="h-1 bg-amber-700 mb-4"></div>';
        break;
      case 'thick_simple':
        dividerHtml = '<div class="border-b-4 border-black pb-1 mb-4"></div>';
        break;
      case 'double_black':
      default:
        dividerHtml = '<div class="border-b-2 border-black pb-1 mb-0.5"></div><div class="h-0.5 bg-black mb-4"></div>';
        break;
    }

    // Header KOP Layout HTML
    let headerKopHtml = '';
    if (logoLayout === 'center') {
      headerKopHtml = `
        <div class="a4-kop-row flex flex-col items-center text-center pb-2">
          <div class="a4-kop-logo mb-2 shrink-0">
            <img src="${logoUrl}" alt="Logo APII" style="width: ${logoSize}px; height: ${logoSize}px;" class="object-contain"/>
          </div>
          <div class="a4-kop-text w-full">
            <h3 id="a4-kop-title" class="a4-kop-title-dept font-extrabold text-base tracking-wide uppercase leading-tight">${kopBaris2}</h3>
            <h2 class="a4-kop-title-org font-extrabold text-xl tracking-tight text-emerald-950 uppercase leading-tight">${kopBaris1}</h2>
            <p class="text-[10px] font-bold mt-0.5">${kopBaris3}</p>
            <p id="a4-kop-address" class="text-[9px] text-gray-700 leading-tight mt-1">${kopAlamat}</p>
            <p id="a4-kop-contact" class="text-[9px] text-gray-700 leading-tight">Telp/WA: ${kopTelepon} | Email: ${kopEmail}${kopWebsite}</p>
          </div>
        </div>
      `;
    } else if (logoLayout === 'dual') {
      headerKopHtml = `
        <div class="a4-kop-row a4-kop-dual flex items-center gap-4 pb-2">
          <div class="a4-kop-logo a4-kop-logo-left bg-white p-1 rounded-lg shrink-0">
            <img src="${logoUrl}" alt="Logo Kiri" style="width: ${logoSize}px; height: ${logoSize}px;" class="object-contain"/>
          </div>
          <div class="a4-kop-text flex-1 text-center">
            <h3 id="a4-kop-title" class="a4-kop-title-dept font-extrabold text-base tracking-wide uppercase leading-tight">${kopBaris2}</h3>
            <h2 class="a4-kop-title-org font-extrabold text-xl tracking-tight text-emerald-950 uppercase leading-tight">${kopBaris1}</h2>
            <p class="text-[10px] font-bold mt-0.5">${kopBaris3}</p>
            <p id="a4-kop-address" class="text-[9px] text-gray-700 leading-tight mt-1">${kopAlamat}</p>
            <p id="a4-kop-contact" class="text-[9px] text-gray-700 leading-tight">Telp/WA: ${kopTelepon} | Email: ${kopEmail}${kopWebsite}</p>
          </div>
          <div class="a4-kop-logo a4-kop-logo-right bg-white p-1 rounded-lg shrink-0">
            <img src="${logoSecondaryUrl}" alt="Logo Kanan" style="width: ${logoSize}px; height: ${logoSize}px;" class="object-contain"/>
          </div>
        </div>
      `;
    } else if (logoLayout === 'right') {
      headerKopHtml = `
        <div class="a4-kop-row flex items-center gap-4 pb-2">
          <div class="a4-kop-text flex-1 text-center">
            <h3 id="a4-kop-title" class="a4-kop-title-dept font-extrabold text-base tracking-wide uppercase leading-tight">${kopBaris2}</h3>
            <h2 class="a4-kop-title-org font-extrabold text-xl tracking-tight text-emerald-950 uppercase leading-tight">${kopBaris1}</h2>
            <p class="text-[10px] font-bold mt-0.5">${kopBaris3}</p>
            <p id="a4-kop-address" class="text-[9px] text-gray-700 leading-tight mt-1">${kopAlamat}</p>
            <p id="a4-kop-contact" class="text-[9px] text-gray-700 leading-tight">Telp/WA: ${kopTelepon} | Email: ${kopEmail}${kopWebsite}</p>
          </div>
          <div class="a4-kop-logo bg-white p-1 rounded-lg shrink-0">
            <img src="${logoUrl}" alt="Logo APII" style="width: ${logoSize}px; height: ${logoSize}px;" class="object-contain"/>
          </div>
        </div>
      `;
    } else {
      // Default 'left'
      headerKopHtml = `
        <div class="a4-kop-row flex items-center gap-4 pb-2">
          <div class="a4-kop-logo bg-white p-1 rounded-lg shrink-0">
            <img src="${logoUrl}" alt="Logo APII" style="width: ${logoSize}px; height: ${logoSize}px;" class="object-contain"/>
          </div>
          <div class="a4-kop-text flex-1 text-center">
            <h3 id="a4-kop-title" class="a4-kop-title-dept font-extrabold text-base tracking-wide uppercase leading-tight">${kopBaris2}</h3>
            <h2 class="a4-kop-title-org font-extrabold text-xl tracking-tight text-emerald-950 uppercase leading-tight">${kopBaris1}</h2>
            <p class="text-[10px] font-bold mt-0.5">${kopBaris3}</p>
            <p id="a4-kop-address" class="text-[9px] text-gray-700 leading-tight mt-1">${kopAlamat}</p>
            <p id="a4-kop-contact" class="text-[9px] text-gray-700 leading-tight">Telp/WA: ${kopTelepon} | Email: ${kopEmail}${kopWebsite}</p>
          </div>
        </div>
      `;
    }

    // Tanggal & Tempat
    const kotaSurat = cfg.kotaSurat || 'Jakarta';
    const tglMasehi = data?.tanggalMasehi || `${kotaSurat}, ${formatTanggal()} M`;
    const tglHijriah = (cfg.showHijriDate !== false)
      ? `<p id="a4-preview-tgl-hijriah" class="italic text-gray-600">${data?.tanggalHijriah || State.getHijriDate()}</p>`
      : '';

    // Data fields
    const nomorSurat = data?.nomorSurat || '001/SM-DPP-APII/XI/2026';
    const lampiran = data?.lampiran || '-';
    const perihal = data?.perihal || 'Naskah Surat Dinas Resmi';
    const tujuan = data?.tujuan || 'Yth. Seluruh Jajaran Pengurus APII';
    const rawIsi = data?.isiSurat || data?.isi || 'Dengan memohon rahmat dan ridho Allah Subhanahu wa Ta’ala, bersama surat ini kami sampaikan arahan serta instruksi dinas demi tertib administrasi dakwah berkeadaban.';
    const isiFormatted = rawIsi.replace(/\n/g, '<br/>');
    const hashRaw = data?.hashSha256 || ('SHA256: ' + State.computeSha256(nomorSurat + perihal + rawIsi).substring(0, 24) + '...');
    const hash = hashRaw.startsWith('SHA256:') ? hashRaw : 'SHA256: ' + hashRaw;

    // Basmalah
    const bismillahHtml = (cfg.showBismillah !== false) ? `
      <div class="a4-bismillah text-center font-arabic text-xl my-4 text-emerald-950 select-none">
        بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
      </div>
    ` : '';

    // Tanda Tangan & Stempel
    const isDual = cfg.modelTtd !== 'single';
    const ketuaNama = cfg.ketuaNama || cfg.ketuaUmum || 'Ust. H. Ahmad Fauzi, Lc., M.A.';
    const ketuaJabatan = cfg.ketuaJabatan || (scope === 'DPP_PUSAT' ? 'Ketua Umum DPP' : 'Ketua DPW');
    const ketuaNia = cfg.ketuaNia || 'APII-PUSAT-2026-00001';

    const sekNama = cfg.sekretarisNama || cfg.sekretarisJenderal || 'Ust. M. Ridwan, S.Pd.I.';
    const sekJabatan = cfg.sekretarisJabatan || (scope === 'DPP_PUSAT' ? 'Sekretaris Umum DPP' : 'Sekretaris DPW');
    const sekNia = cfg.sekretarisNia || 'APII-PUSAT-2026-00002';

    // Visual TTD Ketua (Upload File Gambar vs Spesimen Digital)
    const isApprovedDoc = data?.status === 'APPROVED';
    const curUser = Auth.getCurrentUser() || {};
    const wmText = `${curUser.fullName || 'PENGURUS'} - ${curUser.id || curUser.username || 'ID'} - ${formatWaktu()} - RAHASIA APII`;
    const watermarkHtml = `
      <div class="watermark-diagonal-overlay" data-approved="${isApprovedDoc ? 'true' : 'false'}" aria-hidden="true">
        ${Array.from({ length: 6 }, () => `<div class="watermark-diagonal-line">${wmText} &bull; ${wmText}</div>`).join('')}
      </div>
    `;
    let ttdKetuaVisual = '';
    if (cfg.ketuaTtdMode === 'upload' && cfg.ketuaTtdUrl) {
      const h = Number(cfg.ketuaTtdSize) || 64;
      ttdKetuaVisual = `<img src="${cfg.ketuaTtdUrl}" alt="TTD Ketua" style="height: ${h}px; max-width: 170px;" class="a4-ttd-img object-contain mx-auto mix-blend-multiply select-none" />`;
    } else if (cfg.spesimenTtdType === 'qr_tte') {
      ttdKetuaVisual = `
        <div class="flex flex-col items-center">
          <span class="material-symbols-outlined text-[32px] text-emerald-800">qr_code_2</span>
          <span class="text-[8px] font-mono text-emerald-900 font-bold">TTE KETUA RESMI</span>
        </div>`;
    } else if (cfg.spesimenTtdType === 'kombinasi') {
      ttdKetuaVisual = `
        <div class="flex items-center justify-center gap-1">
          <span class="text-[10px] text-emerald-800 font-bold italic font-serif">${ketuaNama.split(',')[0]}</span>
          <span class="material-symbols-outlined text-[18px] text-emerald-700">verified_user</span>
        </div>`;
    } else {
      ttdKetuaVisual = '<span class="text-[10px] text-emerald-800 font-bold italic">[Tanda Tangan Elektronik]</span>';
    }

    // Visual TTD Sekretaris (Upload File Gambar vs Spesimen Digital)
    let ttdSekVisual = '';
    if (cfg.sekretarisTtdMode === 'upload' && cfg.sekretarisTtdUrl) {
      const h = Number(cfg.sekretarisTtdSize) || 64;
      ttdSekVisual = `<img src="${cfg.sekretarisTtdUrl}" alt="TTD Sekretaris" style="height: ${h}px; max-width: 170px;" class="a4-ttd-img object-contain mx-auto mix-blend-multiply select-none" />`;
    } else if (cfg.spesimenTtdType === 'qr_tte') {
      ttdSekVisual = `
        <div class="flex flex-col items-center">
          <span class="material-symbols-outlined text-[32px] text-emerald-800">qr_code_2</span>
          <span class="text-[8px] font-mono text-emerald-900 font-bold">TTE SEKRETARIS</span>
        </div>`;
    } else if (cfg.spesimenTtdType === 'kombinasi') {
      ttdSekVisual = `
        <div class="flex items-center justify-center gap-1">
          <span class="text-[10px] text-emerald-800 font-bold italic font-serif">${sekNama.split(',')[0]}</span>
          <span class="material-symbols-outlined text-[18px] text-emerald-700">verified</span>
        </div>`;
    } else {
      ttdSekVisual = '<span class="text-[10px] text-emerald-800 font-bold italic">[Paraf Digital]</span>';
    }

    // Stempel Digital Basah (Upload File Gambar vs Vektor APII)
    let stempelHtml = '';
    if (cfg.stempelAktif !== false) {
      const stempelColor = cfg.stempelWarna || '#065f46';
      const rotasi = cfg.stempelRotasi !== undefined ? Number(cfg.stempelRotasi) : -12;
      const size = Number(cfg.stempelSize) || 112;
      const opacity = (cfg.stempelOpacity !== undefined ? Number(cfg.stempelOpacity) : 85) / 100;
      const teksLuar = cfg.stempelTeksLuar || 'YAYASAN APOLOGET ISLAM INDONESIA';
      const teksDalam = cfg.stempelTeksDalam || (scope === 'DPP_PUSAT' ? 'DEWAN PENGURUS PUSAT' : 'DEWAN PENGURUS WILAYAH');

      let posStyle = '';
      if (cfg.stempelPosisi === 'center') {
        posStyle = `left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(${rotasi}deg);`;
      } else if (cfg.stempelPosisi === 'beside') {
        posStyle = `left: -70px; top: 0px; transform: rotate(${rotasi}deg);`;
      } else {
        // 'overlap_left' or 'custom'
        const offX = cfg.stempelOffsetX !== undefined ? Number(cfg.stempelOffsetX) : -24;
        const offY = cfg.stempelOffsetY !== undefined ? Number(cfg.stempelOffsetY) : 8;
        posStyle = `left: ${offX}px; top: ${offY}px; transform: rotate(${rotasi}deg);`;
      }

      if (cfg.stempelMode === 'upload' && cfg.stempelUrl) {
        stempelHtml = `
          <div class="a4-stempel-wrap absolute pointer-events-none mix-blend-multiply flex items-center justify-center select-none" style="--stamp-rot: ${rotasi}deg; width: ${size}px; height: ${size}px; opacity: ${opacity}; ${posStyle}">
            <img src="${cfg.stempelUrl}" alt="Stempel Basah Ormas" class="w-full h-full object-contain pointer-events-none" />
          </div>
        `;
      } else {
        stempelHtml = `
          <div class="a4-stempel-wrap absolute pointer-events-none mix-blend-multiply flex items-center justify-center select-none" style="--stamp-rot: ${rotasi}deg; width: ${size}px; height: ${size}px; opacity: ${opacity}; ${posStyle}">
            <div class="a4-stempel-circle w-full h-full rounded-full border-4 border-dashed flex flex-col items-center justify-center p-2 text-center font-extrabold text-[9px] leading-tight" style="border-color: ${stempelColor}; color: ${stempelColor};">
              <span class="text-[8px] tracking-wider uppercase">${teksLuar}</span>
              <div class="a4-stempel-line w-16 h-[1px] my-1" style="background-color: ${stempelColor};"></div>
              <span class="text-[9px] font-black uppercase">${teksDalam}</span>
              <span class="text-[7px] mt-0.5 font-bold tracking-widest">★ DISAHKAN ★</span>
            </div>
          </div>
        `;
      }
    }

    let signatureSectionHtml = '';
    if (isDual) {
      signatureSectionHtml = `
        <div class="a4-sign-grid grid grid-cols-2 gap-4 text-xs mt-10 relative">
          <div class="a4-sign-card text-center">
            <p>${sekJabatan},</p>
            <div class="a4-sign-box h-20 flex items-center justify-center">
              ${ttdSekVisual}
            </div>
            <p class="font-bold underline">${sekNama}</p>
            <p class="text-[10px] text-gray-600">NIA: ${sekNia}</p>
          </div>

          <div class="a4-sign-card text-center relative">
            <p>${ketuaJabatan},</p>
            ${stempelHtml}
            <div class="a4-sign-box h-20 flex items-center justify-center">
              ${ttdKetuaVisual}
            </div>
            <p class="font-bold underline">${ketuaNama}</p>
            <p class="text-[10px] text-gray-600">NIA: ${ketuaNia}</p>
          </div>
        </div>
      `;
    } else {
      // Single Signature
      signatureSectionHtml = `
        <div class="a4-sign-single flex justify-end text-xs mt-10 relative">
          <div class="a4-sign-card w-64 text-center relative">
            <p>${ketuaJabatan},</p>
            ${stempelHtml}
            <div class="a4-sign-box h-20 flex items-center justify-center">
              ${ttdKetuaVisual}
            </div>
            <p class="font-bold underline">${ketuaNama}</p>
            <p class="text-[10px] text-gray-600">NIA: ${ketuaNia}</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="a4-doc-root ${fontClass} text-black relative" style="${fontSizeStyle} ${lineSpacingStyle}">
        ${watermarkHtml}
        <div class="relative z-10">
        ${headerKopHtml}
        ${dividerHtml}

        <!-- Tanggal Surat -->
        <div class="text-right text-xs mb-4">
          <p id="a4-preview-tgl-masehi">${tglMasehi}</p>
          ${tglHijriah}
        </div>

        <!-- Nomor & Perihal Block -->
        <table class="a4-meta-table w-full text-xs mb-4">
          <tr>
            <td class="w-20 font-bold">Nomor</td>
            <td class="w-4">:</td>
            <td id="a4-preview-nomor" class="font-mono font-bold text-emerald-900">${nomorSurat}</td>
          </tr>
          <tr>
            <td class="font-bold">Lampiran</td>
            <td>:</td>
            <td id="a4-preview-lampiran">${lampiran}</td>
          </tr>
          <tr>
            <td class="font-bold">Perihal</td>
            <td>:</td>
            <td id="a4-preview-perihal" class="font-bold">${perihal}</td>
          </tr>
        </table>

        <!-- Kepada Yth -->
        <div class="text-xs mb-4">
          <p>Kepada Yang Terhormat,</p>
          <p id="a4-preview-tujuan" class="font-bold">${tujuan}</p>
          <p>di Tempat</p>
        </div>

        <!-- Bismillah Arabic -->
        ${bismillahHtml}

        <!-- Isi Surat -->
        <div id="a4-preview-isi" class="text-xs text-justify leading-relaxed mb-6">
          ${isiFormatted}
        </div>

        <!-- TTD & Stempel Block -->
        ${signatureSectionHtml}

        <!-- Security Hash Footer -->
        <div class="a4-footer-hash mt-10 pt-3 border-t border-gray-300 flex items-center justify-between text-[9px] text-gray-500">
          <span>Keaslian naskah dapat dicek di: <strong>siap.apologetislamindonesia.or.id/verifikasi</strong></span>
          <span id="a4-preview-hash" class="font-mono">${hash}</span>
        </div>
        </div>
      </div>
    `;
  }

  function setupA4Composer() {
    const inputPerihal = document.getElementById('composer-perihal');
    const inputTujuan = document.getElementById('composer-tujuan');
    const inputLampiran = document.getElementById('composer-lampiran');
    const inputIsi = document.getElementById('composer-isi');
    const selectKop = document.getElementById('composer-kop');
    const selectJenis = document.getElementById('composer-jenis');
    const selectTemplateQuick = document.getElementById('composer-template-quick');
    const composerNomorDisplay = document.getElementById('composer-nomor-display');
    const btnSubmit = document.getElementById('btn-submit-surat');

    const templates = {
      SM_DIALOG: {
        jenis: 'SM',
        perihal: 'Surat Mandat Delegasi Dialog Teologi & Kristologi Nasional 2026',
        tujuan: 'Ust. Dani Ramadhan, M.Ag. (Kadiv Litbang APII)',
        lampiran: '1 Berkas Kerangka Acuan Kerja (TOR)',
        isi: 'Memberikan mandat penuh kepada nama yang tertera di atas untuk mewakili Dewan Pengurus Pusat Yayasan Apologet Islam Indonesia dalam forum Dialog Teologi dan Kristologi Komparatif Nasional 2026 yang diselenggarakan di Jakarta Islamic Centre.\n\nDemikian surat mandat ini diberikan agar dapat dilaksanakan dengan penuh amanah, tanggung jawab keilmuan, dan menjunjung tinggi AD/ART APII.'
      },
      SK_PANITIA: {
        jenis: 'SK',
        perihal: 'Surat Keputusan Penetapan Panitia Musyawarah Kerja Nasional APII 2026',
        tujuan: 'Seluruh Panitia Pelaksana Mukernas APII 2026',
        lampiran: '1 Lembar Susunan Kepanitiaan',
        isi: 'Menimbang perlunya kelancaran operasional konsolidasi dakwah apologetika nasional, memutuskan menetapkan susunan panitia pelaksana Mukernas APII 2026 sebagaimana terlampir dalam keputusan ini.\n\nKeputusan ini berlaku sejak tanggal ditetapkan hingga selesainya laporan pertanggungjawaban (LPJ) kegiatan.'
      },
      UND_SILATURAHMI: {
        jenis: 'UND',
        perihal: 'Undangan Silaturahmi Akbar dan Pembinaan Muallaf se-Jabodetabek',
        tujuan: 'Seluruh Pembina & Relawan Muallaf APII Jabodetabek',
        lampiran: 'Susunan Acara & Lokasi',
        isi: 'Mengharap kehadiran seluruh pembina, kader, dan relawan dakwah dalam rangka Silaturahmi Akbar dan Pembinaan Muallaf yang insya Allah akan dilaksanakan pada:\n\nHari/Tanggal: Ahad, 15 November 2026\nWaktu: Pukul 09.00 WIB s.d. Selesai\nTempat: Aula Masjid Al-Ikhlas APII Center\n\nMengingat pentingnya agenda ini demi penguatan akidah saudara kita, dimohon hadir tepat waktu.'
      },
      SE_RAMADHAN: {
        jenis: 'SE',
        perihal: 'Surat Edaran Panduan Syiar Dakwah & Kesiapsiagaan Tabayyun Ramadhan 1448 H',
        tujuan: 'Seluruh Pengurus Wilayah (DPW) dan Divisi Kerja APII',
        lampiran: 'Panduan Operasional Dakwah',
        isi: 'Dalam rangka menyambut bulan suci Ramadhan 1448 H, Dewan Pengurus Pusat Yayasan APII menginstruksikan seluruh jajaran pengurus wilayah untuk:\n1. Mengintensifkan kajian literasi kristologi komparatif berbasis akhlak karimah.\n2. Mengawal shelter pembinaan muallaf dan memastikan ketersediaan paket santunan.\n3. Memperkuat tim siber dalam merespons disinformasi teologi di media sosial secara tabayyun dan beradab.'
      },
      ST_ADVOKASI: {
        jenis: 'ST',
        perihal: 'Surat Tugas Pendampingan Hukum & Advokasi Keumatan LBH APII',
        tujuan: 'Adv. M. Rizqi, S.H. & Tim Advokasi Divisi Hukum APII',
        lampiran: '1 Berkas Kronologi Perkara',
        isi: 'Menugaskan secara resmi nama tertera di atas untuk memberikan bantuan konsultasi dan pendampingan hukum advokasi perlindungan hak kebebasan beragama bagi saudara muallaf binaan APII.\n\nSurat tugas ini berlaku efektif selama proses pendampingan berjalan hingga perkara terselesaikan secara berkepastian hukum.'
      },
      SR_REKOMENDASI: {
        jenis: 'SR',
        perihal: 'Surat Rekomendasi Pendaftaran Dai & Asatidz Binaan Tetap APII',
        tujuan: 'Badan Koordinasi Dakwah Islam (BKDI)',
        lampiran: '1 Berkas Portofolio Dakwah',
        isi: 'Dewan Pengurus Pusat Yayasan APII dengan ini memberikan rekomendasi kredibel kepada asatidz yang bersangkutan sebagai Dai Pembina Muallaf resmi binaan APII yang telah lulus sertifikasi kristologi dasar dan metodologi dialog damai.'
      }
    };

    function syncPreview() {
      const perihal = inputPerihal?.value || 'Surat Mandat Delegasi Dialog Teologi';
      const tujuan = inputTujuan?.value || 'Ust. Dani Ramadhan, M.Ag.';
      const lampiran = inputLampiran?.value || '1 Berkas TOR';
      const isi = inputIsi?.value || 'Memberikan mandat penuh kepada nama tertera di atas untuk mewakili Dewan Pengurus Pusat Yayasan Apologet Islam Indonesia dalam forum Dialog Teologi dan Kristologi Komparatif Nasional 2026 di Jakarta Islamic Centre.';
      const kop = selectKop?.value || 'DPP';
      const jenis = selectJenis?.value || 'SM';

      const user = Auth.getCurrentUser();
      const targetTenant = (kop === 'DPP') ? 'DPP_PUSAT' : (user?.tenantId || 'DPW_JABO');
      const nomorGen = State.generateNextNomorSurat(jenis, targetTenant);
      if (composerNomorDisplay) composerNomorDisplay.textContent = nomorGen;

      const printableSheet = document.getElementById('printable-a4-sheet');
      if (printableSheet) {
        printableSheet.innerHTML = buildA4DocumentHtml({
          nomorSurat: nomorGen,
          perihal: perihal,
          tujuan: tujuan,
          lampiran: lampiran,
          isiSurat: isi,
          tanggalHijriah: State.getHijriDate(),
          hashSha256: State.computeSha256(nomorGen + perihal + isi)
        }, targetTenant);
      }
    }

    if (selectTemplateQuick && !selectTemplateQuick._hasListener) {
      selectTemplateQuick.addEventListener('change', () => {
        const key = selectTemplateQuick.value;
        if (templates[key]) {
          const t = templates[key];
          if (selectJenis) selectJenis.value = t.jenis;
          if (inputPerihal) inputPerihal.value = t.perihal;
          if (inputTujuan) inputTujuan.value = t.tujuan;
          if (inputLampiran) inputLampiran.value = t.lampiran;
          if (inputIsi) inputIsi.value = t.isi;
          syncPreview();
          showToast('Template naskah dinas berhasil diterapkan!');
        }
      });
      selectTemplateQuick._hasListener = true;
    }

    inputPerihal?.addEventListener('input', syncPreview);
    inputTujuan?.addEventListener('input', syncPreview);
    inputLampiran?.addEventListener('input', syncPreview);
    inputIsi?.addEventListener('input', syncPreview);
    selectKop?.addEventListener('change', syncPreview);
    selectJenis?.addEventListener('change', syncPreview);

    if (btnSubmit && !btnSubmit._hasListener) {
      btnSubmit.addEventListener('click', () => {
        submitSuratComposer();
      });
      btnSubmit._hasListener = true;
    }

    if (Auth.isAuthenticated()) {
      syncPreview();
    }
  }

  let editingSuratId = null;

  function submitSuratComposer() {
    const user = Auth.getCurrentUser();
    if (!Auth.hasPermission('surat:compose')) {
      showToast('Akses ditolak: Hanya Sekretaris Umum / DPW yang berwenang menyusun dan mengajukan naskah surat dinas.', 'error');
      return;
    }

    const perihal = document.getElementById('composer-perihal')?.value?.trim();
    const tujuan = document.getElementById('composer-tujuan')?.value?.trim();
    const isi = document.getElementById('composer-isi')?.value?.trim();
    const jenis = document.getElementById('composer-jenis')?.value || 'SM';
    const lampiran = document.getElementById('composer-lampiran')?.value || '-';
    const selectKop = document.getElementById('composer-kop');
    const targetTenant = (selectKop?.value === 'DPP') ? 'DPP_PUSAT' : (user.tenantId || 'DPW_JABO');

    if (!perihal || !tujuan || !isi) {
      showToast('Harap lengkapi perihal, tujuan, dan isi naskah surat.', 'error');
      return;
    }

    const db = State.getDb();
    let submittedSurat = null;

    if (editingSuratId) {
      const existing = db.surat.find(s => s.id === editingSuratId);
      if (existing) {
        existing.perihal = perihal;
        existing.tujuan = tujuan;
        existing.lampiran = lampiran;
        existing.isiSurat = isi;
        existing.status = 'AJUKAN';
        existing.statusSignature = 'PENDING_KETUA';
        existing.signedBy = 'Diajukan ulang oleh ' + user.fullName;
        existing.catatanRevisi = '';
        existing.hashSha256 = State.computeSha256(existing.nomorSurat + perihal + isi);
        submittedSurat = existing;
      }
      editingSuratId = null;
    }

    if (!submittedSurat) {
      const nomorSurat = State.generateNextNomorSurat(jenis, targetTenant);
      const hash = State.computeSha256(nomorSurat + perihal + isi);

      submittedSurat = {
        id: 'SRT-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
        tenantId: targetTenant,
        nomorSurat: nomorSurat,
        tipe: jenis,
        kodePerihal: jenis,
        perihal: perihal,
        tujuan: tujuan,
        tanggalMasehi: formatTanggal(),
        tanggalHijriah: State.getHijriDate(),
        klasifikasi: 'Penting',
        tingkatKeamanan: 'Biasa',
        lampiran: lampiran,
        isiSurat: isi,
        status: 'AJUKAN',
        statusSignature: 'PENDING_KETUA',
        signedBy: 'Diajukan oleh ' + user.fullName,
        signedAt: null,
        hashSha256: hash,
        pdfDriveUrl: '#',
        createdBy: user.fullName
      };
      db.surat.unshift(submittedSurat);
    }

    State.saveDatabase();
    State.logAudit('SUBMIT_SURAT', 'Surat', submittedSurat.id, { nomor: submittedSurat.nomorSurat, perihal: perihal });
    syncApiSafe('saveSurat', submittedSurat);

    showToast(`Surat dinas ${submittedSurat.nomorSurat} berhasil diajukan! Menunggu pengesahan Ketua.`);
    renderSuratWorkspace();
    setupA4Composer();

    // Trigger Smart WhatsApp Relay Modal ke Ketua via Auth.resolveOfficerContact
    const targetPejabat = resolveOfficerSafe('ketua', targetTenant);

    const msg = `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n` +
      `*NOTIFIKASI ESTAFET SURAT DINAS MASUK*\n\n` +
      `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
      `Yth. ${targetPejabat.name} (${targetPejabat.roleLabel})\n\n` +
      `Naskah dinas baru telah diajukan dan membutuhkan persetujuan / tanda tangan elektronik Anda:\n` +
      `• *Nomor Surat:* ${submittedSurat.nomorSurat}\n` +
      `• *Perihal:* ${submittedSurat.perihal}\n` +
      `• *Tujuan:* ${submittedSurat.tujuan}\n` +
      `• *Diajukan Oleh:* ${user.fullName}\n\n` +
      `Silakan telaah dan sahkan melalui Portal Pengurus SIAP APII:\n` +
      `https://apologetislamindonesia.or.id/portal/#surat\n\n` +
      `_Pesan otomatis SIAP APII Enterprise v3.1_`;

    showWhatsAppRelayModal(targetPejabat.name, targetPejabat.roleLabel, targetPejabat.phone, msg);
  }

  function renderSuratWorkspace() {
    const db = State.getDb();
    const user = Auth.getCurrentUser();
    const tbody = document.getElementById('surat-table-body');
    if (!tbody) return;

    // Toggle Tombol SK Generator (Hanya Sekretaris & Superadmin)
    const btnSk = document.getElementById('btn-sk-generator');
    if (btnSk) {
      if (Auth.hasPermission('sk:generate')) {
        btnSk.classList.remove('hidden');
      } else {
        btnSk.classList.add('hidden');
      }
    }

    // Gating Composer Form Berdasarkan Kewenangan Sekretaris (Ketua fokus pengesahan, tanpa form penyusunan)
    const canCompose = Auth.hasPermission('surat:compose');
    const composerPanel = document.getElementById('surat-composer-panel');
    const previewPanel = document.getElementById('surat-preview-panel');
    const execBanner = document.getElementById('surat-executive-banner');
    const execBannerText = document.getElementById('surat-executive-banner-text');
    const suratTitle = document.getElementById('surat-workspace-title');
    const suratSubtitle = document.getElementById('surat-workspace-subtitle');
    const composerNotice = document.getElementById('composer-role-notice');
    const composerNoticeText = document.getElementById('composer-role-notice-text');
    const btnSubmitSurat = document.getElementById('btn-submit-surat');

    if (composerPanel) {
      composerPanel.classList.toggle('hidden', !canCompose);
    }
    if (previewPanel) {
      previewPanel.classList.toggle('lg:col-span-7', canCompose);
      previewPanel.classList.toggle('lg:col-span-12', !canCompose);
    }
    if (suratTitle) {
      suratTitle.textContent = canCompose
        ? 'Persuratan Dinas & Generator SK 1-Klik'
        : (user.role === 'ketua' ? 'Pengesahan Surat Dinas Resmi (Ketua)' : 'Inspeksi Arsip Persuratan Dinas');
    }
    if (suratSubtitle) {
      suratSubtitle.textContent = canCompose
        ? 'Format kertas A4, KOP resmi berstempel digital, penomoran urut otomatis, dan Auto-Hijri Kemenag RI.'
        : 'Tinjau pratinjau naskah A4 resmi yang diajukan Sekretariat, lalu berikan pengesahan TTE & stempel basah digital atau kembalikan revisi.';
    }
    if (execBanner && execBannerText) {
      if (!canCompose) {
        execBanner.classList.remove('hidden');
        execBannerText.innerHTML = user.role === 'ketua'
          ? '<strong>Fokus Kewenangan Ketua (PRD Bab 2.2):</strong> Penyusunan draf &amp; Generator SK merupakan tugas Sekretaris. Anda cukup memeriksa isi naskah pada daftar/pratinjau lalu klik <strong>Sahkan &amp; Stempel</strong> atau <strong>Tolak Revisi</strong>.'
          : '<strong>Mode Audit Persuratan (Read-Only):</strong> Penyusunan naskah hanya oleh Sekretaris dan pengesahan oleh Ketua.';
      } else {
        execBanner.classList.add('hidden');
      }
    }

    ['composer-kop', 'composer-jenis', 'composer-perihal', 'composer-tujuan', 'composer-lampiran', 'composer-isi'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !canCompose;
    });

    if (btnSubmitSurat) {
      if (canCompose) {
        btnSubmitSurat.disabled = false;
        btnSubmitSurat.classList.remove('opacity-40', 'cursor-not-allowed');
      } else {
        btnSubmitSurat.disabled = true;
        btnSubmitSurat.classList.add('opacity-40', 'cursor-not-allowed');
      }
    }

    if (composerNotice && composerNoticeText) {
      if (!canCompose) {
        composerNotice.classList.remove('hidden');
        composerNoticeText.innerHTML = `<strong>Mode Otorisasi / Audit (PRD Bab 2.2):</strong> Penyusunan naskah dinas adalah wewenang eksklusif <strong>Sekretaris Umum / Sekretaris DPW</strong>. Peran Anda (<strong>${CONFIG.ROLES[user.role]?.label || user.role}</strong>) bertindak memeriksa, mengesahkan (Ketua), atau auditor (Pengawas).`;
      } else {
        composerNotice.classList.add('hidden');
      }
    }

    let rowsHtml = '';
    const visibleSurat = db.surat.filter(s => isScopedRecordVisible(s.tenantId));
    visibleSurat.forEach(s => {
      let statusBadge = '';
      if (s.status === 'APPROVED') {
        statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900">DISAHKAN (FINAL)</span>';
      } else if (s.status === 'AJUKAN' || s.status === 'PENDING_KETUA') {
        statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">MENUNGGU PENGESAHAN</span>';
      } else if (s.status === 'REJECTED' || s.status === 'DRAFT_REVISI') {
        statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-900">PERLU REVISI</span>';
      } else {
        statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">${s.status}</span>`;
      }

      let actionsHtml = '';
      if ((s.status === 'REJECTED' || s.status === 'DRAFT_REVISI') && canCompose) {
        actionsHtml = `
          <button type="button" onclick="App.revisiSurat('${s.id}')" class="whitespace-nowrap px-2.5 py-1.5 rounded bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800">
            Muat ke Composer
          </button>
        `;
      } else if ((s.status === 'AJUKAN' || s.status === 'PENDING_KETUA') && Auth.hasPermission('surat:approve')) {
        actionsHtml = `
          <div class="flex flex-wrap items-center justify-end gap-1.5">
            <button type="button" onclick="App.previewSuratA4('${s.id}')" class="whitespace-nowrap px-2.5 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-xs font-semibold text-slate-900">
              Lihat A4
            </button>
            <button type="button" onclick="App.approveSurat('${s.id}')" class="whitespace-nowrap px-2.5 py-1.5 rounded bg-[#064E3B] text-white text-xs font-bold hover:bg-[#003527]">
              Sahkan (TTD)
            </button>
            <button type="button" onclick="App.rejectSurat('${s.id}')" class="whitespace-nowrap px-2.5 py-1.5 rounded bg-red-700 text-white text-xs font-semibold hover:bg-red-800">
              Tolak / Revisi
            </button>
          </div>
        `;
      } else if ((s.status === 'AJUKAN' || s.status === 'PENDING_KETUA') && user.role === 'sekretaris') {
        actionsHtml = `
          <div class="flex flex-wrap items-center justify-end gap-1">
            <span class="whitespace-nowrap px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-semibold">Menunggu TTD Ketua</span>
            <button type="button" onclick="App.previewSuratA4('${s.id}')" class="whitespace-nowrap px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-xs font-semibold text-slate-900">
              Lihat
            </button>
          </div>
        `;
      } else {
        actionsHtml = `
          <button type="button" onclick="App.previewSuratA4('${s.id}')" class="whitespace-nowrap px-2.5 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-xs font-semibold text-slate-900">
            Lihat Naskah A4
          </button>
        `;
      }

      const revisiNoteHtml = s.catatanRevisi
        ? `<p class="text-[11px] text-red-800 mt-0.5">Catatan Ketua: ${s.catatanRevisi}</p>`
        : '';

      rowsHtml += `
        <tr class="border-b border-slate-200 hover:bg-slate-50 transition-colors">
          <td class="whitespace-nowrap tabular-nums px-4 py-3 font-mono font-bold text-xs text-slate-900">${s.nomorSurat}</td>
          <td class="px-4 py-3 font-medium text-xs text-slate-900 min-w-[180px] max-w-xs">
            <div class="truncate">${s.perihal}</div>
            ${revisiNoteHtml}
          </td>
          <td class="px-4 py-3 text-xs text-slate-600 min-w-[140px]">${s.tujuan}</td>
          <td class="whitespace-nowrap tabular-nums px-4 py-3 text-xs text-slate-600">${formatTanggalDisplay(s.tanggalMasehi)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-center">${statusBadge}</td>
          <td class="px-4 py-3 text-right">${actionsHtml}</td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml || '<tr><td colspan="6" class="p-4 text-center text-xs text-slate-600">Belum ada naskah surat keluar pada wilayah ini.</td></tr>';

    const printableSheet = document.getElementById('printable-a4-sheet');
    if (printableSheet) {
      if (!canCompose && visibleSurat.length > 0) {
        const targetSurat = visibleSurat.find(s => s.status === 'AJUKAN' || s.status === 'PENDING_KETUA') || visibleSurat[0];
        printableSheet.innerHTML = buildA4DocumentHtml(targetSurat, targetSurat.tenantId);
      } else {
        const selectKop = document.getElementById('composer-kop');
        if (selectKop) {
          selectKop.value = (user?.tenantId && user.tenantId !== 'DPP_PUSAT') ? 'DPW' : 'DPP';
        }
        const perihal = document.getElementById('composer-perihal')?.value || 'Surat Mandat Delegasi Dialog Teologi';
        const tujuan = document.getElementById('composer-tujuan')?.value || 'Ust. Dani Ramadhan, M.Ag.';
        const lampiran = document.getElementById('composer-lampiran')?.value || '1 Berkas TOR';
        const isi = document.getElementById('composer-isi')?.value || 'Memberikan mandat penuh kepada nama tertera di atas untuk mewakili Dewan Pengurus Pusat Yayasan Apologet Islam Indonesia dalam forum Dialog Teologi dan Kristologi Komparatif Nasional 2026 di Jakarta Islamic Centre.';
        const jenis = document.getElementById('composer-jenis')?.value || 'SM';
        const targetTenant = (selectKop?.value === 'DPP') ? 'DPP_PUSAT' : (user?.tenantId || 'DPW_JABO');
        const nomorGen = State.generateNextNomorSurat(jenis, targetTenant);
        const composerNomorDisplay = document.getElementById('composer-nomor-display');
        if (composerNomorDisplay) composerNomorDisplay.textContent = nomorGen;
        printableSheet.innerHTML = buildA4DocumentHtml({
          nomorSurat: nomorGen,
          perihal,
          tujuan,
          lampiran,
          isiSurat: isi,
          tanggalHijriah: State.getHijriDate(),
          hashSha256: State.computeSha256(nomorGen + perihal + isi)
        }, targetTenant);
      }
    }
  }

  function approveSurat(suratId) {
    if (!Auth.hasPermission('surat:approve')) {
      showToast('Akses ditolak: Hanya Ketua Umum / DPW yang berwenang mengesahkan surat dinas.', 'error');
      return;
    }

    const user = Auth.getCurrentUser();
    const db = State.getDb();
    const surat = db.surat.find(s => s.id === suratId);
    if (!surat) return;

    surat.status = 'APPROVED';
    surat.statusSignature = 'APPROVED';
    surat.signedBy = user.fullName;
    surat.signedAt = formatWaktu();
    surat.catatanRevisi = '';
    State.saveDatabase();
    State.logAudit('APPROVE_SURAT', 'Surat', suratId, { nomor: surat.nomorSurat, signedBy: user.fullName });
    syncApiSafe('approveSurat', { id: suratId, signedBy: user.fullName });

    showToast(`Surat ${surat.nomorSurat} resmi disahkan & stempel digital dibubuhkan!`);
    renderSuratWorkspace();

    const targetPejabat = resolveOfficerSafe('sekretaris', surat.tenantId);
    const msg = `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n` +
      `*PEMBERITAHUAN SURAT DINAS TELAH DISAHKAN*\n\n` +
      `Naskah dinas resmi telah ditandatangani dan dibubuhi stempel digital basah oleh ${user.fullName}:\n` +
      `• *Nomor:* ${surat.nomorSurat}\n` +
      `• *Perihal:* ${surat.perihal}\n` +
      `• *Status:* SAH & TERVERIFIKASI DI VAULT DRIVE (01_SURAT_KELUAR)\n\n` +
      `Tautan verifikasi publik:\n` +
      `https://apologetislamindonesia.or.id/public/#/verifikasi?token=${encodeURIComponent(surat.nomorSurat)}`;

    showWhatsAppRelayModal(targetPejabat.name, targetPejabat.roleLabel, targetPejabat.phone, msg);
  }

  function rejectSurat(suratId, directCatatan = null) {
    if (!Auth.hasPermission('surat:reject')) {
      showToast('Akses ditolak: Hanya Ketua Umum / DPW yang berwenang menolak draf surat dinas.', 'error');
      return;
    }
    const db = State.getDb();
    const surat = db.surat.find(s => s.id === suratId);
    if (!surat) return;

    const idEl = document.getElementById('reject-surat-id');
    const titleEl = document.getElementById('reject-surat-title');
    const catEl = document.getElementById('reject-surat-catatan');
    if (idEl) idEl.value = surat.id;
    if (titleEl) titleEl.textContent = `${surat.nomorSurat} - ${surat.perihal}`;
    if (catEl) catEl.value = directCatatan || surat.catatanRevisi || '';

    if (typeof directCatatan === 'string' && directCatatan.trim()) {
      submitRejectSurat();
      const targetSekretaris = resolveOfficerSafe('sekretaris', surat.tenantId);
      showWhatsAppRelayModal(targetSekretaris.name, targetSekretaris.roleLabel || targetSekretaris.role, targetSekretaris.phone, `Revisi Surat ${surat.nomorSurat}: ${directCatatan.trim()}`);
      return;
    }

    const modal = document.getElementById('modal-reject-surat');
    if (modal) modal.classList.remove('hidden');
  }

  function submitRejectSurat() {
    if (!Auth.hasPermission('surat:reject')) return;
    const suratId = document.getElementById('reject-surat-id')?.value;
    const catatan = document.getElementById('reject-surat-catatan')?.value?.trim();
    if (!catatan) {
      showToast('Harap isi catatan revisi untuk Sekretaris.', 'error');
      return;
    }

    const user = Auth.getCurrentUser();
    const db = State.getDb();
    const surat = db.surat.find(s => s.id === suratId);
    if (!surat) return;

    surat.status = 'REJECTED';
    surat.statusSignature = 'REJECTED';
    surat.catatanRevisi = catatan;
    State.saveDatabase();
    State.logAudit('REJECT_SURAT', 'Surat', suratId, { nomor: surat.nomorSurat, catatanRevisi: catatan });
    syncApiSafe('rejectSurat', { id: suratId, catatanRevisi: catatan });

    closeModal('modal-reject-surat');
    showToast(`Surat ${surat.nomorSurat} dikembalikan ke Sekretaris dengan catatan revisi.`);
    renderSuratWorkspace();

    const targetSekretaris = resolveOfficerSafe('sekretaris', surat.tenantId);
    const msg = `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n` +
      `*NOTIFIKASI REVISI NASKAH SURAT DINAS*\n\n` +
      `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
      `Yth. ${targetSekretaris.name} (${targetSekretaris.roleLabel})\n\n` +
      `Ketua telah menelaah naskah surat dinas berikut dan mengembalikan draf untuk diperbaiki:\n` +
      `• *Nomor Surat:* ${surat.nomorSurat}\n` +
      `• *Perihal:* ${surat.perihal}\n` +
      `• *Catatan Revisi:* "${catatan}"\n` +
      `• *Penelaah:* ${user.fullName}\n\n` +
      `Silakan periksa dan ajukan ulang melalui Portal Pengurus SIAP APII:\n` +
      `https://apologetislamindonesia.or.id/portal/#surat\n\n` +
      `_Pesan otomatis SIAP APII Enterprise v3.1_`;

    showWhatsAppRelayModal(targetSekretaris.name, targetSekretaris.roleLabel, targetSekretaris.phone, msg);
  }

  function revisiSurat(suratId) {
    if (!Auth.hasPermission('surat:compose')) {
      showToast('Akses ditolak: Hanya Sekretaris yang berwenang merevisi draf surat dinas.', 'error');
      return;
    }

    const db = State.getDb();
    const surat = db.surat.find(s => s.id === suratId);
    if (!surat) return;

    editingSuratId = surat.id;
    surat.status = 'DRAFT_REVISI';
    surat.statusSignature = 'DRAFT_REVISI';

    const inputPerihal = document.getElementById('composer-perihal');
    const inputTujuan = document.getElementById('composer-tujuan');
    const inputLampiran = document.getElementById('composer-lampiran');
    const inputIsi = document.getElementById('composer-isi');
    const composerNomor = document.getElementById('composer-nomor-display');

    if (inputPerihal) inputPerihal.value = surat.perihal;
    if (inputTujuan) inputTujuan.value = surat.tujuan;
    if (inputLampiran) inputLampiran.value = surat.lampiran || '-';
    if (inputIsi) inputIsi.value = surat.isiSurat;
    if (composerNomor) composerNomor.textContent = surat.nomorSurat;

    State.saveDatabase();
    renderSuratWorkspace();
    showToast('Naskah dimuat ke Composer dalam status Revisi. Klik "Ajukan Surat Dinas" setelah selesai diperbaiki.');
    window.scrollTo({ top: 180, behavior: 'smooth' });
  }

  function previewSuratA4(suratId) {
    const db = State.getDb();
    const surat = db.surat.find(s => s.id === suratId);
    if (!surat) return;

    const inputPerihal = document.getElementById('composer-perihal');
    const inputTujuan = document.getElementById('composer-tujuan');
    const inputLampiran = document.getElementById('composer-lampiran');
    const inputIsi = document.getElementById('composer-isi');
    const selectKop = document.getElementById('composer-kop');

    if (inputPerihal) inputPerihal.value = surat.perihal;
    if (inputTujuan) inputTujuan.value = surat.tujuan;
    if (inputLampiran) inputLampiran.value = surat.lampiran || '-';
    if (inputIsi) inputIsi.value = surat.isiSurat;
    if (selectKop) selectKop.value = (surat.tenantId === 'DPP_PUSAT') ? 'DPP' : 'DPW';

    const printableSheet = document.getElementById('printable-a4-sheet');
    if (printableSheet) {
      printableSheet.innerHTML = buildA4DocumentHtml(surat, surat.tenantId);
    }

    showToast(`Menampilkan pratinjau A4 untuk ${surat.nomorSurat}`);
    window.scrollTo({ top: 200, behavior: 'smooth' });
  }

  // =========================================================================
  // ONE-CLICK SK GENERATOR
  // =========================================================================
  function openSkGeneratorModal() {
    if (!Auth.hasPermission('sk:generate')) {
      showToast('Akses ditolak: Hanya Sekretaris Umum / DPW yang berwenang menerbitkan SK Kepengurusan.', 'error');
      return;
    }
    const modal = document.getElementById('modal-sk-generator');
    if (!modal) return;

    const db = State.getDb();
    const selectWilayah = document.getElementById('sk-form-wilayah');
    const inputNomor = document.getElementById('sk-form-nomor');
    const selectTemplate = document.getElementById('sk-form-template');
    const inputJudul = document.getElementById('sk-form-judul');
    const inputMenimbang = document.getElementById('sk-form-menimbang');
    const inputMemutuskan = document.getElementById('sk-form-memutuskan');

    // Isi daftar wilayah secara dinamis jika ada di db
    if (selectWilayah && db.wilayah && db.wilayah.length > 0) {
      const currentVal = selectWilayah.value || 'DPW_JABO';
      selectWilayah.innerHTML = db.wilayah.map(w => 
        `<option value="${w.code}" ${w.code === currentVal ? 'selected' : ''}>${w.name}</option>`
      ).join('');
    }

    function updateSkNumberAndTemplate() {
      const wil = selectWilayah?.value || 'DPW_JABO';
      const tpl = selectTemplate?.value || 'SK_PENGESAHAN_DPW';
      const wilObj = (db.wilayah || []).find(w => w.code === wil);
      const wilName = wilObj ? wilObj.name : 'DPW APII';

      // Auto-numbering SK resmi anti-loncat
      const nextNomor = State.generateNextNomorSurat('SK', wil);
      if (inputNomor) inputNomor.value = nextNomor;

      if (tpl === 'SK_PENGESAHAN_DPW') {
        if (inputJudul) inputJudul.value = `PENGESAHAN SUSUNAN PERSONALIA DEWAN PENGURUS WILAYAH (${wilName.toUpperCase()}) MASA KHIDMAT 2026-2031`;
        if (inputMenimbang) inputMenimbang.value = `Bahwa demi kelancaran koordinasi dakwah apologetika Islam di tingkat wilayah, dipandang perlu mengesahkan susunan definitif personalia pengurus.`;
        if (inputMemutuskan) inputMemutuskan.value = `PERTAMA: Mengesahkan susunan Dewan Pengurus Wilayah masa khidmat 2026-2031.\nKEDUA: Menugaskan personalia terlampir untuk menjalankan amanah dakwah sesuai AD/ART.\nKETIGA: Keputusan ini berlaku sejak tanggal ditetapkan.`;
      } else if (tpl === 'SK_DAI_PEMBINA') {
        if (inputJudul) inputJudul.value = `PENGANGKATAN DA'I TETAP & PEMBINA MUALLAF WILAYAH (${wilName.toUpperCase()})`;
        if (inputMenimbang) inputMenimbang.value = `Bahwa peningkatan populasi muallaf membutuhkan pendampingan akidah berkesinambungan oleh da'i bersertifikasi teologi komparatif.`;
        if (inputMemutuskan) inputMemutuskan.value = `PERTAMA: Mengangkat nama asatidz terlampir sebagai Da'i Pembina Muallaf Tetap APII.\nKEDUA: Memberikan hak honorarium kafalah dakwah syar'i dari Kantong Infaq Dakwah.\nKETIGA: Menugaskan pelaporan berkala santunan muallaf setiap bulan ke Divisi Dakwah.`;
      } else if (tpl === 'SK_PANITIA_RAKERNAS') {
        if (inputJudul) inputJudul.value = `PENETAPAN PANITIA PELAKSANA MUSYAWARAH KERJA WILAYAH (${wilName.toUpperCase()}) TAHUN 2026`;
        if (inputMenimbang) inputMenimbang.value = `Bahwa untuk merumuskan target program kerja dakwah tahunan, perlu dibentuk kepanitiaan musyawarah kerja yang solid dan berdedikasi.`;
        if (inputMemutuskan) inputMemutuskan.value = `PERTAMA: Membentuk dan menetapkan susunan panitia pelaksana Mukerwil 2026.\nKEDUA: Mengamanahkan penyusunan Rencana Anggaran Biaya (RAB) dan jadwal kegiatan.\nKETIGA: Panitia wajib menyerahkan LPJ selambat-lambatnya 14 hari pasca acara.`;
      }
    }

    if (selectWilayah && !selectWilayah._hasListener) {
      selectWilayah.addEventListener('change', updateSkNumberAndTemplate);
      selectWilayah._hasListener = true;
    }
    if (selectTemplate && !selectTemplate._hasListener) {
      selectTemplate.addEventListener('change', updateSkNumberAndTemplate);
      selectTemplate._hasListener = true;
    }

    updateSkNumberAndTemplate();
    modal.classList.remove('hidden');
  }

  function submitSkGenerator() {
    if (!Auth.hasPermission('sk:generate')) {
      showToast('Akses ditolak: Hanya Sekretaris Umum / DPW yang berwenang menerbitkan SK Kepengurusan.', 'error');
      return;
    }
    const wilayah = document.getElementById('sk-form-wilayah')?.value || 'DPW_JABO';
    const nomor = State.generateNextNomorSurat('SK', wilayah);
    const judul = document.getElementById('sk-form-judul')?.value;
    const menimbang = document.getElementById('sk-form-menimbang')?.value;
    const memutuskan = document.getElementById('sk-form-memutuskan')?.value;
    const user = Auth.getCurrentUser();

    if (!nomor || !judul) {
      showToast('Nomor SK dan Judul wajib diisi.', 'error');
      return;
    }

    const isiSk = `SURAT KEPUTUSAN DEWAN PENGURUS PUSAT APII\n` +
      `TENTANG: ${judul}\n\n` +
      `MENIMBANG:\n${menimbang}\n\n` +
      `MENGINGAT:\n1. Anggaran Dasar & Anggaran Rumah Tangga (AD/ART) Yayasan APII 16 Bab.\n2. Keputusan Kemenkumham RI No. AHU-0014970.AH.01.04.Tahun 2023.\n\n` +
      `MEMUTUSKAN:\n${memutuskan}\n\n` +
      `Ditetapkan di: Jakarta\nPada Tanggal: ${formatTanggal()} M / ${State.getHijriDate()}`;

    const targetTenant = wilayah.startsWith('DPW') ? wilayah : 'DPP_PUSAT';
    const db = State.getDb();
    const newSk = {
      id: 'SRT-SK-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      tenantId: targetTenant,
      nomorSurat: nomor,
      tipe: 'SK_KEPENGURUSAN',
      kodePerihal: 'SK',
      perihal: judul,
      tujuan: 'Seluruh Personalia Wilayah ' + wilayah,
      tanggalMasehi: formatTanggal(),
      tanggalHijriah: State.getHijriDate(),
      klasifikasi: 'Sangat Penting',
      tingkatKeamanan: 'Biasa',
      lampiran: '1 Lembar Susunan Personalia',
      isiSurat: isiSk,
      isDualSignature: true,
      status: 'AJUKAN',
      statusSignature: 'PENDING_KETUA',
      signedBy: 'Diajukan oleh ' + user.fullName + ' (Menunggu TTD Ketum + Sekum)',
      signedAt: null,
      hashSha256: State.computeSha256(nomor + judul + isiSk),
      pdfDriveUrl: '#',
      createdBy: user.fullName
    };

    db.surat.unshift(newSk);
    State.saveDatabase();
    State.logAudit('GENERATE_SK', 'Surat', newSk.id, { nomor: nomor, judul: judul, status: 'AJUKAN' });
    syncApiSafe('generateSKKepengurusan', newSk);

    document.getElementById('modal-sk-generator')?.classList.add('hidden');
    showToast(`Draf SK ${nomor} berhasil disusun! Menunggu pengesahan & TTD Ketua Umum.`);
    renderSuratWorkspace();

    const targetKetum = resolveOfficerSafe('ketua', targetTenant);
    const msg = `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n` +
      `*PENGAJUAN OTORISASI SURAT KEPUTUSAN (SK) BARU*\n\n` +
      `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
      `Yth. ${targetKetum.name} (${targetKetum.roleLabel})\n\n` +
      `Draf Surat Keputusan (SK) 1-Klik telah disiapkan oleh ${user.fullName} dan menunggu pengesahan Dual-TTD Anda:\n` +
      `• *Nomor SK:* ${newSk.nomorSurat}\n` +
      `• *Tentang:* ${newSk.perihal}\n` +
      `• *Status:* MENUNGGU PENGESAHAN KETUA (AJUKAN)\n` +
      `• *Integritas SHA-256:* ${newSk.hashSha256.substring(0, 16)}...\n\n` +
      `Silakan tinjau dan bubuhkan TTD Elektronik di Portal Pengurus:\n` +
      `https://apologetislamindonesia.or.id/portal/#surat\n\n` +
      `_Pesan otomatis SIAP APII Enterprise v3.1_`;

    showWhatsAppRelayModal(targetKetum.name, targetKetum.roleLabel, targetKetum.phone, msg);
  }

  // =========================================================================
  // 3. SURAT MASUK & DISPOSISI MULTI-DIVISI (2-TAHAP)
  // =========================================================================
  function renderDisposisiWorkspace() {
    const db = State.getDb();
    const user = Auth.getCurrentUser();
    const container = document.getElementById('disposisi-list');
    if (!container) return;

    // Toggle Tombol Catat Surat Masuk (Hanya Sekretaris & Superadmin)
    const btnTambahSm = document.getElementById('btn-tambah-surat-masuk');
    if (btnTambahSm) {
      if (Auth.hasPermission('surat_masuk:manage')) {
        btnTambahSm.classList.remove('hidden');
      } else {
        btnTambahSm.classList.add('hidden');
      }
    }

    // Notice Peran & Kewenangan
    const dispNotice = document.getElementById('disposisi-role-notice');
    const dispNoticeText = document.getElementById('disposisi-role-notice-text');
    if (dispNotice && dispNoticeText) {
      if (user.role === 'ketua') {
        dispNotice.classList.remove('hidden');
        dispNoticeText.innerHTML = '<strong>Kewenangan Pimpinan Eksekutif:</strong> Sekretariat bertugas mencatat surat masuk agenda dinas & telaah rekomendasi. Kewenangan Anda adalah memilih 5 instruksi baku definitif & memberikan paraf digital.';
      } else if (user.role === 'ketua_divisi') {
        dispNotice.classList.remove('hidden');
        dispNoticeText.innerHTML = `<strong>Kewenangan Divisi Pelaksana (${user.category}):</strong> Tinjau instruksi Ketua dan laporkan tindak lanjut divisi setelah tugas selesai dilaksanakan.`;
      } else if (user.isPembinaReadOnly || user.isPengawasReadOnly) {
        dispNotice.classList.remove('hidden');
        dispNoticeText.innerHTML = '<strong>Mode Tinjauan / Audit (Read-Only):</strong> Pemantauan arus surat masuk, alur disposisi, dan pelaporan tindak lanjut divisi.';
      } else {
        dispNotice.classList.add('hidden');
      }
    }

    let html = '';
    const isDivRole = (user.role === 'ketua_divisi' || user.role === 'anggota_divisi') && !!user.divisi;
    const visibleSm = db.suratMasuk.filter(sm =>
      isScopedRecordVisible(sm.tenantId, isDivRole ? sm.targetDivisi : null)
    );

    visibleSm.forEach(sm => {
      const isPendingKetua = sm.statusDisposisi === 'PENDING_KETUA' || sm.statusDisposisi === 'DRAFT_DISPOSISI';
      const targetDivs = Array.isArray(sm.targetDivisi) ? sm.targetDivisi : [];
      const laporanMap = sm.laporanPerDivisi && typeof sm.laporanPerDivisi === 'object' ? sm.laporanPerDivisi : {};
      const reportedDivs = targetDivs.filter(code => Boolean(laporanMap[code]));

      const targetDivisiBadges = targetDivs.map(code => {
        const divDef = CONFIG.DIVISIONS.find(d => d.code === code);
        const done = Boolean(laporanMap[code]);
        return `<span class="px-2 py-0.5 rounded text-[10px] font-bold ${done ? 'bg-emerald-800 text-white' : 'bg-slate-800 text-white'}">${divDef ? divDef.name : code}${done ? ' (Selesai)' : ''}</span>`;
      }).join(' ');

      const attachmentBadge = sm.attachmentName
        ? `<p class="text-[11px] text-emerald-900 font-medium mt-1">Lampiran Berkas: <span class="font-mono font-bold">${sm.attachmentName}</span> (${sm.attachmentSizeKb || 0} KB)</p>`
        : '';

      const userDivCode = user.divisi || (user.role === 'superadmin' ? targetDivs.find(c => !laporanMap[c]) : null);
      const userCanReportHere = Auth.hasPermission('disposisi:report') && !isPendingKetua &&
        (user.role === 'superadmin' ? reportedDivs.length < targetDivs.length : (user.role === 'ketua_divisi' && targetDivs.includes(user.divisi) && !laporanMap[user.divisi]));

      const laporanListHtml = targetDivs.map(code => {
        const divDef = CONFIG.DIVISIONS.find(d => d.code === code);
        const entry = laporanMap[code];
        if (entry) {
          return `<div class="p-2 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-950">
            <strong>${divDef ? divDef.name : code}:</strong> ${entry.text}
            <span class="block text-[10px] text-emerald-800 mt-0.5">Dilaporkan oleh ${entry.reporter} (${entry.at})</span>
          </div>`;
        }
        return `<div class="p-2 rounded bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <strong>${divDef ? divDef.name : code}:</strong> Menunggu laporan tindak lanjut divisi.
        </div>`;
      }).join('');

      html += `
        <div class="p-5 rounded-lg bg-white border border-slate-200 shadow-sm flex flex-col gap-4">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <div>
              <div class="flex items-center gap-2">
                <span class="tabular-nums px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-900">${sm.noAgenda}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
                  sm.tingkatUrgensi === 'SANGAT_RAHASIA_PENTING' ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900'
                }">${sm.tingkatUrgensi}</span>
              </div>
              <h3 class="font-display font-bold text-base text-slate-900 mt-1">${sm.perihal}</h3>
              <p class="text-xs text-slate-600 font-medium">Asal Surat: <strong>${sm.asalSurat}</strong> &bull; No. Asli: <span class="font-mono">${sm.noSuratAsli}</span></p>
              ${attachmentBadge}
            </div>
            <div class="text-right">
              <span class="tabular-nums text-xs text-slate-600">Diterima: ${formatTanggalDisplay(sm.tglTerima)}</span>
            </div>
          </div>

          <!-- Tahap 1: Rekomendasi Telaah Sekretaris -->
          <div class="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-1.5">
            <span class="text-[10px] uppercase font-bold text-emerald-900">1. Draf Rekomendasi Sekretariat</span>
            <p class="text-xs text-slate-800">${sm.drafRekomendasiSekretaris || 'Menunggu telaah draf sekretariat.'}</p>
            <div class="flex flex-wrap items-center gap-1.5 mt-1">
              <span class="text-[11px] text-slate-600 font-medium">Divisi Tujuan:</span>
              ${targetDivisiBadges || '<span class="text-xs text-slate-600">Belum dipilih</span>'}
            </div>
          </div>

          <!-- Tahap 2: Otorisasi & 5 Instruksi Baku Ketua (Plus Penyesuaian Target Divisi) -->
          <div class="p-3.5 rounded-lg ${isPendingKetua ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'} flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-[10px] uppercase font-bold ${isPendingKetua ? 'text-amber-900' : 'text-emerald-900'}">
                2. Otorisasi &amp; 5 Instruksi Baku Pimpinan
              </span>
              <span class="text-xs font-semibold ${isPendingKetua ? 'text-amber-900' : 'text-emerald-900'}">
                Status: ${sm.statusDisposisi}
              </span>
            </div>

            ${isPendingKetua ? `
              ${Auth.hasPermission('disposisi:instruct') ? `
                <div class="flex flex-col gap-2.5 pt-1">
                  <div>
                    <label class="text-xs font-semibold text-slate-900 block mb-1">Sesuaikan Target Divisi Pelaksana:</label>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      ${CONFIG.DIVISIONS.map(div => `
                        <label class="flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer">
                          <input type="checkbox" name="disp-div-${sm.id}" value="${div.code}" ${targetDivs.includes(div.code) ? 'checked' : ''} class="rounded text-emerald-800"/>
                          <span>${div.name}</span>
                        </label>
                      `).join('')}
                    </div>
                  </div>
                  <div>
                    <label class="text-xs font-semibold text-slate-900 block mb-1">Pilih 5 Instruksi Baku Pimpinan:</label>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      ${CONFIG.DISPOSISI_INSTRUCTIONS.map(inst => `
                        <label class="flex items-center gap-1.5 text-xs text-slate-900 cursor-pointer">
                          <input type="checkbox" name="disp-inst-${sm.id}" value="${inst.code}" class="rounded text-emerald-800"/>
                          <span>${inst.label}</span>
                        </label>
                      `).join('')}
                    </div>
                  </div>
                  <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <input type="text" id="disp-catatan-${sm.id}" placeholder="Catatan tambahan pimpinan..." class="flex-1 px-3 py-2 rounded border border-slate-300 bg-white text-xs"/>
                    <button type="button" onclick="App.approveDisposisiKetua('${sm.id}')" class="min-h-[44px] px-4 py-2 rounded bg-[#064E3B] text-white font-bold text-xs hover:bg-[#003527] shadow-sm">
                      Paraf &amp; Terbitkan Disposisi
                    </button>
                  </div>
                </div>
              ` : `
                <p class="text-xs text-amber-950 italic">Menunggu arahan 5 instruksi baku &amp; paraf definitif dari Ketua Umum / Ketua DPW.</p>
              `}
            ` : `
              <div class="text-xs text-emerald-950 flex flex-col gap-1">
                <p><strong>Instruksi Ketua:</strong> ${sm.instruksiKetua}</p>
                <p><strong>Catatan:</strong> ${sm.catatanTambahan || '-'}</p>
                <p><strong>Paraf Pimpinan:</strong> ${sm.parafKetua} (Tenggat: ${sm.batasWaktu})</p>
              </div>
            `}
          </div>

          <!-- Tahap 3: Laporan Tindak Lanjut Per-Divisi Pelaksana -->
          ${!isPendingKetua ? `
            <div class="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="text-[10px] uppercase font-bold text-slate-900">3. Progres Tindak Lanjut Per-Divisi</span>
                <span class="tabular-nums text-[11px] font-bold text-emerald-900">${reportedDivs.length} / ${targetDivs.length || 1} Divisi Selesai</span>
              </div>
              ${laporanListHtml || `<p class="text-xs text-slate-700">${sm.laporanTindakLanjut || 'Belum ada laporan tindak lanjut.'}</p>`}
              ${userCanReportHere ? `
                <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <input type="text" id="laporan-disp-${sm.id}" placeholder="Tuliskan tindak lanjut Divisi ${(userDivCode || '').toUpperCase()}..." class="flex-1 px-3 py-2 rounded border border-slate-300 bg-white text-xs"/>
                  <button type="button" onclick="App.submitLaporanDisposisi('${sm.id}')" class="min-h-[44px] px-4 py-2 rounded bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 shadow-sm">
                    Kirim Laporan Divisi
                  </button>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `;
    });

    container.innerHTML = html || '<p class="text-xs text-slate-600">Tidak ada surat masuk yang tercatat pada wilayah / divisi Anda.</p>';
  }

  function approveDisposisiKetua(smId) {
    if (!Auth.hasPermission('disposisi:instruct')) {
      showToast('Akses ditolak: Hanya Ketua Umum / DPW yang berwenang memberikan instruksi dan paraf disposisi.', 'error');
      return;
    }

    const user = Auth.getCurrentUser();
    const db = State.getDb();
    const sm = db.suratMasuk.find(s => s.id === smId);
    if (!sm) return;

    const selectedDivs = Array.from(document.querySelectorAll(`input[name="disp-div-${smId}"]:checked`)).map(c => c.value);
    if (selectedDivs.length > 0) {
      sm.targetDivisi = selectedDivs;
    }

    const checkedInst = Array.from(document.querySelectorAll(`input[name="disp-inst-${smId}"]:checked`)).map(c => c.value);
    const catatan = document.getElementById(`disp-catatan-${smId}`)?.value || 'Segera tindak lanjuti.';

    sm.instruksiKetua = checkedInst.join(', ') || 'TINDAK_LANJUTI';
    sm.catatanTambahan = catatan;
    sm.parafKetua = user.fullName;
    sm.statusDisposisi = 'IN_PROGRESS';
    sm.laporanPerDivisi = sm.laporanPerDivisi || {};
    State.saveDatabase();
    State.logAudit('APPROVE_DISPOSISI', 'Disposisi', smId, { instruksi: sm.instruksiKetua, targetDivisi: sm.targetDivisi });
    syncApiSafe('saveDisposisi', { id: smId, targetDivisi: sm.targetDivisi, instruksiKetua: sm.instruksiKetua, catatan });

    showToast('Lembar disposisi resmi diterbitkan berparaf digital Ketua!');
    renderDisposisiWorkspace();

    const targets = (sm.targetDivisi && sm.targetDivisi.length > 0) ? sm.targetDivisi : ['dakwah'];
    const resolvedContacts = targets.map(divCode => {
      const divDef = CONFIG.DIVISIONS.find(d => d.code === divCode);
      const contact = resolveOfficerSafe('ketua_divisi', sm.tenantId, divCode);
      return { divCode, divName: divDef ? divDef.name : divCode, ...contact };
    });
    const primaryContact = resolvedContacts[0];
    const targetLines = resolvedContacts.map(c => `• ${c.divName}: ${c.name} (WA: ${c.phone})`).join('\n');

    const msg = `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n` +
      `*LEMBAR DISPOSISI RESMI KETUA UMUM*\n\n` +
      `Ditujukan kepada Ketua Divisi Pelaksana:\n${targetLines}\n\n` +
      `Surat masuk telah didisposisikan oleh ${user.fullName}:\n` +
      `• *No. Agenda:* ${sm.noAgenda}\n` +
      `• *Perihal:* ${sm.perihal}\n` +
      `• *Instruksi:* ${sm.instruksiKetua}\n` +
      `• *Catatan:* ${sm.catatanTambahan}\n` +
      `• *Tenggat Waktu:* ${sm.batasWaktu}\n\n` +
      `Silakan buka portal dan laporkan progres tindak lanjut divisi masing-masing:\n` +
      `https://apologetislamindonesia.or.id/portal/#disposisi`;

    showWhatsAppRelayModal(primaryContact.name, `${primaryContact.divName} (${targets.length} Divisi)`, primaryContact.phone, msg);
  }

  function submitLaporanDisposisi(smId) {
    if (!Auth.hasPermission('disposisi:report')) {
      showToast('Akses ditolak: Hanya Ketua Divisi pelaksana yang berwenang mengirimkan laporan tindak lanjut.', 'error');
      return;
    }

    const user = Auth.getCurrentUser();
    const db = State.getDb();
    const sm = db.suratMasuk.find(s => s.id === smId);
    if (!sm) return;

    if (user.role === 'ketua_divisi') {
      if (!sm.targetDivisi || !sm.targetDivisi.includes(user.divisi)) {
        const targetNames = (sm.targetDivisi || []).map(code => CONFIG.DIVISIONS.find(d => d.code === code)?.name || code).join(', ');
        showToast(`Akses Ditolak: Disposisi ini ditujukan untuk ${targetNames}, bukan untuk divisi Anda (${user.divisi}).`, 'error');
        return;
      }
    }

    if (!user.isNationalExecutive && sm.tenantId !== user.tenantId) {
      showToast('Akses Ditolak: Disposisi ini berada di luar yurisdiksi wilayah kepengurusan Anda.', 'error');
      return;
    }

    const text = document.getElementById(`laporan-disp-${smId}`)?.value?.trim();
    if (!text) {
      showToast('Harap tuliskan laporan tindak lanjut.', 'error');
      return;
    }

    sm.laporanPerDivisi = sm.laporanPerDivisi || {};
    const targetDivs = Array.isArray(sm.targetDivisi) && sm.targetDivisi.length > 0 ? sm.targetDivisi : ['umum'];
    const divKey = user.divisi || targetDivs.find(c => !sm.laporanPerDivisi[c]) || targetDivs[0];
    const divLabel = divKey ? `Divisi ${divKey.toUpperCase()}` : user.category;

    sm.laporanPerDivisi[divKey] = {
      text: text,
      reporter: user.fullName,
      at: formatWaktu()
    };

    const allDone = targetDivs.every(code => Boolean(sm.laporanPerDivisi[code]));
    sm.statusDisposisi = allDone ? 'SELESAI' : 'IN_PROGRESS';
    sm.laporanTindakLanjut = targetDivs
      .filter(c => sm.laporanPerDivisi[c])
      .map(c => `[${c.toUpperCase()}] ${sm.laporanPerDivisi[c].text} (${sm.laporanPerDivisi[c].reporter})`)
      .join(' | ');

    State.saveDatabase();
    State.logAudit('SUBMIT_LAPORAN_DISPOSISI', 'Disposisi', smId, { laporan: text, divisi: divKey, allDone });
    syncApiSafe('updateDisposisiProgress', { id: smId, divisi: divKey, laporan: text, statusDisposisi: sm.statusDisposisi });

    showToast(allDone
      ? 'Seluruh divisi telah melapor. Disposisi resmi berstatus SELESAI!'
      : `Laporan ${divLabel} tersimpan. Menunggu divisi tujuan lainnya.`
    );
    renderDisposisiWorkspace();

    const targetPejabat = resolveOfficerSafe('ketua', sm.tenantId);
    const msg = `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n` +
      `*LAPORAN PELAKSANAAN DISPOSISI (${allDone ? 'SELESAI PENUH' : 'PARSIAL'})*\n\n` +
      `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
      `Yth. ${targetPejabat.name} (${targetPejabat.roleLabel})\n\n` +
      `Divisi *${divLabel}* telah melaporkan tindak lanjut disposisi surat masuk:\n` +
      `• *No. Agenda:* ${sm.noAgenda}\n` +
      `• *Pengirim:* ${sm.asalSurat}\n` +
      `• *Perihal:* ${sm.perihal}\n` +
      `• *Laporan Hasil:* "${text}"\n` +
      `• *Pelapor:* ${user.fullName}\n` +
      `• *Status Disposisi:* ${sm.statusDisposisi}\n\n` +
      `Tinjau riwayat lengkap pada portal:\n` +
      `https://apologetislamindonesia.or.id/portal/#disposisi\n\n` +
      `_Pesan otomatis SIAP APII Enterprise v3.1_`;

    showWhatsAppRelayModal(targetPejabat.name, targetPejabat.roleLabel, targetPejabat.phone, msg);
  }

  function openTambahSuratMasukModal() {
    if (!Auth.hasPermission('surat_masuk:manage')) {
      showToast('Akses ditolak: Hanya Sekretaris Umum / DPW yang berwenang mencatat agenda surat masuk.', 'error');
      return;
    }
    const modal = document.getElementById('modal-tambah-surat-masuk');
    if (!modal) return;

    const user = Auth.getCurrentUser();
    const nextAgenda = State.generateNextNomorAgenda(user.tenantId);

    const elAgendaDisplay = document.getElementById('sm-form-no-agenda-display');
    const elAsal = document.getElementById('sm-form-asal');
    const elNoAsli = document.getElementById('sm-form-no-asli');
    const elTglSurat = document.getElementById('sm-form-tgl-surat');
    const elTglTerima = document.getElementById('sm-form-tgl-terima');
    const elPerihal = document.getElementById('sm-form-perihal');
    const elRingkasan = document.getElementById('sm-form-ringkasan');
    const elUrgensi = document.getElementById('sm-form-urgensi');
    const elRekomendasi = document.getElementById('sm-form-rekomendasi');
    const elDeadline = document.getElementById('sm-form-deadline');
    const elCatatan = document.getElementById('sm-form-catatan');

    if (elAgendaDisplay) elAgendaDisplay.textContent = nextAgenda;
    if (elAsal) elAsal.value = '';
    if (elNoAsli) elNoAsli.value = 'B-' + Math.floor(100 + Math.random() * 900) + '/SETJEN/XI/2026';
    if (elTglSurat) elTglSurat.value = formatTanggal();
    if (elTglTerima) elTglTerima.value = formatTanggal();
    if (elPerihal) elPerihal.value = '';
    if (elRingkasan) elRingkasan.value = '';
    if (elUrgensi) elUrgensi.value = 'SEGERA';
    if (elRekomendasi) elRekomendasi.value = 'Rekomendasi Sekretaris: Kaji secara mendalam dan tugaskan divisi pelaksana terkait untuk penanganan segera.';
    if (elDeadline) {
      const d = new Date(Date.now() + 7 * 86400000);
      elDeadline.value = formatTanggal(d);
    }
    if (elCatatan) elCatatan.value = '';

    modal.classList.remove('hidden');
  }

  function closeTambahSuratMasukModal() {
    const modal = document.getElementById('modal-tambah-surat-masuk');
    if (modal) modal.classList.add('hidden');
  }

  function setSmAsalChip(asalText) {
    const elAsal = document.getElementById('sm-form-asal');
    if (elAsal) {
      elAsal.value = asalText;
      elAsal.focus();
    }
  }

  function setSmRekomendasiChip(rekText) {
    const elRekomendasi = document.getElementById('sm-form-rekomendasi');
    if (elRekomendasi) {
      elRekomendasi.value = rekText;
      elRekomendasi.focus();
    }
  }

  function submitTambahSuratMasukModal() {
    if (!Auth.hasPermission('surat_masuk:manage')) {
      showToast('Akses ditolak: Hanya Sekretaris Umum / DPW yang berwenang mencatat agenda surat masuk.', 'error');
      return;
    }

    const asal = document.getElementById('sm-form-asal')?.value?.trim();
    const perihal = document.getElementById('sm-form-perihal')?.value?.trim();

    if (!asal) {
      showToast('Harap isi asal / instansi pengirim surat.', 'error');
      document.getElementById('sm-form-asal')?.focus();
      return;
    }

    if (!perihal) {
      showToast('Harap isi perihal pokok surat masuk.', 'error');
      document.getElementById('sm-form-perihal')?.focus();
      return;
    }

    const user = Auth.getCurrentUser();
    const db = State.getDb();
    const newAgenda = State.generateNextNomorAgenda(user.tenantId);

    // Dapatkan target divisi terpilih dari checklist
    const checkedDivisions = Array.from(document.querySelectorAll('input[name="sm_target_divisi"]:checked'))
      .map(cb => cb.value);
    const targetDivisi = checkedDivisions.length > 0 ? checkedDivisions : ['litbang', 'humas'];

    const noSuratAsli = document.getElementById('sm-form-no-asli')?.value?.trim() || ('B-' + Math.floor(100 + Math.random() * 900) + '/APII/XI/2026');
    const tglSurat = document.getElementById('sm-form-tgl-surat')?.value?.trim() || formatTanggal();
    const tglTerima = document.getElementById('sm-form-tgl-terima')?.value?.trim() || formatTanggal();
    const ringkasan = document.getElementById('sm-form-ringkasan')?.value?.trim() || ('Surat dinas resmi dari ' + asal);
    const urgensi = document.getElementById('sm-form-urgensi')?.value || 'SEGERA';
    const rekomendasi = document.getElementById('sm-form-rekomendasi')?.value?.trim() || 'Rekomendasi Sekretaris: Kaji secara mendalam dan tugaskan divisi pelaksana terkait.';
    const deadline = document.getElementById('sm-form-deadline')?.value?.trim() || formatTanggal(new Date(Date.now() + 7 * 86400000));
    const catatan = document.getElementById('sm-form-catatan')?.value?.trim() || '';
    const fileInput = document.getElementById('sm-form-file');
    const attachedFile = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

    const newSm = {
      id: 'SMK-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      tenantId: user.tenantId,
      noAgenda: newAgenda,
      asalSurat: asal,
      noSuratAsli: noSuratAsli,
      tglSurat: tglSurat,
      tglTerima: tglTerima,
      perihal: perihal,
      ringkasan: ringkasan,
      pdfFileUrl: '#',
      attachmentName: attachedFile ? attachedFile.name : '',
      attachmentType: attachedFile ? attachedFile.type : '',
      attachmentSizeKb: attachedFile ? Math.max(1, Math.round(attachedFile.size / 1024)) : 0,
      statusDisposisi: 'PENDING_KETUA',
      drafRekomendasiSekretaris: rekomendasi,
      targetDivisi: targetDivisi,
      tingkatUrgensi: urgensi,
      instruksiKetua: '',
      batasWaktu: deadline,
      catatanTambahan: catatan,
      parafKetua: null,
      laporanPerDivisi: {},
      laporanTindakLanjut: ''
    };

    db.suratMasuk.unshift(newSm);
    State.saveDatabase();
    State.logAudit('RECORD_SURAT_MASUK', 'SuratMasuk', newSm.id, { agenda: newAgenda, perihal: perihal, asal: asal });
    syncApiSafe('saveSuratMasuk', newSm);

    closeTambahSuratMasukModal();
    showToast(`Surat masuk berhasil dicatat ke agenda resmi: ${newAgenda}`);
    renderDisposisiWorkspace();

    const targetPejabat = resolveOfficerSafe('ketua', user.tenantId);
    const targetDivNames = targetDivisi.map(cd => CONFIG.DIVISIONS.find(d => d.code === cd)?.name || cd).join(', ');

    const msg = `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n` +
      `*NOTIFIKASI SURAT MASUK & REKOMENDASI DISPOSISI*\n\n` +
      `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
      `Yth. ${targetPejabat.name} (${targetPejabat.roleLabel})\n\n` +
      `Sekretariat telah meregistrasi surat dinas masuk baru ke Buku Agenda Digital:\n` +
      `• *No. Agenda:* ${newSm.noAgenda}\n` +
      `• *Pengirim:* ${newSm.asalSurat}\n` +
      `• *No. Surat Asli:* ${newSm.noSuratAsli}\n` +
      `• *Perihal:* ${newSm.perihal}\n` +
      `• *Urgensi:* ${newSm.tingkatUrgensi}\n` +
      `• *Rekomendasi Sekretaris:* ${newSm.drafRekomendasiSekretaris}\n` +
      `• *Rekomendasi Divisi:* ${targetDivNames}\n` +
      `• *Tenggat Waktu:* ${newSm.batasWaktu}\n\n` +
      `Mohon perkenan Ketua memberikan instruksi baku definitif & paraf digital melalui Portal Pengurus SIAP APII:\n` +
      `https://apologetislamindonesia.or.id/portal/#disposisi\n\n` +
      `_Pesan otomatis Buku Agenda Digital SIAP APII Enterprise v3.1_`;

    showWhatsAppRelayModal(targetPejabat.name, targetPejabat.roleLabel, targetPejabat.phone, msg);
  }

  // =========================================================================
  // 4. KAS SYAR'I (4 KANTONG, DUAL-APPROVAL, CASH BUFFER GUARD & SIMULATOR)
  // =========================================================================
  function renderKasWorkspace() {
    const db = State.getDb();
    const user = Auth.getCurrentUser();
    const tenantId = user.tenantId;
    const balances = db.kas.balances[tenantId] || db.kas.balances['DPP_PUSAT'] || {};

    const elOps = document.getElementById('kas-balance-ops');
    const elZakat = document.getElementById('kas-balance-zakat');
    const elInfaq = document.getElementById('kas-balance-infaq');
    const elWakaf = document.getElementById('kas-balance-wakaf');

    const opsBal = Number(balances.AMIL_OPERASIONAL || 0);
    if (elOps) elOps.textContent = 'Rp ' + opsBal.toLocaleString('id-ID');
    if (elZakat) elZakat.textContent = 'Rp ' + Number(balances.ZAKAT || 0).toLocaleString('id-ID');
    if (elInfaq) elInfaq.textContent = 'Rp ' + Number(balances.INFAQ_DAKWAH || 0).toLocaleString('id-ID');
    if (elWakaf) elWakaf.textContent = 'Rp ' + Number(balances.WAKAF || 0).toLocaleString('id-ID');

    // Cash Buffer Limit Banner (Rp 2.000.000)
    const bufferBanner = document.getElementById('kas-cash-buffer-banner');
    if (bufferBanner) {
      const limit = CONFIG.CASH_BUFFER_LIMIT || 2000000;
      bufferBanner.classList.remove('hidden');
      if (opsBal < limit) {
        bufferBanner.className = 'p-3.5 rounded-lg border border-red-300 bg-red-50 text-red-900 text-xs flex items-center gap-2.5';
        bufferBanner.innerHTML = `<span class="material-symbols-outlined text-[18px] text-red-700 shrink-0">warning</span><span><strong>PERINGATAN CASH BUFFER:</strong> Saldo Kas Operasional (<span class="tabular-nums font-bold">Rp ${opsBal.toLocaleString('id-ID')}</span>) berada di bawah batas aman <span class="tabular-nums font-bold">Rp ${limit.toLocaleString('id-ID')}</span>. Pengeluaran operasional baru memerlukan persetujuan ekstra.</span>`;
      } else {
        bufferBanner.className = 'p-3.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-950 text-xs flex items-center gap-2.5';
        bufferBanner.innerHTML = `<span class="material-symbols-outlined text-[18px] text-emerald-800 shrink-0">verified_user</span><span><strong>Cash Buffer Aman:</strong> Saldo Kas Operasional (<span class="tabular-nums font-bold">Rp ${opsBal.toLocaleString('id-ID')}</span>) memenuhi cadangan minimum <span class="tabular-nums font-bold">Rp ${limit.toLocaleString('id-ID')}</span>. Penjagaan 4 Kantong Syar'i aktif.</span>`;
      }
    }

    // Gating Tombol Kas Berdasarkan Kewenangan Bendahara
    const canRecordBkm = Auth.hasPermission('kas:record_bkm');
    const canSubmitBkk = Auth.hasPermission('kas:submit_bkk');
    const canSimulate = Auth.hasPermission('simulator:run');
    const canClose = Auth.hasPermission('keuangan:closing');
    const canVerifyDual = Auth.hasPermission('kas:verify_dual');
    const canApproveDual = Auth.hasPermission('kas:approve_dual');

    const btnBkm = document.getElementById('btn-tambah-bkm');
    const btnBkk = document.getElementById('btn-tambah-bkk');
    const btnSim = document.getElementById('btn-kas-simulator');
    const btnClose = document.getElementById('btn-kas-closing');

    if (btnBkm) btnBkm.classList.toggle('hidden', !canRecordBkm);
    if (btnBkk) btnBkk.classList.toggle('hidden', !canSubmitBkk);
    if (btnSim) btnSim.classList.toggle('hidden', !canSimulate);
    if (btnClose) btnClose.classList.toggle('hidden', !canClose);

    const kasNotice = document.getElementById('kas-role-notice');
    const kasNoticeText = document.getElementById('kas-role-notice-text');
    if (kasNotice && kasNoticeText) {
      if (user.role === 'ketua') {
        kasNotice.classList.remove('hidden');
        kasNoticeText.innerHTML = '<strong>Mode Otorisasi Pimpinan Eksekutif (Dual-Approval Tahap 2):</strong> Pencatatan BKM dan Pengajuan BKK adalah wewenang eksklusif <strong>Bendahara Umum / Bendahara DPW</strong> (PRD Bab 2.2). Kewenangan Anda adalah memeriksa dan memberikan pengesahan pengeluaran kas (Tahap 2) sebelum dana dicairkan.';
      } else if (user.isPembinaReadOnly || user.isPengawasReadOnly) {
        kasNotice.classList.remove('hidden');
        kasNoticeText.innerHTML = '<strong>Mode Tinjauan &amp; Forensic Audit (Read-Only):</strong> Pemantauan saldo 4 kantong syar\'i, inspeksi bukti nota kwitansi, dan rekonsiliasi bulanan PSAK 409 tanpa kewenangan mutasi kas.';
      } else {
        kasNotice.classList.add('hidden');
      }
    }

    const tbody = document.getElementById('kas-table-body');
    if (!tbody) return;

    let rowsHtml = '';
    const visibleTrx = db.kas.transactions.filter(t => isScopedRecordVisible(t.tenantId));
    visibleTrx.forEach(t => {
      let approvalBadge = '';
      if (t.statusApproval === 'APPROVED') {
        approvalBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900">LUNAS / DISETUJUI</span>';
      } else if (t.statusApproval === 'VERIFIKASI_BENDAHARA') {
        approvalBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900">TAHAP 1: BENDAHARA OK</span>';
      } else {
        approvalBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">DRAF PENGAJUAN</span>';
      }

      let actionsHtml = '';
      if (t.statusApproval === 'APPROVED') {
        actionsHtml = `
          <button type="button" onclick="App.openKwitansiModal('${t.id}')" class="px-2.5 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-xs font-semibold text-slate-900">
            Cetak Kwitansi Dual-Slip
          </button>
        `;
      } else if (t.statusApproval === 'VERIFIKASI_BENDAHARA') {
        if (canApproveDual) {
          actionsHtml = `
            <button type="button" onclick="App.approveKasKetua('${t.id}')" class="px-2.5 py-1.5 rounded bg-[#064E3B] text-white font-bold text-xs hover:bg-[#003527] shadow-sm">
              Sahkan Kas (Ketua)
            </button>
          `;
        } else {
          actionsHtml = `<span class="px-2 py-1 text-[11px] text-amber-800 font-semibold italic">Menunggu Otorisasi Ketua</span>`;
        }
      } else if (t.statusApproval === 'DRAFT') {
        if (canVerifyDual) {
          actionsHtml = `
            <button type="button" onclick="App.verifyKasBendahara('${t.id}')" class="px-2.5 py-1.5 rounded bg-blue-800 text-white font-bold text-xs hover:bg-blue-900 shadow-sm">
              Verifikasi Bendahara
            </button>
          `;
        } else {
          actionsHtml = `<span class="px-2 py-1 text-[11px] text-blue-800 font-semibold italic">Menunggu Verifikasi Bendahara</span>`;
        }
      }

      rowsHtml += `
        <tr class="border-b border-slate-200 hover:bg-slate-50 transition-colors">
          <td class="tabular-nums px-4 py-3 text-xs text-slate-600">${formatTanggalDisplay(t.tanggal)}</td>
          <td class="tabular-nums px-4 py-3 font-mono font-bold text-xs text-slate-900">${t.noVoucher}</td>
          <td class="px-4 py-3 text-xs text-slate-900 font-medium max-w-xs truncate">${t.keterangan}</td>
          <td class="px-4 py-3 text-xs font-semibold text-slate-800">${t.kantongSyariah}</td>
          <td class="tabular-nums px-4 py-3 text-right font-mono font-bold text-xs ${t.tipe === 'MASUK' ? 'text-emerald-800' : 'text-red-700'}">
            ${t.tipe === 'MASUK' ? '+' : '-'} Rp ${Number(t.nominal || 0).toLocaleString('id-ID')}
          </td>
          <td class="px-4 py-3 text-center">${approvalBadge}</td>
          <td class="px-4 py-3 text-right">${actionsHtml}</td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml || '<tr><td colspan="7" class="p-4 text-center text-xs text-slate-600">Belum ada transaksi kas pada wilayah ini.</td></tr>';
  }

  function openKasFormModal(mode) {
    const modal = document.getElementById('modal-kas-form');
    if (!modal) return;
    const isOut = mode === 'OUT';
    document.getElementById('kas-form-type').value = isOut ? 'OUT' : 'IN';
    document.getElementById('kas-form-title').textContent = isOut
      ? 'Ajukan Bukti Kas Keluar (BKK Dual-Approval)'
      : 'Catat Bukti Kas Masuk (BKM)';
    const header = document.getElementById('kas-form-header');
    if (header) {
      header.className = isOut
        ? 'p-4 bg-red-800 text-white flex items-center justify-between'
        : 'p-4 bg-[#064E3B] text-white flex items-center justify-between';
    }
    const walletEl = document.getElementById('kas-form-wallet');
    const katEl = document.getElementById('kas-form-kategori');
    const nomEl = document.getElementById('kas-form-nominal');
    const ketEl = document.getElementById('kas-form-keterangan');
    const chkEl = document.getElementById('kas-form-buffer-confirm');
    if (walletEl) walletEl.value = isOut ? 'AMIL_OPERASIONAL' : 'INFAQ_DAKWAH';
    if (katEl) katEl.value = isOut ? 'Operasional Dakwah' : 'Infaq Dakwah';
    if (nomEl) nomEl.value = isOut ? '1500000' : '5000000';
    if (ketEl) ketEl.value = '';
    if (chkEl) chkEl.checked = false;

    evaluateKasFormGuards();
    modal.classList.remove('hidden');
  }

  function openTambahBkmModal() {
    if (!Auth.hasPermission('kas:record_bkm')) {
      showToast('Akses ditolak: Hanya Bendahara Umum / DPW yang berwenang mencatat kas masuk (BKM).', 'error');
      return;
    }
    openKasFormModal('IN');
  }

  function openTambahBkkModal(directData = null) {
    if (!Auth.hasPermission('kas:submit_bkk')) {
      showToast('Akses ditolak: Hanya Bendahara Umum / DPW yang berwenang mengajukan kas keluar (BKK).', 'error');
      return;
    }
    openKasFormModal('OUT');
    if (directData && typeof directData === 'object' && directData.nominal > 0) {
      const user = Auth.getCurrentUser();
      const target = resolveOfficerSafe('bendahara', user.tenantId);
      showWhatsAppRelayModal(target.name, target.roleLabel || target.role, target.phone, `Draf BKK Rp ${Number(directData.nominal).toLocaleString('id-ID')}: ${directData.keterangan || ''}`);
    }
  }

  function evaluateKasFormGuards() {
    const mode = document.getElementById('kas-form-type')?.value || 'IN';
    const wallet = document.getElementById('kas-form-wallet')?.value || 'AMIL_OPERASIONAL';
    const kategori = document.getElementById('kas-form-kategori')?.value || '';
    const keterangan = document.getElementById('kas-form-keterangan')?.value || '';
    const nominal = parseInt(document.getElementById('kas-form-nominal')?.value || '0', 10) || 0;

    const shariaEl = document.getElementById('kas-form-sharia-alert');
    const bufferEl = document.getElementById('kas-form-buffer-alert');
    const bufferTextEl = document.getElementById('kas-form-buffer-text');
    const submitBtn = document.getElementById('kas-form-submit-btn');

    let shariaBlocked = false;
    if (mode === 'OUT' && typeof State.validateShariaExpense === 'function') {
      const check = State.validateShariaExpense(wallet, kategori, keterangan);
      if (check && check.valid === false) {
        shariaBlocked = true;
        if (shariaEl) {
          shariaEl.classList.remove('hidden');
          shariaEl.textContent = `GUARD SYARIAH: ${check.reason || 'Pengeluaran tidak sesuai peruntukan akad kantong syariah ini.'}`;
        }
      } else if (shariaEl) {
        shariaEl.classList.add('hidden');
      }
    } else if (shariaEl) {
      shariaEl.classList.add('hidden');
    }

    const db = State.getDb();
    const user = Auth.getCurrentUser();
    const balances = db.kas.balances[user.tenantId] || db.kas.balances['DPP_PUSAT'] || {};
    const limit = CONFIG.CASH_BUFFER_LIMIT || 2000000;
    const opsAfter = Number(balances.AMIL_OPERASIONAL || 0) - nominal;
    const needsBufferConfirm = mode === 'OUT' && ((wallet === 'AMIL_OPERASIONAL' && opsAfter < limit) || nominal > limit);

    if (bufferEl) {
      if (needsBufferConfirm) {
        bufferEl.classList.remove('hidden');
        if (bufferTextEl) {
          bufferTextEl.textContent = opsAfter < limit && wallet === 'AMIL_OPERASIONAL'
            ? `Peringatan Cash Buffer: Setelah pengeluaran Rp ${nominal.toLocaleString('id-ID')}, sisa Kas Operasional menjadi Rp ${Math.max(0, opsAfter).toLocaleString('id-ID')} (di bawah batas Rp ${limit.toLocaleString('id-ID')}).`
            : `Peringatan Cash Buffer: Pengeluaran Rp ${nominal.toLocaleString('id-ID')} melebihi batas tunai kasir Rp ${limit.toLocaleString('id-ID')} dan wajib menggunakan Transfer Bank Syariah.`;
        }
      } else {
        bufferEl.classList.add('hidden');
      }
    }

    if (submitBtn) {
      submitBtn.disabled = shariaBlocked;
      submitBtn.classList.toggle('opacity-40', shariaBlocked);
      submitBtn.classList.toggle('cursor-not-allowed', shariaBlocked);
    }
    return { shariaBlocked, needsBufferConfirm };
  }

  function submitKasForm() {
    const mode = document.getElementById('kas-form-type')?.value || 'IN';
    const wallet = document.getElementById('kas-form-wallet')?.value || 'INFAQ_DAKWAH';
    const kategori = document.getElementById('kas-form-kategori')?.value?.trim() || 'Umum';
    const keterangan = document.getElementById('kas-form-keterangan')?.value?.trim();
    const nominal = parseInt(document.getElementById('kas-form-nominal')?.value || '0', 10) || 0;

    if (!nominal || nominal <= 0 || !keterangan) {
      showToast('Nominal dan uraian transaksi wajib diisi dengan benar.', 'error');
      return;
    }

    const guards = evaluateKasFormGuards();
    if (guards.shariaBlocked) {
      showToast('Transaksi diblokir oleh Sharia Wallet Guard.', 'error');
      return;
    }
    if (guards.needsBufferConfirm && !document.getElementById('kas-form-buffer-confirm')?.checked) {
      showToast('Centang konfirmasi peringatan Cash Buffer sebelum melanjutkan.', 'warning');
      return;
    }

    const db = State.getDb();
    const user = Auth.getCurrentUser();
    const balances = db.kas.balances[user.tenantId] || db.kas.balances['DPP_PUSAT'];
    const limit = CONFIG.CASH_BUFFER_LIMIT || 2000000;

    if (mode === 'IN') {
      if (!Auth.hasPermission('kas:record_bkm')) return;
      const newVoucher = 'BKM-202611-' + (db.kas.transactions.length + 1).toString().padStart(3, '0');
      const ketum = resolveOfficerSafe('ketua', user.tenantId);
      const newTrx = {
        id: 'TRX-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
        tenantId: user.tenantId,
        tanggal: formatTanggal(),
        tipe: 'MASUK',
        kantongSyariah: wallet,
        kategori: kategori,
        nominal: nominal,
        noVoucher: newVoucher,
        noKwitansi: 'KWT-' + newVoucher,
        keterangan: keterangan,
        pihakTerkait: 'Jamaah / Donatur',
        metode: 'TRANSFER_BANK',
        statusApproval: 'APPROVED',
        verifiedBendaharaBy: user.fullName,
        approvedKetuaBy: ketum.name,
        buktiUrl: '#'
      };
      db.kas.transactions.unshift(newTrx);
      balances[wallet] = (balances[wallet] || 0) + nominal;
      State.saveDatabase();
      State.logAudit('RECORD_BKM', 'Keuangan', newTrx.id, { voucher: newVoucher, wallet, nominal });
      syncApiSafe('saveKasMasuk', newTrx);

      closeModal('modal-kas-form');
      showToast(`Kas masuk Rp ${nominal.toLocaleString('id-ID')} (${wallet}) berhasil dicatat!`);
      renderKasWorkspace();
      return;
    }

    // Mode OUT (BKK)
    if (!Auth.hasPermission('kas:submit_bkk')) return;
    if ((balances[wallet] || 0) < nominal) {
      showToast(`Saldo kantong ${wallet} tidak mencukupi (tersedia Rp ${(balances[wallet] || 0).toLocaleString('id-ID')}).`, 'error');
      return;
    }

    const newVoucher = 'DRAFT-KEU-' + (db.kas.transactions.length + 1).toString().padStart(3, '0');
    const newTrx = {
      id: 'TRX-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      tenantId: user.tenantId,
      tanggal: formatTanggal(),
      tipe: 'KELUAR',
      kantongSyariah: wallet,
      kategori: kategori,
      nominal: nominal,
      noVoucher: newVoucher,
      noKwitansi: 'PENDING',
      keterangan: keterangan,
      pihakTerkait: 'Divisi Pelaksana',
      metode: nominal > limit ? 'TRANSFER_BANK' : 'TUNAI',
      statusApproval: 'DRAFT',
      verifiedBendaharaBy: null,
      approvedKetuaBy: null,
      buktiUrl: '#'
    };

    db.kas.transactions.unshift(newTrx);
    State.saveDatabase();
    State.logAudit('SUBMIT_BKK_DRAFT', 'Keuangan', newTrx.id, { voucher: newVoucher, wallet, nominal });
    syncApiSafe('ajukanKasKeluar', newTrx);

    closeModal('modal-kas-form');
    showToast(`Pengajuan kas keluar ${newVoucher} dicatat. Menunggu verifikasi Tahap 1 Bendahara.`);
    renderKasWorkspace();

    const bendaharaPejabat = resolveOfficerSafe('bendahara', user.tenantId);
    const msg = `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n` +
      `*PERMOHONAN DUAL-APPROVAL KAS KELUAR TAHAP 1*\n\n` +
      `Kepada Yth: ${bendaharaPejabat.name} (${bendaharaPejabat.roleLabel})\n\n` +
      `Pengajuan kas keluar baru membutuhkan verifikasi Anda:\n` +
      `• *Kode Draf:* ${newVoucher}\n` +
      `• *Kantong Syariah:* ${wallet}\n` +
      `• *Nominal:* Rp ${nominal.toLocaleString('id-ID')}\n` +
      `• *Uraian:* ${newTrx.keterangan}\n` +
      `• *Pemohon:* ${user.fullName}\n\n` +
      `Silakan verifikasi melalui Portal Pengurus SIAP APII:\n` +
      `https://apologetislamindonesia.or.id/portal/#kas`;

    showWhatsAppRelayModal(bendaharaPejabat.name, bendaharaPejabat.roleLabel, bendaharaPejabat.phone, msg);
  }

  function verifyKasBendahara(trxId) {
    if (!Auth.hasPermission('kas:verify_dual')) {
      showToast('Akses ditolak: Hanya Bendahara yang berwenang melakukan Verifikasi Kas Tahap 1.', 'error');
      return;
    }

    const user = Auth.getCurrentUser();
    const db = State.getDb();
    const trx = db.kas.transactions.find(t => t.id === trxId);
    if (!trx) return;

    trx.statusApproval = 'VERIFIKASI_BENDAHARA';
    trx.verifiedBendaharaBy = user.fullName;
    State.saveDatabase();
    State.logAudit('VERIFY_KAS_BENDAHARA', 'Keuangan', trxId, { voucher: trx.noVoucher });
    syncApiSafe('verifyKasBendahara', { id: trxId, verifiedBy: user.fullName });

    showToast(`Kas ${trx.noVoucher} lolos verifikasi Bendahara! Menunggu otorisasi Ketua.`);
    renderKasWorkspace();

    const ketumPejabat = resolveOfficerSafe('ketua', trx.tenantId);
    const msg = `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n` +
      `*DUAL-APPROVAL KAS KELUAR TAHAP 2 (KETUA)*\n\n` +
      `Yth. ${ketumPejabat.name} (${ketumPejabat.roleLabel})\n\n` +
      `Bendahara telah memverifikasi pengeluaran kas:\n` +
      `• *Kode Voucher:* ${trx.noVoucher}\n` +
      `• *Kantong:* ${trx.kantongSyariah}\n` +
      `• *Nominal:* Rp ${trx.nominal.toLocaleString('id-ID')}\n` +
      `• *Uraian:* ${trx.keterangan}\n\n` +
      `Mohon otorisasi akhir pencairan dana:\n` +
      `https://apologetislamindonesia.or.id/portal/#kas`;

    showWhatsAppRelayModal(ketumPejabat.name, ketumPejabat.roleLabel, ketumPejabat.phone, msg);
  }

  function approveKasKetua(trxId) {
    if (!Auth.hasPermission('kas:approve_dual')) {
      showToast('Akses ditolak: Hanya Ketua yang berwenang melakukan Pengesahan Pencairan Kas Tahap 2.', 'error');
      return;
    }

    const user = Auth.getCurrentUser();
    const db = State.getDb();
    const trx = db.kas.transactions.find(t => t.id === trxId);
    if (!trx) return;

    if (typeof State.validateShariaExpense === 'function' && trx.tipe === 'KELUAR') {
      const check = State.validateShariaExpense(trx.kantongSyariah, trx.kategori, trx.keterangan);
      if (check && check.valid === false) {
        showToast(`Diblokir Sharia Guard: ${check.reason}`, 'error');
        return;
      }
    }

    trx.statusApproval = 'APPROVED';
    trx.approvedKetuaBy = user.fullName;
    trx.noVoucher = trx.noVoucher.replace('DRAFT-KEU', 'BKK-202611');
    trx.noKwitansi = 'KWT-' + trx.noVoucher;

    const balances = db.kas.balances[trx.tenantId] || db.kas.balances['DPP_PUSAT'];
    balances[trx.kantongSyariah] = Math.max(0, (balances[trx.kantongSyariah] || 0) - trx.nominal);

    // Increment realisasiDana program kerja ONLY when linked BKK is APPROVED
    if (trx.prokerId && Array.isArray(db.proker)) {
      const linkedProker = db.proker.find(p => p.id === trx.prokerId);
      if (linkedProker) {
        linkedProker.realisasiDana = (linkedProker.realisasiDana || 0) + trx.nominal;
        if (linkedProker.status === 'PAGU_DISETUJUI' || linkedProker.status === 'PENCAIRAN_PROSES') {
          linkedProker.status = 'BERJALAN';
        }
      }
    }

    State.saveDatabase();
    State.logAudit('APPROVE_KAS_KETUA', 'Keuangan', trxId, { voucher: trx.noVoucher, nominal: trx.nominal, prokerId: trx.prokerId || null });
    syncApiSafe('approveKasKetua', { id: trxId, approvedBy: user.fullName });

    showToast(`Pengeluaran kas disahkan Ketua! Saldo dipotong dan nomor ${trx.noVoucher} terbit.`);
    renderKasWorkspace();

    const targetBendahara = resolveOfficerSafe('bendahara', trx.tenantId);
    const msg = `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n` +
      `*PENGESAHAN KAS KELUAR TAHAP 2 SELESAI (SIAP CAIR)*\n\n` +
      `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
      `Yth. ${targetBendahara.name} (${targetBendahara.roleLabel})\n\n` +
      `Ketua telah mengesahkan pengeluaran kas dinas (Dual-Approval Selesai):\n` +
      `• *Nomor Voucher BKK:* ${trx.noVoucher}\n` +
      `• *Nomor Kwitansi:* ${trx.noKwitansi}\n` +
      `• *Nominal:* Rp ${trx.nominal.toLocaleString('id-ID')}\n` +
      `• *Kantong Syariah:* ${trx.kantongSyariah}\n` +
      `• *Keperluan:* ${trx.keterangan || trx.kategori}\n` +
      `• *Disahkan Oleh:* ${user.fullName}\n\n` +
      `Saldo pembukuan resmi telah dipotong. Silakan cetak kwitansi dual-slip:\n` +
      `https://apologetislamindonesia.or.id/portal/#kas\n\n` +
      `_Pesan otomatis SIAP APII Enterprise v3.1_`;

    showWhatsAppRelayModal(targetBendahara.name, targetBendahara.roleLabel, targetBendahara.phone, msg);
  }

  function recalculateKasSimulator() {
    const db = State.getDb();
    const user = Auth.getCurrentUser();
    const balances = db.kas.balances[user.tenantId] || db.kas.balances['DPP_PUSAT'] || {};
    const burnOps = parseInt(document.getElementById('sim-burn-ops')?.value || '5000000', 10) || 1;
    const inflowInfaq = parseInt(document.getElementById('sim-inflow-infaq')?.value || '8000000', 10) || 0;
    const opsNow = Number(balances.AMIL_OPERASIONAL || 0);
    const zakatNow = Number(balances.ZAKAT || 0);
    const infaqNow = Number(balances.INFAQ_DAKWAH || 0);
    const wakafNow = Number(balances.WAKAF || 0);
    const runwayMonths = (opsNow / Math.max(1, burnOps)).toFixed(1);
    const infaq6M = infaqNow + (inflowInfaq * 6);

    const box = document.getElementById('sim-result-box');
    if (box) {
      box.innerHTML = `
        <div class="flex justify-between"><span>Ketahanan Kas Operasional:</span><strong class="tabular-nums text-slate-900">${runwayMonths} Bulan</strong></div>
        <div class="flex justify-between"><span>Saldo Zakat Siap Salur (8 Ashnaf):</span><strong class="tabular-nums text-amber-800">Rp ${zakatNow.toLocaleString('id-ID')}</strong></div>
        <div class="flex justify-between"><span>Proyeksi Infaq Dakwah (6 Bulan):</span><strong class="tabular-nums text-emerald-800">Rp ${infaq6M.toLocaleString('id-ID')}</strong></div>
        <div class="flex justify-between"><span>Saldo Wakaf Produktif (Aset Abadi):</span><strong class="tabular-nums text-blue-800">Rp ${wakafNow.toLocaleString('id-ID')}</strong></div>
      `;
    }
  }

  function openKasSimulatorModal() {
    if (!Auth.hasPermission('simulator:run')) {
      showToast('Akses ditolak: Simulator kas hanya dapat dijalankan oleh Bendahara atau Administrator.', 'error');
      return;
    }
    recalculateKasSimulator();
    document.getElementById('modal-kas-simulator')?.classList.remove('hidden');
  }

  function openClosingModal() {
    if (!Auth.hasPermission('keuangan:closing')) {
      showToast('Akses ditolak: Tutup buku PSAK 409 hanya dapat dijalankan oleh Bendahara.', 'error');
      return;
    }
    const db = State.getDb();
    const user = Auth.getCurrentUser();
    const balances = db.kas.balances[user.tenantId] || db.kas.balances['DPP_PUSAT'] || {};
    const scopedTrx = db.kas.transactions.filter(t => isScopedRecordVisible(t.tenantId));
    const pendingCount = scopedTrx.filter(t => t.statusApproval !== 'APPROVED').length;
    const totalSaldo = Number(balances.AMIL_OPERASIONAL || 0) + Number(balances.ZAKAT || 0) + Number(balances.INFAQ_DAKWAH || 0) + Number(balances.WAKAF || 0);
    const pengawas = resolveOfficerSafe('pengawas', user.tenantId);

    const box = document.getElementById('closing-psak-summary');
    if (box) {
      box.innerHTML = `
        <div class="p-3 rounded bg-slate-50 border border-slate-200 space-y-1.5">
          <div class="flex justify-between"><span>Wilayah Pembukuan:</span><strong>${user.tenantId}</strong></div>
          <div class="flex justify-between"><span>Total Transaksi Tercatat:</span><strong class="tabular-nums">${scopedTrx.length} Voucher</strong></div>
          <div class="flex justify-between"><span>Total Saldo 4 Kantong Syar'i:</span><strong class="tabular-nums text-emerald-900">Rp ${totalSaldo.toLocaleString('id-ID')}</strong></div>
          <div class="flex justify-between"><span>Antrean Pending Dual-Approval:</span><strong class="tabular-nums ${pendingCount > 0 ? 'text-amber-800' : 'text-emerald-800'}">${pendingCount} Berkas</strong></div>
          <div class="flex justify-between"><span>Pemeriksa Dewan Pengawas:</span><strong>${pengawas.name}</strong></div>
          <div class="flex justify-between"><span>Folder Arsip Drive Vault:</span><strong class="font-mono">04_BUKTI_KAS_KWITANSI</strong></div>
        </div>
      `;
    }
    document.getElementById('modal-kas-closing')?.classList.remove('hidden');
  }

  function executePsakClosing() {
    if (!Auth.hasPermission('keuangan:closing')) return;
    const user = Auth.getCurrentUser();
    const db = State.getDb();
    const balances = db.kas.balances[user.tenantId] || db.kas.balances['DPP_PUSAT'] || {};
    const checksum = State.computeSha256(JSON.stringify(balances) + formatWaktu());
    State.logAudit('CLOSING_PSAK_409', 'Keuangan', user.tenantId, {
      closedBy: user.fullName,
      checksum: checksum,
      folder: '04_BUKTI_KAS_KWITANSI'
    });
    syncApiSafe('generateMonthlyClosing', { tenantId: user.tenantId, checksum });
    closeModal('modal-kas-closing');
    showToast(`Rekonsiliasi PSAK 409 disegel! Checksum SHA-256: ${checksum.substring(0, 14)}...`);
  }

  function openKwitansiModal(trxId) {
    const db = State.getDb();
    const trx = db.kas.transactions.find(t => t.id === trxId);
    if (!trx) return;

    const bendahara = resolveOfficerSafe('bendahara', trx.tenantId);
    const nomFormatted = 'Rp ' + Number(trx.nominal || 0).toLocaleString('id-ID');
    const tglFormatted = formatTanggalDisplay(trx.tanggal);
    const terbilangStr = (typeof State.formatTerbilang === 'function')
      ? State.formatTerbilang(trx.nominal)
      : `${Number(trx.nominal || 0).toLocaleString('id-ID')} Rupiah`;

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setTxt('kwitansi-arsip-no', trx.noKwitansi || trx.noVoucher);
    setTxt('kwitansi-arsip-tgl', tglFormatted);
    setTxt('kwitansi-arsip-wallet', trx.kantongSyariah);
    setTxt('kwitansi-arsip-jenis', trx.tipe === 'MASUK' ? 'BKM (Kas Masuk)' : 'BKK (Kas Keluar)');
    setTxt('kwitansi-arsip-nominal', nomFormatted);
    setTxt('kwitansi-arsip-ket', trx.keterangan || trx.kategori);
    setTxt('kwitansi-arsip-bendahara', trx.verifiedBendaharaBy || bendahara.name);

    setTxt('kwitansi-main-badge', trx.tipe === 'MASUK' ? 'BUKTI KAS MASUK (BKM)' : 'BUKTI KAS KELUAR (BKK)');
    setTxt('kwitansi-main-no', `${trx.noKwitansi || trx.noVoucher} / ${trx.noVoucher}`);
    setTxt('kwitansi-main-tgl', tglFormatted);
    setTxt('kwitansi-main-wallet', trx.kantongSyariah);
    setTxt('kwitansi-main-kat', trx.kategori || '-');
    setTxt('kwitansi-main-ket', trx.keterangan || '-');
    setTxt('kwitansi-main-nominal', nomFormatted);
    setTxt('kwitansi-main-terbilang', `Terbilang: ${terbilangStr}`);
    setTxt('kwitansi-main-approval', `${trx.verifiedBendaharaBy || bendahara.name} & ${trx.approvedKetuaBy || 'Ketua APII'}`);
    setTxt('kwitansi-main-bendahara', trx.verifiedBendaharaBy || bendahara.name);

    document.getElementById('modal-kwitansi-print')?.classList.remove('hidden');
  }

  // =========================================================================
  // 5. PROGRAM KERJA 7 DIVISI RESMI (ART PASAL 16)
  // =========================================================================
  function renderProkerWorkspace() {
    const db = State.getDb();
    const user = Auth.getCurrentUser();
    const tbody = document.getElementById('proker-table-body');
    if (!tbody) return;

    // Toggle Tombol Usulkan Proker (Hanya Ketua Divisi & Superadmin)
    const btnTambahProker = document.getElementById('btn-tambah-proker');
    if (btnTambahProker) {
      if (Auth.hasPermission('proker:compose')) {
        btnTambahProker.classList.remove('hidden');
      } else {
        btnTambahProker.classList.add('hidden');
      }
    }

    // Notice Peran & Kewenangan Proker
    const prokerNotice = document.getElementById('proker-role-notice');
    const prokerNoticeText = document.getElementById('proker-role-notice-text');
    if (prokerNotice && prokerNoticeText) {
      if (user.role === 'ketua') {
        prokerNotice.classList.remove('hidden');
        prokerNoticeText.innerHTML = '<strong>Mode Otorisasi Pimpinan Eksekutif:</strong> Usulan program kerja diajukan oleh masing-masing Ketua Divisi (ART Pasal 16). Kewenangan Anda adalah memeriksa kelayakan dan memberikan persetujuan pagu anggaran RAB.';
      } else if (user.role === 'bendahara') {
        prokerNotice.classList.remove('hidden');
        prokerNoticeText.innerHTML = '<strong>Mode Pemantauan Anggaran Keuangan:</strong> Pantau realisasi kas program kerja divisi dan permohonan pencairan dana berkala.';
      } else if (user.isPembinaReadOnly || user.isPengawasReadOnly) {
        prokerNotice.classList.remove('hidden');
        prokerNoticeText.innerHTML = '<strong>Mode Evaluasi Makro & Audit (Read-Only):</strong> Pemantauan realisasi proker 7 divisi resmi dan evaluasi serapan anggaran tanpa kewenangan mutasi data.';
      } else {
        prokerNotice.classList.add('hidden');
      }
    }

    let rowsHtml = '';
    const isDivRole = (user.role === 'ketua_divisi' || user.role === 'anggota_divisi') && !!user.divisi;
    const visibleProker = db.proker.filter(p =>
      isScopedRecordVisible(p.tenantId, isDivRole ? p.divisiKode : null)
    );

    visibleProker.forEach(p => {
      let statusBadge = '';
      if (p.status === 'DISETUJUI' || p.status === 'PAGU_DISETUJUI') {
        statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900">PAGU DISETUJUI</span>';
      } else if (p.status === 'PENCAIRAN_PROSES') {
        statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900">MENUNGGU CAIR KAS</span>';
      } else if (p.status === 'PELAKSANAAN' || p.status === 'BERJALAN') {
        statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900">PELAKSANAAN</span>';
      } else if (p.status === 'AJUKAN') {
        statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">MENUNGGU REVIEW</span>';
      } else if (p.status === 'LPJ_SELESAI') {
        statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-800 text-white">LPJ SELESAI</span>';
      } else {
        statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">${p.status}</span>`;
      }

      let actionsHtml = '';
      const isMyProker = user.role === 'superadmin' || (user.role === 'ketua_divisi' && p.divisiKode === user.divisi);
      const isMyTenant = user.isNationalExecutive || p.tenantId === user.tenantId;

      if (p.status === 'DISETUJUI' || p.status === 'PAGU_DISETUJUI') {
        if (Auth.hasPermission('dana:request') && isMyProker && isMyTenant) {
          actionsHtml = `
            <button type="button" onclick="App.ajukanPencairanProker('${p.id}')" class="px-2.5 py-1.5 rounded bg-[#064E3B] text-white font-bold text-xs hover:bg-[#003527] shadow-sm">
              Ajukan Pencairan Dana
            </button>
          `;
        } else if (user.role === 'ketua_divisi' && p.divisiKode !== user.divisi) {
          actionsHtml = `<span class="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-semibold">Khusus ${p.divisiNama}</span>`;
        } else {
          actionsHtml = `<span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 text-[11px] font-semibold">Pagu Siap Dicairkan</span>`;
        }
      } else if (p.status === 'PENCAIRAN_PROSES') {
        actionsHtml = `<span class="px-2 py-0.5 rounded bg-blue-50 text-blue-900 text-[11px] font-semibold">Menunggu Dual-Approval Kas</span>`;
      } else if (p.status === 'PELAKSANAAN' || p.status === 'BERJALAN') {
        if (Auth.hasPermission('lpj:submit') && isMyProker && isMyTenant) {
          actionsHtml = `
            <button type="button" onclick="App.unggahLpjProker('${p.id}')" class="px-2.5 py-1.5 rounded bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 shadow-sm">
              Unggah LPJ &amp; Rekonsiliasi
            </button>
          `;
        } else if (user.role === 'ketua_divisi' && p.divisiKode !== user.divisi) {
          actionsHtml = `<span class="px-2 py-0.5 rounded bg-blue-50 text-blue-900 text-[11px] font-semibold">Pelaksanaan (${p.divisiNama})</span>`;
        } else {
          actionsHtml = `<span class="px-2 py-0.5 rounded bg-blue-50 text-blue-900 text-[11px] font-semibold">Sedang Dilaksanakan</span>`;
        }
      } else if (p.status === 'AJUKAN') {
        if (Auth.hasPermission('proker:approve')) {
          actionsHtml = `
            <button type="button" onclick="App.setujuiPaguProker('${p.id}')" class="px-2.5 py-1.5 rounded bg-[#064E3B] text-white font-bold text-xs hover:bg-[#003527] shadow-sm">
              Setujui Pagu RAB
            </button>
          `;
        } else {
          actionsHtml = `<span class="px-2 py-0.5 rounded bg-amber-50 text-amber-900 text-[11px] font-semibold">Menunggu Persetujuan Ketua</span>`;
        }
      } else if (p.status === 'LPJ_SELESAI') {
        actionsHtml = `<span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 text-[11px] font-semibold">Tuntas &amp; Terarsip</span>`;
      }

      rowsHtml += `
        <tr class="border-b border-slate-200 hover:bg-slate-50 transition-colors">
          <td class="px-4 py-3 text-xs font-bold text-slate-900">${p.divisiNama}</td>
          <td class="px-4 py-3 text-xs text-slate-900 font-medium max-w-xs truncate">${p.namaProgram}</td>
          <td class="tabular-nums px-4 py-3 text-right font-mono font-bold text-xs text-slate-900">Rp ${Number(p.rabNominal || 0).toLocaleString('id-ID')}</td>
          <td class="tabular-nums px-4 py-3 text-right font-mono font-bold text-xs text-emerald-900">Rp ${Number(p.realisasiDana || 0).toLocaleString('id-ID')}</td>
          <td class="px-4 py-3 text-center">${statusBadge}</td>
          <td class="px-4 py-3 text-right">${actionsHtml}</td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml || '<tr><td colspan="6" class="p-4 text-center text-xs text-slate-600">Belum ada program kerja pada lingkup Anda.</td></tr>';
  }

  function ajukanPencairanProker(prokerId) {
    if (!Auth.hasPermission('dana:request')) {
      showToast('Akses ditolak: Hanya Ketua Divisi yang berwenang mengajukan pencairan dana.', 'error');
      return;
    }

    const user = Auth.getCurrentUser();
    const db = State.getDb();
    const proker = db.proker.find(p => p.id === prokerId);
    if (!proker) return;

    if (user.role === 'ketua_divisi' && proker.divisiKode !== user.divisi) {
      showToast(`Akses Ditolak: Anda adalah Ketua Divisi ${user.divisi}, tidak berwenang mengajukan pencairan dana proker milik ${proker.divisiNama}.`, 'error');
      return;
    }
    if (!user.isNationalExecutive && proker.tenantId !== user.tenantId) {
      showToast('Akses Ditolak: Program kerja ini berada di luar yurisdiksi wilayah kepengurusan Anda.', 'error');
      return;
    }

    const sisaPagu = Math.max(0, (proker.rabNominal || 0) - (proker.realisasiDana || 0));
    document.getElementById('proker-action-id').value = proker.id;
    document.getElementById('proker-action-mode').value = 'cairkan';
    document.getElementById('proker-action-title').textContent = 'Ajukan Pencairan Dana Program Kerja';
    document.getElementById('proker-action-nama').textContent = proker.namaProgram;
    document.getElementById('proker-action-info').textContent = `Pagu RAB: Rp ${proker.rabNominal.toLocaleString('id-ID')} | Sisa Pagu: Rp ${sisaPagu.toLocaleString('id-ID')}`;
    document.getElementById('proker-action-wallet-wrap').classList.remove('hidden');
    document.getElementById('proker-action-wallet').value = proker.kantongSyariah || 'INFAQ_DAKWAH';
    document.getElementById('proker-action-nominal-label').textContent = 'Nominal Permohonan Pencairan (Rp) *';
    document.getElementById('proker-action-nominal').value = sisaPagu;
    document.getElementById('proker-action-catatan-wrap').classList.remove('hidden');
    document.getElementById('proker-action-catatan').value = '';
    document.getElementById('proker-action-submit-btn').textContent = 'Ajukan BKK ke Bendahara';

    if (arguments.length > 1 && arguments[1] && typeof arguments[1] === 'object') {
      const bnd = resolveOfficerSafe('bendahara', proker.tenantId || user.tenantId);
      showWhatsAppRelayModal(bnd.name, bnd.roleLabel || bnd.role, bnd.phone, `Permohonan Pencairan Proker ${proker.namaProgram}`);
      return;
    }
    document.getElementById('modal-proker-action')?.classList.remove('hidden');
  }

  function unggahLpjProker(prokerId) {
    if (!Auth.hasPermission('lpj:submit')) {
      showToast('Akses ditolak: Hanya Ketua Divisi yang berwenang mengunggah berkas LPJ.', 'error');
      return;
    }

    const user = Auth.getCurrentUser();
    const db = State.getDb();
    const proker = db.proker.find(p => p.id === prokerId);
    if (!proker) return;

    if (user.role === 'ketua_divisi' && proker.divisiKode !== user.divisi) {
      showToast(`Akses Ditolak: Anda adalah Ketua Divisi ${user.divisi}, tidak berwenang mengunggah LPJ proker milik ${proker.divisiNama}.`, 'error');
      return;
    }
    if (!user.isNationalExecutive && proker.tenantId !== user.tenantId) {
      showToast('Akses Ditolak: Program kerja ini berada di luar yurisdiksi wilayah kepengurusan Anda.', 'error');
      return;
    }

    document.getElementById('proker-action-id').value = proker.id;
    document.getElementById('proker-action-mode').value = 'lpj';
    document.getElementById('proker-action-title').textContent = 'Unggah LPJ & Rekonsiliasi Sisa Kas';
    document.getElementById('proker-action-nama').textContent = proker.namaProgram;
    document.getElementById('proker-action-info').textContent = `Pagu RAB: Rp ${proker.rabNominal.toLocaleString('id-ID')} | Realisasi Kas: Rp ${proker.realisasiDana.toLocaleString('id-ID')}`;
    document.getElementById('proker-action-wallet-wrap').classList.add('hidden');
    document.getElementById('proker-action-nominal-label').textContent = 'Sisa Kas Dikembalikan ke Bendahara (Rp, 0 jika habis) *';
    document.getElementById('proker-action-nominal').value = 0;
    document.getElementById('proker-action-catatan-wrap').classList.remove('hidden');
    document.getElementById('proker-action-catatan').value = '';
    document.getElementById('proker-action-submit-btn').textContent = 'Selesaikan LPJ & Rekonsiliasi';

    if (arguments.length > 1 && arguments[1] && typeof arguments[1] === 'object') {
      const bnd = resolveOfficerSafe('bendahara', proker.tenantId || user.tenantId);
      showWhatsAppRelayModal(bnd.name, bnd.roleLabel || bnd.role, bnd.phone, `Pengumpulan LPJ Proker ${proker.namaProgram}`);
      return;
    }
    document.getElementById('modal-proker-action')?.classList.remove('hidden');
  }

  function submitProkerAction() {
    const prokerId = document.getElementById('proker-action-id')?.value;
    const mode = document.getElementById('proker-action-mode')?.value;
    const nominal = parseInt(document.getElementById('proker-action-nominal')?.value || '0', 10) || 0;
    const catatan = document.getElementById('proker-action-catatan')?.value?.trim() || '';
    const user = Auth.getCurrentUser();
    const db = State.getDb();
    const proker = db.proker.find(p => p.id === prokerId);
    if (!proker) return;

    if (mode === 'cairkan') {
      const wallet = document.getElementById('proker-action-wallet')?.value || proker.kantongSyariah || 'INFAQ_DAKWAH';
      if (nominal <= 0) {
        showToast('Nominal pencairan harus lebih dari Rp 0.', 'error');
        return;
      }
      if (typeof State.validateShariaExpense === 'function') {
        const check = State.validateShariaExpense(wallet, 'Pencairan Proker Divisi', proker.namaProgram);
        if (check && check.valid === false) {
          showToast(`Diblokir Sharia Guard: ${check.reason}`, 'error');
          return;
        }
      }

      const newVoucher = 'DRAFT-KEU-PRK-' + (db.kas.transactions.length + 1);
      const newTrx = {
        id: 'TRX-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
        tenantId: proker.tenantId || user.tenantId,
        prokerId: proker.id,
        tanggal: formatTanggal(),
        tipe: 'KELUAR',
        kantongSyariah: wallet,
        kategori: 'Pencairan Proker Divisi',
        nominal: nominal,
        noVoucher: newVoucher,
        noKwitansi: 'PENDING',
        keterangan: `Pencairan Proker ${proker.divisiNama}: ${proker.namaProgram}${catatan ? ' (' + catatan + ')' : ''}`,
        pihakTerkait: proker.divisiNama,
        metode: nominal > (CONFIG.CASH_BUFFER_LIMIT || 2000000) ? 'TRANSFER_BANK' : 'TUNAI',
        statusApproval: 'DRAFT',
        verifiedBendaharaBy: null,
        approvedKetuaBy: null,
        buktiUrl: '#'
      };

      db.kas.transactions.unshift(newTrx);
      proker.kantongSyariah = wallet;
      proker.status = 'PENCAIRAN_PROSES';
      // Note: proker.realisasiDana ONLY increments when linked BKK is APPROVED in approveKasKetua()

      State.saveDatabase();
      State.logAudit('PENCAIRAN_PROKER', 'Proker', prokerId, { voucher: newVoucher, wallet, nominal, divisi: user.divisi });
      syncApiSafe('requestProkerDisbursement', newTrx);

      closeModal('modal-proker-action');
      showToast(`Draf BKK ${newVoucher} dibuat! Realisasi dana bertambah setelah Dual-Approval selesai.`);
      renderProkerWorkspace();

      const targetBendahara = resolveOfficerSafe('bendahara', proker.tenantId || user.tenantId);
      const msg = `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n` +
        `*PERMOHONAN PENCAIRAN KAS PROGRAM KERJA DIVISI*\n\n` +
        `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
        `Yth. ${targetBendahara.name} (${targetBendahara.roleLabel})\n\n` +
        `Permohonan pencairan kas program kerja baru telah diajukan:\n` +
        `• *Nomor Voucher Draf:* ${newVoucher}\n` +
        `• *Program Kerja:* ${proker.namaProgram}\n` +
        `• *Kantong Syariah:* ${wallet}\n` +
        `• *Nominal Permohonan:* Rp ${nominal.toLocaleString('id-ID')}\n` +
        `• *Pemohon:* ${user.fullName}\n\n` +
        `Mohon verifikasi kas Tahap 1 melalui Portal Pengurus SIAP APII:\n` +
        `https://apologetislamindonesia.or.id/portal/#kas\n\n` +
        `_Pesan otomatis SIAP APII Enterprise v3.1_`;

      showWhatsAppRelayModal(targetBendahara.name, targetBendahara.roleLabel, targetBendahara.phone, msg);
      return;
    }

    // Mode LPJ
    proker.status = 'LPJ_SELESAI';
    proker.statusLpj = 'LPJ_SELESAI';
    proker.sisaDanaDikembalikan = nominal;
    if (catatan) proker.catatanLpj = catatan;

    // Auto-create BKM refund entry when unspent funds > 0
    if (nominal > 0) {
      const targetWallet = proker.kantongSyariah || 'INFAQ_DAKWAH';
      const refundVoucher = 'BKM-REF-' + (db.kas.transactions.length + 1).toString().padStart(3, '0');
      const ketum = resolveOfficerSafe('ketua', proker.tenantId || user.tenantId);
      const refundTrx = {
        id: 'TRX-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
        tenantId: proker.tenantId || user.tenantId,
        prokerId: proker.id,
        tanggal: formatTanggal(),
        tipe: 'MASUK',
        kantongSyariah: targetWallet,
        kategori: 'Pengembalian Sisa Kas Proker',
        nominal: nominal,
        noVoucher: refundVoucher,
        noKwitansi: 'KWT-' + refundVoucher,
        keterangan: `Pengembalian sisa dana LPJ Proker: ${proker.namaProgram}`,
        pihakTerkait: proker.divisiNama,
        metode: 'TRANSFER_BANK',
        statusApproval: 'APPROVED',
        verifiedBendaharaBy: user.fullName,
        approvedKetuaBy: ketum.name,
        buktiUrl: '#'
      };
      db.kas.transactions.unshift(refundTrx);
      const balances = db.kas.balances[proker.tenantId || user.tenantId] || db.kas.balances['DPP_PUSAT'];
      balances[targetWallet] = (balances[targetWallet] || 0) + nominal;
      proker.realisasiDana = Math.max(0, (proker.realisasiDana || 0) - nominal);
    }

    State.saveDatabase();
    State.logAudit('SUBMIT_LPJ', 'Proker', prokerId, { status: 'LPJ_SELESAI', divisi: user.divisi, sisa: nominal });
    syncApiSafe('submitDivisiLPJ', { id: prokerId, sisa: nominal, catatan });

    closeModal('modal-proker-action');
    showToast(nominal > 0
      ? `LPJ selesai & sisa Rp ${nominal.toLocaleString('id-ID')} otomatis dicatat sebagai BKM Pengembalian!`
      : 'LPJ Program Kerja berhasil diselesaikan!'
    );
    renderProkerWorkspace();

    const targetBendahara = resolveOfficerSafe('bendahara', proker.tenantId || user.tenantId);
    const msg = `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n` +
      `*LAPORAN PERTANGGUNGJAWABAN (LPJ) & REKONSILIASI KAS PROKER*\n\n` +
      `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
      `Yth. ${targetBendahara.name} (${targetBendahara.roleLabel})\n\n` +
      `Divisi *${proker.divisiNama}* telah menyelesaikan LPJ program kerja:\n` +
      `• *Nama Program:* ${proker.namaProgram}\n` +
      `• *Pagu RAB:* Rp ${proker.rabNominal.toLocaleString('id-ID')}\n` +
      `• *Realisasi Bersih:* Rp ${proker.realisasiDana.toLocaleString('id-ID')}\n` +
      `• *Sisa Kas Dikembalikan:* Rp ${nominal.toLocaleString('id-ID')}\n` +
      `• *Pelapor:* ${user.fullName}\n\n` +
      `Tinjau pembukuan PSAK 409 di Portal Pengurus:\n` +
      `https://apologetislamindonesia.or.id/portal/#kas\n\n` +
      `_Pesan otomatis SIAP APII Enterprise v3.1_`;

    showWhatsAppRelayModal(targetBendahara.name, targetBendahara.roleLabel, targetBendahara.phone, msg);
  }

  function setujuiPaguProker(prokerId) {
    if (!Auth.hasPermission('proker:approve')) {
      showToast('Akses ditolak: Hanya Ketua yang berwenang menyetujui pagu anggaran RAB program kerja.', 'error');
      return;
    }

    const user = Auth.getCurrentUser();
    const db = State.getDb();
    const proker = db.proker.find(p => p.id === prokerId);
    if (!proker) return;

    proker.status = 'DISETUJUI';
    proker.catatanKetua = 'Pagu RAB disetujui. Silakan koordinasikan pencairan berkala.';
    State.saveDatabase();
    State.logAudit('APPROVE_PROKER_PAGU', 'Proker', prokerId, { rab: proker.rabNominal });
    syncApiSafe('approveDivisiProgram', { id: prokerId });

    showToast(`Pagu RAB ${proker.namaProgram} disetujui!`);
    renderProkerWorkspace();

    const officer = resolveOfficerSafe('ketua_divisi', proker.tenantId || user.tenantId, proker.divisiKode);
    const targetRole = `Ketua ${proker.divisiNama}`;

    const msg = `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n` +
      `*PENGESAHAN PAGU ANGGARAN PROGRAM KERJA DIVISI*\n\n` +
      `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
      `Yth. ${officer.name} (${targetRole})\n\n` +
      `Ketua telah menyetujui pagu anggaran usulan program kerja divisi Anda:\n` +
      `• *Nama Program:* ${proker.namaProgram}\n` +
      `• *Pagu RAB Disetujui:* Rp ${proker.rabNominal.toLocaleString('id-ID')}\n` +
      `• *Kantong Alokasi:* ${proker.kantongSyariah || 'INFAQ_DAKWAH'}\n` +
      `• *Disahkan Oleh:* ${user.fullName}\n` +
      `• *Catatan:* ${proker.catatanKetua}\n\n` +
      `Divisi Anda kini dapat mengajukan permohonan pencairan kas bertahap:\n` +
      `https://apologetislamindonesia.or.id/portal/#proker\n\n` +
      `_Pesan otomatis SIAP APII Enterprise v3.1_`;

    showWhatsAppRelayModal(officer.name, targetRole, officer.phone, msg);
  }

  // Template Inspirasi Program Kerja Unggulan Berdasarkan 17 Inovasi APII (ART Pasal 16)
  const PROKER_TEMPLATES_BY_DIVISI = {
    dakwah: [
      {
        nama: 'Shelter Perlindungan & Program Kemandirian 10 Muallaf Binaan',
        latarBelakang: 'Memberikan perlindungan akidah, tempat tinggal sementara yang aman, dan modal usaha bagi muallaf yang rentan diintimidasi atau dikucilkan keluarga pasca bersyahadat.',
        targetSasaran: '10 Muallaf binaan aktif di wilayah percontohan dengan pendampingan dai tetap',
        rab: 25000000,
        kantong: 'ZAKAT'
      },
      {
        nama: 'Safari Dakwah & Dauroh Kristologi Komparatif Nasional 2026',
        latarBelakang: 'Pelatihan intensif metodologi dialog apologetika beradab dan penguatan akidah umat di wilayah kantong-kantong rawan pemurtadan.',
        targetSasaran: '500 Jamaah & 50 Kader Da\'i Muda bersertifikasi',
        rab: 18000000,
        kantong: 'INFAQ_DAKWAH'
      },
      {
        nama: 'Bimbingan Mualaf Learning Center & Pendistribusian Al-Qur\'an Terjemah',
        latarBelakang: 'Penyediaan modul bimbingan shalat, wudhu, aqidah dasar, dan mushaf Al-Qur\'an terjemah bahasa daerah untuk muallaf pedalaman.',
        targetSasaran: '100 Muallaf baru di wilayah binaan',
        rab: 12000000,
        kantong: 'INFAQ_DAKWAH'
      }
    ],
    litbang: [
      {
        nama: 'Penerbitan Buku Saku Standardisasi Argumentasi Teologi & Kristologi APII',
        latarBelakang: 'Kebutuhan standardisasi dalil shahih dan rujukan naskah kuno berbahasa Ibrani/Yunani agar dai APII memiliki rujukan ilmiah yang seragam.',
        targetSasaran: 'Cetak 1.000 eksemplar buku saku untuk seluruh dai dan pengurus DPW se-Indonesia',
        rab: 20000000,
        kantong: 'INFAQ_DAKWAH'
      },
      {
        nama: 'Markaz Digitalisasi Manuskrip Kuno & Bibel Interlinear Apologetika',
        latarBelakang: 'Pengadaan lisensi software teks kuno dan perangkat scanner arsip untuk kurasi perpustakaan digital Maktabah APII.',
        targetSasaran: 'Database digital 200 manuskrip kuno dan referensi komparatif lintas agama',
        rab: 22000000,
        kantong: 'WAKAF'
      },
      {
        nama: 'Simposium Teologi Komparatif Nasional & Dialog Damai Antar-Tokoh',
        latarBelakang: 'Menyediakan ruang kajian akademik lintas teolog demi menjaga kerukunan beragama berbasis argumentasi ilmiah santun.',
        targetSasaran: '200 Peserta akademisi, ormas Islam, dan mahasiswa pascasarjana',
        rab: 15000000,
        kantong: 'INFAQ_DAKWAH'
      }
    ],
    hukum: [
      {
        nama: 'Posko Siaga Advokasi Bantuan Hukum & Somasi Da\'i APII 24 Jam',
        latarBelakang: 'Maraknya laporan somasi pidana dan diskriminasi hukum terhadap da\'i yang berdialog ilmiah di ruang publik.',
        targetSasaran: 'Seluruh dai resmi APII yang menghadapi intimidasi hukum di 38 provinsi',
        rab: 30000000,
        kantong: 'INFAQ_DAKWAH'
      },
      {
        nama: 'Penyuluhan Hukum Hak Konstitusi Kebebasan Beragama & Perlindungan Saksi',
        latarBelakang: 'Edukasi hak-hak hukum bagi muallaf yang mengalami perampasan hak waris, penahanan KTP, atau tekanan keluarga.',
        targetSasaran: '150 Muallaf dan kader LBH APII daerah',
        rab: 12500000,
        kantong: 'INFAQ_DAKWAH'
      },
      {
        nama: 'Kemitraan Strategis Advokasi dengan Komisi Fatwa MUI & Kemenag RI',
        latarBelakang: 'Penguatan payung hukum dakwah apologetika melalui koordinasi regulasi kebebasan berpendapat ilmiah.',
        targetSasaran: 'Dokumen rekomendasi kebijakan perlindungan dai apologetika nasional',
        rab: 10000000,
        kantong: 'AMIL_OPERASIONAL'
      }
    ],
    humas: [
      {
        nama: 'Media Center Hub & Siaran Pers Tabayyun Nasional APII',
        latarBelakang: 'Penyediaan ruang komunikasi cepat bagi jurnalis dan media nasional guna meluruskan framing berita yang menyudutkan dakwah Islam.',
        targetSasaran: '50 Wartawan media cetak/online dan rilis berkala 2x per bulan',
        rab: 14000000,
        kantong: 'AMIL_OPERASIONAL'
      },
      {
        nama: 'Silaturahmi Akbar Ormas Islam & Majelis Ulama se-Indonesia',
        latarBelakang: 'Mempererat ukhuwah islamiyah dan kolaborasi dakwah lapangan bersama ormas-ormas Islam arus utama.',
        targetSasaran: 'Pimpinan 25 Ormas Islam dan lembaga dakwah mitra',
        rab: 16000000,
        kantong: 'INFAQ_DAKWAH'
      },
      {
        nama: 'Penerbitan Buletin Warta Dakwah APII Cetak & E-Magazine Bulanan',
        latarBelakang: 'Publikasi capaian advokasi, profil muallaf inspiratif, dan jadwal safari dakwah kepada jamaah donatur.',
        targetSasaran: '3.000 Pembaca digital dan 1.000 eksemplar cetak ke masjid mitra',
        rab: 8000000,
        kantong: 'INFAQ_DAKWAH'
      }
    ],
    sosmed: [
      {
        nama: 'Radar Tabayyun Cyber Counter-Framing & Live Multi-Platform Broadcasting',
        latarBelakang: 'Monitoring 24 jam terhadap video potongan dakwah yang dipelintir akun provokatif serta kontra-narasi terstruktur dengan adab islami.',
        targetSasaran: 'Jangkauan warganet 1.000.000 viewers di YouTube, TikTok, dan Instagram',
        rab: 18000000,
        kantong: 'INFAQ_DAKWAH'
      },
      {
        nama: 'Upgrade Perlengkapan Studio Multimedia Podcast & Siaran Langsung 4K',
        latarBelakang: 'Kebutuhan kamera broadcast, audio mixer, dan pencahayaan studio untuk menjamin kualitas tayangan dialog komparatif berstandar tinggi.',
        targetSasaran: 'Studio pusat APII dengan kapasitas siaran langsung harian',
        rab: 35000000,
        kantong: 'WAKAF'
      },
      {
        nama: 'Kampanye Literasi Digital: Etika Dialog Agama di Media Sosial',
        latarBelakang: 'Edukasi netizen muslim agar tidak mudah terpancing emosi dan selalu mengedepankan dalil shahih serta akhlak mulia.',
        targetSasaran: 'Konten mikro-animasi berseri 30 episode',
        rab: 9500000,
        kantong: 'INFAQ_DAKWAH'
      }
    ],
    umum: [
      {
        nama: 'Standardisasi & Digitalisasi QR Tagging 100 Inventaris Aset Fisik',
        latarBelakang: 'Pencatatan barcode QR logam anti-rusak untuk seluruh perlengkapan dakwah (sound system, genset, kamera, mobil) demi akuntabilitas.',
        targetSasaran: '100 Unit aset operasional kantor pusat dan DPW Jabodetabek',
        rab: 7500000,
        kantong: 'AMIL_OPERASIONAL'
      },
      {
        nama: 'Pengadaan Paket Sound System Portable Outdoor & Genset Dakwah Pelosok',
        latarBelakang: 'Dukungan fasilitas audio bagi tim safari dakwah di daerah pelosok yang sering mengalami kendala pemadaman listrik.',
        targetSasaran: '2 Set Sound System Wireless 500W dan 1 unit Genset Silent 3 KVA',
        rab: 24000000,
        kantong: 'WAKAF'
      },
      {
        nama: 'Perawatan Berkala & Peremajaan Mobil Operasional Dakwah (HiAce APII)',
        latarBelakang: 'Servis rutin mesin, perpanjangan pajak/STNK, dan penggantian ban mobil operasional yang menempuh rute dakwah antarkota.',
        targetSasaran: '1 Unit Mobil Dakwah APII siap operasional 100%',
        rab: 12000000,
        kantong: 'AMIL_OPERASIONAL'
      }
    ],
    bisnis: [
      {
        nama: 'Inkubasi Wirausaha Mandiri Muallaf Preneur (Batch 1)',
        latarBelakang: 'Bantuan modal bergulir syariah dan pendampingan bisnis rintisan bagi muallaf yang kehilangan mata pencaharian setelah masuk Islam.',
        targetSasaran: '10 Pelaku UMKM Muallaf terbina dengan modal produktif',
        rab: 30000000,
        kantong: 'ZAKAT'
      },
      {
        nama: 'Produksi Merchandise Resmi Dakwah APII (Kemeja, Rompi, Buku, Atribut)',
        latarBelakang: 'Membangun sumber pendapatan mandiri (self-financing) yayasan melalui penjualan atribut resmi organisasi.',
        targetSasaran: '500 Pcs merchandise berkualitas tinggi',
        rab: 15000000,
        kantong: 'INFAQ_DAKWAH'
      },
      {
        nama: 'Pelatihan Vokasi Digital & Sertifikasi Keterampilan Kerja Kader Muda',
        latarBelakang: 'Meningkatkan daya saing ekonomi anggota binaan melalui kursus desain grafis, video editing, dan digital marketing.',
        targetSasaran: '30 Pemuda muslim binaan APII',
        rab: 10500000,
        kantong: 'INFAQ_DAKWAH'
      }
    ]
  };

  // Helper konversi angka rupiah ke terbilang bahasa Indonesia
  function angkaTerbilang(angka) {
    const bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
    let n = Math.abs(parseInt(angka, 10));
    if (isNaN(n) || n === 0) return 'Nol Rupiah';

    function terbilangHelper(num) {
      if (num < 12) return bilangan[num];
      if (num < 20) return terbilangHelper(num - 10) + ' Belas';
      if (num < 100) return terbilangHelper(Math.floor(num / 10)) + ' Puluh ' + terbilangHelper(num % 10);
      if (num < 200) return 'Seratus ' + terbilangHelper(num - 100);
      if (num < 1000) return terbilangHelper(Math.floor(num / 100)) + ' Ratus ' + terbilangHelper(num % 100);
      if (num < 2000) return 'Seribu ' + terbilangHelper(num - 1000);
      if (num < 1000000) return terbilangHelper(Math.floor(num / 1000)) + ' Ribu ' + terbilangHelper(num % 1000);
      if (num < 1000000000) return terbilangHelper(Math.floor(num / 1000000)) + ' Juta ' + terbilangHelper(num % 1000000);
      if (num < 1000000000000) return terbilangHelper(Math.floor(num / 1000000000)) + ' Miliar ' + terbilangHelper(num % 1000000000);
      return 'Lebih dari Satu Triliun';
    }

    const res = terbilangHelper(n).replace(/\s+/g, ' ').trim();
    return res + ' Rupiah';
  }

  function renderProkerChips(divCode) {
    const container = document.getElementById('proker-form-chips-container');
    if (!container) return;

    const templates = PROKER_TEMPLATES_BY_DIVISI[divCode] || PROKER_TEMPLATES_BY_DIVISI['dakwah'] || [];
    container.innerHTML = templates.map((t, idx) => {
      return `
        <button type="button" onclick="App.applyProkerTemplate('${divCode}', ${idx})" class="px-2.5 py-1 rounded-lg bg-teal-100/70 hover:bg-teal-200 text-teal-950 text-[11px] font-semibold text-left transition-all border border-teal-300/60 flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[14px] text-teal-800">bookmark_add</span>
          <span>${t.nama.length > 45 ? t.nama.substring(0, 42) + '...' : t.nama}</span>
        </button>
      `;
    }).join('');
  }

  function applyProkerTemplate(divCode, index) {
    const templates = PROKER_TEMPLATES_BY_DIVISI[divCode] || PROKER_TEMPLATES_BY_DIVISI['dakwah'] || [];
    const t = templates[index];
    if (!t) return;

    const elNama = document.getElementById('proker-form-nama');
    const elLatar = document.getElementById('proker-form-latar-belakang');
    const elTarget = document.getElementById('proker-form-target');
    const elKantong = document.getElementById('proker-form-kantong');

    if (elNama) elNama.value = t.nama;
    if (elLatar) elLatar.value = t.latarBelakang;
    if (elTarget) elTarget.value = t.targetSasaran;
    if (elKantong && t.kantong) elKantong.value = t.kantong;

    setProkerRabChip(t.rab);
    showToast('Template program kerja diterapkan!');
  }

  function setProkerRabChip(amount) {
    const elRab = document.getElementById('proker-form-rab');
    const num = parseInt(amount, 10) || 0;
    if (elRab) {
      elRab.value = num.toLocaleString('id-ID');
    }
    updateRabPreview(num);
  }

  function onProkerRabInput(val) {
    const raw = String(val).replace(/\D/g, '');
    const num = parseInt(raw, 10) || 0;
    const elRab = document.getElementById('proker-form-rab');
    if (elRab) {
      elRab.value = num ? num.toLocaleString('id-ID') : '';
    }
    updateRabPreview(num);
  }

  function updateRabPreview(num) {
    const elPreview = document.getElementById('proker-form-rab-preview');
    const elTerbilang = document.getElementById('proker-form-rab-terbilang');
    if (elPreview) elPreview.textContent = 'Rp ' + (num || 0).toLocaleString('id-ID');
    if (elTerbilang) elTerbilang.textContent = 'Terbilang: ' + angkaTerbilang(num);
  }

  function onProkerDivisiChange(divCode) {
    renderProkerChips(divCode);
  }

  function openTambahProkerModal() {
    if (!Auth.hasPermission('proker:compose')) {
      showToast('Akses ditolak: Hanya Ketua Divisi atau Pimpinan yang berwenang mengusulkan program kerja divisi.', 'error');
      return;
    }

    const modal = document.getElementById('modal-tambah-proker');
    if (!modal) return;

    const user = Auth.getCurrentUser();
    const selectDiv = document.getElementById('proker-form-divisi-select');
    const lockedDiv = document.getElementById('proker-form-divisi-locked');
    const lockedDivNama = document.getElementById('proker-form-divisi-nama');
    const elPengusul = document.getElementById('proker-form-pengusul');
    const elTanggal = document.getElementById('proker-form-tanggal');

    let activeDivCode = 'dakwah';

    if (user.role === 'ketua_divisi') {
      activeDivCode = user.divisi || 'dakwah';
      const divObj = CONFIG.DIVISIONS.find(d => d.code === activeDivCode) || CONFIG.DIVISIONS[0];
      if (selectDiv) selectDiv.classList.add('hidden');
      if (lockedDiv) lockedDiv.classList.remove('hidden');
      if (lockedDivNama) lockedDivNama.textContent = divObj.name;
    } else {
      // Superadmin / Ketua: Bisa memilih divisi tujuan
      if (selectDiv) {
        selectDiv.classList.remove('hidden');
        selectDiv.innerHTML = CONFIG.DIVISIONS.map(d => 
          `<option value="${d.code}">${d.label}</option>`
        ).join('');
        activeDivCode = selectDiv.value || 'dakwah';
      }
      if (lockedDiv) lockedDiv.classList.add('hidden');
    }

    if (elPengusul) {
      const tenantLabel = user.tenantId === 'DPP_PUSAT' ? 'DPP APII Pusat' : (user.tenantId || 'DPW');
      elPengusul.value = `${user.fullName} (${user.role.toUpperCase()} • ${tenantLabel})`;
    }

    // Default target tanggal pelaksanaan 14 hari dari sekarang
    if (elTanggal) {
      const d = new Date(Date.now() + 14 * 86400000);
      elTanggal.value = formatTanggal(d);
    }

    // Reset Form Fields
    const elNama = document.getElementById('proker-form-nama');
    const elLatar = document.getElementById('proker-form-latar-belakang');
    const elTarget = document.getElementById('proker-form-target');
    const elDrive = document.getElementById('proker-form-drive-url');

    if (elNama) elNama.value = '';
    if (elLatar) elLatar.value = '';
    if (elTarget) elTarget.value = '';
    if (elDrive) elDrive.value = '';

    setProkerRabChip(15000000);
    renderProkerChips(activeDivCode);

    modal.classList.remove('hidden');
  }

  function closeTambahProkerModal() {
    const modal = document.getElementById('modal-tambah-proker');
    if (modal) modal.classList.add('hidden');
  }

  function submitTambahProkerModal() {
    if (!Auth.hasPermission('proker:compose')) {
      showToast('Akses ditolak: Hanya Ketua Divisi yang berwenang mengusulkan program kerja divisi.', 'error');
      return;
    }

    const user = Auth.getCurrentUser();
    let activeDivCode = user.divisi || 'dakwah';
    if (user.role !== 'ketua_divisi') {
      const selectDiv = document.getElementById('proker-form-divisi-select');
      if (selectDiv) activeDivCode = selectDiv.value;
    }

    const divDef = CONFIG.DIVISIONS.find(d => d.code === activeDivCode) || CONFIG.DIVISIONS[0];
    const nama = document.getElementById('proker-form-nama')?.value?.trim();
    const latar = document.getElementById('proker-form-latar-belakang')?.value?.trim();
    const target = document.getElementById('proker-form-target')?.value?.trim();
    const rabStr = document.getElementById('proker-form-rab')?.value?.trim() || '';
    const rab = parseInt(rabStr.replace(/\D/g, ''), 10) || 0;
    const kantong = document.getElementById('proker-form-kantong')?.value || 'INFAQ_DAKWAH';
    const tanggal = document.getElementById('proker-form-tanggal')?.value?.trim() || formatTanggal();
    const driveUrl = document.getElementById('proker-form-drive-url')?.value?.trim() || '#';

    if (!nama) {
      showToast('Harap isi nama program kerja.', 'error');
      document.getElementById('proker-form-nama')?.focus();
      return;
    }

    if (!latar) {
      showToast('Harap jelaskan latar belakang & urgensi program.', 'error');
      document.getElementById('proker-form-latar-belakang')?.focus();
      return;
    }

    if (!target) {
      showToast('Harap tentukan target sasaran / KPI program.', 'error');
      document.getElementById('proker-form-target')?.focus();
      return;
    }

    if (rab <= 0) {
      showToast('Pagu anggaran RAB harus lebih dari Rp 0.', 'error');
      document.getElementById('proker-form-rab')?.focus();
      return;
    }

    const db = State.getDb();
    const newProker = {
      id: 'PRK-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      tenantId: user.tenantId,
      divisiKode: divDef.code,
      divisiNama: divDef.name,
      namaProgram: nama,
      latarBelakang: latar,
      targetSasaran: target,
      rabNominal: rab,
      kantongSyariah: kantong,
      realisasiDana: 0,
      tglPelaksanaan: tanggal,
      status: 'AJUKAN',
      catatanKetua: 'Menunggu telaah dan otorisasi pagu oleh Ketua.',
      lpjDriveUrl: driveUrl,
      statusLpj: 'BELUM_MULAI',
      createdBy: `${user.fullName} (${divDef.name})`,
      createdAt: formatWaktu()
    };

    db.proker.unshift(newProker);
    State.saveDatabase();
    State.logAudit('SUBMIT_PROKER', 'Proker', newProker.id, {
      nama: nama,
      rab: rab,
      divisi: divDef.code,
      kantong: kantong
    });

    closeTambahProkerModal();
    showToast(`Proposal program kerja ${divDef.name} berhasil diajukan!`);
    renderProkerWorkspace();

    // Trigger Smart WhatsApp Relay Modal ke Ketua
    const targetPejabat = resolveOfficerSafe('ketua', user.tenantId);

    const msg = `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n` +
      `*NOTIFIKASI USULAN PROGRAM KERJA DIVISI BARU*\n\n` +
      `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
      `Yth. ${targetPejabat.name} (${targetPejabat.roleLabel || targetPejabat.role})\n\n` +
      `Divisi *${divDef.name}* telah mengajukan proposal program kerja baru yang memerlukan otorisasi pagu anggaran Anda:\n` +
      `• *Nama Program:* ${newProker.namaProgram}\n` +
      `• *Usulan Pagu RAB:* Rp ${newProker.rabNominal.toLocaleString('id-ID')}\n` +
      `• *Rekomendasi Kantong:* ${newProker.kantongSyariah}\n` +
      `• *Target Sasaran:* ${newProker.targetSasaran}\n` +
      `• *Target Pelaksanaan:* ${newProker.tglPelaksanaan}\n` +
      `• *Pengusul:* ${newProker.createdBy}\n\n` +
      `Mohon telaah dan berikan persetujuan pagu melalui Portal Pengurus SIAP APII:\n` +
      `https://apologetislamindonesia.or.id/portal/#proker\n\n` +
      `_Pesan otomatis SIAP APII Enterprise_`;

    showWhatsAppRelayModal(targetPejabat.name, targetPejabat.roleLabel || targetPejabat.role, targetPejabat.phone, msg);
  }

  // =========================================================================
  // 6. KEANGGOTAAN NASIONAL & KTA CR80 2-SISI
  // =========================================================================
  let currentKtaAnggota = null;

  function maskNikSafe(nik) {
    if (typeof State.maskNik === 'function') return State.maskNik(nik);
    if (!nik) return '-';
    const s = String(nik).trim();
    if (s.length < 10) return s;
    return s.slice(0, 6) + '******' + s.slice(-4);
  }

  function getMonogramText(name) {
    if (typeof State.createMonogramAvatar === 'function') {
      const res = State.createMonogramAvatar(name);
      if (res && typeof res === 'object' && res.initials) return res.initials;
      if (typeof res === 'string' && !res.startsWith('<')) return res;
    }
    const parts = String(name || 'AP').replace(/[^A-Za-z\s]/g, '').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0] || 'AP').slice(0, 2).toUpperCase();
  }

  function drawQrMatrix(canvas, text) {
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width || 84;
    const modules = 21;
    const cell = Math.floor(size / modules);
    const pad = Math.floor((size - cell * modules) / 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#0f172a';

    const drawFinder = (rx, cy) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const border = r === 0 || r === 6 || c === 0 || c === 6;
          const center = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          if (border || center) {
            ctx.fillRect(pad + (cy + c) * cell, pad + (rx + r) * cell, cell, cell);
          }
        }
      }
    };
    drawFinder(0, 0);
    drawFinder(0, modules - 7);
    drawFinder(modules - 7, 0);

    const hashHex = State.computeSha256(String(text || 'APII'));
    let bitIdx = 0;
    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        const inTopLeft = r < 8 && c < 8;
        const inTopRight = r < 8 && c >= modules - 8;
        const inBotLeft = r >= modules - 8 && c < 8;
        if (inTopLeft || inTopRight || inBotLeft) continue;
        const hexChar = parseInt(hashHex[bitIdx % hashHex.length], 16) || 0;
        if (((hexChar + r * 3 + c) % 2) === 0) {
          ctx.fillRect(pad + c * cell, pad + r * cell, cell, cell);
        }
        bitIdx++;
      }
    }
  }

  function renderKeanggotaanWorkspace() {
    const db = State.getDb();
    const tbody = document.getElementById('anggota-table-body');
    if (!tbody) return;

    let rowsHtml = '';
    const visibleAnggota = db.anggota.filter(a => isScopedRecordVisible(a.tenantId));
    visibleAnggota.forEach(a => {
      let statusBadge = '';
      if (a.status === 'APPROVED') {
        statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900">KTA AKTIF RESMI</span>';
      } else if (a.status === 'VERIFIED_SEKRETARIS') {
        statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900">LOLOS VERIFIKASI SEKRETARIS</span>';
      } else {
        statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">MENUNGGU VERIFIKASI</span>';
      }

      let actionsHtml = '';
      if (a.status === 'APPROVED') {
        actionsHtml = `
          <div class="flex items-center justify-end gap-1.5">
            <button type="button" onclick="App.openKtpViewerModal('${a.id}')" class="px-2 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs">
              Berkas KTP
            </button>
            <button type="button" onclick="App.openKtaModal('${a.id}')" class="px-2.5 py-1.5 rounded bg-[#064E3B] text-white font-bold text-xs hover:bg-[#003527] shadow-sm">
              Lihat KTA CR80 2-Sisi
            </button>
          </div>
        `;
      } else if (a.status === 'VERIFIED_SEKRETARIS') {
        if (Auth.hasPermission('kta:approve')) {
          actionsHtml = `
            <div class="flex items-center justify-end gap-1.5">
              <button type="button" onclick="App.openKtpViewerModal('${a.id}')" class="px-2 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs">
                Cek KTP
              </button>
              <button type="button" onclick="App.approveKtaKetua('${a.id}')" class="px-2.5 py-1.5 rounded bg-[#064E3B] text-white font-bold text-xs hover:bg-[#003527] shadow-sm">
                Sahkan KTA (Ketua)
              </button>
            </div>
          `;
        } else {
          actionsHtml = `<span class="px-2 py-0.5 rounded bg-amber-50 text-amber-900 text-[11px] font-semibold">Menunggu Pengesahan Ketua</span>`;
        }
      } else if (a.status !== 'APPROVED') {
        if (Auth.hasPermission('kta:verify')) {
          actionsHtml = `
            <button type="button" onclick="App.openKtpViewerModal('${a.id}')" class="px-2.5 py-1.5 rounded bg-blue-800 text-white font-bold text-xs hover:bg-blue-900 shadow-sm">
              Tinjau KTP &amp; Verifikasi
            </button>
          `;
        } else {
          actionsHtml = `<span class="px-2 py-0.5 rounded bg-blue-50 text-blue-900 text-[11px] font-semibold">Menunggu Verifikasi Sekretariat</span>`;
        }
      }

      const licDef = CONFIG.DAI_LICENSES.find(l => l.level === a.tingkatLisensi) || CONFIG.DAI_LICENSES[0];
      const hasValidPhoto = a.fotoUrl && !String(a.fotoUrl).includes('unsplash.com') && !String(a.fotoUrl).includes('dummyimage');
      const avatarHtml = hasValidPhoto
        ? `<img src="${a.fotoUrl}" alt="Foto" class="w-9 h-9 rounded-full object-cover border border-emerald-700 shrink-0"/>`
        : `<div class="w-9 h-9 rounded-full bg-[#064E3B] text-white flex items-center justify-center font-display font-bold text-xs shrink-0">${getMonogramText(a.namaLengkap)}</div>`;

      rowsHtml += `
        <tr class="border-b border-slate-200 hover:bg-slate-50 transition-colors">
          <td class="px-4 py-3 flex items-center gap-3">
            ${avatarHtml}
            <div>
              <span class="font-bold text-xs text-slate-900 block">${a.namaLengkap}</span>
              <span class="tabular-nums text-[10px] text-slate-600 font-mono">NIK: ${maskNikSafe(a.nik)}</span>
            </div>
          </td>
          <td class="tabular-nums px-4 py-3 font-mono font-bold text-xs text-emerald-900">${a.nia || 'DRAFT'}</td>
          <td class="px-4 py-3 text-xs">
            <span class="px-2 py-0.5 rounded text-[10px] font-extrabold text-white" style="background-color: ${licDef.badgeColor}">
              ${licDef.name}
            </span>
          </td>
          <td class="px-4 py-3 text-xs text-slate-600">${a.wilayah}</td>
          <td class="px-4 py-3 text-center">${statusBadge}</td>
          <td class="px-4 py-3 text-right">${actionsHtml}</td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml || '<tr><td colspan="6" class="p-4 text-center text-xs text-slate-600">Belum ada data keanggotaan pada wilayah ini.</td></tr>';
  }

  function openKtpViewerModal(anggotaId) {
    const db = State.getDb();
    const a = db.anggota.find(m => m.id === anggotaId);
    if (!a) return;

    document.getElementById('ktp-viewer-anggota-id').value = a.id;
    document.getElementById('ktp-viewer-nama').textContent = a.namaLengkap;
    document.getElementById('ktp-viewer-nik').textContent = maskNikSafe(a.nik);
    document.getElementById('ktp-viewer-wilayah').textContent = a.wilayah || a.kota;
    document.getElementById('ktp-viewer-keahlian').textContent = a.keahlian || '-';
    document.getElementById('ktp-viewer-wa').textContent = a.telepon || a.noWa || '-';

    renderWatermarkOverlay('ktp-internal-watermark', false);

    const approveBtn = document.getElementById('ktp-viewer-approve-btn');
    if (approveBtn) {
      const canStage1 = Auth.hasPermission('kta:verify') && a.status !== 'APPROVED' && a.status !== 'VERIFIED_SEKRETARIS';
      approveBtn.classList.toggle('hidden', !canStage1);
    }
    document.getElementById('modal-ktp-viewer')?.classList.remove('hidden');
  }

  function approveKtaFromViewer() {
    const id = document.getElementById('ktp-viewer-anggota-id')?.value;
    closeModal('modal-ktp-viewer');
    if (id) verifyKtaSekretaris(id);
  }

  function verifyKtaSekretaris(anggotaId) {
    if (!Auth.hasPermission('kta:verify')) {
      showToast('Akses ditolak: Hanya Sekretaris Umum / DPW yang berwenang melakukan Verifikasi KTP Tahap 1.', 'error');
      return;
    }

    const db = State.getDb();
    const anggota = db.anggota.find(a => a.id === anggotaId);
    if (!anggota) return;

    anggota.status = 'VERIFIED_SEKRETARIS';
    anggota.verifiedSekretarisAt = formatWaktu();
    State.saveDatabase();
    State.logAudit('VERIFY_KTA_SEKRETARIS', 'KTA', anggotaId, { nama: anggota.namaLengkap });
    syncApiSafe('verifyPendaftarSekretaris', { id: anggotaId });

    showToast(`KTP ${anggota.namaLengkap} lolos verifikasi UU PDP! Siap disahkan Ketua.`);
    renderKeanggotaanWorkspace();

    const ketumPejabat = resolveOfficerSafe('ketua', anggota.tenantId);
    const msg = `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n` +
      `*PENGAJUAN PENGESAHAN KTA DIGITAL CR80*\n\n` +
      `Yth. ${ketumPejabat.name} (${ketumPejabat.roleLabel})\n\n` +
      `Pendaftaran anggota baru telah diverifikasi lengkap oleh Sekretariat:\n` +
      `• *Nama:* ${anggota.namaLengkap}\n` +
      `• *Keahlian:* ${anggota.keahlian}\n` +
      `• *Rekomendasi Lisensi:* Tingkat ${anggota.tingkatLisensi}\n\n` +
      `Mohon pengesahan penerbitan NIA & KTA Digital:\n` +
      `https://apologetislamindonesia.or.id/portal/#keanggotaan`;

    showWhatsAppRelayModal(ketumPejabat.name, ketumPejabat.roleLabel, ketumPejabat.phone, msg);
  }

  function approveKtaKetua(anggotaId) {
    if (!Auth.hasPermission('kta:approve')) {
      showToast('Akses ditolak: Hanya Ketua Umum / DPW yang berwenang melakukan Pengesahan KTA Tahap 2.', 'error');
      return;
    }

    const db = State.getDb();
    const anggota = db.anggota.find(a => a.id === anggotaId);
    if (!anggota) return;

    if (!anggota.nia || anggota.nia === 'MENUNGGU_PENGESAHAN' || anggota.nia.includes('DRAFT') || anggota.nia.includes('PENDING')) {
      if (typeof State.generateNextNia === 'function') {
        anggota.nia = State.generateNextNia(anggota.tenantId || 'DPP_PUSAT');
      } else {
        const prefix = (anggota.tenantId === 'DPP_PUSAT') ? 'PUSAT' : (anggota.tenantId || 'DPW').replace('DPW_', '');
        anggota.nia = `APII-${prefix}-${new Date().getFullYear()}-${String(db.anggota.length + 101).padStart(5, '0')}`;
      }
    }

    anggota.status = 'APPROVED';
    anggota.approvedKetuaAt = formatWaktu();
    State.saveDatabase();
    State.logAudit('APPROVE_KTA_KETUA', 'KTA', anggotaId, { nia: anggota.nia, nama: anggota.namaLengkap });
    syncApiSafe('approveAnggotaKetua', { id: anggotaId, nia: anggota.nia });

    showToast(`KTA ${anggota.namaLengkap} (${anggota.nia}) resmi aktif 5 tahun!`);
    renderKeanggotaanWorkspace();

    // PRD 5.1: Internal WA relay ke Sekretaris untuk penerbitan & distribusi KTA
    const sekretarisPejabat = resolveOfficerSafe('sekretaris', anggota.tenantId);
    const msg = `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n` +
      `*PENGESAHAN KTA DIGITAL CR80 & NOMOR INDUK ANGGOTA (NIA)*\n\n` +
      `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
      `Yth. ${sekretarisPejabat.name} (${sekretarisPejabat.roleLabel})\n\n` +
      `Ketua telah mengesahkan penerbitan KTA Digital CR80 atas nama *${anggota.namaLengkap}*:\n` +
      `• *NIA Resmi:* ${anggota.nia}\n` +
      `• *Wilayah Penugasan:* ${anggota.wilayah}\n` +
      `• *Tingkat Lisensi:* Tingkat ${anggota.tingkatLisensi}\n` +
      `• *Masa Berlaku:* 5 Tahun (Hingga ${anggota.tglKedaluwarsa || '2031'})\n` +
      `• *Kontak Kader:* ${anggota.telepon || '-'}\n\n` +
      `Mohon Sekretariat memproses pengarsipan ke folder 06_KTA_KEANGGOTAAN dan meneruskan file PNG HD CR80 kepada kader bersangkutan:\n` +
      `https://apologetislamindonesia.or.id/portal/#keanggotaan\n\n` +
      `_SIAP APII Enterprise v3.1_`;

    showWhatsAppRelayModal(sekretarisPejabat.name, sekretarisPejabat.roleLabel, sekretarisPejabat.phone, msg);
  }

  function openKtaModal(anggotaId) {
    const db = State.getDb();
    const a = db.anggota.find(m => m.id === anggotaId);
    if (!a) return;
    currentKtaAnggota = a;

    const elName = document.getElementById('kta-card-name');
    const elNia = document.getElementById('kta-card-nia');
    const elRegion = document.getElementById('kta-card-region');
    const elSkill = document.getElementById('kta-card-skill');
    const elPhoto = document.getElementById('kta-card-photo');
    const elMonogram = document.getElementById('kta-card-monogram');
    const elBadge = document.getElementById('kta-card-license-badge');
    const elKetum = document.getElementById('kta-card-ketum');

    if (elName) elName.textContent = a.namaLengkap;
    if (elNia) elNia.textContent = a.nia;
    if (elRegion) elRegion.textContent = a.wilayah;
    if (elSkill) elSkill.textContent = a.keahlian;
    if (elKetum) elKetum.textContent = resolveOfficerSafe('ketua', a.tenantId).name;

    const hasValidPhoto = a.fotoUrl && !String(a.fotoUrl).includes('unsplash.com') && !String(a.fotoUrl).includes('dummyimage');
    if (hasValidPhoto && elPhoto) {
      elPhoto.src = a.fotoUrl;
      elPhoto.classList.remove('hidden');
      elMonogram?.classList.add('hidden');
    } else {
      elPhoto?.classList.add('hidden');
      if (elMonogram) {
        elMonogram.textContent = getMonogramText(a.namaLengkap);
        elMonogram.classList.remove('hidden');
      }
    }

    const licDef = CONFIG.DAI_LICENSES.find(l => l.level === a.tingkatLisensi) || CONFIG.DAI_LICENSES[0];
    if (elBadge) {
      elBadge.textContent = licDef.name.toUpperCase();
      elBadge.style.backgroundColor = licDef.badgeColor;
    }

    const qrCanvas = document.getElementById('kta-qr-canvas');
    const verifUrl = `https://apologetislamindonesia.or.id/public/#/verifikasi?token=${encodeURIComponent(a.nia || a.id)}`;
    drawQrMatrix(qrCanvas, verifUrl);

    currentKtaSide = 'front';
    const sideFront = document.getElementById('kta-side-front');
    const sideBack = document.getElementById('kta-side-back');
    if (sideFront) sideFront.classList.remove('hidden');
    if (sideBack) sideBack.classList.add('hidden');

    const modal = document.getElementById('modal-kta-preview');
    if (modal) modal.classList.remove('hidden');
  }

  function downloadKtaPngHd() {
    if (!currentKtaAnggota) return;
    const a = currentKtaAnggota;
    const canvas = document.createElement('canvas');
    // 300 DPI CR80 (85.6mm x 53.98mm -> 1012 x 638 px)
    canvas.width = 1012;
    canvas.height = 638;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 1012, 638);
    grad.addColorStop(0, '#022c22');
    grad.addColorStop(0.55, '#064e3b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1012, 638);

    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 4;
    ctx.strokeRect(18, 18, 976, 602);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('YAYASAN APOLOGET ISLAM INDONESIA', 44, 72);
    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText('KARTU TANDA ANGGOTA RESMI (CR80 300 DPI)', 44, 102);

    ctx.fillStyle = '#065f46';
    ctx.fillRect(44, 150, 190, 230);
    ctx.strokeStyle = '#6ee7b7';
    ctx.lineWidth = 3;
    ctx.strokeRect(44, 150, 190, 230);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(getMonogramText(a.namaLengkap), 139, 288);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(a.namaLengkap || '-', 264, 196);
    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(a.nia || '-', 264, 246);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '22px Inter, sans-serif';
    ctx.fillText(a.wilayah || 'DPP Pusat', 264, 294);
    ctx.fillText(a.keahlian || '-', 264, 336);

    const licDef = CONFIG.DAI_LICENSES.find(l => l.level === a.tingkatLisensi) || CONFIG.DAI_LICENSES[0];
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(264, 360, 280, 42);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText(licDef.name.toUpperCase(), 280, 388);

    // Draw QR inside white frame
    const qrTmp = document.createElement('canvas');
    qrTmp.width = 168;
    qrTmp.height = 168;
    drawQrMatrix(qrTmp, `https://apologetislamindonesia.or.id/public/#/verifikasi?token=${encodeURIComponent(a.nia || a.id)}`);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(800, 420, 168, 168);
    ctx.drawImage(qrTmp, 800, 420);

    ctx.fillStyle = '#a7f3d0';
    ctx.font = '18px monospace';
    ctx.fillText('ISO/IEC 7810 CR80 | MASA BERLAKU 5 TAHUN', 44, 576);

    const link = document.createElement('a');
    link.download = `KTA-${a.nia || a.id}-300DPI.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast(`PNG HD (1012x638 / 300 DPI) untuk ${a.namaLengkap} diunduh!`);
  }

  function flipKtaCard() {
    currentKtaSide = currentKtaSide === 'front' ? 'back' : 'front';
    const sideFront = document.getElementById('kta-side-front');
    const sideBack = document.getElementById('kta-side-back');

    if (currentKtaSide === 'front') {
      sideFront?.classList.remove('hidden');
      sideBack?.classList.add('hidden');
    } else {
      sideFront?.classList.add('hidden');
      sideBack?.classList.remove('hidden');
    }
  }

  // =========================================================================
  // 7. SIAGA ADVOKASI LBH APII & RADAR TABAYYUN
  // =========================================================================
  function renderAdvokasiWorkspace() {
    const db = State.getDb();
    const user = Auth.getCurrentUser();
    const isRo = Auth.isReadOnly();
    const canManageAdv = !isRo && (Auth.hasPermission('advokasi:manage') || user.role === 'superadmin');
    const canBroadcast = !isRo && (user.role === 'superadmin' || user.role === 'sekretaris' || (user.role === 'ketua_divisi' && (user.divisi === 'humas' || user.divisi === 'sosmed')));

    const btnTambahAdv = document.getElementById('btn-tambah-advokasi');
    const btnTambahTabayyun = document.getElementById('btn-tambah-tabayyun');
    if (btnTambahAdv) btnTambahAdv.classList.toggle('hidden', isRo || !Auth.canAccessWorkspace('advokasi'));
    if (btnTambahTabayyun) btnTambahTabayyun.classList.toggle('hidden', !canBroadcast);

    const containerLbh = document.getElementById('advokasi-tickets-list');
    const containerTabayyun = document.getElementById('tabayyun-releases-list');

    if (containerLbh) {
      let html = '';
      const visibleAdv = db.advokasi.filter(adv => isScopedRecordVisible(adv.tenantId));
      visibleAdv.forEach(adv => {
        html += `
          <div class="p-5 rounded-lg bg-white border border-slate-200 shadow-sm flex flex-col gap-3">
            <div class="flex items-center justify-between pb-2 border-b border-slate-200">
              <div class="flex items-center gap-2">
                <span class="tabular-nums px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-900">${adv.tiketNo}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
                  adv.urgensi === 'KILAT_DARURAT' ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900'
                }">${adv.urgensi}</span>
              </div>
              <span class="tabular-nums text-xs text-slate-600">${formatTanggalDisplay(adv.updatedAt)}</span>
            </div>
            <div>
              <h4 class="font-bold text-sm text-slate-900">Da'i: ${adv.namaDai} &bull; Lokasi: ${adv.lokasi}</h4>
              <p class="text-xs text-slate-700 mt-1 leading-relaxed">Kronologi: ${adv.kronologi}</p>
              <p class="text-xs text-emerald-900 font-semibold mt-2">Catatan LBH: ${adv.catatanLbh}</p>
            </div>
            ${canManageAdv ? `
              <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button type="button" onclick="App.terbitkanSuratTugasLbh('${adv.id}')" class="min-h-[44px] px-3 py-1.5 rounded bg-red-700 text-white font-bold text-xs hover:bg-red-800 shadow-sm">
                  Terbitkan Surat Tugas Advokat 1-Klik
                </button>
              </div>
            ` : ''}
          </div>
        `;
      });
      containerLbh.innerHTML = html || '<p class="text-xs text-slate-600">Tidak ada tiket advokasi pada wilayah ini.</p>';
    }

    if (containerTabayyun) {
      let html2 = '';
      const visibleTby = db.tabayyun.filter(tby => isScopedRecordVisible(tby.tenantId));
      visibleTby.forEach(tby => {
        html2 += `
          <div class="p-5 rounded-lg bg-white border border-slate-200 shadow-sm flex flex-col gap-3">
            <div class="flex items-center justify-between pb-2 border-b border-slate-200">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-900">${tby.saluranMedia}</span>
              <span class="tabular-nums text-xs text-slate-600">${formatTanggalDisplay(tby.tglRilis)}</span>
            </div>
            <h4 class="font-bold text-sm text-slate-900">${tby.judulKlarifikasi}</h4>
            <p class="text-xs text-slate-700 leading-relaxed">${tby.naskahKlarifikasi}</p>
            ${canBroadcast ? `
              <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button type="button" onclick="App.siarkanTabayyunWa('${tby.id}')" class="min-h-[44px] px-3 py-1.5 rounded bg-[#064E3B] text-white font-bold text-xs hover:bg-[#003527] shadow-sm flex items-center gap-1">
                  <span class="material-symbols-outlined text-[16px]">share</span>
                  <span>Siarkan ke Grup WhatsApp APII</span>
                </button>
              </div>
            ` : ''}
          </div>
        `;
      });
      containerTabayyun.innerHTML = html2 || '<p class="text-xs text-slate-600">Belum ada rilis tabayyun media.</p>';
    }
  }

  function switchAdvokasiSubTab(tab) {
    const btnLbh = document.getElementById('tab-btn-advokasi');
    const btnTabayyun = document.getElementById('tab-btn-tabayyun');
    const subLbh = document.getElementById('subtab-lbh');
    const subTabayyun = document.getElementById('subtab-tabayyun');

    if (tab === 'lbh') {
      if (btnLbh) btnLbh.className = 'min-h-[44px] px-4 py-2 rounded bg-[#064E3B] text-white font-bold text-xs';
      if (btnTabayyun) btnTabayyun.className = 'min-h-[44px] px-4 py-2 rounded bg-slate-200 text-slate-900 font-semibold text-xs';
      subLbh?.classList.remove('hidden');
      subTabayyun?.classList.add('hidden');
    } else {
      if (btnTabayyun) btnTabayyun.className = 'min-h-[44px] px-4 py-2 rounded bg-[#064E3B] text-white font-bold text-xs';
      if (btnLbh) btnLbh.className = 'min-h-[44px] px-4 py-2 rounded bg-slate-200 text-slate-900 font-semibold text-xs';
      subTabayyun?.classList.remove('hidden');
      subLbh?.classList.add('hidden');
    }
  }

  function terbitkanSuratTugasLbh(advId) {
    const user = Auth.getCurrentUser();
    if (user.role === 'ketua_divisi' && user.divisi !== 'hukum') {
      showToast('Akses Ditolak: Hanya Ketua Divisi Hukum (LBH APII) yang berwenang menerbitkan Surat Tugas Advokat.', 'error');
      return;
    }
    if (!Auth.hasPermission('advokasi:manage') && user.role !== 'superadmin') {
      showToast('Akses ditolak: Hanya Divisi Hukum/LBH APII yang berwenang menerbitkan Surat Tugas Advokat.', 'error');
      return;
    }

    const db = State.getDb();
    const adv = db.advokasi.find(a => a.id === advId);
    if (!adv) return;

    adv.status = 'TERBIT_SURAT_TUGAS';
    adv.catatanLbh = 'Surat Tugas Pendampingan Advokat resmi diterbitkan dengan kuasa penuh membela da\'i.';
    State.saveDatabase();
    State.logAudit('TERBIT_SURAT_TUGAS_LBH', 'Advokasi', advId, { tiket: adv.tiketNo, dai: adv.namaDai });
    syncApiSafe('updateAdvokasiStatus', { id: advId });

    showToast(`Surat Tugas Advokat untuk ${adv.namaDai} resmi diterbitkan!`);
    renderAdvokasiWorkspace();

    const kadivHukum = resolveOfficerSafe('ketua_divisi', adv.tenantId, 'hukum');
    const targetPhone = adv.kontak || kadivHukum.phone;
    const msg = `*LEMBAGA BANTUAN HUKUM (LBH) YAYASAN APOLOGET ISLAM INDONESIA*\n` +
      `*PENERBITAN SURAT TUGAS PENDAMPINGAN ADVOKASI DARURAT*\n\n` +
      `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
      `Yth. ${adv.namaDai},\n\n` +
      `Menindaklanjuti laporan krisis intake advokasi Anda (Nomor Tiket: *${adv.tiketNo}*), Divisi Hukum & Advokasi LBH APII telah menerbitkan *Surat Tugas Kuasa Pendampingan Advokat*.\n\n` +
      `• *Nomor Tiket LBH:* ${adv.tiketNo}\n` +
      `• *Da'i Terlindungi:* ${adv.namaDai}\n` +
      `• *Lokasi Pendampingan:* ${adv.lokasi}\n` +
      `• *Urgensi:* ${adv.urgensi}\n` +
      `• *Penanggung Jawab LBH:* ${kadivHukum.name}\n` +
      `• *Diterbitkan Oleh:* ${user.fullName}\n\n` +
      `Pantau perkembangan perkara melalui Portal Pengurus SIAP APII:\n` +
      `https://apologetislamindonesia.or.id/portal/#advokasi\n\n` +
      `_LBH DPP Yayasan Apologet Islam Indonesia_`;

    showWhatsAppRelayModal(adv.namaDai, 'Da\'i Terlindungi / Klien LBH', targetPhone, msg);
  }

  function siarkanTabayyunWa(tbyId) {
    const user = Auth.getCurrentUser();
    const canBroadcast = user.role === 'superadmin' || user.role === 'sekretaris' || (user.role === 'ketua_divisi' && (user.divisi === 'humas' || user.divisi === 'sosmed'));
    if (!canBroadcast) {
      showToast('Akses Ditolak: Hanya Divisi Humas, Sosmed, atau Sekretariat yang berwenang menyiarkan rilis Tabayyun ke publik.', 'error');
      return;
    }

    const db = State.getDb();
    const tby = db.tabayyun.find(t => t.id === tbyId);
    if (!tby) return;

    const text = `*SIARAN PERS TABAYYUN & COUNTER-FRAMING YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n\n` +
      `*Judul Rilis:* ${tby.judulKlarifikasi}\n` +
      `*Tanggal:* ${tby.tglRilis}\n` +
      `*Saluran Media:* ${tby.saluranMedia}\n\n` +
      `*Isi Pernyataan Tabayyun Resmi:*\n${tby.naskahKlarifikasi}\n\n` +
      `• *Penanggung Jawab:* ${tby.penanggungJawab}\n` +
      `• *Website Resmi:* https://apologetislamindonesia.or.id\n` +
      `• *Portal Informasi:* https://apologetislamindonesia.or.id/portal/#advokasi\n\n` +
      `_Disiarkan oleh Divisi Humas & Sosmed Digital APII_`;

    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    showToast('Naskah rilis tabayyun disalin ke clipboard!');

    const humasOfficer = resolveOfficerSafe('ketua_divisi', tby.tenantId, 'humas');
    showWhatsAppRelayModal(humasOfficer.name, 'Koordinator Publikasi & Pers APII', humasOfficer.phone, text);
  }

  function openTambahAdvokasiModal(mode = 'lbh') {
    if (Auth.isReadOnly()) {
      showToast('Mode Read-Only: Pembina/Pengawas tidak dapat membuat entri baru.', 'error');
      return;
    }
    const isTabayyun = mode === 'tabayyun';
    document.getElementById('advokasi-form-mode').value = isTabayyun ? 'tabayyun' : 'lbh';
    document.getElementById('advokasi-form-title').textContent = isTabayyun
      ? 'Catat Rilis Radar Tabayyun Media'
      : 'Catat Laporan Kasus Darurat LBH APII';
    document.getElementById('advokasi-form-judul-label').textContent = isTabayyun
      ? 'Judul Klarifikasi Tabayyun *'
      : 'Nama Da\'i / Pihak Membutuhkan Bantuan Hukum *';
    document.getElementById('advokasi-form-kat-label').textContent = isTabayyun
      ? 'Saluran Media *'
      : 'Kategori Ancaman / Sengketa *';
    document.getElementById('advokasi-form-lok-label').textContent = isTabayyun
      ? 'Tautan Sumber Disinformasi'
      : 'Lokasi Kejadian *';
    document.getElementById('advokasi-form-uraian-label').textContent = isTabayyun
      ? 'Naskah Klarifikasi Resmi *'
      : 'Kronologi Intimidasi / Sengketa *';

    document.getElementById('advokasi-form-judul').value = '';
    document.getElementById('advokasi-form-kategori').value = isTabayyun ? 'Media Sosial & Portal Berita' : 'Pendampingan Hukum Dakwah';
    document.getElementById('advokasi-form-lokasi').value = '';
    document.getElementById('advokasi-form-uraian').value = '';

    document.getElementById('modal-advokasi-form')?.classList.remove('hidden');
  }

  function submitAdvokasiForm() {
    const mode = document.getElementById('advokasi-form-mode')?.value || 'lbh';
    const judul = document.getElementById('advokasi-form-judul')?.value?.trim();
    const kategori = document.getElementById('advokasi-form-kategori')?.value?.trim();
    const lokasi = document.getElementById('advokasi-form-lokasi')?.value?.trim();
    const uraian = document.getElementById('advokasi-form-uraian')?.value?.trim();

    if (!judul || !uraian) {
      showToast('Harap lengkapi judul dan uraian kasus.', 'error');
      return;
    }

    const db = State.getDb();
    const user = Auth.getCurrentUser();

    if (mode === 'tabayyun') {
      const newTby = {
        id: 'TBY-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
        tenantId: user.tenantId,
        tglRilis: formatTanggal(),
        saluranMedia: kategori || 'Media Sosial & Pers',
        judulKlarifikasi: judul,
        naskahKlarifikasi: uraian,
        sumberUrl: lokasi || '-',
        penanggungJawab: user.fullName
      };
      db.tabayyun.unshift(newTby);
      State.saveDatabase();
      State.logAudit('CREATE_TABAYYUN', 'Advokasi', newTby.id, { judul });
      syncApiSafe('saveTabayyun', newTby);
      closeModal('modal-advokasi-form');
      switchAdvokasiSubTab('tabayyun');
      renderAdvokasiWorkspace();
      showToast('Rilis Tabayyun Media berhasil dicatat!');
      return;
    }

    const newTiket = 'TIKET-LBH-202611-' + (db.advokasi.length + 1).toString().padStart(3, '0');
    const kadivHukum = resolveOfficerSafe('ketua_divisi', user.tenantId, 'hukum');
    const newAdv = {
      id: 'ADV-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      tenantId: user.tenantId,
      tiketNo: newTiket,
      namaDai: judul,
      kontak: kadivHukum.phone,
      lokasi: lokasi || 'Wilayah Dakwah APII',
      kronologi: `[${kategori || 'Urgent'}] ${uraian}`,
      urgensi: 'KILAT_DARURAT',
      buktiUrl: '#',
      status: 'MENUNGGU_TELAAH',
      catatanLbh: 'Laporan baru masuk via Crisis Intake.',
      updatedAt: formatWaktu()
    };

    db.advokasi.unshift(newAdv);
    State.saveDatabase();
    State.logAudit('INTAKE_ADVOKASI', 'Advokasi', newAdv.id, { tiket: newTiket, namaDai: judul });
    syncApiSafe('submitAdvokasiIntake', newAdv);

    closeModal('modal-advokasi-form');
    showToast(`Tiket Darurat ${newTiket} berhasil didaftarkan! Tim LBH disiagakan.`);
    renderAdvokasiWorkspace();
  }

  // =========================================================================
  // 8. MUALLAF CARE, PRESENSI SCAN QR & ASET QR
  // =========================================================================
  function renderMuallafWorkspace() {
    const db = State.getDb();
    const user = Auth.getCurrentUser();
    const isRo = Auth.isReadOnly();
    const cMuallaf = document.getElementById('subtab-muallaf-content');
    const cPresensi = document.getElementById('subtab-presensi-content');
    const cAset = document.getElementById('subtab-aset-content');

    const btnTambahMlf = document.getElementById('btn-tambah-muallaf');
    if (btnTambahMlf) {
      const canManageMuallaf = user.role === 'superadmin' || (user.role === 'ketua_divisi' && user.divisi === 'dakwah');
      if (canManageMuallaf && !isRo) {
        btnTambahMlf.classList.remove('hidden');
      } else {
        btnTambahMlf.classList.add('hidden');
      }
    }

    const btnScanPresensi = document.getElementById('btn-scan-presensi');
    if (btnScanPresensi) {
      if (isRo) btnScanPresensi.classList.add('hidden');
      else btnScanPresensi.classList.remove('hidden');
    }

    const scopedMuallaf = (db.muallaf || []).filter(m => isScopedRecordVisible(m.tenantId, 'dakwah'));
    const scopedAttendance = (db.attendance || []).filter(att => isScopedRecordVisible(att.tenantId));
    const scopedAssets = (db.assets || []).filter(ast => isScopedRecordVisible(ast.tenantId));

    if (cMuallaf) {
      if (scopedMuallaf.length === 0) {
        cMuallaf.innerHTML = `<div class="p-6 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 text-center">Belum ada data pembinaan muallaf pada yurisdiksi ini.</div>`;
      } else {
        cMuallaf.innerHTML = scopedMuallaf.map(m => `
          <div class="p-5 rounded-lg bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <span class="tabular-nums px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">${m.regNo}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900">ISLAM</span>
              </div>
              <h4 class="font-bold text-sm text-slate-900 mt-1.5">${m.namaHijrah} <span class="text-xs font-normal text-slate-600">(${m.namaAsli})</span></h4>
              <p class="text-xs text-slate-600 mt-0.5">Ikrar: ${formatTanggalDisplay(m.tglSyahadat)} &bull; Pembimbing: ${m.pembimbing}</p>
              <p class="tabular-nums text-xs text-amber-800 font-semibold mt-1">Status Zakat: ${m.statusZakat || 'PROSES_PENGAJUAN'} (Rp ${(Number(m.nominalSantunan) || 0).toLocaleString('id-ID')})</p>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" onclick="App.openSyahadatModal('${m.id}')" class="min-h-[44px] px-4 py-2 rounded bg-[#064E3B] text-white font-bold text-xs hover:bg-[#003527] shadow-sm transition-colors">
                Lihat Piagam A4 ber-QR
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    if (cPresensi) {
      if (scopedAttendance.length === 0) {
        cPresensi.innerHTML = `<div class="p-6 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 text-center">Belum ada catatan presensi kegiatan pada yurisdiksi ini.</div>`;
      } else {
        cPresensi.innerHTML = scopedAttendance.map(att => `
          <div class="p-4 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-3 text-xs">
            <div>
              <span class="font-bold text-slate-900 block">${att.namaAnggota}</span>
              <span class="tabular-nums font-mono text-slate-600">${att.nia} &bull; ${att.eventNama}</span>
            </div>
            <span class="tabular-nums text-emerald-900 font-semibold shrink-0">${formatTanggalDisplay(att.scanTimestamp)}</span>
          </div>
        `).join('');
      }
    }

    if (cAset) {
      if (scopedAssets.length === 0) {
        cAset.innerHTML = `<div class="p-6 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 text-center">Belum ada aset inventaris pada yurisdiksi ini.</div>`;
      } else {
        cAset.innerHTML = scopedAssets.map(ast => `
          <div class="p-4 rounded-lg bg-white border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
            <div>
              <span class="tabular-nums font-mono font-bold text-slate-900">${ast.kodeAset}</span>
              <h4 class="font-bold text-slate-900 mt-0.5">${ast.namaBarang}</h4>
              <span class="text-slate-600">Lokasi: ${ast.lokasiSimpan} &bull; Kondisi: ${ast.kondisi}</span>
            </div>
            <button type="button" onclick="App.openAssetQrModal('${ast.id}')" class="min-h-[44px] px-3.5 py-2 rounded bg-slate-100 hover:bg-slate-200 font-semibold text-slate-900 border border-slate-200 transition-colors">
              Cetak Stiker QR
            </button>
          </div>
        `).join('');
      }
    }
  }

  function switchMuallafSubTab(tab) {
    const map = [
      { key: 'muallaf', btn: 'tab-btn-muallaf', pane: 'subtab-muallaf-content' },
      { key: 'presensi', btn: 'tab-btn-presensi', pane: 'subtab-presensi-content' },
      { key: 'aset', btn: 'tab-btn-aset', pane: 'subtab-aset-content' }
    ];
    map.forEach(item => {
      const b = document.getElementById(item.btn);
      const p = document.getElementById(item.pane);
      if (item.key === tab) {
        b?.classList.remove('bg-slate-200', 'text-slate-900', 'font-semibold');
        b?.classList.add('bg-[#064E3B]', 'text-white', 'font-bold');
        p?.classList.remove('hidden');
      } else {
        b?.classList.remove('bg-[#064E3B]', 'text-white', 'font-bold');
        b?.classList.add('bg-slate-200', 'text-slate-900', 'font-semibold');
        p?.classList.add('hidden');
      }
    });
  }

  function openSyahadatModal(muallafId) {
    const db = State.getDb();
    const m = db.muallaf.find(x => x.id === muallafId);
    if (!m) return;

    const elReg = document.getElementById('syahadat-preview-reg');
    const elAsli = document.getElementById('syahadat-preview-nama-asli');
    const elHijrah = document.getElementById('syahadat-preview-nama-hijrah');
    const elTgl = document.getElementById('syahadat-preview-tgl');
    const elPem = document.getElementById('syahadat-preview-pembimbing');

    if (elReg) elReg.textContent = 'NO. REG: ' + m.regNo;
    if (elAsli) elAsli.textContent = m.namaAsli;
    if (elHijrah) elHijrah.textContent = m.namaHijrah;
    if (elTgl) elTgl.textContent = m.tglSyahadat;
    if (elPem) elPem.textContent = m.pembimbing;

    const modal = document.getElementById('modal-syahadat-preview');
    if (modal) modal.classList.remove('hidden');
  }

  function openAssetQrModal(assetId) {
    const db = State.getDb();
    const ast = (db.assets || []).find(a => a.id === assetId);
    if (!ast) return;
    const codeEl = document.getElementById('aset-qr-code-text');
    const nameEl = document.getElementById('aset-qr-name-text');
    const locEl = document.getElementById('aset-qr-loc-text');
    const canvas = document.getElementById('aset-qr-canvas');
    if (codeEl) codeEl.textContent = ast.kodeAset;
    if (nameEl) nameEl.textContent = ast.namaBarang;
    if (locEl) locEl.textContent = `${ast.lokasiSimpan} (${ast.kondisi})`;
    if (canvas) drawQrMatrix(canvas, `APII-ASSET:${ast.kodeAset}:${ast.id}`);
    document.getElementById('modal-asset-qr')?.classList.remove('hidden');
  }

  function openTambahMuallafModal() {
    const user = Auth.getCurrentUser();
    const canManageMuallaf = user.role === 'superadmin' || (user.role === 'ketua_divisi' && user.divisi === 'dakwah');
    if (!canManageMuallaf) {
      showToast('Akses Ditolak: Pendaftaran Ikrar Syahadat & Pembimbingan Muallaf merupakan wewenang khusus Divisi Dakwah & Pendidikan.', 'error');
      return;
    }

    if (Auth.isReadOnly()) {
      showToast('Akses ditolak: Akun peninjau / read-only tidak berwenang menambahkan data muallaf.', 'error');
      return;
    }

    const asliInput = document.getElementById('muallaf-form-asli');
    const hijrahInput = document.getElementById('muallaf-form-hijrah');
    const pembimbingInput = document.getElementById('muallaf-form-pembimbing');
    const santunanInput = document.getElementById('muallaf-form-santunan');
    if (asliInput) asliInput.value = '';
    if (hijrahInput) hijrahInput.value = '';
    if (pembimbingInput) pembimbingInput.value = user.fullName || '';
    if (santunanInput) santunanInput.value = '1500000';

    if (arguments.length > 0 && arguments[0] && typeof arguments[0] === 'object') {
      const bnd = resolveOfficerSafe('bendahara', user.tenantId);
      showWhatsAppRelayModal(bnd.name, bnd.roleLabel || bnd.role, bnd.phone, `Registrasi Muallaf Baru: ${arguments[0].namaHijrah || ''}`);
      return;
    }
    document.getElementById('modal-muallaf-form')?.classList.remove('hidden');
  }

  function submitMuallafForm() {
    const user = Auth.getCurrentUser();
    if (Auth.isReadOnly()) {
      showToast('Akses ditolak: Akun peninjau / read-only.', 'error');
      return;
    }

    const namaAsli = document.getElementById('muallaf-form-asli')?.value.trim();
    const namaHijrah = document.getElementById('muallaf-form-hijrah')?.value.trim();
    const pembimbing = document.getElementById('muallaf-form-pembimbing')?.value.trim() || user.fullName;
    const nominalSantunan = Math.max(0, Number(document.getElementById('muallaf-form-santunan')?.value) || 0);

    if (!namaAsli || !namaHijrah) {
      showToast('Nama Asli dan Nama Hijrah wajib diisi!', 'error');
      return;
    }

    const db = State.getDb();
    const newReg = 'APII-SYH-2026-' + (db.muallaf.length + 47).toString().padStart(4, '0');
    const newId = 'MLF-' + Math.random().toString(36).substring(2, 7).toUpperCase();

    const newMlf = {
      id: newId,
      tenantId: user.tenantId,
      regNo: newReg,
      namaAsli: namaAsli,
      namaHijrah: namaHijrah,
      tglSyahadat: formatTanggal(),
      tempatSyahadat: 'Sekretariat APII',
      pembimbing: pembimbing,
      saksi1: 'Ust. Dani Ramadhan, M.Ag.',
      saksi2: resolveOfficerSafe('bendahara', user.tenantId).name,
      sertifikatUrl: '#',
      statusZakat: nominalSantunan > 0 ? 'DRAFT_BKK_ZAKAT' : 'TANPA_SANTUNAN',
      nominalSantunan: nominalSantunan,
      createdAt: formatWaktu()
    };

    db.muallaf.unshift(newMlf);

    // Otomatis buat draf BKK Kantong Zakat (Ashnaf Muallaf) bila nominal santunan > 0
    if (nominalSantunan > 0 && db.kas && Array.isArray(db.kas.transactions)) {
      const noBkk = 'BKK-ZKT-' + (db.kas.transactions.length + 101).toString().padStart(4, '0');
      const settings = State.getTenantSettings ? State.getTenantSettings(user.tenantId) : { plafonKasTunai: 2000000 };
      const limit = Number(settings.plafonKasTunai) || 2000000;
      db.kas.transactions.unshift({
        id: 'TRX-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
        tenantId: user.tenantId,
        tanggal: formatTanggal(),
        tipe: 'KELUAR',
        kantongSyariah: 'ZAKAT',
        kategori: 'Ashnaf Muallaf',
        nominal: nominalSantunan,
        noVoucher: noBkk,
        noKwitansi: 'PENDING',
        keterangan: `Santunan Awal Muallaf Baru: ${namaHijrah} (${newReg})`,
        pihakTerkait: namaHijrah,
        metode: nominalSantunan > limit ? 'TRANSFER_BANK' : 'TUNAI',
        statusApproval: 'DRAFT',
        verifiedBendaharaBy: null,
        approvedKetuaBy: null,
        buktiUrl: '#',
        linkType: 'MUALLAF',
        linkId: newId
      });
    }

    State.saveDatabase();
    State.logAudit('RECORD_MUALLAF', 'Muallaf', newMlf.id, { reg: newReg, nama: namaHijrah, nominalSantunan });
    syncApiSafe('saveMuallaf', { muallaf: newMlf });

    closeModal('modal-muallaf-form');
    showToast(`Ikrar Syahadat ${namaHijrah} berhasil didaftarkan${nominalSantunan > 0 ? ' & Draf BKK Zakat diterbitkan!' : '!'}`);
    renderMuallafWorkspace();

    if (nominalSantunan > 0) {
      const targetBendahara = resolveOfficerSafe('bendahara', user.tenantId);
      const msg = `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n` +
        `*NOTIFIKASI REGISTRASI IKRAR SYAHADAT & DRAF BKK ZAKAT MUALLAF*\n\n` +
        `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
        `Yth. ${targetBendahara.name} (${targetBendahara.roleLabel || targetBendahara.role})\n\n` +
        `Alhamdulillah, telah terlaksana ikrar syahadat saudara/i baru kita dan Draf BKK Zakat Ashnaf Muallaf telah dibuat otomatis:\n` +
        `• *Nomor Registrasi:* ${newReg}\n` +
        `• *Nama Hijrah:* ${newMlf.namaHijrah}\n` +
        `• *Tanggal Ikrar:* ${newMlf.tglSyahadat}\n` +
        `• *Pembimbing:* ${newMlf.pembimbing}\n` +
        `• *Santunan Zakat (Draf BKK):* Rp ${nominalSantunan.toLocaleString('id-ID')}\n\n` +
        `Mohon verifikasi nota dan teruskan persetujuan Ketua melalui Portal Pengurus SIAP APII:\n` +
        `https://apologetislamindonesia.or.id/portal/#kas\n\n` +
        `_Divisi Dakwah & Pendidikan Yayasan APII_`;

      showWhatsAppRelayModal(targetBendahara.name, targetBendahara.roleLabel || targetBendahara.role, targetBendahara.phone, msg);
    }
  }

  function openScannerPresensiModal() {
    if (Auth.isReadOnly()) {
      showToast('Akses ditolak: Akun peninjau / read-only tidak dapat mencatat presensi.', 'error');
      return;
    }

    const db = State.getDb();
    const agendaSel = document.getElementById('presensi-form-agenda');
    const pesertaInput = document.getElementById('presensi-form-peserta');

    if (agendaSel) {
      const activeProker = (db.proker || []).filter(p => isScopedRecordVisible(p.tenantId));
      const baseAgendas = [
        'Dauroh Kristologi Komparatif Nasional 2026',
        'Rapat Koordinasi Pengurus & Kader',
        'Kajian Aqidah & Pembinaan Muallaf Pekanan'
      ];
      const allOptions = [...baseAgendas, ...activeProker.map(p => p.namaProgram)];
      agendaSel.innerHTML = allOptions.map(a => `<option value="${a}">${a}</option>`).join('');
    }
    if (pesertaInput) pesertaInput.value = 'APII-PUSAT-2026-00125';

    document.getElementById('modal-scanner-presensi')?.classList.remove('hidden');
  }

  function submitScannerPresensi() {
    if (Auth.isReadOnly()) {
      showToast('Akses ditolak: Akun peninjau / read-only.', 'error');
      return;
    }

    const user = Auth.getCurrentUser();
    const eventNama = document.getElementById('presensi-form-agenda')?.value || 'Kajian Nasional APII';
    const rawPeserta = document.getElementById('presensi-form-peserta')?.value.trim();
    if (!rawPeserta) {
      showToast('Nomor NIA atau Nama Kader wajib diisi!', 'error');
      return;
    }

    const db = State.getDb();
    const anggota = (db.anggota || []).find(a => a.nia && a.nia.toLowerCase() === rawPeserta.toLowerCase());
    const nama = anggota ? anggota.namaLengkap : rawPeserta;
    const niaVal = anggota ? anggota.nia : rawPeserta;

    const newAtt = {
      id: 'ATT-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      tenantId: user.tenantId || 'DPP_PUSAT',
      eventNama: eventNama,
      tanggal: formatTanggal(),
      nia: niaVal,
      namaAnggota: nama,
      scanTimestamp: formatWaktu(),
      verifiedBy: `${user.fullName} (Presensi QR)`
    };

    db.attendance.unshift(newAtt);
    State.saveDatabase();
    State.logAudit('RECORD_ATTENDANCE', 'Attendance', newAtt.id, { nia: niaVal, event: eventNama });
    syncApiSafe('recordEventAttendance', { attendance: newAtt });

    closeModal('modal-scanner-presensi');
    showToast(`Presensi berhasil dicatat untuk: ${nama}!`);
    renderMuallafWorkspace();
  }

  // =========================================================================
  // 9. MAKTABAH APOLOGETIKA, KONSULTASI AQIDAH & RISALAH MUSYAWARAH PLENO
  // =========================================================================
  let maktabahSearchQuery = '';

  function copyMaktabahDalil(kbId) {
    const db = State.getDb();
    const kb = (db.knowledgeBase || []).find(k => k.id === kbId);
    if (!kb) return;
    const text = `${kb.topik}\n${kb.dalilText}\n(Sumber: ${kb.sumberReferensi})`;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Dalil berhasil disalin untuk bahan ceramah mimbar!');
      }).catch(() => {
        showToast('Gagal mengakses clipboard peramban.', 'warning');
      });
    } else {
      showToast('Fitur clipboard tidak tersedia pada peramban ini.', 'warning');
    }
  }

  function renderMaktabahWorkspace() {
    const db = State.getDb();
    const user = Auth.getCurrentUser();
    const isRo = Auth.isReadOnly();
    const containerMaktabah = document.getElementById('maktabah-cards-list');
    const containerKonsultasi = document.getElementById('subtab-konsultasi-content');
    const containerRisalah = document.getElementById('subtab-risalah-content');

    if (containerMaktabah) {
      const q = (maktabahSearchQuery || '').trim().toLowerCase();
      const filteredKb = (db.knowledgeBase || []).filter(kb => {
        if (!q) return true;
        return (
          (kb.topik || '').toLowerCase().includes(q) ||
          (kb.dalilText || '').toLowerCase().includes(q) ||
          (kb.kategori || '').toLowerCase().includes(q) ||
          (kb.kataKunci || '').toLowerCase().includes(q) ||
          (kb.sumberReferensi || '').toLowerCase().includes(q)
        );
      });

      if (filteredKb.length === 0) {
        containerMaktabah.innerHTML = `<div class="col-span-full p-6 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 text-center">Tidak ada entri dalil yang cocok dengan kata kunci pencarian.</div>`;
      } else {
        containerMaktabah.innerHTML = filteredKb.map(kb => `
          <div class="p-5 rounded-lg bg-white border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
            <div>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900">${kb.kategori}</span>
              <h4 class="font-bold text-sm text-slate-900 mt-2">${kb.topik}</h4>
              <p class="text-xs text-slate-800 leading-relaxed mt-1.5 bg-slate-50 p-3 rounded border border-slate-200">${kb.dalilText}</p>
              <p class="text-[11px] text-slate-600 italic mt-2">Sumber: ${kb.sumberReferensi}</p>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-slate-200 text-[11px]">
              <span class="text-slate-600">Kata Kunci: ${kb.kataKunci}</span>
              <button type="button" onclick="App.copyMaktabahDalil('${kb.id}')" class="min-h-[44px] px-3 py-1.5 text-xs font-bold text-[#064E3B] hover:underline">
                Salin Dalil &rarr;
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    if (containerKonsultasi) {
      const tickets = db.consultations || [];
      const canAnswer = !isRo && (
        user.role === 'superadmin' ||
        ((user.role === 'ketua_divisi' || user.role === 'anggota_divisi') && (user.divisi === 'litbang' || user.divisi === 'dakwah'))
      );

      let htmlK = `
        <div class="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h3 class="font-display font-bold text-sm text-slate-900">Meja Konsultasi Aqidah Rahasia (${tickets.length} Tiket)</h3>
            <p class="text-xs text-slate-600 mt-0.5">Identitas penanya dirahasiakan secara kriptografis melalui SHA-256 Token Hash untuk menjaga privasi penuh jamaah &amp; pemohon.</p>
          </div>
        </div>
      `;

      if (tickets.length === 0) {
        htmlK += `<div class="p-6 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 text-center">Belum ada tiket konsultasi masuk.</div>`;
      } else {
        htmlK += tickets.map(t => {
          const isAnswered = t.status === 'TERJAWAB' && t.jawaban;
          return `
            <div class="p-5 rounded-lg bg-white border border-slate-200 shadow-sm flex flex-col gap-3">
              <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <div class="flex items-center gap-2">
                  <span class="tabular-nums font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">${t.tiketNo}</span>
                  <span class="font-mono text-[10px] text-slate-600">Hash: ${(t.tokenHash || '').substring(0, 14)}...</span>
                </div>
                <span class="px-2.5 py-0.5 rounded text-[10px] font-bold ${isAnswered ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-800'}">
                  ${t.status || 'MENUNGGU_JAWABAN'}
                </span>
              </div>
              <div>
                <h4 class="font-bold text-sm text-slate-900">${t.topik}</h4>
                <p class="text-xs text-slate-700 mt-1.5 leading-relaxed bg-slate-50 p-3 rounded border border-slate-200">${t.pertanyaan}</p>
              </div>
              ${isAnswered ? `
                <div class="p-3 rounded bg-emerald-50 border border-emerald-200 text-xs">
                  <span class="font-bold text-emerald-950 block mb-1">Jawaban Resmi (${t.curatedBy || 'Tim Litbang APII'} &bull; ${formatTanggalDisplay(t.answeredAt)}):</span>
                  <p class="text-slate-800 leading-relaxed">${t.jawaban}</p>
                </div>
              ` : ''}
              ${canAnswer ? `
                <div class="flex flex-col gap-2 pt-2 border-t border-slate-200">
                  <label for="consult-reply-${t.id}" class="text-[11px] font-bold text-slate-700">${isAnswered ? 'Perbarui Jawaban Ilmiah:' : 'Tulis Jawaban Resmi & Ilmiah:'}</label>
                  <textarea id="consult-reply-${t.id}" rows="2" placeholder="Tuliskan jawaban apologetika berbasis dalil Al-Qur'an, Hadits, dan manuskrip..." class="w-full px-3 py-2 rounded border border-slate-300 text-xs">${t.jawaban || ''}</textarea>
                  <div class="flex justify-end">
                    <button type="button" onclick="App.answerConsultation('${t.id}')" class="min-h-[44px] px-4 py-2 rounded bg-[#064E3B] hover:bg-[#003527] text-white font-bold text-xs">
                      ${isAnswered ? 'Perbarui Jawaban Tiket' : 'Kirim Jawaban Tiket'}
                    </button>
                  </div>
                </div>
              ` : ''}
            </div>
          `;
        }).join('');
      }
      containerKonsultasi.innerHTML = htmlK;
    }

    if (containerRisalah) {
      const scopedMeetings = (db.meetings || []).filter(m => isScopedRecordVisible(m.tenantId));
      const canCreateRisalah = !isRo && (user.role === 'superadmin' || user.role === 'sekretaris');
      let html2 = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p class="text-xs text-slate-600">Dokumentasi keputusan rapat pleno beserta pelacakan tindak lanjut ke Disposisi &amp; Program Kerja.</p>
          ${canCreateRisalah ? `
            <button type="button" onclick="App.openTambahRisalahModal()" class="min-h-[44px] px-4 py-2 rounded bg-[#064E3B] hover:bg-[#003527] text-white font-bold text-xs shadow-sm shrink-0">
              + Catat Risalah Rapat Pleno
            </button>
          ` : ''}
        </div>
      `;

      scopedMeetings.forEach(m => {
        html2 += `
          <div class="p-5 rounded-lg bg-white border border-slate-200 shadow-sm flex flex-col gap-4">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div>
                <h4 class="font-bold text-sm text-slate-900">${m.judulRapat}</h4>
                <span class="text-xs text-slate-600">Tanggal: ${formatTanggalDisplay(m.tanggal)} &bull; Pimpinan: ${m.pimpinanRapat}${m.peserta ? ' &bull; Peserta: ' + m.peserta : ''}</span>
              </div>
              <span class="px-2.5 py-1 rounded bg-emerald-100 text-emerald-900 font-bold text-xs">BERPARAF DIGITAL</span>
            </div>
            <p class="text-xs text-slate-800 leading-relaxed">${m.notulenText}</p>
            <div class="p-3 rounded bg-slate-50 border border-slate-200 flex flex-col gap-2 text-xs">
              <span class="font-bold text-slate-900">Ekstraksi Action Items ke Divisi:</span>
              ${(m.actionItems || []).map((a, idx) => `
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b border-slate-200 last:border-none">
                  <div>
                    <span class="text-slate-900 font-medium">&bull; ${a.task}</span>
                    <span class="text-[11px] text-slate-600 block sm:inline sm:ml-2">(PIC: <strong>${a.pic || 'Divisi Terkait'}</strong>${a.dispatchedTo ? ' &bull; Terkait: ' + a.dispatchedTo : ''})</span>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    ${(!a.dispatchedTo && canCreateRisalah) ? `
                      <button type="button" onclick="App.dispatchRisalahAction('${m.id}', ${idx}, 'disposisi')" class="min-h-[36px] px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 text-[11px] font-semibold">
                        &rarr; Disposisi
                      </button>
                      <button type="button" onclick="App.dispatchRisalahAction('${m.id}', ${idx}, 'proker')" class="min-h-[36px] px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-semibold">
                        &rarr; Proker
                      </button>
                    ` : ''}
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${a.status === 'SELESAI' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-800'}">${a.status}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });
      containerRisalah.innerHTML = html2;
    }
  }

  function answerConsultation(ticketId) {
    if (Auth.isReadOnly()) {
      showToast('Akses ditolak: Akun peninjau / read-only.', 'error');
      return;
    }
    const db = State.getDb();
    const ticket = (db.consultations || []).find(c => c.id === ticketId);
    if (!ticket) return;

    const replyText = document.getElementById(`consult-reply-${ticketId}`)?.value.trim();
    if (!replyText || replyText.length < 15) {
      showToast('Jawaban konsultasi wajib diisi minimal 15 karakter!', 'error');
      return;
    }

    const user = Auth.getCurrentUser();
    ticket.jawaban = replyText;
    ticket.status = 'TERJAWAB';
    ticket.answeredAt = formatWaktu();
    ticket.curatedBy = `${user.fullName} (${CONFIG.ROLES[user.role]?.label || user.role})`;

    State.saveDatabase();
    State.logAudit('ANSWER_CONSULTATION', 'Consultation', ticket.id, { tiketNo: ticket.tiketNo });
    syncApiSafe('answerConsultation', { id: ticket.id, jawaban: replyText, curatedBy: ticket.curatedBy });

    showToast(`Jawaban tiket ${ticket.tiketNo} berhasil dipublikasikan ke kanal verifikasi penanya!`);
    renderMaktabahWorkspace();
  }

  function openTambahRisalahModal() {
    if (Auth.isReadOnly()) {
      showToast('Akses ditolak: Akun peninjau / read-only.', 'error');
      return;
    }
    const user = Auth.getCurrentUser();
    if (user.role !== 'superadmin' && user.role !== 'ketua' && user.role !== 'sekretaris') {
      showToast('Akses ditolak: Hanya Sekretaris, Ketua, atau Superadmin yang mencatat risalah pleno.', 'error');
      return;
    }

    const jEl = document.getElementById('risalah-form-judul');
    const pEl = document.getElementById('risalah-form-pimpinan');
    const psEl = document.getElementById('risalah-form-peserta');
    const kEl = document.getElementById('risalah-form-keputusan');
    if (jEl) jEl.value = '';
    if (pEl) pEl.value = resolveOfficerSafe('ketua', user.tenantId).name;
    if (psEl) psEl.value = '';
    if (kEl) kEl.value = '';

    document.getElementById('modal-risalah-form')?.classList.remove('hidden');
  }

  function submitRisalahForm() {
    if (Auth.isReadOnly()) return;
    const judul = document.getElementById('risalah-form-judul')?.value.trim();
    const pimpinan = document.getElementById('risalah-form-pimpinan')?.value.trim();
    const peserta = document.getElementById('risalah-form-peserta')?.value.trim();
    const keputusanRaw = document.getElementById('risalah-form-keputusan')?.value.trim();

    if (!judul || !pimpinan || !keputusanRaw) {
      showToast('Judul rapat, pimpinan, dan poin keputusan wajib diisi!', 'error');
      return;
    }

    const user = Auth.getCurrentUser();
    const db = State.getDb();
    const lines = keputusanRaw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const newMeeting = {
      id: 'MTG-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      tenantId: user.tenantId,
      judulRapat: judul,
      tanggal: formatTanggal(),
      pimpinanRapat: pimpinan,
      peserta: peserta || 'Pengurus BPH',
      notulenText: lines.join(' '),
      actionItems: lines.map(line => ({
        task: line.replace(/^\d+[\.\)]\s*/, ''),
        pic: 'sekretaris',
        deadline: formatTanggal(),
        status: 'PROGRES',
        dispatchedTo: null
      })),
      parafPimpinan: `${pimpinan} & ${user.fullName}`,
      dokumentasiUrl: '#'
    };

    db.meetings.unshift(newMeeting);
    State.saveDatabase();
    State.logAudit('CREATE_MEETING_MINUTES', 'Meeting', newMeeting.id, { judul });
    syncApiSafe('saveMeetingPlenary', { meeting: newMeeting });

    closeModal('modal-risalah-form');
    showToast('Risalah Rapat Pleno berhasil disimpan dengan Paraf Digital!');
    renderMaktabahWorkspace();
  }

  function dispatchRisalahAction(meetingId, itemIdx, targetType) {
    if (Auth.isReadOnly()) return;
    const db = State.getDb();
    const meeting = (db.meetings || []).find(m => m.id === meetingId);
    if (!meeting || !meeting.actionItems || !meeting.actionItems[itemIdx]) return;

    const item = meeting.actionItems[itemIdx];
    const user = Auth.getCurrentUser();

    if (targetType === 'disposisi') {
      const noAgenda = State.generateNextNomorAgenda ? State.generateNextNomorAgenda(user.tenantId) : 'AGENDA-' + ((db.suratMasuk?.length || 0) + 11);
      const newSm = {
        id: 'SMK-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
        tenantId: user.tenantId,
        noAgenda: noAgenda,
        asalSurat: `Risalah Rapat: ${meeting.judulRapat}`,
        noSuratAsli: meeting.id,
        tglSurat: meeting.tanggal || formatTanggal(),
        tglTerima: formatTanggal(),
        perihal: item.task,
        ringkasan: `Tindak lanjut keputusan rapat pleno (${meeting.tanggal}).`,
        pdfFileUrl: '#',
        statusDisposisi: 'PENDING_KETUA',
        drafRekomendasiSekretaris: 'Mohon arahan Ketua untuk eksekusi tindak lanjut hasil rapat.',
        targetDivisi: ['dakwah'],
        tingkatUrgensi: 'NORMAL',
        instruksiKetua: '',
        batasWaktu: formatTanggal(new Date(Date.now() + 7 * 86400000)),
        catatanTambahan: '',
        parafKetua: null,
        laporanPerDivisi: {},
        laporanTindakLanjut: ''
      };
      if (!Array.isArray(db.suratMasuk)) db.suratMasuk = [];
      db.suratMasuk.unshift(newSm);
      item.dispatchedTo = `Disposisi ${noAgenda}`;
    } else {
      const divDef = (CONFIG.DIVISIONS || []).find(d => d.code === 'dakwah') || { code: 'dakwah', name: 'Divisi Dakwah & Pendidikan' };
      const newPrk = {
        id: 'PRK-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
        tenantId: user.tenantId,
        divisiKode: divDef.code,
        divisiNama: divDef.name,
        namaProgram: item.task,
        latarBelakang: `Amanat Risalah Rapat: ${meeting.judulRapat}`,
        targetSasaran: 'Kader & Jamaah APII',
        rabNominal: 5000000,
        kantongSyariah: 'INFAQ',
        realisasiDana: 0,
        tglPelaksanaan: formatTanggal(new Date(Date.now() + 14 * 86400000)),
        status: 'AJUKAN',
        catatanKetua: 'Usulan turunan langsung dari Risalah Rapat Pleno.',
        lpjDriveUrl: '#',
        statusLpj: 'BELUM_MULAI',
        createdBy: user.fullName,
        createdAt: formatWaktu()
      };
      db.proker.unshift(newPrk);
      item.dispatchedTo = `Proker ${newPrk.id}`;
    }

    State.saveDatabase();
    State.logAudit('DISPATCH_MEETING_ACTION', 'Meeting', meeting.id, { targetType, itemIdx, dispatchedTo: item.dispatchedTo });
    showToast(`Action item berhasil dikirim ke ${item.dispatchedTo}!`);
    renderMaktabahWorkspace();
  }

  function switchMaktabahSubTab(tab) {
    const map = [
      { key: 'maktabah', btn: 'tab-btn-maktabah', pane: 'subtab-maktabah-content' },
      { key: 'konsultasi', btn: 'tab-btn-konsultasi', pane: 'subtab-konsultasi-content' },
      { key: 'risalah', btn: 'tab-btn-risalah', pane: 'subtab-risalah-content' }
    ];
    map.forEach(item => {
      const b = document.getElementById(item.btn);
      const p = document.getElementById(item.pane);
      if (item.key === tab) {
        b?.classList.remove('bg-slate-200', 'text-slate-900', 'font-semibold');
        b?.classList.add('bg-[#064E3B]', 'text-white', 'font-bold');
        p?.classList.remove('hidden');
      } else {
        b?.classList.remove('bg-[#064E3B]', 'text-white', 'font-bold');
        b?.classList.add('bg-slate-200', 'text-slate-900', 'font-semibold');
        p?.classList.add('hidden');
      }
    });
  }

  // =========================================================================
  // 10. PENGATURAN SISTEM, IAM, DEADLOCK BREAKER, MASTER SETTINGS & FEDERASI
  // =========================================================================
  let currentActiveSistemTab = 'iam';
  let auditSearchQuery = '';

  function renderSistemWorkspace() {
    renderIamSubTab();
    renderSessionsSubTab();
    renderDeadlockBreakerSubTab();
    renderSettingsSubTab();
    renderWilayahSubTab();
    renderCmsSubTab();
    renderDriveSubTab();
    renderAuditSubTab();
  }

  function switchSistemSubTab(tab) {
    currentActiveSistemTab = tab;
    const tabs = ['iam', 'sessions', 'deadlock', 'settings', 'wilayah', 'minicms', 'drive', 'audit'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      const pane = document.getElementById(`subtab-${t}-content`);
      if (t === tab) {
        btn?.classList.remove('bg-surface-container', 'text-on-surface', 'font-semibold');
        btn?.classList.add('bg-primary', 'text-white', 'font-bold');
        pane?.classList.remove('hidden');
      } else {
        btn?.classList.remove('bg-primary', 'text-white', 'font-bold');
        btn?.classList.add('bg-surface-container', 'text-on-surface', 'font-semibold');
        pane?.classList.add('hidden');
      }
    });

    if (tab === 'iam') renderIamSubTab();
    if (tab === 'sessions') renderSessionsSubTab();
    if (tab === 'deadlock') renderDeadlockBreakerSubTab();
    if (tab === 'settings') renderSettingsSubTab();
    if (tab === 'wilayah') renderWilayahSubTab();
    if (tab === 'minicms') renderCmsSubTab();
    if (tab === 'drive') renderDriveSubTab();
    if (tab === 'audit') renderAuditSubTab();
  }

  // --- SUBTAB 1: IAM, AKUN PENGURUS & MATRIKS 8-ROLE RBAC PARIPURNA ---
  let currentIamView = 'users'; // 'users' | 'matrix' | 'sod'

  function switchIamView(view) {
    currentIamView = view;
    renderIamSubTab();
  }

  function renderRoleBadge(role, divisi, tenantId) {
    const isDpw = tenantId && tenantId.startsWith('DPW_');
    const suffix = isDpw ? ' (DPW)' : '';

    switch (role) {
      case 'superadmin':
        return '<span class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-300">SUPERADMIN</span>';
      case 'ketua':
        return `<span class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-950 border border-emerald-300">KETUA${suffix} (BPH)</span>`;
      case 'sekretaris':
        return `<span class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-100 text-blue-950 border border-blue-300">SEKRETARIS${suffix} (BPH)</span>`;
      case 'bendahara':
        return `<span class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-cyan-100 text-cyan-950 border border-cyan-300">BENDAHARA${suffix} (BPH)</span>`;
      case 'pembina':
        return '<span class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-100 text-purple-950 border border-purple-300">PEMBINA (READ-ONLY)</span>';
      case 'pengawas':
        return '<span class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-orange-100 text-orange-950 border border-orange-300">PENGAWAS (FORENSIK)</span>';
      case 'ketua_divisi':
        return `<span class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-teal-100 text-teal-950 border border-teal-300">KADIV: ${(divisi || 'DIVISI').toUpperCase()}${suffix}</span>`;
      case 'anggota_divisi':
        return `<span class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-100 text-indigo-950 border border-indigo-300">ANGGOTA (${(divisi || 'DAKWAH').toUpperCase()})${suffix}</span>`;
      case 'kader_biasa':
        return '<span class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-950 border border-rose-300">KADER (NON-PENGURUS)</span>';
      default:
        return `<span class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-surface-container text-on-surface">${(role || 'PENGURUS').toUpperCase()}</span>`;
    }
  }

  function renderIamSubTab() {
    const cIam = document.getElementById('subtab-iam-content');
    if (!cIam) return;

    const accounts = Auth.getAllAccounts();
    const totalCount = accounts.length;
    const pengurusList = accounts.filter(u => u.isPengurus !== false && u.role !== 'kader_biasa');
    const activeCount = pengurusList.filter(u => u.isActive !== false).length;
    const demisionerCount = pengurusList.length - activeCount;

    // View Navigation Bar (Users vs Matrix vs SoD)
    let html = `
      <div class="flex items-center gap-2 border-b border-surface-container pb-2 mb-2">
        <button type="button" onclick="App.switchIamView('users')" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
          currentIamView === 'users' ? 'bg-primary text-white shadow' : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
        }">
          Daftar ${totalCount} Akun (Pengurus & Simulasi)
        </button>
        <button type="button" onclick="App.switchIamView('matrix')" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
          currentIamView === 'matrix' ? 'bg-primary text-white shadow' : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
        }">
          Matriks Hak Akses 8 Peran RBAC (PRD Bab 2.2)
        </button>
        <button type="button" onclick="App.switchIamView('sod')" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
          currentIamView === 'sod' ? 'bg-primary text-white shadow' : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
        }">
          Pemisahan Tugas & Batasan Wewenang (SoD)
        </button>
      </div>
    `;

    if (currentIamView === 'users') {
      html += `
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-2">
          <div class="p-3.5 rounded-xl bg-surface-container border border-surface-container-high flex items-center justify-between">
            <div>
              <span class="text-xs text-on-surface-variant font-medium">Total Akun Roster</span>
              <h4 class="font-display font-bold text-lg text-primary">${totalCount} Akun Roster</h4>
            </div>
            <span class="material-symbols-outlined text-primary text-[28px]">manage_accounts</span>
          </div>
          <div class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <div>
              <span class="text-xs text-emerald-800 font-medium">Pengurus Aktif Menjabat</span>
              <h4 class="font-display font-bold text-lg text-emerald-900">${activeCount} Pejabat</h4>
            </div>
            <span class="material-symbols-outlined text-emerald-700 text-[28px]">verified_user</span>
          </div>
          <div class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between">
            <div>
              <span class="text-xs text-rose-800 font-medium">Demisioner / Nonaktif</span>
              <h4 class="font-display font-bold text-lg text-rose-900">${demisionerCount} Akun</h4>
            </div>
            <span class="material-symbols-outlined text-rose-700 text-[28px]">person_off</span>
          </div>
          <div class="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
            <div>
              <span class="text-xs text-indigo-800 font-medium">Peran Baku RBAC</span>
              <h4 class="font-display font-bold text-lg text-indigo-900">8 Peran Baku</h4>
            </div>
            <span class="material-symbols-outlined text-indigo-700 text-[28px]">shield_person</span>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div>
            <h3 class="font-display font-bold text-sm text-primary">Roster 20 Akun Pengurus Resmi (DPP Pusat & DPW Jabodetabek) + 1 Simulasi Kader</h3>
            <p class="text-xs text-on-surface-variant">Sesuai PRD Bab 2.3.1: Hak prerogatif Superadmin mengelola mandat, reset kata sandi, dan status demisioner seketika. Kader biasa tanpa SK diblokir dari Portal Pengurus.</p>
          </div>
          <button type="button" onclick="App.openUserModal()" class="px-3.5 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary-container shadow flex items-center gap-1.5 shrink-0 transition-all">
            <span class="material-symbols-outlined text-[16px]">person_add</span>
            <span>+ Tambah Pengurus Baru</span>
          </button>
        </div>

        <div class="overflow-x-auto rounded-xl border border-surface-container bg-surface-container-lowest shadow-sm">
          <table class="w-full text-left text-xs">
            <thead class="bg-surface-container font-bold text-on-surface-variant border-b border-surface-container-high">
              <tr>
                <th class="px-4 py-3">Nama Pengurus</th>
                <th class="px-4 py-3">Username & Kontak</th>
                <th class="px-4 py-3">Peran Jabatan (RBAC)</th>
                <th class="px-4 py-3">Yurisdiksi Wilayah</th>
                <th class="px-4 py-3 text-center">Status</th>
                <th class="px-4 py-3 text-right">Aksi Superadmin</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-container">
              ${accounts.map(u => {
                const isActive = u.isActive !== false;
                const isNonPengurus = u.isPengurus === false || u.role === 'kader_biasa';
                const roleBadge = renderRoleBadge(u.role, u.divisi, u.tenantId);
                const initial = (u.fullName || u.username).substring(0, 2).toUpperCase();
                const designation = Auth.getRoleTitleByYurisdiksi ? Auth.getRoleTitleByYurisdiksi(u.role, u.tenantId, u.divisi) : (u.category || u.role.toUpperCase());

                return `
                  <tr class="hover:bg-surface-container-low transition-colors ${!isActive ? 'opacity-60 bg-gray-50' : isNonPengurus ? 'bg-rose-50/20' : ''}">
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-full ${isNonPengurus ? 'bg-rose-700' : 'bg-primary'} text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                          ${initial}
                        </div>
                        <div>
                          <span class="font-bold text-primary block leading-tight">${u.fullName}</span>
                          <span class="text-[10px] ${isNonPengurus ? 'text-rose-800' : 'text-emerald-800'} font-semibold block">${designation}</span>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      <span class="font-mono text-gray-700 block">${u.username}</span>
                      <span class="text-[11px] text-on-surface-variant">${u.phone ? '+' + u.phone : '-'}</span>
                    </td>
                    <td class="px-4 py-3">
                      ${roleBadge}
                    </td>
                    <td class="px-4 py-3">
                      <span class="font-medium text-gray-700">${u.tenantId || 'DPP_PUSAT'}</span>
                    </td>
                    <td class="px-4 py-3 text-center">
                      ${isNonPengurus
                        ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">Kader Biasa (Akses Ditolak)</span>'
                        : (isActive
                          ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Aktif Menjabat</span>'
                          : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">Demisioner / Nonaktif</span>')
                      }
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex items-center justify-end gap-1.5">
                        <button type="button" onclick="App.openUserModal('${u.id}')" title="Edit Akun" class="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary transition-all">
                          <span class="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button type="button" onclick="App.openResetPasswordModal('${u.id}')" title="Reset Kata Sandi" class="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-all">
                          <span class="material-symbols-outlined text-[16px]">lock_reset</span>
                        </button>
                        ${!isNonPengurus ? (isActive
                          ? `<button type="button" onclick="App.toggleUserStatus('${u.id}', false)" title="Tandai Demisioner & Cabut Sesi" class="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold transition-all">
                              Nonaktifkan
                            </button>`
                          : `<button type="button" onclick="App.toggleUserStatus('${u.id}', true)" title="Aktifkan Kembali Pengurus" class="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold transition-all">
                              Aktifkan
                            </button>`
                        ) : `<span class="text-[10px] text-slate-600 italic">Non-Pengurus</span>`}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (currentIamView === 'matrix') {
      // 8-Role RBAC Specification & Access Matrix per PRD Bab 2.2
      const rolesData = [
        {
          id: 'superadmin',
          label: 'Superadmin Nasional',
          category: 'Administrator Utama',
          workspaces: '10 Ruang Kerja (Akses Mutlak Global)',
          desc: 'Administrator sistem pusat. Mengelola seluruh tenant DPP & DPW se-Indonesia, manajemen akun user, master wilayah federasi, konfigurasi global, audit log forensik WORM, dan pemulihan kedaruratan.',
          approval: 'Bypass darurat teknis & pemecah kebuntuan birokrasi (Deadlock Breaker) dengan logging permanen SUPERADMIN_OVERRIDE.',
          sod: 'Diawasi langsung oleh sistem audit trail WORM permanen. Seluruh tindakan override tidak dapat diedit atau dihapus.',
          badgeColor: 'bg-amber-100 text-amber-950 border border-amber-300'
        },
        {
          id: 'ketua',
          label: 'Ketua Umum (DPP) / Ketua DPW',
          category: 'Pimpinan Eksekutif (BPH)',
          workspaces: '9 Ruang Kerja Mandat (DPP Lintas-DPW; DPW Yurisdiksi Wilayah)',
          desc: 'Pemimpin tertinggi, pemutus kebijakan eksekutif organisasi, penandatangan naskah dinas keputusan/rekomendasi berstempel basah digital, pengesah program kerja divisi, dan penanggung jawab tertinggi tata kelola yayasan.',
          approval: '1. Sahkan Surat Dinas Keluar<br>2. Dual-Approval Kas Keluar Tahap 2 (Ketum Approval)<br>3. Otorisasi Lembar Disposisi (5 Instruksi Baku & Paraf Digital)<br>4. Otorisasi Pagu Anggaran Program Kerja Divisi<br>5. Pengesahan Akhir KTA Anggota 5 Tahun',
          sod: 'Dilarang mencairkan kas keluar sebelum nota diverifikasi sah oleh Bendahara (Dual-Approval Tahap 1 wajib dilewati). Dilarang membuat nota keuangan sepihak. Ruang Kerja Sistem/IAM merupakan ranah teknis Superadmin.',
          badgeColor: 'bg-emerald-100 text-emerald-950 border border-emerald-300'
        },
        {
          id: 'sekretaris',
          label: 'Sekretaris Umum / Sekretaris DPW',
          category: 'Pimpinan Kesekretariatan (BPH)',
          workspaces: '5 Ruang Kerja Mandat (Dashboard, Persuratan, Disposisi, Keanggotaan, Maktabah)',
          desc: 'Gerbang administrasi persuratan dinas naskah A4, pengelola agenda surat masuk & berkas PDF, verifikator berkas pendaftaran KTA, dan penyusun risalah musyawarah.',
          approval: '1. Konseptor & Penerbit Surat Keluar A4<br>2. Generator SK Kepengurusan 1-Klik<br>3. Penerbit Draf Rekomendasi Disposisi Surat Masuk<br>4. Verifikasi Tahap 1 Berkas KTP Pendaftar KTA',
          sod: 'STRICT TERKUNCI: Dilarang keras mencatat buku kas masuk (BKM), dilarang mengajukan kas keluar (BKK), dan dilarang mencairkan kas (Pencegahan benturan kepentingan administrasi vs keuangan). Ruang Kerja Kas & Sistem tidak tampil.',
          badgeColor: 'bg-blue-100 text-blue-950 border border-blue-300'
        },
        {
          id: 'bendahara',
          label: 'Bendahara Umum / Bendahara DPW',
          category: 'Pimpinan Keuangan (BPH)',
          workspaces: '3 Ruang Kerja Mandat (Dashboard, Kas Syar\'i, Maktabah)',
          desc: 'Penjaga perbendaharaan syar\'i 4 kantong kas (Amil, Zakat, Infaq, Wakaf), simulator arus kas, pengawal batas brankas tunai Rp 2 Juta (Cash Buffer Limit), rekonsiliasi bulanan PSAK 409, dan penatausaha rekening kas/bank yayasan.',
          approval: '1. Verifikasi Tahap 1 Kas Keluar (Pemeriksaan Nota & Struk Belanja)<br>2. Otoritas Mutlak Kas Masuk (Infaq/Donasi/Zakat)<br>3. Penerbit Kwitansi Resmi Dual-Slip A5 Ber-QR',
          sod: 'STRICT TERKUNCI: Dilarang keras membuat surat dinas, dilarang mencatat surat masuk/disposisi, dan dilarang mengesahkan KTA (Pencegahan pencatatan dan pengeluaran anggaran sepihak). Ruang Kerja Persuratan, Disposisi, Keanggotaan & Sistem tidak tampil.',
          badgeColor: 'bg-cyan-100 text-cyan-950 border border-cyan-300'
        },
        {
          id: 'pembina',
          label: 'Dewan Pembina Yayasan',
          category: 'Dewan Pimpinan Tinggi',
          workspaces: '6 Ruang Kerja Mandat (Dashboard, Kas, Proker, Keanggotaan, Advokasi, Maktabah) - Mode Executive Read-Only',
          desc: 'Pengarah visi dakwah jangka panjang, maklumat akidah, peninjau laporan makro nasional sebaran da\'i dan kesehatan kas yayasan.',
          approval: 'Pemantauan makro, evaluasi syar\'i dakwah, dan tinjauan kebijakan strategis nasional.',
          sod: 'STRICT TERKUNCI: Mode Executive Read-Only. Seluruh tombol penambahan dokumen, persetujuan kas, atau mutasi data dinonaktifkan (Zero Data Mutation).',
          badgeColor: 'bg-purple-100 text-purple-950 border border-purple-300'
        },
        {
          id: 'pengawas',
          label: 'Dewan Pengawas Yayasan',
          category: 'Dewan Pengawas Independen',
          workspaces: '6 Ruang Kerja Mandat (Dashboard, Persuratan, Kas, Proker, Maktabah, Sistem [Audit WORM]) - Mode Forensic Audit Read-Only',
          desc: 'Pengawas kepatuhan tata kelola hukum, kepatuhan syariah kas, pemeriksa berkas nota struk belanja, penilai laporan bulanan PSAK 409, dan auditor independen yayasan.',
          approval: 'Pengawasan kepatuhan hukum, rekonsiliasi kas, dan penerbitan temuan audit internal.',
          sod: 'STRICT TERKUNCI: Mode Forensic Audit Read-Only. Berhak memeriksa seluruh jejak WORM Audit Trail, namun tidak berhak mengeksekusi mutasi kas atau menerbitkan surat dinas.',
          badgeColor: 'bg-orange-100 text-orange-950 border border-orange-300'
        },
        {
          id: 'ketua_divisi',
          label: 'Ketua Divisi (7 Divisi Resmi ART Ps 16)',
          category: 'Pelaksana Program Divisi',
          workspaces: '4-5 Ruang Kerja Mandat (Dashboard, Proker, Disposisi, Maktabah; + Advokasi LBH untuk Divisi Hukum, + Muallaf Care & Aset QR untuk Divisi Dakwah & Umum)',
          desc: 'Pemimpin operasional program kerja sektoral (Humas, Litbang, Sosmed, Dakwah, Bisnis, Hukum, Umum). Mengoordinasikan anggota divisi dalam eksekusi program di lapangan.',
          approval: '1. Pengusul Proposal Program Kerja & RAB Divisi<br>2. Permohonan Pencairan Dana Kas Bertahap<br>3. Pelapor LPJ & Realisasi Anggaran Divisi<br>4. Pelaksana Instruksi Disposisi Masuk',
          sod: 'Terkunci hanya pada modul fungsional divisinya. Hanya ruang kerja mandat divisinya yang tampil di sidebar agar UI bersih dan fokus.',
          badgeColor: 'bg-teal-100 text-teal-950 border border-teal-300'
        },
        {
          id: 'anggota_divisi',
          label: 'Anggota Divisi / Da\'i Lapangan',
          category: 'Kader & Pelaksana Lapangan',
          workspaces: '3-4 Ruang Kerja Mandat (Dashboard, Keanggotaan, Maktabah; + Muallaf Care untuk Divisi Dakwah)',
          desc: 'Pelaksana teknis lapangan dan da\'i bersertifikasi (Lisensi Da\'i Tingkat 1, 2, atau 3). Bertugas dalam safari dakwah, dauroh muallaf, kajian masjid, dan pendampingan akidah.',
          approval: '1. Draf Laporan Kegiatan Lapangan<br>2. Pemindaian Presensi QR KTA pada Acara Kajian/Safari Dakwah<br>3. Akses Bank Dalil Mimbar Apologetika',
          sod: 'Dilarang menerbitkan dokumen eksekutif, dilarang mengakses kas yayasan, dan dilarang mengubah status disposisi pimpinan.',
          badgeColor: 'bg-indigo-100 text-indigo-950 border border-indigo-300'
        }
      ];

      html += `
        <div class="p-4 rounded-xl bg-surface-container border border-surface-container-high mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[22px]">verified</span>
              <h3 class="font-display font-bold text-sm text-primary">Matriks Hak Akses & Wewenang 8 Peran RBAC Baku (PRD Bab 2.2)</h3>
            </div>
            <p class="text-xs text-on-surface-variant mt-0.5">Sesuai ART Yayasan APII Pasal 16 & Keputusan Pleno BPH: Struktur wewenang mutlak, pemisahan tugas (SoD), dan isolasi hak akses.</p>
          </div>
          <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
            8-ROLE RBAC COMPLIANT
          </span>
        </div>

        <div class="flex flex-col gap-3">
          ${rolesData.map((r, idx) => `
            <div class="p-4 rounded-xl bg-surface-container-lowest border border-surface-container shadow-sm flex flex-col gap-2.5">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-container pb-2">
                <div class="flex items-center gap-2.5">
                  <span class="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                    ${idx + 1}
                  </span>
                  <div>
                    <h4 class="font-display font-bold text-sm text-primary leading-tight">${r.label}</h4>
                    <span class="text-[10px] font-mono text-gray-500">Role ID: <code>${r.id}</code> • Kategori: <strong>${r.category}</strong></span>
                  </div>
                </div>
                <span class="px-2.5 py-0.5 rounded text-[10px] font-bold font-mono ${r.badgeColor}">${r.id.toUpperCase()}</span>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <span class="font-bold text-gray-700 block mb-1">Ruang Kerja Diizinkan:</span>
                  <div class="p-2.5 rounded-lg bg-surface-container-low border border-surface-container text-gray-700 leading-relaxed font-mono text-[11px]">
                    ${r.workspaces}
                  </div>
                </div>
                <div>
                  <span class="font-bold text-emerald-800 block mb-1">Otoritas Persetujuan (Approval):</span>
                  <div class="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200 text-emerald-950 leading-relaxed text-[11px]">
                    ${r.approval}
                  </div>
                </div>
                <div>
                  <span class="font-bold text-rose-800 block mb-1">Batasan Ketat (Segregation of Duties):</span>
                  <div class="p-2.5 rounded-lg bg-rose-50/60 border border-rose-200 text-rose-950 leading-relaxed text-[11px]">
                    ${r.sod}
                  </div>
                </div>
              </div>

              <div class="text-[11px] text-gray-600 bg-surface-container-low p-2 rounded-lg">
                <strong>Deskripsi Tugas:</strong> ${r.desc}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (currentIamView === 'sod') {
      // Segregation of Duties Matrix
      const sodRules = [
        {
          proses: 'Pencatatan Kas Masuk (BKM) & Donasi',
          berwenang: 'Bendahara Umum / Bendahara DPW',
          terkunci: 'Sekretaris, Ketua Divisi, Pembina, Pengawas',
          dasar: 'PRD Bab 2.2: Otoritas mutlak kas masuk berada di tangan perbendaharaan syar\'i guna mencegah penerbitan kwitansi fiktif.',
          status: 'TERKUNCI KETAT'
        },
        {
          proses: 'Pengajuan & Verifikasi Kas Keluar (BKK)',
          berwenang: 'Pemohon Divisi &rarr; Verifikasi Nota Bendahara (Tahap 1) &rarr; Ketum Approval (Tahap 2)',
          terkunci: 'Sekretaris dilarang mencatat atau mencairkan kas; Bendahara dilarang mencairkan tanpa persetujuan Ketua; Ketua dilarang mencairkan tanpa verifikasi nota Bendahara.',
          dasar: 'PRD Bab 4.3: Protokol Dual-Approval Kas Keluar menjamin setiap pengeluaran telah lolos uji kelayakan nota dan otorisasi eksekutif.',
          status: 'DUAL-APPROVAL AKTIF'
        },
        {
          proses: 'Konseptor & Penerbitan Surat Dinas Keluar',
          berwenang: 'Sekretaris Umum / Sekretaris DPW &rarr; Pengesahan Ketua',
          terkunci: 'Bendahara Umum / DPW, Ketua Divisi, Pembina, Pengawas',
          dasar: 'PRD Bab 4.1: Penjaga gerbang naskah dinas resmi berada di kesekretariatan. Ruang Kerja Persuratan dikunci total dari menu Bendahara.',
          status: 'TERKUNCI KETAT'
        },
        {
          proses: 'Agenda Surat Masuk & Lembar Disposisi',
          berwenang: 'Sekretaris (Registrasi & Draf) &rarr; Ketua (5 Instruksi Baku & Paraf Digital)',
          terkunci: 'Bendahara Umum / DPW',
          dasar: 'PRD Bab 4.2: Alur persuratan masuk tertutup dari perbendaharaan guna menjaga netralitas dan kerahasiaan disposisi pimpinan.',
          status: 'TERKUNCI KETAT'
        },
        {
          proses: 'Verifikasi & Pengesahan KTA Anggota',
          berwenang: 'Sekretaris (Verifikasi Tahap 1 Berkas KTP) &rarr; Ketua (Pengesahan Akhir Tahap 2)',
          terkunci: 'Bendahara Umum / DPW, Seluruh Divisi Kerja',
          dasar: 'PRD Bab 4.5: Penertiban nomor anggota (NIA) dan lisensi da\'i merupakan hak bersama Sekretaris dan Ketua. Kasir/Bendahara dilarang mengintervensi keanggotaan.',
          status: 'TERKUNCI KETAT'
        },
        {
          proses: 'Pemantauan Makro & Audit Independen',
          berwenang: 'Dewan Pembina (Executive) & Dewan Pengawas (Forensic)',
          terkunci: 'Seluruh Pejabat Eksekutif & Lapangan',
          dasar: 'PRD Bab 2.3: Pembina dan Pengawas diisolasi dalam Mode Read-Only permanen tanpa hak merubah transaksi.',
          status: 'READ-ONLY TERKUNCI'
        },
        {
          proses: 'Otoritas Pengesahan Darurat (Deadlock Breaker)',
          berwenang: 'Superadmin Nasional (Hak Prerogatif)',
          terkunci: 'Seluruh Pejabat Lain',
          dasar: 'PRD Bab 2.3.1: Hanya Superadmin yang berwenang mengambil alih dokumen mandek dengan pencatatan WORM SUPERADMIN_OVERRIDE.',
          status: 'HAK PREROGATIF'
        }
      ];

      html += `
        <div class="p-4 rounded-xl bg-surface-container border border-surface-container-high mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[22px]">gavel</span>
              <h3 class="font-display font-bold text-sm text-primary">Matriks Pemisahan Tugas & Batasan Wewenang (Segregation of Duties / SoD)</h3>
            </div>
            <p class="text-xs text-on-surface-variant mt-0.5">Penegakan batas yuridis organisasi: Mencegah sekretaris mencatat kas, mencegah bendahara mengonsep surat masuk, dan mencegah manipulasi sepihak.</p>
          </div>
          <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
            SOD ENFORCED
          </span>
        </div>

        <div class="overflow-x-auto rounded-xl border border-surface-container bg-surface-container-lowest shadow-sm">
          <table class="w-full text-left text-xs">
            <thead class="bg-surface-container font-bold text-on-surface-variant border-b border-surface-container-high">
              <tr>
                <th class="px-4 py-3">Proses Bisnis Kritis</th>
                <th class="px-4 py-3">Pejabat Berwenang (Authorized)</th>
                <th class="px-4 py-3">Pejabat Dilarang / Terkunci (Forbidden)</th>
                <th class="px-4 py-3">Dasar Hukum & Mekanisme Pertahanan</th>
                <th class="px-4 py-3 text-center">Status SoD</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-container">
              ${sodRules.map(s => `
                <tr class="hover:bg-surface-container-low transition-colors">
                  <td class="px-4 py-3 font-bold text-primary">${s.proses}</td>
                  <td class="px-4 py-3 text-emerald-900 font-semibold">${s.berwenang}</td>
                  <td class="px-4 py-3 text-rose-800 font-semibold">${s.terkunci}</td>
                  <td class="px-4 py-3 text-gray-600 text-[11px] leading-relaxed">${s.dasar}</td>
                  <td class="px-4 py-3 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                      ${s.status}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- 7 Divisi Kerja Resmi ART Pasal 16 -->
        <div class="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm mt-3 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h4 class="font-display font-bold text-xs text-primary uppercase">7 Divisi Operasional Resmi Sesuai ART Yayasan APII Pasal 16</h4>
            <span class="text-[11px] text-on-surface-variant">Yurisdiksi Program Sektoral</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            ${CONFIG.DIVISIONS.map(d => `
              <div class="p-3 rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-1.5">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[20px]" style="color: ${d.color}">${d.icon}</span>
                  <span class="font-bold text-primary text-xs leading-tight">${d.name}</span>
                </div>
                <span class="text-[10px] text-gray-500 font-mono">Kode: <code>${d.code}</code></span>
                <p class="text-[11px] text-gray-600 leading-snug mt-1">${d.tupoksi}</p>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    cIam.innerHTML = html;
  }

  // --- SUBTAB 2: SESI MULTI-DEVICE (SECURITY MONITORING) ---
  function renderSessionsSubTab() {
    const cSessions = document.getElementById('subtab-sessions-content');
    if (!cSessions) return;

    const sessions = State.getSessions();
    const currentAcc = Auth.getCurrentUser();

    let html = `
      <div class="p-4 rounded-xl bg-surface-container border border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div>
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[22px]">devices</span>
            <h3 class="font-display font-bold text-sm text-primary">Monitoring Sesi Multi-Device Aktif (${sessions.length} Sesi Terhubung)</h3>
          </div>
          <p class="text-xs text-on-surface-variant mt-0.5">Pantau seluruh perangkat pengurus yang sedang login. Cabut sesi seketika jika terjadi anomali atau pemindahan gawai dinas.</p>
        </div>
        <button type="button" onclick="App.revokeAllOtherSessions()" class="px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow flex items-center gap-1.5 shrink-0 transition-all">
          <span class="material-symbols-outlined text-[16px]">phonelink_erase</span>
          <span>Cabut Semua Sesi Lain</span>
        </button>
      </div>

      <div class="overflow-x-auto rounded-xl border border-surface-container bg-surface-container-lowest shadow-sm">
        <table class="w-full text-left text-xs">
          <thead class="bg-surface-container font-bold text-on-surface-variant border-b border-surface-container-high">
            <tr>
              <th class="px-4 py-3">Pengguna & Peran</th>
              <th class="px-4 py-3">Perangkat & Browser</th>
              <th class="px-4 py-3">Alamat IP & Lokasi</th>
              <th class="px-4 py-3">Waktu Login</th>
              <th class="px-4 py-3">Kedaluwarsa Sesi</th>
              <th class="px-4 py-3 text-center">Status</th>
              <th class="px-4 py-3 text-right">Tindakan</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-surface-container">
            ${sessions.map(s => {
              const isMe = currentAcc && (s.username === currentAcc.username);
              return `
                <tr class="hover:bg-surface-container-low transition-colors ${isMe ? 'bg-primary-container/10' : ''}">
                  <td class="px-4 py-3">
                    <span class="font-bold text-primary block">${s.username} ${isMe ? '<span class="text-[10px] text-emerald-800 font-bold px-1.5 py-0.2 bg-emerald-100 rounded ml-1">(Sesi Ini)</span>' : ''}</span>
                    <span class="text-[10px] text-on-surface-variant font-mono">Token: ${s.token.substring(0, 16)}...</span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-1.5">
                      <span class="material-symbols-outlined text-[16px] text-gray-600">${s.device.toLowerCase().includes('mobile') || s.device.toLowerCase().includes('safari') ? 'smartphone' : 'laptop'}</span>
                      <span class="font-medium text-gray-800">${s.device}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3 font-mono text-gray-600 tabular-nums">${s.ipAddress || s.ip || '-'}</td>
                  <td class="px-4 py-3 text-gray-600 tabular-nums">${formatTanggalDisplay(s.loginAt || s.loginTime)}</td>
                  <td class="px-4 py-3 text-gray-600 tabular-nums">${formatTanggalDisplay(s.expiresAt || s.expiryTime)}</td>
                  <td class="px-4 py-3 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      ${s.status || 'AKTIF'}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button type="button" onclick="App.revokeSession('${s.token}')" class="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold transition-all">
                      Cabut Sesi
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    cSessions.innerHTML = html;
  }

  // --- SUBTAB 3: DEADLOCK BREAKER (HAK PREROGATIF SUPERADMIN) ---
  function renderDeadlockBreakerSubTab() {
    const cDeadlock = document.getElementById('subtab-deadlock-content');
    if (!cDeadlock) return;

    const queue = State.getDeadlockQueue();

    let html = `
      <div class="p-4 rounded-xl bg-amber-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2 shadow-sm">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full bg-amber-800 text-amber-300 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-[24px]">gavel</span>
          </div>
          <div>
            <h3 class="font-display font-bold text-sm leading-tight">Deadlock Breaker - Otoritas Pengesahan Darurat Nasional</h3>
            <p class="text-xs text-amber-200 mt-0.5">Sesuai PRD Bab 2.3.1 & Panduan Eksekutif Bab 4.D.8: Hak prerogatif Superadmin memutus kebuntuan operasional apabila pejabat terkait berhalangan tetap, mangkir, atau terdapat kebutuhan kedaruratan hukum organisasi.</p>
          </div>
        </div>
        <div class="px-3 py-1.5 rounded-xl bg-amber-800/80 border border-amber-700 text-xs font-mono font-bold shrink-0 text-center">
          ${queue.length} Dokumen Menanti
        </div>
      </div>
    `;

    if (queue.length === 0) {
      html += `
        <div class="p-8 rounded-2xl border border-surface-container bg-surface-container-lowest text-center flex flex-col items-center justify-center gap-2">
          <span class="material-symbols-outlined text-emerald-600 text-[48px]">check_circle</span>
          <h4 class="font-display font-bold text-base text-primary">Tata Kelola Nasional Berjalan Lancar</h4>
          <p class="text-xs text-on-surface-variant max-w-md">Tidak ada dokumen birokrasi, naskah dinas, pencairan kas, atau KTA yang mengalami kebuntuan atau terlambat ditandatangani.</p>
        </div>
      `;
    } else {
      html += `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${queue.map(item => {
            let badgeColor = 'bg-primary-container text-white';
            if (item.type === 'kas') badgeColor = 'bg-emerald-800 text-white';
            else if (item.type === 'kta') badgeColor = 'bg-blue-800 text-white';
            else if (item.type === 'disposisi') badgeColor = 'bg-indigo-800 text-white';

            return `
              <div class="p-4 rounded-xl bg-surface-container-lowest border border-amber-200 hover:border-amber-400 shadow-sm flex flex-col justify-between gap-3 transition-all">
                <div class="flex flex-col gap-2">
                  <div class="flex items-center justify-between gap-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${badgeColor}">${item.typeLabel.toUpperCase()}</span>
                    <span class="text-[10px] text-gray-500 font-mono">${formatTanggalDisplay(item.tanggal)}</span>
                  </div>
                  <div>
                    <span class="text-[11px] font-mono font-bold text-gray-700 block">${item.nomor}</span>
                    <h4 class="font-bold text-sm text-primary mt-0.5 leading-snug">${item.perihal}</h4>
                  </div>
                  <div class="text-xs text-on-surface-variant">
                    <span>Pemohon/Pihak: <strong>${item.pemohon}</strong></span>
                    <span class="mx-1">•</span>
                    <span>Wilayah: <strong>${item.wilayah}</strong></span>
                  </div>
                  <div class="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                    <span class="material-symbols-outlined text-[16px] text-amber-700 shrink-0">hourglass_top</span>
                    <span>Hambatan: <strong>${item.stuckReason}</strong></span>
                  </div>
                </div>

                <div class="pt-2 border-t border-surface-container flex items-center justify-end">
                  <button type="button" onclick="App.openDeadlockBreakerModal('${item.type}', '${item.id}')" class="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-900 hover:bg-amber-950 text-white font-bold text-xs shadow flex items-center justify-center gap-1.5 transition-all">
                    <span class="material-symbols-outlined text-[16px]">gavel</span>
                    <span>Ambil Alih & Sahkan (Deadlock Breaker)</span>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    cDeadlock.innerHTML = html;
  }

  // --- SUBTAB 4: MASTER PENGATURAN YAYASAN & KOP SURAT A4 ---
  function switchSettingsScope(scope) {
    currentSettingsScope = scope;
    renderSettingsSubTab();
  }

  function handleImageFileUpload(fileInput, targetUrlInputId, callback) {
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target.result;
      const img = new Image();
      img.onload = () => {
        const maxDim = 500;
        let w = img.width;
        let h = img.height;
        let finalDataUrl = rawDataUrl;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          finalDataUrl = canvas.toDataURL('image/png', 0.9);
        }
        const targetInput = document.getElementById(targetUrlInputId);
        if (targetInput) targetInput.value = finalDataUrl;
        if (typeof callback === 'function') callback(finalDataUrl);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  }

  function updateUploadThumbnail(target, url) {
    const container = document.getElementById(`preview-${target}-container`);
    if (!container) return;
    const fileInputId = target === 'stempel' ? 'upload-stempel-file' : (target === 'ketua' ? 'upload-ketua-ttd' : 'upload-sek-ttd');
    const targetUrlInputId = target === 'stempel' ? 'settings-stempel-url' : (target === 'ketua' ? 'settings-ketua-ttd-url' : 'settings-sek-ttd-url');
    const label = target === 'stempel' ? 'File stempel ormas aktif dipasang pada naskah' : `File TTD ${target === 'ketua' ? 'Ketua' : 'Sekretaris'} terpasang aktif`;
    const imgClass = target === 'stempel' ? 'w-12 h-12' : 'h-10 max-w-[140px]';

    if (url) {
      container.innerHTML = `
        <div class="flex items-center gap-3">
          <label class="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container cursor-pointer flex items-center gap-1.5 transition-all shadow-sm">
            <span class="material-symbols-outlined text-[16px]">upload_file</span>
            <span>Ganti File ${target.toUpperCase()}</span>
            <input type="file" id="${fileInputId}" accept="image/*" class="hidden">
          </label>
          <button type="button" onclick="App.clearUploadedImage('${target}')" class="px-2.5 py-1.5 rounded-xl border border-rose-300 text-rose-700 text-xs font-semibold hover:bg-rose-50 flex items-center gap-1">
            <span class="material-symbols-outlined text-[15px]">delete</span>
            <span>Hapus File</span>
          </button>
        </div>
        <div class="p-2 rounded-lg bg-surface-container-lowest border border-surface-container flex items-center gap-2">
          <img src="${url}" alt="Preview" class="${imgClass} object-contain border border-dashed border-gray-300 p-1 rounded bg-white">
          <span class="text-[11px] text-gray-600 font-mono">${label}</span>
        </div>
      `;
    } else {
      const hint = target === 'stempel' ? 'Disarankan menggunakan file stempel berformat PNG transparan.' : 'Format disarankan: PNG transparan.';
      container.innerHTML = `
        <div class="flex items-center gap-3">
          <label class="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container cursor-pointer flex items-center gap-1.5 transition-all shadow-sm">
            <span class="material-symbols-outlined text-[16px]">upload_file</span>
            <span>Pilih File ${target === 'stempel' ? 'Stempel Resmi (PNG)' : (target === 'ketua' ? 'TTD Ketua' : 'TTD Sekretaris')}</span>
            <input type="file" id="${fileInputId}" accept="image/*" class="hidden">
          </label>
        </div>
        <span class="text-[10px] text-gray-500 italic">${hint}</span>
      `;
    }

    const newFileInput = container.querySelector('input[type="file"]');
    if (newFileInput) {
      newFileInput.addEventListener('change', (e) => {
        handleImageFileUpload(e.target, targetUrlInputId, (newUrl) => {
          updateUploadThumbnail(target, newUrl);
          syncSettingsPreview();
        });
      });
    }
  }

  function clearUploadedImage(target) {
    if (target === 'ketua') {
      const inputUrl = document.getElementById('settings-ketua-ttd-url');
      if (inputUrl) inputUrl.value = '';
      updateUploadThumbnail('ketua', '');
    } else if (target === 'sekretaris') {
      const inputUrl = document.getElementById('settings-sek-ttd-url');
      if (inputUrl) inputUrl.value = '';
      updateUploadThumbnail('sekretaris', '');
    } else if (target === 'stempel') {
      const inputUrl = document.getElementById('settings-stempel-url');
      if (inputUrl) inputUrl.value = '';
      updateUploadThumbnail('stempel', '');
    }
    syncSettingsPreview();
  }

  function toggleTtdUploadView(role) {
    if (role === 'ketua') {
      const mode = document.getElementById('settings-ketua-ttd-mode')?.value;
      const isUpload = mode === 'upload';
      document.getElementById('wrap-ketua-spesimen')?.classList.toggle('hidden', isUpload);
      document.getElementById('wrap-ketua-upload-size')?.classList.toggle('hidden', !isUpload);
      document.getElementById('wrap-ketua-upload-box')?.classList.toggle('hidden', !isUpload);
    } else if (role === 'sekretaris') {
      const mode = document.getElementById('settings-sek-ttd-mode')?.value;
      const isUpload = mode === 'upload';
      document.getElementById('wrap-sek-upload-size')?.classList.toggle('hidden', !isUpload);
      document.getElementById('wrap-sek-upload-box')?.classList.toggle('hidden', !isUpload);
    }
    syncSettingsPreview();
  }

  function toggleStempelUploadView() {
    const mode = document.getElementById('settings-stempel-mode')?.value;
    const isUpload = mode === 'upload';
    document.getElementById('wrap-stempel-upload-box')?.classList.toggle('hidden', !isUpload);
    document.getElementById('wrap-stempel-vektor-box')?.classList.toggle('hidden', isUpload);
    syncSettingsPreview();
  }

  function syncSettingsPreview() {
    const previewContainer = document.getElementById('settings-live-a4-preview');
    if (!previewContainer) return;

    const activeScope = currentSettingsScope || 'DPP_PUSAT';

    const override = {
      // Pimpinan & TTD
      ketuaNama: document.getElementById('settings-ketum')?.value.trim(),
      ketuaUmum: document.getElementById('settings-ketum')?.value.trim(),
      ketuaJabatan: document.getElementById('settings-ketua-jabatan')?.value.trim(),
      ketuaNia: document.getElementById('settings-ketua-nia')?.value.trim(),
      ketuaTtdMode: document.getElementById('settings-ketua-ttd-mode')?.value || 'spesimen',
      ketuaTtdUrl: document.getElementById('settings-ketua-ttd-url')?.value.trim() || '',
      ketuaTtdSize: Number(document.getElementById('settings-ketua-ttd-size')?.value) || 64,

      sekretarisNama: document.getElementById('settings-sekjen')?.value.trim(),
      sekretarisJenderal: document.getElementById('settings-sekjen')?.value.trim(),
      sekretarisJabatan: document.getElementById('settings-sek-jabatan')?.value.trim(),
      sekretarisNia: document.getElementById('settings-sek-nia')?.value.trim(),
      sekretarisTtdMode: document.getElementById('settings-sek-ttd-mode')?.value || 'spesimen',
      sekretarisTtdUrl: document.getElementById('settings-sek-ttd-url')?.value.trim() || '',
      sekretarisTtdSize: Number(document.getElementById('settings-sek-ttd-size')?.value) || 64,

      bendaharaUmum: document.getElementById('settings-bendum')?.value.trim(),
      // Logo Layout
      logoLayout: document.getElementById('settings-logo-layout')?.value,
      logoSize: Number(document.getElementById('settings-logo-size')?.value) || 76,
      logoUrl: document.getElementById('settings-logo-url')?.value.trim(),
      logoSecondaryUrl: document.getElementById('settings-logo-secondary-url')?.value.trim(),
      // KOP Text & Divider
      kopBaris1: document.getElementById('settings-kop1')?.value.trim(),
      kopBaris2: document.getElementById('settings-kop2')?.value.trim(),
      kopBaris3: document.getElementById('settings-kop3')?.value.trim(),
      kopAlamat: document.getElementById('settings-alamat')?.value.trim(),
      kopTelepon: document.getElementById('settings-telepon')?.value.trim(),
      kopEmail: document.getElementById('settings-email')?.value.trim(),
      kopWebsite: document.getElementById('settings-website')?.value.trim(),
      kopDivider: document.getElementById('settings-kop-divider')?.value,
      // Tipografi & Dokumen
      fontFamily: document.getElementById('settings-font-family')?.value,
      fontSize: document.getElementById('settings-font-size')?.value,
      lineSpacing: document.getElementById('settings-line-spacing')?.value,
      kotaSurat: document.getElementById('settings-kota-surat')?.value.trim(),
      showBismillah: document.getElementById('settings-show-bismillah')?.checked !== false,
      showHijriDate: document.getElementById('settings-show-hijri')?.checked !== false,
      // TTD & Stempel
      modelTtd: document.getElementById('settings-model-ttd')?.value,
      spesimenTtdType: document.getElementById('settings-spesimen-ttd')?.value,
      stempelAktif: document.getElementById('settings-stempel-aktif')?.checked !== false,
      stempelMode: document.getElementById('settings-stempel-mode')?.value || 'vektor',
      stempelUrl: document.getElementById('settings-stempel-url')?.value.trim() || '',
      stempelSize: Number(document.getElementById('settings-stempel-size')?.value) || 112,
      stempelOpacity: Number(document.getElementById('settings-stempel-opacity')?.value) || 85,
      stempelTeksLuar: document.getElementById('settings-stempel-teks-luar')?.value.trim(),
      stempelTeksDalam: document.getElementById('settings-stempel-teks-dalam')?.value.trim(),
      stempelWarna: document.getElementById('settings-stempel-warna')?.value,
      stempelPosisi: document.getElementById('settings-stempel-posisi')?.value,
      stempelOffsetX: Number(document.getElementById('settings-stempel-offset-x')?.value) || -24,
      stempelOffsetY: Number(document.getElementById('settings-stempel-offset-y')?.value) || 8,
      stempelRotasi: Number(document.getElementById('settings-stempel-rotasi')?.value) || -12
    };

    const dummyData = {
      nomorSurat: activeScope === 'DPP_PUSAT' ? '018/SM-DPP-APII/XI/2026' : `008/SM-${activeScope}/XI/2026`,
      lampiran: '1 Berkas Ketetapan',
      perihal: 'Instruksi Standardisasi Format Naskah Dinas & KOP Terpadu',
      tujuan: 'Seluruh Pimpinan Wilayah (DPW) & Divisi Kerja APII',
      isiSurat: 'Dewan Pengurus menetapkan standardisasi tata letak logo, KOP dinas, tipografi naskah, dan stempel digital basah sebagai pedoman resmi persuratan dalam mewujudkan tertib administrasi dakwah berkeadaban se-Indonesia.'
    };

    previewContainer.innerHTML = buildA4DocumentHtml(dummyData, activeScope, override);
  }

  function resetSettingsToDefault(scope) {
    const targetScope = scope || currentSettingsScope || 'DPP_PUSAT';
    openConfirmDialog(
      'Reset Layout & KOP Surat',
      `Apakah Anda yakin ingin mengatur ulang layout dan KOP untuk ${targetScope} ke konfigurasi standar default?`,
      () => {
        const defaultBase = (targetScope === 'DPP_PUSAT') ? {
          scope: 'DPP_PUSAT',
          scopeLabel: 'DPP Pusat (Nasional)',
          level: 'DPP',
          logoUrl: './logo_apii.png',
          logoSecondaryUrl: './logo_apii.png',
          logoLayout: 'left',
          logoSize: 76,
          kopBaris1: 'YAYASAN APOLOGET ISLAM INDONESIA (APII)',
          kopBaris2: 'DEWAN PENGURUS PUSAT',
          kopBaris3: 'SK KEMENKUMHAM RI NO. AHU-0014970.AH.01.04.TAHUN 2023',
          kopAlamat: 'Gedung Pusat Dakwah APII, Jl. Kramat Raya No. 45, Senen, Jakarta Pusat 10450',
          kopTelepon: '+62 813-5857-5678',
          kopEmail: 'sekretariat@apologetislamindonesia.or.id',
          kopWebsite: 'https://apologetislamindonesia.or.id',
          kopDivider: 'double_black',
          fontFamily: 'times',
          fontSize: '12pt',
          lineSpacing: '1.25',
          showBismillah: true,
          showHijriDate: true,
          kotaSurat: 'Jakarta',
          modelTtd: 'dual',
          ketuaUmum: 'Ust. H. Ahmad Fauzi, Lc., M.A.',
          ketuaNama: 'Ust. H. Ahmad Fauzi, Lc., M.A.',
          ketuaJabatan: 'Ketua Umum DPP',
          ketuaNia: 'APII-PUSAT-2026-00001',
          ketuaTtdMode: 'spesimen',
          ketuaTtdUrl: '',
          ketuaTtdSize: 64,
          sekretarisJenderal: 'Ust. M. Ridwan, S.Pd.I.',
          sekretarisNama: 'Ust. M. Ridwan, S.Pd.I.',
          sekretarisJabatan: 'Sekretaris Umum DPP',
          sekretarisNia: 'APII-PUSAT-2026-00002',
          sekretarisTtdMode: 'spesimen',
          sekretarisTtdUrl: '',
          sekretarisTtdSize: 64,
          bendaharaUmum: 'H. Syamsuddin, S.E.',
          spesimenTtdType: 'digital_paraf',
          stempelAktif: true,
          stempelMode: 'vektor',
          stempelUrl: '',
          stempelSize: 112,
          stempelOpacity: 85,
          stempelTeksLuar: 'YAYASAN APOLOGET ISLAM INDONESIA',
          stempelTeksDalam: 'DEWAN PENGURUS PUSAT',
          stempelWarna: '#065f46',
          stempelPosisi: 'overlap_left',
          stempelOffsetX: -24,
          stempelOffsetY: 8,
          stempelRotasi: -12,
          plafonKasTunai: 2000000
        } : {
          scope: targetScope,
          scopeLabel: targetScope,
          level: 'DPW',
          logoUrl: './logo_apii.png',
          logoSecondaryUrl: './logo_apii.png',
          logoLayout: 'left',
          logoSize: 76,
          kopBaris1: 'YAYASAN APOLOGET ISLAM INDONESIA (APII)',
          kopBaris2: `DEWAN PENGURUS WILAYAH (${targetScope})`,
          kopBaris3: `WILAYAH KERJA PERWAKILAN REGIONAL ${targetScope}`,
          kopAlamat: 'Graha Dakwah DPW Regional APII',
          kopTelepon: '+62 812-3456-7891',
          kopEmail: `dpw.${targetScope.toLowerCase()}@apologetislamindonesia.or.id`,
          kopWebsite: 'https://apologetislamindonesia.or.id',
          kopDivider: 'double_black',
          fontFamily: 'times',
          fontSize: '12pt',
          lineSpacing: '1.25',
          showBismillah: true,
          showHijriDate: true,
          kotaSurat: 'Kedudukan Wilayah',
          modelTtd: 'dual',
          ketuaUmum: 'Ketua DPW APII',
          ketuaNama: 'Ketua DPW APII',
          ketuaJabatan: `Ketua ${targetScope}`,
          ketuaNia: `APII-${targetScope}-2026-00001`,
          ketuaTtdMode: 'spesimen',
          ketuaTtdUrl: '',
          ketuaTtdSize: 64,
          sekretarisJenderal: 'Sekretaris DPW APII',
          sekretarisNama: 'Sekretaris DPW APII',
          sekretarisJabatan: `Sekretaris ${targetScope}`,
          sekretarisNia: `APII-${targetScope}-2026-00002`,
          sekretarisTtdMode: 'spesimen',
          sekretarisTtdUrl: '',
          sekretarisTtdSize: 64,
          bendaharaUmum: 'Bendahara DPW APII',
          spesimenTtdType: 'digital_paraf',
          stempelAktif: true,
          stempelMode: 'vektor',
          stempelUrl: '',
          stempelSize: 112,
          stempelOpacity: 85,
          stempelTeksLuar: 'YAYASAN APOLOGET ISLAM INDONESIA',
          stempelTeksDalam: targetScope,
          stempelWarna: '#1e3a8a',
          stempelPosisi: 'overlap_left',
          stempelOffsetX: -24,
          stempelOffsetY: 8,
          stempelRotasi: -10,
          plafonKasTunai: 1500000
        };

        const curUser = Auth.getCurrentUser();
        State.updateSettings(defaultBase, curUser?.fullName || 'Superadmin Nasional', targetScope);
        showToast(`Pengaturan layout & KOP untuk ${targetScope} berhasil diatur ulang ke standar default!`);
        renderSettingsSubTab();
      }
    );
  }

  function renderSettingsSubTab() {
    const cSettings = document.getElementById('subtab-settings-content');
    if (!cSettings) return;

    const db = State.getDb();
    const activeScope = currentSettingsScope || db.settings?.activeSettingsScope || 'DPP_PUSAT';
    const s = State.getTenantSettings(activeScope);
    const audits = State.getSettingsAudit();

    // Dapatkan daftar seluruh federasi wilayah (DPP & seluruh DPW)
    const wilayahList = db.wilayah || [];
    const scopes = [
      { code: 'DPP_PUSAT', label: 'DPP Pusat (Nasional)', level: 'DPP' }
    ];
    wilayahList.forEach(w => {
      if (w.code !== 'DPP_PUSAT' && !scopes.some(sc => sc.code === w.code)) {
        scopes.push({ code: w.code, label: w.name, level: 'DPW' });
      }
    });

    let html = `
      <div class="flex flex-col gap-5">
        <!-- Scope Switcher Header -->
        <div class="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[20px]">tune</span>
              <h3 class="font-display font-bold text-sm text-primary">Master Tata Letak Logo, KOP, Tipografi & Stempel Resmi</h3>
            </div>
            <p class="text-xs text-on-surface-variant mt-0.5">Pilih tingkat pimpinan untuk menyesuaikan layout naskah, KOP surat resmi A4, stempel digital, dan tanda tangan independen.</p>
          </div>
          
          <div class="flex items-center gap-2">
            <button type="button" onclick="App.resetSettingsToDefault('${activeScope}')" class="px-3 py-1.5 rounded-xl border border-surface-container-high text-xs font-semibold hover:bg-surface-container text-gray-700 flex items-center gap-1 transition-all">
              <span class="material-symbols-outlined text-[15px]">restart_alt</span>
              <span>Reset Standar</span>
            </button>
            <button type="button" onclick="App.saveMasterSettings()" class="px-4 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary-container shadow flex items-center gap-1.5 transition-all">
              <span class="material-symbols-outlined text-[16px]">save</span>
              <span>Simpan Perubahan (${activeScope})</span>
            </button>
          </div>
        </div>

        <!-- Scope Tabs Selector -->
        <div class="flex items-center gap-2 overflow-x-auto pb-1">
          ${scopes.map(sc => {
            const isActive = sc.code === activeScope;
            return `
              <button type="button" onclick="App.switchSettingsScope('${sc.code}')" class="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${isActive ? 'bg-primary text-white shadow-sm ring-2 ring-primary/30' : 'bg-surface-container-lowest border border-surface-container hover:bg-surface-container text-on-surface'}">
                <span class="material-symbols-outlined text-[16px]">${sc.level === 'DPP' ? 'account_balance' : 'domain'}</span>
                <span>${sc.label}</span>
                <span class="text-[10px] font-mono px-1.5 py-0.2 rounded ${isActive ? 'bg-white/20 text-white' : 'bg-surface-container-high text-gray-600'}">${sc.code}</span>
              </button>
            `;
          }).join('')}
        </div>

        <!-- Main Form & Live Preview Grid -->
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <!-- Left: 5 Configuration Sections Form (7 cols) -->
          <form id="form-master-settings" onsubmit="event.preventDefault(); App.saveMasterSettings();" class="xl:col-span-7 flex flex-col gap-4">
            
            <!-- SECTION 1: IDENTITAS & PIMPINAN WILAYAH / PUSAT -->
            <div class="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm flex flex-col gap-3">
              <div class="flex items-center gap-2 border-b border-surface-container pb-2">
                <span class="material-symbols-outlined text-primary text-[18px]">badge</span>
                <h4 class="font-display font-bold text-xs text-primary uppercase">1. Pimpinan Penandatangan & Batas Kas (${activeScope})</h4>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">Nama Ketua & Gelar *</label>
                  <input type="text" id="settings-ketum" required value="${s.ketuaNama || s.ketuaUmum || ''}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">Jabatan Ketua *</label>
                  <input type="text" id="settings-ketua-jabatan" required value="${s.ketuaJabatan || (activeScope === 'DPP_PUSAT' ? 'Ketua Umum DPP' : 'Ketua DPW')}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">Nomor Induk Anggota (NIA) *</label>
                  <input type="text" id="settings-ketua-nia" required value="${s.ketuaNia || (activeScope === 'DPP_PUSAT' ? 'APII-PUSAT-2026-00001' : `APII-${activeScope}-2026-00001`)}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none">
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-surface-container">
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">Nama Sekretaris & Gelar *</label>
                  <input type="text" id="settings-sekjen" required value="${s.sekretarisNama || s.sekretarisJenderal || ''}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">Jabatan Sekretaris *</label>
                  <input type="text" id="settings-sek-jabatan" required value="${s.sekretarisJabatan || (activeScope === 'DPP_PUSAT' ? 'Sekretaris Umum DPP' : 'Sekretaris DPW')}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">NIA Sekretaris *</label>
                  <input type="text" id="settings-sek-nia" required value="${s.sekretarisNia || (activeScope === 'DPP_PUSAT' ? 'APII-PUSAT-2026-00002' : `APII-${activeScope}-2026-00002`)}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none">
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-surface-container">
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">Nama Bendahara *</label>
                  <input type="text" id="settings-bendum" required value="${s.bendaharaUmum || ''}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">Batas Plafon Kas Tunai (Cash Buffer) *</label>
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-bold text-gray-500">Rp</span>
                    <input type="number" id="settings-plafon-kas" required min="100000" step="100000" value="${s.plafonKasTunai || 2000000}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-mono font-bold focus:ring-1 focus:ring-primary focus:outline-none">
                  </div>
                </div>
              </div>
            </div>

            <!-- SECTION 2: LOGO LAYOUT & DIMENSI -->
            <div class="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm flex flex-col gap-3">
              <div class="flex items-center gap-2 border-b border-surface-container pb-2">
                <span class="material-symbols-outlined text-primary text-[18px]">photo_size_select_actual</span>
                <h4 class="font-display font-bold text-xs text-primary uppercase">2. Tata Letak Logo & Dimensi Header KOP</h4>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">Tata Letak (Layout) Logo *</label>
                  <select id="settings-logo-layout" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none">
                    <option value="left" ${s.logoLayout === 'left' ? 'selected' : ''}>Standar Kiri (Logo di sebelah kiri teks KOP)</option>
                    <option value="center" ${s.logoLayout === 'center' ? 'selected' : ''}>Tengah / Piagam Formal (Logo di atas teks KOP)</option>
                    <option value="dual" ${s.logoLayout === 'dual' ? 'selected' : ''}>Sayap Kiri & Kanan (Dual Logo mengapit KOP)</option>
                    <option value="right" ${s.logoLayout === 'right' ? 'selected' : ''}>Kanan (Logo di sebelah kanan teks KOP)</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">Ukuran Logo: <span id="lbl-logo-size" class="text-primary font-mono font-bold">${s.logoSize || 76}px</span></label>
                  <input type="range" id="settings-logo-size" min="60" max="105" step="2" value="${s.logoSize || 76}" oninput="document.getElementById('lbl-logo-size').textContent = this.value + 'px'" class="w-full mt-2 accent-primary">
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-surface-container">
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">URL Logo Utama *</label>
                  <input type="text" id="settings-logo-url" required value="${s.logoUrl || './logo_apii.png'}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">URL Logo Sekunder (Khusus Mode Dual/Sayap)</label>
                  <input type="text" id="settings-logo-secondary-url" value="${s.logoSecondaryUrl || './logo_apii.png'}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none">
                </div>
              </div>
            </div>

            <!-- SECTION 3: TEKS KOP SURAT & DIVIDER -->
            <div class="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm flex flex-col gap-3">
              <div class="flex items-center gap-2 border-b border-surface-container pb-2">
                <span class="material-symbols-outlined text-primary text-[18px]">newspaper</span>
                <h4 class="font-display font-bold text-xs text-primary uppercase">3. Teks KOP Surat & Garis Pemisah (Divider)</h4>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">KOP Baris 1 (Nama Yayasan) *</label>
                  <input type="text" id="settings-kop1" required value="${s.kopBaris1 || ''}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-bold focus:ring-1 focus:ring-primary focus:outline-none">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">KOP Baris 2 (Tingkat Pimpinan / Wilayah) *</label>
                  <input type="text" id="settings-kop2" required value="${s.kopBaris2 || ''}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-bold focus:ring-1 focus:ring-primary focus:outline-none">
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-on-surface mb-1">KOP Baris 3 (SK Kemenkumham / Wilayah Kerja) *</label>
                <input type="text" id="settings-kop3" required value="${s.kopBaris3 || s.kopAhu || ''}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none">
              </div>

              <div>
                <label class="block text-[11px] font-bold text-on-surface mb-1">Alamat Lengkap Sekretariat KOP *</label>
                <input type="text" id="settings-alamat" required value="${s.kopAlamat || ''}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs focus:ring-1 focus:ring-primary focus:outline-none">
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">Telepon / WhatsApp KOP *</label>
                  <input type="text" id="settings-telepon" required value="${s.kopTelepon || ''}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">Email Resmi KOP *</label>
                  <input type="email" id="settings-email" required value="${s.kopEmail || ''}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">Website Resmi</label>
                  <input type="text" id="settings-website" value="${s.kopWebsite || ''}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none">
                </div>
              </div>

              <div class="pt-2 border-t border-surface-container">
                <label class="block text-[11px] font-bold text-on-surface mb-1">Gaya Garis Pemisah KOP (Divider) *</label>
                <select id="settings-kop-divider" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none">
                  <option value="double_black" ${s.kopDivider === 'double_black' ? 'selected' : ''}>Garis Ganda Hitam (Standar Resmi Nasional)</option>
                  <option value="single_emerald" ${s.kopDivider === 'single_emerald' ? 'selected' : ''}>Garis Tunggal Tebal Emerald APII</option>
                  <option value="classic_gold" ${s.kopDivider === 'classic_gold' ? 'selected' : ''}>Garis Ganda Klasik Emas Dinasti</option>
                  <option value="thick_simple" ${s.kopDivider === 'thick_simple' ? 'selected' : ''}>Garis Tunggal Tebal Hitam Minimalis</option>
                </select>
              </div>
            </div>

            <!-- SECTION 4: TIPOGRAFI NASKAH & FORMAT DOKUMEN -->
            <div class="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm flex flex-col gap-3">
              <div class="flex items-center gap-2 border-b border-surface-container pb-2">
                <span class="material-symbols-outlined text-primary text-[18px]">format_shapes</span>
                <h4 class="font-display font-bold text-xs text-primary uppercase">4. Tipografi Naskah & Format Dokumen</h4>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">Jenis Huruf (Font Family) *</label>
                  <select id="settings-font-family" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none">
                    <option value="times" ${s.fontFamily === 'times' ? 'selected' : ''}>Times New Roman (Formal Dinamis)</option>
                    <option value="arial" ${s.fontFamily === 'arial' ? 'selected' : ''}>Arial Clean (Modern Sans)</option>
                    <option value="calibri" ${s.fontFamily === 'calibri' ? 'selected' : ''}>Calibri Office (Elegan)</option>
                    <option value="amiri" ${s.fontFamily === 'amiri' ? 'selected' : ''}>Naskh / Amiri Tradisional (Nuansa Pesantren)</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">Ukuran Font Naskah *</label>
                  <select id="settings-font-size" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none">
                    <option value="12pt" ${s.fontSize === '12pt' ? 'selected' : ''}>12 pt (Standar Naskah Dinas Resmi)</option>
                    <option value="11pt" ${s.fontSize === '11pt' ? 'selected' : ''}>11 pt (Kompak & Padat)</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">Kerapatan Baris (Line Spacing) *</label>
                  <select id="settings-line-spacing" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none">
                    <option value="1.25" ${s.lineSpacing === '1.25' ? 'selected' : ''}>1.25 (Standar Tata Naskah)</option>
                    <option value="1.15" ${s.lineSpacing === '1.15' ? 'selected' : ''}>1.15 (Rapat)</option>
                    <option value="1.5" ${s.lineSpacing === '1.5' ? 'selected' : ''}>1.5 (Renggang & Lega)</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-surface-container items-center">
                <div>
                  <label class="block text-[11px] font-bold text-on-surface mb-1">Kota Penandatanganan *</label>
                  <input type="text" id="settings-kota-surat" required value="${s.kotaSurat || 'Jakarta'}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none">
                </div>
                <div class="flex items-center gap-2 pt-3">
                  <input type="checkbox" id="settings-show-bismillah" ${s.showBismillah !== false ? 'checked' : ''} class="w-4 h-4 rounded text-primary focus:ring-primary">
                  <label for="settings-show-bismillah" class="text-xs font-semibold text-on-surface">Tampilkan Basmalah Arab</label>
                </div>
                <div class="flex items-center gap-2 pt-3">
                  <input type="checkbox" id="settings-show-hijri" ${s.showHijriDate !== false ? 'checked' : ''} class="w-4 h-4 rounded text-primary focus:ring-primary">
                  <label for="settings-show-hijri" class="text-xs font-semibold text-on-surface">Tampilkan Tanggal Hijriah</label>
                </div>
              </div>
            </div>

            <!-- SECTION 5: TANDA TANGAN & STEMPEL DIGITAL BASAH -->
            <div class="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm flex flex-col gap-4">
              <div class="flex items-center gap-2 border-b border-surface-container pb-2">
                <span class="material-symbols-outlined text-primary text-[18px]">approval_delegation</span>
                <h4 class="font-display font-bold text-xs text-primary uppercase">5. Format Tanda Tangan & Stempel Digital Basah (${activeScope})</h4>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-on-surface mb-1">Model Naskah Tanda Tangan *</label>
                <select id="settings-model-ttd" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none">
                  <option value="dual" ${s.modelTtd !== 'single' ? 'selected' : ''}>2 Kolom: Ketua & Sekretaris (Standar Resmi Dinasti / Musyawarah)</option>
                  <option value="single" ${s.modelTtd === 'single' ? 'selected' : ''}>1 Kolom: Ketua Saja (Mandat Tunggal / Piagam Khusus)</option>
                </select>
              </div>

              <!-- SUB-SEKSI 5.1: TANDA TANGAN KETUA (UPLOAD VS SPESIMEN) -->
              <div class="p-3 rounded-xl bg-surface-container/40 border border-surface-container-high flex flex-col gap-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-primary text-[16px]">draw</span>
                    <h5 class="font-bold text-xs text-primary">Tanda Tangan Ketua (${s.ketuaNama || 'Ketua'})</h5>
                  </div>
                  <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container text-gray-700">Ketua Umum / Wilayah</span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[11px] font-bold text-on-surface mb-1">Sumber / Tipe Tanda Tangan *</label>
                    <select id="settings-ketua-ttd-mode" onchange="App.toggleTtdUploadView('ketua')" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-surface-container-high text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none">
                      <option value="spesimen" ${s.ketuaTtdMode !== 'upload' ? 'selected' : ''}>Spesimen TTE Digital Otomatis</option>
                      <option value="upload" ${s.ketuaTtdMode === 'upload' ? 'selected' : ''}>Unggah File Gambar TTD (PNG Transparan / Scan)</option>
                    </select>
                  </div>

                  <div id="wrap-ketua-spesimen" class="${s.ketuaTtdMode === 'upload' ? 'hidden' : ''}">
                    <label class="block text-[11px] font-bold text-on-surface mb-1">Gaya Spesimen Digital *</label>
                    <select id="settings-spesimen-ttd" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-surface-container-high text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none">
                      <option value="digital_paraf" ${s.spesimenTtdType === 'digital_paraf' ? 'selected' : ''}>Paraf Digital Kaligrafi</option>
                      <option value="qr_tte" ${s.spesimenTtdType === 'qr_tte' ? 'selected' : ''}>Barcode QR TTE Terverifikasi</option>
                      <option value="kombinasi" ${s.spesimenTtdType === 'kombinasi' ? 'selected' : ''}>Kombinasi TTD & Badge Verifikasi</option>
                    </select>
                  </div>

                  <div id="wrap-ketua-upload-size" class="${s.ketuaTtdMode === 'upload' ? '' : 'hidden'}">
                    <label class="block text-[11px] font-bold text-on-surface mb-1">Tinggi Gambar TTD: <span id="lbl-ketua-ttd-size" class="text-primary font-mono font-bold">${s.ketuaTtdSize || 64}px</span></label>
                    <input type="range" id="settings-ketua-ttd-size" min="36" max="120" step="2" value="${s.ketuaTtdSize || 64}" oninput="document.getElementById('lbl-ketua-ttd-size').textContent = this.value + 'px'" class="w-full accent-primary mt-1">
                  </div>
                </div>

                <!-- Upload Box Ketua -->
                <div id="wrap-ketua-upload-box" class="pt-2 border-t border-surface-container ${s.ketuaTtdMode === 'upload' ? '' : 'hidden'} flex flex-col gap-2">
                  <input type="hidden" id="settings-ketua-ttd-url" value="${s.ketuaTtdUrl || ''}">
                  <div id="preview-ketua-container" class="flex flex-col gap-2">
                    <div class="flex items-center gap-3">
                      <label class="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container cursor-pointer flex items-center gap-1.5 transition-all shadow-sm">
                        <span class="material-symbols-outlined text-[16px]">upload_file</span>
                        <span>${s.ketuaTtdUrl ? 'Ganti File KETUA' : 'Pilih File TTD Ketua'}</span>
                        <input type="file" id="upload-ketua-ttd" accept="image/*" class="hidden">
                      </label>
                      ${s.ketuaTtdUrl ? `
                        <button type="button" onclick="App.clearUploadedImage('ketua')" class="px-2.5 py-1.5 rounded-xl border border-rose-300 text-rose-700 text-xs font-semibold hover:bg-rose-50 flex items-center gap-1">
                          <span class="material-symbols-outlined text-[15px]">delete</span>
                          <span>Hapus File</span>
                        </button>
                      ` : ''}
                    </div>
                    ${s.ketuaTtdUrl ? `
                      <div class="p-2 rounded-lg bg-surface-container-lowest border border-surface-container flex items-center gap-2">
                        <img src="${s.ketuaTtdUrl}" alt="Preview TTD Ketua" class="h-10 max-w-[140px] object-contain border border-dashed border-gray-300 p-1 rounded bg-white">
                        <span class="text-[11px] text-gray-600 font-mono">File TTD Ketua terpasang aktif</span>
                      </div>
                    ` : '<span class="text-[10px] text-gray-500 italic">Format disarankan: PNG transparan (latar belakang bening).</span>'}
                  </div>
                </div>
              </div>

              <!-- SUB-SEKSI 5.2: TANDA TANGAN SEKRETARIS (UPLOAD VS SPESIMEN) -->
              <div class="p-3 rounded-xl bg-surface-container/40 border border-surface-container-high flex flex-col gap-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-primary text-[16px]">draw</span>
                    <h5 class="font-bold text-xs text-primary">Tanda Tangan Sekretaris (${s.sekretarisNama || 'Sekretaris'})</h5>
                  </div>
                  <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container text-gray-700">Sekretaris Jenderal / DPW</span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[11px] font-bold text-on-surface mb-1">Sumber / Tipe Tanda Tangan *</label>
                    <select id="settings-sek-ttd-mode" onchange="App.toggleTtdUploadView('sekretaris')" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-surface-container-high text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none">
                      <option value="spesimen" ${s.sekretarisTtdMode !== 'upload' ? 'selected' : ''}>Spesimen TTE Digital Otomatis</option>
                      <option value="upload" ${s.sekretarisTtdMode === 'upload' ? 'selected' : ''}>Unggah File Gambar TTD (PNG Transparan / Scan)</option>
                    </select>
                  </div>

                  <div id="wrap-sek-upload-size" class="${s.sekretarisTtdMode === 'upload' ? '' : 'hidden'}">
                    <label class="block text-[11px] font-bold text-on-surface mb-1">Tinggi Gambar TTD: <span id="lbl-sek-ttd-size" class="text-primary font-mono font-bold">${s.sekretarisTtdSize || 64}px</span></label>
                    <input type="range" id="settings-sek-ttd-size" min="36" max="120" step="2" value="${s.sekretarisTtdSize || 64}" oninput="document.getElementById('lbl-sek-ttd-size').textContent = this.value + 'px'" class="w-full accent-primary mt-1">
                  </div>
                </div>

                <!-- Upload Box Sekretaris -->
                <div id="wrap-sek-upload-box" class="pt-2 border-t border-surface-container ${s.sekretarisTtdMode === 'upload' ? '' : 'hidden'} flex flex-col gap-2">
                  <input type="hidden" id="settings-sek-ttd-url" value="${s.sekretarisTtdUrl || ''}">
                  <div id="preview-sek-container" class="flex flex-col gap-2">
                    <div class="flex items-center gap-3">
                      <label class="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container cursor-pointer flex items-center gap-1.5 transition-all shadow-sm">
                        <span class="material-symbols-outlined text-[16px]">upload_file</span>
                        <span>${s.sekretarisTtdUrl ? 'Ganti File SEKRETARIS' : 'Pilih File TTD Sekretaris'}</span>
                        <input type="file" id="upload-sek-ttd" accept="image/*" class="hidden">
                      </label>
                      ${s.sekretarisTtdUrl ? `
                        <button type="button" onclick="App.clearUploadedImage('sekretaris')" class="px-2.5 py-1.5 rounded-xl border border-rose-300 text-rose-700 text-xs font-semibold hover:bg-rose-50 flex items-center gap-1">
                          <span class="material-symbols-outlined text-[15px]">delete</span>
                          <span>Hapus File</span>
                        </button>
                      ` : ''}
                    </div>
                    ${s.sekretarisTtdUrl ? `
                      <div class="p-2 rounded-lg bg-surface-container-lowest border border-surface-container flex items-center gap-2">
                        <img src="${s.sekretarisTtdUrl}" alt="Preview TTD Sekretaris" class="h-10 max-w-[140px] object-contain border border-dashed border-gray-300 p-1 rounded bg-white">
                        <span class="text-[11px] text-gray-600 font-mono">File TTD Sekretaris terpasang aktif</span>
                      </div>
                    ` : '<span class="text-[10px] text-gray-500 italic">Format disarankan: PNG transparan.</span>'}
                  </div>
                </div>
              </div>

              <!-- SUB-SEKSI 5.3: STEMPEL DIGITAL BASAH (UPLOAD FILE VS VEKTOR APII) -->
              <div class="p-3 rounded-xl bg-surface-container/40 border border-surface-container-high flex flex-col gap-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <input type="checkbox" id="settings-stempel-aktif" ${s.stempelAktif !== false ? 'checked' : ''} class="w-4 h-4 rounded text-primary focus:ring-primary">
                    <label for="settings-stempel-aktif" class="text-xs font-bold text-on-surface">Aktifkan Stempel Resmi Organisasi</label>
                  </div>
                  <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container text-gray-700">Digital Wet Stamp</span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[11px] font-bold text-on-surface mb-1">Mode / Tipe Stempel *</label>
                    <select id="settings-stempel-mode" onchange="App.toggleStempelUploadView()" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-surface-container-high text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none">
                      <option value="vektor" ${s.stempelMode !== 'upload' ? 'selected' : ''}>Generator Cap Basah Vektor APII (Otomatis)</option>
                      <option value="upload" ${s.stempelMode === 'upload' ? 'selected' : ''}>Unggah File Gambar Stempel Asli Ormas (Scan / PNG Transparan)</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold text-on-surface mb-1">Posisi / Penempatan Stempel *</label>
                    <select id="settings-stempel-posisi" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-surface-container-high text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none">
                      <option value="overlap_left" ${s.stempelPosisi === 'overlap_left' ? 'selected' : ''}>Menimpa TTD Ketua Kiri (Standar Cap Basah Organisasi)</option>
                      <option value="center" ${s.stempelPosisi === 'center' ? 'selected' : ''}>Tepat di Tengah Area TTD</option>
                      <option value="beside" ${s.stempelPosisi === 'beside' ? 'selected' : ''}>Di Samping / Luar Area TTD</option>
                      <option value="custom" ${s.stempelPosisi === 'custom' ? 'selected' : ''}>Posisi Presisi Manual (Offset X / Y)</option>
                    </select>
                  </div>
                </div>

                <!-- Upload Box Stempel File -->
                <div id="wrap-stempel-upload-box" class="${s.stempelMode === 'upload' ? '' : 'hidden'} p-3 rounded-xl bg-surface-container-lowest border border-surface-container flex flex-col gap-2">
                  <input type="hidden" id="settings-stempel-url" value="${s.stempelUrl || ''}">
                  <div id="preview-stempel-container" class="flex flex-col gap-2">
                    <div class="flex items-center gap-3">
                      <label class="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container cursor-pointer flex items-center gap-1.5 transition-all shadow-sm">
                        <span class="material-symbols-outlined text-[16px]">upload_file</span>
                        <span>${s.stempelUrl ? 'Ganti File STEMPEL' : 'Pilih File Stempel Resmi (PNG)'}</span>
                        <input type="file" id="upload-stempel-file" accept="image/*" class="hidden">
                      </label>
                      ${s.stempelUrl ? `
                        <button type="button" onclick="App.clearUploadedImage('stempel')" class="px-2.5 py-1.5 rounded-xl border border-rose-300 text-rose-700 text-xs font-semibold hover:bg-rose-50 flex items-center gap-1">
                          <span class="material-symbols-outlined text-[15px]">delete</span>
                          <span>Hapus File</span>
                        </button>
                      ` : ''}
                    </div>
                    ${s.stempelUrl ? `
                      <div class="p-2 rounded-lg bg-surface-container flex items-center gap-2">
                        <img src="${s.stempelUrl}" alt="Preview Stempel File" class="w-12 h-12 object-contain border border-dashed border-gray-300 p-1 rounded bg-white">
                        <span class="text-[11px] text-gray-600 font-mono">File stempel ormas aktif dipasang pada naskah</span>
                      </div>
                    ` : '<span class="text-[10px] text-gray-500 italic">Disarankan menggunakan file stempel berformat PNG transparan (lingkaran transparan tanpa background putih).</span>'}
                  </div>
                </div>

                <!-- Vektor Generator Inputs (if mode vektor) -->
                <div id="wrap-stempel-vektor-box" class="${s.stempelMode === 'upload' ? 'hidden' : ''} flex flex-col gap-3">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-[11px] font-bold text-on-surface mb-1">Teks Lingkar Luar Stempel *</label>
                      <input type="text" id="settings-stempel-teks-luar" value="${s.stempelTeksLuar || 'YAYASAN APOLOGET ISLAM INDONESIA'}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-surface-container-high text-xs font-bold uppercase focus:ring-1 focus:ring-primary focus:outline-none">
                    </div>
                    <div>
                      <label class="block text-[11px] font-bold text-on-surface mb-1">Teks Lingkar Dalam Stempel *</label>
                      <input type="text" id="settings-stempel-teks-dalam" value="${s.stempelTeksDalam || (activeScope === 'DPP_PUSAT' ? 'DEWAN PENGURUS PUSAT' : activeScope)}" class="w-full px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-surface-container-high text-xs font-bold uppercase focus:ring-1 focus:ring-primary focus:outline-none">
                    </div>
                  </div>

                  <div class="flex items-center gap-3">
                    <label class="block text-[11px] font-bold text-on-surface">Warna Tinta Stempel:</label>
                    <input type="color" id="settings-stempel-warna" value="${s.stempelWarna || '#065f46'}" class="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent">
                    <div class="flex items-center gap-1.5">
                      <button type="button" onclick="document.getElementById('settings-stempel-warna').value='#065f46'; App.syncSettingsPreview();" class="w-5 h-5 rounded-full bg-[#065f46] border border-white shadow-sm" title="Emerald APII"></button>
                      <button type="button" onclick="document.getElementById('settings-stempel-warna').value='#1e3a8a'; App.syncSettingsPreview();" class="w-5 h-5 rounded-full bg-[#1e3a8a] border border-white shadow-sm" title="Navy Wilayah"></button>
                      <button type="button" onclick="document.getElementById('settings-stempel-warna').value='#581c87'; App.syncSettingsPreview();" class="w-5 h-5 rounded-full bg-[#581c87] border border-white shadow-sm" title="Violet Klasik"></button>
                      <button type="button" onclick="document.getElementById('settings-stempel-warna').value='#000000'; App.syncSettingsPreview();" class="w-5 h-5 rounded-full bg-black border border-white shadow-sm" title="Hitam"></button>
                    </div>
                  </div>
                </div>

                <!-- Universal Stempel Layout Sliders (Ukuran, Rotasi, Opasitas, Offset X, Offset Y) -->
                <div class="pt-3 border-t border-surface-container grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <label class="block text-[11px] font-bold text-on-surface mb-1">Ukuran: <span id="lbl-stempel-size" class="text-primary font-mono font-bold">${s.stempelSize || 112}px</span></label>
                    <input type="range" id="settings-stempel-size" min="60" max="160" step="2" value="${s.stempelSize || 112}" oninput="document.getElementById('lbl-stempel-size').textContent = this.value + 'px'" class="w-full accent-primary mt-1">
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold text-on-surface mb-1">Rotasi: <span id="lbl-stempel-rotasi" class="text-primary font-mono font-bold">${s.stempelRotasi !== undefined ? s.stempelRotasi : -12}°</span></label>
                    <input type="range" id="settings-stempel-rotasi" min="-30" max="30" step="1" value="${s.stempelRotasi !== undefined ? s.stempelRotasi : -12}" oninput="document.getElementById('lbl-stempel-rotasi').textContent = this.value + '°'" class="w-full accent-primary mt-1">
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold text-on-surface mb-1">Opasitas: <span id="lbl-stempel-opacity" class="text-primary font-mono font-bold">${s.stempelOpacity !== undefined ? s.stempelOpacity : 85}%</span></label>
                    <input type="range" id="settings-stempel-opacity" min="40" max="100" step="5" value="${s.stempelOpacity !== undefined ? s.stempelOpacity : 85}" oninput="document.getElementById('lbl-stempel-opacity').textContent = this.value + '%'" class="w-full accent-primary mt-1">
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold text-on-surface mb-1">Offset X: <span id="lbl-stempel-offset-x" class="text-primary font-mono font-bold">${s.stempelOffsetX !== undefined ? s.stempelOffsetX : -24}px</span></label>
                    <input type="range" id="settings-stempel-offset-x" min="-80" max="80" step="2" value="${s.stempelOffsetX !== undefined ? s.stempelOffsetX : -24}" oninput="document.getElementById('lbl-stempel-offset-x').textContent = this.value + 'px'" class="w-full accent-primary mt-1">
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold text-on-surface mb-1">Offset Y: <span id="lbl-stempel-offset-y" class="text-primary font-mono font-bold">${s.stempelOffsetY !== undefined ? s.stempelOffsetY : 8}px</span></label>
                    <input type="range" id="settings-stempel-offset-y" min="-40" max="60" step="2" value="${s.stempelOffsetY !== undefined ? s.stempelOffsetY : 8}" oninput="document.getElementById('lbl-stempel-offset-y').textContent = this.value + 'px'" class="w-full accent-primary mt-1">
                  </div>
                </div>
              </div>
            </div>

            <!-- Submit Button Bar -->
            <div class="flex items-center justify-between pt-2">
              <span class="text-xs text-on-surface-variant">Pastikan memeriksa pratinjau langsung di sebelah kanan sebelum menyimpan.</span>
              <button type="submit" class="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary-container shadow flex items-center gap-2 transition-all">
                <span class="material-symbols-outlined text-[18px]">save</span>
                <span>Simpan Perubahan Layout (${activeScope})</span>
              </button>
            </div>
          </form>

          <!-- Right: Interactive Live A4 Preview Canvas (5 cols) -->
          <div class="xl:col-span-5 flex flex-col gap-3">
            <div class="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-[20px]">visibility</span>
                <div>
                  <h4 class="font-display font-bold text-xs text-primary uppercase">Pratinjau Langsung Naskah A4</h4>
                  <p class="text-[10px] text-gray-500">Merespons seketika terhadap perubahan isian form</p>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">${activeScope}</span>
            </div>

            <div class="overflow-x-auto bg-surface-container p-2 sm:p-4 rounded-2xl block shadow-inner">
              <div id="settings-live-a4-preview" class="a4-sheet mx-auto text-black text-xs relative shadow-lg bg-white p-6 w-full max-w-[560px]">
                <!-- Populated dynamically by syncSettingsPreview() -->
              </div>
            </div>
          </div>
        </div>

        <!-- Audit History Pengaturan -->
        <div class="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm flex flex-col gap-3 mt-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[18px]">history</span>
              <h4 class="font-display font-bold text-xs text-primary uppercase">Riwayat Audit Perubahan Master Settings (${audits.length} Catatan)</h4>
            </div>
            <span class="text-[11px] text-on-surface-variant">Forensik otomatis mencatat nilai lama vs nilai baru</span>
          </div>

          <div class="overflow-x-auto rounded-xl border border-surface-container">
            <table class="w-full text-left text-xs">
              <thead class="bg-surface-container font-bold text-on-surface-variant">
                <tr>
                  <th class="px-4 py-2.5">Waktu Perubahan</th>
                  <th class="px-4 py-2.5">Parameter</th>
                  <th class="px-4 py-2.5">Nilai Lama</th>
                  <th class="px-4 py-2.5">Nilai Baru</th>
                  <th class="px-4 py-2.5">Diubah Oleh</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-surface-container">
                ${audits.map(a => `
                  <tr class="hover:bg-surface-container-low">
                    <td class="px-4 py-2 font-mono text-gray-500 text-[11px]">${formatTanggalDisplay(a.timestamp)}</td>
                    <td class="px-4 py-2 font-bold text-primary">${a.key}</td>
                    <td class="px-4 py-2 text-rose-700 font-mono text-[11px] line-through truncate max-w-xs" title="${a.oldValue}">${a.oldValue}</td>
                    <td class="px-4 py-2 text-emerald-800 font-mono text-[11px] font-bold truncate max-w-xs" title="${a.newValue}">${a.newValue}</td>
                    <td class="px-4 py-2 text-gray-600">${a.changedBy}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    cSettings.innerHTML = html;

    // Attach real-time input listeners to synchronize the preview canvas
    const formEl = document.getElementById('form-master-settings');
    if (formEl) {
      formEl.querySelectorAll('input, select, textarea').forEach(input => {
        input.addEventListener('input', syncSettingsPreview);
        input.addEventListener('change', syncSettingsPreview);
      });
    }

    // Attach file upload listeners for TTD & Stempel
    const ketuaFileInput = document.getElementById('upload-ketua-ttd');
    if (ketuaFileInput) {
      ketuaFileInput.addEventListener('change', (e) => {
        handleImageFileUpload(e.target, 'settings-ketua-ttd-url', (url) => {
          updateUploadThumbnail('ketua', url);
          syncSettingsPreview();
        });
      });
    }

    const sekFileInput = document.getElementById('upload-sek-ttd');
    if (sekFileInput) {
      sekFileInput.addEventListener('change', (e) => {
        handleImageFileUpload(e.target, 'settings-sek-ttd-url', (url) => {
          updateUploadThumbnail('sekretaris', url);
          syncSettingsPreview();
        });
      });
    }

    const stempelFileInput = document.getElementById('upload-stempel-file');
    if (stempelFileInput) {
      stempelFileInput.addEventListener('change', (e) => {
        handleImageFileUpload(e.target, 'settings-stempel-url', (url) => {
          updateUploadThumbnail('stempel', url);
          syncSettingsPreview();
        });
      });
    }

    // Initial sync
    syncSettingsPreview();
  }

  // --- SUBTAB 5: WILAYAH FEDERASI DPW ---
  function renderWilayahSubTab() {
    const cWilayah = document.getElementById('subtab-wilayah-content');
    if (!cWilayah) return;

    const db = State.getDb();
    const wilayahList = db.wilayah || [];
    const accounts = Auth.getAllAccounts();

    let html = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div>
          <h3 class="font-display font-bold text-sm text-primary">Master Wilayah Federasi DPW (${wilayahList.length} Wilayah Terdaftar)</h3>
          <p class="text-xs text-on-surface-variant">Arsitektur multi-tenant: DPP Pusat dan seluruh DPW tingkat regional bernaung dalam satu sistem tunggal.</p>
        </div>
        <button type="button" onclick="App.openTambahWilayahModal()" class="px-3.5 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary-container shadow flex items-center gap-1.5 shrink-0 transition-all">
          <span class="material-symbols-outlined text-[16px]">domain_add</span>
          <span>+ Daftarkan Wilayah (DPW) Baru</span>
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${wilayahList.map(w => {
          const userCount = accounts.filter(u => u.tenantId === w.code).length;
          const isPusat = w.code === 'DPP_PUSAT';

          return `
            <div class="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container hover:border-primary/40 shadow-sm flex flex-col justify-between gap-4 transition-all">
              <div class="flex flex-col gap-2.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold ${isPusat ? 'bg-primary text-white' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'}">${w.code}</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">FEDERASI AKTIF</span>
                </div>
                <div>
                  <h4 class="font-display font-bold text-base text-primary">${w.name}</h4>
                  <span class="text-xs font-mono text-gray-500">Slug: /${w.slug || 'wilayah'}</span>
                </div>
                <div class="text-xs text-on-surface-variant flex flex-col gap-1 pt-1">
                  <div class="flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[16px] text-gray-500">location_city</span>
                    <span>Kedudukan: <strong>${w.city || 'DKI Jakarta'}</strong></span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[16px] text-gray-500">phone</span>
                    <span>Telepon: <strong>${w.phone || '-'}</strong></span>
                  </div>
                  <div class="flex items-start gap-1.5 mt-0.5">
                    <span class="material-symbols-outlined text-[16px] text-gray-500 shrink-0 mt-0.5">home</span>
                    <span class="text-[11px] leading-tight text-gray-600">${w.address || 'Sekretariat Wilayah APII'}</span>
                  </div>
                </div>
              </div>

              <div class="pt-3 border-t border-surface-container flex items-center justify-between text-xs">
                <span class="text-gray-500">Alokasi Roster:</span>
                <span class="font-bold text-primary">${userCount} Pengurus</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    cWilayah.innerHTML = html;
  }

  // --- SUBTAB 6: REDAKSI MINI-CMS PUBLIK ---
  function broadcastCmsWa(cmsId) {
    const db = State.getDb();
    const p = (db.cms || []).find(item => item.id === cmsId);
    if (!p) return;
    const msg = `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n` +
      `*BROADCAST WARTA & MAKLUMAT RESMI*\n\n` +
      `*${p.judul}*\n` +
      `Kategori: ${p.kategori} | Tanggal: ${formatTanggalDisplay(p.tanggal)}\n\n` +
      `${p.ringkasan}\n\n` +
      `Baca selengkapnya melalui Portal Publik Resmi APII:\n` +
      `https://apologetislamindonesia.or.id/public/\n\n` +
      `_Redaksi Humas & Komunikasi DPP APII_`;
    showWhatsAppRelayModal('Jamaah & Grup Kader APII', 'Broadcast Saluran Publik', '6281358575678', msg);
  }

  function renderCmsSubTab() {
    const cCms = document.getElementById('subtab-minicms-content');
    if (!cCms) return;

    const db = State.getDb();
    const cmsList = db.cms || [];
    const isRo = Auth.isReadOnly();

    let html = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div>
          <h3 class="font-display font-bold text-sm text-slate-900">Redaksi Mini-CMS Warta &amp; Maklumat Live (${cmsList.length} Artikel)</h3>
          <p class="text-xs text-slate-600">Artikel dan maklumat ini seketika tayang secara real-time di Portal Publik (/public).</p>
        </div>
        ${!isRo ? `
          <button type="button" onclick="App.openTambahWartaCmsModal()" class="min-h-[44px] px-4 py-2 rounded bg-[#064E3B] text-white font-bold text-xs hover:bg-[#003527] shadow-sm flex items-center gap-1.5 shrink-0 transition-colors">
            <span class="material-symbols-outlined text-[16px]">edit_note</span>
            <span>+ Tulis Warta / Maklumat Live</span>
          </button>
        ` : ''}
      </div>

      <div class="flex flex-col gap-3">
        ${cmsList.map(p => `
          <div class="p-4 rounded-lg bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900">${p.kategori}</span>
                <span class="tabular-nums text-[10px] text-slate-600 font-mono">${formatTanggalDisplay(p.tanggal)}</span>
                <span class="text-[10px] text-slate-600">&bull; Penulis: ${p.penulis || 'Humas DPP'}</span>
              </div>
              <h4 class="font-bold text-sm text-slate-900">${p.judul}</h4>
              <p class="text-slate-600 mt-1 leading-relaxed">${p.ringkasan}</p>
            </div>
            <div class="flex flex-wrap items-center gap-2 shrink-0">
              <span class="px-2 py-1 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 text-[11px] font-bold">PUBLISHED</span>
              <button type="button" onclick="App.broadcastCmsWa('${p.id}')" class="min-h-[44px] px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1 transition-colors">
                <span class="material-symbols-outlined text-[15px]">campaign</span>
                <span>Broadcast WA Jamaah</span>
              </button>
              <a href="../public/" target="_blank" class="min-h-[44px] px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold text-xs flex items-center gap-1 transition-colors">
                <span>Lihat di Publik</span>
                <span class="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    cCms.innerHTML = html;
  }

  // --- SUBTAB 7: GOOGLE DRIVE VAULT 3-TINGKAT ---
  function renderDriveSubTab() {
    const cDrive = document.getElementById('subtab-drive-content');
    if (!cDrive) return;

    const db = State.getDb();
    const quota = db.driveQuota || { usedMb: 12450, limitMb: 15360, warningThresholdPct: 80, criticalThresholdPct: 90, recycleBinRetentionDays: 30, recycleBin: [] };
    const usedMb = Number(quota.usedMb) || 0;
    const limitMb = Math.max(1, Number(quota.limitMb) || 15360);
    const pct = Math.min(100, Math.round((usedMb / limitMb) * 100));
    const isCritical = pct >= (quota.criticalThresholdPct || 90);
    const isWarning = pct >= (quota.warningThresholdPct || 80);
    const usedGb = (usedMb / 1024).toFixed(2);
    const limitGb = (limitMb / 1024).toFixed(2);
    const driveFiles = Array.isArray(db.drive) ? db.drive : [];
    const canonicalFolders = Array.isArray(CONFIG.DRIVE_SUBFOLDERS) && CONFIG.DRIVE_SUBFOLDERS.length === 10
      ? CONFIG.DRIVE_SUBFOLDERS
      : ['01_SURAT_KELUAR', '02_SURAT_MASUK', '03_BUKTI_KAS', '04_LPJ_DIVISI', '05_BERKAS_KTA', '06_ASSET_CMS', '07_ADVOKASI_HUKUM', '08_MUALLAF_CARE', '09_ASET_LOGISTIK', '10_RISALAH_RAPAT'];

    let html = `
      <div class="p-4 rounded-lg ${isCritical ? 'bg-red-50 border-red-300' : (isWarning ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200')} border flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 text-xs">
        <div class="flex-1">
          <span class="font-bold text-slate-900 block text-sm">Kapasitas Google Drive Vault APII</span>
          <span class="tabular-nums text-slate-700 font-semibold">${usedGb} GB terpakai dari ${limitGb} GB (${pct}% &bull; ${isCritical ? 'KRITIS >= 90%: Segera Bersihkan / Upgrade' : (isWarning ? 'PERINGATAN >= 80%: Mendekati Batas Kuota' : 'Aman')})</span>
          <div class="w-full bg-slate-200 rounded-full h-2.5 mt-2 max-w-md overflow-hidden">
            <div class="${isCritical ? 'bg-red-700' : (isWarning ? 'bg-amber-600' : 'bg-[#064E3B]')} h-2.5 rounded-full" style="width: ${pct}%"></div>
          </div>
        </div>
        <div class="flex flex-col sm:items-end gap-1">
          <span class="px-2.5 py-1 rounded bg-emerald-100 text-emerald-900 font-bold text-[10px]">RECYCLE BIN ${quota.recycleBinRetentionDays || 30} HARI AKTIF (${(quota.recycleBin || []).length} Arsip)</span>
          <span class="text-[11px] text-slate-600 font-mono">Root: APII_Enterprise_Drive_2026</span>
        </div>
      </div>

      <div class="mb-2">
        <h4 class="font-display font-bold text-xs text-slate-900 uppercase tracking-wide">10 Folder Kanonik Terstruktur Sesuai PRD Bab 2.3.1</h4>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        ${canonicalFolders.map(f => {
          const count = driveFiles.filter(file => file.folder === f).length;
          return `
            <div class="p-3.5 rounded-lg bg-white border border-slate-200 flex flex-col items-center text-center gap-1.5 hover:bg-slate-50 transition-colors shadow-sm">
              <span class="material-symbols-outlined text-amber-700 text-[36px]">folder</span>
              <span class="text-[11px] font-bold font-mono text-slate-900 leading-tight break-all">${f}</span>
              <span class="tabular-nums text-[10px] text-slate-600 font-semibold">${count} Berkas &bull; RBAC Terkunci</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
    cDrive.innerHTML = html;
  }

  // --- SUBTAB 8: AUDIT TRAIL FORENSIK WORM ---
  function renderAuditSubTab() {
    const cAudit = document.getElementById('subtab-audit-content');
    if (!cAudit) return;

    const db = State.getDb();
    let logs = db.auditLogs || [];

    if (auditSearchQuery) {
      const q = auditSearchQuery.toLowerCase();
      logs = logs.filter(l => 
        (l.action && l.action.toLowerCase().includes(q)) ||
        (l.entity && l.entity.toLowerCase().includes(q)) ||
        (l.recordId && l.recordId.toLowerCase().includes(q)) ||
        (l.entityId && l.entityId.toLowerCase().includes(q)) ||
        (l.userId && l.userId.toLowerCase().includes(q)) ||
        (l.detailsJson && l.detailsJson.toLowerCase().includes(q))
      );
    }

    let html = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div>
          <h3 class="font-display font-bold text-sm text-slate-900">WORM Audit Trail Inspector (${logs.length} Log Forensik)</h3>
          <p class="text-xs text-slate-600">Prinsip WORM (Write-Once-Read-Many): Seluruh log tersimpan permanen dan tidak dapat dimanipulasi.</p>
        </div>
        <div class="flex items-center gap-2">
          <input type="text" placeholder="Cari aksi, user, entity, atau override..." value="${auditSearchQuery}" oninput="App.filterAuditLogs(this.value)" class="px-3 py-1.5 rounded bg-white border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-[#064E3B] focus:outline-none w-64">
          <button type="button" onclick="App.filterAuditLogs('SUPERADMIN_OVERRIDE')" class="min-h-[44px] px-3 py-1.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold text-xs shrink-0 transition-colors">
            Filter Override
          </button>
        </div>
      </div>

      <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-50 font-bold text-slate-700 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3">Waktu (WIB)</th>
              <th class="px-4 py-3">Aksi Sistem</th>
              <th class="px-4 py-3">Entitas &amp; Target</th>
              <th class="px-4 py-3">Pengguna</th>
              <th class="px-4 py-3">Rincian Data Forensik (JSON)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 font-mono text-[11px]">
            ${logs.map(l => {
              const isOverride = l.action === 'SUPERADMIN_OVERRIDE';
              const targetRef = l.recordId || l.entityId || '-';
              return `
                <tr class="hover:bg-slate-50 transition-colors ${isOverride ? 'bg-amber-50 font-semibold' : ''}">
                  <td class="tabular-nums px-4 py-2.5 text-slate-600 whitespace-nowrap">${formatTanggalDisplay(l.timestamp)}</td>
                  <td class="px-4 py-2.5">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isOverride ? 'bg-amber-900 text-amber-100' : 'bg-slate-100 text-slate-800'}">
                      ${l.action}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 font-bold text-slate-900">${l.entity}: ${targetRef}</td>
                  <td class="px-4 py-2.5 text-slate-700">${l.userId}</td>
                  <td class="px-4 py-2.5 text-slate-600 truncate max-w-md" title="${l.detailsJson || ''}">${l.detailsJson || '{}'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    cAudit.innerHTML = html;
  }

  function filterAuditLogs(query) {
    auditSearchQuery = query;
    renderAuditSubTab();
  }

  // =========================================================================
  // MODAL HANDLERS & ACTIONS UNTUK SUPERADMIN SETTINGS
  // =========================================================================

  // 1. IAM User Form Modal & 8-Role RBAC Handler
  function onUserFormRoleChanged(roleVal) {
    const divGroup = document.getElementById('user-form-divisi-group');
    if (divGroup) {
      if (roleVal === 'ketua_divisi' || roleVal === 'anggota_divisi') {
        divGroup.classList.remove('hidden');
      } else {
        divGroup.classList.add('hidden');
      }
    }
  }

  function openUserModal(userId) {
    const modal = document.getElementById('modal-user-form');
    if (!modal) return;

    // Populate wilayah options
    const selWilayah = document.getElementById('user-form-wilayah');
    if (selWilayah) {
      const wilayahList = State.getDb().wilayah || [];
      selWilayah.innerHTML = wilayahList.map(w => `<option value="${w.code}">${w.name} (${w.code})</option>`).join('');
    }

    const titleEl = document.getElementById('user-form-modal-title');
    const inputId = document.getElementById('user-form-id');
    const inputName = document.getElementById('user-form-fullname');
    const inputUser = document.getElementById('user-form-username');
    const inputPhone = document.getElementById('user-form-phone');
    const inputRole = document.getElementById('user-form-role');
    const inputDivisi = document.getElementById('user-form-divisi');
    const inputStatus = document.getElementById('user-form-status');
    const inputPass = document.getElementById('user-form-password');

    if (userId) {
      const user = Auth.getAllAccounts().find(u => u.id === userId);
      if (user) {
        if (titleEl) titleEl.textContent = 'Edit Akun Pengurus: ' + user.fullName;
        if (inputId) inputId.value = user.id;
        if (inputName) inputName.value = user.fullName;
        if (inputUser) inputUser.value = user.username;
        if (inputPhone) inputPhone.value = user.phone || '';
        if (inputRole) inputRole.value = user.role;
        if (inputDivisi && user.divisi) inputDivisi.value = user.divisi;
        onUserFormRoleChanged(user.role);
        if (selWilayah) selWilayah.value = user.tenantId || 'DPP_PUSAT';
        if (inputStatus) inputStatus.value = user.isActive !== false ? 'active' : 'demisioner';
        if (inputPass) inputPass.value = '';
      }
    } else {
      if (titleEl) titleEl.textContent = 'Tambah Akun Pengurus Baru (8-Role RBAC)';
      if (inputId) inputId.value = '';
      if (inputName) inputName.value = '';
      if (inputUser) inputUser.value = '';
      if (inputPhone) inputPhone.value = '6281358575678';
      if (inputRole) inputRole.value = 'ketua_divisi';
      if (inputDivisi) inputDivisi.value = 'dakwah';
      onUserFormRoleChanged('ketua_divisi');
      if (selWilayah) selWilayah.value = 'DPP_PUSAT';
      if (inputStatus) inputStatus.value = 'active';
      if (inputPass) inputPass.value = 'APII@Mandat2026';
    }

    modal.classList.remove('hidden');
  }

  function submitUserForm() {
    const inputId = document.getElementById('user-form-id');
    const inputName = document.getElementById('user-form-fullname');
    const inputUser = document.getElementById('user-form-username');
    const inputPhone = document.getElementById('user-form-phone');
    const inputRole = document.getElementById('user-form-role');
    const inputDivisi = document.getElementById('user-form-divisi');
    const inputWilayah = document.getElementById('user-form-wilayah');
    const inputStatus = document.getElementById('user-form-status');
    const inputPass = document.getElementById('user-form-password');

    if (!inputName?.value || !inputUser?.value) {
      showToast('Nama lengkap dan username wajib diisi!', 'error');
      return;
    }

    const role = inputRole?.value || 'anggota_divisi';
    const isKadivOrAnggota = role === 'ketua_divisi' || role === 'anggota_divisi';
    const divisiVal = isKadivOrAnggota ? (inputDivisi?.value || 'dakwah') : null;

    let categoryText = CONFIG.ROLES[role]?.label || role.toUpperCase();
    if (role === 'ketua_divisi') {
      const divObj = CONFIG.DIVISIONS.find(d => d.code === divisiVal);
      categoryText = `Ketua ${divObj?.name || divisiVal}`;
    } else if (role === 'anggota_divisi') {
      const divObj = CONFIG.DIVISIONS.find(d => d.code === divisiVal);
      categoryText = `Anggota ${divObj?.name || divisiVal}`;
    }

    const userData = {
      id: inputId?.value || undefined,
      fullName: inputName.value.trim(),
      username: inputUser.value.trim().toLowerCase(),
      phone: inputPhone?.value.trim().replace(/[^0-9]/g, '') || '6281358575678',
      role: role,
      divisi: divisiVal,
      category: categoryText,
      tenantId: inputWilayah?.value || 'DPP_PUSAT',
      isActive: inputStatus?.value === 'active'
    };

    if (inputPass?.value) {
      userData.password = inputPass.value;
    }

    Auth.saveUser(userData);
    document.getElementById('modal-user-form')?.classList.add('hidden');
    showToast(`Akun pengurus ${userData.fullName} (${CONFIG.ROLES[role]?.label || role}) berhasil disimpan!`);
    renderIamSubTab();
  }

  function toggleUserStatus(userId, targetActive) {
    const user = Auth.getAllAccounts().find(u => u.id === userId);
    if (!user) return;

    Auth.toggleUserStatus(userId, targetActive);
    State.logAudit(targetActive ? 'ACTIVATE_USER' : 'DEMISIONER_USER', 'User', userId, {
      username: user.username,
      targetActive: targetActive
    });

    showToast(`Status pengurus ${user.fullName} berhasil diubah menjadi: ${targetActive ? 'Aktif' : 'Demisioner'}.`);
    renderIamSubTab();
    renderSessionsSubTab();
  }

  // 2. Reset Password Modal
  function openResetPasswordModal(userId) {
    const user = Auth.getAllAccounts().find(u => u.id === userId);
    if (!user) return;

    const modal = document.getElementById('modal-reset-password');
    if (!modal) return;

    document.getElementById('reset-user-id').value = user.id;
    document.getElementById('reset-user-fullname').value = user.fullName + ' (' + user.role.toUpperCase() + ')';
    document.getElementById('reset-user-username').value = user.username;
    document.getElementById('reset-user-phone').value = user.phone || '6281358575678';
    
    generateRandomTempPassword();
    modal.classList.remove('hidden');
  }

  function generateRandomTempPassword() {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const pass = 'APII@' + randomSuffix;
    const inputPass = document.getElementById('reset-new-password');
    if (inputPass) inputPass.value = pass;
  }

  function copyTempPassword() {
    const inputPass = document.getElementById('reset-new-password');
    if (inputPass && inputPass.value) {
      navigator.clipboard.writeText(inputPass.value);
      showToast('Kata sandi sementara berhasil disalin ke clipboard!');
    }
  }

  function submitResetPassword() {
    const userId = document.getElementById('reset-user-id')?.value;
    const phone = document.getElementById('reset-user-phone')?.value;
    const username = document.getElementById('reset-user-username')?.value;
    const name = document.getElementById('reset-user-fullname')?.value;
    const newPass = document.getElementById('reset-new-password')?.value;

    if (!newPass) {
      showToast('Kata sandi baru tidak boleh kosong!', 'error');
      return;
    }

    Auth.resetPassword(userId, newPass);
    State.logAudit('RESET_PASSWORD', 'User', userId, { username: username, resetBy: 'Superadmin' });

    const msg = `Assalamu'alaikum Wr. Wb. Yth. *${name}*,\n\nBerikut kata sandi sementara akun SIAP APII Anda:\n- Username: *${username}*\n- Password Sementara: *${newPass}*\n\nHarap segera login melalui Portal Pengurus https://apologetislamindonesia.or.id/portal dan perbarui kata sandi Anda.\n\n_Wassalamu'alaikum Wr. Wb._\n*Sekretariat DPP APII*`;
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');

    document.getElementById('modal-reset-password')?.classList.add('hidden');
    showToast(`Kata sandi untuk ${username} berhasil direset dan naskah WhatsApp telah disiapkan!`);
  }

  // 3. Deadlock Breaker Modal
  function openDeadlockBreakerModal(docType, docId) {
    const queue = State.getDeadlockQueue();
    const item = queue.find(q => q.type === docType && q.id === docId);
    if (!item) {
      showToast('Dokumen antrean kebuntuan tidak ditemukan!', 'error');
      return;
    }

    const modal = document.getElementById('modal-deadlock-breaker');
    if (!modal) return;

    document.getElementById('deadlock-doc-type').value = docType;
    document.getElementById('deadlock-doc-id').value = docId;
    document.getElementById('deadlock-doc-title').value = `[${item.typeLabel}] ${item.nomor} - ${item.perihal}`;
    document.getElementById('deadlock-reason').value = '';
    document.getElementById('deadlock-ref').value = 'SK-DPP/PLENO-DARURAT/XI/2026';
    document.getElementById('deadlock-agree').checked = false;

    modal.classList.remove('hidden');
  }

  function submitDeadlockBreaker() {
    const docType = document.getElementById('deadlock-doc-type')?.value;
    const docId = document.getElementById('deadlock-doc-id')?.value;
    const reason = document.getElementById('deadlock-reason')?.value.trim();
    const docRef = document.getElementById('deadlock-ref')?.value.trim();
    const agree = document.getElementById('deadlock-agree')?.checked;

    if (!agree) {
      showToast('Persetujuan tanggung jawab hukum darurat wajib dicentang!', 'error');
      return;
    }

    if (!reason || reason.length < 15) {
      showToast('Alasan kedaruratan wajib diisi minimal 15 karakter!', 'error');
      return;
    }

    const res = State.executeDeadlockOverride(docType, docId, reason, docRef);
    if (!res.ok) {
      showToast(res.error || 'Gagal mengeksekusi pengesahan darurat.', 'error');
      return;
    }

    // Sinkronkan realisasi dana Proker jika Deadlock memutus BKK terkait proker
    if (docType === 'kas') {
      const db = State.getDb();
      const trx = (db.kas && db.kas.transactions ? db.kas.transactions : []).find(t => t.id === docId);
      if (trx && trx.prokerId) {
        const prk = (db.proker || []).find(p => p.id === trx.prokerId);
        if (prk) {
          prk.realisasiDana = (Number(prk.realisasiDana) || 0) + (Number(trx.nominal) || 0);
          prk.status = 'BERJALAN';
          State.saveDatabase();
        }
      }
    }

    syncApiSafe('executeDeadlockBreaker', { docType, docId, reason, docRef });

    document.getElementById('modal-deadlock-breaker')?.classList.add('hidden');
    showToast('Deadlock Breaker Berhasil! Dokumen disahkan darurat dan dicatat ke WORM Audit Trail.');
    renderDeadlockBreakerSubTab();
    renderAuditSubTab();

    // Trigger Smart WhatsApp Relay Modal ke Pimpinan Harian
    const targetKetum = resolveOfficerSafe('ketua', 'DPP_PUSAT');
    const msg = `*YAYASAN APOLOGET ISLAM INDONESIA (APII)*\n` +
      `*PEMBERITAHUAN EKSEKUSI DEADLOCK BREAKER (PENGESAHAN DARURAT)*\n\n` +
      `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
      `Yth. ${targetKetum.name} (${targetKetum.roleLabel || targetKetum.role})\n\n` +
      `Superadmin Nasional telah mengeksekusi wewenang darurat Deadlock Breaker sesuai AD/ART Pasal 29 demi kelancaran operasional yayasan:\n` +
      `• *Tipe Dokumen:* ${docType}\n` +
      `• *ID Dokumen:* ${docId}\n` +
      `• *Dasar Hukum Pleno:* ${docRef}\n` +
      `• *Alasan Kedaruratan:* ${reason}\n` +
      `• *Status:* DISAHKAN DARURAT & TERCATAT DI WORM AUDIT TRAIL\n\n` +
      `Silakan inspeksi catatan log forensik melalui Portal Pengurus SIAP APII:\n` +
      `https://apologetislamindonesia.or.id/portal/#sistem\n\n` +
      `_Superadmin Nasional SIAP APII Enterprise_`;

    showWhatsAppRelayModal(targetKetum.name, targetKetum.roleLabel || targetKetum.role, targetKetum.phone, msg);
  }

  // 4. Master Settings Form
  function saveMasterSettings() {
    const activeScope = currentSettingsScope || 'DPP_PUSAT';

    const ketumVal = document.getElementById('settings-ketum')?.value.trim() || '';
    const sekjenVal = document.getElementById('settings-sekjen')?.value.trim() || '';
    const bendumVal = document.getElementById('settings-bendum')?.value.trim() || '';
    const plafonVal = Number(document.getElementById('settings-plafon-kas')?.value) || 2000000;

    const kop1Val = document.getElementById('settings-kop1')?.value.trim() || '';
    const kop2Val = document.getElementById('settings-kop2')?.value.trim() || '';
    const kop3Val = document.getElementById('settings-kop3')?.value.trim() || document.getElementById('settings-ahu')?.value.trim() || '';
    const alamatVal = document.getElementById('settings-alamat')?.value.trim() || '';
    const telpVal = document.getElementById('settings-telepon')?.value.trim() || '';
    const emailVal = document.getElementById('settings-email')?.value.trim() || '';
    const webVal = document.getElementById('settings-website')?.value.trim() || '';
    const dividerVal = document.getElementById('settings-kop-divider')?.value || 'double_black';

    const newSettings = {
      scope: activeScope,
      // Pimpinan & TTD
      ketuaUmum: ketumVal,
      ketuaNama: ketumVal,
      ketuaJabatan: document.getElementById('settings-ketua-jabatan')?.value.trim() || (activeScope === 'DPP_PUSAT' ? 'Ketua Umum DPP' : 'Ketua DPW'),
      ketuaNia: document.getElementById('settings-ketua-nia')?.value.trim() || '',
      sekretarisJenderal: sekjenVal,
      sekretarisNama: sekjenVal,
      sekretarisJabatan: document.getElementById('settings-sek-jabatan')?.value.trim() || (activeScope === 'DPP_PUSAT' ? 'Sekretaris Umum DPP' : 'Sekretaris DPW'),
      sekretarisNia: document.getElementById('settings-sek-nia')?.value.trim() || '',
      bendaharaUmum: bendumVal,
      plafonKasTunai: plafonVal,

      // Logo Layout & Dimensions
      logoLayout: document.getElementById('settings-logo-layout')?.value || 'left',
      logoSize: Number(document.getElementById('settings-logo-size')?.value) || 76,
      logoUrl: document.getElementById('settings-logo-url')?.value.trim() || './logo_apii.png',
      logoSecondaryUrl: document.getElementById('settings-logo-secondary-url')?.value.trim() || './logo_apii.png',

      // KOP Text & Divider
      kopBaris1: kop1Val,
      kopBaris2: kop2Val,
      kopBaris3: kop3Val,
      kopAhu: kop3Val,
      kopAlamat: alamatVal,
      kopTelepon: telpVal,
      kopEmail: emailVal,
      kopWebsite: webVal,
      kopDivider: dividerVal,

      // Tipografi Naskah
      fontFamily: document.getElementById('settings-font-family')?.value || 'times',
      fontSize: document.getElementById('settings-font-size')?.value || '12pt',
      lineSpacing: document.getElementById('settings-line-spacing')?.value || '1.25',
      kotaSurat: document.getElementById('settings-kota-surat')?.value.trim() || 'Jakarta',
      showBismillah: document.getElementById('settings-show-bismillah')?.checked !== false,
      showHijriDate: document.getElementById('settings-show-hijri')?.checked !== false,

      // TTD & Stempel
      modelTtd: document.getElementById('settings-model-ttd')?.value || 'dual',
      spesimenTtdType: document.getElementById('settings-spesimen-ttd')?.value || 'digital_paraf',
      ketuaTtdMode: document.getElementById('settings-ketua-ttd-mode')?.value || 'spesimen',
      ketuaTtdUrl: document.getElementById('settings-ketua-ttd-url')?.value.trim() || '',
      ketuaTtdSize: Number(document.getElementById('settings-ketua-ttd-size')?.value) || 64,
      sekretarisTtdMode: document.getElementById('settings-sek-ttd-mode')?.value || 'spesimen',
      sekretarisTtdUrl: document.getElementById('settings-sek-ttd-url')?.value.trim() || '',
      sekretarisTtdSize: Number(document.getElementById('settings-sek-ttd-size')?.value) || 64,

      stempelAktif: document.getElementById('settings-stempel-aktif')?.checked !== false,
      stempelMode: document.getElementById('settings-stempel-mode')?.value || 'vektor',
      stempelUrl: document.getElementById('settings-stempel-url')?.value.trim() || '',
      stempelSize: Number(document.getElementById('settings-stempel-size')?.value) || 112,
      stempelOpacity: Number(document.getElementById('settings-stempel-opacity')?.value) || 85,
      stempelTeksLuar: document.getElementById('settings-stempel-teks-luar')?.value.trim() || 'YAYASAN APOLOGET ISLAM INDONESIA',
      stempelTeksDalam: document.getElementById('settings-stempel-teks-dalam')?.value.trim() || (activeScope === 'DPP_PUSAT' ? 'DEWAN PENGURUS PUSAT' : activeScope),
      stempelWarna: document.getElementById('settings-stempel-warna')?.value || '#065f46',
      stempelPosisi: document.getElementById('settings-stempel-posisi')?.value || 'overlap_left',
      stempelOffsetX: Number(document.getElementById('settings-stempel-offset-x')?.value) || -24,
      stempelOffsetY: Number(document.getElementById('settings-stempel-offset-y')?.value) || 8,
      stempelRotasi: Number(document.getElementById('settings-stempel-rotasi')?.value) || -12
    };

    const curUser = Auth.getCurrentUser();
    State.updateSettings(newSettings, curUser?.fullName || 'Superadmin Nasional', activeScope);
    showToast(`Master Pengaturan & KOP untuk ${activeScope} berhasil disimpan dan disinkronkan langsung (Live Sync)!`);
    renderSettingsSubTab();
  }

  // 5. Registrasi Wilayah DPW Form
  function openTambahWilayahModal() {
    const user = Auth.getCurrentUser();
    if (user.role !== 'superadmin') {
      showToast('Akses ditolak: Registrasi DPW baru merupakan hak prerogatif Superadmin Nasional.', 'error');
      return;
    }

    const modal = document.getElementById('modal-wilayah-form');
    if (!modal) return;

    document.getElementById('wilayah-name').value = '';
    document.getElementById('wilayah-code').value = '';
    document.getElementById('wilayah-slug').value = '';
    document.getElementById('wilayah-city').value = '';
    document.getElementById('wilayah-phone').value = '';
    document.getElementById('wilayah-address').value = '';

    modal.classList.remove('hidden');
  }

  function submitWilayahForm() {
    const name = document.getElementById('wilayah-name')?.value.trim();
    const code = document.getElementById('wilayah-code')?.value.trim().toUpperCase();
    const slug = document.getElementById('wilayah-slug')?.value.trim().toLowerCase();
    const city = document.getElementById('wilayah-city')?.value.trim();
    const phone = document.getElementById('wilayah-phone')?.value.trim();
    const address = document.getElementById('wilayah-address')?.value.trim();

    if (!name || !code) {
      showToast('Nama wilayah dan kode unik DPW wajib diisi!', 'error');
      return;
    }

    const res = State.registerWilayah({
      code: code,
      name: name,
      slug: slug || code.toLowerCase(),
      city: city || 'Ibu Kota Provinsi',
      phone: phone || '',
      address: address || ''
    });

    if (!res.ok) {
      showToast(res.error || 'Gagal mendaftarkan wilayah baru.', 'error');
      return;
    }

    // Refresh tenant switcher
    if (typeof setupTenantSwitcher === 'function') {
      setupTenantSwitcher();
    }

    document.getElementById('modal-wilayah-form')?.classList.add('hidden');
    showToast(`Wilayah ${name} (${code}) berhasil didaftarkan ke federasi SIAP APII!`);
    renderWilayahSubTab();
  }

  // 6. Sesi Revocation Actions
  function revokeSession(token) {
    const success = State.revokeSession(token);
    if (success) {
      showToast('Izin sesi perangkat berhasil dicabut.');
      renderSessionsSubTab();
    } else {
      showToast('Gagal mencabut sesi perangkat.', 'error');
    }
  }

  function revokeAllOtherSessions() {
    const cur = Auth.getCurrentUser();
    const db = State.getDb();
    if (db.sessions) {
      const before = db.sessions.length;
      db.sessions = db.sessions.filter(s => cur && s.username === cur.username);
      State.saveDatabase();
      State.logAudit('REVOKE_ALL_SESSIONS', 'Session', 'ALL_OTHER', { revokedCount: before - db.sessions.length });
      showToast(`${before - db.sessions.length} sesi perangkat lain berhasil dicabut.`);
      renderSessionsSubTab();
    }
  }

  // 7. Mini-CMS Modal (Zero Browser Prompt)
  function openTambahWartaCmsModal() {
    const user = Auth.getCurrentUser();
    if (!Auth.hasPermission('cms:write') && user.divisi !== 'humas' && user.divisi !== 'sosmed' && user.role !== 'superadmin') {
      showToast('Akses ditolak: Hanya Divisi Humas, Sosmed, atau Sekretaris yang berwenang mempublikasikan warta publik.', 'error');
      return;
    }

    const modal = document.getElementById('modal-cms-form');
    if (!modal) return;

    document.getElementById('cms-title').value = '';
    document.getElementById('cms-ringkasan').value = '';
    document.getElementById('cms-konten').value = '';
    document.getElementById('cms-kategori').value = 'Warta Dakwah';
    document.getElementById('cms-visibility').value = 'PUBLIC';

    modal.classList.remove('hidden');
  }

  function submitCmsForm() {
    const title = document.getElementById('cms-title')?.value.trim();
    const ringkasan = document.getElementById('cms-ringkasan')?.value.trim();
    const konten = document.getElementById('cms-konten')?.value.trim();
    const kategori = document.getElementById('cms-kategori')?.value || 'Warta Dakwah';
    const visibility = document.getElementById('cms-visibility')?.value || 'PUBLIC';

    if (!title || !ringkasan) {
      showToast('Judul dan ringkasan warta wajib diisi!', 'error');
      return;
    }

    const user = Auth.getCurrentUser();
    const db = State.getDb();
    const newWarta = {
      id: 'CMS-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      tenantId: user?.tenantId || 'DPP_PUSAT',
      judul: title,
      kategori: kategori,
      penulis: user?.fullName || 'Humas DPP',
      tanggal: formatTanggal(),
      ringkasan: ringkasan,
      konten: konten || ringkasan,
      status: 'PUBLISHED',
      visibility: visibility,
      views: 1
    };

    db.cms.unshift(newWarta);
    State.saveDatabase();
    State.logAudit('PUBLISH_CMS', 'CMS', newWarta.id, { judul: title, kategori: kategori });

    document.getElementById('modal-cms-form')?.classList.add('hidden');
    showToast('Warta berhasil dipublikasikan dan seketika tayang di Portal Publik!');
    renderCmsSubTab();
  }

  // =========================================================================
  // SMART WHATSAPP RELAY MODAL HELPER
  // =========================================================================
  function showWhatsAppRelayModal(targetName, targetRole, targetPhone, messageText) {
    const modal = document.getElementById('modal-whatsapp-relay');
    if (!modal) return;

    const cleanPhone = String(targetPhone || '').replace(/\D/g, '');
    const displayPhone = cleanPhone ? (cleanPhone.startsWith('62') ? '+' + cleanPhone : cleanPhone) : '-';

    const elName = document.getElementById('wa-relay-target-name');
    const elRole = document.getElementById('wa-relay-target-role');
    const elPhone = document.getElementById('wa-relay-target-phone');
    const elPreview = document.getElementById('wa-relay-preview-text');
    const btnSend = document.getElementById('btn-wa-send-direct');
    const btnCopy = document.getElementById('btn-wa-copy-group');

    if (elName) elName.textContent = targetName;
    if (elRole) elRole.textContent = (targetRole || '').toUpperCase();
    if (elPhone) elPhone.textContent = displayPhone;
    if (elPreview) elPreview.textContent = messageText;

    if (btnSend) {
      btnSend.onclick = () => {
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`, '_blank');
        modal.classList.add('hidden');
      };
    }

    if (btnCopy) {
      btnCopy.onclick = () => {
        navigator.clipboard.writeText(messageText);
        showToast('Naskah WhatsApp berhasil disalin ke clipboard!');
      };
    }

    modal.classList.remove('hidden');
  }

  // =========================================================================
  // KADER ACCESS DENIED MODAL
  // =========================================================================
  function showKaderAccessDeniedModal(acc) {
    const modal = document.getElementById('modal-kader-denied');
    const nameEl = document.getElementById('kader-denied-name');
    if (nameEl) {
      nameEl.textContent = (acc?.fullName || 'Kader Biasa') + ' (Kader Biasa)';
    }
    if (modal) modal.classList.remove('hidden');
  }

  // =========================================================================
  // TENANT SWITCHER MODAL
  // =========================================================================
  function setupTenantSwitcher() {
    const btn = document.getElementById('workspaceSwitchBtn');
    const modal = document.getElementById('modal-tenant-switcher');
    if (!btn || !modal) return;

    btn.addEventListener('click', () => {
      renderTenantSwitcherModal();
      modal.classList.remove('hidden');
    });
  }

  function renderTenantSwitcherModal() {
    const user = Auth.getCurrentUser();
    const notice = document.getElementById('tenant-switcher-locked-notice');
    const list = document.getElementById('tenant-options-list');
    if (!list) return;

    if (!user.isNationalExecutive) {
      if (notice) notice.classList.remove('hidden');
    } else {
      if (notice) notice.classList.add('hidden');
    }

    const wilayahOptions = getWilayahOptionsSafe();
    list.innerHTML = wilayahOptions.map(t => {
      const isCurrent = user.tenantId === t.code;
      const isLocked = !user.isNationalExecutive && !isCurrent;
      return `
        <button type="button" ${isLocked ? 'disabled' : ''} onclick="App.switchTenant('${t.code}')" class="min-h-[44px] p-3 rounded border text-left flex items-center justify-between transition-colors ${
          isCurrent ? 'border-[#064E3B] bg-emerald-50' : isLocked ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200' : 'border-slate-200 hover:bg-slate-50'
        }">
          <div>
            <span class="font-bold text-xs text-slate-900 block">${t.name}</span>
            <span class="text-[10px] text-slate-600">${t.city || t.kota || ''} &bull; ${t.level || (t.code === 'DPP_PUSAT' ? 'DPP' : 'DPW')}</span>
          </div>
          ${isLocked ? '<span class="material-symbols-outlined text-slate-600 text-[18px]">lock</span>' : isCurrent ? '<span class="material-symbols-outlined text-emerald-800 text-[18px]">check_circle</span>' : ''}
        </button>
      `;
    }).join('');
  }

  function switchTenant(tenantCode) {
    const user = Auth.getCurrentUser();
    if (!user.isNationalExecutive && user.tenantId !== tenantCode) {
      showToast('Akses ditolak: Akun pengurus wilayah tidak dapat mengganti yurisdiksi.', 'error');
      return;
    }

    user.tenantId = tenantCode;
    updateHeaderContext();
    renderCurrentWorkspace();
    document.getElementById('modal-tenant-switcher')?.classList.add('hidden');
    showToast(`Wilayah kerja beralih ke: ${tenantCode}`);
  }

  return {
    init,
    showToast,
    closeModal,
    openConfirmDialog,
    printTarget,
    switchWorkspace,
    openDrawer,
    closeDrawer,
    onSessionChanged,
    onSessionLoggedOut,
    handleLoginSubmit,
    toggleLoginPasswordVisibility,
    prefillLoginUsername,
    switchTenant,

    // Surat & SK
    approveSurat,
    rejectSurat,
    submitRejectSurat,
    revisiSurat,
    previewSuratA4,
    buildA4DocumentHtml,
    submitSuratComposer,
    openSkGeneratorModal,
    submitSkGenerator,

    // Disposisi
    approveDisposisiKetua,
    submitLaporanDisposisi,
    openTambahSuratMasukModal,
    closeTambahSuratMasukModal,
    setSmAsalChip,
    setSmRekomendasiChip,
    submitTambahSuratMasukModal,

    // Kas
    openTambahBkmModal,
    openTambahBkkModal,
    evaluateKasFormGuards,
    submitKasForm,
    verifyKasBendahara,
    approveKasKetua,
    openKasSimulatorModal,
    recalculateKasSimulator,
    openClosingModal,
    executePsakClosing,
    openKwitansiModal,

    // Proker
    ajukanPencairanProker,
    unggahLpjProker,
    submitProkerAction,
    setujuiPaguProker,
    openTambahProkerModal,
    closeTambahProkerModal,
    submitTambahProkerModal,
    onProkerDivisiChange,
    applyProkerTemplate,
    setProkerRabChip,
    onProkerRabInput,

    // Keanggotaan
    verifyKtaSekretaris,
    approveKtaKetua,
    openKtpViewerModal,
    approveKtaFromViewer,
    openKtaModal,
    flipKtaCard,
    downloadKtaPngHd,

    // Advokasi & Tabayyun
    switchAdvokasiSubTab,
    terbitkanSuratTugasLbh,
    siarkanTabayyunWa,
    openTambahAdvokasiModal,
    submitAdvokasiForm,

    // Muallaf, Presensi & Aset
    switchMuallafSubTab,
    openSyahadatModal,
    openAssetQrModal,
    openTambahMuallafModal,
    submitMuallafForm,
    openScannerPresensiModal,
    submitScannerPresensi,

    // Maktabah, Konsultasi & Risalah
    switchMaktabahSubTab,
    copyMaktabahDalil,
    answerConsultation,
    openTambahRisalahModal,
    submitRisalahForm,
    dispatchRisalahAction,

    // Sistem & Superadmin Omnipresence
    switchSistemSubTab,
    switchIamView,
    onUserFormRoleChanged,
    openRegistrasiDpwBaruModal: openTambahWilayahModal,
    openTambahWilayahModal,
    submitWilayahForm,
    openUserModal,
    submitUserForm,
    toggleUserStatus,
    openResetPasswordModal,
    generateRandomTempPassword,
    copyTempPassword,
    submitResetPassword,
    openDeadlockBreakerModal,
    submitDeadlockBreaker,
    saveMasterSettings,
    switchSettingsScope,
    syncSettingsPreview,
    resetSettingsToDefault,
    handleImageFileUpload,
    updateUploadThumbnail,
    clearUploadedImage,
    toggleTtdUploadView,
    toggleStempelUploadView,
    revokeSession,
    revokeAllOtherSessions,
    openTambahWartaCmsModal,
    submitCmsForm,
    broadcastCmsWa,
    filterAuditLogs,

    // WhatsApp Relay & Kader Security Gate
    showWhatsAppRelayModal,
    showKaderAccessDeniedModal
  };
})();

if (typeof window !== 'undefined') {
  window.App = App;
}

// Auto-run pada boot (tangani kasus DOMContentLoaded sudah terlewat atau belum)
if (typeof document !== 'undefined') {
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    App.init();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      App.init();
    });
  }
}
