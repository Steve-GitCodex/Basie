/**
 * SpeedupPicker.js
 * Shared, self-positioning speed-up popover used by the build-queue sidebar and the
 * isometric city (tap the ⏩ badge on a building under construction). It lists the
 * player's owned speed-up items for a given queue type and applies the chosen one.
 *
 * Body-appended + `position: fixed`, anchored to a captured viewport rect, so it floats
 * above everything and survives re-renders of whatever opened it. Only one is open at a
 * time. Visual style lives in css/components/inventory.css (`.speedup-picker`).
 */
import { eventBus } from '../../core/EventBus.js';

let _close = null;   // close fn of the currently-open picker, if any

/** Close any open speed-up picker. */
export function closeSpeedupPicker() { _close?.(); }

/**
 * @param {{
 *   anchorRect: {left:number,top:number,width:number,height:number,bottom:number},
 *   queueType: string, secsLeft: number,
 *   inventory: any, notifications?: any,
 *   onClose?: () => void
 * }} opts
 */
export function openSpeedupPicker({ anchorRect, queueType, secsLeft, inventory, notifications, onClose }) {
  closeSpeedupPicker();
  if (!inventory || !anchorRect) return;

  const owned = inventory.getOwnedItems().filter(i =>
    i.type === 'speed_boost' && (i.target === queueType || i.target === 'any')
  );

  const picker = document.createElement('div');
  picker.className = 'speedup-picker speedup-picker--floating';

  if (owned.length === 0) {
    picker.innerHTML = `
      <div class="speedup-picker-title">⏩ Speed Up</div>
      <div class="speedup-picker-empty">
        <span>No speedups available.</span>
        <button class="btn btn-xs btn-primary speedup-goto-shop">🛒 Buy from Shop</button>
      </div>`;
    picker.querySelector('.speedup-goto-shop')?.addEventListener('click', () => {
      close();
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
        const itemId = btn.dataset.item;
        close();
        const r = inventory.useItem(itemId, { queueType });
        if (!r.success) {
          notifications?.show('warning', 'Cannot Speed Up', r.reason);
        } else {
          const remaining = r.completed ? 'Done!' : `${Math.ceil((r.remaining ?? 0) / 1000)}s left`;
          notifications?.show('success', '⏩ Sped Up!', remaining);
        }
      });
    });
  }

  document.body.appendChild(picker);
  _positionPicker(picker, anchorRect);

  // Teardown: outside-click, Escape, resize/scroll, or programmatic close.
  const onDoc = (e) => { if (!picker.contains(e.target)) close(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    if (_close !== close) return;          // already closed
    picker.remove();
    document.removeEventListener('pointerdown', onDoc, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', close);
    _close = null;
    onClose?.();
  }
  setTimeout(() => {
    document.addEventListener('pointerdown', onDoc, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', close);
  }, 0);
  _close = close;
  return close;
}

/** Place the picker just below the anchor, flipping above / clamping to stay on-screen. */
function _positionPicker(picker, rect) {
  const W = picker.offsetWidth, H = picker.offsetHeight;
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = rect.left + rect.width / 2 - W / 2;
  left = Math.max(8, Math.min(left, vw - W - 8));
  let top = (rect.bottom ?? rect.top + rect.height) + 8;
  if (top + H > vh - 8) top = Math.max(8, rect.top - H - 8);   // flip above the anchor
  picker.style.position = 'fixed';
  picker.style.left  = `${left}px`;
  picker.style.top   = `${top}px`;
  picker.style.right = 'auto';
  picker.style.margin = '0';
}
