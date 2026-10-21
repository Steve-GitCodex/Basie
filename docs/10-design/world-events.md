# World events (target design, not built)

Agreed with Steve in the 2026-10-09 brainstorm. Phase 5 on the roadmap, designed together with `ai-factions.md`.
**This is not built yet.**

- **Prototype:** `docs/10-design/mockups/ai-events/events/` (dev dashboard → Prototypes).
- **Brief:** `mockups/ai-events/BRIEF.md` §5.
- **Research:** `docs/research/world-events-genre.md`.
- **ADR:** 0057.
- **Build breakdown:** `docs/superpowers/specs/2026-10-09-ai-events-breakdown.md` (slices E1–E8).

## One event model, four sources

Every event shares the same parts: `{ id, source, template, stages[], objectives[], rewards (threshold track), effects,
mapAnchor?, threatCost, cooldown, exclusionGroup, offlinePolicy }`. About 8 reusable **templates** (siege, raid wave,
gathering rush, hunt, escort, defend, purge, boom) get reskinned into many events. Content is data.

1. **Faction** events: AI plans surface as events. Examples: the hostile countdown, a rebel camp rising, a faction
   asking for help, a gift caravan to escort.
2. **World** events: neutral happenings.
   - **Storm front:** storm cells slow marches.
   - **Herd migration:** temporary food nodes move along a route.
   - **Supply drop:** whoever gets there first takes it, and AI gather parties race you for it.
   - **World boss waking:** a countdown to the boss opening.
   - **Contamination spreading:** tainted cells creep across a region; clearing them earns rewards.
3. **Calendar (liveops):**
   - Scheduled themed events: "Iron Week", "Raider Purge", "Harvest Rush".
   - Each has an **objective points track** with tiered rewards.
   - Single player has no leaderboard. Instead there is a **personal best**, plus a **par score set by an AI faction**;
     beating it moves standing.
   - **Seeded weekly rotation** (week number + save salt): deterministic, no server.
   - One **featured** event runs for 5–7 days, then **2–3 quiet days**, visible on the calendar.
4. **Milestone** events: one-shot story beats triggered by progress (HQ 10, first ruin, power thresholds). Example:
   "They have noticed you", where all three warlords write.

## Director (pacing)

- The **threat budget** comes from player combat power with diminishing returns (RimWorld-style), multiplied by an
  adaptation factor that drops after the player takes losses.
- **Cycles:** build-up → peak → calm.
- **Failsafe:** if the world has been quiet too long, the director forces a threat **through events** (e.g. a rebel raid
  on the home base). Major factions rightly leave a peaceful player alone, so events have to supply that pressure.
- **Limits:** at most **1 hostile countdown**, **1 featured calendar event**, and **3 other visible events**. The rest
  queue.
- The director decides **how much** pressure there is; the faction brains decide **what** to do with it.

## Where events surface

- **The Events view** (More → Events) replaces the stub. Tabs: **Active · Calendar · History**.
  - **Active:** the hostile countdown pinned on top, then the featured card with its points track and claims, then the
    other events tagged by source.
- **Map markers** for events anchored to the map.
- **Threat banner:** hostile countdown only.
- **Marches panel** rows.
- **Mail:** rewards go to Rewards; letters go to Diplomacy.
- **Toasts**, and **dots** on the More FAB and the Events tile.
- **Welcome Back**, grouped by source with the threat first.
- **Claiming** rewards uses the existing reward flow.

## Replaces

`EventManager` and `EVENTS_CONFIG` are a stub: null timestamps, a single `win_battles` hook, one event active at a time.
`WorldEventManager` (in `js/systems/worldEvents/`) replaces them outright, with no legacy compatibility. The old configs
move into the calendar source.

## Built to extend

- Templates, calendar entries, world events and milestones are **data appends**. Plans add fixture guard tests (a
  synthetic Nth template or calendar week).
- No code hard-codes counts. Read the config lengths and the director limits from data.
