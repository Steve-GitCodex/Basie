/**
 * MilitaryUI.js
 * Training interface for all military unit buildings:
 *   Infantry Hall, Archery Range, Cavalry Stable, Siege Workshop.
 *
 * Shows a building picker at the top. Selecting a building reveals
 * that building's trainable units, their stats/costs, and the shared
 * training queue.
 */
import { eventBus } from '../../core/EventBus.js';
import { UNITS_CONFIG, BUILDINGS_CONFIG, INVENTORY_ITEMS, UNIT_TIER_REQUIREMENTS } from '../../entities/GAME_DATA.js';
import { RES_META, fmt } from '../uiUtils.js';

/** Buildings that appear in the Military tab, in display order. */
const MILITARY_BUILDINGS = [
  { id: 'infantryhall',  label: 'Infantry Hall',  icon: '🗡️' },
  { id: 'archeryrange',  label: 'Archery Range',  icon: '🏹' },
  { id: 'cavalrystable', label: 'Cavalry Stable', icon: '🐴' },
  { id: 'siegeworkshop', label: 'Siege Workshop', icon: '�' },
];

export class MilitaryUI {
  /**
   * @param {{ rm, um, bm, inventory, notifications }} systems
   */
  constructor(systems) {
    this._s = systems;
    this._activeBuildingId = 'infantryhall';
  }

  init() {
    this._bindBuildingTabs();
    eventBus.on('ui:viewChanged',    v => { if (v === 'military') this.render(); });
    // Open the Training view pre-selected to a specific trainer (from a building click)
    eventBus.on('ui:openTraining',   ({ buildingId } = {}) => this._focusBuilding(buildingId));
    eventBus.on('unit:queueUpdated', q  => this._renderTrainingQueue(q));
    eventBus.on('army:updated',      () => this._renderReserveUnits(this._activeBuildingId));
    eventBus.on('building:completed',() => this.render());
    eventBus.on('tech:researched',   () => this.render());
    eventBus.on('resource:updated',  () => this._refreshCostChips());
  }

  // Refresh affordable/unaffordable chip classes whenever resources change,
  // without triggering a full DOM rebuild. Chips must carry data-res and data-amt.
  _refreshCostChips() {
    const snap = this._s.rm.getSnapshot();
    document.querySelectorAll('.cost-chip[data-res]').forEach(chip => {
      const res = chip.dataset.res;
      const amt = Number(chip.dataset.amt);
      chip.classList.toggle('affordable',   (snap[res]?.amount ?? 0) >= amt);
      chip.classList.toggle('unaffordable', (snap[res]?.amount ?? 0) <  amt);
    });
  }

  render() {
    this._renderBuildingStatus();
    this._renderReserveUnits(this._activeBuildingId);
    this._renderTrainingQueue(this._s.um.getAllQueues());
  }

  // ---- BUILDING TABS ----
  _bindBuildingTabs() {
    document.querySelectorAll('.military-building-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        eventBus.emit('ui:click');
        this._activeBuildingId = btn.dataset.building;
        document.querySelectorAll('.military-building-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._renderBuildingStatus();
        this._renderReserveUnits(this._activeBuildingId);
      });
    });
  }

  /**
   * Open the Training view focused on a specific trainer building. Called from
   * a building click via the `ui:openTraining` event.
   */
  _focusBuilding(buildingId) {
    if (buildingId && MILITARY_BUILDINGS.some(b => b.id === buildingId)) {
      this._activeBuildingId = buildingId;
    }
    // NavigationUI handles showing the Training sub-tab; here we just select the
    // chosen trainer and re-render (works whether the view is visible yet or not).
    document.querySelectorAll('.military-building-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.building === this._activeBuildingId));
    this._renderBuildingStatus();
    this._renderReserveUnits(this._activeBuildingId);
  }

  _renderBuildingStatus() {
    const cfg   = BUILDINGS_CONFIG[this._activeBuildingId];
    if (!cfg) return;
    const level    = this._s.bm.getLevelOf(this._activeBuildingId);
    const statusEl = document.getElementById('military-building-status');
    if (!statusEl) return;

    if (level === 0) {
      statusEl.innerHTML = `<div class="military-building-unbuilt">
        <span class="building-icon">${cfg.icon}</span>
        <span>${cfg.name} has not been built yet.</span>
        <span class="hint-text">Build it in the Base tab to unlock training.</span>
      </div>`;
    } else {
      const slots      = cfg.trainingSlots;
      const slotData   = slots?.[Math.min(level - 1, slots.length - 1)];
      const nextData   = level < cfg.maxLevel ? slots?.[Math.min(level, slots.length - 1)] : null;
      const curSlots   = slotData?.concurrentSlots ?? 1;
      const curBatch   = slotData?.maxBatchSize ?? '∞';
      const curTier    = slotData?.maxTrainableTier ?? '?';
      // P4: show a speed badge when the current level has a trainTimeMultiplier reduction
      const curSpeedPct = (slotData?.trainTimeMultiplier != null && slotData.trainTimeMultiplier < 1)
        ? Math.round((1 - slotData.trainTimeMultiplier) * 100)
        : 0;
      const nextSlots  = nextData?.concurrentSlots ?? null;
      const nextBatch  = nextData?.maxBatchSize ?? null;
      const nextTier   = nextData?.maxTrainableTier ?? null;
      const nextSpeedPct = nextData ? Math.round((1 - nextData.trainTimeMultiplier) * 100) : null;
      const queueDepth = this._s.um.getTrainingQueueDepthForBuilding(this._activeBuildingId);

      const changes = [];
      if (nextSlots && nextSlots > curSlots) changes.push(`${nextSlots} slots`);
      if (nextBatch && nextBatch > curBatch)  changes.push(`${nextBatch}/batch`);
      if (nextTier  && nextTier  > curTier)   changes.push(`T${nextTier} unlocked`);
      if (nextSpeedPct)                        changes.push(`-${nextSpeedPct}% time`);
      const nextInfo = changes.length
        ? `<span class="bld-next-hint">Lv.${level + 1}: ${changes.join(' · ')}</span>`
        : '';

      statusEl.innerHTML = `<div class="military-building-active">
        <span class="building-icon">${cfg.icon}</span>
        <span class="building-name-label">${cfg.name}</span>
        <span class="building-level-badge">Lv.${level}</span>
        <span class="bld-slot-badge" title="Concurrent slots · max batch · max tier">⚙️ ${queueDepth}/${curSlots} slot${curSlots !== 1 ? 's' : ''} · ${curBatch}/batch · max T${curTier}</span>
        ${curSpeedPct > 0 ? `<span class="bld-speed-badge">⚡ -${curSpeedPct}% time</span>` : ''}
        ${nextInfo}
      </div>`;
    }
  }

  // ---- UNIT TRAINING CARDS ----
  _renderReserveUnits(buildingId) {
    const grid = document.getElementById('military-units-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const relevantUnitTypes = Object.entries(UNITS_CONFIG)
      .filter(([, u]) => u.buildingId === buildingId)
      .map(([id, u]) => ({ id, ...u }));
    if (relevantUnitTypes.length === 0) {
      grid.innerHTML = '<div class="military-empty">No units configured for this building.</div>';
      return;
    }

    const buildingLevel = this._s.bm.getLevelOf(buildingId);
    if (buildingLevel === 0) {
      grid.innerHTML = `<div class="military-empty">Build ${BUILDINGS_CONFIG[buildingId]?.name ?? buildingId} first.</div>`;
      return;
    }

    const reserve    = this._s.um.getReserve();
    const reserveMap = {};
    reserve.forEach(u => { reserveMap[u.tierKey] = u.count; });
    const snap = this._s.rm.getSnapshot();

    const TIER_GROUPS = [
      { label: 'Basic',        tiers: [1, 2, 3], open: true,  icon: '🗡️' },
      { label: 'Intermediate', tiers: [4, 5, 6], open: false, icon: '⚔️' },
      { label: 'Advanced',     tiers: [7, 8, 9], open: false, icon: '🔱' },
      { label: 'Special',      tiers: [10],       open: false, icon: '✨' },
    ];

    relevantUnitTypes.forEach(unitType => {
      const typeCard = document.createElement('div');
      typeCard.className = 'military-unit-type-card';

      const header = document.createElement('div');
      header.className = 'military-unit-type-header';
      header.innerHTML = `
        <span class="military-unit-icon">${unitType.icon}</span>
        <div class="military-unit-type-info">
          <div class="military-unit-type-name">${unitType.name}</div>
          <div class="military-unit-type-desc">${unitType.description ?? ''}</div>
        </div>`;
      typeCard.appendChild(header);

      TIER_GROUPS.forEach(group => {
        const groupTiers = (unitType.tiers ?? [])
          .map((cfg, i) => ({ cfg, tier: i + 1 }))
          .filter(({ tier }) => group.tiers.includes(tier));
        if (groupTiers.length === 0) return;

        const section = document.createElement('div');
        section.className = 'tier-group';

        const groupReserveTotal = groupTiers.reduce((sum, { tier }) =>
          sum + (reserveMap[`${unitType.id}_t${tier}`] ?? 0), 0);

        const groupHdr = document.createElement('button');
        groupHdr.type = 'button';
        groupHdr.className = `tier-group-hdr${group.open ? '' : ' collapsed'}`;
        groupHdr.setAttribute('aria-expanded', group.open ? 'true' : 'false');
        groupHdr.innerHTML = `
          <span class="tier-group-icon">${group.icon}</span>
          <span class="tier-group-label">${group.label}</span>
          <span class="tier-group-range">T${Math.min(...group.tiers)}${group.tiers.length > 1 ? '–T' + Math.max(...group.tiers) : ''}</span>
          ${groupReserveTotal > 0 ? `<span class="tier-group-reserve">×${groupReserveTotal} in reserve</span>` : ''}
          <span class="tier-group-chevron">▾</span>`;
        section.appendChild(groupHdr);

        const cardsWrap = document.createElement('div');
        cardsWrap.className = `tier-cards-wrap${group.open ? '' : ' hidden'}`;

        groupTiers.forEach(({ cfg: tierCfg, tier }) => {
          const tierKey = `${unitType.id}_t${tier}`;
          const count   = reserveMap[tierKey] ?? 0;

          const bldgCfg     = BUILDINGS_CONFIG[buildingId];
          const slotData    = bldgCfg?.trainingSlots?.[Math.min(buildingLevel - 1, (bldgCfg.trainingSlots?.length ?? 1) - 1)];
          const maxBatchSz  = slotData?.maxBatchSize ?? Infinity;
          const bldgTierMet = !slotData || tier <= (slotData.maxTrainableTier ?? 99);
          const neededBldgLvl = bldgTierMet ? null : (() => {
            const slots = bldgCfg?.trainingSlots ?? [];
            for (let i = 0; i < slots.length; i++) {
              if ((slots[i].maxTrainableTier ?? 99) >= tier) return i + 1;
            }
            return null;
          })();

          const tierReq   = UNIT_TIER_REQUIREMENTS?.[unitType.id]?.[tier];
          const techId     = tierReq?.techRequired ?? tierCfg.techRequired ?? null;
          const techMet    = !techId || (this._s.tech?.getLevelOf(techId) ?? 0) >= (tierReq?.minTechLevel ?? 1);
          const bldgMet    = !tierReq?.minBuildingLevel || buildingLevel >= tierReq.minBuildingLevel;
          const isHQUnlocked = this._s.um._bm?.getHQUnlockedIds('units')?.has(unitType.id) ?? true;
          const isLocked     = !isHQUnlocked || !bldgTierMet || !techMet || !bldgMet;
          const lockReason   = !isHQUnlocked
            ? (() => { const lv = this._s.um._bm?.getRequiredHQLevel('units', unitType.id); return lv ? `HQ Lv.${lv} required` : 'Locked'; })()
            : !bldgTierMet ? `${bldgCfg?.name ?? buildingId} Lv.${neededBldgLvl ?? '?'} required to train T${tier}`
            : !bldgMet ? `${bldgCfg?.name ?? buildingId} Lv.${tierReq.minBuildingLevel} required`
            : (techId ? `Research: ${techId.replace(/_/g, ' ')} Lv.${tierReq?.minTechLevel ?? 1}` : 'Locked');

          const maxAffordable = isLocked ? 0 : this._s.rm.maxAffordable(tierCfg.cost ?? {});

          const prevKey     = `${unitType.id}_t${tier - 1}`;
          const prevCount   = tier > 1 ? (reserveMap[prevKey] ?? 0) : 0;
          const upgradeCost = tierCfg.upgradeCost ?? null;
          const canUpgrade  = !isLocked && tier > 1 && prevCount > 0 && upgradeCost !== null;
          const maxUpgradable  = canUpgrade ? this._s.rm.maxAffordable(upgradeCost) : 0;
          const upgradeTimeSec = canUpgrade ? (tierCfg.upgradeTime ?? Math.ceil((tierCfg.trainTime ?? 10) * 0.35)) : 0;

          const costHtml = Object.entries(tierCfg.cost ?? {}).map(([res, amt]) =>
            `<span class="cost-chip ${(snap[res]?.amount ?? 0) >= amt ? 'affordable' : 'unaffordable'}" data-res="${res}" data-amt="${amt}">${RES_META[res]?.icon ?? '?'} ${fmt(amt)}</span>`
          ).join('');

          const upgradeMaxAmt  = canUpgrade ? Math.min(prevCount, maxUpgradable, isFinite(maxBatchSz) ? maxBatchSz : Infinity) : 0;
          const upgCostHtml    = canUpgrade && upgradeCost
            ? Object.entries(upgradeCost).map(([res, amt]) =>
                `<span class="cost-chip ${(snap[res]?.amount ?? 0) >= amt ? 'affordable' : 'unaffordable'}" data-res="${res}" data-amt="${amt}">${RES_META[res]?.icon ?? '?'} ${fmt(amt)}</span>`
              ).join('')
            : '';

          const card = document.createElement('div');
          card.className = `tier-unit-card${isLocked ? ' locked' : ''}`;
          card.dataset.tier = tier;
          card.dataset.actionMode = 'train';
          card.innerHTML = `
            <div class="tuc-top">
              <span class="tuc-badge" title="Tier ${tier}">T${tier}</span>
              <div class="tuc-name-row">
                <span class="tuc-name">${tierCfg.name}</span>
                ${count > 0 ? `<span class="tuc-reserve">×${count}</span>` : ''}
              </div>
              <span class="tuc-time">⏱ ${tierCfg.trainTime ?? '?'}s</span>
            </div>
            <div class="tuc-stats">
              <span title="HP">❤️ ${tierCfg.stats?.hp ?? '?'}</span>
              <span title="ATK">⚔️ ${tierCfg.stats?.attack ?? '?'}</span>
              <span title="DEF">🛡️ ${tierCfg.stats?.defense ?? '?'}</span>
            </div>
            <div class="tuc-actions">
              ${isLocked
                ? `<div class="tuc-locked">🔒 ${lockReason}</div>`
                : `${canUpgrade ? `
                   <div class="tuc-mode-toggle">
                     <button class="tuc-mode-btn tuc-mode-btn--active" data-mode="train">Train</button>
                     <button class="tuc-mode-btn" data-mode="upgrade">⬆ Upgrade</button>
                   </div>
                   <div class="tuc-upgrade-info" style="display:none">×${prevCount} T${tier - 1} available — ⏱ ${upgradeTimeSec}s/unit · cost/unit:</div>` : ''}
                   <div class="tuc-cost">${costHtml}</div>
                   <div class="tuc-train-row">
                     <button class="btn btn-ghost btn-sm btn-tier-max" ${maxAffordable === 0 ? 'disabled' : ''}>MAX</button>
                     <input type="number" class="train-amount" value="1" min="1" max="${Math.max(1, Math.min(maxAffordable, isFinite(maxBatchSz) ? maxBatchSz : maxAffordable))}" ${maxAffordable === 0 ? 'disabled' : ''}>
                     <button class="btn btn-primary btn-sm btn-tier-action" ${maxAffordable === 0 ? 'disabled' : ''}>Train</button>
                   </div>
                   ${isFinite(maxBatchSz) ? `<div class="tuc-batch-hint">max ${maxBatchSz}/batch</div>` : ''}`
              }
            </div>`;

          let ttTrainTooltipHtml = '', ttUpgradeTooltipHtml = '';

          if (!isLocked) {
            const costEl        = card.querySelector('.tuc-cost');
            const input         = card.querySelector('.train-amount');
            const actionBtn     = card.querySelector('.btn-tier-action');
            const maxBtn        = card.querySelector('.btn-tier-max');
            const upgradeInfoEl = card.querySelector('.tuc-upgrade-info');
            const timeEl        = card.querySelector('.tuc-time');
            const topEl         = card.querySelector('.tuc-top');

            // ── Mode toggle: swap cost chips + button label in-place ─────────
            if (canUpgrade) {
              card.querySelectorAll('.tuc-mode-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                  eventBus.emit('ui:click');
                  const mode = btn.dataset.mode;
                  card.dataset.actionMode = mode;
                  card.querySelectorAll('.tuc-mode-btn').forEach(b =>
                    b.classList.toggle('tuc-mode-btn--active', b.dataset.mode === mode)
                  );
                  if (mode === 'upgrade') {
                    costEl.innerHTML      = upgCostHtml;
                    actionBtn.textContent = '⬆ Upgrade';
                    actionBtn.disabled    = upgradeMaxAmt === 0;
                    maxBtn.disabled       = upgradeMaxAmt === 0;
                    input.max             = String(Math.max(1, upgradeMaxAmt));
                    input.value           = '1';
                    input.disabled        = upgradeMaxAmt === 0;
                    if (upgradeInfoEl) upgradeInfoEl.style.display = '';
                    if (timeEl) timeEl.textContent = `⏱ ${upgradeTimeSec}s`;
                    if (topEl)  topEl.dataset.tooltipHtml = ttUpgradeTooltipHtml;
                  } else {
                    costEl.innerHTML      = costHtml;
                    actionBtn.textContent = 'Train';
                    actionBtn.disabled    = maxAffordable === 0;
                    maxBtn.disabled       = maxAffordable === 0;
                    input.max             = String(Math.max(1, Math.min(maxAffordable, isFinite(maxBatchSz) ? maxBatchSz : maxAffordable)));
                    input.value           = '1';
                    input.disabled        = maxAffordable === 0;
                    if (upgradeInfoEl) upgradeInfoEl.style.display = 'none';
                    if (timeEl) timeEl.textContent = `⏱ ${tierCfg.trainTime ?? '?'}s`;
                    if (topEl)  topEl.dataset.tooltipHtml = ttTrainTooltipHtml;
                  }
                });
              });
            }

            // ── Shared MAX + action button ───────────────────────────────────
            maxBtn?.addEventListener('click', () => {
              eventBus.emit('ui:click');
              input.value = card.dataset.actionMode === 'upgrade'
                ? upgradeMaxAmt
                : Math.min(maxAffordable, isFinite(maxBatchSz) ? maxBatchSz : maxAffordable);
            });
            actionBtn?.addEventListener('click', () => {
              eventBus.emit('ui:click');
              const amt = parseInt(input?.value, 10) || 1;
              if (card.dataset.actionMode === 'upgrade') {
                const r = this._s.um.upgradeTier(unitType.id, tier - 1, amt);
                if (!r.success) { eventBus.emit('ui:error'); this._s.notifications?.show('warning', 'Cannot Upgrade', r.reason); }
              } else {
                const r = this._s.um.train(unitType.id, amt, tier);
                if (!r.success) { eventBus.emit('ui:error'); this._s.notifications?.show('warning', 'Cannot Train', r.reason); }
              }
            });
          }

          // ── Pre-compute train + upgrade tooltips ────────────────────────────
          {
            const sp     = tierCfg.stats?.speed;
            const ttBase = [
              `<div class="tt-title">${tierCfg.name} \u2014 Tier ${tier}</div>`,
              `<div class="tt-row"><span class="tt-label">❤️ HP</span><span>${tierCfg.stats?.hp ?? '?'}</span></div>`,
              `<div class="tt-row"><span class="tt-label">⚔️ ATK</span><span>${tierCfg.stats?.attack ?? '?'}</span></div>`,
              `<div class="tt-row"><span class="tt-label">🛡️ DEF</span><span>${tierCfg.stats?.defense ?? '?'}</span></div>`,
              sp != null ? `<div class="tt-row"><span class="tt-label">💨 Speed</span><span>${sp}</span></div>` : '',
              `<div class="tt-sep"></div>`,
            ].filter(Boolean).join('');
            const ttTech = techId
              ? `<div class="tt-row tt-muted">🔬 Requires: ${techId.replace(/_/g, ' ')}</div>`
              : '';
            const ttUpgCostBlock = upgradeCost
              ? `<div class="tt-sep"></div><div class="tt-row tt-sub">⬆ Upgrade cost: ${Object.entries(upgradeCost).map(([r, a]) => `${RES_META[r]?.icon ?? r} ${fmt(a)}`).join(' · ')}</div>`
              : '';
            ttTrainTooltipHtml   = ttBase
              + `<div class="tt-row"><span class="tt-label">⏱ Train</span><span>${tierCfg.trainTime ?? '?'}s each</span></div>`
              + ttTech + ttUpgCostBlock;
            ttUpgradeTooltipHtml = canUpgrade
              ? ttBase
                + `<div class="tt-row"><span class="tt-label">⏱ Upgrade</span><span>${upgradeTimeSec}s each</span></div>`
                + ttTech + ttUpgCostBlock
              : ttTrainTooltipHtml;
            card.querySelector('.tuc-top').dataset.tooltipHtml = ttTrainTooltipHtml;
          }

          cardsWrap.appendChild(card);
        });

        section.appendChild(cardsWrap);

        groupHdr.addEventListener('click', () => {
          const isOpen = groupHdr.getAttribute('aria-expanded') === 'true';
          groupHdr.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
          groupHdr.classList.toggle('collapsed', isOpen);
          cardsWrap.classList.toggle('hidden', isOpen);
        });

        typeCard.appendChild(section);
      });

      grid.appendChild(typeCard);
    });
  }

  // ---- REQUIREMENT HELPERS ----
  _checkUnitRequirements(unit) {
    const { requires } = unit;
    if (!requires) return { met: true };
    for (const [key, minLevel] of Object.entries(requires)) {
      if (BUILDINGS_CONFIG[key] !== undefined) {
        const lvl = this._s.bm.getLevelOf(key);
        if (lvl < minLevel) {
          return { met: false, reason: `${BUILDINGS_CONFIG[key].name} Lv.${minLevel}` };
        }
      } else {
        // Tech requirement
        const researched = this._s.tech?.getLevelOf(key) ?? 0;
        if (researched < minLevel) {
          const techName = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          return { met: false, reason: `Requires ${techName}` };
        }
      }
    }
    return { met: true };
  }

  // ---- TRAINING QUEUE ----
  _renderTrainingQueue(queue) {
    const section = document.getElementById('military-queue-section');
    const grid    = document.getElementById('military-queue-grid');
    if (!section || !grid) return;

    // Group flat queue by buildingId
    const byBuilding = {};
    MILITARY_BUILDINGS.forEach(b => { byBuilding[b.id] = []; });
    (queue || []).forEach(q => {
      const bId = q.buildingId ?? UNITS_CONFIG[q.unitId]?.buildingId;
      if (bId && byBuilding[bId]) byBuilding[bId].push(q);
    });

    // Only show section if at least one building has items
    const hasAny = MILITARY_BUILDINGS.some(b => byBuilding[b.id].length > 0);
    section.style.display = hasAny ? '' : 'none';
    if (!hasAny) return;

    grid.innerHTML = '';

    MILITARY_BUILDINGS.forEach(bld => {
      const items   = byBuilding[bld.id];
      const level   = this._s.bm.getLevelOf(bld.id);
      // One linear queue per building — item[0] is the single active slot
      const active  = items.find(q => q.queueIndex === 0);
      const pending = items.filter(q => q.queueIndex > 0)
                           .sort((a, b) => a.queueIndex - b.queueIndex);

      const slot = document.createElement('div');
      slot.className = `mq-slot${items.length === 0 ? ' mq-slot--idle' : ''}`;

      // ---- Slot header ----
      const hdr = document.createElement('div');
      hdr.className = 'mq-slot-hdr';
      hdr.innerHTML = `<span class="mq-slot-icon">${bld.icon}</span>
        <span class="mq-slot-name">${bld.label}</span>
        ${level > 0 ? `<span class="mq-slot-lv">Lv.${level}</span>` : '<span class="mq-slot-unbuilt">Not built</span>'}`;
      slot.appendChild(hdr);

      if (!active) {
        const idle = document.createElement('div');
        idle.className = 'mq-slot-idle';
        idle.textContent = 'Idle';
        slot.appendChild(idle);
      } else {
        // ---- Active item ----
        const duration = active.endsAt - (active.startedAt ?? 0);
        const pct      = duration > 0
          ? Math.max(1, Math.min(100, ((Date.now() - (active.startedAt ?? 0)) / duration) * 100))
          : 1;
        const secsLeft = Math.max(0, Math.ceil((active.endsAt - Date.now()) / 1000));

        const activeEl = document.createElement('div');
        activeEl.className = 'mq-active';
        activeEl.dataset.timerStart = active.startedAt ?? Date.now();
        activeEl.dataset.timerEnd   = active.endsAt;
        activeEl.innerHTML = `
          <div class="mq-active-top">
            <span class="mq-active-icon">${active.icon ?? '⚔️'}</span>
            <div class="mq-active-info">
              <div class="mq-active-name">${active.name} <span class="mq-count">×${active.count}</span></div>
              <div class="mq-active-bar progress-bar"><div class="mq-active-fill progress-fill" style="width:${pct}%"></div></div>
            </div>
            <span class="mq-time progress-time-label">${secsLeft}s</span>
          </div>
          <div class="mq-active-actions">
            <button class="mq-btn-speed" title="Speed Up">⏩ Speed</button>
            <button class="mq-btn-cancel" title="Cancel">×</button>
          </div>`;

        activeEl.querySelector('.mq-btn-speed').addEventListener('click', e => {
          e.stopPropagation(); eventBus.emit('ui:click');
          this._openSpeedupPicker(activeEl, 'training', secsLeft);
        });
        activeEl.querySelector('.mq-btn-cancel').addEventListener('click', () => {
          eventBus.emit('ui:click');
          this._s.um.cancelTrain(active.buildingId, 0);
        });
        slot.appendChild(activeEl);
      }

      // ---- Pending list ----
      if (pending.length > 0) {
        const pendList = document.createElement('div');
        pendList.className = 'mq-pending-list';
        pending.forEach(q => {
          const row = document.createElement('div');
          row.className = 'mq-pending-item';
          row.innerHTML = `
            <span class="mq-pend-icon">${q.icon}</span>
            <span class="mq-pend-name">${q.name} ×${q.count}</span>
            <button class="mq-pend-cancel" title="Cancel">×</button>`;
          row.querySelector('.mq-pend-cancel').addEventListener('click', () => {
            eventBus.emit('ui:click');
            this._s.um.cancelTrain(q.buildingId, q.queueIndex);
          });
          pendList.appendChild(row);
        });
        slot.appendChild(pendList);
      }

      grid.appendChild(slot);
    });
  }

  // ---- SPEED-UP PICKER ----
  _openSpeedupPicker(anchorEl, queueType, secsLeft) {
    document.querySelector('.speedup-picker')?.remove();
    const inventory = this._s.inventory;
    if (!inventory) return;

    // getOwnedItems() spreads cfg onto each item — i.type/i.target/i.id/i.skipSeconds
    // are all available directly. i.itemId does NOT exist (old bug).
    const owned = inventory.getOwnedItems()
      .filter(i => i.type === 'speed_boost' && (i.target === queueType || i.target === 'any'))
      .sort((a, b) => a.skipSeconds - b.skipSeconds);

    // Pick the smallest item that still completes the timer as the recommendation
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
