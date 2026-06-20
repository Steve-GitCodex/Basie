/**
 * BarracksUI.js
 * Per-building SQUAD MODAL (replaces the old #view-military Barracks sub-tab page).
 *
 * Opened from a Barracks tile tooltip (`ui:openSquads { buildingId, instanceIndex }`).
 * Each Barracks instance == one squad. Layout: ‹ squad name + Lv › · combat stat strip ·
 * 2×2 hero+unit slot tiles. A ‹ › pager cycles the player's built Barracks (squads).
 * Hero/unit assignment reuses the floating pickers below.
 */
import { eventBus } from '../../core/EventBus.js';
import { UNITS_CONFIG, BUILDINGS_CONFIG, HEROES_CONFIG, HERO_CLASSIFICATIONS } from '../../entities/GAME_DATA.js';
import { icon, iconFromEmoji } from '../icons.js';

export class BarracksUI {
  /** @param {{ rm, um, heroes, inventory, notifications }} systems */
  constructor(systems) {
    this._s = systems;
    this._activeInstance = 0; // index into built barracks instances
    this._open = false;
  }

  init() {
    eventBus.on('ui:openSquads', ({ instanceIndex } = {}) => this._openModal(instanceIndex));
    eventBus.on('army:updated',      () => { if (this._open) this._renderModal(); });
    eventBus.on('unit:queueUpdated', () => { if (this._open) this._renderModal(); });
    eventBus.on('heroes:updated',    () => { if (this._open) this._renderModal(); });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  _builtCount() {
    return this._s.um._bm?.getBuiltInstanceCount?.('barracks') ?? 0;
  }

  /**
   * Ensure a squad exists for built barracks instance `i`, then return it.
   * Keyed by `barracksInstanceId` (NOT array index) so deleting/recreating a squad
   * never breaks the instance↔squad mapping or collides with another instance.
   */
  _squadForInstance(i) {
    const um = this._s.um;
    const instId = `barracks_${i}`;
    let squad = um.getSquads().find(s => s.barracksInstanceId === instId);
    if (!squad && um.getSquads().length < um.getMaxSquads()) {
      const r = um.createSquad(`Squad ${i + 1}`, instId);
      squad = (r?.squadId ? um.getSquad?.(r.squadId) : null)
        ?? um.getSquads().find(s => s.barracksInstanceId === instId);
    }
    return squad ?? null;
  }

  // ── Open / render ─────────────────────────────────────────────────────────
  _openModal(instanceIndex) {
    const built = this._builtCount();
    if (built === 0) {
      this._s.notifications?.show('warning', 'No Barracks', 'Build a Barracks first to manage squads.');
      return;
    }
    const i = Number.isInteger(instanceIndex) ? instanceIndex : this._activeInstance;
    this._activeInstance = Math.max(0, Math.min(i, built - 1));
    this._panel = document.getElementById('squad-panel');
    this._sheet = document.getElementById('squad-sheet');
    if (!this._panel || !this._sheet) return;
    this._panel.classList.remove('hidden');
    document.body.classList.add('sheet-open');
    this._open = true;
    this._panel.onclick = e => { if (e.target === this._panel) this._close(); };
    this._escHandler = e => { if (e.key === 'Escape') this._close(); };
    document.addEventListener('keydown', this._escHandler);
    this._renderModal();
  }

  _close() {
    this._panel?.classList.add('hidden');
    document.body.classList.remove('sheet-open');
    if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
    document.querySelectorAll('.hero-assign-picker, .slot-unit-type-picker').forEach(p => p.remove());
    this._open = false;
  }

  _renderModal() {
    if (!this._sheet) return;
    this._sheet.innerHTML = '<div class="squad-modal"></div>';
    const root = this._sheet.firstElementChild;

    const squad = this._squadForInstance(this._activeInstance);
    if (!squad) {
      root.innerHTML = `
        <div class="sq-header">
          <div class="sq-title"><span class="sq-title-icon">${icon('sword')}</span><div class="sq-title-name">Squads</div></div>
          <button class="modal-close sq-close" aria-label="Close">✕</button>
        </div>
        <div class="sq-empty">No squad available for this Barracks.</div>`;
      return;
    }

    const built  = this._builtCount();
    const multi  = built > 1;
    const instId = squad.barracksInstanceId ?? `barracks_${this._activeInstance}`;
    const bm     = this._s.um._bm;
    const level  = bm?.getInstanceLevelOf?.(instId) ?? bm?.getLevelOf?.('barracks') ?? 1;

    // Combat summary
    const bonuses = this._s.heroes?.getCombatBonuses?.(squad.id) ?? { attackMult: 1, defenseMult: 1, lossReduction: 0 };
    const unitCount = squad.units.reduce((sum, u) => sum + u.count, 0);
    let totAtk = 0, totDef = 0;
    for (const u of squad.units) { totAtk += (u.stats?.attack ?? 0) * u.count; totDef += (u.stats?.defense ?? 0) * u.count; }
    const score = Math.round((totAtk * bonuses.attackMult + totDef * bonuses.defenseMult) * Math.max(1, unitCount));

    const pagerPrev = multi ? '<button class="sq-pager sq-pager--prev" aria-label="Previous squad">‹</button>' : '';
    const pagerNext = multi ? '<button class="sq-pager sq-pager--next" aria-label="Next squad">›</button>' : '';

    root.innerHTML = `
      <div class="sq-header">
        ${pagerPrev}
        <div class="sq-title">
          <span class="sq-title-icon">${icon('sword', 'icon--gold')}</span>
          <div>
            <div class="sq-title-name">${squad.name}</div>
            <div class="sq-title-sub">Barracks Lv.${level} · ${unitCount} units · ${squad.units.length} types</div>
          </div>
        </div>
        ${pagerNext}
        <button class="sq-rename" title="Rename squad">✎</button>
        <button class="sq-delete" title="Reset squad (clear units &amp; heroes)">${icon('trash')}</button>
        <button class="modal-close sq-close" aria-label="Close">✕</button>
      </div>
      <div class="sq-stats">
        <span class="sq-stat" title="Attack multiplier">${icon('sword')} ×${bonuses.attackMult.toFixed(2)}</span>
        <span class="sq-stat" title="Defense multiplier">${icon('shield')} ×${bonuses.defenseMult.toFixed(2)}</span>
        ${bonuses.lossReduction > 0 ? `<span class="sq-stat" title="Casualty reduction">${icon('heart', 'icon--success')} -${(bonuses.lossReduction * 100).toFixed(0)}%</span>` : ''}
        <span class="sq-stat sq-stat--score" title="Combat score">${icon('star-burst', 'icon--gold')} ${score.toLocaleString()}</span>
      </div>
      <div class="sq-tiles" id="sq-tiles"></div>`;

    // Bind header controls
    root.querySelector('.sq-close')?.addEventListener('click', () => this._close());
    root.querySelector('.sq-pager--prev')?.addEventListener('click', () => this._page(-1));
    root.querySelector('.sq-pager--next')?.addEventListener('click', () => this._page(1));
    root.querySelector('.sq-rename')?.addEventListener('click', () => this._renameSquad(squad));
    root.querySelector('.sq-delete')?.addEventListener('click', () => this._deleteSquad(squad, instId));

    // Build the 2×2 slot tiles
    const tilesEl = root.querySelector('#sq-tiles');
    const squadSlots = BUILDINGS_CONFIG['barracks']?.squadSlots ?? [];
    const MAX_SLOTS  = squadSlots.length || 4;
    for (let i = 0; i < MAX_SLOTS; i++) {
      tilesEl.appendChild(this._buildTile(squad, instId, level, i, squadSlots[i]));
    }
  }

  _page(dir) {
    eventBus.emit('ui:click');
    const built = this._builtCount();
    if (built < 2) return;
    this._activeInstance = (this._activeInstance + dir + built) % built;
    this._renderModal();
  }

  // ── A single 2×2 slot tile (hero over unit) ───────────────────────────────
  _buildTile(squad, barracksInstanceId, barracksLevel, slotIndex, slotCfg) {
    const bm = this._s.um._bm;
    const condition = slotCfg?.condition ?? null;
    const unlocked = !condition || Object.entries(condition).every(([bId, lv]) =>
      (bId === 'barracks' ? barracksLevel : (bm ? bm.getLevelOf(bId) : 0)) >= lv);

    const tile = document.createElement('div');
    tile.className = 'sq-tile';

    if (!unlocked) {
      const reqLevel = condition ? Object.values(condition)[0] : null;
      tile.classList.add('sq-tile--locked');
      tile.innerHTML = `<div class="sq-tile-lock"><span>${icon('lock')}</span><span>Barracks Lv.${reqLevel}</span></div>`;
      return tile;
    }

    const heroes = this._s.heroes;
    const allHeroesHere = heroes ? heroes.getHeroesForBuilding(barracksInstanceId) : [];
    const hero    = allHeroesHere.find(h => h.assignment?.slotIndex === slotIndex) ?? null;
    const heroCfg = hero ? HEROES_CONFIG[hero.heroId] : null;
    const classCfg = heroCfg ? (HERO_CLASSIFICATIONS[heroCfg.classification] ?? HERO_CLASSIFICATIONS.combat) : null;

    const slotUnit       = this._s.um?.getSlotUnit(squad.id, slotIndex) ?? null;
    const linkedUnitType = slotUnit?.unitId ?? (squad.slotUnitLinks?.get?.(slotIndex) ?? null);
    const linkedUnitCfg  = linkedUnitType ? UNITS_CONFIG[linkedUnitType] : null;
    const isEffective = !!(hero && linkedUnitType && classCfg &&
      (classCfg.preferredUnitTypes ?? []).includes(linkedUnitType));

    // Hero half (top)
    const heroHalf = document.createElement('div');
    heroHalf.className = `sq-hero ${hero ? 'sq-hero--filled' : 'sq-hero--empty'}`;
    if (hero && heroCfg) {
      const stars = hero.stars ? '★'.repeat(hero.stars) : '';
      heroHalf.innerHTML = `
        <div class="sq-hero-portrait sq-portrait--${heroCfg.tier ?? 'common'}">${heroCfg.icon ?? '?'}</div>
        <div class="sq-hero-info">
          <div class="sq-hero-name">${heroCfg.name}</div>
          <div class="sq-hero-lvl">Lv.${hero.level}${stars ? ' ' + stars : ''}</div>
        </div>
        <button class="sq-hero-clear" title="Remove hero">✕</button>`;
      heroHalf.querySelector('.sq-hero-clear').addEventListener('click', e => {
        e.stopPropagation(); eventBus.emit('ui:click');
        heroes.unassignHeroFromBuilding(hero.heroId);
      });
    } else {
      heroHalf.innerHTML = '<div class="sq-add-icon">＋</div><div class="sq-add-label">Add Hero</div>';
    }
    heroHalf.addEventListener('click', e => {
      if (e.target.closest('.sq-hero-clear')) return;
      eventBus.emit('ui:click');
      this._openHeroAssignPicker(squad.id, barracksInstanceId, slotIndex, tile);
    });
    tile.appendChild(heroHalf);

    // Unit half (bottom)
    const unitHalf = document.createElement('div');
    unitHalf.className = `sq-unit ${linkedUnitType ? 'sq-unit--filled' : 'sq-unit--empty'}`;
    if (linkedUnitType && linkedUnitCfg) {
      const chip = isEffective ? '<span class="sq-eff sq-eff--good">✦</span>' : (hero ? '<span class="sq-eff">↗</span>' : '');
      const tierTxt = slotUnit ? `T${slotUnit.tier} ×${slotUnit.count}` : '';
      unitHalf.innerHTML = `
        <div class="sq-unit-icon">${linkedUnitCfg.icon}</div>
        <div class="sq-unit-info">
          <div class="sq-unit-name">${linkedUnitCfg.name} ${chip}</div>
          <div class="sq-unit-tier">${tierTxt}</div>
        </div>
        <button class="sq-unit-clear" title="Remove units">✕</button>`;
      unitHalf.querySelector('.sq-unit-clear').addEventListener('click', e => {
        e.stopPropagation(); eventBus.emit('ui:click');
        this._s.um?.clearSlotUnits(squad.id, slotIndex);
        this._renderModal();
      });
    } else {
      unitHalf.innerHTML = '<div class="sq-add-icon">＋</div><div class="sq-add-label">Add Unit</div>';
    }
    unitHalf.addEventListener('click', e => {
      if (e.target.closest('.sq-unit-clear')) return;
      eventBus.emit('ui:click');
      this._openUnitTypePicker(squad.id, slotIndex, tile, classCfg);
    });
    tile.appendChild(unitHalf);

    return tile;
  }

  // ── Rename / delete ───────────────────────────────────────────────────────
  _renameSquad(squad) {
    eventBus.emit('ui:click');
    const titleEl = this._sheet?.querySelector('.sq-title-name');
    if (!titleEl) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sq-rename-input';
    input.value = squad.name;
    input.maxLength = 30;
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    const finish = save => {
      if (done) return;
      done = true;
      if (save) {
        const n = input.value.trim();
        if (n && n !== squad.name) this._s.um.renameSquad(squad.id, n.slice(0, 30));
      }
      this._renderModal();
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  }

  _deleteSquad(squad, barracksInstanceId) {
    eventBus.emit('ui:click');
    const heroesHere = this._s.heroes?.getHeroesForBuilding(barracksInstanceId) ?? [];
    for (const h of heroesHere) this._s.heroes?.unassignHeroFromBuilding(h.heroId);
    this._s.um.deleteSquad(squad.id);
    this._renderModal();
  }

  // ── HERO PICKER (floating) ────────────────────────────────────────────────
  _openHeroAssignPicker(squadId, barracksInstanceId, slotIndex, cardEl) {
    document.querySelectorAll('.hero-assign-picker').forEach(p => p.remove());

    const heroes = this._s.heroes;
    if (!heroes) return;

    const roster = heroes.getRosterWithState();
    const available = roster.filter(h =>
      h.isOwned &&
      !(h.assignment.type === 'building' && h.assignment.buildingId === barracksInstanceId && h.assignment.slotIndex === slotIndex)
    );

    if (available.length === 0) {
      this._s.notifications?.show('info', 'No Heroes Available',
        'All owned heroes are already in this squad. Recruit more from the Heroes tab.');
      return;
    }

    const picker = document.createElement('div');
    picker.className = 'hero-assign-picker';

    const label = document.createElement('div');
    label.className = 'picker-label';
    label.textContent = 'Select a hero to assign:';
    picker.appendChild(label);

    const list = document.createElement('div');
    list.className = 'picker-list';

    available.forEach(h => {
      const row = document.createElement('button');
      row.className = `picker-row picker-row--${h.tier}`;
      const classCfg = HERO_CLASSIFICATIONS[h.classification] ?? HERO_CLASSIFICATIONS.combat;
      const isPreferred = h.classification === 'combat';
      row.innerHTML = `
        <span class="picker-portrait">${h.icon}</span>
        <span class="picker-name">${h.name}</span>
        <span class="picker-meta">Lv.${h.level} · ${h.tier}</span>
        <span class="hero-class-badge picker-class-badge class-${h.classification ?? 'combat'}">${classCfg.icon} ${classCfg.label}</span>
        ${isPreferred ? '<span class="picker-effectiveness-badge">⭐ Best fit</span>' : ''}`;
      row.addEventListener('click', () => {
        eventBus.emit('ui:click');
        const result = heroes.assignHeroToBuilding(h.id, barracksInstanceId, slotIndex);
        if (!result.success) this._s.notifications?.show('warning', 'Cannot Assign', result.reason);
        picker.remove();
      });
      list.appendChild(row);
    });
    picker.appendChild(list);

    const cancel = document.createElement('button');
    cancel.className = 'btn btn-ghost btn-sm picker-cancel';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', e => { e.stopPropagation(); picker.remove(); });
    picker.appendChild(cancel);

    const W = 300, MARGIN = 8;
    const r = cardEl.getBoundingClientRect();
    let left = r.left + (r.width - W) / 2;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - W - MARGIN));
    const top = Math.max(MARGIN, Math.min(r.top, window.innerHeight - 420));
    picker.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:${W}px;z-index:2000;max-height:${window.innerHeight - top - MARGIN * 2}px;overflow-y:auto;`;
    document.body.appendChild(picker);
    const dismiss = e => { if (!picker.contains(e.target) && !cardEl.contains(e.target)) { picker.remove(); document.removeEventListener('click', dismiss); } };
    setTimeout(() => document.addEventListener('click', dismiss), 0);
  }

  // ── UNIT TYPE PICKER (floating, 2-step) ───────────────────────────────────
  _openUnitTypePicker(squadId, slotIndex, cardEl, classCfg) {
    document.querySelectorAll('.slot-unit-type-picker').forEach(p => p.remove());

    const reserve = this._s.um?.getReserve() ?? [];

    const picker = document.createElement('div');
    picker.className = 'slot-unit-type-picker';

    const renderTypeGrid = () => {
      picker.innerHTML = '';

      const label = document.createElement('div');
      label.className = 'sut-picker-label';
      label.textContent = 'Add units to slot:';
      picker.appendChild(label);

      const grid = document.createElement('div');
      grid.className = 'sut-picker-grid';

      ['infantry', 'ranged', 'cavalry', 'siege'].forEach(unitType => {
        const cfg = UNITS_CONFIG[unitType];
        if (!cfg) return;
        const currentSlotUnit = this._s.um?.getSlotUnit(squadId, slotIndex);
        const inSlot   = currentSlotUnit?.unitId === unitType ? currentSlotUnit.count : 0;
        const inReserve = reserve.filter(u => u.unitId === unitType).reduce((s, u) => s + u.count, 0);
        const isPreferred = (classCfg?.preferredUnitTypes ?? []).includes(unitType);
        const isCurrentSlot = currentSlotUnit?.unitId === unitType;

        const btn = document.createElement('button');
        btn.className = 'sut-btn' + (isPreferred ? ' sut-btn--preferred' : '') + (isCurrentSlot ? ' sut-btn--current' : '');
        btn.innerHTML = `
          <span class="sut-icon">${cfg.icon}</span>
          <span class="sut-name">${cfg.name}</span>
          <div class="sut-counts">
            <span class="sut-in-squad" title="In this slot">${icon('sword')} ${inSlot}</span>
            <span class="sut-in-reserve" title="In reserve">${icon('box')} ${inReserve}</span>
          </div>
          ${isPreferred ? '<span class="sut-star">⭐ Match</span>' : ''}`;
        btn.addEventListener('click', e => { e.stopPropagation(); eventBus.emit('ui:click'); renderAssignStep(unitType, cfg); });
        grid.appendChild(btn);
      });
      picker.appendChild(grid);

      const cancel = document.createElement('button');
      cancel.className = 'btn btn-ghost btn-sm picker-cancel';
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', e => { e.stopPropagation(); picker.remove(); });
      picker.appendChild(cancel);
    };

    const renderAssignStep = (unitType, cfg) => {
      picker.innerHTML = '';

      const freshReserve = this._s.um?.getReserve() ?? [];
      const tiers = freshReserve
        .filter(u => u.unitId === unitType && u.count > 0)
        .sort((a, b) => b.tier - a.tier);

      const _squadData = this._s.um?.getSquad(squadId);
      const _bm        = this._s.um?._bm;
      const _bldgCfg   = BUILDINGS_CONFIG['barracks'];
      const _instId    = _squadData?.barracksInstanceId;
      const _bldgLvl   = _instId
        ? (_bm?.getInstanceLevelOf?.(_instId) ?? _bm?.getLevelOf?.('barracks') ?? 0)
        : (_bm?.getLevelOf?.('barracks') ?? 0);
      const _lvStats   = _bldgCfg?.levelStats?.[Math.min(_bldgLvl - 1, (_bldgCfg?.levelStats?.length ?? 1) - 1)];
      const _slotCap   = _lvStats?.slotCapacity ?? Infinity;
      const _curSlotUnit = this._s.um?.getSlotUnit(squadId, slotIndex);

      const nav = document.createElement('div');
      nav.className = 'sut-nav';
      const backBtn = document.createElement('button');
      backBtn.className = 'btn btn-ghost btn-sm sut-back-btn';
      backBtn.innerHTML = '← Back';
      backBtn.addEventListener('click', e => { e.stopPropagation(); eventBus.emit('ui:click'); renderTypeGrid(); });
      nav.appendChild(backBtn);
      const typeLabel = document.createElement('span');
      typeLabel.className = 'sut-step-label';
      typeLabel.innerHTML = `${cfg.icon} <strong>${cfg.name}</strong>`;
      nav.appendChild(typeLabel);
      picker.appendChild(nav);

      if (tiers.length === 0) {
        const none = document.createElement('div');
        none.className = 'sut-no-reserve';
        none.textContent = `No ${cfg.name} in reserve — train some first.`;
        picker.appendChild(none);
      } else {
        tiers.forEach(u => {
          const tierName = UNITS_CONFIG[unitType]?.tiers?.[u.tier - 1]?.name ?? u.name;
          const row = document.createElement('div');
          row.className = 'sut-tier-row';

          const info = document.createElement('div');
          info.className = 'sut-tier-info';
          info.innerHTML = `<span class="sut-tier-name">T${u.tier} ${tierName}</span><span class="sut-tier-reserve">${icon('box')} ${u.count} available</span>`;

          const bottom = document.createElement('div');
          bottom.className = 'sut-tier-bottom';

          const multiplierRow = document.createElement('div');
          multiplierRow.className = 'sut-qty-presets';

          // Units of THIS tier already in the slot (so we resume from where we left off).
          const _existingCount = (_curSlotUnit?.unitId === unitType && _curSlotUnit?.tier === u.tier) ? _curSlotUnit.count : 0;
          const _maxAddable = Math.max(0, Math.min(u.count, isFinite(_slotCap) ? _slotCap - _existingCount : u.count));
          const _maxTotal   = _existingCount + _maxAddable;

          // The input is the slot's TARGET TOTAL — pre-filled with the current count.
          const input = document.createElement('input');
          input.type = 'number'; input.className = 'sq-transfer-amt';
          input.value = String(_existingCount); input.min = String(_existingCount); input.max = String(_maxTotal);

          const clamp = val => Math.min(_maxTotal, Math.max(_existingCount, val));

          if (isFinite(_slotCap)) {
            const capRow = document.createElement('div');
            capRow.className = 'sut-cap-hint';
            capRow.textContent = `Slot: ${_existingCount} / ${_slotCap.toLocaleString()} units${_maxAddable <= 0 ? ' — full' : ''}`;
            row.appendChild(capRow);
          }

          // Quick-add presets — each ADDS its amount to the running total.
          [5, 10, 25, 50].filter(n => n <= _maxAddable).forEach(n => {
            const chip = document.createElement('button');
            chip.className = 'sut-qty-chip';
            chip.textContent = `+${n}`;
            chip.addEventListener('click', e => { e.stopPropagation(); input.value = clamp(+input.value + n); });
            multiplierRow.appendChild(chip);
          });

          const maxChip = document.createElement('button');
          maxChip.className = 'sut-qty-chip sut-qty-chip--max';
          maxChip.textContent = 'Max';
          maxChip.addEventListener('click', e => { e.stopPropagation(); input.value = _maxTotal; });
          multiplierRow.appendChild(maxChip);

          const controls = document.createElement('div');
          controls.className = 'sut-tier-controls';

          const minusBtn = document.createElement('button');
          minusBtn.className = 'btn-pill-left'; minusBtn.textContent = '−';
          const plusBtn = document.createElement('button');
          plusBtn.className = 'btn-pill-right'; plusBtn.textContent = '+';
          const addBtn = document.createElement('button');
          addBtn.className = 'btn btn-primary btn-sm sut-add-btn'; addBtn.textContent = 'Assign';

          minusBtn.addEventListener('click', e => { e.stopPropagation(); input.value = clamp(+input.value - 1); });
          plusBtn.addEventListener('click',  e => { e.stopPropagation(); input.value = clamp(+input.value + 1); });
          addBtn.addEventListener('click', e => {
            e.stopPropagation();
            const target = clamp(parseInt(input.value) || _existingCount);
            const qty = target - _existingCount; // only the newly-added amount is assigned
            if (qty < 1) { this._s.notifications?.show('info', 'Select an Amount', 'Increase the amount to add more units.'); return; }
            const result = this._s.um?.assignToSquad(squadId, unitType, qty, u.tier, slotIndex);
            if (result?.success) {
              this._s.um?.linkSlotUnit(squadId, slotIndex, unitType);
              picker.remove();
              this._renderModal();
            } else {
              this._s.notifications?.show('warning', 'Cannot Assign', result?.reason ?? 'Failed');
            }
          });

          controls.appendChild(minusBtn); controls.appendChild(input);
          controls.appendChild(plusBtn); controls.appendChild(addBtn);

          bottom.appendChild(multiplierRow);
          bottom.appendChild(controls);
          row.appendChild(info);
          row.appendChild(bottom);
          picker.appendChild(row);
        });
      }

      const cancel = document.createElement('button');
      cancel.className = 'btn btn-ghost btn-sm picker-cancel';
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', e => { e.stopPropagation(); picker.remove(); });
      picker.appendChild(cancel);
    };

    renderTypeGrid();

    const W = 460, MARGIN = 8;
    const r = cardEl.getBoundingClientRect();
    let left = r.left + (r.width - W) / 2;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - W - MARGIN));
    const top = Math.max(MARGIN, Math.min(r.top, window.innerHeight - 500));
    picker.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:${W}px;z-index:2000;max-height:${window.innerHeight - top - MARGIN * 2}px;overflow-y:auto;`;
    document.body.appendChild(picker);

    const dismiss = e => { if (!picker.contains(e.target) && !cardEl.contains(e.target)) { picker.remove(); document.removeEventListener('click', dismiss); } };
    setTimeout(() => document.addEventListener('click', dismiss), 0);
  }
}
