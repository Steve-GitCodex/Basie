/**
 * numberTicker.js
 * Animate a DOM element's numeric text toward a target over ~320ms (C3 DOM juice).
 * State is kept per-element in a WeakMap so a new target mid-flight retargets the
 * running animation instead of stacking. Patches textContent in place — never a
 * rebuild (memory reactive-ui-no-tick-rebuild).
 */
const anims = new WeakMap();
const DURATION = 320;

function reduceMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function tickTo(el, target, format = String) {
  if (!el) return;
  if (typeof target !== 'number' || !isFinite(target)) { el.textContent = format(target); return; }

  const prev = anims.get(el);
  if (!prev) { el.textContent = format(target); anims.set(el, { current: target, raf: 0 }); return; }

  cancelAnimationFrame(prev.raf);
  const from = prev.current;
  if (from === target || reduceMotion()) {
    el.textContent = format(target);
    anims.set(el, { current: target, raf: 0 });
    return;
  }

  const start = performance.now();
  const state = { current: from, raf: 0 };
  const step = (now) => {
    const t = Math.min(1, (now - start) / DURATION);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = from + (target - from) * eased;
    state.current = val;
    el.textContent = format(Math.round(val));
    if (t < 1) { state.raf = requestAnimationFrame(step); }
    else { state.current = target; el.textContent = format(target); }
  };
  state.raf = requestAnimationFrame(step);
  anims.set(el, state);
}
