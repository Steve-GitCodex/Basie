import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';

import { startHotkeys } from '../../scripts/launcher/hotkeys.mjs';

function fakeTty() {
  const input = new PassThrough();
  input.isTTY = true;
  input.setRawMode = () => input;
  return { input, output: new PassThrough() };
}

const settle = (p, ms = 500) => Promise.race([p, new Promise(r => setTimeout(() => r('TIMEOUT'), ms))]);
const tick = () => new Promise(r => setTimeout(r, 20));

test('no hotkeys without a TTY', () => {
  const input = new PassThrough();
  assert.equal(startHotkeys({ onKey: () => {}, input, output: new PassThrough() }), null);
});

test('keys are lower-cased and Ctrl+C maps to quit', async () => {
  const { input, output } = fakeTty();
  const keys = [];
  const hk = startHotkeys({ onKey: (k) => keys.push(k), input, output });
  input.write('O');
  input.write('\x03');
  await tick();
  assert.deepEqual(keys, ['o', 'q']);
  hk.close();
});

test('the prompt returns the typed answer and hotkeys resume', async () => {
  const { input, output } = fakeTty();
  const keys = [];
  const hk = startHotkeys({ onKey: (k) => keys.push(k), input, output });
  const answer = hk.prompt('name: ');
  input.write('world\r');
  assert.equal(await settle(answer), 'world');
  input.write('d');
  await tick();
  assert.deepEqual(keys, ['d']);
  hk.close();
});

test('Ctrl+C during the prompt cancels it instead of freezing the launcher', async () => {
  const { input, output } = fakeTty();
  const keys = [];
  const hk = startHotkeys({ onKey: (k) => keys.push(k), input, output });
  const answer = hk.prompt('name: ');
  input.write('\x03');
  assert.equal(await settle(answer), '');
  input.write('o');
  await tick();
  assert.deepEqual(keys, ['o']);
  hk.close();
});
