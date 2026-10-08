const stat = (label, icon, group, order) => Object.freeze({ label, icon, group, order, format: 'pct' });
const source = (tag, icon) => Object.freeze({ tag, icon });

export const BUFF_STATS = Object.freeze({
  'production.all':   stat('All production', '📈', 'economy', 0),
  'production.wood':  stat('Wood production', '🪵', 'economy', 1),
  'production.stone': stat('Stone production', '🪨', 'economy', 2),
  'production.iron':  stat('Iron production', '⛏️', 'economy', 3),
  'production.food':  stat('Food production', '🌾', 'economy', 4),
  'production.water': stat('Water production', '💧', 'economy', 5),
  'production.money': stat('Money production', '💰', 'economy', 6),
  'gather.load':      stat('Gather load', '🎒', 'economy', 7),
  'troop.attack':     stat('Troop attack', '⚔️', 'military', 0),
  'troop.defense':    stat('Troop defense', '🛡️', 'military', 1),
  'march.speed':      stat('March speed', '🚩', 'speed', 0),
  'build.speed':      stat('Build speed', '🔨', 'speed', 1),
  'research.speed':   stat('Research speed', '🔬', 'speed', 2),
  'train.speed':      stat('Training speed', '🎖️', 'speed', 3),
});

export const BUFF_SOURCES = Object.freeze({
  item:       source('Item', '🧪'),
  region:     source('Region', '🗺️'),
  outpost:    source('Outpost', '🏕️'),
  expedition: source('Expedition', '🧭'),
  tech:       source('Tech', '🔬'),
  vip:        source('VIP', '👑'),
  hq:         source('HQ', '🏛️'),
  hero:       source('Hero', '🦸'),
  event:      source('Event', '🎉'),
  difficulty: source('Difficulty', '💀'),
});
