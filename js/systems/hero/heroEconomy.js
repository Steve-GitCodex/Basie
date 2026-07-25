import { eventBus } from '../../core/EventBus.js';
import { HEROES_CONFIG, PROD_BONUS_CONFIG } from '../../entities/GAME_DATA.js';

const RESOURCE_OUTPUT_EFFECTS = new Set(['money', 'food', 'wood', 'stone', 'iron']);

export class HeroEconomy {
  constructor(hero) { this._h = hero; }

  /** Resource/speed-keyed bonus map for all building-stationed heroes, e.g. { iron: 0.18 }.
   * @see docs/superpowers/specs/2026-07-23-hero-economy-numbers.md §I */
  getBuildingProductionBonusMap() {
    const bonuses = {};
    for (const h of this._h._owned.values()) {
      if (h.assignment?.type !== 'building') continue;
      const cfg = HEROES_CONFIG[h.heroId];
      const bb  = cfg?.buildingBonus;
      if (!bb?.stat) continue;
      const buildingType = h.assignment.buildingId?.replace(/_\d+$/, '');
      if (buildingType !== bb.buildingType) continue;

      const entry = PROD_BONUS_CONFIG.statEffectMap[buildingType];
      if (!entry || entry.stat !== bb.stat) continue;

      const base = RESOURCE_OUTPUT_EFFECTS.has(entry.effect)
        ? PROD_BONUS_CONFIG.base.resourceOutput
        : PROD_BONUS_CONFIG.base[entry.effect];
      if (base == null) continue;

      const starMult  = 1 + PROD_BONUS_CONFIG.starBonusPerStar * (h.stars ?? 0);
      const levelMult = 1 + PROD_BONUS_CONFIG.levelScalePerLevel * ((h.level ?? 1) - 1);
      bonuses[entry.effect] = (bonuses[entry.effect] ?? 0) + base * starMult * levelMult;
    }
    return bonuses;
  }
}
