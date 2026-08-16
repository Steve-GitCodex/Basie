import { eventBus } from '../../core/EventBus.js';
import {
  HEROES_CONFIG,
  INVENTORY_ITEMS,
  SKILLS_CONFIG,
  AWAKENING_CONFIG,
  XP_CONFIG,
} from '../../entities/GAME_DATA.js';
import { reconcileSkillLevels, effectValueAt, isUnlocked, groupedSkillsFor } from './heroSkills.js';

export class HeroProgression {
  constructor(hero) {
    this._h = hero;
  }

  /** XP required to advance from `level` to `level + 1` for a given tier. */
  xpToNext(level, tier) {
    const tierMult = XP_CONFIG.tierMult[tier] ?? 1;
    return Math.round((XP_CONFIG.baseXpPerLevel + XP_CONFIG.xpPerLevelStep * (level - 1)) * tierMult);
  }

  /** Hero level cap, gated by Hero Quarters level. */
  levelCap() {
    return (this._h._bm?.getLevelOf('heroquarters') ?? 1) * XP_CONFIG.heroLevelCapPerHQLevel;
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

  /** Consume an XP card, granting its configured flat XP to the target hero. */
  applyXPCard(itemId, heroId) {
    const cfg = INVENTORY_ITEMS[itemId];
    if (!cfg || cfg.type !== 'xp_card') return { success: false, reason: 'Not an XP card.' };
    if (!this._h._inv.hasItem(itemId)) return { success: false, reason: 'No XP cards owned.' };
    const hero = this._h._owned.get(heroId);
    if (!hero) return { success: false, reason: 'Hero not in roster.' };
    this._h._inv.removeItem(itemId, 1);
    const xpAmount = cfg.xpValue ?? 0;
    this._applyXP(hero, HEROES_CONFIG[heroId], xpAmount);
    eventBus.emit('heroes:updated', this._h.getRosterWithState());
    return { success: true, xpAmount };
  }

  /** Skill configs for a hero grouped passive/support/major, annotated with level, unlock and cost state. */
  getSkillsForHero(heroId) {
    return groupedSkillsFor(heroId, this._h._owned.get(heroId));
  }

  /** Recalculate effectiveStats for a hero based on level, stars, and unlocked passives. */
  applySkillPassives(hero) {
    const cfg = HEROES_CONFIG[hero.heroId];
    if (!cfg) return;

    const starMult = 1 + (hero.stars ?? 0) * AWAKENING_CONFIG.perStarStatBonus;
    const ef = {
      hp:      Math.floor(cfg.stats.hp      * starMult),
      attack:  Math.floor(cfg.stats.attack  * starMult),
      defense: Math.floor(cfg.stats.defense * starMult),
      speed:   cfg.stats.speed,
    };

    const levels = reconcileSkillLevels(hero.heroId, hero.skillLevels);
    for (const skillId of (cfg.skills ?? [])) {
      const skill = SKILLS_CONFIG[skillId];
      if (!skill || skill.type !== 'passive' || !isUnlocked(skill, hero)) continue;
      const fx = skill.effect;
      const value = effectValueAt(skill, fx.value, levels[skillId]);
      if (fx.stat === 'attack' && fx.scope === 'squad') ef.attack = Math.floor(ef.attack * (1 + value));
      if (fx.stat === 'defense' && fx.scope === 'squad') ef.defense = Math.floor(ef.defense * (1 + value));
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
    const cap = this.levelCap();
    if (hero.level >= cap) return;

    hero.xp = (isFinite(hero.xp) ? hero.xp : 0) + safeAmount;
    while (hero.level < cap && hero.xp >= hero.xpToNext) {
      hero.xp -= hero.xpToNext;
      hero.level++;
      hero.xpToNext = this.xpToNext(hero.level, cfg.tier);
      this.applySkillPassives(hero);
      eventBus.emit('hero:levelUp', { heroId: hero.heroId, name: cfg.name, level: hero.level });
    }
    if (hero.level >= cap) hero.xp = 0;
  }
}
