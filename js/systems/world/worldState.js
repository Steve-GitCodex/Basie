/**
 * systems/world/worldState.js
 * Pure seeding for WorldMapManager runtime state. Mirrors the data/runtime
 * split BuildingManager uses (_ensurePlacements): the blueprint lives in
 * data/worldMap.js; mutable per-game state is seeded here and owned by the
 * manager.
 */

/**
 * Build fresh runtime state from the immutable WORLD_MAP definition.
 * @returns {{ poiState: Object<string,object>, regionOwner: Object<string,string>,
 *             outpostOwner: Object<string,string> }}
 *   poiState[id]   = { remaining, clearedAt, respawnAt, looted, defeatedWindowStart }
 *                    (resource_node uses `remaining`; camp/stronghold use
 *                    clearedAt/respawnAt; ruin uses `looted`; world_boss uses
 *                    `defeatedWindowStart`)
 *   regionOwner[id]  = 'player' | factionId
 *   outpostOwner[id] = 'player' | factionId  (persistent capturable POIs)
 */
export function seedState(WORLD_MAP) {
  const poiState = {};
  const outpostOwner = {};
  for (const poi of WORLD_MAP.pois) {
    if (poi.type === 'resource_node') {
      poiState[poi.id] = { remaining: poi.capacity, clearedAt: 0, respawnAt: 0 };
    } else if (poi.type === 'camp' || poi.type === 'stronghold') {
      poiState[poi.id] = { remaining: 0, clearedAt: 0, respawnAt: 0 };
    } else if (poi.type === 'ruin') {
      poiState[poi.id] = { remaining: 0, clearedAt: 0, respawnAt: 0, looted: false };
    } else if (poi.type === 'world_boss') {
      poiState[poi.id] = { remaining: 0, clearedAt: 0, respawnAt: 0, defeatedWindowStart: -1 };
    } else if (poi.type === 'outpost') {
      // Owner is a free string so a future AIManager can re-capture (see
      // memory/basie-ai-faction-direction). Defaults to contested/neutral.
      outpostOwner[poi.id] = poi.startOwner ?? 'neutral';
    }
  }

  const regionOwner = {};
  for (const r of WORLD_MAP.regions) {
    // `startOwner` is the source of truth (only the home tile is the player's; the
    // command ruin starts unowned/neutral). Falls back to the old neutral→player
    // rule for any region that predates the field. Owner stays a free string so a
    // future AIManager can flip tiles (see memory/basie-ai-faction-direction).
    regionOwner[r.id] = r.startOwner ?? (r.factionId === 'neutral' ? 'player' : r.factionId);
  }

  return { poiState, regionOwner, outpostOwner };
}

/**
 * Reconcile loaded state against the current WORLD_MAP so save files survive
 * map edits (new POIs/regions get default entries; removed ones are dropped).
 */
export function reconcileState(loaded, WORLD_MAP) {
  const fresh = seedState(WORLD_MAP);
  const poiState = {};
  for (const id of Object.keys(fresh.poiState)) {
    poiState[id] = { ...fresh.poiState[id], ...(loaded?.poiState?.[id] ?? {}) };
  }
  const regionOwner = {};
  for (const id of Object.keys(fresh.regionOwner)) {
    regionOwner[id] = loaded?.regionOwner?.[id] ?? fresh.regionOwner[id];
  }
  const outpostOwner = {};
  for (const id of Object.keys(fresh.outpostOwner)) {
    outpostOwner[id] = loaded?.outpostOwner?.[id] ?? fresh.outpostOwner[id];
  }
  return { poiState, regionOwner, outpostOwner };
}
