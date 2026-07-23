# City ambient life — grit walkers + road-following ship-drone & truck

**Date:** 2026-07-23 · **Status:** design approved, pre-implementation
**Module:** `js/ui/city/cityAgents.js` (+ new ambient-sprite loader, rig pipeline)

## Goal

Upgrade the base city's ambient life without touching gameplay:

1. **Walkers** — replace the procedural circle+rectangle pedestrians with rig-rendered
   **Zombie Apocalypse Kit** survivor characters (CC0) — grit-appropriate, not Kenney chibi.
2. **Drone** — replace the procedural ellipse drone with a rig-rendered small **Ultimate
   Spaceships** craft (CC0), and stop it flying straight over the HQ: make it follow the
   road network out from a **visible parked truck** and back.

Both are cosmetic and share one rig-render asset pass. No change to buildings, economy,
saves, or the number of agents.

## Current state

- [`cityAgents.js`](../../../js/ui/city/cityAgents.js) owns 3 wandering walkers + 1 drone.
  - `drawWalker` draws each walker as an hsla circle (head) + 4×5px rect (body) + shadow
    ellipse, with an up/down bob. Walkers traverse the `roadGraph` via `_nextRoadCell`.
  - `drawDrone` draws the drone procedurally (elevated ~34px, cyan ellipse body + beam +
    bob). `_buildDronePath` picks the single widest road **row** and glides it straight
    edge-to-edge (wrap-around teleport) — so it passes *over* the HQ.
  - The full `roadGraph` is already built in `setRoads` but the drone ignores it.
- Assets (CC0), by pack:
  - **Zombie Apocalypse Kit** — already unpacked in the rig (`packs/zombie/`, used for the
    siege workshop). Survivor characters `Characters_Lis/Matt/Sam/Shaun.gltf` (+ zombies,
    dogs); vehicles `Vehicle_Truck.gltf`, `Vehicle_Pickup.gltf` (plain, distinct from the
    siege workshop's `Vehicle_Truck_Armored.gltf`).
  - **Ultimate Spaceships** — zip in `assets/_incoming/`, 11 ships (Bob, Pancake,
    Dispatcher, Striker, Spitfire, …). Not yet unpacked; needs one ship's `glTF/` folder
    dropped into the rig's `packs/spaceships/`.
- The sprite rig ([`assets/_rig/`](../../../assets/_rig/), ADR 0021) already loads glTF
  through a three.js orthographic **iso camera** and exports a **ground-contact anchor**
  (projected base origin) per sprite — exactly what walker feet, a parked truck, and a
  ship's under-point need.

## Locked decisions (from brainstorming)

**Walkers**
- Visual swap only — same 3 walkers, same drone count.
- **Static pose** (mid-stride), reuse the existing bob; no walk-cycle frames.
- **One pose, mirrored horizontally** for left/right facing (no 4-way iso renders).
- **Curated pool = the 4 Zombie-Kit survivors** (`Lis/Matt/Sam/Shaun`), grim-graded, one
  assigned per walker, rotating on respawn (replaces the `hue` field). Optionally one
  zombie shambler for flavor — implementer's call.
- Source = **rig-rendered glTF**, not preview PNGs.

**Drone**
- **Rendered ship sprite** from Ultimate Spaceships (a compact craft — candidates Bob /
  Pancake / Dispatcher; final pick swappable), grim-graded. Replaces the procedural ellipse
  body. Keep the elevated flight, the shadow, the bob, and a subtle scan-beam under it.
- **Road patrol, out-and-back to home.** Elevated flight unchanged; only the horizontal
  ground track changes.
- **Visible parked truck** as home: Zombie-Kit `Vehicle_Truck` (or `Vehicle_Pickup`),
  distinct from the siege armored truck, rig-rendered + grim-graded.
- **Dock** = deterministic road cell toward a map corner ("drove in from outside").
- **Single out-and-back beat**: dock → farthest reachable road cell → back → repeat.
- Facing: **mirror L/R by travel direction** (same as walkers) — no full heading-rotation
  of the iso-rendered ship (that reads as banking); heading-rotation is a possible later
  polish.

## Design

### Shared asset pipeline (rig, one pass)

- Unpack the chosen ship's `glTF/` into the rig's `packs/spaceships/` (zombie already
  present).
- Add an `jobs-ambient.json` rendering the survivor characters + one truck + one ship
  through the **existing iso camera** (same 3/4-from-above angle as buildings, so agents sit
  in the scene), each at a small fixed `fit`, trimmed to content bbox, with the rig's
  `_anchors.json` giving each a **ground-contact anchor** (feet / wheels / ship underside).
- Output PNGs + `_anchors.json` to `assets/tiles/props/ambient/`. These ship in the repo
  (no runtime 404s) and are regenerable by re-running the rig, same as buildings.
- Chosen character/truck/ship files are named in the jobs file during implementation.

### Ambient asset loading + grading

- New small module `js/ui/city/cityAmbientAssets.js` — decodes the walker, truck, and ship
  sprites, loads their anchors, and pre-renders **grim-graded** variants once at load using
  the same filter constant as `CityGrade._gradeImage` (duplicated as a tiny pure helper, not
  a CityGrade dependency, to avoid coupling ambient props to building grading). Kept out of
  `CityAssets` so that stays building-focused (no-god-files).

### Walker rendering (`cityAgents.js`)

- Each walker gets a `sprite` (pool index, rotating on respawn) instead of `hue`.
- `drawWalker`: draw the graded survivor sprite via `drawImage`, **scaled to a constant
  on-screen height** (`WALKER_PX`, ~14–16px) regardless of source resolution, seated so the
  sprite's **feet-anchor** sits at the walker's tile point. **Mirror horizontally** when the
  walker's screen-x is decreasing (moving left). Keep the existing shadow ellipse and bob.
- **Fallback:** sprite missing → draw the current procedural blob (no regression).

### Drone rendering + path (`cityAgents.js`)

- `drawDrone`: draw the graded ship sprite (scaled to `DRONE_PX`) at the elevated point,
  **mirrored L/R** by travel direction, keeping the shadow on the ground below, the bob, and
  a subtle beam. Procedural ellipse body removed. **Fallback:** ship sprite missing → the
  current procedural drone (no regression).
- `setRoads` also picks the **dock cell** (deterministic: road cell maximizing distance
  toward a chosen map corner) and the **far cell** (BFS farthest road cell from the dock).
- Replace `_buildDronePath` with a **BFS shortest path over `roadGraph`** from dock → far
  cell. Because road cells are the gaps between building plots, this path inherently routes
  **around the HQ** and every building.
- `update`: drone advances along the path and **ping-pongs** (dock → far → dock) instead of
  the wrap-around teleport. Speed unchanged. `dronePos`/`droneDepth` read the current ground
  point on the path.
- Truck is a static grounded sprite at the dock cell, drawn + depth-sorted like a walker.

### Depth / integration (`CityRenderer`)

- CityRenderer already interleaves drone + walkers with buildings by depth. Add the truck as
  one more grounded depth-sorted sprite (same seam the walkers use). No new render loop.

## Testing

- **Unit** (`tests/unit/cityAgents.test.js`, new or appended): dock/far-cell selection is
  deterministic for a fixed road set; BFS path connects dock→far and is contiguous on the
  graph; drone ping-pong stays within path bounds; walker sprite-pool assignment rotates and
  the left/right mirror flag matches movement direction. Pure logic only (no canvas).
- **Boot smoke** stays green — sprites ship in-repo, so no new 404s; city still renders.
- **Manual `?dev`** screenshot: walkers read as little graded survivors; drone is a small
  ship following roads around the HQ and returning to the parked truck.

## Out of scope / non-goals

- No walk-cycle animation, no 4-way facing, no per-building "worker" association.
- No gameplay/population/labor system.
- No change to drone count or elevation; no second drone; no ship as a gameplay object
  (per assets.md: spaceships approved *only* as the scavenger-drone sprite).
- No new save fields (all ambient state is transient, rebuilt in `setRoads`).

## Fallbacks & risks

- Any sprite load failure degrades to current procedural drawing (walker blob / procedural
  drone; truck simply absent, dock stays an invisible cell).
- Rig scale tuning is decoupled from correctness: the renderer draws to a fixed on-screen
  height, so source sprite resolution only affects sharpness, not seating.
- Character/ship selection may need one iteration for grit fit at ~14px (silhouette + grade
  matter more than identity) — cheap to re-pick and re-render.
