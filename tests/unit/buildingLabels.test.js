import test from 'node:test';
import assert from 'node:assert/strict';

import { generatedEffectLabel } from '../../js/entities/data/buildingLabels.js';
import { BUILDINGS_CONFIG, TAB_UNLOCK_CONDITIONS } from '../../js/entities/GAME_DATA.js';
import { TRAINING_SLOTS, RALLY_STATS } from '../../js/entities/data/buildingTables.js';

test('barracks label names the HQ levels and squad-slot levels from data', () => {
  const label = BUILDINGS_CONFIG.barracks.effectLabel;
  const [, second, third, fourth] = BUILDINGS_CONFIG.barracks.squadSlots;
  assert.match(label, new RegExp(`Lv\.${second.condition.barracks} → 2nd`));
  assert.match(label, new RegExp(`Lv\.${third.condition.barracks} → 3rd`));
  assert.match(label, new RegExp(`Lv\.${fourth.condition.barracks} → 4th`));
  const hqLevels = BUILDINGS_CONFIG.barracks.instanceSlots.filter(s => s.condition).map(s => s.condition.townhall);
  assert.ok(label.includes(`Build more Barracks via HQ (Lv.${hqLevels.join(' / ')})`), label);
});

const breakpoints = (rows, pick) => rows
  .map((row, i) => ({ level: i + 1, value: pick(row) }))
  .filter((p, i, all) => i === 0 || p.value !== all[i - 1].value);

test('trainer hall labels list slot breakpoints from the training table', () => {
  for (const id of ['infantryhall', 'archeryrange', 'cavalrystable', 'siegeworkshop']) {
    const { effectLabel, maxLevel } = BUILDINGS_CONFIG[id];
    const steps = breakpoints(TRAINING_SLOTS(maxLevel, id), row => row.concurrentSlots).slice(1);
    assert.ok(steps.length > 0, id);
    assert.ok(effectLabel.includes(steps.map(p => `Lv.${p.level}: ${p.value} slots`).join(' · ')), id);
  }
});

test('rally point label lists march-slot steps from levelStats', () => {
  const { effectLabel } = BUILDINGS_CONFIG.rallypoint;
  const steps = breakpoints(RALLY_STATS, row => row.marchSlots).map(p => `Lv.${p.level}: ${p.value}`);
  assert.ok(effectLabel.includes(steps.join(' · ')), effectLabel);
  const stepPercent = Math.round((RALLY_STATS[1].speedBonus - RALLY_STATS[0].speedBonus) * 100);
  assert.ok(effectLabel.includes(`+${stepPercent}% march speed per level`), effectLabel);
});

test('hero quarters label derives total slots from effects.heroSlots and maxLevel', () => {
  const { effects, maxLevel, effectLabel } = BUILDINGS_CONFIG.heroquarters;
  assert.ok(effectLabel.includes(`${effects.heroSlots * maxLevel} at Lv.${maxLevel}`), effectLabel);
});

test('bank label states the resident range from its ladder', () => {
  const { levelRequirements, maxLevel, effectLabel } = BUILDINGS_CONFIG.bank;
  const first = Math.min(...Object.keys(levelRequirements).map(Number));
  const expected = `Residents needed: ${levelRequirements[first].population} at Lv.${first} up to ${levelRequirements[maxLevel].population} at Lv.${maxLevel}`;
  assert.ok(effectLabel.includes(expected), effectLabel);
});

test('generated label follows a changed table', () => {
  const cfg = { effectLabel: 'Head', trainingSlots: [
    { concurrentSlots: 1, trainTimeMultiplier: 1 },
    { concurrentSlots: 1, trainTimeMultiplier: 1 },
    { concurrentSlots: 2, trainTimeMultiplier: 0.5 },
  ] };
  assert.equal(generatedEffectLabel(cfg), 'Head · Lv.3: 2 slots · Train time down to 50%');
});

test('hq_level unlock labels are generated from the level', () => {
  const gates = Object.values(TAB_UNLOCK_CONDITIONS).filter(c => c.type === 'hq_level');
  assert.ok(gates.length >= 3);
  for (const gate of gates) assert.equal(gate.label, `Upgrade HQ to Level ${gate.level}`);
});
