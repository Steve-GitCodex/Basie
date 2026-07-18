/**
 * NotificationManager.js
 * Listens to the EventBus and spawns "toast" pop-up notifications.
 * Handles queuing (one toast shown at a time), hover-pause of dismiss timers, and CSS animation.
 */
import { eventBus } from '../core/EventBus.js';

const TOAST_DURATION_MS = 4000;
const MAX_VISIBLE       = 1;
const ICONS = {
  success: '✅',
  warning: '⚠️',
  error:   '❌',
  info:    'ℹ️',
  combat:  '⚔️',
};

export class NotificationManager {
  constructor() {
    this.name       = 'NotificationManager';
    this._container = document.getElementById('notification-container');
    /** @type {Array<{type:string, title:string, message:string}>} */
    this._queue     = [];
    /**
     * Active toasts currently visible.
     * Maps toast element → { timerId, remaining, startedAt }
     * @type {Map<HTMLElement, {timerId:ReturnType<typeof setTimeout>|null, remaining:number, startedAt:number}>}
     */
    this._active    = new Map();
    this._registerEvents();
  }

  _registerEvents() {
    // Building events
    eventBus.on('building:completed',  d => this.show('success', 'Construction Complete!', `${d.building?.name ?? d.id} is ready.`));
    eventBus.on('building:started',    d => this.show('info',    'Building Started',       `Upgrading to Level ${d.level}.`));
    // Unit events
    eventBus.on('unit:trained',        d => this.show('success', 'Training Complete!',     `${d.count}x unit(s) ready.`));
    // Combat events
    eventBus.on('combat:victory',      () => this.show('combat', '⚔️ Victory!',            'You defeated the enemy. Loot collected!'));
    eventBus.on('combat:defeat',       () => this.show('error',  '💀 Defeated',            'Your forces were overpowered.'));
    // Tech events
    eventBus.on('tech:researched',     d => this.show('success', 'Research Complete!',     `${d.name} — Lv.${d.level ?? 1} complete!`));
    // Quest events
    eventBus.on('quest:completed',     d => this.show('success', '📜 Quest Complete!',     `"${d.name}" — Rewards collected!`));
    // Silent events
    eventBus.on('resources:spent',     () => {/* silent */});
    eventBus.on('game:saved',          () => {/* silent */});
  }

  /**
   * Enqueue a toast notification.
   * @param {'success'|'warning'|'error'|'info'|'combat'} type
   * @param {string} title
   * @param {string} message
   */
  show(type, title, message) {
    this._queue.push({ type, title, message });
    this._flush();
  }

  /**
   * Dequeue pending items into the visible set while below MAX_VISIBLE.
   * @private
   */
  _flush() {
    while (this._active.size < MAX_VISIBLE && this._queue.length > 0) {
      this._renderToast(this._queue.shift());
    }
  }

  /**
   * Create and display a toast for one queued item.
   * @private
   */
  _renderToast({ type, title, message }) {
    const toast     = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${ICONS[type] ?? 'ℹ️'}</span>
      <div class="toast-body">
        <p class="toast-title">${title}</p>
        <p class="toast-message">${message}</p>
      </div>
    `;

    this._container.appendChild(toast);

    const entry = { timerId: null, remaining: TOAST_DURATION_MS, startedAt: 0 };
    this._active.set(toast, entry);
    this._scheduleDismiss(toast);
  }

  /**
   * (Re-)arm the auto-dismiss timer for a toast using the stored remaining time.
   * @private
   */
  _scheduleDismiss(toast) {
    const entry = this._active.get(toast);
    if (!entry) return;
    entry.startedAt = Date.now();
    entry.timerId   = setTimeout(() => this._dismiss(toast), entry.remaining);
  }

  /**
   * Dismiss one toast: play exit animation, remove from DOM, pull next from queue.
   * @private
   */
  _dismiss(toast) {
    const entry = this._active.get(toast);
    if (entry?.timerId) clearTimeout(entry.timerId);
    this._active.delete(toast);

    toast.classList.add('removing');
    toast.addEventListener('animationend', () => {
      toast.remove();
      this._flush(); // pull next queued item if any
    }, { once: true });
  }

  /**
   * Pause all dismiss timers (called on mouseenter of the notification container).
   */
  startHoverPause() {
    for (const [, entry] of this._active) {
      if (entry.timerId !== null) {
        entry.remaining -= Date.now() - entry.startedAt;
        entry.remaining  = Math.max(0, entry.remaining);
        clearTimeout(entry.timerId);
        entry.timerId = null;
      }
    }
  }

  /**
   * Resume all paused timers (called on mouseleave of the notification container).
   */
  endHoverPause() {
    for (const [toast, entry] of this._active) {
      if (entry.timerId === null) {
        this._scheduleDismiss(toast);
      }
    }
  }

  update(dt) { /* No tick needed */ }
}
