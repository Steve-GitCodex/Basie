import fs from 'node:fs';
import { sanitizeSlotName } from '../../js/core/devSlots.js';

const MAX_SLOTS = 100;

export function sanitizeSlotList(raw) {
  if (!Array.isArray(raw)) return null;
  const names = raw.filter(s => typeof s === 'string').slice(0, MAX_SLOTS).map(sanitizeSlotName);
  return [...new Set(names)].sort();
}

export function sessionEntries(slots) {
  return [
    { label: 'normal', path: '/' },
    ...slots.map(slot => ({ label: `dev:${slot}`, path: `/?dev=${encodeURIComponent(slot)}` })),
  ];
}

export function sessionForChoice(answer, slots) {
  const index = Number(String(answer ?? '').trim());
  if (!Number.isInteger(index) || index < 1) return null;
  return sessionEntries(slots)[index - 1] ?? null;
}

export function formatSessionMenu(slots) {
  const lines = sessionEntries(slots).map((entry, i) => `  [${i + 1}] ${entry.label}`);
  if (slots.length === 0) lines.push('      no dev slots yet; [n] creates one');
  return ['Sessions:', ...lines].join('\n');
}

export function createSlotStore(file) {
  let slots = read();

  function read() {
    try {
      return sanitizeSlotList(JSON.parse(fs.readFileSync(file, 'utf8'))) ?? [];
    } catch {
      return [];
    }
  }

  return {
    list: () => slots,
    replace(next) {
      if (next.join('\n') === slots.join('\n')) return false;
      slots = next;
      try { fs.writeFileSync(file, JSON.stringify(slots)); } catch { /* menu still works in-memory */ }
      return true;
    },
  };
}
