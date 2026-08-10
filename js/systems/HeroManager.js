/** Hero recruitment (card-based), squad/building assignment, XP leveling, combat bonuses. */
import { eventBus }                       from '../core/EventBus.js';
import {
  HEROES_CONFIG,
  SKILLS_CONFIG,
  INVENTORY_ITEMS,
  GACHA_CONFIG,
  AWAKENING_CONFIG,
  FRAGMENTS_PER_SHARD,
} from '../entities/GAME_DATA.js';
import { HeroRecruitment } from './hero/heroRecruitment.js';
import { HeroProgression } from './hero/heroProgression.js';
import { HeroAssignment }  from './hero/heroAssignment.js';
import { HeroCombat }      from './hero/heroCombat.js';
import { HeroEconomy }     from './hero/heroEconomy.js';
import { pityDisclosure }  from './hero/heroPityDisclosure.js';
import {
  levelCapFor,
  costToReach,
  isUnlocked,
  reconcileSkillLevels,
  groupedSkillsFor,
  MAJOR_SKILL_STAR_GATE,
} from './hero/heroSkills.js';

const MAX_HEROES_PER_SQUAD = 4;

export class HeroManager {
  constructor(resourceManager, buildingManager, inventoryManager) {
    this.name = 'HeroManager';
    this._rm  = resourceManager;
    this._bm  = buildingManager;
    this._inv = inventoryManager;

    /** @type {Map<string, {heroId, level, xp, xpToNext, stars, effectiveStats, assignment}>} */
    this._owned = new Map();

    /** Tracks active production buffs: [{value, endsAt}] */
    this._activeBuffs = [];

    /** Track previous buff count to detect expiry in update() */
    this._lastBuffCount = 0;

    /** Per-tier pull counter since the last new-hero (stage 1) or shard-floor (stage 2) grant */
    this._pity = { normal: 0, epic: 0, legendary: 0 };

    this._recruitment = new HeroRecruitment(this);
    this._progression = new HeroProgression(this);
    this._assignment  = new HeroAssignment(this);
    this._combat      = new HeroCombat(this);
    this._economy     = new HeroEconomy(this);
  }

  // =============================================
  // RECRUITMENT — Card-based, gacha, awakening (delegated to HeroRecruitment)
  // =============================================

  rollToken(tier)             { return this._recruitment.rollToken(tier); }
  recruitWithCard(cardId)     { return this._recruitment.recruitWithCard(cardId); }
  awakenHero(heroId, method)  { return this._recruitment.awakenHero(heroId, method); }
  recruitHeroRecord(heroId)   { return this._recruitment._recruitHero(heroId); }
  _recruitHero(heroId)        { return this._recruitment._recruitHero(heroId); }
  _resolveTokenHero(tier, forcedId) { return this._recruitment._resolveTokenHero(tier, forcedId); }
  _grantHeroCurrency(outcome, heroId, tier, isDuplicate) { return this._recruitment._grantHeroCurrency(outcome, heroId, tier, isDuplicate); }
  convertFragments(heroId)                 { return this._recruitment.convertFragments(heroId); }
  unlockFromShards(heroId)                 { return this._recruitment.unlockFromShards(heroId); }
  exchangeTierShards(tier, heroId, count)  { return this._recruitment.exchangeTierShards(tier, heroId, count); }
  getPityState(tier)                       { return pityDisclosure(tier, this._pity?.[tier] ?? 0, this.rosterComplete(tier)); }

  /** Convert a hero fragment to XP on the target hero */
  useFragmentAsXP(fragmentItemId, heroId) { return this._progression.useFragmentAsXP(fragmentItemId, heroId); }

  /** Consume an XP card, granting its configured flat XP to the target hero */
  applyXPCard(itemId, heroId) { return this._progression.applyXPCard(itemId, heroId); }

  // =============================================
  // SKILLS
  // =============================================

  getSkillsForHero(heroId)   { return this._progression.getSkillsForHero(heroId); }
  applySkillPassives(hero)   { return this._progression.applySkillPassives(hero); }

  getSkillState(heroId) { return groupedSkillsFor(heroId, this._owned.get(heroId)); }

  levelUpSkill(heroId, skillId) {
    const hero    = this._owned.get(heroId);
    const heroCfg = HEROES_CONFIG[heroId];
    const skill   = SKILLS_CONFIG[skillId];
    if (!hero || !heroCfg) return { success: false, reason: 'Hero not in roster.' };
    if (!skill || !(heroCfg.skills ?? []).includes(skillId)) {
      return { success: false, reason: 'This hero does not have that skill.' };
    }
    if (!isUnlocked(skill, hero)) {
      return skill.type === 'major'
        ? { success: false, reason: `Awaken to ${MAJOR_SKILL_STAR_GATE}★ to unlock this skill.` }
        : { success: false, reason: `Unlocks at Lv.${skill.unlockLevel}.` };
    }

    hero.skillLevels = reconcileSkillLevels(heroId, hero.skillLevels);
    const current = hero.skillLevels[skillId];
    const cap     = levelCapFor(skill);
    if (current >= cap) return { success: false, reason: 'Skill is at max level.' };

    const next = current + 1;
    const cost = costToReach(skill, next);
    const shardId = `shard_${heroId}`;
    if (!this._inv.hasItem(shardId, cost)) {
      return { success: false, reason: `Need ${cost} Hero Shards (have ${this._inv.getQuantity(shardId)}).` };
    }
    this._inv.removeItem(shardId, cost);

    hero.skillLevels[skillId] = next;
    this.applySkillPassives(hero);
    eventBus.emit('hero:skillLeveled', { heroId, skillId, level: next });
    eventBus.emit('heroes:updated', this.getRosterWithState());
    return { success: true, level: next };
  }

  // =============================================
  // ASSIGNMENT — Squad (stored as barracks building assignment: squad_1 → barracks_0, …)
  // =============================================

  barracksIdForSquad(squadId) {
    const n = parseInt(squadId?.replace('squad_', '') ?? '1', 10);
    return `barracks_${Math.max(0, n - 1)}`;
  }

  getSquadHeroIds(squadId)              { return this._assignment.getSquadHeroIds(squadId); }
  getAllSquadHeroIds()                  { return this._assignment.getAllSquadHeroIds(); }
  getActiveHeroIds()                    { return this._assignment.getActiveHeroIds(); }
  getHeroesForSquad(squadId)            { return this._assignment.getHeroesForSquad(squadId); }
  assignHeroToSquad(heroId, squadId)    { return this._assignment.assignHeroToSquad(heroId, squadId); }
  unassignHeroFromSquad(heroId)         { return this._assignment.unassignHeroFromSquad(heroId); }

  // =============================================
  // ASSIGNMENT — Buildings
  // =============================================

  assignHeroToBuilding(heroId, buildingId, slotIndex = null) {
    return this._assignment.assignHeroToBuilding(heroId, buildingId, slotIndex);
  }
  unassignHeroFromBuilding(heroId) { return this._assignment.unassignHeroFromBuilding(heroId); }

  getHeroInstanceBonus(instanceId) { return this._economy.getInstanceBonus(instanceId); }
  getHeroGlobalEffects()           { return this._economy.getGlobalEffectMap(); }

  getBuildingHero(buildingId)           { return this._assignment.getBuildingHero(buildingId); }
  getHeroesForBuilding(buildingId)      { return this._assignment.getHeroesForBuilding(buildingId); }
  getAvailableHeroSlots()               { return this._assignment.getAvailableHeroSlots(); }
  getTotalAssignedToBuildings()         { return this._assignment.getTotalAssignedToBuildings(); }
  unassignHero(heroId)                  { return this._assignment.unassignHero(heroId); }

  // =============================================
  // XP & LEVELING
  // =============================================

  awardHeroXP(heroId, amount)    { return this._progression.awardHeroXP(heroId, amount); }
  purchaseXPBundle(heroId, id)   { return this._progression.purchaseXPBundle(heroId, id); }
  awardBattleXP(amount, squadId) { return this._progression.awardBattleXP(amount, squadId); }

  // =============================================
  // COMBAT BONUS CALCULATION
  // =============================================

  getCombatBonuses(squadId = null)          { return this._combat.getCombatBonuses(squadId); }
  getCategorizedBonuses(barracksInstanceId = null) { return this._combat.getCategorizedBonuses(barracksInstanceId); }
  activateBuff(buffCfg)                     { return this._combat.activateBuff(buffCfg); }
  getActiveBuffs()                          { return this._combat.getActiveBuffs(); }
  getActiveBuffsWithRemaining()             { return this._combat.getActiveBuffsWithRemaining(); }
  getActiveProductionMultiplier()           { return this._combat.getActiveProductionMultiplier(); }

  // =============================================
  // DATA ACCESS
  // =============================================

  getRosterWithState() {
    const goldAvailable = this._rm?.getSnapshot()?.gold?.amount ?? 0;
    const now = Date.now();
    this._activeBuffs = (this._activeBuffs ?? []).filter(b => b.endsAt > now);

    return Object.values(HEROES_CONFIG).map(cfg => {
      const owned      = this._owned.get(cfg.id);
      const assignment = owned?.assignment ?? { type: 'none' };

      const specificCardQty  = this._inv?.getQuantity(cfg.recruitCard)     ?? 0;
      const universalCardId  = `card_${cfg.tier}`;
      const universalCardQty = this._inv?.getQuantity(universalCardId)     ?? 0;
      const fragmentItemId   = GACHA_CONFIG.fragmentItemId[cfg.id];
      const fragmentQty      = fragmentItemId ? (this._inv?.getQuantity(fragmentItemId) ?? 0) : 0;
      const fragmentsNeeded  = FRAGMENTS_PER_SHARD[cfg.tier];
      const canRecruit       = !owned && (specificCardQty > 0 || universalCardQty > 0);

      // Awakening costs for next star — shard-only (@see docs/20-decisions/0025)
      const stars           = owned?.stars ?? 0;
      const shardQty        = this._inv?.getQuantity(`shard_${cfg.id}`) ?? 0;
      const nextStarShardCost = stars < AWAKENING_CONFIG.maxStars
        ? (AWAKENING_CONFIG.starShardCosts[stars]?.[cfg.tier] ?? null)
        : null;
      const canAwakenByShard = !!owned && nextStarShardCost !== null && shardQty >= nextStarShardCost;

      return {
        ...cfg,
        isOwned:          !!owned,
        level:            owned?.level    ?? 1,
        xp:               owned?.xp       ?? 0,
        xpToNext:         owned?.xpToNext ?? this._progression.xpToNext(1, cfg.tier),
        stars,
        effectiveStats:   owned?.effectiveStats ?? cfg.stats,
        assignment,
        isInSquad:        assignment.type === 'building' && !!assignment.buildingId?.startsWith('barracks_'),
        isInBuilding:     assignment.type === 'building' && !assignment.buildingId?.startsWith('barracks_'),
        assignedSquadId:  (assignment.type === 'building' && assignment.buildingId?.startsWith('barracks_'))
          ? `squad_${parseInt(assignment.buildingId.replace('barracks_', ''), 10) + 1}`
          : null,
        assignedBuilding: assignment.buildingId ?? null,
        specificCardQty,
        universalCardId,
        universalCardQty,
        fragmentItemId,
        fragmentQty,
        fragmentsNeeded,
        canRecruit,
        shardQty,
        nextStarShardCost,
        canAwakenByShard,
        canAffordSmallXP:  goldAvailable >= INVENTORY_ITEMS.xp_bundle_small.goldCost,
        canAffordMediumXP: goldAvailable >= INVENTORY_ITEMS.xp_bundle_medium.goldCost,
        canAffordLargeXP:  goldAvailable >= INVENTORY_ITEMS.xp_bundle_large.goldCost,
        skills:            this.getSkillsForHero(cfg.id),
      };
    });
  }

  isOwned(heroId) { return this._owned.has(heroId); }

  rosterComplete(tier) {
    return Object.values(HEROES_CONFIG)
      .filter(cfg => cfg.tier === tier)
      .every(cfg => this._owned.has(cfg.id));
  }

  update(_dt) {
    // Detect buff expiry and notify listeners
    const now = Date.now();
    const before = this._activeBuffs.length;
    this._activeBuffs = this._activeBuffs.filter(b => b.endsAt > now);
    if (this._activeBuffs.length !== before) {
      eventBus.emit('buffs:updated', this.getActiveBuffsWithRemaining());
      eventBus.emit('buffs:changed');
    }
  }

  // =============================================
  // PERSISTENCE
  // =============================================

  serialize() {
    return {
      owned:       Object.fromEntries(this._owned),
      activeBuffs: this._activeBuffs ?? [],
      pity:        { ...this._pity },
    };
  }

  deserialize(data) {
    if (!data) return;
    this._activeBuffs = (data.activeBuffs ?? []).filter(b => b.endsAt > Date.now());
    this._pity = {
      normal:    data.pity?.normal    ?? 0,
      epic:      data.pity?.epic      ?? 0,
      legendary: data.pity?.legendary ?? 0,
    };

    for (const [id, state] of Object.entries(data.owned ?? {})) {
      const cfg = HEROES_CONFIG[id];
      if (!cfg) continue;

      // Migrate old saves: isActive boolean → assignment object
      let assignment = state.assignment ?? { type: 'none' };
      if (state.isActive === true && assignment.type === 'none') {
        // Legacy: was in global squad — clear it; user will reassign to a specific squad
        assignment = { type: 'none' };
      }
      // Migrate old saves: squad assignment → building assignment (barracks_0)
      if (assignment.type === 'squad') {
        const squadId = assignment.squadId;
        // Map squad_1 → barracks_0, squad_2 → barracks_1, etc.
        const squadNum = parseInt(squadId?.replace('squad_', '') ?? '1', 10);
        assignment = { type: 'building', buildingId: `barracks_${Math.max(0, squadNum - 1)}` };
      }

      const level = state.level ?? 1;
      const hero = {
        heroId:     id,
        level,
        xp:         isFinite(state.xp) ? state.xp : 0,
        xpToNext:   this._progression.xpToNext(level, cfg.tier),
        stars:      state.stars ?? 0,
        effectiveStats: state.effectiveStats ?? { ...cfg.stats },
        assignment,
        skillLevels: reconcileSkillLevels(id, state.skillLevels),
      };
      if (hero.xp > hero.xpToNext) hero.xp = hero.xpToNext;
      this._owned.set(id, hero);
      this.applySkillPassives(hero);
    }
  }
}
