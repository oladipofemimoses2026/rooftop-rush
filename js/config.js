// Every tunable number lives here. Units: 1 unit is roughly 1 metre, time is in seconds.
// The world is built along the X axis: the runner stays at x = 0 and the world scrolls toward -X.
export const CONFIG = {
  gameName: 'rooftop-rush',
  storageKey: 'rooftop-rush:best',

  // Must match the keys in /startng.json. Values are saved as whole numbers.
  stats: [
    { key: 'score', label: 'Distance' },
    { key: 'coins', label: 'Coins' },
  ],

  render: { maxPixelRatio: 1.5, shadowMapSize: 1024 },

  // Used for guests, and for any style field start.ng does not send.
  character: {
    fallbackStyle: {
      body: 'female',
      primaryColor: '#ff6a5b',
      secondaryColor: '#3b4a8a',
      skinColor: '#a8704a',
      hairColor: '#1f1410',
      hair: 'braids',
      hat: 'none',
      accessory: 'none',
    },
  },

  player: {
    jumpVelocity: 11.5,       // peak height ~1.95, airtime ~0.68 s
    doubleJumpFactor: 0.9,    // the mid-air jump is slightly weaker
    gravity: 34,
    maxJumps: 2,              // 2 = one extra jump in mid-air
    coyoteTime: 0.09,         // can still jump this long after leaving a roof
    jumpBuffer: 0.12,         // a press this early before landing still counts
    footReach: 0.25,          // feet still count as on the roof this far past its edge
    ledgeCatch: 0.35,         // how far below roof level you can still scramble up
    fallDeathY: -1.2,
    hitRadius: 0.28,          // half-width of the runner when testing obstacles
    hitForgive: 0.1,          // obstacles count as this much shorter
    bodyHeight: 1.7,
    yaw: Math.PI / 2 - 0.45,  // faces +X, turned slightly toward the camera so the face shows
    nameTagHeight: 2.35,
  },

  speed: { start: 12, max: 24, accel: 0.17 },   // units/s, units/s^2
  difficulty: { rampSeconds: 120 },              // 0..1 over this many seconds

  roofs: {
    depth: 8,
    thickness: 40,
    minLength: 24,
    maxLength: 46,
    lengthPerSpeed: 0.6,     // extra roof length per unit of speed
    startLength: 70,
    spawnAhead: 170,
    despawnBehind: 30,
  },

  // Gap sizes are fractions of the single-jump distance (speed x airtime).
  // [easy, hard] pairs are blended by difficulty.
  gaps: {
    firstGap: 4,
    singleFracMin: [0.25, 0.45],
    singleFracMax: [0.45, 0.72],
    wideChance: [0, 0.3],
    wideStartsAt: 0.25,       // difficulty at which double-jump gaps start
    wideFracMin: 1.15,
    wideFracMax: 1.35,
  },

  obstacles: {
    chance: [0.5, 0.9],
    landingBuffer: 0.7,       // seconds of travel kept clear after a landing
    takeoffBuffer: 0.8,       // seconds of travel kept clear before a gap
    edgePad: 2,
    minSpacingFactor: 0.9,    // of single-jump distance
    spacingPad: 3,
    spacingRandom: 6,
    kinds: {
      tank: { h: 1.4, halfDepth: 0.7, weight: 0.4, from: 0 },
      dish: { h: 1.0, halfDepth: 0.5, weight: 0.35, from: 0 },
      line: { h: 1.3, halfDepth: 1.2, weight: 0.25, from: 0.2 },
    },
  },

  coins: {
    collectDepth: 0.8,
    spin: 3.2,
    rowChance: 0.45,
    rowCount: [4, 7],
    rowSpacing: 1.6,
    rowHeight: 1.0,
    arcChance: 0.8,
    arcCount: 5,
    arcSpacing: 1.1,
    arcApex: 2.5,
    gapChance: 0.8,
    gapCount: 5,
    gapBaseHeight: 0.9,
    gapApexSingle: 2.2,
    gapApexWide: 2.9,
  },

  score: { metersPerUnit: 0.6, milestoneEvery: 250 },

  camera: {
    fov: 56,
    near: 0.5,
    far: 700,
    look: [4.5, 1.6, 0],
    offset: [-2, 2.6, 13],        // camera position relative to the look target
    followY: 0.3,
    followSmooth: 6,
    sway: 0.15,
    portraitRef: 0.95,            // aspect ratios below this zoom out
    maxZoom: 2.4,
    portraitFovBoost: 5,
    portraitLookShift: 0.4,
  },

  juice: {
    shakeOnHit: 0.55,
    shakeDuration: 0.5,
    landDust: 6,
    runDustEvery: 0.2,
    puffLife: 0.5,
    puffSize: 0.28,
    maxPuffs: 40,
    squashLand: 0.22,
    squashJump: -0.16,
    deathBounce: 7,
    dyingSlow: 6,
    gameOverDelay: 1.0,
  },

  colors: {
    fog: '#f3a46f',
    sky: [[0, '#ffd9a0'], [0.18, '#ffb26b'], [0.5, '#f2757a'], [1, '#5b3a7a']],   // horizon to zenith
    sun: '#fff0b8',
    hemiSky: '#ffd6b0',
    hemiGround: '#9a5a44',
    sunLight: '#ffd9a8',
    roofBody: ['#d98c5f', '#c9724a', '#e8b48a', '#b85c3e', '#d9a066'],
    roofTop: '#f3d3a8',
    parapet: '#fff0dc',
    edge: '#ffe28a',
    trim: '#8c4a3a',
    windowDark: '#3a2233',
    windowLit: '#ffb15a',
    decor: ['#b9a79a', '#9aa7a8', '#c98f6f'],
    skyline: ['#8e4a6b', '#a85a6a', '#7a3f6a', '#b9677a'],
    cloud: '#ffd2ac',
    coin: '#ffc933',
    coinGlow: '#7a5200',
    tank: '#6b8b99',
    tankBand: '#4a6371',
    tankRoof: '#8a5a46',
    tankLeg: '#5a3a2e',
    dish: '#f6f0e4',
    metal: '#8d8d8d',
    cloth: ['#ff6a5b', '#3fb6a8', '#ffd36b', '#f58fb5'],
    dust: '#fff0dc',
  },

  world: {
    fogNear: 45,
    fogFar: 300,
    skyRadius: 500,
    sunPosition: [70, 22, -300],
    sunRadius: 14,
    lightPosition: [-8, 14, 12],
    skylineCenter: 5,
    // Parallax rows of background buildings. factor = how fast they scroll relative to the roofs.
    skyline: [
      { z: -18,  factor: 0.9,  count: 12, minW: 5,  maxW: 10, topMin: -8, topMax: 1.5, depth: 7 },
      { z: -34,  factor: 0.5,  count: 12, minW: 7,  maxW: 14, topMin: 2,  topMax: 16,  depth: 10 },
      { z: -65,  factor: 0.22, count: 14, minW: 9,  maxW: 18, topMin: 10, topMax: 36,  depth: 14 },
      { z: -120, factor: 0.09, count: 18, minW: 12, maxW: 24, topMin: 18, topMax: 56,  depth: 20 },
    ],
    clouds: { count: 9, span: 420, minY: 24, maxY: 50, minZ: -170, maxZ: -90, parallax: 0.04, drift: 1.2 },
  },
};
