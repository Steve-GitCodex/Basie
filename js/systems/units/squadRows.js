import { COMBAT_RULES } from '../../entities/data/combatRules.js';

export function defaultRowFor(unitId) {
  return COMBAT_RULES.DEFAULT_ROW[unitId] ?? 'front';
}

export function isValidRow(row) {
  return COMBAT_RULES.ROWS.includes(row);
}

const FALLBACK_ORDER = Object.freeze({
  front: ['front', 'mid', 'back'],
  mid: ['mid', 'back', 'front'],
  back: ['back', 'mid', 'front'],
});

export function assignSlotRows(slots, cap = COMBAT_RULES.ROW_SLOT_CAP) {
  const ordered = [...slots].sort((a, b) => a.slotIndex - b.slotIndex);
  const counts = { front: 0, mid: 0, back: 0 };
  const rows = new Map();
  for (const { slotIndex, stored } of ordered) {
    if (isValidRow(stored) && counts[stored] < cap) {
      rows.set(slotIndex, stored);
      counts[stored]++;
    }
  }
  for (const { slotIndex, unitId } of ordered) {
    if (rows.has(slotIndex)) continue;
    const order = FALLBACK_ORDER[defaultRowFor(unitId)];
    const row = order.find(candidate => counts[candidate] < cap) ?? order[0];
    rows.set(slotIndex, row);
    counts[row]++;
  }
  return rows;
}

export function occupiedSlots(slotUnits, slotRows, unitIdOf) {
  return [...slotUnits.entries()]
    .filter(([, entry]) => entry.count > 0)
    .map(([slotIndex, entry]) => ({ slotIndex, unitId: unitIdOf(entry.tierKey), stored: slotRows.get(slotIndex) }));
}

export function resolveSquadRows(slotUnits, slotRows, unitIdOf) {
  const assigned = assignSlotRows(occupiedSlots(slotUnits, slotRows, unitIdOf));
  const rows = new Map();
  const slots = [...slotUnits.entries()].sort((a, b) => a[0] - b[0]);
  for (const [slotIndex, entry] of slots) {
    if (entry.count <= 0 || rows.has(entry.tierKey)) continue;
    rows.set(entry.tierKey, assigned.get(slotIndex));
  }
  return rows;
}

export function acceptedStoredRows(slotUnits, slotRows, unitIdOf) {
  const occupied = occupiedSlots(slotUnits, slotRows, unitIdOf);
  const assigned = assignSlotRows(occupied);
  const kept = new Map(slotRows);
  for (const { slotIndex, stored } of occupied) {
    if (stored !== undefined && assigned.get(slotIndex) !== stored) kept.delete(slotIndex);
  }
  return kept;
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
