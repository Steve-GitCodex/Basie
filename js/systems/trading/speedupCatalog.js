export const SPEEDUP_DURATIONS = ['5m', '15m', '1h', '8h', 'instant'];
export const SPEEDUP_TYPES = ['universal', 'build', 'train', 'research'];

const SECONDS = { '5m': 300, '15m': 900, '1h': 3600, '8h': 28800, instant: Infinity };

export function speedupItemId(duration, type) {
  if (!SPEEDUP_DURATIONS.includes(duration) || !SPEEDUP_TYPES.includes(type)) return null;
  if (duration === 'instant') return 'speedup_universal_instant';
  return `speedup_${type}_${duration}`;
}

export function durationSeconds(duration) {
  return SECONDS[duration];
}
