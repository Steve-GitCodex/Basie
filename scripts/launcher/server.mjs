import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSafePath, contentType, injectBridge } from './staticFiles.mjs';
import { isTrustedRequest, sanitizeClientEntries } from './requestGuards.mjs';
import { sanitizeSlotList } from './sessions.mjs';

const BRIDGE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'client', 'bridge.js');
const MAX_LOG_BODY = 64 * 1024;
const HEARTBEAT_MS = 15_000;
const NO_STORE = { 'Cache-Control': 'no-store' };

export function createLauncherServer({ root, onRequest, onClientLog, onSlots = () => {}, onWarn }) {
  const clients = new Set();
  let warnedBadPayload = false;

  const send = (res, status, body = '', headers = {}) => {
    res.writeHead(status, { ...NO_STORE, ...headers });
    res.end(res.req.method === 'HEAD' ? undefined : body);
    return Buffer.byteLength(body);
  };

  const routes = {
    'GET /__basie/ping': (req, res) =>
      send(res, 200, JSON.stringify({ app: 'basie-launcher' }), { 'Content-Type': 'application/json' }),
    'GET /__basie/bridge.js': async (req, res) =>
      send(res, 200, await fs.readFile(BRIDGE_FILE, 'utf8'), { 'Content-Type': contentType(BRIDGE_FILE) }),
    'GET /__basie/events': (req, res) => openEventStream(req, res),
    'POST /__basie/log': (req, res) => receiveClientLog(req, res),
    'POST /__basie/slots': (req, res) => receiveSlots(req, res),
  };

  function openEventStream(req, res) {
    res.writeHead(200, { ...NO_STORE, 'Content-Type': 'text/event-stream', Connection: 'keep-alive' });
    res.write('retry: 1000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
  }

  function receiveSlots(req, res) {
    readJson(req, res, (raw) => {
      const slots = sanitizeSlotList(raw);
      if (!slots) return send(res, 400);
      send(res, 204);
      onSlots(slots);
    });
  }

  function readJson(req, res, handle) {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_LOG_BODY) {
        send(res, 413);
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      let raw;
      try { raw = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { raw = undefined; }
      try {
        handle(raw);
      } catch (e) {
        onWarn(`${req.url} handler failed: ${e.message}`);
        if (!res.writableEnded) send(res, 500);
      }
    });
  }

  function receiveClientLog(req, res) {
    readJson(req, res, (raw) => {
      const entries = sanitizeClientEntries(raw);
      if (!entries) {
        if (!warnedBadPayload) onWarn('bad client log payload');
        warnedBadPayload = true;
        return send(res, 400);
      }
      send(res, 204);
      onClientLog(entries);
    });
  }

  async function serveStatic(req, res, urlPath) {
    const file = resolveSafePath(root, urlPath);
    if (!file) return send(res, 403);
    let stat;
    try {
      stat = await fs.stat(file);
    } catch {
      return send(res, 404);
    }
    if (!stat.isFile()) return send(res, 404);
    try {
      const type = { 'Content-Type': contentType(file) };
      if (path.basename(file) === 'index.html') {
        return send(res, 200, injectBridge(await fs.readFile(file, 'utf8')), type);
      }
      const body = await fs.readFile(file);
      res.writeHead(200, { ...NO_STORE, ...type, 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
      return body.length;
    } catch (e) {
      onWarn(`read failed ${urlPath}: ${e.message}`);
      return send(res, 500);
    }
  }

  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    const urlPath = req.url ?? '/';
    const pathname = urlPath.split(/[?#]/)[0];
    const trusted = isTrustedRequest({ host: req.headers.host, origin: req.headers.origin }, server.address().port);
    if (!trusted) return send(res, 403);
    const route = routes[`${req.method} ${pathname}`];
    if (route) {
      try {
        await route(req, res);
      } catch (e) {
        onWarn(`${pathname} failed: ${e.message}`);
        if (!res.headersSent) send(res, 500);
      }
      return;
    }
    if (pathname.startsWith('/__basie/')) return send(res, 404);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405);
    const bytes = await serveStatic(req, res, urlPath);
    onRequest({ method: req.method, path: urlPath, status: res.statusCode, bytes, ms: Date.now() - started, at: started });
  });

  const heartbeat = setInterval(() => clients.forEach(c => c.write(':\n\n')), HEARTBEAT_MS);
  heartbeat.unref();

  return {
    server,
    broadcast(event, data) {
      const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      clients.forEach(c => c.write(msg));
    },
    closeClients() {
      clearInterval(heartbeat);
      clients.forEach(c => c.end());
      clients.clear();
    },
  };
}
