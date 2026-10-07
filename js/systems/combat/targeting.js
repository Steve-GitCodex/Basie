import { COMBAT_RULES } from '../../entities/data/combatRules.js';
import { hitDamage, counterMult } from './hitMath.js';

const { ROWS, TIER_TARGET_WEIGHT } = COMBAT_RULES;

const isAlive = (stack) => stack.count > 0;

export function livingInRow(stacks, row) {
  return stacks.filter((stack) => stack.row === row && isAlive(stack));
}

export function frontRow(stacks) {
  return ROWS.find((row) => livingInRow(stacks, row).length > 0) ?? null;
}

export function allocate(attackerCount, targets) {
  const weights = targets.map((t) => t.count * TIER_TARGET_WEIGHT[t.tier - 1]);
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return weights.map(() => 0);
  return weights.map((w) => (attackerCount * w) / total);
}

export function applyDamage(stack, damage) {
  const previousCount = stack.count;
  const overflow = Math.max(0, damage - stack.hpPool);
  stack.hpPool = Math.max(0, stack.hpPool - damage);
  stack.count = Math.ceil(stack.hpPool / stack.hp);
  return { kills: previousCount - stack.count, overflow };
}

export function strikeRow({ attacker, mult, targets, structure }) {
  const hits = new Map();
  const credit = (target, damage) => {
    const hit = hits.get(target) ?? { targetId: target.id, damage: 0, kills: 0 };
    hit.damage += Math.min(damage, target.hpPool);
    const result = applyDamage(target, damage);
    hit.kills += result.kills;
    hits.set(target, hit);
    return result.overflow;
  };
  const shares = allocate(attacker.count, targets);
  let overflow = 0;
  targets.forEach((target, i) => {
    const perHit = hitDamage(attacker.attack, target.defense) * counterMult(attacker.type, target.type, { structure });
    overflow += credit(target, shares[i] * perHit * mult);
  });
  const survivors = targets.filter(isAlive);
  if (overflow > 0 && survivors.length > 0) {
    const spill = allocate(overflow, survivors);
    survivors.forEach((target, i) => credit(target, spill[i]));
  }
  const merged = [...hits.values()];
  return { kills: merged.reduce((sum, hit) => sum + hit.kills, 0), hits: merged };
}
