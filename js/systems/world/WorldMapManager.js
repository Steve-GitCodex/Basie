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
import { bossWindow } from './worldBoss.js';

export class WorldMapManager {
  constructor() {
    this.name = 'worldMap';
    const { poiState, regionOwner, outpostOwner } = seedState(WORLD_MAP);
    this._poiState = poiState;       // id → { remaining, clearedAt, respawnAt, looted }
    this._regionOwner = regionOwner; // id → 'player' | factionId
    this._outpostOwner = outpostOwner; // id → 'player' | factionId (persistent capturable POIs)
    this._discovered = new Set();    // POI ids revealed ahead of their region unlocking (fog-of-war)
    this._timedBuffs = [];           // temporary buffs (ruin expeditions): { flavor, resource?, pct, expiresAt }
    this._bossOpen = new Map();      // transient: last-known open state per world boss (for transition events)
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
      } else if (poi.type === 'world_boss') {
        const open = bossWindow(poi, now).open;
        if (this._bossOpen.get(poi.id) !== open) {
          this._bossOpen.set(poi.id, open);
          eventBus.emit('world:bossWindow', { poiId: poi.id, open });
          eventBus.emit('world:poiChanged', { poiId: poi.id, reason: open ? 'bossOpen' : 'bossClosed' });
        }
      }
    }
    // Expire timed buffs (ruin expeditions).
    if (this._timedBuffs.length) {
      const before = this._timedBuffs.length;
      this._timedBuffs = this._timedBuffs.filter(b => b.expiresAt > now);
      if (this._timedBuffs.length !== before) eventBus.emit('world:buffsChanged', {});
    }
  }

  // ── Reads ──────────────────────────────────────────────────────────────────
  getPOI(id)        { return this._poiById.get(id) ?? null; }
  getRegion(id)     { return this._regionById.get(id) ?? null; }
  getPOIState(id)   { return this._poiState[id] ?? null; }
  regionOwner(id)   { return this._regionOwner[id] ?? null; }
  isPlayerOwned(id) { return this._regionOwner[id] === 'player'; }
  nodeRemaining(id) { return this._poiState[id]?.remaining ?? 0; }

  /** A camp/stronghold is attackable when it isn't waiting to respawn; a world boss
   *  only while its window is open and it hasn't been beaten this window. */
  isHostileAvailable(id) {
    const poi = this._poiById.get(id);
    if (poi?.type === 'world_boss') return this.isBossOpen(id);
    const st = this._poiState[id];
    return !!st && !st.respawnAt;
  }

  // ── World bosses ────────────────────────────────────────────────────────────
  /** Live window info for a boss, or null. */
  bossInfo(id) {
    const poi = this._poiById.get(id);
    if (poi?.type !== 'world_boss') return null;
    const w = bossWindow(poi, Date.now());
    const defeated = this._poiState[id]?.defeatedWindowStart === w.windowStart;
    return { ...w, defeated };
  }

  /** Can the player attack this boss right now (window open, not already beaten)? */
  isBossOpen(id) {
    const info = this.bossInfo(id);
    return !!info && info.open && !info.defeated;
  }

  /** Record a boss kill against the current window (blocks re-farming until next window). */
  markBossDefeated(id) {
    const st = this._poiState[id];
    const poi = this._poiById.get(id);
    if (!st || poi?.type !== 'world_boss') return;
    st.defeatedWindowStart = bossWindow(poi, Date.now()).windowStart;
    eventBus.emit('world:poiChanged', { poiId: id, reason: 'bossDefeated' });
  }

  /**
   * Is there anything left for a scout march to do here? Ruins are scoutable until
   * looted; outposts are capturable until the player owns them. Other types defer
   * to the march-type check elsewhere.
   */
  isScoutAvailable(id) {
    const poi = this._poiById.get(id);
    if (poi?.type === 'ruin') return !this._poiState[id]?.looted;
    if (poi?.type === 'outpost') return this._outpostOwner[id] !== 'player';
    return true;
  }

  outpostOwner(id)       { return this._outpostOwner[id] ?? null; }
  isPlayerOutpost(id)    { return this._outpostOwner[id] === 'player'; }

  /**
   * Region unlock gate: is this region's `requires` satisfied by current ownership?
   * Supports `{ region: id }` (one) or `{ regions: [ids] }` (all required).
   * @returns {{ locked: boolean, missing: string[] }} missing = required region ids
   *   not yet player-owned.
   */
  regionLock(regionId) {
    const r = this._regionById.get(regionId);
    if (!r || !r.requires) return { locked: false, missing: [] };
    const req = r.requires;
    const need = Array.isArray(req.regions) ? req.regions : (req.region ? [req.region] : []);
    const missing = need.filter(id => this._regionOwner[id] !== 'player');
    return { locked: missing.length > 0, missing };
  }

  isRegionUnlocked(regionId) { return !this.regionLock(regionId).locked; }

  // ── Fog of war ──────────────────────────────────────────────────────────────
  /**
   * Is this POI visible? POIs in unlocked regions are always visible; POIs in
   * still-locked regions are fogged until explicitly revealed (watchtower / scout).
   * The home city is always visible.
   */
  isDiscovered(poiId) {
    const poi = this._poiById.get(poiId);
    if (!poi) return false;
    if (poi.type === 'city') return true;
    if (this.isRegionUnlocked(poi.regionId)) return true;
    return this._discovered.has(poiId);
  }

  /** Reveal a single fogged POI (idempotent). */
  revealPoi(poiId) {
    if (this._poiById.has(poiId) && !this._discovered.has(poiId)) {
      this._discovered.add(poiId);
      eventBus.emit('world:poiChanged', { poiId, reason: 'revealed' });
    }
  }

  /** Reveal every POI within `radius` world px of (cx, cy) — e.g. a watchtower. */
  revealArea(cx, cy, radius) {
    if (!radius) return;
    const r2 = radius * radius;
    let revealed = false;
    for (const poi of WORLD_MAP.pois) {
      if (this._discovered.has(poi.id)) continue;
      const dx = poi.x - cx, dy = poi.y - cy;
      if (dx * dx + dy * dy <= r2) { this._discovered.add(poi.id); revealed = true; }
    }
    if (revealed) eventBus.emit('world:poiChanged', { reason: 'revealed' });
  }

  /**
   * Active buffs for Resource/Combat/March consumers — one source of truth merging
   * standing region buffs, persistent boons from player-held outposts, and any
   * non-expired timed buffs (ruin expeditions).
   */
  activeBuffs() {
    const now = Date.now();
    const timed = this._timedBuffs.filter(b => b.expiresAt > now);
    const outposts = WORLD_MAP.pois
      .filter(p => p.type === 'outpost' && p.boon && this._outpostOwner[p.id] === 'player')
      .map(p => ({ poiId: p.id, ...p.boon }));
    return [...activeBuffs(this._regionOwner, WORLD_MAP), ...outposts, ...timed];
  }

  // ── Mutations (called by MarchManager on arrival) ───────────────────────────
  /** Extract up to `want` from a resource node; returns granted amount. */
  takeFromNode(poiId, want) {
    const st = this._poiState[poiId];
    if (!st) return 0;
    const { granted, left } = take(st.remaining, want);
    st.remaining = left;
    eventBus.emit('world:poiChanged', { poiId, reason: 'gathered' });
    return granted;
  }

  /** Mark a ruin looted (one-time; renders inert afterwards). */
  markRuinLooted(poiId) {
    const st = this._poiState[poiId];
    if (!st) return;
    st.looted = true;
    eventBus.emit('world:poiChanged', { poiId, reason: 'looted' });
  }

  /** Flip a persistent outpost to the player; its standing boon activates at once. */
  captureOutpost(poiId) {
    if (!(poiId in this._outpostOwner) || this._outpostOwner[poiId] === 'player') return;
    this._outpostOwner[poiId] = 'player';
    const poi = this._poiById.get(poiId);
    // Watchtowers lift the fog around them once held.
    if (poi?.revealRadius) this.revealArea(poi.x, poi.y, poi.revealRadius);
    eventBus.emit('world:outpostCaptured', { poiId, boon: poi?.boon ?? null });
    eventBus.emit('world:buffsChanged', {});
  }

  /** Add a temporary buff (e.g. a ruin expedition reward). */
  grantTimedBuff(buff) {
    if (!buff || !buff.durationMs) return;
    this._timedBuffs.push({ ...buff, expiresAt: Date.now() + buff.durationMs });
    eventBus.emit('world:buffGranted', { buff });
    eventBus.emit('world:buffsChanged', {});
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
    return {
      poiState: this._poiState, regionOwner: this._regionOwner,
      outpostOwner: this._outpostOwner, timedBuffs: this._timedBuffs,
      discovered: [...this._discovered],
    };
  }

  deserialize(state) {
    const { poiState, regionOwner, outpostOwner } = reconcileState(state, WORLD_MAP);
    this._poiState = poiState;
    this._regionOwner = regionOwner;
    this._outpostOwner = outpostOwner;
    this._discovered = new Set(
      (Array.isArray(state?.discovered) ? state.discovered : []).filter(id => this._poiById.has(id)),
    );
    const now = Date.now();
    this._timedBuffs = Array.isArray(state?.timedBuffs)
      ? state.timedBuffs.filter(b => b?.expiresAt > now)
      : [];
  }
}
