import { icon, iconFromEmoji } from '../icons.js';
import { escapeHtml } from '../uiUtils.js';
import { effectValueAt, levelCapFor, MAJOR_SKILL_STAR_GATE } from '../../systems/hero/heroSkills.js';
import { skillEffectActivation } from '../../systems/hero/heroSkillActivation.js';

const GROUP_ORDER = [
  { key: 'passive', label: 'Passive', iconName: 'xp' },
  { key: 'support', label: 'Support', iconName: 'lightning' },
  { key: 'major',   label: 'Major',   iconName: 'star-burst' },
];

function baseValueFor(skill, kind) {
  const fx = skill.effect ?? {};
  return fx.stat === kind ? fx.value : fx[kind];
}

function magnitudeHtml(skill, kind) {
  const base = baseValueFor(skill, kind);
  if (typeof base !== 'number') return '';
  return ` +${Math.round(effectValueAt(skill, base, skill.level) * 100)}%`;
}

function effectRowsHtml(hero, skill) {
  return skillEffectActivation(hero, skill).map(entry => `
    <span class="hero-skill-effect hero-skill-effect--${entry.active ? 'live' : 'dormant'}">
      ${entry.active ? '' : icon('lock')}
      ${escapeHtml(entry.label)}${magnitudeHtml(skill, entry.kind)}
      ${entry.active ? '' : `<em class="hero-skill-effect-req">active when ${escapeHtml(entry.requirement)}</em>`}
    </span>`).join('');
}

function lockThresholdHtml(skill) {
  return skill.type === 'major'
    ? `<span class="hero-skill-unlock">${MAJOR_SKILL_STAR_GATE}★</span>`
    : `<span class="hero-skill-unlock">Lv.${skill.unlockLevel ?? 1}</span>`;
}

function levelControlsHtml(skill, shardQty) {
  const cap = levelCapFor(skill);
  const affordable = skill.nextCost > 0 && shardQty >= skill.nextCost;
  const button = skill.atCap
    ? `<span class="hero-skill-maxed">MAX</span>`
    : `<button class="btn btn-xs skill-level-up ${affordable ? 'btn-gold' : 'btn-ghost'}"
               data-skill-id="${escapeHtml(skill.id)}" ${affordable ? '' : 'disabled'}
               title="${affordable ? `Spend ${skill.nextCost} Hero Shards` : `Need ${skill.nextCost} Hero Shards (have ${shardQty})`}">
         ⬆ ${skill.nextCost}
       </button>`;
  return `<span class="hero-skill-level-pip">L${skill.level}/${cap}</span>${button}`;
}

function skillRowHtml(hero, skill, shardQty) {
  const locked = !skill.unlocked;
  const glyph  = locked ? icon('lock') : (iconFromEmoji(skill.icon ?? '') || icon('lightning'));
  return `
    <div class="hero-skill-slot ${locked ? 'hero-skill-slot--locked' : `hero-skill-slot--${skill.type}`}"
         data-skill-id="${escapeHtml(skill.id)}">
      <span class="hero-skill-icon">${glyph}</span>
      <div class="hero-skill-info">
        <span class="hero-skill-name">${escapeHtml(skill.name)}</span>
        <span class="hero-skill-desc">${escapeHtml(skill.description ?? '')}</span>
        ${locked ? '' : `<div class="hero-skill-effects">${effectRowsHtml(hero, skill)}</div>`}
      </div>
      <div class="hero-skill-actions">
        ${locked ? lockThresholdHtml(skill) : levelControlsHtml(skill, shardQty)}
      </div>
    </div>`;
}

export function renderSkillSection(groups, hero) {
  const shardQty = hero?.shardQty ?? 0;
  return GROUP_ORDER.map(({ key, label, iconName }) => {
    const skills = groups?.[key] ?? [];
    if (skills.length === 0) return '';
    return `
      <div class="hero-skill-group hero-skill-group--${key}">
        <div class="hero-skill-group-title">${icon(iconName)} ${label}</div>
        ${skills.map(skill => skillRowHtml(hero, skill, shardQty)).join('')}
      </div>`;
  }).join('');
}

export function bindSkillSection(root, onLevelUp) {
  root.querySelectorAll('.skill-level-up').forEach(btn => {
    btn.addEventListener('click', e => onLevelUp(e.currentTarget.dataset.skillId));
  });
}
