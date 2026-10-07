const STORAGE_KEY = 'basie_battle_toggles';
const DEFAULTS = Object.freeze({ numbers: true, arrows: true, log: true });

export function readToggles() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!stored || typeof stored !== 'object') return { ...DEFAULTS };
    return Object.fromEntries(Object.keys(DEFAULTS).map(key => [key, stored[key] !== false]));
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeToggles(toggles) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULTS, ...toggles }));
  } catch {
    return false;
  }
  return true;
}
