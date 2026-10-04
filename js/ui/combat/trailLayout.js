const GAP = 64;
const CHAPTER_GAP = 90;
const START = 90;
const FIRST_BAND = 40;
const BOTTOM_PAD = 60;
const SIDE_MARGIN = 110;
const BOSS_SWING = 0.35;
const BOSS_GAP_MULT = 1.3;
const ELITE_OFFSET = 70;
const SINE_STEP = 1.1;

function clamp(value, max) {
  return Math.min(max, Math.max(0, value));
}

function catmullRomPath(points) {
  if (points.length < 2) return '';
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    d += ` C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6} ${p2.x},${p2.y}`;
  }
  return d;
}

export function trailLayout(stages, { width }) {
  const roadStages = stages.filter(stage => stage.kind !== 'elite');
  const eliteStages = stages.filter(stage => stage.kind === 'elite');

  let a = START;
  const bandOffsets = [{ chapter: roadStages[0]?.chapter, at: FIRST_BAND }];
  const placed = roadStages.map((stage, i) => {
    if (i && stage.chapter !== roadStages[i - 1].chapter) {
      a += CHAPTER_GAP / 2;
      bandOffsets.push({ chapter: stage.chapter, at: a });
      a += CHAPTER_GAP / 2;
    }
    const isBoss = stage.kind === 'boss';
    const swing = (width / 2 - SIDE_MARGIN) * (isBoss ? BOSS_SWING : 1);
    const entry = { stage, a, x: clamp(width / 2 + Math.sin(i * SINE_STEP) * swing, width) };
    a += isBoss ? GAP * BOSS_GAP_MULT : GAP;
    return entry;
  });

  const height = a + BOTTOM_PAD;
  const roadNodes = placed.map(({ stage, a: at, x }) => ({
    id: stage.id, kind: stage.kind, chapter: stage.chapter, x, y: height - at
  }));
  const bands = bandOffsets.map(({ chapter, at }) => ({ chapter, y: height - at }));

  const eliteNodes = [];
  const spurs = [];
  eliteStages.forEach(stage => {
    const boss = roadNodes.find(node => node.kind === 'boss' && node.chapter === stage.chapter);
    if (!boss) return;
    const x = clamp(boss.x < width / 2 ? boss.x + ELITE_OFFSET : boss.x - ELITE_OFFSET, width);
    eliteNodes.push({ id: stage.id, kind: stage.kind, chapter: stage.chapter, x, y: boss.y });
    spurs.push({ eliteId: stage.id, bossId: boss.id, d: `M${boss.x},${boss.y} L${x},${boss.y}` });
  });

  const roadById = new Map(roadNodes.map(node => [node.id, node]));
  const pathThrough = ids => catmullRomPath(ids.map(id => roadById.get(id)).filter(Boolean));

  return { height, nodes: [...roadNodes, ...eliteNodes], bands, spurs, pathThrough };
}
