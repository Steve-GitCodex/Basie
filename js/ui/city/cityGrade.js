/**
 * cityGrade.js
 * Grim grading layer for the base city view (grit reskin Phase A1).
 *
 * Pre-renders desaturated/cold variants of every building + ground sprite once
 * at load (never per-frame ctx.filter), pre-renders a function plaque per
 * building type from the SVG icon set, and draws the full-scene overlay
 * (vignette + cold wash + horizon haze). Collaborator of CityRenderer.
 */
import { ISO_BUILDING_MAP, GROUND_TILES } from './cityAssets.js';

const GRIM_FILTER =
  'saturate(0.55) brightness(0.9) contrast(1.08) sepia(0.15) hue-rotate(-10deg)';

/** Building type → SVG system icon shown on its function plaque. */
const PLAQUE_ICONS = {
  townhall: 'base',
  heroquarters: 'heroes',
  barracks: 'sword',
  construction_hall: 'hammer',
  lumbermill: 'wood',
  storehouse: 'box',
  cafeteria: 'cafeteria',
  well: 'water',
  mine: 'iron',
  quarry: 'stone',
  bank: 'money',
  farm: 'food',
  workshop: 'gear',
  archeryrange: 'bow',
  house: 'house',
  cavalrystable: 'lightning',
  infantryhall: 'shield',
  siegeworkshop: 'fire',
  magictower: 'flask-potion',
  rallypoint: 'combat',
};

const PLAQUE_W = 22;      // world px
const PLAQUE_H = 18;
const PLAQUE_RES = 3;     // pre-render supersampling
const PLAQUE_ICON_COLOR = 'hsl(38, 60%, 72%)';

export class CityGrade {
  constructor(assets) {
    this._assets = assets;
    this._graded = new Map();   // "b:"/"g:" key → graded offscreen canvas
    this._gray = new Map();     // building id → graded grayscale canvas
    this._plaques = new Map();  // building id → plaque canvas
    this._ovW = 0;
    this._ovH = 0;
    this._vignette = null;
    this._haze = null;
  }

  async load() {
    this._gradeSprites();
    await this._renderPlaques();
  }

  building(id) {
    return this._graded.get(`b:${id}`) ?? this._assets.building(id);
  }

  ground(name) {
    return this._graded.get(`g:${name}`) ?? this._assets.ground(name);
  }

  buildingGray(id) {
    return this._gray.get(id) ?? this._assets.buildingGray(id);
  }

  drawPlaque(ctx, buildingId, x, y) {
    const cv = this._plaques.get(buildingId);
    if (!cv) return;
    ctx.drawImage(cv, x - PLAQUE_W / 2, y - PLAQUE_H / 2, PLAQUE_W, PLAQUE_H);
  }

  /** Full-scene atmosphere pass, device space — call last with identity transform. */
  drawOverlay(ctx, w, h) {
    if (!this._vignette || this._ovW !== w || this._ovH !== h) {
      this._ovW = w;
      this._ovH = h;
      const v = ctx.createRadialGradient(
        w / 2, h * 0.45, Math.min(w, h) * 0.42,
        w / 2, h * 0.45, Math.hypot(w, h) * 0.62,
      );
      v.addColorStop(0, 'rgba(6, 8, 10, 0)');
      v.addColorStop(1, 'rgba(6, 8, 10, 0.42)');
      this._vignette = v;
      const hz = ctx.createLinearGradient(0, 0, 0, h * 0.55);
      hz.addColorStop(0, 'rgba(165, 160, 148, 0)');
      hz.addColorStop(0.45, 'rgba(165, 160, 148, 0.07)');
      hz.addColorStop(1, 'rgba(165, 160, 148, 0)');
      this._haze = hz;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(96, 112, 128, 0.05)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = this._haze;
    ctx.fillRect(0, 0, w, h * 0.55);
    ctx.fillStyle = this._vignette;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  _gradeSprites() {
    for (const id of Object.keys(ISO_BUILDING_MAP)) {
      const graded = this._gradeImage(this._assets.building(id));
      if (graded) this._graded.set(`b:${id}`, graded);
      const gray = this._gradeImage(this._assets.buildingGray(id));
      if (gray) this._gray.set(id, gray);
    }
    for (const name of Object.keys(GROUND_TILES)) {
      const graded = this._gradeImage(this._assets.ground(name));
      if (graded) this._graded.set(`g:${name}`, graded);
    }
  }

  _gradeImage(img) {
    if (!img) return null;
    const cv = document.createElement('canvas');
    cv.width = img.width;
    cv.height = img.height;
    const cx = cv.getContext('2d');
    cx.filter = GRIM_FILTER;
    cx.drawImage(img, 0, 0);
    return cv;
  }

  async _renderPlaques() {
    await Promise.all(
      Object.entries(PLAQUE_ICONS).map(async ([buildingId, iconName]) => {
        const img = await this._loadIcon(iconName);
        if (img) this._plaques.set(buildingId, this._composePlaque(img));
      }),
    );
  }

  async _loadIcon(name) {
    try {
      const res = await fetch(`assets/icons/svg/${name}.svg`);
      if (!res.ok) return null;
      const svg = (await res.text()).replace(
        '<svg ',
        '<svg width="48" height="48" ',
      ).replaceAll('currentColor', PLAQUE_ICON_COLOR);
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await img.decode();
      return img;
    } catch {
      return null;
    }
  }

  _composePlaque(iconImg) {
    const w = PLAQUE_W * PLAQUE_RES;
    const h = PLAQUE_H * PLAQUE_RES;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.beginPath();
    ctx.roundRect(1.5, 1.5, w - 3, h - 3, 3 * PLAQUE_RES);
    ctx.fillStyle = 'rgba(18, 20, 22, 0.88)';
    ctx.fill();
    ctx.lineWidth = PLAQUE_RES;
    ctx.strokeStyle = 'rgba(140, 125, 95, 0.75)';
    ctx.stroke();
    const iconSize = (PLAQUE_H - 5) * PLAQUE_RES;
    ctx.drawImage(iconImg, (w - iconSize) / 2, (h - iconSize) / 2, iconSize, iconSize);
    return cv;
  }
}
