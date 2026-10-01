import test from 'node:test';
import assert from 'node:assert/strict';

import { SKILLS_CONFIG } from '../../js/entities/GAME_DATA.js';
import {
  skillEffectKinds,
  skillEffectActivation,
  skillDormancy,
  activeSkillCountAt,
  isPayingPosting,
} from '../../js/systems/hero/heroSkillActivation.js';

function heroAt(buildingId) {
  return { heroId: 'kaelenthorne', level: 30, stars: 0, assignment: buildingId ? { type: 'building', buildingId } : { type: 'none' } };
}

test('effect kinds ignore structural keys and see bare triggered keys', () => {
  assert.deepEqual(skillEffectKinds(SKILLS_CONFIG.charge), ['attackBonus']);
  assert.deepEqual(skillEffectKinds(SKILLS_CONFIG.battle_cry), ['attack']);
  assert.deepEqual(skillEffectKinds(SKILLS_CONFIG.safe_route), ['lossReduction']);
  assert.deepEqual(skillEffectKinds(SKILLS_CONFIG.wastelands_bounty).sort(), ['resourceOutput', 'trainingSpeed']);
});

test('a combat skill is dormant outside a barracks or the Hero Quarters', () => {
  const [entry] = skillEffectActivation(heroAt('farm_0'), SKILLS_CONFIG.grit);
  assert.equal(entry.kind, 'lossReduction');
  assert.equal(entry.active, false);
  assert.match(entry.requirement, /barracks|Hero Quarters/i);
});

test('a combat skill is live in a barracks and in the Hero Quarters', () => {
  for (const posting of ['barracks_0', 'heroquarters_0']) {
    const [entry] = skillEffectActivation(heroAt(posting), SKILLS_CONFIG.grit);
    assert.equal(entry.active, true, `${posting} should pay combat effects`);
  }
});

test('a resource skill pays in any resource building and nowhere else', () => {
  for (const posting of ['farm_0', 'mine_0', 'bank_0', 'lumbermill_0', 'quarry_0']) {
    const [entry] = skillEffectActivation(heroAt(posting), SKILLS_CONFIG.scavenge);
    assert.equal(entry.active, true, `${posting} should pay resourceOutput`);
  }
  assert.equal(skillEffectActivation(heroAt('workshop_0'), SKILLS_CONFIG.scavenge)[0].active, false);
});

test('trainingSpeed pays in a barracks, researchSpeed in the workshop, not the reverse', () => {
  assert.equal(skillEffectActivation(heroAt('barracks_0'), SKILLS_CONFIG.trail_marks)[0].active, true);
  assert.equal(skillEffectActivation(heroAt('workshop_0'), SKILLS_CONFIG.trail_marks)[0].active, false);
  assert.equal(skillEffectActivation(heroAt('workshop_0'), SKILLS_CONFIG.arcane_archive)[0].active, true);
  assert.equal(skillEffectActivation(heroAt('barracks_0'), SKILLS_CONFIG.arcane_archive)[0].active, false);
});

test('an unassigned hero has every effect dormant', () => {
  const d = skillDormancy(heroAt(null), SKILLS_CONFIG.wastelands_bounty);
  assert.equal(d.isFullyDormant, true);
  assert.equal(d.isPartlyDormant, false);
});

test('a two-context skill reports per-effect state, not one state for the whole skill', () => {
  const inFarm = skillDormancy(heroAt('farm_0'), SKILLS_CONFIG.wastelands_bounty);
  assert.equal(inFarm.isPartlyDormant, true, 'a farm pays resourceOutput but not trainingSpeed');
  assert.equal(inFarm.entries.find(e => e.kind === 'resourceOutput').active, true);
  assert.equal(inFarm.entries.find(e => e.kind === 'trainingSpeed').active, false);

  const inBarracks = skillDormancy(heroAt('barracks_0'), SKILLS_CONFIG.wastelands_bounty);
  assert.equal(inBarracks.entries.find(e => e.kind === 'resourceOutput').active, false);
  assert.equal(inBarracks.entries.find(e => e.kind === 'trainingSpeed').active, true,
    'the same skill must swap which half pays when the posting changes');
});

test('the dormancy requirement names a real building the player can act on', () => {
  const [entry] = skillEffectActivation(heroAt('farm_0'), SKILLS_CONFIG.arcane_archive);
  assert.match(entry.requirement, /workshop/i);
});

function rosterHero(skills, buildingId = null) {
  return { ...heroAt(buildingId), skills: { passive: skills, support: [], major: [] } };
}

const unlockedSkill = id => ({ ...SKILLS_CONFIG[id], unlocked: true });
const lockedSkill   = id => ({ ...SKILLS_CONFIG[id], unlocked: false });

test('an explicit posting overrides where the hero actually stands', () => {
  const [entry] = skillEffectActivation(heroAt('farm_0'), SKILLS_CONFIG.grit, 'barracks');
  assert.equal(entry.active, true);
});

test('omitting the posting still reads the hero\'s real assignment', () => {
  assert.equal(skillEffectActivation(heroAt('barracks_0'), SKILLS_CONFIG.grit)[0].active, true);
  assert.equal(skillEffectActivation(heroAt('farm_0'), SKILLS_CONFIG.grit)[0].active, false);
});

test('activeSkillCountAt counts only unlocked skills that pay at that building', () => {
  const hero = rosterHero([unlockedSkill('scavenge'), unlockedSkill('grit'), lockedSkill('trail_marks')]);
  assert.equal(activeSkillCountAt(hero, 'farm'), 1);
  assert.equal(activeSkillCountAt(hero, 'barracks'), 1);
});

test('a skill with two payers counts once at either payer', () => {
  const hero = rosterHero([unlockedSkill('wastelands_bounty')]);
  assert.equal(activeSkillCountAt(hero, 'farm'), 1);
  assert.equal(activeSkillCountAt(hero, 'barracks'), 1);
});

test('a building that pays none of the hero\'s skills counts zero', () => {
  const hero = rosterHero([unlockedSkill('scavenge'), unlockedSkill('grit')]);
  assert.equal(activeSkillCountAt(hero, 'workshop'), 0);
});

test('a hero without skills counts zero rather than throwing', () => {
  assert.equal(activeSkillCountAt({ assignment: { type: 'none' } }, 'farm'), 0);
});

test('isPayingPosting is true for heroquarters, storehouse and farm, false for house', () => {
  assert.equal(isPayingPosting('heroquarters'), true);
  assert.equal(isPayingPosting('storehouse'), true);
  assert.equal(isPayingPosting('farm'), true);
  assert.equal(isPayingPosting('house'), false);
});
