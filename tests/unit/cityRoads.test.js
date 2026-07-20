import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveRoads, doorCell, roadGraph, key } from '../../js/ui/city/cityRoads.js';
import { packAll, footprintOf, buildingIdOf } from '../../js/systems/building/cityPacker.js';
import { BUILDINGS_CONFIG, SKELETON, isSkeletonCell, coreContains, sectorIdAt, inBounds, rectHitsSkeleton } from '../../js/entities/GAME_DATA.js';

const doorOf = (r) => doorCell(r, BUILDINGS_CONFIG[buildingIdOf(r.instanceId)]?.doorSide ?? 's');

const buildable = (cx, cy, w, h) => inBounds(cx, cy, w, h) && !rectHitsSkeleton(cx, cy, w, h);

/** A realistic base layout via the packer (skeleton cells excluded, like the game). */
function sampleRects() {
  const ids = [];
  for (const cfg of Object.values(BUILDINGS_CONFIG)) {
    const n = cfg.instanceSlots?.length ?? 1;
    for (let i = 0; i < n; i++) ids.push(`${cfg.id}_${i}`);
  }
  return [...packAll(ids, buildable)].map(([instanceId, p]) => {
    const [w, h] = footprintOf(buildingIdOf(instanceId));
    return { instanceId, cx: p.cx, cy: p.cy, w, h };
  });
}

/** A spaced layout (buildings never enclose each other) for connectivity checks. */
function sparseRects() {
  const rects = [{ instanceId: 'townhall_0', cx: 20, cy: 14, w: 4, h: 4 }];
  const spots = [[6, 6], [34, 6], [6, 24], [34, 24], [26, 12], [12, 20]];
  spots.forEach(([cx, cy], i) => rects.push({ instanceId: `house_${i}`, cx, cy, w: 3, h: 3 }));
  return rects;
}

/** Only the core is cleared (a fresh game). */
const coreOnly = (cx, cy) => coreContains(cx, cy);
/** Everything is cleared. */
const allClear = () => true;

test('doorCell is the south/front cell of a footprint', () => {
  assert.deepEqual(doorCell({ cx: 10, cy: 10, w: 4, h: 4 }), { cx: 13, cy: 13 });
});

test('the skeleton is a non-empty fixed set; every skeleton cell reports unbuildable', () => {
  assert.ok(SKELETON.size > 0);
  for (const k of SKELETON) {
    const [cx, cy] = k.split(',').map(Number);
    assert.ok(isSkeletonCell(cx, cy), `${k} should be unbuildable`);
  }
});

test('road derivation is deterministic', () => {
  const rects = sampleRects();
  const a = deriveRoads(rects, allClear);
  const b = deriveRoads(rects, allClear);
  assert.deepEqual([...a.skeleton].sort(), [...b.skeleton].sort());
  assert.deepEqual([...a.connectors].sort(), [...b.connectors].sort());
});

test('NO road cell (skeleton or connector) ever intersects a building footprint', () => {
  const rects = sampleRects();
  const { cells } = deriveRoads(rects, allClear);
  for (const r of rects) {
    for (let y = r.cy; y < r.cy + r.h; y++)
      for (let x = r.cx; x < r.cx + r.w; x++)
        assert.ok(!cells.has(key(x, y)), `road cell (${x},${y}) crosses ${r.instanceId}`);
  }
});

test('arterials render only through core + cleared sectors (extend as rubble clears)', () => {
  const rects = sampleRects();
  const bare = deriveRoads(rects, coreOnly).skeleton;
  const full = deriveRoads(rects, allClear).skeleton;
  assert.ok(bare.size < full.size, 'clearing rubble reveals more skeleton');
  for (const k of bare) {
    const [cx, cy] = k.split(',').map(Number);
    assert.ok(coreContains(cx, cy), `visible skeleton cell ${k} must be in the core`);
  }
  const buried = [...full].find(k => {
    const [cx, cy] = k.split(',').map(Number);
    return !coreContains(cx, cy) && sectorIdAt(cx, cy) !== null;
  });
  assert.ok(buried && !bare.has(buried), 'buried arterial is hidden until its sector clears');
});

test('every building door connects to the HQ skeleton over the road graph', () => {
  const rects = sparseRects();
  const { skeleton, cells } = deriveRoads(rects, allClear);
  const graph = roadGraph(cells);

  const seed = [...skeleton][0];
  const seen = new Set([seed]);
  const queue = [seed];
  while (queue.length) {
    const cur = queue.shift();
    for (const n of graph.get(cur) ?? []) {
      const k = key(n.cx, n.cy);
      if (!seen.has(k)) { seen.add(k); queue.push(k); }
    }
  }
  for (const r of rects) {
    const d = doorOf(r);
    const adj = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => key(d.cx + dx, d.cy + dy))
      .some(k => cells.has(k) && seen.has(k));
    const onWeb = cells.has(key(d.cx, d.cy)) && seen.has(key(d.cx, d.cy));
    assert.ok(adj || onWeb, `${r.instanceId} door has no path to the skeleton`);
  }
});

test('every building type has a valid doorSide whose door cell is on the rect perimeter', () => {
  const rect = { cx: 10, cy: 8, w: 3, h: 3 };
  const onPerimeter = (d) =>
    d.cx === rect.cx || d.cx === rect.cx + rect.w - 1 ||
    d.cy === rect.cy || d.cy === rect.cy + rect.h - 1;
  for (const cfg of Object.values(BUILDINGS_CONFIG)) {
    assert.ok(['sw', 'se', 's'].includes(cfg.doorSide), `${cfg.id} has an invalid doorSide: ${cfg.doorSide}`);
    const d = doorCell(rect, cfg.doorSide);
    assert.ok(d.cx >= rect.cx && d.cx < rect.cx + rect.w && d.cy >= rect.cy && d.cy < rect.cy + rect.h,
      `${cfg.id} door is off the footprint`);
    assert.ok(onPerimeter(d), `${cfg.id} door is not on the rect perimeter`);
  }
});

test('doorCell picks the middle cell of the named face', () => {
  const r = { cx: 20, cy: 14, w: 4, h: 4 };
  assert.deepEqual(doorCell(r, 's'),  { cx: 23, cy: 17 }); // front corner
  assert.deepEqual(doorCell(r, 'sw'), { cx: 21, cy: 17 }); // mid of bottom (max-row) face
  assert.deepEqual(doorCell(r, 'se'), { cx: 23, cy: 15 }); // mid of right (max-col) face
});

test('empty layout yields skeleton but no connectors', () => {
  const { connectors, skeleton } = deriveRoads([], allClear);
  assert.equal(connectors.size, 0);
  assert.ok(skeleton.size > 0);
});
