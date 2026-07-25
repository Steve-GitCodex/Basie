import { eventBus } from '../../core/EventBus.js';
import {
  HEROES_CONFIG,
  INVENTORY_ITEMS,
  SKILLS_CONFIG,
  AWAKENING_CONFIG,
} from '../../entities/GAME_DATA.js';

export class HeroProgression {
  constructor(hero) {
    this._h = hero;
  }

  /** Convert a hero fragment to XP on the target hero */
  useFragmentAsXP(fragmentItemId, heroId) {
    const cfg = INVENTORY_ITEMS[fragmentItemId];
    if (!cfg || cfg.type !== 'hero_fragment') return { success: false, reason: 'Not a fragment.' };
    if (!this._h._inv.hasItem(fragmentItemId)) return { success: false, reason: 'No fragments owned.' };
    const hero = this._h._owned.get(heroId);
    if (!hero) return { success: false, reason: 'Hero not in roster.' };
    this._h._inv.removeItem(fragmentItemId, 1);
    this._applyXP(hero, HEROES_CONFIG[heroId], cfg.xpValue ?? 50);
    eventBus.emit('heroes:updated', this._h.getRosterWithState());
    return { success: true, xpAmount: cfg.xpValue ?? 50 };
  }

  /** Get skill configs for a hero annotated with unlock state. */
  getSkillsForHero(heroId) {
    const heroCfg = HEROES_CONFIG[heroId];
    const hero    = this._h._owned.get(heroId);
    if (!heroCfg) return [];
    const level = hero?.level ?? 0;
    return (heroCfg.skills ?? []).map(skillId => {
      const skill = SKILLS_CONFIG[skillId];
      if (!skill) return { id: skillId, name: skillId, unlocked: false };
      return { ...skill, unlocked: level >= skill.unlockLevel };
    });
  }

  /** Recalculate effectiveStats for a hero based on level, stars, and unlocked passives. */
  applySkillPassives(hero) {
    const cfg = HEROES_CONFIG[hero.heroId];
    if (!cfg) return;

    const starMult = 1 + (hero.stars ?? 0) * AWAKENING_CONFIG.perStarBonus.statMultiplier;
    const ef = {
      hp:      Math.floor(cfg.stats.hp      * starMult),
      attack:  Math.floor(cfg.stats.attack  * starMult),
      defense: Math.floor(cfg.stats.defense * starMult),
      speed:   cfg.stats.speed,
    };

    for (const skillId of (cfg.skills ?? [])) {
      const skill = SKILLS_CONFIG[skillId];
      if (!skill || skill.type !== 'passive') continue;
      if (hero.level < skill.unlockLevel) continue;
      const fx = skill.effect;
      if (fx.stat === 'attack' && fx.scope === 'squad') ef.attack = Math.floor(ef.attack * (1 + fx.value));
      if (fx.stat === 'defense' && fx.scope === 'squad') ef.defense = Math.floor(ef.defense * (1 + fx.value));
    }

    hero.effectiveStats = ef;
  }

  /** Grant XP to a single hero (e.g. from XP bundles or reward events). */
  awardHeroXP(heroId, amount) {
    const hero = this._h._owned.get(heroId);
    if (!hero) return { success: false, reason: 'Hero not in roster.' };
    this._applyXP(hero, HEROES_CONFIG[heroId], amount);
    eventBus.emit('heroes:updated', this._h.getRosterWithState());
    return { success: true };
  }

  /** Purchase and immediately apply an XP bundle to a hero using gold. */
  purchaseXPBundle(heroId, bundleId) {
    const hero = this._h._owned.get(heroId);
    if (!hero) return { success: false, reason: 'Hero not in roster.' };

    const bundle = INVENTORY_ITEMS[bundleId];
    if (!bundle || bundle.type !== 'xp_bundle') return { success: false, reason: 'Invalid XP bundle.' };

    const cost = { gold: bundle.goldCost };
    if (!this._h._rm.canAfford(cost)) {
      return { success: false, reason: `Not enough gold. Need ${bundle.goldCost}g.` };
    }

    this._h._rm.spend(cost);
    this._applyXP(hero, HEROES_CONFIG[heroId], bundle.xpAmount);
    eventBus.emit('heroes:updated', this._h.getRosterWithState());
    return { success: true };
  }

  /** Award battle XP to heroes assigned to a specific squad (and HQ heroes). */
  awardBattleXP(amount, squadId) {
    const targetBarracks = squadId ? this._h.barracksIdForSquad(squadId) : null;
    for (const hero of this._h._owned.values()) {
      const a = hero.assignment;
      if (a?.type !== 'building' || !a.buildingId?.startsWith('barracks_')) continue;
      if (targetBarracks && a.buildingId !== targetBarracks) continue;
      this._applyXP(hero, HEROES_CONFIG[hero.heroId], amount);
    }
    eventBus.emit('heroes:updated', this._h.getRosterWithState());
  }

  /** @private */
  _applyXP(hero, cfg, amount) {
    const safeAmount = Number(amount);
    if (!isFinite(safeAmount) || safeAmount <= 0) return;
    hero.xp = (isFinite(hero.xp) ? hero.xp : 0) + safeAmount;
    while (hero.xp >= hero.xpToNext) {
      hero.xp -= hero.xpToNext;
      hero.level++;
      hero.xpToNext = Math.floor((cfg.xpPerLevel ?? 500) * Math.pow(1.3, hero.level - 1));
      this.applySkillPassives(hero);
      eventBus.emit('hero:levelUp', { heroId: hero.heroId, name: cfg.name, level: hero.level });
    }
  }
}
