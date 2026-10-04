import { CAMPAIGNS_CONFIG } from '../../entities/data/combat.js';
import { trailStages, stageById } from '../../systems/campaign/campaignStages.js';
import { iconFromEmoji } from '../icons.js';
import { trailLayout } from './trailLayout.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const FOG_BELOW_NODE = 50;
const FOG_LABEL_LIFT = 40;
const BAND_LIFT = 8;
const YOU_VIEWPORT_SHARE = 0.55;
const MAX_STARS = 3;
const STATE_CLASSES = ['available', 'completed', 'locked'];

const chapterName = chapter => CAMPAIGNS_CONFIG[chapter - 1]?.name ?? '';

function svgPath(svg, className, d = '') {
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('class', className);
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  svg.appendChild(path);
  return path;
}

function starsHtml(count) {
  if (!count) return '';
  return '★'.repeat(count) + `<i>${'★'.repeat(MAX_STARS - count)}</i>`;
}

function stateClass(state) {
  if (state.isCompleted) return 'completed';
  return state.isAvailable ? 'available' : 'locked';
}

export class CampaignTrail {
  constructor(rootEl, { campaign, onSelect }) {
    this._root = rootEl;
    this._campaign = campaign;
    this._trailIds = trailStages().map(s => s.id);
    this._nodes = new Map();
    this._bands = [];
    this._layout = null;
    this._width = 0;
    this._you = document.createElement('span');
    this._you.className = 'campaign-node__you';
    this._you.textContent = 'YOU';
    rootEl.addEventListener('click', e => {
      const node = e.target.closest('.campaign-node');
      if (node) onSelect(node.dataset.stageId);
    });
  }

  render() {
    const width = this._root.clientWidth;
    if (!width) return;
    this._width = width;
    const stages = this._campaign.getStages();
    this._layout = trailLayout(stages, { width });

    const world = document.createElement('div');
    world.className = 'campaign-trail__world';
    world.style.height = `${this._layout.height}px`;
    world.append(this._buildSvg(), ...this._buildBands(), this._buildFog(), ...this._buildNodes(stages));
    this._root.replaceChildren(world);
    this.patch();
  }

  get isRendered() {
    return !!this._layout;
  }

  renderIfResized() {
    if (!this._root.clientWidth || this._root.clientWidth === this._width) return;
    this.render();
    this.scrollToCurrent();
  }

  patch() {
    if (!this._layout) return;
    const states = this._campaign.getStageStates();
    const currentId = this._campaign.getCurrentStageId();
    for (const [id, el] of this._nodes) this._patchNode(el, states.get(id), id === currentId);
    const cleared = this._trailIds.slice(0, this._trailIds.indexOf(currentId) + 1);
    const clearedD = this._layout.pathThrough(cleared);
    this._clearedGlow.setAttribute('d', clearedD);
    this._clearedLine.setAttribute('d', clearedD);
    this._patchFog(states);
  }

  scrollToCurrent() {
    const node = this._nodes.get(this._campaign.getCurrentStageId());
    if (!node) return;
    this._root.scrollTop = parseFloat(node.style.top) - this._root.clientHeight * YOU_VIEWPORT_SHARE;
  }

  _buildSvg() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'campaign-trail__road');
    svg.setAttribute('width', this._width);
    svg.setAttribute('height', this._layout.height);
    const full = this._layout.pathThrough(this._trailIds);
    svgPath(svg, 'campaign-trail__road-shadow', full);
    svgPath(svg, 'campaign-trail__road-base', full);
    svgPath(svg, 'campaign-trail__road-dash', full);
    for (const spur of this._layout.spurs) svgPath(svg, 'campaign-trail__spur', spur.d);
    this._clearedGlow = svgPath(svg, 'campaign-trail__road-cleared-glow');
    this._clearedLine = svgPath(svg, 'campaign-trail__road-cleared');
    return svg;
  }

  _buildBands() {
    this._bands = this._layout.bands.map(({ chapter, y }) => {
      const band = document.createElement('div');
      band.className = 'campaign-trail__band';
      band.dataset.chapter = chapter;
      band.style.top = `${y - BAND_LIFT}px`;
      band.textContent = `Chapter ${chapter} · ${chapterName(chapter)}`;
      return band;
    });
    return this._bands;
  }

  _buildFog() {
    this._fog = document.createElement('div');
    this._fog.className = 'campaign-trail__fog';
    this._fogLabel = document.createElement('span');
    this._fogLabel.className = 'campaign-trail__fog-label';
    this._fog.appendChild(this._fogLabel);
    return this._fog;
  }

  _buildNodes(stages) {
    const byId = new Map(stages.map(s => [s.id, s]));
    this._nodes = new Map();
    return this._layout.nodes.map(({ id, kind, x, y }) => {
      const stage = byId.get(id);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `campaign-node campaign-node--${kind}`;
      el.dataset.stageId = id;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.setAttribute('aria-label', stage.name);
      el.innerHTML = `<span class="campaign-node__circle">${kind === 'regular' ? '' : `<span class="campaign-node__glyph">${iconFromEmoji(stage.icon ?? '')}</span>`}</span>`
        + (kind === 'boss' ? `<span class="campaign-node__label">${stage.name}</span>` : '')
        + '<span class="campaign-node__stars"></span>';
      this._nodes.set(id, el);
      return el;
    });
  }

  _chapterHeads() {
    const heads = new Map();
    for (const node of this._layout.nodes) {
      if (node.kind !== 'elite' && !heads.has(node.chapter)) heads.set(node.chapter, node);
    }
    return [...heads.values()];
  }

  _patchNode(el, state, isCurrent) {
    const cls = stateClass(state);
    el.classList.remove(...STATE_CLASSES.filter(c => c !== cls));
    el.classList.add(cls);
    el.classList.toggle('campaign-node--current', isCurrent);
    el.title = state.lockReason ?? '';
    if (el.classList.contains('campaign-node--regular')) {
      el.firstElementChild.textContent = state.isCompleted ? '✓' : String(stageById(el.dataset.stageId).index);
    }
    el.querySelector('.campaign-node__stars').innerHTML = state.isCompleted ? starsHtml(state.bestStars) : '';
    if (isCurrent) el.prepend(this._you);
  }

  _patchFog(states) {
    const firstLocked = this._chapterHeads().find(n => states.get(n.id).isLocked);
    this._fog.classList.toggle('hidden', !firstLocked);
    for (const band of this._bands) {
      band.classList.toggle('hidden', !!firstLocked && Number(band.dataset.chapter) >= firstLocked.chapter);
    }
    if (!firstLocked) return;
    const height = firstLocked.y + FOG_BELOW_NODE;
    const reason = states.get(firstLocked.id).lockReason;
    this._fog.style.height = `${height}px`;
    this._fogLabel.style.top = `${height - FOG_LABEL_LIFT}px`;
    this._fogLabel.textContent = `🔒 CHAPTER ${firstLocked.chapter} · ${chapterName(firstLocked.chapter).toUpperCase()} · ${reason}`;
  }
}
