export const MAIL_CATEGORIES = ['reports', 'rewards', 'system', 'starred', 'trash'];

const REWARD_TYPES = new Set(['quest', 'achievement']);

export function inCategory(msg, cat) {
  if (cat === 'trash') return !!msg.isInTrash;
  if (msg.isInTrash) return false;
  if (cat === 'starred') return !!msg.isImportant;
  if (cat === 'reports') return msg.type === 'combat';
  if (cat === 'rewards') return REWARD_TYPES.has(msg.type);
  if (cat === 'system') return msg.type !== 'combat' && !REWARD_TYPES.has(msg.type);
  return false;
}

export function isClaimable(msg) {
  return !!msg.attachments && Object.keys(msg.attachments).length > 0 && !msg.rewardsClaimed && !msg.isInTrash;
}

export function categoryCounts(messages) {
  const counts = Object.fromEntries(MAIL_CATEGORIES.map(c => [c, { total: 0, unread: 0, claimable: 0 }]));
  for (const msg of messages) {
    for (const cat of MAIL_CATEGORIES) {
      if (!inCategory(msg, cat)) continue;
      const c = counts[cat];
      c.total++;
      if (cat !== 'trash' && !msg.isRead) c.unread++;
      if (isClaimable(msg)) c.claimable++;
    }
  }
  return counts;
}

export function unreadCount(messages) {
  return messages.filter(m => !m.isRead && !m.isInTrash).length;
}

export function deletableRead(messages, cat) {
  return messages
    .filter(m => inCategory(m, cat) && m.isRead && !m.isImportant && !isClaimable(m) && !m.isInTrash)
    .map(m => m.id);
}
