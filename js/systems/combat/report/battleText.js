import { HEROES_CONFIG, SKILLS_CONFIG } from '../../../entities/GAME_DATA.js';

export const heroName = (heroId) => HEROES_CONFIG[heroId]?.name ?? heroId;
export const heroIcon = (heroId) => HEROES_CONFIG[heroId]?.icon ?? '⚔';
export const skillName = (skillId) => SKILLS_CONFIG[skillId]?.name ?? skillId;

export function joinNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function roundEvents(report, frame) {
  const round = report.waves[frame.waveIndex]?.rounds.find((candidate) => candidate.round === frame.round);
  return round ? round.events : [];
}

export function stackLabels(frame) {
  const labels = {};
  for (const side of Object.values(frame.sides)) {
    for (const stacks of Object.values(side.rows)) {
      for (const stack of stacks) labels[stack.id] = stack.label;
    }
  }
  return labels;
}

export const totalKills = (hits) => hits.reduce((sum, hit) => sum + hit.kills, 0);
