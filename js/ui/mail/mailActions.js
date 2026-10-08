import { eventBus } from '../../core/EventBus.js';
import { deletableRead, inCategory, isClaimable } from '../../systems/mail/mailCategories.js';
import { confirmDialog } from '../confirmDialog.js';
import { RES_META, fmt } from '../uiUtils.js';
import { rewardEntries } from './mailRow.js';
import { showUndo } from './undoToast.js';

const collectedText = (rewards) =>
  rewardEntries(rewards).map(([k, v]) => `${RES_META[k]?.label ?? k} +${fmt(v)}`).join(' · ');

export class MailActions {
  /** @param {{ mail, notifications, sound }} systems @param {HTMLElement} toastHost */
  constructor(systems, toastHost) {
    this._s = systems;
    this._toastHost = toastHost;
  }

  claimOne(id) {
    eventBus.emit('ui:click');
    const r = this._s.mail.claimRewards(id);
    if (!r.success) { this._s.notifications?.show('warning', 'Cannot collect', r.reason); return; }
    this._collected(r.rewards);
  }

  claimCategory(cat) {
    this._claim(this._s.mail.getMessages().filter(m => inCategory(m, cat) && isClaimable(m)));
  }

  claimEverything() {
    this._claim(this._s.mail.getMessages().filter(isClaimable));
  }

  readAll(cat) {
    this._s.mail.markReadMany(this._s.mail.getMessages().filter(m => inCategory(m, cat)).map(m => m.id));
  }

  deleteRead(cat) {
    const ids = deletableRead(this._s.mail.getMessages(), cat);
    if (ids.length) this._trash(ids, `${ids.length} mail moved to Trash`);
  }

  run(act, id) {
    if (act === 'claim') this.claimOne(id);
    else if (act === 'delete') this._trash([id], 'Mail moved to Trash');
    else if (act === 'restore') this._s.mail.restoreMany([id]);
    else if (act === 'purge') this._purge(id);
  }

  _claim(msgs) {
    if (msgs.length === 0) return;
    eventBus.emit('ui:click');
    const r = this._s.mail.claimAll(msgs.map(m => m.id));
    if (r.success) this._collected(r.rewards);
  }

  _collected(rewards) {
    this._s.notifications?.show('success', 'Collected', collectedText(rewards));
    this._s.sound?.coin?.();
  }

  _trash(ids, text) {
    this._s.mail.trashMany(ids);
    showUndo(this._toastHost, text, () => this._s.mail.restoreMany(ids));
  }

  async _purge(id) {
    const ok = await confirmDialog({
      title: 'Delete forever?', text: 'This mail cannot be recovered.', confirmLabel: 'Delete', danger: true,
    });
    if (ok) this._s.mail.permanentDelete(id);
  }
}
