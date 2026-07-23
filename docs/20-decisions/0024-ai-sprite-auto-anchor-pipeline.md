# 0024 — AI building sprites with an auto-anchor ingest pipeline

**Date:** 2026-07-21 · **Status:** UN-PARKED 2026-07-22 — the `ai → grit → legacy`
precedence is wired in `cityAssets.js`/`cityGrade.js` (via a single `variantKey`
resolver) and HQ renders from the AI set. Retried after grit HQ art quality was
judged weaker than the AI renders. Recorded below as-built; the bugs found
(scale-reference overshoot, foot-band anchor skew, base-vs-roof containment, and
the **base-vs-prop tilt** added 2026-07-22 below) are real and apply to any future
iso auto-anchor work.

## Update 2026-07-22 — base-vs-prop tilt fix + game-side wiring

- **Tilt root cause (the "left side grounded, right side hovering" report).** The
  detector took `ax`/`ay` from the single widest row across the *whole* sprite. On
  HQ that row is the parked cart/barrel prop at mid-height, which spans wider than
  the stone foundation beneath it and sits ~18px left of the base centre — so the
  anchor seated the building off toward one plot corner and it read as tilted.
  Verified live with a footprint-diamond overlay: `ax` 84→103 removed the tilt at
  L1; all four stages sit level with base-centre anchors.
- **Fix — default detection stays widest-row; the cart case is an override.** A
  "lowest row ≥0.7× widest" rule fixed HQ L1 but shoved L3 right (its front steps
  fooled it symmetrically to the cart). A median-estimator sweep confirmed **no single
  pixel rule centres both a side-prop building and a front-step building** — widest-row
  is correct for 3 of townhall's 4 stages; only the cart (L1) defeats every automatic
  estimator (best 99px vs true 103). So `anchor.py` foot mode keeps the widest-row
  centre, and sprites the detector gets wrong carry a hand value in
  `assets/tiles/buildings/ai/_anchor_overrides.json` (merged last by `ingest.py`'s
  `_apply_overrides`). Townhall S1-S4 pinned there + in `_anchors.json`:
  `(103,123)/(67,104)/(70,140)/(87,145)`, all verified centred + grounded live.
  `ground_width` for scaling still uses the full silhouette (round-4, unchanged).
- **Game side wired (was reverted):** `cityAssets.js` gained `AI_BUILDING_MAP` +
  `stageBucket` + a single `variantKey(id, level)` resolver owning `ai → grit →
  legacy` precedence; `building`/`anchor`/`buildingGray`/`bottomPad` and
  `cityGrade`'s `building`/`buildingGray` all route through it, so draw, gray,
  grade, anchor and pad cannot pick different sprites for a slot. AI sprites +
  their `_anchors.json` load alongside grit (a second `_loadAnchors(url, entries)`
  call). Only `townhall` is mapped so far.
- **Known:** the previous attempt overwrote `grit/townhall_L1-L4.png` with the AI
  renders; grit is git-ignored and the pre-rig `assets/_rig/backup-grit-v1/` only
  holds townhall L1-L3. The grit townhall fallback is now cosmetically dead (AI
  wins) but still the clobbered art — restore via the rig if the fallback is ever
  wanted back. Tests: `cityAssets.test.js` (+stageBucket/AI-map); `align-smoke`
  missing-anchor check now resolves via `variantKey`.

## Update 2026-07-23 — grit is the default; AI is dev-gated; HQ/hero/quarry re-sourced

- **Precedence flipped: grit-default, AI opt-in.** Until AI modules/effort have a real
  in-game setting, the AI set is no longer auto-preferred. `CityAssets.aiEnabled` (false
  unless a `?ai` boot or the dev toggle sets it) now guards the AI branch in `variantKey`,
  so grit wins for everyone; a dev flips to AI to test. New **`DevSpriteSource`** widget
  (`js/ui/dev/`, `?dev` only, wired in `main.js` beside the other dev widgets) is a
  live grit↔AI checkbox — calls `_assets.setAiSprites()`, the running RAF repaints. The
  AI set still loads alongside grit so the toggle flips without a reload.
- **Three grit buildings re-sourced (rig re-run, ADR 0021).** The AI HQ that had clobbered
  `grit/townhall_*` is retired from the default path; grit HQ was re-rendered from a
  stronger model. Re-mapped in `assets/_rig/jobs-all.json` and re-rendered via a 9-job
  partial run (`jobs-remap.json`), anchors **merged** into `grit/_anchors.json` (not a full
  overwrite): `townhall` → `Wonder_SecondAge_L1-3`, `heroquarters` → `Temple_SecondAge_L1-3`,
  `quarry` → `Resource_Gold_1/2/3`. `townhall`'s grit L4 slot dropped (Wonder_SecondAge ships
  3 levels) — `gritBucket` already clamps Lv.4+ to best-available, so HQ Lv.4+ reuses L3.
- **Dead ground-tile chain removed (same session).** `GROUND_TILES` (Kenney `landscape/`+
  `city/` sprites) 404'd on every boot — those dirs are gone; base ground is procedural
  (`cityGround.js`). Deleted the map + `CityAssets.ground()` + its load entries and
  `CityGrade`'s ground import/method/grading loop. Nothing drew from them, so boot-smoke went
  green.
- **Verified:** `npm test` 306/306 (townhall grit clamp now tops at 3; new grit-default flag
  test); `check-comments` clean on touched files; **boot-smoke PASS**; live `?dev` screenshot
  shows grit HQ/hero/quarry seated on-plot with `aiEnabled=false` and `townhall` resolving to
  `townhall_L3.png` (grit), not the AI stage. jobs-all.json (durable source of truth) re-mapped
  to match the shipped art.

## Context

Building art is moving to AI-generated isometric renders (`mixBoard/<Type>/StageN.png`,
1024² with a painted fake-transparent background). The grit set (ADR 0021) got its
per-sprite ground anchor for free from the 3D render rig, which knows each model's
ground-contact point. AI rasters have no model, so anchors were headed for manual
authoring — eyeballing every PNG's size and hand-writing `{ax, ay}` into
`_anchors.json`. Steve asked for the anchor to be derived from the image instead.

## Decision

A Python ingest pipeline in `assestProcessing/` (venv already carries PIL / numpy /
scipy / rembg) turns a `mixBoard` folder into the game's AI sprite set:

- `anchor.py` — pure pixel geometry. Largest-connected-component solid mask (kills
  rembg halo), row-extent profile, then the ground-contact anchor. Two modes:
  **foot** (default) = horizontal centre of the foot band, lowest solid row; **base** =
  centre of a large baked ground plate (widest low row), for types whose art sits on an
  extended field/courtyard. Also derives the scale mapping ground-contact width →
  footprint iso width (`footprint_cells * 64`, i.e. the rig fit 2×2→1.0 / 3×3→1.5 /
  4×4→2.0 tiles).
- **Foot lift (load-bearing):** the renderer seats the anchor on the footprint
  **centre** (`_centerWorld`), not its front vertex. A foot anchor *is* the front
  vertex, so `place_anchor` raises it to the base's own centre by half the base's iso
  screen depth (`ground_width * 0.375`, i.e. `TILE_H/TILE_W/2`). When the base fills
  the footprint this equals the grid's own centre→front offset (`24 px × cells`,
  pinned in `cityGrid.test.js`); when the building is smaller than its footprint (see
  sizing below) it centres correctly on its own base instead of the whole plot.
  Without this lift every foot building floats up-and-back (the first cut shipped this
  bug); grit's rig anchors already encode the equivalent, which is why grit never
  floated. Base mode's widest row already lands on the centre, so it gets no lift.
- **Sizing: a data-driven constant, not footprint-fill or per-building grit match.**
  Round 1 scaled each sprite to fill its footprint's iso width — 1.4-2.8× wider than
  grit at the same footprint, visibly oversized. Round 2 matched each building to its
  own grit `_L1` width — then visibly *too small* for farm/HQ/bank, because grit itself
  isn't consistently sized: measuring all 22 live grit `_L1` widths shows a tight
  cluster at 38-51 px/cell (median 43, mean 42.7) except farm (31.3) and bank (26) —
  clear outlier placeholder art — and townhall has three differently-sized grit variants
  (`townhall_L1`/`townhall1_L1`/`townhall2_L1`), so per-building matching could also grab
  the wrong file. The fix is `MEDIAN_GRIT_PX_PER_CELL = 43`, one constant applied
  uniformly via `scale_for_footprint(ground_width, footprint_cells)`, immune to any one
  building's outlier or duplicate grit reference. One scale is fixed at stage 1 and
  reused for later stages so in-game growth across levels is preserved.
- **Anchor centring uses the whole silhouette, not just the foot band.** A foot-band-only
  centroid (bottom ~10% of rows) is skewed by an asymmetric foot-level prop — HQ's cart
  and barrel stack sit on one side only, throwing `ax` off by 12-14px (7-13% of width),
  which reads as the building overhanging one tile corner while gapping the other. `ax`
  now comes from the whole solid mask's left/right extent across all rows (ay still
  comes from the foot itself); measured offset dropped to <3% of width.
- **Scaling reference is the whole sprite width, not a foot-band width (round 4).** Steve
  reported: HQ/farm/lumbermill's decorative surroundings (cart, ladder) spilling onto
  neighbouring tiles despite the building itself looking centred; well too big; house and
  barracks too big; farm still too small even after round 3. Root cause: `scale_for_
  footprint` divided the target width by a *foot-band* measurement, then applied that
  scale to the *whole* sprite — so anything wider than the foot band (a well's thatched
  roof over its narrow stone ring, a cart parked beside a building) ended up larger than
  the stated target by however much the band underestimated. Measured: well overshot its
  86px target by 32% (rendering at 114px), house by 13%. `ground_width` for foot mode is
  now the full silhouette width (`r - l + 1` across all rows), so `scale = target/width`
  applied to that same width is *exactly* the target — nothing in the sprite can exceed
  the footprint span by construction. This also fixes farm being too small: `base` mode
  (a ground plate meant to span the whole plot) now targets `BASE_PX_PER_CELL = 64` (the
  full footprint diamond width) instead of the foot-mode building constant, while `foot`
  mode keeps `FOOT_PX_PER_CELL = 43`. Verified in `?dev`: HQ's plate (barrels + cart) now
  sits fully inside its own diamond, no spillover onto Barracks/Storehouse.
- **Known residual:** cafeteria's front porch extends toward the viewer beyond what the
  standard `0.375 × width` lift accounts for (a per-building framing quirk, not a
  systemic bug — the general fix barely moves its lift, since its foot-band gap was only
  ~5%). Left for a manual nudge via `_anchor_overrides.json` rather than a fourth
  system-wide constant chased from one data point.
- **Background residue.** These AI gens paint a light checkerboard "pretend
  transparency" (near-white, ~240-253, low channel spread) instead of real alpha.
  `rembg` mostly strips it but leaves enclosed patches standing (e.g. `well_S3`'s gap
  between its stone pillars kept an opaque grey patch). `_cutout` now zeroes any pixel
  whose *source* RGB matches that checkerboard range before rembg's own cleanup, plus
  a faint-alpha (<12) sweep for the edge halo rembg leaves.
- `ingest.py` — walks folders per `mixboard_map.json` (folder → id, footprint x-cells,
  optional `anchor` mode), strips bg, trims, scales, anchors, writes
  `<id>_S{n}.png` + `_anchors.json` to `assets/tiles/buildings/ai/`. A hand-authored
  `_anchor_overrides.json` merges last — the one-line escape hatch for a bad detection.
- `preview.py` — contact sheet with anchor crosshairs for eyeballing; written to
  `assestProcessing/`, never shipped in `assets/`.

Auto base-vs-foot **classification** was tried and dropped: apron/fill metrics do not
separate farm plates from ordinary buildings on this art. Foot is the robust default;
the rare extended-plate type carries a one-word `"anchor": "base"` in the folder map.

### Game side

`assets/tiles/buildings/ai/` with its own `_anchors.json`, keyed `<id>_S<n>.png`.
`CityAssets` discovers the set from the manifest keys at load (no separate manifest
file; re-running ingest is all it takes to add or grow a building). A single
`variantKey(id, level)` owns the precedence **ai → grit → legacy iso**; draw, gray,
grade, anchor and pad all resolve through it, so they cannot diverge (`cityGrade`
delegates to it too). `stageBucket(level, stages)` clamps a level into 1..stages
(AI sets carry 6 stages vs grit's 3). Grit and iso variants are **not** loaded for an
id that has an AI set, keeping the eager sprite payload flat and first paint fast; this
also retired 20 dead legacy-iso 404s.

## Consequences

- Anchors are authored by the pixels, not by hand; the only manual inputs are the
  folder→id map and the odd override — both per-type, not per-image.
- Sprites are pre-scaled in Python because the renderer draws at native px (scale 1).
- Building UI icons are staged (`<id>_icon.png`, ≤256px) but not yet wired — cards
  still use emoji. Non-building `mixBoard` types are ignored until mapped.
- Regenerating the set is `python ingest.py` (optionally per-folder); anchors land in
  a reviewable manifest with a preview sheet.
