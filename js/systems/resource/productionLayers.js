import { economicBonus } from '../world/regionBuffs.js';

export const RESOURCE_TECH_KEY = { iron: 'ironBonus', wood: 'woodBonus', stone: 'stoneBonus', water: 'waterBonus' };

const COMPOUNDING_KINDS = new Set(['difficulty', 'event']);

function worldEntries(worldBuffs, resource) {
  if (economicBonus(worldBuffs, resource) <= 0) return [];
  return worldBuffs
    .filter(b => b.flavor === 'economic' && b.resource === resource)
    .map(b => ({ label: b.label ?? b.name ?? 'Territory', pct: b.pct ?? 0, endsAt: b.expiresAt ?? null }));
}

export function productionLayers(resource, inputs) {
  const { techBonuses, worldBuffs, hqBonus, boost, vipPct, difficultyMult, eventModifiers } = inputs;
  const techPct = techBonuses[RESOURCE_TECH_KEY[resource]];
  const layers = [
    { kind: 'tech', entries: techPct ? [{ label: 'Technology', pct: techPct, endsAt: null }] : [] },
    { kind: 'world', entries: worldEntries(worldBuffs, resource) },
    { kind: 'hq', entries: hqBonus > 0 ? [{ label: 'Headquarters', pct: hqBonus, endsAt: null }] : [] },
    { kind: 'item', entries: boost && boost.pct > 0 ? [{ label: boost.label, pct: boost.pct, endsAt: boost.endsAt ?? null }] : [] },
    { kind: 'vip', entries: vipPct > 0 ? [{ label: 'VIP', pct: vipPct, endsAt: null }] : [] },
    { kind: 'difficulty', entries: difficultyMult !== 1 ? [{ label: 'Difficulty', pct: difficultyMult - 1, endsAt: null }] : [] },
    {
      kind: 'event',
      entries: eventModifiers
        .filter(m => m.resourceType === resource)
        .map(m => ({ label: m.label, pct: m.multiplier - 1, endsAt: m.endsAt ?? null })),
    },
  ];
  return layers.filter(l => l.entries.length > 0);
}

export function layerMultiplier(layers) {
  return layers.reduce((product, layer) => {
    if (COMPOUNDING_KINDS.has(layer.kind)) {
      return layer.entries.reduce((p, e) => p * (1 + e.pct), product);
    }
    return product * (1 + layer.entries.reduce((sum, e) => sum + e.pct, 0));
  }, 1);
}
