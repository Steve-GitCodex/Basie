import test from 'node:test';
import assert from 'node:assert/strict';

import { stationRows } from '../../js/ui/heroes/stationBoard.js';

const built = (instanceId, level = 1) => ({ id: instanceId.replace(/_\d+$/, ''), instanceId, level });
const stationed = (heroId, buildingId) => ({
  id: heroId, name: heroId, isOwned: true,
  assignment: { type: 'building', buildingId },
  assignedBuilding: buildingId,
});

test('stationRows excludes barracks — squad assignment lives in the Barracks', () => {
  const rows = stationRows([built('barracks_0'), built('farm_0')], []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].instanceId, 'farm_0');
});

test('stationRows labels the effect from statEffectMap', () => {
  const [row] = stationRows([built('mine_0')], []);
  assert.equal(row.hasBonus, true);
  assert.match(row.effectLabel, /iron/i);
});

test('stationRows reports no bonus for a building type with no statEffectMap entry', () => {
  const [row] = stationRows([built('rallypoint_0')], []);
  assert.equal(row.hasBonus, false);
  assert.equal(row.effectLabel, 'No station bonus yet');
  assert.ok(!/%/.test(row.effectLabel), 'never fabricate a magnitude for an unmapped type');
});

test('stationRows attaches the stationed hero as the occupant', () => {
  const rows = stationRows([built('farm_0'), built('farm_1')], [stationed('kaelenthorne', 'farm_0')]);
  const byId = Object.fromEntries(rows.map(r => [r.instanceId, r]));
  assert.equal(byId.farm_0.occupant.id, 'kaelenthorne');
  assert.equal(byId.farm_1.occupant, null);
});

test('stationRows ignores squad-assigned heroes as occupants', () => {
  const [row] = stationRows([built('farm_0')], [stationed('warlord', 'barracks_0')]);
  assert.equal(row.occupant, null);
});

test('stationRows carries the building display name and level', () => {
  const [row] = stationRows([built('mine_0', 3)], []);
  assert.equal(row.level, 3);
  assert.ok(row.buildingName && row.buildingName !== 'mine_0');
});

test('stationRows sorts bonus-bearing rows first, then by instanceId', () => {
  const rows = stationRows([built('archeryrange_0'), built('mine_0'), built('farm_0')], []);
  assert.deepEqual(rows.map(r => r.instanceId), ['farm_0', 'mine_0', 'archeryrange_0']);
});

test('house and cafeteria never appear on the board', () => {
  const rows = stationRows([built('house_0'), built('cafeteria_0'), built('farm_0')], []);
  assert.deepEqual(rows.map(r => r.instanceId), ['farm_0']);
});

test('heroquarters shows +10% base defense', () => {
  const [row] = stationRows([built('heroquarters_0')], []);
  assert.equal(row.effectLabel, '+10% base defense');
  assert.equal(row.hasBonus, true);
});

test('an empty storehouse reads "Storage capacity from hero skills"', () => {
  const [row] = stationRows([built('storehouse_0')], []);
  assert.equal(row.effectLabel, 'Storage capacity from hero skills');
});

test('a skill-paid row never shows the resourceOutput percentage', () => {
  const [empty] = stationRows([built('construction_hall_0')], []);
  assert.ok(!/15%/.test(empty.effectLabel), empty.effectLabel);
  const occupant = { ...stationed('kaelenthorne', 'construction_hall_0'), level: 30, stars: 0, skillLevels: {} };
  const [filled] = stationRows([built('construction_hall_0')], [occupant]);
  assert.ok(!/15%/.test(filled.effectLabel), filled.effectLabel);
  assert.match(filled.effectLabel, /^\+\d+% build speed$/);
});
