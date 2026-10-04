import { COMBAT_RULES } from '../../entities/data/combatRules.js';

export function starsFor({ victory, sent, dead, wounded, rounds, roundPar }, rules = COMBAT_RULES.STAR_RULES) {
  if (!victory) return 0;
  const lossFraction = sent > 0 ? (dead + wounded) / sent : 0;
  if (sent <= 0 || lossFraction > rules.lossFraction) return 1;
  return rounds <= roundPar ? 3 : 2;
}
