import { eventBus } from '../../core/EventBus.js';
import { HEROES_CONFIG, INVENTORY_ITEMS } from '../../entities/GAME_DATA.js';
import { portraitHtml } from './heroCardView.js';
import { recruitReveal } from './recruitReveal.js';

const TIERS = ['normal', 'epic', 'legendary'];

export class RecruitPanel {
  constructor(systems) {
    this._s = systems;
    this._root = null;
    this._revealing = false;
  }

  init(rootEl) { this._root = rootEl; }

  render() {
    if (!this._root || this._revealing) return;
    this._root.innerHTML = `
      <div class="recruit-banners">${TIERS.map(t => this._bannerHtml(t)).join('')}</div>
      <div class="recruit-cards-section">
        <div class="recruit-section-title">Hero Cards</div>
        <div class="recruit-card-list">${this._cardListHtml()}</div>
      </div>
      <div class="recruit-exchange" id="recruit-exchange">${this._exchangeHtml()}</div>`;
    this._bind();
  }

  patch() {
    if (!this._root || this._revealing) return;
    for (const tier of TIERS) {
      const count = this._tokenCount(tier);
      const el = this._root.querySelector(`.recruit-token-count[data-tier="${tier}"]`);
      if (el) el.textContent = String(count);
      this._root.querySelectorAll(`.btn-pull[data-tier="${tier}"]`).forEach(btn => {
        btn.disabled = count < 1;
      });
    }
    const list = this._root.querySelector('.recruit-card-list');
    if (list) list.innerHTML = this._cardListHtml();
    this._bindCards();
  }

  dismissReveal() {
    this._revealing = false;
  }

  _tokenCount(tier) { return this._s.inventory?.getQuantity(`token_${tier}`) ?? 0; }

  _bannerHtml(tier) {
    const spotlight = Object.values(HEROES_CONFIG).find(h => h.tier === tier);
    const pity = this._s.heroes.getPityState(tier);
    const count = this._tokenCount(tier);
    return `
      <div class="recruit-banner recruit-banner--${tier}" data-tier="${tier}">
        <div class="recruit-banner-art">${portraitHtml(spotlight, 'splash')}</div>
        <div class="recruit-banner-body">
          <div class="recruit-banner-title">${tier[0].toUpperCase()}${tier.slice(1)} Recruit</div>
          <div class="recruit-banner-tokens">Tokens: <span class="recruit-token-count" data-tier="${tier}">${count}</span></div>
          <div class="recruit-banner-actions">
            <button class="btn btn-primary btn-pull" data-tier="${tier}" data-count="1" ${count < 1 ? 'disabled' : ''}>Pull ×1</button>
            <button class="btn btn-gold btn-pull" data-tier="${tier}" data-count="10" ${count < 1 ? 'disabled' : ''}>Pull ×10</button>
          </div>
          <details class="recruit-rates">
            <summary>Rates &amp; pity</summary>
            <div class="recruit-rates-body">
              <div>New hero chance: ${(pity.rate * 100).toFixed(1)}%</div>
              <div>${pity.guaranteeLabel}</div>
              <div>Pulls until guarantee: ${pity.pullsUntilGuarantee}</div>
              <div class="recruit-rates-note">Soft pity ramps from pull ${pity.softPityFrom}.</div>
            </div>
          </details>
        </div>
      </div>`;
  }

  _cardListHtml() {
    const owned = Object.values(HEROES_CONFIG)
      .map(cfg => ({ cfg, qty: this._s.inventory?.getQuantity(cfg.recruitCard) ?? 0 }))
      .filter(e => e.qty > 0);
    if (owned.length === 0) return `<div class="recruit-empty">No hero cards yet.</div>`;
    return owned.map(({ cfg, qty }) => `
      <button class="btn btn-gold btn-use-card" data-card="${cfg.recruitCard}">
        ${INVENTORY_ITEMS[cfg.recruitCard]?.name ?? cfg.name} ×${qty}
      </button>`).join('');
  }

  _exchangeHtml() {
    return `
      <div class="recruit-section-title">Shard Exchange</div>
      ${TIERS.map(t => {
        const qty = this._s.inventory?.getQuantity(`tier_shard_${t}`) ?? 0;
        return `<div class="recruit-exchange-row">${t}: ${qty} tier shards</div>`;
      }).join('')}`;
  }

  _bind() {
    this._root.querySelectorAll('.btn-pull').forEach(btn => {
      btn.addEventListener('click', e => {
        eventBus.emit('ui:click');
        this._pull(e.currentTarget.dataset.tier, parseInt(e.currentTarget.dataset.count, 10));
      });
    });
    this._bindCards();
  }

  _bindCards() {
    this._root.querySelectorAll('.btn-use-card').forEach(btn => {
      btn.addEventListener('click', e => {
        eventBus.emit('ui:click');
        const r = this._s.heroes.recruitWithCard(e.currentTarget.dataset.card);
        if (!r.success) {
          eventBus.emit('ui:error');
          this._s.notifications?.show('warning', 'Cannot Recruit', r.reason);
        }
      });
    });
  }

  _pull(tier, count) {
    const results = [];
    for (let i = 0; i < count; i++) {
      const r = this._s.heroes.rollToken(tier);
      if (!r.outcome) break;
      results.push(r);
    }
    if (results.length === 0) {
      eventBus.emit('ui:error');
      this._s.notifications?.show('warning', 'No Tokens', `You have no ${tier} recruit tokens.`);
      return;
    }
    this._revealing = true;
    recruitReveal(this._root, results, { onDone: () => { this._revealing = false; this.render(); } });
  }
}
