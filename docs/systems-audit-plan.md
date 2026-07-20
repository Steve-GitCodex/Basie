# Systems Bug Audit — Plan

> Roadmap item: **Hardening & housekeeping → Systems bug audit**. Written 2026-07-20,
> after the grit reskin closed. Owner's standing assessment: "most managers are bugged /
> roughly built." This plan is how we find out, on evidence.

## The problem with just "verifying"

A verification pass drives the happy path. The happy path is the one code path that
already gets exercised every session, so it is the least likely place for a live bug —
we may well come up clean and learn nothing. The bugs that survive to now are in the
paths nothing routinely walks: reload boundaries, offline catch-up, empty/max states,
resource exhaustion, and cross-manager event ordering.

So this audit runs **three prongs**, and the static read is the one expected to pay.

## Where the risk actually is (measured, 2026-07-20)

Test coverage is sharply skewed toward recent work. `tests/unit/` has 25 files, but
they cluster on city/base (10 files) and world/march (6). Untested manager surface:

| Manager | Lines | Unit tests | Notes |
|---|---:|---|---|
| `HeroManager` | 832 | none | gacha, fragments, XP, skills, awakening |
| `UnitManager` | 800 | none | training, squads, deploy-lock, tiers |
| `TechnologyManager` | 446 | none | research tree, prereqs, effects |
| `CombatManager` | 429 | none | battle formula; known `milMult < 1` trap |
| `InventoryManager` | 288 | none | item use, speed-ups, stacking |
| `ChallengeManager` / `MailManager` / `UserManager` | ~230 ea | none | |
| `EventManager` / `AchievementManager` | ~200 ea | none | |
| `MarketManager` | 151 | none | trade table + inflation |
| `QuestManager` / `StoryManager` | ~97 ea | none | trigger chains |

`ResourceManager` (453) has 2 tests; `BuildingManager` (956) is well covered.
**~3,900 lines of gameplay logic carry zero unit tests.**

**Second gap: persistence.** 16 managers implement `serialize`/`deserialize`. There is
no round-trip test for any of them, and `SaveManager` itself (90 ln) is untested.
`tests/README.md` already lists "SaveManager round-trip" as uncovered. Per ADR 0002, a
field missing from seed/reconcile is dropped **silently** on load — this class of bug is
invisible until a player loses progress.

**Pre-existing open findings** to fold in rather than rediscover (roadmap):
- `marchResolver._gather` economic bonus clamped to `loadCap` → no-op except on empty nodes.
- `CombatManager.resolveMarchBattle` guards `milMult > 1`, silently ignoring debuffs.
- `world:buffsChanged` has no UI listener → buff panels can go stale.
- Phase C adjacency ↔ rubble pacing coupling (balance, deferred; note only).

**Two candidate findings surfaced while scoping** — unconfirmed, verify before believing:
`TutorialManager` and `SettingsManager` implement no `serialize`/`deserialize`. If neither
persists through another route, tutorial progress and settings reset on reload.

## Prong A — specialist static review (expected to find the most)

Five parallel read-only reviews, one per cluster, each by a subagent with the relevant
specialist framing. Each returns findings only — **no fixes** — as
`{file:line, what breaks, how to reproduce, severity, suggested regression test}`.

| # | Cluster | Specialist framing |
|---|---|---|
| A1 | `CombatManager` + `UnitManager` | game-designer (formula/economy correctness) |
| A2 | `HeroManager` + `InventoryManager` + `MarketManager` | game-designer |
| A3 | `TechnologyManager` + Quest/Story/Achievement/Challenge/Event | codebase-onboarder (trigger chains) |
| A4 | `SaveManager` + every `serialize`/`deserialize` pair | software-architect (ADR 0002 compliance) |
| A5 | `ResourceManager` + `MailManager` + `UserManager` | codebase-onboarder |

Standing instruction to every reviewer: **ground each finding in a specific line and a
concrete reproduction.** "This looks fragile" is not a finding. Speculative findings are
listed separately and clearly marked.

## Prong B — persistence round-trip harness (highest structural value)

New `tests/unit/persistence.test.js`: for each serializing manager, construct → mutate to
a non-default state → `serialize()` → fresh instance → `deserialize()` → assert deep
equality of observable state. This is the test that catches the ADR 0002 silent-drop
class permanently, and it is the one piece of this audit that keeps paying after today.

Managers needing a live EventBus/dependency get a thin stub; anything genuinely
browser-bound gets a smoke assertion instead, per `tests/README.md`.

## Prong C — empirical loop verification (the roadmap's Phase 2 pass)

Extend the browser tier over the untested full loops: gather → haul → return; camp and
stronghold attack; the region unlock chain; ruin and outpost capture; a world boss
window; fog reveal. Then a **save/reload round-trip mid-flight** — dispatch a march,
reload, confirm it lands correctly — which crosses Prong B's static coverage with real
engine timing. Builds on `tests/browser/harness.mjs`.

Gotcha carried forward from 2026-07-19: browser smokes each spawn `http-server` on port
8123, so back-to-back runs race and produce phantom FAILs. Space them ~3s, and re-run a
failure alone before believing it.

## Triage and fix

Findings land in `docs/30-roadmap.md` under the audit item, each tagged:

- **load-bearing** — corrupts save state, loses player progress, or crashes the tick. Fix now.
- **wrong-but-contained** — incorrect math/behaviour, no data loss. Fix if cheap.
- **cosmetic / future-trap** — record, don't fix (e.g. the `milMult < 1` Phase 4 trap).

Every fix lands with a regression test in the matching `tests/unit/*.test.js`, per the
additive-suite contract (ADR 0012).

## Execution

- **Plan + triage + review of findings:** this session (Opus).
- **Implementation:** delegated to Sonnet subagents, one cluster per agent, each with an
  explicit spec and the requirement to add regression tests and run `npm test` before
  reporting.
- **Definition of done:** `npm test` green with a materially higher count; all six browser
  smokes pass; `node scripts/check-comments.mjs` clean on touched files; findings table in
  the roadmap; ADRs for any behavioural decision; `docs/40-active.md` updated.

## Sequencing

1. Prong A five reviews in parallel (read-only, no code changes).
2. Prong B harness while A runs — independent, and its failures are themselves findings.
3. Triage A+B together; Steve calls anything that is a design decision rather than a bug.
4. Fix load-bearing findings (Sonnet, parallel by cluster).
5. Prong C loop verification last — it validates the fixes rather than racing them.
