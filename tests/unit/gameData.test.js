import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BUILDINGS_CONFIG, CATEGORY_ZONE, CITY_BLUEPRINT,
  plotsInZone, plotById, WORLD_MAP, MONSTERS_CONFIG,
} from '../../js/entities/GAME_DATA.js';

const RESOURCE_KEYS = new Set(['wood', 'stone', 'iron', 'food', 'water', 'money']);

const buildings = Object.values(BUILDINGS_CONFIG);

test('every building category maps to a blueprint zone', () => {
  for (const b of buildings) {
    assert.ok(CATEGORY_ZONE[b.category], `${b.id} has unmapped category '${b.category}'`);
  }
});

test('each zone has more plots than total instances of that zone', () => {
  const needed = {};
  for (const b of buildings) {
    const zone = CATEGORY_ZONE[b.category];
    needed[zone] = (needed[zone] ?? 0) + (b.maxInstances ?? 1);
  }
  for (const [zone, count] of Object.entries(needed)) {
    assert.ok(
      plotsInZone(zone).length > count,
      `zone '${zone}' has ${plotsInZone(zone).length} plots for ${count} instances`,
    );
  }
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

test('blueprint plot ids are unique and sit inside the grid', () => {
  const seen = new Set();
  for (const plot of CITY_BLUEPRINT.plots) {
    assert.ok(!seen.has(plot.id), `duplicate plot id '${plot.id}'`);
    seen.add(plot.id);
    assert.ok(plot.col >= 0 && plot.col < CITY_BLUEPRINT.cols, `${plot.id} col out of grid`);
    assert.ok(plot.row >= 0 && plot.row < CITY_BLUEPRINT.rows, `${plot.id} row out of grid`);
    assert.equal(plotById(plot.id), plot);
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
