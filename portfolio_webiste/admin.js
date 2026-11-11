// Admin panel v58 — full rebuild to match the MK reference images.
// Hash routes: #admin_login, #admin_forgot, #admin (Dashboard),
// #admin_contacts, #admin_analytics, #admin_users, #admin_resume,
// #admin_settings, #admin_activity, #admin_profile (via header chip).
// Contact detail is a view state inside Contacts, not a hash.
// Status vocabulary: New / In Progress / Responded / Closed.
// The admin talks to the same Google Apps Script backend as the contact
// form (FORM_ENDPOINT). The password is never in this file — login is
// verified server-side. A session token (from login) is kept in
// sessionStorage only, with the role and username for the header chip
// and for role-gated screens (Users = Super Admin only).
(function () {
  'use strict';

  var ENDPOINT = window.FORM_ENDPOINT ||
    'https://script.google.com/macros/s/AKfycbxIXwrvVjy5i5B5rwu5DCjZE12g5bqf8wruhVQ_IW7CvMUZ6FcG_c9mDTicn_Jk6JB-/exec';
  var TOKEN_KEY = 'adminToken';
  var ROLE_KEY = 'adminRole';
  var NAME_KEY = 'adminName';
  var USER_KEY = 'adminUser';
  var MAX_CV_BYTES = 5 * 1024 * 1024; // 5 MB
  var BUILTIN_CV = 'Mohamad_Kaifoddin_AI_ML_Engineer_1-3Yrs.pdf';

  var root = null;
  var messages = [];
  var messagesLoaded = false;
  var lastSyncAt = null;
  var lastLoadError = '';
  var users = [];
  var resumes = [];
  var activityLogs = [];
  var settingsCache = null;
  var currentTab = 'dashboard';
  var detailId = null;      // contact detail view state (submissionId)
  var detailEdit = false;   // detail view shows the edit form
  var selectedId = null;    // add/edit form state
  var settingsTab = 'general';

  // Contacts filters + pagination.
  var cFilter = { text: '', purpose: 'All', status: 'All', start: '', end: '', page: 1, perPage: 5, selected: {} };
  // Dashboard / Analytics date ranges: '7' | '30' | '90' | '180' | 'custom'.
  var dashRange = '30', dashStart = '', dashEnd = '';
  var anRange = '30', anStart = '', anEnd = '';

  var STATUSES = ['New', 'In Progress', 'Responded', 'Closed'];
  var PURPOSES = ['Job Opportunity', 'Project Discussion', 'Collaboration', 'General Inquiry', 'Other'];
  var PURPOSE_COLORS = {
    'Job Opportunity': '#e8112d',
    'Project Discussion': '#3b82f6',
    'Collaboration': '#f59e0b',
    'General Inquiry': '#22c55e',
    'Other': '#8b5cf6'
  };
  var STATUS_COLORS = {
    'New': '#e8112d',
    'In Progress': '#f59e0b',
    'Responded': '#22c55e',
    'Closed': '#9ca3af'
  };
  var RESPONSE_TEMPLATES = {
    'Default Template': '',
    'Short & Professional': 'Hi {name},\n\nThank you for reaching out. I appreciate your message and will get back to you shortly.\n\nBest regards,\nMohamad Kaifoddin',
    'Detailed': 'Hi {name},\n\nThank you for your message about {purpose}. I have read it carefully and would be glad to discuss this further. Please share any additional details, or let me know a time that works for a quick call.\n\nBest regards,\nMohamad Kaifoddin\nAI/ML Engineer'
  };

  function isAdminHash() {
    var h = location.hash || '';
    return h === '#admin_login' || h === '#admin_forgot' ||
      h === '#admin' || h.indexOf('#admin_') === 0;
  }

  function store(k, v) {
    try { sessionStorage.setItem(k, v); } catch (e) {}
  }
  function readStore(k) {
    try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; }
  }
  function getToken() { return readStore(TOKEN_KEY); }
  function setToken(t) { store(TOKEN_KEY, t); }
  function getRole() { return readStore(ROLE_KEY) || 'Super Admin'; }
  function getAdminName() { return readStore(NAME_KEY) || 'MK Admin'; }
  function getAdminUser() { return readStore(USER_KEY); }
  function isSuperAdmin() { return getRole() === 'Super Admin'; }
  function canWrite() { return getRole() !== 'Viewer'; }
  function clearSession() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(ROLE_KEY);
      sessionStorage.removeItem(NAME_KEY);
      sessionStorage.removeItem(USER_KEY);
    } catch (e) {}
  }

  function api(action, payload) {
    var body = { action: action };
    if (payload) {
      for (var k in payload) body[k] = payload[k];
    }
    if (action !== 'adminLogin' && action !== 'adminRequestOtp' &&
        action !== 'adminResetPassword') {
      body.token = getToken();
    }
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body)
    }).then(function (res) { return res.json(); });
  }

  // Fire-and-forget activity calls (adminLogView / adminLogExport /
  // adminLogout) — never block the UI on them.
  function fire(action, payload) {
    api(action, payload).catch(function () {});
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function go(hash) { location.hash = hash; }

  function enterAdminMode() {
    document.body.classList.add('admin-mode');
    if (root) root.hidden = false;
  }
  function exitAdminMode() {
    document.body.classList.remove('admin-mode');
    if (root) root.hidden = true;
  }

  function notLoggedIn(r) {
    if (r && r.error === 'not logged in') { clearSession(); go('#admin_login'); return true; }
    return false;
  }
  function notPermitted(r) {
    return !!(r && r.error === 'not permitted');
  }

  // Map legacy status values (v57) to the v58 vocabulary, defensively.
  function normStatus(s) {
    if (s === 'Read') return 'In Progress';
    if (s === 'Replied') return 'Responded';
    if (STATUSES.indexOf(s) !== -1) return s;
    return s || 'New';
  }
  function normMessage(m) {
    if (!m) return m;
    m.status = normStatus(m.status);
    return m;
  }

  function parseMsgDate(m) {
    // 'yyyy-MM-dd' + optional time — parse as local midnight to avoid TZ shifts.
    var d = (m.date || '').slice(0, 10);
    if (!d) return null;
    var parts = d.split('-');
    if (parts.length !== 3) return null;
    return new Date(+parts[0], +parts[1] - 1, +parts[2]);
  }
  function dateKey(d) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function todayKey() { return dateKey(new Date()); }
  function addDays(d, n) { var c = new Date(d); c.setDate(c.getDate() + n); return c; }

  function fmtDateLong(iso) {
    if (!iso) return '—';
    var d = new Date(iso.slice(0, 10) + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtTime12(t) {
    if (!t) return '';
    var p = String(t).split(':');
    var h = +p[0], m = p[1] || '00';
    var ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return h + ':' + m + ' ' + ap;
  }
  function fmtDateTime(m) {
    return fmtDateLong(m.date) + (m.time ? ' ' + fmtTime12(m.time) : '');
  }
  function fmtSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  function fmtDays(n) {
    if (n == null || isNaN(n)) return '—';
    return (Math.round(n * 10) / 10) + ' Days';
  }

  function pill(text, kind) {
    return '<span class="admin-pill admin-pill-' + kind + '">' + esc(text) + '</span>';
  }
  function statusPill(s) {
    var k = normStatus(s).toLowerCase().replace(/ /g, '');
    return pill(normStatus(s), k);
  }
  function rolePill(role) {
    var k = (role || '').toLowerCase().replace(/ /g, '');
    return pill(role || 'Admin', k);
  }

  // ---------- login / forgot password (matches the glowing login image) ----------

  function viewLogin() {
    root.innerHTML =
      '<div class="admin-login-page">' +
      '<div class="admin-login-bg" aria-hidden="true">' +
      '<span class="admin-login-dots admin-login-dots-tl"></span>' +
      '<span class="admin-login-dots admin-login-dots-br"></span>' +
      '<span class="admin-login-wave"></span>' +
      '</div>' +
      '<div class="admin-login-card">' +
      '<div class="admin-login-logo"><span class="mk-m">M</span><span class="mk-k">K</span></div>' +
      '<h1>Portfolio <span>Admin Panel</span></h1>' +
      '<p class="admin-login-sub"><span class="admin-login-line"></span>Login to manage your portfolio<span class="admin-login-line"></span></p>' +
      '<form id="loginForm" novalidate>' +
      '<div class="admin-field"><span class="admin-field-ic">✉</span>' +
      '<input type="email" id="loginUser" required autocomplete="username" placeholder="Email Address"></div>' +
      '<div class="admin-field"><span class="admin-field-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>' +
      '<input type="password" id="loginPass" required autocomplete="current-password" placeholder="Password">' +
      '<button type="button" class="admin-eye" id="loginEye">Show</button></div>' +
      '<p class="admin-msg" id="loginMsg"></p>' +
      '<button class="admin-btn admin-btn-login" type="submit"><span>→</span> Login to Admin Panel</button>' +
      '</form>' +
      '<p class="admin-link"><a href="#admin_forgot">Forgot password?</a></p>' +
      '<p class="admin-back"><a href="#home">&larr; Back to portfolio</a></p>' +
      '</div></div>';
    var pass = document.getElementById('loginPass');
    document.getElementById('loginEye').addEventListener('click', function () {
      var show = pass.type === 'password';
      pass.type = show ? 'text' : 'password';
      this.textContent = show ? 'Hide' : 'Show';
    });
    document.getElementById('loginForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var msg = document.getElementById('loginMsg');
      var user = document.getElementById('loginUser').value.trim();
      if (!user || !pass.value) { msg.textContent = 'Enter your email and password.'; return; }
      msg.textContent = 'Signing in…';
      api('adminLogin', { username: user, password: pass.value }).then(function (r) {
        if (r && r.ok && r.token) {
          setToken(r.token);
          store(ROLE_KEY, r.role || 'Super Admin');
          store(NAME_KEY, r.name || user.split('@')[0].replace(/[._]/g, ' ') || 'MK Admin');
          store(USER_KEY, user);
          go('#admin');
        } else {
          var err = (r && r.error) || 'Login failed. Try again.';
          if (/lock|many|attempt/i.test(err)) {
            msg.textContent = 'Too many failed attempts. Try again in 15 minutes.';
          } else {
            msg.textContent = err;
          }
        }
      }).catch(function () {
        msg.textContent = 'Could not reach the server. Check your connection and try again.';
      });
    });
  }

  function viewForgot() {
    root.innerHTML =
      '<div class="admin-login-page">' +
      '<div class="admin-login-bg" aria-hidden="true">' +
      '<span class="admin-login-dots admin-login-dots-tl"></span>' +
      '<span class="admin-login-dots admin-login-dots-br"></span>' +
      '<span class="admin-login-wave"></span>' +
      '</div>' +
      '<div class="admin-login-card">' +
      '<div class="admin-login-logo"><span class="mk-m">M</span><span class="mk-k">K</span></div>' +
      '<h1>Forgot <span>Password</span></h1>' +
      '<p class="admin-login-sub"><span class="admin-login-line"></span>We will email a one-time code to your admin email<span class="admin-login-line"></span></p>' +
      '<form id="otpReqForm" novalidate>' +
      '<div class="admin-field"><span class="admin-field-ic">✉</span>' +
      '<input type="email" id="otpUser" required autocomplete="username" placeholder="Email Address"></div>' +
      '<p class="admin-msg" id="otpMsg"></p>' +
      '<button class="admin-btn admin-btn-login" type="submit">Send Code</button>' +
      '</form>' +
      '<form id="otpResetForm" hidden novalidate>' +
      '<div class="admin-field"><span class="admin-field-ic">#</span>' +
      '<input type="text" id="otpCode" required inputmode="numeric" maxlength="6" placeholder="6-digit code"></div>' +
      '<div class="admin-field"><span class="admin-field-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>' +
      '<input type="password" id="otpNew" required minlength="6" autocomplete="new-password" placeholder="New password (at least 6 characters)"></div>' +
      '<p class="admin-msg" id="otpResetMsg"></p>' +
      '<button class="admin-btn admin-btn-login" type="submit">Reset Password</button>' +
      '</form>' +
      '<p class="admin-link"><a href="#admin_login">Back to login</a></p>' +
      '</div></div>';
    var user = '';
    document.getElementById('otpReqForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      user = document.getElementById('otpUser').value.trim();
      var msg = document.getElementById('otpMsg');
      if (!user) { msg.textContent = 'Enter your admin email.'; return; }
      msg.textContent = 'Sending code…';
      api('adminRequestOtp', { username: user }).then(function (r) {
        if (r && r.ok) {
          msg.textContent = 'Code sent. Check your email.';
          document.getElementById('otpResetForm').hidden = false;
        } else {
          msg.textContent = (r && r.error) || 'Could not send the code.';
        }
      }).catch(function () {
        msg.textContent = 'Could not reach the server. Try again.';
      });
    });
    document.getElementById('otpResetForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var msg = document.getElementById('otpResetMsg');
      var np = document.getElementById('otpNew').value;
      if (np.length < 6) { msg.textContent = 'Password must be at least 6 characters.'; return; }
      msg.textContent = 'Resetting…';
      api('adminResetPassword', {
        username: user,
        otp: document.getElementById('otpCode').value.trim(),
        newPassword: np
      }).then(function (r) {
        if (r && r.ok) {
          msg.textContent = 'Password reset. You can log in now.';
          setTimeout(function () { go('#admin_login'); }, 1200);
        } else {
          msg.textContent = (r && r.error) || 'Reset failed.';
        }
      }).catch(function () {
        msg.textContent = 'Could not reach the server. Try again.';
      });
    });
  }

  // ---------- modal overlay ----------

  function openModal(html) {
    var m = document.getElementById('modalRoot');
    if (!m) return;
    m.innerHTML = '<div class="admin-modal-overlay" id="modalOverlay"><div class="admin-modal">' + html + '</div></div>';
    document.getElementById('modalOverlay').addEventListener('click', function (ev) {
      if (ev.target === this) closeModal();
    });
  }
  function closeModal() {
    var m = document.getElementById('modalRoot');
    if (m) m.innerHTML = '';
  }
  function modalMsg(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text || '';
  }

  // ---------- SVG charts (hand-built, no libraries) ----------

  function lineChartSVG(series) {
    // series: [{d:'yyyy-MM-dd', n}] sorted by date, zeros filled.
    if (!series || !series.length) {
      return '<p class="admin-msg">No data in this range.</p>';
    }
    var W = 620, H = 230, PL = 34, PR = 10, PT = 12, PB = 26;
    var max = 1;
    series.forEach(function (s) { if (s.n > max) max = s.n; });
    max = Math.max(max, 5);
    var iw = W - PL - PR, ih = H - PT - PB;
    function X(i) { return series.length <= 1 ? PL + iw / 2 : PL + i * iw / (series.length - 1); }
    function Y(v) { return PT + ih - (v / max) * ih; }
    var pts = series.map(function (s, i) { return X(i).toFixed(1) + ',' + Y(s.n).toFixed(1); }).join(' ');
    var area = 'M' + X(0).toFixed(1) + ',' + Y(0) + ' L' +
      series.map(function (s, i) { return X(i).toFixed(1) + ' ' + Y(s.n).toFixed(1); }).join(' L') +
      ' L' + X(series.length - 1).toFixed(1) + ',' + Y(0) + ' Z';
    var grid = [0, Math.round(max / 2), max].map(function (v) {
      return '<line x1="' + PL + '" y1="' + Y(v) + '" x2="' + (W - PR) + '" y2="' + Y(v) + '" stroke="#222226" stroke-width="1"/>' +
        '<text x="' + (PL - 6) + '" y="' + (Y(v) + 4) + '" fill="#8a8578" font-size="10" text-anchor="end">' + v + '</text>';
    }).join('');
    var labelIdx = [];
    var step = Math.max(1, Math.floor(series.length / 5));
    for (var i = 0; i < series.length; i += step) labelIdx.push(i);
    if (labelIdx[labelIdx.length - 1] !== series.length - 1) labelIdx.push(series.length - 1);
    var xlabels = labelIdx.map(function (i) {
      var d = series[i].d;
      return '<text x="' + X(i).toFixed(1) + '" y="' + (H - 8) + '" fill="#8a8578" font-size="10" text-anchor="middle">' +
        esc(d.slice(5).replace('-', '/')) + '</text>';
    }).join('');
    var dots = series.map(function (s, i) {
      return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(s.n).toFixed(1) + '" r="3" fill="#e8112d"/>';
    }).join('');
    return '<svg class="admin-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Enquiries over time">' +
      '<defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#e8112d" stop-opacity="0.45"/>' +
      '<stop offset="100%" stop-color="#e8112d" stop-opacity="0.02"/></linearGradient></defs>' +
      grid + '<path d="' + area + '" fill="url(#areaGrad)"/>' +
      '<polyline points="' + pts + '" fill="none" stroke="#e8112d" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      dots + xlabels + '</svg>';
  }

  function donutSVG(segments, centerValue, centerLabel) {
    // segments: [{label, value, color}]
    var total = 0;
    segments.forEach(function (s) { total += s.value || 0; });
    var r = 62, C = 2 * Math.PI * r;
    var circles = '';
    if (!total) {
      circles = '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="#2a2a2e" stroke-width="26"/>';
    } else {
      var offset = 0;
      segments.forEach(function (s) {
        if (!s.value) return;
        var len = s.value / total * C;
        circles += '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="' + s.color +
          '" stroke-width="26" stroke-dasharray="' + Math.max(len - 1.5, 0).toFixed(1) + ' ' + (C - len + 1.5).toFixed(1) +
          '" stroke-dashoffset="' + (-offset).toFixed(1) + '" transform="rotate(-90 90 90)"/>';
        offset += len;
      });
    }
    return '<svg class="admin-donut" viewBox="0 0 180 180" role="img" aria-label="Distribution">' +
      circles +
      '<text x="90" y="86" fill="#fff" font-size="26" font-weight="800" text-anchor="middle">' + esc(String(centerValue)) + '</text>' +
      '<text x="90" y="106" fill="#b9b3a8" font-size="11" text-anchor="middle">' + esc(centerLabel) + '</text>' +
      '</svg>';
  }

  function legendHTML(segments, total) {
    return '<ul class="admin-legend">' + segments.map(function (s) {
      var pct = total ? Math.round(s.value / total * 100) : 0;
      return '<li><span class="admin-legend-dot" style="background:' + s.color + '"></span>' +
        '<span class="admin-legend-label">' + esc(s.label) + '</span>' +
        '<span class="admin-legend-val">' + s.value + ' · ' + pct + '%</span></li>';
    }).join('') + '</ul>';
  }

  function barRowsHTML(items) {
    var max = 1;
    items.forEach(function (it) { if (it.value > max) max = it.value; });
    return '<div class="admin-bars">' + items.map(function (it) {
      var pct = Math.round(it.value / max * 100);
      return '<div class="admin-bar-row"><span class="admin-bar-label">' + esc(it.label) + '</span>' +
        '<div class="admin-bar-track"><div class="admin-bar-fill" style="width:' + pct + '%;background:' + it.color + '"></div></div>' +
        '<span class="admin-bar-val">' + it.value + '</span></div>';
    }).join('') + '</div>';
  }

  // ---------- date ranges ----------

  function rangeBounds(range, startInput, endInput) {
    var end = new Date();
    end.setHours(0, 0, 0, 0);
    var start;
    if (range === 'custom' && startInput && endInput) {
      start = new Date(startInput + 'T00:00:00');
      end = new Date(endInput + 'T00:00:00');
    } else {
      var days = range === '7' ? 7 : range === '90' ? 90 : range === '180' ? 180 : 30;
      start = addDays(end, -(days - 1));
    }
    if (isNaN(start) || isNaN(end) || start > end) return null;
    return { start: start, end: end };
  }
  function inRange(m, b) {
    var d = parseMsgDate(m);
    return d && b && d >= b.start && d <= b.end;
  }
  function dailySeries(list, b) {
    var map = {};
    list.forEach(function (m) {
      var d = parseMsgDate(m);
      if (!d || d < b.start || d > b.end) return;
      var k = dateKey(d);
      map[k] = (map[k] || 0) + 1;
    });
    var out = [];
    for (var d = new Date(b.start); d <= b.end; d = addDays(d, 1)) {
      var k = dateKey(d);
      out.push({ d: k, n: map[k] || 0 });
    }
    return out;
  }
  function purposeOf(m) {
    var p = m.purpose || '';
    if (PURPOSES.indexOf(p) !== -1) return p;
    return 'Other';
  }

  // ---------- messages loader (shared cache) ----------

  function ensureMessages(cb) {
    if (messagesLoaded) { cb(true); return; }
    loadMessagesData(cb);
  }
  function loadMessagesData(cb) {
    api('adminListMessages', {}).then(function (r) {
      if (!r || !r.ok) {
        if (notLoggedIn(r)) { cb(false); return; }
        lastLoadError = (r && r.error) || 'Could not load messages.';
        cb(false);
        return;
      }
      messages = (r.messages || []).map(normMessage);
      messagesLoaded = true;
      lastSyncAt = new Date();
      lastLoadError = '';
      updateNavBadge();
      cb(true);
    }).catch(function () {
      lastLoadError = 'Could not reach the server.';
      cb(false);
    });
  }
  function refreshMessages(cb) {
    messagesLoaded = false;
    loadMessagesData(cb || function () {});
  }

  // ---------- sidebar shell ----------

  var TABS = [
    { id: 'dashboard', hash: '#admin', label: 'Dashboard', icon: '▦' },
    { id: 'contacts', hash: '#admin_contacts', label: 'Contacts', icon: '✉' },
    { id: 'analytics', hash: '#admin_analytics', label: 'Analytics', icon: '▧' },
    { id: 'users', hash: '#admin_users', label: 'Users', icon: '◉', superAdmin: true },
    { id: 'resume', hash: '#admin_resume', label: 'Resume Management', icon: '▤' },
    { id: 'settings', hash: '#admin_settings', label: 'Settings', icon: '⚙' },
    { id: 'activity', hash: '#admin_activity', label: 'Activity Logs', icon: '◷' }
  ];
  var TITLES = {
    dashboard: 'Dashboard',
    contacts: 'Contacts / Enquiries',
    analytics: 'Analytics',
    users: 'Users',
    resume: 'Resume Management',
    settings: 'Settings',
    activity: 'Activity Logs',
    profile: 'Profile'
  };
  var SUBTITLES = {
    dashboard: 'Overview of your portfolio contacts and activities',
    contacts: 'Manage and track all form submissions',
    analytics: 'Insights from your portfolio enquiries',
    users: 'Manage admin users and access',
    resume: 'Update your CV, manage versions and publish the latest resume on your website',
    settings: 'Manage application and website settings',
    activity: 'Record of administrator actions',
    profile: 'Your public identity on the portfolio'
  };

  function navItem(t) {
    var badge = '';
    if (t.id === 'contacts') {
      badge = '<span class="admin-nav-badge" id="navMsgBadge" hidden></span>';
    }
    return '<a href="' + t.hash + '" class="admin-nav-item' +
      (currentTab === t.id ? ' active' : '') + '">' +
      '<span class="admin-nav-icon">' + t.icon + '</span>' +
      '<span class="admin-nav-label">' + t.label + '</span>' + badge + '</a>';
  }

  function rangeSelectHTML(id, value, options) {
    return '<select class="admin-range" id="' + id + '">' +
      options.map(function (o) {
        return '<option value="' + o[0] + '"' + (value === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select>';
  }

  function dashboardShell(inner, opts) {
    opts = opts || {};
    var today = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    var visibleTabs = TABS.filter(function (t) { return !t.superAdmin || isSuperAdmin(); });
    var rangeHtml = '';
    if (opts.range) {
      rangeHtml = rangeSelectHTML('headerRange', opts.rangeValue,
        opts.rangeOptions || [['7', 'Last 7 Days'], ['30', 'Last 30 Days'], ['90', 'Last 3 Months'], ['custom', 'Custom Range']]);
    }
    return '<div class="admin-shell">' +
      '<aside class="admin-sidebar" id="adminSidebar">' +
      '<div class="admin-side-brand">' +
      '<span class="admin-logo admin-logo-sm"><span class="mk-m">M</span><span class="mk-k">K</span></span>' +
      '<div class="admin-side-brand-text"><strong>MK Admin Panel</strong></div>' +
      '</div>' +
      '<nav class="admin-nav">' + visibleTabs.map(navItem).join('') + '</nav>' +
      '<div class="admin-side-foot">' +
      '<a href="#home" class="admin-side-link">&larr; Back to Website</a>' +
      '<button class="admin-btn admin-btn-ghost admin-logout" id="logoutBtn">Log Out</button>' +
      '</div>' +
      '</aside>' +
      '<div class="admin-main-wrap">' +
      '<header class="admin-header">' +
      '<button class="admin-menu-btn" id="sideToggle" type="button" aria-label="Toggle menu">☰</button>' +
      '<div class="admin-header-title"><h2>' + (TITLES[currentTab] || 'Dashboard') + '</h2>' +
      '<p>' + (SUBTITLES[currentTab] || '') + '</p></div>' +
      rangeHtml +
      '<button class="admin-bell" id="bellBtn" type="button" title="New enquiries">✉<span class="admin-bell-badge" id="bellBadge" hidden></span></button>' +
      '<button class="admin-user-chip" id="userChip" type="button" title="Open Profile">' +
      '<span class="admin-user-avatar">' + esc(getAdminName().slice(0, 1).toUpperCase()) + '</span>' +
      '<span class="admin-user-text"><strong>' + esc(getAdminName()) + '</strong><span>' + esc(getRole()) + '</span></span>' +
      '</button>' +
      '</header>' +
      '<main class="admin-main">' + inner + '</main>' +
      '</div>' +
      '<div id="modalRoot"></div>' +
      '</div>';
  }

  function bindShell() {
    document.getElementById('logoutBtn').addEventListener('click', function () {
      fire('adminLogout', {});
      clearSession();
      messagesLoaded = false;
      messages = [];
      go('#admin_login');
    });
    document.getElementById('sideToggle').addEventListener('click', function () {
      document.getElementById('adminSidebar').classList.toggle('open');
    });
    root.querySelectorAll('.admin-nav-item').forEach(function (a) {
      a.addEventListener('click', function () {
        document.getElementById('adminSidebar').classList.remove('open');
        // Clicking the Contacts nav item while viewing a detail returns
        // to the list (the hash is already #admin_contacts, so no
        // hashchange would fire on its own).
        if (a.getAttribute('href') === location.hash && currentTab === 'contacts') {
          detailId = null;
          detailEdit = false;
          renderContactsTab();
        }
      });
    });
    document.getElementById('bellBtn').addEventListener('click', function () {
      cFilter.status = 'New';
      cFilter.page = 1;
      detailId = null;
      detailEdit = false;
      if (location.hash === '#admin_contacts') renderContactsTab();
      else go('#admin_contacts');
    });
    document.getElementById('userChip').addEventListener('click', function () {
      go('#admin_profile');
    });
    updateNavBadge();
  }

  function updateNavBadge() {
    var n = messages.filter(function (m) { return m.status === 'New'; }).length;
    var b = document.getElementById('navMsgBadge');
    if (b) {
      if (n > 0) { b.hidden = false; b.textContent = n; } else { b.hidden = true; }
    }
    var bell = document.getElementById('bellBadge');
    if (bell) {
      if (n > 0) { bell.hidden = false; bell.textContent = n; } else { bell.hidden = true; }
    }
  }

  function bindHeaderRange(onChange) {
    var sel = document.getElementById('headerRange');
    if (sel) {
      sel.addEventListener('change', function () { onChange(sel.value); });
    }
  }

  function renderTab() {
    if (!getToken()) { go('#admin_login'); return; }
    if (currentTab === 'contacts') { renderContactsTab(); return; }
    if (currentTab === 'analytics') { renderAnalyticsTab(); return; }
    if (currentTab === 'users') {
      if (!isSuperAdmin()) { go('#admin'); return; }
      renderUsersTab(); return;
    }
    if (currentTab === 'resume') { renderResumeTab(); return; }
    if (currentTab === 'settings') { renderSettingsTab(); return; }
    if (currentTab === 'activity') { renderActivityTab(); return; }
    if (currentTab === 'profile') { renderProfileTab(); return; }
    renderDashboardTab();
  }

  // ---------- router ----------

  function route() {
    if (!root) return;
    var h = location.hash || '';
    if (!isAdminHash()) { exitAdminMode(); return; }
    enterAdminMode();
    window.scrollTo(0, 0);
    if (h === '#admin_login') {
      if (getToken()) { go('#admin'); return; }
      viewLogin();
    } else if (h === '#admin_forgot') {
      viewForgot();
    } else if (h === '#admin' || h === '#admin_contacts' || h === '#admin_analytics' ||
               h === '#admin_users' || h === '#admin_resume' || h === '#admin_settings' ||
               h === '#admin_activity' || h === '#admin_profile' || h === '#admin_messages') {
      if (!getToken()) { go('#admin_login'); return; }
      if (h === '#admin_messages') { go('#admin_contacts'); return; }
      currentTab = h === '#admin' ? 'dashboard' : h.replace('#admin_', '');
      if (currentTab !== 'contacts') { detailId = null; detailEdit = false; }
      renderTab();
    }
  }

  // ---------- dashboard tab ----------

  function statCard(n, label, tone, icon) {
    return '<div class="admin-stat' + (tone ? ' admin-stat-' + tone : '') + '">' +
      '<span class="admin-stat-ic">' + (icon || '▦') + '</span>' +
      '<span class="admin-stat-num">' + n + '</span>' +
      '<span class="admin-stat-label">' + label + '</span></div>';
  }

  function customRangeRow(range, startVal, endVal, prefix) {
    if (range !== 'custom') return '';
    return '<div class="admin-custom-range">' +
      '<label>Start <input type="date" id="' + prefix + 'Start" value="' + esc(startVal || '') + '"></label>' +
      '<label>End <input type="date" id="' + prefix + 'End" value="' + esc(endVal || '') + '"></label>' +
      '<button class="admin-btn admin-btn-red admin-btn-sm" type="button" id="' + prefix + 'Apply">Apply</button>' +
      '</div>';
  }

  function renderDashboardTab() {
    root.innerHTML = dashboardShell(
      '<p class="admin-welcome">Welcome back, <strong>' + esc(getAdminName()) + '</strong>. Here is what is happening on your portfolio.</p>' +
      customRangeRow(dashRange, dashStart, dashEnd, 'dash') +
      '<div class="admin-stats" id="dashStats"><p class="admin-msg">Loading stats…</p></div>' +
      '<div class="admin-dash-grid2">' +
      '<section class="admin-panel"><h3>Enquiries Over Time</h3><div id="dashTrend"><p class="admin-msg">Loading…</p></div></section>' +
      '<section class="admin-panel"><h3>By Purpose</h3><div class="admin-donut-wrap" id="dashDonut"><p class="admin-msg">Loading…</p></div></section>' +
      '</div>' +
      '<div class="admin-dash-grid">' +
      '<section class="admin-panel"><h3>Recent messages</h3><div id="dashRecent"><p class="admin-msg">Loading…</p></div>' +
      '<p><a class="admin-link" href="#admin_contacts">View all messages →</a></p></section>' +
      '<section class="admin-panel"><h3>Resume</h3><div id="dashCv"><p class="admin-msg">Loading…</p></div>' +
      '<p><a class="admin-link" href="#admin_resume">Manage resume →</a></p></section>' +
      '<section class="admin-panel"><h3>Quick actions</h3>' +
      '<div class="admin-actions">' +
      '<a class="admin-btn admin-btn-red" href="#admin_contacts">+ Add Message</a>' +
      '<a class="admin-btn admin-btn-ghost" href="#admin_resume">Upload CV</a>' +
      '<button class="admin-btn admin-btn-ghost" id="dashExportBtn" type="button">Export CSV</button>' +
      '<a class="admin-btn admin-btn-ghost" href="#home" target="_blank" rel="noopener">View Live Site</a>' +
      '</div>' +
      '<h3 class="admin-h3">Notifications</h3><div id="dashNotify"><p class="admin-msg">Loading…</p></div>' +
      '</section>' +
      '</div>',
      { range: true, rangeValue: dashRange }
    );
    bindShell();
    bindHeaderRange(function (v) {
      dashRange = v;
      if (v !== 'custom') { dashStart = ''; dashEnd = ''; }
      renderDashboardTab();
    });
    var da = document.getElementById('dashApply');
    if (da) {
      da.addEventListener('click', function () {
        dashStart = document.getElementById('dashStart').value;
        dashEnd = document.getElementById('dashEnd').value;
        renderDashboardTab();
      });
    }
    document.getElementById('dashExportBtn').addEventListener('click', exportCsv);
    loadDashboard();
  }

  function loadDashboard() {
    ensureMessages(function (ok) {
      var b = rangeBounds(dashRange, dashStart, dashEnd);
      var list = ok && b ? messages.filter(function (m) { return inRange(m, b); }) : [];
      var s = document.getElementById('dashStats');
      if (s) {
        if (!ok) {
          s.innerHTML = '<p class="admin-msg">' + esc(lastLoadError || 'Could not load messages.') + '</p>';
        } else {
          var n = { total: list.length, New: 0, Responded: 0, 'In Progress': 0, Closed: 0 };
          list.forEach(function (m) { if (n[m.status] !== undefined) n[m.status]++; });
          s.innerHTML = statCard(n.total, 'Total Enquiries', '', '✉') +
            statCard(n.New, 'New Enquiries', 'red', '✦') +
            statCard(n.Responded, 'Responded', 'green', '✓') +
            statCard(n['In Progress'], 'In Progress', 'amber', '◷') +
            statCard(n.Closed, 'Closed', '', '✕');
        }
      }
      var tr = document.getElementById('dashTrend');
      if (tr) {
        tr.innerHTML = ok && b ? lineChartSVG(dailySeries(list, b)) : '<p class="admin-msg">No data in this range.</p>';
      }
      var dn = document.getElementById('dashDonut');
      if (dn) {
        var counts = {};
        PURPOSES.forEach(function (p) { counts[p] = 0; });
        list.forEach(function (m) { counts[purposeOf(m)]++; });
        var segs = PURPOSES.map(function (p) {
          return { label: p, value: counts[p], color: PURPOSE_COLORS[p] };
        });
        dn.innerHTML = '<div class="admin-donut-flex">' + donutSVG(segs, list.length, 'Total') +
          legendHTML(segs, list.length) + '</div>';
      }
      var rec = document.getElementById('dashRecent');
      if (rec) {
        if (!messages.length) {
          rec.innerHTML = '<p class="admin-msg">No messages yet. New form submissions will appear here.</p>';
        } else {
          rec.innerHTML = '<ul class="admin-recent">' + messages.slice(0, 5).map(function (m) {
            return '<li><a href="#admin_contacts"><strong>' + esc(m.name) + '</strong>' +
              '<span>' + esc(m.purpose || '') + ' · ' + esc(m.date || '') + '</span>' +
              statusPill(m.status) + '</a></li>';
          }).join('') + '</ul>';
        }
      }
    });
    api('adminGetCV', {}).then(function (r) {
      var el = document.getElementById('dashCv');
      if (!el) return;
      if (!r || !r.ok || !r.cv) {
        el.innerHTML = '<p class="admin-msg">No CV uploaded yet. The site serves the built-in PDF.</p>';
        return;
      }
      var d = r.cv.uploaded ? new Date(r.cv.uploaded) : null;
      el.innerHTML = '<p><strong>' + esc(r.cv.name) + '</strong>' +
        (r.cv.version ? ' <span class="admin-pill admin-pill-published">' + esc(r.cv.version) + '</span>' : '') + '</p>' +
        '<p class="admin-meta">Uploaded: ' + (d ? esc(d.toLocaleDateString('en-IN')) : '—') +
        (r.cv.size ? ' · ' + fmtSize(r.cv.size) : '') + '</p>' +
        '<p><a class="admin-link" href="' + esc(r.cv.url) + '" target="_blank" rel="noopener">Download current CV ↓</a></p>';
    }).catch(function () {});
    api('adminGetSettings', {}).then(function (r) {
      var el = document.getElementById('dashNotify');
      if (!el) return;
      if (!r || !r.ok || !r.settings) {
        el.innerHTML = '<p class="admin-msg">Could not load notification settings.</p>';
        return;
      }
      settingsCache = r.settings;
      el.innerHTML = '<p class="admin-meta">Telegram notifications: <strong>' +
        (r.settings.telegram ? 'ON' : 'OFF') + '</strong> — ' +
        (r.settings.telegram
          ? 'you get a Telegram message for every new form submission.'
          : 'new form submissions will not ping Telegram.') + '</p>' +
        '<p class="admin-meta">Contact email on the site: <strong>' + esc(r.settings.email || '') + '</strong></p>';
    }).catch(function () {});
  }

  // ---------- analytics tab ----------

  function renderAnalyticsTab() {
    root.innerHTML = dashboardShell(
      customRangeRow(anRange, anStart, anEnd, 'an') +
      '<div class="admin-stats" id="anStats"><p class="admin-msg">Loading stats…</p></div>' +
      '<div class="admin-dash-grid2">' +
      '<section class="admin-panel"><h3>Enquiries by Purpose</h3><div id="anPurpose"><p class="admin-msg">Loading…</p></div></section>' +
      '<section class="admin-panel"><h3>Status Distribution</h3><div class="admin-donut-wrap" id="anStatus"><p class="admin-msg">Loading…</p></div></section>' +
      '</div>' +
      '<section class="admin-panel"><h3>Enquiries Over Time</h3><div id="anTrend"><p class="admin-msg">Loading…</p></div></section>',
      {
        range: true,
        rangeValue: anRange,
        rangeOptions: [['7', 'Last 7 Days'], ['30', 'Last 30 Days'], ['90', 'Last 3 Months'], ['180', 'Last 6 Months'], ['custom', 'Custom Range']]
      }
    );
    bindShell();
    bindHeaderRange(function (v) {
      anRange = v;
      if (v !== 'custom') { anStart = ''; anEnd = ''; }
      renderAnalyticsTab();
    });
    var aa = document.getElementById('anApply');
    if (aa) {
      aa.addEventListener('click', function () {
        anStart = document.getElementById('anStart').value;
        anEnd = document.getElementById('anEnd').value;
        renderAnalyticsTab();
      });
    }
    loadAnalytics();
  }

  function loadAnalytics() {
    ensureMessages(function (ok) {
      var b = rangeBounds(anRange, anStart, anEnd);
      var list = ok && b ? messages.filter(function (m) { return inRange(m, b); }) : [];
      var s = document.getElementById('anStats');
      if (s) {
        if (!ok || !b) {
          s.innerHTML = '<p class="admin-msg">' + esc(lastLoadError || 'Could not load messages.') + '</p>';
        } else {
          // Previous period: same length, immediately before this range.
          var days = Math.round((b.end - b.start) / 86400000) + 1;
          var prevEnd = addDays(b.start, -1);
          var prevStart = addDays(prevEnd, -(days - 1));
          var prevCount = messages.filter(function (m) {
            var d = parseMsgDate(m);
            return d && d >= prevStart && d <= prevEnd;
          }).length;
          var responded = list.filter(function (m) { return m.status === 'Responded'; }).length;
          var rate = list.length ? Math.round(responded / list.length * 100) : 0;
          var pct = prevCount === 0
            ? (list.length > 0 ? '+100%' : '—')
            : (((list.length - prevCount) / prevCount * 100) >= 0 ? '+' : '') +
              Math.round((list.length - prevCount) / prevCount * 100) + '%';
          var respTimes = [];
          list.forEach(function (m) {
            if (m.status === 'Responded' && m.responseDate) {
              var d1 = parseMsgDate(m);
              var d2 = new Date(String(m.responseDate).slice(0, 10) + 'T00:00:00');
              if (d1 && !isNaN(d2)) respTimes.push((d2 - d1) / 86400000);
            }
          });
          var avgResp = respTimes.length
            ? fmtDays(respTimes.reduce(function (a, v) { return a + v; }, 0) / respTimes.length)
            : '—';
          var uniq = {};
          list.forEach(function (m) { if (m.purpose) uniq[m.purpose] = 1; });
          s.innerHTML = statCard(list.length, 'Total Enquiries', '', '✉') +
            statCard(pct, 'vs previous period', '', '↗') +
            statCard(rate + '%', 'Response Rate', 'green', '✓') +
            statCard(avgResp, 'Avg. Response Time', 'amber', '◷') +
            statCard(Object.keys(uniq).length, 'Unique Purposes', '', '▤');
        }
      }
      var pu = document.getElementById('anPurpose');
      if (pu) {
        var counts = {};
        PURPOSES.forEach(function (p) { counts[p] = 0; });
        list.forEach(function (m) { counts[purposeOf(m)]++; });
        pu.innerHTML = barRowsHTML(PURPOSES.map(function (p) {
          return { label: p, value: counts[p], color: PURPOSE_COLORS[p] };
        }));
      }
      var st = document.getElementById('anStatus');
      if (st) {
        var sc = { 'New': 0, 'In Progress': 0, 'Responded': 0, 'Closed': 0 };
        list.forEach(function (m) { if (sc[m.status] !== undefined) sc[m.status]++; });
        var segs = STATUSES.map(function (x) {
          return { label: x, value: sc[x], color: STATUS_COLORS[x] };
        });
        st.innerHTML = '<div class="admin-donut-flex">' + donutSVG(segs, list.length, 'Total') +
          legendHTML(segs, list.length) + '</div>';
      }
      var tr = document.getElementById('anTrend');
      if (tr) {
        tr.innerHTML = ok && b ? lineChartSVG(dailySeries(list, b)) : '<p class="admin-msg">No data in this range.</p>';
      }
    });
  }

  // ---------- contacts tab ----------

  function filteredContacts() {
    var q = (cFilter.text || '').toLowerCase();
    return messages.filter(function (m) {
      if (cFilter.purpose !== 'All' && purposeOf(m) !== cFilter.purpose && m.purpose !== cFilter.purpose) return false;
      if (cFilter.status !== 'All' && m.status !== cFilter.status) return false;
      if (cFilter.start || cFilter.end) {
        var d = parseMsgDate(m);
        if (!d) return false;
        if (cFilter.start && d < new Date(cFilter.start + 'T00:00:00')) return false;
        if (cFilter.end && d > new Date(cFilter.end + 'T00:00:00')) return false;
      }
      if (q) {
        var hay = ((m.name || '') + ' ' + (m.email || '') + ' ' +
          (m.message || '') + ' ' + (m.purpose || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderContactsTab() {
    if (detailId) { renderContactDetail(detailId); return; }
    var purposes = ['All'].concat(PURPOSES);
    root.innerHTML = dashboardShell(
      '<div class="admin-row"><h2>Contacts / Enquiries</h2>' +
      '<span><button class="admin-btn admin-btn-ghost" id="exportCsvBtn">⇩ Export</button> ' +
      (canWrite() ? '<button class="admin-btn admin-btn-red" id="addMsgBtn">+ Add Message</button>' : '') + '</span></div>' +
      '<div class="admin-filters">' +
      '<input type="search" id="filterText" placeholder="Search by name, email or message…" value="' + esc(cFilter.text) + '">' +
      '<select id="filterPurpose">' + purposes.map(function (p) {
        return '<option value="' + p + '"' + (cFilter.purpose === p ? ' selected' : '') + '>' + (p === 'All' ? 'All Purpose' : p) + '</option>';
      }).join('') + '</select>' +
      '<select id="filterStatus">' +
      ['All'].concat(STATUSES).map(function (s) {
        return '<option value="' + s + '"' + (cFilter.status === s ? ' selected' : '') + '>' + (s === 'All' ? 'All Status' : s) + '</option>';
      }).join('') + '</select>' +
      '<label class="admin-date-lbl">Start Date <input type="date" id="filterStart" value="' + esc(cFilter.start) + '"></label>' +
      '<label class="admin-date-lbl">End Date <input type="date" id="filterEnd" value="' + esc(cFilter.end) + '"></label>' +
      '</div>' +
      '<div id="bulkBar"></div>' +
      '<p class="admin-msg" id="msgListMsg">Loading…</p>' +
      '<div class="admin-table-wrap"><table class="admin-table" id="msgTable">' +
      '<thead><tr><th><input type="checkbox" id="selectAll" aria-label="Select all on this page"></th>' +
      '<th>S.No.</th><th>Submitted On</th><th>Name</th><th>Email</th><th>Purpose</th><th>Status</th><th>Actions</th></tr></thead>' +
      '<tbody></tbody></table></div>' +
      '<div class="admin-pagination" id="pagination"></div>' +
      '<div id="msgDetail"></div>'
    );
    bindShell();
    var addBtn = document.getElementById('addMsgBtn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        selectedId = 'NEW';
        renderMessageForm(null);
      });
    }
    document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);
    var ft = document.getElementById('filterText');
    ft.addEventListener('input', function () { cFilter.text = ft.value; cFilter.page = 1; renderContactsTable(); });
    document.getElementById('filterPurpose').addEventListener('change', function (ev) {
      cFilter.purpose = ev.target.value; cFilter.page = 1; renderContactsTable();
    });
    document.getElementById('filterStatus').addEventListener('change', function (ev) {
      cFilter.status = ev.target.value; cFilter.page = 1; renderContactsTable();
    });
    document.getElementById('filterStart').addEventListener('change', function (ev) {
      cFilter.start = ev.target.value; cFilter.page = 1; renderContactsTable();
    });
    document.getElementById('filterEnd').addEventListener('change', function (ev) {
      cFilter.end = ev.target.value; cFilter.page = 1; renderContactsTable();
    });
    document.getElementById('selectAll').addEventListener('change', function (ev) {
      pageRows().forEach(function (m) {
        if (ev.target.checked) cFilter.selected[m.submissionId] = 1;
        else delete cFilter.selected[m.submissionId];
      });
      renderContactsTable();
    });
    ensureMessages(function (ok) {
      if (!ok) {
        var msg = document.getElementById('msgListMsg');
        if (msg) msg.textContent = lastLoadError || 'Could not load messages.';
        return;
      }
      renderContactsTable();
      if (selectedId && selectedId !== 'NEW') {
        var m = messages.find(function (x) { return x.submissionId === selectedId; });
        if (m) renderMessageForm(m);
      }
    });
  }

  function pageRows() {
    var list = filteredContacts();
    var start = (cFilter.page - 1) * cFilter.perPage;
    return list.slice(start, start + cFilter.perPage);
  }

  function renderContactsTable() {
    var list = filteredContacts();
    var totalPages = Math.max(1, Math.ceil(list.length / cFilter.perPage));
    if (cFilter.page > totalPages) cFilter.page = totalPages;
    var start = (cFilter.page - 1) * cFilter.perPage;
    var rows = list.slice(start, start + cFilter.perPage);
    var msg = document.getElementById('msgListMsg');
    if (msg) {
      msg.textContent = list.length
        ? 'Showing ' + (start + 1) + '–' + Math.min(start + cFilter.perPage, list.length) + ' of ' + list.length + '. Click a row to view details.'
        : 'No enquiries match these filters.';
    }
    var tbody = document.querySelector('#msgTable tbody');
    if (!tbody) return;
    tbody.innerHTML = rows.map(function (m, i) {
      var sel = !!cFilter.selected[m.submissionId];
      return '<tr data-id="' + esc(m.submissionId) + '"' + (sel ? ' class="selected"' : '') + '>' +
        '<td><input type="checkbox" class="row-check" data-id="' + esc(m.submissionId) + '"' + (sel ? ' checked' : '') + '></td>' +
        '<td>' + (start + i + 1) + '</td>' +
        '<td>' + esc(fmtDateTime(m)) + '</td>' +
        '<td>' + esc(m.name) + '</td>' +
        '<td>' + esc(m.email) + '</td>' +
        '<td>' + esc(m.purpose) + '</td>' +
        '<td>' + statusPill(m.status) + '</td>' +
        '<td class="admin-actions-cell">' +
        '<button class="admin-icon-btn" type="button" data-view="' + esc(m.submissionId) + '" title="View">◉</button>' +
        (canWrite() ? '<button class="admin-icon-btn" type="button" data-edit="' + esc(m.submissionId) + '" title="Edit">✎</button>' : '') +
        '</td></tr>';
    }).join('');
    tbody.querySelectorAll('.row-check').forEach(function (cb) {
      cb.addEventListener('click', function (ev) { ev.stopPropagation(); });
      cb.addEventListener('change', function () {
        if (cb.checked) cFilter.selected[cb.getAttribute('data-id')] = 1;
        else delete cFilter.selected[cb.getAttribute('data-id')];
        renderContactsTable();
      });
    });
    tbody.querySelectorAll('[data-view]').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        detailId = b.getAttribute('data-view');
        detailEdit = false;
        renderContactsTab();
      });
    });
    tbody.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        detailId = b.getAttribute('data-edit');
        detailEdit = true;
        renderContactsTab();
      });
    });
    tbody.querySelectorAll('tr').forEach(function (tr) {
      tr.addEventListener('click', function () {
        detailId = tr.getAttribute('data-id');
        detailEdit = false;
        renderContactsTab();
      });
    });
    var sa = document.getElementById('selectAll');
    if (sa) sa.checked = rows.length > 0 && rows.every(function (m) { return !!cFilter.selected[m.submissionId]; });
    renderBulkBar();
    renderPagination(list.length, totalPages);
  }

  function renderBulkBar() {
    var bar = document.getElementById('bulkBar');
    if (!bar) return;
    var ids = Object.keys(cFilter.selected);
    if (!ids.length || !canWrite()) { bar.innerHTML = ''; return; }
    bar.innerHTML = '<div class="admin-bulk">' +
      '<span><strong>' + ids.length + '</strong> selected</span>' +
      '<button class="admin-btn admin-btn-danger admin-btn-sm" type="button" id="bulkDelBtn">Delete selected</button>' +
      '<select id="bulkStatus">' + STATUSES.map(function (s) {
        return '<option>' + s + '</option>';
      }).join('') + '</select>' +
      '<button class="admin-btn admin-btn-ghost admin-btn-sm" type="button" id="bulkStatusBtn">Mark as…</button>' +
      '<button class="admin-btn admin-btn-ghost admin-btn-sm" type="button" id="bulkClearBtn">Clear</button>' +
      '<span class="admin-msg" id="bulkMsg"></span></div>';
    var delArmed = false;
    var delTimer = null;
    document.getElementById('bulkDelBtn').addEventListener('click', function () {
      var btn = this;
      if (!delArmed) {
        delArmed = true;
        btn.textContent = 'Confirm Delete?';
        btn.classList.add('armed');
        delTimer = setTimeout(function () {
          delArmed = false;
          btn.textContent = 'Delete selected';
          btn.classList.remove('armed');
        }, 5000);
        return;
      }
      clearTimeout(delTimer);
      api('adminBulkDelete', { submissionIds: ids }).then(function (r) {
        if (r && r.ok) {
          cFilter.selected = {};
          refreshMessages(function () { renderContactsTable(); });
        } else {
          if (notLoggedIn(r)) return;
          modalMsg('bulkMsg', (r && r.error) || 'Delete failed.');
        }
      }).catch(function () { modalMsg('bulkMsg', 'Could not reach the server.'); });
    });
    document.getElementById('bulkStatusBtn').addEventListener('click', function () {
      var st = document.getElementById('bulkStatus').value;
      api('adminBulkStatus', { submissionIds: ids, status: st }).then(function (r) {
        if (r && r.ok) {
          cFilter.selected = {};
          refreshMessages(function () { renderContactsTable(); });
        } else {
          if (notLoggedIn(r)) return;
          modalMsg('bulkMsg', (r && r.error) || 'Update failed.');
        }
      }).catch(function () { modalMsg('bulkMsg', 'Could not reach the server.'); });
    });
    document.getElementById('bulkClearBtn').addEventListener('click', function () {
      cFilter.selected = {};
      renderContactsTable();
    });
  }

  function renderPagination(total, totalPages) {
    var el = document.getElementById('pagination');
    if (!el) return;
    var pages = [];
    for (var p = 1; p <= totalPages; p++) {
      if (totalPages <= 7 || p === 1 || p === totalPages || Math.abs(p - cFilter.page) <= 1) {
        pages.push(p);
      } else if (pages[pages.length - 1] !== '…') {
        pages.push('…');
      }
    }
    el.innerHTML = '<span>Showing ' + (total ? ((cFilter.page - 1) * cFilter.perPage + 1) + '–' +
      Math.min(cFilter.page * cFilter.perPage, total) : '0') + ' of ' + total + '</span>' +
      '<span class="admin-pages">' +
      '<button class="admin-page-btn" type="button" data-page="prev" ' + (cFilter.page <= 1 ? 'disabled' : '') + '>‹</button>' +
      pages.map(function (p) {
        return p === '…'
          ? '<span class="admin-page-ellipsis">…</span>'
          : '<button class="admin-page-btn' + (p === cFilter.page ? ' active' : '') + '" type="button" data-page="' + p + '">' + p + '</button>';
      }).join('') +
      '<button class="admin-page-btn" type="button" data-page="next" ' + (cFilter.page >= totalPages ? 'disabled' : '') + '>›</button>' +
      '</span>' +
      '<label>Rows per page <select id="perPage">' +
      [5, 10, 25].map(function (n) {
        return '<option value="' + n + '"' + (cFilter.perPage === n ? ' selected' : '') + '>' + n + '</option>';
      }).join('') + '</select></label>';
    el.querySelectorAll('[data-page]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-page');
        if (v === 'prev') cFilter.page = Math.max(1, cFilter.page - 1);
        else if (v === 'next') cFilter.page = Math.min(totalPages, cFilter.page + 1);
        else cFilter.page = +v;
        renderContactsTable();
      });
    });
    document.getElementById('perPage').addEventListener('change', function (ev) {
      cFilter.perPage = +ev.target.value;
      cFilter.page = 1;
      renderContactsTable();
    });
  }

  function exportCsv() {
    var list = filteredContacts();
    var head = ['Submission ID', 'Date', 'Time', 'Name', 'Email', 'Phone', 'Purpose',
      'Message', 'Status', 'Priority', 'Location', 'Device', 'IP', 'Source', 'Admin Notes'];
    var rows = [head].concat(list.map(function (m) {
      return [m.submissionId, m.date, m.time, m.name, m.email, m.phone, m.purpose,
        m.message, m.status, m.priority, m.location, m.deviceType, m.ip, m.source, m.adminNotes];
    }));
    var csv = rows.map(function (r) {
      return r.map(function (v) {
        return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'portfolio-messages-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    fire('adminLogExport', {});
  }

  // ---------- contact detail (in-place view state) ----------

  function renderContactDetail(id) {
    var m = messages.find(function (x) { return x.submissionId === id; });
    if (!m) {
      detailId = null;
      renderContactsTab();
      return;
    }
    fire('adminLogView', { submissionId: id });
    root.innerHTML = dashboardShell(
      '<p><a class="admin-link" href="#admin_contacts" id="backToContacts">&larr; Back to Contacts</a></p>' +
      '<div class="admin-row"><h2>Contact Details</h2><span>' + statusPill(m.status) + '</span></div>' +
      '<p class="admin-sub">View complete details of the enquiry</p>' +
      '<div class="admin-detail-grid">' +
      '<section class="admin-panel"><h3>Enquiry Information</h3>' +
      '<dl class="admin-kv">' +
      '<dt>Name</dt><dd>' + esc(m.name) + '</dd>' +
      '<dt>Email</dt><dd>' + esc(m.email) + '</dd>' +
      '<dt>Phone</dt><dd>' + esc(m.phone || '—') + '</dd>' +
      '<dt>Purpose</dt><dd>' + esc(m.purpose) + '</dd>' +
      '<dt>Submitted On</dt><dd>' + esc(fmtDateTime(m)) + '</dd>' +
      '<dt>Device</dt><dd>' + esc(m.deviceType || '—') + '</dd>' +
      '<dt>IP Address</dt><dd>' + esc(m.ip || '—') + '</dd>' +
      '<dt>Source</dt><dd>' + esc(m.source || 'Portfolio Website') + '</dd>' +
      (m.location ? '<dt>Location</dt><dd>' + esc(m.location) + '</dd>' : '') +
      (m.responseDate ? '<dt>Response Date</dt><dd>' + esc(m.responseDate) + '</dd>' : '') +
      '</dl></section>' +
      '<section class="admin-panel"><h3>Message</h3>' +
      '<p class="admin-detail-msg">' + esc(m.message || '(no message)') + '</p>' +
      (m.adminNotes ? '<h3>Admin Notes</h3><p class="admin-meta">' + esc(m.adminNotes) + '</p>' : '') +
      '</section></div>' +
      '<div class="admin-row admin-detail-actions">' +
      (canWrite() ? '<button class="admin-btn admin-btn-red" type="button" id="respondBtn">✉ Respond</button>' : '') +
      (canWrite() ? '<select id="detailStatus">' + STATUSES.map(function (s) {
        return '<option' + (m.status === s ? ' selected' : '') + '>' + s + '</option>';
      }).join('') + '</select>' +
      '<button class="admin-btn admin-btn-ghost" type="button" id="updateStatusBtn">Update Status</button>' +
      '<button class="admin-btn admin-btn-ghost" type="button" id="markClosedBtn">Mark as Closed</button>' : '') +
      (canWrite() ? '<button class="admin-btn admin-btn-ghost" type="button" id="editDetailsBtn">Edit details</button>' : '') +
      '</div>' +
      '<p class="admin-msg" id="detailMsg"></p>' +
      '<div id="msgDetail"></div>'
    );
    bindShell();
    document.getElementById('backToContacts').addEventListener('click', function (ev) {
      ev.preventDefault();
      detailId = null;
      detailEdit = false;
      renderContactsTab();
    });
    var resp = document.getElementById('respondBtn');
    if (resp) resp.addEventListener('click', function () { openRespondModal(m); });
    var upd = document.getElementById('updateStatusBtn');
    if (upd) {
      upd.addEventListener('click', function () {
        var st = document.getElementById('detailStatus').value;
        saveMessageStatus(m, st);
      });
    }
    var mc = document.getElementById('markClosedBtn');
    if (mc) mc.addEventListener('click', function () { saveMessageStatus(m, 'Closed'); });
    var ed = document.getElementById('editDetailsBtn');
    if (ed) {
      ed.addEventListener('click', function () {
        detailEdit = !detailEdit;
        if (detailEdit) renderMessageForm(m);
        else document.getElementById('msgDetail').innerHTML = '';
      });
    }
    if (detailEdit) renderMessageForm(m);
  }

  function saveMessageStatus(m, status) {
    var msg = document.getElementById('detailMsg');
    if (msg) msg.textContent = 'Saving…';
    api('adminUpdateMessage', { submissionId: m.submissionId, fields: { status: status } }).then(function (r) {
      if (r && r.ok) {
        m.status = status;
        refreshMessages(function () { renderContactDetail(m.submissionId); });
      } else {
        if (notLoggedIn(r)) return;
        if (msg) msg.textContent = (r && r.error) || 'Update failed.';
      }
    }).catch(function () {
      if (msg) msg.textContent = 'Could not reach the server.';
    });
  }

  // ---------- respond modal ----------

  function templateText(name, purpose) {
    var t = (settingsCache && settingsCache.template) || 'Default Template';
    var body = RESPONSE_TEMPLATES[t] || '';
    if (!body) return '';
    return body.replace(/\{name\}/g, name || '').replace(/\{purpose\}/g, purpose || '');
  }

  function openRespondModal(m) {
    var subject = 'Re: ' + (m.purpose || 'Your message');
    openModal(
      '<div class="admin-modal-head"><h3>✉ Respond to Enquiry</h3>' +
      '<button class="admin-modal-x" type="button" id="modalClose">✕</button></div>' +
      '<p class="admin-meta">To: <strong>' + esc(m.email) + '</strong></p>' +
      '<form id="respondForm">' +
      '<label>Subject<input type="text" id="respSubject" value="' + esc(subject) + '" required></label>' +
      '<label>Message<textarea id="respText" rows="7" placeholder="Write your reply…">' + esc(templateText(m.name, m.purpose)) + '</textarea></label>' +
      '<label class="admin-check"><input type="checkbox" id="respUpdate" checked> Update status after sending</label>' +
      '<label>New status<select id="respStatus">' + STATUSES.map(function (s) {
        return '<option' + (s === 'Responded' ? ' selected' : '') + '>' + s + '</option>';
      }).join('') + '</select></label>' +
      '<p class="admin-msg" id="respMsg"></p>' +
      '<div class="admin-row">' +
      '<button class="admin-btn admin-btn-ghost" type="button" id="respCancel">Cancel</button>' +
      '<button class="admin-btn admin-btn-red" type="submit" id="respSend">✉ Send Response</button>' +
      '</div></form>'
    );
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('respCancel').addEventListener('click', closeModal);
    var sending = false;
    document.getElementById('respondForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (sending) return;
      var text = document.getElementById('respText').value.trim();
      var msg = document.getElementById('respMsg');
      if (!text) { msg.textContent = 'Write a reply first.'; return; }
      sending = true;
      var btn = document.getElementById('respSend');
      btn.disabled = true;
      btn.textContent = 'Sending…';
      msg.textContent = 'Sending…';
      api('adminReplyMessage', {
        submissionId: m.submissionId,
        reply: text,
        subject: document.getElementById('respSubject').value.trim(),
        updateStatus: document.getElementById('respUpdate').checked,
        newStatus: document.getElementById('respStatus').value
      }).then(function (r) {
        sending = false;
        if (r && r.ok) {
          msg.textContent = 'Response sent.';
          m.status = 'Responded';
          setTimeout(function () {
            closeModal();
            refreshMessages(function () { renderContactDetail(m.submissionId); });
          }, 700);
        } else {
          btn.disabled = false;
          btn.textContent = '✉ Send Response';
          if (notLoggedIn(r)) { closeModal(); return; }
          msg.textContent = (r && r.error) || 'Reply failed.';
        }
      }).catch(function () {
        sending = false;
        btn.disabled = false;
        btn.textContent = '✉ Send Response';
        msg.textContent = 'Could not reach the server.';
      });
    });
  }

  // ---------- add / edit message form (kept from v56) ----------

  function renderMessageForm(m) {
    var isNew = !m;
    var d = m || {};
    document.getElementById('msgDetail').innerHTML =
      '<form class="admin-form" id="msgForm">' +
      '<h3>' + (isNew ? 'Add Message' : 'Edit Message — ' + esc(d.submissionId || '')) + '</h3>' +
      '<div class="admin-grid">' +
      '<label>Full name<input name="name" value="' + esc(d.name || '') + '" required></label>' +
      '<label>Email<input name="email" type="email" value="' + esc(d.email || '') + '" required></label>' +
      '<label>Phone<input name="phone" value="' + esc(d.phone || '') + '"></label>' +
      '<label>Purpose<select name="purpose">' +
      ['Job Opportunity', 'Business Inquiry', 'Freelance Project', 'Collaboration', 'General Inquiry', 'Other'].map(function (p) {
        return '<option' + (d.purpose === p ? ' selected' : '') + '>' + p + '</option>';
      }).join('') + '</select></label>' +
      '<label>Status<select name="status">' +
      STATUSES.map(function (s) {
        return '<option' + (d.status === s ? ' selected' : '') + '>' + s + '</option>';
      }).join('') + '</select></label>' +
      '<label>Priority<select name="priority">' +
      ['High', 'Medium', 'Low'].map(function (p) {
        return '<option' + (d.priority === p ? ' selected' : '') + '>' + p + '</option>';
      }).join('') + '</select></label>' +
      '<label>Location<input name="location" value="' + esc(d.location || '') + '"></label>' +
      '<label>Device<input name="deviceType" value="' + esc(d.deviceType || '') + '"></label>' +
      '</div>' +
      '<label>Message<textarea name="message" rows="4">' + esc(d.message || '') + '</textarea></label>' +
      '<label>Admin notes<textarea name="adminNotes" rows="3" placeholder="Private notes — only you see these.">' + esc(d.adminNotes || '') + '</textarea></label>' +
      '<p class="admin-meta">' +
      (isNew ? '' : 'Submitted: ' + esc(d.date || '') + ' ' + esc(d.time || '') + (d.ip ? ' &middot; IP: ' + esc(d.ip) : '') + (d.source ? ' &middot; Source: ' + esc(d.source) : '')) +
      '</p>' +
      '<p class="admin-msg" id="msgFormMsg"></p>' +
      '<div class="admin-row">' +
      '<button class="admin-btn admin-btn-red" type="submit">' + (isNew ? 'Add Message' : 'Save Changes') + '</button>' +
      (isNew ? '' : '<button class="admin-btn admin-btn-danger" type="button" id="delMsgBtn">Delete</button>') +
      '<button class="admin-btn admin-btn-ghost" type="button" id="cancelMsgBtn">Close</button>' +
      '</div></form>' +
      (isNew || !canWrite() ? '' :
      '<div class="admin-reply">' +
      '<h3>Reply by Email</h3>' +
      '<p class="admin-note">Replies go to ' + esc(d.email || '') + ' from your Gmail. Sending marks this message Responded.</p>' +
      '<button class="admin-btn admin-btn-red" type="button" id="openRespondBtn">✉ Respond by Email</button>' +
      '</div>');
    var form = document.getElementById('msgForm');
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var fd = new FormData(form);
      var fields = {};
      ['name', 'email', 'phone', 'purpose', 'message', 'status', 'priority', 'location', 'deviceType', 'adminNotes'].forEach(function (k) {
        fields[k] = fd.get(k) || '';
      });
      var msg = document.getElementById('msgFormMsg');
      msg.textContent = 'Saving…';
      var req = isNew
        ? api('adminAddMessage', { message: fields })
        : api('adminUpdateMessage', { submissionId: d.submissionId, fields: fields });
      req.then(function (r) {
        if (r && r.ok) {
          msg.textContent = isNew ? 'Message added.' : 'Saved.';
          selectedId = isNew ? (r.submissionId || null) : d.submissionId;
          refreshMessages(function () {
            if (detailId) renderContactDetail(detailId);
            else renderContactsTable();
          });
        } else {
          if (notLoggedIn(r)) return;
          msg.textContent = (r && r.error) || 'Save failed.';
        }
      }).catch(function () { msg.textContent = 'Could not reach the server.'; });
    });
    document.getElementById('cancelMsgBtn').addEventListener('click', function () {
      document.getElementById('msgDetail').innerHTML = '';
      selectedId = null;
      detailEdit = false;
    });
    var del = document.getElementById('delMsgBtn');
    if (del) {
      var delArmed = false;
      var delTimer = null;
      del.addEventListener('click', function () {
        if (!delArmed) {
          delArmed = true;
          del.textContent = 'Confirm Delete?';
          del.classList.add('armed');
          delTimer = setTimeout(function () {
            delArmed = false;
            del.textContent = 'Delete';
            del.classList.remove('armed');
          }, 5000);
          return;
        }
        clearTimeout(delTimer);
        api('adminDeleteMessage', { submissionId: d.submissionId }).then(function (r) {
          if (r && r.ok) {
            selectedId = null;
            detailId = null;
            detailEdit = false;
            refreshMessages(function () { renderContactsTab(); });
          } else {
            if (notLoggedIn(r)) return;
            var mm = document.getElementById('msgFormMsg');
            if (mm) mm.textContent = (r && r.error) || 'Delete failed.';
          }
        });
      });
    }
    var orb = document.getElementById('openRespondBtn');
    if (orb) orb.addEventListener('click', function () { openRespondModal(d); });
  }

  // ---------- users tab (Super Admin only) ----------

  function userDisplayName(email) {
    var n = (email || '').split('@')[0] || '';
    return n.replace(/[._-]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }) || email;
  }

  function renderUsersTab() {
    root.innerHTML = dashboardShell(
      '<div class="admin-row"><h2>Users</h2>' +
      '<span><button class="admin-btn admin-btn-red" id="addUserBtn">+ Add User</button></span></div>' +
      '<p class="admin-sub">Manage admin users and access. Only a Super Admin can add, edit or remove users.</p>' +
      '<p class="admin-msg" id="usersMsg">Loading…</p>' +
      '<div class="admin-table-wrap"><table class="admin-table" id="usersTable">' +
      '<thead><tr><th>S.No.</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>' +
      '<tbody></tbody></table></div>'
    );
    bindShell();
    document.getElementById('addUserBtn').addEventListener('click', function () { openUserModal(null); });
    loadUsers();
  }

  function loadUsers() {
    api('adminListUsers', {}).then(function (r) {
      var msg = document.getElementById('usersMsg');
      if (!r || !r.ok) {
        if (notLoggedIn(r)) return;
        if (msg) msg.textContent = (r && r.error) || 'Could not load users.';
        return;
      }
      users = r.users || [];
      renderUsersTable();
      if (msg) msg.textContent = users.length + ' user(s).';
    }).catch(function () {
      var msg = document.getElementById('usersMsg');
      if (msg) msg.textContent = 'Could not reach the server.';
    });
  }

  function renderUsersTable() {
    var tbody = document.querySelector('#usersTable tbody');
    if (!tbody) return;
    tbody.innerHTML = users.map(function (u, i) {
      var self = u.username === getAdminUser();
      var active = (u.status || 'Active') === 'Active';
      return '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + esc(userDisplayName(u.username)) + (self ? ' <span class="admin-meta">(you)</span>' : '') + '</td>' +
        '<td>' + esc(u.username) + '</td>' +
        '<td>' + rolePill(u.role) + '</td>' +
        '<td>' + pill(active ? 'Active' : 'Inactive', active ? 'active' : 'inactive') + '</td>' +
        '<td class="admin-actions-cell">' +
        '<button class="admin-icon-btn" type="button" data-user-edit="' + esc(u.username) + '" title="Edit">✎</button>' +
        '<button class="admin-icon-btn" type="button" data-user-toggle="' + esc(u.username) + '" title="' + (active ? 'Deactivate' : 'Activate') + '">' + (active ? '◐' : '○') + '</button>' +
        '<button class="admin-icon-btn admin-icon-danger" type="button" data-user-del="' + esc(u.username) + '" title="Delete">✕</button>' +
        '</td></tr>';
    }).join('');
    tbody.querySelectorAll('[data-user-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var u = users.find(function (x) { return x.username === b.getAttribute('data-user-edit'); });
        if (u) openUserModal(u);
      });
    });
    tbody.querySelectorAll('[data-user-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var username = b.getAttribute('data-user-toggle');
        if (username === getAdminUser()) {
          var msg = document.getElementById('usersMsg');
          if (msg) msg.textContent = 'You cannot deactivate your own account.';
          return;
        }
        api('adminToggleUser', { username: username }).then(function (r) {
          if (r && r.ok) loadUsers();
          else if (notLoggedIn(r)) return;
          else {
            var m2 = document.getElementById('usersMsg');
            if (m2) m2.textContent = (r && r.error) || 'Toggle failed.';
          }
        });
      });
    });
    tbody.querySelectorAll('[data-user-del]').forEach(function (b) {
      var armed = false;
      var timer = null;
      b.addEventListener('click', function () {
        var username = b.getAttribute('data-user-del');
        if (!armed) {
          armed = true;
          b.textContent = 'Confirm?';
          b.classList.add('armed');
          timer = setTimeout(function () {
            armed = false;
            b.textContent = '✕';
            b.classList.remove('armed');
          }, 5000);
          return;
        }
        clearTimeout(timer);
        if (username === getAdminUser()) {
          var msg = document.getElementById('usersMsg');
          if (msg) msg.textContent = 'You cannot delete your own account.';
          return;
        }
        api('adminDeleteUser', { username: username }).then(function (r) {
          if (r && r.ok) loadUsers();
          else if (notLoggedIn(r)) return;
          else {
            var m2 = document.getElementById('usersMsg');
            if (m2) m2.textContent = (r && r.error) || 'Delete failed.';
          }
        });
      });
    });
  }

  function openUserModal(u) {
    var isNew = !u;
    openModal(
      '<div class="admin-modal-head"><h3>' + (isNew ? 'Add User' : 'Edit User') + '</h3>' +
      '<button class="admin-modal-x" type="button" id="modalClose">✕</button></div>' +
      '<form id="userForm">' +
      '<label>Email<input type="email" id="userEmail" value="' + esc(u ? u.username : '') + '" required ' + (isNew ? '' : 'disabled') + '></label>' +
      (isNew
        ? '<label>Password<input type="password" id="userPass" required minlength="6" autocomplete="new-password" placeholder="At least 6 characters"></label>'
        : '<label>New password (leave blank to keep the current one)<input type="password" id="userPass" minlength="6" autocomplete="new-password" placeholder="Optional"></label>') +
      '<label>Role<select id="userRole">' +
      ['Super Admin', 'Admin', 'Viewer'].map(function (r) {
        return '<option' + (u && u.role === r ? ' selected' : '') + '>' + r + '</option>';
      }).join('') + '</select></label>' +
      (isNew ? '' : '<label>Status<select id="userStatus">' +
      ['Active', 'Inactive'].map(function (s) {
        return '<option' + (u.status === s ? ' selected' : '') + '>' + s + '</option>';
      }).join('') + '</select></label>') +
      '<p class="admin-msg" id="userMsg"></p>' +
      '<div class="admin-row">' +
      '<button class="admin-btn admin-btn-ghost" type="button" id="userCancel">Cancel</button>' +
      '<button class="admin-btn admin-btn-red" type="submit">' + (isNew ? 'Add User' : 'Save Changes') + '</button>' +
      '</div></form>'
    );
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('userCancel').addEventListener('click', closeModal);
    document.getElementById('userForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var msg = document.getElementById('userMsg');
      var role = document.getElementById('userRole').value;
      var pass = document.getElementById('userPass').value;
      if (isNew) {
        var email = document.getElementById('userEmail').value.trim();
        if (!email || pass.length < 6) { msg.textContent = 'Enter a valid email and a password of at least 6 characters.'; return; }
        msg.textContent = 'Adding…';
        api('adminAddUser', { username: email, password: pass, role: role }).then(function (r) {
          if (r && r.ok) { closeModal(); loadUsers(); }
          else { if (notLoggedIn(r)) { closeModal(); return; } msg.textContent = (r && r.error) || 'Add failed.'; }
        }).catch(function () { msg.textContent = 'Could not reach the server.'; });
      } else {
        if (u.username === getAdminUser() && role !== u.role && role !== 'Super Admin') {
          msg.textContent = 'You cannot lower your own role.';
          return;
        }
        var payload = { username: u.username, role: role, status: document.getElementById('userStatus').value };
        if (pass) payload.password = pass;
        msg.textContent = 'Saving…';
        api('adminUpdateUser', payload).then(function (r) {
          if (r && r.ok) { closeModal(); loadUsers(); }
          else { if (notLoggedIn(r)) { closeModal(); return; } msg.textContent = (r && r.error) || 'Save failed.'; }
        }).catch(function () { msg.textContent = 'Could not reach the server.'; });
      }
    });
  }

  // ---------- resume management tab ----------

  function renderResumeTab() {
    root.innerHTML = dashboardShell(
      '<p class="admin-sub">Update your CV, manage versions and publish the latest resume on your website.</p>' +
      '<section class="admin-panel"><h3>Current Published Resume</h3><div id="cvCurrent"><p class="admin-msg">Loading…</p></div></section>' +
      '<section class="admin-panel"><h3>Upload Latest Resume</h3>' +
      '<div class="admin-dropzone" id="cvDrop">' +
      '<p><strong>Drag &amp; drop PDF here</strong> or click to browse</p>' +
      '<p class="admin-meta">PDF only · max 5 MB · uploading publishes the new version at once</p>' +
      '<input type="file" id="cvFile" accept="application/pdf" hidden>' +
      '<button class="admin-btn admin-btn-red" type="button" id="cvChooseBtn">Choose File</button>' +
      '</div>' +
      '<div class="admin-progress" id="cvProgress" hidden><div class="admin-progress-bar" id="cvProgressBar"></div></div>' +
      '<p class="admin-msg" id="cvUpMsg"></p>' +
      '</section>' +
      '<section class="admin-panel"><h3>Resume Version History</h3><div id="cvHistory"><p class="admin-msg">Loading…</p></div></section>' +
      '<section class="admin-panel"><h3>Preview</h3><div id="cvViewerWrap"></div></section>'
    );
    bindShell();
    var drop = document.getElementById('cvDrop');
    var fileInput = document.getElementById('cvFile');
    document.getElementById('cvChooseBtn').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      if (fileInput.files[0]) handleCvFile(fileInput.files[0]);
      fileInput.value = '';
    });
    ['dragover', 'dragenter'].forEach(function (evt) {
      drop.addEventListener(evt, function (ev) { ev.preventDefault(); drop.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      drop.addEventListener(evt, function (ev) { ev.preventDefault(); drop.classList.remove('drag'); });
    });
    drop.addEventListener('drop', function (ev) {
      var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (f) handleCvFile(f);
    });
    loadResumeData();
  }

  function loadResumeData() {
    var cur = document.getElementById('cvCurrent');
    var hist = document.getElementById('cvHistory');
    var viewer = document.getElementById('cvViewerWrap');
    api('adminGetCV', {}).then(function (r) {
      if (!r || !r.ok) {
        if (notLoggedIn(r)) return;
        if (cur) cur.innerHTML = '<p class="admin-msg">' + esc(r.error || 'Could not load CV info.') + '</p>';
        return;
      }
      if (!r.cv) {
        if (cur) cur.innerHTML = '<p><strong>No CV uploaded yet.</strong></p>' +
          '<p class="admin-meta">The site currently serves the built-in PDF. Upload a new PDF below to publish your first version.</p>';
        if (viewer) {
          viewer.innerHTML = '<iframe class="admin-cv-viewer" src="' + BUILTIN_CV + '" title="Built-in CV preview" loading="lazy"></iframe>' +
            '<p class="admin-meta">Built-in CV (' + BUILTIN_CV + ') — shown here until you upload a version.</p>';
        }
      } else {
        var d = r.cv.uploaded ? new Date(r.cv.uploaded) : null;
        if (cur) {
          cur.innerHTML =
            '<div class="admin-cv-row">' +
            '<span class="admin-cv-ic">▤</span>' +
            '<div class="admin-cv-info"><strong>' + esc(r.cv.name) + '</strong>' +
            '<span class="admin-meta">' + fmtSize(r.cv.size) + ' · Uploaded ' + (d ? esc(d.toLocaleString('en-IN')) : '—') + '</span>' +
            '<span class="admin-meta">Version ' + esc(r.cv.version || 'v1') + ' · Active on Website</span></div>' +
            '<span class="admin-pill admin-pill-published">Published</span></div>' +
            '<div class="admin-row">' +
            '<button class="admin-btn admin-btn-ghost" type="button" id="cvPreviewBtn">Preview</button> ' +
            '<a class="admin-btn admin-btn-red" href="' + esc(r.cv.url) + '" target="_blank" rel="noopener">Download</a> ' +
            (canWrite() ? '<button class="admin-btn admin-btn-danger" type="button" id="delCvBtn">Delete CV</button>' : '') +
            '</div>';
          var pv = document.getElementById('cvPreviewBtn');
          if (pv) pv.addEventListener('click', function () {
            var vw = document.getElementById('cvViewerWrap');
            if (vw) {
              vw.innerHTML = '<iframe class="admin-cv-viewer" src="' + esc(r.cv.preview || r.cv.url) +
                '" title="Current CV preview" loading="lazy"></iframe>';
              vw.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
          var del = document.getElementById('delCvBtn');
          if (del) {
            var delArmed = false;
            var delTimer = null;
            del.addEventListener('click', function () {
              if (!delArmed) {
                delArmed = true;
                del.textContent = 'Confirm Delete?';
                del.classList.add('armed');
                delTimer = setTimeout(function () {
                  delArmed = false;
                  del.textContent = 'Delete CV';
                  del.classList.remove('armed');
                }, 5000);
                return;
              }
              clearTimeout(delTimer);
              del.textContent = 'Deleting…';
              api('adminDeleteCV', {}).then(function (r2) {
                if (r2 && r2.ok) loadResumeData();
                else {
                  if (notLoggedIn(r2)) return;
                  del.textContent = 'Delete CV';
                  var m = document.getElementById('cvUpMsg');
                  if (m) m.textContent = (r2 && r2.error) || 'Delete failed.';
                }
              });
            });
          }
        }
        if (viewer) {
          viewer.innerHTML = '<iframe class="admin-cv-viewer" src="' + esc(r.cv.preview || r.cv.url) +
            '" title="Current CV preview" loading="lazy"></iframe>' +
            '<p class="admin-meta">If the preview does not load, <a href="' + esc(r.cv.url) +
            '" target="_blank" rel="noopener">open the PDF in a new tab</a>.</p>';
        }
      }
    }).catch(function () {
      if (cur) cur.innerHTML = '<p class="admin-msg">Could not reach the server.</p>';
    });
    api('adminListResumes', {}).then(function (r) {
      if (!r || !r.ok) {
        if (notLoggedIn(r)) return;
        if (hist) hist.innerHTML = '<p class="admin-msg">' + esc(r.error || 'Could not load version history.') + '</p>';
        return;
      }
      resumes = r.resumes || [];
      if (!resumes.length) {
        if (hist) hist.innerHTML = '<p class="admin-msg">No versions yet. Upload your first CV above.</p>';
        return;
      }
      if (hist) {
        hist.innerHTML = '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
          '<th>Version</th><th>File Name</th><th>Uploaded On</th><th>Size</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
          resumes.map(function (v) {
            var d = v.uploaded ? new Date(v.uploaded) : null;
            var published = (v.status || '') === 'Published';
            return '<tr><td><strong>' + esc(v.version || '') + '</strong></td>' +
              '<td>' + esc(v.fileName || v.name || '') + '</td>' +
              '<td>' + (d ? esc(d.toLocaleString('en-IN')) : '—') + '</td>' +
              '<td>' + fmtSize(v.size) + '</td>' +
              '<td>' + pill(published ? 'Published' : 'Archived', published ? 'published' : 'archived') + '</td>' +
              '<td class="admin-actions-cell">' +
              (published ? '' : (canWrite() ? '<button class="admin-btn admin-btn-ghost admin-btn-sm" type="button" data-restore="' + esc(v.version || '') + '">Restore</button> ' : '')) +
              (v.fileId ? '<a class="admin-btn admin-btn-ghost admin-btn-sm" href="https://drive.google.com/uc?export=download&amp;id=' + esc(v.fileId) + '" target="_blank" rel="noopener">Download</a>' : '') +
              '</td></tr>';
          }).join('') + '</tbody></table></div>';
        hist.querySelectorAll('[data-restore]').forEach(function (b) {
          var armed = false;
          var timer = null;
          b.addEventListener('click', function () {
            var ver = b.getAttribute('data-restore');
            if (!armed) {
              armed = true;
              b.textContent = 'Confirm Restore?';
              b.classList.add('armed');
              timer = setTimeout(function () {
                armed = false;
                b.textContent = 'Restore';
                b.classList.remove('armed');
              }, 5000);
              return;
            }
            clearTimeout(timer);
            b.textContent = 'Restoring…';
            api('adminRestoreResume', { version: ver }).then(function (r2) {
              if (r2 && r2.ok) loadResumeData();
              else {
                if (notLoggedIn(r2)) return;
                b.textContent = 'Restore';
                var m = document.getElementById('cvUpMsg');
                if (m) m.textContent = (r2 && r2.error) || 'Restore failed.';
              }
            });
          });
        });
      }
    }).catch(function () {
      if (hist) hist.innerHTML = '<p class="admin-msg">Could not reach the server.</p>';
    });
  }

  function handleCvFile(file) {
    var msg = document.getElementById('cvUpMsg');
    var prog = document.getElementById('cvProgress');
    var bar = document.getElementById('cvProgressBar');
    if (!canWrite()) { if (msg) msg.textContent = 'Your role cannot upload a CV.'; return; }
    if (!file) return;
    var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) { if (msg) msg.textContent = 'Only PDF files are accepted.'; return; }
    if (file.size > MAX_CV_BYTES) { if (msg) msg.textContent = 'File too large — maximum 5 MB.'; return; }
    if (msg) msg.textContent = 'Reading file…';
    if (prog) prog.hidden = false;
    if (bar) bar.style.width = '5%';
    var reader = new FileReader();
    reader.onload = function () {
      var base64 = String(reader.result).split(',')[1] || '';
      if (msg) msg.textContent = 'Uploading…';
      uploadCvXHR(file, base64, function (pct) {
        if (bar) bar.style.width = pct + '%';
      }).then(function (r) {
        if (bar) bar.style.width = '100%';
        if (r && r.ok) {
          if (msg) msg.textContent = 'CV uploaded and published' + (r.cv && r.cv.version ? ' as ' + r.cv.version : '') + '. The Download Resume button now serves the new file.';
          loadResumeData();
        } else {
          if (notLoggedIn(r)) return;
          if (msg) msg.textContent = (r && r.error) || 'Upload failed.';
        }
        setTimeout(function () { if (prog) prog.hidden = true; if (bar) bar.style.width = '0%'; }, 1200);
      }).catch(function () {
        if (msg) msg.textContent = 'Could not reach the server.';
        if (prog) prog.hidden = true;
      });
    };
    reader.onerror = function () {
      if (msg) msg.textContent = 'Could not read the file.';
      if (prog) prog.hidden = true;
    };
    reader.readAsDataURL(file);
  }

  function uploadCvXHR(file, base64, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', ENDPOINT, true);
      xhr.setRequestHeader('Content-Type', 'text/plain');
      xhr.upload.onprogress = function (ev) {
        if (ev.lengthComputable && onProgress) onProgress(Math.round(ev.loaded / ev.total * 100));
      };
      xhr.onload = function () {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch (e) { reject(new Error('bad response')); }
      };
      xhr.onerror = function () { reject(new Error('network error')); };
      xhr.send(JSON.stringify({
        action: 'adminUploadCV',
        token: getToken(),
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
        data: base64
      }));
    });
  }

  // ---------- settings tab (4 tabs) ----------

  function renderSettingsTab() {
    var tabs = [
      ['general', 'General'], ['email', 'Email'],
      ['integrations', 'Integrations'], ['security', 'Security']
    ];
    root.innerHTML = dashboardShell(
      '<div class="admin-settings-tabs">' + tabs.map(function (t) {
        return '<button class="admin-settings-tab' + (settingsTab === t[0] ? ' active' : '') +
          '" type="button" data-stab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>' +
      '<div id="settingsBody"><p class="admin-msg">Loading…</p></div>'
    );
    bindShell();
    root.querySelectorAll('[data-stab]').forEach(function (b) {
      b.addEventListener('click', function () {
        settingsTab = b.getAttribute('data-stab');
        renderSettingsTab();
      });
    });
    renderSettingsBody();
  }

  function renderSettingsBody() {
    var body = document.getElementById('settingsBody');
    if (!body) return;
    if (settingsTab === 'email') { renderSettingsEmail(body); return; }
    if (settingsTab === 'integrations') { renderSettingsIntegrations(body); return; }
    if (settingsTab === 'security') { renderSettingsSecurity(body); return; }
    renderSettingsGeneral(body);
  }

  function settingsValue(key, fallback) {
    if (settingsCache && settingsCache[key] !== undefined && settingsCache[key] !== null) return settingsCache[key];
    return fallback;
  }

  function renderSettingsGeneral(body) {
    body.innerHTML =
      '<form class="admin-form" id="siteForm">' +
      '<h3>Website Information</h3>' +
      '<label>Portfolio Title<input type="text" id="setTitle" value="' + esc(settingsValue('title', 'Mohamad Kaifoddin — AI/ML Engineer')) + '"></label>' +
      '<label>Contact Email<input type="email" id="setEmail" value="' + esc(settingsValue('email', 'skilltech011@gmail.com')) + '" required></label>' +
      '<label>Contact Phone<input type="tel" id="setPhone" value="' + esc(settingsValue('phone', '+91 70361 17014')) + '" required></label>' +
      '<label>Location<input type="text" id="setLocation" value="' + esc(settingsValue('location', 'Hyderabad, Telangana, India')) + '" required></label>' +
      '<label>Response Template<select id="setTemplate">' +
      Object.keys(RESPONSE_TEMPLATES).map(function (t) {
        return '<option' + (settingsValue('template', 'Default Template') === t ? ' selected' : '') + '>' + t + '</option>';
      }).join('') + '</select></label>' +
      '<p class="admin-note">The Response Template prefills the reply box when you respond to an enquiry.</p>' +
      '<label class="admin-check"><input type="checkbox" id="setFormEnabled"' + (settingsValue('formEnabled', true) ? ' checked' : '') + '> Enable Contact Form on the public site</label>' +
      '<label class="admin-check"><input type="checkbox" id="setTelegram"' + (settingsValue('telegram', true) ? ' checked' : '') + '> Send a Telegram notification for each new form message</label>' +
      '<p class="admin-msg" id="siteMsg"></p>' +
      '<button class="admin-btn admin-btn-red" type="submit">Save Changes</button>' +
      '</form>' +
      '<p class="admin-note">Saving updates the contact info everywhere on the public site at once.</p>';
    api('adminGetSettings', {}).then(function (r) {
      if (r && r.ok && r.settings) {
        settingsCache = r.settings;
        document.getElementById('setTitle').value = r.settings.title || 'Mohamad Kaifoddin — AI/ML Engineer';
        document.getElementById('setEmail').value = r.settings.email || '';
        document.getElementById('setPhone').value = r.settings.phone || '';
        document.getElementById('setLocation').value = r.settings.location || '';
        document.getElementById('setTemplate').value = r.settings.template || 'Default Template';
        document.getElementById('setFormEnabled').checked = r.settings.formEnabled !== false;
        document.getElementById('setTelegram').checked = !!r.settings.telegram;
      }
    }).catch(function () {});
    document.getElementById('siteForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!canWrite()) {
        document.getElementById('siteMsg').textContent = 'Your role cannot change settings.';
        return;
      }
      var msg = document.getElementById('siteMsg');
      msg.textContent = 'Saving…';
      var payload = {
        title: document.getElementById('setTitle').value.trim(),
        email: document.getElementById('setEmail').value.trim(),
        phone: document.getElementById('setPhone').value.trim(),
        location: document.getElementById('setLocation').value.trim(),
        template: document.getElementById('setTemplate').value,
        formEnabled: document.getElementById('setFormEnabled').checked,
        telegram: document.getElementById('setTelegram').checked
      };
      api('adminSetSettings', { settings: payload }).then(function (r) {
        if (r && r.ok) {
          settingsCache = r.settings || payload;
          msg.textContent = 'Site settings saved. The public site now shows the new contact info.';
        } else {
          if (notLoggedIn(r)) return;
          msg.textContent = (r && r.error) || 'Save failed.';
        }
      }).catch(function () { msg.textContent = 'Could not reach the server.'; });
    });
  }

  function renderSettingsEmail(body) {
    body.innerHTML =
      '<div class="admin-form">' +
      '<h3>Email</h3>' +
      '<p class="admin-note">Replies and test emails are sent through the connected Gmail account. There is no SMTP to configure.</p>' +
      '<dl class="admin-kv">' +
      '<dt>Sender email</dt><dd>' + esc(getAdminUser() || '—') + '</dd>' +
      '<dt>Sender name</dt><dd>Mohamad Kaifoddin</dd>' +
      '<dt>Provider</dt><dd>Gmail (Google Apps Script)</dd>' +
      '</dl>' +
      '<p class="admin-msg" id="testMailMsg"></p>' +
      '<button class="admin-btn admin-btn-red" type="button" id="testMailBtn">Send Test Email</button>' +
      '</div>';
    document.getElementById('testMailBtn').addEventListener('click', function () {
      var msg = document.getElementById('testMailMsg');
      msg.textContent = 'Sending…';
      api('adminTestEmail', {}).then(function (r) {
        if (r && r.ok) msg.textContent = 'Test email sent to ' + (getAdminUser() || 'your admin email') + '. Check the inbox.';
        else {
          if (notLoggedIn(r)) return;
          msg.textContent = (r && r.error) || 'Test email failed.';
        }
      }).catch(function () { msg.textContent = 'Could not reach the server.'; });
    });
  }

  function renderSettingsIntegrations(body) {
    var sync = lastSyncAt ? lastSyncAt.toLocaleString('en-IN') : 'Never';
    body.innerHTML =
      '<div class="admin-form">' +
      '<h3>Integrations</h3>' +
      '<dl class="admin-kv">' +
      '<dt>Google Sheets</dt><dd>' + (lastLoadError ? pill('Error', 'new') : pill('Connected', 'responded')) + '</dd>' +
      '<dt>Spreadsheet</dt><dd>portfolio_webiste_database</dd>' +
      '<dt>Tabs</dt><dd>contact · admin_users · resume_versions · activity_log</dd>' +
      '<dt>Last sync</dt><dd>' + esc(sync) + '</dd>' +
      (lastLoadError ? '<dt>Sync error</dt><dd>' + esc(lastLoadError) + '</dd>' : '') +
      '</dl>' +
      '<p class="admin-note">The contact form, inbox, users, resume versions and activity log all read from this spreadsheet. The admin panel loads its data from the same backend the form writes to, so the two stay in sync.</p>' +
      '<p class="admin-msg" id="syncMsg"></p>' +
      '<button class="admin-btn admin-btn-red" type="button" id="checkConnBtn">Check connection</button>' +
      '</div>';
    document.getElementById('checkConnBtn').addEventListener('click', function () {
      var msg = document.getElementById('syncMsg');
      msg.textContent = 'Checking…';
      refreshMessages(function (ok) {
        if (ok) {
          msg.textContent = 'Connected. Messages reloaded just now (' + messages.length + ' enquiries).';
          renderSettingsBody();
        } else {
          msg.textContent = lastLoadError || 'Connection failed.';
        }
      });
    });
  }

  function renderSettingsSecurity(body) {
    body.innerHTML =
      '<form class="admin-form" id="pwForm">' +
      '<h3>Change Password</h3>' +
      '<label>Current password<input type="password" id="pwCur" required autocomplete="current-password"></label>' +
      '<label>New password<input type="password" id="pwNew" required minlength="6" autocomplete="new-password"></label>' +
      '<label>Confirm new password<input type="password" id="pwNew2" required minlength="6" autocomplete="new-password"></label>' +
      '<p class="admin-msg" id="pwMsg"></p>' +
      '<button class="admin-btn admin-btn-red" type="submit">Change Password</button>' +
      '</form>' +
      '<div class="admin-form">' +
      '<h3>Session</h3>' +
      '<p class="admin-meta">Your admin session token is valid for 6 hours. Signing out ends it immediately.</p>' +
      '<p class="admin-meta">Passwords are stored as secure hashes in the Google Sheet — never in plain text and never in the website files.</p>' +
      '<p class="admin-meta">Signed in as <strong>' + esc(getAdminUser() || '') + '</strong> (' + esc(getRole()) + ').</p>' +
      '</div>';
    document.getElementById('pwForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var msg = document.getElementById('pwMsg');
      var np = document.getElementById('pwNew').value;
      if (np !== document.getElementById('pwNew2').value) {
        msg.textContent = 'New passwords do not match.';
        return;
      }
      msg.textContent = 'Changing…';
      api('adminChangePassword', {
        currentPassword: document.getElementById('pwCur').value,
        newPassword: np
      }).then(function (r) {
        if (r && r.ok) {
          msg.textContent = 'Password changed.';
          document.getElementById('pwForm').reset();
        } else {
          if (notLoggedIn(r)) return;
          msg.textContent = (r && r.error) || 'Change failed.';
        }
      }).catch(function () { msg.textContent = 'Could not reach the server.'; });
    });
  }

  // ---------- activity logs tab ----------

  function normLog(l) {
    return {
      timestamp: l.timestamp || l.date || l.time || '',
      action: l.action || '',
      by: l.performedBy || l.by || l.user || '',
      ref: l.recordRef || l.ref || l.record || '',
      details: l.details || ''
    };
  }

  function renderActivityTab() {
    root.innerHTML = dashboardShell(
      '<p class="admin-sub">Record of administrator actions. Logs are written by the backend and cannot be edited.</p>' +
      '<p class="admin-msg" id="actMsg">Loading…</p>' +
      '<div class="admin-table-wrap"><table class="admin-table" id="actTable">' +
      '<thead><tr><th>S.No.</th><th>Date and Time</th><th>Action</th><th>Performed By</th><th>Record</th></tr></thead>' +
      '<tbody></tbody></table></div>'
    );
    bindShell();
    api('adminListActivity', { limit: 100 }).then(function (r) {
      var msg = document.getElementById('actMsg');
      if (!r || !r.ok) {
        if (notLoggedIn(r)) return;
        if (msg) msg.textContent = (r && r.error) || 'Could not load activity logs.';
        return;
      }
      activityLogs = (r.logs || []).map(normLog);
      var tbody = document.querySelector('#actTable tbody');
      if (msg) msg.textContent = activityLogs.length + ' log entr' + (activityLogs.length === 1 ? 'y' : 'ies') + '.';
      if (!tbody) return;
      if (!activityLogs.length) {
        tbody.innerHTML = '<tr><td colspan="5">No activity recorded yet.</td></tr>';
        return;
      }
      tbody.innerHTML = activityLogs.map(function (l, i) {
        return '<tr><td>' + (i + 1) + '</td>' +
          '<td>' + esc(l.timestamp) + '</td>' +
          '<td>' + esc(l.action) + '</td>' +
          '<td>' + esc(l.by) + '</td>' +
          '<td title="' + esc(l.details || '') + '">' + esc(l.ref || '—') +
          (l.details ? '<br><span class="admin-meta">' + esc(l.details) + '</span>' : '') + '</td></tr>';
      }).join('');
    }).catch(function () {
      var msg = document.getElementById('actMsg');
      if (msg) msg.textContent = 'Could not reach the server.';
    });
  }

  // ---------- profile tab (v56 form, via header chip only) ----------

  function renderProfileTab() {
    root.innerHTML = dashboardShell(
      '<p class="admin-note">Your public identity on the portfolio — name, role, bio and links. Saving updates the live site at once (hero name, role, intro text, About section and GitHub link).</p>' +
      '<form class="admin-form" id="profileForm">' +
      '<div class="admin-grid">' +
      '<label>Full name<input type="text" id="pfName" required></label>' +
      '<label>Title / Role<input type="text" id="pfTitle" required placeholder="AI/ML Engineer"></label>' +
      '<label>Company<input type="text" id="pfCompany" placeholder="Artmac Soft Pvt Ltd"></label>' +
      '<label>Location<input type="text" id="pfLocation" placeholder="Hyderabad, Telangana, India"></label>' +
      '<label>Contact email<input type="email" id="pfEmail" required></label>' +
      '<label>Contact phone<input type="tel" id="pfPhone" required></label>' +
      '<label>GitHub URL<input type="url" id="pfGithub" placeholder="https://github.com/mrkaifu4u"></label>' +
      '<label>LinkedIn URL<input type="url" id="pfLinkedin" placeholder="https://www.linkedin.com/in/…"></label>' +
      '</div>' +
      '<label>Short bio — shown under your name on the home page<textarea id="pfBio" rows="3"></textarea></label>' +
      '<label>About — first paragraph of the About section<textarea id="pfAbout" rows="5"></textarea></label>' +
      '<p class="admin-msg" id="pfMsg">Loading…</p>' +
      '<button class="admin-btn admin-btn-red" type="submit">Save Profile</button>' +
      '</form>'
    );
    bindShell();
    api('adminGetProfile', {}).then(function (r) {
      var msg = document.getElementById('pfMsg');
      if (!r || !r.ok || !r.profile) {
        if (notLoggedIn(r)) return;
        if (msg) msg.textContent = (r && r.error) || 'Could not load profile.';
        return;
      }
      var p = r.profile;
      document.getElementById('pfName').value = p.name || '';
      document.getElementById('pfTitle').value = p.title || '';
      document.getElementById('pfCompany').value = p.company || '';
      document.getElementById('pfLocation').value = p.location || '';
      document.getElementById('pfEmail').value = p.email || '';
      document.getElementById('pfPhone').value = p.phone || '';
      document.getElementById('pfGithub').value = p.github || '';
      document.getElementById('pfLinkedin').value = p.linkedin || '';
      document.getElementById('pfBio').value = p.bio || '';
      document.getElementById('pfAbout').value = p.about || '';
      if (msg) msg.textContent = '';
    }).catch(function () {
      var msg = document.getElementById('pfMsg');
      if (msg) msg.textContent = 'Could not reach the server.';
    });
    document.getElementById('profileForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!canWrite()) {
        document.getElementById('pfMsg').textContent = 'Your role cannot change the profile.';
        return;
      }
      var msg = document.getElementById('pfMsg');
      msg.textContent = 'Saving…';
      api('adminSetProfile', {
        profile: {
          name: document.getElementById('pfName').value.trim(),
          title: document.getElementById('pfTitle').value.trim(),
          company: document.getElementById('pfCompany').value.trim(),
          location: document.getElementById('pfLocation').value.trim(),
          email: document.getElementById('pfEmail').value.trim(),
          phone: document.getElementById('pfPhone').value.trim(),
          github: document.getElementById('pfGithub').value.trim(),
          linkedin: document.getElementById('pfLinkedin').value.trim(),
          bio: document.getElementById('pfBio').value.trim(),
          about: document.getElementById('pfAbout').value.trim()
        }
      }).then(function (r) {
        if (r && r.ok) {
          msg.textContent = 'Profile saved. The live site now shows the new name, role, bio and About text.';
        } else {
          if (notLoggedIn(r)) return;
          msg.textContent = (r && r.error) || 'Save failed.';
        }
      }).catch(function () { msg.textContent = 'Could not reach the server.'; });
    });
  }

  // ---------- init ----------

  function init() {
    root = document.getElementById('admin-root');
    if (!root) return;
    window.addEventListener('hashchange', route);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') closeModal();
    });
    route();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
