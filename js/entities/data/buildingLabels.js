const ordinal = n => ['1st', '2nd', '3rd'][n - 1] ?? `${n}th`;
const percent = fraction => `${Math.round(fraction * 100)}%`;

function changePoints(rows, pick) {
  const points = [];
  rows.forEach((row, i) => {
    if (i === 0 || pick(row) !== pick(rows[i - 1])) points.push({ level: i + 1, value: pick(row) });
  });
  return points;
}

const slotPoints = cfg => changePoints(cfg.trainingSlots, row => row.concurrentSlots).slice(1);

function trainingSegments(cfg) {
  const last = cfg.trainingSlots[cfg.trainingSlots.length - 1];
  const slots = slotPoints(cfg).map(p => `Lv.${p.level}: ${p.value} slots`);
  return [...slots, `Train time down to ${percent(last.trainTimeMultiplier)}`];
}

function squadSegments(cfg) {
  const squads = cfg.squadSlots
    .filter(slot => slot.condition)
    .map(slot => `Lv.${slot.condition.barracks} → ${ordinal(slot.index + 1)}`);
  const buildLevels = cfg.instanceSlots.filter(slot => slot.condition).map(slot => slot.condition.townhall);
  return [
    `More squad slots (${squads.join(' · ')})`,
    `Build more Barracks via HQ (Lv.${buildLevels.join(' / ')})`,
  ];
}

function marchSegments(cfg) {
  const stats = cfg.levelStats;
  const marches = changePoints(stats, s => s.marchSlots).map(p => `Lv.${p.level}: ${p.value}`);
  const step = stats[1] ? stats[1].speedBonus - stats[0].speedBonus : 0;
  return [`Simultaneous marches (${marches.join(' · ')})`, `+${percent(step)} march speed per level`];
}

function heroSlotSegments(cfg) {
  const perLevel = cfg.effects.heroSlots;
  return [`+${perLevel} hero slots per level (${perLevel * cfg.maxLevel} at Lv.${cfg.maxLevel})`];
}

function bankSegments(cfg) {
  const levels = Object.keys(cfg.levelRequirements).map(Number);
  const first = levels[0];
  const last = levels[levels.length - 1];
  const population = level => cfg.levelRequirements[level].population;
  return [`Residents needed: ${population(first)} at Lv.${first} up to ${population(last)} at Lv.${last}`];
}

function segmentsFor(cfg) {
  if (cfg.trainingSlots) return trainingSegments(cfg);
  if (cfg.squadSlots) return squadSegments(cfg);
  if (cfg.effects?.marchSlots) return marchSegments(cfg);
  if (cfg.effects?.heroSlots) return heroSlotSegments(cfg);
  if (cfg.id === 'bank') return bankSegments(cfg);
  return [];
}

export function generatedEffectLabel(cfg) {
  return [cfg.effectLabel, ...segmentsFor(cfg)].filter(Boolean).join(' · ');
}

export function applyGeneratedLabels(config) {
  for (const cfg of Object.values(config)) cfg.effectLabel = generatedEffectLabel(cfg);
  return config;
}
