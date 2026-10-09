const PARTNERS = ['barracks', 'infantryhall', 'archeryrange', 'cavalrystable', 'siegeworkshop', 'storehouse'];
const CHAIN_START = 10;
const HQ_MAX_CHAIN = 30;

const EXPLICIT = {
  3: { farm: 2 },
  4: { barracks: 3 },
  5: { infantryhall: 4 },
  6: { storehouse: 5 },
  7: { barracks: 6 },
  8: { archeryrange: 7 },
  9: { barracks: 8 },
};

export function hqChain() {
  const chain = { ...EXPLICIT };
  for (let level = CHAIN_START; level <= HQ_MAX_CHAIN; level++) {
    chain[level] = { workshop: level - 1, [PARTNERS[(level - CHAIN_START) % PARTNERS.length]]: level - 1 };
  }
  return chain;
}
