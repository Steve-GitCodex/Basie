import { formatDuration, LOW_STOCK_RATIO } from './hudFormat.js';

const exact = n => Math.floor(n).toLocaleString();

export function cafeteriaTotals(bm) {
  const stocks = bm?.getCafeteriaStock?.() ?? [];
  const sum = pick => stocks.reduce((total, s) => total + pick(s), 0);
  const food = sum(s => s.stock.food);
  const water = sum(s => s.stock.water);
  const foodCap = sum(s => s.stockCap.food);
  const waterCap = sum(s => s.stockCap.water);
  const ratios = [foodCap > 0 ? food / foodCap : 0, waterCap > 0 ? water / waterCap : 0];
  const { drainPerSec, emptyInSec } = bm?.getCafeteriaDepletion?.() ?? { drainPerSec: 0, emptyInSec: Infinity };
  return {
    count: stocks.length,
    food, water, foodCap, waterCap,
    ratio: Math.min(...ratios),
    drainPerSec,
    emptyInSec,
    autoRestock: !!bm?.getAutomations?.().cafeteriaRestock,
  };
}

const isOut = ({ emptyInSec, drainPerSec }) => Number.isFinite(emptyInSec) && emptyInSec <= 0 && drainPerSec > 0;

export function emptyText(totals) {
  if (!Number.isFinite(totals.emptyInSec)) return null;
  return isOut(totals) ? 'Out of supplies' : formatDuration(totals.emptyInSec);
}

export function cafeteriaTipHtml(totals) {
  const row = (name, value) => `<div class="chip-tip__row"><span>${name}</span><span>${value}</span></div>`;
  const rows = [
    `<div class="chip-tip__head">Cafeteria supplies</div>`,
    row('Food', `${exact(totals.food)} / ${exact(totals.foodCap)}`),
    row('Water', `${exact(totals.water)} / ${exact(totals.waterCap)}`),
  ];
  const empty = emptyText(totals);
  if (empty) rows.push(row('Empty in', empty));
  return rows.join('');
}

const row = (label, part) =>
  `<div class="chip-popover__row"><span data-part="${part}-label">${label}</span><b data-part="${part}"></b></div>`;

export function cafeteriaHtml() {
  return `<h5 class="chip-popover__title"><span class="res-icon res-icon--cafeteria"></span>Cafeteria</h5>
    ${row('Food', 'food')}${row('Water', 'water')}
    <div class="chip-popover__bar"><i data-part="fill"></i></div>
    ${row('Consumption', 'drain')}${row('Empty in', 'empty')}${row('Auto-restock', 'auto')}
    <div class="chip-popover__note" data-part="msg" hidden></div>
    <div class="chip-popover__acts">
      <button class="btn btn-primary chip-popover__btn" data-pop="restock">Restock</button>
      <button class="btn chip-popover__btn chip-popover__btn--ghost" data-pop="cafeteria">Open cafeteria</button>
    </div>`;
}

export function patchCafeteria(parts, totals) {
  const low = totals.ratio < LOW_STOCK_RATIO;
  parts.food.textContent = `${exact(totals.food)} / ${exact(totals.foodCap)}`;
  parts.water.textContent = `${exact(totals.water)} / ${exact(totals.waterCap)}`;
  parts.fill.style.width = `${(totals.ratio * 100).toFixed(1)}%`;
  parts.fill.style.setProperty('--pop-res', low ? 'var(--clr-danger)' : 'var(--clr-res-cafeteria)');
  parts.drain.textContent = totals.drainPerSec > 0 ? `−${totals.drainPerSec.toFixed(1)}/s` : 'No consumers';
  parts.auto.textContent = totals.autoRestock ? 'On' : 'Off';
  patchEmpty(parts, totals);
}

function patchEmpty(parts, totals) {
  const text = emptyText(totals);
  parts['empty-label'].parentElement.hidden = text === null;
  parts.empty.classList.toggle('chip-popover__bad', isOut(totals));
  if (text !== null) parts.empty.textContent = text;
}

export function restockAll(bm) {
  const stocks = bm.getCafeteriaStock();
  const results = stocks.map(s => bm.restockCafeteria(s.instanceId, s.stockCap.food, s.stockCap.water));
  if (results.some(r => r?.success)) return '';
  return results.find(r => r && !r.success)?.reason ?? '';
}
