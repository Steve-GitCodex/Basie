# Top bar and Mail: current codebase map

Research input for the top bar (header / resource HUD) and Mail redesign. Written 2026-10-07 from
code only; companion to `topbar-mail-genre.md`. Not a design lock. Paths are repo-relative.

## Headline findings

- **Mail is not in the header.** `#btn-mail` lives in the bottom-centre `#floating-dock`
  (`index.html:441-444`, ADR 0003).
- **Dead code:** `.hud-rail*` (`hud.css:156-184`, no markup); `#btn-settings` binding
  (`NavigationUI.js:248`, no element); `_refreshStatusBar` writes `sb-*` ids that don't exist
  (`NavigationUI.js:671-689`, no-op every `tick:ui`); `header-brand/logo/title`
  (`header.css:28-47`); legacy `.mail-sidebar*`, `.mail-filter-pill*`, `.mail-bulk-*`,
  `.mail-item*` (`modals.css:179-436`).

## 1. Top bar

### Markup (`index.html:98-195`)

- `#resource-bar` (`:100-166`): five chips `#res-{wood,stone,food,iron,water}`, each
  `.res-icon` + `.res-data{.res-name, .res-value#v-key}` + `.res-rate-col{#c-key, #r-key}`.
  `#res-cafeteria` (`:156-165`) toggled by JS.
- `.header-actions` (`:169-194`): `#buff-hud-badge`, `#res-money`, `#res-diamond` (premium chips,
  **different structure**: no `.res-data`/`.res-name`), `#player-chip` (`#player-avatar`,
  `#player-name`, `#player-level`, `#vip-badge`, `#achievements-badge`).

### CSS cascade

`header.css` (`:15`) → `resources.css` (`:21`) → `hud.css` (`:50`, wins).

- `.game-header` 48px (`--header-height`, `variables.css:86`), `z-index: --z-overlay` (100).
  `hud.css:87` makes it `position:fixed` over the canvas; `.base-grid--iso`/`.world-grid` use a
  negative margin of `--header-height` (`hud.css:90-95`).
- `.resource-bar` (`header.css:50-58`): `overflow-x:auto` with **hidden scrollbar** — chips
  that don't fit are silently unreachable. `.header-actions` is `flex-shrink:0`
  (`header.css:68-73`), so resources absorb all squeeze.
- `hud.css:101-134`: `.res-name` hidden, `.res-cap` hidden, `.res-rate` `opacity:0` until hover
  (unreachable on touch). Capacity is a `::after` fill bar via `--fill`/`--rc` — only the five
  base resources; money/diamond/cafeteria have none.
- `.player-name { display:none }` (`hud.css:151-154`).
- Breakpoints: `header.css:56-61` (768), `resources.css:113-139` (1400/1100/768) — mostly
  nullified by `hud.css` specificity; only the 768px `.res-rate-col{display:none}` still bites.
  **Nothing below 768px.**
- Smallest type `--text-xs` = 10px, used for rate/cap/level.

### Z-ladder (`variables.css:142-150`)

overlay 100 (header) · tutorial 150-160 · modal 200 · nav 210 (dock/FAB, comment stale) ·
toast 300 · tooltip 400 · scene 500 · float 600 · confirm 950. Toasts land under the header at
the right (`notifications.css:5-15`).

### JS (all patch-in-place)

- `NavigationUI._renderResources` (`:600-620`): `tickTo(valEl, amount, fmt)`, rate text, `--fill`.
  `resources:tick` throttled to 2Hz (`:264-269`). `_renderCafeteriaChip` (`:622-644`).
  `_renderProfile` (`:649-668`), `_updateMailBadge` (`:696-701`), achievements badge
  (`:731-739`). `NavigationUI.js` is ~773 lines (ADR 0038) — already a god file.
- `fmt()` (`uiUtils.js:32-39`): exact below 10k ("9,999"), else K/M/B one decimal → value width
  varies 1–6 chars.
- `buffBadge.js` patches `#buff-hud-badge` (forces size with `!important`, `buffs.css:418-466`).
- `resourceChipTooltips.js` sets `dataset.tooltipHtml` on chips (`:7-40`).
- `resourceFlyout.js:25,65` needs visible `#res-{key}` + `.res-value`; skips if width 0.
- `UIManager.js:390` anchors the level-up float to `#player-level`.
- No tutorial step targets header elements (`TutorialManager.js:25-112`).

## 2. Mail

### Shell

- `ui:openMail` (`NavigationUI.js:246`) → `MailUI.openModal()` (`MailUI.js:49-68`) →
  `swapModal(...)` (`uiUtils.js:85-97`). Host class `.mail-modal` on `#modal-content`.
- `.modal-content.mail-modal` (`modals.css:161-168`): 920px max, 95vw, 75vh. Three fixed panels
  (160px rail, list `flex:1`, reader `flex:1.4`), **no `@media`** — never collapses.

### Structure (`MailUI.js:119-275`)

- `_render()` **rebuilds all of `#mail-root` via innerHTML on every change**, including each
  search keystroke (`:295-299`) → search input loses focus.
- Categories (`:14-21`, `_msgsForCategory` `:77-87`): All, System, Rewards (quest+achievement),
  Events (= `combat`, clashes with the game's Events feature), Archived, Trash.
- List: search, read-filter `<select>`, rows (dot, icon, subject, sender, time, star, gift),
  20/page pagination.
- Reader (`_renderReader` `:225-275`): subject, absolute date, body, `.battle-reward-chip`s
  (borrowed battle-results class), action bar: Read/Unread, Star, Archive, Delete, Collect.

### Flows

- Read: row click marks read (`:313-325`). Claim (`:383-394` → `MailManager.claimRewards`
  `:226-244`) does **not** mark read. Delete moves to Trash and advances; permanent delete uses
  native `confirm()` (`:375-381`). Trash never purges (`deletedAt` unused).
- **No Collect All / bulk ops in UI**, although `MailManager` has `markAllRead`,
  `markReadMultiple`, `archiveMultiple`, `deleteMultiple`.
- `mail:received` only updates the badge — no toast/sound. `mail:read`, `mail:deleted`,
  `mail:rewardsClaimed` have no consumers.

### Data (`MailManager.js`, 273 lines)

Message `{id, type, subject, body, icon(emoji), isRead, isArchived, isInTrash, deletedAt,
isImportant, attachments{key:amt}|null, rewardsClaimed, timestamp}` (`:89-103`). No inbox cap.
`_inferType` uses subject emoji prefixes (`:13-18`).

### Battle reports

Canned text only (`MailManager.js:37-52`); `combat:victory` payload (monster, dead, wounded,
rewards — `CombatManager.js:102-107`) is discarded. March battles send no mail
(`CombatManager.js:115`).

### Gaps

- Unescaped subject/body/icon into innerHTML (`MailUI.js:189,256-264`); `escapeHtml` exists
  (`uiUtils.js:12`).
- Welcome mail `gold` attachment is not a resource key (`main.js:582`, roadmap `:158`).
- Close button `.mail-close-abs` overlaps the reader header.
- Row text 10px.

### Tests

`tests/unit/mailManager.test.js` (nextId, firstClear mail). `inventory-smoke.mjs:185-275` relies
on `#btn-mail`, `#mail-root`, `.mail-modal`, swap semantics. **No browser test for MailUI
internals or the header.**

## 3. Usability friction (Mail)

| Task | Current cost |
|---|---|
| Claim one reward mail | open modal → row → Collect (3) |
| Clear N reward mails | 1 + 2N clicks; claiming doesn't mark read |
| Delete many | one at a time, 2 clicks each |
| Switch category | 1, but rail eats 160px on narrow screens |
| Search | focus lost after every keystroke |
| Read a battle report | no stats to read |

Plus:
- **No keyboard at all:** the shared modal has no Escape handler (`uiUtils.js:42-56`); rows are
  `div`s with no tabindex/role (`MailUI.js:184`); no `:focus-visible` in mail CSS.
- **Mis-click risk:** Delete (no confirm, no undo) sits beside Archive and Collect in one wrapping
  action row (`MailUI.js:239-252`); Collect is last.
- **Collect falls below the fold** on long mails — action row is `margin-top:auto` inside a
  scrolling reader, not pinned (`modals.css:517-527`). Three separate scroll regions in a 75vh card.
- **List scroll resets** after every action because `#mail-list` is recreated.
- **Auto-advance inconsistency:** archive/delete open the next mail without marking it read
  (`:349,363`); unarchive/restore clear selection (`:356,370`).
- **Filter traps:** switching category keeps search + read filter, so lists go silently empty;
  reading a mail under "Unread" drops its row while the reader stays open.
- **Badge mismatch:** dock badge excludes Archived/Trash (`MailManager.js:249`), tab badges don't.
- Tiny targets: 10px rows/tabs, 7px unread dot, selected vs hovered rows look the same
  (`modals.css:643-655`); star only toggleable in the reader; reward state not filterable.
- Mail toggles closed when its dock button is pressed again (`:50`) — not obvious.
- Emoji in toast/icons/buttons, against the no-emoji UI rule (`navigation.md`); native `confirm()`
  is the only native dialog (`:377`) though a styled confirm layer exists (`--z-confirm`).

## 4. Constraints a redesign must respect

1. Keep the HUD DOM contract: `#res-*`, `#v-*`, `#r-*`, `#c-*`, `.res-value`, `#buff-hud-badge`,
   `#player-chip`, `#player-level`, `#vip-badge`, `#achievements-badge`.
2. Patch in place only (ADR 0007); keep tick-flash and fly-out working.
3. `--header-height` is consumed by notifications, world-view, heroes-detail, battle-trail,
   sidebar CSS and the map negative margin — a two-row header must update the token, not
   hard-code heights.
4. Header (100) sits under modals (200); dock (210) above. A Mail button moved to the header
   would be covered by the overlay.
5. Preserve `#btn-mail`, `#mail-root`, `.mail-modal`, `swapModal` for `inventory-smoke.mjs`.
6. Inventory reuses the Mail shell (ADR 0039) — coordinate any shell change.
7. Split `MailUI.js` (431 lines) before adding features; move mail CSS out of `modals.css`.
8. Rich battle reports change the save shape (store payload on the message).
