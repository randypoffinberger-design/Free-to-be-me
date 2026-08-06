"use strict";

const APP = { name: "More than Measured", version: "0.7.4", schemaVersion: 3 };
const DB_NAME = "ftbm-db",
  DB_VERSION = 3,
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
let db,
  deferredInstallPrompt = null,
  profileAgeTimer = null,
  vocabSessionFilters = null;
const $ = (s) => document.querySelector(s),
  view = $("#view"),
  modal = $("#modal"),
  modalBody = $("#modalBody");
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

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const n of STORE_NAMES)
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
    r.onsuccess = () => res(v);
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
    const r = tx(s, "readwrite").delete(id);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
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
  resources: renderResources,
  explore: renderExplore,
  caregiver: renderCaregiver,
  backup: renderBackup,
  about: renderAbout,
  settings: renderSettings,
};
function navigate(r) {
  const route = routes[r] ? r : "home";
  if (profileAgeTimer) {
    clearInterval(profileAgeTimer);
    profileAgeTimer = null;
  }
  document.body.classList.toggle("home-route", route === "home");
  routes[route]();
  history.replaceState(null, "", `#${route}`);
  closeDrawer();
  view.focus();
}
const card = (i, t, d, r) =>
  `<button class="card-button" data-go="${r}"><span class="emoji">${i}</span><strong>${t}</strong><small>${d}</small></button>`;
function bindRouteButtons() {
  document
    .querySelectorAll("[data-go]")
    .forEach((b) => (b.onclick = () => navigate(b.dataset.go)));
}

async function renderHome() {
  view.innerHTML = `<section class="illustrated-home" aria-label="More than Measured home navigation">
    <img src="assets/home/homepage.jpeg" alt="More than Measured — celebrating every child’s unique journey" width="864" height="1536">
    <button class="home-hotspot growth" data-go="child" aria-label="Open Growth Journey and My Child"><span>Growth Journey</span></button>
    <button class="home-hotspot communication" data-go="speech" aria-label="Open Speech and Language Building"><span>Speech/Language Building</span></button>
    <button class="home-hotspot sleep" data-feature="Sleep Sanctuary" aria-label="Open Sleep Sanctuary"><span>Sleep Sanctuary</span></button>
    <button class="home-hotspot sensory" data-feature="Sensory Support" aria-label="Open Sensory Support"><span>Sensory Support</span></button>
    <button class="home-hotspot learning" data-go="skills" aria-label="Open Skill Building"><span>Skill Building</span></button>
    <button class="home-hotspot medical" data-feature="Health and Wellness" aria-label="Open Health and Wellness"><span>Health and Wellness</span></button>
    <button class="home-hotspot caregiver-link" data-go="caregiver" aria-label="Open Caregiver Corner"><span>Caregiver Corner</span></button>
    <button class="home-hotspot community" data-go="explore" aria-label="Open ASD Friendly Fun and Explore"><span>ASD Friendly Fun</span></button>
  </section>`;
  bindRouteButtons();
  document
    .querySelectorAll(".home-hotspot[data-feature]")
    .forEach((b) => (b.onclick = () => underConstruction(b.dataset.feature)));
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
    <button class="card-button speech-future" data-feature="ASL for ASD"><span class="emoji">🤟</span><strong>ASL for ASD</strong><small>ASL support designed with autistic children in mind.</small></button>
    <button class="card-button speech-future" data-feature="ASL Quick Guide"><span class="emoji">🖐️</span><strong>ASL Quick Guide</strong><small>A quick reference for useful everyday signs.</small></button>
    <button class="card-button speech-future" data-feature="How to Use ASL"><span class="emoji">📘</span><strong>How to Use ASL</strong><small>Practical guidance for introducing and using ASL.</small></button>
    <button class="card-button speech-future" data-feature="AAC and Your Child"><span class="emoji">🔊</span><strong>AAC and Your Child</strong><small>Information about augmentative and alternative communication.</small></button>
    <button class="card-button speech-future" data-feature="Flash Cards for ASD"><span class="emoji">🃏</span><strong>Flash Cards for ASD</strong><small>Visual cards for communication and language practice.</small></button>
    <button class="card-button speech-future" data-feature="Speech Language Apps"><span class="emoji">📱</span><strong>Speech Language APPS</strong><small>Helpful apps for speech, language, and communication.</small></button>
    <button class="card-button speech-future" data-feature="Links to Products"><span class="emoji">🛍️</span><strong>Links to Products</strong><small>Communication tools and related product links.</small></button>
  </div>`;
  bindRouteButtons();
  document
    .querySelectorAll(".speech-future")
    .forEach((button) =>
      (button.onclick = () => underConstruction(button.dataset.feature)),
    );
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
  d.setDate(
    Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()),
  );
  return d;
}
function ageParts(profile, now = new Date()) {
  const birth = profileBirthDate(profile);
  if (!birth || birth > now) return null;
  let years = now.getFullYear() - birth.getFullYear(),
    cursor = new Date(birth);
  cursor.setFullYear(birth.getFullYear() + years);
  if (cursor > now) {
    years--;
    cursor = new Date(birth);
    cursor.setFullYear(birth.getFullYear() + years);
  }
  let months = 0;
  while (months < 11 && addMonthsClamped(cursor, months + 1) <= now) months++;
  cursor = addMonthsClamped(cursor, months);
  let seconds = Math.floor((now - cursor) / 1000),
    days = Math.floor(seconds / 86400);
  seconds -= days * 86400;
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  return { years, months, days, hours, minutes, seconds };
}
function profileDetail(profile, mode, now = new Date()) {
  if (!profile.birthDate) return "A unique journey worth celebrating";
  if (mode === "none") return "";
  if (mode === "birthDate") return `Born ${fmtDate(profile.birthDate)}`;
  const a = ageParts(profile, now);
  if (!a) return "Birth date is in the future";
  if (mode === "years") return `${a.years} yo`;
  if (
    mode === "yearsMonths" ||
    (mode === "exact" && !hasExactBirthTime(profile))
  )
    return `${a.years} ${a.years === 1 ? "year" : "years"} ${a.months} ${a.months === 1 ? "month" : "months"}`;
  return `${a.years}y ${a.months}m ${a.days}d ${String(a.hours).padStart(2, "0")}:${String(a.minutes).padStart(2, "0")}:${String(a.seconds).padStart(2, "0")}`;
}
async function resizeProfilePhoto(file) {
  if (!file) return null;
  if (!file.type.startsWith("image/"))
    throw new Error("Please choose an image file.");
  if (file.size > 15 * 1024 * 1024)
    throw new Error("Please choose an image smaller than 15 MB.");
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("The image could not be opened."));
      el.src = src;
    });
    const size = Math.min(img.naturalWidth, img.naturalHeight),
      sx = (img.naturalWidth - size) / 2,
      sy = (img.naturalHeight - size) / 2,
      canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    canvas.getContext("2d").drawImage(img, sx, sy, size, size, 0, 0, 512, 512);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(src);
  }
}

async function renderChild() {
  const p = await getAll("profiles"),
    a = await getAll("achievements"),
    w = await getAll("words"),
    profileDisplay = await getSetting("profileDisplay", "birthDate");
  if (!p.length) {
    view.innerHTML = `<div class="empty card"><div class="big">🌱</div><h2>Start your child’s journey</h2><p>Create a profile before adding real progress data.</p><div class="btn-row" style="justify-content:center"><button id="addProfile" class="btn">Create profile</button></div></div>`;
    $("#addProfile").onclick = openProfileForm;
    return;
  }
  view.innerHTML = `<div class="btn-row"><button id="addProfile" class="btn secondary">Add another child</button><button id="addAchievement" class="btn">Celebrate a new achievement</button></div>
  <h2 class="section-title">Child profiles</h2>
  <div class="list">${p.map((x) => `<div class="profile-card card"><div class="avatar">${x.photoData ? `<img src="${x.photoData}" alt="${esc(x.name)} profile photo">` : esc(x.emoji || "🌟")}</div><div class="meta"><h3>${esc(x.name)}</h3><p class="profile-detail" data-profile-id="${x.id}">${esc(profileDetail(x, profileDisplay))}</p></div><button class="small-action edit-profile" data-id="${x.id}" type="button">Edit</button></div>`).join("")}</div>
  <h2 class="section-title">Progress tools</h2>
  <div class="grid">
    <button id="viewAchievements" class="card-button"><span class="emoji">✨</span><strong>Achievements</strong><small>${a.length} saved. Tap to view.</small></button>
    <button id="viewWords" class="card-button"><span class="emoji">🗣️</span><strong>Words & phrases</strong><small>${w.length} saved.</small></button>
    <button id="providerSummary" class="card-button"><span class="emoji">📄</span><strong>Provider summary</strong><small>Share progress over time.</small></button>
  </div>`;
  $("#addProfile").onclick = openProfileForm;
  document
    .querySelectorAll(".edit-profile")
    .forEach(
      (b) =>
        (b.onclick = () =>
          openProfileForm(p.find((x) => x.id === b.dataset.id))),
    );
  $("#addAchievement").onclick = () => openAchievementForm(p);
  $("#viewAchievements").onclick = () => openAchievements(a, p);
  $("#viewWords").onclick = () => navigate("vocabulary");
  $("#providerSummary").onclick = () => underConstruction("Provider summary");
  if (profileDisplay === "exact") {
    const updateAges = () =>
      document.querySelectorAll(".profile-detail").forEach((el) => {
        const profile = p.find((x) => x.id === el.dataset.profileId);
        if (profile) el.textContent = profileDetail(profile, "exact");
      });
    profileAgeTimer = setInterval(updateAges, 1000);
  }
}

function openAchievements(items, profiles) {
  const names = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
  const sorted = [...items].sort(
    (a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt),
  );
  modalBody.innerHTML = `<h2>✨ Achievements</h2>
  ${sorted.length ? `<div class="list">${sorted.map((x) => `<div class="list-item"><div style="font-size:1.7rem">🎉</div><div><strong>${esc(x.title)}</strong><div class="hint">${esc(names[x.profileId] || "Child")} • ${esc(x.category || "Achievement")} • ${fmtDate(x.date || x.createdAt)}</div>${x.notes ? `<p style="margin-bottom:0">${esc(x.notes)}</p>` : ""}</div></div>`).join("")}</div>` : `<div class="empty"><div class="big">🌱</div><p>No achievements have been saved yet.</p></div>`}
  <button id="closeAchievements" class="btn full" type="button" style="margin-top:14px">Close</button>`;
  modal.showModal();
  $("#closeAchievements").onclick = () => modal.close();
}

function openProfileForm(item = null) {
  const selected = item?.emoji || "🌟",
    storedTime = hasExactBirthTime(item || {}) ? item.birthTime.split(":") : [],
    storedHour = storedTime.length ? Number(storedTime[0]) : null,
    displayHour = storedHour === null ? "" : String(storedHour % 12 || 12),
    meridiem = storedHour !== null && storedHour >= 12 ? "PM" : "AM";
  modalBody.innerHTML = `<h2>${item ? "Edit" : "Create"} child profile</h2><div class="form-grid"><div class="field"><label>Name</label><input id="pName" value="${esc(item?.name || "")}" autocomplete="off"></div><div class="field"><label>Birth date <span class="hint">(optional)</span></label><input id="pBirth" type="date" value="${item?.birthDate || ""}"></div><fieldset class="birth-time-field"><legend>Birth time <span class="hint">(optional)</span></legend><div><label>Hour<input id="pHour" type="number" min="1" max="12" inputmode="numeric" value="${displayHour}"></label><label>Minute<input id="pMinute" type="number" min="0" max="59" inputmode="numeric" value="${storedTime[1] || ""}"></label><label>Second<input id="pSecond" type="number" min="0" max="59" inputmode="numeric" value="${storedTime[2] || ""}"></label><label>AM/PM<select id="pMeridiem"><option ${meridiem === "AM" ? "selected" : ""}>AM</option><option ${meridiem === "PM" ? "selected" : ""}>PM</option></select></label></div><span class="hint">Enter hour, minute, and second to enable the live exact-age display. Leave all three blank if the time is unknown.</span></fieldset><fieldset class="symbol-picker"><legend>Profile symbol</legend>${PROFILE_SYMBOLS.map((symbol) => `<label><input type="radio" name="pEmoji" value="${symbol}" ${symbol === selected ? "checked" : ""}><span>${symbol}</span></label>`).join("")}</fieldset><div class="field"><label>Child photo <span class="hint">(optional)</span></label><input id="pPhoto" type="file" accept="image/*"><span class="hint">Stored only in this app and included in complete backups.</span></div><div id="photoPreview" class="profile-photo-preview ${item?.photoData ? "" : "hidden"}">${item?.photoData ? `<img src="${item.photoData}" alt="Current profile photo">` : ""}</div>${item?.photoData ? '<label class="check-option"><input id="removePhoto" type="checkbox"> Remove current photo</label>' : ""}<button id="saveProfile" class="btn full" type="button">Save profile</button></div>`;
  modal.showModal();
  $("#pPhoto").onchange = () => {
    const file = $("#pPhoto").files[0];
    if (!file) return;
    const preview = $("#photoPreview");
    preview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Selected profile photo preview">`;
    preview.classList.remove("hidden");
  };
  $("#saveProfile").onclick = async () => {
    const name = $("#pName").value.trim();
    if (!name) return alert("Please enter a name.");
    const values = [
        $("#pHour").value,
        $("#pMinute").value,
        $("#pSecond").value,
      ],
      anyTime = values.some((v) => v !== ""),
      completeTime = values.every((v) => v !== "");
    if (anyTime && !completeTime)
      return alert(
        "Enter the birth hour, minute, and second, or leave all three blank.",
      );
    if (anyTime && !$("#pBirth").value)
      return alert("Please enter a birth date before adding a birth time.");
    let birthTime = null;
    if (completeTime) {
      let [hour, minute, second] = values.map(Number);
      if (
        hour < 1 ||
        hour > 12 ||
        minute < 0 ||
        minute > 59 ||
        second < 0 ||
        second > 59
      )
        return alert("Please enter a valid birth time.");
      if ($("#pMeridiem").value === "PM" && hour !== 12) hour += 12;
      if ($("#pMeridiem").value === "AM" && hour === 12) hour = 0;
      birthTime = [hour, minute, second]
        .map((v) => String(v).padStart(2, "0"))
        .join(":");
    }
    const button = $("#saveProfile");
    button.disabled = true;
    button.textContent = "Saving…";
    try {
      const file = $("#pPhoto").files[0],
        photoData = file
          ? await resizeProfilePhoto(file)
          : $("#removePhoto")?.checked
            ? null
            : item?.photoData || null;
      await put("profiles", {
        ...item,
        id: item?.id || uid(),
        name,
        birthDate: $("#pBirth").value || null,
        birthTime: $("#pBirth").value ? birthTime : null,
        emoji:
          document.querySelector('input[name="pEmoji"]:checked')?.value || "🌟",
        photoData,
        createdAt: item?.createdAt || nowISO(),
        updatedAt: nowISO(),
        syncStatus: "local",
      });
      modal.close();
      renderChild();
    } catch (error) {
      alert(error.message);
      button.disabled = false;
      button.textContent = "Save profile";
    }
  };
}
function openAchievementForm(p) {
  modalBody.innerHTML = `<h2>Celebrate an achievement</h2><div class="form-grid"><div class="field"><label>Child</label><select id="aProfile">${p.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></div><div class="field"><label>What happened?</label><input id="aTitle" placeholder="Used a new sentence"></div><div class="field"><label>Category</label><select id="aCategory"><option>Communication</option><option>Learning</option><option>Daily living</option><option>Motor skills</option><option>Sensory & regulation</option><option>Social connection</option><option>Other</option></select></div><div class="field"><label>Date</label><input id="aDate" type="date" value="${new Date().toISOString().slice(0, 10)}"></div><div class="field"><label>Notes</label><textarea id="aNotes" placeholder="What helped? What made this moment special?"></textarea></div><button id="saveAchievement" class="btn full" type="button">🎉 You did it! Save achievement</button></div>`;
  modal.showModal();
  $("#saveAchievement").onclick = async () => {
    const t = $("#aTitle").value.trim();
    if (!t) return alert("Please describe the achievement.");
    await put("achievements", {
      id: uid(),
      profileId: $("#aProfile").value,
      title: t,
      category: $("#aCategory").value,
      date: $("#aDate").value,
      notes: $("#aNotes").value.trim(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
      syncStatus: "local",
    });
    modal.close();
    alert("🎉 Achievement saved!");
    renderChild();
  };
}

function placeholder(t, i, c, items) {
  view.innerHTML = `<section class="hero"><h1>${i} ${t}</h1><p>${c}</p></section><h2 class="section-title">Planned sections</h2><div class="grid">${items.map((x) => `<button class="card-button future-feature" data-feature="${esc(x[0].replace(/^[^ ]+ /, ""))}"><strong>${x[0]}</strong><small>${x[1]}</small></button>`).join("")}</div><div class="banner" style="margin-top:18px">This section is included in the app structure now and will be activated in a later version.</div>`;
  document
    .querySelectorAll(".future-feature")
    .forEach((b) => (b.onclick = () => underConstruction(b.dataset.feature)));
}
function renderResources() {
  placeholder(
    "Resources",
    "📚",
    "Practical information organized for overwhelmed caregivers.",
    [
      ["🗣️ Communication", "ASL, AAC, speech, and visual supports."],
      ["🧸 Sensory", "Tools, toys, regulation, and room supports."],
      ["🌙 Sleep", "Routines, tracking, and sleep environment ideas."],
      [
        "🏥 Medical advocacy",
        "Equipment information and necessity-letter templates.",
      ],
      [
        "🧬 Health education",
        "Careful, sourced explanations for labs and genetics.",
      ],
      ["🎓 Learning", "Discovering how your child learns best."],
    ],
  );
}
function renderExplore() {
  placeholder(
    "Explore",
    "🗺️",
    "A future guide to autism-friendly family fun.",
    [
      ["🎡 Family activities", "Sensory-friendly events and destinations."],
      ["🔇 Sensory details", "Noise, crowds, lighting, and quiet spaces."],
      [
        "📍 Location search",
        "Find nearby options when online services are added.",
      ],
    ],
  );
}
// Each entry already has a place for future media. Empty sources create no
// image or video elements, so this browser build carries no media overhead.
const CAREGIVER_TERMS = [
  ["AAC", "AAC stands for Augmentative and Alternative Communication. It simply means using another way to help someone communicate—like pictures, signs, a letter board, or a device that speaks. AAC can be used alongside speech, and it does not stop a child from learning to talk."],
  ["ASD Level 1", "ASD Level 1 generally means a person needs some support in everyday life. They may communicate well but still find things like social situations, changes, planning, or sensory input difficult. The help they need can change from one setting or day to another, and the level does not tell you their intelligence or potential."],
  ["ASD Level 2", "ASD Level 2 generally means a person needs more noticeable or consistent support. Communication, changes in routine, sensory needs, or daily tasks may be harder to manage without help. Their needs can still vary a lot by skill, setting, stress, and stage of life."],
  ["ASD Level 3", "ASD Level 3 generally means a person needs very substantial, ongoing support in daily life. They may need a great deal of help with communication, safety, transitions, sensory needs, or personal care. This level describes support needs—not intelligence, personality, worth, or what someone may learn over time."],
  ["Autistic burnout", "Autistic burnout is a deep kind of exhaustion that can happen after someone has spent a long time coping with stress, demands, sensory strain, or hiding parts of themselves. They may have less energy, find everyday skills harder, or need more quiet and recovery time. Rest, fewer demands, predictability, and understanding can help."],
  ["Dysregulation", "Dysregulation means the nervous system is having a hard time handling feelings, sensory input, or what is being asked in that moment. A child may become upset, very active, withdrawn, or unable to do things they normally can. It helps to see the behavior as a sign that they need support, not as simple disobedience."],
  ["Echolalia", "Echolalia is when someone repeats words or phrases they have heard from people, shows, songs, or earlier moments. The repetition may happen right away or much later. It can be a way to communicate, work out language, practice, remember something, or feel comforted."],
  ["Elopement", "Elopement means leaving a safe place or caregiver unexpectedly. A child may be trying to reach something interesting, get away from something uncomfortable, or meet a need they cannot explain yet. Because it can be dangerous, the focus should be on safety, prevention, supervision, and figuring out what is drawing them away."],
  ["Executive functioning", "Executive functioning is the set of skills that helps us get started, remember steps, plan, switch tasks, manage time, and control impulses. A child may truly understand what to do and still need help beginning or finishing it. Visual steps, reminders, and doing the first part together can make a big difference."],
  ["Gestalt language processing", "Some children seem to learn language in whole chunks—like a full phrase from a song or show—before they learn to mix and match individual words. This is often called gestalt language processing. Echolalia may be part of that journey, and the repeated phrase may carry a real message even if it sounds out of place to someone else."],
  ["Interoception", "Interoception is the sense that tells us what is happening inside our body—things like hunger, thirst, pain, temperature, a racing heart, or needing the bathroom. Some children notice these signals very strongly, very late, or only sometimes, so they may need help learning what each feeling means."],
  ["Joint attention", "Joint attention is simply two people sharing interest in the same thing. A child might look back and forth, point, make a sound, move their body, or bring you an object to share the moment. It does not have to involve eye contact to count."],
  ["Masking", "Masking is when an autistic person hides or holds back natural behaviors to fit in or avoid negative reactions. They might force eye contact, copy other people, stay quiet about discomfort, or stop themselves from stimming. It can take a lot of energy and may leave someone anxious, exhausted, or burned out afterward."],
  ["Meltdown", "A meltdown happens when everything becomes too much and the person loses the ability to stay in control. Noise, feelings, demands, communication trouble, or a day full of small stresses can all build toward one. It is not manipulation or a choice; the most helpful response is usually safety, fewer words, less pressure, and time to recover."],
  ["Neurodiversity", "Neurodiversity is the idea that brains naturally work in different ways. People can think, learn, communicate, focus, and experience the world differently from one another. Those differences can include strengths and real disabilities at the same time, and everyone deserves the support that helps them live well."],
  ["Proprioception", "Proprioception is the body's sense of where it is and how its muscles and joints are moving. Pushing, pulling, carrying, climbing, jumping, or firm pressure can feel calming and organizing for some children. You may hear people call these activities ‘heavy work.’"],
  ["Scripting", "Scripting is using remembered lines from shows, songs, books, or past conversations. A script may help a child communicate, play, understand what happened, or calm themselves. Even when the words came from somewhere else, the child may be using them to say something meaningful."],
  ["Sensory avoider", "A sensory avoider is someone who tries to get away from certain sounds, lights, textures, smells, tastes, touch, or movement because the input feels too strong or uncomfortable. Avoiding it is often their way of protecting themselves, not being difficult."],
  ["Sensory overload", "Sensory overload happens when the brain is receiving more sights, sounds, touch, movement, or other input than it can comfortably sort through. A child might cover their ears, run away, cry, become agitated, shut down, or have a meltdown. A quieter space and less pressure can help their system settle."],
  ["Sensory seeker", "A sensory seeker is someone who looks for extra sensory input. They might spin, crash into cushions, chew, touch everything, make loud sounds, or stay in motion. Offering safe ways to get that input can work better than simply asking them to stop."],
  ["Shutdown", "A shutdown is an inward response to being overwhelmed. A person may become very quiet, stop speaking or moving, seem sleepy, withdraw, or respond less than usual. They are not ignoring you; their system may need quiet, safety, fewer demands, and time before they can reconnect."],
  ["Special interest", "A special interest is something a person feels deeply drawn to and may know a great deal about. It can bring joy, comfort, confidence, motivation, and connection. Joining a child in that interest can also be a wonderful way to build trust and support learning."],
  ["Stimming", "Stimming means repeating a movement, sound, or action—such as rocking, hand movements, humming, pacing, or repeating sounds. It may help a person feel calm, express excitement, focus, or get the sensory input they need. If a stim is safe, it usually does not need to be stopped."],
  ["Tantrum", "A tantrum is usually an expression of frustration tied to wanting or avoiding something, and it often settles when the situation changes. A meltdown comes from being overwhelmed and cannot simply be switched off by giving in. From the outside they can look similar, so it helps to consider what happened beforehand and what actually helps the child recover."],
  ["Vestibular sense", "The vestibular sense helps the body understand movement and balance. Swinging, spinning, climbing, jumping, and changing head position all involve this system. Some children seek a lot of this movement, while others may feel uncomfortable or unsteady with it."],
].map(([term, explanation, media = {}]) => ({
  term,
  explanation,
  media: {
    image: media.image || "",
    clip: media.clip || "",
    alt: media.alt || "",
    caption: media.caption || "",
  },
}));

function renderSkills() {
  view.innerHTML = `<section class="hero"><h1>📚 Skill Building</h1><p>Practical tools for supporting everyday skills at your child’s pace.</p></section><h2 class="section-title">Daily living</h2><div class="grid"><button class="card-button" data-go="potty"><span class="emoji">🚽</span><strong>Potty Training Tracker</strong><small>Track potty successes and accidents by day.</small></button><button class="card-button" data-go="pottyTips"><span class="emoji">💡</span><strong>Potty Training Tips & Tricks</strong><small>Gentle, practical ideas to support learning and comfort.</small></button></div>`;
  bindRouteButtons();
}

async function renderPottyTracker() {
  const profiles = await getAll("profiles"), logs = await getAll("pottyLogs");
  if (!profiles.length) {
    view.innerHTML = `<div class="empty card"><div class="big">🚽</div><h2>Create a child profile first</h2><p>Potty-training records are connected to a child.</p><button id="pottyCreateProfile" class="btn">Create profile</button></div>`;
    $("#pottyCreateProfile").onclick = openProfileForm;
    return;
  }
  view.innerHTML = `<section class="hero"><h1>🚽 Potty Training Tracker</h1><p>Record each day with patience, privacy, and no comparison.</p></section><div class="potty-entry card"><div class="field"><label>Child</label><select id="pottyProfile">${profiles.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div><div class="field"><label>Day</label><input id="pottyDate" type="date" value="${isoToday()}"></div><div class="potty-count-grid"><label><span>💧 Pees in potty</span><input id="pottyPees" type="number" min="0" step="1" inputmode="numeric" value="0"></label><label><span>💩 Poops in potty</span><input id="pottyPoops" type="number" min="0" step="1" inputmode="numeric" value="0"></label><label><span>🧺 Accidents</span><input id="pottyAccidents" type="number" min="0" step="1" inputmode="numeric" value="0"></label></div><div class="field"><label>Notes <span class="hint">(optional)</span></label><textarea id="pottyNotes" placeholder="What helped, timing, signs noticed, or anything worth remembering"></textarea></div><button id="savePottyDay" class="btn full" type="button">Save day</button></div><div id="pottyStats"></div><h2 class="section-title">Recent days</h2><div id="pottyHistory" class="potty-history"></div>`;
  const selectedLogs = () => logs.filter((x) => x.profileId === $("#pottyProfile").value).sort((a, b) => b.date.localeCompare(a.date));
  const loadDay = () => {
    const item = logs.find((x) => x.profileId === $("#pottyProfile").value && x.date === $("#pottyDate").value);
    $("#pottyPees").value = item?.pees ?? 0; $("#pottyPoops").value = item?.poops ?? 0; $("#pottyAccidents").value = item?.accidents ?? 0; $("#pottyNotes").value = item?.notes || "";
    $("#savePottyDay").textContent = item ? "Update day" : "Save day";
  };
  const draw = () => {
    const shown = selectedLogs(), recent = shown.filter((x) => x.date >= new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)), sum = (key) => recent.reduce((total, x) => total + Number(x[key] || 0), 0);
    $("#pottyStats").innerHTML = `<h2 class="section-title">Last 7 days</h2><div class="potty-stats"><div><strong>${sum("pees")}</strong><span>Pees in potty</span></div><div><strong>${sum("poops")}</strong><span>Poops in potty</span></div><div><strong>${sum("accidents")}</strong><span>Accidents</span></div></div>`;
    $("#pottyHistory").innerHTML = shown.length ? shown.map((x) => `<div class="potty-day card" data-id="${x.id}"><div><strong>${fmtDate(x.date)}</strong><span>💧 ${Number(x.pees || 0)} pee • 💩 ${Number(x.poops || 0)} poop • 🧺 ${Number(x.accidents || 0)} ${Number(x.accidents || 0) === 1 ? "accident" : "accidents"}</span>${x.notes ? `<p>${esc(x.notes)}</p>` : ""}</div><div><button class="small-action edit-potty" data-id="${x.id}" type="button">Edit</button><button class="small-action danger-link delete-potty" data-id="${x.id}" type="button">Delete</button></div></div>`).join("") : `<div class="empty card"><p>No potty-training days recorded yet.</p></div>`;
    document.querySelectorAll(".edit-potty").forEach((button) => button.onclick = () => { const item = logs.find((x) => x.id === button.dataset.id); $("#pottyDate").value = item.date; loadDay(); scrollTo({ top: 0, behavior: "smooth" }); });
    document.querySelectorAll(".delete-potty").forEach((button) => button.onclick = async () => { const item = logs.find((x) => x.id === button.dataset.id); if (!item || !confirm(`Delete the potty-training record for ${fmtDate(item.date)}?`)) return; await createSnapshot(`Before deleting potty-training day ${item.date}`); await deleteItem("pottyLogs", item.id); logs.splice(logs.indexOf(item), 1); loadDay(); draw(); });
  };
  $("#pottyProfile").onchange = () => { loadDay(); draw(); };
  $("#pottyDate").onchange = loadDay;
  $("#savePottyDay").onclick = async () => {
    const profileId = $("#pottyProfile").value, date = $("#pottyDate").value, cleanCount = (id) => Math.max(0, Math.floor(Number($(id).value) || 0));
    if (!date) return alert("Choose a day to record.");
    const old = logs.find((x) => x.profileId === profileId && x.date === date), item = { id: old?.id || `potty-${profileId}-${date}`, profileId, date, pees: cleanCount("#pottyPees"), poops: cleanCount("#pottyPoops"), accidents: cleanCount("#pottyAccidents"), notes: $("#pottyNotes").value.trim(), createdAt: old?.createdAt || nowISO(), updatedAt: nowISO(), syncStatus: "local" };
    await put("pottyLogs", item);
    if (old) Object.assign(old, item); else logs.push(item);
    loadDay(); draw(); alert("Potty-training day saved.");
  };
  loadDay(); draw();
}

function renderPottyTips() {
  const tips = [
    ["Look for readiness, not a deadline", "Signs may include staying dry longer, noticing a wet or dirty diaper, hiding to go, showing interest in the toilet, or communicating before or after going. Readiness can be uneven and may come and go."],
    ["Build a predictable routine", "Offer calm toilet opportunities at natural times such as after waking, after meals, before leaving home, and before bed. Keep the routine brief and consistent."],
    ["Use a simple visual sequence", "Pictures or a short list—pants down, sit, wipe, flush, wash hands—can make the steps easier to understand and reduce verbal overload."],
    ["Support communication", "Teach and honor a consistent word, sign, picture, or AAC button for bathroom. Respond to attempts even when they come after the child has already gone."],
    ["Make the bathroom sensory-friendly", "Consider lighting, fan and flush noise, seat temperature, foot support, smells, and clothing textures. A stable footstool and smaller seat insert can help a child feel secure."],
    ["Choose easy clothing", "Elastic-waist pants and simple layers reduce the number of steps and make independent success more reachable."],
    ["Keep praise specific and pressure low", "Notice the exact step: ‘You sat on the potty,’ ‘You told me,’ or ‘Pee went in the potty.’ Avoid shame, punishment, comparison, or forcing a child to remain seated."],
    ["Treat accidents neutrally", "Use a calm, brief response: ‘Pee goes in the potty. Let’s get clean and try again next time.’ Record patterns without making the accident feel like failure."],
    ["Watch for patterns", "The tracker can reveal common times, signals, constipation patterns, or environments where success is easier. Use the pattern to adjust reminders rather than increasing pressure."],
    ["Protect comfort and health", "Constipation, painful stools, urinary symptoms, or sudden regression can make training much harder. Pause pressure and contact the child’s healthcare professional when pain or medical concerns are present."],
  ];
  view.innerHTML = `<section class="hero"><h1>💡 Potty Training Tips & Tricks</h1><p>Gentle starting points that can be adapted to your child.</p></section><div class="banner" style="margin-top:16px">Potty training is a skill, not a test. Progress may be non-linear, and comfort and communication come first.</div><div class="tips-list">${tips.map(([title, text]) => `<details class="term-card"><summary>${esc(title)}</summary><p>${esc(text)}</p></details>`).join("")}</div>`;
}

const IEP_REQUEST_TEMPLATE = `[DATE]

To: [PRINCIPAL, SPECIAL EDUCATION DIRECTOR, OR SCHOOL CONTACT]
[SCHOOL OR DISTRICT NAME]
[SCHOOL OR DISTRICT ADDRESS OR EMAIL]

Subject: Request for an initial special education evaluation for [CHILD'S FULL NAME], date of birth [DATE OF BIRTH], grade [GRADE]

Dear [NAME OR SCHOOL TEAM],

I am the parent/guardian of [CHILD'S FULL NAME], who attends [SCHOOL NAME]. I am writing to request a full and individual initial evaluation under the Individuals with Disabilities Education Act (IDEA) to determine whether my child is eligible for special education and related services.

I am concerned about [DESCRIBE LEARNING, COMMUNICATION, SENSORY, SOCIAL, BEHAVIORAL, MOTOR, ATTENDANCE, OR DAILY-LIVING CONCERNS]. Examples include [ADD SPECIFIC EXAMPLES, DATES, SCHOOLWORK, REPORTS, OR OBSERVATIONS].

My child has been diagnosed with or is being evaluated for [OPTIONAL: DIAGNOSIS OR CONDITION]. Supports that have been tried include [LIST SUPPORTS, INTERVENTIONS, ACCOMMODATIONS, OR SERVICES], with the following results: [DESCRIBE WHAT HELPED OR WHAT REMAINS DIFFICULT].

Please evaluate every area related to the suspected disability, including any relevant academic, communication, functional, social-emotional, sensory, motor, behavioral, assistive-technology, and related-service needs. Please do not delay this request while waiting for additional classroom interventions.

Please send me the district's written consent form, evaluation procedures, applicable timeline, and a copy of my procedural safeguards. If the district refuses any part of this request, please provide prior written notice explaining the decision and the information used to make it.

I would like to participate in all meetings and receive copies of evaluation reports before the eligibility meeting when possible. Please contact me in writing at [EMAIL OR MAILING ADDRESS] and at [PHONE NUMBER].

Thank you for working with me to understand and support [CHILD'S FIRST NAME].

Sincerely,
[PARENT/GUARDIAN NAME]
[ADDRESS]
[EMAIL]
[PHONE]`;

const PLAN_504_REQUEST_TEMPLATE = `[DATE]

To: [SCHOOL'S SECTION 504 COORDINATOR, PRINCIPAL, OR SCHOOL CONTACT]
[SCHOOL OR DISTRICT NAME]
[SCHOOL OR DISTRICT ADDRESS OR EMAIL]

Subject: Request for a Section 504 evaluation for [CHILD'S FULL NAME], date of birth [DATE OF BIRTH], grade [GRADE]

Dear [NAME OR 504 TEAM],

I am the parent/guardian of [CHILD'S FULL NAME], who attends [SCHOOL NAME]. I am writing to request an evaluation under Section 504 of the Rehabilitation Act to determine whether my child has a disability and needs accommodations, aids, or services to have equal access to school.

My child has or may have [DIAGNOSIS, CONDITION, OR SUSPECTED DISABILITY]. This affects school and major life activities in the following ways: [DESCRIBE LEARNING, COMMUNICATION, CONCENTRATION, THINKING, SENSORY, EATING, SLEEPING, WALKING, BATHROOM, BREATHING, OR OTHER IMPACTS]. Examples include [ADD SPECIFIC EXAMPLES, DATES, ATTENDANCE INFORMATION, SCHOOLWORK, OR OBSERVATIONS].

Helpful supports may include [LIST POSSIBLE ACCOMMODATIONS OR SERVICES—FOR EXAMPLE, MOVEMENT BREAKS, A QUIET TESTING AREA, VISUAL DIRECTIONS, EXTRA PROCESSING TIME, COMMUNICATION SUPPORT, A SENSORY PLAN, OR HEALTH-RELATED SUPPORT]. I understand the school team will consider the individual evaluation information when deciding what is appropriate.

Please let me know in writing what information or consent you need, the school's evaluation process and timeline, and the date of any meeting. Please also provide a copy of the district's Section 504 procedural safeguards. If the school refuses this request, please give me written notice explaining the decision and the information considered.

I would like to participate in the evaluation and placement process. Please contact me in writing at [EMAIL OR MAILING ADDRESS] and at [PHONE NUMBER].

Thank you for working with me to support [CHILD'S FIRST NAME]'s access to school.

Sincerely,
[PARENT/GUARDIAN NAME]
[ADDRESS]
[EMAIL]
[PHONE]`;

function educationLink(url, title, description, tag = "") {
  return `<a class="education-link" href="${url}" target="_blank" rel="noopener noreferrer"><strong>${esc(title)} ↗</strong><span>${esc(description)}</span>${tag ? `<small>${esc(tag)}</small>` : ""}</a>`;
}

async function copyEducationTemplate(textarea, button) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(textarea.value);
    else {
      textarea.focus();
      textarea.select();
      if (!document.execCommand("copy")) throw new Error("Copy unavailable");
    }
    const old = button.textContent;
    button.textContent = "Copied!";
    setTimeout(() => (button.textContent = old), 1500);
  } catch {
    alert("Copy was blocked by this browser. Select the letter text and use Copy instead.");
  }
}

function renderEducationOptions() {
  view.innerHTML = `<section class="hero"><h1>🎓 Educational Options</h1><p>Understand the paths available and choose what fits your child and family.</p></section>
  <div class="banner education-note"><strong>A helpful starting point:</strong> There is no single best school setting for every autistic child. The right choice is the one that can support your child’s communication, regulation, safety, learning, and sense of belonging. Homeschool and private-school rules vary by state, so always confirm current requirements locally.</div>

  <h2 class="section-title">Choosing a learning setting</h2>
  <div class="education-sections">
    <details class="education-card" open><summary>🏡 Homeschooling an autistic child</summary><div class="education-body">
      <p>Homeschooling can offer a quieter environment, flexible pacing, shorter lessons, sensory breaks, interest-led learning, and the freedom to teach different subjects at different levels. It also places planning, recordkeeping, instruction, and much of the cost on the family.</p>
      <h3>Questions worth asking</h3><ul><li>Does your child learn better one-to-one, through movement, visually, or in short predictable sessions?</li><li>How will you support communication, occupational therapy, speech, social connection, physical activity, and life skills?</li><li>What records, notices, subjects, attendance, assessments, or portfolio does your state require?</li><li>Is the program truly homeschooling, or a public virtual school with public-school rules and services?</li></ul>
      <p>Start with your state’s education department. Federal special-education services available to independently homeschooled children can differ from those available in public school, and state rules matter.</p>
      <div class="education-links">${educationLink("https://www.ed.gov/birth-grade-12-education/education-choice/state-regulation-of-private-and-home-schools", "State home and private-school rules", "Choose your state and review its requirements.", "U.S. Department of Education")}</div>
    </div></details>

    <details class="education-card"><summary>🧩 Curriculum and teaching resources</summary><div class="education-body">
      <p>“Autism-friendly” is not one teaching style. Look for flexible subject levels, clear visual directions, predictable routines, multiple ways to answer, adjustable pacing, and lessons that connect with your child’s interests. Try samples before paying when possible.</p>
      <div class="education-links">
        ${educationLink("https://www.time4learning.com/", "Time4Learning", "A paid PreK–12 general homeschool curriculum with adjustable grade levels and parent planning tools.", "Complete curriculum • Commercial")}
        ${educationLink("https://www.n2y.com/unique-learning-system/accessible-content/", "Unique Learning System", "Standards-based differentiated academics and life-skills content for students with complex learning needs.", "Special education curriculum • Commercial")}
        ${educationLink("https://starautismprogram.com/curriculum/star-program", "STAR Program", "A structured autism-focused program covering communication, academics, routines, play, and social skills.", "Autism curriculum • Commercial • ABA-based")}
        ${educationLink("https://starautismprogram.com/curriculum/links-curriculum", "LINKS Curriculum", "School, community, vocational, and independence instruction for older learners.", "Older learners • Commercial • ABA-based")}
        ${educationLink("https://afirm.fpg.unc.edu/afirm-modules", "AFIRM Modules", "Step-by-step modules and downloadable materials for evidence-based autism practices.", "Free teaching support • Not a full core curriculum")}
        ${educationLink("https://autisminternetmodules.org/", "Autism Internet Modules", "Learning modules on communication, sensory needs, structured teaching, transitions, and other topics.", "Free learning resource • Not a full core curriculum")}
      </div><p class="hint">These links are starting points, not endorsements. Methods that work well for one child may not fit another, and prices or access can change.</p>
    </div></details>

    <details class="education-card"><summary>🏫 Private, alternative, and specialized schools</summary><div class="education-body">
      <p>Options may include autism-specific private schools, therapeutic schools, microschools, hybrid programs, Montessori-style settings, public charter or magnet schools, and public virtual schools. A smaller or specialized setting is not automatically a better fit—visit, observe, and ask direct questions.</p>
      <h3>What to check before enrolling</h3><ul><li>Staff training, class size, communication supports, sensory spaces, behavior approach, restraint and seclusion policies, and family communication.</li><li>Whether the school can provide speech, occupational therapy, AAC support, transportation, nursing, or other services your child needs.</li><li>Accreditation or state approval, tuition and fees, scholarships, refund rules, discipline policies, and how progress is measured.</li><li>Whether students earn a recognized diploma and how transitions back to public school or into adulthood are handled.</li></ul>
      <p>If a family places a child in private school by choice, the child may not have the same individual entitlement to IDEA services they would have in public school. The local district still has child-find responsibilities, so ask the district how evaluation and any available services work before enrolling.</p>
      <div class="education-links">${educationLink("https://nces.ed.gov/surveys/pss/privateschoolsearch/", "Search private schools", "Find private schools by location and program details; listing does not mean endorsement or accreditation.", "National Center for Education Statistics")}${educationLink("https://nces.ed.gov/ccd/schoolsearch/", "Search public schools", "Explore public, charter, magnet, virtual, alternative, and special-education schools.", "National Center for Education Statistics")}</div>
    </div></details>

    <details class="education-card"><summary>📘 Understanding an IEP</summary><div class="education-body">
      <p>An Individualized Education Program, or IEP, is a written plan under IDEA for an eligible student who needs specially designed instruction. It is built by a team that includes the parent. An IEP can include present levels, measurable goals, accommodations, specialized instruction, related services such as speech or occupational therapy, assistive technology, behavior supports, transportation, and how progress will be reported.</p>
      <p>A medical diagnosis does not automatically create an IEP, and good grades do not automatically rule one out. The school evaluates how the suspected disability affects educational needs, including functional needs. A parent can request an evaluation. Federal rules generally call for the initial evaluation within 60 days after parental consent unless the state uses its own timeline.</p>
      <h3>Useful public-school terms</h3><ul><li><strong>Child Find:</strong> the school system’s duty to identify, locate, and evaluate children who may need special education.</li><li><strong>FAPE:</strong> a free appropriate public education designed around the child’s individual needs.</li><li><strong>LRE:</strong> learning with nondisabled peers as much as is appropriate for the individual child.</li><li><strong>Prior Written Notice:</strong> the school’s written explanation when it proposes or refuses certain actions.</li><li><strong>Procedural safeguards:</strong> the family’s notice of rights, including records, consent, complaints, mediation, and due process.</li><li><strong>Independent Educational Evaluation:</strong> in certain circumstances, a parent who disagrees with the school’s evaluation may request an outside evaluation at public expense.</li></ul>
      <div class="education-links">${educationLink("https://sites.ed.gov/idea/parents-families/", "IDEA resources for parents and families", "Federal information about evaluations, IEPs, safeguards, and model forms.", "U.S. Department of Education")}${educationLink("https://www.parentcenterhub.org/find-your-center/", "Find your Parent Training and Information Center", "Locate a federally funded parent center for local guidance and training.", "Center for Parent Information and Resources")}</div>
    </div></details>

    <details class="education-card"><summary>📝 Understanding a 504 plan</summary><div class="education-body">
      <p>A Section 504 plan helps a qualified student with a disability have equal access to school. It may include accommodations, aids, and services such as a quieter testing space, visual directions, breaks, health supports, communication access, extra processing time, or changes to how work is completed.</p>
      <p>A 504 plan does not usually include the specially designed instruction and annual goals found in an IEP. Section 504 eligibility can be broader, and a student may qualify even when they do not need special education under IDEA. The school must use evaluation and placement procedures rather than relying on a diagnosis alone.</p>
      <div class="education-links">${educationLink("https://www.ed.gov/laws-and-policy/individuals-disabilities/section-504/civil-rights-of-students-hidden-disabilities-and-section-504", "Section 504 and students with disabilities", "Federal explanation of evaluation, placement, services, and parent rights.", "U.S. Department of Education Office for Civil Rights")}</div>
    </div></details>

    <details class="education-card"><summary>🧰 Other public-school supports to ask about</summary><div class="education-body"><ul><li>Speech-language, occupational therapy, physical therapy, counseling, nursing, transportation, orientation and mobility, or other related services when needed for education.</li><li>AAC and assistive-technology evaluation, devices, training, and access throughout the school day.</li><li>Visual schedules, sensory breaks, alternative seating, quiet spaces, communication supports, and staff training.</li><li>A Functional Behavioral Assessment and a positive Behavior Intervention Plan when behavior is interfering with learning or communicating an unmet need.</li><li>Extended School Year services when needed to provide FAPE—not simply because a child has a disability.</li><li>Transition planning for life after high school when the child reaches the age required by federal and state rules.</li><li>Your state’s Parent Training and Information Center, special-education complaint process, mediation, and Office for Civil Rights complaint information.</li></ul></div></details>
  </div>

  <h2 class="section-title">Letter templates</h2>
  <div class="banner"><strong>Before sending:</strong> Replace every item in brackets, add specific examples, keep a dated copy, and send it in a way you can document. District forms and timelines vary. These templates provide general educational information and are not legal advice.</div>
  <div class="education-templates">
    <details class="education-card"><summary>📄 Request an IDEA special-education evaluation</summary><div class="education-body"><p>This asks the school to evaluate whether your child is eligible for an IEP. Edit the letter directly below.</p><textarea id="iepLetter" class="template-letter" aria-label="Editable IDEA evaluation request letter">${esc(IEP_REQUEST_TEMPLATE)}</textarea><div class="btn-row"><button id="copyIepLetter" class="btn" type="button">Copy letter</button><button id="downloadIepLetter" class="btn secondary" type="button">Download .txt</button></div></div></details>
    <details class="education-card"><summary>📄 Request a Section 504 evaluation</summary><div class="education-body"><p>This asks the school to evaluate whether your child needs a 504 plan. Edit the letter directly below.</p><textarea id="plan504Letter" class="template-letter" aria-label="Editable Section 504 evaluation request letter">${esc(PLAN_504_REQUEST_TEMPLATE)}</textarea><div class="btn-row"><button id="copy504Letter" class="btn" type="button">Copy letter</button><button id="download504Letter" class="btn secondary" type="button">Download .txt</button></div></div></details>
  </div>`;

  const iep = $("#iepLetter"), plan504 = $("#plan504Letter");
  $("#copyIepLetter").onclick = (event) => copyEducationTemplate(iep, event.currentTarget);
  $("#copy504Letter").onclick = (event) => copyEducationTemplate(plan504, event.currentTarget);
  $("#downloadIepLetter").onclick = () => downloadBlob(new Blob([iep.value], { type: "text/plain;charset=utf-8" }), "IEP-Evaluation-Request-Template.txt");
  $("#download504Letter").onclick = () => downloadBlob(new Blob([plan504.value], { type: "text/plain;charset=utf-8" }), "Section-504-Evaluation-Request-Template.txt");
}

function renderAssessmentInformation() {
  const sourceLink = (url, title, description) =>
    `<a class="education-link" href="${url}" target="_blank" rel="noopener noreferrer"><strong>${esc(title)} ↗</strong><span>${esc(description)}</span></a>`;
  view.innerHTML = `<section class="hero"><h1>🧭 Autism Assessment Information</h1><p>A friendly walkthrough of what the process may look like from first concern to written report.</p></section>
  <div class="banner assessment-note"><strong>First, take a breath:</strong> An assessment is not a test your child has to pass. The goal is to understand how they communicate, learn, play, handle sensory input, and move through daily life—along with the support that may help them thrive.</div>

  <div class="assessment-quick card">
    <div><strong>18 & 24 months</strong><span>Routine autism screening ages</span></div>
    <div><strong>Any age</strong><span>Assessment when concerns exist</span></div>
    <div><strong>Several hours</strong><span>Common full-evaluation range</span></div>
  </div>
  <p class="hint assessment-range-note">These are general guideposts, not promises. The child’s age, needs, clinic, provider team, and required testing can change the timing.</p>

  <h2 class="section-title">Understanding the process</h2>
  <div class="education-sections assessment-sections">
    <details class="education-card" open><summary>🌱 How early can an assessment be done?</summary><div class="education-body">
      <p>You do not have to wait for a certain birthday to bring up a developmental concern. A pediatrician, early-intervention program, school system, or specialist can begin looking at a child’s development whenever a caregiver or professional is concerned.</p>
      <ul><li>The American Academy of Pediatrics recommends general developmental screening at 9, 18, and 30 months.</li><li>Autism-specific screening is recommended at 18 and 24 months.</li><li>Autism can sometimes be detected at 18 months or younger.</li><li>By age 2, a diagnosis made by an experienced professional can be considered reliable.</li><li>Older children, teenagers, and adults can also be assessed. There is no upper age limit.</li></ul>
      <p>A screening result does not diagnose autism. It helps decide whether a fuller evaluation would be useful. If you have concerns, you do not need to wait for the next routine screening age.</p>
    </div></details>

    <details class="education-card"><summary>🔎 Screening and assessment are different</summary><div class="education-body">
      <p><strong>Developmental monitoring</strong> is the everyday process of noticing how a child plays, learns, communicates, behaves, and moves.</p>
      <p><strong>Screening</strong> is a short questionnaire or structured check that looks for signs a closer evaluation may be needed. A screening may take only a few minutes and is often completed during a regular appointment. It cannot confirm or rule out autism by itself.</p>
      <p><strong>A diagnostic evaluation</strong> is a deeper look at developmental history, current behavior, communication, strengths, needs, and daily functioning. It uses information from caregivers plus direct professional observation. There is no blood test, brain scan, or single questionnaire that diagnoses autism.</p>
    </div></details>

    <details class="education-card"><summary>👥 Who may be involved?</summary><div class="education-body">
      <p>The assessment may be completed by one experienced clinician or a team. Depending on the child and the clinic, that could include a developmental-behavioral pediatrician, child psychologist or neuropsychologist, pediatric neurologist, child psychiatrist, speech-language pathologist, occupational therapist, or another trained professional.</p>
      <p>A larger team is not automatically better. What matters is that the clinician is qualified, considers more than one source of information, understands the child’s age and communication style, and explains how the conclusion was reached.</p>
    </div></details>

    <details class="education-card"><summary>📋 Before the appointment</summary><div class="education-body">
      <p>The clinic may send intake forms and questionnaires for caregivers, teachers, childcare providers, or therapists. Complete them honestly based on an ordinary day—there is no need to make strengths look smaller or challenges look larger.</p>
      <h3>Helpful things to gather</h3><ul><li>Birth, medical, developmental, and family history.</li><li>Previous evaluations, therapy reports, school records, IEP or 504 documents, and hearing or vision results.</li><li>A short timeline of milestones, concerns, changes, and any loss of previously used skills.</li><li>Examples from more than one setting, including videos when the clinic allows them.</li><li>A list of medications, diagnoses, allergies, and family questions.</li><li>The child’s usual AAC system, glasses, hearing devices, comfort item, snacks, drink, diapers or toileting supplies, and anything the clinic recommends.</li></ul>
      <p>Tell the clinic ahead of time about communication needs, mobility, elopement risk, feeding needs, sensory triggers, interpreter needs, or accommodations that could make the visit safer and more comfortable.</p>
    </div></details>

    <details class="education-card"><summary>🧸 What happens during the assessment?</summary><div class="education-body">
      <p>For a young child, much of the appointment may look like play. For an older child or adult, it may include conversation, pictures, stories, puzzles, or other structured activities. The clinician is watching how the person communicates, shares attention, responds socially, plays or imagines, handles changes, and uses repetitive movements or interests.</p>
      <p>The process may include:</p><ul><li>A detailed caregiver interview about early development and current daily life.</li><li>Direct observation using play- or conversation-based activities.</li><li>Autism-focused tools such as the ADOS-2, along with caregiver questionnaires or interviews. No single tool should decide the diagnosis alone.</li><li>Developmental, cognitive, learning, speech-language, motor, sensory, adaptive-living, attention, or emotional testing when appropriate.</li><li>Information from school, childcare, therapists, or other people who know the child.</li><li>A physical or neurological exam, hearing test, vision test, or discussion of genetic testing when clinically appropriate.</li></ul>
      <p>Your child does not need to perform perfectly. Do not rehearse answers or try to stop natural communication, movement, or stimming. If your child becomes tired or overwhelmed, ask for a break.</p>
    </div></details>

    <details class="education-card"><summary>⏱️ How long does it take?</summary><div class="education-body">
      <p>There is no dependable national average because clinics organize assessments differently.</p>
      <ul><li><strong>Brief screening:</strong> commonly 30 minutes or less and often part of another visit.</li><li><strong>Diagnostic appointment:</strong> commonly about 1½ to 4 hours, although broader testing can take longer.</li><li><strong>Multiple-visit evaluation:</strong> the interview, child observation, additional testing, and feedback may be split across two or more appointments.</li><li><strong>Results:</strong> some clinicians discuss an initial conclusion the same day; a full written report may take days or several weeks.</li><li><strong>Waiting for the first appointment:</strong> this is separate from testing time and can vary greatly by location, insurance, and provider availability.</li></ul>
      <p>Ask when scheduling: “How many visits should we expect, how long is each visit, when will feedback be given, and when should the written report be ready?”</p>
    </div></details>

    <details class="education-card"><summary>🧠 What the clinician is deciding</summary><div class="education-body">
      <p>The clinician compares all of the information with accepted diagnostic criteria. They are looking for a lifelong pattern involving social communication and interaction along with restricted or repetitive behavior, interests, routines, or sensory experiences—and whether those differences affect everyday life.</p>
      <p>They should also consider other explanations and co-occurring needs, such as language disorder, intellectual disability, ADHD, anxiety, hearing differences, learning disability, sleep problems, motor differences, trauma, or medical concerns. A child can be autistic and have one or more of these needs too.</p>
      <p>The result may be an autism diagnosis, another diagnosis, no diagnosis, or a need for more information or follow-up over time. Not receiving an autism diagnosis does not mean the caregiver imagined the concerns or that the child does not need support.</p>
    </div></details>

    <details class="education-card"><summary>📄 Feedback and the written report</summary><div class="education-body">
      <p>A good feedback visit should explain the conclusion in everyday language, describe the child’s strengths and support needs, answer questions, and provide practical next steps. Ask for a complete written report and review it for factual mistakes.</p>
      <h3>Questions to ask</h3><ul><li>What information supported the conclusion?</li><li>Were any results uncertain or affected by fatigue, anxiety, language, culture, or the unfamiliar setting?</li><li>What strengths stood out?</li><li>What needs should be addressed first?</li><li>Are speech, occupational therapy, AAC, hearing, medical, genetic, school, or other evaluations recommended?</li><li>Who can help us understand services, insurance requirements, and follow-up?</li><li>When should the child be reevaluated, if at all?</li></ul>
      <p>A medical autism diagnosis and school eligibility are related but separate. A school conducts its own educational evaluation to decide IDEA or Section 504 eligibility and school services.</p>
    </div></details>

    <details class="education-card"><summary>🫶 While you are waiting</summary><div class="education-body">
      <p>You do not need to wait for a final autism diagnosis to ask about help for a developmental concern.</p><ul><li>Talk with the child’s pediatrician and request developmental screening or referrals.</li><li>For a child under 3 in the United States, contact the state’s early-intervention program directly.</li><li>For a child age 3 or older, contact the local public-school system and request an educational evaluation—even if the child is not enrolled or not yet kindergarten age.</li><li>Address specific needs such as hearing, speech-language, feeding, motor, sleep, or safety concerns as referrals become available.</li><li>Keep notes about new skills, communication, sensory patterns, and concerns, but keep enjoying the child rather than turning every day into a test.</li></ul>
    </div></details>

    <details class="education-card"><summary>⚖️ When a second opinion may help</summary><div class="education-body">
      <p>Consider asking questions or seeking another qualified opinion if the assessment relied on only one checklist, ignored caregiver or school information, did not fit the person’s language or culture, dismissed concerns only because of eye contact or good grades, or did not explain the decision clearly.</p>
      <p>Insurance and program rules differ, so check coverage and referral requirements before arranging another private assessment. For disagreements with a school evaluation, the Educational Options section explains school rights and independent educational evaluations.</p>
    </div></details>
  </div>

  <h2 class="section-title">Trusted starting points</h2>
  <div class="education-links assessment-links">
    ${sourceLink("https://www.cdc.gov/autism/diagnosis/index.html", "CDC: Screening for Autism", "The steps from developmental monitoring and screening to a formal evaluation.")}
    ${sourceLink("https://www.cdc.gov/autism/about/index.html", "CDC: About Autism", "Age information, early identification, and how to contact early intervention or the school system.")}
    ${sourceLink("https://www.nichd.nih.gov/health/topics/autism/conditioninfo/diagnose", "NICHD: How providers diagnose autism", "An overview of screening, caregiver interviews, and comprehensive assessment.")}
    ${sourceLink("https://www.chop.edu/centers-programs/autism-integrated-care-program/your-childs-experience", "Children’s Hospital of Philadelphia: What to expect", "Examples of appointment length, providers, observation, and testing components.")}
  </div>
  <div class="banner assessment-disclaimer"><strong>Important:</strong> This guide offers general caregiver education. It cannot assess or diagnose a child, replace an individualized medical or developmental evaluation, or guarantee a clinic’s timing or process.</div>`;
}

function renderBenefitsInformation() {
  const benefitLink = (url, title, description, tag = "") =>
    `<a class="education-link" href="${url}" target="_blank" rel="noopener noreferrer"><strong>${esc(title)} ↗</strong><span>${esc(description)}</span>${tag ? `<small>${esc(tag)}</small>` : ""}</a>`;
  view.innerHTML = `<section class="hero"><h1>🤲 Benefits & Financial Support</h1><p>A calmer place to start when caregiving is stretching the family’s time, energy, and budget.</p></section>
  <div class="banner benefits-note"><strong>You are allowed to ask for help.</strong> Supporting a child with additional needs can affect work, childcare, transportation, food, housing, insurance, and the caregiver’s own health. Benefits are not a measure of how much you love your child, and using support does not take anything away from another family.</div>
  <div class="banner benefits-warning"><strong>Eligibility reminder:</strong> An autism diagnosis does not automatically approve a program. Each benefit uses its own disability, daily-functioning, financial, residency, age, and sometimes work-history rules. Dollar limits and tax rules change, and paid-family-caregiver rules vary by state.</div>

  <h2 class="section-title">A simple place to begin</h2>
  <ol class="benefits-start card"><li><strong>Check broad eligibility.</strong><span>Use the official federal benefit finder, then write down programs that might fit.</span></li><li><strong>Call your state disability and Medicaid systems.</strong><span>Ask specifically about developmental-disability services, HCBS waivers, self-direction, paid family caregivers, respite, family-support funds, and waiting lists.</span></li><li><strong>Explore Social Security.</strong><span>For a minor child, SSI is usually the first disability cash-benefit program to review. Apply even if you are unsure rather than guessing from an online discussion.</span></li><li><strong>Review taxes and workplace benefits.</strong><span>Save receipts and ask about credits, medical deductions, dependent-care benefits, FMLA, and state paid leave.</span></li></ol>
  <div class="education-links benefits-top-links">${benefitLink("https://www.usa.gov/benefit-finder", "USAGov Benefit Finder", "Answer questions to find federal and state benefits that may fit your household.", "Official government starting point")}${benefitLink("https://acl.gov/nwd/find-help", "Find disability help in your state", "Connect with your state’s No Wrong Door and disability-resource systems.", "Administration for Community Living")}</div>

  <h2 class="section-title">Benefits and support programs</h2>
  <div class="education-sections benefits-sections">
    <details class="education-card" open><summary>💜 Can a parent or family member be paid as the caregiver?</summary><div class="education-body">
      <p>Sometimes—but there is no single nationwide “paid parent caregiver” benefit. Most opportunities come through a state Medicaid home- and community-based services program, waiver, personal-care program, or self-directed service option.</p>
      <p>When self-direction is available, the person receiving services or their representative may be able to choose, hire, train, and supervise a worker. Some states allow a parent, spouse, or other legally responsible relative to be paid; others limit this, require an exception, or allow only certain relatives.</p>
      <h3>What eligibility may involve</h3><ul><li>The child qualifies for Medicaid or a Medicaid waiver and meets the program’s functional level-of-care rules.</li><li>An assessment documents hands-on supervision or personal-care needs beyond what is ordinarily expected for a child of the same age.</li><li>The service is authorized in a person-centered plan and funding is available.</li><li>The caregiver completes enrollment, background checks, training, timesheets, electronic visit verification, and payroll requirements.</li><li>The caregiver can be paid only for approved tasks and hours—not every hour spent parenting.</li></ul>
      <h3>Ask the state these exact questions</h3><ul><li>“Do you have an HCBS or developmental-disability waiver for children with autism?”</li><li>“Does it include self-directed personal care, participant direction, respite, or family-caregiver pay?”</li><li>“Can a legally responsible parent be the paid worker? If only under an exception, what qualifies?”</li><li>“Is there a waiting list, and can we join it before Medicaid eligibility is final?”</li><li>“Are there TEFRA, Katie Beckett, or other pathways that consider the child’s finances rather than the parents’ income?”</li></ul>
      <div class="education-links">${benefitLink("https://www.usa.gov/disability-caregiver", "Getting paid as a family caregiver", "Federal overview of Medicaid, paid leave, insurance, and caregiver programs.", "USAGov")}${benefitLink("https://www.medicaid.gov/medicaid/long-term-services-supports/self-directed-services", "Medicaid self-directed services", "How participant-directed services and individual budgets work.", "Centers for Medicare & Medicaid Services")}${benefitLink("https://www.medicaid.gov/about-us/where-can-people-get-help-medicaid-chip", "Find your state Medicaid agency", "Official state contacts for eligibility, applications, coverage, and renewals.", "Medicaid.gov")}</div>
    </div></details>

    <details class="education-card"><summary>💵 SSI for a child</summary><div class="education-body">
      <p><strong>Supplemental Security Income (SSI)</strong> is a needs-based monthly benefit. A child under 18 may qualify when they have a medically determinable condition that causes marked and severe functional limitations and is expected to last at least 12 months or result in death. The Social Security Administration also reviews household income and resources, including some parental income and resources while the child lives at home.</p>
      <p>Autism can qualify, but the diagnosis alone is not the decision. SSA looks at how the child functions compared with other children the same age across areas such as learning, communication, relationships, completing tasks, self-care, health, and physical abilities.</p>
      <h3>How to apply</h3><ol><li>Review SSA’s child Disability Starter Kit and gather the checklist items.</li><li>Start the child SSI process through SSA’s application page or call SSA for an appointment.</li><li>List every provider, therapist, school, evaluation, medication, and service with accurate contact information.</li><li>Describe the help, prompting, supervision, recovery time, safety support, and accommodations the child needs on an ordinary difficult day—not only their best day.</li><li>Return forms promptly, keep copies, and tell SSA about changes in income, resources, household, school, or medical care.</li></ol>
      <h3>Useful records</h3><ul><li>Diagnostic and developmental reports, therapy evaluations, medical records, medication lists, and hospital records.</li><li>IEP, IFSP, 504 plan, school evaluations, attendance, behavior or safety plans, teacher reports, and progress notes.</li><li>Caregiver examples showing frequency, duration, help required, and what happens without support.</li></ul>
      <p>If denied, read the notice carefully. Appeal deadlines are generally short, and starting a new application is not always the same as appealing the original decision. A disability attorney or qualified advocate may help, especially at later appeal stages.</p>
      <div class="education-links">${benefitLink("https://www.ssa.gov/ssi/eligibility", "SSI eligibility", "Current income, resource, and disability basics.", "Social Security Administration")}${benefitLink("https://www.ssa.gov/apply/ssi", "Apply for SSI", "Choose whether the application is for a child or adult and see current process information.", "Social Security Administration")}${benefitLink("https://www.ssa.gov/disability/disability_starter_kits.htm", "Child Disability Starter Kit", "SSA’s checklist, worksheet, and preparation guide.", "Social Security Administration")}</div>
    </div></details>

    <details class="education-card"><summary>🧾 SSI versus SSDI—and Disabled Adult Child benefits</summary><div class="education-body">
      <div class="benefit-compare"><div><strong>SSI</strong><span>Based on disability plus limited income and resources. It does not require the child to have worked. Parental finances can affect a minor child’s eligibility.</span></div><div><strong>SSDI</strong><span>Insurance based on a worker’s Social Security earnings record. A young child normally does not have their own work record for SSDI.</span></div></div>
      <p>A child may sometimes receive Social Security dependent or survivor benefits when a parent receives retirement or disability benefits or dies. Those are based on the parent’s record and are different from child SSI.</p>
      <p>At age 18, SSA uses adult disability rules for SSI and generally stops counting parental income under the child-deeming rules. Apply or complete the age-18 review on time even if the family’s income was previously too high.</p>
      <p>An unmarried adult whose disability began before age 22 may later qualify for <strong>Disabled Adult Child</strong> benefits—also called DAC or Childhood Disability Benefits—on the earnings record of a parent who is retired, disabled, or deceased. Despite the name, this is a Social Security benefit paid to an adult child. Marriage, work, and other rules can affect eligibility.</p>
      <p>Some people receive both SSDI or DAC and SSI when the Social Security payment is low enough and all SSI rules are met. SSDI is generally connected to Medicare after the applicable waiting period; SSI is commonly connected to Medicaid, but the exact Medicaid connection varies by state.</p>
      <div class="education-links">${benefitLink("https://www.ssa.gov/disability/eligibility", "SSDI eligibility", "Current disability and work-history rules.", "Social Security Administration")}${benefitLink("https://www.ssa.gov/faqs/en/questions/KA-02053.html", "Social Security benefits for children", "Dependent, student, survivor, and disability-related child benefits.", "Social Security Administration")}${benefitLink("https://www.ssa.gov/OP_Home/handbook/handbook.05/handbook-0518.html", "Disabled Adult Child requirements", "Rules for disability beginning before age 22 on a parent’s record.", "Social Security Administration")}</div>
    </div></details>

    <details class="education-card"><summary>🏥 Medicaid, CHIP, waivers, and services people miss</summary><div class="education-body">
      <p>Regular Medicaid or CHIP may cover healthcare based on household and state eligibility rules. Medicaid HCBS waivers and state-plan programs can add long-term supports such as respite, personal care, home modifications, community support, assistive technology, case management, and self-directed services.</p>
      <p>Some disability pathways allow a child to qualify even when parental income is too high for ordinary Medicaid. Names vary and may include Katie Beckett, TEFRA, institutional-deeming, medically needy, or a developmental-disability waiver. Availability, level-of-care rules, premiums, and waiting lists differ by state.</p>
      <h3>Also ask about</h3><ul><li><strong>EPSDT:</strong> Medicaid’s comprehensive benefit for enrolled people under 21, including medically necessary screening, diagnostic, and treatment services within federal coverage rules.</li><li>Non-emergency medical transportation, case management, disposable medical supplies, AAC, durable medical equipment, therapies, and insurance appeal help.</li><li>State developmental-disability eligibility separate from Medicaid. Applying can open access to service coordination, respite, family-support funds, recreation, or future adult services.</li><li>Joining waiver waiting lists early. Some waits are long, and current needs may change before a slot becomes available.</li></ul>
      <div class="education-links">${benefitLink("https://www.medicaid.gov/medicaid/home-community-based-services", "Medicaid home- and community-based services", "Federal overview of supports delivered in homes and communities.", "Medicaid.gov")}${benefitLink("https://acl.gov/nwd/find-help", "Find state disability-resource contacts", "State and local systems that help families navigate disability services.", "Administration for Community Living")}</div>
    </div></details>

    <details class="education-card"><summary>🫶 Respite and family-support funds</summary><div class="education-body">
      <p>Respite provides temporary care so a caregiver can rest, handle appointments, spend time with other family members, or simply recover. It may be offered through Medicaid waivers, state developmental-disability agencies, Lifespan Respite programs, family-support grants, nonprofit organizations, faith communities, or employer benefits.</p>
      <p>Ask whether there are planned and emergency respite options, provider lists, reimbursement programs, summer or after-school supports, and grants for safety equipment, adaptive recreation, transportation, or home modifications.</p>
      <div class="education-links">${benefitLink("https://acl.gov/programs/support-caregivers/lifespan-respite-care-program", "Lifespan Respite Care", "Information about state systems supporting planned and emergency caregiver breaks.", "Administration for Community Living")}${benefitLink("https://acl.gov/help", "Disability Information and Access Locator", "Help finding local disability, transportation, housing, legal, and community-living resources.", "Administration for Community Living")}</div>
    </div></details>

    <details class="education-card"><summary>🧮 Federal tax credits and deductions to review</summary><div class="education-body">
      <p>Tax rules change yearly, and autism does not automatically meet every tax definition of disability. Keep receipts and discuss your specific facts with a qualified tax professional or a free IRS-certified tax-preparation site.</p>
      <ul><li><strong>Child Tax Credit or Credit for Other Dependents:</strong> depends on age, dependency, identification-number, residency, support, and income rules.</li><li><strong>Child and Dependent Care Credit:</strong> may apply to qualifying care expenses that allow a caregiver to work or look for work. A dependent under 13 may qualify under the age rule; an older dependent may qualify if incapable of self-care and the other requirements are met.</li><li><strong>Earned Income Tax Credit:</strong> a qualifying child who is permanently and totally disabled can meet the EITC age test at any age, but all other EITC and disability-definition rules still apply.</li><li><strong>Medical expense deduction:</strong> when itemizing, eligible unreimbursed expenses above the applicable threshold may include certain evaluations, therapies, prescribed equipment, medical travel, and—in narrow circumstances—special education when medical care is the principal reason.</li><li><strong>Dependent Care FSA, HSA, or health FSA:</strong> employer plans may provide tax advantages, but reimbursement rules and eligible expenses differ.</li></ul>
      <p>Do not claim the same expense twice through a tax credit, deduction, FSA, HSA, insurance reimbursement, or another program.</p>
      <div class="education-links">${benefitLink("https://www.irs.gov/newsroom/tax-benefits-for-parents-and-families", "Tax benefits for parents and families", "Current overview of family credits and basic eligibility.", "Internal Revenue Service")}${benefitLink("https://www.irs.gov/credits-deductions/individuals/child-and-dependent-care-credit-information", "Child and Dependent Care Credit", "Eligibility, qualifying people, care providers, and Form 2441.", "Internal Revenue Service")}${benefitLink("https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit/disability-and-the-earned-income-tax-credit-eitc", "Disability and the EITC", "How disability affects qualifying-child age rules and documentation.", "Internal Revenue Service")}${benefitLink("https://www.irs.gov/publications/p502", "Publication 502: Medical expenses", "Detailed rules for medical deductions, travel, equipment, therapy, and special education.", "Internal Revenue Service")}${benefitLink("https://www.irs.gov/individuals/free-tax-return-preparation-for-qualifying-taxpayers", "Free IRS-certified tax preparation", "Find VITA or TCE help if the household meets program requirements.", "Internal Revenue Service")}</div>
    </div></details>

    <details class="education-card"><summary>🌱 ABLE accounts and planning without disrupting benefits</summary><div class="education-body">
      <p>An ABLE account is a tax-advantaged account for qualified disability expenses such as education, housing, transportation, health, assistive technology, employment support, and personal-support services. Beginning in 2026, eligibility generally requires that the disability began before age 46—not that the account was opened before that age.</p>
      <p>A person does not always have to receive SSI or SSDI to qualify; a disability certification may be another path. Contributions are not generally deductible on a federal return, but qualified withdrawals can be tax-free. Up to $100,000 in an ABLE account is generally excluded from the SSI resource calculation, with additional rules for balances and withdrawals.</p>
      <p>For larger gifts, inheritances, settlements, or lifelong planning, talk with a qualified special-needs or elder-law attorney before placing money directly in the child’s name. A properly designed special-needs trust may protect eligibility differently from an ordinary account or trust.</p>
      <div class="education-links">${benefitLink("https://www.irs.gov/newsroom/able-savings-accounts-and-other-tax-benefits-for-persons-with-disabilities", "ABLE account overview", "Qualified expenses, tax treatment, and contribution information.", "Internal Revenue Service")}${benefitLink("https://secure.ssa.gov/poms.NSF/lnx/0501130740", "ABLE accounts and SSI", "Current SSA rules for balances and distributions.", "Social Security Administration")}</div>
    </div></details>

    <details class="education-card"><summary>🧑‍💼 Work leave and employer benefits</summary><div class="education-body">
      <p>Eligible employees of covered employers may use federal FMLA leave for qualifying care connected to a serious health condition. FMLA is generally job-protected and unpaid, although employer-provided paid leave may run at the same time. State paid-family-leave programs can provide pay in some locations.</p>
      <p>Ask human resources about intermittent FMLA for appointments or flare-ups, state paid leave, donated leave, flexible scheduling, remote-work policies, Employee Assistance Programs, dependent-care FSAs, health FSAs, and caregiver-resource benefits. Request forms early and keep copies.</p>
      <div class="education-links">${benefitLink("https://www.dol.gov/agencies/whd/fmla", "Family and Medical Leave Act", "Eligibility, covered employers, qualifying reasons, and how leave works.", "U.S. Department of Labor")}${benefitLink("https://www.dol.gov/agencies/whd/fact-sheets/28k-fmla-adult-children", "FMLA and an adult child with a disability", "When a parent may use leave to care for an adult son or daughter.", "U.S. Department of Labor")}</div>
    </div></details>

    <details class="education-card"><summary>🥕 Food, housing, utilities, and everyday expenses</summary><div class="education-body">
      <p>Disability-related costs can squeeze a family even when income looks too high for one program. Check each program rather than assuming the answer.</p><ul><li>SNAP for groceries; WIC for eligible pregnant/postpartum caregivers and young children.</li><li>TANF or state cash assistance, childcare subsidies, school meal programs, and summer food programs.</li><li>LIHEAP or state utility assistance, Lifeline phone/internet support, housing programs, and local emergency aid.</li><li>Medicaid transportation, reduced-fare transit, accessible parking when medically appropriate, and nonprofit transportation help.</li><li>211 and local community-action agencies for food, rent, utilities, diapers, transportation, and emergency referrals.</li></ul>
      <div class="education-links">${benefitLink("https://www.usa.gov/benefit-finder", "Federal benefit finder", "Search for food, housing, healthcare, disability, and family benefits.", "USAGov")}${benefitLink("https://www.ssa.gov/ssi/get-more-help", "Programs that may accompany SSI", "SSA overview of Medicaid, SNAP, TANF, PASS, and ABLE.", "Social Security Administration")}</div>
    </div></details>

    <details class="education-card"><summary>📁 Make applications easier to manage</summary><div class="education-body">
      <ul><li>Create one benefits folder with applications, case numbers, notices, deadlines, login information, and copies of everything submitted.</li><li>Keep a contact log with the date, agency, representative’s name, phone number, and what was promised.</li><li>Use specific examples of the help the child needs, how often, how long it takes, what happens without help, and how needs compare with a same-age child.</li><li>Open every notice immediately. Approval, renewal, information-request, and appeal deadlines can be short.</li><li>Report required changes and keep proof. Overpayments can happen when income, resources, living arrangements, work, school, or household changes are not reported.</li><li>Be cautious of anyone promising guaranteed approval or “free government money.” Use official application sites and verify fees before sharing personal information.</li></ul>
    </div></details>
  </div>
  <div class="banner benefits-disclaimer"><strong>Important:</strong> This section provides general U.S. caregiver education, not legal, tax, benefits, or financial advice. Program rules change. Confirm current requirements with the administering agency and a qualified professional who can review your family’s circumstances.</div>`;
}

async function renderCaregiver() {
  const appointments = await getAll("appointments"),
    todos = await getAll("todos"),
    activeTodos = todos.filter((item) => !item.completed).length,
    upcoming = appointments.filter((item) => item.date >= isoToday()).length;
  view.innerHTML = `<section class="hero"><h1>💛 Caregiver Corner</h1><p>Support, organization, and clear information for the caregiver.</p></section>
  <h2 class="section-title">Caregiver support</h2>
  <div class="grid">
    <button id="caregiverEncouragement" class="card-button"><strong>💬 Encouragement</strong><small>Weekly messages and strength-focused reminders.</small></button>
    <button id="caregiverTerms" class="card-button"><strong>📖 Common terms</strong><small>Plain-language explanations of autism and sensory terminology.</small></button>
    <button id="caregiverEducation" class="card-button"><strong>🎓 Educational options</strong><small>Homeschooling, school choices, IEPs, 504 plans, resources, and letter templates.</small></button>
    <button id="caregiverAssessment" class="card-button"><strong>🧭 Autism assessment information</strong><small>When assessment can begin, how it works, what to bring, and what to expect.</small></button>
    <button id="caregiverBenefits" class="card-button"><strong>🤲 Benefits & financial support</strong><small>Paid caregiving, SSI and SSDI, Medicaid, tax help, respite, and overlooked resources.</small></button>
    <button id="caregiverCalendar" class="card-button"><strong>📅 Calendar</strong><small>${upcoming} upcoming ${upcoming === 1 ? "appointment" : "appointments"}.</small></button>
    <button id="caregiverTodos" class="card-button"><strong>✅ To-do list</strong><small>${activeTodos} active ${activeTodos === 1 ? "task" : "tasks"}.</small></button>
    <button class="card-button future-feature" data-feature="Reflection"><strong>📝 Reflection</strong><small>Private notes and observations.</small></button>
    <button class="card-button future-feature" data-feature="Support messaging"><strong>🤝 Support messaging</strong><small>A future premium support option with clear boundaries.</small></button>
  </div>`;
  $("#caregiverEncouragement").onclick = openWeeklyEncouragement;
  $("#caregiverTerms").onclick = openTermsGuide;
  $("#caregiverEducation").onclick = () => navigate("education");
  $("#caregiverAssessment").onclick = () => navigate("assessment");
  $("#caregiverBenefits").onclick = () => navigate("benefits");
  $("#caregiverCalendar").onclick = openCaregiverCalendar;
  $("#caregiverTodos").onclick = () => openTodoList("active");
  document
    .querySelectorAll(".future-feature")
    .forEach((b) => (b.onclick = () => underConstruction(b.dataset.feature)));
}

function openTermsGuide() {
  const renderTermMedia = ({ term, media }) => {
    if (!media.image && !media.clip) return "";
    const image = media.image
      ? `<img class="term-media-image" src="${esc(media.image)}" alt="${esc(media.alt || `${term} example`)}" loading="lazy" decoding="async">`
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
    modalBody.innerHTML = `<h2>📖 Common terms</h2><p class="hint">Friendly, plain-language explanations to help you make sense of words you may hear. They are not a diagnosis or a replacement for guidance from someone who knows your child.</p><div class="field"><label>Search terms</label><input id="termSearch" type="search" value="${esc(query)}" placeholder="Try stimming, sensory, or echolalia"></div><div class="terms-list">${shown.map((item) => `<details class="term-card"><summary>${esc(item.term)}</summary><p>${esc(item.explanation)}</p>${renderTermMedia(item)}</details>`).join("") || '<div class="empty"><p>No terms match that search.</p></div>'}</div>`;
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
  modalBody.innerHTML = `<h2>Restore preview</h2><div class="card"><p><strong>Created:</strong> ${fmtDate(b.exportedAt)}</p><p><strong>App version:</strong> ${esc(b.appVersion)}</p><p><strong>Profiles:</strong> ${b.data.profiles.length}</p><p><strong>Achievements:</strong> ${b.data.achievements.length}</p><p><strong>Speech & Language entries:</strong> ${b.data.words.length}</p><p><strong>Potty-training days:</strong> ${(b.data.pottyLogs || []).length}</p><p><strong>Appointments:</strong> ${(b.data.appointments || []).length}</p><p><strong>To-do items:</strong> ${(b.data.todos || []).length}</p><p><strong>Notes:</strong> ${b.data.notes.length}</p></div><div class="banner" style="margin-top:12px">A safety checkpoint will be created before current data changes.</div><div class="btn-row"><button id="replaceRestore" type="button" class="btn danger">Replace current data</button><button id="mergeRestore" type="button" class="btn secondary">Merge safely</button></div>`;
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
  view.innerHTML = `<section class="hero"><h1>💾 Backup & Restore</h1><p>Your family data stays on this device unless you export it yourself.</p></section><h2 class="section-title">Complete local backup</h2><div class="card"><p>Exports profiles, achievements, communication entries, potty-training records, caregiver tools, notes, and settings into one versioned file.</p><div class="btn-row"><button id="exportBtn" class="btn">Export complete backup</button><button id="restoreBtn" class="btn secondary">Restore from file</button></div><p class="hint">Last manual backup: ${last ? fmtDate(last) : "None yet"}</p></div><h2 class="section-title">Safety checkpoints</h2><div class="card"><p>The app keeps up to five internal checkpoints before risky operations.</p><div class="btn-row"><button id="checkpointBtn" class="btn secondary">Create checkpoint now</button></div><p class="hint">Saved checkpoints: ${snaps.length}</p></div><div class="banner" style="margin-top:18px"><strong>Important:</strong> Removing the PWA or clearing browser storage can erase local data. Export backups regularly and store copies somewhere safe.</div>`;
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
  view.innerHTML = `<section class="hero"><h1>⚙️ Settings</h1><p>Choose how profiles and speech filters work for your family.</p></section><div class="card settings-card"><h3>Profile card display</h3><div class="field"><label>Show beneath the child’s name</label><select id="profileDisplay"><option value="birthDate" ${profileDisplay === "birthDate" ? "selected" : ""}>Birth date</option><option value="years" ${profileDisplay === "years" ? "selected" : ""}>Age in whole years — 2 yo</option><option value="yearsMonths" ${profileDisplay === "yearsMonths" ? "selected" : ""}>Age in years and months — 2 years 3 months</option><option value="exact" ${profileDisplay === "exact" ? "selected" : ""}>Live exact age — years, months, days, hours, minutes, seconds</option><option value="none" ${profileDisplay === "none" ? "selected" : ""}>Nothing</option></select></div><button id="saveProfileDisplay" class="btn" type="button">Save profile display</button></div><div class="card settings-card"><h3>Speech & Language filter defaults</h3><p class="hint">These choices load when the tracker opens and whenever Clear filters is pressed.</p><div class="form-grid settings-filter-grid"><div class="field"><label>Child</label><select id="defaultVocabProfile"><option value="all">All children</option>${profiles.map((p) => `<option value="${p.id}" ${d.profile === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div><div class="field"><label>Default search</label><input id="defaultVocabSearch" type="search" value="${esc(d.search || "")}" placeholder="Blank shows everything"></div><div class="field"><label>Category</label><select id="defaultVocabCategory"><option value="">All categories</option>${categories.map((c) => `<option ${d.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div><div class="field"><label>Sort</label><select id="defaultVocabSort"><option value="alpha" ${d.sort === "alpha" ? "selected" : ""}>Alphabetical</option><option value="category" ${d.sort === "category" ? "selected" : ""}>Category</option><option value="newest" ${d.sort === "newest" ? "selected" : ""}>Date first said — newest</option><option value="oldest" ${d.sort === "oldest" ? "selected" : ""}>Date first said — oldest</option></select></div><div class="field"><label>Year</label><input id="defaultVocabYear" type="number" min="1900" max="2100" inputmode="numeric" value="${esc(d.year || "")}" placeholder="All years"></div><div class="field"><label>Month</label><select id="defaultVocabMonth"><option value="">All months</option>${Array.from(
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
  view.innerHTML = `<section class="hero"><h1>About More than Measured</h1><p>A strengths-first autism caregiver village.</p></section><div class="card" style="margin-top:18px"><h3>Our purpose</h3><p>To help caregivers celebrate progress, understand how their child learns and communicates, and find practical support without judgment or comparison.</p></div><div class="card" style="margin-top:12px"><h3>Important disclaimer</h3><p>This app is for caregiver education, organization, and support. It does not diagnose, treat, or replace advice from qualified medical, developmental, educational, or legal professionals.</p></div>`;
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
    ["🗣️", "Speech & Language", "speech"],
    ["📚", "Skill Building", "skills"],
    ["📚", "Resources", "resources"],
    ["🗺️", "Explore", "explore"],
    ["💛", "Caregiver Corner", "caregiver"],
    ["💾", "Backup & Restore", "backup"],
    ["⚙️", "Settings", "settings"],
    ["ℹ️", "About", "about"],
  ];
  $("#drawerNav").innerHTML = links
    .map((x) => `<button data-go="${x[2]}">${x[0]} ${x[1]}</button>`)
    .join("");
  $("#drawerVersion").textContent = APP.version;
  bindRouteButtons();
  $("#menuBtn").onclick = openDrawer;
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
  setupDrawer();
  setupPWA();
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
  navigate(location.hash.slice(1) || "home");
}
init().catch((err) => {
  view.innerHTML = `<div class="banner"><strong>Startup error:</strong> ${esc(err.message)}</div>`;
});
