# Dev Anchor Nudger — design

**Date:** 2026-07-22 · **Status:** IMPLEMENTED (`npm test` 305/305, dev-smoke assertions
pass, live-verified) · `?dev`-only tooling. See `docs/40-active.md`.

## Problem

Setting a building sprite's ground anchor (and size) so it sits centred on its plot is
currently a JSON-edit → re-screenshot loop. No single pixel heuristic centres every
sprite (ADR 0024): a side prop (HQ cart) fools it one way, front steps the other. We
need to place buildings by eye, per stage, and read off the values.

## Goal

In `?dev`: click a building to select it, flip a **Building mode** toggle, then drag it
to sit right and mouse-wheel to scale it — live — and copy a ready-to-paste
`_anchor_overrides.json` entry. Replaces trial-and-error.

## Scope

- **Transforms:** position (`ax`/`ay`) + scale (`s`) + **tilt** (`r` in-plane rotation°,
  `k` horizontal-shear°) — added as a follow-up (Steve). No flip. These are 2D transforms
  about the anchor (spin/shear a flat sprite, base stays grounded), not true 3D; usable at
  small angles to straighten or lean a sprite. `Alt+wheel` = rotate, `Ctrl+wheel` = skew.
- **Apply:** on-screen `ax/ay/s` readout + Copy button → clipboard JSON entry. Static
  hosting, no backend write.

## Components

### 1. Anchor manifest gains optional `s`; game reads the override file directly
- `_anchors.json` / `_anchor_overrides.json` entries may carry `s` (scale, default 1):
  `{ "ax": 70, "ay": 140, "s": 1.15 }`.
- `CityAssets._loadAnchors` loads `_anchors.json`, then merges
  `_anchor_overrides.json` **on top** (same precedence `ingest.py` uses, but at game
  load). A pasted override shows in-game on reload **without re-ingest** and still
  survives a future re-ingest — one file to edit.
- `anchor(id, level)` returns `{ax, ay, s}` (`s` defaults to 1 when absent).

### 2. Renderer honours scale
- `CityRenderer._spriteBox(slot, scale)` multiplies its draw scale by `anchor.s`.
  Hit-test (`_pointInSlotSprite`), proxy rect (`_slotRect`), badge (`_slotTopWorld`)
  all derive from `_spriteBox`, so they follow with no extra change.

### 3. Live-preview override API (CityAssets)
- `setDevAnchor(id, level, {ax, ay, s})` / `clearDevAnchor(id, level)`: in-memory map
  checked FIRST by `anchor()`. The RAF loop redraws each frame, so drag/scale show
  instantly, before anything is committed to a file.

### 4. Shared, click-driven selection (no toggle)
- Clicking a building in `?dev` emits `dev:buildingSelected` `{ buildingId }` (hooked in
  the existing base-view click path, DEV-gated). Passive — the normal tooltip still opens.
- `DevLevelSwitcher` listens → switches its building dropdown + repopulates levels.
- `DevAnchorNudger` listens → retargets. So the nudger has **no** building dropdown; it
  acts on the selected building at the level the level-switcher is showing.

### 5. `DevAnchorNudger` widget (`js/ui/dev/DevAnchorNudger.js`, `?dev` only)
- UI: **[Building mode ▢]** · live `ax / ay / s` · **Copy** · **Reset**.
- **Building mode ON:** an overlay canvas over the city view captures pointer input.
  Drag *over the selected building* → translate anchor (screen Δ → sprite px, divided by
  `zoom` and `s`); wheel *over it* → scale (±2%/notch, Shift = fine). Drag/wheel over
  empty ground fall through to normal pan/zoom (navigate while editing). Draws the plot
  diamond + centre dot for reference.
- **Building mode OFF:** pure gameplay; readout still reflects the selected building.
- **Copy:** clipboard gets the override entry keyed by the current sprite filename
  (e.g. `"townhall_S3.png": { "ax": 70.0, "ay": 140.0, "s": 1.10 }`).
- **Reset:** `clearDevAnchor` → back to manifest values.
- Wired in `main.js` under `if (DEV)` beside `DevLevelSwitcher`/`DevPopupMuter`.

### 6. Styling
- `css/components/dev.css` (existing `.dev-widget` styles).

## Testing

- **Unit (`cityAssets.test.js`):** override-file merges on top of `_anchors.json`;
  `s` defaults to 1 when absent; `anchor()` shape includes `s`.
- **Browser (`dev-smoke.mjs`, appended):** widget mounts in `?dev`; a manifest `s`
  scales the `_spriteBox` box; `dev:buildingSelected` syncs the level-switcher dropdown.

## Notes / limits

- AI sprites are rasters — scaling **up** past ~1.1× softens. For a large size change,
  bump the Python ingest target and regenerate; the nudger's scale is for fine fit
  (±10-15%) and finding the number to bake. The readout will say so.
- Raster scale `s` is a render-time multiply; acceptable for calibration and small fit.
