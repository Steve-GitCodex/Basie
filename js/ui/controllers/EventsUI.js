/**
 * EventsUI.js
 * Renders the Events view (active and upcoming event cards) and the
 * event detail/claim modal.  Tracks a nav badge when an event is live.
 *
 * Subscribes to:
 *   events:updated  → re-renders the view and updates badge
 *   ui:openEvents   → opens the active event detail modal directly
 */
import { eventBus }               from '../../core/EventBus.js';
import { openModal, closeModal, fmt, RES_META } from '../uiUtils.js';
import { icon, iconFromEmoji } from '../icons.js';

/** Format milliseconds remaining as "Xh Ym" or "Xm Ys". */
function fmtRemaining(ms) {
  if (ms <= 0) return 'Expired';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  return `${s}s`;
}

export class EventsUI {
  constructor(systems) {
    this._s = systems;   // { events, rm, notifications }
  }

  init() {
    eventBus.on('ui:viewChanged', v => { if (v === 'events') this.render(); });
    eventBus.on('events:updated', ()  => {
      this.render();
      this._updateBanner();
    });
    eventBus.on('ui:openEvents', () => {
      const state = this._s.events.getPublicState();
      if (state.activeEvent) this.showEventModal(state.activeEvent);
    });
    // Initial banner state
    this._updateBanner();
  }

  // ─── VIEW RENDER ──────────────────────────────────────────────

  render() {
    const container = document.getElementById('events-list');
    if (!container) return;

    const { activeEvent, events } = this._s.events.getPublicState();

    if (!activeEvent && events.every(e => e.startTs === null)) {
      container.innerHTML = `
        <div class="card" style="text-align:center;padding:var(--space-6);color:var(--clr-text-secondary)">
          <div style="font-size:2rem;margin-bottom:var(--space-3)">${icon('clock', 'icon--xl')}</div>
          <div style="font-weight:600;margin-bottom:var(--space-2)">No Events Running</div>
          <div style="font-size:var(--text-sm)">Check back later for limited-time events with bonus rewards!</div>
        </div>`;
      return;
    }

    container.innerHTML = events.map(event => this._renderEventCard(event)).join('');

    container.querySelectorAll('.btn-event-claim').forEach(btn => {
      btn.addEventListener('click', () => this._s.events.claimReward(btn.dataset.id));
    });
    container.querySelectorAll('.btn-event-details').forEach(btn => {
      btn.addEventListener('click', () => {
        const event = events.find(e => e.id === btn.dataset.id);
        if (event) this.showEventModal(event);
      });
    });
  }

  _renderEventCard(event) {
    const effectsHtml = Object.entries(event.effects)
      .map(([res, mult]) =>
        `<span class="event-effect-tag">${RES_META[res]?.icon ?? '' ?? ''} ${res} ×${mult}</span>`
      ).join('');

    const objectivesHtml = event.objectives.map(obj => {
      const pct = obj.target > 0 ? Math.min(100, Math.round((obj.progress / obj.target) * 100)) : 0;
      return `
        <div class="event-objective">
          <div class="event-obj-header">
            <span>${obj.description}</span>
            <span class="event-obj-count">${fmt(obj.progress)} / ${fmt(obj.target)}</span>
          </div>
          <div class="event-obj-bar"><div class="event-obj-bar-fill" style="width:${pct}%"></div></div>
        </div>`;
    }).join('');

    const rewardHtml = Object.entries(event.reward)
      .map(([res, amt]) => `<span class="reward-pill">${RES_META[res]?.icon ?? '' ?? ''} +${fmt(amt)}</span>`)
      .join('');

    const status = event.isActive
      ? `<span class="event-status-live">${icon('fire', 'icon--danger')} LIVE · ${fmtRemaining(event.timeRemainingMs)} left</span>`
      : (event.startTs === null
        ? `<span class="event-status-inactive">${icon('clock')} Not scheduled</span>`
        : `<span class="event-status-upcoming">${icon('clock', 'icon--gold')} Upcoming</span>`);

    const cardClass = event.isActive ? 'card event-card event-card--active' : 'card event-card event-card--inactive';

    return `
      <div class="${cardClass}" id="event-card-${event.id}">
        <div class="event-card-header">
          <span class="event-card-icon">${iconFromEmoji(event.icon)}</span>
          <div class="event-card-titleblock">
            <div class="event-card-name">${event.name}</div>
            ${status}
          </div>
        </div>
        <p class="event-card-desc">${event.description}</p>
        ${effectsHtml ? `<div class="event-effects">${effectsHtml}</div>` : ''}
        ${event.isActive && event.objectives.length > 0 ? `<div class="event-objectives">${objectivesHtml}</div>` : ''}
        ${event.isActive && rewardHtml ? `<div class="event-reward"><span style="opacity:.7;font-size:var(--text-xs)">Reward:</span> ${rewardHtml}</div>` : ''}
        <div class="card-actions">
          <button class="btn btn-sm btn-ghost btn-event-details" data-id="${event.id}">Details</button>
          ${event.canClaim
            ? `<button class="btn btn-sm btn-primary btn-event-claim" data-id="${event.id}">Claim Reward</button>`
            : event.claimed
              ? `<button class="btn btn-sm btn-ghost" disabled>${icon('check')} Claimed</button>`
              : ''}
        </div>
      </div>`;
  }

  // ─── ACTIVE EVENT BANNER ──────────────────────────────────────

  _updateBanner() {
    const banner = document.getElementById('events-banner');
    if (!banner) return;
    const state = this._s.events.getPublicState();
    const ev    = state.activeEvent;
    if (!ev) {
      banner.classList.add('hidden');
      banner.innerHTML = '';
      return;
    }
    const effectsText = Object.entries(ev.effects)
      .map(([res, mult]) => `${RES_META[res]?.icon ?? '' ?? res} ×${mult}`)
      .join('  ');
    banner.classList.remove('hidden');
    banner.innerHTML = `
      <button class="events-banner-inner" id="events-banner-btn" title="Click to view event details">
        <span class="events-banner-icon">${iconFromEmoji(ev.icon)}</span>
        <span class="events-banner-name">${ev.name}</span>
        <span class="events-banner-effects">${effectsText}</span>
        <span class="events-banner-timer">⏱ ${fmtRemaining(ev.timeRemainingMs)}</span>
      </button>`;
    document.getElementById('events-banner-btn')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      this.showEventModal(ev);
    });
  }

  // ─── EVENT DETAIL MODAL ───────────────────────────────────────

  showEventModal(event) {
    const effectsHtml = Object.entries(event.effects)
      .map(([res, mult]) =>
        `<div class="offline-reward-row"><span>${RES_META[res]?.icon ?? '' ?? ''} ${res.charAt(0).toUpperCase() + res.slice(1)}</span><span style="color:var(--clr-gold)">×${mult}</span></div>`
      ).join('');

    const objectivesHtml = event.objectives.map(obj => {
      const pct = obj.target > 0 ? Math.min(100, Math.round((obj.progress / obj.target) * 100)) : 0;
      return `
        <div style="margin-bottom:var(--space-2)">
          <div style="display:flex;justify-content:space-between;font-size:var(--text-sm);margin-bottom:4px">
            <span>${obj.description}</span>
            <span style="color:var(--clr-text-secondary)">${fmt(obj.progress)} / ${fmt(obj.target)}</span>
          </div>
          <div style="height:6px;background:var(--clr-bg-3);border-radius:3px">
            <div style="height:100%;width:${pct}%;background:var(--clr-success);border-radius:3px;transition:width .3s"></div>
          </div>
        </div>`;
    }).join('');

    const rewardHtml = Object.entries(event.reward)
      .map(([res, amt]) =>
        `<div class="offline-reward-row"><span>${RES_META[res]?.icon ?? '' ?? ''} ${res.charAt(0).toUpperCase() + res.slice(1)}</span><span style="color:var(--clr-success)">+${fmt(amt)}</span></div>`
      ).join('');

    const html = `
      <div class="modal-inner">
        <div class="modal-top">
          <div class="modal-icon">${iconFromEmoji(event.icon)}</div>
          <div class="modal-title-block">
            <div class="modal-title">${event.name}</div>
            <div class="modal-subtitle">${event.isActive ? `⏱ ${fmtRemaining(event.timeRemainingMs)} remaining` : 'Event not currently active'}</div>
          </div>
        </div>

        <div class="modal-section">
          <p style="color:var(--clr-text-secondary);font-size:var(--text-sm)">${event.description}</p>
        </div>

        ${effectsHtml ? `
        <div class="modal-section">
          <div class="modal-section-title">Bonuses Active</div>
          <div class="offline-rewards">${effectsHtml}</div>
        </div>` : ''}

        ${event.objectives.length > 0 ? `
        <div class="modal-section">
          <div class="modal-section-title">Objectives</div>
          ${objectivesHtml}
        </div>` : ''}

        ${rewardHtml ? `
        <div class="modal-section">
          <div class="modal-section-title">Completion Reward</div>
          <div class="offline-rewards">${rewardHtml}</div>
        </div>` : ''}

        <div class="modal-actions">
          ${event.canClaim
            ? `<button class="btn btn-primary" id="btn-event-modal-claim" data-id="${event.id}">${icon('gift')} Claim Reward</button>`
            : event.claimed
              ? `<button class="btn btn-ghost" disabled>${icon('check')} Reward Claimed</button>`
              : `<button class="btn btn-ghost" disabled>${event.objectives.length > 0 ? 'Complete Objectives to Claim' : 'Active — No objectives'}</button>`
          }
          <button class="btn btn-ghost modal-close">Close</button>
        </div>
      </div>`;

    openModal(html);

    // Wire the claim button (after DOM is injected by openModal)
    setTimeout(() => {
      document.getElementById('btn-event-modal-claim')?.addEventListener('click', e => {
        this._s.events.claimReward(e.currentTarget.dataset.id);
        closeModal();
      });
    }, 0);
  }
}
