# Hero Economy — Locked Numbers (balance reference)

**Date:** 2026-07-23 · **Status:** locked (game-designer numbers pass)
**Companion to:** `2026-07-23-hero-recruitment-management-redesign-design.md`

Drop-in constants for `heroes.js` (`AWAKENING_CONFIG`, `GACHA_CONFIG`, `SKILLS_CONFIG`
scaling, new `XP_CONFIG` / `PITY_CONFIG` / `EXCHANGE_CONFIG` / `PROD_BONUS_CONFIG` blocks) and
the `getBuildingProductionBonusMap` rewrite. All values modeled together against one XP
curve. Starting points traced to current `heroes.js`; where a value replaces an existing one
it is called out. These feed Phase 1 (economy) and Phase 2 (progression) plans.

## A. Level cap + XP curve (foundation)
```
HERO_LEVEL_CAP = HeroQuarters_level × 10      // HQ maxLevel 10 → hero max level 100
PASSIVE_XP_CAP = HERO_LEVEL_CAP − 20          // stationed heroes stall 20 levels short

xpToNext(L) = round( (100 + 20·(L−1)) · tierMult )
tierMult    = { normal: 1.0, epic: 1.25, legendary: 1.5 }
```
- L1→2 = 100 XP; L99→100 = 2060 (Normal). Replaces `1.3^(L−1)` (unusable past ~L25) and the
  inconsistent per-hero `xpPerLevel` (500/550/600/650).
- **Total XP to max (L1→100):** Normal 106,920 · Epic 133,650 · Legendary 160,380.
- **Skill/Major unlock gates** (replace old 5/10/20): Passives **L5 / L15 / L30** ·
  Supports **L10 / L25** · Major = **star 5** (not a level).

## B. Aura (compounding fix — bounded, fully relative to base)
```
auraValue     = base · ( 1 + 0.005·(L−1) + 0.04·stars + skillAuraFrac )
skillAuraFrac = 0.08 + 0.012·(skillLvl−1)     // arcane_nova / poison_blade / holy_light
```
| base aura (unchanged) | value |
|---|---|
| attack_boost (Marcus/`warlord`) | 0.15 |
| magic_amplify (Vera/`archsorceress`) | 0.20 † |
| crit_chance (Kira/`shadowblade`) | 0.15 |
| defense_boost (Aldric/`paladin`) | 0.20 |

† Set Vera base to 0.20 and **drop the `magic_amplify → ×0.8` hack** in `getCombatBonuses`
(fold into base for legibility). Per-star: absolute +0.05 → **relative +0.04·base**. Level:
0.05/lvl → **0.005/lvl**. Endgame (Vera L100/10★/arcane_nova L10) = **+52%** (was unbounded).

## C. Star track
```
MAX_STARS               = 10        // was 5
MAJOR_SKILL_UNLOCK_STAR = 5
perStarStatBonus        = +0.06 additive   // +60% stats at 10★ (was +0.10×5)
perStarAuraBonus        = +0.04·base/star  // see B
```
Hero-Shard cost per star (shard-only; `'card'` method removed):

| → star | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Normal | 1 | 1 | 2 | 2 | 3 | 3 | 4 | 5 | 6 | 8 | **35** |
| Epic (×1.5) | 2 | 2 | 3 | 3 | 5 | 5 | 6 | 8 | 9 | 12 | **55** |
| Legendary (×2) | 2 | 2 | 4 | 4 | 6 | 6 | 8 | 10 | 12 | 16 | **70** |

## D. Skill levels (deep shard sink)
```
SKILL_LEVEL_CAP           = 10                 // Passive + Support
shardCostForSkillLevel(L) = ceil(L/2)          // L2..L10 = 1,1,2,2,3,3,4,4,5 → 29/skill
```
- 5 levelable skills/hero (3 Passive + 2 Support) → **145 Hero Shards** to max all skills.
- **Passive effect:** `base·(1 + 0.15·(L−1))` (iron_will 8% → 18.8% @L10).
- **Support effect:** `base·(1 + 0.10·(L−1))` (charge +20% → +38% @L10).
- **Major (Awakening) skill** — own 5-level track, unlocked at star 5:
  `MAJOR_SKILL_COSTS = [5, 8, 12, 18, 25]` → **68 total**.
- **Full-max one hero (excl. unlock):** ≈ 248 Normal / 268 Epic / 283 Legendary Hero Shards.

## E. XP cards + rates
```
XP_CARD = { normal: 500, epic: 2500, legendary: 12000 }   // flat XP/card
```
Replaces unpriced `xp_bundle_small/medium/large`. Fast-follow passive-XP guardrail:
```
COMBAT_XP_PER_BATTLE          = 800    // 600–1000, scales w/ enemy tier
PASSIVE_XP_PER_PRODUCTION_TICK = 2     // ≈20% of combat throughput
PASSIVE_XP_LEVEL_CAP          = HERO_LEVEL_CAP − 20
```

## F. Fragments → Shard + unlock
```
FRAGMENTS_PER_SHARD = { normal: 8,  epic: 10, legendary: 12 }
SHARDS_TO_UNLOCK    = { normal: 4,  epic: 6,  legendary: 8 }   // first full copy
```
Unlock in fragments: 32 / 60 / 96. Replaces `fragmentsToSummon` (10/20/30).

## G. Recruit Token odds + two-stage pity
```
NEW_HERO_RATE      = { normal: 0.10, epic: 0.12, legendary: 0.14 }   // per pull, un-owned-biased
SOFT_PITY_FROM     = 7       // +0.08 new-hero rate/pull from pull 7
STAGE1_HARD_PITY_N = 10      // forces next un-owned hero (tier-biased)
STAGE2_SHARD_FLOOR = 1       // roster complete: every 10 pulls → 1 Hero Shard (not-yet-maxed hero of tier)
```
Median completion ≈ 50 pulls (in the 40–60 target); N=10 clips only the unlucky tail.
Non-hero **consolation split** (pull isn't a new hero):

| token | fragments | Hero Shard | XP |
|---|---|---|---|
| Normal | 75% | 5% | 20% |
| Epic | 60% | 20% | 20% |
| Legendary | 45% | 35% | 20% |

**Scraps** the current `outcomeWeights` + `heroTierWeights` entirely — tokens never pay base
resources. Consolation target is un-owned-biased, else weighted to the token's tier.

## H. Tier-shard exchange + maxed overflow
```
TIER_SHARDS_PER_HERO_SHARD = 3     // Exchange: 3 tier shards → 1 hero shard (flat)
MAXED_OVERFLOW_TO_TIER     = 2     // 1 surplus hero shard on a maxed hero → 2 tier shards
```
Asymmetry (spend 3, refund 2) is deliberate: value never dies, but round-trips lose value —
**no net-positive laundering loop.** The exchange must enforce this direction. Optional
per-tier buy-rate (2/3/4 : 1) if Legendary shards feel too cheap.

## I. Wired dev-hero production % (all resource types)
```
PROD_BONUS_BASE = { resourceOutput: 0.15, trainingSpeed: 0.12, researchSpeed: 0.12, buildSpeed: 0.12 }
prodLevelScale  = ×(1 + 0.01·(L−1))    // was 0.02/lvl; halved
prodStarBonus   = +0.02·base per star
```
Stat → effect map (replaces the single `{ gold_production: 'money' }` case):

| building | stat | effect |
|---|---|---|
| bank | gold_production | money +15% |
| farm | food_production | food +15% |
| lumbermill | wood_production | wood +15% |
| quarry | stone_production | stone +15% |
| mine | iron_production | iron +15% |
| barracks | training_speed | +12% |
| workshop | research_speed | +12% |

Max (Normal dev, L100, 10★) = +33%/building — comparable to combat's +52% but spread, so
dev vs combat is a real balanced pick.

## Sanity interlocks (verify in the plan, not new numbers)
- **Overflow loop closed:** 3-for-1 buy vs 2-for-1 refund → every round-trip loses value.
  The exchange must enforce the buy direction.
- **Aura bounded:** a maxed 4-hero squad tops ~×2.5–3.0 attackMult (was unbounded). Re-run
  `getCombatBonuses` against Combat difficulty before locking.
- **XP faucet balance:** cards + 800/battle + passive vs 106,920/hero (Normal). Active
  marcher ~134 battles; passive alone caps at L80; no faucet trivializes the curve.
- **HQ-cap interlock:** hero cap `= HQ×10` — HQ1 caps heroes at L10; skill gates L15/L30 and
  star-5 Major stay reachable only as HQ levels rise (intended long-game gate).
