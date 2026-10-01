import { AWAKENING_CONFIG } from '../../entities/GAME_DATA.js';
import { MAJOR_SKILL_STAR_GATE } from '../../systems/hero/heroSkills.js';
import { icon } from '../icons.js';
import { escapeHtml } from '../uiUtils.js';
import { renderSkillSection } from './heroSkillSection.js';
import { starsHtml } from './heroCardView.js';

const TAB_LABELS = { skills: 'Skills', awakening: 'Awakening', lore: 'Lore' };

export function tabsFor(hero) {
  return hero.isOwned ? ['skills', 'awakening', 'lore'] : ['skills', 'lore'];
}

function tabLabel(hero, tab) {
  return tab === 'awakening' ? `Awakening ★${hero.stars}` : TAB_LABELS[tab];
}

function skillsHtml(hero) {
  return renderSkillSection(hero.skills, hero) || '<span class="hero-skills-empty">No skills defined.</span>';
}

function awakeningHtml(hero) {
  const atMax = hero.stars >= AWAKENING_CONFIG.maxStars;
  const action = atMax
    ? `<div class="hero-awaken-maxed">${icon('star-burst', 'icon--gold')} Fully Awakened</div>`
    : `<button type="button" class="btn ${hero.canAwakenByShard ? 'btn-primary' : 'hq-btn-secondary'} btn-awaken-shard"
               data-action="awaken" ${hero.canAwakenByShard ? '' : 'disabled'}>
         Awaken to ★${hero.stars + 1} · ${hero.shardQty ?? 0} / ${hero.nextStarShardCost ?? 0} shards
       </button>`;
  return `
    <div class="hq-awaken">
      <div class="hero-stars-row">${starsHtml(hero.stars)}</div>
      <p class="hq-awaken__note">Spend Hero Shards to add a star. The Major skill unlocks at ${MAJOR_SKILL_STAR_GATE}★.</p>
      ${action}
    </div>`;
}

function loreHtml(hero) {
  return `
    <p class="hero-description">${escapeHtml(hero.description ?? '')}</p>
    ${hero.backstory ? `<p class="hero-backstory">${escapeHtml(hero.backstory)}</p>` : ''}`;
}

const BODY_RENDERERS = {
  skills:    hero => `<div class="hero-skill-groups">${skillsHtml(hero)}</div>`,
  awakening: awakeningHtml,
  lore:      loreHtml,
};

export function detailTabsHtml(hero, activeTab) {
  const tabs = tabsFor(hero);
  const active = tabs.includes(activeTab) ? activeTab : tabs[0];
  return `
    <div class="hq-tabs" role="tablist">
      ${tabs.map(tab => `
        <button type="button" role="tab" id="hq-tab-${tab}" aria-controls="hq-tabpanel-${tab}" class="hq-tab${tab === active ? ' hq-tab--active' : ''}"
                data-action="tab" data-tab="${tab}" aria-selected="${tab === active}">${tabLabel(hero, tab)}</button>`).join('')}
      ${hero.isOwned ? `<span class="hq-tabs__aside">${icon('star-burst', 'icon--gold')} <span class="hero-skill-shard-qty">${hero.shardQty ?? 0}</span> Hero Shards</span>` : ''}
    </div>
    ${tabs.map(tab => `
      <div class="hq-tab-body${tab === active ? '' : ' hidden'}" id="hq-tabpanel-${tab}" role="tabpanel" aria-labelledby="hq-tab-${tab}" data-tab-body="${tab}">${BODY_RENDERERS[tab](hero)}</div>`).join('')}`;
}

export function selectDetailTab(root, tab) {
  root.querySelectorAll('.hq-tab').forEach(btn => {
    const on = btn.dataset.tab === tab;
    btn.classList.toggle('hq-tab--active', on);
    btn.setAttribute('aria-selected', String(on));
  });
  root.querySelectorAll('[data-tab-body]').forEach(body => body.classList.toggle('hidden', body.dataset.tabBody !== tab));
}

export function patchDetailTabs(root, hero) {
  const skills = root.querySelector('[data-tab-body="skills"] .hero-skill-groups');
  if (skills) skills.innerHTML = skillsHtml(hero);
  const awakening = root.querySelector('[data-tab-body="awakening"]');
  if (awakening) awakening.innerHTML = awakeningHtml(hero);
  const awakeningTab = root.querySelector('.hq-tab[data-tab="awakening"]');
  if (awakeningTab) awakeningTab.textContent = tabLabel(hero, 'awakening');
  const shardQty = root.querySelector('.hero-skill-shard-qty');
  if (shardQty) shardQty.textContent = String(hero.shardQty ?? 0);
}
