/**
 * ui/world/MarchDispatchSheet.js
 * Squad picker + ETA preview for dispatching a march. One UI surface; emits the
 * chosen (type, poiId, squadId) through onDispatch.
 */
function fmtDur(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export class MarchDispatchSheet {
  constructor(host, { onDispatch, onClose, previewFn }) {
    this._host = host;
    this._onDispatch = onDispatch ?? (() => {});
    this._onClose = onClose ?? (() => {});
    this._preview = previewFn ?? (() => null);
    this._poi = null;
    this._type = null;
    this._squadId = null;
  }

  init() {
    const $ = (s) => this._host.querySelector(s);
    this._el = $('#march-sheet');
    this._title = $('#ms-title');
    this._squadsEl = $('#ms-squads');
    this._etaEl = $('#ms-eta');
    this._goBtn = $('#ms-dispatch');
    $('#ms-close')?.addEventListener('click', () => this._onClose());
    this._goBtn?.addEventListener('click', () => {
      if (this._squadId) this._onDispatch(this._type, this._poi.id, this._squadId);
    });
  }

  /** @param {object} poi @param {'gather'|'attack'|'scout'} type @param {Array} squads */
  open(poi, type, squads) {
    if (!this._el) return;
    this._poi = poi; this._type = type; this._squadId = null;
    const verb = type === 'gather' ? 'Gather at'
      : type === 'scout' ? (poi.type === 'outpost' ? 'Capture' : 'Explore')
      : 'Attack';
    this._title.textContent = `${verb} ${poi.name}`;
    this._renderSquads(squads);
    this._etaEl.textContent = squads.length ? 'Select a squad.' : 'No available squads — train units or recall a march.';
    this._goBtn.disabled = true;
    this._el.classList.remove('hidden');
  }

  _renderSquads(squads) {
    this._squadsEl.innerHTML = '';
    for (const sq of squads) {
      const total = sq.units.reduce((n, u) => n + u.count, 0);
      const row = document.createElement('div');
      row.className = 'ms-squad' + (sq.deployed || total === 0 ? ' disabled' : '');
      row.innerHTML = `<span class="ms-squad__name">${sq.name}</span>
                       <span class="ms-squad__count">${total} units${sq.deployed ? ' · away' : ''}</span>`;
      if (!sq.deployed && total > 0) {
        row.addEventListener('click', () => this._select(sq.id, row));
      }
      this._squadsEl.appendChild(row);
    }
  }

  _select(squadId, row) {
    this._squadId = squadId;
    this._squadsEl.querySelectorAll('.ms-squad').forEach(r => r.classList.remove('selected'));
    row.classList.add('selected');
    const pv = this._preview(this._poi.id, squadId);
    this._etaEl.textContent = pv
      ? `Travel: ${fmtDur(pv.etaMs)} each way (round trip ~${fmtDur(pv.etaMs * 2)})`
      : '—';
    this._goBtn.disabled = false;
  }

  close() { this._el?.classList.add('hidden'); }
}
