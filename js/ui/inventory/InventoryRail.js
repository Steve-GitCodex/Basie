import { TABS } from './inventoryTabs.js';

export class InventoryRail {
  constructor(rootEl, { onSelect }) {
    this._root = rootEl;
    this._nodes = new Map();
    this._root.addEventListener('click', (e) => {
      const btn = e.target.closest('.inv-rail__tab');
      if (btn) onSelect(btn.dataset.tab);
    });
  }

  render(buckets, activeTabId, newTabIds) {
    this._root.replaceChildren();
    this._nodes.clear();
    for (const tab of TABS) {
      const btn = document.createElement('button');
      btn.className = 'inv-rail__tab';
      btn.dataset.tab = tab.id;
      btn.innerHTML = `<span class="inv-rail__label">${tab.icon} ${tab.label}</span>`
        + '<span class="inv-rail__dot hidden"></span><span class="inv-rail__count"></span>';
      this._nodes.set(tab.id, {
        btn,
        dot: btn.querySelector('.inv-rail__dot'),
        count: btn.querySelector('.inv-rail__count'),
      });
      this._root.appendChild(btn);
    }
    this.patch(buckets, newTabIds);
    this.setActive(activeTabId);
  }

  setActive(tabId) {
    for (const [id, node] of this._nodes) node.btn.classList.toggle('inv-rail__tab--active', id === tabId);
  }

  patch(buckets, newTabIds) {
    for (const [id, node] of this._nodes) {
      node.count.textContent = buckets[id].length;
      node.dot.classList.toggle('hidden', !newTabIds.has(id));
    }
  }
}
