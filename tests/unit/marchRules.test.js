import test from 'node:test';
import assert from 'node:assert/strict';

import { marchTypeForPOI, canDispatch } from '../../js/systems/march/marchRules.js';

const squad = { units: [{ category: 'infantry', count: 5 }] };
const base = { squad, slotFree: true, squadBusy: false };

test('each POI type maps to the march it accepts', () => {
  assert.equal(marchTypeForPOI({ type: 'resource_node' }), 'gather');
  assert.equal(marchTypeForPOI({ type: 'camp' }), 'attack');
  assert.equal(marchTypeForPOI({ type: 'stronghold' }), 'attack');
  assert.equal(marchTypeForPOI({ type: 'world_boss' }), 'attack');
  assert.equal(marchTypeForPOI({ type: 'ruin' }), 'scout');
  assert.equal(marchTypeForPOI({ type: 'outpost' }), 'scout');
});

test('an unmarchable or missing POI has no march type', () => {
  assert.equal(marchTypeForPOI({ type: 'city' }), null);
  assert.equal(marchTypeForPOI(null), null);
});

test('a valid gather dispatch is accepted', () => {
  const out = canDispatch({ ...base, type: 'gather', poi: { type: 'resource_node' } });
  assert.deepEqual(out, { ok: true, reason: null });
});

test('dispatch without a target is rejected', () => {
  const out = canDispatch({ ...base, type: 'gather', poi: null });
  assert.equal(out.ok, false);
  assert.match(out.reason, /No target/);
});

test('a locked region is rejected before anything else', () => {
  const out = canDispatch({ ...base, type: 'gather', poi: { type: 'resource_node' }, regionLocked: true });
  assert.equal(out.ok, false);
  assert.match(out.reason, /Region locked/);
});

test('an empty or missing squad is rejected', () => {
  const poi = { type: 'resource_node' };
  assert.equal(canDispatch({ ...base, type: 'gather', poi, squad: null }).ok, false);
  const empty = canDispatch({ ...base, type: 'gather', poi, squad: { units: [] } });
  assert.equal(empty.ok, false);
  assert.match(empty.reason, /Squad is empty/);
});

test('a squad already marching is rejected', () => {
  const out = canDispatch({ ...base, type: 'gather', poi: { type: 'resource_node' }, squadBusy: true });
  assert.equal(out.ok, false);
  assert.match(out.reason, /already marching/);
});

test('no free march slot is rejected', () => {
  const out = canDispatch({ ...base, type: 'gather', poi: { type: 'resource_node' }, slotFree: false });
  assert.equal(out.ok, false);
  assert.match(out.reason, /No march slots/);
});

test('a POI with nothing to do is rejected', () => {
  const out = canDispatch({ ...base, type: 'gather', poi: { type: 'city' } });
  assert.equal(out.ok, false);
  assert.match(out.reason, /Nothing to do/);
});

test('the wrong march type for a target names the right one', () => {
  const out = canDispatch({ ...base, type: 'gather', poi: { type: 'camp' } });
  assert.equal(out.ok, false);
  assert.match(out.reason, /needs a attack march/);
});

test('attacking a cleared hostile awaiting respawn is rejected', () => {
  const out = canDispatch({ ...base, type: 'attack', poi: { type: 'camp' }, hostileAvailable: false });
  assert.equal(out.ok, false);
  assert.match(out.reason, /Already cleared/);
});

test('scouting an already-explored POI is rejected', () => {
  const out = canDispatch({ ...base, type: 'scout', poi: { type: 'ruin' }, scoutAvailable: false });
  assert.equal(out.ok, false);
  assert.match(out.reason, /Already explored/);
});

test('availability flags only gate their own march type', () => {
  assert.equal(canDispatch({ ...base, type: 'attack', poi: { type: 'camp' }, scoutAvailable: false }).ok, true);
  assert.equal(canDispatch({ ...base, type: 'scout', poi: { type: 'ruin' }, hostileAvailable: false }).ok, true);
});
