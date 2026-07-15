/**
 * cityAgents.js
 * Ambient life for the base city view: the survey drone on its fixed path and
 * pedestrians wandering the road graph. Owns their motion state and draws them;
 * depth ordering is done by CityRenderer, which interleaves these with buildings.
 *
 * Collaborator of CityRenderer — holds a back-reference for canvas context only.
 */
import { tileToWorld } from "./isoMath.js";
import { dronePath, roadGraph } from "./cityLayout.js";

const DRONE_SPEED = 1.1; // tiles per second
const WALKER_SPEED = 0.45; // tiles per second
const WALKER_COUNT = 3;

export class CityAgents {
  constructor(renderer) {
    this._r = renderer;
    this._dronePath = dronePath();
    this._roadGraph = roadGraph();
    this._droneT = 0;
    this._walkers = [];
  }

  spawn() {
    const cells = [...this._roadGraph.keys()];
    if (!cells.length) return;
    for (let i = 0; i < WALKER_COUNT; i++) {
      const key = cells[(i * 13) % cells.length];
      const [c, r] = key.split(",").map(Number);
      this._walkers.push({
        x: c,
        y: r, // fractional tile coords
        from: { col: c, row: r },
        to: this._nextRoadCell({ col: c, row: r }, null),
        t: 0,
        hue: 180 + i * 60,
      });
    }
  }

  /** Advance drone + walker motion by dt seconds. */
  update(dt) {
    const droneLen = this._dronePath.length - 1;
    this._droneT =
      (((this._droneT + dt * DRONE_SPEED) % droneLen) + droneLen) % droneLen;
    for (const w of this._walkers) {
      if (!w.to) continue;
      w.t += dt * WALKER_SPEED;
      if (w.t >= 1) {
        const prev = w.from;
        w.from = w.to;
        w.to = this._nextRoadCell(w.from, prev);
        w.t = 0;
      }
      w.x = w.from.col + (w.to.col - w.from.col) * w.t;
      w.y = w.from.row + (w.to.row - w.from.row) * w.t;
    }
  }

  get walkers() {
    return this._walkers;
  }

  get droneDepth() {
    const p = this.dronePos();
    return p.col + p.row;
  }

  dronePos() {
    const i = Math.floor(this._droneT);
    const f = this._droneT - i;
    const a = this._dronePath[i];
    const b = this._dronePath[Math.min(i + 1, this._dronePath.length - 1)];
    return {
      col: a.col + (b.col - a.col) * f,
      row: a.row + (b.row - a.row) * f,
    };
  }

  _nextRoadCell(cell, prev) {
    const n = this._roadGraph.get(`${cell.col},${cell.row}`) ?? [];
    if (!n.length) return cell;
    const options = n.filter(
      (o) => !prev || o.col !== prev.col || o.row !== prev.row,
    );
    const pick = (options.length ? options : n)[
      Math.floor(Math.random() * (options.length || n.length))
    ];
    return pick;
  }

  drawDrone(now) {
    const p = this.dronePos();
    const w = tileToWorld(p.col, p.row);
    const bob = Math.sin(now / 400) * 3;
    const ctx = this._r._ctx;
    ctx.save();
    // ground shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(w.x, w.y, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // glowing body
    const y = w.y - 34 + bob;
    ctx.fillStyle = "rgba(140, 225, 255, 0.95)";
    ctx.beginPath();
    ctx.ellipse(w.x, y, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 90, 90, 0.9)";
    ctx.beginPath();
    ctx.arc(w.x + 6, y - 1, 1.4, 0, Math.PI * 2);
    ctx.fill();
    // light cone
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
