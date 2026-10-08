/**
 * TimerService.js
 * Single source of truth for all live progress-bar and countdown updates.
 *
 * Any element that has both `data-timer-start` and `data-timer-end` attributes
 * will be picked up on every `tick:ui` event (fired ~once per second by the
 * GameEngine via its RAF loop).  No raw setInterval is used anywhere.
 *
 * Usage in templates:
 *   <div class="progress-container" data-timer-start="<startMs>" data-timer-end="<endMs>">
 *     <div class="progress-label">
 *       <span>Label</span>
 *       <span class="progress-time-label"></span>   ← filled by TimerService
 *     </div>
 *     <div class="progress-bar">
 *       <div class="progress-fill ..."></div>        ← width filled by TimerService
 *     </div>
 *   </div>
 */
import { eventBus } from '../core/EventBus.js';
import { formatRemaining } from './buffs/buffText.js';

export class TimerService {
  init() {
    eventBus.on('tick:ui', () => this._tick());
  }

  _tick() {
    const now = Date.now();
    document.querySelectorAll('[data-timer-start][data-timer-end]').forEach(el => {
      const start = +el.dataset.timerStart;
      const end   = +el.dataset.timerEnd;
      const span  = end - start;

      const pct = span > 0
        ? Math.max(0, Math.min(100, ((now - start) / span) * 100))
        : (now >= end ? 100 : 0);

      el.querySelector('.progress-fill')?.style.setProperty('width', `${pct}%`);

      const lbl = el.querySelector('.progress-time-label');
      if (lbl) lbl.textContent = el.dataset.timerFormat === 'duration'
        ? formatRemaining(end - now)
        : `${Math.max(0, Math.ceil((end - now) / 1000))}s`;
    });
  }
}
