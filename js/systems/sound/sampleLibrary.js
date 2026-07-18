const AUDIO_BASE = 'assets/audio/';

export const CATEGORY_VOLUME = { ui: 0.4, combat: 0.55, reward: 0.5, fanfare: 0.5, voice: 0.75 };

const seq = (base, from, to, pad = 0) => {
  const out = [];
  for (let i = from; i <= to; i++) out.push(`${base}${pad ? String(i).padStart(pad, '0') : i}.ogg`);
  return out;
};

export const MANIFEST = {
  click:           { cat: 'ui',      files: seq('ui/click', 1, 5) },
  switch:          { cat: 'ui',      files: seq('ui/switch', 1, 8) },
  impact:          { cat: 'combat',  files: seq('combat/impactMetal_light_', 0, 4, 3) },
  battle:          { cat: 'combat',  files: ['effects/battle_mode.ogg'] },
  coin:            { cat: 'reward',  files: ['ui/dropLeather.ogg'] },
  complete:        { cat: 'combat',  files: seq('combat/impactMetal_medium_', 0, 4, 3) },
  achievement:     { cat: 'fanfare', files: seq('combat/impactBell_heavy_', 0, 4, 3) },
  defeat:          { cat: 'fanfare', files: ['effects/game_over.ogg'] },
  victory:         { cat: 'voice',   files: ['voice/male_congratulations.ogg', 'voice/female_congratulations.ogg'] },
  levelUp:         { cat: 'voice',   files: ['voice/male_level_up.ogg', 'voice/female_level_up.ogg'] },
  missionComplete: { cat: 'voice',   files: ['voice/male_mission_completed.ogg', 'voice/female_mission_completed.ogg'] },
  dispatch:        { cat: 'voice',   files: ['voice/war_go_go_go.ogg', 'voice/female_war_go_go_go.ogg', 'voice/war_target_engaged.ogg', 'voice/female_war_target_engaged.ogg', 'voice/war_watch_my_back.ogg'] },
};

export class SampleLibrary {
  constructor(ctx) {
    this._ctx = ctx;
    this._buffers = new Map();
  }

  warm(keys) {
    for (const key of keys) {
      const entry = MANIFEST[key];
      if (entry && !this._buffers.has(key)) this._load(key, entry);
    }
  }

  tryPlay(key) {
    if (!this._ctx) return false;
    const entry = MANIFEST[key];
    if (!entry) return false;
    const buffers = this._buffers.get(key);
    if (buffers === undefined) { this._load(key, entry); return false; }
    if (!buffers.length) return false;
    const buf = buffers[(Math.random() * buffers.length) | 0];
    this._playBuffer(buf, CATEGORY_VOLUME[entry.cat] ?? 0.5);
    return true;
  }

  async _load(key, entry) {
    if (this._buffers.has(key)) return;
    this._buffers.set(key, []);
    const decoded = [];
    await Promise.all(entry.files.map(async f => {
      try {
        const res = await fetch(AUDIO_BASE + f);
        const arr = await res.arrayBuffer();
        decoded.push(await this._ctx.decodeAudioData(arr));
      } catch { /* skip missing/undecodable variant */ }
    }));
    this._buffers.set(key, decoded);
  }

  _playBuffer(buf, volume) {
    try {
      if (this._ctx.state === 'suspended') this._ctx.resume();
      const src  = this._ctx.createBufferSource();
      const gain = this._ctx.createGain();
      src.buffer = buf;
      gain.gain.value = volume;
      src.connect(gain);
      gain.connect(this._ctx.destination);
      src.start();
    } catch { /* silent fail */ }
  }
}
