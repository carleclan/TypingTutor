# TouchType

A browser typing tutor that takes a complete beginner from the home row to full
sentences. No build step, no dependencies, no network — just open it.

## Running it

https://carleclan.github.io/TypingTutor/

<img width="1887" height="1714" alt="image" src="https://github.com/user-attachments/assets/019494ee-d263-470f-bd3e-3c8974c6f029" />


Double-click `index.html`.

If your browser blocks local storage on `file://` (progress won't stick between
visits), serve the folder instead and open <http://localhost:8123>:

```bash
powershell -ExecutionPolicy Bypass -File serve.ps1
```

## How the course works

Twenty lessons, each introducing at most two new keys, in the order a touch
typist learns them:

| Lessons | Keys | What you type |
| --- | --- | --- |
| 1–4 | `f j`, `d k`, `s l`, `a ;` | letter groups |
| 5 | — | first real words, home row only |
| 6–11 | `g h`, `e i`, `r u`, `t y`, `w o`, `q p` | words |
| 12 | — | top row review |
| 13–17 | `n v`, `m c`, `b x`, `z ,`, `. /` | words with punctuation |
| 18 | — | all twenty-six letters |
| 19–20 | shift, `' ! ?` | sentences with capitals |

Each drill is generated fresh, so repeating a lesson isn't repeating the same
text. A lesson only ever uses keys you have already been taught.

Three free-practice modes sit below the lessons: common words, sentences, and a
**trouble keys** drill built from whichever keys you have missed most across
every session so far.

## While you type

- The on-screen keyboard highlights the next key, colour-coded by finger, and
  the hand diagram shows which finger to use. Keys you haven't been taught are
  dimmed.
- Shift is highlighted on the **opposite** hand from the letter, which is how
  capitals should actually be typed.
- **Strict mode** (on by default) won't advance past a wrong key, so you can't
  drift out of sync with the text. Turn it off in settings to type through
  mistakes and fix them with backspace.

Scoring is net WPM — characters you got right on the first attempt, divided by
five, per minute. Stars: one for finishing, two at 92% accuracy, three at 96%
accuracy *and* the lesson's speed target.

Press `Esc` during a lesson to bail out to the menu.

## Files

```
index.html        markup for the three screens
css/styles.css    all styling, dark and light themes
js/content.js     word list, sentences, posture hints
js/keyboard.js    key layout, finger map, on-screen keyboard
js/lessons.js     the 20-lesson curriculum and drill generation
js/engine.js      typing state, WPM and accuracy
js/app.js         screens, progress storage, the typing loop
serve.ps1         optional local web server
```

Progress lives in `localStorage` under `ttype.v1`. Settings has a reset button.
