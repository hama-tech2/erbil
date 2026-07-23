/* ============================================================
   هەولێر · Erbil Citadel — scrollytelling behaviour
   GSAP + ScrollTrigger. Scroll-scrubbed hero video.
   Degrades gracefully; respects prefers-reduced-motion.
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

    if (reduceMotion || !hasGSAP) {
      staticFallback();
      return;
    }

    if (!isTouch) setupCursor();
    splitHeadings();
    setupHero();
    setupReveals();
    setupParallax();
    setupClipReveals();
    if (!isTouch) setupMagnetic();

    // Orchestrated page-load sequence (nav + hero text)
    introSequence();
  }

  /* ----------------------------------------------------------
     NAV — fade to a solid sand bar + active link diamond
     ---------------------------------------------------------- */
  function setupNav() {
    var nav = document.getElementById("nav");
    var onScroll = function () {
      if (window.scrollY > window.innerHeight * 0.6) nav.classList.add("is-solid");
      else nav.classList.remove("is-solid");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // Scroll-spy for the active gold diamond
    var links = Array.prototype.slice.call(document.querySelectorAll(".nav__link"));
    var sections = links
      .map(function (l) { return document.querySelector(l.getAttribute("href")); })
      .filter(Boolean);

    if ("IntersectionObserver" in window && sections.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (l) {
            l.classList.toggle("is-active", l.getAttribute("href") === "#" + e.target.id);
          });
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      sections.forEach(function (s) { io.observe(s); });
    }
  }

  /* ----------------------------------------------------------
     HERO — pinned, scroll-scrubbed Earth-zoom video
     ---------------------------------------------------------- */
  function setupHero() {
    var hero = document.getElementById("hero");
    var pin = hero.querySelector(".hero__pin");
    var video = hero.querySelector(".hero__video");
    var l1 = hero.querySelector(".hero__line--1");
    var l2 = hero.querySelector(".hero__line--2");
    var l3 = hero.querySelector(".hero__line--3");
    var cta = hero.querySelector(".hero__cta");
    var scrollHint = hero.querySelector(".hero__scroll");

    // iOS unlock: on first interaction, play then immediately pause so the
    // frame buffer becomes seekable.
    var unlocked = false;
    function unlock() {
      if (unlocked) return;
      unlocked = true;
      var p = video.play();
      if (p && p.then) p.then(function () { video.pause(); }).catch(function () {});
      else { try { video.pause(); } catch (e) {} }
    }
    ["touchstart", "pointerdown", "click", "keydown"].forEach(function (ev) {
      window.addEventListener(ev, unlock, { once: true, passive: true });
    });

    // Detect whether frame-accurate scrubbing is supported.
    var canScrub = true;
    // Shorter pin on mobile for a lighter experience.
    var pinLength = isMobile ? "+=180%" : "+=400%";

    // --- Smooth video scrubbing: lerp currentTime toward a target ---
    var target = 0, current = 0, duration = 0;
    function onMeta() { duration = video.duration || 0; }
    if (video.readyState >= 1) onMeta();
    video.addEventListener("loadedmetadata", onMeta);

    var rafId;
    function rafLoop() {
      if (duration) {
        current += (target - current) * 0.12;              // smoothing
        if (Math.abs(target - current) < 0.001) current = target;
        try { video.currentTime = current; } catch (e) { canScrub = false; }
      }
      rafId = requestAnimationFrame(rafLoop);
    }
    rafId = requestAnimationFrame(rafLoop);

    // --- The scrubbed text-choreography timeline, tied to the pin ---
    var tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: pinLength,
        pin: pin,
        scrub: isMobile ? 0.5 : 1,
        anticipatePin: 1,
        onUpdate: function (self) {
          if (duration) target = self.progress * (duration - 0.05);
        }
      }
    });

    // Timeline length = 1 (positions below are absolute 0..1 fractions).
    // 1) هەولێر leaves to the RIGHT (scale down, blur, fade)
    tl.to(l1, { xPercent: 120, scale: 0.8, filter: "blur(6px)", autoAlpha: 0, duration: 0.13 }, 0.05);
    // 2) لە دڵی leaves to the LEFT
    tl.to(l2, { xPercent: -140, scale: 0.85, filter: "blur(6px)", autoAlpha: 0, duration: 0.13 }, 0.19);
    // 3) مێژوودا leaves to the RIGHT
    tl.to(l3, { xPercent: 120, scale: 0.8, filter: "blur(6px)", autoAlpha: 0, duration: 0.13 }, 0.33);

    // 5) The three lines RETURN over the final citadel frame — enter from the
    //    right, settle moving left, soft fade-in + slight scale-up, one by one.
    tl.set([l1, l2, l3], { filter: "blur(0px)" }, 0.66);
    tl.fromTo(l1, { xPercent: 90, scale: 0.92, autoAlpha: 0 },
                  { xPercent: 0, scale: 1, autoAlpha: 1, duration: 0.12 }, 0.70);
    tl.fromTo(l2, { xPercent: 90, scale: 0.92, autoAlpha: 0 },
                  { xPercent: 0, scale: 1, autoAlpha: 0.85, duration: 0.12 }, 0.78);
    tl.fromTo(l3, { xPercent: 90, scale: 0.92, autoAlpha: 0 },
                  { xPercent: 0, scale: 1, autoAlpha: 1, duration: 0.12 }, 0.86);
    // Then the scroll hint fades and the CTA appears.
    tl.to(scrollHint, { autoAlpha: 0, duration: 0.05 }, 0.86);
    tl.fromTo(cta, { autoAlpha: 0, y: 20, visibility: "visible" },
                   { autoAlpha: 1, y: 0, duration: 0.1 }, 0.9);

    // --- Fallback: if scrubbing turns out unsupported, play once on scroll ---
    ScrollTrigger.create({
      trigger: hero,
      start: "top top",
      end: pinLength,
      onEnter: function () {
        if (!canScrub) { video.play().catch(function () {}); }
      }
    });
  }

  /* ----------------------------------------------------------
     Split main headings into words for a reveal
     (word-level only — never split Arabic letters)
     ---------------------------------------------------------- */
  function splitHeadings() {
    document.querySelectorAll(".split").forEach(function (h) {
      var words = h.textContent.trim().split(/\s+/);
      h.textContent = "";
      words.forEach(function (w, i) {
        var word = document.createElement("span");
        word.className = "word";
        var inner = document.createElement("span");
        inner.textContent = w;
        word.appendChild(inner);
        h.appendChild(word);
        if (i < words.length - 1) h.appendChild(document.createTextNode(" "));
      });
    });
  }

  /* ----------------------------------------------------------
     Staggered fade-up reveals + split-word reveals per section
     ---------------------------------------------------------- */
  function setupReveals() {
    // Generic fade-ups
    gsap.utils.toArray(".reveal").forEach(function (el) {
      ScrollTrigger.create({
        trigger: el, start: "top 85%",
        onEnter: function () { el.classList.add("is-in"); },
        once: true
      });
    });

    // Split-word headings
    gsap.utils.toArray(".split").forEach(function (h) {
      gsap.to(h.querySelectorAll(".word > span"), {
        yPercent: 0, duration: 0.9, ease: "power3.out", stagger: 0.08,
        scrollTrigger: { trigger: h, start: "top 85%" }
      });
    });
  }

  /* ----------------------------------------------------------
     Parallax on full-width images
     ---------------------------------------------------------- */
  function setupParallax() {
    gsap.utils.toArray("[data-parallax] img").forEach(function (img) {
      gsap.fromTo(img, { yPercent: -8 }, {
        yPercent: 8, ease: "none",
        scrollTrigger: { trigger: img.closest("[data-parallax]"), start: "top bottom", end: "bottom top", scrub: true }
      });
    });
  }

  /* ----------------------------------------------------------
     Clip-path wipe reveal for the intro image
     ---------------------------------------------------------- */
  function setupClipReveals() {
    gsap.utils.toArray(".reveal-clip").forEach(function (fig) {
      var img = fig.querySelector("img");
      gsap.set(fig, { clipPath: "inset(0 0 100% 0)" });
      gsap.to(fig, {
        clipPath: "inset(0 0 0% 0)", duration: 1.2, ease: "power3.inOut",
        scrollTrigger: { trigger: fig, start: "top 80%" }
      });
      if (img) {
        gsap.to(img, {
          scale: 1, duration: 1.4, ease: "power3.out",
          scrollTrigger: { trigger: fig, start: "top 80%" }
        });
      }
    });
  }

  /* ----------------------------------------------------------
     Magnetic buttons (button follows cursor slightly)
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
     Custom cursor — gold ring, grows over interactive elements,
     shows an arrow over images.
     ---------------------------------------------------------- */
  function setupCursor() {
    var cursor = document.querySelector(".cursor");
    if (!cursor) return;
    var xTo = gsap.quickTo(cursor, "x", { duration: 0.18, ease: "power3" });
    var yTo = gsap.quickTo(cursor, "y", { duration: 0.18, ease: "power3" });

    window.addEventListener("mousemove", function (e) { xTo(e.clientX); yTo(e.clientY); });
    document.addEventListener("mouseleave", function () { gsap.to(cursor, { autoAlpha: 0, duration: 0.2 }); });
    document.addEventListener("mouseenter", function () { gsap.to(cursor, { autoAlpha: 1, duration: 0.2 }); });

    // Grow over links/buttons; media state (with arrow) over images.
    var media = "a, button, .btn, .link-arrow, .nav__link";
    document.querySelectorAll(media).forEach(function (el) {
      el.addEventListener("mouseenter", function () { cursor.classList.add("is-grow"); });
      el.addEventListener("mouseleave", function () { cursor.classList.remove("is-grow"); });
    });
    document.querySelectorAll(".media, img").forEach(function (el) {
      el.addEventListener("mouseenter", function () { cursor.classList.add("is-media"); });
      el.addEventListener("mouseleave", function () { cursor.classList.remove("is-media"); });
    });
  }

  /* ----------------------------------------------------------
     Orchestrated page-load: nav then hero text, one after another
     ---------------------------------------------------------- */
  function introSequence() {
    var tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from(".nav__logo", { y: -20, autoAlpha: 0, duration: 0.7 })
      .from(".nav__links", { y: -20, autoAlpha: 0, duration: 0.7 }, "-=0.5")
      .from(".hero__line--1", { autoAlpha: 0, y: 30, duration: 0.9 }, "-=0.2")
      .from(".hero__line--2", { autoAlpha: 0, y: 20, duration: 0.8 }, "-=0.55")
      .from(".hero__line--3", { autoAlpha: 0, y: 30, duration: 0.9 }, "-=0.55")
      .from([".hero__corner", ".hero__scroll"], { autoAlpha: 0, duration: 0.8, stagger: 0.1 }, "-=0.4");
  }

  /* ----------------------------------------------------------
     Reduced-motion / no-GSAP fallback:
     static poster frame, everything visible, no scrub.
     ---------------------------------------------------------- */
  function staticFallback() {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("is-in"); });
    var video = document.querySelector(".hero__video");
    if (video) {
      // Show a still first frame (poster) rather than playing.
      video.removeAttribute("autoplay");
      var showFrame = function () { try { video.currentTime = 0.1; } catch (e) {} };
      if (video.readyState >= 1) showFrame();
      else video.addEventListener("loadedmetadata", showFrame);
    }
  }

})();
