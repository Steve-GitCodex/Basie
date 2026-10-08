import { tileTag } from './inventoryTabs.js';

const RARITIES = new Set(['common', 'rare', 'epic', 'legendary']);

export class InventoryGrid {
  constructor(rootEl, { onSelect }) {
    this._root = rootEl;
    this._tiles = new Map();
    this._order = [];
    this._selectedId = null;
    this._root.addEventListener('click', (e) => {
      const tile = e.target.closest('.inv-tile');
      if (tile) onSelect(tile.dataset.itemId);
    });
  }

  build(items, selectedId, newIds) {
    this._root.replaceChildren();
    this._tiles.clear();
    this._order = [];
    this._selectedId = null;
    this.patch(items, selectedId, newIds);
  }

  patch(items, selectedId, newIds) {
    const nextIds = new Set(items.map(item => item.id));
    const priorIndex = this._order.indexOf(this._selectedId);
    for (const [id, tile] of this._tiles) {
      if (nextIds.has(id)) continue;
      tile.remove();
      this._tiles.delete(id);
    }
    items.forEach((item, index) => {
      const tile = this._tiles.get(item.id) ?? this._createTile(item);
      this._updateTile(tile, item, newIds);
      if (this._root.children[index] !== tile) this._root.insertBefore(tile, this._root.children[index] ?? null);
    });
    this._order = items.map(item => item.id);
    this._selectedId = this._resolveSelection(selectedId, priorIndex);
    this._applySelection();
    return this._selectedId;
  }

  select(id) {
    this._selectedId = this._tiles.has(id) ? id : null;
    this._applySelection();
  }

  tileFor(id) {
    return this._tiles.get(id) ?? null;
  }

  _resolveSelection(selectedId, priorIndex) {
    if (!this._order.length) return null;
    if (this._order.includes(selectedId)) return selectedId;
    if (selectedId === null || selectedId === undefined) return this._order[0];
    return this._order[Math.min(Math.max(priorIndex, 0), this._order.length - 1)];
  }

  _createTile(item) {
    const tile = document.createElement('button');
    const rarity = RARITIES.has(item.rarity) ? item.rarity : 'common';
    tile.className = `inv-tile inv-tile--${rarity}`;
    tile.dataset.itemId = item.id;
    tile.title = item.name;
    tile.innerHTML = `<span class="inv-tile__tag"></span><span class="inv-tile__icon">${item.icon}</span>`
      + '<span class="inv-tile__qty"></span>';
    tile._qty = tile.querySelector('.inv-tile__qty');
    tile._tag = tile.querySelector('.inv-tile__tag');
    this._tiles.set(item.id, tile);
    return tile;
  }

  _updateTile(tile, item, newIds) {
    const qty = String(item.quantity);
    if (tile._qty.textContent !== qty) tile._qty.textContent = qty;
    const tag = tileTag(item);
    if (tile._tag.textContent !== tag) tile._tag.textContent = tag;
    tile.classList.toggle('inv-tile--new', newIds.has(item.id));
  }

  _applySelection() {
    for (const [id, tile] of this._tiles) tile.classList.toggle('inv-tile--selected', id === this._selectedId);
  }
}
