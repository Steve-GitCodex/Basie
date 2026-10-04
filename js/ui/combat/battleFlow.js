import { eventBus } from '../../core/EventBus.js';
import { closeModal } from '../uiUtils.js';
import { icon, iconFromEmoji } from '../icons.js';
import { estimateBadge } from './estimateBadge.js';
import { playbackSteps } from './playbackSteps.js';
import { BattlePlayback } from './BattlePlayback.js';
import { battleResultHtml } from './battleResultHtml.js';
import { stageById } from '../../systems/campaign/campaignStages.js';

const SURVIVAL_STAGE_ID = 'survival_wave';

class BattleFlow {
  constructor(systems, onClose) {
    this._s = systems;
    this._onClose = onClose ?? (() => {});
  }

  _survivalProxy() {
    const { wave } = this._s.cm.getSurvivalState?.() ?? { wave: 0 };
    return {
      id:    SURVIVAL_STAGE_ID,
      name:  `Survival Wave ${wave + 1}`,
      icon:  icon('lightning', 'icon--danger icon--xl'),
      waves: [{ name: 'Survival Enemies', stacks: [] }],
    };
  }

  _showBattleModal(monster, squadId) {
    const squadData = this._s.um.getSquad(squadId);
    const army      = squadData ? squadData.units : [];
    if (army.length === 0) {
      eventBus.emit('ui:error');
      this._s.notifications?.show('warning', 'Empty Squad!', 'This squad has no units to send.');
      return;
    }

    const est = this._s.cm.estimateBattle(squadId, monster.id);
    if (estimateBadge(est).cls === 'weak') {
      this._showReadinessWarning(monster, squadId, Math.round(est.winChance * 100));
      return;
    }

    this._openBattleArena(monster, squadId);
  }

  _showReadinessWarning(monster, squadId, winPct) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    if (!overlay || !content) return;
    content.innerHTML = `
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
            Your squad may be too weak for <strong>${monster.name}</strong>. You'll almost certainly be defeated — but nothing stops you from trying.
          </p>
          <div style="display:flex;gap:var(--space-3);justify-content:center">
            <button class="btn btn-secondary" id="btn-warn-cancel">Cancel</button>
            <button class="btn btn-danger" id="btn-warn-proceed">${icon('sword')} Fight Anyway</button>
          </div>
        </div>
      </div>`;
    overlay.classList.remove('hidden');
    document.getElementById('btn-warn-cancel')?.addEventListener('click', () => {
      overlay.classList.add('hidden');
      content.innerHTML = '';
    });
    document.getElementById('btn-warn-proceed')?.addEventListener('click', () => {
      this._openBattleArena(monster, squadId);
    });
  }

  _openBattleArena(monster, squadId) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    if (!overlay || !content) return;

    content.innerHTML = `
      <div class="modal-inner">
        <div class="modal-top">
          <div class="modal-title-block"><div class="modal-title">${icon('sword')} ${monster.name}</div></div>
        </div>
        <div class="battle-arena" id="battle-arena">
          <div class="battle-combatants">
            <div class="battle-side">
              <div class="battle-sprite player-sprite" id="player-sprite">${icon('sword', 'icon--xl')}</div>
              <div class="battle-name" style="color:var(--clr-primary)">Your Army</div>
              <div class="battle-hp-bar"><div class="progress-bar"><div class="progress-fill progress-fill-hp" id="player-hp-bar" style="width:100%"></div></div></div>
            </div>
            <div class="battle-vs">VS</div>
            <div class="battle-side">
              <div class="battle-sprite enemy-sprite" id="enemy-sprite">${iconFromEmoji(monster.icon ?? '')}</div>
              <div class="battle-name" style="color:var(--clr-danger)">${monster.name}</div>
              <div class="battle-hp-bar"><div class="progress-bar"><div class="progress-fill progress-fill-hp" id="enemy-hp-bar" style="width:100%"></div></div></div>
            </div>
          </div>
          <div id="battle-wave-counter" class="battle-wave-counter" style="display:none"></div>
          <div class="battle-feed" id="battle-feed"><div class="battle-line system">Battle begins! (${monster.waves.length} waves)</div></div>
        </div>
        <div id="battle-result-area" style="display:none"></div>
        <div class="modal-actions" id="battle-actions">
          <div style="display:flex;align-items:center;gap:var(--space-3)">
            <div class="spinner" style="margin:auto"></div>
            <button class="btn btn-secondary btn-sm battle-skip-btn" id="btn-battle-skip">Skip</button>
          </div>
        </div>
      </div>`;
    overlay.classList.remove('hidden');

    this._runBattleAnimation(monster, squadId);
  }

  async _runBattleAnimation(monster, squadId) {
    const result = this._s.cm.attack(monster.id, squadId);
    const playback = new BattlePlayback({
      feed:         document.getElementById('battle-feed'),
      playerBar:    document.getElementById('player-hp-bar'),
      enemyBar:     document.getElementById('enemy-hp-bar'),
      playerSprite: document.getElementById('player-sprite'),
      enemySprite:  document.getElementById('enemy-sprite'),
      waveCounter:  document.getElementById('battle-wave-counter'),
    }, this._s.sound);

    let skipped = false;
    document.getElementById('btn-battle-skip')?.addEventListener('click', () => { skipped = true; });

    if (result.modifier) {
      playback.addLine(`Modifier: ${result.modifier.name} — ${result.modifier.description}`, 'system');
    }
    const steps = result.success ? playbackSteps(result.report) : [];
    await playback.play(steps, { isSkipped: () => skipped });
    if (!skipped) await new Promise(r => setTimeout(r, 800));

    const wvCounter = document.getElementById('battle-wave-counter');
    if (wvCounter) wvCounter.style.display = 'none';
    const arenaEl = document.getElementById('battle-arena');
    if (arenaEl) arenaEl.style.display = 'none';
    const resultArea = document.getElementById('battle-result-area');
    if (resultArea && result.success) {
      const final = steps.at(-1);
      resultArea.style.display = 'block';
      resultArea.innerHTML = battleResultHtml({
        victory: final.victory, rewards: result.rewards, reducedReward: result.reducedReward,
        dead: final.dead, wounded: final.wounded,
      });
      if (final.victory) this._spawnConfetti();
    }

    document.getElementById('battle-actions').innerHTML = `<button class="btn btn-primary" id="btn-battle-close">Continue</button>`;
    document.getElementById('btn-battle-close')?.addEventListener('click', () => {
      closeModal(() => this._onClose());
    });
  }

  _spawnConfetti() {
    const content = document.getElementById('modal-content');
    if (!content) return;
    const colors = ['var(--clr-gold)', 'var(--clr-primary)', 'var(--clr-success)'];
    for (let i = 0; i < 24; i++) {
      const p   = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.cssText = `left:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*colors.length)]};width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;animation-duration:${0.8+Math.random()}s;animation-delay:${Math.random()*0.5}s;`;
      content.appendChild(p);
      setTimeout(() => p.remove(), 2000);
    }
  }
}

export function startBattle({ systems, stageId, squadId, onClose }) {
  const flow = new BattleFlow(systems, onClose);
  if (stageId === SURVIVAL_STAGE_ID) {
    flow._openBattleArena(flow._survivalProxy(), squadId);
    return;
  }
  const monster = stageById(stageId)?.monster;
  if (monster) flow._showBattleModal(monster, squadId);
}
