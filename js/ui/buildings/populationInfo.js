import { fmt } from '../uiUtils.js';

const whole = n => fmt(Math.floor(n));

export function populationInfo(buildingId, cfg, level, population) {
  if (buildingId === 'house') {
    const own = level * (cfg.populationCapacityPerLevel ?? 0);
    return { text: `This house: room for ${whole(own)} · City population ${whole(population.current)} / ${whole(population.cap)}`, met: true };
  }
  if (buildingId !== 'bank' || level >= cfg.maxLevel) return null;
  const nextLevel = level + 1;
  const needed = cfg.levelRequirements?.[nextLevel]?.population;
  if (!needed) return null;
  const met = population.current >= needed;
  return { text: `City population for Lv.${nextLevel}: ${whole(population.current)} / ${whole(needed)} ${met ? '✓' : '✗'}`, met };
}

export function populationInfoHtml(info) {
  if (!info) return '';
  return `<div class="binfo-pop${info.met ? '' : ' binfo-pop--warn'}">${info.text}</div>`;
}
