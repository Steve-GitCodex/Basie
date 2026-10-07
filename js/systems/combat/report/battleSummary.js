import { COMBAT_RULES } from '../../../entities/data/combatRules.js';
import { starsFor } from '../../campaign/starRules.js';
import { totalKills } from './battleText.js';

const sumValues = (map) => Object.values(map ?? {}).reduce((sum, value) => sum + value, 0);

function fightEvents(report) {
  const events = [];
  let roundOffset = 0;
  for (const wave of report.waves) {
    wave.rounds.forEach((round, index) => {
      for (const event of round.events) events.push({ event, round: roundOffset + index + 1 });
    });
    roundOffset += wave.rounds.length;
  }
  return events;
}

function killsByStack(events) {
  const kills = {};
  for (const { event } of events) {
    if (event.kind === 'strike' && event.side === 'attacker') kills[event.fromId] = (kills[event.fromId] ?? 0) + totalKills(event.hits);
  }
  return kills;
}

function stackRows(report, stackKills) {
  return report.initial.attacker.map((stack) => {
    const dead = report.dead?.[stack.id] ?? 0;
    const wounded = report.wounded?.[stack.id] ?? 0;
    return {
      id: stack.id,
      label: stack.label,
      row: stack.row,
      sent: stack.startCount,
      dead,
      wounded,
      back: stack.startCount - dead - wounded,
      kills: stackKills[stack.id] ?? 0,
    };
  });
}

function heroRows(events, squadHeroes, heroXp, stackKills, heroesBySlot) {
  const rows = squadHeroes.map(({ heroId, slotIndex, stackId }) => {
    const own = events.filter(({ event }) => event.kind === 'heroStrike' && event.heroId === heroId);
    return {
      heroId,
      slotIndex,
      kills: own.reduce((sum, { event }) => sum + totalKills(event.hits), 0) + (heroesBySlot[stackId] === heroId ? stackKills[stackId] ?? 0 : 0),
      skillsFired: events
        .filter(({ event }) => event.kind === 'skill' && event.heroId === heroId)
        .map(({ event, round }) => ({ skillId: event.skillId, round })),
      xp: heroXp.find((entry) => entry.heroId === heroId) ?? null,
      mvp: false,
    };
  });
  const best = rows.filter((row) => row.kills > 0).sort((a, b) => b.kills - a.kills || a.slotIndex - b.slotIndex)[0];
  if (best) best.mvp = true;
  return rows;
}

function starRuleRows(report, stage, layers) {
  const { lossFraction } = COMBAT_RULES.STAR_RULES;
  const lost = layers.dead + layers.wounded;
  const actualPct = Math.round(layers.sent > 0 ? (lost / layers.sent) * 100 : 0);
  const underPass = report.victory && layers.sent > 0 && lost / layers.sent <= lossFraction;
  const withinPass = underPass && report.roundsTotal <= stage.roundPar;
  return [
    { text: 'Won', pass: report.victory, actual: report.victory },
    { text: `Under ${lossFraction * 100}% lost (${actualPct}%)`, pass: underPass, actual: actualPct },
    { text: `Won within ${stage.roundPar} rounds (took ${report.roundsTotal})`, pass: withinPass, actual: report.roundsTotal },
  ];
}

function firstHeroPerStack(squadHeroes) {
  const bySlot = {};
  for (const { heroId, stackId } of squadHeroes) if (stackId && !bySlot[stackId]) bySlot[stackId] = heroId;
  return bySlot;
}

export function battleSummary({ report, stage = null, heroXp = [], squadHeroes = [], emptySlots = 0, heroesBySlot = firstHeroPerStack(squadHeroes) }) {
  const events = fightEvents(report);
  const stackKills = killsByStack(events);
  const stacks = stackRows(report, stackKills);
  const sum = (key) => stacks.reduce((total, stack) => total + stack[key], 0);
  const layers = { sent: sum('sent'), back: sum('back'), wounded: sum('wounded'), dead: sum('dead') };
  const stars = stage
    ? starsFor({ victory: report.victory, sent: layers.sent, dead: sumValues(report.dead), wounded: sumValues(report.wounded), rounds: report.roundsTotal, roundPar: stage.roundPar })
    : null;
  return {
    victory: report.victory,
    stars,
    starRules: stage ? starRuleRows(report, stage, layers) : [],
    layers,
    stacks,
    heroes: heroRows(events, squadHeroes, heroXp, stackKills, heroesBySlot),
    emptySlots,
  };
}
