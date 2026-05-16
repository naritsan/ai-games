import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

console.log('Module loaded');
try {

// ── Scene ──────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game'), antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#111111');

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 50);
camera.position.set(3, 4.5, 6);
camera.lookAt(0, 0.3, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.5, 0);
controls.enableDamping = true;
controls.minDistance = 2.5;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI * 0.55;
controls.update();

// ── Lighting ───────────────────────────────────
scene.add(new THREE.AmbientLight('#ffffff', 0.4));
const sun = new THREE.DirectionalLight('#ffffff', 1.2);
sun.position.set(5, 10, 2);
scene.add(sun);

const fireLight = new THREE.PointLight('#ff8830', 0, 8, 2);
fireLight.position.set(0, 0.5, 0);
scene.add(fireLight);

// ── Ground ─────────────────────────────────────
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: '#3a3020', roughness: 0.85 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
ground.name = 'ground';
scene.add(ground);

// ── Fire pit ───────────────────────────────────
const PIT_RADIUS = 1.8;
const PIT_Y = 0.15;

// Pit floor
const pitFloor = new THREE.Mesh(
  new THREE.CylinderGeometry(PIT_RADIUS - 0.15, PIT_RADIUS - 0.15, 0.03, 32),
  new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 0.8 })
);
pitFloor.position.y = PIT_Y - 0.12;
pitFloor.receiveShadow = true;
pitFloor.name = 'pitFloor';
scene.add(pitFloor);

// Stone ring
const stoneGeo = new THREE.BoxGeometry(0.35, 0.22, 0.28);
const stoneMat = new THREE.MeshStandardMaterial({ color: '#7a6a58', roughness: 0.6 });
for (let i = 0; i < 20; i++) {
  const angle = (i / 20) * Math.PI * 2;
  const stone = new THREE.Mesh(stoneGeo, stoneMat);
  stone.position.set(Math.cos(angle) * PIT_RADIUS, PIT_Y, Math.sin(angle) * PIT_RADIUS);
  stone.rotation.y = Math.random() * 0.4 - 0.2;
  stone.rotation.x = Math.random() * 0.15;
  stone.castShadow = true;
  stone.receiveShadow = true;
  scene.add(stone);
}

// ── Material definitions ───────────────────────
const MATDEFS = [
  { name: 'Sawdust', color: '#C4A76C', shape: 'pile', size: [1.5, 0.06, 1.5],
    ignitionTemp: 250, heatOutput: 300, burnDuration: 25, flameIntensity: 0.35, smokeAmount: 0.3, spreadFactor: 0.35 },
  { name: 'Dry Grass', color: '#D4C56A', shape: 'pile', size: [1.1, 0.08, 1.1],
    ignitionTemp: 150, heatOutput: 200, burnDuration: 5, flameIntensity: 0.7, smokeAmount: 0.2, spreadFactor: 0.65 },
  { name: 'Leaves', color: '#8B6F3C', shape: 'plane', size: [0.6, 0.01, 0.7],
    ignitionTemp: 180, heatOutput: 250, burnDuration: 8, flameIntensity: 0.6, smokeAmount: 0.5, spreadFactor: 0.5 },
  { name: 'Pine Needles', color: '#6B8E23', shape: 'pile', size: [1.0, 0.05, 1.0],
    ignitionTemp: 160, heatOutput: 220, burnDuration: 6, flameIntensity: 0.8, smokeAmount: 0.3, spreadFactor: 0.7 },
  { name: 'Small Twigs', color: '#5C4033', shape: 'twig', size: [0.04, 0.7, 0.04],
    ignitionTemp: 200, heatOutput: 350, burnDuration: 12, flameIntensity: 0.65, smokeAmount: 0.3, spreadFactor: 0.4 },
  { name: 'Pine Wood', color: '#4E342E', shape: 'log', size: [0.18, 1.3, 0.18],
    ignitionTemp: 260, heatOutput: 500, burnDuration: 45, flameIntensity: 0.9, smokeAmount: 0.5, spreadFactor: 0.25 },
  { name: 'Oak Wood', color: '#3E2723', shape: 'log', size: [0.22, 1.5, 0.22],
    ignitionTemp: 300, heatOutput: 600, burnDuration: 70, flameIntensity: 0.85, smokeAmount: 0.4, spreadFactor: 0.2 },
  { name: 'Charcoal', color: '#1A1A1A', shape: 'box', size: [0.22, 0.2, 0.22],
    ignitionTemp: 350, heatOutput: 800, burnDuration: 130, flameIntensity: 0.5, smokeAmount: 0.1, spreadFactor: 0.15 },
  { name: 'Paper', color: '#E8E0D0', shape: 'plane', size: [0.4, 0.005, 0.5],
    ignitionTemp: 220, heatOutput: 150, burnDuration: 3, flameIntensity: 0.3, smokeAmount: 0.5, spreadFactor: 0.85 },
  { name: 'Cardboard', color: '#A0855C', shape: 'box', size: [0.35, 0.04, 0.45],
    ignitionTemp: 230, heatOutput: 250, burnDuration: 12, flameIntensity: 0.5, smokeAmount: 0.6, spreadFactor: 0.55 },
];

// ── Fuel objects ───────────────────────────────
const fuelObjects = [];

function createFuelMesh(matIdx) {
  const def = MATDEFS[matIdx];
  const s = def.size;
  let geo;
  switch (def.shape) {
    case 'log':
      geo = new THREE.CylinderGeometry(s[0], s[0] * 0.85, s[1], 8, 4);
      break;
    case 'twig':
      geo = new THREE.CylinderGeometry(s[0] * 0.6, s[0], s[1], 6, 3);
      break;
    case 'box':
      geo = new THREE.BoxGeometry(s[0], s[1], s[2]);
      break;
    case 'plane':
      geo = new THREE.PlaneGeometry(s[0], s[2]);
      break;
    case 'pile':
      geo = new THREE.CylinderGeometry(s[0], s[0] * 1.15, s[1], 16);
      break;
    default:
      geo = new THREE.BoxGeometry(s[0], s[1], s[2]);
  }
  const mat = new THREE.MeshStandardMaterial({
    color: def.color,
    roughness: 0.75,
    side: def.shape === 'plane' ? THREE.DoubleSide : THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addFuel(matIdx, x, z) {
  const def = MATDEFS[matIdx];
  const s = def.size;
  const mesh = createFuelMesh(matIdx);

  // Natural rotation
  if (def.shape === 'log' || def.shape === 'twig') {
    mesh.rotation.z = (Math.random() - 0.5) * 0.7;
    mesh.rotation.x = (Math.random() - 0.5) * 0.5;
  }
  mesh.rotation.y = Math.random() * Math.PI * 2;

  // Raycast to find placement height
  const raycaster = new THREE.Raycaster();
  raycaster.set(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0));
  const allTargets = [];
  scene.traverse(c => { if (c.isMesh && c.name !== 'ground') allTargets.push(c); });
  const hits = raycaster.intersectObjects(allTargets, false);
  let y = PIT_Y;
  if (hits.length > 0) {
    const halfH = def.shape === 'log' || def.shape === 'twig' ? s[1] / 2
      : def.shape === 'box' ? s[1] / 2
      : def.shape === 'pile' ? s[1] / 2
      : 0.01;
    y = Math.max(PIT_Y, hits[0].point.y + halfH + 0.005);
  }

  mesh.position.set(x, y, z);
  mesh.userData = {
    matIdx,
    temp: 20,
    state: 'cold',
    fuel: 1.0,
    baseScale: mesh.scale.clone(),
    baseY: y,
  };
  scene.add(mesh);
  fuelObjects.push(mesh);
  return mesh;
}

// Pre-fill pit with sawdust base
function fillBaseSawdust() {
  console.log('Filling base...');
  addFuel(0, 0, 0);
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.7;
    addFuel(4, Math.cos(a) * r, Math.sin(a) * r);
  }
  for (let i = 0; i < 3; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.8;
    addFuel(3, Math.cos(a) * r, Math.sin(a) * r);
  }
  for (let i = 0; i < 2; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.5;
    addFuel(1, Math.cos(a) * r, Math.sin(a) * r);
  }
  console.log('Base filled. Fuel objects:', fuelObjects.length);
}

fillBaseSawdust();

// ── Particles ──────────────────────────────────
const MAX_P = 400;
const particleData = [];
const particleGeo = new THREE.BufferGeometry();
const posArr = new Float32Array(MAX_P * 3);
const colArr = new Float32Array(MAX_P * 3);
const sizeArr = new Float32Array(MAX_P);
particleGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
particleGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
particleGeo.setAttribute('size', new THREE.BufferAttribute(sizeArr, 1));

function makeGlowTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d').createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.15, 'rgba(255,255,200,0.9)');
  g.addColorStop(0.4, 'rgba(255,150,30,0.5)');
  g.addColorStop(0.7, 'rgba(255,50,0,0.1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.getContext('2d').fillStyle = g;
  c.getContext('2d').fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

const particles = new THREE.Points(particleGeo, new THREE.PointsMaterial({
  size: 0.08, vertexColors: true, blending: THREE.AdditiveBlending,
  depthWrite: false, transparent: true, opacity: 0.8, map: makeGlowTex(),
}));
scene.add(particles);

function emit(type, pos, vel) {
  if (particleData.length >= MAX_P) return;
  const life = type === 'flame' ? 0.3 + Math.random() * 0.5
    : type === 'smoke' ? 2 + Math.random() * 2
    : 0.5 + Math.random() * 1.0;
  particleData.push({
    pos: pos.clone(), vel: vel.clone(), life, maxLife: life, type,
    size: type === 'flame' ? 0.04 + Math.random() * 0.06
      : type === 'smoke' ? 0.06 + Math.random() * 0.1
      : 0.015 + Math.random() * 0.025,
  });
}

function updateParticles(dt) {
  for (let i = particleData.length - 1; i >= 0; i--) {
    const p = particleData[i];
    p.life -= dt;
    if (p.life <= 0) { particleData.splice(i, 1); continue; }
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.pos.z += p.vel.z * dt;
    if (p.type === 'flame') {
      p.vel.y += 2 * dt;
      p.vel.x += (Math.random() - 0.5) * 3 * dt;
      p.vel.z += (Math.random() - 0.5) * 3 * dt;
    } else if (p.type === 'smoke') {
      p.vel.y += 0.5 * dt;
      p.vel.x += (Math.random() - 0.5) * 2 * dt;
      p.size += 0.04 * dt;
    } else {
      p.vel.y -= 4 * dt;
    }
  }
  for (let i = 0; i < MAX_P; i++) {
    const j = i * 3;
    if (i < particleData.length) {
      const p = particleData[i], t = p.life / p.maxLife;
      posArr[j] = p.pos.x; posArr[j + 1] = p.pos.y; posArr[j + 2] = p.pos.z;
      if (p.type === 'flame') {
        if (t > 0.5) { colArr[j] = 1; colArr[j + 1] = 0.85; colArr[j + 2] = 0.3; }
        else if (t > 0.2) { colArr[j] = 1; colArr[j + 1] = 0.4; colArr[j + 2] = 0.05; }
        else { colArr[j] = 0.7; colArr[j + 1] = 0.1; colArr[j + 2] = 0; }
      } else if (p.type === 'smoke') {
        colArr[j] = colArr[j + 1] = colArr[j + 2] = 0.15 + t * 0.25;
      } else {
        colArr[j] = 1; colArr[j + 1] = 0.5 + t * 0.3; colArr[j + 2] = 0;
      }
      sizeArr[i] = p.size * (t * 0.8 + 0.2);
    } else {
      posArr[j] = 0; posArr[j + 1] = -10; posArr[j + 2] = 0;
      colArr[j] = colArr[j + 1] = colArr[j + 2] = 0;
      sizeArr[i] = 0;
    }
  }
  particleGeo.attributes.position.needsUpdate = true;
  particleGeo.attributes.color.needsUpdate = true;
  particleGeo.attributes.size.needsUpdate = true;
}

// ── Fire simulation ────────────────────────────
function burnColor(def, fuelRemaining) {
  if (fuelRemaining > 0.7) return new THREE.Color(def.color).lerp(new THREE.Color('#2a1000'), (1 - fuelRemaining) / 0.3);
  if (fuelRemaining > 0.3) return new THREE.Color('#2a1000').lerp(new THREE.Color('#ff5500'), (0.7 - fuelRemaining) / 0.4);
  return new THREE.Color('#ff5500').lerp(new THREE.Color('#666666'), (0.3 - fuelRemaining) / 0.3);
}

function updateFire(dt) {
  // Heat conduction between nearby objects
  for (let i = 0; i < fuelObjects.length; i++) {
    for (let j = i + 1; j < fuelObjects.length; j++) {
      const a = fuelObjects[i], b = fuelObjects[j];
      const dist = a.position.distanceTo(b.position);
      if (dist < 0.8) {
        const diff = a.userData.temp - b.userData.temp;
        if (Math.abs(diff) > 0.1) {
          const cond = MATDEFS[a.userData.matIdx].spreadFactor * 0.2 * (1 - dist / 0.8);
          const transfer = diff * cond * dt;
          b.userData.temp += transfer;
          a.userData.temp -= transfer * 0.5;
        }
      }
    }
  }

  let totalFire = 0;
  for (const obj of fuelObjects) {
    const ud = obj.userData;
    const def = MATDEFS[ud.matIdx];
    const s = def.size;

    if (ud.state === 'cold') {
      // Cool toward ambient
      if (ud.temp > 20) ud.temp -= (ud.temp - 20) * 0.2 * dt;
      // Ignition check
      if (ud.temp >= def.ignitionTemp) {
        if (ud.igniteTimer === undefined) ud.igniteTimer = 0.1 + Math.random() * 0.2;
        ud.igniteTimer -= dt;
        if (ud.igniteTimer <= 0) {
          ud.state = 'burning';
          delete ud.igniteTimer;
        }
      }
    }

    if (ud.state === 'burning') {
      ud.fuel -= (1.0 / def.burnDuration) * dt;
      ud.temp = Math.min(1200, ud.temp + def.heatOutput * 0.25 * dt);
      totalFire += ud.fuel * def.flameIntensity;

      // Shrink based on fuel
      const scale = 0.4 + ud.fuel * 0.6;
      obj.scale.x = ud.baseScale.x * scale;
      obj.scale.z = ud.baseScale.z * scale;
      if (def.shape === 'log' || def.shape === 'twig') {
        obj.scale.y = ud.baseScale.y * (0.8 + ud.fuel * 0.2);
      } else {
        obj.scale.y = ud.baseScale.y * scale;
      }
      obj.position.y = ud.baseY - (1 - ud.fuel) * 0.2;

      // Color + emissive
      obj.material.color.copy(burnColor(def, ud.fuel));
      if (ud.fuel < 0.5) {
        obj.material.emissive = new THREE.Color('#ff4400');
        obj.material.emissiveIntensity = (0.5 - ud.fuel) * 3;
      }

      // Particles
      if (Math.random() < def.flameIntensity * 0.6) {
        const p = obj.position.clone();
        p.x += (Math.random() - 0.5) * obj.scale.x * 2.5;
        p.y += obj.scale.y * 0.5;
        p.z += (Math.random() - 0.5) * obj.scale.z * 2.5;
        emit('flame', p, new THREE.Vector3((Math.random() - 0.5) * 0.5, 1.5 + def.flameIntensity * 3, (Math.random() - 0.5) * 0.5));
      }
      if (Math.random() < def.smokeAmount * 0.4) {
        const p = obj.position.clone();
        p.y += obj.scale.y * 0.4;
        emit('smoke', p, new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.4 + Math.random() * 1.5, (Math.random() - 0.5) * 0.3));
      }
      if (Math.random() < 0.03) {
        const p = obj.position.clone();
        p.y += obj.scale.y * 0.3;
        emit('spark', p, new THREE.Vector3((Math.random() - 0.5) * 4, 3 + Math.random() * 5, (Math.random() - 0.5) * 4));
      }

      if (ud.fuel <= 0) {
        ud.state = 'ash';
        obj.material.emissive.set('#000000');
        obj.material.emissiveIntensity = 0;
        obj.material.color.set('#555555');
        obj.material.roughness = 1;
        obj.scale.setScalar(ud.baseScale.x * 0.2);
        obj.position.y = ud.baseY - 0.15;
        obj.castShadow = false;
      }
    }

    if (ud.state === 'ash') {
      ud.temp = Math.max(20, ud.temp - 10 * dt);
    }

    // Radiative heating from burning neighbors
    if (ud.state === 'cold') {
      for (const other of fuelObjects) {
        if (other.userData.state === 'burning') {
          const dist = obj.position.distanceTo(other.position);
          if (dist < 2.5) {
            ud.temp += MATDEFS[other.userData.matIdx].heatOutput * 0.03 * (1 - dist / 2.5) * dt;
          }
        }
      }
    }
  }

  fireLight.intensity = totalFire * 5;
  fireLight.position.y = 0.3 + totalFire * 0.6;
}

// ── Interaction ────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedMat = 0;
let igniteMode = false;

function getIntersections(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const targets = [];
  scene.traverse(c => { if (c.isMesh) targets.push(c); });
  return raycaster.intersectObjects(targets, false);
}

window.addEventListener('click', e => {
  if (e.target.closest('#palette')) return;

  const hits = getIntersections(e);
  if (hits.length === 0) return;

  // Ignite mode: ignite the clicked fuel object
  if (igniteMode) {
    for (const hit of hits) {
      let obj = hit.object;
      // Walk up to find the fuel object (or itself)
      while (obj && !fuelObjects.includes(obj)) obj = obj.parent;
      if (obj && fuelObjects.includes(obj) && obj.userData.state === 'cold') {
        obj.userData.temp = 600;
        // Flash effect
        obj.material.emissive = new THREE.Color('#ff8800');
        obj.material.emissiveIntensity = 2;
        setTimeout(() => {
          if (obj.userData.state === 'burning') {
            obj.material.emissiveIntensity = 0;
          }
        }, 300);
        return;
      }
    }
    return;
  }

  // Place mode: place on the hit point
  const point = hits[0].point;
  const dist = Math.sqrt(point.x ** 2 + point.z ** 2);
  if (dist > PIT_RADIUS - 0.2) {
    // Clamp to pit
    const s = (PIT_RADIUS - 0.2) / dist;
    addFuel(selectedMat, point.x * s, point.z * s);
  } else {
    addFuel(selectedMat, point.x, point.z);
  }
});

// ── UI ─────────────────────────────────────────
document.querySelectorAll('.mat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMat = parseInt(btn.dataset.idx);
    igniteMode = false;
    document.getElementById('ignite-btn').classList.remove('active');
  });
});

document.getElementById('ignite-btn').addEventListener('click', () => {
  igniteMode = !igniteMode;
  document.getElementById('ignite-btn').classList.toggle('active', igniteMode);
  if (igniteMode) {
    document.querySelectorAll('.mat-btn').forEach(b => b.classList.remove('active'));
  } else if (selectedMat >= 0) {
    document.querySelector(`.mat-btn[data-idx="${selectedMat}"]`)?.classList.add('active');
  }
});

document.getElementById('reset-btn').addEventListener('click', () => {
  for (const obj of fuelObjects) scene.remove(obj);
  fuelObjects.length = 0;
  particleData.length = 0;
  fireLight.intensity = 0;
  fillBaseSawdust();
});

// Keyboard
window.addEventListener('keydown', e => {
  if (e.key >= '1' && e.key <= '9') {
    const idx = parseInt(e.key) - 1;
    selectedMat = idx;
    igniteMode = false;
    document.querySelectorAll('.mat-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.mat-btn[data-idx="${idx}"]`)?.classList.add('active');
    document.getElementById('ignite-btn').classList.remove('active');
  }
  if (e.key === '0') {
    selectedMat = 9;
    document.querySelectorAll('.mat-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.mat-btn[data-idx="9"]`)?.classList.add('active');
    document.getElementById('ignite-btn').classList.remove('active');
    igniteMode = false;
  }
  if (e.key === 'i' || e.key === 'I') {
    igniteMode = !igniteMode;
    document.getElementById('ignite-btn').classList.toggle('active', igniteMode);
  }
  if (e.key === 'r' || e.key === 'R') {
    document.getElementById('reset-btn').click();
  }
});

// ── Resize ─────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Game loop ──────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.1);
  controls.update();
  updateFire(dt);
  updateParticles(dt);

  const burning = fuelObjects.filter(o => o.userData.state === 'burning').length;
  const maxTemp = Math.max(20, ...fuelObjects.map(o => o.userData.temp), 0);
  const mode = igniteMode ? 'IGNITE' : `PLACE: ${MATDEFS[selectedMat].name}`;
  document.getElementById('info').innerHTML = `${mode}<br>Burning: ${burning} | Max: ${Math.floor(maxTemp)}°C`;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
console.log('Setup complete, starting animation');
requestAnimationFrame(animate);

} catch(e) { console.error('INIT ERROR:', e); }
