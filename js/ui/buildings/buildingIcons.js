import { iconFromEmoji } from '../icons.js';

// AI-generated building card icons (assestProcessing/hero-promt.md's building
// counterpart — see docs/10-design/assets.md). Grows as more are generated;
// a type with no entry here falls back to its emoji icon.
const AI_ICON_IDS = new Set([
  'bank', 'barracks', 'cafeteria', 'cavalrystable', 'farm', 'heroquarters',
  'house', 'lumbermill', 'mine', 'quarry', 'siegeworkshop', 'storehouse',
  'townhall', 'well',
]);

export function buildingIconUrl(id) {
  return AI_ICON_IDS.has(id) ? `assets/icons/buildings/${id}_icon.png` : null;
}

export function cardIconHtml(id, emoji) {
  const url = buildingIconUrl(id);
  return url ? `<img src="${url}" alt="">` : iconFromEmoji(emoji ?? '');
}
