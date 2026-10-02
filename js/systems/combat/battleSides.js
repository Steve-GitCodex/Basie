import { COMBAT_RULES } from '../../entities/data/combatRules.js';
import { UNITS_CONFIG } from '../../entities/GAME_DATA.js';
import { statEntry } from '../stats/statAggregator.js';

const { DEFAULT_ROW, ROWS, MONSTER_TIERS } = COMBAT_RULES;

const byRowThenKey = (a, b) => {
  const rowDelta = ROWS.indexOf(a.row) - ROWS.indexOf(b.row);
  if (rowDelta !== 0) return rowDelta;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
};

function playerStack(entry, slotRows, bonuses) {
  const { tech, hq, hero, milMult, modifier } = bonuses;
  const tierCfg = UNITS_CONFIG[entry.unitId].tiers[entry.tier - 1];
  const base = tierCfg.stats;
  const type = entry.unitId;
  const hp = base.hp * (1 + (tech.hpBonus || 0)) * (modifier?.playerHpMult ?? 1);
  return {
    id: entry.tierKey,
    tierKey: entry.tierKey,
    label: tierCfg.name,
    type,
    tier: entry.tier,
    row: slotRows.get(entry.tierKey) ?? DEFAULT_ROW[type],
    count: entry.count,
    startCount: entry.count,
    hp,
    attack: base.attack * (1 + (tech.attackBonus || 0)) * (hero.attackMult ?? 1)
      * (1 + (hq.attackBonus || 0)) * milMult * (modifier?.playerAttackMult ?? 1),
    defense: (base.defense + (tech.defenseBonus || 0)) * (hero.defenseMult ?? 1)
      * (1 + (hero.baseDefense || 0)) * (1 + (hq.defenseBonus || 0)),
    hpPool: entry.count * hp,
  };
}

export function squadSide({ units, slotRows, heroBonus, tech = {}, hq = {}, milMult = 1, modifier = null }) {
  const bonuses = { tech, hq, hero: heroBonus, milMult, modifier };
  const stacks = units
    .filter((entry) => entry.count > 0)
    .map((entry) => playerStack(entry, slotRows ?? new Map(), bonuses))
    .sort(byRowThenKey);
  return {
    stacks,
    strikers: heroBonus.strikers ?? [],
    triggers: heroBonus.triggeredByEvent,
    lossEntries: [
      ...heroBonus.statEntries.lossReduction,
      statEntry('lossReduction', 'tech', tech.lossReduction || 0, 'tech'),
    ],
    healEntries: heroBonus.statEntries.postBattleHeal,
    firstWaveBonus: tech.firstWaveBonus || 0,
  };
}

function monsterStack(raw, waveIdx, stackIdx, difficulty, modifier) {
  const stack = modifier?.waveTransform ? modifier.waveTransform(raw) : raw;
  const hp = Math.round(stack.hp * difficulty.enemyHpMult);
  const built = {
    id: `${waveIdx}:${stackIdx}`,
    label: stack.name,
    type: stack.type,
    tier: stack.tier,
    row: stack.row,
    count: stack.count,
    startCount: stack.count,
    hp,
    attack: Math.round(stack.attack * difficulty.enemyAtkMult),
    defense: stack.defense ?? MONSTER_TIERS[stack.tier - 1].defense,
    hpPool: stack.count * hp,
  };
  if (stack.specialAbility) built.ability = { kind: stack.specialAbility, value: stack.abilityValue };
  return built;
}

export function encounterSide(monster, { difficulty, modifier = null }) {
  return {
    waves: monster.waves.map((wave, waveIdx) => ({
      name: wave.name,
      stacks: wave.stacks.map((stack, stackIdx) => monsterStack(stack, waveIdx, stackIdx, difficulty, modifier)),
    })),
  };
}
