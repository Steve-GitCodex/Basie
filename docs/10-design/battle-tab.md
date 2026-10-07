# Battle tab (all four slices built — 2026-10-03 and 2026-10-05)

Agreed with Steve 2026-10-02 as the final shape of the Combat view (`#view-combat`, today's `CombatUI`).
**Status:** slices 1+2 (campaign model + map: chapters, elites, stars, A1 trail, stage panel, Commanders, tabs, row cap) are built — ADR 0036, spec `docs/superpowers/specs/2026-10-03-battle-tab-campaign-design.md`, plan `docs/superpowers/plans/2026-10-03-battle-tab-campaign.md`. Slices 3+4 (full-screen battle-lines playback with hero bar + timeline + round log, and results with casualty layers, hero XP/level-ups, why-lost analysis and last-attempt comparison) are built 2026-10-05 — ADR 0037 (`docs/20-decisions/0037-battle-scene.md`), spec `docs/superpowers/specs/2026-10-04-battle-playback-results-design.md`, plan `docs/superpowers/plans/2026-10-04-battle-playback-results.md`. Combat rules are unchanged: this is a presentation of the ADR 0034 resolver
(`docs/10-design/combat.md`). Mockups (open in a browser): `docs/10-design/mockups/battle-tab/` —
`battle-final.html` (agreed screens, one consistent scenario end to end), `trail-scaling.html` (A1 vertical
vs A2 horizontal trail; **A1 chosen**). Visual language is Hero Quarters' (ADR 0030).

## Structure

Tabs: **Campaign · Survival · Log** (the battle log leaves its side panel for its own tab).

## Campaign map (A1 vertical trail)

- A road that winds **upward**; the view opens scrolled to the **YOU** marker. Cleared road glows orange.
- The road is a smooth curve **generated through every stage point** (nothing hand-placed), so adding
  monsters only adds data.
- Stages group into **chapters**: small numbered nodes for regular fights, a large **boss** node closing
  each chapter (today's 10 monsters become the chapter bosses), optional **elite** side-branches
  (purple diamond on a short spur). Chapter dividers; locked chapters sit under fog with their unlock
  condition.
- Cleared nodes show their best **stars**.

## Stage panel (slides in on tap)

- Enemy name, description, waves (stacks with tier, type, count, abilities, boss tag), encounter
  modifier when rolled, rewards with **first-clear** bonus, squad picker, win estimate
  ("Likely win ~80% · ~26 lost"), Deploy.
- **Commanders:** one row per Barracks slot (up to 4): hero portrait, rarity, level, the troops that slot
  leads and its row; aura/passive effects (orange) and triggered skills with their trigger in words
  (purple). Empty slots say so with an Assign link. A **support** line for Hero Quarters heroes. A
  **squad total** line summing hero bonuses (from the same stat aggregator the fight uses).
- **4 slots, 3 rows** (Steve, 2026-10-02): combat keeps Front / Mid / Back; each slot picks a row, so two
  slots can share one. Shared rows render their stacks side by side.
- **Max 2 slots per row** (Steve, 2026-10-02). Not enforced today: `UnitManager.setSlotRow` accepts any row
  and unslotted defaults come from unit type (`DEFAULT_ROW`), so four infantry slots all land on Front.
  When built:
  - the Barracks Front / Mid / Back toggle disables a row that already holds 2 slots;
  - defaults must respect the cap — a slot whose default row is full falls to the next row back
    (Front → Mid → Back; a full Back goes forward to Mid);
  - the cap counts **slots**, even when two slots merge into one stack (same `tierKey`, ADR 0034 R2);
  - `setSlotRow` rejects a 3rd slot in a row (rule lives in the manager, not just the UI) — regression test
    in `tests/unit/unitManager.test.js`;
  - no save migration (no-legacy): old dev saves breaking the cap are re-flowed by the default rule on load.

## Playback (P1 battle lines)

- Your rows face the enemy's rows; each stack is a card whose count ticks down; hit stacks flash;
  floating numbers (red damage, orange kills, green heals); "led by" hero badge on stacks.
- **Strength bars** for both sides; **attack arrows** with counter multipliers. Rules shown must match the
  resolver: every stack hits the enemy's front-most living row; back rows aren't hit while the front
  stands; enemy back-row ranged still counter your front infantry.
- **Key-moment banners** only for events that matter (row breaking, boss enters, hero strike, skill fires,
  revive).
- **Hero bar:** one card per squad hero (live kills, skill icons ready / firing / used), dimmed support card.
- **Timeline:** pause, step back/forward, scrub, 1× / 2× / Skip; wave markers and event icons to jump to.
  Free: the report already stores every round.
- Toggles for numbers / arrows / log; short log explaining each round in words.

## Results

- **Victory:** stars with their rules printed; casualties in layers (Sent / Came back / Wounded / Dead) and
  a per-stack table (with kills); **Commanders** (kills, skills fired and when, XP gained with bar,
  level-up callout naming any unlocked skill, MVP); missed-chance hint for empty slots; rewards revealed
  last, rarest last; Replay / Back to map / Next.
- **Defeat:** comparison with the last attempt on this stage ("Warboss left at 64%"); casualty layers;
  Commanders (skills fired; **no battle XP on defeat** — today's rule); **"Why you lost"** with real numbers
  and one-tap fixes (train, change mix, assign heroes); "Watch the turning point" jumps the replay.

## New data / code the design needs

- More monster data: regular stages and elites per chapter (the resolver needs no change).
- Star rules + best stars per stage; last report per stage (for the comparison); first-clear rewards.
- Report additions: hero id on hero hits and on triggered-skill events (with round), for per-hero kills and
  "skills fired".
- "Why you lost" / key-moment analysis: pure functions over the report, reusing `hitMath`.
- Save fields need seed + reconcile coverage (ADR 0002); record the stage/chapter model in an ADR.

## Balance finding (for the parked balance pass)

Running the mockup's squad through the real resolver: hero strikes dominate. With today's
`HERO_STRIKE.factor` 10, two low-level heroes turn a 23-round fight (12 troops, no heroes) into 4 rounds,
and the mockup's 240-troop squad clears the Mutant Warband in 3 rounds losing 1 Soldier. The mockup's
round-by-round numbers are hand-set to show the intended post-balance fight.

## Research behind it

Replay controls and readability (Positech blog, World of Tanks damage log, itch.io auto-battler devlogs),
results-screen structure and reward ordering (Gems of War community, Koei Tecmo, Modern Warships),
4X battle-report casualty layers (WB Games battle report, Kingshot guide).
