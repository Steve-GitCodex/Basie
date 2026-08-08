import { resourceBonusFor, globalEffectBonus } from './heroProductionBonus.js';

export class HeroEconomy {
  constructor(hero) { this._h = hero; }

  /** @see docs/superpowers/specs/2026-07-23-hero-economy-numbers.md §I */
  getInstanceBonus(instanceId) {
    const hero = this._h.getBuildingHero(instanceId);
    if (!hero) return 0;
    return resourceBonusFor(hero, instanceId.replace(/_\d+$/, ''));
  }

  getGlobalEffectMap() {
    return globalEffectBonus([...this._h._owned.values()]);
  }
}
