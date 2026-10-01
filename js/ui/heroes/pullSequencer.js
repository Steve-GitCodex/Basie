import { eventBus } from '../../core/EventBus.js';
import { HEROES_CONFIG } from '../../entities/GAME_DATA.js';
import { escapeHtml } from '../uiUtils.js';
import { portraitHtml, videoHtml, bindPlayButton, TIER_META } from './heroCardView.js';
import { resultCardHtml } from './recruitReveal.js';
import { revealPlan, resultTotals } from './pullPlan.js';

const FIRST_FLIP_DELAY_MS = 400;
const FLIP_STAGGER_MS = 150;

const TOTAL_LABELS = {
  heroes:    ['new hero', 'new heroes'],
  shards:    ['Hero Shard', 'Hero Shards'],
  fragments: ['fragment', 'fragments'],
  xp:        ['XP card', 'XP cards'],
  overflow:  ['tier-shard refund', 'tier-shard refunds'],
};

function tierOf(result) {
  return result.tier ?? HEROES_CONFIG[result.heroId]?.tier ?? 'normal';
}

function cardHtml(result, plan, index) {
  return `
    <div class="pull-card pull-card--hint-${plan.hint} hq-rarity--${tierOf(result)}" data-index="${index}" style="--i:${index}">
      <div class="pull-card__inner">
        <div class="pull-card__back"></div>
        <div class="pull-card__face">${resultCardHtml(result)}</div>
      </div>
    </div>`;
}

function spotlightHtml(result) {
  const cfg = HEROES_CONFIG[result.heroId];
  return `
    <div class="pull-spotlight hq-rarity--${cfg?.tier ?? 'normal'}">
      <div class="pull-spotlight__rays"></div>
      <div class="pull-spotlight__art">${portraitHtml(cfg, 'splash')}${videoHtml(cfg)}</div>
      <div class="pull-spotlight__info">
        <span class="pull-spotlight__stamp">New hero</span>
        <h2 class="pull-spotlight__name">${escapeHtml(cfg?.name ?? result.heroId)}</h2>
        <div class="pull-spotlight__title">${escapeHtml(cfg?.title ?? '')}</div>
        <span class="hq-pill hq-pill--rarity">${TIER_META[cfg?.tier]?.label ?? ''}</span>
        <div class="pull-spotlight__actions">
          <button type="button" class="btn btn-primary pull-spotlight-continue">Continue</button>
          <button type="button" class="btn hq-btn-secondary pull-spotlight-view" data-hero-id="${result.heroId}">View hero ›</button>
        </div>
      </div>
    </div>`;
}

function totalsHtml(results) {
  const totals = resultTotals(results);
  return Object.entries(totals)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => `<span class="pull-summary__chip"><b>${n}</b> ${TOTAL_LABELS[key][n === 1 ? 0 : 1]}</span>`)
    .join('');
}

class PullSequence {
  constructor(rootEl, results, opts) {
    this._root = rootEl;
    this._results = results;
    this._opts = opts;
    this._plan = revealPlan(results);
    this._timers = new Set();
    this._next = 0;
    this._finished = false;
    this._stage = null;
  }

  start() {
    const sizeClass = this._results.length > 1 ? 'pull-stage--multi' : 'pull-stage--single';
    this._root.innerHTML = `
      <div class="recruit-reveal">
        <div class="pull-stage ${sizeClass}">
          <div class="pull-cards">${this._results.map((r, i) => cardHtml(r, this._plan[i], i)).join('')}</div>
          <div class="pull-hint">Tap anywhere to reveal all</div>
        </div>
        <div class="pull-summary hidden"></div>
      </div>`;
    this._stage = this._root.querySelector('.pull-stage');
    this._root.querySelector('.recruit-reveal').addEventListener('click', e => this._onClick(e));
    if (this._opts.reducedMotion) {
      this._flipAll();
      this._finish();
      return;
    }
    this._schedule(() => this._flipNext(), FIRST_FLIP_DELAY_MS);
  }

  cancel() {
    this._clearTimers();
    this._finished = true;
  }

  _schedule(fn, ms) {
    const id = setTimeout(() => { this._timers.delete(id); fn(); }, ms);
    this._timers.add(id);
  }

  _clearTimers() {
    for (const id of this._timers) clearTimeout(id);
    this._timers.clear();
  }

  _flip(index) {
    this._root.querySelector(`.pull-card[data-index="${index}"]`)?.classList.add('pull-card--flipped');
  }

  _flipAll() {
    while (this._next < this._results.length) this._flip(this._next++);
  }

  _flipNext() {
    if (this._next >= this._results.length) { this._finish(); return; }
    const index = this._next++;
    this._flip(index);
    eventBus.emit('ui:click');
    if (this._plan[index].spotlight) {
      this._showSpotlight(index, () => this._schedule(() => this._flipNext(), FLIP_STAGGER_MS));
      return;
    }
    this._schedule(() => this._flipNext(), FLIP_STAGGER_MS);
  }

  _revealAll() {
    this._clearTimers();
    const spotlights = [];
    while (this._next < this._results.length) {
      const index = this._next++;
      this._flip(index);
      if (this._plan[index].spotlight) spotlights.push(index);
    }
    this._chainSpotlights(spotlights);
  }

  _chainSpotlights(indices) {
    if (indices.length === 0) { this._finish(); return; }
    const [first, ...rest] = indices;
    this._showSpotlight(first, () => this._chainSpotlights(rest));
  }

  _showSpotlight(index, onContinue) {
    const host = this._root.querySelector('.recruit-reveal');
    host.insertAdjacentHTML('beforeend', spotlightHtml(this._results[index]));
    const spotlight = host.lastElementChild;
    bindPlayButton(spotlight);
    spotlight.querySelector('.pull-spotlight-continue')?.focus();
    spotlight.querySelector('.pull-spotlight-continue').addEventListener('click', e => {
      e.stopPropagation();
      eventBus.emit('ui:click');
      spotlight.remove();
      onContinue();
    });
    spotlight.querySelector('.pull-spotlight-view').addEventListener('click', e => {
      e.stopPropagation();
      eventBus.emit('ui:click');
      this.cancel();
      this._opts.onViewHero(e.currentTarget.dataset.heroId);
    });
  }

  _finish() {
    if (this._finished) return;
    this._finished = true;
    this._clearTimers();
    this._flipAll();
    this._stage?.classList.add('pull-stage--done');
    const summary = this._root.querySelector('.pull-summary');
    summary.innerHTML = `
      <div class="pull-summary__totals">${totalsHtml(this._results)}</div>
      <div class="pull-summary__actions">${this._opts.footerHtml()}</div>`;
    summary.classList.remove('hidden');
    summary.scrollIntoView({ block: 'nearest' });
  }

  _onClick(e) {
    if (e.target.closest('.pull-spotlight')) return;
    const again = e.target.closest('.pull-again');
    if (again) { eventBus.emit('ui:click'); this._opts.onPullAgain(parseInt(again.dataset.count, 10)); return; }
    if (e.target.closest('.recruit-reveal-done')) { eventBus.emit('ui:click'); this._opts.onDone(); return; }
    if (!this._finished && e.target.closest('.pull-stage') && this._next < this._results.length) this._revealAll();
  }
}

export function runPullSequence(rootEl, results, opts) {
  const sequence = new PullSequence(rootEl, results, opts);
  sequence.start();
  return { cancel: () => sequence.cancel() };
}
