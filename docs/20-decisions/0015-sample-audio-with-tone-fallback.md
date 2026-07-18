# 0015 — Sample audio with procedural-tone fallback (grit reskin C1)

**Date:** 2026-07-18.

## Context

`SoundManager` played only procedurally synthesised Web Audio tones — no sample
playback existed, while Kenney sample packs (`assets/audio/{combat,effects,ui,voice}`,
~230 `.ogg` files) had been sitting unused in the repo since Phase 2, earmarked for the
grit reskin's C1 sound phase (`docs/10-design/grit-reskin.md` § C1).

Constraints from the design doc and `CLAUDE.md`: keep `SoundManager` under ~200 lines
(loading/decoding goes in a new sibling module — no god files); keep the public preset
API (`click()`, `victory()`…) so nothing that emits sound events needs to change; **zero
regression risk** — a missing/undecoded buffer must never produce silence where a tone
played before; and no audio-context errors before the first user gesture (the
resume-on-interaction path already handled this).

## Decision

Two new modules under `js/systems/sound/`, both fed the shared `AudioContext`:

- **`sampleLibrary.js`** — a `MANIFEST` (preset key → `{ cat, files[] }`), lazy
  `fetch` + `decodeAudioData` into `AudioBuffer`s, random-variant pick per trigger, and
  per-category volume (`ui`/`combat`/`reward`/`fanfare`/`voice`). `tryPlay(key)` returns
  `true` only if a decoded buffer was played; **undefined → kick off the async load and
  return `false`; loading (empty array) → `false`.** `MANIFEST` and `CATEGORY_VOLUME` are
  exported for a pure unit test.
- **`ambientBed.js`** — a procedural brown-noise buffer looped through a lowpass filter +
  gain, with a slow LFO for wind swell. Idempotent `start()`/`stop()` with fades. No
  asset needed (design doc explicitly allows procedural here).

`SoundManager` keeps every tone preset as the fallback body; each preset is now
`if (this._sample(key)) return; <existing tone>`. It owns the ambient bed's lifecycle:
subscribes to `ui:viewChanged` and `settings:changed`, and starts the bed only when the
active view is `world` **and** `sfxEnabled && ambientEnabled`. New `ambientEnabled`
setting (default `true`) in `SettingsManager` + a toggle in `SettingsUI`.

New event wiring: `combat:started`/`combat:marchResolved` → impact/battle,
`march:dispatched` → voice war-bark (no tone fallback — silence is fine),
`march:completed` → mission-complete voice (falls back to the victory fanfare).

## Final sound map (tuned by ear 2026-07-18)

The chiptune sample sets (`effects/jingles_NES*`, `effects/jingles_HIT*`) were rejected on
listening — they clash with the grit tone. Landed mapping:

| Event(s) | Preset | Sound |
|---|---|---|
| `building:completed`, `unit:trained` | `complete()` | metal clunk (`combat/impactMetal_medium_*`) |
| `tech:researched` | `research()` | bright synth "tech online" chime (**tone only**) |
| `quest:completed`, `march:completed` | `missionComplete()` | "mission completed" voice |
| `achievement:unlocked` | `achievement()` | heavy bell toll (`combat/impactBell_heavy_*`) |
| `resources:added`, `market:traded` | `coin()` | leather-pouch pickup (`ui/dropLeather.ogg`) |
| `combat:victory` | `victory()` | "congratulations" voice |
| `combat:defeat` | `defeat()` | `effects/game_over.ogg` |
| `combat:started`, `combat:wave:start` | `battle()` | `effects/battle_mode.ogg` |
| `combat:marchResolved` | `hit()` | light metal impact |
| `march:dispatched` | `dispatch()` | war voice bark (no fallback) |
| `ui:click` | `click()` | `ui/click*` |
| `building:started`, `hero:recruited`, cafeteria-info | `confirm()` | `ui/switch*` |
| `user:levelUp` | `levelUp()` | "level up" voice |
| `ui:error`, `heal()` | — | procedural tone only |

`coin`/`dropLeather` is a **single variant** — rapid collects repeat the exact clip; add
variants if it grates. No chiptune remains wired.

## Consequences

- **No regression:** the first trigger of any sound before its buffer finishes decoding
  plays the original tone; every trigger after plays the sample. `SoundManager` grew but
  stays lean (all I/O is in the two new modules); `click`/`switch` are warmed at
  construction so the first UI click is usually already a sample.
- **`.ogg` decode is Chromium-native** — verified in the headless probe (5 click variants
  + 2 voice variants decoded, ambient bed toggles correctly). Browsers without OGG
  support silently fall back to tones (the `try/catch` in `_load` drops undecodable
  variants).
- `soundManager` + `settingsManager` are now exposed on `window.game` for
  debugging/automation (matches the other managers already there).
- The manifest is the single wiring point — adding a sound is a `MANIFEST` entry plus a
  `_sample(key)` guard, no I/O code. A typo in a file path is caught by
  `tests/unit/sampleLibrary.test.js` (all paths `.ogg`, under a known dir, category has a
  volume) — but a path that is well-formed yet points at a **missing** file is only
  caught at runtime (drops to tone); keep manifest edits in sync with `assets/audio/`.
