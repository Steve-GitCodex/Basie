/**
 * resourceFlyout.js
 * On a discrete resources:added reward (march haul, quest, mail, collection), fly a
 * small resource coin from mid-screen into its HUD chip, then pulse the chip (C3 DOM
 * juice). Passive production goes through resources:tick, not add(), so this only
 * fires on rewards. No state, no rebuilds.
 */
import { eventBus } from '../../core/EventBus.js';

const MAX_LIVE = 24;
const FLIGHT_MS = 900;

export class ResourceFlyout {
  constructor() {
    this._live = 0;
    eventBus.on('resources:added', r => this._onAdded(r));
  }

  _onAdded(rewards) {
    if (!rewards || document.hidden) return;
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let i = 0;
    for (const [key, amt] of Object.entries(rewards)) {
      if (key === 'xp' || !(amt > 0)) continue;
      const chip = document.getElementById(`res-${key}`);
      if (!chip) continue;
      setTimeout(() => this._fly(key, chip), (i++) * 70);
    }
  }

  _fly(key, chip) {
    if (this._live >= MAX_LIVE) return;
    const rect = chip.getBoundingClientRect();
    if (rect.width === 0) return;
    const tx = rect.left + rect.width * 0.22;
    const ty = rect.top + rect.height / 2;
    const ox = window.innerWidth / 2 + (Math.random() * 80 - 40);
    const oy = window.innerHeight * 0.55 + (Math.random() * 40 - 20);

    const fly = document.createElement('span');
    fly.className = `res-fly res-icon res-icon--${key}`;
    fly.style.left = `${ox}px`;
    fly.style.top = `${oy}px`;
    document.body.appendChild(fly);
    this._live++;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      fly.style.transform = `translate(${tx - ox}px, ${ty - oy}px) scale(0.45)`;
      fly.style.opacity = '0.15';
    }));

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      fly.remove();
      this._live--;
      this._bump(chip);
    };
    fly.addEventListener('transitionend', done, { once: true });
    setTimeout(done, FLIGHT_MS);
  }

  _bump(chip) {
    const val = chip.querySelector('.res-value');
    if (!val) return;
    val.classList.remove('tick-flash');
    void val.offsetWidth;
    val.classList.add('tick-flash');
    val.addEventListener('animationend', () => val.classList.remove('tick-flash'), { once: true });
  }
}
