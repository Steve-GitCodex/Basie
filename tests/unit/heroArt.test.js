import test from 'node:test';
import assert from 'node:assert/strict';

import { heroArt } from '../../js/ui/icons/heroArt.js';
import { HEROES_CONFIG } from '../../js/entities/GAME_DATA.js';

test('heroArt returns thumb and splash paths for every hero in the roster', () => {
  for (const id of Object.keys(HEROES_CONFIG)) {
    const art = heroArt(id);
    assert.ok(art.thumb, `${id} has no thumb path`);
    assert.ok(art.splash, `${id} has no splash path`);
  }
});

test('only the two heroes with clips expose a video path', () => {
  assert.ok(heroArt('warlord').video, 'Marcus Kestrel has a clip');
  assert.ok(heroArt('junovane').video, 'Juno Vane has a clip');
  assert.equal(heroArt('paladin').video, undefined);
  assert.equal(heroArt('kaelenthorne').video, undefined);
});

test('an unknown hero id returns an empty object, never throws', () => {
  assert.deepEqual(heroArt('nope'), {});
  assert.deepEqual(heroArt(undefined), {});
});

test('art paths point under assets/ and are never derived from source filenames', () => {
  const art = heroArt('shadowblade');
  assert.ok(art.thumb.startsWith('assets/'));
  assert.ok(!art.thumb.includes(' '), 'output paths carry no spaces even though sources do');
});
