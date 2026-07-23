import test from 'node:test';
import assert from 'node:assert/strict';

import { CityAgents, pickDockKey, bfsFarthest, bfsPath, faceLeft, pingPong } from '../../js/ui/city/cityAgents.js';
import { roadGraph } from '../../js/ui/city/cityRoads.js';

// A straight 5-cell road row: (0,0)-(4,0)
const straight = roadGraph(new Set(['0,0', '1,0', '2,0', '3,0', '4,0']));

test('pickDockKey returns the corner-most road cell deterministically', () => {
  assert.equal(pickDockKey(['4,0', '2,0', '0,0', '3,0']), '0,0');
  assert.equal(pickDockKey([]), null);
});

test('bfsFarthest finds the hop-farthest reachable cell', () => {
  assert.equal(bfsFarthest(straight, '0,0'), '4,0');
});

test('bfsPath returns an inclusive contiguous shortest path', () => {
  assert.deepEqual(bfsPath(straight, '0,0', '4,0'), ['0,0', '1,0', '2,0', '3,0', '4,0']);
  assert.deepEqual(bfsPath(straight, '2,0', '2,0'), ['2,0']);
  assert.deepEqual(bfsPath(straight, '0,0', '9,9'), ['0,0'], 'unreachable target degrades to [from]');
});

test('faceLeft is true when iso screen-x decreases', () => {
  assert.equal(faceLeft({ col: 1, row: 0 }, { col: 0, row: 0 }), true);   // -x
  assert.equal(faceLeft({ col: 0, row: 0 }, { col: 1, row: 0 }), false);  // +x
  assert.equal(faceLeft({ col: 0, row: 0 }, { col: 0, row: 1 }), true);   // row+ moves screen-left
});

test('pingPong reflects within [0, span]', () => {
  assert.equal(pingPong(0, 4), 0);
  assert.equal(pingPong(4, 4), 4);
  assert.equal(pingPong(6, 4), 2, 'past the far end it reflects back');
  assert.equal(pingPong(8, 4), 0, 'a full there-and-back returns to start');
  assert.equal(pingPong(3, 0), 0, 'zero span stays at 0');
});

const roadRow = new Set(['0,0', '1,0', '2,0', '3,0', '4,0']);

test('setRoads docks at the corner cell and builds a road-following drone path', () => {
  const a = new CityAgents(null);
  a.setRoads(roadRow);
  assert.deepEqual(a.truckTile(), { col: 0, row: 0 });
  const path = a._dronePath.map((p) => `${p.col},${p.row}`);
  assert.deepEqual(path, ['0,0', '0.5,0', '1,0', '1.5,0', '2,0'], 'dock→far via road cells (tile = cell/2)');
});

test('drone ping-pongs along the path and stays within bounds', () => {
  const a = new CityAgents(null);
  a.setRoads(roadRow);
  const span = a._dronePath.length - 1;
  a._droneT = 0;        assert.deepEqual(a.dronePos(), a._dronePath[0]);
  a._droneT = span;     assert.deepEqual(a.dronePos(), a._dronePath[span]);
  a._droneT = span * 2; assert.deepEqual(a.dronePos(), a._dronePath[0], 'there-and-back returns home');
});

test('each walker gets a sprite-pool index', () => {
  const a = new CityAgents(null);
  a.setRoads(roadRow);
  assert.ok(a.walkers.every((w) => Number.isInteger(w.sprite)));
});
