import { PITY_CONFIG } from '../../entities/GAME_DATA.js';

export function pityDisclosure(tier, pullsCompleted = 0, rosterComplete = false) {
  const base = PITY_CONFIG.newHeroRate[tier] ?? 0;
  const completed = Math.max(0, pullsCompleted);

  if (rosterComplete) {
    const every = PITY_CONFIG.stage2ShardFloorEveryPulls;
    return {
      stage: 2,
      rate: base,
      softPityFrom: PITY_CONFIG.softPityFrom,
      hardPityAt: every,
      pullsUntilGuarantee: Math.max(0, every - completed),
      guaranteeLabel: `Guaranteed Hero Shard every ${every} pulls`,
    };
  }

  const nextPull = completed + 1;
  const softBonus = nextPull >= PITY_CONFIG.softPityFrom
    ? (nextPull - PITY_CONFIG.softPityFrom + 1) * PITY_CONFIG.softPityBonusPerPull
    : 0;

  return {
    stage: 1,
    rate: base === 0 ? 0 : (nextPull >= PITY_CONFIG.stage1HardPityN ? 1 : Math.min(1, base + softBonus)),
    softPityFrom: PITY_CONFIG.softPityFrom,
    hardPityAt: PITY_CONFIG.stage1HardPityN,
    pullsUntilGuarantee: Math.max(0, PITY_CONFIG.stage1HardPityN - completed),
    guaranteeLabel: `Guaranteed new hero by pull ${PITY_CONFIG.stage1HardPityN}`,
  };
}
