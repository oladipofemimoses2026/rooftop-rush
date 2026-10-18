// Screens, HUD, name tag, pop-ups and the leaderboard list. No game logic here.
import { CONFIG } from './config.js';
import { normaliseStyle } from './character.js';
import { guestMode } from './startng.js';

const $ = (id) => document.getElementById(id);

/**
 * handlers: onPlay, onResume, onPause, onRestart, onSignIn, onJump
 */
export function createUI(handlers) {
  const el = {
    start: $('screen-start'), pause: $('screen-pause'), over: $('screen-over'),
    hud: $('hud'), jump: $('btn-jump'),
    score: $('hud-score'), coins: $('hud-coins'),
    nametag: $('nametag'), popups: $('popups'),
    avatar: $('avatar'), playerName: $('player-name'), playerNote: $('player-note'),
    signInStart: $('btn-signin'), signInOver: $('btn-signin-over'),
    bestStart: $('best-start'),
    goScore: $('go-score'), goCoins: $('go-coins'), goBest: $('go-best'), goNew: $('go-new'),
    status: $('go-status'), board: $('go-board'),
    btnPlay: $('btn-play'), btnAgain: $('btn-again'), btnResume: $('btn-resume'),
  };

  const click = (id, fn) => $(id).addEventListener('click', (e) => { e.currentTarget.blur(); fn(); });
  click('btn-play', () => handlers.onPlay());
  click('btn-again', () => handlers.onPlay());
  click('btn-resume', () => handlers.onResume());
  click('btn-restart', () => handlers.onRestart());
  click('btn-pause', () => handlers.onPause());
  click('btn-signin', () => handlers.onSignIn());
  click('btn-signin-over', () => handlers.onSignIn());
  // pointerdown (not click) so the jump fires the instant a finger lands
  el.jump.addEventListener('pointerdown', (e) => { e.preventDefault(); handlers.onJump(); });

  function setMode(mode) { // 'start' | 'playing' | 'paused' | 'over'
    el.start.classList.toggle('hidden', mode !== 'start');
    el.pause.classList.toggle('hidden', mode !== 'paused');
    el.over.classList.toggle('hidden', mode !== 'over');
    el.hud.classList.toggle('hidden', mode !== 'playing' && mode !== 'paused');
    el.jump.classList.toggle('hidden', mode !== 'playing');
    if (mode === 'start') el.btnPlay.focus({ preventScroll: true });
    if (mode === 'paused') el.btnResume.focus({ preventScroll: true });
    if (mode === 'over') el.btnAgain.focus({ preventScroll: true });
  }

  function pulse(node) {
    const block = node.parentElement;
    block.classList.remove('pulse');
    void block.offsetWidth; // restart the animation
    block.classList.add('pulse');
  }
  function setScore(n) { el.score.textContent = n; }
  function setCoins(n) { el.coins.textContent = n; if (n > 0) pulse(el.coins); }
  function setBest(n) { el.bestStart.textContent = n; }

  function setPlayer(player) {
    const st = normaliseStyle(player.style);
    el.playerName.textContent = player.name;
    el.avatar.style.setProperty('--skin', st.skinColor);
    el.avatar.style.setProperty('--hair', st.hairColor);
    el.avatar.style.setProperty('--top', st.primaryColor);
    el.avatar.style.setProperty('--bottom', st.secondaryColor);
    el.nametag.textContent = player.name;
    const nag = !player.signedIn && !guestMode;
    el.signInStart.classList.toggle('hidden', !nag);
    el.signInOver.classList.toggle('hidden', !nag);
    el.playerNote.textContent = player.signedIn
      ? 'Signed in. Scores are saved.'
      : guestMode ? 'Guest run.'
      : player.online ? 'Guest. Sign in to save scores.' : 'Offline guest. Scores are not saved.';
  }

  function setNameTag(x, y, visible) {
    el.nametag.classList.toggle('hidden', !visible);
    if (visible) el.nametag.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
  }

  // A small ring of reusable pop-up elements, reused round-robin
  const popupEls = Array.from({ length: 10 }, () => {
    const d = document.createElement('div');
    d.className = 'popup';
    el.popups.append(d);
    return d;
  });
  let popupIndex = 0;
  function popup(text, x, y, kind = 'coin') {
    const d = popupEls[popupIndex++ % popupEls.length];
    d.className = 'popup';
    void d.offsetWidth; // restart the animation
    d.textContent = text;
    d.style.left = `${Math.round(x)}px`;
    d.style.top = `${Math.round(y)}px`;
    d.className = `popup show ${kind}`;
  }

  // ---- game over ----
  function showResult(result, best, isNewBest) {
    el.goScore.textContent = result.score;
    el.goCoins.textContent = result.coins;
    el.goBest.textContent = best;
    el.goNew.classList.toggle('hidden', !isNewBest);
  }
  function setStatus(text, kind = 'info') {
    el.status.textContent = text;
    el.status.className = `status ${kind}${text ? '' : ' hidden'}`;
  }
  function makeRow(cls, cells) {
    const li = document.createElement('li');
    li.className = `row ${cls}`;
    for (const c of cells) {
      const s = document.createElement('span');
      s.textContent = c;
      li.append(s);
    }
    return li;
  }
  function setBoardMessage(text) {
    el.board.replaceChildren();
    const li = document.createElement('li');
    li.className = 'row msg';
    li.textContent = text;
    el.board.append(li);
  }
  function renderBoard(rows, myId) {
    el.board.replaceChildren();
    el.board.append(makeRow('head', ['#', 'Player', ...CONFIG.stats.map((s) => s.label)]));
    for (const r of rows) {
      const mine = myId != null && r.playerId != null && String(r.playerId) === String(myId);
      el.board.append(makeRow(mine ? 'me' : '', [r.rank, r.name, ...CONFIG.stats.map((s) => r.values[s.key])]));
    }
  }

  return { setMode, setScore, setCoins, setBest, setPlayer, setNameTag, popup, showResult, setStatus, setBoardMessage, renderBoard };
}
