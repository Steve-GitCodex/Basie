import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCampaignStages, lineupPower } from '../../js/systems/campaign/stageGenerator.js';
import { CAMPAIGNS_CONFIG, MONSTERS_CONFIG } from '../../js/entities/data/combat.js';
import { CAMPAIGN_CHAPTER_KNOBS } from '../../js/entities/data/campaign.js';
import { BUILDING_CURVE, ERA_HQ, HQ_MAX } from '../../js/entities/data/buildingCurve.js';
import { costFactor, timeFactor, prodFactor, levelCap, minHqForLevel } from '../../js/systems/building/buildingCurve.js';

const FIXTURE_HQ_MAX = HQ_MAX + 5;
const FIXTURE_ERA_HQ = [...ERA_HQ, HQ_MAX];

function fixtureChapter() {
  const lastEntry = CAMPAIGNS_CONFIG.at(-1);
  const lastBoss = MONSTERS_CONFIG[lastEntry.monsterId];
  const boss = structuredClone(lastBoss);
  boss.id = 'fixture_overlord';
  boss.name = 'Fixture Overlord';
  for (const wave of boss.waves) for (const s of wave.stacks) s.count *= 2;
  const entry = {
    stage: CAMPAIGNS_CONFIG.length + 1,
    monsterId: boss.id,
    name: 'Fixture Frontier',
    icon: '🧪',
    requires: { townhall: FIXTURE_ERA_HQ.at(-1), heroquarters: lastEntry.requires.heroquarters },
  };
  return { chapters: [...CAMPAIGNS_CONFIG, entry], monsters: { ...MONSTERS_CONFIG, [boss.id]: boss }, boss, lastBoss };
}

test('a synthetic chapter appended to the data builds its stages with no code change', () => {
  const { chapters, monsters, boss, lastBoss } = fixtureChapter();
  const chapter = chapters.length;
  const stages = buildCampaignStages(chapters, monsters, CAMPAIGN_CHAPTER_KNOBS);
  const added = stages.filter(s => s.chapter === chapter);

  assert.deepEqual(added.map(s => s.kind), [...Array(CAMPAIGN_CHAPTER_KNOBS.regularCount).fill('regular'), 'boss', 'elite']);
  assert.equal(added.find(s => s.kind === 'boss').id, boss.id);
  assert.ok(added.every(s => s.requires.townhall === FIXTURE_ERA_HQ.at(-1)));
  assert.equal(new Set(stages.map(s => s.id)).size, stages.length);
  const firstRegular = added.find(s => s.kind === 'regular');
  assert.ok(lineupPower(firstRegular.monster.waves) >= lineupPower(lastBoss.waves) * CAMPAIGN_CHAPTER_KNOBS.regularScale.from);
  assert.ok(added[0].firstClear.diamond > stages.find(s => s.chapter === chapter - 1).firstClear.diamond);
});

const FIXTURE_CURVE = {
  costBands: [...BUILDING_CURVE.costBands, [FIXTURE_HQ_MAX, 1.2]],
  timeBands: [...BUILDING_CURVE.timeBands, [FIXTURE_HQ_MAX, 1.1]],
  prodBands: [...BUILDING_CURVE.prodBands.slice(0, -1), [FIXTURE_HQ_MAX, BUILDING_CURVE.prodBands.at(-1)[1]]],
};

test(`with an appended band the curves stay defined and rising to HQ_MAX ${FIXTURE_HQ_MAX}`, () => {
  for (let level = 2; level <= FIXTURE_HQ_MAX; level++) {
    for (const factor of [costFactor, timeFactor, prodFactor]) {
      const now = factor(level, FIXTURE_CURVE);
      assert.ok(Number.isFinite(now), `${factor.name}(${level}) is not finite`);
      assert.ok(now > factor(level - 1, FIXTURE_CURVE), `${factor.name} plateaus at ${level}`);
    }
  }
});

test('the appended band leaves every existing level unchanged', () => {
  for (let level = 1; level <= HQ_MAX; level++) {
    assert.equal(costFactor(level, FIXTURE_CURVE), costFactor(level));
    assert.equal(timeFactor(level, FIXTURE_CURVE), timeFactor(level));
    assert.equal(prodFactor(level, FIXTURE_CURVE), prodFactor(level));
  }
});

test('without a new band the shipped curve stops growing past HQ_MAX', () => {
  assert.equal(costFactor(FIXTURE_HQ_MAX), costFactor(HQ_MAX));
});

test(`levelCap and minHqForLevel follow a raised HQ_MAX of ${FIXTURE_HQ_MAX}`, () => {
  const top = { maxLevel: FIXTURE_HQ_MAX };
  const shorter = { maxLevel: HQ_MAX - 5 };
  for (let hq = 1; hq <= FIXTURE_HQ_MAX; hq++) {
    assert.equal(levelCap(top, hq, FIXTURE_HQ_MAX), hq);
    assert.ok(levelCap(shorter, hq, FIXTURE_HQ_MAX) >= levelCap(shorter, hq - 1 || 1, FIXTURE_HQ_MAX));
  }
  assert.equal(levelCap(shorter, FIXTURE_HQ_MAX, FIXTURE_HQ_MAX), shorter.maxLevel);
  for (let level = 1; level <= FIXTURE_HQ_MAX; level++) {
    const hq = minHqForLevel(top, level, FIXTURE_HQ_MAX);
    assert.equal(hq, level);
    assert.ok(levelCap(top, hq, FIXTURE_HQ_MAX) >= level);
  }
});
