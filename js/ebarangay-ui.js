
(function () {
  'use strict';

  var REMEMBER_KEY = 'ebarangay_remember_user';

  function el(id) { return document.getElementById(id); }

  /* ---------- password visibility ---------- */
  window.ebTogglePassword = function () {
    var input = el('loginPassword');
    var btn = el('ebEye');
    if (!input || !btn) return;
    var hidden = input.type === 'password';
    input.type = hidden ? 'text' : 'password';
    btn.innerHTML = '<i class="fas fa-eye' + (hidden ? '' : '-slash') + '"></i>';
    btn.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
    input.focus();
  };

  /* forgot password */
  window.ebForgotPassword = function () {
    if (typeof window.showForgotForm === 'function') {
      window.showForgotForm();
      return;
    }
    var msg = 'Password resets are handled at the barangay hall. Ask the Barangay Secretary to reset your account.';
    if (typeof showToast === 'function') showToast(msg, 'error');
    else alert(msg);
  };

  /*  remember me  */
  function restoreRemembered() {
    try {
      var saved = localStorage.getItem(REMEMBER_KEY);
      if (!saved) return;
      var u = el('loginUsername');
      var c = el('ebRemember');
      if (u) u.value = saved;
      if (c) c.checked = true;
      var p = el('loginPassword');
      if (p) p.focus();
    } catch (e) {}
  }

  function storeRemembered() {
    try {
      var c = el('ebRemember');
      var u = el('loginUsername');
      if (c && c.checked && u && u.value.trim()) localStorage.setItem(REMEMBER_KEY, u.value.trim());
      else localStorage.removeItem(REMEMBER_KEY);
    } catch (e) {}
  }

  /* ---------- enter key submits the login form ---------- */
  function wireEnterKey() {
    ['loginUsername', 'loginPassword'].forEach(function (id) {
      var input = el(id);
      if (!input) return;
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && typeof window.login === 'function') {
          ev.preventDefault();
          window.login();
        }
      });
    });
  }

  /* ---------- greeting + date ---------- */
  var SUBTITLES = {
    Admin: "Here's an overview of the barangay's records and requests.",
    Captain: "Here's an overview of the barangay's records and requests.",
    Secretary: 'Review registrations, verify residents, and endorse document requests.',
    Treasurer: 'Verify payments and release the documents that are already settled.',
    Resident: 'Request documents and track the status of your requests here.'
  };

  function currentUser() {
    try { return (typeof data !== 'undefined' && data) ? data.currentUser : null; } catch (e) { return null; }
  }

  var TITLES = /^(hon\.?|kap\.?|kgd\.?|brgy\.?|capt\.?|cpt\.?|mr\.?|mrs\.?|ms\.?|dr\.?|engr\.?|atty\.?)$/i;

  function firstName(user) {
    var name = (user && (user.name || user.username)) || 'there';
    var parts = String(name).trim().split(/\s+/).filter(Boolean);
    while (parts.length > 1 && TITLES.test(parts[0])) parts.shift();
    return parts[0] || 'there';
  }

  function timeOfDay() {
    var h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  function refreshGreeting() {
    var u = currentUser();
    var titleText = timeOfDay() + ', ' + firstName(u) + '!';
    var subText = (u && SUBTITLES[u.role]) || SUBTITLES.Admin;

    var now = new Date();
    var mainText = now.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
    var dayText = now.toLocaleDateString('en-PH', { weekday: 'long' });

    var title = el('ebGreetTitle');
    var sub = el('ebGreetSub');
    var main = el('ebDateMain');
    var day = el('ebDateDay');
    if (title) title.textContent = titleText;
    if (sub) sub.textContent = subText;
    if (main) main.textContent = mainText;
    if (day) day.textContent = dayText;

    document.querySelectorAll('.eb-greet-title').forEach(function (n) { n.textContent = titleText; });
    document.querySelectorAll('.eb-greet-sub').forEach(function (n) { n.textContent = subText; });
    document.querySelectorAll('.eb-date-main').forEach(function (n) { n.textContent = mainText; });
    document.querySelectorAll('.eb-date-day').forEach(function (n) { n.textContent = dayText; });
  }

  /* ---------- header avatar mirrors the sidebar user ---------- */
  function refreshHeadAvatar() {
    var u = currentUser();
    var av = el('ebHeadAvatar');
    if (!av) return;
    var name = (u && (u.name || u.username)) || 'U';
    av.textContent = String(name).charAt(0).toUpperCase();
    av.title = name + (u ? ' · ' + (typeof displayRole === 'function' ? displayRole(u.role) : u.role) : '');
  }

  /* ---------- header search filters the open module's tables ---------- */
  function filterActiveModule(term) {
    var mod = document.querySelector('.module.active');
    if (!mod) return;
    var q = term.trim().toLowerCase();
    mod.querySelectorAll('table tbody').forEach(function (body) {
      var hits = 0;
      body.querySelectorAll('tr').forEach(function (row) {
        if (row.dataset.ebEmpty === '1') { row.remove(); return; }
        var match = !q || row.textContent.toLowerCase().indexOf(q) >= 0;
        row.style.display = match ? '' : 'none';
        if (match) hits++;
      });
      if (q && hits === 0 && body.children.length) {
        var cols = body.closest('table').querySelectorAll('thead th').length || 1;
        var tr = document.createElement('tr');
        tr.dataset.ebEmpty = '1';
        tr.innerHTML = '<td colspan="' + cols + '" style="text-align:center;color:#5A7B76;padding:22px;">' +
          'No rows match “' + q.replace(/[<>&]/g, '') + '” on this page.</td>';
        body.appendChild(tr);
      }
    });
  }

  function wireSearch() {
    var input = el('ebGlobalSearch');
    if (!input) return;
    input.addEventListener('input', function () { filterActiveModule(input.value); });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { input.value = ''; filterActiveModule(''); input.blur(); }
    });
  }

  function clearSearch() {
    var input = el('ebGlobalSearch');
    if (input && input.value) { input.value = ''; }
  }

  /* ---------- hook into the existing app functions ---------- */
  function wrap(name, after) {
    var original = window[name];
    if (typeof original !== 'function') return;
    window[name] = function () {
      var out = original.apply(this, arguments);
      try { after.apply(this, arguments); } catch (e) { console.warn(name + ' ui hook', e); }
      return out;
    };
  }

  function boot() {
    restoreRemembered();
    wireEnterKey();
    wireSearch();

    wrap('login', function () { storeRemembered(); });
    wrap('showApp', function () { refreshGreeting(); refreshHeadAvatar(); });
    wrap('navigate', function () { clearSearch(); refreshGreeting(); refreshHeadAvatar(); });
    wrap('renderDashboard', refreshGreeting);
    wrap('logout', function () { restoreRemembered(); });

    refreshGreeting();
    refreshHeadAvatar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* Focus login panel (Get Started) */
window.ebFocusLogin = function () {
  try {
    var panel = document.getElementById('loginCardPanel') || document.getElementById('loginUsername');
    var user = document.getElementById('loginUsername');
    if (panel && panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (user) user.focus();
  } catch (e) {}
};


/* ---------- Public site: room-style navigation (not slide) ---------- */
window.showPublicRoom = function (roomId) {
  roomId = roomId || 'home';
  var rooms = document.querySelectorAll('.pub-room');
  rooms.forEach(function (room) {
    var on = room.getAttribute('data-room') === roomId;
    room.classList.toggle('is-active', on);
  });
  document.querySelectorAll('.pub-nav-link').forEach(function (a) {
    a.classList.toggle('active', a.getAttribute('data-room') === roomId);
  });
  var nav = document.getElementById('pubNav');
  if (nav) nav.classList.remove('open');
  // Ensure login visible on home
  if (roomId === 'home') {
    var ls = document.getElementById('loginScreen');
    if (ls) {
      ls.style.display = 'flex';
      ls.style.visibility = 'visible';
    }
    if (typeof showLoginForm === 'function') showLoginForm();
  }
  window.scrollTo({ top: 0, behavior: 'auto' });
};

document.addEventListener('DOMContentLoaded', function () {
  var t = document.getElementById('pubNavToggle');
  var nav = document.getElementById('pubNav');
  if (t && nav) {
    // Start closed on mobile
    nav.classList.remove('open');
    t.setAttribute('aria-expanded', 'false');
    t.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = nav.classList.toggle('open');
      t.setAttribute('aria-expanded', open ? 'true' : 'false');
      t.innerHTML = open ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
    });
    // Close when tapping a link
    nav.querySelectorAll('.pub-nav-link').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        t.setAttribute('aria-expanded', 'false');
        t.innerHTML = '<i class="fas fa-bars"></i>';
      });
    });
    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('open')) return;
      if (nav.contains(e.target) || t.contains(e.target)) return;
      nav.classList.remove('open');
      t.setAttribute('aria-expanded', 'false');
      t.innerHTML = '<i class="fas fa-bars"></i>';
    });
  }
  // Default room
  if (document.getElementById('publicSite') && !document.body.classList.contains('in-app')) {
    window.showPublicRoom('home');
  }
});
