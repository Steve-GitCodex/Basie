import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAIL_CATEGORIES, inCategory, isClaimable, categoryCounts, unreadCount, deletableRead,
} from '../../js/systems/mail/mailCategories.js';

const m = (o) => ({ id: 1, type: 'system', isRead: false, isInTrash: false, isImportant: false,
  attachments: null, rewardsClaimed: false, ...o });

test('combat mail is in reports only, plus starred when important', () => {
  const msg = m({ type: 'combat', isImportant: true });
  assert.deepEqual(MAIL_CATEGORIES.filter(c => inCategory(msg, c)), ['reports', 'starred']);
});

test('trashed mail belongs to trash only', () => {
  assert.deepEqual(MAIL_CATEGORIES.filter(c => inCategory(m({ type: 'quest', isInTrash: true, isImportant: true }), c)), ['trash']);
});

test('quest and achievement are rewards; unknown types fall to system', () => {
  assert.ok(inCategory(m({ type: 'achievement' }), 'rewards'));
  assert.ok(inCategory(m({ type: 'challenge' }), 'system'));
});

test('isClaimable needs unclaimed non-empty attachments outside trash', () => {
  assert.equal(isClaimable(m({ attachments: { wood: 5 } })), true);
  assert.equal(isClaimable(m({ attachments: {} })), false);
  assert.equal(isClaimable(m({ attachments: { wood: 5 }, rewardsClaimed: true })), false);
  assert.equal(isClaimable(m({ attachments: { wood: 5 }, isInTrash: true })), false);
});

test('categoryCounts and unreadCount ignore trash for unread', () => {
  const msgs = [m({ id: 1, type: 'combat', attachments: { iron: 3 } }), m({ id: 2, isInTrash: true }), m({ id: 3, type: 'quest', isRead: true })];
  const c = categoryCounts(msgs);
  assert.deepEqual(c.reports, { total: 1, unread: 1, claimable: 1 });
  assert.deepEqual(c.trash, { total: 1, unread: 0, claimable: 0 });
  assert.equal(unreadCount(msgs), 1);
});

test('deletableRead skips starred, unread and claimable mail', () => {
  const msgs = [
    m({ id: 1, isRead: true }), m({ id: 2, isRead: true, isImportant: true }),
    m({ id: 3 }), m({ id: 4, isRead: true, attachments: { wood: 1 } }),
  ];
  assert.deepEqual(deletableRead(msgs, 'system'), [1]);
});
