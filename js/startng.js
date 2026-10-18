// The ONLY file that talks to start.ng. Everything else imports getPlayer / saveRun / getLeaderboard / signIn.
// When the game is opened locally, the connect page never answers, every call resolves to null,
// and the game falls back to a default guest player.
import { CONFIG } from './config.js';

// ---- helper provided by start.ng (kept exactly as written) ----
const START_NG = 'https://start.ng';
let frame;
function connectFrame() {
  frame ??= new Promise((resolve, reject) => {
    const el = document.createElement('iframe');
    el.src = `${START_NG}/connect`;
    el.hidden = true;
    el.onload = () => resolve(el);
    el.onerror = reject;
    document.body.append(el);
  });
  return frame;
}
export async function askStartNg(message, replyType, timeoutMs = 5000) {
  const el = await connectFrame();
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    const done = (reply) => { clearTimeout(timer); removeEventListener('message', onMessage); resolve(reply); };
    const timer = setTimeout(() => done(null), timeoutMs);
    function onMessage(e) {
      if (e.origin !== START_NG || e.source !== el.contentWindow) return;
      if (e.data?.type === replyType && e.data.requestId === requestId) done(e.data);
    }
    addEventListener('message', onMessage);
    el.contentWindow.postMessage({ ...message, requestId }, START_NG);
  });
}
// ---- end of provided helper ----

/** True when the URL has ?guest: we never nag that player to sign in. */
export const guestMode = new URLSearchParams(location.search).has('guest');

/** Used until (or unless) start.ng answers. */
export const FALLBACK_PLAYER = Object.freeze({
  id: null,
  name: 'Guest',
  style: CONFIG.character.fallbackStyle,
  signedIn: false,
  online: false,
});

// Never let a broken or blocked connection hang the game: resolve null after `ms`.
function guard(promise, ms) {
  return Promise.race([
    promise.catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/** Who is playing? Resolves to a player object, or null if start.ng did not answer. */
export async function getPlayer() {
  const reply = await guard(askStartNg({ type: 'startng:whoami' }, 'startng:user', 4000), 6000);
  if (!reply) return null;
  const p = reply.user ?? reply.guest; // signed in, or start.ng's guest
  if (!p) return null;
  return {
    id: reply.user?.id ?? null,
    name: String(p.name || 'Guest').slice(0, 24),
    style: p.style ?? {},
    signedIn: Boolean(reply.user),
    online: true,
  };
}

/** Save a finished run. Sends exactly the stats listed in startng.json. Resolves to true/false. */
export async function saveRun(values) {
  const stats = {};
  for (const { key } of CONFIG.stats) stats[key] = Math.max(0, Math.floor(Number(values[key]) || 0));
  const reply = await guard(askStartNg({ type: 'startng:score', stats }, 'startng:scoreSaved', 6000), 8000);
  return Boolean(reply) && reply.ok !== false && !reply.error;
}

/** Top `limit` rows as [{ rank, playerId, name, values: { score, coins } }], or null if unavailable. */
export async function getLeaderboard(limit = 10) {
  const reply = await guard(askStartNg({ type: 'startng:leaderboard', limit }, 'startng:leaderboardData', 6000), 8000);
  if (!reply) return null;
  return normaliseRows(reply);
}

// The exact reply shape is the one thing we could not verify offline, so rows are read defensively here.
// If start.ng's shape differs, fix it in this one function.
function normaliseRows(reply) {
  const list = reply.entries ?? reply.rows ?? reply.leaderboard ?? reply.board ?? reply.results ?? reply.data ?? [];
  if (!Array.isArray(list)) return [];
  return list.map((row, i) => {
    const source = row.stats ?? row;
    const values = {};
    for (const { key } of CONFIG.stats) values[key] = Number(source[key] ?? 0) || 0;
    return {
      rank: Number(row.rank) || i + 1,
      playerId: row.player_id ?? row.playerId ?? null,
      name: String(row.name ?? row.player_name ?? row.display_name ?? 'Player').slice(0, 24),
      values,
    };
  });
}

/** Send a guest to start.ng to sign in, then back to this game. */
export function signIn() {
  location.href = 'https://start.ng/?return_to=' + encodeURIComponent(location.origin + location.pathname);
}
