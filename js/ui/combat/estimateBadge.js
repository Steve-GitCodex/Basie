const READY_AT = 0.7;
const RISKY_AT = 0.4;

export function estimateBadge(est) {
  const pct = Math.round(est.winChance * 100);
  const cls = est.winChance >= READY_AT ? 'ready' : est.winChance >= RISKY_AT ? 'risky' : 'weak';
  const head = cls === 'ready' ? 'Likely win' : cls === 'risky' ? 'Risky' : 'Unlikely';
  const lost = Math.round(est.avgDead + est.avgWounded);
  return { cls, label: `${head} · ~${pct}%${lost > 0 ? ` · ~${lost} lost` : ''}` };
}
