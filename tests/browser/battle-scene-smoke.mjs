import { withPage, report } from './harness.mjs';

import { STAGE, deploy, isVisible, roundLabel, seedSquad, waitGame } from './battleSceneSteps.mjs';

await withPage(async ({ page, errors, origin }) => {
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${origin}/index.html?dev=battlescene`, { waitUntil: 'domcontentloaded' });
  await waitGame(page);
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('#bq-sidebar')?.classList.add('is-collapsed'));
  const squadId = await seedSquad(page);
  await page.evaluate(() => window.game.campaign.deserialize({ bestStars: { ch1_s1: 3, ch1_s2: 3, ch1_s3: 3, ch1_s4: 3 } }));

  const opened = await deploy(page);
  const layer = await page.evaluate(() => {
    const scene = document.getElementById('battle-scene');
    if (!scene) return { z: null, coversNav: false };
    const dock = document.getElementById('floating-dock')?.getBoundingClientRect();
    const hit = dock && document.elementFromPoint(dock.left + dock.width / 2, dock.top + dock.height / 2);
    return { z: getComputedStyle(scene).zIndex, coversNav: !!hit && scene.contains(hit) };
  });
  const arenaGone = await page.locator('#battle-arena').count() === 0;
  if (!opened) {
    report('battle-scene-playback', [
      { label: 'deploy opens #battle-scene', ok: false },
      { label: `scene sits on z-index 500 above the nav (${layer.z})`, ok: false },
      { label: 'old modal ids are gone (#battle-arena absent)', ok: arenaGone },
    ], errors);
    return;
  }

  await page.locator('#btn-battle-play').click();
  const pausedGlyph = (await page.locator('#btn-battle-play').textContent()).trim();
  await page.locator('.timeline__wave-marker').first().click();
  const atStart = await roundLabel(page);
  await page.locator('#btn-battle-step-fwd').click();
  const afterFwd = await roundLabel(page);
  await page.locator('#btn-battle-step-back').click();
  const afterBack = await roundLabel(page);

  const markers = await page.locator('.timeline__wave-marker').count();
  await page.locator('.timeline__wave-marker').nth(1).click();
  const waveTwo = await roundLabel(page);

  await page.locator('.timeline__wave-marker').first().click();
  await page.evaluate(() => {
    document.querySelector('.bf-stack').dataset.probe = 'kept';
    document.querySelector('.bf__side--defender .bf-stack').dataset.probe = 'kept';
  });
  const countBefore = await page.locator('.bf-stack .bf-stack__count').first().textContent();
  await page.locator('#btn-battle-step-fwd').click();
  const defenderPatched = await page.evaluate(() => document.querySelector('.bf__side--defender .bf-stack')?.dataset.probe === 'kept');
  const sameWave = (await roundLabel(page)).startsWith('WAVE 1 /');
  for (let i = 0; i < 2; i += 1) await page.locator('#btn-battle-step-fwd').click();
  const patched = await page.evaluate(() => document.querySelector('.bf-stack')?.dataset.probe === 'kept');
  const label3 = await roundLabel(page);

  await page.locator('#btn-battle-skip').click();
  const resultsAfterSkip = await isVisible(page, '#battle-results');
  const closeBtn = await page.locator('#btn-battle-close').count();
  await page.locator('#btn-battle-close').click();
  const closedByButton = await page.evaluate(() => document.getElementById('battle-scene').classList.contains('hidden'));

  report('battle-scene-playback', [
    { label: 'squad seeded', ok: !!squadId },
    { label: 'deploy opens #battle-scene', ok: opened },
    { label: `scene sits on z-index 500 above the nav (${layer.z})`, ok: layer.z === '500' && layer.coversNav },
    { label: 'old modal ids are gone (#battle-arena absent)', ok: arenaGone },
    { label: `play toggles to paused (${pausedGlyph})`, ok: pausedGlyph === '▶' },
    { label: `#btn-battle-step-fwd advances #battle-round-label (${atStart} → ${afterFwd})`, ok: atStart === 'WAVE 1 / 2 · ROUND 1' && afterFwd === 'WAVE 1 / 2 · ROUND 2' },
    { label: `#btn-battle-step-back goes back (${afterBack})`, ok: afterBack === atStart },
    { label: `clicking a wave marker shows that wave (${markers} markers, ${waveTwo})`, ok: markers === 2 && /^WAVE 2 \/ 2 · ROUND \d+$/.test(waveTwo) },
    { label: `stack cards patch in place across frames (${countBefore} … ${label3})`, ok: patched && label3 !== atStart },
    { label: 'defender stack cards patch in place within a wave', ok: defenderPatched && sameWave },
    { label: '#btn-battle-skip shows #battle-results', ok: resultsAfterSkip && closeBtn === 1 },
    { label: '#btn-battle-close closes the scene', ok: closedByButton },
  ], errors);

  const logBefore = await page.evaluate(() => window.game.combat.getBattleLog().length);
  const reopened = await deploy(page, { keyboard: true });
  const focusInScene = await page.evaluate(() => document.getElementById('battle-scene').contains(document.activeElement));
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const logAfter = await page.evaluate(() => window.game.combat.getBattleLog().length);
  const resultsBeforeEsc = await isVisible(page, '#battle-results');
  await page.keyboard.press('Escape');
  const resultsAfterEsc = await isVisible(page, '#battle-results');
  const stillOpen = await page.evaluate(() => !document.getElementById('battle-scene').classList.contains('hidden'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const closed = await page.evaluate(() => document.getElementById('battle-scene').classList.contains('hidden'));
  const focusRestored = await page.evaluate(() => document.activeElement?.id === 'btn-campaign-attack');
  const node = await page.evaluate((id) => document.querySelector(`.campaign-node[data-stage-id="${id}"]`)?.classList.contains('completed'), STAGE);

  report('battle-scene-escape', [
    { label: 'keyboard deploy reopens the scene', ok: reopened },
    { label: 'focus moves into the scene on open', ok: focusInScene },
    { label: `Space/Enter during playback do not attack again (${logBefore} → ${logAfter})`, ok: logAfter === logBefore + 1 },
    { label: `escape during playback shows results (${resultsBeforeEsc}/${resultsAfterEsc}/${stillOpen})`, ok: !resultsBeforeEsc && resultsAfterEsc && stillOpen },
    { label: 'second escape closes the scene', ok: closed },
    { label: 'closing restores focus to Deploy', ok: focusRestored },
    { label: 'the trail node is completed', ok: node === true },
  ], errors);

  page.setDefaultTimeout(4000);
  const heroSeeded = await page.evaluate((id) => {
    const heroes = window.game.heroes;
    const barracksId = heroes.barracksIdForSquad(id);
    if (!heroes.isOwned('warlord')) heroes.recruitHeroRecord('warlord');
    const record = heroes._owned.get('warlord');
    if (!record) return false;
    record.level = 10;
    heroes.assignHeroToBuilding('warlord', barracksId, 0);
    return heroes.getRosterWithState().find(h => h.id === 'warlord')?.assignment?.buildingId === barracksId;
  }, squadId);
  const heroOpened = await deploy(page);
  if (await page.locator('#btn-battle-play').textContent() === '⏸') await page.locator('#btn-battle-play').click();
  await page.locator('.timeline__wave-marker').first().click();
  await page.locator('#btn-battle-step-back').click();

  const heroCards = await page.locator('.hero-bar__card:not(.hero-bar__card--support)').count();
  const killsAt = () => page.locator('.hero-bar__card:not(.hero-bar__card--support) .hero-bar__kills b').first().textContent().catch(() => null);
  const skillStates = () => page.evaluate(() => [...document.querySelectorAll('.hero-bar__skill')]
    .map(el => `${el.dataset.skillId}:${['is-ready', 'is-firing', 'is-used'].find(c => el.classList.contains(c)) ?? '?'}`));
  const visibleCount = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)]
    .filter(el => el.offsetParent !== null && getComputedStyle(el).display !== 'none' && el.textContent.trim() !== '').length, sel);
  const svgShown = () => page.evaluate(() => {
    const svg = document.querySelector('.bf__arrows');
    return !!svg && getComputedStyle(svg).display !== 'none';
  });
  const pressed = (name) => page.locator(`.scene-toggles__btn[data-toggle="${name}"]`).getAttribute('aria-pressed').catch(() => null);

  const killsStart = await killsAt();
  await page.locator('#btn-battle-step-fwd').click();
  const skillsFrame1 = await skillStates();
  const arrowPaths = await page.evaluate(() => [...document.querySelectorAll('.bf__arrows path.bf__arrow')]
    .filter(p => p.style.display !== 'none' && p.getAttribute('d')).length);
  const floatsOn = await visibleCount('.bf-float');
  const logLines = await visibleCount('.round-log__line');
  await page.locator('#btn-battle-step-fwd').click();
  const skillsFrame2 = await skillStates();
  const firingSkill = skillsFrame1.find(s => s.endsWith(':is-firing'))?.split(':')[0];
  const killTrail = [killsStart];
  for (let i = 0; i < 40; i += 1) {
    await page.locator('#btn-battle-step-fwd').click();
    killTrail.push(await killsAt());
  }
  const killNums = killTrail.map(Number);
  const killsGrow = killNums.every((n, i) => i === 0 || n >= killNums[i - 1]) && killNums[killNums.length - 1] > 0;

  await page.locator('.timeline__wave-marker').first().click();
  await page.locator('#btn-battle-step-fwd').click();
  await page.locator('.scene-toggles__btn[data-toggle="numbers"]').click();
  const floatsOff = await visibleCount('.bf-float');
  await page.locator('#btn-battle-step-fwd').click();
  const floatsOffNext = await visibleCount('.bf-float');
  await page.locator('.scene-toggles__btn[data-toggle="numbers"]').click();

  await page.locator('.scene-toggles__btn[data-toggle="log"]').click();
  const logHidden = !(await isVisible(page, '.battle-scene__log'));
  await page.locator('.scene-toggles__btn[data-toggle="log"]').click();

  const svgBefore = await svgShown();
  await page.locator('.scene-toggles__btn[data-toggle="arrows"]').click();
  const svgAfter = await svgShown();
  const stored = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('basie_battle_toggles')); } catch { return null; } });

  const momentMarks = await page.locator('.timeline__moment').count();
  if (momentMarks) await page.locator('.timeline__moment').first().click();
  const bannerShown = momentMarks > 0 && await isVisible(page, '.bf__moment');
  const bannerText = bannerShown ? (await page.locator('.bf__moment-title').textContent()).trim() : '';

  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const reopenedWithToggle = await deploy(page);
  const arrowsPressedAfterReopen = await pressed('arrows');
  const svgAfterReopen = await svgShown();
  await page.locator('.scene-toggles__btn[data-toggle="arrows"]').click();
  const svgRestored = await svgShown();

  report('battle-scene-playback-layers', [
    { label: 'warlord seeded into the squad barracks slot 0', ok: heroSeeded },
    { label: 'deploy with a hero opens the scene', ok: heroOpened },
    { label: `hero bar shows one card per squad hero and updates kills when stepping (${heroCards}; ${killTrail.join(',')})`, ok: heroCards === 1 && killsStart === '0' && killsGrow },
    { label: `a skill icon is 'firing' on its event frame then 'used' (${skillsFrame1.join(' ')} → ${skillsFrame2.join(' ')})`, ok: !!firingSkill && skillsFrame2.includes(`${firingSkill}:is-used`) },
    { label: `arrows draw on a strike frame (${arrowPaths} paths)`, ok: arrowPaths > 0 },
    { label: `arrows toggle hides the SVG layer (${svgBefore} → ${svgAfter}, stored ${JSON.stringify(stored)})`, ok: svgBefore && !svgAfter && stored?.arrows === false },
    { label: `arrows toggle persists across reopen (${reopenedWithToggle}, aria-pressed ${arrowsPressedAfterReopen}, svg ${svgAfterReopen})`, ok: reopenedWithToggle && arrowsPressedAfterReopen === 'false' && !svgAfterReopen && svgRestored },
    { label: `numbers toggle hides floats (${floatsOn} → ${floatsOff}/${floatsOffNext})`, ok: floatsOn > 0 && floatsOff === 0 && floatsOffNext === 0 },
    { label: `log shows round lines; log toggle hides it (${logLines} lines, hidden ${logHidden})`, ok: logLines >= 1 && logHidden },
    { label: `a moment banner appears on a moment frame (${momentMarks} marks, "${bannerText}")`, ok: bannerShown && bannerText.length > 0 },
  ], errors);

  const topUp = (n = 60) => page.evaluate(({ id, n }) => {
    const um = window.game.units;
    um._reserve.set('infantry_t1', (um._reserve.get('infantry_t1') ?? 0) + n);
    um.assignToSquad(id, 'infantry', n, 1, 0);
    um.linkSlotUnit(id, 0, 'infantry');
  }, { id: squadId, n });
  const tap = async (sel) => { if (await page.locator(sel).count()) await page.locator(sel).first().click(); };
  const skip = async () => { if (await isVisible(page, '#btn-battle-skip')) await page.locator('#btn-battle-skip').click(); };
  const sceneClosed = () => page.evaluate(() => document.getElementById('battle-scene').classList.contains('hidden'));
  await page.evaluate(() => {
    window.__resultsShown = [];
    window.game.eventBus.on('battle:resultsShown', d => window.__resultsShown.push(d));
  });

  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await topUp();
  const shownBeforeDeploy = await page.evaluate(() => window.__resultsShown.length);
  const victoryOpened = await deploy(page);
  await page.evaluate(async () => {
    const { devMute } = await import('/js/core/devMute.js');
    if (devMute.isMuted('story')) devMute.toggle('story');
  });
  await page.evaluate(() => window.game.eventBus.emit('story:chapter_triggered', {
    id: 'smoke_story', title: 'Smoke', dialogue: [{ speaker: 'Scout', text: 'Hold.' }], rewards: {},
  }));
  const storyHiddenDuringScene = await page.evaluate(() => document.getElementById('story-modal-overlay').classList.contains('hidden'));
  const soundsBeforeResults = await page.evaluate(() => window.__resultsShown.length);
  await skip();
  const victoryShown = await page.evaluate(() => {
    const q = (s) => document.querySelector(`#battle-results ${s}`);
    return {
      stars: !!q('.results__stars'),
      rules: document.querySelectorAll('#battle-results .results__rule').length,
      layers: document.querySelectorAll('#battle-results .results__layers > div').length,
      xpRows: document.querySelectorAll('#battle-results .results__xp').length,
      rewards: document.querySelectorAll('#battle-results .results__reward').length,
      next: q('#btn-battle-next')?.textContent.trim() ?? null,
      events: window.__resultsShown.slice(),
      banner: !!document.querySelector('.victory-banner'),
    };
  });
  await page.waitForTimeout(1200);
  const xpBar = await page.evaluate(() => {
    const bar = document.querySelector('#battle-results .results__xpbar i');
    return bar ? { width: bar.style.width, to: bar.dataset.to } : null;
  });

  await tap('#btn-battle-replay');
  const replayLabel = await roundLabel(page);
  const replayPlaying = (await page.locator('#btn-battle-play').textContent()).trim() === '⏸';
  const resultsHiddenOnReplay = !(await isVisible(page, '#battle-results'));
  await skip();
  await tap('#btn-battle-next');
  await page.waitForTimeout(300);
  const nextPanel = await page.evaluate(() => {
    const panel = document.getElementById('campaign-stage-panel');
    return { open: panel?.getAttribute('aria-hidden') === 'false', text: panel?.textContent ?? '' };
  });
  const closedByNext = await sceneClosed();
  const storyShownAfterClose = await page.evaluate(() => !document.getElementById('story-modal-overlay').classList.contains('hidden'));
  await page.evaluate(async () => {
    document.querySelector('#story-btn-skip')?.click();
    const { devMute } = await import('/js/core/devMute.js');
    if (!devMute.isMuted('story')) devMute.toggle('story');
  });

  report('battle-scene-results-victory', [
    { label: 'deploy opens the scene for a victory', ok: victoryOpened },
    { label: `victory results show stars and star rules (${victoryShown.stars}, ${victoryShown.rules} rules)`, ok: victoryShown.stars && victoryShown.rules === 3 },
    { label: `victory results show casualty layers (${victoryShown.layers})`, ok: victoryShown.layers === 4 },
    { label: `victory results show an XP row (${victoryShown.xpRows})`, ok: victoryShown.xpRows >= 1 },
    { label: `xp bar animates to its target (${JSON.stringify(xpBar)})`, ok: !!xpBar && xpBar.width === `${xpBar.to}%` },
    { label: `rewards are listed (${victoryShown.rewards})`, ok: victoryShown.rewards > 0 },
    { label: `battle:resultsShown fires once on results, not at deploy (${shownBeforeDeploy} → ${soundsBeforeResults} → ${victoryShown.events.length})`, ok: soundsBeforeResults === shownBeforeDeploy && victoryShown.events.length === shownBeforeDeploy + 1 && victoryShown.events.at(-1).victory === true },
    { label: 'the old victory banner is gone', ok: !victoryShown.banner },
    { label: `#btn-battle-replay restarts at round 1 and plays (${replayLabel}, playing ${replayPlaying})`, ok: /^WAVE 1 \/ \d+ · ROUND [01]$/.test(replayLabel) && replayPlaying && resultsHiddenOnReplay },
    { label: `#btn-battle-next closes the scene and opens the next stage panel (${victoryShown.next})`, ok: closedByNext && nextPanel.open && /Raider Ambush I/.test(nextPanel.text) && /Raider Ambush I/.test(victoryShown.next ?? '') },
    { label: `a story beat waits behind the scene (hidden ${storyHiddenDuringScene}, shown after close ${storyShownAfterClose})`, ok: storyHiddenDuringScene && storyShownAfterClose },
  ], errors);

  const titanReady = await page.evaluate((id) => {
    const campaign = window.game.campaign;
    campaign._getBuildingLevel = () => 30;
    const bestStars = {};
    for (const stage of campaign.getStages()) if (stage.id !== 'chaos_titan') bestStars[stage.id] = 3;
    campaign.deserialize({ bestStars });
    window.game.eventBus.emit('campaign:updated');
    return campaign.getStageStates().get('chaos_titan')?.isAvailable === true && !!window.game.units.getSquad(id);
  }, squadId);
  await topUp(20);
  const defeatOpened = await deploy(page, { stage: 'chaos_titan' });
  await skip();
  const defeatShown = await page.evaluate(() => ({
    why: !!document.querySelector('#battle-results .results__why'),
    fixes: [...document.querySelectorAll('#battle-results [data-fix]')].map(b => b.dataset.fix),
    stars: !!document.querySelector('#battle-results .results__stars'),
    next: !!document.querySelector('#btn-battle-next'),
    turning: document.querySelector('#btn-battle-turning-point')?.textContent.trim() ?? '',
    mvp: document.querySelectorAll('#battle-results .results__mvp').length,
    zeroXp: /\+0/.test(document.querySelector('#battle-results .results__heroes')?.textContent ?? ''),
    lastEvent: window.__resultsShown.at(-1),
  }));
  const tp = defeatShown.turning.match(/Wave (\d+), Round (\d+)$/);
  const watchFight = defeatShown.turning === '↻ Watch the fight';
  await tap('#btn-battle-turning-point');
  const tpLabel = await roundLabel(page);
  const tpPaused = (await page.locator('#btn-battle-play').textContent()).trim() === '▶';
  const tpOnPlayback = !(await isVisible(page, '#battle-results'));
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.game.heroes.unassignHero('warlord'));
  const lastTry = () => page.evaluate(() => window.game.campaign.getProgress('chaos_titan').lastReport);
  const before = await lastTry();
  await topUp(20);
  const retryOpened = await deploy(page, { stage: 'chaos_titan' });
  await skip();
  const after = await lastTry();
  const expectedVerdict = !before || !after ? null
    : after.wavesReached !== before.wavesReached ? (after.wavesReached > before.wavesReached ? 'Better' : 'Worse')
      : after.bossLeftPct !== before.bossLeftPct ? (after.bossLeftPct < before.bossLeftPct ? 'Better' : 'Worse') : 'Same';
  const retry = await page.evaluate(() => ({
    fixes: [...document.querySelectorAll('#battle-results [data-fix]')].map(b => b.dataset.fix),
    tip: !!document.querySelector('#battle-results .results__tip'),
    cmp: document.querySelector('#battle-results .results__cmp b')?.textContent ?? '',
  }));
  const fix = retry.fixes.includes('heroes') ? 'heroes' : null;
  if (fix) await tap(`#battle-results [data-fix="${fix}"]`);
  await page.waitForTimeout(400);
  const fixClosed = await sceneClosed();
  const heroesVisible = await isVisible(page, '#view-heroes');

  report('battle-scene-results-defeat', [
    { label: `chaos_titan unlocked for the forced defeat `, ok: titanReady },
    { label: 'deploy opens the scene vs chaos_titan', ok: defeatOpened },
    { label: `defeat shows .results__why with fixes (${defeatShown.fixes.join(',')})`, ok: defeatShown.why && defeatShown.fixes.length > 0 },
    { label: 'defeat hides stars and Next', ok: !defeatShown.stars && !defeatShown.next },
    { label: 'defeat heroes show +0 XP', ok: defeatShown.zeroXp },
    { label: `battle:resultsShown reports the defeat (${JSON.stringify(defeatShown.lastEvent)})`, ok: defeatShown.lastEvent?.victory === false },
    { label: `#btn-battle-turning-point lands on its round (${defeatShown.turning} → ${tpLabel}, paused ${tpPaused})`, ok: (watchFight ? /^WAVE 1 \/ \d+ · ROUND 0$/.test(tpLabel) : !!tp && tpLabel.startsWith(`WAVE ${tp[1]} /`) && tpLabel.endsWith(`ROUND ${tp[2]}`)) && tpPaused && tpOnPlayback },
    { label: `defeat cards carry no MVP pill`, ok: defeatShown.mvp === 0 },
    { label: `a retry with no commander shows the empty-slot tip and the comparison (${retryOpened}, tip ${retry.tip}, "${retry.cmp}")`, ok: retryOpened && retry.tip && !!expectedVerdict && retry.cmp === `${expectedVerdict} ${expectedVerdict === 'Same' ? 'as' : 'than'} last try` },
    { label: `a heroes fix button closes the scene and shows #view-heroes (${fix})`, ok: !!fix && fixClosed && heroesVisible },
  ], errors);

  if (!(await sceneClosed())) await page.keyboard.press('Escape');
  await topUp();
  await page.evaluate(() => window.game.eventBus.emit('game:modeChanged', { mode: 'survival' }));
  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'combat'));
  await page.locator('.combat-tabs [data-tab="survival"]').click();
  await page.locator('#btn-survival-fight').click();
  await page.waitForTimeout(300);
  if (await page.locator('#btn-warn-proceed').count()) await page.locator('#btn-warn-proceed').click();
  const survivalOpened = await page.waitForSelector('#battle-scene:not(.hidden)', { timeout: 5000 }).then(() => true, () => false);
  if (survivalOpened) await skip();
  const survival = await page.evaluate(() => ({
    stars: !!document.querySelector('#battle-results .results__stars'),
    next: !!document.querySelector('#btn-battle-next'),
    cmp: !!document.querySelector('#battle-results .results__cmp'),
    text: document.querySelector('#battle-results')?.textContent ?? '',
  }));
  await page.keyboard.press('Escape');

  report('battle-scene-results-survival', [
    { label: 'survival fight opens the scene', ok: survivalOpened },
    { label: 'survival results hide stars, comparison and Next', ok: survivalOpened && !survival.stars && !survival.next && !survival.cmp },
    { label: 'survival results name the wave', ok: /Survival Wave \d+/.test(survival.text) },
  ], errors);
});
