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

export function enemyLeftPct(report) {
  const poolOf = (stacks) => stacks.reduce((sum, stack) => sum + stack.hpPool, 0);
  let initial = 0;
  let remaining = 0;
  report.initial.defender.forEach((stacks, i) => {
    const start = poolOf(stacks);
    const last = report.waves[i].rounds.at(-1);
    initial += start;
    remaining += last ? poolOf(last.defender) : start;
  });
  return initial > 0 ? Math.round((remaining / initial) * 100) : 0;
}

const foughtWaves = (report) => report.waves.map((wave, i) => ({ wave, i })).filter(({ wave }) => wave.rounds.length > 0);

export function wavesReached(report) {
  return foughtWaves(report).at(-1)?.i + 1 || 0;
}

export function bossLeftPct(report) {
  const last = foughtWaves(report).at(-1);
  if (!last) return 100;
  const poolOf = (stacks) => stacks.reduce((sum, stack) => sum + stack.hpPool, 0);
  const start = poolOf(report.initial.defender[last.i]);
  return start > 0 ? Math.round((poolOf(last.wave.rounds.at(-1).defender) / start) * 100) : 0;
}

export function troopsSent(units) {
  return units.reduce((sum, unit) => sum + unit.count, 0);
}

export function summarizeEstimate(reports) {
  const runs = reports.length;
  return {
    winChance: reports.filter((r) => r.victory).length / runs,
    avgDead: reports.reduce((sum, r) => sum + totalOf(r.dead), 0) / runs,
    avgWounded: reports.reduce((sum, r) => sum + totalOf(r.wounded), 0) / runs,
  };
}
