// createCharacter(style): a low-poly, blocky version of the player's start.ng character.
// The character is built facing +Z with its feet at y = 0 (about 1.65 tall, taller with hats).
import * as THREE from 'three';
import { CONFIG } from './config.js';

const BODIES = ['female', 'male'];
const HAIRS = ['short', 'afro', 'braids', 'bun', 'ponytail', 'dreads', 'bald'];
const HATS = ['none', 'cap', 'beanie', 'tophat', 'crown'];
const ACCESSORIES = ['none', 'glasses', 'earrings', 'beard', 'scarf', 'backpack'];
const HEX = /^#[0-9a-f]{6}$/i;

const SHOE = '#2c1d1a';
const EYE = '#1d1416';
const MOUTH = '#7a3b2e';
const LIPS = '#c2506a';
const GOLD = '#ffd34d';
const BLACK = '#241a1f';

const pickOne = (value, list, fallback) => (list.includes(value) ? value : fallback);
const pickColor = (value, fallback) => (typeof value === 'string' && HEX.test(value) ? value : fallback);

/** Fills in anything missing or unknown so the character always builds. */
export function normaliseStyle(style) {
  const fb = CONFIG.character.fallbackStyle;
  const s = style && typeof style === 'object' ? style : {};
  return {
    body: pickOne(s.body, BODIES, fb.body),
    primaryColor: pickColor(s.primaryColor, fb.primaryColor),
    secondaryColor: pickColor(s.secondaryColor, fb.secondaryColor),
    skinColor: pickColor(s.skinColor, fb.skinColor),
    hairColor: pickColor(s.hairColor, fb.hairColor),
    hair: pickOne(s.hair, HAIRS, fb.hair),
    hat: pickOne(s.hat, HATS, 'none'),
    accessory: pickOne(s.accessory, ACCESSORIES, 'none'),
  };
}

export function createCharacter(style) {
  const s = normaliseStyle(style);
  const female = s.body === 'female';

  const materials = new Map();
  const mat = (hex, extra = {}) => {
    const key = hex + JSON.stringify(extra);
    if (!materials.has(key)) materials.set(key, new THREE.MeshLambertMaterial({ color: hex, ...extra }));
    return materials.get(key);
  };
  const part = (parent, geo, hex, x, y, z, extra) => {
    const m = new THREE.Mesh(geo, mat(hex, extra));
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const box = (parent, w, h, d, hex, x, y, z, extra) => part(parent, new THREE.BoxGeometry(w, h, d), hex, x, y, z, extra);
  const pivot = (parent, x, y, z) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };

  const root = new THREE.Group();
  root.name = 'character';
  const body = new THREE.Group(); // bobs and leans while running
  root.add(body);
  const sway = [];                // hanging parts (braids, scarf tail...) that swing as we run

  // A hanging strip that rotates about its top end.
  const hang = (parent, x, y, z, w, len, hex, base, amp, phase) => {
    const p = pivot(parent, x, y, z);
    box(p, w, len, w, hex, 0, -len / 2, 0);
    sway.push({ obj: p, base, amp, phase });
    return p;
  };

  // ---- torso, legs, arms ----
  const torsoW = female ? 0.5 : 0.58;
  box(body, torsoW, 0.6, 0.34, s.primaryColor, 0, 0.9, 0);

  const makeLeg = (x) => {
    const p = pivot(body, x, 0.6, 0); // hip
    if (female) box(p, 0.15, 0.5, 0.17, s.skinColor, 0, -0.27, 0);
    else box(p, 0.22, 0.5, 0.24, s.secondaryColor, 0, -0.27, 0); // trousers
    box(p, 0.2, 0.1, 0.3, SHOE, 0, -0.55, 0.04);
    return p;
  };
  const legX = female ? 0.1 : 0.14;
  const legL = makeLeg(-legX);
  const legR = makeLeg(legX);
  if (female) part(body, new THREE.CylinderGeometry(0.27, 0.41, 0.38, 8), s.secondaryColor, 0, 0.5, 0); // skirt

  const makeArm = (x) => {
    const p = pivot(body, x, 1.16, 0); // shoulder
    box(p, 0.16, 0.28, 0.18, s.primaryColor, 0, -0.14, 0);
    box(p, 0.13, 0.28, 0.15, s.skinColor, 0, -0.41, 0);
    return p;
  };
  const armL = makeArm(-(torsoW / 2 + 0.09));
  const armR = makeArm(torsoW / 2 + 0.09);

  // ---- head and face ----
  const head = pivot(body, 0, 1.42, 0);
  box(head, 0.4, 0.4, 0.4, s.skinColor, 0, 0, 0);
  box(head, 0.04, 0.1, 0.08, s.skinColor, -0.21, 0, 0);          // ears
  box(head, 0.04, 0.1, 0.08, s.skinColor, 0.21, 0, 0);
  box(head, 0.05, 0.06, 0.05, s.skinColor, 0, -0.03, 0.22);      // nose
  box(head, 0.06, 0.08, 0.02, EYE, -0.1, 0.03, 0.201);
  box(head, 0.06, 0.08, 0.02, EYE, 0.1, 0.03, 0.201);
  if (s.accessory !== 'beard') box(head, 0.1, 0.03, 0.02, female ? LIPS : MOUTH, 0, -0.11, 0.201);

  // ---- hair ----
  const hair = s.hairColor;
  const lift = s.hair === 'afro' ? 0.13 : 0; // hats sit higher on an afro
  if (s.hair !== 'bald' && s.hair !== 'afro') {
    box(head, 0.44, 0.12, 0.44, hair, 0, 0.22, 0);       // top
    box(head, 0.44, 0.3, 0.1, hair, 0, 0.06, -0.17);     // back
    box(head, 0.44, 0.06, 0.06, hair, 0, 0.18, 0.2);     // fringe
    box(head, 0.04, 0.16, 0.1, hair, -0.21, 0.1, 0.05);  // sideburns
    box(head, 0.04, 0.16, 0.1, hair, 0.21, 0.1, 0.05);
  }
  switch (s.hair) {
    case 'afro':
      part(head, new THREE.IcosahedronGeometry(0.34, 1), hair, 0, 0.24, -0.1);
      break;
    case 'braids':
      for (let i = 0; i < 4; i++) {
        const p = hang(head, -0.15 + i * 0.1, -0.02, -0.2, 0.07, 0.5, hair, 0.05, 0.12, i);
        box(p, 0.09, 0.05, 0.09, s.primaryColor, 0, -0.48, 0); // bead
      }
      break;
    case 'bun':
      if (s.hat === 'none') part(head, new THREE.IcosahedronGeometry(0.15, 1), hair, 0, 0.34, -0.06);
      else part(head, new THREE.IcosahedronGeometry(0.15, 1), hair, 0, 0.1, -0.29);
      break;
    case 'ponytail':
      box(head, 0.14, 0.05, 0.14, s.primaryColor, 0, 0.12, -0.22); // hair tie
      hang(head, 0, 0.12, -0.22, 0.12, 0.42, hair, 0.3, 0.22, 0);
      break;
    case 'dreads':
      for (let i = 0; i < 5; i++) hang(head, -0.17 + i * 0.085, 0.05, -0.2, 0.08, 0.5, hair, 0.04, 0.1, i);
      hang(head, -0.215, 0.1, 0, 0.07, 0.4, hair, 0.02, 0.06, 2);
      hang(head, 0.215, 0.1, 0, 0.07, 0.4, hair, 0.02, 0.06, 4);
      break;
    default:
      break;
  }

  // ---- hats (cap and beanie use the top colour, so they match the outfit) ----
  switch (s.hat) {
    case 'cap': {
      box(head, 0.48, 0.14, 0.48, s.primaryColor, 0, 0.27 + lift, 0);
      const visor = box(head, 0.44, 0.035, 0.22, s.primaryColor, 0, 0.21 + lift, 0.3);
      visor.rotation.x = 0.15;
      break;
    }
    case 'beanie':
      box(head, 0.48, 0.2, 0.48, s.primaryColor, 0, 0.28 + lift, 0);
      box(head, 0.5, 0.07, 0.5, s.secondaryColor, 0, 0.2 + lift, 0);
      part(head, new THREE.IcosahedronGeometry(0.08, 0), s.secondaryColor, 0, 0.43 + lift, 0);
      break;
    case 'tophat':
      part(head, new THREE.CylinderGeometry(0.36, 0.36, 0.03, 12), BLACK, 0, 0.21 + lift, 0);
      part(head, new THREE.CylinderGeometry(0.21, 0.21, 0.32, 12), BLACK, 0, 0.38 + lift, 0);
      part(head, new THREE.CylinderGeometry(0.215, 0.215, 0.07, 12), s.secondaryColor, 0, 0.27 + lift, 0);
      break;
    case 'crown':
      part(head, new THREE.CylinderGeometry(0.22, 0.24, 0.1, 8), GOLD, 0, 0.25 + lift, 0, { emissive: '#6b4a00' });
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        part(head, new THREE.ConeGeometry(0.07, 0.16, 4), GOLD, Math.cos(a) * 0.19, 0.37 + lift, Math.sin(a) * 0.19, { emissive: '#6b4a00' });
      }
      box(head, 0.06, 0.06, 0.02, '#e5383b', 0, 0.25 + lift, 0.235);
      break;
    default:
      break;
  }

  // ---- accessories ----
  switch (s.accessory) {
    case 'glasses':
      box(head, 0.18, 0.12, 0.015, BLACK, -0.1, 0.03, 0.208);
      box(head, 0.18, 0.12, 0.015, BLACK, 0.1, 0.03, 0.208);
      box(head, 0.14, 0.09, 0.02, '#9fd8ff', -0.1, 0.03, 0.218, { transparent: true, opacity: 0.6 });
      box(head, 0.14, 0.09, 0.02, '#9fd8ff', 0.1, 0.03, 0.218, { transparent: true, opacity: 0.6 });
      box(head, 0.06, 0.02, 0.02, BLACK, 0, 0.05, 0.215);
      break;
    case 'earrings':
      part(head, new THREE.IcosahedronGeometry(0.04, 0), GOLD, -0.23, -0.1, 0.02, { emissive: '#6b4a00' });
      part(head, new THREE.IcosahedronGeometry(0.04, 0), GOLD, 0.23, -0.1, 0.02, { emissive: '#6b4a00' });
      break;
    case 'beard':
      box(head, 0.42, 0.14, 0.14, hair, 0, -0.12, 0.14);
      box(head, 0.1, 0.03, 0.02, MOUTH, 0, -0.1, 0.215);
      break;
    case 'scarf':
      box(body, torsoW - 0.02, 0.12, 0.4, s.secondaryColor, 0, 1.22, 0);
      hang(body, 0.1, 1.2, -0.2, 0.12, 0.45, s.secondaryColor, 0.3, 0.3, 1);
      break;
    case 'backpack':
      box(body, 0.4, 0.5, 0.2, s.secondaryColor, 0, 0.95, -0.27);
      box(body, 0.3, 0.2, 0.05, BLACK, 0, 0.85, -0.39);
      box(body, 0.06, 0.5, 0.02, BLACK, -0.14, 0.95, 0.18); // chest straps
      box(body, 0.06, 0.5, 0.02, BLACK, 0.14, 0.95, 0.18);
      break;
    default:
      break;
  }

  // ---- animation: call every frame with dt, a state and the current speed ----
  // States: 'idle', 'run', 'air', 'fall', 'dead'
  let t = 0;
  let phase = 0;
  const toward = (obj, key, target, e) => { obj[key] += (target - obj[key]) * e; };
  const pose = (ll, lr, al, ar, bx, e) => {
    toward(legL.rotation, 'x', ll, e);
    toward(legR.rotation, 'x', lr, e);
    toward(armL.rotation, 'x', al, e);
    toward(armR.rotation, 'x', ar, e);
    toward(body.rotation, 'x', bx, e);
    toward(body.position, 'y', 0, e);
    toward(head.rotation, 'x', 0, e);
  };

  root.userData.animate = (dt, state = 'idle', speed = 12) => {
    t += dt;
    const e = 1 - Math.exp(-dt * 18);
    if (state === 'run') {
      phase += dt * (9 + speed * 0.28);
      const sw = Math.sin(phase);
      legL.rotation.x = sw * 0.95;
      legR.rotation.x = -sw * 0.95;
      armL.rotation.x = -sw * 0.9;
      armR.rotation.x = sw * 0.9;
      body.position.y = Math.abs(Math.cos(phase)) * 0.09;
      body.rotation.x = 0.16;   // lean into the run
      head.rotation.x = -0.08;
    } else if (state === 'air') {
      pose(0.9, -0.6, -2.5, -2.2, 0.1, e);
    } else if (state === 'fall') {
      legL.rotation.x = Math.sin(t * 22) * 0.9;
      legR.rotation.x = -Math.sin(t * 22) * 0.9;
      armL.rotation.x = -2.6 + Math.sin(t * 26) * 0.4;
      armR.rotation.x = -2.6 - Math.sin(t * 26) * 0.4;
      toward(body.rotation, 'x', 0, e);
    } else if (state === 'dead') {
      pose(0.25, -0.1, 0.5, -0.4, 0, e);
    } else {
      pose(0, 0, 0.05, -0.05, 0, e);
      body.position.y = Math.sin(t * 2.4) * 0.015;
      head.rotation.y = Math.sin(t * 0.9) * 0.12;
    }
    if (state === 'run' || state === 'air' || state === 'fall') head.rotation.y = 0;

    // Hanging hair and scarf tails swing, and stream backwards when moving fast.
    const streamLift = state === 'run' ? 0.25 : state === 'air' || state === 'fall' ? 0.45 : 0;
    const rate = state === 'run' ? 14 : 3;
    for (let i = 0; i < sway.length; i++) {
      const w = sway[i];
      w.obj.rotation.x = w.base + streamLift + Math.sin(t * rate + w.phase) * w.amp;
    }
  };
  root.userData.materials = materials;
  return root;
}

/** Free GPU memory when a character is replaced. */
export function disposeCharacter(group) {
  group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  group.userData.materials?.forEach((m) => m.dispose());
}
