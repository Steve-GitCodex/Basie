const ROWS = ['front', 'mid', 'back'];
const MAX_ROUND_STEPS = 8;

const sum = (values) => values.reduce((a, b) => a + b, 0);
const pct = (current, initial) => (initial > 0 ? Math.max(0, Math.min(100, Math.round((current / initial) * 100))) : 0);

function sideTracker(initialStacks) {
  const rowOf = new Map(initialStacks.map((s) => [s.id, s.row]));
  const inRow = (row, rowKey) => row === null || rowKey === row;
  const hasRow = (row) => initialStacks.some((s) => s.row === row);
  const startPool = (row) => sum(initialStacks.filter((s) => inRow(row, s.row)).map((s) => s.startCount * s.hp));
  const poolOf = (snap, row) => sum(snap.filter((s) => inRow(row, rowOf.get(s.id))).map((s) => s.hpPool));
  return {
    pct: (snap) => pct(poolOf(snap, null), startPool(null)),
    rows: (snap) => Object.fromEntries(ROWS.map((row) => [row, hasRow(row) ? pct(poolOf(snap, row), startPool(row)) : null])),
    count: (snap) => sum(snap.map((s) => s.count)),
    startCount: sum(initialStacks.map((s) => s.startCount)),
  };
}

function sampleIndices(total) {
  if (total <= MAX_ROUND_STEPS) return Array.from({ length: total }, (_, i) => i);
  const picked = [];
  for (let k = 0; k < MAX_ROUND_STEPS; k++) picked.push(Math.round((k * (total - 1)) / (MAX_ROUND_STEPS - 1)));
  return picked;
}

function roundKills(rounds, attacker, defender, attackerStart) {
  let prevA = attackerStart;
  let prevD = defender.startCount;
  return rounds.map((round) => {
    const a = attacker.count(round.attacker);
    const d = defender.count(round.defender);
    const kills = { byAttacker: Math.max(0, prevD - d), byDefender: Math.max(0, prevA - a) };
    prevA = a;
    prevD = d;
    return kills;
  });
}

function waveSteps(wave, index, total, attacker, defender, attackerStart) {
  const steps = [{ kind: 'wave', index, total, name: wave.name }];
  const kills = roundKills(wave.rounds, attacker, defender, attackerStart);
  let from = 0;
  for (const i of sampleIndices(wave.rounds.length)) {
    const round = wave.rounds[i];
    const span = kills.slice(from, i + 1);
    steps.push({
      kind: 'round',
      attackerPct: attacker.pct(round.attacker),
      defenderPct: defender.pct(round.defender),
      rows: { attacker: attacker.rows(round.attacker), defender: defender.rows(round.defender) },
      kills: { byAttacker: sum(span.map((k) => k.byAttacker)), byDefender: sum(span.map((k) => k.byDefender)) },
      heroHits: wave.rounds.slice(from, i + 1).flatMap((r) => r.heroHits ?? []),
    });
    from = i + 1;
  }
  return steps;
}

export function playbackSteps(report) {
  const attacker = sideTracker(report.initial.attacker);
  const steps = [];
  let attackerCount = attacker.startCount;
  report.waves.forEach((wave, index) => {
    const defender = sideTracker(report.initial.defender[index] ?? []);
    steps.push(...waveSteps(wave, index, report.waves.length, attacker, defender, attackerCount));
    if (wave.rounds.length > 0) attackerCount = attacker.count(wave.rounds.at(-1).attacker);
  });
  steps.push({
    kind: 'result',
    victory: report.victory,
    dead: sum(Object.values(report.dead ?? {})),
    wounded: sum(Object.values(report.wounded ?? {})),
  });
  return steps;
}
