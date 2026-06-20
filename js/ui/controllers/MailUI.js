/**
 * MailUI.js
 * Three-panel inbox modal:
 *   left  — category sidebar (All / System / Rewards / Events / Archived / Trash)
 *   centre — scrollable mail list with search, read-filter, and pagination
 *   right  — selected mail reader with full action bar
 */
import { eventBus } from '../../core/EventBus.js';
import { RES_META, fmt, openModal, closeModal } from '../uiUtils.js';
import { icon, iconFromEmoji } from '../icons.js';

const PAGE_SIZE = 20;

const CATEGORIES = {
  all:      { label: 'All',      icon: icon('envelope') },
  system:   { label: 'System',   icon: icon('warning') },
  rewards:  { label: 'Rewards',  icon: icon('gift') },
  events:   { label: 'Events',   icon: icon('sword') },
  archived: { label: 'Archived', icon: icon('archive') },
  trash:    { label: 'Trash',    icon: icon('trash') },
};

const READ_FILTERS = [
  { value: 'all',       label: 'All'       },
  { value: 'unread',    label: 'Unread'    },
  { value: 'read',      label: 'Read'      },
  { value: 'important', label: 'Important' },
];

export class MailUI {
  /** @param {{ mail, rm, notifications, sound }} systems */
  constructor(systems) {
    this._s             = systems;
    this._category      = 'all';
    this._readFilt      = 'all';
    this._search        = '';
    this._openId        = null;
    this._page          = 0;
    this._closeCallback = null;
  }

  init() {
    eventBus.on('ui:openMail', () => this.openModal());
    eventBus.on('mail:updated', () => this._isOpen() && this._render());
  }

  // ─── Public ───────────────────────────────────────────────────────────────

  openModal() {
    // Toggle: tapping the mail button again closes it instead of stacking a
    // second modal (openModal() queues when one is already open).
    if (this._isOpen()) { closeModal(this._closeCallback); return; }

    this._category = 'all';
    this._readFilt = 'all';
    this._search   = '';
    this._page     = 0;
    // Preserve _openId so returning to the modal keeps context

    document.getElementById('modal-content')?.classList.add('mail-modal');

    const onClose = () => {
      document.getElementById('modal-content')?.classList.remove('mail-modal');
      this._openId = null;
    };
    this._closeCallback = onClose;

    openModal('<div class="mail-modal-layout" id="mail-root"></div>', onClose);
    this._render();
  }

  // ─── State helpers ────────────────────────────────────────────────────────

  _isOpen() {
    return !!document.getElementById('mail-root');
  }

  /** Filter all messages into the given category bucket */
  _msgsForCategory(all, cat) {
    switch (cat) {
      case 'all':      return all.filter(m => !m.isInTrash && !m.isArchived);
      case 'system':   return all.filter(m => !m.isInTrash && !m.isArchived && m.type === 'system');
      case 'rewards':  return all.filter(m => !m.isInTrash && !m.isArchived && ['quest', 'achievement'].includes(m.type));
      case 'events':   return all.filter(m => !m.isInTrash && !m.isArchived && m.type === 'combat');
      case 'archived': return all.filter(m =>  m.isArchived && !m.isInTrash);
      case 'trash':    return all.filter(m =>  m.isInTrash);
      default:         return all.filter(m => !m.isInTrash && !m.isArchived);
    }
  }

  /** Returns the filtered, searched list for the current view */
  _visibleMessages() {
    const all  = this._s.mail.getMessages();
    let msgs   = this._msgsForCategory(all, this._category);

    if      (this._readFilt === 'unread')    msgs = msgs.filter(m => !m.isRead);
    else if (this._readFilt === 'read')      msgs = msgs.filter(m =>  m.isRead);
    else if (this._readFilt === 'important') msgs = msgs.filter(m =>  m.isImportant);

    if (this._search.trim()) {
      const q = this._search.toLowerCase();
      msgs = msgs.filter(m =>
        m.subject.toLowerCase().includes(q) ||
        m.body.toLowerCase().includes(q)
      );
    }
    return msgs;
  }

  _unreadForCat(all, cat) {
    return this._msgsForCategory(all, cat).filter(m => !m.isRead).length;
  }

  _getOpenMessage() {
    if (this._openId == null) return null;
    return this._s.mail.getMessages().find(m => m.id === this._openId) ?? null;
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  _render() {
    const root = document.getElementById('mail-root');
    if (!root) return;

    const all        = this._s.mail.getMessages();
    const visible    = this._visibleMessages();
    const openMsg    = this._getOpenMessage();
    const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));

    if (this._page >= totalPages) this._page = totalPages - 1;

    const pageMsgs = visible.slice(this._page * PAGE_SIZE, (this._page + 1) * PAGE_SIZE);

    root.innerHTML = `
      <!-- Close button — absolute top-right of the modal -->
      <button class="mail-close-abs modal-close" id="mail-close-btn" title="Close">✕</button>

      <!-- ── LEFT: category sidebar ──────────────────────────────────────── -->
      <nav class="mail-cat-sidebar">
        <div class="mail-cat-title">${icon('envelope')} Mail</div>
        <div class="mail-cat-list">
          ${Object.entries(CATEGORIES).map(([key, meta]) => {
            const unread = this._unreadForCat(all, key);
            return `
              <button class="mail-cat-tab ${this._category === key ? 'active' : ''}" data-cat="${key}">
                <span class="mail-cat-icon">${meta.icon}</span>
                <span class="mail-cat-label">${meta.label}</span>
                ${unread > 0 ? `<span class="mail-cat-badge">${unread}</span>` : ''}
              </button>`;
          }).join('')}
        </div>
      </nav>

      <!-- ── CENTER: mail list ────────────────────────────────────────────── -->
      <div class="mail-list-panel">
        <div class="mail-list-toolbar">
          <div class="mail-search-wrap" style="flex:1">
            <span class="mail-search-icon">${icon('search', 'icon--muted')}</span>
            <input class="mail-search-input" id="mail-search" type="text"
              placeholder="Search messages…"
              value="${this._search.replace(/"/g, '&quot;')}" />
            ${this._search ? '<button class="mail-search-clear" id="mail-search-clear">✕</button>' : ''}
          </div>
          <select class="mail-filter-select" id="mail-read-filter">
            ${READ_FILTERS.map(f =>
              `<option value="${f.value}" ${this._readFilt === f.value ? 'selected' : ''}>${f.label}</option>`
            ).join('')}
          </select>
        </div>

        <div class="mail-list" id="mail-list">
          ${pageMsgs.length === 0
            ? `<div class="mail-empty-list">
                <div class="mail-empty-icon">${icon('envelope', 'icon--muted')}</div>
                <p>${
                  this._search             ? 'No results found.'      :
                  this._category === 'trash'    ? 'Trash is empty.'        :
                  this._category === 'archived' ? 'No archived messages.'  :
                  'Inbox empty.'
                }</p>
               </div>`
            : pageMsgs.map(m => {
                const isOpen    = m.id === this._openId;
                const hasReward = m.attachments && !m.rewardsClaimed;
                return `
                  <div class="mail-row ${m.isRead ? '' : 'mail-row--unread'} ${isOpen ? 'mail-row--active' : ''}"
                       data-id="${m.id}">
                    <span class="mail-unread-dot ${m.isRead ? 'mail-unread-dot--read' : ''}"></span>
                    <span class="mail-row-icon">${iconFromEmoji(m.icon ?? '') || icon('envelope')}</span>
                    <div class="mail-row-info">
                      <div class="mail-row-subject">${m.subject}</div>
                      <div class="mail-row-sender">${_senderLabel(m.type)}</div>
                    </div>
                    <div class="mail-row-meta">
                      <span class="mail-row-time">${_relativeDate(m.timestamp)}</span>
                      ${m.isImportant ? '<span class="mail-row-star" title="Important">★</span>' : ''}
                      ${hasReward     ? `<span class="mail-row-reward" title="Unclaimed rewards">${icon('gift')}</span>` : ''}
                    </div>
                  </div>`;
              }).join('')
          }
        </div>

        <div class="mail-pagination">
          <button class="btn btn-xs btn-ghost" id="mail-prev" ${this._page === 0 ? 'disabled' : ''}>‹ Prev</button>
          <span class="mail-page-info">
            ${visible.length === 0
              ? 'No messages'
              : `${this._page * PAGE_SIZE + 1}–${Math.min((this._page + 1) * PAGE_SIZE, visible.length)} of ${visible.length}`}
          </span>
          <button class="btn btn-xs btn-ghost" id="mail-next" ${this._page >= totalPages - 1 ? 'disabled' : ''}>Next ›</button>
        </div>
      </div>

      <!-- ── RIGHT: mail reader ────────────────────────────────────────────── -->
      <div class="mail-body-panel" id="mail-reader">
        ${openMsg ? this._renderReader(openMsg) : `
          <div class="mail-reader-empty">
            <div class="mail-reader-empty-icon">${icon('envelope')}</div>
            <p>Select a message to read it</p>
          </div>`}
      </div>`;

    this._bindEvents();
  }

  _renderReader(msg) {
    const rewardHtml = msg.attachments
      ? Object.entries(msg.attachments)
          .filter(([k]) => k !== 'xp')
          .map(([r, v]) => `<div class="battle-reward-chip">${RES_META[r]?.icon ?? ''} +${fmt(v)} ${RES_META[r]?.label ?? r}</div>`)
          .join('')
      : '';

    const isTrash    = !!msg.isInTrash;
    const isArchived = !!msg.isArchived;

    const actions = isTrash
      ? `<button class="btn btn-ghost"          id="reader-restore"  data-id="${msg.id}">Restore</button>
         <button class="btn btn-danger-outline" id="reader-perm-del" data-id="${msg.id}">${icon('trash')} Delete Forever</button>`
      : `<button class="btn btn-ghost" id="reader-read-toggle" data-id="${msg.id}">
           ${msg.isRead ? `${icon('envelope')} Mark Unread` : '✔ Mark Read'}
         </button>
         <button class="btn btn-ghost" id="reader-star" data-id="${msg.id}" title="Toggle Important">
           ${msg.isImportant ? '★ Unstar' : '☆ Star'}
         </button>
         ${isArchived
           ? `<button class="btn btn-ghost"          id="reader-unarchive" data-id="${msg.id}">Unarchive</button>`
           : `<button class="btn btn-ghost"          id="reader-archive"   data-id="${msg.id}">${icon('archive')} Archive</button>`
         }
         <button class="btn btn-danger-outline" id="reader-trash" data-id="${msg.id}">${icon('trash')} Delete</button>
         ${msg.attachments && !msg.rewardsClaimed
           ? `<button class="btn btn-gold" id="reader-claim" data-id="${msg.id}">${icon('gift')} Collect</button>`
           : ''}`;

    return `
      <div class="mail-reader-header">
        <div class="mail-reader-icon">${msg.icon}</div>
        <div class="mail-reader-title-block">
          <div class="mail-reader-subject">${msg.subject}</div>
          <div class="mail-reader-date">${_senderLabel(msg.type)} · ${new Date(msg.timestamp).toLocaleString()}</div>
        </div>
      </div>

      <div class="mail-reader-body">
        <p>${msg.body.replace(/\n/g, '<br>')}</p>
      </div>

      ${rewardHtml ? `
      <div class="mail-reader-rewards">
        <div class="modal-section-title">Attached Rewards</div>
        <div class="battle-rewards" style="justify-content:flex-start">${rewardHtml}</div>
        ${msg.rewardsClaimed ? `<p class="mail-claimed-note">${icon('check', 'icon--success')} Already collected.</p>` : ''}
      </div>` : ''}

      <div class="mail-reader-actions">${actions}</div>`;
  }

  // ─── Event binding ────────────────────────────────────────────────────────

  _bindEvents() {
    // Close
    document.getElementById('mail-close-btn')
      ?.addEventListener('click', () => closeModal(this._closeCallback));

    // Category sidebar tabs
    document.querySelectorAll('.mail-cat-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this._category = btn.dataset.cat;
        this._page     = 0;
        this._openId   = null;
        this._render();
      });
    });

    // Search input
    document.getElementById('mail-search')?.addEventListener('input', e => {
      this._search = e.target.value;
      this._page   = 0;
      this._render();
    });
    document.getElementById('mail-search-clear')?.addEventListener('click', () => {
      this._search = '';
      this._page   = 0;
      this._render();
    });

    // Read filter dropdown
    document.getElementById('mail-read-filter')?.addEventListener('change', e => {
      this._readFilt = e.target.value;
      this._page     = 0;
      this._render();
    });

    // Mail row click — open message and mark read
    document.querySelectorAll('.mail-row').forEach(row => {
      row.addEventListener('click', () => {
        const id  = parseInt(row.dataset.id);
        const msg = this._s.mail.getMessages().find(m => m.id === id);
        this._openId = id;
        if (msg && !msg.isRead) {
          this._s.mail.markRead(id); // emits mail:updated → _render()
        } else {
          this._render(); // already read — render directly so the reader updates
        }
      });
    });

    // Pagination
    document.getElementById('mail-prev')?.addEventListener('click', () => { this._page--; this._render(); });
    document.getElementById('mail-next')?.addEventListener('click', () => { this._page++; this._render(); });

    // Reader: mark read / unread toggle
    document.getElementById('reader-read-toggle')?.addEventListener('click', e => {
      const id  = parseInt(e.currentTarget.dataset.id);
      const msg = this._s.mail.getMessages().find(m => m.id === id);
      if (msg?.isRead) this._s.mail.markUnread(id);
      else             this._s.mail.markRead(id);
      // emits mail:updated → _render()
    });

    // Reader: important star toggle
    document.getElementById('reader-star')?.addEventListener('click', e => {
      this._s.mail.toggleImportant(parseInt(e.currentTarget.dataset.id));
      // emits mail:updated → _render()
    });

    // Reader: archive
    document.getElementById('reader-archive')?.addEventListener('click', e => {
      const id = parseInt(e.currentTarget.dataset.id);
      this._openId = this._nextVisibleId(id); // set before mutation
      this._s.mail.archive(id); // emits mail:updated → _render()
    });

    // Reader: unarchive
    document.getElementById('reader-unarchive')?.addEventListener('click', e => {
      const id = parseInt(e.currentTarget.dataset.id);
      this._openId = null;          // set before mutation so auto-render sees correct state
      this._s.mail.unarchive(id);   // emits mail:updated → _render()
    });

    // Reader: delete → move to trash
    document.getElementById('reader-trash')?.addEventListener('click', e => {
      const id = parseInt(e.currentTarget.dataset.id);
      this._openId = this._nextVisibleId(id); // set before mutation
      this._s.mail.trashMail(id); // emits mail:updated → _render()
    });

    // Reader: restore from trash
    document.getElementById('reader-restore')?.addEventListener('click', e => {
      const id = parseInt(e.currentTarget.dataset.id);
      this._openId = null;           // set before mutation so auto-render sees correct state
      this._s.mail.restoreMail(id);  // emits mail:updated → _render()
    });

    // Reader: permanent delete (trash only — requires confirmation)
    document.getElementById('reader-perm-del')?.addEventListener('click', e => {
      const id = parseInt(e.currentTarget.dataset.id);
      if (confirm('Permanently delete this message? This cannot be undone.')) {
        this._openId = this._nextVisibleId(id); // set before mutation
        this._s.mail.permanentDelete(id); // emits mail:updated → _render()
      }
    });

    // Reader: collect reward attachments
    document.getElementById('reader-claim')?.addEventListener('click', e => {
      eventBus.emit('ui:click');
      const id = parseInt(e.currentTarget.dataset.id);
      const r  = this._s.mail.claimRewards(id); // emits mail:updated → _render()
      if (r.success) {
        this._s.notifications?.show('success', '💰 Rewards Collected!', 'Resources added to your reserves.');
        this._s.sound?.coin?.();
      } else {
        this._s.notifications?.show('warning', 'Cannot Collect', r.reason);
      }
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Returns the id of the message after currentId in the visible list, or null */
  _nextVisibleId(currentId) {
    const list = this._visibleMessages();
    const idx  = list.findIndex(m => m.id === currentId);
    if (idx === -1) return null;
    const next = list[idx + 1] ?? list[idx - 1] ?? null;
    return next?.id ?? null;
  }
}

// ─── Module-level helpers ────────────────────────────────────────────────────

function _senderLabel(type) {
  switch (type) {
    case 'combat':      return 'Battle Command';
    case 'quest':       return 'Quest Board';
    case 'achievement': return 'Hall of Records';
    case 'system':
    default:            return 'System';
  }
}

function _relativeDate(ts) {
  const diff = Date.now() - ts;
  const min  = Math.floor(diff / 60_000);
  const hr   = Math.floor(diff / 3_600_000);
  const day  = Math.floor(diff / 86_400_000);
  if (min < 1)   return 'Just now';
  if (min < 60)  return `${min}m ago`;
  if (hr  < 24)  return `${hr}h ago`;
  if (day < 7)   return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}
