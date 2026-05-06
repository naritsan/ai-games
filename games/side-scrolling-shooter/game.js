'use strict';

// ── Canvas & scaling ────────────────────────────────────────────────────────
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const LW = 960, LH = 540; // logical dimensions
let scale, ox, oy;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  scale = Math.min(canvas.width / LW, canvas.height / LH);
  ox = (canvas.width - LW * scale) / 2;
  oy = (canvas.height - LH * scale) / 2;
}
window.addEventListener('resize', resize);
resize();

// ── Constants ───────────────────────────────────────────────────────────────
const COLORS = {
  black: '#000000',
  white: '#f5fff9',
  cyan: '#2fffd2',
  blue: '#35a7ff',
  green: '#35ff5f',
  yellow: '#ffe85c',
  orange: '#ff9f3d',
  red: '#ff4359',
  purple: '#cc66ff',
  dim: '#103a3a',
};

const POWER_LABEL = {
  speed: 'SPEED',
  sub: 'SUB',
  shot: 'LASER',
  option: 'OPT',
  shield: 'SHIELD',
};
const POWER_GAUGE = ['speed', 'sub', 'shot', 'option', 'shield'];
const POWER_LIMIT = {
  speed: 3,
  sub: 3,
  shot: 1,
  option: 4,
  shield: 3,
};
const POWER_COLOR = {
  speed: COLORS.blue,
  sub: COLORS.green,
  shot: COLORS.yellow,
  option: COLORS.purple,
  shield: COLORS.cyan,
};
const START_LEVELS = [1, 25, 50, 75, 100];
const LOADOUTS = [
  { label: 'NONE', power: {} },
  { label: 'STARTER', power: { speed: 1, shield: 1 } },
  { label: 'SUB', power: { speed: 2, sub: 2, option: 1, shield: 1 } },
  { label: 'LASER', power: { speed: 2, shot: 1, option: 1, shield: 1 } },
  { label: 'MAX SUB', power: { speed: 3, sub: 3, option: 4, shield: 3 } },
  { label: 'MAX LASER', power: { speed: 3, shot: 1, option: 4, shield: 3 } },
];
const FIRST_STAGE_TIME = 30;

const keys = new Set();
let state = 'intro'; // 'intro' | 'playing' | 'gameover'
let lastTime = 0;
let score = 0;
let hiScore = +localStorage.getItem('side_shooter_hi') || 0;
let lives = 3;
let distance = 0;
let nextEnemyAt = 0;
let nextBossAt = 0;
let respawnTimer = 0;
let messageTimer = 0;
let lastPower = '';
let powerCursor = -1;
let openingFormationDone = false;
let introSelection = 0;
let startLevelIndex = 0;
let loadoutIndex = 0;

let player;
let bullets;
let enemyBullets;
let enemies;
let formations;
let nextFormationId;
let capsules;
let particles;
let stars;
let terrain;

// ── Utility ─────────────────────────────────────────────────────────────────
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rand = (min, max) => min + Math.random() * (max - min);
const stageEase = () => clamp(distance / FIRST_STAGE_TIME, 0, 1);
const difficulty = () => clamp(Math.max(0, distance - 18) / 180, 0, 1);
const rectsOverlap = (a, b) => (
  a.x < b.x + b.w &&
  a.x + a.w > b.x &&
  a.y < b.y + b.h &&
  a.y + a.h > b.y
);

function fireFrom(x, y, source = 'player', owner = source) {
  const shotLevel = player?.power.shot || 0;
  const speed = source === 'player' ? 560 : -260;
  const size = source === 'player' ? 8 : 7;
  if (source !== 'player') {
    bullets.push({ x, y, w: 18, h: size, vx: speed, vy: 0, source });
    return;
  }

  if (shotLevel > 0) {
    if (bullets.some(bullet => bullet.beam && bullet.owner === owner)) return;
    bullets.push({ x, y, w: LW - x, h: 7, vx: 0, vy: 0, source, owner, beam: true, penetrates: true, hitEnemies: new Set(), life: 0.22, maxLife: 0.22 });
    return;
  }

  bullets.push({ x, y, w: 18, h: size, vx: speed, vy: 0, source });
  if (player.power.sub >= 1) {
    bullets.push({ x, y: y - 4, w: 14, h: 5, vx: 430, vy: -220, source });
  }
  if (player.power.sub >= 2) {
    bullets.push({ x, y: y + 4, w: 14, h: 5, vx: 430, vy: 220, source });
  }
  if (player.power.sub >= 3) {
    bullets.push({ x: x - 10, y, w: 14, h: 5, vx: -430, vy: 0, source });
  }
}

function makePlayer() {
  return {
    x: 92,
    y: LH / 2,
    w: 46,
    h: 22,
    speed: 235,
    cooldown: 0,
    invuln: 0,
    power: { speed: 0, sub: 0, shot: 0, option: 0, shield: 0 },
    options: [],
    trail: [],
    lastTrailX: 92,
    lastTrailY: LH / 2,
  };
}

function resetGame() {
  score = 0;
  lives = 3;
  const startLevel = START_LEVELS[startLevelIndex];
  distance = startLevel <= 1 ? 0 : 18 + (startLevel / 100) * 180;
  nextEnemyAt = 0.6;
  nextBossAt = 75;
  respawnTimer = 0;
  messageTimer = 0;
  lastPower = '';
  powerCursor = -1;
  openingFormationDone = startLevel > 1;
  player = makePlayer();
  applyStartingLoadout();
  bullets = [];
  enemyBullets = [];
  enemies = [];
  formations = {};
  nextFormationId = 1;
  capsules = [];
  particles = [];
  stars = Array.from({ length: 95 }, () => ({
    x: rand(0, LW),
    y: rand(0, LH),
    r: Math.random() < 0.78 ? 1 : 2,
    speed: rand(25, 130),
    color: Math.random() < 0.18 ? COLORS.cyan : COLORS.white,
  }));
  terrain = Array.from({ length: 34 }, (_, i) => makeTerrain(i * 34));
  state = 'playing';
}

function applyStartingLoadout() {
  const loadout = LOADOUTS[loadoutIndex];
  for (const name of Object.keys(loadout.power)) {
    player.power[name] = Math.min(loadout.power[name], POWER_LIMIT[name]);
  }
  player.speed = 235 + player.power.speed * 55;
  syncOptions();
}

function makeTerrain(x = LW + rand(0, 80)) {
  const hard = difficulty();
  const h = rand(20 + hard * 18, 92 + hard * 42);
  return { x, w: rand(22 + hard * 8, 48 + hard * 22), top: h * rand(0.4, 1), bottom: h, speed: rand(80 + hard * 25, 130 + hard * 55) };
}

function chooseEnemyType() {
  const typeRoll = Math.random();
  const ease = stageEase();
  const hard = difficulty();
  if (ease > 0.5) {
    if (hard > 0.72 && typeRoll > 0.76 - hard * 0.12) return 'heavyTurret';
    if (typeRoll > 0.84 - hard * 0.18) return 'turret';
    if (typeRoll > 0.66 - hard * 0.12) return 'weaver';
  } else if (ease > 0.25 && typeRoll > 0.84 - hard * 0.08) {
    return 'weaver';
  }
  return 'scout';
}

function enemyStats(type) {
  const stats = {
    scout: { w: 34, h: 24, hp: 1, vx: -185, points: 100 },
    waveScout: { w: 34, h: 24, hp: 1, vx: -172, points: 130 },
    pincerScout: { w: 36, h: 24, hp: 1, vx: -164, points: 140 },
    weaver: { w: 34, h: 24, hp: 1, vx: -145, points: 160 },
    turret: { w: 38, h: 30, hp: 3, vx: -104, points: 250 },
    heavyTurret: { w: 48, h: 36, hp: 8, vx: -86, points: 420 },
    miniBoss: { w: 82, h: 54, hp: 88, vx: -58, points: 1800 },
  };
  return stats[type] || stats.scout;
}

function spawnEnemy(overrides = {}) {
  const type = overrides.type || chooseEnemyType();
  const hard = difficulty();
  const stats = enemyStats(type);
  const y = overrides.y ?? rand(72, LH - 82);
  enemies.push({
    type,
    x: overrides.x ?? LW + 42,
    y,
    w: stats.w,
    h: stats.h,
    vx: overrides.vx ?? (stats.vx - hard * 18),
    vy: overrides.vy ?? 0,
    baseY: 0,
    phase: overrides.phase ?? rand(0, Math.PI * 2),
    hp: stats.hp,
    shotTimer: rand(1.8, 3.2) + (1 - stageEase()) * 2.2,
    points: Math.round(stats.points * (1 + hard * 0.45)),
    formationId: overrides.formationId ?? null,
    movePattern: overrides.movePattern ?? 'straight',
    amp: overrides.amp ?? 0,
  });
  enemies[enemies.length - 1].baseY = enemies[enemies.length - 1].y;
}

function spawnFormation(sizeOverride = null) {
  const hard = difficulty();
  const count = sizeOverride ?? Math.floor(rand(4 + hard * 4, 7 + hard * 8));
  const patterns = hard > 0.65 ? ['vee', 'line', 'column', 'pincer', 'wave'] : hard > 0.35 ? ['vee', 'line', 'column', 'wave'] : ['vee', 'line'];
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];
  const type = pattern === 'wave' ? 'waveScout' : pattern === 'pincer' ? 'pincerScout' : hard > 0.78 && Math.random() < 0.28 ? 'heavyTurret' : hard > 0.55 && Math.random() < 0.38 ? 'weaver' : 'scout';
  const startX = LW + 48;
  const startY = rand(96, LH - 112);
  const formationId = nextFormationId++;
  formations[formationId] = { alive: count, failed: false, deadline: hard > 0.7 ? distance + 7.5 - hard * 2.5 : Infinity };
  for (let i = 0; i < count; i++) {
    const mid = (count - 1) / 2;
    const row = pattern === 'vee' ? Math.abs(i - mid) : i % 2;
    const x = pattern === 'column' ? startX + row * 12 : startX + i * 36;
    const y = clamp(
      pattern === 'column' ? startY + (i - mid) * 30 :
      pattern === 'pincer' ? (i % 2 ? 72 + i * 8 : LH - 82 - i * 8) :
      pattern === 'wave' ? startY + Math.sin(i * 0.9) * 54 :
      startY + (pattern === 'vee' ? (i - mid) * 18 : (i % 2 ? 18 : -18)),
      72,
      LH - 82
    );
    spawnEnemy({
      type,
      x: x + row * 10,
      y,
      vx: enemyStats(type).vx - hard * 24,
      vy: pattern === 'pincer' ? (i % 2 ? 18 + hard * 26 : -18 - hard * 26) : 0,
      phase: rand(0, Math.PI * 2),
      formationId,
      movePattern: pattern === 'wave' ? 'wave' : pattern === 'pincer' ? 'pincer' : 'straight',
      amp: pattern === 'wave' ? 34 + hard * 20 : 0,
    });
  }
}

function spawnMiniBoss() {
  spawnEnemy({
    type: 'miniBoss',
    x: LW + 90,
    y: rand(140, LH - 150),
    vx: -48 - difficulty() * 10,
    movePattern: 'wave',
    amp: 42,
    phase: rand(0, Math.PI * 2),
  });
}

function spawnCapsuleAt(x, y, vx = -105) {
  capsules.push({
    x,
    y: clamp(y - 9, 42, LH - 60),
    w: 24,
    h: 18,
    vx,
    phase: rand(0, Math.PI * 2),
  });
}

function addExplosion(x, y, color = COLORS.orange, count = 16) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: rand(-120, 120),
      vy: rand(-120, 120),
      life: rand(0.25, 0.75),
      max: 0.75,
      size: rand(2, 5),
      color,
    });
  }
}

function advancePowerGauge() {
  powerCursor = (powerCursor + 1) % POWER_GAUGE.length;
  score += 200;
  messageTimer = 1.2;
  lastPower = POWER_LABEL[POWER_GAUGE[powerCursor]];
}

function activatePowerGauge() {
  if (powerCursor < 0) return;
  const gained = POWER_GAUGE[powerCursor];
  if (player.power[gained] >= POWER_LIMIT[gained]) {
    messageTimer = 1.2;
    lastPower = 'MAX';
    return;
  }
  player.power[gained] += 1;
  if (gained === 'shot') {
    player.power.sub = 0;
  }
  if (gained === 'sub') {
    player.power.shot = 0;
  }
  if (gained === 'speed') player.speed = 235 + player.power.speed * 55;
  if (gained === 'option') syncOptions();
  score += 500;
  messageTimer = 2.0;
  lastPower = POWER_LABEL[gained];
  powerCursor = -1;
}

function syncOptions() {
  while (player.options.length < player.power.option) {
    const i = player.options.length;
    const target = player.trail[Math.min(player.trail.length - 1, 5 + i * 3)] || player;
    player.options.push({ x: target.x, y: target.y });
  }
}

// ── Input ───────────────────────────────────────────────────────────────────
window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(event.code)) {
    event.preventDefault();
  }
  keys.add(event.code);
  if (state === 'intro' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
    updateIntroSetting(event.code);
  } else if ((state === 'intro' || state === 'gameover') && (event.code === 'Space' || event.code === 'Enter')) {
    resetGame();
  } else if (state === 'playing' && ['Enter', 'ShiftLeft', 'ShiftRight', 'KeyX'].includes(event.code)) {
    activatePowerGauge();
  }
});

window.addEventListener('keyup', (event) => keys.delete(event.code));

function updateIntroSetting(code) {
  if (code === 'ArrowUp' || code === 'ArrowDown') {
    introSelection = 1 - introSelection;
    return;
  }
  const delta = code === 'ArrowRight' ? 1 : -1;
  if (introSelection === 0) {
    startLevelIndex = (startLevelIndex + delta + START_LEVELS.length) % START_LEVELS.length;
  } else {
    loadoutIndex = (loadoutIndex + delta + LOADOUTS.length) % LOADOUTS.length;
  }
}

// ── Update ──────────────────────────────────────────────────────────────────
function update(dt) {
  if (state !== 'playing') return;

  distance += dt;
  nextEnemyAt -= dt;
  nextBossAt -= dt;
  messageTimer = Math.max(0, messageTimer - dt);
  respawnTimer = Math.max(0, respawnTimer - dt);
  player.cooldown = Math.max(0, player.cooldown - dt);
  player.invuln = Math.max(0, player.invuln - dt);

  if (!openingFormationDone && distance >= 5) {
    spawnFormation(3);
    openingFormationDone = true;
    nextEnemyAt = Math.max(nextEnemyAt, 2.4);
  }

  if (nextBossAt <= 0 && difficulty() > 0.28) {
    spawnMiniBoss();
    nextBossAt = Math.max(22, rand(48, 68) - difficulty() * 34);
  }

  if (nextEnemyAt <= 0) {
    const ease = stageEase();
    const hard = difficulty();
    const formationChance = distance < 20 ? 0.24 : 0.12 + hard * 0.68;
    if (Math.random() < formationChance) {
      spawnFormation(distance < 20 ? Math.floor(rand(2, 4)) : null);
      nextEnemyAt = distance < 20 ? rand(2.2, 3.2) : Math.max(0.75, rand(2.3, 3.4) - hard * 1.7);
    } else {
      spawnEnemy();
      if (hard > 0.85 && Math.random() < 0.35) spawnEnemy();
      nextEnemyAt = Math.max(0.22, rand(1.1, 1.75) - ease * 0.55 - hard * 0.9);
    }
  }
  updateBackground(dt);
  updatePlayer(dt);
  updateBullets(dt);
  updateEnemies(dt);
  updateCapsules(dt);
  updateParticles(dt);
  checkCollisions();
}

function updateBackground(dt) {
  for (const star of stars) {
    star.x -= star.speed * dt;
    if (star.x < -4) {
      star.x = LW + rand(0, 24);
      star.y = rand(0, LH);
    }
  }
  for (const rock of terrain) {
    rock.x -= rock.speed * dt;
    if (rock.x + rock.w < 0) Object.assign(rock, makeTerrain(LW + rand(0, 40)));
  }
}

function updatePlayer(dt) {
  let dx = 0, dy = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) dy -= 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) dy += 1;
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    player.x += (dx / len) * player.speed * dt;
    player.y += (dy / len) * player.speed * dt;
  }
  player.x = clamp(player.x, 34, LW - 34);
  player.y = clamp(player.y, 48, LH - 50);

  const moved = Math.hypot(player.x - player.lastTrailX, player.y - player.lastTrailY);
  if (moved > 4 || player.trail.length === 0) {
    player.trail.unshift({ x: player.x, y: player.y });
    player.lastTrailX = player.x;
    player.lastTrailY = player.y;
  }
  if (player.trail.length > 90) player.trail.pop();
  player.options.forEach((option, i) => {
    const target = player.trail[Math.min(player.trail.length - 1, 5 + i * 3)] || player;
    option.x += (target.x - option.x) * Math.min(1, dt * 18);
    option.y += (target.y - option.y) * Math.min(1, dt * 18);
  });

  if (keys.has('Space') && player.cooldown <= 0 && respawnTimer <= 0) {
    fireFrom(player.x + 34, player.y, 'player');
    player.options.forEach((option, i) => fireFrom(option.x + 18, option.y, 'player', `option-${i}`));
    player.cooldown = player.power.shot > 0 ? 0.42 : 0.28;
  }
}

function updateBullets(dt) {
  for (const bullet of bullets) {
    if (bullet.beam) {
      bullet.life -= dt;
      continue;
    }
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  }
  bullets = bullets.filter(bullet => (
    bullet.beam
      ? bullet.life > 0
      : bullet.x > -60 && bullet.x < LW + 40 && bullet.y > -30 && bullet.y < LH + 30
  ));

  for (const bullet of enemyBullets) {
    if (bullet.delay > 0) {
      bullet.delay -= dt;
      continue;
    }
    if (bullet.weave) bullet.vy += Math.sin(distance * 8 + bullet.phase) * bullet.weave * dt;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  }
  enemyBullets = enemyBullets.filter(bullet => bullet.x > -40 && bullet.x < LW + 60 && bullet.y > -30 && bullet.y < LH + 30);
}

function updateEnemies(dt) {
  const ease = stageEase();
  const hard = difficulty();
  const maxEnemyBullets = ease < 1 ? 3 : Math.floor(8 + hard * 16);
  for (const enemy of enemies) {
    enemy.phase += dt * 4;
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    if (enemy.type === 'weaver' || enemy.type === 'waveScout' || enemy.movePattern === 'wave') enemy.y = enemy.baseY + Math.sin(enemy.phase) * (enemy.amp || 42);
    if (enemy.movePattern === 'pincer' && (enemy.y < 78 || enemy.y > LH - 88)) enemy.vy *= -1;
    enemy.y = clamp(enemy.y, 58, LH - 64);
    enemy.shotTimer -= dt;
    if (enemy.shotTimer <= 0 && enemy.x < LW - 40) {
      const canFire = distance > 7 && enemyBullets.length < maxEnemyBullets && (ease >= 1 || enemy.type !== 'scout' || Math.random() < 0.28);
      if (canFire) {
        fireEnemyPattern(enemy, hard, ease);
        if (hard > 0.55 && Math.random() < 0.18 + (hard - 0.55) * 1.45) {
          const backKind = enemy.type === 'heavyTurret' || enemy.type === 'miniBoss' ? 'heavy' : 'normal';
          enemyBullets.push({ x: enemy.x + 12, y: enemy.y, w: backKind === 'heavy' ? 18 : 14, h: backKind === 'heavy' ? 10 : 6, vx: 190 + hard * 50, vy: enemyBulletVy(enemy, hard) * 0.8, kind: backKind });
        }
      }
      const earlyDelay = (1 - ease) * 2.1;
      enemy.shotTimer = enemy.type === 'miniBoss' ? rand(0.55, 0.9) : enemy.type === 'heavyTurret' ? rand(0.75, 1.1) : enemy.type === 'turret' ? rand(0.95, 1.45) + earlyDelay : rand(1.7, 2.8) + earlyDelay;
    }
  }
  for (const id of Object.keys(formations)) {
    if (distance > formations[id].deadline) formations[id].failed = true;
  }
  for (const enemy of enemies) {
    if (!enemy.dead && enemy.x + enemy.w <= -60) failFormation(enemy);
  }
  enemies = enemies.filter(enemy => !enemy.dead && enemy.x + enemy.w > -60 && enemy.hp > 0);
}

function enemyBulletVy(enemy, hard) {
  if (hard < 0.25) {
    if (enemy.type === 'weaver' || enemy.type === 'waveScout') return Math.sin(enemy.phase) > 0 ? 24 : -24;
    return 0;
  }
  if (hard < 0.55 || Math.random() < 0.45) {
    const route = enemy.type === 'heavyTurret' ? 28 : enemy.type === 'turret' ? 18 : enemy.type === 'weaver' || enemy.type === 'waveScout' ? 34 : 0;
    return Math.sin(enemy.phase) > 0 ? route : -route;
  }
  return clamp((player.y - enemy.y) * 0.42, -88, 88);
}

function fireEnemyPattern(enemy, hard, ease) {
  const kind = enemy.type === 'miniBoss' ? 'orb' : enemy.type === 'heavyTurret' ? 'heavy' : enemy.type === 'turret' ? 'needle' : enemy.type === 'weaver' || enemy.type === 'waveScout' ? 'orb' : 'normal';
  const base = { x: enemy.x - 12, y: enemy.y, w: kind === 'heavy' ? 18 : kind === 'needle' ? 20 : kind === 'orb' ? 12 : 14, h: kind === 'heavy' ? 10 : kind === 'needle' ? 4 : kind === 'orb' ? 12 : 6, vx: -230 - ease * 20, kind };
  const vy = enemyBulletVy(enemy, hard);
  if (enemy.type === 'miniBoss') {
    enemyBullets.push({ ...base, vy: -72 });
    enemyBullets.push({ ...base, vy: 0 });
    enemyBullets.push({ ...base, vy: 72 });
    enemyBullets.push({ ...base, vy: clamp((player.y - enemy.y) * 0.32, -80, 80), delay: 0.34 });
    return;
  }
  if (enemy.type === 'heavyTurret') {
    enemyBullets.push({ ...base, vy: vy - 56 });
    enemyBullets.push({ ...base, vy });
    enemyBullets.push({ ...base, vy: vy + 56 });
    enemyBullets.push({ ...base, vy: clamp((player.y - enemy.y) * 0.28, -72, 72), delay: 0.3 });
    return;
  }
  if (enemy.type === 'turret') {
    enemyBullets.push({ ...base, vy: vy - 48 });
    enemyBullets.push({ ...base, vy });
    enemyBullets.push({ ...base, vy: vy + 48 });
    return;
  }
  if (hard > 0.62 && Math.random() < 0.35) {
    enemyBullets.push({ ...base, vy, delay: 0.22 });
    return;
  }
  if (hard > 0.48 && Math.random() < 0.3) {
    enemyBullets.push({ ...base, vy, weave: 80, phase: enemy.phase });
    return;
  }
  enemyBullets.push({ ...base, vy });
}

function failFormation(enemy) {
  if (enemy.formationId == null) return;
  const formation = formations[enemy.formationId];
  if (!formation) return;
  formation.failed = true;
  formation.alive -= 1;
  enemy.dead = true;
  if (formation.alive <= 0) delete formations[enemy.formationId];
}

function defeatEnemy(enemy) {
  enemy.dead = true;
  score += enemy.points;
  addExplosion(enemy.x, enemy.y, COLORS.orange, 22);
  if (enemy.formationId == null) return;

  const formation = formations[enemy.formationId];
  if (!formation) return;
  formation.alive -= 1;
  if (formation.alive <= 0) {
    if (!formation.failed) spawnCapsuleAt(enemy.x - 12, enemy.y, -85);
    delete formations[enemy.formationId];
  }
}

function updateCapsules(dt) {
  for (const capsule of capsules) {
    capsule.phase += dt * 6;
    capsule.x += capsule.vx * dt;
    capsule.y += Math.sin(capsule.phase) * 22 * dt;
  }
  capsules = capsules.filter(capsule => capsule.x + capsule.w > -20);
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);
}

function checkCollisions() {
  const playerBox = { x: player.x - 20, y: player.y - 12, w: 42, h: 24 };

  for (const bullet of bullets) {
    for (const enemy of enemies) {
      const bulletBox = { x: bullet.x, y: bullet.y - bullet.h / 2, w: bullet.w, h: bullet.h };
      const alreadyHit = bullet.penetrates && bullet.hitEnemies.has(enemy);
      if (enemy.hp > 0 && !bullet.dead && !alreadyHit && rectsOverlap(bulletBox, { x: enemy.x - enemy.w / 2, y: enemy.y - enemy.h / 2, w: enemy.w, h: enemy.h })) {
        if (bullet.penetrates) {
          bullet.hitEnemies.add(enemy);
        } else {
          bullet.dead = true;
        }
        enemy.hp -= 1;
        addExplosion(bullet.x, bullet.y, bullet.penetrates ? COLORS.cyan : COLORS.yellow, 5);
        if (enemy.hp <= 0) {
          defeatEnemy(enemy);
        }
      }
    }
  }
  bullets = bullets.filter(bullet => !bullet.dead);
  enemies = enemies.filter(enemy => !enemy.dead);

  for (const capsule of capsules) {
    if (rectsOverlap(playerBox, capsule)) {
      capsule.dead = true;
      addExplosion(capsule.x, capsule.y, COLORS.cyan, 18);
      advancePowerGauge();
    }
  }
  capsules = capsules.filter(capsule => !capsule.dead);

  if (player.invuln > 0 || respawnTimer > 0) return;
  const hitByBullet = enemyBullets.some(bullet => (bullet.delay || 0) <= 0 && rectsOverlap(playerBox, { x: bullet.x, y: bullet.y - bullet.h / 2, w: bullet.w, h: bullet.h }));
  const hitByEnemy = enemies.some(enemy => rectsOverlap(playerBox, { x: enemy.x - enemy.w / 2, y: enemy.y - enemy.h / 2, w: enemy.w, h: enemy.h }));
  if (hitByBullet || hitByEnemy) damagePlayer();
}

function damagePlayer() {
  if (player.power.shield > 0) {
    player.power.shield -= 1;
    addExplosion(player.x, player.y, COLORS.cyan, 24);
    enemyBullets = [];
    player.invuln = 1.0;
    messageTimer = 1.2;
    lastPower = 'SHIELD';
    return;
  }

  lives -= 1;
  addExplosion(player.x, player.y, COLORS.red, 30);
  enemyBullets = [];
  for (const enemy of enemies) {
    if (enemy.x <= player.x + 80) failFormation(enemy);
  }
  enemies = enemies.filter(enemy => !enemy.dead && enemy.x > player.x + 80);
  player.invuln = 2.1;
  respawnTimer = 0.9;
  player.x = 92;
  player.y = LH / 2;
  player.power.shot = Math.max(0, player.power.shot - 1);
  player.power.sub = Math.max(0, player.power.sub - 1);
  player.power.option = Math.max(0, player.power.option - 1);
  player.options.length = player.power.option;
  if (lives <= 0) {
    state = 'gameover';
    hiScore = Math.max(hiScore, score);
    localStorage.setItem('side_shooter_hi', hiScore);
  }
}

// ── Drawing ─────────────────────────────────────────────────────────────────
function withLogicalCanvas(draw) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = COLORS.black;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
  ctx.imageSmoothingEnabled = false;
  draw();
}

function draw() {
  withLogicalCanvas(() => {
    drawBackground();
    if (state === 'intro') drawIntro();
    else {
      drawGameObjects();
      drawHud();
      if (state === 'gameover') drawGameOver();
    }
  });
}

function drawBackground() {
  ctx.fillStyle = '#02040c';
  ctx.fillRect(0, 0, LW, LH);
  for (const star of stars || []) {
    ctx.fillStyle = star.color;
    ctx.globalAlpha = star.r === 1 ? 0.72 : 0.95;
    ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.r, star.r);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#062222';
  ctx.fillRect(0, LH - 24, LW, 24);
  for (const rock of terrain || []) {
    ctx.fillStyle = '#0b3432';
    ctx.fillRect(rock.x, 0, rock.w, rock.top);
    ctx.fillRect(rock.x, LH - rock.bottom, rock.w, rock.bottom);
    ctx.fillStyle = COLORS.dim;
    ctx.fillRect(rock.x + 5, rock.top - 5, rock.w - 10, 5);
    ctx.fillRect(rock.x + 5, LH - rock.bottom, rock.w - 10, 5);
  }

  ctx.strokeStyle = 'rgba(47, 255, 210, 0.22)';
  ctx.lineWidth = 2;
  for (let y = 86; y < LH; y += 86) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(distance * 2 + y) * 5);
    ctx.lineTo(LW, y + Math.sin(distance * 2 + y + 1) * 5);
    ctx.stroke();
  }
}

function drawGameObjects() {
  for (const capsule of capsules) drawCapsule(capsule);
  for (const bullet of bullets) drawPlayerBullet(bullet);
  for (const bullet of enemyBullets) drawEnemyBullet(bullet);
  for (const enemy of enemies) drawEnemy(enemy);
  for (const option of player.options) drawOption(option);
  if (respawnTimer <= 0 || Math.floor(player.invuln * 12) % 2 === 0) drawPlayer();
  drawParticles();
}

function drawPlayer() {
  const x = player.x;
  const y = player.y;
  const flame = 10 + Math.random() * 8;

  ctx.save();
  if (player.power.shield > 0) {
    ctx.globalAlpha = 0.16 + player.power.shield * 0.07;
    ctx.fillStyle = COLORS.cyan;
    ctx.beginPath();
    ctx.ellipse(x + 2, y, 52, 29, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.62 + player.power.shield * 0.08;
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(x + 2, y, 50, 27, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x + 2, y, 44, 22, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.globalAlpha = 0.32;
  ctx.fillStyle = COLORS.cyan;
  ctx.beginPath();
  ctx.ellipse(x + 5, y, 44, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = COLORS.orange;
  ctx.beginPath();
  ctx.moveTo(x - 28, y - 6);
  ctx.lineTo(x - 28 - flame, y);
  ctx.lineTo(x - 28, y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.yellow;
  ctx.fillRect(x - 33, y - 2, 8, 4);

  ctx.fillStyle = COLORS.blue;
  ctx.beginPath();
  ctx.moveTo(x - 18, y - 8);
  ctx.lineTo(x - 3, y - 27);
  ctx.lineTo(x + 14, y - 7);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 18, y + 8);
  ctx.lineTo(x - 3, y + 27);
  ctx.lineTo(x + 14, y + 7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COLORS.cyan;
  ctx.beginPath();
  ctx.moveTo(x - 27, y - 10);
  ctx.lineTo(x + 14, y - 13);
  ctx.lineTo(x + 36, y);
  ctx.lineTo(x + 14, y + 13);
  ctx.lineTo(x - 27, y + 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COLORS.white;
  ctx.beginPath();
  ctx.moveTo(x + 3, y - 6);
  ctx.lineTo(x + 25, y);
  ctx.lineTo(x + 3, y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.black;
  ctx.fillRect(x - 12, y - 4, 13, 8);
  ctx.fillStyle = COLORS.cyan;
  ctx.fillRect(x - 8, y - 2, 7, 4);
  ctx.restore();
}

function drawOption(option) {
  ctx.fillStyle = COLORS.purple;
  ctx.beginPath();
  ctx.moveTo(option.x - 12, option.y);
  ctx.lineTo(option.x - 3, option.y - 9);
  ctx.lineTo(option.x + 13, option.y - 5);
  ctx.lineTo(option.x + 13, option.y + 5);
  ctx.lineTo(option.x - 3, option.y + 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(option.x + 3, option.y - 2, 8, 4);
}

function drawPlayerBullet(bullet) {
  if (bullet.beam) {
    const alpha = clamp(bullet.life / bullet.maxLife, 0, 1);
    ctx.globalAlpha = 0.35 * alpha;
    ctx.fillStyle = COLORS.cyan;
    ctx.fillRect(bullet.x, bullet.y - 9, bullet.w, 18);
    ctx.globalAlpha = 0.95 * alpha;
    ctx.fillStyle = COLORS.cyan;
    ctx.fillRect(bullet.x, bullet.y - 3, bullet.w, 6);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(bullet.x, bullet.y - 1, bullet.w, 2);
    ctx.globalAlpha = 1;
    return;
  }

  ctx.fillStyle = COLORS.yellow;
  ctx.fillRect(bullet.x, bullet.y - bullet.h / 2, bullet.w, bullet.h);
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(bullet.x + bullet.w - 5, bullet.y - 2, 5, 4);
}

function drawEnemyBullet(bullet) {
  ctx.globalAlpha = bullet.delay > 0 ? 0.35 : 1;
  if (bullet.kind === 'orb') {
    ctx.fillStyle = COLORS.purple;
    ctx.beginPath();
    ctx.ellipse(bullet.x + bullet.w / 2, bullet.y, bullet.w / 2, bullet.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(bullet.x + 4, bullet.y - 1, bullet.w - 8, 2);
  } else if (bullet.kind === 'heavy') {
    ctx.fillStyle = COLORS.orange;
    ctx.fillRect(bullet.x, bullet.y - bullet.h / 2, bullet.w, bullet.h);
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(bullet.x + 3, bullet.y - bullet.h / 2 + 2, bullet.w - 6, bullet.h - 4);
  } else if (bullet.kind === 'needle') {
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(bullet.x, bullet.y - 2, bullet.w, 4);
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(bullet.x, bullet.y - 1, 5, 2);
  } else {
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(bullet.x, bullet.y - bullet.h / 2, bullet.w, bullet.h);
  }
  ctx.globalAlpha = 1;
}

function drawEnemy(enemy) {
  const x = enemy.x;
  const y = enemy.y;
  const color =
    enemy.type === 'miniBoss' ? COLORS.orange :
    enemy.type === 'heavyTurret' ? COLORS.red :
    enemy.type === 'turret' ? COLORS.red :
    enemy.type === 'weaver' ? COLORS.purple :
    enemy.type === 'waveScout' ? COLORS.blue :
    enemy.type === 'pincerScout' ? COLORS.yellow :
    COLORS.green;

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, enemy.w * 0.75, enemy.h * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;

  if (enemy.type === 'miniBoss') {
    ctx.beginPath();
    ctx.moveTo(x - 44, y - 24);
    ctx.lineTo(x + 26, y - 20);
    ctx.lineTo(x + 48, y);
    ctx.lineTo(x + 26, y + 20);
    ctx.lineTo(x - 44, y + 24);
    ctx.lineTo(x - 28, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(x - 20, y - 14, 24, 28);
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(x - 10, y - 8, 16, 16);
    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(x - 52, y - 8, 16, 5);
    ctx.fillRect(x - 52, y + 3, 16, 5);
  } else if (enemy.type === 'heavyTurret') {
    ctx.beginPath();
    ctx.moveTo(x - 28, y - 18);
    ctx.lineTo(x + 14, y - 20);
    ctx.lineTo(x + 30, y);
    ctx.lineTo(x + 14, y + 20);
    ctx.lineTo(x - 28, y + 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(x - 17, y - 10, 22, 20);
    ctx.fillStyle = COLORS.orange;
    ctx.fillRect(x - 39, y - 5, 20, 10);
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(x + 10, y - 3, 14, 6);
  } else if (enemy.type === 'turret') {
    ctx.beginPath();
    ctx.moveTo(x - 20, y - 13);
    ctx.lineTo(x + 11, y - 17);
    ctx.lineTo(x + 22, y);
    ctx.lineTo(x + 11, y + 17);
    ctx.lineTo(x - 20, y + 13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(x - 11, y - 7, 15, 14);
    ctx.fillStyle = COLORS.orange;
    ctx.fillRect(x - 30, y - 4, 16, 8);
  } else if (enemy.type === 'weaver') {
    ctx.beginPath();
    ctx.moveTo(x - 19, y);
    ctx.lineTo(x - 3, y - 15);
    ctx.lineTo(x + 19, y - 10);
    ctx.lineTo(x + 9, y);
    ctx.lineTo(x + 19, y + 10);
    ctx.lineTo(x - 3, y + 15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(x + 2, y - 4, 10, 8);
  } else if (enemy.type === 'waveScout') {
    ctx.beginPath();
    ctx.moveTo(x - 18, y);
    ctx.lineTo(x - 6, y - 13);
    ctx.lineTo(x + 19, y - 8);
    ctx.lineTo(x + 10, y);
    ctx.lineTo(x + 19, y + 8);
    ctx.lineTo(x - 6, y + 13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(x - 7, y - 2, 15, 4);
  } else if (enemy.type === 'pincerScout') {
    ctx.beginPath();
    ctx.moveTo(x - 18, y - 11);
    ctx.lineTo(x + 16, y - 4);
    ctx.lineTo(x + 22, y);
    ctx.lineTo(x + 16, y + 4);
    ctx.lineTo(x - 18, y + 11);
    ctx.lineTo(x - 7, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(x + 1, y - 3, 9, 6);
  } else {
    ctx.beginPath();
    ctx.moveTo(x - 18, y - 10);
    ctx.lineTo(x + 14, y - 8);
    ctx.lineTo(x + 20, y);
    ctx.lineTo(x + 14, y + 8);
    ctx.lineTo(x - 18, y + 10);
    ctx.lineTo(x - 10, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(x + 2, y - 3, 8, 6);
  }

  ctx.fillStyle = COLORS.white;
  ctx.fillRect(x - enemy.w / 2 - 7, y - 2, 10, 4);
  ctx.restore();
}

function drawCapsule(capsule) {
  ctx.fillStyle = COLORS.cyan;
  ctx.fillRect(capsule.x, capsule.y, capsule.w, capsule.h);
  ctx.fillStyle = Math.floor(capsule.phase * 2) % 2 ? COLORS.yellow : COLORS.white;
  ctx.fillRect(capsule.x + 6, capsule.y + 4, 12, 3);
  ctx.fillRect(capsule.x + 6, capsule.y + 11, 12, 3);
  ctx.fillRect(capsule.x + 10, capsule.y + 7, 4, 4);
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawHud() {
  ctx.fillStyle = COLORS.white;
  ctx.font = '16px "Press Start 2P", monospace';
  ctx.fillText(`SCORE ${score.toString().padStart(6, '0')}`, 24, 32);
  ctx.fillText(`HI ${hiScore.toString().padStart(6, '0')}`, 374, 32);
  ctx.fillText(`LIVES ${Math.max(0, lives)}`, 740, 32);
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.fillStyle = COLORS.cyan;
  ctx.fillText(`TIME ${Math.floor(distance).toString().padStart(3, '0')}s`, 24, 56);
  ctx.fillText(`LEVEL ${Math.max(1, Math.round(difficulty() * 100)).toString().padStart(3, '0')}`, 184, 56);

  const cellW = 132;
  const startX = 18;
  const y = LH - 32;
  for (let i = 0; i < POWER_GAUGE.length; i++) {
    const name = POWER_GAUGE[i];
    const x = startX + i * cellW;
    ctx.fillStyle = i === powerCursor ? COLORS.yellow : COLORS.dim;
    ctx.fillRect(x, y, cellW - 10, 22);
    ctx.fillStyle = '#02040c';
    ctx.fillRect(x + 3, y + 3, cellW - 16, 16);
    ctx.fillStyle = i === powerCursor ? COLORS.yellow : POWER_COLOR[name];
    ctx.fillText(`${POWER_LABEL[name]} ${player.power[name]}`, x + 8, y + 15);
  }
  ctx.fillStyle = COLORS.white;
  ctx.fillText('ENTER/SHIFT ACTIVATE', 700, LH - 17);
  if (messageTimer > 0) {
    ctx.fillStyle = COLORS.yellow;
    ctx.fillText(lastPower, 404, 70);
  }
}

function drawIntro() {
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.cyan;
  ctx.font = '26px "Press Start 2P", monospace';
  ctx.fillText('SIDE SCROLLING', LW / 2, 132);
  ctx.fillText('SHOOTER', LW / 2, 170);
  ctx.fillStyle = COLORS.white;
  ctx.font = '12px "Press Start 2P", monospace';
  ctx.fillText('ARROWS / WASD: MOVE', LW / 2, 236);
  ctx.fillText('SPACE: SHOT / START', LW / 2, 264);
  ctx.fillText('ENTER / SHIFT: POWER UP', LW / 2, 292);

  drawIntroOption(0, 350, 'START LEVEL', START_LEVELS[startLevelIndex].toString().padStart(3, '0'));
  drawIntroOption(1, 388, 'EQUIP', LOADOUTS[loadoutIndex].label);

  ctx.fillStyle = COLORS.yellow;
  ctx.fillText('UP/DOWN SELECT  LEFT/RIGHT CHANGE', LW / 2, 442);
  ctx.fillText('CAPSULES MOVE THE POWER GAUGE', LW / 2, 474);
  ctx.textAlign = 'left';
}

function drawIntroOption(index, y, label, value) {
  ctx.fillStyle = introSelection === index ? COLORS.yellow : COLORS.dim;
  ctx.fillRect(260, y - 21, 440, 30);
  ctx.fillStyle = '#02040c';
  ctx.fillRect(264, y - 17, 432, 22);
  ctx.fillStyle = introSelection === index ? COLORS.yellow : COLORS.white;
  ctx.fillText(`${label}  < ${value} >`, LW / 2, y);
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.fillRect(0, 0, LW, LH);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.red;
  ctx.font = '26px "Press Start 2P", monospace';
  ctx.fillText('GAME OVER', LW / 2, 238);
  ctx.fillStyle = COLORS.white;
  ctx.font = '12px "Press Start 2P", monospace';
  ctx.fillText('PRESS SPACE OR ENTER TO RESTART', LW / 2, 292);
  ctx.textAlign = 'left';
}

// ── Main loop ───────────────────────────────────────────────────────────────
function loop(time = 0) {
  const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

resetGame();
state = 'intro';
requestAnimationFrame(loop);
