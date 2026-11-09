// Mohamad Kaifoddin — Portfolio interactions, GSAP edition
// GSAP + ScrollTrigger via CDN, with a plain-JS fallback if the CDN is blocked.
(function () {
  'use strict';

  var progress = document.getElementById('progress');
  var backTop = document.getElementById('backTop');
  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    progress.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    if (backTop) backTop.classList.toggle('show', h.scrollTop > 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- GSAP path ----
  if (window.gsap) {
    gsap.registerPlugin(ScrollTrigger);

    // Hero entrance — transform only, never opacity: content must stay
    // fully visible even if an animation is interrupted or slow.
    gsap.from('.mega span', { y: 60, duration: 0.8, stagger: 0.06, ease: 'power3.out' });
    gsap.from('.hero-left', { x: -40, duration: 0.9, delay: 0.3, ease: 'power3.out' });
    gsap.from('.hero-right', { x: 40, duration: 0.9, delay: 0.4, ease: 'power3.out' });
    gsap.from('#heroPhoto', { scale: 0.88, duration: 1, delay: 0.2, ease: 'back.out(1.4)' });
    gsap.from('.topbar', { y: -20, duration: 0.7, ease: 'power2.out' });

    // Scroll reveal for every section — transform only, one tween per element
    gsap.utils.toArray('.reveal').forEach(function (el) {
      gsap.from(el, {
        y: 36, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    // Safety: never leave an element stuck mid-animation — clear all
    // entrance transforms a moment after load.
    setTimeout(function () {
      gsap.set(['.mega span', '.hero-left', '.hero-right', '#heroPhoto', '.topbar', '.reveal'], { clearProps: 'transform,opacity' });
    }, 2600);

    // Animated counters — only real resume numbers
    document.querySelectorAll('.count').forEach(function (el) {
      var target = +el.dataset.target;
      var obj = { v: 0 };
      gsap.to(obj, {
        v: target, duration: 1.4, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        onUpdate: function () { el.textContent = Math.round(obj.v); }
      });
    });

    // Education timeline: line draws as you scroll, dots light up one by one
    var fill = document.getElementById('timelineFill');
    var edu = document.getElementById('eduTimeline');
    if (fill && edu) {
      gsap.to(fill, {
        height: '100%', ease: 'none',
        scrollTrigger: { trigger: edu, start: 'top 78%', end: 'bottom 55%', scrub: 0.6 }
      });
      document.querySelectorAll('.timeline-item').forEach(function (item) {
        ScrollTrigger.create({
          trigger: item, start: 'top 72%',
          onEnter: function () { item.classList.add('active'); },
          onLeaveBack: function () { item.classList.remove('active'); }
        });
      });
    }

    // Hero photo parallax on scroll
    gsap.to('#heroPhoto img', {
      y: -14, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 }
    });
  } else {
    // ---- Fallback: plain IntersectionObserver, same result if GSAP CDN fails ----
    var revealEls = document.querySelectorAll('.reveal');
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    revealEls.forEach(function (el) { observer.observe(el); });

    var counters = document.querySelectorAll('.count');
    var counterObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target, target = +el.dataset.target, start = null;
        counterObs.unobserve(el);
        (function tick(ts) {
          if (!start) start = ts;
          var p = Math.min((ts - start) / 1200, 1);
          el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(tick);
        })(performance.now());
      });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { counterObs.observe(c); });

    var fillEl = document.getElementById('timelineFill');
    var eduEl = document.getElementById('eduTimeline');
    if (fillEl && eduEl) {
      var eduObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { fillEl.style.height = '100%'; fillEl.style.transition = 'height 1.2s ease'; }
        });
      }, { threshold: 0.3 });
      eduObs.observe(eduEl);
      document.querySelectorAll('.timeline-item').forEach(function (item) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { if (e.isIntersecting) item.classList.add('active'); });
        }, { threshold: 0.6 }).observe(item);
      });
    }
  }

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
