const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;
const MAX_ENTRIES = 100;
const MAX_MESSAGE = 2000;
const MAX_SOURCE = 300;
const MAX_TAG = 60;

export function isTrustedRequest({ host, origin }, port) {
  const allowed = [`localhost:${port}`, `127.0.0.1:${port}`];
  if (!allowed.includes(host)) return false;
  return !origin || allowed.some(a => origin === `http://${a}`);
}

const clean = (value, max) => String(value ?? '').replace(CONTROL_CHARS, ' ').slice(0, max);

export function sanitizeClientEntries(raw) {
  if (!Array.isArray(raw)) return null;
  return raw
    .filter(e => e !== null && typeof e === 'object' && !Array.isArray(e))
    .slice(0, MAX_ENTRIES)
    .map(e => ({
      level: e.level === 'warn' ? 'warn' : 'error',
      message: clean(e.message, MAX_MESSAGE),
      source: clean(e.source, MAX_SOURCE),
      tag: clean(e.tag, MAX_TAG) || 'unknown',
      at: Number.isFinite(e.at) ? e.at : Date.now(),
    }));
}
