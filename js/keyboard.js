/* Virtual keyboard: layout, finger assignment, and highlighting. */

const KB_ROWS = [
  [
    { k: "`", s: "~" }, { k: "1", s: "!" }, { k: "2", s: "@" }, { k: "3", s: "#" },
    { k: "4", s: "$" }, { k: "5", s: "%" }, { k: "6", s: "^" }, { k: "7", s: "&" },
    { k: "8", s: "*" }, { k: "9", s: "(" }, { k: "0", s: ")" }, { k: "-", s: "_" },
    { k: "=", s: "+" }, { k: "Backspace", label: "⌫", cls: "wide" }
  ],
  [
    { k: "Tab", label: "tab", cls: "wide" },
    { k: "q" }, { k: "w" }, { k: "e" }, { k: "r" }, { k: "t" },
    { k: "y" }, { k: "u" }, { k: "i" }, { k: "o" }, { k: "p" },
    { k: "[", s: "{" }, { k: "]", s: "}" }, { k: "\\", s: "|", cls: "wide" }
  ],
  [
    { k: "CapsLock", label: "caps", cls: "wider" },
    { k: "a", home: true }, { k: "s", home: true }, { k: "d", home: true }, { k: "f", home: true }, { k: "g" },
    { k: "h" }, { k: "j", home: true }, { k: "k", home: true }, { k: "l", home: true },
    { k: ";", s: ":", home: true }, { k: "'", s: '"' },
    { k: "Enter", label: "⏎", cls: "wider" }
  ],
  [
    { k: "ShiftLeft", label: "shift", cls: "wider" },
    { k: "z" }, { k: "x" }, { k: "c" }, { k: "v" }, { k: "b" },
    { k: "n" }, { k: "m" }, { k: ",", s: "<" }, { k: ".", s: ">" }, { k: "/", s: "?" },
    { k: "ShiftRight", label: "shift", cls: "wider" }
  ],
  [
    { k: " ", label: "space", cls: "space" }
  ]
];

const FINGERS = {
  pinkyL:  { name: "left pinky",   keys: "`1qaz~!" },
  ringL:   { name: "left ring",    keys: "2wsx@" },
  middleL: { name: "left middle",  keys: "3edc#" },
  indexL:  { name: "left index",   keys: "45rtfgvb$%" },
  indexR:  { name: "right index",  keys: "67yuhjnm^&" },
  middleR: { name: "right middle", keys: "8ik,*<" },
  ringR:   { name: "right ring",   keys: "9ol.(>" },
  pinkyR:  { name: "right pinky",  keys: "0-=p[];'/)_+{}|:\"?\\" },
  thumb:   { name: "thumb",        keys: " " }
};

/* char (lowercase form) -> finger id */
const FINGER_OF = (() => {
  const map = {};
  for (const id in FINGERS) {
    for (const ch of FINGERS[id].keys) map[ch] = id;
  }
  return map;
})();

/* Shift-symbol -> the physical key it lives on, so "!" highlights "1". */
const SHIFT_BASE = {
  "~": "`", "!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6",
  "&": "7", "*": "8", "(": "9", ")": "0", "_": "-", "+": "=",
  "{": "[", "}": "]", "|": "\\", ":": ";", '"': "'", "<": ",", ">": ".", "?": "/"
};

function fingerFor(ch) {
  const base = SHIFT_BASE[ch] || ch.toLowerCase();
  return FINGER_OF[base] || null;
}

/* Uppercase/symbols are typed with the shift key on the *opposite* hand. */
function shiftSideFor(ch) {
  const finger = fingerFor(ch);
  if (!finger) return null;
  return finger.endsWith("L") ? "ShiftRight" : "ShiftLeft";
}

function needsShift(ch) {
  return (ch >= "A" && ch <= "Z") || ch in SHIFT_BASE;
}

class Keyboard {
  constructor(root) {
    this.root = root;
    this.keyEls = new Map();
    this.render();
  }

  render() {
    this.root.innerHTML = "";
    for (const row of KB_ROWS) {
      const rowEl = document.createElement("div");
      rowEl.className = "kb-row";
      for (const def of row) {
        const el = document.createElement("div");
        el.className = "kb-key" + (def.cls ? " " + def.cls : "") + (def.home ? " home" : "");
        el.textContent = def.label || def.k;
        const finger = fingerFor(def.k);
        if (finger) el.style.setProperty("--fc", `var(--f-${finger})`);
        this.keyEls.set(def.k, el);
        rowEl.appendChild(el);
      }
      this.root.appendChild(rowEl);
    }
  }

  /* Dim keys the learner hasn't met yet. `taught` is a string of chars. */
  setTaught(taught) {
    const set = new Set((taught || "").toLowerCase());
    for (const [k, el] of this.keyEls) {
      if (k.length !== 1 || k === " ") continue;
      const known = set.has(k);
      el.classList.toggle("taught", known);
      el.classList.toggle("untaught", !known);
    }
  }

  clearNext() {
    for (const el of this.keyEls.values()) el.classList.remove("next");
  }

  /* Highlight the key (and shift, when needed) for the next character. */
  showNext(ch) {
    this.clearNext();
    if (ch == null) return null;
    const base = SHIFT_BASE[ch] || ch.toLowerCase();
    const el = this.keyEls.get(base);
    if (el) el.classList.add("next");
    if (needsShift(ch)) {
      const side = shiftSideFor(ch);
      const shiftEl = this.keyEls.get(side);
      if (shiftEl) {
        shiftEl.style.setProperty("--fc", side === "ShiftLeft" ? "var(--f-pinkyL)" : "var(--f-pinkyR)");
        shiftEl.classList.add("next");
      }
    }
    return fingerFor(ch);
  }

  flash(ch, ok) {
    const base = SHIFT_BASE[ch] || (ch || "").toLowerCase();
    const el = this.keyEls.get(base);
    if (!el) return;
    const cls = ok ? "pressed" : "miss";
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ok ? 90 : 170);
  }
}
