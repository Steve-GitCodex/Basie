export function icon(name, cls = '') {
  return `<span class="icon icon--${name}${cls ? ' ' + cls : ''}"></span>`;
}

const EMOJI_MAP = {
  '⚔️': 'sword', '🗡️': 'sword', '🏹': 'bow',   '💥': 'lightning',
  '🛡️': 'shield', '✝️': 'shield', '🔬': 'flask', '🏗️': 'hammer',
  '⚒️': 'production', '⛏️': 'production', '🪣': 'gather',
  '🔮': 'flask-potion', '⚗️': 'flask-potion', '💨': 'lightning',
  '🃏': 'scroll', '🎲': 'scroll', '📢': 'warning',
};

export function iconFromEmoji(emoji, cls = '') {
  const name = EMOJI_MAP[emoji];
  return name ? icon(name, cls) : emoji;
}
