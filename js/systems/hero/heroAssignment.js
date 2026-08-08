import { eventBus } from '../../core/EventBus.js';
import { BUILDINGS_CONFIG } from '../../entities/GAME_DATA.js';

export class HeroAssignment {
  constructor(hero) {
    this._h = hero;
  }

  /** heroIds of all squad-assigned heroes (barracks), optionally filtered by squadId. */
  getSquadHeroIds(squadId) {
    return [...this._h._owned.values()]
      .filter(h => {
        const a = h.assignment;
        if (a?.type !== 'building' || !a.buildingId?.startsWith('barracks_')) return false;
        if (!squadId) return true;
        return a.buildingId === this._h.barracksIdForSquad(squadId);
      })
      .map(h => h.heroId);
  }

  /** All heroes assigned to any barracks/squad (for global UI display). */
  getAllSquadHeroIds() { return this.getSquadHeroIds(); }

  /** @deprecated Alias for getSquadHeroIds() */
  getActiveHeroIds() { return this.getSquadHeroIds(); }

  /** Full hero records assigned to a specific squad (via barracks lookup). */
  getHeroesForSquad(squadId) {
    return this.getHeroesForBuilding(this._h.barracksIdForSquad(squadId));
  }

  /** Assign a hero to a squad; stored internally as a barracks building assignment. */
  assignHeroToSquad(heroId, squadId) {
    if (!squadId) return { success: false, reason: 'No squad specified.' };
    return this.assignHeroToBuilding(heroId, this._h.barracksIdForSquad(squadId));
  }

  /** Remove a hero from their squad/barracks assignment. */
  unassignHeroFromSquad(heroId) {
    return this.unassignHero(heroId);
  }

  /** Station a hero at a building (instance id e.g. 'mine_0'); enforces per-building and global slot caps. */
  assignHeroToBuilding(heroId, buildingId, slotIndex = null) {
    const hero = this._h._owned.get(heroId);
    if (!hero) return { success: false, reason: 'Hero not in roster.' };

    const buildingType = buildingId.replace(/_\d+$/, '');
    const bldgCfg = BUILDINGS_CONFIG[buildingType];
    const isBarracks = buildingType === 'barracks';

    // For barracks: evict any hero already occupying this exact slot so the new hero takes it
    if (isBarracks && slotIndex !== null) {
      for (const h of this._h._owned.values()) {
        if (h.assignment?.type === 'building' &&
            h.assignment.buildingId === buildingId &&
            h.assignment.slotIndex === slotIndex &&
            h.heroId !== heroId) {
          h.assignment = { type: 'none' };
          break;
        }
      }
    }

    // This hero is already in this exact slot — nothing to do
    if (hero.assignment?.type === 'building' && hero.assignment.buildingId === buildingId &&
        (slotIndex === null || hero.assignment.slotIndex === slotIndex)) {
      return { success: false, reason: 'Already assigned to this slot.' };
    }

    // Per-building capacity cap (from config) — for barracks, slot-aware so swapping is fine
    const heroCapacity = bldgCfg?.heroCapacity ?? 1;
    const heroesHere = this.getHeroesForBuilding(buildingId).filter(h => h.heroId !== heroId);
    if (isBarracks && slotIndex !== null) {
      // Slot-based: only block if ALL slots are taken by OTHER heroes
      const occupiedSlots = new Set(heroesHere.map(h => h.assignment?.slotIndex));
      occupiedSlots.delete(slotIndex); // the target slot was just cleared above
      if (occupiedSlots.size >= heroCapacity) {
        return { success: false, reason: `This barracks is full (${heroCapacity} heroes).` };
      }
    } else if (!isBarracks && heroesHere.length >= heroCapacity) {
      return { success: false, reason: `This building can only hold ${heroCapacity} hero${heroCapacity !== 1 ? 'es' : ''}.` };
    }

    // Global hero slot cap only applies to non-barracks buildings
    // (barracks slots represent squad leadership, not stationed production heroes)
    if (!isBarracks) {
      const available = this.getAvailableHeroSlots();
      const assigned  = this.getTotalAssignedToBuildings();
      if (hero.assignment?.type !== 'building' && assigned >= available) {
        return { success: false, reason: `No hero slots available. Upgrade Hero Quarters to unlock more (${assigned}/${available}).` };
      }
    }

    hero.assignment = { type: 'building', buildingId, slotIndex };
    eventBus.emit('heroes:updated', this._h.getRosterWithState());
    eventBus.emit('hero:productionBonusChanged');
    return { success: true };
  }

  /** Remove a hero from their building assignment. */
  unassignHeroFromBuilding(heroId) {
    const hero = this._h._owned.get(heroId);
    if (!hero) return { success: false, reason: 'Hero not in roster.' };
    if (hero.assignment?.type !== 'building') {
      return { success: false, reason: 'Hero is not stationed at a building.' };
    }
    hero.assignment = { type: 'none' };
    eventBus.emit('heroes:updated', this._h.getRosterWithState());
    eventBus.emit('hero:productionBonusChanged');
    return { success: true };
  }

  /** Returns the hero state assigned to a building, or null. */
  getBuildingHero(buildingId) {
    for (const h of this._h._owned.values()) {
      if (h.assignment?.type === 'building' && h.assignment.buildingId === buildingId) return h;
    }
    return null;
  }

  /** Returns ALL heroes assigned to a specific building instance. */
  getHeroesForBuilding(buildingId) {
    return [...this._h._owned.values()]
      .filter(h => h.assignment?.type === 'building' && h.assignment.buildingId === buildingId);
  }

  /** Total hero slot capacity from heroquarters (level × 5). */
  getAvailableHeroSlots() {
    return (this._h._bm?.getLevelOf('heroquarters') ?? 0) * 5;
  }

  /** Count of heroes assigned to non-barracks buildings (barracks are squad leaders, not slot-consuming). */
  getTotalAssignedToBuildings() {
    let count = 0;
    for (const h of this._h._owned.values()) {
      if (h.assignment?.type === 'building' &&
          !h.assignment.buildingId?.startsWith('barracks_')) count++;
    }
    return count;
  }

  /** Convenience: clear any assignment from a hero. */
  unassignHero(heroId) {
    const hero = this._h._owned.get(heroId);
    if (!hero) return { success: false, reason: 'Hero not in roster.' };
    hero.assignment = { type: 'none' };
    eventBus.emit('heroes:updated', this._h.getRosterWithState());
    return { success: true };
  }
}
