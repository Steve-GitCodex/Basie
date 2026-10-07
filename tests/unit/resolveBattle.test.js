import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveBattle } from '../../js/systems/combat/resolveBattle.js';
import { COMBAT_RULES } from '../../js/entities/data/combatRules.js';

const FOOTMAN = { type: 'infantry', tier: 1, hp: 120, attack: 14, defense: 10, tierKey: 'infantry_t1' };
const PALADIN = { type: 'infantry', tier: 5, hp: 540, attack: 56, defense: 38, tierKey: 'infantry_t5' };
const DEF_100 = { type: 'infantry', tier: 6, hp: 750, attack: 76, defense: 100 };
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const stack = (over) => {
  const base = { id: 's', label: 's', type: 'infantry', tier: 1, row: 'front', count: 1, hp: 100, attack: 10, defense: 10, ...over };
  return { startCount: base.count, hpPool: base.count * base.hp, ...base };
};

const attackerSide = (stacks, extra = {}) => ({
  stacks,
  strikers: [],
  triggers: { battle_start: [], wave_start: [], final_wave: [], losing: [] },
  lossEntries: [],
  healEntries: [],
  firstWaveBonus: 0,
  ...extra,
});

const defenderSide = (...waves) => ({ waves: waves.map((stacks, i) => ({ name: `W${i + 1}`, stacks })) });

const trigger = (event, effect) => ({ heroId: 'h1', skill: { id: `sk_${event}`, type: 'major', effect: { trigger: event, ...effect } }, level: 1 });

const withTriggers = (buckets) => ({ battle_start: [], wave_start: [], final_wave: [], losing: [], ...buckets });

const winsOver = (build) => SEEDS.filter((seed) => {
  const { attacker, defender } = build();
  return resolveBattle(attacker, defender, { seed }).victory;
}).length;

const footmen = (count, over = {}) => stack({ ...FOOTMAN, id: 'foot', count, ...over });

test('same inputs and seed give an identical report', () => {
  const build = () => [attackerSide([footmen(30)]), defenderSide([stack({ ...DEF_100, id: 'm' })])];
  assert.deepEqual(resolveBattle(...build(), { seed: 7 }), resolveBattle(...build(), { seed: 7 }));
});

test('inputs are not mutated', () => {
  const attacker = attackerSide([footmen(30)], { strikers: [{ heroId: 'h1', slotIndex: 0, attack: 50, level: 3 }] });
  const defender = defenderSide([stack({ ...DEF_100, id: 'm' })], [footmen(5, { id: 'f2' })]);
  const before = structuredClone({ attacker, defender });
  resolveBattle(attacker, defender, { seed: 3 });
  assert.deepEqual({ attacker, defender }, before);
});

test('report carries the spec shape', () => {
  const report = resolveBattle(attackerSide([footmen(30)]), defenderSide([footmen(2, { id: 'd' })]), { seed: 1 });
  assert.equal(report.rulesVersion, COMBAT_RULES.RULES_VERSION);
  assert.equal(report.seed, 1);
  assert.equal(report.roundsTotal, report.waves[0].rounds.length);
  assert.deepEqual(Object.keys(report.waves[0].rounds[0]).sort(), ['attacker', 'defender', 'events', 'heroHits', 'round']);
  assert.deepEqual(Object.keys(report.waves[0].rounds[0].attacker[0]).sort(), ['count', 'hpPool', 'id']);
  assert.equal(report.initial.attacker[0].count, 30);
  assert.equal(report.initial.defender[0][0].count, 2);
  for (const key of ['fallen', 'healed', 'wounded', 'dead']) assert.equal(typeof report[key], 'object');
});

test('10 Footmen lose to a defense-100 tier-6 stack', () => {
  const wins = winsOver(() => ({ attacker: attackerSide([footmen(10)]), defender: defenderSide([stack({ ...DEF_100, id: 'm' })]) }));
  assert.ok(wins < 5, `won ${wins}/10`);
});

test('50 Footmen beat the same defense-100 stack', () => {
  const wins = winsOver(() => ({ attacker: attackerSide([footmen(50)]), defender: defenderSide([stack({ ...DEF_100, id: 'm' })]) }));
  assert.ok(wins > 5, `won ${wins}/10`);
});

test('1 Paladin beats 8 Footmen', () => {
  const wins = winsOver(() => ({
    attacker: attackerSide([stack({ ...PALADIN, id: 'pal', count: 1 })]),
    defender: defenderSide([footmen(8, { id: 'd' })]),
  }));
  assert.ok(wins > 5, `won ${wins}/10`);
});

test('20 Footmen beat 1 Paladin', () => {
  const wins = winsOver(() => ({
    attacker: attackerSide([footmen(20)]),
    defender: defenderSide([stack({ ...PALADIN, id: 'pal', count: 1 })]),
  }));
  assert.ok(wins > 5, `won ${wins}/10`);
});

test('front row absorbs hits before the back row', () => {
  const front = footmen(10, { id: 'front', tierKey: 'infantry_t1' });
  const back = stack({ ...FOOTMAN, id: 'back', type: 'ranged', row: 'back', count: 10, tierKey: 'ranged_t1' });
  const monster = stack({ id: 'm', tier: 6, hp: 1e6, attack: 66, defense: 0 });
  const report = resolveBattle(attackerSide([front, back]), defenderSide([monster]), { seed: 1 });
  assert.ok((report.fallen.ranged_t1 ?? 0) < report.fallen.infantry_t1);
});

test('reaching the round cap is a defeat', () => {
  const report = resolveBattle(
    attackerSide([footmen(1)]),
    defenderSide([stack({ id: 'wall', hp: 1e6, attack: 0, defense: 0 })]),
    { seed: 1 },
  );
  assert.equal(report.victory, false);
  assert.equal(report.roundsTotal, COMBAT_RULES.ROUND_CAP);
});

test('survivors carry into the next wave', () => {
  const report = resolveBattle(
    attackerSide([footmen(30)]),
    defenderSide([stack({ id: 'brute', hp: 300, attack: 120, defense: 0, count: 2 })], [stack({ id: 'dummy', hp: 100, attack: 0, defense: 0, count: 1 })]),
    { seed: 1 },
  );
  const wave1End = report.waves[0].rounds.at(-1).attacker[0];
  const wave2Start = report.waves[1].rounds[0].attacker[0];
  assert.ok(wave1End.count < 30);
  assert.equal(wave2Start.count, wave1End.count);
  assert.equal(wave2Start.hpPool, wave1End.hpPool);
});

test('heal regains lost HP each round', () => {
  const run = (ability) => resolveBattle(
    attackerSide([footmen(5)]),
    defenderSide([stack({ id: 'h', hp: 100, attack: 0, defense: 0, count: 10, ability })]),
    { seed: 1 },
  );
  const healed = run({ kind: 'heal', value: 0.5 }).waves[0].rounds[1].defender[0];
  const plain = run(undefined).waves[0].rounds[1].defender[0];
  assert.ok(healed.hpPool > plain.hpPool);
  assert.ok(healed.hpPool <= 1000);
});

test('revive returns the stack once', () => {
  const report = resolveBattle(
    attackerSide([footmen(100)]),
    defenderSide([stack({ id: 'r', hp: 10, attack: 0, defense: 0, count: 4, ability: { kind: 'revive', value: 0.5 } })]),
    { seed: 1 },
  );
  const rounds = report.waves[0].rounds;
  assert.deepEqual(rounds[0].defender[0], { id: 'r', count: 2, hpPool: 20 });
  assert.equal(rounds[1].defender[0].count, 0);
  assert.equal(rounds.length, 2);
  assert.equal(report.victory, true);
});

test('aoe_blast hits every row', () => {
  const run = (ability) => resolveBattle(
    attackerSide([footmen(10, { id: 'front' }), stack({ ...FOOTMAN, id: 'back', type: 'ranged', row: 'back', count: 10, tierKey: 'ranged_t1' })]),
    defenderSide([stack({ id: 'b', hp: 1e6, attack: 50, defense: 0, ability })]),
    { seed: 1 },
  );
  const backAfter = (report) => report.waves[0].rounds[0].attacker.find((s) => s.id === 'back').hpPool;
  assert.ok(backAfter(run({ kind: 'aoe_blast', value: 1 })) < 1200);
  assert.equal(backAfter(run(undefined)), 1200);
});

test('hero strikes land kills', () => {
  const report = resolveBattle(
    attackerSide([stack({ id: 'shield', hp: 1e6, attack: 0, defense: 0, tierKey: 'x' })], { strikers: [{ heroId: 'h1', slotIndex: 0, attack: 160, level: 1 }] }),
    defenderSide([footmen(20, { id: 'd' })]),
    { seed: 1 },
  );
  const hits = report.waves[0].rounds.flatMap((r) => r.heroHits);
  assert.ok(hits.length > 0);
  assert.ok(hits.some((h) => h.heroId === 'h1' && h.targetId === 'd' && h.kills > 0 && h.damage > 0));
  assert.equal(report.victory, true);
});

test('evasion zeroes incoming damage while active', () => {
  const report = resolveBattle(
    attackerSide([footmen(20)], { triggers: withTriggers({ battle_start: [trigger('battle_start', { evasion: true, duration: 2 })] }) }),
    defenderSide([stack({ id: 'm', hp: 1e6, attack: 100, defense: 0 })]),
    { seed: 1 },
  );
  const rounds = report.waves[0].rounds;
  assert.equal(rounds[0].attacker[0].hpPool, 2400);
  assert.equal(rounds[1].attacker[0].hpPool, 2400);
  assert.ok(rounds[2].attacker[0].hpPool < 2400);
});

test('an over-100% defenseBonus never heals the attacker', () => {
  const report = resolveBattle(
    attackerSide([footmen(20)], { triggers: withTriggers({ wave_start: [trigger('wave_start', { defenseBonus: 3 })] }) }),
    defenderSide([stack({ id: 'm', hp: 1e6, attack: 100, defense: 0 })]),
    { seed: 1 },
  );
  for (const round of report.waves[0].rounds) assert.equal(round.attacker[0].hpPool, 2400);
});

test('battle_start duration counts rounds of the first wave only', () => {
  const report = resolveBattle(
    attackerSide([footmen(50)], { triggers: withTriggers({ battle_start: [trigger('battle_start', { evasion: true, duration: 3 })] }) }),
    defenderSide([footmen(1, { id: 'd1' })], [stack({ id: 'm', hp: 1e6, attack: 200, defense: 0 })]),
    { seed: 1 },
  );
  assert.equal(report.waves[0].rounds.length, 1);
  assert.equal(report.waves[0].rounds[0].attacker[0].hpPool, 6000);
  assert.ok(report.waves[1].rounds[0].attacker[0].hpPool < 6000);
});

test('final_wave effects are active every round of the last non-empty wave only', () => {
  const report = resolveBattle(
    attackerSide([footmen(50)], { triggers: withTriggers({ final_wave: [trigger('final_wave', { evasion: true })] }) }),
    defenderSide([footmen(1, { id: 'd1' })], [stack({ id: 'm', hp: 3000, attack: 200, defense: 0 })], []),
    { seed: 1 },
  );
  assert.ok(report.waves[0].rounds[0].attacker[0].hpPool < 6000);
  assert.ok(report.waves[1].rounds.length > 1);
  for (const round of report.waves[1].rounds) assert.equal(round.attacker[0].hpPool, report.waves[0].rounds.at(-1).attacker[0].hpPool);
});

test('wave_start effects are active every round of every wave', () => {
  const report = resolveBattle(
    attackerSide([footmen(50)], { triggers: withTriggers({ wave_start: [trigger('wave_start', { evasion: true })] }) }),
    defenderSide([stack({ id: 'a', hp: 3000, attack: 200, defense: 0 })], [stack({ id: 'b', hp: 3000, attack: 200, defense: 0 })]),
    { seed: 1 },
  );
  assert.ok(report.waves[0].rounds.length > 1);
  assert.ok(report.waves[1].rounds.length > 1);
  for (const wave of report.waves) for (const round of wave.rounds) assert.equal(round.attacker[0].hpPool, 6000);
});

test('firstWaveBonus applies only in round 1 of the first non-empty wave', () => {
  const defender = () => defenderSide([], [stack({ id: 'm', tier: 6, hp: 1e6, attack: 0, defense: 100 })]);
  const poolsOf = (extra) => resolveBattle(attackerSide([footmen(10, { attack: 20 })], extra), defender(), { seed: 4 }).waves[1].rounds.map((r) => r.defender[0].hpPool);
  const plain = poolsOf({});
  const boosted = poolsOf({ firstWaveBonus: 0.5 });
  assert.ok(boosted[0] < plain[0]);
  const drop = (pools, i) => pools[i - 1] - pools[i];
  assert.ok(drop(boosted, 1) > 0);
  assert.equal(drop(boosted, 1), drop(plain, 1));
  assert.equal(drop(boosted, 2), drop(plain, 2));
});

test('losing-trigger lossReduction counts once per battle', () => {
  const report = resolveBattle(
    attackerSide([footmen(10)], { triggers: withTriggers({ losing: [trigger('losing', { lossReduction: 0.2 })] }) }),
    defenderSide([stack({ id: 'm', hp: 1e6, attack: 200, defense: 0 })]),
    { seed: 1 },
  );
  assert.equal(report.victory, false);
  assert.equal(report.fallen.infantry_t1, 10);
  const share = COMBAT_RULES.WOUNDED_SHARE.defeat + 0.2 * (1 - COMBAT_RULES.WOUNDED_SHARE.defeat);
  assert.equal(report.wounded.infantry_t1, Math.floor(10 * share));
  assert.equal(report.dead.infantry_t1, 10 - Math.floor(10 * share));
});

test('attacker with no stacks loses immediately', () => {
  const report = resolveBattle(attackerSide([]), defenderSide([footmen(1, { id: 'd' })]), { seed: 1 });
  assert.equal(report.victory, false);
  assert.equal(report.roundsTotal, 0);
});

test('attacker with strikers but no stacks loses', () => {
  const report = resolveBattle(
    attackerSide([], { strikers: [{ heroId: 'h1', slotIndex: 0, attack: 500, level: 10 }] }),
    defenderSide([footmen(1, { id: 'd' })]),
    { seed: 1 },
  );
  assert.equal(report.victory, false);
  assert.equal(report.roundsTotal, 0);
});

test('an empty defender wave is skipped', () => {
  const report = resolveBattle(attackerSide([footmen(50)]), defenderSide([], [footmen(1, { id: 'd' })]), { seed: 1 });
  assert.equal(report.victory, true);
  assert.equal(report.waves[0].rounds.length, 0);
  assert.ok(report.waves[1].rounds.length > 0);
});

test('a mutual wipe on the final wave is a defeat', () => {
  const report = resolveBattle(
    attackerSide([footmen(10)], { healEntries: [{ stat: 'postBattleHeal', category: 'hero', value: 0.3, sourceId: 'medic' }] }),
    defenderSide([stack({ id: 'glass', hp: 1, attack: 2000, defense: 0 })]),
    { seed: 1 },
  );
  const lastRound = report.waves[0].rounds.at(-1);
  assert.equal(report.roundsTotal, 1);
  assert.equal(lastRound.attacker[0].count, 0);
  assert.equal(lastRound.defender[0].count, 0);
  assert.equal(report.victory, false);
  assert.deepEqual(report.healed, {});
  assert.equal(report.wounded.infantry_t1, Math.floor(10 * COMBAT_RULES.WOUNDED_SHARE.defeat));
  assert.equal(report.dead.infantry_t1, 10 - Math.floor(10 * COMBAT_RULES.WOUNDED_SHARE.defeat));
});

test('attack bonuses scale atk inside hitDamage', () => {
  const firstRoundPool = (attack, extra) => resolveBattle(
    attackerSide([footmen(10, { attack })], extra),
    defenderSide([stack({ id: 'm', tier: 6, hp: 1e6, attack: 0, defense: 100 })]),
    { seed: 4 },
  ).waves[0].rounds[0].defender[0].hpPool;
  const premultiplied = firstRoundPool(30);
  assert.equal(firstRoundPool(20, { firstWaveBonus: 0.5 }), premultiplied);
  assert.equal(firstRoundPool(20, { triggers: withTriggers({ battle_start: [trigger('battle_start', { attackBonus: 0.5, duration: 1 })] }) }), premultiplied);
});


const mixedBattle = () => [
  attackerSide([footmen(40, { id: 'front' }), stack({ ...FOOTMAN, id: 'back', type: 'ranged', row: 'back', count: 25, attack: 18, tierKey: 'ranged_t1' })], {
    strikers: [{ heroId: 'h1', slotIndex: 0, attack: 60, level: 3 }],
    firstWaveBonus: 0.1,
    triggers: withTriggers({ battle_start: [trigger('battle_start', { attackBonus: 0.2, duration: 2 })], losing: [trigger('losing', { defenseBonus: 0.3 })] }),
  }),
  defenderSide(
    [
      stack({ id: 'grunt', type: 'infantry', tier: 2, hp: 150, attack: 20, defense: 8, count: 12 }),
      stack({ id: 'howl', type: 'ranged', row: 'back', tier: 3, hp: 300, attack: 35, defense: 5, count: 3, ability: { kind: 'heal', value: 0.2 } }),
    ],
    [
      stack({ id: 'rev', tier: 2, hp: 200, attack: 30, defense: 6, count: 6, ability: { kind: 'revive', value: 0.5 } }),
      stack({ id: 'blast', type: 'siege', row: 'back', tier: 4, hp: 400, attack: 40, defense: 4, count: 2, ability: { kind: 'aoe_blast', value: 1 } }),
    ],
  ),
];

const PINNED = [
  {
    seed: 7,
    build: () => [attackerSide([footmen(30)]), defenderSide([stack({ ...DEF_100, id: 'm' })])],
    expected: { victory: true, dead: { infantry_t1: 6 }, wounded: { infantry_t1: 4 }, roundsTotal: 18, rounds: [['30:3538.7212304749983|1:703.458203599053', '29:3468.8849751164057|1:646.9595774924874', '29:3402.9912698369044|1:596.8860776568077', '28:3339.3219492000294|1:547.3631543528746', '28:3269.0720599180827|1:498.70938081871395', '27:3206.5307628247456|1:452.9007987153766', '27:3139.120778861867|1:404.02787997905955', '26:3073.7316420349703|1:360.41866878518647', '26:3006.1022106409678|1:317.5653557430218', '25:2932.5193811072772|1:274.6844804008754', '24:2860.2820440283954|1:233.87234950286688', '24:2797.905846209928|1:195.16097371203244', '23:2733.5511154962746|1:156.74791140008824', '23:2662.8706911643835|1:116.82521025361174', '22:2590.1610503984657|1:80.6463899900435', '22:2521.3645270481616|1:42.4155114895665', '21:2447.942302562062|1:3.2285781665411832', '20:2375.121653092583|0:0']] },
  },
  {
    seed: 1,
    build: () => [attackerSide([footmen(30)]), defenderSide([stack({ id: 'brute', hp: 300, attack: 120, defense: 0, count: 2 })], [stack({ id: 'dummy', hp: 100, attack: 0, defense: 0, count: 1 })])],
    expected: { victory: true, dead: { infantry_t1: 2 }, wounded: {}, roundsTotal: 3, rounds: [['29:3400.494171123092|1:169.32578899059445', '28:3279.067811228335|0:0'], ['28:3279.067811228335|0:0']] },
  },
  {
    seed: 12345,
    build: mixedBattle,
    expected: { victory: true, dead: { infantry_t1: 5, ranged_t1: 1 }, wounded: { infantry_t1: 2 }, roundsTotal: 6, rounds: [['38:4535.732335928804,25:3000|1:67.55913055267081,3:900', '37:4421.052459745148,25:3000|0:0,3:900', '37:4324.737902826455,25:3000|0:0,0:0'], ['35:4113.708350466064,25:2931.325761577487|3:600,2:800', '34:3980.7450605255904,24:2867.9268342673777|0:0,2:800', '33:3921.850872997695,24:2809.0326467394825|0:0,0:0']] },
  },
];

const encodeSide = (snaps) => snaps.map((s) => `${s.count}:${s.hpPool}`).join(',');

test('same outcomes for fixed seeds', () => {
  for (const { seed, build, expected } of PINNED) {
    const report = resolveBattle(...build(), { seed });
    const rounds = report.waves.map((wave) => wave.rounds.map((r) => `${encodeSide(r.attacker)}|${encodeSide(r.defender)}`));
    assert.deepEqual({ victory: report.victory, dead: report.dead, wounded: report.wounded, roundsTotal: report.roundsTotal, rounds }, expected, `seed ${seed}`);
  }
});

test('rounds carry a 1-based round number per wave', () => {
  const report = resolveBattle(...PINNED[1].build(), { seed: 1 });
  for (const wave of report.waves) wave.rounds.forEach((round, i) => assert.equal(round.round, i + 1));
  assert.equal(report.waves[1].rounds[0].round, 1);
});

const eventsOf = (round, kind) => round.events.filter((e) => e.kind === kind);
const sumKills = (events) => events.reduce((sum, e) => sum + e.hits.reduce((s, h) => s + h.kills, 0), 0);
const frontOf = (stacks, snaps) => COMBAT_RULES.ROWS.find((row) => stacks.some((s, i) => s.row === row && snaps[i].count > 0));

test('strike events: attacker strikes target the defender front row and their kills sum to the snapshot drop', () => {
  for (const seed of [1, 7, 12345]) {
    const [attackerIn, defenderIn] = mixedBattle();
    const report = resolveBattle(attackerIn, defenderIn, { seed });
    let attackerPrev = report.initial.attacker;
    report.waves.forEach((wave, w) => {
      const defenderStacks = defenderIn.waves[w].stacks;
      let defenderPrev = report.initial.defender[w];
      for (const round of wave.rounds) {
        const strikes = eventsOf(round, 'strike');
        const ours = strikes.filter((e) => e.side === 'attacker');
        const theirs = strikes.filter((e) => e.side === 'defender');
        const front = frontOf(defenderStacks, defenderPrev);
        assert.ok(ours.length > 0);
        for (const e of ours) {
          assert.equal(e.row, front);
          assert.ok(attackerIn.stacks.some((s) => s.id === e.fromId));
          for (const hit of e.hits) assert.equal(defenderStacks.find((s) => s.id === hit.targetId).row, front);
        }
        for (const e of theirs) assert.ok(defenderStacks.some((s) => s.id === e.fromId));
        const healedCount = defenderStacks.reduce((sum, s, i) => {
          const heal = eventsOf(round, 'heal').find((e) => e.stackId === s.id);
          return sum + (heal ? Math.ceil((defenderPrev[i].hpPool + heal.amount) / s.hp) - defenderPrev[i].count : 0);
        }, 0);
        const revived = eventsOf(round, 'revive').reduce((sum, e) => sum + e.count, 0);
        const drop = defenderPrev.reduce((sum, s, i) => sum + s.count - round.defender[i].count, 0);
        assert.equal(sumKills(ours) + sumKills(eventsOf(round, 'heroStrike')), drop + revived + healedCount, `seed ${seed} wave ${w} round ${round.round}`);
        const attackerDrop = attackerPrev.reduce((sum, s, i) => sum + s.count - round.attacker[i].count, 0);
        assert.equal(sumKills(theirs), attackerDrop);
        assert.deepEqual(eventsOf(round, 'heroStrike').map((e) => e.heroId), round.heroHits.map((h) => h.heroId));
        defenderPrev = round.defender;
        attackerPrev = round.attacker;
      }
    });
  }
});

test('heal events record HP restored', () => {
  const howlers = stack({ id: 'howlers', type: 'ranged', row: 'back', tier: 3, hp: 300, attack: 35, defense: 0, count: 3, ability: { kind: 'heal', value: 0.2 } });
  const report = resolveBattle(attackerSide([footmen(5)]), defenderSide([howlers]), { seed: 1 });
  const rounds = report.waves[0].rounds;
  assert.deepEqual(eventsOf(rounds[0], 'heal'), []);
  let healsSeen = 0;
  for (let i = 1; i < rounds.length; i++) {
    const prevPool = rounds[i - 1].defender[0].hpPool;
    const heals = eventsOf(rounds[i], 'heal');
    if (prevPool <= 0 || prevPool >= 900) {
      assert.deepEqual(heals, []);
      continue;
    }
    healsSeen++;
    assert.equal(heals.length, 1);
    assert.equal(heals[0].stackId, 'howlers');
    assert.ok(Math.abs(heals[0].amount - 0.2 * (900 - prevPool)) < 1e-9);
  }
  assert.ok(healsSeen > 0);
});

test('revive event when a revive stack returns', () => {
  const report = resolveBattle(
    attackerSide([footmen(100)]),
    defenderSide([stack({ id: 'r', hp: 10, attack: 0, defense: 0, count: 4, ability: { kind: 'revive', value: 0.5 } })]),
    { seed: 1 },
  );
  const rounds = report.waves[0].rounds;
  assert.deepEqual(eventsOf(rounds[0], 'revive'), [{ kind: 'revive', stackId: 'r', count: 2 }]);
  assert.deepEqual(eventsOf(rounds[1], 'revive'), []);
});

test('skill edges: battle_start, wave_start and final_wave fire on round 1 of their wave only', () => {
  const dummy = (id) => stack({ id, hp: 3000, attack: 0, defense: 0 });
  const report = resolveBattle(
    attackerSide([footmen(50)], {
      triggers: withTriggers({
        battle_start: [trigger('battle_start', { attackBonus: 0.1, duration: 1 })],
        wave_start: [trigger('wave_start', { attackBonus: 0.1 })],
        final_wave: [trigger('final_wave', { attackBonus: 0.1 })],
      }),
    }),
    defenderSide([dummy('a')], [], [dummy('b')], [dummy('c')], []),
    { seed: 1 },
  );
  const skill = (event) => ({ kind: 'skill', heroId: 'h1', skillId: `sk_${event}`, trigger: event });
  const byRound = report.waves.map((wave) => wave.rounds.map((r) => eventsOf(r, 'skill')));
  for (const w of [0, 2, 3]) assert.ok(byRound[w].length > 1, `wave ${w} should last several rounds`);
  assert.deepEqual(byRound[0][0], [skill('wave_start'), skill('battle_start')]);
  assert.deepEqual(byRound[2][0], [skill('wave_start')]);
  assert.deepEqual(byRound[3][0], [skill('wave_start'), skill('final_wave')]);
  for (const w of [0, 2, 3]) for (const events of byRound[w].slice(1)) assert.deepEqual(events, []);
  assert.deepEqual(byRound[1], []);
  assert.deepEqual(byRound[4], []);
});

test('skill edges: losing fires once on the first round below LOSING_THRESHOLD', () => {
  const report = resolveBattle(
    attackerSide([footmen(10)], { triggers: withTriggers({ losing: [trigger('losing', { defenseBonus: 0.1 })] }) }),
    defenderSide([stack({ id: 'm', hp: 1e6, attack: 200, defense: 0 })]),
    { seed: 1 },
  );
  const rounds = report.waves[0].rounds;
  const startHp = 10 * FOOTMAN.hp;
  const poolBefore = (i) => (i === 0 ? startHp : rounds[i - 1].attacker[0].hpPool);
  const firstLosing = rounds.findIndex((_, i) => poolBefore(i) < COMBAT_RULES.LOSING_THRESHOLD * startHp);
  assert.ok(firstLosing > 0 && firstLosing < rounds.length - 1);
  rounds.forEach((round, i) => {
    const expected = i === firstLosing ? [{ kind: 'skill', heroId: 'h1', skillId: 'sk_losing', trigger: 'losing' }] : [];
    assert.deepEqual(eventsOf(round, 'skill'), expected, `round ${i + 1}`);
  });
});
