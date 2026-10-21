# World events research (mobile 4X / storyteller systems / single-player liveops)

Research input for a unified Basie game-event model (faction, world, calendar, milestone sources).
Written 2026-10-09. This is not a design lock. A decision taken from it should go into an ADR.

## Read this first: how much is actually confirmed

Search coverage was thin and uneven. **No developer-published event schedule or director spec was
found for Last Shelter, State of Survival, Whiteout Survival, Rise of Kingdoms or Lords Mobile.**
Searches for those games returned mostly SEO calendar pages (several scrambled, some about *other*
games like Last War / Last Z, which were discarded). The best-sourced material is the **RimWorld
wiki** (code-derived numbers). GDC Vault pages (Booth's L4D Director talk, "Effective LiveOps")
could not be read (members-only or not surfaced). Treat every genre number as a hypothesis.

Confidence labels:
**[official]** developer or in-game text. **[datamine/wiki]** community wiki or code analysis.
**[community]** guide site, forum or search excerpt; may be wrong. **[not found]** searched,
nothing usable. **[reasoning]** my inference, not from a source.

## Summary: what matters most for Basie

1. **Mobile 4X event hubs are a recurring weekly/biweekly rotation of a small set of event
   *templates*, re-skinned by theme.** State of Survival: weekly calendar Sunday to Saturday, with a
   calendar extendable to next week, and some events not on the calendar at all (only in a
   "recommended" section) [community, AppGamer]. Whiteout: Hall of Heroes weekly Sun-Tue, Fishing
   Tournament monthly, Foundry Battle bi-weekly 60 min [community]. RoK Mightiest Governor: ~6 days,
   every ~2 weeks, featured commander rotates and repeats 4 times [datamine/wiki, ambiguous].
   Basie should author ~8 templates and rotate them, not 40 bespoke events.
2. **Reward structure = point thresholds (milestone track) + rank rewards.** RoK Mightiest Governor
   awards by rank (180 down to 1 for places 46-50) with points from stage tasks (troop training by
   tier, barbarian kills by level) [wiki]. Single-player has no rank: **keep the threshold track,
   drop the leaderboard**, or replace rank with "beat your own best" or an AI-faction par score.
3. **Multi-stage events are the genre's pacing tool.** Mightiest Governor has stages (Troops
   Training, then Defeating Barbarians) [wiki]; Last Shelter Doomsday Conquest is ~8 weeks with
   tainted plots spreading on the map, claimable only when adjacent to owned plots [community,
   AppGamer] - which is exactly the "spreading contaminated zone" world event. Stage = {timer,
   objective set, reward}; the whole event is a list of stages.
4. **Defense events cost the player something soft, not permanent.** Last Shelter Zombie Siege:
   available every few days, open about a day, won per wave by killing >=50% of the horde; base
   takes damage (set on fire 30 min) but **no troop loss** [community]. Whiteout Foundry Battle
   auto-heals troops after [community]. Lesson: hostile events should threaten timers/resources/
   buildings, rarely permanent unit death. This also fits offline return.
5. **RimWorld's threat budget is the best-documented director formula.** Raid points = (wealth
   points + pawn points) x difficulty x starting factor x adaptation factor, capped at 10,000,
   minimum 35 [wiki]. Wealth points interpolate 0 -> 0 at 14k, 2,400 at 400k, 3,600 at 700k,
   4,200 at 1M. Details in section 3. Direct analogue for Basie: **power (not wealth) drives a
   points budget; each hostile event buys threats from the budget.**
6. **Pacing = cycles, not dice.** RimWorld storytellers differ mainly in an on/off *cycle*: Phoebe
   8 days on / 8 off with exactly one major threat per on phase (8 to 24 days between majors);
   Cassandra has a ~4.6 day on phase with 1 or 2 majors and >=1.9 days between; Randy has no cycle
   but a 13-day failsafe forcing a major threat [wiki]. Streaks of bad luck are prevented by phase
   structure and a forced-event fallback, not by luck correction. L4D: build-up / peak / relax
   with contrast as the goal [community, secondary quotes only].
7. **Adaptation is a slow-moving difficulty knob driven by player success.** RimWorld AdaptDays
   rise slowly (every 12h, diminishing) and **drop on colonist deaths/downings**; factor ranges
   0.4 (AdaptDays -30) to 1.47-2.0 [wiki]. Basie equivalent: raid strength follows a smoothed
   "recent performance" value, so a player who lost a region gets an easier next raid.
8. **Single-player calendar events work off the device clock; accept the cheat.** Real examples:
   NimbleBit seeds a daily event from the device clock (bugs when the clock moves) [community,
   support page]; Spryfox gates by weekday, past days close at midnight [community]; Godot dev
   quote: using the local clock is "not that big of a deal for single player" [community]. Defend
   only against *backward* jumps (monotonic last-seen timestamp); forward jumps are undetectable
   offline [community, Unity forum]. Seed from hash(date + salt), store UTC.
9. **Event fatigue is about obligation, not volume.** Complaints target back-to-back limited-time
   events with no downtime and FOMO, and repetitive structure under new themes [community, Gamota,
   Ilogos]. Concurrent-event/push-opt-out thresholds in vendor pages (3+ concurrent) are
   *hypotheses to test*, not measured findings [community]. Single-player advantage: no FOMO
   needed, so make events **expire gracefully and be completable offline**.
10. **No public data-model standard exists.** Nothing found on trigger/weight/cooldown schemas
    beyond RimWorld's wiki-visible concepts. Space Ape's GDC Europe 2016 talk is the known
    precedent for designer-authored weekly events with little dev involvement [community
    excerpt]; the content was not readable. The model in section 6 is synthesised, not sourced.

---

## 1. Mobile 4X / survival event catalogue

### What was actually found

| Game | Event / feature | Facts | Confidence |
|---|---|---|---|
| State of Survival | Events calendar ("Billboard") | Weekly, Sunday to Saturday; can extend to next week; some events only listed in a Recommended section | [community] |
| State of Survival | Arms Race / Zombie Siege / Hunting Trip / Mutant Rampage | Day-by-day timing **[not found]** | [not found] |
| Last Shelter | Zombie Siege | Alliance event, every few days, open ~1 day, started manually by a member, win each wave by killing >=50% of horde, base burns 30 min, no troop loss | [community, AppGamer] |
| Last Shelter | Doomsday Conquest | ~8 weeks; tainted resource plots on world map; claim only adjacent to owned plots or alliance structure | [community, AppGamer] |
| Last Shelter | Hourly challenges, Clash of Zones, Doomsday | Named in a general list, no detail | [community] |
| Last Shelter | Walking Dead collab | Limited-time collab (2023) with a "Drive & Survive" mini-event | [community] |
| Whiteout Survival | Foundry Battle | Bi-weekly, 60 min, alliance PvP over buildings, troops auto-healed after | [community, wostools.net] |
| Whiteout Survival | Hall of Heroes | Weekly Sun-Tue | [community, low-quality calendars] |
| Whiteout Survival | Fishing Tournament | Monthly, seasonal theme | [community, low-quality] |
| Whiteout Survival | Armament Competition / Officer Project | Alternate in a 2-week cycle around a state-vs-state event | [community, low-quality] |
| Whiteout Survival | Canyon Clash | 3 alliances fight for a citadel; timing unknown | [community] |
| Rise of Kingdoms | Mightiest Governor | ~6 days, ~every 2 weeks (ambiguous "8-day break"); 2 stages; featured legendary commander repeats 4 times then rotates; rank rewards 180 down to 1 | [wiki] |
| Rise of Kingdoms | Ark of Osiris | Registration starts Wednesday, lasts 3 days; min 15 participants; up to 3 teams per alliance; match 30 min | [wiki / patch notes] |
| Rise of Kingdoms | Mysterious Merchant, Eternal Night, Lost Kingdom cadence | **[not found]** | [not found] |
| Lords Mobile | Event calendar | No usable schedule; weekly "Lords Fest Live" show; dated collabs (e.g. a 29-day collab window) | [community] |
| Space Ape (GDC Europe 2016) | Live ops tooling | Designers/PMs ship new content and event types weekly with little dev support | [community excerpt] |

### Cross-game patterns (synthesis, mostly [reasoning] over the thin sources)

- **Four recurring event archetypes appear everywhere:** (a) *gathering/production sprints*
  (points for resources gathered or spent), (b) *combat sprints* (kill N of tier X; barbarians,
  zombies, monsters), (c) *build/research/train sprints* (points for upgrade time, training), (d)
  *big set-piece* (siege/defense, capital or fortress battle, spreading zone). Mightiest Governor
  and Arms Race-style events are literally a rotation of (b)+(c) objectives.
- **Durations cluster:** minutes-hours (Foundry 60 min, Ark match 30 min), ~1 day (Zombie Siege
  window), ~6 days (Mightiest Governor), weekly, ~8 weeks (Doomsday Conquest, season-like).
- **Surfacing:** a calendar/billboard tab with a "recommended" section, plus alliance-only entry
  points. Map markers are used for world-state events (Doomsday plots).
- **Hostile events are scheduled and opt-in or alliance-triggered** in live games. Basie has no
  alliance to trigger them; the AI factions and a director must play that role.

## 2. Storyteller and director systems

### RimWorld storytellers [datamine/wiki, code-derived]

- **Phoebe Chillax:** 16-day loop, cycle begins day 13 in the 8-day "On" phase; exactly one major
  threat per on phase; 8 to 24 days between majors; never two raids in quick succession.
- **Cassandra Classic:** "On" phase ~4.6 days, 50/50 chance of 1 or 2 major threats, >=1.9 days
  between majors, cycle begins day 11. One wiki summary says a 10.6-day total cycle (the wiki
  pages disagree in my excerpts; verify before using the numbers).
- **Randy Random:** no cycle; if no major threat for 13 days, the next fired event becomes one.
  Multiplies raid points by 0.5x-1.5x randomly. Hardest on average.
- The wiki warns Phoebe's long quiet gaps make players overestimate their defences, so rare
  threats can spike surprisingly - **long quiet is not automatically good pacing.**

### RimWorld threat budget [wiki, code-derived; one page flags itself possibly outdated]

```
RaidPoints = (WealthPoints + PawnPoints) x Difficulty x StartingFactor x AdaptionFactor
cap 10,000 (before post-cap modifiers), minimum 35
StorytellerWealth = items + creatures + 0.5 x buildings
WealthPoints: 0 below 14k; 2,400 @ 400k; 3,600 @ 700k; 4,200 @ 1M (linear between)
PawnPoints per colonist: 15 up to 10k wealth; 140 @ 400k; 200 @ 1M
   (15 + (wealth - 10,000) / 3,120 between 10k and 400k)
Difficulty scale: Peaceful 0.10, Community builder 0.30, Adventure 0.60, Strive 1.00,
   Blood&dust 1.55, Losing is fun 2.20
StartingFactor: 0.7 at day <=10, 1.0 at day >=40
AdaptionFactor: 0.8 at AdaptDays 0; -30 -> 0.4; 30 -> 1.0; 60 -> 1.2; 120 -> 1.6; 180 -> 2.0
   (AdaptDays range -60..100, +per 12h diminishing, deaths subtract ~20-30, downings ~3.5-8)
Randy: x0.5..1.5 after cap. Quest threats: x quest stars, then x0.7..1.3.
Wealth-independent mode: wealth derived from days: 0->10k, 180->180k, 720->1M.
```

A separate 2016 forum formula (~11 threat points per 1,000 wealth above 2,000) is **superseded**
[community]. The design lessons that transfer: (1) threat points are a *single scalar budget*
spent on concrete raid compositions, (2) a pre-cap diminishing curve (wealth points flatten at
4,200), (3) a hard cap, (4) a minimum floor, (5) a ramp-in factor for the early game, (6) an
adaptation factor that falls when the player is hurt, (7) a difficulty multiplier, (8) a
"wealth independent" fallback keyed off time.

### Left 4 Dead AI Director [community, secondary; primary talk not read]

- Cycle described as Relax -> Build Up -> Peak -> Relax; designers describe the goal as
  *contrast* ("you can't appreciate the action unless you have quiet") [Evolve designers via
  Shacknews/Game Informer].
- Director tracks per-player stress; one guide claims four inputs (damage taken, incapacitations,
  separation, time since last encounter) and "30+ variables" - **uncited, treat as unverified**.
- Valve's wiki confirms the Director is almost fully automated and level designers can read its
  "anger level" via `logic_director_query` [official dev wiki].
- Transfer: a Basie "tension" scalar (recent losses, time since last hostile event, unclaimed
  threats on the map) that lowers hostile event weights when high and raises them when low.

### Scripted waves (They Are Billions, Frostpunk) [community only]

- No developer postmortem found. Forum evidence: a single bugged value (1 instead of 16) in a
  final wave shipped in a patch; players complained mid-game lacked tension then the last wave
  was decisive; an early mission with a late-game final wave distorted the curve.
- Lesson: scripted waves need **a named budget tied to the stage** and tests asserting wave size
  against the budget, and "decisive final wave" designs frustrate. For Basie's recurring
  events this argues for generated-from-budget, not hand-tuned one-offs.
- Into the Breach: no usable source found [not found]. (Known design idea, from memory not from
  a source: telegraphed threats before they land - matches Basie's "countdown after return".)

## 3. Applying the budget idea to Basie

Basie already has (or is designing) a power stat. Proposed analogue of RimWorld's formula
[reasoning]:

```
ThreatPoints = f(playerPower) x difficulty x rampIn x adaptation
f(power)   = piecewise-linear table, flattening at high power (data, appended per era)
rampIn     = 0.7 for the first N hours / HQ <= X, then 1.0
adaptation = smoothed score; falls on lost region / wounded-heavy fight, rises on clean wins
cap        = per-era cap from data; floor = minimum viable threat
```

Each hostile event template has a **cost per unit of strength** and spends `ThreatPoints x
eventShare` (siege share higher than a scouting party). Hero-assignment and garrison strength in
the targeted region should be read when the raid *lands*, not when scheduled, so a countdown
gives the player time to respond.

## 4. Event data models

Nothing public was found. The model below is synthesised from RimWorld's wiki-visible concepts
(storyteller cycles, incident weights, failsafe, cooldown) and standard liveops practice [reasoning].
Fields proposed in section 8.

Key design points from the evidence:
- **Cycles over rolls** (RimWorld) for the hostile layer; **weighted selection with cooldowns**
  for flavour events.
- **Failsafe**: Randy's 13-day forced major threat is a "max gap" rule; use both a min gap and a
  max gap per class of event.
- **Content hot-swapped by data** (Space Ape): new templates and rotations should be data-file
  appends, consistent with Basie's "Built to extend" rule.

## 5. Single-player liveops without servers

- **Calendar from local clock, deterministic by date.** Seed = hash(UTC date + salt). Same date
  gives same rotation on any device. Example precedent: NimbleBit daily event city seeded from the
  device clock, with known stuck-seed bugs when the clock is changed [community].
- **Clock hygiene** [community, Unity forum / bugnet]: store UTC, convert only for display, choose
  one reset timezone, keep `lastSeenTimestamp` and treat a backward jump as tampering, put the
  clock behind an interface so tests can fast-forward (matches Basie's test harness approach).
  Forward jumps cannot be detected offline; accept it, as Godot daily-reward authors do.
- **Missed events.** Spryfox closes past days at midnight (no banking) [community]; my suggestion
  [reasoning] is the opposite for Basie: a capped catch-up ("while you were away") that settles
  completed objectives and lets partially progressed events resolve, because there is no
  leaderboard to protect.
- **Offline simulation.** Resolve beneficial/neutral events fully with a cap; schedule hostile
  events as **landing countdowns after return** (agreed design). Cap total hostile arrivals on
  return to 1 (maybe 2 at high level) and delay them by a grace window.
- **Calendar content beyond rotation.** Dated one-off seasonal themes (like Lords Mobile
  collabs) can ship as data files with `startDate`/`endDate` and no code change.

## 6. Fatigue and pacing

Evidence is mostly opinion and vendor copy [community].

- Event saturation is the norm: top casual games run 10+ event surfaces per session; at least one
  new liveops event per month is standard. More is not better: tipping point where events become
  noise (AppSamurai); 78% of top 1,000 liveops games lost revenue H1 2024 to H1 2025 (Sensor
  Tower via Ilogos) - correlation only.
- Fatigue shows as *obligation*: back-to-back limited events, no downtime, FOMO. Players are
  "tired, not bored" (Gamota). Repetitive structure under new themes is noticed (Ilogos).
- Hypotheses worth testing (Bruin, vendor): 3+ concurrent liveops events correlate with push
  opt-out spikes; 3+ consecutive weekly events lower engagement on the next. Unmeasured.
- Practical rules cited: avoid stacking reset times; vary mechanics, not just theme; build rest
  weeks.
- Basie advantage: no FOMO monetisation, so rest weeks and generous expiry are free.

## 7. Gaps worth closing later

- Real per-day schedules for Last Shelter / State of Survival / Whiteout (in-game calendar or
  community wikis; the search tool returned only low-quality pages).
- L4D Director primary source (Booth GDC talk, Valve wiki "Info director").
- Verify the Cassandra cycle numbers (the two wiki summaries disagree) if a Cassandra-style cycle
  is copied directly.
- Any public postmortem on Into the Breach / Frostpunk event pacing.
- GDC "Effective LiveOps" and Plarium's "monthly Live Ops meta-loops" content.

---

## 8. Recommendations for Basie

### 8.1 Event model (data fields)

```
EventDef {
  id, title, source: 'faction'|'world'|'calendar'|'milestone', tags[],
  trigger:   { kind: 'schedule'|'director'|'condition'|'chain', ... },
  preconditions: [{ hqMin, powerMin, levelMin, flagsAll[], flagsNone[], regionState }],
  weight, cooldownSec, maxPerPlayerLifetime, maxConcurrentOfTemplate,
  exclusionGroup,            // only one active per group (e.g. "siege", "weather")
  threatCost,                // 0 for non-hostile; spent from director budget
  stages: [{ id, durationSec, objectives[], rewardTier[], onEnterEffects[], onExitEffects[] }],
  effects: [{ kind: 'prodMult'|'marchSpeedMult'|'spawnPoi'|'spreadZone'|..., value, scope }],
  mapAnchor?: { type: 'region'|'poi'|'edge', selector },
  surfacing: { banner, calendarVisible, mapMarker, mail, notify: 'none'|'toast'|'mail' },
  offline:   { policy: 'settle'|'pause'|'expire'|'countdownOnReturn', graceSec }
}
```

Runtime state per active event: `{eventId, stageIndex, stageEndsAt, progress{}, claimed[], anchor}`
as one serializable list; ids are save keys (never rename). Objectives reuse existing Quest/
Challenge objective types where possible. Effects are timed buffs on the existing buff system.

### 8.2 Starting catalogue (14 events)

Faction-driven (3 hostile, 1 cooperative):
1. **Raid build-up** - faction masses; 2 stages: scouts sighted (warning, 6-24 h), assault lands
   on a player region (countdown). Cost from budget.
2. **Siege of a region** - multi-stage, hold N waves; losses are timers/buildings, not permanent
   unit death (Zombie Siege precedent).
3. **Faction asks for help** vs rival - accept = objective track, reward standing; ignore = quiet
   fade, small penalty.
4. **Gift caravan to escort** - march event, optional, reward.

World-driven:
5. **Storm front** - marchSpeedMult 0.7 for 6-12 h over an area (map-anchored).
6. **Migrating herd** - temporary food POIs.
7. **Supply drop** - one-off loot POI with despawn timer.
8. **Contaminated zone spreads** - Doomsday Conquest analogue; stage per ring; cleanse by
   capturing adjacent plots.
9. **World boss stirs** - boss opens on a clock (matches existing boss clock rule).

Calendar:
10. **Iron Week** - 7-day, production sprint, 5-tier threshold track.
11. **Raider Purge** - 5-day combat sprint, kill-point thresholds, par score instead of rank.
12. **Builder's Rush / Training Surge** - upgrade-time or training points, threshold track.

Milestone:
13. **HQ 10 - A faction takes notice** - one-shot story event, unlocks diplomacy/raid pressure.
14. **First ruin captured** - story beat, unlocks a calendar slot or faction reaction.
(Optional 15: power threshold - rival faction retunes its aggression.)

### 8.3 Cadence numbers [PLACEHOLDER, all untested]

- Calendar: **one featured calendar event at a time**, 5-7 days, then 2-3 days quiet; a
  minor 1-day daily objective set between. Monthly one 2-3 week "season" arc (Doomsday-like).
  Rotation index = floor(daysSinceEpoch / 7) mod templateCount, seeded theme from date hash.
- Hostile (director): modelled on Phoebe/Cassandra - alternating cycles, **one major threat per
  on phase, 2-4 day minimum gap, 7-10 day maximum gap** (failsafe), scaled by tension.
- World: 1 ambient world event per 12-24 h of play, weighted, 4-12 h durations.
- Milestones: fire once per condition, never gated by cooldown, but queue so only one story
  popup per session.

### 8.4 Concurrency limits [PLACEHOLDER]

- Max **3 visible active events** total; max 1 hostile countdown on the player at a time (2 above
  a late-era threshold); max 1 featured calendar event; exclusion groups for siege, weather.
- Offline return: settle at most 1 hostile landing, with >= 5 min grace after the first load.
- Never start two stages with the same end minute; add jitter to `stageEndsAt`.

### 8.5 Director and budget

- Inputs: player **power** (from the planned power stat), player level, HQ level, recent
  adaptation score, tension scalar (time since last hostile, unresolved threats, unspent
  catch-up).
- `ThreatPoints = powerCurve(power) x difficulty x rampIn x adaptation` with per-era caps and
  floors, all in data (see section 3). Hostile templates get a share of the budget.
- Cycle state machine per faction: Quiet -> Build-up -> Strike -> Aftermath, driven by the
  existing utility-AI faction brains; the director only *grants budget and permission*, factions
  choose targets. This keeps ownership event-driven (ADR 0001).
- Anti-streak: after a lost region or heavy wounded count, adaptation drops and the next on-phase
  is delayed (RimWorld: deaths subtract AdaptDays).
- Deterministic: seed with (saveSeed, cycleIndex) so tests can pin outcomes; fixture-guard test
  with a synthetic extra era to prove no hard-coded bounds.

### 8.6 UI surfaces

- **Events hub tab** (calendar strip of the week + active list + "recommended"), reachable from
  the More grid; reuse Mail hub patterns for history.
- **Banner** on the topbar for the single most urgent event (hostile countdown beats calendar).
- **Map markers/anchors** for map-anchored events (storm area, herd POI, drop, zone rings).
- **Mail** for faction messages and results; **toast** only for hostile warnings and completions.
- Threshold track panel inside each calendar event (no leaderboard; show "par" or personal best).
- Returning-player summary sheet: what resolved offline, what lands next with its countdown.

## Sources

- RimWorld Wiki: Raid points, Wealth, Wealth management, Phoebe Chillax, Cassandra Classic,
  Randy Random (rimworldwiki.com) [datamine/wiki]
- AppGamer: How events work in State of Survival; Last Shelter Doomsday Conquest and Zombie
  Siege defense guides [community]
- wostools.net Foundry Battle; assorted Whiteout calendar pages (low quality) [community]
- Rise of Kingdoms Fandom wiki: Events/The Mightiest Governor; riseofkingdomsguides.com patch
  notes 1.0.42, 1.0.80 [wiki/community]
- Shacknews: How Evolve learned from Left 4 Dead's AI director; Valve Developer Wiki Info
  director; Game Developer Q&A with Valve's Swift [secondary/official dev wiki]
- Steam community / Quarter to Three threads on They Are Billions [community]
- GDC Vault: Effective LiveOps (gdcvault.com/play/1021947); GDC Europe 2016 Space Ape talk;
  IQPC Plarium talk listing [titles only, content not read]
- NimbleBit and Spryfox support pages; Unity and Godot forum threads; bugnet.io clock guides
  [community]
- Gamota, Ilogos, AppSamurai, Bruin, PocketGamer.biz liveops articles [community/opinion]
