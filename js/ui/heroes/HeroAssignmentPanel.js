import { eventBus } from '../../core/EventBus.js';
import { BUILDINGS_CONFIG } from '../../entities/GAME_DATA.js';
import { activeSkillCountAt } from '../../systems/hero/heroSkillActivation.js';
import { iconFromEmoji } from '../icons.js';
import { escapeHtml } from '../uiUtils.js';
import { portraitHtml, buildingNameOf } from './heroCardView.js';
import { stationRows } from './stationBoard.js';

const skillCountLabel = n => `${n} skill${n === 1 ? '' : 's'}`;

export class HeroAssignmentPanel {
  constructor(systems) {
    this._s = systems;
    this._root = null;
    this._focusHeroId = null;
    this._openSlot = null;
  }

  init(rootEl) {
    this._root = rootEl;
    rootEl.addEventListener('click', e => this._onClick(e));
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
    this._root.innerHTML = `
      <div class="hero-board-header">
        ${this._slotsHtml()}
        ${this._focusHeroId ? `<span class="hero-board-focus">Posting <strong>${escapeHtml(this._focusName())}</strong> — pick a post</span>` : ''}
        <span class="hero-board-note">Squad leaders are posted in the Barracks.</span>
      </div>
      <div class="hero-board-rows">
        ${rows.map(r => this._rowHtml(r)).join('') || `<div class="heroes-empty">Build a production building to station heroes.</div>`}
      </div>`;
  }

  patch() {
    if (!this._root || this._openSlot) return;
    this.render();
  }

  _rows() { return stationRows(this._s.bm.getActiveBuildings(), this._s.heroes.getRosterWithState()); }

  _focusName() {
    return this._s.heroes.getRosterWithState().find(h => h.id === this._focusHeroId)?.name ?? '';
  }

  _slotsHtml() {
    const assigned = this._s.heroes.getTotalAssignedToBuildings();
    const available = this._s.heroes.getAvailableHeroSlots();
    if (available === 0) {
      return `<span class="hero-board-slots hero-board-slots--none">Build the Hero Quarters to open slots</span>`;
    }
    const segments = Array.from({ length: available }, (_, i) => `<i class="${i < assigned ? 'is-filled' : ''}"></i>`).join('');
    return `<span class="hero-board-slots">Hero slots: ${assigned} / ${available}</span><span class="hero-board-meter">${segments}</span>`;
  }

  _rowHtml(row) {
    const occupied = !!row.occupant;
    return `
      <div class="hero-board-row${occupied ? ' hero-board-row--occupied' : ''}" data-instance="${row.instanceId}">
        <div class="hero-board-building">
          <span class="hero-board-building-icon">${iconFromEmoji(BUILDINGS_CONFIG[row.buildingType]?.icon ?? '')}</span>
          <span class="hero-board-building-text">
            <span class="hero-board-building-name">${escapeHtml(row.buildingName)}</span>
            <span class="hero-board-building-level">Lv ${row.level}</span>
          </span>
        </div>
        <div class="hero-board-effect${row.hasBonus ? '' : ' hero-board-effect--none'}">${row.effectLabel}</div>
        ${occupied ? this._occupantHtml(row) : `<button type="button" class="hero-board-empty btn-board-assign" data-instance="${row.instanceId}">+ Assign hero</button>`}
      </div>`;
  }

  _occupantHtml(row) {
    const hero = row.occupant;
    return `
      <div class="hero-board-slot">
        ${portraitHtml(hero, 'thumb')}
        <span class="hero-board-occupant">
          <span class="hero-board-occupant-name">${escapeHtml(hero.name)}</span>
          <span class="hero-board-active">${skillCountLabel(activeSkillCountAt(hero, row.buildingType))} active</span>
        </span>
        <button type="button" class="btn btn-xs hq-btn-secondary btn-board-assign" data-instance="${row.instanceId}">Swap</button>
        <button type="button" class="btn btn-xs btn-danger btn-board-remove" data-hero="${hero.id}" aria-label="Remove ${escapeHtml(hero.name)}">✕</button>
      </div>`;
  }

  _onClick(e) {
    const assign = e.target.closest('.btn-board-assign');
    if (assign) { eventBus.emit('ui:click'); this._openPicker(assign.dataset.instance); return; }
    const remove = e.target.closest('.btn-board-remove');
    if (remove) {
      eventBus.emit('ui:click');
      const r = this._s.heroes.unassignHeroFromBuilding(remove.dataset.hero);
      if (!r.success) this._fail(r.reason);
      return;
    }
    const pick = e.target.closest('.hero-board-pick');
    if (pick && !pick.disabled) {
      eventBus.emit('ui:click');
      const instanceId = pick.closest('.hero-board-picker').dataset.instance;
      this._openSlot = null;
      this._focusHeroId = null;
      const r = this._s.heroes.assignHeroToBuilding(pick.dataset.hero, instanceId);
      if (!r.success) { this._fail(r.reason); this.render(); }
    }
  }

  _openPicker(instanceId) {
    const rowEl = this._root.querySelector(`.hero-board-row[data-instance="${instanceId}"]`);
    if (!rowEl || rowEl.querySelector('.hero-board-picker')) return;
    const row = this._rows().find(r => r.instanceId === instanceId);
    if (!row) return;
    this._openSlot = instanceId;

    const candidates = this._s.heroes.getRosterWithState()
      .filter(h => h.isOwned && h.assignment?.buildingId !== instanceId)
      .sort((a, b) => (!!a.assignedBuilding) - (!!b.assignedBuilding));

    const picker = document.createElement('div');
    picker.className = 'hero-board-picker';
    picker.dataset.instance = instanceId;
    picker.innerHTML = candidates.length === 0
      ? `<div class="hero-board-picker-empty">No available heroes. Recruit one first.</div>`
      : candidates.map(h => `
          <button type="button" class="hero-board-pick" data-hero="${h.id}"${h.assignedBuilding ? ' disabled' : ''}>
            ${portraitHtml(h, 'thumb')}
            <span class="hero-board-pick-text">
              <span class="hero-board-pick-name">${escapeHtml(h.name)}</span>
              <span class="hero-board-pick-note">${h.assignedBuilding
                ? `At ${escapeHtml(buildingNameOf(h.assignedBuilding))} · remove first`
                : `${skillCountLabel(activeSkillCountAt(h, row.buildingType))} active here`}</span>
            </span>
          </button>`).join('');
    rowEl.appendChild(picker);
  }

  _fail(reason) {
    eventBus.emit('ui:error');
    this._s.notifications?.show('warning', 'Cannot Assign', reason ?? 'Assignment failed.');
  }
}
