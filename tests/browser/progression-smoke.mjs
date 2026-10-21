import { withPage, report, dismissOverlays, clearCitySectors } from './harness.mjs';

const MID_HQ = 9;
const MID_OPEN_CHAPTER = 5;
const MID_TIER = 4;

const waitGame = (page) => page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 20_000 });

const buildEverythingAtHq = (page, hq) => page.evaluate(async (targetHq) => {
  const { BUILDINGS_CONFIG } = await import('/js/entities/GAME_DATA.js');
  const { levelCap } = await import('/js/systems/building/buildingCurve.js');
  const { buildings: bm, eventBus } = window.game;
  const drain = () => { let guard = 50; while (bm.getBuildQueue().length > 0 && guard-- > 0) bm.update(300); };
  eventBus.emit('ui:devSetBuildingLevel', { buildingId: 'townhall', level: targetHq });
  const failures = new Map();
  for (let changed = true, round = 0; changed && round < 20; round++) {
    changed = false;
    for (const cfg of Object.values(BUILDINGS_CONFIG)) {
      const target = cfg.id === 'townhall' ? targetHq : levelCap(cfg, targetHq);
      for (let idx = 0; idx < (cfg.maxInstances ?? 1); idx++) {
        if (bm.getInstanceLevelOf(`${cfg.id}_${idx}`) === 0) {
          if (!bm.canBuild(cfg.id, idx).ok) continue;
          const built = bm.build(cfg.id, idx);
          drain();
          if (!built.success) { failures.set(`${cfg.id}_${idx}`, built.reason); continue; }
          failures.delete(`${cfg.id}_${idx}`);
        }
        if (bm.getInstanceLevelOf(`${cfg.id}_${idx}`) !== target) {
          eventBus.emit('ui:devSetBuildingLevel', { buildingId: cfg.id, level: target, instanceIndex: idx });
          changed = true;
        }
      }
    }
  }
  const problems = [...failures].map(([id, reason]) => `${id}: ${reason}`);
  for (const cfg of Object.values(BUILDINGS_CONFIG)) {
    const target = cfg.id === 'townhall' ? targetHq : levelCap(cfg, targetHq);
    for (let idx = 0; idx < (cfg.maxInstances ?? 1); idx++) {
      const level = bm.getInstanceLevelOf(`${cfg.id}_${idx}`);
      if (level === 0 && !failures.has(`${cfg.id}_${idx}`)) problems.push(`${cfg.id}_${idx}: not built (${bm.canBuild(cfg.id, idx).reason ?? 'unlocked'})`);
      else if (level !== 0 && level !== target) problems.push(`${cfg.id}_${idx}: L${level}, want L${target}`);
    }
  }
  return problems;
}, hq);

const setTechLevel = (page, techId, level) => page.evaluate(([id, lv]) => {
  window.game.tech.deserialize({ state: { [id]: { level: lv } } });
}, [techId, level]);

const trainResult = (page, tier) => page.evaluate((t) => window.game.units.train('infantry', 1, t), tier);

const chapterLock = (page, chapter) => page.evaluate((ch) => {
  const { campaign } = window.game;
  const stages = campaign.getStages();
  const bestStars = Object.fromEntries(stages.filter(s => s.chapter < ch).map(s => [s.id, 1]));
  campaign.deserialize({ bestStars });
  const first = stages.find(s => s.chapter === ch && s.kind !== 'elite');
  return campaign.getStageStates().get(first.id).lockReason;
}, chapter);

await withPage(async ({ page, errors, origin }) => {
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${origin}/index.html?dev=progressionsmoke`, { waitUntil: 'domcontentloaded' });
  await waitGame(page);
  await page.waitForTimeout(800);
  await dismissOverlays(page);
  await clearCitySectors(page);
  await page.evaluate(() => window.game.resources.setCapFloors({}));

  const data = await page.evaluate(async (midTier) => {
    const { HQ_MAX, ERA_HQ, CAMPAIGNS_CONFIG, UNITS_CONFIG, UNIT_TIER_REQUIREMENTS, BUILDINGS_CONFIG } = await import('/js/entities/GAME_DATA.js');
    const { levelCap } = await import('/js/systems/building/buildingCurve.js');
    const topTier = UNITS_CONFIG.infantry.tiers.length;
    const mastery = UNIT_TIER_REQUIREMENTS.infantry[topTier];
    return {
      HQ_MAX, ERA_HQ, topTier,
      chapters: CAMPAIGNS_CONFIG.length,
      heroQuartersCap: levelCap(BUILDINGS_CONFIG.heroquarters, HQ_MAX),
      masteryId: mastery.techRequired,
      masteryLevel: mastery.minTechLevel,
      nextTierMastery: UNIT_TIER_REQUIREMENTS.infantry[midTier + 1].minTechLevel,
      nextTierHall: UNIT_TIER_REQUIREMENTS.infantry[midTier + 1].minBuildingLevel,
      hallName: BUILDINGS_CONFIG[UNITS_CONFIG.infantry.buildingId].name,
    };
  }, MID_TIER);

  const checks = [];

  const topFailures = await buildEverythingAtHq(page, data.HQ_MAX);
  checks.push({ label: `every building instance reaches its cap at HQ ${data.HQ_MAX}`, ok: topFailures.length === 0, detail: topFailures });
  await page.waitForTimeout(300);

  const top = await page.evaluate(() => ({
    caps: Object.fromEntries(Object.entries(window.game.resources.getSnapshot()).map(([k, r]) => [k, r.cap])),
    marches: window.game.march.marchSlots(),
    heroCap: window.game.heroes.levelCap(),
    heroQuarters: window.game.buildings.getLevelOf('heroquarters'),
    attack: window.game.buildings.getHQBenefits().attackBonus,
  }));
  checks.push({ label: 'every resource has a storage cap > 0', ok: Object.values(top.caps).every(c => c > 0) });
  checks.push({ label: 'Rally Point at cap grants 5 marches', ok: top.marches === 5 });
  checks.push({ label: `Hero Quarters ${top.heroQuarters} raises the hero level cap to 100`, ok: top.heroQuarters === data.heroQuartersCap && top.heroCap === 100 });
  checks.push({ label: `HQ ${data.HQ_MAX} attack benefit ≈ 0.67`, ok: Math.abs(top.attack - 0.67) < 1e-3 });

  await setTechLevel(page, data.masteryId, data.masteryLevel);
  const topTrain = await trainResult(page, data.topTier);
  checks.push({ label: `infantry T${data.topTier} is trainable (${topTrain.reason ?? 'ok'})`, ok: topTrain.success });
  const lastLock = await chapterLock(page, data.chapters);
  checks.push({ label: `chapter ${data.chapters} is unlocked (${lastLock ?? 'open'})`, ok: lastLock === null });

  await buildEverythingAtHq(page, 10);
  await page.evaluate(() => {
    const emit = (buildingId, level) => window.game.eventBus.emit('ui:devSetBuildingLevel', { buildingId, level });
    emit('workshop', 9);
    emit('infantryhall', 9);
  });
  const hqGate = await page.evaluate(() => ({
    can: window.game.buildings.canUpgrade('townhall', 0).ok,
    missing: window.game.buildings.getMissingRequirements('townhall', 0),
  }));
  const names = await page.evaluate(async () => {
    const { BUILDINGS_CONFIG } = await import('/js/entities/GAME_DATA.js');
    return ['workshop', 'infantryhall'].map(id => BUILDINGS_CONFIG[id].shortName ?? BUILDINGS_CONFIG[id].name);
  });
  const listsBoth = names.every(n => hqGate.missing.some(m => m.includes(`${n} Lv.10`)));
  checks.push({ label: `HQ 10 → 11 blocked until Workshop 10 + Infantry Hall 10 (${hqGate.missing.join('; ')})`, ok: !hqGate.can && listsBoth });

  const midFailures = await buildEverythingAtHq(page, MID_HQ);
  checks.push({ label: `every building instance sets to its cap at HQ ${MID_HQ}`, ok: midFailures.length === 0, detail: midFailures });
  await setTechLevel(page, data.masteryId, data.nextTierMastery);
  const midTrain = await trainResult(page, MID_TIER);
  checks.push({ label: `HQ ${MID_HQ}: infantry T${MID_TIER} trainable with mastery (${midTrain.reason ?? 'ok'})`, ok: midTrain.success });
  const nextTrain = await trainResult(page, MID_TIER + 1);
  checks.push({ label: `HQ ${MID_HQ}: infantry T${MID_TIER + 1} is gated by the hall level, mastery met (${nextTrain.reason})`, ok: !nextTrain.success && (nextTrain.reason ?? '').startsWith(`Requires ${data.hallName} Lv.${data.nextTierHall} `) });
  const openLock = await chapterLock(page, MID_OPEN_CHAPTER);
  checks.push({ label: `HQ ${MID_HQ}: chapter ${MID_OPEN_CHAPTER} is open (${openLock ?? 'open'})`, ok: openLock === null });
  const nextLock = await chapterLock(page, MID_OPEN_CHAPTER + 1);
  checks.push({ label: `HQ ${MID_HQ}: chapter ${MID_OPEN_CHAPTER + 1} is locked by its HQ gate (${nextLock})`, ok: new RegExp(`^Requires: .*Lv\\.${data.ERA_HQ[MID_OPEN_CHAPTER]}\\b`).test(nextLock ?? '') });

  for (const c of checks) if (!c.ok && c.detail?.length) console.error(`    ${c.detail.join('\n    ')}`);
  report('progression-smoke', checks, errors);
});
