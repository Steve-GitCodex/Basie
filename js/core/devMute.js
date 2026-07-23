/**
 * devMute.js
 * Shared dev-only state: whether story-chapter, achievement, and quest-
 * completion popups are silenced during a `?dev` session (ADR 0014) so
 * playtesting/inspection isn't interrupted by every trigger. Lives in core
 * so both systems (NotificationManager) and UI (UIManager, QuestsUI,
 * NavigationUI) can read it without crossing the tier boundary. Real
 * (non-dev) sessions are never muted.
 */
import { isDevSession } from './devSession.js';

const _muted = {
  story: isDevSession(),
  achievements: isDevSession(),
  quests: isDevSession(),
};

export const devMute = {
  isMuted(key) { return !!_muted[key]; },
  toggle(key) { _muted[key] = !_muted[key]; return _muted[key]; },
};
