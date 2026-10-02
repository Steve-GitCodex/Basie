// @see docs/20-decisions/0032-dev-dashboard-and-slots.md
export const DEV_SAVE_PREFIX = 'basie_dev_save:';
export const DEFAULT_DEV_SLOT = 'default';
const MAX_SLOT_NAME = 32;

export function sanitizeSlotName(raw) {
  const name = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLOT_NAME);
  return name || DEFAULT_DEV_SLOT;
}

export function devSlotKey(name) {
  return DEV_SAVE_PREFIX + sanitizeSlotName(name);
}

export function listDevSlots(storage) {
  const slots = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(DEV_SAVE_PREFIX)) slots.push(key.slice(DEV_SAVE_PREFIX.length));
  }
  return slots.sort();
}

export function deleteDevSlot(storage, name) {
  storage.removeItem(devSlotKey(name));
}
