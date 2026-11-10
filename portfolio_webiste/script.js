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

    // No entrance or scroll animation at all on the hero and What I Do:
    // those sections are shown instantly, fully bright, with no fade or
    // dimming effect of any kind.
    gsap.set(['.hero .reveal', '.cards-5 .card'], { clearProps: 'all', opacity: 1 });

    // Scroll reveal for the other sections — transform only, one tween
    // per element, never opacity.
    gsap.utils.toArray('.reveal').forEach(function (el) {
      if (el.closest('.hero') || el.closest('.cards-5')) return;
      gsap.from(el, {
        y: 36, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

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

  // Success pop-up — Lottie animation from success.json + the same message
  var successModal = document.getElementById('successModal');
  var successAnim = null;
  if (window.lottie) {
    try {
      successAnim = lottie.loadAnimation({ container: document.getElementById('successAnim'), renderer: 'svg', loop: false, autoplay: false, path: 'success.json' });
    } catch (err) { successAnim = null; }
  }
  function openSuccessModal() {
    if (!successModal) return;
    successModal.hidden = false;
    if (successAnim) { successAnim.goToAndPlay(0); }
    else { var fb = document.getElementById('successFallback'); if (fb) fb.hidden = false; }
  }
  function closeSuccessModal() { if (successModal) successModal.hidden = true; }
  if (successModal) {
    document.getElementById('modalClose').addEventListener('click', closeSuccessModal);
    successModal.addEventListener('click', function (e) { if (e.target === successModal) closeSuccessModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSuccessModal(); });
  }

  // Contact form — sends each message to Google Sheets via the Apps Script
  // web app (portfolio_webiste_database, "contact" tab), then shows success.
  // Apps Script answers without CORS headers, so the request is sent
  // no-cors with a plain-text body; the row is still written server-side.
  var FORM_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxIXwrvVjy5i5B5rwu5DCjZE12g5bqf8wruhVQ_IW7CvMUZ6FcG_c9mDTicn_Jk6JB-/exec';
  var contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!contactForm.checkValidity()) { contactForm.reportValidity(); return; }
      var sendBtn = contactForm.querySelector('.form-send');
      var ok = document.getElementById('formSuccess');
      var data = {
        name: contactForm.querySelector('[name="name"]').value.trim(),
        email: contactForm.querySelector('[name="email"]').value.trim(),
        purpose: contactForm.querySelector('[name="purpose"]').value,
        message: contactForm.querySelector('[name="message"]').value.trim()
      };
      if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Sending…'; }
      fetch(FORM_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(data)
      }).then(function () {
        if (ok) { ok.hidden = false; ok.textContent = 'Message sent successfully — thank you for reaching out. I\'ll get back to you shortly.'; }
        contactForm.reset();
        openSuccessModal();
      }).catch(function () {
        if (ok) { ok.hidden = false; ok.textContent = 'Could not send right now — please email me directly at shaikhkaif7014@gmail.com.'; }
      }).finally(function () {
        if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send Message'; }
      });
    });
  }

  // Mobile hamburger menu (mobile storyboard: MK + hamburger)
  var navToggle = document.getElementById('navToggle');
  var topbar = document.querySelector('.topbar');
  if (navToggle && topbar) {
    navToggle.addEventListener('click', function () {
      var open = topbar.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    document.querySelectorAll('.topnav a').forEach(function (a) {
      a.addEventListener('click', function () {
        topbar.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Open menu');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        topbar.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Open menu');
      }
    });
  }

  // Technical Skills accordion (mobile storyboard: first group open, rest collapsed)
  var isMobile = function () { return window.matchMedia('(max-width:768px)').matches; };
  document.querySelectorAll('.skill-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!isMobile()) return;
      var group = btn.closest('.skill-group');
      if (!group) return;
      var open = group.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
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
