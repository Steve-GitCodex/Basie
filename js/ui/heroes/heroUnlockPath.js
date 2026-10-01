import { fragmentProgress, shardProgress } from './heroCardView.js';

function stepHtml({ index, title, detail, progress, action, label }) {
  return `
    <div class="hq-unlock__step">
      <span class="hq-unlock__num">${index}</span>
      <div class="hq-unlock__text">
        <span class="hq-unlock__step-title">${title}</span>
        <span class="hq-unlock__detail">${detail}</span>
        ${progress ? `<span class="hq-bar${progress.ready ? ' hq-bar--ready' : ''}"><i style="width:${progress.pct}%"></i></span>` : ''}
      </div>
      <button type="button" class="btn btn-xs ${progress && progress.ready ? 'btn-primary' : 'hq-btn-secondary'}"
              data-action="${action}" ${progress && !progress.ready ? 'disabled' : ''}>${label}</button>
    </div>`;
}

export function unlockPathHtml(hero) {
  const fragments = fragmentProgress(hero);
  const shards = shardProgress(hero);
  return `
    <div class="hq-unlock">
      <div class="hq-unlock__title">How to recruit</div>
      ${stepHtml({ index: 1, title: 'Fragments → Hero Shard', detail: `${fragments.have} / ${fragments.need} fragments`, progress: fragments, action: 'convert', label: 'Convert' })}
      ${stepHtml({ index: 2, title: 'Hero Shards → Unlock', detail: `${shards.have} / ${shards.need} Hero Shards`, progress: shards, action: 'unlock', label: 'Unlock' })}
      ${stepHtml({ index: 3, title: 'Or pull from the banner', detail: 'Recruit Hall', progress: null, action: 'goto-recruit', label: 'Recruit Hall ›' })}
    </div>`;
}
