/**
 * devSession.js
 * One-shot developer boot preset, activated by the `?dev` query flag. It skips the
 * auth screen, tutorial, and new-game modal, then drives the real manager APIs to
 * a state that unlocks the World map (HQ Lv.3 + Rally Point) so the map can be
 * eyeballed without a from-scratch playthrough.
 *
 * A dev session is ephemeral: main.js never persists it, so the player's real
 * localStorage save is untouched. Everything here uses public manager methods and
 * drains sandbox build/train queues synchronously via manual update() ticks — no
 * hand-crafted save state, so it can never drift from the serialize format.
 *
 * @see docs/20-decisions/0014-dev-session-flag.md
 */
const RES_KEYS = ['wood', 'stone', 'iron', 'food', 'water', 'money'];
const TICK_DT = 300;

export function isDevSession() {
  return new URLSearchParams(location.search).has('dev');
}

export function runDevSession({ engine, userManager, resourceManager, buildingManager, unitManager, eventBus, logManager }) {
  const log = (msg) => logManager?.log?.('dev', msg, 'info');

  engine.setGameMode('sandbox');
  userManager.completeTutorial();

  _raiseBuilding(buildingManager, resourceManager, 'townhall', 3);
  _raiseBuilding(buildingManager, resourceManager, 'rallypoint', 1);

  try {
    _raiseBuilding(buildingManager, resourceManager, 'barracks', 1);
    _raiseBuilding(buildingManager, resourceManager, 'infantryhall', 1);
    _trainAndSquad(unitManager, buildingManager);
  } catch (e) {
    log(`military preset skipped: ${e?.message ?? e}`);
  }

  eventBus.emit('ui:navigateTo', 'world');
  log(`dev session ready — world unlocked, HQ Lv.${buildingManager.getHQLevel()}`);
}

function _flood(rm) {
  for (const k of RES_KEYS) rm.setCap(k, 1e9);
  rm.add(Object.fromEntries(RES_KEYS.map(k => [k, 1e7])));
}

function _drainBuilds(bm) {
  let guard = 200;
  while (bm.getBuildQueue().length > 0 && guard-- > 0) bm.update(TICK_DT);
}

function _raiseBuilding(bm, rm, id, targetLevel) {
  let guard = 60;
  while (bm.getLevelOf(id) < targetLevel && guard-- > 0) {
    _flood(rm);
    const r = bm.build(id);
    if (!r.success) throw new Error(`build ${id}: ${r.reason}`);
    _drainBuilds(bm);
  }
}

function _trainAndSquad(um, bm) {
  const trained = um.train('infantry', 4, 1);
  if (!trained.success) throw new Error(`train infantry: ${trained.reason}`);
  let guard = 100;
  while (um.getTrainingQueueDepthForBuilding('infantryhall') > 0 && guard-- > 0) um.update(TICK_DT);

  const squad = um.createSquad('Dev Squad');
  if (squad.success) um.assignToSquad(squad.squadId, 'infantry', 4, 1);
}
