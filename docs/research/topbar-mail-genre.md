# Responsive top bar and mail UI research (mobile 4X / base builders)

Research input for the Basie header (avatar, level, power, resource chips, header actions) and the
Mail inbox modal in the Last Shelter-style reskin. Written 2026-10-07. This is not a design lock.
A decision taken from it should go into an ADR.

## Read this first: how much is actually confirmed

The **web-standards half is well sourced** (MDN, W3C WCAG/APG, web.dev, all fetched and read).
The **genre half is thin**. Fandom wikis, appgamer.com and supercheats.com returned 403 or no
useful text; official help centers for Last Shelter, Whiteout, RoK and Evony did not surface in
search. Searches returned almost nothing describing the top bar layout or mail tab names of the
target games. Where only recalled working knowledge exists it is marked **[unverified]**, and a
live client or screenshots must settle it before a design relies on it.

Confidence labels:
**[official]** developer patch notes, help center, store text. **[datamine/wiki]** wiki or datamine
(none reachable this session). **[community]** guide site, Q&A, search excerpt. **[unverified]**
recalled, no source in hand. **[not found]** searched, nothing usable. **[standard]** W3C/MDN/web.dev.

## Summary: what matters most for Basie

1. **Genre top-bar layout: [not found] in any fetched source.** The pattern below is
   **[unverified]** recall of the genre: avatar + level + power cluster top-left, resource chips in
   a single row across the top (value only, tap for a source/boost popup), premium currency and
   shop/event shortcuts top-right, with the rest of the actions pushed to side rails or a bottom
   menu. Nothing fetched contradicts it. The one official datum: State of Survival v1.20.80
   reorganised the "icon layout at the bottom right of the main screen" ([SoS patch notes](https://stateofsurvival.game/en/blog/363)) [official], so
   shortcut clusters are moved to the edges, not the top bar.
2. **Genre mail: the only usable official datum is Whiteout's "Read & Claim All" works per tab**
   ([Whiteout update summary via search result](https://theriagames.com/?p=82667), snippet only; the
   fetched page body did not show the line, so treat as [community, unconfirmed]). A closely
   matching official help article from another mobile RPG (ODIN: Valhalla Rising) documents the
   standard shape: three mail types, per-item Claim plus Claim all, Delete plus Delete All, a 100
   message cap with oldest auto-deleted, and lockable mails (max 20) exempt from auto-delete
   ([Kakao Games help](https://kakaogames.oqupie.com/portals/2952/articles/73527)) [official, other game].
3. **Battle reports are a comparison view, not text.** State of Survival's reports show both
   sides' stats in a graphical comparison, including "the sources of bonuses" ([SoS v1.20.80](https://stateofsurvival.game/en/blog/363)) [official].
   Whiteout patched battle-report mail display for several event modes ([Whiteout update](https://theriagames.com/?p=65170)) [community, snippet only].
4. **Last Shelter mail has a red dot on the mail icon, and reward mails expire if unclaimed**
   ([supercheats search excerpt](https://www.supercheats.com/last-shelter-survival/walkthrough/hints-tips)) [community, snippet only; page itself 403].
5. **Target sizes:** WCAG 2.5.8 (AA) needs 24x24 CSS px or 24px spacing clearance
   ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)) [standard]; 2.5.5 (AAA) needs 44x44
   ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)) [standard]; web.dev advises ~48px with ~8px gaps
   ([web.dev](https://web.dev/articles/accessible-tap-targets)) [standard]. Use 44px for the primary hit area and allow the icon art to be smaller.
6. **Use `Intl.NumberFormat` compact notation** instead of the hand-rolled `fmt()` in `js/ui/uiUtils.js`
   ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat)) [standard].
   Pair with `font-variant-numeric: tabular-nums` so ticking values do not jitter
   ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric)) [standard].
7. **Container queries** let the resource bar adapt to the width it is given, not the window
   ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)) [standard].
8. **Native `<dialog>.showModal()`** gives inert background, focus trap, Esc-to-close and a
   `::backdrop` for free ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog)) [standard]; APG still requires a visible close button,
   focus return to the opener, and a label ([APG dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)) [standard].

---

## Current Basie state (read from the repo, 2026-10-07)

- Header (`index.html` lines 98-195, `css/layout/header.css`, 170 lines, one `@media (max-width: 768px)`):
  `.resource-bar` holds five full chips (icon, name, value, cap, rate), a hidden cafeteria chip.
  `.header-actions` holds a buffs badge, money chip, diamond chip, and the player chip (avatar,
  name, level, VIP badge, achievements badge). There is **no power readout** in the header today.
- Each chip carries name + value + cap + rate: at 360px, five of these cannot fit one row.
- `fmt()` abbreviates >= 10,000 as `12.3K`, with `toFixed(1)`, in `js/ui/uiUtils.js`.
- Mail (`js/ui/controllers/MailUI.js`, 431 lines, near the 400-line split threshold): left
  category sidebar (All / System / Rewards / Events / Archived / Trash), list, reader with
  Collect, delete-to-trash, permanent delete behind a native `confirm()`. Opened from the dock
  `#btn-mail` with `#mail-badge`. Re-renders the whole modal on `mail:updated`. No bulk claim, no
  bulk delete, no battle-report category, no read/unread filter are visible in the grep.

---

## A. Top bar

### A1. What the genre does

| Game | Finding | Confidence |
|---|---|---|
| Last Shelter | Red dot on the mail icon; no top-bar layout text found | [community]; layout [not found] |
| State of Survival | Bottom-right icon cluster reorganised in v1.20.80 | [official] ([source](https://stateofsurvival.game/en/blog/363)) |
| Whiteout Survival | Resources are meat, wood, coal, iron; a "new survivors" prompt sits top-left | [community] ([source](https://wostools.net/guides/resource-guide), search excerpt) |
| Rise of Kingdoms | Resources are food, wood, stone, gold; "Don't hide UI in map view" setting exists (in a *different* game, Risen Kingdoms; not RoK) | [not found] for RoK UI |
| Lords Mobile, Evony | Not researched beyond failed searches | [not found] |

Pattern hypothesis, **[unverified]**: the genre keeps a single resource row visible at all widths,
shows **value only** (rate/cap move to a tap popup), shows the premium currency separately, and
moves everything else to edge rails. Verify with store screenshots before leaning on it.

### A2. Responsive technique (standards)

- **Container queries**: `container-type: inline-size` on the bar, then `@container (width < 420px)`
  to switch chips from `icon + value + cap/rate` to `icon + value`
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)). Better than the single 768px viewport media query because the bar
  width depends on how much room the player chip and actions take, not the window. `cqi` units
  give container-relative sizing.
- **`clamp(min, preferred, max)`** for chip font and padding, for example
  `font-size: clamp(0.75rem, 2.5cqi, 1rem)`; MDN warns the maximum should be at least about 2x the
  minimum so text still reaches 200% zoom (WCAG 1.4.4)
  ([MDN clamp](https://developer.mozilla.org/en-US/docs/Web/CSS/clamp)) [standard].
- **Safe area**: `padding-top: env(safe-area-inset-top, 0px)` (and left/right in landscape). It is
  0 on unobstructed screens and nonzero around notches; the page needs
  `<meta name="viewport" content="..., viewport-fit=cover">` for it to apply
  ([MDN env()](https://developer.mozilla.org/en-US/docs/Web/CSS/env)) [standard]. Fallback syntax: `env(safe-area-inset-top, 0px)`.
- **Dynamic viewport units**: plain `vh` equals the *large* viewport; `dvh` tracks browser chrome but
  is unstable during scroll, `svh` is stable and safe for full-height panels
  ([MDN length](https://developer.mozilla.org/en-US/docs/Web/CSS/length)) [standard]. Prefer `svh` for modal max-heights.
- **Number width**: `Intl.NumberFormat('en', {notation:'compact', maximumFractionDigits:1})`
  gives `1.2M`; compact default is 0 fraction digits, so set it explicitly
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat)) [standard]. `tabular-nums` stops width jitter while ticking
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric)). Note compact rounding makes `9,999` read `10K`; keep the exact value in the tooltip/`title`.
- **Touch targets**: see Summary item 5. The chips are tappable (popup), so each needs a 44px-tall
  hit area even if the visible pill is 28px.
- **Priority+ / overflow**: no authoritative W3C pattern was found (searched via the fetched
  standards only). It is a common practice, **[unverified as a named standard]**: show the highest
  priority items, collapse the rest under a "more" control. Basie already uses a "More grid FAB"
  for navigation (per project memory), so reuse that idiom for header actions.

### A3. Three width tiers to design against (derived, not sourced)

- **Narrow (about 360px)**: row 1 = avatar + level + power on the left, premium currencies + one overflow button on the right. Row 2 = a horizontally scrollable or wrapping row of the five resource chips, value only.
- **Medium (about 600-900px)**: one row. Chips gain the name tooltip and cap.
- **Wide (desktop)**: current full chip (value, cap, rate) may return; the bar keeps a max-width so chips do not stretch.

---

## B. Mail

### B1. What the genre does

| Game | Finding | Confidence |
|---|---|---|
| Last Shelter | Red dot on mail icon; reward mails expire if unclaimed; stale cache can hide mail (Options > clear local cache) | [community] ([source](https://www.supercheats.com/last-shelter-survival/walkthrough/hints-tips), snippet) |
| Whiteout | "Read & Claim All" applies per tab; battle-report mail display improved for event modes; tap avatars in war mails to open profiles | [community, snippet] ([source](https://theriagames.com/?p=82667)) |
| State of Survival | Battle reports show a side-by-side graphical stat comparison and bonus sources | [official] ([source](https://stateofsurvival.game/en/blog/363)) |
| ODIN: Valhalla Rising (not a target) | General/Account/Personal mail; Claim all, Delete All; 100-mail cap, oldest auto-deleted; lock up to 20; block/report | [official, other game] ([source](https://kakaogames.oqupie.com/portals/2952/articles/73527)) |
| Tab names in LSS/SoS/WoS/RoK/Evony | Not retrieved. Recalled **[unverified]**: System, Reports (battle/scout/gather), Alliance, Personal/Player, Starred/Saved | [unverified] |

### B2. Interaction patterns (standards)

- **Tabs**: `role=tablist/tab/tabpanel`, `aria-selected`, `aria-controls`; arrow keys move
  between tabs, Home/End optional; prefer automatic activation when the panel renders without
  latency ([APG tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)) [standard]. Basie's category list could be a vertical tablist (sidebar) on wide screens and a horizontal scrolling tablist on narrow.
- **Modal**: `<dialog>` + `showModal()`, `autofocus` on the right element, visible close button,
  focus returns to the dock mail button on close ([MDN dialog](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog), [APG dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)). Replace the native `confirm()` for permanent delete with an in-dialog confirmation, since a modal over a modal is a known awkward case (APG notes Esc closes only the topmost).
- **Master-detail**: no single authoritative W3C pattern was found. Established practice
  **[unverified as a named standard]**: two panes (list left, reader right) above a width
  threshold; below it, the list fills the modal and selecting a mail swaps to the reader with a
  Back button, with the same container-query switch used for the top bar.
- **Read/unread**: unread = bold subject plus dot; never rely on color alone (WCAG 1.4.1, [unverified here, not fetched]).
- **Bulk actions**: "Read & Claim all" scoped to the active tab (Whiteout, [community]); "Delete read" rather than "Delete all" avoids destroying unclaimed rewards; a locked/starred flag exempts a mail (ODIN, [official, other game]).
- **Capacity and expiry**: cap with oldest-first auto-delete that skips unclaimed-reward and locked mail (ODIN [official, other game]); show a "mailbox 87/100" meter.

### B3. Operability: reducing taps and friction (owner focus)

Owner note: the current Mail UI is "not very easy to operate". Friction audit of
`MailUI.js` (read from code, not run): to clear a reward inbox a player must open each mail,
tap Collect, then find delete; delete only moves to Trash and permanent delete needs a second
step plus a browser `confirm()`; no per-tab unread/claimable counts; no select mode; the whole
modal re-renders on every `mail:updated`, which can reset the open reader or list scroll.

Genre evidence on tap-minimising is limited (all game claims below are thin):
- Whiteout: "Read & Claim All" is a single button, scoped per tab [community, snippet] ([source](https://theriagames.com/?p=82667)).
- Last Shelter: red dot on the mail icon so unread state is visible without opening [community] ([source](https://www.supercheats.com/last-shelter-survival/walkthrough/hints-tips)).
- ODIN (other game): Claim all, Delete All, lock to protect from auto-delete [official] ([source](https://kakaogames.oqupie.com/portals/2952/articles/73527)).
- Swipe-to-delete, long-press multi-select, checkbox select mode: **[unverified]** for every target game; no source found. Treat as general mobile-inbox practice, not genre-confirmed.

Standards that constrain the fixes:
- **Swipe must have a tap alternative.** WCAG 2.5.1 says swiping is a path-based gesture and
  needs a single-pointer alternative ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html)) [standard]. So swipe/long-press can be a shortcut, never the only route.
- **List keyboard flow.** APG multi-select listbox, recommended model: Space toggles the focused
  option, Shift+Up/Down extends selection, Ctrl+A selects all; set `aria-multiselectable="true"`;
  focus via `aria-activedescendant` or roving tabindex, and keep DOM focus distinct from
  selected state ([APG listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)) [standard].
  Category tabs follow the APG tabs arrow-key model (see B2). Esc closes the dialog
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog)).
- **Announce results.** "3 rewards claimed" and badge-count changes are status messages and
  should be in a `role="status"` region so they are announced without moving focus
  (WCAG 4.1.3, [W3C](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)) [standard]. The same toast doubles as visible confirmation.
- **Hit areas**: 44px rows and buttons, 8px gaps (Summary item 5) so bulk buttons are not mis-tapped next to Delete.

Friction fixes, each tied to a tap count:
1. **One-tap "Claim all" in a sticky footer bar**, scoped to the active tab, with the count in the
   label ("Claim all (4)"), disabled when 0. Today: N mails x 2 taps. After: 1 tap.
2. **Opening a mail marks it read**; "Read all" is secondary. Claiming also marks read. No separate read step.
3. **Claim then Next**: after Collect in the reader, advance to the next unclaimed mail (or back
   to the list on narrow screens). Removes a back-and-reopen per mail.
4. **Unread and claimable badges on every tab**, plus the dock `#mail-badge` showing claimable
   count, not total. Tells the player where to go before opening.
5. **"Delete read" (not "Delete all")** as the default bulk delete: skips unclaimed-reward and
   starred mail so it cannot destroy rewards, which also removes the need for a confirm dialog on the common path. Deleted mail gets an **Undo toast** instead of a blocking `confirm()`; permanent delete stays a confirm but only from Trash.
6. **Select mode for custom bulk**: a checkbox per row, entered by a "Select" button (tap path)
   or long-press/swipe (shortcut, [unverified] genre). Selection shows a sticky bar:
   Claim, Star, Delete, count, Select all.
7. **Sticky header (tabs) and sticky footer (actions)** so the list scrolls between them and the
   action bar is always reachable by thumb; use `env(safe-area-inset-bottom)` on the footer ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/env)).
8. **Stable list on update**: patch rows in place on `mail:updated` (ADR 0007) so scroll
   position, selection and the open reader survive a claim.
9. **Keyboard**: Up/Down moves through rows, Enter opens, Space toggles selection in select
   mode, `c` claims, `Delete` deletes, Esc backs out (reader, then select mode, then dialog).
   Shortcut keys are a design choice, [unverified]; Space/Shift/Ctrl+A are APG-backed.

---

## Candidate recommendations

### Top bar

1. **Two-row narrow / one-row wide, with container queries** on `#game-header`. Row 1 identity
   + premium currency + overflow; row 2 the five chips. Pro: all resources always visible,
   matches the (unverified) genre pattern. Con: header costs about 80-90px of vertical space on a
   360px phone, taking from the city canvas.
2. **Value-only chips; move name, cap, rate into a tap popup** (reuse TooltipService). Pro: five
   chips fit 360px with compact numbers. Con: loses at-a-glance rate/cap, which Basie's current
   design shows; need a "cap nearly full" color state to keep the signal.
3. **Add a power readout to the player cluster** (compact format). Pro: genre staple
   [unverified]; the combat model already has a power concept. Con: needs a power source of
   truth and an event for updates.
4. **Priority+ for header actions**: buffs badge and achievements stay; others fold into an
   overflow button using the existing More-grid idiom. Pro: consistent. Con: hidden actions need
   badge bubbling so dots are not lost.
5. **Foundations**: `viewport-fit=cover` + `env(safe-area-inset-*)`, 44px hit areas, `tabular-nums`,
   `Intl.NumberFormat` compact in place of `fmt()`, `svh` for modal heights. Cheap, low risk.
   Con: compact rounding hides exact values; keep exact in tooltip.

### Mail

Ordered by friction removed per unit of work (operability first; see B3):

0. **Operability pack (do first).** Sticky footer "Claim all (N)" per tab, open-marks-read,
   claim-then-next, unread/claimable tab badges, "Delete read" that skips unclaimed and starred
   mail, Undo toast instead of `confirm()`, in-place patching on `mail:updated`. Pro: cuts a
   reward-inbox clear from about 2N taps to 1-2, uses only genre-supported or APG-backed
   behaviours. Con: bulk claim needs one manager call (not N events, ADR 0001); Undo needs a
   short-lived soft-delete state (transient, not serialized).
0b. **Select mode** (checkboxes + sticky action bar; swipe/long-press as optional shortcuts
   with a visible tap path). Pro: custom bulk Claim/Star/Delete. Con: swipe/long-press are
   [unverified] for the genre and need WCAG 2.5.1 alternatives; more UI state to test.

1. **Responsive master-detail**: two panes wide, list-then-reader with Back below a container
   threshold. Pro: one component serves phone and desktop. Con: the current full-modal
   re-render on `mail:updated` must become patch-in-place (ADR 0007) so an open reader is not reset.
2. **Reorganise categories** around what players act on: Rewards (claimable), Reports (battle),
   System, Archived/Starred, Trash; show per-tab unread counts. Pro: matches genre grouping
   (tab names [unverified]). Con: Basie needs a Reports category and a data shape for battle mails.
3. **Per-tab "Read & Claim all" and "Delete read"**, both skipping starred mails; permanent
   delete uses an in-modal confirm. Pro: closes the biggest usability gap; supported by
   Whiteout [community] and ODIN [official]. Con: bulk claim must be one manager call to avoid N event round-trips (ADR 0001).
4. **Battle report mail as a two-column comparison** (attacker vs defender: troops sent, dead,
   wounded, hero strikes, bonus sources). Pro: SoS does this [official] and Basie's combat resolver
   already outputs dead/wounded. Con: depends on the report schema; keep it out of scope until
   the Battle tab design lands.
5. **Mailbox cap and expiry**: cap, oldest-first auto-delete that never removes unclaimed or
   starred mail, "expires in N days" on reward mail. Pro: bounds save size. Con: adds a
   persistence rule and a serialize field (save-key discipline, ADR 0002).
6. **Split `MailUI.js` (431 lines)** into list, reader and bulk-actions modules before
   adding the above, per the no-god-files rule.

---

## Open questions

- Top-bar layout and mail tab names of Last Shelter / SoS / WoS / RoK / Evony from screenshots or a live client.
- Whether "Read & Claim All" in Whiteout also covers the Reports tab (the update snippet says per tab).
- Priority+ / overflow-menu guidance from a primary source (none found).

## Sources

Standards:
- WCAG 2.5.8 Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- WCAG 2.5.5 Target Size (Enhanced): https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- web.dev accessible tap targets: https://web.dev/articles/accessible-tap-targets
- MDN env() / safe-area-inset-*: https://developer.mozilla.org/en-US/docs/Web/CSS/env
- MDN container queries: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries
- MDN clamp(): https://developer.mozilla.org/en-US/docs/Web/CSS/clamp
- MDN length (viewport units): https://developer.mozilla.org/en-US/docs/Web/CSS/length
- MDN Intl.NumberFormat: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat
- MDN font-variant-numeric: https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric
- MDN dialog: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog
- WAI-ARIA APG modal dialog: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- WAI-ARIA APG tabs: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
- WAI-ARIA APG listbox (multi-select): https://www.w3.org/WAI/ARIA/apg/patterns/listbox/
- WCAG 2.5.1 Pointer Gestures: https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html
- WCAG 4.1.3 Status Messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html

Genre:
- State of Survival v1.20.80 patch notes (official): https://stateofsurvival.game/en/blog/363
- State of Survival event post (mail used for rewards): https://stateofsurvival.game/en/blog/67
- ODIN: Valhalla Rising Inbox help (official, other game): https://kakaogames.oqupie.com/portals/2952/articles/73527
- Whiteout Survival update posts (search snippets): https://theriagames.com/?p=82667 , https://theriagames.com/?p=65170
- Last Shelter hints (search snippet; page 403): https://www.supercheats.com/last-shelter-survival/walkthrough/hints-tips
- Whiteout resource guide (search snippet): https://wostools.net/guides/resource-guide
