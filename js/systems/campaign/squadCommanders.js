import { HEROES_CONFIG, SKILLS_CONFIG } from '../../entities/GAME_DATA.js';
import { reconcileSkillLevels, effectValueAt, isUnlocked, collectEffects } from '../hero/heroSkills.js';
import { auraValueFor } from '../hero/heroCombat.js';

const TRIGGER_WORDS = {
  battle_start: 'Start',
  wave_start: 'Each wave',
  final_wave: 'Final wave',
  losing: 'Losing',
};

const AURA_TEXT = {
  attack_boost: v => `+${v}% atk aura`,
  magic_amplify: v => `+${v}% atk aura`,
  crit_chance: v => `+${v}% atk aura (crit)`,
  defense_boost: v => `+${v}% def aura`,
};

const pct = value => Math.round(value * 100);

function auraChip(entry) {
  const cfg = HEROES_CONFIG[entry.heroId];
  const format = AURA_TEXT[cfg?.aura?.type];
  if (!format) return null;
  return format(pct(auraValueFor(entry, cfg, collectEffects(entry).auraFrac)));
}

function unlockedSkills(entry) {
  const cfg = HEROES_CONFIG[entry.heroId];
  const levels = reconcileSkillLevels(entry.heroId, entry.skillLevels);
  return (cfg?.skills ?? [])
    .map(id => ({ skill: SKILLS_CONFIG[id], level: levels[id] }))
    .filter(({ skill, level }) => skill && isUnlocked(skill, entry) && !(skill.type === 'major' && level < 1));
}

function auraChips(entry) {
  const chips = [auraChip(entry)].filter(Boolean);
  for (const { skill, level } of unlockedSkills(entry)) {
    const fx = skill.effect ?? {};
    if (fx.trigger || fx.scope !== 'squad' || (fx.stat !== 'attack' && fx.stat !== 'defense')) continue;
    chips.push(`${skill.name} +${pct(effectValueAt(skill, fx.value, level))}%`);
  }
  return chips;
}

function triggerChips(entry) {
  return unlockedSkills(entry)
    .filter(({ skill }) => TRIGGER_WORDS[skill.effect?.trigger])
    .map(({ skill }) => `${TRIGGER_WORDS[skill.effect.trigger]}: ${skill.name}`);
}

function heroCard(entry) {
  const cfg = HEROES_CONFIG[entry.heroId];
  return {
    heroId: entry.heroId, name: cfg?.name ?? entry.heroId, icon: cfg?.icon ?? '',
    rarity: cfg?.tier ?? 'normal', level: entry.level,
  };
}

export function squadCommanders({ slots, squadHeroes, supportHeroes, bonuses }) {
  return {
    slots: slots.map(slot => {
      const entry = squadHeroes.find(h => h.slotIndex === slot.slotIndex);
      return {
        ...slot,
        hero: entry ? heroCard(entry) : null,
        auras: entry ? auraChips(entry) : [],
        triggers: entry ? triggerChips(entry) : [],
      };
    }),
    support: supportHeroes.map(entry => ({
      heroId: entry.heroId,
      name: HEROES_CONFIG[entry.heroId]?.name ?? entry.heroId,
      text: auraChip(entry),
    })),
    totals: {
      attackPct: pct(bonuses.attackMult - 1),
      defensePct: pct(bonuses.defenseMult - 1 + bonuses.baseDefense),
      strikesPerRound: bonuses.strikers.length,
    },
  };
}
