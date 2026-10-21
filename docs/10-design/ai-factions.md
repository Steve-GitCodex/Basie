# AI factions (target design, not built)

Agreed with Steve in the 2026-10-09 brainstorm. Phase 4 on the roadmap. **This is not built yet.**

- **Prototype:** `docs/10-design/mockups/ai-events/factions/` (dev dashboard → Prototypes).
- **Brief:** `mockups/ai-events/BRIEF.md` §4–4.1.
- **Research:** `docs/research/ai-factions-genre.md`, `ai-events-codebase.md`, `ai-factions-prototype.md` (simulator
  rules and starting constants).
- **ADRs:** 0052–0056.
- **Depends on** the power stat and player levels (`power-levels.md`) for AI difficulty. Until those land, use a
  placeholder strength made from HQ level and troops.

## Purpose

1. **Pressure.** Keep the player busy holding their regions.
2. **A living world.** Factions grow, fight each other and react.
3. **An engagement loop** that the events in `world-events.md` build on.

The AI is **openly AI**. It never pretends to be other players, but it must *feel* intelligent. Its intelligence is pure
game rules; there is no LLM. The goal is **visible intelligence** (telegraphs, a stated "why", a voice, memory), not
clever-but-hidden decisions.

## Factions (ADR 0056)

- **3 major factions**, hand-authored:
  - **Red Talon Raiders** (`bandits`, `#e05a3d`): aggressive raider. Warlord Vesk. Holds grudges, strikes fast.
  - **Scavenger Packs** (`goblins`, `#b7d645`): opportunist. Mother Rook. Sends gifts, strikes when you look stretched,
    pounces on a weakened rival, and is the most likely to betray.
  - **Iron Covenant** (new, steel blue `#6f9fd8`): patient builder. Marshal Kane. Keeps deals, expands slowly, makes few
    but heavy assaults.
  - Existing ids stay, because they are save keys.
  - **Covenant regions (working decision 2026-10-09):** `goblin_crest` (Vulture Ridge) + `dragon_spire` (Behemoth
    Spire), so the three factions surround the player. The Scavengers keep `west_warrens` + `mistwood`.
  - **Commanders (working decision 2026-10-09):** factions get their own roster (`factionHeroes`) and never reuse the
    player hero ids. The prototype shows player hero names only as placeholders.
- **Minor factions (rebels):**
  - **Generated** from archetypes: raiders, cultists, deserters. Names are composed, personality weights are sampled
    from each archetype's ranges, and the colour is violet `#b07ad8`.
  - At most **3 alive at once**. One spawns every 2–4 days.
  - Lifecycle: **camp → settlement → stronghold**, about 3.5 days if left alone. A **stronghold can take a region**.
  - The player clears them; majors can fight them too.
  - A `tier: minor|major` field keeps "a minor rises to major" possible later.
- **Bases:** each major has a physical **home base**, a POI in its home region with a level. It can be scouted and
  attacked, but is very hard. **Bases are known landmarks visible through fog**, so marches never come "from nowhere".
- **Visible marches:** scouts, supply columns, gather parties, raids and gift caravans move like player marches, in the
  faction's colour. Hostile ones can be intercepted.

## Brain: utility AI with staged plans (ADR 0052)

- **Scoring:**
  - A faction thinks every ~7 game minutes, plus jitter.
  - It scores the actions it can take: scout, gather, fortify, claim, raid, assault, attack a rival, gift, truce,
    demand, idle.
  - Score = **personality weights × world-state considerations** run through response curves, with a compensation
    factor for how many considerations there are.
  - It picks at random among actions within 12% of the best score.
  - The top factor becomes the visible **"why"** ("weak walls · grudge · you were away").
- **Rules from the simulator** (`ai-factions-prototype.md`):
  - every action has a cooldown, and repeating the last action carries a ×0.6 penalty;
  - strength stays in a **band around player power** (actions move a bonus within −0.4…+0.3 and never compound);
  - there is an explicit idle action;
  - the territory bonus is capped at 3 regions;
  - **the AI only launches strikes it expects to win**, using what it remembers of your reinforce rate;
  - it starts with an optimistic prior, so it **probes** you first;
  - diplomacy needs a motive.
- **Plan stages:** **Probe** (scouts watch the target) → **Massing** (a **war camp** on the faction's own border, fed by a
  supply column from its base; the ring fills; the countdown runs to **departure**, retune toward 60–90m) → **March**
  (camp → target; intercept window) → **Battle** → **Aftermath**.
- **Adaptation and memory:**
  - It targets weak regions and remembers whether you defend.
  - It backs off after a beating.
  - Grudges are standing reasons.
  - Factions react to each other: AI-vs-AI fights, and opportunists exploit a weakened rival.

## Fairness (ADR 0054)

- **One hostile countdown** on the player at a time, across all factions.
- **The outcome is locked when it's telegraphed.** What decides the result is what the player does, not dice.
- **A calm period after each strike:** 4h after a raid, 12h after an assault.
- **Strikes never land while you're offline.** Plans ripen while you're away. On return, a strike gets a fresh
  countdown of **at least 45 minutes, starting when Welcome Back is closed**.
- **Betrayal** is rare and always **foreshadowed** (trust visibly slips, then a warning). At most one foreshadow roll
  per faction per day.
- "You're too strong" reactions need an in-character reason and a visible warning. There's a global cap on
  simultaneous assaults.
- Difficulty reads **combat power + player level**, with diminishing returns, never wall-clock alone.

## Region defense: staged hybrid (ADR 0055)

1. **Walls / fortification:** a baseline per region (e.g. "≈ 30% of your power"). Small raids bounce off.
2. **Telegraph + respond:** the main way to play.
   - **Reinforce** fights behind the walls (+30%).
   - **Intercept** meets the enemy on the road with no wall bonus.
   - The forecast uses the power-levels bands (green/amber/red) and the win estimate.
3. **Garrison slots:** a later stage.

- **Home Refuge** can be raided for resources but **never captured**.
- Losing a region drops its buff and **re-locks and re-fogs the regions beyond it** (the cascade). World-foundation work
  must handle this, because today ownership can only be gained (`captureRegion` hard-codes `'player'`).

## Standing, trust and diplomacy (ADR 0053)

- **Standing** runs from −100 to +100 in 5 bands: Hostile < −60 ≤ Unfriendly < −20 ≤ Neutral ≤ 20 < Friendly ≤ 60 <
  Allied. It is the **sum of named reasons, each fading on its own timer** (e.g. "−25 You took Red Lowlands · fades in
  2d 4h"). Show it as a breakdown.
- **Trust** runs from 0 to 50 (5 pips) and moves slowly. Kept deals raise it; broken ones crash it. **Betrayal reads
  trust.**
- **Friendship is never permanent.** It drifts back to the baseline and can break.
- **Diplomacy, two-way and light:**
  - AI → player: gifts, truce offers, warnings and demands/ultimatums arrive in **Mail → Diplomacy** (a new category).
    Each letter has an **expiry**, Accept/Decline (or Pay/Refuse), and its consequences shown up front.
  - Player → AI: **send tribute** (it can cancel a plan that is still massing), **propose a truce**, **request help
    against another faction**. Each has a cost, a shared cooldown, and a hint like "likely refused while Unfriendly"
    from the same scoring.
  - Formal pacts are deferred, but the data stays ready for them.

## Scouting and intel

- The existing **`'scout'` march** is extended to faction bases, war camps, warbands and rebel camps.
- **Scout tier (1–3)** comes from your scouting strength against the target's watch level.
- The **scout report** arrives in **Mail → Reports** and expands in place. Its sections:
  1. Overview: level, walls, power band, report age/staleness.
  2. **Heroes**: real roster names, level, stars, skills at tier 3.
  3. **Barracks/squads**: front/mid/back rows with real unit types and tiers; counts banded, exact at tier 3.
  4. Garrison and defenses.
  5. **Military tech** (tier 3).
  6. Loot on hand.
  7. Intent + why, hidden agenda and betrayal risk at tier 3, and **counsel** based on counters.
- A caught scout tips the target off (−5 standing).
- **Symmetry:** the AI's Probe stage is them scouting you. "What they learned about you" explains their adaptation.

## UI surfaces

All of these are prototyped in `mockups/ai-events/factions/`:

- **Map layer:** faction bases, war camps, routes (hostile red dashed, scouts yellow dotted, non-hostile AI dotted),
  threat hatching, rebel camps.
- **Threat banner** under the top bar, one at a time.
- **Marches panel** split into **Threats / Your marches**, with a calm timer.
- **Intel card** anchored to the map node, instead of the bottom POI panel. It lines up with the anchored popover in
  `power-levels.md`.
- The **march sheet** gains a forecast and Intercept.
- **More → Factions** opens the Factions modal: standing breakdown, trust, tags, intel, memory, diplomacy.
- **Mail → Diplomacy.**
- **Welcome Back** grouped by source, threat first, with two buttons:
  - **Defend now** → World, centred on the threat, card open.
  - **Continue** → stay; the threat stays visible in the banner, Marches, Events, the More dot and a toast.
  - Gains are already credited, so neither button loses anything.
- The **IMPROVED** proposals in the prototype (anchored card, Marches split, Threat focus map mode, grouped Welcome Back)
  were **accepted as the working design** on 2026-10-09.

## Build breakdown

The build is split into session-sized slices in waves: `docs/superpowers/specs/2026-10-09-ai-events-breakdown.md`.

## Built to extend

- New major factions, archetypes, actions, letters and voice lines are **data appends** (`factions.js`). Plans add a
  fixture guard test, such as a synthetic 4th faction and Nth archetype.
- No code hard-codes 3 factions, 9 regions or 3 rebels. Read the config lengths and caps.
- Ownership stays a free owner string (ADR 0005). `world:regionLost` mirrors `world:regionCaptured`.
