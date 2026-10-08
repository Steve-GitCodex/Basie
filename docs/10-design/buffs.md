# Buffs (built 2026-10-07)

One place to see every bonus the player has, and a proper owner for timed item boosts. Built per ADR 0038
(`docs/20-decisions/0038-buffs-ledger.md`); spec `docs/superpowers/specs/2026-10-03-buffs-design.md`. Mockup (open in a
browser): `docs/10-design/mockups/inventory-buffs/buffs-v1.html` (HUD badge states, Active tab, Overview tab, replace
confirmation). Research: `docs/research/inventory-buffs-codebase.md`.

## Rules

- **`BuffManager`** owns timed item boosts: one active per stat; a second replaces the first. It is the only emitter of
  `buffs:changed` (plus `buff:activated` / `buff:expired`). Save key `buffs`.
- Stats are catalogued in `js/entities/data/buffStats.js`: Economy (`production.all`, `production.{wood,stone,iron,food,
  water,money}`, `gather.load`), Military (`troop.attack`, `troop.defense`), Speed (`march.speed`, `build.speed`,
  `research.speed`, `train.speed`). Only `production.all` has boost items today (`buff_prod_sm`, `buff_prod_lg`).
- **Ledger** (`js/systems/buffs/`): one entry shape for item boosts, region / outpost / expedition buffs, tech, VIP, HQ,
  heroes and events. Read-only: no source's mechanics changed.
- **Production total is the real rate:** `js/systems/resource/productionLayers.js` is shared by `ResourceManager` and the
  Overview. Layers add within themselves, except difficulty and event layers, which compound their entries.

## UI

- **HUD badge** (`#buff-hud-badge`, `buffBadge.js`): always visible; idle "Buffs", active "N · shortest" with a ring, warn
  state under 5 minutes. Click opens the panel (`ui:openBuffs`).
- **Panel** (`BuffsUI.js`, right slide-in, `#buffs-panel`): **Active** tab (Running rows with live countdown via
  `TimerService` `data-timer-format="duration"`; dashed Available slots with Use or Get in Supply for stats with nothing
  running) and **Overview** tab (Economy / Military / Speed; click a row for sources and the "Layers multiply" footer).
  Re-renders only while open, on buff events, never per tick: `resources:ratesChanged` fires every engine tick while population
  changes, so it is gated on a signature of the six rate-layer multipliers (`buffEvents.js`) and only a real change refreshes
  the panel, badge and chip tooltips.
- **Replace confirmation** (`confirmReplace.js`): body-level overlay, Keep / Replace. Reached from the Buffs panel,
  Trading Post Supply/Trader Use and the legacy Inventory Activate via `activateBoostItem`; sits at `--z-confirm` (950),
  above the legacy inventory panel. The panel itself sits at `--z-nav + 20/21`, above the floating dock.
- **Toasts** (`buffToasts.js`): activated, expired, world buff granted, timed world buff expired.
- **Resource chip tooltips** (`resourceChipTooltips.js`): per-resource breakdown, refreshed on buff events.

## Not built

Gather / attack / march boost items, the gather-load clamp fix, a unified modifier pipeline, region locality of buffs.
The Inventory modal is the next plan (`docs/superpowers/plans/2026-10-03-inventory.md`).

Tests: `buffManager`, `buffText`, `buffLedger`, `ledgerSources`, `productionLayers`, `worldBuffStat` unit files;
`tests/browser/buffs-smoke.mjs`.
