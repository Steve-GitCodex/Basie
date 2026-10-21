# Prototype brief: AI factions + game events

Written 2026-10-09. This is the single source for building the AI-factions and game-events prototypes. Everything here was
agreed with Steve (the owner) in a brainstorming session, or comes from research files this brief points to. Read it
fully before writing any code.

## 1. What the prototypes are for

Steve has to **see and feel** how AI opponents and game events would work **inside Basie's current UI**, before a spec and
implementation plans get written. The prototypes are design tools, not game code. Nothing goes into `js/` or `css/`.

### Feedback on earlier attempts (do not repeat these mistakes)

1. **v1** was disconnected static screens with emoji and invented UI. One march "came from nowhere", with no visible
   origin.
2. **v2** was connected and clickable, but it ignored Basie's real UI. It had invented panels, the wrong colours, a fake
   top bar and emoji.
3. **v3** (deleted 2026-10-09) put the new pieces on screenshots of the real world map, which was
   the right idea. Steve still found it **"not very well done, not easy to follow"**, and it **only covered factions,
   not events**. Specific problems:
   - The guidance was weak. Steve had to work out what to click.
   - The faction bases and war camp were drawn on top of existing POIs, which made them hard to read.
   - Events got a single list screen.
   - The notes sat in a side column, far from what they described.

Steve also said: "the mockup does not have to be exact; the important part is knowing how the current UI looks". So:
**match the real UI's look and layout, but clarity beats pixel-perfection.**

Steve also said: **"remember we can still improve the current UI."** The current UI is the starting point, not a
constraint. Where an existing surface works against these features, propose a better version. Examples:
- the bottom POI panel is cramped for faction info;
- the Events view is a bare page;
- the Marches panel can't distinguish threats;
- the map is cluttered when zoomed out.

Rules for proposed improvements:
- Mark each one with an **IMPROVED** tag (amber, distinct from the cyan NEW tag).
- Show briefly what it replaces ("was: …"). A small before thumbnail or a one-line caption is enough.
- Explain why in the caption.
- Keep the game's visual identity (palette, fonts, dark warm surfaces).
- Don't redesign things unrelated to AI or events.
- List every improvement in your report. Each one becomes a decision for Steve.

## 2. Non-negotiable requirements

1. **Easy to follow: guided walkthrough first.** Each prototype opens in **Guided mode**:
   - A numbered story moves forward with **Next / Back** (and the arrow keys).
   - Each step shows a short **caption card**: what is happening and what to notice, in plain words, 1–3 sentences.
   - A **spotlight** (dim everything except the element that matters, or a pulsing ring around it) shows where to look.
   - A **progress indicator** shows where you are, e.g. "Step 4 of 14 · Massing".
   - A toggle switches to **Explore mode**, where everything stays clickable and the caption hides.
   - Steps can drive the UI themselves (open the panel, send the march), so Steve never has to hunt for the right click.
     In Explore mode, the same clicks work by hand.
2. **Show the real UI, and mark what's new.** Use the reference screenshots in `ui-reference/` as backgrounds or as exact
   visual references. Rebuild existing panels with the same layout, colours and fonts. Mark every **new** element with a
   consistent "NEW" treatment (a small cyan `NEW` tag plus a subtle cyan outline), so Steve sees at a glance what is added
   and what already exists. A legend at the top explains it.
3. **Self-contained and easy to open.**
   - Each prototype is **one folder**: `index.html`, plus images in the same folder or a sibling `ui-reference/`, referenced
     **relatively**.
   - No absolute `/css/...` or `/assets/...` paths, no build step, and no fetch of local files, so it works by
     double-clicking (file://) and also when published as a web page.
   - Inline the SVG icons you need, copied from `assets/icons/svg/*.svg`. They are white-filled. Inline them as `<symbol>`s,
     or as CSS masks with data URIs.
   - Google Fonts links are fine. The game uses Oswald (headings), Outfit (body) and Orbitron (display).
4. **No emoji anywhere in the UI.** Basie uses an SVG icon set. Available icons: archive arena backpack base bow box
   cafeteria check clock column combat crown diamond economy envelope fire flask-potion flask food fork-plate gather gear gift
   hammer heart heroes house infinity iron lightning lock money more production quests scroll search shield skull speedup
   star-burst stone sword trash warning water wood world x-circle xp.
5. **Clear map readability.** New map elements (faction bases, war camps, rebel camps, event markers, routes) must not
   collide with existing POI nodes. If a background screenshot has POIs where you need a marker, choose a clearer spot,
   lightly mask the area, or redraw the region cleanly in the screenshot's style. Every march or route must **start at a
   visible origin**: a base, a camp, your outpost, or a map-edge marker with a label.
6. **Desktop first, at 1280×800.** It must fit and scale down cleanly on a laptop screen: scale the 1280×800 "game frame"
   to the window width, and keep the caption card readable. Phone layouts are a bonus, not required.
7. **Verify before reporting.**
   - Run the whole guided story in a headless browser and screenshot **every step**.
   - Look at the screenshots yourself and fix anything cluttered, overlapping or unreadable.
   - Zero page errors.
   - Report back with the screenshot paths. See §9 for how to run Playwright here.

## 3. The current UI (look at the screenshots)

Reference screenshots are in `docs/10-design/mockups/ai-events/ui-reference/`, captured from the live game at 1280×800
(`20–22` are phone, 390×844):

| File | Shows |
|---|---|
| `01-city-base-view.jpg` | Base (city) view: isometric city, top bar, dock |
| `02-topbar-player-chip-popover.jpg` | Player chip popover from the top bar |
| `03-world-default-zoom.jpg` | World map at the default zoom, centred on Home Refuge |
| `04-world-zoomed-out-regions.jpg` | World map zoomed out: the 3×3 regions, fog, padlocks, POIs |
| `05-world-poi-panel.jpg` | Tapping a POI opens the **bottom POI panel** (`.world-panel`) |
| `06-world-march-dispatch-sheet.jpg` | The **march dispatch sheet** (`.world-sheet`): squad list + March |
| `07-world-march-in-progress-and-marches-panel.jpg` | A player march on the map + the **Marches panel** (top-left) |
| `08-more-grid-open.jpg` | The **More** grid (bottom-right FAB): Build, Quests, Combat, Economy, Events, Arena (soon) |
| `09-events-view-current.jpg` | The current **Events** view (`#view-events`), which today shows an empty state |
| `10-mail-hub.jpg`, `11-mail-row-expanded.jpg` | **Mail** hub: category tiles on the left, rows expand in place |
| `12-inventory-modal.jpg` | Inventory modal (same frame size as Mail) |
| `20-phone-world.jpg`, `21-phone-mail-hub.jpg`, `22-phone-more-grid.jpg` | Phone layouts |
| `bg-world-held.jpg` | Zoomed-out world, **Red Lowlands owned by the player** (green). Frost Hold is uncovered (red, Red Talon). Clean background with no Marches panel or toasts. |
| `bg-world-today.jpg` | Zoomed-out world, **Red Lowlands owned by Red Talon** (red). Frost Hold is fogged. Use this for the "region lost" state. |

What a player sees today:

- **Top bar** (two tiers on phone): a player chip (crown avatar, name, level) on the left, resource chips (wood, stone,
  food, iron, water). On the right, money, diamonds and a **Buffs** button. About 48px tall.
- **Dock** (bottom-centre): Inventory · **Base/World flip** (big pill; it shows the *destination*) · Mail (with an unread
  badge).
- **More** FAB (bottom-right, ⋯) opens a 2-column grid popover.
- **Build-queue sidebar** (right edge, collapsible, lightning tab).
- **World map**: a top-down grid made of 9 regions in a 3×3 layout. Big region names. **Your territory is green**
  (`#3ad17a`), **Scavenger Packs lime** (`#b7d645`), **Red Talon Raiders red** (`#e05a3d`). Undiscovered regions are dark
  with dashed `?` markers and a padlock. POIs are round nodes with an icon, a **diamond level badge** in the owner's
  colour, and a small green health bar.
  - **Territory legend**: bottom-right.
  - **Recenter button**: bottom-left.
  - **Marches panel**: top-left. It lists marches with a progress bar.
  - A player march shows as a **dashed line from "Your Outpost"** to the target, with a mover dot and an ETA pill.
- **Region layout** (zoomed-out screenshot, 1280×800):
  - Top row: Ashwood · Vulture Ridge · Behemoth Spire.
  - Middle row: West Warrens (Scavengers, lime) · Command Ruin (locked centre) · Ember Reach.
  - Bottom row: **Home Refuge** (player, green; outpost near x≈403, y≈655) · **Red Lowlands** (x≈520–760, y≈533–772) ·
    **Frost Hold** (x≈760–1000, y≈533–772).
- **POI panel**: bottom-centre card (about 440px wide, warm dark brown `hsl(30,30%,11%)`). It holds an icon, a name in
  Orbitron-like display type, the region as a subtitle, label/value rows, and a full-width action button. The power-levels
  plan (`docs/10-design/power-levels.md`) will later turn it into a popover anchored to the target, with a power gauge
  and a green/amber/red band chip.
- **March sheet**: same position as the POI panel. It shows the title "Attack X", squad rows, an ETA line and an olive
  **March** button.
- **Mail**: a modal (about 960×640) with an orange glow border. Header: "MAIL", N unread, **Claim all (N)**, close. Left:
  category tiles (Reports, Rewards, System, Starred, Trash), each with an icon, a name in Oswald, "N mail · U unread", and
  a "Claim N" button. Right: list header plus rows. Each row has an unread dot, a type icon, subject, `sender · age`, reward
  pills, and an inline Claim button plus a star. Tapping a row **expands it in place**, showing text, a reward grid, Claim
  and Delete.
- **Events view**: a full page with the header "☆ Events / Limited-time events with exclusive rewards". Today it only has
  an empty "No Events Running" card. The game's existing `EventManager` is a stub.
- **Offline return**: an inline "Welcome Back" modal (built in `js/main.js`) that lists offline earnings.
- **Theme tokens** (`css/base/variables.css`):

  | Token | Value |
  |---|---|
  | `--clr-bg-base` | `hsl(30,10%,5%)` |
  | `--clr-bg-surface` | `hsl(30,9%,8%)` |
  | `--clr-bg-elevated` | `hsl(30,8%,11%)` |
  | `--clr-bg-panel` | `hsl(30,8%,14%)` |
  | `--clr-border` | `hsl(30,10%,18%)` |
  | `--clr-border-light` | `hsl(30,10%,27%)` |
  | `--clr-primary` | `hsl(32,90%,55%)` (orange) |
  | `--clr-primary-dark` | `hsl(30,88%,40%)` |
  | `--clr-success` | `hsl(90,45%,48%)` |
  | `--clr-warning` | `hsl(48,95%,52%)` |
  | `--clr-danger` | `hsl(0,85%,58%)` |
  | `--clr-text-primary` | `hsl(35,15%,93%)` |
  | `--clr-text-secondary` | `hsl(35,10%,62%)` |
  | `--clr-text-muted` | `hsl(35,8%,42%)` |

  - Fonts: `--font-heading` Oswald, `--font-body` Outfit, `--font-display` Orbitron.
  - The Marches panel background is `hsla(215,30%,10%,.92)`.
- Read the real CSS for detail if you need it: `css/components/world-view.css`, `css/components/mail.css`,
  `css/components/mail-expand.css`, `css/layout/header.css`, `css/components/events.css`, `css/components/buttons.css`.

## 4. Agreed design: AI factions

Research: `docs/research/ai-factions-genre.md`, `docs/research/ai-events-codebase.md`, and
`docs/research/ai-factions-prototype.md` (simulator findings; read its "rules" list).

- **Purpose:**
  - **Pressure**: keep the player busy holding their regions.
  - **A living world.**
  - The AI is **openly AI**. It never pretends to be other players, but it must *feel* intelligent. Its intelligence is
    pure game rules; there is no LLM.
- **Two tiers of factions:**
  - **3 major factions** (hand-authored):
    - **Red Talon Raiders**: aggressive raider. Leader **Warlord Vesk**. Holds grudges and strikes fast.
    - **Scavenger Packs**: opportunist. Leader **Mother Rook**. Sends gifts, betrays when you look stretched, and pounces
      on a weakened rival.
    - **Iron Covenant**: new; patient builder. Leader **Marshal Kane**. Keeps deals, expands slowly, makes few but heavy
      assaults.
    - Its regions are **an open question**. The proposal is Vulture Ridge + Behemoth Spire (top row), so the three
      factions surround the player. Show it as a proposal.
  - **Minor factions (rebels)**:
    - **Generated** from archetypes: raiders, cultists, deserters. Names are composed (e.g. "Ash Brood", "Pale Choir").
    - At most **3 alive at once**.
    - Lifecycle: **camp → settlement → stronghold**, taking about 3.5 days if left alone.
    - A stronghold can **take a region**.
    - The player can clear them; majors can fight them too.
- **Faction bases**:
  - Each major has a **physical home base** on the map: a POI node in its home region, with a level badge. It can be
    scouted and attacked, but it is very hard.
  - **Bases are known landmarks visible through fog** (drawn faded inside fogged regions), so a march never comes "from
    nowhere".
  - Red Talon's base is in **Frost Hold** ("Red Talon Hold").
- **Visible marches**: AI scouts, supply columns, gather parties, raids and gift caravans move on the map like player
  marches, in faction colour. Hostile ones can be **intercepted**.
- **The "intelligence" signals**:
  - **Telegraphed intent** in stages: **Probe** (scouts watch the target) → **Massing** (a **war camp** forms at a staging
    point on the faction's own border, fed by a supply column from its base; the ring fills; the countdown runs to
    **departure**) → **March** (the warband travels from the camp to the target; intercept window) → **Battle** →
    **Aftermath**.
  - **Adaptation**: the AI targets weak regions, remembers whether you reinforce, and backs off after a beating.
  - **Personality** (tags, a voice line, letters in the leader's voice).
  - **Memory and relationships**: grudges, AI-vs-AI fights, opportunists reacting to a rival's weakness.
- **Each faction's brain** is utility AI, with a "**why**" line that shows the top reason for its current plan
  (e.g. "Weak walls · grudge · you were away").
- **Fairness rules**:
  - **One hostile countdown** on the player at a time.
  - **The outcome is locked when it is telegraphed.** What decides the result is what the player does, not dice.
  - A **calm period** follows each strike (12h after an assault).
  - **Strikes never land while the player is offline.** Plans ripen while you are away, and on return a strike gets a
    **fresh countdown of at least 45 minutes**.
  - Betrayal is rare and always **foreshadowed** (trust visibly slipping, plus a warning).
- **Region defense** (option 4, built in stages):
  - **Walls / fortification**: a baseline per region (e.g. "Walls level 3 ≈ 30% of your power"). Small raids bounce off.
  - **Telegraph + reinforce or intercept**: the main way to play.
    - **Reinforce** fights behind the walls (+30%).
    - **Intercept** meets the enemy on the road with no wall bonus.
  - **Garrison slots**: later stage (show as locked/"later").
  - Home Refuge can be **raided** for resources but **never captured**.
  - Losing a region drops its buff and **re-fogs the regions beyond it** (the cascade).
- **Diplomacy** (two-way, light):
  - The AI sends **gifts, truce offers, warnings, demands/ultimatums** through **Mail** (a new **Diplomacy** category).
    Each letter has an **expiry** and **Accept/Decline** (or Pay/Refuse), with the consequences shown up front.
  - The player can **send tribute**, **propose a truce**, or **request help against another faction**. Each has a cost
    and a cooldown. Hints like "Likely refused while Unfriendly" come from the same scoring.
- **Standing and trust**:
  - **Standing** runs from −100 to +100 in 5 bands: Hostile, Unfriendly, Neutral, Friendly, Allied. It is the **sum of
    named reasons, each with its own fade timer** (e.g. "−25 You took Red Lowlands · fades in 2d 4h"). Show this as a
    breakdown.
  - **Trust** is separate and slow-moving, shown as 5 pips. Betrayal reads trust.
  - **Friendship is never permanent.** It drifts back and can break.
- **Strength scaling**: AI difficulty reads the player's **power** (planned stat) and **player level**. It shows as
  "≈ 1.2× your power" and the power-levels bands (green ≥ 1.2, amber 0.9–1.2, red < 0.9).

### 4.1 Additions after Steve's review of prototype A (2026-10-09)

**Welcome Back buttons.** Today, offline gains are credited *before* the modal opens (`js/main.js` ~L513–570), and
"Collect & Continue" only closes it. So:

- **Neither button can lose rewards.** Say so in the modal: "Everything above is already in your stockpile."
- The fresh strike countdown (at least 45m) **starts when Welcome Back is closed**, by either button, so reading costs
  nothing.
- **Defend now** closes the modal, switches to World, centres on the threatened region, and opens its card with
  Reinforce/Intercept ready.
- **Continue** (the renamed "Collect & Continue") closes the modal and stays on the current view, usually Base. The
  threat stays visible everywhere: the banner, the Threats row in Marches, the pinned item in Events, the More dot, and a
  toast "Red Talon departs in 45:00 · Defend ›".

**Scout report** (new UI; it extends the existing `'scout'` march type, which today only targets ruins and outposts):

- **Targets:** faction bases, war camps, warbands and rebel camps. Dispatch it from the target's card ("Scout").
  A scout march goes out from Your Outpost.
- **Delivery:** the report arrives in **Mail → Reports** (an existing category) as a row that expands in place. It can
  also be opened from the target's card ("Last scouted 2h ago ›").
- **Scout tier (1–3)** comes from your scouting strength against the target's watch level (watchtower /
  counter-scouting). Higher tiers unlock more rows; locked rows show what tier would reveal them.
- **Report sections:**
  1. **Overview:** target and faction, base level, walls %, power vs your best squad (green/amber/red band),
     recommended power, and the **report age** ("scouted 2h ago, may be stale").
  2. **Heroes:** up to 3 commanders, with portrait, name and title from the real roster in
     `js/entities/data/heroes.js` (e.g. Marcus Kestrel "The Warlord", Kaelen Thorne "The Wastewalker"), level, stars and
     rarity. Skills show at tier 3.
  3. **Barracks / squads:** each squad's **front / mid / back** rows (the real combat model,
     `docs/10-design/combat.md`), with unit type + tier names from `js/entities/data/units.js` (e.g. Front: Knight T4;
     Mid: Lancer T3; Back: Ranger T4). Counts are banded ("~1.2k") at tier 1–2 and exact at tier 3. Show wounded too.
  4. **Garrison and defenses:** walls, towers and garrison stacks.
  5. **Tech** (tier 3): military research levels from `js/entities/data/tech.js` (e.g. Steel Armor, Advanced Tactics,
     Battle Formations, Cavalry Mastery).
  6. **Loot on hand:** what a successful raid would take.
  7. **Intent + counsel:** current plan + why; at tier 3, hidden agenda and betrayal risk (trust). Counsel uses the
     counters, e.g. "Cavalry-heavy front → lead with infantry", and "Your Squad 1: amber".
- **Failure:** a scout that gets caught still brings a partial report, and the target learns of it (−5 standing,
  "Scouted us").
- **Symmetry:** the AI's Probe stage *is* them scouting you. Show a small "What Red Talon learned about you" card (your
  wall level, whether you defended last time), which explains the AI's adaptation.

## 5. Agreed design: game events

Research: `docs/research/world-events-genre.md` (read "Summary" and "Recommendations").

- **One event model, four sources.** Every event shares the same parts: stages/timers, objectives, rewards, effects and
  an optional map anchor.
  1. **Faction** events: AI plans surface as events. Examples: a raid build-up or siege of your region (the hostile
     countdown), a faction asking for help against a rival, a gift caravan to escort, a rebel camp rising.
  2. **World** events: neutral things happen. Examples:
     - **Storm front**: marches through storm cells are slowed. Show the storm cells on the map.
     - **Herd migration**: temporary food nodes move across a region.
     - **Supply drop**: a crate lands. Whoever reaches it first gets it, and AI factions race for it too.
     - **World boss waking**: a countdown to the boss opening.
     - **Contamination spreading**: tainted cells creep across a region; clearing them earns rewards.
  3. **Calendar (liveops)**: scheduled themed events with an **objective points track and tiered rewards**. Examples:
     "Iron Week", "Raider Purge", "Harvest Rush". In single player there is no leaderboard. Use the **personal best**,
     plus a **"par" score set by an AI faction** (beating it moves standing).
     - The calendar is a **seeded weekly rotation** (deterministic; no server).
     - One **featured** event runs at a time for 5–7 days, followed by **2–3 quiet days** that are visible on the
       calendar.
  4. **Milestone** events: triggered by player progress (HQ 10, first ruin captured, a power threshold). They are
     one-shot story beats, e.g. "They have noticed you": all three warlords write to you.
- **Director** (pacing; RimWorld-style):
  - The **threat budget** comes from player power, with diminishing returns.
  - It runs in **cycles**: build-up → peak → calm.
  - A **failsafe** forces a threat (an event, such as a rebel raid) if the world has been quiet too long. This matters
    because peaceful players get almost no pressure from the majors.
  - **Limits**: at most **1 hostile countdown**, **1 featured calendar event**, and **at most 3 other visible events**.
    The rest queue.
  - The director decides *how much* pressure there is; the factions decide *what* to do with it.
- **Where events surface** (all existing places):
  - **Events view** (More → Events), reworked into tabs: **Active · Calendar · History**.
    - Active shows the pinned hostile countdown at the top, the featured event card with its points track and reward
      claims, then the other events with source tags.
    - Calendar shows this week and next, including quiet days.
    - History lists past events and results.
  - **Map markers** for anchored events (storm cells, herd route, supply drop, boss timer, contamination).
  - **Threat banner** under the top bar (only for the hostile countdown).
  - **Marches panel** rows.
  - **Mail** (event rewards in Rewards; faction letters in Diplomacy).
  - **Toasts** (top-right, like the existing "Construction Complete!" toasts).
  - A **red dot on the More FAB and on the Events tile** when something needs attention.
  - The **Welcome Back** report: offline summary lines grouped by source, with the threat first.
- **Rewards**: claiming moves rewards into the existing reward flow (toast + resource fly-in). Points come from normal
  play (gathering, killing camps, building, and so on).

## 6. What to build

Two prototypes plus a hub page. Each prototype tells **one story** in guided mode.

### A. `docs/10-design/mockups/ai-events/factions/index.html`: "Red Talon wants Red Lowlands back"

The guided story (about 14–18 steps; adjust as needed):

1. **Setting.** You took Red Lowlands yesterday. It is green, and Frost Hold is uncovered. Point out the **new faction
   base** "Red Talon Hold" in Frost Hold and the **faded Scavenger base through fog**.
2. Tap Red Talon Hold to open the **base panel** (leader, standing, current plan + why).
3. Open the **Factions panel** (More → new Factions tile): standing breakdown with fade timers, trust pips, personality
   tags, intel, diplomacy actions. Briefly compare the three factions.
4. **Probe.** Scouts leave the Hold, and a "being watched" marker appears over Red Lowlands. A yellow banner shows, and
   the Marches panel gets a hostile row.
5. **Massing.** A war camp forms on the Frost Hold border, fed by a supply column from the Hold. Red banner, countdown to
   departure.
6. Mail gets an **ultimatum** (Diplomacy category): Pay 25k iron or Refuse, with an expiry and the consequences shown.
7. Tap your **region** to see the new **Defense** block: walls level, what they stop, the incoming size, and a verdict
   ("walls alone won't hold").
8. **March.** The warband leaves the camp on a route to the region.
9. Tap the warband, choose **Intercept**: the dispatch sheet with a forecast (amber, ~55% win estimate, arrive 4:10
   before them).
10. Your squad marches out from the outpost toward the meeting point.
11. **Battle** result: Held. A short report; the full one goes to Mail → Reports.
12. **Aftermath.** New standing reasons (highlighted). Vesk writes "This isn't over". A calm period starts.
13. **AI reacting to AI**: the Scavengers notice Red Talon's weakness and send a **truce offer** with an expiry.
14. **Alternate path**: what happens if nobody defends. The region is **lost**, the cascade re-fogs Frost Hold, and Vesk
    writes "Red Lowlands is ours again".
15. **Offline rule**: the Welcome Back report shows the strike held for your return, a 45m countdown, and "Defend now".
16. **Rebels**: a rebel camp (Ash Brood) and its camp → settlement → stronghold growth, with the cap of 3 shown.

### B. `docs/10-design/mockups/ai-events/events/index.html`: "A week in the wasteland"

A guided story that covers **all four sources, the director, and every surface** (about 14–18 steps):

1. The **reworked Events view** (More → Events): Active · Calendar · History tabs. Contrast it with today's empty state
   (show the old screenshot briefly).
2. **Calendar event**: the featured "Iron Week". Explain the points track, tiered rewards, the personal best, and the
   **Red Talon par** marker. Show **where points come from** (a toast "+120 Iron Week pts" after gathering).
3. **Claiming** a tier reward: claim button → toast/fly-in → the track updates.
4. The **Calendar tab**: this week and next, quiet days, and the seeded rotation explained in one line.
5. **World event, storm front**: storm cells drawn on the map, a march slowed ("+40% travel time through the storm"), a
   banner or toast, and its row in Active.
6. **World event, herd migration**: temporary food nodes moving along a route across a region, a countdown, and gathering
   them.
7. **World event, supply drop**: a crate lands. A race starts with an AI gather party (Scavengers) also heading for it.
   You win or lose the race.
8. **World event, boss waking**: a countdown marker at the boss region.
9. **Faction event**: a rebel camp rising, shown as an event with objectives ("Clear before stronghold"). Link to the
   map.
10. **Faction event**: a hostile countdown pinned at the top of Active and mirrored in the banner. Only one at a time.
    Show briefly how a second threat **queues** ("director limit").
11. **Milestone event**: HQ 10 is reached. "They have noticed you": three letters arrive in Mail → Diplomacy, and the
    milestone tracks letters read.
12. **Director**: an explanation step showing a simple pacing strip (build-up → peak → calm) and the limits (1 hostile ·
    1 featured · 3 others). Show the **failsafe** for a peaceful player: a rebel raid is forced after a quiet stretch.
13. **Notifications**: the More FAB dot, the Events tile dot, toasts. Show that they clear once seen.
14. **History tab**: past events with results (completed, missed, rewards earned).
15. **Welcome Back**: the offline summary grouped by source, with the threat first.

### C. `docs/10-design/mockups/ai-events/index.html`: the hub page

The **orchestrator builds this** (not you). It links A and B, with a short description of each and a thumbnail.

## 7. Style and interaction rules

- Match the screenshots: dark warm surfaces, an orange primary, Oswald headings, Outfit body, the Orbitron-like display
  titles on panels, and the same faction colours.
- Show existing panels **as they are**, then add the new parts with the NEW treatment.
- Captions sit in a fixed **caption card** outside the game frame, or docked at the bottom of the viewport, so they never
  cover the thing being explained. The spotlight points into the frame.
- Map overlays: draw in an SVG layer over the screenshot. Use the same node style as the real POIs (round node, icon,
  diamond level badge in the owner's colour) for new map entities, and make them **slightly larger, with a label**, so
  they read as important.
- Routes:
  - Hostile: red dashed with an arrowhead.
  - Player: green dashed (the real player march line looks dashed and pale; green is fine for clarity).
  - Scouts: yellow dotted.
  - AI gather parties and other non-hostile AI: faction colour, dotted.
- Timers can be static text, or tick down for life. Keep the motion subtle.
- Guided steps must be **deterministic**. Going Back restores the earlier state exactly. Build each step as a function
  of the step index, not as an accumulation of clicks.

## 8. Scope limits

- Don't build the hub page, and don't touch the other prototype.
- Don't edit anything outside your prototype folder, except the screenshots you take while verifying. Put those in
  `<your folder>/_verify/`.
- Don't commit. Steve commits.

## 9. How to verify (Playwright on this machine)

- Playwright lives outside the repo. Load it with
  `createRequire('C:\\Users\\Steve\\AppData\\Local\\Temp\\claude\\basie-verify\\noop.js')('playwright')`.
- Launch with `chromium.launch({ executablePath: 'C:/Users/Steve/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe' })`.
  The default headless shell fails to spawn here.
- Run the script with the Bash tool's **sandbox disabled** (`dangerouslyDisableSandbox: true`), or the browser can't
  launch.
- Open your prototype with `file:///D:/Projects/Basie/docs/10-design/mockups/ai-events/<folder>/index.html`. No server
  is needed, which also proves it is self-contained.
- Collect `page.on('pageerror')` and console errors. Viewport 1280×900 or larger, so the frame and caption fit.
- Step through every guided step (press Next) and save `_verify/step-NN.png` for each. Also test Explore mode clicks on
  the key elements.
- **Look at your screenshots** with the Read tool and fix issues. Repeat until clean.
- Do not use the Playwright MCP browser tools. Another agent may be using them at the same time.

## 10. Report back

- The path of your `index.html`.
- The step list, as a one-line title per step.
- The verification screenshot folder.
- Anything you couldn't do or had to decide yourself (design decisions made while building). These matter because they
  feed the spec.
