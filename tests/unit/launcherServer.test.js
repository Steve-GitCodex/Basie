import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

import { createLauncherServer } from '../../scripts/launcher/server.mjs';

async function start(onClientLog = () => {}) {
  const s = createLauncherServer({ root: process.cwd(), onRequest: () => {}, onClientLog, onWarn: () => {} });
  s.server.listen(0, '127.0.0.1');
  await once(s.server, 'listening');
  const base = `http://127.0.0.1:${s.server.address().port}`;
  return { s, base, stop: () => { s.closeClients(); s.server.close(); } };
}

test('a malformed client log entry does not take the launcher down', async () => {
  const seen = [];
  const { base, stop } = await start((entries) => seen.push(...entries));
  try {
    await fetch(`${base}/__basie/log`, { method: 'POST', body: '[null, {"message":"ok"}]' });
    const ping = await fetch(`${base}/__basie/ping`);
    assert.equal(ping.status, 200);
    assert.deepEqual(seen.map(e => e.message), ['ok']);
  } finally { stop(); }
});

test('a cross-origin log POST is refused', async () => {
  const seen = [];
  const { base, stop } = await start((entries) => seen.push(...entries));
  try {
    const res = await fetch(`${base}/__basie/log`, {
      method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'text/plain' }, body: '[{"message":"x"}]',
    });
    assert.equal(res.status, 403);
    assert.equal(seen.length, 0);
  } finally { stop(); }
});
