# Prototype brief: world map rework

Written 2026-10-12. This is the single source for building the world-map rework prototype. The design was agreed with
Steve (the owner) in a brainstorm. Read this brief fully, then the documents it points to, before writing any code.

## 1. What the prototype is for

Steve must **see and feel** the reworked world map before it's sliced into implementation plans. It is a design tool,
not game code. Nothing goes into `js/` or `css/`.

**The design (read it fully):** `docs/superpowers/specs/2026-10-12-world-map-rework-design.md`.

**Background:**
- `docs/research/world-map-codebase.md` (what's wrong today; §4 and §8 especially);
- `docs/research/world-map-genre.md` §4, §6 and §7;
- `docs/research/world-map-tiered-cities.md` §5 (making tiers visible).

Steve's past feedback on prototypes, which applies here:
- They must start from **how the current UI looks**: the top bar, dock, More FAB and panels. They don't have to be
  pixel-exact.
- They must be **easy to follow**, with a guided walkthrough.
- **We can still improve the current UI.** Mark improvements, don't hide them.
- Earlier rejected attempts:
  - static disconnected screens;
  - invented UI chrome and emoji;
  - marches "from nowhere";
  - weak guidance where Steve had to hunt for what to click;
  - overlapping markers.

**This prototype differs from the AI ones:** the map itself is new, so you **draw the new map live on a canvas**. You
don't overlay a screenshot. The game chrome around it (top bar, dock, More FAB, Marches panel, legend) is rebuilt to match
the real UI. The current map appears only as the "was" reference.

## 2. Non-negotiable requirements

1. **Guided walkthrough first.**
   - Next / Back and the arrow keys.
   - A caption card (1–3 plain sentences, docked outside the game frame).
   - A spotlight on what matters.
   - Progress, e.g. "Step 4 of 18 · Fog".
   - An **Explore mode** toggle: pan and zoom the map freely, click provinces and POIs, switch the zoom band, fog on/off.
   - Steps drive the UI themselves: camera moves, cards opening, marches running.
   - **Deterministic:** each step is a pure function of the step index, so Back restores the earlier state exactly.
2. **Mark what's new.**
   - A cyan **NEW** tag for new elements.
   - An amber **IMPROVED** tag (with "was: …") for changes to existing surfaces.
   - A legend at the top.
   - The map as a whole is IMPROVED. Inside it, tag the notable pieces: tier POIs, connections, sketch fog, the cut-off
     state, semantic zoom.
3. **Self-contained.**
   - One folder: `docs/10-design/mockups/world-map/rework/`, with `index.html` plus a `sprites/` subfolder of **copied**
     images.
   - Relative paths only. No `/assets/...`, no `fetch`, no build step.
   - It must work from `file://`. Canvas `drawImage` of local images is fine; never call `getImageData` on them.
   - Images under `mockups/` are git-ignored automatically. Don't worry about committing them.
4. **No emoji.** Use inline SVG icons copied from `assets/icons/svg/*.svg`.
5. **Readable map.** No marker or label overlaps another, at any step. Every march starts at a visible origin and follows
   a visible route.
6. **Desktop first at 1280×800.** Scale the frame to the window. Phone is a bonus step only.
7. **Verify before reporting** (§7): screenshot every step, look at them, fix, repeat. Zero page errors.

## 3. The current UI to match

- **Reference screenshots** are in `docs/10-design/mockups/ai-events/ui-reference/`, all git-ignored:
  - `03-world-default-zoom.jpg` and `04-world-zoomed-out-regions.jpg`: today's map, the "was";
  - `07-…`: the Marches panel and a march;
  - `01-city-base-view.jpg`: the **iso city art the new map must feel like the same game as**;
  - `08-more-grid-open.jpg`;
  - `20-phone-world.jpg`, `30-world-mid-zoom.jpg`, `31-world-lod-boundary.jpg`, `32-phone-world-zoomed-out.jpg`.
- **Theme tokens, fonts and chrome** are described in `docs/10-design/mockups/ai-events/BRIEF.md` §3. Reuse that
  description.
- **Look at the existing prototype** `docs/10-design/mockups/ai-events/factions/index.html`:
  - Its chrome (top bar, dock, More FAB, Marches panel, legend, caption card, NEW/IMPROVED tags, guided/explore toggle)
    is already built and approved by Steve.
  - **Reuse its chrome, styles and guided-mode scaffolding.** Copy what you need into your file.
  - Its anchored intel card is an accepted design. Reuse it for province and POI cards here.
- **Faction colours:** player `#3ad17a`, Scavengers `#b7d645`, Red Talon `#e05a3d`, Iron Covenant `#6f9fd8`, rebels
  `#b07ad8`, neutral `#8a93a0`.

## 4. The new map to draw

All of it is generated in the page's JS from a fixed seed, so it is deterministic.

- **View:** ¾ isometric, like the city.
  - City ground tiles are iso diamonds of **64×48** (`assets/tiles/ground/grit/*.png`).
  - See `js/ui/city/isoMath.js` for the projection (`TILE_W`, `TILE_H`, `tileToWorld`). You may draw the map at a smaller
    per-cell scale, or bake terrain into offscreen canvases. The world needs **zoom** (far / mid / near).
  - Home Refuge sits at the **bottom point** of the world diamond. Red Talon, the Scavengers and the Iron Covenant sit at
    the left, top and right points; assign them sensibly.
- **Provinces:**
  - About 25, as organic shapes (noisy Voronoi from authored seed points):
    - 4 corner seats;
    - per quarter: 2 Swap Markets, 1 Township, 1 Stockade Town;
    - 4 Ruin Cities on the lines between quarters;
    - 1 Metropolis at the centre.
  - Give each province a name, in the gritty post-apocalyptic tone of the existing names (Home Refuge, Red Lowlands,
    Ashwood, Vulture Ridge, Behemoth Spire, Frost Hold, Ember Reach, West Warrens).
  - Borders are drawn as an owner-coloured line plus a soft tint. Natural borders (a river band, a ridge line) run along
    some edges.
- **Biomes:**
  - Each province reads distinct: ash, cracked earth, dead grass, mud, frost, scorch.
  - You have `ash_*`, `cracked_*`, `earth_*`, `rubble_*` and `road_*` ground tiles. Create variety by **tinting or
    recolouring** them per biome, by blending, and by props.
  - Rivers and ridges can be drawn procedurally: a dark water band, a ridge with a shadow line.
- **Connections:**
  - Roads (drawn as road tiles or a worn path), passes (a road through a ridge gap with a small gate marker), and gates.
  - The connection graph decides what's attackable.
- **Main POIs, one per province, growing with tier.** Build each from copied building sprites in
  `assets/tiles/buildings/grit/`: house, house1, farm, storehouse, well, workshop, mine, quarry, rallypoint, barracks,
  townhall, and so on (about 129×132 each).
  - **Swap Market (T1):** 1–2 small buildings with a tarp/stall feel.
  - **Township (T2):** a cluster of 4–5 houses.
  - **Stockade Town (T3):** a cluster inside a drawn wall ring with corner towers.
  - **Ruin City (T4):** a larger cluster, partly greyed or ruined, with a tall silhouette.
  - **Metropolis (T5):** a big skyline cluster over about 6×6 cells, with walls.
  - Faction-held POIs get an owner-colour ring or banner.
  - Size, label weight and zoom visibility all scale by tier.
  - Note in a caption that the final art will be rendered per tier with the project's sprite rig. The prototype uses
    stand-ins.
- **Seats:**
  - Corner faction bases are a distinct look: a fortified compound plus a faction banner.
  - Home Refuge uses the townhall sprite.
- **Content inside provinces:**
  - Nodes, camps, a ruin or watchtower, and a mine, using small sprites or the props from
    `assets/tiles/props/grit/` (trees, dead trees, debris, wrecks, rocks).
  - Follow the spacing rules in the design: Poisson-disk; nodes never on roads; camps near roads; a guard camp at passes;
    a clear ring around the main POI.
  - Shown only at near zoom.
  - Small POIs need a small icon disc with a level number; they're no longer full-size emoji badges.
- **Props:** scatter trees, dead trees, wrecks and debris by biome. This is the main source of richness.
- **Fog:**
  - Unexplored land is a dark sketch (a desaturated, darkened, hatched or parchment-like treatment), with **no "?"
    markers**.
  - Always visible: seats, tier 4+ main POIs, the Metropolis skyline.
  - Discovered = held, plus provinces directly connected to held ones, plus scouted.
- **Semantic zoom:**
  - **Far:** province shapes, names, tier 3+ POIs, seats, threats.
  - **Mid:** all main POIs.
  - **Near:** everything.
  - Use screen-space collision for markers and labels, in priority order: threat > seat > main POI by tier > mid > small.

## 5. The story (guided steps)

Suggested order; adjust if a different order reads better.

1. **Was.** Today's map (the two screenshots). Caption names the problems: flat squares, identical regions, badge clutter,
   "?" fog, straight-line marches.
2. **The new map, far zoom.** The diamond, your corner at the bottom, three warlord corners, rings inward, the Metropolis
   skyline at the centre.
3. **The tier ladder.** Highlight one example of each tier in turn, or show a side legend of the 5 sprites: Swap Market →
   Township → Stockade Town → Ruin City → Metropolis. Bigger and harder toward the centre.
4. **Your corner.** Home Refuge, with your quarter neutral and garrisoned by monsters.
5. **Warlord seats.** The three corners, visible through fog. They are scoutable; sacking comes later with the AI.
6. **Fog.** Sketch land, landmarks always visible, and why the neighbouring provinces are visible (connected to yours).
7. **Zoom bands.** Far → mid → near. Labels never collide.
8. **Inside a province** (near zoom on a Swap Market):
   - the main POI, a mid POI, clustered nodes, a camp by the road, a guard at the pass;
   - each biome has its own resources (water near the river).
9. **Connections.** Roads, a pass and a gate. Provinces you may attack are highlighted (connected to yours).
10. **The intel card** on a target: tier, garrison, walls, a forecast band (amber or green), and "via Ashen Pass" (or
    similar). Reuse the factions prototype's anchored card.
11. **March along the road.** The route follows the connections, not a straight line, with an ETA pill. The Marches panel
    row matches the real one.
12. **Capture.** The province turns green, its buff is gained, and its neighbours come out of the fog.
13. **Pacing by strength.** Skip the second Swap Market and take the Township, because you're strong enough. There's no
    "clear every lower tier" rule.
14. **Cut off.** Lose a middle province. The province beyond it stays yours but shows **"cut off"** and loses its buff
    (the supply line), until you retake the middle one. Fog re-forms beyond, as the rules say.
15. **Warlord quarters.** Their provinces are in faction colour, with a war-camp slot on a pass (a hook for the AI, tagged
    "later: AI"). A Ruin City between two warlords is contested.
16. **Real levels and respawn.** A camp's level matches its monster. A beaten camp respawns at a *different* spot in the
    same province.
17. **The Metropolis.** The first capture is a milestone (title + map-wide buff); afterwards the warlords besiege it, one
    countdown at a time. Show the title banner as a NEW element.
18. **Phone** (bonus). The same map at 390×844, with panels collapsed.
19. **Summary.** What changed, in a list, with every IMPROVED item.

## 6. Scope limits

- Edit nothing outside `docs/10-design/mockups/world-map/rework/` (and its `_verify/` screenshots).
- Don't register the prototype in the gallery catalog. The orchestrator does that.
- Don't commit. Steve commits.
- Performance matters only enough to stay smooth. Pre-render terrain chunks once; don't redraw everything every frame
  when nothing moves.

## 7. How to verify (Playwright on this machine)

- Load Playwright from outside the repo:
  `const { createRequire } = await import('module'); const require = createRequire('C:/Users/Steve/AppData/Local/Temp/claude/basie-verify/noop.js'); const { chromium } = require('playwright');`
- Launch with `executablePath: 'C:/Users/Steve/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'`.
- Run with the Bash tool's sandbox disabled.
- Open `file:///D:/Projects/Basie/docs/10-design/mockups/world-map/rework/index.html` at a viewport of 1280×900 or
  larger.
- Collect `pageerror` and console errors.
- Step through every guided step and save `_verify/step-NN.png` for each. Also test Explore mode: pan, zoom, click a
  province, click a POI.
- **Look at every screenshot** with the Read tool. Fix clutter, overlaps, unreadable labels and anything that looks
  broken. Repeat until clean.
- Don't use the Playwright MCP browser tools.

## 8. Report back

- The path.
- The step list, one line per step.
- The `_verify/` folder.
- Every IMPROVED item.
- Every design decision you made that the design spec didn't settle: province names, biome assignment, tier visuals, zoom
  thresholds, the fog treatment. These feed the slicing.
