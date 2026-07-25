import { eventBus } from '../../core/EventBus.js';
import {
  HEROES_CONFIG,
  INVENTORY_ITEMS,
  GACHA_CONFIG,
  AWAKENING_CONFIG,
  PITY_CONFIG,
  EXCHANGE_CONFIG,
  FRAGMENTS_PER_SHARD,
  SHARDS_TO_UNLOCK,
} from '../../entities/GAME_DATA.js';

export class HeroRecruitment {
  constructor(hero) {
    this._h = hero;
  }

  /** Roll a recruit token (consumes one) — heroes-only, never a base resource. */
  rollToken(tier) {
    const tokenId = `token_${tier}`;
    if (!this._h._inv?.hasItem(tokenId)) {
      return { outcome: null, reason: 'No token of this tier.' };
    }

    this._h._inv.removeItem(tokenId, 1);
    const pullCount = ++this._h._pity[tier];

    const result = this._h.rosterComplete(tier)
      ? this._rollStage2(tier, pullCount)
      : this._rollStage1(tier, pullCount);

    if (result.outcome === 'hero' && !result.isDuplicate) {
      this._h._pity[tier] = 0;
    }

    eventBus.emit('heroes:updated', this._h.getRosterWithState());
    return result;
  }

  /** @private Before the roster is complete: soft pity ramps the new-hero rate, hard pity forces one. */
  _rollStage1(tier, pullCount) {
    if (pullCount >= PITY_CONFIG.stage1HardPityN) {
      this._h._pity[tier] = 0;
      return this._resolveTokenHero(tier);
    }

    const softBonus = pullCount >= PITY_CONFIG.softPityFrom
      ? (pullCount - PITY_CONFIG.softPityFrom + 1) * PITY_CONFIG.softPityBonusPerPull
      : 0;
    const rate = Math.min(1, PITY_CONFIG.newHeroRate[tier] + softBonus);

    return Math.random() < rate
      ? this._resolveTokenHero(tier)
      : this._resolveConsolation(tier);
  }

  /** @private Once every hero is owned: every N pulls guarantees a Hero Shard floor for the tier. */
  _rollStage2(tier, pullCount) {
    if (pullCount >= PITY_CONFIG.stage2ShardFloorEveryPulls) {
      this._h._pity[tier] = 0;
      return this._grantShardFloor(tier);
    }

    return Math.random() < PITY_CONFIG.newHeroRate[tier]
      ? this._resolveTokenHero(tier)
      : this._resolveConsolation(tier);
  }

  /** @private Guaranteed Hero Shard grant for a not-yet-maxed hero of the tier (stage 2 floor). */
  _grantShardFloor(tier) {
    const eligible = Object.values(HEROES_CONFIG)
      .filter(h => h.tier === tier)
      .map(h => this._h._owned.get(h.id))
      .filter(hero => hero && hero.stars < AWAKENING_CONFIG.maxStars);

    if (eligible.length === 0) return this._overflowToTierShards(tier);

    const target  = eligible[Math.floor(Math.random() * eligible.length)];
    const itemId  = `shard_${target.heroId}`;
    const amount  = PITY_CONFIG.stage2ShardFloorAmount;
    const result  = { outcome: 'shard', heroId: target.heroId, tier, isDuplicate: true };

    if (this._h._inv.addItem(itemId, amount)) {
      result.itemId = itemId;
    } else {
      result.grantFailed = true;
      result.reason = `Failed to grant shard: ${itemId}.`;
    }
    return result;
  }

  /** @private Resolve the "hero" branch of a token roll. `forcedId` lets tests pin the landed hero. */
  _resolveTokenHero(tier, forcedId = null) {
    const candidates = Object.values(HEROES_CONFIG).filter(h => h.tier === tier);
    if (candidates.length === 0) return { outcome: null, reason: 'No heroes of this tier.' };

    let heroCfg;
    if (forcedId) {
      heroCfg = HEROES_CONFIG[forcedId];
      if (!heroCfg) return { outcome: null, reason: 'Unknown hero id.' };
    } else {
      const unowned = candidates.filter(h => !this._h._owned.has(h.id));
      const pool = unowned.length > 0 ? unowned : candidates;
      heroCfg = pool[Math.floor(Math.random() * pool.length)];
    }

    const isDuplicate = this._h._owned.has(heroCfg.id);
    if (!isDuplicate) {
      this._recruitHero(heroCfg.id);
      return { outcome: 'hero', heroId: heroCfg.id, tier, isDuplicate: false };
    }

    return this._grantDuplicateConsolation(heroCfg.id, tier);
  }

  /** @private Non-hero pull: split fragments/shard/xp per the token's tier (§G). */
  _resolveConsolation(tier) {
    const split = PITY_CONFIG.consolationSplit[tier];
    const roll = Math.random();

    if (roll < split.fragments) {
      return this._grantConsolationCurrency('fragment', tier);
    }
    if (roll < split.fragments + split.heroShard) {
      return this._grantConsolationCurrency('shard', tier);
    }

    const itemId = `xpcard_${tier}`;
    const result = { outcome: 'xp', tier };
    if (this._h._inv.addItem(itemId, 1)) {
      result.itemId = itemId;
    } else {
      result.grantFailed = true;
      result.reason = `Failed to grant XP card: ${itemId}.`;
    }
    return result;
  }

  /** @private A duplicate hero-roll converts to fragments/shard, renormalized between the two. */
  _grantDuplicateConsolation(heroId, tier) {
    const split = PITY_CONFIG.consolationSplit[tier];
    const total  = split.fragments + split.heroShard;
    const outcome = Math.random() * total < split.fragments ? 'fragment' : 'shard';
    return this._grantHeroCurrency(outcome, heroId, tier, true);
  }

  /** @private Pick a target hero (un-owned-biased within the tier) and grant fragments/shard. */
  _grantConsolationCurrency(outcome, tier) {
    const candidates = Object.values(HEROES_CONFIG).filter(h => h.tier === tier);
    if (candidates.length === 0) return { outcome, tier, grantFailed: true, reason: 'No heroes of this tier.' };
    const unowned = candidates.filter(h => !this._h._owned.has(h.id));
    const pool = unowned.length > 0 ? unowned : candidates;
    const heroTarget = pool[Math.floor(Math.random() * pool.length)];
    return this._grantHeroCurrency(outcome, heroTarget.id, tier, this._h._owned.has(heroTarget.id));
  }

  /** @private Grant a fragment or Hero Shard for a specific hero; a maxed hero's shard overflows instead. */
  _grantHeroCurrency(outcome, heroId, tier, isDuplicate) {
    if (outcome === 'shard' && this._isHeroFullyMaxed(heroId)) {
      return this._overflowToTierShards(tier, heroId);
    }
    const itemId = outcome === 'fragment' ? GACHA_CONFIG.fragmentItemId[heroId] : `shard_${heroId}`;
    const result = { outcome, heroId, tier, isDuplicate };
    if (itemId && this._h._inv.addItem(itemId, 1)) {
      result.itemId = itemId;
    } else {
      result.grantFailed = true;
      result.reason = `Failed to grant ${outcome}: ${itemId}.`;
    }
    return result;
  }

  /** @private Phase 1 has no skill-level data, so "fully maxed" means max stars. */
  _isHeroFullyMaxed(heroId) {
    const hero = this._h._owned.get(heroId);
    return !!hero && hero.stars >= AWAKENING_CONFIG.maxStars;
  }

  /** @private A Hero Shard that would be dead weight becomes tier shards instead (asymmetric refund, no laundering). */
  _overflowToTierShards(tier, heroId = null) {
    const itemId = `tier_shard_${tier}`;
    const amount = EXCHANGE_CONFIG.maxedOverflowToTierShards;
    const result = { outcome: 'overflow', tier, heroId };
    if (this._h._inv.addItem(itemId, amount)) {
      result.itemId = itemId;
    } else {
      result.grantFailed = true;
      result.reason = `Failed to grant tier shards: ${itemId}.`;
    }
    return result;
  }

  /** Convert a full set of a hero's fragments into one Hero Shard. */
  convertFragments(heroId) {
    const heroCfg = HEROES_CONFIG[heroId];
    if (!heroCfg) return { success: false, reason: 'Unknown hero.' };
    const fragmentId = GACHA_CONFIG.fragmentItemId[heroId];
    const needed = FRAGMENTS_PER_SHARD[heroCfg.tier];
    if (!fragmentId || !needed) return { success: false, reason: 'No fragment config for this hero.' };
    if (!this._h._inv.hasItem(fragmentId, needed)) {
      return { success: false, reason: `Need ${needed} fragments (have ${this._h._inv.getQuantity(fragmentId)}).` };
    }
    this._h._inv.removeItem(fragmentId, needed);

    let result;
    if (this._isHeroFullyMaxed(heroId)) {
      result = this._overflowToTierShards(heroCfg.tier, heroId);
    } else {
      this._h._inv.addItem(`shard_${heroId}`, 1);
      result = { outcome: 'shard', heroId };
    }
    eventBus.emit('heroes:updated', this._h.getRosterWithState());
    return { success: true, heroId, ...result };
  }

  /** Unlock a not-yet-owned hero outright by spending Hero Shards. */
  unlockFromShards(heroId) {
    const heroCfg = HEROES_CONFIG[heroId];
    if (!heroCfg) return { success: false, reason: 'Unknown hero.' };
    if (this._h._owned.has(heroId)) return { success: false, reason: 'Hero already owned.' };
    const shardId = `shard_${heroId}`;
    const needed  = SHARDS_TO_UNLOCK[heroCfg.tier];
    if (!needed) return { success: false, reason: 'No unlock config for this hero.' };
    if (!this._h._inv.hasItem(shardId, needed)) {
      return { success: false, reason: `Need ${needed} Hero Shards (have ${this._h._inv.getQuantity(shardId)}).` };
    }
    this._h._inv.removeItem(shardId, needed);
    this._recruitHero(heroId);
    eventBus.emit('heroes:updated', this._h.getRosterWithState());
    return { success: true, heroId };
  }

  /** Exchange tier shards for a specific hero's Hero Shards, 3:1 only (no reverse-rate laundering). */
  exchangeTierShards(tier, heroId, count = 1) {
    const heroCfg = HEROES_CONFIG[heroId];
    if (!heroCfg) return { success: false, reason: 'Unknown hero.' };
    if (heroCfg.tier !== tier) return { success: false, reason: 'Hero is not of this tier.' };
    if (!Number.isInteger(count) || count <= 0) return { success: false, reason: 'Invalid count.' };

    const tierShardId = `tier_shard_${tier}`;
    const needed = EXCHANGE_CONFIG.tierShardsPerHeroShard * count;
    if (!this._h._inv.hasItem(tierShardId, needed)) {
      return { success: false, reason: `Need ${needed} ${tier} Tier Shards (have ${this._h._inv.getQuantity(tierShardId)}).` };
    }
    this._h._inv.removeItem(tierShardId, needed);

    if (this._isHeroFullyMaxed(heroId)) {
      this._h._inv.addItem(tierShardId, EXCHANGE_CONFIG.maxedOverflowToTierShards * count);
      eventBus.emit('heroes:updated', this._h.getRosterWithState());
      return { success: true, heroId, count, outcome: 'overflow' };
    }

    this._h._inv.addItem(`shard_${heroId}`, count);
    eventBus.emit('heroes:updated', this._h.getRosterWithState());
    return { success: true, heroId, count };
  }

  /** Awaken a hero by spending Hero Shards. */
  awakenHero(heroId) {
    const hero    = this._h._owned.get(heroId);
    const heroCfg = HEROES_CONFIG[heroId];
    if (!hero || !heroCfg) return { success: false, reason: 'Hero not in roster.' };
    if (hero.stars >= AWAKENING_CONFIG.maxStars) return { success: false, reason: 'Hero is at max stars.' };

    const costCfg = AWAKENING_CONFIG.starShardCosts[hero.stars];
    if (!costCfg) return { success: false, reason: 'Hero is at max stars.' };

    const shardId     = `shard_${heroId}`;
    const shardNeeded = costCfg[heroCfg.tier];

    if (!this._h._inv.hasItem(shardId, shardNeeded)) {
      return { success: false, reason: `Need ${shardNeeded} Hero Shards (have ${this._h._inv.getQuantity(shardId)}).` };
    }
    this._h._inv.removeItem(shardId, shardNeeded);

    hero.stars++;
    this._h.applySkillPassives(hero);
    eventBus.emit('hero:awakened', { heroId, name: heroCfg.name, stars: hero.stars });
    eventBus.emit('heroes:updated', this._h.getRosterWithState());
    return { success: true, stars: hero.stars };
  }

  /** @private Create owned hero record and emit */
  _recruitHero(heroId) {
    const cfg = HEROES_CONFIG[heroId];
    if (!cfg) return;
    const hero = {
      heroId,
      level:    1,
      xp:       0,
      xpToNext: this._h._progression.xpToNext(1, cfg.tier),
      stars:    0,
      effectiveStats: { ...cfg.stats },
      assignment: { type: 'none' },
    };
    this._h._owned.set(heroId, hero);
    this._h.applySkillPassives(hero);
    eventBus.emit('hero:recruited', { heroId, name: cfg.name, tier: cfg.tier });
  }

  /** Recruit via a specific hero card or a universal tier card (random unowned hero). */
  recruitWithCard(cardId) {
    const itemCfg = INVENTORY_ITEMS[cardId];
    if (!itemCfg) return { success: false, reason: 'Unknown card.' };

    if (!this._h._inv?.hasItem(cardId)) {
      return { success: false, reason: `You don't have a ${itemCfg.name}.` };
    }

    let heroId = null;

    if (itemCfg.type === 'hero_card') {
      heroId = itemCfg.targetHeroId;
      if (this._h._owned.has(heroId)) {
        return { success: false, reason: `${HEROES_CONFIG[heroId]?.name ?? heroId} is already in your roster.` };
      }

    } else if (itemCfg.type === 'hero_card_universal') {
      const tier       = itemCfg.targetTier;
      const candidates = Object.values(HEROES_CONFIG)
        .filter(cfg => cfg.tier === tier && !this._h._owned.has(cfg.id));
      if (candidates.length === 0) {
        return { success: false, reason: `You already own all ${tier} heroes!` };
      }
      heroId = candidates[Math.floor(Math.random() * candidates.length)].id;

    } else {
      return { success: false, reason: 'This item is not a hero card.' };
    }

    const cfg = HEROES_CONFIG[heroId];
    if (!cfg) return { success: false, reason: 'Hero config not found.' };

    this._h._inv.removeItem(cardId, 1);
    this._recruitHero(heroId);
    eventBus.emit('heroes:updated', this._h.getRosterWithState());
    return { success: true, heroId };
  }
}
