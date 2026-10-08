import test from 'node:test';
import assert from 'node:assert/strict';

import { MailManager } from '../../js/systems/MailManager.js';

test('legacy save with gaps from deleted mail assigns nextId past the max existing id', () => {
  const mm = new MailManager();
  mm.deserialize({ messages: [{ id: 1, subject: 'a' }, { id: 2, subject: 'b' }, { id: 7, subject: 'c' }] });

  mm.send({ subject: 'new1', body: '' });
  mm.send({ subject: 'new2', body: '' });
  mm.send({ subject: 'new3', body: '' });

  const ids = mm.getMessages().map(m => m.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(Math.max(...ids) > 7);
});

test('a new mail sent after loading a legacy save never collides with a pre-existing id', () => {
  const mm = new MailManager();
  mm.deserialize({ messages: [{ id: 1, subject: 'a' }, { id: 2, subject: 'b' }, { id: 7, subject: 'c' }] });

  mm.send({ subject: 'new', body: '', attachments: { wood: 100 } });
  const newMsg = mm.getMessages()[0];
  assert.notEqual(newMsg.id, 7);

  mm._inv = { grantRewards() {} };
  const result = mm.claimRewards(newMsg.id);
  assert.equal(result.success, true);
  assert.equal(result.rewards.wood, 100);
});

test('campaign:firstClear sends a First clear bonus mail with diamond attachments', async () => {
  const { eventBus } = await import('../../js/core/EventBus.js');
  const { CAMPAIGN_STAGES } = await import('../../js/systems/campaign/campaignStages.js');
  const mm = new MailManager();
  const stage = CAMPAIGN_STAGES[0];
  eventBus.emit('campaign:firstClear', { stageId: stage.id, rewards: { diamond: 5 } });
  const mail = mm.getMessages()[0];
  assert.match(mail.subject, /First clear bonus/);
  assert.deepEqual(mail.attachments, { diamond: 5 });
  assert.ok(mail.body.includes(stage.name));
});

const invStub = () => { const calls = []; return { calls, grantRewards: (a) => calls.push(a) }; };

test('claimAll grants summed rewards once and marks mails claimed and read', () => {
  const mm = new MailManager(); const inv = invStub(); mm._inv = inv;
  mm.send({ subject: 'a', body: '', attachments: { wood: 100, xp: 9 } });
  mm.send({ subject: 'b', body: '', attachments: { wood: 50, iron: 5 } });
  mm.send({ subject: 'c', body: '' });
  const ids = mm.getMessages().map(x => x.id);
  const r = mm.claimAll(ids);
  assert.equal(inv.calls.length, 1);
  assert.deepEqual(r.rewards, { wood: 150, iron: 5 });
  assert.equal(r.claimed.length, 2);
  assert.ok(mm.getMessages().filter(x => x.attachments).every(x => x.rewardsClaimed && x.isRead));
});

test('claimAll with nothing claimable emits nothing', async () => {
  const { eventBus } = await import('../../js/core/EventBus.js');
  const mm = new MailManager(); mm._inv = invStub();
  let n = 0; const off = eventBus.on('mail:updated', () => n++);
  assert.deepEqual(mm.claimAll([]), { success: false, claimed: [], rewards: {} });
  off(); assert.equal(n, 0);
});

test('claimAll survives an inventory that caps the grant and still marks every mail claimed', () => {
  const mm = new MailManager();
  mm._inv = { grantRewards: (a) => a.map(r => ({ ...r, quantity: Math.min(r.quantity, 10) })) };
  mm.send({ subject: 'a', body: '', attachments: { wood: 1e9 } });
  mm.send({ subject: 'b', body: '', attachments: { wood: 1e9 } });
  const r = mm.claimAll(mm.getMessages().map(x => x.id));
  assert.equal(r.success, true);
  assert.ok(mm.getMessages().every(x => x.rewardsClaimed));
});

test('claimRewards marks the mail read', () => {
  const mm = new MailManager(); mm._inv = invStub();
  mm.send({ subject: 'a', body: '', attachments: { wood: 1 } });
  const id = mm.getMessages()[0].id;
  mm.claimRewards(id);
  assert.equal(mm.getMessages()[0].isRead, true);
});

test('trashMany and restoreMany round-trip and unread excludes trash', () => {
  const mm = new MailManager();
  mm.send({ subject: 'a', body: '' }); mm.send({ subject: 'b', body: '' });
  const ids = mm.getMessages().map(x => x.id);
  mm.trashMany(ids); assert.equal(mm.getUnreadCount(), 0);
  mm.restoreMany(ids); assert.equal(mm.getUnreadCount(), 2);
});

test('counts agrees with getUnreadCount', () => {
  const mm = new MailManager();
  mm.send({ type: 'combat', subject: 'a', body: '' }); mm.send({ type: 'quest', subject: 'b', body: '' });
  const c = mm.counts();
  assert.equal(c.reports.unread + c.rewards.unread + c.system.unread, mm.getUnreadCount());
});

test('deserialize purges trash older than 7 days and keeps newer trash', () => {
  const mm = new MailManager(); const now = Date.now(); const day = 86_400_000;
  mm.deserialize({ messages: [
    { id: 1, type: 'system', subject: 'old', isInTrash: true, deletedAt: now - 8 * day },
    { id: 2, type: 'system', subject: 'new', isInTrash: true, deletedAt: now - 1 * day },
  ] });
  assert.deepEqual(mm.getMessages().map(x => x.id), [2]);
});

test('combat:victory mail stores a battle report', async () => {
  const { eventBus } = await import('../../js/core/EventBus.js');
  const mm = new MailManager();
  eventBus.emit('combat:victory', { monsterId: 'nope', rewards: { wood: 10, xp: 5 }, dead: { infantry: 2 },
    wounded: { infantry: 3 }, rounds: 4, sent: 40, enemyLeftPct: 0 });
  const r = mm.getMessages()[0].report;
  assert.equal(r.victory, true); assert.equal(r.sent, 40); assert.deepEqual(r.dead, { infantry: 2 });
  assert.equal(typeof r.enemyName, 'string');
});

test('mail subjects carry no emoji and messages have no icon field', async () => {
  const { eventBus } = await import('../../js/core/EventBus.js');
  const mm = new MailManager();
  eventBus.emit('combat:defeat', { monsterId: 'nope', dead: {}, wounded: {}, rounds: 1, sent: 1, enemyLeftPct: 90 });
  const msg = mm.getMessages()[0];
  assert.equal(msg.subject, 'Combat Report: Defeat');
  assert.equal('icon' in msg, false);
  assert.equal('isArchived' in msg, false);
});
