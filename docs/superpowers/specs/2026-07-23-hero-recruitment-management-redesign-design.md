# Hero Recruitment + Management Redesign — Design Spec

**Date:** 2026-07-23
**Status:** Approved design, pre-implementation
**Scope call (Steve):** Consolidate + reskin the existing hero systems. No new *combat*
depth this phase (troop-type affinity / positioning / power-rating are future notes).
**Roadmap:** next feature of record — `docs/30-roadmap.md` § "Hero recruitment + management
redesign" and § "UX friendliness".

---

## 1. Problem

The hero system works mechanically but "does not feel friendly" (Steve, confirmed by code
review). Concretely:

- **Recruitment sprawls across four surfaces** — Shop (buy scroll) → Inventory (find scroll)
  → GachaUI modal (roll) → Heroes detail pane (assign) — with no in-game guidance.
- **Too many item classes** to understand (scrolls, specific cards, universal cards,
  fragments, XP tomes).
- **No rate disclosure and no pity/guarantee** anywhere.
- The Heroes screen **leads with raw multiplier chips** and carries an **unrelated
  "production buffs from Inventory" section**.
- Heroes render as **emoji**. Steve has produced full-body post-apoc art (+ two animated
  clips) that the interface should be built around.
- `HeroManager.js` is a **958-line god file**; `HeroesUI` full-re-renders on every event
  (violates ADR 0007 patch-in-place).

## 2. Goals / non-goals

**Goals**
- One coherent recruitment surface, diegetically the **Hero Quarters** interior.
- A currency model the player can hold in their head, with disclosed rates + pity.
- A Heroes screen built around the new full-body art (+ video), leading with the hero, not
  math.
- A progression loop that stays alive across the whole game despite a small starting roster.
- Split the god file; patch-in-place rendering.

**Non-goals (this phase)** — captured in §11: troop-type affinity, front/mid/back
positioning, per-hero Power rating, gear / exclusive weapons, rotating featured banners.
Passive building-XP is **designed here but built as a fast-follow**.

## 3. Roster & data model

- **6 heroes at 2 / 2 / 2 across three tiers**, renamed **Normal / Epic / Legendary**
  (was common / rare / legendary). Tier is config-derived, not a save key — safe to rename.
- **Ids are save keys (ADR 0002 gotcha): the existing four keep their ids** —
  `warlord`, `archsorceress`, `shadowblade`, `paladin` — and only change display
  `name`/`title`/art:
  - `warlord` → **Marcus Kestrel** · `archsorceress` → **Vera Sable** ·
    `shadowblade` → **Kira Nightwhisper** · `paladin` → **Aldric Cross**.
- **Two new ids** added: **Juno Vane**, **Kaelen Thorne** (assign fresh ids, e.g.
  `junovane`, `kaelenthorne`).
- **Tier assignment (fixed):**
  - **Legendary:** Marcus Kestrel (`warlord`), Vera Sable (`archsorceress`)
  - **Epic:** Aldric Cross (`paladin`), Juno Vane (`junovane`)
  - **Normal:** Kira Nightwhisper (`shadowblade`), Kaelen Thorne (`kaelenthorne`)

  Rationale: puts the strongest art at the top (Marcus has a video, Vera a strong render);
  spreads the two **video** heroes across tiers (Marcus = Legendary, Juno = Epic) so the
  reveal payoff isn't all in one banner; spreads the two **new** heroes (Juno = Epic,
  Kaelen = Normal).
- **Each hero gets a backstory.** `HEROES_CONFIG` gains a `backstory` field — a few
  sentences of post-apoc lore per hero (who they were before, why they fight now), distinct
  from the short one-line `description`. Surfaced in the detail panel (§8.2). The six need
  written lore as content work; the re-fiction names (Marcus Kestrel, Vera Sable, Iron
  Warden Aldric Cross, the Ghost Runner Kira Nightwhisper, Arc Technician Juno Vane, Kaelen
  Thorne) are the seeds.
- **The roster is the source of truth.** Pity, per-tier odds, banner contents, and the
  shard exchange all *derive from the roster list*, so adding hero #7 later is a single
  `HEROES_CONFIG` entry — **6 is the starting number, not the cap** (Steve).

## 4. Currency & economy model

| Currency | Earned from | Spent on |
|---|---|---|
| **Recruit Tokens** ×3 (Normal/Epic/Legendary) | rewards, shop, premium | gacha pulls — **hero-currencies only** (§4.1) |
| **Specific Hero Cards** | events / game mechanics (gated; not freely sold long-term) | deterministically unlock one named hero |
| **Fragments** (per-hero) | pulls, rewards, dupe conversion | accumulate → **N fragments = 1 Hero Shard** |
| **Hero Shards** (per-hero) | pulls, dupe conversion, fragments | unlock + **all** awakening + skill levels |
| **Tier Shards** ×3 | rewards, maxed-hero overflow | **exchange only** → buy Hero Shards of that tier |
| **XP Cards** ×tiers | pulls, rewards, shop, premium | level a hero |

**Granularity matters — fragments, shards, and XP are distinct.** A fragment is a *partial*
piece; a Hero Shard is a *full copy unit* (unlock or one awakening/skill step); XP is
leveling fuel. A single reward or pull can pay out in any of the three — they are not
interchangeable.

### 4.1 Recruit Tokens pay out hero-currencies only
A token roll resolves to either a **new hero**, or — when it isn't a new hero — a
**hero-currency payout: fragments, a Hero Shard, or XP** (weighted by token tier). What a
token *never* yields is **base resources** (wood/stone/food/buff bundles): the current
`GACHA_CONFIG.outcomeWeights` (resource/xp/buff/fragment/hero, hero only 5–20%) are
**scrapped, not tuned** — a premium token handing out `res_bundle_wood_t1` is the opposite
of a hero pull. Higher token tier = better odds at a rarer hero and richer consolation,
biased to un-owned heroes first.

### 4.2 Dupe → fragments / shard
Pulling or buying a hero already owned **auto-converts to that hero's Fragments or a full
Hero Shard** (never a dead "duplicate card"). The card-cost awakening path (below) is
therefore removed.

### 4.3 Two shard types, kept distinct by role (not scope)
- **Hero Shards** are the primary currency: they **unlock** a hero (first full set) and pay
  for **all** awakening stars and skill levels.
- **Tier Shards** are **a conversion currency only** — they cannot be spent on awakening
  directly. They are exchanged at a fixed rate in the **Shard Exchange** for Hero Shards of
  any hero of that tier. This satisfies "generic within a rarity" without a redundant
  parallel spend path that would dominate hero-specific shards.

### 4.4 The roster-complete valves (structural — the small roster makes these non-optional)
With a small roster the acquisition axis is exhausted quickly; these keep tokens and shards
meaningful for the rest of the game (and bridge until more heroes ship):
- **Two-stage pity** (§6).
- **Maxed-hero overflow → Tier Shards.** Once a hero is fully maxed (max stars + max skill
  levels), further Hero Shards for that hero **convert to Tier Shards of their tier** — no
  separate "dust" currency (Steve's call: fewer currencies is better). Those Tier Shards go
  back through the Shard Exchange (§4.3) onto any not-yet-maxed hero of that tier, so tokens
  never yield dead value.
- **Levelable skills** (§5) as a deep, roster-independent shard sink.

## 5. Progression

- **Level** — capped at **`f(Hero Quarters level)`** (new cap; Hero Quarters is maxLevel 10,
  +5 hero slots/level). The **hero max-level ceiling is raised** for a longer per-hero grind
  (exact cap curve in the plan). XP sources:
  1. **XP Cards** (tiered) — built this phase.
  2. **Squad combat** — a hero in a marching squad gains XP from fights (exists:
     `awardBattleXP`).
  3. **Passive stationed XP** — a hero stationed in a producing building earns XP when its
     production ticks and the hero's skill fires. **Designed here, built as a fast-follow.**
     Must be **materially slower than combat XP** and **capped below the HQ-level cap** so
     the final levels require marching — otherwise stationing dominates and the
     dev-vs-combat choice dies (see §7 / specialist finding).
- **Stars** — **extended past 5** (exact ceiling in the plan, e.g. 7–10), **shard-only**
  (the `'card'` method is removed). The longer star track is a deeper shard sink; the
  Major/Awakening skill and stat/aura bumps are spread across it.
- **Skills — 6 per hero, composition driven by the hero's field.** Each hero has:
  - **3 Passive** — always-on modifiers (attack/defense/loss-reduction, or dev stat boosts).
  - **2 Support** — active abilities that fire during a fight (buff / shield / heal / burst).
  - **1 Major (Awakening) skill** — the signature ultimate, unlocked **only** through
    Awakening (§5 stars). One per hero; the payoff for maxing the star track. *(This pulls
    "awakening = a real major skill" out of the old deferred list into this phase.)*

  **Composition matches the hero's classification — skills span combat AND development
  domains.** A **combat** hero's skills lean combat; a **development** hero's skills lean
  development (production / build / research / economy effects) and may carry only one
  combat-support skill, or none; a **tech** hero leans tech. Classification stops being an
  informational badge and drives *what the skills do*. Dev-domain skill effects need real
  economy hooks (same wiring as §7's dev-bonus fix), so this expands `SKILLS_CONFIG`
  (up to 6 × 6 = ~36 skills to author) with content + some new non-combat effect plumbing.
  - Passive + Support skills are **levelable with Hero Shards** (deeper than 1–5; exact
    ceiling in the plan), gated by their unlock level. The Major/Awakening skill unlocks via
    the star track and has its own upgrade track.
  - **Hard cap: 6 skills per hero** (Steve). The skill *count* never grows past 3 + 2 + 1 —
    only the skill *levels* and star track deepen.
- **Numbers re-modeled against total XP income.** The current aura math compounds quietly
  (level `×(1+0.05·(lvl−1))` + absolute passive bonuses + absolute per-star), so with three
  XP faucets "endgame" aura would arrive without the intended grind. The plan models total
  XP income across all sources against the `1.3^level` curve **before** locking aura / star /
  skill numbers.

## 6. Pity

- **Two-stage.** *Stage 1 (roster incomplete):* pity hard-guarantees the **next un-owned
  hero**, biased by token tier (a Legendary token's pity awards an un-owned Legendary
  first). *Stage 2 (roster complete):* pity converts to a **shard floor** — every N pulls
  guarantees a minimum shard payout.
- **N = 10** hard guarantee as a *safety net*, with base per-pull new-hero odds tuned so
  **median roster completion is ~40–60 pulls** — pity is the floor, not the expected path
  (a tiny N turns the gacha into a visible countdown).
- **Rates + pity state are disclosed** on the banner ("Guaranteed new hero within X pulls").

## 7. Hero → game impact

- **Combat heroes:** squad auras + active battle skills + HQ-global aura (unchanged model).
  Aura stays strictly gated to squad/HQ assignment — a purely-stationed production hero
  projects **zero** combat aura. That non-overlap is the cost that keeps the dev/combat
  choice real; protect it.
- **Development heroes:** stationed production bonus, **now wired for all resource types.**
  Today `getBuildingProductionBonusMap` only maps `gold_production → money`; the other
  building bonuses (`training_speed`, `research_speed`, `defense`) are inert, so
  "development hero" is currently a choice that does nothing. Wiring them is what makes the
  role a real, rewarding pick.

## 8. Interface

### 8.1 Hero Quarters = the hub
The **Heroes view is the Hero Quarters interior** (clicking the building already routes
there via `cityGrade` `heroquarters: 'heroes'` + `ui:navigateTo`). The Recruit surface is a
section *within* it, not a floating modal reached from Inventory. Hero Quarters **level**
gates hero slots (existing) and the **hero level cap** (new).

### 8.2 Heroes screen (management hub)
- **Header** leads with the hero/roster, not math: a "**N recruitable**" affordance and a
  compact roster summary. The raw attack/defense multiplier chips are **demoted** (available
  but not the first thing). The **"production buffs from Inventory" section is removed** from
  this screen — it never belonged in Heroes. **It is not merely deleted:** that block was
  standing in for a real, unbuilt feature — **base buffs and production buffs** (temporary
  boosts to base defense / resource rates) that **belong to the HQ / base-management
  system**, which is yet to be built (see §11). This phase only evicts them from the Heroes
  screen; it does not build their real home.
- **Roster grid:** cards show the hero's **full-body art thumbnail**, tier frame, ★ stars,
  level, and an assignment/recruitable status chip. Filter by tier / class / status.
- **Detail panel:** large **full-body splash** — static render by default; heroes with a
  clip (Juno Vane, Marcus Kestrel) show a **▶ play button** that plays the `.mp4` on demand,
  **no autoplay**. Emoji is the last-resort fallback. Shows name / title / tier / class, a
  **backstory / bio section** (the hero's lore, §3), stats, aura, a **skill panel grouped by
  Passive / Support / Major(Awakening) with each skill's level** (the Major slot reads locked
  until Awakening), the star track, XP bar, and **one unified Deploy control** that assigns to a
  squad *or* stations at a building **in place** (no bounce-to-Base-tab toast).
- **Patch-in-place** on `heroes:updated` / `inventory:updated` (ADR 0007), not the current
  full `render()` rebuild.

### 8.3 Recruit Hall (section inside Hero Quarters)
- A **banner per token tier**, each with a spotlight hero's full-body art; **1× / 10×**
  pull buttons.
- **Rates + pity panel** (expandable): per-tier odds and live pity state.
- **Reveal** upgraded from the current `GachaUI`: full-body art reveal + tier glow; heroes
  with a clip get a **▶ play button** (manual, no autoplay), inline dupe→fragments/shard
  messaging, session history strip.
- **Shard Exchange** sub-panel: Tier Shards → Hero Shards.
- Retires the Inventory→Gacha entry as the primary path (kept working or redirected).

## 9. Art pipeline

- Source art lives in `mixBoard/Heroes/` (full-body renders + two `.mp4`). `/assets/` is
  git-ignored repo-wide (ADR 0021 idiom) — an **ingest step** produces per-hero
  `{thumb, splash, video}` into `assets/…/heroes/` and a manifest mapping **hero id → art
  files**, mirroring the `GRIT_BUILDING_MAP` static-manifest pattern.
- `HEROES_CONFIG` gains optional art references; every consumer falls back to the existing
  emoji when a file is missing (so the game never hard-depends on git-ignored art).

## 10. Architecture

- **Split `HeroManager.js`** into `js/systems/hero/` collaborators (following the
  `js/systems/world|march` precedent), orchestrated by a thin `HeroManager`:
  - roster + recruitment/pity/currency,
  - progression (XP / stars / skills),
  - combat-bonus aggregation,
  - production/economy bonuses.
  Serialize/deserialize stays centralized; **every new save field needs seed + reconcile
  coverage** (ADR 0002).
- New **`RecruitUI`** absorbs/replaces `GachaUI`.
- **ADR** records the economy decisions: heroes-only tokens, dupe→shard, shard-only
  awakening, two-shard roles (hero-specific primary / tier-shard conversion-only), Hero
  Quarters-gated level cap, two-stage pity, maxed-hero overflow → Tier Shards.

## 11. Deferred — future feature notes

Recorded so a future session doesn't re-derive them:
- **Combat depth:** troop-type affinity (hero buffs only matching troop type), front/mid/back
  positioning, per-hero **Power rating**.
- **Passive stationed XP** — designed in §5; ship as a fast-follow with the HQ-cap + slower
  rate guards in place.
- **Gear / exclusive weapons** (LSS endgame layer). *(Awakening-as-major-skill is no longer
  deferred — pulled into this phase, §5.)*
- **Rotating / featured banners** (the roster is banner-ready; only one standard pool ships
  now).
- **Base buffs & production buffs — belong to the HQ / base-management system** (Steve).
  Temporary boosts to base defense / resource rates, part of base management, **not yet
  built**. Currently faked by the timed-buff block being evicted from the Heroes screen
  (§8.2); their real home is the HQ / base-management feature. Recorded here so it isn't lost
  when the placeholder block is removed.
- **Hero XP curve (needs its own numbers pass)** — nail down, as explicit tunables:
  **how much XP each level-up consumes**, and **total XP required to max a hero**. Feeds the
  §5 re-modeling (XP-card values, passive vs combat rates, HQ-level cap all resolve against
  this curve). Flagged as a first-class design/plan item, not a buried constant.

## 12. Verification

Per `tests/README.md` (ADR 0012), additive:
- **Unit:** currency flows (token roll = hero-or-shards only; dupe→shard; tier-shard
  exchange rate; pity two-stage guarantee; shard-only awakening; skill-level shard costs;
  HQ-level cap on XP; all-resource production wiring; Hero Dust conversion at max). One test
  file per new `js/systems/hero/` module; append to `heroManager`/`heroesData` tests.
- **Data integrity:** every art-manifest id resolves to a `HEROES_CONFIG` id; every gacha
  outcome id resolves (retire the dangling-id class per ADR 0023).
- **Browser smoke:** Hero Quarters → Heroes view → Recruit → pull reveal (art/video) →
  assign in-place; save/reload round-trips every new field. Spaced ~3s apart (port-8123
  race).

## 13. Open items for the plan (not blocking design approval)

- Exact tier assignment of the 6 heroes (which two per tier).
- Exact numbers: **LOCKED** (game-designer numbers pass, 2026-07-23) — see the companion
  reference `2026-07-23-hero-economy-numbers.md`: hero max level = HQ×10 (→100), linear-step
  XP curve, bounded aura, 10-star track, skill-level cap 10, pity odds (~50-pull median),
  3:1/2:1 exchange, wired per-resource dev bonuses. Phase 1/2 plans consume those constants
  verbatim.
- Where the relocated "production buffs" section lands.
