/**
 * worldGrade.js
 * Grim palette helpers for the world map (grit reskin Phase A1): mud/ash
 * ground tones and a faction-color desaturator so region fills read as
 * faction-tinted grime while keeping hue identity.
 */

export const WORLD_BACKDROP = '#161310';
export const LAND_BASE = '#2a2620';

const cache = new Map();

/** Desaturate + slightly darken a #rrggbb color; returns hex (cached). */
export function grime(hex, satMul = 0.5, lightMul = 0.92) {
  const key = `${hex}|${satMul}|${lightMul}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const [hue, s, l] = rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
  const out = hslToHex(hue, s * satMul, Math.min(1, l * lightMul));
  cache.set(key, out);
  return out;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
