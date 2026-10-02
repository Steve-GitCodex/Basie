# Combat (shipped design)

One pure resolver decides every fight: campaign stages, world-map marches (camps, strongholds,
outposts, ruin garrisons, bosses) and, later, PvP / Arena. Rationale and rulings: ADR 0034
(`docs/20-decisions/0034-shared-combat-resolver.md`); research: `docs/research/combat-model.md`.
All tuning numbers live in `js/entities/data/combatRules.js` (`COMBAT_RULES`) — edit there, never in code.

## Modules

`js/systems/combat/` is pure (no EventBus, managers or DOM): `resolveBattle` (waves + round loop),
`hitMath`, `targeting`, `casualties`, `seededRng` (mulberry32), `battleSides` (squad / monster → sides),
`combatInputs` (adapter helpers). `CombatManager` gathers inputs, calls the resolver, applies losses,
wounded and rewards, and emits events. UI playback is `js/ui/combat/`.

## Rules

- **Hit:** `hitDamage(atk, def) = atk² / (atk + def)`. Attack that beats defense hurts; a swarm of weak
  hits chips at a heavy target but cannot trivialise it.
- **Stack:** `{ type, tier, row, count, hp, attack, defense }`. Damage per round =
  `count × hitDamage × counter × variance`. Variance is ±10% per stack per round from the seeded RNG.
- **Counters:** infantry beats cavalry, cavalry beats ranged, ranged beats infantry (×1.15). Siege is
  ×1.5 against structures (stronghold / outpost fights only).
- **Rows:** front / mid / back, set per squad slot (Barracks toggle), defaulting by type (infantry
  front, cavalry mid, ranged and siege back). Damage lands on the front-most living row and is split
  by `count × TIER_TARGET_WEIGHT`, so low tiers absorb first. Overflow spills within the row, then is lost.
- **Kills:** `hpPool -= damage`, `count = ceil(hpPool / hp)`.
- **Abilities:** `heal` (regain a share of lost HP each round), `revive` (return once at a fraction of
  starting count), `aoe_blast` (hits every living row).
- **Heroes:** barracks heroes strike once per round into the front row (`HERO_STRIKE`); skill triggers
  (`battle_start`, `wave_start`, `final_wave`, `losing`) run in **rounds**.
- **Waves:** sequential; survivors carry over. `ROUND_CAP` per wave; cap reached or a mutual wipe on
  the final wave = defeat.
- **Casualties:** fallen = start − end. Victory heals `floor(fallen × postBattleHeal)`; the rest splits
  wounded vs dead by `WOUNDED_SHARE` plus `lossReduction` (ADR 0031 soft-capped aggregate). The squad loses
  dead + wounded; wounded accrue in `UnitManager.getWounded()` (no hospital yet).
- **Determinism:** report = f(`rulesVersion`, `seed`, inputs). Battle log entries store `seed` and
  `rulesVersion`. No `Math.pow`/`exp`/trig in the pure modules.

## Data

- Monsters (`js/entities/data/combat.js`): `waves[].stacks[]` with `tier`, `type`, `row`, `hp`, `attack`,
  `count`, optional `defense` (defaults to `MONSTER_TIERS[tier-1].defense`) and ability fields.
  `SURVIVAL_MONSTER` scales stack hp/attack/count per wave. Ids are unchanged (save keys).
- Squad: `squad.slotRows` (slotIndex → row) and top-level `wounded` (tierKey → count) are serialized by
  `UnitManager`. Unslotted units fight at their type's default row.

## Surfaces

- `CombatManager.attack(monsterId, squadId, { seed })`, `resolveMarchBattle(..., milMult, { structure, seed })`,
  `estimateBattle(squadId, monsterId)` → `{ winChance, avgDead, avgWounded }`.
- Campaign stage badge: "Likely win · ~70% · ~4 lost" (`estimateBadge`); playback via `BattlePlayback`
  (per-row bars, skip button); result screen lists dead and wounded.
- Barracks squad modal: per-slot Front / Mid / Back toggle and a "Wounded: N" chip.
- March result toast reports dead and wounded.

## Tests

Unit tier: one file per combat module plus the `CombatManager` / `marchResolver` / `heroCombat` /
`unitManager` / `gameData` files. Browser: `tests/browser/combat-smoke.mjs`.
