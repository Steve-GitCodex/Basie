import { icon } from '../icons.js';
import { VIP_TIERS } from '../../entities/GAME_DATA.js';

const row = (label, part) =>
  `<div class="chip-popover__row"><span>${label}</span><b data-part="${part}"></b></div>`;

function vipNumeral(vipTier) {
  if (!(vipTier > 0)) return '—';
  const label = VIP_TIERS.find(t => t.tier === vipTier)?.label;
  return label ? label.replace(/^VIP\s+/, '') : String(vipTier);
}

export function commanderRows(profile, vipTier) {
  const ratio = profile.xpToNext > 0 ? Math.min(1, Math.max(0, profile.xp / profile.xpToNext)) : 0;
  return {
    name: profile.username,
    level: String(profile.level),
    xp: `${Math.floor(profile.xp).toLocaleString()} / ${Math.floor(profile.xpToNext).toLocaleString()}`,
    ratio,
    vip: vipNumeral(vipTier),
  };
}

export function commanderHtml() {
  return `<h5 class="chip-popover__title">${icon('crown', 'icon--gold')}<span data-part="name"></span></h5>
    ${row('Level', 'level')}
    <div class="chip-popover__bar"><i data-part="fill"></i></div>
    ${row('XP', 'xp')}${row('VIP', 'vip')}
    <div class="chip-popover__acts">
      <button class="btn chip-popover__btn chip-popover__btn--ghost" data-pop="profile">Profile</button>
    </div>`;
}

export function patchCommander(parts, rows) {
  parts.name.textContent = rows.name;
  parts.level.textContent = rows.level;
  parts.xp.textContent = rows.xp;
  parts.vip.textContent = rows.vip;
  parts.fill.style.width = `${(rows.ratio * 100).toFixed(1)}%`;
  parts.fill.style.setProperty('--pop-res', 'var(--clr-primary)');
}
