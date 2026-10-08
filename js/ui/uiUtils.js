/**
 * uiUtils.js
 * Shared display constants and utilities used across all UI controllers.
 */

import { icon } from './icons.js';

export const TIER_CSS_SUFFIX = { normal: 'common', epic: 'rare', legendary: 'legendary' };

const HTML_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => HTML_ESCAPE_MAP[ch]);
}

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

const _modalQueue = [];
let _activeModal = null;

function _modalEls() {
  return { overlay: document.getElementById('modal-overlay'), content: document.getElementById('modal-content') };
}

function _showModal({ overlay, content }, html, onClose, onShown, escapable = false) {
  content.innerHTML = html;
  overlay.classList.remove('hidden');
  const onBackdrop = e => { if (e.target === overlay) closeModal(onClose); };
  const onKey = e => { if (e.key === 'Escape' && !e.defaultPrevented) closeModal(onClose); };
  overlay.addEventListener('click', onBackdrop);
  if (escapable) document.addEventListener('keydown', onKey);
  _activeModal = { onClose, onBackdrop, onKey };
  content.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => closeModal(onClose)));
  onShown();
}

function _hideModal({ overlay, content }) {
  if (_activeModal) {
    overlay?.removeEventListener('click', _activeModal.onBackdrop);
    document.removeEventListener('keydown', _activeModal.onKey);
  }
  _activeModal = null;
  overlay?.classList.add('hidden');
  if (content) content.innerHTML = '';
}

/**
 * Populate and show the shared modal overlay.
 * If a modal is already visible the new one is queued and shown after the
 * current one closes, preventing any modal from being silently overwritten.
 * @param {string} html
 * @param {Function} onClose - called when the modal is closed
 */
export function openModal(html, onClose = () => {}, onShown = () => {}) {
  const els = _modalEls();
  if (!els.overlay || !els.content) return;
  if (!els.overlay.classList.contains('hidden')) {
    _modalQueue.push({ html, onClose, onShown });
    return;
  }
  _showModal(els, html, onClose, onShown);
}

/**
 * Player-initiated panels (dock buttons): replace the visible modal instead of queueing behind it.
 * The replaced modal's onClose runs; queued modals stay queued.
 */
export function swapModal(html, onClose = () => {}, onShown = () => {}) {
  const els = _modalEls();
  if (!els.overlay || !els.content) return;
  if (!els.overlay.classList.contains('hidden')) {
    const replaced = _activeModal;
    _hideModal(els);
    replaced?.onClose();
  }
  _showModal(els, html, onClose, onShown, true);
}

/**
 * Hide the shared modal overlay and clear its contents.
 * After closing, opens the next queued modal (if any) with a brief delay.
 * @param {Function} onClose
 */
export function closeModal(onClose = () => {}) {
  _hideModal(_modalEls());
  onClose();
  if (_modalQueue.length > 0) {
    const next = _modalQueue.shift();
    setTimeout(() => openModal(next.html, next.onClose, next.onShown), 100);
  }
}
