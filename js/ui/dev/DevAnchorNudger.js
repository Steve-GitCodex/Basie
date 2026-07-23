/**
 * DevAnchorNudger.js
 * Dev-only floating widget (`?dev` sessions only): with Building mode on, drag the
 * selected building to set its ground anchor (ax/ay) and mouse-wheel to scale it,
 * live, then Copy a ready-to-paste `_anchor_overrides.json` entry. Replaces the
 * edit-JSON-and-rescreenshot loop for seating AI sprites on their plots (ADR 0024).
 *
 * Selection is shared: clicking a building emits `dev:buildingSelected`, which both
 * this widget and DevLevelSwitcher follow. The nudged sprite is the selected
 * building at its currently-rendered level. Reaches into `window.game.city`
 * internals — acceptable for dev tooling, same as the browser smokes.
 */
import { eventBus } from '../../core/EventBus.js';
import { BUILDINGS_CONFIG } from '../../entities/GAME_DATA.js';

const SCALE_STEP = 0.02;
const SCALE_FINE = 0.005;
const SCALE_MIN = 0.3;
const SCALE_MAX = 3;
const ANGLE_STEP = 1;    // degrees per wheel notch (rotate / skew)
const ANGLE_FINE = 0.25;
const ANGLE_MAX = 45;

export class DevAnchorNudger {
  init() {
    this._selectedId = null;
    this._editing = false;
    this._drag = null;
    this._el = this._buildEl();
    document.body.appendChild(this._el);
    this._readout = this._el.querySelector('[data-nudge-readout]');
    this._toggle = this._el.querySelector('[data-nudge-toggle]');

    this._toggle.addEventListener('change', () => this._setEditing(this._toggle.checked));
    this._el.querySelector('[data-nudge-copy]').addEventListener('click', () => this._copy());
    this._el.querySelector('[data-nudge-reset]').addEventListener('click', () => this._reset());

    eventBus.on('dev:buildingSelected', ({ buildingId }) => this._select(buildingId));
    this._onDown = (e) => this._down(e);
    this._onMove = (e) => this._move(e);
    this._onUp = () => this._up();
    this._onWheel = (e) => this._wheel(e);
    this._loop = () => this._frame();
    this._updateReadout();
  }

  _buildEl() {
    const el = document.createElement('div');
    el.className = 'dev-widget dev-anchor-nudger';
    el.innerHTML = `
      <strong>Dev: anchor nudge</strong>
      <label><input type="checkbox" data-nudge-toggle> Building mode</label>
      <span class="dev-nudge-hint">drag move · wheel scale · Alt rotate · Ctrl skew · Shift fine</span>
      <span data-nudge-readout></span>
      <span class="dev-nudge-btns">
        <button type="button" data-nudge-copy>Copy</button>
        <button type="button" data-nudge-reset>Reset</button>
      </span>
    `;
    return el;
  }

  _city() { return window.game?.city ?? null; }

  _slot() {
    const city = this._city();
    if (!city?._slots) return null;
    const id = this._selectedId
      ?? city._slots.find(s => s.buildingId === 'townhall' && s.level > 0)?.buildingId
      ?? city._slots.find(s => s.level > 0)?.buildingId;
    this._selectedId = id ?? this._selectedId;
    return city._slots.find(s => s.buildingId === this._selectedId && s.level > 0) ?? null;
  }

  _select(buildingId) {
    if (!buildingId) return;
    this._selectedId = buildingId;
    this._updateReadout();
  }

  _setEditing(on) {
    const city = this._city();
    const canvas = city?._canvas;
    if (on && !canvas) { this._toggle.checked = false; return; }
    this._editing = on;
    if (on) {
      canvas.addEventListener('pointerdown', this._onDown, true);
      window.addEventListener('pointermove', this._onMove, true);
      window.addEventListener('pointerup', this._onUp, true);
      canvas.addEventListener('wheel', this._onWheel, { capture: true, passive: false });
      this._raf = requestAnimationFrame(this._loop);
    } else {
      this._teardown();
    }
  }

  _teardown() {
    const canvas = this._city()?._canvas;
    canvas?.removeEventListener('pointerdown', this._onDown, true);
    window.removeEventListener('pointermove', this._onMove, true);
    window.removeEventListener('pointerup', this._onUp, true);
    canvas?.removeEventListener('wheel', this._onWheel, true);
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._drag = null;
    this._overlay?.remove();
    this._overlay = null;
  }

  _anchor() {
    const s = this._slot();
    return s ? this._city()._assets.anchor(s.buildingId, s.level) : null;
  }

  _spriteRect(slot) {
    const city = this._city();
    const box = city._spriteBox(slot);
    if (!box) return null;
    const cam = city._camera;
    const tl = cam.worldToScreen(box.left, box.top);
    const br = cam.worldToScreen(box.right, box.bottom);
    return { left: tl.x, top: tl.y, right: br.x, bottom: br.y };
  }

  _pointInSprite(clientX, clientY) {
    const city = this._city();
    const slot = this._slot();
    if (!slot) return false;
    const rect = city._canvas.getBoundingClientRect();
    const r = this._spriteRect(slot);
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  _down(e) {
    if (!this._pointInSprite(e.clientX, e.clientY)) return; // fall through → camera pan
    const a = this._anchor();
    if (!a) return;
    e.stopPropagation();
    e.preventDefault();
    this._drag = { x: e.clientX, y: e.clientY, ...a };
  }

  _move(e) {
    if (!this._drag) return;
    e.stopPropagation();
    const city = this._city();
    const slot = this._slot();
    const z = city._camera.zoom * this._drag.s;
    const ax = this._drag.ax - (e.clientX - this._drag.x) / z;
    const ay = this._drag.ay - (e.clientY - this._drag.y) / z;
    city._assets.setDevAnchor(slot.buildingId, slot.level, { ...this._drag, ax, ay });
    this._updateReadout();
  }

  _up() { this._drag = null; }

  // Plain wheel = scale; Alt+wheel = rotate (tilt in-plane); Ctrl+wheel = skew.
  _wheel(e) {
    if (!this._pointInSprite(e.clientX, e.clientY)) return; // fall through → camera zoom
    const slot = this._slot();
    const a = this._anchor();
    if (!slot || !a) return;
    e.stopPropagation();
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    const next = { ax: a.ax, ay: a.ay, s: a.s ?? 1, r: a.r ?? 0, k: a.k ?? 0 };
    if (e.altKey) {
      next.r = clampDeg(next.r + dir * (e.shiftKey ? ANGLE_FINE : ANGLE_STEP));
    } else if (e.ctrlKey) {
      next.k = clampDeg(next.k + dir * (e.shiftKey ? ANGLE_FINE : ANGLE_STEP));
    } else {
      const step = e.shiftKey ? SCALE_FINE : SCALE_STEP;
      next.s = Math.max(SCALE_MIN, Math.min(SCALE_MAX, next.s * (dir > 0 ? 1 + step : 1 - step)));
    }
    this._city()._assets.setDevAnchor(slot.buildingId, slot.level, next);
    this._updateReadout();
  }

  _frame() {
    if (!this._editing) return;
    this._drawOverlay();
    this._raf = requestAnimationFrame(this._loop);
  }

  _drawOverlay() {
    const city = this._city();
    const slot = this._slot();
    const canvas = city?._canvas;
    if (!canvas || !slot) return;
    const rect = canvas.getBoundingClientRect();
    let ov = this._overlay;
    if (!ov) {
      ov = this._overlay = document.createElement('canvas');
      ov.className = 'dev-nudge-overlay';
      document.body.appendChild(ov);
    }
    ov.style.left = `${rect.left}px`;
    ov.style.top = `${rect.top}px`;
    ov.width = Math.round(rect.width);
    ov.height = Math.round(rect.height);
    const g = ov.getContext('2d');
    g.clearRect(0, 0, ov.width, ov.height);
    const cam = city._camera;
    const k = city._cornersWorld(slot);
    const p = (w) => cam.worldToScreen(w.x, w.y);
    const n = p(k.n), ee = p(k.e), s = p(k.s), ww = p(k.w);
    g.strokeStyle = 'rgba(0,230,255,0.9)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(n.x, n.y); g.lineTo(ee.x, ee.y); g.lineTo(s.x, s.y); g.lineTo(ww.x, ww.y); g.closePath();
    g.stroke();
    const c = p(city._centerWorld(slot));
    g.fillStyle = '#00ff66';
    g.beginPath(); g.arc(c.x, c.y, 5, 0, 7); g.fill();
  }

  _updateReadout() {
    const slot = this._slot();
    const a = this._anchor();
    if (!slot || !a) { this._readout.textContent = 'select a building'; return; }
    const name = BUILDINGS_CONFIG[slot.buildingId]?.name ?? slot.buildingId;
    const soft = (a.s ?? 1) > 1.1 ? ' ⚠ raster upscale' : '';
    this._readout.textContent =
      `${name} Lv.${slot.level}  ax ${a.ax.toFixed(1)}  ay ${a.ay.toFixed(1)}  ` +
      `s ${(a.s ?? 1).toFixed(3)}  r ${(a.r ?? 0).toFixed(2)}°  k ${(a.k ?? 0).toFixed(2)}°${soft}`;
  }

  _copy() {
    const city = this._city();
    const slot = this._slot();
    const a = this._anchor();
    if (!slot || !a) return;
    const file = city._assets.variantFile(slot.buildingId, slot.level);
    const parts = [`"ax": ${round(a.ax)}`, `"ay": ${round(a.ay)}`];
    if (Math.abs((a.s ?? 1) - 1) >= 1e-3) parts.push(`"s": ${round(a.s)}`);
    if (Math.abs(a.r ?? 0) >= 0.05) parts.push(`"r": ${round(a.r)}`);
    if (Math.abs(a.k ?? 0) >= 0.05) parts.push(`"k": ${round(a.k)}`);
    const entry = `"${file}": { ${parts.join(', ')} }`;
    navigator.clipboard?.writeText(entry);
    this._readout.textContent = `copied: ${entry}`;
  }

  _reset() {
    const slot = this._slot();
    if (!slot) return;
    this._city()._assets.clearDevAnchor(slot.buildingId, slot.level);
    this._updateReadout();
  }
}

function round(n) { return Math.round(n * 10) / 10; }
function clampDeg(d) { return Math.max(-ANGLE_MAX, Math.min(ANGLE_MAX, Math.round(d * 100) / 100)); }
