// Scene, camera, lights, sky, parallax skyline and clouds, plus the mesh factories
// for roofs, obstacles, coins and dust puffs. Game logic lives in game.js.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const C = CONFIG.colors;
const W = CONFIG.world;
const CAM = CONFIG.camera;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const mod = (n, m) => ((n % m) + m) % m;

// ---- shared geometry and materials (reused by every roof, building and obstacle) ----
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const materials = new Map();
function lambert(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!materials.has(key)) materials.set(key, new THREE.MeshLambertMaterial({ color, ...extra }));
  return materials.get(key);
}
function addMesh(parent, geo, mat, x = 0, y = 0, z = 0, cast = false) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  parent.add(m);
  return m;
}

// ============================================================================
// Factories used by game.js (it pools what they return)
// ============================================================================

/** A rooftop that starts at local x = 0 and runs to x = L. Call userData.setup(L) before use. */
export function createRoof() {
  const R = CONFIG.roofs;
  const D = R.depth;
  const g = new THREE.Group();
  const add = (mat, receive = false) => {
    const m = new THREE.Mesh(UNIT_BOX, mat);
    m.receiveShadow = receive;
    g.add(m);
    return m;
  };
  const body = add(lambert(C.roofBody[0]));
  const slab = add(lambert(C.roofTop), true);
  const back = add(lambert(C.parapet));
  const curb = add(lambert(C.parapet), true);
  const edgeA = add(lambert(C.edge));
  const edgeB = add(lambert(C.edge));
  const bands = [0, 1, 2, 3].map(() => add(lambert(C.trim)));
  const windows = [0, 1, 2].map(() => add(lambert(C.windowDark)));
  const decor = [0, 1, 2, 3].map(() => add(lambert(C.decor[0])));
  const BAND_Y = [-2.1, -5.8, -9.4, -13];
  const WIN_Y = [-4.0, -7.6, -11.2];
  const darkWindow = lambert(C.windowDark);
  const litWindow = lambert(C.windowLit, { emissive: C.windowLit, emissiveIntensity: 0.5 });

  const place = (m, sx, sy, sz, x, y, z) => { m.scale.set(sx, sy, sz); m.position.set(x, y, z); };

  // Resize and re-dress this roof for a new length (the pooled meshes are reused).
  g.userData.setup = (L) => {
    body.material = lambert(pick(C.roofBody));
    place(body, L, R.thickness, D, L / 2, -0.4 - R.thickness / 2, 0);
    place(slab, L + 0.3, 0.4, D + 0.3, L / 2, -0.2, 0);                  // roof surface: top is y = 0
    place(back, L + 0.3, 0.7, 0.3, L / 2, 0.35, -D / 2 + 0.15);          // back parapet
    place(curb, L, 0.22, 0.3, L / 2, 0.11, D / 2 - 0.15);                // front curb
    place(edgeA, 0.3, 0.04, D - 0.6, 0.15, 0.02, 0);                     // painted take-off lines
    place(edgeB, 0.3, 0.04, D - 0.6, L - 0.15, 0.02, 0);
    for (let i = 0; i < bands.length; i++) place(bands[i], L + 0.3, 0.3, D + 0.3, L / 2, BAND_Y[i], 0);
    for (let i = 0; i < windows.length; i++) {
      windows[i].material = Math.random() < 0.4 ? litWindow : darkWindow;
      place(windows[i], Math.max(L - 2, 1), 1.1, D + 0.1, L / 2, WIN_Y[i], 0);
    }
    for (let i = 0; i < decor.length; i++) {  // vents, AC units and so on, kept at the back
      const m = decor[i];
      const w = rand(0.8, 2.2), h = rand(0.5, 1.6), d = rand(0.8, 1.3);
      m.visible = Math.random() < 0.7;
      m.material = lambert(pick(C.decor));
      place(m, w, h, d, rand(1.5, Math.max(L - 1.5, 2)), h / 2, -D / 2 + 0.3 + d / 2 + rand(0, 0.7));
    }
  };
  return g;
}

/** 'tank' | 'dish' | 'line'. Sits at local x = 0 (centre of the obstacle), on the roof surface. */
export function createObstacle(kind) {
  const g = new THREE.Group();
  g.userData.kind = kind;
  if (kind === 'tank') {
    for (const sx of [-0.4, 0.4]) {
      for (const sz of [-0.4, 0.4]) addMesh(g, new THREE.BoxGeometry(0.1, 0.5, 0.1), lambert(C.tankLeg), sx, 0.25, sz, true);
    }
    addMesh(g, new THREE.CylinderGeometry(0.65, 0.65, 0.85, 10), lambert(C.tank), 0, 0.9, 0, true);
    addMesh(g, new THREE.CylinderGeometry(0.67, 0.67, 0.07, 10), lambert(C.tankBand), 0, 0.75, 0, true);
    addMesh(g, new THREE.ConeGeometry(0.72, 0.3, 10), lambert(C.tankRoof), 0, 1.48, 0, true);
  } else if (kind === 'dish') {
    addMesh(g, new THREE.BoxGeometry(0.6, 0.1, 0.6), lambert(C.metal), 0, 0.05, 0, true);
    addMesh(g, new THREE.CylinderGeometry(0.05, 0.07, 0.6, 6), lambert(C.metal), 0, 0.4, 0, true);
    const dish = addMesh(g, new THREE.CylinderGeometry(0.55, 0.08, 0.25, 14), lambert(C.dish), 0, 0.85, 0, true);
    dish.rotation.z = 0.5;
    const arm = addMesh(g, new THREE.BoxGeometry(0.04, 0.4, 0.04), lambert(C.metal), -0.1, 1.05, 0, true);
    arm.rotation.z = 0.5;
  } else {
    // Clothes line running along the path (X axis), with hanging washing.
    for (const sx of [-1.2, 1.2]) {
      addMesh(g, new THREE.BoxGeometry(0.09, 1.5, 0.09), lambert(C.tankLeg), sx, 0.75, 0, true);
      addMesh(g, new THREE.BoxGeometry(0.3, 0.1, 0.3), lambert(C.metal), sx, 0.05, 0, true);
    }
    addMesh(g, new THREE.BoxGeometry(2.5, 0.04, 0.04), lambert(C.parapet), 0, 1.38, 0);
    const xs = [-0.7, 0, 0.7];
    for (let i = 0; i < xs.length; i++) {
      const cloth = addMesh(g, new THREE.BoxGeometry(0.5, 0.58, 0.04), lambert(C.cloth[(i + 1) % C.cloth.length]), xs[i], 1.07, 0, true);
      cloth.rotation.z = (i - 1) * 0.06;
    }
  }
  return g;
}

/** A spinning gold coin. Position it, then rotate it about Y. */
export function createCoin() {
  const geo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 14);
  geo.rotateX(Math.PI / 2); // flat face toward the camera
  return new THREE.Mesh(geo, lambert(C.coin, { emissive: C.coinGlow, emissiveIntensity: 0.8 }));
}

/** A dust puff (each has its own material so it can fade on its own). */
export function createPuff() {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(1, 6, 4),
    new THREE.MeshBasicMaterial({ color: C.dust, transparent: true, opacity: 0.7, depthWrite: false })
  );
  m.visible = false;
  return m;
}

// ============================================================================
// The world itself
// ============================================================================
export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.render.maxPixelRatio));
  renderer.shadowMap.enabled = true;   // only the runner (and a few obstacles) cast shadows
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(C.fog, W.fogNear, W.fogFar);
  const camera = new THREE.PerspectiveCamera(CAM.fov, 1, CAM.near, CAM.far);

  // ---- lights ----
  scene.add(new THREE.HemisphereLight(C.hemiSky, C.hemiGround, 1.35));
  const sunLight = new THREE.DirectionalLight(C.sunLight, 2.2);
  sunLight.position.set(...W.lightPosition);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(CONFIG.render.shadowMapSize, CONFIG.render.shadowMapSize);
  Object.assign(sunLight.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 });
  sunLight.shadow.bias = -0.0008;
  scene.add(sunLight, sunLight.target);

  // ---- sky dome with a vertex-colour gradient (no textures) ----
  {
    const geo = new THREE.SphereGeometry(W.skyRadius, 24, 16);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const stops = C.sky.map(([at, hex]) => ({ at, color: new THREE.Color(hex) }));
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const h = Math.max(0, pos.getY(i) / W.skyRadius);
      let k = 1;
      while (k < stops.length - 1 && h > stops[k].at) k++;
      const a = stops[k - 1], b = stops[k];
      tmp.lerpColors(a.color, b.color, THREE.MathUtils.clamp((h - a.at) / (b.at - a.at), 0, 1));
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    dome.renderOrder = -2;
    scene.add(dome);

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(W.sunRadius, 16, 12),
      new THREE.MeshBasicMaterial({ color: C.sun, fog: false })
    );
    sun.position.set(...W.sunPosition);
    sun.renderOrder = -1;
    scene.add(sun);
  }

  // ---- parallax skyline: rows of boxes that wrap around as the world scrolls ----
  const layers = W.skyline.map((cfg) => {
    const slot = ((cfg.minW + cfg.maxW) / 2) * 1.15;
    const span = slot * cfg.count;
    const items = [];
    for (let i = 0; i < cfg.count; i++) {
      const w = rand(cfg.minW, cfg.maxW);
      const top = rand(cfg.topMin, cfg.topMax);
      const h = top + 40;
      const z = cfg.z + rand(-0.3, 0.3) * cfg.depth;   // jitter so overlapping fronts never z-fight
      const mat = lambert(pick(C.skyline));
      const mesh = addMesh(scene, UNIT_BOX, mat, 0, top - h / 2, z);
      mesh.scale.set(w, h, cfg.depth);
      const item = { mesh, x0: i * slot, cap: null, capDx: 0 };
      if (Math.random() < 0.5) {                       // a stepped top for variety
        const cap = addMesh(scene, UNIT_BOX, mat, 0, top + 1.5, z + 0.5);
        cap.scale.set(w * 0.5, 3, cfg.depth * 0.6);
        item.cap = cap;
        item.capDx = rand(-w * 0.15, w * 0.15);
      }
      items.push(item);
    }
    return { cfg, items, span, minX: W.skylineCenter - span / 2 };
  });

  // ---- clouds (flattened low-poly blobs) ----
  const CL = W.clouds;
  const cloudMin = W.skylineCenter - CL.span / 2;
  const cloudMat = new THREE.MeshBasicMaterial({ color: C.cloud });
  const clouds = [];
  for (let i = 0; i < CL.count; i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const blob = addMesh(g, new THREE.IcosahedronGeometry(1, 1), cloudMat, (k - 1) * rand(4, 6), rand(-0.5, 0.8), rand(-1, 1));
      blob.scale.set(rand(5, 9), rand(1.8, 3), rand(3, 4));
    }
    g.position.set(0, rand(CL.minY, CL.maxY), rand(CL.minZ, CL.maxZ));
    scene.add(g);
    clouds.push({ g, x0: rand(0, CL.span) });
  }

  // ---- camera: framing depends on screen shape, plus follow, sway and shake ----
  let zoom = 1;
  let camY = 0;
  let clock = 0;
  let shakeMag = 0, shakeTime = 0, shakeDur = 1;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    zoom = THREE.MathUtils.clamp(CAM.portraitRef / aspect, 1, CAM.maxZoom); // zoom out on tall screens
    camera.fov = CAM.fov + (zoom - 1) * CAM.portraitFovBoost;
    camera.updateProjectionMatrix();
  }

  function shake(magnitude, duration) {
    shakeMag = magnitude;
    shakeTime = duration;
    shakeDur = duration;
  }

  function update(dt, dist, playerY) {
    clock += dt;

    for (let l = 0; l < layers.length; l++) {
      const L = layers[l];
      const off = dist * L.cfg.factor;
      for (let i = 0; i < L.items.length; i++) {
        const it = L.items[i];
        const x = L.minX + mod(it.x0 - off, L.span);
        it.mesh.position.x = x;
        if (it.cap) it.cap.position.x = x + it.capDx;
      }
    }
    for (let i = 0; i < clouds.length; i++) {
      clouds[i].g.position.x = cloudMin + mod(clouds[i].x0 - dist * CL.parallax - clock * CL.drift, CL.span);
    }

    camY += (THREE.MathUtils.clamp(playerY, -2.5, 4) - camY) * (1 - Math.exp(-dt * CAM.followSmooth));
    let ox = 0, oy = 0;
    if (shakeTime > 0) {
      shakeTime -= dt;
      const k = Math.max(shakeTime, 0) / shakeDur;
      ox = (Math.random() - 0.5) * 2 * shakeMag * k;
      oy = (Math.random() - 0.5) * 2 * shakeMag * k;
    }
    const lookX = CAM.look[0] + (zoom - 1) * CAM.portraitLookShift;
    const lookY = CAM.look[1] + camY * CAM.followY;
    camera.position.set(
      lookX + CAM.offset[0] * zoom + Math.sin(clock * 0.45) * CAM.sway + ox,
      lookY + CAM.offset[1] * zoom + Math.cos(clock * 0.37) * CAM.sway * 0.5 + oy,
      CAM.look[2] + CAM.offset[2] * zoom
    );
    camera.lookAt(lookX, lookY, CAM.look[2]);
  }

  const projected = new THREE.Vector3();
  /** World position to screen pixels. */
  function toScreen(position, out) {
    projected.copy(position).project(camera);
    out.x = (projected.x * 0.5 + 0.5) * window.innerWidth;
    out.y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
    out.visible = projected.z < 1;
    return out;
  }

  resize();
  return {
    scene,
    camera,
    renderer,
    resize,
    shake,
    update,
    toScreen,
    render: () => renderer.render(scene, camera),
  };
}
