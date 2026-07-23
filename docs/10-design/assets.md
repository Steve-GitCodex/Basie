# Asset Inventory & Contracts

## Inventory

| Path | Contents |
|------|----------|
| `assets/tiles/buildings/buildingTiles_*.png` | Isometric building sprites (Kenney, mapped in `cityAssets.js ISO_BUILDING_MAP`) |
| ~~`assets/tiles/landscape/`, `assets/tiles/city/`~~ | **Removed.** Kenney ground/road tiles retired — base ground is now procedural (`js/ui/city/cityGround.js`). Old `GROUND_TILES` refs deleted (were 404ing). |
| `assets/tiles/terrain/` | Isometric terrain blocks with N/E/S/W rotations (unused so far) |
| `assets/sprites/ui-pack/` | Progress bars, button frames, crosshairs (available for UI use) |
| `assets/icons/svg/` | 50 SVGs for the unified `icon()` system (26 upgraded with Kenney Board Game Icons, CC0) |
| `assets/audio/combat/` | Kenney impact sets: metal/glass/bell/generic × light/medium/heavy × 5 variants — **unused, earmarked for grit reskin C1** |
| `assets/audio/effects/`, `assets/audio/ui/`, `assets/audio/voice/` | Sample packs — unused, earmarked for C1 |

## Building sprite contract

**Current (diamond iso — being retired, ADR 0009):** iso building on a 132×66-base
diamond footprint, PNG with transparency, **includes its own ground block**,
bottom-anchored over the zone tile, consistent light direction, ~2× diamond width for
tall buildings. Missing sprite → colored fallback diamond. **Do not source or generate
any more art against this contract.**

**Target (retuned iso ¾ view — grit Phase A3, ADR 0020 amends 0009):** the projection swap
to a screen-aligned square grid was **not executed** — the chosen CC0 building art
(Quaternius Ultimate Fantasy RTS) is **isometric-rendered**, so its footprints are diamonds
(~1.1–1.3:1), which need a **diamond grid**. `isoMath.js` is kept and retuned to match:
`TILE_W 128 × TILE_H 96` (~1.33:1), `GROUND_BOTTOM = TILE_H/2`. Building sprites are
pre-lit "3D-look" objects, ¾ iso camera (consistent across the pack), PNG with transparency,
bottom-anchored on the tile's front vertex, drawn at **native px** (no fit-to-width) —
trimmed to content bbox and downscaled by **one shared factor** so relative sizes are
authored (town hall > house); larger buildings overhang their plot. Ground = flat-color
**diamond** cells (grit palette); Kenney landscape sprites retired. Manifest is level-keyed
(`GRIT_BUILDING_MAP[type] = {1,2,3}`). Session-1 trimmed dims (@ shared scale 0.34, 256-tall
cap dropped): house 114–147w, farm 153–233w, barracks 153–235w, storehouse 213–216w,
townhall 199w.

**Function-readability requirement (Steve, 2026-07-15 — binding for A3):** the current
Kenney set fails legibility — 20 distinct sprites but all generic city blocks, so
nothing communicates purpose. Every A3 sprite must pass: (1) **function prop dominates
the silhouette** (farm = fields, mine = pit + headframe, barracks = tents + flag,
lumbermill = sawmill + log pile, well = well tower…); (2) **category silhouette test** —
tall/thin military-tech, low/wide production, clustered residential, identifiable when
squinting; (3) **zone color accent** baked in, matching the existing zone tints.
Generation prompts should name the function props explicitly per building.

Tinted/graded variants are pre-rendered once at load (`CityAssets._prerenderGrayscale()`
idiom) — never per-frame `ctx.filter`.

## AI-generated building sprites — prompt contract (2026-07-22)

The `mixBoard` AI-sprite attempt (ADR 0024) got the ingest pipeline (bg-strip → trim →
auto-anchor → scale) working, but the *art* didn't hold up and the effort was parked.
Steve's diagnosis, confirmed by a `game-designer` pass: it was never a materials
problem. Grit's 3D-rendered buildings read well in-game because they're kitbashed from
3-6 simple primitives (box body + roof wedge + a prop or two) — a human asset artist's
economy of form under a poly budget, which happens to be exactly the shape-legibility a
top-down strategy camera rewards. At the pixel budget this game actually renders at
(~40-130px per building), only massing and silhouette survive as information — texture,
weathering, gradient shading, and ornamental trim don't read as "detail," they read as
noise competing with the silhouette. AI image generation defaults to the opposite
target (hero-shot richness at close viewing distance), which is why "flashy" AI
buildings didn't fit in even when they were individually good-looking images. The same
root cause explains why regenerating/correcting an image tends to lose the isometric
asymmetric-diamond framing: language like "detailed" or "cinematic" pulls the model
toward its photographic/portrait training prior, which fights the isometric constraint
harder than a plain prompt does.

**Any future `mixBoard` generation must follow this template** (fill the bracketed
slots per building type):

```
[FRAMING — repeat verbatim, first line]
True isometric game-asset render, camera fixed at a 30-45° downward angle.
Ground footprint is an asymmetric diamond (wider than tall), matching a top-down
strategy-game tile — NOT a symmetric front-on view, NOT eye-level, NOT a
cinematic/portrait camera angle.

[BUILDING TYPE + DISTINGUISHING FEATURE]
Subject: {building_type_name} for a base-building strategy game.
Silhouette identity: {one_signature_shape_move} — this must be readable at a
distance; do not rely on color or texture to convey building type.

[MASSING CONSTRAINT]
Compose the building from no more than {N} simple geometric primitives: one
main rectangular-box or cylinder body, one simple roof shape ({gable / hip /
flat / dome} — pick one), and up to {N-2} small blocky props placed at the
building's base only (never mid-wall or roof-surface clutter). No ornamental
trim, no individual visible bricks/planks/shingles/tiles as texture, no
weathering, no gradient or painterly shading, no debris or scattered detail.

[COLOR / FINISH]
Flat, saturated color blocks: one roof color, one wall color, one accent color
for the signature prop. Single consistent top-left light source, one hard-edged
cast shadow. Clean matte finish, not photoreal materials.

[BACKGROUND / OUTPUT]
Isolated on a plain solid background (single flat color, high contrast against
the building), no ground plane clutter, no environment, no other buildings in
frame.

[NEGATIVE / REPEAT FRAMING]
Avoid: photorealistic textures, painterly rendering, ornate detail, weathered
surfaces, front-on or eye-level camera, symmetric square footprint, cinematic
lighting, scattered props, more than {N} distinct shapes.
Reminder: asymmetric isometric diamond footprint, camera fixed at 30-45°.
```

Notes:
- `{N}` (primitive cap) is the highest-leverage dial — start at 4-5; if a regeneration
  still drifts ornate, tighten to 3. If framing still drifts photographic, the framing
  reminder may need to move to the very last line (models weight prompt-end most on
  regeneration/inpaint passes).
- `{one_signature_shape_move}` must be a *shape* difference (roofline, one
  silhouette-scale prop, height proportion), never a texture/material difference — this
  is what actually survives the pixel budget the function-readability requirement above
  already demands.
- `base`-anchor types (extended ground plate — see ADR 0024) need the plate called out
  explicitly as one of the primitives ("one flat wide ground-plate/field base extending
  to the footprint edges"), not left implicit.
- **Anti-castle-drift (Steve, 2026-07-22):** a *second*, separate failure showed up in
  the first `mixBoard` round — a farm or iron mine at upgrade stage 3+ rendered as a
  castle with reskinned textures. Cause: generic per-stage escalation language
  ("grandest," "prestige materials," "statues," "iconic") has no per-building anchor, so
  the model defaults to its strongest "impressive building" prior — castle/monument
  imagery — regardless of the building's actual purpose. Fix: every building-type prompt
  needs an explicit **scale ceiling** stating what "bigger" concretely means for *that*
  function (a farm grows more/larger crop beds and haybales; a mine grows a taller
  headframe and more ore carts) and a same-purpose only rule ("stays a working farm,
  never becomes a manor or castle"). Only true prestige-tier buildings (HQ, hero
  quarters) are allowed architectural grandeur language. Codified per-building in
  `assestProcessing/building-fillers.md`'s `Scale ceiling` field.
- **Anti-cohesion-drift / "blocky random buildings" (Steve, 2026-07-22, second round):**
  after the massing/anti-castle fixes above, the next regeneration attempt produced
  buildings that read as scattered disconnected blocks rather than one coherent
  structure — the primitive-cap language constrained *how much* detail but not that the
  primitives must visibly join into a single form.
- **Prompt architecture rework (Steve + GPT critique, 2026-07-22, third round):** the
  first two rounds were written like an instruction to a reasoning model (long prose,
  negation — "never a castle" — abstract meta-fields like "scale ceiling"/"primitive
  cap"), which is the wrong register for a diffusion image model. Diffusion models
  handle negation poorly (naming a concept can reinforce it rather than suppress it),
  respond to concrete nouns rather than architecture-review language, and lose
  consistency across a long prompt. The multi-stage grid (all 4-6 levels in one image)
  was also its own failure mode — every stage's rendering was free to compromise with
  every other stage's, which is a likely contributor to both the cohesion and castle
  drift. **Reworked to:** a fixed, never-edited style bible (`Building-style.md`) pasted
  every time + a short per-building keyword block (`building-fillers.md`, rewritten to
  plain "Visual keywords" + per-level "additions" lists — concrete nouns only, zero
  negation) + one level generated at a time, chained by **image reference** (approve
  Level 1, then feed that image back in and prompt only the delta to reach Level 2, and
  so on) instead of a single grid image. `assestProcessing/Building-promt.md` now holds
  the workflow + why; `Building-style.md`/`building-fillers.md` are the actual prompt
  content and are the source of truth — this section records rationale, not literal
  wording. Same rework applied to hero portraits (`Hero-style.md`, `hero-promt.md`,
  `hero-fillers.md`) — heroes never had the grid problem (always one image each) but had
  the same negation/abstraction issue ("translate the magic into tech" language removed
  from the actual prompt; only the concrete scavenger-tech object nouns are sent).
  **Verified, then superseded (Steve, 2026-07-22, fourth round):** Steve tried
  generation and found the model holds a building's identity fine across all 4 levels
  from **one prompt that asks for 4 separate images** (one per level, each level's
  additions spelled out explicitly) — the one-level-at-a-time/image-chaining overhead
  wasn't buying anything over that. `Building-promt.md` now leads with the single-prompt
  workflow; the chained version is kept underneath as a fallback for any one building
  that regresses on it. `Building-style.md`/`building-fillers.md` are unchanged — both
  workflows consume the same style bible + per-level keyword blocks.
- **HQ-vs-house ambiguity + prop-ground bleed (Steve, 2026-07-22, fifth round):** two
  more issues surfaced testing the single-prompt workflow. (1) HQ's Level 1-2 keywords
  ("small timber hall, plain wood door, one banner") read identically to `house`'s
  cottage description — nothing in the words themselves said "command building" until
  the watchtower showed up at Level 3, so early-level HQ gens looked like a house.
  Fixed in `building-fillers.md` by baking command-only nouns (stone dais, perimeter
  wall, twin banner poles, reinforced doors) into HQ from Level 1 onward instead of
  deferring distinctiveness to the tower. (2) Exterior props (carts, statues, barrels)
  placed away from the core structure were sprouting invented ground/dirt/platform
  underneath them — traced to `Building-style.md`'s old composition rule demanding
  every prop "touch and join" the building, which pushed the model to invent a
  connecting base. Fixed by splitting the rule: the core structure (walls/roof/tower)
  still must be one cohesive joined mass, but exterior props are now explicitly allowed
  to sit near the building *without* touching it, each on its own contact shadow only —
  no ground/dirt/platform under the building or any prop.
- **Unreachable raised entrance (Steve, 2026-07-22, sixth round):** the fifth round's HQ
  fix put the entrance on a raised stone dais from Level 1, but didn't call out steps
  until "wide entrance staircase" arrived at Level 3 — early-level gens showed a door
  with no way to reach it. Fixed with a new global rule in `Building-style.md`
  ("Entrance"): any entrance above ground level must show steps/a ramp in the same
  image, stated alongside the platform every time it's mentioned, not introduced later
  as a separate addition. HQ's fillers now pair "dais" with "staircase" at every level.
- **Extra standalone prop images (Steve, 2026-07-22, seventh round):** a real HQ
  generation came back with the 4 correct level images *plus* two unwanted extras — a
  standalone banner-pole render and a standalone barrel-stack render, neither asked
  for. Traced to the fifth round's "props read as separate objects" wording in
  `Building-style.md`, which the model could read as "generate the props as their own
  images" rather than "draw the props as visually distinct elements within the one
  building image." Fixed by rewording that line to say props are part of the same
  image, never their own, plus an explicit "output exactly 4 images total, no
  standalone prop images" line at the end of `Building-promt.md`'s prompt shape
  (prompt-end carries the most weight on regeneration, per the earlier framing note).

- **Full-roster rewrite (Steve, 2026-07-22, eighth round):** HQ's regeneration under
  rounds 4-7 above came back clearly better than anything generated before, so the same
  discipline was applied to the rest of `building-fillers.md` rather than only to HQ:
  every Level 1 now names its entrance concretely (door type, opening, tent flap) instead
  of leaving an unnamed "small hall/shed," and buildings sharing a function tier now carry
  a signature prop the sibling doesn't use — infantry hall got a fenced practice yard with
  training dummies to stop it reading identically to barracks (both were "garrison hall +
  shield/spear rack + red"), and hero quarters was rewritten alongside HQ (marble columns
  + statues + grand staircase vs HQ's stone dais + perimeter wall + watchtower) so the two
  prestige buildings stay visually distinct. Not yet verified against real generations —
  HQ is the only building confirmed good so far.
- **Tower/hall ground-plane gap — retracted (Steve, 2026-07-22, ninth round):** in-game,
  HQ Level 3 read as "standing on one side, hovering on the other." Initial read: at row
  y=163 of `townhall_S3.png` the silhouette splits into two runs (x 29-71 and x 82-91),
  read as a disconnected tower foundation. **Retracted after zooming into the actual
  pixels** — it's one continuous stone base with a normal V-notch valley where the
  staircase recess meets the tower corner, not a gap. The "Ground plane" rule added to
  `Building-style.md` this round is harmless but wasn't the real fix; see round ten for
  what actually caused the hovering look.
- **Anchor algorithm fix, not another override (Steve, 2026-07-22, tenth round):** Steve
  pushed back on chasing this per-sprite — correctly. `anchor.py`'s `'foot'` mode located
  the anchor from the lowest solid row, then *estimated* the base's centre by lifting
  that point with an analytic formula (`ISO_HALF_DEPTH * ground_width`) assuming an
  idealised symmetric diamond base. Measured directly against `townhall_S3`: the widest
  row (the building's actual base rectangle) sits at y=136, but the old formula placed
  the anchor at y=117 — 19px off on the *vertical* axis, which is what read as
  "standing on one side, hovering on the other," not a horizontal offset (every
  horizontal measure — bbox-mid, mass-centroid, widest-row — already agreed within 5px).
  There was no prior "known-good" case being risked: HQ is the first building ever run
  through this pixel-detection pipeline (grit's anchors come from the 3D render rig, ADR
  0022, a different mechanism entirely) — Steve's "the old ones just work, they don't
  need overrides" was about that rig-exported set, not this script. Fixed `anchor.py` so
  `'foot'` mode measures the widest row directly (identical to `'base'` mode) instead of
  an analytic lift from the lowest row; `place_anchor()`'s lift step is gone. Also found
  and fixed in the same pass: `ingest.py`'s `STAGE_RE` matched "stage4" as a *substring*,
  so a same-folder reference file named `Stage4-removebg-preview.png` got ingested as a
  duplicate stage and silently bumped the real Level 4 art to a `_S5` slot — anchored to
  `^stage\s*(\d+)$` (full-stem match) so a reference file can sit in the same
  `mixBoard/<Type>/` folder without corrupting the sequence.
- **Swapped source breaks the fixed-scale assumption (Steve, 2026-07-22, tenth round):**
  after Steve replaced `mixBoard/HQ/Stage4.png` with a background-removed 500×500 export
  (down from the original 1024×1024 AI render), `townhall_S4` came out smaller than
  every earlier level (84×87 vs L1's 172×144) — backwards for a building that should
  grow. Root cause: `ingest.py` fixes one scale from Stage 1 and reuses it for all 4
  stages, which assumes every stage image fills its own canvas the same way; the
  replacement has more empty padding around the castle than the original, so the same
  scale produced a smaller crop. The anchor itself was correctly centred on the
  (too-small) building — a source-framing problem, not an anchor problem. `ingest.py`'s
  own `_cutout()` already runs rembg on every stage automatically, so the manual
  background removal wasn't necessary; getting Level 4 back to the right scale needs the
  original full-resolution Stage4 render (or a same-framing re-export), not another
  anchor tweak. L1-L3 are wired into the live `grit/` slot with the fixed algorithm; L4
  is held back until the source is sorted.
- **Override removed — it was an unverified guess, not a fix (Steve, 2026-07-22,
  eleventh round):** Steve pushed back on `_anchor_overrides.json` carrying a manual
  `townhall_S1.png` correction (`ax: 100`) — one source of truth, no per-sprite
  overrides. Checked whether it was still justified: the widest row does include the
  parked cart's pixels (row 104 breaks into runs at x 0-24 and x 34-167), which looked
  like the same cart-skew bug from earlier rounds. But tracing the actual pixels below
  that row shows the stone dais is one continuous solid surface running unbroken from
  under the cart to under the hall — the cart is parked *on* the shared base, not a
  disconnected prop floating beside it. Including it in the base-rect measurement is
  therefore correct, not a bug; the override (`ax: 100`) was an eyeballed guess made
  before this pixel check existed. Deleted `_anchor_overrides.json`; L1 now runs on the
  bare algorithm output (`ax: 84.0`), which reads at least as well in the verify
  overlay.

- **Residual negation purge — hero files (2026-07-23):** the 2026-07-22 rework claimed
  to drop negation from the hero prompt but three negations survived, two in the
  "paste-verbatim" `Hero-style.md` bible so they hit every generation: "no high fantasy",
  "not straight-on, not full profile", and "nothing implying magic" in `hero-promt.md`'s
  end-of-prompt reminder (worst-case placement per the prompt-end weighting note). All
  three removed — the concrete scavenger-tech nouns in `hero-fillers.md` already exclude
  fantasy/magic without naming it. `hero-fillers.md` keyword blocks were already clean.

**Reboot plan (Steve, 2026-07-22):** delete the parked `mixBoard`/`ai/` generations
except the ones already working well enough to keep as a baseline (candidate: some of
the mine renders). Regenerate against the template above, starting with the
**headquarters/townhall** — highest-visibility building, worth getting right first and
using as the calibration reference for `{N}` and framing-drift behavior across
regeneration passes. Once HQ reads well in-game, move to the next weak building (well,
or another currently-bad type) rather than batching the whole roster at once.

## Sourcing plan of record (grit reskin — ADR 0010)

**Buildings: CC0 pre-rendered iso PNGs (ADR 0020 — no Blender needed).** The Quaternius
**"Ultimate Fantasy RTS"** pack already ships a `PNG/` folder of finished ¾-iso renders
(1024², per family × level × age), CC0 1.0 — the render-to-sprite step is done. Drop-in is:
offline alpha-bbox **trim + shared-scale downscale** (headless-Chromium script, no
Blender/PIL) → `assets/tiles/buildings/grit/<key>_L<n>.png` → level-keyed manifest. The
`.blend`/`.fbx`/`.gltf` in the pack are unused 3D source. Building **evolution stages** →
per-level sprites. Kit-bash toward post-apoc is deferred; the A1 grit-grade layer
desaturates the bright-wood renders at load. Gap-fillers: Kenney 3D kits (Survival Kit, city kits,
Asset Forge for kit-bash-to-sprite), Quaternius Ultimate/Farm Buildings + Zombie
Apocalypse Kit, KayKit city modules. All CC0.

**Prop/deco additions (Steve-approved candidates, 2026-07-15):**
- *Low Poly Forest Pack* (Ajay Karat, opengameart, CC0 — 31 trees + 25 fences,
  textured): city terrain-ring deco (redone at the ADR 0009 swap) rendered in the same
  Blender scene as buildings; ash-recolored trees → world-map dead-forest decals (B3);
  fences → base-perimeter kit-bash props.
- *Kenney Mini Characters* (CC0, 25 rigged + animated 3D characters): still a candidate for
  **world-map march convoy tokens** (C2 juice). For **city walkers** it was passed over —
  chibi proportions read too clean for the grit palette; walkers now use Zombie-Kit survivors
  (below, 2026-07-23). Do NOT use at close-up scale (no portraits).
- *Zombie Apocalypse Kit* survivor characters (CC0): **WIRED (2026-07-23)** as the city
  walkers — `Characters_Lis/Matt/Sam/Shaun` rig-rendered to `assets/tiles/props/ambient/
  survivor_*.png` (grim-graded, `cityAmbientAssets.js`), replacing the drawn shapes in
  `cityAgents.drawWalker`. `Vehicle_Truck` from the same pack is the drone's parked home
  truck (`truck.png`).
- *Cube World Kit* (Quaternius, CC0, animated + textured): **do not mix into the city**
  — voxel aesthetic clashes with the low-poly RTS building library. Approved use only
  as cherry-picked enemies/animals rendered for **world-map POI markers** (separate
  visual context; style variance forgivable at marker scale).
- *Animated Mech Pack* (Quaternius, CC0, 4 rigged+animated mechs): **siege-squad march
  tokens** (mech convoy sprite sheet), **world-boss markers** (animated behemoth on the
  map), future Arena visuals. Fits post-apoc as salvaged war machines.
- *Ultimate Spaceships* (Quaternius, CC0, 11 ships): approved ONLY as a tiny scavenger-drone
  sprite + rare event flyovers; no spaceships as gameplay objects. **WIRED (2026-07-23):** the
  `Bob` ship is rig-rendered to `assets/tiles/props/ambient/drone.png` and is the city drone
  (`cityAgents.drawDrone`, grim-graded, follows the road path with a scan-beam).

**Equipment & loot (feeds the existing equipment framework + Phase 6 crafting):**
- *Low Poly Guns Pack* (Quaternius, OGA, CC0 — 40 guns): render to icon-size sprites →
  **hero equipment icons** / crafting catalog; secondary: military-building kit-bash
  detail (weapon racks).
- *Chest — Blizzard Style* (Yughues, OGA, CC0): **rare-loot moments only** (gacha
  reveal, boss drops).
- *Crate & Barrel Bundle* (Mastahcez, OGA, CC0 — crate + 3 barrel variants):
  **common-loot markers** (gather returns, camp drops) — together with the chest this
  gives a common/rare loot visual hierarchy; barrels also join the building kit-bash
  prop pool.
- *Cethiel's Weapons 3D* (CC0, 10 swords + 4 shields × 3 variants): conditional —
  cherry-pick the 2–3 plainest blades/shields as melee equipment icons only; the
  ornate fantasy pieces and hand-painted style don't fit the grit set.

**Remaining art gaps — sources decided (2026-07-15):**
- **War/battle effects:** *Kenney Particle Pack* (CC0 — explosions, smoke, flares,
  sparks) feeding C2's pooled-particle module; procedural particles for ambient
  ash/dust.
- **Hero skill icons:** *game-icons.net* (~4,000 uniform SVG icons, **CC-BY 3.0 — add
  a credits line**); consumed by the existing `icon()` SVG system as-is.
- **Hero portraits (open risk):** no CC0 source exists for a characterful portrait set.
  Plan: AI-generated with a locked style block + fixed palette, user-approved
  one-by-one, executed alongside the hero-UX redesign (portraits are its centerpiece).
  Fallback: commission.

**World-map terrain: AI-generated seamless atlas** (see `grit-reskin.md` § B3) — the
one place AI art is the right tool; it can also generate material textures for the 3D
models. Interim grading of existing Kenney sprites stays Phase A1. The 2D pack market
(CraftPix/itch pixel-art top-down) was researched and rejected for buildings; usable at
most for world-map decals.
