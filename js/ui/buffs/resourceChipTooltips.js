import { collect, statTotals } from '../../systems/buffs/buffLedger.js';
import { buildSnapshot } from './buffSnapshot.js';
import { describeEntry, formatPct } from './buffText.js';
import { escapeHtml } from '../uiUtils.js';
import { subscribeBuffRefresh } from './buffEvents.js';

const RESOURCES = ['wood', 'stone', 'iron', 'food', 'water', 'money'];

const row = (name, effect) =>
  `<div class="chip-tip__row"><span>${name}</span><span>${effect}</span></div>`;

export class ResourceChipTooltips {
  constructor(systems) {
    this._s = systems;
  }

  init() {
    this._chips = {};
    for (const key of RESOURCES) {
      const chip = document.getElementById(`res-${key}`);
      if (!chip) continue;
      chip.removeAttribute('title');
      this._chips[key] = chip;
    }
    subscribeBuffRefresh(this._s, () => this._refresh());
    this._refresh();
  }

  _refresh() {
    const snapshot = buildSnapshot(this._s);
    const totals = statTotals(collect(snapshot), snapshot.rateBreakdowns);
    for (const [key, chip] of Object.entries(this._chips)) {
      const { entries, effectivePct } = totals[`production.${key}`];
      const rows = entries.map(e => {
        const d = describeEntry(e);
        return row(escapeHtml(d.name), formatPct(e.pct));
      });
      chip.dataset.tooltipHtml = [
        `<div class="chip-tip__head">${key[0].toUpperCase()}${key.slice(1)} production</div>`,
        ...(rows.length ? rows : [`<div class="chip-tip__none">No active bonuses</div>`]),
        `<div class="chip-tip__total">${row('Total', formatPct(effectivePct))}</div>`,
      ].join('');
    }
  }
}
