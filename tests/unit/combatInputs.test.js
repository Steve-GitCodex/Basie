import test from 'node:test';
import assert from 'node:assert/strict';

import {
  survivalMonster, squadLosses, wavesCleared, summarizeEstimate,
} from '../../js/systems/combat/combatInputs.js';
import { SURVIVAL_MONSTER } from '../../js/entities/GAME_DATA.js';

test('survival monster scales stack hp/attack by mult and count by wave', () => {
  const base = SURVIVAL_MONSTER.baseWave.stacks[0];
  const monster = survivalMonster(SURVIVAL_MONSTER, 10, 1.5);
  const stack = monster.waves[0].stacks[0];
  assert.equal(monster.waves.length, 1);
  assert.equal(monster.waves[0].name, `${SURVIVAL_MONSTER.baseWave.name} (Wave 11)`);
  assert.equal(stack.hp, Math.round(base.hp * 1.5));
  assert.equal(stack.attack, Math.round(base.attack * 1.5));
  assert.equal(stack.count, Math.round(base.count * 1.2));
  assert.equal(stack.row, base.row);
});

test('squad losses sum dead and wounded per tierKey', () => {
  assert.deepEqual(
    squadLosses({ dead: { a: 2, b: 1 }, wounded: { a: 3, c: 4 } }),
    { a: 5, b: 1, c: 4 },
  );
});

test('waves cleared counts only waves whose defenders all fell', () => {
  const round = (counts) => ({ defender: counts.map((count) => ({ count })) });
  const report = { waves: [
    { rounds: [round([2]), round([0, 0])] },
    { rounds: [round([1])] },
    { rounds: [] },
  ] };
  assert.equal(wavesCleared(report), 1);
});

test('estimate summary averages wins, dead and wounded', () => {
  const summary = summarizeEstimate([
    { victory: true, dead: { a: 2 }, wounded: { a: 1 } },
    { victory: false, dead: { a: 4, b: 2 }, wounded: {} },
  ]);
  assert.deepEqual(summary, { winChance: 0.5, avgDead: 4, avgWounded: 0.5 });
});

test('enemyLeftPct is 0 on a cleared fight and 100 when no damage was dealt', async () => {
  const { enemyLeftPct } = await import('../../js/systems/combat/combatInputs.js');
  const initial = { defender: [[{ hpPool: 100 }], [{ hpPool: 100 }]] };
  const cleared = { initial, waves: [{ rounds: [{ defender: [{ hpPool: 0 }] }] }, { rounds: [{ defender: [{ hpPool: 0 }] }] }] };
  const untouched = { initial, waves: [{ rounds: [{ defender: [{ hpPool: 100 }] }] }, { rounds: [] }] };
  assert.equal(enemyLeftPct(cleared), 0);
  assert.equal(enemyLeftPct(untouched), 100);
});

test('enemyLeftPct counts unfought waves at full hp and rounds to an integer', async () => {
  const { enemyLeftPct } = await import('../../js/systems/combat/combatInputs.js');
  const report = {
    initial: { defender: [[{ hpPool: 100 }], [{ hpPool: 200 }]] },
    waves: [{ rounds: [{ defender: [{ hpPool: 50 }] }, { defender: [{ hpPool: 0 }] }] }, { rounds: [] }],
  };
  assert.equal(enemyLeftPct(report), 67);
});

test('troopsSent totals unit counts', async () => {
  const { troopsSent } = await import('../../js/systems/combat/combatInputs.js');
  assert.equal(troopsSent([{ count: 5 }, { count: 7 }, { count: 0 }]), 12);
  assert.equal(troopsSent([]), 0);
});
