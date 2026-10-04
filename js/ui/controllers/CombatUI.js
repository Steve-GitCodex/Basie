import { eventBus } from '../../core/EventBus.js';
import { icon } from '../icons.js';
import { CombatTabs } from '../combat/CombatTabs.js';
import { CampaignTrail } from '../combat/CampaignTrail.js';
import { StagePanel } from '../combat/StagePanel.js';
import { SurvivalPane } from '../combat/SurvivalPane.js';
import { BattleLogPane } from '../combat/BattleLogPane.js';
import { startBattle } from '../combat/battleFlow.js';

const MODE_BANNERS = {
  survival: `<div class="sandbox-banner" style="background:var(--clr-danger)22;border:1px solid var(--clr-danger)44;color:var(--clr-danger)">${icon('lightning', 'icon--danger')} <strong>Survival Mode</strong> — Endless waves, escalating difficulty</div>`,
  sandbox:  `<div class="sandbox-banner">${icon('flask-potion', 'icon--gold')} <strong>Sandbox Mode</strong> — Resources Unlimited &middot; Instant Timers</div>`,
};

export class CombatUI {
  /**
   * @param {{ cm, um, bm, heroes, campaign, user, notifications, sound }} systems
   */
  constructor(systems) {
    this._s = systems;
    this._visible = false;
    this._shownMode = null;
  }

  init() {
    const view = document.getElementById('view-combat');
    if (!view) return;
    this._banner = view.querySelector('#combat-mode-banner');
    const panes = {
      campaign: view.querySelector('#combat-pane-campaign'),
      survival: view.querySelector('#combat-pane-survival'),
      log:      view.querySelector('#combat-pane-log'),
    };

    this._trail = new CampaignTrail(panes.campaign.querySelector('.campaign-trail'), {
      campaign: this._s.campaign,
      onSelect: id => this._onSelectStage(id),
    });
    this._stagePanel = new StagePanel(view.querySelector('#campaign-stage-panel'), this._s, {
      onDeploy: (stageId, squadId) => this._deploy(stageId, squadId),
    });
    this._survival = new SurvivalPane(panes.survival, this._s, {
      onFight: squadId => this._deploy('survival_wave', squadId),
    });
    this._log = new BattleLogPane(view.querySelector('#battle-log'));
    this._tabs = new CombatTabs(view.querySelector('.combat-tabs'), panes, { onShow: tab => this._onShowTab(tab) });

    new ResizeObserver(() => { if (this._visible) this._trail.renderIfResized(); })
      .observe(panes.campaign);

    eventBus.on('ui:viewChanged', v => {
      this._visible = v === 'combat';
      if (this._visible) this.render();
    });
    eventBus.on('campaign:updated', () => this._trail.patch());
    eventBus.on('combat:logUpdated', log => this._log.render(log));
    eventBus.on('game:modeChanged', () => { if (this._visible) this.render(); });
    eventBus.on('survival:waveCompleted', ({ wave }) => this._survival.setWave(wave));
    eventBus.on('survival:ended', ({ score }) => {
      this._survival.render();
      this._s.notifications?.show('info', '🌊 Survival Ended', `You survived ${score} wave${score !== 1 ? 's' : ''}! High score updated.`);
    });
  }

  render() {
    const mode = this._s.cm.getGameMode?.();
    this._banner.innerHTML = MODE_BANNERS[mode] ?? '';
    this._survival.render();
    this._log.render(this._s.cm.getBattleLog());
    this._tabs.show(this._tabFor(mode));
  }

  _tabFor(mode) {
    if (this._shownMode === mode) return this._tabs.active;
    this._shownMode = mode;
    return mode === 'survival' ? 'survival' : 'campaign';
  }

  _onShowTab(tab) {
    if (tab !== 'campaign') return;
    if (!this._trail.isRendered) {
      this._trail.render();
      this._trail.scrollToCurrent();
      return;
    }
    this._trail.renderIfResized();
    this._trail.patch();
  }

  _onSelectStage(stageId) {
    eventBus.emit('ui:click');
    this._stagePanel.open(stageId);
  }

  _deploy(stageId, squadId) {
    startBattle({ systems: this._s, stageId, squadId, onClose: () => this._afterBattle() });
  }

  _afterBattle() {
    this._trail.patch();
    this._survival.render();
    const openStage = this._stagePanel.stageId;
    if (openStage) this._stagePanel.open(openStage);
  }
}
