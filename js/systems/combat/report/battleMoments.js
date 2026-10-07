import { COMBAT_RULES } from '../../../entities/data/combatRules.js';
import { heroIcon, heroName, roundEvents, skillName, stackLabels, totalKills } from './battleText.js';

const { ROWS } = COMBAT_RULES;
const KIND_ORDER = ['bossWave', 'skill', 'heroKill', 'rowBroken', 'revive'];
const SIDE_PHRASE = { attacker: 'Your', defender: 'Enemy' };

const livingIn = (side, row) => side.rows[row].some((stack) => stack.count > 0);

function rowBrokenMoments(frames) {
  const moments = [];
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const frame = frames[index];
    for (const side of ['attacker', 'defender']) {
      if (side === 'defender' && previous.waveIndex !== frame.waveIndex) continue;
      for (const row of ROWS) {
        if (livingIn(previous.sides[side], row) && !livingIn(frame.sides[side], row)) {
          moments.push({ frameIndex: index, kind: 'rowBroken', text: `${SIDE_PHRASE[side]} ${row} line broken`, icon: '⚠' });
        }
      }
    }
  }
  return moments;
}

function bossMoments(report, timeline) {
  return timeline.waves
    .filter((wave) => wave.isBoss && report.waves[wave.index].rounds.length > 0)
    .map((wave) => ({ frameIndex: wave.firstFrame, kind: 'bossWave', text: `Boss wave: ${wave.name}`, icon: '☠' }));
}

function eventMoment(event, frameIndex, labels) {
  if (event.kind === 'heroStrike') {
    const kills = totalKills(event.hits);
    return kills > 0 ? { frameIndex, kind: 'heroKill', text: `${heroName(event.heroId)} slays ${kills}`, icon: heroIcon(event.heroId) } : null;
  }
  if (event.kind === 'skill') return { frameIndex, kind: 'skill', text: `${heroName(event.heroId)}: ${skillName(event.skillId)}`, icon: '✦' };
  if (event.kind === 'revive') return { frameIndex, kind: 'revive', text: `${labels[event.stackId] ?? event.stackId} rise again`, icon: '↺' };
  return null;
}

function eventMoments(report, frames) {
  const moments = [];
  for (const frame of frames.slice(1)) {
    const labels = stackLabels(frame);
    for (const event of roundEvents(report, frame)) {
      const moment = eventMoment(event, frame.index, labels);
      if (moment) moments.push(moment);
    }
  }
  return moments;
}

export function battleMoments(report, timeline) {
  const all = [...bossMoments(report, timeline), ...rowBrokenMoments(timeline.frames), ...eventMoments(report, timeline.frames)];
  return all
    .map((moment, order) => ({ moment, order }))
    .sort((a, b) => a.moment.frameIndex - b.moment.frameIndex
      || KIND_ORDER.indexOf(a.moment.kind) - KIND_ORDER.indexOf(b.moment.kind)
      || a.order - b.order)
    .map(({ moment }) => moment);
}

const attackerLoss = (frame) => Object.values(frame.sides.attacker.rows)
  .flat()
  .reduce((sum, stack) => sum + stack.delta.lost, 0);

const leadOf = (frame) => frame.sides.attacker.strengthPct - frame.sides.defender.strengthPct;

function biggestLossFrame(frames) {
  let best = 1;
  for (let index = 2; index < frames.length; index += 1) {
    if (attackerLoss(frames[index]) > attackerLoss(frames[best])) best = index;
  }
  return best;
}

export function turningPoint(report, timeline) {
  const { frames } = timeline;
  if (frames.length < 2) return 0;
  const holds = report.victory ? (lead) => lead >= 0 : (lead) => lead <= 0;
  let settled = frames.length;
  while (settled > 1 && holds(leadOf(frames[settled - 1]))) settled -= 1;
  return settled > 1 && settled < frames.length ? settled : biggestLossFrame(frames);
}
