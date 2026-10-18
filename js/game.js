// Game loop, spawning, collisions, scoring and difficulty.
//
// Coordinates: the runner stays at x = 0. Everything else has a "world position" `wx` along the path;
// it is drawn at x = wx - dist, where `dist` is how far the runner has travelled.
// A roof spans wx in [start, end]. Obstacles and coins have a single wx.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRoof, createObstacle, createCoin, createPuff } from './world.js';
import { disposeCharacter } from './character.js';

const P = CONFIG.player;
const SPD = CONFIG.speed;
const R = CONFIG.roofs;
const G = CONFIG.gaps;
const O = CONFIG.obstacles;
const K = CONFIG.coins;
const J = CONFIG.juice;

const rand = (a, b) => a + Math.random() * (b - a);
const lerp2 = (pair, d) => pair[0] + (pair[1] - pair[0]) * d;

/**
 * hooks: onScore(n), onCoin(total), onMilestone(m), onJump(isDouble), onHit(cause), onGameOver(result)
 * States: ready | playing | paused | dying | over
 */
export function createGame(world, hooks = {}) {
  const scene = world.scene;

  let state = 'ready';
  let dist = 0, speed = SPD.start, time = 0;
  let coinCount = 0, lastScore = 0, nextMilestone = CONFIG.score.milestoneEvery;
  let nextStart = 0, coinSpin = 0;
  let deathTimer = 0, deathCause = '', knockX = 0;
  const p = { y: 0, vy: 0, grounded: true, coyote: 0, jumpsUsed: 0, buffer: 0, squash: 0, runDust: 0 };

  // ---- the runner: rig (moves/squashes) > pivot (tumbles about the body centre) > character ----
  const rig = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.position.y = 0.85;
  rig.add(pivot);
  scene.add(rig);
  let character = null;

  function setCharacter(group) {
    if (character) { pivot.remove(character); disposeCharacter(character); }
    character = group;
    group.position.y = -0.85;
    group.rotation.y = P.yaw;
    pivot.add(group);
  }

  // ---- pooled meshes: nothing is created while playing once the pools are warm ----
  const roofPool = [], coinPool = [], puffPool = [];
  const obstaclePool = { tank: [], dish: [], line: [] };
  const take = (pool, make) => {
    const o = pool.pop() || make();
    o.visible = true;
    if (!o.parent) scene.add(o);
    return o;
  };
  const give = (pool, o) => { o.visible = false; pool.push(o); };

  const roofs = [], obstacles = [], coins = [], puffs = [];

  // ---------------------------------------------------------------- generation
  const difficulty = () => Math.min(1, time / CONFIG.difficulty.rampSeconds);
  const airtime = () => (2 * P.jumpVelocity) / P.gravity;

  function addRoof(start, length) {
    const mesh = take(roofPool, createRoof);
    mesh.userData.setup(length);
    roofs.push({ start, end: start + length, mesh });
  }
  function addObstacle(kind, wx) {
    const mesh = take(obstaclePool[kind], () => createObstacle(kind));
    obstacles.push({ wx, kind, def: O.kinds[kind], mesh });
  }
  function addCoin(wx, y) {
    const mesh = take(coinPool, createCoin);
    mesh.position.y = y;
    coins.push({ wx, y, mesh, taken: false });
  }
  function addArc(centerWx) {              // coins in a hump, to be collected while jumping
    for (let i = 0; i < K.arcCount; i++) {
      const f = i / (K.arcCount - 1);
      addCoin(centerWx + (i - (K.arcCount - 1) / 2) * K.arcSpacing, K.rowHeight + (K.arcApex - K.rowHeight) * Math.sin(Math.PI * f));
    }
  }
  function addGapCoins(from, gap, wide) {  // coins over a gap show the player where to jump
    const apex = wide ? K.gapApexWide : K.gapApexSingle;
    for (let i = 0; i < K.gapCount; i++) {
      const f = (i + 1) / (K.gapCount + 1);
      addCoin(from + gap * f, K.gapBaseHeight + (apex - K.gapBaseHeight) * Math.sin(Math.PI * f));
    }
  }
  function pickKind(d) {
    let total = 0;
    for (const k in O.kinds) if (O.kinds[k].from <= d) total += O.kinds[k].weight;
    let r = Math.random() * total;
    for (const k in O.kinds) {
      if (O.kinds[k].from > d) continue;
      r -= O.kinds[k].weight;
      if (r <= 0) return k;
    }
    return 'tank';
  }

  // Obstacles and coins on one roof, keeping clear zones after landing and before the next gap.
  function populateRoof(start, end, wide, sp, single, d) {
    const landing = start + sp * O.landingBuffer * (wide ? 1.4 : 1) + O.edgePad;
    const limit = end - sp * O.takeoffBuffer - O.edgePad;
    const spacing = single * O.minSpacingFactor + O.spacingPad;
    const chance = lerp2(O.chance, d);
    let x = landing;
    while (x < limit) {
      if (Math.random() < chance) {
        addObstacle(pickKind(d), x);
        if (Math.random() < K.arcChance) addArc(x);
        x += spacing + Math.random() * O.spacingRandom;
      } else if (Math.random() < K.rowChance) {
        const n = Math.round(rand(K.rowCount[0], K.rowCount[1]));
        for (let i = 0; i < n; i++) if (x + i * K.rowSpacing < limit) addCoin(x + i * K.rowSpacing, K.rowHeight);
        x += n * K.rowSpacing + 2;
      } else {
        x += 5;
      }
    }
  }

  // Add the next roof. Gap sizes come from the single-jump distance at the current speed, so they are
  // always clearable: normal gaps with one jump, "wide" gaps (later on) with the double jump.
  function spawnRoof(gapOverride) {
    const d = difficulty();
    const sp = Math.max(speed, SPD.start);
    const single = sp * airtime();
    let gap, wide = false;
    if (gapOverride !== undefined) {
      gap = gapOverride;
    } else if (d >= G.wideStartsAt && Math.random() < lerp2(G.wideChance, d)) {
      wide = true;
      gap = single * rand(G.wideFracMin, G.wideFracMax);
    } else {
      gap = single * rand(lerp2(G.singleFracMin, d), lerp2(G.singleFracMax, d));
    }
    const start = nextStart + gap;
    const length = rand(R.minLength, R.maxLength) + sp * R.lengthPerSpeed;
    addRoof(start, length);
    if (gapOverride === undefined && Math.random() < K.gapChance) addGapCoins(nextStart, gap, wide);
    populateRoof(start, start + length, wide, sp, single, d);
    nextStart = start + length;
  }
  const fill = () => { while (nextStart < dist + R.spawnAhead) spawnRoof(); };

  // ---------------------------------------------------------------- lifecycle
  function clearWorld() {
    roofs.forEach((r) => give(roofPool, r.mesh));
    obstacles.forEach((o) => give(obstaclePool[o.kind], o.mesh));
    coins.forEach((c) => give(coinPool, c.mesh));
    puffs.forEach((pu) => give(puffPool, pu.mesh));
    roofs.length = obstacles.length = coins.length = puffs.length = 0;
  }

  function reset() {
    clearWorld();
    dist = 0; speed = SPD.start; time = 0;
    coinCount = 0; lastScore = 0; nextMilestone = CONFIG.score.milestoneEvery;
    deathTimer = 0; deathCause = ''; knockX = 0;
    Object.assign(p, { y: 0, vy: 0, grounded: true, coyote: 0, jumpsUsed: 0, buffer: 0, squash: 0, runDust: 0 });
    pivot.rotation.set(0, 0, 0);
    addRoof(-30, R.startLength);
    nextStart = -30 + R.startLength;
    spawnRoof(G.firstGap);
    fill();
    state = 'ready';
    syncPositions();
    applyRig();
  }

  function start() {
    reset();
    state = 'playing';
    hooks.onScore?.(0);
    hooks.onCoin?.(0);
  }
  const pause = () => { if (state === 'playing') state = 'paused'; };
  const resume = () => { if (state === 'paused') state = 'playing'; };
  const jump = () => { if (state === 'playing') p.buffer = P.jumpBuffer; };

  // ---------------------------------------------------------------- player
  const isSupported = () => {
    for (let i = 0; i < roofs.length; i++) {
      if (dist >= roofs[i].start - P.footReach && dist <= roofs[i].end + P.footReach) return true;
    }
    return false;
  };

  function doJump(isDouble) {
    p.vy = P.jumpVelocity * (isDouble ? P.doubleJumpFactor : 1);
    p.jumpsUsed++;
    p.grounded = false;
    p.coyote = 0;
    p.buffer = 0;
    p.squash = J.squashJump;
    if (isDouble) dustBurst(4, 0.4);
    hooks.onJump?.(isDouble);
  }

  function land() {
    p.y = 0; p.vy = 0; p.grounded = true; p.jumpsUsed = 0;
    p.squash = J.squashLand;
    dustBurst(J.landDust, 0);
  }

  function die(cause) {
    if (state !== 'playing') return;
    state = 'dying';
    deathCause = cause;
    deathTimer = 0;
    if (cause === 'hit') {
      p.vy = J.deathBounce;
      p.grounded = false;
      world.shake(J.shakeOnHit, J.shakeDuration);
      dustBurst(10, 0);
    } else {
      world.shake(J.shakeOnHit * 0.4, J.shakeDuration * 0.6);
    }
    hooks.onHit?.(cause);
  }

  function stepPlayer(dt) {
    if (p.buffer > 0) p.buffer -= dt;
    if (p.grounded) {
      p.coyote = P.coyoteTime;
      p.jumpsUsed = 0;
    } else {
      p.coyote -= dt;
      if (p.coyote <= 0 && p.jumpsUsed === 0) p.jumpsUsed = 1; // walked off: one air jump left
    }
    if (p.buffer > 0) {
      if (p.jumpsUsed === 0) doJump(false);
      else if (p.jumpsUsed < P.maxJumps) doJump(true);
    }

    if (!p.grounded) {
      p.vy -= P.gravity * dt;
      p.y += p.vy * dt;
    }
    const supported = isSupported();
    if (p.grounded) {
      if (!supported) { p.grounded = false; p.vy = 0; }         // ran off the edge
    } else if (p.vy <= 0 && p.y <= 0) {
      if (supported && p.y >= -P.ledgeCatch) land();             // made it (even if just short)
      else if (supported) { die('crash'); return; }              // came up under the roof edge
    }
    if (p.y < P.fallDeathY) { die('fall'); return; }

    if (p.grounded) {                                            // little dust trail while running
      p.runDust -= dt;
      if (p.runDust <= 0) { p.runDust = J.runDustEvery; spawnPuff(-0.3, 0.08, rand(-0.2, 0.2), -rand(0.5, 1.5), rand(0.3, 0.9), J.puffSize * 0.7); }
    }
  }

  function checkCollisions() {
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      const dx = o.wx - dist;
      if (dx > 3 || dx < -3) continue;
      if (Math.abs(dx) < o.def.halfDepth + P.hitRadius && p.y < o.def.h - P.hitForgive) {
        if (dx > 0) dist = o.wx - (o.def.halfDepth + P.hitRadius); // stop flush against it
        die('hit');
        return;
      }
    }
    for (let i = 0; i < coins.length; i++) {
      const c = coins[i];
      if (c.taken) continue;
      const dx = c.wx - dist;
      if (dx > K.collectDepth || dx < -K.collectDepth) continue;
      if (c.y >= p.y - 0.25 && c.y <= p.y + P.bodyHeight + 0.2) {
        c.taken = true;
        c.mesh.visible = false;
        coinCount++;
        hooks.onCoin?.(coinCount);
      }
    }
  }

  function cull() {
    const limit = dist - R.despawnBehind;
    for (let i = roofs.length - 1; i >= 0; i--) if (roofs[i].end < limit) { give(roofPool, roofs[i].mesh); roofs.splice(i, 1); }
    for (let i = obstacles.length - 1; i >= 0; i--) if (obstacles[i].wx < limit) { give(obstaclePool[obstacles[i].kind], obstacles[i].mesh); obstacles.splice(i, 1); }
    for (let i = coins.length - 1; i >= 0; i--) if (coins[i].wx < limit) { give(coinPool, coins[i].mesh); coins.splice(i, 1); }
  }

  function updateScore() {
    const s = Math.floor(dist * CONFIG.score.metersPerUnit);
    if (s === lastScore) return;
    lastScore = s;
    hooks.onScore?.(s);
    if (s >= nextMilestone) { hooks.onMilestone?.(nextMilestone); nextMilestone += CONFIG.score.milestoneEvery; }
  }

  // ---------------------------------------------------------------- states
  function stepPlaying(dt) {
    time += dt;
    speed = Math.min(SPD.max, SPD.start + SPD.accel * time);
    dist += speed * dt;
    fill();
    stepPlayer(dt);
    if (state !== 'playing') return;
    checkCollisions();
    cull();
    if (state === 'playing') updateScore();
  }

  function stepDying(dt) {
    deathTimer += dt;
    const hit = deathCause === 'hit';
    speed *= Math.exp(-(hit ? 25 : J.dyingSlow) * dt);
    dist += speed * dt;
    p.vy -= P.gravity * dt;
    p.y += p.vy * dt;
    if (hit) {
      knockX += (-1.8 - knockX) * (1 - Math.exp(-6 * dt));          // knocked back off the obstacle
      if (p.y <= 0 && p.vy <= 0) { p.y = 0; p.vy = 0; p.grounded = true; }
      const t = Math.min(deathTimer / 0.5, 1);
      pivot.rotation.z = (Math.PI / 2 + 0.1) * (1 - Math.pow(1 - t, 3)); // flops onto their back
    } else {
      pivot.rotation.z += dt * 3;                                    // tumbling down the gap
    }
    if (deathTimer >= J.gameOverDelay) {
      state = 'over';
      hooks.onGameOver?.({ score: lastScore, coins: coinCount, cause: deathCause });
    }
  }

  // ---------------------------------------------------------------- visuals
  function spawnPuff(x, y, z, vx, vy, size) {
    if (puffs.length >= J.maxPuffs) return;
    const mesh = take(puffPool, createPuff);
    mesh.position.set(x, y, z);
    puffs.push({ mesh, life: J.puffLife, max: J.puffLife, vx, vy, size });
  }
  function dustBurst(n, height) {
    for (let i = 0; i < n; i++) spawnPuff(rand(-0.5, 0.3), p.y + height + 0.05, rand(-0.4, 0.4), -rand(1, 4), rand(0.4, 1.8), J.puffSize);
  }
  function updatePuffs(dt) {
    const scroll = state === 'playing' || state === 'dying' ? speed : 0;
    for (let i = puffs.length - 1; i >= 0; i--) {
      const pu = puffs[i];
      pu.life -= dt;
      if (pu.life <= 0) { give(puffPool, pu.mesh); puffs.splice(i, 1); continue; }
      const k = pu.life / pu.max;
      pu.mesh.position.x += (pu.vx - scroll) * dt;
      pu.mesh.position.y += pu.vy * dt;
      pu.mesh.scale.setScalar(pu.size * (1 + (1 - k) * 1.6));
      pu.mesh.material.opacity = 0.7 * k;
    }
  }

  function syncPositions() {
    for (let i = 0; i < roofs.length; i++) roofs[i].mesh.position.x = roofs[i].start - dist;
    for (let i = 0; i < obstacles.length; i++) obstacles[i].mesh.position.x = obstacles[i].wx - dist;
    for (let i = 0; i < coins.length; i++) {
      coins[i].mesh.position.x = coins[i].wx - dist;
      coins[i].mesh.rotation.y = coinSpin;
    }
  }

  function applyRig() {
    rig.position.set(knockX, p.y, 0);
    const s = p.squash;
    rig.scale.set(1 + s * 0.5, 1 - s, 1 + s * 0.5);
  }

  function animationState() {
    if (state === 'playing') return p.grounded ? 'run' : 'air';
    if (state === 'dying' || state === 'over') return deathCause === 'hit' ? (p.grounded ? 'dead' : 'fall') : 'fall';
    return 'idle';
  }

  function update(dt) {
    if (state === 'paused') return;
    coinSpin += dt * K.spin;
    if (state === 'playing') stepPlaying(dt);
    else if (state === 'dying') stepDying(dt);
    p.squash *= Math.exp(-14 * dt);
    updatePuffs(dt);
    syncPositions();
    applyRig();
    character?.userData.animate?.(dt, animationState(), speed);
  }

  reset();

  return {
    update, start, reset, pause, resume, jump, setCharacter,
    get state() { return state; },
    get dist() { return dist; },
    get playerY() { return p.y; },
    isRunning: () => state === 'playing' || state === 'paused' || state === 'dying',
    headPosition: (out) => out.set(knockX, p.y + P.nameTagHeight, 0),
  };
}
