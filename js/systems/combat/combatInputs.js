import { squadSide, encounterSide } from './battleSides.js';

const SURVIVAL_COUNT_GROWTH = 0.02;

const totalOf = (map) => Object.values(map).reduce((sum, n) => sum + n, 0);

export function battleSides({ units, slotRows, heroBonus, tech, hq, milMult, modifier, monster, difficulty }) {
  return {
    attacker: squadSide({ units, slotRows, heroBonus, tech, hq, milMult, modifier }),
    defender: encounterSide(monster, { difficulty, modifier }),
  };
}

export function survivalMonster(template, wave, mult) {
  const { baseWave } = template;
  return {
    ...template,
    waves: [{
      name: `${baseWave.name} (Wave ${wave + 1})`,
      stacks: baseWave.stacks.map((stack) => ({
        ...stack,
        hp: Math.round(stack.hp * mult),
        attack: Math.round(stack.attack * mult),
        count: Math.round(stack.count * (1 + wave * SURVIVAL_COUNT_GROWTH)),
      })),
    }],
  };
}

export function squadLosses({ dead, wounded }) {
  const losses = { ...dead };
  for (const [tierKey, n] of Object.entries(wounded)) losses[tierKey] = (losses[tierKey] ?? 0) + n;
  return losses;
}

export function wavesCleared(report) {
  return report.waves.filter((wave) => wave.rounds.at(-1)?.defender.every((stack) => stack.count === 0)).length;
}

export function summarizeEstimate(reports) {
  const runs = reports.length;
  return {
    winChance: reports.filter((r) => r.victory).length / runs,
    avgDead: reports.reduce((sum, r) => sum + totalOf(r.dead), 0) / runs,
    avgWounded: reports.reduce((sum, r) => sum + totalOf(r.wounded), 0) / runs,
  };
}
