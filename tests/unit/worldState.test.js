import test from 'node:test';
import assert from 'node:assert/strict';

import { seedState, reconcileState } from '../../js/systems/world/worldState.js';
import { WORLD_MAP } from '../../js/entities/GAME_DATA.js';

function fakeMap(pois, regions = [{ id: 'home_vale', factionId: 'neutral', startOwner: 'player' }]) {
  return { pois, regions };
}

test('resource nodes seed with full capacity', () => {
  const { poiState } = seedState(fakeMap([
    { id: 'rn_a', type: 'resource_node', capacity: 600 },
  ]));
  assert.equal(poiState.rn_a.remaining, 600);
  assert.equal(poiState.rn_a.respawnAt, 0);
});

test('each POI type seeds its own state shape', () => {
  const { poiState, outpostOwner } = seedState(fakeMap([
    { id: 'camp_a', type: 'camp' },
    { id: 'ruin_a', type: 'ruin' },
    { id: 'boss_a', type: 'world_boss' },
    { id: 'op_a', type: 'outpost' },
  ]));
  assert.equal(poiState.ruin_a.looted, false);
  assert.equal(poiState.boss_a.defeatedWindowStart, -1);
  assert.equal(poiState.camp_a.clearedAt, 0);
  assert.equal(outpostOwner.op_a, 'neutral');
  assert.ok(!poiState.op_a, 'outposts live in outpostOwner, not poiState');
});

test('outpost startOwner overrides the neutral default', () => {
  const { outpostOwner } = seedState(fakeMap([
    { id: 'op_a', type: 'outpost', startOwner: 'player' },
  ]));
  assert.equal(outpostOwner.op_a, 'player');
});

test('region startOwner wins over the faction fallback', () => {
  const { regionOwner } = seedState(fakeMap([], [
    { id: 'home_vale', factionId: 'neutral', startOwner: 'player' },
    { id: 'command_ruin', factionId: 'neutral', startOwner: 'neutral' },
    { id: 'red_lowlands', factionId: 'bandits' },
  ]));
  assert.equal(regionOwner.home_vale, 'player');
  assert.equal(regionOwner.command_ruin, 'neutral');
  assert.equal(regionOwner.red_lowlands, 'bandits');
});

test('reconcile keeps saved progress for POIs that still exist', () => {
  const map = fakeMap([{ id: 'rn_a', type: 'resource_node', capacity: 600 }]);
  const loaded = { poiState: { rn_a: { remaining: 120, respawnAt: 999 } }, regionOwner: {}, outpostOwner: {} };
  const { poiState } = reconcileState(loaded, map);
  assert.equal(poiState.rn_a.remaining, 120);
  assert.equal(poiState.rn_a.respawnAt, 999);
});

test('reconcile adds a default entry for a newly added POI id', () => {
  const loaded = reconcileState(
    { poiState: {}, regionOwner: {}, outpostOwner: {} },
    fakeMap([{ id: 'rn_new', type: 'resource_node', capacity: 750 }]),
  );
  assert.equal(loaded.poiState.rn_new.remaining, 750);
});

test('reconcile drops saved state for removed ids without crashing', () => {
  const loaded = {
    poiState: { rn_gone: { remaining: 5 } },
    regionOwner: { region_gone: 'player' },
    outpostOwner: { op_gone: 'player' },
  };
  const out = reconcileState(loaded, fakeMap([{ id: 'rn_a', type: 'resource_node', capacity: 600 }]));
  assert.ok(!('rn_gone' in out.poiState));
  assert.ok(!('region_gone' in out.regionOwner));
  assert.ok(!('op_gone' in out.outpostOwner));
  assert.equal(out.poiState.rn_a.remaining, 600);
});

test('reconcile tolerates a null or empty save', () => {
  const map = fakeMap([{ id: 'rn_a', type: 'resource_node', capacity: 600 }]);
  assert.equal(reconcileState(null, map).poiState.rn_a.remaining, 600);
  assert.equal(reconcileState({}, map).poiState.rn_a.remaining, 600);
});

test('reconcile keeps captured ownership across a map edit', () => {
  const map = fakeMap([], [
    { id: 'home_vale', factionId: 'neutral', startOwner: 'player' },
    { id: 'red_lowlands', factionId: 'bandits' },
  ]);
  const { regionOwner } = reconcileState({ regionOwner: { red_lowlands: 'player' } }, map);
  assert.equal(regionOwner.red_lowlands, 'player');
  assert.equal(regionOwner.home_vale, 'player');
});

test('seed then reconcile round-trips the real world map unchanged', () => {
  const seeded = seedState(WORLD_MAP);
  const round = reconcileState(seeded, WORLD_MAP);
  assert.deepEqual(round, seeded);
});

test('the real world map seeds state for every non-outpost POI', () => {
  const { poiState, outpostOwner, regionOwner } = seedState(WORLD_MAP);
  for (const poi of WORLD_MAP.pois) {
    if (poi.type === 'outpost') assert.ok(poi.id in outpostOwner, `${poi.id} missing owner`);
    else if (poi.type !== 'city') assert.ok(poi.id in poiState, `${poi.id} missing state`);
  }
  assert.equal(Object.keys(regionOwner).length, WORLD_MAP.regions.length);
  assert.equal(regionOwner.home_vale, 'player');
});

test('generated filler POIs survive reconcile against a pre-filler save', () => {
  const preFiller = seedState({
    pois: WORLD_MAP.pois.filter(p => !p.id.startsWith('gen_')),
    regions: WORLD_MAP.regions,
  });
  const { poiState } = reconcileState(preFiller, WORLD_MAP);
  const filler = WORLD_MAP.pois.filter(p => p.id.startsWith('gen_'));
  assert.ok(filler.length > 0);
  for (const poi of filler) assert.ok(poi.id in poiState, `${poi.id} not seeded on load`);
});
