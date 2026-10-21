import { BUILDING_CURVE, HQ_MAX, eraNumber } from '../../entities/GAME_DATA.js';

function bandedFactor(bands, level) {
  let factor = 1;
  let from = 1;
  for (const [upTo, rate] of bands) {
    const steps = Math.min(level, upTo) - from;
    if (steps <= 0) break;
    factor = rate === 'linear' ? (factor * (from + steps)) / from : factor * rate ** steps;
    from += steps;
  }
  return factor;
}

export function costFactor(level, curve = BUILDING_CURVE) {
  return bandedFactor(curve.costBands, level);
}

export function timeFactor(level, curve = BUILDING_CURVE) {
  return bandedFactor(curve.timeBands, level);
}

export function prodFactor(level, curve = BUILDING_CURVE) {
  return bandedFactor(curve.prodBands, level);
}

export function levelCap(cfg, hq, hqMax = HQ_MAX) {
  if (cfg.capRule === 'none') return cfg.maxLevel;
  return Math.min(cfg.maxLevel, Math.ceil((cfg.maxLevel * hq) / hqMax));
}

export function eraAt(level) {
  return eraNumber(level);
}

export function upgradeCost(cfg, effectiveLevel) {
  const factor = costFactor(effectiveLevel + 1);
  const cost = {};
  for (const [resource, base] of Object.entries(cfg.baseCost)) cost[resource] = Math.floor(base * factor);
  return cost;
}

export function upgradeTime(cfg, pendingLevel) {
  return cfg.buildTime * timeFactor(pendingLevel);
}

export function minHqForLevel(cfg, level, hqMax = HQ_MAX) {
  for (let hq = 1; hq <= hqMax; hq++) if (levelCap(cfg, hq, hqMax) >= level) return hq;
  return hqMax;
}
