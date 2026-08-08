import { PITY_CONFIG } from '../../entities/GAME_DATA.js';

export function pityDisclosure(tier, pullCount = 0, rosterComplete = false) {
  const base = PITY_CONFIG.newHeroRate[tier] ?? 0;
  const pulls = Math.max(0, pullCount);

  if (rosterComplete) {
    const every = PITY_CONFIG.stage2ShardFloorEveryPulls;
    return {
      stage: 2,
      rate: base,
      softPityFrom: PITY_CONFIG.softPityFrom,
      hardPityAt: every,
      pullsUntilGuarantee: Math.max(0, every - pulls),
      guaranteeLabel: `Guaranteed Hero Shard every ${every} pulls`,
    };
  }

  const softBonus = pulls >= PITY_CONFIG.softPityFrom
    ? (pulls - PITY_CONFIG.softPityFrom + 1) * PITY_CONFIG.softPityBonusPerPull
    : 0;

  return {
    stage: 1,
    rate: base === 0 ? 0 : Math.min(1, base + softBonus),
    softPityFrom: PITY_CONFIG.softPityFrom,
    hardPityAt: PITY_CONFIG.stage1HardPityN,
    pullsUntilGuarantee: Math.max(0, PITY_CONFIG.stage1HardPityN - pulls),
    guaranteeLabel: `Guaranteed new hero by pull ${PITY_CONFIG.stage1HardPityN}`,
  };
}
