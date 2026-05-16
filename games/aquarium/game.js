import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

console.log('Aquarium module loaded');
try {

// ── Scene ──────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game'), antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#7ec8e3');
scene.fog = new THREE.Fog('#7ec8e3', 15, 40);

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
scene.add(new THREE.AmbientLight('#ffffff', 0.4));
const sun = new THREE.DirectionalLight('#ffffff', 1.0);
sun.position.set(5, 8, 3);
scene.add(sun);

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
  const mesh = new THREE.Mesh(creatureGeo, creatureMat.clone());
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

    // 1. Wander — pick random targets when idle
    if (!c.wanderTarget || c.pos.distanceTo(c.wanderTarget) < 0.5) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 1 + Math.random() * 4;
      c.wanderTarget = new THREE.Vector3(
        Math.cos(angle) * dist,
        0.15,
        Math.sin(angle) * dist
      );
    }
    // Move toward wander target with some noise
    const toTarget = new THREE.Vector3().copy(c.wanderTarget).sub(c.pos);
    toTarget.y = 0;
    const targetDist = toTarget.length();
    if (targetDist > 0.1) {
      toTarget.normalize();
      c.vel.x += toTarget.x * 1.5 * dt;
      c.vel.z += toTarget.z * 1.5 * dt;
    }
    // Brownian noise on top
    c.vel.x += (Math.random() - 0.5) * 0.6 * dt;
    c.vel.z += (Math.random() - 0.5) * 0.6 * dt;
    // Subtle vertical bob
    c.vel.y += Math.sin(c.phase * 1.3) * 0.05 * dt;
    if (c.pos.y > 0.2) c.vel.y -= 0.2 * dt;

    // 2. Seek nearest nutrient — overrides wander when food is near
    let nearestDist = 3.0;
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
      const urgency = 1 + (1 - nearestDist / 3.0) * 2;
      c.vel.x += dir.x * 2.0 * urgency * dt;
      c.vel.z += dir.z * 2.0 * urgency * dt;
      c.vel.y += dir.y * 0.3 * dt;
    }

    // 3. Eat nutrients in contact
    for (let j = nutrients.length - 1; j >= 0; j--) {
      const n = nutrients[j];
      const dist = c.pos.distanceTo(n.pos);
      if (dist < 0.3) {
        c.energy = Math.min(1.5, c.energy + 0.15);
        c.eatFlash = 0.5;
        c.wanderTarget = null;
        scene.remove(n.mesh);
        nutrients.splice(j, 1);
      }
    }

    // 4. Move with lighter damping
    c.vel.x *= 0.985;
    c.vel.y *= 0.94;
    c.vel.z *= 0.985;
    c.phase += dt * 2;
    c.pos.x += c.vel.x * dt;
    c.pos.y += c.vel.y * dt;
    c.pos.z += c.vel.z * dt;

    // 5. Bounds — spring force near arena edge
    const margin = 0.5;
    const spring = 1.5;
    if (c.pos.x > ARENA_HALF - margin) c.vel.x -= (c.pos.x - (ARENA_HALF - margin)) * spring * dt;
    if (c.pos.x < -ARENA_HALF + margin) c.vel.x -= (c.pos.x - (-ARENA_HALF + margin)) * spring * dt;
    if (c.pos.z > ARENA_HALF - margin) c.vel.z -= (c.pos.z - (ARENA_HALF - margin)) * spring * dt;
    if (c.pos.z < -ARENA_HALF + margin) c.vel.z -= (c.pos.z - (-ARENA_HALF + margin)) * spring * dt;
    // Vertical bounds — don't fly too high (ground floor handled by radius collision)
    if (c.pos.y > 2.0) c.vel.y -= (c.pos.y - 2.0) * spring * dt;

    // 6. Energy decay
    c.energy -= dt * 0.04;

    // 7. Visual update — size and color based on energy
    const energyScale = 0.7 + c.energy * 0.4;
    const flashBoost = c.eatFlash > 0 ? 1 + c.eatFlash * 0.5 : 1;
    const scale = energyScale * flashBoost;
    c.mesh.scale.setScalar(scale);

    // Ground collision — keep bottom of sphere above ground
    const radius = 0.2 * scale;
    if (c.pos.y < radius) {
      c.pos.y = radius;
      if (c.vel.y < 0) c.vel.y = 0;
    }

    // Color: green (full) → yellow → red (empty)
    const t = Math.max(0, Math.min(1, c.energy / 1.5));
    c.mesh.material.color.setRGB(1 - t, t, 0);
    c.mesh.material.emissive.setRGB((1 - t) * 0.3, t * 0.25, 0);

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
  new THREE.Vector3(0, 0.05, 0)
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
  document.getElementById('info').textContent =
    `Creatures: ${creatures.length} | Time: ${Math.floor(elapsedSeconds)}s`;
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
spawnCreature(new THREE.Vector3(0, 0.15, 0));
console.log('Aquarium setup complete (ground arena), starting animation');
requestAnimationFrame(animate);

} catch (e) { console.error('INIT ERROR:', e); }
