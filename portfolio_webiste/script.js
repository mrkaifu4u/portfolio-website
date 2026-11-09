// Mohamad Kaifoddin — Portfolio interactions
// No backend. Contact form shows a success message only.
(function () {
  'use strict';

  // Scroll progress + reveal on scroll
  var progress = document.getElementById('progress');
  var revealEls = document.querySelectorAll('.reveal');
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  revealEls.forEach(function (el) { observer.observe(el); });

  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    progress.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Animated counters (hero stats) — only real resume numbers
  var counters = document.querySelectorAll('.count');
  var counterObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target, target = +el.dataset.target, start = null;
      counterObs.unobserve(el);
      function tick(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / 1200, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  counters.forEach(function (c) { counterObs.observe(c); });

  // Active nav link
  var links = document.querySelectorAll('.nav-links a');
  var sections = ['work', 'experience', 'skills', 'about', 'contact']
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);
  var navObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      links.forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id);
      });
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach(function (s) { navObs.observe(s); });

  // Mobile menu
  var menuBtn = document.getElementById('menuBtn');
  var navLinks = document.getElementById('navLinks');
  menuBtn.addEventListener('click', function () {
    var open = navLinks.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.textContent = open ? '✕' : '☰';
  });
  navLinks.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      navLinks.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.textContent = '☰';
    }
  });

  // Hero photo tilt on mouse move (desktop only)
  var heroPhoto = document.getElementById('heroPhoto');
  if (heroPhoto && window.matchMedia('(hover: hover)').matches) {
    heroPhoto.addEventListener('mousemove', function (e) {
      var r = heroPhoto.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      heroPhoto.style.transform = 'perspective(800px) rotateY(' + (x * 6) + 'deg) rotateX(' + (-y * 6) + 'deg)';
    });
    heroPhoto.addEventListener('mouseleave', function () { heroPhoto.style.transform = ''; });
  }

  // Custom cursor dot (desktop only)
  var cursor = document.getElementById('cursor');
  if (cursor && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.addEventListener('mousemove', function (e) {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });
    document.querySelectorAll('a, button, .card, .project').forEach(function (el) {
      el.addEventListener('mouseenter', function () { cursor.classList.add('grow'); });
      el.addEventListener('mouseleave', function () { cursor.classList.remove('grow'); });
    });
  }

  // Contact form — success message only, no data sent anywhere
  var form = document.getElementById('contactForm');
  var note = document.getElementById('formNote');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.name.value.trim();
    var email = form.email.value.trim();
    var message = form.message.value.trim();
    if (!name || !email || !message || email.indexOf('@') === -1) {
      note.textContent = 'Please fill in your name, a valid email and a message.';
      note.classList.add('error');
      return;
    }
    note.classList.remove('error');
    note.textContent = 'Thanks, ' + name.split(' ')[0] + '! Your message was received. I’ll get back to you soon.';
    form.reset();
  });

  // Footer year
  var yearEl = document.querySelector('.footer-small');
  if (yearEl) yearEl.textContent = yearEl.textContent.replace('2026', new Date().getFullYear());
})();
