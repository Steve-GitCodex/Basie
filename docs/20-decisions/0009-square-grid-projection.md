# 0009 — Retire diamond isometric; base view moves to a square-grid ¾ projection

**Date:** 2026-07-15.

## Context

The base view uses classic 2:1 diamond-tile isometric (Kenney 132×66 sprites,
`isoMath.js`). The reference games for the grit direction (Last Shelter, State of
Survival, etc.) don't use diamond iso — they are 3D engines rendering building models on
a **screen-aligned square grid** from a fixed ¾ top-down camera; the "iso" feel comes
from the camera and the pre-lit 3D art, not from diamond tiles. Steve dislikes the
diamond look, and the new world map already uses the square/top-down projection family.

## Decision

Swap the base-view projection to a square grid with mild vertical foreshortening
(`gridMath.js` replacing `isoMath.js`), executed **together with grit Phase A3** (sprite
replacement) since both are the same art-contract change. The sprite contract becomes:
square-tile footprint, ¾-view pre-rendered "3D-look" building, consistent camera angle
and lighting (see `10-design/assets.md`). No engine change — Canvas 2D stays; no
three.js/WebGL.

Everything projection-agnostic survives untouched: CityCamera patterns, culling, painter
sort, blueprint col/row semantics, `_placements`, zones, and the tutorial proxy layer.
Base and world converge on one projection family, letting Workstream B's chunked-terrain
renderer be reused for the city ground layer.

## Consequences

- All building/ground sprites are replaced (already A3's scope); the decorative diamond
  terrain ring is redone; diamond hit-test/seating math is deleted.
- A1 (grim grade) and A2 (UI theme) still land first — they are projection-independent.
- Don't source or generate any more diamond-iso art.
