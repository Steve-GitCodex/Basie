import { withPage, report } from './harness.mjs';

await withPage(async ({ page, errors, origin }) => {
  // Seed a fake pre-existing real save so we can assert the dev session never
  // touches it (ephemeral contract, ADR 0014).
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  const SENTINEL = '{"sentinel":"real-save","gameMode":"campaign"}';
  await page.evaluate((s) => localStorage.setItem('basie_game_state', s), SENTINEL);

  await page.goto(`${origin}/index.html?dev`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 20_000 });
  await page.waitForTimeout(1500);

  const state = await page.evaluate((sentinel) => {
    const g = window.game;
    return {
      mode: g.engine.gameMode,
      hq: g.buildings.getHQLevel(),
      rally: g.buildings.getLevelOf('rallypoint'),
      squadUnits: g.units.getSquads()[0]?.units?.reduce((a, u) => a + u.count, 0) ?? 0,
      worldShown: !document.querySelector('#view-world')?.classList.contains('hidden'),
      realSaveIntact: localStorage.getItem('basie_game_state') === sentinel,
    };
  }, SENTINEL);

  report('dev-smoke', [
    { label: 'boots straight into sandbox mode', ok: state.mode === 'sandbox' },
    { label: 'HQ raised to Lv.3 (world unlock prereq)', ok: state.hq === 3 },
    { label: 'Rally Point built (world tab unlocked)', ok: state.rally >= 1 },
    { label: 'a march-ready squad exists', ok: state.squadUnits > 0 },
    { label: 'lands on the world map', ok: state.worldShown },
    { label: 'pre-existing real save left untouched', ok: state.realSaveIntact },
  ], errors);

  // Dev level switcher widget — inspect any placed building's sprite at any level.
  const switcherState = await page.evaluate(() => {
    const widget = document.querySelector('.dev-level-switcher');
    const buildingSelect = widget?.querySelector('[data-dev-building]');
    const levelSelect = widget?.querySelector('[data-dev-level]');
    const before = window.game.buildings.getLevelOf('townhall');
    buildingSelect.value = 'townhall';
    buildingSelect.dispatchEvent(new Event('change'));
    levelSelect.value = '2';
    levelSelect.dispatchEvent(new Event('change'));
    return {
      widgetPresent: !!widget,
      hasBuildingOptions: (buildingSelect?.options.length ?? 0) > 0,
      before,
      after: window.game.buildings.getLevelOf('townhall'),
    };
  });

  report('dev-level-switcher', [
    { label: 'widget renders in a dev session', ok: switcherState.widgetPresent },
    { label: 'building dropdown lists placed buildings', ok: switcherState.hasBuildingOptions },
    { label: 'was Lv.3 before forcing to Lv.2', ok: switcherState.before === 3 },
    { label: 'selecting a level forces the instance to it', ok: switcherState.after === 2 },
  ], errors);

  // Dev popup muter — story/achievement popups silenced by default in dev,
  // toggleable back on without losing rewards (ADR 0014 dev-session contract).
  const muterState = await page.evaluate(async () => {
    const g = window.game;
    const widget = document.querySelector('.dev-popup-muter');
    const fakeChapter = { id: '__test_chapter', title: 'Test Chapter', dialogue: [{ speaker: 'X', text: 'hi' }], rewards: { wood: 10 } };

    g.eventBus.emit('story:chapter_triggered', fakeChapter);
    const hiddenWhileMuted = document.getElementById('story-modal-overlay').classList.contains('hidden');

    const storyToggle = widget.querySelector('[data-dev-mute="story"]');
    storyToggle.checked = true;
    storyToggle.dispatchEvent(new Event('change'));
    g.eventBus.emit('story:chapter_triggered', fakeChapter);
    const shownWhenUnmuted = !document.getElementById('story-modal-overlay').classList.contains('hidden');
    document.getElementById('story-modal-overlay').classList.add('hidden'); // clean up for later tests

    const toastsBefore = document.querySelectorAll('.toast-title').length;
    g.eventBus.emit('achievement:unlocked', { id: '__test_ach', name: 'Test Achievement' });
    await new Promise(r => setTimeout(r, 100));
    const noToastWhileMuted = document.querySelectorAll('.toast-title').length === toastsBefore;

    g.eventBus.emit('quest:completed', { id: '__test_quest', name: 'Test Quest', description: 'x', rewards: { wood: 5 } });
    await new Promise(r => setTimeout(r, 100));
    const noQuestModalWhileMuted = document.getElementById('modal-overlay').classList.contains('hidden');
    const noQuestToastWhileMuted = document.querySelectorAll('.toast-title').length === toastsBefore;

    return {
      widgetPresent: !!widget,
      hiddenWhileMuted,
      shownWhenUnmuted,
      noToastWhileMuted,
      noQuestModalWhileMuted,
      noQuestToastWhileMuted,
    };
  });

  report('dev-popup-muter', [
    { label: 'widget renders in a dev session', ok: muterState.widgetPresent },
    { label: 'story modal silenced by default in dev', ok: muterState.hiddenWhileMuted },
    { label: 'toggling the checkbox unmutes it', ok: muterState.shownWhenUnmuted },
    { label: 'achievement toast silenced by default in dev', ok: muterState.noToastWhileMuted },
    { label: 'quest celebration modal silenced by default in dev', ok: muterState.noQuestModalWhileMuted },
    { label: 'quest toast silenced by default in dev', ok: muterState.noQuestToastWhileMuted },
  ], errors);

  // Dev anchor nudger — click-synced selection, per-sprite scale, override key.
  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'base'));
  await page.waitForFunction(() => !!window.game.city?._slots?.length, null, { timeout: 10_000 });
  const nudgeState = await page.evaluate(() => {
    const g = window.game, city = g.city, assets = city._assets;
    const widget = document.querySelector('.dev-anchor-nudger');
    // Clicking a building syncs the level-switcher dropdown (shared selection).
    g.eventBus.emit('dev:buildingSelected', { buildingId: 'townhall' });
    const switcherSynced =
      document.querySelector('.dev-level-switcher [data-dev-building]')?.value === 'townhall';

    const slot = city._slots.find(s => s.buildingId === 'townhall' && s.level > 0);
    const w0 = city._spriteBox(slot).width;
    assets.setDevAnchor('townhall', slot.level, { ax: 70, ay: 140, s: 1.5 });
    const w1 = city._spriteBox(slot).width;
    const scaled = Math.abs(w1 / w0 - 1.5) < 0.01;
    assets.clearDevAnchor('townhall', slot.level);
    const restored = Math.abs(city._spriteBox(slot).width - w0) < 0.01;

    const file = assets.variantFile('townhall', slot.level);
    return {
      widgetPresent: !!widget,
      switcherSynced,
      scaled,
      restored,
      fileOk: /^townhall_S\d\.png$/.test(file ?? ''),
    };
  });

  report('dev-anchor-nudger', [
    { label: 'widget renders in a dev session', ok: nudgeState.widgetPresent },
    { label: 'clicking a building syncs the level-switcher selection', ok: nudgeState.switcherSynced },
    { label: 'a dev scale multiplies the drawn sprite box', ok: nudgeState.scaled },
    { label: 'clearing the dev anchor restores the manifest box', ok: nudgeState.restored },
    { label: 'variantFile resolves the override-manifest key', ok: nudgeState.fileOk },
  ], errors);
});
