import { COMBAT_RULES } from '../../../entities/data/combatRules.js';
import { hitDamage } from '../hitMath.js';

const { ROUND_CAP, ROWS } = COMBAT_RULES;
const RECENT_ROUNDS = 5;
const FRONT_BREAK_ROUND = 4;
const ARMOR_THRESHOLD = 0.5;
const COUNTER_THRESHOLD = 0.6;
const CAUSE_ORDER = ['armor', 'heal', 'frontBroke', 'heroes', 'roundCap', 'counter'];

const labelOf = (stack) => stack.label ?? stack.name;
const damageOf = (hits) => hits.reduce((sum, hit) => sum + hit.damage, 0);
const percent = (share) => Math.round(share * 100);
const allEvents = (report) => report.waves.flatMap((wave) => wave.rounds.flatMap((round) => round.events));

function finalWave(report) {
  let index = -1;
  report.waves.forEach((wave, waveIndex) => {
    if (wave.rounds.length > 0) index = waveIndex;
  });
  return index;
}

function strikeDamageByStack(events, side) {
  const totals = {};
  for (const event of events) {
    if (event.kind === 'strike' && event.side === side) totals[event.fromId] = (totals[event.fromId] ?? 0) + damageOf(event.hits);
  }
  return totals;
}

function armorCause(report, waveIndex) {
  const totals = strikeDamageByStack(allEvents(report), 'attacker');
  const main = report.initial.attacker
    .filter((stack) => totals[stack.id] > 0)
    .sort((a, b) => totals[b.id] - totals[a.id])[0];
  const stacks = report.initial.defender[waveIndex] ?? [];
  const frontRow = ROWS.find((row) => stacks.some((stack) => stack.row === row));
  const enemy = stacks.filter((stack) => stack.row === frontRow).sort((a, b) => b.defense - a.defense)[0];
  if (!main || !enemy || main.attack <= 0) return null;
  const absorbed = 1 - hitDamage(main.attack, enemy.defense) / main.attack;
  if (absorbed < ARMOR_THRESHOLD) return null;
  return {
    cause: 'armor',
    fix: 'train',
    score: absorbed,
    text: `${labelOf(enemy)} have defense ${Math.round(enemy.defense)}. Your ${labelOf(main)} hit for ${Math.round(main.attack)}: about ${percent(absorbed)}% of each hit is absorbed.`,
  };
}

function healCause(report, waveIndex) {
  const recent = report.waves[waveIndex].rounds.slice(-RECENT_ROUNDS);
  const enemyIds = new Set((report.initial.defender[waveIndex] ?? []).map((stack) => stack.id));
  const events = recent.flatMap((round) => round.events);
  const healBy = {};
  let healed = 0;
  let dealt = 0;
  for (const event of events) {
    if (event.kind === 'heal' && enemyIds.has(event.stackId)) {
      healBy[event.stackId] = (healBy[event.stackId] ?? 0) + event.amount;
      healed += event.amount;
    } else if (event.kind === 'strike' && event.side === 'attacker') dealt += damageOf(event.hits);
    else if (event.kind === 'heroStrike') dealt += damageOf(event.hits);
  }
  if (healed <= 0 || healed < dealt) return null;
  const topId = Object.keys(healBy).sort((a, b) => healBy[b] - healBy[a])[0];
  const healer = report.initial.defender[waveIndex].find((stack) => stack.id === topId);
  return {
    cause: 'heal',
    fix: 'mix',
    score: dealt > 0 ? Math.min(1, healed / dealt) : 1,
    text: `${healer ? labelOf(healer) : 'The enemy'} healed ${Math.round(healed)} HP over the last ${recent.length} rounds — more than the ${Math.round(dealt)} damage you dealt.`,
  };
}

function frontBrokeCause(report, waveIndex) {
  const frontIds = report.initial.attacker.filter((stack) => stack.row === 'front').map((stack) => stack.id);
  if (frontIds.length === 0) return null;
  const broke = report.waves[waveIndex].rounds.find((round) => {
    if (round.round >= FRONT_BREAK_ROUND) return false;
    const living = round.attacker.filter((stack) => frontIds.includes(stack.id)).reduce((sum, stack) => sum + stack.count, 0);
    return living === 0;
  });
  if (!broke) return null;
  return {
    cause: 'frontBroke',
    fix: 'rows',
    score: 1 - broke.round / FRONT_BREAK_ROUND,
    text: `Your front line broke in round ${broke.round} of the final wave — the rows behind it took the rest.`,
  };
}

function heroesCause(emptySlots) {
  if (emptySlots < 1) return null;
  return {
    cause: 'heroes',
    fix: 'heroes',
    score: Math.min(1, emptySlots * 0.5),
    text: `${emptySlots} commander slot${emptySlots === 1 ? '' : 's'} empty — each hero adds a strike every round.`,
  };
}

function roundCapCause(report, waveIndex) {
  if (report.waves[waveIndex].rounds.length < ROUND_CAP) return null;
  return {
    cause: 'roundCap',
    fix: 'train',
    score: 1,
    text: `Round limit reached in wave ${waveIndex + 1} — your damage was too low to finish.`,
  };
}

function counterCause(report) {
  const strikes = allEvents(report).filter((event) => event.kind === 'strike' && event.side === 'defender');
  const total = strikes.reduce((sum, event) => sum + damageOf(event.hits), 0);
  if (total <= 0) return null;
  const countered = strikes.filter((event) => event.counterMult > 1).reduce((sum, event) => sum + damageOf(event.hits), 0);
  const share = countered / total;
  if (share < COUNTER_THRESHOLD) return null;
  return {
    cause: 'counter',
    fix: 'mix',
    score: share,
    text: `The enemy had the counter advantage on ${percent(share)}% of its damage.`,
  };
}

export function defeatAnalysis({ report, emptySlots = 0 }) {
  if (report.victory) return [];
  const waveIndex = finalWave(report);
  const causes = [
    waveIndex >= 0 ? armorCause(report, waveIndex) : null,
    waveIndex >= 0 ? healCause(report, waveIndex) : null,
    waveIndex >= 0 ? frontBrokeCause(report, waveIndex) : null,
    heroesCause(emptySlots),
    waveIndex >= 0 ? roundCapCause(report, waveIndex) : null,
    counterCause(report),
  ].filter(Boolean);
  return causes
    .sort((a, b) => b.score - a.score || CAUSE_ORDER.indexOf(a.cause) - CAUSE_ORDER.indexOf(b.cause))
    .slice(0, 2);
}
