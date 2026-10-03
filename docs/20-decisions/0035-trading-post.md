# 0035 — Trading Post (Shop + Market merge)

Date: 2026-10-02 · Status: accepted · Spec: `docs/superpowers/specs/2026-10-02-trading-post-design.md` ·
Design page: `docs/10-design/trading-post.md`

## Context

The Shop and Market were separate Economy sub-tabs. Market used six fixed `TRADES` cards with a `tradeBonus`
multiplier that allowed round-trip arbitrage; the shop had 17 speed-up cards, a mislabelled "Best Value" pack,
a 5-diamond Cafeteria automation next to 800-diamond queue slots, and a VIP bar that counted diamonds
received. Steve agreed a merged Trading Post design (Supply · Exchange · Trader · Premium). No real users, so
no legacy shims or save migrations.

## Decision

One `TradingPostUI` view (`js/ui/trading/`) with four tabs; `ShopUI.js` and `MarketUI.js` are deleted.

1. **Managers.** `MarketManager` = Exchange only; new `ShopManager` (Supply, crate, purchases) and
   `TraderManager` (wandering merchant). Pure logic lives in `js/systems/trading/` (`exchangeRates`,
   `forYouPicks`, `speedupCatalog`, `crateRoll`, `traderStock`, `traderCycle`). Config in
   `js/entities/data/tradingPost.js`, `SHOP_CONFIG` reshaped in `economy.js`.
2. **Save shapes.** `market` `{ pressure: {giveResource: n}, lastResetDate }` (a missing or invalid date counts as stale and reseeds); `shop` `{ crateClaimedDay }`
   (`YYYY-MM-DD`, UTC); `trader` `{ present, arrivedAt, leavesAt, nextVisitAt, seenVisitAt, stock[] }`.
   Invalid or impossible-time trader data reseeds; invalid shop day becomes null.
3. **Exchange.** One `RESOURCE_VALUE` table, `EXCHANGE_SPREAD` 0.15,
   `rate = value[give]/value[get] × (1 − spread) / pressure`. Pressure rises
   `PRESSURE_PER_1000_WORTH` 0.02 per 1000 worth given (cap ×2) and resets at UTC midnight. A round trip
   always loses (unit test). `tradeBonus` removed (closes the arbitrage residue).
4. **Event rename.** `market:traded` → `market:exchanged`; the alias was removed and all five consumers
   moved (no-legacy).
5. **Data fixes.** 500-diamond pack labelled Popular; Cafeteria automation priced 200 diamonds on the shop
   entry (item-level `diamondCost` stays a 0 placeholder like all items); VIP progress counts diamonds spent,
   fed by `resources:spent`.
6. **Training event.** `UnitManager.train` emits `unit:trainingStarted` (Trader activity cut only).
7. **Daily crate.** `CRATE_TABLE` weighted roll (resources / speed-up / XP / money), one claim per UTC day. Cap-aware:
   the resource roll is restricted to uncapped resources, the claim reports what was actually applied, the
   reveal shows applied amounts plus a "Storage full" note.
8. **Trader timing.** Arrives on `nextVisitAt`, leaves at `leavesAt`; building/training/fighting shortens the
   wait by `activityCutMs` but never below `minAwayMs` (30 min) and never pushes an imminent arrival later:
   `min(nextVisitAt, max(now+minAway, nextVisitAt−cut))`. Pool uses Supply bundle ids (`iron_t4`, `water_t4`)
   because T3 ids have no money price (R2).
9. **For-you.** Picks derived from game state, never serialized; lowest resource excludes money and diamond (R3).
10. **Dots.** Locked tabs never show a dot or feed the `#nav-economy` badge (Trader locked below HQ 2), so HQ1
    players learn of the trader at HQ2.
11. Universal speed-up "Use" targets the first queue with a running job. Resource events are
    `resources:tick/added/spent` (no `resources:updated` exists).

## Amendment (2026-10-02): Exchange + Trader share one tab

Steve: the Exchange and the Wandering Trader can share a tab. Tabs are now **Supply · Market · Premium**.
`js/ui/trading/MarketTab.js` composes the unchanged `ExchangeTab` and `TraderTab` presenters as two panels and
forwards the shell contract to both. Market keeps the HQ 2 lock; its dot is the trader-arrived dot, and opening
Market (for either panel) marks the visit seen. `TradingPostUI` aliases the old `exchange` / `trader` tab ids in
`ui:openTradingTab` to `market`.

## Consequences

- Exchange never destroys value at storage caps: `exchange()` rejects with 'Not enough storage.' when the gain
  exceeds free room, the slider max shrinks to what fits, and Trader prices split over more resources so no share
  exceeds a cap (best effort when impossible; the card shows Need). A bundle is never priced in its own resource.
- Sandbox x10 inflates shop receipts (receipt shows 100 while the grant is 1000) and VIP accrues free in
  sandbox (`rm.spend` emits `resources:spent` without deducting).
- `TRADER_POOL` weights and `CRATE_TABLE` values are first-pass placeholders for a balance pass.
- Deferred minors: `quote.rate` unrounded (UI formats); checkout sheet has no focus trap; hero picker has no
  Escape/resize teardown; banner dot clicks do not restart rotation; Trader countdown via `tick:ui`, not
  `TimerService`; trader whole-block reseed rather than field reconcile; tab dot not re-evaluated at midnight
  while Supply is hidden; no smoke for notifications, Trader "Need" label / away phase; `UIManager.js` (734
  lines) is still a god file; `ResourceManager` ctor clones diamond cap `Infinity` to `null` (pre-existing).
- No RED-first runs were recorded for several tasks (tests written with implementation).
