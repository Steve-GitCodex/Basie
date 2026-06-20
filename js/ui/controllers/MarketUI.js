/**
 * MarketUI.js
 * Renders the market trade cards view.
 */
import { eventBus } from '../../core/EventBus.js';
import { RES_META, fmt } from '../uiUtils.js';
import { icon } from '../icons.js';

export class MarketUI {
  /**
   * @param {{ rm, market, notifications }} systems
   */
  constructor(systems) {
    this._s = systems;
  }

  init() {
    eventBus.on('ui:viewChanged', v  => { if (v === 'market') this.render(); });
    eventBus.on('market:traded',  () => this.render());
  }

  render() {
    const grid = document.getElementById('market-grid');
    if (!grid) return;
    grid.innerHTML = '';

    this._s.market.getTradesWithPrices().forEach(trade => {
      const inflated = parseFloat(trade.inflationMult) > 1.0;

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-header">
          <div class="card-icon">${trade.icon}</div>
          <div style="flex:1;min-width:0">
            <div class="card-title">${trade.label}</div>
            <div class="card-subtitle">${trade.description}</div>
          </div>
        </div>
        <div class="card-body">
          <div class="cost-row">
            <span class="cost-chip ${trade.canAfford ? 'affordable' : 'unaffordable'}">${RES_META[trade.from.resource]?.icon} ${fmt(trade.currentCost)} ${trade.from.resource}</span>
            <span style="color:var(--clr-text-muted)">→</span>
            <span class="cost-chip affordable">${RES_META[trade.to.resource]?.icon} ${fmt(trade.currentGain)} ${trade.to.resource}</span>
          </div>
          ${!trade.canAfford ? `<p style="font-size:var(--text-xs);color:var(--clr-danger);margin-top:var(--space-1)">${icon('lock')} Not enough ${RES_META[trade.from.resource]?.name ?? trade.from.resource}</p>` : ''}
          ${inflated ? `<p style="font-size:var(--text-xs);color:var(--clr-warning)">${icon('warning')} ×${trade.inflationMult} price (${trade.purchaseCount} purchases)</p>` : ''}
        </div>
        <div class="card-footer">
          <button class="btn btn-sm ${trade.canAfford ? 'btn-gold' : 'btn-ghost'} btn-trade" ${!trade.canAfford ? 'disabled' : ''}>Trade</button>
        </div>`;

      card.querySelector('.btn-trade')?.addEventListener('click', () => {
        eventBus.emit('ui:click');
        const r = this._s.market.trade(trade.id);
        if (!r.success) {
          eventBus.emit('ui:error');
          this._s.notifications?.show('warning', 'Trade Failed', r.reason);
        } else {
          this._s.notifications?.show('success', '🏪 Trade Done', 'Spent → Gained resources');
          this.render();
        }
      });

      grid.appendChild(card);
    });
  }
}
