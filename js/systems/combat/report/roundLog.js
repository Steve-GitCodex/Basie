import { heroName, joinNames, roundEvents, stackLabels, totalKills } from './battleText.js';

const MAX_LINES = 3;

const slain = (kills) => (kills > 0 ? `${kills} slain` : 'no kills');
const unique = (values) => [...new Set(values)];
const counterNote = (mult) => (mult > 1 ? ` (counter ×${Number(mult.toFixed(2))})` : '');

function addGroup(groups, key, create) {
  if (!groups.has(key)) groups.set(key, create());
  return groups.get(key);
}

function heroSentences(events, labels) {
  const sentences = [];
  for (const event of events.filter((candidate) => candidate.kind === 'heroStrike')) {
    const byTarget = new Map();
    for (const hit of event.hits) {
      const label = labels[hit.targetId] ?? hit.targetId;
      byTarget.set(label, (byTarget.get(label) ?? 0) + hit.kills);
    }
    for (const [label, kills] of byTarget) sentences.push(`${heroName(event.heroId)} strikes the ${label}: ${slain(kills)}.`);
  }
  return sentences;
}

function ownStrikeSentences(events, labels) {
  const groups = new Map();
  for (const event of events.filter((candidate) => candidate.kind === 'strike' && candidate.side === 'attacker')) {
    for (const hit of event.hits) {
      const target = labels[hit.targetId] ?? hit.targetId;
      const group = addGroup(groups, target, () => ({ attackers: [], kills: 0, counter: 1 }));
      group.attackers.push(labels[event.fromId] ?? event.fromId);
      group.kills += hit.kills;
      group.counter = Math.max(group.counter, event.counterMult);
    }
  }
  return [...groups].map(([target, group]) => (
    `Your ${joinNames(unique(group.attackers))} hit the ${target}${counterNote(group.counter)}: ${slain(group.kills)}.`
  ));
}

function enemyStrikeSentences(events, labels) {
  const groups = new Map();
  for (const event of events.filter((candidate) => candidate.kind === 'strike' && candidate.side === 'defender')) {
    const group = addGroup(groups, event.row, () => ({ attackers: [], fallen: new Map() }));
    group.attackers.push(labels[event.fromId] ?? event.fromId);
    for (const hit of event.hits) {
      if (hit.kills <= 0) continue;
      const label = labels[hit.targetId] ?? hit.targetId;
      group.fallen.set(label, (group.fallen.get(label) ?? 0) + hit.kills);
    }
  }
  return [...groups].map(([row, group]) => {
    const total = [...group.fallen.values()].reduce((sum, count) => sum + count, 0);
    const breakdown = [...group.fallen].map(([label, count]) => `${count} ${label}`).join(', ');
    const outcome = total > 0 ? `${total} fallen (${breakdown})` : 'no losses';
    return `${joinNames(unique(group.attackers))} hit your ${row} row: ${outcome}.`;
  });
}

function healerNames(report, frame) {
  return (report.initial.defender[frame.waveIndex] ?? [])
    .filter((stack) => stack.ability?.kind === 'heal')
    .map((stack) => stack.name ?? stack.label);
}

function healSentences(events, labels, healers) {
  return unique(events.filter((event) => event.kind === 'heal').map((event) => event.stackId)).map((stackId) => {
    const target = labels[stackId] ?? stackId;
    return healers.length > 0 ? `${joinNames(healers)} heal the ${target}.` : `The ${target} heal.`;
  });
}

function reviveSentences(events, labels) {
  return events.filter((event) => event.kind === 'revive').map((event) => `${labels[event.stackId] ?? event.stackId} rise again.`);
}

const momentLine = (moments) => moments.map((moment) => `${moment.icon} ${moment.text}.`).join(' ');

export function roundLog(frame, report, moments = []) {
  if (frame.index === 0) return [];
  const events = roundEvents(report, frame);
  const labels = stackLabels(frame);
  const lines = [
    [...heroSentences(events, labels), ...ownStrikeSentences(events, labels)].join(' '),
    [
      ...enemyStrikeSentences(events, labels),
      ...healSentences(events, labels, healerNames(report, frame)),
      ...reviveSentences(events, labels),
    ].join(' '),
    momentLine(moments.filter((moment) => moment.frameIndex === frame.index)),
  ].filter((line) => line.length > 0);
  return (lines.length > 0 ? lines : [`Round ${frame.round} passes quietly.`]).slice(0, MAX_LINES);
}
