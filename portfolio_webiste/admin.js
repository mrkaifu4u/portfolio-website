// Admin panel v56 — left sidebar navigation + Dashboard.
// Hash routes: #admin_login (login), #admin_forgot (forgot password),
// #admin (Dashboard), #admin_messages (Contact inbox), #admin_resume
// (CV manager with PDF preview), #admin_profile (Profile),
// #admin_settings (Settings).
// The admin talks to the same Google Apps Script backend as the contact
// form (FORM_ENDPOINT). The password is never in this file — login is
// verified server-side against the "admin_users" tab in the Google Sheet.
// A session token (from login) is kept in sessionStorage only.
(function () {
  'use strict';

  var ENDPOINT = window.FORM_ENDPOINT ||
    'https://script.google.com/macros/s/AKfycbxIXwrvVjy5i5B5rwu5DCjZE12g5bqf8wruhVQ_IW7CvMUZ6FcG_c9mDTicn_Jk6JB-/exec';
  var TOKEN_KEY = 'adminToken';
  var root = null;
  var messages = [];
  var selectedId = null;
  var currentTab = 'dashboard';
  var filterText = '';
  var filterStatus = 'All';
  var filterPriority = 'All';

  function isAdminHash() {
    var h = location.hash || '';
    return h === '#admin_login' || h === '#admin_forgot' ||
      h === '#admin' || h.indexOf('#admin_') === 0;
  }

  function getToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try { sessionStorage.setItem(TOKEN_KEY, t); } catch (e) {}
  }
  function clearToken() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
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
    if (r && r.error === 'not logged in') { clearToken(); go('#admin_login'); return true; }
    return false;
  }

  // ---------- login / forgot password ----------

  function viewLogin() {
    root.innerHTML =
      '<div class="admin-card admin-login">' +
      '<div class="admin-logo">MK</div>' +
      '<h1>Admin Login</h1>' +
      '<p class="admin-sub">Sign in to manage your portfolio.</p>' +
      '<form id="loginForm">' +
      '<label>Username<input type="email" id="loginUser" required autocomplete="username" placeholder="you@example.com"></label>' +
      '<label>Password<input type="password" id="loginPass" required autocomplete="current-password" placeholder="Your password"></label>' +
      '<p class="admin-msg" id="loginMsg"></p>' +
      '<button class="admin-btn admin-btn-red" type="submit">Log In</button>' +
      '</form>' +
      '<p class="admin-link"><a href="#admin_forgot">Forgot password?</a></p>' +
      '<p class="admin-back"><a href="#home">&larr; Back to portfolio</a></p>' +
      '</div>';
    document.getElementById('loginForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var msg = document.getElementById('loginMsg');
      msg.textContent = 'Signing in…';
      api('adminLogin', {
        username: document.getElementById('loginUser').value.trim(),
        password: document.getElementById('loginPass').value
      }).then(function (r) {
        if (r && r.ok && r.token) {
          setToken(r.token);
          go('#admin');
        } else {
          msg.textContent = (r && r.error) || 'Login failed. Try again.';
        }
      }).catch(function () {
        msg.textContent = 'Could not reach the server. Check your connection and try again.';
      });
    });
  }

  function viewForgot() {
    root.innerHTML =
      '<div class="admin-card admin-login">' +
      '<div class="admin-logo">MK</div>' +
      '<h1>Forgot Password</h1>' +
      '<p class="admin-sub">We will email a one-time code to your admin email.</p>' +
      '<form id="otpReqForm">' +
      '<label>Username<input type="email" id="otpUser" required autocomplete="username" placeholder="you@example.com"></label>' +
      '<p class="admin-msg" id="otpMsg"></p>' +
      '<button class="admin-btn admin-btn-red" type="submit">Send Code</button>' +
      '</form>' +
      '<form id="otpResetForm" hidden>' +
      '<label>One-time code<input type="text" id="otpCode" required inputmode="numeric" maxlength="6" placeholder="6-digit code"></label>' +
      '<label>New password<input type="password" id="otpNew" required minlength="6" autocomplete="new-password" placeholder="At least 6 characters"></label>' +
      '<p class="admin-msg" id="otpResetMsg"></p>' +
      '<button class="admin-btn admin-btn-red" type="submit">Reset Password</button>' +
      '</form>' +
      '<p class="admin-link"><a href="#admin_login">Back to login</a></p>' +
      '</div>';
    var user = '';
    document.getElementById('otpReqForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      user = document.getElementById('otpUser').value.trim();
      var msg = document.getElementById('otpMsg');
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

  // ---------- sidebar shell ----------

  var TABS = [
    { id: 'dashboard', hash: '#admin', label: 'Dashboard', icon: '▦' },
    { id: 'messages', hash: '#admin_messages', label: 'Messages', icon: '✉' },
    { id: 'resume', hash: '#admin_resume', label: 'Resume', icon: '▤' },
    { id: 'profile', hash: '#admin_profile', label: 'Profile', icon: '◉' },
    { id: 'settings', hash: '#admin_settings', label: 'Settings', icon: '⚙' }
  ];
  var TITLES = {
    dashboard: 'Dashboard',
    messages: 'Messages',
    resume: 'Resume',
    profile: 'Profile',
    settings: 'Settings'
  };

  function navItem(t) {
    var badge = '';
    if (t.id === 'messages') {
      badge = '<span class="admin-nav-badge" id="navMsgBadge" hidden></span>';
    }
    return '<a href="' + t.hash + '" class="admin-nav-item' +
      (currentTab === t.id ? ' active' : '') + '">' +
      '<span class="admin-nav-icon">' + t.icon + '</span>' +
      '<span class="admin-nav-label">' + t.label + '</span>' + badge + '</a>';
  }

  function dashboardShell(inner) {
    var today = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    return '<div class="admin-shell">' +
      '<aside class="admin-sidebar" id="adminSidebar">' +
      '<div class="admin-side-brand">' +
      '<span class="admin-logo admin-logo-sm">MK</span>' +
      '<div class="admin-side-brand-text"><strong>Mohamad Kaifoddin</strong><span>Admin Panel</span></div>' +
      '</div>' +
      '<nav class="admin-nav">' + TABS.map(navItem).join('') + '</nav>' +
      '<div class="admin-side-foot">' +
      '<a href="#home" class="admin-side-link">↗ View live site</a>' +
      '<button class="admin-btn admin-btn-ghost admin-logout" id="logoutBtn">Log Out</button>' +
      '</div>' +
      '</aside>' +
      '<div class="admin-main-wrap">' +
      '<header class="admin-header">' +
      '<button class="admin-menu-btn" id="sideToggle" type="button" aria-label="Toggle menu">☰</button>' +
      '<h2>' + (TITLES[currentTab] || 'Dashboard') + '</h2>' +
      '<span class="admin-header-date">' + esc(today) + '</span>' +
      '</header>' +
      '<main class="admin-main">' + inner + '</main>' +
      '</div>' +
      '</div>';
  }

  function bindShell() {
    document.getElementById('logoutBtn').addEventListener('click', function () {
      clearToken();
      go('#admin_login');
    });
    document.getElementById('sideToggle').addEventListener('click', function () {
      document.getElementById('adminSidebar').classList.toggle('open');
    });
    // Tapping a nav item on a small screen closes the drawer.
    root.querySelectorAll('.admin-nav-item').forEach(function (a) {
      a.addEventListener('click', function () {
        document.getElementById('adminSidebar').classList.remove('open');
      });
    });
    updateNavBadge();
  }

  function updateNavBadge() {
    var b = document.getElementById('navMsgBadge');
    if (!b) return;
    var n = messages.filter(function (m) { return m.status === 'New'; }).length;
    if (n > 0) {
      b.hidden = false;
      b.textContent = n;
    } else {
      b.hidden = true;
    }
  }

  function renderTab() {
    if (!getToken()) { go('#admin_login'); return; }
    if (currentTab === 'messages') { renderMessagesTab(); return; }
    if (currentTab === 'resume') { renderResumeTab(); return; }
    if (currentTab === 'profile') { renderProfileTab(); return; }
    if (currentTab === 'settings') { renderSettingsTab(); return; }
    renderDashboardTab();
  }

  // ---------- dashboard tab ----------

  function statCard(n, label, tone) {
    return '<div class="admin-stat' + (tone ? ' admin-stat-' + tone : '') + '">' +
      '<span class="admin-stat-num">' + n + '</span>' +
      '<span class="admin-stat-label">' + label + '</span></div>';
  }

  function renderDashboardTab() {
    root.innerHTML = dashboardShell(
      '<p class="admin-welcome">Welcome back, <strong>Mohamad</strong>. Here is what is happening on your portfolio.</p>' +
      '<div class="admin-stats" id="dashStats"><p class="admin-msg">Loading stats…</p></div>' +
      '<div class="admin-dash-grid">' +
      '<section class="admin-panel"><h3>Recent messages</h3><div id="dashRecent"><p class="admin-msg">Loading…</p></div>' +
      '<p><a class="admin-link" href="#admin_messages">View all messages →</a></p></section>' +
      '<section class="admin-panel"><h3>Resume</h3><div id="dashCv"><p class="admin-msg">Loading…</p></div>' +
      '<p><a class="admin-link" href="#admin_resume">Manage resume →</a></p></section>' +
      '<section class="admin-panel"><h3>Quick actions</h3>' +
      '<div class="admin-actions">' +
      '<a class="admin-btn admin-btn-red" href="#admin_messages">+ Add Message</a>' +
      '<a class="admin-btn admin-btn-ghost" href="#admin_resume">Upload CV</a>' +
      '<button class="admin-btn admin-btn-ghost" id="dashExportBtn" type="button">Export CSV</button>' +
      '<a class="admin-btn admin-btn-ghost" href="#home" target="_blank" rel="noopener">View Live Site</a>' +
      '</div>' +
      '<h3 class="admin-h3">Notifications</h3><div id="dashNotify"><p class="admin-msg">Loading…</p></div>' +
      '</section>' +
      '</div>'
    );
    bindShell();
    document.getElementById('dashExportBtn').addEventListener('click', exportCsv);
    loadDashboard();
  }

  function loadDashboard() {
    // Messages → stats + recent list + sidebar badge.
    api('adminListMessages', {}).then(function (r) {
      if (!r || !r.ok) { if (notLoggedIn(r)) return; return; }
      messages = r.messages || [];
      updateNavBadge();
      var nNew = 0, nRead = 0, nReplied = 0, nHigh = 0;
      messages.forEach(function (m) {
        if (m.status === 'New') nNew++;
        else if (m.status === 'Read') nRead++;
        else if (m.status === 'Replied') nReplied++;
        if (m.priority === 'High') nHigh++;
      });
      var s = document.getElementById('dashStats');
      if (s) {
        s.innerHTML = statCard(messages.length, 'Total messages') +
          statCard(nNew, 'New', 'red') + statCard(nRead, 'Read') +
          statCard(nReplied, 'Replied', 'green') + statCard(nHigh, 'High priority');
      }
      var rec = document.getElementById('dashRecent');
      if (rec) {
        if (!messages.length) {
          rec.innerHTML = '<p class="admin-msg">No messages yet. New form submissions will appear here.</p>';
        } else {
          rec.innerHTML = '<ul class="admin-recent">' + messages.slice(0, 5).map(function (m) {
            return '<li><a href="#admin_messages"><strong>' + esc(m.name) + '</strong>' +
              '<span>' + esc(m.purpose || '') + ' · ' + esc(m.date || '') + '</span>' +
              '<em class="admin-pill admin-pill-' + (m.status || '').toLowerCase() + '">' + esc(m.status || '') + '</em>' +
              '</a></li>';
          }).join('') + '</ul>';
        }
      }
    }).catch(function () {});
    // CV status card.
    api('adminGetCV', {}).then(function (r) {
      var el = document.getElementById('dashCv');
      if (!el) return;
      if (!r || !r.ok || !r.cv) {
        el.innerHTML = '<p class="admin-msg">No CV uploaded yet. The site serves the built-in PDF.</p>';
        return;
      }
      var d = r.cv.uploaded ? new Date(r.cv.uploaded) : null;
      el.innerHTML = '<p><strong>' + esc(r.cv.name) + '</strong></p>' +
        '<p class="admin-meta">Uploaded: ' + (d ? esc(d.toLocaleDateString('en-IN')) : '—') +
        (r.cv.size ? ' · ' + Math.round(r.cv.size / 1024) + ' KB' : '') + '</p>' +
        '<p><a class="admin-link" href="' + esc(r.cv.url) + '" target="_blank" rel="noopener">Download current CV ↓</a></p>';
    }).catch(function () {});
    // Telegram notification status.
    api('adminGetSettings', {}).then(function (r) {
      var el = document.getElementById('dashNotify');
      if (!el) return;
      if (!r || !r.ok || !r.settings) {
        el.innerHTML = '<p class="admin-msg">Could not load notification settings.</p>';
        return;
      }
      el.innerHTML = '<p class="admin-meta">Telegram notifications: <strong>' +
        (r.settings.telegram ? 'ON' : 'OFF') + '</strong> — ' +
        (r.settings.telegram
          ? 'you get a Telegram message for every new form submission.'
          : 'new form submissions will not ping Telegram.') + '</p>' +
        '<p class="admin-meta">Contact email on the site: <strong>' + esc(r.settings.email || '') + '</strong></p>';
    }).catch(function () {});
  }

  // ---------- messages tab (Contact inbox, CRUD) ----------

  function renderMessagesTab() {
    root.innerHTML = dashboardShell(
      '<div class="admin-row"><h2>Messages</h2>' +
      '<span><button class="admin-btn admin-btn-ghost" id="exportCsvBtn">Export CSV</button> ' +
      '<button class="admin-btn admin-btn-red" id="addMsgBtn">+ Add Message</button></span></div>' +
      '<div class="admin-filters">' +
      '<input type="search" id="filterText" placeholder="Search name, email or message…" value="' + esc(filterText) + '">' +
      '<select id="filterStatus">' +
      ['All', 'New', 'Read', 'Replied'].map(function (s) {
        return '<option' + (filterStatus === s ? ' selected' : '') + '>' + s + '</option>';
      }).join('') + '</select>' +
      '<select id="filterPriority">' +
      ['All', 'High', 'Medium', 'Low'].map(function (p) {
        return '<option' + (filterPriority === p ? ' selected' : '') + '>' + p + '</option>';
      }).join('') + '</select>' +
      '</div>' +
      '<p class="admin-msg" id="msgListMsg">Loading…</p>' +
      '<div class="admin-table-wrap"><table class="admin-table" id="msgTable">' +
      '<thead><tr><th>Date</th><th>Name</th><th>Email</th><th>Purpose</th><th>Status</th><th>Priority</th></tr></thead>' +
      '<tbody></tbody></table></div>' +
      '<div id="msgDetail"></div>'
    );
    bindShell();
    document.getElementById('addMsgBtn').addEventListener('click', function () {
      selectedId = 'NEW';
      renderMessageForm(null);
    });
    document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);
    var ft = document.getElementById('filterText');
    ft.addEventListener('input', function () { filterText = ft.value; renderTable(); });
    document.getElementById('filterStatus').addEventListener('change', function (ev) {
      filterStatus = ev.target.value; renderTable();
    });
    document.getElementById('filterPriority').addEventListener('change', function (ev) {
      filterPriority = ev.target.value; renderTable();
    });
    loadMessages();
  }

  function filteredMessages() {
    var q = (filterText || '').toLowerCase();
    return messages.filter(function (m) {
      if (filterStatus !== 'All' && m.status !== filterStatus) return false;
      if (filterPriority !== 'All' && m.priority !== filterPriority) return false;
      if (q) {
        var hay = ((m.name || '') + ' ' + (m.email || '') + ' ' +
          (m.message || '') + ' ' + (m.purpose || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function pill(text, kind) {
    return '<span class="admin-pill admin-pill-' + kind + '">' + esc(text) + '</span>';
  }

  function renderTable() {
    var msg = document.getElementById('msgListMsg');
    var list = filteredMessages();
    if (msg) {
      msg.textContent = list.length + ' of ' + messages.length +
        ' message(s). Click a row to view / edit.';
    }
    var tbody = document.querySelector('#msgTable tbody');
    if (!tbody) return;
    tbody.innerHTML = list.map(function (m) {
      return '<tr data-id="' + esc(m.submissionId) + '">' +
        '<td>' + esc(m.date) + ' ' + esc(m.time) + '</td>' +
        '<td>' + esc(m.name) + '</td>' +
        '<td>' + esc(m.email) + '</td>' +
        '<td>' + esc(m.purpose) + '</td>' +
        '<td>' + pill(m.status, (m.status || '').toLowerCase()) + '</td>' +
        '<td>' + pill(m.priority, (m.priority || '').toLowerCase()) + '</td></tr>';
    }).join('');
    tbody.querySelectorAll('tr').forEach(function (tr) {
      tr.addEventListener('click', function () {
        selectedId = tr.getAttribute('data-id');
        var m = messages.find(function (x) { return x.submissionId === selectedId; });
        renderMessageForm(m || null);
      });
    });
  }

  function exportCsv() {
    var list = filteredMessages();
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
  }

  function loadMessages() {
    var msg = document.getElementById('msgListMsg');
    api('adminListMessages', {}).then(function (r) {
      if (!r || !r.ok) {
        if (notLoggedIn(r)) return;
        if (msg) msg.textContent = (r && r.error) || 'Could not load messages.';
        return;
      }
      messages = r.messages || [];
      updateNavBadge();
      renderTable();
      if (selectedId && selectedId !== 'NEW') {
        var m = messages.find(function (x) { return x.submissionId === selectedId; });
        if (m) renderMessageForm(m);
      }
    }).catch(function () {
      if (msg) msg.textContent = 'Could not reach the server.';
    });
  }

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
      ['New', 'Read', 'Replied'].map(function (s) {
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
      (isNew ? '' :
      '<div class="admin-reply">' +
      '<h3>Reply by Email</h3>' +
      '<p class="admin-note">Replies go to ' + esc(d.email || '') + ' from your Gmail. Sending marks this message Replied.</p>' +
      '<textarea id="replyText" rows="4" placeholder="Write your reply…"></textarea>' +
      '<p class="admin-msg" id="replyMsg"></p>' +
      '<button class="admin-btn admin-btn-red" type="button" id="sendReplyBtn">Send Reply</button>' +
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
          loadMessages();
        } else {
          if (notLoggedIn(r)) return;
          msg.textContent = (r && r.error) || 'Save failed.';
        }
      }).catch(function () { msg.textContent = 'Could not reach the server.'; });
    });
    document.getElementById('cancelMsgBtn').addEventListener('click', function () {
      document.getElementById('msgDetail').innerHTML = '';
      selectedId = null;
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
            document.getElementById('msgDetail').innerHTML = '';
            loadMessages();
          } else {
            if (notLoggedIn(r)) return;
            var m = document.getElementById('msgFormMsg');
            if (m) m.textContent = (r && r.error) || 'Delete failed.';
          }
        });
      });
    }
    var sendReply = document.getElementById('sendReplyBtn');
    if (sendReply) {
      sendReply.addEventListener('click', function () {
        var text = document.getElementById('replyText').value.trim();
        var rmsg = document.getElementById('replyMsg');
        if (!text) { rmsg.textContent = 'Write a reply first.'; return; }
        rmsg.textContent = 'Sending…';
        api('adminReplyMessage', { submissionId: d.submissionId, reply: text }).then(function (r) {
          if (r && r.ok) {
            rmsg.textContent = 'Reply sent. Message marked Replied.';
            document.getElementById('replyText').value = '';
            loadMessages();
          } else {
            if (notLoggedIn(r)) return;
            rmsg.textContent = (r && r.error) || 'Reply failed.';
          }
        }).catch(function () { rmsg.textContent = 'Could not reach the server.'; });
      });
    }
  }

  // ---------- resume tab (CV manager: view, upload, delete) ----------

  function renderResumeTab() {
    root.innerHTML = dashboardShell(
      '<h2>Resume</h2>' +
      '<p class="admin-note">Your current CV, as visitors see it. Uploading a new PDF replaces it everywhere at once — the Download Resume button on the live site serves the new file immediately.</p>' +
      '<p class="admin-msg" id="cvMsg">Loading…</p>' +
      '<div id="cvViewerWrap"></div>' +
      '<div class="admin-card-wide" id="cvCard"></div>' +
      '<form class="admin-form" id="cvForm">' +
      '<h3>Upload a new CV (PDF)</h3>' +
      '<label>Choose PDF<input type="file" id="cvFile" accept="application/pdf" required></label>' +
      '<p class="admin-msg" id="cvUpMsg"></p>' +
      '<button class="admin-btn admin-btn-red" type="submit">Upload &amp; Replace CV</button>' +
      '</form>'
    );
    bindShell();
    loadCv();
    document.getElementById('cvForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var file = document.getElementById('cvFile').files[0];
      var msg = document.getElementById('cvUpMsg');
      if (!file) { msg.textContent = 'Choose a PDF first.'; return; }
      if (file.type !== 'application/pdf') { msg.textContent = 'Only PDF files are accepted.'; return; }
      msg.textContent = 'Uploading…';
      var reader = new FileReader();
      reader.onload = function () {
        var base64 = String(reader.result).split(',')[1] || '';
        api('adminUploadCV', { fileName: file.name, mimeType: file.type, data: base64 }).then(function (r) {
          if (r && r.ok) {
            msg.textContent = 'CV updated. The Download Resume button now serves the new file.';
            loadCv();
          } else {
            if (notLoggedIn(r)) return;
            msg.textContent = (r && r.error) || 'Upload failed.';
          }
        }).catch(function () { msg.textContent = 'Could not reach the server.'; });
      };
      reader.readAsDataURL(file);
    });
  }

  function loadCv() {
    var msg = document.getElementById('cvMsg');
    var card = document.getElementById('cvCard');
    var viewer = document.getElementById('cvViewerWrap');
    api('adminGetCV', {}).then(function (r) {
      if (!r || !r.ok) {
        if (notLoggedIn(r)) return;
        if (msg) msg.textContent = (r && r.error) || 'Could not load CV info.';
        return;
      }
      if (!r.cv) {
        if (msg) msg.textContent = 'No CV uploaded yet — showing the built-in CV file below. Upload a new PDF to replace it.';
        if (viewer) {
          viewer.innerHTML = '<iframe class="admin-cv-viewer" src="Mohamad_Kaifoddin_AI_ML_Engineer_1-3Yrs.pdf" title="Built-in CV preview" loading="lazy"></iframe>' +
            '<p class="admin-meta">This is the built-in CV that the Download Resume button serves right now.</p>';
        }
        if (card) card.innerHTML = '';
        return;
      }
      var d = r.cv.uploaded ? new Date(r.cv.uploaded) : null;
      if (msg) msg.textContent = 'Current CV (served by the Download Resume button):';
      if (viewer) {
        viewer.innerHTML = '<iframe class="admin-cv-viewer" src="' + esc(r.cv.preview || '') +
          '" title="Current CV preview" loading="lazy"></iframe>' +
          '<p class="admin-meta">If the preview does not load, <a href="' + esc(r.cv.url) +
          '" target="_blank" rel="noopener">open the PDF in a new tab</a>.</p>';
      }
      if (card) {
        card.innerHTML =
          '<p><strong>' + esc(r.cv.name) + '</strong></p>' +
          '<p class="admin-meta">Uploaded: ' + (d ? esc(d.toLocaleString('en-IN')) : '—') +
          (r.cv.size ? ' &middot; ' + Math.round(r.cv.size / 1024) + ' KB' : '') + '</p>' +
          '<div class="admin-row">' +
          '<a class="admin-btn admin-btn-red" href="' + esc(r.cv.url) + '" target="_blank" rel="noopener">Download CV</a> ' +
          '<button class="admin-btn admin-btn-danger" type="button" id="delCvBtn">Delete CV</button>' +
          '</div>' +
          '<p class="admin-note">Deleting removes the file from Drive. The site then falls back to the built-in PDF until you upload a new one.</p>';
        var del = document.getElementById('delCvBtn');
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
            if (r2 && r2.ok) {
              loadCv();
            } else {
              if (notLoggedIn(r2)) return;
              del.textContent = 'Delete CV';
              if (msg) msg.textContent = (r2 && r2.error) || 'Delete failed.';
            }
          }).catch(function () {
            del.textContent = 'Delete CV';
            if (msg) msg.textContent = 'Could not reach the server.';
          });
        });
      }
    }).catch(function () {
      if (msg) msg.textContent = 'Could not reach the server.';
    });
  }

  // ---------- profile tab ----------

  function renderProfileTab() {
    root.innerHTML = dashboardShell(
      '<h2>Profile</h2>' +
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

  // ---------- settings tab ----------

  function renderSettingsTab() {
    root.innerHTML = dashboardShell(
      '<h2>Settings</h2>' +
      '<form class="admin-form" id="siteForm">' +
      '<h3>Site Settings</h3>' +
      '<p class="admin-note">The contact info shown on the public site. Saving updates it everywhere on the site.</p>' +
      '<label>Contact email<input type="email" id="setEmail" required></label>' +
      '<label>Contact phone<input type="tel" id="setPhone" required></label>' +
      '<label>Location<input type="text" id="setLocation" required></label>' +
      '<label class="admin-check"><input type="checkbox" id="setTelegram"> Send a Telegram notification for each new form message</label>' +
      '<p class="admin-msg" id="siteMsg"></p>' +
      '<button class="admin-btn admin-btn-red" type="submit">Save Site Settings</button>' +
      '</form>' +
      '<form class="admin-form" id="pwForm">' +
      '<h3>Change Password</h3>' +
      '<label>Current password<input type="password" id="pwCur" required autocomplete="current-password"></label>' +
      '<label>New password<input type="password" id="pwNew" required minlength="6" autocomplete="new-password"></label>' +
      '<label>Confirm new password<input type="password" id="pwNew2" required minlength="6" autocomplete="new-password"></label>' +
      '<p class="admin-msg" id="pwMsg"></p>' +
      '<button class="admin-btn admin-btn-red" type="submit">Change Password</button>' +
      '</form>' +
      '<p class="admin-note">Your login is stored in the Google Sheet tab “admin_users”. Changing it here updates that tab.</p>'
    );
    bindShell();
    api('adminGetSettings', {}).then(function (r) {
      if (r && r.ok && r.settings) {
        document.getElementById('setEmail').value = r.settings.email || '';
        document.getElementById('setPhone').value = r.settings.phone || '';
        document.getElementById('setLocation').value = r.settings.location || '';
        document.getElementById('setTelegram').checked = !!r.settings.telegram;
      }
    }).catch(function () {});
    document.getElementById('siteForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var msg = document.getElementById('siteMsg');
      msg.textContent = 'Saving…';
      api('adminSetSettings', {
        settings: {
          email: document.getElementById('setEmail').value.trim(),
          phone: document.getElementById('setPhone').value.trim(),
          location: document.getElementById('setLocation').value.trim(),
          telegram: document.getElementById('setTelegram').checked
        }
      }).then(function (r) {
        if (r && r.ok) {
          msg.textContent = 'Site settings saved. The public site now shows the new contact info.';
        } else {
          if (notLoggedIn(r)) return;
          msg.textContent = (r && r.error) || 'Save failed.';
        }
      }).catch(function () { msg.textContent = 'Could not reach the server.'; });
    });
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
    } else if (h === '#admin' || h === '#admin_messages' || h === '#admin_resume' ||
               h === '#admin_profile' || h === '#admin_settings') {
      if (!getToken()) { go('#admin_login'); return; }
      currentTab = h === '#admin' ? 'dashboard' : h.replace('#admin_', '');
      selectedId = null;
      renderTab();
    }
  }

  function init() {
    root = document.getElementById('admin-root');
    if (!root) return;
    window.addEventListener('hashchange', route);
    route();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
