# 0019 — C3 DOM/UI juice (fly-out, tick-up, sheet springs, universal click)

## Context

Grit reskin Workstream C phase C3 (`docs/10-design/grit-reskin.md` § C3). C1/C2 landed
audio and canvas motion; the DOM/HUD layer is still static. C3's brief: a reward fly-out
from the event origin into the matching HUD chip, a number tick-up on resource chips,
`--transition-spring` slide+fade on the sheets, and a universal button `:active` scale +
the C1 click sample. Binding guardrail (memory `reactive-ui-no-tick-rebuild`): patch text
in place — never rebuild innerHTML over live timers.

## Decision

Four new/edited seams, no new save state and no new manager:

1. **Number tick-up** — new pure util `js/ui/fx/numberTicker.js` (`tickTo(el, target,
   format)`). Per-element `WeakMap` of `{current, raf}`; a new target mid-flight cancels
   and retargets from the running value (no stacking). ~320ms ease-out, formats
   `Math.round(val)` each frame so `fmt`'s K/M rounding stays clean. `NavigationUI.
   _renderResources` swaps `valEl.textContent = fmt(...)` for `tickTo(valEl, res.amount,
   fmt)`. The **first** call for an element sets instantly (no count-from-zero on boot);
   only the numeric value ticks — cap/rate stay instant.

2. **Reward fly-out** — new `js/ui/fx/resourceFlyout.js` (`ResourceFlyout`), instantiated
   once by UIManager. Subscribes to `resources:added` (which fires only on discrete
   `add()` rewards — passive income goes through `resources:tick`, so it never spams).
   Per rewarded key it flies a `.res-fly` coin (reusing the masked `.res-icon--{key}`
   art) from mid-screen into `#res-{key}`, then pulses the chip's `.res-value` with the
   existing `tick-flash`. **Origin is mid-screen, not the true event source**:
   `resources:added` carries only `{key: amount}` and rewards land from different views
   (march return on the world map, collections at buildings); wiring a screen origin
   through every emitter was out of scope for the feel win. Pooled cap (24 live),
   skips when `document.hidden`.

3. **Sheet transitions** — `--transition-spring` on the sheets. `.world-panel`
   (PoiDetailPanel, already opacity/transform-toggled) gets a spring transform;
   `.world-sheet` (MarchDispatchSheet) and `.bp-sheet` (BuildablesPanel) are `display:
   none`-toggled, so they get an entrance `@keyframes` (`sheetRise`/`bpSheetRise`) that
   restarts each time the element is displayed — no JS state.

4. **Universal click** — one capture-phase `document` click listener in UIManager
   (`_installButtonSfx`) emits `ui:click` for any `button`/`.btn`/`[role=button]` press.
   ~200 callsites already emit `ui:click` manually, so to avoid double sounds
   `SoundManager.click()` now **coalesces**: calls within 60ms of the last are dropped.
   Manual emit + global emit both fire inside the same click event → one sound. A CSS
   `.btn:active:not(:disabled) { transform: scale(0.95); }` gives the press feedback.

A global `prefers-reduced-motion` block in `reset.css` neutralizes animations/transitions;
`numberTicker` and `ResourceFlyout` also short-circuit on it in JS.

## Consequences

- No new save state; C3 is pure presentation, like C1/C2.
- Continuous passive income now visibly counts up on the chips (the ticker retargets every
  2Hz `resources:tick`) — reads as smooth motion, not churn.
- The mid-screen fly-out origin is a deliberate simplification; if a per-event origin is
  wanted later, extend `resources:added` payload (or emit a sibling `ui:rewardOrigin`)
  rather than reworking the flyout.
- The universal click listener means **every** button now clicks audibly, including ones
  that previously never emitted `ui:click`. If a specific button should stay silent, it
  needs an opt-out (none needed today).
- New test `tests/unit/numberTicker.test.js` (rAF/performance stubbed). `ResourceFlyout`
  and the CSS are DOM-bound → covered by the browser probe, not unit tests.
