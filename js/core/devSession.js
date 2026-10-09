// @see docs/20-decisions/0014-dev-session-flag.md
// @see docs/20-decisions/0032-dev-dashboard-and-slots.md
import { sanitizeSlotName } from './devSlots.js';

const RES_KEYS = ['wood', 'stone', 'iron', 'food', 'water', 'money'];
const TICK_DT = 300;
export const DEV_GRANT = 5e8;
export const DEV_CAP = 2e9;

export function isDevSession() {
  return new URLSearchParams(location.search).has('dev');
}

export function devSlotName() {
  return sanitizeSlotName(new URLSearchParams(location.search).get('dev'));
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

export function applyDevCapFloors(rm) {
  rm.setCapFloors(Object.fromEntries(RES_KEYS.map(k => [k, DEV_CAP])));
}

function _flood(rm) {
  applyDevCapFloors(rm);
  for (const k of RES_KEYS) rm.setAmount(k, DEV_GRANT);
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

  const squad = um.createSquad('Squad 1', 'barracks_0');
  if (squad.success) um.assignToSquad(squad.squadId, 'infantry', 4, 1);
}
