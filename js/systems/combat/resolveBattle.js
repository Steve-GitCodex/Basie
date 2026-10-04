import { COMBAT_RULES } from '../../entities/data/combatRules.js';
import { createRng } from './seededRng.js';
import { hitDamage, varianceMult } from './hitMath.js';
import { livingInRow, frontRow, allocate, strikeRow } from './targeting.js';
import { splitCasualties } from './casualties.js';
import { sumTriggeredEffects, triggeredStatEntries } from '../hero/heroSkills.js';
import { aggregate, mergeMaxBySource } from '../stats/statAggregator.js';

const { RULES_VERSION, ROUND_CAP, LOSING_THRESHOLD, HERO_STRIKE, ROWS } = COMBAT_RULES;

const isAlive = (stack) => stack.count > 0;
const anyAlive = (stacks) => stacks.some(isAlive);
const totalHp = (stacks) => stacks.reduce((sum, stack) => sum + stack.hpPool, 0);
const snapshotOf = (stacks) => stacks.map(({ id, count, hpPool }) => ({ id, count, hpPool }));

function cloneAttacker(input) {
  const triggers = input.triggers ?? {};
  return {
    stacks: structuredClone(input.stacks ?? []),
    strikers: structuredClone(input.strikers ?? []),
    triggers: {
      battle_start: triggers.battle_start ?? [],
      wave_start: triggers.wave_start ?? [],
      final_wave: triggers.final_wave ?? [],
      losing: triggers.losing ?? [],
    },
    lossEntries: input.lossEntries ?? [],
    healEntries: input.healEntries ?? [],
    firstWaveBonus: input.firstWaveBonus ?? 0,
  };
}

function healDefenders(stacks) {
  for (const stack of stacks) {
    if (!isAlive(stack) || stack.ability?.kind !== 'heal') continue;
    const fullPool = stack.startCount * stack.hp;
    stack.hpPool = Math.min(fullPool, stack.hpPool + stack.ability.value * (fullPool - stack.hpPool));
    stack.count = Math.ceil(stack.hpPool / stack.hp);
  }
}

function reviveDefenders(stacks) {
  for (const stack of stacks) {
    if (isAlive(stack) || stack.ability?.kind !== 'revive' || stack.revived) continue;
    stack.count = Math.round(stack.startCount * stack.ability.value);
    stack.hpPool = stack.count * stack.hp;
    stack.revived = true;
  }
}

function activeTriggers(battle, wave, round) {
  const { triggers } = battle.attacker;
  const active = [...triggers.wave_start];
  if (wave.isFirst) {
    active.push(...triggers.battle_start.filter((entry) => round <= (entry.skill?.effect?.duration ?? 1)));
  }
  if (wave.isFinal) active.push(...triggers.final_wave);
  if (totalHp(battle.attacker.stacks) < LOSING_THRESHOLD * battle.initialHp) active.push(...triggers.losing);
  return active;
}

function planStackStrikes(stacks, counts, variances, { attackScale, multFor, rowsFor, structure }) {
  const plans = [];
  stacks.forEach((stack, i) => {
    if (counts[i] <= 0) return;
    for (const targets of rowsFor(stack)) {
      plans.push({
        attacker: { count: counts[i], attack: stack.attack * attackScale, type: stack.type },
        mult: multFor(variances[i]),
        targets,
        structure,
      });
    }
  });
  return plans;
}

function planHeroStrike(striker, variance, attackMult, targets) {
  const attack = striker.attack * (1 + HERO_STRIKE.perLevel * (striker.level - 1));
  const mult = HERO_STRIKE.factor * attackMult * variance;
  const shares = allocate(1, targets);
  const damage = targets.reduce((sum, target, i) => sum + shares[i] * hitDamage(attack, target.defense) * mult, 0);
  const focus = shares.indexOf(Math.max(...shares));
  return {
    heroId: striker.heroId,
    targetId: targets[focus].id,
    damage,
    strike: { attacker: { count: 1, attack, type: 'hero' }, mult, targets, structure: false },
  };
}

function playRound(battle, wave, round) {
  const { attacker, rng, structure } = battle;
  const defenders = wave.stacks;
  healDefenders(defenders);

  const active = activeTriggers(battle, wave, round);
  const fx = sumTriggeredEffects(active);
  mergeMaxBySource(battle.triggeredLoss, triggeredStatEntries(active, 'lossReduction'));
  mergeMaxBySource(battle.triggeredHeal, triggeredStatEntries(active, 'postBattleHeal'));

  const attackerCounts = attacker.stacks.map((stack) => stack.count);
  const defenderCounts = defenders.map((stack) => stack.count);
  const attackerVariance = attacker.stacks.map(() => varianceMult(rng));
  const strikerVariance = attacker.strikers.map(() => varianceMult(rng));
  const defenderVariance = defenders.map(() => varianceMult(rng));

  const attackMult = 1 + fx.attackBonus;
  const opening = wave.isFirst && round === 1 ? 1 + attacker.firstWaveBonus : 1;
  const intake = fx.evasion ? 0 : Math.max(0, 1 - fx.defenseBonus);
  const defenderFront = frontRow(defenders);
  const attackerFront = frontRow(attacker.stacks);
  const defenderTargets = defenderFront ? livingInRow(defenders, defenderFront) : null;
  const attackerRows = ROWS.map((row) => livingInRow(attacker.stacks, row)).filter((row) => row.length > 0);
  const attackerTargets = attackerFront ? livingInRow(attacker.stacks, attackerFront) : null;

  const outgoing = defenderTargets
    ? planStackStrikes(attacker.stacks, attackerCounts, attackerVariance, {
      attackScale: attackMult * opening, multFor: (v) => v, rowsFor: () => [defenderTargets], structure,
    })
    : [];
  const heroStrikes = defenderTargets
    ? attacker.strikers.map((striker, i) => planHeroStrike(striker, strikerVariance[i], attackMult, defenderTargets))
    : [];
  const incoming = attackerTargets
    ? planStackStrikes(defenders, defenderCounts, defenderVariance, {
      attackScale: 1,
      multFor: (v) => v * intake,
      rowsFor: (stack) => (stack.ability?.kind === 'aoe_blast' ? attackerRows : [attackerTargets]),
      structure: false,
    })
    : [];

  for (const plan of outgoing) strikeRow(plan);
  const heroHits = heroStrikes.map(({ strike, ...hit }) => ({ ...hit, kills: strikeRow(strike) }));
  for (const plan of incoming) strikeRow(plan);
  reviveDefenders(defenders);

  const triggered = active.map((entry) => ({ heroId: entry.heroId, skillId: entry.skill.id }));
  return { attacker: snapshotOf(attacker.stacks), defender: snapshotOf(defenders), heroHits, triggered };
}

function fightWave(battle, wave, rounds) {
  for (let round = 1; round <= ROUND_CAP; round++) {
    if (!anyAlive(battle.attacker.stacks) || !anyAlive(wave.stacks)) break;
    rounds.push(playRound(battle, wave, round));
  }
  return !anyAlive(wave.stacks);
}

function casualties(battle, victory) {
  const fallen = {};
  for (const stack of battle.attacker.stacks) {
    const lost = stack.startCount - stack.count;
    if (lost > 0) fallen[stack.tierKey] = (fallen[stack.tierKey] ?? 0) + lost;
  }
  const lossReduction = aggregate('lossReduction', [...battle.attacker.lossEntries, ...battle.triggeredLoss.values()]).total;
  const postBattleHeal = aggregate('postBattleHeal', [...battle.attacker.healEntries, ...battle.triggeredHeal.values()]).total;
  return { fallen, ...splitCasualties({ fallen, victory, lossReduction, postBattleHeal }) };
}

export function resolveBattle(attackerInput, defenderInput, { seed, rulesVersion = RULES_VERSION, structure = false } = {}) {
  const attacker = cloneAttacker(attackerInput);
  const waves = defenderInput.waves.map((wave) => ({ name: wave.name, stacks: structuredClone(wave.stacks ?? []) }));
  const initial = { attacker: structuredClone(attacker.stacks), defender: waves.map((wave) => structuredClone(wave.stacks)) };
  const reportWaves = waves.map((wave) => ({ name: wave.name, rounds: [] }));
  const fought = waves.map((_, i) => i).filter((i) => anyAlive(waves[i].stacks));

  const battle = {
    attacker,
    rng: createRng(seed),
    structure,
    initialHp: totalHp(attacker.stacks),
    triggeredLoss: new Map(),
    triggeredHeal: new Map(),
  };

  let cleared = true;
  for (const index of fought) {
    if (!cleared) break;
    const wave = { stacks: waves[index].stacks, isFirst: index === fought[0], isFinal: index === fought.at(-1) };
    cleared = fightWave(battle, wave, reportWaves[index].rounds);
  }
  const victory = cleared && anyAlive(attacker.stacks);

  const roundsTotal = reportWaves.reduce((sum, wave) => sum + wave.rounds.length, 0);
  return { rulesVersion, seed, victory, roundsTotal, waves: reportWaves, initial, ...casualties(battle, victory) };
}
