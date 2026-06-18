/**
 * MilitaryUI.js
 * Compact per-building TRAINING MODAL (replaces the old multi-tab Military page).
 *
 * Opened from a trainer building's tile tooltip (`ui:openTraining { buildingId }`).
 * Layout (top→bottom): ‹ building pager › · hex tier selector · selected-tier stats ·
 * cost · quantity slider · Train / Instant · this building's active-training footer.
 *
 * A ‹ › pager cycles through the player's *built* trainer buildings so you can switch
 * training room without closing. One unit type per building, 10 tiers each.
 */
import { eventBus } from '../../core/EventBus.js';
import { UNITS_CONFIG, BUILDINGS_CONFIG, UNIT_TIER_REQUIREMENTS } from '../../entities/GAME_DATA.js';
import { RES_META, fmt } from '../uiUtils.js';

/** Trainer buildings, in pager order. */
const MILITARY_BUILDINGS = [
  { id: 'infantryhall',  label: 'Infantry Hall',  icon: '🗡️' },
  { id: 'archeryrange',  label: 'Archery Range',  icon: '🏹' },
  { id: 'cavalrystable', label: 'Cavalry Stable', icon: '🐴' },
  { id: 'siegeworkshop', label: 'Siege Workshop', icon: '💥' },
];

export class MilitaryUI {
  /** @param {{ rm, um, bm, inventory, notifications, tech }} systems */
  constructor(systems) {
    this._s = systems;
    this._activeBuildingId = 'infantryhall';
    this._selectedTier = 1;
    this._qty = 1;
    this._open = false;
  }

  init() {
    eventBus.on('ui:openTraining',   ({ buildingId } = {}) => this._openModal(buildingId));
    eventBus.on('resource:updated',  () => { if (this._open) this._patchAffordability(); });
    eventBus.on('inventory:updated', () => { if (this._open) this._refreshInstant(); });
    eventBus.on('inventory:itemUsed',() => { if (this._open) this._refreshInstant(); });
    eventBus.on('unit:queueUpdated', () => { if (this._open) this._patchQueueFooter(); });
    eventBus.on('army:updated',      () => { if (this._open) this._renderModal(); });
    eventBus.on('tech:researched',   () => { if (this._open) this._renderModal(); });
    eventBus.on('building:completed',() => { if (this._open) this._renderModal(); });
  }

  // ── Data helpers ──────────────────────────────────────────────────────────
  /** Built trainer buildings, in pager order. */
  _builtTrainers() {
    return MILITARY_BUILDINGS.filter(b => this._s.bm.getLevelOf(b.id) > 0);
  }

  /** The single unit type trained at a building. */
  _unitFor(buildingId) {
    const entry = Object.entries(UNITS_CONFIG).find(([, u]) => u.buildingId === buildingId);
    return entry ? { id: entry[0], ...entry[1] } : null;
  }

  _slotData(buildingId, level) {
    const cfg   = BUILDINGS_CONFIG[buildingId];
    const slots = cfg?.trainingSlots ?? [];
    return slots[Math.min(Math.max(level - 1, 0), slots.length - 1)] ?? null;
  }

  /** Per-tier derived state: locked? reason? owned count? affordability? */
  _tierInfo(unitType, tier, buildingLevel, reserveMap) {
    const tierCfg = (unitType.tiers ?? [])[tier - 1];
    if (!tierCfg) return null;
    const buildingId = unitType.buildingId;
    const bldgCfg    = BUILDINGS_CONFIG[buildingId];
    const slotData   = this._slotData(buildingId, buildingLevel);
    const maxBatch   = slotData?.maxBatchSize ?? Infinity;

    const bldgTierMet = !slotData || tier <= (slotData.maxTrainableTier ?? 99);
    const neededBldgLvl = bldgTierMet ? null : (() => {
      const slots = bldgCfg?.trainingSlots ?? [];
      for (let i = 0; i < slots.length; i++) {
        if ((slots[i].maxTrainableTier ?? 99) >= tier) return i + 1;
      }
      return null;
    })();

    const tierReq = UNIT_TIER_REQUIREMENTS?.[unitType.id]?.[tier];
    const techId  = tierReq?.techRequired ?? tierCfg.techRequired ?? null;
    const techMet = !techId || (this._s.tech?.getLevelOf(techId) ?? 0) >= (tierReq?.minTechLevel ?? 1);
    const bldgMet = !tierReq?.minBuildingLevel || buildingLevel >= tierReq.minBuildingLevel;
    const hqOk    = this._s.um._bm?.getHQUnlockedIds('units')?.has(unitType.id) ?? true;

    const locked = !hqOk || !bldgTierMet || !techMet || !bldgMet;
    const lockReason = !hqOk
      ? (() => { const lv = this._s.um._bm?.getRequiredHQLevel('units', unitType.id); return lv ? `HQ Lv.${lv} required` : 'Locked'; })()
      : !bldgTierMet ? `${bldgCfg?.name ?? buildingId} Lv.${neededBldgLvl ?? '?'} required`
      : !bldgMet     ? `${bldgCfg?.name ?? buildingId} Lv.${tierReq.minBuildingLevel} required`
      : techId       ? `Research ${techId.replace(/_/g, ' ')} Lv.${tierReq?.minTechLevel ?? 1}`
      :                'Locked';

    const count         = reserveMap[`${unitType.id}_t${tier}`] ?? 0;
    const maxAffordable = locked ? 0 : this._s.rm.maxAffordable(tierCfg.cost ?? {});
    const cap           = Math.max(0, Math.min(maxAffordable, isFinite(maxBatch) ? maxBatch : maxAffordable));

    return { tierCfg, tier, locked, lockReason, count, maxAffordable, maxBatch, cap };
  }

  /** Highest unlocked tier (so the modal opens on the player's best unit), else T1. */
  _defaultTier(unitType, buildingLevel, reserveMap) {
    for (let t = (unitType.tiers ?? []).length; t >= 1; t--) {
      if (!this._tierInfo(unitType, t, buildingLevel, reserveMap)?.locked) return t;
    }
    return 1;
  }

  _reserveMap() {
    const map = {};
    (this._s.um.getReserve() ?? []).forEach(u => { map[u.tierKey] = u.count; });
    return map;
  }

  // ── Open / render ─────────────────────────────────────────────────────────
  _openModal(buildingId) {
    const built = this._builtTrainers();
    if (buildingId && this._s.bm.getLevelOf(buildingId) > 0) {
      this._activeBuildingId = buildingId;
    } else if (!built.some(b => b.id === this._activeBuildingId)) {
      this._activeBuildingId = built[0]?.id ?? buildingId ?? 'infantryhall';
    }
    const unitType = this._unitFor(this._activeBuildingId);
    const level    = this._s.bm.getLevelOf(this._activeBuildingId);
    if (unitType && level > 0) {
      this._selectedTier = this._defaultTier(unitType, level, this._reserveMap());
    }
    this._qty = 1;
    this._panel = document.getElementById('train-panel');
    this._sheet = document.getElementById('train-sheet');
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
    document.querySelector('.speedup-picker')?.remove();
    this._open = false;
  }

  _renderModal() {
    if (!this._sheet) return;
    this._sheet.innerHTML = `<div class="train-modal">${this._modalHTML()}</div>`;
    this._bindModal(this._sheet);
  }

  _modalHTML() {
    const buildingId = this._activeBuildingId;
    const cfg        = BUILDINGS_CONFIG[buildingId];
    const level      = this._s.bm.getLevelOf(buildingId);
    const unitType   = this._unitFor(buildingId);
    const built      = this._builtTrainers();
    const multi      = built.length > 1;

    if (!cfg || level === 0 || !unitType) {
      return `
        <div class="tm-header">
          <div class="tm-title"><span class="tm-title-icon">${cfg?.icon ?? '🏗️'}</span>
            <div><div class="tm-title-name">${cfg?.name ?? 'Training'}</div></div>
          </div>
          <button class="modal-close tm-close" aria-label="Close">✕</button>
        </div>
        <div class="tm-empty">This building has not been built yet. Build it on your base to start training.</div>`;
    }

    const slotData  = this._slotData(buildingId, level);
    const curSlots  = slotData?.concurrentSlots ?? 1;
    const curBatch  = slotData?.maxBatchSize ?? '∞';
    const curTier   = slotData?.maxTrainableTier ?? '?';
    const speedPct  = (slotData?.trainTimeMultiplier != null && slotData.trainTimeMultiplier < 1)
      ? Math.round((1 - slotData.trainTimeMultiplier) * 100) : 0;
    const queueDepth = this._s.um.getTrainingQueueDepthForBuilding?.(buildingId) ?? 0;
    const reserveMap = this._reserveMap();

    // ── Hex tier row ──
    const tiersHtml = (unitType.tiers ?? []).map((_, i) => {
      const t  = i + 1;
      const ti = this._tierInfo(unitType, t, level, reserveMap);
      if (!ti) return '';
      const sel = t === this._selectedTier;
      return `<button class="tm-tier${sel ? ' tm-tier--active' : ''}${ti.locked ? ' tm-tier--locked' : ''}" data-tier="${t}">
        <span class="tm-tier-hex">${ti.locked ? '🔒' : `T${t}`}</span>
        <span class="tm-tier-count">${ti.count > 0 ? fmt(ti.count) : '0'}</span>
      </button>`;
    }).join('');

    // ── Selected tier detail ──
    const ti = this._tierInfo(unitType, this._selectedTier, level, reserveMap);
    const tc = ti?.tierCfg;
    const snap = this._s.rm.getSnapshot();
    const detail = (() => {
      if (!ti || !tc) return '';
      if (ti.locked) {
        return `<div class="tm-locked">🔒 ${ti.lockReason}</div>`;
      }
      const st = tc.stats ?? {};
      const statsHtml = `
        <div class="tm-stat"><span>❤️ HP</span><b>${fmt(st.hp ?? 0)}</b></div>
        <div class="tm-stat"><span>⚔️ ATK</span><b>${fmt(st.attack ?? 0)}</b></div>
        <div class="tm-stat"><span>🛡️ DEF</span><b>${fmt(st.defense ?? 0)}</b></div>
        <div class="tm-stat"><span>💨 SPD</span><b>${st.speed ?? '—'}</b></div>`;
      const costHtml = Object.entries(tc.cost ?? {}).map(([res, amt]) =>
        `<span class="cost-chip ${(snap[res]?.amount ?? 0) >= amt ? 'affordable' : 'unaffordable'}" data-res="${res}" data-amt="${amt}">${RES_META[res]?.icon ?? '?'} ${fmt(amt)}</span>`
      ).join('');
      const cap = Math.max(1, ti.cap);
      this._qty = Math.min(Math.max(1, this._qty), cap);
      const trainSec = tc.trainTime ?? 0;
      const disabled = ti.cap === 0;
      const mult = slotData?.trainTimeMultiplier ?? 1;
      const estSecs = Math.max(1, Math.ceil(trainSec * this._qty * mult));
      const best = this._bestSpeedup(estSecs);
      const instantOff = disabled || !best;
      return `
        <div class="tm-detail-head">
          <span class="tm-detail-name">${tc.name}</span>
          <span class="tm-detail-time">⏱ ${trainSec}s/ea</span>
        </div>
        <div class="tm-stats">${statsHtml}</div>
        <div class="tm-cost">${costHtml}</div>
        <div class="tm-qty">
          <button class="tm-qty-btn" data-step="-1" ${disabled ? 'disabled' : ''}>−</button>
          <input type="range" class="tm-qty-range" min="1" max="${cap}" value="${this._qty}" ${disabled ? 'disabled' : ''}>
          <button class="tm-qty-btn" data-step="1" ${disabled ? 'disabled' : ''}>＋</button>
          <input type="number" class="tm-qty-num" min="1" max="${cap}" value="${this._qty}" ${disabled ? 'disabled' : ''}>
          <button class="btn btn-ghost btn-sm tm-qty-max" ${disabled ? 'disabled' : ''}>MAX</button>
        </div>
        <div class="tm-actions">
          <button class="btn btn-gold tm-instant" data-cap-zero="${disabled ? 1 : 0}" ${instantOff ? 'disabled' : ''} title="${best ? `Instantly finish (uses ${best.name})` : 'No speed-up large enough to finish instantly'}">⏩ Instant</button>
          <button class="btn btn-primary tm-train" ${disabled ? 'disabled' : ''}>Train</button>
        </div>
        ${disabled ? `<div class="tm-cap-hint">Not enough resources to train this unit.</div>`
                   : (isFinite(ti.maxBatch) ? `<div class="tm-cap-hint">Max ${ti.maxBatch}/batch</div>` : '')}`;
    })();

    const idx     = built.findIndex(b => b.id === buildingId);
    const pager   = multi ? `
      <button class="tm-pager tm-pager--prev" aria-label="Previous building">‹</button>` : '';
    const pagerN  = multi ? `
      <button class="tm-pager tm-pager--next" aria-label="Next building">›</button>` : '';
    void idx;

    return `
      <div class="tm-header">
        ${pager}
        <div class="tm-title">
          <span class="tm-title-icon">${cfg.icon}</span>
          <div>
            <div class="tm-title-name">${cfg.name}</div>
            <div class="tm-title-sub">Lv.${level} · ${queueDepth}/${curSlots} slot${curSlots !== 1 ? 's' : ''} · ${curBatch}/batch · max T${curTier}${speedPct ? ` · ⚡-${speedPct}%` : ''}</div>
          </div>
        </div>
        ${pagerN}
        <button class="modal-close tm-close" aria-label="Close">✕</button>
      </div>
      <div class="tm-tiers">${tiersHtml}</div>
      <div class="tm-detail">${detail}</div>
      <div class="tm-queue" id="tm-queue">${this._queueFooterHTML()}</div>`;
  }

  /** Active-training line for the current building (footer). */
  _queueFooterHTML() {
    const all = this._s.um.getAllQueues() ?? [];
    const items = all.filter(q =>
      (q.buildingId ?? UNITS_CONFIG[q.unitId]?.buildingId) === this._activeBuildingId);
    const active = items.find(q => q.queueIndex === 0);
    const pending = items.filter(q => q.queueIndex > 0).length;
    if (!active) return '<div class="tm-queue-idle">No active training in this building.</div>';

    const dur = active.endsAt - (active.startedAt ?? 0);
    const pct = dur > 0 ? Math.max(1, Math.min(100, ((Date.now() - (active.startedAt ?? 0)) / dur) * 100)) : 1;
    const secsLeft = Math.max(0, Math.ceil((active.endsAt - Date.now()) / 1000));
    return `
      <div class="tm-queue-active" data-timer-start="${active.startedAt ?? Date.now()}" data-timer-end="${active.endsAt}">
        <span class="tm-queue-icon">${active.icon ?? '⚔️'}</span>
        <div class="tm-queue-body">
          <div class="tm-queue-name">${active.name} <span class="tm-queue-count">×${active.count}</span>${pending ? ` <span class="tm-queue-pending">+${pending} queued</span>` : ''}</div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>
        <span class="progress-time-label tm-queue-time">${secsLeft}s</span>
        <button class="tm-queue-speed" title="Speed up">⏩</button>
        <button class="tm-queue-cancel" title="Cancel">✕</button>
      </div>`;
  }

  // ── Bind ──────────────────────────────────────────────────────────────────
  _bindModal(root) {
    root.querySelector('.tm-close')?.addEventListener('click', () => this._close());
    root.querySelector('.tm-pager--prev')?.addEventListener('click', () => this._pageBuilding(-1));
    root.querySelector('.tm-pager--next')?.addEventListener('click', () => this._pageBuilding(1));

    root.querySelectorAll('.tm-tier').forEach(btn => {
      btn.addEventListener('click', () => {
        eventBus.emit('ui:click');
        this._selectedTier = Number(btn.dataset.tier);
        this._qty = 1;
        this._renderModal();
      });
    });

    const range = root.querySelector('.tm-qty-range');
    const num   = root.querySelector('.tm-qty-num');
    const cap   = range ? Number(range.max) : 1;
    const setQty = v => {
      this._qty = Math.max(1, Math.min(cap, Math.floor(Number(v) || 1)));
      if (range) range.value = String(this._qty);
      if (num)   num.value   = String(this._qty);
      this._refreshInstant();
    };
    range?.addEventListener('input', e => setQty(e.target.value));
    num?.addEventListener('input',   e => setQty(e.target.value));
    root.querySelectorAll('.tm-qty-btn').forEach(b =>
      b.addEventListener('click', () => { eventBus.emit('ui:click'); setQty(this._qty + Number(b.dataset.step)); }));
    root.querySelector('.tm-qty-max')?.addEventListener('click', () => { eventBus.emit('ui:click'); setQty(cap); });

    root.querySelector('.tm-train')?.addEventListener('click', () => this._train(this._qty));
    root.querySelector('.tm-instant')?.addEventListener('click', () => this._instant(this._qty));

    root.querySelector('.tm-queue-speed')?.addEventListener('click', e => {
      e.stopPropagation(); eventBus.emit('ui:click');
      const secsLeft = parseInt(root.querySelector('.tm-queue-time')?.textContent, 10) || 60;
      this._openSpeedupPicker(root.querySelector('.tm-queue-active'), 'training', secsLeft);
    });
    root.querySelector('.tm-queue-cancel')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      this._s.um.cancelTrain(this._activeBuildingId, 0);
    });
  }

  _pageBuilding(dir) {
    eventBus.emit('ui:click');
    const built = this._builtTrainers();
    if (built.length < 2) return;
    let i = built.findIndex(b => b.id === this._activeBuildingId);
    i = (i + dir + built.length) % built.length;
    this._activeBuildingId = built[i].id;
    const unitType = this._unitFor(this._activeBuildingId);
    const level    = this._s.bm.getLevelOf(this._activeBuildingId);
    this._selectedTier = unitType ? this._defaultTier(unitType, level, this._reserveMap()) : 1;
    this._qty = 1;
    this._renderModal();
  }

  _train(amt) {
    eventBus.emit('ui:click');
    const unitType = this._unitFor(this._activeBuildingId);
    if (!unitType) return;
    const r = this._s.um.train(unitType.id, amt, this._selectedTier);
    if (!r.success) { eventBus.emit('ui:error'); this._s.notifications?.show('warning', 'Cannot Train', r.reason); }
  }

  /** Smallest owned speed-up (training/any) that can fully complete `secs`, else null. */
  _bestSpeedup(secs) {
    const owned = this._s.inventory?.getOwnedItems?.() ?? [];
    return owned
      .filter(i => i.type === 'speed_boost' && (i.target === 'training' || i.target === 'any') && (i.quantity ?? 0) > 0)
      .sort((a, b) => a.skipSeconds - b.skipSeconds)
      .find(i => i.skipSeconds >= secs) ?? null;
  }

  /** Estimated total train time (seconds) for `qty` of the selected tier. */
  _estTrainSecs(qty) {
    const unitType = this._unitFor(this._activeBuildingId);
    const tc = unitType?.tiers?.[this._selectedTier - 1];
    const level = this._s.bm.getLevelOf(this._activeBuildingId);
    const mult = this._slotData(this._activeBuildingId, level)?.trainTimeMultiplier ?? 1;
    return Math.max(1, Math.ceil((tc?.trainTime ?? 0) * qty * mult));
  }

  // Instant = train this batch AND auto-finish it with the best sufficient speed-up.
  // No picker — the button is only enabled when such a speed-up exists.
  _instant(amt) {
    eventBus.emit('ui:click');
    const unitType = this._unitFor(this._activeBuildingId);
    if (!unitType) return;
    const best = this._bestSpeedup(this._estTrainSecs(amt));
    if (!best) { eventBus.emit('ui:error'); this._s.notifications?.show('warning', 'No Speed-Up', 'No speed-up large enough to finish this instantly.'); return; }
    const r = this._s.um.train(unitType.id, amt, this._selectedTier);
    if (!r.success) { eventBus.emit('ui:error'); this._s.notifications?.show('warning', 'Cannot Train', r.reason); return; }
    const ur = this._s.inventory?.useItem(best.id, { queueType: 'training' });
    if (ur && !ur.success) this._s.notifications?.show('warning', 'Speed Up Failed', ur.reason);
    else this._s.notifications?.show('success', '⏩ Trained Instantly', `${unitType.tiers?.[this._selectedTier - 1]?.name ?? 'Units'} ×${amt} completed.`);
  }

  /** Re-evaluate the Instant button's enabled state for the current qty/tier. */
  _refreshInstant() {
    const btn = this._sheet?.querySelector('.tm-instant');
    if (!btn) return;
    const capZero = btn.dataset.capZero === '1';
    const best = this._bestSpeedup(this._estTrainSecs(this._qty));
    btn.disabled = capZero || !best;
    btn.title = best ? `Instantly finish (uses ${best.name})` : 'No speed-up large enough to finish instantly';
  }

  // ── In-place patches (no rebuild over live progress) ──────────────────────
  _patchAffordability() {
    const snap = this._s.rm.getSnapshot();
    this._sheet?.querySelectorAll('.cost-chip[data-res]').forEach(chip => {
      const ok = (snap[chip.dataset.res]?.amount ?? 0) >= Number(chip.dataset.amt);
      chip.classList.toggle('affordable', ok);
      chip.classList.toggle('unaffordable', !ok);
    });
  }

  _patchQueueFooter() {
    const el = this._sheet?.querySelector('#tm-queue');
    if (!el) return;
    el.innerHTML = this._queueFooterHTML();
    el.querySelector('.tm-queue-speed')?.addEventListener('click', e => {
      e.stopPropagation(); eventBus.emit('ui:click');
      const secsLeft = parseInt(el.querySelector('.tm-queue-time')?.textContent, 10) || 60;
      this._openSpeedupPicker(el.querySelector('.tm-queue-active'), 'training', secsLeft);
    });
    el.querySelector('.tm-queue-cancel')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      this._s.um.cancelTrain(this._activeBuildingId, 0);
    });
  }

  // ── SPEED-UP PICKER (unchanged behaviour) ─────────────────────────────────
  _openSpeedupPicker(anchorEl, queueType, secsLeft) {
    if (!anchorEl) return;
    document.querySelector('.speedup-picker')?.remove();
    const inventory = this._s.inventory;
    if (!inventory) return;

    const owned = inventory.getOwnedItems()
      .filter(i => i.type === 'speed_boost' && (i.target === queueType || i.target === 'any'))
      .sort((a, b) => a.skipSeconds - b.skipSeconds);
    const bestFit = owned.find(i => i.skipSeconds >= secsLeft) ?? owned[owned.length - 1];

    const picker = document.createElement('div');
    picker.className = 'speedup-picker';

    if (owned.length === 0) {
      picker.innerHTML = `
        <div class="speedup-picker-empty">
          <span>No speedups available.</span>
          <button class="btn btn-xs btn-primary speedup-goto-shop">🛒 Buy from Shop</button>
        </div>`;
      picker.querySelector('.speedup-goto-shop')?.addEventListener('click', () => {
        picker.remove();
        eventBus.emit('ui:navigate', { tab: 'shop' });
      });
    } else {
      const title = document.createElement('div');
      title.className = 'speedup-picker-title';
      title.textContent = '⏩ Speed Up';
      picker.appendChild(title);

      owned.forEach(i => {
        const willComplete = i.skipSeconds >= secsLeft;
        const isRec        = i === bestFit;
        const label        = i.skipSeconds >= 999999 ? 'Instant'
                           : i.skipSeconds >= 3600   ? `${Math.round(i.skipSeconds / 3600)}h`
                           :                           `${Math.round(i.skipSeconds / 60)}m`;
        const btn = document.createElement('button');
        btn.className = `speedup-option${isRec ? ' speedup-recommended' : ''}`;
        btn.dataset.item = i.id;
        btn.innerHTML = `
          <span class="speedup-option-icon">${i.icon}</span>
          <span class="speedup-option-label">${label}${i.target === 'any' ? ' <em style="opacity:.55;font-style:normal">(Universal)</em>' : ''}</span>
          <span class="speedup-option-qty">×${i.quantity}</span>
          ${willComplete ? '<span class="speedup-rec-badge">⭐ Best</span>' : ''}`;
        btn.addEventListener('click', () => {
          eventBus.emit('ui:click');
          const r = inventory.useItem(i.id, { queueType });
          if (!r.success) this._s.notifications?.show('warning', 'Speed Up Failed', r.reason);
          picker.remove();
        });
        picker.appendChild(btn);
      });
    }

    const cancel = document.createElement('button');
    cancel.className = 'btn btn-ghost btn-sm speedup-picker-cancel';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => picker.remove());
    picker.appendChild(cancel);

    anchorEl.appendChild(picker);
    document.addEventListener('click', function handler(e) {
      if (!picker.contains(e.target) && e.target !== anchorEl) {
        picker.remove();
        document.removeEventListener('click', handler, true);
      }
    }, true);
  }
}
