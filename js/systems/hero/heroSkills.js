import { SKILLS_CONFIG, HEROES_CONFIG } from '../../entities/GAME_DATA.js';

export const SKILL_LEVEL_CAP = 10;
export const MAJOR_SKILL_LEVEL_CAP = 5;
export const MAJOR_SKILL_COSTS = [5, 8, 12, 18, 25];
export const MAJOR_SKILL_STAR_GATE = 5;

const PASSIVE_SCALE_PER_LEVEL = 0.15;
const SUPPORT_SCALE_PER_LEVEL = 0.10;

export function shardCostForSkillLevel(level) {
  if (!Number.isInteger(level) || level < 2 || level > SKILL_LEVEL_CAP) return 0;
  return Math.ceil(level / 2);
}

export function majorSkillCost(level) {
  if (!Number.isInteger(level) || level < 1 || level > MAJOR_SKILL_LEVEL_CAP) return 0;
  return MAJOR_SKILL_COSTS[level - 1];
}

export function levelCapFor(skill) {
  return skill?.type === 'major' ? MAJOR_SKILL_LEVEL_CAP : SKILL_LEVEL_CAP;
}

export function defaultLevelFor(skill) {
  return skill?.type === 'major' ? 0 : 1;
}

export function costToReach(skill, level) {
  return skill?.type === 'major' ? majorSkillCost(level) : shardCostForSkillLevel(level);
}

export function effectValueAt(skill, base, level) {
  if (!skill || !base) return 0;
  if (skill.type === 'major') return base;
  const step = skill.type === 'support' ? SUPPORT_SCALE_PER_LEVEL : PASSIVE_SCALE_PER_LEVEL;
  return base * (1 + step * (Math.max(1, level ?? 1) - 1));
}

export function reconcileSkillLevels(heroId, stored) {
  const ids = HEROES_CONFIG[heroId]?.skills ?? [];
  const out = {};
  for (const id of ids) {
    const skill = SKILLS_CONFIG[id];
    if (!skill) continue;
    const cap = levelCapFor(skill);
    const raw = Number(stored?.[id]);
    const lvl = Number.isFinite(raw) ? Math.floor(raw) : defaultLevelFor(skill);
    out[id] = Math.min(cap, Math.max(defaultLevelFor(skill), lvl));
  }
  return out;
}

export function isUnlocked(skill, hero) {
  if (!skill) return false;
  if (skill.type === 'major') return (hero?.stars ?? 0) >= MAJOR_SKILL_STAR_GATE;
  return (hero?.level ?? 1) >= skill.unlockLevel;
}

export function collectEffects(hero, { trigger = null } = {}) {
  const out = {
    attackMult: 0, defenseMult: 0, lossReduction: 0,
    postBattleHeal: 0, auraFrac: 0, triggered: [],
  };
  const heroId = hero?.heroId;
  const levels = reconcileSkillLevels(heroId, hero?.skillLevels);

  for (const id of (HEROES_CONFIG[heroId]?.skills ?? [])) {
    const skill = SKILLS_CONFIG[id];
    if (!skill || !isUnlocked(skill, hero)) continue;
    const level = levels[id];
    if (skill.type === 'major' && level < 1) continue;

    const fx = skill.effect ?? {};
    if (fx.trigger) {
      if (trigger === null || fx.trigger === trigger) out.triggered.push({ heroId, skill, level });
      continue;
    }
    const scaled = v => effectValueAt(skill, v, level);
    if (fx.stat === 'auraValue')      out.auraFrac       += scaled(fx.value);
    if (fx.stat === 'lossReduction')  out.lossReduction  += scaled(fx.value);
    if (fx.stat === 'attack'  && fx.scope === 'squad') out.attackMult  += scaled(fx.value);
    if (fx.stat === 'defense' && fx.scope === 'squad') out.defenseMult += scaled(fx.value);
    if (fx.postBattleHeal)            out.postBattleHeal += scaled(fx.postBattleHeal);
  }
  return out;
}

export function groupedSkillsFor(heroId, hero) {
  const groups = { passive: [], support: [], major: [] };
  const levels = reconcileSkillLevels(heroId, hero?.skillLevels);
  for (const id of (HEROES_CONFIG[heroId]?.skills ?? [])) {
    const skill = SKILLS_CONFIG[id];
    if (!skill || !groups[skill.type]) continue;
    const level = levels[id];
    const cap   = levelCapFor(skill);
    groups[skill.type].push({
      ...skill,
      level,
      unlocked: isUnlocked(skill, hero),
      atCap:    level >= cap,
      nextCost: costToReach(skill, level + 1),
    });
  }
  for (const key of Object.keys(groups)) groups[key].sort((a, b) => a.slot - b.slot);
  return groups;
}
