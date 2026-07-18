# 0018 — C2 canvas juice (shared particle field)

## Context

Grit reskin Workstream C phase C2 (`docs/10-design/grit-reskin.md` § C2). A1/A2/B1/B2/C1/A4
have shipped; the game reads grit but still feels static — no motion beyond the city
drone/walkers and a plain march dot. C2's brief: drifting ambient motes on both canvases,
chimney smoke on producing buildings, construction dust, muzzle/impact bursts on battle
resolution, a region-capture ripple, animated march convoy movers with an ETA, and a
building tap "pop". The binding guardrail: don't grow `WorldRenderer.js`/`CityRenderer.js`
(new capability goes in a sibling module), and never `ctx.filter` per frame.

## Decision

One shared, pooled, **space-agnostic** particle module — `js/ui/fx/particles.js`
(`ParticleField`) — used by both canvases. Positions/velocities are in whatever units the
caller emits in; `draw(ctx)` renders under whatever transform is currently set, so a
renderer keeps **two** fields: a screen-space one for ambient haze and a world-space one
for effects anchored to tiles/POIs. `update(dt)` is pure motion (integrate → drag → reap
via in-place compaction), so it is unit-testable in Node with no canvas. Shapes: `dot`,
`spark` (velocity-aligned streak), `ring` (radius grows with `grow`). Emitter helpers on
the field keep call sites one-liners: `haze` (accumulator-paced screen trickle), `burst`
(radial sparks), `ripple` (expanding ring), `puff` (rising smoke/dust).

Wiring:

- **WorldRenderer** — `_ash` (screen) + `_fx` (world). `_frame` now updates both fields
  every frame and redraws when dirty **or** marches active **or** fx alive **or** the
  ~30fps ambient tick is due (`AMBIENT_MS`). `impactAt(poiId, kind)` and
  `rippleRegion(regionId)` are the public triggers; **WorldMapUI** calls them from
  `march:arrived` (victory/boss_victory/captured/explored → amber burst; defeat → grey)
  and `world:regionCaptured` (green ripple at the region centroid). `_drawMarchArcs` gained
  a fading 4-dot trail behind the mover and an ETA pill (`m:ss`, or `⚔` while acting)
  computed from the phase's absolute timestamp.
- **CityRenderer** — `_dust` (screen) + `_fx` (world). `syncState` precomputes `_smokers`
  (built production-zone slots) and `_builders` (under construction); `_updateFx` trickles
  dust, puffs dark chimney smoke over smokers and pale dust over builders, all
  accumulator-paced by count. `popTile(slot)` (fired from `cityInput` on a building tap)
  records a start time; `_popScale` applies a ≤13% sine bump to the sprite footprint over
  260ms, bottom-anchored so it grows from its base.

## Consequences

- The world map now redraws continuously at ~30fps while the view is open (it previously
  idled unless dirty/marching). The grid is chunk-cached so the added cost is a blit +
  markers + a handful of particles; the city already ran this way. Battery/mobile ceiling
  is the same open concern the roadmap tracks for the city ground layer — unchanged by
  this, but now applies to the world view too.
- Fields are **transient/derived** — nothing is serialized (consistent with fog/boss
  windows). Pool caps (world 140/220, city 120/180) bound worst-case draw cost.
- Ripple/impact triggers take **region/POI ids**, not display names — a caller passing a
  fiction name (e.g. `ashwood` instead of `mistwood`) silently no-ops. This matches the
  ADR 0002/0017 rule that ids are the real keys.
- Deferred to a C2 follow-up (not blocking, lower value, touch toast/overlay wiring):
  screen flash + camera nudge on battle victory/defeat toasts, and pre-rendered 2-frame
  building light-flicker overlays.
- `SoundManager` is untouched — C1 already fires impact/voice on the same events; the
  visual burst and the audio impact now land together with no new wiring.
