import { COMBAT_RULES } from '../../entities/data/combatRules.js';

export function defaultRowFor(unitId) {
  return COMBAT_RULES.DEFAULT_ROW[unitId] ?? 'front';
}

export function isValidRow(row) {
  return COMBAT_RULES.ROWS.includes(row);
}

export function resolveSquadRows(slotUnits, slotRows, unitIdOf) {
  const rows = new Map();
  const slots = [...slotUnits.entries()].sort((a, b) => a[0] - b[0]);
  for (const [slotIndex, entry] of slots) {
    if (entry.count <= 0 || rows.has(entry.tierKey)) continue;
    rows.set(entry.tierKey, slotRows.get(slotIndex) ?? defaultRowFor(unitIdOf(entry.tierKey)));
  }
  return rows;
}

export function serializeSlotRows(slotRows) {
  return Object.fromEntries([...slotRows].map(([k, v]) => [String(k), v]));
}

export function deserializeSlotRows(obj) {
  const rows = new Map();
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (isValidRow(v)) rows.set(Number(k), v);
  }
  return rows;
}
