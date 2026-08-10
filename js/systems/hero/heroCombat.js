import { eventBus } from '../../core/EventBus.js';
import {
  HEROES_CONFIG,
  SKILLS_CONFIG,
  AWAKENING_CONFIG,
  AURA_BUFF_CATEGORY,
} from '../../entities/GAME_DATA.js';

export class HeroCombat {
  constructor(hero) { this._h = hero; }

  /** auraValue = base·(1 + levelScale·(L−1) + perStarBonus·stars + skillAuraFrac). @see docs/superpowers/specs/2026-07-23-hero-economy-numbers.md §B */
  _auraValueFor(hero, cfg) {
    const base = cfg.aura?.value ?? 0;
    if (!base) return 0;

    let skillAuraFrac = 0;
    for (const skillId of (cfg.skills ?? [])) {
      const skill = SKILLS_CONFIG[skillId];
      if (!skill || skill.type !== 'passive' || skill.effect.stat !== 'auraValue') continue;
      const skillLvl = hero.skillLevels?.[skillId];
      if (skillLvl) {
        skillAuraFrac += AWAKENING_CONFIG.skillAuraFracBase + AWAKENING_CONFIG.skillAuraFracPerLevel * (skillLvl - 1);
      } else if ((hero.level ?? 1) >= skill.unlockLevel) {
        // Bridge until Phase 2 lands per-skill levels: fall back to the pre-Phase-1 flat gate.
        skillAuraFrac += skill.effect.value;
      }
    }

    const levelTerm = AWAKENING_CONFIG.levelScalePerLevel * ((hero.level ?? 1) - 1);
    const starTerm  = (AWAKENING_CONFIG.perStarAuraBonus ?? 0) * (hero.stars ?? 0);
    return base * (1 + levelTerm + starTerm + skillAuraFrac);
  }

  /** Aggregate aura bonuses for a squad's heroes plus HQ heroes (null squadId = all). */
  getCombatBonuses(squadId = null) {
    let attackMult    = 1.0;
    let defenseMult   = 1.0;
    let lossReduction = 0;
    let activeSkills  = []; // Active skill effects for CombatManager

    for (const hero of this._h._owned.values()) {
      const a = hero.assignment;
      // Squad heroes = barracks-assigned heroes (barracks_0 → squad_1, etc.)
      const isBarracks = a?.type === 'building' && a.buildingId?.startsWith('barracks_');
      const targetBarracks = squadId !== null ? this._h.barracksIdForSquad(squadId) : null;
      const isSquadHero = isBarracks && (targetBarracks === null || a.buildingId === targetBarracks);
      // HQ hero: actually stationed at a heroquarters building instance (not just configured for one)
      const isHQHero = a?.type === 'building' && a.buildingId?.replace(/_\d+$/, '') === 'heroquarters';
      if (!isSquadHero && !isHQHero) continue;
      const cfg = HEROES_CONFIG[hero.heroId];
      if (!cfg) continue;

      const auraValue = this._auraValueFor(hero, cfg);

      if (cfg.aura) {
        switch (cfg.aura.type) {
          case 'attack_boost':
          case 'magic_amplify':
          case 'crit_chance':   attackMult  += auraValue; break;
          case 'defense_boost': defenseMult += auraValue; break;
        }
        // defense_boost only gives lossReduction, not double-counted
        if (cfg.aura.type === 'defense_boost') lossReduction += auraValue * 0.5;
      }

      // Passive lossReduction from skills (iron_will, evasion, consecration)
      for (const skillId of (cfg.skills ?? [])) {
        const skill = SKILLS_CONFIG[skillId];
        if (!skill || skill.type !== 'passive') continue;
        if (hero.level < skill.unlockLevel) continue;
        if (skill.effect.stat === 'lossReduction') lossReduction += skill.effect.value;
      }

      // Passive attack/defense squad bonuses
      for (const skillId of (cfg.skills ?? [])) {
        const skill = SKILLS_CONFIG[skillId];
        if (!skill || skill.type !== 'passive') continue;
        if (hero.level < skill.unlockLevel) continue;
        if (skill.effect.stat === 'attack'  && skill.effect.scope === 'squad') attackMult  += skill.effect.value;
        if (skill.effect.stat === 'defense' && skill.effect.scope === 'squad') defenseMult += skill.effect.value;
      }

      // Collect active skills for combat system hooks
      for (const skillId of (cfg.skills ?? [])) {
        const skill = SKILLS_CONFIG[skillId];
        if (!skill || skill.type === 'passive') continue;
        if (hero.level < skill.unlockLevel) continue;
        activeSkills.push({ heroId: hero.heroId, skill });
      }
    }

    // Active production buffs
    const now      = Date.now();
    this._h._activeBuffs = this._h._activeBuffs.filter(b => b.endsAt > now);
    const buffMult = this._h._activeBuffs.reduce((acc, b) => acc + b.value, 0);

    return { attackMult, defenseMult, lossReduction, activeSkills, productionBuffMult: buffMult };
  }

  /** Hero aura bonuses by category (military/development/production) plus active timed buffs. */
  getCategorizedBonuses(barracksInstanceId = null) {
    const result = { military: [], development: [], production: [] };

    for (const hero of this._h._owned.values()) {
      const a = hero.assignment;
      const isBarracks = a?.type === 'building' && a.buildingId?.startsWith('barracks_');
      const isHQ = a?.type === 'building' && a.buildingId?.replace(/_\d+$/, '') === 'heroquarters';
      const inScope = (isBarracks && (barracksInstanceId === null || a.buildingId === barracksInstanceId)) || isHQ;
      if (!inScope) continue;

      const cfg = HEROES_CONFIG[hero.heroId];
      if (!cfg) continue;

      const auraValue = this._auraValueFor(hero, cfg);

      if (cfg.aura?.type) {
        const category = cfg.aura.buffCategory ?? AURA_BUFF_CATEGORY[cfg.aura.type] ?? 'military';
        if (result[category]) {
          result[category].push({
            heroId: hero.heroId, heroName: cfg.name, heroIcon: cfg.icon,
            classification: cfg.classification ?? 'combat',
            auraType: cfg.aura.type,
            auraLabel: cfg.aura.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            value: auraValue, level: hero.level, stars: hero.stars,
          });
        }
      }

      // Building bonus — only fires when hero is in their preferred building type
      const bb = cfg.buildingBonus;
      if (bb?.stat && a.buildingId?.replace(/_\d+$/, '') === bb.buildingType) {
        const bonusCategory = bb.buffCategory ?? 'development';
        if (result[bonusCategory]) {
          result[bonusCategory].push({
            heroId: hero.heroId, heroName: cfg.name, heroIcon: cfg.icon,
            classification: cfg.classification ?? 'combat',
            auraType: bb.stat, auraLabel: bb.label ?? bb.stat,
            value: hero.level * 0.05, level: hero.level, stars: hero.stars,
            isBuildingBonus: true,
          });
        }
      }
    }

    // Active timed buffs → production category
    const now = Date.now();
    for (const b of this._h._activeBuffs.filter(b => b.endsAt > now)) {
      result.production.push({
        heroId: null, heroName: 'Timed Buff', heroIcon: '⏱️',
        auraType: 'production_boost', auraLabel: 'Production Boost',
        value: b.value, endsAt: b.endsAt, remaining: b.endsAt - now, isTimedBuff: true,
      });
    }

    return result;
  }

  /** Activate a production buff. */
  activateBuff(buffCfg) {
    const endsAt = Date.now() + buffCfg.durationMs;
    this._h._activeBuffs.push({ value: buffCfg.value, endsAt, durationMs: buffCfg.durationMs });
    this._h._lastBuffCount = this._h._activeBuffs.length;
    eventBus.emit('buff:activated', { value: buffCfg.value, durationMs: buffCfg.durationMs });
    eventBus.emit('buffs:updated', this.getActiveBuffsWithRemaining());
    eventBus.emit('buffs:changed');
  }

  getActiveBuffs() { return this._h._activeBuffs.filter(b => b.endsAt > Date.now()); }

  /** Active buffs with a `remaining` (ms) and `endsAt` field for UI countdown. */
  getActiveBuffsWithRemaining() {
    const now = Date.now();
    return this._h._activeBuffs
      .filter(b => b.endsAt > now)
      .map(b => ({
        value:      b.value,
        endsAt:    b.endsAt,
        durationMs: b.durationMs ?? 3600000,
        remaining:  b.endsAt - now,
      }));
  }

  /** Sum of all active production buff values (e.g. 0.5 = +50%). */
  getActiveProductionMultiplier() {
    const now = Date.now();
    this._h._activeBuffs = this._h._activeBuffs.filter(b => b.endsAt > now);
    return this._h._activeBuffs.reduce((sum, b) => sum + b.value, 0);
  }
}
