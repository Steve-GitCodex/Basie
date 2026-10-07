import { eventBus } from '../../../core/EventBus.js';
import { icon } from '../../icons.js';
import { escapeHtml } from '../../uiUtils.js';
import { estimateBadge } from '../estimateBadge.js';
import { SURVIVAL_STAGE_ID, stageById } from '../../../systems/campaign/campaignStages.js';

function warningHtml(name, winPct) {
  return `
    <div class="modal-inner">
      <div class="modal-top">
        <div class="modal-title-block"><div class="modal-title">${icon('warning')} Low Readiness</div></div>
      </div>
      <div style="text-align:center;padding:var(--space-6) var(--space-4)">
        <div style="font-size:3rem;margin-bottom:var(--space-3)">${icon('skull', 'icon--xl icon--danger')}</div>
        <p style="color:var(--clr-warning);font-weight:700;font-size:var(--text-lg);margin-bottom:var(--space-2)">
          ~${winPct}% estimated win chance
        </p>
        <p style="color:var(--clr-text-secondary);margin-bottom:var(--space-5)">
          Your squad may be too weak for <strong>${escapeHtml(name)}</strong>. You'll almost certainly be defeated — but nothing stops you from trying.
        </p>
        <div style="display:flex;gap:var(--space-3);justify-content:center">
          <button class="btn btn-secondary" id="btn-warn-cancel">Cancel</button>
          <button class="btn btn-danger" id="btn-warn-proceed">${icon('sword')} Fight Anyway</button>
        </div>
      </div>
    </div>`;
}

function showWarning(name, winPct, onProceed) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  if (!overlay || !content) return;
  content.innerHTML = warningHtml(name, winPct);
  overlay.classList.remove('hidden');
  const dismiss = () => {
    overlay.classList.add('hidden');
    content.innerHTML = '';
  };
  content.querySelector('#btn-warn-cancel').addEventListener('click', dismiss);
  content.querySelector('#btn-warn-proceed').addEventListener('click', () => {
    dismiss();
    onProceed();
  });
}

export function confirmDeploy(systems, { stageId, squadId, onProceed }) {
  if (stageId === SURVIVAL_STAGE_ID) {
    onProceed();
    return;
  }
  const monster = stageById(stageId)?.monster;
  if (!monster) return;
  if (!systems.um.getSquad(squadId)?.units.length) {
    eventBus.emit('ui:error');
    systems.notifications?.show('warning', 'Empty Squad!', 'This squad has no units to send.');
    return;
  }
  const est = systems.cm.estimateBattle(squadId, monster.id);
  if (estimateBadge(est).cls === 'weak') showWarning(monster.name, Math.round(est.winChance * 100), onProceed);
  else onProceed();
}
