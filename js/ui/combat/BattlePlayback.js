const ROWS = ['front', 'mid', 'back'];
const WAVE_PAUSE_MS = 900;
const ROUND_PAUSE_MS = 700;
const SPRITE_HIT_MS = 350;
const SPRITE_LUNGE_MS = 200;

function buildRowBars(sideEl) {
  const wrap = document.createElement('div');
  wrap.className = 'battle-row-bars';
  const fills = {};
  for (const row of ROWS) {
    const bar = document.createElement('div');
    bar.className = `battle-row-bar battle-row-bar--${row}`;
    bar.title = row;
    const fill = document.createElement('div');
    fill.className = 'battle-row-fill';
    fill.style.width = '100%';
    bar.appendChild(fill);
    wrap.appendChild(bar);
    fills[row] = fill;
  }
  sideEl.appendChild(wrap);
  return fills;
}

export class BattlePlayback {
  constructor(els, sound) {
    this._els = els;
    this._sound = sound;
    this._rowFills = {
      attacker: buildRowBars(els.playerSprite.parentElement),
      defender: buildRowBars(els.enemySprite.parentElement),
    };
  }

  addLine(text, cls = '') {
    const feed = this._els.feed;
    if (!feed) return;
    const line = document.createElement('div');
    line.className = `battle-line ${cls}`;
    line.textContent = text;
    feed.appendChild(line);
    feed.scrollTop = feed.scrollHeight;
  }

  async play(steps, { isSkipped }) {
    const sleep = (ms) => (isSkipped() ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));
    for (const step of steps) {
      if (isSkipped()) return;
      if (step.kind === 'wave') {
        this._showWave(step);
        await sleep(WAVE_PAUSE_MS);
      } else if (step.kind === 'round') {
        this._showRound(step);
        await sleep(ROUND_PAUSE_MS);
      }
    }
  }

  _showWave({ index, total, name }) {
    const counter = this._els.waveCounter;
    if (counter) {
      counter.style.display = 'block';
      counter.textContent = `Wave ${index + 1} / ${total}`;
    }
    this._els.enemyBar.style.width = '100%';
    for (const fill of Object.values(this._rowFills.defender)) this._setRow(fill, 100);
    this.addLine(`── Wave ${index + 1}: ${name} ──`, 'turn');
  }

  _showRound(step) {
    this._els.playerBar.style.width = `${step.attackerPct}%`;
    this._els.enemyBar.style.width = `${step.defenderPct}%`;
    for (const side of ['attacker', 'defender']) {
      for (const row of ROWS) this._setRow(this._rowFills[side][row], step.rows[side][row]);
    }
    this._sound?.hit();
    this._lunge(this._els.playerSprite, 'sprite-attack-player', this._els.enemySprite);
    this._lunge(this._els.enemySprite, 'sprite-attack-enemy', this._els.playerSprite);
    for (const hit of step.heroHits) {
      this.addLine(`Hero strikes for ${Math.round(hit.damage)}${hit.kills ? ` (${hit.kills} slain)` : ''}`, 'heal');
    }
    this.addLine(`You fell ${step.kills.byAttacker} foes · lost ${step.kills.byDefender}`, step.kills.byDefender > 0 ? 'hit' : '');
  }

  _setRow(fill, pct) {
    fill.parentElement.style.display = pct === null ? 'none' : '';
    if (pct !== null) fill.style.width = `${pct}%`;
  }

  _lunge(attacker, lungeClass, target) {
    attacker.classList.add(lungeClass);
    setTimeout(() => {
      attacker.classList.remove(lungeClass);
      target.classList.add('sprite-hit');
      setTimeout(() => target.classList.remove('sprite-hit'), SPRITE_HIT_MS);
    }, SPRITE_LUNGE_MS);
  }
}
