/**
 * cityAssets.js
 * Sprite manifest + image loader for the iso city view.
 *
 * Building sprites: Kenney "Isometric Buildings" (CC0) — assets/tiles/buildings/.
 * Ground tiles: Kenney isometric landscape + city packs already in the repo.
 * Each building sprite includes its own ground block, so it is drawn
 * bottom-anchored in place of (over) the zone ground tile.
 */

const B = 'assets/tiles/buildings';
const G = 'assets/tiles/buildings/grit';
const L = 'assets/tiles/landscape';
const C = 'assets/tiles/city';

/**
 * Grit building set, rig-rendered to the tile grid from CC0 packs (Quaternius
 * Ultimate Fantasy RTS / Farm Buildings / Zombie Apocalypse, Kenney Survival Kit) —
 * ADR 0009/0010.
 * Level-keyed evolution sprites; buckets map building level → {1,2,3+}. Trimmed to
 * content bbox at a shared scale so relative sizes are authored, not normalised.
 * Types absent here fall back to their ISO_BUILDING_MAP (legacy Kenney) sprite.
 */
export const GRIT_BUILDING_MAP = {
  townhall:          { 1: `${G}/townhall_L1.png`,          2: `${G}/townhall_L2.png`,          3: `${G}/townhall_L3.png` },
  heroquarters:      { 1: `${G}/heroquarters_L1.png`,      2: `${G}/heroquarters_L2.png`,      3: `${G}/heroquarters_L3.png` },
  barracks:          { 1: `${G}/barracks_L1.png`,          2: `${G}/barracks_L2.png`,          3: `${G}/barracks_L3.png` },
  construction_hall: { 1: `${G}/construction_hall_L1.png`, 2: `${G}/construction_hall_L2.png`, 3: `${G}/construction_hall_L3.png` },
  lumbermill:        { 1: `${G}/lumbermill_L1.png`,        2: `${G}/lumbermill_L2.png`,        3: `${G}/lumbermill_L3.png` },
  storehouse:        { 1: `${G}/storehouse_L1.png`,        2: `${G}/storehouse_L2.png`,        3: `${G}/storehouse_L3.png` },
  cafeteria:         { 1: `${G}/cafeteria_L1.png`,         2: `${G}/cafeteria_L2.png`,         3: `${G}/cafeteria_L3.png` },
  mine:              { 1: `${G}/mine_L1.png`,              2: `${G}/mine_L2.png`,              3: `${G}/mine_L3.png` },
  quarry:            { 1: `${G}/quarry_L1.png`,            2: `${G}/quarry_L2.png`,            3: `${G}/quarry_L3.png` },
  bank:              { 1: `${G}/bank_L1.png`,              2: `${G}/bank_L2.png`,              3: `${G}/bank_L3.png` },
  farm:              { 1: `${G}/farm_L1.png`,              2: `${G}/farm_L2.png`,              3: `${G}/farm_L3.png` },
  workshop:          { 1: `${G}/workshop_L1.png`,          2: `${G}/workshop_L2.png`,          3: `${G}/workshop_L3.png` },
  archeryrange:      { 1: `${G}/archeryrange_L1.png`,      2: `${G}/archeryrange_L2.png`,      3: `${G}/archeryrange_L3.png` },
  house:             { 1: `${G}/house_L1.png`,             2: `${G}/house_L2.png`,             3: `${G}/house_L3.png` },
  cavalrystable:     { 1: `${G}/cavalrystable_L1.png`,     2: `${G}/cavalrystable_L2.png`,     3: `${G}/cavalrystable_L3.png` },
  infantryhall:      { 1: `${G}/infantryhall_L1.png`,      2: `${G}/infantryhall_L2.png`,      3: `${G}/infantryhall_L3.png` },
  magictower:        { 1: `${G}/magictower_L1.png`,        2: `${G}/magictower_L2.png`,        3: `${G}/magictower_L3.png` },
  rallypoint:        { 1: `${G}/rallypoint_L1.png`,        2: `${G}/rallypoint_L2.png`,        3: `${G}/rallypoint_L3.png` },
  well:              { 1: `${G}/well_L1.png`,              2: `${G}/well_L2.png`,              3: `${G}/well_L3.png` },
  siegeworkshop:     { 1: `${G}/siegeworkshop_L1.png`,     2: `${G}/siegeworkshop_L2.png`,     3: `${G}/siegeworkshop_L3.png` },
};

/** Building level → grit sprite bucket. */
export function gritBucket(level) {
  return Math.max(1, Math.min(3, level | 0));
}

/** Building type → iso sprite. One visually distinct silhouette per type. */
export const ISO_BUILDING_MAP = {
  townhall:          `${B}/buildingTiles_125.png`, // glass corner office — civic centerpiece
  heroquarters:      `${B}/buildingTiles_113.png`,
  barracks:          `${B}/buildingTiles_106.png`,
  construction_hall: `${B}/buildingTiles_011.png`,
  lumbermill:        `${B}/buildingTiles_027.png`,
  storehouse:        `${B}/buildingTiles_035.png`,
  cafeteria:         `${B}/buildingTiles_004.png`,
  well:              `${B}/buildingTiles_014.png`,
  mine:              `${B}/buildingTiles_092.png`,
  quarry:            `${B}/buildingTiles_085.png`,
  bank:              `${B}/buildingTiles_003.png`,
  farm:              `${B}/buildingTiles_018.png`,
  workshop:          `${B}/buildingTiles_122.png`,
  archeryrange:      `${B}/buildingTiles_033.png`,
  house:             `${B}/buildingTiles_029.png`,
  cavalrystable:     `${B}/buildingTiles_021.png`,
  infantryhall:      `${B}/buildingTiles_036.png`,
  siegeworkshop:     `${B}/buildingTiles_040.png`,
  magictower:        `${B}/buildingTiles_099.png`,
  rallypoint:        `${B}/buildingTiles_101.png`, // watchtower/flag — army muster point
};

/** Ground + decoration tiles, keyed by semantic name. */
export const GROUND_TILES = {
  grass:    `${L}/landscapeTiles_067.png`,
  grassAlt: `${L}/landscapeTiles_015.png`,
  sand:     `${L}/landscapeTiles_059.png`,
  dirt:     `${L}/landscapeTiles_083.png`,
  hill:     `${L}/landscapeTiles_036.png`,
  road:     `${C}/cityTiles_080.png`,
  roadLane: `${C}/cityTiles_073.png`,
  plaza:    `${C}/cityTiles_074.png`,
  lot:      `${C}/cityTiles_110.png`,
};

export class CityAssets {
  constructor() {
    this._images = new Map();   // key → HTMLImageElement
    this._gray   = new Map();   // building key → offscreen grayscale canvas
    this._pad    = new Map();   // building key → transparent px below content
    this._anchor = new Map();   // building key → {ax, ay} ground-contact centre (sprite px)
    this.ready   = false;
  }

  /** Load every sprite; resolves even if some fail (renderer falls back per-tile). */
  async load() {
    const gritEntries = Object.entries(GRIT_BUILDING_MAP).flatMap(([id, levels]) =>
      Object.entries(levels).map(([lvl, src]) => [`b:${id}:${lvl}`, src]),
    );
    const entries = [
      ...Object.entries(ISO_BUILDING_MAP).map(([k, src]) => [`b:${k}`, src]),
      ...gritEntries,
      ...Object.entries(GROUND_TILES).map(([k, src]) => [`g:${k}`, src]),
    ];
    await Promise.all(entries.map(async ([key, src]) => {
      const img = new Image();
      img.src = src;
      try {
        await img.decode();
        this._images.set(key, img);
      } catch {
        // Missing sprite → renderer draws a colored fallback diamond.
      }
    }));
    await this._loadAnchors(gritEntries);
    this._prerenderGrayscale();
    this.ready = true;
  }

  /**
   * Per-sprite ground-contact centre exported by the render rig (ADR 0022). The
   * renderer seats this point on the plot centre, so a building sits centred on its
   * footprint at any size or level. Missing manifest → bottom-centre fallback.
   */
  async _loadAnchors(gritEntries) {
    let manifest = {};
    try {
      const res = await fetch(`${G}/_anchors.json`, { cache: 'no-store' });
      if (res.ok) manifest = await res.json();
    } catch { /* fallback below */ }
    for (const [key, src] of gritEntries) {
      const a = manifest[src.slice(src.lastIndexOf('/') + 1)];
      if (a && Number.isFinite(a.ax) && Number.isFinite(a.ay)) this._anchor.set(key, a);
    }
  }

  /** Resolve a building sprite: grit level-variant first, then legacy iso. */
  building(id, level = 0) {
    if (level > 0) {
      const k = this._images.get(`b:${id}:${gritBucket(level)}`);
      if (k) return k;
    }
    return this._images.get(`b:${id}:1`) ?? this._images.get(`b:${id}`) ?? null;
  }

  ground(name)  { return this._images.get(`g:${name}`) ?? null; }

  /** Ground-contact centre of a sprite in its own px; falls back to bottom-centre. */
  anchor(id, level = 0) {
    const img = this.building(id, level);
    const fallback = { ax: (img?.width ?? 0) / 2, ay: img?.height ?? 0 };
    if (level > 0) {
      const a = this._anchor.get(`b:${id}:${gritBucket(level)}`);
      if (a) return a;
    }
    return this._anchor.get(`b:${id}:1`) ?? fallback;
  }

  /** Transparent rows under a sprite's visible content (draw anchors subtract this). */
  bottomPad(id, level = 0) {
    if (level > 0) {
      const p = this._pad.get(`b:${id}:${gritBucket(level)}`);
      if (p !== undefined) return p;
    }
    return this._pad.get(`b:${id}:1`) ?? this._pad.get(`b:${id}`) ?? 0;
  }

  buildingGray(id, level = 0) {
    if (level > 0) {
      const k = this._gray.get(`b:${id}:${gritBucket(level)}`);
      if (k) return k;
    }
    return this._gray.get(`b:${id}:1`) ?? this._gray.get(`b:${id}`) ?? null;
  }

  /** Every loaded building-sprite key (`b:*`) — legacy + grit level variants. */
  buildingVariantKeys() {
    return [...this._images.keys()].filter((k) => k.startsWith('b:'));
  }

  imageByKey(key) { return this._images.get(key) ?? null; }
  grayByKey(key)  { return this._gray.get(key) ?? null; }

  /** Pre-render grayscale building variants once (locked slots) — avoids per-frame ctx.filter. */
  _prerenderGrayscale() {
    for (const key of this.buildingVariantKeys()) {
      const img = this._images.get(key);
      const cv = document.createElement('canvas');
      cv.width = img.width;
      cv.height = img.height;
      const cx = cv.getContext('2d');
      cx.drawImage(img, 0, 0);
      this._pad.set(key, this._measureBottomPad(cx, cv.width, cv.height));
      cx.filter = 'grayscale(1) brightness(0.55)';
      cx.clearRect(0, 0, cv.width, cv.height);
      cx.drawImage(img, 0, 0);
      this._gray.set(key, cv);
    }
  }

  _measureBottomPad(cx, w, h) {
    const a = cx.getImageData(0, 0, w, h).data;
    for (let y = h - 1; y >= 0; y--) {
      for (let x = 0; x < w; x++) {
        if (a[(y * w + x) * 4 + 3] > 8) return h - 1 - y;
      }
    }
    return 0;
  }
}
