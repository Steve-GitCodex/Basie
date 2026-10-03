/**
 * UserManager.js
 * Manages the player profile: name, level, XP, and settings.
 * In a future version, would handle Firebase Auth state.
 */
import { eventBus } from '../core/EventBus.js';
import { DAILY_LOGIN_REWARDS, DAILY_LOGIN_MILESTONE, VIP_TIERS } from '../entities/GAME_DATA.js';

const XP_PER_LEVEL_BASE = 500;

export class UserManager {
  constructor() {
    this.name = 'UserManager';
    this._vipTier = 0; // cached computed value — restored on boot via broadcastVipState()
    this._profile = {
      username:              'Commander',
      level:                 1,
      xp:                    0,
      xpToNext:              XP_PER_LEVEL_BASE,
      isGuest:               false,
      lastLoginDate:         null,   // ISO date string 'YYYY-MM-DD'
      loginStreak:           0,
      totalDaysPlayed:       0,
      hasCompletedTutorial:  false,
      tutorialStep:          0,
      stats: {
        battlesWon:         0,
        battlesLost:        0,
        unitsTrainedTotal:  0,
        buildingsCompleted: 0,
        questsCompleted:    0,
        researchCompleted:  0,
        heroesRecruited:    0,
        marketTradesTotal:  0,
        diamondsSpent:      0,
        timePlayed:         0,   // seconds
        waveHighScore:      0,
        moneyEarned:        0,
        ironEarned:         0,
      },
    };

    // Auto-increment stats from EventBus events
    eventBus.on('combat:victory',    ()  => this.incrementStat('battlesWon'));
    eventBus.on('combat:defeat',     ()  => this.incrementStat('battlesLost'));
    eventBus.on('unit:trained',      d   => this.incrementStat('unitsTrainedTotal', d?.count ?? 1));
    eventBus.on('building:completed',()  => this.incrementStat('buildingsCompleted'));
    eventBus.on('quest:completed',   ()  => this.incrementStat('questsCompleted'));
    eventBus.on('tech:researched',   ()  => this.incrementStat('researchCompleted'));
    eventBus.on('hero:recruited',    ()  => this.incrementStat('heroesRecruited'));
    eventBus.on('market:exchanged',     ()  => this.incrementStat('marketTradesTotal'));
    eventBus.on('resources:spent',   c   => { if (c?.diamond) this.spendDiamonds(c.diamond); });
    // Track cumulative earnings silently (high-frequency — no UI event emitted)
    eventBus.on('resources:added',   r   => {
      if (r?.money) this._profile.stats.moneyEarned += r.money;
      if (r?.iron)  this._profile.stats.ironEarned  += r.iron;
    });
  }

  /**
   * Increment a named stat and emit user:statsUpdated.
   * @param {string} key — key in this._profile.stats
   * @param {number} amount
   */
  incrementStat(key, amount = 1) {
    if (!(key in this._profile.stats)) return;
    this._profile.stats[key] += amount;
    eventBus.emit('user:statsUpdated', { stats: { ...this._profile.stats } });
  }

  /**
   * Update waveHighScore only if score exceeds the current record.
   * @param {number} score
   */
  setWaveHighScore(score) {
    if (typeof score !== 'number' || score <= this._profile.stats.waveHighScore) return;
    this._profile.stats.waveHighScore = score;
    eventBus.emit('user:statsUpdated', { stats: { ...this._profile.stats } });
  }

  /** Quick read-only access to the raw profile (no copy) — use getProfile() for a safe copy. */
  get profile() { return this._profile; }

  getProfile() { return { ...this._profile }; }

  /**
   * Mark the new-player tutorial as completed and persist immediately.
   */
  completeTutorial() {
    this._profile.hasCompletedTutorial = true;
    this._profile.tutorialStep = 0;
    eventBus.emit('tutorial:complete');
  }

  /** Persist which tutorial step the player reached so a refresh can resume there. */
  setTutorialStep(index) {
    this._profile.tutorialStep = index;
  }

  setUsername(name) {
    this._profile.username = name || 'Commander';
    eventBus.emit('user:profileUpdated', this.getProfile());
  }

  /**
   * Call once on game launch. Detects if today is a new calendar day,
   * increments (or resets) the streak, and emits 'user:dailyLogin'.
   * Returns { day, streak, rewards } or null if already logged in today.
   */
  checkDailyLogin() {
    const todayStr = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const last     = this._profile.lastLoginDate;

    if (last === todayStr) return null;   // already claimed today

    // Calculate streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (last === yesterdayStr) {
      this._profile.loginStreak++;        // consecutive day
    } else {
      this._profile.loginStreak = 1;      // gap > 1 day — reset
    }

    this._profile.lastLoginDate   = todayStr;
    this._profile.totalDaysPlayed = (this._profile.totalDaysPlayed || 0) + 1;

    const streak = this._profile.loginStreak;

    // Milestone every 30 consecutive days
    const dayIndex = (streak - 1) % DAILY_LOGIN_REWARDS.length;
    const day      = dayIndex + 1;
    const rewards  = streak % 30 === 0
      ? DAILY_LOGIN_MILESTONE
      : DAILY_LOGIN_REWARDS[dayIndex].rewards;

    const payload = { day, streak, rewards };
    eventBus.emit('dailyLogin:claimed', payload);
    return payload;
  }

  /**
   * Add experience points and trigger level-up if threshold met.
   * @param {number} amount
   */
  addXP(amount) {
    this._profile.xp += amount;
    while (this._profile.xp >= this._profile.xpToNext) {
      this._profile.xp -= this._profile.xpToNext;
      this._profile.level++;
      this._profile.xpToNext = Math.floor(XP_PER_LEVEL_BASE * Math.pow(1.4, this._profile.level - 1));
      eventBus.emit('user:levelUp', { level: this._profile.level });
    }
    eventBus.emit('user:xpGained', { xp: amount, profile: this.getProfile() });
  }

  setGuest(isGuest) {
    this._profile.isGuest = isGuest;
  }

  /**
   * Aggregate VIP perks from tier 0 up to (and including) `tier`.
   * Each VIP_TIERS entry lists the INCREMENTAL perk delta for that tier.
   * @param {number} tier
   * @returns {{ extraBuildSlots:number, extraResearchSlots:number, buildTimeReduction:number, trainReduction:number, researchReduction:number, productionBonus:number }}
   */
  _computeAggregatedPerks(tier) {
    const totals = {
      extraBuildSlots:    0,
      extraResearchSlots: 0,
      buildTimeReduction: 0,
      trainReduction:     0,
      researchReduction:  0,
      productionBonus:    0,
    };
    for (const t of VIP_TIERS) {
      if (t.tier > tier) break;
      const p = t.perks ?? {};
      totals.extraBuildSlots    += p.extraBuildSlots    ?? 0;
      totals.extraResearchSlots += p.extraResearchSlots ?? 0;
      totals.buildTimeReduction += p.buildTimeReduction ?? 0;
      totals.trainReduction     += p.trainReduction     ?? 0;
      totals.researchReduction  += p.researchReduction  ?? 0;
      totals.productionBonus    += p.productionBonus    ?? 0;
    }
    return totals;
  }

  /**
   * Returns the player's current VIP tier (0 = no VIP) based on cumulative diamond spend.
   * Pure computation — not stored in _profile to avoid stale deserialization.
   * @returns {number} 0–10
   */
  getVipTier() {
    const spent = this._profile.stats.diamondsSpent;
    let tier = 0;
    for (const t of VIP_TIERS) {
      if (spent >= t.threshold) tier = t.tier;
    }
    return tier;
  }

  /**
   * Record a diamond spend (from shop purchase) and emit user:vipUpdate if the tier changes.
   * @param {number} amount — diamonds spent
   */
  spendDiamonds(amount) {
    if (!amount || amount <= 0) return;
    this._profile.stats.diamondsSpent += amount;
    eventBus.emit('user:statsUpdated', { stats: { ...this._profile.stats } });
    const newTier = this.getVipTier();
    if (newTier !== this._vipTier) {
      const prevTier = this._vipTier;
      this._vipTier = newTier;
      const perks      = this._computeAggregatedPerks(newTier);
      const prevPerks  = this._computeAggregatedPerks(prevTier);
      const deltaPerks = {
        extraBuildSlots:    perks.extraBuildSlots    - prevPerks.extraBuildSlots,
        extraResearchSlots: perks.extraResearchSlots - prevPerks.extraResearchSlots,
        buildTimeReduction: perks.buildTimeReduction - prevPerks.buildTimeReduction,
        trainReduction:     perks.trainReduction     - prevPerks.trainReduction,
        researchReduction:  perks.researchReduction  - prevPerks.researchReduction,
        productionBonus:    perks.productionBonus    - prevPerks.productionBonus,
      };
      eventBus.emit('user:vipUpdate', { tier: newTier, prevTier, isInit: false, perks, deltaPerks });
    }
  }

  /**
   * Broadcast the current VIP state to all managers on game boot.
   * Call this after all managers are subscribed (after UI init and offline simulation).
   */
  broadcastVipState() {
    const tier  = this.getVipTier();
    this._vipTier = tier;
    const perks = this._computeAggregatedPerks(tier);
    eventBus.emit('user:vipUpdate', { tier, prevTier: 0, isInit: true, perks, deltaPerks: perks });
  }

  update(dt) {
    this._profile.stats.timePlayed += dt;
  }

  serialize() { return { ...this._profile, stats: { ...this._profile.stats } }; }

  deserialize(data) {
    if (!data) return;
    const { stats, ...rest } = data;
    Object.assign(this._profile, rest);
    // Deep-merge stats so old saves (without stats key) don't lose defaults
    if (stats) {
      Object.assign(this._profile.stats, stats);
    }
  }
}
