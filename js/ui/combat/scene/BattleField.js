import { iconFromEmoji } from '../../icons.js';
import { escapeHtml } from '../../uiUtils.js';
import { UNITS_CONFIG } from '../../../entities/GAME_DATA.js';
import { COMBAT_RULES } from '../../../entities/data/combatRules.js';
import { heroIcon, heroName } from '../../../systems/combat/report/battleText.js';
import { FieldArrows } from './FieldArrows.js';

const { ROWS } = COMBAT_RULES;
const SIDES = ['attacker', 'defender'];
const MOMENT_MS = 1200;
const FLOAT_KINDS = ['dmg', 'kill', 'heal'];
const FLOAT_TEXT = { dmg: (n) => `−${n}`, kill: (n) => `☠ ${n}`, heal: (n) => `+${n}` };
const ROW_LABELS = { front: 'Front', mid: 'Mid', back: 'Back' };

function rowHtml(row) {
  return `<div class="bf__row" data-row="${row}"><span class="bf__row-label">${ROW_LABELS[row]}</span><div class="bf__stacks"></div></div>`;
}

function sideHtml(side, title) {
  return `
    <div class="bf__side bf__side--${side}">
      <div class="bf__head"><b class="bf__title">${title}</b><span class="bf__total"></span></div>
      ${ROWS.map(rowHtml).join('')}
    </div>`;
}

function ledBadge(heroId) {
  if (!heroId) return '';
  return `<span class="bf-stack__led" title="Led by ${escapeHtml(heroName(heroId))}">${iconFromEmoji(heroIcon(heroId))}</span>`;
}

function stackCard(stack) {
  const card = document.createElement('div');
  card.className = 'bf-stack';
  card.dataset.stackId = stack.id;
  card.innerHTML = `
    <div class="bf-stack__head">
      <span class="bf-stack__tier">T${stack.tier}</span>
      <span class="bf-stack__type bf-stack__type--${stack.type}">${iconFromEmoji(UNITS_CONFIG[stack.type]?.icon ?? '⚔️')}</span>
      <span class="bf-stack__label">${escapeHtml(stack.label)}</span>
      ${ledBadge(stack.ledBy)}
      <span class="bf-stack__counter hidden"></span>
      <span class="bf-stack__count"></span><span class="bf-stack__delta"></span>
    </div>
    <div class="bf-stack__bar"><i class="bf-stack__fill"></i></div>
    ${FLOAT_KINDS.map(kind => `<span class="bf-float bf-float--${kind}"></span>`).join('')}`;
  return {
    card,
    count: card.querySelector('.bf-stack__count'),
    delta: card.querySelector('.bf-stack__delta'),
    counter: card.querySelector('.bf-stack__counter'),
    fill: card.querySelector('.bf-stack__fill'),
    floats: Object.fromEntries(FLOAT_KINDS.map(kind => [kind, card.querySelector(`.bf-float--${kind}`)])),
  };
}

function emptyRow(row) {
  const el = document.createElement('div');
  el.className = 'bf-stack bf-stack--empty';
  el.textContent = `— no ${row} row —`;
  return el;
}

const sideTotals = (side) => Object.values(side.rows).flat()
  .reduce((sum, stack) => ({ count: sum.count + stack.count, start: sum.start + stack.startCount }), { count: 0, start: 0 });

function struckKeys(frame) {
  const sideOf = new Map();
  for (const side of SIDES) {
    for (const stack of Object.values(frame.sides[side].rows).flat()) sideOf.set(stack.id, side);
  }
  return new Set(frame.floats
    .filter(float => float.kind !== 'heal' && sideOf.has(float.stackId))
    .map(float => `${sideOf.get(float.stackId)}:${float.stackId}`));
}

function floatTotals(floats) {
  const totals = new Map();
  for (const { stackId, kind, value } of floats) {
    if (!totals.has(stackId)) totals.set(stackId, {});
    const entry = totals.get(stackId);
    entry[kind] = (entry[kind] ?? 0) + value;
  }
  return totals;
}

function playFloat(el, value) {
  const wasA = el.classList.contains('bf-float--a');
  el.textContent = value;
  el.classList.toggle('bf-float--a', !!value && !wasA);
  el.classList.toggle('bf-float--b', !!value && wasA);
}

export class BattleField {
  constructor(el) {
    this._el = el;
    el.classList.add('bf');
    el.innerHTML = `
      <svg class="bf__arrows" aria-hidden="true"></svg>
      ${sideHtml('attacker', 'Your squad')}
      <div class="bf__gap"></div>
      ${sideHtml('defender', '')}
      <div class="bf__moment hidden"><b class="bf__moment-title"></b><small class="bf__moment-text"></small></div>`;
    this._sides = Object.fromEntries(SIDES.map(side => {
      const sideEl = el.querySelector(`.bf__side--${side}`);
      return [side, {
        title: sideEl.querySelector('.bf__title'),
        total: sideEl.querySelector('.bf__total'),
        rows: Object.fromEntries(ROWS.map(row => [row, sideEl.querySelector(`.bf__row[data-row="${row}"] .bf__stacks`)])),
      }];
    }));
    this.arrows = el.querySelector('.bf__arrows');
    this._arrows = new FieldArrows(this.arrows, el);
    this._moment = el.querySelector('.bf__moment');
    this._momentTitle = el.querySelector('.bf__moment-title');
    this._momentText = el.querySelector('.bf__moment-text');
    this._cards = new Map();
    this._wave = null;
    this._momentTimer = null;
  }

  get el() {
    return this._el;
  }

  get wave() {
    return this._wave;
  }

  clearMoment() {
    clearTimeout(this._momentTimer);
    this._moment.classList.add('hidden');
  }

  reset() {
    this._wave = null;
    this._cards.clear();
    this._buildSide('attacker', null);
    this.clearMoment();
    this._arrows.clear();
  }

  buildWave(frame, waveIndex, waveName = '') {
    if (this._wave === null) this._buildSide('attacker', frame.sides.attacker);
    this._buildSide('defender', frame.sides.defender);
    this._sides.defender.title.textContent = waveName;
    this._wave = waveIndex;
  }

  render(frame, { numbers = true, arrows = true } = {}) {
    const struck = struckKeys(frame);
    for (const side of SIDES) {
      for (const stack of Object.values(frame.sides[side].rows).flat()) {
        const refs = this._cards.get(`${side}:${stack.id}`);
        if (refs) this._patchCard(refs, stack, struck.has(`${side}:${stack.id}`));
      }
      const { count, start } = sideTotals(frame.sides[side]);
      this._sides[side].total.textContent = `${count} / ${start}`;
    }
    this.renderFloats(frame, numbers);
    this.renderArrows(frame, arrows);
  }

  renderFloats(frame, on) {
    const floats = on ? floatTotals(frame.floats) : new Map();
    for (const side of SIDES) {
      for (const stack of Object.values(frame.sides[side].rows).flat()) {
        const refs = this._cards.get(`${side}:${stack.id}`);
        if (refs) this._patchFloats(refs, floats.get(stack.id));
      }
    }
  }

  renderArrows(frame, on) {
    if (!on) {
      this._arrows.clear();
      return;
    }
    this._arrows.render(frame.arrows, {
      cardOf: (side, id) => this._cards.get(`${side}:${id}`)?.card,
      rowOf: (side, row) => this._sides[side].rows[row],
    });
  }

  showMoment(moment) {
    this._momentTitle.textContent = `${moment.icon} ${moment.text}`;
    this._momentText.textContent = '';
    this._moment.classList.remove('hidden');
    clearTimeout(this._momentTimer);
    this._momentTimer = setTimeout(() => this._moment.classList.add('hidden'), MOMENT_MS);
  }

  _buildSide(side, view) {
    const prefix = `${side}:`;
    for (const key of [...this._cards.keys()]) if (key.startsWith(prefix)) this._cards.delete(key);
    for (const row of ROWS) {
      const host = this._sides[side].rows[row];
      host.replaceChildren();
      if (!view) continue;
      const stacks = view.rows[row];
      if (!stacks.length) host.appendChild(emptyRow(row));
      for (const stack of stacks) {
        const refs = stackCard(stack);
        this._cards.set(`${side}:${stack.id}`, refs);
        host.appendChild(refs.card);
      }
    }
  }

  _patchFloats(refs, totals = {}) {
    for (const kind of FLOAT_KINDS) playFloat(refs.floats[kind], totals[kind] > 0 ? FLOAT_TEXT[kind](totals[kind]) : '');
  }

  _patchCard(refs, stack, hit) {
    refs.count.textContent = stack.count;
    refs.fill.style.width = `${stack.hpPct}%`;
    const { lost, healed } = stack.delta;
    refs.delta.textContent = lost > 0 ? `−${lost}` : healed > 0 ? `+${healed}` : '';
    refs.delta.classList.toggle('bf-stack__delta--heal', !lost && healed > 0);
    refs.card.classList.toggle('bf-stack--hit', hit);
    refs.card.classList.toggle('bf-stack--down', stack.count === 0);
    refs.counter.classList.toggle('hidden', !stack.counter);
    refs.counter.textContent = stack.counter ? `×${Number(stack.counter.toFixed(2))}` : '';
  }
}
