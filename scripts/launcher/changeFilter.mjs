import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function fingerprintFile(file) {
  try {
    if (fs.statSync(file).isDirectory()) return { kind: 'dir' };
    return { kind: 'file', hash: crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex') };
  } catch {
    return { kind: 'missing' };
  }
}

export function createChangeFilter({ fingerprint }) {
  const hashes = new Map();

  return {
    prime(relPaths) {
      for (const rel of relPaths) {
        const fp = fingerprint(rel);
        if (fp.kind === 'file') hashes.set(rel, fp.hash);
      }
    },
    isRealChange(rel) {
      const fp = fingerprint(rel);
      if (fp.kind === 'dir') return false;
      if (fp.kind === 'missing') return hashes.delete(rel);
      if (hashes.get(rel) === fp.hash) return false;
      hashes.set(rel, fp.hash);
      return true;
    },
  };
}

export function listFiles(root, dir) {
  const out = [];
  const walk = (rel) => {
    let entries;
    try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(child);
      else if (e.isFile()) out.push(child);
    }
  };
  walk(dir);
  return out;
}
