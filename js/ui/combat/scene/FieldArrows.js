const SVG_NS = 'http://www.w3.org/2000/svg';
const MIN_STROKE = 1.5;
const STROKE_RANGE = 2;
const HEAD_GAP = 4;

const MARKERS = `
  <defs>
    <marker id="bf-head-attacker" class="bf__arrow-head bf__arrow-head--attacker" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z"/></marker>
    <marker id="bf-head-defender" class="bf__arrow-head bf__arrow-head--defender" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z"/></marker>
  </defs>`;

function curve(from, to) {
  const midX = (from.x + to.x) / 2;
  return `M${from.x.toFixed(1)} ${from.y.toFixed(1)} C${midX.toFixed(1)} ${from.y.toFixed(1)} ${midX.toFixed(1)} ${to.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

export class FieldArrows {
  constructor(svg, fieldEl) {
    this._svg = svg;
    this._field = fieldEl;
    svg.innerHTML = MARKERS;
    this._paths = [];
  }

  render(arrows, { cardOf, rowOf }) {
    const origin = this._field.getBoundingClientRect();
    let used = 0;
    for (const arrow of arrows) {
      const card = cardOf(arrow.side, arrow.fromId);
      const row = rowOf(arrow.side === 'attacker' ? 'defender' : 'attacker', arrow.toRow);
      if (!card || !row) continue;
      this._draw(this._path(used), arrow, card.getBoundingClientRect(), row.getBoundingClientRect(), origin);
      used += 1;
    }
    for (let i = used; i < this._paths.length; i += 1) this._paths[i].style.display = 'none';
  }

  clear() {
    for (const path of this._paths) path.style.display = 'none';
  }

  _path(i) {
    if (!this._paths[i]) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('fill', 'none');
      this._svg.appendChild(path);
      this._paths[i] = path;
    }
    return this._paths[i];
  }

  _draw(path, arrow, cardRect, rowRect, origin) {
    const rightward = arrow.side === 'attacker';
    const from = {
      x: (rightward ? cardRect.right : cardRect.left) - origin.left,
      y: cardRect.top + cardRect.height / 2 - origin.top,
    };
    const to = {
      x: (rightward ? rowRect.left - HEAD_GAP : rowRect.right + HEAD_GAP) - origin.left,
      y: rowRect.top + rowRect.height / 2 - origin.top,
    };
    const weight = Math.max(0, Math.min(1, arrow.weight ?? 0));
    path.setAttribute('d', curve(from, to));
    path.setAttribute('class', `bf__arrow bf__arrow--${arrow.side}`);
    path.setAttribute('stroke-width', (MIN_STROKE + STROKE_RANGE * weight).toFixed(2));
    path.setAttribute('marker-end', `url(#bf-head-${arrow.side})`);
    path.style.opacity = (0.5 + 0.5 * weight).toFixed(2);
    path.style.display = '';
  }
}
