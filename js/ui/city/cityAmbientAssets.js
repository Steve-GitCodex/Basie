/**
 * cityAmbientAssets.js
 * Loads + grim-grades the base-city ambient sprites (walkers, drone, truck),
 * rig-rendered to assets/tiles/props/ambient/ with per-sprite ground anchors.
 * Kept separate from CityAssets (buildings) — different lifetime + owner (CityAgents).
 */
const P = 'assets/tiles/props/ambient';
const GRIM_FILTER =
  'saturate(0.55) brightness(0.9) contrast(1.08) sepia(0.15) hue-rotate(-10deg)';

export const WALKER_SPRITES = ['survivor_lis', 'survivor_matt', 'survivor_sam', 'survivor_shaun'];
export const DRONE_SPRITE = 'drone';
export const TRUCK_SPRITE = 'truck';

export class CityAmbientAssets {
  constructor() {
    this._walkers = [];
    this._drone = null;
    this._truck = null;
  }

  async load() {
    const anchors = await this._loadAnchors();
    const names = [...WALKER_SPRITES, DRONE_SPRITE, TRUCK_SPRITE];
    const graded = new Map();
    await Promise.all(names.map(async (n) => {
      const img = new Image();
      img.src = `${P}/${n}.png`;
      try {
        await img.decode();
        const a = anchors[`${n}.png`];
        graded.set(n, {
          img: this._grade(img),
          anchor: (a && Number.isFinite(a.ax) && Number.isFinite(a.ay))
            ? a : { ax: img.width / 2, ay: img.height },
        });
      } catch { /* missing sprite → agent falls back to procedural draw */ }
    }));
    this._walkers = WALKER_SPRITES.map((n) => graded.get(n)).filter(Boolean);
    this._drone = graded.get(DRONE_SPRITE) ?? null;
    this._truck = graded.get(TRUCK_SPRITE) ?? null;
  }

  walker(i) {
    return this._walkers.length ? this._walkers[((i % this._walkers.length) + this._walkers.length) % this._walkers.length] : null;
  }

  drone() { return this._drone; }
  truck() { return this._truck; }

  async _loadAnchors() {
    try {
      const res = await fetch(`${P}/_anchors.json`, { cache: 'no-store' });
      return res.ok ? await res.json() : {};
    } catch { return {}; }
  }

  _grade(img) {
    const cv = document.createElement('canvas');
    cv.width = img.width;
    cv.height = img.height;
    const cx = cv.getContext('2d');
    cx.filter = GRIM_FILTER;
    cx.drawImage(img, 0, 0);
    return cv;
  }
}
