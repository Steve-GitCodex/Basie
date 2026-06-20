/**
 * GachaUI.js
 * Handles the gacha recruitment roll modal experience.
 *
 * Flow:
 *   1. Player clicks "Roll" on a recruitment_scroll item in InventoryUI.
 *   2. InventoryUI emits 'ui:openGacha' with { scrollTier }.
 *   3. GachaUI opens the modal, plays a dice-flip animation, then calls
 *      inventory.useItem(scrollId) which delegates to HeroManager.rollScroll().
 *   4. Result is revealed with a card-flip animation and rarity glow.
 *   5. "Roll Again" appears if more scrolls of the same tier are available.
 *   6. A session-only "Last 5 Rolls" history strip is shown at the bottom.
 */
import { eventBus }         from '../../core/EventBus.js';
import { INVENTORY_ITEMS,
         HEROES_CONFIG,
         GACHA_CONFIG }     from '../../entities/GAME_DATA.js';
import { icon, iconFromEmoji } from '../icons.js';

const TIER_COLORS = {
  common:    'var(--clr-tier-common)',
  rare:      'var(--clr-tier-rare)',
  legendary: 'var(--clr-tier-legendary)',
};

const OUTCOME_META = {
  resource: { icon: icon('box'),          label: 'Resource Bundle' },
  xp_item:  { icon: icon('xp'),          label: 'XP Tome' },
  buff:      { icon: icon('flask-potion'), label: 'Production Buff' },
  fragment:  { icon: icon('flask-potion'), label: 'Hero Fragment' },
  hero:      { icon: icon('crown'),        label: 'Hero Recruited' },
};

export class GachaUI {
  /** @param {{ inventory, heroes, notifications }} systems */
  constructor(systems) {
    this._s       = systems;
    this._history = []; // session-only, last 10
    this._modal   = null;
  }

  init() {
    eventBus.on('ui:openGacha', ({ scrollTier, count = 1 }) => this._open(scrollTier, count));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OPEN / CLOSE
  // ─────────────────────────────────────────────────────────────────────────

  _open(scrollTier, count = 1) {
    this._close(); // Remove any existing

    const overlay = document.createElement('div');
    overlay.id        = 'gacha-modal-overlay';
    overlay.className = 'gacha-overlay';
    overlay.addEventListener('click', e => { if (e.target === overlay) this._close(); });

    const modal = document.createElement('div');
    modal.id        = 'gacha-modal';
    modal.className = 'gacha-modal';
    modal.innerHTML = this._buildIdleHtml(scrollTier);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this._modal = modal;

    // Trigger roll immediately after a short display delay
    requestAnimationFrame(() => {
      overlay.classList.add('gacha-overlay--open');
      modal.classList.add('gacha-modal--open');
      if (count > 1) {
        setTimeout(() => this._startMultiRoll(scrollTier, count), 300);
      } else {
        setTimeout(() => this._startRoll(scrollTier), 300);
      }
    });
  }

  _close() {
    const existing = document.getElementById('gacha-modal-overlay');
    if (existing) existing.remove();
    this._modal = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ROLLING
  // ─────────────────────────────────────────────────────────────────────────

  _startRoll(scrollTier) {
    if (!this._modal) return;

    // Show rolling animation phase
    this._modal.innerHTML = this._buildRollingHtml(scrollTier);

    // Wait for animation, then execute the real roll
    setTimeout(() => {
      const scrollId = `scroll_${scrollTier}`;
      const r = this._s.inventory.useItem(scrollId);

      if (!r.success || !r.gachaResult) {
        this._modal.innerHTML = this._buildErrorHtml(r.reason ?? 'Roll failed.');
        return;
      }

      const result = r.gachaResult;
      this._addToHistory(result);
      this._modal.innerHTML = this._buildResultHtml(result, scrollTier);
      this._bindResultListeners(scrollTier);

    }, 1800); // animation duration
  }

  _addToHistory(result) {
    this._history.unshift(result);
    if (this._history.length > 10) this._history.pop();
  }

  _startMultiRoll(scrollTier, count) {
    if (!this._modal) return;

    this._modal.innerHTML = this._buildMultiRollingHtml(scrollTier, count);

    // Single short animation, then execute all pulls at once
    setTimeout(() => {
      const scrollId = `scroll_${scrollTier}`;
      const results  = [];
      for (let i = 0; i < count; i++) {
        const r = this._s.inventory.useItem(scrollId);
        if (!r.success || !r.gachaResult) break; // ran out of scrolls
        results.push(r.gachaResult);
        this._addToHistory(r.gachaResult);
      }

      if (results.length === 0) {
        this._modal.innerHTML = this._buildErrorHtml('Not enough scrolls to pull.');
        return;
      }

      this._modal.innerHTML = this._buildMultiResultHtml(results, scrollTier);
      this._bindMultiResultListeners(scrollTier);
    }, 800);
  }

  _buildMultiRollingHtml(scrollTier, count) {
    const tierGlowClass = `gacha-stage--glow-${scrollTier}`;
    return `
      <div class="gacha-panel">
        <div class="gacha-header">
          <div class="gacha-header-left">
            <span class="gacha-scroll-tier-badge gacha-scroll-tier-badge--${scrollTier}">${scrollTier.charAt(0).toUpperCase() + scrollTier.slice(1)}</span>
            <h2 class="gacha-title">Rolling ${count}×…</h2>
          </div>
        </div>
        <div class="gacha-stage gacha-stage--rolling ${tierGlowClass}">
          <div class="gacha-dice gacha-dice--spin">${icon('scroll', 'icon--active')}</div>
          <p class="gacha-rolling-text">Rolling ${count} scroll${count !== 1 ? 's' : ''}…</p>
        </div>
      </div>`;
  }

  _buildMultiResultHtml(results, scrollTier) {
    const scrollsLeft = this._s.inventory.getQuantity(`scroll_${scrollTier}`);

    // Tally outcomes
    const tally = { hero: 0, fragment: 0, xp_item: 0, buff: 0, resource: 0 };
    const newHeroes = [];
    for (const r of results) {
      if (r.outcome in tally) tally[r.outcome]++;
      if (r.outcome === 'hero' && !r.isDuplicate) {
        const heroCfg = HEROES_CONFIG[r.heroId];
        if (heroCfg) newHeroes.push(heroCfg);
      }
    }

    const summaryParts = [];
    if (tally.hero     > 0) summaryParts.push(`${icon('crown')} ${tally.hero} Hero${tally.hero > 1 ? 'es' : ''}`);
    if (tally.fragment > 0) summaryParts.push(`${icon('flask-potion')} ${tally.fragment} Fragment${tally.fragment > 1 ? 's' : ''}`);
    if (tally.xp_item  > 0) summaryParts.push(`${icon('xp')} ${tally.xp_item} XP Tome${tally.xp_item > 1 ? 's' : ''}`);
    if (tally.buff     > 0) summaryParts.push(`${icon('flask-potion')} ${tally.buff} Buff${tally.buff > 1 ? 's' : ''}`);
    if (tally.resource > 0) summaryParts.push(`${icon('box')} ${tally.resource} Bundle${tally.resource > 1 ? 's' : ''}`);

    const heroListHtml = newHeroes.length > 0
      ? `<div class="gacha-multi-heroes">
          <div class="gacha-multi-heroes-label">New recruits:</div>
          ${newHeroes.map(h => `<span class="gacha-multi-hero-chip gacha-multi-hero-chip--${h.tier}">${iconFromEmoji(h.icon ?? '') || icon('crown')} ${h.name}</span>`).join('')}
        </div>`
      : '';

    // Individual result rows for expanded view
    const detailRows = results.map((r, i) => {
      const meta = OUTCOME_META[r.outcome] ?? { icon: '❓', label: 'Unknown' };
      let name     = '';
      let tierChip = '';
      if (r.outcome === 'hero' || r.outcome === 'fragment') {
        const heroCfg = r.heroId ? HEROES_CONFIG[r.heroId] : null;
        name     = heroCfg?.name ?? r.heroId ?? '';
        const tier = heroCfg?.tier ?? 'common';
        tierChip = `<span class="gacha-multi-row-tier gacha-multi-row-tier--${tier}">${tier.charAt(0).toUpperCase() + tier.slice(1)}</span>`;
      } else {
        const itemCfg = r.itemId ? INVENTORY_ITEMS[r.itemId] : null;
        name = itemCfg?.name ?? meta.label;
      }
      return `
        <div class="gacha-multi-row">
          <span class="gacha-multi-row-num">${i + 1}</span>
          <span class="gacha-multi-row-icon">${meta.icon}</span>
          <span class="gacha-multi-row-name">${name}${r.isDuplicate ? ' <em>(Dupe)</em>' : ''}</span>
          ${tierChip}
        </div>`;
    }).join('');

    // Bulk repeat buttons for footer
    const can10  = scrollsLeft >= 10;
    const can100 = scrollsLeft >= 100;
    const bulkButtonsHtml = scrollsLeft >= 10 ? `
      <div class="gacha-multi-repeat">
        <button class="btn gacha-roll-again gacha-multi-again" data-count="10" ${can10 ? '' : 'disabled'}>
          ${icon('scroll')} Roll 10× <span class="gacha-roll-count">(10 scrolls)</span>
        </button>
        <button class="btn gacha-roll-again gacha-multi-again" data-count="100" ${can100 ? '' : 'disabled'}>
          ${icon('scroll')} Roll 100× <span class="gacha-roll-count">(100 scrolls)</span>
        </button>
      </div>` : '';

    const tierGlowClass = `gacha-stage--glow-${scrollTier}`;
    return `
      <div class="gacha-panel">
        <div class="gacha-header">
          <div class="gacha-header-left">
            <span class="gacha-scroll-tier-badge gacha-scroll-tier-badge--${scrollTier}">${scrollTier.charAt(0).toUpperCase() + scrollTier.slice(1)}</span>
            <h2 class="gacha-title">${results.length}× Pull Results</h2>
          </div>
          <button class="gacha-close-x gacha-close-btn" id="gacha-close">✕</button>
        </div>
        <div class="gacha-stage gacha-stage--result ${tierGlowClass}">
          <div class="gacha-multi-summary">
            <div class="gacha-multi-tally">${summaryParts.join(' · ')}</div>
            ${heroListHtml}
          </div>
          <button class="btn btn-ghost gacha-multi-expand" id="gacha-multi-expand" data-count="${results.length}">
            ▾ View all ${results.length} result${results.length !== 1 ? 's' : ''}
          </button>
          <div class="gacha-multi-list hidden" id="gacha-multi-list">
            ${detailRows}
          </div>
        </div>
        <div class="gacha-footer">
          ${scrollsLeft > 0
            ? `<button class="btn btn-gold gacha-roll-again" id="gacha-roll-again">
                 ${icon('scroll')} Roll Again (1×)
                 <span class="gacha-roll-count">×${scrollsLeft} remaining</span>
               </button>`
            : `<div class="gacha-no-scrolls">No more ${scrollTier} scrolls — buy more from the <strong>Shop</strong>.</div>`}
          ${bulkButtonsHtml}
          <button class="btn btn-ghost gacha-close-btn gacha-close-link" id="gacha-close-2">Close</button>
        </div>
        ${this._buildHistoryHtml()}
      </div>`;
  }

  _bindMultiResultListeners(scrollTier) {
    this._modal?.querySelectorAll('.gacha-close-btn, .gacha-close-x').forEach(btn => {
      btn.addEventListener('click', () => { eventBus.emit('ui:click'); this._close(); });
    });

    this._modal?.querySelector('#gacha-roll-again')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      this._startRoll(scrollTier);
    });

    const expandBtn = this._modal?.querySelector('#gacha-multi-expand');
    expandBtn?.addEventListener('click', () => {
      const list    = this._modal?.querySelector('#gacha-multi-list');
      const count   = expandBtn.dataset.count;
      const opening = list?.classList.contains('hidden');
      list?.classList.toggle('hidden');
      expandBtn.textContent = opening
        ? '▴ Hide results'
        : `▾ View all ${count} result${count !== '1' ? 's' : ''}`;
    });

    this._modal?.querySelectorAll('.gacha-multi-again').forEach(btn => {
      btn.addEventListener('click', e => {
        eventBus.emit('ui:click');
        const count = parseInt(e.currentTarget.dataset.count, 10);
        this._startMultiRoll(scrollTier, count);
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HTML BUILDERS
  // ─────────────────────────────────────────────────────────────────────────

  _buildIdleHtml(scrollTier) {
    const scrollCfg = INVENTORY_ITEMS[`scroll_${scrollTier}`];
    const tierGlowClass = `gacha-stage--glow-${scrollTier}`;
    return `
      <div class="gacha-panel">
        <div class="gacha-header">
          <div class="gacha-header-left">
            <span class="gacha-scroll-tier-badge gacha-scroll-tier-badge--${scrollTier}">${scrollTier.charAt(0).toUpperCase() + scrollTier.slice(1)}</span>
            <h2 class="gacha-title">${scrollCfg?.name ?? 'Recruitment Scroll'}</h2>
          </div>
          <button class="gacha-close-x" id="gacha-close">✕</button>
        </div>
        <div class="gacha-stage ${tierGlowClass}">
          <div class="gacha-idle-icon">${iconFromEmoji(scrollCfg?.icon ?? '') || icon('scroll')}</div>
          <p class="gacha-idle-label">Preparing the roll…</p>
        </div>
      </div>`;
  }

  _buildRollingHtml(scrollTier) {
    const tierGlowClass = `gacha-stage--glow-${scrollTier}`;
    return `
      <div class="gacha-panel">
        <div class="gacha-header">
          <div class="gacha-header-left">
            <span class="gacha-scroll-tier-badge gacha-scroll-tier-badge--${scrollTier}">${scrollTier.charAt(0).toUpperCase() + scrollTier.slice(1)}</span>
            <h2 class="gacha-title">Rolling…</h2>
          </div>
        </div>
        <div class="gacha-stage gacha-stage--rolling ${tierGlowClass}">
          <div class="gacha-dice gacha-dice--spin">${icon('scroll', 'icon--active')}</div>
          <p class="gacha-rolling-text">The dice fall…</p>
        </div>
      </div>`;
  }

  _buildResultHtml(result, scrollTier) {
    const outcomeMeta = OUTCOME_META[result.outcome] ?? { icon: icon('x-circle'), label: 'Unknown' };
    let resultTitle  = outcomeMeta.label;
    let glowClass    = '';
    let resultTier   = '';
    let iconHtml     = '';
    let detailHtml   = '';
    let badgeHtml    = '';

    if (result.outcome === 'hero') {
      const heroCfg = HEROES_CONFIG[result.heroId];
      const tier    = heroCfg?.tier ?? 'common';
      glowClass     = `gacha-result--${tier}`;
      resultTier    = tier;
      resultTitle   = result.isDuplicate ? `${icon('warning')} Duplicate Hero!` : 'Hero Recruited!';
      iconHtml      = `<div class="gacha-result-hero-icon gacha-result-hero-icon--${tier}">${iconFromEmoji(heroCfg?.icon ?? '') || icon('crown')}</div>`;
      badgeHtml     = `<span class="gacha-result-tier-badge gacha-result-tier-badge--${tier}">${tier.charAt(0).toUpperCase() + tier.slice(1)}</span>`;
      detailHtml    = `
        <div class="gacha-result-name">${heroCfg?.name ?? result.heroId}</div>
        <div class="gacha-result-sub">${heroCfg?.title ?? ''}</div>
        ${result.isDuplicate
          ? `<div class="gacha-notice gacha-notice--warning">Already owned — a duplicate card was added for Awakening.</div>`
          : `<div class="gacha-notice gacha-notice--info">Hero joined your roster! Visit <strong>Heroes</strong> to assign them.</div>`}`;

    } else if (result.outcome === 'fragment') {
      const heroCfg  = result.heroId ? HEROES_CONFIG[result.heroId] : null;
      const fragCfg  = result.itemId ? INVENTORY_ITEMS[result.itemId] : null;
      const tier     = heroCfg?.tier ?? 'common';
      glowClass      = `gacha-result--${tier}`;
      resultTier     = tier;
      resultTitle    = 'Hero Fragment!';
      iconHtml       = `<div class="gacha-result-generic-icon">${iconFromEmoji(fragCfg?.icon ?? '') || icon('flask-potion')}</div>`;
      badgeHtml      = `<span class="gacha-result-tier-badge gacha-result-tier-badge--${tier}">${tier.charAt(0).toUpperCase() + tier.slice(1)} Fragment</span>`;

      const ownedFrag  = result.fragmentsOwned ?? 0;
      const neededFrag = result.fragmentsNeeded ?? GACHA_CONFIG.fragmentsToSummon[tier] ?? 10;
      const pct        = Math.min(100, Math.round((ownedFrag / neededFrag) * 100));

      detailHtml = `
        <div class="gacha-result-name">${fragCfg?.name ?? 'Hero Fragment'}</div>
        <div class="gacha-result-sub">For ${heroCfg?.name ?? result.heroId}</div>
        <div class="gacha-frag-progress">
          <div class="gacha-frag-bar-header">
            <span>Fragment Progress</span>
            <span>${ownedFrag} / ${neededFrag}</span>
          </div>
          <div class="gacha-frag-bar-track">
            <div class="gacha-frag-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>
        ${result.canSummon
          ? `<div class="gacha-notice gacha-notice--success">${icon('star-burst', 'icon--gold')} Enough fragments to summon! Visit the Heroes tab.</div>`
          : ''}`;

    } else {
      // resource, xp_item, buff
      const itemCfg = result.itemId ? INVENTORY_ITEMS[result.itemId] : null;
      const rarity  = itemCfg?.rarity ?? 'common';
      glowClass     = `gacha-result--${rarity}`;
      resultTitle   = `${outcomeMeta.label}!`;
      iconHtml      = `<div class="gacha-result-generic-icon">${iconFromEmoji(itemCfg?.icon ?? '') || outcomeMeta.icon}</div>`;
      badgeHtml     = `<span class="gacha-result-type-badge gacha-result-type-badge--${result.outcome}">${outcomeMeta.label}</span>`;
      detailHtml    = `
        <div class="gacha-result-name">${itemCfg?.name ?? outcomeMeta.label}</div>
        <div class="gacha-result-sub">${itemCfg?.description ?? ''}</div>`;
    }

    const scrollsLeft  = this._s.inventory.getQuantity(`scroll_${scrollTier}`);
    const historyHtml  = this._buildHistoryHtml();
    const tierGlowClass = `gacha-stage--glow-${resultTier || scrollTier}`;
    const scrollCfg    = INVENTORY_ITEMS[`scroll_${scrollTier}`];

    return `
      <div class="gacha-panel">
        <div class="gacha-header">
          <div class="gacha-header-left">
            <span class="gacha-scroll-tier-badge gacha-scroll-tier-badge--${scrollTier}">${scrollTier.charAt(0).toUpperCase() + scrollTier.slice(1)}</span>
            <h2 class="gacha-title">${resultTitle}</h2>
          </div>
          <button class="gacha-close-x gacha-close-btn" id="gacha-close">✕</button>
        </div>
        <div class="gacha-stage gacha-stage--result ${tierGlowClass}">
          <div class="gacha-result-card ${glowClass}">
            ${iconHtml}
            ${badgeHtml}
            ${detailHtml}
          </div>
        </div>
        <div class="gacha-footer">
          ${scrollsLeft > 0
            ? `<button class="btn btn-gold gacha-roll-again" id="gacha-roll-again">
                 ${icon('scroll')} Roll Again
                 <span class="gacha-roll-count">×${scrollsLeft} remaining</span>
               </button>`
            : `<div class="gacha-no-scrolls">No more ${scrollTier} scrolls — buy more from the <strong>Shop</strong>.</div>`}
          <button class="btn btn-ghost gacha-close-btn gacha-close-link" id="gacha-close-2">Close</button>
        </div>
        ${historyHtml}
      </div>`;
  }

  _buildHistoryHtml() {
    if (this._history.length === 0) return '';
    const rows = this._history.map((r, i) => {
      const meta    = OUTCOME_META[r.outcome] ?? { icon: '❓', label: r.outcome };
      const subName = r.heroId
        ? (HEROES_CONFIG[r.heroId]?.name ?? r.heroId)
        : (r.itemId ? (INVENTORY_ITEMS[r.itemId]?.name ?? r.itemId) : '');
      const tierClass = r.outcome === 'hero' || r.outcome === 'fragment'
        ? `gacha-history-row--${HEROES_CONFIG[r.heroId]?.tier ?? 'common'}`
        : `gacha-history-row--${r.outcome}`;
      return `
        <div class="gacha-history-row ${i === 0 ? 'gacha-history-row--latest' : ''} ${tierClass}">
          <span class="gacha-history-dot"></span>
          <span class="gacha-history-icon">${meta.icon}</span>
          <div class="gacha-history-text">
            <span class="gacha-history-label">${meta.label}</span>
            ${subName ? `<span class="gacha-history-sub">${subName}${r.isDuplicate ? ' (Dupe)' : ''}</span>` : ''}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="gacha-history">
        <div class="gacha-history-title">Session Rolls (${this._history.length})</div>
        <div class="gacha-history-list">${rows}</div>
      </div>`;
  }

  _buildErrorHtml(msg) {
    return `
      <div class="gacha-panel">
        <div class="gacha-header">
          <div class="gacha-header-left">
            <h2 class="gacha-title">${icon('warning')} Error</h2>
          </div>
          <button class="gacha-close-x gacha-close-btn" id="gacha-close">✕</button>
        </div>
        <div class="gacha-stage">
          <div class="gacha-error-msg">${msg}</div>
        </div>
      </div>`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LISTENERS
  // ─────────────────────────────────────────────────────────────────────────

  _bindResultListeners(scrollTier) {
    this._modal?.querySelectorAll('.gacha-close-btn, .gacha-close-x').forEach(btn => {
      btn.addEventListener('click', () => { eventBus.emit('ui:click'); this._close(); });
    });

    this._modal?.querySelector('#gacha-roll-again')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      this._startRoll(scrollTier);
    });
  }
}
