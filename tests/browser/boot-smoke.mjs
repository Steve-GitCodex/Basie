import { withPage, bootGuestSandbox, report } from './harness.mjs';

await withPage(async ({ page, errors, origin }) => {
  await bootGuestSandbox(page, origin);

  const state = await page.evaluate(() => {
    const canvas = document.querySelector('#city-canvas');
    const ctx = canvas?.getContext('2d');
    const pixels = ctx?.getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let i = 3; pixels && i < pixels.length; i += 4000) if (pixels[i] > 0) painted++;
    return {
      hasGame: !!window.game,
      managers: ['resources', 'buildings', 'worldMap', 'march'].filter(k => !!window.game?.[k]),
      baseViewActive: !document.querySelector('#view-base')?.classList.contains('hidden'),
      canvasSized: (canvas?.width ?? 0) > 0 && (canvas?.height ?? 0) > 0,
      painted,
      proxyLayer: !!document.querySelector('#city-proxy-layer'),
      buildingCount: window.game?.buildings?.getAllBuildingsWithStatus?.().length ?? 0,
    };
  });

  const resources = await page.evaluate(() => window.game.resources.getSnapshot());

  report('boot-smoke', [
    { label: 'window.game exposed', ok: state.hasGame },
    { label: 'core managers registered', ok: state.managers.length === 4 },
    { label: 'base view is active', ok: state.baseViewActive },
    { label: 'city canvas has a size', ok: state.canvasSized },
    { label: 'city canvas rendered pixels', ok: state.painted > 0 },
    { label: 'tutorial proxy layer present', ok: state.proxyLayer },
    { label: 'buildings seeded', ok: state.buildingCount > 0 },
    { label: 'resource state readable', ok: Object.keys(resources).length > 0 },
  ], errors);
});
