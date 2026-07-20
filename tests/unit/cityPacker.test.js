import test from 'node:test';
import assert from 'node:assert/strict';

import { packAll, findPlacement, footprintOf, buildingIdOf, skeletonOffenderMoves } from '../../js/systems/building/cityPacker.js';
import { BUILDINGS_CONFIG, CATEGORY_ZONE } from '../../js/entities/GAME_DATA.js';
import { rectsOverlap, inBounds, BUILD_RECT, SKELETON, isSkeletonCell, rectHitsSkeleton } from '../../js/entities/data/cityGrid.js';

/** Every unlocked-at-max instance id of every building type. */
function allInstanceIds() {
  const ids = [];
  for (const cfg of Object.values(BUILDINGS_CONFIG)) {
    const n = cfg.instanceSlots?.length ?? 1;
    for (let i = 0; i < n; i++) ids.push(`${cfg.id}_${i}`);
  }
  return ids;
}

function rectsFrom(map) {
  return [...map].map(([id, p]) => {
    const [w, h] = footprintOf(buildingIdOf(id));
    return { id, cx: p.cx, cy: p.cy, w, h };
  });
}

test('packer is deterministic — same input, same layout', () => {
  const ids = allInstanceIds();
  const a = packAll(ids);
  const b = packAll(ids);
  assert.equal(a.size, b.size);
  for (const [id, p] of a) assert.deepEqual(b.get(id), p);
});

test('every instance is placed in bounds with no overlaps', () => {
  const ids = allInstanceIds();
  const rects = rectsFrom(packAll(ids));
  assert.equal(rects.length, ids.length);
  for (const r of rects) assert.ok(inBounds(r.cx, r.cy, r.w, r.h), `${r.id} out of bounds`);
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++)
      assert.ok(!rectsOverlap(rects[i], rects[j]), `${rects[i].id} overlaps ${rects[j].id}`);
});

test('HQ is pinned at the center of the buildable rect', () => {
  const p = packAll(allInstanceIds()).get('townhall_0');
  const [w, h] = footprintOf('townhall');
  assert.equal(p.cx, Math.round(BUILD_RECT.w / 2 - w / 2));
  assert.equal(p.cy, Math.round(BUILD_RECT.h / 2 - h / 2));
});

test('category bias clusters districts in their compass direction', () => {
  const rects = rectsFrom(packAll(allInstanceIds()));
  const byZone = {};
  for (const r of rects) {
    const zone = CATEGORY_ZONE[BUILDINGS_CONFIG[buildingIdOf(r.id)].category];
    (byZone[zone] ??= []).push(r);
  }
  const meanCx = z => byZone[z].reduce((s, r) => s + r.cx + r.w / 2, 0) / byZone[z].length;
  const meanCy = z => byZone[z].reduce((s, r) => s + r.cy + r.h / 2, 0) / byZone[z].length;
  // production east of military; residential south of civic
  assert.ok(meanCx('production') > meanCx('military'), 'production should sit east of military');
  assert.ok(meanCy('residential') > meanCy('civic'), 'residential should sit south of civic');
});

test('an isAllowed predicate confines placement to permitted cells', () => {
  const allowed = (cx, cy, w, h) => inBounds(cx, cy, w, h) && cx >= 20 && cy >= 12;
  const map = packAll(allInstanceIds(), allowed);
  for (const [, p] of map) {
    assert.ok(p.cx >= 20 && p.cy >= 12, `placed cell (${p.cx},${p.cy}) outside allowed region`);
  }
});

test('packer never seats a building on a skeleton cell', () => {
  const notSkeleton = (cx, cy, w, h) => inBounds(cx, cy, w, h) && !rectHitsSkeleton(cx, cy, w, h);
  const rects = rectsFrom(packAll(allInstanceIds(), notSkeleton));
  for (const r of rects)
    if (r.id !== 'townhall_0')
      assert.ok(!rectHitsSkeleton(r.cx, r.cy, r.w, r.h), `${r.id} sits on the skeleton`);
});

test('skeletonOffenderMoves relocates a legacy building off the skeleton (migration)', () => {
  // Drop a house right onto a skeleton cell (a legacy save placed before §4).
  const [cx, cy] = [...SKELETON][0].split(',').map(Number);
  const [w, h] = footprintOf('house');
  const rects = [
    { instanceId: 'townhall_0', cx: BUILD_RECT.w / 2 - 2 | 0, cy: BUILD_RECT.h / 2 - 2 | 0, w: 4, h: 4 },
    { instanceId: 'house_0', cx, cy, w, h },
  ];
  assert.ok(rectHitsSkeleton(cx, cy, w, h), 'test fixture actually sits on the skeleton');
  const moves = skeletonOffenderMoves(rects, (x, y, mw, mh) => inBounds(x, y, mw, mh) && !rectHitsSkeleton(x, y, mw, mh));
  assert.equal(moves.length, 1);
  assert.equal(moves[0].instanceId, 'house_0');
  assert.ok(!rectHitsSkeleton(moves[0].cx, moves[0].cy, w, h), 'relocated clear of the skeleton');
});

test('incremental placement seats a new instance without overlap', () => {
  const placed = rectsFrom(packAll(['townhall_0', 'farm_0']));
  const slot = findPlacement(placed, 'house_0');
  assert.ok(slot, 'found a slot');
  const [w, h] = footprintOf('house');
  assert.ok(inBounds(slot.cx, slot.cy, w, h));
  const cand = { cx: slot.cx, cy: slot.cy, w, h };
  for (const r of placed) assert.ok(!rectsOverlap(cand, r), 'no overlap with existing');
});
