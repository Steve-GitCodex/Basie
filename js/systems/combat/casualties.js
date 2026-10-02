import { COMBAT_RULES } from '../../entities/data/combatRules.js';

const { WOUNDED_SHARE } = COMBAT_RULES;

export function splitCasualties({ fallen, victory, lossReduction, postBattleHeal }) {
  const baseShare = victory ? WOUNDED_SHARE.victory : WOUNDED_SHARE.defeat;
  const woundedShare = baseShare + lossReduction * (1 - baseShare);
  const healed = {};
  const wounded = {};
  const dead = {};
  for (const tierKey of Object.keys(fallen)) {
    const healedCount = victory ? Math.floor(fallen[tierKey] * postBattleHeal) : 0;
    const remaining = fallen[tierKey] - healedCount;
    const woundedCount = Math.floor(remaining * woundedShare);
    const deadCount = remaining - woundedCount;
    if (healedCount > 0) healed[tierKey] = healedCount;
    if (woundedCount > 0) wounded[tierKey] = woundedCount;
    if (deadCount > 0) dead[tierKey] = deadCount;
  }
  return { healed, wounded, dead };
}
