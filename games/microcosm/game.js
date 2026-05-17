import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

console.log('Microcosm module loaded');
try {

// ── Scene ──────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game'), antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#7ec8e3');
scene.fog = new THREE.Fog('#7ec8e3', 15, 40);

// ── Time System ─────────────────────────────────
const SECONDS_PER_DAY = 120;
let gameHours = 7;  // start at morning
let dayCount = 1;

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 50);
camera.position.set(6, 8, 9);
camera.lookAt(0, 0.3, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.3, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 2.5;
controls.maxDistance = 20;
controls.maxPolarAngle = 2.2;
controls.update();

// ── Lighting ───────────────────────────────────
const ambient = new THREE.AmbientLight('#ffffff', 0.4);
scene.add(ambient);
const sun = new THREE.DirectionalLight('#ffffff', 1.0);
sun.position.set(5, 8, 3);
scene.add(sun);

// ── Celestial Bodies ────────────────────────────
// Sun
const sunGeo = new THREE.SphereGeometry(0.5, 16, 16);
const sunMat = new THREE.MeshBasicMaterial({ color: '#ffffaa' });
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
sunMesh.position.set(5, 8, 3);
scene.add(sunMesh);

// Sun glow (larger transparent halo)
const glowGeo = new THREE.SphereGeometry(0.8, 16, 16);
const glowMat = new THREE.MeshBasicMaterial({ color: '#ffffcc', transparent: true, opacity: 0.3, depthWrite: false });
const glowMesh = new THREE.Mesh(glowGeo, glowMat);
sunMesh.add(glowMesh);

// Moon
const moonGeo = new THREE.SphereGeometry(0.3, 12, 12);
const moonMat = new THREE.MeshBasicMaterial({ color: '#ddeeff' });
const moonMesh = new THREE.Mesh(moonGeo, moonMat);
moonMesh.visible = false;
scene.add(moonMesh);

// Stars — scattered points in a hemisphere
const starCount = 300;
const starGeo = new THREE.BufferGeometry();
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.random() * Math.PI * 0.45; // upper hemisphere
  const r = 14 + Math.random() * 6;
  starPositions[i * 3] = Math.cos(theta) * Math.cos(phi) * r;
  starPositions[i * 3 + 1] = Math.sin(phi) * r + 2;
  starPositions[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * r;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({
  color: '#ffffff',
  size: 0.08,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// ── Time-of-Day Presets (visual only — lighting stays constant) ──
const TIME_KEYFRAMES = [
  { h: 0,  bg: '#0f0f24', fog: '#0f0f24' },
  { h: 5,  bg: '#2a2040', fog: '#2a2040' },
  { h: 6,  bg: '#d49060', fog: '#c8a090' },
  { h: 8,  bg: '#a0d8f0', fog: '#a0c8e0' },
  { h: 12, bg: '#7ec8e3', fog: '#a0c8e0' },
  { h: 16, bg: '#a0d0e8', fog: '#a0c0d8' },
  { h: 18, bg: '#e88850', fog: '#d09080' },
  { h: 20, bg: '#1a1030', fog: '#1a1030' },
  { h: 24, bg: '#0f0f24', fog: '#0f0f24' },
];

function lerpColor(a, b, t) {
  const ac = new THREE.Color(a), bc = new THREE.Color(b);
  return ac.lerp(bc, t);
}

function updateTimeOfDay() {
  const h = gameHours;
  let prev = TIME_KEYFRAMES[0], next = TIME_KEYFRAMES[TIME_KEYFRAMES.length - 1];
  for (let i = 0; i < TIME_KEYFRAMES.length - 1; i++) {
    if (h >= TIME_KEYFRAMES[i].h && h <= TIME_KEYFRAMES[i + 1].h) {
      prev = TIME_KEYFRAMES[i];
      next = TIME_KEYFRAMES[i + 1];
      break;
    }
  }
  const range = next.h - prev.h;
  const t = range > 0 ? (h - prev.h) / range : 0;

  // Only background and fog change — lighting stays constant
  scene.background = lerpColor(prev.bg, next.bg, t);
  scene.fog.color = lerpColor(prev.fog, next.fog, t);

  // Sun angle: rises east (-X), sets west (+X)
  const sunAngle = -(h / 24) * Math.PI * 2 + Math.PI / 2;
  const sunDist = 8;

  // Sun mesh — visible when above horizon
  sunMesh.position.set(Math.cos(sunAngle) * sunDist, Math.sin(sunAngle) * sunDist + 2, -3);
  const sunY = Math.sin(sunAngle);
  sunMesh.visible = sunY > -0.05;
  sunMesh.material.opacity = Math.max(0, Math.min(1, sunY * 4));
  sunMesh.material.transparent = true;
  glowMesh.visible = sunY > 0.1;

  // Moon — opposite side of sky
  const moonAngle = sunAngle + Math.PI;
  const moonDist = 7;
  moonMesh.position.set(Math.cos(moonAngle) * moonDist, Math.sin(moonAngle) * moonDist + 2, -2);
  const moonY = Math.sin(moonAngle);
  moonMesh.visible = moonY > 0;
  moonMesh.material.opacity = Math.max(0, Math.min(1, moonY * 3));
  moonMesh.material.transparent = true;

  // Stars — visible when moon is up
  stars.material.opacity = moonMesh.visible ? moonMesh.material.opacity * 0.8 : 0;
}

// ── Arena Ground ────────────────────────────────
const ARENA_HALF = 5;

const texLoader = new THREE.TextureLoader();
const groundTex = texLoader.load('dirt_2.png');
groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
groundTex.repeat.set(6, 6);
groundTex.colorSpace = THREE.SRGBColorSpace;

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(ARENA_HALF * 2 + 2, ARENA_HALF * 2 + 2),
  new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.85 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
ground.receiveShadow = true;
ground.name = 'ground';
scene.add(ground);

// Arena ring — subtle border marking the play area
const ringGeo = new THREE.TorusGeometry(ARENA_HALF, 0.04, 8, 48);
const ringMat = new THREE.MeshStandardMaterial({ color: '#5a5040', roughness: 0.5, emissive: '#1a1510', emissiveIntensity: 0.3 });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.02;
ring.name = 'arenaRing';
scene.add(ring);

// ── Nutrient System ────────────────────────────
const nutrients = [];
const NUTRIENT_DEFS = {
  s: { radius: 0.05, eatTime: 0.3,  energy: 0.05, satiety: 0.20, color: '#ffffbb' },
  m: { radius: 0.10, eatTime: 0.8,  energy: 0.10, satiety: 0.45, color: '#ffcc66' },
  l: { radius: 0.16, eatTime: 2.0,  energy: 0.20, satiety: 0.80, color: '#ff8833' },
};

const nutrientGeos = {
  s: new THREE.SphereGeometry(0.05, 6, 6),
  m: new THREE.SphereGeometry(0.10, 8, 8),
  l: new THREE.SphereGeometry(0.16, 10, 10),
};

function spawnNutrient(pos, size) {
  return spawnNutrientReturn(pos, size);
}

function spawnNutrientReturn(pos, size) {
  const def = NUTRIENT_DEFS[size];
  const mesh = new THREE.Mesh(nutrientGeos[size], new THREE.MeshBasicMaterial({ color: def.color }));
  mesh.position.copy(pos);
  scene.add(mesh);
  const n = {
    pos: pos.clone(),
    vel: new THREE.Vector3(0, -0.05, 0),
    mesh,
    life: 30,
    size,
    eatProgress: 0,
    eatTime: def.eatTime,
    energy: def.energy,
    satiety: def.satiety,
    maxEnergy: def.energy,
    maxSatiety: def.satiety,
    originalScale: mesh.scale.clone(),
    eaters: 0,
  };
  nutrients.push(n);
  return n;
}

function randomNutrientSize() {
  const r = Math.random();
  return r < 0.55 ? 's' : r < 0.85 ? 'm' : 'l';
}

function updateNutrients(dt) {
  for (let i = nutrients.length - 1; i >= 0; i--) {
    const n = nutrients[i];
    n.eaters = 0;
    n.life -= dt;
    if (n.life <= 0) {
      scene.remove(n.mesh);
      nutrients.splice(i, 1);
      continue;
    }

    // Gravity (heavier = faster fall)
    const gravScale = n.size === 'l' ? 1.4 : n.size === 'm' ? 1.1 : 0.8;
    n.vel.y -= 9.8 * gravScale * dt;

    // Brownian sway
    n.vel.x += (Math.random() - 0.5) * 0.02;
    n.vel.z += (Math.random() - 0.5) * 0.02;

    n.pos.x += n.vel.x * dt;
    n.pos.y += n.vel.y * dt;
    n.pos.z += n.vel.z * dt;

    n.vel.x *= 0.98;
    n.vel.z *= 0.98;

    if (n.pos.y <= 0.1) {
      n.pos.y = 0.1;
      n.vel.y = 0;
      n.vel.x *= 0.9;
      n.vel.z *= 0.9;
    }

    n.pos.x = Math.max(-ARENA_HALF + 0.2, Math.min(ARENA_HALF - 0.2, n.pos.x));
    n.pos.z = Math.max(-ARENA_HALF + 0.2, Math.min(ARENA_HALF - 0.2, n.pos.z));

    n.mesh.position.copy(n.pos);

    if (n.life < 5) {
      n.mesh.material.opacity = n.life / 5;
      n.mesh.material.transparent = true;
    }
  }

  // Nutrient-nutrient repulsion (avoid stacking)
  for (let i = 0; i < nutrients.length; i++) {
    for (let j = i + 1; j < nutrients.length; j++) {
      const a = nutrients[i], b = nutrients[j];
      const dx = a.pos.x - b.pos.x;
      const dz = a.pos.z - b.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const minDist = NUTRIENT_DEFS[a.size].radius + NUTRIENT_DEFS[b.size].radius + 0.05;
      if (dist < minDist && dist > 0.001) {
        const push = (minDist - dist) / dist * 0.5;
        a.pos.x += dx * push;
        a.pos.z += dz * push;
        b.pos.x -= dx * push;
        b.pos.z -= dz * push;
      }
    }
  }
}

// ── Creature System ────────────────────────────
const creatures = [];
const creatureGeo = new THREE.SphereGeometry(0.2, 12, 12);
const creatureMat = new THREE.MeshStandardMaterial({
  color: '#44cc44',
  emissive: '#226622',
  emissiveIntensity: 0.3,
  roughness: 0.3,
  metalness: 0.1,
});

function spawnCreature(pos) {
  const mat = creatureMat.clone();
  const hueShift = (Math.random() - 0.5) * 0.1;
  mat.color.setRGB(0.2 + hueShift, 0.7 + Math.random() * 0.2, 0.05);
  mat.emissive.setRGB(0.05, 0.1, 0);

  const mesh = new THREE.Mesh(creatureGeo, mat);
  mesh.position.copy(pos);
  mesh.castShadow = true;
  scene.add(mesh);

  // Perception ring on ground
  const ringGeo = new THREE.TorusGeometry(1, 0.03, 4, 20);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#556688', transparent: true, opacity: 0.2, depthWrite: false });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.copy(pos);
  ringMesh.position.y = 0.02;
  scene.add(ringMesh);

  // Highlight glow disc on ground
  const hlCanvas = document.createElement('canvas');
  hlCanvas.width = hlCanvas.height = 64;
  const hlctx = hlCanvas.getContext('2d');
  const gradient = hlctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,220,1)');
  gradient.addColorStop(0.2, 'rgba(255,255,150,0.8)');
  gradient.addColorStop(0.5, 'rgba(255,220,50,0.3)');
  gradient.addColorStop(0.8, 'rgba(255,180,0,0.05)');
  gradient.addColorStop(1, 'rgba(255,200,0,0)');
  hlctx.fillStyle = gradient;
  hlctx.fillRect(0, 0, 64, 64);
  const hlTex = new THREE.CanvasTexture(hlCanvas);
  const hlDiscGeo = new THREE.PlaneGeometry(1.2, 1.2);
  const hlDiscMat = new THREE.MeshBasicMaterial({ map: hlTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const hlDisc = new THREE.Mesh(hlDiscGeo, hlDiscMat);
  hlDisc.rotation.x = -Math.PI / 2;
  hlDisc.position.y = 0.02;
  mesh.add(hlDisc);

  // Name label sprite
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 128; labelCanvas.height = 32;
  const lctx = labelCanvas.getContext('2d');
  lctx.font = '14px system-ui, sans-serif';
  lctx.textAlign = 'center';
  lctx.fillStyle = '#ffffff';
  lctx.fillText('...', 64, 18);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.minFilter = THREE.LinearFilter;
  const labelSpriteMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false, depthWrite: false });
  const labelSprite = new THREE.Sprite(labelSpriteMat);
  labelSprite.scale.set(1.2, 0.3, 1);
  labelSprite.position.y = 0.5;
  mesh.add(labelSprite);

  // Generate unique name
  const prefixes = ['Zar', 'Blip', 'Kex', 'Nox', 'Vex', 'Tix', 'Plix', 'Glo', 'Fizz', 'Wrex', 'Miku', 'Zorp', 'Quib', 'Snap', 'Drib'];
  const suffixes = ['o', 'a', 'ix', 'ex', 'ar', 'ul', 'een', 'ok', 'ip', 'ax', 'u', 'el', 'os', 'im', 'ee'];
  const name = prefixes[Math.floor(Math.random() * prefixes.length)] + suffixes[Math.floor(Math.random() * suffixes.length)] + '-' + Math.floor(Math.random() * 99);

  const baseSpeed = 0.5 + Math.random() * 0.7;
  creatures.push({
    name,
    pos: pos.clone(),
    heading: Math.random() * Math.PI * 2,
    energy: 1.0,
    satiety: 0.6 + Math.random() * 0.4,
    hp: 1.0,
    lastHitTime: -99,
    age: 0,
    phase: Math.random() * Math.PI * 2,
    mesh,
    eatFlash: 0,
    foodNoticeAt: 0,
    // Individual traits
    baseSpeed,
    satietyDecay: 0.08 + Math.random() * 0.04, // ~2 game hours to deplete
    baseDetectRange: 0.5 + Math.random() * 0.4,
    detectRange: 0, // set below
    foodInRange: false,
    creatureInRange: false,
    attackCooldown: 0,
    radius: 0.2,
    ringMesh,
    hlDisc,
    labelSprite,
    labelCanvas,
    highlighted: false,
    parent: null,
    children: null,
    reactionTime: 0.2 + Math.random() * 1.3,
    aggression: Math.random(), // 0=docile, 1=fierce
    // Growth & lifespan
    growth: 0.2 + Math.random() * 0.15,
    // Leveling
    level: 1,
    foodEaten: 0,
    foodToNext: 1.0,
    maxEnergy: 1.5,
    maxHP: 1.0,
    maxSatiety: 1.0,
    attackDamage: 0.25,
    // State
    state: 'exploring',
    stateTimer: 2 + Math.random() * 3,
    restTimer: 0,
    satisfiedTimer: 0,
    wanderTarget: null,
  });
  const nc = creatures[creatures.length - 1];
  nc.detectRange = nc.baseDetectRange * (0.7 + nc.level * 0.3);
  ringMesh.scale.setScalar(nc.detectRange);
}

function updateCreatures(dt) {
  for (let i = creatures.length - 1; i >= 0; i--) {
    const c = creatures[i];
    c.age += dt;
    c.eatFlash = Math.max(0, c.eatFlash - dt);
    c.phase += dt * (1.5 + Math.random() * 0.5);
    c.satisfiedTimer = Math.max(0, c.satisfiedTimer - dt);

    // ── Growth ──────────────────────────────────────
    if (c.energy > 0.8 && c.growth < 1.0) {
      c.growth = Math.min(1.0, c.growth + dt * 0.015);
    }

    // ── Reproduction (division) ────────────────────
    if (c.level >= 2 && c.energy >= c.maxEnergy * 0.3 && c.hp > 0.5) {
      if (Math.random() < dt * 0.16) { // ~16% chance per second
        c.energy *= 0.9;
        // Child spawns nearby with mutated traits
        const offset = (Math.random() - 0.5) * 0.3;
        const childPos = new THREE.Vector3(c.pos.x + offset, 0.15, c.pos.z + offset);
        spawnCreature(childPos);
        const child = creatures[creatures.length - 1];
        child.baseSpeed = c.baseSpeed * (0.8 + Math.random() * 0.4);
        child.satietyDecay = c.satietyDecay * (0.8 + Math.random() * 0.4);
        child.baseDetectRange = c.baseDetectRange * (0.8 + Math.random() * 0.4);
        child.detectRange = child.baseDetectRange * (0.7 + child.level * 0.3);
        child.ringMesh.scale.setScalar(child.detectRange);
        child.aggression = Math.min(1, Math.max(0, c.aggression + (Math.random() - 0.5) * 0.3));
        child.reactionTime = c.reactionTime * (0.8 + Math.random() * 0.4);
        child.name = c.name.split('-')[0] + '-' + Math.floor(Math.random() * 99);
        child.parent = c;
        if (!c.children) c.children = [];
        c.children.push(child);
        c.satisfiedTimer = 1;
      }
    }

    // ── Eating: contact-based, multi-creature ──────
    // Find food in contact range (scales with creature size)
    let touchingFood = null;
    for (const n of nutrients) {
      if (c.pos.distanceTo(n.pos) < c.radius + NUTRIENT_DEFS[n.size].radius) {
        touchingFood = n;
        break;
      }
    }

    if (touchingFood && c.state !== 'resting') {
      c.state = 'eating';
      const n = touchingFood;
      n.eaters++;
      // Multi-eater speed boost
      const eatRate = dt / n.eatTime * (1 + (n.eaters - 1) * 0.5);
      n.eatProgress += eatRate;
      // Shrink food
      const remain = 1 - n.eatProgress;
      n.mesh.scale.copy(n.originalScale).multiplyScalar(Math.max(0.05, remain));
      // Award energy in ticks
      const prevProgress = n.eatProgress - eatRate;
      if (Math.floor(n.eatProgress * 4) > Math.floor(prevProgress * 4)) {
        c.energy = Math.min(c.maxEnergy, c.energy + n.maxEnergy * 0.25);
        c.satiety = Math.min(c.maxSatiety, c.satiety + n.maxSatiety * 0.25);
        c.eatFlash = 0.3;
      }
      // Pulse while eating
      const gs = (0.5 + c.growth * 0.7) * (0.8 + c.level * 0.2);
      const es = 0.7 + c.energy * 0.4;
      const pulse = 1 + Math.sin(c.phase * 6) * 0.06;
      c.mesh.scale.setScalar(gs * es * pulse);
      if (n.eatProgress >= 1) {
        c.satisfiedTimer = 1 + Math.random() * 1.5;
        c.wanderTarget = null;
        c.foodNoticeAt = 0;
        // Leveling progress
        c.foodEaten += n.maxEnergy;
        while (c.foodEaten >= c.foodToNext) {
          c.foodEaten -= c.foodToNext;
          c.level++;
          c.foodToNext *= 1.6;
          c.maxEnergy += 0.3;
          c.maxHP += 0.2;
          c.maxSatiety += 0.15;
          c.attackDamage += 0.05;
          c.detectRange = c.baseDetectRange * (0.7 + c.level * 0.3);
          // Update ring scale
          c.ringMesh.scale.setScalar(c.detectRange);
          // Flash effect
          c.eatFlash = 0.8;
        }
        scene.remove(n.mesh);
        nutrients.splice(nutrients.indexOf(n), 1);
      }
      c.phase += dt * 3;
      c.mesh.position.copy(c.pos);
      continue;
    }

    if (c.state === 'eating') {
      c.state = 'exploring';
      c.stateTimer = 1 + Math.random();
    }

    // ── State transitions ──────────────────────────
    const energyRatio = c.energy / c.maxEnergy;
    const speedMod = 1.0;

    // Torpor: satiety empty + energy critically low → near-death hibernation
    if (c.satiety <= 0 && energyRatio < 0.05 && c.state !== 'torpor' && c.state !== 'eating') {
      c.state = 'torpor';
    }
    if (c.state === 'torpor' && (c.satiety > 0.2 || energyRatio > 0.12)) {
      c.state = 'exploring';
      c.stateTimer = 1;
    }

    // Frantic when hungry but still have energy
    if (c.satiety <= 0 && energyRatio > 0.08 && c.state !== 'frantic' && c.state !== 'eating' && c.state !== 'torpor') {
      c.state = 'frantic';
      c.wanderTarget = null;
    }
    if (c.state === 'frantic' && (c.satiety > 0.5 || energyRatio < 0.05)) {
      c.state = energyRatio < 0.05 ? 'torpor' : 'exploring';
      c.stateTimer = 1;
    }

    // Lethargic when energy low but not torpor
    if (energyRatio < 0.1 && c.state !== 'lethargic' && c.state !== 'eating' && c.state !== 'torpor' && c.state !== 'frantic') {
      c.state = 'lethargic';
      c.stateTimer = 0;
    }
    if (c.state === 'lethargic' && energyRatio > 0.25 && c.satiety > 0.3) {
      c.state = 'exploring';
      c.stateTimer = 1 + Math.random() * 2;
    }
    if (c.state === 'lethargic' && c.satiety <= 0 && energyRatio < 0.05) {
      c.state = 'torpor';
    }

    // Check nearby food and creatures
    let nearestDist = c.detectRange;
    let nearestNutrient = null;
    let nearestPrey = null;
    c.foodInRange = false;
    c.creatureInRange = false;

    for (const n of nutrients) {
      const dist = c.pos.distanceTo(n.pos);
      if (dist < c.detectRange) c.foodInRange = true;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestNutrient = n;
      }
    }

    // Check for other creatures in range (any state)
    for (let j = 0; j < creatures.length; j++) {
      if (i === j) continue;
      const other = creatures[j];
      const dist = c.pos.distanceTo(other.pos);
      if (dist < c.detectRange) c.creatureInRange = true;
      // Frantic creatures target others as prey
      if (c.state === 'frantic' && dist < nearestDist && !isKin(c, other)) {
        nearestDist = dist;
        nearestPrey = other;
        nearestNutrient = null;
      }
    }

    if (nearestNutrient && c.state !== 'eating') {
      const delay = c.state === 'frantic' ? 0 : c.reactionTime;
      if (c.foodNoticeAt === 0) c.foodNoticeAt = c.age + delay;
      if (c.age >= c.foodNoticeAt && c.state !== 'seeking' && c.state !== 'frantic') {
        c.state = 'seeking';
        c.stateTimer = 0;
      }
    } else if (c.state === 'seeking' && !nearestNutrient) {
      c.foodNoticeAt = 0;
      c.state = 'exploring';
      c.stateTimer = 1 + Math.random() * 2;
    }

    // Resting (only when exploring and not hungry)
    if (c.state === 'exploring' && c.satisfiedTimer <= 0 && c.satiety > 0.5) {
      c.stateTimer -= dt;
      if (c.stateTimer <= 0) {
        c.state = 'resting';
        c.restTimer = 1 + Math.random() * 3;
      }
    }
    if (c.state === 'resting') {
      c.restTimer -= dt;
      if (c.restTimer <= 0) {
        c.state = 'exploring';
        c.stateTimer = 3 + Math.random() * 5;
      }
    }

    if (c.state === 'seeking') {
      c.stateTimer -= dt;
      if (c.stateTimer < -5 && !nearestNutrient) {
        c.state = 'exploring';
        c.stateTimer = 2;
        c.foodNoticeAt = 0;
      }
    }

    // ── Parent-child connection lines ──────────────
    updateFamilyLines();

    // ── Parent-child behavior ──────────────────────
    // Child follows parent until Lv2
    if (c.level < 2 && c.parent && creatures.includes(c.parent)) {
      const distToParent = c.pos.distanceTo(c.parent.pos);
      if (distToParent > 1.5) {
        c.wanderTarget = c.parent.pos.clone();
        c.state = 'exploring';
      } else if (distToParent < 0.4) {
        // Stay close but not too close
        pickWanderTarget(c);
      }
    }
    // Parent stays near children
    if (c.children && c.children.length > 0) {
      // Filter dead children
      c.children = c.children.filter(ch => creatures.includes(ch));
      // Stay near youngest child
      const youngest = c.children[c.children.length - 1];
      if (youngest && c.pos.distanceTo(youngest.pos) > 2.5 && c.state === 'exploring') {
        c.wanderTarget = youngest.pos.clone();
      }
    }

    // ── Movement ────────────────────────────────────
    let targetAngle = c.heading;
    let speed = 0;

    switch (c.state) {
      case 'lethargic':
        speed = c.baseSpeed * 0.25 * energyRatio * speedMod;
        if (!c.wanderTarget || c.pos.distanceTo(c.wanderTarget) < 0.3) pickWanderTarget(c);
        targetAngle = angleToward(c.pos, c.wanderTarget);
        break;

      case 'resting':
        speed = 0;
        break;

      case 'seeking': {
        const target = nearestPrey || nearestNutrient;
        const targetPos = nearestPrey ? nearestPrey.pos : nearestNutrient ? nearestNutrient.pos : null;
        if (targetPos) {
          const dist = c.pos.distanceTo(targetPos);
          const desperate = c.satiety <= 0;
          const urgency = desperate ? 3.5 : (1 + (1 - Math.min(dist, c.detectRange) / c.detectRange) * 2);
          const closeFactor = desperate ? 1.0 : Math.min(1, dist / 0.8);
          speed = c.baseSpeed * 1.4 * urgency * speedMod * closeFactor;
          targetAngle = angleToward(c.pos, targetPos);
          c.stateTimer = 0;
          const seekEatRange = 0.25 + c.level * 0.05;
          if (nearestNutrient && dist < seekEatRange) {
            c.foodNoticeAt = 0;
            continue;
          }
        }
        break;
      }

      case 'torpor':
        speed = c.baseSpeed * 0.03;
        if (!c.wanderTarget || c.pos.distanceTo(c.wanderTarget) < 0.05) {
          c.wanderTarget = new THREE.Vector3(
            c.pos.x + (Math.random() - 0.5) * 0.2, 0.15,
            c.pos.z + (Math.random() - 0.5) * 0.2
          );
        }
        targetAngle = angleToward(c.pos, c.wanderTarget);
        break;

      case 'frantic': {
        // If prey detected, chase it; otherwise charge straight with swerves
        const target = nearestPrey || (nearestNutrient ? nearestNutrient : null);
        if (target) {
          speed = c.baseSpeed * 3.5 * speedMod;
          targetAngle = angleToward(c.pos, target.pos);
          // Attack on contact is handled in collision section
        } else {
          speed = c.baseSpeed * 3.0 * speedMod;
          if (!c.wanderTarget || c.pos.distanceTo(c.wanderTarget) < 0.4 || Math.random() < 0.02) {
            let angle;
            if (Math.random() < 0.15) {
              angle = Math.random() * Math.PI * 2;
            } else {
              angle = c.heading + (Math.random() - 0.5) * 1.2;
            }
            c.wanderTarget = new THREE.Vector3(
              c.pos.x + Math.cos(angle) * 5, 0.15,
              c.pos.z + Math.sin(angle) * 5
            );
          }
          targetAngle = angleToward(c.pos, c.wanderTarget);
        }
        break;
      }

      case 'exploring':
      default: {
        speed = c.baseSpeed * (0.6 + energyRatio * 0.5) * speedMod;
        if (c.satisfiedTimer > 0) speed *= 0.5;
        if (!c.wanderTarget || c.pos.distanceTo(c.wanderTarget) < 0.3) pickWanderTarget(c);
        targetAngle = angleToward(c.pos, c.wanderTarget);
        break;
      }
    }

    let angleDiff = targetAngle - c.heading;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    const turnRate = c.state === 'frantic' ? 7.0 : c.state === 'seeking' ? 8.0 : c.state === 'torpor' ? 0.3 : 3.0 + Math.random() * 0.5;
    c.heading += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate * dt);

    if (speed > 0) {
      const jitterX = (Math.random() - 0.5) * speed * 0.3;
      const jitterZ = (Math.random() - 0.5) * speed * 0.3;
      c.pos.x += (Math.cos(c.heading) * speed + jitterX) * dt;
      c.pos.z += (Math.sin(c.heading) * speed + jitterZ) * dt;
    }

    // Collision + aggression + predation
    for (let j = 0; j < creatures.length; j++) {
      if (i === j) continue;
      const other = creatures[j];
      const d = c.pos.distanceTo(other.pos);
      const minDist = c.radius + other.radius + 0.05;
      if (d < minDist && d > 0.001) {
        const myForce = 1 + c.aggression * 2 + (1 - c.satiety) * 2;
        const theirForce = 1 + other.aggression * 2 + (1 - other.satiety) * 2;
        const ratio = myForce / (myForce + theirForce);
        const pushMag = (minDist - d) * 3;
        c.pos.x += (c.pos.x - other.pos.x) / d * pushMag * (1 - ratio) * dt;
        c.pos.z += (c.pos.z - other.pos.z) / d * pushMag * (1 - ratio) * dt;
        c.heading += (Math.random() - 0.5) * (c.state === 'frantic' ? 1.5 : 0.5);

        // Frantic creatures attack others on contact
        // No attacking kin
        if (c.state === 'frantic' && c.attackCooldown <= 0 && !isKin(c, other)) {
          const dmg = c.attackDamage * (c.level / Math.max(1, other.level));
          other.hp -= dmg;
          other.lastHitTime = other.age;
          c.attackCooldown = 0.3;
          // Push victim harder
          other.pos.x += (other.pos.x - c.pos.x) / d * 0.3;
          other.pos.z += (other.pos.z - c.pos.z) / d * 0.3;
          // If victim dies, spawn food based on remaining energy
          if (other.hp <= 0) {
            // Victim corpse will be created in its death check.
            // Attacker gets a small immediate feed from the kill.
            c.energy = Math.min(c.maxEnergy, c.energy + 0.1);
            c.satiety = Math.min(c.maxSatiety, c.satiety + 0.15);
            c.state = 'exploring'; // corpse nearby, will eat via contact next frame
          }
        }

        // Interrupt eating on strong push
        if (pushMag * (1 - ratio) * dt > 0.05 && c.state === 'eating') {
          c.state = 'exploring';
          c.stateTimer = 0.5;
        }
      }
    }
    if (c.attackCooldown > 0) c.attackCooldown -= dt;

    const bobAmp = c.state === 'resting' ? 0.01 : 0.03;
    c.pos.y += Math.sin(c.phase * 1.8) * bobAmp * dt;
    if (c.pos.y > 0.2) c.pos.y -= 0.2 * dt;

    // Bounds — frantic bounces off walls
    const bound = ARENA_HALF - 0.3;
    if (c.pos.x > bound) { c.pos.x = bound; c.heading = c.state === 'frantic' ? Math.PI - c.heading + (Math.random()-0.5)*0.8 : Math.PI; }
    if (c.pos.x < -bound) { c.pos.x = -bound; c.heading = c.state === 'frantic' ? -Math.PI - c.heading + (Math.random()-0.5)*0.8 : 0; }
    if (c.pos.z > bound) { c.pos.z = bound; c.heading = c.state === 'frantic' ? -c.heading + (Math.random()-0.5)*0.8 : -Math.PI/2; }
    if (c.pos.z < -bound) { c.pos.z = -bound; c.heading = c.state === 'frantic' ? -c.heading + (Math.random()-0.5)*0.8 : Math.PI/2; }
    if (c.pos.y > 2.0) c.pos.y = 2.0;

    // Satiety & energy decay
    if (c.state === 'torpor') {
      c.satiety = Math.max(0, c.satiety - dt * c.satietyDecay * 0.1);
      c.energy -= dt * 0.0008;
    } else if (c.state === 'resting') {
      c.satiety = Math.max(0, c.satiety - dt * c.satietyDecay * 0.2);
      c.energy -= dt * 0.001;
    } else {
      c.satiety = Math.max(0, c.satiety - dt * c.satietyDecay);
      const hungerMult = c.satiety <= 0 ? 1.5 : 1.0;
      c.energy -= dt * 0.003 * hungerMult;
      if (speed > 0 && c.state !== 'frantic') c.energy -= dt * speed * 0.001;
    }

    // ── Visual ──────────────────────────────────────
    const growthSize = (0.5 + c.growth * 0.7) * (0.8 + c.level * 0.2);
    const energyScale = 0.7 + c.energy * 0.4;
    const flashBoost = c.eatFlash > 0 ? 1 + c.eatFlash * 0.5 : 1;
    let scale = growthSize * energyScale * flashBoost;
    if (c.state === 'resting') scale *= 0.95 + Math.sin(c.phase * 3) * 0.05;
    if (c.state === 'torpor') scale *= 0.6;
    if (c.state === 'frantic') scale *= 1.1 + Math.sin(c.phase * 8) * 0.08;
    c.mesh.scale.setScalar(scale);
    c.radius = 0.2 * scale;
    if (c.pos.y < c.radius) c.pos.y = c.radius;

    const t = Math.max(0, Math.min(1, c.energy / c.maxEnergy));
    c.mesh.material.color.setRGB(1 - t, t * 0.85, 0);
    c.mesh.material.emissive.setRGB((1 - t) * 0.3, t * 0.22, 0);
    if (c.state === 'frantic') {
      c.mesh.material.emissiveIntensity = 1.0 + Math.sin(c.phase * 10) * 0.5;
      c.mesh.material.emissive.setRGB((1 - t) * 0.5, t * 0.4, 0);
    } else {
      c.mesh.material.emissiveIntensity = 0.3;
      c.mesh.material.emissive.setRGB((1 - t) * 0.3, t * 0.22, 0);
    }
    c.mesh.material.opacity = c.state === 'torpor' ? 0.4 : 1;
    c.mesh.material.transparent = c.state === 'torpor';

    // Name label update (throttled)
    if (Math.floor(c.age * 4) !== Math.floor((c.age - dt) * 4)) {
      const lctx = c.labelCanvas.getContext('2d');
      lctx.clearRect(0, 0, 128, 32);
      lctx.font = '14px system-ui, sans-serif';
      lctx.textAlign = 'center';
      lctx.fillStyle = c.highlighted ? '#ffff44' : '#ffffff';
      lctx.fillText(c.name, 64, 18);
      c.labelSprite.material.map.needsUpdate = true;
    }
    c.labelSprite.position.y = c.radius + 0.35;

    // Perception ring — sync position, color
    c.ringMesh.position.x = c.pos.x;
    c.ringMesh.position.z = c.pos.z;
    // Highlight disc
    if (c.highlighted) {
      c.hlDisc.material.opacity = 1.0 + Math.sin(c.phase * 4) * 0.4;
      c.hlDisc.scale.setScalar(1.0 + Math.sin(c.phase * 4) * 0.2);
      c.mesh.material.emissiveIntensity = 1.8;
      scale *= 1.15;
    } else {
      c.hlDisc.material.opacity = 0;
    }

    if (c.creatureInRange && c.state === 'frantic') {
      c.ringMesh.material.color.set('#ff3333');
      c.ringMesh.material.opacity = 0.5;
    } else if (c.creatureInRange) {
      c.ringMesh.material.color.set('#ccccff');
      c.ringMesh.material.opacity = 0.35;
    } else if (c.foodInRange) {
      c.ringMesh.material.color.set('#ffaa44');
      c.ringMesh.material.opacity = 0.45;
    } else {
      c.ringMesh.material.color.set('#556688');
      c.ringMesh.material.opacity = 0.15;
    }

    // HP regen (when not recently hit)
    if (c.age - c.lastHitTime > 2) {
      c.hp = Math.min(c.maxHP, c.hp + dt * 0.15);
    }

    // Death — corpse remains on field as food
    if (c.energy <= 0 || c.hp <= 0) {
      const corpseEnergy = Math.max(0.1, c.energy * 0.4);
      const corpseSatiety = Math.max(0.1, c.satiety * 0.4);
      const size = corpseEnergy > 0.8 ? 'l' : corpseEnergy > 0.4 ? 'm' : 's';
      // Spawn corpse nutrient at ground level
      const corpsePos = c.pos.clone();
      corpsePos.y = 0.12;
      const n = spawnNutrientReturn(corpsePos, size);
      if (n) {
        n.energy = corpseEnergy;
        n.satiety = corpseSatiety;
        n.maxEnergy = corpseEnergy;
        n.maxSatiety = corpseSatiety;
        n.mesh.material.color.set('#884422');
        n.mesh.material.opacity = 0.8;
        n.mesh.material.transparent = true;
        n.life = 40;
      }
      scene.remove(c.mesh);
      scene.remove(c.ringMesh);
      creatures.splice(i, 1);
      continue;
    }

    c.mesh.position.copy(c.pos);
  }
}

function pickWanderTarget(c) {
  const angle = c.heading + (Math.random() - 0.5) * Math.PI;
  const dist = 1 + Math.random() * 3;
  c.wanderTarget = new THREE.Vector3(
    Math.cos(angle) * dist,
    0.15,
    Math.sin(angle) * dist
  );
}

function angleToward(from, to) {
  return Math.atan2(to.z - from.z, to.x - from.x);
}

function isKin(a, b) {
  // Check if any common ancestor in the chain
  let p = a;
  while (p) {
    if (p === b) return true;
    p = p.parent;
  }
  p = b;
  while (p) {
    if (p === a) return true;
    p = p.parent;
  }
  // Same parent = siblings
  if (a.parent && a.parent === b.parent) return true;
  return false;
}

// ── Family connection lines ─────────────────────
const familyLines = new Map(); // child creature → line object

function updateFamilyLines() {
  // Remove lines for dead children or broken parent links
  for (const [child, line] of familyLines) {
    if (!creatures.includes(child) || !creatures.includes(child.parent)) {
      scene.remove(line);
      familyLines.delete(child);
    }
  }
  // Create lines for new parent-child pairs, update existing
  for (const c of creatures) {
    if (c.parent && creatures.includes(c.parent)) {
      let line = familyLines.get(c);
      if (!line) {
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const mat = new THREE.LineBasicMaterial({ color: '#88aacc', transparent: true, opacity: 0.4, depthTest: true });
        line = new THREE.Line(geo, mat);
        scene.add(line);
        familyLines.set(c, line);
      }
      // Update positions
      const pos = line.geometry.attributes.position;
      pos.setXYZ(0, c.pos.x, c.radius + 0.1, c.pos.z);
      pos.setXYZ(1, c.parent.pos.x, c.parent.radius + 0.1, c.parent.pos.z);
      pos.needsUpdate = true;
    }
  }
}

// ── Click Interaction ──────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clickPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0.05, 0)
);
const intersectPt = new THREE.Vector3();

let clickMode = 'look'; // 'look' | 'feed'

renderer.domElement.addEventListener('click', (e) => {
  if (e.target.closest('#palette') || e.target.closest('#status-panel')) return;
  if (clickMode !== 'feed') return;

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  if (raycaster.ray.intersectPlane(clickPlane, intersectPt)) {
    const x = intersectPt.x;
    const z = intersectPt.z;
    if (Math.abs(x) < ARENA_HALF - 0.2 && Math.abs(z) < ARENA_HALF - 0.2) {
      for (let i = 0; i < foodCount; i++) {
        const p = new THREE.Vector3(
          x + (Math.random() - 0.5) * 0.15,
          1.5 + Math.random() * 0.5,
          z + (Math.random() - 0.5) * 0.15
        );
        spawnNutrient(p, getFoodSize());
      }
    }
  }
});

// ── Details Overlay ────────────────────────────
function refreshDetails() {
  const body = document.getElementById('details-body');
  if (creatures.length === 0) {
    body.innerHTML = '<div style="color:#666;text-align:center;padding:20px">No creatures alive</div>';
    return;
  }
  let html = '';
  for (let i = 0; i < creatures.length; i++) {
    const c = creatures[i];
    const hpRatio = c.hp / c.maxHP;
    const hpR = Math.floor((1 - hpRatio) * 255);
    const hpG = Math.floor(hpRatio * 200);
    const pct = ((c.hp / c.maxHP) * 100).toFixed(0);
    const nrgPct = ((c.energy / c.maxEnergy) * 100).toFixed(0);
    const satPct = ((c.satiety / c.maxSatiety) * 100).toFixed(0);
    const ageStr = c.growth < 1 ? 'Growing' : 'Adult';
    const stateLabel = c.state === 'torpor' ? 'Torpor' : c.state === 'frantic' ? 'Frantic' : c.state === 'lethargic' ? 'Lethargic' : c.satiety <= 0 ? 'Hungry' : c.state.charAt(0).toUpperCase() + c.state.slice(1);
    html += `<div class="detail-card">
      <div class="detail-header">
        <div class="creature-dot" style="background:rgb(${hpR},${hpG},0);box-shadow:0 0 8px rgb(${hpR},${hpG},0)"></div>
        <div class="detail-name" style="cursor:pointer" title="Click to rename" onclick="this.contentEditable='true';this.focus();this.onblur=()=>{this.contentEditable='false';window._renameCreature(${i},this.textContent)}">${c.name}</div>
      </div>
      <div class="detail-grid">
        <div>Level <span>${c.level}</span></div>
        <div>HP <span>${pct}%</span></div>
        <div>Energy <span>${nrgPct}%</span></div>
        <div>Satiety <span>${satPct}%</span></div>
        <div>Age <span>${Math.floor(c.age)}s</span></div>
        <div>Growth <span>${(c.growth * 100).toFixed(0)}%</span></div>
        <div>Stage <span>${ageStr}</span></div>
        <div>State <span>${stateLabel}</span></div>
        <div>Position <span>${c.pos.x.toFixed(1)}, ${c.pos.z.toFixed(1)}</span></div>
        <div class="detail-bar-bg"><div class="detail-bar-fill" style="width:${pct}%;background:rgb(${hpR},${hpG},0)"></div></div>
      </div>
    </div>`;
  }
  body.innerHTML = html;
}

// Global rename handler for details overlay
window._renameCreature = function(idx, newName) {
  if (idx >= 0 && idx < creatures.length && newName.trim()) {
    creatures[idx].name = newName.trim();
  }
};

document.getElementById('details-btn').addEventListener('click', () => {
  refreshDetails();
  document.getElementById('details-overlay').classList.remove('hidden');
});

document.getElementById('details-close-btn').addEventListener('click', () => {
  document.getElementById('details-overlay').classList.add('hidden');
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('details-overlay').classList.add('hidden');
  }
  if (e.key === 'm' || e.key === 'M') {
    const overlay = document.getElementById('details-overlay');
    if (overlay.classList.contains('hidden')) {
      refreshDetails();
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }
});

// Click mode toggle
document.getElementById('click-mode-btn').addEventListener('click', () => {
  clickMode = clickMode === 'feed' ? 'look' : 'feed';
  const btn = document.getElementById('click-mode-btn');
  btn.textContent = `Click: ${clickMode === 'feed' ? 'Feed' : 'Look'}`;
  btn.className = `action-btn ${clickMode === 'feed' ? 'mode-feed' : 'mode-look'}`;
});

// ── UI State ───────────────────────────────────
let paused = false;
const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 5, 10];
let speedIdx = 2; // default: ×1
let speedMultiplier = SPEED_OPTIONS[speedIdx];
let elapsedSeconds = 0;

// Sprinkle
document.getElementById('sprinkle-btn').addEventListener('click', () => {
  for (let i = 0; i < foodCount; i++) {
    const p = new THREE.Vector3(
      (Math.random() - 0.5) * (ARENA_HALF * 2 - 1),
      1.5 + Math.random() * 1.0,
      (Math.random() - 0.5) * (ARENA_HALF * 2 - 1)
    );
    spawnNutrient(p, getFoodSize());
  }
});

// +1 Creature
document.getElementById('add-creature-btn').addEventListener('click', () => {
  const p = new THREE.Vector3(
    (Math.random() - 0.5) * (ARENA_HALF * 2 - 1),
    0.15,
    (Math.random() - 0.5) * (ARENA_HALF * 2 - 1)
  );
  spawnCreature(p);
});

// Speed popup
const speedBtn = document.getElementById('speed-btn');
const speedPopup = document.getElementById('speed-popup');

function setSpeed(idx) {
  speedIdx = idx;
  speedMultiplier = SPEED_OPTIONS[idx];
  speedBtn.textContent = `Speed x${speedMultiplier}`;
  speedPopup.querySelectorAll('.speed-opt').forEach((b, i) => {
    b.classList.toggle('active', i === idx);
  });
  speedPopup.classList.add('hidden');
}

speedBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  speedPopup.classList.toggle('hidden');
});

speedPopup.querySelectorAll('.speed-opt').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setSpeed(parseInt(btn.dataset.idx));
  });
});

// Food size + count selector
let selectedFoodSize = 'm';
let foodCount = 3;
const foodsizeBtn = document.getElementById('foodsize-btn');
const foodsizePopup = document.getElementById('foodsize-popup');

function getFoodSize() {
  return selectedFoodSize === 'r' ? randomNutrientSize() : selectedFoodSize;
}

function updateFoodLabel() {
  const label = selectedFoodSize === 'r' ? 'Random' : selectedFoodSize.toUpperCase();
  foodsizeBtn.textContent = `Food: ${label} x${foodCount}`;
}

foodsizeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  foodsizePopup.classList.toggle('hidden');
});

foodsizePopup.querySelectorAll('[data-size]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedFoodSize = btn.dataset.size;
    foodsizePopup.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('active', b.dataset.size === selectedFoodSize));
    updateFoodLabel();
  });
});

foodsizePopup.querySelectorAll('[data-count]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    foodCount = parseInt(btn.dataset.count);
    foodsizePopup.querySelectorAll('[data-count]').forEach(b => b.classList.toggle('active', parseInt(b.dataset.count) === foodCount));
    updateFoodLabel();
  });
});

document.addEventListener('click', () => {
  speedPopup.classList.add('hidden');
  foodsizePopup.classList.add('hidden');
});

// Pause toggle
document.getElementById('pause-btn').addEventListener('click', () => {
  paused = !paused;
  document.getElementById('pause-btn').textContent = paused ? 'Resume' : 'Pause';
});

// Reset
document.getElementById('reset-btn').addEventListener('click', () => {
  for (const c of creatures) scene.remove(c.mesh);
  creatures.length = 0;
  for (const n of nutrients) scene.remove(n.mesh);
  nutrients.length = 0;
  spawnCreature(new THREE.Vector3(0, 0.15, 0));
  paused = false;
  setSpeed(2);
  elapsedSeconds = 0;
  gameHours = 7;
  dayCount = 1;
  updateTimeOfDay();
  document.getElementById('pause-btn').textContent = 'Pause';
});

// ── Resize ─────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Game Loop ──────────────────────────────────
const clock = new THREE.Clock();

function formatTime(h) {
  const hr = Math.floor(h) % 24;
  const min = Math.floor((h % 1) * 60);
  return `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function timePeriod(h) {
  if (h >= 5 && h < 8) return 'Dawn';
  if (h >= 8 && h < 17) return 'Day';
  if (h >= 17 && h < 20) return 'Dusk';
  return 'Night';
}

let statusUpdateTimer = 0;
function updateHUD() {
  document.getElementById('info').textContent =
    `Day ${dayCount} | ${formatTime(gameHours)} (${timePeriod(gameHours)}) | Creatures: ${creatures.length}`;
  statusUpdateTimer += 0.016;
  if (statusUpdateTimer > 0.5) {
    updateStatusPanel();
    statusUpdateTimer = 0;
  }
}

// Global focus function for status panel buttons
let selectedCreature = -1;
window.focusCreature = function(idx) {
  creatures.forEach(c2 => c2.highlighted = false);
  if (selectedCreature !== idx) {
    if (creatures[idx]) creatures[idx].highlighted = true;
    selectedCreature = idx;
  } else {
    selectedCreature = -1;
  }
};

function updateStatusPanel() {
  const list = document.getElementById('status-list');
  if (creatures.length === 0) {
    list.innerHTML = '<div style="color:#666;padding:4px 0">No creatures alive</div>';
    return;
  }
  // Sort by name
  const sorted = creatures.map((c, i) => ({ c, i })).sort((a, b) => a.c.name.localeCompare(b.c.name));
  let html = '';
  for (const { c, i } of sorted) {
    const t = Math.max(0, Math.min(1, c.energy / c.maxEnergy));
    const r = Math.floor((1 - t) * 255);
    const g = Math.floor(t * 200);
    const hpRatio = c.hp / c.maxHP;
    const hpR = Math.floor((1 - hpRatio) * 255);
    const hpG = Math.floor(hpRatio * 200);
    const dotColor = `rgb(${hpR},${hpG},0)`;
    const stateLabel = c.state === 'torpor' ? 'TOR' : c.state === 'frantic' ? 'FRN' : c.state === 'lethargic' ? 'LET' : c.state === 'eating' ? 'EAT' : c.state === 'resting' ? 'RST' : '';
    const hpPct = Math.floor((c.hp / c.maxHP) * 100);
    const enPct = Math.floor((c.energy / c.maxEnergy) * 100);
    const satPct = Math.floor(c.satiety * 100);
    const hpColor = `rgb(${Math.floor((1 - c.hp) * 255)},${Math.floor(c.hp * 200)},0)`;
    const enColor = `rgb(${Math.floor((1 - c.energy/c.maxEnergy) * 255)},${Math.floor((c.energy/c.maxEnergy) * 200)},0)`;
    const satColor = c.satiety > 0.3 ? '#88bb44' : c.satiety > 0 ? '#ddaa33' : '#dd4433';
    const parentInfo = c.parent && creatures.includes(c.parent) ? ` ← ${c.parent.name}` : '';
    const childInfo = c.children && c.children.filter(ch => creatures.includes(ch)).length > 0 ? ` +${c.children.filter(ch => creatures.includes(ch)).length}` : '';
    html += `<div class="creature-row" data-idx="${i}" onclick="window.focusCreature(${i})">
      <div class="creature-dot" style="background:${dotColor};box-shadow:0 0 6px ${dotColor}"></div>
      <div class="creature-stats">
        <div class="stat-line">${c.name}${parentInfo}${childInfo} <span class="stat-label">Lv${c.level} ${stateLabel}</span></div>
        <div class="gauge-row"><span class="gauge-label">HP</span><div class="gauge-bg"><div class="gauge-fill" style="width:${hpPct}%;background:${hpColor}"></div></div><span class="gauge-pct">${hpPct}%</span></div>
        <div class="gauge-row"><span class="gauge-label">EN</span><div class="gauge-bg"><div class="gauge-fill" style="width:${enPct}%;background:${enColor}"></div></div><span class="gauge-pct">${enPct}%</span></div>
        <div class="gauge-row"><span class="gauge-label">SAT</span><div class="gauge-bg"><div class="gauge-fill" style="width:${satPct}%;background:${satColor}"></div></div><span class="gauge-pct">${satPct}%</span></div>
      </div>
    </div>`;
  }
  list.innerHTML = html;
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05) * speedMultiplier;

  if (!paused) {
    updateNutrients(dt);
    updateCreatures(dt);
    elapsedSeconds += dt;
    // Advance game time
    const prevHours = gameHours;
    gameHours += dt / SECONDS_PER_DAY * 24;
    if (gameHours >= 24) {
      gameHours -= 24;
      dayCount++;
    }
    if (Math.floor(gameHours) !== Math.floor(prevHours % 24)) {
      updateTimeOfDay();
    }
  }

  controls.update();
  renderer.render(scene, camera);
  updateHUD();
  if (!document.getElementById('details-overlay').classList.contains('hidden')) {
    refreshDetails();
  }
  requestAnimationFrame(animate);
}

// ── Start ──────────────────────────────────────
updateTimeOfDay();
spawnCreature(new THREE.Vector3(0, 0.15, 0));
console.log('Microcosm setup complete, starting animation');
requestAnimationFrame(animate);

} catch (e) { console.error('INIT ERROR:', e); }
