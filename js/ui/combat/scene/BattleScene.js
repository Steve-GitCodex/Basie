import { battleTimeline } from '../../../systems/combat/report/battleTimeline.js';
import { eventBus } from '../../../core/EventBus.js';
import { battleMoments } from '../../../systems/combat/report/battleMoments.js';
import { roundLog } from '../../../systems/combat/report/roundLog.js';
import { SURVIVAL_STAGE_ID, stageById } from '../../../systems/campaign/campaignStages.js';
import { sceneInputs } from './sceneInputs.js';
import { BattleField } from './BattleField.js';
import { Timeline } from './Timeline.js';
import { HeroBar } from './HeroBar.js';
import { heroBarModel } from './heroBarModel.js';
import { RoundLogView } from './RoundLogView.js';
import { ResultsView } from './ResultsView.js';
import { resultsModel } from './resultsModel.js';
import { readToggles, writeToggles } from './sceneToggles.js';
import { sceneSkeleton } from './sceneSkeleton.js';
import { routeFix } from './resultsActions.js';

const RESULTS_MODE = 'battle-scene--results';
const TOGGLES = [['numbers', 'Numbers'], ['arrows', 'Arrows'], ['log', 'Log']];

function momentsByFrame(moments) {
  const byFrame = new Map();
  for (const moment of moments) {
    if (!byFrame.has(moment.frameIndex)) byFrame.set(moment.frameIndex, []);
    byFrame.get(moment.frameIndex).push(moment);
  }
  return byFrame;
}

export class BattleScene {
  constructor(rootEl, systems, { onClose = () => {}, onNext = () => {} } = {}) {
    this._root = rootEl;
    this._s = systems;
    this._onClose = onClose;
    this._onNext = onNext;
    rootEl.innerHTML = sceneSkeleton(TOGGLES);
    this.results = rootEl.querySelector('#battle-results');
    this.resultsView = new ResultsView(this.results, {
      onReplay: () => this._replay(),
      onBack: () => this.close(),
      onNext: stageId => this._next(stageId),
      onTurningPoint: () => this.showPlayback(this._results.turningPoint.frame),
      onFix: fix => this._fix(fix),
    });
    this._dom = {
      title: rootEl.querySelector('.battle-scene__title'),
      round: rootEl.querySelector('#battle-round-label'),
      youPct: rootEl.querySelector('.battle-scene__pct--you'),
      foePct: rootEl.querySelector('.battle-scene__pct--foe'),
      youBar: rootEl.querySelector('.battle-scene__bar:not(.battle-scene__bar--foe) i'),
      foeBar: rootEl.querySelector('.battle-scene__bar--foe i'),
      timeline: rootEl.querySelector('.timeline'),
      play: rootEl.querySelector('#btn-battle-play'),
      heroes: rootEl.querySelector('.battle-scene__heroes'),
      toggles: [...rootEl.querySelectorAll('.scene-toggles__btn')],
    };
    this.field = new BattleField(rootEl.querySelector('.battle-scene__field'));
    this.log = new RoundLogView(rootEl.querySelector('.battle-scene__log'));
    this.heroBar = null;
    this._frame = null;
    this._resize = new ResizeObserver(() => {
      if (this._frame) this.field.renderArrows(this._frame, this._toggles.arrows);
    });
    rootEl.querySelector('.scene-toggles').addEventListener('click', e => this._onToggle(e));
    this.timeline = null;
    this._session = null;
    this._returnFocus = null;
  }

  get isOpen() {
    return !this._root.classList.contains('hidden');
  }

  open({ stageId, squadId }) {
    eventBus.emit('battle:opening', { stageId });
    let opened = false;
    try {
      opened = this._open(stageId, squadId);
      return opened;
    } finally {
      if (!opened) eventBus.emit('battle:closed', { stageId, victory: false });
    }
  }

  _open(stageId, squadId) {
    const inputs = sceneInputs(this._s, { stageId, squadId });
    const roster = this._s.heroes?.getRosterWithState?.() ?? [];
    const { lastReport = null, firstCleared = false } = this._s.campaign?.getProgress?.(stageId) ?? {};
    const name = this._stageName(stageId);
    const result = this._s.cm.attack(stageId, squadId);
    if (!result.success) {
      this._s.notifications?.show('warning', 'Cannot attack', result.reason ?? 'The battle could not start.');
      return false;
    }
    this.stageId = stageId;
    this.squadId = squadId;
    this.inputs = inputs;
    this.result = result;
    this.model = battleTimeline(result.report, inputs);
    this.moments = battleMoments(result.report, this.model);
    this._momentsAt = momentsByFrame(this.moments);
    this._heroes = heroBarModel(roster, inputs, this.model.frames[0]?.skills);
    const prior = { lastReport, firstCleared };
    this._results = resultsModel({ result, stageId, inputs, timeline: this.model, prior, roster, title: name });
    this._announced = false;
    this._show(name);
    return true;
  }

  showResults() {
    if (!this.result) return;
    this.timeline?.pause();
    this.timeline?.seek(this.model.frames.length - 1);
    this.resultsView.render(this._results);
    this._root.classList.add(RESULTS_MODE);
    this.results.classList.remove('hidden');
    if (this._announced) return;
    this._announced = true;
    eventBus.emit('battle:resultsShown', { victory: this.result.report.victory });
  }

  showPlayback(frameIndex = 0) {
    this._root.classList.remove(RESULTS_MODE);
    this.results.classList.add('hidden');
    this.timeline?.seek(frameIndex);
  }

  close() {
    if (!this.isOpen) return;
    this.timeline?.destroy();
    this.timeline = null;
    this._session?.abort();
    this._session = null;
    this._resize.disconnect();
    this._root.classList.add('hidden');
    this._root.classList.remove(RESULTS_MODE);
    this.resultsView.clear();
    this.field.clearMoment();
    const outcome = { stageId: this.stageId, victory: !!this.result?.report.victory };
    this._onClose(outcome);
    eventBus.emit('battle:closed', outcome);
    this._restoreFocus();
  }

  _restoreFocus() {
    const previous = this._returnFocus;
    this._returnFocus = null;
    const target = previous?.isConnected ? previous : previous?.id && document.getElementById(previous.id);
    target?.focus();
  }

  _stageName(stageId) {
    if (stageId !== SURVIVAL_STAGE_ID) return stageById(stageId)?.name ?? stageId;
    const { wave = 0 } = this._s.cm.getSurvivalState?.() ?? {};
    return `Survival Wave ${wave + 1}`;
  }

  _show(name) {
    this.timeline?.destroy();
    this._session?.abort();
    this._session = new AbortController();
    document.addEventListener('keydown', e => this._onKey(e), { signal: this._session.signal });

    this._dom.title.textContent = name;
    this._root.classList.remove(RESULTS_MODE);
    this.results.classList.add('hidden');
    this.resultsView.clear();
    this.field.reset();
    this._frame = null;
    this.heroBar = new HeroBar(this._dom.heroes, this._heroes);
    this._toggles = readToggles();
    this._applyToggles();
    if (!this.isOpen) this._returnFocus = document.activeElement;
    this._root.classList.remove('hidden');
    this._dom.play.focus();
    this._resize.observe(this.field.el);

    this.timeline = new Timeline(this._dom.timeline, {
      frames: this.model.frames,
      waves: this.model.waves,
      moments: this.moments,
      onSeek: (_i, frame) => this._renderFrame(frame),
      onEnd: () => this.showResults(),
      onSkip: () => this.showResults(),
    });
    this.timeline.play();
  }

  _renderFrame(frame) {
    const { waves } = this.model;
    const wave = waves[frame.waveIndex];
    if (this.field.wave !== frame.waveIndex) this.field.buildWave(frame, frame.waveIndex, wave?.name ?? '');
    this._frame = frame;
    this.field.render(frame, this._toggles);
    this.heroBar?.render(frame);
    const moments = this._momentsAt.get(frame.index) ?? [];
    if (moments.length) this.field.showMoment(moments[0]);
    this.log.render(roundLog(frame, this.result.report, moments));
    this._dom.round.textContent = `WAVE ${frame.waveIndex + 1} / ${waves.length} · ROUND ${frame.round}`;
    const { attacker, defender } = frame.sides;
    this._dom.youPct.textContent = `YOU ${attacker.strengthPct}%`;
    this._dom.foePct.textContent = `${wave?.isBoss ? 'BOSS' : 'WAVE'} ${defender.strengthPct}%`;
    this._dom.youBar.style.width = `${attacker.strengthPct}%`;
    this._dom.foeBar.style.width = `${defender.strengthPct}%`;
    if (this.timeline?.playing && frame.floats.length) this._s.sound?.hit?.();
  }

  _replay() {
    this.showPlayback(0);
    this.timeline?.play();
  }

  _next(stageId) {
    this.close();
    if (stageId) this._onNext(stageId);
  }

  _fix(fix) {
    const squad = this._s.um?.getSquad?.(this.squadId);
    this.close();
    routeFix(fix, { squad, trainBuildingId: this._results.trainBuildingId });
  }

  _onToggle(e) {
    const key = e.target.closest('[data-toggle]')?.dataset.toggle;
    if (!key) return;
    this._toggles = { ...this._toggles, [key]: !this._toggles[key] };
    writeToggles(this._toggles);
    this._applyToggles();
    if (!this._frame) return;
    if (key === 'arrows') this.field.renderArrows(this._frame, this._toggles.arrows);
    if (key === 'numbers') this.field.renderFloats(this._frame, this._toggles.numbers);
  }

  _applyToggles() {
    for (const button of this._dom.toggles) button.setAttribute('aria-pressed', String(this._toggles[button.dataset.toggle]));
    for (const [key] of TOGGLES) this._root.classList.toggle(`battle-scene--hide-${key}`, !this._toggles[key]);
  }

  _onKey(e) {
    if (e.key !== 'Escape' || !this.isOpen) return;
    e.preventDefault();
    if (this._root.classList.contains(RESULTS_MODE)) this.close();
    else this.showResults();
  }
}
