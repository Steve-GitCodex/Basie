# 0030 — Hero Quarters visual system

**Status:** Accepted, 2026-10-01. Spec: `docs/superpowers/specs/2026-10-01-hero-quarters-ui-redesign-design.md` (gitignored).

> **Tracking note:** whether this file is committed or follows ADRs 0027-0029 out of
> tracking is **Steve's call at commit time**. Nothing in `.gitignore` was changed for it.

## Context

`#view-heroes` read as a debug screen: full-body splash art rendered ~60px tall (a global
`.hero-portrait { width: 60px; height: 60px }` in `cards.css`), no layout gutter, three
typefaces, five competing accents, the floating dock covering actions, and a list/detail
split that showed nothing on phones. The game is mid grit-reskin (`docs/10-design/grit-reskin.md`), and the current display
font, Orbitron, reads sci-fi.

## Decision

1. **Roster = portrait-card gallery; a card opens a full-screen hero detail** inside the
   Roster tab (sub-state `grid | detail` owned by `HeroesUI`; ‹ › step through the filtered
   grid order; event `ui:openHeroDetail` opens a hero from elsewhere, e.g. the pull spotlight).
2. **`--font-heading: 'Oswald'`** is introduced and used **only** inside `#view-heroes`. Hero
   Quarters is the reference screen for migrating the rest of the game during the grit reskin;
   Orbitron stays everywhere else until then.
3. **Rarity colour tokens** `--clr-rarity-{normal,epic,legendary}` (+ `-bg`) with
   `.hq-rarity--<tier>` setting `--rarity`/`--rarity-bg`. The older `--clr-tier-*` tokens
   are left untouched for the screens that use them.
4. **New Hero Quarters markup uses the `hq-` class namespace**; Recruit/Assignments/reveal keep
   their existing class names (styled only in the per-screen `heroes-*.css` files).
5. **Panels use one delegated click listener on their root** so `patch()` can replace
   sub-trees without re-binding (ADR 0007 still binds: no rebuild over live progress or an
   open popup).
6. **`--dock-clearance`** pads `#view-heroes` so no action sits under the floating dock.
7. **The sticky art column needs `overflow: clip` on `.hq-detail`**: `hidden` makes sticky inert.
8. **The pull sequence is cancelled on any `ui:viewChanged`**, and hero clips are paused on leaving
   the detail, the Roster tab or the view (hiding with `display: none` does not pause a `<video>`).
9. **The `hq-` namespace is Hero Quarters only.** It overlaps the older headquarters `.hq-preview*` /
   `.hq-benefits*` names in `cards.css` and `BuildingCards.js`; there is no collision today, so new
   `hq-` classes must not be used elsewhere.

## Consequences

- Two heading fonts coexist until the grit reskin migrates other screens.
- `heroes.css` is split into six per-screen files; dead hero selectors were removed from
  `cards.css`.
- Phase 2d (effect seams, loss ceiling, board membership, `notification:show`) needs no UI
  change: the Assignments board renders whatever `stationRows` returns.
- The "Duplicate -> Shard" card label was dropped: `isDuplicate` is true for every non-hero grant,
  including stage-2 pity-floor shards, so it cannot identify a duplicate hero.
- Not built from spec 3.5/3.6: stars on the spotlight, and the Barracks link in the Assignments note.
