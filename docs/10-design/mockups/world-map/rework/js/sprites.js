(function (root) {
'use strict';

const BIOME_LOOK = {
  ash:       { tiles: ['ash_1', 'ash_2'],                filter: 'grayscale(0.7) brightness(1.18) contrast(0.95)', wash: 'rgba(150,146,140,0.20)' },
  cracked:   { tiles: ['cracked_1', 'cracked_2'],        filter: 'sepia(0.55) saturate(1.25) brightness(1.32)', wash: 'rgba(176,138,92,0.20)' },
  deadgrass: { tiles: ['earth_1', 'earth_2', 'earth_3'], filter: 'sepia(0.45) saturate(1.5) hue-rotate(28deg) brightness(1.22)', wash: 'rgba(124,128,60,0.24)' },
  mud:       { tiles: ['earth_2', 'earth_3', 'earth_1'], filter: 'sepia(0.6) saturate(1.1) brightness(0.86)', wash: 'rgba(78,56,36,0.30)' },
  frost:     { tiles: ['ash_1', 'cracked_2', 'ash_2'],   filter: 'grayscale(0.6) brightness(1.65) contrast(0.85)', wash: 'rgba(196,214,226,0.34)' },
  scorch:    { tiles: ['cracked_1', 'rubble_1'],         filter: 'sepia(0.8) saturate(2.2) hue-rotate(-18deg) brightness(0.78)', wash: 'rgba(84,30,18,0.26)' },
  rubble:    { tiles: ['rubble_1', 'rubble_2'],          filter: 'grayscale(0.4) brightness(1.05)', wash: 'rgba(110,104,98,0.14)' },
  asphalt:   { tiles: ['road_1', 'road_2', 'rubble_2'],  filter: 'grayscale(0.5) brightness(1.0)', wash: 'rgba(60,62,66,0.18)' },
};
const PROP_TINT = {
  frost: 'grayscale(0.5) brightness(1.45) hue-rotate(160deg) saturate(0.6)',
  scorch: 'sepia(0.6) brightness(0.62) saturate(1.4)',
  ash: 'grayscale(0.75) brightness(0.9)',
};
const GREY = 'grayscale(0.85) brightness(0.78) sepia(0.18) contrast(1.05)';

const imgs = {};
const cache = new Map();

function loadImage(key, src) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => { imgs[key] = im; res(); };
    im.onerror = () => { console.warn('missing', src); res(); };
    im.src = src;
  });
}

function iconSvg(name, color) {
  const ic = root.ICONS[name];
  if (!ic) return null;
  const a = ic.attrs || {};
  const attrs = Object.entries(a).map(([k, v]) => `${k}="${v === 'currentColor' ? color : v}"`).join(' ');
  const inner = ic.inner.replace(/currentColor/g, color);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ic.vb}" width="64" height="64" ${attrs}>${inner}</svg>`;
}

function load() {
  const jobs = [];
  for (const key of Object.keys(root.SPRITE_SIZES)) jobs.push(loadImage(key, `sprites/${key}.png`));
  for (const name of Object.keys(root.ICONS)) {
    for (const [tag, col] of [['w', '#ffffff'], ['k', '#1a1410']]) {
      const svg = iconSvg(name, col);
      jobs.push(loadImage(`icon/${name}/${tag}`, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)));
    }
  }
  return Promise.all(jobs);
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}

function filtered(key, filter, extra) {
  const id = `${key}|${filter}|${extra || ''}`;
  if (cache.has(id)) return cache.get(id);
  const src = imgs[key];
  if (!src) return null;
  const c = canvas(src.width, src.height), x = c.getContext('2d');
  x.filter = filter || 'none';
  x.drawImage(src, 0, 0);
  x.filter = 'none';
  if (extra) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = extra; x.fillRect(0, 0, c.width, c.height); }
  cache.set(id, c);
  return c;
}

function tile(biome, variant) {
  const look = BIOME_LOOK[biome] || BIOME_LOOK.cracked;
  const name = look.tiles[variant % look.tiles.length];
  return filtered(`ground/${name}`, look.filter, look.wash);
}
function prop(name, biome) {
  return filtered(`props/${name}`, PROP_TINT[biome] || 'none');
}
function bld(name, grey) {
  return grey ? filtered(`buildings/${name}`, GREY) : imgs[`buildings/${name}`];
}
function anchor(name) {
  const a = root.SPRITE_ANCHORS[`buildings/${name}`];
  const im = imgs[`buildings/${name}`];
  return a || (im ? [im.width / 2, im.height * 0.75] : [0, 0]);
}
function tint(name, wash) { return filtered(`buildings/${name}`, 'none', wash); }
function icon(name, dark) { return imgs[`icon/${name}/${dark ? 'k' : 'w'}`]; }
function raw(key) { return imgs[key]; }

root.Sprites = { load, tile, prop, bld, tint, anchor, icon, raw, canvas, BIOME_LOOK };
})(globalThis);
