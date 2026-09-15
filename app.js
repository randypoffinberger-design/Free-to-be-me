Warning: truncated output (original token count: 138844)
Total output lines: 4325

"use strict";

const APP = { name: "More than Measured Test", version: "0.10.0-account-isolation-2-test", schemaVersion: 5 };
const ACCESS = { trialDays: 7, enforcementSource: "server" };
const DB_NAME = "ftbm-test-db",
  DB_VERSION = 6,
  STORE_NAMES = [
    "profiles",
    "achievements",
    "words",
    "notes",
    "appointments",
    "todos",
    "pottyLogs",
    "settings",
    "snapshots",
  ];
const SYNC_STORE_NAMES = ["syncOutbox", "syncMeta", "syncConflicts", "deletedRecords", "accountState"];
const DEVICE_STORE_NAMES = ["accountVaults"];
let db,
  deferredInstallPrompt = null,
  profileAgeTimer = null,
  communityRefreshTimer = null,
  screenTimerInterval = null,
  vocabSessionFilters = null,
  myDayFilterDate = "",
  myDayFilterProfile = "all",
  currentRoute = "",
  routeStack = [],
  navigationQueue = Promise.resolve(),
  remoteRefreshPending = false,
  remoteRefreshRunning = false,
  birthdayGreetingsShown = false;
const $ = (s) => document.querySelector(s),
  view = $("#view"),
  modal = $("#modal"),
  modalBody = $("#modalBody"),
  imageViewer = $("#imageViewer"),
  imageViewerViewport = $("#imageViewerViewport"),
  imageViewerImage = $("#imageViewerImage");
const uid = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const nowISO = () => new Date().toISOString();
const esc = (v = "") =>
  String(v).replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ],
  );
const fmtDate = (v) =>
  v
    ? new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v))
    : "";

let imageViewerScale = 1,
  imageViewerPinchStart = 0,
  imageViewerPinchScale = 1,
  imageViewerReturnFocus = null;
function setImageViewerScale(nextScale) {
  imageViewerScale = Math.min(4, Math.max(1, nextScale));
  imageViewerImage.style.width = `${imageViewerScale * 100}%`;
  if (imageViewerScale === 1) {
    imageViewerViewport.scrollTop = 0;
    imageViewerViewport.scrollLeft = 0;
  }
}
function openImageViewer(src, alt) {
  imageViewerReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  imageViewerImage.src = src;
  imageViewerImage.alt = alt || "Enlarged image";
  setImageViewerScale(1);
  if (!imageViewer.open) imageViewer.showModal();
  $("#closeImageViewer").focus();
}
function closeImageViewer() {
  if (imageViewer.open) imageViewer.close();
}
imageViewer.addEventListener("close", () => {
  imageViewerImage.removeAttribute("src");
  imageViewerReturnFocus?.focus();
  imageViewerReturnFocus = null;
});
$("#closeImageViewer").onclick = closeImageViewer;
$("#imageZoomIn").onclick = () => setImageViewerScale(imageViewerScale + .5);
$("#imageZoomOut").onclick = () => setImageViewerScale(imageViewerScale - .5);
$("#imageZoomReset").onclick = () => setImageViewerScale(1);
imageViewerViewport.addEventListener("touchstart", (event) => {
  if (event.touches.length !== 2) return;
  imageViewerPinchStart = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
  imageViewerPinchScale = imageViewerScale;
}, { passive: true });
imageViewerViewport.addEventListener("touchmove", (event) => {
  if (event.touches.length !== 2 || !imageViewerPinchStart) return;
  event.preventDefault();
  const distance = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
  setImageViewerScale(imageViewerPinchScale * distance / imageViewerPinchStart);
}, { passive: false });
imageViewerViewport.addEventListener("touchend", (event) => {
  if (event.touches.length < 2) imageViewerPinchStart = 0;
}, { passive: true });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && imageViewer.open) closeImageViewer();
});
document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-visual-guide-src]");
  if (!trigger) return;
  openImageViewer(trigger.dataset.visualGuideSrc, trigger.dataset.visualGuideAlt || "More than Measured visual guide");
});
const visualGuideFigure = (file, title, caption = "Tap to enlarge") => {
  const src = `assets/visual-guides/${file}`;
  return `<figure class="visual-guide"><button class="image-viewer-trigger" type="button" data-visual-guide-src="${esc(src)}" data-visual-guide-alt="${esc(title)}" aria-label="Enlarge ${esc(title)}"><img class="guide-illustration" src="${esc(src)}" alt="${esc(title)}" loading="lazy" decoding="async"></button><figcaption><strong>${esc(title)}</strong><span>${esc(caption)}</span></figcaption></figure>`;
};

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const n of [...STORE_NAMES, ...SYNC_STORE_NAMES, ...DEVICE_STORE_NAMES])
        if (!d.objectStoreNames.contains(n))
          d.createObjectStore(n, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const tx = (s, m = "readonly") => db.transaction(s, m).objectStore(s);
const getAll = (s) =>
  new Promise((res, rej) => {
    const r = tx(s).getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
const put = (s, v) =>
  new Promise((res, rej) => {
    const r = tx(s, "readwrite").put(v);
    r.onsuccess = async () => {
      try { await window.MTMSync?.onLocalPut(s, v); res(v); } catch (e) { rej(e); }
    };
    r.onerror = () => rej(r.error);
  });
const clearStore = (s) =>
  new Promise((res, rej) => {
    const r = tx(s, "readwrite").clear();
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
const deleteItem = (s, id) =>
  new Promise((res, rej) => {
    const lookup = tx(s).get(id);
    lookup.onerror = () => rej(lookup.error);
    lookup.onsuccess = () => {
      const r = tx(s, "readwrite").delete(id);
      r.onsuccess = async () => {
        try { await window.MTMSync?.onLocalDelete(s, id, lookup.result); res(); } catch (e) { rej(e); }
      };
      r.onerror = () => rej(r.error);
    };
  });
async function getSetting(k, f = null) {
  const a = await getAll("settings");
  return a.find((x) => x.id === k)?.value ?? f;
}
async function setSetting(k, v) {
  return put("settings", { id: k, value: v, updatedAt: nowISO() });
}

const quotes = [
  "You are not behind. You are learning your child, one loving step at a time.",
  "Progress can be quiet. Celebrate the moments only your family knows how hard-won they are.",
  "Your child does not need comparison. They need connection, patience, and room to shine.",
  "A small step today can become a treasured memory tomorrow.",
  "You are building safety, trust, and possibility every time you show up.",
];
const weeklyQuote = () =>
  quotes[Math.floor(Date.now() / 604800000) % quotes.length];

const routes = {
  home: renderHome,
  child: renderChild,
  speech: renderSpeechBuilding,
  vocabulary: renderVocabulary,
  skills: renderSkills,
  potty: renderPottyTracker,
  pottyTips: renderPottyTips,
  education: renderEducationOptions,
  assessment: renderAssessmentInformation,
  benefits: renderBenefitsInformation,
  safety: renderSafetyInformation,
  therapy: renderTherapyInformation,
  sleep: renderSleepSanctuary,
  health: renderHealthWellness,
  sensory: renderSensorySupport,
  fun: renderAsdFriendlyFunExpanded,
  community: renderCommunityConnections,
  toys: renderToyExchange,
  recommendations: renderRecommendations,
  babysitters: renderBabysitters,
  myDay: renderMyDay,
  screenTime: renderScreenTime,
  myths: renderAutismMyths,
  subscription: renderSubscription,
  food: renderFoodDiary,
  lifeSkills: renderLifeSkills,
  resources: renderResources,
  caregiver: renderCaregiver,
  backup: renderBackup,
  about: renderAbout,
  settings: renderSettings,
  sync: renderSyncCenter,
};

const ACCOUNT_ONLY_ROUTES = new Set(["home", "subscription", "settings", "backup", "about", "sync"]);
async function getEntitlement() {
  const account = await window.MTMSync?.state?.(), entitlement = account?.entitlement;
  if (!entitlement?.enforced) return { access: true, kind: "development", label: "Development access" };
  const level = entitlement.level || entitlement.accessLevel;
  if (level === "owner") return { access: true, kind: "owner", label: "Permanent owner access" };
  if (entitlement.subscriptionStatus === "active" || level === "subscriber")
    return { access: true, kind: "subscriber", label: "Active subscription" };
  const trialEndsAt = entitlement.trialEndsAt ? new Date(entitlement.trialEndsAt) : null;
  if (trialEndsAt && trialEndsAt > new Date()) {
    const remaining = Math.max(1, Math.ceil((trialEndsAt - new Date()) / 86400000));
    return { access: true, kind: "trial", label: `${remaining} trial ${remaining === 1 ? "day" : "days"} remaining`, trialEndsAt };
  }
  return { access: false, kind: "expired", label: "Trial ended" };
}

async function renderSubscription() {
  const status = await getEntitlement();
  view.innerHTML = `<section class="hero"><h1>🌈 Full MTM access</h1><p>More than Measured includes a ${ACCESS.trialDays}-day full-access trial. After the trial, an active household subscription is required.</p></section><div class="card subscription-card"><h2>${esc(status.label)}</h2>${status.access ? `<p>This development build remains fully unlocked while subscriptions are being prepared.</p>` : `<p>Your account and saved information are still here. Subscribe to reopen MTM's features.</p>`}<div class="btn-row"><button class="btn secondary" data-go="sync">Account</button><button class="btn secondary" data-go="backup">Export my data</button></div></div><div class="banner"><strong>Your information stays yours.</strong> An expired trial or subscription never deletes existing records. Before enforcement is enabled, account controls, privacy choices, export, and account deletion will remain available.</div>`;
  bindRouteButtons();
}

function applyRouteChrome(activeRoute = currentRoute) {
  const isHome = activeRoute === "home";
  document.body.classList.toggle("home-route", isHome);
  $("#backBtn").classList.toggle("hidden", isHome);
  $("#homeBadge").classList.toggle("hidden", isHome);
}

async function performNavigation(r, options = {}) {
  let route;
  if (options.back) {
    if (routeStack.length > 1) routeStack.pop();
    else routeStack = ["home"];
    route = routeStack[routeStack.length - 1] || "home";
  } else {
    route = routes[r] ? r : "home";
    if (route !== currentRoute) routeStack.push(route);
  }
  const entitlement = await getEntitlement(),account=await window.MTMSync?.state?.();
  const freeBabysitterAccess=route==="babysitters"&&Boolean(account?.user?.isBabysitter);
  if (!entitlement.access && !ACCOUNT_ONLY_ROUTES.has(route) && !freeBabysitterAccess) route = "subscription";
  if (profileAgeTimer) {
    clearInterval(profileAgeTimer);
    profileAgeTimer = null;
  }
  if(communityRefreshTimer){clearInterval(communityRefreshTimer);communityRefreshTimer=null;}
  if(screenTimerInterval){clearInterval(screenTimerInterval);screenTimerInterval=null;}
  currentRoute = route;
  applyRouteChrome(route);
  try {
    await routes[route]();
  } catch (error) {
    console.error(`Route "${route}" failed`, error);
    view.innerHTML = `<div class="banner"><strong>Could not open this section:</strong> ${esc(error?.message || String(error))}</div><div class="btn-row"><button class="btn secondary" data-go="home" type="button">Return home</button><button class="btn secondary" data-go="${route}" type="button">Try again</button></div>`;
    bindRouteButtons();
  }
  applyRouteChrome(route);
  history.replaceState(null, "", `#${route}`);
  closeDrawer();
  view.focus();
}

function navigate(r, options = {}) {
  const run = () => performNavigation(r, options);
  navigationQueue = navigationQueue.then(run, run);
  return navigationQueue;
}
async function refreshVisibleRouteFromSync(){
  if(!remoteRefreshPending||remoteRefreshRunning||modal.open)return;
  if(document.activeElement?.matches("input, textarea, select, [contenteditable=true]"))return;
  remoteRefreshPending=false;
  if(currentRoute==="sync"||!routes[currentRoute])return;
  remoteRefreshRunning=true;
  try{await routes[currentRoute]();}finally{remoteRefreshRunning=false;}
}
const card = (i, t, d, r) =>
  `<button class="card-button" data-go="${r}"><span class="emoji">${i}</span><strong>${t}</strong><small>${d}</small></button>`;
function bindRouteButtons() {
  document
    .querySelectorAll("[data-go]")
    .forEach((b) => (b.onclick = () => navigate(b.dataset.go)));
}

async function renderHome() {
  applyRouteChrome("home");
  view.innerHTML = `<section class="illustrated-home" aria-label="More than Measured trademark home navigation">
    <picture>
      <source media="(min-width:700px)" srcset="assets/home/homepage-desktop.webp" type="image/webp">
      <img src="assets/home/homepage.jpeg" alt="More than Measured trademark — celebrating every child’s unique journey" width="864" height="1536">
    </picture>
    <button class="home-hotspot growth" data-go="child" aria-label="Open Growth Journey and My Child"><span>Growth Journey</span></button>
    <button class="home-hotspot communication" data-go="speech" aria-label="Open Speech and Language Building"><span>Speech/Language Building</span></button>
    <button class="home-hotspot sleep" data-go="sleep" aria-label="Open Sleep Sanctuary"><span>Sleep Sanctuary</span></button>
    <button class="home-hotspot sensory" data-go="sensory" aria-label="Open Sensory Support"><span>Sensory Support</span></button>
    <button class="home-hotspot learning" data-go="skills" aria-label="Open Skill Building"><span>Skill Building</span></button>
    <button class="home-hotspot medical" data-go="health" aria-label="Open Health and Wellness"><span>Health and Wellness</span></button>
    <button class="home-hotspot caregiver-link" data-go="caregiver" aria-label="Open Caregiver Corner"><span>Caregiver Corner</span></button>
    <button class="home-hotspot community" data-go="fun" aria-label="Open ASD Friendly Fun"><span>ASD Friendly Fun</span></button>
  </section>`;
  bindRouteButtons();
  document
    .querySelectorAll(".home-hotspot[data-feature]")
    .forEach((b) => (b.onclick = () => underConstruction(b.dataset.feature)));
  await showBirthdayGreetingsIfNeeded();
}

function openWeeklyEncouragement() {
  modalBody.innerHTML = `<h2>💛 A message for you</h2>
  <div class="card"><p style="font-size:1.1rem;line-height:1.6">“${esc(weeklyQuote())}”</p></div>
  <p class="hint">A new encouragement appears automatically each week.</p>
  <button id="closeEncouragement" class="btn full" type="button">Thank you</button>`;
  modal.showModal();
  $("#closeEncouragement").onclick = () => modal.close();
}

function underConstruction(feature) {
  modalBody.innerHTML = `<h2>🚧 ${esc(feature)}</h2>
  <div class="banner">This feature is still under construction and will become available in a future build.</div>
  <button id="closeConstruction" class="btn full" type="button" style="margin-top:14px">Got it</button>`;
  modal.showModal();
  $("#closeConstruction").onclick = () => modal.close();
}

const isoToday = () => new Date().toISOString().slice(0, 10);
const wordKey = (v) =>
  String(v || "")
    .trim()
    .toLocaleLowerCase();
const sentenceWordKey = (v) => wordKey(v).replaceAll("’", "'");
function sentenceWords(sentence) {
  const matches =
    String(sentence || "").match(/[\p{L}]+(?:['’][\p{L}]+)*/gu) || [];
  return matches.filter(
    (word, index) =>
      matches.findIndex(
        (candidate) => sentenceWordKey(candidate) === sentenceWordKey(word),
      ) === index,
  );
}
function entryMatchesSearch(item, query) {
  if (!query) return true;
  const metadata = wordKey(
    `${item.notes || ""} ${wordCategories(item).join(" ")} ${languagesText(item.languages)}`,
  );
  if (metadata.includes(query)) return true;
  if (item.entryType !== "sentence") return wordKey(item.word).includes(query);
  if (query.includes(" ")) return wordKey(item.word).includes(query);
  return sentenceWords(item.word).some(
    (word) => sentenceWordKey(word) === sentenceWordKey(query),
  );
}
function parseDateText(value) {
  const s = String(value || "")
    .trim()
    .replace(/^[,;|\-–—\s]+|[,;|\-–—\s]+$/g, "");
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m)
    return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2}|\d{4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += y < 50 ? 2000 : 1900;
    const d = new Date(y, Number(m[1]) - 1, Number(m[2]));
    if (
      d.getFullYear() === y &&
      d.getMonth() === Number(m[1]) - 1 &&
      d.getDate() === Number(m[2])
    )
      return `${y}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`;
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}
function parseBulkVocabulary(text, fallbackDate) {
  const entries = [],
    skipped = [];
  let currentDate = fallbackDate;
  const datePattern =
    /(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[\/.]\d{1,2}[\/.](?:\d{2}|\d{4})|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,)?\s+\d{2,4})/i;
  for (const original of String(text || "").split(/\r?\n/)) {
    let line = original.trim().replace(/^(?:[-•*☐☑✓]+|\d+[.)])\s*/, "");
    if (!line) continue;
    const onlyDate = parseDateText(line);
    if (onlyDate && datePattern.test(line)) {
      currentDate = onlyDate;
      continue;
    }
    const match = line.match(datePattern);
    let date = currentDate,
      word = line;
    if (match) {
      date = parseDateText(match[0]) || currentDate;
      word = line.replace(match[0], "");
    }
    word = word.replace(/^[\s,:;|\-–—]+|[\s,:;|\-–—]+$/g, "").trim();
    if (!word || !date) {
      skipped.push(original);
      continue;
    }
    entries.push({ word, date });
  }
  return { entries, skipped };
}
const DEFAULT_VOCAB_CATEGORIES = [
  "Uncategorized",
  "Sentences",
  "Letters",
  "Numbers",
  "Animals",
  "Toys",
  "Body Parts",
  "Food & Drink",
  "People",
  "Actions",
  "Places",
  "Clothing",
  "Vehicles",
  "Social Words",
  "Descriptive Words",
  "Other",
];
async function getVocabCategories() {
  const saved = await getSetting("vocabCategories", []),
    all = [
      "Uncategorized",
      "Sentences",
      "Letters",
      "Numbers",
      ...saved,
      ...DEFAULT_VOCAB_CATEGORIES,
    ];
  return [...new Set(all.map((x) => String(x).trim()).filter(Boolean))];
}
const capabilityValue = (item, key) =>
  item[key] === undefined ? key === "speak" : Boolean(item[key]);
const abilityDate = (item, key) =>
  item[`${key}Date`] || (key === "speak" ? item.date || "" : "");
const entryDate = (item) =>
  [
    abilityDate(item, "speak"),
    abilityDate(item, "identify"),
    abilityDate(item, "asl"),
  ]
    .filter(Boolean)
    .sort()[0] ||
  item.date ||
  "";
const firstSaidDate = (item) => abilityDate(item, "speak") || item.date || "";
const languagesText = (languages) =>
  (Array.isArray(languages) ? languages : [])
    .map((x) => `${x.language}: ${x.word}`)
    .join("\n");
const wordCategories = (item) =>
  (["sentence", "letter", "number"].includes(item.entryType)
    ? [
        item.entryType === "sentence"
          ? "Sentences"
          : item.entryType === "letter"
            ? "Letters"
            : "Numbers",
      ]
    : [
        item.category,
        ...(Array.isArray(item.additionalCategories)
          ? item.additionalCategories
          : []),
      ]
  )
    .map((x) => String(x || "").trim())
    .filter((x, i, a) => x && a.indexOf(x) === i)
    .slice(0, 3);
function parseLanguages(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s*(?::|\s[-–—]\s)\s*/, 2);
      return {
        language: (parts.length > 1 ? parts[0] : "Other").trim(),
        word: (parts.length > 1 ? parts[1] : parts[0]).trim(),
      };
    })
    .filter((x) => x.word);
}
async function normalizeVocabulary(words) {
  for (const item of words) {
    let changed = false;
    if (!item.entryType) {
      item.entryType = "word";
      changed = true;
    }
    if (item.entryType === "sentence" && item.category !== "Sentences") {
      item.category = "Sentences";
      item.additionalCategories = [];
      changed = true;
    }
    if (item.entryType === "letter" && item.category !== "Letters") {
      item.category = "Letters";
      item.additionalCategories = [];
      changed = true;
    }
    if (item.entryType === "number" && item.category !== "Numbers") {
      item.category = "Numbers";
      item.additionalCategories = [];
      changed = true;
    }
    if (!item.category) {
      item.category = "Uncategorized";
      changed = true;
    }
    if (!Array.isArray(item.additionalCategories)) {
      item.additionalCategories = [];
      changed = true;
    } else {
      const clean = item.additionalCategories
        .filter((c) => c && c !== item.category)
        .filter((c, i, a) => a.indexOf(c) === i)
        .slice(0, 2);
      if (clean.join("|") !== item.additionalCategories.join("|")) {
        item.additionalCategories = clean;
        changed = true;
      }
    }
    for (const key of ["speak", "identify", "asl"])
      if (item[key] === undefined) {
        item[key] = key === "speak";
        changed = true;
      }
    if (item.speak && !item.speakDate && item.date) {
      item.speakDate = item.date;
      changed = true;
    }
    if (!Array.isArray(item.languages)) {
      item.languages = [];
      changed = true;
    }
    if (changed) await put("words", item);
  }
  return words;
}

function renderSpeechBuilding() {
  view.innerHTML = `<section class="hero"><h1>🗣️ Speech & Language Building</h1><p>Tools for supporting and celebrating how your child communicates.</p></section>
  <h2 class="section-title">Communication tools</h2>
  <div class="grid">
    <button class="card-button" data-go="vocabulary"><span class="emoji">💬</span><strong>Communication Tracker</strong><small>Track words, sentences, letters, numbers, identification, speech, and ASL.</small></button>
    <button class="card-button speech-guide" data-guide="asl"><span class="emoji">🤟</span><strong>ASL for ASD</strong><small>How signs can support communication without delaying speech.</small></button>
    <button class="card-button speech-guide" data-guide="signs"><span class="emoji">🖐️</span><strong>ASL Quick Guide</strong><small>Useful everyday signs with demonstration links and future clip slots.</small></button>
    <button class="card-button speech-guide" data-guide="useAsl"><span class="emoji">📘</span><strong>How to Use ASL</strong><small>Modeling, speech, repetition, processing time, and consistency.</small></button>
    <button class="card-button speech-guide" data-guide="aac"><span class="emoji">🔊</span><strong>AAC devices & apps</strong><small>Low-tech boards, dedicated devices, and communication apps.</small></button>
    <button class="card-button speech-guide" data-guide="flash"><span class="emoji">🃏</span><strong>Flash cards for ASD</strong><small>When visual cards help—and when real-life communication works better.</small></button>
    <button class="card-button speech-guide" data-guide="apps"><span class="emoji">📱</span><strong>Speech-language apps</strong><small>App categories and questions to ask before paying.</small></button>
    <button class="card-button speech-guide" data-guide="oralTies"><span class="emoji">👅</span><strong>Oral ties explained</strong><small>Tongue-tie, lip frenulums, feeding signs, evaluation, and treatment evidence.</small></button>
    <button class="card-button speech-guide" data-guide="communicationVisual"><span class="emoji">🗨️</span><strong>Supporting communication growth</strong><small>A visual guide to following the child’s lead, modeling language, pausing, and honoring every communication method.</small></button>
    <button class="card-button speech-guide" data-guide="products"><span class="emoji">🛍️</span><strong>Communication products</strong><small>Practical communication-tool categories and safety questions.</small></button>
  </div>`;
  bindRouteButtons();
  document.querySelectorAll(".speech-guide").forEach((button)=>(button.onclick=()=>openSpeechGuide(button.dataset.guide)));
}

const QUICK_SIGN_GROUPS=[
  ["🍎 Food & Drink",["Eat","Drink","Milk","Water","Thirsty","Hungry","Snack","Apple","Banana","Cookie"]],
  ["💬 Communication Essentials",["More","Want","Help","Please","Thank You","Yes","No","Again","Wait","Stop","All Done","Finished","Sorry","Hi","Bye","Share","Take Turns","Your Turn","My Turn","Mine","Yours"]],
  ["👨‍👩‍👦 Family",["Mom","Dad","Grandma","Grandpa","Brother","Sister","Baby","Family","Love","Hug"]],
  ["🎈 Daily Activities",["Play","Outside","Walk","Swing","Park","Bath","Brush Teeth","Get Dressed","Potty","Sleep","Wake Up","Read Book"]],
  ["😀 Feelings & Emotions",["Happy","Sad","Mad/Angry","Scared","Tired","Excited","Calm","Hurt","Sick","Love"]],
  ["🏡 Around the House",["Open","Close","Clean Up","Sit","Stand","Come Here","Go","Inside","Outside","Light","TV"]],
  ["🚗 Places",["Home","Car","Store","Doctor","School","Church","Playground","Restaurant","Library","Zoo","Aquarium"]],
  ["🧸 Favorite Toys",["Toys","Ball","Blocks","Car","Train","Bubbles","Teddy Bear","Puzzle","Book","Tablet","Music"]],
  ["🩺 Health & Safety",["Medicine","Doctor","Ouch","Hurt","Bandage","Hot","Cold","Dangerous","Gentle","Bathroom"]],
];
const LIFEPRINT_SIGN_SLUGS={
  "All Done":"finish","Thank You":"thankyou","Finished":"finish","Yours":"your",
  "Take Turns":"take-turns","Your Turn":"take-turns","My Turn":"take-turns","Hi":"hello","Bye":"goodbye",
  "Brush Teeth":"brush-teeth","Get Dressed":"clothes","Potty":"toilet","Wake Up":"wake-up","Read Book":"read",
  "Mad/Angry":"angry","Clean Up":"clean","Come Here":"come","TV":"television",
  "Playground":"play","Aquarium":"fish","Toys":"toy","Blocks":"block","Teddy Bear":"bear","Tablet":"computer",
  "Ouch":"hurt","Dangerous":"danger"
};
const lifeprintSignUrl=(label)=>{
  const slug=LIFEPRINT_SIGN_SLUGS[label]||label.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  return `https://www.lifeprint.com/asl101/pages-signs/${slug[0]}/${slug}.htm`;
};
function openSpeechGuide(kind){
  if(kind==="apps"){openSpeechAppsGuide();return;}
  if(kind==="oralTies"){openOralTiesGuide();return;}
  if(kind==="communicationVisual"){openInfoGuide("🗨️ Supporting communication growth",visualGuideFigure("communication-growth.webp","10 ways to support communication growth"));return;}
  const guides={asl:["🤟 ASL and autistic communication",`<p>American Sign Language is a complete natural language with its own grammar. Some families also use individual ASL signs alongside spoken language, gestures, pictures, or AAC.</p><ul><li>A sign can give a child a reliable way to communicate before speech is clear or available.</li><li>Signs may reduce frustration when they are understood and honored by communication partners.</li><li>ASL does not prevent speech development. A child should not have to prove speech failure before receiving AAC or sign support.</li><li>Signing requires vision, motor planning, hand movement, and partners who understand it, so it is not accessible to every child in every moment.</li></ul>`],useAsl:["📘 Using signs throughout the day",`<ul><li>Say the word naturally while making the sign, but accept the child’s sign without requiring speech.</li><li>Model useful words during real moments—“drink” at the cup and “stop” when stopping—not only during drills.</li><li>Repeat consistently across caregivers and settings, then pause long enough for processing.</li><li>Accept approximations and respond to the meaning. Do not physically force the child’s hands through a sign.</li><li>Keep AAC available too; communication methods can work together.</li></ul>`],aac:["🔊 AAC devices and apps",`<p>AAC includes gestures, signs, paper boards, picture systems, letter boards, speech-generating apps, and dedicated devices. It can supplement speech or be a person’s primary voice.</p><h3>Start with access, not brand</h3><ul><li>Get an evaluation from a speech-language pathologist with AAC experience when possible.</li><li>Consider motor access, vision, hearing, vocabulary layout, language system, durability, voice, portability, backup communication, and partner training.</li><li>Do not remove AAC as punishment, require the child to earn it, or keep it only at school or therapy.</li><li>Model words on the system without demanding immediate imitation.</li></ul><div class="education-links"><a class="education-link" href="https://praacticalaac.org/" target="_blank" rel="noopener"><strong>PrAACtical AAC</strong><span>Free implementation ideas and partner support.</span><small>Open ↗</small></a><a class="education-link" href="https://www.assistiveware.com/learn-aac" target="_blank" rel="noopener"><strong>Learn AAC</strong><span>Free AAC learning resources from an app developer.</span><small>Open ↗</small></a></div><h3>Help obtaining a device, app, or visual supports</h3><p>These programs use separate applications, geographic limits, age rules, financial-need standards, and availability periods. An award is never guaranteed.</p><div class="education-links"><a class="education-link" href="https://autisticchildrenofamerica.org/our-programs/ipad-program/" target="_blank" rel="noopener"><strong>ASDF/Autistic Children of America iPad program</strong><span>Communication and learning iPad assistance for some nonspeaking autistic children and special-education classrooms; check the current application window.</span><small>Program page ↗</small></a><a class="education-link" href="https://nationalautismassociation.org/wp-content/uploads/2024/01/GiveAVoiceApplication0124-iPad.pdf" target="_blank" rel="noopener"><strong>NAA Give A Voice</strong><span>Limited communication-device assistance for U.S. residents age 5 or older with an autism diagnosis, substantial communication needs, safety risk, and documented financial need.</span><small>Current application details ↗</small></a><a class="education-link" href="https://www.andrewsgift26.com/ipads" target="_blank" rel="noopener"><strong>Andrew’s Gift iPad and AAC-app grants</strong><span>Pennsylvania program pairing some device or AAC-app grants with in-person iPad Day training in Hershey.</span><small>Program page ↗</small></a><a class="education-link" href="https://kinarkautismservices.ca/programs-and-services/foundational-family-services/resource-kits/" target="_blank" rel="noopener"><strong>Kinark individualized resource kits</strong><span>Free Ontario-based visual schedules, social narratives, communication materials, and other individualized resources for eligible children diagnosed with or awaiting assessment for autism.</span><small>Ontario program ↗</small></a></div><div class="banner"><strong>A tablet is hardware; AAC is a communication system.</strong> Funding for an iPad does not guarantee the right vocabulary, access method, app, case, training, or long-term support. Keep a low-tech backup available.</div>`],flash:["🃏 Flash cards",`<p>Flash cards can make language visually clear and repeatable, especially for matching, labeling, categories, routines, or words that are hard to demonstrate. They are one tool—not a requirement.</p><ul><li>Use clear images with little background clutter.</li><li>Connect the card to the real object, person, action, or place.</li><li>Keep sessions brief and stop before the child is overloaded.</li><li>Do not confuse naming a picture with understanding or using the word in daily life.</li><li>Let a special interest make practice meaningful.</li></ul>`],apps:["📱 Speech-language apps",`<p>Look for the goal before the app: communication, articulation practice, receptive language, early literacy, social stories, or caregiver modeling.</p><ul><li>Prefer apps that work offline, protect privacy, allow export/backup, and do not lock the child’s voice behind a subscription.</li><li>For AAC, avoid rearranging a learned motor layout without a clinical reason.</li><li>Ask whether the app supports the child’s access needs and whether the skill transfers away from the screen.</li></ul><div class="education-links"><a class="education-link" href="https://www.asha.org/public/speech/development/" target="_blank" rel="noopener"><strong>ASHA communication development</strong><span>Milestones and when to seek an evaluation.</span><small>Open ↗</small></a></div>`],products:["🛍️ Communication products",`<ul><li>Core-word and choice boards</li><li>Portable dry-erase boards and communication books</li><li>Recordable single-message or sequential buttons</li><li>Photo-card supplies and visual-schedule materials</li><li>Device cases, straps, stands, keyguards, and screen protection</li><li>Switch-access and alternative-access tools recommended after evaluation</li></ul><div class="banner">Communication tools should remain available at all times and should never be used as a reward or taken away as punishment.</div>`]};
  if(kind==="signs"){modalBody.innerHTML=`<h2>🖐️ ASL Quick Guide</h2><p class="hint">Choose a useful everyday word or phrase to open its Lifeprint ASL instruction page. Labels such as “All Done” are matched to the intended ASL concept rather than automatically fingerspelled. A word may appear in more than one section because families use it in different situations.</p><div class="sign-groups">${QUICK_SIGN_GROUPS.map(([group,signs])=>`<section><h3>${group}</h3><div class="sign-grid">${signs.map((sign)=>`<button type="button" class="small-action quick-sign" data-url="${esc(lifeprintSignUrl(sign))}">${esc(sign)}</button>`).join("")}</div></section>`).join("")}</div><p class="hint">Demonstrations open on Lifeprint/ASL University and require an internet connection.</p>`;modal.showModal();document.querySelectorAll(".quick-sign").forEach((b)=>b.onclick=()=>open(b.dataset.url,"_blank","noopener"));return;}
  const [title,body]=guides[kind]||guides.asl;openInfoGuide(title,body);
}

function openSpeechAppsGuide(){
  openInfoGuide("📱 Communication and speech-language apps",`<p>Start with the job the child needs the app to do. An <strong>AAC app</strong> gives someone a way to express their own messages. A <strong>speech-practice or learning app</strong> provides exercises. Practice apps should not replace or be mistaken for a child's communication system.</p><div class="banner"><strong>AAC is a voice, not a reward.</strong> Keep it available across home, school, therapy, and community settings. Do not remove it for behavior, and do not make a child prove they cannot speak before offering AAC.</div><h3>AAC and communication apps</h3><div class="education-links"><a class="education-link" href="https://www.assistiveware.com/products/proloquo2go" target="_blank" rel="noopener"><strong>Proloquo2Go</strong><span>Customizable symbol-based AAC for building words and sentences on iPhone and iPad.</span><small>Official site ↗</small></a><a class="education-link" href="https://thinksmartbox.com/product/grid-for-ipad/" target="_blank" rel="noopener"><strong>Grid by Smartbox</strong><span>Symbol and text communication with multiple vocabulary layouts and access options.</span><small>Official site ↗</small></a><a class="education-link" href="https://www.letmetalk.info/" target="_blank" rel="noopener"><strong>LetMeTalk</strong><span>A picture-based AAC option that can build phrases; confirm current device availability and privacy details.</span><small>Official site ↗</small></a><a class="education-link" href="https://spokenaac.com/" target="_blank" rel="noopener"><strong>Spoken</strong><span>Text- and prediction-based AAC designed to speed construction of spoken messages.</span><small>Official site ↗</small></a><a class="education-link" href="https://otsimo.com/en/aac/" target="_blank" rel="noopener"><strong>Otsimo AAC</strong><span>Picture-based communication; Otsimo also offers separate learning and speech-practice products.</span><small>Official site ↗</small></a></div><h3>Speech, vocabulary, and learning practice</h3><div class="education-links"><a class="education-link" href="https://speechblubs.com/" target="_blank" rel="noopener"><strong>Speech Blubs</strong><span>Video-modeling and imitation activities intended for guided speech practice.</span><small>Official site ↗</small></a><a class="education-link" href="https://otsimo.com/en/" target="_blank" rel="noopener"><strong>Otsimo learning and speech apps</strong><span>Special-education games and a separate speech-therapy practice app.</span><small>Official site ↗</small></a><a class="education-link" href="https://www.autismihelp.com/" target="_blank" rel="noopener"><strong>Autism iHelp</strong><span>Vocabulary-focused learning activities; check current store availability before planning around it.</span><small>Developer site ↗</small></a></div><h3>Before paying or changing systems</h3><ul><li>Ask an AAC-experienced speech-language pathologist to consider language needs, motor access, vision, hearing, literacy, bilingual vocabulary, and positioning when possible.</li><li>Try the full vocabulary and access method—not only a simplified demo. A child needs words for protesting, asking questions, feelings, people, places, humor, and unexpected ideas.</li><li>Check price, subscription terms, platform compatibility, offline use, backups, data export, privacy, family sharing, and whether a school-funded copy can travel home.</li><li>Avoid repeatedly moving buttons in an established AAC layout; motor memory can make stable placement important.</li><li>Model language on the child's system without turning every interaction into a test or requiring imitation.</li></ul><div class="education-links"><a class="education-link" href="https://www.asha.org/public/speech/disorders/aac/" target="_blank" rel="noopener"><strong>ASHA AAC overview</strong><span>What AAC includes and how assessment and support work.</span><small>Clinical source ↗</small></a></div>`);
}

function openOralTiesGuide(){
  queueMicrotask(()=>{
    const heading=[...modalBody.querySelectorAll("h3")].find((item)=>item.textContent==="What a useful evaluation looks like");
    heading?.insertAdjacentHTML("beforebegin",`<h3>Oral hygiene and speech</h3><ul><li><strong>Oral hygiene:</strong> Restricted tongue movement may make it harder for some children to move food debris or lick certain tooth surfaces clean. This can complicate oral hygiene, but tongue-tie alone has not been proven to cause tooth decay or gum inflammation. Regular brushing, flossing when appropriate, and dental care remain important.</li><li><strong>Speech:</strong> Some children with genuinely restricted tongue movement may have difficulty producing particular sounds. Many children compensate without difficulty, and current evidence does not show that tongue-tie generally causes speech disorders or that releasing it prevents long-term speech therapy. An SLP should evaluate the child's actual articulation and tongue function.</li></ul><h3>Oral dysfunction screening tool</h3><button id="oralScreeningChart" class="image-viewer-trigger" type="button" aria-label="Enlarge the oral dysfunction screening chart"><img class="guide-illustration" src="assets/guides/oral-dysfunction-screening-tool.jpeg" alt="Oral Dysfunction Screening Tool symptom checklist supplied by Integrative Lactation Care"></button><p class="hint">Tap the chart to enlarge it without leaving the app. This supplied screening chart can help organize observations, but its symptom count is not a diagnosis. Many listed signs have other possible causes.</p>`);
    $("#oralScreeningChart")?.addEventListener("click",()=>openImageViewer("assets/guides/oral-dysfunction-screening-tool.jpeg","Oral Dysfunction Screening Tool symptom checklist supplied by Integrative Lactation Care"));
    const evaluationList=heading?.nextElementSibling;
    if(evaluationList?.tagName==="UL") evaluationList.innerHTML=`<li><strong>Start with feeding function.</strong> An IBCLC or other appropriately credentialed lactation professional with specific oral-function experience should observe an entire breast/chest or bottle feed and assess latch, milk transfer, swallowing, positioning, and caregiver pain.</li><li><strong>Use a clinician experienced in pediatric frenula.</strong> A pediatric dentist, ENT, oral surgeon, or other appropriately trained clinician can evaluate anatomy together with function and determine whether a procedure should even be considered. Ask about their specific training and how often they perform these evaluations.</li><li><strong>Keep the child's pediatrician involved.</strong> Pediatricians are important for growth, hydration, overall health, and ruling out other causes. Training in oral-motor and feeding dysfunction varies, however, and a routine mouth exam that does not include an observed feed can miss a functional concern.</li><li><strong>Add feeding or speech expertise when needed.</strong> A feeding-specialized SLP or occupational therapist may assess oral-motor skills, feeding, and swallowing within their scope. For an older child's speech concerns, an SLP should evaluate actual articulation and tongue function before surgery is considered.</li><li>The team should consider tongue lift, extension, side-to-side movement, coordination, and the child's real-world function—not only a photo, appearance, or tie “grade.”</li>`;
    const evidenceBanner=[...modalBody.querySelectorAll(".banner")].find((item)=>item.textContent.trim().startsWith("What current evidence does not support:"));
    evidenceBanner?.insertAdjacentHTML("beforebegin",`<h3>When a release may be considered</h3><ul><li><strong>For an infant:</strong> there is a restrictive tongue frenulum plus a current, significant feeding problem—such as ineffective milk transfer, persistent latch difficulty, poor weight gain, or ongoing breastfeeding pain—and a complete feeding assessment has linked the restriction to the problem after skilled lactation support has not been enough.</li><li><strong>For an older child:</strong> there is a current mechanical or speech limitation that qualified professionals can demonstrate is related to restricted tongue movement. An SLP should evaluate articulation concerns; feeding, dental, ENT, or surgical specialists may be needed depending on the actual problem.</li><li>The decision should identify the exact function expected to improve, alternatives already tried, realistic benefits, risks, pain control, and follow-up. A visible frenulum or symptom checklist alone is not the indication.</li></ul>`);
    if(evidenceBanner) evidenceBanner.innerHTML=`<strong>Current problem versus future prevention:</strong> This does <em>not</em> mean that feeding, speech, dental, jaw, or sleep concerns should be ignored. It means surgery is not supported <strong>solely to prevent a possible future problem that the child does not currently have</strong>. Current symptoms still need their own evaluation to determine whether restricted tongue movement is actually contributing. Sleep-disordered breathing, jaw concerns, and dental problems also need the appropriate sleep, ENT, orthodontic, or dental evaluation rather than assuming a frenulum release is the answer. Current AAP guidance does not support infant lip- or cheek-tie release to improve breastfeeding.`;
  });
  openInfoGuide("👅 Oral ties: function before appearance",`<img class="guide-illustration" src="assets/guides/oral-ties-guide.png" alt="Three-panel illustration comparing typical tongue movement, restricted tongue movement, and a normal upper lip frenulum"><p>A <strong>tongue-tie</strong>, or ankyloglossia, is a lingual frenulum that restricts tongue movement enough to affect function. Everyone has a frenulum under the tongue and inside the upper lip. How tissue looks—or where it attaches—does not by itself prove that treatment is needed.</p><h3>Signs worth discussing</h3><ul><li>Difficulty maintaining a breast or bottle latch, repeatedly slipping off, clicking during feeds, milk leaking, very long feeds, or poor milk transfer.</li><li>Poor weight gain, fewer wet diapers, dehydration concerns, or feeding that exhausts the baby or caregiver.</li><li>Nipple pain or injury during breastfeeding, while remembering that positioning, milk supply, oral-motor coordination, and other conditions can cause the same problems.</li><li>For older children: difficulty with tongue movement, chewing or clearing food, or particular speech sounds that an SLP finds are related to restricted movement.</li></ul><p>Reflux, gas, fussiness, messy eating, a gap between the front teeth, speech concerns, snoring, and sleep problems can have many causes. They do not diagnose an oral tie on their own.</p><h3>What a useful evaluation looks like</h3><ul><li>A pediatrician or other qualified clinician reviews growth, health, feeding history, and other possible causes.</li><li>A lactation professional or feeding specialist observes an entire feed and assesses milk transfer, latch, swallowing, and positioning.</li><li>The mouth exam considers tongue lift, extension, side-to-side movement, coordination, and the child's actual function—not only a photo or tie “grade.”</li><li>For speech concerns, a speech-language pathologist evaluates articulation and whether the child can compensate before surgery is considered.</li><li>A pediatric dentist, ENT, oral surgeon, or other appropriately trained clinician may assess whether a procedure is indicated.</li></ul><h3>Treatment may include more than a procedure</h3><ul><li>Feeding support, positioning changes, lactation care, speech or feeding therapy, monitoring growth, or simply observation may be appropriate.</li><li><strong>Frenotomy/frenectomy</strong> releases restrictive tissue with scissors or a laser. Current evidence supports possible short-term reduction in breastfeeding nipple pain in selected infants, but feeding improvement is not guaranteed.</li><li>Laser is not automatically superior to scissors. Ask about training, pain control, bleeding, infection, oral aversion, scarring, reattachment, follow-up, and what benefit is realistically expected.</li><li>Routine wound-opening stretches after infant frenotomy are not recommended by the American Academy of Pediatrics. Follow individualized instructions from the treating medical team and ask what evidence supports them.</li></ul><div class="banner"><strong>What current evidence does not support:</strong> releasing an infant tongue-tie simply to prevent future speech, dental, jaw, or obstructive sleep-apnea problems. The AAP also reports that lip- and cheek-tie surgery does not improve breastfeeding. Those concerns deserve their own proper evaluation.</div><h3>Questions to take to the appointment</h3><ul><li>What specific function is restricted, and what else could explain it?</li><li>Was a full feeding or speech evaluation completed?</li><li>What non-surgical support has been tried?</li><li>What measurable improvement should we expect, and how soon?</li><li>What are the risks, pain-control plan, follow-up plan, and signs of a complication?</li><li>Who will help if feeding becomes worse or the expected change does not happen?</li></ul><div class="banner"><strong>Get prompt help:</strong> Contact the child's clinician urgently for poor feeding with dehydration signs, unusual sleepiness, breathing difficulty, blue color, persistent bleeding after a procedure, fever in a young infant, or failure to gain weight.</div><div class="education-links"><a class="education-link" href="https://www.healthychildren.org/English/ages-stages/baby/breastfeeding/Pages/tongue-tie-in-babies-how-ankyloglossia-affects-breastfeeding.aspx" target="_blank" rel="noopener"><strong>American Academy of Pediatrics family guide</strong><span>Feeding evaluation, current evidence, and limits of surgery.</span><small>Clinical source ↗</small></a><a class="education-link" href="https://www.aapd.org/research/oral-health-policies--recommendations/managment-of-the-frenulum-in-pediatric-dental-patients/" target="_blank" rel="noopener"><strong>American Academy of Pediatric Dentistry policy</strong><span>Team-based assessment and areas where evidence remains limited.</span><small>Dental source ↗</small></a></div><p class="hint">The illustration is educational and cannot diagnose a tongue-tie or lip-tie.</p>`);
}

async function renderVocabulary() {
  const profiles = await getAll("profiles"),
    words = await normalizeVocabulary(await getAll("words")),
    categories = await getVocabCategories(),
    filterDefaults = await getSetting("vocabFilterDefaults", {});
  if (!profiles.length) {
    view.innerHTML = `<div class="empty card"><div class="big">🗣️</div><h2>Create a child profile first</h2><p>Speech and language entries are connected to a child so every word remains part of the correct story.</p><button id="vocabCreateProfile" class="btn">Create profile</button></div>`;
    $("#vocabCreateProfile").onclick = openProfileForm;
    return;
  }
  const years = [
    ...new Set(
      words
        .flatMap((x) =>
          ["speak", "identify", "asl"].map((k) => abilityDate(x, k)),
        )
        .map((x) => String(x || "").slice(0, 4))
        .filter(Boolean),
    ),
  ].sort((a, b) => b - a);
  view.innerHTML = `<section class="hero"><h1>💬 Communication Tracker</h1><p>Track what your child can say, identify, or communicate including ASL.</p></section>
  <div class="speech-totals card" aria-label="Speech and language totals"><div class="totals-heading">Type</div><div class="totals-heading">Total</div><div class="totals-heading">Say</div><div class="totals-heading">Identify</div><div class="totals-heading">ASL</div>${[["Words", "Words"], ["Sentences", "Sentences"], ["Letters", "Letters"], ["Numbers", "Numbers"]].map(([label, id]) => `<div class="totals-label">${label}</div><strong id="total${id}">0</strong><strong id="total${id}Speak">0</strong><strong id="total${id}Identify">0</strong><strong id="total${id}Asl">0</strong>`).join("")}</div>
  <div class="btn-row"><button id="addWord" class="btn">Add one word</button><button id="addLetter" class="btn">Add letter</button><button id="addNumber" class="btn">Add number</button><button id="addSentence" class="btn">Add sentence</button><button id="bulkWords" class="btn secondary">Bulk import entries from Notes</button><button id="manageCategories" class="btn secondary">Manage categories</button></div>
  <div class="vocab-controls card">
    <div class="field"><label>Child</label><select id="vocabProfile"><option value="all">All children</option>${profiles.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div>
    <div class="field"><label>Entry type</label><select id="vocabType"><option value="all">All entry types</option><option value="word">Words only</option><option value="sentence">Sentences only</option><option value="letter">Letters only</option><option value="number">Numbers only</option></select></div>
    <div class="field"><label>Search words, sentences, letters, numbers, notes, categories, or languages</label><input id="vocabSearch" type="search" placeholder="Search speech and language"></div>
    <div class="field"><label>Category</label><select id="vocabCategory"><option value="">All categories</option>${categories.map((c) => `<option>${esc(c)}</option>`).join("")}</select></div>
    <div class="field"><label>Sort</label><select id="vocabSort"><option value="alpha">Alphabetical</option><option value="category">Category</option><option value="newest">Date first said — newest</option><option value="oldest">Date first said — oldest</option></select></div>
    <div class="field"><label>Year</label><select id="vocabYear"><option value="">All years</option>${years.map((y) => `<option>${y}</option>`).join("")}</select></div>
    <div class="field"><label>Month</label><select id="vocabMonth"><option value="">All months</option>${Array.from({ length: 12 }, (_, i) => `<option value="${String(i + 1).padStart(2, "0")}">${new Intl.DateTimeFormat(undefined, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2020, i, 1)))}</option>`).join("")}</select></div>
    <div class="field"><label>Exact date</label><input id="vocabDate" type="date"></div>
    <fieldset class="filter-abilities"><legend>Abilities included in results and date filters</legend><label><input id="filterSpeak" type="checkbox" checked> Speak</label><label><input id="filterIdentify" type="checkbox" checked> Identify</label><label><input id="filterAsl" type="checkbox" checked> ASL</label></fieldset>
    <button id="clearVocabFilters" class="btn secondary" type="button">Clear filters</button>
  </div>
  <div id="vocabSummary" class="section-title"></div><div id="vocabList" class="word-list"></div>`;
  const names = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
  const applyFilterDefaults = () => {
    const d = {
      profile: "all",
      type: "all",
      search: "",
      category: "",
      sort: "alpha",
      year: "",
      month: "",
      exactDate: "",
      speak: true,
      identify: true,
      asl: true,
      ...(vocabSessionFilters || filterDefaults),
    };
    $("#vocabProfile").value = [...$("#vocabProfile").options].some(
      (o) => o.value === d.profile,
    )
      ? d.profile
      : "all";
    $("#vocabSearch").value = d.search || "";
    $("#vocabType").value = ["all", "word", "sentence", "letter", "number"].includes(d.type)
      ? d.type
      : "all";
    $("#vocabCategory").value = [...$("#vocabCategory").options].some(
      (o) => o.value === d.category,
    )
      ? d.category
      : "";
    $("#vocabSort").value = ["alpha", "category", "newest", "oldest"].includes(
      d.sort,
    )
      ? d.sort
      : "alpha";
    $("#vocabYear").value = [...$("#vocabYear").options].some(
      (o) => o.value === String(d.year || ""),
    )
      ? String(d.year || "")
      : "";
    $("#vocabMonth").value = d.month || "";
    $("#vocabDate").value = d.exactDate || "";
    $("#filterSpeak").checked = d.speak !== false;
    $("#filterIdentify").checked = d.identify !== false;
    $("#filterAsl").checked = d.asl !== false;
  };
  const refresh = (preserveOpen = false) => {
    const openIds = preserveOpen
      ? [...document.querySelectorAll(".word-card[open]")].map(
          (card) => card.dataset.wordId,
        )
      : [];
    const profile = $("#vocabProfile").value,
      type = $("#vocabType").value,
      search = $("#vocabSearch").value,
      q = wordKey(search),
      category = $("#vocabCategory").value,
      year = $("#vocabYear").value,
      month = $("#vocabMonth").value,
      exact = $("#vocabDate").value,
      sort = $("#vocabSort").value,
      selected = ["speak", "identify", "asl"].filter(
        (k) =>
          $("#filter" + (k === "asl" ? "Asl" : k[0].toUpperCase() + k.slice(1)))
            .checked,
      );
    vocabSessionFilters = {
      profile,
      type,
      search,
      category,
      sort,
      year,
      month,
      exactDate: exact,
      speak: selected.includes("speak"),
      identify: selected.includes("identify"),
      asl: selected.includes("asl"),
    };
    const totals = words.filter(
        (x) => profile === "all" || x.profileId === profile,
      ),
      totalWords = totals.filter((x) => x.entryType === "word"),
      totalSentences = totals.filter((x) => x.entryType === "sentence"),
      totalLetters = totals.filter((x) => x.entryType === "letter"),
      totalNumbers = totals.filter((x) => x.entryType === "number");
    $("#totalWords").textContent = totalWords.length;
    $("#totalSentences").textContent = totalSentences.length;
    $("#totalLetters").textContent = totalLetters.length;
    $("#totalNumbers").textContent = totalNumbers.length;
    for (const [id, entries, sentence] of [["Words", totalWords, false], ["Sentences", totalSentences, true], ["Letters", totalLetters, false], ["Numbers", totalNumbers, false]]) {
      $("#total" + id + "Speak").textContent = entries.filter((x) => capabilityValue(x, "speak")).length;
      $("#total" + id + "Identify").textContent = sentence ? "—" : entries.filter((x) => capabilityValue(x, "identify")).length;
      $("#total" + id + "Asl").textContent = entries.filter((x) => capabilityValue(x, "asl")).length;
    }
    let shown = words.filter((x) => {
      const dates = selected
          .filter((k) => capabilityValue(x, k))
          .map((k) => abilityDate(x, k))
          .filter(Boolean),
        assigned = wordCategories(x);
      return (
        (profile === "all" || x.profileId === profile) &&
        (type === "all" || x.entryType === type) &&
        (!category || assigned.includes(category)) &&
        (selected.some((k) => capabilityValue(x, k)) ||
          (q && !["speak", "identify", "asl"].some((k) => capabilityValue(x, k)))) &&
        entryMatchesSearch(x, q) &&
        (!exact || dates.includes(exact)) &&
        ((!exact && !year) || dates.some((d) => d.startsWith(year))) &&
        ((!exact && !month) || dates.some((d) => d.slice(5, 7) === month))
      );
    });
    shown.sort(
      sort === "alpha"
        ? (a, b) =>
            a.word.localeCompare(b.word, undefined, { sensitivity: "base" })
        : sort === "oldest"
          ? (a, b) =>
              entryDate(a).localeCompare(entryDate(b)) ||
              a.word.localeCompare(b.word)
          : (a, b) =>
              entryDate(b).localeCompare(entryDate(a)) ||
              a.word.localeCompare(b.word),
    );
    const shownWords = shown.filter((x) => x.entryType === "word").length,
      shownSentences = shown.filter((x) => x.entryType === "sentence").length,
      shownLetters = shown.filter((x) => x.entryType === "letter").length,
      shownNumbers = shown.filter((x) => x.entryType === "number").length;
    $("#vocabSummary").textContent =
      `${shown.length} ${shown.length === 1 ? "result" : "results"} • ${shownWords} ${shownWords === 1 ? "word" : "words"} • ${shownSentences} ${shownSentences === 1 ? "sentence" : "sentences"} • ${shownLetters} ${shownLetters === 1 ? "letter" : "letters"} • ${shownNumbers} ${shownNumbers === 1 ? "number" : "numbers"}`;
    const drawCard = (x) => {
      const controls =
        x.entryType === "sentence"
          ? `<div class="ability-checks"><div class="ability-row"><label><input type="checkbox" class="ability-toggle" data-id="${x.id}" data-key="speak" ${capabilityValue(x, "speak") ? "checked" : ""}> Say</label><input type="date" class="ability-date" data-id="${x.id}" data-key="speak" value="${abilityDate(x, "speak")}" aria-label="Sentence first said date"></div><div class="ability-row"><label><input type="checkbox" class="ability-toggle" data-id="${x.id}" data-key="asl" ${capabilityValue(x, "asl") ? "checked" : ""}> ASL</label><input type="date" class="ability-date" data-id="${x.id}" data-key="asl" value="${abilityDate(x, "asl")}" aria-label="Sentence ASL learned date"></div></div>`
          : `<div class="ability-checks">${[
              ["speak", "Speak"],
              ["identify", "Identify"],
              ["asl", "ASL"],
            ]
              .map(
                ([k, label]) =>
                  `<div class="ability-row"><label><input type="checkbox" class="ability-toggle" data-id="${x.id}" data-key="${k}" ${capabilityValue(x, k) ? "checked" : ""}> ${label}</label><input type="date" class="ability-date" data-id="${x.id}" data-key="${k}" value="${abilityDate(x, k)}" aria-label="${label} learned date"></div>`,
              )
              .join("")}</div>`;
      return `<details class="word-card card ${x.entryType === "sentence" ? "sentence-card" : ""}" data-word-id="${x.id}"><summary><strong>${esc(x.word)}</strong>${entryDate(x) ? `<span>${fmtDate(entryDate(x))}</span>` : ""}</summary><div class="word-details"><div class="word-detail-meta">${wordCategories(
        x,
      )
        .map((c) => `<span class="category-chip">${esc(c)}</span>`)
        .join(
          "",
        )}<span>${esc(names[x.profileId] || "Child")}</span></div>${x.notes ? `<p class="word-notes">${esc(x.notes)}</p>` : ""}${controls}${x.entryType !== "sentence" && x.languages.length ? `<div class="language-list"><strong>Additional languages</strong>${x.languages.map((l) => `<span>${esc(l.language)}: ${esc(l.word)}</span>`).join("")}</div>` : ""}<div class="word-actions"><button class="small-action edit-word" data-id="${x.id}" type="button">Edit</button><button class="small-action danger-link delete-word" data-id="${x.id}" type="button">Delete</button></div></div></details>`;
    };
    if (sort === "category" && shown.length) {
      const groups = new Map();
      for (const item of shown)
        for (const assigned of wordCategories(item).filter(
          (c) => !category || c === category,
        )) {
          if (!groups.has(assigned)) groups.set(assigned, []);
          groups.get(assigned).push(item);
        }
      $("#vocabList").innerHTML = [...groups]
        .sort(([a], [b]) =>
          a.localeCompare(b, undefined, { sensitivity: "base" }),
        )
        .map(
          ([name, items]) =>
            `<section class="category-group"><h2>${esc(name)}</h2>${items
              .sort(
                (a, b) =>
                  firstSaidDate(b).localeCompare(firstSaidDate(a)) ||
                  a.word.localeCompare(b.word, undefined, {
                    sensitivity: "base",
                  }),
              )
              .map(drawCard)
              .join("")}</section>`,
        )
        .join("");
    } else
      $("#vocabList").innerHTML = shown.length
        ? shown.map(drawCard).join("")
        : `<div class="empty card"><div class="big">🔎</div><p>No speech or language entries match these filters.</p></div>`;
    for (const id of openIds)
      document
        .querySelectorAll(`.word-card[data-word-id="${CSS.escape(id)}"]`)
        .forEach((card) => (card.open = true));
    document.querySelectorAll(".ability-toggle").forEach(
      (box) =>
        (box.onchange = async () => {
          const item = words.find((x) => x.id === box.dataset.id);
          if (!item) return;
          item[box.dataset.key] = box.checked;
          if (box.checked && !item[`${box.dataset.key}Date`])
            item[`${box.dataset.key}Date`] = isoToday();
          if (!box.checked) item[`${box.dataset.key}Date`] = "";
          item.date = entryDate(item) || item.date;
          item.updatedAt = nowISO();
          await put("words", item);
          refresh(true);
        }),
    );
    document.querySelectorAll(".ability-date").forEach(
      (input) =>
        (input.onchange = async () => {
          const item = words.find((x) => x.id === input.dataset.id);
          if (!item) return;
          item[`${input.dataset.key}Date`] = input.value;
          if (input.value) item[input.dataset.key] = true;
          item.date = entryDate(item) || item.date;
          item.updatedAt = nowISO();
          await put("words", item);
          refresh(true);
        }),
    );
    document.querySelectorAll(".edit-word").forEach(
      (b) =>
        (b.onclick = () => {
          const item = words.find((x) => x.id === b.dataset.id);
          if (item?.entryType === "sentence") openSentenceForm(profiles, item);
          else openWordForm(profiles, item, categories);
        }),
    );
    document.querySelectorAll(".delete-word").forEach(
      (b) =>
        (b.onclick = async () => {
          const item = words.find((x) => x.id === b.dataset.id);
          if (
            item &&
            confirm(
              `Delete “${item.word}”? This cannot be undone from this screen.`,
            )
          ) {
            await createSnapshot(
              `Before deleting speech/language entry ${item.word}`,
            );
            await deleteItem("words", item.id);
            renderVocabulary();
          }
        }),
    );
  };
  [
    "vocabProfile",
    "vocabType",
    "vocabSearch",
    "vocabCategory",
    "vocabSort",
    "vocabYear",
    "vocabMonth",
    "vocabDate",
    "filterSpeak",
    "filterIdentify",
    "filterAsl",
  ].forEach((id) =>
    $("#" + id).addEventListener(
      id === "vocabSearch" ? "input" : "change",
      refresh,
    ),
  );
  $("#clearVocabFilters").onclick = () => {
    vocabSessionFilters = null;
    applyFilterDefaults();
    refresh();
  };
  $("#addWord").onclick = () => openWordForm(profiles, null, categories);
  $("#addLetter").onclick = () => openFixedEntryPicker(profiles, words, "letter");
  $("#addNumber").onclick = () => openFixedEntryPicker(profiles, words, "number");
  $("#addSentence").onclick = () => openSentenceForm(profiles);
  $("#bulkWords").onclick = () =>
    openBulkVocabulary(profiles, words, categories);
  $("#manageCategories").onclick = () => openCategoryManager(categories);
  applyFilterDefaults();
  refresh();
}

function openFixedEntryPicker(profiles, existing, entryType) {
  const isLetter = entryType === "letter", category = isLetter ? "Letters" : "Numbers",
    choices = isLetter ? Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)) : [...new Set([...Array.from({ length: 101 }, (_, i) => String(i)), ...existing.filter((x) => x.entryType === "number" && /^\d+$/.test(x.word)).map((x) => String(Number(x.word)))])].sort((a, b) => Number(a) - Number(b));
  let selectedProfile = profiles[0]?.id || "";
  const entryFor = (value) => existing.find((x) => x.profileId === selectedProfile && x.entryType === entryType && wordKey(x.word) === wordKey(value));
  const rowHtml = (value) => {
    const item = entryFor(value), abilities = [["speak", "Say"], ["identify", "Identify"], ["asl", "ASL"]];
    return `<div class="fixed-entry-block" data-value="${esc(value)}"><div class="fixed-entry-row"><strong>${esc(value)}</strong>${abilities.map(([key, label]) => `<label class="fixed-ability-toggle"><input type="checkbox" data-key="${key}" ${item && capabilityValue(item, key) ? "checked" : ""}><span>${label}</span></label>`).join("")}</div><div class="fixed-entry-dates">${abilities.map(([key, label]) => `<label data-date-wrap="${key}" class="${item && capabilityValue(item, key) ? "" : "hidden"}"><span>${label} date <small>(optional)</small></span><input type="date" data-date-key="${key}" value="${item ? abilityDate(item, key) : ""}" aria-label="${esc(value)} ${label} learned date"></label>`).join("")}</div></div>`;
  };
  modalBody.innerHTML = `<div class="fixed-entry-picker"><h2>Add or update ${category.toLowerCase()}</h2><div class="field"><label>Child</label><select id="fixedEntryProfile">${profiles.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div><p class="hint">Check each ability learned. Dates are optional and can differ for Say, Identify, and ASL.</p>${isLetter ? "" : `<div class="inline-field"><div class="field"><label>Track numbers beyond 100</label><input id="extraNumber" inputmode="numeric" placeholder="Example: 125"></div><button id="addExtraNumber" class="btn secondary fixed-add-number" type="button">Add number</button></div>`}<div class="fixed-entry-grid"><div class="fixed-entry-head"><strong>${isLetter ? "Letter" : "Number"}</strong>${[["speak", "Say"], ["identify", "Identify"], ["asl", "ASL"]].map(([key, label]) => `<label><input class="fixed-select-all" data-key="${key}" type="checkbox"> Add all ${label}</label>`).join("")}</div><div id="fixedEntryRows">${choices.map(rowHtml).join("")}</div></div><button id="saveFixedEntries" class="btn full" type="button">Save ${category.toLowerCase()}</button></div>`;
  modal.classList.add("wide-modal"); modal.addEventListener("close", () => modal.classList.remove("wide-modal"), { once: true }); if (!modal.open) modal.showModal();
  const syncBlockDates = (block) => {
    let visible = false;
    for (const key of ["speak", "identify", "asl"]) {
      const checked = block.querySelector(`[data-key="${key}"]`).checked,
        wrap = block.querySelector(`[data-date-wrap="${key}"]`);
      wrap.classList.toggle("hidden", !checked);
      if (checked) visible = true;
      else wrap.querySelector("input").value = "";
    }
    block.querySelector(".fixed-entry-dates").classList.toggle("hidden", !visible);
  };
  const bindRows = () => {
    document.querySelectorAll(".fixed-entry-block").forEach((block) => {
      syncBlockDates(block);
      block.querySelectorAll("input[type=checkbox]").forEach((box) => box.onchange = () => syncBlockDates(block));
      block.querySelectorAll("input[type=date]").forEach((date) => date.onchange = () => {
        if (date.value) block.querySelector(`[data-key="${date.dataset.dateKey}"]`).checked = true;
        syncBlockDates(block);
      });
    });
  };
  const redrawRows = () => { $("#fixedEntryRows").innerHTML = choices.map(rowHtml).join(""); bindRows(); };
  $("#fixedEntryProfile").onchange = (event) => { selectedProfile = event.target.value; redrawRows(); document.querySelectorAll(".fixed-select-all").forEach((box) => box.checked = false); };
  document.querySelectorAll(".fixed-select-all").forEach((allBox) => allBox.onchange = () => {
    document.querySelectorAll(`.fixed-entry-block input[type=checkbox][data-key="${allBox.dataset.key}"]`).forEach((box) => { box.checked = allBox.checked; syncBlockDates(box.closest(".fixed-entry-block")); });
  });
  if (!isLetter) $("#addExtraNumber").onclick = () => { const value = $("#extraNumber").value.trim(); if (!/^\d+$/.test(value) || Number(value) <= 100) return alert("Enter a whole number greater than 100."); const normalized = String(Number(value)); if (!choices.includes(normalized)) { choices.push(normalized); choices.sort((a, b) => Number(a) - Number(b)); redrawRows(); } $("#extraNumber").value = ""; document.querySelector(`.fixed-entry-block[data-value="${CSS.escape(normalized)}"]`)?.scrollIntoView({ block: "center" }); };
  bindRows();
  $("#saveFixedEntries").onclick = async () => { const changes = []; for (const row of document.querySelectorAll(".fixed-entry-block")) { const value = row.dataset.value, old = entryFor(value), state = {}; for (const key of ["speak", "identify", "asl"]) { state[key] = row.querySelector(`[data-key="${key}"]`).checked; state[`${key}Date`] = row.querySelector(`[data-date-key="${key}"]`).value; } if (!old && !state.speak && !state.identify && !state.asl) continue; const record = { ...(old || {}), id: old?.id || uid(), entryType, profileId: selectedProfile, word: value, category, additionalCategories: [], ...state, languages: old?.languages || [], notes: old?.notes || "", createdAt: old?.createdAt || nowISO(), updatedAt: nowISO(), syncStatus: "local" }; record.date = entryDate(record) || ""; if (!old || ["speak", "identify", "asl", "speakDate", "identifyDate", "aslDate"].some((key) => old[key] !== record[key])) changes.push(record); } if (!changes.length) return alert("No changes were selected."); await createSnapshot(`Before updating ${category.toLowerCase()}`); for (const record of changes) await put("words", record); modal.close(); renderVocabulary(); };
}

function openWordForm(profiles, item = null, categories = [], initialType = "word") {
  const entryType = item?.entryType || initialType;
  const assigned = wordCategories(item || {}),
    categoryOptions = (selected, optional = false) =>
      `${optional ? '<option value="">None</option>' : ""}${categories.map((c) => `<option ${selected === c ? "selected" : ""}>${esc(c)}</option>`).join("")}`;
  modalBody.innerHTML = `<h2>${item ? "Edit" : "Add"} speech/language entry</h2><div class="form-grid"><div class="field"><label>Child</label><select id="wordProfile">${profiles.map((p) => `<option value="${p.id}" ${item?.profileId === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div><div class="field"><label>Entry type</label><select id="wordEntryType"><option value="word" ${entryType === "word" ? "selected" : ""}>Word or phrase</option><option value="letter" ${entryType === "letter" ? "selected" : ""}>Letter</option><option value="number" ${entryType === "number" ? "selected" : ""}>Number</option></select></div><div class="field"><label>Entry</label><input id="wordText" value="${esc(item?.word || "")}" autocomplete="off"></div><div class="field"><label>Primary category</label><div class="inline-field"><select id="wordCategory">${categoryOptions(assigned[0] || (entryType === "letter" ? "Letters" : entryType === "number" ? "Numbers" : "Uncategorized"))}</select><button id="quickCategory" class="btn secondary" type="button">New</button></div></div><div class="field"><label>Secondary category <span class="hint">(optional)</span></label><select id="wordCategory2">${categoryOptions(assigned[1], true)}</select></div><div class="field"><label>Tertiary category <span class="hint">(optional)</span></label><select id="wordCategory3">${categoryOptions(assigned[2], true)}</select></div><fieldset class="ability-field dated-abilities"><legend>Abilities and dates learned</legend>${[
    ["speak", "Speak"],
    ["identify", "Identify"],
    ["asl", "ASL"],
  ]
    .map(
      ([k, label]) =>
        `<div class="ability-row"><label><input id="word${k === "asl" ? "Asl" : k[0].toUpperCase() + k.slice(1)}" type="checkbox" ${item ? (capabilityValue(item, k) ? "checked" : "") : k === "speak" ? "checked" : ""}> ${label}</label><input id="word${k === "asl" ? "Asl" : k[0].toUpperCase() + k.slice(1)}Date" type="date" value="${item ? abilityDate(item, k) : k === "speak" ? isoToday() : ""}" aria-label="${label} learned date"></div>`,
    )
    .join(
      "",
    )}</fieldset><div class="field"><label>Additional spoken languages <span class="hint">(optional, one per line)</span></label><textarea id="wordLanguages" placeholder="Spanish: gato&#10;French: chat">${esc(languagesText(item?.languages))}</textarea><span class="hint">Use Language: word or phrase. Dates are not required.</span></div><div class="field"><label>Notes <span class="hint">(optional)</span></label><textarea id="wordNotes">${esc(item?.notes || "")}</textarea></div><button id="saveWord" class="btn full" type="button">Save entry</button></div>`;
  if (!modal.open) modal.showModal();
  const syncTypeCategory = () => {
    const type = $("#wordEntryType").value;
    if (type === "letter") $("#wordCategory").value = "Letters";
    if (type === "number") $("#wordCategory").value = "Numbers";
    if (
      type === "word" &&
      ["Letters", "Numbers"].includes($("#wordCategory").value)
    )
      $("#wordCategory").value = "Uncategorized";
    for (const id of ["wordCategory", "wordCategory2", "wordCategory3", "quickCategory"])
      $("#" + id).disabled = type !== "word";
  };
  $("#wordEntryType").onchange = syncTypeCategory;
  syncTypeCategory();
  $("#quickCategory").onclick = async () => {
    const name = prompt("New category name:")?.trim();
    if (!name) return;
    if (categories.some((c) => wordKey(c) === wordKey(name)))
      return alert("That category already exists.");
    categories.push(name);
    await setSetting("vocabCategories", categories);
    for (const id of ["wordCategory", "wordCategory2", "wordCategory3"]) {
      const option = document.createElement("option");
      option.textContent = name;
      if (id === "wordCategory") option.selected = true;
      $("#" + id).append(option);
    }
  };
  for (const key of ["Speak", "Identify", "Asl"]) {
    const box = $("#word" + key),
      date = $("#word" + key + "Date");
    box.onchange = () => {
      if (box.checked && !date.value) date.value = isoToday();
      if (!box.checked) date.value = "";
    };
    date.onchange = () => {
      if (date.value) box.checked = true;
    };
  }
  $("#saveWord").onclick = async () => {
    const word = $("#wordText").value.trim(),
      entryType = $("#wordEntryType").value,
      profileId = $("#wordProfile").value;
    if (!word) return alert("Please enter a word, phrase, letter, or number.");
    if (entryType === "letter" && !/^\p{L}$/u.test(word))
      return alert("Please enter one letter.");
    if (entryType === "number" && !/^\p{N}+$/u.test(word))
      return alert("Please enter a number using digits.");
    const all = await getAll("words");
    if (
      all.some(
        (x) =>
          x.id !== item?.id &&
          x.profileId === profileId &&
          x.entryType === entryType &&
          wordKey(x.word) === wordKey(word),
      )
    )
      return alert("That entry is already listed for this child.");
    const category =
        entryType === "letter"
          ? "Letters"
          : entryType === "number"
            ? "Numbers"
            : $("#wordCategory").value || "Uncategorized",
      additionalCategories =
        entryType === "word"
          ? [$("#wordCategory2").value, $("#wordCategory3").value]
              .filter((c) => c && c !== category)
              .filter((c, i, a) => a.indexOf(c) === i)
          : [];
    const record = {
      id: item?.id || uid(),
      entryType,
      profileId,
      word,
      category,
      additionalCategories,
      speak: $("#wordSpeak").checked,
      identify: $("#wordIdentify").checked,
      asl: $("#wordAsl").checked,
      speakDate: $("#wordSpeakDate").value,
      identifyDate: $("#wordIdentifyDate").value,
      aslDate: $("#wordAslDate").value,
      languages: parseLanguages($("#wordLanguages").value),
      notes: $("#wordNotes").value.trim(),
      createdAt: item?.createdAt || nowISO(),
      updatedAt: nowISO(),
      syncStatus: "local",
    };
    record.date = entryDate(record) || item?.date || isoToday();
    await put("words", record);
    modal.close();
    renderVocabulary();
  };
}

function openSentenceForm(profiles, item = null) {
  modalBody.innerHTML = `<h2>${item ? "Edit" : "Add"} sentence</h2><div class="form-grid"><div class="field"><label>Child</label><select id="sentenceProfile">${profiles.map((p) => `<option value="${p.id}" ${item?.profileId === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div><div class="field"><label>Sentence</label><textarea id="sentenceText" class="sentence-text" placeholder="I want the blue ball">${esc(item?.word || "")}</textarea><span class="hint">Missing spoken words will be added automatically.</span></div><fieldset class="ability-field dated-abilities"><legend>Sentence abilities and dates learned</legend><div class="ability-row"><label><input id="sentenceSpeak" type="checkbox" ${item ? (capabilityValue(item, "speak") ? "checked" : "") : "checked"}> Say</label><input id="sentenceSpeakDate" type="date" value="${item ? abilityDate(item, "speak") : isoToday()}"></div><div class="ability-row"><label><input id="sentenceAsl" type="checkbox" ${item && capabilityValue(item, "asl") ? "checked" : ""}> ASL</label><input id="sentenceAslDate" type="date" value="${item ? abilityDate(item, "asl") : ""}"></div></fieldset><div class="field"><label>Notes <span class="hint">(optional)</span></label><textarea id="sentenceNotes">${esc(item?.notes || "")}</textarea></div><button id="saveSentence" class="btn full" type="button">Save sentence</button></div>`;
  if (!modal.open) modal.showModal();
  for (const key of ["Speak", "Asl"]) { const box = $("#sentence" + key), date = $("#sentence" + key + "Date"); box.onchange = () => { if (!box.checked) date.value = ""; }; date.onchange = () => { if (date.value) box.checked = true; }; }
  $("#saveSentence").onclick = async () => {
    const sentence = $("#sentenceText").value.trim(),
      profileId = $("#sentenceProfile").value,
      speak = $("#sentenceSpeak").checked, asl = $("#sentenceAsl").checked,
      speakDate = $("#sentenceSpeakDate").value, aslDate = $("#sentenceAslDate").value;
    if (!sentence) return alert("Please enter a sentence.");
    if (!speak && !asl) return alert("Select Say, ASL, or both for this sentence.");
    const all = await normalizeVocabulary(await getAll("words"));
    if (
      all.some(
        (x) =>
          x.id !== item?.id &&
          x.profileId === profileId &&
          x.entryType === "sentence" &&
          sentenceWordKey(x.word) === sentenceWordKey(sentence),
      )
    )
      return alert("That sentence is already listed for this child.");
    const known = new Set(
        all
          .filter(
            (x) => x.profileId === profileId && x.entryType === "word",
          )
          .map((x) => sentenceWordKey(x.word)),
      ),
      missing = sentenceWords(sentence).filter(
        (word) => !known.has(sentenceWordKey(word)),
      ),
      sentenceId = item?.id || uid(),
      notes = $("#sentenceNotes").value.trim();
    const saveSentenceAndWords = async (wordDates = {}) => {
      if (speak && missing.length)
      await createSnapshot(
        `Before adding ${missing.length} individual words from a sentence`,
      );
      await put("words", {
      id: sentenceId,
      entryType: "sentence",
      profileId,
      word: sentence,
      date: speakDate || aslDate || "",
      category: "Sentences",
      additionalCategories: [],
      speak,
      identify: false,
      asl,
      speakDate,
      identifyDate: "",
      aslDate,
      languages: [],
      notes,
      createdAt: item?.createdAt || nowISO(),
      updatedAt: nowISO(),
      syncStatus: "local",
    });
      for (const word of speak ? missing : []) {
        const wordDate = wordDates[sentenceWordKey(word)] ?? speakDate;
        await put("words", {
        id: uid(),
        entryType: "word",
        profileId,
        word,
        date: wordDate,
        category: "Uncategorized",
        additionalCategories: [],
        speak: true,
        identify: false,
        asl: false,
        speakDate: wordDate,
        identifyDate: "",
        aslDate: "",
        languages: [],
        notes: "Added automatically from a sentence.",
        derivedFromSentenceId: sentenceId,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        syncStatus: "local",
        });
      }
      modal.close();
      alert(
        speak && missing.length
          ? `Sentence saved. ${missing.length} new individual ${missing.length === 1 ? "word was" : "words were"} added.`
          : speak ? "Sentence saved. Every word was already in the individual word list." : "ASL sentence saved.",
      );
      renderVocabulary();
    };
    if (speak && missing.length) {
      modalBody.innerHTML = `<h2>New ${missing.length === 1 ? "word" : "words"} detected</h2><div class="banner">${missing.length === 1 ? "A new word was" : "New words were"} detected in this sentence. ${missing.length === 1 ? "It will" : "They will"} be added to the word list.</div><p class="hint">Each word will use the sentence date${speakDate ? ` (${fmtDate(speakDate)})` : ""} unless you choose a different date.</p><div class="new-word-review">${missing.map((word) => `<div class="new-word-row" data-word-key="${esc(sentenceWordKey(word))}"><strong>${esc(word)}</strong><label><input class="custom-word-date-toggle" type="checkbox"> Use a different date</label><input class="custom-word-date hidden" type="date" value="${speakDate}" aria-label="Date first said for ${esc(word)}"></div>`).join("")}</div><button id="confirmSentenceWords" class="btn full" type="button">Add ${missing.length === 1 ? "word" : "words"} and save sentence</button>`;
      document.querySelectorAll(".custom-word-date-toggle").forEach((box) => box.onchange = () => box.closest(".new-word-row").querySelector(".custom-word-date").classList.toggle("hidden", !box.checked));
      $("#confirmSentenceWords").onclick = () => {
        const wordDates = {};
        for (const row of document.querySelectorAll(".new-word-row")) {
          const custom = row.querySelector(".custom-word-date-toggle").checked,
            date = row.querySelector(".custom-word-date").value;
          if (custom && !date) return alert("Choose a date for each word marked to use a different date.");
          wordDates[row.dataset.wordKey] = custom ? date : speakDate;
        }
        saveSentenceAndWords(wordDates);
      };
      return;
    }
    await saveSentenceAndWords();
  };
}

function openBulkVocabulary(profiles, existing, categories) {
  const protectedCategories = ["Sentences", "Letters", "Numbers"],
    wordCategoriesOnly = categories.filter(
      (category) => !protectedCategories.includes(category),
    ),
    categoryOptions = wordCategoriesOnly
      .map((category) => `<option>${esc(category)}</option>`)
      .join(""),
    optionalCategories = `<option value="">None</option>${categoryOptions}`;
  modalBody.innerHTML = `<h2>Bulk import speech/language</h2><div class="form-grid"><div class="field"><label>Child</label><select id="bulkProfile">${profiles.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div><div class="field"><label>Entry type</label><select id="bulkEntryType"><option value="word">Words or phrases</option><option value="letter">Letters</option><option value="number">Numbers</option><option value="sentence">Sentences</option></select><span id="bulkTypeHint" class="hint"></span></div><div class="field"><label>Primary category for this import</label><select id="bulkCategory">${categoryOptions}</select></div><div class="field"><label>Secondary category <span class="hint">(optional)</span></label><select id="bulkCategory2">${optionalCategories}</select></div><div class="field"><label>Tertiary category <span class="hint">(optional)</span></label><select id="bulkCategory3">${optionalCategories}</select></div><fieldset class="ability-field"><legend>Abilities for imported entries</legend><label><input id="bulkSpeak" type="checkbox" checked> Speak</label><label><input id="bulkIdentify" type="checkbox"> Identify</label><label><input id="bulkAsl" type="checkbox"> ASL</label></fieldset><div class="field"><label>Fallback date</label><input id="bulkFallback" type="date" value="${isoToday()}"><span class="hint">Used only for lines that do not contain a date or follow a dated heading.</span></div><div class="field"><label>Paste from Notes</label><textarea id="bulkText" class="bulk-text" placeholder="Mama — 4/12/2025&#10;Dada — 4/18/2025&#10;&#10;May 2, 2025&#10;Ball&#10;More"></textarea><span class="hint">Enter one item per line. Dates and dated headings are supported.</span></div><div class="banner">Nothing will be saved until you review the parsed list.</div><button id="previewBulk" class="btn full" type="button">Parse and review</button></div>`;
  if (!modal.open) modal.showModal();
  const syncBulkType = () => {
    const type = $("#bulkEntryType").value,
      categoryName = {
        letter: "Letters",
        number: "Numbers",
        sentence: "Sentences",
      }[type],
      wordType = type === "word";
    for (const id of ["bulkCategory", "bulkCategory2", "bulkCategory3"])
      $("#" + id).disabled = !wordType;
    $("#bulkTypeHint").textContent = wordType
      ? "Choose up to three categories for these words or phrases."
      : `These entries will be placed in the protected ${categoryName} category.`;
    if (type === "sentence") {
      $("#bulkSpeak").checked = true;
      $("#bulkIdentify").checked = false;
    }
    $("#bulkSpeak").disabled = false;
    $("#bulkAsl").disabled = false;
    $("#bulkIdentify").disabled = type === "sentence";
    $("#bulkIdentify").closest("label").classList.toggle("hidden", type === "sentence");
  };
  $("#bulkEntryType").onchange = syncBulkType;
  syncBulkType();
  $("#previewBulk").onclick = () => {
    const profileId = $("#bulkProfile").value,
      entryType = $("#bulkEntryType").value,
      category =
        entryType === "letter"
          ? "Letters"
          : entryType === "number"
            ? "Numbers"
            : entryType === "sentence"
              ? "Sentences"
              : $("#bulkCategory").value || "Uncategorized",
      additionalCategories =
        entryType === "word"
          ? [$("#bulkCategory2").value, $("#bulkCategory3").value]
              .filter((c) => c && c !== category)
              .filter((c, i, a) => a.indexOf(c) === i)
          : [],
      speak = $("#bulkSpeak").checked,
      identify = entryType !== "sentence" && $("#bulkIdentify").checked,
      asl = $("#bulkAsl").checked,
      parsed = parseBulkVocabulary(
        $("#bulkText").value,
        $("#bulkFallback").value,
      );
    if (!speak && !identify && !asl) return alert("Select at least one ability for this import.");
    const seen = new Set(
        existing
          .filter(
            (x) => x.profileId === profileId && x.entryType === entryType,
          )
          .map((x) =>
            entryType === "sentence"
              ? sentenceWordKey(x.word)
              : wordKey(x.word),
          ),
      ),
      fresh = [];
    let duplicates = 0,
      invalid = parsed.skipped.length;
    for (const entry of parsed.entries) {
      const valid =
          entryType === "letter"
            ? /^\p{L}$/u.test(entry.word)
            : entryType === "number"
              ? /^\p{N}+$/u.test(entry.word)
              : true,
        key =
          entryType === "sentence"
            ? sentenceWordKey(entry.word)
            : wordKey(entry.word);
      if (!valid) {
        invalid++;
        continue;
      }
      if (seen.has(key)) {
        duplicates++;
        continue;
      }
      seen.add(key);
      fresh.push(entry);
    }
    const bulkDetectedWords = [];
    if (entryType === "sentence" && speak) {
      const knownWords = new Set(existing.filter((x) => x.profileId === profileId && x.entryType === "word").map((x) => sentenceWordKey(x.word)));
      for (const sentence of fresh)
        for (const word of sentenceWords(sentence.word)) {
          const key = sentenceWordKey(word);
          if (!knownWords.has(key)) {
            knownWords.add(key);
            bulkDetectedWords.push({ word, key, date: sentence.date });
          }
        }
    }
    modalBody.innerHTML = `<h2>Review import</h2><p><strong>${fresh.length}</strong> ready • ${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped • ${invalid} invalid or unread line${invalid === 1 ? "" : "s"}</p><p class="hint">Entry type: ${esc(entryType[0].toUpperCase() + entryType.slice(1))} • Categories: ${[category, ...additionalCategories].map(esc).join(", ")} • ${[speak ? "Speak" : "", identify ? "Identify" : "", asl ? "ASL" : ""].filter(Boolean).join(", ") || "No abilities selected"}</p><div class="import-preview">${fresh.map((x) => `<div class="preview-row"><strong>${esc(x.word)}</strong><span>${fmtDate(x.date)}</span></div>`).join("") || "<p>No new entries were found.</p>"}</div>${bulkDetectedWords.length ? `<h3>New ${bulkDetectedWords.length === 1 ? "word" : "words"} detected</h3><div class="banner">These will be added to the individual word list using each sentence’s date unless changed below.</div><div class="new-word-review">${bulkDetectedWords.map((x) => `<div class="new-word-row" data-word-key="${esc(x.key)}"><strong>${esc(x.word)}</strong><span class="hint">Sentence date: ${fmtDate(x.date)}</span><label><input class="custom-word-date-toggle" type="checkbox"> Use a different date</label><input class="custom-word-date hidden" type="date" value="${x.date}" data-default-date="${x.date}" aria-label="Date first said for ${esc(x.word)}"></div>`).join("")}</div>` : ""}<div class="btn-row"><button id="backBulk" class="btn secondary" type="button">Go back</button>${fresh.length ? '<button id="importBulk" class="btn" type="button">Import reviewed entries</button>' : ""}</div>`;
    document.querySelectorAll(".custom-word-date-toggle").forEach((box) => box.onchange = () => box.closest(".new-word-row").querySelector(".custom-word-date").classList.toggle("hidden", !box.checked));
    $("#backBulk").onclick = () =>
      openBulkVocabulary(profiles, existing, categories);
    if (fresh.length)
      $("#importBulk").onclick = async () => {
        const bulkWordDates = {};
        for (const row of document.querySelectorAll(".new-word-row")) {
          const input = row.querySelector(".custom-word-date"), custom = row.querySelector(".custom-word-date-toggle").checked;
          if (custom && !input.value) return alert("Choose a date for each word marked to use a different date.");
          bulkWordDates[row.dataset.wordKey] = custom ? input.value : input.dataset.defaultDate;
        }
        await createSnapshot("Before speech/language bulk import");
        const knownWords = new Set(
          existing
            .filter(
              (item) =>
                item.profileId === profileId && item.entryType === "word",
            )
            .map((item) => sentenceWordKey(item.word)),
        );
        let addedSentenceWords = 0;
        for (const x of fresh) {
          const entryId = uid();
          await put("words", {
            id: entryId,
            entryType,
            profileId,
            word: x.word,
            date: x.date,
            category,
            additionalCategories,
            speak,
            identify,
            asl,
            speakDate: speak ? x.date : "",
            identifyDate: identify ? x.date : "",
            aslDate: asl ? x.date : "",
            languages: [],
            notes: "",
            createdAt: nowISO(),
            updatedAt: nowISO(),
            syncStatus: "local",
          });
          if (entryType === "sentence" && speak) {
            const missingWords = sentenceWords(x.word).filter(
              (word) => !knownWords.has(sentenceWordKey(word)),
            );
            for (const word of missingWords) {
              const wordDate = bulkWordDates[sentenceWordKey(word)] ?? x.date;
              knownWords.add(sentenceWordKey(word));
              addedSentenceWords++;
              await put("words", {
                id: uid(),
                entryType: "word",
                profileId,
                word,
                date: wordDate,
                category: "Uncategorized",
                additionalCategories: [],
                speak: true,
                identify: false,
                asl: false,
                speakDate: wordDate,
                identifyDate: "",
                aslDate: "",
                languages: [],
                notes: "Added automatically from a sentence.",
                derivedFromSentenceId: entryId,
                createdAt: nowISO(),
                updatedAt: nowISO(),
                syncStatus: "local",
              });
            }
          }
        }
        modal.close();
        alert(
          `${fresh.length} ${fresh.length === 1 ? "entry" : "entries"} imported.${addedSentenceWords ? ` ${addedSentenceWords} new individual ${addedSentenceWords === 1 ? "word was" : "words were"} added from the sentences.` : ""}`,
        );
        renderVocabulary();
      };
  };
}

function openCategoryManager(categories) {
  const draw = () => {
    modalBody.innerHTML = `<h2>Manage categories</h2><div class="category-list">${categories.map((c) => `<div class="category-row"><span>${esc(c)}</span><div>${!["Uncategorized", "Sentences", "Letters", "Numbers"].includes(c) ? `<button class="small-action rename-category" data-name="${esc(c)}" type="button">Rename</button><button class="small-action danger-link remove-category" data-name="${esc(c)}" type="button">Delete</button>` : ""}</div></div>`).join("")}</div><button id="addCategory" class="btn full" type="button" style="margin-top:14px">Add category</button>`;
    $("#addCategory").onclick = async () => {
      const name = prompt("New category name:")?.trim();
      if (!name) return;
      if (categories.some((c) => wordKey(c) === wordKey(name)))
        return alert("That category already exists.");
      categories.push(name);
      await setSetting("vocabCategories", categories);
      draw();
    };
    document.querySelectorAll(".rename-category").forEach(
      (b) =>
        (b.onclick = async () => {
          const old = b.dataset.name,
            name = prompt("Rename category:", old)?.trim();
          if (!name || name === old) return;
          if (categories.some((c) => wordKey(c) === wordKey(name)))
            return alert("That category already exists.");
          const words = await getAll("words");
          for (const item of words.filter((x) =>
            wordCategories(x).includes(old),
          )) {
            if (item.category === old) item.category = name;
            item.additionalCategories = (item.additionalCategories || [])
              .map((c) => (c === old ? name : c))
              .filter((c) => c !== item.category);
            item.updatedAt = nowISO();
            await put("words", item);
          }
          categories[categories.indexOf(old)] = name;
          await setSetting("vocabCategories", categories);
          renderVocabulary();
          draw();
        }),
    );
    document.querySelectorAll(".remove-category").forEach(
      (b) =>
        (b.onclick = async () => {
          const name = b.dataset.name;
          if (
            !confirm(
              `Delete “${name}”? It will be removed from every assigned entry.`,
            )
          )
            return;
          await createSnapshot(`Before deleting vocabulary category ${name}`);
          const words = await getAll("words");
          for (const item of words.filter((x) =>
            wordCategories(x).includes(name),
          )) {
            if (item.category === name) {
              const replacement =
                (item.additionalCategories || []).find((c) => c !== name) ||
                "Uncategorized";
              item.category = replacement;
            }
            item.additionalCategories = (
              item.additionalCategories || []
            ).filter((c) => c !== name && c !== item.category);
            item.updatedAt = nowISO();
            await put("words", item);
          }
          categories = categories.filter((c) => c !== name);
          await setSetting("vocabCategories", categories);
          renderVocabulary();
          draw();
        }),
    );
  };
  draw();
  if (!modal.open) modal.showModal();
}

const PROFILE_SYMBOLS = [
  "🌟",
  "🌱",
  "🌈",
  "🦋",
  "🌻",
  "🫧",
  "🤖",
  "🎈",
  "⚽",
  "🏀",
  "🏈",
  "⚾",
  "🥎",
  "🎾",
  "🏐",
  "🏉",
  "🎱",
  "🏓",
  "🏸",
  "🥏",
  "🚗",
  "🏎️",
  "🚙",
  "🚕",
  "🚌",
  "🚜",
  "🚂",
  "🚀",
  "✈️",
  "🚁",
  "⛵",
  "🐶",
  "🐱",
  "🐻",
  "🦊",
  "🦁",
  "🐯",
  "🐸",
  "🐧",
  "🦖",
  "🐠",
  "🐳",
  "🦄",
  "🍎",
  "🍓",
  "🍕",
  "🧩",
  "🎨",
  "🎵",
  "📚",
  "💛",
  "💙",
  "💜",
];
function profileBirthDate(profile) {
  if (!profile.birthDate) return null;
  return new Date(`${profile.birthDate}T${profile.birthTime || "00:00:00"}`);
}
const hasExactBirthTime = (profile) =>
  Boolean(
    profile.birthDate && /^\d{2}:\d{2}:\d{2}$/.test(profile.birthTime || ""),
  );
function addMonthsClamped(date, months) {
  const d = new Date(date),
    day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  d.setDa…88844 tokens truncated…k directly whether there is a pool, pond, hot tub, creek, or open gate.</li><li>Use a properly fitted, U.S. Coast Guard-approved life jacket for boating and when the setting, child’s ability, or conditions call for it. Inflatable arm bands and pool toys are not safety devices.</li><li>Teach skills in small steps: wait for permission, enter safely, turn back to the wall, float, tread water, reach an exit, and climb out. Practice with different instructors and settings when possible because a skill learned in one pool may not automatically transfer elsewhere.</li><li>Choose an instructor who accepts AAC, gestures, breaks, sensory supports, repetition, and one-to-one lessons if a group is overwhelming. Consider practicing an unexpected fall into water while wearing ordinary clothes and shoes under qualified supervision.</li><li>Learn CPR, keep a phone nearby, know the exact location or address, and call 911 immediately for a water emergency.</li></ul>

      <h3>If you own a pool or hot tub</h3>
      <ul><li>Install a non-climbable, <strong>four-sided isolation fence</strong> that separates the pool from the house and yard, with a self-closing, self-latching gate. Follow state and local height, gate, and barrier codes.</li><li>Keep patio furniture, toys, and other climbable objects away from the fence. Never prop the gate open.</li><li>Add door, window, gate, and pool alarms as backup layers. Test them routinely, replace batteries, and make sure every caregiver can hear or receive the alert.</li><li>Use approved drain covers and keep rescue equipment available. Secure pool chemicals and remove toys from the water so they do not invite an unsupervised return.</li><li>Empty small pools immediately after use. Cover and lock hot tubs; remember that covers and alarms do not replace fencing or supervision.</li><li>Create a rule for who confirms the pool area is clear and secured after every use, gathering, or caregiver handoff.</li></ul>

      <h3>If you live near water</h3>
      <ul><li>Walk the neighborhood and map every pool, pond, creek, river, drainage ditch, retention basin, fountain, well, and other water source the child could reach.</li><li>Put those locations—in search priority order—into the wandering plan and give the list to regular caregivers. If the child goes missing, <strong>call 911 immediately and direct searchers to nearby water first</strong>.</li><li>Use layered home exit protection suited to the child: door and window alarms, chimes, gates, and safely placed locks that still allow emergency escape.</li><li>Tell trusted neighbors, school staff, and local first responders that the child may be drawn to water, may not respond to their name, and may communicate differently.</li><li>Use identification and, when appropriate, a charged location device as added layers—not replacements for barriers, supervision, or the emergency plan.</li></ul>

      <p><strong>Swimming ability does not make a child drown-proof.</strong> Lessons, life jackets, barriers, alarms, identification, location devices, and supervision each cover a different gap.</p>
      <div class="education-links">${safetyLink("https://www.cdc.gov/drowning/risk-factors/index.html", "Drowning risk factors", "Current autism risk information and general drowning-risk guidance.", "Centers for Disease Control and Prevention")}${safetyLink("https://publications.aap.org/pediatrics/article/doi/10.1542/peds.2026-077410/207630/Prevention-of-Drowning-Policy-Statement", "AAP drowning-prevention guidance", "Current pediatric evidence and layered prevention recommendations.", "American Academy of Pediatrics")}${safetyLink("https://www.redcross.org/take-a-class/swimming/swim-lessons", "Find swim lessons", "Search for Learn-to-Swim providers for children and adults.", "American Red Cross")}${safetyLink("https://www.redcross.org/get-help/how-to-prepare-for-emergencies/types-of-emergencies/water-safety/swim-safety.html", "Water-safety guidance", "Supervision, water competency, life jackets, and safer swimming.", "American Red Cross")}</div>
    </div></details>

    <details class="education-card"><summary>🏠 Home, fire, medication, and household safety</summary><div class="education-body">
      <ul><li>Anchor furniture and televisions; secure medications, cleaners, sharp objects, firearms, lighters, and button batteries.</li><li>Use appropriate window guards without blocking emergency escape.</li><li>Check smoke and carbon-monoxide alarms and consider visual, vibrating, or voice options when sound alone may not work.</li><li>Practice a short fire-escape routine. Tell firefighters if the child may hide, resist touch, run, or not respond to spoken directions.</li><li>Use visual labels or locks for high-risk spaces while keeping safe spaces easy to reach.</li><li>Prepare for power loss if AAC, medication refrigeration, feeding, monitoring, or sensory-regulation equipment needs electricity.</li></ul>
    </div></details>

    <details class="education-card"><summary>🏫 School, outings, internet, and growing independence</summary><div class="education-body">
      <ul><li>Put wandering, transportation, communication, toileting, feeding, allergy, seizure, and emergency needs into the school safety plan, IEP, 504 plan, or healthcare plan when appropriate.</li><li>At outings, take a current photo on arrival, identify exits and water, assign one supervising adult, and establish a meeting point.</li><li>Teach personal information, safe adults, street and parking-lot safety, consent, private body parts, and how to ask for help at the child’s level.</li><li>Use device parental controls, limit public location sharing, and teach that online friends are strangers until a trusted adult verifies otherwise.</li><li>As independence grows, practice short routes, transportation, money, phone use, emergency contacts, and what to do when plans change.</li></ul>
      <p>Safety teaching should build skill without punishing communication, stimming, or the need to escape overwhelming situations. If a child runs from noise, pain, demands, or sensory overload, reducing that trigger belongs in the prevention plan too.</p>
    </div></details>

    <details class="education-card"><summary>📋 One-page emergency profile checklist</summary><div class="education-body">
      <p>Keep a current copy on each caregiver’s phone and give it to regular supervisors. Review it after a move, medication change, growth spurt, new school, or major communication change.</p>
      <div class="safety-profile-list"><strong>Include:</strong><span>Current face and full-body photos</span><span>Legal name, nickname, age, height, and weight</span><span>Caregiver names and two phone numbers</span><span>Communication method and response to name</span><span>Likely destinations, water attraction, and wandering triggers</span><span>How to approach, comfort, and avoid escalating distress</span><span>Medical needs, allergies, seizure plan, and essential medication</span><span>Tracker details, if used, and who can access it</span></div>
      <p><strong>Keep private details secure.</strong> Share the full profile with trusted caregivers and responders; put only the minimum necessary information on publicly visible identification.</p>
    </div></details>
  </div>
  <div class="banner safety-disclaimer"><strong>Important:</strong> This is general U.S. safety education. It cannot replace individualized advice from the child’s clinician, therapist, certified child-passenger-safety technician, swim professional, school team, product manufacturer, or local responders. In an immediate emergency or when a vulnerable child is missing, call 911.</div>`;
}

function renderTherapyInformation() {
  const therapyLink = (url, title, description, tag = "") =>
    `<a class="education-link" href="${url}" target="_blank" rel="noopener noreferrer"><strong>${esc(title)} ↗</strong><span>${esc(description)}</span>${tag ? `<small>${esc(tag)}</small>` : ""}</a>`;
  view.innerHTML = `<section class="hero"><h1>🧩 Therapy & Support</h1><p>What different therapies do, what sessions may look like, and how to decide whether the fit is right.</p></section>
  <div class="banner therapy-note"><strong>Therapy should support a life—not take it over.</strong> Autism is not something a child must be trained out of. Useful support should build communication, safety, comfort, participation, independence, and access while respecting the child’s personality, body, sensory needs, and ways of communicating.</div>
  <div class="banner therapy-warning"><strong>There is no universal therapy plan.</strong> A therapy can be helpful, unhelpful, or harmful depending on the goals, provider, methods, intensity, child, and family. A familiar label such as “ABA,” “speech,” or “OT” does not tell you everything happening in the room.</div>

  <div class="therapy-compare"><div><strong>Speech-language therapy</strong><span>Communication, language, speech, AAC, social connection, and sometimes feeding or swallowing.</span></div><div><strong>Occupational therapy</strong><span>Daily activities, sensory access, regulation, motor skills, play, self-care, school, and participation.</span></div><div><strong>ABA</strong><span>Uses learning and behavior principles to teach skills and change measurable behavior; methods and intensity vary greatly.</span></div></div>

  <h2 class="section-title">The main therapies</h2>
  <div class="education-sections therapy-sections">
    <details class="education-card" open><summary>💬 Speech-language therapy</summary><div class="education-body">
      <p>A speech-language pathologist, or <strong>SLP</strong>, supports more than pronunciation. An SLP may work on understanding language, expressing ideas, speech sounds, motor planning, fluency, voice, conversation, play, social communication, literacy, and reliable access to AAC.</p>
      <h3>What to expect</h3><ul><li>An evaluation may include caregiver interview, hearing history or referral, observation during play and routines, standardized testing when appropriate, and samples of every way the child communicates.</li><li>Sessions may look like play, books, movement, conversation, games, picture symbols, signs, or practice with a speech-generating device—not simply repeating words at a table.</li><li>Good goals may include requesting, refusing, commenting, asking for help, sharing interests, repairing misunderstandings, understanding directions, and communicating pain or emotions.</li><li>The SLP should explain how caregivers, teachers, and other communication partners can respond naturally during everyday routines.</li></ul>
      <div class="therapy-balance"><div><h3>Possible benefits</h3><ul><li>More reliable communication and less frustration.</li><li>Support for speech, language comprehension, social connection, and self-advocacy.</li><li>AAC can give a child a voice now and does not prevent speech development.</li><li>Strategies can carry into meals, play, school, and family life.</li></ul></div><div><h3>Limits and concerns</h3><ul><li>Progress may be uneven and may not look like standardized-test gains.</li><li>A poor fit may overfocus on “normal-looking” eye contact, scripted social behavior, or perfect speech rather than meaningful communication.</li><li>Clinic performance may not transfer unless other people learn how to support the skill.</li><li>Not every SLP has strong autism, AAC, gestalt-language, apraxia, or feeding expertise.</li></ul></div></div>
      <h3>Questions to ask</h3><ul><li>Will you support gestures, signs, pictures, scripting, and AAC alongside speech?</li><li>How will the child communicate “no,” “stop,” “break,” pain, and emotions?</li><li>How are goals connected to real life rather than making the child appear less autistic?</li><li>How will you coach the family without turning home into a therapy clinic?</li></ul>
      <div class="education-links">${therapyLink("https://www.nichd.nih.gov/health/topics/factsheets/autism", "Speech-language therapy for autism", "A family overview of spoken and nonspeaking communication support.", "National Institute of Child Health and Human Development")}${therapyLink("https://www.asha.org/practice-portal/clinical-topics/autism/", "ASHA autism practice guidance", "Detailed professional guidance on evaluation and intervention.", "American Speech-Language-Hearing Association")}${therapyLink("https://www.asha.org/practice/early-intervention-provider-support/augmentative-and-alternative-communication-in-early-intervention/", "AAC in early intervention", "Why AAC can begin early and does not stop speech development.", "American Speech-Language-Hearing Association")}</div>
    </div></details>

    <details class="education-card"><summary>👐 Occupational therapy</summary><div class="education-body">
      <p>In pediatric <strong>occupational therapy, or OT</strong>, “occupation” means the activities that fill a child’s day: playing, dressing, eating, toileting, sleeping, learning, moving through the community, and joining family routines. OT should help the child participate—not simply make their body look calmer.</p>
      <h3>What to expect</h3><ul><li>The evaluation usually reviews daily routines, strengths, sensory patterns, motor and visual-motor skills, self-care, play, safety, school tasks, sleep, feeding, and what matters to the family.</li><li>Sessions may use swings, climbing, obstacle courses, crafts, dressing practice, utensils, handwriting, visual schedules, environmental changes, or direct practice of a meaningful routine.</li><li>Support may change the environment—lighting, noise, seating, clothing, tools, timing, or task demands—instead of asking the child to tolerate unnecessary distress.</li><li>The OT may build a practical regulation plan with movement, quiet space, deep pressure, predictable transitions, and access to safe stimming.</li></ul>
      <div class="therapy-balance"><div><h3>Possible benefits</h3><ul><li>Greater access to play, school, sleep, dressing, toileting, feeding, and community life.</li><li>Improved fine-motor, visual-motor, body-awareness, coordination, and self-care skills.</li><li>Better understanding of sensory needs and useful accommodations.</li><li>Safer equipment and environmental recommendations.</li></ul></div><div><h3>Limits and concerns</h3><ul><li>“Sensory” is a broad label; ask what specific problem and outcome are being addressed.</li><li>Some sensory interventions have stronger evidence than others, and benefits should be measured in daily participation.</li><li>A child may perform a task in the clinic but still need support elsewhere.</li><li>Goals that demand still hands, eliminate harmless stimming, or force tolerance without purpose can increase distress.</li></ul></div></div>
      <h3>Questions to ask</h3><ul><li>What daily activity will improve if this goal works?</li><li>Can we accommodate this sensory need rather than repeatedly expose the child to distress?</li><li>How will you recognize overload, pain, refusal, and assent?</li><li>What can school or home change before asking the child to change?</li></ul>
      <div class="education-links">${therapyLink("https://www.cdc.gov/autism/treatment/index.html", "Autism treatment approaches", "Overview of occupational, speech-language, behavioral, developmental, and other supports.", "Centers for Disease Control and Prevention")}${therapyLink("https://www.aota.org/about/what-is-ot", "What occupational therapy does", "How OT supports participation in meaningful daily activities.", "American Occupational Therapy Association")}</div>
    </div></details>

    <details class="education-card"><summary>📊 Applied behavior analysis (ABA): what it is</summary><div class="education-body">
      <p><strong>Applied behavior analysis</strong> uses principles of learning to understand what happens before and after a behavior, teach skills in smaller steps, change the environment, and measure progress. ABA is an umbrella term. A highly structured discrete-trial program can feel very different from naturalistic, play-based teaching or caregiver coaching, even when both are called ABA.</p>
      <p>Common models include discrete trial training, natural-environment teaching, pivotal response treatment, functional communication training, positive behavior support, and early intensive behavioral intervention. A BCBA typically assesses and designs the plan; an RBT or another technician may deliver much of the direct service under supervision.</p>
      <h3>What an assessment and session may include</h3><ul><li>Caregiver interview, observation, skill assessment, review of safety and daily functioning, and identification of measurable goals.</li><li>A functional behavior assessment when behavior is dangerous or significantly limits life. The team looks for what the behavior communicates or accomplishes—escape, access, attention, pain relief, sensory regulation, or something else.</li><li>Practice with communication, safety, play, transitions, toileting, self-care, learning, or other individualized skills.</li><li>Prompts, modeling, reinforcement, data collection, and gradual reduction of help as the child learns.</li><li>Regular review of whether the skill appears outside therapy and actually improves the child’s life.</li></ul>
      <div class="therapy-term"><strong>The words matter:</strong> <em>Positive reinforcement</em> adds something valued after a skill. <em>Negative reinforcement</em> removes something unpleasant after a response, increasing that response. Taking away a preferred toy after behavior is not negative reinforcement; it is closer to <em>negative punishment</em>. Withholding a toy until a requested response occurs may be described as controlling access to reinforcement. Whatever label is used, caregivers deserve to know exactly what is withheld, why, for how long, and how the child can refuse or take a break.</div>
    </div></details>

    <details class="education-card"><summary>⚖️ ABA: possible benefits, limitations, and controversy</summary><div class="education-body">
      <div class="therapy-balance"><div><h3>Why some families choose it</h3><ul><li>It can teach communication, safety, self-care, play, learning, and daily-living skills in explicit steps.</li><li>Functional assessment may identify why dangerous behavior happens and replace it with safer communication or environmental support.</li><li>Goals and progress are measured, which can help the team adjust methods.</li><li>Some children and families report meaningful gains in independence and participation.</li><li>It is widely available relative to some other autism services and is often covered by insurance.</li></ul></div><div><h3>Concerns and limitations</h3><ul><li>Quality, philosophy, supervision, and day-to-day practice vary enormously across providers.</li><li>Some programs prioritize compliance, eye contact, “quiet hands,” indistinguishable behavior, or suppression of harmless stimming rather than autonomy and quality of life.</li><li>Prompting and rewards can become coercive when the child cannot freely refuse, take a break, or access basic needs and communication.</li><li>High hours can crowd out sleep, school, free play, family life, friendships, speech or OT, and the ordinary experience of being a child.</li><li>Research shows average benefits in some areas, but individual response varies, study quality has limitations, and more hours do not automatically mean better outcomes.</li></ul></div></div>
      <h3>The adult autistic perspective belongs in the decision</h3><p>Many autistic adults and self-advocates describe childhood ABA as abusive or traumatic, particularly when it involved punishment, forced compliance, ignoring distress, withholding communication or comfort, suppressing harmless autistic traits, or training the child to mask. A small qualitative study of seven autistic adults reported remembered trauma and long-term harms as well as some benefits. More recent mixed-method research found varied experiences: autistic adults were less satisfied than caregivers and professionals, while participants also reported positive outcomes such as communication and independence. These reports cannot tell us how every modern program affects every child, but they are important safety evidence—not something to dismiss.</p>
      <p>Supporters point to ABA’s evidence base, its ability to individualize and measure teaching, and movement within the field toward positive, naturalistic, assent-aware, trauma-informed care. Critics respond that a new label or friendlier room does not make goals ethical if the purpose remains compliance, masking, or making harmless autism less visible.</p>
      <h3>How many hours?</h3><p>Early intensive behavioral intervention has historically been delivered for <strong>20 to 40 hours per week</strong>, sometimes for years. Other ABA plans may be only a few hours weekly or caregiver consultation. Forty hours is not a universal requirement. A 2024 meta-analysis of 144 studies did not find that greater intervention amount reliably produced greater benefit within an intervention type. Ask the clinician to justify every recommended hour from this child’s needs, tolerance, goals, other services, sleep, school, play, and family life—not from a standard package.</p>
      <h3>Can the caregiver observe?</h3><p>There is no universal ABA rule that caregivers cannot be in the room. Some clinics limit observation during certain assessments or sessions because a child behaves differently with a caregiver present, other clients need privacy, or the team is building independence. Other programs provide in-home sessions, observation windows, recordings with consent, frequent caregiver participation, or direct coaching.</p><p>A provider should be able to explain the policy, show the written plan and data, demonstrate methods, discuss what happens when the child refuses, and offer meaningful caregiver training. A blanket refusal to ever let a caregiver observe or understand treatment—without a clear, child-specific or privacy reason—is worth questioning.</p>
      <div class="education-links">${therapyLink("https://www.cdc.gov/autism/treatment/index.html", "CDC overview of ABA and other approaches", "Basic descriptions of behavioral, developmental, educational, and other interventions.", "Centers for Disease Control and Prevention")}${therapyLink("https://www.cochrane.org/evidence/CD009260_early-intensive-behavioral-intervention-eibi-increasing-functional-behaviors-and-skills-young", "Early intensive behavioral intervention review", "Benefits, 20–40 hour intensity, evidence quality, and uncertainty.", "Cochrane")}${therapyLink("https://jamanetwork.com/journals/jamapediatrics/fullarticle/2819784", "Intervention amount and outcomes", "2024 meta-analysis examining whether more therapy hours predict larger gains.", "JAMA Pediatrics")}${therapyLink("https://journals.sagepub.com/doi/10.1177/13623613221118216", "Autistic adults describe childhood ABA", "A small qualitative study of perceived benefits, trauma, and long-term consequences.", "Autism journal")}${therapyLink("https://www.bacb.com/ethics-information/ethics-codes/", "Behavior analyst ethics requirements", "Current professional ethics and consumer-protection resources.", "Behavior Analyst Certification Board")}</div>
    </div></details>

    <details class="education-card"><summary>🛡️ Choosing a respectful provider</summary><div class="education-body">
      <h3>Green flags</h3><ul><li>Goals begin with the child’s safety, communication, comfort, access, independence, and family priorities.</li><li>The provider treats AAC, gestures, scripts, signs, behavior, and speech as communication.</li><li>Harmless stimming, movement, gaze differences, and autistic play are accepted.</li><li>The child can say no, request a break, and withdraw assent; distress changes the plan rather than being treated as automatic noncompliance.</li><li>Caregivers receive written goals, understandable data, progress reviews, observation or demonstration, and coaching.</li><li>The team screens for pain, sleep, seizures, constipation, hearing, anxiety, trauma, sensory overload, and communication barriers before calling behavior “attention seeking.”</li><li>The plan explains how prompts will fade and how skills will work with different people and settings.</li></ul>
      <div class="banner therapy-redflags"><strong>Pause and ask more questions if:</strong> basic food, water, toileting, comfort, movement, communication, or access to AAC is used as leverage; a child is forced to make eye contact or stop harmless stimming; restraint, seclusion, escape blocking, planned ignoring, punishment, or physical prompting is used without transparent safeguards; goals focus on appearing nonautistic; the child shows persistent fear, shutdown, sleep change, regression, or distress; staff turnover is high; or the provider will not explain methods, data, credentials, supervision, complaints, and discharge rights.</div>
      <h3>Questions for any therapy</h3><ul><li>What exact change are we hoping for, and how will it improve the child’s life?</li><li>How were the child’s preferences and communication included?</li><li>What happens when the child says no, moves away, cries, freezes, or asks for a break?</li><li>May I observe? If not today, how will I see and understand the methods?</li><li>Who delivers the session, who supervises, and how often are they physically present?</li><li>What are the risks, alternatives, expected timeline, and signs the plan is not working?</li><li>How often can we reduce hours, change goals, pause, or stop?</li></ul>
    </div></details>

    <details class="education-card"><summary>🗣️ AAC, feeding, physical therapy, play, and mental health</summary><div class="education-body">
      <ul><li><strong>AAC:</strong> gestures, signs, picture boards, switches, typing, and speech-generating devices. AAC can support spoken language and should remain available at all times—not earned through compliance.</li><li><strong>Feeding support:</strong> may involve an SLP, OT, dietitian, gastroenterologist, dentist, psychologist, or specialized team. Medical, swallowing, oral-motor, sensory, nutritional, and learned factors should be separated. Force, hunger, or removing all safe foods can cause harm.</li><li><strong>Physical therapy:</strong> supports strength, balance, coordination, mobility, endurance, positioning, stairs, running, playground access, and equipment when motor differences affect daily life.</li><li><strong>Developmental or play-based approaches:</strong> follow the child’s interests and relationships to build shared engagement, communication, flexibility, and learning in natural routines. Examples include developmental coaching and naturalistic developmental behavioral interventions.</li><li><strong>Mental-health therapy:</strong> can support anxiety, trauma, depression, emotional awareness, coping, and family stress. The therapist should understand autism, adapt communication, and avoid treating every concern as autism.</li><li><strong>Peer or social support:</strong> should build authentic connection, consent, self-advocacy, and shared interests—not rehearse a single “correct” personality.</li></ul>
    </div></details>

    <details class="education-card"><summary>⏳ Wait lists and what to do while waiting</summary><div class="education-body">
      <p>Long waits for ABA, speech, OT, feeding, developmental specialists, and mental-health care are common. There is no honest nationwide wait-time number: a family may wait weeks, many months, a year, or longer depending on location, specialty, age, insurance, schedule, language, and whether services are home-, clinic-, school-, or telehealth-based.</p>
      <ul><li>Join more than one appropriate wait list and ask about cancellations, reassessment dates, age cutoffs, and whether the list automatically expires.</li><li>Call insurance about in-network availability, prior authorization, out-of-network or network-gap exceptions, and written appeal rights.</li><li>Contact Early Intervention before age 3 and the public school system at age 3 or older; a medical diagnosis is not always required to request an educational evaluation.</li><li>Ask whether caregiver coaching, a short consultation, group service, telehealth, or an AAC evaluation can begin sooner.</li><li>Request the evaluation report and home suggestions even if ongoing sessions are unavailable.</li><li>Address urgent hearing, swallowing, nutrition, pain, seizure, sleep, regression, self-injury, or safety concerns with the appropriate clinician rather than waiting for a general autism therapy opening.</li></ul>
      <p>A wait list is a system problem, not a caregiver failure. Families do not need to turn every waking hour into treatment while they wait.</p>
    </div></details>

    <details class="education-card"><summary>💛 The caregiver is the child’s constant—not a replacement therapist</summary><div class="education-body">
      <p>Providers may see a child for one or several hours. The caregiver knows how the child sleeps, plays, communicates, recovers, connects, and handles ordinary life. That makes the caregiver the leading support structure and essential decision-making partner.</p>
      <p>The most useful caregiver role is not running drills all day. It is noticing what helps, protecting communication and trust, offering real choices, creating chances to practice meaningful skills, sharing observations with the team, and deciding whether therapy is improving family life.</p>
      <ul><li>Ask each provider for one or two realistic strategies that fit routines already happening.</li><li>Share what the therapist cannot see: after-session exhaustion, shutdowns, new confidence, sleep changes, spontaneous communication, or skills that do not transfer home.</li><li>Coordinate goals so multiple therapies do not duplicate work or overwhelm the child.</li><li>Protect free play, rest, family connection, interests, friendships, and time with no demand to perform.</li><li>Trust a sustained change in the child’s well-being enough to ask questions, change course, seek another opinion, or stop a poor fit.</li></ul>
      <p>Caregivers deserve support too. A plan that only works by exhausting the child or the family is not truly functioning in real life.</p>
    </div></details>
  </div>
  <div class="banner therapy-disclaimer"><strong>Important:</strong> This section provides general education, not an individualized therapy recommendation. Evidence and professional practice continue to change. Discuss goals, benefits, risks, alternatives, intensity, credentials, consent, and progress with qualified providers who have evaluated the child.</div>`;
}

async function openEmergencyContacts() {
  const profiles = await getAll("profiles");
  if (!profiles.length) return alert("Create a child profile first.");
  let profileId = profiles[0].id, contacts = [];
  const key = () => `emergencyContacts:${profileId}`;
  const draw = async () => {
    contacts = await getSetting(key(), []);
    modalBody.innerHTML = `<h2>☎️ Emergency contacts</h2><p class="hint">Save more than one trusted contact for redundancy. Contacts are included in backups and can be added to the babysitter care sheet.</p><div class="field"><label>Child</label><select id="contactProfile">${profiles.map((p) => `<option value="${p.id}" ${p.id === profileId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div><div class="form-grid two-col"><div class="field"><label>Name</label><input id="contactName" autocomplete="name"></div><div class="field"><label>Relationship</label><input id="contactRelationship" placeholder="Parent, grandparent, neighbor…"></div><div class="field"><label>Primary phone</label><input id="contactPhone" type="tel" autocomplete="tel"></div><div class="field"><label>Alternate phone <span class="hint">(optional)</span></label><input id="contactAlternate" type="tel"></div></div><div class="field"><label>Notes <span class="hint">(optional)</span></label><input id="contactNotes" placeholder="Call first, lives nearby, authorized pickup…"></div><button id="addEmergencyContact" class="btn full" type="button">Add contact</button><h3>Saved contacts (${contacts.length})</h3><div class="list">${contacts.length ? contacts.map((x, i) => `<div class="list-item"><div><strong>${esc(x.name)}</strong><div class="hint">${esc(x.relationship || "Relationship not entered")} • ${esc(x.phone)}</div>${x.alternatePhone ? `<div class="hint">Alternate: ${esc(x.alternatePhone)}</div>` : ""}${x.notes ? `<p>${esc(x.notes)}</p>` : ""}</div><button class="small-action danger-link delete-emergency-contact" data-index="${i}" type="button">Delete</button></div>`).join("") : `<div class="empty"><p>No emergency contacts saved yet. Two or more are recommended.</p></div>`}</div>`;
    $("#contactProfile").onchange = async (e) => { profileId = e.target.value; await draw(); };
    $("#addEmergencyContact").onclick = async () => { const name = $("#contactName").value.trim(), phone = $("#contactPhone").value.trim(); if (!name || !phone) return alert("Enter the contact’s name and primary phone number."); contacts.push({ id: uid(), name, relationship: $("#contactRelationship").value.trim(), phone, alternatePhone: $("#contactAlternate").value.trim(), notes: $("#contactNotes").value.trim() }); await setSetting(key(), contacts); await draw(); };
    document.querySelectorAll(".delete-emergency-contact").forEach((button) => button.onclick = async () => { const i = Number(button.dataset.index), contact = contacts[i]; if (!confirm(`Delete ${contact.name} from emergency contacts?`)) return; contacts.splice(i, 1); await setSetting(key(), contacts); await draw(); });
  };
  await draw(); modal.showModal();
}

function careSheetLine(label, value) { return value ? `${label}: ${value}` : ""; }

async function buildBabysitterCareSheet(profile) {
  const id = profile.id;
  const [contacts, notes, food, routine, sleep, materials, learning, words] = await Promise.all([getSetting(`emergencyContacts:${id}`, []), getDailyCare(id), getSetting(`foodDiary:${id}`, []), getSetting(`sleep:routine:${id}`, []), getSetting(`sleep:preferences:${id}`, {}), getSetting(`materialPreferences:${id}`, {}), getSetting(`learningSnapshot:${id}`, {}), getAll("words")]);
  const list = (items) => items.filter(Boolean).join(", ") || "None entered";
  const foodNames = (category) => list(food.filter((x) => x.category === category).map((x) => x.name));
  const reactions = food.filter((x) => x.response && x.response !== "none").map((x) => `${x.name} — ${x.response === "allergy" ? "KNOWN ALLERGY" : x.response === "reaction" ? "possible reaction" : "sensitivity/intolerance"}${x.reactionDetails ? `: ${x.reactionDetails}` : ""}`);
  const aslWords = words.filter((x) => x.profileId === id && (x.entryType || "word") === "word" && x.asl).map((x) => x.word || x.text || x.title).filter(Boolean);
  const contactText = contacts.length ? contacts.map((x, i) => `${i + 1}. ${x.name}${x.relationship ? ` (${x.relationship})` : ""}: ${x.phone}${x.alternatePhone ? `; alternate ${x.alternatePhone}` : ""}${x.notes ? ` — ${x.notes}` : ""}`).join("\n") : "No emergency contacts entered.";
  const routineText = routine.length ? routine.map((x, i) => `${i + 1}. ${x.time ? `${x.time} — ` : ""}${x.text}`).join("\n") : "No bedtime routine entered.";
  return [
    `BABYSITTER CARE SHEET — ${String(profile.name || "CHILD").toUpperCase()}`,
    `Prepared ${new Date().toLocaleString()}\nPlease review this sheet with the caregiver before they leave. In an immediate emergency, call 911 or the appropriate local emergency number first.`,
    `EMERGENCY CONTACTS\n${contactText}${notes.homeAddress ? `\nChild/home address: ${notes.homeAddress}` : ""}${notes.preferredHospital ? `\nPreferred hospital: ${notes.preferredHospital}` : ""}${notes.pediatrician ? `\nPediatrician: ${notes.pediatrician}${notes.pediatricianPhone ? ` — ${notes.pediatricianPhone}` : ""}` : ""}`,
    `MEDICAL & EMERGENCY\n${[careSheetLine("Medications and timing", notes.medications), careSheetLine("Medical/allergy notes", notes.medicalNotes), careSheetLine("Emergency plan", notes.emergencyPlan)].filter(Boolean).join("\n") || "No caregiver instructions entered. Confirm allergies, medicines, and emergency plans directly with the caregiver."}`,
    `COMMUNICATION\n${[careSheetLine("How to communicate", notes.communication), aslWords.length ? `Saved ASL words: ${list(aslWords)}` : "", careSheetLine("What helps learning/understanding", learning.helps)].filter(Boolean).join("\n") || "No communication instructions entered."}`,
    `FOOD & DRINK\nSafe: ${foodNames("safe")}\nOccasionally eats: ${foodNames("sometimes")}\nDo not offer / not accepted: ${foodNames("not")}\nAllergies, reactions, sensitivities: ${reactions.length ? reactions.join("; ") : "None entered"}${notes.foodInstructions ? `\nServing and meal instructions: ${notes.foodInstructions}` : ""}`,
    `SLEEP\n${routineText}\n${[careSheetLine("Temperature", sleep.temperature), careSheetLine("Pressure/compression", sleep.pressure), careSheetLine("Texture", sleep.texture), careSheetLine("Light", sleep.light), careSheetLine("Sound", sleep.sound), careSheetLine("Movement", sleep.movement), careSheetLine("What we noticed", sleep.notes), careSheetLine("Extra sleep instructions", notes.sleepInstructions)].filter(Boolean).join("\n") || "No additional sleep preferences entered."}`,
    `SENSORY, COMFORT & CLOTHING\n${[careSheetLine("Calming and comfort", notes.calming), careSheetLine("Sensory triggers/supports", notes.sensory), careSheetLine("Comfortable clothing", materials.comfortableClothing), careSheetLine("Avoid clothing", materials.difficultClothing), careSheetLine("Fit, seams, tags, fasteners", materials.clothingDetails), careSheetLine("Preferred bedding", materials.preferredBedding), careSheetLine("Avoid bedding", materials.avoidBedding), careSheetLine("Other material notes", materials.notes)].filter(Boolean).join("\n") || "No sensory or material preferences entered."}`,
    `SAFETY & TOILETING\n${[careSheetLine("Safety, wandering, or supervision", notes.safety), careSheetLine("Toileting", notes.toileting)].filter(Boolean).join("\n") || "No safety or toileting instructions entered."}`,
    `ABOUT ${String(profile.name || "THE CHILD").toUpperCase()}\n${[careSheetLine("Special interests", profile.specialInterest), careSheetLine("Currently working on", profile.currentFocus), careSheetLine("Strengths", learning.strengths), careSheetLine("Challenges to plan for", learning.struggles), careSheetLine("Schedule and other instructions", notes.other)].filter(Boolean).join("\n") || "No additional information entered."}`,
    "Caregiver reminder: Review this message before sharing. Update it whenever contacts, allergies, medicines, routines, or safety needs change.",
  ].join("\n\n");
}

async function openBabysitterCareSheet() {
  const profiles = await getAll("profiles");
  if (!profiles.length) return alert("Create a child profile first.");
  let profileId = profiles[0].id;
  const fields = DAILY_CARE_FIELDS;
  const draw = async () => {
    const profile = profiles.find((p) => p.id === profileId), notes = await getDailyCare(profileId), contacts = await getSetting(`emergencyContacts:${profileId}`, []);
    modalBody.innerHTML = `<h2>🧑‍🍼 Babysitter care sheet</h2><p class="hint">Build plain text that can be shared through Messages, Messenger, email, or copy and paste. The recipient needs no app or account.</p><div class="field"><label>Child</label><select id="babysitterProfile">${profiles.map((p) => `<option value="${p.id}" ${p.id === profileId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div><div class="banner"><strong>${contacts.length} emergency ${contacts.length === 1 ? "contact" : "contacts"} saved.</strong> ${contacts.length < 2 ? "Add at least two when possible so the babysitter has a backup." : "Redundant contacts are ready."}<br><button id="manageContactsFromSheet" class="small-action" type="button">Manage emergency contacts</button></div><details class="education-card"><summary>✏️ Care instructions to include</summary><div class="education-body"><p>Saved food, sleep, sensory, profile, and communication information is pulled in automatically. Use these fields for instructions a tracker cannot safely infer.</p><div class="form-grid">${fields.map(([key, label, placeholder]) => `<div class="field"><label>${label}</label><textarea id="babysitter-${key}" placeholder="${esc(placeholder)}">${esc(notes[key] || "")}</textarea></div>`).join("")}<button id="saveBabysitterNotes" class="btn full" type="button">Save care instructions</button></div></div></details><button id="generateBabysitterSheet" class="btn full" type="button">Generate or refresh care sheet</button><div class="field"><label>Review and edit before sharing</label><textarea id="babysitterSheetText" class="template-letter" placeholder="Generate the care sheet, then make any one-time edits here."></textarea></div><div class="btn-row"><button id="shareBabysitterSheet" class="btn" type="button">Share</button><button id="copyBabysitterSheet" class="btn secondary" type="button">Copy</button><button id="downloadBabysitterSheet" class="btn secondary" type="button">Download .txt</button></div><p class="hint">This sheet can contain sensitive health and contact information. Share it only with someone you trust.</p>`;
    $("#babysitterProfile").onchange = async (e) => { profileId = e.target.value; await draw(); };
    $("#manageContactsFromSheet").onclick = () => { modal.close(); openEmergencyContacts(); };
    const saveNotes = async () => { const value = Object.fromEntries(fields.map(([key]) => [key, $(`#babysitter-${key}`).value.trim()])); value.updatedAt = nowISO(); await setSetting(`dailyCare:${profileId}`, value); };
    $("#saveBabysitterNotes").onclick = async () => { await saveNotes(); alert("Care instructions saved."); };
    $("#generateBabysitterSheet").onclick = async () => { await saveNotes(); $("#babysitterSheetText").value = await buildBabysitterCareSheet(profile); };
    $("#copyBabysitterSheet").onclick = async () => { const text = $("#babysitterSheetText").value.trim(); if (!text) return alert("Generate the care sheet first."); await navigator.clipboard.writeText(text); alert("Care sheet copied."); };
    $("#shareBabysitterSheet").onclick = async () => { const text = $("#babysitterSheetText").value.trim(); if (!text) return alert("Generate the care sheet first."); if (navigator.share) { try { await navigator.share({ title: `${profile.name} — Babysitter Care Sheet`, text }); } catch (error) { if (error.name !== "AbortError") alert("Sharing was not available. Use Copy instead."); } } else { await navigator.clipboard.writeText(text); alert("Sharing is not available here, so the care sheet was copied."); } };
    $("#downloadBabysitterSheet").onclick = () => { const text = $("#babysitterSheetText").value.trim(); if (!text) return alert("Generate the care sheet first."); downloadBlob(new Blob([text], { type: "text/plain" }), `${profile.name.replace(/[^a-z0-9]+/gi, "-")}-Babysitter-Care-Sheet.txt`); };
    $("#babysitterSheetText").value = await buildBabysitterCareSheet(profile);
  };
  await draw(); modal.showModal();
}

const SUPPORT_MESSAGING_PLAN = {
  status: "planned",
  topics: [
    ["app-help", "App help", "Using features, backups, account access, subscriptions, or reporting a problem."],
    ["resource-navigation", "Resource navigation", "Finding the right section, official agency, school resource, benefit program, or next question to ask."],
    ["caregiver-support", "Caregiver support", "A listening ear, practical organization, and help finding non-emergency support options."],
    ["education-planning", "Education planning", "Understanding app resources related to assessments, IEPs, 504 plans, homeschooling, and school preparation."],
    ["feedback", "Ideas and feedback", "Suggestions, corrections, accessibility concerns, and requests for future More than Measured features."]
  ],
  boundaries: [
    "Not emergency, crisis, medical, legal, diagnostic, or therapy services",
    "No guaranteed immediate reply; posted service hours and expected response times will appear before sending",
    "Caregivers will choose what to share and will be reminded not to send information the support team does not need",
    "Messages will go only to authorized support staff under documented privacy, retention, and escalation rules"
  ]
};

async function renderCaregiver() {
  const appointments = await getAll("appointments"),
    todos = await getAll("todos"),
    notes = await getAll("notes"),
    activeTodos = todos.filter((item) => !item.completed).length,
    upcoming = appointments.filter((item) => item.date >= isoToday()).length,
    reflectionCount = notes.filter((item) => item.kind === "caregiverReflection").length;
  view.innerHTML = `<section class="hero"><h1>💛 Caregiver Corner</h1><p>Support, organization, and clear information for the caregiver.</p></section>
  <h2 class="section-title">Caregiver support</h2>
  <div class="grid">
    <button id="caregiverMeetups" class="card-button"><strong>🤝 Social Meetups</strong><small>Find or create inclusive playdates, family gatherings, parent meetups, and sensory-friendly outings.</small></button>
    <button id="caregiverToys" class="card-button"><strong>🧸 Free Toy Exchange</strong><small>Offer toys your family no longer needs or find free toys offered by parents nearby.</small></button>
    <button id="caregiverRecommended" class="card-button"><strong>⭐ Recommended</strong><small>Find parent-recommended doctors, dentists, therapists, restaurants, schools, activities, and other local places.</small></button>
    <button id="caregiverRecommendedBabysitters" class="card-button"><strong>🧑‍🍼 Find a babysitter</strong><small>Find profiles created by babysitters, view approved parent nominations, or recommend a babysitter you trust.</small></button>
    <button id="caregiverBabysitter" class="card-button"><strong>🧑‍🍼 Babysitter care sheet</strong><small>Pull saved care details into editable text that can be shared without an app.</small></button>
    <button id="caregiverEmergencyContacts" class="card-button"><strong>☎️ Emergency contacts</strong><small>Save multiple contacts per child for redundancy and care-sheet sharing.</small></button>
    <button id="caregiverEncouragement" class="card-button"><strong>💬 Encouragement</strong><small>Weekly messages and strength-focused reminders.</small></button>
    <button id="caregiverTerms" class="card-button"><strong>📖 Common terms</strong><small>Plain-language explanations of autism and sensory terminology.</small></button>
    <button id="caregiverSigns" class="card-button"><strong>🧭 Signs of autism</strong><small>Social communication, repetition, routines, sensory differences, and when to ask for an evaluation.</small></button>
    <button id="caregiverMyths" class="card-button"><strong>🧠 ASD myths and misconceptions</strong><small>Clear explanations of common assumptions about autism, communication, empathy, stimming, and support.</small></button>
    <button id="caregiverAggression" class="card-button"><strong>🫶 Aggressive behaviors</strong><small>Why they may happen, what they can look like, safer responses, and what to avoid.</small></button>
    <button id="caregiverRegulationGuides" class="card-button"><strong>🌱 Regulation & confidence</strong><small>Visual guides for connection, emotional regulation, confidence, and supportive caregiving.</small></button>
    <button id="caregiverEducation" class="card-button"><strong>🎓 Educational options</strong><small>Homeschooling, school choices, IEPs, 504 plans, resources, and letter templates.</small></button>
    <button id="caregiverAssessment" class="card-button"><strong>🧭 Autism assessment information</strong><small>When assessment can begin, how it works, what to bring, and what to expect.</small></button>
    <button id="caregiverBenefits" class="card-button"><strong>🤲 Benefits & financial support</strong><small>Paid caregiving, SSI and SSDI, Medicaid, tax help, respite, and overlooked resources.</small></button>
    <button id="caregiverSafety" class="card-button"><strong>🛟 ASD safety</strong><small>Wandering, trackers, identification, car seats, water, home, school, and emergency planning.</small></button>
    <button id="caregiverTherapy" class="card-button"><strong>🧩 Therapy & support</strong><small>ABA, speech, OT, AAC, other therapies, wait lists, benefits, concerns, and what to expect.</small></button>
    <button id="caregiverCalendar" class="card-button"><strong>📅 Calendar</strong><small>${upcoming} upcoming ${upcoming === 1 ? "appointment" : "appointments"}.</small></button>
    <button id="caregiverTodos" class="card-button"><strong>✅ To-do list</strong><small>${activeTodos} active ${activeTodos === 1 ? "task" : "tasks"}.</small></button>
    <button id="caregiverReflections" class="card-button"><strong>📝 Caregiver Reflections</strong><small>${reflectionCount} saved ${reflectionCount === 1 ? "entry" : "entries"} • searchable personal journal.</small></button>
  </div>`;
  $("#caregiverBabysitter").onclick = openBabysitterCareSheet;
  $("#caregiverMeetups").onclick = () => navigate("community");
  $("#caregiverToys").onclick = () => navigate("toys");
  $("#caregiverRecommended").onclick = () => navigate("recommendations");
  $("#caregiverRecommendedBabysitters").onclick = () => navigate("babysitters");
  $("#caregiverEmergencyContacts").onclick = openEmergencyContacts;
  $("#caregiverEncouragement").onclick = openWeeklyEncouragement;
  $("#caregiverTerms").onclick = openTermsGuide;
  $("#caregiverSigns").onclick = openAutismSignsGuide;
  $("#caregiverMyths").onclick = () => navigate("myths");
  $("#caregiverAggression").onclick = openAggressionGuide;
  $("#caregiverRegulationGuides").onclick = openCaregiverRegulationGuides;
  $("#caregiverEducation").onclick = () => navigate("education");
  $("#caregiverAssessment").onclick = () => navigate("assessment");
  $("#caregiverBenefits").onclick = () => navigate("benefits");
  $("#caregiverSafety").onclick = () => navigate("safety");
  $("#caregiverTherapy").onclick = () => navigate("therapy");
  $("#caregiverCalendar").onclick = openCaregiverCalendar;
  $("#caregiverTodos").onclick = () => openTodoList("active");
  $("#caregiverReflections").onclick = openCaregiverReflections;
  document
    .querySelectorAll(".future-feature")
    .forEach((b) => (b.onclick = () => underConstruction(b.dataset.feature)));
}

function openCaregiverRegulationGuides() {
  openInfoGuide("🌱 Regulation & confidence", `${visualGuideFigure("supporting-autistic-children.webp","12 ways to better support autistic children")}${visualGuideFigure("supporting-emotional-regulation.webp","Supporting emotional regulation")}${visualGuideFigure("nurture-confidence.webp","12 ways to nurture confidence")}`);
}

function openSupportMessagingInfo() {
  modalBody.innerHTML = `<h2>🤝 Support messaging</h2><div class="banner"><strong>Planning preview — messaging is not connected yet.</strong><br>No employee is monitoring this page, and nothing entered elsewhere in the app is sent to a support team.</div><p>The future service is intended to give caregivers a clear place to ask non-urgent questions, get help navigating More than Measured resources, and share feedback with an authorized support person.</p><h3>Planned support topics</h3><div class="list">${SUPPORT_MESSAGING_PLAN.topics.map(([,label,description])=>`<div class="list-item"><div><strong>${esc(label)}</strong><p>${esc(description)}</p></div></div>`).join("")}</div><h3>How a future conversation should work</h3><ol><li>Sign in through a verified caregiver account and choose a support topic.</li><li>See service hours, the expected response window, privacy notice, and emergency limits <strong>before</strong> sending.</li><li>Create a request that receives a timestamp, status, and conversation number.</li><li>An authorized responder accepts the request, replies, and can provide links or escalate it to the correct support role.</li><li>The caregiver can return to the conversation, receive notifications, download or delete eligible data, and see when the request is closed.</li></ol><h3>Boundaries being built in now</h3><ul>${SUPPORT_MESSAGING_PLAN.boundaries.map((item)=>`<li>${esc(item)}</li>`).join("")}</ul><h3>What still has to exist before launch</h3><ul><li>Secure accounts, identity and household permissions, and server-side message storage.</li><li>An employee dashboard with assignment, unread, waiting, closed, and escalation states.</li><li>Encryption in transit and at rest, access logging, staff permissions, retention limits, deletion tools, backups, and breach procedures.</li><li>Notification controls that do not expose sensitive message text on a lock screen.</li><li>Written response standards, staff training, supervision, service hours, coverage, and a plan for messages received when the service is closed.</li><li>Terms, consent, privacy disclosures, subscription rules if applicable, and legal review before real caregiver information is collected.</li></ul><div class="banner"><strong>Need help now?</strong><br>If someone is in immediate danger or has a medical emergency, call 911 or go to the nearest emergency room. In the United States, call or text <strong>988</strong> or use <a href="https://988lifeline.org/" target="_blank" rel="noopener">988Lifeline.org</a> for suicide, mental-health, or substance-use crisis support. This future MtM service will not replace emergency or crisis care.</div><p class="hint">The topic IDs, status language, boundaries, and planned workflow on this page are structured so they can be reused when the account and server phase begins, without presenting a fake message box today.</p>`;
  modal.showModal();
}

async function openCaregiverReflections() {
  let entries = (await getAll("notes")).filter((item) => item.kind === "caregiverReflection"),
    editingId = null,
    search = "";
  const formatReflectionTime = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Date unavailable";
  modalBody.innerHTML = `<h2>📝 Caregiver Reflections</h2><p class="hint">A place to write down thoughts, hard moments, questions, patterns, gratitude, and memories you may want to find later.</p><div class="banner"><strong>Privacy reminder:</strong> Entries stay in this browser's local app data and are included in complete backups. They are not encrypted with a separate journal password. Anyone with access to this device or an exported backup may be able to read them.</div><div class="card tool-form"><div class="field"><label>Title <span class="hint">(optional)</span></label><input id="reflectionTitle" maxlength="120" placeholder="A moment, question, pattern, or memory"></div><div class="field"><label>Reflection</label><textarea id="reflectionBody" placeholder="Write whatever you want to remember…"></textarea></div><p class="hint">The original date and time are added automatically when the entry is saved.</p><div class="btn-row"><button id="saveReflection" class="btn" type="button">Save reflection</button><button id="cancelReflectionEdit" class="btn secondary hidden" type="button">Cancel edit</button></div></div><div class="field"><label>Search saved reflections</label><input id="reflectionSearch" type="search" placeholder="Search titles or anything you wrote"></div><div id="reflectionResultsSummary" class="hint" aria-live="polite"></div><div id="reflectionList" class="list"></div>`;
  const resetForm = () => { editingId = null; $("#reflectionTitle").value = ""; $("#reflectionBody").value = ""; $("#saveReflection").textContent = "Save reflection"; $("#cancelReflectionEdit").classList.add("hidden"); };
  const draw = () => {
    const term = search.trim().toLocaleLowerCase(), shown = [...entries].filter((item) => !term || `${item.title || ""}\n${item.body || ""}`.toLocaleLowerCase().includes(term)).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    $("#reflectionResultsSummary").textContent = term ? `${shown.length} of ${entries.length} reflections match “${search.trim()}”.` : `${entries.length} saved ${entries.length === 1 ? "reflection" : "reflections"}.`;
    $("#reflectionList").innerHTML = shown.length ? shown.map((item) => `<details class="term-card"><summary><span>${esc(item.title || "Untitled reflection")}</span><span class="category-chip">${esc(formatReflectionTime(item.createdAt))}</span></summary><div class="education-body"><p style="white-space:pre-wrap">${esc(item.body)}</p><div class="hint">Written ${esc(formatReflectionTime(item.createdAt))}${item.updatedAt && item.updatedAt !== item.createdAt ? ` • Edited ${esc(formatReflectionTime(item.updatedAt))}` : ""}</div><div class="btn-row"><button class="small-action edit-reflection" data-id="${item.id}" type="button">Edit</button><button class="small-action danger-link delete-reflection" data-id="${item.id}" type="button">Delete</button></div></div></details>`).join("") : `<div class="empty card"><div class="big">📝</div><p>${term ? "No reflections match that search." : "No reflections saved yet."}</p></div>`;
    document.querySelectorAll(".edit-reflection").forEach((button) => button.onclick = () => { const item = entries.find((entry) => entry.id === button.dataset.id); if (!item) return; editingId = item.id; $("#reflectionTitle").value = item.title || ""; $("#reflectionBody").value = item.body || ""; $("#saveReflection").textContent = "Update reflection"; $("#cancelReflectionEdit").classList.remove("hidden"); $("#reflectionTitle").focus(); });
    document.querySelectorAll(".delete-reflection").forEach((button) => button.onclick = async () => { const item = entries.find((entry) => entry.id === button.dataset.id); if (!item || !confirm(`Delete “${item.title || "Untitled reflection"}”?`)) return; await createSnapshot(`Before deleting caregiver reflection ${item.title || item.id}`); await deleteItem("notes", item.id); entries = entries.filter((entry) => entry.id !== item.id); if (editingId === item.id) resetForm(); draw(); });
  };
  $("#reflectionSearch").oninput = (event) => { search = event.target.value; draw(); };
  $("#cancelReflectionEdit").onclick = resetForm;
  $("#saveReflection").onclick = async () => {
    const title = $("#reflectionTitle").value.trim(), body = $("#reflectionBody").value.trim();
    if (!body) return alert("Write a reflection before saving.");
    const timestamp = nowISO();
    if (editingId) {
      const item = entries.find((entry) => entry.id === editingId);
      if (!item) return;
      item.title = title;
      item.body = body;
      item.updatedAt = timestamp;
      await put("notes", item);
    } else {
      const item = { id: uid(), kind: "caregiverReflection", title, body, createdAt: timestamp, updatedAt: timestamp };
      entries.push(item);
      await put("notes", item);
    }
    resetForm();
    draw();
  };
  draw();
  modal.showModal();
}

function openAutismSignsGuide(){openInfoGuide("🧭 Signs of autism",`<p>Autism can look very different from one child to another. A checklist cannot diagnose a child, and one trait by itself does not mean autism. What matters is the overall developmental pattern, how early it began, and how it affects daily life.</p><h3>Social communication and connection</h3><ul><li>Responds to their name inconsistently or less than expected.</li><li>Uses fewer gestures, such as showing, waving, reaching, or pointing to share interest.</li><li>Shares enjoyment or attention in a different way; eye contact is only one possible signal and should not be forced.</li><li>Has delayed speech, loses previously used communication, repeats language, uses memorized scripts, or communicates mainly through movement, behavior, signs, pictures, or AAC.</li><li>Finds back-and-forth play, conversation, pretend play, or joining peers difficult or different.</li></ul><h3>Repetition, routines, interests, and sensory patterns</h3><ul><li>Repeats movements, sounds, phrases, play patterns, or ways of arranging objects.</li><li>Has strong focused interests or notices details other people miss.</li><li>Needs predictability or becomes very distressed by changes and transitions.</li><li>Seeks or avoids sounds, light, touch, movement, tastes, smells, pain, or temperature.</li><li>Has unusual eating, sleep, movement, attention, fear, or emotional-regulation patterns.</li></ul><h3>What to do when you are concerned</h3><p>Write down specific examples and when they started. Bring them to the child’s pediatrician and ask for developmental screening and, when appropriate, an autism evaluation. In the United States, families can also contact early intervention before age 3 or the local public-school system at age 3 and older. Support for communication, feeding, sleep, movement, or hearing does not have to wait for a final autism diagnosis.</p><div class="banner"><strong>Prompt medical attention:</strong> A new or continuing loss of words, movement, awareness, play, toileting, or other established skills should be discussed promptly with the child’s healthcare professional.</div><div class="education-links"><a class="education-link" href="https://www.cdc.gov/autism/signs-symptoms/index.html" target="_blank" rel="noopener"><strong>CDC signs and symptoms</strong><span>Examples across social communication, repetition, routines, sensory reactions, and development.</span><small>Official source ↗</small></a><a class="education-link" href="https://www.cdc.gov/autism/diagnosis/index.html" target="_blank" rel="noopener"><strong>CDC screening information</strong><span>How developmental monitoring, screening, and diagnostic evaluation differ.</span><small>Official source ↗</small></a></div>`);}

function openAggressionGuide(){openInfoGuide("🫶 Understanding aggressive behaviors",`<p>Hitting, kicking, biting, scratching, pushing, throwing, or damaging objects can be frightening and unsafe. The behavior needs a safety response, but it is also information: something is wrong, unavailable, overwhelming, painful, or not yet communicateable. Autism itself does not make a child violent, and the child is not “bad.”</p><h3>Why it may happen</h3><ul><li><strong>Communication:</strong> trying to say stop, no, help, break, pain, finished, or give it back.</li><li><strong>Sensory overload or dysregulation:</strong> noise, crowds, touch, heat, transitions, accumulated demands, or loss of control.</li><li><strong>Pain or illness:</strong> constipation, reflux, dental or ear pain, headache, injury, infection, hunger, thirst, or poor sleep.</li><li><strong>Fear, anxiety, frustration, or trauma:</strong> especially when the child cannot explain what happened.</li><li><strong>Access or escape:</strong> reaching a wanted item/activity or getting away from a demand or setting. This describes the function; it does not mean the distress is fake.</li><li><strong>Skill mismatch:</strong> the task, wait, language, impulse control, or emotional demand exceeds what the child can manage in that moment.</li></ul><h3>What it can look like</h3><p>Aggression may be sudden or build through pacing, louder sounds, rigid posture, running, grabbing, pushing materials away, crying, or repeated language. It can be directed toward caregivers, siblings, peers, providers, pets, or property. Self-injury is different but may occur during the same overwhelmed state and also needs assessment.</p><h3>What to do in the moment</h3><ul><li>Stay as calm as possible and use few, concrete words: “I won’t let you hit. You’re safe. Break.”</li><li>Create distance, move other children and pets, and quietly remove hard, sharp, breakable, or throwable objects.</li><li>Reduce noise, light, talking, eye-contact demands, and extra people. Keep an exit route for everyone.</li><li>Offer an accessible way to communicate <em>stop, break, help, pain, yes/no</em>—speech, sign, picture, or AAC.</li><li>Block immediate harm only as safely and briefly as necessary. Avoid restraint unless trained, legally authorized, and needed for an immediate danger; restraint can injure or traumatize.</li><li>Afterward, allow recovery before teaching or discussing. Check for injuries and document what happened before, during, and after.</li></ul><h3>What helps between episodes</h3><ul><li>Ask the pediatrician about new, severe, or escalating aggression and screen for pain, sleep, GI, dental, neurologic, medication, hearing, and mental-health contributors.</li><li>Track patterns: time, setting, people, demands, sensory conditions, sleep, food, illness, communication attempts, duration, and what helped.</li><li>Teach replacement communication during calm moments and honor it whenever safely possible.</li><li>Use predictable routines, visual warnings, real choices, manageable steps, movement or sensory supports, and scheduled breaks.</li><li>Seek a qualified, individualized functional assessment when behavior is frequent or dangerous. Goals should improve safety and communication—not punish harmless autistic traits.</li></ul><h3>What not to do</h3><ul><li>Do not shame, yell, threaten, lecture during overload, crowd the child, demand eye contact, or force an apology before regulation returns.</li><li>Do not assume every episode is “attention seeking” or deliberately manipulative.</li><li>Do not remove the child’s AAC or other communication method as punishment.</li><li>Do not ignore sudden behavior change; pain and illness can be expressed through behavior.</li><li>Do not use seclusion, pain, food deprivation, humiliating consequences, or untrained holds.</li></ul><div class="banner"><strong>Emergency:</strong> If someone is in immediate danger, an injury needs urgent care, a weapon is involved, or the caregiver cannot maintain safety, call emergency services. Tell responders the child is autistic, how they communicate, what escalates them, and what helps. Ask for crisis responders trained in developmental disability when available.</div><div class="education-links"><a class="education-link" href="https://www.healthychildren.org/English/health-issues/conditions/Autism/Pages/autism-spectrum-disorder.aspx" target="_blank" rel="noopener"><strong>American Academy of Pediatrics autism overview</strong><span>Co-occurring pain, sleep, GI, anxiety, irritability, and aggression concerns.</span><small>Clinical family guidance ↗</small></a></div>`);}

const CAREGIVER_TERM_ICONS = {
  "AAC":"💬","ASD Level 1":"1️⃣","ASD Level 2":"2️⃣","ASD Level 3":"3️⃣",
  "Autistic burnout":"🔋","Dysregulation":"🌊","Echolalia":"🗣️","Elopement":"🚪",
  "Executive functioning":"🧠","Gestalt language processing":"🧩","Interoception":"🫀",
  "Joint attention":"👀","Leading / hand leading":"🤝","Masking":"🎭","Meltdown":"⛈️",
  "Neurodiversity":"🌈","Proprioception":"💪","Regression":"↩️","Scripting":"🎬",
  "Sensory avoider":"🎧","Sensory overload":"⚡","Sensory seeker":"🎢","Shutdown":"🐚",
  "Special interest":"⭐","Stimming":"〰️","Tantrum":"💢","Vestibular sense":"🎠"
};
const caregiverTermIcon = (term) => CAREGIVER_TERM_ICONS[term] || "💜";

function openTermsGuide() {
  const renderTermMedia = ({ term, media }) => {
    if (!media.image && !media.clip) return "";
    const image = media.image
      ? `<button class="image-viewer-trigger" type="button" data-visual-guide-src="${esc(media.image)}" data-visual-guide-alt="${esc(media.alt || `${term} example`)}" aria-label="Enlarge ${esc(media.alt || `${term} example`)}"><img class="term-media-image" src="${esc(media.image)}" alt="${esc(media.alt || `${term} example`)}" loading="lazy" decoding="async"></button>`
      : "";
    const clip = media.clip
      ? `<video class="term-media-clip" controls preload="none" playsinline aria-label="${esc(media.alt || `${term} example clip`)}"><source src="${esc(media.clip)}"></video>`
      : "";
    const caption = media.caption
      ? `<small class="term-media-caption">${esc(media.caption)}</small>`
      : "";
    return `<div class="term-media">${image}${clip}${caption}</div>`;
  };
  const draw = (query = "") => {
    const q = wordKey(query),
      shown = CAREGIVER_TERMS.filter(({ term, explanation }) =>
        wordKey(`${term} ${explanation}`).includes(q),
      );
    modalBody.innerHTML = `<h2>📖 Common terms</h2><p class="hint">Friendly, plain-language explanations to help you make sense of words you may hear. They are not a diagnosis or a replacement for guidance from someone who knows your child.</p><div class="field"><label>Search terms</label><input id="termSearch" type="search" value="${esc(query)}" placeholder="Try stimming, sensory, or echolalia"></div><div class="terms-list">${shown.map((item) => `<details class="term-card common-term-card"><summary><span class="term-icon" aria-hidden="true">${caregiverTermIcon(item.term)}</span><span>${esc(item.term)}</span></summary><p>${esc(item.explanation)}</p>${renderTermMedia(item)}</details>`).join("") || '<div class="empty"><p>No terms match that search.</p></div>'}</div>`;
    $("#termSearch").oninput = (event) => draw(event.target.value);
    requestAnimationFrame(() => {
      const input = $("#termSearch");
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  };
  draw();
  if (!modal.open) modal.showModal();
}

let caregiverCalendarCursor = new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  1,
);
async function openCaregiverCalendar() {
  const appointments = await getAll("appointments"),
    profiles = await getAll("profiles"),
    names = Object.fromEntries(profiles.map((p) => [p.id, p.name])),
    year = caregiverCalendarCursor.getFullYear(),
    month = caregiverCalendarCursor.getMonth(),
    firstDay = new Date(year, month, 1).getDay(),
    days = new Date(year, month + 1, 0).getDate(),
    monthName = new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    }).format(caregiverCalendarCursor),
    dateKey = (day) =>
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    cells = [
      ...Array.from(
        { length: firstDay },
        () => '<div class="calendar-blank"></div>',
      ),
      ...Array.from({ length: days }, (_, index) => {
        const day = index + 1,
          date = dateKey(day),
          count = appointments.filter((item) => item.date === date).length;
        return `<button class="calendar-day ${date === isoToday() ? "today" : ""}" data-date="${date}" type="button"><span>${day}</span>${count ? `<small>${count}</small>` : ""}</button>`;
      }),
    ].join(""),
    monthAppointments = appointments
      .filter((item) =>
        String(item.date || "").startsWith(
          `${year}-${String(month + 1).padStart(2, "0")}`,
        ),
      )
      .sort((a, b) =>
        `${a.date}T${a.time || "23:59"}`.localeCompare(
          `${b.date}T${b.time || "23:59"}`,
        ),
      );
  modalBody.innerHTML = `<h2>📅 Caregiver calendar</h2><div class="calendar-toolbar"><button id="previousMonth" class="small-action" type="button" aria-label="Previous month">‹</button><strong>${esc(monthName)}</strong><button id="nextMonth" class="small-action" type="button" aria-label="Next month">›</button></div><div class="calendar-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div class="calendar-grid">${cells}</div><button id="addAppointment" class="btn full" type="button" style="margin-top:12px">Add appointment</button><h3>This month</h3><div class="appointment-list">${monthAppointments.map((item) => `<div class="appointment-item"><div><strong>${esc(item.title)}</strong><span>${fmtDate(item.date)}${item.time ? ` • ${esc(formatClockTime(item.time))}` : ""}${item.profileId ? ` • ${esc(names[item.profileId] || "Child")}` : ""}</span>${item.type ? `<small>${esc(item.type)}</small>` : ""}</div><div><button class="small-action edit-appointment" data-id="${item.id}" type="button">Edit</button><button class="small-action danger-link delete-appointment" data-id="${item.id}" type="button">Delete</button></div></div>`).join("") || '<p class="hint">No appointments this month.</p>'}</div>`;
  if (!modal.open) modal.showModal();
  $("#previousMonth").onclick = () => {
    caregiverCalendarCursor = new Date(year, month - 1, 1);
    openCaregiverCalendar();
  };
  $("#nextMonth").onclick = () => {
    caregiverCalendarCursor = new Date(year, month + 1, 1);
    openCaregiverCalendar();
  };
  $("#addAppointment").onclick = () => openAppointmentForm(profiles);
  document
    .querySelectorAll(".calendar-day")
    .forEach(
      (button) =>
        (button.onclick = () =>
          openAppointmentForm(profiles, null, button.dataset.date)),
    );
  document.querySelectorAll(".edit-appointment").forEach(
    (button) =>
      (button.onclick = () =>
        openAppointmentForm(
          profiles,
          appointments.find((item) => item.id === button.dataset.id),
        )),
  );
  document.querySelectorAll(".delete-appointment").forEach(
    (button) =>
      (button.onclick = async () => {
        const item = appointments.find(
          (entry) => entry.id === button.dataset.id,
        );
        if (!item || !confirm(`Delete “${item.title}”?`)) return;
        await createSnapshot(`Before deleting appointment ${item.title}`);
        await deleteItem("appointments", item.id);
        openCaregiverCalendar();
      }),
  );
}

function formatClockTime(value) {
  if (!value) return "";
  const [hour, minute] = value.split(":").map(Number),
    date = new Date(2000, 0, 1, hour, minute);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function openAppointmentForm(profiles, item = null, selectedDate = "") {
  const types = [
    "Doctor",
    "Therapy",
    "Play date",
    "School",
    "Evaluation",
    "Family",
    "Other",
  ];
  modalBody.innerHTML = `<h2>${item ? "Edit" : "Add"} appointment</h2><div class="form-grid"><div class="field"><label>Title</label><input id="appointmentTitle" value="${esc(item?.title || "")}" placeholder="Speech therapy"></div><div class="field"><label>Type</label><select id="appointmentType">${types.map((type) => `<option ${item?.type === type ? "selected" : ""}>${esc(type)}</option>`).join("")}</select></div><div class="field"><label>Child <span class="hint">(optional)</span></label><select id="appointmentProfile"><option value="">Family/general</option>${profiles.map((profile) => `<option value="${profile.id}" ${item?.profileId === profile.id ? "selected" : ""}>${esc(profile.name)}</option>`).join("")}</select></div><div class="field"><label>Date</label><input id="appointmentDate" type="date" value="${item?.date || selectedDate || isoToday()}"></div><div class="field"><label>Time <span class="hint">(optional)</span></label><input id="appointmentTime" type="time" value="${item?.time || ""}"></div><div class="field"><label>Location <span class="hint">(optional)</span></label><input id="appointmentLocation" value="${esc(item?.location || "")}"></div><div class="field"><label>Notes <span class="hint">(optional)</span></label><textarea id="appointmentNotes">${esc(item?.notes || "")}</textarea></div><div class="btn-row"><button id="cancelAppointment" class="btn secondary" type="button">Back to calendar</button><button id="saveAppointment" class="btn" type="button">Save appointment</button></div></div>`;
  if (!modal.open) modal.showModal();
  $("#cancelAppointment").onclick = openCaregiverCalendar;
  $("#saveAppointment").onclick = async () => {
    const title = $("#appointmentTitle").value.trim(),
      date = $("#appointmentDate").value;
    if (!title || !date)
      return alert("Please enter an appointment title and date.");
    await put("appointments", {
      id: item?.id || uid(),
      title,
      type: $("#appointmentType").value,
      profileId: $("#appointmentProfile").value || null,
      date,
      time: $("#appointmentTime").value || null,
      location: $("#appointmentLocation").value.trim(),
      notes: $("#appointmentNotes").value.trim(),
      createdAt: item?.createdAt || nowISO(),
      updatedAt: nowISO(),
      syncStatus: "local",
    });
    caregiverCalendarCursor = new Date(`${date}T12:00:00`);
    caregiverCalendarCursor.setDate(1);
    openCaregiverCalendar();
  };
}

async function openTodoList(filter = "active") {
  const todos = await getAll("todos"),
    profiles = await getAll("profiles"),
    names = Object.fromEntries(
      profiles.map((profile) => [profile.id, profile.name]),
    ),
    shown = todos
      .filter(
        (item) =>
          filter === "all" ||
          (filter === "completed" ? item.completed : !item.completed),
      )
      .sort(
        (a, b) =>
          Number(a.completed) - Number(b.completed) ||
          String(a.dueDate || "9999").localeCompare(
            String(b.dueDate || "9999"),
          ) ||
          a.title.localeCompare(b.title),
      );
  modalBody.innerHTML = `<h2>✅ Caregiver to-do list</h2><div class="todo-add"><input id="newTodoTitle" placeholder="Add a task"><input id="newTodoDue" type="date" aria-label="Optional due date"><select id="newTodoProfile" aria-label="Optional child"><option value="">General</option>${profiles.map((profile) => `<option value="${profile.id}">${esc(profile.name)}</option>`).join("")}</select><button id="addTodo" class="btn" type="button">Add</button></div><div class="todo-filters"><button class="small-action todo-filter ${filter === "active" ? "selected" : ""}" data-filter="active" type="button">Active</button><button class="small-action todo-filter ${filter === "all" ? "selected" : ""}" data-filter="all" type="button">All</button><button class="small-action todo-filter ${filter === "completed" ? "selected" : ""}" data-filter="completed" type="button">Completed</button></div><div class="todo-list">${shown.map((item) => `<div class="todo-item ${item.completed ? "completed" : ""}"><label><input class="todo-toggle" data-id="${item.id}" type="checkbox" ${item.completed ? "checked" : ""}><span><strong>${esc(item.title)}</strong>${item.dueDate ? `<small>Due ${fmtDate(item.dueDate)}</small>` : ""}${item.profileId ? `<small>${esc(names[item.profileId] || "Child")}</small>` : ""}</span></label><div><button class="small-action edit-todo" data-id="${item.id}" type="button">Edit</button><button class="small-action danger-link delete-todo" data-id="${item.id}" type="button">Delete</button></div></div>`).join("") || '<div class="empty"><p>No tasks in this view.</p></div>'}</div>`;
  if (!modal.open) modal.showModal();
  $("#addTodo").onclick = async () => {
    const title = $("#newTodoTitle").value.trim();
    if (!title) return alert("Please enter a task.");
    await put("todos", {
      id: uid(),
      title,
      dueDate: $("#newTodoDue").value || null,
      profileId: $("#newTodoProfile").value || null,
      completed: false,
      completedAt: null,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      syncStatus: "local",
    });
    openTodoList(filter);
  };
  document
    .querySelectorAll(".todo-filter")
    .forEach(
      (button) => (button.onclick = () => openTodoList(button.dataset.filter)),
    );
  document.querySelectorAll(".todo-toggle").forEach(
    (box) =>
      (box.onchange = async () => {
        const item = todos.find((entry) => entry.id === box.dataset.id);
        item.completed = box.checked;
        item.completedAt = box.checked ? nowISO() : null;
        item.updatedAt = nowISO();
        await put("todos", item);
        openTodoList(filter);
      }),
  );
  document.querySelectorAll(".edit-todo").forEach(
    (button) =>
      (button.onclick = () =>
        openTodoForm(
          profiles,
          todos.find((item) => item.id === button.dataset.id),
          filter,
        )),
  );
  document.querySelectorAll(".delete-todo").forEach(
    (button) =>
      (button.onclick = async () => {
        const item = todos.find((entry) => entry.id === button.dataset.id);
        if (!item || !confirm(`Delete “${item.title}”?`)) return;
        await createSnapshot(`Before deleting to-do item ${item.title}`);
        await deleteItem("todos", item.id);
        openTodoList(filter);
      }),
  );
}

function openTodoForm(profiles, item, filter) {
  modalBody.innerHTML = `<h2>Edit task</h2><div class="form-grid"><div class="field"><label>Task</label><input id="editTodoTitle" value="${esc(item.title)}"></div><div class="field"><label>Due date <span class="hint">(optional)</span></label><input id="editTodoDue" type="date" value="${item.dueDate || ""}"></div><div class="field"><label>Child <span class="hint">(optional)</span></label><select id="editTodoProfile"><option value="">General</option>${profiles.map((profile) => `<option value="${profile.id}" ${item.profileId === profile.id ? "selected" : ""}>${esc(profile.name)}</option>`).join("")}</select></div><div class="btn-row"><button id="cancelTodoEdit" class="btn secondary" type="button">Back</button><button id="saveTodoEdit" class="btn" type="button">Save task</button></div></div>`;
  $("#cancelTodoEdit").onclick = () => openTodoList(filter);
  $("#saveTodoEdit").onclick = async () => {
    const title = $("#editTodoTitle").value.trim();
    if (!title) return alert("Please enter a task.");
    item.title = title;
    item.dueDate = $("#editTodoDue").value || null;
    item.profileId = $("#editTodoProfile").value || null;
    item.updatedAt = nowISO();
    await put("todos", item);
    openTodoList(filter);
  };
}

async function collectBackup() {
  const data = {};
  for (const s of STORE_NAMES.filter((x) => x !== "snapshots"))
    data[s] = await getAll(s);
  return {
    format: "ftbm-backup",
    app: APP.name,
    appVersion: APP.version,
    schemaVersion: APP.schemaVersion,
    exportedAt: nowISO(),
    counts: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v.length]),
    ),
    data,
  };
}
function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function exportBackup() {
  const b = await collectBackup(),
    stamp = new Date().toISOString().replace(/[:.]/g, "-");
  downloadBlob(
    new Blob([JSON.stringify(b, null, 2)], { type: "application/json" }),
    `MoreThanMeasured-Backup-${stamp}.ftbmbackup`,
  );
  await setSetting("lastBackupAt", b.exportedAt);
  renderBackup();
}
async function createSnapshot(reason) {
  const b = await collectBackup(),
    s = { id: uid(), reason, createdAt: nowISO(), backup: b };
  await put("snapshots", s);
  const all = (await getAll("snapshots")).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );
  for (const old of all.slice(5)) await deleteItem("snapshots", old.id);
}
function validateBackup(b) {
  if (
    !b ||
    b.format !== "ftbm-backup" ||
    !b.data ||
    typeof b.schemaVersion !== "number"
  )
    throw new Error("This is not a valid More than Measured backup.");
  if (b.schemaVersion > APP.schemaVersion)
    throw new Error("This backup was created by a newer version of the app.");
  for (const s of STORE_NAMES.filter((x) => x !== "snapshots"))
    if (!Array.isArray(b.data[s] || []))
      throw new Error(`Backup section ${s} is invalid.`);
}
async function previewRestore(file) {
  const b = JSON.parse(await file.text());
  validateBackup(b);
  modalBody.innerHTML = `<h2>Restore preview</h2><div class="card"><p><strong>Created:</strong> ${fmtDate(b.exportedAt)}</p><p><strong>App version:</strong> ${esc(b.appVersion)}</p><p><strong>Profiles:</strong> ${b.data.profiles.length}</p><p><strong>Wins:</strong> ${b.data.achievements.length}</p><p><strong>Speech & Language entries:</strong> ${b.data.words.length}</p><p><strong>My Day entries:</strong> ${(b.data.notes || []).filter((item) => item.kind === "dayEvent").length}</p><p><strong>Potty-training days:</strong> ${(b.data.pottyLogs || []).length}</p><p><strong>Appointments:</strong> ${(b.data.appointments || []).length}</p><p><strong>To-do items:</strong> ${(b.data.todos || []).length}</p><p><strong>Notes:</strong> ${b.data.notes.length}</p></div><div class="banner" style="margin-top:12px">A safety checkpoint will be created before current data changes.</div><div class="btn-row"><button id="replaceRestore" type="button" class="btn danger">Replace current data</button><button id="mergeRestore" type="button" class="btn secondary">Merge safely</button></div>`;
  modal.showModal();
  $("#replaceRestore").onclick = () => performRestore(b, "replace");
  $("#mergeRestore").onclick = () => performRestore(b, "merge");
}
async function performRestore(b, mode) {
  try {
    await createSnapshot(`Before ${mode} restore`);
    const stores = STORE_NAMES.filter((x) => x !== "snapshots");
    if (mode === "replace") for (const s of stores) await clearStore(s);
    for (const s of stores) {
      const existing =
        mode === "merge"
          ? new Set((await getAll(s)).map((x) => x.id))
          : new Set();
      for (const item of b.data[s] || [])
        if (!existing.has(item.id)) await put(s, item);
    }
    modal.close();
    alert("Restore completed successfully.");
    navigate("backup");
  } catch (e) {
    alert(`Restore failed: ${e.message}`);
  }
}
async function renderBackup() {
  const last = await getSetting("lastBackupAt"),
    snaps = (await getAll("snapshots")).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
  view.innerHTML = `<section class="hero"><h1>💾 Backup & Restore</h1><p>Your family data stays on this device unless you export it yourself.</p></section><h2 class="section-title">Complete local backup</h2><div class="card"><p>Exports profiles, Wins, communication entries, potty-training records, caregiver tools, notes, and settings into one versioned file.</p><div class="btn-row"><button id="exportBtn" class="btn">Export complete backup</button><button id="restoreBtn" class="btn secondary">Restore from file</button></div><p class="hint">Last manual backup: ${last ? fmtDate(last) : "None yet"}</p></div><h2 class="section-title">Safety checkpoints</h2><div class="card"><p>The app keeps up to five internal checkpoints before risky operations.</p><div class="btn-row"><button id="checkpointBtn" class="btn secondary">Create checkpoint now</button></div><p class="hint">Saved checkpoints: ${snaps.length}</p></div><div class="banner" style="margin-top:18px"><strong>Important:</strong> Removing the PWA or clearing browser storage can erase local data. Export backups regularly and store copies somewhere safe.</div>`;
  $("#exportBtn").onclick = exportBackup;
  $("#restoreBtn").onclick = () => $("#restoreInput").click();
  $("#checkpointBtn").onclick = async () => {
    await createSnapshot("Manual checkpoint");
    alert("Safety checkpoint created.");
    renderBackup();
  };
}

async function renderSettings() {
  const profiles = await getAll("profiles"),
    categories = await getVocabCategories(),
    accessStatus = await getEntitlement(),
    d = {
      profile: "all",
      type: "all",
      search: "",
      category: "",
      sort: "alpha",
      year: "",
      month: "",
      exactDate: "",
      speak: true,
      identify: true,
      asl: true,
      ...(await getSetting("vocabFilterDefaults", {})),
    },
    savedProfileDisplay = await getSetting("profileDisplay", "birthDate"),
    exactReady = profiles.length > 0 && profiles.every(hasExactBirthTime),
    profileDisplay =
      savedProfileDisplay === "exact" && !exactReady
        ? "yearsMonths"
        : savedProfileDisplay;
  view.innerHTML = `<section class="hero"><h1>⚙️ Settings</h1><p>Choose how profiles and speech filters work for your family.</p></section><div class="card settings-card access-card"><h3>Access</h3><p><strong>${esc(accessStatus.label)}</strong></p><p class="hint">New accounts receive ${ACCESS.trialDays} days of full access. Owner and active household subscription access will be confirmed by the server before enforcement is enabled.</p><button class="btn secondary" data-go="subscription" type="button">View access details</button></div><div class="card settings-card"><h3>Profile card display</h3><div class="field"><label>Show beneath the child’s name</label><select id="profileDisplay"><option value="birthDate" ${profileDisplay === "birthDate" ? "selected" : ""}>Birth date</option><option value="years" ${profileDisplay === "years" ? "selected" : ""}>Age in whole years — 2 yo</option><option value="yearsMonths" ${profileDisplay === "yearsMonths" ? "selected" : ""}>Age in years and months — 2 years 3 months</option><option value="exact" ${profileDisplay === "exact" ? "selected" : ""}>Live exact age — years, months, days, hours, minutes, seconds</option><option value="none" ${profileDisplay === "none" ? "selected" : ""}>Nothing</option></select></div><button id="saveProfileDisplay" class="btn" type="button">Save profile display</button></div><div class="card settings-card"><h3>Speech & Language filter defaults</h3><p class="hint">These choices load when the tracker opens and whenever Clear filters is pressed.</p><div class="form-grid settings-filter-grid"><div class="field"><label>Child</label><select id="defaultVocabProfile"><option value="all">All children</option>${profiles.map((p) => `<option value="${p.id}" ${d.profile === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div><div class="field"><label>Default search</label><input id="defaultVocabSearch" type="search" value="${esc(d.search || "")}" placeholder="Blank shows everything"></div><div class="field"><label>Category</label><select id="defaultVocabCategory"><option value="">All categories</option>${categories.map((c) => `<option ${d.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div><div class="field"><label>Sort</label><select id="defaultVocabSort"><option value="alpha" ${d.sort === "alpha" ? "selected" : ""}>Alphabetical</option><option value="category" ${d.sort === "category" ? "selected" : ""}>Category</option><option value="newest" ${d.sort === "newest" ? "selected" : ""}>Date first said — newest</option><option value="oldest" ${d.sort === "oldest" ? "selected" : ""}>Date first said — oldest</option></select></div><div class="field"><label>Year</label><input id="defaultVocabYear" type="number" min="1900" max="2100" inputmode="numeric" value="${esc(d.year || "")}" placeholder="All years"></div><div class="field"><label>Month</label><select id="defaultVocabMonth"><option value="">All months</option>${Array.from(
    { length: 12 },
    (_, i) => {
      const value = String(i + 1).padStart(2, "0"),
        name = new Intl.DateTimeFormat(undefined, {
          month: "long",
          timeZone: "UTC",
        }).format(new Date(Date.UTC(2020, i, 1)));
      return `<option value="${value}" ${d.month === value ? "selected" : ""}>${name}</option>`;
    },
  ).join(
    "",
  )}</select></div><div class="field"><label>Exact date</label><input id="defaultVocabDate" type="date" value="${esc(d.exactDate || "")}"></div><fieldset class="filter-abilities"><legend>Abilities included</legend><label><input id="defaultSpeak" type="checkbox" ${d.speak !== false ? "checked" : ""}> Speak</label><label><input id="defaultIdentify" type="checkbox" ${d.identify !== false ? "checked" : ""}> Identify</label><label><input id="defaultAsl" type="checkbox" ${d.asl !== false ? "checked" : ""}> ASL</label></fieldset></div><button id="saveVocabDefaults" class="btn" type="button">Save filter defaults</button></div><div class="card settings-card"><h3>Version</h3><p>${APP.name} v${APP.version}</p><p class="hint">Database schema ${APP.schemaVersion}</p></div><div class="card settings-card"><h3>Data model</h3><p>Local-first IndexedDB with permanent IDs and timestamps, ready for optional cloud sync later.</p></div><div class="btn-row"><button class="btn secondary" data-go="backup">Open backup tools</button><button class="btn secondary" data-go="about">About & disclaimer</button></div>`;
  const versionCard = [...document.querySelectorAll(".settings-card")].find(
    (card) => card.querySelector("h3")?.textContent === "Version",
  );
  if (versionCard) {
    versionCard.querySelector("p").textContent = `More than Measured™ v${APP.version}`;
    versionCard.querySelector("h3").insertAdjacentHTML(
      "afterend",
      '<p class="hint">by Serenity Valley Works</p>',
    );
  }
  const exactOption = $('#profileDisplay option[value="exact"]');
  const defaultTypeField = document.createElement("div");
  defaultTypeField.className = "field";
  defaultTypeField.innerHTML = `<label>Entry type</label><select id="defaultVocabType"><option value="all">All entry types</option><option value="word">Words only</option><option value="sentence">Sentences only</option><option value="letter">Letters only</option><option value="number">Numbers only</option></select>`;
  $("#defaultVocabProfile").closest(".field").after(defaultTypeField);
  $("#defaultVocabType").value = ["all", "word", "sentence", "letter", "number"].includes(d.type)
    ? d.type
    : "all";
  exactOption.disabled = !exactReady;
  if (!exactReady)
    $("#profileDisplay").insertAdjacentHTML(
      "afterend",
      '<span class="hint">Live exact age becomes available after every child profile has a complete birth date, hour, minute, and second.</span>',
    );
  $("#saveProfileDisplay").onclick = async () => {
    await setSetting("profileDisplay", $("#profileDisplay").value);
    alert("Profile display preference saved.");
  };
  $("#saveVocabDefaults").onclick = async () => {
    await setSetting("vocabFilterDefaults", {
      profile: $("#defaultVocabProfile").value,
      type: $("#defaultVocabType").value,
      search: $("#defaultVocabSearch").value.trim(),
      category: $("#defaultVocabCategory").value,
      sort: $("#defaultVocabSort").value,
      year: $("#defaultVocabYear").value,
      month: $("#defaultVocabMonth").value,
      exactDate: $("#defaultVocabDate").value,
      speak: $("#defaultSpeak").checked,
      identify: $("#defaultIdentify").checked,
      asl: $("#defaultAsl").checked,
    });
    alert("Speech and Language filter defaults saved.");
  };
  bindRouteButtons();
}
function renderAbout() {
  view.innerHTML = `<section class="hero"><h1>About More than Measured™</h1><p>A strengths-first autism caregiver village by Serenity Valley Works.</p></section><div class="card" style="margin-top:18px"><h3>Our purpose</h3><p>To help caregivers celebrate progress, understand how their child learns and communicates, and find practical support without judgment or comparison.</p></div><div class="card" style="margin-top:12px"><h3>Created by Serenity Valley Works</h3><p>More than Measured™ is thoughtfully developed by Serenity Valley Works for caregivers and the children they support.</p></div><div class="card" style="margin-top:12px"><h3>Important disclaimer</h3><p>This app is for caregiver education, organization, and support. It does not diagnose, treat, or replace advice from qualified medical, developmental, educational, or legal professionals.</p></div>`;
}

function openDrawer() {
  $("#drawer").classList.add("open");
  $("#drawer").setAttribute("aria-hidden", "false");
  $("#scrim").classList.remove("hidden");
}
function closeDrawer() {
  $("#drawer").classList.remove("open");
  $("#drawer").setAttribute("aria-hidden", "true");
  $("#scrim").classList.add("hidden");
}
function setupDrawer() {
  const links = [
    ["🏠", "Home", "home"],
    ["🌱", "My Child", "child"],
    ["🫧", "My Day", "myDay"],
    ["🗣️", "Speech & Language", "speech"],
    ["🌙", "Sleep Sanctuary", "sleep"],
    ["🫧", "Sensory Support", "sensory"],
    ["🩺", "Health & Wellness", "health"],
    ["📚", "Skill Building", "skills"],
    ["📚", "Resources", "resources"],
    ["🎡", "ASD Friendly Fun", "fun"],
    ["🤝", "Social Meetups", "community"],
    ["🧸", "Toy Exchange", "toys"],
    ["⭐", "Recommended", "recommendations"],
    ["🧑‍🍼", "Find a Babysitter", "babysitters"],
    ["💛", "Caregiver Corner", "caregiver"],
    ["💾", "Backup & Restore", "backup"],
    ["⚙️", "Settings", "settings"],
    ["🔄", "Accounts & Sync", "sync"],
    ["ℹ️", "About", "about"],
  ];
  $("#drawerNav").innerHTML = links
    .map((x) => `<button data-go="${x[2]}">${x[0]} ${x[1]}</button>`)
    .join("");
  $("#drawerVersion").textContent = APP.version;
  bindRouteButtons();
  $("#menuBtn").onclick = openDrawer;
  $("#backBtn").onclick = () => navigate(null, { back: true });
  $("#homeBadge").onclick = () => navigate("home");
  $("#closeDrawer").onclick = closeDrawer;
  $("#scrim").onclick = closeDrawer;
}
function setupPWA() {
  if ("serviceWorker" in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
    navigator.serviceWorker
      .register("./service-worker.js", { updateViaCache: "none" })
      .then((reg) => reg.update())
      .catch(() => {});
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    $("#installBtn").classList.remove("hidden");
  });
  $("#installBtn").onclick = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $("#installBtn").classList.add("hidden");
  };
}
async function init() {
  db = await openDB();
  await window.MTMSync.initializeAccountIsolation();
  setupDrawer();
  setupPWA();
  window.addEventListener("mtm:remote-data",()=>{remoteRefreshPending=true;refreshVisibleRouteFromSync().catch(()=>{});});
  document.addEventListener("focusout",()=>setTimeout(()=>refreshVisibleRouteFromSync().catch(()=>{}),0));
  modal.addEventListener("close",()=>refreshVisibleRouteFromSync().catch(()=>{}));
  window.addEventListener("pageshow", () => {
    applyRouteChrome(currentRoute || (location.hash.slice(1) === "home" ? "home" : ""));
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      birthdayGreetingsShown = false;
    } else {
      applyRouteChrome(currentRoute || (location.hash.slice(1) === "home" ? "home" : ""));
      if (currentRoute === "home" && !modal.open) {
        showBirthdayGreetingsIfNeeded().catch(() => {});
      }
    }
  });
  document
    .querySelectorAll(".nav-item")
    .forEach((b) => (b.onclick = () => navigate(b.dataset.route)));
  $("#restoreInput").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      await previewRestore(f);
    } catch (err) {
      alert(err.message);
    }
    e.target.value = "";
  };
  const hasBirthdayToday = (await getAll("profiles")).some((profile) => birthdayToday(profile));
  await navigate(hasBirthdayToday ? "home" : location.hash.slice(1) || "home");
}
init().catch((err) => {
  view.innerHTML = `<div class="banner"><strong>Startup error:</strong> ${esc(err.message)}</div>`;
});
