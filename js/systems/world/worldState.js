/**
 * systems/world/worldState.js
 * Pure seeding for WorldMapManager runtime state. Mirrors the data/runtime
 * split BuildingManager uses (_ensurePlacements): the blueprint lives in
 * data/worldMap.js; mutable per-game state is seeded here and owned by the
 * manager.
 */

/**
 * Build fresh runtime state from the immutable WORLD_MAP definition.
 * @returns {{ poiState: Object<string,object>, regionOwner: Object<string,string> }}
 *   poiState[id]   = { remaining, clearedAt, respawnAt } (resource_node uses
 *                    `remaining`; camp/stronghold use clearedAt/respawnAt)
 *   regionOwner[id] = 'player' | factionId
 */
export function seedState(WORLD_MAP) {
  const poiState = {};
  for (const poi of WORLD_MAP.pois) {
    if (poi.type === 'resource_node') {
      poiState[poi.id] = { remaining: poi.capacity, clearedAt: 0, respawnAt: 0 };
    } else if (poi.type === 'camp' || poi.type === 'stronghold') {
      poiState[poi.id] = { remaining: 0, clearedAt: 0, respawnAt: 0 };
    }
  }

  const regionOwner = {};
  for (const r of WORLD_MAP.regions) {
    // The home region is the player's from the start; faction regions must be taken.
    regionOwner[r.id] = r.factionId === 'neutral' ? 'player' : r.factionId;
  }

  return { poiState, regionOwner };
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
  return { poiState, regionOwner };
}
