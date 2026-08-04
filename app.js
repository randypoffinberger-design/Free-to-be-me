"use strict";

const APP = { name: "More than Measured", version: "0.6.6", schemaVersion: 2 };
const DB_NAME = "ftbm-db",
  DB_VERSION = 2,
  STORE_NAMES = [
    "profiles",
    "achievements",
    "words",
    "notes",
    "appointments",
    "todos",
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
    <button class="home-hotspot learning" data-feature="Skill Building" aria-label="Open Skill Building"><span>Skill Building</span></button>
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
        selected.some((k) => capabilityValue(x, k)) &&
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
      sentenceId = item?.id || uid();
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
      notes: $("#sentenceNotes").value.trim(),
      createdAt: item?.createdAt || nowISO(),
      updatedAt: nowISO(),
      syncStatus: "local",
    });
    for (const word of speak ? missing : [])
      await put("words", {
        id: uid(),
        entryType: "word",
        profileId,
        word,
        date: speakDate,
        category: "Uncategorized",
        additionalCategories: [],
        speak: true,
        identify: false,
        asl: false,
        speakDate,
        identifyDate: "",
        aslDate: "",
        languages: [],
        notes: "Added automatically from a sentence.",
        derivedFromSentenceId: sentenceId,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        syncStatus: "local",
      });
    modal.close();
    alert(
      speak && missing.length
        ? `Sentence saved. ${missing.length} new individual ${missing.length === 1 ? "word was" : "words were"} added.`
        : speak ? "Sentence saved. Every word was already in the individual word list." : "ASL sentence saved.",
    );
    renderVocabulary();
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
    modalBody.innerHTML = `<h2>Review import</h2><p><strong>${fresh.length}</strong> ready • ${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped • ${invalid} invalid or unread line${invalid === 1 ? "" : "s"}</p><p class="hint">Entry type: ${esc(entryType[0].toUpperCase() + entryType.slice(1))} • Categories: ${[category, ...additionalCategories].map(esc).join(", ")} • ${[speak ? "Speak" : "", identify ? "Identify" : "", asl ? "ASL" : ""].filter(Boolean).join(", ") || "No abilities selected"}</p><div class="import-preview">${fresh.map((x) => `<div class="preview-row"><strong>${esc(x.word)}</strong><span>${fmtDate(x.date)}</span></div>`).join("") || "<p>No new entries were found.</p>"}</div><div class="btn-row"><button id="backBulk" class="btn secondary" type="button">Go back</button>${fresh.length ? '<button id="importBulk" class="btn" type="button">Import reviewed entries</button>' : ""}</div>`;
    $("#backBulk").onclick = () =>
      openBulkVocabulary(profiles, existing, categories);
    if (fresh.length)
      $("#importBulk").onclick = async () => {
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
              knownWords.add(sentenceWordKey(word));
              addedSentenceWords++;
              await put("words", {
                id: uid(),
                entryType: "word",
                profileId,
                word,
                date: x.date,
                category: "Uncategorized",
                additionalCategories: [],
                speak: true,
                identify: false,
                asl: false,
                speakDate: x.date,
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
const CAREGIVER_TERMS = [
  [
    "AAC",
    "Augmentative and Alternative Communication. Any tool that supports communication beyond speech, including picture boards, sign language, and speech-generating devices. AAC does not prevent speech development.",
  ],
  [
    "Autistic burnout",
    "Deep physical, mental, and emotional exhaustion caused by prolonged stress, demands, masking, or sensory strain. Recovery often requires reduced demands, rest, predictability, and meaningful support.",
  ],
  [
    "Dysregulation",
    "A state where the nervous system is having difficulty managing emotions, sensory input, or demands. Behavior during dysregulation is communication, not simply disobedience.",
  ],
  [
    "Echolalia",
    "Repeating words or phrases heard from other people, shows, songs, or earlier experiences. It may be immediate or delayed and can serve purposes such as communication, processing, comfort, or practice.",
  ],
  [
    "Elopement",
    "Leaving a safe area or caregiver unexpectedly, often to reach something interesting or escape distress. It is a safety concern that calls for prevention, supervision, and understanding the reason behind it.",
  ],
  [
    "Executive functioning",
    "Skills used to begin tasks, plan, organize, shift attention, remember steps, control impulses, and manage time. A child may understand what to do but still need support getting started or completing it.",
  ],
  [
    "Gestalt language processing",
    "A way some people learn language in larger chunks or scripts before breaking them into smaller flexible words and phrases. Echolalia can be part of this language-development path.",
  ],
  [
    "Interoception",
    "The sense that notices signals inside the body, such as hunger, thirst, pain, temperature, needing the bathroom, or a racing heart. These signals may be noticed late, intensely, or inconsistently.",
  ],
  [
    "Joint attention",
    "Two people sharing attention toward the same object or experience. It can involve looking, pointing, sounds, body movement, or bringing an item—not only eye contact.",
  ],
  [
    "Masking",
    "Hiding or suppressing autistic traits to appear more neurotypical, sometimes by forcing eye contact, copying social behavior, or holding back stims. Masking can be exhausting and may contribute to anxiety or burnout.",
  ],
  [
    "Meltdown",
    "An involuntary loss of control caused by overwhelming sensory input, emotions, demands, communication difficulty, or accumulated stress. It is not manipulation or a chosen behavior; safety and reduced demands come first.",
  ],
  [
    "Neurodiversity",
    "The idea that brains naturally vary in how they process, learn, communicate, and experience the world. Neurodiversity recognizes differences while still acknowledging disability and support needs.",
  ],
  [
    "Proprioception",
    "The body-awareness sense coming from muscles and joints. Activities involving pushing, pulling, climbing, jumping, or deep pressure may help some children feel organized and regulated.",
  ],
  [
    "Scripting",
    "Using memorized lines, songs, or dialogue to communicate, process an experience, play, or self-regulate. Scripts can carry real meaning even when the wording comes from somewhere else.",
  ],
  [
    "Sensory avoider",
    "Someone who is especially sensitive to certain sounds, lights, textures, smells, tastes, touch, or movement and may try to escape or reduce that input.",
  ],
  [
    "Sensory overload",
    "When incoming sensory information becomes more than the nervous system can process. Signs may include covering ears, fleeing, crying, shutting down, aggression, or a meltdown.",
  ],
  [
    "Sensory seeker",
    "Someone who actively looks for stronger sensory input, such as spinning, crashing, chewing, touching, loud sounds, or constant movement. Safe alternatives can help meet the underlying need.",
  ],
  [
    "Shutdown",
    "An involuntary inward response to overwhelm that may involve becoming very quiet, unable to speak or move, sleepy, withdrawn, or less responsive. A shutdown needs time, safety, and reduced pressure.",
  ],
  [
    "Special interest",
    "A deeply focused interest that can bring joy, comfort, knowledge, motivation, and connection. Special interests can also be powerful tools for learning and relationship-building.",
  ],
  [
    "Stimming",
    "Self-stimulatory movement, sound, or behavior—such as rocking, hand movements, humming, pacing, or repeating sounds—that may help with regulation, expression, focus, or sensory needs. Safe stims generally do not need to be stopped.",
  ],
  [
    "Support levels",
    "Clinical autism levels describe the amount of support a person currently needs: Level 1 requires support, Level 2 substantial support, and Level 3 very substantial support. Needs can differ by skill, setting, stress, and time; a level does not define intelligence or potential.",
  ],
  [
    "Tantrum",
    "A goal-directed expression of frustration that usually eases when the goal is met or the audience changes. This differs from a meltdown, which is an involuntary response to overwhelm and does not simply stop when a demand is granted.",
  ],
  [
    "Vestibular sense",
    "The movement-and-balance sense centered in the inner ear. Swinging, spinning, climbing, and changes in head position affect this system; children may seek or avoid this input.",
  ],
];

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
    <button id="caregiverCalendar" class="card-button"><strong>📅 Calendar</strong><small>${upcoming} upcoming ${upcoming === 1 ? "appointment" : "appointments"}.</small></button>
    <button id="caregiverTodos" class="card-button"><strong>✅ To-do list</strong><small>${activeTodos} active ${activeTodos === 1 ? "task" : "tasks"}.</small></button>
    <button class="card-button future-feature" data-feature="Reflection"><strong>📝 Reflection</strong><small>Private notes and observations.</small></button>
    <button class="card-button future-feature" data-feature="Support messaging"><strong>🤝 Support messaging</strong><small>A future premium support option with clear boundaries.</small></button>
  </div>`;
  $("#caregiverEncouragement").onclick = openWeeklyEncouragement;
  $("#caregiverTerms").onclick = openTermsGuide;
  $("#caregiverCalendar").onclick = openCaregiverCalendar;
  $("#caregiverTodos").onclick = () => openTodoList("active");
  document
    .querySelectorAll(".future-feature")
    .forEach((b) => (b.onclick = () => underConstruction(b.dataset.feature)));
}

function openTermsGuide() {
  const draw = (query = "") => {
    const q = wordKey(query),
      shown = CAREGIVER_TERMS.filter(([term, explanation]) =>
        wordKey(`${term} ${explanation}`).includes(q),
      );
    modalBody.innerHTML = `<h2>📖 Common terms</h2><p class="hint">These descriptions are educational and strengths-aware. They do not diagnose a child or replace guidance from qualified professionals.</p><div class="field"><label>Search terms</label><input id="termSearch" type="search" value="${esc(query)}" placeholder="Try stimming, sensory, or echolalia"></div><div class="terms-list">${shown.map(([term, explanation]) => `<details class="term-card"><summary>${esc(term)}</summary><p>${esc(explanation)}</p></details>`).join("") || '<div class="empty"><p>No terms match that search.</p></div>'}</div>`;
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
  modalBody.innerHTML = `<h2>Restore preview</h2><div class="card"><p><strong>Created:</strong> ${fmtDate(b.exportedAt)}</p><p><strong>App version:</strong> ${esc(b.appVersion)}</p><p><strong>Profiles:</strong> ${b.data.profiles.length}</p><p><strong>Achievements:</strong> ${b.data.achievements.length}</p><p><strong>Speech & Language entries:</strong> ${b.data.words.length}</p><p><strong>Appointments:</strong> ${(b.data.appointments || []).length}</p><p><strong>To-do items:</strong> ${(b.data.todos || []).length}</p><p><strong>Notes:</strong> ${b.data.notes.length}</p></div><div class="banner" style="margin-top:12px">A safety checkpoint will be created before current data changes.</div><div class="btn-row"><button id="replaceRestore" type="button" class="btn danger">Replace current data</button><button id="mergeRestore" type="button" class="btn secondary">Merge safely</button></div>`;
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
  view.innerHTML = `<section class="hero"><h1>💾 Backup & Restore</h1><p>Your family data stays on this device unless you export it yourself.</p></section><h2 class="section-title">Complete local backup</h2><div class="card"><p>Exports profiles, achievements, words, notes, and settings into one versioned file.</p><div class="btn-row"><button id="exportBtn" class="btn">Export complete backup</button><button id="restoreBtn" class="btn secondary">Restore from file</button></div><p class="hint">Last manual backup: ${last ? fmtDate(last) : "None yet"}</p></div><h2 class="section-title">Safety checkpoints</h2><div class="card"><p>The app keeps up to five internal checkpoints before risky operations.</p><div class="btn-row"><button id="checkpointBtn" class="btn secondary">Create checkpoint now</button></div><p class="hint">Saved checkpoints: ${snaps.length}</p></div><div class="banner" style="margin-top:18px"><strong>Important:</strong> Removing the PWA or clearing browser storage can erase local data. Export backups regularly and store copies somewhere safe.</div>`;
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
