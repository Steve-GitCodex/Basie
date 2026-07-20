# 0020 — A3 grit buildings: pre-rendered iso PNGs; keep (retuned) diamond grid

**Date:** 2026-07-18. Amends ADR 0009 and ADR 0010 where reality diverged from their
assumptions.

## Context

A3 started with the two CC0 packs Steve dropped in (`Ultimate Fantasy RTS`, `crate&barrel`).
Inspecting them changed two premises the earlier ADRs were written on:

1. **ADR 0010 assumed a Blender render-to-sprite step.** The Quaternius pack already ships a
   `PNG/` folder of finished ¾-view renders (1024², RGBA, per family × level × age), CC0 1.0.
   No Blender, no 3D→2D pipeline needed — the render-to-sprite was done by the pack author.
   The `.blend`/`.fbx`/`.gltf`/`.obj` in the pack are unused 3D source.
2. **ADR 0009 assumed the new art would want a screen-aligned square grid.** Measured, the
   sprite footprints are **isometric diamonds** (a square under a high-angle iso camera),
   ratio ≈ **1.1–1.3:1** (TownCenter fence-corner footprint: 585×534 px). A screen-aligned
   square grid would sit crooked under these — they need a **diamond grid**.

## Decision

- **Keep the diamond-iso projection** (`isoMath.js`), do **not** introduce `gridMath.js` or a
  square-grid swap. Retune the diamond ratio to match the art: `TILE_W 132→128`,
  `TILE_H 66→96` (~1.33:1), `GROUND_BOTTOM = TILE_H/2` (front vertex; no sprite skirt).
  `isoMath` is fully parametric on `TILE_W`/`TILE_H`, so camera clamp, hit-test, painter
  sort, blueprint, placements, and the tutorial proxy all carry over unchanged. The one
  fix required outside the constants: `CityCamera.minZoom` had the old `66/33` hardcoded —
  now derived from `TILE_W`/`TILE_H`.
- **Buildings draw at native px** (no fit-to-plot-width). Sprites are trimmed offline to
  their content bbox and downscaled by **one shared factor** so relative sizes are authored
  (town hall bigger than a house); larger buildings overhang their plot (intended dense look).
- **Ground becomes flat-color diamond cells** in the grit palette (`GROUND_COLOR` in
  `CityRenderer`); the Kenney landscape diamond sprites are retired (they were 2:1, wrong for
  the new ratio). A real city terrain atlas is a later pass.
- **Manifest is level-keyed:** `GRIT_BUILDING_MAP[type] = {1,2,3}` (age = FirstAge for now),
  `building(id, level)` resolves via `gritBucket` (Lv1→1, Lv2→2, Lv3+→3), falling back to the
  legacy `ISO_BUILDING_MAP` (Kenney) for un-migrated types. `cityGrade` grades every loaded
  variant key. Session 1 wired the five always-on-screen types (townhall, house, farm,
  barracks, storehouse); remaining types are one-line manifest additions.

## Consequences

- ADR 0009's "retire diamond iso → square grid" is **not executed**; the diamond grid stays,
  retuned. ADR 0009's other survivors (camera, culling, painter sort, placements, proxy) held.
- ADR 0010's Blender-scene requirement is **moot** for this pack — assets are drop-in PNGs
  after an offline alpha-bbox trim + shared-scale downscale (headless-Chromium script; no
  PIL/Blender). The kit-bash-to-post-apoc idea is deferred; the A1 grit-grade layer
  desaturates the bright-wood renders toward the palette at load.
- Per-level evolution is real (foundation → developed → grand across L1–L3).
- Trim step is scriptable and repeatable for the remaining ~15 types + gap-filler packs.
- Known art weakness: `townhall` uses TownCenter (a monument plaza, reads light as an HQ);
  a swap to Temple/Wonder is a one-line manifest change if desired.
- Assets live under `/assets/` which is **git-ignored** project-wide — the grit PNGs are
  on-disk only, matching every other asset in the repo.
