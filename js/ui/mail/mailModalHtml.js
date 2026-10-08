import { icon } from '../icons.js';

export function mailModalHtml() {
  return `
    <div class="mail" id="mail-root">
      <header class="mail__head">
        <button type="button" class="mail__back" data-mail-back aria-label="Back to categories">‹</button>
        <h2 class="mail__title">${icon('envelope')} Mail</h2>
        <span class="mail__unread"></span>
        <button type="button" class="mail__claim-all" data-mail-claim-all>Claim all</button>
        <button type="button" class="modal-close" aria-label="Close mail">✕</button>
      </header>
      <div class="mail__body">
        <nav class="mail__hub" aria-label="Mail categories"></nav>
        <section class="mail__listwrap">
          <div class="mail__list-head">
            <span class="mail__list-title"></span>
            <span class="mail__list-count"></span>
            <button type="button" class="mail__menu-btn" data-list-menu aria-haspopup="menu" aria-expanded="false" aria-label="More actions">⋯</button>
            <div class="mail__menu hidden" role="menu">
              <button type="button" role="menuitem" data-act="read-all">Read all</button>
              <button type="button" role="menuitem" data-act="delete-read">Delete read</button>
            </div>
          </div>
          <div class="mail__list" role="list"></div>
          <div class="mail__empty hidden"></div>
          <div class="mail__toast-host"></div>
        </section>
      </div>
    </div>`;
}
