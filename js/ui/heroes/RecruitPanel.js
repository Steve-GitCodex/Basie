import { eventBus } from '../../core/EventBus.js';
import { HEROES_CONFIG, INVENTORY_ITEMS, EXCHANGE_CONFIG, AWAKENING_CONFIG } from '../../entities/GAME_DATA.js';
import { escapeHtml } from '../uiUtils.js';
import { portraitHtml, stopClips } from './heroCardView.js';
import { runPullSequence } from './pullSequencer.js';
import { pullCountFor } from './pullPlan.js';

const TIERS = ['normal', 'epic', 'legendary'];

const TIER_LABELS = { normal: 'Normal', epic: 'Epic', legendary: 'Legendary' };

export class RecruitPanel {
  constructor(systems) {
    this._s = systems;
    this._root = null;
    this._revealing = false;
    this._sequence = null;
  }

  init(rootEl) {
    this._root = rootEl;
    rootEl.addEventListener('click', e => this._onClick(e));
  }

  render() {
    if (!this._root || this._revealing) return;
    this._root.innerHTML = `
      <div class="recruit-banners">${TIERS.map(t => this._bannerHtml(t)).join('')}</div>
      <div class="recruit-boxes">
        <section class="recruit-box recruit-cards-section">
          <header class="recruit-box-head"><span class="recruit-section-title">Hero cards</span><span class="recruit-box-note">Use a card to recruit instantly</span></header>
          <div class="recruit-card-list">${this._cardListHtml()}</div>
        </section>
        <section class="recruit-box recruit-exchange" id="recruit-exchange">${this._exchangeHtml()}</section>
      </div>`;
  }

  patch() {
    if (!this._root || this._revealing) return;
    for (const tier of TIERS) {
      const count = this._tokenCount(tier);
      const countEl = this._root.querySelector(`.recruit-token-count[data-tier="${tier}"]`);
      if (countEl) countEl.textContent = String(count);
      const actions = this._root.querySelector(`.recruit-banner-actions[data-tier="${tier}"]`);
      if (actions && actions.dataset.count !== String(count)) {
        actions.dataset.count = String(count);
        actions.innerHTML = this._pullButtonsHtml(tier, count);
      }
      const pityText = this._root.querySelector(`.recruit-pity-text[data-tier="${tier}"]`);
      if (pityText) pityText.textContent = this._pityText(tier, count);
      const pityFill = this._root.querySelector(`.recruit-pity-bar[data-tier="${tier}"] > i`);
      if (pityFill) pityFill.style.width = `${this._pityPct(tier)}%`;

      const shardQty = this._s.inventory?.getQuantity(`tier_shard_${tier}`) ?? 0;
      const qtyEl = this._root.querySelector(`.recruit-exchange-qty[data-tier="${tier}"]`);
      if (qtyEl) qtyEl.textContent = String(shardQty);
      const exchangeBtn = this._root.querySelector(`.btn-exchange[data-tier="${tier}"]`);
      if (exchangeBtn) exchangeBtn.disabled = shardQty < EXCHANGE_CONFIG.tierShardsPerHeroShard;
    }
    const list = this._root.querySelector('.recruit-card-list');
    if (list) list.innerHTML = this._cardListHtml();
  }

  dismissReveal() {
    this._sequence?.cancel();
    this._sequence = null;
    this._revealing = false;
    stopClips(this._root);
  }

  _endReveal() {
    this.dismissReveal();
    this.render();
  }

  _revealFooterHtml(tier) {
    const count = this._tokenCount(tier);
    const { single, multi } = pullCountFor(count);
    const againCount = multi || (single ? 1 : 0);
    return `
      <span class="pull-summary__pity">${TIER_LABELS[tier]} tokens left: <b>${count}</b> · ${this._pityText(tier, count)}</span>
      ${againCount ? `<button type="button" class="btn hq-btn-secondary pull-again" data-count="${againCount}">Pull ×${againCount}</button>` : ''}
      <button type="button" class="btn btn-primary recruit-reveal-done">Done</button>`;
  }

  _tokenCount(tier) { return this._s.inventory?.getQuantity(`token_${tier}`) ?? 0; }

  _pityPct(tier) {
    const pity = this._s.heroes.getPityState(tier);
    return pity.hardPityAt > 0 ? Math.round((1 - pity.pullsUntilGuarantee / pity.hardPityAt) * 100) : 0;
  }

  _pityText(tier, count) {
    if (count < 1) return 'Get tokens from events and the Shop';
    const pity = this._s.heroes.getPityState(tier);
    const prize = pity.stage === 2 ? 'Hero Shard' : 'New hero';
    const pulls = pity.pullsUntilGuarantee;
    return `${prize} guaranteed in ${pulls} pull${pulls === 1 ? '' : 's'}`;
  }

  _pullButtonsHtml(tier, count) {
    const { single, multi } = pullCountFor(count);
    return `
      <button type="button" class="btn btn-primary btn-pull" data-tier="${tier}" data-count="1" ${single ? '' : 'disabled'}>Pull ×1</button>
      ${multi ? `<button type="button" class="btn hq-btn-secondary btn-pull" data-tier="${tier}" data-count="${multi}">Pull ×${multi}</button>` : ''}`;
  }

  _bannerHtml(tier) {
    const spotlight = Object.values(HEROES_CONFIG).find(h => h.tier === tier);
    const pity = this._s.heroes.getPityState(tier);
    const count = this._tokenCount(tier);
    return `
      <div class="recruit-banner recruit-banner--${tier} hq-rarity--${tier}" data-tier="${tier}">
        <div class="recruit-banner-art">${portraitHtml(spotlight, 'splash')}</div>
        <div class="recruit-banner-top">
          <div class="recruit-banner-title">${TIER_LABELS[tier]} Recruit</div>
          <div class="recruit-banner-sub">${TIER_LABELS[tier]} heroes · shards · fragments</div>
        </div>
        <div class="recruit-banner-body">
          <div class="recruit-banner-tokens"><span>Tokens</span><span class="recruit-token-count" data-tier="${tier}">${count}</span></div>
          <div class="recruit-banner-actions" data-tier="${tier}" data-count="${count}">${this._pullButtonsHtml(tier, count)}</div>
          <div class="recruit-pity">
            <div class="recruit-pity-line">
              <span class="recruit-pity-text" data-tier="${tier}">${this._pityText(tier, count)}</span>
              <details class="recruit-rates">
                <summary>Odds</summary>
                <div class="recruit-rates-body">
                  <div>New hero chance: ${(pity.rate * 100).toFixed(1)}%</div>
                  <div>${pity.guaranteeLabel}</div>
                  <div>Pulls until guarantee: ${pity.pullsUntilGuarantee}</div>
                  <div class="recruit-rates-note">Soft pity ramps from pull ${pity.softPityFrom}.</div>
                </div>
              </details>
            </div>
            <span class="hq-bar recruit-pity-bar" data-tier="${tier}"><i style="width:${this._pityPct(tier)}%"></i></span>
          </div>
        </div>
      </div>`;
  }

  _cardListHtml() {
    const specificCards = Object.values(HEROES_CONFIG)
      .map(cfg => ({ id: cfg.recruitCard, name: INVENTORY_ITEMS[cfg.recruitCard]?.name ?? cfg.name }));
    const universalCards = Object.values(INVENTORY_ITEMS)
      .filter(item => item.type === 'hero_card_universal')
      .map(item => ({ id: item.id, name: item.name }));
    const ownedHeroIds = new Set(
      this._s.heroes?.getRosterWithState?.().filter(h => h.isOwned).map(h => h.id) ?? []
    );

    const owned = [...specificCards, ...universalCards]
      .map(e => ({ ...e, qty: this._s.inventory?.getQuantity(e.id) ?? 0 }))
      .filter(e => e.qty > 0);

    if (owned.length === 0) return `<div class="recruit-empty">No hero cards yet.</div>`;

    return owned.map(({ id, name, qty }) => {
      const itemCfg = INVENTORY_ITEMS[id];
      let isOwned = false;
      if (itemCfg?.type === 'hero_card') {
        isOwned = !!itemCfg.targetHeroId && ownedHeroIds.has(itemCfg.targetHeroId);
      } else if (itemCfg?.type === 'hero_card_universal') {
        const heroesOfTier = Object.values(HEROES_CONFIG).filter(h => h.tier === itemCfg.targetTier);
        isOwned = heroesOfTier.length > 0 && heroesOfTier.every(h => ownedHeroIds.has(h.id));
      }
      if (isOwned) {
        const label = itemCfg?.type === 'hero_card_universal' ? 'All owned' : 'Owned';
        return `<span class="recruit-card-chip recruit-card-chip--owned">${escapeHtml(name)} · ${label}</span>`;
      }
      return `
        <span class="recruit-card-chip">${escapeHtml(name)} ×${qty}
          <button type="button" class="btn btn-xs btn-primary btn-use-card" data-card="${escapeHtml(id)}">Use</button>
        </span>`;
    }).join('');
  }

  _exchangeHtml() {
    const rate = EXCHANGE_CONFIG.tierShardsPerHeroShard;
    const roster = this._s.heroes.getRosterWithState?.() ?? [];
    return `
      <header class="recruit-box-head"><span class="recruit-section-title">Shard exchange</span><span class="recruit-box-note recruit-exchange-note">${rate} tier shards → 1 Hero Shard</span></header>
      ${TIERS.map(t => this._exchangeTierHtml(t, rate, roster)).join('')}`;
  }

  _exchangeTierHtml(tier, rate, roster) {
    const qty = this._s.inventory?.getQuantity(`tier_shard_${tier}`) ?? 0;
    const heroes = Object.values(HEROES_CONFIG).filter(h => h.tier === tier);
    return `
      <div class="recruit-exchange-row hq-rarity--${tier}" data-tier="${tier}">
        <span class="recruit-exchange-dot"></span>
        <span class="recruit-exchange-label">${TIER_LABELS[tier]} · <span class="recruit-exchange-qty" data-tier="${tier}">${qty}</span></span>
        <select class="recruit-exchange-hero" data-tier="${tier}">
          ${heroes.map(h => {
            const state = roster.find(r => r.id === h.id);
            const maxed = !!state?.isOwned && state.stars >= AWAKENING_CONFIG.maxStars;
            return `<option value="${h.id}">${h.name}${maxed ? ' (Maxed — converts to tier shards)' : ''}</option>`;
          }).join('')}
        </select>
        <button type="button" class="btn btn-xs btn-primary btn-exchange" data-tier="${tier}" ${qty < rate ? 'disabled' : ''}>Exchange</button>
      </div>`;
  }

  _onClick(e) {
    if (this._revealing) return;
    const pull = e.target.closest('.btn-pull');
    if (pull && !pull.disabled) {
      eventBus.emit('ui:click');
      this._pull(pull.dataset.tier, parseInt(pull.dataset.count, 10));
      return;
    }
    const card = e.target.closest('.btn-use-card');
    if (card) { eventBus.emit('ui:click'); this._useCard(card.dataset.card); return; }
    const exchange = e.target.closest('.btn-exchange');
    if (exchange && !exchange.disabled) { eventBus.emit('ui:click'); this._exchange(exchange.dataset.tier); }
  }

  _useCard(cardId) {
    const r = this._s.heroes.recruitWithCard(cardId);
    if (!r.success) {
      eventBus.emit('ui:error');
      this._s.notifications?.show('warning', 'Cannot Recruit', r.reason);
      return;
    }
    const heroName = HEROES_CONFIG[r.heroId]?.name ?? r.heroId;
    this._s.notifications?.show('success', '👑 Hero Recruited!', `${heroName} has joined your roster!`);
  }

  _exchange(tier) {
    const heroId = this._root.querySelector(`.recruit-exchange-hero[data-tier="${tier}"]`)?.value;
    if (!heroId) return;
    const r = this._s.heroes.exchangeTierShards(tier, heroId, 1);
    if (!r.success) {
      eventBus.emit('ui:error');
      this._s.notifications?.show('warning', 'Cannot Exchange', r.reason);
      return;
    }
    const heroName = HEROES_CONFIG[heroId]?.name ?? heroId;
    if (r.outcome === 'overflow') {
      const spent = EXCHANGE_CONFIG.tierShardsPerHeroShard * r.count;
      const refunded = EXCHANGE_CONFIG.maxedOverflowToTierShards * r.count;
      this._s.notifications?.show(
        'warning',
        'Hero Already Maxed',
        `${heroName} is at max stars, so no Hero Shard was granted. Spent ${spent} tier shards, refunded ${refunded} back.`,
      );
    } else {
      this._s.notifications?.show('success', 'Shard Exchanged', `Received 1 Hero Shard for ${heroName}.`);
    }
  }

  _pull(tier, count) {
    const results = [];
    this._revealing = true;
    for (let i = 0; i < count; i++) {
      const r = this._s.heroes.rollToken(tier);
      if (!r.outcome) break;
      results.push(r);
    }
    if (results.length === 0) {
      this._revealing = false;
      eventBus.emit('ui:error');
      this._s.notifications?.show('warning', 'No Tokens', `You have no ${tier} recruit tokens.`);
      return;
    }
    this._sequence = runPullSequence(this._root, results, {
      reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
      footerHtml:   () => this._revealFooterHtml(tier),
      onDone:       () => this._endReveal(),
      onPullAgain:  n => { this._endReveal(); this._pull(tier, n); },
      onViewHero:   heroId => eventBus.emit('ui:openHeroDetail', heroId),
    });
  }
}
