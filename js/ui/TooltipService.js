/**
 * TooltipService.js
 * Provides a JS-driven floating tooltip panel for any element that carries a
 * [data-tooltip] or [data-tooltip-html] attribute.  A single `#game-tooltip`
 * element is appended to <body> and repositioned on each mouseover.
 *
 * Usage:
 *   Plain text : <button data-tooltip="Requires Town Hall Lv.3">...</button>
 *   Rich HTML  : <div data-tooltip-html="<strong>…</strong>">…</div>
 *               (set via el.dataset.tooltipHtml = '…' in JS)
 *
 * Imported and initialised once in main.js.
 */
export class TooltipService {
  constructor() {
    this._el = null;
    this._pointerType = 'mouse';
  }

  init() {
    // Create the singleton tooltip DOM element
    const el = document.createElement('div');
    el.id = 'game-tooltip';
    document.body.appendChild(el);
    this._el = el;

    // Use event delegation on the document so dynamically-created elements
    // with [data-tooltip] or [data-tooltip-html] are handled without re-registering listeners.
    document.addEventListener('pointerdown', e => { this._pointerType = e.pointerType; }, true);
    document.addEventListener('pointerover', e => { this._pointerType = e.pointerType; }, true);

    document.addEventListener('mouseover', e => {
      const target = e.target.closest('[data-tooltip], [data-tooltip-html]');
      if (!target) return;
      if (target.hasAttribute('data-tooltip-mouse-only') && this._pointerType !== 'mouse') return;
      if (target.getAttribute('aria-expanded') === 'true') { this._hide(); return; }
      const isHtml = 'tooltipHtml' in target.dataset;
      const text   = isHtml ? target.dataset.tooltipHtml : target.dataset.tooltip;
      if (!text) return;
      this._show(text, target, isHtml);
    });

    document.addEventListener('mouseleave', e => {
      // Only hide when leaving an element that has a tooltip
      if (e.target.closest?.('[data-tooltip], [data-tooltip-html]')) this._hide();
    }, true /* capture so it fires before 'mouseover' on children */);

    document.addEventListener('mouseover', e => {
      // Hide when moving to an element that does NOT have a tooltip
      if (!e.target.closest('[data-tooltip], [data-tooltip-html]')) this._hide();
    });
  }

  /**
   * Position and reveal the tooltip panel near the target element.
   * @param {string}  text   — plain text or HTML string
   * @param {Element} target — triggering element
   * @param {boolean} isHtml — when true, content is rendered as innerHTML
   */
  _show(text, target, isHtml = false) {
    const el = this._el;
    if (isHtml) {
      el.innerHTML = text;
    } else {
      el.textContent = text;
    }
    el.classList.remove('visible', 'flip');
    el.style.left = '-9999px'; el.style.top = '-9999px';

    // Temporarily make visible (but transparent) to measure size
    el.style.opacity = '0';
    el.style.display = 'block';

    const targetRect  = target.getBoundingClientRect();
    const tipW  = el.offsetWidth;
    const tipH  = el.offsetHeight;
    const gap   = 10; // px between tooltip edge and target

    // Try above first; flip below if no room
    let top  = targetRect.top - tipH - gap;
    let flip = false;
    if (top < 8) { top = targetRect.bottom + gap; flip = true; }
    if (flip) el.classList.add('flip');

    // Clamp horizontal so it never overflows the viewport
    let left = targetRect.left + targetRect.width / 2 - tipW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));

    el.style.left = `${left}px`;
    el.style.top  = `${top}px`;
    el.style.removeProperty('opacity');

    // Trigger transition
    requestAnimationFrame(() => {
      if (target.getAttribute('aria-expanded') !== 'true') el.classList.add('visible');
    });
  }

  _hide() {
    this._el?.classList.remove('visible');
  }

  /**
   * Programmatically show the tooltip at an arbitrary screen position.
   * Useful for the future tutorial system.
   * @param {string} text
   * @param {number} x  — pixels from left of viewport
   * @param {number} y  — pixels from top of viewport
   */
  showAt(text, x, y) {
    const el = this._el;
    if (!el) return;
    el.textContent = text;
    el.classList.remove('visible', 'flip');
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    requestAnimationFrame(() => el.classList.add('visible'));
  }

  hide() { this._hide(); }
}
