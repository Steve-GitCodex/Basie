# Trading Post (built 2026-10-02, ADR 0035)

Agreed with Steve 2026-10-02 and **built the same day** (ADR 0035; `ShopUI` / `MarketUI` replaced by `js/ui/trading/`). Mockups (open in a browser):
`docs/10-design/mockups/trading-post/` — `shop-layout.html` (first-round layouts A/B/C),
`trading-post-v2.html` (agreed Supply + Exchange/Trader), `premium-v2.html` (agreed Premium + checkout).
Visual language is Hero Quarters' (ADR 0030): Oswald headings, warm dark surfaces, orange accent,
diamonds in cyan.

## Structure

Shop and Market merge into one **Trading Post** with three tabs: **Supply · Market · Premium** (amended
2026-10-02: Exchange and the Wandering Trader share the **Market** tab side by side, as in the v2 mockup).
Supply = coins/diamonds → items; Market = Exchange (resources ↔ resources) + Trader (resources → items).
Red dots on a tab mark something free or new (daily crate ready, trader arrived).

## Supply (the shop)

- **Featured slot:** one large rotating banner for the headline offer (dots for rotation).
- **Free daily supply crate:** claimable once a day (random resources / speed-up / XP), reset timer,
  red dot when ready. New mechanic: claim timestamp in save state.
- **"For you" row:** up to 6 items picked from game state, each card stating why ("Barracks Lv4 · 52m
  left", "Iron is your lowest resource", "Kira is 140 XP from Lv12"). Derived, never serialized.
- **Categories:** Heroes (recruit tokens + hero cards + universal cards) · Speed Ups · Resources ·
  Boosts (XP bundles + production buffs). The Automations tab is removed (its item moves to Premium).
- **Speed-ups:** one card per duration (5m / 15m / 1h / 8h / instant) with a Universal · Build · Train ·
  Research switch, replacing 17 cards.
- **No more than 6–8 items per row.** Every card shows **owned ×N** and a **Use** button when owned.
- Prices are labelled buttons with their currency, greyed out when unaffordable. No dark patterns:
  visible close buttons, neutral confirm wording.

## Exchange (resource ↔ resource)

- Pick a resource to give, a resource to get, and slide the amount (0 → max held). Live "you give →
  you get" readout and a Trade button. Replaces the six fixed `TRADES` cards.
- Rates come from **one value table with a spread**, so any round trip (wood → stone → wood) loses.
  This closes the `tradeBonus` arbitrage exploit (roadmap audit residue) by construction.
- The existing inflation (+2% per trade) shows as a rate meter that eases back overnight.

## Trader (wandering merchant)

- Modelled on Rise of Kingdoms' Mysterious Merchant: a rotating stock of ~6 items priced in
  **resources** (speed-ups, crates, XP, tokens, hero shards), occasional discounts, per-item sold-out
  state, a "leaves in" timer.
- It visits on a timer and comes back sooner when the player builds, trains or fights.
- New mechanic: stock generation, visit/refresh timers, save state (stock + sold flags + next visit).

## Premium

- **Real-money diamond packs stay, purchase simulated** until the Phase 7 backend. A single persistent
  yellow "Test mode: purchases are simulated" strip; no per-card nagging.
- **Checkout sheet:** pack → confirm → receipt, so a real payment provider later replaces only the
  confirm step. (Today's `ShopUI._buyDiamondPackage` already simulates; keep that behaviour.)
- VIP progress bar above the packs.
- **Permanent unlocks & diamond spends** row: Build queue +1, Research queue +1, **Cafeteria
  auto-restock** (moved from Automations), Instant finish.

## Data fixes the design depends on

- `SHOP_CONFIG` marks the 500-diamond pack "Best Value", but packs 1–3 are exactly linear (~100 💎/$);
  only 2,500 and 5,000 give +25%. Relabel ("Popular") or move real bonus diamonds onto the big packs.
- `cafeteria_automation` costs 💎 5 next to 💎 800 queue slots and 💎 8 instant finish — reprice
  (~💎 150–300) when the economy balance pass runs.
- VIP progress counts diamonds *received*, not spent (audit residue) — decide before the VIP bar ships.

## Build notes (for whoever schedules it)

- UI-only part (merged view, Supply, Exchange widget over the existing inflation model, Premium tab,
  checkout sheet): roughly the size of the Hero Quarters UI redesign. `ShopUI.js` (~360 lines) must be
  split into a `js/ui/trading/` folder; new markup under its own class namespace; patch in place
  (ADR 0007).
- New mechanics (daily crate, Trader, Exchange value table) need save fields with seed + reconcile
  coverage (ADR 0002) and an ADR.
- Retest the tutorial if nav entries move (`TutorialManager` hardcodes view ids).

## Research behind it

GameAnalytics (UI conversion: hierarchy, labelled buy buttons, limited options), PocketGamer.biz
(dark patterns to avoid), Gamigion (personalised offers, flash sales), Rise of Kingdoms Courier Station
guides (Mysterious Merchant), Travian / Forge of Empires / Heroes of Might & Magic (exchange ratios and
slider UI).

## As built (ADR 0035)

- Managers: `MarketManager` (Exchange), `ShopManager`, `TraderManager`; pure logic in `js/systems/trading/`; data in
  `js/entities/data/tradingPost.js`. Smoke: `tests/browser/trading-smoke.mjs`.
- Exchange: one value table, spread 0.15, pressure +0.02 per 1000 worth given (cap x2, UTC-midnight reset);
  `tradeBonus` removed; event is `market:exchanged`.
- Crate: weighted table, once per UTC day, cap-aware (rolls only uncapped resources, reveal shows applied amounts).
- Trader: unlocks at HQ 2; activity (build/train/fight, `unit:trainingStarted`) shortens the wait but never below
  30 min and never delays an imminent arrival; pool uses Supply bundle ids.
- Tabs: Supply · Market · Premium. `MarketTab` hosts the `ExchangeTab` and `TraderTab` panels (two columns,
  stacked under 900px); Market is HQ 2-locked and its dot is the trader-arrived dot. `ui:openTradingTab` still
  accepts `exchange` / `trader` (aliased to `market`).
- Locked tabs show no dot. For-you lowest resource excludes money/diamond.
- Data fixes done: Popular label, Cafeteria auto-restock 200 diamonds, VIP counts diamonds spent.
