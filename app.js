"use strict";

const APP = { name: "More than Measured", version: "0.8.9", schemaVersion: 3 };
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
  vocabSessionFilters = null,
  currentRoute = "",
  routeStack = [],
  birthdayGreetingsShown = false;
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
  safety: renderSafetyInformation,
  therapy: renderTherapyInformation,
  sleep: renderSleepSanctuary,
  health: renderHealthWellness,
  sensory: renderSensorySupport,
  fun: renderAsdFriendlyFunExpanded,
  food: renderFoodDiary,
  lifeSkills: renderLifeSkills,
  resources: renderResources,
  explore: renderExplore,
  caregiver: renderCaregiver,
  backup: renderBackup,
  about: renderAbout,
  settings: renderSettings,
};
async function navigate(r, options = {}) {
  let route;
  if (options.back) {
    if (routeStack.length > 1) routeStack.pop();
    else routeStack = ["home"];
    route = routeStack[routeStack.length - 1] || "home";
  } else {
    route = routes[r] ? r : "home";
    if (route !== currentRoute) routeStack.push(route);
  }
  if (profileAgeTimer) {
    clearInterval(profileAgeTimer);
    profileAgeTimer = null;
  }
  document.body.classList.toggle("home-route", route === "home");
  currentRoute = route;
  await routes[route]();
  $("#backBtn").classList.toggle("hidden", route === "home");
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
  view.innerHTML = `<section class="illustrated-home" aria-label="More than Measured trademark home navigation">
    <img src="assets/home/homepage.jpeg" alt="More than Measured trademark — celebrating every child’s unique journey" width="864" height="1536">
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
    <button class="card-button speech-guide" data-guide="products"><span class="emoji">🛍️</span><strong>Communication products</strong><small>Practical communication-tool categories and safety questions.</small></button>
  </div>`;
  bindRouteButtons();
  document.querySelectorAll(".speech-guide").forEach((button)=>(button.onclick=()=>openSpeechGuide(button.dataset.guide)));
}

const QUICK_SIGN_GROUPS=[
  ["🍎 Food & Drink",["Eat","Drink","Milk","Water","More","All Done","Hungry","Snack","Apple","Banana","Cookie"]],
  ["💬 Communication Essentials",["More","Help","Please","Thank You","Yes","No","Again","Wait","Stop","Finished","Mine","Yours"]],
  ["👨‍👩‍👦 Family",["Mom","Dad","Grandma","Grandpa","Brother","Sister","Baby","Family","Love","Hug"]],
  ["🎈 Daily Activities",["Play","Outside","Walk","Swing","Park","Bath","Brush Teeth","Get Dressed","Potty","Sleep","Wake Up","Read Book"]],
  ["😀 Feelings & Emotions",["Happy","Sad","Mad/Angry","Scared","Tired","Excited","Calm","Hurt","Sick","Love"]],
  ["🏡 Around the House",["Open","Close","Clean Up","Sit","Stand","Come Here","Go","Inside","Outside","Light","TV"]],
  ["🚗 Places",["Home","Car","Store","Doctor","School","Church","Playground","Restaurant","Library","Zoo","Aquarium"]],
  ["🧸 Favorite Toys",["Ball","Blocks","Car","Train","Bubbles","Teddy Bear","Puzzle","Book","Tablet","Music"]],
  ["🩺 Health & Safety",["Medicine","Doctor","Ouch","Hurt","Bandage","Hot","Cold","Dangerous","Gentle","Bathroom"]],
];
const signSearchTerm=(label)=>({"Mad/Angry":"angry","TV":"television"}[label]||label);
function openSpeechGuide(kind){
  const guides={asl:["🤟 ASL and autistic communication",`<p>American Sign Language is a complete natural language with its own grammar. Some families also use individual ASL signs alongside spoken language, gestures, pictures, or AAC.</p><ul><li>A sign can give a child a reliable way to communicate before speech is clear or available.</li><li>Signs may reduce frustration when they are understood and honored by communication partners.</li><li>ASL does not prevent speech development. A child should not have to prove speech failure before receiving AAC or sign support.</li><li>Signing requires vision, motor planning, hand movement, and partners who understand it, so it is not accessible to every child in every moment.</li></ul>`],useAsl:["📘 Using signs throughout the day",`<ul><li>Say the word naturally while making the sign, but accept the child’s sign without requiring speech.</li><li>Model useful words during real moments—“drink” at the cup and “stop” when stopping—not only during drills.</li><li>Repeat consistently across caregivers and settings, then pause long enough for processing.</li><li>Accept approximations and respond to the meaning. Do not physically force the child’s hands through a sign.</li><li>Keep AAC available too; communication methods can work together.</li></ul>`],aac:["🔊 AAC devices and apps",`<p>AAC includes gestures, signs, paper boards, picture systems, letter boards, speech-generating apps, and dedicated devices. It can supplement speech or be a person’s primary voice.</p><h3>Start with access, not brand</h3><ul><li>Get an evaluation from a speech-language pathologist with AAC experience when possible.</li><li>Consider motor access, vision, hearing, vocabulary layout, language system, durability, voice, portability, backup communication, and partner training.</li><li>Do not remove AAC as punishment, require the child to earn it, or keep it only at school or therapy.</li><li>Model words on the system without demanding immediate imitation.</li></ul><div class="education-links"><a class="education-link" href="https://praacticalaac.org/" target="_blank" rel="noopener"><strong>PrAACtical AAC</strong><span>Free implementation ideas and partner support.</span><small>Open ↗</small></a><a class="education-link" href="https://www.assistiveware.com/learn-aac" target="_blank" rel="noopener"><strong>Learn AAC</strong><span>Free AAC learning resources from an app developer.</span><small>Open ↗</small></a></div>`],flash:["🃏 Flash cards",`<p>Flash cards can make language visually clear and repeatable, especially for matching, labeling, categories, routines, or words that are hard to demonstrate. They are one tool—not a requirement.</p><ul><li>Use clear images with little background clutter.</li><li>Connect the card to the real object, person, action, or place.</li><li>Keep sessions brief and stop before the child is overloaded.</li><li>Do not confuse naming a picture with understanding or using the word in daily life.</li><li>Let a special interest make practice meaningful.</li></ul>`],apps:["📱 Speech-language apps",`<p>Look for the goal before the app: communication, articulation practice, receptive language, early literacy, social stories, or caregiver modeling.</p><ul><li>Prefer apps that work offline, protect privacy, allow export/backup, and do not lock the child’s voice behind a subscription.</li><li>For AAC, avoid rearranging a learned motor layout without a clinical reason.</li><li>Ask whether the app supports the child’s access needs and whether the skill transfers away from the screen.</li></ul><div class="education-links"><a class="education-link" href="https://www.asha.org/public/speech/development/" target="_blank" rel="noopener"><strong>ASHA communication development</strong><span>Milestones and when to seek an evaluation.</span><small>Open ↗</small></a></div>`],products:["🛍️ Communication products",`<ul><li>Core-word and choice boards</li><li>Portable dry-erase boards and communication books</li><li>Recordable single-message or sequential buttons</li><li>Photo-card supplies and visual-schedule materials</li><li>Device cases, straps, stands, keyguards, and screen protection</li><li>Switch-access and alternative-access tools recommended after evaluation</li></ul><div class="banner">Communication tools should remain available at all times and should never be used as a reward or taken away as punishment.</div>`]};
  if(kind==="signs"){modalBody.innerHTML=`<h2>🖐️ ASL Quick Guide</h2><p class="hint">Choose a useful everyday word or phrase to open an outside sign demonstration. A word may appear in more than one section because families use it in different situations.</p><div class="sign-groups">${QUICK_SIGN_GROUPS.map(([group,signs])=>`<section><h3>${group}</h3><div class="sign-grid">${signs.map((sign)=>`<button class="small-action quick-sign" data-sign="${esc(signSearchTerm(sign))}">${esc(sign)}</button>`).join("")}</div></section>`).join("")}</div>`;modal.showModal();document.querySelectorAll(".quick-sign").forEach((b)=>b.onclick=()=>open(`https://www.signingsavvy.com/search/${encodeURIComponent(b.dataset.sign)}`,"_blank","noopener"));return;}
  const [title,body]=guides[kind]||guides.asl;openInfoGuide(title,body);
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

const DAILY_CARE_FIELDS = [
  ["homeAddress", "Child/home address", "Where emergency responders should go"], ["pediatrician", "Pediatrician or clinic", "Name or practice"], ["pediatricianPhone", "Pediatrician phone", "Phone number"], ["preferredHospital", "Preferred hospital", "Name and location"],
  ["medications", "Medications and timing", "Include exact caregiver-approved directions"], ["medicalNotes", "Medical needs and allergies", "Diagnoses, allergies, rescue medicine location…"], ["emergencyPlan", "Emergency plan", "What to do and when to call for help"], ["communication", "Communication", "Speech, ASL, AAC, processing time, words or gestures…"],
  ["foodInstructions", "Food and drink instructions", "Serving, portions, brands, choking precautions…"], ["sleepInstructions", "Sleep instructions", "Routine details, wake rules, checks, safe sleep instructions…"], ["calming", "Calming and comfort", "Favorite items, activities, phrases, safe stims…"], ["sensory", "Sensory triggers and supports", "Noise, light, touch, crowds, headphones…"],
  ["safety", "Safety and supervision", "Wandering, doors, water, pets, car, sibling safety…"], ["toileting", "Toileting care", "Schedule, cues, supplies, assistance, accidents…"], ["other", "Schedule and other instructions", "Meals, activities, screen rules, pickup details…"],
];

async function getDailyCare(profileId) {
  const current = await getSetting(`dailyCare:${profileId}`, {}), legacy = await getSetting(`babysitterNotes:${profileId}`, {});
  return { ...legacy, ...current };
}

async function openDailyCareProfile() {
  const profiles = await getAll("profiles");
  if (!profiles.length) return alert("Create a child profile first.");
  let profileId = profiles[0].id;
  const draw = async () => {
    const value = await getDailyCare(profileId);
    modalBody.innerHTML = `<h2>🧭 Daily Care & Safety</h2><p class="hint">Keep the practical information another trusted adult needs to care for this child. This central profile can be reused by babysitter, school, respite, emergency, and provider tools.</p><div class="field"><label>Child</label><select id="dailyCareProfile">${profiles.map((p) => `<option value="${p.id}" ${p.id === profileId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div><div class="form-grid">${DAILY_CARE_FIELDS.map(([key, label, placeholder]) => `<div class="field"><label>${label}</label><textarea id="dailyCare-${key}" placeholder="${esc(placeholder)}">${esc(value[key] || "")}</textarea></div>`).join("")}<button id="saveDailyCare" class="btn full" type="button">Save Daily Care & Safety profile</button></div><div class="banner"><strong>Keep this current.</strong> Review emergency contacts, allergies, medicines, rescue plans, and supervision needs whenever care changes.</div>`;
    $("#dailyCareProfile").onchange = async (e) => { profileId = e.target.value; await draw(); };
    $("#saveDailyCare").onclick = async () => { const next = Object.fromEntries(DAILY_CARE_FIELDS.map(([key]) => [key, $(`#dailyCare-${key}`).value.trim()])); next.updatedAt = nowISO(); await setSetting(`dailyCare:${profileId}`, next); alert("Daily Care & Safety profile saved."); };
  };
  await draw(); modal.showModal();
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
  view.innerHTML = `<div class="btn-row"><button id="addProfile" class="btn secondary">Add another child</button><button id="addAchievement" class="btn">Celebrate a new Win</button></div>
  <h2 class="section-title">Child profiles</h2>
  <div class="list">${p.map((x) => `<div class="profile-card card"><div class="avatar">${x.photoData ? `<img src="${x.photoData}" alt="${esc(x.name)} profile photo">` : esc(x.emoji || "🌟")}</div><div class="meta"><h3>${esc(x.name)}</h3><p class="profile-detail" data-profile-id="${x.id}">${esc(profileDetail(x, profileDisplay))}</p></div><button class="small-action edit-profile" data-id="${x.id}" type="button">Edit</button></div>`).join("")}</div>
  <h2 class="section-title">Progress tools</h2>
  <div class="grid">
    <button id="dailyCareProfile" class="card-button"><span class="emoji">🧭</span><strong>Daily Care & Safety</strong><small>Central instructions for caregivers, emergencies, school, respite, and babysitters.</small></button>
    <button id="viewAchievements" class="card-button"><span class="emoji">✨</span><strong>Wins</strong><small>${a.length} saved. Tap to view or edit.</small></button>
    <button id="viewWords" class="card-button"><span class="emoji">🗣️</span><strong>Words & phrases</strong><small>${w.length} saved.</small></button>
    <button id="providerSummary" class="card-button"><span class="emoji">📄</span><strong>Provider summary</strong><small>Share progress over time.</small></button>
  </div>`;
  document.querySelectorAll(".profile-card").forEach((card, index) => {
    const profile = p[index], meta = card.querySelector(".meta");
    if (profile?.specialInterest) meta.insertAdjacentHTML("beforeend", `<p class="profile-extra"><strong>Special interest:</strong> ${esc(profile.specialInterest)}</p>`);
    if (profile?.currentFocus) meta.insertAdjacentHTML("beforeend", `<p class="profile-extra"><strong>Currently working on:</strong> ${esc(profile.currentFocus)}</p>`);
  });
  view.insertAdjacentHTML("beforeend", `<h2 class="section-title">Growth tools</h2><div class="grid"><button class="card-button" data-go="food"><span class="emoji">🍽️</span><strong>Food diary</strong><small>Track foods and meals by comfort level, then build gentle variety ideas.</small></button></div>`);
  $("#addProfile").onclick = openProfileForm;
  $("#dailyCareProfile").onclick = openDailyCareProfile;
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
  bindRouteButtons();
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
  modalBody.innerHTML = `<h2>✨ Wins</h2>
  ${sorted.length ? `<div class="list">${sorted.map((x) => `<div class="list-item win-item"><div style="font-size:1.7rem">🎉</div><div class="win-content"><strong>${esc(x.title)}</strong><div class="hint">${esc(names[x.profileId] || "Child")} • ${esc(x.category || "Win")} • ${fmtDate(x.date || x.createdAt)}</div>${x.notes ? `<p style="margin-bottom:0">${esc(x.notes)}</p>` : ""}</div><button class="small-action edit-win" data-id="${x.id}" type="button">Edit</button></div>`).join("")}</div>` : `<div class="empty"><div class="big">🌱</div><p>No Wins have been saved yet.</p></div>`}
  <button id="closeAchievements" class="btn full" type="button" style="margin-top:14px">Close</button>`;
  modal.showModal();
  document.querySelectorAll(".edit-win").forEach(
    (button) =>
      (button.onclick = () =>
        openAchievementForm(
          profiles,
          items.find((item) => item.id === button.dataset.id),
        )),
  );
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
  $("#pName").closest(".field").insertAdjacentHTML("afterend", `<div class="field"><label>Special interest <span class="hint">(optional)</span></label><input id="pInterest" value="${esc(item?.specialInterest || "")}" placeholder="Trains, letters, animals…"></div><div class="field"><label>Currently working on <span class="hint">(optional)</span></label><input id="pCurrentFocus" value="${esc(item?.currentFocus || "")}" placeholder="Using utensils, transitions…"></div>`);
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
        specialInterest: $("#pInterest").value.trim(),
        currentFocus: $("#pCurrentFocus").value.trim(),
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
function openAchievementForm(p, item = null) {
  const categories = [
    "Communication",
    "Learning",
    "Daily living",
    "Motor skills",
    "Sensory & regulation",
    "Social connection",
    "Other",
  ];
  modalBody.innerHTML = `<h2>${item ? "Edit Win" : "Celebrate a new Win"}</h2><div class="form-grid"><div class="field"><label>Child</label><select id="aProfile">${p.map((x) => `<option value="${x.id}" ${item?.profileId === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div><div class="field"><label>What happened?</label><input id="aTitle" value="${esc(item?.title || "")}" placeholder="Used a new sentence"></div><div class="field"><label>Category</label><select id="aCategory">${categories.map((category) => `<option ${item?.category === category ? "selected" : ""}>${esc(category)}</option>`).join("")}</select></div><div class="field"><label>Date</label><input id="aDate" type="date" value="${item?.date || new Date().toISOString().slice(0, 10)}"></div><div class="field"><label>Notes</label><textarea id="aNotes" placeholder="What helped? What made this moment special?">${esc(item?.notes || "")}</textarea></div><button id="saveAchievement" class="btn full" type="button">${item ? "Save changes" : "🎉 You did it! Save Win"}</button></div>`;
  modal.showModal();
  $("#saveAchievement").onclick = async () => {
    const t = $("#aTitle").value.trim();
    if (!t) return alert("Please describe the Win.");
    await put("achievements", {
      ...item,
      id: item?.id || uid(),
      profileId: $("#aProfile").value,
      title: t,
      category: $("#aCategory").value,
      date: $("#aDate").value,
      notes: $("#aNotes").value.trim(),
      createdAt: item?.createdAt || nowISO(),
      updatedAt: nowISO(),
      syncStatus: "local",
    });
    modal.close();
    alert(item ? "Win updated!" : "🎉 Win saved!");
    renderChild();
  };
}

function placeholder(t, i, c, items) {
  view.innerHTML = `<section class="hero"><h1>${i} ${t}</h1><p>${c}</p></section><h2 class="section-title">Planned sections</h2><div class="grid">${items.map((x) => `<button class="card-button future-feature" data-feature="${esc(x[0].replace(/^[^ ]+ /, ""))}"><strong>${x[0]}</strong><small>${x[1]}</small></button>`).join("")}</div><div class="banner" style="margin-top:18px">This section is included in the app structure now and will be activated in a later version.</div>`;
  document
    .querySelectorAll(".future-feature")
    .forEach((b) => (b.onclick = () => underConstruction(b.dataset.feature)));
}

const BIRTHDAY_MESSAGES=[
  "Happy {birthday}, {name}! Your village is celebrating the wonderful, one-of-a-kind person you are today.",
  "Happy {birthday}, {name}! May your day be filled with favorite things, comfortable moments, happy surprises, and plenty of reasons to smile.",
  "Today your whole village cheers for you, {name}. Keep growing in your own wonderful way—you are loved exactly as you are.",
  "Happy {birthday}, {name}! Your smile, your spirit, and all the little things that make you unmistakably you deserve a celebration.",
  "{name}, today is all about you! Your unique journey is worth celebrating every step of the way.",
  "Happy {birthday}, {name}! Your way of seeing the world brings something beautiful that nobody else could bring.",
  "To the amazing {name}: another year means even more discoveries, memories, laughter, and Wins to celebrate. Happy {birthday}!",
  "Happy {birthday}, {name}! May this year bring safe places, joyful discoveries, kind people, and plenty of time for what you love most.",
  "{name}, you are more than milestones, measurements, or expectations. Your village celebrates all of you today. Happy {birthday}!",
  "Happy {birthday}, {name}! Your personality, passions, laughter, and determination make the world more interesting and meaningful.",
  "Today we celebrate the wonderful adventure of being {name}. Happy {birthday}—keep shining in the way only you can.",
  "Happy {birthday}, {name}! You have already created more beautiful memories than anyone could ever measure.",
  "To {name}: may your {birthday} feel comfortable, exciting in all the right ways, and full of the people and things that make you happiest.",
  "Happy {birthday}, {name}! Your voice, choices, comfort, and happiness matter. Your village is always in your corner.",
  "Another year of becoming even more wonderfully you. Happy {birthday}, {name}!",
  "Happy {birthday} to one extraordinary kid! {name}, you make ordinary moments special simply by being part of them.",
  "{name}, your joy is worth sharing, your interests are worth celebrating, and your progress belongs to you. Have a beautiful {birthday}!",
  "Happy {birthday}, {name}! May your new year bring patience when things are hard, confidence when you are ready, and celebration for every Win.",
  "To {name} on your {birthday}: you are not behind, too much, or not enough. You are wonderfully yourself, right on your own path.",
  "Happy {birthday}, {name}! May today give you room to move, play, rest, laugh, explore, and celebrate in the way that feels best.",
  "The best thing about today is celebrating someone as special as {name}. Happy {birthday} to a child loved beyond measure.",
  "Happy {birthday}, {name}! Your courage, curiosity, connection, and wonder give your village so many reasons to cheer.",
  "{name}, your story is still beginning, and it is already filled with so many beautiful moments. Happy {birthday}!",
  "Happy {birthday}, {name}! Your village is proud of who you are today—not only of who you may become tomorrow.",
  "Today the candles are for {name}! Happy {birthday} to someone whose unique journey makes the whole village brighter.",
];
function birthdayOrdinal(value){const n=Number(value);if(!n)return "birthday";const suffix=n%10===1&&n%100!==11?"st":n%10===2&&n%100!==12?"nd":n%10===3&&n%100!==13?"rd":"th";return `${n}${suffix} birthday`;}
function birthdayToday(profile, today = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(profile.birthDate || "");
  if (!match) return false;
  return Number(match[2]) === today.getMonth() + 1 && Number(match[3]) === today.getDate();
}
function birthdayAge(profile, today = new Date()) {
  const birthYear = Number((profile.birthDate || "").slice(0, 4));
  return birthYear ? today.getFullYear() - birthYear : null;
}
async function showBirthdayGreetingsIfNeeded() {
  if (birthdayGreetingsShown) return;
  birthdayGreetingsShown = true;
  const today = new Date();
  const birthdayProfiles = (await getAll("profiles")).filter((profile) => birthdayToday(profile, today));
  if (!birthdayProfiles.length) return;
  const greetings = birthdayProfiles.map((profile) => {
    const template = BIRTHDAY_MESSAGES[Math.floor(Math.random() * BIRTHDAY_MESSAGES.length)];
    return {
      profile,
      message: template
        .replaceAll("{name}", profile.name || "Birthday star")
        .replaceAll("{birthday}", birthdayOrdinal(birthdayAge(profile, today))),
    };
  });
  const showNext = (index) => {
    const greeting = greetings[index];
    if (!greeting) return;
    modalBody.innerHTML = `<div class="birthday-greeting"><div class="birthday-confetti" aria-hidden="true">🎈 🎂 🎉</div><h2>Happy Birthday, ${esc(greeting.profile.name || "Birthday star")}!</h2><p>${esc(greeting.message)}</p><p class="birthday-signoff">With love,<br><strong>Your More than Measured™ village 💛</strong></p><button id="closeBirthdayGreeting" class="btn full" type="button">${index + 1 < greetings.length ? "Celebrate and continue" : "Celebrate!"}</button></div>`;
    modal.showModal();
    $("#closeBirthdayGreeting").onclick = () => {
      modal.close();
      showNext(index + 1);
    };
  };
  showNext(0);
}

function openFoodClaimsGuide() { openInfoGuide("🥛 Food dyes, sugar, dairy & A2 milk", `<p>Food can affect comfort, digestion, sleep, energy, and behavior in any child, but food dyes, sugar, dairy, or A1 milk have not been shown to cause autism. Removing them is not an established treatment for autism itself.</p><h3>Food dyes</h3><p>FDA says most children have no adverse effects from approved color additives, although some evidence suggests certain children may be sensitive. If you notice a repeatable change, record the exact product, dye, amount, timing, symptoms, sleep, illness, and other possible triggers. Labels may list Red 40, Yellow 5, Yellow 6, or Blue 1.</p><h3>Sugar</h3><p>Sugar does not cause autism. A high-sugar eating pattern can crowd out nutrients and affect teeth, appetite, and energy. Exciting situations where sweets are served can also change behavior, so look for repeatable individual patterns rather than assuming activity or distress came from sugar.</p><h3>Dairy, milk allergy, and lactose intolerance</h3><p>A true cow’s-milk allergy is an immune reaction to milk protein and can be serious or life-threatening. Lactose intolerance is difficulty digesting milk sugar and more often causes gas, bloating, diarrhea, nausea, or abdominal pain. These are different conditions. Removing dairy can reduce protein, calcium, vitamin D, calories, and safe-food options, so broad restriction should involve the child’s clinician or pediatric dietitian.</p><h3>What is A2 dairy?</h3><p>Most ordinary cow’s milk contains both A1 and A2 forms of a protein called beta-casein. A2 milk comes from cows selected to produce only the A2 form. It is still cow’s milk, has broadly similar nutrition, and usually contains lactose unless the label also says lactose-free.</p><ul><li>Small human trials suggest A2 milk may cause less digestive discomfort than conventional milk for some people, but findings are mixed and do not establish an autism-specific benefit.</li><li>A2 milk does <strong>not</strong> treat autism and should not be presented as improving core autistic traits.</li><li>It is not a treatment for proven lactose intolerance because ordinary A2 milk still contains lactose.</li><li>It is <strong>not safe for a cow’s-milk allergy</strong>; it still contains milk proteins capable of causing an allergic reaction.</li><li>If a clinician says a cautious trial is appropriate, record the product, amount, symptoms, timing, stool pattern, and other changes rather than changing several foods at once.</li></ul><h3>A safer way to investigate</h3><ul><li>Get urgent help for trouble breathing, throat or tongue swelling, faintness, or a rapidly worsening reaction.</li><li>Use this Food Diary’s allergy, reaction, and sensitivity fields to record patterns.</li><li>Do not deliberately re-expose a child to a suspected allergen without medical guidance.</li><li>Consider constipation, reflux, dental pain, infection, sleep loss, hunger, and medication effects before blaming one ingredient.</li></ul><div class="education-links"><a class="education-link" href="https://www.fda.gov/consumers/consumer-updates/how-safe-are-color-additives" target="_blank" rel="noopener"><strong>FDA color-additive safety</strong><span>Current evidence, sensitivities, reactions, and labeling.</span><small>Official source ↗</small></a><a class="education-link" href="https://www.niddk.nih.gov/health-information/digestive-diseases/lactose-intolerance/symptoms-causes" target="_blank" rel="noopener"><strong>Lactose intolerance and milk allergy</strong><span>NIDDK explains the different causes and symptoms.</span><small>Official source ↗</small></a><a class="education-link" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11215337/" target="_blank" rel="noopener"><strong>A2 milk clinical trial</strong><span>A randomized crossover trial showing mixed gastrointestinal results.</span><small>Research source ↗</small></a></div>`); }

async function renderFoodDiary() {
  const profiles = await getAll("profiles");
  if (!profiles.length) { view.innerHTML = `<div class="empty card"><h2>Create a child profile first</h2><button class="btn" data-go="child">Create profile</button></div>`; bindRouteButtons(); return; }
  let profileId = profiles[0].id, entries = [], editingId = null;
  const key = () => `foodDiary:${profileId}`;
  view.innerHTML = `<section class="hero"><h1>🍽️ Food Diary</h1><p>Record foods, meals, reactions, and preferences without turning eating into a test.</p></section><div class="banner sleep-note"><strong>Allergy safety:</strong> Trouble breathing, throat or tongue swelling, faintness, or a rapidly worsening reaction can be an emergency. Follow the child’s emergency plan and call emergency services.</div><div class="card tool-form"><div class="field"><label>Child</label><select id="foodProfile">${profiles.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div><div class="form-grid two-col"><div class="field"><label>Entry type</label><select id="foodKind"><option value="food">Food</option><option value="meal">Meal</option><option value="snack">Snack</option><option value="condiment">Condiment</option><option value="drink">Drink</option></select></div><div class="field"><label>Name</label><input id="foodName" placeholder="Chicken nugget, ketchup, or milk"></div><div class="field"><label>Eating category</label><select id="foodCategory"><option value="safe">Safe</option><option value="sometimes">Occasionally eats</option><option value="not">Absolutely not</option></select></div><div class="field"><label>Date observed</label><input id="foodDate" type="date" value="${isoToday()}"></div><div class="field"><label>Allergy, reaction, or sensitivity</label><select id="foodResponse"><option value="none">No known reaction</option><option value="allergy">Known food allergy</option><option value="reaction">Possible allergic reaction</option><option value="sensitivity">Sensitivity or intolerance</option></select></div></div><div class="field"><label>Reaction details <span class="hint">(optional)</span></label><textarea id="foodReactionDetails" placeholder="Symptoms, amount eaten, how quickly it started, treatment, and clinician guidance"></textarea></div><div class="field"><label>Notes <span class="hint">(optional)</span></label><textarea id="foodNotes" placeholder="Brand, texture, temperature, presentation, or what changed"></textarea></div><div class="btn-row"><button id="saveFood" class="btn" type="button">Add to diary</button><button id="cancelFoodEdit" class="btn secondary hidden" type="button">Cancel edit</button></div></div><div class="btn-row"><button id="mealIdeas" class="btn secondary">Generate variety ideas</button></div><h2 class="section-title">Foods by acceptance</h2><div id="foodList" class="food-category-list"></div>`;
  view.querySelector(".hero").insertAdjacentHTML("afterend", `<div class="grid section-grid"><button id="foodClaimsGuide" class="card-button"><span class="emoji">🥛</span><strong>Food dyes, sugar, dairy & A2 milk</strong><small>Evidence, individual reactions, A2 dairy, and safer ways to investigate.</small></button></div>`);
  $("#foodClaimsGuide").onclick = openFoodClaimsGuide;
  const load = async () => { entries = await getSetting(key(), []); draw(); };
  const persist = () => setSetting(key(), entries);
  const labels = { safe: "Safe", sometimes: "Occasionally eats", not: "Absolutely not" };
  const responseLabels = { allergy: "Known allergy", reaction: "Possible reaction", sensitivity: "Sensitivity/intolerance" };
  const snackIcon = `<svg class="food-kind-icon" viewBox="0 0 36 36" role="img" aria-label="Snack"><path d="M19 3h12l2 5-2 18H17L15 8z" fill="#f1a85f" stroke="#8d5638" stroke-width="1.5"/><path d="m16 8 3-3 3 3 3-3 3 3 3-3 2 3" fill="none" stroke="#fff3d5" stroke-width="1.5"/><circle cx="24" cy="15" r="3" fill="#fff3d5"/><path d="M3 17h23c0 9-4.5 14-11.5 14S3 26 3 17Z" fill="#7fc4bd" stroke="#316d70" stroke-width="1.5"/><path d="M2 17h25" stroke="#316d70" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  const condimentIcon = `<svg class="food-kind-icon" viewBox="0 0 36 36" role="img" aria-label="Condiment bottle"><path d="M14 3h8v5l3 4v17c0 2-1.5 3.5-3.5 3.5h-7c-2 0-3.5-1.5-3.5-3.5V12l3-4Z" fill="#8ccbc4" fill-opacity=".48" stroke="#346f72" stroke-width="1.7"/><path d="M14 3h8v4h-8z" fill="#cf6f5c" stroke="#8e4138" stroke-width="1.4"/><path d="M13 16h10v9H13z" fill="#fff3d5" stroke="#d5a753" stroke-width="1.2"/><path d="M15.5 20.5h5" stroke="#cf6f5c" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const mealIcon = `<svg class="food-kind-icon" viewBox="0 0 36 36" role="img" aria-label="Meal with plate, bowl, and glass"><circle cx="12.5" cy="22" r="10" fill="#fff9e9" stroke="#3f7180" stroke-width="1.6"/><circle cx="12.5" cy="22" r="6.5" fill="#f4cf83" fill-opacity=".45" stroke="#79a7ae" stroke-width="1"/><path d="M17 7h10c0 5-2 8-5 8s-5-3-5-8Z" fill="#7fc4bd" stroke="#316d70" stroke-width="1.4"/><path d="M16.5 7h11" stroke="#316d70" stroke-width="2" stroke-linecap="round"/><path d="M29 5h5l-.7 12.5c-.1 1.5-1.1 2.5-1.8 2.5s-1.7-1-1.8-2.5Z" fill="#a9d9e8" fill-opacity=".55" stroke="#477a8a" stroke-width="1.3"/><path d="M30.1 12h3.2" stroke="#6ab8cf" stroke-width="1.4"/><path d="M31.5 20v8m-3 1h6" stroke="#477a8a" stroke-width="1.3" stroke-linecap="round"/></svg>`;
  const kindInfo = { food:["🍽️","Food"], meal:[mealIcon,"Meal"], snack:[snackIcon,"Snack"], condiment:[condimentIcon,"Condiment"], drink:["🥤","Drink"] };
  const resetForm=()=>{editingId=null;$("#foodKind").value="food";$("#foodName").value="";$("#foodCategory").value="safe";$("#foodDate").value=isoToday();$("#foodResponse").value="none";$("#foodReactionDetails").value="";$("#foodNotes").value="";$("#saveFood").textContent="Add to diary";$("#cancelFoodEdit").classList.add("hidden");};
  const draw = () => { $("#foodList").innerHTML = ["safe","sometimes","not"].map((category)=>{const items=[...entries].filter((x)=>x.category===category).sort((a,b)=>a.name.localeCompare(b.name));return `<section class="food-category-block ${category}"><h3>${labels[category]} <span>${items.length}</span></h3><div class="list">${items.length?items.map((x)=>{const [icon,kindLabel]=kindInfo[x.kind]||kindInfo.food;const response=responseLabels[x.response]||"";return `<div class="list-item food-item"><div><strong>${icon} ${esc(x.name)}</strong><div class="hint">${kindLabel}${x.date?` • ${fmtDate(x.date)}`:""}${response?` • <span class="food-alert">${esc(response)}</span>`:""}</div>${x.reactionDetails?`<p><strong>Reaction:</strong> ${esc(x.reactionDetails)}</p>`:""}${x.notes?`<p>${esc(x.notes)}</p>`:""}</div><div><button class="small-action edit-food" data-id="${x.id}">Edit</button><button class="small-action danger-link delete-food" data-id="${x.id}">Delete</button></div></div>`;}).join(""):`<div class="empty"><p>Nothing in this group yet.</p></div>`}</div></section>`;}).join("");
    document.querySelectorAll(".edit-food").forEach((b) => b.onclick = () => { const x=entries.find((e)=>e.id===b.dataset.id);editingId=x.id;$("#foodKind").value=x.kind||"food";$("#foodName").value=x.name;$("#foodCategory").value=x.category||"safe";$("#foodDate").value=x.date||"";$("#foodResponse").value=x.response||"none";$("#foodReactionDetails").value=x.reactionDetails||"";$("#foodNotes").value=x.notes||"";$("#saveFood").textContent="Update entry";$("#cancelFoodEdit").classList.remove("hidden");$("#foodName").focus();window.scrollTo({top:0,behavior:"smooth"}); });
    document.querySelectorAll(".delete-food").forEach((b) => b.onclick = async () => { const x=entries.find((e)=>e.id===b.dataset.id); if (!confirm(`Delete “${x.name}”?`)) return; entries=entries.filter((e)=>e.id!==x.id); await persist(); draw(); });
  };
  $("#foodProfile").onchange = async (e) => { profileId=e.target.value; resetForm(); await load(); };
  $("#cancelFoodEdit").onclick=resetForm;
  $("#saveFood").onclick = async () => { const name=$("#foodName").value.trim(); if(!name) return alert("Enter a food, meal, snack, condiment, or drink name."); const values={kind:$("#foodKind").value,name,category:$("#foodCategory").value,date:$("#foodDate").value,response:$("#foodResponse").value,reactionDetails:$("#foodReactionDetails").value.trim(),notes:$("#foodNotes").value.trim(),updatedAt:nowISO()};if(editingId){Object.assign(entries.find((x)=>x.id===editingId),values);}else{entries.push({id:uid(),...values,createdAt:nowISO()});}await persist();resetForm();draw(); };
  $("#mealIdeas").onclick = () => { const safe=entries.filter((x)=>x.kind==="food"&&x.category==="safe"), sometimes=entries.filter((x)=>x.kind==="food"&&x.category==="sometimes"); if(!safe.length) return alert("Add at least one safe individual food first."); const ideas=Array.from({length:Math.min(6,Math.max(3,safe.length))},(_,i)=>{ const anchor=safe[i%safe.length].name, second=safe[(i+1)%safe.length]?.name, learning=sometimes[i%sometimes.length]?.name; return `${anchor}${second&&second!==anchor?` + ${second}`:""}${learning?`, with a tiny no-pressure side of ${learning}`:""}`; }); modalBody.innerHTML=`<h2>🥗 Gentle variety ideas</h2><p class="hint">These combinations use this child’s saved foods. They are presentation ideas—not a nutrition assessment or a promise that the child will eat them.</p><div class="list">${ideas.map((x)=>`<div class="list-item"><span>${esc(x)}</span></div>`).join("")}</div><div class="banner">Keep at least one reliable food available. A pediatrician or feeding-qualified dietitian can assess growth, nutrients, swallowing, allergies, pain, or severe restriction.</div>`; modal.showModal(); };
  await load();
}

const STARTER_LIFE_SKILLS = ["Cleaned up toys","Brushed hair","Brushed teeth","Washed hair","Washed body","Dressed independently","Used utensils","Drank from a straw cup","Drank from an open cup","Washed hands","Put on shoes","Helped prepare food","Followed a visual routine","Asked for a break","Crossed a street safely with support"];
async function renderLifeSkills() {
  const profiles=await getAll("profiles"); if(!profiles.length){view.innerHTML=`<div class="empty card"><h2>Create a child profile first</h2><button class="btn" data-go="child">Create profile</button></div>`;bindRouteButtons();return;}
  let profileId=profiles[0].id, skills=[]; const key=()=>`lifeSkills:${profileId}`;
  view.innerHTML=`<section class="hero"><h1>🌟 Life Skills</h1><p>Track practical skills without comparing one child’s timeline to another.</p></section><div class="card"><div class="field"><label>Child</label><select id="lifeProfile">${profiles.map((p)=>`<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div><div class="inline-field"><input id="newLifeSkill" placeholder="Add a custom skill"><button id="addLifeSkill" class="btn">Add</button></div><button id="addStarterSkills" class="btn secondary full" style="margin-top:10px">Add starter skill list</button></div><div id="lifeSkillList" class="list" style="margin-top:14px"></div>`;
  const persist=()=>setSetting(key(),skills), load=async()=>{skills=await getSetting(key(),[]);draw();};
  const draw=()=>{$("#lifeSkillList").innerHTML=skills.length?skills.map((x)=>`<details class="term-card"><summary>${esc(x.name)} <span class="category-chip">${esc(x.status||"Not started")}</span></summary><div class="education-body"><div class="field"><label>Status</label><select class="life-status" data-id="${x.id}"><option ${x.status==="Not started"?"selected":""}>Not started</option><option ${x.status==="Practicing"?"selected":""}>Practicing</option><option ${x.status==="With help"?"selected":""}>With help</option><option ${x.status==="Independent"?"selected":""}>Independent</option></select></div><div class="field"><label>Date reached <span class="hint">(optional)</span></label><input class="life-date" data-id="${x.id}" type="date" value="${x.date||""}"></div><div class="field"><label>Notes</label><textarea class="life-notes" data-id="${x.id}">${esc(x.notes||"")}</textarea></div><div class="btn-row"><button class="small-action save-life" data-id="${x.id}">Save</button><button class="small-action danger-link delete-life" data-id="${x.id}">Delete</button></div></div></details>`).join(""):`<div class="empty card"><p>No life skills added yet.</p></div>`;document.querySelectorAll(".save-life").forEach((b)=>b.onclick=async()=>{const x=skills.find((s)=>s.id===b.dataset.id);x.status=document.querySelector(`.life-status[data-id="${x.id}"]`).value;x.date=document.querySelector(`.life-date[data-id="${x.id}"]`).value;x.notes=document.querySelector(`.life-notes[data-id="${x.id}"]`).value.trim();await persist();draw();});document.querySelectorAll(".delete-life").forEach((b)=>b.onclick=async()=>{if(!confirm("Delete this skill?"))return;skills=skills.filter((x)=>x.id!==b.dataset.id);await persist();draw();});};
  const add=(name)=>{if(!name||skills.some((x)=>wordKey(x.name)===wordKey(name)))return;skills.push({id:uid(),name,status:"Not started",date:"",notes:""});};
  $("#lifeProfile").onchange=async(e)=>{profileId=e.target.value;await load();};$("#addLifeSkill").onclick=async()=>{const name=$("#newLifeSkill").value.trim();if(!name)return;add(name);$("#newLifeSkill").value="";await persist();draw();};$("#addStarterSkills").onclick=async()=>{STARTER_LIFE_SKILLS.forEach(add);await persist();draw();};await load();
}

async function renderHealthWellness(){
  const profiles=await getAll("profiles");
  view.innerHTML=`<section class="hero"><h1>🩺 Health & Wellness</h1><p>Prepare, document, and ask better questions without treating autism itself as an illness to cure.</p></section><div class="banner sleep-note"><strong>General education only.</strong> Lab testing, supplements, medications, vaccine decisions, gastrointestinal treatment, and equipment must be individualized by qualified clinicians.</div><div class="grid section-grid"><button id="medicalLetter" class="card-button"><span class="emoji">📄</span><strong>Medical necessity letter</strong><small>Editable equipment and supply request template.</small></button><button id="apptPrep" class="card-button"><span class="emoji">📋</span><strong>Prepare for an appointment</strong><small>Build and save a doctor or therapy visit sheet.</small></button><button id="providerReport" class="card-button"><span class="emoji">📊</span><strong>Generate provider report</strong><small>Summarize profile, communication, Wins, life skills, food, and potty records.</small></button><button id="apptNotes" class="card-button"><span class="emoji">📝</span><strong>After-appointment notes</strong><small>Save instructions, decisions, referrals, and follow-up.</small></button><button id="labGuide" class="card-button"><span class="emoji">🧪</span><strong>Routine and symptom-guided labs</strong><small>What is routine, what is not, and questions to ask.</small></button><button id="mthfrGuide" class="card-button"><span class="emoji">🧬</span><strong>MTHFR explained</strong><small>Heterozygous, homozygous, compound variants, testing, folate, and homocysteine.</small></button><button id="foodClaimsGuide" class="card-button"><span class="emoji">🥛</span><strong>Food dyes, sugar & dairy</strong><small>What evidence says, individual reactions, and safer ways to investigate concerns.</small></button><button id="gutGuide" class="card-button"><span class="emoji">🫃</span><strong>Gut health</strong><small>Constipation, reflux, diarrhea, feeding, pain, and when to seek help.</small></button><button id="probioticGuide" class="card-button"><span class="emoji">🦠</span><strong>Probiotics & prebiotics</strong><small>What evidence can and cannot tell us.</small></button><button id="vitaminGuide" class="card-button"><span class="emoji">🍊</span><strong>Vitamins & selective eating</strong><small>Deficiency risk, food-first support, testing, and supplement safety.</small></button><button id="placardGuide" class="card-button"><span class="emoji">♿</span><strong>Disability parking placard</strong><small>Why autism alone may not meet mobility-based state rules.</small></button></div>`;
  queueMicrotask(()=>$("#foodClaimsGuide")?.remove());
  $("#medicalLetter").onclick=()=>openMedicalNecessityLetter(profiles);$("#apptPrep").onclick=()=>openAppointmentPrep(profiles);$("#providerReport").onclick=()=>openProviderReport(profiles);$("#apptNotes").onclick=()=>openAppointmentNotes(profiles);
  $("#labGuide").onclick=()=>openInfoGuide("🧪 Routine and symptom-guided labs",`<p>There is no single “autism lab panel.” Autistic children generally need the same preventive care as other children, plus testing guided by diet, symptoms, growth, medications, family history, and examination.</p><h3>Often considered when clinically indicated</h3><ul><li>CBC and iron studies when intake is limited, fatigue or pallor is present, or restless sleep is suspected.</li><li>Lead testing based on age, housing, exposure, local requirements, or developmental risk.</li><li>Vitamin D, B12, folate, zinc, metabolic testing, thyroid testing, celiac screening, or other studies only when history or examination supports them.</li><li>Medication monitoring specific to the medicine being used.</li></ul><p>Genetic testing may be offered as part of etiologic evaluation, but it does not confirm or rule out autism. Ask what question each test is meant to answer and how the result would change care.</p><div class="banner">Seek urgent care for severe dehydration, breathing difficulty, a first or prolonged seizure, black or bloody stool, severe abdominal pain, or a sudden loss of consciousness.</div>`);
  $("#mthfrGuide").onclick=()=>openInfoGuide("🧬 Understanding MTHFR results",`<p><strong>MTHFR</strong> is a gene that gives the body instructions for an enzyme involved in processing folate and homocysteine. Everyone normally has two copies—one inherited from each biological parent. The two common variants usually reported are <strong>C677T</strong> and <strong>A1298C</strong>.</p><h3>Heterozygous, homozygous, and compound heterozygous</h3><div class="benefit-compare"><div><strong>Heterozygous</strong><span>One usual copy and one variant copy at a location—for example, C677T. A single common variant is unlikely by itself to cause health problems.</span></div><div><strong>Homozygous</strong><span>Two matching variant copies—for example, two C677T copies (often reported as 677TT) or two A1298C copies.</span></div></div><p><strong>Compound heterozygous</strong> means one C677T copy and one A1298C copy. Two C677T copies or a compound result can contribute to elevated homocysteine in some people. Two A1298C copies generally do not explain elevated homocysteine by themselves.</p><h3>What a result does—and does not—mean</h3><ul><li>A common variant does not diagnose autism, explain every symptom, guarantee high homocysteine, or prove that a person cannot use folic acid.</li><li>These common variants are different from rare, severe MTHFR deficiency that can cause homocystinuria and requires specialist care.</li><li>Most people do not need common-variant testing. When homocysteine is elevated, clinicians also consider B-vitamin status, diet, thyroid or kidney disease, age, medicines, and other conditions.</li><li>CDC states that people with MTHFR variants can process folic acid. A clinician may sometimes choose 5-MTHF, but a result alone is not a reason to megadose methylfolate or other vitamins.</li><li>MTHFR status alone is not a vaccine contraindication and does not predict a universal reaction to over-the-counter medicine. Medication questions belong with the prescriber or pharmacist.</li></ul><h3>Questions to bring to the clinician</h3><ul><li>Was this a validated clinical test or a direct-to-consumer report?</li><li>Which exact variant and genotype were found?</li><li>Is homocysteine actually elevated, and were folate and vitamin B12 assessed?</li><li>Would this result change treatment, or would treatment be the same without it?</li><li>Could supplements interact with medicines or hide a vitamin B12 deficiency?</li></ul><div class="education-links"><a class="education-link" href="https://medlineplus.gov/lab-tests/mthfr-gene-test/" target="_blank" rel="noopener"><strong>MedlinePlus MTHFR gene test</strong><span>Common variants, testing, and result interpretation.</span><small>Official health source ↗</small></a><a class="education-link" href="https://www.cdc.gov/folic-acid/data-research/mthfr/index.html" target="_blank" rel="noopener"><strong>CDC MTHFR and folic acid facts</strong><span>Why common variants do not mean folic acid must be avoided.</span><small>Official health source ↗</small></a></div>`);
  $("#foodClaimsGuide").onclick=()=>openInfoGuide("🥛 Food dyes, sugar, dairy & autism",`<p>Food can affect comfort, energy, sleep, digestion, and behavior in any child, but no food or ingredient has been shown to cause autism—and removing dyes, sugar, or dairy is not an established treatment for autism itself.</p><h3>Food dyes</h3><p>FDA says most children have no behavioral effects from approved color additives, although some evidence suggests certain children may be sensitive. If you notice a repeatable change, record the exact product, dye, amount, timing, symptoms, sleep, illness, and other possible triggers. Labels may list names such as Red 40, Yellow 5, Yellow 6, or Blue 1.</p><h3>Sugar</h3><p>Sugar does not cause autism. A high-sugar pattern can crowd out nutrients and affect teeth, appetite, and energy, while the excitement and setting around sweets can also change behavior. Look for a repeatable individual pattern rather than assuming every active or difficult moment came from sugar.</p><h3>Dairy and casein</h3><p>A true milk allergy involves the immune system and can be serious. Lactose intolerance is different and more often causes gas, bloating, pain, or diarrhea. Research on gluten-free or casein-free diets for core autism features has produced mixed results. Removing dairy can reduce calcium, vitamin D, protein, calories, and safe-food options, so involve the child’s clinician or feeding-qualified dietitian before a broad elimination diet.</p><h3>A safer way to investigate</h3><ul><li>Get urgent help for trouble breathing, throat or tongue swelling, faintness, or a rapidly worsening reaction.</li><li>Use the Food Diary’s allergy/reaction and sensitivity fields to record patterns.</li><li>Change one thing at a time when medically safe, use a planned time window, and agree beforehand on what improvement would count.</li><li>Do not deliberately re-expose a child to a suspected allergen without medical guidance.</li><li>Rule out constipation, reflux, dental pain, infection, sleep loss, hunger, and medication effects.</li></ul><div class="education-links"><a class="education-link" href="https://www.fda.gov/food/color-additives-information-consumers/color-additives-questions-and-answers-consumers" target="_blank" rel="noopener"><strong>FDA color-additive questions and answers</strong><span>Labeling, current evidence, and reporting reactions.</span><small>Official source ↗</small></a><a class="education-link" href="https://www.nccih.nih.gov/health/autism" target="_blank" rel="noopener"><strong>NIH: autism and complementary approaches</strong><span>Special-diet evidence, nutrition monitoring, and supplement safety.</span><small>Official source ↗</small></a></div>`);
  $("#gutGuide").onclick=()=>openInfoGuide("🫃 Gut health and autism",`<p>Constipation, reflux, diarrhea, abdominal pain, food restriction, and toileting difficulties can be more common in autistic children. Pain may appear as sleep changes, agitation, reduced eating, pressing the abdomen, posturing, or a sudden behavior change when a child cannot describe it directly.</p><ul><li>Track stool pattern, pain, appetite, fluids, foods, medicines, sleep, and behavior.</li><li>Do not assume every symptom is “just autism” or pursue an autism cure through detoxes, extreme diets, or unproven testing.</li><li>Ask about constipation even when stool occurs daily; retention can still be present.</li><li>Feeding therapy and a pediatric dietitian may help when texture, chewing, swallowing, growth, allergy, or nutrient concerns exist.</li></ul>`);
  $("#probioticGuide").onclick=()=>openInfoGuide("🦠 Probiotics and prebiotics",`<p>Probiotics are live microorganisms; prebiotics are fibers that feed certain gut microbes. Effects are strain- and condition-specific. Current evidence does not support choosing a probiotic to treat core autism features or behavior.</p><ul><li>Discuss the actual goal—such as a particular antibiotic-associated diarrhea risk or diagnosed GI condition—with the clinician.</li><li>Food sources can include yogurt with live cultures and tolerated fiber-rich foods.</li><li>Products vary and may cause gas or bloating. Serious infections are rare but are a concern for premature, severely ill, or immunocompromised children.</li></ul><p><a href="https://www.nccih.nih.gov/health/probiotics-usefulness-and-safety" target="_blank" rel="noopener">NIH probiotic safety and evidence ↗</a></p><div class="banner">There is no evidence-based “best probiotic for autistic kids” as a group.</div>`);
  $("#vitaminGuide").onclick=()=>openInfoGuide("🍊 Vitamins and selective eating",`<p>Autistic children do not have a separate universal vitamin requirement. Needs depend on age, diet, growth, medical conditions, and proven deficiencies. Selective eating can increase risk when whole food groups are absent.</p><ul><li>Bring a three-day food record and brand names to the pediatrician or pediatric dietitian.</li><li>Ask whether growth and diet suggest checking iron, vitamin D, B12, folate, or other nutrients.</li><li>Choose a supplement only for a defined purpose. More is not better; iron, vitamin A, vitamin D, zinc, and other nutrients can be harmful in excess.</li><li>Look for independent quality testing and review gummies as both medicine and a choking/cavity risk.</li></ul><p><a href="https://ods.od.nih.gov/factsheets/list-all/" target="_blank" rel="noopener">NIH vitamin and mineral fact sheets ↗</a></p>`);
  $("#placardGuide").onclick=()=>openInfoGuide("♿ Disability parking placards",`<p>Parking placard rules are state-specific and often focus on walking or cardiopulmonary limitations. An autism diagnosis by itself may not qualify. Some states have other programs for communication disabilities or safety alerts.</p><ol><li>Open your state DMV’s current eligibility form.</li><li>Ask the child’s clinician whether the child’s functional limitation meets the exact legal criteria.</li><li>Describe function and safety accurately; do not assume elopement automatically fits a mobility definition.</li><li>Never use the placard unless the eligible person is being transported and state rules permit it.</li></ol><p><a href="https://transportation.wv.gov/DMV/Pages/Person-with-a-Disability.aspx" target="_blank" rel="noopener">West Virginia disability and communication forms ↗</a></p>`);
}

function renderSensorySupport(){view.innerHTML=`<section class="hero"><h1>🫧 Sensory Support</h1><p>Understand what the nervous system may be asking for—and make participation safer and more comfortable.</p></section><div class="grid section-grid"><button id="sensoryNeeds" class="card-button"><span class="emoji">🧠</span><strong>Eight sensory systems</strong><small>Seeking, avoiding, noticing late, and changing needs.</small></button><button id="sensoryCheck" class="card-button"><span class="emoji">🧭</span><strong>Sensory pattern check-in</strong><small>A caregiver reflection—not a diagnostic assessment.</small></button><button id="spdGuide" class="card-button"><span class="emoji">🧩</span><strong>SPD and autism</strong><small>How sensory processing differences overlap with ASD.</small></button><button id="triggerGuide" class="card-button"><span class="emoji">✂️</span><strong>Common sensory triggers</strong><small>Water, clothing, haircuts, grass, nails, teeth, hair, and more.</small></button><button id="materialPreferences" class="card-button"><span class="emoji">🧵</span><strong>Clothing & bedding materials</strong><small>Save comfortable fabrics, difficult textures, seams, tags, fit, and bedding preferences.</small></button><button id="fabricGuide" class="card-button"><span class="emoji">👕</span><strong>Why clothing and fabrics can feel different</strong><small>Seams, tags, denim, socks, fit, temperature, and practical alternatives.</small></button><button id="sensoryProducts" class="card-button"><span class="emoji">🛍️</span><strong>Sensory products</strong><small>Categories, safety questions, and why observation comes first.</small></button></div>`;
$("#sensoryNeeds").onclick=()=>openInfoGuide("🧠 The sensory systems",`<p>A child can seek one kind of input and avoid another—and the same input can feel different depending on sleep, illness, stress, hunger, environment, and control.</p><ul><li><strong>Sight:</strong> light, color, motion, visual clutter.</li><li><strong>Sound:</strong> volume, pitch, sudden or layered noise.</li><li><strong>Touch:</strong> fabric, grooming, messy play, light or firm contact.</li><li><strong>Taste and smell:</strong> food, products, rooms, people.</li><li><strong>Vestibular:</strong> movement, balance, spinning, head position.</li><li><strong>Proprioception:</strong> muscles and joints; pushing, carrying, climbing, firm pressure.</li><li><strong>Interoception:</strong> internal cues such as hunger, thirst, pain, temperature, and toileting.</li></ul><p>“Seeker” and “avoider” are useful shorthand, not permanent personality types.</p>`);
$("#sensoryCheck").onclick=openSensoryCheckIn;$("#spdGuide").onclick=()=>openInfoGuide("🧩 Sensory processing differences and ASD",`<p>Sensory reactivity is part of the diagnostic description of autism, but sensory differences also occur in ADHD, anxiety, developmental disabilities, trauma, and people without a diagnosis. “Sensory Processing Disorder” is a term commonly used by occupational therapists and families, but it is not a standalone diagnosis in the DSM-5-TR.</p><p>An occupational therapist can assess how sensory and motor differences affect sleep, feeding, grooming, play, school, safety, and daily living. Useful support focuses on function and comfort rather than making harmless autistic behavior disappear.</p>`);
$("#triggerGuide").onclick=()=>openInfoGuide("✂️ Why everyday activities can feel huge",`<ul><li><strong>Water:</strong> temperature, pressure, echo, splashing, unpredictability—or wonderfully consistent full-body input.</li><li><strong>Clothing:</strong> seams, tags, waist pressure, fabric, static, heat, or a change from familiar clothing.</li><li><strong>Haircuts:</strong> buzzing near the ears, falling hair, cape pressure, mirrors, strangers, touch, and not knowing when it ends.</li><li><strong>Grass and materials:</strong> sharp, damp, itchy, unstable, sticky, or visually overwhelming sensations.</li><li><strong>Nail cutting:</strong> hand restraint, pressure, vibration, fear of pain, and the sound or sight of clipping.</li><li><strong>Teeth brushing:</strong> taste, foam, gag reflex, bristle feel, mouth pain, and motor planning.</li><li><strong>Hair brushing:</strong> scalp pain, pulling, static, sound, and loss of control.</li></ul><h3>What helps</h3><p>Rule out pain first. Offer choices, preview the steps, use visual timers, practice on a doll, allow breaks, change tools or setting, and stop when distress shows that the plan needs to change. Gradual exposure should build safety and control, not force endurance.</p>`);
$("#fabricGuide").onclick=()=>openInfoGuide("👕 Clothing, fabrics, and sensory comfort",`<p>Clothing touches the body for hours. For a child whose nervous system notices touch very strongly, a sock seam, tag, stiff waistband, wrinkle, or rough fiber may stay impossible to tune out. It can feel distracting, itchy, painful, hot, restrictive, or unpredictable—not merely annoying.</p><h3>Why one material may work and another may not</h3><ul><li><strong>Seams and tags:</strong> raised stitching, toe seams, labels, embroidery backs, and appliqués can create repeated pressure or scratching.</li><li><strong>Texture:</strong> soft cotton or smooth jersey may feel predictable, while wool, lace, stiff denim, sequins, or coarse synthetic fibers may feel sharp or abrasive. Another child may actively prefer textured or fuzzy fabric.</li><li><strong>Fit and pressure:</strong> one child may prefer loose clothing that barely touches the skin; another may feel more secure in snug stretch fabric. Tight cuffs, collars, waistbands, and elastic can also become painful.</li><li><strong>Heat, moisture, and static:</strong> fabric weight, breathability, sweat, wet cuffs, static electricity, and temperature changes can turn tolerable clothing into intolerable clothing.</li><li><strong>Movement and sound:</strong> denim can resist bending; coats can restrict shoulders; fabrics can swish, crackle, bunch, twist, or pull.</li><li><strong>Smell:</strong> detergent, fabric softener, new-clothing chemicals, fragrance, or damp fabric may be the actual problem.</li></ul><h3>Practical things to try</h3><ul><li>Choose tagless labels, flat seams, seamless socks, soft waistbands, and simple fasteners when the child prefers them.</li><li>Try socks inside out, remove a tag carefully at its stitching, cover a rough spot, or layer a tolerated shirt beneath a uniform.</li><li>Wash new clothes before wearing and use a detergent and rinse routine the child tolerates.</li><li>Offer choices between two acceptable items and let the child feel fabric before buying when possible.</li><li>Buy duplicates of comfortable basics and note the exact brand, model, fabric blend, and size.</li><li>Do not assume cotton, bamboo, fleece, compression, or “sensory-friendly” branding will suit every child. The child’s response is the test.</li><li>Check for eczema, rash, injury, tight sizing, ingrown nails, blisters, temperature problems, or other pain before treating refusal as behavioral.</li></ul><div class="banner"><strong>Comfort is functional support.</strong> Accommodating a harmless clothing need can preserve energy for communication, school, play, and daily life. The goal is not to force the child to tolerate pain.</div><div class="education-links"><a class="education-link" href="https://www.autism.org.uk/learn/knowledge-hub/professional-practice/running-an-autism-friendly-product-focus-group-a-c" target="_blank" rel="noopener"><strong>Autistic-led clothing feedback</strong><span>National Autistic Society findings about seams, labels, fit, texture, and individual variation.</span><small>Open source ↗</small></a></div>`);
$("#materialPreferences").onclick=openMaterialPreferences;
$("#sensoryProducts").onclick=()=>openProductGuide("Sensory support",["Hearing protection with an appropriate noise-reduction rating","Sunglasses, hats, blackout curtains, and dimmable lighting","Chew tools designed for the child’s age and chewing strength","Swings and movement equipment installed to rated structural supports","Crash pads, body socks, resistance bands, and supervised heavy-work tools","Seamless clothing and grooming-tool alternatives","Visual timers, sensory bags, and calm-space supplies"]);}

async function openMaterialPreferences(){const profiles=await getAll("profiles");if(!profiles.length)return alert("Create a child profile first.");let profileId=profiles[0].id;const draw=async()=>{const value=await getSetting(`materialPreferences:${profileId}`,{});modalBody.innerHTML=`<h2>🧵 Clothing & bedding preferences</h2><p class="hint">Texture preferences can change with temperature, illness, stress, fit, and the child’s control over the situation. Record observations rather than forcing tolerance.</p><div class="form-grid"><div class="field"><label>Child</label><select id="materialProfile">${profiles.map((p)=>`<option value="${p.id}" ${p.id===profileId?"selected":""}>${esc(p.name)}</option>`).join("")}</select></div><div class="field"><label>Comfortable clothing materials</label><textarea id="comfortableClothing" placeholder="Soft cotton, fleece, smooth athletic fabric…">${esc(value.comfortableClothing||"")}</textarea></div><div class="field"><label>Difficult clothing materials</label><textarea id="difficultClothing" placeholder="Wool, denim, lace, stiff collars…">${esc(value.difficultClothing||"")}</textarea></div><div class="field"><label>Fit, seams, tags, and fasteners</label><textarea id="clothingDetails" placeholder="Loose or snug, tagless, flat seams, elastic waist, no buttons…">${esc(value.clothingDetails||"")}</textarea></div><div class="field"><label>Preferred bedding</label><textarea id="preferredBedding" placeholder="Jersey sheets, cool blanket, smooth pillowcase…">${esc(value.preferredBedding||"")}</textarea></div><div class="field"><label>Bedding to avoid</label><textarea id="avoidBedding" placeholder="Flannel, scratchy blankets, top sheet, heavy comforter…">${esc(value.avoidBedding||"")}</textarea></div><div class="field"><label>Temperature, pressure, and other notes</label><textarea id="materialNotes" placeholder="Sleeps cool, dislikes wrinkles, seeks compression…">${esc(value.notes||"")}</textarea></div><button id="saveMaterialPreferences" class="btn full">Save preferences</button></div>`;$("#materialProfile").onchange=async(e)=>{profileId=e.target.value;await draw();};$("#saveMaterialPreferences").onclick=async()=>{await setSetting(`materialPreferences:${profileId}`,{comfortableClothing:$("#comfortableClothing").value.trim(),difficultClothing:$("#difficultClothing").value.trim(),clothingDetails:$("#clothingDetails").value.trim(),preferredBedding:$("#preferredBedding").value.trim(),avoidBedding:$("#avoidBedding").value.trim(),notes:$("#materialNotes").value.trim(),updatedAt:nowISO()});alert("Material preferences saved.");};};await draw();modal.showModal();}

function openSensoryCheckIn(){const qs=[["Seeks movement such as spinning, jumping, or climbing","seek"],["Avoids swings, stairs, or feet leaving the ground","avoid"],["Enjoys pushing, crashing, carrying, or firm pressure","seek"],["Pulls away from light touch, grooming, seams, or messy hands","avoid"],["Makes sounds, watches moving objects, or seeks bright patterns repeatedly","seek"],["Covers ears or becomes distressed by ordinary or sudden sounds","avoid"],["Seeks strong flavors, smells, chewing, or mouthing","seek"],["Avoids foods or places because of taste or smell","avoid"],["Notices hunger, thirst, pain, or toileting cues very late","mixed"],["Needs different input depending on the day or setting","mixed"]];modalBody.innerHTML=`<h2>🧭 Sensory pattern check-in</h2><p class="hint">Check what is often true. This cannot diagnose a sensory condition.</p><div class="form-grid">${qs.map(([q,t],i)=>`<label class="check-option"><input type="checkbox" data-pattern="${t}" id="sensoryQ${i}"> ${q}</label>`).join("")}<button id="scoreSensory" class="btn">Show reflection</button><div id="sensoryResult"></div></div>`;modal.showModal();$("#scoreSensory").onclick=()=>{const checked=[...document.querySelectorAll("[data-pattern]:checked")],scores={seek:0,avoid:0,mixed:0};checked.forEach((x)=>scores[x.dataset.pattern]++);let label="No clear pattern yet",text="Observe across several settings and states.";if(scores.seek&&scores.avoid){label="A mixed sensory pattern",text="The child appears to seek some input and avoid other input. That is very common.";}else if(scores.seek>scores.avoid){label="More seeking signs selected",text="The child may use extra movement, pressure, sound, or other input to feel organized.";}else if(scores.avoid>scores.seek){label="More avoiding signs selected",text="Some input may feel too intense, unpredictable, or painful.";}$("#sensoryResult").innerHTML=`<div class="banner"><strong>${label}</strong><br>${text} Look for what happens before, during, and after an activity and discuss functional concerns with an occupational therapist.</div>`;};}

function renderAsdFriendlyFun(){view.innerHTML=`<section class="hero"><h1>🎡 ASD Friendly Fun</h1><p>Find places that explain their supports before your family arrives.</p></section><details class="education-card" open><summary>🏞️ Free lifetime federal recreation Access Pass</summary><div class="education-body"><p>U.S. citizens or permanent residents of any age with a medically determined permanent disability that severely limits one or more major life activities may qualify for the free lifetime Interagency Access Pass. Autism can qualify when the required functional criteria and documentation are met; a diagnosis label alone is not the test.</p><p>The pass covers entrance or standard amenity fees at participating federal lands. It does not automatically cover concessions, every camping fee, tours, or special permits. In-person issuance is free; online or mail orders can have processing or shipping costs.</p><div class="education-links"><a class="education-link" href="https://www.nps.gov/subjects/accessibility/interagency-access-pass.htm" target="_blank" rel="noopener"><strong>National Park Service Access Pass</strong><span>Current eligibility, documentation, benefits, and application options.</span><small>Open official page ↗</small></a></div></div></details><details class="education-card"><summary>📍 Find sensory-inclusive and autism-certified places</summary><div class="education-body"><p>Certification programs differ. Useful details include staff training, sensory guides, quiet spaces, sensory bags, flexible entry or re-entry, visual stories, accessible communication, and honest descriptions of noise, crowds, lights, waiting, and exits.</p><div class="education-links"><a class="education-link" href="https://www.kulturecity.org/sensory-inclusive/" target="_blank" rel="noopener"><strong>KultureCity venue finder</strong><span>Search trained Sensory Inclusive venues and available supports.</span><small>Search ↗</small></a><a class="education-link" href="https://autismtravel.com/" target="_blank" rel="noopener"><strong>AutismTravel directory</strong><span>IBCCES-trained and certified destinations, attractions, and businesses.</span><small>Search ↗</small></a><a class="education-link" href="https://www.nps.gov/aboutus/accessibility.htm" target="_blank" rel="noopener"><strong>National Park accessibility</strong><span>Open each park’s accessibility page before traveling.</span><small>Explore ↗</small></a></div><div class="local-fun-search"><input id="funLocation" placeholder="City, state, or ZIP code"><button id="searchFun" class="btn">Search local events</button></div><p class="hint">This opens a current web search because one-time library, museum, fair, movie, and community events change too quickly for an offline list.</p></div></details><details class="education-card"><summary>🚢 Autism-friendly cruising</summary><div class="education-body"><p>Royal Caribbean advertises autism-friendly services including priority boarding, dietary accommodations, flexible youth grouping, toy lending, sensory-friendly films, and a social story. Autism on the Seas offers extra staffed sailings on selected cruises. Services vary by ship and sailing; obtain accommodations in writing before paying.</p><ul><li>Ask about supervision limits, toileting policies, wandering safeguards, muster drills, dining, quiet spaces, medical care, port accessibility, and cancellation terms.</li><li>Certification does not guarantee every employee or situation will meet the child’s needs.</li></ul><div class="education-links"><a class="education-link" href="https://www.royalcaribbean.com/experience/accessible-cruising/autism-friendly-ships" target="_blank" rel="noopener"><strong>Royal Caribbean autism-friendly ships</strong><span>Current services and advance-notice instructions.</span><small>Open ↗</small></a><a class="education-link" href="https://autismontheseas.com/" target="_blank" rel="noopener"><strong>Autism on the Seas</strong><span>Selected staffed cruises and resort vacations.</span><small>Open ↗</small></a></div></div></details><details class="education-card"><summary>🎬 Sensory-friendly films</summary><div class="education-body"><p>These showings commonly keep lights partially raised, lower the sound, skip some previews, and allow guests to move or vocalize. Confirm details and showtimes with the individual theater.</p><div class="education-links"><a class="education-link" href="https://www.amctheatres.com/programs/sensory-friendly-films" target="_blank" rel="noopener"><strong>AMC Sensory Friendly Films</strong><span>Participating theaters and current scheduled films.</span><small>Find showings ↗</small></a><a class="education-link" href="https://www.regmovies.com/promotions/my-way-matinee" target="_blank" rel="noopener"><strong>Regal My Way Matinee</strong><span>Current sensory-friendly family screenings.</span><small>Find showings ↗</small></a></div></div></details>`;$("#searchFun").onclick=()=>{const place=$("#funLocation").value.trim();if(!place)return alert("Enter a city, state, or ZIP code.");open(`https://www.google.com/search?q=${encodeURIComponent(`autism sensory friendly events near ${place}`)}`,"_blank","noopener");};}

function openMedicalNecessityLetter(profiles){const names=profiles.map((p)=>p.name).join(" / ")||"[CHILD NAME]";const text=`[DATE]\n\nTo: [INSURANCE PLAN / MEDICAID / DME SUPPLIER]\nRe: Medical necessity for [ITEM OR SERVICE]\nPatient: ${names}\nDOB: [DATE OF BIRTH]\nMember ID: [ID]\n\nI am the treating [CLINICIAN TYPE] for [CHILD NAME]. The child has [RELEVANT DIAGNOSES AND FUNCTIONAL LIMITATIONS]. Because of these limitations, the child experiences [SPECIFIC SAFETY, HEALTH, HYGIENE, POSITIONING, COMMUNICATION, OR DAILY-LIVING PROBLEM].\n\nI am prescribing [EXACT ITEM, MODEL, SIZE, QUANTITY, OR SERVICE]. This item is medically necessary because it will [EXPLAIN HOW IT ADDRESSES THE DOCUMENTED PROBLEM]. Less costly or less restrictive alternatives tried or considered include [LIST], which were not sufficient because [REASON].\n\nWithout this item, the child is at risk for [SPECIFIC, DOCUMENTED CONSEQUENCES]. The requested item will be used [WHERE / HOW / HOW OFTEN], with caregiver supervision and training as required.\n\nPlease approve [ITEM]. Supporting records include [EVALUATION, SAFETY LOG, PHOTOS/MEASUREMENTS IF APPROPRIATE, THERAPY NOTES, DENIAL HISTORY]. Please contact me at [PHONE/FAX] with questions.\n\nSincerely,\n[CLINICIAN NAME, CREDENTIALS, NPI, SIGNATURE]` ;modalBody.innerHTML=`<h2>📄 Medical necessity letter</h2><p class="hint">The treating clinician must review, personalize, place on appropriate letterhead, and sign this. Approval is never guaranteed.</p><textarea id="medicalLetterText" class="template-letter">${esc(text)}</textarea><div class="btn-row"><button id="copyMedicalLetter" class="btn">Copy</button><button id="downloadMedicalLetter" class="btn secondary">Download .txt</button></div>`;modal.showModal();$("#copyMedicalLetter").onclick=async()=>{await navigator.clipboard.writeText($("#medicalLetterText").value);alert("Letter copied.");};$("#downloadMedicalLetter").onclick=()=>downloadBlob(new Blob([$("#medicalLetterText").value],{type:"text/plain"}),"Medical-Necessity-Letter-Template.txt");}

async function openAppointmentPrep(profiles){if(!profiles.length)return alert("Create a child profile first.");let profileId=profiles[0].id;const draw=async()=>{const x=await getSetting(`appointmentPrep:${profileId}`,{});modalBody.innerHTML=`<h2>📋 Appointment preparation</h2><div class="form-grid"><div class="field"><label>Child</label><select id="prepProfile">${profiles.map((p)=>`<option value="${p.id}" ${p.id===profileId?"selected":""}>${esc(p.name)}</option>`).join("")}</select></div><div class="field"><label>Visit type and date</label><input id="prepVisit" value="${esc(x.visit||"")}" placeholder="Developmental pediatrics — Oct. 12"></div><div class="field"><label>Top three concerns</label><textarea id="prepConcerns">${esc(x.concerns||"")}</textarea></div><div class="field"><label>Changes since last visit</label><textarea id="prepChanges">${esc(x.changes||"")}</textarea></div><div class="field"><label>Medicines, supplements, allergies</label><textarea id="prepMeds">${esc(x.meds||"")}</textarea></div><div class="field"><label>Questions and decisions needed</label><textarea id="prepQuestions">${esc(x.questions||"")}</textarea></div><button id="savePrep" class="btn">Save sheet</button></div>`;$("#prepProfile").onchange=async(e)=>{profileId=e.target.value;await draw();};$("#savePrep").onclick=async()=>{await setSetting(`appointmentPrep:${profileId}`,{visit:$("#prepVisit").value.trim(),concerns:$("#prepConcerns").value.trim(),changes:$("#prepChanges").value.trim(),meds:$("#prepMeds").value.trim(),questions:$("#prepQuestions").value.trim(),updatedAt:nowISO()});alert("Appointment sheet saved.");};};await draw();modal.showModal();}

async function openProviderReport(profiles){if(!profiles.length)return alert("Create a child profile first.");const p=profiles[0],words=(await getAll("words")).filter((x)=>x.profileId===p.id),wins=(await getAll("achievements")).filter((x)=>x.profileId===p.id),potty=(await getAll("pottyLogs")).filter((x)=>x.profileId===p.id),food=await getSetting(`foodDiary:${p.id}`,[]),skills=await getSetting(`lifeSkills:${p.id}`,[]),learning=await getSetting(`learningSnapshot:${p.id}`,{});const byType=(t)=>words.filter((x)=>(x.entryType||"word")===t);const report=`MORE THAN MEASURED — CAREGIVER-GENERATED SUMMARY\nGenerated: ${new Date().toLocaleString()}\nChild: ${p.name}\nBirth: ${p.birthDate||"Not entered"}\nSpecial interest: ${p.specialInterest||"Not entered"}\nCurrently working on: ${p.currentFocus||"Not entered"}\n\nCOMMUNICATION\nWords: ${byType("word").length} total; ${byType("word").filter((x)=>x.speak).length} say; ${byType("word").filter((x)=>x.identify).length} identify; ${byType("word").filter((x)=>x.asl).length} ASL\nSentences: ${byType("sentence").length}; Letters: ${byType("letter").length}; Numbers: ${byType("number").length}\n\nRECENT WINS\n${wins.sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,15).map((x)=>`- ${x.date||"Undated"}: ${x.title}`).join("\n")||"None entered"}\n\nLEARNING SNAPSHOT\nStrengths: ${learning.strengths||"Not entered"}\nStruggles/barriers: ${learning.struggles||"Not entered"}\nWhat helps: ${learning.helps||"Not entered"}\n\nLIFE SKILLS\n${skills.map((x)=>`- ${x.name}: ${x.status}${x.date?` (${x.date})`:""}`).join("\n")||"None entered"}\n\nFOOD DIARY\nSafe: ${food.filter((x)=>x.category==="safe").map((x)=>x.name).join(", ")||"None entered"}\nOccasional: ${food.filter((x)=>x.category==="sometimes").map((x)=>x.name).join(", ")||"None entered"}\nNot accepted: ${food.filter((x)=>x.category==="not").map((x)=>x.name).join(", ")||"None entered"}\n\nPOTTY TRACKER\nRecorded days: ${potty.length}\nPotty pees: ${potty.reduce((n,x)=>n+Number(x.pees||0),0)}; potty poops: ${potty.reduce((n,x)=>n+Number(x.poops||0),0)}; accidents: ${potty.reduce((n,x)=>n+Number(x.accidents||0),0)}\n\nThis caregiver-generated report is not a medical record or diagnosis. Verify details with the caregiver and clinical record.`;modalBody.innerHTML=`<h2>📊 Provider report</h2><div class="field"><label>Child</label><select id="reportProfile">${profiles.map((x)=>`<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></div><textarea id="providerReportText" class="template-letter">${esc(report)}</textarea><div class="btn-row"><button id="copyProviderReport" class="btn">Copy</button><button id="downloadProviderReport" class="btn secondary">Download .txt</button></div>`;modal.showModal();$("#reportProfile").onchange=()=>{modal.close();openProviderReport([profiles.find((x)=>x.id===$("#reportProfile").value),...profiles.filter((x)=>x.id!==$("#reportProfile").value)]);};$("#copyProviderReport").onclick=async()=>{await navigator.clipboard.writeText($("#providerReportText").value);alert("Report copied.");};$("#downloadProviderReport").onclick=()=>downloadBlob(new Blob([$("#providerReportText").value],{type:"text/plain"}),`${p.name.replace(/[^a-z0-9]+/gi,"-")}-Provider-Report.txt`);}

async function openAppointmentNotes(profiles){if(!profiles.length)return alert("Create a child profile first.");let profileId=profiles[0].id,notes=await getSetting(`appointmentNotes:${profileId}`,[]);const draw=()=>{modalBody.innerHTML=`<h2>📝 After-appointment notes</h2><div class="form-grid"><div class="field"><label>Child</label><select id="noteProfile">${profiles.map((p)=>`<option value="${p.id}" ${p.id===profileId?"selected":""}>${esc(p.name)}</option>`).join("")}</select></div><div class="field"><label>Date</label><input id="noteDate" type="date" value="${isoToday()}"></div><div class="field"><label>Provider / visit</label><input id="noteProvider"></div><div class="field"><label>What was decided</label><textarea id="noteBody"></textarea></div><div class="field"><label>Next steps and follow-up</label><textarea id="noteFollow"></textarea></div><button id="saveApptNote" class="btn">Save note</button></div><div class="list">${notes.sort((a,b)=>b.date.localeCompare(a.date)).map((x)=>`<div class="list-item"><div><strong>${esc(x.provider||"Appointment")}</strong><div class="hint">${fmtDate(x.date)}</div><p>${esc(x.body)}</p>${x.follow?`<p><strong>Next:</strong> ${esc(x.follow)}</p>`:""}</div></div>`).join("")}</div>`;$("#noteProfile").onchange=async(e)=>{profileId=e.target.value;notes=await getSetting(`appointmentNotes:${profileId}`,[]);draw();};$("#saveApptNote").onclick=async()=>{notes.push({id:uid(),date:$("#noteDate").value,provider:$("#noteProvider").value.trim(),body:$("#noteBody").value.trim(),follow:$("#noteFollow").value.trim(),createdAt:nowISO()});await setSetting(`appointmentNotes:${profileId}`,notes);draw();};};draw();modal.showModal();}

const EXAMPLE_SLEEP_ROUTINE = [
  ["45 minutes before", "Begin up to 30 minutes of active or heavy-work play if it helps this child: running, jumping, climbing, pushing, pulling, carrying, or outdoor play."],
  ["15 minutes before", "Shift clearly into wind-down: dim lights, reduce conversation and screens, and choose a familiar low-stimulation activity."],
  ["Wind-down", "Try a warm bath or wash-up if water is calming. Follow with pajamas and tolerated lotion or gentle pressure only if the child enjoys it."],
  ["Set the room", "Use the child’s preferred safe temperature, darkness or night-light, bedding texture, and quiet or steady background sound."],
  ["Connection", "Choose one calm activity such as cuddling, a familiar book, quiet music, coloring, a puzzle, or blocks."],
  ["Bedtime", "Use the same short goodnight phrase and final visual-schedule step, then provide the safest approved sleep space for this child."],
];

async function renderSleepSanctuary() {
  const profiles = await getAll("profiles");
  let profileId = profiles[0]?.id || "";
  let routine = [];
  let preferences = {};
  const sleepSetting = (name) => `sleep:${name}:${profileId}`;
  const profileOptions = profiles.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
  view.innerHTML = `<section class="hero sleep-hero"><h1>🌙 Sleep Sanctuary</h1><p>Gentle, practical tools for learning what helps your child rest. There is no single perfect bedtime—and sleep trouble is never a child or caregiver failure.</p></section>
  <div class="banner sleep-note"><strong>Start with safety and possible causes.</strong> Loud snoring, pauses or gasping, unusual nighttime movements, pain, reflux, constipation, itching, seizures, restless legs, or a sudden sleep change deserve a conversation with the child’s healthcare professional.</div>

  <h2 class="section-title">Understand sleep first</h2><div class="sleep-sections">
  <details class="education-card" open><summary>🧠 Why can sleep be harder for autistic children?</summary><div class="education-body"><p>Autistic children can have sleep challenges for many overlapping reasons. Their internal sleep-wake timing may work differently; sensory input that fades into the background for someone else may remain impossible to ignore; and anxiety, transitions, communication differences, or a strong need for predictability can make settling harder.</p><ul><li><strong>Sensory differences:</strong> seams, temperature, light, household sounds, smells, or the feeling of bedding may be calming one night and overwhelming another.</li><li><strong>Body-clock differences:</strong> melatonin timing and circadian rhythms may not line up neatly with the family schedule.</li><li><strong>Difficulty shifting gears:</strong> stopping a preferred activity and moving through several bedtime steps can be a major transition.</li><li><strong>Communication and interoception:</strong> a child may not yet be able to explain pain, hunger, fear, needing the bathroom, or that their body does not feel sleepy.</li><li><strong>Co-occurring needs:</strong> anxiety, ADHD, reflux, constipation, eczema, seizures, sleep apnea, restless legs, medication effects, or other health issues can interfere with sleep.</li></ul><p>Not every autistic child has sleep problems, and one child may have more than one cause. A simple sleep log can help a clinician notice patterns instead of guessing.</p><div class="education-links"><a class="education-link" href="https://www.aan.com/Guidelines/home/GuidelineDetail/988" target="_blank" rel="noopener"><strong>Autism and sleep guideline</strong><span>American Academy of Neurology guidance for families and clinicians.</span><small>Open source ↗</small></a></div></div></details>

  <details class="education-card"><summary>🕯️ Example bedtime routine</summary><div class="education-body"><p>Use the order as a starting point, not a rule. The exact clock time matters less than a predictable sequence that fits when your child is actually becoming sleepy.</p><ol class="sleep-example">${EXAMPLE_SLEEP_ROUTINE.map(([time, text]) => `<li><strong>${time}</strong><span>${esc(text)}</span></li>`).join("")}</ol><p>Try a picture schedule, keep spoken directions short, and change one part at a time. If a “calming” activity wakes your child up, believe what their body is showing you and move or replace it.</p></div></details>

  <details class="education-card" open><summary>🧩 Build your bedtime routine</summary><div class="education-body"><p>Create a separate routine for each child. Every change is saved to this device and included in a complete backup.</p>${profiles.length ? `<div class="field"><label>Child</label><select id="sleepProfile">${profileOptions}</select></div><div id="sleepRoutineList" class="sleep-routine-list"></div><div class="sleep-step-form"><div class="field"><label>Time (optional)</label><input id="sleepStepTime" placeholder="7:30 PM"></div><div class="field"><label>Routine step</label><input id="sleepStepText" placeholder="Read one familiar book"></div></div><div class="btn-row"><button id="addSleepStep" class="btn" type="button">Add step</button><button id="useSleepExample" class="btn secondary" type="button">Use example routine</button></div><p id="sleepSaveStatus" class="hint" role="status"></p>` : `<div class="empty"><div class="big">🌱</div><p>Create a child profile before building a saved routine.</p><button class="btn" data-go="child">Create profile</button></div>`}</div></details>

  <details class="education-card"><summary>🛏️ Make the sleep environment work better</summary><div class="education-body"><p>A supportive room is usually dim, quiet, comfortable, and predictable—but your child’s sensory preferences matter more than a generic checklist.</p><ul><li>Keep wake time and the wind-down sequence as consistent as family life allows.</li><li>Dim lights and pause screens about an hour before bed; charge devices outside the sleeping area when possible.</li><li>Try blackout curtains, a night-light, a fan, or steady background sound based on the child’s response.</li><li>Check pajamas, sheets, tags, seams, mattress feel, and temperature instead of assuming behavior is “bedtime resistance.”</li><li>Use beds only as the manufacturer intends. Follow age-specific safe-sleep guidance, especially for babies and young children.</li></ul><div class="education-links"><a class="education-link" href="https://www.healthychildren.org/English/healthy-living/sleep/Pages/healthy-sleep-habits-how-many-hours-does-your-child-need.aspx" target="_blank" rel="noopener"><strong>Healthy sleep habits</strong><span>American Academy of Pediatrics guidance on routines, screens, activity, and bedrooms.</span><small>Open source ↗</small></a><a class="education-link" href="https://www.autismspeaks.org/tool-kit/atnair-p-strategies-improve-sleep-children-autism" target="_blank" rel="noopener"><strong>Autism sleep strategies toolkit</strong><span>A practical family toolkit from the Autism Treatment Network.</span><small>Open source ↗</small></a></div></div></details>

  <details class="education-card"><summary>🧴 Magnesium vs. melatonin</summary><div class="education-body"><div class="sleep-compare"><div><h3>Melatonin</h3><p>Melatonin is a hormone involved in sleep timing. For some autistic children, clinician-guided melatonin can help after routines and contributing health issues have been addressed. Timing and product quality matter, and long-term safety information in children is limited.</p><ul><li>Talk with the child’s clinician before starting it; do not choose a dose from the internet or another child.</li><li>In the U.S. it is sold as a supplement, so the amount can differ from the label. Ask about a quality-verified product.</li><li>Treat gummies like medicine and lock them away. Possible effects include sleepiness, headache, dizziness, or irritability.</li></ul></div><div><h3>Magnesium</h3><p>Magnesium is an essential nutrient, but that does not make a supplement a proven treatment for childhood insomnia or autism-related sleep problems. A clinician may address a true deficiency; routine use for sleep has much less supporting evidence.</p><ul><li>Food sources and supplements are not interchangeable.</li><li>Supplements can cause diarrhea, nausea, and cramping, can interact with medicines, and can be dangerous in excess or with kidney problems.</li><li>Ask the child’s clinician or pharmacist before using it and keep supplements out of reach.</li></ul></div></div><div class="banner"><strong>Neither is the automatic first step.</strong> Current autism sleep guidance starts by checking medical and medication causes and using behavioral sleep strategies. A clinician can then help decide whether melatonin is appropriate.</div><div class="education-links"><a class="education-link" href="https://aasm.org/advocacy/position-statements/melatonin-use-in-children-and-adolescents-health-advisory/" target="_blank" rel="noopener"><strong>Melatonin health advisory</strong><span>American Academy of Sleep Medicine safety guidance.</span><small>Open source ↗</small></a><a class="education-link" href="https://ods.od.nih.gov/factsheets/Magnesium-Consumer/" target="_blank" rel="noopener"><strong>Magnesium fact sheet</strong><span>NIH supplement safety, interactions, and age-based limits.</span><small>Open source ↗</small></a></div></div></details>

  <details class="education-card"><summary>🏥 Medical and safety beds</summary><div class="education-body"><p>A medical or enclosed safety bed may be considered when ordinary beds and less restrictive safety changes do not adequately address a documented risk such as entrapment, falls, injury, or nighttime wandering. It is not simply a sensory purchase.</p><ul><li>Work with the prescribing clinician, occupational or physical therapist, and a durable-medical-equipment supplier to match the bed to the child’s actual risks.</li><li>Insurance or Medicaid may require a prescription, letter of medical necessity, safety history, measurements, and proof that less costly alternatives were considered. Denials can sometimes be appealed.</li><li>Ask about ventilation, gap and entrapment testing, emergency release, evacuation, monitoring, cleaning, warranty, growth limits, and whether enclosure is considered a restraint in your setting.</li><li>Never improvise a canopy, tent, rail, net, or restraint, and never modify the bed outside the manufacturer’s instructions.</li></ul><div class="banner"><strong>Product links are examples, not endorsements or affiliate links.</strong> Eligibility, contraindications, funding, and safe use must be reviewed for the individual child.</div><div class="education-links"><a class="education-link" href="https://cubbybeds.com/" target="_blank" rel="noopener"><strong>Cubby Bed</strong><span>Enclosed safety-bed information, specifications, and funding resources.</span><small>Visit manufacturer ↗</small></a><a class="education-link" href="https://safetysleeper.com/" target="_blank" rel="noopener"><strong>The Safety Sleeper</strong><span>Portable enclosed-bed models and funding information.</span><small>Visit manufacturer ↗</small></a><a class="education-link" href="https://sleepsafebed.com/" target="_blank" rel="noopener"><strong>SleepSafe Beds</strong><span>Fixed safety-bed models, accessories, and insurance guidance.</span><small>Visit manufacturer ↗</small></a><a class="education-link" href="https://bedsbygeorge.com/" target="_blank" rel="noopener"><strong>Beds by George</strong><span>Medical safety-bed models and funding documentation.</span><small>Visit manufacturer ↗</small></a><a class="education-link" href="https://www.fda.gov/medical-devices/general-hospital-devices-and-supplies/hospital-beds" target="_blank" rel="noopener"><strong>Hospital-bed safety</strong><span>FDA information about entrapment risks and safe bed use.</span><small>Open safety source ↗</small></a></div></div></details>

  <details class="education-card" open><summary>💜 Discover your child’s preferences</summary><div class="education-body"><p>Observe rather than assume. Try one safe change for several nights when possible, note what happened, and invite the child’s choice or assent in whatever way they communicate.</p>${profiles.length ? `<div class="field"><label>Child</label><select id="sleepPrefProfile">${profileOptions}</select></div><div class="sleep-pref-grid"><div class="field"><label>Temperature</label><select id="sleepTemp"><option value="">Not sure yet</option><option>Cool</option><option>Neutral</option><option>Warm</option><option>Changes from night to night</option></select></div><div class="field"><label>Pressure or compression</label><select id="sleepPressure"><option value="">Not sure yet</option><option>No compression</option><option>Light tucked-in feeling</option><option>Firm pressure</option><option>Changes from night to night</option></select></div><div class="field"><label>Fabric and texture</label><input id="sleepTexture" placeholder="Smooth cotton, fleece, no seams…"></div><div class="field"><label>Light</label><select id="sleepLight"><option value="">Not sure yet</option><option>Very dark</option><option>Night-light</option><option>Door cracked</option><option>Hall light</option></select></div><div class="field"><label>Sound</label><input id="sleepSound" placeholder="Silence, fan, white noise, music…"></div><div class="field"><label>Movement before bed</label><input id="sleepMovement" placeholder="Rocking, swinging, stretching, none…"></div></div><div class="field"><label>What we noticed</label><textarea id="sleepNotes" placeholder="What helped, what did not, and signs your child was comfortable or uncomfortable"></textarea></div><button id="saveSleepPreferences" class="btn full" type="button">Save preferences</button><p id="sleepPrefStatus" class="hint" role="status"></p>` : `<div class="empty"><p>Create a child profile to save a preference worksheet.</p></div>`}<div class="banner"><strong>Weighted or compression products need extra care.</strong> They are not right for every child. Ask the child’s clinician or occupational therapist about individual risks, use only age-appropriate products as directed, and never use a product that prevents the child from moving, breathing freely, or removing it independently. Do not use weighted sleep products for infants.</div></div></details>
  </div>`;

  bindRouteButtons();
  const sleepCards = document.querySelectorAll(".sleep-sections > .education-card");
  if (sleepCards[4]) sleepCards[4].insertAdjacentHTML("beforebegin", `<details class="education-card"><summary>🌙 Your family’s 45-minute routine, safely adapted</summary><div class="education-body"><h3>First 30 minutes: active play</h3><p>Running, jumping, climbing, pushing, pulling, carrying, or outdoor play may help some children settle. Other children become more alert, so move active play earlier when it delays sleep. Daylight and activity during the day also support a healthy sleep schedule.</p><h3>Final 15 minutes: lower stimulation</h3><p>Dim lights and choose a familiar calm activity: cuddling, a puzzle, coloring, drawing, blocks, quiet music, or a gentle show if that works in real family life. A warm bath, tolerated lotion, or gentle firm touch may be calming when the child enjoys it.</p><h3>Sound and night-lights</h3><p>A sound machine can mask unpredictable noise and become a familiar cue; it does not calm every nervous system. Keep it away from the child’s head and at the lowest useful volume. A dim projector or night-light may soothe one child and keep another awake. Avoid bright or rapidly moving patterns after settling begins.</p><h3>Temperature, pressure, and safe stimming</h3><p>Many children prefer a cooler room, but comfort is individual. Compression sheets, sleep socks, and cushioned products require correct sizing, free breathing and movement, and the ability to exit. If rocking or head banging occurs, ask the child’s clinician or occupational therapist about injury reduction that preserves safe regulation.</p><div class="banner"><strong>Do not improvise a sleep enclosure.</strong> Use only the mattress, padding, rails, and enclosure approved by the manufacturer for that exact sleep product. Added mattresses or makeshift barriers can create dangerous gaps. Medical-bed coverage requires individual medical necessity and varies by plan.</div><h3>Magnesium baths and lotions</h3><p>Magnesium flakes, lotions, and tallow products have not been established as reliable treatments for childhood insomnia, and skin absorption and product quality vary. If the child takes oral magnesium or magnesium-containing medicine, ask the clinician or pharmacist before adding any other magnesium product.</p></div></details>`);
  if (sleepCards[4]) sleepCards[4].insertAdjacentHTML("afterend", `<details class="education-card"><summary>🧴 Magnesium: how it works, forms, and evidence</summary><div class="education-body"><p>Magnesium is essential for normal nerve and muscle function and participates in pathways involving neurotransmission and the body’s sleep-wake system. It is often described as calming because it helps regulate excitatory and inhibitory signaling, including pathways involving GABA, and is involved indirectly in melatonin biology. That biological role does <strong>not</strong> prove that extra magnesium acts as a sedative when a child already has enough.</p><div class="banner"><strong>What the sleep evidence says:</strong> Some studies in adults suggest possible modest sleep benefits, but results are conflicting and the studies are generally small or low quality. Good evidence has not established that magnesium supplements reliably lengthen deep sleep, prevent awakenings, or reduce anxiety or sensory overload in autistic children.</div><h3>Common forms caregivers may see</h3><ul><li><strong>Magnesium glycinate:</strong> magnesium bound to glycine. It is commonly marketed for sleep and is often better tolerated than forms with a stronger laxative effect, but it has not been proven to be the universally “best” sleep form for autistic children.</li><li><strong>Magnesium citrate:</strong> generally well absorbed and more likely to loosen stools. It may be used medically for constipation, but constipation treatment and sleep supplementation are different goals; diarrhea can cause dehydration or discomfort.</li><li><strong>Magnesium L-threonate:</strong> marketed for brain penetration and cognition. It is usually expensive, and evidence for pediatric sleep or autism-related benefits is insufficient.</li><li><strong>Magnesium sulfate/Epsom salts:</strong> a warm bath can be a soothing sensory routine, but clinically meaningful magnesium absorption through intact skin has not been established. Treat it as a bath preference—not an equivalent replacement for prescribed oral magnesium.</li></ul><h3>Before choosing any form</h3><ul><li>Ask what problem is being treated and whether deficiency, constipation, insomnia, pain, anxiety, or another issue needs evaluation.</li><li>Add up magnesium from supplements, antacids, laxatives, multivitamins, and prescribed products.</li><li>Review kidney disease, heart conditions, swallowing safety, diarrhea risk, and medicine interactions with the child’s clinician or pharmacist.</li><li>Use the clinician’s age-appropriate dose and timing; do not copy an adult product label or another child’s dose.</li></ul><div class="education-links"><a class="education-link" href="https://www.nccih.nih.gov/health/sleep-disorders-and-complementary-health-approaches" target="_blank" rel="noopener"><strong>Magnesium and sleep evidence</strong><span>NIH review of the limited and conflicting insomnia research.</span><small>Open source ↗</small></a><a class="education-link" href="https://ods.od.nih.gov/factsheets/Magnesium-Consumer/" target="_blank" rel="noopener"><strong>Magnesium safety</strong><span>Age-based supplement limits, side effects, and interactions.</span><small>Open source ↗</small></a></div></div></details>`);
  if (sleepCards[6]) sleepCards[6].insertAdjacentHTML("afterend", `<details class="education-card"><summary>🛍️ Sleep products</summary><div class="education-body"><p>This section is ready for the sleep products your family recommends or wants to compare.</p><div class="empty"><div class="big">🌙</div><p>Sound machines, night-lights, projectors, bedding, compression products, room-temperature tools, and other sleep supports will be added here later.</p></div><div class="banner">Future product entries will include the intended use, age and safety considerations, sensory features, drawbacks, and a direct link. Products will not be presented as guaranteed sleep treatments.</div></div></details>`);
  if (!profiles.length) return;
  const routineList = $("#sleepRoutineList");
  const status = $("#sleepSaveStatus");
  const prefFields = { temperature: "#sleepTemp", pressure: "#sleepPressure", texture: "#sleepTexture", light: "#sleepLight", sound: "#sleepSound", movement: "#sleepMovement", notes: "#sleepNotes" };
  const showSaved = (el, message) => { el.textContent = message; setTimeout(() => { if (el.textContent === message) el.textContent = ""; }, 2200); };
  const saveRoutine = async () => { await setSetting(sleepSetting("routine"), routine); showSaved(status, "Routine saved on this device."); };
  const drawRoutine = () => {
    routineList.innerHTML = routine.length ? routine.map((step, index) => `<div class="sleep-routine-row"><div><strong>${esc(step.time || "Any time")}</strong><span>${esc(step.text)}</span></div><div class="sleep-row-actions"><button type="button" data-sleep-up="${index}" aria-label="Move up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-sleep-down="${index}" aria-label="Move down" ${index === routine.length - 1 ? "disabled" : ""}>↓</button><button type="button" data-sleep-edit="${index}">Edit</button><button type="button" data-sleep-delete="${index}">Delete</button></div></div>`).join("") : `<div class="empty"><p>No routine steps saved yet.</p></div>`;
    routineList.querySelectorAll("[data-sleep-up]").forEach((b) => b.onclick = async () => { const i = Number(b.dataset.sleepUp); [routine[i - 1], routine[i]] = [routine[i], routine[i - 1]]; await saveRoutine(); drawRoutine(); });
    routineList.querySelectorAll("[data-sleep-down]").forEach((b) => b.onclick = async () => { const i = Number(b.dataset.sleepDown); [routine[i + 1], routine[i]] = [routine[i], routine[i + 1]]; await saveRoutine(); drawRoutine(); });
    routineList.querySelectorAll("[data-sleep-edit]").forEach((b) => b.onclick = async () => { const i = Number(b.dataset.sleepEdit); const text = prompt("Edit this routine step", routine[i].text); if (text === null || !text.trim()) return; const time = prompt("Edit the optional time", routine[i].time || "") ; if (time === null) return; routine[i] = { ...routine[i], text: text.trim(), time: time.trim() }; await saveRoutine(); drawRoutine(); });
    routineList.querySelectorAll("[data-sleep-delete]").forEach((b) => b.onclick = async () => { const i = Number(b.dataset.sleepDelete); if (!confirm(`Delete “${routine[i].text}”?`)) return; routine.splice(i, 1); await saveRoutine(); drawRoutine(); });
  };
  const loadChildSleep = async () => {
    routine = await getSetting(sleepSetting("routine"), []);
    preferences = await getSetting(sleepSetting("preferences"), {});
    drawRoutine();
    Object.entries(prefFields).forEach(([key, selector]) => { $(selector).value = preferences[key] || ""; });
    $("#sleepProfile").value = profileId;
    $("#sleepPrefProfile").value = profileId;
  };
  $("#sleepProfile").onchange = async (e) => { profileId = e.target.value; await loadChildSleep(); };
  $("#sleepPrefProfile").onchange = async (e) => { profileId = e.target.value; await loadChildSleep(); };
  $("#addSleepStep").onclick = async () => { const text = $("#sleepStepText").value.trim(); if (!text) return alert("Please enter a routine step."); routine.push({ id: uid(), time: $("#sleepStepTime").value.trim(), text }); $("#sleepStepTime").value = ""; $("#sleepStepText").value = ""; await saveRoutine(); drawRoutine(); };
  $("#useSleepExample").onclick = async () => { if (routine.length && !confirm("Replace this child’s current routine with the example?")) return; routine = EXAMPLE_SLEEP_ROUTINE.map(([time, text]) => ({ id: uid(), time, text })); await saveRoutine(); drawRoutine(); };
  $("#saveSleepPreferences").onclick = async () => { preferences = Object.fromEntries(Object.entries(prefFields).map(([key, selector]) => [key, $(selector).value.trim()])); await setSetting(sleepSetting("preferences"), preferences); showSaved($("#sleepPrefStatus"), "Preferences saved on this device."); };
  await loadChildSleep();
}

const FRIENDLY_PLACES={
  "🎢 Theme parks":[
    ["Sesame Place","Langhorne, PA & San Diego, CA","Certified Autism Center resources, sensory guides, quiet spaces, hearing protection, and ride-accessibility support.","https://sesameplace.com/philadelphia/help/autism-resources/"],
    ["LEGOLAND Resorts","California, Florida & New York","Certified staff, attraction sensory guides, quiet or low-sensory spaces, and disability-access programs. Rules vary by resort.","https://www.legoland.com/new-york/plan-your-visit/know-before-you-go/special-situations-accessibility/certified-autism-center/"],
    ["Dollywood","Pigeon Forge, TN","Calming room, accessibility guide, and Boarding Pass program based on individual needs and ride requirements—not unlimited front-of-line access.","https://www.dollywood.com/accessibility/"],
    ["Morgan’s Wonderland","San Antonio, TX","Designed for guests of diverse abilities. The guest with a qualifying special need is admitted free; confirm current companion pricing.","https://morganswonderland.org/"],
    ["SeaWorld parks","Orlando, San Antonio & San Diego","Ride Accessibility Program, sensory guides, and quiet-space resources vary by park; selected areas or parks hold CAC designation.","https://seaworld.com/orlando/help/guests-with-disabilities/"],
    ["Six Flags parks","Nationwide","Sensory guides and the current Individual Accessibility Card process. Verify park-specific registration and ride rules.","https://www.sixflags.com/accessibility"],
    ["American Dream","East Rutherford, NJ","Accessibility resources for indoor attractions including Nickelodeon Universe and DreamWorks Water Park; verify each attraction’s supports.","https://www.americandream.com/accessibility"]
  ],
  "🦏 Zoos":[
    ["Cincinnati Zoo & Botanical Garden","Cincinnati, OH","Sensory map, quiet locations, and visit-planning resources.","https://cincinnatizoo.org/plan-your-visit/accessibility/"],
    ["Santa Barbara Zoo","Santa Barbara, CA","Autism and sensory resources may include trained staff, sensory tools, and selected low-sensory programming.","https://www.sbzoo.org/accessibility"],
    ["Fort Wayne Children’s Zoo","Fort Wayne, IN","Certified Autism Center training and sensory planning information.","https://kidszoo.org/visit/accessibility/"],
    ["Zoo Miami","Miami, FL","Accessibility and sensory resources; confirm current sensory-bag availability.","https://www.zoomiami.org/accessibility"],
    ["ABQ BioPark","Albuquerque, NM","Certified Autism Center resources across the zoo, aquarium, botanic garden, and related facilities.","https://www.cabq.gov/artsculture/biopark/biopark-connect/accessibility"]
  ],
  "🐠 Aquariums":[
    ["Georgia Aquarium","Atlanta, GA","Certified and sensory-inclusive venue with morning low-sensory hours, quiet areas, sensory bags, and a sensory room.","https://www.georgiaaquarium.org/accessibility/"],
    ["Ripley’s Aquarium","Myrtle Beach, SC","Certified Autism Center resources and selected sensory-friendly events with environmental adjustments.","https://www.ripleyaquariums.com/myrtlebeach/sensory-friendly/"],
    ["OdySea Aquarium","Scottsdale, AZ","Certified Autism Center with a quiet room, sensory guide, and staff support.","https://www.odyseaaquarium.com/plan-your-visit/accessibility/"],
    ["Aquarium of the Pacific","Long Beach, CA","Selected Autism Families Nights and accessibility resources; dates require current registration.","https://www.aquariumofpacific.org/events/info/autism_families_night/"],
    ["Adventure Aquarium","Camden, NJ","Sensory and accessibility resources may include noise-reduction tools and weighted lap items; verify availability.","https://www.adventureaquarium.com/plan-your-visit/accessibility"],
    ["National Aquarium","Baltimore, MD","KultureCity Sensory Inclusive resources including trained staff, sensory bags, and planning support.","https://aqua.org/visit/accessibility"]
  ],
  "🎉 Recurring programs":[
    ["Chuck E. Cheese Sensory Sensitive Sundays","Participating locations","Selected Sunday hours with reduced sound and lighting and limited flashing effects. Participation and dates vary.","https://www.chuckecheese.com/sensory-sensitive-sundays/"],
    ["AMC Sensory Friendly Films","Participating theaters","Lights raised, sound lowered, and movement or vocalizing welcomed at selected screenings.","https://www.amctheatres.com/programs/sensory-friendly-films"],
    ["Regal My Way Matinee","Participating theaters","Selected family films with brighter lighting and reduced sound.","https://www.regmovies.com/promotions/my-way-matinee"],
    ["Please Touch Museum","Philadelphia, PA","Accessibility resources and periodic sensory-friendly programming.","https://www.pleasetouchmuseum.org/accessibility/"],
    ["Cayton Children’s Museum","Santa Monica, CA","Check current accessibility supports and sensory-friendly event schedule.","https://www.caytonmuseum.org/accessibility"]
  ]
};
function renderAsdFriendlyFunExpanded(){
  renderAsdFriendlyFun();
  const cards=document.querySelectorAll(".education-card"), html=Object.entries(FRIENDLY_PLACES).map(([heading,places])=>`<h3>${heading}</h3><div class="friendly-place-list">${places.map(([name,location,description,url])=>`<a href="${url}" target="_blank" rel="noopener"><strong>${esc(name)}</strong><small>${esc(location)}</small><span>${esc(description)}</span></a>`).join("")}</div>`).join("");
  if(cards[1])cards[1].insertAdjacentHTML("afterend",`<details class="education-card"><summary>🗺️ Autism-friendly places to explore</summary><div class="education-body"><p>Programs, certifications, admission rules, and event schedules change. Confirm accommodations before buying tickets. Certification usually means training and planning resources; it does not guarantee that every space will be quiet or fit every visitor.</p>${html}<div class="banner"><strong>Federal Access Pass detail:</strong> At per-vehicle sites the pass generally covers the pass holder and occupants of one noncommercial vehicle. At per-person sites it generally covers the pass holder plus up to three adults; children under 16 are ordinarily admitted free. Concessions, special permits, and every recreation fee are not automatically included.</div></div></details>`);
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
  ["Regression", "Regression means losing a skill that was already being used—such as words, gestures, play, social connection, toileting, movement, or a daily-living skill. It is different from having an off day, using a skill less during stress, or temporarily needing more help. Some autistic children experience developmental regression, often in the toddler years, but a new, sudden, or continuing loss of skills deserves prompt attention from the child’s healthcare professional. Write down what changed and when, and mention illness, pain, sleep, seizures, medication changes, stress, or other changes you noticed. Regression is not the child’s fault, and it does not erase who they are or everything they have learned."],
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
  view.innerHTML = `<section class="hero"><h1>📚 Skill Building</h1><p>Practical tools for supporting everyday skills at your child’s pace.</p></section><h2 class="section-title">Daily living</h2><div class="grid"><button class="card-button" data-go="lifeSkills"><span class="emoji">🌟</span><strong>Life Skills Tracker</strong><small>Track new daily-living skills, practice, help, and independence.</small></button><button class="card-button" data-go="potty"><span class="emoji">🚽</span><strong>Potty Training Tracker</strong><small>Track potty successes and accidents by day.</small></button><button class="card-button" data-go="pottyTips"><span class="emoji">💡</span><strong>Potty Training Tips & Tricks</strong><small>Gentle, practical ideas to support learning and comfort.</small></button><button id="learningGuide" class="card-button"><span class="emoji">🧠</span><strong>How autistic children learn</strong><small>Strengths-first teaching ideas, prompting, repetition, and generalization.</small></button><button id="strengthsStruggles" class="card-button"><span class="emoji">🧭</span><strong>Strengths & struggles</strong><small>Save a personal learning snapshot for each child.</small></button><button id="diaperHelp" class="card-button"><span class="emoji">🧷</span><strong>Diapers & pull-ups through Medicaid</strong><small>Coverage questions, medical necessity, EPSDT, and supplier steps.</small></button><button id="imaginationLibrary" class="card-button"><span class="emoji">📚</span><strong>Imagination Library</strong><small>Check for free monthly books for children from birth to age five.</small></button><button id="skillProducts" class="card-button"><span class="emoji">🛍️</span><strong>Skill-building products</strong><small>Product categories and safer shopping questions.</small></button></div>`;
  bindRouteButtons();
  $("#learningGuide").onclick=()=>openInfoGuide("🧠 How autistic children learn",`<p>There is no single autistic learning style. Begin with the individual child: what gets their attention, how they communicate, what sensory input helps, what makes a task meaningful, and how much language they can process in that moment.</p><ul><li>Show as well as tell: use modeling, pictures, gestures, objects, or a short visual sequence.</li><li>Break a task into small teachable steps and celebrate real attempts.</li><li>Use interests as a bridge to connection and practice—not as something the child must earn back.</li><li>Give processing time before repeating a direction.</li><li>Practice in several places and with several people; a learned skill may not automatically transfer.</li><li>Reduce prompts gradually so help does not become part of the task forever.</li><li>Presume competence while still providing the support the child needs.</li></ul>`);
  $("#strengthsStruggles").onclick=openLearningSnapshot;
  $("#diaperHelp").onclick=()=>openInfoGuide("🧷 Diapers and pull-ups through Medicaid",`<p>Some Medicaid programs cover incontinence supplies for an enrolled child when they are medically necessary, often after the age when continence is normally expected. Rules, ages, quantities, diagnoses, and approved suppliers vary by state and plan.</p><ol><li>Call the number on the Medicaid card and ask for the written benefit and prior-authorization criteria for pediatric incontinence supplies.</li><li>Ask the child’s clinician to document the condition, expected duration, size, daily quantity, skin or hygiene risks, and why ordinary retail supplies do not meet the need.</li><li>Use an in-network durable-medical-equipment or medical-supply company; many suppliers help gather the prescription and authorization.</li><li>If denied, request the written reason and appeal instructions. Ask whether EPSDT applies to the medically necessary item.</li></ol><p><a href="https://www.medicaid.gov/medicaid/benefits/early-and-periodic-screening-diagnostic-and-treatment/index.html" target="_blank" rel="noopener">Medicaid EPSDT information ↗</a></p><div class="banner">Coverage is not automatic based on an autism diagnosis alone.</div>`);
  $("#imaginationLibrary").onclick=()=>openInfoGuide("📚 Dolly Parton’s Imagination Library",`<p>Participating local programs mail one free, age-appropriate book each month from birth until a child turns five. Availability depends on the local program serving the child’s address; it is not an autism-only benefit and generally has no income test.</p><p><a href="https://imaginationlibrary.com/usa/find-my-program/" target="_blank" rel="noopener">Check availability by ZIP code ↗</a></p>`);
  $("#skillProducts").onclick=()=>openProductGuide("Skill building",["Visual schedules and first-then boards","Easy-grip utensils and open-cup trainers","Dressing practice boards and adaptive fasteners","Toothbrushing timers and mirrors","Footstools, toilet inserts, and easy clothing","Task boxes, matching sets, and fine-motor tools"]);
}

function openInfoGuide(title, html){modalBody.innerHTML=`<h2>${title}</h2><div class="education-body">${html}</div><button id="closeInfoGuide" class="btn full">Close</button>`;modal.showModal();$("#closeInfoGuide").onclick=()=>modal.close();}
function openProductGuide(title, items){openInfoGuide(`🛍️ ${title} products`,`<p>These are shopping categories, not endorsements. Choose products around the child’s actual goal, age, size, motor skills, sensory preferences, cleaning needs, supervision, and choking or entrapment risks.</p><ul>${items.map((x)=>`<li>${esc(x)}</li>`).join("")}</ul><p><a href="https://www.amazon.com/s?k=${encodeURIComponent(title+" autism tools")}" target="_blank" rel="noopener">Search products ↗</a></p><div class="banner">A product should support participation or safety—not force a child to look less autistic.</div>`);}
async function openLearningSnapshot(){const profiles=await getAll("profiles");if(!profiles.length)return alert("Create a child profile first.");let profileId=profiles[0].id;const draw=async()=>{const value=await getSetting(`learningSnapshot:${profileId}`,{});modalBody.innerHTML=`<h2>🧭 Strengths & struggles</h2><div class="form-grid"><div class="field"><label>Child</label><select id="snapshotProfile">${profiles.map((p)=>`<option value="${p.id}" ${p.id===profileId?"selected":""}>${esc(p.name)}</option>`).join("")}</select></div><div class="field"><label>Strengths</label><textarea id="snapshotStrengths" placeholder="What comes naturally? What brings confidence and joy?">${esc(value.strengths||"")}</textarea></div><div class="field"><label>Struggles or barriers</label><textarea id="snapshotStruggles" placeholder="What is difficult, exhausting, painful, confusing, or still developing?">${esc(value.struggles||"")}</textarea></div><div class="field"><label>What helps</label><textarea id="snapshotHelps">${esc(value.helps||"")}</textarea></div><button id="saveSnapshot" class="btn">Save snapshot</button></div>`;$("#snapshotProfile").onchange=async(e)=>{profileId=e.target.value;await draw();};$("#saveSnapshot").onclick=async()=>{await setSetting(`learningSnapshot:${profileId}`,{strengths:$("#snapshotStrengths").value.trim(),struggles:$("#snapshotStruggles").value.trim(),helps:$("#snapshotHelps").value.trim(),updatedAt:nowISO()});alert("Learning snapshot saved.");};};await draw();modal.showModal();}

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
      <h3>What can a child’s SSI be spent on?</h3><p><strong>Regular monthly SSI</strong> is for the child’s current needs. A representative payee should first use it for the child’s food, housing or shelter share, clothing, medical and dental care not otherwise covered, and personal needs. Depending on the child’s needs, appropriate spending can also include items such as hygiene supplies, transportation, education, recreation, therapy, communication supports, and other personal expenses that benefit the child. Save what remains for the child and remember that saved money or a major purchase can affect SSI resource eligibility.</p>
      <p>Keep the child’s money identifiable, keep records and receipts, and do not use it for the caregiver’s personal expenses. Because household costs are shared, document a reasonable child’s share rather than treating the entire household bill as the child’s expense. Ask SSA before an unusual or major purchase if you are unsure.</p>
      <div class="banner"><strong>Dedicated account is different:</strong> A large past-due SSI payment for a child may have to go into a separate dedicated account. That money generally cannot pay ordinary food, clothing, or shelter. It is restricted mainly to medical treatment, education or job training and disability-related personal assistance, special equipment, housing modifications, therapy or rehabilitation, and other items SSA approves. Keep dedicated-account receipts and bank statements for at least two years, and contact SSA before an uncertain purchase.</div>
      <p>If denied, read the notice carefully. Appeal deadlines are generally short, and starting a new application is not always the same as appealing the original decision. A disability attorney or qualified advocate may help, especially at later appeal stages.</p>
      <div class="education-links">${benefitLink("https://www.ssa.gov/ssi/eligibility", "SSI eligibility", "Current income, resource, and disability basics.", "Social Security Administration")}${benefitLink("https://www.ssa.gov/apply/ssi", "Apply for SSI", "Choose whether the application is for a child or adult and see current process information.", "Social Security Administration")}${benefitLink("https://www.ssa.gov/disability/disability_starter_kits.htm", "Child Disability Starter Kit", "SSA’s checklist, worksheet, and preparation guide.", "Social Security Administration")}${benefitLink("https://www.ssa.gov/pubs/EN-05-10076.pdf", "Guide for Representative Payees", "How monthly benefits should be managed, saved, and documented.", "Social Security Administration")}${benefitLink("https://www.ssa.gov/ssi/spotlights/spot-dedicated-accounts.htm", "Dedicated accounts for children", "Special restrictions for certain large past-due SSI payments.", "Social Security Administration")}</div>
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

function renderSafetyInformation() {
  const safetyLink = (url, title, description, tag = "") =>
    `<a class="education-link" href="${url}" target="_blank" rel="noopener noreferrer"><strong>${esc(title)} ↗</strong><span>${esc(description)}</span>${tag ? `<small>${esc(tag)}</small>` : ""}</a>`;
  view.innerHTML = `<section class="hero"><h1>🛟 ASD Safety</h1><p>Practical layers of protection for wandering, travel, water, emergencies, and everyday life.</p></section>
  <div class="banner safety-note"><strong>This is not about parenting through fear.</strong> Some autistic children have little awareness of traffic, water, strangers, heat, or getting lost—and some cannot reliably tell a helper their name or address. A few calm preparations can give the whole family more breathing room.</div>
  <div class="banner safety-warning"><strong>Use layers:</strong> No tracker, alarm, identification item, swim lesson, or car seat can be the entire safety plan. Choose safeguards for this child’s actual abilities and update them as the child grows.</div>

  <h2 class="section-title">A strong starting plan</h2>
  <ol class="benefits-start card safety-start"><li><strong>Prevent when possible.</strong><span>Secure likely exits and hazards while preserving safe fire escape.</span></li><li><strong>Know what draws or overwhelms the child.</strong><span>Water, playgrounds, roads, favorite signs, animals, noise, demands, fear, or sensory overload may shape where they go.</span></li><li><strong>Make the child easier to locate and help.</strong><span>Use current photos, identification, trusted contacts, and an optional location device.</span></li><li><strong>Practice the response.</strong><span>Everyone should know who calls 911, where to search first, and what information to share.</span></li></ol>

  <h2 class="section-title">Safety topics</h2>
  <div class="education-sections safety-sections">
    <details class="education-card" open><summary>🚪 Wandering and leaving a safe area</summary><div class="education-body">
      <p>Wandering—sometimes called elopement—is more than an ordinary toddler dash. It means leaving a safe place or caregiver in a way that could lead to harm. It can happen quickly and is not proof that a caregiver was careless.</p>
      <h3>Layers that may help</h3><ul><li>Door and window alarms, chimes, securely placed locks, gates, and pool barriers suited to the home and local fire code.</li><li>A visual stop sign, routine, or cue at exits—but never a visual cue as the only barrier.</li><li>Teaching “stop,” “wait,” responding to a name, showing an ID card, and returning to a trusted adult in small, positive steps.</li><li>Tell school, childcare, relatives, and respite workers what wandering looks like, likely destinations, triggers, and who must be notified.</li><li>Keep a current photo, height, weight, clothing description, communication needs, calming approaches, attractions, aversions, and medical information ready.</li></ul>
      <h3>If the child is missing</h3><ul><li><strong>Call 911 immediately.</strong> Do not wait. Say the child is autistic or otherwise vulnerable, may not respond to their name, and may be drawn to water or traffic.</li><li>Search nearby water first when water is an attraction, while another adult checks other high-risk and favorite locations.</li><li>Give responders a recent photo and explain communication, sensory, approach, and safety needs.</li><li>At a store or attraction, immediately ask staff to begin their missing-child procedure, sometimes called Code Adam.</li></ul>
      <div class="education-links">${safetyLink("https://www.cdc.gov/child-development/disability-safety/wandering.html", "CDC wandering guidance", "Planning, prevention, identification, safety skills, and first-responder preparation.", "Centers for Disease Control and Prevention")}${safetyLink("https://www.healthychildren.org/English/health-issues/conditions/Autism/Pages/Autism-Wandering-Tips-AAP.aspx", "AAP wandering safety tips", "Home, school, sleep, water, and emergency-planning ideas.", "American Academy of Pediatrics")}</div>
    </div></details>

    <details class="education-card"><summary>📍 AngelSense, GPS trackers, and locator programs</summary><div class="education-body">
      <p>Wearable GPS/cellular products such as <strong>AngelSense</strong> and similar devices may provide location updates, geofences, alerts, and caregiver communication. Compare battery life, water resistance, attachment method, cellular coverage, subscription cost, school policy, privacy, and whether the child will tolerate wearing it.</p>
      <p><strong>Project Lifesaver</strong> is different from an ordinary consumer GPS tracker. Participating public-safety agencies enroll eligible people and use a wearable radio-frequency transmitter and trained search teams. Availability, enrollment rules, equipment, and fees vary locally.</p>
      <ul><li>Test the device where the family actually goes—not just at home.</li><li>Charge it on a routine and enable low-battery and removal alerts when offered.</li><li>Give access only to trusted caregivers and use a strong, unique account password.</li><li>Do not delay calling 911 while trying to locate a device signal yourself.</li><li>Batteries die, devices can be removed, signals can fail indoors, and cellular service can disappear.</li></ul>
      <div class="banner"><strong>Product note:</strong> More than Measured does not endorse or receive payment from AngelSense or another tracker. It is named because caregivers commonly ask about it.</div>
      <div class="education-links">${safetyLink("https://projectlifesaver.org/about-us/where-we-are/", "Find a Project Lifesaver program", "Check whether a participating public-safety agency serves your area.", "Project Lifesaver International")}</div>
    </div></details>

    <details class="education-card"><summary>🪪 Identification for nonspeaking or vulnerable children</summary><div class="education-body">
      <p>An ID item can speak for a child who cannot reliably give their name, address, or caregiver’s number—especially when frightened or overwhelmed.</p>
      <ul><li>Medical ID bracelet, silicone band, shoe tag, necklace, watch-band tag, or secure clothing label.</li><li>Communication card in a pocket, backpack, AAC case, school bag, or emergency pouch.</li><li>Vehicle seat-belt sleeve or backpack tag that tells a responder where to find emergency information.</li><li>Temporary ID band or written caregiver number for fairs, parks, travel, and crowded events.</li></ul>
      <h3>Sample wording</h3><p><em>“I am autistic. I may not speak or answer questions. Please stay with me and call [caregiver name] at [number]. I may be frightened by sirens or touch. I communicate using [AAC, gestures, ASL, or words].”</em></p>
      <p>Use the least public personal information that still helps. A caregiver phone number is often safer than printing a full home address. Keep it current and teach the child to show it when possible.</p>
    </div></details>

    <details class="education-card"><summary>🚗 Car seats, harness escaping, and vehicle safety</summary><div class="education-body">
      <p>Start with the seat that matches the child’s age, height, weight, developmental needs, and manufacturer limits. Keep a child rear-facing or harnessed as long as the approved seat allows, and have the installation checked.</p>
      <p>If the child unbuckles, escapes the harness, has poor trunk or head control, or cannot safely use an ordinary seat, ask the clinician and a <strong>Child Passenger Safety Technician experienced with special healthcare needs</strong> for an individual evaluation. Specialized restraints may require a prescription, training, different installation, or funding approval.</p>
      <ul><li>Do not add an aftermarket buckle guard, chest clip, padding, positioning piece, or restraint the car-seat or vehicle manufacturer has not approved.</li><li>Never use a device that could trap the child or prevent a rescuer from quickly releasing them.</li><li>Follow both the car-seat and vehicle manuals, use the top tether when required, register the seat for recalls, and recheck fit as the child grows.</li><li>Use child locks where appropriate, keep keys inaccessible, and teach that a parked vehicle is not a play space.</li></ul>
      <div class="education-links">${safetyLink("https://www.nhtsa.gov/campaign/right-seat", "Car-seat finder and inspections", "Choose an appropriate restraint and find a certified inspection station.", "National Highway Traffic Safety Administration")}${safetyLink("https://www.nhtsa.gov/vehicle-safety/adapted-vehicles", "Transportation with special needs", "Passenger evaluations, specialized seating, and adapted vehicles.", "National Highway Traffic Safety Administration")}</div>
    </div></details>

    <details class="education-card"><summary>🏊 Water safety and swim lessons</summary><div class="education-body">
      <h3>Why are some autistic children drawn to water?</h3>
      <p>There is no single reason, and not every autistic child loves water. For some, water offers soothing pressure, buoyancy, gentle resistance, repeating movement, sparkling reflections, or predictable sounds. It may feel quieter and easier on the body than a busy room. Other children are fascinated by pouring, ripples, drains, fountains, or reflections. A child may also run toward water while exploring or while trying to escape noise, demands, pain, or overwhelm.</p>
      <p>Enjoying water can become a wonderful strength and source of regulation. The concern is that a strong attraction may exist before the child understands depth, currents, temperature, slippery edges, or that every body of water is different.</p>

      <div class="banner water-fact"><strong>The drowning risk is real.</strong> Current American Academy of Pediatrics guidance reports that autistic children and adolescents have about <strong>three times the drowning risk</strong> of children without ASD, and fatal drowning often happens after a child wanders into water. Earlier research is often quoted as saying drowning is the “number one cause of death” among autistic children through age 14. A more careful description is that drowning is a <strong>leading cause of unintentional injury death</strong> in autistic children; the older finding should not be read as the number-one cause of every death among all autistic children. The AAP has also reported that wandering preceded nearly 74% of fatal drowning incidents studied among autistic children.</div>

      <h3>Whenever you are around water</h3>
      <ul><li>Choose one capable adult as the <strong>water watcher</strong>. That person stays close, watches continuously, and does not use a phone, read, drink alcohol, or assume another adult is watching.</li><li>Use <strong>touch supervision</strong> for young children and anyone who is not water competent—stay close enough to reach them immediately.</li><li>At beaches, lakes, rivers, splash pads, parties, and unfamiliar homes, identify the water and exits before settling in. Ask directly whether there is a pool, pond, hot tub, creek, or open gate.</li><li>Use a properly fitted, U.S. Coast Guard-approved life jacket for boating and when the setting, child’s ability, or conditions call for it. Inflatable arm bands and pool toys are not safety devices.</li><li>Teach skills in small steps: wait for permission, enter safely, turn back to the wall, float, tread water, reach an exit, and climb out. Practice with different instructors and settings when possible because a skill learned in one pool may not automatically transfer elsewhere.</li><li>Choose an instructor who accepts AAC, gestures, breaks, sensory supports, repetition, and one-to-one lessons if a group is overwhelming. Consider practicing an unexpected fall into water while wearing ordinary clothes and shoes under qualified supervision.</li><li>Learn CPR, keep a phone nearby, know the exact location or address, and call 911 immediately for a water emergency.</li></ul>

      <h3>If you own a pool or hot tub</h3>
      <ul><li>Install a non-climbable, <strong>four-sided isolation fence</strong> that separates the pool from the house and yard, with a self-closing, self-latching gate. Follow state and local height, gate, and barrier codes.</li><li>Keep patio furniture, toys, and other climbable objects away from the fence. Never prop the gate open.</li><li>Add door, window, gate, and pool alarms as backup layers. Test them routinely, replace batteries, and make sure every caregiver can hear or receive the alert.</li><li>Use approved drain covers and keep rescue equipment available. Secure pool chemicals and remove toys from the water so they do not invite an unsupervised return.</li><li>Empty small pools immediately after use. Cover and lock hot tubs; remember that covers and alarms do not replace fencing or supervision.</li><li>Create a rule for who confirms the pool area is clear and secured after every use, gathering, or caregiver handoff.</li></ul>

      <h3>If you live near water</h3>
      <ul><li>Walk the neighborhood and map every pool, pond, creek, river, drainage ditch, retention basin, fountain, well, and other water source the child could reach.</li><li>Put those locations—in search priority order—into the wandering plan and give the list to regular caregivers. If the child goes missing, <strong>call 911 immediately and direct searchers to nearby water first</strong>.</li><li>Use layered home exit protection suited to the child: door and window alarms, chimes, gates, and safely placed locks that still allow emergency escape.</li><li>Tell trusted neighbors, school staff, and local first responders that the child may be drawn to water, may not respond to their name, and may communicate differently.</li><li>Use identification and, when appropriate, a charged location device as added layers—not replacements for barriers, supervision, or the emergency plan.</li></ul>

      <p><strong>Swimming ability does not make a child drown-proof.</strong> Lessons, life jackets, barriers, alarms, identification, location devices, and supervision each cover a different gap.</p>
      <div class="education-links">${safetyLink("https://www.cdc.gov/drowning/risk-factors/index.html", "Drowning risk factors", "Current autism risk information and general drowning-risk guidance.", "Centers for Disease Control and Prevention")}${safetyLink("https://publications.aap.org/pediatrics/article/doi/10.1542/peds.2026-077410/207630/Prevention-of-Drowning-Policy-Statement", "AAP drowning-prevention guidance", "Current pediatric evidence and layered prevention recommendations.", "American Academy of Pediatrics")}${safetyLink("https://www.redcross.org/take-a-class/swimming/swim-lessons", "Find swim lessons", "Search for Learn-to-Swim providers for children and adults.", "American Red Cross")}${safetyLink("https://www.redcross.org/get-help/how-to-prepare-for-emergencies/types-of-emergencies/water-safety/swim-safety.html", "Water-safety guidance", "Supervision, water competency, life jackets, and safer swimming.", "American Red Cross")}</div>
    </div></details>

    <details class="education-card"><summary>🏠 Home, fire, medication, and household safety</summary><div class="education-body">
      <ul><li>Anchor furniture and televisions; secure medications, cleaners, sharp objects, firearms, lighters, and button batteries.</li><li>Use appropriate window guards without blocking emergency escape.</li><li>Check smoke and carbon-monoxide alarms and consider visual, vibrating, or voice options when sound alone may not work.</li><li>Practice a short fire-escape routine. Tell firefighters if the child may hide, resist touch, run, or not respond to spoken directions.</li><li>Use visual labels or locks for high-risk spaces while keeping safe spaces easy to reach.</li><li>Prepare for power loss if AAC, medication refrigeration, feeding, monitoring, or sensory-regulation equipment needs electricity.</li></ul>
      <p>Ask the local 911 center, police, sheriff, or fire department whether they offer a voluntary vulnerable-person registry, premise alert, or emergency profile. Names and privacy rules vary, so ask who can see it and how to update or remove it.</p>
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

async function renderCaregiver() {
  const appointments = await getAll("appointments"),
    todos = await getAll("todos"),
    activeTodos = todos.filter((item) => !item.completed).length,
    upcoming = appointments.filter((item) => item.date >= isoToday()).length;
  view.innerHTML = `<section class="hero"><h1>💛 Caregiver Corner</h1><p>Support, organization, and clear information for the caregiver.</p></section>
  <h2 class="section-title">Caregiver support</h2>
  <div class="grid">
    <button id="caregiverBabysitter" class="card-button"><strong>🧑‍🍼 Babysitter care sheet</strong><small>Pull saved care details into editable text that can be shared without an app.</small></button>
    <button id="caregiverEmergencyContacts" class="card-button"><strong>☎️ Emergency contacts</strong><small>Save multiple contacts per child for redundancy and care-sheet sharing.</small></button>
    <button id="caregiverEncouragement" class="card-button"><strong>💬 Encouragement</strong><small>Weekly messages and strength-focused reminders.</small></button>
    <button id="caregiverTerms" class="card-button"><strong>📖 Common terms</strong><small>Plain-language explanations of autism and sensory terminology.</small></button>
    <button id="caregiverSigns" class="card-button"><strong>🧭 Signs of autism</strong><small>Social communication, repetition, routines, sensory differences, and when to ask for an evaluation.</small></button>
    <button id="caregiverAggression" class="card-button"><strong>🫶 Aggressive behaviors</strong><small>Why they may happen, what they can look like, safer responses, and what to avoid.</small></button>
    <button id="caregiverEducation" class="card-button"><strong>🎓 Educational options</strong><small>Homeschooling, school choices, IEPs, 504 plans, resources, and letter templates.</small></button>
    <button id="caregiverAssessment" class="card-button"><strong>🧭 Autism assessment information</strong><small>When assessment can begin, how it works, what to bring, and what to expect.</small></button>
    <button id="caregiverBenefits" class="card-button"><strong>🤲 Benefits & financial support</strong><small>Paid caregiving, SSI and SSDI, Medicaid, tax help, respite, and overlooked resources.</small></button>
    <button id="caregiverSafety" class="card-button"><strong>🛟 ASD safety</strong><small>Wandering, trackers, identification, car seats, water, home, school, and emergency planning.</small></button>
    <button id="caregiverTherapy" class="card-button"><strong>🧩 Therapy & support</strong><small>ABA, speech, OT, AAC, other therapies, wait lists, benefits, concerns, and what to expect.</small></button>
    <button id="caregiverCalendar" class="card-button"><strong>📅 Calendar</strong><small>${upcoming} upcoming ${upcoming === 1 ? "appointment" : "appointments"}.</small></button>
    <button id="caregiverTodos" class="card-button"><strong>✅ To-do list</strong><small>${activeTodos} active ${activeTodos === 1 ? "task" : "tasks"}.</small></button>
    <button class="card-button future-feature" data-feature="Reflection"><strong>📝 Reflection</strong><small>Private notes and observations.</small></button>
    <button class="card-button future-feature" data-feature="Support messaging"><strong>🤝 Support messaging</strong><small>A future premium support option with clear boundaries.</small></button>
  </div>`;
  $("#caregiverBabysitter").onclick = openBabysitterCareSheet;
  $("#caregiverEmergencyContacts").onclick = openEmergencyContacts;
  $("#caregiverEncouragement").onclick = openWeeklyEncouragement;
  $("#caregiverTerms").onclick = openTermsGuide;
  $("#caregiverSigns").onclick = openAutismSignsGuide;
  $("#caregiverAggression").onclick = openAggressionGuide;
  $("#caregiverEducation").onclick = () => navigate("education");
  $("#caregiverAssessment").onclick = () => navigate("assessment");
  $("#caregiverBenefits").onclick = () => navigate("benefits");
  $("#caregiverSafety").onclick = () => navigate("safety");
  $("#caregiverTherapy").onclick = () => navigate("therapy");
  $("#caregiverCalendar").onclick = openCaregiverCalendar;
  $("#caregiverTodos").onclick = () => openTodoList("active");
  document
    .querySelectorAll(".future-feature")
    .forEach((b) => (b.onclick = () => underConstruction(b.dataset.feature)));
}

function openAutismSignsGuide(){openInfoGuide("🧭 Signs of autism",`<p>Autism can look very different from one child to another. A checklist cannot diagnose a child, and one trait by itself does not mean autism. What matters is the overall developmental pattern, how early it began, and how it affects daily life.</p><h3>Social communication and connection</h3><ul><li>Responds to their name inconsistently or less than expected.</li><li>Uses fewer gestures, such as showing, waving, reaching, or pointing to share interest.</li><li>Shares enjoyment or attention in a different way; eye contact is only one possible signal and should not be forced.</li><li>Has delayed speech, loses previously used communication, repeats language, uses memorized scripts, or communicates mainly through movement, behavior, signs, pictures, or AAC.</li><li>Finds back-and-forth play, conversation, pretend play, or joining peers difficult or different.</li></ul><h3>Repetition, routines, interests, and sensory patterns</h3><ul><li>Repeats movements, sounds, phrases, play patterns, or ways of arranging objects.</li><li>Has strong focused interests or notices details other people miss.</li><li>Needs predictability or becomes very distressed by changes and transitions.</li><li>Seeks or avoids sounds, light, touch, movement, tastes, smells, pain, or temperature.</li><li>Has unusual eating, sleep, movement, attention, fear, or emotional-regulation patterns.</li></ul><h3>What to do when you are concerned</h3><p>Write down specific examples and when they started. Bring them to the child’s pediatrician and ask for developmental screening and, when appropriate, an autism evaluation. In the United States, families can also contact early intervention before age 3 or the local public-school system at age 3 and older. Support for communication, feeding, sleep, movement, or hearing does not have to wait for a final autism diagnosis.</p><div class="banner"><strong>Prompt medical attention:</strong> A new or continuing loss of words, movement, awareness, play, toileting, or other established skills should be discussed promptly with the child’s healthcare professional.</div><div class="education-links"><a class="education-link" href="https://www.cdc.gov/autism/signs-symptoms/index.html" target="_blank" rel="noopener"><strong>CDC signs and symptoms</strong><span>Examples across social communication, repetition, routines, sensory reactions, and development.</span><small>Official source ↗</small></a><a class="education-link" href="https://www.cdc.gov/autism/diagnosis/index.html" target="_blank" rel="noopener"><strong>CDC screening information</strong><span>How developmental monitoring, screening, and diagnostic evaluation differ.</span><small>Official source ↗</small></a></div>`);}

function openAggressionGuide(){openInfoGuide("🫶 Understanding aggressive behaviors",`<p>Hitting, kicking, biting, scratching, pushing, throwing, or damaging objects can be frightening and unsafe. The behavior needs a safety response, but it is also information: something is wrong, unavailable, overwhelming, painful, or not yet communicateable. Autism itself does not make a child violent, and the child is not “bad.”</p><h3>Why it may happen</h3><ul><li><strong>Communication:</strong> trying to say stop, no, help, break, pain, finished, or give it back.</li><li><strong>Sensory overload or dysregulation:</strong> noise, crowds, touch, heat, transitions, accumulated demands, or loss of control.</li><li><strong>Pain or illness:</strong> constipation, reflux, dental or ear pain, headache, injury, infection, hunger, thirst, or poor sleep.</li><li><strong>Fear, anxiety, frustration, or trauma:</strong> especially when the child cannot explain what happened.</li><li><strong>Access or escape:</strong> reaching a wanted item/activity or getting away from a demand or setting. This describes the function; it does not mean the distress is fake.</li><li><strong>Skill mismatch:</strong> the task, wait, language, impulse control, or emotional demand exceeds what the child can manage in that moment.</li></ul><h3>What it can look like</h3><p>Aggression may be sudden or build through pacing, louder sounds, rigid posture, running, grabbing, pushing materials away, crying, or repeated language. It can be directed toward caregivers, siblings, peers, providers, pets, or property. Self-injury is different but may occur during the same overwhelmed state and also needs assessment.</p><h3>What to do in the moment</h3><ul><li>Stay as calm as possible and use few, concrete words: “I won’t let you hit. You’re safe. Break.”</li><li>Create distance, move other children and pets, and quietly remove hard, sharp, breakable, or throwable objects.</li><li>Reduce noise, light, talking, eye-contact demands, and extra people. Keep an exit route for everyone.</li><li>Offer an accessible way to communicate <em>stop, break, help, pain, yes/no</em>—speech, sign, picture, or AAC.</li><li>Block immediate harm only as safely and briefly as necessary. Avoid restraint unless trained, legally authorized, and needed for an immediate danger; restraint can injure or traumatize.</li><li>Afterward, allow recovery before teaching or discussing. Check for injuries and document what happened before, during, and after.</li></ul><h3>What helps between episodes</h3><ul><li>Ask the pediatrician about new, severe, or escalating aggression and screen for pain, sleep, GI, dental, neurologic, medication, hearing, and mental-health contributors.</li><li>Track patterns: time, setting, people, demands, sensory conditions, sleep, food, illness, communication attempts, duration, and what helped.</li><li>Teach replacement communication during calm moments and honor it whenever safely possible.</li><li>Use predictable routines, visual warnings, real choices, manageable steps, movement or sensory supports, and scheduled breaks.</li><li>Seek a qualified, individualized functional assessment when behavior is frequent or dangerous. Goals should improve safety and communication—not punish harmless autistic traits.</li></ul><h3>What not to do</h3><ul><li>Do not shame, yell, threaten, lecture during overload, crowd the child, demand eye contact, or force an apology before regulation returns.</li><li>Do not assume every episode is “attention seeking” or deliberately manipulative.</li><li>Do not remove the child’s AAC or other communication method as punishment.</li><li>Do not ignore sudden behavior change; pain and illness can be expressed through behavior.</li><li>Do not use seclusion, pain, food deprivation, humiliating consequences, or untrained holds.</li></ul><div class="banner"><strong>Emergency:</strong> If someone is in immediate danger, an injury needs urgent care, a weapon is involved, or the caregiver cannot maintain safety, call emergency services. Tell responders the child is autistic, how they communicate, what escalates them, and what helps. Ask for crisis responders trained in developmental disability when available.</div><div class="education-links"><a class="education-link" href="https://www.healthychildren.org/English/health-issues/conditions/Autism/Pages/autism-spectrum-disorder.aspx" target="_blank" rel="noopener"><strong>American Academy of Pediatrics autism overview</strong><span>Co-occurring pain, sleep, GI, anxiety, irritability, and aggression concerns.</span><small>Clinical family guidance ↗</small></a></div>`);}

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
  modalBody.innerHTML = `<h2>Restore preview</h2><div class="card"><p><strong>Created:</strong> ${fmtDate(b.exportedAt)}</p><p><strong>App version:</strong> ${esc(b.appVersion)}</p><p><strong>Profiles:</strong> ${b.data.profiles.length}</p><p><strong>Wins:</strong> ${b.data.achievements.length}</p><p><strong>Speech & Language entries:</strong> ${b.data.words.length}</p><p><strong>Potty-training days:</strong> ${(b.data.pottyLogs || []).length}</p><p><strong>Appointments:</strong> ${(b.data.appointments || []).length}</p><p><strong>To-do items:</strong> ${(b.data.todos || []).length}</p><p><strong>Notes:</strong> ${b.data.notes.length}</p></div><div class="banner" style="margin-top:12px">A safety checkpoint will be created before current data changes.</div><div class="btn-row"><button id="replaceRestore" type="button" class="btn danger">Replace current data</button><button id="mergeRestore" type="button" class="btn secondary">Merge safely</button></div>`;
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
    ["🗣️", "Speech & Language", "speech"],
    ["🌙", "Sleep Sanctuary", "sleep"],
    ["🫧", "Sensory Support", "sensory"],
    ["🩺", "Health & Wellness", "health"],
    ["📚", "Skill Building", "skills"],
    ["📚", "Resources", "resources"],
    ["🎡", "ASD Friendly Fun", "fun"],
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
  setupDrawer();
  setupPWA();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      birthdayGreetingsShown = false;
    } else if (currentRoute === "home" && !modal.open) {
      showBirthdayGreetingsIfNeeded().catch(() => {});
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
