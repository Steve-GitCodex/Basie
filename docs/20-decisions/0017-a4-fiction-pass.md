# 0017 — A4 fiction pass (post-apocalypse renaming)

## Context

Grit reskin Workstream A phase A4 (`docs/10-design/grit-reskin.md` § A4). The world was
authored fantasy (goblins, dragons, shrines, arcane magic); the reskin's feel target is
Last Shelter–style post-apocalypse. The fiction is carried entirely by display strings,
but POI / region / faction / monster / building **ids are save-state keys** — renaming
one orphans everything a save stored under it (`worldState.js` seed/reconcile,
`_outpostOwner`, `_discovered`, region owners; and every `monsterId` / `buildingId`
reference). B1 already shipped grit-appropriate names for the *generated* filler POIs
(`gridGen.js`); only the hand-authored strings remained.

## Decision

Re-fiction **display strings only, never ids.** Scope done this pass:

- `worldMap.js` — faction `name`/`tag`, region `name`, curated POI `name` + `icon`. All
  `id`, `factionId`, `monsterId`, `capturesRegion`, `regionId`, `subtype`, and every
  numeric field byte-identical. Fantasy POI-marker emoji swapped for grit glyphs
  (🐉/🐲 → 🦂/☠️, 🏰/🏯 forts → 🏭, ⛩️ shrine → 📡 relay, 👺 → 🪓, 🗼 watchtower → 📡),
  kept as emoji drawn via `ctx.fillText` — **not** moved to the SVG marker system (that
  is B3's job; A4 only seeds the direction).
- `combat.js` — `MONSTERS_CONFIG` and `CAMPAIGNS_CONFIG` `name`/`icon`/`description`/wave
  `name`. All `id`, `monsterId`, `campaignStage`, `requires`, and stats untouched.
- `buildings.js` — `magictower` only (Magic Tower → Comms Tower 📡; description +
  effectLabel de-magicked). The building `id` `magictower` stays (it is the save key and
  the nav-view key in `navigation.js`). Every other building name was already
  genre-neutral.
- `story.js` — light re-fiction of all 6 chapters (keep/empire/arcane → outpost/settlement/
  power-grid; Steward → Quartermaster, Scholar → Engineer). Chapter ids, questIds,
  buildingIds, triggers, rewards, arcColors preserved.

## Consequences

- **Deferred (TODO — flagged, not fixed):**
  - **Hero cast** (`heroes.js` + hero-card/fragment strings in `economy.js`) — e.g.
    `archsorceress` "Lyra Dawnveil / Arch Sorceress" with `fireball`/`arcane_nova`/
    `mana_shield` skills, and `warlord` "Lord Arcturus". Left intact: hero skill display
    names are coupled to skill **ids**, and the whole cast is slated for the Hero
    recruitment/management redesign (roadmap → UX friendliness). Re-fiction it there so it
    stays consistent, rather than churning it twice.
  - **Unit tier names** (`units.js`) — Paladin / Crusader / Templar / Archon / Phantom
    read medieval-religious. Borderline (not hard fantasy), a 40-row table, and outside
    the stated A4 scope. A future light pass.
- Fiction now reads inconsistently across the seam between world/combat/buildings (done)
  and heroes/units (pending) — accepted, per the spec's "light pass, not a rewrite."
- New regression test `tests/unit/gameData.test.js` → **"save-key ids are unchanged by
  fiction passes"** freezes the region / faction / curated-POI / monster id sets. Any
  future fiction pass that touches an id fails the suite instead of silently orphaning
  saves. Verified: `npm test` 166/166; boot/world/dev browser smokes pass with zero page
  errors; world-smoke's id-driven seed/reconcile + region-ownership checks confirm no id
  was orphaned.
