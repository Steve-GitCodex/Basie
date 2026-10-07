import { iconFromEmoji } from '../../icons.js';
import { escapeHtml } from '../../uiUtils.js';
import { SKILLS_CONFIG } from '../../../entities/GAME_DATA.js';
import { heroIcon, heroName, skillName } from '../../../systems/combat/report/battleText.js';

const SKILL_STATES = ['ready', 'firing', 'used'];
const STATE_LABEL = { ready: 'ready', firing: 'firing now', used: 'used' };
const FALLBACK_SKILL_ICON = '✦';

const shortName = (heroId) => heroName(heroId).split(' ')[0];

function portraitHtml({ heroId, level, tier }, withLevel) {
  const badge = withLevel ? `<span class="commander-portrait__lv">${level}</span>` : '';
  return `<div class="commander-portrait commander-portrait--${tier} hero-bar__portrait">${iconFromEmoji(heroIcon(heroId))}${badge}</div>`;
}

function skillHtml(skillId) {
  const icon = SKILLS_CONFIG[skillId]?.icon ?? FALLBACK_SKILL_ICON;
  return `<span class="hero-bar__skill is-ready" data-skill-id="${escapeHtml(skillId)}">${iconFromEmoji(icon)}</span>`;
}

function squadCardHtml(hero) {
  return `
    <div class="hero-bar__card" data-hero-id="${escapeHtml(hero.heroId)}">
      ${portraitHtml(hero, true)}
      <div class="hero-bar__body">
        <b class="hero-bar__name" title="${escapeHtml(heroName(hero.heroId))}">${escapeHtml(shortName(hero.heroId))}</b>
        <div class="hero-bar__skills">${hero.skillIds.map(skillHtml).join('')}</div>
      </div>
      <div class="hero-bar__kills"><b>0</b><small>KILLS</small></div>
    </div>`;
}

function supportCardHtml(hero) {
  return `
    <div class="hero-bar__card hero-bar__card--support" data-hero-id="${escapeHtml(hero.heroId)}">
      ${portraitHtml(hero, false)}
      <div class="hero-bar__body">
        <b class="hero-bar__name" title="${escapeHtml(heroName(hero.heroId))}">${escapeHtml(shortName(hero.heroId))}</b>
        <small class="hero-bar__role">support</small>
      </div>
    </div>`;
}

export class HeroBar {
  constructor(el, { squadHeroes = [], supportHeroes = [] }) {
    this._el = el;
    el.classList.add('hero-bar');
    el.innerHTML = [...squadHeroes.map(squadCardHtml), ...supportHeroes.map(supportCardHtml)].join('');
    el.classList.toggle('hidden', squadHeroes.length + supportHeroes.length === 0);
    this._cards = squadHeroes.map(({ heroId }) => {
      const card = el.querySelector(`.hero-bar__card[data-hero-id="${CSS.escape(heroId)}"]`);
      return {
        heroId,
        card,
        kills: card.querySelector('.hero-bar__kills b'),
        skills: [...card.querySelectorAll('.hero-bar__skill')].map(icon => ({ icon, skillId: icon.dataset.skillId, state: null })),
      };
    });
  }

  render(frame) {
    for (const refs of this._cards) {
      const kills = String(frame.heroKills?.[refs.heroId] ?? 0);
      if (refs.kills.textContent !== kills) refs.kills.textContent = kills;
      let firing = false;
      for (const skill of refs.skills) {
        const state = frame.skills?.[refs.heroId]?.[skill.skillId] ?? 'ready';
        firing ||= state === 'firing';
        if (skill.state !== state) this._patchSkill(skill, state);
      }
      refs.card.classList.toggle('hero-bar__card--firing', firing);
    }
  }

  _patchSkill(skill, state) {
    skill.state = state;
    for (const candidate of SKILL_STATES) skill.icon.classList.toggle(`is-${candidate}`, candidate === state);
    skill.icon.title = `${skillName(skill.skillId)} — ${STATE_LABEL[state] ?? state}`;
  }
}
