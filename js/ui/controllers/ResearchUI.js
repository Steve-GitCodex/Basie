/**
 * ResearchUI.js
 * Two-level Research view (no pan/zoom anywhere):
 *   Level 1 — branch card grid (the landing): one card per research branch with
 *             aggregate progress. Scroll, no panning.
 *   Level 2 — drill into a card → a vertically-scrolling interconnected node tree
 *             for that branch (scroll down; connectors drawn between prereqs).
 * A bottom active-research bar (current tech + progress + speed-up) shows on both
 * levels. The global build-queue sidebar still aggregates research too.
 */
import { eventBus }            from '../../core/EventBus.js';
import { RES_META, fmt }       from '../uiUtils.js';
import { TECH_BRANCHES }       from '../../entities/GAME_DATA.js';

const TIER_COLORS  = { 1: 'var(--clr-success)', 2: 'var(--clr-gold)', 3: 'var(--clr-danger)', 4: 'var(--clr-primary)' };
const BRANCH_COLOR = { economy: 'var(--clr-gold)', combat: 'var(--clr-danger)', units: 'var(--clr-primary)' };

export class ResearchUI {
  /** @param {{ rm, tech, inventory, achievements, notifications }} systems */
  constructor(systems) {
    this._s = systems;
    this._level = 'grid';      // 'grid' | 'tree'
    this._activeBranch = null; // branch id when in 'tree'
  }

  init() {
    eventBus.on('ui:openResearch',  () => this._open());
    eventBus.on('tech:researched',  () => { if (this._isOpen()) this.render(); });
    eventBus.on('tech:started',     () => { if (this._isOpen()) this.render(); });
    eventBus.on('tech:queueUpdated',() => { if (this._isOpen()) this.render(); });
  }

  _isOpen() { return this._panel && !this._panel.classList.contains('hidden'); }

  _open() {
    this._panel = document.getElementById('research-panel');
    this._sheet = document.getElementById('research-sheet');
    if (!this._panel || !this._sheet) return;
    this._level = 'grid';
    this._activeBranch = null;
    this._panel.classList.remove('hidden');
    document.body.classList.add('sheet-open');
    this._panel.onclick = e => { if (e.target === this._panel) this._close(); };
    this._escHandler = e => { if (e.key === 'Escape') this._close(); };
    document.addEventListener('keydown', this._escHandler);
    this.render();
  }

  _close() {
    this._panel?.classList.add('hidden');
    document.body.classList.remove('sheet-open');
    if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
    document.querySelector('.tech-node-popover')?.remove();
    document.querySelector('.speedup-picker')?.remove();
  }

  render() {
    if (!this._sheet) return;
    const inTree = this._level === 'tree' && this._activeBranch;
    const branch = inTree ? TECH_BRANCHES.find(b => b.id === this._activeBranch) : null;
    this._sheet.innerHTML = `
      <div class="research-modal">
        <div class="rs-header">
          ${inTree ? '<button class="rs-back" title="Back to branches">←</button>' : ''}
          <div class="rs-title">${inTree ? `${branch?.icon ?? ''} ${branch?.label ?? 'Research'}` : '🔬 Research'}</div>
          <button class="rs-close" aria-label="Close">✕</button>
        </div>
        <div class="rs-body" id="rs-body"></div>
      </div>`;
    const modal = this._sheet.firstElementChild;
    const body  = modal.querySelector('#rs-body');
    this._sheet.querySelector('.rs-close')?.addEventListener('click', () => this._close());
    this._sheet.querySelector('.rs-back')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      this._level = 'grid';
      this._activeBranch = null;
      this.render();
    });

    if (inTree) this._renderTree(body, this._activeBranch);
    else        this._renderGrid(body);

    this._renderActiveBar(modal);
  }

  // ─────────────────────────────────────────────
  // Level 1 — Branch card grid
  // ─────────────────────────────────────────────
  _renderGrid(container) {
    const all = this._s.tech.getTechWithState();

    const grid = document.createElement('div');
    grid.className = 'research-branch-grid';

    TECH_BRANCHES.forEach(branch => {
      const techs = all.filter(t => t.branch === branch.id);
      if (techs.length === 0) return;
      const sumLvl = techs.reduce((s, t) => s + (t.level ?? 0), 0);
      const sumMax = techs.reduce((s, t) => s + (t.maxLevel ?? 0), 0);
      const pct    = sumMax > 0 ? Math.round((sumLvl / sumMax) * 100) : 0;
      const started = techs.filter(t => (t.level ?? 0) > 0).length;
      const color  = BRANCH_COLOR[branch.id] ?? 'var(--clr-primary)';
      const active = techs.some(t => t.isActive);

      const card = document.createElement('button');
      card.className = 'research-branch-card';
      card.style.setProperty('--branch-color', color);
      card.innerHTML = `
        ${active ? '<span class="rb-active-dot" title="Researching">🔬</span>' : ''}
        <span class="rb-icon">${branch.icon}</span>
        <span class="rb-pct">${pct}%</span>
        <span class="rb-name">${branch.label}</span>
        <span class="rb-sub">${started}/${techs.length} researched</span>
        <span class="rb-meter"><span class="rb-meter-fill" style="width:${pct}%"></span></span>`;
      card.addEventListener('click', () => {
        eventBus.emit('ui:click');
        this._level = 'tree';
        this._activeBranch = branch.id;
        this.render();
      });
      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  // ─────────────────────────────────────────────
  // Level 2 — Vertical interconnected tree (no pan/zoom)
  // ─────────────────────────────────────────────
  _renderTree(container, branchId) {
    const NODE_W = 188, NODE_H = 60, COL_GAP = 28, ROW_GAP = 132, PAD = 28;

    const snap  = this._s.rm.getSnapshot();
    const techs = this._s.tech.getTechWithState().filter(t => t.branch === branchId);

    // Tiers present in this branch → row index
    const tiers = [...new Set(techs.map(t => t.tier))].sort((a, b) => a - b);
    const rowOf = new Map(tiers.map((tier, i) => [tier, i]));
    const byRow = tiers.map(tier => techs.filter(t => t.tier === tier));

    // Stage size
    const rowWidths = byRow.map(n => n.length * NODE_W + (n.length - 1) * COL_GAP);
    const stageW = Math.max(NODE_W, ...rowWidths) + PAD * 2;
    const stageH = PAD * 2 + (tiers.length - 1) * ROW_GAP + NODE_H;

    // Node positions
    const positions = new Map();
    byRow.forEach((nodes, r) => {
      const startX = (stageW - rowWidths[r]) / 2;
      nodes.forEach((t, i) => {
        positions.set(t.id, { x: startX + i * (NODE_W + COL_GAP), y: PAD + r * ROW_GAP });
      });
    });

    const scroll = document.createElement('div');
    scroll.className = 'research-tree-scroll';

    const stage = document.createElement('div');
    stage.className = 'research-tree-stage';
    stage.style.width  = `${stageW}px`;
    stage.style.height = `${stageH}px`;

    // SVG edges (within-branch prereqs only); vertical bezier prereq→dependent
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('research-tree-edges');
    svg.setAttribute('width', stageW);
    svg.setAttribute('height', stageH);
    svg.setAttribute('viewBox', `0 0 ${stageW} ${stageH}`);
    for (const t of techs) {
      const tp = positions.get(t.id);
      if (!tp || !t.prereqTechs?.length) continue;
      for (const reqId of t.prereqTechs) {
        const sp = positions.get(reqId);
        if (!sp) continue; // cross-branch prereq → shown as locked msg in popover instead
        const x1 = sp.x + NODE_W / 2, y1 = sp.y + NODE_H;
        const x2 = tp.x + NODE_W / 2, y2 = tp.y;
        const cpy = (y1 + y2) / 2;
        const met = (this._s.tech.getLevelOf(reqId) ?? 0) > 0;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M${x1},${y1} C${x1},${cpy} ${x2},${cpy} ${x2},${y2}`);
        path.setAttribute('stroke', met ? 'var(--clr-success)' : 'var(--clr-text-muted)');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('opacity', met ? '0.8' : '0.4');
        if (!met) path.setAttribute('stroke-dasharray', '6 4');
        svg.appendChild(path);
      }
    }
    stage.appendChild(svg);

    // Slim nodes
    const nodesLayer = document.createElement('div');
    nodesLayer.className = 'research-tree-nodes';
    for (const t of techs) {
      const pos = positions.get(t.id);
      if (!pos) continue;
      nodesLayer.appendChild(this._buildTreeNode(t, snap, pos, NODE_W, NODE_H));
    }
    stage.appendChild(nodesLayer);

    scroll.appendChild(stage);
    container.appendChild(scroll);

    // Click bare background closes popover
    scroll.addEventListener('pointerdown', e => {
      if (!e.target.closest('.tech-graph-node, .tech-node-popover')) {
        document.querySelector('.tech-node-popover')?.remove();
      }
    });
  }

  _buildTreeNode(t, snap, pos, nodeW, nodeH) {
    const isLocked  = !t.requirementsMet && !t.isMaxed;
    const tierColor = TIER_COLORS[t.tier] ?? 'var(--clr-border-light)';

    let statusBadge = '';
    if (t.isMaxed)       statusBadge = '<span class="tech-node-badge tgnb-maxed">⭐</span>';
    else if (t.isActive) statusBadge = '<span class="tech-node-badge tgnb-active">🔬</span>';
    else if (t.isQueued) statusBadge = '<span class="tech-node-badge tgnb-queued">⏳</span>';
    else if (isLocked)   statusBadge = '<span class="tech-node-badge tgnb-locked">🔒</span>';

    const node = document.createElement('div');
    node.className = `tech-graph-node${isLocked ? ' tech-node-locked' : t.isMaxed ? ' tech-node-maxed' : t.level > 0 ? ' tech-node-active' : ''}`;
    node.dataset.techId = t.id;
    node.style.cssText = `left:${pos.x}px;top:${pos.y}px;width:${nodeW}px;height:${nodeH}px`;
    node.innerHTML = `
      <div class="tech-node-inner" style="border-color:${isLocked ? 'var(--clr-border-light)' : tierColor}">
        <span class="tech-tier-stripe" style="background:${tierColor}"></span>
        <span class="tech-node-icon">${t.icon}</span>
        <div class="tech-node-titles">
          <div class="tech-node-name">${t.name}</div>
          <div class="tech-node-lvl">Lv.${t.level}/${t.maxLevel}</div>
        </div>
        ${statusBadge}
      </div>`;

    node.addEventListener('click', e => {
      e.stopPropagation();
      this._openNodePopover(node, t, snap);
    });
    return node;
  }

  _openNodePopover(anchorNode, t, snap) {
    document.querySelector('.tech-node-popover')?.remove();
    const isLocked = !t.requirementsMet && !t.isMaxed;

    const costHtml = t.nextLevelCost
      ? Object.entries(t.nextLevelCost).map(([res, amt]) =>
          `<span class="cost-chip ${(snap[res]?.amount ?? 0) >= amt ? 'affordable' : 'unaffordable'}">${RES_META[res]?.icon ?? '?'} ${fmt(amt)}</span>`
        ).join('')
      : '';
    const timeHtml = t.nextLevelTime ? `<span class="tech-time-hint">⏱ ${fmt(t.nextLevelTime)}s</span>` : '';

    let btnHtml = '';
    if (t.isMaxed)       btnHtml = '<button class="btn btn-sm btn-ghost" disabled>⭐ Maxed</button>';
    else if (t.isActive) btnHtml = '<button class="btn btn-sm btn-ghost" disabled>⏳ Researching…</button>';
    else if (t.isQueued) btnHtml = `<button class="btn btn-sm btn-ghost" disabled>⏳ Queued (#${t.queuePosition + 1})</button>`;
    else if (!isLocked)  btnHtml = `<button class="btn btn-sm btn-primary popover-research-btn" data-techid="${t.id}">🔬 Research Lv.${t.level + 1}</button>`;

    const popover = document.createElement('div');
    popover.className = 'tech-node-popover';
    popover.innerHTML = `
      <div class="popover-head">
        <span>${t.icon}</span>
        <strong>${t.name}</strong>
        <span class="popover-lvl">Lv.${t.level}/${t.maxLevel}</span>
        <button class="btn btn-xs btn-ghost popover-close">✕</button>
      </div>
      <div class="popover-desc">${t.description}</div>
      ${t.level > 0 ? `<div class="popover-bonus">✓ Current: ${this._fmtEffects(t.effects, t.level)}</div>` : ''}
      ${!t.isMaxed ? `<div class="popover-bonus popover-next">↑ Lv.${t.level + 1}: ${this._fmtEffects(t.effects, t.level + 1)}</div>` : ''}
      ${isLocked ? `<div class="popover-missing">🔒 ${this._s.tech.canResearch(t.id).missingRequirements.join(', ') || 'Requirements not met'}</div>` : ''}
      ${!isLocked && !t.isMaxed ? `<div class="popover-cost">${costHtml} ${timeHtml}</div>` : ''}
      <div class="popover-actions">${btnHtml}</div>`;

    popover.querySelector('.popover-close')?.addEventListener('click', e => { e.stopPropagation(); popover.remove(); });
    popover.querySelector('.popover-research-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      eventBus.emit('ui:click');
      const r = this._s.tech.research(e.currentTarget.dataset.techid);
      popover.remove();
      if (!r.success) { eventBus.emit('ui:error'); this._s.notifications?.show('warning', 'Cannot Research', r.reason); }
    });

    anchorNode.appendChild(popover);

    // Flip upward if it would overflow the viewport bottom
    const vbottom = document.documentElement.clientHeight;
    if (popover.getBoundingClientRect().bottom > vbottom) {
      popover.style.top = 'auto';
      popover.style.bottom = 'calc(100% + 8px)';
    }
  }

  // ─────────────────────────────────────────────
  // Bottom active-research bar
  // ─────────────────────────────────────────────
  _renderActiveBar(container) {
    const queue  = this._s.tech.getQueue();
    const active = queue.find(q => q.isActive);
    const queued = queue.filter(q => !q.isActive).length;

    const bar = document.createElement('div');
    bar.className = 'research-active-bar';

    if (!active) {
      bar.classList.add('research-active-bar--idle');
      bar.innerHTML = '<span class="rab-idle">No research in progress — pick a technology above.</span>';
      container.appendChild(bar);
      return;
    }

    const startedAt = active.startedAt ?? 0;
    const endsAt    = active.researchEndsAt ?? 0;
    const pct       = endsAt ? Math.max(0, Math.min(100, ((Date.now() - startedAt) / (endsAt - startedAt)) * 100)) : 0;
    const secsLeft  = endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : 0;

    bar.setAttribute('data-timer-start', startedAt);
    bar.setAttribute('data-timer-end', endsAt);
    bar.innerHTML = `
      <span class="rab-icon">${active.icon}</span>
      <div class="rab-info">
        <div class="rab-name">${active.name} → Lv.${active.targetLevel}/${active.maxLevel}${queued ? ` <span class="rab-queued">+${queued} queued</span>` : ''}</div>
        <div class="progress-bar"><div class="progress-fill progress-fill-xp" style="width:${pct}%"></div></div>
      </div>
      <span class="progress-time-label rab-time">${secsLeft}s</span>
      <button class="btn btn-xs btn-warning rab-speed" title="Speed up">⏩</button>
      <button class="btn btn-xs btn-ghost rab-cancel" data-techid="${active.techId}" title="Cancel &amp; refund">✕</button>`;

    bar.querySelector('.rab-speed')?.addEventListener('click', e => {
      e.stopPropagation(); eventBus.emit('ui:click');
      this._openSpeedupPicker(bar, 'research', secsLeft);
    });
    bar.querySelector('.rab-cancel')?.addEventListener('click', e => {
      e.stopPropagation(); eventBus.emit('ui:click');
      const r = this._s.tech.cancelResearch(e.currentTarget.dataset.techid);
      if (!r.success) this._s.notifications?.show('warning', 'Cannot Cancel', r.reason);
    });

    container.appendChild(bar);
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  _fmtEffects(effects, level) {
    return Object.entries(effects).map(([key, val]) => {
      const total = val * level;
      const label = key.replace(/([A-Z])/g, ' $1').toLowerCase();
      return typeof val === 'number' && val > 0 && val < 1
        ? `+${Math.round(total * 100)}% ${label}`
        : `+${total} ${label}`;
    }).join(', ');
  }

  // ─────────────────────────────────────────────
  // Speed-Up Picker
  // ─────────────────────────────────────────────
  _openSpeedupPicker(anchorEl, queueType, secsLeft) {
    document.querySelector('.speedup-picker')?.remove();

    const inventory = this._s.inventory;
    if (!inventory) return;

    const owned = inventory.getOwnedItems().filter(i =>
      i.type === 'speed_boost' && (i.target === queueType || i.target === 'any'));

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
        eventBus.emit('ui:navigateTo', 'shop');
      });
    } else {
      const sorted = [...owned].sort((a, b) => a.skipSeconds - b.skipSeconds);
      const recommended = sorted.find(i => i.skipSeconds >= secsLeft) ?? sorted[sorted.length - 1];
      picker.innerHTML = `
        <div class="speedup-picker-title">⏩ Speed Up</div>
        ${sorted.map(item => {
          const isRec = item.id === recommended.id;
          const label = item.skipSeconds >= 999999 ? 'Instant'
            : item.skipSeconds >= 3600 ? `${Math.round(item.skipSeconds / 3600)}h`
            : `${Math.round(item.skipSeconds / 60)}m`;
          const typeTag = item.target === 'any' ? ' (Universal)' : '';
          return `
            <button class="speedup-option${isRec ? ' speedup-recommended' : ''}" data-item="${item.id}">
              <span class="speedup-option-icon">${item.icon}</span>
              <span class="speedup-option-label">${label}${typeTag}</span>
              <span class="speedup-option-qty">×${item.quantity}</span>
              ${isRec ? '<span class="speedup-rec-badge">⭐ Best</span>' : ''}
            </button>`;
        }).join('')}`;

      picker.querySelectorAll('.speedup-option').forEach(btn => {
        btn.addEventListener('click', () => {
          const r = inventory.useItem(btn.dataset.item, { queueType });
          picker.remove();
          if (!r.success) this._s.notifications?.show('warning', 'Cannot Speed Up', r.reason);
          else {
            const remaining = r.completed ? 'Done!' : `${Math.ceil((r.remaining ?? 0) / 1000)}s left`;
            this._s.notifications?.show('success', '⏩ Sped Up!', remaining);
          }
        });
      });
    }

    const closeHandler = e => {
      if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('pointerdown', closeHandler, true); }
    };
    setTimeout(() => document.addEventListener('pointerdown', closeHandler, true), 0);

    anchorEl.style.position = 'relative';
    anchorEl.appendChild(picker);
  }
}
