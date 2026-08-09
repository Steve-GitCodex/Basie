import { icon } from '../icons.js';

export class InventoryBuffSection {
  constructor(systems) {
    this._s = systems;
  }

  build() {
    const section = document.createElement('div');
    section.className = 'inv-buff-section';
    section.id = 'inv-buff-section';
    const heading = document.createElement('div');
    heading.className = 'inv-buff-heading';
    heading.innerHTML = `<span class="buff-heading-icon">${icon('production')}</span> Active Buffs`;
    section.appendChild(heading);
    this._renderCards(section);
    return section;
  }

  refresh() {
    const section = document.getElementById('inv-buff-section');
    if (!section) return;
    this._renderCards(section);
  }

  _renderCards(container) {
    container.querySelectorAll('.buff-card-list').forEach(el => el.remove());

    const buffs = this._s.heroes.getActiveBuffsWithRemaining?.() ?? [];
    const list  = document.createElement('div');
    list.className = 'buff-card-list';

    if (buffs.length === 0) {
      list.innerHTML = `
        <div class="buff-empty">
          <span class="buff-empty-icon">⏳</span>
          <p>No active buffs.</p>
          <p class="buff-empty-hint">Use production boost items from your Inventory to temporarily increase all resource rates.</p>
        </div>`;
    } else {
      buffs.forEach((b, i) => {
        const remainSec = Math.ceil(b.remaining / 1000);
        const hours     = Math.floor(remainSec / 3600);
        const mins      = Math.floor((remainSec % 3600) / 60);
        const secs      = remainSec % 60;
        const timeStr   = hours > 0
          ? `${hours}h ${mins}m`
          : mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

        const card = document.createElement('div');
        card.className = 'buff-card';
        card.dataset.buffIndex = i;
        card.innerHTML = `
          <div class="buff-card-icon">${icon("production")}</div>
          <div class="buff-card-body">
            <div class="buff-card-name">Production Boost</div>
            <div class="buff-card-effect">+${(b.value * 100).toFixed(0)}% all resources</div>
          </div>
          <div class="buff-card-timer">
            <div class="buff-timer-label">Time Left</div>
            <div class="buff-timer-value">${timeStr}</div>
            <div class="buff-timer-bar"><div class="buff-timer-fill" style="width:${Math.min(100, (b.remaining / b.durationMs) * 100).toFixed(1)}%"></div></div>
          </div>`;
        list.appendChild(card);
      });
    }

    container.appendChild(list);
  }
}
