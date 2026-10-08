# 0040 — Mail: category hub with in-place expand

Date: 2026-10-07 · Status: accepted · built 2026-10-07 · Design page: `docs/10-design/mail.md` ·
Mockup: `docs/10-design/mockups/topbar-mail/mail-v1.html` (option B)

## Context

Mail is hard to operate (`docs/research/topbar-mail-codebase.md`):
- Clearing N reward mails costs 2 + 2N clicks.
- There is no Claim all or bulk UI, although `MailManager` has the methods.
- Search loses focus on every keystroke because `MailUI` rebuilds `innerHTML`.
- The three fixed panels never collapse on narrow screens.
- Delete sits beside Collect with no undo.
- "Events" means combat reports.

Three options were prototyped: tabs with a sticky claim bar, a category hub with in-place expand, and a single feed with a
reward tray.

## Decision

Build the **category hub** (option B):
- Categories are Reports, Rewards, System, Starred and Trash. Each tile has its own claim, and the header has a global
  Claim all.
- Mails expand in place inside the list instead of opening in a reader pane.
- On a phone you go hub → list, two levels and no further.
- Archive is dropped.
- Undo toasts replace `confirm()`.
- `MailManager` stores the battle payload on report mails for a real battle report.

It was chosen because it is the most compact on a phone and avoids switching between a list and a reader.

## Consequences

- Long battle reports make the list tall; one-open-row limits this.
- Search is dropped for now.
- The Mail and Inventory shells diverge: the Inventory keeps its rail and detail column (ADR 0039).
- The message save shape gains a report payload, with no migration (no real users).
- `MailUI.js` must be split and mail CSS moved out of `modals.css` before feature work.
- `#btn-mail`, `#mail-root`, `.mail-modal` and `swapModal` semantics are kept for `inventory-smoke.mjs`.
