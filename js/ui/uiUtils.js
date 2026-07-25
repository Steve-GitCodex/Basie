/**
 * uiUtils.js
 * Shared display constants and utilities used across all UI controllers.
 */

import { icon } from './icons.js';

export const TIER_CSS_SUFFIX = { normal: 'common', epic: 'rare', legendary: 'legendary' };

export const RES_META = {
  wood:    { icon: icon('wood'),                  label: 'Wood'    },
  stone:   { icon: icon('stone'),                 label: 'Stone'   },
  iron:    { icon: icon('iron'),                  label: 'Iron'    },
  food:    { icon: icon('food'),                  label: 'Food'    },
  water:   { icon: icon('water'),                 label: 'Water'   },
  diamond: { icon: icon('diamond', 'icon--glow'), label: 'Diamond' },
  money:   { icon: icon('money'),                 label: 'Money'   },
  xp:      { icon: icon('xp', 'icon--glow'),      label: 'XP'      },
};

/**
 * Format a number with K/M abbreviations.
 * @param {number} n
 * @returns {string}
 */
export function fmt(n) {
  n = Math.floor(n);
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000)    return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

// Queue for modals that arrive while one is already open
const _modalQueue = [];

/**
 * Populate and show the shared modal overlay.
 * If a modal is already visible the new one is queued and shown after the
 * current one closes, preventing any modal from being silently overwritten.
 * @param {string} html
 * @param {Function} onClose - called when the modal is closed
 */
export function openModal(html, onClose = () => {}) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  if (!overlay || !content) return;
  // Another modal is visible — queue this one instead of overwriting
  if (!overlay.classList.contains('hidden')) {
    _modalQueue.push({ html, onClose });
    return;
  }
  content.innerHTML = html;
  overlay.classList.remove('hidden');
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(onClose); }, { once: true });
  content.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => closeModal(onClose)));
}

/**
 * Hide the shared modal overlay and clear its contents.
 * After closing, opens the next queued modal (if any) with a brief delay.
 * @param {Function} onClose
 */
export function closeModal(onClose = () => {}) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  if (overlay) overlay.classList.add('hidden');
  if (content) content.innerHTML = '';
  onClose();
  if (_modalQueue.length > 0) {
    const next = _modalQueue.shift();
    setTimeout(() => openModal(next.html, next.onClose), 100);
  }
}
