# 0004 — Camera clamp rules per view

**Date:** back-filled 2026-07-15.

## Context

Free cameras over finite maps show void and break the diegetic feel; over-tight clamps
frustrate panning.

## Decision

- **City (`CityCamera`)**: "searchlight" clamp — pan is clamped in diamond-space with an
  `EDGE_OVERHANG` allowance over a gradient backdrop (supersedes the original strict
  no-void/cover rule). `⌖` / `CityRenderer.home()` re-frames the HQ.
- **World (`WorldCamera`)**: **contain** zoom floor + margin clamp — the player can zoom
  out to the whole map and pan to every edge (changed from the MVP's cover floor when the
  9-tile tessellation landed).
- Cameras are projection-agnostic ports of the same structure (pan/zoom/clamp/cull).

## Consequences

- Zoom floors are per-view tuning constants; retune when map bounds change (grit reskin
  Workstream B grows the world ~7×).
- Culling and hit-testing read the camera's view rect; renderers never own camera state.
