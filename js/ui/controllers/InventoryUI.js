import { eventBus } from '../../core/EventBus.js';
import { swapModal, closeModal } from '../uiUtils.js';
import { TABS, TAB_OF_TYPE, bucket } from '../inventory/inventoryTabs.js';
import { InventoryRail } from '../inventory/InventoryRail.js';
import { InventoryGrid } from '../inventory/InventoryGrid.js';
import { InventoryDetail } from '../inventory/InventoryDetail.js';
import { InventoryHeader } from '../inventory/InventoryHeader.js';
import { MODAL_HTML } from '../inventory/inventoryModalHtml.js';

export class InventoryUI {
  constructor(systems) {
    this._s = systems;
    this._activeTab = 'all';
    this._selectedId = null;
    this._newIds = new Set();
    this._hasNewRewards = false;
    this._buckets = null;
    this._pendingItemId = undefined;
    this._onClose = () => this._handleClosed();
  }

  init() {
    eventBus.on('ui:openInventory', (payload) => this._handleOpenRequest(payload?.itemId));
    eventBus.on('inventory:updated', (payload) => this._handleUpdated(payload));
    eventBus.on('buffs:changed', () => this._header?.patch());
  }

  _isOpen() {
    return !!this._grid && !!document.getElementById('inv-root');
  }

  _handleOpenRequest(itemId) {
    if (!this._isOpen()) return this._open(itemId);
    if (itemId) return this._focusItem(itemId);
    closeModal(this._onClose);
  }

  _open(itemId) {
    this._pendingItemId = itemId ?? null;
    swapModal(MODAL_HTML, this._onClose, () => this._build());
  }

  _build() {
    const root = document.getElementById('inv-root');
    const itemId = this._pendingItemId;
    this._pendingItemId = undefined;
    if (!root) return;
    document.getElementById('modal-content')?.classList.add('inv-modal-host');
    this._cacheDom(root);
    this._buckets = bucket(this._s.inventory.getItems());
    this._activeTab = 'all';
    this._selectedId = null;
    this._rail.render(this._buckets, this._activeTab, this._newTabIds());
    this._showTab('all');
    if (itemId) this._focusItem(itemId);
    this._hasNewRewards = false;
    this._updateBadge();
  }

  _cacheDom(root) {
    this._header = new InventoryHeader(root, this._s.buffs, () => eventBus.emit('ui:openBuffs'));
    this._rail = new InventoryRail(root.querySelector('.inv-modal__rail'), { onSelect: id => this._switchTab(id) });
    this._grid = new InventoryGrid(root.querySelector('.inv-modal__grid'), { onSelect: id => this._select(id) });
    this._emptyEl = root.querySelector('.inv-modal__empty');
    this._detail = new InventoryDetail(root.querySelector('.inv-modal__detail'), this._s, {
      onClose: () => closeModal(this._onClose),
    });
    this._emptyEl.querySelector('button').addEventListener('click', () => {
      closeModal(this._onClose);
      eventBus.emit('ui:openTradingTab', { tab: 'supply' });
    });
  }

  _handleClosed() {
    document.getElementById('modal-content')?.classList.remove('inv-modal-host');
    this._newIds.clear();
    this._hasNewRewards = false;
    this._selectedId = null;
    this._header = this._rail = this._grid = this._emptyEl = this._detail = null;
    this._updateBadge();
  }

  _handleUpdated(payload) {
    const rewards = payload?.rewards;
    if (rewards?.length) {
      eventBus.emit('ui:rewardAnimation', rewards);
      this._hasNewRewards = !this._isOpen();
      for (const r of rewards) if (r.type === 'item') this._newIds.add(r.itemId);
      this._updateBadge();
    }
    if (this._isOpen()) this._refresh();
  }

  _refresh() {
    this._buckets = bucket(this._s.inventory.getItems());
    const items = this._buckets[this._activeTab];
    this._selectedId = this._grid.patch(items, this._selectedId, this._newIds);
    this._detail.patch(this._selectedItem());
    this._syncChrome(items);
  }

  _switchTab(tabId) {
    eventBus.emit('ui:click');
    this._showTab(tabId);
  }

  _showTab(tabId) {
    this._activeTab = tabId;
    const items = this._buckets[tabId];
    this._selectedId = items.some(i => i.id === this._selectedId) ? this._selectedId : (items[0]?.id ?? null);
    this._grid.build(items, this._selectedId, this._newIds);
    this._detail.show(this._selectedItem());
    this._rail.setActive(tabId);
    this._syncChrome(items);
  }

  _syncChrome(items) {
    this._markTabSeen();
    this._rail.patch(this._buckets, this._newTabIds());
    this._header.patch();
    this._emptyEl.classList.toggle('hidden', items.length > 0);
  }

  _select(id) {
    eventBus.emit('ui:click');
    this._selectedId = id;
    this._grid.select(id);
    this._detail.show(this._selectedItem());
  }

  _selectedItem() {
    return this._buckets.all.find(i => i.id === this._selectedId) ?? null;
  }

  _focusItem(itemId) {
    const item = this._buckets.all.find(i => i.id === itemId);
    if (!item) return;
    this._selectedId = itemId;
    this._showTab(TAB_OF_TYPE[item.type] ?? 'all');
  }

  _markTabSeen() {
    if (this._activeTab === 'all') return;
    for (const item of this._buckets[this._activeTab]) this._newIds.delete(item.id);
  }

  _newTabIds() {
    const tabs = new Set();
    for (const tab of TABS) {
      if (tab.id !== 'all' && this._buckets[tab.id].some(i => this._newIds.has(i.id))) tabs.add(tab.id);
    }
    return tabs;
  }

  _updateBadge() {
    document.getElementById('inventory-badge')?.classList.toggle('hidden', !this._hasNewRewards);
  }
}
