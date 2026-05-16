import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

console.log('Aquarium module loaded');
try {

// ── Scene ──────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game'), antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a1a2e');

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 50);
camera.position.set(4, 5, 7);
camera.lookAt(0, 1.5, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.5, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 2.5;
controls.maxDistance = 10;
controls.maxPolarAngle = 2.2;
controls.update();

// ── Lighting ───────────────────────────────────
scene.add(new THREE.AmbientLight('#ffffff', 0.4));
const sun = new THREE.DirectionalLight('#ffffff', 1.0);
sun.position.set(5, 8, 3);
scene.add(sun);

// ── Glass Tank ─────────────────────────────────
const TANK_W = 4;
const TANK_H = 3;
const TANK_D = 4;
const HALF_W = TANK_W / 2;
const HALF_D = TANK_D / 2;

const glassMat = new THREE.MeshPhysicalMaterial({
  color: '#ffffff',
  transmission: 1.0,
  roughness: 0.05,
  thickness: 0.3,
  ior: 1.5,
  transparent: true,
  opacity: 0.4,
  side: THREE.DoubleSide,
  envMapIntensity: 0.5,
});

// Floor
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(TANK_W, TANK_D),
  glassMat
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.name = 'floor';
scene.add(floor);

// Walls
const wallGeoFb = new THREE.BoxGeometry(TANK_W, TANK_H, 0.02);
const wallGeoLr = new THREE.BoxGeometry(0.02, TANK_H, TANK_D);

// Back
const backWall = new THREE.Mesh(wallGeoFb, glassMat);
backWall.position.set(0, TANK_H / 2, -HALF_D);
backWall.name = 'backWall';
scene.add(backWall);

// Front
const frontWall = new THREE.Mesh(wallGeoFb, glassMat);
frontWall.position.set(0, TANK_H / 2, HALF_D);
frontWall.name = 'frontWall';
scene.add(frontWall);

// Left
const leftWall = new THREE.Mesh(wallGeoLr, glassMat);
leftWall.position.set(-HALF_W, TANK_H / 2, 0);
leftWall.name = 'leftWall';
scene.add(leftWall);

// Right
const rightWall = new THREE.Mesh(wallGeoLr, glassMat);
rightWall.position.set(HALF_W, TANK_H / 2, 0);
rightWall.name = 'rightWall';
scene.add(rightWall);

// Water volume (faint blue fill)
const water = new THREE.Mesh(
  new THREE.BoxGeometry(TANK_W - 0.2, TANK_H - 0.1, TANK_D - 0.2),
  new THREE.MeshBasicMaterial({
    color: '#4488cc',
    transparent: true,
    opacity: 0.06,
    side: THREE.DoubleSide,
  })
);
water.position.set(0, TANK_H / 2, 0);
water.name = 'water';
scene.add(water);

// ── Nutrient System ────────────────────────────
const nutrients = [];
const nutrientGeo = new THREE.SphereGeometry(0.08, 8, 8);
const nutrientMat = new THREE.MeshBasicMaterial({ color: '#ffdd88' });

function spawnNutrient(pos) {
  const mesh = new THREE.Mesh(nutrientGeo, nutrientMat);
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

    // Clamp to tank horizontal bounds
    n.pos.x = Math.max(-HALF_W + 0.1, Math.min(HALF_W - 0.1, n.pos.x));
    n.pos.z = Math.max(-HALF_D + 0.1, Math.min(HALF_D - 0.1, n.pos.z));

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
  const mesh = new THREE.Mesh(creatureGeo, creatureMat);
  mesh.position.copy(pos);
  mesh.castShadow = true;
  scene.add(mesh);

  creatures.push({
    pos: pos.clone(),
    vel: new THREE.Vector3(),
    energy: 1.0,
    age: 0,
    phase: Math.random() * Math.PI * 2,
    mesh,
    eatFlash: 0,
  });
}

function updateCreatures(dt) {
  for (let i = creatures.length - 1; i >= 0; i--) {
    const c = creatures[i];
    c.age += dt;
    c.eatFlash = Math.max(0, c.eatFlash - dt);

    // 1. Drift — Brownian motion with sine-wave bias
    c.phase += dt * 2;
    c.vel.x += Math.sin(c.phase) * 0.3 * dt;
    c.vel.z += Math.cos(c.phase * 0.7) * 0.3 * dt;
    c.vel.x += (Math.random() - 0.5) * 0.2 * dt;
    c.vel.z += (Math.random() - 0.5) * 0.2 * dt;
    c.vel.y += Math.sin(c.phase * 0.5) * 0.1 * dt;

    // 2. Seek nearest nutrient within radius 2.0
    let nearestDist = 2.0;
    let nearestNutrient = null;
    for (const n of nutrients) {
      const dist = c.pos.distanceTo(n.pos);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestNutrient = n;
      }
    }

    if (nearestNutrient) {
      const dir = new THREE.Vector3()
        .copy(nearestNutrient.pos)
        .sub(c.pos)
        .normalize();
      c.vel.x += dir.x * 0.8 * dt;
      c.vel.y += dir.y * 0.8 * dt;
      c.vel.z += dir.z * 0.8 * dt;
    }

    // 3. Eat nutrients in contact
    for (let j = nutrients.length - 1; j >= 0; j--) {
      const n = nutrients[j];
      const dist = c.pos.distanceTo(n.pos);
      if (dist < 0.3) {
        c.energy = Math.min(1.5, c.energy + 0.15);
        c.eatFlash = 0.5;
        scene.remove(n.mesh);
        nutrients.splice(j, 1);
      }
    }

    // 4. Move with damping
    c.vel.x *= 0.94;
    c.vel.y *= 0.94;
    c.vel.z *= 0.94;
    c.pos.x += c.vel.x * dt;
    c.pos.y += c.vel.y * dt;
    c.pos.z += c.vel.z * dt;

    // 5. Bounds — spring force near walls
    const margin = 0.3;
    const spring = 1.5;
    if (c.pos.x > HALF_W - margin) c.vel.x -= (c.pos.x - (HALF_W - margin)) * spring * dt;
    if (c.pos.x < -HALF_W + margin) c.vel.x -= (c.pos.x - (-HALF_W + margin)) * spring * dt;
    if (c.pos.z > HALF_D - margin) c.vel.z -= (c.pos.z - (HALF_D - margin)) * spring * dt;
    if (c.pos.z < -HALF_D + margin) c.vel.z -= (c.pos.z - (-HALF_D + margin)) * spring * dt;
    if (c.pos.y > TANK_H - margin) c.vel.y -= (c.pos.y - (TANK_H - margin)) * spring * dt;
    if (c.pos.y < margin) c.vel.y -= (c.pos.y - margin) * spring * dt;

    // 6. Energy decay
    c.energy -= dt * 0.04;

    // 7. Visual update — size and glow based on energy
    const energyScale = 0.7 + c.energy * 0.4;
    const flashBoost = c.eatFlash > 0 ? 1 + c.eatFlash * 0.5 : 1;
    c.mesh.scale.setScalar(energyScale * flashBoost);
    c.mesh.material.emissiveIntensity = 0.1 + c.energy * 0.4;

    // 8. Death
    if (c.energy <= 0) {
      scene.remove(c.mesh);
      creatures.splice(i, 1);
      continue;
    }

    c.mesh.position.copy(c.pos);
  }
}

// ── Click Interaction ──────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clickPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 2.7, 0)
);
const intersectPt = new THREE.Vector3();

renderer.domElement.addEventListener('click', (e) => {
  if (e.target.closest('#palette')) return;

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  if (raycaster.ray.intersectPlane(clickPlane, intersectPt)) {
    const x = intersectPt.x;
    const z = intersectPt.z;
    if (Math.abs(x) < HALF_W - 0.2 && Math.abs(z) < HALF_D - 0.2) {
      const count = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const p = new THREE.Vector3(
          x + (Math.random() - 0.5) * 0.15,
          2.7,
          z + (Math.random() - 0.5) * 0.15
        );
        spawnNutrient(p);
      }
    }
  }
});

// ── UI State ───────────────────────────────────
let paused = false;
let speedMultiplier = 1;
let elapsedSeconds = 0;

// Sprinkle
document.getElementById('sprinkle-btn').addEventListener('click', () => {
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Vector3(
      (Math.random() - 0.5) * (TANK_W - 0.5),
      2.7,
      (Math.random() - 0.5) * (TANK_D - 0.5)
    );
    spawnNutrient(p);
  }
});

// +1 Creature
document.getElementById('add-creature-btn').addEventListener('click', () => {
  const p = new THREE.Vector3(
    (Math.random() - 0.5) * (TANK_W - 0.5),
    0.5 + Math.random() * (TANK_H - 1.0),
    (Math.random() - 0.5) * (TANK_D - 0.5)
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
  spawnCreature(new THREE.Vector3(0, 1.5, 0));
  paused = false;
  speedMultiplier = 1;
  elapsedSeconds = 0;
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

function updateHUD() {
  const energyStr = creatures.length > 0
    ? `Energy: ${creatures[0].energy.toFixed(2)}`
    : 'Energy: --';
  document.getElementById('info').textContent =
    `Creatures: ${creatures.length} | ${energyStr} | Time: ${Math.floor(elapsedSeconds)}s`;
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05) * speedMultiplier;

  if (!paused) {
    updateNutrients(dt);
    updateCreatures(dt);
    elapsedSeconds += dt / speedMultiplier;
  }

  controls.update();
  renderer.render(scene, camera);
  updateHUD();
  requestAnimationFrame(animate);
}

// ── Start ──────────────────────────────────────
spawnCreature(new THREE.Vector3(0, 1.5, 0));
console.log('Aquarium setup complete, starting animation');
requestAnimationFrame(animate);

} catch (e) { console.error('INIT ERROR:', e); }
