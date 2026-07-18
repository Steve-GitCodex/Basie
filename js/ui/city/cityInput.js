/**
 * cityInput.js
 * Pointer/gesture handling for the base city view: pan, pinch-zoom, wheel-zoom,
 * tap (with speed-up-badge priority), double-tap-to-home, and hover tracking.
 * Owns the transient pointer/drag bookkeeping only — scene picking, hover state,
 * and click dispatch stay on CityRenderer (they share its draw geometry).
 *
 * Collaborator of CityRenderer — holds a back-reference for camera, canvas, and
 * the picking/dispatch methods.
 */

const TAP_SLOP_PX = 6;
const TAP_MAX_MS = 500;

export class CityInput {
  constructor(renderer) {
    this._r = renderer;
    this._pointers = new Map();
    this._drag = null;
  }

  bind() {
    const r = this._r;
    const cv = r._canvas;
    const cam = r._camera;

    cv.addEventListener("pointerdown", (e) => {
      cv.setPointerCapture(e.pointerId);
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._pointers.size === 1) {
        this._drag = {
          x: e.clientX,
          y: e.clientY,
          startX: e.clientX,
          startY: e.clientY,
          t: performance.now(),
          moved: false,
        };
      }
    });

    cv.addEventListener("pointermove", (e) => {
      const p = this._pointers.get(e.pointerId);
      if (!p) {
        r._updateHover(e);
        return;
      }
      const prev = { ...p };
      p.x = e.clientX;
      p.y = e.clientY;

      if (this._pointers.size === 2) {
        // Pinch: zoom around midpoint + pan by midpoint delta
        const pts = [...this._pointers.values()];
        const other = pts.find((q) => q !== p) ?? pts[0];
        const dPrev = Math.hypot(prev.x - other.x, prev.y - other.y);
        const dNow = Math.hypot(p.x - other.x, p.y - other.y);
        const rect = cv.getBoundingClientRect();
        const mid = {
          x: (p.x + other.x) / 2 - rect.left,
          y: (p.y + other.y) / 2 - rect.top,
        };
        if (dPrev > 0) cam.zoomAt(mid.x, mid.y, dNow / dPrev);
        cam.panBy((p.x - prev.x) / 2, (p.y - prev.y) / 2);
        if (this._drag) this._drag.moved = true;
      } else if (this._drag) {
        const dx = e.clientX - this._drag.x;
        const dy = e.clientY - this._drag.y;
        this._drag.x = e.clientX;
        this._drag.y = e.clientY;
        if (
          Math.hypot(
            e.clientX - this._drag.startX,
            e.clientY - this._drag.startY,
          ) > TAP_SLOP_PX
        ) {
          this._drag.moved = true;
          cv.style.cursor = "grabbing";
          r._setHover(null);
        }
        if (this._drag.moved) cam.panBy(dx, dy);
      }
    });

    const endPointer = (e) => {
      const wasDrag = this._drag;
      this._pointers.delete(e.pointerId);
      if (this._pointers.size > 0) return;
      cv.style.cursor = "grab";
      this._drag = null;
      if (
        wasDrag &&
        !wasDrag.moved &&
        performance.now() - wasDrag.t < TAP_MAX_MS
      ) {
        // The ⏩ speed-up badge sits above a constructing building and wins the tap.
        const badge = r._speedupBadgeAtClient(e.clientX, e.clientY);
        if (badge) {
          r._onSpeedupClick(badge.buildingId, badge.instanceIndex, r._speedupBadgeRect(badge));
          return;
        }
        const slot = r._slotAtClient(e.clientX, e.clientY);
        if (!slot) r._onEmptyClick();
        else if (slot.empty) r._onPlotClick(slot.plotId, slot.zone);
        else { r.popTile(slot); r._onTileClick(slot.buildingId, slot.instanceIndex); }
      }
    };
    cv.addEventListener("pointerup", endPointer);
    cv.addEventListener("pointercancel", endPointer);
    cv.addEventListener("pointerleave", () => {
      if (!this._drag) r._setHover(null);
    });

    cv.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const rect = cv.getBoundingClientRect();
        cam.zoomAt(
          e.clientX - rect.left,
          e.clientY - rect.top,
          e.deltaY < 0 ? 1.1 : 0.9,
        );
      },
      { passive: false },
    );

    // Double-tap empty ground re-centers on HQ
    let lastTap = 0;
    cv.addEventListener("pointerup", (e) => {
      const now = performance.now();
      if (now - lastTap < 350 && !r._slotAtClient(e.clientX, e.clientY))
        r.home();
      lastTap = now;
    });
  }
}
