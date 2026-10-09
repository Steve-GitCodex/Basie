import { BUILDING_CURVE, ERA_HQ, HQ_MAX } from '../../entities/GAME_DATA.js';

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

export function costFactor(level) {
  return bandedFactor(BUILDING_CURVE.costBands, level);
}

export function timeFactor(level) {
  return bandedFactor(BUILDING_CURVE.timeBands, level);
}

export function prodFactor(level) {
  return bandedFactor(BUILDING_CURVE.prodBands, level);
}

export function levelCap(cfg, hq) {
  if (cfg.capRule === 'none') return cfg.maxLevel;
  return Math.min(cfg.maxLevel, Math.ceil((cfg.maxLevel * hq) / HQ_MAX));
}

export function eraAt(level) {
  let era = 1;
  ERA_HQ.forEach((threshold, i) => { if (threshold <= level) era = i + 1; });
  return era;
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
