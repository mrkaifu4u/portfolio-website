// Mohamad Kaifoddin — Portfolio interactions (poster version, no backend)
(function () {
  'use strict';

  // Scroll progress + reveal on scroll (staggered via transition-delay from data attr if present)
  var progress = document.getElementById('progress');
  var revealEls = document.querySelectorAll('.reveal');
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  revealEls.forEach(function (el) { observer.observe(el); });

  var backTop = document.getElementById('backTop');
  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    progress.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    if (backTop) backTop.classList.toggle('show', h.scrollTop > 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Animated counters — only real resume numbers: 1+ years, 10+ models, 3+ deployed
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

  // Hero photo tilt + rim-light follow (desktop only)
  var heroPhoto = document.getElementById('heroPhoto');
  if (heroPhoto && window.matchMedia('(hover: hover)').matches) {
    heroPhoto.addEventListener('mousemove', function (e) {
      var r = heroPhoto.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      heroPhoto.style.transform = 'perspective(900px) rotateY(' + (x * 7) + 'deg) rotateX(' + (-y * 5) + 'deg)';
    });
    heroPhoto.addEventListener('mouseleave', function () { heroPhoto.style.transform = ''; });
  }

  // Project card tilt on hover
  document.querySelectorAll('.project').forEach(function (card) {
    if (!window.matchMedia('(hover: hover)').matches) return;
    card.addEventListener('mousemove', function (e) {
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = 'perspective(800px) rotateY(' + (x * 5) + 'deg) rotateX(' + (-y * 5) + 'deg)';
    });
    card.addEventListener('mouseleave', function () { card.style.transform = ''; });
  });

  // Custom cursor dot (desktop only)
  var cursor = document.getElementById('cursor');
  if (cursor && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.addEventListener('mousemove', function (e) {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });
    document.querySelectorAll('a, button, .card, .project, .hero-photo').forEach(function (el) {
      el.addEventListener('mouseenter', function () { cursor.classList.add('grow'); });
      el.addEventListener('mouseleave', function () { cursor.classList.remove('grow'); });
    });
  }
})();
