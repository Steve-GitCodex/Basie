const heroOnly = (cap, totalCap) => ({ categories: { hero: { stacking: 'softcap', cap } }, totalCap });

export const STAT_RULES = {
  lossReduction: {
    categories: {
      hero: { stacking: 'softcap', cap: 0.60 },
      tech: { stacking: 'softcap', cap: 0.60 },
    },
    totalCap: 0.90,
  },
  postBattleHeal:   heroOnly(0.30, 0.50),
  trainingSpeed:    heroOnly(0.50, 0.75),
  researchSpeed:    heroOnly(0.50, 0.75),
  buildSpeed:       heroOnly(0.40, 0.75),
  storageCap:       heroOnly(0.30, 0.50),
  constructionCost: heroOnly(0.25, 0.50),
  baseDefense:      heroOnly(0.25, 0.50),
};
