import { eventBus } from '../../core/EventBus.js';
import { icon } from '../icons.js';
import { estimateBadge } from './estimateBadge.js';
import { stagePanelHtml } from './stagePanelHtml.js';
import { commandersHtml } from './commandersPanel.js';
import { commanderModel } from './commanderModel.js';
import { stageById } from '../../systems/campaign/campaignStages.js';

const OPEN = 'campaign-stage-panel--open';
const BADGE_ICONS = { weak: () => icon('warning'), risky: () => icon('lightning'), ready: () => icon('check', 'icon--success') };

export class StagePanel {
  constructor(el, systems, { onDeploy }) {
    this._el = el;
    this._s = systems;
    this._onDeploy = onDeploy;
    this._stageId = null;
    this._squadId = null;
    this._canAttack = false;
    this._dom = {};
    document.addEventListener('click', e => {
      const dropdown = this._dom.dropdown;
      if (dropdown && !dropdown.contains(e.target)) dropdown.classList.remove('open');
    }, { capture: true });
    el.addEventListener('transitionend', e => {
      if (e.target === el && e.propertyName === 'transform') eventBus.emit('tutorial:retarget');
    });
    eventBus.on('ui:viewChanged', view => {
      if (view === 'combat' && this._stageId) this.open(this._stageId);
    });
  }

  get stageId() {
    return this._stageId;
  }

  open(stageId) {
    const stage = stageById(stageId);
    if (!stage) return;
    const state = this._s.campaign.getStageStates().get(stageId) ?? { isAvailable: false, lockReason: null };
    const squads = this._s.um.getSquads();
    this._stageId = stageId;
    this._canAttack = !!state.isAvailable;
    this._squadId = squads.some(s => s.id === this._squadId) ? this._squadId : squads[0]?.id ?? null;
    this._el.innerHTML = stagePanelHtml({
      stage, state, squads,
      squadId: this._squadId,
      progress: this._s.campaign.getProgress(stageId),
      modifier: this._canAttack ? this._s.cm.rollModifierForStage?.(stageId) ?? null : null,
      loot: this._lootState(stage),
    });
    this._cacheDom();
    this._wire();
    this._refreshSquad();
    this._el.classList.add(OPEN);
    this._el.setAttribute('aria-hidden', 'false');
    eventBus.emit('tutorial:retarget');
  }

  close() {
    this._stageId = null;
    this._el.classList.remove(OPEN);
    this._el.setAttribute('aria-hidden', 'true');
    eventBus.emit('tutorial:retarget');
  }

  refreshEstimate() {
    const { badge } = this._dom;
    if (!badge) return;
    if (!this._canAttack || !this._squadId) {
      badge.innerHTML = '';
      return;
    }
    const { cls, label } = estimateBadge(this._s.cm.estimateBattle(this._squadId, this._stageId));
    badge.innerHTML = `<span class="readiness-badge ${cls}">${BADGE_ICONS[cls]()} ${label}</span>`;
  }

  _refreshSquad() {
    this.refreshEstimate();
    const { commanders } = this._dom;
    if (!commanders) return;
    commanders.innerHTML = this._squadId && this._s.heroes ? commandersHtml(commanderModel(this._s, this._squadId)) : '';
  }

  _lootState(stage) {
    const { victories, rewardsRemaining } = this._s.cm.getMonsterProgress(stage.id);
    return { victories, rewardsRemaining, isReduced: victories > 0 && rewardsRemaining === 0 };
  }

  _cacheDom() {
    const el = this._el;
    this._dom = {
      dropdown: el.querySelector('.squad-dropdown'),
      trigger: el.querySelector('.squad-dropdown-trigger'),
      label: el.querySelector('.squad-select-label'),
      hidden: el.querySelector('#squad-select'),
      badge: el.querySelector('#readiness-badge-area'),
      commanders: el.querySelector('.stage-panel__commanders'),
      deploy: el.querySelector('#btn-campaign-attack'),
    };
  }

  _wire() {
    const { dropdown, trigger, commanders, deploy } = this._dom;
    this._el.querySelector('.stage-panel__close').addEventListener('click', () => {
      eventBus.emit('ui:click');
      this.close();
    });
    trigger.addEventListener('click', () => {
      eventBus.emit('ui:click');
      dropdown.classList.toggle('open');
    });
    dropdown.querySelectorAll('.squad-dropdown-option').forEach(opt => {
      opt.addEventListener('click', () => this._pickSquad(opt));
    });
    commanders.addEventListener('click', e => {
      if (!e.target.closest('.commander-row__assign')) return;
      eventBus.emit('ui:click');
      eventBus.emit('ui:navigateTo', 'heroes');
    });
    deploy.addEventListener('click', () => {
      eventBus.emit('ui:click');
      if (this._squadId) this._onDeploy(this._stageId, this._squadId);
    });
  }

  _pickSquad(opt) {
    const { dropdown, label, hidden } = this._dom;
    eventBus.emit('ui:click');
    this._squadId = opt.dataset.value;
    hidden.value = this._squadId;
    label.innerHTML = opt.innerHTML;
    dropdown.querySelectorAll('.squad-dropdown-option').forEach(o => o.classList.toggle('selected', o === opt));
    dropdown.classList.remove('open');
    this._refreshSquad();
  }
}
