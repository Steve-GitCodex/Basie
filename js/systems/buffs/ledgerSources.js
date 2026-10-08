import { worldBuffStat } from './worldBuffStat.js';

const RESOURCES = ['wood', 'stone', 'iron', 'water'];

const entry = (sourceKind, sourceId, label, stat, pct, startedAt = null, endsAt = null) =>
  ({ sourceKind, sourceId, label, stat, pct, startedAt, endsAt });

const fromMap = (kind, label, values, mapping) => {
  const out = [];
  for (const [key, stat] of mapping) {
    const pct = values?.[key] ?? 0;
    if (pct) out.push(entry(kind, key, label, stat, pct));
  }
  return out;
};

export function fromBoosts(snap) {
  return (snap.boosts ?? []).filter(b => b.value).map(b =>
    entry('item', b.itemId, snap.itemNames?.[b.itemId] ?? b.itemId, b.stat, b.value, b.startedAt ?? null, b.endsAt ?? null));
}

export function fromWorld(snap) {
  const out = [];
  for (const b of snap.worldBuffs ?? []) {
    if (!b.pct) continue;
    const stat = worldBuffStat(b);
    if (b.regionId) out.push(entry('region', b.regionId, snap.regionNames?.[b.regionId] ?? b.regionId, stat, b.pct));
    else if (b.poiId) out.push(entry('outpost', b.poiId, snap.poiNames?.[b.poiId] ?? b.poiId, stat, b.pct));
    else if (b.expiresAt) out.push(entry('expedition', 'expedition', 'Expedition', stat, b.pct, b.grantedAt ?? null, b.expiresAt));
  }
  return out;
}

export function fromTech(snap) {
  return fromMap('tech', 'Technology', snap.techBonuses, [
    ['attackBonus', 'troop.attack'],
    ['buildTimeReduction', 'build.speed'],
    ...RESOURCES.map(r => [`${r}Bonus`, `production.${r}`]),
  ]);
}

export function fromVip(snap) {
  return fromMap('vip', `VIP ${snap.vipTier ?? 0}`, snap.vipPerks, [
    ['productionBonus', 'production.all'],
    ['buildTimeReduction', 'build.speed'],
    ['researchReduction', 'research.speed'],
    ['trainReduction', 'train.speed'],
  ]);
}

export function fromHq(snap) {
  return fromMap('hq', `HQ level ${snap.hqLevel ?? 1}`, snap.hqBenefits, [
    ['productionBonus', 'production.all'],
    ['attackBonus', 'troop.attack'],
    ['defenseBonus', 'troop.defense'],
  ]);
}

export function fromHeroes(snap) {
  return fromMap('hero', 'Heroes', snap.heroEffects, [
    ['buildSpeed', 'build.speed'],
    ['researchSpeed', 'research.speed'],
    ['trainingSpeed', 'train.speed'],
  ]);
}

export function fromEvents(snap) {
  const ev = snap.activeEvent;
  if (!ev) return [];
  return Object.entries(ev.effects ?? {})
    .filter(([, m]) => m !== 1)
    .map(([res, m]) => entry('event', ev.id, ev.name, `production.${res}`, m - 1, ev.startTs ?? null, ev.endTs ?? null));
}
