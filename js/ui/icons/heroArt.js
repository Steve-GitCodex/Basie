const HERO_ART_MAP = {
  warlord:       { thumb: 'assets/heroes/warlord_thumb.png',       splash: 'assets/heroes/warlord_splash.png',       video: 'assets/heroes/warlord.mp4' },
  archsorceress: { thumb: 'assets/heroes/archsorceress_thumb.png', splash: 'assets/heroes/archsorceress_splash.png' },
  paladin:       { thumb: 'assets/heroes/paladin_thumb.png',       splash: 'assets/heroes/paladin_splash.png' },
  junovane:      { thumb: 'assets/heroes/junovane_thumb.png',      splash: 'assets/heroes/junovane_splash.png',      video: 'assets/heroes/junovane.mp4' },
  kaelenthorne:  { thumb: 'assets/heroes/kaelenthorne_thumb.png',  splash: 'assets/heroes/kaelenthorne_splash.png' },
  shadowblade:   { thumb: 'assets/heroes/shadowblade_thumb.png',   splash: 'assets/heroes/shadowblade_splash.png' },
};

export function heroArt(heroId) {
  return HERO_ART_MAP[heroId] ?? {};
}
