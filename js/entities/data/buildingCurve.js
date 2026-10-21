export const BUILDING_CURVE = {
  costBands: [[10, 1.65], [20, 1.45], [30, 1.30]],
  timeBands: [[10, 'linear'], [20, 1.35], [30, 1.20]],
  prodBands: [[10, 'linear'], [30, 1.09]],
};

export const ERA_HQ = [1, 2, 4, 6, 9, 12, 15, 18, 22, 26];

export const HQ_MAX = 30;

export const ERA_MONEY_CAP = [5e3, 10e3, 20e3, 42e3, 88e3, 185e3, 390e3, 820e3, 1.7e6, 3.6e6];

export function assertEraMoneyCap(eraHq, moneyCap) {
  if (moneyCap.length !== eraHq.length) {
    throw new Error(`ERA_MONEY_CAP: ${moneyCap.length} values for ${eraHq.length} ERA_HQ entries`);
  }
}

assertEraMoneyCap(ERA_HQ, ERA_MONEY_CAP);

export const POST_ERA_MONEY_GROWTH = 1.25;

export function eraNumber(level) {
  return Math.max(1, ERA_HQ.filter(hq => hq <= level).length);
}
