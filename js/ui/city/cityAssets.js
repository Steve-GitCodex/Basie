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
const L = 'assets/tiles/landscape';
const C = 'assets/tiles/city';

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
    this.ready   = false;
  }

  /** Load every sprite; resolves even if some fail (renderer falls back per-tile). */
  async load() {
    const entries = [
      ...Object.entries(ISO_BUILDING_MAP).map(([k, src]) => [`b:${k}`, src]),
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
    this._prerenderGrayscale();
    this.ready = true;
  }

  building(id)  { return this._images.get(`b:${id}`) ?? null; }
  ground(name)  { return this._images.get(`g:${name}`) ?? null; }
  buildingGray(id) { return this._gray.get(id) ?? null; }

  /** Pre-render grayscale building variants once (locked slots) — avoids per-frame ctx.filter. */
  _prerenderGrayscale() {
    for (const id of Object.keys(ISO_BUILDING_MAP)) {
      const img = this.building(id);
      if (!img) continue;
      const cv = document.createElement('canvas');
      cv.width = img.width;
      cv.height = img.height;
      const cx = cv.getContext('2d');
      cx.filter = 'grayscale(1) brightness(0.55)';
      cx.drawImage(img, 0, 0);
      this._gray.set(id, cv);
    }
  }
}
