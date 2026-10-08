import { eventBus } from '../../core/EventBus.js';
import { VIP_TIERS } from '../../entities/GAME_DATA.js';
import { icon } from '../icons.js';

export class PlayerPlate {
  constructor({ user }) {
    this._user = user;
    this._name = null;
    this._level = null;
    this._vipBadge = null;
  }

  init() {
    this._name = document.getElementById('player-name');
    this._level = document.getElementById('player-level');
    this._vipBadge = document.getElementById('vip-badge');
    eventBus.on('user:profileUpdated', profile => this.render(profile));
    eventBus.on('user:levelUp', () => this.render(this._user.getProfile()));
    eventBus.on('user:xpGained', data => this.render(data.profile));
    eventBus.on('user:vipUpdate', () => this.render(this._user.getProfile()));
    this.render(this._user.getProfile());
  }

  render(profile) {
    if (this._name) this._name.textContent = profile.username;
    if (this._level) this._level.textContent = `Lv ${profile.level}`;
    this._renderVipBadge();
  }

  _renderVipBadge() {
    const badge = this._vipBadge;
    if (!badge) return;
    const tier = this._user?.getVipTier() ?? 0;
    if (tier <= 0) { badge.classList.add('hidden'); return; }
    const tierCfg = VIP_TIERS.find(t => t.tier === tier);
    badge.innerHTML = `${icon('crown')} ${tierCfg?.label ?? `VIP ${tier}`}`;
    badge.title = tierCfg?.description ?? '';
    badge.classList.remove('hidden');
    badge.dataset.vipTier = tier;
  }
}
