/**
 * BuildQueueSidebar.js
 * Renders the fixed-right activity sidebar (#build-queue-panel): three queue
 * sections — BUILD, RESEARCH, TRAINING — each listing active + queued items with
 * progress, cancel/refund and speed-up actions, plus the shared speed-up picker.
 *
 * Extracted from BuildingsUI. Self-contained: reads queue state from the build /
 * tech / unit managers and acts via EventBus + manager calls; the host re-invokes
 * render() on queue events.
 */
import { eventBus }          from '../../core/EventBus.js';
import { openSpeedupPicker } from './SpeedupPicker.js';
import { icon, iconFromEmoji } from '../icons.js';

export class BuildQueueSidebar {
  /** @param {{ bm, tm, um, inventory, notifications }} deps */
  constructor({ bm, tm, um, inventory, notifications }) {
    this._bm            = bm;
    this._tm            = tm;
    this._um            = um;
    this._inventory     = inventory;
    this._notifications = notifications;
  }

  render() {
    const panel = document.getElementById('build-queue-panel');
    if (!panel) return;

    panel.innerHTML = '';
    panel.appendChild(this._buildBuildSection());
    panel.appendChild(this._buildResearchSection());
    panel.appendChild(this._buildTrainingSection());

    // Badge = total active items across all queues
    const buildActive    = (this._bm?.getBuildQueue() ?? []).length;
    const researchActive = (this._tm?.getQueue()      ?? []).length;
    const trainActive    = (this._um?.getAllQueues()   ?? []).length;
    const total = buildActive + researchActive + trainActive;
    const countEl = document.getElementById('bq-toggle-count');
    if (countEl) countEl.textContent = total > 0 ? String(total) : '0';
  }

  _buildBuildSection() {
    const bm       = this._bm;
    const queue    = bm.getBuildQueue();
    const maxSlots = bm.getMaxBuildSlots();
    const slotInfo = bm.getBuildSlotInfo();
    const now      = Date.now();

    const section = document.createElement('div');
    section.className = 'aq-section';

    const activeCount  = queue.filter(q => q.isActive).length;
    const waitingCount = queue.length - activeCount;
    const countText    = waitingCount > 0
      ? `${activeCount}/${maxSlots} · ${waitingCount} waiting`
      : `${activeCount}/${maxSlots}`;

    const header = document.createElement('div');
    header.className = 'aq-section-header aq-section-header--build';
    header.innerHTML = `<span class="aq-section-icon">${icon('hammer')}</span><span class="aq-section-title">BUILD</span><span class="aq-section-count">${countText}</span>`;
    section.appendChild(header);

    const items = document.createElement('div');
    items.className = 'aq-items';

    // Active + queued items
    for (const queueItem of queue) {
      const cfg = queueItem.cfg ?? {};
      const name = (cfg.instanceSlots?.length ?? 1) > 1
        ? `${cfg.name ?? queueItem.buildingId} ${(queueItem.instanceIndex ?? 0) + 1}`
        : (cfg.name ?? queueItem.buildingId);
      const el  = document.createElement('div');

      if (queueItem.isActive) {
        const startedAt = queueItem.startedAt ?? 0;
        const endsAt    = queueItem.endsAt    ?? 0;
        const pct       = endsAt ? Math.max(0, Math.min(100, ((now - startedAt) / (endsAt - startedAt)) * 100)) : 0;
        const secsLeft  = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
        el.className = 'aq-slot aq-slot--active';
        el.innerHTML = `
          <div class="aq-slot-row">
            <span class="aq-slot-icon">${iconFromEmoji(cfg.icon ?? '') || icon('hammer')}</span>
            <div class="aq-slot-info">
              <div class="aq-slot-name">${name}</div>
              <div class="aq-slot-sub">→ Lv.${queueItem.pendingLevel}</div>
            </div>
            <div class="aq-slot-actions">
              <button class="aq-speed-btn" title="Speed Up">⏩</button>
              <button class="aq-cancel-btn" title="Cancel &amp; refund">✕</button>
            </div>
          </div>
          <div class="progress-container aq-progress" data-timer-start="${startedAt}" data-timer-end="${endsAt}">
            <div class="progress-label aq-progress-label">
              <span class="progress-time-label">${secsLeft}s</span>
            </div>
            <div class="progress-bar"><div class="progress-fill progress-fill-primary" style="width:${pct}%"></div></div>
          </div>`;
        const activePos = queueItem.queuePosition;
        el.querySelector('.aq-cancel-btn')?.addEventListener('click', e => {
          e.stopPropagation();
          eventBus.emit('ui:click');
          const r = bm.cancelBuild(activePos);
          if (!r.success) this._notifications?.show('warning', 'Cannot Cancel', r.reason);
        });
        el.querySelector('.aq-speed-btn')?.addEventListener('click', e => {
          e.stopPropagation();
          eventBus.emit('ui:click');
          this._openSpeedupPicker(el, 'building', secsLeft, queueItem.instanceId);
        });
      } else {
        el.className = 'aq-slot aq-slot--queued';
        el.innerHTML = `
          <div class="aq-slot-row">
            <span class="aq-slot-icon">${iconFromEmoji(cfg.icon ?? '') || icon('hammer')}</span>
            <div class="aq-slot-info">
              <div class="aq-slot-name">${name}</div>
              <div class="aq-slot-sub">→ Lv.${queueItem.pendingLevel} · #${(queueItem.waitingPosition ?? 0) + 1}</div>
            </div>
            <button class="aq-cancel-btn" title="Cancel &amp; refund">✕</button>
          </div>`;
        const pos = queueItem.queuePosition;
        el.querySelector('.aq-cancel-btn')?.addEventListener('click', e => {
          e.stopPropagation();
          eventBus.emit('ui:click');
          const r = bm.cancelBuild(pos);
          if (!r.success) this._notifications?.show('warning', 'Cannot Cancel', r.reason);
        });
      }
      items.appendChild(el);
    }

    // Show empty state only if all unlocked slots are empty
    if (queue.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'aq-empty';
      emptyEl.textContent = 'No builds queued';
      items.appendChild(emptyEl);
    }

    // Summarize locked slots compactly
    const lockedCount = slotInfo.filter(s => !s.unlocked).length;
    if (lockedCount > 0) {
      const lockEl = document.createElement('div');
      lockEl.className = 'aq-locked-summary';
      lockEl.innerHTML = `${icon('lock')} ${lockedCount} slot${lockedCount > 1 ? 's' : ''} locked`;
      items.appendChild(lockEl);
    }

    section.appendChild(items);
    return section;
  }

  _buildResearchSection() {
    const tm    = this._tm;
    const queue = tm ? tm.getQueue() : [];
    const now   = Date.now();

    const section = document.createElement('div');
    section.className = 'aq-section';

    const header = document.createElement('div');
    header.className = 'aq-section-header aq-section-header--research';
    header.innerHTML = `<span class="aq-section-icon">${icon('flask')}</span><span class="aq-section-title">RESEARCH</span><span class="aq-section-count">${queue.length}</span>`;
    section.appendChild(header);

    const items = document.createElement('div');
    items.className = 'aq-items';

    if (!tm || queue.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'aq-empty';
      emptyEl.textContent = 'No research active';
      items.appendChild(emptyEl);
    } else {
      for (const item of queue) {
        const el = document.createElement('div');
        if (item.isActive && item.researchEndsAt) {
          const pct      = Math.max(0, Math.min(100, ((now - (item.startedAt ?? 0)) / (item.researchEndsAt - (item.startedAt ?? 0))) * 100));
          const secsLeft = Math.max(0, Math.ceil((item.researchEndsAt - now) / 1000));
          el.className = 'aq-slot aq-slot--active';
          el.innerHTML = `
            <div class="aq-slot-row">
              <span class="aq-slot-icon">${iconFromEmoji(item.icon ?? '') || icon('flask')}</span>
              <div class="aq-slot-info">
                <div class="aq-slot-name">${item.name}</div>
                <div class="aq-slot-sub">→ Lv.${item.targetLevel}</div>
              </div>
              <div class="aq-slot-actions">
                <button class="aq-speed-btn" title="Speed Up">⏩</button>
                <button class="aq-cancel-btn" title="Cancel &amp; refund">✕</button>
              </div>
            </div>
            <div class="progress-container aq-progress" data-timer-start="${item.startedAt}" data-timer-end="${item.researchEndsAt}">
              <div class="progress-label aq-progress-label">
                <span class="progress-time-label">${secsLeft}s</span>
              </div>
              <div class="progress-bar"><div class="progress-fill progress-fill-success" style="width:${pct}%"></div></div>
            </div>`;
          const techId = item.techId;
          el.querySelector('.aq-cancel-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            eventBus.emit('ui:click');
            const r = tm.cancelResearch(techId);
            if (!r.success) this._notifications?.show('warning', 'Cannot Cancel', r.reason);
          });
          el.querySelector('.aq-speed-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            eventBus.emit('ui:click');
            this._openSpeedupPicker(el, 'research', secsLeft);
          });
        } else {
          el.className = 'aq-slot aq-slot--queued';
          el.innerHTML = `
            <div class="aq-slot-row">
              <span class="aq-slot-icon">${iconFromEmoji(item.icon ?? '') || icon('flask')}</span>
              <div class="aq-slot-info">
                <div class="aq-slot-name">${item.name}</div>
                <div class="aq-slot-sub">→ Lv.${item.targetLevel} · #${item.queuePosition + 1}</div>
              </div>
              <button class="aq-cancel-btn" title="Cancel &amp; refund">✕</button>
            </div>`;
          const techId = item.techId;
          el.querySelector('.aq-cancel-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            eventBus.emit('ui:click');
            const r = tm.cancelResearch(techId);
            if (!r.success) this._notifications?.show('warning', 'Cannot Cancel', r.reason);
          });
        }
        items.appendChild(el);
      }
    }

    section.appendChild(items);
    return section;
  }

  _buildTrainingSection() {
    const um    = this._um;
    const items = um ? um.getAllQueues() : [];
    const now   = Date.now();

    const section = document.createElement('div');
    section.className = 'aq-section';

    const header = document.createElement('div');
    header.className = 'aq-section-header aq-section-header--training';
    header.innerHTML = `<span class="aq-section-icon">${icon('sword')}</span><span class="aq-section-title">TRAINING</span><span class="aq-section-count">${items.length}</span>`;
    section.appendChild(header);

    const itemsEl = document.createElement('div');
    itemsEl.className = 'aq-items';

    if (!um || items.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'aq-empty';
      emptyEl.textContent = 'No units training';
      itemsEl.appendChild(emptyEl);
    } else {
      for (const item of items) {
        const el = document.createElement('div');
        const isActive = item.queueIndex === 0 && item.endsAt > 0;
        if (isActive) {
          const pct      = Math.max(0, Math.min(100, ((now - (item.startedAt ?? 0)) / (item.endsAt - (item.startedAt ?? 0))) * 100));
          const secsLeft = Math.max(0, Math.ceil((item.endsAt - now) / 1000));
          el.className = 'aq-slot aq-slot--active';
          el.innerHTML = `
            <div class="aq-slot-row">
              <span class="aq-slot-icon">${iconFromEmoji(item.icon ?? '') || icon('sword')}</span>
              <div class="aq-slot-info">
                <div class="aq-slot-name">${item.name ?? item.unitId} ×${item.count}</div>
                <div class="aq-slot-sub">T${item.tier}</div>
              </div>
              <div class="aq-slot-actions">
                <button class="aq-speed-btn" title="Speed Up">⏩</button>
                <button class="aq-cancel-btn" title="Cancel &amp; refund">✕</button>
              </div>
            </div>
            <div class="progress-container aq-progress" data-timer-start="${item.startedAt}" data-timer-end="${item.endsAt}">
              <div class="progress-label aq-progress-label">
                <span class="progress-time-label">${secsLeft}s</span>
              </div>
              <div class="progress-bar"><div class="progress-fill progress-fill-danger" style="width:${pct}%"></div></div>
            </div>`;
          const { buildingId, queueIndex } = item;
          el.querySelector('.aq-cancel-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            eventBus.emit('ui:click');
            const r = um.cancelTrain(buildingId, queueIndex);
            if (!r.success) this._notifications?.show('warning', 'Cannot Cancel', r.reason);
          });
          el.querySelector('.aq-speed-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            eventBus.emit('ui:click');
            this._openSpeedupPicker(el, 'training', secsLeft);
          });
        } else {
          el.className = 'aq-slot aq-slot--queued';
          el.innerHTML = `
            <div class="aq-slot-row">
              <span class="aq-slot-icon">${iconFromEmoji(item.icon ?? '') || icon('sword')}</span>
              <div class="aq-slot-info">
                <div class="aq-slot-name">${item.name ?? item.unitId} ×${item.count}</div>
                <div class="aq-slot-sub">T${item.tier} · #${item.queueIndex + 1}</div>
              </div>
              <button class="aq-cancel-btn" title="Cancel &amp; refund">✕</button>
            </div>`;
          const { buildingId, queueIndex } = item;
          el.querySelector('.aq-cancel-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            eventBus.emit('ui:click');
            const r = um.cancelTrain(buildingId, queueIndex);
            if (!r.success) this._notifications?.show('warning', 'Cannot Cancel', r.reason);
          });
        }
        itemsEl.appendChild(el);
      }
    }

    section.appendChild(itemsEl);
    return section;
  }

  _openSpeedupPicker(anchorEl, queueType, secsLeft, targetInstanceId = null) {
    openSpeedupPicker({
      anchorRect:    anchorEl.getBoundingClientRect(),
      queueType, secsLeft, targetInstanceId,
      inventory:     this._inventory,
      notifications: this._notifications,
    });
  }
}
