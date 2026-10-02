import test from 'node:test';
import assert from 'node:assert/strict';

import { playbackSteps } from '../../js/ui/combat/playbackSteps.js';

const stack = (id, row, count, hp) => ({ id, row, count, startCount: count, hp });

function report(roundCount) {
  const rounds = Array.from({ length: roundCount }, (_, i) => {
    const left = Math.max(0, 10 - i);
    return {
      attacker: [{ id: 'a', count: 10, hpPool: 100 - i }, { id: 'b', count: 5, hpPool: 25 }],
      defender: [{ id: 'd', count: left, hpPool: left * 10 }],
      heroHits: i === 0 ? [{ heroId: 'h', targetId: 'd', damage: 5, kills: 1 }] : [],
    };
  });
  return {
    victory: true,
    roundsTotal: roundCount,
    waves: [{ name: 'W1', rounds }, { name: 'W2', rounds: [] }],
    initial: {
      attacker: [stack('a', 'front', 10, 10), stack('b', 'back', 5, 5)],
      defender: [[stack('d', 'front', 10, 10)], [stack('e', 'front', 3, 10)]],
    },
    dead: { t1: 2, t2: 1 },
    wounded: { t1: 3 },
  };
}

test('emits wave, rounds, then result in order', () => {
  const steps = playbackSteps(report(3));
  assert.deepEqual(steps.map((s) => s.kind), ['wave', 'round', 'round', 'round', 'wave', 'result']);
  assert.deepEqual(steps[0], { kind: 'wave', index: 0, total: 2, name: 'W1' });
  assert.deepEqual(steps.at(-1), { kind: 'result', victory: true, dead: 3, wounded: 3 });
});

test('percentages are of initial pools and within 0-100', () => {
  const [, first, second] = playbackSteps(report(3));
  assert.equal(first.defenderPct, 100);
  assert.equal(second.defenderPct, 90);
  assert.equal(first.attackerPct, 100);
  assert.equal(second.attackerPct, 99);
  assert.equal(first.rows.attacker.front, 100);
  assert.equal(first.rows.attacker.back, 100);
  assert.equal(first.rows.attacker.mid, null);
  assert.equal(first.rows.defender.back, null);
  assert.equal(second.rows.defender.front, 90);
  for (const s of [first, second]) {
    const all = [s.attackerPct, s.defenderPct, ...Object.values(s.rows.attacker), ...Object.values(s.rows.defender)];
    for (const p of all) assert.ok(p === null || (p >= 0 && p <= 100));
  }
});

test('kills are per-round count drops', () => {
  const [, first, second] = playbackSteps(report(3));
  assert.deepEqual(first.kills, { byAttacker: 0, byDefender: 0 });
  assert.deepEqual(second.kills, { byAttacker: 1, byDefender: 0 });
  assert.equal(first.heroHits.length, 1);
});

test('long waves sample at most 8 round steps and keep the last', () => {
  const steps = playbackSteps(report(30));
  const rounds = steps.filter((s) => s.kind === 'round');
  assert.equal(rounds.length, 8);
  assert.equal(rounds.at(-1).defenderPct, 0);
  assert.equal(rounds.reduce((a, s) => a + s.kills.byAttacker, 0), 10);
});

test('skipped waves emit only the wave marker', () => {
  const steps = playbackSteps(report(1));
  assert.equal(steps[steps.length - 2].kind, 'wave');
});

test('later waves count attacker losses only from the previous wave end', () => {
  const side = (aCount) => [{ id: 'a', count: aCount, hpPool: aCount * 10 }];
  const def = (id, n) => [{ id, count: n, hpPool: n * 10 }];
  const steps = playbackSteps({
    victory: true,
    roundsTotal: 3,
    waves: [
      { name: 'W1', rounds: [{ attacker: side(8), defender: def('d', 0), heroHits: [] }] },
      {
        name: 'W2',
        rounds: [
          { attacker: side(7), defender: def('e', 1), heroHits: [] },
          { attacker: side(7), defender: def('e', 0), heroHits: [] },
        ],
      },
    ],
    initial: { attacker: [stack('a', 'front', 10, 10)], defender: [[stack('d', 'front', 1, 10)], [stack('e', 'front', 2, 10)]] },
    dead: {},
    wounded: {},
  });
  const rounds = steps.filter((s) => s.kind === 'round');
  assert.equal(rounds[0].kills.byDefender, 2);
  assert.equal(rounds[1].kills.byDefender, 1);
  assert.equal(rounds[2].kills.byDefender, 0);
});
