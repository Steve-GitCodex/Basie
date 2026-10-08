import { eventBus } from '../core/EventBus.js';
import { MONSTERS_CONFIG } from '../entities/GAME_DATA.js';
import { stageById } from './campaign/campaignStages.js';
import { categoryCounts, isClaimable, unreadCount } from './mail/mailCategories.js';

const TRASH_PURGE_MS = 7 * 86_400_000;

function withoutXp(rewards) {
  const { xp: _xp, ...rest } = rewards ?? {};
  return rest;
}

function battleReport(d, victory) {
  return {
    victory,
    enemyName:    MONSTERS_CONFIG[d.monsterId]?.name ?? stageById(d.stageId ?? d.monsterId)?.name ?? 'Unknown enemy',
    sent:         d.sent ?? 0,
    dead:         d.dead ?? {},
    wounded:      d.wounded ?? {},
    rounds:       d.rounds ?? 0,
    enemyLeftPct: d.enemyLeftPct ?? 0,
    rewards:      victory ? withoutXp(d.rewards) : null,
  };
}

export class MailManager {
  constructor() {
    this.name = 'MailManager';
    this._messages = [];
    this._nextId = 1;
    this._inv = null;
    this._registerEvents();
  }

  /** @param {import('./InventoryManager.js').InventoryManager} inv */
  setInventoryManager(inv) { this._inv = inv; }

  _registerEvents() {
    eventBus.on('combat:victory', d => {
      this.send({
        type: 'combat',
        subject: 'Combat Report: Victory',
        body: 'Your forces stood firm and defeated the enemy! All spoils of war have been recorded below. Collect them to add to your reserves.',
        attachments: withoutXp(d.rewards),
        report: battleReport(d, true),
      });
    });
    eventBus.on('combat:defeat', d => {
      this.send({
        type: 'combat',
        subject: 'Combat Report: Defeat',
        body: 'Your forces were overwhelmed and driven back. Take time to regroup, reinforce your barracks, and try again. The enemy will not forget this day.',
        report: battleReport(d ?? {}, false),
      });
    });
    eventBus.on('campaign:firstClear', d => {
      this.send({
        type: 'combat',
        subject: 'First clear bonus',
        body: `Your first clear of ${stageById(d.stageId)?.name ?? 'a campaign stage'} earned a diamond bonus. Collect it below.`,
        attachments: d.rewards,
      });
    });
    eventBus.on('quest:completed', d => {
      this.send({
        type: 'quest',
        subject: `Quest Complete: "${d.name}"`,
        body: d.description ?? 'Objective complete! Your reward is waiting to be collected.',
        attachments: d.rewards,
      });
    });
    eventBus.on('user:levelUp', d => {
      this.send({
        type: 'system',
        subject: `Level Up! You are now Level ${d.level}`,
        body: `Congratulations, Commander! Your growing experience has elevated you to Level ${d.level}. New opportunities await — new buildings, technologies, and challenges will unlock as you grow stronger.`,
        attachments: { money: d.level * 50 },
      });
    });
  }

  /** @param {{ type?: string, subject: string, body: string, attachments?: object, report?: object }} opts */
  send(opts) {
    const msg = {
      id:             this._nextId++,
      type:           opts.type ?? 'system',
      subject:        opts.subject,
      body:           opts.body,
      isRead:         false,
      isInTrash:      false,
      deletedAt:      null,
      isImportant:    false,
      attachments:    opts.attachments ?? null,
      rewardsClaimed: false,
      report:         opts.report ?? null,
      timestamp:      Date.now(),
    };
    this._messages.unshift(msg);
    eventBus.emit('mail:received', { unreadCount: this.getUnreadCount(), message: msg });
    this._emitUpdated();
  }

  markRead(id) {
    const msg = this._find(id);
    if (!msg || msg.isRead) return;
    msg.isRead = true;
    eventBus.emit('mail:read', { unreadCount: this.getUnreadCount() });
    this._emitUpdated();
  }

  markUnread(id) {
    const msg = this._find(id);
    if (!msg || !msg.isRead) return;
    msg.isRead = false;
    this._emitUpdated();
  }

  markAllRead() {
    this._messages.forEach(m => m.isRead = true);
    eventBus.emit('mail:read', { unreadCount: 0 });
    this._emitUpdated();
  }

  /** @param {number[]} ids */
  markReadMany(ids) {
    const set = new Set(ids);
    this._messages.forEach(m => { if (set.has(m.id)) m.isRead = true; });
    eventBus.emit('mail:read', { unreadCount: this.getUnreadCount() });
    this._emitUpdated();
  }

  trashMail(id)   { this.trashMany([id]); }
  restoreMail(id) { this.restoreMany([id]); }

  /** @param {number[]} ids */
  trashMany(ids) {
    const now = Date.now();
    this._forEachId(ids, m => { m.isInTrash = true; m.deletedAt = now; });
  }

  /** @param {number[]} ids */
  restoreMany(ids) {
    this._forEachId(ids, m => { m.isInTrash = false; m.deletedAt = null; });
  }

  permanentDelete(id) {
    this._messages = this._messages.filter(m => m.id !== id);
    eventBus.emit('mail:deleted', { unreadCount: this.getUnreadCount() });
    this._emitUpdated();
  }

  toggleImportant(id) {
    const msg = this._find(id);
    if (!msg) return;
    msg.isImportant = !msg.isImportant;
    this._emitUpdated();
  }

  /** @returns {{ success: boolean, rewards?: object, reason?: string }} */
  claimRewards(id) {
    if (!this._inv) return { success: false, reason: 'Inventory system not available.' };
    const msg = this._find(id);
    if (!msg)               return { success: false, reason: 'Message not found.' };
    if (!msg.attachments)   return { success: false, reason: 'No attachments.' };
    if (msg.rewardsClaimed) return { success: false, reason: 'Rewards already claimed.' };

    this._inv.grantRewards(this._rewardArray(msg.attachments));
    msg.rewardsClaimed = true;
    msg.isRead = true;
    eventBus.emit('mail:rewardsClaimed', { ids: [id], rewards: msg.attachments });
    this._emitUpdated();
    return { success: true, rewards: msg.attachments };
  }

  /** @param {number[]} ids @returns {{ success: boolean, claimed: number[], rewards: object }} */
  claimAll(ids) {
    const set = new Set(ids);
    const msgs = this._messages.filter(m => set.has(m.id) && isClaimable(m));
    if (!this._inv || msgs.length === 0) return { success: false, claimed: [], rewards: {} };

    const rewards = {};
    for (const m of msgs) {
      for (const [k, v] of Object.entries(withoutXp(m.attachments))) rewards[k] = (rewards[k] ?? 0) + v;
    }
    this._inv.grantRewards(this._rewardArray(rewards));
    msgs.forEach(m => { m.rewardsClaimed = true; m.isRead = true; });
    const claimed = msgs.map(m => m.id);
    eventBus.emit('mail:rewardsClaimed', { ids: claimed, rewards });
    this._emitUpdated();
    return { success: true, claimed, rewards };
  }

  getMessages()    { return [...this._messages].sort((a, b) => b.timestamp - a.timestamp); }
  getUnreadCount() { return unreadCount(this._messages); }
  counts()         { return categoryCounts(this._messages); }

  purgeTrash(now = Date.now()) {
    const cutoff = now - TRASH_PURGE_MS;
    this._messages = this._messages.filter(m => !(m.isInTrash && (m.deletedAt ?? now) < cutoff));
  }

  update() {}

  serialize() { return { messages: this._messages, nextId: this._nextId }; }

  deserialize(data) {
    if (!data) return;
    this._messages = (data.messages ?? []).map(m => ({
      isInTrash:      false,
      deletedAt:      null,
      isImportant:    false,
      rewardsClaimed: false,
      ...m,
    }));
    const maxExistingId = this._messages.reduce((max, m) => Math.max(max, m.id ?? 0), 0);
    this._nextId = data.nextId ?? maxExistingId + 1;
    this.purgeTrash();
    eventBus.emit('mail:received', { unreadCount: this.getUnreadCount() });
    this._emitUpdated();
  }

  _find(id) { return this._messages.find(m => m.id === id); }

  _forEachId(ids, fn) {
    const set = new Set(ids);
    this._messages.forEach(m => { if (set.has(m.id)) fn(m); });
    this._emitUpdated();
  }

  _rewardArray(attachments) {
    return Object.entries(withoutXp(attachments)).map(([k, v]) => ({ type: 'resource', itemId: k, quantity: v }));
  }

  _emitUpdated() { eventBus.emit('mail:updated', { unreadCount: this.getUnreadCount() }); }
}
