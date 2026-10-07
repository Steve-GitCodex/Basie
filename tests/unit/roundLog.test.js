import test from 'node:test';
import assert from 'node:assert/strict';

import { roundLog } from '../../js/systems/combat/report/roundLog.js';
import { battleTimeline } from '../../js/systems/combat/report/battleTimeline.js';

const unit = (over) => ({ tier: 1, type: 'infantry', row: 'front', hp: 100, ...over, startCount: over.count, hpPool: over.count * (over.hp ?? 100) });

const SOLDIERS = unit({ id: 'sol', label: 'Soldiers', count: 10 });
const SERGEANTS = unit({ id: 'ser', label: 'Sergeants', count: 4 });
const SHOOTERS = unit({ id: 'shoot', label: 'Sharpshooters', type: 'ranged', row: 'back', count: 5, hp: 50 });
const BRUTES = unit({ id: '0:0', name: 'Mutant Brutes', count: 6, hp: 200 });
const HOWLERS = unit({ id: '0:1', name: 'Mutant Howlers', count: 3, hp: 100, ability: { kind: 'heal', value: 0.2 } });

const snap = (id, count, hpPool) => ({ id, count, hpPool });
const hit = (targetId, damage, kills = 0) => ({ targetId, damage, kills });
const strike = (side, fromId, counterMult, hits, row = 'front') => ({ kind: 'strike', side, fromId, row, counterMult, hits });

const ATTACKER_SNAPS = [snap('sol', 4, 400), snap('ser', 2, 200), snap('shoot', 5, 250)];
const DEFENDER_SNAPS = [snap('0:0', 5, 1000), snap('0:1', 3, 300)];

const reportWith = (events, defender = [BRUTES, HOWLERS]) => ({
  rulesVersion: 1,
  seed: 1,
  victory: true,
  roundsTotal: 1,
  waves: [{ name: 'W1', rounds: [{ round: 1, attacker: ATTACKER_SNAPS, defender: DEFENDER_SNAPS, heroHits: [], events }] }],
  initial: { attacker: [SOLDIERS, SERGEANTS, SHOOTERS], defender: [defender] },
  dead: {},
  wounded: {},
  fallen: {},
});

const logFor = (events, moments = [], defender) => {
  const report = reportWith(events, defender);
  const { frames } = battleTimeline(report, { heroesBySlot: {} });
  return roundLog(frames[1], report, moments);
};

test('frame 0 has no log', () => {
  const report = reportWith([]);
  const { frames } = battleTimeline(report, { heroesBySlot: {} });
  assert.deepEqual(roundLog(frames[0], report), []);
});

test('names hero strikes with kills', () => {
  const [line] = logFor([{ kind: 'heroStrike', heroId: 'warlord', hits: [hit('0:0', 200, 1)] }]);
  assert.equal(line, 'Marcus Kestrel strikes the Mutant Brutes: 1 slain.');
});

test('groups your strikes by target with counter shown when > 1', () => {
  const [line] = logFor([
    strike('attacker', 'sol', 1.15, [hit('0:0', 200, 1)]),
    strike('attacker', 'shoot', 1, [hit('0:0', 100, 0)]),
    strike('attacker', 'ser', 1.5, [hit('0:1', 100, 0)]),
  ]);
  assert.equal(
    line,
    'Your Soldiers and Sharpshooters hit the Mutant Brutes (counter ×1.15): 1 slain. Your Sergeants hit the Mutant Howlers (counter ×1.5): no kills.',
  );
});

test('hero strike and your strikes share the first line', () => {
  const [line] = logFor([
    { kind: 'heroStrike', heroId: 'warlord', hits: [hit('0:0', 200, 1)] },
    strike('attacker', 'shoot', 1, [hit('0:0', 100, 1)]),
  ]);
  assert.equal(line, 'Marcus Kestrel strikes the Mutant Brutes: 1 slain. Your Sharpshooters hit the Mutant Brutes: 1 slain.');
});

test('lists enemy fallen by stack', () => {
  const [line] = logFor([
    strike('defender', '0:0', 1, [hit('sol', 400, 4), hit('ser', 200, 2)]),
    strike('defender', '0:1', 1, [hit('sol', 0, 0)]),
  ]);
  assert.equal(line, 'Mutant Brutes and Mutant Howlers hit your front row: 6 fallen (4 Soldiers, 2 Sergeants).');
});

test('mentions heals with the healer when identifiable', () => {
  const lines = logFor([
    strike('defender', '0:0', 1, [hit('sol', 100, 1)]),
    { kind: 'heal', stackId: '0:0', amount: 200 },
  ]);
  assert.equal(lines[0], 'Mutant Brutes hit your front row: 1 fallen (1 Soldiers). Mutant Howlers heal the Mutant Brutes.');
});

test('heal without an identifiable healer omits the healer', () => {
  const lines = logFor([{ kind: 'heal', stackId: '0:0', amount: 200 }], [], [BRUTES]);
  assert.deepEqual(lines, ['The Mutant Brutes heal.']);
});

test('moment line comes last', () => {
  const lines = logFor(
    [strike('attacker', 'shoot', 1, [hit('0:0', 100, 1)])],
    [{ frameIndex: 1, kind: 'rowBroken', text: 'Enemy front line broken', icon: '⚠' }, { frameIndex: 2, kind: 'skill', text: 'x', icon: '✦' }],
  );
  assert.deepEqual(lines, ['Your Sharpshooters hit the Mutant Brutes: 1 slain.', '⚠ Enemy front line broken.']);
});

test('returns at most 3 lines', () => {
  const lines = logFor(
    [
      { kind: 'heroStrike', heroId: 'warlord', hits: [hit('0:0', 200, 1)] },
      strike('defender', '0:0', 1, [hit('sol', 100, 1)]),
      { kind: 'heal', stackId: '0:0', amount: 200 },
      { kind: 'revive', stackId: 'sol', count: 1 },
    ],
    [{ frameIndex: 1, kind: 'revive', text: 'Soldiers rise again', icon: '↺' }, { frameIndex: 1, kind: 'skill', text: 'a: b', icon: '✦' }],
  );
  assert.equal(lines.length, 3);
});
