import { RES_META, fmt } from '../uiUtils.js';
import { icon } from '../icons.js';

const plural = (n, word) => `${n} ${word}`;

export function battleResultHtml({ victory, rewards, reducedReward, dead, wounded }) {
  const rewardChips = rewards && victory
    ? Object.entries(rewards).map(([r, v], i) =>
        `<div class="battle-reward-chip" style="animation-delay:${0.2 + i * 0.1}s">${RES_META[r]?.icon ?? ''} +${fmt(v)} ${r}</div>`
      ).join('')
    : '';
  const blurb = victory
    ? (reducedReward ? `${icon('warning', 'icon--warning')} Reduced loot — no more full rewards from this encounter.` : 'Your forces triumphed!')
    : 'Your forces were overwhelmed. Regroup and try again!';
  const losses = dead + wounded > 0
    ? `<p style="color:var(--clr-text-muted);font-size:var(--text-sm)">${plural(dead, 'dead')} · ${plural(wounded, 'wounded')}</p>`
    : '';
  return `
    <div class="battle-result">
      <span class="battle-result-icon">${victory ? icon('star-burst', 'icon--gold icon--appear') : icon('skull', 'icon--danger icon--appear')}</span>
      <div class="battle-result-title ${victory ? 'victory' : 'defeat'}">${victory ? 'Victory!' : 'Defeated!'}</div>
      <p style="color:var(--clr-text-secondary)">${blurb}</p>
      ${losses}
      ${rewards && victory ? `<div class="battle-rewards">${rewardChips}</div>` : ''}
    </div>`;
}
