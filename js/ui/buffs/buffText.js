import { BUFF_STATS, BUFF_SOURCES } from '../../entities/data/buffStats.js';
import { worldBuffStat } from '../../systems/buffs/worldBuffStat.js';

export { worldBuffStat };

export function formatPct(fraction) {
  const pct = Math.round(fraction * 100);
  if (pct === 0) return '—';
  return pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}

export function formatRemaining(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function describeEntry(entry) {
  const stat = BUFF_STATS[entry.stat];
  const source = BUFF_SOURCES[entry.sourceKind];
  return {
    name: entry.label,
    effect: `${formatPct(entry.pct)} ${stat?.label ?? entry.stat}`,
    tag: source?.tag ?? '',
    icon: stat?.icon ?? source?.icon ?? '',
  };
}

export function worldBuffEffect(buff) {
  return describeEntry({ stat: worldBuffStat(buff), pct: buff.pct ?? 0 }).effect;
}
