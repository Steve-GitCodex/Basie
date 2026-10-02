import { COMBAT_RULES } from '../../entities/data/combatRules.js';

const { COUNTERS, COUNTER_MULT, SIEGE_VS_STRUCTURE_MULT, VARIANCE } = COMBAT_RULES;

export function hitDamage(atk, def) {
  if (atk <= 0) return 0;
  return (atk * atk) / (atk + def);
}

export function counterMult(attackerType, targetType, { structure }) {
  if (attackerType === 'siege') return structure ? SIEGE_VS_STRUCTURE_MULT : 1;
  return COUNTERS[attackerType] === targetType ? COUNTER_MULT : 1;
}

export function varianceMult(rng) {
  return 1 - VARIANCE + rng.next() * 2 * VARIANCE;
}
