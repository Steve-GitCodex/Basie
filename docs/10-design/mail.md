# Mail (built 2026-10-07)

Mail as a **category hub with mails that expand in place**, the Last Shelter / Whiteout pattern. Chosen 2026-10-07 for
how compact it is on a phone (ADR 0040). Mockup (open in a browser):
`docs/10-design/mockups/topbar-mail/mail-v1.html`, **option B**. Research: `docs/research/topbar-mail-codebase.md`
(current code, friction table, constraints) and `docs/research/topbar-mail-genre.md`.

## Rules

- **Entry** stays the dock `#btn-mail` (toggle, `#mail-badge`) through `swapModal`. `#mail-root` and the `.mail-modal` host
  class stay because `inventory-smoke.mjs` depends on them. Escape closes the modal.
- **Categories:** **Reports · Rewards · System · Starred · Trash**. Reports = `combat`; Rewards = `quest` + `achievement`;
  System = everything else. Starred is a view over `isImportant`. **Archive is dropped**: Starred keeps mail, Trash removes it.
  The old "All" and "Events" names go away.
- **Hub tile** per category: icon, name, `N mail · U unread`, and a **Claim N** button when the category holds mail with
  unclaimed rewards. Tile counts and the dock badge are computed by one manager function, so they always agree (Trash is
  excluded from unread).
- **Header:** title, `U unread`, a global **Claim all (N)** button (disabled at 0), and close. On a phone, inside a category,
  a back chevron returns to the hub.
- **Layout:** desktop shows tiles on the left (about 230px) and the category list on the right; the first category with
  unread mail is open by default. A phone shows hub → list. That is the maximum depth, with no separate reader screen.
- **Rows** are at least 56px: unread dot, type icon (win/loss tint for reports), subject, `sender · age`, reward pills when
  unclaimed, an inline **Claim** button, and a star toggle. A claimed mail shows ✓.
- **Expand in place:** tapping a row expands it under itself and marks it read; tapping again collapses it. Only one row is
  open at a time. The expanded body holds the battle report (if any), the text, the reward grid, and actions (**Claim**,
  **Delete**; in Trash, **Restore** / **Delete forever**). Delete is never next to Claim without a gap.
- **Bulk per category:** the category list has an overflow menu with **Read all** and **Delete read**. Delete read skips
  starred and unclaimed mail.
- **Undo, not confirm:** delete and Delete read move mail to Trash with an Undo toast. Delete forever (Trash only) uses the
  in-game confirm layer, never `confirm()`. Trash purges mail older than 7 days on load.
- **Claim** grants through `InventoryManager.grantRewards`, marks the mail read, and toasts what was collected, by resource.
  Claim all aggregates into one toast.
- **Battle report** in a Reports mail: a Victory/Defeat banner and a "Your squad vs enemy" table (troops sent, dead, wounded;
  enemy name, % left, rounds). The mockup's power row is dropped (no power stat exists). Loot shows as the reward grid.
  **Attack again is not built**: the report stores no monster/stage route yet. `MailManager` stores the
  `combat:victory|defeat` payload as `msg.report` (save-shape change, no migration).
- **Frame:** the same size and position as the Inventory (ADR 0042): `--panel-modal-w/h` on desktop; on a phone, full width
  from the top down to `--dock-clearance`, so the floating dock never covers the panel.
- **Patch in place** (ADR 0007): the hub, list and expanded row update their own nodes on `mail:updated`. List scroll and the
  open row survive a claim or a new mail.
- **Keyboard:** tiles and rows are focusable buttons; Enter toggles a row; Escape closes the modal.
- All mail strings go through `escapeHtml`; icons use the `icon()` system, not emoji.

## Modules

- `js/systems/mail/mailCategories.js` — pure: `MAIL_CATEGORIES`, `inCategory`, `isClaimable`, `categoryCounts`,
  `unreadCount`, `deletableRead`.
- `MailManager` — `claimAll(ids)` (one `grantRewards`, one toast), `trashMany`/`restoreMany`, `markReadMany`, `counts()`,
  `purgeTrash()` (7 days, on load), `msg.report`. Archive, `delete`, `icon` and `_inferType` are gone.
- `js/ui/controllers/MailUI.js` — shell: `swapModal` toggle, default category, `mail:updated` → patch.
- `js/ui/mail/` — `MailHub` (tiles), `MailList` (rows by id, one open row, patch in place), `mailRow`, `mailExpand`,
  `battleReportBlock`, `mailActions` (claim / trash + Undo / purge), `listMenu`, `undoToast`, `mailCategoryMeta`,
  `mailModalHtml`.
- `js/ui/confirmDialog.js` — generic in-game confirm on `--z-confirm`.
- CSS: `css/components/mail.css` (shell, hub, rows, phone), `mail-expand.css` (expanded row, report, Undo),
  `confirm-dialog.css`. The old mail rules in `modals.css` are deleted.

## Not in scope

Search (dropped for now; categories plus Starred cover lookup), swipe gestures, mail for march battles (the resolver
deliberately emits no `combat:victory`, which needs its own event), and inbox size caps.

Tests: unit `mailCategories.test.js` and `mailManager.test.js`; `tests/browser/mail-smoke.mjs` (hub, inline claim, patch in
place, escaping, expand, report, Claim all, Undo, Delete read, purge confirm, Escape, scroll keep, phone hub → list + Undo).
