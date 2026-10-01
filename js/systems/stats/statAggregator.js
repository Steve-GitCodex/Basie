import { STAT_RULES } from '../../entities/GAME_DATA.js';

const usable = (value, cap) => (Number.isFinite(value) ? Math.min(Math.max(value, 0), cap) : 0);

const STACKERS = {
  softcap: (values, cap) => cap * (1 - values.reduce((p, v) => p * (1 - v / cap), 1)),
  diminishing: (values, cap) => Math.min(cap, 1 - values.reduce((p, v) => p * (1 - v), 1)),
  additive: (values, cap) => Math.min(cap, values.reduce((s, v) => s + v, 0)),
};

export function statEntry(stat, category, value, sourceId) {
  return { stat, category, value, sourceId };
}

export function aggregate(stat, entries, rules = STAT_RULES) {
  const rule = rules[stat];
  if (!rule) throw new Error(`aggregate: unknown stat '${stat}'`);

  const grouped = {};
  for (const category of Object.keys(rule.categories)) grouped[category] = [];
  for (const entry of entries) {
    if (!grouped[entry.category]) {
      throw new Error(`aggregate: stat '${stat}' has no rule for category '${entry.category}'`);
    }
    grouped[entry.category].push(entry.value);
  }

  const byCategory = {};
  let remainder = 1;
  const nonZero = [];
  for (const [category, { stacking, cap }] of Object.entries(rule.categories)) {
    const values = grouped[category].map(v => usable(v, cap));
    const live = values.filter(v => v > 0);
    const value = live.length === 1 ? live[0] : live.length ? STACKERS[stacking](live, cap) : 0;
    byCategory[category] = { value, cap };
    remainder *= 1 - value;
    if (value > 0) nonZero.push(value);
  }
  const combined = nonZero.length === 1 ? nonZero[0] : 1 - remainder;
  return { total: Math.min(rule.totalCap, combined), byCategory };
}

export function mergeMaxBySource(map, entries) {
  for (const entry of entries) {
    const held = map.get(entry.sourceId);
    if (!held || entry.value > held.value) map.set(entry.sourceId, entry);
  }
}
