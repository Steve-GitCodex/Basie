import test from 'node:test';
import assert from 'node:assert/strict';

import { SectorState } from '../../js/systems/building/sectorState.js';
import { CORE_RECT, SECTOR_BY_ID } from '../../js/entities/data/citySectors.js';

const FREE_RM = { canAfford: () => true, spend() {} };

test('the core is always clear; rubble sectors start uncleared', () => {
  const s = new SectorState();
  assert.ok(s.isCellCleared(CORE_RECT.cx, CORE_RECT.cy));
  assert.ok(!s.isCellCleared(0, 0));
});

test('requestClear gates on HQ level, spends, and starts a timer', () => {
  const s = new SectorState();
  const sector = SECTOR_BY_ID.get('sector_2_0'); // higher HQ gate
  const locked = s.requestClear('sector_2_0', { hqLevel: 1, rm: FREE_RM, sandbox: false });
  assert.equal(locked.success, false);

  let spent = null;
  const rm = { canAfford: () => true, spend: (c) => { spent = c; } };
  const ok = s.requestClear('sector_2_0', { hqLevel: sector.hqLevel, rm, sandbox: false });
  assert.ok(ok.success);
  assert.deepEqual(spent, sector.cost);
  assert.ok(s.isClearing('sector_2_0'));
});

test('sandbox clears finish on the next update', () => {
  const s = new SectorState();
  s.requestClear('sector_1_0', { hqLevel: 9, rm: FREE_RM, sandbox: true });
  const done = s.update(Date.now());
  assert.deepEqual(done, ['sector_1_0']);
  assert.ok(s.isCleared('sector_1_0'));
  assert.ok(!s.isClearing('sector_1_0'));
});

test('two concurrent clears complete independently at their own times', () => {
  // Regression for the "second clear → all clear instantly / one never clears"
  // report: SectorState timers are per-id and must not interfere. (The visible
  // glitch was a render-cache bug — see cityGround.test.js — but the state layer
  // must be, and is, genuinely independent.)
  const s = new SectorState();
  const now = Date.now();
  s.startClear('sector_1_0', now + 2000);
  s.startClear('sector_1_1', now + 5000);

  assert.deepEqual(s.update(now + 1000), [], 'neither done before either endsAt');
  assert.ok(s.isClearing('sector_1_0') && s.isClearing('sector_1_1'));

  assert.deepEqual(s.update(now + 2000), ['sector_1_0'], 'first completes alone');
  assert.ok(s.isCleared('sector_1_0'));
  assert.ok(s.isClearing('sector_1_1'), 'second still running — not dragged along');

  assert.deepEqual(s.update(now + 5000), ['sector_1_1'], 'second completes at its own time');
  assert.ok(s.isCleared('sector_1_1'));
});

test('cleared rubble cells become placeable', () => {
  const s = new SectorState();
  const r = SECTOR_BY_ID.get('sector_1_0').rect;
  assert.ok(!s.isRectCleared(r.cx, r.cy, 2, 2));
  s.markCleared('sector_1_0');
  assert.ok(s.isRectCleared(r.cx, r.cy, 2, 2));
});

test('reconcile grandfathers any sector holding a placed building', () => {
  const s = new SectorState();
  const r = SECTOR_BY_ID.get('sector_2_1').rect;
  s.reconcile([{ cx: r.cx, cy: r.cy, w: 3, h: 3 }]);
  assert.ok(s.isCleared('sector_2_1'));
});

test('serialize → deserialize round-trips cleared + clearing state', () => {
  const s = new SectorState();
  s.markCleared('sector_1_0');
  s.startClear('sector_1_1', Date.now() + 60_000);
  const saved = s.serialize();
  assert.deepEqual(saved.cleared, ['sector_1_0']);

  const s2 = new SectorState();
  s2.deserialize(saved, []);
  assert.ok(s2.isCleared('sector_1_0'));
  assert.ok(s2.isClearing('sector_1_1'));
});

test('deserialize tolerates missing data and unknown ids', () => {
  const s = new SectorState();
  assert.doesNotThrow(() => s.deserialize(undefined, []));
  s.deserialize({ cleared: ['bogus_sector'], clearing: { also_bogus: 1 } }, []);
  assert.deepEqual(s.clearedIds(), []);
});
