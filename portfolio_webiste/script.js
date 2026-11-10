// Mohamad Kaifoddin — Portfolio interactions, GSAP edition
// GSAP + ScrollTrigger via CDN, with a plain-JS fallback if the CDN is blocked.
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  // Page skeleton loader — fade it out once the page is fully loaded,
  // with a safety timeout so it can never block the page.
  var pageSkeleton = document.getElementById('pageSkeleton');
  function hideSkeleton() {
    if (!pageSkeleton) return;
    pageSkeleton.classList.add('done');
    setTimeout(function () { if (pageSkeleton.parentNode) pageSkeleton.parentNode.removeChild(pageSkeleton); }, 600);
  }
  if (document.readyState === 'complete') { setTimeout(hideSkeleton, 400); }
  else { window.addEventListener('load', function () { setTimeout(hideSkeleton, 400); }); }
  setTimeout(hideSkeleton, 3500);

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
      var vars = {
        y: 36, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      };
      // The certification card alone also fades in (opacity), so it
      // appears with a subtle fade as well as the slide-up.
      if (el.classList.contains('cert-card')) { vars.opacity = 0; }
      gsap.from(el, vars);
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
      // Progressive, scroll-linked fill (mirrors the GSAP scrub above):
      // 0% when the timeline top reaches 78% of the viewport, 100% when
      // its bottom reaches 55%. Dots light up one by one as they pass 72%.
      var eduItems = Array.prototype.slice.call(document.querySelectorAll('.timeline-item'));
      var ticking = false;
      function updateTimeline() {
        ticking = false;
        var r = eduEl.getBoundingClientRect();
        var vh = window.innerHeight || document.documentElement.clientHeight;
        var start = vh * 0.78, end = vh * 0.55;
        var total = (r.bottom - r.top) + (start - end);
        var p = Math.max(0, Math.min(1, (start - r.top) / total));
        fillEl.style.height = (p * 100).toFixed(1) + '%';
        eduItems.forEach(function (item) {
          var ir = item.getBoundingClientRect();
          if (ir.top < vh * 0.72) { item.classList.add('active'); }
          else { item.classList.remove('active'); }
        });
      }
      function onEduScroll() { if (!ticking) { ticking = true; requestAnimationFrame(updateTimeline); } }
      window.addEventListener('scroll', onEduScroll, { passive: true });
      window.addEventListener('resize', onEduScroll);
      updateTimeline();
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
  // Download Resume — point the resume links at the latest CV uploaded
  // from the admin panel (Google Drive). If the lookup fails for any
  // reason, the links keep pointing at the built-in PDF, so the button
  // never breaks.
  (function updateResumeLinks() {
    var links = document.querySelectorAll('a[href*="Mohamad_Kaifoddin_AI_ML_Engineer_1-3Yrs.pdf"]');
    if (!links.length) return;
    fetch(FORM_ENDPOINT + '?action=getCV')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.ok || !d.url) return;
        links.forEach(function (a) {
          a.href = d.url;
          a.removeAttribute('download');
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener');
        });
      })
      .catch(function () { /* keep the built-in PDF link */ });
  })();
  // Contact info — show the email / phone / location saved in admin
  // Settings (doGet ?action=getSettings). If the lookup fails, the
  // built-in values in the HTML stay, so the page never breaks.
  (function updateContactInfo() {
    fetch(FORM_ENDPOINT + '?action=getSettings')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.ok) return;
        if (d.email) {
          document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
            a.href = 'mailto:' + d.email;
            if (a.textContent.indexOf('@') !== -1) a.textContent = d.email;
          });
        }
        if (d.phone) {
          var tel = d.phone.replace(/[^0-9+]/g, '');
          document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
            a.href = 'tel:' + tel;
            a.textContent = d.phone;
          });
        }
        if (d.location) {
          var loc = document.getElementById('siteLocation');
          if (loc) loc.textContent = d.location;
        }
      })
      .catch(function () { /* keep the built-in contact info */ });
  })();
  // Profile — show the name / title / bio / About text saved in admin
  // Profile (doGet ?action=getProfile). If the lookup fails, the
  // built-in values in the HTML stay, so the page never breaks.
  (function updateProfile() {
    fetch(FORM_ENDPOINT + '?action=getProfile')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.ok) return;
        if (d.name) {
          var h = document.getElementById('heroName');
          if (h) {
            var parts = d.name.split(/\s+/).filter(function (x) { return x; });
            h.innerHTML = parts.length > 1
              ? parts[0] + '<br>' + parts.slice(1).join(' ')
              : parts[0] || '';
          }
          document.title = d.name + ' — ' + (d.title || 'AI/ML Engineer');
        }
        if (d.title) {
          var role = document.getElementById('heroRole');
          if (role) role.textContent = d.title;
        }
        if (d.bio) {
          var bio = document.getElementById('heroBio');
          if (bio) bio.textContent = d.bio;
        }
        if (d.about) {
          var about = document.getElementById('aboutText');
          if (about) about.textContent = d.about;
        }
        if (d.title || d.company || d.location) {
          var ar = document.getElementById('aboutRole');
          if (ar) {
            var bits = [];
            if (d.title) bits.push(d.title);
            if (d.company) bits.push(d.company);
            if (d.location) bits.push(d.location);
            ar.textContent = bits.join(' · ').toUpperCase();
          }
        }
        if (d.github) {
          document.querySelectorAll('a[href*="github.com"]').forEach(function (a) {
            a.href = d.github;
            if (a.textContent.indexOf('github.com') !== -1) {
              a.textContent = d.github.replace(/^https?:\/\//, '');
            }
          });
        }
      })
      .catch(function () { /* keep the built-in profile */ });
  })();
  var contactForm = document.getElementById('contactForm');
  if (contactForm) {
    // Visitor IP + location (city/region/country) for the sheet's IP
    // Address and Location columns. Apps Script cannot see the visitor's
    // IP, so the browser looks it up. Location comes from the device GPS
    // first (accurate city), because IP geolocation is only approximate
    // — it reports the ISP's node, which can be a nearby town instead of
    // the visitor's actual city. If GPS is unavailable, denied or slow,
    // the IP-based location is used instead. The form is never blocked:
    // the whole lookup is capped at 5s and the message sends regardless.
    function getVisitorInfo() {
      var result = {};
      // IP lookup: fast, gives the IP and a fallback (approximate) place.
      function ipLookup() {
        return fetch('https://ipapi.co/json/')
          .then(function (r) { return r.ok ? r.json() : {}; })
          .then(function (d) {
            if (d && d.ip) {
              result.ip = d.ip;
              var parts = [d.city, d.region, d.country_name].filter(function (x) { return x; });
              if (parts.length) result.ipLocation = parts.join(', ');
            }
          })
          .catch(function () {});
      }
      // GPS lookup: precise place name via the device location, then a
      // free reverse-geocode. Needs the visitor's permission; resolves
      // empty on denial, error or timeout so the IP fallback is used.
      function gpsLookup() {
        return new Promise(function (resolve) {
          if (!navigator.geolocation) { resolve(); return; }
          var settled = false;
          var timer = setTimeout(function () { if (!settled) { settled = true; resolve(); } }, 3500);
          navigator.geolocation.getCurrentPosition(
            function (pos) {
              if (settled) return;
              fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + pos.coords.latitude + '&longitude=' + pos.coords.longitude + '&localityLanguage=en')
                .then(function (r) { return r.ok ? r.json() : {}; })
                .then(function (d) {
                  var parts = [d.city || d.locality, d.principalSubdivision, d.countryName].filter(function (x) { return x; });
                  if (parts.length) result.gpsLocation = parts.join(', ');
                })
                .catch(function () {})
                .finally(function () { if (!settled) { settled = true; clearTimeout(timer); resolve(); } });
            },
            function () { if (!settled) { settled = true; clearTimeout(timer); resolve(); } },
            { timeout: 3500, maximumAge: 60000 }
          );
        });
      }
      // Prefer the precise GPS place; fall back to the IP-based place.
      function collect() {
        var out = {};
        if (result.ip) out.ip = result.ip;
        out.location = result.gpsLocation || result.ipLocation || '';
        return out;
      }
      var both = Promise.all([ipLookup(), gpsLookup()]).then(collect);
      var timeout = new Promise(function (resolve) {
        setTimeout(function () { resolve(collect()); }, 5000);
      });
      return Promise.race([both, timeout]);
    }

    // Phone field: digits only. Strip letters and other characters as
    // the visitor types, so alphabets can never be entered. A leading
    // "+" is kept (for country codes); any other "+" is dropped. The
    // pattern attribute is a second layer — checkValidity() on submit
    // rejects anything that is not a phone number.
    var phoneInput = contactForm.querySelector('[name="phone"]');
    if (phoneInput) {
      phoneInput.addEventListener('input', function () {
        var v = phoneInput.value.replace(/[^0-9+\s\-()]/g, '');
        var hasLeadingPlus = v.charAt(0) === '+';
        v = v.replace(/\+/g, '');
        if (hasLeadingPlus) v = '+' + v;
        if (v !== phoneInput.value) phoneInput.value = v;
      });
    }

    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!contactForm.checkValidity()) { contactForm.reportValidity(); return; }
      var sendBtn = contactForm.querySelector('.form-send');
      var sendLabel = sendBtn ? sendBtn.querySelector('.btn-label') : null;
      var ok = document.getElementById('formSuccess');
      var phoneField = contactForm.querySelector('[name="phone"]');
      var isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      var data = {
        name: contactForm.querySelector('[name="name"]').value.trim(),
        email: contactForm.querySelector('[name="email"]').value.trim(),
        phone: phoneField ? phoneField.value.trim() : '',
        purpose: contactForm.querySelector('[name="purpose"]').value,
        message: contactForm.querySelector('[name="message"]').value.trim(),
        source: 'Portfolio Website',
        deviceType: isMobile ? 'Mobile' : (window.innerWidth <= 1024 ? 'Tablet' : 'Desktop')
      };
      if (sendBtn) { sendBtn.disabled = true; sendBtn.classList.add('sending'); if (sendLabel) sendLabel.textContent = 'Sending…'; }
      getVisitorInfo().then(function (info) {
        if (info.ip) data.ip = info.ip;
        if (info.location) data.location = info.location;
        return fetch(FORM_ENDPOINT, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(data)
        });
      }).then(function () {
        if (ok) { ok.hidden = false; ok.textContent = 'Message sent successfully — thank you for reaching out. I\'ll get back to you shortly.'; }
        contactForm.reset();
        openSuccessModal();
      }).catch(function () {
        if (ok) { ok.hidden = false; ok.textContent = 'Could not send right now — please email me directly at skilltech011@gmail.com.'; }
      }).finally(function () {
        if (sendBtn) { sendBtn.disabled = false; sendBtn.classList.remove('sending'); if (sendLabel) sendLabel.textContent = 'Send Message'; }
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

  // Technical Skills master-detail (desktop reference: click a category
  // on the left to show its chips in the detail panel on the right).
  // v48: the detail is a separate flex panel (.skill-detail), so
  // fill it with the selected group's chips and line its top up
  // with the clicked button (it no longer sits pinned to the top).
  var isDesktop = function () { return window.matchMedia('(min-width:769px)').matches; };
  var renderSkillDetail = function () {
    if (!isDesktop()) return;
    var detail = document.getElementById('skillDetail');
    var list = document.querySelector('.skill-list');
    var sel = document.querySelector('.skill-group.selected');
    if (!detail || !list || !sel) return;
    var btn = sel.querySelector('.skill-toggle');
    var chips = sel.querySelector('.skill-chips');
    if (!btn || !chips) return;
    detail.innerHTML = '';
    detail.appendChild(chips.cloneNode(true));
    var top = btn.getBoundingClientRect().top - list.getBoundingClientRect().top;
    detail.style.marginTop = Math.max(0, Math.round(top)) + 'px';
  };
  document.querySelectorAll('.skill-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!isDesktop()) return;
      var group = btn.closest('.skill-group');
      if (!group) return;
      document.querySelectorAll('.skill-group').forEach(function (g) {
        g.classList.remove('selected');
        var b = g.querySelector('.skill-toggle');
        if (b) b.setAttribute('aria-expanded', 'false');
      });
      group.classList.add('selected');
      btn.setAttribute('aria-expanded', 'true');
      renderSkillDetail();
    });
  });
  renderSkillDetail();
  window.addEventListener('resize', renderSkillDetail);

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
