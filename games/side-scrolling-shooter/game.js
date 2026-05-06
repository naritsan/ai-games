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

const POWER_ORDER = ['speed', 'shot', 'option'];
const POWER_LABEL = {
  speed: 'SPEED UP',
  shot: 'SHOT BOOST',
  option: 'OPTION',
};

const keys = new Set();
let state = 'intro'; // 'intro' | 'playing' | 'gameover'
let lastTime = 0;
let score = 0;
let hiScore = +localStorage.getItem('side_shooter_hi') || 0;
let lives = 3;
let distance = 0;
let nextEnemyAt = 0;
let nextCapsuleAt = 0;
let respawnTimer = 0;
let messageTimer = 0;
let lastPower = '';

let player;
let bullets;
let enemyBullets;
let enemies;
let capsules;
let particles;
let stars;
let terrain;

// ── Utility ─────────────────────────────────────────────────────────────────
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rand = (min, max) => min + Math.random() * (max - min);
const rectsOverlap = (a, b) => (
  a.x < b.x + b.w &&
  a.x + a.w > b.x &&
  a.y < b.y + b.h &&
  a.y + a.h > b.y
);

function fireFrom(x, y, source = 'player') {
  const shotLevel = player?.power.shot || 0;
  const speed = source === 'player' ? 560 + shotLevel * 70 : -260;
  const size = source === 'player' ? 8 + shotLevel * 2 : 7;
  bullets.push({ x, y, w: 18, h: size, vx: speed, vy: 0, source });
  if (source === 'player' && shotLevel >= 1) {
    bullets.push({ x, y: y - 12, w: 15, h: 5, vx: speed * 0.98, vy: -28, source });
    bullets.push({ x, y: y + 12, w: 15, h: 5, vx: speed * 0.98, vy: 28, source });
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
    power: { speed: 0, shot: 0, option: 0 },
    options: [],
    trail: [],
  };
}

function resetGame() {
  score = 0;
  lives = 3;
  distance = 0;
  nextEnemyAt = 0.6;
  nextCapsuleAt = 8;
  respawnTimer = 0;
  messageTimer = 0;
  lastPower = '';
  player = makePlayer();
  bullets = [];
  enemyBullets = [];
  enemies = [];
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

function makeTerrain(x = LW + rand(0, 80)) {
  const h = rand(20, 92);
  return { x, w: rand(22, 48), top: h * rand(0.4, 1), bottom: h, speed: rand(80, 130) };
}

function spawnEnemy() {
  const typeRoll = Math.random();
  const type = typeRoll > 0.82 ? 'turret' : typeRoll > 0.45 ? 'weaver' : 'scout';
  enemies.push({
    type,
    x: LW + 42,
    y: rand(72, LH - 82),
    w: type === 'turret' ? 38 : 34,
    h: type === 'turret' ? 30 : 24,
    vx: type === 'turret' ? -95 : type === 'weaver' ? -145 : -185,
    baseY: 0,
    phase: rand(0, Math.PI * 2),
    hp: type === 'turret' ? 3 : type === 'weaver' ? 2 : 1,
    shotTimer: rand(0.7, 1.8),
    points: type === 'turret' ? 250 : type === 'weaver' ? 160 : 100,
  });
  enemies[enemies.length - 1].baseY = enemies[enemies.length - 1].y;
}

function spawnCapsule() {
  capsules.push({
    x: LW + 26,
    y: rand(84, LH - 94),
    w: 24,
    h: 18,
    vx: -125,
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

function applyPowerUp() {
  let gained = POWER_ORDER.find(name => player.power[name] < (name === 'option' ? 2 : 3));
  gained ||= POWER_ORDER[Math.floor(Math.random() * POWER_ORDER.length)];
  player.power[gained] = Math.min(player.power[gained] + 1, gained === 'option' ? 2 : 3);
  if (gained === 'speed') player.speed = 235 + player.power.speed * 55;
  if (gained === 'option') syncOptions();
  score += 500;
  messageTimer = 2.0;
  lastPower = POWER_LABEL[gained];
}

function syncOptions() {
  while (player.options.length < player.power.option) {
    player.options.push({ x: player.x - 42 * (player.options.length + 1), y: player.y });
  }
}

// ── Input ───────────────────────────────────────────────────────────────────
window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
    event.preventDefault();
  }
  keys.add(event.code);
  if ((state === 'intro' || state === 'gameover') && (event.code === 'Space' || event.code === 'Enter')) {
    resetGame();
  }
});

window.addEventListener('keyup', (event) => keys.delete(event.code));

// ── Update ──────────────────────────────────────────────────────────────────
function update(dt) {
  if (state !== 'playing') return;

  distance += dt;
  nextEnemyAt -= dt;
  nextCapsuleAt -= dt;
  messageTimer = Math.max(0, messageTimer - dt);
  respawnTimer = Math.max(0, respawnTimer - dt);
  player.cooldown = Math.max(0, player.cooldown - dt);
  player.invuln = Math.max(0, player.invuln - dt);

  if (nextEnemyAt <= 0) {
    spawnEnemy();
    nextEnemyAt = Math.max(0.35, rand(0.75, 1.45) - distance * 0.006);
  }
  if (nextCapsuleAt <= 0) {
    spawnCapsule();
    nextCapsuleAt = rand(11, 16);
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
  player.x = clamp(player.x, 20, LW * 0.58);
  player.y = clamp(player.y, 48, LH - 50);

  player.trail.unshift({ x: player.x, y: player.y });
  if (player.trail.length > 22) player.trail.pop();
  player.options.forEach((option, i) => {
    const target = player.trail[Math.min(player.trail.length - 1, 7 + i * 6)] || player;
    option.x += (target.x - 46 - i * 18 - option.x) * Math.min(1, dt * 8);
    option.y += (target.y - option.y) * Math.min(1, dt * 8);
  });

  if (keys.has('Space') && player.cooldown <= 0 && respawnTimer <= 0) {
    fireFrom(player.x + 34, player.y, 'player');
    for (const option of player.options) fireFrom(option.x + 18, option.y, 'player');
    player.cooldown = Math.max(0.12, 0.28 - player.power.shot * 0.045);
  }
}

function updateBullets(dt) {
  for (const bullet of bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  }
  bullets = bullets.filter(bullet => bullet.x < LW + 40 && bullet.y > -30 && bullet.y < LH + 30);

  for (const bullet of enemyBullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  }
  enemyBullets = enemyBullets.filter(bullet => bullet.x > -40 && bullet.y > -30 && bullet.y < LH + 30);
}

function updateEnemies(dt) {
  for (const enemy of enemies) {
    enemy.phase += dt * 4;
    enemy.x += enemy.vx * dt;
    if (enemy.type === 'weaver') enemy.y = enemy.baseY + Math.sin(enemy.phase) * 42;
    enemy.shotTimer -= dt;
    if (enemy.shotTimer <= 0 && enemy.x < LW - 40) {
      enemyBullets.push({ x: enemy.x - 12, y: enemy.y, w: 14, h: 6, vx: -250, vy: rand(-30, 30) });
      enemy.shotTimer = enemy.type === 'turret' ? rand(0.8, 1.3) : rand(1.4, 2.4);
    }
  }
  enemies = enemies.filter(enemy => enemy.x + enemy.w > -60 && enemy.hp > 0);
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
      if (!bullet.dead && rectsOverlap(bulletBox, { x: enemy.x - enemy.w / 2, y: enemy.y - enemy.h / 2, w: enemy.w, h: enemy.h })) {
        bullet.dead = true;
        enemy.hp -= 1;
        addExplosion(bullet.x, bullet.y, COLORS.yellow, 5);
        if (enemy.hp <= 0) {
          score += enemy.points;
          addExplosion(enemy.x, enemy.y, COLORS.orange, 22);
        }
      }
    }
  }
  bullets = bullets.filter(bullet => !bullet.dead);

  for (const capsule of capsules) {
    if (rectsOverlap(playerBox, capsule)) {
      capsule.dead = true;
      addExplosion(capsule.x, capsule.y, COLORS.cyan, 18);
      applyPowerUp();
    }
  }
  capsules = capsules.filter(capsule => !capsule.dead);

  if (player.invuln > 0 || respawnTimer > 0) return;
  const hitByBullet = enemyBullets.some(bullet => rectsOverlap(playerBox, { x: bullet.x, y: bullet.y - bullet.h / 2, w: bullet.w, h: bullet.h }));
  const hitByEnemy = enemies.some(enemy => rectsOverlap(playerBox, { x: enemy.x - enemy.w / 2, y: enemy.y - enemy.h / 2, w: enemy.w, h: enemy.h }));
  if (hitByBullet || hitByEnemy) damagePlayer();
}

function damagePlayer() {
  lives -= 1;
  addExplosion(player.x, player.y, COLORS.red, 30);
  enemyBullets = [];
  enemies = enemies.filter(enemy => enemy.x > player.x + 80);
  player.invuln = 2.1;
  respawnTimer = 0.9;
  player.x = 92;
  player.y = LH / 2;
  player.power.shot = Math.max(0, player.power.shot - 1);
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
  ctx.fillStyle = COLORS.cyan;
  ctx.fillRect(player.x - 22, player.y - 8, 34, 16);
  ctx.fillRect(player.x - 8, player.y - 17, 20, 34);
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(player.x + 8, player.y - 5, 26, 10);
  ctx.fillStyle = COLORS.blue;
  ctx.fillRect(player.x - 26, player.y - 5, 8, 10);
  ctx.fillStyle = COLORS.orange;
  ctx.fillRect(player.x - 34, player.y - 4, 8 + Math.random() * 5, 8);
}

function drawOption(option) {
  ctx.fillStyle = COLORS.purple;
  ctx.fillRect(option.x - 11, option.y - 7, 22, 14);
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(option.x + 3, option.y - 3, 8, 6);
}

function drawPlayerBullet(bullet) {
  ctx.fillStyle = COLORS.yellow;
  ctx.fillRect(bullet.x, bullet.y - bullet.h / 2, bullet.w, bullet.h);
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(bullet.x + bullet.w - 5, bullet.y - 2, 5, 4);
}

function drawEnemyBullet(bullet) {
  ctx.fillStyle = COLORS.red;
  ctx.fillRect(bullet.x, bullet.y - bullet.h / 2, bullet.w, bullet.h);
}

function drawEnemy(enemy) {
  ctx.fillStyle = enemy.type === 'turret' ? COLORS.red : enemy.type === 'weaver' ? COLORS.purple : COLORS.green;
  ctx.fillRect(enemy.x - enemy.w / 2, enemy.y - enemy.h / 2, enemy.w, enemy.h);
  ctx.fillStyle = COLORS.black;
  ctx.fillRect(enemy.x - enemy.w / 2 + 5, enemy.y - 4, 8, 8);
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(enemy.x - enemy.w / 2 - 8, enemy.y - 3, 10, 6);
  ctx.fillStyle = COLORS.orange;
  ctx.fillRect(enemy.x + enemy.w / 2 - 5, enemy.y - 6, 7, 12);
}

function drawCapsule(capsule) {
  ctx.fillStyle = COLORS.cyan;
  ctx.fillRect(capsule.x, capsule.y, capsule.w, capsule.h);
  ctx.fillStyle = Math.floor(capsule.phase * 2) % 2 ? COLORS.yellow : COLORS.white;
  ctx.fillRect(capsule.x + 5, capsule.y + 5, capsule.w - 10, capsule.h - 10);
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
  const powers = POWER_ORDER.map(name => `${POWER_LABEL[name]} ${player.power[name]}`).join('  ');
  ctx.fillStyle = COLORS.cyan;
  ctx.fillText(powers, 24, LH - 18);
  if (messageTimer > 0) {
    ctx.fillStyle = COLORS.yellow;
    ctx.fillText(lastPower, 404, 70);
  }
}

function drawIntro() {
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.cyan;
  ctx.font = '26px "Press Start 2P", monospace';
  ctx.fillText('SIDE SCROLLING', LW / 2, 190);
  ctx.fillText('SHOOTER', LW / 2, 228);
  ctx.fillStyle = COLORS.white;
  ctx.font = '12px "Press Start 2P", monospace';
  ctx.fillText('ARROWS / WASD: MOVE', LW / 2, 294);
  ctx.fillText('SPACE: SHOT / START', LW / 2, 322);
  ctx.fillStyle = COLORS.yellow;
  ctx.fillText('COLLECT CAPSULES TO BUILD SPEED, SHOT, OPTION', LW / 2, 366);
  ctx.textAlign = 'left';
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
