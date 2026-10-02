import path from 'node:path';

export const BRIDGE_TAG = '<script type="module" src="/__basie/bridge.js"></script>';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

export function resolveSafePath(root, urlPath) {
  const bare = urlPath.split(/[?#]/)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(bare);
  } catch {
    return null;
  }
  const rel = decoded === '/' ? '/index.html' : decoded;
  const base = path.resolve(root);
  const full = path.resolve(base, '.' + rel);
  return full === base || full.startsWith(base + path.sep) ? full : null;
}

export function contentType(filePath) {
  return TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export function injectBridge(html) {
  if (html.includes(BRIDGE_TAG) || !html.includes('</head>')) return html;
  return html.replace('</head>', BRIDGE_TAG + '</head>');
}
