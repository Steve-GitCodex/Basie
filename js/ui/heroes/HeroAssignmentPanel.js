import { eventBus } from '../../core/EventBus.js';
import { portraitHtml } from './heroCardView.js';
import { stationRows } from './stationBoard.js';

export class HeroAssignmentPanel {
  constructor(systems) {
    this._s = systems;
    this._root = null;
    this._focusHeroId = null;
    this._openSlot = null;
  }

  init(rootEl) {
    this._root = rootEl;
    eventBus.on('heroes:deployRequest', ({ heroId }) => this.focusHero(heroId));
  }

  focusHero(heroId) {
    this._focusHeroId = heroId;
    this.render();
  }

  render() {
    if (!this._root) return;
    this._openSlot = null;
    const rows = this._rows();
    const assigned = this._s.heroes.getTotalAssignedToBuildings();
    const available = this._s.heroes.getAvailableHeroSlots();

    this._root.innerHTML = `
      <div class="hero-board-header">
        <span class="hero-board-slots">Hero slots: ${assigned} / ${available}</span>
        ${this._focusHeroId ? `<span class="hero-board-focus">Posting <strong>${this._focusName()}</strong> — pick a slot</span>` : ''}
        <span class="hero-board-note">Squad postings are managed in the Barracks.</span>
      </div>
      <div class="hero-board-rows">
        ${rows.map(r => this._rowHtml(r)).join('') || `<div class="heroes-empty">Build a production building to station heroes.</div>`}
      </div>`;

    this._bind();
  }

  patch() {
    if (!this._root || this._openSlot) return;
    this.render();
  }

  _rows() { return stationRows(this._s.bm.getActiveBuildings(), this._s.heroes.getRosterWithState()); }

  _focusName() {
    return this._s.heroes.getRosterWithState().find(h => h.id === this._focusHeroId)?.name ?? '';
  }

  _rowHtml(row) {
    const occupied = !!row.occupant;
    return `
      <div class="hero-board-row${occupied ? ' hero-board-row--occupied' : ''}" data-instance="${row.instanceId}">
        <div class="hero-board-building">
          <span class="hero-board-building-name">${row.buildingName}</span>
          <span class="hero-board-building-level">Lv.${row.level}</span>
        </div>
        <div class="hero-board-effect${row.hasBonus ? '' : ' hero-board-effect--none'}">${row.effectLabel}</div>
        <div class="hero-board-slot">
          ${occupied
            ? `${portraitHtml(row.occupant, 'thumb')}<span class="hero-board-occupant">${row.occupant.name}</span>`
            : `<span class="hero-board-open">Open slot</span>`}
        </div>
        <div class="hero-board-actions">
          <button class="btn btn-xs btn-board-assign" data-instance="${row.instanceId}">${occupied ? 'Swap' : 'Assign'}</button>
          ${occupied ? `<button class="btn btn-xs btn-danger btn-board-remove" data-hero="${row.occupant.id}">Remove</button>` : ''}
        </div>
      </div>`;
  }

  _bind() {
    this._root.querySelectorAll('.btn-board-assign').forEach(btn => {
      btn.addEventListener('click', e => {
        eventBus.emit('ui:click');
        this._openPicker(e.currentTarget.dataset.instance);
      });
    });
    this._root.querySelectorAll('.btn-board-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        eventBus.emit('ui:click');
        const r = this._s.heroes.unassignHeroFromBuilding(e.currentTarget.dataset.hero);
        if (!r.success) this._fail(r.reason);
      });
    });
  }

  _openPicker(instanceId) {
    const row = this._root.querySelector(`.hero-board-row[data-instance="${instanceId}"]`);
    if (!row || row.querySelector('.hero-board-picker')) return;
    this._openSlot = instanceId;

    const candidates = this._s.heroes.getRosterWithState()
      .filter(h => h.isOwned && h.assignment?.buildingId !== instanceId)
      .sort((a, b) => (!!a.assignedBuilding) - (!!b.assignedBuilding));

    const picker = document.createElement('div');
    picker.className = 'hero-board-picker';
    picker.innerHTML = candidates.length === 0
      ? `<div class="hero-board-picker-empty">No available heroes. Recruit one first.</div>`
      : candidates.map(h => `
          <button class="hero-board-pick" data-hero="${h.id}">
            ${portraitHtml(h, 'thumb')}
            <span class="hero-board-pick-name">${h.name}</span>
            ${h.assignedBuilding ? `<span class="hero-board-pick-note">moving from ${h.assignedBuilding}</span>` : ''}
          </button>`).join('');
    row.appendChild(picker);

    picker.querySelectorAll('.hero-board-pick').forEach(btn => {
      btn.addEventListener('click', e => {
        eventBus.emit('ui:click');
        this._openSlot = null;
        this._focusHeroId = null;
        const r = this._s.heroes.assignHeroToBuilding(e.currentTarget.dataset.hero, instanceId);
        if (!r.success) { this._fail(r.reason); this.render(); }
      });
    });
  }

  _fail(reason) {
    eventBus.emit('ui:error');
    this._s.notifications?.show('warning', 'Cannot Assign', reason ?? 'Assignment failed.');
  }
}
