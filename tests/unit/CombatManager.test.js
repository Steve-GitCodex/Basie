import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatManager } from '../../js/systems/CombatManager.js';
import { eventBus } from '../../js/core/EventBus.js';
import { SKILLS_CONFIG } from '../../js/entities/GAME_DATA.js';
import { bucketTriggeredByEvent, sumTriggeredEffects } from '../../js/systems/hero/heroSkills.js';

const SEED = 12345;
const HERO_XP_MARKER = [{ heroId: 'marker' }];

function entry(skillId, level = 1) {
  return { heroId: 'test_hero', skill: SKILLS_CONFIG[skillId], level };
}

test('summed defenseBonus above 1.0 is reachable from real config magnitudes', () => {
  const worstCase = sumTriggeredEffects([
    entry('divine_shield', 10), entry('emp_burst', 10),
    entry('aegis_of_the_faithful', 1), entry('static_ward', 1),
  ]);
  assert.ok(worstCase.defenseBonus > 1.0,
    `the clamp fixture is no longer a worst case — got ${worstCase.defenseBonus}`);
});

const unitEntry = (unitId, tier, count) => ({
  unitId, tier, tierKey: `${unitId}_t${tier}`, count, category: unitId === 'infantry' ? 'melee' : unitId,
});

function neutralBonuses() {
  const triggeredByEvent = bucketTriggeredByEvent([]);
  return {
    attackMult: 1, defenseMult: 1, baseDefense: 0, lossReduction: 0, postBattleHeal: 0,
    statEntries: { lossReduction: [], postBattleHeal: [] },
    triggeredByEvent, activeSkills: triggeredByEvent.battle_start, strikers: [], productionBuffMult: 0,
  };
}

function makeCombat(units) {
  const squad = { name: 'Test Squad', units: units.map((u) => ({ ...u })) };
  const removed = [];
  const bonusCalls = [];
  const unitManager = {
    getSquad: () => squad,
    getSquadRows: () => new Map(),
    isSquadDeployed: () => false,
    removeUnitsFromSquad: (squadId, losses) => {
      removed.push({ squadId, losses });
      for (const unit of squad.units) unit.count -= losses[unit.tierKey] ?? 0;
    },
  };
  const heroManager = {
    getCombatBonuses: (squadId) => { bonusCalls.push(squadId); return neutralBonuses(); },
    awardBattleXP: () => HERO_XP_MARKER,
  };
  const userManager = { addXP: () => {}, setWaveHighScore: () => {} };
  const combat = new CombatManager(unitManager, userManager, {}, heroManager, null);
  return { combat, squad, removed, bonusCalls };
}

function recordEvents(names, run) {
  const seen = [];
  const handlers = names.map((name) => [name, (data) => seen.push({ name, data })]);
  for (const [name, fn] of handlers) eventBus.on(name, fn);
  try { run(); } finally { for (const [name, fn] of handlers) eventBus.off(name, fn); }
  return seen;
}

const total = (map) => Object.values(map).reduce((sum, n) => sum + n, 0);

test('attack applies dead and wounded and emits combat:unitsWounded', () => {
  const { combat, squad, removed } = makeCombat([unitEntry('infantry', 1, 80)]);
  let result;
  const seen = recordEvents(['combat:unitsWounded', 'combat:victory'], () => {
    result = combat.attack('orc_warband', 'squad_1', { seed: SEED });
  });
  const { report } = result;
  assert.equal(result.success, true);
  assert.equal(report.victory, true);
  assert.equal(report.seed, SEED);
  assert.ok(total(report.dead) + total(report.wounded) > 0, 'fixture must take casualties');

  const expected = {};
  for (const map of [report.dead, report.wounded]) {
    for (const [key, n] of Object.entries(map)) expected[key] = (expected[key] ?? 0) + n;
  }
  assert.deepEqual(removed, [{ squadId: 'squad_1', losses: expected }]);
  assert.equal(squad.units[0].count, 80 - total(expected));

  const wounded = seen.find((e) => e.name === 'combat:unitsWounded');
  assert.deepEqual(wounded.data, { squadId: 'squad_1', wounded: report.wounded });
  const victory = seen.find((e) => e.name === 'combat:victory').data;
  assert.deepEqual(victory.dead, report.dead);
  assert.deepEqual(victory.wounded, report.wounded);
  assert.equal('losses' in victory, false);

  const log = combat.getBattleLog()[0];
  assert.equal(log.seed, SEED);
  assert.equal(log.rulesVersion, report.rulesVersion);
  assert.deepEqual(log.dead, report.dead);
  assert.deepEqual(log.wounded, report.wounded);
});

test('a defeat emits combat:defeat with dead and wounded', () => {
  const { combat } = makeCombat([unitEntry('infantry', 1, 5)]);
  let result;
  const seen = recordEvents(['combat:defeat', 'combat:victory'], () => {
    result = combat.attack('chaos_titan', 'squad_1', { seed: SEED });
  });
  assert.equal(result.report.victory, false);
  assert.equal(result.rewards, null);
  assert.deepEqual(seen.map((e) => e.name), ['combat:defeat']);
  assert.deepEqual(seen[0].data.dead, result.report.dead);
  assert.deepEqual(seen[0].data.wounded, result.report.wounded);
  assert.equal(total(result.report.dead) + total(result.report.wounded), 5);
});

test('resolveMarchBattle honours milMult below 1', () => {
  const full = makeCombat([unitEntry('infantry', 1, 50)]).combat
    .resolveMarchBattle('squad_1', 'goblin_camp', 1, { seed: SEED });
  const half = makeCombat([unitEntry('infantry', 1, 50)]).combat
    .resolveMarchBattle('squad_1', 'goblin_camp', 0.5, { seed: SEED });
  assert.ok(Math.abs(half.report.initial.attacker[0].attack - full.report.initial.attacker[0].attack / 2) < 1e-9);
  assert.deepEqual(full.dead, full.report.dead);
  assert.deepEqual(full.wounded, full.report.wounded);
});

test('structure fights boost siege', () => {
  const defenderLosses = (structure) => {
    const { report } = makeCombat([unitEntry('siege', 1, 3)]).combat
      .resolveMarchBattle('squad_1', 'orc_warband', 1, { structure, seed: SEED });
    const before = report.initial.defender[0].reduce((sum, s) => sum + s.hpPool, 0);
    const after = report.waves[0].rounds[0].defender.reduce((sum, s) => sum + s.hpPool, 0);
    return before - after;
  };
  assert.ok(defenderLosses(true) > defenderLosses(false));
});

test('estimateBattle uses the squad\'s own heroes', () => {
  const { combat, bonusCalls } = makeCombat([unitEntry('infantry', 1, 50)]);
  combat.estimateBattle('squad_2', 'goblin_camp');
  assert.ok(bonusCalls.length > 0);
  assert.ok(bonusCalls.every((id) => id === 'squad_2'), `called with ${bonusCalls}`);
});

test('estimateBattle is side-effect free', () => {
  const { combat, squad, removed } = makeCombat([unitEntry('infantry', 1, 200)]);
  let estimate;
  const seen = recordEvents(
    ['combat:started', 'combat:victory', 'combat:defeat', 'combat:unitsWounded', 'combat:logUpdated', 'combat:marchResolved'],
    () => { estimate = combat.estimateBattle('squad_1', 'goblin_camp'); },
  );
  assert.equal(squad.units[0].count, 200);
  assert.deepEqual(removed, []);
  assert.deepEqual(seen, []);
  assert.deepEqual(combat.getBattleLog(), []);
  assert.ok(estimate.winChance >= 0 && estimate.winChance <= 1);
  assert.ok(estimate.avgDead >= 0 && estimate.avgWounded >= 0);
  assert.deepEqual(combat.estimateBattle('squad_1', 'goblin_camp'), estimate);
});

test('Steel Armor 0.60 moves more fallen into wounded than none', () => {
  const woundedShare = (lossReduction) => {
    const { combat } = makeCombat([unitEntry('infantry', 1, 80)]);
    combat._techBonuses = { lossReduction };
    const { report } = combat.attack('orc_warband', 'squad_1', { seed: SEED });
    return total(report.wounded) / total(report.fallen);
  };
  assert.ok(woundedShare(0.6) > woundedShare(0));
});

test('an unknown difficulty setting is ignored and battles stay on normal', () => {
  const { combat } = makeCombat([unitEntry('infantry', 1, 80)]);
  eventBus.emit('settings:changed', { difficulty: 'bogus' });
  const result = combat.attack('orc_warband', 'squad_1', { seed: SEED });
  const normal = makeCombat([unitEntry('infantry', 1, 80)]).combat.attack('orc_warband', 'squad_1', { seed: SEED });
  assert.equal(result.success, true);
  assert.deepEqual(result.report.initial.defender, normal.report.initial.defender);
});

const allEvents = ['combat:victory', 'combat:defeat'];
const outcomeOf = (seen) => seen.find((e) => allEvents.includes(e.name)).data;

test('attack resolves a generated stage id', () => {
  const { combat, squad } = makeCombat([unitEntry('infantry', 1, 200)]);
  let result;
  const seen = recordEvents(allEvents, () => { result = combat.attack('ch1_s1', 'squad_1', { seed: SEED }); });
  assert.equal(result.success, true);
  const data = outcomeOf(seen);
  assert.equal(data.stageId, 'ch1_s1');
  assert.equal(data.monsterId, 'ch1_s1');
  assert.equal(data.rounds, result.report.roundsTotal);
  assert.equal(data.sent, 200);
  assert.equal(typeof data.enemyLeftPct, 'number');
  assert.ok(squad.units[0].count <= 200);
});

test('attack on a boss id carries stageId equal to the monster id', () => {
  const { combat } = makeCombat([unitEntry('infantry', 1, 80)]);
  const seen = recordEvents(allEvents, () => { combat.attack('orc_warband', 'squad_1', { seed: SEED }); });
  const data = outcomeOf(seen);
  assert.equal(data.stageId, 'orc_warband');
  assert.equal(data.sent, 80);
});

test('survival attack omits stageId', () => {
  const { combat } = makeCombat([unitEntry('infantry', 1, 80)]);
  eventBus.emit('game:modeChanged', { mode: 'survival' });
  try {
    const seen = recordEvents(allEvents, () => { combat.attack('survival_wave', 'squad_1', { seed: SEED }); });
    assert.equal('stageId' in outcomeOf(seen), false);
  } finally {
    eventBus.emit('game:modeChanged', { mode: 'campaign' });
  }
});

test('defeat carries rounds, sent and a non-zero enemyLeftPct', () => {
  const { combat } = makeCombat([unitEntry('infantry', 1, 5)]);
  let result;
  const seen = recordEvents(allEvents, () => { result = combat.attack('chaos_titan', 'squad_1', { seed: SEED }); });
  const data = outcomeOf(seen);
  assert.equal(data.rounds, result.report.roundsTotal);
  assert.equal(data.sent, 5);
  assert.ok(data.enemyLeftPct > 0 && data.enemyLeftPct <= 100);
});

test('enemyLeftPct is 0 on victory', () => {
  const { combat } = makeCombat([unitEntry('infantry', 1, 300)]);
  const seen = recordEvents(allEvents, () => { combat.attack('goblin_camp', 'squad_1', { seed: SEED }); });
  const victory = seen.find((e) => e.name === 'combat:victory').data;
  assert.equal(victory.enemyLeftPct, 0);
});

test('attacking a frozen generated stage does not mutate it', () => {
  const { combat } = makeCombat([unitEntry('infantry', 1, 200)]);
  assert.doesNotThrow(() => combat.attack('ch1_elite', 'squad_1', { seed: SEED }));
});

test('getMonsterProgress reads the generated stage cap, matching attack', () => {
  const { combat } = makeCombat([unitEntry('infantry', 1, 5)]);
  assert.equal(combat.getMonsterProgress('ch1_s1').maxRewardedWins, 5);
});

test('attack result carries heroXp on victory and an empty list on defeat', () => {
  const won = makeCombat([unitEntry('infantry', 1, 80)]).combat.attack('orc_warband', 'squad_1', { seed: SEED });
  assert.equal(won.report.victory, true);
  assert.equal(won.heroXp, HERO_XP_MARKER);

  const lost = makeCombat([unitEntry('infantry', 1, 5)]).combat.attack('chaos_titan', 'squad_1', { seed: SEED });
  assert.equal(lost.report.victory, false);
  assert.deepEqual(lost.heroXp, []);
});

test('combat:victory and combat:defeat carry wavesReached and bossLeftPct', () => {
  let won;
  const wonSeen = recordEvents(['combat:victory'], () => {
    won = makeCombat([unitEntry('infantry', 1, 80)]).combat.attack('orc_warband', 'squad_1', { seed: SEED });
  });
  assert.equal(wonSeen[0].data.wavesReached, won.report.waves.filter((w) => w.rounds.length > 0).length);
  assert.equal(wonSeen[0].data.bossLeftPct, 0);

  const lostSeen = recordEvents(['combat:defeat'], () => {
    makeCombat([unitEntry('infantry', 1, 5)]).combat.attack('chaos_titan', 'squad_1', { seed: SEED });
  });
  assert.ok(lostSeen[0].data.wavesReached >= 1);
  assert.ok(lostSeen[0].data.bossLeftPct > 0 && lostSeen[0].data.bossLeftPct <= 100);
});
