import { INVENTORY_ITEMS, BUFF_STATS } from '../../entities/GAME_DATA.js';
import { escapeHtml } from '../uiUtils.js';
import { describeEntry, formatPct, formatRemaining } from './buffText.js';

const STAT_ORDER = Object.keys(BUFF_STATS);

function runningRow(entry, openedAt) {
  const { name, effect, tag, icon } = describeEntry(entry);
  const start = entry.startedAt ?? openedAt;
  const now = Date.now();
  const span = entry.endsAt - start;
  const pct = span > 0 ? Math.max(0, Math.min(100, ((now - start) / span) * 100)) : 100;
  return `
    <div class="buff-row buff-row--live">
      <div class="buff-row__icon">${escapeHtml(icon)}</div>
      <div class="buff-row__main">
        <b>${escapeHtml(name)}<span class="buff-row__tag">${escapeHtml(tag)}</span></b>
        <small class="buff-row__effect">${escapeHtml(effect)}</small>
      </div>
      <div class="buff-row__time progress-container" data-timer-format="duration" data-timer-start="${start}" data-timer-end="${entry.endsAt}">
        <span class="progress-time-label buff-row__remaining">${formatRemaining(entry.endsAt - now)}</span>
        <div class="progress-bar"><div class="progress-fill progress-fill-success" style="width:${pct}%"></div></div>
      </div>
    </div>`;
}

function buffItemsByStat() {
  const byStat = new Map();
  for (const cfg of Object.values(INVENTORY_ITEMS)) {
    if (cfg.type !== 'buff') continue;
    if (!byStat.has(cfg.stat)) byStat.set(cfg.stat, []);
    byStat.get(cfg.stat).push(cfg);
  }
  return byStat;
}

const itemSummary = cfg => `${formatPct(cfg.value)} for ${formatRemaining(cfg.durationMs)}`;

function useButton(cfg, multiple) {
  const label = multiple ? `Use ${escapeHtml(cfg.name)}` : 'Use';
  return `<button class="buff-btn" data-use-item="${escapeHtml(cfg.id)}">${label}</button>`;
}

function availableRow(statId, items, inventory) {
  const stat = BUFF_STATS[statId];
  const owned = items
    .map(cfg => ({ cfg, qty: inventory.getQuantity(cfg.id) }))
    .filter(o => o.qty > 0);
  const subtitle = owned.length
    ? `Owned: ${owned.map(o => `${escapeHtml(o.cfg.name)} ×${o.qty} (${itemSummary(o.cfg)})`).join(', ')}`
    : 'No items owned';
  const actions = owned.length
    ? owned.map(o => useButton(o.cfg, owned.length > 1)).join('')
    : '<button class="buff-btn buff-btn--ghost" data-open-supply>Get in Supply ›</button>';
  return `
    <div class="buff-row buff-row--empty">
      <div class="buff-row__icon">${escapeHtml(stat?.icon ?? '')}</div>
      <div class="buff-row__main"><b>${escapeHtml(stat?.label ?? statId)}</b><small>${subtitle}</small></div>
      <div class="buff-row__actions">${actions}</div>
    </div>`;
}

export function renderActiveTab({ timed, snapshot, inventory, openedAt }) {
  const runningStats = new Set(snapshot.boosts.map(b => b.stat));
  const byStat = buffItemsByStat();
  const available = STAT_ORDER
    .filter(statId => byStat.has(statId) && !runningStats.has(statId))
    .map(statId => availableRow(statId, byStat.get(statId), inventory));

  const running = timed.length
    ? timed.map(e => runningRow(e, openedAt)).join('')
    : '<p class="buffs-empty">Nothing running right now.</p>';
  const availableBlock = available.length
    ? `<p class="buffs-label buffs-label--spaced">Available <small>boost slots with nothing running</small></p>${available.join('')}`
    : '';

  return `
    <p class="buffs-label">Running <small>sorted by time left</small></p>
    ${running}
    ${availableBlock}`;
}
