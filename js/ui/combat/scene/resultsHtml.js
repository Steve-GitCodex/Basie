import { RES_META, escapeHtml, fmt } from '../../uiUtils.js';
import { iconFromEmoji } from '../../icons.js';
import { SKILLS_CONFIG } from '../../../entities/GAME_DATA.js';
import { heroIcon, heroName, joinNames, skillName } from '../../../systems/combat/report/battleText.js';

const MAX_STARS = 3;
const FIX_LABELS = { train: 'Train troops ›', mix: 'Change the mix ›', rows: 'Rearrange rows ›', heroes: 'Assign heroes ›' };
const LAYERS = [['sent', 'SENT', ''], ['back', 'CAME BACK', 'ok'], ['wounded', 'WOUNDED', 'warn'], ['dead', 'DEAD', 'bad']];
const VERDICTS = {
  better: { text: 'Better than last try', arrow: '▲' },
  worse: { text: 'Worse than last try', arrow: '▼' },
  same: { text: 'Same as last try', arrow: '=' },
};

const skillIcon = (skillId) => iconFromEmoji(SKILLS_CONFIG[skillId]?.icon ?? '✦');

function bannerHtml({ summary, title, reason }) {
  const showStars = summary.victory && summary.stars !== null;
  const stars = showStars
    ? `<div class="results__stars" aria-label="${summary.stars} of ${MAX_STARS} stars">${'★'.repeat(summary.stars)}<i>${'★'.repeat(MAX_STARS - summary.stars)}</i></div>`
    : '';
  const grade = showStars && summary.starRules.length
    ? `<ul class="results__grade">${summary.starRules.map(rule =>
      `<li class="results__rule results__rule--${rule.pass ? 'pass' : 'fail'}">${rule.pass ? '✓' : '✗'} ${escapeHtml(rule.text)}</li>`).join('')}</ul>`
    : '';
  const sub = [title, reason].filter(Boolean).map(escapeHtml).join(' · ');
  return `
    <div class="results__banner">
      ${stars}
      <h2 class="results__title">${summary.victory ? 'VICTORY' : 'DEFEAT'}</h2>
      ${sub ? `<p class="results__sub">${sub}</p>` : ''}
      ${grade}
    </div>`;
}

function verdictOf(previous, current) {
  if (current.wavesReached !== previous.wavesReached) return current.wavesReached > previous.wavesReached ? 'better' : 'worse';
  if (current.bossLeftPct !== previous.bossLeftPct) return current.bossLeftPct < previous.bossLeftPct ? 'better' : 'worse';
  return 'same';
}

function comparisonHtml({ summary, previous, current, isSurvival }) {
  if (summary.victory || isSurvival || !previous || !current) return '';
  if (previous.victory || !Number.isFinite(previous.wavesReached) || !Number.isFinite(previous.bossLeftPct)) return '';
  const verdict = verdictOf(previous, current);
  const { text, arrow } = VERDICTS[verdict];
  const chip = current.wavesReached !== previous.wavesReached
    ? `${arrow} wave ${current.wavesReached}`
    : `${arrow} ${verdict === 'same' ? current.bossLeftPct : Math.abs(previous.bossLeftPct - current.bossLeftPct)}%`;
  const detail = `${current.waveName} left at ${current.bossLeftPct}%. Last time: ${previous.bossLeftPct}% in wave ${previous.wavesReached}.`;
  return `
    <div class="results__cmp results__cmp--${verdict}">
      <div><b>${text}</b><small>${escapeHtml(detail)}</small></div>
      <span class="results__chip">${chip}</span>
    </div>`;
}

function stackRowHtml(stack) {
  return `<tr class="results__stack-row">
      <td>${escapeHtml(stack.label)} <small>${escapeHtml(stack.row)}</small></td>
      <td>${fmt(stack.sent)}</td><td class="results__num--bad">${fmt(stack.dead)}</td>
      <td class="results__num--warn">${fmt(stack.wounded)}</td><td>${fmt(stack.back)}</td><td>${fmt(stack.kills)}</td>
    </tr>`;
}

function casualtiesHtml({ summary, healedTotal = 0 }) {
  const { layers } = summary;
  const cells = LAYERS.map(([key, label, tone]) =>
    `<div${tone ? ` class="results__num--${tone}"` : ''}><b>${layers[key]}</b><small>${label}</small></div>`).join('');
  const table = summary.victory && summary.stacks.length
    ? `<table class="results__stacks"><thead><tr><th>STACK</th><th>SENT</th><th>DEAD</th><th>WOUNDED</th><th>BACK</th><th>KILLS</th></tr></thead>
        <tbody>${summary.stacks.map(stackRowHtml).join('')}</tbody></table>`
    : `<small class="results__note">${fmt(layers.dead + layers.wounded)} fallen: ${fmt(layers.dead)} dead, ${fmt(layers.wounded)} wounded.</small>`;
  const healed = healedTotal > 0 ? `<small class="results__note">+${fmt(healedTotal)} healed after the battle</small>` : '';
  return `<section class="results__sec"><div class="results__layers">${cells}</div>${healed}${table}</section>`;
}

function portraitHtml(heroId, { level = 1, tier = 'normal' } = {}) {
  return `<div class="commander-portrait commander-portrait--${escapeHtml(tier)} results__portrait">${iconFromEmoji(heroIcon(heroId))}<span class="commander-portrait__lv">${level}</span></div>`;
}

function firedHtml(hero) {
  const fired = hero.skillsFired.map(({ skillId, round }) => `<b>${escapeHtml(skillName(skillId))}</b> (r${round})`);
  return `${hero.kills} kill${hero.kills === 1 ? '' : 's'} · ${fired.length ? `fired ${joinNames(fired)}` : 'no skills fired'}`;
}

function xpHtml(hero, meta, victory) {
  const xp = victory ? hero.xp : null;
  const bar = xp ? `<div class="results__xpbar"><i style="width:${meta.xpFrom ?? 0}%" data-to="${xp.xpPct}"></i></div>` : '';
  const unlocked = (xp?.unlockedSkills ?? []).map(id => ` · new skill ${skillIcon(id)} ${escapeHtml(skillName(id))}`).join('');
  const levelUp = xp && xp.levelAfter > xp.levelBefore
    ? `<div class="results__levelup"><b>LEVEL UP ${xp.levelBefore} → ${xp.levelAfter}</b>${unlocked}</div>`
    : '';
  const capped = xp && xp.xpGained === 0 ? ' · level cap' : '';
  return `<div class="results__xp"><span>XP${capped}</span><b>+${xp?.xpGained ?? 0}</b></div>${bar}${levelUp}`;
}

function heroCardHtml(hero, meta = {}, victory) {
  const mvp = victory && hero.mvp;
  const sub = [`Slot ${hero.slotIndex + 1}`, meta.stackLabel].filter(Boolean).map(escapeHtml).join(' · ');
  return `
    <div class="results__hero${mvp ? ' results__hero--mvp' : ''}" data-hero-id="${escapeHtml(hero.heroId)}">
      <div class="results__hero-head">${portraitHtml(hero.heroId, meta)}
        <div class="results__hero-name"><b>${escapeHtml(heroName(hero.heroId))}</b><small>${sub}</small></div>
        ${mvp ? '<span class="results__mvp">MVP</span>' : ''}
      </div>
      <p class="results__hero-line">${firedHtml(hero)}</p>
      ${xpHtml(hero, meta, victory)}
    </div>`;
}

function supportCardHtml(hero) {
  return `
    <div class="results__hero results__hero--support" data-hero-id="${escapeHtml(hero.heroId)}">
      <div class="results__hero-head">${portraitHtml(hero.heroId, hero)}
        <div class="results__hero-name"><b>${escapeHtml(heroName(hero.heroId))}</b><small>Support · HQ</small></div>
      </div>
      <p class="results__hero-line">Support heroes earn passive XP at their post, not battle XP.</p>
    </div>`;
}

function tipHtml({ summary }) {
  const slots = summary.emptySlots ?? [];
  if (!slots.length) return '';
  const names = joinNames(slots.map(slot => String(slot + 1)));
  const gain = summary.victory ? ' and earned battle XP' : '';
  return `
    <div class="results__tip"><span class="results__tip-icon">＋</span>
      <p><b>Slot${slots.length === 1 ? '' : 's'} ${names} had no commander.</b> A hero there would have added a strike every round${gain}.</p>
      <button type="button" class="btn btn-secondary btn-sm" data-fix="heroes">Assign ›</button>
    </div>`;
}

function commandersHtml(model) {
  const { summary, heroMeta = {}, supportHeroes = [] } = model;
  const cards = [
    ...summary.heroes.map(hero => heroCardHtml(hero, heroMeta[hero.heroId], summary.victory)),
    ...supportHeroes.map(supportCardHtml),
  ];
  if (!cards.length && !summary.emptySlots?.length) return '';
  const note = !summary.victory && summary.heroes.length
    ? '<small class="results__note">Heroes only earn battle XP on a win.</small>'
    : '';
  return `
    <section class="results__sec">
      <p class="results__label">Commanders</p>
      ${cards.length ? `<div class="results__heroes">${cards.join('')}</div>` : ''}
      ${note}${tipHtml(model)}
    </section>`;
}

function whyHtml({ summary, analysis = [] }) {
  if (summary.victory || !analysis.length) return '';
  const fixes = [...new Set(analysis.map(entry => entry.fix))];
  return `
    <div class="results__why"><b>Why you lost</b>
      <ul>${analysis.map(entry => `<li>${escapeHtml(entry.text)}</li>`).join('')}</ul>
      <div class="results__fixes">${fixes.map(fix =>
        `<button type="button" class="btn btn-secondary btn-sm" data-fix="${fix}">${FIX_LABELS[fix] ?? fix}</button>`).join('')}</div>
    </div>`;
}

function rewardsHtml({ summary, rewards, reducedReward, firstClearDiamonds = 0 }) {
  if (!summary.victory || (!rewards && !firstClearDiamonds)) return '';
  const chips = Object.entries(rewards ?? {}).map(([key, value]) =>
    ({ cls: 'results__reward', html: `${RES_META[key]?.icon ?? ''} +${fmt(value)} ${escapeHtml(RES_META[key]?.label ?? key)}` }));
  if (firstClearDiamonds > 0) {
    chips.push({ cls: 'results__reward results__reward--rare', html: `${RES_META.diamond.icon} +${fmt(firstClearDiamonds)} First clear` });
  }
  const note = reducedReward ? '<small class="results__note">Reduced loot — no more full rewards from this encounter.</small>' : '';
  return `
    <section class="results__sec">
      <p class="results__label">Rewards</p>
      <div class="results__rewards">${chips.map((chip, i) => `<span class="${chip.cls}" style="--i:${i}">${chip.html}</span>`).join('')}</div>
      ${note}
    </section>`;
}

function actionsHtml({ summary, next, isSurvival, turningPoint }) {
  const buttons = [];
  if (summary.victory || isSurvival) buttons.push('<button type="button" class="btn btn-secondary" id="btn-battle-replay">↻ Replay</button>');
  if (!summary.victory) {
    const label = !turningPoint || turningPoint.neverLed
      ? 'Watch the fight'
      : `Watch the turning point · Wave ${turningPoint.wave}, Round ${turningPoint.round}`;
    buttons.push(`<button type="button" class="btn btn-secondary" id="btn-battle-turning-point">↻ ${label}</button>`);
  }
  buttons.push('<button type="button" class="btn btn-secondary" id="btn-battle-close">Back to map</button>');
  if (summary.victory && next && !isSurvival) {
    buttons.push(`<button type="button" class="btn btn-primary" id="btn-battle-next" data-stage-id="${escapeHtml(next.id)}">Next: ${escapeHtml(next.name)} ›</button>`);
  }
  return `<div class="results__actions">${buttons.join('')}</div>`;
}

export function resultsHtml(model) {
  const { summary } = model;
  return `
    <div class="results results--${summary.victory ? 'victory' : 'defeat'}">
      ${bannerHtml(model)}
      ${comparisonHtml(model)}
      ${casualtiesHtml(model)}
      ${commandersHtml(model)}
      ${whyHtml(model)}
      ${rewardsHtml(model)}
      ${actionsHtml(model)}
    </div>`;
}
