/**
 * DevPopupMuter.js
 * Dev-only floating widget (`?dev` sessions only): toggle story-chapter,
 * achievement, and quest-completion popups on/off so playtesting isn't
 * interrupted by every trigger, without losing the ability to see them on
 * demand.
 */
import { devMute } from '../../core/devMute.js';

const TOGGLES = [
  { key: 'story', label: 'Story popups' },
  { key: 'achievements', label: 'Achievement popups' },
  { key: 'quests', label: 'Quest popups' },
];

export class DevPopupMuter {
  init() {
    const el = document.createElement('div');
    el.className = 'dev-widget dev-popup-muter';
    el.innerHTML = `
      <strong>Dev: popups</strong>
      ${TOGGLES.map(t => `
        <label>
          <input type="checkbox" data-dev-mute="${t.key}" ${devMute.isMuted(t.key) ? '' : 'checked'} />
          ${t.label}
        </label>
      `).join('')}
    `;
    document.body.appendChild(el);

    el.querySelectorAll('[data-dev-mute]').forEach(input => {
      input.addEventListener('change', () => devMute.toggle(input.dataset.devMute));
    });
  }
}
