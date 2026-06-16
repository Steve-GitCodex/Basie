/**
 * BuildingDetailPanel.js
 * Owns the slide-up panel (#building-detail-panel) and its two render modes:
 *   • openBuilding  — detail for a built/buildable instance (cost, progress,
 *                     cafeteria stock, build/upgrade + relocate actions)
 *   • openBuildSheet — empty-plot "build here" menu, zone-filtered
 *
 * Extracted from BuildingsUI. Holds the panel target state (bid/idx). Relocation
 * is delegated back to the host via onRelocateRequest.
 */
import { eventBus }         from '../../core/EventBus.js';
import { RES_META, fmt }    from '../uiUtils.js';
import { plotById }         from '../../entities/GAME_DATA.js';
import { ISO_BUILDING_MAP } from '../city/cityAssets.js';

export class BuildingDetailPanel {
  /** @param {{ bm, rm, notifications, onRelocateRequest:(instId:string, zone:string)=>void }} deps */
  constructor({ bm, rm, notifications, onRelocateRequest }) {
    this._bm                = bm;
    this._rm                = rm;
    this._notifications     = notifications;
    this._onRelocateRequest = onRelocateRequest;
    this._bid = null;
    this._idx = null;
  }

  /** Currently-shown building id (or `plot:<id>` for the build sheet), null when closed. */
  get bid() { return this._bid; }
  get idx() { return this._idx; }

  openBuilding(buildingId, instanceIndex) {
    const panel   = document.getElementById('building-detail-panel');
    const sprite$ = document.getElementById('btp-sprite');
    const name$   = document.getElementById('btp-name');
    const level$  = document.getElementById('btp-level');
    const body$   = document.getElementById('btp-body');
    if (!panel || !body$) return;

    const allTypes = this._bm.getBuildingTypesWithInstances();
    const bType    = allTypes.find(t => t.id === buildingId);
    const b        = bType?.instances[instanceIndex];
    if (!b) return;

    const snap     = this._rm.getSnapshot();
    const sprite   = ISO_BUILDING_MAP[buildingId];
    const isBuilt  = b.level > 0;
    const nextLv   = b.effectiveLevel + 1;

    // Header
    if (sprite$) sprite$.style.backgroundImage = sprite ? `url('${sprite}')` : '';
    if (name$)   name$.textContent  = b.name;
    if (level$)  level$.textContent = isBuilt ? `Lv. ${b.level} / ${b.maxLevel}` : 'Not built';

    // Cost chips
    const costHtml = Object.entries(b.cost).map(([res, amt]) => {
      const has = (snap[res]?.amount ?? 0) >= amt;
      return `<span class="cost-chip ${has ? 'affordable' : 'unaffordable'}">${RES_META[res]?.icon ?? '?'} ${fmt(amt)}</span>`;
    }).join('');

    // Progress bar if actively building
    const now = Date.now();
    const progressHtml = b.isActivelyBuilding && b.constructionEndsAt ? (() => {
      const pct  = Math.max(0, Math.min(100, ((now - (b.startedAt ?? 0)) / (b.constructionEndsAt - (b.startedAt ?? 0))) * 100));
      const secs = Math.max(0, Math.ceil((b.constructionEndsAt - now) / 1000));
      return `<div class="progress-container btp-progress" data-timer-start="${b.startedAt}" data-timer-end="${b.constructionEndsAt}">
        <div class="progress-label"><span>🏗️ Building…</span><span class="progress-time-label">${secs}s</span></div>
        <div class="progress-bar"><div class="progress-fill progress-fill-primary" style="width:${pct}%"></div></div>
      </div>`;
    })() : '';

    // Action button state
    let btnText, btnCls, btnDisabled;
    if (b.isActivelyBuilding) { btnText = '🏗️ Building…';                            btnCls = 'btn-ghost'; btnDisabled = true;  }
    else if (!b.requirementsMet) { btnText = isBuilt ? `→ Lv.${nextLv}` : 'Build';   btnCls = 'btn-ghost'; btnDisabled = true;  }
    else if (b.isMaxLevel)       { btnText = '⭐ Max Level';                           btnCls = 'btn-ghost'; btnDisabled = true;  }
    else if (!b.canAfford)       { btnText = isBuilt ? `→ Lv.${nextLv}` : 'Build';   btnCls = 'btn-ghost'; btnDisabled = true;  }
    else                         { btnText = isBuilt ? `→ Lv.${nextLv}` : 'Build';   btnCls = 'btn-primary';                    btnDisabled = false; }

    const timeHtml = !b.isMaxLevel && !b.isActivelyBuilding && b.nextLevelBuildTime
      ? `<div class="btp-time-hint">⏱ Build time: ${fmt(b.nextLevelBuildTime)}s</div>` : '';

    // Lock reason
    const lockHtml = !b.requirementsMet && b.requirementsReason
      ? `<div class="btp-lock-reason">🔒 ${b.requirementsReason}</div>` : '';

    // Cafeteria stock section
    let cafeteriaHtml = '';
    if (buildingId === 'cafeteria' && isBuilt) {
      const stock    = (this._bm.getCafeteriaStock?.() ?? []).find(s => s.instanceId === `cafeteria_${instanceIndex}`);
      const autoOn   = this._bm.getAutomations().cafeteriaRestock ?? false;
      if (stock) {
        const foodCur  = stock.stock.food;
        const waterCur = stock.stock.water;
        const foodCap  = stock.stockCap.food;
        const waterCap = stock.stockCap.water;
        const foodPct  = foodCap  > 0 ? Math.round((foodCur  / foodCap)  * 100) : 0;
        const waterPct = waterCap > 0 ? Math.round((waterCur / waterCap) * 100) : 0;
        cafeteriaHtml = `
          <div class="btp-section-label">Cafeteria Stock</div>
          <div class="btp-cafeteria-stock">
            <div class="btp-stock-row"><span>🌾 Food</span><span class="btp-stock-val">${fmt(foodCur)} / ${fmt(foodCap)}</span></div>
            <div class="progress-container" style="margin-bottom:var(--space-1)">
              <div class="progress-bar"><div class="progress-fill progress-fill-primary" style="width:${foodPct}%"></div></div>
            </div>
            <div class="btp-stock-row"><span>💧 Water</span><span class="btp-stock-val">${fmt(waterCur)} / ${fmt(waterCap)}</span></div>
            <div class="progress-container" style="margin-bottom:var(--space-1)">
              <div class="progress-bar"><div class="progress-fill progress-fill-primary" style="width:${waterPct}%"></div></div>
            </div>
            ${(foodCur <= 0 || waterCur <= 0)
              ? '<div class="btp-lock-reason">⚠️ Empty — restock so your population can grow.</div>' : ''}
          </div>
          ${autoOn
            ? '<div class="btp-auto-badge">⚙️ Auto-restock active</div>'
            : '<button class="btn btn-sm btn-secondary btp-action-btn" id="btp-restock-btn" style="margin-top:var(--space-2)">🔄 Restock to Full</button>'
          }`;
      }
    }

    const instId     = `${buildingId}_${instanceIndex}`;
    const curPlot    = plotById(this._bm.getPlotOf?.(instId) ?? '');
    const canRelocate = !b.isActivelyBuilding && curPlot && curPlot.fixed !== buildingId;

    body$.innerHTML = `
      ${b.effectLabel ? `<div class="btp-effect">${b.effectLabel}</div>` : ''}
      ${lockHtml}
      ${progressHtml}
      <div class="btp-section-label">Cost</div>
      <div class="btp-costs">${costHtml}</div>
      ${timeHtml}
      ${cafeteriaHtml}
      <button class="btn ${btnCls} btp-action-btn" id="btp-action-btn" ${btnDisabled ? 'disabled' : ''}>${btnText}</button>
      ${canRelocate ? `<button class="btn btn-sm btn-ghost btp-action-btn" id="btp-relocate-btn">📦 Relocate</button>` : ''}`;

    // Wire relocate button
    body$.querySelector('#btp-relocate-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      eventBus.emit('ui:click');
      this._onRelocateRequest(instId, this._bm.zoneOfBuilding(buildingId));
    });

    // Wire action button
    body$.querySelector('#btp-action-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      eventBus.emit('ui:click');
      const r = this._bm.build(buildingId, instanceIndex);
      if (!r.success) {
        eventBus.emit('ui:error');
        this._notifications?.show('warning', 'Cannot Build', r.reason);
      }
      this.openBuilding(buildingId, instanceIndex);
    });

    // Wire cafeteria restock button
    body$.querySelector('#btp-restock-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      eventBus.emit('ui:click');
      const stock = (this._bm.getCafeteriaStock?.() ?? []).find(s => s.instanceId === `cafeteria_${instanceIndex}`);
      if (!stock) return;
      const r = this._bm.restockCafeteria?.(stock.instanceId, stock.stockCap.food, stock.stockCap.water);
      if (r && !r.success) {
        this._notifications?.show('warning', 'Cannot Restock', r.reason ?? 'Not enough resources');
      }
      this.openBuilding(buildingId, instanceIndex);
    });

    this._bid = buildingId;
    this._idx = instanceIndex;
    panel.classList.add('is-open');
  }

  close() {
    document.getElementById('building-detail-panel')?.classList.remove('is-open');
    this._bid = null;
    this._idx = null;
  }

  openBuildSheet(plotId, zone) {
    const panel   = document.getElementById('building-detail-panel');
    const sprite$ = document.getElementById('btp-sprite');
    const name$   = document.getElementById('btp-name');
    const level$  = document.getElementById('btp-level');
    const body$   = document.getElementById('btp-body');
    if (!panel || !body$) return;

    const options   = this._bm.getBuildableOnPlot(plotId);
    const snap      = this._rm.getSnapshot();
    const zoneLabel = zone.charAt(0).toUpperCase() + zone.slice(1);

    if (sprite$) sprite$.style.backgroundImage = '';
    if (name$)   name$.textContent  = 'Build Here';
    if (level$)  level$.textContent = `${zoneLabel} district`;

    if (!options.length) {
      body$.innerHTML = `<div class="btp-effect">Nothing left to build in this district —
        every ${zoneLabel.toLowerCase()} building is already placed or locked.</div>`;
    } else {
      body$.innerHTML = options.map(o => {
        const costHtml = Object.entries(o.cost).map(([res, amt]) => {
          const has = (snap[res]?.amount ?? 0) >= amt;
          return `<span class="cost-chip ${has ? 'affordable' : 'unaffordable'}">${RES_META[res]?.icon ?? '?'} ${fmt(amt)}</span>`;
        }).join('');
        const disabled = !o.ok || !o.canAfford;
        const hint = !o.ok ? `<div class="btp-lock-reason">🔒 ${o.reason}</div>` : '';
        return `
          <div class="bs-option">
            <div class="bs-option-row">
              <span class="bs-option-icon">${o.icon ?? '🏗️'}</span>
              <div class="bs-option-info">
                <div class="bs-option-name">${o.name}</div>
                ${o.effectLabel ? `<div class="bs-option-effect">${o.effectLabel}</div>` : ''}
                <div class="btp-costs">${costHtml}</div>
                ${hint}
              </div>
              <button class="btn btn-sm ${disabled ? 'btn-ghost' : 'btn-primary'}"
                      data-build-id="${o.id}" ${disabled ? 'disabled' : ''}>Build</button>
            </div>
          </div>`;
      }).join('');

      body$.querySelectorAll('button[data-build-id]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          eventBus.emit('ui:click');
          const r = this._bm.buildOnPlot(btn.dataset.buildId, plotId);
          if (!r.success) {
            eventBus.emit('ui:error');
            this._notifications?.show('warning', 'Cannot Build', r.reason);
            return;
          }
          this.close();
        });
      });
    }

    // Marker so outside-click close logic engages; building:completed
    // re-open guards no-op on this pseudo id.
    this._bid = `plot:${plotId}`;
    this._idx = 0;
    panel.classList.add('is-open');
  }
}
