import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BUILDINGS_CONFIG, CATEGORY_ZONE,
  BUILD_RECT, inBounds, WORLD_MAP, MONSTERS_CONFIG,
  ACHIEVEMENTS_CONFIG, HEROES_CONFIG,
  SHOP_CONFIG, INVENTORY_ITEMS, PROD_BONUS_CONFIG,
} from '../../js/entities/GAME_DATA.js';

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
  for (const section of SHOP_CONFIG) {
    for (const entry of section.items ?? []) {
      if (!entry.itemId) continue;
      assert.ok(INVENTORY_ITEMS[entry.itemId],
        `shop section '${section.id}' sells unknown item '${entry.itemId}'`);
    }
  }
});

test('every recruit token has at least one acquisition path', () => {
  const sold = new Set();
  for (const section of SHOP_CONFIG) {
    for (const entry of section.items ?? []) if (entry.itemId) sold.add(entry.itemId);
  }
  for (const tier of ['normal', 'epic', 'legendary']) {
    assert.ok(sold.has(`token_${tier}`),
      `token_${tier} is unreachable — no player can enter the hero economy`);
  }
});

test('no retired recruitment scroll is still for sale', () => {
  for (const section of SHOP_CONFIG) {
    for (const entry of section.items ?? []) {
      assert.ok(!String(entry.itemId ?? '').startsWith('scroll_'),
        `retired item '${entry.itemId}' is still on sale and always fails on use`);
    }
  }
});

test('every statEffectMap entry resolves to a known PROD_BONUS_CONFIG base key', () => {
  const resourceEffects = new Set(['money', 'food', 'wood', 'stone', 'iron']);
  for (const [buildingType, entry] of Object.entries(PROD_BONUS_CONFIG.statEffectMap)) {
    if (resourceEffects.has(entry.effect)) continue;
    assert.ok(PROD_BONUS_CONFIG.base[entry.effect] != null,
      `statEffectMap['${buildingType}'] maps to '${entry.effect}' with no base value`);
  }
});

test('paladin\'s buildingBonus is knowingly inert — heroquarters has no statEffectMap entry', () => {
  assert.equal(HEROES_CONFIG.paladin.buildingBonus.buildingType, 'heroquarters');
  assert.equal(PROD_BONUS_CONFIG.statEffectMap.heroquarters, undefined,
    'wiring this needs a balance number the numbers spec never defined — a future phase decides');
});

const KNOWN_INERT_HERO_BUILDING_BONUSES = new Set(['paladin:heroquarters']);

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
