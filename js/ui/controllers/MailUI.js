import { eventBus } from '../../core/EventBus.js';
import { MAIL_CATEGORIES } from '../../systems/mail/mailCategories.js';
import { swapModal, closeModal } from '../uiUtils.js';
import { MailHub } from '../mail/MailHub.js';
import { MailList } from '../mail/MailList.js';
import { MailActions } from '../mail/mailActions.js';
import { bindListMenu } from '../mail/listMenu.js';
import { CATEGORY_META } from '../mail/mailCategoryMeta.js';
import { mailModalHtml } from '../mail/mailModalHtml.js';

export class MailUI {
  /** @param {{ mail, rm, notifications, sound }} systems */
  constructor(systems) {
    this._s = systems;
    this._els = null;
    this._hub = null;
    this._list = null;
    this._menu = null;
    this._closeCallback = null;
  }

  init() {
    eventBus.on('ui:openMail', () => this.openModal());
    eventBus.on('mail:updated', () => this._refresh());
  }

  openModal() {
    if (this._isOpen()) { closeModal(this._closeCallback); return; }
    const onClose = () => {
      document.getElementById('modal-content')?.classList.remove('mail-modal');
      this._els = this._hub = this._list = this._menu = null;
    };
    this._closeCallback = onClose;
    swapModal(mailModalHtml(), onClose, () => {
      document.getElementById('modal-content')?.classList.add('mail-modal');
      this._build();
    });
  }

  _isOpen() { return !!document.getElementById('mail-root'); }

  _build() {
    const root = document.getElementById('mail-root');
    const actions = new MailActions(this._s, root.querySelector('.mail__toast-host'));
    this._els = {
      root,
      unread:    root.querySelector('.mail__unread'),
      claimAll:  root.querySelector('[data-mail-claim-all]'),
      listTitle: root.querySelector('.mail__list-title'),
      listCount: root.querySelector('.mail__list-count'),
    };
    this._hub = new MailHub(root.querySelector('.mail__hub'), {
      onSelect: cat => this._select(cat, true),
      onClaim:  cat => actions.claimCategory(cat),
    });
    this._list = new MailList(root.querySelector('.mail__list'), root.querySelector('.mail__empty'), {
      onHead:   id => { if (this._list.toggle(id)) this._s.mail.markRead(id); },
      onClaim:  id => actions.claimOne(id),
      onStar:   id => this._s.mail.toggleImportant(id),
      onAction: (act, id) => actions.run(act, id),
    });
    this._menu = bindListMenu(root.querySelector('.mail__list-head'), {
      onReadAll:    () => actions.readAll(this._list.category),
      onDeleteRead: () => actions.deleteRead(this._list.category),
    });
    this._els.claimAll.addEventListener('click', () => actions.claimEverything());
    root.querySelector('[data-mail-back]').addEventListener('click', () => root.classList.remove('mail--in-category'));

    const counts = this._s.mail.counts();
    this._select(MAIL_CATEGORIES.find(c => counts[c].unread > 0) ?? 'reports', false);
  }

  _select(cat, enter) {
    this._list.show(cat, this._s.mail.getMessages());
    if (enter) this._els.root.classList.add('mail--in-category');
    this._els.listTitle.textContent = CATEGORY_META[cat].label;
    this._menu.setVisible(cat !== 'trash');
    this._refresh();
  }

  _refresh() {
    if (!this._els || !this._isOpen()) return;
    const counts = this._s.mail.counts();
    const cat = this._list.category;
    this._hub.patch(counts, cat);
    this._list.patch(this._s.mail.getMessages());
    const claimable = MAIL_CATEGORIES.filter(c => c !== 'starred').reduce((n, c) => n + counts[c].claimable, 0);
    this._els.unread.textContent = `${this._s.mail.getUnreadCount()} unread`;
    this._els.claimAll.textContent = `Claim all (${claimable})`;
    this._els.claimAll.disabled = claimable === 0;
    this._els.listCount.textContent = `${counts[cat].total} mail`;
  }
}
