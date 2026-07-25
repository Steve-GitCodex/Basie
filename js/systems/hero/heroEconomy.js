import { eventBus } from '../../core/EventBus.js';
import { HEROES_CONFIG } from '../../entities/GAME_DATA.js';

export class HeroEconomy {
  constructor(hero) { this._h = hero; }

  /** Resource-keyed bonus map for all building-stationed heroes, e.g. { money: 0.25 }. */
  getBuildingProductionBonusMap() {
    const bonuses = {};
    for (const h of this._h._owned.values()) {
      if (h.assignment?.type !== 'building') continue;
      const cfg = HEROES_CONFIG[h.heroId];
      const bb  = cfg?.buildingBonus;
      if (!bb?.stat) continue;
      if (h.assignment.buildingId?.replace(/_\d+$/, '') !== bb.buildingType) continue;
      const resourceKey = { gold_production: 'money' }[bb.stat];
      if (!resourceKey) continue; // training_speed, mana_production, defense handled elsewhere
      const levelMult = 1 + (h.level - 1) * 0.02; // +2% per hero level
      bonuses[resourceKey] = (bonuses[resourceKey] ?? 0) + (bb.value ?? 0.15) * levelMult;
    }
    return bonuses;
  }
}
