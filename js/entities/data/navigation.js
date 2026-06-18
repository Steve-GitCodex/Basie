/**
 * navigation.js
 * Tab unlock conditions and grouped-tab definitions.
 *
 * TAB_UNLOCK_CONDITIONS keys:
 *   - Top-level view IDs (e.g. 'military', 'heroes') for nav buttons.
 *   - Sub-tab IDs prefixed with 'sub:' (e.g. 'sub:barracks') for sub-tab buttons
 *     inside a grouped nav entry.
 *
 * Condition types:
 *   'always'       — always accessible, no gate.
 *   'building'     — requires buildingId to be at level >= 1 (built).
 *   'building_any' — requires at least one of buildingIds to be at level >= 1.
 *   'hq_level'     — requires 'townhall' to be at the given level.
 *   'group_any'    — derived from children; unlocked if any child sub-tab is unlocked.
 *
 * `label` is shown in locked-state cards and tooltips as the unlock requirement.
 */
export const TAB_UNLOCK_CONDITIONS = {
  // ── Standalone top-level tabs ─────────────────────────────────────────────
  base:     { type: 'always' },
  combat:   { type: 'always' },

  world:    {
    type: 'building',
    buildingId: 'rallypoint',
    label: 'Build a Rally Point (requires HQ Lv 3)',
  },

  heroes:   {
    type: 'building',
    buildingId: 'heroquarters',
    label: 'Build a Hero Quarters (requires Barracks Lv 3 + HQ Lv 4)',
  },
  research: {
    type: 'building',
    buildingId: 'workshop',
    label: 'Build a Workshop (requires HQ Lv 5)',
  },
  events:   {
    type: 'hq_level',
    level: 3,
    label: 'Upgrade HQ to Level 3',
  },

  // ── Grouped top-level tabs (unlocked if any child is unlocked) ────────────
  // Training & Squads are now tooltip-opened modals (no Military group view).
  quests:   { type: 'group_any' },
  economy:  { type: 'group_any' },

  // ── Sub-tabs: Economy ─────────────────────────────────────────────────────
  'sub:market': {
    type: 'hq_level',
    level: 2,
    label: 'Upgrade HQ to Level 2',
  },
  'sub:shop': { type: 'always' },

  // ── Sub-tabs: Quests ──────────────────────────────────────────────────────
  'sub:quests':     { type: 'always' },
  'sub:challenges': {
    type: 'hq_level',
    level: 2,
    label: 'Upgrade HQ to Level 2',
  },
};

/**
 * TAB_GROUPS — defines which top-level nav entries are "group" tabs with
 * horizontal sub-tabs inside.
 *
 * Each subTab entry:
 *   id      — used as the sub-tab's key and maps to DOM id `sub-view-{id}`.
 *   label   — display label for the sub-tab button.
 *   viewId  — the view string emitted via `ui:viewChanged` so domain
 *             controllers (BarracksUI, MilitaryUI, etc.) receive the
 *             same event value they already listen for.
 */
export const TAB_GROUPS = {
  quests: {
    subTabs: [
      { id: 'quests',     label: '📜 Quests',     viewId: 'quests'     },
      { id: 'challenges', label: '🏆 Challenges', viewId: 'challenges' },
    ],
  },
  economy: {
    subTabs: [
      { id: 'market', label: '🏪 Market', viewId: 'market' },
      { id: 'shop',   label: '🛒 Shop',   viewId: 'shop'   },
    ],
  },
};

/**
 * Maps a building id to the badge key it should activate when completed or
 * unlocked. Badge keys match keys in TAB_UNLOCK_CONDITIONS (top-level tab ids
 * or 'sub:X' for sub-tabs).
 */
export const BUILDING_TAB_MAP = {
  // Trainer & Barracks buildings open modals (no badge tab) — completion still
  // badges the Base toggle via _onBuildingCompleted.
  heroquarters:  'heroes',
  workshop:      'research',
  magictower:    'research',
  rallypoint:    'world',
};

/**
 * BUILDING_VIEW_ACTION — maps a built building to the "open its system" action
 * shown in the tile click-tooltip (`TileTooltip`). The bottom bar no longer
 * carries Military/Heroes/Research buttons; those views are reached by clicking
 * the building that owns them.
 *
 * Each entry: { label, view } routes via `ui:navigateTo(view)`; { label, train }
 * for trainer buildings emits `ui:openTraining` (opens the compact Training modal);
 * { label, squads } emits `ui:openSquads` (opens the per-building Squad modal).
 */
export const BUILDING_VIEW_ACTION = {
  barracks:      { label: '⚔️ Manage Squads', squads: true },
  heroquarters:  { label: '🦸 Heroes',        view: 'heroes'   },
  workshop:      { label: '🔬 Research',       research: true },
  magictower:    { label: '🔬 Research',       research: true },
  rallypoint:    { label: '🌍 World Map',      view: 'world'    },
  infantryhall:  { label: '🗡️ Train',          train: true },
  archeryrange:  { label: '🏹 Train',          train: true },
  cavalrystable: { label: '🐴 Train',          train: true },
  siegeworkshop: { label: '🛠️ Train',          train: true },
};
