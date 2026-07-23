# City Ambient Life (grit walkers + ship-drone & truck) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the base city's procedural pedestrian blobs and ellipse drone with rig-rendered grit sprites (Zombie-Kit survivors + an Ultimate-Spaceships craft), and make the drone follow roads out from a visible parked truck and back instead of flying over the HQ.

**Architecture:** One rig pass renders the ambient models to sprites + ground anchors (same pipeline as buildings, ADR 0021). A new `cityAmbientAssets.js` loads + grim-grades them. `cityAgents.js` gains pure path helpers (BFS over the existing road graph) and swaps its procedural draws for anchored sprite blits with procedural fallbacks. `CityRenderer` loads the assets and depth-interleaves the truck like the drone.

**Tech Stack:** Vanilla ES6 modules (no build step); Canvas 2D; three.js headless rig (Playwright); `node:test` unit tier; Playwright boot-smoke.

## Global Constraints

- Vanilla ES6 modules, no framework, no build step.
- Single named export per file; file order imports → constants → class → export; private methods `_`-prefixed.
- No god files — split before ~400 lines; new logic in a new sibling module.
- Near-zero comments at write time (only non-obvious invariants/units or `@see docs/...`). Enforced by `node scripts/check-comments.mjs`.
- Tests are additive: append to the matching file or add one test file per module; never rewrite.
- Browser-bound (canvas/Image/fetch) code is covered by boot-smoke + manual `?dev` screenshot, not unit tests.
- Grit grade filter (copy verbatim): `saturate(0.55) brightness(0.9) contrast(1.08) sepia(0.15) hue-rotate(-10deg)`.
- Rig env: run from the scratchpad rig dir with `BASIE_PW_ROOT=C:/Users/Steve/AppData/Local/Temp/claude/basie-verify`.
- Sprites ship in-repo under `assets/tiles/props/ambient/` (no runtime 404s).

---

### Task 1: Render the ambient sprites (rig pass)

**Files:**

- Create: `assets/_rig/jobs-ambient.json` (durable source of truth)
- Produce: `assets/tiles/props/ambient/survivor_lis.png`, `survivor_matt.png`, `survivor_sam.png`, `survivor_shaun.png`, `truck.png`, `drone.png`, `_anchors.json`

**Interfaces:**

- Produces: six trimmed PNGs + `_anchors.json` mapping `<file>.png → { ax, ay }` (ground-contact anchor in sprite px), consumed by Task 3.

Rig dir (already set up, holds `render-rig.mjs`, `render.html`, unpacked `packs/zombie/`):
`C:/Users/Steve/AppData/Local/Temp/claude/d--Projects-Basie/2f2c4c7d-8163-4deb-a170-5b84c70fcdbd/scratchpad/rig`

- [ ] **Step 1: Unpack the drone ship (Bob) into the rig packs**

```bash
RIG="C:/Users/Steve/AppData/Local/Temp/claude/d--Projects-Basie/2f2c4c7d-8163-4deb-a170-5b84c70fcdbd/scratchpad/rig"
cd /d/Projects/Basie
unzip -o "assets/_incoming/Ultimate Spaceships - May 2021-20260718T184924Z-1-001.zip" \
  "Ultimate Spaceships - May 2021/Bob/glTF/*" -d "$RIG/packs/spaceships-tmp"
mkdir -p "$RIG/packs/spaceships/Bob"
cp -r "$RIG/packs/spaceships-tmp/Ultimate Spaceships - May 2021/Bob/glTF" "$RIG/packs/spaceships/Bob/glTF"
ls "$RIG/packs/spaceships/Bob/glTF/"
```

Expected: lists `Bob.gltf` (+ its `.bin`/textures).

- [ ] **Step 2: Write the durable jobs file**

Create `assets/_rig/jobs-ambient.json`:

```json
{
  "outDir": "C:/Users/Steve/AppData/Local/Temp/claude/d--Projects-Basie/2f2c4c7d-8163-4deb-a170-5b84c70fcdbd/scratchpad/rig/out-ambient",
  "lights": { "hemi": 2.8, "sun": 1.7, "fill": 0.5, "sunPos": [-3, 5, 2] },
  "jobs": [
    {
      "model": "packs/zombie/Characters_Lis.gltf",
      "out": "survivor_lis.png",
      "opts": { "fit": 0.8 }
    },
    {
      "model": "packs/zombie/Characters_Matt.gltf",
      "out": "survivor_matt.png",
      "opts": { "fit": 0.8 }
    },
    {
      "model": "packs/zombie/Characters_Sam.gltf",
      "out": "survivor_sam.png",
      "opts": { "fit": 0.8 }
    },
    {
      "model": "packs/zombie/Characters_Shaun.gltf",
      "out": "survivor_shaun.png",
      "opts": { "fit": 0.8 }
    },
    {
      "model": "packs/zombie/Vehicle_Truck.gltf",
      "out": "truck.png",
      "opts": { "fit": 1.2 }
    },
    {
      "model": "packs/spaceships/Bob/glTF/Bob.gltf",
      "out": "drone.png",
      "opts": { "fit": 1.0 }
    }
  ]
}
```

- [ ] **Step 3: Copy the jobs file into the scratchpad rig and run**

```bash
RIG="C:/Users/Steve/AppData/Local/Temp/claude/d--Projects-Basie/2f2c4c7d-8163-4deb-a170-5b84c70fcdbd/scratchpad/rig"
cp /d/Projects/Basie/assets/_rig/jobs-ambient.json "$RIG/jobs-ambient.json"
cd "$RIG"
BASIE_PW_ROOT="C:/Users/Steve/AppData/Local/Temp/claude/basie-verify" node render-rig.mjs jobs-ambient.json
```

Expected: a `grid check` line, then one line per sprite `survivor_lis.png  WxH  anchor(ax,ay) ...` for all 6, then `_anchors.json  (6 sprites)`.

- [ ] **Step 4: Copy outputs into the repo**

```bash
RIG="C:/Users/Steve/AppData/Local/Temp/claude/d--Projects-Basie/2f2c4c7d-8163-4deb-a170-5b84c70fcdbd/scratchpad/rig"
cd /d/Projects/Basie
mkdir -p assets/tiles/props/ambient
cp "$RIG/out-ambient/"*.png "$RIG/out-ambient/_anchors.json" assets/tiles/props/ambient/
ls assets/tiles/props/ambient/
```

Expected: the 6 PNGs + `_anchors.json`.

- [ ] **Step 5: Verify anchors are finite**

```bash
cd /d/Projects/Basie
node -e 'const a=require("./assets/tiles/props/ambient/_anchors.json");for(const[k,v]of Object.entries(a))if(!Number.isFinite(v.ax)||!Number.isFinite(v.ay))throw new Error("bad anchor "+k);console.log("ok",Object.keys(a).length,"anchors")'
```

Expected: `ok 6 anchors`.

- [ ] **Step 6: Commit**

```bash
git add assets/_rig/jobs-ambient.json assets/tiles/props/ambient/
git commit -m "feat(city): rig-render ambient sprites (survivors, truck, ship-drone)"
```

---

### Task 2: Pure agent path/facing helpers + tests

**Files:**

- Modify: `js/ui/city/cityAgents.js` (add module-level exported helpers above the class)
- Create: `tests/unit/cityAgents.test.js`

**Interfaces:**

- Produces (all pure, no DOM):
  - `pickDockKey(keys: string[]) -> string|null` — road-cell key minimizing `cx+cy` (toward a corner), tie-broken by string order.
  - `bfsFarthest(graph: Map<string,{cx,cy}[]>, fromKey: string) -> string` — key of the hop-farthest reachable cell (tie-break: smaller key).
  - `bfsPath(graph, fromKey, toKey) -> string[]` — inclusive shortest-hop path of keys; `[fromKey]` if unreachable.
  - `faceLeft(from: {col,row}, to: {col,row}) -> boolean` — true when the iso screen-x decreases: `(to.col-from.col)-(to.row-from.row) < 0`.
  - `pingPong(t: number, span: number) -> number` — triangle wave in `[0, span]`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/cityAgents.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  pickDockKey,
  bfsFarthest,
  bfsPath,
  faceLeft,
  pingPong,
} from "../../js/ui/city/cityAgents.js";
import { roadGraph } from "../../js/ui/city/cityRoads.js";

// A straight 5-cell road row: (0,0)-(4,0)
const straight = roadGraph(new Set(["0,0", "1,0", "2,0", "3,0", "4,0"]));

test("pickDockKey returns the corner-most road cell deterministically", () => {
  assert.equal(pickDockKey(["4,0", "2,0", "0,0", "3,0"]), "0,0");
  assert.equal(pickDockKey([]), null);
});

test("bfsFarthest finds the hop-farthest reachable cell", () => {
  assert.equal(bfsFarthest(straight, "0,0"), "4,0");
});

test("bfsPath returns an inclusive contiguous shortest path", () => {
  assert.deepEqual(bfsPath(straight, "0,0", "4,0"), [
    "0,0",
    "1,0",
    "2,0",
    "3,0",
    "4,0",
  ]);
  assert.deepEqual(bfsPath(straight, "2,0", "2,0"), ["2,0"]);
  assert.deepEqual(
    bfsPath(straight, "0,0", "9,9"),
    ["0,0"],
    "unreachable target degrades to [from]",
  );
});

test("faceLeft is true when iso screen-x decreases", () => {
  assert.equal(faceLeft({ col: 1, row: 0 }, { col: 0, row: 0 }), true); // -x
  assert.equal(faceLeft({ col: 0, row: 0 }, { col: 1, row: 0 }), false); // +x
  assert.equal(faceLeft({ col: 0, row: 0 }, { col: 0, row: 1 }), true); // row+ moves screen-left
});

test("pingPong reflects within [0, span]", () => {
  assert.equal(pingPong(0, 4), 0);
  assert.equal(pingPong(4, 4), 4);
  assert.equal(pingPong(6, 4), 2, "past the far end it reflects back");
  assert.equal(pingPong(8, 4), 0, "a full there-and-back returns to start");
  assert.equal(pingPong(3, 0), 0, "zero span stays at 0");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `pickDockKey`/`bfsFarthest`/… are not exported.

- [ ] **Step 3: Add the helpers to `cityAgents.js`**

Insert above `export class CityAgents` (after the existing `toTile` helper):

```js
export function pickDockKey(keys) {
  if (!keys.length) return null;
  return keys.reduce((best, k) => {
    const [x, y] = k.split(",").map(Number);
    const [bx, by] = best.split(",").map(Number);
    const s = x + y,
      bs = bx + by;
    return s < bs || (s === bs && k < best) ? k : best;
  });
}

export function bfsFarthest(graph, fromKey) {
  const dist = new Map([[fromKey, 0]]);
  const q = [fromKey];
  let far = fromKey;
  for (let i = 0; i < q.length; i++) {
    const k = q[i];
    for (const { cx, cy } of graph.get(k) ?? []) {
      const nk = `${cx},${cy}`;
      if (dist.has(nk)) continue;
      dist.set(nk, dist.get(k) + 1);
      const d = dist.get(nk);
      if (d > dist.get(far) || (d === dist.get(far) && nk < far)) far = nk;
      q.push(nk);
    }
  }
  return far;
}

export function bfsPath(graph, fromKey, toKey) {
  if (fromKey === toKey) return [fromKey];
  const prev = new Map([[fromKey, null]]);
  const q = [fromKey];
  for (let i = 0; i < q.length; i++) {
    const k = q[i];
    if (k === toKey) break;
    for (const { cx, cy } of graph.get(k) ?? []) {
      const nk = `${cx},${cy}`;
      if (prev.has(nk)) continue;
      prev.set(nk, k);
      q.push(nk);
    }
  }
  if (!prev.has(toKey)) return [fromKey];
  const path = [];
  for (let k = toKey; k != null; k = prev.get(k)) path.push(k);
  return path.reverse();
}

export function faceLeft(from, to) {
  return to.col - from.col - (to.row - from.row) < 0;
}

export function pingPong(t, span) {
  if (span <= 0) return 0;
  const m = span * 2;
  const r = ((t % m) + m) % m;
  return r <= span ? r : m - r;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS (all 5 new tests green; existing count unchanged otherwise).

- [ ] **Step 5: Commit**

```bash
git add tests/unit/cityAgents.test.js js/ui/city/cityAgents.js
git commit -m "feat(city): pure road-path + facing helpers for ambient agents"
```

---

### Task 3: Ambient sprite loader (`cityAmbientAssets.js`)

**Files:**

- Create: `js/ui/city/cityAmbientAssets.js`
- Create: `tests/unit/cityAmbientAssets.test.js`

**Interfaces:**

- Produces:
  - `class CityAmbientAssets` with `async load()`, `walker(i) -> {img, anchor}|null` (i wraps the pool), `drone() -> {img, anchor}|null`, `truck() -> {img, anchor}|null`. `img` is a graded canvas; `anchor` is `{ax, ay}` in that canvas's px.
  - Consumed by Tasks 5 (draw) and 6 (wiring).
- Note: `load()`/grading are browser-only (Image/fetch/canvas) and are covered by boot-smoke, not unit tests. Only the manifest constants are unit-tested here.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/cityAmbientAssets.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  WALKER_SPRITES,
  DRONE_SPRITE,
  TRUCK_SPRITE,
} from "../../js/ui/city/cityAmbientAssets.js";

test("ambient manifest names a non-empty walker pool + a drone + a truck", () => {
  assert.ok(Array.isArray(WALKER_SPRITES) && WALKER_SPRITES.length >= 1);
  assert.ok(WALKER_SPRITES.every((n) => typeof n === "string" && n.length > 0));
  assert.equal(typeof DRONE_SPRITE, "string");
  assert.equal(typeof TRUCK_SPRITE, "string");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — module `cityAmbientAssets.js` does not exist.

- [ ] **Step 3: Create the module**

Create `js/ui/city/cityAmbientAssets.js`:

```js
/**
 * cityAmbientAssets.js
 * Loads + grim-grades the base-city ambient sprites (walkers, drone, truck),
 * rig-rendered to assets/tiles/props/ambient/ with per-sprite ground anchors.
 * Kept separate from CityAssets (buildings) — different lifetime + owner (CityAgents).
 */
const P = "assets/tiles/props/ambient";
const GRIM_FILTER =
  "saturate(0.55) brightness(0.9) contrast(1.08) sepia(0.15) hue-rotate(-10deg)";

export const WALKER_SPRITES = [
  "survivor_lis",
  "survivor_matt",
  "survivor_sam",
  "survivor_shaun",
];
export const DRONE_SPRITE = "drone";
export const TRUCK_SPRITE = "truck";

export class CityAmbientAssets {
  constructor() {
    this._walkers = [];
    this._drone = null;
    this._truck = null;
  }

  async load() {
    const anchors = await this._loadAnchors();
    const names = [...WALKER_SPRITES, DRONE_SPRITE, TRUCK_SPRITE];
    const graded = new Map();
    await Promise.all(
      names.map(async (n) => {
        const img = new Image();
        img.src = `${P}/${n}.png`;
        try {
          await img.decode();
          const a = anchors[`${n}.png`];
          graded.set(n, {
            img: this._grade(img),
            anchor:
              a && Number.isFinite(a.ax) && Number.isFinite(a.ay)
                ? a
                : { ax: img.width / 2, ay: img.height },
          });
        } catch {
          /* missing sprite → agent falls back to procedural draw */
        }
      }),
    );
    this._walkers = WALKER_SPRITES.map((n) => graded.get(n)).filter(Boolean);
    this._drone = graded.get(DRONE_SPRITE) ?? null;
    this._truck = graded.get(TRUCK_SPRITE) ?? null;
  }

  walker(i) {
    return this._walkers.length
      ? this._walkers[
          ((i % this._walkers.length) + this._walkers.length) %
            this._walkers.length
        ]
      : null;
  }

  drone() {
    return this._drone;
  }
  truck() {
    return this._truck;
  }

  async _loadAnchors() {
    try {
      const res = await fetch(`${P}/_anchors.json`, { cache: "no-store" });
      return res.ok ? await res.json() : {};
    } catch {
      return {};
    }
  }

  _grade(img) {
    const cv = document.createElement("canvas");
    cv.width = img.width;
    cv.height = img.height;
    const cx = cv.getContext("2d");
    cx.filter = GRIM_FILTER;
    cx.drawImage(img, 0, 0);
    return cv;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/ui/city/cityAmbientAssets.js tests/unit/cityAmbientAssets.test.js
git commit -m "feat(city): ambient sprite loader + grim grading"
```

---

### Task 4: Drone road-path + dock/truck state in `CityAgents`

**Files:**

- Modify: `js/ui/city/cityAgents.js` (`setRoads`, `update`, `dronePos`, `_spawnWalkers`, walker `update` segment, add dock/truck accessors + constants)
- Modify: `tests/unit/cityAgents.test.js` (append behavior tests)

**Interfaces:**

- Consumes: `pickDockKey`, `bfsFarthest`, `bfsPath`, `faceLeft`, `pingPong` (Task 2); `roadGraph`, `toTile`, `tileToWorld` (existing).
- Produces (on `CityAgents`, no DOM): `truckTile() -> {col,row}|null`, `get truckDepth`, `dronePosAt(t) -> {col,row}`, and `w.sprite`/`w.faceLeft` fields on each walker.

- [ ] **Step 1: Write the failing tests (append)**

Append to `tests/unit/cityAgents.test.js`:

```js
import { CityAgents } from "../../js/ui/city/cityAgents.js";

const roadRow = new Set(["0,0", "1,0", "2,0", "3,0", "4,0"]);

test("setRoads docks at the corner cell and builds a road-following drone path", () => {
  const a = new CityAgents(null);
  a.setRoads(roadRow);
  assert.deepEqual(a.truckTile(), { col: 0, row: 0 }); // dock = 0,0 → tile 0,0
  const path = a._dronePath.map((p) => `${p.col},${p.row}`);
  assert.deepEqual(
    path,
    ["0,0", "0.5,0", "1,0", "1.5,0", "2,0"],
    "dock→far via road cells (tile = cell/2)",
  );
});

test("drone ping-pongs along the path and stays within bounds", () => {
  const a = new CityAgents(null);
  a.setRoads(roadRow);
  const span = a._dronePath.length - 1;
  a._droneT = 0;
  assert.deepEqual(a.dronePos(), a._dronePath[0]);
  a._droneT = span;
  assert.deepEqual(a.dronePos(), a._dronePath[span]);
  a._droneT = span * 2;
  assert.deepEqual(
    a.dronePos(),
    a._dronePath[0],
    "there-and-back returns home",
  );
});

test("each walker gets a sprite-pool index", () => {
  const a = new CityAgents(null);
  a.setRoads(roadRow);
  assert.ok(a.walkers.every((w) => Number.isInteger(w.sprite)));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `truckTile`/`dronePosAt` undefined and `_dronePath` uses the old straight-row builder.

- [ ] **Step 3: Rewire `cityAgents.js`**

Add constants near the top (after `WALKER_COUNT`):

```js
const DRONE_LIFT = 34; // px the drone flies above the road
const WALKER_PX = 16; // on-screen sprite height
const DRONE_PX = 18;
const TRUCK_PX = 22;
```

Replace `setRoads` body:

```js
  setRoads(roadCells) {
    this._graph = roadGraph(roadCells);
    this._keys = [...this._graph.keys()];
    this._dockKey = pickDockKey(this._keys);
    const far = this._dockKey ? bfsFarthest(this._graph, this._dockKey) : null;
    this._dronePath = (this._dockKey && far)
      ? bfsPath(this._graph, this._dockKey, far).map(toTile)
      : [];
    this._droneT = 0;
    this._spawnWalkers();
  }
```

Delete `_buildDronePath` (no longer used).

Replace the drone advance in `update` — delete **both** existing drone lines:

```js
const droneLen = Math.max(1, this._dronePath.length - 1);
this._droneT =
  (((this._droneT + dt * DRONE_SPEED) % droneLen) + droneLen) % droneLen;
```

with a single unbounded accumulator (`pingPong` handles the reflect at draw time):

```js
this._droneT += dt * DRONE_SPEED;
```

In `update`, where the walker picks its next cell, set facing after `w.to` is assigned:

```js
w.to = toTile(next);
w.faceLeft = faceLeft(w.from, w.to);
```

Replace `dronePos` with an `at(t)` form + wrapper:

```js
  dronePos() { return this.dronePosAt(this._droneT); }

  dronePosAt(t) {
    if (!this._dronePath.length) return { col: 0, row: 0 };
    const span = this._dronePath.length - 1;
    const p = pingPong(t, span);
    const i = Math.floor(p);
    const f = p - i;
    const a = this._dronePath[i];
    const b = this._dronePath[Math.min(i + 1, span)];
    return { col: a.col + (b.col - a.col) * f, row: a.row + (b.row - a.row) * f };
  }
```

Add dock/truck accessors (near `droneDepth`):

```js
  truckTile() { return this._dockKey ? toTile(this._dockKey) : null; }

  get truckDepth() {
    const t = this.truckTile();
    return t ? t.col + t.row : -Infinity;
  }
```

In `_spawnWalkers`, give each walker a sprite index + facing, keep `hue` for the fallback:

```js
this._walkers.push({
  cell: k,
  prev: null,
  from,
  to: from,
  t: 1,
  x: from.col,
  y: from.row,
  hue: 180 + i * 60,
  sprite: i,
  faceLeft: false,
});
```

Add `_dockKey = null` init in the constructor (beside `this._walkers = []`):

```js
this._dockKey = null;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS (new behavior tests + all existing).

- [ ] **Step 5: Commit**

```bash
git add js/ui/city/cityAgents.js tests/unit/cityAgents.test.js
git commit -m "feat(city): drone follows roads out-and-back from a dock; walker sprite indices"
```

---

### Task 5: Sprite drawing (walker/drone/truck) with fallbacks

**Files:**

- Modify: `js/ui/city/cityAgents.js` (`setAssets`, `_blit`, `_droneFaceLeft`, `drawWalker`, `drawDrone`, `drawTruck`)

**Interfaces:**

- Consumes: `CityAmbientAssets` (Task 3) via `setAssets`; `WALKER_PX`/`DRONE_PX`/`TRUCK_PX`/`DRONE_LIFT` + `dronePosAt` (Task 4).
- Produces: `setAssets(assets)`, `drawTruck(now)` (Task 6 calls these); `drawWalker`/`drawDrone` now sprite-backed.
- Note: canvas rendering — verified by boot-smoke + `?dev` screenshot, no unit test.

- [ ] **Step 1: Add `setAssets`, `_blit`, `_droneFaceLeft`**

In the constructor add `this._assets = null;`. Then add:

```js
  setAssets(assets) { this._assets = assets; }

  _blit(ctx, spr, gx, gy, targetH, mirror) {
    const { img, anchor } = spr;
    const s = targetH / img.height;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.scale(mirror ? -1 : 1, 1);
    ctx.drawImage(img, -anchor.ax * s, -anchor.ay * s, img.width * s, img.height * s);
    ctx.restore();
  }

  _droneFaceLeft() {
    if (this._dronePath.length < 2) return false;
    return faceLeft(this.dronePosAt(this._droneT), this.dronePosAt(this._droneT + 0.05));
  }
```

- [ ] **Step 2: Sprite-back `drawWalker` (keep shadow + bob; procedural fallback)**

Replace `drawWalker`:

```js
  drawWalker(w, now) {
    const p = tileToWorld(w.x, w.y);
    const ctx = this._r._ctx;
    const bob = Math.abs(Math.sin(now / 180 + w.hue)) * 1.5;
    const spr = this._assets?.walker(w.sprite);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, 4, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (spr) {
      this._blit(ctx, spr, p.x, p.y - bob, WALKER_PX, w.faceLeft);
    } else {
      ctx.fillStyle = `hsla(${w.hue}, 70%, 70%, 0.95)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 5 - bob, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `hsla(${w.hue}, 50%, 45%, 0.95)`;
      ctx.fillRect(p.x - 2, p.y - 4 - bob, 4, 5);
    }
    ctx.restore();
  }
```

- [ ] **Step 3: Sprite-back `drawDrone` (ship + shadow + beam; procedural fallback)**

Replace `drawDrone`. Keep the existing procedural body as the `else` fallback:

```js
  drawDrone(now) {
    if (!this._dronePath.length) return;
    const p = this.dronePos();
    const w = tileToWorld(p.col, p.row);
    const bob = Math.sin(now / 400) * 3;
    const lift = DRONE_LIFT + bob;
    const ctx = this._r._ctx;
    const spr = this._assets?.drone();
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(w.x, w.y, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(w.x, w.y - lift, w.x, w.y);
    g.addColorStop(0, 'rgba(140,225,255,0.22)');
    g.addColorStop(1, 'rgba(140,225,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w.x - 4, w.y - lift);
    ctx.lineTo(w.x + 4, w.y - lift);
    ctx.lineTo(w.x + 12, w.y);
    ctx.lineTo(w.x - 12, w.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (spr) {
      this._blit(ctx, spr, w.x, w.y - lift, DRONE_PX, this._droneFaceLeft());
    } else {
      const y = w.y - lift;
      ctx.save();
      ctx.fillStyle = 'rgba(140, 225, 255, 0.95)';
      ctx.beginPath();
      ctx.ellipse(w.x, y, 8, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 90, 90, 0.9)';
      ctx.beginPath();
      ctx.arc(w.x + 6, y - 1, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
```

- [ ] **Step 4: Add `drawTruck`**

```js
  drawTruck(now) {
    const t = this.truckTile();
    const spr = this._assets?.truck();
    if (!t || !spr) return;
    const p = tileToWorld(t.col, t.row);
    const ctx = this._r._ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this._blit(ctx, spr, p.x, p.y, TRUCK_PX, false);
  }
```

- [ ] **Step 5: Comment lint + tests still green**

Run: `node scripts/check-comments.mjs 2>&1 | grep -iE "cityAgents|cityAmbient" || echo "clean"`
Expected: `clean`.
Run: `npm test`
Expected: PASS (unchanged — no new unit tests this task).

- [ ] **Step 6: Commit**

```bash
git add js/ui/city/cityAgents.js
git commit -m "feat(city): draw ambient agents from graded sprites with procedural fallbacks"
```

---

### Task 6: Wire the loader into `CityRenderer` + interleave the truck

**Files:**

- Modify: `js/ui/city/CityRenderer.js` (import + construct + load `CityAmbientAssets`; `setAssets` on agents; depth-interleave `drawTruck`)

**Interfaces:**

- Consumes: `CityAmbientAssets` (Task 3); `setAssets`, `drawTruck`, `truckDepth` (Tasks 4–5).

- [ ] **Step 1: Import + construct**

After `import { CityAgents } from "./cityAgents.js";` add:

```js
import { CityAmbientAssets } from "./cityAmbientAssets.js";
```

After `this._agents = new CityAgents(this);` add:

```js
this._ambientAssets = new CityAmbientAssets();
```

- [ ] **Step 2: Load the sprites + hand to the agents**

In `load()`, right after `await this._ground.load();` (line ~129) add:

```js
await this._ambientAssets.load();
this._agents.setAssets(this._ambientAssets);
```

- [ ] **Step 3: Interleave the truck like the drone**

In the object-draw loop (around lines 573–600), add truck depth tracking beside the drone. Change:

```js
const droneDepth = this._agents.droneDepth;
let droneDrawn = false;
```

to:

```js
const droneDepth = this._agents.droneDepth;
const truckDepth = this._agents.truckDepth;
let droneDrawn = false;
let truckDrawn = false;
```

Inside the `for (const item of this._drawList ?? [])` loop, after the walker `while` block and before the drone `if`, add:

```js
if (!truckDrawn && item.depth > truckDepth) {
  this._agents.drawTruck(now);
  truckDrawn = true;
}
```

After the loop, before `if (!droneDrawn) this._agents.drawDrone(now);` add:

```js
if (!truckDrawn) this._agents.drawTruck(now);
```

- [ ] **Step 4: Boot smoke (no 404s, city renders)**

Run: `node tests/browser/boot-smoke.mjs`
Expected: `boot-smoke: PASS` — all functional assertions green, no console 404s (sprites ship in-repo).

- [ ] **Step 5: Manual `?dev` screenshot verification**

Run (serve + screenshot the base view):

```bash
cd /d/Projects/Basie
npx -y http-server -p 8123 -s -c-1 . > /dev/null 2>&1 &
SRV=$!; sleep 2
OUT="C:/Users/Steve/AppData/Local/Temp/claude/d--Projects-Basie/79e8bc2f-8d7d-4bd1-ab8d-9d70be2b2229/scratchpad/ambient.png"
BASIE_PW_ROOT="C:/Users/Steve/AppData/Local/Temp/claude/basie-verify" node -e '
const { chromium } = require(process.env.BASIE_PW_ROOT + "/node_modules/playwright");
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:1280,height:800} });
  await p.goto("http://localhost:8123/?dev", { waitUntil:"networkidle" }); await p.waitForTimeout(1500);
  await p.evaluate(() => window.game?.eventBus?.emit?.("ui:navigateTo","base")); await p.waitForTimeout(2500);
  await p.screenshot({ path: process.argv[1] }); await b.close(); })();' "$OUT"
kill $SRV 2>/dev/null
```

Expected: walkers render as small graded survivors (not colored blobs); a parked truck sits at a corner road cell; the drone is a small ship over the roads. (Watch the drone briefly to confirm it tracks roads around the HQ rather than crossing over it.)

- [ ] **Step 6: Commit**

```bash
git add js/ui/city/CityRenderer.js
git commit -m "feat(city): load ambient sprites + depth-interleave the drone truck"
```

---

### Task 7: Docs (session protocol)

**Files:**

- Modify: `docs/40-active.md` (new handoff section), `docs/30-roadmap.md` (tick if a matching line exists), `docs/10-design/assets.md` (mark Zombie characters + Spaceships-drone as wired)

- [ ] **Step 1: Update the handoff + design docs**

Add a `40-active.md` section (what landed: ambient sprites, drone road-path + truck, new module, tests) and note the ambient sprites are regenerable via `assets/_rig/jobs-ambient.json`. In `assets.md`, update the Kenney-Mini-Characters and Ultimate-Spaceships rows to record that walkers now use Zombie-Kit survivors and the drone uses a Spaceships craft (both wired, city ambient).

- [ ] **Step 2: Verify the full suite once more**

Run: `npm test && node tests/browser/boot-smoke.mjs && node scripts/check-comments.mjs 2>&1 | grep -iE "cityAgents|cityAmbient|CityRenderer" || echo "touched files clean"`
Expected: unit PASS, `boot-smoke: PASS`, `touched files clean`.

- [x] **Step 3: Commit**

```bash
git add docs/40-active.md docs/30-roadmap.md docs/10-design/assets.md
git commit -m "docs: record city ambient-life pass (walkers, drone, truck)"
```
