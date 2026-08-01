/* UI wiring: screens, progress storage, and the typing loop. */

/* ---------- storage ---------- */

const STORE_KEY = "ttype.v1";

const defaultStore = () => ({
  progress: {},           // lessonId -> { stars, bestWpm, bestAcc, plays }
  settings: { strict: true, keyboard: true, sound: true, unlockAll: false, theme: "dark" },
  history: [],            // { t, wpm, acc, label }
  keyErrors: {},          // char -> lifetime miss count
  totalMs: 0,
  lastLesson: null
});

let store = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultStore();
    const parsed = JSON.parse(raw);
    const base = defaultStore();
    return { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings || {}) } };
  } catch (e) {
    return defaultStore();
  }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (e) {
    /* private mode or full quota — progress just won't persist */
  }
}

/* ---------- element lookup ---------- */

const $ = (id) => document.getElementById(id);

const el = {
  screens: {
    home: $("screen-home"),
    session: $("screen-session"),
    results: $("screen-results")
  },
  lessonGrid: $("lessonGrid"),
  statLessons: $("statLessons"),
  statWpm: $("statWpm"),
  statAcc: $("statAcc"),
  statTime: $("statTime"),
  resumeBar: $("resumeBar"),
  resumeTitle: $("resumeTitle"),
  weakDesc: $("weakDesc"),
  historyBlock: $("historyBlock"),
  historyChart: $("historyChart"),

  sessionTitle: $("sessionTitle"),
  sessionSubtitle: $("sessionSubtitle"),
  typingText: $("typingText"),
  typingHint: $("typingHint"),
  typingPanel: document.querySelector(".typing-panel"),
  liveWpm: $("liveWpm"),
  liveAcc: $("liveAcc"),
  liveTime: $("liveTime"),
  progressFill: $("progressFill"),
  guideArea: $("guideArea"),
  fingerName: $("fingerName"),
  keyboardRoot: $("keyboard"),

  resultStars: $("resultStars"),
  resultHeadline: $("resultHeadline"),
  resultSub: $("resultSub"),
  resWpm: $("resWpm"),
  resAcc: $("resAcc"),
  resTime: $("resTime"),
  resErrors: $("resErrors"),
  troubleBlock: $("troubleBlock"),
  troubleKeys: $("troubleKeys"),
  resNextBtn: $("resNextBtn"),

  settingsModal: $("settingsModal")
};

const keyboard = new Keyboard(el.keyboardRoot);

/* ---------- session state ---------- */

let engine = null;
let charEls = [];
let ticker = null;
let current = null;  // { kind: "lesson"|"practice", lesson?, practiceKind? }

/* ---------- screens ---------- */

function show(name) {
  for (const key in el.screens) el.screens[key].classList.toggle("active", key === name);
  window.scrollTo({ top: 0, behavior: "auto" });
}

function goHome() {
  stopTicker();
  engine = null;
  renderHome();
  show("home");
}

/* ---------- home ---------- */

function lessonUnlocked(lesson) {
  if (store.settings.unlockAll) return true;
  if (lesson.id === 1) return true;
  return Boolean(store.progress[lesson.id - 1]);
}

function starString(n) {
  return "★".repeat(n) + "☆".repeat(3 - n);
}

function renderHome() {
  /* headline numbers */
  const done = Object.keys(store.progress).length;
  el.statLessons.textContent = `${done}/${LESSONS.length}`;

  const bestWpm = store.history.reduce((m, h) => Math.max(m, h.wpm), 0);
  el.statWpm.textContent = bestWpm ? bestWpm : "—";

  if (store.history.length) {
    const recent = store.history.slice(-10);
    const avg = Math.round(recent.reduce((s, h) => s + h.acc, 0) / recent.length);
    el.statAcc.textContent = avg + "%";
  } else {
    el.statAcc.textContent = "—";
  }

  const mins = Math.round(store.totalMs / 60000);
  el.statTime.textContent = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;

  /* resume */
  const next = LESSONS.find((l) => !store.progress[l.id]);
  if (next && done > 0) {
    el.resumeBar.classList.remove("hidden");
    el.resumeTitle.textContent = `Lesson ${next.id} — ${next.title}`;
    $("resumeBtn").onclick = () => startLesson(next);
  } else {
    el.resumeBar.classList.add("hidden");
  }

  /* lesson cards */
  el.lessonGrid.innerHTML = "";
  for (const lesson of LESSONS) {
    const rec = store.progress[lesson.id];
    const unlocked = lessonUnlocked(lesson);

    const card = document.createElement("button");
    card.className = "lesson-card" + (unlocked ? "" : " locked") + (rec ? " done" : "");
    card.disabled = !unlocked;

    const chips = (lesson.newKeys.length ? lesson.newKeys : ["review"])
      .map((k) => `<span class="key-chip">${k === " " ? "space" : escapeHtml(k)}</span>`)
      .join("");

    card.innerHTML = `
      <div class="lesson-num">LESSON ${lesson.id}</div>
      <div class="lesson-name">${lesson.title}</div>
      <div class="key-chips">${chips}</div>
      <div class="lesson-foot">
        <span class="stars-mini">${rec ? starString(rec.stars) : ""}</span>
        <span>${rec ? rec.bestWpm + " wpm" : "not started"}</span>
      </div>
      ${unlocked ? "" : '<span class="lock-icon">🔒</span>'}
    `;
    card.onclick = () => unlocked && startLesson(lesson);
    el.lessonGrid.appendChild(card);
  }

  /* trouble keys blurb */
  const weak = topWeakKeys(3);
  el.weakDesc.textContent = weak.length
    ? "Right now: " + weak.map((k) => (k === " " ? "space" : k)).join("  ")
    : "Drills built from your mistakes";

  /* history */
  if (store.history.length >= 2) {
    el.historyBlock.classList.remove("hidden");
    drawHistory();
  } else {
    el.historyBlock.classList.add("hidden");
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function topWeakKeys(n) {
  return Object.entries(store.keyErrors)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

function drawHistory() {
  const canvas = el.historyChart;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 900;
  const cssH = 180;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const data = store.history.slice(-24);
  const pad = { l: 34, r: 12, t: 14, b: 22 };
  const w = cssW - pad.l - pad.r;
  const h = cssH - pad.t - pad.b;

  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue("--accent").trim() || "#4f9cf9";
  const faint = css.getPropertyValue("--text-faint").trim() || "#666";
  const border = css.getPropertyValue("--border-soft").trim() || "#222";

  const maxWpm = Math.max(20, ...data.map((d) => d.wpm));
  const top = Math.ceil(maxWpm / 10) * 10;

  /* gridlines */
  ctx.strokeStyle = border;
  ctx.fillStyle = faint;
  ctx.font = "11px system-ui, sans-serif";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const v = (top / 4) * i;
    const y = pad.t + h - (v / top) * h;
    ctx.beginPath();
    ctx.moveTo(pad.l, Math.round(y) + 0.5);
    ctx.lineTo(pad.l + w, Math.round(y) + 0.5);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillText(String(Math.round(v)), pad.l - 8, y + 4);
  }

  if (data.length < 2) return;

  const x = (i) => pad.l + (w * i) / (data.length - 1);
  const y = (v) => pad.t + h - (v / top) * h;

  /* area */
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + h);
  grad.addColorStop(0, hexToRgba(accent, 0.22));
  grad.addColorStop(1, hexToRgba(accent, 0));
  ctx.beginPath();
  ctx.moveTo(x(0), y(data[0].wpm));
  data.forEach((d, i) => ctx.lineTo(x(i), y(d.wpm)));
  ctx.lineTo(x(data.length - 1), pad.t + h);
  ctx.lineTo(x(0), pad.t + h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  /* line */
  ctx.beginPath();
  data.forEach((d, i) => (i ? ctx.lineTo(x(i), y(d.wpm)) : ctx.moveTo(x(i), y(d.wpm))));
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();

  /* points */
  ctx.fillStyle = accent;
  data.forEach((d, i) => {
    ctx.beginPath();
    ctx.arc(x(i), y(d.wpm), 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

function hexToRgba(hex, alpha) {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full, 16);
  if (isNaN(num)) return `rgba(79,156,249,${alpha})`;
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

/* ---------- starting a session ---------- */

function startLesson(lesson) {
  current = { kind: "lesson", lesson };
  store.lastLesson = lesson.id;
  save();
  beginSession(buildDrill(lesson), `Lesson ${lesson.id} — ${lesson.title}`, SUBTITLES[lesson.id], lesson.keys);
}

function startPractice(kind) {
  current = { kind: "practice", practiceKind: kind };
  const meta = PRACTICE_META[kind];
  const text = practiceDrill(kind, topWeakKeys(5));
  beginSession(text, meta.title, meta.subtitle, "abcdefghijklmnopqrstuvwxyz,.;'/");
}

function beginSession(text, title, subtitle, taughtKeys) {
  engine = new TypingEngine(text, { strict: store.settings.strict });

  el.sessionTitle.textContent = title;
  el.sessionSubtitle.textContent = subtitle || "";
  el.typingHint.textContent = pick(HINTS);
  el.guideArea.classList.toggle("hidden", !store.settings.keyboard);

  keyboard.setTaught(taughtKeys || "");
  renderText(text);
  updateCursor();
  updateLive();
  show("session");
  startTicker();
}

function renderText(text) {
  el.typingText.innerHTML = "";
  charEls = [];

  const frag = document.createDocumentFragment();
  let word = document.createElement("span");
  word.className = "word";

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const span = document.createElement("span");
    span.className = "ch" + (ch === " " ? " spc" : "");
    span.textContent = ch;
    charEls.push(span);
    word.appendChild(span);

    if (ch === " ") {
      frag.appendChild(word);
      word = document.createElement("span");
      word.className = "word";
    }
  }
  if (word.childNodes.length) frag.appendChild(word);
  el.typingText.appendChild(frag);
  el.typingText.scrollTop = 0;
}

/* ---------- during a session ---------- */

function updateCursor() {
  if (!engine) return;

  charEls.forEach((span, i) => {
    const state = engine.states[i];
    span.classList.toggle("correct", state === "correct");
    span.classList.toggle("wrong", state === "wrong");
    span.classList.toggle("space", state === "wrong" && engine.text[i] === " ");
    span.classList.toggle("current", i === engine.index);
  });

  const nextCh = engine.nextChar;
  const finger = store.settings.keyboard ? keyboard.showNext(nextCh) : null;
  setFinger(finger);
  scrollToCursor();
}

/* Keep the active line in view, one line down from the top edge, so there is
   always a line of context above and a couple of lines to read ahead. */
function scrollToCursor() {
  const span = charEls[engine.index] || charEls[charEls.length - 1];
  if (!span) return;
  const box = el.typingText;
  const lineHeight = parseFloat(getComputedStyle(box).lineHeight) || 40;
  const lineTop = span.offsetTop;
  const maxTop = Math.max(0, box.scrollHeight - box.clientHeight);

  const above = lineTop < box.scrollTop;
  const below = lineTop + lineHeight > box.scrollTop + box.clientHeight;
  if (above || below) {
    box.scrollTop = Math.min(maxTop, Math.max(0, lineTop - lineHeight));
  }
}

function setFinger(fingerId) {
  document.querySelectorAll(".finger, .thumb").forEach((f) => {
    const on = fingerId && f.dataset.finger === fingerId;
    f.classList.toggle("on", Boolean(on));
    if (on) f.style.setProperty("--fc", `var(--f-${fingerId})`);
  });
  el.fingerName.textContent = fingerId ? FINGERS[fingerId].name : "—";
}

function updateLive() {
  if (!engine) return;
  el.liveWpm.textContent = engine.wpm;
  el.liveAcc.textContent = engine.accuracy + "%";
  el.liveTime.textContent = formatTime(engine.elapsedMs);
  el.progressFill.style.width = (engine.progress * 100).toFixed(1) + "%";
}

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function startTicker() {
  stopTicker();
  ticker = setInterval(() => {
    if (engine && engine.started && !engine.finished) updateLive();
  }, 200);
}

function stopTicker() {
  if (ticker) clearInterval(ticker);
  ticker = null;
}

function handleKey(e) {
  if (!el.screens.session.classList.contains("active")) return;
  if (!el.settingsModal.classList.contains("hidden")) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === "Escape") {
    goHome();
    return;
  }

  if (e.key === "Backspace" || e.key === "Tab" || e.key === " " || e.key === "'" || e.key === "/") {
    e.preventDefault();
  }
  if (e.key.length !== 1 && e.key !== "Backspace") return;

  const result = engine.press(e.key);
  if (result.type === "ignored") return;

  if (result.type === "wrong") {
    if (store.settings.sound) Beeper.tick();
    if (store.settings.keyboard) keyboard.flash(result.expected, false);
    el.typingPanel.classList.add("shake");
    setTimeout(() => el.typingPanel.classList.remove("shake"), 170);
  } else if (result.type === "correct" && store.settings.keyboard) {
    keyboard.flash(result.ch, true);
  }

  updateCursor();
  updateLive();

  if (result.type === "done") finishSession();
}

/* ---------- finishing ---------- */

function finishSession() {
  stopTicker();
  const s = engine.summary();

  /* lifetime error tally, used to build the trouble-key drill */
  for (const [key, count] of engine.errors) {
    store.keyErrors[key] = (store.keyErrors[key] || 0) + count;
  }
  store.totalMs += s.elapsedMs;

  const label = current.kind === "lesson" ? `L${current.lesson.id}` : PRACTICE_META[current.practiceKind].title;
  store.history.push({ t: Date.now(), wpm: s.wpm, acc: s.accuracy, label });
  if (store.history.length > 60) store.history = store.history.slice(-60);

  let stars = 0;
  if (current.kind === "lesson") {
    stars = 1;
    if (s.accuracy >= 92) stars = 2;
    if (s.accuracy >= 96 && s.wpm >= current.lesson.targetWpm) stars = 3;

    const prev = store.progress[current.lesson.id] || { stars: 0, bestWpm: 0, bestAcc: 0, plays: 0 };
    store.progress[current.lesson.id] = {
      stars: Math.max(prev.stars, stars),
      bestWpm: Math.max(prev.bestWpm, s.wpm),
      bestAcc: Math.max(prev.bestAcc, s.accuracy),
      plays: prev.plays + 1
    };
  }
  save();
  showResults(s, stars);
}

function showResults(s, stars) {
  el.resultStars.textContent = current.kind === "lesson" ? starString(stars) : "";
  el.resWpm.textContent = s.wpm;
  el.resAcc.textContent = s.accuracy + "%";
  el.resTime.textContent = formatTime(s.elapsedMs);
  el.resErrors.textContent = s.errors;

  if (current.kind === "lesson") {
    const target = current.lesson.targetWpm;
    if (stars === 3) {
      el.resultHeadline.textContent = "Nailed it";
      el.resultSub.textContent = `Above the ${target} wpm target with clean accuracy. Move on whenever you're ready.`;
    } else if (stars === 2) {
      el.resultSub.textContent = s.wpm < target
        ? `Accuracy is solid. Speed will follow — the target here is ${target} wpm.`
        : "Quick, but a few slips. One more run at this should tidy it up.";
      el.resultHeadline.textContent = "Good run";
    } else {
      el.resultHeadline.textContent = "Lesson complete";
      el.resultSub.textContent = "Slow down a little and aim for 96% accuracy — speed comes on its own.";
    }
  } else {
    el.resultHeadline.textContent = "Practice complete";
    el.resultSub.textContent = `${s.wpm} wpm at ${s.accuracy}% accuracy.`;
  }

  if (s.trouble.length) {
    el.troubleBlock.classList.remove("hidden");
    el.troubleKeys.innerHTML = s.trouble
      .map((t) => `<span class="trouble-key">${t.key === " " ? "space" : escapeHtml(t.key)}<small>×${t.count}</small></span>`)
      .join("");
  } else {
    el.troubleBlock.classList.add("hidden");
  }

  const nextLesson = current.kind === "lesson"
    ? LESSONS.find((l) => l.id === current.lesson.id + 1)
    : null;
  el.resNextBtn.classList.toggle("hidden", !nextLesson);
  el.resNextBtn.onclick = () => nextLesson && startLesson(nextLesson);

  show("results");
}

function restartSession() {
  if (!current) return;
  if (current.kind === "lesson") startLesson(current.lesson);
  else startPractice(current.practiceKind);
}

/* ---------- settings ---------- */

function applySettings() {
  document.documentElement.dataset.theme = store.settings.theme;
  $("setStrict").checked = store.settings.strict;
  $("setKeyboard").checked = store.settings.keyboard;
  $("setSound").checked = store.settings.sound;
  $("setUnlock").checked = store.settings.unlockAll;
}

function bindSettings() {
  const bind = (id, key, after) => {
    $(id).onchange = (e) => {
      store.settings[key] = e.target.checked;
      save();
      if (after) after();
    };
  };
  bind("setStrict", "strict");
  bind("setKeyboard", "keyboard", () => {
    el.guideArea.classList.toggle("hidden", !store.settings.keyboard);
    if (engine) updateCursor();
  });
  bind("setSound", "sound");
  bind("setUnlock", "unlockAll", renderHome);

  $("settingsBtn").onclick = () => el.settingsModal.classList.remove("hidden");
  $("closeSettings").onclick = () => {
    el.settingsModal.classList.add("hidden");
    renderHome();
  };
  el.settingsModal.onclick = (e) => {
    if (e.target === el.settingsModal) {
      el.settingsModal.classList.add("hidden");
      renderHome();
    }
  };

  $("resetBtn").onclick = () => {
    if (!confirm("Erase all lessons, stars and history? This can't be undone.")) return;
    const theme = store.settings.theme;
    store = defaultStore();
    store.settings.theme = theme;
    save();
    applySettings();
    el.settingsModal.classList.add("hidden");
    goHome();
  };

  $("themeBtn").onclick = () => {
    store.settings.theme = store.settings.theme === "dark" ? "light" : "dark";
    save();
    applySettings();
    if (store.history.length >= 2) drawHistory();
  };
}

/* ---------- boot ---------- */

function init() {
  applySettings();
  bindSettings();

  $("brandHome").onclick = goHome;
  $("brandHome").onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") goHome(); };
  $("quitBtn").onclick = goHome;
  $("restartBtn").onclick = restartSession;
  $("resHomeBtn").onclick = goHome;
  $("resRetryBtn").onclick = restartSession;

  document.querySelectorAll("[data-practice]").forEach((btn) => {
    btn.onclick = () => startPractice(btn.dataset.practice);
  });

  document.addEventListener("keydown", handleKey);
  window.addEventListener("resize", () => {
    if (el.screens.home.classList.contains("active") && store.history.length >= 2) drawHistory();
  });

  renderHome();
  show("home");
}

init();
