# 0036 — Campaign chapters, stars and the new Combat view

Date: 2026-10-03 · Status: accepted · Spec: `docs/superpowers/specs/2026-10-03-battle-tab-campaign-design.md` ·
Plan: `docs/superpowers/plans/2026-10-03-battle-tab-campaign.md` · Design page: `docs/10-design/battle-tab.md`

## Context

The Combat view was a flat list of the 10 hand-written campaign monsters with a side detail panel. The agreed Battle
tab design (slices 1+2: campaign model + map) needs chapters, elites, stars, per-stage reports and a Commanders
panel, without hand-authoring dozens of stages. Combat rules (ADR 0034) are unchanged. No real users: no save
migrations or legacy shims.

## Decision

1. **Chapters are config.** `CAMPAIGNS_CONFIG` (`js/entities/data/combat.js`) lists 10 chapters, one per existing
   monster. Each chapter's boss is that monster, so boss stage ids stay the monster ids (`goblin_camp` ...
   `chaos_titan`).
2. **Stages are generated.** `js/systems/campaign/` builds per chapter 4 regular stages (`ch{N}_s{i}`, 1-based), the
   boss and one elite (`ch{N}_elite`) from knobs: `regularScale` 0.45 -> 0.85 of the boss, `eliteTierBump` 1,
   `eliteCountMult` 1.5, `firstClearDiamonds` {regular 5, boss 20, elite 15, perChapter 1.25}, `roundPar`
   {regular 8, boss 12, elite 12}. The knobs are placeholders for the balance pass.
3. **Stage ids are save keys.** Rename display names only. Generated stages also accrue
   `CombatManager._victoryCounts` (intended: `maxRewardedWins` decay).
4. **Star rules.** `STAR_RULES = { lossFraction: 0.25 }` in `combatRules.js`: a win is 1 star; losses (dead +
   wounded) within the fraction of troops sent give 2; finishing within the stage's round par as well gives 3.
   Pure `starRules.js`.
5. **`CampaignManager` owns progress.** `{ bestStars, firstCleared, lastReport }` per stage; serialize/deserialize
   with seed + reconcile (ADR 0002). It listens to `combat:victory` / `combat:defeat`, sums dead/wounded tier maps into the report totals
   and requests the first-clear diamonds as mail through the EventBus (ADR 0001). `getCampaignStagesWithState` is
   removed; the UI reads `getStageStates()` / `getCurrentStageId()`.
6. **Row cap.** `ROW_SLOT_CAP = 2`: at most two of the four slots share a row. `UnitManager` enforces it
   (`canSetSlotRow`, cap-aware `getSlotRow`), re-flowing overflowed slots to the next free row; the Barracks toggle
   disables a full row.
7. **Combat events carry more.** The result payload gains hero ids and per-round `triggered` hero skill events
   (needed by slice 3 playback and the Commanders panel).
8. **New Combat view.** Tabs Campaign / Survival / Log; A1 vertical trail (`trailLayout.js` generates the road through
   every stage point); stage panel with squad picker, win estimate, Deploy and Commanders (`squadCommanders.js`).
   `CombatUI` is split into `js/ui/combat/` modules and `battle-{stage,commanders,trail}.css`.

### Rulings taken during the build

- **YOU marker fallback.** `currentStageId` = first not-yet-cleared unlocked stage; if the next stage is blocked by
  `requires`, fall back to the last completed non-elite stage, else the first stage (it first fell back to the final
  boss, a bug).
- **Default tab.** Survival when `gameMode` is survival, else Campaign (restores previous behaviour).
- **Locked nodes still open the panel**, showing the unlock reason instead of Deploy.
- **Lock text uses config building names** (`BUILDINGS_CONFIG`, e.g. "Headquarters (HQ) Lv.3").
- **Tutorial spotlight retarget.** The `combat` step spotlights the available node, then retargets to Deploy once the
  stage panel is open (the spotlight blockers otherwise stop a new player reaching Deploy).
- **Aura chips show effective values** via exported `auraValueFor` (`heroCombat.js`); skill/stat chips follow
  `isUnlocked`, stars and scope exactly as `collectEffects` does.

## Consequences

- Adding a chapter or monster is data only; ids stay stable across balance changes.
- Old dev saves with the previous campaign shape are not migrated: reset the slot.
- `CLAUDE.md` is stale (manager count, wiki map still lists the battle tab as not built); not edited here.
- The legacy `.campaign-detail*` / `campaign-wave-*` CSS in `grid.css` and `worldmap.css` is unused and can be deleted.
- Slice 3 (P1 playback with hero bar + timeline) and slice 4 (results with hero XP) build on the payload additions.
