/**
 * systems/world/WorldMapManager.js
 * Owns the world map's mutable runtime state: resource-node stores, camp
 * respawn timers, and region ownership. Orchestrator only — node math lives in
 * nodeEconomy, buff math in regionBuffs, seeding in worldState.
 *
 * Read-only presenters (WorldRenderer/WorldMapUI) pull snapshots; MarchManager
 * calls the mutating API (takeFromNode / markCampCleared / captureRegion) on
 * march arrival. Cross-system effects flow out as events.
 */
import { eventBus } from '../../core/EventBus.js';
import { WORLD_MAP } from '../../entities/GAME_DATA.js';
import { seedState, reconcileState } from './worldState.js';
import { regen, take } from './nodeEconomy.js';
import { activeBuffs } from './regionBuffs.js';

export class WorldMapManager {
  constructor() {
    this.name = 'worldMap';
    const { poiState, regionOwner } = seedState(WORLD_MAP);
    this._poiState = poiState;       // id → { remaining, clearedAt, respawnAt }
    this._regionOwner = regionOwner; // id → 'player' | factionId
    this._poiById = new Map(WORLD_MAP.pois.map(p => [p.id, p]));
    this._regionById = new Map(WORLD_MAP.regions.map(r => [r.id, r]));
  }

  // ── Engine tick ───────────────────────────────────────────────────────────
  update(dt) {
    const now = Date.now();
    for (const poi of WORLD_MAP.pois) {
      const st = this._poiState[poi.id];
      if (!st) continue;
      if (poi.type === 'resource_node' && st.remaining < poi.capacity) {
        st.remaining = regen(st.remaining, poi, dt);
      } else if ((poi.type === 'camp' || poi.type === 'stronghold') && st.respawnAt && now >= st.respawnAt) {
        st.respawnAt = 0; // back to available
        eventBus.emit('world:poiChanged', { poiId: poi.id, reason: 'respawned' });
      }
    }
  }

  // ── Reads ──────────────────────────────────────────────────────────────────
  getPOI(id)        { return this._poiById.get(id) ?? null; }
  getRegion(id)     { return this._regionById.get(id) ?? null; }
  getPOIState(id)   { return this._poiState[id] ?? null; }
  regionOwner(id)   { return this._regionOwner[id] ?? null; }
  isPlayerOwned(id) { return this._regionOwner[id] === 'player'; }
  nodeRemaining(id) { return this._poiState[id]?.remaining ?? 0; }

  /** A camp/stronghold is attackable when it isn't waiting to respawn. */
  isHostileAvailable(id) {
    const st = this._poiState[id];
    return !!st && !st.respawnAt;
  }

  /** Active buffs from player-owned regions (for Resource/Combat/March managers). */
  activeBuffs() { return activeBuffs(this._regionOwner, WORLD_MAP); }

  // ── Mutations (called by MarchManager on arrival) ───────────────────────────
  /** Extract up to `want` from a resource node; returns granted amount. */
  takeFromNode(poiId, want) {
    const st = this._poiState[poiId];
    if (!st) return 0;
    const { granted, left } = take(st.remaining, want);
    st.remaining = left;
    if (granted > 0) eventBus.emit('world:poiChanged', { poiId, reason: 'gathered' });
    return granted;
  }

  /** Mark a camp/stronghold cleared; camps schedule a respawn. */
  markHostileCleared(poiId) {
    const poi = this._poiById.get(poiId);
    const st = this._poiState[poiId];
    if (!poi || !st) return;
    st.clearedAt = Date.now();
    st.respawnAt = poi.respawnMs ? st.clearedAt + poi.respawnMs : 0;
    eventBus.emit('world:poiChanged', { poiId, reason: 'cleared' });
  }

  /** Flip a region to the player and surface its buff. */
  captureRegion(regionId) {
    if (!this._regionById.has(regionId) || this._regionOwner[regionId] === 'player') return;
    this._regionOwner[regionId] = 'player';
    const region = this._regionById.get(regionId);
    eventBus.emit('world:regionCaptured', { regionId, buff: region.buff ?? null });
  }

  // ── Persistence ─────────────────────────────────────────────────────────────
  serialize() {
    return { poiState: this._poiState, regionOwner: this._regionOwner };
  }

  deserialize(state) {
    const { poiState, regionOwner } = reconcileState(state, WORLD_MAP);
    this._poiState = poiState;
    this._regionOwner = regionOwner;
  }
}
