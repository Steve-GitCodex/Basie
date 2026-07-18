import test from 'node:test';
import assert from 'node:assert/strict';

import { EventBus, eventBus } from '../../js/core/EventBus.js';

function silenceErrors(fn) {
  const original = console.error;
  console.error = () => {};
  try { return fn(); } finally { console.error = original; }
}

test('a listener receives the emitted payload', () => {
  const bus = new EventBus();
  const seen = [];
  bus.on('resources:tick', (d) => seen.push(d));
  bus.emit('resources:tick', { wood: 10 });
  assert.deepEqual(seen, [{ wood: 10 }]);
});

test('emitting an event with no listeners is a no-op', () => {
  const bus = new EventBus();
  assert.doesNotThrow(() => bus.emit('nobody:listening', 1));
});

test('every listener for an event fires, in registration order', () => {
  const bus = new EventBus();
  const order = [];
  bus.on('e', () => order.push('first'));
  bus.on('e', () => order.push('second'));
  bus.emit('e');
  assert.deepEqual(order, ['first', 'second']);
});

test('listeners of other events are not called', () => {
  const bus = new EventBus();
  let called = false;
  bus.on('other', () => { called = true; });
  bus.emit('e');
  assert.equal(called, false);
});

test('the same callback registered twice only fires once', () => {
  const bus = new EventBus();
  let count = 0;
  const cb = () => { count++; };
  bus.on('e', cb);
  bus.on('e', cb);
  bus.emit('e');
  assert.equal(count, 1);
});

test('on returns an unsubscribe function', () => {
  const bus = new EventBus();
  let count = 0;
  const off = bus.on('e', () => { count++; });
  bus.emit('e');
  off();
  bus.emit('e');
  assert.equal(count, 1);
});

test('off removes only the listener passed to it', () => {
  const bus = new EventBus();
  const seen = [];
  const a = () => seen.push('a');
  bus.on('e', a);
  bus.on('e', () => seen.push('b'));
  bus.off('e', a);
  bus.emit('e');
  assert.deepEqual(seen, ['b']);
});

test('off on an unknown event or listener is safe', () => {
  const bus = new EventBus();
  assert.doesNotThrow(() => bus.off('never:registered', () => {}));
});

test('a once listener fires exactly once', () => {
  const bus = new EventBus();
  let count = 0;
  bus.once('e', () => { count++; });
  bus.emit('e');
  bus.emit('e');
  assert.equal(count, 1);
});

test('a once listener receives the payload', () => {
  const bus = new EventBus();
  let payload = null;
  bus.once('e', (d) => { payload = d; });
  bus.emit('e', { id: 7 });
  assert.deepEqual(payload, { id: 7 });
});

test('a throwing listener does not stop the others', () => {
  const bus = new EventBus();
  const seen = [];
  bus.on('e', () => { throw new Error('boom'); });
  bus.on('e', () => seen.push('survivor'));
  silenceErrors(() => bus.emit('e'));
  assert.deepEqual(seen, ['survivor']);
});

test('a throwing listener never propagates out of emit', () => {
  const bus = new EventBus();
  bus.on('e', () => { throw new Error('boom'); });
  silenceErrors(() => assert.doesNotThrow(() => bus.emit('e')));
});

test('clear drops listeners for one event only', () => {
  const bus = new EventBus();
  const seen = [];
  bus.on('a', () => seen.push('a'));
  bus.on('b', () => seen.push('b'));
  bus.clear('a');
  bus.emit('a');
  bus.emit('b');
  assert.deepEqual(seen, ['b']);
});

test('clear with no argument drops every listener', () => {
  const bus = new EventBus();
  const seen = [];
  bus.on('a', () => seen.push('a'));
  bus.on('b', () => seen.push('b'));
  bus.clear();
  bus.emit('a');
  bus.emit('b');
  assert.deepEqual(seen, []);
});

test('the exported eventBus is a shared EventBus instance', () => {
  assert.ok(eventBus instanceof EventBus);
});
