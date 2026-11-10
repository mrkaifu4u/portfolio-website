// Admin panel for Mohamad Kaifoddin's portfolio.
// Hash routes: #admin_login (login), #admin_forgot (forgot password),
// #admin (dashboard: Messages / CV / Settings).
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
  var currentTab = 'messages';

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

  // ---------- views ----------

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

  function dashboardShell(inner) {
    return '<div class="admin-dash">' +
      '<header class="admin-topbar"><span class="admin-brand">MK &middot; Admin</span>' +
      '<nav class="admin-tabs">' +
      '<button data-tab="messages" class="' + (currentTab === 'messages' ? 'active' : '') + '">Messages</button>' +
      '<button data-tab="cv" class="' + (currentTab === 'cv' ? 'active' : '') + '">CV</button>' +
      '<button data-tab="settings" class="' + (currentTab === 'settings' ? 'active' : '') + '">Settings</button>' +
      '</nav>' +
      '<button class="admin-btn admin-btn-ghost" id="logoutBtn">Log Out</button>' +
      '</header>' +
      '<main class="admin-main">' + inner + '</main>' +
      '</div>';
  }

  function bindDash() {
    root.querySelectorAll('.admin-tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        currentTab = b.getAttribute('data-tab');
        selectedId = null;
        renderDashboard();
      });
    });
    document.getElementById('logoutBtn').addEventListener('click', function () {
      clearToken();
      go('#admin_login');
    });
  }

  function viewDashboard() {
    if (currentTab === 'cv') { renderCvTab(); return; }
    if (currentTab === 'settings') { renderSettingsTab(); return; }
    renderMessagesTab();
  }

  function renderDashboard() {
    if (!getToken()) { go('#admin_login'); return; }
    viewDashboard();
  }

  // ---------- messages tab (CRUD) ----------

  function renderMessagesTab() {
    root.innerHTML = dashboardShell(
      '<div class="admin-row"><h2>Messages</h2>' +
      '<button class="admin-btn admin-btn-red" id="addMsgBtn">+ Add Message</button></div>' +
      '<p class="admin-msg" id="msgListMsg">Loading…</p>' +
      '<div class="admin-table-wrap"><table class="admin-table" id="msgTable">' +
      '<thead><tr><th>Date</th><th>Name</th><th>Email</th><th>Purpose</th><th>Status</th><th>Priority</th></tr></thead>' +
      '<tbody></tbody></table></div>' +
      '<div id="msgDetail"></div>'
    );
    bindDash();
    document.getElementById('addMsgBtn').addEventListener('click', function () {
      selectedId = 'NEW';
      renderMessageForm(null);
    });
    loadMessages();
  }

  function loadMessages() {
    var msg = document.getElementById('msgListMsg');
    api('adminListMessages', {}).then(function (r) {
      if (!r || !r.ok) {
        if (r && r.error === 'not logged in') { clearToken(); go('#admin_login'); return; }
        msg.textContent = (r && r.error) || 'Could not load messages.';
        return;
      }
      messages = r.messages || [];
      msg.textContent = messages.length + ' message(s). Click a row to view / edit.';
      var tbody = document.querySelector('#msgTable tbody');
      tbody.innerHTML = messages.map(function (m) {
        return '<tr data-id="' + esc(m.submissionId) + '">' +
          '<td>' + esc(m.date) + ' ' + esc(m.time) + '</td>' +
          '<td>' + esc(m.name) + '</td>' +
          '<td>' + esc(m.email) + '</td>' +
          '<td>' + esc(m.purpose) + '</td>' +
          '<td>' + esc(m.status) + '</td>' +
          '<td>' + esc(m.priority) + '</td></tr>';
      }).join('');
      tbody.querySelectorAll('tr').forEach(function (tr) {
        tr.addEventListener('click', function () {
          selectedId = tr.getAttribute('data-id');
          var m = messages.find(function (x) { return x.submissionId === selectedId; });
          renderMessageForm(m || null);
        });
      });
      if (selectedId && selectedId !== 'NEW') {
        var m = messages.find(function (x) { return x.submissionId === selectedId; });
        if (m) renderMessageForm(m);
      }
    }).catch(function () {
      msg.textContent = 'Could not reach the server.';
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
      '</div></form>';
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
          if (r && r.error === 'not logged in') { clearToken(); go('#admin_login'); return; }
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
            alert((r && r.error) || 'Delete failed.');
          }
        });
      });
    }
  }

  // ---------- CV tab ----------

  function renderCvTab() {
    root.innerHTML = dashboardShell(
      '<h2>CV Manager</h2>' +
      '<p class="admin-msg" id="cvMsg">Loading…</p>' +
      '<div class="admin-card" id="cvCard"></div>' +
      '<form class="admin-form" id="cvForm">' +
      '<h3>Upload a new CV (PDF)</h3>' +
      '<label>Choose PDF<input type="file" id="cvFile" accept="application/pdf" required></label>' +
      '<p class="admin-msg" id="cvUpMsg"></p>' +
      '<button class="admin-btn admin-btn-red" type="submit">Upload &amp; Replace CV</button>' +
      '</form>'
    );
    bindDash();
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
            if (r && r.error === 'not logged in') { clearToken(); go('#admin_login'); return; }
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
    api('adminGetCV', {}).then(function (r) {
      if (!r || !r.ok) {
        if (r && r.error === 'not logged in') { clearToken(); go('#admin_login'); return; }
        msg.textContent = (r && r.error) || 'Could not load CV info.';
        return;
      }
      if (!r.cv) {
        msg.textContent = 'No CV uploaded yet. The site currently serves the built-in PDF.';
        card.innerHTML = '';
        return;
      }
      var d = r.cv.uploaded ? new Date(r.cv.uploaded) : null;
      msg.textContent = 'Current CV (served by the Download Resume button):';
      card.innerHTML =
        '<p><strong>' + esc(r.cv.name) + '</strong></p>' +
        '<p>Uploaded: ' + (d ? esc(d.toLocaleString()) : '—') +
        (r.cv.size ? ' &middot; ' + Math.round(r.cv.size / 1024) + ' KB' : '') + '</p>' +
        '<p><a href="' + esc(r.cv.url) + '" target="_blank" rel="noopener">Download / preview current CV</a></p>';
    }).catch(function () { msg.textContent = 'Could not reach the server.'; });
  }

  // ---------- settings tab ----------

  function renderSettingsTab() {
    root.innerHTML = dashboardShell(
      '<h2>Settings</h2>' +
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
    bindDash();
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
          if (r && r.error === 'not logged in') { clearToken(); go('#admin_login'); return; }
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
    } else if (h === '#admin') {
      if (!getToken()) { go('#admin_login'); return; }
      renderDashboard();
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
