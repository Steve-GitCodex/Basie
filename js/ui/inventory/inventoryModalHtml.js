import { INVENTORY_HEADER_HTML } from './InventoryHeader.js';

export const MODAL_HTML = `
  <div class="inv-modal" id="inv-root">
    ${INVENTORY_HEADER_HTML}
    <div class="inv-modal__body">
      <nav class="inv-modal__rail"></nav>
      <div class="inv-modal__stage">
        <div class="inv-modal__grid"></div>
        <div class="inv-modal__empty hidden">
          <div class="inv-modal__empty-title">Nothing here yet</div>
          <button class="btn btn-sm btn-ghost" type="button">Get more in Supply ›</button>
        </div>
      </div>
      <div class="inv-modal__detail"></div>
    </div>
  </div>`;
