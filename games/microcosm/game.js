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
    energy: 1.0,
    age: 0,
    phase: Math.random() * Math.PI * 2,
    mesh,
    eatFlash: 0,
    foodNoticeAt: 0,
  });
}

function updateCreatures(dt) {
  for (let i = creatures.length - 1; i >= 0; i--) {
    const c = creatures[i];
    c.age += dt;
    c.eatFlash = Math.max(0, c.eatFlash - dt);
    c.phase += dt * 2;

    // Determine movement direction and speed
    let moveDir = null;
    let speed = 0.8; // base wander speed

    // Check for nearby food with delayed reaction
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
      // Delayed reaction: only notice food after a random delay
      if (c.foodNoticeAt === 0) {
        c.foodNoticeAt = c.age + 0.3 + Math.random() * 1.2;
      }
      if (c.age >= c.foodNoticeAt) {
        moveDir = new THREE.Vector3().copy(nearestNutrient.pos).sub(c.pos);
        moveDir.y = 0;
        const dist = moveDir.length();
        if (dist > 0.05) {
          moveDir.normalize();
          speed = 1.2 + (1 - Math.min(dist, 3.0) / 3.0) * 1.5;
        }
      }
    } else {
      c.foodNoticeAt = 0;
    }

    // Wander when not seeking food
    if (!moveDir) {
      if (!c.wanderTarget || c.pos.distanceTo(c.wanderTarget) < 0.3) {
        c.wanderTarget = new THREE.Vector3(
          (Math.random() - 0.5) * (ARENA_HALF - 1) * 2,
          0.15,
          (Math.random() - 0.5) * (ARENA_HALF - 1) * 2
        );
      }
      moveDir = new THREE.Vector3().copy(c.wanderTarget).sub(c.pos);
      moveDir.y = 0;
      const dist = moveDir.length();
      if (dist > 0.05) {
        moveDir.normalize();
      }
    }

    // Creature-creature collision avoidance
    const avoidance = new THREE.Vector3();
    for (let j = 0; j < creatures.length; j++) {
      if (i === j) continue;
      const other = creatures[j];
      const d = c.pos.distanceTo(other.pos);
      const minDist = 0.55; // sum of typical radii + buffer
      if (d < minDist && d > 0.001) {
        const push = new THREE.Vector3().copy(c.pos).sub(other.pos).normalize();
        push.multiplyScalar((minDist - d) * 2.0);
        push.y = 0;
        avoidance.add(push);
      }
    }

    // Move directly (no inertia)
    if (moveDir) {
      const jitterX = (Math.random() - 0.5) * 0.3;
      const jitterZ = (Math.random() - 0.5) * 0.3;
      c.pos.x += (moveDir.x * speed + avoidance.x + jitterX) * dt;
      c.pos.z += (moveDir.z * speed + avoidance.z + jitterZ) * dt;
    }

    // Subtle vertical bob
    c.pos.y += Math.sin(c.phase * 1.3) * 0.03 * dt;
    if (c.pos.y > 0.2) c.pos.y -= 0.2 * dt;

    // Eat nutrients in contact
    for (let j = nutrients.length - 1; j >= 0; j--) {
      const n = nutrients[j];
      const dist = c.pos.distanceTo(n.pos);
      if (dist < 0.3) {
        c.energy = Math.min(1.5, c.energy + 0.15);
        c.eatFlash = 0.5;
        c.wanderTarget = null;
        c.foodNoticeAt = 0;
        scene.remove(n.mesh);
        nutrients.splice(j, 1);
      }
    }

    // Bounds — hard clamp to arena
    const bound = ARENA_HALF - 0.3;
    c.pos.x = Math.max(-bound, Math.min(bound, c.pos.x));
    c.pos.z = Math.max(-bound, Math.min(bound, c.pos.z));
    if (c.pos.y > 2.0) c.pos.y = 2.0;

    // Energy decay
    c.energy -= dt * 0.04;

    // Visual update — size and color based on energy
    const energyScale = 0.7 + c.energy * 0.4;
    const flashBoost = c.eatFlash > 0 ? 1 + c.eatFlash * 0.5 : 1;
    const scale = energyScale * flashBoost;
    c.mesh.scale.setScalar(scale);

    // Ground collision — keep bottom of sphere above ground
    const radius = 0.2 * scale;
    if (c.pos.y < radius) c.pos.y = radius;

    // Color: green (full) → yellow → red (empty)
    const t = Math.max(0, Math.min(1, c.energy / 1.5));
    c.mesh.material.color.setRGB(1 - t, t, 0);
    c.mesh.material.emissive.setRGB((1 - t) * 0.3, t * 0.25, 0);

    // Death
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
spawnCreature(new THREE.Vector3(0, 0.15, 0));
console.log('Microcosm setup complete, starting animation');
requestAnimationFrame(animate);

} catch (e) { console.error('INIT ERROR:', e); }
