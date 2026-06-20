/**
 * ChallengesUI.js
 * Renders a Daily Pass strip + daily challenges, then a Weekly Pass strip + weekly challenges.
 * Follows the same controller pattern as QuestsUI.
 */
import { eventBus } from '../../core/EventBus.js';
import { icon, iconFromEmoji } from '../icons.js';

export class ChallengesUI {
  constructor(systems) {
    this._s = systems;
  }

  init() {
    eventBus.on('ui:viewChanged',     v => { if (v === 'challenges') this.render(); });
    eventBus.on('challenges:updated', () => this.render());
  }

  render() {
    const container = document.getElementById('challenges-list');
    if (!container) return;

    const all        = this._s.challenges.getActiveChallenges();
    const dailyPass  = this._s.challenges.getDailyPassState();
    const weeklyPass = this._s.challenges.getPassState();
    const daily      = all.filter(c => c.type === 'daily');
    const weekly     = all.filter(c => c.type === 'weekly');

    container.innerHTML = `
      ${this._renderPassStrip(`${icon('clock')} Daily Pass`, 'Resets at midnight', dailyPass, 'daily')}
      ${this._renderSection(`${icon('clock')} Daily Challenges`, daily)}
      ${this._renderPassStrip(`${icon('star-burst')} Weekly Pass`, 'Resets each Monday', weeklyPass, 'weekly')}
      ${this._renderSection(`${icon('star-burst')} Weekly Challenges`, weekly)}
    `;

    container.querySelectorAll('.btn-claim-challenge').forEach(btn => {
      btn.addEventListener('click', () => this._s.challenges.claimReward(btn.dataset.id));
    });

    container.querySelectorAll('.btn-claim-milestone').forEach(btn => {
      btn.addEventListener('click', () => {
        const result = this._s.challenges.claimPassMilestone(btn.dataset.passType, +btn.dataset.msIndex);
        if (!result?.success) return; // already handled by re-render via challenges:updated
      });
    });
  }

  /* ── Pass strip ────────────────────────────────────────────── */

  _renderPassStrip(title, subtitle, pass, passType) {
    const { xp, maxXp, milestones } = pass;
    const pct = maxXp > 0 ? Math.min(100, Math.round((xp / maxXp) * 100)) : 0;

    const chestsHtml = milestones.map(m => {
      const chestPct  = Math.round((m.xp / maxXp) * 100);
      const claimable = m.unlocked && !m.claimed;
      const classes   = [
        'pass-chest',
        m.unlocked ? 'pass-chest-unlocked'  : '',
        m.claimed  ? 'pass-chest-claimed'   : '',
        claimable  ? 'pass-chest-claimable' : '',
      ].filter(Boolean).join(' ');

      const inner = m.claimed
        ? `<span class="pass-chest-icon">${iconFromEmoji(m.icon ?? '') || icon('gift')}</span><span class="pass-chest-check">${icon('check', 'icon--success')}</span>`
        : claimable
          ? `<button class="btn-claim-milestone" data-pass-type="${passType}" data-ms-index="${m.index}" title="Claim: ${m.label}">
               <span class="pass-chest-icon">${iconFromEmoji(m.icon ?? '') || icon('gift')}</span>
               <span class="pass-chest-claim-hint">Claim</span>
             </button>`
          : `<span class="pass-chest-icon">${iconFromEmoji(m.icon ?? '') || icon('gift')}</span>`;

      return `<div class="${classes}" style="left:${chestPct}%">${inner}</div>`;
    }).join('');

    const labelsHtml = milestones.map(m => {
      const chestPct = Math.round((m.xp / maxXp) * 100);
      return `<span class="pass-milestone-label" style="left:${chestPct}%">${m.xp}</span>`;
    }).join('');

    return `
      <div class="card challenge-pass-card">
        <div class="challenge-pass-header">
          <div>
            <span class="challenge-pass-title">${title}</span>
            <span class="challenge-pass-subtitle">${subtitle}</span>
          </div>
          <span class="challenge-pass-xp">${xp} / ${maxXp} XP</span>
        </div>
        <div class="pass-track">
          <div class="pass-track-bar" style="width:${pct}%"></div>
          <div class="pass-track-milestones">${chestsHtml}</div>
        </div>
        <div class="pass-milestone-labels">${labelsHtml}</div>
      </div>
    `;
  }

  /* ── Section & cards ───────────────────────────────────────── */

  _renderSection(title, challenges) {
    return `
      <div class="challenges-section">
        <h3 class="challenges-section-title">${title}</h3>
        <div class="challenges-grid">
          ${challenges.map(c => this._renderCard(c)).join('')}
        </div>
      </div>
    `;
  }

  _renderCard(c) {
    const pct      = Math.min(100, Math.round((c.progress / c.objective.count) * 100));
    const isDone   = c.completed;
    const isClaimed = c.claimed;

    const rewardText = c.reward
      .map(r => r.type === 'resource' ? `+${r.quantity} ${r.itemId}` : r.itemId.replace(/_/g, ' '))
      .join(' · ');

    const xpBadge = c.xpReward
      ? `<span class="challenge-xp-badge">+${c.xpReward} XP</span>`
      : '';

    const btnHtml = isClaimed
      ? `<button class="btn btn-sm" disabled>${icon('check', 'icon--success')} Claimed</button>`
      : isDone
        ? `<button class="btn btn-sm btn-gold btn-claim-challenge" data-id="${c.id}">Claim</button>`
        : `<button class="btn btn-sm" disabled>Locked</button>`;

    return `
      <div class="card challenge-card ${isDone && !isClaimed ? 'challenge-claimable' : ''} ${isClaimed ? 'challenge-done' : ''}">
        <div class="challenge-card-header">
          <span class="challenge-name">${c.name}</span>
          ${xpBadge}
        </div>
        <p class="challenge-desc">${c.description}</p>
        <div class="progress-bar" style="margin:0.5rem 0">
          <div class="progress-fill progress-fill-primary" style="width:${pct}%"></div>
        </div>
        <div class="challenge-footer">
          <span class="challenge-progress">${c.progress} / ${c.objective.count}</span>
          <span class="challenge-reward">${icon('gift')} ${rewardText}</span>
          ${btnHtml}
        </div>
      </div>
    `;
  }
}

