import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BUILDINGS_CONFIG, CATEGORY_ZONE,
  BUILD_RECT, inBounds, WORLD_MAP, MONSTERS_CONFIG,
  ACHIEVEMENTS_CONFIG, HEROES_CONFIG,
  SHOP_CONFIG, INVENTORY_ITEMS, PROD_BONUS_CONFIG, STAT_RULES,
  SURVIVAL_MONSTER, COMBAT_RULES, UNITS_CONFIG,
  DIAMOND_PACKAGES, findShopEntry,
  TRADER_POOL, FEATURED_ENTRY_IDS, BUFF_STATS, HQ_UNLOCK_TABLE,
  UNIT_TIER_REQUIREMENTS, TECH_CONFIG, QUEUE_CONFIG, CAMPAIGNS_CONFIG, TAB_UNLOCK_CONDITIONS, XP_CONFIG,
  POPULATION_MAX,
} from '../../js/entities/GAME_DATA.js';
import { levelCap, minHqForLevel } from '../../js/systems/building/buildingCurve.js';

const allShopEntries = () => [
  ...SHOP_CONFIG.supply.flatMap(c => c.items),
  ...SHOP_CONFIG.premium.packs,
  ...SHOP_CONFIG.premium.unlocks,
];

const RESOURCE_KEYS = new Set(['wood', 'stone', 'iron', 'food', 'water', 'money']);

const buildings = Object.values(BUILDINGS_CONFIG);

test('every building category maps to a blueprint zone', () => {
  for (const b of buildings) {
    assert.ok(CATEGORY_ZONE[b.category], `${b.id} has unmapped category '${b.category}'`);
  }
});

test('every building declares a footprint that fits the buildable rect', () => {
  for (const b of buildings) {
    assert.ok(Array.isArray(b.footprint) && b.footprint.length === 2, `${b.id} footprint shape`);
    const [w, h] = b.footprint;
    assert.ok(w > 0 && h > 0, `${b.id} footprint positive`);
    assert.ok(inBounds(0, 0, w, h), `${b.id} footprint ${w}x${h} exceeds ${BUILD_RECT.w}x${BUILD_RECT.h}`);
  }
});

test('total footprint area fits inside the buildable rect with slack', () => {
  let cells = 0;
  for (const b of buildings) {
    const [w, h] = b.footprint;
    cells += w * h * (b.maxInstances ?? b.instanceSlots?.length ?? 1);
  }
  assert.ok(cells < BUILD_RECT.w * BUILD_RECT.h * 0.75,
    `packed footprints (${cells} cells) leave too little room in ${BUILD_RECT.w * BUILD_RECT.h}`);
});

test('building requirement refs point at real building ids', () => {
  for (const b of buildings) {
    for (const reqId of Object.keys(b.requires ?? {})) {
      if (reqId === 'population') continue;
      assert.ok(BUILDINGS_CONFIG[reqId], `${b.id} requires unknown building '${reqId}'`);
    }
  }
});

test('instance slot conditions point at real building ids', () => {
  for (const b of buildings) {
    for (const slot of b.instanceSlots ?? []) {
      for (const reqId of Object.keys(slot.condition ?? {})) {
        assert.ok(BUILDINGS_CONFIG[reqId], `${b.id} slot ${slot.index} needs unknown '${reqId}'`);
      }
    }
  }
});

test('instanceSlots count matches maxInstances', () => {
  for (const b of buildings) {
    if (!b.instanceSlots) continue;
    assert.equal(b.instanceSlots.length, b.maxInstances ?? 1, `${b.id} slot count`);
  }
});

test('building cost keys are known resources', () => {
  for (const b of buildings) {
    for (const key of Object.keys(b.baseCost ?? {})) {
      assert.ok(RESOURCE_KEYS.has(key), `${b.id} baseCost has unknown resource '${key}'`);
    }
  }
});

test('townhall storage caps cover every level and every resource', () => {
  const { storageCap, maxLevel } = BUILDINGS_CONFIG.townhall;
  for (const key of Object.keys(storageCap)) {
    assert.ok(RESOURCE_KEYS.has(key), `storageCap has unknown resource '${key}'`);
    assert.equal(storageCap[key].length, maxLevel + 1, `storageCap.${key} length`);
  }
});

test('world map POI ids are unique', () => {
  const seen = new Set();
  for (const poi of WORLD_MAP.pois) {
    assert.ok(!seen.has(poi.id), `duplicate POI id '${poi.id}'`);
    seen.add(poi.id);
  }
});

test('every POI belongs to a declared region and sits in world bounds', () => {
  const regionIds = new Set(WORLD_MAP.regions.map(r => r.id));
  for (const poi of WORLD_MAP.pois) {
    assert.ok(regionIds.has(poi.regionId), `POI '${poi.id}' has unknown region '${poi.regionId}'`);
    assert.ok(poi.x >= 0 && poi.x <= WORLD_MAP.bounds.w, `POI '${poi.id}' x out of bounds`);
    assert.ok(poi.y >= 0 && poi.y <= WORLD_MAP.bounds.h, `POI '${poi.id}' y out of bounds`);
  }
});

test('resource node POIs declare a known resource', () => {
  for (const poi of WORLD_MAP.pois.filter(p => p.type === 'resource_node')) {
    assert.ok(RESOURCE_KEYS.has(poi.resource), `node '${poi.id}' yields unknown '${poi.resource}'`);
  }
});

test('region buffs on economic flavor name a known resource', () => {
  for (const region of WORLD_MAP.regions) {
    if (region.buff?.flavor !== 'economic') continue;
    assert.ok(RESOURCE_KEYS.has(region.buff.resource), `region '${region.id}' buff resource`);
  }
});

test('strongholds that capture a region reference a real region', () => {
  const regionIds = new Set(WORLD_MAP.regions.map(r => r.id));
  for (const poi of WORLD_MAP.pois) {
    if (!poi.capturesRegion) continue;
    assert.ok(regionIds.has(poi.capturesRegion), `POI '${poi.id}' captures unknown region`);
  }
});

// Save-key ids are frozen: display strings may be re-fictioned (grit reskin A4)
// but renaming an id orphans save state. @see docs/20-decisions/0017-a4-fiction-pass.md
test('save-key ids are unchanged by fiction passes', () => {
  const ids = obj => Object.keys(obj).sort();
  assert.deepEqual(
    WORLD_MAP.regions.map(r => r.id).sort(),
    ['command_ruin', 'dragon_spire', 'ember_reach', 'frost_hold', 'goblin_crest',
     'home_vale', 'mistwood', 'red_lowlands', 'west_warrens'],
  );
  assert.deepEqual(
    ids(WORLD_MAP.factions),
    ['bandits', 'goblins', 'neutral'],
  );
  assert.deepEqual(
    WORLD_MAP.pois.filter(p => !p.id.startsWith('gen_')).map(p => p.id).sort(),
    ['camp_red', 'camp_west', 'home_city', 'op_relay', 'op_shrine', 'op_tower',
     'rn_crest', 'rn_grain', 'rn_hunt', 'rn_ice', 'rn_iron', 'rn_oak', 'rn_ore',
     'rn_timber', 'rn_well', 'ruin_vale', 'ruin_warren', 'sh_crest', 'sh_dragon',
     'sh_ember', 'sh_frost', 'sh_mist', 'sh_red', 'sh_ruin', 'sh_west', 'wb_roc'],
  );
  assert.deepEqual(
    ids(MONSTERS_CONFIG),
    ['bandit_camp', 'chaos_titan', 'corrupted_arena', 'demon_gates', 'dragon_lair',
     'frost_giant', 'goblin_camp', 'orc_warband', 'troll_bridge', 'undead_legion'],
  );
});

test('hall_of_heroes achievement unlock count matches hero roster size', () => {
  const heroCount = Object.keys(HEROES_CONFIG).length;
  assert.equal(ACHIEVEMENTS_CONFIG.hall_of_heroes.count, heroCount,
    'hall_of_heroes count must match current HEROES_CONFIG size');
});

test('every shop entry references a real inventory item', () => {
  for (const entry of allShopEntries()) {
    if (!entry.itemId) continue;
    assert.ok(INVENTORY_ITEMS[entry.itemId], `shop sells unknown item '${entry.itemId}'`);
  }
});

test('every recruit token has at least one acquisition path', () => {
  const sold = new Set();
  for (const entry of allShopEntries()) if (entry.itemId) sold.add(entry.itemId);
  for (const tier of ['normal', 'epic', 'legendary']) {
    assert.ok(sold.has(`token_${tier}`),
      `token_${tier} is unreachable — no player can enter the hero economy`);
  }
});

test('no retired recruitment scroll is still for sale', () => {
  for (const entry of allShopEntries()) {
    assert.ok(!String(entry.itemId ?? '').startsWith('scroll_'),
      `retired item '${entry.itemId}' is still on sale and always fails on use`);
  }
});

const SKILL_PAID_EFFECTS = new Set(['buildSpeed', 'storageCap', 'constructionCost']);

test('every statEffectMap entry resolves to a known PROD_BONUS_CONFIG base key', () => {
  const resourceEffects = new Set(['money', 'food', 'wood', 'stone', 'iron']);
  for (const [buildingType, entry] of Object.entries(PROD_BONUS_CONFIG.statEffectMap)) {
    if (resourceEffects.has(entry.effect)) continue;
    if (SKILL_PAID_EFFECTS.has(entry.effect)) continue;
    assert.ok(PROD_BONUS_CONFIG.base[entry.effect] != null,
      `statEffectMap['${buildingType}'] maps to '${entry.effect}' with no base value`);
  }
});

test('paladin\'s buildingBonus resolves to the heroquarters posting', () => {
  assert.equal(HEROES_CONFIG.paladin.buildingBonus.buildingType, 'heroquarters');
  assert.equal(PROD_BONUS_CONFIG.statEffectMap.heroquarters.stat, HEROES_CONFIG.paladin.buildingBonus.stat);
});

test('every skill-paid effect has no base value', () => {
  for (const effect of SKILL_PAID_EFFECTS) {
    assert.equal(PROD_BONUS_CONFIG.base[effect], undefined, effect);
  }
});

const KNOWN_INERT_HERO_BUILDING_BONUSES = new Set();

test('every hero buildingBonus resolves to a live statEffectMap stat, or is on the known-inert allowlist', () => {
  for (const hero of Object.values(HEROES_CONFIG)) {
    const bb = hero.buildingBonus;
    if (!bb) continue;
    const mapped = PROD_BONUS_CONFIG.statEffectMap[bb.buildingType];
    const isLive = mapped?.stat === bb.stat;
    const isAllowlisted = KNOWN_INERT_HERO_BUILDING_BONUSES.has(`${hero.id}:${bb.buildingType}`);
    assert.ok(isLive || isAllowlisted,
      `${hero.id}'s buildingBonus (${bb.buildingType} → ${bb.stat}) no longer resolves to a live PROD_BONUS_CONFIG effect and is not on the known-inert allowlist`);
  }
});

test('every STAT_RULES stat has caps in (0, 1] and a totalCap in (0, 1)', () => {
  for (const [stat, rule] of Object.entries(STAT_RULES)) {
    assert.ok(rule.totalCap > 0 && rule.totalCap < 1, `${stat} totalCap ${rule.totalCap}`);
    for (const [category, { cap }] of Object.entries(rule.categories)) {
      assert.ok(cap > 0 && cap <= 1, `${stat}.${category} cap ${cap}`);
    }
  }
});

test('every non-resource statEffectMap effect has a STAT_RULES entry with a hero category', () => {
  for (const { effect } of Object.values(PROD_BONUS_CONFIG.statEffectMap)) {
    if (RESOURCE_KEYS.has(effect)) continue;
    assert.ok(STAT_RULES[effect]?.categories.hero, `${effect} lacks a STAT_RULES hero category`);
  }
});

const allMonsterWaves = [
  ...Object.values(MONSTERS_CONFIG).flatMap((m) => m.waves.map((w) => ({ id: m.id, wave: w }))),
  { id: SURVIVAL_MONSTER.id, wave: SURVIVAL_MONSTER.baseWave },
];

test('every monster stack has a valid tier, type and row', () => {
  for (const { id, wave } of allMonsterWaves) {
    assert.ok(Array.isArray(wave.stacks) && wave.stacks.length >= 1, `${id}/${wave.name} has no stacks`);
    for (const s of wave.stacks) {
      const label = `${id}/${wave.name}/${s.name}`;
      assert.ok(Number.isInteger(s.tier) && s.tier >= 1 && s.tier <= 10, `${label} tier`);
      assert.ok(s.type in UNITS_CONFIG, `${label} type '${s.type}'`);
      assert.ok(COMBAT_RULES.ROWS.includes(s.row), `${label} row '${s.row}'`);
      assert.ok(s.hp > 0 && s.attack > 0 && s.count > 0, `${label} hp/attack/count`);
    }
  }
});

test('MONSTER_TIERS has ten ascending defense values', () => {
  const defenses = COMBAT_RULES.MONSTER_TIERS.map((t) => t.defense);
  assert.equal(defenses.length, 10);
  for (let i = 1; i < defenses.length; i++) assert.ok(defenses[i] > defenses[i - 1], `tier ${i + 1} ascends`);
});

test('every SHOP_CONFIG entry has a unique entryId and resolves to an INVENTORY_ITEMS id or DIAMOND_PACKAGES id', () => {
  const seen = new Set();
  const packageIds = new Set(DIAMOND_PACKAGES.map(p => p.id));
  for (const entry of allShopEntries()) {
    assert.ok(entry.entryId, 'entry missing entryId');
    assert.ok(!seen.has(entry.entryId), `duplicate entryId '${entry.entryId}'`);
    seen.add(entry.entryId);
    const ok = entry.itemId ? INVENTORY_ITEMS[entry.itemId] : packageIds.has(entry.diamondPackageId);
    assert.ok(ok, `entry '${entry.entryId}' resolves to nothing`);
  }
});

test('SHOP_CONFIG.supply category ids are exactly heroes, speedups, resources, boosts', () => {
  assert.deepEqual(SHOP_CONFIG.supply.map(c => c.id).sort(), ['boosts', 'heroes', 'resources', 'speedups']);
});

test('the 500 diamond pack is badged Popular and no entry says Best Value', () => {
  const pack = findShopEntry('diamonds_500');
  assert.equal(pack.badge, 'Popular');
  for (const entry of allShopEntries()) {
    assert.notEqual(entry.badge, 'Best Value');
    if (entry.entryId !== 'diamonds_500') assert.notEqual(entry.badge, 'Popular');
  }
});

test('cafeteria_automation costs 200 diamonds and sits in premium.unlocks', () => {
  const entry = SHOP_CONFIG.premium.unlocks.find(e => e.entryId === 'cafeteria_automation');
  assert.ok(entry);
  assert.equal(entry.diamondCost, 200);
});

test('every TRADER_POOL item exists in INVENTORY_ITEMS and has a worth or a Supply moneyCost', () => {
  for (const row of TRADER_POOL) {
    assert.ok(INVENTORY_ITEMS[row.itemId], `trader pool item '${row.itemId}' unknown`);
    assert.ok(row.weight > 0, `${row.itemId} weight`);
    const supply = SHOP_CONFIG.supply.flatMap(c => c.items).find(e => e.itemId === row.itemId);
    assert.ok(row.worth > 0 || supply?.moneyCost > 0, `${row.itemId} has no worth`);
  }
});

test('FEATURED_ENTRY_IDS all resolve via findShopEntry', () => {
  assert.equal(FEATURED_ENTRY_IDS.length, 3);
  for (const id of FEATURED_ENTRY_IDS) assert.ok(findShopEntry(id), `featured '${id}' unresolved`);
});

test('every buff item declares a known stat', () => {
  for (const it of Object.values(INVENTORY_ITEMS).filter(i => i.type === 'buff')) assert.ok(BUFF_STATS[it.stat], it.id);
});

const NON_BUILDING_REQUIREMENT_KEYS = new Set(['population']);

function requirementProblems(owner, field, reqs, { allowNonBuilding = false } = {}) {
  const problems = [];
  for (const [key, level] of Object.entries(reqs ?? {})) {
    const target = BUILDINGS_CONFIG[key];
    if (!target) {
      if (!(allowNonBuilding && NON_BUILDING_REQUIREMENT_KEYS.has(key))) {
        problems.push(`${owner} ${field} names unknown building '${key}'`);
      }
    } else if (level > target.maxLevel) {
      problems.push(`${owner} ${field} needs ${key} L${level} above its maxLevel ${target.maxLevel}`);
    }
  }
  return problems;
}

test('building per-level tables cover every level up to maxLevel', () => {
  const problems = [];
  for (const b of buildings) {
    const indexedByLevel = [
      ...Object.entries(b.storageCap ?? {}).map(([k, arr]) => [`storageCap.${k}`, arr]),
      ['foodCapacityPerLevel', b.foodCapacityPerLevel],
      ['waterCapacityPerLevel', b.waterCapacityPerLevel],
    ];
    for (const [field, arr] of indexedByLevel) {
      if (arr && arr.length < b.maxLevel + 1) {
        problems.push(`${b.id} ${field} length ${arr.length} < maxLevel+1 (${b.maxLevel + 1})`);
      }
    }
    for (const field of ['levelStats', 'trainingSlots']) {
      if (b[field] && b[field].length < b.maxLevel) {
        problems.push(`${b.id} ${field} length ${b[field].length} < maxLevel (${b.maxLevel})`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('building level requirements and conditions stay within referenced maxLevels', () => {
  const problems = [];
  for (const b of buildings) {
    problems.push(...requirementProblems(b.id, 'requires', b.requires));
    for (const [lv, reqs] of Object.entries(b.levelRequirements ?? {})) {
      if (Number(lv) > b.maxLevel) problems.push(`${b.id} levelRequirements key ${lv} > maxLevel ${b.maxLevel}`);
      problems.push(...requirementProblems(b.id, `levelRequirements[${lv}]`, reqs, { allowNonBuilding: true }));
    }
    for (const slot of b.instanceSlots ?? []) {
      problems.push(...requirementProblems(b.id, `instanceSlots[${slot.index}].condition`, slot.condition));
    }
  }
  assert.deepEqual(problems, []);
});

test('HQ_UNLOCK_TABLE keys do not exceed townhall maxLevel', () => {
  const over = Object.keys(HQ_UNLOCK_TABLE).filter(lv => Number(lv) > BUILDINGS_CONFIG.townhall.maxLevel);
  assert.deepEqual(over, [], `HQ_UNLOCK_TABLE keys above townhall.maxLevel: ${over}`);
});

test('every levelRequirements entry is satisfiable under the HQ cap rule', () => {
  const problems = [];
  for (const b of buildings) {
    for (const [lv, reqs] of Object.entries(b.levelRequirements ?? {})) {
      const level = Number(lv);
      const hqNeeded = b.id === 'townhall' ? level : minHqForLevel(b, level);
      for (const [key, need] of Object.entries(reqs)) {
        const target = BUILDINGS_CONFIG[key];
        if (!target) continue;
        const reachable = levelCap(target, hqNeeded);
        if (need > reachable) problems.push(`${b.id} L${level} needs ${key} ${need}, but ${key} caps at ${reachable} under HQ ${hqNeeded}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('building unlock requirements and slot conditions are reachable at the HQ they name', () => {
  const problems = [];
  const check = (owner, field, reqs) => {
    const hq = reqs?.townhall ?? 1;
    for (const [key, need] of Object.entries(reqs ?? {})) {
      const target = BUILDINGS_CONFIG[key];
      if (!target || key === 'townhall') continue;
      if (need > levelCap(target, hq)) problems.push(`${owner} ${field}: ${key} ${need} exceeds cap ${levelCap(target, hq)} at HQ ${hq}`);
    }
  };
  for (const b of buildings) {
    check(b.id, 'requires', b.requires);
    for (const slot of b.instanceSlots ?? []) check(b.id, `slot ${slot.index}`, slot.condition);
  }
  assert.deepEqual(problems, []);
});

test('every townhall chain level up to maxLevel is defined from 3 upward', () => {
  const { levelRequirements, maxLevel } = BUILDINGS_CONFIG.townhall;
  for (let lv = 3; lv <= maxLevel; lv++) assert.ok(levelRequirements[lv], `HQ ${lv}`);
});

test('HQ_UNLOCK_TABLE defines every HQ level from 2 to townhall maxLevel with all four fields', () => {
  for (let level = 2; level <= BUILDINGS_CONFIG.townhall.maxLevel; level++) {
    const entry = HQ_UNLOCK_TABLE[level];
    assert.ok(entry, `HQ ${level}`);
    for (const field of ['buildings', 'units', 'techs']) assert.ok(Array.isArray(entry[field]), `HQ ${level} ${field}`);
    assert.ok(entry.benefits, `HQ ${level} benefits`);
  }
});

test('HQ_UNLOCK_TABLE spreads building and unit unlocks across the remapped HQ gates', () => {
  const levelOf = (category, id) => Number(Object.keys(HQ_UNLOCK_TABLE).find(lv => HQ_UNLOCK_TABLE[lv][category].includes(id)));
  const expected = {
    archeryrange: 2, infantryhall: 2, bank: 2, cafeteria: 4, house: 4,
    heroquarters: 6, cavalrystable: 6, workshop: 9, siegeworkshop: 9, magictower: 18,
  };
  for (const [id, level] of Object.entries(expected)) assert.equal(levelOf('buildings', id), level, id);
  for (const [id, level] of Object.entries({ infantry: 2, ranged: 2, cavalry: 6, siege: 9 })) {
    assert.equal(levelOf('units', id), level, id);
  }
});

test('HQ_UNLOCK_TABLE building unlocks agree with each building\'s requires.townhall', () => {
  const problems = [];
  for (const [lv, entry] of Object.entries(HQ_UNLOCK_TABLE)) {
    for (const id of entry.buildings) {
      const hq = BUILDINGS_CONFIG[id].requires?.townhall ?? 1;
      if (hq > Number(lv)) problems.push(`${id} listed at HQ ${lv} but requires HQ ${hq}`);
      if (hq > 2 && hq !== Number(lv)) problems.push(`${id} listed at HQ ${lv} but gated at HQ ${hq}`);
    }
  }
  assert.deepEqual(problems, []);
});

test('HQ_UNLOCK_TABLE techs move from old HQ n to M(n)', () => {
  const levelOf = id => Number(Object.keys(HQ_UNLOCK_TABLE).find(lv => HQ_UNLOCK_TABLE[lv].techs.includes(id)));
  const expected = {
    reinforced_lumber: 2, improved_smelting: 2, battle_formations: 4, rapid_construction: 4, steel_armor: 6,
    advanced_tactics: 9, infantry_mastery: 9, ranged_mastery: 9, cavalry_mastery: 12, infrastructure: 12,
    elite_training: 15, siege_mastery: 15,
  };
  for (const [id, level] of Object.entries(expected)) assert.equal(levelOf(id), level, id);
});

test('troop tier hall levels are 1,2,4,9,11,13,15,18,22,26 for every unit type', () => {
  for (const [unitId, tiers] of Object.entries(UNIT_TIER_REQUIREMENTS)) {
    assert.deepEqual(Object.values(tiers).slice(0, 10).map(t => t.minBuildingLevel), [1, 2, 4, 9, 11, 13, 15, 18, 22, 26], unitId);
    assert.deepEqual(Object.values(tiers).slice(0, 10).map(t => t.minTechLevel), [0, 0, 0, 1, 2, 3, 4, 5, 6, 7], unitId);
  }
});

test('mastery tech hall gates equal the tier HQ of the tier each level opens', () => {
  for (const [unitId, tiers] of Object.entries(UNIT_TIER_REQUIREMENTS)) {
    const mastery = TECH_CONFIG[tiers[4].techRequired];
    const hallId = UNITS_CONFIG[unitId].buildingId;
    assert.equal(mastery.requires[hallId], tiers[4].minBuildingLevel, `${mastery.id} L1`);
    for (const [lv, reqs] of Object.entries(mastery.levelRequirements)) {
      assert.equal(reqs[hallId], tiers[Number(lv) + 3].minBuildingLevel, `${mastery.id} L${lv}`);
    }
  }
});

test('tech building gates are remapped through M', () => {
  const workshopGates = id => [TECH_CONFIG[id].requires.workshop, ...Object.values(TECH_CONFIG[id].levelRequirements).map(r => r.workshop)];
  assert.deepEqual(workshopGates('infantry_mastery'), [4, 6, 9, 12, 12, 15, 18]);
  assert.deepEqual(TECH_CONFIG.elite_training.levelRequirements[5], { workshop: 18, barracks: 18 });
  assert.deepEqual(TECH_CONFIG.infrastructure.levelRequirements[5], { workshop: 18, well: 12 });
  assert.deepEqual(TECH_CONFIG.steel_armor.requires, { workshop: 4 });
});

test('every tech requirement names a building level within that building\'s maxLevel', () => {
  const problems = [];
  for (const tech of Object.values(TECH_CONFIG)) {
    for (const reqs of [tech.requires, ...Object.values(tech.levelRequirements ?? {})]) {
      for (const [id, need] of Object.entries(reqs ?? {})) {
        const b = BUILDINGS_CONFIG[id];
        if (!b) problems.push(`${tech.id} references unknown building ${id}`);
        else if (need > b.maxLevel) problems.push(`${tech.id} needs ${id} ${need} > maxLevel ${b.maxLevel}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('research queue slots open at Workshop 2, 6 and 12', () => {
  assert.deepEqual(QUEUE_CONFIG.research.slice(1).map(s => s.requires.workshop), [2, 6, 12]);
});

test('campaign chapters 3-10 gate on HQ 4,6,9,12,15,18,22,26 and Hero Quarters 5,8,10,13 from chapter 7', () => {
  const gates = CAMPAIGNS_CONFIG.slice(2, 10).map(c => c.requires);
  assert.deepEqual(gates.map(r => r.townhall), [4, 6, 9, 12, 15, 18, 22, 26]);
  assert.deepEqual(gates.slice(4, 8).map(r => r.heroquarters), [5, 8, 10, 13]);
  for (const chapter of CAMPAIGNS_CONFIG) {
    assert.deepEqual(MONSTERS_CONFIG[chapter.monsterId].requires ?? null, chapter.requires ?? null, chapter.monsterId);
  }
});

test('campaign chapter gates are reachable at the HQ they name', () => {
  for (const { requires, monsterId } of CAMPAIGNS_CONFIG) {
    const hq = requires?.townhall ?? 1;
    for (const [id, need] of Object.entries(requires ?? {})) {
      if (id !== 'townhall') assert.ok(need <= levelCap(BUILDINGS_CONFIG[id], hq), `${monsterId} ${id} ${need} at HQ ${hq}`);
    }
  }
});

test('hero level cap is 4 per Hero Quarters level', () => {
  assert.equal(XP_CONFIG.heroLevelCapPerHQLevel, 4);
});

test('nav tabs: Challenges at HQ 2, Events at HQ 4, labels name the level', () => {
  assert.equal(TAB_UNLOCK_CONDITIONS['sub:challenges'].level, 2);
  assert.equal(TAB_UNLOCK_CONDITIONS.events.level, 4);
  assert.match(TAB_UNLOCK_CONDITIONS.events.label, /\b4\b/);
  assert.match(TAB_UNLOCK_CONDITIONS['sub:challenges'].label, /\b2\b/);
});

test('every unit tier names a hall level within the hall maxLevel, never falling by tier', () => {
  for (const [unitId, unit] of Object.entries(UNITS_CONFIG)) {
    const hall = BUILDINGS_CONFIG[unit.buildingId];
    let previous = 1;
    for (const { tier } of unit.tiers) {
      const level = UNIT_TIER_REQUIREMENTS[unitId][tier]?.minBuildingLevel;
      assert.ok(Number.isInteger(level), `${unitId} T${tier} has no hall level`);
      assert.ok(level >= previous && level <= hall.maxLevel, `${unitId} T${tier} hall level ${level}`);
      previous = level;
    }
  }
});

test('tech gates are reachable under the HQ cap at the HQ each tech level implies', () => {
  const unlockHq = id => Number(Object.keys(HQ_UNLOCK_TABLE).find(lv => HQ_UNLOCK_TABLE[lv].techs.includes(id)) ?? 1);
  const workshopHq = need => Math.max(BUILDINGS_CONFIG.workshop.requires?.townhall ?? 1, minHqForLevel(BUILDINGS_CONFIG.workshop, need ?? 1));
  const tierHq = new Map();
  for (const [unitId, tiers] of Object.entries(UNIT_TIER_REQUIREMENTS)) {
    const hall = BUILDINGS_CONFIG[UNITS_CONFIG[unitId].buildingId];
    for (const req of Object.values(tiers)) {
      if (req.techRequired) tierHq.set(`${req.techRequired}:${req.minTechLevel}`, minHqForLevel(hall, req.minBuildingLevel));
    }
  }
  const problems = [];
  for (const tech of Object.values(TECH_CONFIG)) {
    const levels = [[1, tech.requires], ...Object.entries(tech.levelRequirements ?? {}).map(([lv, r]) => [Number(lv), r])];
    for (const [level, reqs] of levels) {
      const hq = Math.max(unlockHq(tech.id), tierHq.get(`${tech.id}:${level}`) ?? workshopHq(reqs?.workshop));
      for (const [id, need] of Object.entries(reqs ?? {})) {
        const cap = levelCap(BUILDINGS_CONFIG[id], hq);
        if (need > cap) problems.push(`${tech.id} L${level} needs ${id} ${need}, but ${id} caps at ${cap} under HQ ${hq}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('population gates never exceed the housing the player can hold at the HQ that opens the level', () => {
  const house = BUILDINGS_CONFIG.house;
  const housingAt = hq => {
    const slots = house.instanceSlots.filter(s => !s.condition || (s.condition.townhall ?? 1) <= hq).length;
    return Math.min(POPULATION_MAX, slots * house.populationCapacityPerLevel * levelCap(house, hq));
  };
  const problems = [];
  for (const b of Object.values(BUILDINGS_CONFIG)) {
    for (const [level, req] of Object.entries(b.levelRequirements ?? {})) {
      if (req.population === undefined) continue;
      const hq = b.id === 'townhall' ? Number(level) : minHqForLevel(b, Number(level));
      if (req.population > housingAt(hq)) problems.push(`${b.id} L${level} needs ${req.population} residents, housing holds ${housingAt(hq)} at HQ ${hq}`);
    }
  }
  assert.deepEqual(problems, []);
});
