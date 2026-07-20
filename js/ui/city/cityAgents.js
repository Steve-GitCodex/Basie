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

function toTile(cellKey) {
  const [cx, cy] = cellKey.split(",").map(Number);
  return { col: cx / 2, row: cy / 2 };
}

export class CityAgents {
  constructor(renderer) {
    this._r = renderer;
    this._graph = new Map();
    this._keys = [];
    this._dronePath = [];
    this._droneT = 0;
    this._walkers = [];
  }

  /** Rebuild the road graph + drone path + walkers from the derived road-cell set. */
  setRoads(roadCells) {
    this._graph = roadGraph(roadCells);
    this._keys = [...this._graph.keys()];
    this._dronePath = this._buildDronePath();
    this._droneT = 0;
    this._spawnWalkers();
  }

  /** Drone glides along the widest road row, edge to edge (cosmetic). */
  _buildDronePath() {
    if (!this._keys.length) return [];
    const rows = new Map();
    for (const k of this._keys) {
      const [cx, cy] = k.split(",").map(Number);
      if (!rows.has(cy)) rows.set(cy, []);
      rows.get(cy).push(cx);
    }
    let bestRow = null, bestLen = 0;
    for (const [cy, xs] of rows) {
      if (xs.length > bestLen) { bestLen = xs.length; bestRow = cy; }
    }
    const xs = rows.get(bestRow).sort((a, b) => a - b);
    return xs.map(cx => ({ col: cx / 2, row: bestRow / 2 }));
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
      });
    }
  }

  update(dt) {
    const droneLen = Math.max(1, this._dronePath.length - 1);
    this._droneT = (((this._droneT + dt * DRONE_SPEED) % droneLen) + droneLen) % droneLen;
    for (const w of this._walkers) {
      w.t += dt * WALKER_SPEED;
      if (w.t >= 1) {
        const next = this._nextRoadCell(w.cell, w.prev);
        w.prev = w.cell;
        w.cell = next;
        w.from = w.to;
        w.to = toTile(next);
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

  dronePos() {
    if (!this._dronePath.length) return { col: 0, row: 0 };
    const i = Math.floor(this._droneT);
    const f = this._droneT - i;
    const a = this._dronePath[i];
    const b = this._dronePath[Math.min(i + 1, this._dronePath.length - 1)];
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
    const ctx = this._r._ctx;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(w.x, w.y, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    const y = w.y - 34 + bob;
    ctx.fillStyle = "rgba(140, 225, 255, 0.95)";
    ctx.beginPath();
    ctx.ellipse(w.x, y, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 90, 90, 0.9)";
    ctx.beginPath();
    ctx.arc(w.x + 6, y - 1, 1.4, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(w.x, y, w.x, w.y);
    g.addColorStop(0, "rgba(140,225,255,0.25)");
    g.addColorStop(1, "rgba(140,225,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w.x - 4, y);
    ctx.lineTo(w.x + 4, y);
    ctx.lineTo(w.x + 12, w.y);
    ctx.lineTo(w.x - 12, w.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawWalker(w, now) {
    const p = tileToWorld(w.x, w.y);
    const ctx = this._r._ctx;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, 4, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    const bob = Math.abs(Math.sin(now / 180 + w.hue)) * 1.5;
    ctx.fillStyle = `hsla(${w.hue}, 70%, 70%, 0.95)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 5 - bob, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `hsla(${w.hue}, 50%, 45%, 0.95)`;
    ctx.fillRect(p.x - 2, p.y - 4 - bob, 4, 5);
    ctx.restore();
  }
}
