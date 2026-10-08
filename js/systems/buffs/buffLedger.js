import { BUFF_STATS } from '../../entities/GAME_DATA.js';
import {
  fromBoosts, fromWorld, fromTech, fromVip, fromHq, fromHeroes, fromEvents,
} from './ledgerSources.js';

const COLLECTORS = [fromBoosts, fromWorld, fromTech, fromVip, fromHq, fromHeroes, fromEvents];
const PRODUCTION = /^production\.(?!all$)(.+)$/;

export function collect(snapshot) {
  return COLLECTORS.flatMap(fn => fn(snapshot ?? {}));
}

export function timedEntries(entries) {
  return entries.filter(e => e.endsAt != null).sort((a, b) => a.endsAt - b.endsAt);
}

const appliesTo = (entry, statId) =>
  entry.stat === statId || (entry.stat === 'production.all' && PRODUCTION.test(statId));

export function statTotals(entries, rateBreakdowns = {}) {
  const totals = {};
  for (const statId of Object.keys(BUFF_STATS)) {
    const matched = entries.filter(e => appliesTo(e, statId));
    const resource = PRODUCTION.exec(statId)?.[1];
    const breakdown = resource ? rateBreakdowns?.[resource] : null;
    const effectivePct = breakdown
      ? breakdown.multiplier - 1
      : matched.reduce((sum, e) => sum + e.pct, 0);
    totals[statId] = { entries: matched, effectivePct };
  }
  return totals;
}
