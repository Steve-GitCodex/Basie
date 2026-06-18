/**
 * TileTooltip.js
 * Hover tooltip for the isometric base map. Renders two flavours into
 * #tile-tooltip:
 *   • built/buildable tile — sprite, level, costs, progress + inline build/upgrade action
 *   • empty plot           — slim "tap to build" call-to-action
 *
 * Extracted from BuildingsUI. Owns the hover-state (#tile-tooltip target id,
 * instance index, hide timer); the host controller delegates hover/leave from
 * the CityRenderer and supplies a render callback + city accessor.
 */
import { eventBus }              from '../../core/EventBus.js';
import { RES_META, fmt }         from '../uiUtils.js';
import { BUILDING_VIEW_ACTION, plotById } from '../../entities/GAME_DATA.js';
import { ISO_BUILDING_MAP }      from './cityAssets.js';

export class TileTooltip {
  /** @param {{ bm, rm, notifications, getCity:()=>any, requestRender:()=>void }} deps */
  constructor({ bm, rm, notifications, getCity, requestRender }) {
    this._bm            = bm;
    this._rm            = rm;
    this._notifications = notifications;
    this._getCity       = getCity;        // () => CityRenderer | null
    this._requestRender = requestRender;  // () => void
    this._hideTimeout   = null;
    this._bid           = null;
    this._idx           = 0;
  }

  /** The tooltip is now click-driven: keep it open until an outside click. */
  mount() {
    const tt = document.getElementById('tile-tooltip');
    if (!tt) return;
    tt.addEventListener('mouseenter', () => this.clearHide());
  }

  clearHide() { clearTimeout(this._hideTimeout); }

  scheduleHide(delay = 120) {
    this._hideTimeout = setTimeout(() => this.hide(), delay);
  }

  /** Derive the upgrade/build button's label, style and disabled state from an instance. */
  _upgradeButtonState(b, isBuilt, nextLv) {
    if (!b.requirementsMet) return { btnText: `🔒 ${b.requirementsReason ?? 'Locked'}`, btnCls: 'btn-ghost',   btnDisabled: true };
    if (b.isMaxLevel)       return { btnText: '⭐ Max Level',                            btnCls: 'btn-ghost',   btnDisabled: true };
    const label = isBuilt ? `→ Lv.${nextLv}` : 'Build';
    if (!b.canAfford)       return { btnText: label, btnCls: 'btn-ghost',   btnDisabled: true };
    return                         { btnText: label, btnCls: 'btn-primary', btnDisabled: false };
  }

  /**
   * Reactive in-place update for the open tooltip: refresh cost-chip affordability
   * and the upgrade button as the player's resources change — WITHOUT rebuilding the
   * tooltip's DOM (which would eat in-flight clicks on the action buttons). Mirrors the
   * NavigationUI HUD pattern. No-op unless the tooltip is open on a built/buildable tile.
   */
  patchAffordability() {
    const tt = document.getElementById('tile-tooltip');
    if (!tt || !this._bid || !tt.classList.contains('is-visible')) return;

    const bType = this._bm.getBuildingTypesWithInstances().find(t => t.id === this._bid);
    const b     = bType?.instances[this._idx];
    if (!b) return;
    const snap = this._rm.getSnapshot();

    // Cost chips — toggle affordable/unaffordable in place (matched by resource key).
    const entries = Object.entries(b.cost);
    tt.querySelectorAll('.tt-costs .cost-chip').forEach((chip, i) => {
      const res = chip.dataset.res ?? entries[i]?.[0];
      const amt = b.cost[res];
      if (amt == null) return;
      const has = (snap[res]?.amount ?? 0) >= amt;
      chip.classList.toggle('affordable', has);
      chip.classList.toggle('unaffordable', !has);
    });

    // Upgrade button — text/style/disabled may flip as affordability changes.
    const btn = tt.querySelector('.tt-upgrade-btn');
    if (btn) {
      const isBuilt = b.level > 0;
      const { btnText, btnCls, btnDisabled } = this._upgradeButtonState(b, isBuilt, b.effectiveLevel + 1);
      if (btn.textContent !== btnText) btn.textContent = btnText;
      btn.disabled = btnDisabled;
      btn.classList.toggle('btn-primary', btnCls === 'btn-primary');
      btn.classList.toggle('btn-ghost',   btnCls === 'btn-ghost');
    }
  }

  showTile(buildingId, instanceIndex, tileRect) {
    const tt = document.getElementById('tile-tooltip');
    if (!tt || !tileRect) return;

    const allTypes = this._bm.getBuildingTypesWithInstances();
    const bType    = allTypes.find(t => t.id === buildingId);
    const b        = bType?.instances[instanceIndex];
    const snap     = this._rm.getSnapshot();
    if (!b) return;

    const spriteUrl = ISO_BUILDING_MAP[buildingId] ?? '';
    const isBuilt   = b.level > 0;
    const nextLv    = b.effectiveLevel + 1;

    const costHtml = Object.entries(b.cost).map(([res, amt]) => {
      const has = (snap[res]?.amount ?? 0) >= amt;
      return `<span class="cost-chip ${has ? 'affordable' : 'unaffordable'}" data-res="${res}">${RES_META[res]?.icon ?? '?'} ${fmt(amt)}</span>`;
    }).join('');

    const now = Date.now();
    const progressHtml = b.isActivelyBuilding && b.constructionEndsAt ? (() => {
      const pct  = Math.max(0, Math.min(100, ((now - (b.startedAt ?? 0)) / (b.constructionEndsAt - (b.startedAt ?? 0))) * 100));
      const secs = Math.max(0, Math.ceil((b.constructionEndsAt - now) / 1000));
      return `<div class="tt-progress progress-container" data-timer-start="${b.startedAt}" data-timer-end="${b.constructionEndsAt}">
        <div class="progress-label"><span>🏗️ Building…</span><span class="progress-time-label">${secs}s</span></div>
        <div class="progress-bar"><div class="progress-fill progress-fill-primary" style="width:${pct}%"></div></div>
      </div>`;
    })() : '';

    const { btnText, btnCls, btnDisabled } = this._upgradeButtonState(b, isBuilt, nextLv);

    const timeHint = !b.isMaxLevel && !b.isActivelyBuilding && b.nextLevelBuildTime
      ? `<span class="tt-time-hint">⏱ ${fmt(b.nextLevelBuildTime)}s</span>` : '';

    // "Open its system" button (Barracks → Manage Squads, etc.) — only when built.
    const viewAction = isBuilt ? BUILDING_VIEW_ACTION[buildingId] : null;
    const routeBtn = viewAction
      ? `<button class="btn btn-sm btn-secondary tt-route-btn">${viewAction.label}</button>` : '';
    // "Details" → full building-info page. Icon-only, pinned to the popup's top-right
    // so it never crowds (and overlaps) the action row.
    const detailsBtn = isBuilt
      ? `<button class="tt-info-btn" title="Building details" aria-label="Building details">ⓘ</button>` : '';
    // Cafeteria manual restock (re-homed from the retired detail panel).
    const restockBtn = (isBuilt && buildingId === 'cafeteria' && !(this._bm.getAutomations?.().cafeteriaRestock))
      ? `<button class="btn btn-sm btn-secondary tt-restock-btn">🔄 Restock</button>` : '';
    // Relocate (re-homed from the retired detail panel) — built, not fixed, not mid-build.
    const _instId   = `${buildingId}_${instanceIndex}`;
    const _curPlot  = plotById(this._bm.getPlotOf?.(_instId) ?? '');
    const canRelocate = isBuilt && !b.isActivelyBuilding && _curPlot && _curPlot.fixed !== buildingId;
    const relocateBtn = canRelocate
      ? `<button class="btn btn-sm btn-ghost tt-relocate-btn">📦 Move</button>` : '';

    tt.innerHTML = `
      ${detailsBtn}
      <div class="tt-header">
        <div class="tt-sprite" style="background-image:url('${spriteUrl}')"></div>
        <div class="tt-title-block">
          <div class="tt-name">${b.name}</div>
          <div class="tt-level">${isBuilt ? `Lv. ${b.level} / ${b.maxLevel}` : 'Not built'}</div>
        </div>
      </div>
      ${b.effectLabel ? `<div class="tt-effect">${b.effectLabel}</div>` : ''}
      ${progressHtml}
      <div class="tt-costs">${costHtml}</div>
      <div class="tt-actions">
        <button class="btn btn-sm ${btnCls} tt-upgrade-btn" ${btnDisabled ? 'disabled' : ''}>${btnText}</button>
        ${timeHint}
      </div>
      ${(routeBtn || restockBtn || relocateBtn) ? `<div class="tt-actions tt-actions--secondary">${routeBtn}${restockBtn}${relocateBtn}</div>` : ''}
      <div class="tt-arrow"></div>`;

    this._position(tt, tileRect);

    this._bid = buildingId;
    this._idx = instanceIndex;

    tt.querySelector('.tt-upgrade-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      eventBus.emit('ui:click');
      const r = this._bm.build(buildingId, instanceIndex);
      if (!r.success) {
        eventBus.emit('ui:error');
        this._notifications?.show('warning', 'Cannot Build', r.reason);
      }
      this._requestRender();
      this.showTile(buildingId, instanceIndex,
        this._getCity()?.getTileScreenRect(buildingId, instanceIndex) ?? tileRect);
    });

    // Route to the building's system view (or training, pre-selected)
    tt.querySelector('.tt-route-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      eventBus.emit('ui:click');
      this.hide(true);
      if (viewAction.train)         eventBus.emit('ui:openTraining', { buildingId });
      else if (viewAction.squads)   eventBus.emit('ui:openSquads', { buildingId, instanceIndex });
      else if (viewAction.research) eventBus.emit('ui:openResearch');
      else                          eventBus.emit('ui:navigateTo', viewAction.view);
    });

    // Open the full building-info page
    tt.querySelector('.tt-info-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      eventBus.emit('ui:click');
      this.hide(true);
      eventBus.emit('ui:openBuildingInfo', { buildingId, instanceIndex });
    });

    // Relocate this building (enters placement mode on the map)
    tt.querySelector('.tt-relocate-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      eventBus.emit('ui:click');
      this.hide(true);
      eventBus.emit('ui:relocateBuilding', { instanceId: _instId, zone: this._bm.zoneOfBuilding(buildingId) });
    });

    // Cafeteria manual restock to full
    tt.querySelector('.tt-restock-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      eventBus.emit('ui:click');
      const stock = (this._bm.getCafeteriaStock?.() ?? []).find(s => s.instanceId === `cafeteria_${instanceIndex}`);
      if (!stock) return;
      const r = this._bm.restockCafeteria?.(stock.instanceId, stock.stockCap.food, stock.stockCap.water);
      if (r && !r.success) {
        this._notifications?.show('warning', 'Cannot Restock', r.reason ?? 'Not enough resources');
      }
      this.showTile(buildingId, instanceIndex,
        this._getCity()?.getTileScreenRect(buildingId, instanceIndex) ?? tileRect);
    });
  }

  /** Shared fixed-position placement for the tile tooltip (above/below + arrow). */
  _position(tt, tileRect) {
    const TT_W = 270;
    const TT_GAP = 10;
    let left = tileRect.left + tileRect.width / 2 - TT_W / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - TT_W - 8));

    const above = tileRect.top > 180;
    const arrowLeft = Math.min(
      Math.max(tileRect.left + tileRect.width / 2 - left, 16),
      TT_W - 16
    );

    tt.style.width   = `${TT_W}px`;
    tt.style.left    = `${left}px`;
    tt.style.setProperty('--tt-arrow-left', `${arrowLeft}px`);
    tt.classList.toggle('tt-above', above);
    tt.classList.toggle('tt-below', !above);

    if (above) {
      tt.style.top    = 'auto';
      tt.style.bottom = `${window.innerHeight - tileRect.top + TT_GAP}px`;
    } else {
      tt.style.bottom = 'auto';
      tt.style.top    = `${tileRect.bottom + TT_GAP}px`;
    }

    tt.style.display = 'block';
    requestAnimationFrame(() => tt.classList.add('is-visible'));
  }

  /** Slim tooltip for empty plots: zone + call to action. */
  showPlot(plotId, zone, tileRect) {
    const tt = document.getElementById('tile-tooltip');
    if (!tt || !tileRect) return;
    const zoneLabel = zone.charAt(0).toUpperCase() + zone.slice(1);
    tt.innerHTML = `
      <div class="tt-header">
        <div class="tt-title-block">
          <div class="tt-name">Empty ${zoneLabel} Plot</div>
          <div class="tt-level">Tap to build</div>
        </div>
      </div>
      <div class="tt-arrow"></div>`;
    this._position(tt, tileRect);
    this._bid = null;
  }

  hide(immediate = false) {
    const tt = document.getElementById('tile-tooltip');
    if (!tt) return;
    tt.classList.remove('is-visible');
    this._bid = null;
    const delay = immediate ? 0 : 150;
    setTimeout(() => { if (!tt.classList.contains('is-visible')) tt.style.display = 'none'; }, delay);
  }

  refresh() {
    if (!this._bid) return;
    const rect = this._getCity()?.getTileScreenRect(this._bid, this._idx);
    if (rect && document.getElementById('tile-tooltip')?.classList.contains('is-visible')) {
      this.showTile(this._bid, this._idx, rect);
    }
  }
}
