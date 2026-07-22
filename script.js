/* ============================================================
   هەولێر · Erbil — scrollytelling behaviour
   GSAP + ScrollTrigger. Degrades gracefully.
   ============================================================ */

(function () {
  "use strict";

  /* ---- Timeline of eras (signature counter) ----------------
     year: negative = BC (پێش زایین). Captions are PLACEHOLDERS —
     swap for real Sorani copy later.
     -------------------------------------------------------- */
  var ERAS = [
    { year: 2026,  caption: "هەولێری ئەمڕۆ — شارێکی زیندوو و چالاک" },
    { year: 1900,  caption: "لەژێر سایەی سەردەمی عوسمانیدا" },
    { year: 1000,  caption: "ناوەندێکی بازرگانی و ئایینی گرنگ" },
    { year: -100,  caption: "شارێک لە سەردەمی کۆنی نێودۆڵاودا" },
    { year: -2000, caption: "شوێنی پەرستگا و پاشایان" },
    { year: -6000, caption: "کۆنترین شوێنی نیشتەجێبوونی مرۆڤ" }
  ];

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGSAP = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";

  var $num     = document.getElementById("eraNum");
  var $suffix  = document.getElementById("eraSuffix");
  var $caption = document.getElementById("eraCaption");
  var yearSpan = document.getElementById("year");
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  /* ---- Formatting helpers --------------------------------- */
  function formatYear(v) {
    var rounded = Math.round(Math.abs(v));
    return { num: rounded.toLocaleString("en-US"), suffix: v < 0 ? "پ.ز" : "ز" };
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* Interpolate a warm→black stone tone as the year ages */
  function ageColor(p) {
    var r = Math.round(lerp(20, 5, p));
    var g = Math.round(lerp(17, 5, p));
    var b = Math.round(lerp(12, 6, p));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  /* ---- Fallback: no GSAP or reduced motion ---------------- */
  function staticMode() {
    document.body.classList.add("no-anim");
    // Reveal everything.
    Array.prototype.forEach.call(document.querySelectorAll(".reveal"), function (el) {
      el.style.opacity = 1;
      el.style.transform = "none";
    });
    // Replace the single counter with a readable static list of eras.
    var stage = document.querySelector(".era__stage");
    if (stage) {
      var html = '<p class="era__eyebrow">بگەڕێوە بۆ سەردەمان</p><ul class="era__list">';
      ERAS.forEach(function (e) {
        var f = formatYear(e.year);
        html += '<li class="era__item"><span class="era__item-year" dir="ltr">' +
          f.num + " " + f.suffix + '</span><span class="era__item-cap">' +
          e.caption + "</span></li>";
      });
      html += "</ul>";
      stage.innerHTML = html;
    }
  }

  if (!hasGSAP || reduceMotion) {
    staticMode();
    return;
  }

  /* ============================================================
     Full experience
     ============================================================ */
  gsap.registerPlugin(ScrollTrigger);

  /* ---- Hero title + subtitle intro ------------------------ */
  gsap.set([".hero__eyebrow", ".hero__title", ".hero__sub"], { opacity: 0, y: 30 });
  gsap.timeline({ defaults: { ease: "power3.out" } })
    .to(".hero__eyebrow", { opacity: 1, y: 0, duration: 1, delay: 0.3 })
    .to(".hero__title",   { opacity: 1, y: 0, duration: 1.4 }, "-=0.6")
    .to(".hero__sub",     { opacity: 1, y: 0, duration: 1.1 }, "-=0.9");

  /* ---- Generic reveals on every section ------------------- */
  gsap.utils.toArray(".reveal").forEach(function (el) {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 82%", once: true }
    });
  });

  /* ---- Signature: pinned year counter --------------------- */
  var pin  = document.querySelector(".era__pin");
  var track = document.querySelector(".era");
  var segments = ERAS.length - 1;
  var currentCap = -1;

  function setCaption(i) {
    if (i === currentCap) return;
    currentCap = i;
    gsap.fromTo($caption,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.5, ease: "power2.out",
        onStart: function () { $caption.textContent = ERAS[i].caption; } }
    );
  }

  function render(progress) {
    var p = Math.min(Math.max(progress, 0), 1);

    // Which segment are we in?
    var scaled = p * segments;
    var i = Math.min(Math.floor(scaled), segments - 1);
    var t = scaled - i;

    // Interpolated year.
    var year = lerp(ERAS[i].year, ERAS[i + 1].year, t);
    var f = formatYear(year);
    $num.textContent = f.num;
    $suffix.textContent = f.suffix;

    // Caption "arrives" past the halfway point of each segment.
    setCaption(t > 0.5 ? i + 1 : i);

    // Age the atmosphere: darker + dimmer glow.
    pin.style.backgroundColor = ageColor(p);
    pin.style.setProperty("--era-glow", (1 - p * 0.85).toFixed(3));
  }

  render(0);

  ScrollTrigger.create({
    trigger: track,
    start: "top top",
    end: "bottom bottom",
    pin: pin,
    pinSpacing: false,
    scrub: 0.6,
    onUpdate: function (self) { render(self.progress); },
    onRefresh: function (self) { render(self.progress); }
  });

  /* Recompute once the video/fonts settle layout. */
  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
