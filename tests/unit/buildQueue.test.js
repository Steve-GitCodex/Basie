import test from 'node:test';
import assert from 'node:assert/strict';

import { buildQueue } from '../../js/systems/building/buildQueue.js';

function item(instanceId, { buildTimeSec = 60, endsAt = null, startedAt = null } = {}) {
  return { buildingId: instanceId.split('_')[0], instanceId, buildTimeSec, startedAt, endsAt };
}

test('capacity is worker count plus the flat waiting buffer', () => {
  assert.equal(buildQueue.capacity(1), 3);
  assert.equal(buildQueue.capacity(4), 6);
});

test('fill starts up to maxWorkers items and stamps timers', () => {
  const q = [item('house_0'), item('bank_0'), item('mine_0')];
  const started = buildQueue.fill(q, 2, 1000);
  assert.equal(started.length, 2);
  assert.equal(q[0].endsAt, 1000 + 60 * 1000);
  assert.equal(q[1].endsAt, 1000 + 60 * 1000);
  assert.equal(q[2].endsAt, null);
});

test('fill skips a waiting item blocked by a same-instance active item', () => {
  const q = [
    item('house_0', { endsAt: 5000 }),
    item('house_0'),
    item('mine_0'),
  ];
  const started = buildQueue.fill(q, 2, 1000);
  assert.equal(started.length, 1);
  assert.equal(started[0].instanceId, 'mine_0');
  assert.equal(q[1].endsAt, null);
});

test('fill respects the same-instance rule even with spare workers', () => {
  const q = [item('house_0'), item('house_0'), item('house_0')];
  buildQueue.fill(q, 3, 1000);
  assert.equal(buildQueue.activeItems(q).length, 1);
});

test('nextStartable returns the earliest-queued startable item', () => {
  const q = [item('house_0', { endsAt: 5000 }), item('house_0'), item('mine_0')];
  assert.equal(buildQueue.nextStartable(q).instanceId, 'mine_0');
});

test('earliestDue returns the active item with the smallest past endsAt', () => {
  const q = [
    item('house_0', { endsAt: 3000 }),
    item('mine_0', { endsAt: 2000 }),
    item('bank_0', { endsAt: 9000 }),
  ];
  assert.equal(buildQueue.earliestDue(q, 5000).instanceId, 'mine_0');
  assert.equal(buildQueue.earliestDue(q, 1000), null);
});

test('earliestActive ignores waiting items', () => {
  const q = [item('house_0'), item('mine_0', { endsAt: 7000 })];
  assert.equal(buildQueue.earliestActive(q).instanceId, 'mine_0');
});
