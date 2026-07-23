/**
 * cityAgents.js
 * Ambient life for the base city view: the survey drone and pedestrians that
 * wander the auto-derived road web (ADR 0022, Phase B — roads come from
 * cityRoads, not the retired blueprint). Owns their motion state and draws them;
 * depth ordering is done by CityRenderer, which interleaves these with buildings.
 *
 * Positions are kept in tile coords (cell/2) so the renderer's tileToWorld +
 * depth sort work unchanged. `setRoads` rebuilds the graph on any layout change.
 *
 * Collaborator of CityRenderer — holds a back-reference for canvas context only.
 */
import { tileToWorld } from "./isoMath.js";
import { roadGraph } from "./cityRoads.js";

const DRONE_SPEED = 1.1; // tiles per second
const WALKER_SPEED = 0.45; // tiles per second
const WALKER_COUNT = 3;
const DRONE_LIFT = 34;
const WALKER_PX = 16;
const DRONE_PX = 18;
const TRUCK_PX = 22;

function toTile(cellKey) {
  const [cx, cy] = cellKey.split(",").map(Number);
  return { col: cx / 2, row: cy / 2 };
}

export function pickDockKey(keys) {
  if (!keys.length) return null;
  return keys.reduce((best, k) => {
    const [x, y] = k.split(',').map(Number);
    const [bx, by] = best.split(',').map(Number);
    const s = x + y, bs = bx + by;
    return s < bs || (s === bs && k < best) ? k : best;
  });
}

export function bfsFarthest(graph, fromKey) {
  const dist = new Map([[fromKey, 0]]);
  const q = [fromKey];
  let far = fromKey;
  for (let i = 0; i < q.length; i++) {
    const k = q[i];
    for (const { cx, cy } of graph.get(k) ?? []) {
      const nk = `${cx},${cy}`;
      if (dist.has(nk)) continue;
      dist.set(nk, dist.get(k) + 1);
      const d = dist.get(nk);
      if (d > dist.get(far) || (d === dist.get(far) && nk < far)) far = nk;
      q.push(nk);
    }
  }
  return far;
}

export function bfsPath(graph, fromKey, toKey) {
  if (fromKey === toKey) return [fromKey];
  const prev = new Map([[fromKey, null]]);
  const q = [fromKey];
  for (let i = 0; i < q.length; i++) {
    const k = q[i];
    if (k === toKey) break;
    for (const { cx, cy } of graph.get(k) ?? []) {
      const nk = `${cx},${cy}`;
      if (prev.has(nk)) continue;
      prev.set(nk, k);
      q.push(nk);
    }
  }
  if (!prev.has(toKey)) return [fromKey];
  const path = [];
  for (let k = toKey; k != null; k = prev.get(k)) path.push(k);
  return path.reverse();
}

export function faceLeft(from, to) {
  return (to.col - from.col) - (to.row - from.row) < 0;
}

export function pingPong(t, span) {
  if (span <= 0) return 0;
  const m = span * 2;
  const r = ((t % m) + m) % m;
  return r <= span ? r : m - r;
}

export class CityAgents {
  constructor(renderer) {
    this._r = renderer;
    this._graph = new Map();
    this._keys = [];
    this._dronePath = [];
    this._droneT = 0;
    this._walkers = [];
    this._dockKey = null;
    this._assets = null;
  }

  setAssets(assets) { this._assets = assets; }

  /** Rebuild the road graph + drone path + walkers from the derived road-cell set. */
  setRoads(roadCells) {
    this._graph = roadGraph(roadCells);
    this._keys = [...this._graph.keys()];
    this._dockKey = pickDockKey(this._keys);
    const far = this._dockKey ? bfsFarthest(this._graph, this._dockKey) : null;
    this._dronePath = (this._dockKey && far)
      ? bfsPath(this._graph, this._dockKey, far).map(toTile)
      : [];
    this._droneT = 0;
    this._spawnWalkers();
  }

  _spawnWalkers() {
    this._walkers = [];
    if (!this._keys.length) return;
    for (let i = 0; i < WALKER_COUNT; i++) {
      const k = this._keys[(i * 13) % this._keys.length];
      const from = toTile(k);
      this._walkers.push({
        cell: k, prev: null, from, to: from, t: 1,
        x: from.col, y: from.row, hue: 180 + i * 60,
        sprite: i, faceLeft: false,
      });
    }
  }

  update(dt) {
    this._droneT += dt * DRONE_SPEED;
    const span = this._dronePath.length - 1;
    if (span > 0) this._droneT %= span * 2;
    for (const w of this._walkers) {
      w.t += dt * WALKER_SPEED;
      if (w.t >= 1) {
        const next = this._nextRoadCell(w.cell, w.prev);
        w.prev = w.cell;
        w.cell = next;
        w.from = w.to;
        w.to = toTile(next);
        w.faceLeft = faceLeft(w.from, w.to);
        w.t = 0;
      }
      w.x = w.from.col + (w.to.col - w.from.col) * w.t;
      w.y = w.from.row + (w.to.row - w.from.row) * w.t;
    }
  }

  get walkers() { return this._walkers; }

  get droneDepth() {
    const p = this.dronePos();
    return p.col + p.row;
  }

  truckTile() { return this._dockKey ? toTile(this._dockKey) : null; }

  get truckDepth() {
    const t = this.truckTile();
    return t ? t.col + t.row : -Infinity;
  }

  dronePos() { return this.dronePosAt(this._droneT); }

  dronePosAt(t) {
    if (!this._dronePath.length) return { col: 0, row: 0 };
    const span = this._dronePath.length - 1;
    const p = pingPong(t, span);
    const i = Math.floor(p);
    const f = p - i;
    const a = this._dronePath[i];
    const b = this._dronePath[Math.min(i + 1, span)];
    return { col: a.col + (b.col - a.col) * f, row: a.row + (b.row - a.row) * f };
  }

  _nextRoadCell(cellKey, prevKey) {
    const n = this._graph.get(cellKey) ?? [];
    if (!n.length) return cellKey;
    const options = n.filter(o => `${o.cx},${o.cy}` !== prevKey);
    const pick = (options.length ? options : n)[
      Math.floor(Math.random() * (options.length || n.length))
    ];
    return `${pick.cx},${pick.cy}`;
  }

  drawDrone(now) {
    if (!this._dronePath.length) return;
    const p = this.dronePos();
    const w = tileToWorld(p.col, p.row);
    const bob = Math.sin(now / 400) * 3;
    const lift = DRONE_LIFT + bob;
    const ctx = this._r._ctx;
    const spr = this._assets?.drone();
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(w.x, w.y, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(w.x, w.y - lift, w.x, w.y);
    g.addColorStop(0, "rgba(140,225,255,0.22)");
    g.addColorStop(1, "rgba(140,225,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w.x - 4, w.y - lift);
    ctx.lineTo(w.x + 4, w.y - lift);
    ctx.lineTo(w.x + 12, w.y);
    ctx.lineTo(w.x - 12, w.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (spr) {
      this._blit(ctx, spr, w.x, w.y - lift, DRONE_PX, this._droneFaceLeft());
    } else {
      const y = w.y - lift;
      ctx.save();
      ctx.fillStyle = "rgba(140, 225, 255, 0.95)";
      ctx.beginPath();
      ctx.ellipse(w.x, y, 8, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 90, 90, 0.9)";
      ctx.beginPath();
      ctx.arc(w.x + 6, y - 1, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawWalker(w, now) {
    const p = tileToWorld(w.x, w.y);
    const ctx = this._r._ctx;
    const bob = Math.abs(Math.sin(now / 180 + w.hue)) * 1.5;
    const spr = this._assets?.walker(w.sprite);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, 4, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (spr) {
      this._blit(ctx, spr, p.x, p.y - bob, WALKER_PX, w.faceLeft);
    } else {
      ctx.fillStyle = `hsla(${w.hue}, 70%, 70%, 0.95)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 5 - bob, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `hsla(${w.hue}, 50%, 45%, 0.95)`;
      ctx.fillRect(p.x - 2, p.y - 4 - bob, 4, 5);
    }
    ctx.restore();
  }

  drawTruck(now) {
    const t = this.truckTile();
    const spr = this._assets?.truck();
    if (!t || !spr) return;
    const p = tileToWorld(t.col, t.row);
    const ctx = this._r._ctx;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this._blit(ctx, spr, p.x, p.y, TRUCK_PX, false);
  }

  _blit(ctx, spr, gx, gy, targetH, mirror) {
    const { img, anchor } = spr;
    const s = targetH / img.height;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.scale(mirror ? -1 : 1, 1);
    ctx.drawImage(img, -anchor.ax * s, -anchor.ay * s, img.width * s, img.height * s);
    ctx.restore();
  }

  _droneFaceLeft() {
    if (this._dronePath.length < 2) return false;
    return faceLeft(this.dronePosAt(this._droneT), this.dronePosAt(this._droneT + 0.05));
  }
}
