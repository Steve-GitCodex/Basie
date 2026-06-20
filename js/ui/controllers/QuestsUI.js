/**
 * QuestsUI.js
 * Renders the quests view with two sub-tabs:
 *   📜 Quests   — active / completed quest cards with briefing text
 *   📖 Story Log — chronological chapter-triggered story entries
 */
import { eventBus } from '../../core/EventBus.js';
import { RES_META, openModal, closeModal } from '../uiUtils.js';
import { icon, iconFromEmoji } from '../icons.js';

export class QuestsUI {
  /**
   * @param {{ quest, story, notifications }} systems
   */
  constructor(systems) {
    this._s = systems;
    this._activeTab = 'quests'; // 'quests' | 'story'
  }

  init() {
    eventBus.on('ui:viewChanged', v => { if (v === 'quests') this.render(); });
    eventBus.on('quests:updated',   () => { if (this._activeTab === 'quests')  this.render(); });
    eventBus.on('story:chapter_triggered', () => { if (this._activeTab === 'story') this.render(); });
    eventBus.on('quest:completed', d => this._showQuestCelebration(d));
  }

  render() {
    const list = document.getElementById('quests-list');
    if (!list) return;
    list.innerHTML = '';

    // ── Sub-tab strip ──
    const tabStrip = document.createElement('div');
    tabStrip.className = 'quests-tab-strip';
    tabStrip.innerHTML = `
      <button class="quests-tab-btn${this._activeTab === 'quests' ? ' active' : ''}" data-tab="quests">${icon('scroll')} Quests</button>
      <button class="quests-tab-btn${this._activeTab === 'story'  ? ' active' : ''}" data-tab="story">Story Log</button>`;
    tabStrip.querySelectorAll('.quests-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._activeTab = btn.dataset.tab;
        this.render();
      });
    });
    list.appendChild(tabStrip);

    if (this._activeTab === 'quests') this._renderQuestsList(list);
    else                              this._renderStoryLog(list);
  }

  // ─────────────────────────────────────────────
  // Quests list
  // ─────────────────────────────────────────────

  _renderQuestsList(container) {
    this._s.quest.getQuestsWithState().forEach(q => {
      const obj      = q.objectives[0];
      const progress = q.progress ?? 0;
      const total    = obj?.count ?? 1;
      const pct      = Math.max(0, Math.min(100, (progress / total) * 100));

      const briefingHtml = q.briefing && !q.completed
        ? `<div class="quest-briefing">"${q.briefing}"</div>` : '';

      const lockedHtml = q.prerequisiteQuest && !q.completed && !(this._s.quest._state?.get(q.prerequisiteQuest)?.completed)
        ? `<div class="quest-locked-note">${icon('lock')} Complete a previous quest first</div>` : '';

      const card = document.createElement('div');
      card.className = `card quest-card${q.completed ? ' completed' : ''}`;
      card.innerHTML = `
        <div class="card-icon" style="font-size:1.5rem;flex-shrink:0">${q.icon}</div>
        <div class="quest-info" style="flex:1;min-width:0">
          <div class="quest-title" style="font-weight:700">${q.name} ${q.completed ? icon('check', 'icon--success') : ''}</div>
          <div class="quest-desc" style="font-size:var(--text-xs);color:var(--clr-text-muted)">${q.description}</div>
          ${briefingHtml}
          ${lockedHtml}
          <div class="progress-container" style="margin-top:4px">
            <div class="progress-label"><span>${progress}/${total}</span><span>${Math.floor(pct)}%</span></div>
            <div class="progress-bar"><div class="progress-fill progress-fill-success" style="width:${pct}%"></div></div>
          </div>
        </div>
        <div style="flex-shrink:0">
          <div class="cost-row">${Object.entries(q.rewards).map(([k, v]) => `<span class="cost-chip affordable">${RES_META[k]?.icon ?? ''} ${v}</span>`).join('')}</div>
        </div>`;
      container.appendChild(card);
    });
  }

  // ─────────────────────────────────────────────
  // Story Log
  // ─────────────────────────────────────────────

  _renderStoryLog(container) {
    const log = this._s.story?.getChapterLog?.() ?? [];

    if (log.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align:center;color:var(--clr-text-muted);padding:var(--space-8) 0;font-size:var(--text-sm)';
      empty.textContent = 'Your story is just beginning…';
      container.appendChild(empty);
      return;
    }

    const logList = document.createElement('div');
    logList.className = 'chapter-log-list';

    [...log].reverse().forEach(entry => {
      const ch = entry.chapter ?? entry;
      const card = document.createElement('div');
      card.className = 'chapter-log-card';
      const preview = Array.isArray(ch.dialogue)
        ? ch.dialogue.slice(0, 2).map(d => d.text ?? d).join(' · ')
        : '';
      card.innerHTML = `
        <div class="chapter-log-icon">${iconFromEmoji(ch.icon ?? '') || icon('scroll')}</div>
        <div class="chapter-log-meta">
          <div class="chapter-log-arc">${ch.arc ?? ''}</div>
          <div class="chapter-log-title">${ch.title ?? ch.id}</div>
          ${preview ? `<p class="chapter-log-dialogue">${preview}</p>` : ''}
        </div>`;
      logList.appendChild(card);
    });

    container.appendChild(logList);
  }

  // ─────────────────────────────────────────────
  // Quest Celebration Modal
  // ─────────────────────────────────────────────

  _showQuestCelebration(data) {
    const rewardHtml = Object.entries(data.rewards ?? {}).map(([k, v]) =>
      `<div class="battle-reward-chip">${RES_META[k]?.icon ?? ''} +${v} ${k}</div>`
    ).join('');

    openModal(`
      <div class="modal-inner" style="position:relative;overflow:hidden">
        <div class="quest-celebration">
          <span class="quest-celebration-icon">${icon('scroll', 'icon--appear')}</span>
          <div class="quest-celebration-title">Quest Complete!</div>
          <div class="quest-celebration-name">"${data.name}"</div>
          <p style="color:var(--clr-text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-5)">${data.description}</p>
          <div class="battle-rewards">${rewardHtml}</div>
          <div style="display:flex;justify-content:flex-end;margin-top:var(--space-4)"><button class="btn btn-gold btn-lg modal-close" id="btn-quest-close">Continue ▶</button></div>
        </div>
      </div>`);

    this._spawnConfetti();
  }

  _spawnConfetti() {
    const content = document.getElementById('modal-content');
    if (!content) return;
    const colors = ['var(--clr-gold)', 'var(--clr-primary)', 'var(--clr-success)'];
    for (let i = 0; i < 24; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.cssText = `left:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*colors.length)]};width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;animation-duration:${0.8+Math.random()}s;animation-delay:${Math.random()*0.5}s;`;
      content.appendChild(p);
      setTimeout(() => p.remove(), 2000);
    }
  }
}

