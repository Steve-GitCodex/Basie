function applyBuildSpeed(buildTimeSec, buildSpeed) {
  if (buildTimeSec === 0 || !(buildSpeed > 0)) return buildTimeSec;
  return Math.max(1, Math.floor(buildTimeSec / (1 + buildSpeed)));
}

function applyCostReduction(cost, reduction) {
  const factor = reduction > 0 ? 1 - reduction : 1;
  const out = {};
  for (const [res, amount] of Object.entries(cost)) out[res] = Math.ceil(amount * factor);
  return out;
}

export const heroBuildModifiers = { applyBuildSpeed, applyCostReduction };
