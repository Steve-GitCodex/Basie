const ANSI = {
  ok: '\x1b[2m',
  cached: '\x1b[90m',
  missing: '\x1b[31m',
  error: '\x1b[1;31m',
  warn: '\x1b[33m',
  reset: '\x1b[0m',
};
const PAGE_PATHS = new Set(['/', '/index.html']);
const MB = 1_048_576;

export function classifyStatus(code) {
  if (code === 304) return 'cached';
  if (code >= 500) return 'error';
  if (code >= 400) return 'missing';
  return 'ok';
}

const isProblem = (r) => {
  const c = classifyStatus(r.status);
  return c === 'missing' || c === 'error';
};

export class PageLoadGrouper {
  constructor({ quietMs = 1000, now = Date.now } = {}) {
    this._quietMs = quietMs;
    this._now = now;
    this._group = null;
  }

  add(req) {
    const path = req.path.split('?')[0];
    if (PAGE_PATHS.has(path)) {
      const closed = this._group ? this._close() : [];
      this._group = { openedAt: req.at, lastAt: req.at, files: 0, bytes: 0, problems: [] };
      this._join(req);
      return closed;
    }
    if (this._group && req.at - this._group.lastAt <= this._quietMs) {
      this._join(req);
      return [];
    }
    const closed = this._group ? this._close() : [];
    return [...closed, { kind: 'request', req }];
  }

  flush() {
    if (!this._group || this._now() - this._group.lastAt <= this._quietMs) return [];
    return this._close();
  }

  _join(req) {
    const g = this._group;
    g.files += 1;
    g.bytes += req.bytes ?? 0;
    g.lastAt = req.at;
    if (isProblem(req)) g.problems.push(req);
  }

  _close() {
    const g = this._group;
    this._group = null;
    const n = g.problems.length;
    const text = `page load · ${g.files} files · ${(g.bytes / MB).toFixed(1)} MB · ${g.lastAt - g.openedAt} ms`
      + (n > 0 ? ` · ${n} missing` : '');
    return [{ kind: 'summary', text, bell: n > 0 }, ...g.problems.map(req => ({ kind: 'missing', req }))];
  }
}

export function clock(at = Date.now()) {
  return new Date(at).toTimeString().slice(0, 8);
}

export function paint(text, tone, color) {
  return color && ANSI[tone] ? `${ANSI[tone]}${text}${ANSI.reset}` : text;
}

export function formatRequest(req, { color }) {
  const line = `${clock(req.at)}  ${req.status}  ${req.method} ${req.path}  ${req.ms}ms`;
  return paint(line, classifyStatus(req.status), color);
}

export function formatClientLog({ level, message, source, tag, at }, { color }) {
  const mark = level === 'warn' ? '⚠' : '✖';
  const line = `${clock(at)}  [${tag}] ${mark} ${message}` + (source ? `  (${source})` : '');
  return paint(line, level === 'warn' ? 'warn' : 'missing', color);
}
