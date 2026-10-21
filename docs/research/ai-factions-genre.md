# AI faction research (strategy games, 4X, mobile base builders)

Research input for Basie's three AI factions: standing, diplomacy, utility brain, telegraphed plans,
offline behaviour. Written 2026-10-09. This is not a design lock. A decision taken from it should go
into an ADR.

## Read this first: how much is actually confirmed

Several wikis returned 402/429 to direct fetches (Civ fandom, totalwar.com). The Stellaris and CK3
Paradox wikis were readable, so Paradox numbers are the strongest in this file. **No developer
published exact decay or threshold tables for Civ, Total War or any mobile 4X game.** The best design
evidence is developer essays and talks (Soren Johnson, Sid Meier, Bungie, Valve), which describe
principles, not numbers. Several items below are marked "from memory": the researcher knows them
but could not re-verify them this session.

Confidence labels:
**[official]** developer text, talk, patch note or in-game text. **[datamine/wiki]** community wiki
or game files. **[community]** guide site, forum or search excerpt; may be wrong. **[memory]** known
to the researcher, not re-verified this session. **[not found]** searched, nothing usable.

## Summary: what matters most for Basie

1. **Perception beats intelligence.** Sid Meier: players see a fairly clever AI as dumb and a very
   clever AI as cheating [official, GDC 2010 coverage]. Soren Johnson: "perception becomes reality,
   so transparency is the antidote to suspicion" [official, essay]. Bungie's Halo talk was literally
   titled "The Illusion of Intelligence" and built AI around the player being impressed by reactions,
   not hidden cleverness [official, slides]. So spend effort on what the player sees (warnings,
   reasons, voice lines), not on deeper search.
2. **Standing is always a sum of named, signed modifiers, each with its own decay or expiry, shown
   in a breakdown tooltip.** Civ IV (mouse-over "+X" factors) [community], Total War (attitude
   tooltip of reasons) [datamine/wiki], Stellaris (opinion list) [datamine/wiki], CK3 (opinion
   breakdown) [datamine/wiki]. A single hidden number is the documented failure mode.
3. **Two numbers, not one.** Stellaris keeps *opinion* (fast, event-driven, decays) separate from
   *trust* (slow, grows only while agreements run, capped at 50 by default, decays -0.25/mo when
   idle, -2/mo while rivals or at war) [datamine/wiki]. Total War keeps *attitude* separate from
   *reliability* (do you keep deals) [datamine/wiki]. Basie's "friendship is not permanent" idea fits
   this split: standing drifts, trust is earned slowly and is what betrayal spends.
4. **Decay rates are slow and per-modifier.** CK3: "Broke truce" -50 for 3 years, "Attacked an ally"
   -25 for 3 years, tyranny decays 0.25/month [datamine/wiki]. Stellaris: envoy relations decay 1/month
   back to 0, breaking a defensive pact -100 decaying [datamine/wiki]. Civ VI grievances "diminishing
   currency", reportedly about -1/turn at peace [community]. Order of magnitude: a big betrayal
   takes on the order of 20-40 game-hours-equivalent decision cycles to fade.
5. **Telegraphing turns punishment into a puzzle.** Into the Breach shows every enemy attack one turn
   ahead and Subset found it also shortened battles [official/wiki]. They Are Billions shows the day
   of the next horde [community]. XCOM 2's Avatar doom clock starts a ~20-day countdown only once
   the bar fills, and the player can act to reset it [community]. Frostpunk warns of the Great Storm
   via refugees well before it hits [community].
6. **Mobile 4X NPC pressure is scheduled, opt-in-ish and capped, never a surprise while offline.**
   Whiteout Survival's Crazy Joe: 20 waves in ~40 min at known times; resources are never lost,
   only troops; some waves hit online players only; breached twice and you stop being attacked
   [community]. Last Shelter's Zombie Siege: alliance-started, no troop losses, base "on fire" for
   30 min [community]. Rise of Kingdoms barbarian forts never attack you [community]. Shields:
   Last Shelter starter shield ~7 days or level 6 [community]; Clash of Clans auto-shield 12/14/16 h
   after 30/60/90% destruction [community]. **Basie's "hostile strikes land only with a countdown
   after return" matches the genre's protection norm.**
7. **Scale to the player's state, not to wall-clock, and cap it.** RimWorld raid points come from
   colony wealth (items full, buildings half) plus colonist count, capped at 4,200 above 1M wealth,
   0.7x before day 10, plus an "adaptation" factor that eases after colonist deaths (0.4-1.4 range)
   [datamine/wiki]. Diminishing returns at the top is the important shape.
8. **Ganging-up on the leader is the classic perceived-cheat.** Original Civ hard-coded war on the
   human leading by 1900 AD; Civ III's AI-to-AI tech trading looked like a cartel; Civ IV restricted
   AI-to-AI trade to stop the perception [official, Johnson essay]. Basie's "player grows too strong"
   betrayal trigger is exactly this risk and needs foreshadowing and in-character justification.
9. **Utility AI: multiply normalized considerations through response curves, compensate for count,
   add an inertia bonus to the current plan.** IAUS multiplies consideration scores, normalizes
   inputs to [min,max], adds an inertia bonus to the running behaviour to stop flip-flopping
   [datamine/wiki, ProjectBorealis IAUS wiki]. Dave Mark's compensation factor counters the
   "nine considerations at 0.9 = 0.387" shrink [official via tool docs].

---

## 1. How games make AI feel intelligent and legible

### Design principles from developers
- **Meier (GDC 2010 keynote coverage)** [official]: AI is "a feedback mechanism against which players
  can measure their progress", not a virtual human. Players blame fate, RNG or "crappy AI" when they
  lose. Civ Revolution stored dice rolls in saves to stop reload abuse.
- **Johnson, "Our Cheatin' Hearts" (2009)** [official]: fairness is psychology, not math. Acceptable
  AI advantages are explicit (Mario Kart items, Catan robber), available to the human too, small and
  incremental. An AI that slowly out-builds you to a Wonder is fine; one *granted* it instantly is
  not. Puzzle Quest: free AI cascades ~2% of the time read as cheating because players couldn't see
  why. Recommendation: if you must cheat, cheat for the player.
- **Johnson, GDC 2022 (via PC Gamer)** [official, secondhand]: players say they want human-like AI but
  actually want AI that behaves in line with its *fictional role*, not as an optimizer.
- **Bungie, "The Illusion of Intelligence" (GDC 2002)** [official, slides]: design goals "Impressed"
  (react to the player: surprise, anger, awe), "Fooled" (limited knowledge, predictable reactions),
  "Thwarted" (breaking point then flee/berserk/retreat). Randomness was explicitly *discarded*.
  The "AI got smarter when grunts had more HP" anecdote is widely repeated but **[not found]** in a
  primary source.
- **Monolith, "Helping Players Hate (or Love) Their Nemesis" (GDC 2018)** [official, abstract only]:
  named enemies with traits and memory of the player create single-player rivalry; mechanics of the
  grudge system **[not found]**.
- **Valve L4D Director** [official, Booth interview]: when things are quiet it plans attacks; after
  long heavy fighting it lets things settle. "Build up, peak, relax" wording and 0-1 stress numbers
  are **[community, unverified]**.

### Personality as data
- **Civ V** leaders carry 0-10 "flavor" scales incl. War, Hostile, Deceptive, Guarded, Afraid,
  Friendly, Neutral approaches [community]. The displayed attitude can hide intent: civs planning war
  "still hide their opinion"; allied friendly AIs reveal "deceptive / planning war" via Share Opinion
  [official, patch notes]. Players read stronger players as "guarded/afraid", weaker as "friendly until
  an opening" [community].
- **Civ VI** two agendas per leader: one historical and public, one hidden and revealed through
  "gossip" / diplomatic access level (delegations, trade routes, alliances, Printing tech, spies)
  [community]. Agendas punish both doing too much and too little of something. At higher difficulty
  the AI is "significantly more negative of you", which snowballs into permanent breakdown; a popular
  mod halves all agenda modifiers [community, mod doc]. **Lesson: reveal the hidden agenda as a reward
  for scouting/diplomacy; that is Basie's scouting-report hook.**
- **Civ IV** LeaderHeadInfos per leader: attitude weights plus per-memory `MemoryDecays` and
  `MemoryAttitudePercents` (memories decay by chance per turn; modders crank them for "long memory"
  races) [datamine/wiki; exact formula not found].
- **Stellaris** AI personalities are script files with weights; "Bloodthirsty Hordes" start at -5000
  opinion [community]. Paradox dev diary: personality "has a massive impact on their behavior"
  [official].
- **Total War Warhammer** diplomatic personalities (passive/defensive/aggressive/extremely aggressive)
  drive attitude *drift* toward liked/disliked factions [community, mod changelog].

### Telegraphing and pressure waves
| Game | What is telegraphed | Lead time | Confidence |
|---|---|---|---|
| Into the Breach | every enemy attack tile | 1 turn | [official/wiki] |
| They Are Billions | day of next swarm, escalating | days; final wave ~day 91 of 100 | [community] |
| XCOM 2 | Avatar bar, then countdown | ~20 days once full; any facility hit resets | [community] |
| Frostpunk | Great Storm via refugee warning | narrative lead, prep window | [community] |
| Whiteout Crazy Joe | fixed schedule, wave numbers, elite waves 7/14/17, HQ waves 10/20 | known days/times | [community] |
| RimWorld | raids generally *not* telegraphed; scaling explicit in dev view | none | [datamine/wiki] |

Pattern: the stronger the hit, the longer and louder the warning, and the more the player can *do*
during it (prep, intercept, reset the clock).

## 2. Opinion / standing models

### Composition
All studied systems use: `standing = Σ modifiers`, each modifier `{source, value, decay or expiry}`,
plus a static personality baseline. Civ IV and Total War show each reason with its value on hover
[community / datamine]. Civ V showed reasons as text without numbers and players found it opaque
("hidden away in a cumbersome diplomacy screen" for Civ VI too) [community].

### Concrete numbers found
**Stellaris** [datamine/wiki, Diplomacy page]
- Envoy improve relations +0.25/month up to +100..150; harm -0.5/month; after recall decays 1/month to 0.
- Insult -200 decaying; mutual rivalry -100; mutual war -50 while at war; defensive pact +20.
- Breaking pacts (decaying): NAP -25, commercial -25, research -25, defensive pact -100.
- Trust: default cap 50 (agreements raise cap to 75-100); growth +0.1..0.75/month per active
  agreement; -0.25/month when nothing sustains it; -2/month while rivals/at war.
- AI acceptance: NAP needs neutral opinion *or* 10 trust; commercial/research pacts positive opinion
  *or* 20 trust; federation excellent relations *or* 30 trust. Acceptance also adds attitude bonuses
  (Friendly +100, Wary 0), +2..5 per 10 opinion, distance penalties, shared-rival +40..50.
- Threat generation scales x0.75..x1.25 with -0.002 per opinion point.

**CK3** [datamine/wiki, Opinion page]
- Most opinion modifiers "decay to 0"; others fixed or timed.
- Broke truce -50 / 3 yrs; attacked an ally -25 / 3 yrs; murderer -15; faith hostility 0/-10/-20/-30.
- Tyranny gains +5..+20 per act, decays -0.25/month (-0.15 "Soon Forgiven", -0.05 "Venial") - i.e.
  *personality changes forgiveness rate*, a direct model for Basie grudges.

**Total War** [community / mod changelog]
- Attitude bands at -200/-75/-25/0/25/75/200 (WH3 per a mod changelog, unverified as vanilla).
- Gifts of money, long peace, shared allies raise attitude; war, trading with enemies, trespass lower
  it (Three Kingdoms). Reliability tracked separately; breaking deals or quick peace after war hurts it.
- Some aversions are permanent baselines; shared enemies can outweigh them.

**Civ VI Grievances** (Gathering Storm) [community]: per-target, visible as an exact total, decay at
peace (~1/turn claimed), occupation adds per turn. Replaced global "warmonger" that made *everyone*
hate you.

### Thresholds and display
- Bands with names (Hostile/Wary/Neutral/Cordial/Friendly) are universal; the band drives allowed
  actions; the number drives probability inside a band.
- Paradox uses "opinion OR trust" gates, so either recent goodwill or long history unlocks a deal.
- Show the breakdown; hide only the *personality's secret agenda*, revealed by scouting/intel.

## 3. Utility AI in practice

- **IAUS (Dave Mark, GDC 2013/2015 "Building a Better Centaur", deployed in Guild Wars 2: Heart of
  Thorns)** [official abstracts + ProjectBorealis IAUS wiki]:
  - Each action has N considerations; input normalized `(x - min) / (max - min)`, clamped, then
    through a response curve (linear, quadratic, logistic, logit etc.) to 0..1.
  - Considerations are *multiplied*; any zero vetoes. Initial weight acts as ceiling/priority tier.
  - Compensation for consideration count: `mod = 1 - 1/n; makeUp = (1 - s) * mod; s' = s + makeUp * s`
    [memory; Utility Intelligence docs attribute the factor to the Centaur talk, the geometric mean
    to Rez Graham].
  - Inertia: the running behaviour gets a constant bonus; ProjectBorealis also uses a cooldown
    on switching.
  - Designer adds/removes behaviours as data; "rarely if ever gets stuck" [official marketing].
- **Selection**: pure argmax can feel robotic; common practice is weighted random among options
  within X% of the best [memory; EQS "random from best x%" is the analogous tool].
- **Kevin Dill, "Dual-Utility Reasoning" (Game AI Pro 2 ch.3)**: rank (priority tier) + weight; pick
  the highest tier with viable options, weighted random inside it [memory; chapter text not read].
- **Personality as weights**: personality multiplies consideration weights or swaps curves
  (aggressive raider: steep curve on "target weakness"; patient builder: high weight on "own
  economy deficit"). Stellaris/Civ IV both store personalities as data files; no talk found that
  formalizes this **[not found]**, but it is the standard practice.
- **Exposing reasoning**: no source found on showing utility scores to players. The legible
  equivalent in shipped games is the *opinion breakdown* plus *in-character barks* (Halo).
  Recommendation below: translate the winning plan's top 2 considerations into a voice line.

## 4. Fairness, frustration and scaling

- **Warn proportionally; let the player respond.** Every telegraph case above gives the player
  agency during the countdown.
- **Cap losses.** Crazy Joe: no resource loss, stop attacking after two breaches [community]. Last
  Shelter Zombie Siege: no troop deaths [community]. Clash: shield length rises with damage taken
  [community].
- **Protect offline players.** Shields, starter protection (~7 days / level 6 in Last Shelter) and
  online-only waves are the genre norm [community]. No mobile 4X found that lets an NPC destroy an
  offline player's base **[not found]**.
- **Scale to state with diminishing returns.** RimWorld's wealth curve flattens past 400k and caps
  at 1M; early-game 0.7x; adaptation reduces after losses [datamine/wiki]. Civ VI's higher-difficulty
  negativity snowballing into permanent hostility is the documented anti-pattern [community].
- **Don't punish growth directly.** Johnson's Civ history: "AI targets the leader" reads as unfair
  even when rational [official]. If growth raises AI threat, show it as an in-world cause ("You hold
  four regions; Warlord X calls it an empire") and give the player levers (tribute, truce).
- **Determinism helps trust.** Halo discarded randomness; Into the Breach is near-deterministic.
  Randomness belongs in *which* plan is chosen, not in whether a telegraphed strike happens.

## 5. Gifts, tribute, demands, betrayal

- **Gifts** raise attitude in Total War and Civ (money gifts) [datamine/wiki]; Stellaris envoys
  move opinion slowly with a cap [datamine/wiki]. Diminishing return per repeated gift is common;
  exact curves **[not found]**.
- **Demands/tribute**: Endless Space 2 complaints that losing AIs demand "90% of resources" for a
  truce [community] - demands must be proportional to the power gap.
- **Betrayal**: Total War Rome Remastered players complain AI breaks ceasefires immediately
  despite supposed checks [community]. Civ V hid "planning war" behind a friendly label but let
  allies see it [official patch notes] - the closest documented *foreshadowing* mechanic.
  Paradox trust decays and pact-breaking costs -25..-100 opinion and big trust loss, giving AI a
  modelled reason not to betray cheaply [datamine/wiki]. No postmortem on foreshadowed betrayal
  **[not found]**.
- **Pattern to borrow**: betrayal = trust low + opportunity high + personality willing, and the
  first two are visible to a player who scouts.

## 6. Documented pitfalls

1. Ganging-up on the leader reads as anti-human bias (Civ 1-4) [official].
2. AI-to-AI cooperation that only benefits AIs reads as a cartel (Civ III tech trading) [official].
3. Invisible AI bonuses read as cheating even when statistically fair (Puzzle Quest) [official].
4. Sudden large AI gains erase player effort (instant Wonder) [official].
5. Difficulty scaling that biases opinion snowballs into permanent hostility (Civ VI) [community].
6. Optimizer diplomacy ("bargaining table") kills role-play; players want in-character AI [official].
7. Global penalties (warmonger) replaced by per-target grievances because they felt unfair (Civ VI)
   [community].
8. Hidden opinion screens: players can't learn the system (Civ V/VI complaints) [community].
9. Flat attitude bands that are always Hostile or Friendly (Stellaris diary comment) [community].
10. Dithering between behaviours without inertia (IAUS inertia exists because of this) [datamine/wiki].
11. Timer resets that allow "riding the clock" (XCOM 2) - fine if intended, exploit if not [community].

---

## Recommendations for Basie

Mapped to the agreed design. All numbers are `[PLACEHOLDER]` until playtested.

### Standing model shape
- Per faction toward player: `standing = baseline(personality) + Σ modifiers`, clamped -100..+100.
  Bands: Hostile <= -50 < Wary <= -15 < Neutral < +15 <= Cordial < +50 <= Friendly. Five bands,
  Stellaris/Total War style.
- Each modifier `{ id, label, value, decayPerHour, floor/expiry, source }`; decay toward 0. Show
  every active modifier in a breakdown on the faction card ("Gift caravan accepted +12, fading").
- Separate **trust** 0..100: grows only during truces/kept deals (+1..2/hour of active truce),
  decays slowly when idle (-0.25/hour toward personality baseline), drops hard on broken deals.
  Betrayal probability reads trust, not standing. Stellaris "opinion OR trust" gating for offers.
- Faction-to-faction standing uses the same model (enables inter-faction wars and "request help").
- Baseline drift: standing moves toward personality baseline at ~1-2 points/hour, so friendship
  needs upkeep ("friendship is not permanent").

### Decay rates (order of magnitude, in active play-hours)
| Event | Value | Fade |
|---|---|---|
| Gift received | +5..15 (diminishing per gift in 24h) | ~6-12 h |
| Tribute paid on demand | +10..20, plus "paid before" memory | ~12-24 h |
| Truce signed | +10 while active | ends with truce |
| Player attacked their march | -15..25 | ~24 h |
| Player took their region | -40 | ~48-72 h, or permanent "claim" grudge |
| Broke truce (either side) | -50, trust -40 | ~72 h (CK3: 3 years scaled down) |
| Shared enemy | +10 while both hostile to same faction | live |
| "You grow too strong" | -0..-25, scales with power gap | live, no decay |
Personality sets a forgiveness multiplier (CK3-style 0.2x..1.0x on decay).

### Telegraph durations (real time, online)
- Scout march: no warning (it *is* the warning).
- Raid on outpost/region: 10-20 min visible war-camp build-up + marching time.
- Major assault on home base: 2-6 h build-up with visible war camp growth and a countdown in Mail;
  last 30 min "imminent".
- Offline: plans may reach "ready", but strikes against the player start a fresh countdown on
  return (>= 30-60 min) - matches genre shields.
- Every countdown shows at least one counter lever (intercept the build-up march, pay tribute,
  ask a rival for help).

### Plan cadence
- Brain tick per faction every 5-10 game-minutes (not per frame); re-score only when idle or at a
  plan stage boundary.
- Committed plan gets an inertia bonus (+15-25% score) and can only abort at stage boundaries or on
  a hard trigger (lost >= 50% of committed troops -> retreat), to avoid dithering.
- Choose by weighted random among options within ~10-15% of the best score; deterministic
  outcome once telegraphed.
- At most one major hostile plan against the player per faction at a time, and a global cap of
  one major assault in flight across all three factions (anti-gang-up).

### Action types to start with (8)
Scout, Gather party, Raid (outpost/region), Claim region, Assault base (major), Gift caravan,
Diplomatic mail (warning/demand/truce offer), Fortify/level home base. Add inter-faction war and
"request help" response as plan variants of Raid/Claim. Each personality weights these differently;
three personalities x eight actions is a small, testable matrix.

### Personalities (weights over considerations)
- **Raider**: high weight on target weakness and recent-loss revenge; low forgiveness; high betrayal.
- **Builder**: high weight on own economy and defence; demands rather than raids; low betrayal,
  long memory both ways.
- **Opportunist**: high weight on "player busy elsewhere" and "rival at war"; mid forgiveness;
  betrayal driven by opportunity score.

### Scouting report contents
Leader name and personality hint (text, not label), home base level, garrison estimate (banded,
e.g. "~2-4k"), troop mix by row/type (feeds player counters), current plan stage if in build-up
("war camp: 40% assembled, target unclear/target: Region 4"), standing band + top 3 modifiers,
trust band, which faction they currently hate most, and (higher scout tier) the hidden agenda.
Hidden agenda revealed by scouting is the Civ VI "gossip" reward loop.

### Legibility
- Every AI action ships a reason line from the top two considerations in the leader's voice
  ("Your walls are thin and my men are hungry." = weakness + economy).
- "While you were away" report lists what each faction did, why (one line), and what is now
  pending with countdowns.
- Never grant AI resources the player can't see; AI growth comes from simulated income on the
  same rules, scaled by a published "threat level" tied to player power + level.

### Scaling
- Faction strength target = f(player power, player level, activity), with diminishing returns
  above a soft cap (RimWorld shape) and a recent-loss relief factor (RimWorld adaptation: ease
  after the player lost a big fight).

---

## Sources

- Stellaris Diplomacy wiki: https://stellaris.paradoxwikis.com/Diplomacy
- Stellaris dev diary 162 (envoys): https://forum.paradoxplaza.com/forum/threads/stellaris-dev-diary-162-new-diplomatic-features.1290338/
- CK3 Opinion wiki: https://ck3.paradoxwikis.com/Opinion
- Total War Warhammer Reliability: https://totalwarwarhammer.fandom.com/wiki/Reliability
- Total War Three Kingdoms diplomacy wiki: https://totalwar.fandom.com/wiki/Diplomacy_(Total_War:_Three_Kingdoms)
- WH3 mod changelog (attitude bands): https://steamcommunity.com/sharedfiles/filedetails/changelog/2866956235?p=2
- Civ VI agendas: https://www.fandom.com/articles/1281-why-civ-6-leader-agendas-mean-youll-never-play-the
- Milder Agendas mod: https://forums.civfanatics.com/resources/milder-agendas-relations.25863
- Civ VI Gathering Storm: https://en.wikipedia.org/wiki/Civilization_VI:_Gathering_Storm
- Civ VI diplomacy visibility: https://civilization.fandom.com/wiki/Diplomacy_(Civ6)
- Civ V diplomacy: https://civilization.fandom.com/wiki/Diplomacy_(Civ5) , https://www.ludo.guide/guide/civilization-v/civilization-v-part-8
- Civ IV leaderhead XML: https://modiki.civfanatics.com/index.php/Civ4LeaderHeadInfos
- Soren Johnson, Our Cheatin' Hearts: https://www.designer-notes.com/?p=132
- Johnson GDC22 summary: https://civfanatics.com/?p=6534
- Sid Meier GDC 2010: https://gamesbeat.com/game-guru-sid-meier-explains-decades-of-second-guessing-egomaniacal-gamers/
- Halo Illusion of Intelligence slides: https://www.jmeiners.com/shamans/papers/ai/the_illusion_of_intelligence.pdf
- Nemesis GDC 2018: https://www.gdcvault.com/play/1025150/
- IAUS: https://gameai.com/iaus.php , https://github.com/ProjectBorealis/IAUS/wiki , https://en.wikipedia.org/wiki/Utility_system
- Utility Intelligence compensation docs: https://uintel-go.utilityworlds.com/Documentation/UtilityIntelligence/Considerations/
- Game AI Pro (Dill, Lewis): https://www.oreilly.com/library/view/game-ai-pro/9781482254792/K23980_C003.xhtml , https://www.oreilly.com/library/view/game-ai-pro/9781351647748/xhtml/25_Chapter13.xhtml
- L4D Director: https://www.gamespark.jp/article/2007/04/10/11866.html , https://www.shacknews.com/article/57892/left-4-dead-at-gdc
- Into the Breach: https://en.wikipedia.org/wiki/Into_the_Breach , https://gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-
- They Are Billions: https://www.cnblogs.com/chucklu/p/16561453.html
- XCOM 2 Avatar: https://www.pcgamer.com/xcom-2-guide
- Frostpunk storm: https://primagames.com/tips/frostpunk-how-survive-storm
- RimWorld raid points: https://rimworldwiki.com/wiki/Raid_points
- Whiteout Crazy Joe: https://wostools.net/wiki/events/crazy-joe , https://www.mone.gg/blog/whiteout-survival/crazy-joe-guide.html
- Last Shelter Zombie Siege: https://www.appgamer.com/last-shelter-survival/strategy-guide/what-to-do-in-the-zombie-siege-defense
- Last Shelter shields: https://www.appgamer.com/last-shelter-survival/answers/14025-how-long-does-the-original-peace-sh , https://hbogamessupport.wbgames.com/hc/en-us/articles/360015326374-Why-did-my-Peace-Shield-expire-earlier-than-expected
- RoK barbarian forts: https://riseofkingdomsguides.com/?p=4164
- Clash of Clans shields: https://www.clash.ninja/guides/what-are-shields-and-guard
- Betrayal complaints: https://steamcommunity.com/app/885970/discussions/0/3155312274947429584 , https://steamcommunity.com/app/392110/discussions/0/1729837292626299871
