# 0010 — Building art via CC0 3D render-to-sprite pipeline (not direct AI sprites)

**Date:** 2026-07-15.

## Context

A3 needs ~20 building sprites (plus level variants) in one consistent ¾-view style that
read their function at a glance (ADR 0009 + the function-readability requirement in
`10-design/assets.md`). Research findings: the 2D asset market has no coherent
base-builder building set in this view (mostly pixel-art shooters); direct AI sprite
generation struggles with angle/lighting consistency across a 20+ item set. The CC0 3D
scene is rich: Quaternius (Ultimate Fantasy RTS, Ultimate Buildings, Farm Buildings,
Zombie Apocalypse Kit), Kenney 3D kits (Survival Kit, city kits, Asset Forge), KayKit.

## Decision

Buildings are produced by **batch-rendering CC0 low-poly 3D models to PNG sprites** from
one Blender scene: fixed orthographic ¾ camera + one grim light rig, so every sprite
shares identical angle/lighting automatically.

**Base geometry library: Quaternius "Ultimate Fantasy RTS"** (128 models, CC0, .blend,
authored for RTS camera angles) — chosen for its **building evolution stages**, which
become Basie's **per-level building sprites** (new A3 scope). Its fantasy theme is
treated as skeleton only: kit-bash toward post-apoc grit (swap thatch → corrugated
metal, add Survival-Kit props: barrels, antennas, tarps) and apply grit materials at
render time. The post-apoc direction (ADR 0008) stands — we are not pivoting to
fantasy. Gaps (tech/military buildings) fill from Kenney/Quaternius city + survival
kits. AI generation is retained only where it's strong: terrain textures (ADR/B3 plan)
and material textures for the models.

## Consequences

- Per-level visual progression becomes a feature (hut → house → compound); the sprite
  manifest gains level-keyed variants (`ISO_BUILDING_MAP` shape extends at A3).
- Consistency and function-readability come from model choice + one render scene, not
  from prompt engineering.
- Requires a one-time Blender scene setup (camera/rig/render script) — user-in-the-loop
  for kit-bashing; re-renders are cheap thereafter (new levels, new buildings, style
  tweaks).
- Expected look: coherent **stylized grit**, not Last Shelter's painterly realism —
  accepted trade-off vs. inconsistent AI sprites.
