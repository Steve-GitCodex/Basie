import { COMBAT_RULES } from '../../entities/data/combatRules.js';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const MAX_TIER = COMBAT_RULES.MONSTER_TIERS.length;
const ELITE_REWARD_MULT = 1.5;
const REGULAR_MAX_WINS = 5;

export function lineupPower(waves) {
  let total = 0;
  for (const wave of waves) {
    for (const s of wave.stacks) total += s.count * (s.hp + 10 * s.attack);
  }
  return total;
}

const clone = (value) => structuredClone(value);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const scaleReward = (rewards, factor) =>
  Object.fromEntries(Object.entries(rewards).map(([k, v]) => [k, Math.max(1, Math.round(v * factor))]));

function assertTiers(waves, id) {
  for (const wave of waves) {
    for (const s of wave.stacks) {
      if (!Number.isInteger(s.tier) || s.tier < 1 || s.tier > MAX_TIER) {
        throw new Error(`Campaign stage ${id}: stack "${s.name}" has tier ${s.tier} outside 1-${MAX_TIER}`);
      }
    }
  }
}

function diamonds(knobs, kind, chapter) {
  const f = knobs.firstClearDiamonds;
  return Math.round(f[kind] * Math.pow(f.perChapter, chapter - 1));
}

function makeStage({ id, chapter, kind, index, monster, knobs, requires }) {
  return {
    id, chapter, kind, index,
    name: monster.name,
    icon: monster.icon,
    description: monster.description,
    monster,
    rewards: clone(monster.rewards),
    firstClear: { diamond: diamonds(knobs, kind, chapter) },
    roundPar: knobs.roundPar[kind],
    requires: requires ? clone(requires) : null,
  };
}

function regularMonster(id, boss, target, bossPower, i) {
  const waves = clone(boss.waves.length > 1 ? boss.waves.slice(0, -1) : boss.waves);
  const k = target / lineupPower(waves);
  for (const wave of waves) {
    for (const s of wave.stacks) s.count = Math.max(1, Math.round(s.count * k));
  }
  return {
    id,
    name: `${waves[0].name} ${ROMAN[i]}`,
    icon: boss.icon,
    description: `Outriders of the ${boss.name}.`,
    waves,
    rewards: scaleReward(boss.rewards, target / bossPower),
    maxRewardedWins: REGULAR_MAX_WINS,
  };
}

function eliteMonster(id, boss, knobs) {
  const waves = clone(boss.waves);
  for (const wave of waves) {
    for (const s of wave.stacks) {
      s.tier = Math.min(MAX_TIER, s.tier + knobs.eliteTierBump);
      s.count = Math.max(1, Math.round(s.count * knobs.eliteCountMult));
    }
  }
  return {
    id,
    name: `Elite ${boss.name}`,
    icon: boss.icon,
    description: boss.description,
    waves,
    rewards: scaleReward(boss.rewards, ELITE_REWARD_MULT),
    maxRewardedWins: boss.maxRewardedWins,
  };
}

function chapterStages(chapter, entry, boss, prevBoss, knobs) {
  const R = knobs.regularCount;
  if (R >= ROMAN.length) throw new Error(`regularCount ${R} exceeds supported ${ROMAN.length - 1}`);
  assertTiers(boss.waves, boss.id);
  const bossPower = lineupPower(boss.waves);
  const { from, to } = knobs.regularScale;
  const hi = to * bossPower;
  const floor = from * bossPower;
  const lo = prevBoss ? clamp(lineupPower(prevBoss.waves), floor, hi) : floor;
  const stages = [];
  for (let i = 1; i <= R; i++) {
    const target = R === 1 ? hi : lo + (hi - lo) * (i - 1) / (R - 1);
    const id = `ch${chapter}_s${i}`;
    stages.push(makeStage({
      id, chapter, kind: 'regular', index: i, knobs, requires: entry.requires,
      monster: regularMonster(id, boss, target, bossPower, i),
    }));
  }
  stages.push(makeStage({
    id: boss.id, chapter, kind: 'boss', index: 1, knobs, requires: entry.requires,
    monster: clone(boss),
  }));
  if (knobs.elite) {
    const id = `ch${chapter}_elite`;
    stages.push(makeStage({
      id, chapter, kind: 'elite', index: 1, knobs, requires: entry.requires,
      monster: eliteMonster(id, boss, knobs),
    }));
  }
  return stages;
}

export function buildCampaignStages(chapters, monsters, knobs, overrides = {}) {
  const stages = [];
  let prevBoss = null;
  chapters.forEach((entry, idx) => {
    const chapter = idx + 1;
    const boss = monsters[entry.monsterId];
    const chapterKnobs = { ...knobs, ...(overrides[chapter] ?? {}) };
    stages.push(...chapterStages(chapter, entry, boss, prevBoss, chapterKnobs));
    prevBoss = boss;
  });
  return Object.freeze(stages);
}
