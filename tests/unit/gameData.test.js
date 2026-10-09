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
} from '../../js/entities/GAME_DATA.js';

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
