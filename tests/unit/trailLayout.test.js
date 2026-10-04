import test from 'node:test';
import assert from 'node:assert/strict';

import { CAMPAIGN_STAGES, trailStages } from '../../js/systems/campaign/campaignStages.js';
import { trailLayout } from '../../js/ui/combat/trailLayout.js';

const road = () => trailStages();

test('nodes climb upward in trail order', () => {
  const { nodes } = trailLayout(CAMPAIGN_STAGES, { width: 360 });
  const roadIds = road().map(s => s.id);
  const ys = roadIds.map(id => nodes.find(n => n.id === id).y);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] < ys[i - 1]);
});

test('chapter change adds a band and the extra gap', () => {
  const { nodes, bands } = trailLayout(CAMPAIGN_STAGES, { width: 360 });
  const chapters = new Set(road().map(s => s.chapter));
  assert.equal(bands.length, chapters.size);
  const byId = id => nodes.find(n => n.id === id);
  const sameChapterStep = byId('ch1_s1').y - byId('ch1_s2').y;
  const bossToNext = byId(road().find(s => s.chapter === 1 && s.kind === 'boss').id).y - byId('ch2_s1').y;
  assert.equal(sameChapterStep, 64);
  assert.ok(Math.abs(bossToNext - (64 * 1.3 + 90)) < 1e-9);
  assert.ok(bands[1].y < bands[0].y);
});

test('bosses swing less than regular nodes', () => {
  const width = 900;
  const { nodes } = trailLayout(CAMPAIGN_STAGES, { width });
  const swing = kind => Math.max(...nodes.filter(n => n.kind === kind).map(n => Math.abs(n.x - width / 2)));
  assert.ok(swing('boss') < swing('regular'));
});

test('pathThrough starts at the first node and ends at the last', () => {
  const layout = trailLayout(CAMPAIGN_STAGES, { width: 360 });
  const ids = road().map(s => s.id);
  const d = layout.pathThrough(ids);
  const first = layout.nodes.find(n => n.id === ids[0]);
  const last = layout.nodes.find(n => n.id === ids[ids.length - 1]);
  const start = d.match(/^M([-\d.]+),([-\d.]+)/);
  assert.deepEqual([Number(start[1]), Number(start[2])], [first.x, first.y]);
  const end = d.match(/([-\d.]+),([-\d.]+)$/);
  assert.deepEqual([Number(end[1]), Number(end[2])], [last.x, last.y]);
  assert.equal(layout.pathThrough(['ch1_s1']), '');
});

test('elites sit beside their boss and are not on the road path', () => {
  const layout = trailLayout(CAMPAIGN_STAGES, { width: 360 });
  const elites = CAMPAIGN_STAGES.filter(s => s.kind === 'elite');
  assert.ok(elites.length > 0);
  elites.forEach(elite => {
    const boss = layout.nodes.find(n => n.kind === 'boss' && n.chapter === elite.chapter);
    const node = layout.nodes.find(n => n.id === elite.id);
    assert.equal(node.y, boss.y);
    assert.equal(Math.abs(node.x - boss.x), 70);
    assert.equal(Math.sign(node.x - boss.x), boss.x < 180 ? 1 : -1);
    const spur = layout.spurs.find(s => s.eliteId === elite.id);
    assert.equal(spur.bossId, boss.id);
    assert.equal(spur.d, `M${boss.x},${boss.y} L${node.x},${node.y}`);
  });
  const roadPath = layout.pathThrough(road().map(s => s.id));
  assert.equal(roadPath.split('C').length - 1, road().length - 1);
});

test('all x within [0, width]', () => {
  [360, 900].forEach(width => {
    const { nodes } = trailLayout(CAMPAIGN_STAGES, { width });
    nodes.forEach(n => assert.ok(n.x >= 0 && n.x <= width, `${n.id} x=${n.x}`));
  });
});
