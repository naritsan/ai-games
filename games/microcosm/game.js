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
  const def = NUTRIENT_DEFS[size];
  const mesh = new THREE.Mesh(nutrientGeos[size], new THREE.MeshBasicMaterial({ color: def.color }));
  mesh.position.copy(pos);
  scene.add(mesh);
  nutrients.push({
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
  });
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

  const baseSpeed = 0.5 + Math.random() * 0.7;
  creatures.push({
    pos: pos.clone(),
    heading: Math.random() * Math.PI * 2,
    energy: 1.0,
    satiety: 0.6 + Math.random() * 0.4,
    age: 0,
    phase: Math.random() * Math.PI * 2,
    mesh,
    eatFlash: 0,
    foodNoticeAt: 0,
    // Individual traits
    baseSpeed,
    satietyDecay: 0.08 + Math.random() * 0.04, // ~2 game hours to deplete
    detectRange: 2.5 + Math.random() * 1.5,
    reactionTime: 0.2 + Math.random() * 1.3,
    aggression: Math.random(), // 0=docile, 1=fierce
    // Growth & lifespan
    growth: 0.2 + Math.random() * 0.15,
    maxAge: 80 + Math.random() * 80,
    // State
    state: 'exploring',
    stateTimer: 2 + Math.random() * 3,
    restTimer: 0,
    satisfiedTimer: 0,
    wanderTarget: null,
  });
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

    // ── Aging ───────────────────────────────────────
    const elderly = c.age > c.maxAge * 0.8;
    const dying = c.age > c.maxAge;
    if (dying) c.energy -= dt * 0.06; // rapid decline past maxAge

    // ── Eating: contact-based, multi-creature ──────
    // Find food in contact range (before eating check, so any state can eat)
    let touchingFood = null;
    for (const n of nutrients) {
      if (c.pos.distanceTo(n.pos) < 0.45) {
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
        c.energy = Math.min(1.5, c.energy + n.maxEnergy * 0.25);
        c.satiety = Math.min(1.0, c.satiety + n.maxSatiety * 0.25);
        c.eatFlash = 0.3;
      }
      // Pulse while eating
      const gs = 0.5 + c.growth * 0.7;
      const es = 0.7 + c.energy * 0.4;
      const pulse = 1 + Math.sin(c.phase * 6) * 0.06;
      c.mesh.scale.setScalar(gs * es * pulse);
      if (n.eatProgress >= 1) {
        c.satisfiedTimer = 1 + Math.random() * 1.5;
        c.wanderTarget = null;
        c.foodNoticeAt = 0;
        scene.remove(n.mesh);
        nutrients.splice(nutrients.indexOf(n), 1);
      }
      c.phase += dt * 3;
      c.satiety -= dt * c.satietyDecay;
      c.mesh.position.copy(c.pos);
      continue;
    }

    if (c.state === 'eating') {
      c.state = 'exploring';
      c.stateTimer = 1 + Math.random();
    }

    // ── State transitions ──────────────────────────
    const energyRatio = c.energy / 1.5;
    const speedMod = elderly ? 0.5 : 1.0;

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

    // Check nearby food (unclaimed only)
    let nearestDist = c.detectRange;
    let nearestNutrient = null;
    for (const n of nutrients) {
      const dist = c.pos.distanceTo(n.pos);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestNutrient = n;
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

      case 'seeking':
        if (nearestNutrient) {
          const dist = c.pos.distanceTo(nearestNutrient.pos);
          const desperate = c.satiety <= 0;
          const urgency = desperate ? 3.5 : (1 + (1 - Math.min(dist, c.detectRange) / c.detectRange) * 2);
          const closeFactor = desperate ? 1.0 : Math.min(1, dist / 0.8);
          speed = c.baseSpeed * 1.4 * urgency * speedMod * closeFactor;
          targetAngle = angleToward(c.pos, nearestNutrient.pos);
          c.stateTimer = 0;
          // Eating starts on contact in the shared eating block above
          if (dist < 0.45) {
            c.foodNoticeAt = 0;
            continue;
          }
        }
        break;

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

      case 'frantic':
        // Charge mostly straight, occasional random swerves
        speed = c.baseSpeed * 3.0 * speedMod;
        if (!c.wanderTarget || c.pos.distanceTo(c.wanderTarget) < 0.4 || Math.random() < 0.02) {
          const angle = c.heading + (Math.random() - 0.5) * 1.2;
          c.wanderTarget = new THREE.Vector3(
            c.pos.x + Math.cos(angle) * 5, 0.15,
            c.pos.z + Math.sin(angle) * 5
          );
        }
        targetAngle = angleToward(c.pos, c.wanderTarget);
        break;

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
    const turnRate = c.state === 'frantic' ? 7.0 : c.state === 'seeking' ? 5.0 : c.state === 'torpor' ? 0.3 : 3.0 + Math.random() * 0.5;
    c.heading += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate * dt);

    if (speed > 0) {
      const jitterX = (Math.random() - 0.5) * speed * 0.3;
      const jitterZ = (Math.random() - 0.5) * speed * 0.3;
      c.pos.x += (Math.cos(c.heading) * speed + jitterX) * dt;
      c.pos.z += (Math.sin(c.heading) * speed + jitterZ) * dt;
    }

    // Collision + aggression
    for (let j = 0; j < creatures.length; j++) {
      if (i === j) continue;
      const other = creatures[j];
      const d = c.pos.distanceTo(other.pos);
      const minDist = 0.5;
      if (d < minDist && d > 0.001) {
        // Aggressive push: stronger from hungrier or more aggressive creatures
        const myForce = 1 + c.aggression * 2 + (1 - c.satiety) * 2;
        const theirForce = 1 + other.aggression * 2 + (1 - other.satiety) * 2;
        const ratio = myForce / (myForce + theirForce);
        const pushMag = (minDist - d) * 3;
        c.pos.x += (c.pos.x - other.pos.x) / d * pushMag * (1 - ratio) * dt;
        c.pos.z += (c.pos.z - other.pos.z) / d * pushMag * (1 - ratio) * dt;
        c.heading += (Math.random() - 0.5) * (c.state === 'frantic' ? 1.5 : 0.5);
        // Interrupt eating on strong push
        if (pushMag * (1 - ratio) * dt > 0.05 && c.state === 'eating') {
          c.state = 'exploring';
          c.stateTimer = 0.5;
        }
      }
    }

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
      c.energy -= dt * 0.006 * hungerMult * (elderly ? 1.4 : 1.0);
      if (speed > 0 && c.state !== 'frantic') c.energy -= dt * speed * 0.0015;
    }

    // ── Visual ──────────────────────────────────────
    const growthSize = 0.5 + c.growth * 0.7;
    const energyScale = 0.7 + c.energy * 0.4;
    const flashBoost = c.eatFlash > 0 ? 1 + c.eatFlash * 0.5 : 1;
    let scale = growthSize * energyScale * flashBoost;
    if (c.state === 'resting') scale *= 0.95 + Math.sin(c.phase * 3) * 0.05;
    if (c.state === 'torpor') scale *= 0.6;
    if (c.state === 'frantic') scale *= 1.1 + Math.sin(c.phase * 8) * 0.08;
    c.mesh.scale.setScalar(scale);

    const radius = 0.2 * scale;
    if (c.pos.y < radius) c.pos.y = radius;

    const t = Math.max(0, Math.min(1, c.energy / 1.5));
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

    // Death
    if (c.energy <= 0) {
      scene.remove(c.mesh);
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
    const t = Math.max(0, Math.min(1, c.energy / 1.5));
    const r = Math.floor((1 - t) * 255);
    const g = Math.floor(t * 200);
    const pct = (c.energy * 100).toFixed(0);
    const satPct = (c.satiety * 100).toFixed(0);
    const ageStr = c.age > c.maxAge ? 'Dying' : c.age > c.maxAge * 0.8 ? 'Elderly' : c.growth < 1 ? 'Growing' : 'Adult';
    const stateLabel = c.state === 'torpor' ? 'Torpor' : c.state === 'frantic' ? 'Frantic' : c.state === 'lethargic' ? 'Lethargic' : c.satiety <= 0 ? 'Hungry' : c.state.charAt(0).toUpperCase() + c.state.slice(1);
    html += `<div class="detail-card">
      <div class="detail-header">
        <div class="creature-dot" style="background:rgb(${r},${g},0);box-shadow:0 0 8px rgb(${r},${g},0)"></div>
        <div class="detail-name">Creature #${i + 1}</div>
      </div>
      <div class="detail-grid">
        <div>Vitality <span>${pct}%</span></div>
        <div>Satiety <span>${satPct}%</span></div>
        <div>Age <span>${Math.floor(c.age)}s / ${Math.floor(c.maxAge)}s</span></div>
        <div>Growth <span>${(c.growth * 100).toFixed(0)}%</span></div>
        <div>Stage <span>${ageStr}</span></div>
        <div>State <span>${stateLabel}</span></div>
        <div>Position <span>${c.pos.x.toFixed(1)}, ${c.pos.z.toFixed(1)}</span></div>
        <div class="detail-bar-bg"><div class="detail-bar-fill" style="width:${pct}%;background:rgb(${r},${g},0)"></div></div>
      </div>
    </div>`;
  }
  body.innerHTML = html;
}

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

function updateHUD() {
  document.getElementById('info').textContent =
    `Day ${dayCount} | ${formatTime(gameHours)} (${timePeriod(gameHours)}) | Creatures: ${creatures.length}`;
  updateStatusPanel();
}

function updateStatusPanel() {
  const list = document.getElementById('status-list');
  if (creatures.length === 0) {
    list.innerHTML = '<div style="color:#666;padding:4px 0">No creatures alive</div>';
    return;
  }
  let html = '';
  for (let i = 0; i < creatures.length; i++) {
    const c = creatures[i];
    const t = Math.max(0, Math.min(1, c.energy / 1.5));
    const r = Math.floor((1 - t) * 255);
    const g = Math.floor(t * 200);
    const dotColor = `rgb(${r},${g},0)`;
    const stateLabel = c.state === 'torpor' ? 'TOR' : c.state === 'frantic' ? 'FRN' : c.state === 'lethargic' ? 'LET' : c.state === 'eating' ? 'EAT' : c.state === 'resting' ? 'RST' : '';
    const vitPct = Math.floor((c.energy / 1.5) * 100);
    const satPct = Math.floor(c.satiety * 100);
    const vitColor = `rgb(${Math.floor((1 - c.energy/1.5) * 255)},${Math.floor((c.energy/1.5) * 200)},0)`;
    const satColor = c.satiety > 0.3 ? '#88bb44' : c.satiety > 0 ? '#ddaa33' : '#dd4433';
    html += `<div class="creature-row">
      <div class="creature-dot" style="background:${dotColor};box-shadow:0 0 6px ${dotColor}"></div>
      <div class="creature-stats">
        <div class="stat-line">#${i + 1} <span class="stat-label">${stateLabel}</span></div>
        <div class="gauge-row"><span class="gauge-label">VIT</span><div class="gauge-bg"><div class="gauge-fill" style="width:${vitPct}%;background:${vitColor}"></div></div><span class="gauge-pct">${vitPct}%</span></div>
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
