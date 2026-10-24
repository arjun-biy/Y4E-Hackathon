// start page. images come from design-system/start-page-scenes.blend, motion is anime.js
// anime.js 4.5.0, copied in so the site works on github pages without npm
import { animate, createTimeline, onScroll, stagger, splitText, utils } from "./lib/anime.esm.min.js";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const narrow = () => innerWidth <= 860;
const $ = id => document.getElementById(id);

const heroFloat = document.querySelector(".hero-float");
const crumbs = [...document.querySelectorAll(".crumb")];
const probTray = $("prob-tray"), probFood = [...probTray.querySelectorAll(".food")];
const howTray = $("how-tray"), howFood = [...howTray.querySelectorAll(".food")];
const scan = $("scan"), readoutB = $("readout");
const carton = $("carton");
// little food pictures = pounds saved
const SAVED = ["corn", "apple", "carrot-sticks", "steamed-broccoli", "orange-slices", "green-salad", "milk"];
const savedCubes = Array.from({ length: 14 }, (_, i) => {
  const im = document.createElement("img");
  im.src = `img/${SAVED[i % SAVED.length]}.png`; im.alt = "";
  $("saved-grid").appendChild(im);
  utils.set(im, { scale: 0 });
  return im;
});

// --- animations
const fmt = n => Math.round(n).toLocaleString();

if (!reduce) {
  // Hero: wordmark letters rise in, tray floats and turns
  const split = splitText(".wordmark", { chars: { wrap: "clip" } });
  createTimeline({ defaults: { ease: "out(4)" } })
    .add(split.chars, { y: ["110%", "0%"], duration: 900, delay: stagger(28) }, 150)
    .add(".tagline, .info-card", { opacity: [0, 1], y: [12, 0], duration: 700, delay: stagger(120) }, 500)
    .add(heroFloat, { scale: [.7, 1], opacity: [0, 1], rotate: [-8, 0], duration: 1600, ease: "out(3)" }, 0)
    .add(crumbs, { scale: [0, 1], opacity: [0, 1], duration: 900, delay: stagger(90), ease: "out(3)" }, 500)
    .add(".nav, .side-label", { opacity: [0, 1], duration: 800 }, 700);

  animate(".hero-img", { y: [-8, 10], rotate: [-1.5, 1.5], duration: 3200, alternate: true, loop: true, ease: "inOut(2)" });
  crumbs.forEach((c, i) => animate(c, {
    y: [0, utils.random(-30, -14)], rotate: [utils.random(-12, -4), utils.random(4, 12)],
    duration: utils.random(2600, 4200), alternate: true, loop: true, ease: "inOut(2)", delay: i * 140
  }));
  // Hero exits as you scroll away
  animate(".hero-copy, .info-card", {
    y: [0, -120], opacity: [1, 0], ease: "linear",
    autoplay: onScroll({ target: ".hero", enter: "top top", leave: "top bottom", sync: true })
  });

  // Problem: tray tips, food slides into the bin, stats count up
  if (!narrow()) {
    createTimeline({
      defaults: { ease: "linear" },
      autoplay: onScroll({ target: "#problem", enter: "top top", leave: "bottom bottom", sync: .25 })
    })
      .add(probTray, { rotate: [0, 24], duration: 450, ease: "inOut(2)" }, 150)
      // food slides off the tilted tray into the bin's opening (offsets are in the tray's tilted frame)
      .add(probFood, { x: (el, i) => ["0%", ["36%", "0%", "0%"][i]], y: (el, i) => ["0%", ["50%", "60%", "42%"][i]], rotate: () => [0, utils.random(-120, 120)], scale: [1, .55], duration: 420, delay: stagger(40), ease: "in(2)" }, 330)
      .add(probFood, { opacity: [1, 0], duration: 60, delay: stagger(40) }, 700)
      .add("#bin", { y: ["0%", "3%", "0%"], duration: 120 }, 720)
      .add(probTray, { rotate: 0, duration: 250, ease: "inOut(2)" }, 750)
      .add(".pin#problem .stat, .pin#problem hr, .pin#problem .note", { opacity: [0, 1], y: [24, 0], duration: 160, delay: stagger(60) }, 60);
  }
  document.querySelectorAll(".stat").forEach(s => {
    const out = s.querySelector(".num"), target = +s.dataset.stat, dec = +(s.dataset.dec || 0);
    const pre = s.dataset.prefix || "", suf = s.dataset.suffix || "";
    const v = { n: 0 };
    animate(v, {
      n: target, duration: 1600, ease: "out(3)",
      onUpdate: () => out.textContent = pre + (dec ? v.n.toFixed(dec) : fmt(v.n)) + suf,
      onComplete: () => out.textContent = pre + (dec ? target.toFixed(dec) : fmt(target)) + suf,
      autoplay: onScroll({ target: s, enter: "bottom-=10% top", sync: "play", repeat: false })
    });
  });

  // How it works: tray lands on the scale, scan sweeps, broccoli shrinks
  if (narrow()) {
    readoutB.textContent = "0586 g";
  } else {
    const g = { v: 0 };
    const steps = [...document.querySelectorAll("#how .step")];
    const showStep = i => steps.forEach(s => {
      const on = +s.dataset.step === i;
      s.style.opacity = on ? 1 : 0;
      s.style.transform = on ? "none" : "translateY(16px)";
      s.style.transition = "opacity .45s, transform .45s";
    });
    showStep(0);
    createTimeline({
      defaults: { ease: "linear" },
      autoplay: onScroll({
        target: "#how", enter: "top top", leave: "bottom bottom", sync: .25,
        onUpdate: self => {
          const p = self.progress;
          document.querySelector("#how .progress i").style.width = (p * 100).toFixed(1) + "%";
          showStep(p < .36 ? 0 : p < .68 ? 1 : 2);
        }
      })
    })
      .add(howTray, { y: ["-70%", "0%"], opacity: [0, 1], duration: 260, ease: "out(3)" }, 20)
      .add(g, { v: [0, 586], duration: 160, ease: "out(2)", onUpdate: () => readoutB.textContent = String(Math.round(g.v)).padStart(4, "0") + " g" }, 230)
      .add(scan, { opacity: [0, 1], duration: 30 }, 380)
      .add(scan, { left: ["10%", "90%"], duration: 240, ease: "inOut(2)" }, 400)
      .add(scan, { opacity: 0, duration: 30 }, 640)
      .add(howFood.filter(f => f.dataset.food === "broc"), { scale: [1, .45], duration: 160, ease: "inOut(2)" }, 720)
      .add(howFood.filter(f => f.dataset.food === "apple"), { x: ["0%", "40%"], y: ["0%", "-10%"], rotate: [0, 160], opacity: [1, 0], duration: 180, ease: "inOut(2)" }, 780);
  }

  // Savings: carton bobs, food pictures pop in
  animate(carton, { y: [-10, 10], rotate: [-3, 3], duration: 2400, alternate: true, loop: true, ease: "inOut(2)" });

  // Privacy line scrambles in
  const pl = splitText("#privacy-line", { chars: { wrap: "clip" } });
  animate(pl.chars, {
    y: ["100%", "0%"], opacity: [0, 1], duration: 700, delay: stagger(22), ease: "out(3)",
    autoplay: onScroll({ target: "#privacy-line", enter: "bottom-=15% top", sync: "play", repeat: false })
  });
  animate(".cta .heading, .cta .body, .cta-row", {
    y: [40, 0], opacity: [0, 1], duration: 800, delay: stagger(100), ease: "out(3)",
    autoplay: onScroll({ target: ".cta", enter: "bottom-=10% top", sync: "play", repeat: false })
  });
} else {
  document.querySelectorAll(".stat").forEach(s => {
    const dec = +(s.dataset.dec || 0), t = +s.dataset.stat;
    s.querySelector(".num").textContent = (s.dataset.prefix || "") + (dec ? t.toFixed(dec) : fmt(t)) + (s.dataset.suffix || "");
  });
  readoutB.textContent = "0586 g";
}

// --- savings calculator
const LB_PER_STUDENT = 39, CUT = .19, DOLLARS_PER_LB = 1.7e9 / (530000 * 2000);
const slider = document.getElementById("students"), out = document.getElementById("students-out");
const shown = { waste: 0, saved: 0, money: 0, meals: 0 };
let calcAnim;
function updateCalc(instant) {
  const n = +slider.value;
  out.textContent = fmt(n);
  const waste = n * LB_PER_STUDENT, saved = waste * CUT;
  const target = { waste, saved, money: saved * DOLLARS_PER_LB, meals: saved };
  const paint = () => {
    document.getElementById("r-waste").textContent = fmt(shown.waste);
    document.getElementById("r-saved").textContent = fmt(shown.saved);
    document.getElementById("r-money").textContent = "$" + fmt(shown.money);
    document.getElementById("r-meals").textContent = fmt(shown.meals);
  };
  calcAnim?.pause();
  if (instant || reduce) { Object.assign(shown, target); paint(); }
  else calcAnim = animate(shown, { ...target, duration: 650, ease: "out(3)", onUpdate: paint });
  const count = Math.min(savedCubes.length, Math.max(1, Math.round(saved / 600)));
  savedCubes.forEach((c, i) => {
    const on = i < count;
    if (reduce) utils.set(c, { scale: on ? 1 : 0 });
    else animate(c, { scale: on ? 1 : 0, rotate: on ? 0 : 40, duration: 500, delay: on ? i * 25 : 0, ease: on ? "out(3)" : "in(2)" });
  });
}
slider.addEventListener("input", () => updateCalc(false));
updateCalc(true);
if (!reduce) {
  // first reveal counts up from zero when the calculator scrolls into view
  Object.assign(shown, { waste: 0, saved: 0, money: 0, meals: 0 });
  onScroll({ target: ".calc", enter: "bottom-=10% top", repeat: false, onEnter: () => updateCalc(false) });
}

// --- nav highlight
const links = [...document.querySelectorAll(".nav nav a")];
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    links.forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id));
  });
}, { rootMargin: "-45% 0px -50% 0px" });
["intro", "problem", "how", "savings"].forEach(id => io.observe(document.getElementById(id)));
