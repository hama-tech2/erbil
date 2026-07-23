/* ============================================================
   هەولێر · Erbil Citadel — scrollytelling behaviour
   GSAP + ScrollTrigger. Scroll-scrubbed hero video.
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

    var hasGSAP = window.gsap && window.ScrollTrigger;
    if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

    setupNav();

    if (reduceMotion || !hasGSAP) { staticFallback(); return; }

    if (!isTouch) setupCursor();
    splitHeadings();
    setupHero();
    setupReveals();
    setupParallax();
    setupClipReveals();
    if (!isTouch) setupMagnetic();
    introSequence();
  }

  /* ----------------------------------------------------------
     NAV
     ---------------------------------------------------------- */
  function setupNav() {
    var nav = document.getElementById("nav");
    var onScroll = function () {
      nav.classList.toggle("is-solid", window.scrollY > window.innerHeight * 0.6);
    };
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
     HERO — pinned, scroll-scrubbed Earth-zoom video

     The scroll is split into two phases across the pin:
       0 .. VIDEO_END : the video scrubs through its FULL length
                        (space -> citadel), and the three lines
                        leave one by one (right, left, right).
       VIDEO_END .. 1 : the video holds on its LAST frame while the
                        three lines return and the CTA appears — this
                        is the extra "hold" after the video finishes.
     ---------------------------------------------------------- */
  function setupHero() {
    var hero = document.getElementById("hero");
    var pin = hero.querySelector(".hero__pin");
    var video = hero.querySelector(".hero__video");
    var l1 = hero.querySelector(".hero__line--1");
    var l2 = hero.querySelector(".hero__line--2");
    var l3 = hero.querySelector(".hero__line--3");
    var cta = hero.querySelector(".hero__cta");
    var hint = hero.querySelector(".hero__scroll");

    var VIDEO_END = 0.80;                 // video reaches its last frame at 80% of the scroll
    var pinLength = isMobile ? "+=240%" : "+=520%";

    // iOS/Safari unlock so the video becomes seekable.
    var unlocked = false;
    function unlock() {
      if (unlocked) return; unlocked = true;
      var p = video.play();
      if (p && p.then) p.then(function () { video.pause(); }).catch(function () {});
      else { try { video.pause(); } catch (e) {} }
    }
    ["touchstart", "pointerdown", "click", "keydown"].forEach(function (ev) {
      window.addEventListener(ev, unlock, { once: true, passive: true });
    });

    // --- Single-smoothing video scrub -------------------------------
    var duration = 0, target = 0, current = 0, canScrub = true;
    function onMeta() { duration = video.duration || 0; }
    if (video.readyState >= 1) onMeta();
    video.addEventListener("loadedmetadata", onMeta);

    function rafLoop() {
      if (duration) {
        // ease currentTime toward the scroll-derived target
        current += (target - current) * 0.15;
        if (Math.abs(target - current) < 0.004) current = target;
        try { video.currentTime = current; } catch (e) { canScrub = false; }
      }
      requestAnimationFrame(rafLoop);
    }
    requestAnimationFrame(rafLoop);

    // --- Choreography timeline (scrubbed, pins the hero) ------------
    var tl = gsap.timeline({
      defaults: { ease: "power1.inOut" },
      scrollTrigger: {
        trigger: hero, start: "top top", end: pinLength,
        pin: pin, scrub: isMobile ? 0.6 : 1, anticipatePin: 1,
        onUpdate: function (self) {
          if (!duration) return;
          // Map the first VIDEO_END of scroll to the whole clip; hold after.
          var v = self.progress / VIDEO_END; if (v > 1) v = 1;
          target = v * (duration - 0.05);
        }
      }
    });

    // Timeline length = 1; positions are absolute fractions of the pin.
    // --- Lines LEAVE one by one: right, left, right (small fade) ---
    tl.to(l1, { xPercent: 115, scale: 0.94, autoAlpha: 0, duration: 0.11 }, 0.05)
      .to(l2, { xPercent: -125, scale: 0.94, autoAlpha: 0, duration: 0.11 }, 0.17)
      .to(l3, { xPercent: 115, scale: 0.94, autoAlpha: 0, duration: 0.11 }, 0.29);

    // Middle: 0.40 .. 0.80 the video keeps zooming to the citadel, no text.

    // --- Lines RETURN over the final frame: enter from the right,
    //     settle moving left, soft small fade-in + slight scale-up ---
    tl.fromTo(l1, { xPercent: 80, scale: 0.96, autoAlpha: 0 },
                  { xPercent: 0, scale: 1, autoAlpha: 1, duration: 0.09 }, 0.82)
      .fromTo(l2, { xPercent: 80, scale: 0.96, autoAlpha: 0 },
                  { xPercent: 0, scale: 1, autoAlpha: 0.9, duration: 0.09 }, 0.87)
      .fromTo(l3, { xPercent: 80, scale: 0.96, autoAlpha: 0 },
                  { xPercent: 0, scale: 1, autoAlpha: 1, duration: 0.09 }, 0.92)
      .to(hint, { autoAlpha: 0, duration: 0.05 }, 0.82)
      .fromTo(cta, { autoAlpha: 0, y: 20, visibility: "visible" },
                   { autoAlpha: 1, y: 0, duration: 0.08 }, 0.94);

    // --- Fallback: play once through if seeking is unsupported ------
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
      ScrollTrigger.create({ trigger: el, start: "top 86%", once: true,
        onEnter: function () { el.classList.add("is-in"); } });
    });
    gsap.utils.toArray(".split").forEach(function (h) {
      gsap.to(h.querySelectorAll(".word > span"), {
        yPercent: 0, duration: 0.9, ease: "power3.out", stagger: 0.08,
        scrollTrigger: { trigger: h, start: "top 86%" }
      });
    });
  }

  /* ----------------------------------------------------------
     Parallax on full-width images
     ---------------------------------------------------------- */
  function setupParallax() {
    gsap.utils.toArray("[data-parallax] img").forEach(function (img) {
      gsap.fromTo(img, { yPercent: -8 }, { yPercent: 8, ease: "none",
        scrollTrigger: { trigger: img.closest("[data-parallax]"), start: "top bottom", end: "bottom top", scrub: true } });
    });
  }

  /* ----------------------------------------------------------
     Clip-path wipe reveal for the intro image
     ---------------------------------------------------------- */
  function setupClipReveals() {
    gsap.utils.toArray(".reveal-clip").forEach(function (fig) {
      var img = fig.querySelector("img");
      gsap.set(fig, { clipPath: "inset(0 0 100% 0)" });
      gsap.to(fig, { clipPath: "inset(0 0 0% 0)", duration: 1.2, ease: "power3.inOut",
        scrollTrigger: { trigger: fig, start: "top 82%" } });
      if (img) gsap.to(img, { scale: 1, duration: 1.4, ease: "power3.out",
        scrollTrigger: { trigger: fig, start: "top 82%" } });
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
     Custom cursor
     ---------------------------------------------------------- */
  function setupCursor() {
    var cursor = document.querySelector(".cursor");
    if (!cursor) return;
    var xTo = gsap.quickTo(cursor, "x", { duration: 0.18, ease: "power3" });
    var yTo = gsap.quickTo(cursor, "y", { duration: 0.18, ease: "power3" });
    window.addEventListener("mousemove", function (e) { xTo(e.clientX); yTo(e.clientY); });
    document.addEventListener("mouseleave", function () { gsap.to(cursor, { autoAlpha: 0, duration: 0.2 }); });
    document.addEventListener("mouseenter", function () { gsap.to(cursor, { autoAlpha: 1, duration: 0.2 }); });

    document.querySelectorAll("a, button, .btn, .link-arrow, .nav__link").forEach(function (el) {
      el.addEventListener("mouseenter", function () { cursor.classList.add("is-grow"); });
      el.addEventListener("mouseleave", function () { cursor.classList.remove("is-grow"); });
    });
    document.querySelectorAll(".media").forEach(function (el) {
      el.addEventListener("mouseenter", function () { cursor.classList.add("is-media"); });
      el.addEventListener("mouseleave", function () { cursor.classList.remove("is-media"); });
    });
  }

  /* ----------------------------------------------------------
     Orchestrated page-load: nav, then hero text, one after another
     ---------------------------------------------------------- */
  function introSequence() {
    gsap.timeline({ defaults: { ease: "power3.out" } })
      .from(".nav__logo", { y: -20, autoAlpha: 0, duration: 0.7 })
      .from(".nav__links", { y: -20, autoAlpha: 0, duration: 0.7 }, "-=0.5")
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
