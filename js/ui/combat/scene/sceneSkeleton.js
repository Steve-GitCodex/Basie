const toggleButtons = (toggles) => toggles
  .map(([key, label]) => `<button type="button" class="scene-toggles__btn" data-toggle="${key}" aria-pressed="true">${label}</button>`)
  .join('');

export function sceneSkeleton(toggles) {
  return `
  <header class="battle-scene__top">
    <span class="battle-scene__title"></span>
    <span class="battle-scene__round" id="battle-round-label"></span>
    <span class="battle-scene__strength">
      <span class="battle-scene__pct battle-scene__pct--you"></span>
      <span class="battle-scene__bar"><i></i></span>
      <span class="battle-scene__pct battle-scene__pct--foe"></span>
      <span class="battle-scene__bar battle-scene__bar--foe"><i></i></span>
    </span>
    <div class="battle-scene__toggles scene-toggles" role="group" aria-label="Playback layers">${toggleButtons(toggles)}</div>
  </header>
  <div class="battle-scene__stage">
    <div class="battle-scene__field"></div>
    <div class="battle-scene__heroes"></div>
    <div class="battle-scene__log"></div>
  </div>
  <div class="timeline">
    <div class="timeline__ctrl">
      <button type="button" class="timeline__btn" id="btn-battle-step-back" aria-label="Previous round">⏮</button>
      <button type="button" class="timeline__btn timeline__btn--play" id="btn-battle-play">▶</button>
      <button type="button" class="timeline__btn" id="btn-battle-step-fwd" aria-label="Next round">⏭</button>
      <button type="button" class="timeline__btn" id="btn-battle-speed">1×</button>
    </div>
    <div class="timeline__track">
      <div class="timeline__rail"></div><div class="timeline__done"></div>
      <div class="timeline__marks"></div><div class="timeline__knob"></div>
    </div>
    <span class="timeline__count"></span>
    <button type="button" class="timeline__btn timeline__btn--skip" id="btn-battle-skip">Skip ›</button>
  </div>
  <section class="battle-scene__results hidden" id="battle-results" aria-live="polite"></section>`;
}
