/**
 * ui/world/worldProjection.js
 * Pure top-down map math. World units == map px (data/worldMap.js coordinates);
 * screen = world · zoom + offset. No DOM, no state.
 *
 * (Top-down, so world↔screen is a plain scale+translate — no iso diamond math.
 * Camera offset/zoom are owned by WorldCamera; these helpers are stateless and
 * take them as arguments where needed.)
 */

/** Squared distance — cheap for nearest-POI picking. */
function dist2(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy;
}

/**
 * Nearest POI to a world point within `radius` world px, or null.
 * @param {number} wx @param {number} wy
 * @param {Array<{id,x,y}>} pois
 * @param {number} radius
 */
export function hitTestPOI(wx, wy, pois, radius) {
  const r2 = radius * radius;
  let best = null, bestD = r2;
  for (const p of pois) {
    const d = dist2(wx, wy, p.x, p.y);
    if (d <= bestD) { bestD = d; best = p; }
  }
  return best;
}

/**
 * Region whose circle contains a world point, or null (smallest-radius wins so
 * nested regions resolve to the most specific).
 * @param {Array<{id,center:{x,y},radius}>} regions
 */
export function hitTestRegion(wx, wy, regions) {
  let best = null, bestR = Infinity;
  for (const r of regions) {
    if (dist2(wx, wy, r.center.x, r.center.y) <= r.radius * r.radius && r.radius < bestR) {
      best = r; bestR = r.radius;
    }
  }
  return best;
}

/**
 * Point along a quadratic arc between two world points (for march tokens/curves).
 * The control point bows perpendicular to the line by `bow` fraction of its length.
 * @returns {{x,y}}
 */
export function arcPoint(ax, ay, bx, by, t, bow = 0.18) {
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  // perpendicular offset for the control point
  const cx = mx + (-dy / len) * len * bow;
  const cy = my + (dx / len) * len * bow;
  const it = 1 - t;
  return {
    x: it * it * ax + 2 * it * t * cx + t * t * bx,
    y: it * it * ay + 2 * it * t * cy + t * t * by,
  };
}
