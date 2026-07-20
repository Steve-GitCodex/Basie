# 0021 — Building sprites are rig-rendered to the tile grid (amends 0020)

**Date:** 2026-07-19 · **Status:** accepted

## Context

ADR 0020 wired five building types using the Quaternius pack's pre-rendered PNGs,
retuning `isoMath` to their ~1.33:1 diamond and drawing at native px with one shared
trim scale (0.34). Extending that to the remaining types broke down: other packs'
renders (and the un-migrated Kenney fallbacks) use camera angles and scales we don't
control, so footprints never agree with the grid and relative building sizes were
accidental (houses rendered enormous next to quarries). Most packs on disk ship 3D
sources (glTF/GLB/OBJ) alongside or instead of renders.

## Decision

Own the render step: a headless-Chromium three.js rig (scratchpad `rig/render.html` +
`render-rig.mjs`, driven by per-batch `jobs-*.json`) renders every building model
through one orthographic camera whose projection is locked to `isoMath`'s 128×96
diamond (azimuth 45°, elevation `asin(TILE_H/TILE_W)`; verified by projecting tile
corners → exactly 128×96 px). One shared light rig; per-type `fit` (footprint in
tiles) makes relative sizes authored. Sprites are alpha-trimmed symmetric about
center-x with the bottom edge pinned to the tile's front vertex, matching
CityRenderer's bottom-anchored draw — so every sprite seats on its plot by
construction. Loaders: glTF/GLB + OBJ/MTL (Farm Buildings pack is OBJ-only).

All 20 building types now render from CC0 3D sources: Ultimate Fantasy RTS (15),
Farm Buildings (well L1–2, cavalry stable, lumbermill L2–3), Zombie Apocalypse
(well L3 water tower, siege workshop container/armored truck). `townhall` swapped
from TownCenter plaza to Temple (reads as an HQ). `GRIT_BUILDING_MAP` covers every
type; `ISO_BUILDING_MAP` remains only as a load-failure fallback.

## Consequences

- New/changed art is a rig re-run (`node render-rig.mjs jobs.json`) + manifest entry;
  no grid retunes per pack, no Blender.
- Sprite look (lighting, grit level) is tuned in one place (`lights` in the jobs file).
- The rig lives in the session scratchpad; it is tooling, not shipped code — copy it
  forward via `docs/40-active.md` pointers when needed.
- Level badges moved off the sprite into the bottom label line ("Lv4 HOUSE 1",
  `CityRenderer._drawLevelBadge`) — sprite heights vary by design, so above-sprite
  badges either overlapped art or floated.
- Sprites seat by front corner: the rig aligns each model's footprint front corner to
  the tile front vertex (oversized buildings overhang toward the back), one shared
  light rig with self-shadowing, and a mild desaturate/warm post-filter so multi-pack
  palettes match.
