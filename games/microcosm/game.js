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
controls.maxDistance = 10;
controls.maxPolarAngle = 2.2;
controls.update();

// ── Lighting ───────────────────────────────────
const ambient = new THREE.AmbientLight('#ffffff', 0.4);
scene.add(ambient);
const sun = new THREE.DirectionalLight('#ffffff', 1.0);
sun.position.set(5, 8, 3);
scene.add(sun);

// Night fill light (dim blue, faces upward for subtle ground visibility)
const moonLight = new THREE.PointLight('#334466', 3, 12, 2);
moonLight.position.set(0, 4, 0);
scene.add(moonLight);

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

// ── Time-of-Day Presets ─────────────────────────
const TIME_KEYFRAMES = [
  { h: 0,  bg: '#0f0f24', fog: '#0f0f24', amb: '#334466', ambI: 0.22, sun: '#334466', sunI: 0.0, moonI: 1.2 },
  { h: 5,  bg: '#1a1530', fog: '#1a1530', amb: '#445577', ambI: 0.25, sun: '#886644', sunI: 0.1, moonI: 0.8 },
  { h: 6,  bg: '#d49060', fog: '#c8a090', amb: '#886655', ambI: 0.35, sun: '#ffaa66', sunI: 0.6, moonI: 0.0 },
  { h: 8,  bg: '#a0d8f0', fog: '#a0c8e0', amb: '#ffffff', ambI: 0.45, sun: '#ffffdd', sunI: 1.0, moonI: 0.0 },
  { h: 12, bg: '#7ec8e3', fog: '#a0c8e0', amb: '#ffffff', ambI: 0.5,  sun: '#ffffff', sunI: 1.2, moonI: 0.0 },
  { h: 16, bg: '#a0d0e8', fog: '#a0c0d8', amb: '#ffffff', ambI: 0.45, sun: '#ffeedd', sunI: 1.0, moonI: 0.0 },
  { h: 18, bg: '#e88850', fog: '#d09080', amb: '#996655', ambI: 0.35, sun: '#ff8844', sunI: 0.6, moonI: 0.0 },
  { h: 20, bg: '#1a1030', fog: '#1a1030', amb: '#334466', ambI: 0.25, sun: '#443355', sunI: 0.05, moonI: 0.7 },
  { h: 24, bg: '#0f0f24', fog: '#0f0f24', amb: '#334466', ambI: 0.22, sun: '#334466', sunI: 0.0, moonI: 1.2 },
];

function lerpColor(a, b, t) {
  const ac = new THREE.Color(a), bc = new THREE.Color(b);
  return ac.lerp(bc, t);
}

function lerpNum(a, b, t) { return a + (b - a) * t; }

function updateTimeOfDay() {
  const h = gameHours;
  // Find surrounding keyframes
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

  scene.background = lerpColor(prev.bg, next.bg, t);
  scene.fog.color = lerpColor(prev.fog, next.fog, t);
  ambient.color = lerpColor(prev.amb, next.amb, t);
  ambient.intensity = lerpNum(prev.ambI, next.ambI, t);
  sun.color = lerpColor(prev.sun, next.sun, t);
  sun.intensity = lerpNum(prev.sunI, next.sunI, t);
  moonLight.intensity = lerpNum(prev.moonI, next.moonI, t) * 3;

  // Sun angle: rises in east (-X side), peaks overhead, sets in west (+X side)
  const sunAngle = -(h / 24) * Math.PI * 2 + Math.PI / 2;
  const sunDist = 8;
  sun.position.set(Math.cos(sunAngle) * sunDist, Math.sin(sunAngle) * sunDist + 2, -3);

  // Sun mesh follows directional light, visible when above horizon
  const sunY = Math.sin(sunAngle);
  sunMesh.position.copy(sun.position);
  sunMesh.visible = sunY > -0.05;
  sunMesh.material.opacity = Math.max(0, Math.min(1, sunY * 4));
  sunMesh.material.transparent = true;
  glowMesh.visible = sunY > 0.1;

  // Moon: opposite side of sky from sun
  const moonAngle = sunAngle + Math.PI;
  const moonDist = 7;
  moonMesh.position.set(Math.cos(moonAngle) * moonDist, Math.sin(moonAngle) * moonDist + 2, -2);
  const moonY = Math.sin(moonAngle);
  moonMesh.visible = moonY > 0;
  moonMesh.material.opacity = Math.max(0, Math.min(1, moonY * 3));
  moonMesh.material.transparent = true;

  // Stars: visible at night, fade with moonlight
  const nightFactor = moonLight.intensity;
  stars.material.opacity = nightFactor * 0.8;
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
const nutrientGeo = new THREE.SphereGeometry(0.08, 8, 8);
const nutrientMat = new THREE.MeshBasicMaterial({ color: '#ffdd88' });

function spawnNutrient(pos) {
  const mesh = new THREE.Mesh(nutrientGeo, nutrientMat.clone());
  mesh.position.copy(pos);
  scene.add(mesh);
  nutrients.push({
    pos: pos.clone(),
    vel: new THREE.Vector3(0, -0.05, 0),
    mesh,
    life: 30,
  });
}

function updateNutrients(dt) {
  for (let i = nutrients.length - 1; i >= 0; i--) {
    const n = nutrients[i];
    n.life -= dt;
    if (n.life <= 0) {
      scene.remove(n.mesh);
      nutrients.splice(i, 1);
      continue;
    }

    // Gravity
    n.vel.y -= 9.8 * dt;

    // Brownian sway
    n.vel.x += (Math.random() - 0.5) * 0.02;
    n.vel.z += (Math.random() - 0.5) * 0.02;

    // Fall and move
    n.pos.x += n.vel.x * dt;
    n.pos.y += n.vel.y * dt;
    n.pos.z += n.vel.z * dt;

    // Damping
    n.vel.x *= 0.98;
    n.vel.z *= 0.98;

    // Stop at floor
    if (n.pos.y <= 0.1) {
      n.pos.y = 0.1;
      n.vel.y = 0;
      n.vel.x *= 0.9;
      n.vel.z *= 0.9;
    }

    // Clamp to arena horizontal bounds
    n.pos.x = Math.max(-ARENA_HALF + 0.1, Math.min(ARENA_HALF - 0.1, n.pos.x));
    n.pos.z = Math.max(-ARENA_HALF + 0.1, Math.min(ARENA_HALF - 0.1, n.pos.z));

    n.mesh.position.copy(n.pos);

    // Fade near end of life
    if (n.life < 5) {
      n.mesh.material.opacity = n.life / 5;
      n.mesh.material.transparent = true;
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
  // Individual color variation — slightly different greens
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
    age: 0,
    phase: Math.random() * Math.PI * 2,
    mesh,
    eatFlash: 0,
    foodNoticeAt: 0,
    // Individual traits
    baseSpeed,
    metabolism: 0.03 + Math.random() * 0.025,
    detectRange: 2.5 + Math.random() * 1.5,
    reactionTime: 0.2 + Math.random() * 1.3,
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

    // ── State transitions ──────────────────────────
    const energyRatio = c.energy / 1.5;

    // Lethargic when energy very low
    if (energyRatio < 0.2 && c.state !== 'lethargic') {
      c.state = 'lethargic';
      c.stateTimer = 0;
    }
    if (c.state === 'lethargic' && energyRatio > 0.35) {
      c.state = 'exploring';
      c.stateTimer = 1 + Math.random() * 2;
    }

    // Check for nearby food
    let nearestDist = c.detectRange;
    let nearestNutrient = null;
    for (const n of nutrients) {
      const dist = c.pos.distanceTo(n.pos);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestNutrient = n;
      }
    }

    // Food reaction with delay
    if (nearestNutrient && c.state !== 'lethargic') {
      if (c.foodNoticeAt === 0) c.foodNoticeAt = c.age + c.reactionTime;
      if (c.age >= c.foodNoticeAt && c.state !== 'seeking') {
        c.state = 'seeking';
        c.stateTimer = 0;
      }
    } else if (c.state === 'seeking' && !nearestNutrient) {
      c.foodNoticeAt = 0;
      c.state = 'exploring';
      c.stateTimer = 1 + Math.random() * 2;
    }

    // Resting — random pauses
    if (c.state === 'exploring' && c.satisfiedTimer <= 0) {
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
      if (c.stateTimer < -3 && !nearestNutrient) {
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
        speed = c.baseSpeed * 0.25 * energyRatio;
        if (!c.wanderTarget || c.pos.distanceTo(c.wanderTarget) < 0.3) {
          pickWanderTarget(c);
        }
        targetAngle = angleToward(c.pos, c.wanderTarget);
        break;

      case 'resting':
        speed = 0;
        break;

      case 'seeking':
        if (nearestNutrient) {
          const dist = c.pos.distanceTo(nearestNutrient.pos);
          const urgency = 1 + (1 - Math.min(dist, c.detectRange) / c.detectRange) * 2;
          speed = c.baseSpeed * 1.4 * urgency;
          targetAngle = angleToward(c.pos, nearestNutrient.pos);
          c.stateTimer = 0;
        }
        break;

      case 'exploring':
      default: {
        speed = c.baseSpeed * (0.6 + energyRatio * 0.5);
        if (c.satisfiedTimer > 0) speed *= 0.5;
        if (!c.wanderTarget || c.pos.distanceTo(c.wanderTarget) < 0.3) {
          pickWanderTarget(c);
        }
        targetAngle = angleToward(c.pos, c.wanderTarget);
        break;
      }
    }

    // Smoothly rotate heading toward target (curved movement)
    let angleDiff = targetAngle - c.heading;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    const turnRate = 2.5 + Math.random() * 0.5;
    c.heading += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate * dt);

    // Move forward in heading direction
    if (speed > 0) {
      const jitterX = (Math.random() - 0.5) * speed * 0.3;
      const jitterZ = (Math.random() - 0.5) * speed * 0.3;
      c.pos.x += (Math.cos(c.heading) * speed + jitterX) * dt;
      c.pos.z += (Math.sin(c.heading) * speed + jitterZ) * dt;
    }

    // Creature-creature avoidance
    for (let j = 0; j < creatures.length; j++) {
      if (i === j) continue;
      const other = creatures[j];
      const d = c.pos.distanceTo(other.pos);
      const minDist = 0.5;
      if (d < minDist && d > 0.001) {
        const pushX = (c.pos.x - other.pos.x) / d * (minDist - d) * 1.5;
        const pushZ = (c.pos.z - other.pos.z) / d * (minDist - d) * 1.5;
        c.pos.x += pushX * dt;
        c.pos.z += pushZ * dt;
        // Deflect heading
        c.heading += (Math.random() - 0.5) * 0.5;
      }
    }

    // Subtle bouncy vertical motion
    const bobAmp = c.state === 'resting' ? 0.01 : 0.03;
    c.pos.y += Math.sin(c.phase * 1.8) * bobAmp * dt;
    if (c.pos.y > 0.2) c.pos.y -= 0.2 * dt;

    // Eat nutrients
    for (let j = nutrients.length - 1; j >= 0; j--) {
      const n = nutrients[j];
      const dist = c.pos.distanceTo(n.pos);
      if (dist < 0.35) {
        c.energy = Math.min(1.5, c.energy + 0.15);
        c.eatFlash = 0.5;
        c.wanderTarget = null;
        c.foodNoticeAt = 0;
        c.satisfiedTimer = 1.5 + Math.random() * 2;
        if (c.state === 'seeking') {
          c.state = 'exploring';
          c.stateTimer = 2 + Math.random() * 3;
        }
        scene.remove(n.mesh);
        nutrients.splice(j, 1);
      }
    }

    // Bounds
    const bound = ARENA_HALF - 0.3;
    if (c.pos.x > bound) { c.pos.x = bound; c.heading = Math.PI; }
    if (c.pos.x < -bound) { c.pos.x = -bound; c.heading = 0; }
    if (c.pos.z > bound) { c.pos.z = bound; c.heading = -Math.PI / 2; }
    if (c.pos.z < -bound) { c.pos.z = -bound; c.heading = Math.PI / 2; }
    if (c.pos.y > 2.0) c.pos.y = 2.0;

    // Energy decay
    c.energy -= dt * c.metabolism;

    // ── Visual ──────────────────────────────────────
    const energyScale = 0.7 + c.energy * 0.4;
    const flashBoost = c.eatFlash > 0 ? 1 + c.eatFlash * 0.5 : 1;
    let scale = energyScale * flashBoost;
    // Pulsing when resting
    if (c.state === 'resting') {
      scale *= 0.95 + Math.sin(c.phase * 3) * 0.05;
    }
    c.mesh.scale.setScalar(scale);

    const radius = 0.2 * scale;
    if (c.pos.y < radius) c.pos.y = radius;

    // Color based on energy (preserve individual hue base in bright green range)
    const t = Math.max(0, Math.min(1, c.energy / 1.5));
    c.mesh.material.color.setRGB(1 - t, t * 0.85, 0);
    c.mesh.material.emissive.setRGB((1 - t) * 0.3, t * 0.22, 0);

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

let clickMode = 'feed'; // 'feed' | 'look'

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
      const count = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const p = new THREE.Vector3(
          x + (Math.random() - 0.5) * 0.15,
          1.5 + Math.random() * 0.5,
          z + (Math.random() - 0.5) * 0.15
        );
        spawnNutrient(p);
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
    html += `<div class="detail-card">
      <div class="detail-header">
        <div class="creature-dot" style="background:rgb(${r},${g},0);box-shadow:0 0 8px rgb(${r},${g},0)"></div>
        <div class="detail-name">Creature #${i + 1}</div>
      </div>
      <div class="detail-grid">
        <div>Vitality <span>${pct}%</span></div>
        <div>Age <span>${Math.floor(c.age)}s</span></div>
        <div>Energy <span>${c.energy.toFixed(3)}</span></div>
        <div>Position <span>${c.pos.x.toFixed(1)}, ${c.pos.z.toFixed(1)}</span></div>
        <div style="color:${pct > 30 ? '#888' : '#e44'}">Status <span>${pct > 50 ? 'Healthy' : pct > 20 ? 'Weakening' : 'Dying'}</span></div>
        <div>Food eaten <span>${Math.max(0, Math.floor((c.energy - 1.0) / 0.15))}</span></div>
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
let speedMultiplier = 1;
let elapsedSeconds = 0;

// Sprinkle
document.getElementById('sprinkle-btn').addEventListener('click', () => {
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Vector3(
      (Math.random() - 0.5) * (ARENA_HALF * 2 - 1),
      1.5 + Math.random() * 1.0,
      (Math.random() - 0.5) * (ARENA_HALF * 2 - 1)
    );
    spawnNutrient(p);
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

// Speed toggle
document.getElementById('speed-btn').addEventListener('click', () => {
  speedMultiplier = speedMultiplier === 1 ? 2 : 1;
  document.getElementById('speed-btn').textContent = `Speed x${speedMultiplier}`;
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
  speedMultiplier = 1;
  elapsedSeconds = 0;
  gameHours = 7;
  dayCount = 1;
  updateTimeOfDay();
  document.getElementById('pause-btn').textContent = 'Pause';
  document.getElementById('speed-btn').textContent = 'Speed x1';
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
    html += `<div class="creature-row">
      <div class="creature-dot" style="background:${dotColor};box-shadow:0 0 6px ${dotColor}"></div>
      <div class="creature-stats">#${i + 1} &nbsp;VIT ${(c.energy * 100).toFixed(0)}% &nbsp;| &nbsp;${Math.floor(c.age)}s</div>
    </div>`;
  }
  list.innerHTML = html;
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05) * speedMultiplier;

  if (!paused) {
    updateNutrients(dt);
    updateCreatures(dt);
    elapsedSeconds += dt / speedMultiplier;
    // Advance game time
    const prevHours = gameHours;
    gameHours += (dt / speedMultiplier) / SECONDS_PER_DAY * 24;
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
