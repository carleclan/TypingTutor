/* Curriculum and drill generation. */

/* Each lesson lists the keys it introduces; `keys` is filled in below as the
   running total of everything taught up to and including that lesson. */
const LESSONS = [
  { id: 1,  title: "Home base",        newKeys: ["f", "j"],           mode: "keys",      targetWpm: 10 },
  { id: 2,  title: "Middle fingers",   newKeys: ["d", "k"],           mode: "keys",      targetWpm: 11 },
  { id: 3,  title: "Ring fingers",     newKeys: ["s", "l"],           mode: "keys",      targetWpm: 12 },
  { id: 4,  title: "Little fingers",   newKeys: ["a", ";"],           mode: "keys",      targetWpm: 13 },
  { id: 5,  title: "Home row words",   newKeys: [],                   mode: "words",     targetWpm: 14 },
  { id: 6,  title: "Reaching in",      newKeys: ["g", "h"],           mode: "words",     targetWpm: 15 },
  { id: 7,  title: "E and I",          newKeys: ["e", "i"],           mode: "words",     targetWpm: 16 },
  { id: 8,  title: "R and U",          newKeys: ["r", "u"],           mode: "words",     targetWpm: 17 },
  { id: 9,  title: "T and Y",          newKeys: ["t", "y"],           mode: "words",     targetWpm: 18 },
  { id: 10, title: "W and O",          newKeys: ["w", "o"],           mode: "words",     targetWpm: 19 },
  { id: 11, title: "Q and P",          newKeys: ["q", "p"],           mode: "words",     targetWpm: 20 },
  { id: 12, title: "Top row review",   newKeys: [],                   mode: "words",     targetWpm: 21 },
  { id: 13, title: "N and V",          newKeys: ["n", "v"],           mode: "words",     targetWpm: 21 },
  { id: 14, title: "M and C",          newKeys: ["m", "c"],           mode: "words",     targetWpm: 22 },
  { id: 15, title: "B and X",          newKeys: ["b", "x"],           mode: "words",     targetWpm: 22 },
  { id: 16, title: "Z and the comma",  newKeys: ["z", ","],           mode: "words",     targetWpm: 23 },
  { id: 17, title: "Period and slash", newKeys: [".", "/"],           mode: "words",     targetWpm: 23 },
  { id: 18, title: "The whole alphabet", newKeys: [],                 mode: "words",     targetWpm: 24 },
  { id: 19, title: "Capitals",         newKeys: ["Shift"],            mode: "sentences", targetWpm: 24 },
  { id: 20, title: "Real sentences",   newKeys: ["'", "!", "?"],      mode: "sentences", targetWpm: 25 }
];

/* Build the cumulative key set for every lesson. */
(function accumulateKeys() {
  let running = "";
  for (const lesson of LESSONS) {
    for (const k of lesson.newKeys) {
      if (k.length === 1 && !running.includes(k)) running += k;
    }
    lesson.keys = running;
    lesson.allowed = new Set(running);
  }
})();

const SUBTITLES = {
  1: "The two keys your index fingers never leave",
  2: "Keep the index fingers anchored on F and J",
  3: "Reach without lifting the rest of the hand",
  4: "The pinkies are weakest — go slowly here",
  5: "Eight keys is enough for real words",
  6: "Index fingers stretch inward for G and H",
  7: "Your first reach up to the top row",
  8: "Index fingers up and slightly in",
  9: "Another inward stretch, one row up",
  10: "Ring finger up, and O for the right ring",
  11: "The pinky reaches — the hardest stretch",
  12: "Everything above the home row",
  13: "First trip below the home row",
  14: "Right index down, left middle down",
  15: "Two awkward reaches; take them slowly",
  16: "Left pinky down, and your first punctuation",
  17: "The end of a sentence, and the slash",
  18: "All twenty-six letters in play",
  19: "Shift with the opposite hand, never the same one",
  20: "Words, capitals, and punctuation together"
};

/* ---------- drill builders ---------- */

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedChar(keys, newKeys) {
  if (newKeys.length && Math.random() < 0.45) return pick(newKeys);
  return pick(keys);
}

function keyDrill(keysStr, newKeys, groupCount = 30) {
  const keys = keysStr.split("");
  const fresh = newKeys.filter((k) => k.length === 1);
  const out = [];

  fresh.forEach((k) => out.push(k.repeat(3)));
  if (fresh.length >= 2) {
    const [a, b] = fresh;
    out.push(a + b, b + a, a + b + a, b + a + b);
  }

  while (out.length < groupCount) {
    const len = 2 + Math.floor(Math.random() * 3);
    let group = "";
    for (let i = 0; i < len; i++) group += weightedChar(keys, fresh);
    if (group !== out[out.length - 1]) out.push(group);
  }
  return out.join(" ");
}

function wordCandidates(allowed) {
  return WORDS.filter((w) => {
    for (const c of w) if (!allowed.has(c)) return false;
    return true;
  });
}

function wordDrill(allowed, newKeys, keysStr, count = 30) {
  const all = wordCandidates(allowed);

  /* Not enough vocabulary yet (very early lessons) — fall back to key groups. */
  if (all.length < 8) return keyDrill(keysStr, newKeys, count);

  const fresh = newKeys.filter((k) => k.length === 1 && /[a-z]/.test(k));
  const focused = fresh.length
    ? all.filter((w) => fresh.some((k) => w.includes(k)))
    : [];

  /* With a thin word pool, break the repetition up with letter groups. */
  const thin = all.length < 25;
  const keys = keysStr.split("");

  const out = [];
  let last = "";
  while (out.length < count) {
    if (thin && out.length % 4 === 3) {
      let group = "";
      const len = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < len; i++) group += weightedChar(keys, fresh);
      out.push(group);
      last = group;
      continue;
    }
    const pool = focused.length && Math.random() < 0.6 ? focused : all;
    const word = pick(pool);
    if (word === last) continue;
    out.push(word);
    last = word;
  }

  /* Sprinkle in the punctuation a lesson just introduced. */
  const punct = newKeys.filter((k) => ",.;/'".includes(k));
  if (punct.length) {
    for (let i = 0; i < 6; i++) {
      const at = 2 + Math.floor(Math.random() * (out.length - 3));
      out[at] = out[at] + pick(punct);
    }
  }
  return out.join(" ");
}

function sentenceDrill(count = 3, capsOnly = false) {
  const pool = capsOnly
    ? SENTENCES.filter((s) => !/[!?'"]/.test(s))
    : SENTENCES;
  const chosen = [];
  while (chosen.length < count) {
    const s = pick(pool.length ? pool : SENTENCES);
    if (!chosen.includes(s)) chosen.push(s);
  }
  return chosen.join(" ");
}

function buildDrill(lesson) {
  if (lesson.mode === "keys") return keyDrill(lesson.keys, lesson.newKeys);
  if (lesson.mode === "sentences") return sentenceDrill(3, lesson.id === 19);
  return wordDrill(lesson.allowed, lesson.newKeys, lesson.keys);
}

/* ---------- free practice ---------- */

function practiceDrill(kind, weakKeys) {
  if (kind === "sentences") return sentenceDrill(4);

  if (kind === "weak") {
    const keys = (weakKeys || []).filter((k) => /[a-z]/.test(k));
    if (!keys.length) return practiceDrill("words");

    const matching = WORDS.filter((w) => keys.some((k) => w.includes(k)));
    const out = [];
    while (out.length < 30) {
      if (out.length % 5 === 0) {
        /* a short burst of the raw trouble key */
        const k = pick(keys);
        out.push(k.repeat(3));
      } else {
        out.push(pick(matching.length ? matching : WORDS));
      }
    }
    return out.join(" ");
  }

  const out = [];
  let last = "";
  while (out.length < 34) {
    const w = pick(WORDS);
    if (w === last) continue;
    out.push(w);
    last = w;
  }
  return out.join(" ");
}

const PRACTICE_META = {
  words: { title: "Common words", subtitle: "Free practice — no new keys, just rhythm" },
  sentences: { title: "Sentences", subtitle: "Free practice — capitals and punctuation" },
  weak: { title: "Trouble keys", subtitle: "Built from the keys you miss most" }
};
