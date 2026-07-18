# 0013 — Grid renderer: fixed-resolution chunk textures, whole-cache invalidation

**Date:** 2026-07-16.

## Context

Grit reskin Phase B2 replaces `WorldRenderer`'s organic region-polygon terrain layer with
the B1 cell grid (ADR 0011): 96×96 cells at 100 world px. 9,216 cells cannot be drawn per
frame, so `docs/10-design/grit-reskin.md` § B2 specified offscreen chunk caching (16×16
cells), a zoom LOD, and per-cell fog derived from existing state.

Three points the design left open had to be settled:

1. **At what resolution a chunk is rasterised.** A chunk covers 1600×1600 world px; caching
   at 1:1 costs ~10 MB per chunk, and the camera spans zoom ~0.075 (whole map) to 1.6, so
   no single scale is native everywhere.
2. **Invalidation granularity.** The design said "invalidate a chunk only when something in
   it changes".
3. **How region labels behave** once regions are cell fields rather than drawn polygons.

## Decision

**Chunks rasterise at a fixed texture scale and blit with smoothing off.** `TEX_CELL = 32`
→ a 512×512 canvas per chunk (~1 MB), LRU-capped at 24. Because every cell is a *uniform*
block of colour (flat terrain + per-cell jitter + tint + fog), nearest-neighbour upscaling
is exact: a cell stays crisp at any zoom with no per-zoom re-rasterisation and no blur.
This is what makes one cached scale viable across the whole zoom range. It holds only while
cells are flat fills — **B3's terrain atlas breaks this assumption** and will need either a
zoom-bucketed cache or a native-resolution texture.

**Cell seam lines are drawn live in world space, not baked into the chunk texture.** They
are the one high-frequency detail on the map, and baking them at `TEX_CELL` would be the
only thing the nearest-neighbour blit could not reproduce cleanly.

**`invalidate()` drops the whole cache**, deviating from the design's per-chunk
invalidation. Only chunks intersecting the viewport are ever re-rendered (~4 at default
zoom, 256 cells each), so the rebuild is cheap and arrives on the next frame; tracking which
chunks a given state change touches is bookkeeping with no measured payoff. Revisit if a
future change invalidates on a tick rather than on discrete world events.

**The faction tint carries two alphas.** Over terrain (detail LOD) it must not drown the
cells: 0.14 owned / 0.11 otherwise. Below `LOD_ZOOM` (0.22) chunks are a flat fill on a bare
land base and the tint is the *only* territory signal, so it strengthens to 0.34 / 0.26.

**Region labels render at constant screen size** (`scale = 1 / camera.zoom`) with no zoom
gate. Labels are the map's primary navigation aid and are needed most when zoomed out —
which is exactly where a world-space label shrinks to nothing.

## Consequences

- `WorldRenderer` 504 → 426 lines; the tile engine lives in `js/ui/world/gridLayer.js`
  (226 ln). The organic warp field (`_warpX`/`_warpY`/`_outline`/`_traceRegion`) is deleted
  — region shape is now the sector rect, and the command-ruin "ready to assault" pulse
  became a sector-rect stroke.
- **No new save state.** Fog is a pure function of `isRegionUnlocked` plus reveal circles
  from player-held `revealRadius` outposts — the same sources `WorldMapManager.revealArea`
  uses, so the cell mask cannot disagree with per-POI fog.
- Chunk→sector containment is load-bearing: tint and fog resolve **once per chunk** from
  its top-left cell. Valid only because `SECTOR.cells % CHUNK_CELLS === 0` (32 % 16).
  `tests/unit/gridLayer.test.js` asserts this — changing either constant must keep it.
- `POI_PICK_RADIUS` 42 → 50 world px (half a cell), per ADR 0011's note.
  `HOME_ZOOM` stays 0.7: a 70px on-screen cell frames ~18 cells across, which reads right.
- Verified 60fps (16.7ms median, 16.8ms p95) during a drag sweep at default zoom, headless
  Chromium at 1280×800.
- **The zoomed-out flat-LOD path does not touch the chunk cache**, so a cache bug is
  invisible there. The `world-smoke.mjs` regression deliberately pans at default zoom to
  exercise the cached path, and asserts on owned-tint hue rather than a whole-canvas hash
  (boss/ruin markers pulse on their own timers, so any "did anything change" metric
  self-drifts and false-passes).
