import { escapeHtml, fmt } from '../uiUtils.js';

const total = (byType) => Object.values(byType ?? {}).reduce((sum, n) => sum + n, 0);

const stat = (label, value) => `<dt>${label}</dt><dd>${value}</dd>`;

export function battleReportHtml(report) {
  const outcome = report.victory ? 'win' : 'loss';
  return `
    <div class="mail-report mail-report--${outcome}">
      <div class="mail-report__banner">${report.victory ? 'VICTORY' : 'DEFEAT'}</div>
      <div class="mail-report__sides">
        <div class="mail-report__side">
          <h4 class="mail-report__name">Your squad</h4>
          <dl class="mail-report__stats">
            ${stat('Sent', fmt(report.sent))}
            ${stat('Dead', fmt(total(report.dead)))}
            ${stat('Wounded', fmt(total(report.wounded)))}
          </dl>
        </div>
        <div class="mail-report__vs">vs</div>
        <div class="mail-report__side">
          <h4 class="mail-report__name">${escapeHtml(report.enemyName)}</h4>
          <dl class="mail-report__stats">
            ${stat('Left', `${Math.round(report.enemyLeftPct)}%`)}
            ${stat('Rounds', fmt(report.rounds))}
          </dl>
        </div>
      </div>
    </div>`;
}
