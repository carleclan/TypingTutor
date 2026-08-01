/* Typing session state: what has been typed, what is next, and the numbers. */

class TypingEngine {
  constructor(text, options = {}) {
    this.text = text;
    this.strict = options.strict !== false;
    this.states = new Array(text.length).fill(null); // null | "correct" | "wrong"
    this.index = 0;
    this.startTime = null;
    this.endTime = null;
    this.keystrokes = 0;      // every character key pressed (backspace excluded)
    this.hits = 0;            // keystrokes that matched the expected character
    this.errors = new Map();  // expected char -> times missed
    this.finished = false;
  }

  get nextChar() {
    return this.index < this.text.length ? this.text[this.index] : null;
  }

  get started() {
    return this.startTime !== null;
  }

  get elapsedMs() {
    if (!this.startTime) return 0;
    return (this.endTime || Date.now()) - this.startTime;
  }

  /* Feed a single key. Returns what happened so the UI can react. */
  press(key) {
    if (this.finished) return { type: "ignored" };

    if (key === "Backspace") {
      if (this.index === 0) return { type: "ignored" };
      this.index--;
      const ch = this.text[this.index];
      this.states[this.index] = null;
      return { type: "back", ch };
    }

    if (key.length !== 1) return { type: "ignored" };
    if (this.index >= this.text.length) return { type: "ignored" };

    if (!this.startTime) this.startTime = Date.now();

    const expected = this.text[this.index];
    this.keystrokes++;

    if (key === expected) {
      this.hits++;
      this.states[this.index] = this.states[this.index] === "wrong" ? "wrong" : "correct";
      this.index++;
      if (this.index >= this.text.length) {
        this.finished = true;
        this.endTime = Date.now();
        return { type: "done", ch: key };
      }
      return { type: "correct", ch: key };
    }

    this.errors.set(expected, (this.errors.get(expected) || 0) + 1);

    if (this.strict) {
      /* Mark the target so the learner sees where the miss was, but hold
         position until they hit the right key. */
      this.states[this.index] = "wrong";
      return { type: "wrong", ch: key, expected, blocked: true };
    }

    this.states[this.index] = "wrong";
    this.index++;
    if (this.index >= this.text.length) {
      this.finished = true;
      this.endTime = Date.now();
      return { type: "done", ch: key, expected };
    }
    return { type: "wrong", ch: key, expected, blocked: false };
  }

  /* Correctly typed characters so far — the basis for net WPM. */
  get correctChars() {
    let n = 0;
    for (let i = 0; i < this.index; i++) if (this.states[i] === "correct") n++;
    return n;
  }

  get wpm() {
    const minutes = this.elapsedMs / 60000;
    if (minutes <= 0) return 0;
    return Math.max(0, Math.round(this.correctChars / 5 / minutes));
  }

  get accuracy() {
    if (this.keystrokes === 0) return 100;
    return Math.round((this.hits / this.keystrokes) * 100);
  }

  get errorCount() {
    let n = 0;
    for (const c of this.errors.values()) n += c;
    return n;
  }

  get progress() {
    return this.text.length ? this.index / this.text.length : 0;
  }

  troubleKeys(limit = 6) {
    return [...this.errors.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, count]) => ({ key, count }));
  }

  summary() {
    return {
      wpm: this.wpm,
      accuracy: this.accuracy,
      elapsedMs: this.elapsedMs,
      errors: this.errorCount,
      chars: this.text.length,
      trouble: this.troubleKeys()
    };
  }
}

/* Short tick played on a miss. Created lazily so no audio context exists
   until the learner actually mistypes something. */
const Beeper = {
  ctx: null,
  tick() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(180, t);
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    } catch (e) {
      /* audio is a nicety; never let it break typing */
    }
  }
};
