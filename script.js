/* ============================================================
   هەولێر · Erbil Citadel — museum-grade scrollytelling
   GSAP + ScrollTrigger. Scroll-scrubbed hero video, pinned
   history strip, custom cursor, reveals, parallax.
   Respects prefers-reduced-motion; degrades without GSAP.
   ============================================================ */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  var isMobile = window.matchMedia("(max-width: 760px)").matches;

  if (isTouch) document.body.classList.add("is-touch");

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    var y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
    startClock();

    var hasGSAP = window.gsap && window.ScrollTrigger;
    if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

    setupNav();
    if (!isTouch) setupCursor();          // cursor works with or without GSAP

    if (reduceMotion || !hasGSAP) { staticFallback(); return; }

    splitHeadings();
    setupHero();
    setupReveals();
    setupParallax();
    setupClipReveals();
    setupTell();
    setupStrip();
    if (!isTouch) setupMagnetic();
    introSequence();

    // Recalculate once fonts/images settle.
    window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  }

  /* ----------------------------------------------------------
     Live Erbil clock (Asia/Baghdad, UTC+3)
     ---------------------------------------------------------- */
  function startClock() {
    var el = document.getElementById("clock");
    if (!el) return;
    function tick() {
      try {
        el.textContent = new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Baghdad"
        }).format(new Date());
      } catch (e) {
        var d = new Date(Date.now() + (3 * 60 + new Date().getTimezoneOffset()) * 60000);
        el.textContent = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
      }
    }
    tick(); setInterval(tick, 20000);
  }

  /* ----------------------------------------------------------
     NAV — solid bar on scroll + active-link diamond
     ---------------------------------------------------------- */
  function setupNav() {
    var nav = document.getElementById("nav");
    var onScroll = function () { nav.classList.toggle("is-solid", window.scrollY > window.innerHeight * 0.6); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    var links = Array.prototype.slice.call(document.querySelectorAll(".nav__link"));
    var sections = links.map(function (l) { return document.querySelector(l.getAttribute("href")); }).filter(Boolean);
    if ("IntersectionObserver" in window && sections.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (l) { l.classList.toggle("is-active", l.getAttribute("href") === "#" + e.target.id); });
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      sections.forEach(function (s) { io.observe(s); });
    }
  }

  /* ----------------------------------------------------------
     Custom gold cursor — rAF lerp; grows over links, arrow over media
     ---------------------------------------------------------- */
  function setupCursor() {
    var cursor = document.getElementById("cursor");
    if (!cursor) return;
    var vw = window.innerWidth, vh = window.innerHeight;
    var cx = vw / 2, cy = vh / 2, tx = cx, ty = cy, seen = false;

    window.addEventListener("mousemove", function (e) { tx = e.clientX; ty = e.clientY; seen = true; }, { passive: true });
    window.addEventListener("mouseout", function (e) { if (!e.relatedTarget) cursor.style.opacity = "0"; });
    window.addEventListener("mouseover", function () { cursor.style.opacity = "1"; });

    (function loop() {
      cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
      cursor.style.transform = "translate3d(" + cx + "px," + cy + "px,0) translate(-50%,-50%)";
      requestAnimationFrame(loop);
    })();

    var grow = document.querySelectorAll("a, button, .btn, .link-arrow, .nav__link");
    grow.forEach(function (el) {
      el.addEventListener("mouseenter", function () { cursor.classList.add("is-grow"); });
      el.addEventListener("mouseleave", function () { cursor.classList.remove("is-grow"); });
    });
    document.querySelectorAll(".media").forEach(function (el) {
      el.addEventListener("mouseenter", function () { cursor.classList.add("is-media"); });
      el.addEventListener("mouseleave", function () { cursor.classList.remove("is-media"); });
    });
  }

  /* ----------------------------------------------------------
     HERO — pinned, scroll-scrubbed video

     Pin the whole section (pinSpacing keeps the sections below from
     rendering until the scrub is complete). The clip plays across the
     first part of the scroll; then ~100vh of extra pinned scroll holds
     the final frame while the three lines return, crisp and staying on.
     ---------------------------------------------------------- */
  function setupHero() {
    var hero = document.getElementById("hero");
    var video = hero.querySelector(".hero__video");
    var l1 = hero.querySelector(".hero__line--1");
    var l2 = hero.querySelector(".hero__line--2");
    var l3 = hero.querySelector(".hero__line--3");
    var cta = hero.querySelector(".hero__cta");
    var hint = hero.querySelector(".hero__scroll");
    var annot = hero.querySelector(".hero__annot");
    var annotLine = hero.querySelector(".annot__line");

    // Extra hold ≈ 100vh on top of the video-scrub distance.
    var videoScroll = isMobile ? 180 : 320;   // vh spent scrubbing the clip
    var holdScroll = isMobile ? 80 : 100;      // vh holding the final frame
    var totalScroll = videoScroll + holdScroll;
    var VIDEO_END = videoScroll / totalScroll; // progress at which the clip finishes
    var pinLength = "+=" + totalScroll + "%";

    // Prepare the annotation leader-line for a stroke-dashoffset draw.
    if (annotLine) {
      var len = annotLine.getTotalLength();
      annotLine.style.strokeDasharray = len;
      annotLine.style.strokeDashoffset = len;
    }

    // iOS/Safari unlock + force buffering.
    var unlocked = false;
    function unlock() {
      if (unlocked) return; unlocked = true;
      var p = video.play();
      if (p && p.then) p.then(function () { video.pause(); }).catch(function () {});
      else { try { video.pause(); } catch (e) {} }
    }
    ["touchstart", "pointerdown", "click", "keydown", "wheel"].forEach(function (ev) {
      window.addEventListener(ev, unlock, { once: true, passive: true });
    });
    try { video.load(); } catch (e) {}

    // Robust scrub: smoothed target + throttled seeking (one seek at a time).
    var duration = 0, target = 0, current = 0, canScrub = true, seeking = false;
    function onMeta() { duration = video.duration || 0; try { video.currentTime = 0; } catch (e) {} }
    if (video.readyState >= 1) onMeta();
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("seeked", function () { seeking = false; });
    (function raf() {
      if (duration) {
        current += (target - current) * 0.2;
        if (Math.abs(target - current) < 0.008) current = target;
        if (!seeking && Math.abs(video.currentTime - current) > 0.03) {
          seeking = true;
          try { video.currentTime = current; } catch (e) { canScrub = false; seeking = false; }
        }
      }
      requestAnimationFrame(raf);
    })();

    var tl = gsap.timeline({
      defaults: { ease: "power2.inOut" },
      scrollTrigger: {
        trigger: hero, start: "top top", end: pinLength,
        pin: true, pinSpacing: true, scrub: isMobile ? 0.6 : 1, anticipatePin: 1,
        onUpdate: function (self) {
          if (!duration) return;
          var v = self.progress / VIDEO_END;
          target = (v >= 1 ? duration - 0.04 : v * (duration - 0.04));
        }
      }
    });

    // Annotation: draw the leader line as the scrub starts, then fade it
    // out as the camera descends toward the citadel.
    if (annotLine) tl.to(annotLine, { strokeDashoffset: 0, duration: 0.08, ease: "power2.out" }, 0.01);
    tl.to(annot, { autoAlpha: 0, duration: 0.10 }, 0.16);

    // Lines stay readable at the very start, then LEAVE one by one —
    // right, left, right — sliding fully off-screen (no blur).
    tl.to(l1, { xPercent: 150, duration: 0.12 }, 0.10)
      .to(l2, { xPercent: -160, duration: 0.12 }, 0.22)
      .to(l3, { xPercent: 150, duration: 0.12 }, 0.34);

    // Lines RETURN over the final frame — CRISP: enter from the right,
    // settle, small scale-up. No fade, no blur. They stay on screen.
    tl.set([l1, l2, l3], { autoAlpha: 1 }, VIDEO_END - 0.001)
      .fromTo(l1, { xPercent: 70, scale: 0.94 }, { xPercent: 0, scale: 1, duration: 0.08, ease: "power3.out" }, VIDEO_END + 0.02)
      .fromTo(l2, { xPercent: 70, scale: 0.94 }, { xPercent: 0, scale: 1, duration: 0.08, ease: "power3.out" }, VIDEO_END + 0.07)
      .fromTo(l3, { xPercent: 70, scale: 0.94 }, { xPercent: 0, scale: 1, duration: 0.08, ease: "power3.out" }, VIDEO_END + 0.12)
      .to(hint, { autoAlpha: 0, duration: 0.05 }, VIDEO_END)
      .fromTo(cta, { autoAlpha: 0, y: 18, visibility: "visible" }, { autoAlpha: 1, y: 0, duration: 0.07 }, VIDEO_END + 0.16);

    ScrollTrigger.create({
      trigger: hero, start: "top top", end: pinLength,
      onEnter: function () { if (!canScrub) video.play().catch(function () {}); }
    });
  }

  /* ----------------------------------------------------------
     Split headings into WORDS (never split Arabic letters)
     ---------------------------------------------------------- */
  function splitHeadings() {
    document.querySelectorAll(".split").forEach(function (h) {
      var words = h.textContent.trim().split(/\s+/);
      h.textContent = "";
      words.forEach(function (w, i) {
        var word = document.createElement("span"); word.className = "word";
        var inner = document.createElement("span"); inner.textContent = w;
        word.appendChild(inner); h.appendChild(word);
        if (i < words.length - 1) h.appendChild(document.createTextNode(" "));
      });
    });
  }

  /* ----------------------------------------------------------
     Reveals + split-word heading reveals
     ---------------------------------------------------------- */
  function setupReveals() {
    gsap.utils.toArray(".reveal").forEach(function (el) {
      ScrollTrigger.create({ trigger: el, start: "top 88%", once: true,
        onEnter: function () { el.classList.add("is-in"); } });
    });
    gsap.utils.toArray(".split").forEach(function (h) {
      gsap.to(h.querySelectorAll(".word > span"), {
        yPercent: 0, duration: 0.9, ease: "power3.out", stagger: 0.08,
        scrollTrigger: { trigger: h, start: "top 88%" }
      });
    });
  }

  /* ----------------------------------------------------------
     Parallax on full-width / grid images
     ---------------------------------------------------------- */
  function setupParallax() {
    gsap.utils.toArray("[data-parallax] img").forEach(function (img) {
      gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: "none",
        scrollTrigger: { trigger: img.closest("[data-parallax]"), start: "top bottom", end: "bottom top", scrub: true } });
    });
    // Inner parallax for the tall photo cards
    gsap.utils.toArray("[data-parallax-card] img").forEach(function (img) {
      gsap.fromTo(img, { yPercent: -8 }, { yPercent: 8, ease: "none",
        scrollTrigger: { trigger: img.closest("[data-parallax-card]"), start: "top bottom", end: "bottom top", scrub: true } });
    });
  }

  /* ----------------------------------------------------------
     Clip-path wipe reveals for section images
     ---------------------------------------------------------- */
  function setupClipReveals() {
    gsap.utils.toArray(".reveal-clip").forEach(function (fig) {
      var img = fig.querySelector("img");
      gsap.set(fig, { clipPath: "inset(0 0 100% 0)" });
      gsap.to(fig, { clipPath: "inset(0 0 0% 0)", duration: 1.2, ease: "power3.inOut",
        scrollTrigger: { trigger: fig, start: "top 84%" } });
      if (img) gsap.to(img, { scale: 1, duration: 1.4, ease: "power3.out",
        scrollTrigger: { trigger: fig, start: "top 84%" } });
    });
  }

  /* ----------------------------------------------------------
     Tell cross-section: layers grow in bottom-to-top
     ---------------------------------------------------------- */
  function setupTell() {
    var layers = gsap.utils.toArray(".tell__layer");
    if (!layers.length) return;
    gsap.set(layers, { scaleY: 0, transformOrigin: "bottom" });
    gsap.to(layers, {
      scaleY: 1, duration: 0.7, ease: "power2.out", stagger: 0.12,
      scrollTrigger: { trigger: ".tell", start: "top 82%" }
    });
  }

  /* ----------------------------------------------------------
     History — horizontal pinned scroll strip (RTL pan)
     ---------------------------------------------------------- */
  function setupStrip() {
    var track = document.getElementById("strip-track");
    var section = document.querySelector(".s03");
    if (!track || !section) return;

    // On small screens, let the strip scroll natively instead of pinning.
    if (isMobile) { document.getElementById("strip").style.overflowX = "auto"; return; }

    function amount() { return Math.max(0, track.scrollWidth - window.innerWidth); }
    gsap.to(track, {
      x: function () { return amount(); },     // RTL: pan content to reveal later eras
      ease: "none",
      scrollTrigger: {
        trigger: section, start: "top top", end: function () { return "+=" + amount(); },
        pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true
      }
    });
  }

  /* ----------------------------------------------------------
     Magnetic buttons
     ---------------------------------------------------------- */
  function setupMagnetic() {
    document.querySelectorAll(".magnetic").forEach(function (el) {
      var xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" });
      var yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" });
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.35);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
      });
      el.addEventListener("mouseleave", function () { xTo(0); yTo(0); });
    });
  }

  /* ----------------------------------------------------------
     Orchestrated page-load sequence
     ---------------------------------------------------------- */
  function introSequence() {
    gsap.timeline({ defaults: { ease: "power3.out" } })
      .from(".nav__logo", { y: -20, autoAlpha: 0, duration: 0.7 })
      .from(".nav__links", { y: -20, autoAlpha: 0, duration: 0.7 }, "-=0.5")
      .from(".hero__eyebrow", { autoAlpha: 0, y: 16, duration: 0.7 }, "-=0.3")
      .from(".hero__line--1", { autoAlpha: 0, y: 30, duration: 0.9 }, "-=0.2")
      .from(".hero__line--2", { autoAlpha: 0, y: 20, duration: 0.8 }, "-=0.55")
      .from(".hero__line--3", { autoAlpha: 0, y: 30, duration: 0.9 }, "-=0.55")
      .from([".hero__corner", ".hero__scroll"], { autoAlpha: 0, duration: 0.8, stagger: 0.1 }, "-=0.4");
  }

  /* ----------------------------------------------------------
     Reduced-motion / no-GSAP fallback
     ---------------------------------------------------------- */
  function staticFallback() {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("is-in"); });
    var video = document.querySelector(".hero__video");
    if (video) {
      var showFrame = function () { try { video.currentTime = 0.1; } catch (e) {} };
      if (video.readyState >= 1) showFrame();
      else video.addEventListener("loadedmetadata", showFrame);
    }
  }

})();
