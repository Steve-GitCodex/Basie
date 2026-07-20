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
