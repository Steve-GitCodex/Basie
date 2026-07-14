/**
 * ui/world/PoiDetailPanel.js
 * Slide-up detail panel for a selected POI. Pure presenter — reads a view-model
 * passed by WorldMapUI and emits intents through callbacks. One UI surface.
 */
import { fmt } from '../uiUtils.js';

export class PoiDetailPanel {
  constructor(host, { onAction, onClose }) {
    this._host = host;
    this._onAction = onAction ?? (() => {});
    this._onClose = onClose ?? (() => {});
  }

  init() {
    const $ = (s) => this._host.querySelector(s);
    this._el = $('#world-poi-panel');
    this._icon = $('#wp-icon');
    this._name = $('#wp-name');
    this._sub = $('#wp-sub');
    this._body = $('#wp-body');
    this._actions = $('#wp-actions');
    $('#wp-close')?.addEventListener('click', () => this._onClose());
  }

  /** @param {object} vm { poi, region, owned, state, marchType, slotsFree, locked, lockReason, outpostOwned, discovered } */
  open(vm) {
    if (!this._el) return;
    const { poi, region, owned, state, marchType, slotsFree, locked, lockReason, outpostOwned, discovered, bossInfo } = vm;

    // Fog of war: an undiscovered POI is a "?" — no detail, no action.
    if (discovered === false) {
      this._icon.textContent = '❔';
      this._name.textContent = 'Unexplored';
      this._sub.textContent = region?.name ?? '';
      this._body.innerHTML = '<div class="world-panel__row"><span>Reveal this with a watchtower or by pushing into the region.</span></div>';
      this._actions.innerHTML = '';
      this._show();
      return;
    }

    this._icon.textContent = poi.icon ?? '•';
    this._name.textContent = poi.name;
    const heldNote = poi.type === 'outpost' && outpostOwned ? ' · Held' : (owned ? ' · Yours' : '');
    this._sub.textContent = `${region?.name ?? ''}${heldNote}`;

    this._body.innerHTML = this._bodyHtml(poi, state, outpostOwned, bossInfo);
    this._actions.innerHTML = '';

    if (poi.type === 'city') { this._show(); return; }

    const btn = document.createElement('button');
    if (marchType === 'gather')      { btn.className = 'wp-gather'; btn.textContent = 'Gather'; }
    else if (marchType === 'scout')  { btn.className = 'wp-scout';  btn.textContent = poi.type === 'outpost' ? 'Capture' : 'Send expedition'; }
    else                             { btn.className = 'wp-attack'; btn.textContent = poi.type === 'world_boss' ? 'Challenge' : 'Attack'; }

    const bossClosed = poi.type === 'world_boss' && !(bossInfo?.open && !bossInfo?.defeated);
    const blocked = locked ? (lockReason ?? 'Locked') :
      (slotsFree <= 0 ? 'No march slots free' :
      (bossClosed ? (bossInfo?.defeated ? 'Already beaten — back next window' : 'Window closed — opens later') :
      (marchType === 'attack' && state?.respawnAt ? 'Cleared — respawning' :
      (marchType === 'scout' && poi.type === 'ruin' && state?.looted ? 'Already explored' :
      (marchType === 'scout' && poi.type === 'outpost' && outpostOwned ? 'Already held' : null)))));
    if (blocked) { btn.disabled = true; btn.title = blocked; }
    btn.addEventListener('click', () => this._onAction(poi.id, marchType));
    this._actions.appendChild(btn);
    this._show();
  }

  _bodyHtml(poi, state, outpostOwned, bossInfo) {
    if (poi.type === 'resource_node') {
      const rem = Math.floor(state?.remaining ?? 0);
      return `<div class="world-panel__row"><span>Yields</span><b>${poi.resource}</b></div>
              <div class="world-panel__row"><span>Available</span><b>${fmt(rem)} / ${fmt(poi.capacity)}</b></div>
              <div class="world-panel__row"><span>Gather rate</span><b>${poi.gatherRate}/s</b></div>`;
    }
    if (poi.type === 'camp' || poi.type === 'stronghold') {
      const kind = poi.type === 'stronghold' ? 'Stronghold — capture to claim the region' : 'Enemy camp';
      const status = state?.respawnAt ? 'Cleared (respawning)' : 'Hostile';
      return `<div class="world-panel__row"><span>Type</span><b>${kind}</b></div>
              <div class="world-panel__row"><span>Status</span><b>${status}</b></div>`;
    }
    if (poi.type === 'ruin') {
      const secs = Math.round((poi.expeditionMs ?? 0) / 1000);
      const status = state?.looted ? 'Explored' : 'Unexplored';
      const garrison = poi.garrison ? '<div class="world-panel__row"><span>Defenders</span><b>Guarded</b></div>' : '';
      return `<div class="world-panel__row"><span>Type</span><b>Ancient ruin</b></div>
              <div class="world-panel__row"><span>Status</span><b>${status}</b></div>
              ${garrison}
              <div class="world-panel__row"><span>Expedition</span><b>${secs}s on site</b></div>
              <div class="world-panel__row"><span>Reward</span><b>${this._rewardText(poi.reward)}</b></div>`;
    }
    if (poi.type === 'world_boss') {
      const now = Date.now();
      let status, when;
      if (bossInfo?.defeated)   { status = 'Beaten this window'; when = `Returns in ${this._dur(bossInfo.opensAt - now)}`; }
      else if (bossInfo?.open)  { status = 'Open — attackable now'; when = `Closes in ${this._dur(bossInfo.closesAt - now)}`; }
      else                      { status = 'Lairing'; when = `Opens in ${this._dur((bossInfo?.opensAt ?? now) - now)}`; }
      return `<div class="world-panel__row"><span>Type</span><b>World boss</b></div>
              <div class="world-panel__row"><span>Status</span><b>${status}</b></div>
              <div class="world-panel__row"><span>Window</span><b>${when}</b></div>
              <div class="world-panel__row"><span>Drops</span><b>Rare loot</b></div>`;
    }
    if (poi.type === 'outpost') {
      const kindName = { outpost: 'Relay outpost', shrine: 'Shrine', watchtower: 'Watchtower' }[poi.subtype] ?? 'Outpost';
      const garrison = poi.garrison ? '<div class="world-panel__row"><span>Defenders</span><b>Guarded</b></div>' : '';
      const reveal = poi.revealRadius ? '<div class="world-panel__row"><span>Reveals</span><b>Nearby map</b></div>' : '';
      return `<div class="world-panel__row"><span>Type</span><b>${kindName}</b></div>
              <div class="world-panel__row"><span>Status</span><b>${outpostOwned ? 'Held — boon active' : 'Capturable'}</b></div>
              ${garrison}
              <div class="world-panel__row"><span>Boon</span><b>${this._boonText(poi.boon)}</b></div>
              ${reveal}`;
    }
    return '<div class="world-panel__row"><span>Your home city</span></div>';
  }

  /** Human-readable summary of a ruin reward for the detail panel. */
  _rewardText(reward) {
    if (!reward) return 'Unknown';
    if (reward.kind === 'resource') return `${fmt(reward.amount ?? 0)} ${reward.resource}`;
    if (reward.kind === 'item') return `${reward.qty ?? 1}× ${reward.itemId}`;
    if (reward.kind === 'buff') {
      const mins = Math.round((reward.durationMs ?? 0) / 60000);
      const what = reward.flavor === 'economic' ? `+${Math.round(reward.pct * 100)}% ${reward.resource}`
        : reward.flavor === 'military' ? `+${Math.round(reward.pct * 100)}% troop attack`
        : `+${Math.round(reward.pct * 100)}% march speed`;
      return `${what} for ${mins}m`;
    }
    return 'Unknown';
  }

  /** Short duration label (m/s) for boss-window countdowns. */
  _dur(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  /** Human-readable summary of a persistent outpost boon. */
  _boonText(boon) {
    if (!boon) return 'None';
    const pct = Math.round((boon.pct ?? 0) * 100);
    if (boon.flavor === 'economic') return `+${pct}% ${boon.resource}`;
    if (boon.flavor === 'military') return `+${pct}% troop attack`;
    return `+${pct}% march speed`;
  }

  _show() { this._el.classList.remove('hidden'); }
  close() { this._el?.classList.add('hidden'); }
}
