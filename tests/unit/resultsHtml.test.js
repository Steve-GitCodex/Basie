import test from 'node:test';
import assert from 'node:assert/strict';

import { resultsHtml } from '../../js/ui/combat/scene/resultsHtml.js';

const xp = (heroId, over = {}) => ({ heroId, xpGained: 150, levelBefore: 9, levelAfter: 9, xpPct: 47, unlockedSkills: [], ...over });

const victorySummary = (over = {}) => ({
  victory: true,
  stars: 2,
  starRules: [
    { text: 'Won', pass: true, actual: true },
    { text: 'Under 20% lost (9%)', pass: true, actual: 9 },
    { text: 'Won within 8 rounds (took 9)', pass: false, actual: 9 },
  ],
  layers: { sent: 300, back: 274, wounded: 10, dead: 16 },
  stacks: [
    { id: 'infantry_t2', label: 'Soldiers', row: 'front', sent: 120, dead: 12, wounded: 8, back: 100, kills: 0 },
    { id: 'ranged_t3', label: 'Sharp<shooters>', row: 'back', sent: 180, dead: 4, wounded: 2, back: 174, kills: 2 },
  ],
  heroes: [
    { heroId: 'warlord', slotIndex: 0, kills: 4, skillsFired: [{ skillId: 'charge', round: 1 }], xp: xp('warlord'), mvp: true },
    { heroId: 'shadowblade', slotIndex: 1, kills: 2, skillsFired: [], xp: xp('shadowblade', { levelAfter: 10, xpPct: 6, unlockedSkills: ['poison_blade'] }), mvp: false },
  ],
  emptySlots: [],
  ...over,
});

const defeatSummary = (over = {}) => victorySummary({
  victory: false,
  stars: 0,
  starRules: [],
  heroes: [{ heroId: 'warlord', slotIndex: 0, kills: 3, skillsFired: [{ skillId: 'charge', round: 1 }], xp: null, mvp: true }],
  ...over,
});

const analysis = [
  { cause: 'armor', text: 'Ironclads have defense 60.', fix: 'train', score: 0.7 },
  { cause: 'heroes', text: '1 commander slot empty.', fix: 'heroes', score: 0.5 },
];

const current = { wavesReached: 2, bossLeftPct: 40, waveName: 'Warboss' };
const count = (html, needle) => html.split(needle).length - 1;

test('victory markup lists each star rule with ✓/✗', () => {
  const html = resultsHtml({ summary: victorySummary(), title: 'Mutant Warband' });
  assert.match(html, /VICTORY/);
  assert.match(html, /results__rule--pass[^>]*>✓ Won</);
  assert.match(html, /results__rule--pass[^>]*>✓ Under 20% lost \(9%\)</);
  assert.match(html, /results__rule--fail[^>]*>✗ Won within 8 rounds \(took 9\)</);
  assert.match(html, /results__stars[^>]*>★★<i>★<\/i>/);
});

test('layers and per-stack rows', () => {
  const html = resultsHtml({ summary: victorySummary() });
  for (const [value, label] of [[300, 'SENT'], [274, 'CAME BACK'], [10, 'WOUNDED'], [16, 'DEAD']]) {
    assert.match(html, new RegExp(`<b>${value}</b><small>${label}</small>`));
  }
  assert.equal(count(html, 'class="results__stack-row"'), 2);
  assert.match(html, /Soldiers/);
  assert.match(html, /Sharp&lt;shooters&gt;/);
  assert.doesNotMatch(html, /Sharp<shooters>/);
});

test('MVP pill on one hero', () => {
  const html = resultsHtml({ summary: victorySummary() });
  assert.equal(count(html, 'results__mvp'), 1);
  assert.match(html, /results__hero results__hero--mvp" data-hero-id="warlord"/);
});

test('level-up callout names the unlocked skill', () => {
  const html = resultsHtml({ summary: victorySummary() });
  assert.match(html, /LEVEL UP 9 → 10/);
  assert.match(html, /new skill .*Poison Blade/);
  assert.equal(count(html, 'results__levelup'), 1);
});

test('xp bar starts at the before-progress and targets xpPct', () => {
  const html = resultsHtml({ summary: victorySummary(), heroMeta: { warlord: { xpFrom: 20 } } });
  assert.match(html, /style="width:20%" data-to="47"/);
  assert.match(html, /style="width:0%" data-to="6"/);
});

test('first-clear chip only when first clear, and it is the last reward', () => {
  const rewards = { money: 400, wood: 100, xp: 300 };
  const first = resultsHtml({ summary: victorySummary(), rewards, firstClearDiamonds: 20 });
  assert.equal(count(first, 'results__reward--rare'), 1);
  const chips = first.match(/class="results__reward[^"]*"/g);
  assert.equal(chips.at(-1), 'class="results__reward results__reward--rare"');
  assert.match(first, /First clear/);
  const repeat = resultsHtml({ summary: victorySummary(), rewards, firstClearDiamonds: 0 });
  assert.equal(count(repeat, 'results__reward--rare'), 0);
  assert.equal(count(repeat, 'class="results__reward"'), 3);
});

test("defeat shows 'Why you lost' with fix buttons data-fix", () => {
  const html = resultsHtml({ summary: defeatSummary(), analysis, reason: 'Round limit reached in wave 2' });
  assert.match(html, /DEFEAT/);
  assert.match(html, /results__why/);
  assert.match(html, /Why you lost/);
  assert.match(html, /Ironclads have defense 60\./);
  assert.match(html, /data-fix="train"/);
  assert.match(html, /data-fix="heroes"/);
  assert.match(html, /Round limit reached in wave 2/);
  assert.match(html, /id="btn-battle-turning-point"/);
  assert.doesNotMatch(html, /id="btn-battle-next"/);
  assert.match(html, /\+0/);
  assert.match(html, /Heroes only earn battle XP on a win\./);
  assert.doesNotMatch(html, /results__stars/);
});

test("comparison: 'Better than last try' when bossLeftPct dropped or wavesReached rose, 'Worse' otherwise, hidden with no previous", () => {
  const render = (previous) => resultsHtml({ summary: defeatSummary(), analysis, previous, current });
  const better = render({ wavesReached: 2, bossLeftPct: 64 });
  assert.match(better, /Better than last try/);
  assert.match(better, /Warboss left at 40%\. Last time: 64% in wave 2\./);
  assert.match(better, /▲/);
  assert.match(render({ wavesReached: 1, bossLeftPct: 10 }), /Better than last try/);
  const worse = render({ wavesReached: 2, bossLeftPct: 20 });
  assert.match(worse, /Worse than last try/);
  assert.match(worse, /▼/);
  assert.match(render({ wavesReached: 3, bossLeftPct: 90 }), /Worse than last try/);
  assert.match(render({ wavesReached: 2, bossLeftPct: 40 }), /Same as last try/);
  assert.doesNotMatch(render(null), /last try/);
  assert.doesNotMatch(resultsHtml({ summary: victorySummary(), previous: { wavesReached: 1, bossLeftPct: 90 }, current }), /last try/);
});

test('survival hides stars and Next', () => {
  const html = resultsHtml({
    summary: victorySummary({ stars: null, starRules: [] }), isSurvival: true, title: 'Survival Wave 3',
    next: { id: 'ch1_s2', name: 'Scav Runners II' },
    previous: { wavesReached: 1, bossLeftPct: 90 }, current,
  });
  assert.doesNotMatch(html, /results__stars/);
  assert.doesNotMatch(html, /results__grade/);
  assert.doesNotMatch(html, /btn-battle-next/);
  assert.doesNotMatch(html, /last try/);
  assert.match(html, /Survival Wave 3/);
  assert.match(html, /id="btn-battle-replay"/);
});

test('victory shows Next with the next stage name, Replay and Back to map', () => {
  const html = resultsHtml({ summary: victorySummary(), next: { id: 'ch2_s1', name: 'Raider <Scouts>' } });
  assert.match(html, /id="btn-battle-next" data-stage-id="ch2_s1"/);
  assert.match(html, /Next: Raider &lt;Scouts&gt; ›/);
  assert.match(html, /id="btn-battle-replay"/);
  assert.match(html, /id="btn-battle-close"/);
  assert.doesNotMatch(resultsHtml({ summary: victorySummary() }), /btn-battle-next/);
});

test('empty-slot tip names the slots and offers Assign', () => {
  const html = resultsHtml({ summary: victorySummary({ emptySlots: [2, 3] }) });
  assert.match(html, /Slots 3 and 4 had no commander/);
  assert.match(html, /results__tip[\s\S]*data-fix="heroes"[^>]*>Assign ›/);
  assert.doesNotMatch(resultsHtml({ summary: victorySummary() }), /results__tip/);
});

test('reduced loot adds a note', () => {
  const html = resultsHtml({ summary: victorySummary(), rewards: { money: 40 }, reducedReward: true });
  assert.match(html, /Reduced loot/);
});

test('turning-point button names its wave and round', () => {
  const html = resultsHtml({ summary: defeatSummary(), analysis, turningPoint: { frame: 9, neverLed: false, wave: 2, round: 7 } });
  assert.match(html, /id="btn-battle-turning-point">↻ Watch the turning point · Wave 2, Round 7</);
});

test('a capped hero says so instead of a bare +0', () => {
  const capped = victorySummary({ heroes: [{ heroId: 'warlord', slotIndex: 0, kills: 1, skillsFired: [], xp: xp('warlord', { xpGained: 0, xpPct: 100 }), mvp: true }] });
  assert.match(resultsHtml({ summary: capped }), /XP · level cap<\/span><b>\+0</);
  assert.doesNotMatch(resultsHtml({ summary: victorySummary() }), /level cap/);
});

test('same-as-last-try chip shows the boss health, not a 0% delta', () => {
  const html = resultsHtml({ summary: defeatSummary(), previous: { wavesReached: 2, bossLeftPct: 40 }, current });
  assert.match(html, /results__chip">= 40%</);
});

test('a never-led defeat offers Watch the fight instead of a turning point', () => {
  const html = resultsHtml({ summary: defeatSummary(), analysis, turningPoint: { frame: 0, neverLed: true } });
  assert.match(html, /id="btn-battle-turning-point">↻ Watch the fight</);
  assert.doesNotMatch(html, /turning point ·/);
});

test('no MVP pill on a defeat', () => {
  const html = resultsHtml({ summary: defeatSummary(), analysis });
  assert.doesNotMatch(html, /results__mvp/);
  assert.doesNotMatch(html, /results__hero--mvp/);
});

test('comparison hidden when the previous report was a victory or lacks wave data', () => {
  const render = (previous) => resultsHtml({ summary: defeatSummary(), analysis, previous, current });
  assert.doesNotMatch(render({ victory: true, wavesReached: 2, bossLeftPct: 64 }), /last try/);
  assert.doesNotMatch(render({ victory: false, bossLeftPct: 64 }), /last try/);
  assert.doesNotMatch(render({ victory: false, wavesReached: 2 }), /last try/);
  assert.match(render({ victory: false, wavesReached: 2, bossLeftPct: 64 }), /last try/);
});

test('post-battle healed troops are noted under the casualty layers', () => {
  assert.match(resultsHtml({ summary: victorySummary(), healedTotal: 7 }), /\+7 healed after the battle/);
  assert.doesNotMatch(resultsHtml({ summary: victorySummary(), healedTotal: 0 }), /healed after the battle/);
});
