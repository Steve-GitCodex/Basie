import { WORLD_MAP, INVENTORY_ITEMS } from '../../entities/GAME_DATA.js';

const RESOURCES = ['wood', 'stone', 'iron', 'food', 'water', 'money'];

const namesById = list => Object.fromEntries((list ?? []).map(x => [x.id, x.name]));

export function buildSnapshot(systems) {
  const rateBreakdowns = {};
  for (const r of RESOURCES) {
    const breakdown = systems.rm?.getRateBreakdown?.(r);
    if (breakdown) rateBreakdowns[r] = breakdown;
  }
  return {
    boosts: systems.buffs?.getBoosts() ?? [],
    worldBuffs: systems.worldMap?.activeBuffs() ?? [],
    techBonuses: systems.tech?.getAppliedBonuses() ?? {},
    vipPerks: systems.user?.getVipPerks() ?? {},
    vipTier: systems.user?.getVipTier() ?? 0,
    hqLevel: systems.bm?.getHQLevel() ?? 1,
    hqBenefits: systems.bm?.getHQBenefits() ?? {},
    heroEffects: systems.heroes?.getHeroGlobalEffects() ?? {},
    activeEvent: systems.events?.getPublicState().activeEvent ?? null,
    rateBreakdowns,
    regionNames: namesById(WORLD_MAP.regions),
    poiNames: namesById(WORLD_MAP.pois),
    itemNames: Object.fromEntries(Object.entries(INVENTORY_ITEMS).map(([id, cfg]) => [id, cfg.name ?? id])),
  };
}
