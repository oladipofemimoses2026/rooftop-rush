// Entry point: wires the world, game, UI and start.ng together.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createWorld } from './world.js';
import { createCharacter } from './character.js';
import { createGame } from './game.js';
import { createUI } from './ui.js';
import { FALLBACK_PLAYER, getPlayer, saveRun, getLeaderboard, signIn, guestMode } from './startng.js';

// ---- renderer (show a friendly message if WebGL is unavailable) ----
const canvas = document.getElementById('game');
let world;
try {
  world = createWorld(canvas);
} catch (err) {
  console.error(err);
  document.getElementById('fatal').classList.remove('hidden');
  throw err;
}

// ---- best score is stored on this device ----
function loadBest() {
  try { return Number(localStorage.getItem(CONFIG.storageKey)) || 0; } catch { return 0; }
}
function saveBest(n) {
  try { localStorage.setItem(CONFIG.storageKey, String(n)); } catch { /* storage can be blocked */ }
}

let best = loadBest();
let player = FALLBACK_PLAYER;
let styleKey = '';
let pending = null;   // a player update that arrived mid-run; applied between runs
let runId = 0;        // lets async game-over work notice that a new run has started
let overAt = 0;
const tmpV = new THREE.Vector3();
const tmpS = { x: 0, y: 0, visible: true };

const ui = createUI({
  onPlay: play,
  onResume: resume,
  onPause: pause,
  onRestart: play,
  onSignIn: signIn,
  onJump: () => game.jump(),
});

const game = createGame(world, {
  onScore: (s) => ui.setScore(s),
  onCoin: (n) => {
    ui.setCoins(n);
    if (n > 0) popupAtPlayer('+1', 'coin');
  },
  onMilestone: (m) => popupAtPlayer(`${m} m`, 'milestone'),
  onHit: () => navigator.vibrate?.(80),
  onGameOver: handleGameOver,
});

function popupAtPlayer(text, kind) {
  game.headPosition(tmpV);
  world.toScreen(tmpV, tmpS);
  ui.popup(text, tmpS.x, tmpS.y - 6, kind);
}

// ---------------------------------------------------------------- player (from start.ng)
function applyPlayer(p) {
  if (game.isRunning()) { pending = p; return; }   // never swap the character mid-run
  pending = null;
  player = p;
  ui.setPlayer(p);
  const key = JSON.stringify(p.style);
  if (key !== styleKey) {                           // rebuild only when the look actually changed
    styleKey = key;
    game.setCharacter(createCharacter(p.style));
  }
}
const applyPending = () => { if (pending) applyPlayer(pending); };

let refreshing = false;
let queued = false;
async function refreshPlayer() {
  if (refreshing) { queued = true; return; }
  refreshing = true;
  try {
    const p = await getPlayer();   // null when start.ng does not answer (e.g. local testing)
    if (p) applyPlayer(p);
  } finally {
    refreshing = false;
    if (queued) { queued = false; refreshPlayer(); }
  }
}

// ---------------------------------------------------------------- run flow
function play() {
  applyPending();
  runId++;
  ui.setMode('playing');
  game.start();
}
function pause() {
  if (game.state !== 'playing') return;
  game.pause();
  ui.setMode('paused');
}
function resume() {
  if (game.state !== 'paused') return;
  game.resume();
  ui.setMode('playing');
}

async function handleGameOver(result) {
  const id = runId;
  overAt = performance.now();
  applyPending();
  const isNewBest = result.score > best;
  if (isNewBest) { best = result.score; saveBest(best); }
  ui.setBest(best);
  ui.showResult(result, best, isNewBest);
  ui.setMode('over');
  ui.setBoardMessage('Loading the leaderboard...');

  const me = player;
  if (me.signedIn) {
    ui.setStatus('Saving your run...', 'info');
    const saved = await saveRun({ score: result.score, coins: result.coins });
    if (id !== runId) return;
    ui.setStatus(saved ? 'Run saved.' : 'Could not save this run. Check your connection.', saved ? 'ok' : 'warn');
  } else if (guestMode) {
    ui.setStatus('');
  } else if (!me.online) {
    ui.setStatus('Offline guest. Scores are not saved.', 'info');
  } else {
    ui.setStatus('Sign in to save your score.', 'info');
  }

  const rows = await getLeaderboard(10);
  if (id !== runId) return;
  if (rows === null) ui.setBoardMessage('The leaderboard is not available right now.');
  else if (rows.length === 0) ui.setBoardMessage('No scores yet. Be the first.');
  else ui.renderBoard(rows, me.id);
}

// ---------------------------------------------------------------- input
const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
addEventListener('keydown', (e) => {
  const isGameKey = JUMP_KEYS.has(e.code) || e.code === 'Enter' || e.code === 'Escape' || e.code === 'KeyP';
  if (isGameKey) e.preventDefault();
  if (e.repeat) return;

  if (JUMP_KEYS.has(e.code) || e.code === 'Enter') {
    if (game.state === 'playing') { if (e.code !== 'Enter') game.jump(); }
    else if (game.state === 'ready') play();
    else if (game.state === 'over' && performance.now() - overAt > 600) play();
    else if (game.state === 'paused') resume();
  } else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (game.state === 'playing') pause();
    else if (game.state === 'paused') resume();
  }
});

// Tap anywhere on the play field to jump (a swipe starts with a touch, so it jumps too).
canvas.addEventListener('pointerdown', (e) => {
  if (game.state !== 'playing') return;
  e.preventDefault();
  game.jump();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
  else refreshPlayer();   // the player may have signed in or out on start.ng
});
addEventListener('focus', refreshPlayer);
addEventListener('resize', () => world.resize());

// ---------------------------------------------------------------- frame loop
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05); // clamp so a long stall can't teleport the runner
  last = now;

  game.update(dt);
  world.update(dt, game.dist, game.playerY);

  const s = game.state;
  if (s === 'ready' || s === 'playing' || s === 'paused') {
    game.headPosition(tmpV);
    world.toScreen(tmpV, tmpS);
    ui.setNameTag(tmpS.x, tmpS.y, tmpS.visible);
  } else {
    ui.setNameTag(0, 0, false);
  }

  world.render();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- go
applyPlayer(FALLBACK_PLAYER);   // show the guest straight away; start.ng may answer later
ui.setBest(best);
ui.setMode('start');
refreshPlayer();
requestAnimationFrame(frame);
