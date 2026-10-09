import { XP_CONFIG } from '../../entities/GAME_DATA.js';

export function xpToNext(level, tier) {
  const tierMult = XP_CONFIG.tierMult[tier] ?? 1;
  return Math.round((XP_CONFIG.baseXpPerLevel + XP_CONFIG.xpPerLevelStep * (level - 1)) * tierMult);
}

export function project({ level, xp, tier, cap }, addXp) {
  if (level >= cap) return { level, xp: 0, wasted: Math.max(0, addXp) };
  let lv = level;
  let pool = xp + addXp;
  while (lv < cap && pool >= xpToNext(lv, tier)) {
    pool -= xpToNext(lv, tier);
    lv++;
  }
  if (lv >= cap) return { level: lv, xp: 0, wasted: pool };
  return { level: lv, xp: pool, wasted: 0 };
}

export function xpNeeded({ level, xp, tier }, targetLevel) {
  let total = -xp;
  for (let lv = level; lv < targetLevel; lv++) total += xpToNext(lv, tier);
  return Math.max(0, total);
}

export function autoPick(items, need) {
  if (!(need > 0)) return {};
  const pool = items.filter((i) => !i.fragment && i.owned > 0 && i.xp > 0).sort((a, b) => b.xp - a.xp);
  const picked = {};
  let left = need;
  for (const item of pool) {
    const qty = Math.min(item.owned, Math.floor(left / item.xp));
    if (qty <= 0) continue;
    picked[item.id] = qty;
    left -= qty * item.xp;
  }
  if (left > 0) {
    const spare = [...pool].reverse().find((i) => (picked[i.id] ?? 0) < i.owned);
    if (spare) picked[spare.id] = (picked[spare.id] ?? 0) + 1;
  }
  return picked;
}
