/* Tray Return Tracker: station + dashboard. Runs fully in the browser, data saved in localStorage. */
(() => {
"use strict";

/* ---------------- Defaults ---------------- */
const DEFAULT_ITEMS = {
  "Cheese pizza": 140, "Chicken tacos": 160, "Fish sticks": 120, "Bean and cheese burrito": 200,
  "Spaghetti with marinara": 220, "Chicken nuggets": 110, "Steamed broccoli": 80, "Green salad": 70,
  "Corn": 90, "Carrot sticks": 60, "Apple": 150, "Orange slices": 100, "Milk": 240,
  "Veggie wrap": 180, "Veggie burger": 170
};
// Each day lists foods by category; a category can hold several foods (students usually take one of them)
const DEFAULT_CATEGORIES = ["Main", "Veg main", "Side", "Fruit", "Drink"];
const DEFAULT_WEEK = {
  Monday: { Main: ["Cheese pizza"], "Veg main": ["Veggie wrap"], Side: ["Green salad"], Fruit: ["Apple", "Orange slices"], Drink: ["Milk"] },
  Tuesday: { Main: ["Chicken tacos"], "Veg main": ["Bean and cheese burrito"], Side: ["Corn"], Fruit: ["Orange slices"], Drink: ["Milk"] },
  Wednesday: { Main: ["Fish sticks"], "Veg main": ["Veggie burger"], Side: ["Steamed broccoli"], Fruit: ["Apple"], Drink: ["Milk"] },
  Thursday: { Main: ["Chicken nuggets"], "Veg main": ["Bean and cheese burrito"], Side: ["Carrot sticks", "Corn"], Fruit: ["Orange slices"], Drink: ["Milk"] },
  Friday: { Main: ["Spaghetti with marinara"], "Veg main": ["Cheese pizza"], Side: ["Steamed broccoli"], Fruit: ["Apple", "Orange slices"], Drink: ["Milk"] }
};
const TYPICAL = {
  "Steamed broccoli": .55, "Green salad": .5, "Fish sticks": .4, "Carrot sticks": .35, "Corn": .25,
  "Apple": .3, "Orange slices": .2, "Milk": .3, "Spaghetti with marinara": .2,
  "Bean and cheese burrito": .25, "Chicken tacos": .12, "Cheese pizza": .08, "Chicken nuggets": .06,
  "Veggie wrap": .3, "Veggie burger": .25
};
const VEG = new Set(["Steamed broccoli", "Green salad", "Corn", "Carrot sticks"]);
const FRUIT = new Set(["Apple", "Orange slices"]);
const DRINKS = new Set(["Milk"]);
const REASONS = [
  { label: "Too much food", icon: "i-plate" },
  { label: "Didn't like it", icon: "i-thumb-down" },
  { label: "Too cold", icon: "i-snow" },
  { label: "Loved it", icon: "i-heart" }
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SCHOOL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const STORE_KEY = "trayReturnTracker.v1";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- Helpers ---------------- */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtDate = s => parseIso(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const level = p => p >= .35 ? "high" : p >= .2 ? "med" : "low";
const LEVEL_NAME = { high: "High", med: "Medium", low: "Low" };
const fmtInt = n => Math.round(n).toLocaleString();
let rand = Math.random;
function seeded(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(m, s) { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

/* ---------------- Storage ---------------- */
// trays: { d: "YYYY-MM-DD", l: listIndex, f: [fraction left, or null if the student didn't take it], v: voteIndex|-1, s: 1 if sample }
let state;
function freshState() {
  return {
    items: { ...DEFAULT_ITEMS },
    categories: [...DEFAULT_CATEGORIES],
    week: JSON.parse(JSON.stringify(DEFAULT_WEEK)),
    lists: [],
    trays: [],
    settings: { recognizer: "gemini", apiKey: "", model: "", emptyTray: 350, v: 2 },  // recognizer "gemini" = real AI scan (Gemini or Groq)
    theme: null
  };
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      state = Object.assign(freshState(), JSON.parse(raw));
      // v1 used Claude: switch saved settings to Gemini real scans
      if (state.settings.v !== 2) Object.assign(state.settings, { recognizer: "gemini", apiKey: "", model: "", v: 2 });
      // older menus had one food per slot: [main, side, fruit, drink]
      if (Array.isArray(state.week.Monday)) {
        state.categories = [...DEFAULT_CATEGORIES];
        for (const d of SCHOOL_DAYS) { const [m, sd, f, dr] = state.week[d]; state.week[d] = { Main: [m], "Veg main": [], Side: [sd], Fruit: [f], Drink: [dr] }; }
      }
      return true;
    }
  } catch (e) { /* storage blocked or corrupt */ }
  state = freshState();
  return false;
}
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { toast("Couldn't save data in this browser. It will reset when you close the page."); }
  }, 150);
}
// One day's menu as a flat list in category order: [{ it: "Apple", cat: "Fruit" }, ...]
function dayMenu(day) {
  const seen = new Set(), out = [];
  for (const cat of state.categories) for (const it of state.week[day]?.[cat] || []) if (!seen.has(it)) { seen.add(it); out.push({ it, cat }); }
  return out;
}
const dayItems = day => dayMenu(day).map(m => m.it);
function listIndex(items) {
  const key = items.join("|");
  let i = state.lists.findIndex(l => l.join("|") === key);
  if (i === -1) { state.lists.push([...items]); i = state.lists.length - 1; }
  return i;
}

/* ---------------- Recognizers ---------------- */
// pretend student takes one food from each category; the foods they didn't take are null
function mockEstimate(menu) {
  const byCat = {};
  // ponytail: any category with "main" in its name counts as one choice (regular or veg); add explicit groups if a school needs it
  for (const { it, cat } of menu) (byCat[/main/i.test(cat) ? "main" : cat] ||= []).push(it);
  const taken = new Set(Object.values(byCat).map(list => list[Math.floor(rand() * list.length)]));
  return menu.map(({ it }) => {
    if (!taken.has(it)) return null;
    const avg = TYPICAL[it] ?? .25;
    if (rand() < .45) return 0;
    return Math.round(Math.min(1, Math.max(0, gauss(avg * 1.6, .2))) * 100) / 100;
  });
}
const DEFAULT_MODEL = "gemini-flash-latest";  // Google's alias for the newest Flash model
// Groq vision models, newest first; the next one is tried if Groq has retired a model
const GROQ_MODELS = ["qwen/qwen3.8-27b", "meta-llama/llama-4-scout-17b-16e-instruct"];
// The key says which AI it's for: Groq keys start with gsk_, Gemini keys with AIza
const aiName = () => state.settings.apiKey.startsWith("gsk_") ? "Groq" : "Gemini";
const scanPrompt = menu => `This is a photo of a school lunch tray after a student finished eating. Today's menu, by category (students usually take one food from each category):
${[...new Set(menu.map(m => m.cat))].map(c => `- ${c}: ${menu.filter(m => m.cat === c).map(m => m.it).join(", ")}`).join("\n")}
First describe in a few words what the photo shows. Any tray, plate, bowl, lunchbox, wrapper or food counts as the tray; set tray_visible to false only if there is no food or dishware at all.
Then, for each menu item, estimate what fraction of the original serving is still left (0 = fully eaten, 1 = untouched). If the student didn't take that item at all, use null.
Also list any foods you see that are NOT in the served list under "other_food".
Reply with JSON only, like {"seen": "a plate with half a pizza and an apple", "tray_visible": true, "left": {"Item name": 0.4}, "other_food": ["banana"]}, using each item name exactly as given.`;

async function post(url, headers, body) {
  try {
    return await fetch(url, { method: "POST", signal: AbortSignal.timeout(30000), headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  } catch (e) {
    console.error(`${aiName()} request failed`, e);
    if (e.name === "TimeoutError") throw new Error(`${aiName()} didn't answer in 30 seconds. Something on this computer or network may be blocking it.`);
    throw new Error(`Couldn't reach ${aiName()}. Check the internet. Screen Time, a school Chrome profile or the Wi-Fi may be blocking it.`);
  }
}
async function errorDetail(res) {
  try { return (await res.json()).error?.message || ""; } catch (e) { return ""; }
}

async function geminiText(menu, jpegBase64) {
  const { apiKey, model } = state.settings;
  const m = model.startsWith("gemini") ? model : DEFAULT_MODEL;
  const res = await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, { "x-goog-api-key": apiKey }, {
    contents: [{ parts: [{ inline_data: { mime_type: "image/jpeg", data: jpegBase64 } }, { text: scanPrompt(menu) }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0 }
  });
  if (!res.ok) {
    const detail = await errorDetail(res);
    if (res.status === 400 && /api key/i.test(detail)) throw new Error("Gemini says the API key isn't valid. Check it in Settings.");
    if (res.status === 403) throw new Error("Gemini refused the key (403). Make a new key at aistudio.google.com/apikey and paste it in Settings.");
    if (res.status === 404) throw new Error(`Gemini doesn't have a model called "${m}". Clear the Model box in Settings.`);
    if (res.status === 429) throw new Error("Gemini's free limit is used up for now. Wait a minute and scan again.");
    throw new Error(`Gemini returned an error (${res.status}). ${detail}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
}

async function groqText(menu, jpegBase64) {
  const { apiKey, model } = state.settings;
  const models = [...new Set([model, ...GROQ_MODELS].filter(m => m && !m.startsWith("gemini")))];
  for (const m of models) {
    const res = await post("https://api.groq.com/openai/v1/chat/completions", { authorization: `Bearer ${apiKey}` }, {
      model: m, temperature: 0, max_completion_tokens: 600, response_format: { type: "json_object" },
      messages: [{ role: "user", content: [
        { type: "text", text: scanPrompt(menu) },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpegBase64}` } }
      ] }]
    });
    if (res.ok) return (await res.json()).choices?.[0]?.message?.content || "";
    const detail = await errorDetail(res);
    if (res.status === 401) throw new Error("Groq says the API key isn't valid. Check it in Settings.");
    if (res.status === 429) throw new Error("Groq's free limit is used up for now. Wait a minute and scan again.");
    if ((res.status === 404 || /model/i.test(detail)) && m !== models[models.length - 1]) continue;  // retired model, try the next
    throw new Error(`Groq returned an error (${res.status}). ${detail}`);
  }
}

async function aiEstimate(menu, jpegBase64) {
  const text = aiName() === "Groq" ? await groqText(menu, jpegBase64) : await geminiText(menu, jpegBase64);
  let json;
  try { json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); }
  catch (e) { throw new Error(`${aiName()}'s answer didn't make sense. Scan again.`); }
  if (json.tray_visible === false) throw new Error(`${aiName()} couldn't see any food${json.seen ? ` (it saw: ${json.seen})` : ""}. Hold the plate or tray up in front of the camera and scan again.`);
  const left = json.left || json;
  const fracs = menu.map(({ it }) => left[it] == null ? null : Math.min(1, Math.max(0, Number(left[it]) || 0)));
  fracs.other = Array.isArray(json.other_food) ? json.other_food.map(String) : [];  // foods not on today's menu
  return fracs;
}

/* Same as match_to_scale in food-waste-station/station.py: nudge guesses to add up to what the scale measured. */
function matchToScale(fracs, items, measured) {
  const est = fracs.reduce((a, f, i) => a + f * (state.items[items[i]] || 0), 0);
  if (est <= 0 || measured <= 0) return fracs;
  const k = Math.max(.5, Math.min(2, measured / est));
  return fracs.map(f => f == null ? null : Math.round(Math.min(1, f * k) * 100) / 100);
}

/* ---------------- Sample data ---------------- */
function seedSample() {
  state.trays = state.trays.filter(t => !t.s);
  rand = seeded(20261009);
  const end = today();
  const d = new Date(end); d.setDate(d.getDate() - 28);
  while (d < end) {
    const dayName = DAYS[d.getDay()];
    const menu = SCHOOL_DAYS.includes(dayName) ? dayMenu(dayName) : [];
    const items = menu.map(m => m.it);
    if (items.length) {
      const l = listIndex(items);
      const n = 150 + Math.floor(rand() * 110);
      for (let i = 0; i < n; i++) {
        const f = mockEstimate(menu);
        const left = f.reduce((a, x, k) => a + x * (state.items[items[k]] || 0), 0);
        let v = -1;
        if (left > 20 && rand() < .3) {
          const worst = items[f.indexOf(Math.max(...f))];
          const w = ["Steamed broccoli", "Green salad", "Fish sticks"].includes(worst) ? [3, 3, 1, 1] : [3, 1, 1, 2];
          let r = rand() * 8; v = 0; while (v < 3 && r > w[v]) { r -= w[v]; v++; }
        }
        state.trays.push({ d: iso(d), l, f, v, s: 1 });
      }
    }
    d.setDate(d.getDate() + 1);
  }
  rand = Math.random;
  state.trays.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
  save();
}

/* ---------------- Theme ---------------- */
function applyTheme() {
  if (state.theme) document.documentElement.dataset.theme = state.theme;
  else delete document.documentElement.dataset.theme;
  const dark = state.theme ? state.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  $("theme-btn").innerHTML = `<svg><use href="#${dark ? "i-sun" : "i-moon"}"/></svg>`;
  $("theme-btn").setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
}
$("theme-btn").onclick = () => {
  const dark = state.theme ? state.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  state.theme = dark ? "light" : "dark";
  save(); applyTheme();
  if (!$("view-dashboard").hidden) renderDashboard();
};

/* ---------------- Toast / tooltip ---------------- */
let toastTimer;
function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 2800);
}
const tip = $("tooltip");
function showTip(html, x, y) {
  tip.innerHTML = html; tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let left = x + 14, top = y - h - 12;
  if (left + w > innerWidth - 8) left = x - w - 14;
  if (top < 8) top = y + 18;
  tip.style.left = left + "px"; tip.style.top = top + "px";
}
const hideTip = () => tip.hidden = true;

/* ---------------- Navigation ---------------- */
const VIEWS = ["station", "dashboard", "menu", "settings"];
function show(view) {
  if (!VIEWS.includes(view)) view = "station";
  VIEWS.forEach(v => $("view-" + v).hidden = v !== view);
  document.querySelectorAll(".tab").forEach(b => {
    if (b.dataset.view === view) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  if (view === "dashboard") renderDashboard();
  if (view === "menu") renderMenu();
  if (view === "settings") renderSettings();
  if (view === "station") renderToday();
  if (view !== "station") stopCamera();
  history.replaceState(null, "", "#" + view);
  scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
}
document.querySelectorAll(".tab").forEach(b => b.onclick = () => show(b.dataset.view));

/* ---------------- Station ---------------- */
let menuDay = SCHOOL_DAYS.includes(DAYS[new Date().getDay()]) ? DAYS[new Date().getDay()] : "Monday";
let pending = null;   // tray waiting for a vote
let busy = false;

function renderDayPicker() {
  const todayName = DAYS[new Date().getDay()];
  $("day-picker").innerHTML = SCHOOL_DAYS.map(d =>
    `<button data-day="${d}" aria-pressed="${d === menuDay}">${d.slice(0, 3)}${d === todayName ? '<span class="today-dot">today</span>' : ""}</button>`).join("");
  $("day-picker").querySelectorAll("button").forEach(b => b.onclick = () => { menuDay = b.dataset.day; renderDayPicker(); renderTray(null); });
  $("menu-line").textContent = state.categories.filter(c => state.week[menuDay][c]?.length).map(c => `${c}: ${state.week[menuDay][c].join(", ")}`).join(" · ") || "Nothing on the menu yet. Add foods in Menu.";
}

function renderTray(fracs) {
  $("tray").innerHTML = dayMenu(menuDay).map(({ it, cat }, i) => {
    const f = fracs ? fracs[i] : null;
    const skipped = fracs && f == null;  // student didn't take this one
    const pct = !fracs ? "" : skipped ? "Not taken" : f === 0 ? "All eaten" : `<b>${Math.round(f * 100)}%</b> left`;
    return `<div class="comp${skipped ? " skipped" : ""}" style="--lvl:var(--${f == null ? "low" : level(f)})">
      <div class="fill" data-h="${f == null ? 0 : Math.round(f * 100)}"></div>
      <span class="name"><span class="cat">${esc(cat)}</span>${esc(it)}</span><span class="pct">${pct}</span></div>`;
  }).join("");
  requestAnimationFrame(() => requestAnimationFrame(() =>
    $("tray").querySelectorAll(".fill").forEach(el => el.style.height = el.dataset.h + "%")));
}

function animateReadout(target) {
  const el = $("readout");
  if (reduceMotion) { el.textContent = fmtInt(target); return; }
  const start = performance.now(), dur = 700;
  (function step(t) {
    const p = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - p, 3);
    const wobble = p < 1 ? (Math.random() - .5) * 40 * (1 - p) : 0;
    el.textContent = fmtInt(Math.max(0, target * e + wobble));
    if (p < 1) requestAnimationFrame(step);
  })(start);
}

// shown over the top of the tray box; info messages fade after a few seconds so they don't cover results
let statusTimer;
function setStatus(msg, err) {
  $("status").textContent = msg; $("status").classList.toggle("err", !!err);
  clearTimeout(statusTimer);
  if (!err && !busy) statusTimer = setTimeout(() => $("status").textContent = "", 6000);
}

function renderVotes() {
  $("vote-grid").innerHTML = REASONS.map((r, i) =>
    `<button class="vote-btn" data-v="${i}" ${pending ? "" : "disabled"}><svg><use href="#${r.icon}"/></svg>${r.label}</button>`).join("");
  $("vote-grid").querySelectorAll("button").forEach(b => b.onclick = () => castVote(+b.dataset.v));
  $("vote-card").classList.toggle("ask", !!pending);
  $("vote-hint").textContent = pending ? "Tap one. It's optional and anonymous." : "Scan a tray with leftovers to ask.";
}
function castVote(v) {
  if (!pending) return;
  pending.v = v; pending = null; save();
  setStatus(`Vote saved: ${REASONS[v].label}. Thanks!`);
  renderVotes(); renderToday();
}

function updateChip() {
  const real = state.settings.recognizer === "gemini";
  $("ai-chip").className = "chip" + (real ? " solid" : "");
  $("ai-chip").textContent = real ? (state.settings.apiKey ? `${aiName()} real scan` : "Real scan: add key in Settings") : "Demo mode";
  if ($("empty-g")) $("empty-g").textContent = state.settings.emptyTray;  // gone once a scan fills in scale-meta
}

/* Camera */
let stream = null;
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) { setStatus("This browser can't use the camera here. Open the app through the launcher (localhost) in Chrome or Safari.", true); return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
    const v = $("cam"); v.srcObject = stream; v.hidden = false; await v.play();
    $("snapshot").hidden = true; $("tray").style.visibility = "hidden"; $("tray-frame").classList.remove("pip");
    uploaded = null;
    $("cam-btn").classList.add("on"); $("cam-btn").querySelector("span").textContent = "Turn off camera";
    setStatus(state.settings.recognizer === "gemini"
      ? "Camera on. Put a tray in front of it and press Scan tray."
      : "Camera on. Demo mode makes up the results. For real ones, pick Gemini in Settings.");
  } catch (e) {
    setStatus(e.name === "NotAllowedError"
      ? "Camera blocked. Allow it in the browser's address bar, and in System Settings > Privacy & Security > Camera, then try again."
      : "Couldn't open the camera. Close other apps using it (FaceTime, Zoom) and try again.", true);
  }
}
function stopCamera() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
  $("cam").hidden = true; $("tray").style.visibility = ""; $("tray-frame").classList.remove("pip");
  $("cam-btn").classList.remove("on"); $("cam-btn").querySelector("span").textContent = "Turn on camera";
}
$("cam-btn").onclick = () => stream ? (stopCamera(), $("snapshot").hidden = true, setStatus("Camera off.")) : startCamera();

function grabPhoto() {
  const v = $("cam"), c = $("grab");
  const w = Math.min(1024, v.videoWidth || 1024), h = Math.round(w * (v.videoHeight || 576) / (v.videoWidth || 1024));
  c.width = w; c.height = h;
  c.getContext("2d").drawImage(v, 0, 0, w, h);
  const url = c.toDataURL("image/jpeg", .82);
  return { url, b64: url.split(",")[1] };
}

let uploaded = null;  // photo picked with "Use a photo"
$("photo-in").onchange = e => {
  const file = e.target.files[0]; e.target.value = "";
  if (!file) return;
  const im = new Image();
  im.onload = () => {
    const c = $("grab"), w = Math.min(1024, im.naturalWidth), h = Math.round(w * im.naturalHeight / im.naturalWidth);
    c.width = w; c.height = h; c.getContext("2d").drawImage(im, 0, 0, w, h);
    const url = c.toDataURL("image/jpeg", .82);
    URL.revokeObjectURL(im.src);
    stopCamera();
    uploaded = { url, b64: url.split(",")[1] };
    $("snapshot").src = url; $("snapshot").hidden = false; $("tray").style.visibility = "hidden";
    setStatus("Photo ready. Press Scan tray.");
  };
  im.onerror = () => setStatus("Couldn't open that file. Pick a JPG or PNG photo.", true);
  im.src = URL.createObjectURL(file);
};

async function scanTray() {
  if (busy) return;
  const menu = dayMenu(menuDay), items = menu.map(m => m.it);
  if (!items.length) { setStatus(`There's nothing on ${menuDay}'s menu. Add foods in Menu first.`, true); return; }
  const useAI = state.settings.recognizer === "gemini";
  if (useAI && !state.settings.apiKey) { setStatus("Paste your free Gemini or Groq API key in Settings first (or switch to Demo mode).", true); return; }
  const weighRaw = $("weigh").value.trim(), reading = weighRaw === "" ? null : Math.round(+weighRaw);
  if (reading != null && !(reading >= 0 && reading <= 5000)) { setStatus("Scale reading should be between 0 and 5000 grams.", true); return; }
  if (reading != null && reading < state.settings.emptyTray) { setStatus(`That's lighter than an empty tray (${state.settings.emptyTray} g). Check the reading or the empty tray weight in Settings.`, true); return; }

  busy = true; pending = null; renderVotes();
  $("scan-btn").disabled = true;
  if (useAI && !stream && !uploaded) {
    // turn the camera on for them and give it a moment to adjust to the light
    await startCamera();
    if (!stream) { $("scan-btn").disabled = false; busy = false; return; }
    setStatus("Hold the tray in front of the camera...");
    await new Promise(r => setTimeout(r, 1500));
  }
  let photo = null;
  if (stream) { photo = grabPhoto(); $("snapshot").src = photo.url; $("snapshot").hidden = false; $("tray-frame").classList.remove("pip"); }
  else if (uploaded) photo = uploaded;
  $("scan-line").hidden = false;
  setStatus(useAI ? `${aiName()} is looking at what's left on the tray...` : "Scanning tray...");

  let fracs;
  const t0 = Date.now();
  const ticker = useAI && setInterval(() => setStatus(`${aiName()} is looking at what's left on the tray... ${Math.round((Date.now() - t0) / 1000)}s`), 1000);
  try {
    if (useAI) fracs = await aiEstimate(menu, photo.b64);
    else { await new Promise(r => setTimeout(r, reduceMotion ? 50 : 900)); fracs = mockEstimate(menu); }
  } catch (e) {
    clearInterval(ticker);
    $("scan-line").hidden = true; $("scan-btn").disabled = false; busy = false;
    if (stream) $("snapshot").hidden = true;
    setStatus(e.message || "Something went wrong reading the tray. Try again.", true);
    return;
  }
  clearInterval(ticker);
  $("scan-line").hidden = true;
  // camera stays on as a small live preview so the next tray can be scanned right away
  if (photo) { $("snapshot").hidden = true; $("tray").style.visibility = ""; uploaded = null; }
  if (stream) $("tray-frame").classList.add("pip");

  const other = fracs.other?.length ? ` Also saw ${fracs.other.join(", ")}, which isn't on ${menuDay}'s menu. Add it in Menu to track it.` : "";
  const measured = reading == null ? null : reading - state.settings.emptyTray;
  if (measured != null) fracs = matchToScale(fracs, items, measured);
  const left = fracs.reduce((a, f, i) => a + f * (state.items[items[i]] || 0), 0);
  const tray = { d: iso(today()), l: listIndex(items), f: fracs, v: -1, s: 0 };
  state.trays.push(tray); save();
  $("weigh").value = "";

  renderTray(fracs);
  animateReadout(reading ?? state.settings.emptyTray + left);
  $("scale-meta").innerHTML = measured != null
    ? `Real scale <b>${fmtInt(reading)}</b> g<br>Food left <b>${fmtInt(measured)}</b> g`
    : `Tray + food <b>${fmtInt(state.settings.emptyTray + left)}</b> g<br>Food left <b>${fmtInt(left)}</b> g`;
  if (left > 20) { pending = tray; setStatus("Saved. Ask the student why they left food (optional)." + other); }
  else setStatus("Saved. Clean tray, nice!" + other);
  renderVotes(); renderToday();
  $("scan-btn").disabled = false; busy = false;
}
$("scan-btn").onclick = scanTray;

$("rush-btn").onclick = () => {
  const menu = dayMenu(menuDay), items = menu.map(m => m.it);
  if (!items.length) { setStatus(`There's nothing on ${menuDay}'s menu. Add foods in Menu first.`, true); return; }
  const l = listIndex(items);
  let last;
  for (let i = 0; i < 50; i++) {
    const f = mockEstimate(menu);
    const left = f.reduce((a, x, k) => a + x * (state.items[items[k]] || 0), 0);
    last = { d: iso(today()), l, f, v: left > 20 && rand() < .3 ? Math.floor(rand() * 4) : -1, s: 0 };
    state.trays.push(last);
  }
  save(); pending = null; renderVotes();
  renderTray(last.f);
  const left = last.f.reduce((a, x, k) => a + x * (state.items[items[k]] || 0), 0);
  animateReadout(state.settings.emptyTray + left);
  $("scale-meta").innerHTML = `Last tray <b>${fmtInt(state.settings.emptyTray + left)}</b> g<br>Food left <b>${fmtInt(left)}</b> g`;
  setStatus("50 trays logged for today.");
  renderToday();
  toast("Lunch rush done: 50 trays added");
};

function renderToday() {
  const d = iso(today());
  const ts = state.trays.filter(t => t.d === d);
  let wasted = 0, votes = 0; const per = {};
  for (const t of ts) {
    const items = state.lists[t.l];
    if (t.v >= 0) votes++;
    t.f.forEach((f, i) => {
      if (f == null) return;  // not taken
      const g = state.items[items[i]] || 0;
      wasted += f * g;
      const p = per[items[i]] || (per[items[i]] = { served: 0, wasted: 0 });
      p.served += g; p.wasted += f * g;
    });
  }
  $("t-trays").textContent = fmtInt(ts.length);
  $("t-kg").textContent = (wasted / 1000).toFixed(1);
  $("t-votes").textContent = fmtInt(votes);
  const rows = Object.entries(per).map(([k, v]) => ({ k, p: v.served ? v.wasted / v.served : 0 })).sort((a, b) => b.p - a.p);
  $("today-list").innerHTML = rows.length ? rows.map(r =>
    `<div class="mini-row" style="--lvl:var(--${level(r.p)})"><span>${esc(r.k)}</span><span class="bar"><i style="width:${Math.round(r.p * 100)}%"></i></span><span class="v">${Math.round(r.p * 100)}%</span></div>`).join("")
    : `<p class="muted small" style="margin:0">No trays scanned today yet.</p>`;
}

/* ---------------- Dashboard ---------------- */
let range = "28";
$("range-seg").querySelectorAll("button").forEach(b => b.onclick = () => {
  range = b.dataset.range;
  $("range-seg").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
  renderDashboard();
});

function filtered() {
  if (range === "all") return state.trays;
  const from = today(); from.setDate(from.getDate() - (+range - 1));
  const f = iso(from);
  return state.trays.filter(t => t.d >= f);
}

function stats(trays) {
  const items = {}, daily = {}, votes = [0, 0, 0, 0], voteItem = {};
  let served = 0, wasted = 0, nVotes = 0;
  for (const t of trays) {
    const list = state.lists[t.l];
    const day = daily[t.d] || (daily[t.d] = { kg: 0, n: 0 });
    day.n++;
    t.f.forEach((f, i) => {
      if (f == null) return;  // not taken
      const it = list[i], g = state.items[it] || 0;
      const s = items[it] || (items[it] = { item: it, servings: 0, served: 0, wasted: 0 });
      s.servings++; s.served += g; s.wasted += f * g;
      served += g; wasted += f * g; day.kg += f * g / 1000;
    });
    if (t.v >= 0 && t.v < REASONS.length) {
      nVotes++; votes[t.v]++;
      if (t.v !== 3) t.f.forEach((f, i) => {
        if (f > .3) { const m = voteItem[list[i]] || (voteItem[list[i]] = [0, 0, 0, 0]); m[t.v]++; }
      });
    }
  }
  const list = Object.values(items).filter(s => s.served > 0).map(s => ({ ...s, pct: s.wasted / s.served })).sort((a, b) => b.pct - a.pct);
  const topReason = {};
  for (const [it, m] of Object.entries(voteItem)) { const mx = Math.max(...m); if (mx > 0) topReason[it] = REASONS[m.indexOf(mx)].label; }
  return { list, daily, votes, nVotes, served, wasted, topReason };
}

function suggestion(s, reason) {
  const it = s.item.toLowerCase();
  if (DRINKS.has(s.item)) return "Let students choose whether to take milk instead of putting it on every tray.";
  if (FRUIT.has(s.item)) return `Set up a share table near the trash so uneaten ${it} can go to another student.`;
  if (reason === "Too much food") return `Serve a smaller portion of ${it} and let students ask for seconds.`;
  if (reason === "Too cold") return `Check the serving temperature of ${it}. Students say it's too cold.`;
  if (VEG.has(s.item)) return `Try a smaller side of ${it} with seasoning or a dip, plus a "more please" option.`;
  if (reason === "Didn't like it") return `Students don't like the ${it}. Try a new recipe or run a taste test.`;
  return `Cook less ${it} or test a different recipe.`;
}

function niceStep(max, ticks = 4) { const raw = max / ticks || 1, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
function barPath(x, y, w, h, r) { r = Math.min(r, w, h / 2); if (w <= 0) return ""; return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`; }

function hBars(el, rows, { step, unit = "", label }) {
  if (!rows.length) { el.innerHTML = `<div class="empty">No data in this time range yet.</div>`; return; }
  const W = Math.max(320, el.clientWidth || 600);
  const lw = (W < 480 ? 120 : 176) + (rows.some(r => r.img) ? 28 : 0), vw = 52, rh = 34, top = 4, ah = 24;
  const H = top + rows.length * rh + ah;
  const max = Math.max(step, Math.ceil(Math.max(...rows.map(r => r.value)) / step) * step);
  const x0 = lw, x1 = W - vw, sx = v => x0 + (v / max) * (x1 - x0);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">`;
  for (let v = 0; v <= max + 1e-9; v += step) {
    s += `<line class="grid-line" x1="${sx(v)}" x2="${sx(v)}" y1="${top}" y2="${H - ah}"/><text class="num" x="${sx(v)}" y="${H - 6}" text-anchor="middle">${+v.toFixed(2)}${unit}</text>`;
  }
  rows.forEach((r, i) => {
    const y = top + i * rh + 7, h = rh - 14;
    if (r.img) s += `<image href="${r.img}" x="${lw - 34}" y="${y + h / 2 - 13}" width="26" height="26"/>`;
    s += `<g class="row"><text class="lbl" x="${lw - (r.img ? 40 : 12)}" y="${y + h / 2 + 4.5}" text-anchor="end">${esc(r.label)}</text>
      <path d="${barPath(x0, y, Math.max(0, sx(r.value) - x0), h, 5)}" fill="${r.color}"/>
      <text class="num" x="${sx(r.value) + 8}" y="${y + h / 2 + 4}">${r.text}</text>
      <rect class="hit" x="0" y="${top + i * rh}" width="${W}" height="${rh}" fill="transparent" data-i="${i}" tabindex="0"/></g>`;
  });
  el.innerHTML = s + "</svg>";
  el.querySelectorAll("rect.hit").forEach(h => {
    const r = rows[+h.dataset.i];
    h.addEventListener("mousemove", e => showTip(r.tip, e.clientX, e.clientY));
    h.addEventListener("focus", () => { const b = h.getBoundingClientRect(); showTip(r.tip, b.left + lw, b.top); });
    h.addEventListener("mouseleave", hideTip); h.addEventListener("blur", hideTip);
  });
}

function lineChart(el, pts) {
  if (pts.length < 2) { el.innerHTML = `<div class="empty">Need at least two school days of data to draw a trend.</div>`; return; }
  const W = Math.max(320, el.clientWidth || 800), H = 250, L = 46, R = 16, T = 26, B = 30;
  const step = niceStep(Math.max(...pts.map(p => p.v)));
  const max = Math.max(step, Math.ceil(Math.max(...pts.map(p => p.v)) / step) * step);
  const last = pts.length - 1;
  const sx = i => L + i / last * (W - L - R), sy = v => T + (1 - v / max) * (H - T - B);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kilograms of food thrown away each school day">`;
  for (let v = 0; v <= max + 1e-9; v += step) s += `<line class="grid-line" x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}"/><text class="num" x="${L - 8}" y="${sy(v) + 4}" text-anchor="end">${+v.toFixed(1)}</text>`;
  s += `<text class="num" x="${L - 8}" y="11" text-anchor="end">kg</text>`;
  const every = Math.ceil(pts.length / (W < 560 ? 4 : 8));
  pts.forEach((p, i) => { if (i % every === 0 || i === last) s += `<text x="${sx(i)}" y="${H - 8}" text-anchor="middle">${fmtDate(p.d)}</text>`; });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(p.v).toFixed(1)}`).join("");
  s += `<path d="${line}L${sx(last)},${sy(0)}L${sx(0)},${sy(0)}Z" fill="var(--primary)" opacity=".12"/>`;
  s += `<path d="${line}" fill="none" stroke="var(--primary)" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/>`;
  s += `<circle cx="${sx(last)}" cy="${sy(pts[last].v)}" r="5" fill="var(--primary)" stroke="var(--card)" stroke-width="2.5"/>`;
  s += `<line id="xh" y1="${T}" y2="${H - B}" stroke="var(--faint)" stroke-dasharray="3 3" visibility="hidden"/><circle id="xd" r="5.5" fill="var(--primary)" stroke="var(--card)" stroke-width="2.5" visibility="hidden"/>`;
  s += `<rect id="lhit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/></svg>`;
  el.innerHTML = s;
  const svg = el.querySelector("svg"), xh = svg.querySelector("#xh"), xd = svg.querySelector("#xd");
  svg.querySelector("#lhit").addEventListener("mousemove", e => {
    const b = svg.getBoundingClientRect(), px = (e.clientX - b.left) * (W / b.width);
    const i = Math.max(0, Math.min(last, Math.round((px - L) / (W - L - R) * last)));
    xh.setAttribute("x1", sx(i)); xh.setAttribute("x2", sx(i)); xh.setAttribute("visibility", "visible");
    xd.setAttribute("cx", sx(i)); xd.setAttribute("cy", sy(pts[i].v)); xd.setAttribute("visibility", "visible");
    showTip(`<b>${DAYS[parseIso(pts[i].d).getDay()]}, ${fmtDate(pts[i].d)}</b><br>${pts[i].v.toFixed(1)} kg thrown away<br>${fmtInt(pts[i].n)} trays`, e.clientX, e.clientY);
  });
  svg.querySelector("#lhit").addEventListener("mouseleave", () => { xh.setAttribute("visibility", "hidden"); xd.setAttribute("visibility", "hidden"); hideTip(); });
}

function renderDashboard() {
  const trays = filtered(), st = stats(trays);
  const dates = Object.keys(st.daily).sort();
  $("range-label").textContent = dates.length
    ? `${fmtDate(dates[0])} to ${fmtDate(dates[dates.length - 1])} · ${state.trays.some(t => t.s) ? "includes sample data" : "your data"}`
    : "No trays in this time range.";

  const pct = st.served ? st.wasted / st.served : 0;
  const kpis = [
    ["Food thrown away", `${(st.wasted / 1000).toFixed(st.wasted > 100000 ? 0 : 1)} kg`, `${fmtInt(trays.length)} trays tracked`, true],
    ["Share of food wasted", `${Math.round(pct * 100)}%`, "of everything served", false],
    ["Left per tray", `${trays.length ? fmtInt(st.wasted / trays.length) : 0} g`, "on average", false],
    ["Most wasted", st.list[0] ? `${Math.round(st.list[0].pct * 100)}%` : "–", st.list[0] ? st.list[0].item : "no data yet", false]
  ];
  $("kpis").innerHTML = kpis.map(([k, v, d]) => `<div class="kpi"><span class="k">${k}</span><span class="v">${v}</span><span class="d">${esc(d)}</span></div>`).join("");

  hBars($("bars"), st.list.map(s => ({
    label: s.item, value: s.pct * 100, text: `${Math.round(s.pct * 100)}%`, color: `var(--${level(s.pct)})`,
    tip: `<b>${esc(s.item)}</b><br>${Math.round(s.pct * 100)}% thrown away (${LEVEL_NAME[level(s.pct)]})<br>${(s.wasted / 1000).toFixed(1)} kg from ${fmtInt(s.servings)} servings`
  })), { step: 10, unit: "%", label: "Percent of each food thrown away" });

  $("bars-table").innerHTML = `<thead><tr><th>Food</th><th class="n">Servings</th><th class="n">Thrown away</th><th class="n">% wasted</th></tr></thead><tbody>${
    st.list.map(s => `<tr><td>${esc(s.item)}</td><td class="n">${fmtInt(s.servings)}</td><td class="n">${(s.wasted / 1000).toFixed(1)} kg</td><td class="n">${Math.round(s.pct * 100)}%</td></tr>`).join("")}</tbody>`;

  const vRows = REASONS.map((r, i) => ({ label: r.label, value: st.votes[i], text: fmtInt(st.votes[i]), color: "var(--accent)",
    tip: `<b>${r.label}</b><br>${fmtInt(st.votes[i])} votes${st.nVotes ? ` (${Math.round(st.votes[i] / st.nVotes * 100)}%)` : ""}` }))
    .filter(r => r.value > 0).sort((a, b) => b.value - a.value);
  hBars($("votes"), vRows, { step: niceStep(Math.max(1, ...vRows.map(r => r.value))), label: "Student votes by reason" });
  $("votes-note").textContent = st.nVotes ? `${fmtInt(st.nVotes)} anonymous votes from the tray return.` : "";

  lineChart($("line"), dates.map(d => ({ d, v: st.daily[d].kg, n: st.daily[d].n })));

  const tips = st.list.filter(s => s.pct >= .2);
  $("tips").innerHTML = tips.length ? tips.map(s => {
    const lv = level(s.pct), reason = st.topReason[s.item];
    return `<li class="tip" style="--lvl:var(--${lv})"><div class="tip-top"><b>${esc(s.item)}</b><span class="pill">${LEVEL_NAME[lv]}</span></div>
      <span class="meta">${Math.round(s.pct * 100)}% wasted · ${(s.wasted / 1000).toFixed(1)} kg · ${reason ? "Top complaint: " + reason : "No complaints yet"}</span>
      <p>${esc(suggestion(s, reason))}</p></li>`;
  }).join("") : `<li class="empty">Nothing is being wasted much. Nice work!</li>`;
}

$("export-btn").onclick = () => {
  const rows = [["date", "tray", "food", "served_grams", "fraction_left", "wasted_grams", "vote", "sample"]];
  filtered().forEach((t, n) => state.lists[t.l].forEach((it, i) => {
    if (t.f[i] == null) return;  // not taken
    const g = state.items[it] || 0;
    rows.push([t.d, n + 1, it, g, t.f[i], (t.f[i] * g).toFixed(1), t.v >= 0 ? REASONS[t.v].label : "", t.s ? "yes" : "no"]);
  }));
  const csv = rows.map(r => r.map(c => /[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `food-waste-${iso(today())}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  toast("CSV downloaded");
};

/* ---------------- Menu ---------------- */
function menuChanged(msg) { save(); renderMenu(); renderDayPicker(); renderTray(null); if (msg) toast(msg); }

function renderMenu() {
  const names = Object.keys(state.items).sort();
  // rows = categories, columns = days; each cell holds any number of foods
  $("week-table").innerHTML = `<thead><tr><th></th>${SCHOOL_DAYS.map(d => `<th>${d}</th>`).join("")}</tr></thead><tbody>${
    state.categories.map(cat => `<tr><td>${esc(cat)}</td>${SCHOOL_DAYS.map(d => {
      const list = state.week[d][cat] || [];
      return `<td><div class="foods">${list.map((it, k) =>
        `<span class="food-chip">${esc(it)}<button data-day="${d}" data-cat="${esc(cat)}" data-k="${k}" aria-label="Remove ${esc(it)} from ${d} ${esc(cat)}">&times;</button></span>`).join("")}
        <select data-day="${d}" data-cat="${esc(cat)}" aria-label="Add a food to ${d} ${esc(cat)}"><option value="">+ Add</option>${
          names.filter(n => !list.includes(n)).map(n => `<option>${esc(n)}</option>`).join("")}</select></div></td>`;
    }).join("")}</tr>`).join("")}</tbody>`;
  $("week-table").querySelectorAll("select").forEach(sel => sel.onchange = () => {
    const { day, cat } = sel.dataset;
    (state.week[day][cat] ||= []).push(sel.value);
    menuChanged(`${sel.value} added to ${day} ${cat}`);
  });
  $("week-table").querySelectorAll(".food-chip button").forEach(b => b.onclick = () => {
    const { day, cat, k } = b.dataset;
    const [gone] = state.week[day][cat].splice(+k, 1);
    menuChanged(`${gone} removed from ${day} ${cat}`);
  });

  $("cat-list").innerHTML = state.categories.map((c, i) => `<div class="cat-row"><input type="text" value="${esc(c)}" data-i="${i}" aria-label="Category name"><button class="btn small-btn danger" data-i="${i}">Remove</button></div>`).join("");
  $("cat-list").querySelectorAll("input").forEach(inp => inp.onchange = () => {
    const old = state.categories[+inp.dataset.i], name = inp.value.trim();
    if (!name || (name !== old && state.categories.includes(name))) { inp.value = old; toast(name ? `There's already a ${name} category` : "Category names can't be empty"); return; }
    state.categories[+inp.dataset.i] = name;
    for (const d of SCHOOL_DAYS) if (state.week[d][old]) { state.week[d][name] = state.week[d][old]; delete state.week[d][old]; }
    menuChanged(`Renamed to ${name}`);
  });
  $("cat-list").querySelectorAll("button").forEach(b => b.onclick = () => {
    const cat = state.categories[+b.dataset.i];
    const used = SCHOOL_DAYS.some(d => state.week[d][cat]?.length);
    if (used && !confirm(`Remove ${cat}? Its foods will be taken off every day's menu.`)) return;
    state.categories.splice(+b.dataset.i, 1);
    for (const d of SCHOOL_DAYS) delete state.week[d][cat];
    menuChanged(`${cat} removed`);
  });

  $("serving-list").innerHTML = names.map(n => `<div class="serving-row"><label for="g-${esc(n)}">${esc(n)}</label><input type="number" min="1" max="2000" id="g-${esc(n)}" data-item="${esc(n)}" value="${state.items[n]}"></div>`).join("");
  $("serving-list").querySelectorAll("input").forEach(inp => inp.onchange = () => {
    const v = Math.round(+inp.value);
    if (!(v >= 1 && v <= 2000)) { inp.value = state.items[inp.dataset.item]; toast("Serving size must be between 1 and 2000 grams"); return; }
    state.items[inp.dataset.item] = v; save(); toast(`${inp.dataset.item}: ${v} g`);
  });
}
$("add-cat-form").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("new-cat").value.trim(), err = $("cat-error");
  err.hidden = true;
  if (!name) { err.textContent = "Type the name of the category."; err.hidden = false; return; }
  if (state.categories.includes(name)) { err.textContent = `There's already a ${name} category.`; err.hidden = false; return; }
  state.categories.push(name);
  $("new-cat").value = "";
  menuChanged(`${name} added. Pick its foods in the menu table.`);
});
$("new-cat").addEventListener("input", () => $("cat-error").hidden = true);
$("add-item-form").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("new-item").value.trim(), g = Math.round(+$("new-grams").value), err = $("add-error");
  err.hidden = true;
  if (!name) { err.textContent = "Type the name of the food."; err.hidden = false; return; }
  if (state.items[name]) { err.textContent = `${name} is already on the list.`; err.hidden = false; return; }
  if (!(g >= 1 && g <= 2000)) { err.textContent = "Enter a serving size between 1 and 2000 grams."; err.hidden = false; return; }
  state.items[name] = g; save();
  $("new-item").value = ""; $("new-grams").value = "";
  renderMenu(); toast(`${name} added. Add it to a day in the menu table.`);
});
["new-item", "new-grams"].forEach(id => $(id).addEventListener("input", () => $("add-error").hidden = true));

/* ---------------- Settings ---------------- */
function renderSettings() {
  const s = state.settings;
  $("rec-mock").checked = s.recognizer !== "gemini";
  $("rec-gemini").checked = s.recognizer === "gemini";
  $("api-key").value = s.apiKey;
  $("model").value = s.model;
  $("empty-tray").value = s.emptyTray;
  const sample = state.trays.filter(t => t.s).length;
  $("data-summary").textContent = `${fmtInt(state.trays.length)} trays saved (${fmtInt(sample)} sample, ${fmtInt(state.trays.length - sample)} scanned by you).`;
  $("confirm").hidden = true;
}
document.querySelectorAll('input[name="recognizer"]').forEach(r => r.onchange = () => { state.settings.recognizer = r.value; save(); updateChip(); toast(r.value === "gemini" ? "Using real AI scans" : "Using Demo mode"); });
$("api-key").onchange = () => { state.settings.apiKey = $("api-key").value.trim(); save(); updateChip(); toast("API key saved"); };
$("model").onchange = () => { state.settings.model = $("model").value.trim(); save(); };
$("empty-tray").onchange = () => {
  const v = Math.round(+$("empty-tray").value);
  if (!(v >= 0 && v <= 3000)) { $("empty-tray").value = state.settings.emptyTray; toast("Enter a weight between 0 and 3000 grams"); return; }
  state.settings.emptyTray = v; save(); updateChip(); toast("Empty tray weight saved");
};
$("reseed-btn").onclick = () => { seedSample(); renderSettings(); toast("4 weeks of sample data loaded"); };
$("clear-btn").onclick = () => { $("confirm").hidden = false; $("confirm-no").focus(); };
$("confirm-no").onclick = () => $("confirm").hidden = true;
$("confirm-yes").onclick = () => { state.trays = []; pending = null; save(); renderSettings(); renderVotes(); renderToday(); toast("All trays and votes deleted"); };

/* ---------------- Boot ---------------- */
const had = load();
if (!had || !state.trays.length) seedSample();
applyTheme();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (!state.theme) { applyTheme(); if (!$("view-dashboard").hidden) renderDashboard(); } });
updateChip();
renderDayPicker();
renderTray(null);
renderVotes();
renderToday();
show((location.hash || "#station").slice(1));
let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (!$("view-dashboard").hidden) renderDashboard(); }, 150); });
})();
